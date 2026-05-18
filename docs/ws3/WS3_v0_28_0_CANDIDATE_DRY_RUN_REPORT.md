# WS3 v0.28.0 — Actual Coin Candidate Dry-run 완료 보고

**작성일**: 2026-05-18
**branch**: `claude/heuristic-cori-7865e7`
**이전 functional baseline**: WS3 v0.27.0 Actual Coin Live Preflight + Live Validation Success (`488cb08`)
**본 단계 산출**: 1 worker 보강 + 2 console 동기화 수정 + 1 신규 보고서 + 2 문서 갱신 (5 staged)

---

## 1. 목표 (실코인 자동 알람 아님)

v0.28 = 실 거래소 공개 시세 데이터 read-only fetch + **candle structure / volume / momentum features 계산 + dry-run score / grade 분류** preview 단계.

- 실 Telegram 알람 발송 0건
- 실 KV write 0건
- candidate 저장 0건
- snapshot / evaluation / audit 저장 0건
- tracking 시작 0건
- Send Canary / Cleanup Confirm / Operator Reset 호출 0건
- `CANARY_ENABLED=true` / `AUTHORIZED_AT` 변경 0건
- Cloudflare deploy 0건 (코드 단계만)
- 실 거래소 API 호출 0건 (mock fetch 만)
- 점수와 등급은 dry-run preview 일 뿐 실 알람·매수 조건이 아님

한 줄 정의: **v0.28 = 실코인 데이터 기반 후보 계산 dry-run, Telegram·KV·candidate 저장·tracking 0건.**

---

## 2. v0.27 dependency 완료 상태 (입력)

```text
Worker version: WS3_v0.27.0_actual_coin_live_preflight (production)
Pages: ws3-canary-console.pages.dev (production, lightweight invite gate 활성)
Worker allowlist: https://ws3-canary-console.pages.dev only
CANARY_ENABLED=false / AUTHORIZED_AT=0 유지
v0.27 mock smoke 16/16 + production /live-preflight 1회 실 호출 PASS
```

---

## 3. 신규 endpoint

### 3.1 `POST /candidate-dry-run`

read-only candle structure + dry-run score preview. KV / Telegram / candidate 와 무관.

### 3.2 OPTIONS allowlist 확장

`OPTIONS /candidate-dry-run` 추가 (기존 6 path → 7):
```
/health / /send-canary / /state / /cleanup-confirm / /operator-reset / /live-preflight / /candidate-dry-run
```

### 3.3 인증 정책 (3중, /live-preflight 동일 layer 재사용)

| # | 조건 | 위반 시 |
|---|---|---|
| 1 | Origin allowlist 통과 | `ORIGIN_MISSING` 403 / `ORIGIN_NOT_ALLOWED` 403 |
| 2 | `X-WS3-Canary-Token === env.WS3_CANARY_INVOKE_TOKEN` exact | `MISSING_INVOKE_TOKEN` 401 / `INVOKE_TOKEN_MISMATCH` 403 |
| 3 | `body.manualTrigger === true` | `MANUAL_TRIGGER_REQUIRED` 400 |

KV / circuit / persistent guard 미사용.

---

## 4. request body 스펙

```json
{
  "manualTrigger": true,
  "exchange": "upbit",
  "market": "KRW-BTC",
  "timeframe": "5m",
  "limit": 60
}
```

### 4.1 input 검증 (v0.27 와 동일 allowlist, limit 만 상향)

- `exchange`: allowlist `['upbit', 'bithumb', 'binance']`. lowercase 정규화.
- `market`: 정규식 `^[A-Za-z0-9_\-]{2,32}$` (v0.27 와 동일).
- `timeframe`: allowlist `['1m', '5m', '15m', '1h']`.
- `limit`: integer in `[1, 120]` (v0.27 보다 상향, feature 계산용 데이터 폭 확보).

### 4.2 exchange URL 매핑 (v0.27 helper 재사용)

`buildLivePreflightUrl(exchange, market, timeframe, limit)` 그대로 호출. v0.27 의 upbit/bithumb/binance URL 패턴 100% 재사용.

### 4.3 fetch / normalize (v0.27 helper 재사용)

- `fetchLiveCandles(deps, url, LIVE_PREFLIGHT_FETCH_TIMEOUT_MS)` 그대로 호출 (5초 timeout, AbortController).
- `normalizeCandles(exchange, raw, limit)` 그대로 호출 (latest → reverse 또는 끝부터 limit 추출, uniform OHLCV).
- 에러 코드 mapping: `LIVE_PREFLIGHT_*` → `CANDIDATE_DRY_RUN_*` (mapFetchCodeToCandidateDryRunCode).

