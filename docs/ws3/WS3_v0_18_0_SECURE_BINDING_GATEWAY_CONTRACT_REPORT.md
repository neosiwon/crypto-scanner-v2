# WS3 v0.18.0 — Secure Binding Gateway Contract 완료 보고

**작성일**: 2026-05-17
**branch**: `claude/heuristic-cori-7865e7`
**이전 functional baseline**: WS3 v0.17.0 transportExecutorSandboxRunner (직전 단계)
**본 단계 산출**: `v3/v3-secure-binding-gateway-contract.js` (1종 신규, 1667 라인)

---

## 1. 단계 개요

- **SecureBindingGatewayContract 신규** (`WS3_SecureBindingGatewayContract`)
  - 입력 11종: `transportExecutorSandboxRunner` (v0.17.0) + `transportExecutorInterfaceAdapter` (v0.16.0) + `transportExecutorHarness` (v0.15.0) + `secureTransportExecutorContract` (v0.14.0) + `transportExecutionEnvelope` (v0.13.0) + `transportPlan` (v0.12.0) + `rendererBinding` (v0.12.0) + `operationPacket` (v0.8.0) + `activeCycleDecision` (v0.9.0) + `evaluationOutcome` (v0.10.0) + `externalConfluence` (v0.11.0)
  - 출력: standalone `SecureBindingGatewayContract` (CONTRACT_ONLY, secure binding boundary)
  - 4종 target gateway (telegramGateway / snapshotGateway / evaluationGateway / auditGateway)
- **버전**: `GATEWAY_VERSION = 'WS3_v0.18.0_secure_binding_gateway_contract'`
- **export 패턴**: `global.WS3_SecureBindingGatewayContract` + `module.exports` (이중 환경)
- **WS3 파이프라인 19단계 완성** — payload → … → transportExecutorSandboxRunner → **secureBindingGatewayContract**

---

## 2. 출력 top-level 구조

```text
valid                   boolean   transportExecutorSandboxRunner invalid 시 false
version                 string    'WS3_v0.18.0_secure_binding_gateway_contract'
gatewayMode             string    'CONTRACT_ONLY' 강제
liveExecutionAllowed    boolean   항상 false (DP-GATEWAY3/4 강제)
lookupAllowed           boolean   항상 false (DP-GATEWAY4/6/7 강제)
gatewayStatus           string    6 후보 (INVALID/BLOCKED/PARTIAL/READY/SKIPPED/UNKNOWN)
sourceSandboxStatus     string    input.transportExecutorSandboxRunner.sandboxStatus verbatim
gatewayPolicy           object    {contractOnly, lookupAllowed, sideEffectAllowed, credentialLookupAllowed, bindingLookupAllowed, fetchAllowed, writeAllowed, driverCallAllowed, retryAllowed, timerAllowed, envAccessAllowed, allowMaskedCredentialPreview, liveExecutionRequiresExplicitGate}
telegramGateway         object    {ready, target, contractOnly, lookupAllowed, sideEffectAllowed, bindingRef, credentialHandleRef, bindingScope, lookupPlan, bindingPolicy, sandboxResultRef, perTargetGate, rateLimitContract, circuitBreakerContract, blockedReasons, warnings}
snapshotGateway         object    동일 shape
evaluationGateway       object    동일 shape
auditGateway            object    동일 shape
gatewaySummary          object    {readyCount, blockedCount, skippedCount, hasReadyTarget, hasBlocker, liveGateRequired}
reasons, warnings, debug, configUsed
```

---

## 3. gatewayStatus 6 후보 + 우선순위 (§3.1)

