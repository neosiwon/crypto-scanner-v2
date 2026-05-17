# WS3 Current Baseline

> 현재 GitHub 박제 기준 (최신).  
> 다음 단계 작업 전에 이 파일로 baseline 을 확인.

**최종 업데이트**: 2026-05-17  
**기능 단계 (current functional baseline)**: WS3 v0.15.0 Transport Executor Harness — Dry-Run (본 단계)  
**이전 기능 baseline**: WS3 v0.14.0 secureTransportExecutorContract (`644c525`)  
**운영 문서**: WS3 Workflow Template v0.1 박제 (`d8bebc2`, v0.3.0-docs)  
**branch**: `claude/heuristic-cori-7865e7`

---

## 완료된 단계

| 단계 | 파일 | commit | 상태 |
|---|---|---|---|
| WS3 v0.1.0 | `/v3/v3-config.js` | — | ✅ 박제 |
| WS3 v0.1.0 | `/v3/v3-feature-payload.js` | — | ✅ 박제 (코드 계약 정의) |
| WS3 v0.2.0-a | `/v3/v3-bithumb-client.js` | — | ✅ 박제 |
| WS3 v0.2.0-a | `/v3/v3-candle-normalizer.js` | — | ✅ 박제 |
| WS3 v0.2.0-b | `/v3/v3-indicators.js` | `c98cbd8` | ✅ 박제 |
| WS3 v0.2.0-b-r1 | baseline consistency (문서) | `da00e62` | ✅ 박제 |
| WS3 v0.2.0-b-r2 | Code Contract Freeze (문서) | `04eac43` | ✅ 박제 |
| WS3 v0.2.0-c-r1 | `/v3/v3-feature-payload-builder.js` | `51e510d` | ✅ 박제 |
| WS3 v0.3.0 | `/v3/v3-score-breakdown.js` | `b7e0ea3` | ✅ 박제 |
| WS3 v0.3.0-docs | `/docs/ws3/WS3_WORKFLOW_TEMPLATE.md` | `d8bebc2` | ✅ 박제 (운영 문서) |
| WS3 v0.4.0 | `/v3/v3-structure-bucket.js` | `9e94b4d` | ✅ 박제 |
| WS3 v0.5.0 | `/v3/v3-signal-cycle.js` | `59c8b78` | ✅ 박제 |
| WS3 v0.6.0 | `/v3/v3-strategy-plan.js` | `8ebba40` | ✅ 박제 |
| WS3 v0.7.0 | `/v3/v3-card-view-model.js` | `7e2ef36` | ✅ 박제 |
| WS3 v0.8.0 | `/v3/v3-operation-packet.js` | `2fb95cf` | ✅ 박제 |
| WS3 v0.9.0 | `/v3/v3-active-cycle.js` | `00831af` | ✅ 박제 |
| WS3 v0.10.0 | `/v3/v3-evaluation-outcome.js` | `887123a` | ✅ 박제 |
| WS3 v0.11.0 | `/v3/v3-evaluation-observation-adapter.js` + `/v3/v3-external-confluence.js` | `4c94875` | ✅ 박제 |
| WS3 v0.12.0 | `/v3/v3-transport-plan.js` + `/v3/v3-renderer-binding.js` | `8fd0551` | ✅ 박제 |
| WS3 v0.13.0 | `/v3/v3-transport-execution-adapter.js` | `5d05836` | ✅ 박제 |
| WS3 v0.14.0 | `/v3/v3-secure-transport-executor-contract.js` | `644c525` | ✅ 박제 |
| **WS3 v0.15.0** | **`/v3/v3-transport-executor-harness.js`** | **(push 후 기록)** | **✅ 박제 (이번 단계, DRY_RUN_HARNESS transport executor harness)** |

## REJECTED — repo 반영 보류

| 단계 | 사유 |
|---|---|
| WS3 v0.2.0-c (1차 수정본) | REJECTED / NOT APPLIED — v3-feature-payload.js 코드 계약 위반 6건. v0.2.0-c-r1 로 재작성 완료. |

---

## 기준 백서

```text
/docs/ws3/WOOS_Scanner_V3_개발백서_v0_3_3.md
```

> ⚠️ **백서 repo 박제 상태**: 이전 감사 시점 기준, 위 경로의 백서 파일은 실제 repo 에 박제되어 있지 않다.  
> 백서 본문은 별도 위치 (Claude Web / 사용자 로컬) 에서 관리되고 있으며, repo 박제는 추후 별도 단계로 진행될 예정.  
> 본 baseline 의 모든 "기준 백서" 참조는 해당 미박제 문서를 가리킨다.  
> 코드 계약 충돌 시에는 **`WS3_CODE_CONTRACT.md` 가 우선** (백서 박제 여부와 무관).

## 단일 코드 계약 기준 (필수)

```text
/docs/ws3/WS3_CODE_CONTRACT.md   ← v0.2.0-b-r2 박제본 (이번 c-r1 단계에서도 미수정)
```

**충돌 시 우선순위**:
```text
WS3_CODE_CONTRACT.md  >  백서  >  기타 문서
```

---

## 운영 문서 (워크플로우 표준)

```text
/docs/ws3/WS3_WORKFLOW_TEMPLATE.md   ← v0.1 박제본 (v0.3.0-docs 단계, 2026-05-16)
```

**용도**:
- GPT 작업지시서 초안 → Claude Web 피드백 → GPT 최종 전문 → Claude Code 실행 흐름의 단일 표준
- 14단계 흐름 / 4 Gate (Gate 1 사전조사 / Gate 2 코드 작성 / Gate 3 commit / Gate 4 push) / PR-main merge 별도 승인 (Gate 5/6)
- commit 메시지 한 줄 원칙
- DP prefix 명명 규칙 (DP-1~7 / DP-S* / DP-STR* / DP-CYC* / DP-STG*)

**역할 분담** (§0.1):
- **GPT** = 작업지시서 초안 전문 작성 + 최종 전문 작성 + commit 메시지 작성
- **Claude Web** = 작업지시서 피드백만
- **Claude Code** = repo 실제 코드 작성 / 검증 / diff / commit / push

**변경 정책** (§15): 즉흥 수정 금지. 변경 필요 시 별도 단계 (v0.2 등) 로 박제.

---

## V3 핵심 전제

