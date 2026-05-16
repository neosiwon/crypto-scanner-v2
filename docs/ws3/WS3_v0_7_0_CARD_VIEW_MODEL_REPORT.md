# WS3 v0.7.0 — CardViewModel 완료 보고 (hotfix 반영본)

**작성일**: 2026-05-16
**branch**: `claude/heuristic-cori-7865e7`
**이전 functional baseline**: WS3 v0.6.0 strategyPlan (`8ebba40`)
**본 단계 산출**: `v3/v3-card-view-model.js` (신규)
**hotfix 적용**: DP-UI 번호 매핑(r0.2-final), displayFlags 10-key, identityInput 영구 차단

---

## 1. 단계 개요

- 입력 5종 (`payload` / `scoreBreakdown` / `structureDecision` / `signalCycle` / `strategyPlan`) → standalone `cardViewModel` (UI-ready, 비-mutating, 비-렌더)
- 모듈 식별자: `WS3_CardViewModel`
- 버전: `CARD_VIEW_MODEL_VERSION = 'WS3_v0.7.0'`
- export 패턴: `global.WS3_CardViewModel = Object.freeze(api)` + `module.exports = api` (이중 환경)
- IIFE / `'use strict'` / `var`-style (v0.6.0 strategy-plan.js 와 동일 스타일)

---

## 2. 출력 구조

```text
cardViewModel = {
  valid,                     // boolean
  version,                   // 'WS3_v0.7.0'
  identity:     { symbol, market, timeframe, asOfTs },
  header:       { title, subtitle, primaryBadge, secondaryBadge, actionability },
  chips:        Array<{ id, labelKey, labelKo, labelEn, tone }>,
  metrics:      Array<{ id, labelKey, labelKo, labelEn, value, kind, tone, sortKey }>,  // DP-UI4 / DP-UI5
  sections: {                                                                            // DP-UI9 (7개)
    overview:   { symbol, market, timeframe, asOfTs, payloadVersion? },
    score:      { valid, version, totalScore, grossScore, riskPenalty, components },
    structure:  { valid, version, structureBucket, labelKo, tone, confidence, priceZone },
    cycle:      { valid, version, cycleState, cyclePhase, bucketFamily, ageBars,
                  stateLabelKo, phaseLabelKo, stateTone, phaseTone },
    strategy:   { valid, version, strategyBias, planType, actionability, planQualityTier,
                  entry: { valid, type, entryZone, trigger, setupInvalidationHint, referencePrice },
                  exit:  { valid, type, targetHint, invalidationHint, riskRewardHint },
                  biasLabelKo, biasTone },                                                // DP-UI11 numeric hint 노출 허용
    risk:       { riskLevel, labelKo, tone, penalty, maxPenalty, controls },              // DP-UI11
    debug:      null | { cardViewModelVersion, scoreVersion, ..., <allowedFields 통과 primitive> }  // DP-UI8
  },
  displayFlags: {                                                                        // DP-UI7 / r0.2-final 10 boolean
    isReady, isBlocked, isCooldown, isExpired, isWeakening,
    isHighActionability, showEntryPlan, showExitPlan, showRiskWarning, showDebug
  },
  tone,                      // DP-UI6 의미 토큰
  reasons,                   // dedupe (4종 산출 누적)
  warnings,                  // dedupe (4종 산출 누적 + 본 단계 NOT_OBJECT 워닝)
  debug:        { source, configVersion },
  configUsed:   { sections, metrics, debug: { allowedFields }, chips }
}
```

---

## 3. 적용된 DP-UI 정책 (r0.2-final 매핑 — 11개 모두 적용)

