# WS3 Changelog

> 이 파일은 WS3 (WOOS Scanner V3) 작업 변경 이력을 누적 기록한다.  
> 신규 작업 단계는 상단에 추가.

---

## [v0.4.0] — 2026-05-16 (structureBucket / priceZone / referenceLow)

### Added
- `/v3/v3-structure-bucket.js` — structureBucket 본체 (신규)
  - `WS3_StructureBucket.build(payload, scoreBreakdown, config)` → standalone structureDecision 객체 (payload / scoreBreakdown mutate 0건)
  - **13 structureBucket 후보** — UNKNOWN / NO_STRUCTURE / BOX_MIDDLE / BOX_TOP_PRESSURE / BOX_BOTTOM_RISK / ABOVE_BOX_CONFIRMED_CANDIDATE / BELOW_BOX_CONFIRMED_CANDIDATE / LOW_SWEEP_PENDING / LOW_SWEEP_RECLAIM_CANDIDATE / HIGH_SWEEP_REJECT_CANDIDATE / RECLAIM_READY / BREAKOUT_PRESSURE_CANDIDATE / BREAKDOWN_RISK_CANDIDATE
  - **confidence 0~100** (등급 미사용. 가산식: box+25 / priceZone+20 / refLow+20 / sweep/reclaim+20 / structureScore≥15 +15)
  - **이중 환경 export**: `global.WS3_StructureBucket` + `module.exports`
- `/docs/ws3/WS3_v0_4_0_STRUCTURE_BUCKET_REPORT.md` — 완료 보고서 (신규)

### Confirmed paths (Gate 1 결과 — CASE B 이중 nesting)
- structure root: `payload.structure.structure`
- box: `payload.structure.structure.box`
- referenceLows (복수형 's'): `payload.structure.structure.referenceLows`
- priceZone: `payload.structure.structure.priceZone`
- sweepReclaim: `payload.structure.structure.sweepReclaim`
- touch count: `payload.structure.structure.box.touchesHigh / touchesLow` (v3-indicators.js 출력 재사용, 재계산 0건)
- distance: `payload.structure.structure.box.distanceToTopPct / distanceToBottomPct`
- currentClose: `payload.candles[primaryTimeframe]` last `.close`
- primaryTimeframe: `payload.raw.builderDebug.primaryTimeframe || 'h1'`

### Adopted DP Policy
- **DP-STR1** standalone structureDecision. payload / scoreBreakdown mutate 금지.
- **DP-STR2** 13 structureBucket 후보 사용.
- **DP-STR3** priceZone source 우선순위 (structureRoot.priceZone → box distance 보조 → UNKNOWN).
- **DP-STR4** referenceLow 선택 (sweep/reclaim 관련 low → 최근 valid → null). `distancePct = (currentClose - refLow.value) / currentClose * 100`.
- **DP-STR5** 4-touch 기준 (`breakoutTouchCount=4`, `breakdownTouchCount=4`). touch count 재계산 0건.
- **DP-STR6** confidence 0~100. 등급 미사용.
- **DP-STR7** scoreBreakdown.components.structure.score만 confidence 보조값. totalScore 미사용.
- **DP-STR8** riskPenalty 미반영 (후속 strategyBias / entryPlan 단계).
- **DP-STR9** ABOVE_BOX → ABOVE_BOX_CONFIRMED_CANDIDATE / BELOW_BOX → BELOW_BOX_CONFIRMED_CANDIDATE.
- **DP-STR10** 분류 우선순위 (sweep/reclaim → box 외부 → box pressure/risk → priceZone → fallback).
- **N-STR-1** referenceLows 복수형 's' 사용.
- **N-STR-2** 각 sub-component (box / priceZone / referenceLow / sweepReclaim) valid 개별 점검.
- **N-STR-3** currentClose = primary timeframe (default 'h1') 마지막 candle.close.
- **N-STR-4** confidence 가산은 `components.structure.valid === true && score >= 15` 조건만.
- **N-STR-5** structureBucket === UNKNOWN || NO_STRUCTURE → confidence = 0.

