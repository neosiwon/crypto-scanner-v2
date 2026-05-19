# WS3 v0.29.0 — Integrated Limited Live Pipeline Pack 완료 보고

**작성일**: 2026-05-19
**branch**: `claude/heuristic-cori-7865e7`
**이전 functional baseline**: WS3 v0.28.0 Actual Coin Candidate Dry-run + Live Validation Success (`d81b723`)
**본 단계 산출**: 1 worker 보강 + 2 console 동기화 수정 + 1 신규 보고서 + 2 문서 갱신 (총 6 staged)

---

## 1. 목표 (실코인 자동 알람 아님 / 통합 제한 라이브 팩)

v0.29 = **여러 코인 dry-run → 후보 리스트 → 선택 후보 1건 TEST_ONLY Telegram 발송**까지 한 번에 검증하는 통합 제한 라이브 팩.

여전히 무제한 자동 알람은 아님:
- 무제한 자동 스캔 0건 / Cron 연결 0건 / 상시 운영모드 ON 0건
- candidate KV 저장 0건 / tracking 자동 시작 0건 / snapshot / evaluation / audit 저장 0건
- 자동 Telegram 발송 0건 (수동 TEST_ONLY 1건 endpoint 만)

한 줄 정의: **v0.29 = 통합 제한 라이브 팩. 멀티코인 dry-run + 선택 1건 TEST_ONLY 수동 발송 endpoint + Limited Live Mode 뼈대 (DISABLED).**

---

## 2. v0.28 dependency 완료 상태 (입력)

```text
Worker version: WS3_v0.28.0_candidate_dry_run (production)
Pages: ws3-canary-console.pages.dev (production, lightweight invite gate 활성)
Worker allowlist: https://ws3-canary-console.pages.dev only
CANARY_ENABLED=false / AUTHORIZED_AT=0 유지
v0.28 production /candidate-dry-run 1회 실 호출 PASS (단일 KRW-BTC 5m, P-C / LOW_VOLUME / score=0)
```

---

## 3. 신규 엔드포인트 (2종)

### 3.1 `POST /multi-candidate-dry-run`

read-only multi-market candidate dry-run. KV / Telegram / candidate 와 무관.

### 3.2 `POST /send-candidate-test`

선택된 후보 1건 TEST_ONLY Telegram 수동 발송. KV write 1건 (duplicate guard 만).

### 3.3 OPTIONS allowlist 확장 (7 → 9)

```
/health / /send-canary / /state / /cleanup-confirm / /operator-reset / /live-preflight / /candidate-dry-run / /multi-candidate-dry-run / /send-candidate-test
```

### 3.4 공통 인증 정책 (3중, 두 엔드포인트 모두)

| # | 조건 | 위반 시 |
|---|---|---|
| 1 | Origin allowlist 통과 | `ORIGIN_MISSING` 403 / `ORIGIN_NOT_ALLOWED` 403 |
| 2 | `X-WS3-Canary-Token === env.WS3_CANARY_INVOKE_TOKEN` exact | `MISSING_INVOKE_TOKEN` 401 / `INVOKE_TOKEN_MISMATCH` 403 |
| 3 | `body.manualTrigger === true` | `MANUAL_TRIGGER_REQUIRED` 400 |

### 3.5 `/send-candidate-test` 추가 인증 (4중)

| # | 조건 | 위반 시 |
|---|---|---|
| 4 | `env.WS3_CANDIDATE_TEST_ENABLED === 'true'` (별도 env flag, CANARY_ENABLED 와 분리) | `CANDIDATE_TEST_DISABLED` 503 |
| 5 | `body.confirmPhrase === "SEND_WS3_TEST_CANDIDATE"` byte-for-byte | `CANDIDATE_TEST_CONFIRM_PHRASE_REQUIRED` 403 |
| 6 | `selectedCandidate.source === "multi-candidate-dry-run"` + payload 정합 | `CANDIDATE_TEST_NO_CANDIDATE` 400 / `CANDIDATE_TEST_INVALID_PAYLOAD` 400 |
| 7 | KV `candidateTestSent.lastSentAt` 60s 이내면 차단 (duplicate guard) | `CANDIDATE_TEST_ALREADY_SENT` 429 |

---

## 4. `/multi-candidate-dry-run` 스펙

### 4.1 request body

```json
{
  "manualTrigger": true,
  "exchange": "upbit",
  "markets": ["KRW-BTC", "KRW-ETH", "KRW-XRP"],
  "timeframe": "5m",
  "limit": 60,
  "maxMarkets": 10
}
```

### 4.2 input 검증

