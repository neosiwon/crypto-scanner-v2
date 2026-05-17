# WS3 v0.15.0 — Transport Executor Harness (Dry-Run) 완료 보고

**작성일**: 2026-05-17
**branch**: `claude/heuristic-cori-7865e7`
**이전 functional baseline**: WS3 v0.14.0 secureTransportExecutorContract (`644c525`)
**본 단계 산출**: `v3/v3-transport-executor-harness.js` (1종 신규)

---

## 1. 단계 개요

- **TransportExecutorHarness 신규** (`WS3_TransportExecutorHarness`)
  - 입력 8종: `secureTransportExecutorContract` (v0.14.0) + `transportExecutionEnvelope` (v0.13.0) + `transportPlan` (v0.12.0) + `rendererBinding` (v0.12.0) + `operationPacket` (v0.8.0) + `activeCycleDecision` (v0.9.0) + `evaluationOutcome` (v0.10.0) + `externalConfluence` (v0.11.0)
  - 출력: standalone `TransportExecutorHarness` (DRY_RUN_HARNESS, dry-run only)
  - 4종 target harness (telegramHarness / snapshotHarness / evaluationHarness / auditHarness)
- **버전**: `HARNESS_VERSION = 'WS3_v0.15.0_transport_executor_harness'`
- **export 패턴**: `global.WS3_TransportExecutorHarness` + `module.exports` (이중 환경)
- **WS3 파이프라인 16단계 완성** — payload → ... → secureTransportExecutorContract → **transportExecutorHarness**

---

## 2. 출력 top-level 구조

```text
valid                  boolean   secureTransportExecutorContract invalid 시 false
version                string    'WS3_v0.15.0_transport_executor_harness'
harnessMode            string    'DRY_RUN_HARNESS' 강제
liveExecutionAllowed   boolean   항상 false (DP-HARNESS3/4 강제)
harnessStatus          string    6 후보 (INVALID/BLOCKED/PARTIAL/READY/SKIPPED/UNKNOWN)
sourceContractStatus   string    input.secureTransportExecutorContract.contractStatus verbatim
harnessPolicy          object    {dryRunOnly, sideEffectAllowed, credentialLookupAllowed, fetchAllowed, writeAllowed, liveExecutionRequiresExplicitGate}
telegramHarness        object    {ready, target, dryRunOnly, sideEffectAllowed, bindingRef, requestShape, perTargetGate, rateLimitContract, circuitBreakerContract, dryRunResult, blockedReasons, warnings}
snapshotHarness        object    동일 shape
evaluationHarness      object    동일 shape
auditHarness           object    동일 shape
harnessSummary         object    {readyCount, blockedCount, skippedCount, dryRunOnlyCount, hasReadyTarget, hasBlocker, liveGateRequired}
reasons                string[]
warnings               string[]
debug                  object    {source, configVersion, invalidContract, credentialBlocked, envLikeBlocked, depthBlocked, modeBlocked, hardBlockBoolean, perTargetGateBlocked, ...}
configUsed             object    cfg 스냅샷 (scalar / shallow safe)
```

---

## 3. harnessStatus 6 후보 + 우선순위 (§4)

| 우선순위 | 상태 | 조건 |
|---|---|---|
| 1 | `HARNESS_INVALID` | secureTransportExecutorContract missing 또는 valid !== true |
| 2 | `HARNESS_BLOCKED` | source CONTRACT_BLOCKED/INVALID / credential 감지 / env-like 감지 / depth 초과 / harnessMode !== DRY_RUN_HARNESS / hard-block 5 boolean 중 하나 true / perTargetGate.allow === true |
| 3 | `HARNESS_PARTIAL` | ≥1 ready true AND ≥1 real blocker |
| 4 | `HARNESS_READY` | source CONTRACT_READY/PARTIAL AND ≥1 ready true AND blocker 0 |
| 5 | `HARNESS_SKIPPED` | source CONTRACT_SKIPPED 또는 모든 ready false + blocker 0 |
| 6 | `HARNESS_UNKNOWN` | fallback |

- `classifyHarnessStatus(harnesses, safety, cfg)` first-match-wins
- `buildHarnessSummary` 가 `pure SOURCE_CONTRACT_NOT_READY` vs `real blocker` 구분

---

## 4. target harness ready 정책 (§5)

각 4 target harness 는 9-stage AND 조건:

