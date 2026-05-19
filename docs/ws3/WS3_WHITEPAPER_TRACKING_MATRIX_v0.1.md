# WS3 Whitepaper Tracking Matrix v0.1

**버전**: v0.33.0-docs / 추적표 v0.1
**작성일**: 2026-05-20
**작성자**: Claude Web (claude.ai sonnet)
**작성 도구**: Claude in Chrome + bash (git clone)
**기준 백서**: `WOOS_Scanner_V3_개발백서_v0_3_3.md` (1506 줄)
**기준 코드 commit HEAD**: `dec5fc76` (claude/heuristic-cori-7865e7)

---

## 0. 작성 목적

본 추적표는 사용자 메모리 #28 박제 — "v0.20~v0.32.4 실패 인정 / 다음 단계 코드 수정 금지 / 백서 v0.3.3 추적표 우선" — 에 따라 작성되었다.

목적:

1. 백서 v0.3.3 의 모든 항목이 현재 repo 코드의 어디에 구현되어 있는지 매핑
2. v3 모듈 27개 + Worker + production index.html 의 실제 사용 관계 추적
3. 누락 / 왜곡 / 미구현 분류
4. 복구 우선순위 결정 (다음 작업 작업지시서 v0 의 입력 자료)

본 표 작성 전 절대 코드 수정 금지 원칙 준수.

---

## 1. 핵심 진단 (Top-level Finding)

```text
v3 모듈 27개 = 백서 §3, §5, §6, §7, §8, §12, §13, §16, §부록 A 구조와 코드 계약 일치 ✅
Worker /multi-candidate-dry-run = v3 모듈 0개 import / 자체 함수 사용 ❌
production card() = Worker raw response 직접 사용 / CardViewModel 우회 ❌
```

**핵심 표현**:

> "구조철학의 뼈대(v3 모듈)는 repo 에 존재한다.
> 그러나 마지막 연결부 (Worker pipeline / production renderer) 에서 끊겨 있고,
> 실제 화면은 v3 객체 0개를 사용한다."

GPT 의 2차 평가 100% 정확. Claude Web 1차 평가 ("구조철학 완벽 일치") 는 부분만 맞음 (파일 존재 ≠ 연결).

### 1.1 운영 콘솔 변형 증거

Worker 가 출력하는 객체 = v3 객체 0개:

```js
{
  rank, market, score, grade ('P-S' / 'P-A'),
  isCandidate, operatorReview, operatorReviewLevel, operatorReviewReason,
  reasonChips, changePct, volumeRatio, volumeAccel, closePosition,
  upperWickPct, rangePct, candleCount, latestTime, lastClose, ok
}
```

= 백서 §16 슬롯 (strategyBias / structureBucket / signalCycle / entryPlan / exitPlan / marketContext / buyPressure / coinMeta / news / smartMoneyZone / externalAssist / evaluation) **0개**.

= `operator*` (운영자 검토) 필드 4개 → **운영 콘솔 평가용**.

### 1.2 등급 표기 위반

```text
백서 §6.2:  S+ / S / A / B / C / NONE (maxExclusive)
v3-config.js:  S_PLUS=S+ / S / A / B / C / NONE  ✅
Worker classifyCandidateDryRunGrade():  'P-S' / 'P-A' 등 P-prefix  ❌  (백서 위반)
```

P-prefix = `pending`-prefix 로 추정 (운영자 검토 대기 의미). 백서 §6.2 와 충돌.

### 1.3 빗썸 메인 원칙 vs 실제

```text
백서 §부록 A.6.1 + v3-config.js:  ENABLE_BITHUMB=true / UPBIT=false / BINANCE=false  ✅
Worker /multi-candidate-dry-run:  exchange 파라미터로 bithumb/upbit/binance 모두 허용  ⚠️
production card():  exchange ch('빗썸 메인', 'orange') 정렬 OK  ✅
실제 사용 흐름:  본 채팅 v0.13~v0.31 작업 = upbit preset 중심  ❌
```

---

## 2. 모듈 인벤토리

### 2.1 v3 모듈 27개 (총 26,999 줄 / 1.1MB)

