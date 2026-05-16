# WS3 v0.6.0 strategyPlan 본체 작성 완료 보고

> **작업일자**: 2026-05-16
> **이전 functional baseline**: WS3 v0.5.0 signalCycle (`59c8b78`)
> **branch**: `claude/heuristic-cori-7865e7`
> **작업 성격**: strategyBias / entryPlan / exitPlan 신규 모듈. 보호 파일 수정 0건. payload/scoreBreakdown/structureDecision/signalCycle mutation 0건.

---

## 생성 파일

- `/v3/v3-strategy-plan.js` — **이번 단계의 핵심 산출물**
- `/docs/ws3/WS3_v0_6_0_STRATEGY_PLAN_REPORT.md` (이 파일)

## 갱신 파일

- `/docs/ws3/WS3_CHANGELOG.md` — `[v0.6.0]` 엔트리 상단 추가
- `/docs/ws3/WS3_CURRENT_BASELINE.md` — 완료된 단계 표 + 보호 파일 목록 + 모듈 의존성 + 다음 단계 갱신

## 수정 0건 (보호 파일 14종)

```text
v3/v3-config.js, v3-feature-payload.js, v3-bithumb-client.js, v3-candle-normalizer.js,
v3-indicators.js, v3-feature-payload-builder.js, v3-score-breakdown.js,
v3-structure-bucket.js, v3-signal-cycle.js
docs/ws3/WS3_CODE_CONTRACT.md (b-r2 박제본 그대로)
docs/ws3/WS3_WORKFLOW_TEMPLATE.md (v0.1 박제본 그대로)
index.html / manifest.json / service-worker.js
```

---

## U-STRAT-1 처리 방침 (Option B 확정)

작업지시서의 `BOX_TOP` / `ABOVE_BOX` 라벨을 실제 v0.4.0 산출 라벨로 매핑:

| 작업지시서 표기 | 실제 코드 매핑 |
|---|---|
| `BOX_TOP` | `priceZone.zone === 'TOP_NEAR'` |
| `BOX_BOTTOM` | `priceZone.zone === 'BOTTOM_NEAR'` |
| `BOX_MIDDLE` | `priceZone.zone === 'MIDDLE'` |
| `ABOVE_BOX` | `structureDecision.structureBucket === 'ABOVE_BOX_CONFIRMED_CANDIDATE'` |
| `BELOW_BOX` | `structureDecision.structureBucket === 'BELOW_BOX_CONFIRMED_CANDIDATE'` |

---

## 적용 정책 (DP-STRAT1 ~ DP-STRAT11)

| DP | 정책 | 적용 |
|---|---|---|
| **DP-STRAT1** | standalone 반환, 4종 입력 mutation 금지 | smoke 12 시나리오 전체 mutation 0건 검증 |
| **DP-STRAT2** | 10 strategyBias 후보 | `getStrategyBias()` 11단계 분류 |
| **DP-STRAT3** | planType 7 후보 | `STRATEGY_BIAS_TO_PLAN_TYPE` 매핑 |
| **DP-STRAT4** | actionability 5 후보 | `getActionability()` |
| **DP-STRAT5** | planQualityTier 7 후보 (등급 코드 아님) | `getPlanQualityTier()` |
| **DP-STRAT6** | numeric hint 허용 | entryZone / setupInvalidationHint / targetHint / invalidationHint |
| **DP-STRAT7** | invalidationHint / targetHint naming | 구버전 라벨 사용 grep 0건 |
| **DP-STRAT8** | ABOVE_BOX 추격 = allowChaseAboveBox 기본 false | smoke 6 (default) vs 8 (override=true) 모두 검증 |
| **DP-STRAT9** | WEAKENING/COOLDOWN/EXPIRED → 차단 | smoke 2/3/4에서 BLOCKED + PLAN_AVOID 검증 |
| **DP-STRAT10** | strategyBias 분류 우선순위 11단계 | `getStrategyBias()` |
| **DP-STRAT11** | 4축 용도 분리 | strategyBias / planType / actionability / planQualityTier 독립 산출 |

---

## DEFAULT_STRATEGY_PLAN_CONFIG

```js
{
  version: 'inline-default-v0',
  thresholds: {
    premiumScore: 80, strongScore: 70, standardScore: 60, watchScore: 50,
    premiumConfidence: 80, strongConfidence: 70, standardConfidence: 60,
    confidenceB: 70, minConfidence: 40
  },
  risk: { allowChaseAboveBox: false, blockWeakening: true, blockCooldown: true, blockExpired: true },
  entry: { useNumericHints: true, preferReferenceLow: true, fallbackToBoxCenter: true },
  exit: { useNumericHints: true, preferReferenceLowInvalidation: true, useBoxHighTarget: true }
}
```

