# WS3 v0.3.0 scoreBreakdown 본체 작성 완료 보고

> **작업일자**: 2026-05-16
> **이전 baseline**: WS3 v0.2.0-c-r1 (`51e510d`)
> **branch**: `claude/heuristic-cori-7865e7`
> **작업 성격**: scoreBreakdown 본체 작성 + 문서 갱신. 보호 파일 수정 0건. payload mutation 0건.

---

## 생성 파일

- `/v3/v3-score-breakdown.js` — **이번 단계의 핵심 산출물** (~880 lines)
- `/docs/ws3/WS3_v0_3_0_SCORE_BREAKDOWN_REPORT.md` (이 파일)

## 갱신 파일

- `/docs/ws3/WS3_CHANGELOG.md` — `[v0.3.0]` 엔트리 상단 추가
- `/docs/ws3/WS3_CURRENT_BASELINE.md` — 완료된 단계 표 + 보호 파일 목록 + 모듈 의존성 + 다음 단계 갱신

## 수정 0건 (보호 파일)

```text
v3/v3-config.js
v3/v3-feature-payload.js
v3/v3-bithumb-client.js
v3/v3-candle-normalizer.js
v3/v3-indicators.js
v3/v3-feature-payload-builder.js
index.html
manifest.json
service-worker.js
docs/ws3/WS3_CODE_CONTRACT.md (b-r2 박제본 그대로)
```

`git diff` 빈 출력으로 검증 완료.

---

## 적용 정책 (DP)

| ID | 정책 | 적용 |
|---|---|---|
| **DP-S1** | payload mutate 금지 | smoke test에서 `payload mutated: false` 검증 ✓ |
| **DP-S2** | weight 25/20/20/15/20 = 100. config override | `mergeScoreConfig()` |
| **DP-S3** | unavailable → component valid=false + score=0. sub-signal 부분 누락 → 부분점 + warning | `makeResult()` / `normalizeComponentResult()` |
| **DP-S4** | payload.risk 기본값(penalty=null, level='UNKNOWN', flags=[])이면 penalty 0 | `calculateRiskPenalty()` — `isDefault` 분기 |
| **DP-S5** | grade / tier / label / P-S/A/B 미산출 | 출력 객체에 모두 부재. smoke test로 검증 |
| **DP-S6** | buyPressure 점수 미반영. core에서 object 존재만 검사 | `scoreCore()` step buyPressure object 검사만 |
| **DP-S7** | DEFAULT_SCORE_CONFIG 내부 보관. v3-config.js 미수정 | `DEFAULT_SCORE_CONFIG` |
| **DP-S8** | core(존재성/구조) vs execution(양적 충분성) 분리. 중복 점수화 금지 | core=key/type/isValid, execution=candleCount/ts/warnings (중복 없음) |
| **DP-S9** | valid(계산 가능 여부) vs totalScore(신호 강도) 분리 | smoke edge `empty signals` → valid=true, totalScore=31 |
| **N-1** | 빈 객체 component → valid=false + score=0 + `NO_*_SIGNALS` warning | scoreStructure/scoreVolume/scoreMomentum 초입 |
| **N-2** | buyPressure 점수 미반영 (DP-S6과 정합) | scoreCore에서 object 존재만 |
| **N-3** | marketContext 점수 미반영 | scoreCore에서 object 존재만 |
| **N-4** | tradeValue 통계 키 (currentTradeValueKrw 등) v3-indicators 출력 그대로 사용 | scoreVolume이 v.tradeValue.valid만 검사 |
| **N-5** | indicator warnings → execution 감점 + 경미한 riskPenalty. 중복 감점 X | scoreExecution + calculateRiskPenalty 양쪽 cap (builderWarnCap=4 / indicatorWarnCap=2) |

---

## scoreBreakdown 출력 예시 (smoke test 정상 payload)

```js
{
  valid: true,
  version: 'WS3_v0.3.0',
  grossScore: 84,
  riskPenalty: 0,
  totalScore: 84,
  maxScore: 100,
  components: {
    core:       { valid: true, score: 25, max: 25, reasons: [14건], warnings: [] },
    structure:  { valid: true, score: 18, max: 20, reasons: [9건],  warnings: [] },
    volume:     { valid: true, score: 14, max: 20, reasons: [4건],  warnings: [] },
    momentum:   { valid: true, score: 7,  max: 15, reasons: [4건],  warnings: [] },
    execution:  { valid: true, score: 20, max: 20, reasons: [6건],  warnings: [] }
  },
  risk: {
    penalty: 0,
    maxPenalty: 15,
    reasons: ['RISK_DEFAULT'],
    warnings: []
  },
  warnings: [],
  debug: {
    source: 'v3FeaturePayload',
    payloadValid: true,
    componentMaxSum: 100,
    configVersion: 'inline-default-v0'
  },
  configUsed: { weights, risk, execution }
}
```