| # | 파일 | 버전 | 라인 | 백서 매핑 | export | 화면 사용 |
|---|---|---|---:|---|---|---|
| 1 | `v3-config.js` | v0.1.0 | 144 | §3, §6, §7, §12, §13, §16 | `WS3_CONFIG` | ❌ |
| 2 | `v3-feature-payload.js` | v0.1.0 | 104 | §5.3 | `WS3_FeaturePayload` | ❌ |
| 3 | `v3-bithumb-client.js` | v0.2.0-a | 144 | §5.1 | `WS3_BithumbClient` | ❌ |
| 4 | `v3-candle-normalizer.js` | v0.2.0-a | 96 | §5.1 | `WS3_CandleNormalizer` | ❌ |
| 5 | `v3-indicators.js` | v0.2.0-b | 1479 | §5.2 | (internal) | ❌ |
| 6 | `v3-feature-payload-builder.js` | v0.2.0-c-r1 | 442 | §5.3 | `WS3_FeaturePayload_Builder` | ❌ |
| 7 | `v3-score-breakdown.js` | v0.3.0 | 916 | §6 | `WS3_ScoreBreakdown` | ❌ |
| 8 | `v3-structure-bucket.js` | v0.4.0 | 766 | §7 | `WS3_StructureBucket` | ❌ |
| 9 | `v3-signal-cycle.js` | v0.5.0 | 838 | §8 | `WS3_SignalCycle` | ❌ |
| 10 | `v3-strategy-plan.js` | v0.6.0 | 761 | §12, §13 | `WS3_StrategyPlan` | ❌ |
| 11 | `v3-card-view-model.js` | v0.7.0 | 1096 | §16 | `WS3_CardViewModel` | ❌ |
| 12 | `v3-operation-packet.js` | v0.8.0 | 1195 | §17, §18 | `WS3_OperationPacket` | ❌ |
| 13 | `v3-active-cycle.js` | v0.9.0 | 1280 | §8 (연장) | `WS3_ActiveCycle` | ❌ |
| 14 | `v3-evaluation-outcome.js` | v0.10.0 | 1408 | §16.4 #17, §19 | `WS3_EvaluationOutcome` | ❌ |
| 15 | `v3-evaluation-observation-adapter.js` | v0.11.0 | 498 | §19 | `WS3_EvaluationObservationAdapter` | ❌ |
| 16 | `v3-external-confluence.js` | v0.11.0 | 737 | §부록 A.7 | `WS3_ExternalConfluence` | ❌ |
| 17 | `v3-transport-plan.js` | v0.12.0 | 741 | §17 | `WS3_TransportPlan` | ❌ |
| 18 | `v3-renderer-binding.js` | v0.12.0 | 835 | §16 (UI) | `WS3_RendererBinding` | ❌ |
| 19 | `v3-transport-execution-adapter.js` | v0.13.0 | 1371 | §17 | `WS3_TransportExecutionAdapter` | ❌ |
| 20 | `v3-secure-transport-executor-contract.js` | v0.14.0 | 1596 | (보안 layer) | `WS3_SecureTransportExecutorContract` | ❌ |
| 21 | `v3-transport-executor-harness.js` | v0.15.0 | 1604 | (보안 layer) | `WS3_TransportExecutorHarness` | ❌ |
| 22 | `v3-transport-executor-interface-adapter.js` | v0.16.0 | 1789 | (보안 layer) | `WS3_TransportExecutorInterfaceAdapter` | ❌ |
| 23 | `v3-transport-executor-sandbox-runner.js` | v0.17.0 | 1996 | (보안 layer) | `WS3_TransportExecutorSandboxRunner` | ❌ |
| 24 | `v3-secure-binding-gateway-contract.js` | v0.18.0 | 1668 | (보안 layer) | `WS3_SecureBindingGatewayContract` | ❌ |
| 25 | `v3-live-execution-preflight-gate.js` | v0.19.0 | 1951 | (보안 layer) | `WS3_LiveExecutionPreflightGate` | ❌ |
| 26 | `v3-secure-runtime-state-adapter.js` | v0.20.0 | 962 | (보안 layer) | `WS3_SecureRuntimeStateAdapter` | ❌ |
| 27 | `v3-telegram-canary-sender.js` | v0.21.0 | 609 | §17 (canary) | `WS3_TelegramCanarySender` | ❌ |

**핵심 관찰**:
- 모든 v3 모듈이 **production index.html 의 `<script>` 태그에서 import 0건**.
- Worker `ws3-telegram-canary-worker.js` 에서도 import 0건.
- v3 모듈 = repo 에 박제만 되어 있고 **실제 데이터 흐름에 연결 안 됨**.

### 2.2 Worker (2 파일 / 3155 줄)

| 파일 | 라인 | 역할 |
|---|---:|---|
| `workers/ws3-telegram-canary-worker.js` | 2795 | Cloudflare Worker main / /multi-candidate-dry-run 포함 11 endpoints |
| `workers/ws3-canary-state-kv-adapter.js` | 360 | KV state lifecycle (v0.25) |

### 2.3 web (2 파일)

| 파일 | size | 역할 |
|---|---:|---|
| `web/ws3-canary-console/index.html` | 11549자 | production 화면 (Cloudflare Pages 배포본) |
| `web/ws3-canary-console.html` | 18834자 | legacy 페이지 (구버전 / 미사용 추정) |

---

## 3. 백서 항목 전수 추적표 (6 열)

표 컬럼:
- **#** : 백서 섹션 번호
- **백서 항목** : 본 섹션의 핵심 요구
- **백서 위치** : 줄 번호
- **현재 코드 위치** : 실제 구현 파일 / 함수 / 줄
- **카드 표시 위치** : production 화면 노출 여부 / 위치
- **구현 상태** : ✅ 완전 / ⚠️ 부분 / ❌ 누락
- **복구 방법** : 다음 단계 작업 정의

---

### §1. 프로젝트 정체성

| # | 백서 항목 | 위치 | 현재 코드 | 카드 표시 | 상태 | 복구 |
|---|---|---|---|---|---|---|
| 1.1 | 프로젝트명 = "WOOS Scanner V3" | L103-107 | `index.html` `<h1>WOOS Scanner V3</h1>` | ✅ hero 영역 | ✅ | — |
| 1.2 | 새 객체 / 신규 엔진 기반 독립 정밀 스캐너 | L109-111 | v3 모듈 27개 박제 / 단 Worker 미사용 | ❌ (Worker 가 v3 객체 0건) | ⚠️ | Worker pipeline 을 v3 module 호출로 교체 |
| 1.3 | 7대 구조화 정보 (구조, 점수, 반복, 단타/스윙/관찰/회피, 진입/손절/청산, context, 사후결과) | L113-131 | v3 모듈에 정의 / 화면 미노출 | ❌ (4 섹션만) | ❌ | card() body 14 섹션 추가 |

### §2. 기존 WOOS 와 V3 관계

| # | 백서 항목 | 위치 | 현재 코드 | 카드 표시 | 상태 | 복구 |
|---|---|---|---|---|---|---|
| 2.1 | 기존 WOOS 유지 | L137-139 | v5.1.6 main HEAD 동결 (별도 line) | — | ✅ | — |
| 2.2 | V3 는 독립 앱 (기존 데이터 사용 X) | L141-151 | v3 모듈에 기존 active/completed/관심/정밀/표준 의미 0건 ✅ | — | ✅ | — |
| 2.3 | 기존에서 디자인 톤만 참고 | L152-163 | production css = dark navy / glass / cyan neon / chip ✅ | ✅ | ✅ | — |
| 2.4 | 기존 의미 가져오면 안 됨 | L164-176 | v3 모듈 OK / production card() 도 OK | ✅ | ✅ | — |

