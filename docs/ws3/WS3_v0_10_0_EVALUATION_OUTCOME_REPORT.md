# WS3 v0.10.0 — EvaluationOutcome / Result Classifier 완료 보고

**작성일**: 2026-05-16
**branch**: `claude/heuristic-cori-7865e7`
**이전 functional baseline**: WS3 v0.9.0 activeCycle (`00831af`)
**본 단계 산출**: `v3/v3-evaluation-outcome.js` (신규)

---

## 1. 단계 개요

- 입력 4종 (`operationPacket` (v0.8.0) + `activeCycleDecision` (v0.9.0) + `evaluationObservation` (caller 주입 외부 요약) + `previousEvaluationState` (caller 주입, null 가능)) → standalone `evaluationOutcome` (평가 결과 분류 데이터. 저장소 / 수집기 아님)
- 모듈 식별자: `WS3_EvaluationOutcome`
- 버전: `EVALUATION_OUTCOME_VERSION = 'WS3_v0.10.0'`
- export 패턴: `global.WS3_EvaluationOutcome = Object.freeze(api)` + `module.exports = api` (이중 환경)
- IIFE / `'use strict'` / `var`-style (v0.7.0 / v0.8.0 / v0.9.0 동일 스타일)

---

## 2. 출력 구조 (Gate 2 spec §5 — top-level 15-field)

```text
evaluationOutcome = {
  valid, version, candidateKey,
  identity: { exchange, market, base, quote, displayName, timeframe },
  evaluation: { evaluationType, window, status, resultType, resultPhase, complete, startTs, endTs },
  priceBasis: { baselinePrice, currentPrice, highPrice, lowPrice, closePrice },
  movement: { currentChangePct, maxFavorablePct, maxAdversePct, closeChangePct,
              highMovePct, lowMovePct, previousMaxFavorablePct, previousMaxAdversePct },
  targetCheck: { targetHit, targetHitType, targetValue, targetPct, targetHitTs, reasons, warnings },
  invalidationCheck: { invalidated, invalidationType, invalidationValue, invalidationPct,
                       invalidatedTs, reasons, warnings },
  pathOrder: { pathOrderKnown, firstEvent, ambiguous, reason, warnings },
  quality: { outcomeQuality, confidence, enoughObservation, dataWarnings },
  routingDecision: { shouldStoreOutcome, shouldUpdateEvaluation, shouldCloseEvaluation,
                     shouldReview, reasons, warnings },
  nextEvaluationState: { valid, candidateKey, evaluationType, window, status, resultType,
                         startTs, lastObservedTs, completedTs, baselinePrice, lastPrice,
                         maxFavorablePct, maxAdversePct, targetHit, invalidated, reasons, warnings },
  reasons, warnings, debug: { source, configVersion }, configUsed: { thresholds, routing, safety, debug }
}
```

---

## 3. DP-EO / U-EO / N-EO-OBS 적용 (모두 적용 / 미해결 0건)

