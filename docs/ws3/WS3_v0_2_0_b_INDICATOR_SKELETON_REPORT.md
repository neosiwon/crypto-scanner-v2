# WS3 v0.2.0-b Indicator Function Skeleton 완료 보고

> **작업일자**: 2026-05-14  
> **기준 백서**: WOOS_Scanner_V3_개발백서_v0_3_3.md  
> **이전 baseline**: WS3 v0.2.0-a

---

## 생성 파일

- `/v3/v3-indicators.js`
- `/docs/ws3/WS3_v0_2_0_b_INDICATOR_SKELETON_REPORT.md`

## 수정 파일 (append/update)

- `/docs/ws3/WS3_CHANGELOG.md`
- `/docs/ws3/WS3_CURRENT_BASELINE.md`

## 보호 파일 미수정 확인

```text
index.html                          미수정
manifest.json                       미수정
service-worker.js                   미수정
worker.js                           미수정
wrangler.toml                       미수정
/v3/v3-config.js                    미수정
/v3/v3-feature-payload.js           미수정
/v3/v3-bithumb-client.js            미수정
/v3/v3-candle-normalizer.js         미수정
/v3/v3-index.html                   생성/수정 X
```

---

## 핵심 설계 원칙 (작업지시서 §2 반영)

✅ MA / EMA / RSI / MFI / OBV / ATR / 거래량 / 거래대금 / 캔들구조 / 박스 / 터치 / 꼬리 기준값 = 전부 config override 가능  
✅ 함수 시그니처 `calculateRSI(candles, config = {})` (period 고정 X)  
✅ `DEFAULT_INDICATOR_CONFIG` 객체로 기본값 집중 관리  
✅ `mergeIndicatorConfig(config)` helper로 override 안전 merge  
✅ 각 함수가 사용한 임계값을 `configUsed`로 반환 (디버깅/추적용)  
✅ v3-config.js로 옮기기 쉬운 구조  
✅ 함수 내부 곳곳에 임계값 흩뿌리지 않음  
✅ 이번 작업에서 `/v3/v3-config.js` 미수정  

---

## 구현 함수 (총 32개)

### Config / 공통 유틸 (12)
- `mergeIndicatorConfig(config)`
- `safeNumber(value, fallback)`
- `getOpen(candle)` / `getHigh(candle)` / `getLow(candle)` / `getClose(candle)` / `getVolume(candle)` / `getTradeValue(candle)`
- `sliceRecent(candles, length)`
- `hasEnoughCandles(candles, minLength)`
- `calculatePctChange(from, to)`
- `calculateAverage(values)`

### 이동평균 MA / EMA (3)
- `calculateSMA(values, period)`
- `calculateEMA(values, period)`
- `calculateMAState(candles, config)` — config.ma.periods/optionalPeriods/trendFlatTolerancePct

### 모멘텀 RSI / MFI (2)
- `calculateRSI(candles, config)` — config.rsi.period/oversold/strong/overbought/overheated
- `calculateMFI(candles, config)` — config.mfi.period/low/buyPressure/strongBuyPressure/overheated

### OBV (2)
- `calculateOBV(candles)` — 원본 series 반환
- `calculateOBVTrend(candles, config)` — config.obv.trendLookback/flatTolerancePct

### ATR (1)
- `calculateATR(candles, config)` — Wilder smoothing, config.atr.period

### 거래량 / 거래대금 (3)
- `calculateVolumeStats(candles, config)` — config.volume.averagePeriod/lowRatio/risingRatio/surgeRatio/extremeRatio
- `calculateVolumeAcceleration(candles, config)` — config.volume.shortPeriod/averagePeriod
- `calculateTradeValueStats(candles, config)` — config.tradeValue.averagePeriod

### 캔들 구조 보조 (3) — 작업지시서 §7
- `calculateCandleShape(candle, config)` — body/wick/range/closePosition/direction/flags
- `calculateCandleShapeSeries(candles, config)` — 시리즈 + wideRange 판정
- `calculateRecentCandleStructure(candles, config)` — 최근 N봉 구조 통계

### 박스 / 구조 보조 Skeleton (5) — structureBucket 확정 X
- `detectRecentHighLowBox(candles, config)`
- `countLevelTouches(candles, level, config)`
- `calculatePriceZone(candles, config)`
- `findReferenceLows(candles, config)` — scalpSwingLow/intradaySwingLow/structuralSwingLow/boxLow/orderBlockLow
- `detectSweepReclaimCandidates(candles, config)`

### 통합 (1)
- `buildIndicatorSnapshot(candles, config)` — 모든 지표 한 번에 + warnings + debug

### 테스트 helper
- `__testIndicatorsWithSampleCandles(sampleCandles, config)` — 자동 실행 X

---

## 캔들패턴 정책 (작업지시서 §7)

✅ 전통 캔들패턴명 (도지/망치형/장악형/샛별형/유성형 등) **구현 X**  
✅ V3에서 캔들패턴 = **structureBucket 판단용 candleStructureFeatures 보조값**  
✅ `direction` (BULLISH/BEARISH/NEUTRAL) + `flags` (longUpperWick/longLowerWick/wideRange/closeNearHigh/closeNearLow)  
✅ structureBucket (BOX_PRESSURE/BOX_BREAKOUT/OB_RECLAIM/LOW_SWEEP_RECLAIM/MA_RECLAIM) **최종 판정 X** → WS3 v0.4.0에서  

