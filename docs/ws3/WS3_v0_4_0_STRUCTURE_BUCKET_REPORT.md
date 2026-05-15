# WS3 v0.4.0 structureBucket 본체 작성 완료 보고

> **작업일자**: 2026-05-16
> **이전 baseline (functional)**: WS3 v0.3.0 scoreBreakdown core (`b7e0ea3`)
> **이전 commit (직전)**: WS3 v0.3.0-docs Workflow Template v0.1 (`d8bebc2`)
> **branch**: `claude/heuristic-cori-7865e7`
> **작업 성격**: structureBucket / priceZone / referenceLow 확정 신규 모듈. 보호 파일 수정 0건. payload / scoreBreakdown mutation 0건.

---

## 생성 파일

- `/v3/v3-structure-bucket.js` — **이번 단계의 핵심 산출물**
- `/docs/ws3/WS3_v0_4_0_STRUCTURE_BUCKET_REPORT.md` (이 파일)

## 갱신 파일

- `/docs/ws3/WS3_CHANGELOG.md` — `[v0.4.0]` 엔트리 상단 추가
- `/docs/ws3/WS3_CURRENT_BASELINE.md` — 완료된 단계 표 + 보호 파일 목록 + 모듈 의존성 + 다음 단계 갱신

## 수정 0건 (보호 파일)

```text
v3/v3-config.js
v3/v3-feature-payload.js
v3/v3-bithumb-client.js
v3/v3-candle-normalizer.js
v3/v3-indicators.js
v3/v3-feature-payload-builder.js
v3/v3-score-breakdown.js
docs/ws3/WS3_CODE_CONTRACT.md (b-r2 박제본 그대로)
docs/ws3/WS3_WORKFLOW_TEMPLATE.md (v0.1 박제본 그대로)
index.html / manifest.json / service-worker.js
```

`git diff` 빈 출력 검증 완료.

---

## 확정 path (CASE B 이중 nesting)

| 의미 | path |
|---|---|
| structure root | `payload.structure.structure` |
| box | `payload.structure.structure.box` |
| referenceLows (복수형 's') | `payload.structure.structure.referenceLows` |
| priceZone | `payload.structure.structure.priceZone` |
| sweepReclaim | `payload.structure.structure.sweepReclaim` |
| touch count | `payload.structure.structure.box.touchesHigh / touchesLow` |
| distance | `payload.structure.structure.box.distanceToTopPct / distanceToBottomPct` |
| currentClose | `payload.candles[primaryTimeframe]` last `.close` |
| primaryTimeframe | `payload.raw.builderDebug.primaryTimeframe || 'h1'` |

---

## 적용 정책 (DP-STR + N-STR)

| ID | 정책 | 적용 |
|---|---|---|
| **DP-STR1** | standalone structureDecision, payload/scoreBreakdown mutate 금지 | smoke `payload mutated: false / scoreBreakdown mutated: false` 검증 ✓ |
| **DP-STR2** | 13 structureBucket 후보 | `classifyStructureBucket` 13종 분기 |
| **DP-STR3** | priceZone source 우선순위 (structureRoot → box distance → UNKNOWN) | `getPriceZone()` + `deriveZoneFromBoxDistance()` |
| **DP-STR4** | referenceLow 선택 (sweep/reclaim → 최근 valid → null), `distancePct = (currentClose - refLow) / currentClose * 100` | `getReferenceLow()` + `computeDistancePct()` |
| **DP-STR5** | 4-touch 기준 (`breakoutTouchCount=4`, `breakdownTouchCount=4`, touch count 재계산 X) | `getBoxContext()` + `classifyStructureBucket()` 3단계 |
| **DP-STR6** | confidence 0~100 (등급 금지). 가산식 box+25 / priceZone+20 / refLow+20 / sweep/reclaim+20 / structureScore≥15 +15 | `calculateStructureConfidence()` |
| **DP-STR7** | scoreBreakdown.components.structure.score만 confidence 보조값. totalScore 미사용 | smoke debug에서 `scoreBreakdownUsed: true / structureScore: 17` 확인. totalScore 참조 0건 |
| **DP-STR8** | riskPenalty 미반영 | `payload.risk` / `scoreBreakdown.risk` 참조 0건 |
| **DP-STR9** | ABOVE_BOX → ABOVE_BOX_CONFIRMED_CANDIDATE / BELOW_BOX → BELOW_BOX_CONFIRMED_CANDIDATE | `classifyStructureBucket()` 2단계 |
| **DP-STR10** | 분류 우선순위 (sweep/reclaim → box 외부 → box pressure → priceZone → fallback) | smoke 시나리오 1에서 reclaim 우선순위 적용 확인 (`RECLAIM_READY` 분류) |
| **N-STR-1** | referenceLows 복수형 's' | `getReferenceLow()`: `structureRoot.referenceLows` 접근 |
| **N-STR-2** | 각 sub-component valid 개별 점검 | box / priceZone / referenceLow / sweepReclaim 각자의 `.valid` 별도 확인 |
| **N-STR-3** | currentClose = primary timeframe 마지막 candle.close | `getCurrentClose()` + `getPrimaryTimeframe()` |
| **N-STR-4** | confidence 가산 조건 (`structure.valid === true && score >= 15`) | `calculateStructureConfidence()` 가산 조건 |
| **N-STR-5** | UNKNOWN / NO_STRUCTURE 시 confidence = 0 | `calculateStructureConfidence()` 첫 줄 분기 |

