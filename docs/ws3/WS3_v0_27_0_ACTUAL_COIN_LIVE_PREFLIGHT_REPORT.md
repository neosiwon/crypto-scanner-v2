# WS3 v0.27.0 — Actual Coin Live Preflight 완료 보고

**작성일**: 2026-05-18
**branch**: `claude/heuristic-cori-7865e7`
**이전 functional baseline**: WS3 v0.26.1 Dev Preview Lightweight Invite Gate + Pages Deploy Success (`81964bf`)
**본 단계 산출**: 1 worker 보강 + 2 console 동기화 수정 + 1 신규 보고서 + 2 문서 갱신 (5 staged)

---

## 1. 목표 (실코인 자동 알람 아님)

v0.27 은 **실 거래소 공개 시세 데이터를 read-only 1회 fetch + 정규화 preview** 단계.

- 실 Telegram 알람 발송 0건
- 실 KV write 0건
- candidate 저장 0건
- snapshot / evaluation / audit 저장 0건
- tracking 시작 0건
- Send Canary / Cleanup Confirm / Operator Reset 호출 0건
- `CANARY_ENABLED=true` / `AUTHORIZED_AT` 변경 0건
- Cloudflare deploy 0건 (코드 단계만)
- 실 거래소 API 호출 0건 (mock fetch 만, 별도 staging Gate 에서 실 호출)

한 줄 정의: **v0.27 = 실코인 데이터 연결 전 read-only live data preflight layer.**

---

## 2. v0.26.1 dependency 완료 상태 (입력)

```text
Pages project: ws3-canary-console (production URL active)
Lightweight invite gate: active (placeholder 박제, 사용자 deploy 시 실 hash 주입)
Worker allowlist: https://ws3-canary-console.pages.dev only
localhost origin: removed
CANARY_ENABLED=false / AUTHORIZED_AT=0 유지
final production Check State: PASS (currentPhase=RESET_CONFIRMED)
```

---

## 3. 신규 endpoint

### 3.1 `POST /live-preflight`

read-only 공개 시세 데이터 preview 전용. KV / Telegram / candidate 와 무관.

### 3.2 OPTIONS allowlist 확장

`OPTIONS /live-preflight` 추가 (기존 6 path 외):
```
/health / /send-canary / /state / /cleanup-confirm / /operator-reset / /live-preflight
```

### 3.3 인증 정책 (3중)

| # | 조건 | 위반 시 |
|---|---|---|
| 1 | Origin allowlist 통과 | `ORIGIN_MISSING` 403 / `ORIGIN_NOT_ALLOWED` 403 |
| 2 | `X-WS3-Canary-Token === env.WS3_CANARY_INVOKE_TOKEN` exact | `MISSING_INVOKE_TOKEN` 401 / `INVOKE_TOKEN_MISMATCH` 403 |
| 3 | `body.manualTrigger === true` | `MANUAL_TRIGGER_REQUIRED` 400 |

`/state` 와 동일 인증 layer 재사용. KV / circuit / persistent guard 미사용.

---

## 4. request body 스펙

```json
{
  "manualTrigger": true,
  "exchange": "upbit",
  "market": "KRW-BTC",
  "timeframe": "5m",
  "limit": 30
}
```

### 4.1 input 검증

- `exchange`: allowlist `['upbit', 'bithumb', 'binance']`. case-insensitive 입력 받아 lowercase 정규화.
- `market`: 정규식 `^[A-Za-z0-9_\-]{2,32}$`. exchange-native format 그대로 (upbit=`KRW-BTC`, bithumb=`BTC_KRW`, binance=`BTCUSDT`).
- `timeframe`: allowlist `['1m', '5m', '15m', '1h']`.
- `limit`: integer in `[1, 60]`. 비-integer / 범위 외 모두 `LIVE_PREFLIGHT_LIMIT_EXCEEDED`.
- single market only. batch scan 금지. auto refresh 금지.

---

## 5. exchange URL 매핑

| exchange | timeframe → unit | URL |
|---|---|---|
| upbit | 1m→1 / 5m→5 / 15m→15 / 1h→60 | `https://api.upbit.com/v1/candles/minutes/{unit}?market={market}&count={limit}` |
| bithumb | 1m / 5m / 15m / 1h (path-based) | `https://api.bithumb.com/public/candlestick/{market}/{interval}` |
| binance | 1m / 5m / 15m / 1h | `https://api.binance.com/api/v3/klines?symbol={market}&interval={interval}&limit={limit}` |