### §3. 최상위 설계 원칙

| # | 백서 항목 | 위치 | 현재 코드 | 카드 표시 | 상태 | 복구 |
|---|---|---|---|---|---|---|
| 3.1 | 신규 엔진 원칙 (v3Signal/v3FeaturePayload/v3ScoreBreakdown/v3StructureBucket/v3SignalCycle/v3StrategyPlan/v3ExitPlan/v3MarketContext/v3CardViewModel/v3Renderer) | L180-199 | v3-* 11개 모듈 박제 ✅ | ❌ Worker 0건 import | ⚠️ | Worker import 또는 client-side 호출 |
| 3.2 | Config 중심 (모든 수치 config) | L201-219 | `v3-config.js` 144 줄 / mergeConfig 패턴 모든 모듈 ✅ | — | ✅ | — |
| 3.3 | 정보 계층화 (raw / state / ViewModel / render) | L221-231 | featurePayload → scoreBreakdown → structureDecision → signalCycle → strategyPlan → cardViewModel → rendererBinding ✅ | ❌ 화면 미연결 | ⚠️ | renderer-binding 을 production 에 연결 |

### §4. V3 운영 파이프라인

| # | 백서 항목 | 위치 | 현재 코드 | 카드 표시 | 상태 | 복구 |
|---|---|---|---|---|---|---|
| 4.1 | Universe → Lightweight Scan → Priority Queue → Deep Scan → Feature Extractor → Score/Structure/Strategy → SignalCycle → Event Store → Telegram/CardVM/Evaluation | L235-256 | Worker 단순 parallel fetch + 자체 함수 / v3 pipeline 미사용 | ❌ | ❌ 치명 | Worker 전면 재작성 — v3 module 호출 chain |
| 4.2 | v0 범위 (Bithumb only / Upbit/Binance scanEnabled=false) | L258-268 | `v3-config.js` ENABLE_BITHUMB=true 외 false ✅ / Worker 는 exchange 파라미터로 다 허용 | ⚠️ UI 빗썸 메인 정렬 OK / 실제 호출 upbit 가능 | ⚠️ | Worker 에서 exchange='bithumb' 외 reject |

### §5. 데이터 소스 / Extractor

| # | 백서 항목 | 위치 | 현재 코드 | 카드 표시 | 상태 | 복구 |
|---|---|---|---|---|---|---|
| 5.1 | Exchange Adapter (Bithumb primary / Upbit·Binance reserved scanEnabled=false) | L272-280 | `v3-bithumb-client.js` 144 줄 (v0.2.0-a) ✅ | — | ✅ | — |
| 5.1 | proxy `/bithumb/candles` endpoint | — | Worker 에서 별도 proxy URL 사용 | ❌ 현재 fetch 실패 (CANDIDATE_DRY_RUN_NETWORK_ERROR) | ❌ | **P0** proxy worker 복구 (별도 issue) |
| 5.2 | 기존 함수 후보값 (rawScore/rawGrade, prePump, entryReady, vRatio/vAccel, RSI/MFI/OBV/ATR, MA, boxHigh/boxLow, BTC/시장상황, 뉴스) | L282-296 | `v3-indicators.js` 1479 줄 (v0.2.0-b) — vRatio/vAccel/RSI/MFI/OBV/ATR/MA/box 다 있음 ✅ / Worker 는 단순 calculate* 자체 함수 사용 | ❌ | ⚠️ | Worker pipeline 을 v3-indicators 호출로 교체 |
| 5.3 | V3 Feature Payload 13 top-level field (identity/ts/candles/indicators/structure/volume/momentum/marketContext/buyPressure/coinMeta/newsContext/raw/builderDebug) | L298-314 | `v3-feature-payload.js` 104 줄 + `v3-feature-payload-builder.js` 442 줄 ✅ 13 field 정확 | ❌ Worker 미사용 / card() 미참조 | ⚠️ | Worker → buildFeaturePayload() 호출 |
| 5.3.1 | 코드 계약 매핑 (WS3_CODE_CONTRACT.md) | L315-342 | `docs/ws3/WS3_CODE_CONTRACT.md` 박제 / DP-1~DP-7 해소 완료 ✅ | — | ✅ | — |

### §6. 100점 점수제와 등급 변환 (치명적 누락)

| # | 백서 항목 | 위치 | 현재 코드 | 카드 표시 | 상태 | 복구 |
|---|---|---|---|---|---|---|
| 6.1 | 100점 점수제 (코어 25 / 구조 20 / 거래량 20 / 모멘텀 15 / 실행 20 / 리스크 -15) | L346-361 | `v3-config.js` WS3_WEIGHTS = 25/20/20/15/20/-15 ✅ + `v3-score-breakdown.js` 916 줄 v0.3.0 ✅ | ❌ Worker 자체 `calculateCandidateDryRunScore()` 사용 — 백서 점수제 미적용 | ⚠️ | Worker → v3-score-breakdown.build() 호출 |
| 6.2 | 등급 S+/S/A/B/C/NONE (maxExclusive 90/82/72/60/40/0) | L363-374 | `v3-config.js` WS3_GRADE_BANDS 정확 ✅ | ❌ Worker `classifyCandidateDryRunGrade()` = 'P-S'/'P-A' 출력 / 백서 등급 위반 | ❌ 치명 | **P0** Worker grade 출력 = 'S+'/'S'/'A'/'B'/'C'/'NONE' 변경 |
| 6.2 | SPLUS 표기 금지 / S+ 사용 | L392 | `v3-config.js` DISPLAY.grade.S_PLUS='S+' ✅ | ✅ production card() = "A급 관찰" 등 OK | ✅ | — |
| 6.2 | 등급별 정책 (NONE 카드 X / C silent / B Telegram X (저시총 분리) / A+S+S+ Telegram OK) | L376-390 | `v3-config.js` SCAN.MIN_CANDIDATE_SCORE=40 / MIN_TELEGRAM_POLICY_SCORE=60 ✅ | ❌ 화면에 등급별 정책 표시 X (operator review 만) | ⚠️ | card() 에 등급별 정책 라벨 추가 |
| 6.3 | context 와 점수 분리 (저시총/섹터/시장국면/외부확인/뉴스/경주마시간대/반복신호 = 점수 X) | L396-408 | v3-score-breakdown DP-S4 / DP-S6 = buyPressure/news 점수 미반영 ✅ | ❌ context 표시 자체 미구현 | ❌ | card body §13/§14/§15/§7.1.1 섹션 추가 |

