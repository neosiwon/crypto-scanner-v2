# WS3 v0.17.0 — Transport Executor Sandbox Runner 완료 보고

**작성일**: 2026-05-17
**branch**: `claude/heuristic-cori-7865e7`
**이전 functional baseline**: WS3 v0.16.0 transportExecutorInterfaceAdapter (`9eaffe5`)
**본 단계 산출**: `v3/v3-transport-executor-sandbox-runner.js` (1종 신규)

---

## 1. 단계 개요

- **TransportExecutorSandboxRunner 신규** (`WS3_TransportExecutorSandboxRunner`)
  - 입력 10종: `transportExecutorInterfaceAdapter` (v0.16.0) + `transportExecutorHarness` (v0.15.0) + `secureTransportExecutorContract` (v0.14.0) + `transportExecutionEnvelope` (v0.13.0) + `transportPlan` (v0.12.0) + `rendererBinding` (v0.12.0) + `operationPacket` (v0.8.0) + `activeCycleDecision` (v0.9.0) + `evaluationOutcome` (v0.10.0) + `externalConfluence` (v0.11.0)
  - 출력: standalone `TransportExecutorSandboxRunner` (SANDBOX_ONLY, fixture-based simulated)
  - 4종 target sandbox (telegramSandbox / snapshotSandbox / evaluationSandbox / auditSandbox)
- **버전**: `SANDBOX_VERSION = 'WS3_v0.17.0_transport_executor_sandbox_runner'`
- **export 패턴**: `global.WS3_TransportExecutorSandboxRunner` + `module.exports` (이중 환경)
- **WS3 파이프라인 18단계 완성** — payload → ... → transportExecutorInterfaceAdapter → **transportExecutorSandboxRunner**

---

## 2. 출력 top-level 구조

```text
valid                  boolean   transportExecutorInterfaceAdapter invalid 시 false
version                string    'WS3_v0.17.0_transport_executor_sandbox_runner'
sandboxMode            string    'SANDBOX_ONLY' 강제
liveExecutionAllowed   boolean   항상 false (DP-SANDBOX3/4 강제)
sandboxStatus          string    6 후보 (INVALID/BLOCKED/PARTIAL/READY/SKIPPED/UNKNOWN)
sourceAdapterStatus    string    input.transportExecutorInterfaceAdapter.adapterStatus verbatim
sandboxPolicy          object    {sandboxOnly, sideEffectAllowed, credentialLookupAllowed, bindingLookupAllowed, fetchAllowed, writeAllowed, driverCallAllowed, retryAllowed, timerAllowed, liveExecutionRequiresExplicitGate}
bindingResolverPreview object    {lookupAllowed=false, lookupSimulated=false, resolved=false, resolverRef='FUTURE_SECURE_BINDING_RESOLVER', credentialHandleRef, bindingRef}
telegramSandbox        object    {ready, target, sandboxMode, sideEffectAllowed, bindingRef, sandboxFixtureRef, sandboxFixture, sandboxResult, interfaceSpec, bindingResolverPreview, driverCallPreview, resultAdapterPreview, errorAdapterPreview, retryPreview, rateLimitContract, circuitBreakerContract, blockedReasons, warnings}
snapshotSandbox        object    동일 shape
evaluationSandbox      object    동일 shape
auditSandbox           object    동일 shape
sandboxSummary         object    {readyCount, blockedCount, skippedCount, simulatedOkCount, simulatedErrorCount, simulatedSkippedCount, hasReadyTarget, hasBlocker, liveGateRequired}
reasons, warnings, debug, configUsed
```

---

## 3. sandboxStatus 6 후보 + 우선순위 (§3.1)

| 우선순위 | 상태 | 조건 |
|---|---|---|
| 1 | `SANDBOX_INVALID` | transportExecutorInterfaceAdapter missing 또는 valid !== true |
| 2 | `SANDBOX_BLOCKED` | source ADAPTER_BLOCKED/INVALID / credential 감지 / env-like 감지 / depth 초과 / function input 감지 / sandboxMode !== SANDBOX_ONLY / 9 boolean hard block / invalid sandboxFixture / invalid sandboxResult / invalid rateLimitContract / invalid circuitBreakerContract |
| 3 | `SANDBOX_PARTIAL` | ≥1 ready true + ≥1 real blocker |
| 4 | `SANDBOX_READY` | source ADAPTER_READY/PARTIAL + ≥1 ready true + blocker 0 |
| 5 | `SANDBOX_SKIPPED` | source ADAPTER_SKIPPED 또는 모든 ready false + blocker 0 |
| 6 | `SANDBOX_UNKNOWN` | fallback |