| ID | 정책 | 구현 |
|---|---|---|
| **DP-EO1** standalone / 4종 입력 mutate 금지 | ✅ S1 smoke 에서 mutation=0 검증. `operationPacket.X = / activeCycleDecision.X = / evaluationObservation.X = / previousEvaluationState.X =` grep 0건 |
| **DP-EO2** side-effect 금지 | ✅ network / persistence / DOM / storage / clock literal 코드 침범 0건 |
| **DP-EO3** observation caller 주입 | ✅ `getObservationPrices()` 가 read-only 추출 |
| **DP-EO4** raw candles 금지 | ✅ evaluationObservation 의 highPrice/lowPrice/closePrice/currentPrice scalar 만 사용. raw candles array 0건 |
| **DP-EO5** baselinePrice 기준 (evaluationSeed → observation → null) | ✅ `getBaselinePrice()` 2-step fallback + DATA_INSUFFICIENT. S10 검증 |
| **DP-EO6** target/invalidation numeric only + unit 분리 | ✅ `classifyHintUnit()` 헬퍼 (default 'price'). hint.unit==='pct' 시 targetPct/invalidationPct 채움. cfg fallback 만이 추가 pct unit 으로 작용 |
| **DP-EO7** DATA_AMBIGUOUS 최후 fallback | ✅ `detectPathOrder()` highTs/lowTs 비교. 모두 numeric 시 firstEvent 결정. 부재/동일 시 ambiguous. S11/S12/S13 검증 |
| **DP-EO8** thresholds config-driven | ✅ DEFAULT_EVALUATION_OUTCOME_CONFIG.thresholds 후속 tuning 가능 |
| **DP-EO9** 안전 결과 라벨 | ✅ RESULT_TYPE 11 후보 (TARGET_HIT/INVALIDATED/WATCH_CONFIRMED 등). 매수 성공/손절/익절/수익 확정 어휘 코드 0건 |
| **DP-EO10** nextEvaluationState 포함 (저장 0건) | ✅ `buildNextEvaluationState()` 산출 only. KV/DB write 0건 |
| **DP-EO11** status vs resultType 분리 | ✅ `classifyStatus()` (6-step priority) vs `classifyResultType()` (11-step priority) 독립 산출 |
| **DP-EO12** changePct/movementPct만 / profit·loss 금지 | ✅ `safePct()` 헬퍼만 사용. profit/loss/수익·손실 확정 코드 0건 |
| **DP-EO13** previousEvaluationState caller 주입 / null → empty | ✅ `normalizePreviousEvaluationState()` 가 null/invalid → base empty state |
| **DP-EO14** movement 누적 (max/min) | ✅ `safeMaxOrPick()` / `safeMinOrPick()` 헬퍼. S14 smoke 에서 prev maxFav=7 + cur highMove=3 → max=7, prev maxAdv=-2 + cur lowMove=-1 → min=-2 검증 |
| **U-EO-1 Option A** hint.unit 부재 → default 'price'. UNIT_AMBIGUOUS 조건부 detection | ✅ `classifyHintUnit()` default 'price'. `checkUnitAmbiguity()` 0<v<1 + baseline≥10 시만 trigger. Extra-D (default price), Extra-E (UNIT_AMBIGUOUS 감지) 검증 |
| **U-EO-2** target/invalidation 다중 hint 선택 정책 | ✅ target: 첫 numeric TARGET → safeHints TARGET → cfg.planTargetPct. invalidation: type='INVALIDATION' 우선 → 'SETUP_INVALIDATION' → safeHints INVALIDATION → cfg.invalidationPct. Extra-C 검증 (INVALIDATION 95 wins over SETUP_INVALIDATION 50) |
| **U-EO-3** DATA_AMBIGUOUS pathOrderKnown=false 만 | ✅ `classifyResultType()` step 4: targetHit && invalidated && pathOrderKnown !== true 시만 DATA_AMBIGUOUS. pathOrderKnown=true 시 firstEvent 로 TARGET_HIT/INVALIDATED 분기 (step 5-6). S11/S12/S13 검증 |
| **N-EO-OBS-1** timestamp 정책 | ✅ `pickStartTs()` (evaluationSeed.startTs → observation.startTs → prev.startTs → null). `pickLastObservedTs()` (endTs → closeTs → prev → null). Date.now/new Date/performance.now 사용 0건 |
| **N-EO-OBS-2** 보호 파일 책임 분리 | ✅ v0.2.0-a baseline 의 Date.now/fetch 책임. 본 모듈 침범 0건 |

## 4. status 분류 우선순위 (6-step)

```text
1. INVALID          — opValid !== true OR acValid !== true OR candidateKey 부재
2. CLOSED           — activeCycle.lifecycleState === EXPIRED OR evaluationMode === CLOSE
3. COMPLETED        — observation.complete === true OR targetHit === true OR invalidated === true
4. IN_PROGRESS      — observation valid && !complete && !targetHit && !invalidated
5. PENDING          — !observation OR observation.valid !== true
6. UNKNOWN          — fallback
```

S1 IN_PROGRESS / S15 INVALID / Extra-A CLOSED 검증.

## 5. resultType 분류 우선순위 (11-step)

```text
1. DATA_INSUFFICIENT — baselinePrice 부재 OR price 모두 부재
2. EXPIRED_REVIEW    — evaluationSeed.evaluationType === EXPIRED_REVIEW OR lifecycleState === EXPIRED
3. COOLDOWN_REVIEW   — evaluationType === COOLDOWN_REVIEW OR lifecycleState === COOLDOWN
4. DATA_AMBIGUOUS    — targetHit && invalidated && pathOrderKnown !== true (U-EO-3)
5. INVALIDATED       — (invalidated && !targetHit) OR (둘 다 hit && pathKnown && firstEvent==='INVALIDATION')
6. TARGET_HIT        — (targetHit && !invalidated) OR (둘 다 hit && pathKnown && firstEvent==='TARGET')
7. WATCH_CONFIRMED   — evaluationType === WATCH_24H && maxFavorablePct >= watchConfirmPct
8. WATCH_FAILED      — evaluationType === WATCH_24H && complete && maxFavorablePct < watchConfirmPct
9. NEUTRAL           — complete && not above
10. IN_PROGRESS      — !complete
11. NONE             — fallback
```

