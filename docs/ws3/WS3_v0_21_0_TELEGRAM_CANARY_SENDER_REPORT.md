# WS3 v0.21.0 — Telegram Canary Sender 완료 보고

**작성일**: 2026-05-17
**branch**: `claude/heuristic-cori-7865e7`
**이전 functional baseline**: WS3 v0.20.0 secureRuntimeStateAdapter (직전 단계, 동일 Gate 2)
**본 단계 산출**: `v3/v3-telegram-canary-sender.js` (1종 신규, 608 라인)

---

## 1. 단계 개요

- **TelegramCanarySender 신규** (`WS3_TelegramCanarySender`) — Telegram 1 target 한정 **첫 LIVE side-effect 모듈** (정책적으로 제한된 dispatchCanary 단일 경로)
- **계층 분리** (Gate 1 UNCLEAR 1 확정):
  - `buildTelegramCanaryPlan / validate* / build*Result / build*Error / buildSafeDiagnostics`: **sync only** — fetch 0건, async/await/Promise/timer 0건
  - `dispatchCanary`: **async 허용 (단 한 곳)** — fetch via `deps.fetchImpl`, AbortController via `deps.AbortControllerImpl`, setTimeout/clearTimeout via `deps.setTimeoutImpl/deps.clearTimeoutImpl`, nowMs via `deps.nowMs / deps.nowFn`
- **buildVERSION**: `CANARY_VERSION = 'WS3_v0.21.0_telegram_canary_sender'`
- **export 패턴**: `global.WS3_TelegramCanarySender` + `module.exports`
- **WS3 파이프라인 22단계 완성** (v0.20 다음) — secureRuntimeStateAdapter → **telegramCanarySender**

---

## 2. CANARY_FIXED_MESSAGE (byte-for-byte exact)

```text
[WOOS WS3 CANARY]
Telegram route connected.
mode: CANARY_ONLY
live signal: disabled
snapshot/evaluation/audit: disabled
```

- length: 113 bytes (5 lines, last line no trailing \n)
- 변형 금지: timestamp / version / env name / error reason / coin symbol / candidate payload / price / percent / score 추가 0건
- `validateFixedMessage(msg)`: length + 전체 byte-for-byte equality 검증
- 위반 시: `CANARY_BLOCKED:NOT_FIXED_MESSAGE`

---

## 3. 20 hard precondition (DP-CANARY1)

| # | 조건 |
|---|---|
| 1 | secureRuntimeStateAdapterResult.valid === true |
| 2 | runtimeMode === 'CANARY_PREP_ONLY' |
| 3 | canaryOnly === true |
| 4 | liveSignalEnabled === false |
| 5 | telegramRuntimeEligibility.eligibleForCanary === true |
| 6 | telegramRuntimeEligibility.eligibleForLiveSignal === false |
| 7 | killSwitchRuntimeState.state === 'CANARY_ALLOWED' |
| 8 | disableRuntimeState.disabled === false |
| 9 | canaryRuntimePolicy.canaryOnly === true |
| 10 | canaryRuntimePolicy.fixedMessageOnly === true |
| 11 | canaryRuntimePolicy.candidatePayloadAllowed === false |
| 12 | canaryRuntimePolicy.snapshotAllowed === false |
| 13 | canaryRuntimePolicy.evaluationAllowed === false |
| 14 | canaryRuntimePolicy.auditAllowed === false |
| 15 | canaryRuntimePolicy.kvWriteAllowed === false |
| 16 | canaryRuntimePolicy.dbWriteAllowed === false |
| 17 | runtimeEnv.WS3_TELEGRAM_CANARY_ENABLED === 'true' |
| 18 | runtimeEnv.WS3_TELEGRAM_BOT_TOKEN 존재 (string, length>0) |
| 19 | runtimeEnv.WS3_TELEGRAM_CHAT_ID 존재 (string, length>0) |
| 20 | input.messageType === 'CANARY_TEST_ONLY' |

→ AND. 하나라도 false 면 `CANARY_BLOCKED:<reason>` 반환 (safe error).

---

## 4. 4 explicit gate (DP-CANARY2)

