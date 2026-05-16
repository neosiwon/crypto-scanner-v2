# WS3 v0.12.0 — Adapter Output Contract Pack 완료 보고

**작성일**: 2026-05-17
**branch**: `claude/heuristic-cori-7865e7`
**이전 functional baseline**: WS3 v0.11.0 adapterInputContractPack (`4c94875`)
**본 단계 산출**: `v3/v3-transport-plan.js` + `v3/v3-renderer-binding.js` (2종 신규)

---

## 1. 단계 개요

- **출력 layer 2종 신규**:
  - **TransportPlan** (`WS3_TransportPlan`): operationPacket / activeCycleDecision / evaluationOutcome / externalConfluence → dry-run plan (telegramPlan / snapshotPlan / evaluationPlan / auditPlan)
  - **RendererBinding** (`WS3_RendererBinding`): 위 5종 + cardViewModel + transportPlan → UI binding 객체 (DOM-free)
- **버전**:
  - `TRANSPORT_PLAN_VERSION = 'WS3_v0.12.0_transport_plan'`
  - `RENDERER_BINDING_VERSION = 'WS3_v0.12.0_renderer_binding'`
- **export 패턴**: `global.WS3_TransportPlan` / `global.WS3_RendererBinding` + `module.exports` (이중 환경)
- **WS3 파이프라인 13단계 완성** — 입력 builder → score → structure → cycle → strategy → card → packet → cycle → outcome → observation adapter → confluence → transport plan → renderer binding

---

## 2. TransportPlan 출력 구조

```text
transportPlan = {
  valid, version: 'WS3_v0.12.0_transport_plan', dryRun: true,
  telegramPlan: { shouldSend, channel, messageType, title, lines, warnings, reasons },
  snapshotPlan: { shouldStore, bucket, snapshotType, payloadSummary, warnings, reasons },
  evaluationPlan: { shouldStore, shouldUpdate, shouldClose, shouldReview,
                    resultType, payloadSummary, warnings, reasons },
  auditPlan: { shouldAudit, auditType, reasons, warnings },
  reasons, warnings, debug, configUsed
}
```

핵심 정책 (Gate 2 spec §4):
- **telegramPlan.shouldSend** = `op.shouldNotify && ac.allowNotify && !ac.suppressNotify && ac.canNotify` (4-stage AND)
- **snapshotPlan.shouldStore** = `op.shouldSnapshot && ac.allowSnapshot && ac.canSnapshot` (**signal snapshot 시점**, evaluationOutcome 미참조)
- **evaluationPlan.shouldStore** = `op.shouldEvaluate && ac.allowEvaluate && ac.canEvaluate && ev.shouldStoreOutcome` (4-stage AND)
- **evaluationPlan.shouldUpdate/shouldClose/shouldReview** = evaluationOutcome 단일 소스

## 3. RendererBinding 출력 구조

```text
rendererBinding = {
  valid, version: 'WS3_v0.12.0_renderer_binding',
  displayMode,                                          // U-APO-2 Option A — 7 후보
  header: { title, subtitle, primaryBadge, statusText },
  chips: [...],                                         // cardViewModel.chips 보존 + lifecycle/evaluation/confluence chip 추가
  metrics: [...],                                       // cardViewModel.metrics 보존 + movement/confluenceScore 추가
  sections: {                                           // U-APO-1 Option B — 5개 모두 array
    strategy: [],                                       // cardViewModel.sections.strategy object → display item array
    lifecycle: [],
    evaluation: [],
    confluence: [],
    transport: []
  },
  flags: {                                              // U-APO-3 Option C — namespace 분리
    binding: { showStrategy, showLifecycle, showEvaluation, showConfluence, showTransport, hasWarning, hasBlocker },
    card: { isReady, isBlocked, isCooldown, isExpired, isWeakening, isHighActionability,
            showEntryPlan, showExitPlan, showRiskWarning, showDebug }  // cardViewModel.displayFlags 10개 보존
  },
  reasons, warnings, debug, configUsed
}
```

## 4. DP-APO / U-APO / N-APO-OBS 적용 (모두 적용 / 미해결 0건)