```text
secureTransportExecutorContract.{target}Contract.ready === true
&& cfg.targets.{target}.enabled === true
&& cfg.harnessMode === 'DRY_RUN_HARNESS'
&& cfg.liveExecutionAllowed !== true
&& cfg.sideEffectAllowed !== true
&& cfg.fetchAllowed !== true
&& cfg.writeAllowed !== true
&& cfg.credentialLookupAllowed !== true
&& cfg.perTargetGate.allow !== true
&& validateBindingRef(bindingRef).valid === true
```

**핵심**: DP-HARNESS2 — secureTransportExecutorContract ready/status 결정을 절대 true override 안 함. ready=true 는 실제 실행 가능 의미가 아님 (dry-run harness 가 실행 후보 shape 를 만들 수 있다는 뜻).

---

## 5. dry-run safety 정책 (§6 / DP-HARNESS3-4)

### 5 boolean hard block (DP-HARNESS4)
- `liveExecutionAllowed`, `sideEffectAllowed`, `fetchAllowed`, `writeAllowed`, `credentialLookupAllowed` 중 하나라도 true → HARNESS_BLOCKED
- 기본 값 모두 false

### harnessMode (DP-HARNESS3)
- `DEFAULT_CONFIG.harnessMode = 'DRY_RUN_HARNESS'` 고정
- 'LIVE' / 'REAL' / 'EXECUTE' 등 → HARNESS_BLOCKED

---

## 6. perTargetGate 정책 (§7 / DP-HARNESS5)

```js
perTargetGate: {
  allow: false,                     // 항상 false (v0.15.0)
  reason: 'DRY_RUN_HARNESS_ONLY'
}
```

- `cfg.perTargetGate.allow === true` 시도 → HARNESS_BLOCKED
- `buildPerTargetGate(cfg)` 가 항상 `allow=false` 강제 (per-target override 불가)
- v0.16+ real executor 에서만 별도 explicit gate 부여

---

## 7. rate limit / circuit breaker contract 정책 (§8)

### rateLimitContract (per-target)
```js
{
  enabled: true,
  key: 'TELEGRAM' | 'SNAPSHOT_STORE' | 'EVALUATION_STORE' | 'AUDIT_STORE',
  windowMs: 60000,
  maxAttempts: 1
}
```
- key field 는 `buildRateLimitContract(target, cfg)` 가 target enum 기반으로 자동 설정

### circuitBreakerContract
```js
{
  enabled: true,
  state: 'OPEN_IN_DRY_RUN',          // 강제 (DP-HARNESS1)
  failureThreshold: 1
}
```
- v0.15.0 에서 `state` 는 항상 `OPEN_IN_DRY_RUN` 강제. CLOSED / HALF_OPEN 등 실운영 상태는 v0.16+에서만 허용

### merge 우선순위
```text
per-target override > top-level config > default
```
- 기본 config: `cfg.targets.{target}.rateLimitContract = null` 일 때 top-level `cfg.rateLimitContract` 사용
- per-target object 가 명시되면 해당 target 만 override (S20 검증)

---

## 8. dryRunResult v0.16 활용 정책 (§15 / DP-HARNESS1)

```js
dryRunResult: {
  wouldExecute: false,               // 항상 false 강제 (DP-HARNESS1)
  action: 'TELEGRAM_SEND' | 'SNAPSHOT_WRITE' | 'EVALUATION_WRITE' | 'AUDIT_WRITE',
  resultType: 'DRY_RUN_ONLY'         // 항상 DRY_RUN_ONLY
}
```

- **dryRunResult 는 LIVE 실행 결정 source 가 아니다**. debugging / canary / action enum 검증용
- `wouldExecute=false` 유지 (v0.16+ 에서도 본 모듈은 false 강제)
- action enum: target 별 매핑 fixed (S29 검증)

---

## 9. credential / env recursive 차단 정책 (DP-HARNESS6)

### credential 9키 (lower-case partial match)
```text
secret, token, chatid, bottoken, apikey, authorization, password, credential, webhookurl
```

### env-like 11키 (exact key match + value is object)
```text
env, ENV, environment, bindings, cfEnv, cloudflareEnv, secrets, kvNamespace, kv, KV, process
```

### RESERVED 프레임워크 metadata 자동 차단 제외 (N-HARNESS-OBS-4)
v0.13/v0.14/v0.15 framework metadata field 18종 exact match 사전 제외:
```text
credentialAllowList, credentialAllowListSize, credentialMaxDepth,
credentialDetections, credentialDepthWarnings, credentialBlocked,
credentialInPayloadAllowed, credentialInEnvelopeAllowed,
credentialSource, credentialPolicy, credentialLookupAllowed,
blockCredentialFields,
allowWebhookUrl, allowDirectSecretAccess, directSecretAccessAllowed,
bindingRefAllowList, bindingRefAllowListSize, bindingRefCredentialPatternBlocked
```