---

## 5. feature 계산 범위

### 5.1 candle structure features

`calculateCandleStructureFeatures(candles)` (candles oldest→latest):

| field | 계산식 |
|---|---|
| `candleCount` | candles.length |
| `latestTime` | candles[n-1].time |
| `lastOpen / lastHigh / lastLow / lastClose` | candles[n-1] OHLC |
| `prevClose` | candles[n-2].close (n<2 일 때 fallback lastOpen) |
| `changePct` | (lastClose - prevClose) / prevClose * 100 |
| `bodyPct` | abs(close - open) / open * 100 |
| `rangePct` | (high - low) / open * 100 |
| `upperWickPct` | (high - max(open, close)) / open * 100 |
| `lowerWickPct` | (min(open, close) - low) / open * 100 |
| `closePosition` | (close - low) / (high - low). high===low 일 때 fallback 0.5 |

모든 divide 는 `safeDivide(num, den, fallback)` (typeof+isFinite+den!==0 보호) — NaN/Infinity 반환 0건. open=0 / high=low 분기 명시.

### 5.2 volume features

`calculateVolumeFeatures(candles)`:

| field | 계산식 |
|---|---|
| `lastVolume` | candles[n-1].volume |
| `avgVolume` | sum(volumes) / n |
| `volumeRatio` | lastVolume / avgVolume (safeDivide, fallback 0) |
| `volumeAccel` | n>=13 일 때 avg(last 3) / avg(prior 10), else 0 |

### 5.3 momentum features

`calculateMomentumFeatures(candles)`:

| field | 계산식 |
|---|---|
| `shortMomentumPct` | n>=5 일 때 lastClose / candles[n-5].close - 1 (decimal) |
| `midMomentumPct` | n>=11 일 때 lastClose / candles[n-11].close - 1 (decimal) |
| `highBreakProximity` | lastClose / recentHigh - 1 (decimal) |
| `lowBreakRisk` | lastClose / recentLow - 1 (decimal) |

recentHigh / recentLow = 전체 candles 의 max(high) / min(low).

---

## 6. dry-run score / grade

### 6.1 simple candidate score (0..100 clamp)

`calculateCandidateDryRunScore(inputs)`:

```text
volumeRatio >= 3.0 → +25 (chip: VOLUME_SURGE)
            >= 2.0 → +18 (chip: VOLUME_SURGE)
            >= 1.5 → +12
            >= 1.2 → +6
            > 0 and < 0.5 → chip: LOW_VOLUME

changePct  >= 3.0 → +20 (chip: POSITIVE_CHANGE)
           >= 1.5 → +14 (chip: POSITIVE_CHANGE)
           >= 0.5 → +8
           > 0    → +4

closePosition >= 0.8 → +15 (chip: HIGH_CLOSE_POSITION)
              >= 0.6 → +10
              >= 0.4 → +5

shortMomentumPct*100 >= 2.0 → +15 (chip: SHORT_MOMENTUM)
                     >= 1.0 → +10 (chip: SHORT_MOMENTUM)
                     >= 0.3 → +5

upperWickPct >= bodyPct*2 AND closePosition < 0.6 → -15 (chip: UPPER_WICK_RISK)
rangePct >= 8 → -10 (chip: WIDE_RANGE_RISK)

score = clamp(0, score, 100)
chips = chips.slice(0, 8)
```

### 6.2 grade 분류

`classifyCandidateDryRunGrade(score)`:

| grade | 조건 |
|---|---|
| `P-S` | score >= 75 |
| `P-A` | score >= 60 |
| `P-B` | score >= 45 |
| `P-C` | score < 45 |

`P-S` / `P-A` / `P-B` / `P-C` 는 WS3 dry-run 전용. 기존 WOOS S+/S/A 등급과 혼동 금지. Telegram 발송 조건 0건 / tracking 조건 0건 / candidate 저장 조건 0건.

### 6.3 isCandidate

`dryRun.isCandidate = (grade === 'P-S' || grade === 'P-A')` — UI 표시용 boolean. **실 알람·매수 조건 아님**.

### 6.4 reason chips

응답에 `reasonChips: [...]` 포함, max 8건. score 계산 중 발생한 (+) / (-) 가중치 사유의 라벨 누적.

---

## 7. response 정책

### 7.1 성공 (200 / `CANDIDATE_DRY_RUN_OK`)

