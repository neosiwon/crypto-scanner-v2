# WS3 v0.14.0 — Secure Transport Executor Contract 완료 보고

**작성일**: 2026-05-17
**branch**: `claude/heuristic-cori-7865e7`
**이전 functional baseline**: WS3 v0.13.0 transportExecutionEnvelope (`5d05836`)
**본 단계 산출**: `v3/v3-secure-transport-executor-contract.js` (1종 신규)

---

## 1. 단계 개요

- **SecureTransportExecutorContract 신규** (`WS3_SecureTransportExecutorContract`)
  - 입력 7종: `transportExecutionEnvelope` (v0.13.0) + `transportPlan` (v0.12.0) + `rendererBinding` (v0.12.0) + `operationPacket` (v0.8.0) + `activeCycleDecision` (v0.9.0) + `evaluationOutcome` (v0.10.0) + `externalConfluence` (v0.11.0)
  - 출력: standalone `SecureTransportExecutorContract` (CONTRACT_ONLY, contract-only)
  - 4종 target contract (telegramContract / snapshotContract / evaluationContract / auditContract)
- **버전**: `SECURE_CONTRACT_VERSION = 'WS3_v0.14.0_secure_transport_executor_contract'`
- **export 패턴**: `global.WS3_SecureTransportExecutorContract` + `module.exports` (이중 환경)
- **WS3 파이프라인 15단계 완성** — payload → ... → transportExecutionEnvelope → **secureTransportExecutorContract**

---

## 2. 출력 top-level 구조

```text
valid                 boolean   transportExecutionEnvelope invalid 시 false
version               string    'WS3_v0.14.0_secure_transport_executor_contract'
contractMode          string    'CONTRACT_ONLY' 강제
liveExecutionAllowed  boolean   항상 false (DP-SEC3 강제)
contractStatus        string    6 후보 (INVALID/BLOCKED/PARTIAL/READY/SKIPPED/UNKNOWN)
sourceEnvelopeStatus  string    input.transportExecutionEnvelope.envelopeStatus verbatim
secureBindingPolicy   object    {credentialSource, credentialIn*Allowed, envReadAllowed, ...}
telegramContract      object    {ready, target, contractOnly, bindingRequired, bindingRef, credentialPolicy, requestShape, blockedReasons, warnings}
snapshotContract      object    동일 shape
evaluationContract    object    동일 shape
auditContract         object    동일 shape
contractSummary       object    {readyCount, blockedCount, skippedCount, hasReadyTarget, hasBlocker, liveGateRequired}
reasons               string[]
warnings              string[]
debug                 object    {source, configVersion, invalidEnvelope, credentialBlocked, envLikeBlocked, depthBlocked, bindingRefCredentialPatternBlocked, modeBlocked, liveBlocked, ...}
configUsed            object    cfg 스냅샷 (scalar / shallow safe)
```

---

## 3. contractStatus 6 후보 + 우선순위 (§4)

| 우선순위 | 상태 | 조건 |
|---|---|---|
| 1 | `CONTRACT_INVALID` | transportExecutionEnvelope missing 또는 valid !== true |
| 2 | `CONTRACT_BLOCKED` | source ENVELOPE_BLOCKED / credential 감지 / env-like 감지 / depth 초과 / bindingRef credential pattern / contractMode !== CONTRACT_ONLY / liveExecutionAllowed === true |
| 3 | `CONTRACT_PARTIAL` | ≥1 ready true AND ≥1 real blocker |
| 4 | `CONTRACT_READY` | source ENVELOPE_READY/PARTIAL AND ≥1 ready true AND blocker 0 |
| 5 | `CONTRACT_SKIPPED` | source ENVELOPE_SKIPPED 또는 모든 ready false + blocker 0 |
| 6 | `CONTRACT_UNKNOWN` | fallback |

- `classifyContractStatus(contracts, safety, cfg)` first-match-wins
- `buildContractSummary` 가 `pure SOURCE_ENVELOPE_NOT_READY` vs `real blocker` 구분

