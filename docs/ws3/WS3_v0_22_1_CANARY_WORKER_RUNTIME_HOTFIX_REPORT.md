# WS3 v0.22.1 — Canary Worker Runtime Hotfix Report

## Context

Gate 5 staging reached the real dispatch path, then returned `500 UNKNOWN_ERROR`.

Observed safe signals:

```text
/health OK
OPTIONS preflight OK
fake invoke token POST -> 403 INVOKE_TOKEN_MISMATCH
real invoke token POST -> 500 UNKNOWN_ERROR
Telegram group message not received
```

This points away from Origin/CORS and invoke token entry, and toward the Cloudflare runtime dependency path used just before or during `dispatchCanary()`.

## Scope

Changed:

```text
workers/ws3-telegram-canary-worker.js
docs/ws3/WS3_v0_22_1_CANARY_WORKER_RUNTIME_HOTFIX_REPORT.md
```

Not changed:

```text
worker.js
index.html
manifest.json
service-worker.js
wrangler.toml
docs/ws3/WS3_CODE_CONTRACT.md
docs/ws3/WS3_WORKFLOW_TEMPLATE.md
v3/
```

## Hotfix

The worker no longer passes raw global runtime functions directly into the v0.21 sender. It resolves runtime dependencies through worker-local wrappers:

```text
fetchImpl -> safeFetch
AbortControllerImpl -> SafeAbortController
setTimeoutImpl -> safeSetTimeout
clearTimeoutImpl -> safeClearTimeout
```

The wrappers avoid unbound global references in Cloudflare runtime and convert worker dependency failures into safe response codes.

Added safe worker codes:

```text
WORKER_DEP_FETCH_FAILED
WORKER_DEP_TIMER_FAILED
WORKER_DEP_ABORT_CONTROLLER_FAILED
WORKER_DISPATCH_THROWN
WORKER_RESPONSE_MAP_FAILED
```

No error message, stack, Telegram URL, token, chat id, message id, or raw Telegram response is returned or logged.

## Verification

Actual Telegram calls: 0.

Mock-only checks:

```text
normal mock -> 200 CANARY_SENT
fake token -> 403 INVOKE_TOKEN_MISMATCH
timer wrapper throw -> 500 WORKER_DEP_TIMER_FAILED
fetch wrapper throw -> 502 TELEGRAM_NETWORK_ERROR
AbortController unavailable mock -> 500 WORKER_DEP_ABORT_CONTROLLER_FAILED
raw response leak -> 0
```

Static check:

```text
node --check workers/ws3-telegram-canary-worker.js -> OK
```

## Final Live Canary Result

- actual Telegram canary: SUCCESS, 1 send only
- response code: CANARY_SENT
- httpStatus: 200
- messageType: CANARY_TEST_ONLY
- fixedMessageUsed: true
- Telegram received fixed 5-line message exactly
- cleanup completed after success
- CANARY_ENABLED=false after test
- raw Telegram response not recorded
- token/chatId/invoke token not recorded
- message_id not recorded

## Next

v0.23 should cover production-grade enforcement: persistent alreadySent, persistent invoke-token failure counter, cleanup automation, and production Web Console hosting policy.