### 정책 요약
- `cfg.safety.blockCredentialFields=true` 기본 — credential 9키 nested 재귀 검사
- `cfg.safety.blockEnvLikeObjects=true` 기본 — env-like 11키 exact + value object
- `cfg.safety.credentialMaxDepth=5` — scalar leaf 안전 (depth 무관)
- 감지 시: HARNESS_BLOCKED + `SECRET_FIELD_BLOCKED:<path>` / `ENV_LIKE_OBJECT_DETECTED:<path>` warnings
- value 절대 노출 0건 (S12/S13/S27 검증)

---

## 10. requestShape / payloadSummary / metadata 정책 (§11 / DP-HARNESS7)

### whitelist scalar only
- v0.14 contract.requestShape 를 그대로 신뢰 X — v0.15 에서 재검증
- `buildSafePayloadSummary` / `buildSafeMetadata` IIFE module-private (N-HARNESS-OBS-4)
- 14 whitelist scalar default (candidateKey, base, quote, market, exchange, timeframe, messageType, snapshotType, evaluationType, resultType, auditType, displayMode, confluenceLabel, confluenceScore)
- metadataAllowedFields 기본 빈 배열

### 금지 구현 패턴
- `Object.assign(target, source)` — 0건 ✅
- `{ ...source }` spread — 0건 ✅
- `JSON.parse(JSON.stringify(source))` — 0건 ✅
- `for (var k in source)` — 0건 ✅

---

## 11. message wording 정책 (§12 / DP-HARNESS8)

### 15 금지 어휘 (FORBIDDEN_WORDS)
```text
발송됨, 저장됨, 전송 완료, completed transmission,
sent, delivered,
매수 성공, 손절, 익절, 수익 확정, 손실 확정,
buy now, sell now, take profit, stop loss
```

### 매칭 방식 (r0.2 §6.2)
- **exact phrase substring match** (case-insensitive)
- "전송 완료" 전체 phrase 차단 / "전송" 단독 비차단 / "전송 후보" 허용 (S23 검증)
- "sent" / "delivered" 영어 case-insensitive phrase match

### 추가 차단: credential pattern in line
- line 에 9 credential 키 substring 감지 시 `CREDENTIAL_IN_LINE_REJECTED` warning + line 제거
- URL with token 등 텍스트 라인에 credential value 가 흘러들어가는 시나리오 차단

### sanitizeMode 3 모드 (기본 REJECT)
- `REJECT` — line 제거 + `FORBIDDEN_WORD_LINE_REJECTED:<word>`
- `REPLACE` — safe wording 치환 (예: '발송됨' → '발송 후보')
- `WARN_ONLY` — line 유지 + warning (운영 사용 금지 권장)

---

## 12. binding / credential 정책 (§10)

### 허용
- bindingRef (logical reference만 — v0.14 의 contract.bindingRef 그대로 복사 후 재검증)
- requestShape (whitelist scalar)
- target enum
- rateLimitContract / circuitBreakerContract (contract object only)
- dryRunResult (wouldExecute=false 강제)

### 금지
- credential value (botToken / chatId / apiKey 등)
- 실제 URL / endpoint (api.telegram.org 등)
- env object / process.env / globalThis.bindings
- fetch / 실제 호출

### validateBindingRef (N-HARNESS-OBS-5)
- v0.15 IIFE 내부 private 함수로 재정의 (v0.14 와 동일 규칙)
- 정규식 `^[A-Z][A-Z0-9_]*$` + 13 금지 substring + bot[0-9]+ + digit-only + credential pattern + allowList
- global export 는 `WS3_TransportExecutorHarness.validateBindingRef` 만 (v0.14 와 namespace 분리)

---

## 13. 적용 DP / N-HARNESS-OBS 정리

