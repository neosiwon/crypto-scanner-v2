# WS3 v0.13.0 — Transport Execution Envelope 완료 보고

**작성일**: 2026-05-17
**branch**: `claude/heuristic-cori-7865e7`
**이전 functional baseline**: WS3 v0.12.0 adapterOutputContractPack (`8fd0551`)
**본 단계 산출**: `v3/v3-transport-execution-adapter.js` (1종 신규)

---

## 1. 단계 개요

- **TransportExecutionAdapter 신규** (`WS3_TransportExecutionAdapter`)
  - 입력 6종: `transportPlan` / `rendererBinding` / `operationPacket` / `activeCycleDecision` / `evaluationOutcome` / `externalConfluence`
  - 출력: standalone `TransportExecutionEnvelope` (dry-run safe envelope)
  - 4종 envelope candidate (telegramEnvelope / snapshotEnvelope / evaluationEnvelope / auditEnvelope)
- **버전**: `TRANSPORT_EXECUTION_VERSION = 'WS3_v0.13.0_transport_execution_envelope'`
- **export 패턴**: `global.WS3_TransportExecutionAdapter` + `module.exports` (이중 환경)
- **WS3 파이프라인 14단계 완성** — featurePayload → score → structure → cycle → strategy → card → packet → cycle → outcome → observationAdapter → confluence → transportPlan → rendererBinding → **transportExecutionEnvelope**

---

## 2. 출력 top-level 구조

```text
valid              boolean   transportPlan invalid 시 false
version            string    'WS3_v0.13.0_transport_execution_envelope'
dryRun             boolean   항상 true (DP-TX1 강제)
envelopeMode       string    'DRY_RUN' 강제 (LIVE/REAL/SEND → BLOCKED)
envelopeStatus     string    6 후보 (INVALID/BLOCKED/PARTIAL/READY/SKIPPED/UNKNOWN)
telegramEnvelope   object    {eligible, dryRunOnly, status, request, blockedReasons, warnings}
snapshotEnvelope   object    동일 shape
evaluationEnvelope object    동일 shape
auditEnvelope      object    동일 shape
envelopeSummary    object    {readyCount, skippedCount, blockedCount, hasEligibleCandidate, hasBlocker}
reasons            string[]
warnings           string[]
debug              object    {source, configVersion, invalidPlan, modeBlocked, credentialBlocked, ...}
configUsed         object    cfg 스냅샷 (scalar / shallow safe)
```

---

## 3. envelopeStatus 6 후보 + 우선순위 (§4)

| 우선순위 | 상태 | 조건 |
|---|---|---|
| 1 | `ENVELOPE_INVALID` | transportPlan 자체가 missing 또는 valid !== true |
| 2 | `ENVELOPE_BLOCKED` | envelopeMode !== 'DRY_RUN' OR dryRunOnly !== true OR credential 감지 |
| 3 | `ENVELOPE_PARTIAL` | ≥1 eligible true AND ≥1 envelope 에 real-blocker 존재 |
| 4 | `ENVELOPE_READY` | ≥1 eligible true AND blocker 0건 |
| 5 | `ENVELOPE_SKIPPED` | eligible 0 AND real-blocker 0 (단순 plan-false) |
| 6 | `ENVELOPE_UNKNOWN` | fallback |

- `classifyEnvelopeStatus(envelopes, safety, cfg)` 함수에서 first-match-wins 로 적용
- `buildEnvelopeSummary` 가 `pure plan-false (NOT_ELIGIBLE_PLAN_FALSE)` vs `real-blocker` 를 구분하여 SKIPPED vs BLOCKED 분리

---

## 4. envelope eligible 정책 (§5)

| envelope | eligible 조건 |
|---|---|
| **telegramEnvelope** | `transportPlan.telegramPlan.shouldSend === true && config.execution.allowTelegram === true && envelopeMode === 'DRY_RUN'` |
| **snapshotEnvelope** | `transportPlan.snapshotPlan.shouldStore === true && config.execution.allowSnapshot === true && envelopeMode === 'DRY_RUN'` |
| **evaluationEnvelope** | `(shouldStore OR shouldUpdate OR shouldClose OR shouldReview) && config.execution.allowEvaluation === true && envelopeMode === 'DRY_RUN'` |
| **auditEnvelope** | `transportPlan.auditPlan.shouldAudit === true && config.execution.allowAudit === true && envelopeMode === 'DRY_RUN'` |

**핵심**: DP-TX2 — TransportPlan 의 false 결정은 절대 true 로 override 하지 않음. 본 모듈은 boolean AND 집계만 수행.