### §7. structureBucket / priceZone / referenceLow

| # | 백서 항목 | 위치 | 현재 코드 | 카드 표시 | 상태 | 복구 |
|---|---|---|---|---|---|---|
| 7.1 | structureBucket 5종 (BOX_PRESSURE/BOX_BREAKOUT/OB_RECLAIM/LOW_SWEEP_RECLAIM/MA_RECLAIM) | L414-424 | `v3-config.js` WS3_STRUCTURE_BUCKET 5종 ✅ + `v3-structure-bucket.js` 766 줄 v0.4.0 ✅ + label 한글 매핑 (박스압박/박스돌파/OB회복/저점회복/MA회복) ✅ | ❌ production card() 미표시 | ❌ 치명 | card() header 슬롯에 structureBucket 추가 |
| 7.1.1 | contextTags (LOW_CAP/MID_CAP/LARGE_CAP/RACEHORSE_WINDOW/EARLY_IGNITION/LATE_STAGE/NEWS_DRIVEN) | L426-449 | v3-config 미박제 / v3 모듈 어디에도 contextTags 정의 0건 ❌ | ❌ | ❌ | **P1** v3-config 에 CONTEXT_TAGS enum 추가 + structureBucket 빌더 확장 |
| 7.2 | priceZone (from/to/center/source/bufferType) | L451-469 | `v3-structure-bucket.js` priceZone 출력 ✅ (zone: TOP_NEAR/BOTTOM_NEAR/MIDDLE/UNKNOWN) | ❌ card() 미표시 | ❌ | card() body §4 구조 판단에 priceZone 추가 |
| 7.3 | referenceLow 5종 (scalpSwing/intradaySwing/structuralSwing/boxLow/orderBlockLow) | L471-485 | `v3-structure-bucket.js` referenceLow 출력 (단 5종 분리 여부 미확인) ⚠️ | ❌ | ⚠️ | v3-structure-bucket 검토 + card body 추가 |

### §8. Signal Cycle / Persistence / Cooldown

| # | 백서 항목 | 위치 | 현재 코드 | 카드 표시 | 상태 | 복구 |
|---|---|---|---|---|---|---|
| 8.1 | 같은 코인 같은 거래소 같은 방향 같은 구조 비슷 priceZone → 같은 cycle | L489-501 | `v3-signal-cycle.js` 838 줄 v0.5.0 ✅ + BUCKET_FAMILY_MAP / CYCLE_PHASE_MAP / candidateKey ✅ | ❌ | ❌ | card() body §11 반복신호 섹션 추가 |
| 8.2 | signalId (priceZone + structure 기반) | L503-515 | v3-signal-cycle.candidateKey ✅ | ❌ | ❌ | — |
| 8.3 | 반복신호 milestone (SINGLE/REPEAT/STRONG_REPEAT/HOT_CYCLE) | L517-532 | `v3-config.js` WS3_SIGNAL_PERSISTENCE 4종 ✅ + 한글 매핑 (단일/반복/강한반복/핫사이클) ✅ | ❌ header signalPersistence 슬롯 미표시 | ❌ 치명 | card() header 슬롯에 signalPersistence 추가 |

### §9. 저시총 B/C 정책

| # | 백서 항목 | 위치 | 현재 코드 | 카드 표시 | 상태 | 복구 |
|---|---|---|---|---|---|---|
| 9.1 | 시총 기준 v0 (LOW_CAP < 500억 / MID_CAP / LARGE_CAP) | L536-544 | ❌ v3 모듈에 시총 정의 0건 / coinMeta 도 0건 | ❌ | ❌ | **P1** v3-config + coinMeta 모듈 신규 |
| 9.2 | Telegram 정책 (B등급: 일반 X / 저시총 OK / 시총 미확인 X) | L546-553 | ❌ Worker telegram 정책 미반영 (v3-operation-packet 에 NOTIFICATION_TYPE 만 있고 시총 분기 없음) | ❌ | ❌ | **P2** operation-packet 에 시총 분기 추가 |
| 9.3 | 저시총 B = early ignition 후보 | L555-559 | ❌ | ❌ | ❌ | — |

### §10. 시장상황 / BTC / MA

| # | 백서 항목 | 위치 | 현재 코드 | 카드 표시 | 상태 | 복구 |
|---|---|---|---|---|---|---|
| 10.1 | marketContext 의 위치 (BTC up/down/sideways, alt 강세, 시장중립, risk_off) | L563-570 | `v3-config.js` WS3_MARKET_CONTEXT 7종 ✅ + 한글 매핑 (BTC상승/BTC하락/BTC횡보/알트강세/시장중립/위험회피/시장미확인) ✅ + `v3-feature-payload.js` marketContext field 포함 ✅ | ❌ card() 미표시 | ❌ | **P0** card body §6 시장상황 추가 |
| 10.2 | MA 기준 (BTC MA20/MA50/MA200) | L572-586 | ❌ v3-indicators 에 MA 계산 함수 있음 / marketContext 자동 분류 함수 미박제 | ❌ | ❌ | v3-marketContext-classifier 신규 + builder |
| 10.3 | 카드헤더 시장 슬롯 | L588-603 | `v3-config.js` HEADER_SLOT_PRIORITY 에 marketContext 포함 ✅ | ❌ card() header 미표시 | ❌ | card() header 슬롯 추가 |