```text
- V3 는 기존 WOOS 확장이 아니라 독립 정밀 스캐너
- 기존 active/completed/history/관심/정밀/표준 의미 이식 금지
- 기존 UI 톤과 raw → state → ViewModel → render 철학만 참고
- Bithumb-only v0
- v3-feature-payload.js 코드 계약 우선
- 백서와 코드 계약이 충돌하면 WS3_CODE_CONTRACT.md 우선
- 외부 신호는 featurePayload 에 넣지 않고 externalConfluence 로 분리
- 외부 신호는 점수/등급 영향 X
- 지표/라벨링 기준값은 항상 config override 가능
```

---

## v3FeaturePayload 코드 계약 요약 (WS3_CODE_CONTRACT.md 발췌)

### top-level field (13개)

```text
1.  identity         (object, isValid 검사)
2.  ts               (number | null, isValid 미검사)
3.  candles          (object, m5/m15/h1/h4/d1 배열 — isValid 검사)
4.  indicators       (object, isValid 검사)
5.  structure        (object, isValid 검사)
6.  volume           (object, isValid 검사)
7.  momentum         (object, isValid 검사)
8.  marketContext    (object, isValid 검사, default {state:'UNKNOWN'})
9.  buyPressure      (object, isValid 검사, default {state:'BUY_PRESSURE_UNKNOWN'})
10. coinMeta         (null default, isValid 미검사)
11. newsContext      (null default, isValid 미검사)
12. risk             (object, isValid 검사 — flags[] / level string 포함, default {penalty:null,level:'UNKNOWN',flags:[]})
13. raw              (object, isValid 검사)
```

### identity

```text
{
  base:        null         (default, isValid 미검사)
  quote:       'KRW'        (default, isValid string 검사)
  market:      null         (default, isValid 미검사)
  exchange:    'BITHUMB'    (default, isValid string 검사)
  displayName: null         (default, isValid 미검사)
}
```

### candles

```text
{ m5: [], m15: [], h1: [], h4: [], d1: [] }
모두 배열 검사
```

### export

```text
global.WS3_FeaturePayload = Object.freeze({ createEmpty, build, isValid })
IIFE browser-global 방식
build 함수는 throw 상태 유지 (c-r1 DP-3-A 결정 — builder는 별도 파일).
```

자세한 내용은 `WS3_CODE_CONTRACT.md` 참고.

---

## v3-feature-payload-builder.js 요약 (c-r1 신규)

### 입력 / 출력

```text
입력:
  - V3BuildCandlesInput  { m5, m15, h1, h4, d1 } 객체 (단일 배열 X)
  - V3BuildMarketCtx     { market, exchange?, base?, quote?, displayName?,
                           ts?, timeframe?, coinMeta?, newsContext?,
                           riskOverride?, indicatorConfig? }
출력:
  - V3FeaturePayload (13 top-level field, isValid 통과)
  - 실패 시 throw 없이 safe payload + raw.builderDebug.warnings 기록
```

### 적용 정책 (DP)

```text
DP-1 ts:          marketCtx.ts > primary candle.ts > null  (Date.now 금지)
DP-2 tradeValue:  canonical 'tradeValue' 만 외부 노출 (alias 금지)
DP-3 배치:        별도 파일 신규 (v3-feature-payload.js build 함수 throw 유지)
DP-4 validator:   현행 유지 (builder가 createEmpty 기반 시작)
DP-5 identity:    normalizeIdentity helper ('KRW-BTC' → quote/base 분해)
DP-6 marketCtx:   V3BuildMarketCtx typedef + 안전 정규화
DP-7 raw:         raw.builderDebug 디버그 보조 구조
U-2  candles:     V3BuildCandlesInput typedef (5 timeframe 객체)
```

### indicator snapshot 분리 매핑

```text
WS3Indicators.buildIndicatorSnapshot() 반환:
  { valid, indicators, warnings, debug }

매핑:
  payload.momentum   ← rsi / mfi / obv / ma
  payload.volume     ← volume / volumeAcceleration / tradeValue
  payload.structure  ← candleShape / candleStructure / structure
  payload.indicators ← atr / snapshotValid / warnings / debug / indicatorVersion
```

### export

```text
global.WS3_FeaturePayload_Builder = Object.freeze({
  BUILDER_VERSION, DEFAULT_PRIMARY_TIMEFRAME, TIMEFRAMES,
  build, normalizeIdentity, normalizeCandlesInput, resolveTs, mapIndicatorSnapshot
})

이중 환경: global + module.exports (v3-indicators.js 와 동일 패턴)
```

자세한 내용은 `WS3_v0_2_0_c_r1_BUILD_REPORT.md` 참고.

---

## 보호 파일 (수정 금지)

```text
index.html
manifest.json
service-worker.js
worker.js
wrangler.toml

/v3/v3-config.js
/v3/v3-feature-payload.js                   ← 핵심 보호 (코드 계약). build 함수 throw 유지.
/v3/v3-bithumb-client.js                    ← market 문자열만 fetch 인자로 사용
/v3/v3-candle-normalizer.js                 ← tradeValue = close * volume 산출
/v3/v3-indicators.js                        ← v0.2.0-b 박제본
/v3/v3-feature-payload-builder.js           ← v0.2.0-c-r1 박제본
/v3/v3-score-breakdown.js                   ← v0.3.0 박제본
/v3/v3-structure-bucket.js                  ← v0.4.0 박제본
/v3/v3-signal-cycle.js                      ← v0.5.0 박제본
/v3/v3-strategy-plan.js                     ← v0.6.0 박제본
/v3/v3-card-view-model.js                   ← v0.7.0 박제본
/v3/v3-operation-packet.js                  ← v0.8.0 박제본
/v3/v3-active-cycle.js                      ← v0.9.0 박제본
/v3/v3-evaluation-outcome.js                ← v0.10.0 박제본
/v3/v3-evaluation-observation-adapter.js    ← v0.11.0 박제본 (입력 adapter)
/v3/v3-external-confluence.js               ← v0.11.0 박제본 (보조 context)
/v3/v3-transport-plan.js                    ← v0.12.0 박제본 (출력 dry-run plan)
/v3/v3-renderer-binding.js                  ← v0.12.0 박제본 (UI binding)
/v3/v3-transport-execution-adapter.js       ← v0.13.0 박제본 (dry-run safe envelope)
/v3/v3-secure-transport-executor-contract.js ← v0.14.0 박제본 (CONTRACT_ONLY secure executor contract)
/v3/v3-transport-executor-harness.js        ← v0.15.0 박제본 (이번 단계 신규, DRY_RUN_HARNESS transport executor harness)
/v3/v3-index.html                           (생성도 X)
```