### Changed
- `/docs/ws3/WS3_CHANGELOG.md` (본 파일): `[v0.4.0]` 엔트리 상단 추가
- `/docs/ws3/WS3_CURRENT_BASELINE.md`: 완료된 단계 표 + 보호 파일 목록 + 모듈 의존성 + 다음 단계 갱신

### Protected (수정 0건)
- `v3-config.js` / `v3-feature-payload.js` / `v3-bithumb-client.js` / `v3-candle-normalizer.js` / `v3-indicators.js` / `v3-feature-payload-builder.js` / `v3-score-breakdown.js`
- `docs/ws3/WS3_CODE_CONTRACT.md` (b-r2 박제본 그대로)
- `docs/ws3/WS3_WORKFLOW_TEMPLATE.md` (v0.1 박제본 그대로)
- `index.html` / `manifest.json` / `service-worker.js`

### 의도된 미구현 (이번 단계 제외)
- `grade` 산출 / `tier` / 등급 코드
- `signalCycle` / `persistence` / `cooldown` — v0.5.0
- `strategyBias` / `entryPlan` / `exitPlan` — v0.6.0
- `renderer` / `cardViewModel` / `UI` — v0.7.0
- 알림 연동 / `snapshot` / `evaluation` — v0.8.0
- 외부 신호 / `LW activeCycle` — v0.9.x+
- `riskPenalty` 반영 (DP-STR8)
- 새 캔들 fetch / 새 지표 계산 / touch count 재계산 — 0건
- 외부 호출 (외부 API / DOM / 브라우저 storage / KV) 0건
- 런타임 clock API 사용 0건

### Verified
- `node --check v3/v3-structure-bucket.js` 통과
- smoke test 4 시나리오 모두 통과:
  - **consolidation box** (h1 60개) → `RECLAIM_READY` (DP-STR10 우선순위 1번 적용), confidence 100, payload/scoreBreakdown mutation 0건
  - **low sweep + reclaim** → `LOW_SWEEP_RECLAIM_CANDIDATE`, confidence 100
  - **empty / createEmpty payload** → `NO_STRUCTURE`, confidence 0 (N-STR-5)
  - **null payload** → `NO_STRUCTURE`, confidence 0, components shape 유지, warnings `['PAYLOAD_NOT_OBJECT']`
- 금지 패턴 grep (identifier 기반): 모두 0건
  - `(grade|signalCycle|entryPlan|exitPlan)\s*[:=]` 0건
  - `\.(grade|signalCycle|entryPlan|exitPlan)` 0건
  - `payload.<x> = mutation` 0건 (이전 단계 false-positive조차 없음)
  - `scoreBreakdown.<x> = mutation` 0건
  - `delete payload.` / `delete scoreBreakdown.` 0건
  - `fetch(` / `document.` / `localStorage` / `sessionStorage` / `XMLHttpRequest` / `Date.now(` 0건 (주석 literal도 0건)
  - refined `P-S/A/B` / `Telegram` / `externalConfluence` / 렌더/UI 식별자 0건
- 보호 파일 `git diff` 빈 출력 = 0건

### 기준 commit
- branch: `claude/heuristic-cori-7865e7`
- 이전 functional baseline: WS3 v0.3.0 scoreBreakdown core (`b7e0ea3`)
- 이전 commit (직전): WS3 v0.3.0-docs Workflow Template v0.1 (`d8bebc2`)
- 본 commit: (push 후 기록)

---

## [v0.3.0-docs] — 2026-05-16 (Workflow Template v0.1)

문서 박제 단계. 기능 코드 변경 없음. 운영 워크플로우 표준 템플릿을 repo 운영 문서로 박제.