---

## 4. target contract ready 정책 (§6)

| target | ready 조건 |
|---|---|
| **telegramContract** | `transportExecutionEnvelope.telegramEnvelope.eligible === true && telegramEnvelope.status === 'ENVELOPE_READY' && cfg.targets.telegram.enabled === true && validateBindingRef(...).valid === true && cfg.contractMode === 'CONTRACT_ONLY' && cfg.liveExecutionAllowed !== true` |
| **snapshotContract** | 동일 패턴, source = snapshotEnvelope |
| **evaluationContract** | 동일 패턴, source = evaluationEnvelope |
| **auditContract** | 동일 패턴, source = auditEnvelope |

**핵심**: DP-SEC2 — transportExecutionEnvelope eligible/status 결정을 절대 true override 안 함.

---

## 5. validateBindingRef 정책 (§7 / DP-SEC5)

### 형식 규칙
- `typeof === 'string'`
- length 3~64
- 정규식 `^[A-Z][A-Z0-9_]*$` (UPPER_SNAKE_CASE only)

### 금지 substring (literal)
```text
http, https, ://, www., :, /, ., -, @, sk-, xoxb-, xoxp-, eyJ
```

### 금지 패턴 (정규식)
- `bot[0-9]+` (Telegram bot prefix)
- digit-only string

### credential pattern detection
- 9키 (secret/token/chatid/bottoken/apikey/authorization/password/credential/webhookurl) case-insensitive partial match

### allowList (U-SEC-equivalent)
- `cfg.safety.bindingRefAllowList = []` 기본
- exact string match 시 모든 검증 skip (운영 단계 fine-tuning 용)

### 허용 예 ✓
```text
TELEGRAM_SECURE_BINDING, KV_SNAPSHOT_BINDING, EVALUATION_STORE_BINDING, AUDIT_STORE_BINDING
```

### 금지 예 ⛔
```text
bot123456:ABC..., https://api.telegram.org/..., sk-..., xoxb-..., 123456789,
SECRET_KEY_BINDING, TOKEN_REF, APIKEY_REF
```

---

## 6. credential / env recursive 차단 정책 (§8 / DP-SEC4)

### credential 9키 (lower-case partial match)
```text
secret, token, chatid, bottoken, apikey, authorization, password, credential, webhookurl
```

### 검사 범위
- input / config 의 모든 nested object 재귀 검사
- case-insensitive + partial substring match
- depth limit `cfg.safety.credentialMaxDepth` (기본 5)
- scalar leaf 는 depth 무관 안전 (N-SEC-OBS-4 보강)
- `cfg.safety.credentialAllowList` 기본 빈 배열 — exact key 명시 시 차단 제외

### RESERVED 프레임워크 metadata 자동 차단 제외 (N-SEC-OBS-4)
v0.13.0 envelope output / v0.14.0 contract output 의 정책 metadata 자체 식별자는 credential keyword substring 을 포함하지만 실제 credential 가 아니므로 `isCredentialKey` 가 exact match 로 먼저 제외:
```text
credentialAllowList, credentialAllowListSize, credentialMaxDepth,
credentialDetections, credentialDepthWarnings, credentialBlocked,
credentialInPayloadAllowed, credentialInEnvelopeAllowed,
credentialSource, credentialPolicy,
allowWebhookUrl, allowDirectSecretAccess,
bindingRefAllowList, bindingRefAllowListSize,
bindingRefCredentialPatternBlocked, blockCredentialFields
```

### env-like object 차단 (DP-SEC4)
- key exact match + value is object 조건만 차단 (r0.2 false-positive 완화)
- 차단 키: `env / ENV / environment / bindings / cfEnv / cloudflareEnv / secrets / kvNamespace / kv / KV / process`
- 감지 시 value 를 enumerate 하지 않음
- output 에 env-like key/value 절대 노출 0건