> 다음 단계 (v0.15.x / v0.16.x — 실제 transport executor / renderer / persistence) 진입 후 builder/score/structure/cycle/plan/viewmodel/operationPacket/activeCycle/evaluationOutcome/observationAdapter/externalConfluence/transportPlan/rendererBinding/transportExecutionAdapter/secureTransportExecutorContract/transportExecutorHarness 인자 / 매핑 정책 갱신이 필요해지면 별도 r1.x 단계로 분리하여 별도 승인 후에만 수정.

---

## 모듈 의존성

```text
v3-bithumb-client.js  (o.market 문자열 fetch — proxy worker 경유)
  ↓ (raw candles)
v3-candle-normalizer.js  (tradeValue = close * volume, canonical {ts,open,high,low,close,volume,tradeValue})
  ↓ (normalized candles, timeframe별 배열)
v3-indicators.js  (v0.2.0-b 박제 — buildIndicatorSnapshot)
  ↓ (indicator snapshot)
v3-feature-payload-builder.js  (v0.2.0-c-r1 박제 — V3FeaturePayload 13 top-level field 조립)
  ↓ (V3FeaturePayload, isValid 통과)
v3-score-breakdown.js  (v0.3.0 박제 — 5 component + riskPenalty → totalScore)
  ↓ (standalone scoreBreakdown 객체, payload mutate 0건)
v3-structure-bucket.js  (v0.4.0 박제 — 13 structureBucket + confidence 0~100)
  ↓ (standalone structureDecision 객체, payload·scoreBreakdown mutate 0건)
v3-signal-cycle.js  (v0.5.0 박제 — 8 cycleState + 5 cyclePhase + 7 bucketFamily + cooldown/EXPIRED)
  ↓ (standalone signalCycle 객체, 모든 입력 mutate 0건)
v3-strategy-plan.js  (v0.6.0 박제 — 10 strategyBias + 4축 분류 + entryPlan/exitPlan/riskControls)
  ↓ (standalone strategyPlan 객체, 4종 입력 mutate 0건)
v3-card-view-model.js  (v0.7.0 박제 — identity/header/chips/metrics/sections/displayFlags/tone)
  ↓ (standalone cardViewModel 객체, 5종 입력 mutate 0건, UI-ready, 비-렌더)
v3-operation-packet.js  (v0.8.0 박제 — routing/notificationPacket/snapshotPacket/evaluationSeed/displaySummary)
  ↓ (standalone operationPacket 객체, 6종 입력 mutate 0건, transport-ready, side-effect free)
v3-active-cycle.js  (v0.9.0 박제 — lifecycle/transition/routingDecision/notifyPolicy/snapshotPolicy/evaluationPolicy/nextState)
  ↓ (standalone activeCycleDecision 객체, 2종 입력 mutate 0건, lifecycle decision data, side-effect free)
v3-evaluation-outcome.js  (v0.10.0 박제 — evaluation/priceBasis/movement/targetCheck/invalidationCheck/pathOrder/quality/routingDecision/nextEvaluationState)
  ↓ (standalone evaluationOutcome 객체, 4종 입력 mutate 0건, result classifier data, side-effect free)
v3-evaluation-observation-adapter.js  (v0.11.0 박제 — 외부 관측 요약 → v0.10.0 evaluationObservation 호환)
v3-external-confluence.js  (v0.11.0 박제 — 보조 context: market/sector/exchange/schedule/news/confluenceScore)
  ↓ (standalone adapter outputs, 입력 mutate 0건, side-effect free, v0.10.0 호환)
v3-transport-plan.js  (v0.12.0 박제 — dry-run plan: telegramPlan/snapshotPlan/evaluationPlan/auditPlan)
  ↓ (standalone TransportPlan 객체, 5종 입력 mutate 0건, side-effect free, dry-run only)
v3-renderer-binding.js  (v0.12.0 박제 — UI binding: header/chips/metrics/sections/flags + displayMode)
  ↓ (standalone RendererBinding 객체, 입력 mutate 0건, DOM-free, cardViewModel superset)
v3-transport-execution-adapter.js  (v0.13.0 박제 — dry-run safe envelope: telegramEnvelope/snapshotEnvelope/evaluationEnvelope/auditEnvelope)
  ↓ (standalone TransportExecutionEnvelope 객체, 6종 입력 mutate 0건, side-effect free, dryRun=true 강제, credential recursive 차단, whitelist scalar only)
v3-secure-transport-executor-contract.js  (v0.14.0 박제 — CONTRACT_ONLY secure executor contract: telegramContract/snapshotContract/evaluationContract/auditContract)
  ↓ (standalone SecureTransportExecutorContract 객체, 7종 입력 mutate 0건, side-effect free, contractMode='CONTRACT_ONLY' 강제, liveExecutionAllowed=false 강제, credential recursive + env-like + depth + bindingRef 검증, bindingRef logical reference only, v0.13 envelope 재검증, secureBindingPolicy 박제, v0.15+ real executor 와 credential 비전달 보장)
v3-transport-executor-harness.js  (v0.15.0 박제 — DRY_RUN_HARNESS: telegramHarness/snapshotHarness/evaluationHarness/auditHarness + rateLimitContract + circuitBreakerContract + dryRunResult)
  ↓ (standalone TransportExecutorHarness 객체, 8종 입력 mutate 0건, side-effect free, harnessMode='DRY_RUN_HARNESS' 강제, 5 boolean hard block (liveExecution/sideEffect/fetch/write/credentialLookup), perTargetGate.allow=false 강제, dryRunResult.wouldExecute=false 강제, circuitBreaker.state='OPEN_IN_DRY_RUN' 강제, v0.14 contract.requestShape 재검증, v0.16+ real executor 와 credential 비전달 보장)
[v0.15.x / v0.16.x — 실제 transport executor / renderer / persistence 분리 단계]
```

---

## 해소된 DECISION_PENDING (c-r1 단계 종료 시점)