```json
{
  "ok": true,
  "status": "OK",
  "code": "CANDIDATE_DRY_RUN_OK",
  "httpStatus": 200,
  "version": "WS3_v0.28.0_candidate_dry_run",
  "mode": "CANDIDATE_DRY_RUN_ONLY",
  "exchange": "upbit",
  "market": "KRW-BTC",
  "timeframe": "5m",
  "limit": 60,
  "features": {
    "candleCount": 60,
    "latestTime": "...Z",
    "lastClose": ...,
    "changePct": ...,
    "bodyPct": ...,
    "upperWickPct": ...,
    "lowerWickPct": ...,
    "closePosition": ...,
    "rangePct": ...,
    "lastVolume": ...,
    "avgVolume": ...,
    "volumeRatio": ...,
    "volumeAccel": ...,
    "shortMomentumPct": ...,
    "midMomentumPct": ...
  },
  "dryRun": {
    "score": 0..100,
    "grade": "P-S" | "P-A" | "P-B" | "P-C",
    "reasonChips": [...],
    "isCandidate": true | false
  },
  "safety": {
    "telegramSent": false,
    "kvWritten": false,
    "candidateStored": false,
    "trackingStarted": false
  }
}
```

### 7.2 반환 금지 (whitelist 외 0건)

```text
raw exchange full response (candle_date_time_kst / opening_price / candle_acc_trade_price 등)
secret / token / chatId / bot_token / Telegram message_id
KV namespace ID
full headers / stack trace / internal exception message
Origin 실제 값 / IP
매수 추천 문구 / 수익 보장 문구
```

mock smoke S17 / S18 으로 raw native field 노출 0건 + invoke token body 노출 0건 검증.

---

## 8. safe code (신규 11종)

| code | HTTP | 의미 |
|---|---|---|
| `CANDIDATE_DRY_RUN_OK` | 200 | dry-run 성공 |
| `CANDIDATE_DRY_RUN_INVALID_EXCHANGE` | 400 | allowlist 외 exchange |
| `CANDIDATE_DRY_RUN_INVALID_MARKET` | 400 | market 정규식 위반 |
| `CANDIDATE_DRY_RUN_INVALID_TIMEFRAME` | 400 | allowlist 외 timeframe |
| `CANDIDATE_DRY_RUN_LIMIT_EXCEEDED` | 400 | limit 비-integer / [1, 120] 범위 외 |
| `CANDIDATE_DRY_RUN_FETCH_TIMEOUT` | 504 | 5초 abort (v0.27 의 fetch helper 재사용, 코드 mapping) |
| `CANDIDATE_DRY_RUN_NETWORK_ERROR` | 502 | fetch reject / HTTP 비-2xx |
| `CANDIDATE_DRY_RUN_PARSE_ERROR` | 502 | json parse 실패 또는 필드 invalid |
| `CANDIDATE_DRY_RUN_EMPTY_CANDLES` | 502 | 빈 캔들 배열 |
| `CANDIDATE_DRY_RUN_UNSUPPORTED_SOURCE` | 400 | URL build 실패 |
| `CANDIDATE_DRY_RUN_FEATURE_ERROR` | 500 | feature 계산 결과 비-finite |

기존 v0.25 / v0.26.1 / v0.27 safe code 모두 유지.

---

## 9. no-write 구조 보장

`/candidate-dry-run` 핸들러 scope 내 grep 검증 (자동 검사):
- `writeAlreadySent` / `writeCleanupRequired` / `writeCircuit` / `writeInvokeFail` / `writeOperatorReset` / `markAlreadySentReset` / `env[` 매치 **0건**
- `sendCanary` / `dispatchCanary` / `sendMessage` 매치 **0건**
- KV binding (`env[KV_BINDING_NAME]`) 핸들러 내 미참조

---

## 10. mock smoke 결과 (21 시나리오 — spec 20 + 1 추가 parse error)

```
TOTAL=21 PASS=21 FAIL=0
```