### §11. 매수세 / 수급 판단

| # | 백서 항목 | 위치 | 현재 코드 | 카드 표시 | 상태 | 복구 |
|---|---|---|---|---|---|---|
| 11.1 | 매수세 슬롯 (BUY_PRESSURE_STRONG/MEDIUM/WEAK/NONE) | L607-625 | `v3-config.js` WS3_BUY_PRESSURE 5종 ✅ + 한글 매핑 (매수세 강/중/약/없음/미확인) ✅ + `v3-feature-payload.js` buyPressure field ✅ | ❌ | ❌ | **P0** card body §5 매수세 추가 |
| 11.2 | 원칙 (점수 영향 X / context 만) | L627-631 | v3-score-breakdown DP-S6 buyPressure 점수 미반영 ✅ | ❌ | ⚠️ | — |
| — | buyPressure 자동 분류 함수 | — | ❌ 미박제 (Worker 자체 vRatio / closePosition / changePct 만) | ❌ | ❌ | v3-buy-pressure-classifier 신규 모듈 |

### §12. strategyBias (치명적 누락)

| # | 백서 항목 | 위치 | 현재 코드 | 카드 표시 | 상태 | 복구 |
|---|---|---|---|---|---|---|
| 12 | strategyBias 5종 (SCALP/SWING/SCALP_SWING/WATCH/AVOID) | L633-647 | `v3-config.js` WS3_STRATEGY_BIAS 5종 ✅ + 한글 매핑 (단타/스윙/단타→스윙/관찰/회피) ✅ + `v3-strategy-plan.js` 761 줄 v0.6.0 ✅ + STRATEGY_BIAS_TO_PLAN_TYPE map ✅ | ❌ production card() 미표시 (header / body 둘 다) | ❌ **치명** | **P0** card() header 슬롯 2번 자리 + body §7 전략성향 섹션 추가 |

### §13. 진입 / 손절 / 청산 / 매도전략

| # | 백서 항목 | 위치 | 현재 코드 | 카드 표시 | 상태 | 복구 |
|---|---|---|---|---|---|---|
| 13.1 | v0 원칙 (가이드만 / 자동매매 X) | L651-653 | `v3-strategy-plan.js` planType 정의 (NONE/WATCH/PULLBACK/BREAKOUT/RECLAIM) ✅ | ❌ | ❌ | — |
| 13.2 | 진입 구조 (entryPlan 분할 진입 30/30/40) | L655-659 | `v3-strategy-plan.js` entryPlan 출력 ✅ (단 LW 30/30/40 비율은 strategyConfig 별도) | ❌ card body §8 미표시 | ❌ | **P0** card body §8 진입 가이드 추가 |
| 13.3 | 손절 구조 (referenceLow 기반 무효화선) | L661-663 | `v3-strategy-plan.js` exitPlan 내부 ✅ | ❌ | ❌ | — |
| 13.4 | 매도전략 A-F (A 구조분할 / B ATR트레일링 / C TP1 본절 / D 무효화 / E 시간제한 / F 거래량소멸) | L665-681 | `v3-config.js` WS3_EXIT_STRATEGIES A-F ✅ + 한글 매핑 ✅ + `v3-strategy-plan.js` exitPlan 출력 ✅ | ❌ card body §9 미표시 (A-F 카드 전체 0건) | ❌ **치명** | **P0** card body §9 매도전략 A-F 6 slot 추가 |
| 13.5 | 카드바디 표현 | L683-687 | ❌ production card() 미구현 | ❌ | ❌ | — |

### §14. TradingView / 외부 보조확인

| # | 백서 항목 | 위치 | 현재 코드 | 카드 표시 | 상태 | 복구 |
|---|---|---|---|---|---|---|
| 14.1 | V3 엔진 직접 계산 (OBV/MFI/RSI/ATR/MA/box/swing low) | L691-703 | `v3-indicators.js` 1479 줄 ✅ | ⚠️ 화면 미표시 | ⚠️ | card body §12 지표 상세 추가 |
| 14.2 | 외부 보조확인 (SuperTrend / Basel / LuxAlgo SMC = 카드바디 참고만) | L705-713 | `v3-external-confluence.js` 737 줄 v0.11.0 ✅ (외부 confluence layer 분리) | ❌ card() 미표시 | ❌ | **P0** card body §16 외부 보조확인 추가 |

### §15. 뉴스 / 스냅샷 / 세력예상가

| # | 백서 항목 | 위치 | 현재 코드 | 카드 표시 | 상태 | 복구 |
|---|---|---|---|---|---|---|
| 15.1 | 뉴스 (newsContext = 점수 X / context 만) | L717-733 | `v3-feature-payload.js` newsContext null default ✅ / Phase 4+ 도입 / 실제 수집 모듈 ❌ | ❌ | ❌ | **P2** (Phase 4+) news adapter 신규 |
| 15.2 | 스냅샷 (Telegram + card) | L735-737 | `v3-operation-packet.js` snapshotPacket ✅ | ❌ | ❌ | — |
| 15.3 | 세력예상가 (smartMoneyZone 추정) | L739-753 | ❌ v3 모듈 0건 | ❌ | ❌ | **P1** v3-smart-money-zone 신규 |

### §16. 카드 UI 가이드 (핵심)