---

## 5. credential 차단 정책 (§7 / DP-TX4 / U-TX-1)

### 금지 키 9종 (lower-case base — case-insensitive + partial 차단)

```text
secret, token, chatid, bottoken, apikey, authorization, password, credential, webhookurl
```

### 검사 범위
- `detectCredentialFields(input, config)` — input / config 의 모든 nested object 재귀 검사
- depth limit: `cfg.safety.credentialMaxDepth` (기본 5)
- depth 초과 시 warning `DETECTION_DEPTH_LIMIT:<path>` 추가
- partial match 안전 우선 차단 — `apiKeyHash` / `tokenSalt` / `userSecret` 등 정상 키도 차단
- `cfg.safety.credentialAllowList` 기본 빈 배열 (운영 단계에서 명시 시만 차단 제외)

### 차단 결과
- 1건이라도 발견 시: 모든 envelope BLOCKED + warnings `SECRET_FIELD_BLOCKED:<path>`
- **path 에는 key 이름과 위치만 노출. value 는 절대 노출 0건** (S6/S7/S15/S21 검증)

---

## 6. payloadSummary / metadata 정책 (§8 / DP-TX5)

### whitelist scalar only
```text
candidateKey, base, quote, market, exchange, timeframe,
messageType, snapshotType, evaluationType, resultType, auditType,
displayMode, confluenceLabel, confluenceScore
```

### 복사 규칙
1. `cfg.payloadSummary.allowedFields` whitelist 만 복사
2. value 검증: string (`length <= maxStringLength`) / number (`isFinite`) / boolean / null/undefined → null
3. object / function / symbol → skip + warning `NON_SCALAR_VALUE_SKIPPED`
4. nested object 복사 0건
5. credential 검출 시 해당 field skip

### 금지 구현 패턴 (DP-TX5)
- `Object.assign(target, source)` — 0건 ✅
- `{ ...source }` spread — 0건 ✅
- `JSON.parse(JSON.stringify(source))` — 0건 ✅
- `for (var key in source)` — 0건 ✅
- 원본 6종 입력 전체 spread / 전체 복사 — 0건 ✅

### metadata 정책 (DP-TX5 동일 적용)
- 기본값 `{}`
- `cfg.payloadSummary.metadataAllowedFields` 기본 빈 배열
- whitelist scalar only, nested object 금지, credential 차단 동일 적용

---

## 7. message wording 정책 (§9 / DP-TX6 / U-TX-2)

### 금지 표현 (15종 — FORBIDDEN_WORDS)
```text
발송됨, 저장됨, 전송 완료, completed transmission,
sent, delivered,
매수 성공, 손절, 익절, 수익 확정, 손실 확정,
buy now, sell now, take profit, stop loss
```

### sanitizeMessageLines 3 모드
- `REJECT` (기본값, 안전 우선) — 금지 표현 포함 line 전체 제거 + warning `FORBIDDEN_WORD_LINE_REJECTED:<word>`
- `REPLACE` — 금지 표현을 safe wording 으로 치환 (예: '발송됨' → '발송 후보') + warning `FORBIDDEN_WORD_SANITIZED:<word>`
- `WARN_ONLY` — line 유지 + warning `FORBIDDEN_WORD_LINE_KEPT:<word>` (운영 환경에서 사용 금지 권장)

### 허용 표현
```text
발송 후보, 발송 대기, dry-run, 저장 계획, 평가 저장 후보, 리뷰 후보,
관찰 결과, 평가 결과, 후보 상태
```

---

## 8. dry-run safety 정책 (§6 / DP-TX3)

- `DEFAULT_TRANSPORT_EXECUTION_CONFIG.envelopeMode = 'DRY_RUN'` 고정
- `DEFAULT_TRANSPORT_EXECUTION_CONFIG.dryRunOnly = true`
- `envelopeMode` 가 'DRY_RUN' 이 아닌 모든 경우 (LIVE/REAL/SEND) → `ENVELOPE_BLOCKED`
- `dryRunOnly !== true` 시도 → `ENVELOPE_BLOCKED`

---

## 9. 적용 DP / U-TX / N-TX-OBS 정리