### Added
- `/docs/ws3/WS3_WORKFLOW_TEMPLATE.md` — WS3 Workflow Template v0.1 (신규)
  - GPT 작업지시서 초안 → Claude Web 피드백 → GPT 최종 전문 → Claude Code 실행 흐름 박제
  - **Claude Web 역할 = 작업지시서 피드백만** (§0.1 / §0.3 / §8 / §14.3 재확인)
  - **Claude Code 역할 = repo 실제 코드 작성 / 검증 / diff / commit / push** (§0.1 / §0.4)
  - **GPT 역할 = 작업지시서 초안 전문 작성 + 최종 전문 작성 + commit 메시지 작성** (§0.1 / §0.5)
  - **14단계 흐름** (§0.2) — Gate 1 (사전 조사) → Gate 2 (코드 작성) → Gate 3 (commit) → Gate 4 (push) + Gate 5/6 (PR/main merge 별도 승인)
  - **4 Gate** 승인 게이트 (§12.1)
  - **commit 한 줄 원칙** (§12.2) — 기본 한 줄 subject. multi-line body는 사용자 별도 요청 시에만
  - **PR / main merge 별도 승인 원칙** (§13) — feature branch push까지는 Gate 4까지, main merge는 항상 Gate 5/6 별도
  - DP prefix 명명 규칙 (§6) — DP-1~7 (c-r1) / DP-S1~7 (v0.3.0 score) / DP-STR* (v0.4.0 structure) / DP-CYC* / DP-STG* 등
  - 변수 치환 체크리스트 (§16) — `{{...}}` 34종
  - v0 → v0.1 개정 사항 (§17) — GPT 검토 6건 반영
- 원본 파일: `C:\Users\neosi\Desktop\WOOS_V3\Output\WS3_Workflow_Template_v0_1.md` (24,261 B, SHA256 무결성 검증)

### Changed
- `/docs/ws3/WS3_CHANGELOG.md` (본 파일): `[v0.3.0-docs]` 엔트리 상단 추가
- `/docs/ws3/WS3_CURRENT_BASELINE.md`: 운영 문서 섹션에 `WS3_WORKFLOW_TEMPLATE.md` 추가

### Functional Baseline (변경 없음)
- 기능 baseline: **WS3 v0.3.0 scoreBreakdown core** (`b7e0ea3`) — 본 단계는 문서 박제이므로 기능 버전 상승 X
- 다음 기능 단계: **WS3 v0.4.0 structureBucket / priceZone / referenceLow 확정**

### Protected (수정 0건)
- `v3-config.js` / `v3-feature-payload.js` / `v3-bithumb-client.js` / `v3-candle-normalizer.js` / `v3-indicators.js` / `v3-feature-payload-builder.js` / `v3-score-breakdown.js`
- `docs/ws3/WS3_CODE_CONTRACT.md` (b-r2 박제본 그대로)
- `index.html` / `manifest.json` / `service-worker.js` / `worker.js` / `wrangler.toml`

### Code change
- **0건** (문서 박제 전용 단계)

### Verified
- 원본 파일 SHA256 == 복사본 SHA256 (`FC9E66F9...8FCF0D`)
- 보호 파일 `git diff` 빈 출력 = 0건
- 구버전 표현 grep 0건 (`Claude Web 산출물 생성` / `사용자 산출물 다운로드` / `Claude Web 작업지시서 생성`)
- 역할 분담 grep 매치 확인 (§0.1)

### 기준 commit
- branch: `claude/heuristic-cori-7865e7`
- 이전 baseline: WS3 v0.3.0 scoreBreakdown core (`b7e0ea3`)
- 본 commit: (push 후 기록)

---

## [v0.3.0] — 2026-05-16 (scoreBreakdown 본체)

### Added
- `/v3/v3-score-breakdown.js` — scoreBreakdown 본체 (신규)
  - `WS3_ScoreBreakdown.build(payload, config)` → standalone scoreBreakdown 객체 (13 top-level field payload mutate 0건)
  - 5 component (core 25 / structure 20 / volume 20 / momentum 15 / execution 20 = 100)
  - riskPenalty 최대 15
  - `grossScore = sum(components)`, `totalScore = clamp(grossScore - riskPenalty, 0, maxScore)`
  - 이중 환경 export: `global.WS3_ScoreBreakdown` + `module.exports`