| # | 백서 항목 | 위치 | 현재 코드 | 카드 표시 | 상태 | 복구 |
|---|---|---|---|---|---|---|
| 16.1 | 디자인 원칙 (dark navy / glass / cyan neon / chip / rounded / soft glow / mobile-first) | L757-776 | production css 전체 ✅ | ✅ | ✅ | — |
| 16.2 | 카드헤더 슬롯 구조 (등급/전략성향/대표구조/반복신호/시장상황/매수세/위험·시총/감지시간 8 슬롯) | L778-795 | `v3-config.js` HEADER_SLOT_PRIORITY 8개 ✅ + `v3-card-view-model.js` buildHeader() ✅ | ❌ production card() = 등급/검토/후보/거래소/점수 (백서 슬롯 0개) | ❌ **치명** | **P0** card() header 재구성 — config.HEADER_SLOT_PRIORITY 사용 |
| 16.3 | 헤더 우선순위 가이드 (1 등급 / 2 strategyBias / 3 대표구조 / 4 반복신호 / 5 시장 or 매수세 / 6 위험·시총 / 7 시간) | L797-805 | `v3-config.js` HEADER_SLOT_PRIORITY 8개 + alwaysShow=['grade','strategyBias','structure'] / mobileMax=5 ✅ | ❌ | ❌ | — |
| 16.4 | 카드바디 18 섹션 순서 (1 핵심요약 / 2 헤더해석 / 3 점수요약 / 3.5 selectionReason / 4 구조 / 5 매수세 / 6 시장 / 7 전략 / 8 진입 / 9 매도A-F / 10 세력예상가 / 11 반복신호 / 12 지표 / 13 코인메타 / 14 뉴스 / 15 시장참고 / 16 외부보조 / 17 사후평가 / 18 고급상세) | L807-827 | `v3-card-view-model.js` sections={overview,score,structure,cycle,strategy,risk,debug} (7 sections) + `v3-renderer-binding.js` sections={strategy,lifecycle,evaluation,confluence,transport} (5 sections) ✅ | ❌ production card() = 4 섹션만 (1, 3.5, 4, 18) — 14 섹션 누락 | ❌ **치명** | **P0** card() body 14 섹션 추가 (시안: §16.4 18 슬롯 순서 그대로) |
| 16.4.1 | selectionReason 4 필드 (primaryReason / technicalReasons / externalReasons / summary / externalConfluenceLevel) | L829-867 | `v3-card-view-model.js` reasons / warnings 출력 ✅ + `v3-external-confluence.js` confluenceLabel ✅ | ⚠️ "기타 근거" 만 표시 / 4 필드 0개 | ⚠️ | card() body §3.5 4 필드 표시 |
| 16.4.2 | selectionReason 외부 라벨 후보 (BITHUMB_*/LW_*) | L869-896 | ❌ 미박제 (Phase 4+/5+ 예정) | ❌ | ❌ (Phase 4+) | — |

### §17. Telegram 알람 가이드

| # | 백서 항목 | 위치 | 현재 코드 | 카드 표시 | 상태 | 복구 |
|---|---|---|---|---|---|---|
| 17 | Telegram 정책 (등급별 / 시총별 / cycle별 / 뉴스 / 스냅샷 / 세력예상가 / 매도전략 포함) | L900-921 | `v3-operation-packet.js` notificationPacket + `v3-telegram-canary-sender.js` 609 줄 ✅ / 단 현재 = canary 1회 + LIMITED_LIVE 만 | ❌ 실제 펌핑 후보 alarm 0건 | ❌ | **P2** operation-packet 의 NOTIFICATION_TYPE = 후보 알람용으로 활성 |

### §18. 저장 구조 / KV / TTL

| # | 백서 항목 | 위치 | 현재 코드 | 카드 표시 | 상태 | 복구 |
|---|---|---|---|---|---|---|
| 18.1 | 저장 단위 (candidate event / signalCycle / evaluation outcome) | L925-935 | `v3-operation-packet.js` snapshotPacket / evaluationSeed ✅ | — | ⚠️ | KV write 미연결 |
| 18.2 | KV Key 예시 | L937-950 | `workers/ws3-canary-state-kv-adapter.js` 360 줄 ✅ (단 v0.23 canary state KV 만) | — | ⚠️ | v3 candidate / cycle / evaluation KV 별도 분리 |
| 18.3 | 저장 금지 (raw OHLCV array / personal data / wallet) | L952-959 | v3-evaluation-outcome DP-EO4 raw candles 저장 금지 ✅ | — | ✅ | — |

### §19. 사후평가 설계

| # | 백서 항목 | 위치 | 현재 코드 | 카드 표시 | 상태 | 복구 |
|---|---|---|---|---|---|---|
| 19.1 | 평가 window (15m/1h/4h/24h/3d/7d) | L963-970 | `v3-evaluation-outcome.js` WINDOW = NONE/H24/D7/CUSTOM ⚠️ (백서 6개 vs 코드 4개 — 부분 누락) | ❌ | ⚠️ | v3-evaluation-outcome WINDOW enum 확장 (15m/1h/4h/3d 추가) |
| 19.2 | 평가 지표 (MFE/MAE/도달시간/추격/RR 대비) | L972-983 | `v3-evaluation-outcome.js` movement / targetCheck / quality ✅ (MFE/MAE 직접 키 미확인) ⚠️ | ❌ | ⚠️ | v3-evaluation-outcome 본문 검토 + MFE/MAE 필드 명시 |
| 19.3 | 사후평가 핵심 질문 (구조별 성공률 / strategyBias 적중 / 반복신호 효과) | L985-993 | `v3-evaluation-outcome.js` quality / pathOrder ⚠️ | ❌ card body §17 미표시 | ❌ | card body §17 사후평가 진행 추가 |