| ID | 적용 결과 |
|---|---|
| **DP-HARNESS1** | dry-run harness 만. `harnessMode='DRY_RUN_HARNESS'` + `liveExecutionAllowed=false` + `circuitBreaker.state='OPEN_IN_DRY_RUN'` + `dryRunResult.wouldExecute=false` 강제. 실제 발송/저장/호출 0건 |
| **DP-HARNESS2** | secureTransportExecutorContract.{target}Contract.ready/status override 0건. boolean AND 집계만 |
| **DP-HARNESS3** | DRY_RUN_HARNESS 외 mode → HARNESS_BLOCKED (S5 검증) |
| **DP-HARNESS4** | 5 boolean (liveExecutionAllowed / sideEffectAllowed / fetchAllowed / writeAllowed / credentialLookupAllowed) hard block (S6~S10 검증) |
| **DP-HARNESS5** | perTargetGate.allow=true 시도 → HARNESS_BLOCKED (S11 검증) |
| **DP-HARNESS6** | credential 9키 + env-like 11키 재귀 차단. process.env / globalThis.env 코드 0건 |
| **DP-HARNESS7** | requestShape / payloadSummary / metadata whitelist scalar. Object.assign / spread / clone / for-in 0건. v0.14 contract 재검증 |
| **DP-HARNESS8** | dry-run wording only. exact phrase substring match. `sanitizeMode='REJECT'` 기본 + CREDENTIAL_IN_LINE_REJECTED 추가 |
| **DP-HARNESS9** | 8종 입력 read-only (S26 frozen-input 검증) |
| **DP-HARNESS10** | 신규 파일 1개 + 문서 갱신만. 보호 파일 25종 무손상 |
| **N-HARNESS-OBS-1** | 보호 baseline false-positive — 본 모듈 fetch / Date.now / Object.assign / spread / clone / for-in 0건 |
| **N-HARNESS-OBS-2** | r0.1 폐기 naming residue 0건 (RealTransportExecutor* / *Execution / EXECUTOR_* / classifyExecutorStatus 등) |
| **N-HARNESS-OBS-3** | v0.14 contract shape 정합 — telegramContract/snapshotContract/evaluationContract/auditContract.ready 와 contractStatus 참조. override 0건 |
| **N-HARNESS-OBS-4** | `buildSafePayloadSummary` / `buildSafeMetadata` 동명 — IIFE module-private, global export 미포함. v0.13/v0.14 와 파일 scope 분리. RESERVED 18종 framework metadata exact match 사전 제외 (`directSecretAccessAllowed` 등 v0.14 자체 metadata 식별자 포함) |
| **N-HARNESS-OBS-5** | `validateBindingRef` 동명 — v0.15 IIFE 내부 private 함수로 재정의. global namespace 는 `WS3_TransportExecutorHarness` 만 노출 |
| **N-HARNESS-OBS-6** | 보호 파일 25종 — v0.14 commit 이후 `v3-secure-transport-executor-contract.js` 추가. 본 단계 25종 무손상 |

---

## 14. 함수 목록 (§14 spec)

```text
[Entry / Config]
  mergeTransportExecutorHarnessConfig(config)
  buildTransportExecutorHarness(input, config)         ← 진입점

[Target harness builders]
  buildTelegramHarness(input, cfg)
  buildSnapshotHarness(input, cfg)
  buildEvaluationHarness(input, cfg)
  buildAuditHarness(input, cfg)

[Contract builders / per-target]
  buildDryRunResult(contract, target, cfg)
  buildPerTargetGate(target, cfg)
  buildRateLimitContract(target, cfg)
  buildCircuitBreakerContract(target, cfg)

[Shape / summary / classification]
  buildSafeRequestShape(contract, target, cfg)
  buildSafePayloadSummary(input, cfg)                  ← IIFE module-private
  buildSafeMetadata(input, cfg)                        ← IIFE module-private
  buildHarnessSummary(harnesses, cfg)
  classifyHarnessStatus(harnesses, safety, cfg)

[Credential / env / wording / binding]
  detectCredentialFields(input, config)
  detectEnvLikeObjects(input, config)
  validateBindingRef(bindingRef, cfg)
  sanitizeMessageLines(lines, cfg)

[Normalize / helpers]
  normalizeHarnessTarget(target, cfg)
  normalizeTransportExecutorHarness(result)
  isPlainObject, safeString, safeNumber, pushReason, pushWarning
```

---

## 15. smoke test 30 시나리오 (모두 통과 / 95 assertion ALL PASS)