---

## 검증 결과

### node --check
```
node --check v3/v3-strategy-plan.js
OK_STRATEGY_PLAN
```

### smoke test — 12 시나리오 모두 통과

| # | 시나리오 | strategyBias | planType | actionability | planQualityTier | mutation |
|---|---|---|---|---|---|---|
| 1 | RECLAIM (LOW_SWEEP_RECLAIM_CANDIDATE / NEW_CANDIDATE) | ✅ RECLAIM_READY | RECLAIM | HIGH | PLAN_PREMIUM | 0건 |
| 2 | EXPIRED | ✅ EXPIRED_IGNORE | NONE | BLOCKED | PLAN_AVOID | 0건 |
| 3 | COOLDOWN | ✅ COOLDOWN_WAIT | NONE | BLOCKED | PLAN_AVOID | 0건 |
| 4 | WEAKENING | ✅ RISK_OFF | RISK_OFF | BLOCKED | PLAN_AVOID | 0건 |
| 5 | NOT_READY | ✅ NO_TRADE | NONE | BLOCKED | PLAN_AVOID | 0건 |
| 6 | ABOVE_BOX (allowChase=false default) | ✅ BREAKOUT_READY | BREAKOUT | MEDIUM | PLAN_PREMIUM | 0건 |
| 7 | ABOVE_BOX + STRENGTHENING | ✅ BREAKOUT_READY | BREAKOUT | MEDIUM | PLAN_PREMIUM | 0건 |
| 8 | ABOVE_BOX + allowChase=true (override) | ✅ BREAKOUT_READY | BREAKOUT | **HIGH** | — | 0건 |
| 9 | BOX_TOP_PRESSURE + TOP_NEAR + conf=80 | ✅ BREAKOUT_READY | BREAKOUT | HIGH | PLAN_PREMIUM | 0건 |
| 10 | BOX_TOP_PRESSURE + low conf | ✅ PULLBACK_WAIT | PULLBACK | LOW | PLAN_STRONG | 0건 |
| 11 | BOX_MIDDLE | ✅ WATCH_ONLY | WATCH | LOW | PLAN_STRONG | 0건 |
| 12 | null inputs | ✅ UNKNOWN | NONE | NONE | NONE | (모든 입력 null) |

### 핵심 동작 검증

#### Scenario 6 (ABOVE_BOX + default)
```
riskControls.allowChase: false
riskControls.requirePullback: true            ← DP-STRAT8 적용
entryPlan.type: PULLBACK_ENTRY                ← BREAKOUT → PULLBACK 완화
actionability: MEDIUM                          ← HIGH → MEDIUM 완화
exitPlan.type: INVALIDATION_ONLY               ← ABOVE_BOX targetHint=null
exitPlan.targetHint: null
```

#### Scenario 7 (ABOVE_BOX + STRENGTHENING)
```
exitPlan.type: TRAILING_HINT                   ← STRENGTHENING + ABOVE_BOX
```

#### Scenario 8 (allowChase=true override)
```
riskControls.allowChase: true
riskControls.requirePullback: false
actionability: HIGH                            ← 완화 없음
```

#### Scenario 1 (RECLAIM)
```
entryPlan.type: RECLAIM_CONFIRM
entryPlan.entryZone: 99700 (referenceLow.value)
entryPlan.trigger: 'CLOSE_ABOVE_REF_LOW'
exitPlan.targetHint: 100300 (boxHigh)
exitPlan.invalidationHint: 99700 (referenceLow.value)
riskControls.requireReclaim: true              ← LOW_SWEEP_RECLAIM_CANDIDATE
```

### 금지 패턴 grep 결과

| 패턴 | 매치 | 평가 |
|---|---|---|
| `(grade\|signalCycle\|entryPlan\|exitPlan)\s*[:=]` | 8 | 모두 `entryPlan:` / `exitPlan:` / `signalCycle:` property key — **v0.5.0/v0.6.0 허용 식별자**. `grade` literal 0건 |
| `payload.<x>= / scoreBreakdown.<x>= / structureDecision.<x>= / signalCycle.<x>=` | 2 | line 19/20 헤더 주석의 매핑 표 (`structureDecision.structureBucket === 'ABOVE_BOX_CONFIRMED_CANDIDATE'` 의 `===` 첫 `=` false-positive). **mutation 0건** |
| `delete\s+payload.\|delete\s+scoreBreakdown.\|delete\s+structureDecision.\|delete\s+signalCycle.` | 0 | ✅ |
| `fetch(\|document.\|localStorage\|sessionStorage\|XMLHttpRequest\|Date.now(\|stopLossHint\|takeProfitHint\|planGradeHint` | 0 | ✅ (구버전 손절·익절 라벨 잔존 0건) |
| refined `P-S/A/B\|Telegram\|externalConfluence\|렌더\|UI 모델` | 0 | ✅ |