---

## structureBucket 13 후보

```
UNKNOWN
NO_STRUCTURE
BOX_MIDDLE
BOX_TOP_PRESSURE
BOX_BOTTOM_RISK
ABOVE_BOX_CONFIRMED_CANDIDATE      ← 가격 위치가 box.boxHigh 위
BELOW_BOX_CONFIRMED_CANDIDATE      ← 가격 위치가 box.boxLow 아래
LOW_SWEEP_PENDING                  ← lowSweepCandidate만
LOW_SWEEP_RECLAIM_CANDIDATE        ← lowSweepCandidate + reclaimCandidate
HIGH_SWEEP_REJECT_CANDIDATE        ← highSweepCandidate
RECLAIM_READY                      ← reclaimCandidate만
BREAKOUT_PRESSURE_CANDIDATE        ← touchesHigh >= 4
BREAKDOWN_RISK_CANDIDATE           ← touchesLow >= 4
```

> CONFIRMED_CANDIDATE 는 가격 위치 분류이며 진입/신호/등급 확정 아님.

---

## DEFAULT_STRUCTURE_BUCKET_CONFIG

```js
{
  version: 'inline-default-v0',
  priceZone: { topNearPct: 15, bottomNearPct: 15, breakoutBufferPct: 2 },
  box:       { breakoutTouchCount: 4, breakdownTouchCount: 4 },
  confidence: {
    boxValid: 25,
    priceZoneValid: 20,
    referenceLowValid: 20,
    sweepReclaimValid: 20,
    structureScoreHigh: 15,
    structureScoreHighThreshold: 15
  }
}
```

→ 모든 임계값은 `mergeStructureBucketConfig(config)`로 override 가능. v3-config.js는 미수정.

---

## 검증 결과

### node --check
```
node --check v3/v3-structure-bucket.js
OK_STRUCTURE
```

### smoke test — 4 시나리오 모두 통과

#### Scenario 1 — consolidation box (h1 60개)
```
structureBucket: RECLAIM_READY    (분류 우선순위 DP-STR10 1번 적용 — reclaimCandidate=true 트리거)
confidence: 100
priceZone: { valid: true, zone: 'TOP_NEAR', source: 'STRUCTURE_PRICE_ZONE' }
referenceLow: { valid: true, value: 99500, source: 'SWEEP_RECLAIM_PREVIOUS_LOW', distancePct: 0.6 }
boxContext: { valid: true, boxHigh: 100500, boxLow: 99500, touchesHigh: 40, touchesLow: 40 }
sweepReclaimContext: { valid: true, low: false, high: false, reclaim: true }
debug.actualStructurePath: payload.structure.structure
debug.scoreBreakdownUsed: true
debug.structureScore: 17
payload mutated: false / scoreBreakdown mutated: false
```

#### Scenario 2 — low sweep + reclaim (h1 60개)
```
structureBucket: LOW_SWEEP_RECLAIM_CANDIDATE   (예상대로)
confidence: 100
sweepReclaimContext: { valid: true, low: true, high: false, reclaim: true }
debug.scoreBreakdownUsed: true
debug.structureScore: 20
payload mutated: false / scoreBreakdown mutated: false
```

#### Scenario 3 — empty / createEmpty payload
```
structureDecision.valid: false
structureBucket: NO_STRUCTURE       (N-STR-5: confidence=0)
confidence: 0
priceZone.zone: UNKNOWN
debug.actualStructurePath: null      (structureRoot 부재 — createEmpty의 payload.structure는 {})
debug.scoreBreakdownUsed: false
```