| ID | 결정 | 적용 |
|---|---|---|
| **DP-1** | explicit ts > primary candle.ts > null. Date.now 금지 | `resolveTs()` |
| **DP-2** | canonical tradeValue만, alias 외부 노출 금지 | 매핑 전체 |
| **DP-3** | DP-3-A: 별도 파일 신규. v3-feature-payload.js build throw 유지 | `v3-feature-payload-builder.js` |
| **DP-4** | validator 현행 유지. builder가 createEmpty 기반 13 key 보장 | `buildFeaturePayload()` step 1 |
| **DP-5** | normalizeIdentity helper. 'KRW-BTC' → quote/base 분해 | `normalizeIdentity()` |
| **DP-6** | V3BuildMarketCtx typedef + 안전 정규화 | typedef + 전반 |
| **DP-7** | raw.builderDebug 디버그 보조 구조 도입 | builderDebug 객체 |
| **U-1** | indicators 내부 통계 키 (currentTradeValueKrw 등) v3-indicators 결과 그대로 보존 — quote-agnostic 리네이밍은 v0.3 이후 별도 검토 | 참고 사항 |
| **U-2** | V3BuildCandlesInput typedef. 5 timeframe 객체 입력. 단일 배열 X | `normalizeCandlesInput()` |

> WS3_CODE_CONTRACT.md (b-r2 박제본) §8 의 DP-1/2/3 + c-r1 신규 DP-4/5/6/7 모두 해소.
> CODE_CONTRACT 본문은 c-r1 단계에서 수정하지 않음. r2.1 박제 검토는 별도 단계.

---

## 다음 단계 (확정된 순서)

```text
(별도) v0.15.x — 실제 transport executor (SecureTransportExecutorContract 출력을 받아 실제 Telegram bot API / KV write / reviewQueue write)
                  bindingRef → secure binding lookup (Cloudflare env / KMS / secret store) — v0.14.0 contract 에는 credential value 0 포함
                  LIVE_EXECUTION explicit gate 별도 정의
(별도) v0.12.x renderer — DOM/HTML attach (RendererBinding 출력을 받아 렌더)
(별도) v0.11.x — 실제 외부 데이터 수집 adapter (EvaluationObservationAdapter 출력을 받아 실제 fetch)
(별도) v0.10.x evaluation adapter — 실제 24h/7d 캔들 fetch + outcome 영속화
(별도) v0.9.x transport adapter — 실제 외부 전송 / KV 저장
(별도) v0.8.x transport — OperationPacket 실제 전송
(별도) v0.7.x renderer — DOM / HTML 렌더
```

---

## v0.15.0 핵심 메모

```text
- v3/v3-transport-executor-harness.js 신규 (1603 라인)
- 보호 파일 25종 모두 무손상 (v3 *.js 20종 + index/manifest/sw 3종 + CODE_CONTRACT + WORKFLOW_TEMPLATE)
- DP-HARNESS1 ~ DP-HARNESS10 + N-HARNESS-OBS-1 ~ N-HARNESS-OBS-6 모두 적용 / 미해결 항목 0건
- harnessStatus 6 후보 first-match-wins (INVALID > BLOCKED > PARTIAL > READY > SKIPPED > UNKNOWN)
- 4 target harness: telegram / snapshot / evaluation / audit (각 9-stage AND ready)
- harnessMode='DRY_RUN_HARNESS' 강제, liveExecutionAllowed=false 강제
- 5 boolean hard block: liveExecution / sideEffect / fetch / write / credentialLookup
- perTargetGate.allow 항상 false 강제 (DP-HARNESS5)
- rateLimitContract per-target key 자동 + per-target override (per-target > top-level > default)
- circuitBreakerContract.state='OPEN_IN_DRY_RUN' 강제
- dryRunResult.wouldExecute=false 강제, resultType=DRY_RUN_ONLY, action enum target 매핑
- credential 9키 재귀 차단 + RESERVED 프레임워크 metadata 18종 자동 차단 제외 (`directSecretAccessAllowed` 등 v0.14 자체 metadata 포함, N-HARNESS-OBS-4 확장)
- env-like 11키 exact match + value object 조건 차단 (r0.2 §6.2 false-positive 완화)
- bindingRef logical reference only — IIFE 내부 private 재정의 (N-HARNESS-OBS-5)
- payloadSummary 14 whitelist scalar + metadata 기본 빈 배열, v0.14 contract 재검증
- Object.assign / spread / JSON.parse(JSON.stringify) / for-in 코드 0건
- sanitizeMode='REJECT' 기본 (15 금지 어휘 exact phrase substring match)
- CREDENTIAL_IN_LINE_REJECTED 추가 (line 내 credential pattern 차단)
- r0.1 폐기 naming residue 0건 (RealTransportExecutor* / *Execution / EXECUTOR_* / classifyExecutorStatus)
- smoke test 30 시나리오 / 95 assertion 전부 PASS
- 입력 mutation 0건 (DP-HARNESS9, S26 frozen-input 검증)
- fetch / Telegram 실호출 / KV / DB / DOM / storage / clock API / process.env / globalThis 코드 0건
- v0.16+ real executor 와 credential 인계 0건 (bindingRef logical + harnessPolicy 만 인계)
```

## v0.14.0 핵심 메모

