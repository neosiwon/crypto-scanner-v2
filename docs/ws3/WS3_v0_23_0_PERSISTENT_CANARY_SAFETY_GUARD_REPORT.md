# WS3 v0.23.0 — Persistent Canary Safety Guard 완료 보고

**작성일**: 2026-05-18
**branch**: `claude/heuristic-cori-7865e7`
**이전 functional baseline**: WS3 v0.22.1 + v0.22.1 Gate 6 closure (`f221e62`)
**본 단계 산출**: 4 신규 + 1 수정 + 2 문서 갱신

---

## 1. 목표

v0.23.0 은 **canary 전용 KV write 예외를 안전하게 여는** 단계다. 실코인 연결 / 본선 KV / Snapshot / Evaluation / Audit / DB write 는 모두 계속 금지. KV alreadySent / cleanupRequired / circuit / per-origin invoke-token failure counter 를 **persistent safety guard** 로 도입.

KV alreadySent 는 strict distributed lock 이 아니다. strict one-time guarantee 는 v0.24+ Durable Objects 또는 atomic lock 에서 검토.

---

## 2. 생성/수정 파일

```text
workers/ws3-canary-state-kv-adapter.js                              신규 (276 lines)
workers/ws3-telegram-canary-worker.js                               수정 (v0.22.1 → v0.23.0, 737 lines)
wrangler-canary.example.toml                                        신규 (commit-safe placeholder)
.gitignore                                                          신규 (canary local-only 파일 보호)
docs/ws3/WS3_v0_23_0_PERSISTENT_CANARY_SAFETY_GUARD_REPORT.md       신규 (본 보고서)
docs/ws3/WS3_CHANGELOG.md                                           수정 (v0.23.0 entry prepend)
docs/ws3/WS3_CURRENT_BASELINE.md                                    수정 (baseline → v0.23.0)
```

**v3/ 엔진 / 보호 파일 / web console / wrangler.toml 본선 / index.html / worker.js / manifest.json / service-worker.js — 수정 0건** ✅.

---

## 3. KV write exception boundary

| 허용 | 금지 |
|---|---|
| binding `WS3_CANARY_STATE_KV` (canary 전용 별도 namespace) | 본선 KV namespace 공유 / 재사용 |
| prefix `ws3:canary:` | 그 외 prefix (INVALID_KV_KEY_PREFIX) |
| 4 키만: `alreadySent` / `cleanupRequired` / `circuit` / `invokeFail:<originHash>` | snapshot / evaluation / audit / 실코인 후보 / payload / KV의 다른 키 |
| schemaVersion='v1' 강제 | 다른 schemaVersion (SCHEMA_VERSION_MISMATCH) |
| safe JSON-string only | secret / Telegram message_id / raw response / token / chatId / invoke token / Origin 실제 값 / IP / Telegram URL |

canary worker 만 KV 에 접근. 본선 worker.js / v3 엔진 / Snapshot adapter / Evaluation adapter / Audit adapter 의 KV write 는 v0.23 이후에도 영구 금지.

---

## 4. canary 전용 namespace 정책

- binding name: `WS3_CANARY_STATE_KV` (worker constant, hard-coded)
- namespace 는 사용자 별도 단계에서 `wrangler kv namespace create` 로 신규 생성. **본선 KV 와 공유 금지**.
- 실제 namespace id 는 `wrangler-canary.toml` (untracked, `.gitignore` 등재) 에만 기록.
- 공유용 `wrangler-canary.example.toml` 에는 `REPLACE_WITH_CANARY_KV_NAMESPACE_ID` placeholder 만.
- 본 보고서 / commit / 채팅 / 로그에 실제 namespace id 노출 **0건**.

---

## 5. schemaVersion 정책

- 모든 KV value 는 top-level `schemaVersion: "v1"` 필드 필수.
- read 시 schemaVersion 불일치 → adapter 가 `SCHEMA_VERSION_MISMATCH` 반환 → worker 가 503 + safe error response.
- write 시 schemaVersion 누락/오류 → adapter 가 차단.
- v0.24+ 에서 schemaVersion 변경 필요 시 별도 migration gate.

---

## 6. /state 인증 정책

```text
GET /state
- Origin allowlist 검증 (필수)
- X-WS3-Canary-Token === env.WS3_CANARY_INVOKE_TOKEN (필수)
- body / manualTrigger 불필요
- KV binding 없으면 200 + persistenceAvailable=false (safe degraded view)
- 응답 필드: ok / service / version / canaryEnabled / persistenceAvailable /
  alreadySent / cleanupRequired / circuitOpen  (총 8 fields)
- 출력 금지: token / chatId / invoke token / Origin 실제 값 / IP /
  Telegram message_id / raw Telegram response / KV raw object 전체 /
  sentAt / blockedUntil / consecutiveFailures / failureCount / Telegram URL /
  schema 내부 원문 전체
```

