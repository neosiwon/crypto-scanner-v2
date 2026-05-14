# WS3 v0.2.0-a · Q.A Proxy Response Samples

## Candles endpoint

URL:

```text
https://exchange-proxy-worker-v2.neosiwon.workers.dev/bithumb/candles?market=KRW-BTC&count=5
```

Confirmed response:

```json
{
  "candles": [
    {
      "time": 1778649600000,
      "open": 120078000,
      "close": 120056000,
      "high": 120079000,
      "low": 120022000,
      "volume": 2.34019516
    },
    {
      "time": 1778650200000,
      "open": 120056000,
      "close": 120000000,
      "high": 120073000,
      "low": 120000000,
      "volume": 2.71363708
    },
    {
      "time": 1778650800000,
      "open": 120018000,
      "close": 120019000,
      "high": 120035000,
      "low": 119991000,
      "volume": 0.91714082
    },
    {
      "time": 1778651400000,
      "open": 120019000,
      "close": 119989000,
      "high": 120035000,
      "low": 119908000,
      "volume": 1.91354076
    },
    {
      "time": 1778652000000,
      "open": 119989000,
      "close": 119935000,
      "high": 119990000,
      "low": 119910000,
      "volume": 0.09412625
    }
  ]
}
```

## Markets endpoint

URL:

```text
https://exchange-proxy-worker-v2.neosiwon.workers.dev/bithumb/markets
```

Confirmed response:

```json
{"error":"Not found: /bithumb/markets"}
```

## Decisions

- Candles endpoint is usable.
- Candle response shape is `{ candles: [...] }`.
- Candle raw type is Object.
- Fields are `time/open/close/high/low/volume`.
- No trade value field exists.
- `tradeValue` is estimated as `close × volume`.
- `tradeValueSource = estimated_close_volume`.
- Markets endpoint is unsupported.
- `fetchBithumbMarkets()` remains an unsupported placeholder.