### 차단 결과
- 1건이라도 감지 시: `contractStatus = CONTRACT_BLOCKED`, 모든 target ready=false, `SECRET_FIELD_BLOCKED:<path>` / `ENV_LIKE_OBJECT_DETECTED:<path>` warnings
- path 에는 key 이름과 위치만, value 절대 노출 0건 (S7/S8/S13 검증)

---

## 7. requestShape / payloadSummary / metadata 정책 (§9 / DP-SEC6)

### whitelist scalar only
- `cfg.requestShape.payloadSummaryAllowedFields` 14종 default (candidateKey, base, quote, market, exchange, timeframe, messageType, snapshotType, evaluationType, resultType, auditType, displayMode, confluenceLabel, confluenceScore)
- `cfg.requestShape.metadataAllowedFields` 기본 빈 배열

### v0.13 envelope 재검증 (DP-SEC6 — 신뢰 X)
- `buildSafePayloadSummary` IIFE module-private (N-SEC-OBS-3) — v0.13 envelope.payloadSummary 를 그대로 신뢰 X. v0.14 whitelist 로 재검증.
- `buildSafeMetadata` 동일 패턴

### 금지 구현 패턴 (DP-SEC6)
- `Object.assign(target, source)` — 0건 ✅
- `{ ...source }` spread — 0건 ✅
- `JSON.parse(JSON.stringify(source))` — 0건 ✅
- `for (var k in source)` — 0건 ✅

---

## 8. message wording 정책 (§10 / DP-SEC7)

- 15 금지 어휘 (v0.13 동일): `발송됨 / 저장됨 / 전송 완료 / completed transmission / sent / delivered / 매수 성공 / 손절 / 익절 / 수익 확정 / 손실 확정 / buy now / sell now / take profit / stop loss`
- `sanitizeMode='REJECT'` 기본 — line 제거 + `FORBIDDEN_WORD_LINE_REJECTED:<word>` warning
- `REPLACE` / `WARN_ONLY` 옵션 (v0.13 와 동일 3 모드)

---

## 9. LIVE 실행 gate 정책 (§12 / DP-SEC3)

- `DEFAULT_CONFIG.contractMode = 'CONTRACT_ONLY'` 고정
- `DEFAULT_CONFIG.liveExecutionAllowed = false`
- `contractMode !== 'CONTRACT_ONLY'` → CONTRACT_BLOCKED (S5 검증)
- `liveExecutionAllowed === true` → CONTRACT_BLOCKED (S6 검증)
- v0.15+ real executor 에서만 별도 explicit gate 부여

---

## 10. v0.14 ↔ v0.15 인터페이스 분리 (§5 / DP-SEC4-5)

### v0.14 가 출력하는 것 (logical reference only)
- `bindingRef` — UPPER_SNAKE_CASE logical 식별자 (TELEGRAM_SECURE_BINDING 등)
- `requestShape` — whitelist scalar payload (channelRef, bucketRef, messageType, ... + payloadSummary + metadata)
- `secureBindingPolicy` — credentialSource='SECURE_BINDING_ONLY', envReadAllowed=false 등 5종 boolean policy

### v0.14 가 절대 출력하지 않는 것
- credential value (botToken / chatId / apiKey 등 — output 모두 sanitize)
- 실제 URL / endpoint (api.telegram.org 등)
- env object / process.env / globalThis.bindings
- raw payload / payload.raw / identityInput / raw.builderDebug

### v0.15+ real executor 책임
- secure binding lookup (Cloudflare env / KMS / secret store 등) — v0.14 envelope 에는 절대 포함 X
- 실제 fetch / Telegram bot API / KV write / DB write
- LIVE_EXECUTION explicit gate (별도 단계에서 정의)

---

## 11. 적용 DP / N-SEC-OBS 정리

