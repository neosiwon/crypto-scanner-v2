# WS3 v0.25.0 — Operator Reset / State Lifecycle 완료 보고

**작성일**: 2026-05-18
**branch**: `claude/heuristic-cori-7865e7`
**이전 functional baseline**: WS3 v0.24.0 Persistent Guard Staging Validation (`cd002dc`)
**본 단계 산출**: 2 수정 + 1 신규 보고서 + 2 문서 갱신 (코드 분리 5 파일)

---

## 1. 목표

v0.24 검증 후 alreadySent=true 로 잠긴 canary state 를 운영자가 **안전하게 재테스트 가능한 상태로 되돌리는 reset lifecycle** 을 완성. canary 전용 KV write exception 안에서 only.

핵심 안전선:
- `/operator-reset` 은 `ALREADY_SENT_PERSISTENT` 안전장치를 우회하는 위험한 문이 될 수 있으므로 **7중 조건 + circuit 차단 + cooldown** 으로 보호
- reset 은 **Telegram 발송 0건 / secret 변경 0건 / failure counter 삭제 0건 / circuit 강제 해제 0건**
- 실코인 후보 / Snapshot / Evaluation / Audit / 본선 KV — 영구 금지 유지

---

## 2. 현재 v0.24 state (이번 단계 입력)

```text
canaryEnabled=false
persistenceAvailable=true
alreadySent=true
cleanupRequired=false
circuitOpen=false
```

v0.25 도입 후 `/state` 응답에 신규 `currentPhase` 가 위 state 를 `OPERATOR_RESETTABLE` 로 분류.

---

## 3. /operator-reset 7중 조건 + 2 추가 안전선

| # | 조건 | 위반 시 |
|---|---|---|
| 1 | Origin allowlist 통과 | `ORIGIN_MISSING` 403 / `ORIGIN_NOT_ALLOWED` 403 |
| 2 | `X-WS3-Canary-Token === env.WS3_CANARY_INVOKE_TOKEN` exact | `MISSING_INVOKE_TOKEN` 401 / `INVOKE_TOKEN_MISMATCH` 403 |
| 3 | `body.manualTrigger === true` | `MANUAL_TRIGGER_REQUIRED` 400 |
| 4 | `body.resetPhrase === "RESET_WS3_CANARY_STATE"` byte-for-byte | `RESET_PHRASE_MISMATCH` 403 |
| 5 | `env.WS3_TELEGRAM_CANARY_ENABLED === 'false'` | `RESET_REQUIRES_CANARY_DISABLED` 409 |
| 6 | KV `cleanupRequired === false` | `RESET_REQUIRES_CLEANUP_CONFIRMED` 409 |
| 7 | KV `persistenceAvailable === true` (binding + read 성공) | `PERSISTENCE_UNAVAILABLE` 503 |
| +1 | KV `circuitOpen === false` | `CIRCUIT_OPEN_RESET_BLOCKED` 503 |
| +2 | lastResetAt 기준 60s 이내 재-reset 불가 (단, idempotent NO_RESET_REQUIRED 에는 적용 X) | `RESET_COOLDOWN_ACTIVE` 429 |

5/6 둘 다 통과한 이후에만 KV alreadySent / operatorReset state 가 write 됨. 4/3/2/1 위반은 KV read/write 0건 (조기 차단).

---

## 4. resetPhrase 정책

- 값: `RESET_WS3_CANARY_STATE` (hardcoded constant, env override 0건)
- 비교: byte-for-byte exact (typeof === 'string' AND === 비교, trim 없음)
- 차단 예시:
  - `reset_ws3_canary_state` (대소문자)
  - `RESET WS3 CANARY STATE` (공백)
  - `RESET_WS3_CANARY_STATE ` (trailing space)
  - ` RESET_WS3_CANARY_STATE` (leading space)
  - `RESET_WS3_CANARY_STATE\n` (개행)