| ID | 정책 | 구현 |
|---|---|---|
| **DP-UI1** | standalone cardViewModel. 입력 5종 mutate/delete 금지 | `buildCardViewModel()` — 5종 입력은 read-only. S1~S6 smoke 7개 시나리오 검증 (`JSON.stringify(before) === JSON.stringify(after)`) |
| **DP-UI2** | DOM / HTML / renderer 작성 금지 | DOM API 호출 0건. innerHTML/document/window/addEventListener 0건 (comment 외) |
| **DP-UI3** | 출력 7대 영역 구조 (identity + header + chips + metrics + sections + displayFlags + tone) | `normalizeCardViewModel()` 가 7대 영역 + reasons/warnings/debug/configUsed 출력 |
| **DP-UI4** | metrics 는 array. object 형태 금지 | `buildMetrics()` 반환은 array. 모든 metric 객체는 8-필드 (id/labelKey/labelKo/labelEn/value/kind/tone/sortKey). `Array.isArray(vm.metrics)` 10 시나리오 검증 |
| **DP-UI5** | 라벨은 labelKey + labelKo + labelEn 직접 포함 | 모든 badge / chip / metric 에 labelKey 필드. `pickLabel()` 헬퍼가 보장. S1~S8 smoke 의 `assertLabelKeys()` 검증 |
| **DP-UI6** | tone semantic token (8종). 색상 코드 금지 | `TONE` 상수 + 모든 라벨 dict tone. hex/`#`/inline style 0건 |
| **DP-UI7** | showEntryPlan / showExitPlan boolean. displayFlags 위치 | `buildDisplayFlags()` 내 showEntryPlan / showExitPlan 포함. S1 (true) / S3 (false) smoke 검증 |
| **DP-UI8** | debug 기본 숨김 (showDebug=false). raw payload / payload.raw / payload.raw.builderDebug 전체 직접 노출 금지. **identityInput / candle raw array 영구 차단**. cfg.debug.allowedFields whitelist 방식. **기본값 빈 배열** | `DEFAULT_CARD_VIEW_MODEL_CONFIG.debug.allowedFields = []`. `buildDebugSection()` 의 `BLOCKED_FIELDS = ['identityInput', 'candles', 'rawCandles', 'candleArrays', 'raw', 'builderDebug']` 영구 차단. primitive (string/number/boolean/null) 만 통과. Extra-A (default null) / Extra-B (hard block) / Extra-C (scalar passthrough) / Extra-D (empty whitelist) smoke 검증 |
| **DP-UI9** | sections 7개 (overview / score / structure / cycle / strategy / risk / debug) | `buildCardViewModel()` 내 `sections` 7개 키 항상 생성. debug 만 null 가능 |
| **DP-UI10** | P-S / P-A / P-B 최종 알림 등급 표시 금지 | 등급 코드 / tier 라벨 외부 노출 0건. PLAN_QUALITY_LABEL 은 planQualityTier 라벨이지 알림 등급 아님 (DP-STRAT5 정합) |
| **DP-UI11** | numeric hint 는 sections.strategy / sections.risk 만 | header / chips / metrics 에 entryZone(115)/invalidationHint(95)/targetHint(130) 노출 0건. S7 smoke 검증 |

---

## 4. displayFlags 정확히 10 boolean (r0.2-final)

| key | 의미 | 산출 로직 |
|---|---|---|
| `isReady` | 신호 ready | `signalCycle.signalQuality.ready === true` |
| `isBlocked` | 진입 차단 | `actionability === 'BLOCKED'` ∨ `bias ∈ {NO_TRADE, RISK_OFF}` |
| `isCooldown` | 냉각 중 | `cycleState === 'COOLDOWN'` ∨ `bias === 'COOLDOWN_WAIT'` |
| `isExpired` | 만료 | `cycleState === 'EXPIRED'` ∨ `bias === 'EXPIRED_IGNORE'` |
| `isWeakening` | 약화 중 | `cycleState === 'WEAKENING'` |
| `isHighActionability` | 실행 가능성 높음 | `actionability === 'HIGH'` |
| `showEntryPlan` | entryPlan 표시 가능 | `strategyPlan.entryPlan.valid === true` |
| `showExitPlan` | exitPlan 표시 가능 | `strategyPlan.exitPlan.valid === true` |
| `showRiskWarning` | 리스크 경고 표시 | `isBlocked ∨ isWeakening ∨ riskLevel === 'HIGH'` |
| `showDebug` | debug 섹션 표시 | `cfg.sections.showDebug === true` (기본 false) |

S1~S8 smoke 8개 시나리오에서 `displayFlags has 10 keys` + 각 키 boolean 검증.

---

## 5. 라벨 사전 (DP-UI5 — labelKey/labelKo/labelEn)