| ID | 적용 결과 |
|---|---|
| **DP-SEC1** | secure executor contract 만. `contractMode='CONTRACT_ONLY'` + `liveExecutionAllowed=false` 강제. 실제 발송/저장/호출 0건 |
| **DP-SEC2** | transportExecutionEnvelope eligible/status override 0건. boolean AND 집계만 |
| **DP-SEC3** | LIVE/REAL/EXECUTE → CONTRACT_BLOCKED (S5/S6 검증) |
| **DP-SEC4** | credential 9키 + env-like exact-match + depth limit. process.env / globalThis.env 코드 0건 |
| **DP-SEC5** | bindingRef logical only. `validateBindingRef` 정규식 + 금지 substring + credential pattern + allowList |
| **DP-SEC6** | requestShape / payloadSummary / metadata whitelist scalar. Object.assign / spread / clone / for-in 0건. v0.13 재검증 |
| **DP-SEC7** | dry-run wording only. `sanitizeMode='REJECT'` 기본 |
| **DP-SEC8** | fetch / Telegram / KV / DB / DOM / storage / clock 코드 0건 |
| **DP-SEC9** | 7종 입력 read-only (S24 frozen-input 검증) |
| **DP-SEC10** | 신규 파일 1개 + 문서 갱신만. 보호 파일 24종 무손상 |
| **N-SEC-OBS-1** | 보호 baseline false-positive — 본 모듈 fetch / Date.now / Object.assign / spread / clone / for-in 0건 |
| **N-SEC-OBS-2** | `payloadSummaryAllowedFields` namespace — v0.13 (`cfg.payloadSummary.allowedFields`) vs v0.14 (`cfg.requestShape.payloadSummaryAllowedFields`) namespace 분리 |
| **N-SEC-OBS-3** | `buildSafePayloadSummary` 동명 — IIFE module-private, global export 미포함. v0.13 과 파일 scope 분리 |
| **N-SEC-OBS-4** | RESERVED 프레임워크 metadata 키 자동 차단 제외 — 16종 정책 metadata 식별자 (credentialMaxDepth / credentialAllowList / allowWebhookUrl / bindingRefAllowList 등) `isCredentialKey` exact match 사전 검사 |

---

## 12. 함수 목록 (§12 spec)

```text
[Entry / Config]
  mergeSecureTransportExecutorContractConfig(config)
  buildSecureTransportExecutorContract(input, config)   ← 진입점

[Target contract builders]
  buildTelegramContract(input, cfg)
  buildSnapshotContract(input, cfg)
  buildEvaluationContract(input, cfg)
  buildAuditContract(input, cfg)

[Shape / summary / classification]
  buildSafeRequestShape(envelope, target, cfg)
  buildSafePayloadSummary(input, cfg)        ← IIFE module-private
  buildSafeMetadata(input, cfg)              ← IIFE module-private
  buildContractSummary(contracts, cfg)
  classifyContractStatus(contracts, safety, cfg)

[Credential / env / wording / binding]
  detectCredentialFields(input, config)
  detectEnvLikeObjects(input, config)
  isCredentialKey(keyName, allowList)
  isEnvLikeKey(keyName)
  sanitizeMessageLines(lines, cfg)
  validateBindingRef(bindingRef, cfg)

[Normalize / helpers]
  normalizeContractTarget(target, cfg)
  normalizeSecureTransportExecutorContract(result)
  isPlainObject, safeString, safeNumber, pushReason, pushWarning
```

---

## 13. smoke test 26 시나리오 (모두 통과 / 82 assertion ALL PASS)