market 은 사용자가 exchange-native 형식 그대로 입력하며, 서버는 정규식 sanitize 만 수행 (encoder 가 변환하지 않음).

---

## 6. normalize / summarize

### 6.1 normalizeCandles(exchange, raw, limit)

raw exchange JSON → uniform `[{ time, open, high, low, close, volume }]` (oldest → latest 정렬).

- **upbit**: 응답이 latest-first 이므로 `slice().reverse()` 후 limit 만큼 선두에서 추출.
- **bithumb**: `raw.status === '0000'` 확인 + `raw.data` 가 oldest-first 6-tuple `[ts_ms, open, close, high, low, volume]` → 끝에서 limit 만큼 추출.
- **binance**: `raw` 가 oldest-first kline 배열 `[openTime, open, high, low, close, volume, ...]` → 선두에서 limit 만큼 추출.

각 필드 `Number(...)` + `isFinite` 검증, 시간은 ISO `Z` form 으로 표준화. 어떤 필드든 invalid 시 `LIVE_PREFLIGHT_PARSE_ERROR`. 응답이 빈 배열이면 `LIVE_PREFLIGHT_EMPTY_CANDLES`.

### 6.2 summarizeCandles(candles)

```text
candleCount   = candles.length
latestTime    = candles[n-1].time
lastClose     = candles[n-1].close
prevClose     = candles[n-2].close   (n<2 일 때 fallback: candles[n-1].open)
changePct     = (lastClose - prevClose) / prevClose * 100   (prevClose=0 일 때 0)
lastVolume    = candles[n-1].volume
avgVolume     = sum(volumes) / n
volumeRatio   = lastVolume / avgVolume   (avgVolume=0 일 때 0)
```

raw exchange 응답의 native field 는 어떤 것도 response 본문에 노출되지 않음 (whitelist 통과 필드만).

---

## 7. response 정책

### 7.1 성공 (200 / `LIVE_PREFLIGHT_OK`)

```json
{
  "ok": true,
  "status": "OK",
  "code": "LIVE_PREFLIGHT_OK",
  "httpStatus": 200,
  "version": "WS3_v0.27.0_actual_coin_live_preflight",
  "mode": "LIVE_PREFLIGHT_ONLY",
  "exchange": "upbit",
  "market": "KRW-BTC",
  "timeframe": "5m",
  "limit": 30,
  "normalized": {
    "candleCount": 30,
    "latestTime": "...Z",
    "lastClose": ...,
    "prevClose": ...,
    "changePct": ...,
    "lastVolume": ...,
    "avgVolume": ...,
    "volumeRatio": ...
  },
  "safety": {
    "telegramSent": false,
    "kvWritten": false,
    "candidateStored": false,
    "trackingStarted": false
  }
}
```

### 7.2 반환 금지 (whitelist 외 0건)

```text
raw exchange full response (candle_date_time_kst, opening_price 등 native field)
secret / token / chatId / bot_token / Telegram message_id
KV namespace ID
full headers / stack trace / internal exception message
Origin 실제 값 / IP
```

mock smoke S15 / S16 으로 raw native field 노출 0건 + invoke token body 노출 0건 검증.

---

## 8. safe code (신규 11종)

| code | HTTP | 의미 |
|---|---|---|
| `LIVE_PREFLIGHT_OK` | 200 | preflight 성공 |
| `LIVE_PREFLIGHT_DISABLED` | (예약) | future env-gated disable |
| `LIVE_PREFLIGHT_INVALID_EXCHANGE` | 400 | allowlist 외 exchange |
| `LIVE_PREFLIGHT_INVALID_MARKET` | 400 | market 정규식 위반 |
| `LIVE_PREFLIGHT_INVALID_TIMEFRAME` | 400 | allowlist 외 timeframe |
| `LIVE_PREFLIGHT_LIMIT_EXCEEDED` | 400 | limit 비-integer / 범위 외 |
| `LIVE_PREFLIGHT_FETCH_TIMEOUT` | 504 | 5초 abort |
| `LIVE_PREFLIGHT_NETWORK_ERROR` | 502 | fetch reject / HTTP 비-2xx |
| `LIVE_PREFLIGHT_PARSE_ERROR` | 502 | json parse 실패 또는 필드 invalid |
| `LIVE_PREFLIGHT_EMPTY_CANDLES` | 502 | 빈 캔들 배열 |
| `LIVE_PREFLIGHT_UNSUPPORTED_SOURCE` | 400 | URL build 실패 |