| ID | 적용 결과 |
|---|---|
| DP-TX1 | Dry-run envelope builder 만. `dryRun=true` 강제. 실제 발송/저장/호출 0건 |
| DP-TX2 | TransportPlan override 금지. boolean AND 집계만 수행 |
| DP-TX3 | envelopeMode DRY_RUN only. LIVE/REAL/SEND → BLOCKED |
| DP-TX4 | credential 9키 재귀 검사. case-insensitive + partial match + depth 5 |
| DP-TX5 | payloadSummary whitelist scalar. Object.assign / spread / clone / for-in 코드 0건 |
| DP-TX6 | dry-run wording only. `sanitizeMode='REJECT'` 기본. 금지 어휘 코드 0건 (FORBIDDEN_WORDS 정의 외) |
| DP-TX7 | fetch / Telegram / KV / DB / DOM / storage / clock 코드 0건 |
| DP-TX8 | 입력 6종 read-only. 입력 mutation 코드 0건 (S19 검증) |
| DP-TX9 | rendererBinding 참고만. decision source = transportPlan (S18 검증) |
| DP-TX10 | 신규 파일 1개 + 문서 갱신만. 보호 파일 23종 무손상 |
| **U-TX-1** | `credentialAllowList` 기본 빈 배열. partial match 안전 우선 차단 |
| **U-TX-2** | `sanitizeMode='REJECT'` 기본. REPLACE / WARN_ONLY 선택 가능 |
| **N-TX-OBS-1** | dryRunOnly namespace 중복 — JSDoc 으로 layer 출처 명시 |
| **N-TX-OBS-2** | 보호 baseline false-positive — 본 모듈은 fetch / Date.now / spread / Object.assign 0건 |

---

## 10. 함수 목록 (§11)

```text
[Entry / Config]
  mergeTransportExecutionConfig(config)
  buildTransportExecution(input, config)         ← 진입점

[Envelope builders]
  buildTelegramEnvelope(input, cfg)
  buildSnapshotEnvelope(input, cfg)
  buildEvaluationEnvelope(input, cfg)
  buildAuditEnvelope(input, cfg)

[Summary / classification]
  buildSafePayloadSummary(input, cfg)
  buildEnvelopeSummary(envelopes, cfg)
  classifyEnvelopeStatus(envelopes, safety, cfg)

[Credential / wording]
  detectCredentialFields(input, config)
  isCredentialKey(keyName, allowList)
  sanitizeMessageLines(lines, cfg)

[Helpers]
  normalizeEnvelopeRequest(request, cfg)
  normalizeTransportExecution(result)
  isPlainObject(value)
  safeString(value, maxLen)
  safeNumber(value)
  pushReason(target, code, detail)
  pushWarning(target, code, detail)
```

---

## 11. smoke test 21 시나리오 (모두 통과)

| # | 시나리오 | 검증 |
|---|---|---|
| S1 | all eligible dry-run | envelopeStatus=READY, 4 envelope eligible=true |
| S2 | all skipped | envelopeStatus=SKIPPED |
| S3 | partial envelope | telegram eligible + snapshot blocked by config → PARTIAL |
| S4 | invalid transportPlan | null / valid:false → INVALID |
| S5 | blocked LIVE mode | envelopeMode='LIVE' → BLOCKED |
| S6 | credential blocked top-level | config.botToken → BLOCKED + value 부재 |
| S7 | credential blocked nested | input.operationPacket.notificationPacket.metadata.apiKey → BLOCKED + value 부재 |
| S8 | credential case-insensitive | Token / CHATID / BotToken 모두 BLOCKED |
| S9 | credential partial match | apiKeyHash / tokenSalt / userSecret 모두 BLOCKED |
| S10 | telegram request envelope | request exists, scalar shape, dryRunOnly=true |
| S11 | snapshot request envelope | bucket / snapshotType / keyHint scalar |
| S12 | evaluation request envelope | evaluationType / resultType scalar |
| S13 | audit request envelope | auditType scalar (ROUTING_CONFLICT_NOTIFY 등) |
| S14 | safe payload summary | whitelist 외 nestedObject 차단 |
| S15 | no object spread leak | SECRET_DO_NOT_LEAK nested 위치 → output 0 노출 |
| S16 | metadata whitelist | default empty / safeField 만 복사 / leak_attempt 부재 |
| S17 | wording sanitize REJECT | '발송됨' / 'sent' 포함 line 제거 + warning |
| S18 | rendererBinding reference only | displayMode='ALERT' 이라도 decision override 안 함 |
| S19 | mutation check | input frozen / before-after JSON 동일 |
| S20 | forbidden side-effect | normal load 시 exception 없음 |
| S21 | raw/secret value leak | INNER_SECRET 값 0 노출 + BLOCKED + SECRET_FIELD_BLOCKED warning |