S2/S3/S4 TARGET_HIT / S5/S6/S7 INVALIDATED / S8 WATCH_CONFIRMED / S9 WATCH_FAILED / S10 DATA_INSUFFICIENT / S11 TARGET_HIT (firstEvent=TARGET) / S12 INVALIDATED (firstEvent=INVALIDATION) / S13 DATA_AMBIGUOUS / Extra-A EXPIRED_REVIEW / Extra-B COOLDOWN_REVIEW 검증.

## 6. target / invalidation source resolution (U-EO-2)

### target source 우선순위
```text
1. operationPacket.evaluationSeed.targetHints[0] (numeric TARGET) — 첫 numeric value
2. operationPacket.notificationPacket.safeHints (type='TARGET')
3. cfg.thresholds.planTargetPct fallback (pct)
4. null
```

### invalidation source 우선순위 (U-EO-2)
```text
1. operationPacket.evaluationSeed.invalidationHints (type='INVALIDATION') ← Extra-C 검증
2. operationPacket.evaluationSeed.invalidationHints (type='SETUP_INVALIDATION')
3. operationPacket.notificationPacket.safeHints (type='INVALIDATION')
4. cfg.thresholds.invalidationPct fallback (pct)
5. null
```

**unit 정책 (U-EO-1)**:
- `hint.unit === 'pct'` → targetPct/invalidationPct
- `hint.unit === 'price'` 또는 부재 → targetValue/invalidationValue (default 'price')
- config fallback → 항상 pct

### UNIT_AMBIGUOUS 감지 (U-EO-1)
- 조건: `0 < hint.value < 1` AND `baselinePrice isNumericPrice && >= 10`
- baselinePrice null/<10 시 검사 skip (defensive)
- Extra-E 에서 value=0.05 + baseline=100 → `warnings: ['UNIT_AMBIGUOUS:target']` 검증

## 7. movement 누적 정책 (DP-EO14)

```text
maxFavorablePct = safeMaxOrPick(
  previousEvaluationState.maxFavorablePct (numeric 시),
  highMovePct (numeric 시)
)

maxAdversePct = safeMinOrPick(
  previousEvaluationState.maxAdversePct (numeric 시),
  lowMovePct (numeric 시)
)
```

null safety:
- prev numeric + current numeric → max/min 비교
- prev null, current numeric → current
- prev numeric, current null → prev 유지
- prev null, current null → null

S14 검증: prev maxFav=7 + cur highMove=3 → max=7 (prev wins). prev maxAdv=-2 + cur lowMove=-1 → min=-2 (prev wins).

## 8. path order 정책 (U-EO-3)

```text
case 1: 단일 event (target only or invalidation only)
  → pathOrderKnown = true, firstEvent = TARGET/INVALIDATION

case 2: 둘 다 hit + highTs/lowTs 모두 numeric
  highTs < lowTs:  firstEvent = TARGET / reason = TARGET_HIT_BEFORE_INVALIDATION
  highTs > lowTs:  firstEvent = INVALIDATION / reason = INVALIDATION_BEFORE_TARGET
  highTs === lowTs: ambiguous = true / warning = SIMULTANEOUS_HIGH_LOW

case 3: 둘 다 hit + highTs/lowTs 중 하나라도 null
  ambiguous = true / warning = PATH_ORDER_UNKNOWN
```

S11 firstEvent=TARGET / S12 firstEvent=INVALIDATION / S13 ambiguous 검증.

## 9. smoke test 결과 (21 시나리오 모두 통과)