→ **코드 침범 0건. 구버전 손절·익절 라벨 0건.** mutation grep 매치 2건은 모두 헤더 주석 매핑 표의 `===` false-positive.

### 보호 파일 diff
```
git diff -- v3/v3-config.js v3-feature-payload.js v3-bithumb-client.js v3-candle-normalizer.js \
            v3-indicators.js v3-feature-payload-builder.js v3-score-breakdown.js \
            v3-structure-bucket.js v3-signal-cycle.js \
            docs/ws3/WS3_CODE_CONTRACT.md docs/ws3/WS3_WORKFLOW_TEMPLATE.md \
            index.html manifest.json service-worker.js
PROTECTED_DIFF_END   (빈 출력)
```
→ **보호 파일 14종 (v3 *.js 9종 + WS3_CODE_CONTRACT + WS3_WORKFLOW_TEMPLATE + 3 web) 0건 변경**.

---

## strategyPlan 출력 예시 (Scenario 1 — RECLAIM)

```js
{
  valid: true,
  version: 'WS3_v0.6.0',
  strategyBias: 'RECLAIM_READY',
  planType: 'RECLAIM',
  actionability: 'HIGH',
  riskLevel: 'UNKNOWN',
  planQualityTier: 'PLAN_PREMIUM',
  entryPlan: {
    valid: true,
    type: 'RECLAIM_CONFIRM',
    entryZone: 99700,
    trigger: 'CLOSE_ABOVE_REF_LOW',
    setupInvalidationHint: 99700,
    referencePrice: 100200,
    reasons: ['RECLAIM_CONFIRM', 'ENTRY_ZONE_FROM_REF_LOW', 'SETUP_INVALIDATION_FROM_REF_LOW'],
    warnings: []
  },
  exitPlan: {
    valid: true,
    type: 'BOX_TARGET',
    targetHint: 100300,
    invalidationHint: 99700,
    riskRewardHint: null,
    reasons: ['INVALIDATION_FROM_REF_LOW', 'TARGET_FROM_BOX_HIGH'],
    warnings: []
  },
  riskControls: {
    allowChase: false,
    requirePullback: false,
    requireReclaim: true,
    avoidIfWeakening: true,
    avoidIfCooldown: true,
    reasons: ['LOW_SWEEP_REQUIRE_RECLAIM'],
    warnings: []
  },
  reasons: ['BIAS_RECLAIM_READY', 'PLAN_TYPE_RECLAIM', 'ACTIONABILITY_HIGH', 'QUALITY_PLAN_PREMIUM'],
  warnings: [],
  debug: { source: 'payload + scoreBreakdown + structureDecision + signalCycle', configVersion: 'inline-default-v0' },
  configUsed: { thresholds, risk, entry, exit }
}
```

---

## 미구현 항목 (이번 단계 의도된 제외)

- 실제 매수/매도 주문
- 알림 발송 (v0.8.0)
- 화면 모델 / 렌더 계층 / UI (v0.7.0)
- 외부 신호 / LW activeCycle (v0.9.x+)
- 등급 코드 매핑 / 알림 등급 산출
- 저장소 read/write
- 외부 호출 / DOM / 브라우저 storage / KV / 런타임 clock API

---

## 다음 단계

```text
WS3 v0.7.0 — UI / CardViewModel
  목적: strategyPlan + signalCycle + structureDecision + scoreBreakdown → 카드뷰 모델
  의존: strategyPlan (v0.6.0), signalCycle (v0.5.0), structureDecision (v0.4.0), scoreBreakdown (v0.3.0)
```

---

## 한 줄 결론

```
v3FeaturePayload + scoreBreakdown + structureDecision + signalCycle을 standalone strategyPlan으로 조립.
10 strategyBias + 7 planType + 5 actionability + 7 planQualityTier (4축 독립) + entryPlan/exitPlan/riskControls.
U-STRAT-1 Option B (priceZone.zone 'TOP_NEAR' / structureBucket 'ABOVE_BOX_CONFIRMED_CANDIDATE' 매핑) 적용.
보호 파일 14종 무손상 / 4종 입력 mutation 모두 0건 / DP-STRAT1~11 모두 적용 /
구버전 손절·익절 라벨 0건 / 등급 코드 미산출 / 런타임 clock API 0건 /
smoke 12 시나리오 (RECLAIM / EXPIRED / COOLDOWN / WEAKENING / NOT_READY / ABOVE_BOX×3 / BOX_TOP_PRESSURE×2 / BOX_MIDDLE / null) 모두 통과.
```