**총 assertion 59건 / 59 PASS** ✅

---

## 12. 금지 패턴 grep 결과 (§14)

| 영역 | 매치 | 비고 |
|---|---|---|
| A. side-effect API (`fetch( / KV. / DB / Telegram / sendTelegram / XMLHttpRequest / innerHTML / document. / addEventListener / localStorage / sessionStorage / Date.now( / new Date / performance.now`) | 매치 13건 | 모두 JSDoc/comment 정책 라인 + 함수/변수 이름 (`buildTelegramEnvelope`, `allowTelegram`). **실제 API 호출 0건** |
| B. 입력 mutation (`transportPlan.X = / rendererBinding.X = / operationPacket.X = / activeCycleDecision.X = / evaluationOutcome.X = / externalConfluence.X =`) | **0건** ✅ | DP-TX8 |
| C. secret/raw 노출 (`secret / token / chatId / botToken / apiKey / authorization / password / credential / webhookUrl / apiKeyHash / tokenSalt / userSecret / CHATID / BotToken / payload.raw / identityInput / raw.builderDebug / raw candles / full API response`) | 매치 다수 | 모두 (1) JSDoc 정책 / (2) credential 차단 로직 구현용 literal array (CREDENTIAL_KEYS_BASE) / (3) 변수·함수 이름 (`isCredentialKey`, `credentialAllowList`, `credentialMaxDepth`). **실제 외부 secret 읽기 / 값 노출 0건** |
| D. spread / clone / for-in (`Object.assign / ... / JSON.parse(JSON.stringify / for (... in ...)`) | 매치 4건 (모두 JSDoc 정책 라인) | **실제 사용 0건** ✅ DP-TX5 |
| E. trading + transmission wording (`발송됨 / 저장됨 / 전송 완료 / sent / delivered / completed transmission / 매수 성공 / 손절 / 익절 / 수익 확정 / 손실 확정 / buy now / sell now / take profit / stop loss`) | 매치 다수 | 모두 (1) JSDoc 정책 / (2) FORBIDDEN_WORDS literal array / (3) getSafeReplacement mapping. **실제 어휘 출력 사용 0건** — 본 모듈은 차단/치환만 |

---

## 13. 보호 파일 diff 0건 확인

```bash
git diff --stat HEAD -- v3/v3-config.js v3/v3-feature-payload.js v3/v3-bithumb-client.js \
  v3/v3-candle-normalizer.js v3/v3-indicators.js v3/v3-feature-payload-builder.js \
  v3/v3-score-breakdown.js v3/v3-structure-bucket.js v3/v3-signal-cycle.js \
  v3/v3-strategy-plan.js v3/v3-card-view-model.js v3/v3-operation-packet.js \
  v3/v3-active-cycle.js v3/v3-evaluation-outcome.js \
  v3/v3-evaluation-observation-adapter.js v3/v3-external-confluence.js \
  v3/v3-transport-plan.js v3/v3-renderer-binding.js \
  docs/ws3/WS3_CODE_CONTRACT.md docs/ws3/WS3_WORKFLOW_TEMPLATE.md \
  index.html manifest.json service-worker.js
```
→ 빈 출력 = **23종 보호 파일 무손상** ✅

---

## 14. 기준 commit

- branch: `claude/heuristic-cori-7865e7`
- 이전 functional baseline: WS3 v0.12.0 adapterOutputContractPack (`8fd0551`)
- 본 commit: (Gate 3 push 후 기록)

---

## 15. 핵심 메모

```text
- v3/v3-transport-execution-adapter.js 신규 (1.4k 라인 + JSDoc)
- DP-TX1 ~ DP-TX10 + U-TX-1 + U-TX-2 + N-TX-OBS-1 + N-TX-OBS-2 전부 적용
- 보호 파일 23종 무손상 (v3 *.js 18종 + 문서 2종 + 루트 3종)
- envelopeStatus 6 후보 first-match-wins (INVALID > BLOCKED > PARTIAL > READY > SKIPPED > UNKNOWN)
- credential 9키 재귀 차단 (case-insensitive + partial + depth 5, value output 0 노출)
- payloadSummary 14 whitelist scalar only (Object.assign/spread/clone/for-in 코드 0건)
- sanitizeMode='REJECT' 기본 (15 금지 어휘 line 제거 + warning)
- smoke test 59 assertion / 21 시나리오 전부 통과
- 입력 mutation 0건, side-effect 0건, dryRun=true 강제
- v0.14.0+ real transport executor 와 credential 인계 0건 보장
```