| Gate | 조건 | 위반 reason |
|---|---|---|
| 1 | `runtimeEnv.WS3_TELEGRAM_CANARY_ENABLED === 'true'` | `GATE1_CANARY_NOT_ENABLED` |
| 2 | `runtimeEnv.WS3_TELEGRAM_CANARY_AUTHORIZED_AT` 존재 + nowMs 기준 24h expire 미초과 | `GATE2_AUTHORIZED_AT_MISSING / GATE2_AUTHORIZED_AT_INVALID / GATE2_AUTHORIZED_AT_EXPIRED` (`MISSING_TIME_SOURCE` 시 별도 차단) |
| 3 | `headers['X-WS3-Canary-Token'] === runtimeEnv.WS3_CANARY_INVOKE_TOKEN` exact match | `GATE3_INVOKE_TOKEN_MISSING / GATE3_INVOKE_TOKEN_ENV_MISSING / GATE3_INVOKE_TOKEN_MISMATCH` |
| 4 | `input.manualTrigger === true` | `GATE4_MANUAL_TRIGGER_MISSING` |

→ env flag 단독 trigger 금지 (Gate 1 만으로 fetch 시작 불가). cron / 코드배포 자동 발송 0건.

---

## 5. fetch safety (DP-CANARY3~5)

| 항목 | 값 | 정책 |
|---|---|---|
| hard timeout | **5000ms** | `deps.setTimeoutImpl(5000)` + `deps.AbortControllerImpl.abort()` |
| retry | **0** | 자동 재시도 0건 |
| rate limit | **60000ms (1회 / 60초, per-process state)** | `state.lastSentAt + 60s` 미만 시 `CANARY_RATE_LIMITED` |
| circuit breaker | **3 연속 실패 → 24h 차단** | `state.consecutiveFailures >= 3` → `state.circuitOpenUntil = nowMs + 24h` → `CANARY_CIRCUIT_OPEN` |
| auth expire (Gate 2) | **24h** | `nowMs - authorizedAt > 24h` → `GATE2_AUTHORIZED_AT_EXPIRED` |
| override | **0건** (env / config override 차단) | hardcoded constants |

시간 source: `deps.nowMs` (number) 또는 `deps.nowFn()` (returns number). 미주입 시 `CANARY_BLOCKED:MISSING_TIME_SOURCE`.

per-process state: `deps.state` injection (caller 가 worker-scoped state 객체 보유). 테스트 시 매번 `state = {}` 로 reset.

---

## 6. dispatchCanary 입력 / 결과

### 입력
```js
dispatchCanary({
  secureRuntimeStateAdapterResult,  // v0.20 결과 (read-only)
  runtimeEnv,                       // 허용 키 5종만
  headers,                          // 허용 키 1종 (X-WS3-Canary-Token) 만
  manualTrigger,                    // === true
  messageType                       // === 'CANARY_TEST_ONLY'
}, deps)

// deps = { fetchImpl, AbortControllerImpl, setTimeoutImpl, clearTimeoutImpl, nowMs, nowFn?, state }
```

### safe result (success — 6 fields whitelist)
```js
{ ok: true, httpStatus: 200, messageId: 42, sentAt: 1700000000000,
  messageType: 'CANARY_TEST_ONLY', fixedMessageUsed: true }
```

### safe error (4 fields whitelist + 7 enum)
```js
{ ok: false, httpStatus: 0|401|403|404|5xx, errorCode: '<enum>', errorAt: 1700000000000 }
```

errorCode enum (7):
- `CANARY_BLOCKED:<reason>` — 사전 차단 (precondition / gate / fixed message / state)
- `CANARY_TIMEOUT` — 5s 초과
- `CANARY_RATE_LIMITED` — 60s 내 재호출
- `CANARY_CIRCUIT_OPEN` — 3실패 후 24h 차단
- `CANARY_AUTH_ERROR` — 401/403
- `CANARY_NOT_FOUND` — 404
- `CANARY_NETWORK_ERROR` — 기타 fetch/parse 실패

---

## 7. safe response shape (DP-CANARY7/8/9/10)

### 7.1 safe result whitelist (6 fields)
`ok / httpStatus / messageId / sentAt / messageType / fixedMessageUsed` — 그 외 0건.