### §20. 코인 메타 / 시총 / 섹터

| # | 백서 항목 | 위치 | 현재 코드 | 카드 표시 | 상태 | 복구 |
|---|---|---|---|---|---|---|
| 20.1 | 시총 소스 우선순위 (CoinMarketCap / Bithumb 거래대금 추정) | L997-1003 | ❌ v3 모듈 0건 | ❌ | ❌ | **P1** v3-coin-meta-adapter 신규 |
| 20.2 | 섹터 소스 우선순위 | L1005-1011 | ❌ | ❌ | ❌ | — |
| 20.3 | 표준 섹터 v0 (Layer1 / DeFi / Meme / Gaming / AI / Infra / RWA / Stablecoin / 기타) | L1013-1020 | ❌ | ❌ | ❌ | — |

### §21. 구현 단계 (Phase 0-5)

| Phase | 백서 정의 | 현재 진행도 | 비고 |
|---|---|---|---|
| Phase 0 | 설계 고정 (백서 / config / 코드계약) | ✅ 완료 (v0.1.0 ~ v0.2.0-c-r1) | |
| Phase 1 | V3 엔진 최소 동작 (Bithumb → featurePayload → score → structure → cycle → strategy → cardVM) | ⚠️ 모듈 박제만 / Worker 연결 0건 | **현재 막힌 단계** |
| Phase 2 | 저장 / 이벤트 / 사후평가 | ⚠️ 모듈 박제 / KV 미연결 | |
| Phase 3 | 전략 / 청산 가이드 | ⚠️ strategyPlan 박제 / 화면 미연결 | |
| Phase 4 | UI / Telegram | ⚠️ 화면 shell 만 / card body 4 섹션 / Telegram canary 만 | |
| Phase 5 | 확장 (LW / SeoulKIM / multi-exchange) | — | 후순위 |

### §22. 클로드/Codex 작업 지시 요약 (운영 문서)

| # | 백서 항목 | 위치 | 현재 코드 | 비고 |
|---|---|---|---|---|
| 22.1-22.3 | 먼저 할 일 / grep 대상 / 금지 | L1084-1114 | `docs/ws3/WS3_WORKFLOW_TEMPLATE.md` v0.1 박제 / 본 추적표 작성 = 22.1 "백서 추적표 작성" 정확 적용 ✅ | — |

### §23. 미확정 / 추후 토의

| # | 백서 항목 | 위치 | 현재 상태 |
|---|---|---|---|
| — | (다양) | L1116-1134 | 후순위 |

### §24. 핵심 결론

| # | 백서 항목 | 위치 | 현재 코드 | 상태 |
|---|---|---|---|---|
| — | "기존 분석기 확장 아님" / "structureBucket·signalCycle·strategyBias·exitPlan·smartMoneyZone·marketContext·buyPressure·newsContext·coinMeta 모두 V3 고유" | L1136-1157 | v3 모듈에 모두 정의 ✅ / 화면 노출 0건 ❌ | ❌ 치명 |

### 부록 A. Config Skeleton

| # | 백서 항목 | 위치 | 현재 코드 | 상태 |
|---|---|---|---|---|
| A.1 | cardSlotConfig (header priority / bodySections 19 항목) | L1161-1183 | `v3-card-view-model.js` DEFAULT_CARD_VIEW_MODEL_CONFIG ✅ + `v3-renderer-binding.js` DEFAULT_RENDERER_BINDING_CONFIG ✅ | ⚠️ 화면 미연결 |
| A.2 | exitPlanConfig (A-F enabled / param) | L1185-1199 | `v3-strategy-plan.js` DEFAULT_STRATEGY_PLAN_CONFIG ✅ | ⚠️ |
| A.3 | marketSlotConfig | L1201-1211 | ❌ marketContext 분류기 모듈 미박제 | ❌ |
| A.3.1 | marketSlotConfig_v1_proposal | L1213-1243 | ❌ | ❌ |
| A.4 | buyPressureConfig | L1245-1254 | ❌ 분류기 미박제 | ❌ |
| A.5 | strategyConfig (LONG 30/30/40 / SHORT user-input) | L1256-1280 | `v3-strategy-plan.js` 내부 ⚠️ | ⚠️ |
| A.6 | externalSourcesConfig (빗썸 공식 / LW / SeoulKIM) | L1282-1372 | ❌ enabledV0 = false 정책 / 실 수집 모듈 0건 | ❌ (Phase 4+/5+) |
| A.7 | externalConfluence v3Signal 확장 | L1373-1460 | `v3-external-confluence.js` 737 줄 v0.11.0 ✅ | ⚠️ 화면 미연결 |

### 부록 B. 입력 자료 인벤토리

| # | 백서 항목 | 위치 | 현재 상태 |
|---|---|---|---|
| — | (LW / SeoulKIM 자료) | L1461-1495 | 사용자 첨부본 별도 / repo 미박제 |

### 부록 C. UI 톤 참고 이미지

| # | 백서 항목 | 위치 | 현재 상태 |
|---|---|---|---|
| — | (v2 스크린샷 등) | L1497- | 사용자 첨부본 / repo 미박제 |

---

## 4. 복구 우선순위 (P0 / P1 / P2 / P3)

### 4.1 P0 — 즉시 (다음 작업지시서 v0 입력)