---

## 4. target sandbox ready 정책 — 17-stage AND

```text
transportExecutorInterfaceAdapter.<target>Interface.ready === true
&& cfg.targets.<target>.enabled === true
&& cfg.sandboxMode === 'SANDBOX_ONLY'
&& cfg.liveExecutionAllowed !== true
&& cfg.sideEffectAllowed !== true
&& cfg.fetchAllowed !== true
&& cfg.writeAllowed !== true
&& cfg.credentialLookupAllowed !== true
&& cfg.bindingLookupAllowed !== true
&& cfg.driverCallAllowed !== true
&& cfg.retryAllowed !== true
&& cfg.timerAllowed !== true
&& fixtureValidation valid
&& resultValidation valid
&& rateLimitContract valid (pass-through)
&& circuitBreakerContract valid (state='OPEN_IN_DRY_RUN' 강제)
&& bindingRef validateLogicalRef valid
```

**핵심**: ready=true 는 sandbox 실행 가능 의미. LIVE 실행 가능 의미 X. sandboxResult.ok 와 별개 (N-SANDBOX-OBS-8).

---

## 5. sandbox fixture 정책 (§3.2 / DP-SANDBOX5)

### 허용 키 6종 (whitelist exact)
```text
target, action, ok, status, errorType, reasonCode
```

### validateSandboxFixture 9-step 검증
1. plain object only (Array / function / thenable 차단)
2. allowed keys whitelist + extra key 차단 + credential key 부분일치 차단
3. nested object 차단 (depth 1)
4. target enum (TELEGRAM/SNAPSHOT_STORE/EVALUATION_STORE/AUDIT_STORE) + target match
5. action enum + target ↔ action 매핑 (TELEGRAM→TELEGRAM_SEND 등)
6. ok: boolean | null
7. status: SIMULATED_OK / SIMULATED_ERROR / SIMULATED_SKIPPED
8. errorType: null or 9 enum (NETWORK_ERROR/TIMEOUT/AUTH_FAILED/RATE_LIMIT/PAYLOAD_ERROR/SERVER_ERROR/PARSE_ERROR/UNKNOWN/CONTRACT_INVALID)
9. reasonCode: null or safe string + credential pattern 차단 + function pattern 차단

### 위반 reason
- `INVALID_SANDBOX_FIXTURE:NOT_PLAIN_OBJECT / THENABLE / EXTRA_KEY:<k> / CREDENTIAL_KEY:<k> / FUNCTION_VALUE:<k> / NESTED_OBJECT:<k> / ARRAY_VALUE:<k> / INVALID_TARGET / TARGET_MISMATCH / INVALID_ACTION / ACTION_TARGET_MISMATCH / INVALID_OK / INVALID_STATUS / INVALID_ERROR_TYPE / INVALID_REASON_CODE / REASON_CODE_TOO_LONG / REASON_CODE_CREDENTIAL_PATTERN / REASON_CODE_FUNCTION_PATTERN`

### fixture null/undefined → default 자동 생성
- `{ target: <target>, action: <expectedAction>, ok: true, status: 'SIMULATED_OK', errorType: null, reasonCode: null }`

---

## 6. sandboxResult 정책 (§3.3 / DP-SANDBOX7)

### 허용 필드 (8종)
```text
simulated: true, resultType: 'SANDBOX_ONLY',
target, action, ok (boolean|null), status, errorType, reasonCode
```

### 금지 필드
```text
rawResponse / rawError / stack / responseBody / headers / body /
credential / token / chatId / apiKey / webhookUrl / env / function / Promise /
Date.now value / timestamp
```

