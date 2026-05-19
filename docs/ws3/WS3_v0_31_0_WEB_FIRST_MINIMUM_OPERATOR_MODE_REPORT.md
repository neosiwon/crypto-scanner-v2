# WS3 v0.31.0 — Web-first Minimum Operator Mode Pack 완료 보고

**작성일**: 2026-05-19
**branch**: `claude/heuristic-cori-7865e7`
**이전 functional baseline**: WS3 v0.30.0 Forced Candidate TEST_ONLY Telegram + Live Validation Success (`46b6d5d`)
**본 단계 산출**: 1 worker 보강 + 2 console 동기화 수정 + 1 신규 보고서 + 2 문서 갱신 (총 6 staged)

---

## 1. 목표 (검증 우선 → 웹 운영 우선 전환)

v0.31 = 검증용 콘솔에서 **운영자 수동 운영 최소 웹 콘솔**로 전환. 30~50개 코인 웹 스캔 + 운영자 후보 카드 검토 + 선택 후보 1건 LIMITED LIVE / OPERATOR REVIEW 라벨로 수동 전송.

여전히 실전 자동 알람 아님:
- 무제한 자동 스캔 0건 / Cron 0건 / 자동 Telegram 0건
- candidate KV 저장 0건 / tracking 자동 시작 0건 / snapshot/evaluation/audit 0건
- Limited Live Mode 활성화 0건 (env 'false' default)

한 줄 정의: **v0.31 = web-first minimum operator mode. 40-market preset + operator review flag + per-(market,timeframe) KV guard + LIMITED LIVE manual send endpoint.**

---

## 2. 방향 전환 원칙 (재인용)

기존: 기능 하나 → mock → deploy → live validation → closure → 다음.

v0.31부터: **운영 가능한 최소 웹 기능을 한 번에 구현 → 필수 안전 테스트만 통과 → 배포 → 실제 사용하면서 자연검증 → 문제 발생 부분만 안정화**.

---

## 3. 신규 / 확장 (worker)

### 3.1 신규 상수 (6종)

```js
var LIMITED_LIVE_MODE = 'LIMITED_LIVE_OPERATOR_REVIEW';
var LIMITED_LIVE_MESSAGE_TYPE = 'LIMITED_LIVE_OPERATOR_REVIEW';
var LIMITED_LIVE_CONFIRM_PHRASE = 'SEND_WS3_LIMITED_LIVE_REVIEW';
var LIMITED_LIVE_GUARD_KEY_PREFIX = 'ws3:canary:limitedLiveAlertSent:';
var LIMITED_LIVE_GUARD_REASON = 'LIMITED_LIVE_REVIEW_SENT';
var LIMITED_LIVE_GUARD_WINDOW_MS = 60 * 1000;
```

별도 enable env: `WS3_LIMITED_LIVE_ENABLED` (선언만, default 'false'). normal candidate test / forced candidate test env (`WS3_CANDIDATE_TEST_ENABLED`) 와 분리.

### 3.2 신규 helper

#### 3.2.1 `classifyOperatorReview(score, grade, reasonChips, features)`

기존 `isCandidate` 와 별개로 운영자 검토 flag 반환:
- `operatorReview: bool` — 운영자 검토 가치 있음
- `operatorReviewLevel: 'HOT_REVIEW' | 'WATCH_REVIEW' | 'LOW_SIGNAL'`
- `operatorReviewReason: [...]` (최대 4종 코드)

판정 기준:
- score >= 20 / grade P-S/P-A/P-B / chip VOLUME_SURGE / HIGH_CLOSE_POSITION+changePct>0 / volumeRatio≥1.2 AND closePosition≥0.6 / chip SHORT_MOMENTUM / chip POSITIVE_CHANGE 중 하나 이상 → operatorReview=true
- 레벨: score>=45 OR grade>=P-B → HOT_REVIEW / 위 reason 있음 → WATCH_REVIEW / 그 외 → LOW_SIGNAL

`isCandidate` 는 score 산식 기반 grade P-S/P-A 만으로 결정 (v0.28 그대로). `operatorReview` 는 더 완화된 기준 — 카드형 UI 에서 검토할 만한 모든 시장 포함.

#### 3.2.2 `operatorReviewLevelPriority(level)` / `countOperatorReviewByLevel(results)`

정렬 priority + 응답 audit count.

#### 3.2.3 `buildLimitedLiveGuardKey(market, timeframe)`

```text
ws3:canary:limitedLiveAlertSent:<market>:<timeframe>
```

