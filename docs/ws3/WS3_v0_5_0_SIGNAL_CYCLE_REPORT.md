# WS3 v0.5.0 signalCycle 본체 작성 완료 보고

> **작업일자**: 2026-05-16
> **이전 functional baseline**: WS3 v0.4.0 structureBucket decision (`9e94b4d`)
> **branch**: `claude/heuristic-cori-7865e7`
> **작업 성격**: signalCycle / persistence / cooldown 신규 모듈. 보호 파일 수정 0건. payload / scoreBreakdown / structureDecision / previousSignalState mutation 0건.

---

## 생성 파일

- `/v3/v3-signal-cycle.js` — **이번 단계의 핵심 산출물**
- `/docs/ws3/WS3_v0_5_0_SIGNAL_CYCLE_REPORT.md` (이 파일)

## 갱신 파일

- `/docs/ws3/WS3_CHANGELOG.md` — `[v0.5.0]` 엔트리 상단 추가
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
v3/v3-structure-bucket.js
docs/ws3/WS3_CODE_CONTRACT.md (b-r2 박제본 그대로)
docs/ws3/WS3_WORKFLOW_TEMPLATE.md (v0.1 박제본 그대로)
index.html / manifest.json / service-worker.js
```

`git diff` 빈 출력 검증 완료.

---

## U-CYC-1 처리 방침 (Gate 1 발견 — Option A 적용)

작업지시서 §9의 `payload.raw.builderDebug.sourceTs` 가 실제 builder에 부재. **Option A** 적용:

```text
currentTs 우선순위:
1. payload.ts
2. payload.candles[primaryTimeframe] 마지막 candle.ts
3. null
```

- `payload.raw.builderDebug.sourceTs` 사용 0건
- `payload.raw.builderDebug.resolvedTsSource` (라벨)를 ts 값으로 사용 0건
- 보호 파일 무손상

---

## 적용 정책 (DP-CYC1 ~ DP-CYC11)

| DP | 정책 | 적용 위치 |
|---|---|---|
| **DP-CYC1** | standalone 반환, mutation 0건 | smoke 시나리오 1에서 payload/scoreBreakdown/structureDecision **mutated: false** 검증 |
| **DP-CYC2** | previousSignalState optional, Case A full / Case B minimal | `normalizePreviousSignalState()` — `hasCaseA` / `hasCaseB` 분기. 비공식 path 0건 |
| **DP-CYC3** | candidateKey = exchange + market + timeframe + bucketFamily | `getCandidateKey()` — smoke에서 `'BITHUMB:KRW-BTC:h1:LOW_SWEEP_FAMILY'` 산출 확인 |
| **DP-CYC4** | 8 cycleState 후보 | `classifySignalCycle()` 12단계 우선순위 / `ACTIVE_CYCLE_STATES = ['NEW_CANDIDATE','PERSISTING','STRENGTHENING','WEAKENING']` |
| **DP-CYC5** | cyclePhase 5 후보 | `CYCLE_PHASE_MAP` + `getCyclePhase()` |
| **DP-CYC6** | ageBars = 실행 횟수 카운터 | `calculateAgeBars()` |
| **DP-CYC7** | cooldown.bars = 3 (config override 가능) | `calculateCooldown()` newly cooldown 시 `barsRemaining = cfg.cooldown.bars` |
| **DP-CYC8** | ready (minConfidence=40, minTotalScore=30) | `getSignalQuality()` ready 조건 4가지 (structureValid + bucketReady + confidenceOk + scoreOk) |
| **DP-CYC9** | strengthen/weaken ±5/±10. mixedDelta → PERSISTING + MIXED_DELTA. imbalanced delta는 단순 분류 | `classifySignalCycle()` 8-11단계. smoke 시나리오 3/4 검증 |
| **DP-CYC10** | 런타임 clock API 사용 금지 | `getCurrentTs()` — payload.ts → primary candle.ts → null. grep 0건 |
| **DP-CYC11** | EXPIRED 1-turn 전환 (cooldown 소진 또는 ageBars >= maxAgeBars=20) | smoke 시나리오 6 (cooldown 소진), 7 (maxAge 도달) 검증 |

---

## bucketFamily mapping (DP-CYC3)

```
TOP_FAMILY:        BOX_TOP_PRESSURE / BREAKOUT_PRESSURE_CANDIDATE / ABOVE_BOX_CONFIRMED_CANDIDATE
BOTTOM_FAMILY:     BOX_BOTTOM_RISK / BREAKDOWN_RISK_CANDIDATE / BELOW_BOX_CONFIRMED_CANDIDATE
LOW_SWEEP_FAMILY:  LOW_SWEEP_PENDING / LOW_SWEEP_RECLAIM_CANDIDATE
RECLAIM_FAMILY:    RECLAIM_READY
HIGH_SWEEP_FAMILY: HIGH_SWEEP_REJECT_CANDIDATE
NEUTRAL_FAMILY:    BOX_MIDDLE
NONE:              UNKNOWN / NO_STRUCTURE
```

v0.4.0의 13 structureBucket 후보 1:1 매핑 완료.

---

## DEFAULT_SIGNAL_CYCLE_CONFIG

```js
{
  version: 'inline-default-v0',
  ready: { minConfidence: 40, minTotalScore: 30 },
  delta: {
    strengthenScoreDelta: 5, weakenScoreDelta: 5,
    strengthenConfidenceDelta: 10, weakenConfidenceDelta: 10
  },
  cooldown: { bars: 3 },
  expire: { maxAgeBars: 20 },
  candidateKey: { mode: 'bucketFamily' }
}
```

→ `mergeSignalCycleConfig(config)` override 가능.

---

## 검증 결과

### node --check
```
node --check v3/v3-signal-cycle.js
OK_SIGNAL_CYCLE
```

### smoke test — 7 시나리오 + 2 추가 시나리오 모두 통과

| # | 시나리오 | 입력 | 결과 |
|---|---|---|---|
| 1 | no previous state | previousSignalState=null + ready=true | ✅ `NEW_CANDIDATE` / `SEED` / streak=1 / ageBars=0 |
| 2 | same candidate persists | prev PERSISTING, delta neutral | ✅ `PERSISTING` / `ACTIVE` / ageBars=2 / streak=3 / isSameCandidate=true |
| 3 | strengthening | delta scoreDelta=+10, confidenceDelta=+20 | ✅ `STRENGTHENING` / isStrengthening=true |
| 4 | weakening | delta scoreDelta=-20, confidenceDelta=-30 | ✅ `WEAKENING` / isWeakening=true |
| 5 | cooldown after active | prev PERSISTING, current ready=false | ✅ `COOLDOWN` / `COOLING` / barsRemaining=3 / reason=NEWLY_ENTERED_AFTER_ACTIVE |
| 6 | cooldown exhausted | prev COOLDOWN, barsRemaining=1 → 0 | ✅ `EXPIRED` / `ENDED` / barsRemaining=0 |
| 7 | maxAge expired | prev ageBars=19 + 1 = 20 = maxAgeBars | ✅ `EXPIRED` / `ENDED` / MAX_AGE_REACHED:20 |
| + | invalid previous state | `{foo:'bar'}` | ✅ `NEW_CANDIDATE` / previousStateUsed=false / warning `PREVIOUS_STATE_INVALID` |
| + | null payload | all inputs null | ✅ valid=true / `NO_SIGNAL` / candidateKey=null / ready=false |

### 공통 검증 (7 시나리오 전체)
- signalCycle.valid boolean ✓
- cycleState ∈ 8 후보 ✓
- cyclePhase ∈ 5 후보 ✓
- candidateKey string or null ✓
- bucketFamily 존재 ✓
- persistence / cooldown / signalQuality 객체 존재 ✓
- **payload / scoreBreakdown / structureDecision / previousSignalState mutation 0건** ✓
- grade / strategyBias / entryPlan / exitPlan field 부재 ✓

### 금지 패턴 grep (identifier 기반)

| 패턴 | 매치 | 평가 |
|---|---|---|
| `(grade\|strategyBias\|entryPlan\|exitPlan)\s*[:=]` | 0 | ✅ 0건 |
| `\.(grade\|strategyBias\|entryPlan\|exitPlan)` | 0 | ✅ 0건 |
| `payload\.[a-zA-Z]+\s*=` | 1 | line 276 `payload.ts === 'number'` **false-positive (`===` 비교문 첫 `=`)**. mutation 0건 |
| `scoreBreakdown\.[a-zA-Z]+\s*=\|structureDecision\.[a-zA-Z]+\s*=\|previousSignalState\.[a-zA-Z]+\s*=` | 2 | line 325/342 `structureDecision.structureBucket === / structureDecision.valid ===` **false-positive (`===` 비교문)**. mutation 0건 |
| `delete\s+payload\.\|...` | 0 | ✅ 0건 |
| `fetch(\|document.\|localStorage\|sessionStorage\|XMLHttpRequest\|Date.now(` | 0 | ✅ (주석 literal 0건) |
| refined: `P-S/A/B word-boundary\|Telegram\|externalConfluence\|렌더 식별자\|UI 모델 식별자` | 0 | ✅ |

→ **코드 침범 0건. 주석 literal 0건.** payload/scoreBreakdown/structureDecision `\s*=` 매치 3건 모두 `===` 비교문의 false-positive.

### 보호 파일 diff
```
git diff -- v3/v3-config.js v3/v3-feature-payload.js v3/v3-bithumb-client.js \
            v3/v3-candle-normalizer.js v3/v3-indicators.js \
            v3/v3-feature-payload-builder.js v3/v3-score-breakdown.js \
            v3/v3-structure-bucket.js \
            docs/ws3/WS3_CODE_CONTRACT.md docs/ws3/WS3_WORKFLOW_TEMPLATE.md \
            index.html manifest.json service-worker.js
PROTECTED_DIFF_END   (빈 출력)
```
→ **보호 파일 13종 0건 변경**.

---

## signalCycle 출력 예시 (smoke 시나리오 1 — NEW_CANDIDATE)

```js
{
  valid: true,
  version: 'WS3_v0.5.0',
  cycleState: 'NEW_CANDIDATE',
  cyclePhase: 'SEED',
  candidateKey: 'BITHUMB:KRW-BTC:h1:LOW_SWEEP_FAMILY',
  bucketFamily: 'LOW_SWEEP_FAMILY',
  bucketTransition: null,
  currentTs: 1778862000000,
  previousTs: null,
  ageBars: 0,
  ageMs: null,
  persistence: {
    active: true,
    streak: 1,
    previousStreak: 0,
    isSameCandidate: false,
    isStrengthening: false,
    isWeakening: false,
    mixedDelta: false,
    scoreDelta: null,
    confidenceDelta: null,
    reasons: ['NEW_STREAK'],
    warnings: []
  },
  cooldown: { active: false, reason: null, barsRemaining: 0, startedTs: null, reasons: [], warnings: [] },
  signalQuality: {
    structureBucket: 'LOW_SWEEP_RECLAIM_CANDIDATE',
    bucketFamily: 'LOW_SWEEP_FAMILY',
    structureConfidence: 100,
    totalScore: 88,
    structureScore: 20,
    ready: true,
    reasons: [...],
    warnings: []
  },
  reasons: ['CYCLE_NEW_CANDIDATE', 'NO_PREV_ACTIVE'],
  warnings: [],
  debug: {
    source: 'payload + scoreBreakdown + structureDecision',
    previousStateUsed: false,
    previousStateShape: null,
    configVersion: 'inline-default-v0'
  },
  configUsed: { ready, delta, cooldown, expire, candidateKey }
}
```

---

## 미구현 항목 (이번 단계 의도된 제외)

- **grade / tier / 등급 코드** — 별도 단계 (별도 승인 후)
- **strategyBias / entryPlan / exitPlan** — v0.6.0
- **renderer / cardViewModel / UI** — v0.7.0
- **알림 연동 / snapshot / evaluation** — v0.8.0
- **외부 신호 / LW activeCycle** — v0.9.x+
- **저장소 read/write** (KV / brower storage / DB / snapshot) 0건
- **외부 호출** (외부 API / DOM / 브라우저 storage / KV) 0건
- **런타임 clock API 사용** 0건

---

## 다음 단계

```text
WS3 v0.6.0 — strategyBias / entryPlan / exitPlan A-F
  목적: signalCycle 결과 기반 단타/스윙/관찰/회피 분류
        + LONG 30/30/40 entryPlan
        + exitPlan A~F
  의존: signalCycle (v0.5.0), structureDecision (v0.4.0), scoreBreakdown (v0.3.0)
```

이후 v0.7.0 ~ v0.9.0+ 순서는 [WS3_CURRENT_BASELINE.md](docs/ws3/WS3_CURRENT_BASELINE.md) 그대로.

---

## 한 줄 결론

```
v3FeaturePayload + scoreBreakdown + structureDecision + previousSignalState(optional)을 standalone signalCycle로 조립.
8 cycleState + 5 cyclePhase + 7 bucketFamily + confidence/delta 기반 분류 + cooldown/EXPIRED 1-turn 전환.
보호 파일 13종 무손상 / 모든 입력 mutation 0건 / DP-CYC1~CYC11 + U-CYC-1 Option A 모두 적용 /
grade·strategyBias·entryPlan·exitPlan 미산출 / 저장소 read/write 0건 / 런타임 clock API 0건 /
smoke 7 시나리오 (NEW_CANDIDATE / PERSISTING / STRENGTHENING / WEAKENING / COOLDOWN / EXPIRED-cooldown / EXPIRED-maxAge) 모두 통과.
```