- `exchange`: v0.27 와 동일 allowlist 3종 (lowercase 정규화).
- `markets`: 배열 + 각 entry `^[A-Za-z0-9_\-]{2,32}$`. dedupe (순서 보존).
- 길이: 1 ≤ markets.length ≤ min(MULTI_CANDIDATE_MAX_MARKETS=10, body.maxMarkets).
- `timeframe`: v0.27 와 동일 allowlist 4종.
- `limit`: integer in [1, 120] (v0.28 와 동일).

### 4.3 파이프라인 (`runMultiCandidatePipeline`)

각 market 에 대해 병렬 (Promise.all) 로:
1. `buildLivePreflightUrl(exchange, market, timeframe, limit)` — v0.27 helper 재사용
2. `fetchLiveCandles(deps, url, 5000)` — 5초 AbortController timeout
3. `normalizeCandles(exchange, raw, limit)` — uniform OHLCV oldest→latest
4. `calculateCandleStructureFeatures` / `calculateVolumeFeatures` / `calculateMomentumFeatures` — v0.28 helper 재사용
5. `calculateCandidateDryRunScore` → score / chips
6. `classifyCandidateDryRunGrade` → P-S/P-A/P-B/P-C

각 market 실패는 개별 `{ok:false, market, code}` 로 격리 — 한 market 의 실패가 다른 market 결과를 막지 않음.

### 4.4 정렬

- 성공 결과 = `score desc`, 동점 시 `volumeRatio desc` fallback
- 실패 결과 = 성공 결과 뒤에 부착 (rank 연속)
- `rank` 필드는 정렬 후 1-based 부여

### 4.5 응답 코드

- `MULTI_CANDIDATE_DRY_RUN_OK` 200 — 모두 성공
- `MULTI_CANDIDATE_PARTIAL_OK` 200 — 일부 실패 (okCount ≥ 1)
- `MULTI_CANDIDATE_ALL_FAILED` 502 — 모두 실패 (okCount = 0)
- 입력 검증 실패: `MULTI_CANDIDATE_INVALID_EXCHANGE` / `MULTI_CANDIDATE_INVALID_MARKETS` / `MULTI_CANDIDATE_TOO_MANY_MARKETS` / `MULTI_CANDIDATE_INVALID_TIMEFRAME` / `MULTI_CANDIDATE_LIMIT_EXCEEDED` (모두 400)
- 핸들러 내부 예외: `MULTI_CANDIDATE_FEATURE_ERROR` 500

### 4.6 응답 본문 (whitelist)

```json
{
  "ok": true,
  "status": "OK",
  "code": "MULTI_CANDIDATE_DRY_RUN_OK",
  "httpStatus": 200,
  "version": "WS3_v0.29.0_integrated_limited_live_pipeline",
  "mode": "MULTI_CANDIDATE_DRY_RUN_ONLY",
  "exchange": "upbit",
  "timeframe": "5m",
  "limit": 60,
  "marketCount": N,
  "okCount": M,
  "failCount": N-M,
  "candidateCount": K (P-S/P-A only),
  "results": [
    {
      "rank": 1,
      "market": "KRW-X",
      "score": 0..100,
      "grade": "P-S"|"P-A"|"P-B"|"P-C",
      "isCandidate": bool,
      "reasonChips": [...],
      "changePct": ...,
      "volumeRatio": ...,
      "volumeAccel": ...,
      "closePosition": ...,
      "upperWickPct": ...,
      "rangePct": ...,
      "candleCount": ...,
      "latestTime": "...Z",
      "lastClose": ...,
      "ok": true
    },
    { "rank": N, "market": "KRW-Y", "ok": false, "code": "..." }
  ],
  "safety": {
    "telegramSent": false,
    "kvWritten": false,
    "candidateStored": false,
    "trackingStarted": false
  }
}
```

---

## 5. `/send-candidate-test` 스펙

### 5.1 request body

```json
{
  "manualTrigger": true,
  "confirmPhrase": "SEND_WS3_TEST_CANDIDATE",
  "selectedCandidate": {
    "source": "multi-candidate-dry-run",
    "exchange": "upbit",
    "market": "KRW-BTC",
    "timeframe": "5m",
    "score": 70,
    "grade": "P-A",
    "reasonChips": ["VOLUME_SURGE", "POSITIVE_CHANGE"]
  }
}
```

### 5.2 fixed safety preamble (Telegram 본문 상단)

```text
[WOOS WS3 CANDIDATE TEST_ONLY]
This is not a live trading alert.
manual limited validation only.
실전 알람 아님
테스트 전송
매수/매도 추천 아님

Exchange: ...
Market: ...
Timeframe: ...
Score: ...
Grade: ...
Reason chips: ...
```