기존 v0.25 / v0.26.1 safe code 모두 유지.

---

## 9. no-write 구조 보장

`/live-preflight` 핸들러 scope 내 grep 검증 (별도 자동 검사):

- `writeAlreadySent` / `writeCleanupRequired` / `writeCircuit` / `writeInvokeFail` / `writeOperatorReset` / `markAlreadySentReset` / `KV_BINDING_NAME` / `env[` — 매치 **0건**
- `sendCanary` / `dispatchCanary` / `sendMessage` 호출 — 매치 **0건**
- "Telegram" 키워드 — 핸들러 헤더 코멘트 단일 라인만 매치 (`// POST /live-preflight  (v0.27 — read-only public market data preview; NO Telegram, NO KV write, NO candidate store)`) — 실 API 호출 0건

`env[KV_BINDING_NAME]` 도 핸들러 내부 미참조 — KV binding 자체에 접근 안 함.

---

## 10. fetch / abort / timeout

`buildWorkerRuntimeDeps` 의 기존 deps 패턴 재사용:
- `deps.fetchImpl` (production: `globalThis.fetch`, smoke: mock)
- `deps.AbortControllerImpl`
- `deps.setTimeoutImpl` / `deps.clearTimeoutImpl`

`fetchLiveCandles(deps, url, 5000)`:
- 5초 timer → `controller.abort()`
- abort 발생 시 `LIVE_PREFLIGHT_FETCH_TIMEOUT`
- 그 외 reject → `LIVE_PREFLIGHT_NETWORK_ERROR`
- HTTP 비-2xx → `LIVE_PREFLIGHT_NETWORK_ERROR`
- `resp.json()` 실패 → `LIVE_PREFLIGHT_PARSE_ERROR`

Telegram sender 의 5초 timeout 정책과 동일 (v0.21+).

---

## 11. mock smoke 결과 (16 시나리오 — 14 spec + 2 leak guard)

```
TOTAL=16 PASS=16 FAIL=0
```

| # | 시나리오 | 결과 |
|---|---|---|
| S1 | no token → 401 MISSING_INVOKE_TOKEN | ✅ |
| S2 | bad token → 403 INVOKE_TOKEN_MISMATCH | ✅ |
| S3 | missing manualTrigger → 400 MANUAL_TRIGGER_REQUIRED | ✅ |
| S4 | invalid exchange → 400 LIVE_PREFLIGHT_INVALID_EXCHANGE | ✅ |
| S5 | invalid timeframe → 400 LIVE_PREFLIGHT_INVALID_TIMEFRAME | ✅ |
| S6 | limit > 60 → 400 LIVE_PREFLIGHT_LIMIT_EXCEEDED | ✅ |
| S7 | invalid market → 400 LIVE_PREFLIGHT_INVALID_MARKET | ✅ |
| S8 | upbit mocked success → 200 LIVE_PREFLIGHT_OK / mode=LIVE_PREFLIGHT_ONLY / candleCount=30 / safety.{telegramSent,kvWritten,candidateStored,trackingStarted} 모두 false | ✅ |
| S9 | empty candles → 502 LIVE_PREFLIGHT_EMPTY_CANDLES | ✅ |
| S10 | network error → 502 LIVE_PREFLIGHT_NETWORK_ERROR | ✅ |
| S11 | fetch timeout (AbortError) → 504 LIVE_PREFLIGHT_FETCH_TIMEOUT | ✅ |
| S12 | parse error (json reject) → 502 LIVE_PREFLIGHT_PARSE_ERROR | ✅ |
| S13 | Telegram fetch count 0 across all scenarios | ✅ tg=0 |
| S14 | KV put/delete count 0 | ✅ put=0 del=0 |
| S15 | raw exchange native field (candle_date_time_kst / opening_price / candle_acc_trade_price) leak | ✅ CLEAN |
| S16 | invoke token leak in body | ✅ CLEAN |