- `/docs/ws3/WS3_v0_3_0_SCORE_BREAKDOWN_REPORT.md` — 완료 보고서 (신규)

### Adopted DP Policy
- **DP-S1** payload mutate 금지. standalone 객체 반환.
- **DP-S2** weight 25/20/20/15/20 = 100. config override 가능.
- **DP-S3** unavailable component → valid=false + score=0. sub-signal 부분 누락 → 부분점 + warning.
- **DP-S4** payload.risk 기본값(penalty=null, level='UNKNOWN', flags=[])이면 penalty 0.
- **DP-S5** grade / tier / label / P-S/A/B 미산출.
- **DP-S6** buyPressure 점수 미반영. core에서 object 존재만 검사.
- **DP-S7** DEFAULT_SCORE_CONFIG 본 파일 내부 보관. v3-config.js 미수정.
- **DP-S8** core(존재성/구조) vs execution(양적 충분성) 평가 범위 분리. 중복 점수화 금지.
- **DP-S9** valid(계산 가능 여부) vs totalScore(신호 강도) 분리.
- **N-1** 빈 객체 component → valid=false + score=0 + `NO_*_SIGNALS` warning.
- **N-2** buyPressure 점수 미반영 (DP-S6 정합).
- **N-3** marketContext 점수 미반영. core에서 object 존재만.
- **N-4** tradeValue 통계 키 (`currentTradeValueKrw` 등) v3-indicators 출력 그대로 사용.
- **N-5** indicator warnings → execution 감점 + 경미한 riskPenalty. 중복 감점 X (builderWarnCap=4 / indicatorWarnCap=2).

### Indicator state 라벨 활용 (별도 임계값 하드코딩 0건)
- RSI state: STRONG=4 / OVERBOUGHT=2 / NEUTRAL=1 / OVERSOLD=1 / OVERHEATED=0
- MFI state: STRONG_BUY_PRESSURE=4 / BUY_PRESSURE=3 / NEUTRAL=1 / LOW=1 / OVERHEATED=0
- OBV trend: UP=3 / FLAT=1 / DOWN=0
- MA trendLabel: MA_BULLISH=4 / MA_ABOVE_MIXED=2 / MA_FLAT=1 / MA_MIXED=1 / 나머지=0
- volumeState: EXTREME=8 / SURGE=6 / RISING=4 / NORMAL=2 / LOW=0

### Changed
- `/docs/ws3/WS3_CHANGELOG.md` (본 파일): `[v0.3.0]` 엔트리 상단 추가
- `/docs/ws3/WS3_CURRENT_BASELINE.md`: 완료된 단계 표 + 보호 파일 목록 + 모듈 의존성 + 다음 단계 갱신

### Protected (수정 0건)
- `v3-config.js` / `v3-feature-payload.js` / `v3-bithumb-client.js` / `v3-candle-normalizer.js` / `v3-indicators.js` / `v3-feature-payload-builder.js`
- `docs/ws3/WS3_CODE_CONTRACT.md` (b-r2 박제본 그대로)
- `index.html` / `manifest.json` / `service-worker.js`

### 의도된 미구현 (이번 단계 제외)
- `grade` 산출 / `tier` / `label` / `P-S/A/B`
- `signalCycle` / `structureBucket` 최종 판정
- `strategyBias` / `entryPlan` / `exitPlan`
- `renderer` / `cardViewModel` / `UI`
- `externalConfluence` / `Telegram`
- `buyPressure` 계산 / `marketContext` 라벨링 (createEmpty default 유지)
- 외부 호출 (외부 API / DOM / 브라우저 storage / KV) 0건
- 런타임 clock API 사용 0건