### 의미 박제 (N-SANDBOX-OBS-8)
- `sandboxResult.ok=true` 는 LIVE 실행 결정 source 가 **아님** (audit/canary/monitoring 자료)
- `SIMULATED_OK` 는 LIVE 성공 예측 **아님**
- `SIMULATED_ERROR` 는 LIVE error **아님** (정상 에러 경로 시뮬레이션 가능)
- `SIMULATED_SKIPPED` 는 LIVE skip 결정 **아님**
- `sandboxResult` 는 LIVE result template **아님**. v0.18 LIVE result 는 별도 생성
- target.ready 와 sandboxResult.ok 무관 (sandboxResult.ok=false 라도 target.ready=true 가능, S37 검증)

---

## 7. 5종 Preview 정책 (§3.4 / DP-SANDBOX2)

### bindingResolverPreview (top-level)
```text
lookupAllowed=false, lookupSimulated=false, resolved=false,
resolverRef='FUTURE_SECURE_BINDING_RESOLVER',
credentialHandleRef='SECURE_CREDENTIAL_HANDLE_REF',
bindingRef='LOGICAL_BINDING_REF'
```

### driverCallPreview (per-target)
```text
callAllowed=false, callSimulated=false, wouldCall=false,
callMode='SANDBOX_PREVIEW',
driverRef='FUTURE_<TARGET>_DRIVER' (v0.16 verbatim),
methodRef='SEND_MESSAGE' | 'WRITE_SNAPSHOT' | 'WRITE_EVALUATION' | 'WRITE_AUDIT',
inputSchemaRef / outputSchemaRef
```

### resultAdapterPreview (per-target)
```text
resultType='SANDBOX_PREVIEW', rawResponseAllowed=false, safeFieldsOnly=true,
safeFields=['action', 'resultType', 'ok', 'status', 'errorType', 'reasonCode']
```

### errorAdapterPreview (per-target)
```text
simulatedError=false, rawErrorAllowed=false, stackAllowed=false, responseBodyAllowed=false,
safeFields, errorTypes (9 enum)
```

### retryPreview (per-target)
```text
retrySimulated=false, retryAllowed=false, maxRetries=0, backoffMs=0, retryableErrors=[]
```

---

## 8. v0.16 pass-through 재검증 정책 (§3.5)

### rateLimitContract
- enabled / key (UPPER_SNAKE_CASE 정규식) / windowMs>0 / maxAttempts>0 / **key === targetType** 검증
- 위반 → `INVALID_RATE_LIMIT_CONTRACT:<target>` blocked

### circuitBreakerContract
- enabled / **state='OPEN_IN_DRY_RUN' 강제** / failureThreshold>0
- CLOSED / HALF_OPEN 절대 허용 안 함
- 위반 → `INVALID_CIRCUIT_BREAKER_CONTRACT:<target>` blocked

---

## 9. credential / env / function input 통합 차단 (DP-SANDBOX6)

- credential 9키 case-insensitive partial match + depth 5
- env-like 11키 exact match + value object
- function input 재귀 차단 (function / thenable)
- **RESERVED 프레임워크 metadata 24종** 자동 차단 제외:
  - credential* (12): credentialAllowList / credentialAllowListSize / credentialMaxDepth / credentialDetections / credentialDepthWarnings / credentialBlocked / credentialInPayloadAllowed / credentialInEnvelopeAllowed / credentialSource / credentialPolicy / credentialLookupAllowed / **credentialHandleRef (v0.16 bindingResolverContract field 신규 포함)** / blockCredentialFields
  - Secret/Token policy (3): allowWebhookUrl / allowDirectSecretAccess / directSecretAccessAllowed
  - binding ref policy (3): bindingRefAllowList / bindingRefAllowListSize / bindingRefCredentialPatternBlocked
  - logical ref policy (4): logicalRefAllowList / logicalRefAllowListSize / logicalRefCredentialPatternBlocked / logicalRefFunctionPatternBlocked
  - v0.17 sandbox policy (3 신규): sandboxFixtureCredentialPatternBlocked / sandboxFixturePatternBlocked / sandboxFixtureFunctionPatternBlocked

---

## 10. 9 boolean hard block (N-SANDBOX-OBS-7)