---

## 7. /cleanup-confirm manual 정책

```text
POST /cleanup-confirm  (Telegram 발송 0건)
- Origin allowlist 검증
- Content-Type: application/json (필수)
- body size <= 1KB (검증)
- body.manualTrigger === true (필수 — env flag 단독 trigger 차단)
- X-WS3-Canary-Token === env.WS3_CANARY_INVOKE_TOKEN (필수)
- KV binding 필수 (없으면 503 PERSISTENCE_UNAVAILABLE)
```

분기:
- `cleanupRequired===true` → flip to `false` + `lastCleanupAt=nowMs` + alreadySent=true 유지 → `200 CLEANUP_CONFIRMED`
- `cleanupRequired===false` 또는 state 부재 → state 변경 0건 → `200 NO_CLEANUP_REQUIRED`
- `cleanupRequired` SCHEMA_VERSION_MISMATCH → `503 SCHEMA_VERSION_MISMATCH`
- `/send-canary` 의 safe default: `alreadySent===true` + `cleanupRequired` state 부재 동시 발견 시 → `409 CLEANUP_REQUIRED` (재발송 차단)

---

## 8. KV strict one-time 한계 (r0.2-final 박제)

```text
- mock KV (in-memory) = strong consistency. 모든 smoke test 가 mock 으로 통과.
- real Cloudflare KV = eventually consistent. 동일 namespace 의 동시 다중 isolate 에서:
  · alreadySent read-modify-write race 가능
  · circuit / invokeFail counter increment race 가능
  · 정확히 1회 발송 보장은 불완전 (best effort persistent safety guard)
- strict one-time guarantee 가 필요한 경우 v0.24+:
  · Durable Objects + transactional read-modify-write
  · 또는 Cloudflare Workers Rate Limiting API
  · 또는 D1 의 SQL transaction + UNIQUE constraint
- mock test 통과 가 production 안정성을 완전히 보장하지 않음을 본 보고서 / worker 주석 / changelog 에 박제.
```

---

## 9. mock smoke 결과

```
TOTAL=16 PASS=16 FAIL=0
```

| # | 시나리오 | 결과 |
|---|---|---|
| 1 | KV binding 부재 → PERSISTENCE_UNAVAILABLE | ✅ 503 |
| 2 | fake token 5회 → INVOKE_TOKEN_BLOCKED_TOO_MANY_FAILURES_PERSISTENT on 6th | ✅ 429 |
| 3 | KV alreadySent=true → ALREADY_SENT_PERSISTENT | ✅ 409 |
| 4 | KV cleanupRequired=true → CLEANUP_REQUIRED | ✅ 409 |
| 5 | mock send 성공 → CANARY_SENT + KV alreadySent + cleanupRequired=true 저장 | ✅ |
| 6 | cleanup-confirm 성공 → CLEANUP_CONFIRMED + cleanupRequired=false + lastCleanupAt 저장 | ✅ |
| 7 | cleanup-confirm 재호출 (cleanupRequired=false) → NO_CLEANUP_REQUIRED + state 변경 0건 | ✅ |
| 8 | Telegram network error 3회 → CANARY_CIRCUIT_OPEN_PERSISTENT | ✅ 503 |
| 9 | GET /state → safe 8 fields only (sentAt / blockedUntil / failureCount / consecutiveFailures 미노출) | ✅ |
| 10 | schemaVersion='v999' mismatch → SCHEMA_VERSION_MISMATCH | ✅ 503 |
| 11 | adapter INVALID_KV_KEY_PREFIX (non-canary prefix 차단) | ✅ |
| 12 | adapter INVALID_HASH_FORMAT (16-hex lowercase 만 통과) | ✅ |
| 13 | raw Telegram response leak 0건 (leakBot / chat / from / message_id / description 모두 차단) | ✅ |
| 14 | token/chatId/invoke token leak 0건 (success path body) | ✅ |
| 15 | message_id leak 0건 (worker 응답에 messageId / message_id 필드 미노출) | ✅ |
| 16 | KV strict-lock 한계 문서 박제 (worker comment + adapter export 검증) | ✅ |

실제 Telegram API 호출 **0건**. 모든 fetch 는 mock fetchImpl. 모든 KV 는 mock in-memory store. mock KV 한계도 본 보고서 §8 에 박제.

---

## 10. 보호 파일 무손상 여부

```bash
git diff --stat HEAD -- worker.js wrangler.toml index.html manifest.json service-worker.js \
  docs/ws3/WS3_CODE_CONTRACT.md docs/ws3/WS3_WORKFLOW_TEMPLATE.md v3/
```
→ 빈 출력 = **0건** ✅