| dict | 키 개수 | 예 |
|---|---|---|
| `STRATEGY_BIAS_LABEL` | 10 | `BREAKOUT_READY` → ko '돌파 후보' / en 'Breakout Ready' / tone positive |
| `CYCLE_STATE_LABEL` | 8 | `STRENGTHENING` → ko '강화 중' / en 'Strengthening' / tone positive |
| `CYCLE_PHASE_LABEL` | 5 | `EARLY` → ko '초기' / en 'Early' / tone info |
| `ACTIONABILITY_LABEL` | 5 | `HIGH` → ko '계획 명확' / en 'High' / tone positive |
| `PLAN_QUALITY_LABEL` | 7 | `PLAN_PREMIUM` → ko '프리미엄 계획' / en 'Plan Premium' / tone positive |
| `STRUCTURE_BUCKET_LABEL` | 13 | `LOW_SWEEP_RECLAIM_CANDIDATE` → ko '저점 청소 회복 후보' / tone positive |
| `PRICE_ZONE_LABEL` | 4 | `TOP_NEAR` → ko '상단 근접' / tone info |
| `RISK_LEVEL_LABEL` | 4 | `HIGH` → ko '높음' / tone warning |

`pickLabel()` 헬퍼는 매번 `{ labelKey, labelKo, labelEn, tone }` 반환. badges / chips / metrics 모두 동일 패턴.

---

## 6. debug 노출 정책 (DP-UI8 — 정정)

### 기본 동작
- `cfg.sections.showDebug = false` (기본) → `sections.debug = null`
- `cfg.sections.showDebug = true` → `sections.debug` 객체 생성

### 항상 노출 (메타 정보 — raw payload 아님)
- `cardViewModelVersion` (own version)
- `scoreVersion` / `structureVersion` / `cycleVersion` / `strategyVersion` (각 모듈 자체 version 필드)

### whitelist (`cfg.debug.allowedFields`)
- 기본값: **빈 배열 `[]`** → 추가 노출 0건
- 사용자가 명시한 필드명만 `payload.raw.builderDebug` 에서 통과
- **primitive 값 (string/number/boolean/null) 만 통과** — object/array 자동 차단

### 영구 차단 (`BLOCKED_FIELDS` — whitelist 와 무관)
```js
['identityInput', 'candles', 'rawCandles', 'candleArrays', 'raw', 'builderDebug']
```
- `identityInput` 객체: whitelist 에 포함시켜도 차단됨 (Extra-B smoke 검증)
- `candles` / `rawCandles` / `candleArrays`: candle raw array 차단
- `raw` / `builderDebug`: 전체 객체 직접 노출 차단

### smoke 검증
- **Extra-A**: showDebug=false → `sections.debug === null` ✓
- **Extra-B**: showDebug=true + allowedFields=`['identityInput', 'raw', 'builderDebug', 'candles', 'rawCandles', 'candleArrays', 'LEAK_OBJECT']` → identityInput / candles / raw / builderDebug / LEAK_OBJECT (object value) **모두 차단** ✓
- **Extra-C**: allowedFields=`['primaryTimeframe', 'resolvedTsSource', 'builderVersion']` → 3 필드 모두 노출 ✓
- **Extra-D**: allowedFields 미지정 → 기본 `[]` → builderDebug 필드 추가 노출 0건 ✓

---

## 7. smoke test 결과 (12 시나리오 모두 통과)

| # | 시나리오 | 핵심 검증 |
|---|---|---|
| S1 | reclaim ready | displayFlags 10 keys / isReady / isHighActionability / showEntryPlan / showExitPlan / showDebug=false / labelKey 존재 / primaryBadge=BIAS / tone=positive / 5종 mutation=0 |
| S2 | breakout ready | displayFlags 10 keys / isReady+isHighActionability / tone=positive |
| S3 | pullback wait | displayFlags 10 keys / not high / not blocked / showEntryPlan=false / tone=neutral |
| S4 | risk off | displayFlags 10 keys / isBlocked / isWeakening / showRiskWarning / tone=warning |
| S5 | cooldown | displayFlags 10 keys / isCooldown / isBlocked / primaryBadge=BIAS_COOLDOWN_WAIT (cycleState override 없음) |
| S6 | expired | displayFlags 10 keys / isExpired / tone=critical |
| S7 | numeric hint exposure boundary | entryZone(115)/invalidationHint(95)/targetHint(130) 은 sections.strategy 만. header/chips/metrics 0건 |
| S8 | null inputs | displayFlags 10 keys / valid=false / primaryBadge.labelKey='UNKNOWN' / tone=unknown / NOT_OBJECT warnings |
| Extra-A | debug default null | showDebug=false → sections.debug === null |
| Extra-B | identityInput hard block | identityInput/raw/builderDebug/candles/rawCandles/candleArrays whitelist 무력화 검증 + LEAK_OBJECT object-value 차단 |
| Extra-C | allowedFields scalar passthrough | primaryTimeframe/resolvedTsSource/builderVersion 통과. own version 항상 노출 |
| Extra-D | allowedFields default empty | 기본 빈 배열 → builderDebug 필드 추가 노출 0건. configUsed.debug.allowedFields.length === 0 |
| Extra-E | frozen input safety | deepFreeze 5종 입력에 대해 throw 없이 build 성공 |