| # | 시나리오 | 핵심 검증 |
|---|---|---|
| S1 | in progress | status=IN_PROGRESS, resultType=IN_PROGRESS, mutation=0 |
| S2 | target hit by value | targetHit / targetHitType=BY_VALUE / TARGET_HIT |
| S3 | target hit by pct (cfg fallback) | targetHit / BY_PCT / TARGET_HIT |
| S4 | hint value supersedes cfg pct | targetValue=104, targetPct=null (priority chain) |
| S5 | invalidated by value | invalidated / BY_VALUE / INVALIDATED |
| S6 | invalidated by pct (cfg fallback) | BY_PCT / INVALIDATED |
| S7 | hint value supersedes cfg pct (invalidation) | invalidationValue=96, invalidationPct=null |
| S8 | watch confirmed | WATCH_24H + maxFav=4 ≥ 3 → WATCH_CONFIRMED |
| S9 | watch failed | complete + maxFav=2 < 3 → WATCH_FAILED |
| S10 | data insufficient | baselinePrice null → DATA_INSUFFICIENT |
| S11 | path target first | highTs<lowTs → firstEvent=TARGET / TARGET_HIT |
| S12 | path invalidation first | highTs>lowTs → firstEvent=INVALIDATION / INVALIDATED |
| S13 | path ambiguous | highTs/lowTs null → DATA_AMBIGUOUS / shouldReview=true |
| S14 | movement cumulative | prev maxFav=7 + cur=3 → max=7. prev maxAdv=-2 + cur=-1 → min=-2 |
| S15 | invalid inputs | null inputs → status=INVALID / valid=false |
| Extra-A | CLOSED via evaluationMode='CLOSE' | shouldCloseEvaluation=true |
| Extra-B | COOLDOWN_REVIEW | shouldReview=true |
| Extra-C | U-EO-2 INVALIDATION priority | invalidationValue=95 (INVALIDATION wins over SETUP_INVALIDATION) |
| Extra-D | U-EO-1 default 'price' | hint w/o unit → targetValue / BY_VALUE |
| Extra-E | UNIT_AMBIGUOUS detection | value=0.05 + baseline=100 → UNIT_AMBIGUOUS:target 워닝 |
| Extra-F | frozen input safety | deepFreeze 입력에 throw 0 |

(smoke 파일 `_ws3_v100_smoke.js` 는 검증 후 worktree 에서 제거)

## 10. 금지 패턴 grep 결과

| 패턴 | 결과 |
|---|---|
| `fetch(\|KV.\|DB\|Telegram\|sendTelegram\|XMLHttpRequest\|innerHTML\|document.\|addEventListener\|localStorage\|sessionStorage\|Date.now(\|new Date\|performance.now` | comment 1건 (line 61 DP-EO2 정책 명시 "KV / DB / ...") — **코드 침범 0건** ✅ |
| `operationPacket.X = ...` mutation | **0건** ✅ |
| `activeCycleDecision.X = ...` mutation | **0건** ✅ |
| `evaluationObservation.X = ...` mutation | **0건** ✅ |
| `previousEvaluationState.X = ...` mutation | **0건** ✅ |
| `delete <input>.` | **0건** ✅ |
| `payload.raw\|identityInput\|raw.builderDebug\|secret\|token\|chatId\|botToken\|apiKey\|raw candles\|full API response` | comment 3건 (line 19 DP-EO4, line 67-68 금지 명시) — **코드 침범 0건** ✅ |
| `매수 성공\|손절\|익절\|수익 확정\|손실 확정\|profit\|loss\|매수하세요\|매도하세요\|buy now\|sell now\|take profit\|stop loss` | comment 4건 (line 29 DP-EO9, line 33 DP-EO12, line 66 행동 어조 금지, line 70 매매 어휘 금지) — **코드 침범 0건** ✅ |

## 11. 보호 파일 diff 검증

`git diff --stat HEAD -- <protected18>` = 빈 출력 ✅

```text
v3/v3-config.js / v3-feature-payload.js / v3-bithumb-client.js /
v3-candle-normalizer.js / v3-indicators.js / v3-feature-payload-builder.js /
v3-score-breakdown.js / v3-structure-bucket.js / v3-signal-cycle.js /
v3-strategy-plan.js / v3-card-view-model.js / v3-operation-packet.js /
v3-active-cycle.js                                                       → 0 변경
docs/ws3/WS3_CODE_CONTRACT.md (b-r2 박제) /
docs/ws3/WS3_WORKFLOW_TEMPLATE.md (v0.1 박제)                              → 0 변경
index.html / manifest.json / service-worker.js                            → 0 변경
```