- KV 에 resetPhrase 원문 **저장 0건** (smoke S17 검증)
- env 기반 resetPhrase 는 v0.26+ 후보 — v0.25 미적용

---

## 5. 성공 동작

KV write 2개:
- `ws3:canary:alreadySent` (`markAlreadySentReset` 경유):
  ```json
  { "schemaVersion": "v1", "alreadySent": false,
    "sentAt": <기존 값 audit 보존>,
    "messageType": "CANARY_TEST_ONLY",
    "fixedMessageUsed": true }
  ```
- `ws3:canary:operatorReset` (신규 키):
  ```json
  { "schemaVersion": "v1",
    "resetCount": <기존 + 1>,
    "lastResetAt": <nowMs>,
    "lastResetReason": "OPERATOR_RESET_CONFIRMED" }
  ```

응답:
```json
{ "ok": true, "status": "OK",
  "code": "OPERATOR_RESET_CONFIRMED", "httpStatus": 200 }
```

**Telegram 발송 / secret 변경 / failure counter 삭제 / circuit 강제 해제 / cleanupRequired 변경 / bot token 접근 / chatId 접근 — 0건** (smoke S15 fetch 호출 0건 검증).

---

## 6. idempotent 정책

- `alreadySent === false` 또는 alreadySent 레코드 부재 시 → `NO_RESET_REQUIRED` 200
- KV state 변경 **0건**
- resetCount 증가 안 함 / lastResetAt 재기록 안 함
- cooldown 적용 안 함 (안전한 재호출 허용)
- smoke S13 검증

---

## 7. cooldown 정책

- `lastResetAt` 기준 **60초** 이내 재-reset 시 `RESET_COOLDOWN_ACTIVE` 429
- 하드코딩 (env / config override 없음)
- 단, idempotent NO_RESET_REQUIRED 분기엔 cooldown 적용 안 함 — alreadySent=false 상태에서 반복 호출은 안전
- smoke S12 검증

---

## 8. /state 보강

신규 2 필드:
- `currentPhase`: enum string (`computeCurrentPhase` 계산값)
- `resetCount`: number (resetCount KV 값, 기본 0)

response 8 → **10 fields** whitelist:
```json
{ "ok": true,
  "service": "WS3_CANARY_WEB_MVP",
  "version": "WS3_v0.25.0_operator_reset_state_lifecycle",
  "canaryEnabled": false,
  "persistenceAvailable": true,
  "alreadySent": true,
  "cleanupRequired": false,
  "circuitOpen": false,
  "currentPhase": "OPERATOR_RESETTABLE",
  "resetCount": 0 }
```

**여전히 출력 금지**: `lastResetAt` / `lastSentAt` / `lastCleanupAt` / `sentAt` / `blockedUntil` / `failureCount` / `consecutiveFailures` / Telegram `message_id` / raw Telegram response / token / chatId / invoke token / Origin 실제 값 / IP — 모두 0건.

---

## 9. currentPhase 9가지 분류 (`computeCurrentPhase`)

| phase | 조건 |
|---|---|
| `PERSISTENCE_UNAVAILABLE` | `persistenceAvailable !== true` |
| `CIRCUIT_OPEN` | `circuitOpen === true` |
| `CLEANUP_REQUIRED` | `alreadySent === true` AND `cleanupRequired === true` |
| `LOCKED_ALREADY_SENT` | `alreadySent === true` AND `cleanupRequired === false` AND `canaryEnabled === true` |
| `OPERATOR_RESETTABLE` | `alreadySent === true` AND `cleanupRequired === false` AND `canaryEnabled === false` |
| `RESET_CONFIRMED` | `alreadySent === false` AND `cleanupRequired === false` AND `resetCount > 0` |
| `READY` | `alreadySent === false` AND `cleanupRequired === false` AND `resetCount === 0` |