### Verified
- `node --check v3/v3-score-breakdown.js` 통과
- smoke test (h1 60개 synthetic candle) 통과:
  - `valid: true / grossScore: 84 / riskPenalty: 0 / totalScore: 84`
  - components 5개 / max 합계 100
  - grade/signalCycle/entryPlan/exitPlan/tier/label 모두 부재
  - **payload mutated: false** (DP-S1)
- edge null: `valid=false / grossScore=0 / totalScore=0` + components shape 유지
- edge empty signals (createEmpty + identity 채움): `valid=true / totalScore=31` (DP-S9 — momentum/volume/structure valid=false, core/execution valid=true)
- 금지 패턴 grep (identifier 기반):
  - `(grade|signalCycle|entryPlan|exitPlan)\s*[:=]` 0건
  - `\.(grade|signalCycle|entryPlan|exitPlan)` 0건
  - `delete payload.` 0건
  - `fetch(` / `document.` / `localStorage` / `sessionStorage` / `XMLHttpRequest` / `Date.now(` 0건 (주석에도 literal 0건)
  - `payload.<x> = mutation` 0건 (line 563 `===` 비교문 false-positive 검토 완료)
- 보호 파일 `git diff` 빈 출력 = 0건

### 기준 commit
- branch: `claude/heuristic-cori-7865e7`
- 이전 baseline: WS3 v0.2.0-c-r1 (`51e510d`)
- 본 commit: (push 후 기록)

---

## [v0.2.0-c-r1] — 2026-05-16 (buildFeaturePayload Builder)

### Added
- `/v3/v3-feature-payload-builder.js` — WS3 v0.2.0-c-r1 builder 본체 (신규)
  - `WS3_FeaturePayload.createEmpty()` 기반 13 top-level field 조립
  - `WS3_FeaturePayload.isValid(payload) === true` 통과 보장
  - 이중 환경 export: `global.WS3_FeaturePayload_Builder` + `module.exports`
- `/docs/ws3/WS3_v0_2_0_c_r1_BUILD_REPORT.md` — 완료 보고서 (신규)

### Adopted DP Policy
- **DP-1** ts 우선순위: `marketCtx.ts` > primary candle.ts > `null`. `Date.now()` 금지.
- **DP-2** canonical `tradeValue`만 외부 노출. `value/amount/quoteVolume` alias 금지. indicators 내부 통계 키(`currentTradeValueKrw` 등)는 v3-indicators.js 결과 그대로 보존 (U-1).
- **DP-3** 별도 파일 신규. `v3-feature-payload.js` 미수정 (build 함수 throw 유지).
- **DP-4** validator 현행 유지. builder가 `createEmpty` 기반으로 13 key 보장.
- **DP-5** `normalizeIdentity(identity, input, builderDebug)` helper. `'KRW-BTC'` → `quote='KRW'` / `base='BTC'` 분해. 분해 실패 시 throw 없이 createEmpty default + warning.
- **DP-6** `V3BuildMarketCtx` typedef. 안전 정규화 (throw 없이 fallback).
- **DP-7** `raw.builderDebug` 디버그 보조 구조 (builderVersion / warnings / primaryTimeframe / resolvedTsSource / candleCounts / identityInput).
- **U-2** `V3BuildCandlesInput` typedef. `{ m5, m15, h1, h4, d1 }` 객체 입력. 단일 배열 X.

### Indicator Snapshot Mapping
- `payload.momentum` ← `rsi` / `mfi` / `obv` / `ma`
- `payload.volume` ← `volume` / `volumeAcceleration` / `tradeValue` (indicators 내부 통계 키 그대로)
- `payload.structure` ← `candleShape` / `candleStructure` / `structure`
- `payload.indicators` ← `atr` / `snapshotValid` / `warnings` / `debug` / `indicatorVersion`

### Changed
- `/docs/ws3/WS3_CHANGELOG.md` (본 파일): `[v0.2.0-c-r1]` 엔트리 상단 추가
- `/docs/ws3/WS3_CURRENT_BASELINE.md`: 완료된 단계 표 + 보호 파일 목록 + 다음 단계 갱신