```text
- v3/v3-secure-transport-executor-contract.js 신규 (1595 라인)
- 보호 파일 24종 모두 무손상 (v3 *.js 19종 + index/manifest/sw 3종 + CODE_CONTRACT + WORKFLOW_TEMPLATE)
- DP-SEC1 ~ DP-SEC10 + N-SEC-OBS-1 ~ N-SEC-OBS-4 모두 적용 / 미해결 항목 0건
- contractMode='CONTRACT_ONLY' 강제, liveExecutionAllowed=false 강제 (LIVE/REAL/EXECUTE → CONTRACT_BLOCKED)
- contractStatus 6 후보 first-match-wins: CONTRACT_INVALID > BLOCKED > PARTIAL > READY > SKIPPED > UNKNOWN
- 4 target contract (5-stage AND ready): telegram / snapshot / evaluation / audit
- credential 9키 재귀 차단 (case-insensitive + partial + depth 5 + scalar leaf 안전)
- RESERVED 프레임워크 metadata 16종 자동 차단 제외 (N-SEC-OBS-4 — credentialMaxDepth / credentialAllowList / allowWebhookUrl / bindingRefAllowList 등)
- env-like 11키 exact match + value object 차단 (r0.2 §6.2 false-positive 완화)
- validateBindingRef: ^[A-Z][A-Z0-9_]*$ + 13 금지 substring (http/https/sk-/xoxb-/eyJ 등) + bot[0-9]+ + digit-only + credential partial match + bindingRefAllowList 기본 []
- payloadSummary 14 whitelist scalar only + metadata 기본 빈 배열
- v0.13 envelope 재검증 (payloadSummary / metadata 그대로 신뢰 X)
- secureBindingPolicy 박제 (credentialSource='SECURE_BINDING_ONLY', envReadAllowed=false, liveExecutionRequiresExplicitGate=true)
- Object.assign / spread / JSON.parse(JSON.stringify) / for-in 코드 0건
- sanitizeMode='REJECT' 기본 (15 금지 어휘 line 제거)
- smoke test 26 시나리오 / 82 assertion 전부 PASS
- 입력 mutation 0건 (DP-SEC9, S24 frozen-input 검증)
- fetch / Telegram 실호출 / KV / DB / DOM / storage / clock API / process.env / globalThis / chatId / botToken / apiKey 코드 0건
- v0.15+ real executor 와 credential 인계 0건 (bindingRef logical reference + requestShape scalar 만 인계)
```

## v0.13.0 핵심 메모

```text
- v3/v3-transport-execution-adapter.js 신규 (~1400 라인)
- 보호 파일 23종 모두 무손상 (v3 *.js 18종 + index/manifest/sw 3종 + CODE_CONTRACT + WORKFLOW_TEMPLATE)
- DP-TX1 ~ DP-TX10 + U-TX-1 + U-TX-2 + N-TX-OBS-1 + N-TX-OBS-2 모두 적용 / 미해결 항목 0건
- U-TX-1: cfg.safety.credentialAllowList 기본 빈 배열. partial match 안전 우선 차단
- U-TX-2: cfg.wording.sanitizeMode='REJECT' 기본. REJECT/REPLACE/WARN_ONLY 3 모드
- N-TX-OBS-1: dryRunOnly namespace 중복 (기존 wording vs v0.13.0 top-level/envelope) — namespace 분리로 구조적 충돌 없음
- N-TX-OBS-2: 보호 baseline false-positive — 본 모듈 fetch/Date.now/spread/Object.assign 0건
- TransportExecutionAdapter:
  - 입력 6종 (transportPlan + rendererBinding + operationPacket + activeCycleDecision + evaluationOutcome + externalConfluence) read-only
  - 출력: TransportExecutionEnvelope (dry-run safe envelope)
  - envelopeMode='DRY_RUN' 강제 (LIVE/REAL/SEND → BLOCKED)
  - envelopeStatus 6 후보 first-match-wins: ENVELOPE_INVALID > BLOCKED > PARTIAL > READY > SKIPPED > UNKNOWN
  - 4 envelope: telegramEnvelope / snapshotEnvelope / evaluationEnvelope / auditEnvelope
  - eligible 3-stage AND (plan boolean && cfg.execution.allow* && envelopeMode==='DRY_RUN')
  - DP-TX2 — TransportPlan false 결정 절대 true override 안 함 (S18 검증)
- credential 차단 (DP-TX4):
  - 9 금지 키: secret/token/chatid/bottoken/apikey/authorization/password/credential/webhookurl
  - case-insensitive + partial match + depth limit 5
  - cfg.safety.credentialAllowList 로 차단 제외 가능 (기본 빈 배열)
  - 발견 시 모든 envelope BLOCKED + warnings SECRET_FIELD_BLOCKED:<path>
  - path 에는 key 이름 + 위치만, value 절대 노출 0건 (S6/S7/S8/S9/S15/S21 검증)
- payloadSummary (DP-TX5):
  - 14 whitelist scalar only (candidateKey/base/quote/market/exchange/timeframe/messageType/snapshotType/evaluationType/resultType/auditType/displayMode/confluenceLabel/confluenceScore)
  - Object.assign / spread / JSON.parse(JSON.stringify) / for-in 코드 0건
  - metadata 기본 {}, metadataAllowedFields 기본 빈 배열
- sanitizeMessageLines (DP-TX6 / U-TX-2):
  - 15 금지 어휘: 발송됨/저장됨/전송 완료/sent/delivered/completed transmission/매수 성공/손절/익절/수익 확정/손실 확정/buy now/sell now/take profit/stop loss
  - REJECT 기본 — line 제거 + warning FORBIDDEN_WORD_LINE_REJECTED
  - REPLACE — safe wording 치환 (예: '발송됨' → '발송 후보')
  - WARN_ONLY — line 유지 + warning (운영 사용 금지 권장)
- smoke test 21 시나리오 / 59 assertion 전부 PASS
- 입력 mutation 0건 (DP-TX8, S19 frozen-input 검증)
- fetch / Telegram 실호출 / KV / DB / DOM / storage / clock API / chatId / botToken / apiKey 코드 0건
- v0.14.0+ real executor 와 credential 인계 0건 (envelope 만 인계 보장)
```

## v0.12.0 핵심 메모