#### Scenario 4 — null payload
```
structureDecision.valid: false
structureBucket: NO_STRUCTURE
confidence: 0
components shape preserved: true     (priceZone / referenceLow / boxContext / sweepReclaimContext 4종 모두 객체 보존)
warnings: ['PAYLOAD_NOT_OBJECT']
```

### 공통 검증 (4 시나리오 전체)
- structureDecision.valid boolean ✓
- structureBucket 존재 ✓
- priceZone / referenceLow / boxContext / sweepReclaimContext 객체 모두 존재 ✓
- confidence 0~100 ✓
- grade / signalCycle / entryPlan / exitPlan field 부재 ✓
- **payload 원본 mutation 0건** ✓
- **scoreBreakdown 원본 mutation 0건** ✓

### 금지 패턴 grep (identifier 기반)

| 패턴 | 매치 | 평가 |
|---|---|---|
| `(grade\|signalCycle\|entryPlan\|exitPlan)\s*[:=]` | 0 | ✅ assignment/key 0건 |
| `\.(grade\|signalCycle\|entryPlan\|exitPlan)` | 0 | ✅ property access 0건 |
| `payload\.[a-zA-Z]+\s*=` | 0 | ✅ mutation 0건 (이전 단계 false-positive조차 없음) |
| `scoreBreakdown\.[a-zA-Z]+\s*=` | 0 | ✅ mutation 0건 |
| `delete\s+payload\.\|delete\s+scoreBreakdown\.` | 0 | ✅ |
| `fetch(\|document.\|localStorage\|sessionStorage\|XMLHttpRequest\|Date.now(` | 0 | ✅ (주석 literal도 0건) |
| refined: `(^\|[^A-Za-z0-9_])P-(S\|A\|B)([^A-Za-z0-9_]\|$)\|Telegram\|externalConfluence\|렌더 계층 식별자/UI 모델 literal` | 0 | ✅ |

→ **코드 침범 0건. 주석 literal 0건.** (이전 builder / score 핫픽스 학습 반영 완료)

### 보호 파일 diff
```
git diff -- v3/v3-config.js v3/v3-feature-payload.js v3/v3-bithumb-client.js \
            v3/v3-candle-normalizer.js v3/v3-indicators.js \
            v3/v3-feature-payload-builder.js v3/v3-score-breakdown.js \
            docs/ws3/WS3_CODE_CONTRACT.md docs/ws3/WS3_WORKFLOW_TEMPLATE.md \
            index.html manifest.json service-worker.js
PROTECTED_DIFF_END   (빈 출력)
```
→ **보호 파일 12종 0건 변경**.

---

## 미구현 항목 (이번 단계 의도된 제외 / DP-STR5/8 + 작업지시서 §3)

- **grade / tier / 등급 코드 산출** — 별도 단계 (별도 승인 후)
- **signalCycle / persistence / cooldown** — v0.5.0
- **strategyBias / entryPlan / exitPlan** — v0.6.0
- **renderer / cardViewModel / UI** — v0.7.0
- **알림 연동 / snapshot / evaluation** — v0.8.0
- **외부 신호 / LW activeCycle** — v0.9.x+
- **riskPenalty 반영** — DP-STR8, 후속 strategyBias / entryPlan 단계
- **새 캔들 fetch / 새 지표 계산 / touch count 재계산** — 모두 0건
- **외부 호출** (외부 API / DOM / 브라우저 storage / KV) 0건
- **런타임 clock API 사용** 0건

---

## 다음 단계

```text
WS3 v0.5.0 — signalCycle / persistence / cooldown
  목적: 반복 신호 milestone(3/5/10회) + cooldown
        + priceZone 기준 cycle 묶음
  의존: v3-structure-bucket.js의 structureDecision + priceZone
```

이후 v0.6.0 ~ v0.9.0+ 순서는 [WS3_CURRENT_BASELINE.md "다음 단계"](docs/ws3/WS3_CURRENT_BASELINE.md) 그대로.

---

## 한 줄 결론

```
v3FeaturePayload.structure.structure (CASE B 이중 nesting) + scoreBreakdown.components.structure를
standalone structureDecision으로 조립. 13 bucket 분류 + confidence 0~100.
보호 파일 12종 무손상 / payload·scoreBreakdown mutation 0건 / DP-STR1~10 + N-STR-1~5 모두 적용 /
grade·signalCycle·entryPlan·exitPlan 미산출 / smoke 4 시나리오 (consolidation / sweep+reclaim / empty / null) 모두 통과.
```