---

## 검증 결과

### Syntax / 무결성
- ✅ `node --check` 통과 (1,478 lines)
- ✅ 32개 함수 + 4 상수/helper export

### 절대 원칙 검증 (작업지시서 §9)
- ✅ 외부 API 호출 / `fetch(` — 코드 0개
- ✅ DOM 접근 / `document.` — 코드 0개
- ✅ `localStorage` 접근 — 코드 0개
- ✅ Telegram 접근 — 코드 0개
- ✅ console spam 없음
- ✅ 파일 로드 시 자동 실행 없음
- ✅ 실패 시 throw 대신 `{ valid: false, reason: '...' }` 반환

### 미포함 검증 (작업지시서 §12)
- ✅ externalConfluence — 코드 0개 (주석에만 "미포함" 명시)
- ✅ bithumbOfficial / LW / SeoulKIM — 코드 0개
- ✅ Telegram / news / snapshot — 코드 0개
- ✅ marketCap / sector — 코드 0개
- ✅ strategyBias / entryPlan / exitPlan — 코드 0개
- ✅ scoreBreakdown / grade / signalCycle — 코드 0개
- ✅ cardViewModel / renderer — 코드 0개

### 전통 캔들패턴명 미포함 (작업지시서 §7.4)
- ✅ doji / hammer / engulfing / morningStar / shootingStar — 코드 0개 (주석에만 "X" 명시)

### Config-Driven 검증
- ✅ `calculateRSI(candles, period = 14)` 같은 시그니처 0개
- ✅ 모든 주요 함수가 `(candles, config = {})` 시그니처
- ✅ `mergeIndicatorConfig` helper 사용
- ✅ 각 함수가 `configUsed` 반환 (어떤 기준값으로 계산됐는지 추적)

---

## 입력 데이터 계약 (작업지시서 §5, §6)

`v3-indicators.js`는 `v3-candle-normalizer.js`의 normalized candle 배열을 입력으로 받는다.

예상 필드 (백서 기준):
```js
{
  timestamp, open, high, low, close, volume, value, source: 'BITHUMB'
}
```

**필드명이 다를 경우 안전 처리** (§5 준수):
- `readCandleField(candle, [후보키 배열])` helper로 안전 접근
- 객체 형태 (`close` / `c` / `closePrice` 등 다중 후보)
- 배열 OHLCV 형태 (`[timestamp, open, high, low, close, volume, value?]`) 지원
- 누락 필드는 `null` 처리
- candles 부족 시 `{ valid: false, reason: 'NOT_ENOUGH_CANDLES' }` 반환

→ **실제 v3-candle-normalizer.js의 필드명을 확인한 후 후보 키 배열만 조정하면 됨**. indicator 함수 본체 수정 불필요.

---

## Export 방식 (작업지시서 §13)

```js
// 통합 module 환경 (Node / Workers)
module.exports = api;

// 브라우저 전역 환경
global.WS3Indicators = api;
```

→ **기존 /v3 파일 export 스타일을 임의로 바꾸지 않음**. 환경 자동 감지로 양쪽 모두 지원.

---

## DEFAULT_INDICATOR_CONFIG 박제 기본값

```js
{
  ma: { periods: [10, 20, 50], optionalPeriods: [100, 200], trendFlatTolerancePct: 0.15 },
  ema: { periods: [12, 26] },
  rsi: { period: 14, oversold: 30, neutralLow: 45, neutralHigh: 55, strong: 60, overbought: 70, overheated: 80 },
  mfi: { period: 14, low: 35, neutralLow: 45, buyPressure: 60, strongBuyPressure: 70, overheated: 85 },
  obv: { trendLookback: 10, flatTolerancePct: 0.3 },
  atr: { period: 14 },
  volume: { averagePeriod: 20, shortPeriod: 5, lowRatio: 0.7, risingRatio: 1.2, surgeRatio: 2.0, extremeRatio: 4.0 },
  tradeValue: { averagePeriod: 20 },
  candleStructure: {
    lookback: 40, boxLookback: 40, touchTolerancePct: 0.5,
    longWickRatio: 0.45, wideRangeMultiplier: 1.8,
    closeTopZone: 0.7, closeBottomZone: 0.3,
    sweepTolerancePct: 0.3, reclaimClosePosition: 0.5
  }
}
```

→ **모든 값은 v3-config.js로 이동 가능. 함수 본체 수정 없이 임계값 조정 가능.**

---

## 다음 단계

```text
WS3 v0.2.0-c — buildFeaturePayload 본체 작업

목적: normalized candles + indicator snapshot + meta/context
      → v3FeaturePayload 코드 계약에 맞게 조립
```

이번 단계에서는 indicator snapshot까지만. featurePayload 조립은 후속.

---

## 한 줄 요약

```text
정규화된 Bithumb candles → config-driven RSI/MFI/OBV/ATR/MA/거래량/캔들구조
                         → indicator snapshot (warnings + debug 포함)
모든 기준값 항상 수정 가능. 전통 캔들패턴명 X. 점수/등급/신호/Telegram 미포함.
```