| # | 시나리오 | 검증 |
|---|---|---|
| S1 | harness ready all targets | HARNESS_READY + 4 target ready=true + perTargetGate.allow=false |
| S2 | harness skipped (CONTRACT_SKIPPED) | HARNESS_SKIPPED |
| S3 | harness invalid (null / valid:false) | HARNESS_INVALID |
| S4 | source CONTRACT_BLOCKED | HARNESS_BLOCKED |
| S5 | harnessMode LIVE | HARNESS_BLOCKED |
| S6 | liveExecutionAllowed=true | HARNESS_BLOCKED |
| S7 | sideEffectAllowed=true | HARNESS_BLOCKED |
| S8 | fetchAllowed=true | HARNESS_BLOCKED |
| S9 | writeAllowed=true | HARNESS_BLOCKED |
| S10 | credentialLookupAllowed=true | HARNESS_BLOCKED |
| S11 | perTargetGate.allow=true | HARNESS_BLOCKED |
| S12 | credential blocked top-level | BOTTOKEN_DO_NOT_LEAK 0 노출, SECRET_FIELD_BLOCKED |
| S13 | env-like object blocked | env_leak_v15 0 노출, ENV_LIKE_OBJECT_DETECTED |
| S14 | telegram harness shape | ready, dryRunResult.wouldExecute=false, action=TELEGRAM_SEND, resultType=DRY_RUN_ONLY |
| S15 | snapshot harness shape | ready, action=SNAPSHOT_WRITE, bindingRef=KV_SNAPSHOT_BINDING |
| S16 | evaluation harness shape | ready, action=EVALUATION_WRITE, bindingRef=EVALUATION_STORE_BINDING |
| S17 | audit harness shape | ready, action=AUDIT_WRITE, bindingRef=AUDIT_STORE_BINDING |
| S18 | rateLimitContract shape | enabled=true, key=TELEGRAM, windowMs=60000, maxAttempts=1 |
| S19 | circuitBreakerContract shape | enabled=true, state=OPEN_IN_DRY_RUN, failureThreshold=1 |
| S20 | per-target rateLimitContract override | telegram maxAttempts=30, snapshot maxAttempts=1 (top-level fallback) |
| S21 | requestShape revalidation | v0.14 bogusField / bogusSummary stripped |
| S22 | metadata revalidation | default empty / safeField copied / unsafeNested skipped / leak_v15 0 노출 |
| S23 | wording sanitize REJECT (exact phrase) | "발송됨" / "전송 완료" / "sent" 제거, "전송 후보" / "safe line" 유지 |
| S24 | no env access | no exception |
| S25 | no side-effect (multiple builds) | no exception |
| S26 | mutation check | frozen input / JSON before-after 동일 |
| S27 | raw/secret value leak (nested non-credential keys) | INNER_SECRET_V15 0 노출 |
| S28 | v0.16 interface separation | process.env / api.telegram.org / sk-/xoxb-/eyJ 0 노출. TELEGRAM_SECURE_BINDING / KV_SNAPSHOT_BINDING logical only. harnessPolicy 6 boolean 검증 |
| S29 | dryRunResult v0.16 policy | 4 target wouldExecute=false / resultType=DRY_RUN_ONLY / action enum target match |
| S30 | r0.1 naming residue | executorStatus / executorMode / telegramExecution / RealTransportExecutorHarness / EXECUTOR_READY 0 출력. telegramHarness / harnessStatus present |

**총 assertion 95건 / 95 PASS** ✅

---

## 16. 금지 패턴 grep 결과

| 영역 | 매치 분류 |
|---|---|
| A. side-effect API | 10 매치 — 모두 JSDoc 정책 + 함수명 (`buildTelegramHarness`). **실제 호출 0건** |
| B. 입력 mutation | **0건** ✅ DP-HARNESS9 |
| C. r0.1 폐기 naming residue | 1 매치 (JSDoc N-HARNESS-OBS-2 정책 명시) — **실제 사용 0건** |
| Plan residue (`rateLimitPlan / circuitBreakerPlan`) | **0건** ✅ |
| spread / clone / for-in | 3 매치 (JSDoc 정책 + comment) — **실제 사용 0건** ✅ DP-HARNESS7 |
| process.env / globalThis.env | 2 매치 (JSDoc 정책) — **실제 사용 0건** ✅ DP-HARNESS6 |
| credential / URL / token | 매치 다수 — JSDoc 정책 + `CREDENTIAL_KEYS_BASE` literal + `RESERVED_FRAMEWORK_METADATA_KEYS` literal + `BINDING_REF_FORBIDDEN_SUBSTRINGS` literal (sk-/xoxb-/eyJ) + 변수/함수명. **실제 외부 노출 0건** |
| env-like keys | 매치는 (1) JSDoc + (2) `ENV_LIKE_KEYS_EXACT` literal + (3) `KV_SNAPSHOT_BINDING` constant + (4) local var `env` (v0.13 envelope 변수). **실제 env 접근 0건** |
| trading + transmission wording | 매치 다수 — JSDoc 정책 + `FORBIDDEN_WORDS` literal + `getSafeReplacement` 매핑. **실제 어휘 출력 사용 0건** ✅ DP-HARNESS8 |