- 메시지 본문 = `buildCandidateTestMessageText(c)` 고정 포맷
- 매수 추천 / 수익 보장 / 자동 알람 문구 0건
- raw exchange data / 가격 / 거래량 숫자 미포함 (score/grade/chips 만)
- chips 는 `/^[A-Z_]+$/` 화이트리스트 sanitize (외부 임의 텍스트 차단)

### 5.3 KV duplicate guard

- key: `ws3:canary:candidateTestSent` (`CANDIDATE_TEST_GUARD_KEY`)
- 형식: `{schemaVersion: 'v1', lastSentAt: <nowMs>, reason: 'CANDIDATE_TEST_SENT'}`
- 윈도우: 60s (`CANDIDATE_TEST_GUARD_WINDOW_MS`)
- 60s 이내 재요청 → `CANDIDATE_TEST_ALREADY_SENT` 429
- 사용: `CanaryStateKvAdapter.getJson` / `putJson` 의 generic primitives (어댑터 파일 수정 0건)
- alreadySent / cleanupRequired / circuit / invokeFail / operatorReset 등 **다른 canary state KV key 는 일체 read/write 0건**

### 5.4 응답 (성공)

```json
{
  "ok": true,
  "status": "OK",
  "code": "CANDIDATE_TEST_SENT",
  "httpStatus": 200,
  "version": "WS3_v0.29.0_integrated_limited_live_pipeline",
  "mode": "CANDIDATE_TEST_ONLY",
  "messageType": "CANDIDATE_TEST_ONLY",
  "fixedMessageUsed": true,
  "safety": {
    "telegramSent": true,
    "kvWritten": true,
    "kvWriteScope": "CANDIDATE_TEST_GUARD_ONLY",
    "candidateStored": false,
    "trackingStarted": false
  }
}
```

`kvWriteScope: "CANDIDATE_TEST_GUARD_ONLY"` 의 의미:
- KV write 1건 = duplicate guard 만 (candidate 저장 / tracking / snapshot 등과 무관)
- 사용자 / closure 가 KV write 범위를 명시 추적 가능

### 5.5 raw Telegram response 미노출

`sendCandidateTestTelegram` 은 `resp.text()` 결과를 받기만 하고 폐기. response 본문에 `message_id` / `result` / `from` / `chat` 등 native field 미포함 (smoke S26 검증).

### 5.6 응답 안전 (실 값 노출 0건)

- bot token / chat id / invoke token / KV namespace id — 응답 본문 노출 0건 (smoke S27 검증)
- `BOT_TOKEN` / `CHAT_ID` 는 env 에서 직접 읽고 fetch 헤더/URL/body 에서만 사용 (응답 echo 0건)

---

## 6. Limited Live Mode (UI Section 10)

Web Console 에서 상태 표시만:

```text
Limited Live Mode: DISABLED
Manual test only
No cron
No automatic Telegram
No tracking
```

향후 활성화 조건 (모두 충족 + 별도 사용자 명시 승인 + 별도 Gate 필요):
1. multi-market dry-run 안정
2. candidate test telegram 1회 성공
3. duplicate guard 검증
4. security 재검토
5. 사용자 명시 승인

본 v0.29 단계에서 자동 활성화 0건. 코드 / env 변경 0건.

---

## 7. safe code (신규 16종)

### 7.1 Multi-candidate (8종)

| code | HTTP |
|---|---|
| `MULTI_CANDIDATE_DRY_RUN_OK` | 200 |
| `MULTI_CANDIDATE_PARTIAL_OK` | 200 |
| `MULTI_CANDIDATE_ALL_FAILED` | 502 |
| `MULTI_CANDIDATE_INVALID_EXCHANGE` | 400 |
| `MULTI_CANDIDATE_INVALID_MARKETS` | 400 |
| `MULTI_CANDIDATE_TOO_MANY_MARKETS` | 400 |
| `MULTI_CANDIDATE_INVALID_TIMEFRAME` | 400 |
| `MULTI_CANDIDATE_LIMIT_EXCEEDED` | 400 |
| `MULTI_CANDIDATE_FEATURE_ERROR` | 500 |

(individual market 실패는 `results[]` entry 안의 code 필드 = `CANDIDATE_DRY_RUN_*` 그대로 mapped)

### 7.2 Candidate test (7종)

| code | HTTP |
|---|---|
| `CANDIDATE_TEST_SENT` | 200 |
| `CANDIDATE_TEST_DISABLED` | 503 |
| `CANDIDATE_TEST_CONFIRM_PHRASE_REQUIRED` | 403 |
| `CANDIDATE_TEST_INVALID_PAYLOAD` | 400 |
| `CANDIDATE_TEST_NO_CANDIDATE` | 400 |
| `CANDIDATE_TEST_ALREADY_SENT` | 429 |
| `CANDIDATE_TEST_TELEGRAM_ERROR` | 502 |