ordering 은 first-match-wins (위에서 아래). `PERSISTENCE_UNAVAILABLE` / `CIRCUIT_OPEN` 이 가장 강한 차단 상태.

---

## 10. KV state 확장 (schemaVersion v1 유지, backward-compatible)

### 10.1 alreadySent record (변경 없음 + reset 시 audit 보존)
```json
{ "schemaVersion": "v1",
  "alreadySent": true|false,
  "sentAt": 1770000000000,
  "messageType": "CANARY_TEST_ONLY",
  "fixedMessageUsed": true }
```
reset 후 → `alreadySent: false`, `sentAt` audit 보존, 나머지 동일.

### 10.2 operatorReset record (신규 key `ws3:canary:operatorReset`)
```json
{ "schemaVersion": "v1",
  "resetCount": 1,
  "lastResetAt": 1770000000000,
  "lastResetReason": "OPERATOR_RESET_CONFIRMED" }
```

### 10.3 cleanupRequired record (변경 없음)
v0.23 형식 그대로. reset 은 이 레코드를 수정 0건.

### 10.4 circuit record (변경 없음)
v0.23 형식 그대로. reset 은 이 레코드를 수정 0건.

### 10.5 invokeFail:<originHash> record (변경 없음)
v0.23 형식 그대로. reset 은 이 레코드를 수정 0건.

### 10.6 schemaVersion 정책
- v1 유지 (v0.23 → v0.25 backward-compatible)
- resetCount 없으면 default 0
- lastResetAt 없으면 default null
- v2 migration 은 v0.26+ 검토

---

## 11. 신규 safe code (8종)

| code | HTTP | 의미 |
|---|---|---|
| `OPERATOR_RESET_CONFIRMED` | 200 | reset 성공 (alreadySent=false 전환 + resetCount +1) |
| `NO_RESET_REQUIRED` | 200 | alreadySent=false 상태 — KV 변경 0건 |
| `RESET_PHRASE_MISMATCH` | 403 | resetPhrase byte-for-byte 불일치 |
| `RESET_PRECONDITION_FAILED` | 409 | 일반 precondition 실패 (markAlreadySentReset 실패 등) |
| `RESET_REQUIRES_CANARY_DISABLED` | 409 | `CANARY_ENABLED=true` 상태에서 reset 시도 |
| `RESET_REQUIRES_CLEANUP_CONFIRMED` | 409 | `cleanupRequired=true` 상태에서 reset 시도 |
| `RESET_COOLDOWN_ACTIVE` | 429 | 60s 이내 재-reset 시도 |
| `CIRCUIT_OPEN_RESET_BLOCKED` | 503 | `circuitOpen=true` 상태에서 reset 시도 |

기존 v0.22.x / v0.23 safe code 모두 유지.

---

## 12. mock smoke 결과 (19 시나리오)

```
TOTAL=19 PASS=19 FAIL=0
```

| # | 시나리오 | 결과 |
|---|---|---|
| 1 | /state currentPhase=OPERATOR_RESETTABLE | ✅ |
| 2 | resetPhrase mismatch → RESET_PHRASE_MISMATCH 403 | ✅ |
| 3 | manualTrigger=false → MANUAL_TRIGGER_REQUIRED 400 | ✅ |
| 4 | CANARY_ENABLED=true → RESET_REQUIRES_CANARY_DISABLED 409 | ✅ |
| 5 | cleanupRequired=true → RESET_REQUIRES_CLEANUP_CONFIRMED 409 | ✅ |
| 6 | circuitOpen=true → CIRCUIT_OPEN_RESET_BLOCKED 503 | ✅ |
| 7 | 정상 reset → OPERATOR_RESET_CONFIRMED 200 | ✅ |
| 8 | reset 후 alreadySent=false + sentAt audit 보존 | ✅ |
| 9 | reset 후 cleanupRequired 레코드 변경 0건 | ✅ |
| 10 | resetCount 0→1 + schemaVersion='v1' + lastResetReason='OPERATOR_RESET_CONFIRMED' | ✅ |
| 11 | lastResetAt = nowMs 기록 확인 | ✅ |
| 12 | 60s 이내 재-reset → RESET_COOLDOWN_ACTIVE 429 | ✅ |
| 13 | alreadySent=false 상태 reset → NO_RESET_REQUIRED 200 (KV 변경 0건) | ✅ |
| 14 | reset 후 /state currentPhase=RESET_CONFIRMED + resetCount=1 | ✅ |
| 15 | Telegram fetch 호출 0건 (reset path 전체) | ✅ |
| 16 | token/chatId/invoke token leak 0건 (response body) | ✅ |
| 17 | resetPhrase 원문 KV 저장 0건 | ✅ |
| 18 | raw Telegram response leak 0건 (description/from/chat/result 미존재) | ✅ |
| 19 | message_id leak 0건 (messageId/message_id 필드 미존재) | ✅ |