| 우선순위 | 상태 | 조건 |
|---|---|---|
| 1 | `GATEWAY_INVALID` | transportExecutorSandboxRunner missing 또는 valid !== true / sandboxStatus === SANDBOX_INVALID |
| 2 | `GATEWAY_BLOCKED` | source SANDBOX_BLOCKED/INVALID / credential 감지 / env-like 감지 / depth 초과 / function input 감지 / gatewayMode !== CONTRACT_ONLY / 11 boolean hard block / invalid bindingRef / invalid credentialHandleRef / invalid bindingScope / invalid lookupPlan / invalid bindingPolicy / invalid sandboxResultRef / invalid rateLimitContract / invalid circuitBreakerContract |
| 3 | `GATEWAY_PARTIAL` | ≥1 ready true + ≥1 real blocker |
| 4 | `GATEWAY_READY` | source SANDBOX_READY/PARTIAL + ≥1 ready true + blocker 0 |
| 5 | `GATEWAY_SKIPPED` | source SANDBOX_SKIPPED 또는 모든 ready false + blocker 0 |
| 6 | `GATEWAY_UNKNOWN` | fallback |

---

## 4. target gateway ready 정책 — 17-stage AND

```text
transportExecutorSandboxRunner.<target>Sandbox.ready === true
&& cfg.targets.<target>.enabled === true
&& cfg.gatewayMode === 'CONTRACT_ONLY'
&& cfg.liveExecutionAllowed !== true
&& cfg.lookupAllowed !== true
&& cfg.sideEffectAllowed !== true
&& cfg.fetchAllowed !== true
&& cfg.writeAllowed !== true
&& cfg.credentialLookupAllowed !== true
&& cfg.bindingLookupAllowed !== true
&& cfg.driverCallAllowed !== true
&& cfg.retryAllowed !== true
&& cfg.timerAllowed !== true
&& cfg.envAccessAllowed !== true
&& 4 logical ref validation valid (bindingRef / credentialHandleRef / bindingScope / resolverRef)
&& lookupPlan valid
&& bindingPolicy valid
&& sandboxResultRef valid
&& rateLimitContract valid (pass-through, key=target match)
&& circuitBreakerContract valid (state='OPEN_IN_DRY_RUN' 강제)
```

**핵심**: ready=true 는 gateway contract 정합 의미. lookup/credential 인계/LIVE 실행 의미 X (DP-GATEWAY1/3/7).

---

## 5. 11 boolean hard block (DP-GATEWAY4)

v0.17 9개 + `lookupAllowed` + `envAccessAllowed` = **11개**

```text
liveExecutionAllowed / lookupAllowed / sideEffectAllowed / fetchAllowed /
writeAllowed / credentialLookupAllowed / bindingLookupAllowed / driverCallAllowed /
retryAllowed / timerAllowed / envAccessAllowed
```

→ 하나라도 true 일 시 **GATEWAY_BLOCKED**.

---

## 6. 5종 Contract field (per-gateway boundary)

| 필드 | 값 / 모양 | 정책 |
|---|---|---|
| `credentialHandleRef` | logical only — `TELEGRAM_CREDENTIAL_HANDLE` 등 4종 | logical handle, value 비포함 (DP-GATEWAY7) |
| `bindingScope` | logical only — `TELEGRAM_SEND_SCOPE` 등 4종 | scope ref, callable wrapper X |
| `lookupPlan` | `{ lookupMode:'FUTURE_RUNTIME_LOOKUP', lookupAllowed:false, resolverRef:'FUTURE_SECURE_BINDING_RESOLVER', resolved:false }` | 4 key whitelist exact (DP-GATEWAY7) |
| `bindingPolicy` | `{ required:true, valueExposed:false, valueMasked:false, valueLogged:false, valueStored:false, valuePreviewAllowed:false }` | 6 key whitelist (DP-GATEWAY5) |
| `sandboxResultRef` | `{ target, action, resultType:'SANDBOX_ONLY', simulated:true, status }` | **5 safe scalar only** — `ok / errorType / reasonCode / rawResponse / rawError / stack / body / headers / responseBody` 전부 제외 (DP-GATEWAY8 / N-GATEWAY-OBS-7) |

---

## 7. framework logical term 우회 알고리즘 (N-GATEWAY-OBS-4 / DP-GATEWAY7)