기존 v0.25 / v0.26.1 / v0.27 / v0.28 safe code 모두 유지.

---

## 8. no-write 스코프 분리 보장

### 8.1 `/multi-candidate-dry-run` scope grep

```text
writeAlreadySent / writeCleanupRequired / writeCircuit / writeInvokeFail / writeOperatorReset / markAlreadySentReset / putJson / .put( / sendCanary / dispatchCanary / sendMessage
→ 매치 0건
```

### 8.2 `/send-candidate-test` scope grep

```text
putJson(ctKv, CANDIDATE_TEST_GUARD_KEY, ...) — 1건 (duplicate guard 만)
writeAlreadySent / writeCleanupRequired / writeCircuit / writeInvokeFail / writeOperatorReset / markAlreadySentReset — 0건
sendCanary / dispatchCanary — 0건 (인라인 sendCandidateTestTelegram 만)
```

### 8.3 mock smoke S25 검증

`/send-candidate-test` 호출 후 KV store 내용:
- `ws3:canary:candidateTestSent` 1건 만 존재
- `ws3:canary:alreadySent` / `ws3:canary:cleanupRequired` / `ws3:canary:circuit` / `ws3:canary:invokeFail:*` / `ws3:canary:operatorReset` — 0건

---

## 9. mock smoke 결과 (30 시나리오 — spec 24 + 6 추가 leak / scope guards)

```
TOTAL=30 PASS=30 FAIL=0
TELEGRAM_API_CALL_COUNT=1 (S19 mock send only)
KV_PUT_CALL_COUNT=1 (S19 guard write only)
KV_DELETE_CALL_COUNT=0
```

### 9.1 Multi-candidate (S1-S15)