S1~S6 6개 시나리오에서 5종 입력 mutation 0건 검증 (JSON.stringify 비교).

(smoke 파일 `_ws3_v070_smoke.js` 는 검증 후 worktree 에서 제거. repo 영구 박제 X)

---

## 8. 금지 패턴 grep 결과

| 패턴 | 결과 | 비고 |
|---|---|---|
| `(^\|[^A-Za-z0-9_])P-(S\|A\|B)([^A-Za-z0-9_]\|$)` (word-boundary) | line 40 헤더 주석 1건 | DP-UI10 정책 설명 ("P-S/P-A/P-B 표시 금지"). **false-positive — 코드 사용 0건** |
| `Telegram\|externalConfluence\|renderer\|innerHTML\|document.\|addEventListener\|localStorage\|sessionStorage\|XMLHttpRequest\|fetch(\|Date.now(` | line 22 헤더 주석 1건 (`renderer`) | DP-UI2 정책 설명 ("DOM/HTML/renderer 작성 금지"). **false-positive** |
| `payload.X = ...` (mutation) | **0건** | input mutation 0 |
| `scoreBreakdown.X = .../structureDecision.X = .../signalCycle.X = .../strategyPlan.X = ...` | **0건** | 모든 input mutation 0 |
| `delete <input>.X` | **0건** | input delete 0 |
| `매수하세요/매도하세요/...` 명령 어조 | lines 48, 62 헤더 주석 2건 | DP-UI7 정책 설명 ("명령 어조 금지"). **false-positive** |
| `buySignal/sellSignal/orderSignal/realEntryPrice/realStopLoss/realTakeProfit/stopLossHint/takeProfitHint/planGradeHint` | line 49 헤더 주석 1건 | 구버전 라벨 금지 명시. **false-positive** |
| `metrics:\s*\{` | lines 230, 265 (config 객체 2건) | `mergeCardViewModelConfig` / `makeConfigUsed` 내 **config.metrics** 객체. **출력 cardViewModel.metrics 는 array** (smoke 검증). **false-positive** |
| `cycleState.*COOLDOWN.*primaryBadge` / `EXPIRED` / `WEAKENING` | **0건** | DP-UI6 (primaryBadge=bias) 위반 0건 |
| `payload.raw \| identityInput \| raw.builderDebug` | line 35-36/64-65 정책 주석 / 803-804 함수 주석 / line 829 BLOCKED_FIELDS 배열 / line 356-357 buildIdentity (timeframe scalar read) / line 834-835 buildDebugSection 가드 | 노출 0건. raw 객체는 한번도 그대로 전달되지 않음. identityInput 영구 차단 (Extra-B 검증). primaryTimeframe scalar 읽기만 허용. **false-positive** |

---

## 9. 보호 파일 diff 검증

`git diff --stat HEAD -- <protected15>` = 빈 출력 ✅

```text
v3/v3-feature-payload.js / v3/v3-feature-payload-builder.js / v3/v3-candle-normalizer.js /
v3/v3-indicators.js / v3/v3-bithumb-client.js / v3/v3-config.js / v3/v3-score-breakdown.js /
v3/v3-structure-bucket.js / v3/v3-signal-cycle.js / v3/v3-strategy-plan.js          → 0 변경
docs/ws3/WS3_CODE_CONTRACT.md (b-r2 박제) / docs/ws3/WS3_WORKFLOW_TEMPLATE.md (v0.1 박제) → 0 변경
index.html / manifest.json / service-worker.js                                       → 0 변경
```

