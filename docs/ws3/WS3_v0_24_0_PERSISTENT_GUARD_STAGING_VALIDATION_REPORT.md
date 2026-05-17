# WS3 v0.24.0 — Persistent Guard Staging Validation 완료 보고

**작성일**: 2026-05-18
**branch**: `claude/heuristic-cori-7865e7`
**이전 functional baseline**: WS3 v0.23.0 Persistent Canary Safety Guard (`5b6c488`)
**본 단계 산출**: 운영 검증 (코드 변경 0건, 문서 박제만)

---

## 1. 단계 개요

v0.24.0 은 **운영 검증 Gate** 다. 코드 개발/배포 단계 아님.

v0.23.0 에서 도입한 canary 전용 KV persistent safety guard (alreadySent / cleanupRequired / circuit / per-originHash invokeFail) 가 **실제 Cloudflare KV 환경에서 작동하는지** 1회 한정 실 Telegram canary 발송으로 검증.

실코인 후보 연결 / Snapshot / Evaluation / Audit / KV write / production Web Console hosting — 본 단계 0건.

---

## 2. 검증된 항목 (9건)

```text
1. 첫 Send Canary → 실제 Telegram 1회 수신 성공
2. 발송 후 KV alreadySent=true 저장 확인
3. 발송 후 KV cleanupRequired=true 저장 확인
4. 2차 Send Canary → ALREADY_SENT_PERSISTENT / 409 차단 확인
5. Telegram 추가 수신 0건 기준 충족
6. /cleanup-confirm → CLEANUP_CONFIRMED / 200 확인
7. cleanup 후 cleanupRequired=false 확인
8. alreadySent=true 유지 확인 (cleanup-confirm 이 alreadySent 를 reset 하지 않음)
9. 최종 CANARY_ENABLED=false 복귀 확인
```

---

## 3. 최종 /state 결과

```json
{
  "ok": true,
  "service": "WS3_CANARY_WEB_MVP",
  "version": "WS3_v0.23.0_persistent_canary_safety_guard",
  "canaryEnabled": false,
  "persistenceAvailable": true,
  "alreadySent": true,
  "cleanupRequired": false,
  "circuitOpen": false
}
```

응답 필드 8개 whitelist 만 노출. sentAt / blockedUntil / consecutiveFailures / failureCount / Telegram message_id / raw Telegram response / token / chatId / Origin 실제 값 — 모두 출력 0건 ✅.

---

## 4. v0.23 KV state schema 운영 검증

| 키 | 검증 시점 | 결과 |
|---|---|---|
| `ws3:canary:alreadySent` | 1차 Send Canary 직후 | schemaVersion='v1', alreadySent=true 저장 ✅ |
| `ws3:canary:cleanupRequired` | 1차 Send Canary 직후 | schemaVersion='v1', cleanupRequired=true, reason='LIVE_CANARY_SENT' 저장 ✅ |
| `ws3:canary:cleanupRequired` | /cleanup-confirm 후 | cleanupRequired=false, lastCleanupAt=nowMs 갱신 ✅ |
| `ws3:canary:alreadySent` | /cleanup-confirm 후 | **변경 0건** (alreadySent=true 유지) ✅ |
| `ws3:canary:circuit` | 검증 전체 | circuitOpen=false (Telegram 발송 성공으로 circuit reset) ✅ |
| `ws3:canary:invokeFail:<originHash>` | 검증 전체 | failureCount=0 (정상 invoke token 일치) ✅ |

---

## 5. 보안 / 누출 검증

- 실제 Telegram bot token / chatId / invoke token / KV namespace id — 채팅 / 보고서 / 로그 노출 **0건** ✅
- Telegram message_id / raw response — 응답 본문 / 보고서 노출 **0건** ✅
- Origin 실제 값 (`http://localhost:8788`) 외 production 도메인 — 노출 **0건**
- IP / cookie / session id / browser fingerprint — 노출 **0건**
- /state 응답 8 필드 whitelist 외 필드 — 노출 **0건**
- masked / first-4 / last-4 / redacted preview — 노출 **0건**

---

## 6. 안전 닫기 (cleanup) 완료 상태

