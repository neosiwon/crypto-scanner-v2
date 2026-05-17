# WS3 v0.22.0 — Canary Web MVP Pack 완료 보고

**작성일**: 2026-05-17
**branch**: `claude/heuristic-cori-7865e7`
**이전 functional baseline**: WS3 v0.21.0 telegramCanarySender (`9f05ee6`)
**본 단계 산출**: 3 신규 파일 (worker + web + report)

---

## 1. 목표

`v0.22.0 Canary Web MVP Pack` 최소 구현. 별도 canary worker + 별도 web console 추가. 기존 `worker.js` / `index.html` / 기존 v3 엔진 / manifest / service-worker / wrangler 본선 **0건 수정**. 실제 Telegram canary 1회 발송 **0건** (Gate 2 mock smoke 만, production 호출은 별도 승인 단계).

---

## 2. 생성 파일

```text
workers/ws3-telegram-canary-worker.js              신규 (Cloudflare canary worker, ~380 lines, CommonJS)
web/ws3-canary-console.html                        신규 (브라우저 console, ~140 lines)
docs/ws3/WS3_v0_22_0_CANARY_WEB_MVP_PACK_REPORT.md 신규 (본 보고서)
```

선택 파일 (생성 0건):
- `wrangler-canary.toml` — Gate 2 단계 미생성. production deploy 단계에서 별도 추가.
- `v3/v3-canary-web-mvp-adapter.js` — 미생성. 별도 adapter 불필요 (worker 가 v0.20/v0.21 직접 require).

---

## 3. 실제 발송 여부

**0건** ✅.
- Gate 2 smoke 18 records 모두 mock `fetchImpl` 만 사용.
- production Telegram bot API 호출 **0건**.
- 실제 1회 canary 발송은 사용자 별도 승인 후 별도 단계에서 진행.

---

## 4. mock smoke 결과 (18 records — 15 spec + 3 extras)

```
TOTAL=18 PASS=18 FAIL=0
```

| # | 시나리오 | 결과 |
|---|---|---|
| 1 | 정상 origin + token + manualTrigger → SENT | ✅ 200 / CANARY_SENT / messageType / fixedMessageUsed |
| 2 | Origin 없음 → ORIGIN_MISSING | ✅ 403 |
| 3 | Origin mismatch → ORIGIN_NOT_ALLOWED | ✅ 403 |
| 4 | manualTrigger false → MANUAL_TRIGGER_REQUIRED | ✅ 400 |
| 5 | invoke token missing → MISSING_INVOKE_TOKEN | ✅ 401 |
| 6 | invoke token mismatch → INVOKE_TOKEN_MISMATCH | ✅ 403, mismatchCount=1 |
| 7 | missing bot token → MISSING_TOKEN | ✅ 503 |
| 8 | missing chat id → MISSING_CHAT_ID | ✅ 503 |
| 9 | authorized_at 25h expired → AUTH_EXPIRED | ✅ 403 |
| 10 | Telegram 401 mock → TELEGRAM_AUTH_ERROR | ✅ 502 |
| 11 | Telegram 404 mock → TELEGRAM_NOT_FOUND | ✅ 502 |
| 12 | fetch reject mock → TELEGRAM_NETWORK_ERROR | ✅ 502 |
| 13 | AbortError mock → CANARY_TIMEOUT | ✅ 504 |
| 14 | body > 1KB → PAYLOAD_TOO_LARGE | ✅ 413 |
| 15 | Content-Type text/plain → UNSUPPORTED_MEDIA_TYPE | ✅ 415 |
| EX-1 | invoke token mismatch 5x → INVOKE_TOKEN_BLOCKED_TOO_MANY_FAILURES (6th 차단) | ✅ 429 |
| EX-2 | GET /health → ok=true / status=CANARY_READY | ✅ 200 |
| EX-3 | raw Telegram response 누출 0건 (leakBot / chat.id / description / message_id 비포함) | ✅ |

mock fetch 라이브러리는 강제로 leak 가능한 필드 (`leakBot`, `'leak-description'`, `chat.id`, `from.username`, `message_id` 등) 를 포함시켰음에도 worker 응답 본문에 노출 **0건**. v0.21 `extractSafeBody` whitelist + worker 응답 4~6 field 화이트리스트 매핑이 차단.

---

## 5. 보호 파일 무손상 여부

```bash
git diff --stat HEAD -- worker.js wrangler.toml index.html manifest.json service-worker.js \
  docs/ws3/WS3_CODE_CONTRACT.md docs/ws3/WS3_WORKFLOW_TEMPLATE.md v3/
```
→ 빈 출력 = **0건** ✅

기존 v3 25종 모듈 + 보호 7개 (worker.js / wrangler.toml / index.html / manifest.json / service-worker.js / WS3_CODE_CONTRACT.md / WS3_WORKFLOW_TEMPLATE.md) 모두 **무손상**.

---

## 6. per-process state 한계 (r0.2-final 보강)

본 worker 의 `CANARY_PROCESS_STATE` 는 single Cloudflare Worker isolate 내부에서만 유지된다.
포함 필드:

```text
alreadySent
lastSentAt
consecutiveFailures
circuitOpenUntil
invokeTokenMismatchCount
invokeTokenMismatchBlockedUntil
```

**한계 — best effort**:
- Cloudflare Worker isolate 가 cold start / 새로 spawn 되면 counter / lastSentAt / 모두 초기화될 수 있다.
- 따라서 invoke token mismatch 5회 차단도 단일 isolate 내에서만 보장. 새 isolate 시 부분 우회 가능.
- v0.22 의 보안 의존성:
  1. Origin allowlist (env.WS3_CANARY_ALLOWED_ORIGINS 정확 매치)
  2. **High entropy invoke token** (env.WS3_CANARY_INVOKE_TOKEN — 충분히 긴 random secret 가정)
  3. manualTrigger === true (자동 발송 차단)
  4. 24h authorized_at expire (env.WS3_TELEGRAM_CANARY_AUTHORIZED_AT)
  5. UI throttle (Web Console 의 1.5s 클릭 잠금)
- **production-grade persistent 차단**은 v0.23+ 에서 KV / DO / D1 또는 Cloudflare Rate Limiting API 로 재논의.

---

## 7. 정적 검사 결과

| 검사 | 명령 | 결과 |
|---|---|---|
| node syntax | `node --check workers/ws3-telegram-canary-worker.js` | SYNTAX_OK |
| HTML env-key 직접 포함 | `grep WS3_TELEGRAM_BOT_TOKEN\|WS3_TELEGRAM_CHAT_ID web/...html` | 0건 |
| Worker 민감 출력 | `grep console.log.*TOKEN\|CHAT\|first-4\|last-4\|masked\|redacted workers/...js` | 0건 |

---

## 8. 정책 준수 확인

- [x] 실제 Telegram API 호출 0건 (mock fetchImpl 만)
- [x] Cloudflare deploy 0건
- [x] Cloudflare secret 설정 0건
- [x] 기존 worker.js 수정 0건
- [x] 기존 index.html 수정 0건
- [x] manifest.json / service-worker.js / wrangler.toml 수정 0건
- [x] WS3_CODE_CONTRACT.md / WS3_WORKFLOW_TEMPLATE.md 수정 0건
- [x] 기존 v3 엔진 (25종) 수정 0건
- [x] .claude/ add 0건
- [x] commit / push 미실행 (Gate 2 끝까지 staging 0건)
- [x] PR / main merge 0건
- [x] authorized_at ISO 사용 0건 (`parseInt(.., 10)` millisecond timestamp 만)
- [x] file:// production 채택 0건
- [x] token / chatId 실제 값 출력 0건
- [x] masked / first-4 / last-4 / redacted 0건
- [x] Origin allowlist 실제 값 출력 0건
- [x] raw Telegram response 노출 0건 (extractSafeBody whitelist 만)

---

## 9. v0.20 / v0.21 호출 흐름

Worker 의 `/send-canary` 핸들러 내부:

```text
1. Origin allowlist 검증
2. Content-Type / Content-Length / JSON parse 검증
3. invoke token throttle 검사 (per-process best effort)
4. X-WS3-Canary-Token header 존재 검사
5. buildMinimalPreflightGate() → v0.19 PREFLIGHT_READY 가정 fixture
6. RuntimeStateAdapter.build({ liveExecutionPreflightGate: preflight }) → v0.20 result
7. TelegramCanarySender.dispatchCanary({ secureRuntimeStateAdapterResult: v20Result, runtimeEnv, headers, manualTrigger, messageType }, deps)
8. result.ok → SENT 매핑 / result.errorCode → mapErrorCodeToWeb()
9. invoke token mismatch 발생 시 worker-level counter 증가
```

deps 는 worker 내부에서만 생성하며 production fetch handler 는 deps 인자를 받지 않는다. smoke test 만 4번째 인자로 mock deps 주입.

---

## 10. 남은 작업

- **실제 1회 canary 발송 staging test** (사용자 별도 승인 후 진행): deps.fetchImpl = production fetch + Cloudflare secrets (BOT_TOKEN / CHAT_ID / CANARY_ENABLED / CANARY_AUTHORIZED_AT / CANARY_INVOKE_TOKEN / CANARY_ALLOWED_ORIGINS) 설정 후 web console 에서 manualTrigger=true + invoke token 1회 → 1회 송신 → safe result 확인.
- **wrangler-canary.toml** 작성 (deploy 단계 별도).
- **Cloudflare Worker ES module 변환** (bundler 단계 별도, 본 파일은 CommonJS `module.exports` + `default.fetch` 형태).
- **v0.23+ persistent state 차단**: KV / Durable Object / D1 또는 Cloudflare Rate Limiting API 기반 invoke token mismatch 차단 / rate limit / circuit breaker / alreadySent 영속화.
- **v0.22 commit / push**: Gate 3 사용자 별도 승인 후 별도 단계에서 진행.

---

## 11. 기준 commit

- branch: `claude/heuristic-cori-7865e7`
- 이전 functional baseline: WS3 v0.21.0 telegramCanarySender (`9f05ee6`)
- 본 commit: (Gate 3 승인 후 별도 기록 — 본 Gate 2 단계 commit 0건)
