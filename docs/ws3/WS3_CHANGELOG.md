# WS3 Changelog

> 이 파일은 WS3 (WOOS Scanner V3) 작업 변경 이력을 누적 기록한다.  
> 신규 작업 단계는 상단에 추가.

---

## [v0.2.0-b] — 2026-05-14

### Added
- `/v3/v3-indicators.js` — Indicator Function Skeleton (Config-Driven)
  - 32개 함수 (Config 유틸 12 / 이동평균 3 / RSI MFI OBV ATR 5 / 거래량 3 / 캔들구조 3 / 박스구조 5 / 통합 1)
  - `DEFAULT_INDICATOR_CONFIG` 박제 (모든 임계값 집중 관리)
  - `mergeIndicatorConfig(config)` helper
  - 각 함수가 `configUsed` 반환 (추적 가능)
- `/docs/ws3/WS3_v0_2_0_b_INDICATOR_SKELETON_REPORT.md` — 완료 보고서

### Design
- 함수 시그니처 `calculate*(candles, config = {})` 표준화
- `calculateRSI(candles, period = 14)` 같은 고정 시그니처 폐기
- MA/RSI/MFI/OBV/ATR/거래량/거래대금/캔들구조 기준값 = config override 가능
- 전통 캔들패턴명 (도지/망치형/장악형 등) 미구현
- V3에서 캔들패턴 = candleStructureFeatures 보조값
- structureBucket 최종 판정 X (WS3 v0.4.0에서)

### Missing (의도된 미포함)
- externalConfluence / bithumbOfficial / LW / SeoulKIM
- Telegram / news / snapshot / marketCap / sector
- strategyBias / entryPlan / exitPlan
- scoreBreakdown / grade / signalCycle
- cardViewModel / renderer

### Protected (수정 X)
- index.html / manifest.json / service-worker.js / worker.js / wrangler.toml
- /v3/v3-config.js / v3-feature-payload.js / v3-bithumb-client.js / v3-candle-normalizer.js
- /v3/v3-index.html (생성도 X)

### Verified
- `node --check` 통과
- 외부 API 호출 / DOM 접근 / localStorage / Telegram — 코드 0개
- score / grade / signalCycle — 코드 0개

---

## [v0.2.0-a] — (이전 baseline)

### Added
- `/v3/v3-bithumb-client.js`
- `/v3/v3-candle-normalizer.js`

---

## [v0.1.0] — (이전 baseline)

### Added
- `/v3/v3-config.js`
- `/v3/v3-feature-payload.js`