- 본선 `worker.js` / `wrangler.toml` (이 repo 에 미존재) / `index.html` / `manifest.json` / `service-worker.js`: 미수정 ✅
- 모든 v3/ 엔진 25종 (v3-config.js ~ v3-telegram-canary-sender.js): 미수정 ✅
- `docs/ws3/WS3_CODE_CONTRACT.md` / `WS3_WORKFLOW_TEMPLATE.md`: 미수정 ✅
- `web/ws3-canary-console.html`: 미수정 ✅

---

## 11. 신규 safe code (v0.23 추가)

| code | HTTP | 의미 |
|---|---|---|
| `PERSISTENCE_UNAVAILABLE` | 503 | KV binding 부재 또는 KV 호출 실패 (fallback 금지) |
| `ALREADY_SENT_PERSISTENT` | 409 | KV alreadySent=true |
| `CLEANUP_REQUIRED` | 409 | KV cleanupRequired=true (또는 alreadySent=true + cleanupRequired state 부재 safe default) |
| `INVOKE_TOKEN_BLOCKED_TOO_MANY_FAILURES_PERSISTENT` | 429 | per-originHash 5회 누적 실패 → 24h 차단 |
| `CANARY_CIRCUIT_OPEN_PERSISTENT` | 503 | persistent circuit (Telegram/network 3회 누적 실패) → 24h 차단 |
| `NO_CLEANUP_REQUIRED` | 200 | cleanup-confirm 시 변경 0건 |
| `CLEANUP_CONFIRMED` | 200 | cleanup-confirm 시 cleanupRequired=true → false 전환 + lastCleanupAt=now |
| `INVALID_KV_KEY_PREFIX` | 500 | adapter 가 non-canary prefix 차단 |
| `SCHEMA_VERSION_MISMATCH` | 503 | KV value 의 schemaVersion 이 'v1' 아님 |
| `INVALID_HASH_FORMAT` | 500 | originHash 가 16-hex lowercase 아님 |

기존 v0.22.x safe code 는 그대로 유지.

---

## 12. KV state schema (v1)

```jsonc
// ws3:canary:alreadySent
{ "schemaVersion": "v1", "alreadySent": true, "sentAt": 1770000000000,
  "messageType": "CANARY_TEST_ONLY", "fixedMessageUsed": true }

// ws3:canary:cleanupRequired
{ "schemaVersion": "v1", "cleanupRequired": true, "reason": "LIVE_CANARY_SENT",
  "createdAt": 1770000000000, "lastCleanupAt": null }

// ws3:canary:invokeFail:<originHash>
{ "schemaVersion": "v1", "originHash": "<16 hex>", "failureCount": 3,
  "lastFailureAt": 1770000000000, "blockedUntil": null }

// ws3:canary:circuit
{ "schemaVersion": "v1", "circuitOpen": false, "consecutiveFailures": 0,
  "lastFailureAt": null, "circuitOpenUntil": null }
```

저장 금지 필드 — Telegram message_id / raw Telegram response / bot token / chatId / invoke token / Telegram URL / Origin 실제 값 / IP — 0건.

---

## 13. hash 정책

- input: Origin header value
- algorithm: SHA-256 via `crypto.subtle.digest` (Cloudflare Workers / Node 18+)
- encoding: lowercase hex (only `0-9` / `a-f`)
- length: first 16 chars
- 검증: 길이 === 16 AND 모두 0-9 / a-f
- 위반: `INVALID_HASH_FORMAT`
- v0.24+ 후보: ipHash, `WS3_CANARY_HASH_SALT` salting

---

## 14. 남은 작업

```text
- Gate 3 commit (본 단계 후 — staging + commit + push 별도 단계)
- KV namespace 실제 생성 (사용자 manual): wrangler kv namespace create + ID 를 untracked wrangler-canary.toml 에 기록
- Cloudflare canary worker 재배포 (v0.23 코드 + KV binding 활성)
- 재발송 staging test (사용자 별도 승인 후 — 1회 한정 + 즉시 cleanup-confirm)
- v0.24+: Durable Objects / atomic lock / D1 / ipHash / hash salt / production Web Console hosting policy
```

본 단계에서는 Cloudflare deploy 0건 / KV namespace 생성 0건 / KV binding 활성 0건 / CANARY_ENABLED=true 변경 0건 / Send Canary 클릭 0건 / Telegram API 호출 0건. 모두 별도 승인 분리.

---

## 15. 기준 commit

- branch: `claude/heuristic-cori-7865e7`
- 이전 functional baseline: WS3 v0.22.1 + Gate 6 closure (`f221e62`)
- 본 commit: (Gate 3 staging + commit 별도 단계 — 본 Gate 2 단계 commit 0건)
