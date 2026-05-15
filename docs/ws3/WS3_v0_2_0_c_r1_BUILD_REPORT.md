# WS3 v0.2.0-c-r1 buildFeaturePayload Builder 완료 보고

> **작업일자**: 2026-05-16
> **이전 baseline**: WS3 v0.2.0-b-r2 (`04eac43`)
> **branch**: `claude/heuristic-cori-7865e7`
> **작업 성격**: builder 본체 작성 + 문서 갱신. 보호 파일 수정 0건.

---

## 생성 파일

- `/v3/v3-feature-payload-builder.js` — **이번 단계의 핵심 산출물**
- `/docs/ws3/WS3_v0_2_0_c_r1_BUILD_REPORT.md` (이 파일)

## 갱신 파일

- `/docs/ws3/WS3_CHANGELOG.md` — `[v0.2.0-c-r1]` 엔트리 상단 추가
- `/docs/ws3/WS3_CURRENT_BASELINE.md` — 완료된 단계 표 + 보호 파일 목록 + 다음 단계 갱신

## 수정 0건 (보호 파일)

```text
v3/v3-feature-payload.js       (build 함수 throw 유지)
v3/v3-config.js
v3/v3-bithumb-client.js
v3/v3-candle-normalizer.js
v3/v3-indicators.js
index.html
manifest.json
service-worker.js
docs/ws3/WS3_CODE_CONTRACT.md  (b-r2 박제본 그대로)
```

`git diff` 빈 출력 확인 완료.

---

## 적용된 DP 정책 (확정)

| ID | 정책 | 적용 위치 |
|---|---|---|
| **DP-1** | ts 우선순위: `marketCtx.ts` > primary candle.ts > `null`. `Date.now()` 금지 | `resolveTs()` ([line 200](v3/v3-feature-payload-builder.js:200)) |
| **DP-2** | canonical `tradeValue`만 외부 노출. alias 금지 | builder 전체 — `payload.candles[*].tradeValue` 만, `payload.volume`에 alias 키 추가 안 함 |
| **DP-3** | 별도 파일 신규. `v3-feature-payload.js` 미수정 | `v3/v3-feature-payload-builder.js` 신규 생성 |
| **DP-4** | validator 현행 유지. `createEmpty` 기반 13 key 보장 | `buildFeaturePayload()` step 1 ([line 287](v3/v3-feature-payload-builder.js:287)) |
| **DP-5** | `normalizeIdentity` helper. `'KRW-BTC'` → `quote='KRW'` / `base='BTC'` | `normalizeIdentity()` ([line 110](v3/v3-feature-payload-builder.js:110)) |
| **DP-6** | `V3BuildMarketCtx` typedef. 안전 정규화 (throw 없이 fallback) | typedef 상단 + `buildFeaturePayload` 전반 |
| **DP-7** | `raw.builderDebug` 디버그 보조 구조 | builderDebug 초기화 ([line 312](v3/v3-feature-payload-builder.js:312)) + 마지막 부착 |
| **U-1** | `currentTradeValueKrw / avgTradeValueKrw / tradeValueRatio` 키는 v3-indicators.js 결과 그대로 보존 (참고 사항) | `mapIndicatorSnapshot()` — `ind.volume` / `ind.tradeValue` 객체 통째 매핑 |
| **U-2** | `V3BuildCandlesInput` typedef. 5 timeframe 객체 입력. 단일 배열 X | `normalizeCandlesInput()` ([line 169](v3/v3-feature-payload-builder.js:169)) |

---

## indicator snapshot 분리 매핑

`WS3Indicators.buildIndicatorSnapshot()` 반환 `{ valid, indicators, warnings, debug }` 을 payload 4 슬롯에 분리:

| payload slot | 매핑 키 (snapshot.indicators) |
|---|---|
| `payload.momentum` | `rsi` / `mfi` / `obv` / `ma` |
| `payload.volume` | `volume` / `volumeAcceleration` / `tradeValue` |
| `payload.structure` | `candleShape` / `candleStructure` / `structure` |
| `payload.indicators` | `atr` / `snapshotValid` / `warnings` / `debug` / `indicatorVersion` |

ATR은 변동성 지표라 momentum/volume/structure 어디에도 자연스럽게 안 맞아 `payload.indicators` 메타 슬롯에 위치. snapshot의 `valid` 는 `snapshotValid` 로 키 변경.

---

## 검증 결과

### node --check
```
OK_BUILDER
```

### smoke test (h1 60개 synthetic candle)
```
keys === 13:               true
isValid:                   true
m5 Array:                  true
m15 Array:                 true
h1 Array:                  true
h4 Array:                  true
d1 Array:                  true
quote string:              true
exchange string:           true
ts === last h1 ts:         true   (1778862000000 = 1778649600000 + 59 * 3600000)
buyPressure unchanged:     true   ('BUY_PRESSURE_UNKNOWN')
```