```text
- v3/v3-transport-plan.js 신규 (740 라인)
- v3/v3-renderer-binding.js 신규 (834 라인)
- 보호 파일 21종 모두 무손상 (v3 *.js 16종 + index/manifest/sw 3종 + CODE_CONTRACT + WORKFLOW_TEMPLATE)
- DP-APO1 ~ DP-APO10 모두 적용 / 미해결 항목 0건
- U-APO-1 Option B: sections.{strategy/lifecycle/evaluation/confluence/transport} 5종 모두 array
- U-APO-2 Option A: displayMode 7 후보 (BLOCKED→COOLDOWN→CLOSED→REVIEW→ALERT→DEFAULT→UNKNOWN) 우선순위
- U-APO-3 Option C: flags namespace 분리 (flags.binding + flags.card 10 boolean 보존)
- N-APO-OBS-1: auditPlan = reviewQueue 후보만. 실제 reviewQueue write 0건
- N-APO-OBS-2: dry-run 어휘 강제 (DP-APO10) — '전송 완료/sent/delivered' 0건
- TransportPlan:
  - telegramPlan.shouldSend = 4단계 AND (op.shouldNotify && ac.allowNotify && !ac.suppressNotify && ac.canNotify)
  - snapshotPlan.shouldStore = 3단계 AND (signal snapshot timing — outcome timing 제외, DP-APO4)
  - evaluationPlan.shouldStore = 4단계 AND (outcome.shouldStoreOutcome 포함)
  - auditPlan 7 후보 우선순위: ROUTING_CONFLICT > DATA_AMBIGUOUS > DATA_INSUFFICIENT > REVIEW_REQUIRED > SUPPRESSED_NOTIFY > WARNING_PRESENT > NONE
  - warningAuditMode = 'critical' default (7 critical warning 만)
  - detectRoutingConflict() 분리 — NOTIFY/SNAPSHOT/EVALUATION 각각 별도 reason
- RendererBinding:
  - cardViewModel superset (header/chips/metrics) — mutation 없이 적층
  - sections 5종 array, displayMode 7 후보 first-match-wins
  - flags.binding (RendererBinding 신규) + flags.card (cardViewModel.displayFlags verbatim 10 boolean)
- smoke test 22 시나리오 (20 핵심 + 2 Extra) 통과
- 입력 mutation 0건 (DP-APO8, S19 검증)
- fetch / Telegram 실호출 / KV / DB / DOM / storage / clock API / chatId / botToken / apiKey 코드 0건
- '발송됨 / 저장됨 / 전송 완료 / sent / delivered / completed transmission' 코드 0건 (dry-run 어휘 강제)
- 매수 권고 / 매도 권고 / 손절 / 익절 / 수익 확정 / take profit / stop loss 코드 0건
```

## v0.11.0 핵심 메모

```text
- v3/v3-evaluation-observation-adapter.js 신규 (497 라인)
- v3/v3-external-confluence.js 신규 (736 라인)
- 보호 파일 19종 모두 무손상 (v3 *.js 14종 + index/manifest/sw 3종 + CODE_CONTRACT + WORKFLOW_TEMPLATE)
- DP-ACP1 ~ DP-ACP10 모두 적용 / 미해결 항목 0건
- U-ACP-1 Option A: source='adapter-normalized' + reasons['ADAPTER_NORMALIZED']
- U-ACP-2: confluenceScore number|null, 기본 null, -100~100 범위, enableScore 기본 false
- N-ACP-OBS-1: payload.newsContext 직접 read 0건 (input.newsContext 만 처리)
- N-ACP-OBS-2: v0.2.0-a baseline 보호 파일 책임 분리
- EvaluationObservationAdapter:
  - field mapping 13종, v0.10.0 buildEvaluationOutcome 호환 보장 (S11 검증)
  - raw candles / API response 출력 0건 (S4 검증)
- ExternalConfluence:
  - 5종 sub-context 정규화 (market/sector/exchange/schedule/news)
  - 6 confluenceLabel 후보 (UNKNOWN/FAVORABLE/NEUTRAL/ADVERSE/MIXED)
  - confluenceScore 기본 null. enableScore=true 시 contribution 합산 후 clamp
  - scoreBreakdown/strategyPlan 판단 대체 0건 (S7 검증)
- v0.12.0 분리 항목 (TransportPlan/RendererBinding/AdapterContractPack) 미생성
- smoke test 15 시나리오 (12 핵심 + 3 Extra) 통과
- 입력 mutation 0건 (DP-ACP8, S10 검증)
- fetch / KV / DB / Telegram / DOM / storage / clock 코드 침범 0건
- 매매 권고 / secret / token / chatId / botToken / apiKey 코드 0건

## v0.10.0 핵심 메모 (이전 단계)

```text
- v3/v3-evaluation-outcome.js 신규 생성 1건 (1407 라인)
- 보호 파일 18종 모두 무손상 (v3 *.js 13종 + index/manifest/sw 3종 + CODE_CONTRACT + WORKFLOW_TEMPLATE)
- WS3_CODE_CONTRACT.md 미수정 (b-r2 박제본 그대로)
- WS3_WORKFLOW_TEMPLATE.md 미수정 (v0.1 박제본 그대로)
- DP-EO1 ~ DP-EO14 모두 적용 / 미해결 항목 0건
- 입력 4종 (operationPacket + activeCycleDecision + evaluationObservation + previousEvaluationState) mutation 0건 (DP-EO1, smoke 검증)
- status 6 후보 (UNKNOWN/PENDING/IN_PROGRESS/COMPLETED/CLOSED/INVALID) - DP-EO11
- resultType 11 후보 — 매수 성공/손절/익절/수익 확정 어휘 0건 (DP-EO9)
- resultPhase 6 후보 / outcomeQuality 4 후보
- movement 누적 (DP-EO14): max(prev.maxFav, cur.highMove) / min(prev.maxAdv, cur.lowMove). S14 검증
- baselinePrice 2-step fallback (DP-EO5): evaluationSeed → observation → DATA_INSUFFICIENT
- target source: targetHints[0] → safeHints TARGET → cfg.planTargetPct (priority chain first-match-wins)
- invalidation source: type='INVALIDATION' 우선 → 'SETUP_INVALIDATION' → safeHints INVALIDATION → cfg.invalidationPct (U-EO-2)
- unit 분리 (DP-EO6 + U-EO-1): hint.unit 부재 → default 'price'. pct 는 unit==='pct' 또는 cfg fallback. UNIT_AMBIGUOUS 검사 (0<v<1 + baseline≥10)
- path order (U-EO-3): DATA_AMBIGUOUS 는 pathOrderKnown !== true 일 때만. true 면 firstEvent 로 TARGET_HIT/INVALIDATED 분기. S11/S12/S13 검증
- nextEvaluationState 산출 only (DP-EO10). 실제 저장 0건
- 런타임 clock API (Date.now/new Date/performance.now) 0건
- 외부 호출 (fetch/XMLHttpRequest) 0건
- raw candles / payload.raw / identityInput / secret/token/chatId/botToken/apiKey 0건
- 매매 권고 / 매수·매도 어조 / 수익·손실 확정 코드 0건
- frozen input 안전성 검증 (Extra-F)

## v0.9.0 핵심 메모 (이전 단계)