신규/변경 파일 (이번 단계):
- `v3/v3-evaluation-outcome.js` (신규, untracked, 1407줄)
- `docs/ws3/WS3_v0_10_0_EVALUATION_OUTCOME_REPORT.md` (신규, untracked, 본 파일)
- `docs/ws3/WS3_CHANGELOG.md` (modified — `[v0.10.0]` 엔트리 상단)
- `docs/ws3/WS3_CURRENT_BASELINE.md` (modified — v0.10.0 baseline)

## 12. 의도된 미구현 (이번 단계 제외)

- 24h/7d 캔들 실제 fetch / 외부 API 호출
- KV / DB / 파일 IO / 브라우저 storage
- 알림 발송 / snapshot 저장 / outcome 영속화
- DOM 렌더 / UI 이벤트 연결
- 입력 4종 mutation
- 런타임 clock API
- 매매 권고 / 매수·매도 어휘 / 수익·손실 확정

## 13. 다음 단계

```text
WS3 v0.10.x+ — externalConfluence / 사후평가 보정 / transport adapter
  - 빗썸 공식 externalConfluence
  - 사후평가 보정 분석

(별도) v0.10.x evaluation adapter — 실제 24h/7d 캔들 fetch + outcome persistence
(별도) v0.9.x transport adapter — 실제 외부 전송 / KV 저장
(별도) v0.8.x transport — OperationPacket 실제 전송
(별도) v0.7.x renderer — DOM / HTML 렌더
```

## 14. 기준 commit

- branch: `claude/heuristic-cori-7865e7`
- 이전 functional baseline: WS3 v0.9.0 activeCycle (`00831af`)
- 본 commit: (push 후 기록)

## 15. 핵심 메모

```text
- v3/v3-evaluation-outcome.js 신규 생성 1건 (1407 라인)
- 보호 파일 18종 모두 무손상 (v3 *.js 13종 + index/manifest/sw 3종 + CODE_CONTRACT + WORKFLOW_TEMPLATE)
- WS3_CODE_CONTRACT.md 미수정 (b-r2 박제본 그대로)
- WS3_WORKFLOW_TEMPLATE.md 미수정 (v0.1 박제본 그대로)
- DP-EO1 ~ DP-EO14 모두 적용 / 미해결 항목 0건
- 입력 4종 (operationPacket + activeCycleDecision + evaluationObservation + previousEvaluationState) mutation 모두 0건 (DP-EO1, smoke 검증)
- status 6 후보 (UNKNOWN/PENDING/IN_PROGRESS/COMPLETED/CLOSED/INVALID) - DP-EO11
- resultType 11 후보 (NONE/IN_PROGRESS/TARGET_HIT/INVALIDATED/WATCH_CONFIRMED/WATCH_FAILED/NEUTRAL/EXPIRED_REVIEW/COOLDOWN_REVIEW/DATA_INSUFFICIENT/DATA_AMBIGUOUS)
- resultPhase 6 후보 / outcomeQuality 4 후보
- movement 누적 (DP-EO14): max(prev.maxFav, cur.highMove) / min(prev.maxAdv, cur.lowMove). S14 검증
- baselinePrice 2-step fallback (DP-EO5): evaluationSeed.baselinePrice → observation.baselinePrice → null
- target source: targetHints[0] → safeHints TARGET → cfg.planTargetPct (priority chain first-match-wins)
- invalidation source: type='INVALIDATION' 우선 → type='SETUP_INVALIDATION' → safeHints INVALIDATION → cfg.invalidationPct (U-EO-2)
- unit 분리 (DP-EO6 + U-EO-1 Option A): hint.unit 부재 → default 'price'. pct는 unit==='pct' 또는 cfg fallback 만. UNIT_AMBIGUOUS 검사는 0<v<1 + baseline≥10 시만 trigger
- path order (U-EO-3): DATA_AMBIGUOUS 는 pathOrderKnown=false 일 때만. true 면 firstEvent 로 TARGET_HIT/INVALIDATED 분기. S11/S12/S13 검증
- nextEvaluationState 산출 only (DP-EO10). 실제 저장 0건
- 런타임 clock API (Date.now/new Date/performance.now) 0건
- 외부 호출 (fetch/XMLHttpRequest) 0건
- raw candles array / payload.raw / identityInput / secret / token / chatId / botToken / apiKey 0건
- 매매 권고 / 매수·매도 어조 / 수익·손실 확정 코드 0건
- frozen input 안전성 검증 (Extra-F)
```