v0.16 의 8 boolean + `timerAllowed` 추가:
```text
liveExecutionAllowed / sideEffectAllowed / fetchAllowed / writeAllowed /
credentialLookupAllowed / bindingLookupAllowed / driverCallAllowed / retryAllowed /
timerAllowed
```
중 하나라도 true → SANDBOX_BLOCKED

---

## 11. 적용 DP / N-SANDBOX-OBS 정리

| ID | 적용 결과 |
|---|---|
| **DP-SANDBOX1** | sandbox runner only. 실제 발송/저장/호출 X. 모든 preview boolean false 강제 |
| **DP-SANDBOX2** | adapter ready/status/contract override 0건. 5종 Contract preview 변환만 |
| **DP-SANDBOX3** | SANDBOX_ONLY only (S5 검증) |
| **DP-SANDBOX4** | 9 boolean hard block (S6~S14 검증) |
| **DP-SANDBOX5** | function / async / Promise / thenable input 차단 (S15 / S16 검증) |
| **DP-SANDBOX6** | credential / env / process / fixture credential 통합 차단 |
| **DP-SANDBOX7** | sandboxResult whitelist scalar. rawResponse/rawError/stack/body 0건 (S34/S35 검증) |
| **DP-SANDBOX8** | dry-run wording only |
| **DP-SANDBOX9** | 10종 입력 read-only (S52 frozen-input 검증) |
| **DP-SANDBOX10** | 신규 1개 + 문서 갱신만. 보호 파일 29종 무손상 |
| **N-SANDBOX-OBS-1** | 신규 식별자 fresh |
| **N-SANDBOX-OBS-2** | v0.16 adapter shape 정합 |
| **N-SANDBOX-OBS-3** | sandbox fixture/result 식별자 fresh |
| **N-SANDBOX-OBS-4** | preview 계열 fresh |
| **N-SANDBOX-OBS-5** | 보호 baseline false-positive |
| **N-SANDBOX-OBS-6** | RESERVED 확장 (`credentialHandleRef` 등 v0.16 metadata + v0.17 sandbox metadata 추가) |
| **N-SANDBOX-OBS-7** | timerAllowed 신규 hard block |
| **N-SANDBOX-OBS-8** | sandboxResult.ok 와 target.ready 분리 (S37 검증) |
| **N-SANDBOX-OBS-9** | 보호 파일 29종 무손상 |

---

## 12. smoke test 60 시나리오 (모두 통과 / 134 assertion ALL PASS)