실제 거래소 API 호출 **0건** (mock fetchImpl 만). 실제 KV API 호출 **0건** (mock KV null).

---

## 12. Web Console 보강

### 12.1 신규 Section 6 "Live Preflight (v0.27 read-only)"

input controls:
- Exchange select (upbit / bithumb / binance)
- Market text input (autocomplete=off / autocorrect=off / autocapitalize=off / spellcheck=false / maxlength=32, default `KRW-BTC`)
- Timeframe select (1m / 5m / 15m / 1h, default 5m)
- Limit text input (inputmode=numeric / pattern=[0-9]* / maxlength=2, default 30)
- Run Live Preflight 버튼

output panel (whitelist 12 fields):
- code / exchange / market / timeframe / candleCount / latestTime / lastClose / changePct / volumeRatio / mode / telegramSent / kvWritten

표시 금지: raw exchange response / full headers / stack trace / token / secret / resetCount / KV namespace ID / Telegram message_id / bot token / chatId.

### 12.2 클릭 정책

- 사용자 버튼 클릭시에만 1회 fetch
- auto refresh 0건
- 페이지 로드 시 자동 호출 0건
- 1.5초 throttle (`lpRunBtn.disabled = true; setTimeout(..., 1500)`)
- token 은 `readTokenAndClear()` 패턴 — 요청 직후 input 즉시 클리어

### 12.3 정규식 sanitize (client-side)

- market: `^[A-Za-z0-9_\-]{2,32}$` (server-side 정규식과 일치)
- limit: `^[0-9]{1,2}$` 정규식 통과 후 `parseInt` → `[1, 60]` 범위 검사
- 어떤 sanitize 실패도 클라이언트가 safe code 만 표시 (실제 fetch 차단)

### 12.4 두 파일 byte-for-byte mirror

`web/ws3-canary-console.html` / `web/ws3-canary-console/index.html` 모두 641 → 791 라인 (+150), 25087 → 33380 bytes. `diff -q` 결과 0건 확인.

---

## 13. 보호 파일 무손상

`git diff --stat HEAD -- worker.js wrangler.toml index.html manifest.json service-worker.js docs/ws3/WS3_CODE_CONTRACT.md docs/ws3/WS3_WORKFLOW_TEMPLATE.md v3/ workers/ws3-canary-state-kv-adapter.js wrangler-canary.example.toml .gitignore` → 빈 출력 = **0건** ✅

- 본선 `worker.js` / `wrangler.toml` (repo 미존재) / `index.html` / `manifest.json` / `service-worker.js` — 미수정
- `v3/` 25종 엔진 (telegram canary sender / secure runtime state adapter / bithumb client / etc.) — 미수정
- `docs/ws3/WS3_CODE_CONTRACT.md` / `WS3_WORKFLOW_TEMPLATE.md` — 미수정
- `workers/ws3-canary-state-kv-adapter.js` — 미수정 (v0.25.0 그대로)
- `wrangler-canary.example.toml` / `.gitignore` — 미수정
- `workers/ws3-telegram-canary-entry.mjs` — 미스테이지 유지 (untracked, 변경 0건)

---

## 14. 보안 / 누출 검증

- bot token / chatId / invoke token 실 값 — 코드 / 보고서 / 로그 노출 **0건**
- KV namespace ID — 노출 **0건**
- Telegram message_id / raw Telegram response — 노출 **0건** (smoke S15 raw exchange field leak guard PASS)
- Origin 실 값 / IP / cookie / session id / browser fingerprint — 노출 **0건**
- exchange API raw native field (candle_date_time_kst / opening_price / candle_acc_trade_price 등) — response 본문 노출 **0건**
- masked / first-4 / last-4 / redacted preview — **0건**
- localStorage / sessionStorage / IndexedDB / document.cookie 호출 — **0건** (web grep 매치 4건 모두 정책 부정문맥)
- URL query parameter token 전달 — **0건**
- `console.log` 출력 — **0건**

---

## 15. Cloudflare 변경 0건