| ID | 정책 | 구현 |
|---|---|---|
| **DP-APO1** Output Contract Pack 범위 | ✅ 2종 출력 layer 신규. fetch / Telegram / KV / DOM 구현 0건 |
| **DP-APO2** 2단계 분리 (v0.11.0 입력 / v0.12.0 출력) | ✅ v0.11.0 EvaluationObservationAdapter + ExternalConfluence + v0.12.0 TransportPlan + RendererBinding 4개 adapter 분리 완성 |
| **DP-APO3** TransportPlan dry-run only | ✅ `cfg.dryRun = true` default. 실제 발송 / 저장 코드 0건 |
| **DP-APO4** routing AND 집계 (override 금지). auditPlan은 mismatch 기록 허용 | ✅ `getOperationRouting() / getActiveCycleRouting() / getEvaluationRouting()` 읽기 전용. AND 집계 + `detectRoutingConflict()` 별도. S2/S3/S4 smoke 검증 |
| **DP-APO5** RendererBinding DOM-free | ✅ innerHTML / document. / addEventListener / className / style. / querySelector / getElementById 코드 0건 (JSDoc 정책 명시 만) |
| **DP-APO6** RendererBinding cardViewModel superset | ✅ `buildHeaderBinding / buildChipBindings / buildMetricBindings / buildStrategySection` 가 cardViewModel 보존. cardViewModel mutation 0건 (S18 검증) |
| **DP-APO7** ExternalConfluence 보조 context | ✅ confluence section 별도 array. scoreBreakdown / strategyPlan / planQualityTier 대체 0건 |
| **DP-APO8** input mutation 금지 | ✅ S18 smoke 양쪽 adapter input JSON before/after 동일 검증. Extra-A deepFreeze 입력 throw 0 |
| **DP-APO9** side-effect 금지 | ✅ network / persistence / DOM / storage / clock literal 코드 침범 0건 |
| **DP-APO10** 보호 파일 수정 금지 | ✅ 보호 21종 diff 0건 |
| **N-APO-OBS-1** v0.2.0-a baseline 책임 분리 | ✅ 본 모듈 Date.now/fetch 코드 0건 |
| **N-APO-OBS-2** warningAuditMode 분리 | ✅ `cfg.audit.warningAuditMode = 'critical'` default. `isCriticalWarning()` 7후보 (DATA_AMBIGUOUS / DATA_INSUFFICIENT / PATH_ORDER_UNKNOWN / ROUTING_CONFLICT / SUPPRESSED_NOTIFY / SECRET_FIELD_BLOCKED / RAW_INPUT_BLOCKED). Extra-B smoke 에서 off mode 검증 |
| **U-APO-1 Option B** sections.* 모두 array | ✅ 5개 sections (strategy/lifecycle/evaluation/confluence/transport) 모두 `Array.isArray()` true. cardViewModel.sections.strategy object → display item array 변환. S15 smoke 검증 |
| **U-APO-2 Option A** displayMode 7 후보 우선순위 | ✅ DISPLAY_MODE enum (UNKNOWN/DEFAULT/ALERT/REVIEW/CLOSED/BLOCKED/COOLDOWN). `classifyDisplayMode()` 7-step priority. S17 7-case 검증 |
| **U-APO-3 Option C** flags namespace 분리 | ✅ `flags.binding / flags.card` 분리. cardViewModel.displayFlags 10개 보존. S16 검증 |

## 5. TransportPlan AND 집계 정책 검증

| Plan | AND 조건 | smoke |
|---|---|---|
| **telegramPlan.shouldSend** | `op.routing.shouldNotify && ac.routingDecision.allowNotify && !ac.routingDecision.suppressNotify && ac.notifyPolicy.canNotify` | S1 (all true) / S2 (op false) / S3 (suppressNotify true) / S4 (canNotify false) |
| **snapshotPlan.shouldStore** | `op.routing.shouldSnapshot && ac.routingDecision.allowSnapshot && ac.snapshotPolicy.canSnapshot` (**evaluationOutcome 미참조** — signal snapshot 시점) | S5 (outcome routing false 무관하게 signal snapshot 통과) |
| **evaluationPlan.shouldStore** | `op.routing.shouldEvaluate && ac.routingDecision.allowEvaluate && ac.evaluationPolicy.canEvaluate && ev.routingDecision.shouldStoreOutcome` | S5 (outcome blocked → store false) / S6 (all flags true) |
| **evaluationPlan.shouldUpdate/Close/Review** | evaluationOutcome 단일 소스 | S6 |

## 6. auditPlan 정책 (Gate 2 spec §5)