### 7.2 safe error whitelist (4 fields)
`ok / httpStatus / errorCode / errorAt` — 그 외 0건.

### 7.3 safe diagnostics (6 fields)
`tokenValueExposed: false / chatIdValueExposed: false / rawTelegramResponseExposed: false / tokenPresent: boolean / chatIdPresent: boolean / canaryEnabled: boolean`
→ 3 boolean 강제 false. 나머지 3 은 presence/enabled 표시만 (값 노출 0건).

### 7.4 Telegram response 차단 fields (DP-CANARY10)
```text
description / from.username / from.first_name / chat.id / chat.type / chat.title / chat.username /
bot_token / full response body / response headers / Set-Cookie / X-* headers / Server / Date
```
→ `extractSafeBody(parsedBody)` 가 **whitelist 5 fields (target/action/...)** 가 아니라 **`{ result: { message_id: number|null } }`** 만 추출. raw 전체 차단 ✅. Object.assign / spread / JSON deep clone / for-in 0건.

---

## 8. runtime env / headers 허용 키

### 8.1 runtimeEnv 허용 키 5종
- `WS3_TELEGRAM_BOT_TOKEN` (Telegram URL 의 `<TOKEN>` 위치, 값 노출 0건)
- `WS3_TELEGRAM_CHAT_ID` (Telegram payload `chat_id`, 값 노출 0건)
- `WS3_TELEGRAM_CANARY_ENABLED` (Gate 1)
- `WS3_TELEGRAM_CANARY_AUTHORIZED_AT` (Gate 2, timestamp ms)
- `WS3_CANARY_INVOKE_TOKEN` (Gate 3, exact match)

### 8.2 headers 허용 키 1종
- `X-WS3-Canary-Token` (Gate 3, exact match with WS3_CANARY_INVOKE_TOKEN)

### 8.3 정책
- runtimeEnv 전체 output 0건 (safeDiagnostics 만)
- headers 전체 output 0건
- token / chatId 실제 값 출력 0건 (smoke test 35 검증)
- masked / first-4 / last-4 / redacted / preview 0건 (smoke test 36 검증)

---

## 9. DP-CANARY1~12 처리

- **DP-CANARY1** ✅ — 20 hard precondition AND. v0.20 결과 mutate / spread / clone / Object.assign 0건
- **DP-CANARY2** ✅ — 4 explicit gate (env enabled + 24h authorized + invoke token + manualTrigger). env flag 단독 trigger 0건
- **DP-CANARY3** ✅ — 5s hard timeout + AbortController. retry=0. CANARY_TIMEOUT
- **DP-CANARY4** ✅ — per-process 60s rate limit. CANARY_RATE_LIMITED
- **DP-CANARY5** ✅ — 3 fail → 24h circuit. CANARY_CIRCUIT_OPEN
- **DP-CANARY6** ✅ — CANARY_FIXED_MESSAGE 5줄 byte-for-byte exact. 변형 차단
- **DP-CANARY7** ✅ — safe result 6 fields whitelist
- **DP-CANARY8** ✅ — safe error 4 fields + 7 errorCode enum
- **DP-CANARY9** ✅ — safe diagnostics 6 fields + 3 boolean false 강제
- **DP-CANARY10** ✅ — raw Telegram response / description / from.* / chat.* / bot_token / headers / Set-Cookie / X-* / Server / Date 차단 (extractSafeBody whitelist)
- **DP-CANARY11** ✅ — token / chatId 코드 / 문서 / 로그 출력 0건. masked preview 0건
- **DP-CANARY12** ✅ — worker.js / index.html / manifest.json / service-worker.js / wrangler.toml 수정 0건. workers/ / .github/ 신규 0건. endpoint / inbound 0건

---

## 10. smoke test 결과 (46 시나리오 spec, 47 records — mock fetch only)

```
TOTAL=47 PASS=47 FAIL=0
```

(circuit breaker 시나리오 §34 는 threshold-reached 단계(34a) + open-after-3-fail(34b) 2단계로 검증 → 47 records.)