1. **allowList exact match → 통과** (10 framework refs 기본 박제)
2. 형식/길이/대문자/digit/forbidden substring/function token 체크
3. **CREDENTIAL_HANDLE / CREDENTIAL_HANDLE_REF 연속 substring → credential keyword 우회**
4. 그 외 credential keyword partial match → 차단

```text
허용:  TELEGRAM_CREDENTIAL_HANDLE              (CREDENTIAL_HANDLE 연속 substring 우회)
허용:  CUSTOM_CREDENTIAL_HANDLE_BINDING        (CREDENTIAL_HANDLE 연속 substring 우회)
허용:  SECURE_CREDENTIAL_HANDLE_REF            (allowList exact match)
차단:  TELEGRAM_SECRET_BINDING                 (credential keyword + 우회 자격 없음)
차단:  TELEGRAM_TOKEN_BINDING                  (credential keyword + 우회 자격 없음)
차단:  TELEGRAM_CREDENTIAL_BINDING             (CREDENTIAL 단독, HANDLE 미연속)
차단:  TELEGRAM_HANDLE_BINDING                 (HANDLE 단독, CREDENTIAL 미연속)
차단:  TELEGRAM_FUNCTION_BINDING               (FUNCTION token 차단)
차단:  TELEGRAM_EVAL_BINDING                   (EVAL token 차단)
허용:  EVALUATION_STORE_BINDING                (EVAL 미token, EVALUATION token)
```

EVAL vs EVALUATION 구별은 token-level (`_` split) 비교로 처리.

---

## 8. 10 framework refs 기본 logicalRefAllowList

```text
TELEGRAM_CREDENTIAL_HANDLE
SNAPSHOT_STORE_CREDENTIAL_HANDLE
EVALUATION_STORE_CREDENTIAL_HANDLE
AUDIT_STORE_CREDENTIAL_HANDLE
TELEGRAM_SEND_SCOPE
SNAPSHOT_WRITE_SCOPE
EVALUATION_WRITE_SCOPE
AUDIT_WRITE_SCOPE
SECURE_CREDENTIAL_HANDLE_REF
FUTURE_SECURE_BINDING_RESOLVER
```

---

## 9. RESERVED framework metadata 24종 자동 차단 제외 (N-GATEWAY-OBS-3)

```text
credentialAllowList, credentialAllowListSize, credentialMaxDepth, credentialDetections,
credentialDepthWarnings, credentialBlocked, credentialInPayloadAllowed,
credentialInEnvelopeAllowed, credentialSource, credentialPolicy,
credentialLookupAllowed, credentialHandleRef, blockCredentialFields,
allowWebhookUrl, allowDirectSecretAccess, directSecretAccessAllowed,
bindingRefAllowList, bindingRefAllowListSize, bindingRefCredentialPatternBlocked,
logicalRefAllowList, logicalRefAllowListSize,
logicalRefCredentialPatternBlocked, logicalRefFunctionPatternBlocked,
sandboxFixtureCredentialPatternBlocked, sandboxFixturePatternBlocked,
sandboxFixtureFunctionPatternBlocked
```

(`credentialHandleRef` 가 본 단계 모듈의 출력 필드이며 v0.14~v0.17 inheritance 와 정합 유지를 위해 RESERVED 등재.)

---

## 10. 20 forbidden wording (DP-GATEWAY8 + N-GATEWAY-OBS)

v0.17 inherited 15 + v0.18 신규 5 = **20개**:

```text
[v0.17 inherited 15]
발송됨, 저장됨, 전송 완료, completed transmission, sent, delivered,
매수 성공, 손절, 익절, 수익 확정, 손실 확정,
buy now, sell now, take profit, stop loss

[v0.18 신규 5 — lookup / credential loaded 어휘]
lookup 완료, resolved credential, credential loaded, secret loaded, token loaded
```