신규/변경 파일 (이번 단계):
- `v3/v3-card-view-model.js` (신규)
- `docs/ws3/WS3_v0_7_0_CARD_VIEW_MODEL_REPORT.md` (신규, 본 파일)
- `docs/ws3/WS3_CHANGELOG.md` (modified — `[v0.7.0]` 엔트리)
- `docs/ws3/WS3_CURRENT_BASELINE.md` (modified — v0.7.0 baseline)

`.claude/` 는 untracked 유지 (commit 대상 아님).

---

## 10. 의도된 미구현 (이번 단계 제외)

- 실제 매수/매도 주문
- Telegram / push / 알림 발송 (v0.8.0)
- DOM / 렌더 계층 / 실제 HTML 출력 (별도 renderer 단계)
- snapshot URL / 저장 / 사후평가 (v0.8.0)
- 외부 신호 / LW activeCycle (v0.9.x+)
- 등급 코드 산출 (planQualityTier 는 메타 토큰)
- 저장소 read/write
- 외부 호출 / 브라우저 storage / KV
- 런타임 clock API 사용

---

## 11. N-UI-OBS 처리 (Gate 1 발견)

| ID | 내용 | 처리 |
|---|---|---|
| **N-UI-OBS-1** | `index.html` 에 WOOS v5.x 운영의 `w1_buildCardViewModel` 존재 | prefix 분리 (`WS3_CardViewModel` vs `w1_`). index.html 미수정. 충돌 0건 |
| **N-UI-OBS-2** | `v3/v3-candle-normalizer.js:30` `Date.now()` 사용 (v0.2.0-a baseline) | 보호 파일. v0.7.0 비대상. 미수정 |
| **N-UI-OBS-3** | `payload.raw.builderDebug.identityInput` 존재 | **policy: identityInput 영구 차단**. `BLOCKED_FIELDS` 에 등록. allowedFields 에 포함시켜도 노출되지 않음. Extra-B smoke 에서 검증. `cfg.debug.allowedFields` 기본값 빈 배열로 추가 안전장치 |

**N-UI-OBS-3 정정 문구**: payload.raw.builderDebug.identityInput 은 payload 내부에 존재하지만, CardViewModel debug section 에서는 직접 노출 금지. cfg.debug.allowedFields 기본값은 빈 배열이며, identityInput / payload.raw / raw.builderDebug blanket 노출은 차단. Extra-B smoke 에서 SECRET_DO_NOT_LEAK / identityInput 노출 0건 확인.

---

## 12. 다음 단계

```text
WS3 v0.8.0 — Telegram / snapshot / evaluation
```

CardViewModel 은 **데이터 객체**일 뿐, 실제 DOM 렌더링은 별도 단계.

---

## 13. 기준 commit

- branch: `claude/heuristic-cori-7865e7`
- 이전 functional baseline: WS3 v0.6.0 strategyPlan (`8ebba40`)
- 본 commit: (push 후 기록)

---

## 14. 핵심 메모

```text
- v3/v3-card-view-model.js 신규 생성 1건 (hotfix 반영본)
- 보호 파일 15종 모두 무손상
- DP-UI1 ~ DP-UI11 r0.2-final 매핑 모두 적용
- 5종 입력 mutation 0건 (DP-UI1, smoke 검증)
- displayFlags 정확히 10 boolean (DP-UI7 / r0.2-final, smoke 검증)
- metrics array 형태 (DP-UI4, smoke 검증)
- labelKey + labelKo + labelEn 라벨 패턴 (DP-UI5, smoke 검증)
- tone 의미 토큰 8종만 (DP-UI6)
- showEntryPlan/showExitPlan 은 displayFlags 에 위치 (DP-UI7)
- debug 기본 숨김 + allowedFields 기본 빈 배열 (DP-UI8)
- identityInput / candle raw array 영구 차단 (BLOCKED_FIELDS, Extra-B smoke 검증)
- sections 7개 항상 생성 (DP-UI9)
- 등급 코드 산출 / P-S/A/B tier 표시 0건 (DP-UI10)
- numeric hint 노출 sections.strategy / sections.risk 만 (DP-UI11, S7 smoke 검증)
- 외부 호출 / DOM / 브라우저 storage / KV / fetch 0건
- 런타임 clock API 0건
- 실거래 / 주문 / 알림 / 렌더 / 외부 신호 0건
- frozen input 안전성 검증 (Extra-E)
```