| # | 시나리오 | 검증 |
|---|---|---|
| S1 | contract ready all targets | CONTRACT_READY + 4 target ready=true |
| S2 | contract skipped (envelope SKIPPED) | CONTRACT_SKIPPED |
| S3 | contract invalid (envelope null/valid:false) | CONTRACT_INVALID |
| S4 | contract blocked by source ENVELOPE_BLOCKED | CONTRACT_BLOCKED |
| S5 | contract blocked LIVE mode | CONTRACT_BLOCKED |
| S6 | contract blocked liveExecutionAllowed=true | CONTRACT_BLOCKED |
| S7 | credential blocked top-level | BOTTOKEN_DO_NOT_LEAK 0 노출, SECRET_FIELD_BLOCKED |
| S8 | credential blocked nested | SECRET_DO_NOT_LEAK 0 노출, BLOCKED |
| S9 | bindingRef validation safe | TELEGRAM_SECURE_BINDING / KV_SNAPSHOT_BINDING / AUDIT_STORE_BINDING valid |
| S10 | bindingRef URL/dot/colon 차단 | https://, www., api.tele 모두 reject |
| S11 | bindingRef token-like 차단 | sk-, xoxb-, xoxp-, bot[0-9]+, eyJ 모두 reject |
| S12 | bindingRef credential pattern 차단 | TOKEN_REF / SECRET_KEY_BINDING / APIKEY_REF reject |
| S13 | env-like object 차단 | input.env / config.bindings / config.cloudflareEnv 모두 BLOCKED + ENV_LIKE_OBJECT_DETECTED + value 0 노출 |
| S14 | object too deep blocked | depth > 5 nested object → CONTRACT_BLOCKED + OBJECT_TOO_DEEP_BLOCKED |
| S15 | telegram contract shape | ready=true, channelRef=SECURE_CHANNEL_REF, contractOnly, bindingRequired, credentialPolicy=NEVER_IN_PAYLOAD |
| S16 | snapshot contract shape | ready=true, bucketRef=SECURE_BUCKET_REF, bindingRef=KV_SNAPSHOT_BINDING |
| S17 | evaluation contract shape | ready=true, evaluationType scalar, bindingRef=EVALUATION_STORE_BINDING |
| S18 | audit contract shape | ready=true, auditType scalar, bindingRef=AUDIT_STORE_BINDING |
| S19 | payloadSummary revalidation | v0.13 nestedUnsafe / bogusField stripped |
| S20 | metadata revalidation | default empty / safeField copied / unsafeNested skipped / leak_attempt 0 노출 |
| S21 | wording sanitize REJECT | '발송됨' / 'sent' line 제거 + FORBIDDEN_WORD_LINE_REJECTED warning |
| S22 | no env access | no exception, no env read |
| S23 | no side-effect | multiple builds no exception |
| S24 | mutation check | frozen input / JSON before-after 동일 |
| S25 | raw/secret leak | INNER_SECRET (non-credential nested) 0 노출 |
| S26 | v0.15 interface separation | process.env / globalThis.env / api.telegram.org / sk-/xoxb-/eyJ 0 노출. TELEGRAM_SECURE_BINDING / KV_SNAPSHOT_BINDING logical reference 만 노출. secureBindingPolicy 5 boolean 검증 |

**총 assertion 82건 / 82 PASS** ✅

---

## 14. 금지 패턴 grep 결과

| 영역 | 매치 분류 |
|---|---|
| A. side-effect API (`fetch( / KV. / DB / Telegram / sendTelegram / XMLHttpRequest / innerHTML / document. / addEventListener / localStorage / sessionStorage / Date.now( / new Date / performance.now`) | 매치 11건 — 모두 JSDoc 정책 + 함수명 (`buildTelegramContract`). **실제 API 호출 0건** |
| B. 입력 mutation (`transportExecutionEnvelope.X = / transportPlan.X = / rendererBinding.X = / operationPacket.X = / activeCycleDecision.X = / evaluationOutcome.X = / externalConfluence.X =`) | **0건** ✅ DP-SEC9 |
| process.env / globalThis.env / globalThis.bindings / globalThis.secrets / typeof process / typeof globalThis | **0건** ✅ DP-SEC4 (2 매치는 JSDoc 정책 명시) |
| spread / clone / for-in (`Object.assign / .{3} / JSON.parse(JSON.stringify) / for-in`) | 매치 3건 — 모두 JSDoc 정책 라인. **실제 사용 0건** ✅ DP-SEC6 |
| env-like keys (`env / ENV / environment / bindings / cfEnv / cloudflareEnv / secrets / kvNamespace / kv / KV / process`) | 매치는 (1) JSDoc 정책 + (2) `ENV_LIKE_KEYS_EXACT` literal array 정의 + (3) `KV_SNAPSHOT_BINDING` constant + (4) local var `env` (v0.13 envelope variable). **실제 env 접근 0건** |
| trading + transmission (`발송됨 / 저장됨 / 전송 완료 / sent / delivered / completed transmission / 매수 성공 / 손절 / 익절 / 수익 확정 / 손실 확정 / buy now / sell now / take profit / stop loss`) | 매치 다수 — 모두 (1) JSDoc 정책 + (2) `FORBIDDEN_WORDS` literal array + (3) `getSafeReplacement` 매핑. **실제 어휘 출력 사용 0건** ✅ DP-SEC7 |