per-(market,timeframe) 분리 → KRW-BTC 5m 발송 후에도 KRW-ETH 5m / KRW-BTC 15m 등은 차단되지 않음 (사용자 spec §13).

#### 3.2.4 `validateLimitedLiveAlertRequest(body)`

검증:
- `body.manualTrigger === true`
- `body.confirmPhrase === 'SEND_WS3_LIMITED_LIVE_REVIEW'`
- `selectedCandidate` 정합 (source / exchange / market 정규식 / timeframe / score 범위 / grade enum)
- 자격: `isCandidate === true` OR (`operatorReview === true` AND `body.allowOperatorReviewSend === true`)
- chips ASCII upper+underscore sanitize (max 8)

#### 3.2.5 `buildLimitedLiveAlertMessageText(c)`

LIMITED LIVE / OPERATOR REVIEW preamble (fixed):
```text
[WOOS WS3 LIMITED LIVE / OPERATOR REVIEW]
자동 매수/매도 추천 아님
운영자 검토 필요
Manual operator review only.
This is not a live trading alert.

Market / Exchange / Timeframe / Score / Grade
Operator review level
isCandidate
Reason chips
candidateStored: false
trackingStarted: false
```
- 매수 추천 / 진입 추천 / 수익 보장 / 확정 신호 / LIVE BUY 문구 0건
- raw exchange data / 가격 / 거래량 숫자 미포함 (score/grade/chips/operatorReviewLevel 만)

#### 3.2.6 `sendLimitedLiveAlertTelegram(deps, env, text)`

인라인 Telegram fetch (5s AbortController timeout), v0.29 `sendCandidateTestTelegram` 패턴 재사용. `resp.text()` 결과는 받기만 하고 폐기 — body 에 message_id / result / from / chat 미포함.

#### 3.2.7 `buildLimitedLiveAlertResponse(kvWritten)`

```json
{
  "ok": true,
  "code": "LIMITED_LIVE_REVIEW_SENT",
  "mode": "LIMITED_LIVE_OPERATOR_REVIEW",
  "messageType": "LIMITED_LIVE_OPERATOR_REVIEW",
  "fixedMessageUsed": true,
  "safety": {
    "telegramSent": true,
    "kvWritten": ...,
    "kvWriteScope": "LIMITED_LIVE_GUARD_ONLY",
    "candidateStored": false,
    "trackingStarted": false
  }
}
```

### 3.3 신규 endpoint `POST /send-limited-live-alert`

OPTIONS allowlist 9 → 10 paths.

인증 (4중 + 2):
| # | 조건 | 위반 시 |
|---|---|---|
| 1 | Origin allowlist | `ORIGIN_*` 403 |
| 2 | `X-WS3-Canary-Token` exact | `MISSING_INVOKE_TOKEN` 401 / `INVOKE_TOKEN_MISMATCH` 403 |
| 3 | `manualTrigger === true` | `MANUAL_TRIGGER_REQUIRED` 400 |
| 4 | `WS3_LIMITED_LIVE_ENABLED === 'true'` | `LIMITED_LIVE_DISABLED` 503 |
| 5 | `confirmPhrase === 'SEND_WS3_LIMITED_LIVE_REVIEW'` byte-for-byte | `LIMITED_LIVE_CONFIRM_PHRASE_REQUIRED` 403 |
| 6 | selectedCandidate 정합 + 자격 | `LIMITED_LIVE_INVALID_PAYLOAD` 400 |
| 7 | KV `limitedLiveAlertSent:<market>:<timeframe>` 60s 윈도우 | `LIMITED_LIVE_ALREADY_SENT` 429 |

### 3.4 multi-candidate pipeline 확장

각 ok result row 에 추가 필드:
- `operatorReview: bool`
- `operatorReviewLevel: 'HOT_REVIEW' | 'WATCH_REVIEW' | 'LOW_SIGNAL'`
- `operatorReviewReason: [...]`

정렬: `operatorReviewLevel priority → score desc → volumeRatio desc → closePosition desc`. 응답 본문에 `operatorReviewCounts: {HOT_REVIEW, WATCH_REVIEW, LOW_SIGNAL}` 신규 필드 추가.

### 3.5 신규 safe code (6종)

| code | HTTP |
|---|---|
| `LIMITED_LIVE_REVIEW_SENT` | 200 |
| `LIMITED_LIVE_DISABLED` | 503 |
| `LIMITED_LIVE_CONFIRM_PHRASE_REQUIRED` | 403 |
| `LIMITED_LIVE_INVALID_PAYLOAD` | 400 |
| `LIMITED_LIVE_ALREADY_SENT` | 429 |
| `LIMITED_LIVE_TELEGRAM_ERROR` | 502 |

