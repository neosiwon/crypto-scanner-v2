# WS3 Changelog

> 이 파일은 WS3 (WOOS Scanner V3) 작업 변경 이력을 누적 기록한다.  
> 신규 작업 단계는 상단에 추가.

---

## [v0.2.0-b-r1] — 2026-05-15

Baseline Consistency Hotfix. 기능 변경 없음. 문서/주석/fallback 후보키만 정리.

### Fixed
- 기준 백서 경로/존재 여부 명시 (`/docs/ws3/WOOS_Scanner_V3_개발백서_v0_3_3.md` 미박제 상태로 baseline에 표기)
- WS3 후속 단계 순서 정합성 정리 (signalCycle은 v0.5.0, UI는 v0.7.0, Telegram은 v0.8.0)
- 코드 버전과 제품 Phase 표현 혼용 제거
- V3Candle canonical을 `ts / tradeValue` 로 baseline에 통일 표기
- V3FeaturePayload top-level field count를 명확히 13개로 표기
- `v3-indicators.js` `readCandleField` 주석을 canonical 명시형으로 정리
- `v3-indicators.js` array index map에 canonical `ts` key 추가 (`ts: 0, timestamp: 0, ...`)
- `v3-indicators.js` array index map의 tradeValue를 canonical-first로 재정렬 (`tradeValue: 6, value: 6, ...`)
- `v3-indicators.js` `getTradeValue` 후보키 우선순위를 canonical-first로 변경 (`['tradeValue', 'value', ...]`)
- `strategyBias` enum/display 선박제와 v0.6.0 실제 로직 구현 단계를 baseline에 분리 명시
- `isValidPayload` 정책(ts/coinMeta/newsContext key 존재 검사 여부)을 v0.2.0-c 작업지시서에서 결정하도록 baseline에 메모

### Not Changed
- indicator 계산 로직 변경 없음
- 함수 추가/삭제 없음
- `v3-feature-payload.js` 코드 수정 없음 (validator 결정은 v0.2.0-c 작업지시서로 이관)
- `v3-config.js` / `v3-bithumb-client.js` / `v3-candle-normalizer.js` 수정 없음
- scoreBreakdown / grade / signalCycle / structureBucket 판정 / strategyBias / entryPlan / exitPlan 구현 없음
- buildFeaturePayload 본체 구현 없음
- Telegram / UI / externalConfluence 구현 없음
- 신규 파일 없음

### Verified
- `node --check v3/v3-indicators.js` 통과
- 보호 파일(`v3-config.js`, `v3-feature-payload.js`, `v3-bithumb-client.js`, `v3-candle-normalizer.js`, `index.html`, `manifest.json`, `service-worker.js`) 미수정

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