`sanitizeMode='REJECT'` 기본 — substring (case-insensitive) 매치 시 라인 제거 + warning push.
별도 검사 (lineContainsCredentialPattern / lineContainsMaskedPreviewTerm) 가 forbidden wording 체크보다 먼저 실행되어, credential / masked preview 어휘를 우선 차단.

---

## 11. 5 safe sandboxResultRef fields (DP-GATEWAY8 / N-GATEWAY-OBS-7)

```text
target / action / resultType / simulated / status
```

**제외**: `ok / errorType / reasonCode` (sandbox runner shape 의 다른 필드)
**금지**: `rawResponse / rawError / stack / body / headers / responseBody`

→ sandboxResult 전체 복사 금지. safe summary 5 scalar 만 추출.
→ `ok` 제외 사유: LIVE source 오해 위험 (N-SANDBOX-OBS-8 분리 원칙 계승).
→ `errorType / reasonCode` 제외 사유: raw error 누출 + sandbox 책임 외부 누설.

---

## 12. DP / N-OBS 처리 결과

### DP (10) — 모두 해소
- **DP-GATEWAY1** secure binding gateway contract only. 실제 credential lookup / env 접근 / binding resolver 호출 X.
- **DP-GATEWAY2** transportExecutorSandboxRunner ready/status/preview/sandboxResult override 0건.
- **DP-GATEWAY3** gatewayMode CONTRACT_ONLY only. LIVE / REAL / EXECUTE → GATEWAY_BLOCKED.
- **DP-GATEWAY4** 11 boolean hard block.
- **DP-GATEWAY5** credential value / masked / first-4 / last-4 / preview 전부 output 금지.
- **DP-GATEWAY6** env 접근 0건. env-like → 즉시 GATEWAY_BLOCKED.
- **DP-GATEWAY7** bindingRef / credentialHandleRef / bindingScope / resolverRef logical only. CREDENTIAL_HANDLE / CREDENTIAL_HANDLE_REF framework 우회만 허용.
- **DP-GATEWAY8** sandboxResultRef 5 safe scalar. ok / errorType / reasonCode 제외.
- **DP-GATEWAY9** 11종 입력 read-only.
- **DP-GATEWAY10** 신규 파일 1개 + 문서 갱신만. 보호 파일 30종 수정 금지.

### N-OBS (8) — 모두 처리
- **N-GATEWAY-OBS-1** 신규 식별자 fresh (Gateway / GATEWAY_xxx / buildXxxGateway / credentialHandleRef / bindingScope / lookupPlan / bindingPolicy / sandboxResultRef).
- **N-GATEWAY-OBS-2** v0.17 sandbox runner shape 정합. override 0건.
- **N-GATEWAY-OBS-3** RESERVED 24종 자동 차단 제외 + 5종 contract field 박제.
- **N-GATEWAY-OBS-4** framework logical term 우회 알고리즘 (allowList → CREDENTIAL_HANDLE substring → keyword 차단).
- **N-GATEWAY-OBS-5** 11 boolean hard block (v0.17 9 + lookupAllowed + envAccessAllowed).
- **N-GATEWAY-OBS-6** masked / redacted / first-4 / last-4 / credential preview 출력 0건.
- **N-GATEWAY-OBS-7** sandboxResultRef safe summary 5 fields.
- **N-GATEWAY-OBS-8** 보호 파일 30종 무손상 (v0.17 v3-transport-executor-sandbox-runner.js 신규 추가).

---

## 13. 보호 파일 (수정 0건 — 30종)