| auditType (우선순위) | 조건 | smoke |
|---|---|---|
| **1. ROUTING_CONFLICT** | op routing true + ac routing/policy mismatch | S3 (notify suppress + op=true → ROUTING_CONFLICT 우선) / S8 (notify/snapshot/evaluation 각각) |
| **2. DATA_AMBIGUOUS** | evaluation.resultType === DATA_AMBIGUOUS | S7 |
| **3. DATA_INSUFFICIENT** | evaluation.resultType === DATA_INSUFFICIENT | (밑 시나리오 검증 가능) |
| **4. REVIEW_REQUIRED** | evaluationOutcome.routingDecision.shouldReview === true | (`cfg.audit.suppressReviewAudit=true` 시 생략) |
| **5. SUPPRESSED_NOTIFY** | activeCycleDecision.routingDecision.suppressNotify === true | (ROUTING_CONFLICT 보다 낮은 우선순위) |
| **6. WARNING_PRESENT** | inputWarnings + `cfg.audit.warningAuditMode` ('critical' 기본) | Extra-B (off mode 비활성 검증) |
| **7. NONE** | fallback |  |

`warningAuditMode` 정책:
- `'critical'` (기본): 7 critical warning 후보 (DATA_AMBIGUOUS / DATA_INSUFFICIENT / PATH_ORDER_UNKNOWN / ROUTING_CONFLICT / SUPPRESSED_NOTIFY / SECRET_FIELD_BLOCKED / RAW_INPUT_BLOCKED) 만 audit trigger
- `'all'`: 모든 input warning audit trigger
- `'off'`: warning 단독으로는 audit trigger 아님 (다른 trigger 조건만 사용)

## 7. RendererBinding displayMode 우선순위 (U-APO-2 Option A)

```text
1. BLOCKED:   cardViewModel.displayFlags.isBlocked === true
2. COOLDOWN:  cardViewModel.displayFlags.isCooldown === true OR activeCycleDecision.lifecycle.lifecycleState === 'COOLDOWN'
3. CLOSED:    evaluationOutcome.evaluation.status === 'CLOSED' OR activeCycleDecision.lifecycle.lifecycleState === 'EXPIRED'
4. REVIEW:    transportPlan.auditPlan.shouldAudit === true OR evaluationOutcome.routingDecision.shouldReview === true
5. ALERT:     transportPlan.telegramPlan.shouldSend === true OR operationPacket.routing.shouldNotify === true
6. DEFAULT:   valid input 존재
7. UNKNOWN:   fallback
```

S17 7개 case 모두 검증 (S17.1 BLOCKED 우선 → S17.7 empty UNKNOWN).

## 8. RendererBinding sections 구조 (U-APO-1 Option B)

```text
모두 array of display items 형태:
- sections.strategy:    cardViewModel.sections.strategy (object) → array 변환
- sections.lifecycle:   activeCycleDecision 기반
- sections.evaluation:  evaluationOutcome 기반
- sections.confluence:  externalConfluence 기반
- sections.transport:   transportPlan 기반

display item shape:
{ id, label, value, tone, meta }
```

S15 smoke 에서 5개 sections `Array.isArray()` true 검증.

## 9. RendererBinding flags namespace (U-APO-3 Option C)

```text
flags.binding:                                          // 본 layer (visibility + warning)
  showStrategy / showLifecycle / showEvaluation /
  showConfluence / showTransport / hasWarning / hasBlocker

flags.card:                                             // cardViewModel.displayFlags 보존 (read-only)
  isReady / isBlocked / isCooldown / isExpired / isWeakening /
  isHighActionability / showEntryPlan / showExitPlan /
  showRiskWarning / showDebug
```

`flags.card.*` 는 cardViewModel.displayFlags 10개를 그대로 mirror. mutation 0건. S16 smoke 검증.

## 10. dry-run wording 정책 (DP-APO9 / §11)

| 상황 | 허용 표현 | 금지 표현 |
|---|---|---|
| telegramPlan.shouldSend === true | '발송 후보' / '발송 대기' / 'dry-run' | 발송됨 / sent / delivered / completed transmission |
| snapshotPlan.shouldStore === true | '저장 계획' | 저장됨 / 전송 완료 |
| evaluationPlan.shouldStore === true | '평가 저장 후보' | (실제 저장 완료) |
| auditPlan.shouldAudit === true | '리뷰 후보' | (실제 audit 완료) |

S14 / S20 smoke 에서 모든 금지 wording 코드 0건 검증.

## 11. smoke test 결과 (22 시나리오 모두 통과)