| # | 항목 | 위치 | 작업 분량 |
|---|---|---|---|
| P0-1 | Worker grade 출력 = 'P-S'/'P-A' → 백서 등급 'S+'/'S'/'A'/'B'/'C'/'NONE' 정정 | Worker.classifyCandidateDryRunGrade() | 1 함수 수정 (소) |
| P0-2 | Worker pipeline 을 v3 module 호출 chain 으로 교체 (featurePayload → scoreBreakdown → structureDecision → signalCycle → strategyPlan → cardViewModel) | Worker.runMultiCandidatePipeline() | 1 함수 재작성 (중) |
| P0-3 | proxy `/bithumb/candles` fetch 복구 (CANDIDATE_DRY_RUN_NETWORK_ERROR 해소) | exchange-proxy-worker-v2 별도 | 별도 worker (소) |
| P0-4 | production card() header = 백서 §16.2 8 슬롯 구조 (등급/strategyBias/structure/persistence/market/buyPressure/risk/time) — alwaysShow=['grade','strategyBias','structure'] / mobileMax=5 | production index.html `card()` 함수 | 1 함수 재작성 (중) |
| P0-5 | production card() body = 백서 §16.4 18 섹션 구조 (1~18 모두 / 미구현 = "데이터 수집 중") | production index.html `card()` 함수 | 1 함수 재작성 (대) |
| P0-6 | card() 의 r 입력 = Worker 응답 + cardViewModel + rendererBinding 동시 사용 (현재 raw 만) | production index.html `card()` 함수 | 1 함수 재작성 |

### 4.2 P1 — 중기 (Phase 1 완성용)

| # | 항목 | 위치 | 작업 분량 |
|---|---|---|---|
| P1-1 | v3-config 에 CONTEXT_TAGS enum 7종 추가 (LOW_CAP/MID_CAP/LARGE_CAP/RACEHORSE_WINDOW/EARLY_IGNITION/LATE_STAGE/NEWS_DRIVEN) | `v3-config.js` | 소 |
| P1-2 | v3-structure-bucket 에 contextTags 빌더 추가 | `v3-structure-bucket.js` | 중 |
| P1-3 | v3-marketContext-classifier 신규 모듈 (BTC MA20/50/200 자동 분류) | 신규 | 중 |
| P1-4 | v3-buy-pressure-classifier 신규 모듈 (vRatio/OBV/체결강도 자동 분류) | 신규 | 중 |
| P1-5 | v3-smart-money-zone 신규 모듈 (세력예상가 = 매물대 / 집중 구간) | 신규 | 대 |
| P1-6 | v3-coin-meta-adapter 신규 모듈 (시총 / 섹터) | 신규 | 중 |
| P1-7 | v3-evaluation-outcome WINDOW enum 확장 (15m/1h/4h/3d 추가) | `v3-evaluation-outcome.js` | 소 |

### 4.3 P2 — 외부 데이터 (Phase 4+/5+)

| # | 항목 | 위치 |
|---|---|---|
| P2-1 | news adapter (CryptoPanic / Twitter / Telegram 채널) | 신규 |
| P2-2 | externalSourcesConfig.enabledV0 활성 (빗썸 공식 + LW) | `v3-external-confluence.js` |
| P2-3 | Telegram 알람 정책 (NOTIFICATION_TYPE = CANDIDATE_READY 활성) | `v3-operation-packet.js` |
| P2-4 | v3 candidate / cycle / evaluation KV write 활성 | Worker + KV |

### 4.4 P3 — 후순위

| # | 항목 | 위치 |
|---|---|---|
| P3-1 | 예측 그래프 (진입 / 손절 / TP / 트레일링 / 세력예상가 / 사후평가 라인) | production card body §17 그래프 |
| P3-2 | LW activeCycle tracker (Phase 5+) | 신규 |
| P3-3 | SeoulKIM 보조 (Phase 5+) | 신규 |

---

## 5. 작업 가이드 (다음 단계)

### 5.1 추적표 기반 작업 흐름

```text
Step 1.  본 추적표 사용자 검토 → 항목별 우선순위 확정
Step 2.  P0 6 항목 → 작업지시서 v0 작성 (GPT or Claude Web)
Step 3.  Claude Web 피드백 (백서 정합성 / v2 UI 감각 / raw 미노출 / 빗썸 메인 / 검증 과몰입 X)
Step 4.  Claude Code (또는 Claude Web 직접) 구현
Step 5.  사용자 화면 검수
Step 6.  반복
```

### 5.2 코드 수정 시작 조건

다음 4 조건 모두 충족 시에만 코드 수정 가능 (사용자 박제 메모리 #1, #2, #3, #28):

- [ ] 본 추적표 사용자 검토 완료
- [ ] P0 항목 별 작업지시서 v0 작성 완료
- [ ] Claude Web 피드백 완료
- [ ] 사용자 명시 승인 ("진행", "OK")

### 5.3 코드 수정 시 자가질문 6개 (메모리 #27)

각 패치 시작 전 6 질문 답:

```text
1. 이 작업이 펌핑 유력 코인을 찾는 데 직접 도움이 되는가?
2. 백서 기준 슬롯을 유지하는가?
3. 빗썸 메인을 흐리지 않는가?
4. v2 제품형 UI 감각을 해치지 않는가?
5. raw/debug 값을 사용자에게 노출하지 않는가?
6. 검증/보안/운영 콘솔 작업에 과몰입하고 있지 않은가?
```

---

## 6. 본 추적표 결론

```text
v3 모듈 27개 = 백서 구조의 골격 완성 (✅)
Worker pipeline = v3 module import 0건 (❌)
production card() = v3 object 사용 0건 (❌)

= 다음 작업은 UI 장식이 아니라 connection layer 복구.

핵심 진단 (메모리 #28):
"v0.20~v0.32.4 = WS3 본체 X / 운영 콘솔 변형 중간 산출물"
정확.

복구 시작점:
P0-2 Worker pipeline → v3 module chain 호출
P0-4/5/6 production card() → cardViewModel + rendererBinding 사용
```

본 추적표 작성 완료. 사용자 검토 + 우선순위 확정 + 작업지시서 v0 작성 단계 대기.

---

**작성 종료**: 2026-05-20
**다음 단계**: 사용자 검토 → P0 작업지시서 v0