---

## 15. 보호 파일 diff 0건 확인 (24종)

```bash
git diff --stat HEAD -- <24 protected files>
→ 빈 출력
```

### 보호 파일 24종 (수정 0건)
```
v3 *.js 19종:
  v3-config / v3-feature-payload / v3-bithumb-client / v3-candle-normalizer /
  v3-indicators / v3-feature-payload-builder / v3-score-breakdown / v3-structure-bucket /
  v3-signal-cycle / v3-strategy-plan / v3-card-view-model / v3-operation-packet /
  v3-active-cycle / v3-evaluation-outcome / v3-evaluation-observation-adapter /
  v3-external-confluence / v3-transport-plan / v3-renderer-binding /
  v3-transport-execution-adapter

문서 2종 (수정 0건):
  docs/ws3/WS3_CODE_CONTRACT.md (b-r2 박제본 그대로)
  docs/ws3/WS3_WORKFLOW_TEMPLATE.md (v0.1 박제본 그대로)

루트 3종 (수정 0건):
  index.html / manifest.json / service-worker.js

인프라 2종 (수정 0건):
  worker.js / wrangler.toml
```

---

## 16. 기준 commit

- branch: `claude/heuristic-cori-7865e7`
- 이전 functional baseline: WS3 v0.13.0 transportExecutionEnvelope (`5d05836`)
- 본 commit: (Gate 3 push 후 기록)

---

## 17. 핵심 메모

```text
- v3/v3-secure-transport-executor-contract.js 신규 (1595 라인)
- DP-SEC1 ~ DP-SEC10 + N-SEC-OBS-1 ~ N-SEC-OBS-4 모두 적용 / 미해결 항목 0건
- 보호 파일 24종 모두 무손상 (v3 *.js 19종 + index/manifest/sw 3종 + CODE_CONTRACT + WORKFLOW_TEMPLATE)
- contractStatus 6 후보 first-match-wins (INVALID > BLOCKED > PARTIAL > READY > SKIPPED > UNKNOWN)
- 4 target contract: telegram / snapshot / evaluation / audit (각 5-stage AND ready)
- contractMode='CONTRACT_ONLY' 강제, liveExecutionAllowed=false 강제
- credential 9키 재귀 차단 (case-insensitive + partial + depth 5, scalar leaf 안전)
- RESERVED 프레임워크 metadata 키 16종 자동 차단 제외 (N-SEC-OBS-4)
- env-like 11키 exact match + value object 조건 차단 (r0.2 false-positive 완화)
- bindingRef logical reference only — `^[A-Z][A-Z0-9_]*$` + 13 금지 substring + bot[0-9]+ + digit-only + credential partial match + allowList
- payloadSummary 14 whitelist scalar only + metadata 기본 빈 배열
- Object.assign / spread / JSON.parse(JSON.stringify) / for-in 코드 0건
- sanitizeMode='REJECT' 기본 (15 금지 어휘 차단)
- smoke test 26 시나리오 / 82 assertion 전부 PASS
- 입력 mutation 0건 (DP-SEC9, S24 frozen-input 검증)
- fetch / Telegram 실호출 / KV / DB / DOM / storage / clock API / process.env / globalThis 코드 0건
- v0.15+ real executor 와 credential 인계 0건 (bindingRef logical + secureBindingPolicy 만 인계)
```