| # | 시나리오 | 결과 |
|---|---|---|
| S1 | no token → 401 | ✅ |
| S2 | bad token → 403 | ✅ |
| S3 | no manualTrigger → 400 | ✅ |
| S4 | too many markets (11개) → 400 MULTI_CANDIDATE_TOO_MANY_MARKETS | ✅ |
| S5 | invalid market → 400 MULTI_CANDIDATE_INVALID_MARKETS | ✅ |
| S6 | 10 markets success → 200 MULTI_CANDIDATE_DRY_RUN_OK / okCount=10 / failCount=0 / safety 4 fields all false | ✅ |
| S7 | partial OK (1 market fails) → 200 MULTI_CANDIDATE_PARTIAL_OK / okCount=2 / failCount=1 | ✅ |
| S8 | sort by score desc (surge market ranks #1) | ✅ |
| S9 | candidateCount = sum(isCandidate) | ✅ |
| S10 | multi safety all false (telegramSent/kvWritten/candidateStored/trackingStarted) | ✅ |
| S11 | features 8 fields all finite per ok row | ✅ |
| S12 | raw exchange field leak (candle_date_time_kst / opening_price / candle_acc_trade_price) CLEAN | ✅ |
| S13 | token leak in multi response CLEAN | ✅ |
| S14 | KV put/delete in multi runs = 0 | ✅ |
| S15 | Telegram count after multi runs = 0 | ✅ |

### 9.2 Candidate test (S16-S27)

| # | 시나리오 | 결과 |
|---|---|---|
| S16 | no token → 401 | ✅ |
| S17 | missing confirm phrase → 403 CANDIDATE_TEST_CONFIRM_PHRASE_REQUIRED | ✅ |
| S17b | wrong confirm phrase → 403 | ✅ |
| S18 | no candidate → 400 CANDIDATE_TEST_NO_CANDIDATE | ✅ |
| S18b | wrong source → 400 CANDIDATE_TEST_INVALID_PAYLOAD | ✅ |
| S18c | enable gate off (env default) → 503 CANDIDATE_TEST_DISABLED | ✅ |
| S19 | mock success → 200 CANDIDATE_TEST_SENT / fixedMessageUsed=true / safety telegramSent=true / kvWritten=true / kvWriteScope=CANDIDATE_TEST_GUARD_ONLY / candidateStored=false / trackingStarted=false | ✅ |
| S20 | messageType = CANDIDATE_TEST_ONLY | ✅ |
| S21 | single object enforced (max 1 candidate) | ✅ |
| S22 | candidateStored = false | ✅ |
| S23 | trackingStarted = false | ✅ |
| S24 | duplicate guard immediate re-send → 429 CANDIDATE_TEST_ALREADY_SENT | ✅ |
| S25 | KV scope = guard only (alreadySent/cleanupRequired/circuit/operatorReset 0건 touch) | ✅ |
| S26 | raw Telegram response leak (message_id/result/from/chat) CLEAN | ✅ |
| S27 | secret leak (bot_token/chat_id/invoke token in response body) CLEAN | ✅ |

실 거래소 API (api.upbit.com / api.bithumb.com / api.binance.com) 호출 **0건**. 실 Telegram API (api.telegram.org) 호출 **0건**. 실 KV API 호출 **0건**.

---

## 10. Web Console 보강 (Sections 8 + 9 + 10)

### 10.1 Section 8: Multi-market Candidate Dry-run

- Exchange select (upbit default) / Markets textarea (10 markets default, 콤마 또는 줄바꿈 구분) / Timeframe select (5m default) / Limit (60 default, max 120)
- Run Multi-market Dry-run 버튼 (1.5s throttle)
- 결과 panel whitelist: code / mode / marketCount / okCount / failCount / candidateCount / telegramSent / kvWritten
- 후보 리스트 표시 (정렬: score desc, top is most likely / [CANDIDATE] 라벨 P-S/P-A 만)
- **Memory-only history (max 5 runs, no storage)**: lastRunAt / marketCount / candidateCount / topScore / topGrade
- localStorage / sessionStorage / IndexedDB / cookie 사용 0건

### 10.2 Section 9: Candidate TEST_ONLY Telegram Send

- Selected Candidate select (Section 8 결과에서 round-trip JSON 으로 전달, source='multi-candidate-dry-run')
- Confirm Phrase 입력칸 (byte-for-byte `SEND_WS3_TEST_CANDIDATE` 필수)
- Send 버튼 disabled = !(candidate selected && phrase exact)
- 결과 panel whitelist: code / messageType / fixedMessageUsed / telegramSent / kvWritten / kvWriteScope / candidateStored / trackingStarted
- 전송 후 confirm phrase + selection 즉시 클리어
- Danger Zone 시각 분리 (border + warning label + danger class)

### 10.3 Section 10: Limited Live Mode

```text
Limited Live Mode: DISABLED
Manual test only / Cron: none / Auto Telegram: none / Tracking: none
```

활성화 조건 5개 + 사용자 명시 승인 + 별도 Gate 필요 (UI 안내문구만, 자동 활성화 코드 0건).

### 10.4 두 파일 byte-for-byte mirror

`web/ws3-canary-console.html` / `web/ws3-canary-console/index.html` 모두 990 → 1435 라인 (+445), 45836 → 68102 bytes. `diff -q` 결과 0건. embedded `<script>` 블록 2개 (Block 0: 4428 chars / Block 1: 39981 chars) Node parse 통과.

---

## 11. 보호 파일 무손상

`git diff --stat HEAD -- worker.js wrangler.toml index.html manifest.json service-worker.js docs/ws3/WS3_CODE_CONTRACT.md docs/ws3/WS3_WORKFLOW_TEMPLATE.md v3/ workers/ws3-canary-state-kv-adapter.js wrangler-canary.example.toml .gitignore` → 빈 출력 = **0건** ✅

- 본선 `worker.js` / `wrangler.toml` (repo 미존재) / `index.html` / `manifest.json` / `service-worker.js` — 미수정
- `v3/` 25종 엔진 — 미수정
- `docs/ws3/WS3_CODE_CONTRACT.md` / `WS3_WORKFLOW_TEMPLATE.md` — 미수정
- `workers/ws3-canary-state-kv-adapter.js` — **미수정** (generic `getJson` / `putJson` 만 재사용)
- `wrangler-canary.example.toml` / `.gitignore` — 미수정
- `workers/ws3-telegram-canary-entry.mjs` — 미스테이지 유지 (untracked)

---

## 12. 보안 / 누출 검증

- bot token / chatId / invoke token 실 값 — 노출 **0건**
- KV namespace ID — 노출 **0건**
- Telegram message_id / raw Telegram response — 노출 **0건** (smoke S26 leak guard PASS)
- exchange API raw native field — response 본문 노출 **0건** (smoke S12)
- Origin 실 값 / IP / cookie / session id / browser fingerprint — 노출 **0건**
- 노출된 폐기 hash repo-wide 매치 **0건**
- masked / first-4 / last-4 / redacted preview — **0건**
- localStorage / sessionStorage / IndexedDB / document.cookie 호출 — **0건** (web grep 매치 2건 모두 정책 부정문맥)
- URL query parameter token 전달 — **0건**
- `console.log` 출력 — **0건**
- 매수 추천 / 수익 보장 문구 — **0건**

---

## 13. Cloudflare 변경 0건

- worker 재배포 0건 (v0.28 production Version 그대로, v0.29 staging 재배포는 별도 Gate)
- Pages 재배포 0건
- KV namespace 생성/변경 0건
- KV binding 변경 0건
- secrets (BOT_TOKEN / CHAT_ID / INVOKE_TOKEN) 변경 0건
- `WS3_CANARY_ALLOWED_ORIGINS` 변경 0건
- `WS3_CANDIDATE_TEST_ENABLED` env 신규 도입 (default 'false', deploy Gate 에서만 'true' 로 임시 활성화 예정)
- 실 Telegram API 호출 0건
- 실 KV write 0건
- 실 `/multi-candidate-dry-run` / `/send-candidate-test` 호출 0건
- 실 거래소 API 호출 0건

---

## 14. 의도된 미구현 (다음 Gate)

본 commit 까지 = v0.29 코드 / 문서 / mock 검증 만. 실제 deploy / 실 호출은 별도 승인:

- v0.29 Deploy/Live Validation Gate (별도):
  1. Worker redeploy (v0.29 production version 반영 + `WS3_CANDIDATE_TEST_ENABLED='true'` 임시 활성화)
  2. Pages redeploy
  3. production console 에서 Check State
  4. Multi-market Dry-run 1회 실 호출
  5. 후보가 있으면 Candidate TEST_ONLY Telegram 1회 (confirmPhrase + selectedCandidate)
  6. 후보가 없으면 발송 생략하고 `LOW_SIGNAL` 정상 판정으로 박제
  7. Telegram 발송 여부 / KV write 여부 / candidateStored / trackingStarted 명확히 박제
  8. 검증 직후 `WS3_CANDIDATE_TEST_ENABLED='false'` 복귀 + Worker redeploy

- v0.30 후보 A: predefined market list expand + watchlist UI
- v0.30 후보 B: Multi-market history persistence (browser only, IndexedDB 검토)
- v0.30 후보 C: Security hardening (Cloudflare Access 재검토 / invoke token rotation / origin allowlist 재검토)
- env-based `MULTI_CANDIDATE_DISABLED` / `CANDIDATE_TEST_DISABLED` 강제 kill switch
- rate limit per origin / market / minute
- candidate score 산식 백테스트 결과 기반 조정
- invoke token rotate automation / ipHash + `WS3_CANARY_HASH_SALT`

---

## 15. v0.29 한계 (재확인)

- mock smoke only. real 거래소 응답 다양성 (rate limit / partial data / market suspension / 비정상 candle) 은 별도 staging Gate.
- 본 단계 = 통합 코드 구현 + mock 검증. 실 Telegram 발송 / 실 KV write 는 별도 Deploy Validation Gate 에서만 1회 한정.
- duplicate guard window = 60s (전역). 60s 가 충분한지는 실 환경에서 재평가.
- candidate score 산식 = v0.28 그대로 재사용. multi-market 환경에서 분포가 어떻게 나오는지는 별도 백테스트 필요.
- Limited Live Mode 활성화 = 본 단계에서 코드/스위치 미구현. UI 상태 표시 + 활성화 조건 문서 박제만.

---

## 16. 기준 commit

- branch: `claude/heuristic-cori-7865e7`
- 이전 functional baseline: WS3 v0.28.0 Actual Coin Candidate Dry-run + Live Validation Success (`d81b723`)
- 본 commit: (push 후 기록, push 별도 승인)

---

## 17. 이번 단계의 핵심 (재인용)

```text
v0.29 = 통합 제한 라이브 팩
무제한 자동 알람 아님
Cron 없음 / Auto Telegram 없음
여러 코인 dry-run → 후보 리스트 → 선택 1건 TEST_ONLY 수동 발송 endpoint
Limited Live Mode = DISABLED (UI 상태 표시 + 활성화 조건 박제만)
candidate KV 저장 0건 / tracking 시작 0건 / snapshot 0건 / evaluation 0건 / audit 0건
KV write 가능 범위 = candidate test duplicate guard 단일 key 만 (kvWriteScope=CANDIDATE_TEST_GUARD_ONLY)
실 Telegram 발송 / 실 KV write / 실 거래소 API 호출 = 별도 Deploy Validation Gate 에서만 1회 한정
실전 스캐너 알람은 v0.30 이후 별도 승인으로만 진행
```

---

## 18. Final Live Validation Result

본 섹션은 v0.29.0 코드 commit (`f923b86`) 이후 실제 Cloudflare Worker redeploy + Pages production deploy + production console 에서 Check State + `/multi-candidate-dry-run` 1회 실 호출 검증까지 마친 결과 박제다. 코드 변경 0건 / tracked source 변경 0건 / hash 또는 raw invite code repo 박제 0건 / Telegram 발송 0건 / KV write 0건 / candidate 저장 0건 / tracking 시작 0건.

본 결과는 **후보 미발생 = LOW_SIGNAL_NORMAL 정상 판정**. 실패가 아니라 dry-run 분류기가 정확히 동작했음을 의미.

### 18.1 Worker / Pages

- Worker deploy: **completed** (Version single fragment `901d73dc`, `ws3-telegram-canary.neosiwon.workers.dev` 동일 URL, size 177.16 KiB / gzip 27.61 KiB)
- Pages deploy: **completed** (production URL `ws3-canary-console.pages.dev`, `--branch=main`, lightweight invite gate 활성 유지, working copy hash 주입 후 즉시 cleanup, tracked source diff 0건)
- Console: Dev Preview Invite Gate 통과 / Multi-market Candidate Dry-run Section 표시 / Limited Live Mode remains DISABLED
- 신규 env: `WS3_CANDIDATE_TEST_ENABLED` 미설정 (default 'false' 동작) — 본 Gate 에서 활성화 0건

### 18.2 Check State (Step H)

- `version=WS3_v0.29.0_integrated_limited_live_pipeline` (v0.29 production 반영 확인)
- `persistenceAvailable=true`
- `canaryEnabled=false`
- `alreadySent=false`
- `cleanupRequired=false`
- `circuitOpen=false`
- `currentPhase=RESET_CONFIRMED`

### 18.3 Multi-market Candidate Dry-run (Step I) — 1회 실 호출

- Result code: `MULTI_CANDIDATE_DRY_RUN_OK`
- Mode: `MULTI_CANDIDATE_DRY_RUN_ONLY`
- Exchange: `upbit`
- Timeframe: `5m`
- Market count: `10`
- Candidate count: `0`
- **Result: `LOW_SIGNAL_NORMAL`** (후보 없음 = 정상 분류)
- Top market: `KRW-NEAR`
- Top score: `24`
- Top grade: `P-C`
- Top reason chips: `HIGH_CLOSE_POSITION`
- Top latest candle time: `2026-05-19T07:50:00Z`
- Top last close: `2480`

### 18.4 Top 10 Summary

```text
#1 KRW-NEAR P-C score=24 chips=HIGH_CLOSE_POSITION
#2 KRW-LINK P-C score=20 chips=-
#3 KRW-DOGE P-C score=20 chips=LOW_VOLUME,HIGH_CLOSE_POSITION
#4 KRW-XRP P-C score=15 chips=LOW_VOLUME,HIGH_CLOSE_POSITION
#5 KRW-AVAX P-C score=10 chips=VOLUME_SURGE,UPPER_WICK_RISK
#6 KRW-ETH P-C score=0 chips=-
#7 KRW-BTC P-C score=0 chips=LOW_VOLUME,UPPER_WICK_RISK
#8 KRW-SOL P-C score=0 chips=LOW_VOLUME,UPPER_WICK_RISK
#9 KRW-ADA P-C score=0 chips=LOW_VOLUME,UPPER_WICK_RISK
#10 KRW-SEI P-C score=0 chips=LOW_VOLUME,UPPER_WICK_RISK
```

### 18.5 점수 산식 검증 포인트 (KRW-AVAX 사례)

- KRW-AVAX: `volRatio=15.102` / `volAccel=10.831` — volume surge 매우 강함 → `VOLUME_SURGE` chip +25 가산
- 동시에 `upperWickPct >= bodyPct * 2 AND closePosition < 0.6` → `UPPER_WICK_RISK` -15 감점 + chip 추가
- 결과 score=10 / grade=P-C / isCandidate=false
- 결론: **단순 volume surge 만으로는 후보 판정 안 함** (위험 감점 로직 정상). v0.28 산식이 multi-market 환경에서 false positive 방지 동작 확인.

### 18.6 Safety (모두 0건 / false)

- Candidate TEST_ONLY Telegram: **skipped** (candidateCount=0 → Case 1 LOW_SIGNAL 분기, Step J 결정)
- `WS3_CANDIDATE_TEST_ENABLED=true` 활성화: **not activated** (Step K 생략)
- Step K/L/M: **모두 생략** (후보 없음 → TEST_ONLY 발송 경로 미진입)
- Send Candidate TEST_ONLY count during this gate: **0**
- Send Canary count during this gate: **0**
- Cleanup Confirm count during this gate: **0**
- Operator Reset count during this gate: **0**
- Live Preflight extra calls: **0**
- Candidate Dry-run extra calls: **0**
- Telegram API calls during this gate: **0**
- KV writes during this gate: **0**
- Limited Live Mode: **DISABLED** (변경 0건)
- `telegramSent=false` / `kvWritten=false` / `candidateStored=false` / `trackingStarted=false`

### 18.7 누출 검증

- raw exchange full response **not recorded** (raw native field — `candle_date_time_kst` / `opening_price` / `candle_acc_trade_price` 등 — 보고서 / 채팅 / 로그 노출 0건)
- raw Telegram response **not recorded** (이번 Gate 에서 Telegram 호출 자체 0건)
- Invoke Token **not recorded**
- raw invite code / SHA-256 hash **not recorded** (placeholder repo 박제 유지, 노출된 폐기 hash repo-wide 매치 0건)
- KV namespace ID **not recorded**
- deployment ID full value **not recorded** (Version ID 단편 + Pages deployment hash 단편만)

### 18.8 판정 결론

```text
Multi-market dry-run 실검증 성공
후보 없음 = LOW_SIGNAL 정상 판정 (실패 아님)
Telegram 미발송 = 정상
KV write 0건 = 정상
candidate 저장 0건 = 정상
tracking 시작 0건 = 정상
점수 산식 (volume surge 가산 + upper wick risk 감점) 정상 작동 검증
multi-market 환경 false positive 방지 동작 검증
```

### 18.9 Gate 진행 흐름 박제 (Step A → J)

```text
Step A (자동):  preflight sanity (git/protected/wrangler env/tracked placeholder)
Step B (자동):  wrangler deploy --config wrangler-canary.toml → Worker v0.29 production version 활성 (Version 901d73dc)
                  · CANARY_ENABLED=false / AUTHORIZED_AT=0 / ALLOWED_ORIGINS=Pages-only 유지 / WS3_CANDIDATE_TEST_ENABLED 미설정
Step C (자동):  hash reuse 결정 — 이전 세션 SHA-256 재사용, 추가 사용자 입력 요청 0건, narrative 출력 0건
Step D (자동):  .tmp_pages_deploy/ws3-canary-console/index.html 생성 (tracked index.html cp)
Step E (자동):  assignment 라인 1건만 hash 교체 (line 409) — comment + placeholder check 라인 2건 보존
Step F (자동):  wrangler pages deploy ... --branch=main → production Pages URL 활성화 (Sections 8/9/10 UI 반영)
Step G (자동):  .tmp_pages_deploy/ 즉시 삭제 + tracked diff 0건 + placeholder 3+3 박제 + 보호 파일 0건 + repo-wide 노출 폐기 hash 매치 0건 검증
Step H (사용자): production console 접속 → invite code 입력 → console UI 표시 → Worker Endpoint / Invoke Token 입력 → Check State 1회 클릭 → 7-field whitelist PASS (v0.29 version 반영 확인)
Step I (사용자): Run Multi-market Dry-run 1회 클릭 (upbit / 10 markets / 5m / limit 60) → MULTI_CANDIDATE_DRY_RUN_OK 200 / marketCount=10 / candidateCount=0 / 모든 10 markets P-C / topMarket=KRW-NEAR score=24 / safety 4 fields 모두 false
Step J (자동):  candidateCount=0 분기 → Case 1 LOW_SIGNAL_NORMAL → Step K/L/M 생략 → closure 진행
```

### 18.10 v0.29 검증 한계 (재인용)

- 본 검증 = 1 isolate / 1 사용자 / 10 markets (Upbit KRW) / 5m timeframe / limit 60 / 단일 시점 시퀀스.
- 활발한 시장 (강한 surge / 후보 발생 시점) / 다른 timeframe / 다른 exchange / 다른 limit / rate limit 응답 / partial data — 본 검증 범위 밖.
- **Candidate TEST_ONLY Telegram 발송 경로 (Step L/M) 는 본 Gate 에서 실 검증 미수행**. forced-test candidate mode 또는 surge 시점 재검증은 v0.30+ 별도 단계.
- score 산식은 multi-market 환경에서 false positive 방지가 강하게 동작함이 검증됨 (KRW-AVAX 사례). 하지만 false negative 위험성 / 후보 자연 발생률은 더 긴 시간 / 더 많은 시장에서 별도 백테스트 필요.

### 18.11 v0.30+ 다음 단계 후보 (재인용 + 본 결과 반영)

```text
v0.30 후보 A: Candidate Scoring Calibration (산식 threshold 조정 또는 가중치 재배분)
v0.30 후보 B: Broader Multi-market Dry-run (predefined list 확장 + 더 많은 timeframe / 시장 / watchlist)
v0.30 후보 C: Candidate TEST_ONLY Telegram validation using forced/test candidate mode (Telegram 경로 검증)
v0.30 후보 D: Security hardening before live candidate alert (Cloudflare Access / invoke token rotation / origin allowlist)
worker /state response 자체에서 resetCount 제거 (v0.30+)
env-based MULTI_CANDIDATE_DISABLED / CANDIDATE_TEST_DISABLED 강제 kill switch
rate limit per origin / market / minute
candidate score 산식 백테스트 결과 기반 조정 (본 검증에서 false positive 방지 확인, false negative 분석 필요)
invoke token rotate automation / ipHash + WS3_CANARY_HASH_SALT
```