기존 v0.25-v0.30 safe code 모두 유지.

---

## 4. Web Console UI 보강

### 4.1 Section 8 (Multi-market) — 확장

- **Load 40-market Upbit preset** 버튼 추가 (KRW-BTC, KRW-ETH, ..., KRW-PYTH 40종을 textarea 에 채우고 limit=60 설정)
- 결과 카드 rendering 에 `operatorReviewLevel` 배지 추가 (HOT_REVIEW=빨강, WATCH_REVIEW=주황, LOW_SIGNAL=회색)
- `[OP-REVIEW]` 라벨 추가 (isCandidate=false 이지만 operatorReview=true 인 카드)

### 4.2 Section 11 신규 — Minimum Operator Mode

- Limited Live Mode 상태 표시 (`DISABLED until env enable`)
- Selected Operator Review Card select (Section 8 결과에서 HOT_REVIEW / WATCH_REVIEW / isCandidate=true 만 표시)
- `Allow Operator Review send` 체크박스 (isCandidate=false 카드를 LIMITED LIVE / OPERATOR REVIEW 라벨로 전송 허용)
- Confirm Phrase 입력칸
- Send LIMITED LIVE / OPERATOR REVIEW 버튼 (Danger Zone 시각 분리)
- 결과 panel whitelist 9 fields (code / mode / messageType / fixedMessageUsed / telegramSent / kvWritten / kvWriteScope / candidateStored / trackingStarted)
- Send 후 confirm phrase + selection + allowOR 즉시 클리어

### 4.3 Section 8 → Section 11 selector 동기화

Section 8 결과가 갱신되면 Section 11 selector 도 자동 갱신 (eligible 결과만 표시 — HOT_REVIEW / WATCH_REVIEW / isCandidate). 기존 `mcUpdateCandidateSelector` 를 wrap 하는 방식으로 구현 (mc Section 9 Forced selector 와 동시 갱신).

### 4.4 두 파일 byte-for-byte mirror

1494 → 1724 라인 (+230), 68102 → 84866 bytes. `diff -q` 0건. embedded `<script>` 2 blocks (4428 + 52016 chars) Node parse 통과.

---

## 5. mock smoke 결과 (17 시나리오 — spec 10 essential + 7 추가 audit)

```
TOTAL=17 PASS=17 FAIL=0
```

| # | 시나리오 | 결과 |
|---|---|---|
| S1 | `/send-limited-live-alert` disabled (env default false) → 503 LIMITED_LIVE_DISABLED | ✅ |
| S2 | wrong confirmPhrase → 403 LIMITED_LIVE_CONFIRM_PHRASE_REQUIRED | ✅ |
| S3 | 자격 없음 (isCandidate=false AND operatorReview=false AND no allowOR) → 400 LIMITED_LIVE_INVALID_PAYLOAD | ✅ |
| S3b | operatorReview=true but no allowOR flag → 400 | ✅ |
| S4 | mock success natural candidate (P-A, isCandidate=true) → 200 LIMITED_LIVE_REVIEW_SENT / mode=LIMITED_LIVE_OPERATOR_REVIEW / fixedMessageUsed=true / safety telegramSent=true / kvWritten=true / kvWriteScope=LIMITED_LIVE_GUARD_ONLY / candidateStored=false / trackingStarted=false | ✅ |
| S4b | mock success OR card with allowOR=true (P-C, operatorReview=true) → 200 LIMITED_LIVE_REVIEW_SENT | ✅ |
| S5 | duplicate second send same market+timeframe → 429 LIMITED_LIVE_ALREADY_SENT | ✅ |
| S5b | different market+timeframe (KRW-ETH 5m) NOT blocked by KRW-BTC 5m guard → 200 | ✅ |
| S6 | Telegram body required labels present (LIMITED LIVE / OPERATOR REVIEW / 자동 매수·매도 추천 아님 / 운영자 검토 필요 / Manual operator review only / candidateStored:false / trackingStarted:false) | ✅ |
| S7 | Telegram body forbidden phrases absent (매수하세요 / 진입 추천 / 수익 보장 / 확정 신호 / LIVE BUY) | ✅ |
| S8 | response candidateStored=false | ✅ |
| S9 | response trackingStarted=false | ✅ |
| S10 | multi-candidate-dry-run regression — operatorReview / operatorReviewLevel 필드 추가 / operatorReviewCounts 응답 / safety telegramSent=false / kvWritten=false | ✅ |
| S10b | multi 호출 후 Telegram count=0 / KV put count=0 | ✅ |
| S11 | raw Telegram response leak (message_id / result / from / chat) | ✅ CLEAN |
| S12 | secret leak (bot_token / chat_id / invoke token in response body) | ✅ CLEAN |
| S13 | KV guard key per-market+timeframe (`ws3:canary:limitedLiveAlertSent:KRW-BTC:5m`) | ✅ |

