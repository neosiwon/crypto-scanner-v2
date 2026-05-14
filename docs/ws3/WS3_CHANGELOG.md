# WS3 Changelog

## WS3 v0.2.0-a · Bithumb 입력 골격

Status: Frozen

### Added
- `/v3/v3-bithumb-client.js`
- `/v3/v3-candle-normalizer.js`

### Confirmed
- Bithumb candle proxy endpoint returns `{ candles: [...] }`.
- Candle raw fields: `time/open/close/high/low/volume`.
- `/bithumb/markets` is unsupported.
- `fetchBithumbMarkets()` is an unsupported placeholder.
- `joinProxyPath()` prevents proxyBaseUrl trailing slash issues.
- `normalizeCandle()` supports Object raw only.
- Array raw is blocked with `INVALID_FORMAT`.
- `tradeValue` fallback uses `close × volume`.

### Not included
- No `v3-index.html`
- No Worker
- No UI
- No Telegram
- No snapshot
- No score
- No indicator calculation
- No structureBucket
- No signalCycle

## WS3 v0.1.0 · 초기 골격

Status: Frozen

### Added
- `/v3/v3-config.js`
- `/v3/v3-feature-payload.js`

### Confirmed
- Config and payload contract only.
- No runtime scan logic.
- No scoring logic.
- No UI.