---

## 17. 보호 파일 diff 0건 확인 (25종)

```bash
git diff --stat HEAD -- <25 protected files>
→ 빈 출력
```

### 보호 파일 25종 (수정 0건)
```
v3 *.js 20종:
  v3-config / v3-feature-payload / v3-bithumb-client / v3-candle-normalizer /
  v3-indicators / v3-feature-payload-builder / v3-score-breakdown / v3-structure-bucket /
  v3-signal-cycle / v3-strategy-plan / v3-card-view-model / v3-operation-packet /
  v3-active-cycle / v3-evaluation-outcome / v3-evaluation-observation-adapter /
  v3-external-confluence / v3-transport-plan / v3-renderer-binding /
  v3-transport-execution-adapter / v3-secure-transport-executor-contract

문서 2종 (수정 0건):
  docs/ws3/WS3_CODE_CONTRACT.md (b-r2 박제본 그대로)
  docs/ws3/WS3_WORKFLOW_TEMPLATE.md (v0.1 박제본 그대로)

루트 3종 (수정 0건):
  index.html / manifest.json / service-worker.js

인프라 2종 (수정 0건):
  worker.js / wrangler.toml
```

---

## 18. 기준 commit

- branch: `claude/heuristic-cori-7865e7`
- 이전 functional baseline: WS3 v0.14.0 secureTransportExecutorContract (`644c525`)
- 본 commit: (Gate 3 push 후 기록)

---

## 19. 핵심 메모

```text
- v3/v3-transport-executor-harness.js 신규 (1603 라인)
- DP-HARNESS1 ~ DP-HARNESS10 + N-HARNESS-OBS-1 ~ N-HARNESS-OBS-6 모두 적용 / 미해결 항목 0건
- 보호 파일 25종 모두 무손상 (v3 *.js 20종 + index/manifest/sw 3종 + CODE_CONTRACT + WORKFLOW_TEMPLATE)
- harnessStatus 6 후보 first-match-wins (INVALID > BLOCKED > PARTIAL > READY > SKIPPED > UNKNOWN)
- 4 target harness: telegram / snapshot / evaluation / audit (각 9-stage AND ready)
- harnessMode='DRY_RUN_HARNESS' 강제, liveExecutionAllowed=false 강제
- 5 boolean hard block: liveExecution / sideEffect / fetch / write / credentialLookup
- perTargetGate.allow 항상 false 강제 (DP-HARNESS5)
- rateLimitContract per-target key 자동 설정 + per-target override 지원 (S20 검증)
- circuitBreakerContract.state='OPEN_IN_DRY_RUN' 강제 (S19 검증)
- dryRunResult.wouldExecute=false 강제, resultType=DRY_RUN_ONLY, action enum target 매핑 (S29 검증)
- credential 9키 재귀 차단 (case-insensitive + partial + depth 5, scalar leaf 안전)
- RESERVED 프레임워크 metadata 키 18종 자동 차단 제외 (`directSecretAccessAllowed` 등 v0.14 자체 metadata 포함, N-HARNESS-OBS-4 확장)
- env-like 11키 exact match + value object 조건 차단 (r0.2 §6.2 false-positive 완화)
- bindingRef logical reference only — `^[A-Z][A-Z0-9_]*$` + 13 금지 substring + bot[0-9]+ + digit-only + credential partial match + allowList
- payloadSummary 14 whitelist scalar + metadata 기본 빈 배열, v0.14 contract 재검증
- Object.assign / spread / JSON.parse(JSON.stringify) / for-in 코드 0건
- sanitizeMode='REJECT' 기본 (15 금지 어휘 exact phrase substring match)
- CREDENTIAL_IN_LINE_REJECTED 추가 (line 내 credential pattern 차단)
- smoke test 30 시나리오 / 95 assertion 전부 PASS
- 입력 mutation 0건 (DP-HARNESS9, S26 frozen-input 검증)
- fetch / Telegram 실호출 / KV / DB / DOM / storage / clock API / process.env / globalThis 코드 0건
- r0.1 폐기 naming residue (RealTransportExecutor* / *Execution / EXECUTOR_*) 출력 0건 (S30 검증)
- v0.16+ real executor 와 credential 인계 0건 (bindingRef logical + harnessPolicy 만 인계)
```