| # | 시나리오 | 검증 |
|---|---|---|
| S1 | sandbox ready all targets | ✅ SANDBOX_READY + 4 target ready=true |
| S2 | sandbox skipped (ADAPTER_SKIPPED) | ✅ SANDBOX_SKIPPED |
| S3 | sandbox invalid (null) | ✅ SANDBOX_INVALID |
| S4 | source ADAPTER_BLOCKED | ✅ SANDBOX_BLOCKED |
| S5 | sandboxMode LIVE | ✅ BLOCKED |
| S6-S14 | 9 boolean hard block (liveExec/sideEffect/fetch/write/credLookup/bindingLookup/driverCall/retry/timer) | ✅ 각각 BLOCKED |
| S15 | function input blocked | ✅ FUNCTION_INPUT_BLOCKED |
| S16 | thenable input blocked | ✅ FUNCTION_INPUT_BLOCKED |
| S17 | credential top-level | ✅ BOTTOKEN_DO_NOT_LEAK_V17 0 노출 |
| S18 | env-like object | ✅ env_leak_v17 0 노출 |
| S19-S22 | 4 target sandbox shape | ✅ ready / sandboxResult.action / fixtureRef |
| S23 | fixture=null default | ✅ default fixture 생성 |
| S24 | default fixture.ok=true | ✅ default SIMULATED_OK |
| S25 | SIMULATED_ERROR valid | ✅ ready=true + errorType=TIMEOUT |
| S26 | SIMULATED_SKIPPED valid | ✅ status=SIMULATED_SKIPPED |
| S27 | action-target mismatch | ✅ ACTION_TARGET_MISMATCH blocked |
| S28 | extra key blocked | ✅ EXTRA_KEY:extraKey |
| S29 | nested object blocked | ✅ NESTED_OBJECT:reasonCode |
| S30 | credential/extra key blocked | ✅ secretKey 차단 |
| S31 | invalid errorType blocked | ✅ INVALID_ERROR_TYPE |
| S32 | reasonCode credential blocked | ✅ REASON_CODE_CREDENTIAL_PATTERN |
| S33 | sandbox result simulated only | ✅ simulated=true, resultType=SANDBOX_ONLY |
| S34 | rawResponse blocked | ✅ no rawResponse / responseBody |
| S35 | rawError / stack blocked | ✅ no rawError / no stack |
| S36 | credential leak blocked | ✅ no botToken / apiKey |
| S37 | sandboxResult.ok not used for ready | ✅ ready=true with ok=false (SIMULATED_ERROR) |
| S38 | bindingResolverPreview shape | ✅ lookupAllowed=false |
| S39 | driverCallPreview shape | ✅ callAllowed=false, wouldCall=false, callMode=SANDBOX_PREVIEW |
| S40 | resultAdapterPreview shape | ✅ resultType=SANDBOX_PREVIEW |
| S41 | errorAdapterPreview shape | ✅ 9 errorTypes |
| S42 | retryPreview shape | ✅ retryAllowed=false |
| S43 | rateLimitContract pass-through | ✅ key=TELEGRAM |
| S44 | invalid rateLimitContract | ✅ INVALID_RATE_LIMIT_CONTRACT |
| S45 | circuitBreakerContract pass-through | ✅ state=OPEN_IN_DRY_RUN |
| S46 | CLOSED blocked | ✅ INVALID_CIRCUIT_BREAKER_CONTRACT |
| S47 | requestShape revalidation | ✅ bogusField stripped |
| S48 | metadata revalidation | ✅ safeField copied |
| S49 | wording sanitize | ✅ "발송됨"/"sent" 제거, "전송 후보" 유지 |
| S50-S51 | no env / no side-effect | ✅ no exception |
| S52 | mutation check | ✅ frozen / before-after 동일 |
| S53 | raw/secret leak | ✅ INNER_SECRET_V17 absent |
| S54 | v0.18 interface separation | ✅ process.env / api.telegram.org / sk-/xoxb-/eyJ 0 노출 + sandboxPolicy 10 boolean |
| S55 | sandboxResult is not LIVE result | ✅ resultType=SANDBOX_ONLY, simulated=true |
| S56-S59 | preview boolean false maintained | ✅ wouldCall/lookupAllowed/retryAllowed=false |
| S60 | simulatedOkCount/ErrorCount/SkippedCount | ✅ default 4/0/0 → mix 2/1/1 |

**총 assertion 134건 / 134 PASS** ✅

---

## 13. 금지 패턴 grep 결과

| 영역 | 매치 | 분류 |
|---|---|---|
| async / await / Promise / thenable / setTimeout / setInterval / fetch / Date.now 등 | 150 매치 (broad grep) — **실제 사용 0건** | 모두 JSDoc 정책 / 헤더 / FORBIDDEN_WORDS literal / 변수명 (`thenable` JSDoc) — `^\s*async function`, `^\s*await\s`, `fetch\s*\(`, `Date.now\s*\(\s*\)`, `setTimeout\s*\(`, `setInterval\s*\(` 모두 0 grep |
| 입력 mutation | **0건** ✅ | DP-SANDBOX9 |
| process.env / globalThis.env / api.telegram.org | **0건 (실제 사용)** ✅ | 2 매치는 JSDoc 정책 라인만 |
| spread / Object.assign / clone / for-in | **0건 (실제 사용)** ✅ | 2 JSDoc 정책 매치만 |
| credential / URL / token | **0건 (외부 노출)** | JSDoc + CREDENTIAL_KEYS_BASE / RESERVED 24종 / LOGICAL_REF_FORBIDDEN_SUBSTRINGS literal + 변수/함수명 |
| `boolean: true` (callAllowed / lookupAllowed / wouldCall / retryAllowed / rawResponseAllowed / rawErrorAllowed / stackAllowed / responseBodyAllowed / timerAllowed) | **0건** ✅ | 모든 boolean 정책 false 강제 |
| `CLOSED / HALF_OPEN / OPEN[^_]` | **0건 (실제 사용)** ✅ | 1 JSDoc 정책 매치만 |
| trading + transmission wording | **0건 (실제 출력)** ✅ | JSDoc + FORBIDDEN_WORDS literal + getSafeReplacement 매핑 |