> 합계 검증: 25 + 18 + 14 + 7 + 20 = 84 = grossScore ✓
> riskPenalty 0 (default risk) → totalScore = 84 - 0 = 84 ✓

---

## sub-signal 점수 분배 (component 내부)

### core — 25점
| sub-signal | 점수 |
|---|---|
| payload object | 3 |
| 13 top-level field 완전 | 3 |
| WS3_FeaturePayload.isValid 통과 | 6 |
| identity.exchange string | 2 |
| identity.quote string | 2 |
| candles 5 timeframe Array (1×5) | 5 |
| buyPressure object 존재 (N-2: .state 점수화 X) | 1 |
| marketContext object 존재 (N-3) | 1 |
| risk object 존재 | 1 |
| raw object 존재 | 1 |
| **합계** | **25** |

### structure — 20점
| sub-signal | 점수 |
|---|---|
| candleShape valid | 3 |
| candleStructure valid | 3 |
| structure.box valid | 2 |
| structure.priceZone valid | 2 |
| structure.referenceLows valid | 2 |
| structure.sweepReclaim valid | 2 |
| sweepReclaim.lowSweepCandidate | 2 |
| sweepReclaim.reclaimCandidate | 2 |
| candleShape.flags.closeNearHigh | 1 |
| candleShape.flags.longLowerWick | 1 |
| **합계** | **20** |

### volume — 20점
| sub-signal | 점수 |
|---|---|
| volume.valid (calculateVolumeStats) | 4 |
| volumeState 라벨 가산 (EXTREME=8 / SURGE=6 / RISING=4 / NORMAL=2 / LOW=0 / UNKNOWN=0) | 0~8 |
| volumeAcceleration.valid | 4 |
| tradeValue.valid (N-4 — 통계 키 그대로 보존) | 4 |
| **합계 (max)** | **20** |

### momentum — 15점 (v3-indicators state 라벨 활용, 별도 임계값 추가 0건)
| sub-signal | 점수 |
|---|---|
| RSI state (STRONG=4 / OVERBOUGHT=2 / NEUTRAL=1 / OVERSOLD=1 / OVERHEATED=0) | 0~4 |
| MFI state (STRONG_BUY_PRESSURE=4 / BUY_PRESSURE=3 / NEUTRAL=1 / LOW=1 / OVERHEATED=0) | 0~4 |
| OBV trend (UP=3 / FLAT=1 / DOWN=0) | 0~3 |
| MA trendLabel (MA_BULLISH=4 / MA_ABOVE_MIXED=2 / MA_FLAT=1 / MA_MIXED=1 / 나머지=0) | 0~4 |
| **합계 (max)** | **15** |

### execution — 20점 (setup readiness)
| sub-signal | 점수 |
|---|---|
| primary timeframe candle count (≥60: 5 / ≥30: 3 / ≥10: 1 / else: 0) | 0~5 |
| payload.ts resolved (number, finite) | 3 |
| identity market 분해 성공 (market/base/quote string) | 3 |
| candles 5 timeframe Array shape 정상 | 3 |
| builderDebug warnings 0 (3) / >0 (1) / 없으면 0 | 0~3 |
| indicator snapshot warnings 0 + snapshotValid true (3) / partial (1) | 0~3 |
| **합계 (max)** | **20** |

### risk penalty — 최대 15점
| 위험 사유 | 가중 | cap |
|---|---|---|
| risk.level === 'HIGH' | 5 | — |
| risk.level === 'MID' | 2 | — |
| risk.flags 개수 | 1 per | 3 |
| risk.penalty override (number, >0) | 그 값 | 5 |
| builderDebug critical warnings (EMPTY_PRIMARY_CANDLES / INVALID_CANDLES_SHAPE / MISSING_MARKET / INVALID_MARKET_FORMAT / 등) | 2 per | 4 |
| indicator warnings | 1 per | 2 |
| **최종** | sum | clamp 0~15 |

---

## 검증 결과

### node --check
```
node --check v3/v3-score-breakdown.js
OK_SCORE
```

### smoke test — normal payload (h1 60개 synthetic)
| 항목 | 결과 |
|---|---|
| `valid` | ✅ true |
| `version` | ✅ 'WS3_v0.3.0' |
| `grossScore` 0~100 | ✅ 84 (in range) |
| `riskPenalty` 0~15 | ✅ 0 (in range, default risk) |
| `totalScore` 0~100 | ✅ 84 (in range) |
| `components` 5개 (core/structure/volume/momentum/execution) | ✅ |
| component max 합계 === 100 | ✅ 25+20+20+15+20 |
| `grade` / `signalCycle` / `entryPlan` / `exitPlan` / `tier` / `label` field 부재 | ✅ 6/6 absent |
| **payload mutated** | ✅ false (DP-S1) |