```text
index.html, manifest.json, service-worker.js, worker.js, wrangler.toml

/v3/v3-config.js
/v3/v3-feature-payload.js
/v3/v3-bithumb-client.js
/v3/v3-candle-normalizer.js
/v3/v3-indicators.js
/v3/v3-feature-payload-builder.js
/v3/v3-score-breakdown.js
/v3/v3-structure-bucket.js
/v3/v3-signal-cycle.js
/v3/v3-strategy-plan.js
/v3/v3-card-view-model.js
/v3/v3-operation-packet.js
/v3/v3-active-cycle.js
/v3/v3-evaluation-outcome.js
/v3/v3-evaluation-observation-adapter.js
/v3/v3-external-confluence.js
/v3/v3-transport-plan.js
/v3/v3-renderer-binding.js
/v3/v3-transport-execution-adapter.js
/v3/v3-secure-transport-executor-contract.js
/v3/v3-transport-executor-harness.js
/v3/v3-transport-executor-interface-adapter.js
/v3/v3-transport-executor-sandbox-runner.js
/docs/ws3/WS3_CODE_CONTRACT.md (b-r2 박제본)
/docs/ws3/WS3_WORKFLOW_TEMPLATE.md (v0.1 박제본)
```

`git diff --stat HEAD -- <protected paths>` = 빈 출력 = 0건 확인.

---

## 14. smoke test 결과 (66 시나리오)

```
TOTAL=66 PASS=66 FAIL=0
```

| 그룹 | 시나리오 |
|---|---|
| S1~S5 | gateway READY / SKIPPED / INVALID(no runner) / INVALID(runner valid=false) / BLOCKED(source SANDBOX_BLOCKED) |
| S6~S13 | credential botToken / secret / apiKey / env / bindings / kv / function input / promise input |
| S14~S16 | gatewayMode LIVE / REAL / EXECUTE |
| S17~S27 | 11 boolean hard block (liveExec / lookup / sideEffect / fetch / write / credLookup / bindLookup / driverCall / retry / timer / envAccess) |
| S28~S29 | PARTIAL / invalid sandbox valid=false |
| S30~S33 | credentialHandleRef 4 target 매핑 |
| S34~S35 | bindingScope 매핑 |
| S36~S37 | lookupPlan / bindingPolicy fixed values |
| S38~S39 | sandboxResultRef 5 safe fields + target/action 매핑 |
| S40 | gatewayPolicy fixed values |
| S41~S43 | top-level lookupAllowed=false / liveExecutionAllowed=false / gatewayMode=CONTRACT_ONLY |
| S44~S47 | bindingRef invalid (url / lowercase / bot[0-9]+ / digit-only) |
| S48~S53 | framework bypass + credential keyword 차단 + EVAL/EVALUATION token-level |
| S54~S56 | rateLimit / circuit breaker 무효 |
| S57 | target disable |
| S58~S59 | configUsed scalar / debug counters |
| S60~S61 | RESERVED 필드 + framework allowList 정합 |
| S62~S64 | sanitizeMessageLines — credential / masked / lookup 완료 / credential loaded |
| S65 | framework bypass substring 통과 (CUSTOM_CREDENTIAL_HANDLE_BINDING) |
| S66 | sandboxResultRef raw 누출 0건 (rawResponse / body / headers) |

→ 모두 PASS. smoke 파일은 검증 후 삭제 완료.

---

## 15. 금지 패턴 grep 결과

| 검색 | 결과 | 비고 |
|---|---|---|
| `fetch` (실제 함수) | 0건 | 코드 영역 |
| `Date.now` | 0건 | |
| `new Date` | 0건 | |
| `async \| await` | 0건 | |
| `Promise` | 0건 | thenable 차단 코드 외 |
| `setTimeout / setInterval` | 0건 | |
| `Object.assign` | 0건 | field-by-field copy 사용 |
| spread `...` | 0건 | |
| `JSON.parse(JSON.stringify` | 0건 | |
| `for ... in` | 0건 | for/Object.keys + index loop |
| `document.` | 0건 | |
| `window.<member>` | 0건 | bootstrap 의 `typeof window` 만 |
| `process.env` | 0건 | |
| URL / token / secret 노출 어휘 | 0건 | |

본 모듈은 100% sync, side-effect-free.

---

## 16. 기준 commit

- branch: `claude/heuristic-cori-7865e7`
- 이전 functional baseline: WS3 v0.17.0 transportExecutorSandboxRunner
- 본 commit: (push 후 기록)