---

## 14. 보호 파일 diff 0건 확인 (29종)

```bash
git diff --stat HEAD -- <29 protected files>
→ (빈 출력)
```

### 보호 파일 29종
- v3 *.js 22종 (config~transport-executor-interface-adapter)
- 문서 2종 (CODE_CONTRACT / WORKFLOW_TEMPLATE)
- 루트 3종 (index.html / manifest.json / service-worker.js)
- 인프라 2종 (worker.js / wrangler.toml)

---

## 15. 기준 commit

- branch: `claude/heuristic-cori-7865e7`
- 이전 functional baseline: WS3 v0.16.0 transportExecutorInterfaceAdapter (`9eaffe5`)
- 본 commit: (Gate 3 push 후 기록)

---

## 16. 핵심 메모

```text
- v3/v3-transport-executor-sandbox-runner.js 신규 (1995 라인)
- DP-SANDBOX1 ~ DP-SANDBOX10 + N-SANDBOX-OBS-1 ~ N-SANDBOX-OBS-9 모두 적용 / 미해결 0건
- 보호 파일 29종 모두 무손상
- sandboxStatus 6 후보 first-match-wins (INVALID > BLOCKED > PARTIAL > READY > SKIPPED > UNKNOWN)
- 4 target sandbox: telegram / snapshot / evaluation / audit (각 17-stage AND ready)
- sandboxMode='SANDBOX_ONLY' 강제, liveExecutionAllowed=false 강제
- 9 boolean hard block (v0.16 8 + timerAllowed 신규)
- 5종 Preview (bindingResolver/driverCall/resultAdapter/errorAdapter/retry): 모두 SANDBOX_PREVIEW boolean false 강제
- sandboxFixture 허용 키 6종 (target/action/ok/status/errorType/reasonCode), 9-step 검증
- sandboxResult 허용 필드 8종 (simulated/resultType/target/action/ok/status/errorType/reasonCode)
- sandboxResult.ok 와 target.ready 분리 (N-SANDBOX-OBS-8) — SIMULATED_ERROR/SKIPPED 도 ready=true 가능
- target ↔ action 매핑 1:1 + ACTION_TARGET_MISMATCH 차단
- v0.16 pass-through 재검증 (rateLimitContract / circuitBreakerContract / dryRunResult)
- circuitBreaker.state='OPEN_IN_DRY_RUN' 강제. CLOSED/HALF_OPEN 절대 금지
- credential 9키 + env-like 11키 + function input 통합 차단
- RESERVED 프레임워크 metadata 24종 자동 차단 제외 (`credentialHandleRef` v0.16 field 포함 + v0.17 sandbox metadata 3종)
- validateLogicalRef v0.16 동일 (credential pattern 우선, EVAL 차단 / EVALUATION 허용)
- validateSandboxFixture 9-step 검증 (source 직접 검증 — extra key / nested object / function value 차단)
- 14 whitelist payloadSummary + metadata 기본 빈 배열, v0.16 재검증
- Object.assign / spread / JSON.parse(JSON.stringify) / for-in 코드 0건
- async / await / Promise / thenable / setTimeout / setInterval 코드 0건 (sync only)
- fetch / Telegram 실호출 / KV / DB / DOM / storage / clock API / process.env / globalThis 코드 0건
- sanitizeMode='REJECT' 기본 (15 금지 어휘 exact phrase substring match) + CREDENTIAL_IN_LINE_REJECTED
- smoke test 60 시나리오 / 134 assertion 전부 PASS
- 입력 mutation 0건 (DP-SANDBOX9, S52 frozen-input 검증)
- v0.18+ real executor 와 credential 인계 0건 (logical handle ref + sandboxPolicy 만 인계)
- sandboxResult.ok=true 를 LIVE 실행 결정 source 로 사용 금지 (audit/canary 자료)
- SIMULATED_OK / SIMULATED_ERROR / SIMULATED_SKIPPED 모두 LIVE 결정 source 아님
```