### identity 분해 검증 (DP-5)
- 입력: `{ market: 'KRW-BTC', exchange: 'BITHUMB' }`
- 출력: `{ base: 'BTC', quote: 'KRW', market: 'KRW-BTC', exchange: 'BITHUMB', displayName: 'BTC' }`

### builderDebug 검증 (DP-7)
- `resolvedTsSource: 'primary.last.ts'` (DP-1 우선순위 2 적용)
- `candleCounts: { m5: 0, m15: 0, h1: 60, h4: 0, d1: 0 }`
- `warnings: []` (정상 입력 시)

### slot 분리 매핑 검증
- `momentum keys: [rsi, mfi, obv, ma]` (4종)
- `volume keys: [volume, volumeAcceleration, tradeValue]` (3종)
- `structure keys: [candleShape, candleStructure, structure]` (3종)
- `indicators keys: [atr, snapshotValid, warnings, debug, indicatorVersion]` (5종)

### 안전성 검증 (null input)
- `WS3_FeaturePayload_Builder.build(null, null)` → `isValid: true` (throw 없이 safe payload 반환)
- `warnings: ['INVALID_CANDLES_SHAPE', 'MISSING_MARKET', 'EMPTY_PRIMARY_CANDLES']` 정확 기록

### 금지 패턴 grep 결과
| 패턴 | 매치 수 | 비고 |
|---|---|---|
| `Date.now(` | 3 | 모두 **주석** (line 15 / 30 / 200) — DP-1 금지 명시 |
| `fetch(` | 0 | 코드 침범 0건 |
| `delete payload.\|skipPlaceholders\|omitNullSlots` | 0 | 13 key 보존 정책 준수 |
| `payload.(candles\|volume).*(value\|amount\|quoteVolume)` | 0 | DP-2 alias 노출 금지 준수 |
| `document.\|localStorage\|sessionStorage\|XMLHttpRequest` | 1 | 주석 (line 30) 금지 명시 — 코드 침범 0건 |

→ **코드 침범 0건**, 모든 매치는 셀프-도큐멘팅 주석.

### 보호 파일 diff
```
git diff -- v3/v3-config.js v3/v3-feature-payload.js v3/v3-bithumb-client.js \
            v3/v3-candle-normalizer.js v3/v3-indicators.js \
            index.html manifest.json service-worker.js
(빈 출력)
```
→ **0건 변경**.

---

## 미구현 항목 (이번 단계 의도된 제외)

- **buyPressure 계산** — createEmpty default `BUY_PRESSURE_UNKNOWN` 유지 (v0.3 이후)
- **marketContext 라벨링** — createEmpty default `'UNKNOWN'` 유지 (v0.3 이후 별도 단계)
- **scoreBreakdown / grade** — v0.3.0
- **structureBucket 최종 판정** — v0.4.0
- **signalCycle / persistence** — v0.5.0
- **strategyBias / entryPlan / exitPlan** — v0.6.0
- **UI / CardViewModel** — v0.7.0
- **Telegram / snapshot / evaluation** — v0.8.0
- **externalConfluence / LW activeCycle** — v0.9.x+

---

## DECISION_PENDING 해소 결과

| DP | 결정 | 결과 |
|---|---|---|
| DP-1 | ✅ 확정 (Gate 1 사용자 승인) | 우선순위 적용 / Date.now 금지 |
| DP-2 | ✅ 확정 | canonical only / alias 금지 |
| DP-3 | ✅ 확정 | DP-3-A 별도 파일 |
| DP-4 | ✅ 확정 | DP-4-A 현행 validator |
| DP-5 | ✅ 확정 | DP-5-C normalizeIdentity |
| DP-6 | ✅ 확정 | DP-6-B typedef + 안전 정규화 |
| DP-7 | ✅ 확정 | raw.builderDebug 도입 |

> b-r2 박제본 `WS3_CODE_CONTRACT.md` §8의 DP-1/2/3 + 본 단계 신규 DP-4/5/6/7 모두 해소. CODE_CONTRACT 본문은 본 단계에서 수정하지 않음. r2.1 박제 여부는 별도 결정.

---

## 다음 단계

```text
WS3 v0.3.0 — scoreBreakdown 본체
  목적: v3FeaturePayload 13 top-level field 입력 → 100점 점수 계산
        - 코어 25 + 구조 20 + 거래량 20 + 모멘텀 15 + 실행 20 = 100
        - riskPenalty 최대 15 차감
  기준 문서: WS3_CODE_CONTRACT.md (b-r2 박제본)
  builder 산출 payload 구조 의존: 본 단계 v3-feature-payload-builder.js
```

---

## 한 줄 결론

```
b-r2 WS3_CODE_CONTRACT.md를 단일 기준으로,
v3/v3-feature-payload-builder.js 신규 생성하여 V3FeaturePayload 13 field 조립 완성.
보호 파일 9종 무손상 / isValid 통과 / DP-1~DP-7 + U-1/U-2 모두 적용 / smoke 안전성 검증 통과.
buyPressure / marketContext 라벨링은 의도된 제외 — v0.3 이후 단계로 보류.
```