| 그룹 | 시나리오 |
|---|---|
| S1 | canary sender ready (buildTelegramCanaryPlan valid=true) |
| S2~S16 | v0.20 result missing/invalid/canaryOnly=false/liveSignalEnabled=true + 11 policy hard precondition blocked |
| S17~S20 | WS3_TELEGRAM_CANARY_ENABLED=false / AUTHORIZED_AT missing/expired / invoke token mismatch blocked |
| S21 | manualTrigger missing blocked (Gate 4) |
| S22~S24 | token/chatId missing + messageType not CANARY_TEST_ONLY blocked |
| S25 | target=TELEGRAM only (CANARY_TARGET constant) |
| S26~S30 | fixed message exact pass / variation / timestamp / candidate payload / forbidden trading wording blocked |
| S31~S34 | timeout 5s enforced (mock setTimeout) / retry=0 / rate limit 60s / circuit breaker 3 failures opens |
| S35~S40 | token/chatId value output 0 / masked preview 0 / raw response 0 / description 0 / from.username 0 / chat.id 0 |
| S41~S42 | safe result whitelist (6 keys) / safe error enum (4 keys) |
| S43~S46 | KV/DB write 0 (v0.20 policy carry) / worker.js not modified / Object.assign/spread/clone/for-in 0 / fixed message byte-for-byte |

smoke 파일 `_ws3_v210_smoke.js` 검증 후 삭제 완료. **실제 Telegram API 호출 0건** (mock fetchImpl 만 사용).

---

## 11. 보호 파일 (수정 0건 — 31종)

```text
index.html, manifest.json, service-worker.js, worker.js, wrangler.toml
/v3/v3-config.js ~ /v3/v3-live-execution-preflight-gate.js (24종)
/docs/ws3/WS3_CODE_CONTRACT.md, /docs/ws3/WS3_WORKFLOW_TEMPLATE.md
```

`git diff --stat HEAD -- <31 protected paths>` = 빈 출력 = 0건 ✅.

---

## 12. 금지/제한 패턴 grep 결과

| 패턴 | 비-comment 매치 | 위치 / 비고 |
|---|---|---|
| `async function` | **1** (line 439 `dispatchCanary`) | 정책 허용 ✅ |
| `await ` | **2** (lines 523, 549 — `deps.fetchImpl` / `resp.json`) | dispatchCanary 내부 한정 ✅ |
| `fetch(` 직접 호출 | **0** | `deps.fetchImpl(` 만 사용 ✅ |
| `AbortController` 직접 사용 | **0** | `new deps.AbortControllerImpl()` 만 |
| `setTimeout / clearTimeout` 직접 사용 | **0** | `deps.setTimeoutImpl / deps.clearTimeoutImpl` 만 |
| `Date.now / new Date / performance.now` | **0** | `deps.nowMs / deps.nowFn` 만 |
| `process.env / globalThis.env / globalThis.bindings / globalThis.secrets` | **0** | `input.runtimeEnv` 인자 만 |
| `Object.assign / spread / JSON.parse(JSON.stringify) / for-in` | **0** | field-by-field copy + Object.keys + index loop |
| `first-4 / last-4 / masked / redacted` 출력 | **0** | safeDiagnostics 박제 false 만 |
| `chat.id / chat.title / chat.username / from.username / from.first_name / description / Set-Cookie / response headers / full response body` | **1** (line 109, `FORBIDDEN_RESPONSE_FIELDS` 리스트) | detection list only — 실제 출력 0건 |

---

## 13. v0.22+ 분리 사항

- manual canary endpoint (HTTP) 생성 — v0.22+
- Telegram inbound `/canary-test` 명령 처리 — v0.22+ (worker.js 보호 정책과 충돌 회피)
- GitHub Actions workflow_dispatch — v0.22+ (.github/ 신규 0건)
- 별도 canary worker (workers/ 신규) — v0.22+
- v0.21 단계는 **module 만** 생성. 외부 trigger 진입점은 다음 단계.

---

## 14. 기준 commit

- branch: `claude/heuristic-cori-7865e7`
- 이전 functional baseline: WS3 v0.20.0 secureRuntimeStateAdapter (직전 단계, 동일 Gate 2)
- 본 commit: (push 후 기록)

⚠️ **본 단계 보고에는 실제 Telegram API 호출 0건**. 실제 1회 canary 발송은 별도 staging test 승인 후에만 진행.