```text
- v3/v3-active-cycle.js 신규 생성 1건 (1279 라인)
- 보호 파일 17종 모두 무손상 (v3 *.js 12종 + index/manifest/sw 3종 + CODE_CONTRACT + WORKFLOW_TEMPLATE)
- WS3_CODE_CONTRACT.md 미수정 (b-r2 박제본 그대로)
- WS3_WORKFLOW_TEMPLATE.md 미수정 (v0.1 박제본 그대로)
- DP-AC1 ~ DP-AC14 모두 적용 / 미해결 항목 0건
- 입력 2종 (operationPacket + previousOperationState) mutation 0건 (DP-AC1, smoke 검증)
- lifecycleState 8 후보 (NONE/NEW/ACTIVE/PERSISTING/STRENGTHENING/WEAKENING/COOLDOWN/EXPIRED). DUPLICATE/SUPPRESSED 0건 (DP-AC12)
- lifecyclePhase 7 후보 (NONE/NEW/EARLY/ACTIVE/MATURE/LATE/CLOSED) (DP-AC13)
- transition 11 후보 (NONE/NEW_CANDIDATE/SAME_CANDIDATE/CANDIDATE_CHANGED/STATE_CHANGED/STRENGTHENED/WEAKENED/COOLDOWN_ENTERED/COOLDOWN_CONTINUED/EXPIRED/DUPLICATE_SUPPRESSED)
- candidateKey verbatim 복사 (DP-AC4)
- timestamp 기준: snapshotPacket.timestamp → evaluationSeed.startTs → null (DP-AC5)
- signalCooldown vs notifyCooldown 분리 (DP-AC14, Extra-C smoke 검증)
- state strength max() (DP-AC9 / U-AC-1, Extra-A 검증). 합산/평균 0건
- U-AC-1 Option A: snapshotPacket.state.cycleState / cycle.cycleState ranking source 추가. STRENGTHENING(70) / WEAKENING(-10) 활성화
- U-AC-2 Option A: previous null = base zero state. 첫 관측 seenCount=1
- U-AC-3: Gate 2 spec top-level 15-field shape 그대로
- N-AC-OBS-1: isActiveCycleState 회피 → isActiveLifecycleState 사용
- N-AC-OBS-2: 보호 파일 책임. 본 모듈 Date.now / new Date / performance.now / fetch 코드 0건
- 외부 호출 / DOM / 브라우저 storage / KV / persistence 0건
- 런타임 clock API 사용 0건
- 실거래 / 주문 / 알림 / 렌더 / 등급 코드 / secret 0건
- frozen input 안전성 검증 (Extra-D)

## v0.8.0 핵심 메모 (이전 단계)

```text
- v3/v3-operation-packet.js 신규 생성 1건
- 보호 파일 16종 모두 무손상 (v3 *.js 11종 + index/manifest/sw 3종 + CODE_CONTRACT + WORKFLOW_TEMPLATE)
- WS3_CODE_CONTRACT.md 미수정 (b-r2 박제본 그대로)
- WS3_WORKFLOW_TEMPLATE.md 미수정 (v0.1 박제본 그대로)
- DP-OP1 ~ DP-OP12 모두 적용 / 미해결 항목 0건
- 6종 입력 (payload / scoreBreakdown / structureDecision / signalCycle / strategyPlan / cardViewModel) mutation 모두 0건 (DP-OP1, smoke 검증)
- DP-OP3 출력 7대 영역 (identity / candidateKey / routing / notificationPacket / snapshotPacket / evaluationSeed / displaySummary)
- DP-OP4 shouldNotify 기본 false (enableNotificationCandidate=false default, Extra-C 검증)
- DP-OP5/6 shouldSnapshot/shouldEvaluate 기본 true (config enable). invalid/NONE 시 false
- DP-OP8 baselinePrice numeric only fallback chain (referencePrice → entryZone numeric → last close → null. Extra-A 검증)
- DP-OP9 safeHints 안전 라벨 4종만 (REFERENCE_ZONE / INVALIDATION_LEVEL / TARGET_HINT / RISK_REWARD_HINT)
- DP-OP10 raw payload / identityInput / candle raw array 직접 노출 0건. primaryTimeframe scalar read 만 허용
- DP-OP11 등급 코드 산출 0건
- DP-OP12 candidateKey 재계산 0건 (signalCycle.candidateKey 그대로 복사. S1 검증)
- U-OP-1 Option A: 6-field field-by-field fallback (Extra-B 검증)
- U-OP-2 Option A: payload.ts only (Extra-D 검증)
- U-OP-3: persistence && persistence.isSameCandidate === false defensive check (S7 검증)
- notificationType 6 후보 (NONE / WATCH / READY / BLOCKED / COOLDOWN / EXPIRED)
- snapshotType 6 후보 (NONE / CANDIDATE / STATE_CHANGE / COOLDOWN / EXPIRED / DEBUG)
- evaluationType 5 후보 (NONE / WATCH_24H / PLAN_24H / COOLDOWN_REVIEW / EXPIRED_REVIEW)
- notificationChannel 2 후보 (NONE / TELEGRAM_CANDIDATE)
- snapshotBucket 4 후보 (NONE / CANDIDATE_SNAPSHOT / STATE_SNAPSHOT / DEBUG_SNAPSHOT)
- evaluationWindow 3 후보 (NONE / 24H / 7D)
- severity 5 후보 (none / info / notice / warning / critical)
- 외부 전송 / 영속 저장 / network fetch / DOM / storage / clock API / bot secret / chatId / apiKey 0건
- 실거래 / 주문 / 알림 / 렌더 / 외부 신호 / 등급 코드 0건
- frozen input 안전성 검증 (Extra-E)

## v0.7.0 핵심 메모 (이전 단계, hotfix 반영)