실 거래소 API 호출 0건. 실 Telegram API 호출 0건. 실 KV API 호출 0건.

---

## 6. no-write 스코프 분리

### 6.1 `/multi-candidate-dry-run` scope

- `putJson` / `.put(` / `sendCanary` / `dispatchCanary` / `sendMessage` 매치 **0건**

### 6.2 `/send-limited-live-alert` scope

- `writeAlreadySent` / `writeCleanupRequired` / `writeCircuit` / `writeInvokeFail` / `writeOperatorReset` / `markAlreadySentReset` 매치 **0건**
- KV write 1건 = `putJson(llKv, llGuardKey, {...})` (per-market+timeframe guard만, `LIMITED_LIVE_GUARD_ONLY` scope)
- Telegram fetch = `sendLimitedLiveAlertTelegram` (인라인, raw response 폐기)
- candidate 저장 / tracking 시작 코드 0건

### 6.3 v0.29/v0.30 endpoint 회귀

- `/send-candidate-test` 동일 (normal/forced 모두 v0.30 그대로, namespace separation 유지)
- 기존 모든 endpoint (`/state` / `/send-canary` / `/cleanup-confirm` / `/operator-reset` / `/live-preflight` / `/candidate-dry-run`) 동작 그대로

---

## 7. 보호 파일 무손상

`git diff --stat HEAD -- worker.js wrangler.toml index.html manifest.json service-worker.js docs/ws3/WS3_CODE_CONTRACT.md docs/ws3/WS3_WORKFLOW_TEMPLATE.md v3/ workers/ws3-canary-state-kv-adapter.js wrangler-canary.example.toml .gitignore` → 빈 출력 = **0건** ✅

- 본선 / `v3/` 25종 / KV adapter / wrangler-canary.example / .gitignore — 미수정
- `workers/ws3-telegram-canary-entry.mjs` — 미스테이지 유지

---

## 8. 보안 / 누출 검증

- bot token / chatId / invoke token 실 값 — 노출 **0건**
- KV namespace ID — 노출 **0건**
- Telegram message_id / raw Telegram response — 노출 **0건** (smoke S11)
- exchange API raw native field — response 본문 노출 **0건**
- 노출된 폐기 hash repo-wide 매치 **0건**
- masked / first-4 / last-4 / redacted preview — **0건**
- localStorage / sessionStorage / IndexedDB / document.cookie 호출 — **0건** (web grep 매치 2건 모두 정책 부정문맥)
- URL query parameter token 전달 — **0건**
- `console.log` 출력 — **0건**
- 매수 추천 / 진입 추천 / 수익 보장 / 확정 신호 / LIVE BUY — **0건** (smoke S7)
- LIMITED LIVE preamble 에 필수 안전 라벨 6+ 종 명시 (smoke S6)

---

## 9. Cloudflare 변경 0건

- worker 재배포 0건 (v0.30 production Version 그대로)
- Pages 재배포 0건
- KV namespace 생성/변경 0건
- KV binding 변경 0건
- secrets (BOT_TOKEN / CHAT_ID / INVOKE_TOKEN) 변경 0건
- `WS3_CANARY_ALLOWED_ORIGINS` 변경 0건
- `WS3_CANDIDATE_TEST_ENABLED='false'` 유지 (v0.30 Step M 복귀 상태 유지)
- `WS3_LIMITED_LIVE_ENABLED` 변경 0건 (env 미선언 default 'false', deploy Gate 에서만 임시 'true' 활성화 예정)
- 실 Telegram API 호출 0건
- 실 KV write 0건
- 실 `/send-limited-live-alert` 호출 0건
- 실 거래소 API 호출 0건

---

## 10. 의도된 미구현 (다음 Gate)

본 commit 까지 = v0.31 코드 / 문서 / mock 검증 만. 실 deploy / 실 호출 / 자연검증은 별도:

- v0.31 Deploy/Minimum Live Validation Gate (별도, 필수 테스트만):
  1. Worker redeploy
  2. Pages redeploy
  3. Check State
  4. 40-market preset scan 1회 (Section 8 Load preset → Run Multi-market Dry-run)
  5. operator review card 카드 확인
  6. `WS3_LIMITED_LIVE_ENABLED=false` 상태에서 send 차단 확인 (`LIMITED_LIVE_DISABLED` 503)
  7. `WS3_LIMITED_LIVE_ENABLED='true'` 임시 활성화 + Worker redeploy
  8. Section 11 카드 선택 + confirm phrase 입력 + Send 1회 → Telegram 수신 확인
  9. 60s 이내 duplicate 차단 확인
  10. `WS3_LIMITED_LIVE_ENABLED` 운영 유지 여부 사용자 결정 (`true` 유지 또는 `false` 복귀)
- v0.32 후보:
  - score 산식 / operatorReview 임계값 자연검증 후 조정
  - browser memory-only history 확장
  - Cloudflare Access 재검토 (실 운영 단계 진입 전)
  - rate limit per origin / market / minute
  - invoke token rotate automation / ipHash + `WS3_CANARY_HASH_SALT`
- 자동 운영 (Cron / auto Telegram / candidate 저장 / tracking 시작) 은 v0.32+ 별도 단계, 사용자 명시 승인 필수

---

## 11. v0.31 한계 (재확인)

- mock smoke only. real 거래소 응답 다양성 (rate limit / partial data / market suspension / 40 market 병렬 fetch 부하) 은 별도 staging Gate.
- operatorReview 산식은 score 산식 위에 단순 우회 규칙 (chip / threshold / OR). 자연검증 후 v0.32+ 조정 가능.
- KV guard window=60s 는 per-(market,timeframe). 동일 시장 즉시 재전송은 차단. 다른 시장은 즉시 가능 — 운영자가 다중 시장을 빠르게 전송할 수 있음. 운영 첫 1주일은 실수 / 과도 발송 모니터링 필요.
- `WS3_LIMITED_LIVE_ENABLED` 운영 유지 시 (env 'true') Limited Live Send 항상 가능. confirm phrase + per-key guard + UI 클릭 3중 보호로 우연 발송 방지.

---

## 12. 기준 commit

- branch: `claude/heuristic-cori-7865e7`
- 이전 functional baseline: WS3 v0.30.0 Forced Candidate TEST_ONLY Telegram + Live Validation Success (`46b6d5d`)
- 본 commit: (push 후 기록, push 별도 승인)

---

## 13. 이번 단계의 핵심 (재인용)

```text
v0.31 = 검증용 콘솔 → 운영 최소 웹 콘솔 전환
40-market preset / operator review flag / candidate cards / limited live send
WS3_LIMITED_LIVE_ENABLED 별도 env (default false)
per-(market,timeframe) 60s KV guard
candidate 저장 0건 / tracking 시작 0건
Cron 없음 / 자동 알람 없음 / 자동 후보 발송 없음
Limited Live Send 는 운영자 클릭 + confirm phrase 만 가능
배포 후 자연검증 단계 (필수 안전 테스트 외 사전 검증 최소화)
실전 스캐너 자동 운영은 v0.32 이후 사용자 명시 승인으로만 진행
```

---

## 14. Final Minimum Live Validation Result

- Worker deploy: completed
- Pages deploy: completed
- v0.31.0-fix-1 maxMarkets50 redeploy: completed
- Production console Check State: succeeded
- 40-market preset scan: succeeded
- Multi-market result code: MULTI_CANDIDATE_PARTIAL_OK
- Market count: 40
- OK count: 19
- Fail count: 21
- Candidate count: 0
- Disabled send test: succeeded
- Disabled send code: LIMITED_LIVE_DISABLED
- Limited Live enable: completed
- WS3_LIMITED_LIVE_ENABLED: true
- LIMITED LIVE / OPERATOR REVIEW send: succeeded
- Selected market: KRW-DOT
- Exchange: upbit
- Timeframe: 5m
- Score: 29
- Grade: P-C
- Operator review level: WATCH_REVIEW
- isCandidate: false
- Reason chips: VOLUME_SURGE
- Result code: LIMITED_LIVE_REVIEW_SENT
- Message type: LIMITED_LIVE_OPERATOR_REVIEW
- Telegram sent: true
- KV written: true
- KV write scope: LIMITED_LIVE_GUARD_ONLY
- Candidate stored: false
- Tracking started: false
- Duplicate second send: blocked
- Additional Telegram after duplicate click: 0
- Final operation decision: 운영 유지
- Final WS3_LIMITED_LIVE_ENABLED: true
- Cron: disabled
- Automatic alerts: disabled
- Candidate storage: disabled
- Tracking start: disabled
- raw Telegram response not recorded
- raw exchange full response not recorded
- Invoke Token not recorded
- raw invite code / hash not recorded