| # | 시나리오 | 결과 |
|---|---|---|
| S1 | no token → 401 MISSING_INVOKE_TOKEN | ✅ |
| S2 | bad token → 403 INVOKE_TOKEN_MISMATCH | ✅ |
| S3 | no manualTrigger → 400 MANUAL_TRIGGER_REQUIRED | ✅ |
| S4 | invalid exchange → 400 CANDIDATE_DRY_RUN_INVALID_EXCHANGE | ✅ |
| S5 | invalid timeframe → 400 CANDIDATE_DRY_RUN_INVALID_TIMEFRAME | ✅ |
| S6 | limit > 120 → 400 CANDIDATE_DRY_RUN_LIMIT_EXCEEDED | ✅ |
| S7 | upbit mocked success → 200 CANDIDATE_DRY_RUN_OK / mode=CANDIDATE_DRY_RUN_ONLY / candleCount=60 / safety 4 fields 모두 false | ✅ |
| S8 | empty candles → 502 CANDIDATE_DRY_RUN_EMPTY_CANDLES | ✅ |
| S9 | network error → 502 CANDIDATE_DRY_RUN_NETWORK_ERROR | ✅ |
| S10 | fetch timeout (AbortError) → 504 CANDIDATE_DRY_RUN_FETCH_TIMEOUT | ✅ |
| S10b | parse error → 502 CANDIDATE_DRY_RUN_PARSE_ERROR (spec 외 추가) | ✅ |
| S11 | features 14 fields all finite | ✅ |
| S12 | score clamp [0, 100] | ✅ (`score=44`) |
| S13 | grade enum ∈ {P-S, P-A, P-B, P-C} | ✅ (`grade=P-C`) |
| S14 | reasonChips length ≤ 8 | ✅ (`count=2`) |
| S15 | Telegram fetch count = 0 across all scenarios | ✅ tg=0 |
| S16 | KV put/delete count = 0 | ✅ put=0 del=0 |
| S17 | raw exchange native field leak guard | ✅ CLEAN |
| S18 | invoke token leak in body | ✅ CLEAN |
| S19 | candidateStored = false | ✅ |
| S20 | trackingStarted = false | ✅ |

실 거래소 API 호출 **0건** (mock fetchImpl 만). 실 KV API 호출 **0건** (mock KV null).

---

## 11. Web Console 보강

### 11.1 신규 Section 7 "Candidate Dry-run (v0.28 read-only)"

input controls:
- Exchange select (upbit / bithumb / binance, default upbit)
- Market text input (autocomplete=off / maxlength=32, default `KRW-BTC`)
- Timeframe select (1m / 5m / 15m / 1h, default 5m)
- Limit text input (inputmode=numeric / pattern=[0-9]* / maxlength=3, default 60)
- Run Candidate Dry-run 버튼

output panel (whitelist 22 fields):
- code / mode / exchange / market / timeframe / candleCount / latestTime / lastClose / changePct / volumeRatio / volumeAccel / closePosition / upperWickPct / rangePct / score / grade / reasonChips / isCandidate / telegramSent / kvWritten / candidateStored / trackingStarted

표시 금지: raw exchange response / full headers / stack trace / token / secret / resetCount / KV namespace ID / Telegram message_id / bot token / chatId / 매수 추천 문구 / 수익 보장 문구.

### 11.2 클릭 정책

- 사용자 버튼 클릭시에만 1회 fetch
- auto refresh 0건
- 페이지 로드 시 자동 호출 0건
- 1.5초 throttle
- token `readTokenAndClear()` 즉시 클리어
- client-side market 정규식 `^[A-Za-z0-9_\-]{2,32}$` (server 와 일치)
- client-side limit `^[0-9]{1,3}$` → parseInt → [1, 120]

### 11.3 두 파일 byte-for-byte mirror

`web/ws3-canary-console.html` / `web/ws3-canary-console/index.html` 모두 791 → 990 라인 (+199), 33380 → 45836 bytes. `diff -q` 결과 0건 확인. embedded `<script>` 블록 2개 모두 Node parse OK (Block 0: 4428 chars / Block 1: 24464 chars).

---

## 12. 보호 파일 무손상

`git diff --stat HEAD -- worker.js wrangler.toml index.html manifest.json service-worker.js docs/ws3/WS3_CODE_CONTRACT.md docs/ws3/WS3_WORKFLOW_TEMPLATE.md v3/ workers/ws3-canary-state-kv-adapter.js wrangler-canary.example.toml .gitignore` → 빈 출력 = **0건** ✅

- 본선 `worker.js` / `wrangler.toml` (repo 미존재) / `index.html` / `manifest.json` / `service-worker.js` — 미수정
- `v3/` 25종 엔진 — 미수정
- `docs/ws3/WS3_CODE_CONTRACT.md` / `WS3_WORKFLOW_TEMPLATE.md` — 미수정
- `workers/ws3-canary-state-kv-adapter.js` — 미수정 (v0.25.0 그대로)
- `wrangler-canary.example.toml` / `.gitignore` — 미수정
- `workers/ws3-telegram-canary-entry.mjs` — 미스테이지 유지 (untracked)