### Protected (수정 0건)
- `v3-feature-payload.js` (build 함수 throw 유지 — DP-3-A 정합)
- `v3-config.js` / `v3-bithumb-client.js` / `v3-candle-normalizer.js` / `v3-indicators.js`
- `index.html` / `manifest.json` / `service-worker.js`
- `docs/ws3/WS3_CODE_CONTRACT.md` (b-r2 박제본 그대로)

### 의도된 미구현 (이번 단계 제외)
- `buyPressure` 계산/라벨링 (createEmpty default `BUY_PRESSURE_UNKNOWN` 유지)
- `marketContext` 라벨링 (createEmpty default `UNKNOWN` 유지)
- `scoreBreakdown` / `grade` / `signalCycle` / `structureBucket` 최종 판정
- `strategyBias` / `entryPlan` / `exitPlan`
- `renderer` / `cardViewModel` / `UI`
- `externalConfluence` / `Telegram`
- `fetch` / `document` / `localStorage` / `KV` 직접 호출 0건
- `Date.now()` 사용 0건

### Verified
- `node --check v3/v3-feature-payload-builder.js` 통과
- smoke test (h1 60개 synthetic candle) 11항목 모두 통과:
  - `Object.keys(payload).length === 13`
  - `WS3_FeaturePayload.isValid(payload) === true`
  - 5 timeframe 모두 Array
  - `identity.quote` / `identity.exchange` 모두 string
  - `payload.ts === sampleCandles.h1[last].ts` (DP-1 우선순위 2 적용)
  - `payload.buyPressure.state === 'BUY_PRESSURE_UNKNOWN'`
- 안전성 검증: `build(null, null)` → isValid true + warnings `['INVALID_CANDLES_SHAPE', 'MISSING_MARKET', 'EMPTY_PRIMARY_CANDLES']`
- 금지 패턴 grep:
  - `Date.now(` 코드 침범 0건 (주석 3건만)
  - `fetch(` / `delete payload.` / `skipPlaceholders` / `omitNullSlots` / alias 노출 / DOM·localStorage 코드 침범 0건
- 보호 파일 `git diff` 빈 출력 = 0건

### 기준 commit
- branch: `claude/heuristic-cori-7865e7`
- 이전 baseline: WS3 v0.2.0-b-r2 (`04eac43`)
- 본 commit: (push 후 기록)

---

## [v0.2.0-b-r2] — 2026-05-14 (Code Contract Freeze)

### Added
- `/docs/ws3/WS3_CODE_CONTRACT.md` — v3-feature-payload.js 등 실제 코드 계약 박제 (단일 기준 문서)
  - top-level field 목록 박제 (13개 — identity/ts/candles/indicators/structure/volume/momentum/marketContext/buyPressure/coinMeta/newsContext/risk/raw)
  - createEmpty() 초기값 박제 (identity.quote='KRW' / identity.exchange='BITHUMB' / coinMeta=null / newsContext=null / marketContext.state='UNKNOWN' / buyPressure.state='BUY_PRESSURE_UNKNOWN' / risk={penalty,level,flags})
  - isValid() 검사 항목 목록 박제 (string / array / object / 미검사 항목 분리)
  - ts canonical (V3Candle: number / V3FeaturePayload: number\|null / createEmpty: null)
  - tradeValue canonical = "tradeValue" (close * volume 산출)
  - v3-bithumb-client.js 사실 박제: o.market 사용, base/quote/displayName 직접 사용 X
  - export 박제: `Object.freeze({createEmpty, build, isValid})` IIFE
  - DECISION_PENDING (DP-1 / DP-2 / DP-3) 박제 — 본 b-r2 에서 결정 X
- `/docs/ws3/WS3_v0_2_0_b_r2_CODE_CONTRACT_FREEZE_REPORT.md` — 완료 보고서