per-component:
```
core:       valid=true, score=25/25, reasons=14, warnings=0
structure:  valid=true, score=18/20, reasons=9,  warnings=0
volume:     valid=true, score=14/20, reasons=4,  warnings=0 (volumeState=RISING)
momentum:   valid=true, score=7/15,  reasons=4,  warnings=0
execution:  valid=true, score=20/20, reasons=6,  warnings=0
```

### smoke test — edge null
- `build(null)` → `valid=false / grossScore=0 / totalScore=0` ✓
- components 5개 shape 유지 / max 합계 100 유지 ✓
- 모든 component `valid=false + score=0` + `PAYLOAD_NOT_OBJECT` warning ✓

### smoke test — edge empty signals (createEmpty payload + identity 채움)
- `valid=true` (DP-S9: 계산 가능 여부) / `totalScore=31` ✓
- `momentum/volume/structure.valid = false` (N-1: `NO_*_SIGNALS` warning) ✓
- `core/execution.valid = true` ✓
- → DP-S9 "계산 가능 vs 신호 강도 분리" 정확 동작 검증

### 금지 패턴 grep (identifier 기반)

| grep 패턴 | 매치 수 | 평가 |
|---|---|---|
| `(grade\|signalCycle\|entryPlan\|exitPlan)\s*[:=]` | 0 | ✅ assignment / object key 0건 |
| `\.(grade\|signalCycle\|entryPlan\|exitPlan)` | 0 | ✅ property access 0건 |
| `payload\.[a-zA-Z]+\s*=` | 1 (false-positive) | line 563 `payload.ts === 'number'` 비교문의 `===` 첫 `=` 매치. **mutation 0건** |
| `delete\s+payload\.` | 0 | ✅ DP-S1 |
| `fetch\(\|document\.\|localStorage\|sessionStorage\|XMLHttpRequest\|Date\.now\(` | 0 | ✅ 코드 침범 0건 (주석에도 literal 0건 — v3-feature-payload-builder.js 핫픽스 학습 반영) |
| `P-S\|P-A\|P-B\|structureBucket\|strategyBias\|Telegram\|externalConfluence\|renderer\|cardViewModel` | 13 (모두 셀프-도큐멘팅 주석) | identifier 형태 코드 0건. 모두 헤더 주석의 DP/금지 명시 또는 섹션 마커 |

**코드 침범 0건**.

### 보호 파일 diff
```
git diff -- v3/v3-config.js v3/v3-feature-payload.js v3/v3-bithumb-client.js \
            v3/v3-candle-normalizer.js v3/v3-indicators.js \
            v3/v3-feature-payload-builder.js \
            docs/ws3/WS3_CODE_CONTRACT.md \
            index.html manifest.json service-worker.js
PROTECTED_DIFF_END   (빈 출력)
```
→ **보호 파일 10종 (v3 6종 + web 3종 + CODE_CONTRACT) 0건 변경**.

---

## 미구현 항목 (이번 단계 의도된 제외 / DP-S5 + 작업지시서 §2)

- **grade 산출** (P-S/A/B/tier/label) — 별도 단계 (별도 승인 후)
- **signalCycle / persistence** — v0.5.0
- **structureBucket 최종 판정** — v0.4.0
- **strategyBias / entryPlan / exitPlan** — v0.6.0
- **buyPressure 라벨링/계산** — v0.3 이후
- **marketContext 라벨링** — v0.3 이후
- **renderer / cardViewModel / UI** — v0.7.0
- **Telegram / snapshot / evaluation** — v0.8.0
- **externalConfluence / LW** — v0.9.x+
- **외부 호출** (fetch / DOM / 브라우저 storage / KV) 0건
- **런타임 clock API 사용** 0건

---

## 다음 단계

```text
WS3 v0.4.0 — structureBucket / priceZone / referenceLow 최종 확정
  목적: payload.structure 보조값(sweepReclaim/box/priceZone/referenceLow)을
        BOX_PRESSURE / BOX_BREAKOUT / OB_RECLAIM / LOW_SWEEP_RECLAIM / MA_RECLAIM
        구체 bucket으로 확정
  의존: v3-score-breakdown.js의 structure component reasons 활용 가능
```

이후 v0.5.0 ~ v0.9.0+ 순서는 [WS3_CURRENT_BASELINE.md "다음 단계"](docs/ws3/WS3_CURRENT_BASELINE.md) 그대로.

---

## 한 줄 결론

```
b-r2 WS3_CODE_CONTRACT.md + c-r1 builder 출력 구조를 단일 기준으로,
v3/v3-score-breakdown.js 신규 생성하여 scoreBreakdown 100점 만점 계산 완성.
보호 파일 10종 무손상 / payload mutation 0건 / DP-S1~DP-S9 + N-1~N-5 모두 적용 /
grade·signalCycle·entryPlan·exitPlan·tier·label 미산출 / smoke 정상+null+empty 3가지 모두 통과.
```