---

## 13. 보안 / 누출 검증

- bot token / chatId / invoke token 실 값 — 노출 **0건**
- KV namespace ID — 노출 **0건**
- Telegram message_id / raw Telegram response — 노출 **0건**
- Origin 실 값 / IP / cookie / session id / browser fingerprint — 노출 **0건**
- exchange API raw native field (`candle_date_time_kst` / `opening_price` / `candle_acc_trade_price` 등) — response 본문 노출 **0건**
- 노출된 폐기 hash repo-wide 매치 **0건**
- masked / first-4 / last-4 / redacted preview — **0건**
- localStorage / sessionStorage / IndexedDB / document.cookie 호출 — **0건** (web grep 매치 2건 모두 정책 부정문맥)
- URL query parameter token 전달 — **0건**
- `console.log` 출력 — **0건**
- 매수 추천 / 수익 보장 문구 — **0건**

---

## 14. Cloudflare 변경 0건

- worker 재배포 0건 (v0.27 production Version 그대로, v0.28 staging 재배포는 별도 Gate)
- Pages 재배포 0건
- KV namespace 생성/변경 0건
- KV binding 변경 0건
- secrets (BOT_TOKEN / CHAT_ID / INVOKE_TOKEN) 변경 0건
- `WS3_CANARY_ALLOWED_ORIGINS` 변경 0건
- 실 Telegram API 호출 0건
- 실 KV write 0건
- 실 `/candidate-dry-run` 호출 0건
- 실 거래소 API 호출 0건

---

## 15. 의도된 미구현 (다음 Gate)

본 commit 까지 = v0.28 코드 / 문서 / mock 검증 만. 실제 deploy / 실 호출은 별도 승인 단계:

- v0.28 Deploy/Live Validation Gate (별도): Worker redeploy (v0.28 production version 반영) + Pages redeploy + production console 에서 Check State + Candidate Dry-run 1회 실 호출 검증
- v0.29 후보 A: Basic Multi-market Dry-run (predefined small list, Telegram·KV 0건)
- v0.29 후보 B: Candidate Dry-run result history in UI (browser memory-only, 저장 없음)
- v0.29 후보 C: Security hardening before live candidate alert (Cloudflare Access 재검토 / invoke token rotation / origin allowlist 재검토)
- worker `/state` response 자체에서 `resetCount` 제거 (v0.29+ 후보)
- env-based `CANDIDATE_DRY_RUN_DISABLED` flag (자동 kill switch)
- rate limit per origin / market / minute / invoke token rotate automation / ipHash + `WS3_CANARY_HASH_SALT`

---

## 16. v0.28 한계 (재확인)

- 본 단계 = mock smoke only. real 거래소 응답 다양성 (rate limit / partial data / market suspension / 비정상 candle / 분모 0) 은 별도 staging Gate 에서 검증. 단, safeDivide / closePosition fallback / finite 검사로 NaN/Infinity 0건 보장.
- score / grade 산식 = 초기 dry-run 공식. 실 환경 백테스트 결과로 v0.29+ 에서 조정 가능.
- `/candidate-dry-run` 인증 = Layer 1 (Origin) + Layer 2 (Invoke Token) + Layer 3 (manualTrigger). KV persistent guard 미사용. abuse 위험 최소화 위해 limit ≤ 120 / single market 제한.

---

## 17. 기준 commit

- branch: `claude/heuristic-cori-7865e7`
- 이전 functional baseline: WS3 v0.27.0 Actual Coin Live Preflight + Live Validation Success (`488cb08`)
- 본 commit: (push 후 기록, push 별도 승인)

---

## 18. 이번 단계의 핵심 (재인용)

```text
v0.28 = 실코인 자동 알람 아님
v0.28 = 실코인 데이터 기반 후보 계산 dry-run 단계
실 거래소 공개 시세 1회 fetch + structure/volume/momentum features + score/grade 분류
Telegram 발송 0건 / KV write 0건 / candidate 저장 0건 / tracking 시작 0건
점수와 등급은 dry-run preview 일뿐 실 알람·매수 조건이 아님 (P-S / P-A / P-B / P-C 는 WS3 dry-run 전용)
실 거래소 API 호출은 별도 staging Gate (본 commit 까지 mock 만)
실전 스캐너 알람은 v0.29 이후 별도 승인으로만 진행
```