### Changed (정정만)
- `/docs/ws3/WS3_CHANGELOG.md` (본 파일):
  - 이전 오기 표현 (잘못된 슬롯 수 표기) → "top-level field"
  - v0.2.0-c 처리 (아래 엔트리 참고)
- `/docs/ws3/WS3_CURRENT_BASELINE.md`:
  - baseline 목록에 v0.2.0-b-r1 / v0.2.0-b-r2 추가
  - v0.2.0-c REJECTED / NOT APPLIED 명시
  - 다음 단계 순서 (v0.3.0~v0.8.0) 명시
  - WS3_CODE_CONTRACT.md 가 단일 기준임을 명시

### Protected (수정 0건)
- `.js` 파일 0건 수정 / 0건 신규
- 보호 파일 모두 무손상

### 기준 commit
- branch: `claude/heuristic-cori-7865e7`
- 이전 baseline: WS3 v0.2.0-b-r1 (`da00e62`)
- 본 commit: (push 후 기록)

### Verified
- b-r1 commit `da00e62` 로컬 + remote 존재 확인 ✅
- Gate 1 grep 결과 박제 완료
- 보호 파일 0건 변경
- 새 .js 파일 0건 생성

---

## [v0.2.0-c] — 1차 수정본 — REJECTED — repo 반영 보류

### Status
```text
REJECTED / NOT APPLIED
적용 보류 / commit 금지
```

### 사유
v3-feature-payload.js 코드 계약 위반 6건 (GPT 감사 결과):
1. top-level `ts` 필드 누락 (실제는 13개 field 중 하나)
2. `candles` 구조 다름 — builder 산출은 `{valid, data, count, totalAvailable, policy}`, 실제 계약은 `{m5, m15, h1, h4, d1}` 배열
3. `identity` 구조 다름 — builder 산출은 `{valid, base, exchange, symbol, timeframe, detectedAt}`, 실제 계약은 `{base, quote, market, exchange, displayName}` + default 값 명시
4. 자체 validator 가 기존 `WS3_FeaturePayload.isValid()` 와 다름
5. 이전 오기 표현 (잘못된 슬롯 수 표기 — 실제는 13개 top-level field)
6. b-r1 핫픽스가 v0.2.0-c 보다 먼저 와야 했음

### 처리
- repo 미반영 / rejected artifact
- 재작성은 별도 단계 `v0.2.0-c-r1` 로 분리
- 단일 기준: `WS3_CODE_CONTRACT.md` (b-r2 박제본)

---

## [v0.2.0-b-r1] — 2026-05-15

Baseline Consistency Hotfix. 기능 변경 없음. 문서/주석/fallback 후보키만 정리.

### Commit
- commit: `da00e62`
- branch: `claude/heuristic-cori-7865e7`

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
  - `DEFAULT_INDICATOR_CONFIG` 박제
  - `mergeIndicatorConfig(config)` helper
  - 각 함수가 `configUsed` 반환
- `/docs/ws3/WS3_v0_2_0_b_INDICATOR_SKELETON_REPORT.md` — 완료 보고서

### Commit
- branch: `claude/heuristic-cori-7865e7`
- commit: `c98cbd88b048c3e51571030b696a6b590e2c0030`

### Design
- 함수 시그니처 `calculate*(candles, config = {})` 표준화
- MA/RSI/MFI/OBV/ATR/거래량/거래대금/캔들구조 기준값 = config override 가능
- 전통 캔들패턴명 (도지/망치형/장악형 등) 미구현
- V3에서 캔들패턴 = candleStructureFeatures 보조값
- structureBucket 최종 판정 X (WS3 v0.4.0에서)

---

## [v0.2.0-a] — (이전 baseline)

### Added
- `/v3/v3-bithumb-client.js`
- `/v3/v3-candle-normalizer.js`

---

## [v0.1.0] — (이전 baseline)

### Added
- `/v3/v3-config.js`
- `/v3/v3-feature-payload.js` (코드 계약 정의 — WS3_CODE_CONTRACT.md 박제 대상)