- worker 재배포 0건 (v0.25.0 production Version 그대로, v0.27 staging 재배포는 별도 Gate)
- KV namespace 생성/변경 0건
- KV binding 변경 0건
- secrets (BOT_TOKEN / CHAT_ID / INVOKE_TOKEN) 변경 0건
- `WS3_CANARY_ALLOWED_ORIGINS` 변경 0건
- Pages project 생성/배포 0건
- 실 Telegram API 호출 0건
- 실 KV write 0건
- 실 `/live-preflight` 호출 0건 (production / staging 모두)
- 실 거래소 API (api.upbit.com / api.bithumb.com / api.binance.com) 호출 0건

---

## 16. 의도된 미구현 (다음 Gate)

본 commit 까지 = v0.27 코드 / 문서 / mock 검증 만. 실제 deploy / 실 호출은 별도 승인 단계:

- v0.27 Deploy Gate (별도): Worker redeploy (v0.27 production version 반영) + Pages redeploy (필요 시) + production console 에서 `/live-preflight` 1회 호출 검증
- v0.28 후보 A: Live Preflight 결과 기반 basic candle structure preview
- v0.28 후보 B: Actual Coin Candidate Dry-run (후보 계산만, Telegram / KV 0건)
- v0.28 후보 C: Security hardening before live coin stage (Cloudflare Access 재검토 / invoke token rotation / origin allowlist 재검토)
- worker `/state` response 자체에서 `resetCount` 제거 (v0.28+ 후보)
- env-based `LIVE_PREFLIGHT_DISABLED` flag (자동 disable kill switch)
- 그 외: rate limit per origin / market / minute / invoke token rotate automation / ipHash + `WS3_CANARY_HASH_SALT`

---

## 17. v0.27 한계 (재확인)

- 본 단계 = mock smoke only. real 거래소 응답 다양성 (rate limit 응답 / partial data / unusual market suspension) 은 별도 staging Gate 에서 검증.
- `/live-preflight` 인증 = Layer 1 (Origin) + Layer 2 (Invoke Token) + Layer 3 (manualTrigger) — KV persistent guard 미사용. read-only 이므로 abuse 위험 최소화 위해 limit ≤ 60 / single market 제한.
- DNS / 거래소 차단 시 production / staging 환경 차이 가능성 — 별도 검증 필요.

---

## 18. 기준 commit

- branch: `claude/heuristic-cori-7865e7`
- 이전 functional baseline: WS3 v0.26.1 Dev Preview Lightweight Invite Gate + Pages Deploy Success (`81964bf`)
- 본 commit: (push 후 기록, push 별도 승인)

---

## 19. 이번 단계의 핵심 (재인용)

```text
v0.27 = 실코인 자동 알람 아님
v0.27 = read-only live data preflight 단계
실 거래소 공개 시세 1회 fetch + 정규화 preview 만
Telegram 발송 0건 / KV write 0건 / candidate 저장 0건 / tracking 시작 0건
실 거래소 API 호출은 별도 staging Gate (본 commit 까지 mock 만)
실전 스캐너 본체는 v0.28 이후
```

---

## 20. Final Live Validation Result

본 섹션은 v0.27.0 코드 commit (`d3e80b4`) 이후 실제 Cloudflare Worker redeploy + Pages production deploy + production console 에서 Check State + `/live-preflight` 1회 실 호출 검증까지 마친 결과 박제다. 코드 변경 0건 / tracked source 변경 0건 / hash 또는 raw invite code repo 박제 0건 / Telegram 발송 0건 / KV write 0건 / candidate 저장 0건 / tracking 시작 0건.

- Worker deploy: **completed** (Version single fragment `19f89bf6`, `ws3-telegram-canary.neosiwon.workers.dev` 동일 URL, size 136.03 KiB / gzip 21.71 KiB)
- Pages deploy: **completed** (production URL `ws3-canary-console.pages.dev`, `--branch=main`, lightweight invite gate 활성 유지, working copy hash 주입 후 즉시 cleanup, tracked source diff 0건)
- Production console Check State: **succeeded**
  - `version=WS3_v0.27.0_actual_coin_live_preflight`
  - `persistenceAvailable=true`
  - `canaryEnabled=false`
  - `alreadySent=false`
  - `cleanupRequired=false`
  - `circuitOpen=false`
  - `currentPhase=RESET_CONFIRMED`