| # | 시나리오 | 핵심 검증 |
|---|---|---|
| S1 | transportPlan all true | telegram/snapshot/evaluation 모두 true / mutation=0 |
| S2 | operation shouldNotify false | telegram false / NOTIFY_BLOCKED_BY_OPERATION |
| S3 | suppressNotify true | telegram false / audit true / ROUTING_CONFLICT 우선 |
| S4 | canNotify false | telegram false / NOTIFY_BLOCKED_BY_POLICY |
| S5 | snapshotPlan signal snapshot (outcome routing false) | snapshot=true (signal 시점) / evaluationPlan=false |
| S6 | evaluationPlan store/update/close/review | 4 flags 모두 true |
| S7 | audit DATA_AMBIGUOUS | shouldAudit=true / auditType=DATA_AMBIGUOUS |
| S8 | routing conflict split (notify/snapshot/evaluation) | 각각 ROUTING_CONFLICT_NOTIFY/SNAPSHOT/EVALUATION reason |
| S9 | rendererBinding basic | header/chips/metrics 보존 |
| S10 | operationPacket available | displayMode ALERT/DEFAULT |
| S11 | lifecycle section | sections.lifecycle array + lifecycleState item |
| S12 | evaluation section | sections.evaluation array + resultType=TARGET_HIT / no trading wording |
| S13 | confluence section | sections.confluence array + confluenceLabel=FAVORABLE |
| S14 | transport section dry-run wording | 발송 후보 / dry-run 만. 발송됨/sent/delivered 0건 |
| S15 | sections all arrays | 5개 모두 Array.isArray true |
| S16 | flags namespace | binding/card 분리. card.isBlocked cardViewModel 보존 |
| S17 | displayMode priority | 7 case (BLOCKED/COOLDOWN/CLOSED/REVIEW/ALERT/DEFAULT/UNKNOWN) |
| S18 | mutation check | TP/RB 양쪽 입력 JSON before/after 동일 |
| S19 | forbidden side-effect runtime | sync return / not Promise |
| S20 | raw/secret/trading wording | 22개 금지 표현 + raw/secret 0건 |
| Extra-A | frozen-input safety | deepFreeze input throw 0 |
| Extra-B | warningAuditMode off | critical default + off mode benign warning 비활성 |

(smoke 파일 `_ws3_v120_smoke.js` 는 검증 후 worktree 에서 제거)

## 12. 금지 패턴 grep 결과 (실코드 침범 0건)

| 패턴 | TransportPlan | RendererBinding |
|---|---|---|
| `fetch( / KV. / DB / Telegram / sendTelegram / XMLHttpRequest / innerHTML / document. / addEventListener / localStorage / sessionStorage / Date.now( / new Date / performance.now` | 5 lines (모두 JSDoc 정책 comment + `buildTelegramPlan` 함수명 — allowed identifier) | 2 lines (모두 JSDoc 정책 comment) |
| `operationPacket/activeCycleDecision/evaluationOutcome/externalConfluence/cardViewModel/transportPlan.X = mutation` | **0건** ✅ | **0건** ✅ |
| `secret / token / chatId / botToken / apiKey / payload.raw / identityInput / raw.builderDebug / raw candles / full API response` | 1 line (JSDoc 정책 명시) | 1 line (JSDoc 정책 명시) |
| `매수 성공 / 손절 / 익절 / 수익 확정 / 손실 확정 / profit / loss / 매수하세요 / 매도하세요 / buy now / sell now / take profit / stop loss / 발송됨 / 저장됨 / 전송 완료 / delivered / completed transmission` | 2 lines (JSDoc 정책 명시) | 3 lines (JSDoc 정책 명시) |
| `innerHTML / document. / addEventListener / className / style. / querySelector / getElementById` | (해당없음) | 2 lines (JSDoc 정책 명시) |

**모든 매치는 JSDoc 정책 명시 comment 또는 allowed identifier (`buildTelegramPlan` 함수명)**. 실제 코드 침범 0건. S14 / S20 smoke 에서 출력 객체 내부 wording 도 0건 검증.

## 13. 보호 파일 diff 검증

`git diff --stat HEAD -- <protected21>` = 빈 출력 ✅

```text
v3 *.js 16종 (config/feature-payload/bithumb-client/candle-normalizer/indicators/
              feature-payload-builder/score-breakdown/structure-bucket/signal-cycle/
              strategy-plan/card-view-model/operation-packet/active-cycle/
              evaluation-outcome/evaluation-observation-adapter/external-confluence) → 0 변경
docs/ws3/WS3_CODE_CONTRACT.md (b-r2 박제) /
docs/ws3/WS3_WORKFLOW_TEMPLATE.md (v0.1 박제)                              → 0 변경
index.html / manifest.json / service-worker.js                            → 0 변경
```