실제 Telegram API 호출 **0건** (mock fetchImpl 만 사용). 실제 KV API 호출 **0건** (mock in-memory store 만).

---

## 13. 보호 파일 무손상

`git diff --stat HEAD -- worker.js wrangler.toml index.html manifest.json service-worker.js docs/ws3/WS3_CODE_CONTRACT.md docs/ws3/WS3_WORKFLOW_TEMPLATE.md v3/ web/ws3-canary-console.html` → 빈 출력 = **0건** ✅

- 본선 `worker.js` / `wrangler.toml` (repo 미존재) / `index.html` / `manifest.json` / `service-worker.js` — 미수정
- `v3/` 25종 엔진 — 미수정
- `docs/ws3/WS3_CODE_CONTRACT.md` / `WS3_WORKFLOW_TEMPLATE.md` — 미수정
- `web/ws3-canary-console.html` — 미수정 (v0.25 에서 web console 변경 없음)

---

## 14. 보안 / 누출 검증

- bot token / chatId / invoke token 실제 값 — 채팅 / 보고서 / 로그 노출 **0건**
- KV namespace id — 노출 **0건**
- Telegram message_id / raw Telegram response — 노출 **0건**
- Origin 실제 값 / IP / cookie / session id / browser fingerprint — 노출 **0건**
- resetPhrase 원문 — KV 저장 **0건** (smoke S17)
- masked / first-4 / last-4 / redacted preview — **0건**
- operator identity — 저장 **0건**

---

## 15. 남은 작업 (별도 승인 단계)

- Gate 3 push (별도 승인)
- Cloudflare canary worker 재배포 (v0.25 코드 반영) — 별도 staging gate
- `/operator-reset` 실 staging test — alreadySent=true 상태 (v0.24 잔존) → 실제 호출 → KV alreadySent=false 확인 → /state currentPhase=RESET_CONFIRMED 확인 → 별도 gate
- 그 후 재-canary staging test 가능

v0.25 코드 단계 자체는 본 commit 까지 완료. 실 deploy / 실 reset 호출 / Send Canary 재시도 / Telegram API 호출 — 모두 별도 승인.

---

## 16. v0.26+ 로드맵 (본 보고서에 후보만 박제)

```text
v0.26 = Production Web Console Hosting
v0.27 = Actual Coin Live Preflight + Durable Objects strict one-time guarantee 검토
v0.28+ = Snapshot / Evaluation / Audit KV write boundary 검토
v0.29+ = cleanup 자동화
v0.30+ = ipHash / hash salting / Durable Objects
별도: env-based resetPhrase / circuit reset endpoint / failure counter reset endpoint / invoke token rotate automation
```

---

## 17. 기준 commit

- branch: `claude/heuristic-cori-7865e7`
- 이전 functional baseline: WS3 v0.24.0 Persistent Guard Staging Validation (`cd002dc`)
- 본 commit: (Gate 3 staging + commit 별도 단계)