- Live Preflight actual read-only call: **succeeded** (1회)
  - Exchange: `upbit`
  - Market: `KRW-BTC`
  - Timeframe: `5m`
  - Limit result candleCount: `30`
  - Latest candle time: `2026-05-18T16:35:00Z`
  - Last close: `113892000`
  - Change percent: `0.11075365223353198`
  - Volume ratio: `0.2566780720123906`
  - Result code: `LIVE_PREFLIGHT_OK`
  - Mode: `LIVE_PREFLIGHT_ONLY`
- safety flags:
  - `telegramSent: false`
  - `kvWritten: false`
  - `candidateStored: false`
  - `trackingStarted: false`
- Send Canary count during this gate: **0**
- Cleanup Confirm count during this gate: **0**
- Operator Reset count during this gate: **0**
- Telegram API calls during this gate: **0**
- KV writes during this gate: **0**
- raw exchange full response **not recorded** (raw native field — `candle_date_time_kst` / `opening_price` / `candle_acc_trade_price` 등 — 보고서 / 채팅 / 로그 노출 0건)
- Invoke Token **not recorded**
- raw invite code / SHA-256 hash **not recorded** (placeholder repo 박제 유지, `git grep` repo-wide 노출 폐기 hash 매치 0건)
- KV namespace ID **not recorded**
- deployment ID full value **not recorded** (Version ID 단편 + Pages deployment hash 단편만)

### 20.1 Gate 진행 흐름 박제 (Step A → I)

```text
Step A (자동):  preflight sanity (git/protected diff/wrangler env vars/tracked placeholder)
Step B (자동):  wrangler deploy --config wrangler-canary.toml → Worker v0.27 production version 활성
                  · CANARY_ENABLED=false / AUTHORIZED_AT=0 / ALLOWED_ORIGINS=Pages-only 유지
Step C (자동):  hash reuse 결정 — 이전 세션 SHA-256 재사용, 추가 사용자 입력 요청 0건
Step D (자동):  .tmp_pages_deploy/ws3-canary-console/index.html 생성 (tracked index.html cp)
Step E (자동):  assignment 라인 1건만 hash 교체 (line 237) — comment + placeholder check 라인 2건 보존
Step F (자동):  wrangler pages deploy ... --branch=main → production Pages URL 활성화
Step G (자동):  .tmp_pages_deploy/ 즉시 삭제 + tracked diff 0건 + placeholder 3+3 박제 + 보호 파일 0건 + git grep 노출 폐기 hash 0건 검증
Step H (사용자): production console 접속 → invite code 입력 → console UI 표시 → Worker Endpoint / Invoke Token 입력 → Check State 1회 클릭 → 7-field whitelist PASS
Step I (사용자): Run Live Preflight 1회 클릭 (upbit / KRW-BTC / 5m / limit 30) → LIVE_PREFLIGHT_OK 200 / mode=LIVE_PREFLIGHT_ONLY / candleCount=30 / safety 4 fields 모두 false
```

### 20.2 v0.27 검증 한계 (재인용)

- 본 검증 = 1 isolate / 1 사용자 / 1 market (upbit KRW-BTC 5m) / 단일 timeframe 시퀀스. 다른 exchange (bithumb / binance) / 다른 timeframe / 다른 limit / rate limit 응답 / partial data / market suspension / DNS 차단 — 본 검증 범위 밖.
- `/live-preflight` 인증 = Layer 1 (Origin) + Layer 2 (Invoke Token) + Layer 3 (manualTrigger). KV persistent guard 미사용. read-only 이므로 abuse 위험 최소화 위해 limit ≤ 60 / single market 제한.
- 본 단계 = read-only preflight. candidate 계산 / 점수화 / 후보 저장 / live signal 발송은 v0.28+ 별도 단계.

### 20.3 v0.28+ 다음 단계 후보 (재인용)

```text
v0.28 후보 A: Live Preflight 결과 기반 basic candle structure preview
v0.28 후보 B: Actual Coin Candidate Dry-run (후보 계산만, Telegram / KV 0건)
v0.28 후보 C: Security hardening before live coin stage
                · Cloudflare Access 재검토 / invoke token rotation / origin allowlist 재검토
worker /state response 자체에서 resetCount 제거 (v0.28+)
env-based LIVE_PREFLIGHT_DISABLED kill switch
rate limit per origin / market / minute / invoke token rotate automation / ipHash + WS3_CANARY_HASH_SALT
```
