# WS3 Current Baseline

## Current baseline
WS3 v0.2.0-a · Bithumb 입력 골격

## Frozen files

### v0.1.0
- `/v3/v3-config.js`
- `/v3/v3-feature-payload.js`

### v0.2.0-a
- `/v3/v3-bithumb-client.js`
- `/v3/v3-candle-normalizer.js`

## Confirmed decisions

- V3 is independent from existing WOOS v5.x.
- Existing `index.html` must not be modified for WS3 v0.1.0/v0.2.0-a.
- `v3-index.html` is not created yet.
- Worker / Telegram / UI / score / indicator / structure logic are not implemented yet.
- Bithumb candles endpoint confirmed:
  `/bithumb/candles?market=KRW-BTC&count=5`
- Response shape:
  `{ candles: [{ time, open, close, high, low, volume }] }`
- `/bithumb/markets` is unsupported as of v0.2.0-a.
- `fetchBithumbMarkets()` remains an unsupported placeholder.
- `tradeValue` is estimated as `close × volume`.
- `tradeValueSource = estimated_close_volume`.
- `proxyBaseUrl` trailing slash is normalized by `joinProxyPath()` in `v3-bithumb-client.js`.

## Next step
WS3 v0.2.0-b · indicator function skeleton