```text
- v3/v3-card-view-model.js 신규 생성 1건 (hotfix 반영본)
- 보호 파일 15종 모두 무손상 (v3 *.js 10종 + index/manifest/sw 3종 + CODE_CONTRACT + WORKFLOW_TEMPLATE)
- WS3_CODE_CONTRACT.md 미수정 (b-r2 박제본 그대로)
- WS3_WORKFLOW_TEMPLATE.md 미수정 (v0.1 박제본 그대로)
- DP-UI1 ~ DP-UI11 r0.2-final 매핑 모두 적용 / 미해결 항목 0건
- 5종 입력 (payload / scoreBreakdown / structureDecision / signalCycle / strategyPlan) mutation 모두 0건 (DP-UI1, smoke 6 시나리오 검증)
- DP-UI3 출력 7대 영역 (identity / header / chips / metrics / sections / displayFlags / tone)
- DP-UI4 metrics 는 array (S1~S8 smoke 검증)
- DP-UI5 라벨은 labelKey + labelKo + labelEn (badge/chip/metric 동일, smoke 검증)
- DP-UI6 tone semantic token 8종만 (positive/neutral/caution/warning/muted/info/critical/unknown). 색상 코드 0건
- DP-UI7 displayFlags 정확히 10 boolean (isReady/isBlocked/isCooldown/isExpired/isWeakening/isHighActionability/showEntryPlan/showExitPlan/showRiskWarning/showDebug)
- DP-UI8 debug 기본 숨김. allowedFields 기본 빈 배열. identityInput / candles / rawCandles / candleArrays / raw / builderDebug 영구 차단 (BLOCKED_FIELDS, Extra-B smoke 검증)
- DP-UI9 sections 7개 (overview / score / structure / cycle / strategy / risk / debug)
- DP-UI10 P-S / P-A / P-B 최종 알림 등급 표시 0건
- DP-UI11 numeric hint 는 sections.strategy / sections.risk 만 (S7 smoke 검증)
- header.primaryBadge 는 strategyBias 우선 (S5 cooldown smoke 검증)
- 8개 라벨 사전 (STRATEGY_BIAS/CYCLE_STATE/CYCLE_PHASE/ACTIONABILITY/PLAN_QUALITY/STRUCTURE_BUCKET/PRICE_ZONE/RISK_LEVEL)
- 명령 어조 / 구버전 라벨 (buySignal/stopLossHint/takeProfitHint/planGradeHint/매수하세요/매도하세요) 잔존 0건
- 외부 호출 / DOM / 브라우저 storage / KV / network fetch 0건
- 런타임 clock API 사용 0건
- 실거래 / 주문 / 알림 / 렌더 / 외부 신호 0건
- frozen input 안전성 검증 (Extra-E)
- N-UI-OBS-3 정정: identityInput 영구 차단 (whitelist 와 무관, Extra-B 검증)

## v0.6.0 핵심 메모 (이전 단계)

```text
- v3/v3-strategy-plan.js 신규 생성 1건 (commit 8ebba40)
- 보호 파일 14종 모두 무손상 (v3 *.js 9종 + index/manifest/sw 3종 + CODE_CONTRACT + WORKFLOW_TEMPLATE)
- WS3_CODE_CONTRACT.md 미수정 (b-r2 박제본 그대로)
- WS3_WORKFLOW_TEMPLATE.md 미수정 (v0.1 박제본 그대로)
- DP-STRAT1 ~ DP-STRAT11 + U-STRAT-1 Option B 모두 적용 / 미해결 항목 0건
- payload / scoreBreakdown / structureDecision / signalCycle mutation 모두 0건 (DP-STRAT1, smoke 12 시나리오 검증)
- 4축 분류: 10 strategyBias + 7 planType + 5 actionability + 7 planQualityTier (독립 산출)
- entryPlan/exitPlan/riskControls 후보 산출 (실제 주문 지시 아님)
- U-STRAT-1 Option B: 'TOP_NEAR' (priceZone.zone) / 'ABOVE_BOX_CONFIRMED_CANDIDATE' (structureBucket) 매핑 적용
- ABOVE_BOX 추격 default false (cfg.risk.allowChaseAboveBox)
- 구버전 손절·익절 라벨 잔존 0건 (invalidationHint/targetHint 표준화)
- 등급 코드 산출 0건 (planQualityTier는 backtest 통계용)
- 외부 호출 / DOM / 브라우저 storage / KV 0건
- 런타임 clock API 사용 0건
- 실거래 / 주문 / 알림 / UI / 외부 신호 0건

## v0.5.0 핵심 메모 (이전 단계)

```text
- v3/v3-signal-cycle.js 신규 생성 1건
- 보호 파일 13종 모두 무손상 (v3 *.js 8종 + index/manifest/sw 3종 + CODE_CONTRACT + WORKFLOW_TEMPLATE)
- WS3_CODE_CONTRACT.md 미수정 (b-r2 박제본 그대로)
- WS3_WORKFLOW_TEMPLATE.md 미수정 (v0.1 박제본 그대로)
- DP-CYC1 ~ DP-CYC11 + U-CYC-1 Option A 모두 적용 / 미해결 항목 0건
- payload / scoreBreakdown / structureDecision / previousSignalState mutation 모두 0건 (DP-CYC1, smoke 검증)
- 8 cycleState + 5 cyclePhase + 7 bucketFamily 분류
- candidateKey = exchange:market:timeframe:bucketFamily (DP-CYC3)
- previousSignalState Case A full / Case B minimal 두 형식만 허용 (DP-CYC2)
- 저장소 read/write 0건 (KV / 브라우저 storage / DB / snapshot)
- ready threshold 임시: minConfidence=40, minTotalScore=30 (DP-CYC8, backtest 후 조정)
- strengthen/weaken delta ±5/±10 OR 조건. mixedDelta → PERSISTING + warning (DP-CYC9)
- cooldown bars 3, maxAgeBars 20 (임시, backtest 후 조정)
- EXPIRED 1-turn 전환 (DP-CYC11)
- currentTs: payload.ts → primary candle.ts → null (U-CYC-1 Option A)
- 런타임 clock API 사용 0건 (DP-CYC10)
- grade / strategyBias / entryPlan / exitPlan 미산출
- 외부 호출 / DOM / 브라우저 storage / KV 0건

## v0.4.0 핵심 메모 (이전 단계)

```text
- v3/v3-structure-bucket.js 신규 생성
- 13 structureBucket + confidence 0~100
- payload.structure.structure (CASE B 이중 nesting)
- touch count는 v3-indicators 출력 재사용
- riskPenalty 미반영 (DP-STR8)

## v0.3.0 핵심 메모 (이전 단계)

```text
- v3/v3-score-breakdown.js 신규 생성
- 100점 만점: core 25 + structure 20 + volume 20 + momentum 15 + execution 20
- riskPenalty 최대 15 (default risk이면 penalty 0 — DP-S4)
- payload mutation 0건 (DP-S1)
- grade / tier / label / 등급 코드 미산출 (DP-S5)
- indicator state 라벨 활용
```