```text
WS3_TELEGRAM_CANARY_ENABLED = false       (재발송 자동 차단)
WS3_TELEGRAM_CANARY_AUTHORIZED_AT = 0     (Gate 2 AUTHORIZED_AT_MISSING 으로 차단)
WS3_CANARY_INVOKE_TOKEN                    (rotate 미수행 — 본 staging 검증 동안만 사용)
WS3_TELEGRAM_BOT_TOKEN                     (변경 0건)
WS3_TELEGRAM_CHAT_ID                       (변경 0건)
WS3_CANARY_ALLOWED_ORIGINS                 (http://localhost:8788 유지)
WS3_CANARY_STATE_KV binding                (활성 유지 — alreadySent=true / cleanupRequired=false / circuitOpen=false 박제)
```

다음 Send Canary 재시도 시 필요:
- dashboard 에서 `CANARY_ENABLED=true` 재설정
- dashboard 에서 `AUTHORIZED_AT` 최신 ms timestamp 갱신
- **그리고 alreadySent=true 가 KV 에 남아 있으므로 별도 reset endpoint 필요** (v0.23 에는 미구현 — v0.25+ 검토 항목)

---

## 7. v0.23 KV strict-lock 한계 재확인 (r0.2-final 박제)

본 staging 검증은 단일 isolate / 단일 사용자 시퀀스에서 mock-KV-equivalent 한 동작을 보여줬다. 하지만:

- mock KV = strong consistency
- real Cloudflare KV = eventual consistency 가능
- 동시 다중 isolate 의 alreadySent read-modify-write race / invokeFail counter increment race / circuit counter race 는 본 검증 범위 밖
- production-grade strict one-time guarantee 는 v0.24+ Durable Objects / atomic lock / D1 transaction 으로 재논의 필요

v0.24 staging 결과는 "**1 isolate / 1 사용자 시퀀스에서 persistent guard 가 의도대로 작동함**" 까지 검증.

---

## 8. 본 단계 변경 사항

| 분류 | 내용 |
|---|---|
| code 변경 | **0건** (v0.23.0 코드 그대로) |
| Cloudflare worker 재배포 | **0건** (v0.23.0 production Version 유지) |
| KV namespace 생성/변경 | **0건** (v0.23 Gate 에서 생성한 namespace 재사용) |
| KV binding 변경 | **0건** |
| Telegram 실 발송 | **1회** (의도된 staging 발송, fixed 5-line message exact) |
| 추가 commit | 본 문서 박제 commit 만 (코드 변경 0건) |
| PR / main merge | **0건** |
| 보호 파일 diff | **0건** |

---

## 9. 남은 작업 / 다음 단계 후보

본 Gate 종결 후 가능한 다음 단계:

1. **alreadySent reset endpoint 도입** (v0.25 candidate) — 재staging 검증 / re-canary 시 KV alreadySent 를 안전하게 reset 하는 endpoint. 현재는 manual KV delete 또는 wrangler kv 명령 필요 (강제 KV write 는 v0.23 spec 위반 위험).
2. **Production Web Console hosting** (v0.25 candidate) — localhost:8788 외 production origin (e.g., Cloudflare Pages) 호스팅 정책. ALLOWED_ORIGINS 갱신 + CSP / iframe 정책.
3. **actual coin live 연결 preflight** (v0.26+ candidate) — Snapshot / Evaluation / Audit 등 다른 target 의 LIVE 발송 분기. canary 외 fixed message 다양화는 별도 review.
4. **Durable Objects / D1 strict one-time guarantee** (v0.27+ candidate) — KV eventual consistency 한계 보완.
5. **invoke token rotate automation** — 현재 manual `wrangler secret put` 필요. Cloudflare Secrets Store / wrangler scripted secret rotation.
6. **ipHash + WS3_CANARY_HASH_SALT** — per-originHash 외 per-IP failure counter.

위 항목은 본 보고서에 후보만 박제. 실제 진행은 별도 Gate 별 spec 후 결정.

---

## 10. 기준 commit

- branch: `claude/heuristic-cori-7865e7`
- 이전 functional baseline: WS3 v0.23.0 Persistent Canary Safety Guard (`5b6c488`)
- 본 commit: (closure commit 별도 — 코드 변경 0건, 문서 박제만)

---

## 11. 결론

v0.23.0 Persistent Canary Safety Guard 는 실제 Cloudflare 환경에서 **1 isolate / 1 사용자 시퀀스 범위 내 의도대로 작동**함을 본 staging 검증으로 박제. canary 전용 KV write exception 정책이 통제 가능한 best effort persistent safety guard 로 동작 확인.

본 검증 이후 actual coin live 연결 논의는 별도 단계로 분리. v0.24 종결.