**21종 보호 파일 무손상** ✅

신규/변경 파일 (이번 단계):
- `v3/v3-transport-plan.js` (신규, 740줄, untracked)
- `v3/v3-renderer-binding.js` (신규, 834줄, untracked)
- `docs/ws3/WS3_v0_12_0_ADAPTER_OUTPUT_CONTRACT_PACK_REPORT.md` (신규, untracked, 본 파일)
- `docs/ws3/WS3_CHANGELOG.md` (modified — `[v0.12.0]` 엔트리 상단)
- `docs/ws3/WS3_CURRENT_BASELINE.md` (modified — v0.12.0 baseline)

## 14. 의도된 미구현 (이번 단계 제외)

- 실제 Telegram 발송 / sendTelegram / network 호출
- 실제 KV / DB / 파일 IO / 브라우저 storage read/write
- 실제 snapshot 저장 / outcome 영속화
- DOM 렌더 / UI 이벤트 연결 / HTML 문자열 생성
- 입력 6종 mutation
- 런타임 clock API (Date.now / new Date / performance.now)
- 매매 권고 / 매수·매도 어휘 / 수익·손실 확정 / 전송완료 어휘
- bot 식별 시크릿 / 채널 식별자 / API 키

## 15. 다음 단계

```text
(별도) v0.12.x transport adapter — 실제 Telegram 발송 / KV 저장 / DB persistence
  - TransportPlan.telegramPlan → 실제 sendTelegram
  - TransportPlan.snapshotPlan → 실제 KV/DB write
  - TransportPlan.evaluationPlan → 실제 outcome persistence
  - TransportPlan.auditPlan → 실제 audit log

(별도) v0.12.x renderer adapter — 실제 DOM/HTML 렌더
  - RendererBinding → DOM tree

(별도) v0.11.x — 실제 외부 데이터 수집 adapter
(별도) v0.10.x evaluation adapter — 실제 24h/7d 캔들 fetch
```

## 16. 기준 commit

- branch: `claude/heuristic-cori-7865e7`
- 이전 functional baseline: WS3 v0.11.0 adapterInputContractPack (`4c94875`)
- 본 commit: (push 후 기록)

## 17. 핵심 메모

```text
- v3/v3-transport-plan.js 신규 (740 라인)
- v3/v3-renderer-binding.js 신규 (834 라인)
- 보호 파일 21종 모두 무손상 (v3 *.js 16종 + index/manifest/sw 3종 + CODE_CONTRACT + WORKFLOW_TEMPLATE)
- DP-APO1 ~ DP-APO10 모두 적용 / 미해결 항목 0건
- U-APO-1 Option B: sections.* 모두 array (5종)
- U-APO-2 Option A: displayMode 7 후보 우선순위 분류
- U-APO-3 Option C: flags namespace 분리 (binding/card)
- N-APO-OBS-1: v0.2.0-a baseline 보호 파일 책임 분리
- N-APO-OBS-2: warningAuditMode 'critical'/'all'/'off'. critical 7후보
- TransportPlan:
  - telegramPlan 4-stage AND (op shouldNotify + ac allowNotify + !suppressNotify + canNotify)
  - snapshotPlan = signal snapshot 시점 (3-stage AND, outcome 미참조). S5 검증
  - evaluationPlan = 4-stage AND (outcome shouldStoreOutcome 포함)
  - auditPlan 7후보 우선순위 (ROUTING_CONFLICT 최상위)
  - detectRoutingConflict: notify/snapshot/evaluation 각각 별도 ROUTING_CONFLICT_* reason
- RendererBinding:
  - cardViewModel superset (header/chips/metrics 보존, sections.strategy object → array 변환)
  - sections 5종 모두 array
  - displayMode 7후보 priority (BLOCKED→COOLDOWN→CLOSED→REVIEW→ALERT→DEFAULT→UNKNOWN)
  - flags.binding + flags.card 분리
  - DOM API / CSS literal / event 바인딩 0건
- smoke test 22 시나리오 (20 핵심 + 2 Extra) 통과
- 입력 mutation 0건 (DP-APO8, S18 검증)
- fetch / KV / DB / Telegram / DOM / storage / clock 코드 침범 0건
- raw / identityInput / secret / token / chatId / botToken / apiKey 코드 0건
- 매매 권고 / 매수·매도 어휘 / 수익·손실 확정 / 전송완료 어휘 코드 0건
- WS3 파이프라인 13단계 완성 (v0.11.0 입력 adapter + v0.12.0 출력 adapter)
```
