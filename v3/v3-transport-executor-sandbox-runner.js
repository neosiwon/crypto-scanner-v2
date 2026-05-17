/**
 * WS3 v0.17.0 — TransportExecutorSandboxRunner (Sandbox Runner)
 *
 * Scope:
 *   transportExecutorInterfaceAdapter (v0.16.0) + transportExecutorHarness (v0.15.0) +
 *   secureTransportExecutorContract (v0.14.0) + transportExecutionEnvelope (v0.13.0) +
 *   transportPlan (v0.12.0) + rendererBinding (v0.12.0) + operationPacket (v0.8.0) +
 *   activeCycleDecision (v0.9.0) + evaluationOutcome (v0.10.0) + externalConfluence (v0.11.0)
 *   → standalone TransportExecutorSandboxRunner (SANDBOX_ONLY, fixture-based simulated result)
 *
 * 단일 기준 문서:
 *   docs/ws3/WS3_CODE_CONTRACT.md (b-r2 박제본)
 *
 * 확정 DP 정책 (Gate 2 spec):
 *   DP-SANDBOX1   sandbox runner only. 실제 발송/저장/호출/binding lookup/retry/timer X.
 *   DP-SANDBOX2   transportExecutorInterfaceAdapter ready/status/contract 결정을 true 로
 *                 override 금지. 5종 Contract 는 preview 계열로만 안전 변환.
 *   DP-SANDBOX3   sandboxMode SANDBOX_ONLY only. LIVE / REAL / EXECUTE → SANDBOX_BLOCKED.
 *   DP-SANDBOX4   liveExecutionAllowed / sideEffectAllowed / fetchAllowed / writeAllowed /
 *                 credentialLookupAllowed / bindingLookupAllowed / driverCallAllowed /
 *                 retryAllowed / timerAllowed (9 boolean) 중 하나라도 true → SANDBOX_BLOCKED.
 *   DP-SANDBOX5   function / async / Promise / thenable / resolver / driver / retry / timer
 *                 input 차단. function input 감지 시 SANDBOX_BLOCKED.
 *   DP-SANDBOX6   credential 값 / process.env / env 객체 / secure binding value 읽기 0건.
 *                 env-like object input/config/fixture → 즉시 SANDBOX_BLOCKED.
 *   DP-SANDBOX7   sandboxResult whitelist scalar only. rawResponse / rawError / stack /
 *                 body / headers / credential / env / function / timestamp 금지.
 *   DP-SANDBOX8   dry-run / sandbox wording only. 발송됨 / sent / delivered / 손절 / 익절 등 금지.
 *   DP-SANDBOX9   10종 입력 (transportExecutorInterfaceAdapter + transportExecutorHarness +
 *                 secureTransportExecutorContract + transportExecutionEnvelope + transportPlan +
 *                 rendererBinding + operationPacket + activeCycleDecision + evaluationOutcome +
 *                 externalConfluence) read-only.
 *   DP-SANDBOX10  신규 파일 1개 + 문서 갱신만. 보호 파일 29종 수정 금지.
 *
 * N-SANDBOX-OBS 처리:
 *   N-SANDBOX-OBS-1  신규 식별자 fresh — Sandbox / SANDBOX_* / buildXxxSandbox /
 *                    WS3_TransportExecutorSandboxRunner 등 충돌 0건.
 *   N-SANDBOX-OBS-2  v0.16 interface adapter shape 정합 — telegramInterface/snapshotInterface/
 *                    evaluationInterface/auditInterface.ready / adapterStatus / 5종 Contract 참조.
 *                    ready/status/contract 결정 override 0건.
 *   N-SANDBOX-OBS-3  sandbox fixture / result 식별자 fresh — sandboxFixture / sandboxResult /
 *                    SIMULATED_OK / SIMULATED_ERROR / SIMULATED_SKIPPED / INVALID_SANDBOX_*.
 *                    FUNCTION_INPUT_BLOCKED / ACTION_TARGET_MISMATCH 는 v0.16 reason code 재사용.
 *   N-SANDBOX-OBS-4  preview 계열 fresh — bindingResolverPreview / driverCallPreview /
 *                    resultAdapterPreview / errorAdapterPreview / retryPreview / lookupSimulated /
 *                    callSimulated. lookupAllowed/callAllowed/wouldCall/retryAllowed/rawResponseAllowed/
 *                    rawErrorAllowed/stackAllowed/responseBodyAllowed 모두 false 유지.
 *   N-SANDBOX-OBS-5  보호 baseline false-positive — 본 모듈 fetch / Date.now / new Date /
 *                    performance.now / Object.assign / spread / deep clone / for-in /
 *                    async / await / Promise / thenable / setTimeout / setInterval 0건.
 *   N-SANDBOX-OBS-6  RESERVED_FRAMEWORK_METADATA_KEYS 확장 — v0.17 신규 sandbox 자체 metadata
 *                    식별자 (sandboxFixturePatternBlocked 등) 자동 차단 제외.
 *   N-SANDBOX-OBS-7  timerAllowed 신규 hard block — v0.16 의 8 boolean + timerAllowed 추가 (9 boolean).
 *   N-SANDBOX-OBS-8  sandboxResult.ok 와 target.ready 분리 — sandboxResult.ok 는 simulated 결과,
 *                    target.ready 는 sandbox 실행 가능 여부. 두 값 무관. SIMULATED_ERROR 도
 *                    정상 에러 경로 시뮬레이션 가능. target.ready 의 source 는 ready 정책이며
 *                    sandboxResult.ok 와 무관.
 *   N-SANDBOX-OBS-9  보호 파일 29종 — v0.16 commit 이후 v3-transport-executor-interface-adapter.js
 *                    추가. 본 단계 29종 무손상.
 *
 * 출력 (top-level):
 *   valid, version, sandboxMode, liveExecutionAllowed, sandboxStatus, sourceAdapterStatus,
 *   sandboxPolicy, bindingResolverPreview, telegramSandbox, snapshotSandbox, evaluationSandbox,
 *   auditSandbox, sandboxSummary, reasons[], warnings[], debug, configUsed
 *
 * sandboxStatus 6 후보 (first-match-wins):
 *   SANDBOX_INVALID  → transportExecutorInterfaceAdapter missing 또는 valid !== true
 *   SANDBOX_BLOCKED  → source ADAPTER_BLOCKED/INVALID, credential 감지, env-like 감지,
 *                      function input 감지, sandboxMode !== SANDBOX_ONLY, 9 boolean hard block,
 *                      invalid sandboxFixture/sandboxResult/rateLimitContract/circuitBreakerContract
 *   SANDBOX_PARTIAL  → ≥1 ready true + ≥1 blocker
 *   SANDBOX_READY    → source ADAPTER_READY/PARTIAL + ≥1 ready true + blocker 0
 *   SANDBOX_SKIPPED  → source ADAPTER_SKIPPED, 또는 모든 ready false + blocker 0
 *   SANDBOX_UNKNOWN  → fallback
 *
 * 의도된 미구현 (이번 단계 제외):
 *   실제 Telegram bot API 호출 / chatId / botToken / webhookUrl 노출.
 *   실제 KV write / DB persist / 파일 IO / 브라우저 storage.
 *   실제 fetch / binding lookup / env 접근 / process.env.
 *   실제 driver call / retry 실행 / circuit breaker 상태 변경 / rate limit 카운터 증가.
 *   실제 timer (setTimeout / setInterval) / Promise / thenable.
 *   raw payload / payload.raw / identityInput / raw.builderDebug / rawResponse / rawError / stack 노출.
 *   sandboxResult 를 LIVE 실행 결정 source 로 사용.
 *
 * 함수 목록:
 *   mergeTransportExecutorSandboxRunnerConfig(config)
 *   buildTransportExecutorSandboxRunner(input, config)        ← 진입점
 *   buildTelegramSandbox / buildSnapshotSandbox / buildEvaluationSandbox / buildAuditSandbox
 *   buildBindingResolverPreview(input, cfg)
 *   buildDriverCallPreview(interfaceTarget, target, cfg)
 *   buildResultAdapterPreview(interfaceTarget, target, cfg)
 *   buildErrorAdapterPreview(interfaceTarget, target, cfg)
 *   buildRetryPreview(interfaceTarget, target, cfg)
 *   buildSandboxFixture(target, fixtureSource, cfg)
 *   validateSandboxFixture(target, fixture, cfg)
 *   buildSandboxResult(target, fixture, cfg)
 *   validateSandboxResult(result, target, cfg)
 *   buildRateLimitContractFromInterface(interfaceTarget, target, cfg)
 *   buildCircuitBreakerContractFromInterface(interfaceTarget, target, cfg)
 *   buildSafePayloadSummary / buildSafeMetadata / buildSafeRequestShape   ← IIFE module-private
 *   buildSandboxSummary(sandboxes, cfg)
 *   classifySandboxStatus(sandboxes, safety, cfg)
 *   detectCredentialFields / detectEnvLikeObjects / detectFunctionInputs
 *   validateLogicalRef(ref, cfg)
 *   sanitizeMessageLines(lines, cfg)
 *   normalizeSandboxTarget / normalizeTransportExecutorSandboxRunner
 *   isPlainObject, safeString, safeNumber, pushReason, pushWarning
 *
 * export:
 *   global.WS3_TransportExecutorSandboxRunner + module.exports
 */
(function(global) {
  'use strict';

  // §version
  var SANDBOX_VERSION = 'WS3_v0.17.0_transport_executor_sandbox_runner';

  // §sandboxMode (only SANDBOX_ONLY allowed)
  var SANDBOX_MODE = Object.freeze({
    SANDBOX_ONLY: 'SANDBOX_ONLY'
  });

  // §sandboxStatus 6 후보
  var SANDBOX_STATUS = Object.freeze({
    READY: 'SANDBOX_READY',
    SKIPPED: 'SANDBOX_SKIPPED',
    BLOCKED: 'SANDBOX_BLOCKED',
    PARTIAL: 'SANDBOX_PARTIAL',
    INVALID: 'SANDBOX_INVALID',
    UNKNOWN: 'SANDBOX_UNKNOWN'
  });

  // §target enum
  var TARGET = Object.freeze({
    TELEGRAM: 'TELEGRAM',
    SNAPSHOT_STORE: 'SNAPSHOT_STORE',
    EVALUATION_STORE: 'EVALUATION_STORE',
    AUDIT_STORE: 'AUDIT_STORE'
  });

  // §action enum (1:1 target ↔ action — N-ADAPTER-OBS-4 동일)
  var ACTION = Object.freeze({
    TELEGRAM_SEND: 'TELEGRAM_SEND',
    SNAPSHOT_WRITE: 'SNAPSHOT_WRITE',
    EVALUATION_WRITE: 'EVALUATION_WRITE',
    AUDIT_WRITE: 'AUDIT_WRITE'
  });

  function getActionForTarget(target) {
    if (target === TARGET.TELEGRAM) return ACTION.TELEGRAM_SEND;
    if (target === TARGET.SNAPSHOT_STORE) return ACTION.SNAPSHOT_WRITE;
    if (target === TARGET.EVALUATION_STORE) return ACTION.EVALUATION_WRITE;
    if (target === TARGET.AUDIT_STORE) return ACTION.AUDIT_WRITE;
    return null;
  }

  // §sandbox fixture logical ref (per target)
  function getSandboxFixtureRef(target) {
    if (target === TARGET.TELEGRAM) return 'TELEGRAM_SANDBOX_FIXTURE';
    if (target === TARGET.SNAPSHOT_STORE) return 'SNAPSHOT_SANDBOX_FIXTURE';
    if (target === TARGET.EVALUATION_STORE) return 'EVALUATION_SANDBOX_FIXTURE';
    if (target === TARGET.AUDIT_STORE) return 'AUDIT_SANDBOX_FIXTURE';
    return null;
  }

  // §sandboxResult status enum
  var SIMULATED_STATUS = Object.freeze({
    OK: 'SIMULATED_OK',
    ERROR: 'SIMULATED_ERROR',
    SKIPPED: 'SIMULATED_SKIPPED'
  });

  function isValidSimulatedStatus(status) {
    return status === SIMULATED_STATUS.OK
        || status === SIMULATED_STATUS.ERROR
        || status === SIMULATED_STATUS.SKIPPED;
  }

  // §errorType enum (v0.16 identical)
  var ERROR_TYPE = Object.freeze({
    NETWORK_ERROR: 'NETWORK_ERROR',
    TIMEOUT: 'TIMEOUT',
    AUTH_FAILED: 'AUTH_FAILED',
    RATE_LIMIT: 'RATE_LIMIT',
    PAYLOAD_ERROR: 'PAYLOAD_ERROR',
    SERVER_ERROR: 'SERVER_ERROR',
    PARSE_ERROR: 'PARSE_ERROR',
    UNKNOWN: 'UNKNOWN',
    CONTRACT_INVALID: 'CONTRACT_INVALID'
  });

  function isValidErrorType(et) {
    if (et === null) return true;
    if (typeof et !== 'string') return false;
    if (et === ERROR_TYPE.NETWORK_ERROR) return true;
    if (et === ERROR_TYPE.TIMEOUT) return true;
    if (et === ERROR_TYPE.AUTH_FAILED) return true;
    if (et === ERROR_TYPE.RATE_LIMIT) return true;
    if (et === ERROR_TYPE.PAYLOAD_ERROR) return true;
    if (et === ERROR_TYPE.SERVER_ERROR) return true;
    if (et === ERROR_TYPE.PARSE_ERROR) return true;
    if (et === ERROR_TYPE.UNKNOWN) return true;
    if (et === ERROR_TYPE.CONTRACT_INVALID) return true;
    return false;
  }

  // §sandbox fixture allowed keys (whitelist exact)
  var SANDBOX_FIXTURE_ALLOWED_KEYS = Object.freeze([
    'target',
    'action',
    'ok',
    'status',
    'errorType',
    'reasonCode'
  ]);

  // §credential 금지 키 (9종 lower-case base — case-insensitive + partial match)
  var CREDENTIAL_KEYS_BASE = Object.freeze([
    'secret',
    'token',
    'chatid',
    'bottoken',
    'apikey',
    'authorization',
    'password',
    'credential',
    'webhookurl'
  ]);

  // §RESERVED 프레임워크 metadata 키 (v0.13/v0.14/v0.15/v0.16/v0.17 framework metadata)
  //   N-SANDBOX-OBS-6 — v0.16 bindingResolverContract.credentialHandleRef 등 자체 metadata 식별자 포함
  var RESERVED_FRAMEWORK_METADATA_KEYS = Object.freeze([
    // credential* metadata fields
    'credentialAllowList',
    'credentialAllowListSize',
    'credentialMaxDepth',
    'credentialDetections',
    'credentialDepthWarnings',
    'credentialBlocked',
    'credentialInPayloadAllowed',
    'credentialInEnvelopeAllowed',
    'credentialSource',
    'credentialPolicy',
    'credentialLookupAllowed',
    'credentialHandleRef',                       // v0.16 bindingResolverContract field
    'blockCredentialFields',
    // *Secret* / *Token* policy metadata fields
    'allowWebhookUrl',
    'allowDirectSecretAccess',
    'directSecretAccessAllowed',
    // binding ref policy fields
    'bindingRefAllowList',
    'bindingRefAllowListSize',
    'bindingRefCredentialPatternBlocked',
    // logical ref policy fields
    'logicalRefAllowList',
    'logicalRefAllowListSize',
    'logicalRefCredentialPatternBlocked',
    'logicalRefFunctionPatternBlocked',
    // v0.17 sandbox policy metadata (신규)
    'sandboxFixtureCredentialPatternBlocked',
    'sandboxFixturePatternBlocked',
    'sandboxFixtureFunctionPatternBlocked'
  ]);

  // §env-like 금지 키 (exact match + value is object)
  var ENV_LIKE_KEYS_EXACT = Object.freeze([
    'env',
    'ENV',
    'environment',
    'bindings',
    'cfEnv',
    'cloudflareEnv',
    'secrets',
    'kvNamespace',
    'kv',
    'KV',
    'process'
  ]);

  // §logical ref 금지 substring (v0.16 동일)
  var LOGICAL_REF_FORBIDDEN_SUBSTRINGS = Object.freeze([
    'http',
    'https',
    '://',
    'www.',
    ':',
    '/',
    '.',
    '-',
    '@',
    'sk-',
    'xoxb-',
    'xoxp-',
    'eyJ'
  ]);

  // §logical ref function-body / code pattern (token-level, v0.16 동일)
  var LOGICAL_REF_FUNCTION_TOKENS = Object.freeze([
    'FUNCTION',
    'ASYNC',
    'AWAIT',
    'PROMISE',
    'RETURN',
    'EVAL',
    'THEN',
    'YIELD',
    'GENERATOR',
    'CALLBACK'
  ]);

  // §wording sanitize 후보
  var WORDING_SANITIZE_MODE = Object.freeze({
    REJECT: 'REJECT',
    REPLACE: 'REPLACE',
    WARN_ONLY: 'WARN_ONLY'
  });

  // §forbidden wording
  var FORBIDDEN_WORDS = Object.freeze([
    '발송됨',
    '저장됨',
    '전송 완료',
    'completed transmission',
    'sent',
    'delivered',
    '매수 성공',
    '손절',
    '익절',
    '수익 확정',
    '손실 확정',
    'buy now',
    'sell now',
    'take profit',
    'stop loss'
  ]);

  function getSafeReplacement(word) {
    if (word === '발송됨') return '발송 후보';
    if (word === '저장됨') return '저장 계획';
    if (word === '전송 완료') return 'dry-run';
    if (word === 'completed transmission') return 'dry-run';
    if (word === 'sent') return 'pending';
    if (word === 'delivered') return 'pending';
    if (word === '매수 성공') return '관찰 결과';
    if (word === '손절') return '평가 결과';
    if (word === '익절') return '평가 결과';
    if (word === '수익 확정') return '평가 결과';
    if (word === '손실 확정') return '평가 결과';
    if (word === 'buy now') return '후보 상태';
    if (word === 'sell now') return '후보 상태';
    if (word === 'take profit') return '평가 결과';
    if (word === 'stop loss') return '평가 결과';
    return 'redacted';
  }

  // §DEFAULT_CONFIG
  var DEFAULT_TRANSPORT_EXECUTOR_SANDBOX_RUNNER_CONFIG = Object.freeze({
    version: 'inline-default-v0',
    sandboxMode: 'SANDBOX_ONLY',
    liveExecutionAllowed: false,
    sideEffectAllowed: false,
    fetchAllowed: false,
    writeAllowed: false,
    credentialLookupAllowed: false,
    bindingLookupAllowed: false,
    driverCallAllowed: false,
    retryAllowed: false,
    timerAllowed: false,
    targets: Object.freeze({
      telegram: Object.freeze({ enabled: true, fixture: null }),
      snapshot: Object.freeze({ enabled: true, fixture: null }),
      evaluation: Object.freeze({ enabled: true, fixture: null }),
      audit: Object.freeze({ enabled: true, fixture: null })
    }),
    safety: Object.freeze({
      blockCredentialFields: true,
      credentialMaxDepth: 5,
      credentialAllowList: Object.freeze([]),
      logicalRefAllowList: Object.freeze([]),
      blockEnvLikeObjects: true,
      blockObjectTooDeep: true,
      blockFunctionInputs: true,
      allowRawPayload: false,
      allowEnvRead: false,
      allowDirectSecretAccess: false,
      allowFunctionInput: false,
      allowAsync: false
    }),
    requestShape: Object.freeze({
      maxStringLength: 200,
      metadataAllowedFields: Object.freeze([]),
      payloadSummaryAllowedFields: Object.freeze([
        'candidateKey',
        'base',
        'quote',
        'market',
        'exchange',
        'timeframe',
        'messageType',
        'snapshotType',
        'evaluationType',
        'resultType',
        'auditType',
        'displayMode',
        'confluenceLabel',
        'confluenceScore'
      ])
    }),
    wording: Object.freeze({ sanitizeMode: 'REJECT' }),
    debug: Object.freeze({ enabled: false, allowedFields: Object.freeze([]) })
  });

  // §helpers ────────────────────────────────────────────────────────────

  function isPlainObject(value) {
    if (value === null || value === undefined) return false;
    if (typeof value !== 'object') return false;
    if (Array.isArray(value)) return false;
    return true;
  }

  function safeString(value, maxLen) {
    if (value === null || value === undefined) return null;
    if (typeof value !== 'string') return null;
    var lim = (typeof maxLen === 'number' && isFinite(maxLen) && maxLen > 0) ? maxLen : 200;
    if (value.length > lim) return null;
    return value;
  }

  function safeNumber(value) {
    if (typeof value !== 'number') return null;
    if (!isFinite(value)) return null;
    return value;
  }

  function pushReason(target, code, detail) {
    if (!target || !Array.isArray(target.reasons)) return;
    if (typeof code !== 'string' || code.length === 0) return;
    var entry = detail ? (code + ':' + String(detail)) : code;
    target.reasons.push(entry);
  }

  function pushWarning(target, code, detail) {
    if (!target || !Array.isArray(target.warnings)) return;
    if (typeof code !== 'string' || code.length === 0) return;
    var entry = detail ? (code + ':' + String(detail)) : code;
    target.warnings.push(entry);
  }

  // §config merge — field-by-field (no Object.assign, no spread, no for-in)
  function mergeTransportExecutorSandboxRunnerConfig(config) {
    var c = isPlainObject(config) ? config : {};
    var d = DEFAULT_TRANSPORT_EXECUTOR_SANDBOX_RUNNER_CONFIG;

    var tg = isPlainObject(c.targets) ? c.targets : {};
    var sf = isPlainObject(c.safety) ? c.safety : {};
    var rs = isPlainObject(c.requestShape) ? c.requestShape : {};
    var wd = isPlainObject(c.wording) ? c.wording : {};
    var db = isPlainObject(c.debug) ? c.debug : {};

    var tgTele = isPlainObject(tg.telegram) ? tg.telegram : {};
    var tgSnap = isPlainObject(tg.snapshot) ? tg.snapshot : {};
    var tgEval = isPlainObject(tg.evaluation) ? tg.evaluation : {};
    var tgAudit = isPlainObject(tg.audit) ? tg.audit : {};

    function copyStringArray(srcArr, defArr) {
      var out = [];
      var src = Array.isArray(srcArr) ? srcArr : defArr;
      var i;
      for (i = 0; i < src.length; i++) {
        var v = src[i];
        if (typeof v === 'string' && v.length > 0) out.push(v);
      }
      return out;
    }

    var credAllow = copyStringArray(sf.credentialAllowList, d.safety.credentialAllowList);
    var logicalAllow = copyStringArray(sf.logicalRefAllowList, d.safety.logicalRefAllowList);
    var allowedFields = copyStringArray(rs.payloadSummaryAllowedFields, d.requestShape.payloadSummaryAllowedFields);
    var metaAllowed = copyStringArray(rs.metadataAllowedFields, d.requestShape.metadataAllowedFields);
    var debugAllowed = copyStringArray(db.allowedFields, d.debug.allowedFields);

    var maxLen = (typeof rs.maxStringLength === 'number' && isFinite(rs.maxStringLength) && rs.maxStringLength > 0)
      ? rs.maxStringLength
      : d.requestShape.maxStringLength;
    var maxDepth = (typeof sf.credentialMaxDepth === 'number' && isFinite(sf.credentialMaxDepth) && sf.credentialMaxDepth > 0)
      ? sf.credentialMaxDepth
      : d.safety.credentialMaxDepth;

    var sanitizeMode = (typeof wd.sanitizeMode === 'string') ? wd.sanitizeMode : d.wording.sanitizeMode;
    if (sanitizeMode !== WORDING_SANITIZE_MODE.REJECT
        && sanitizeMode !== WORDING_SANITIZE_MODE.REPLACE
        && sanitizeMode !== WORDING_SANITIZE_MODE.WARN_ONLY) {
      sanitizeMode = d.wording.sanitizeMode;
    }

    function normalizeFixture(f) {
      if (!isPlainObject(f)) return null;
      return f; // keep — validateSandboxFixture 가 검증
    }

    return {
      version: (typeof c.version === 'string' && c.version.length > 0) ? c.version : d.version,
      sandboxMode: (typeof c.sandboxMode === 'string' && c.sandboxMode.length > 0) ? c.sandboxMode : d.sandboxMode,
      liveExecutionAllowed: c.liveExecutionAllowed === true,
      sideEffectAllowed: c.sideEffectAllowed === true,
      fetchAllowed: c.fetchAllowed === true,
      writeAllowed: c.writeAllowed === true,
      credentialLookupAllowed: c.credentialLookupAllowed === true,
      bindingLookupAllowed: c.bindingLookupAllowed === true,
      driverCallAllowed: c.driverCallAllowed === true,
      retryAllowed: c.retryAllowed === true,
      timerAllowed: c.timerAllowed === true,
      targets: {
        telegram: { enabled: tgTele.enabled !== false, fixture: normalizeFixture(tgTele.fixture) },
        snapshot: { enabled: tgSnap.enabled !== false, fixture: normalizeFixture(tgSnap.fixture) },
        evaluation: { enabled: tgEval.enabled !== false, fixture: normalizeFixture(tgEval.fixture) },
        audit: { enabled: tgAudit.enabled !== false, fixture: normalizeFixture(tgAudit.fixture) }
      },
      safety: {
        blockCredentialFields: sf.blockCredentialFields !== false,
        credentialMaxDepth: maxDepth,
        credentialAllowList: credAllow,
        logicalRefAllowList: logicalAllow,
        blockEnvLikeObjects: sf.blockEnvLikeObjects !== false,
        blockObjectTooDeep: sf.blockObjectTooDeep !== false,
        blockFunctionInputs: sf.blockFunctionInputs !== false,
        allowRawPayload: sf.allowRawPayload === true,
        allowEnvRead: sf.allowEnvRead === true,
        allowDirectSecretAccess: sf.allowDirectSecretAccess === true,
        allowFunctionInput: sf.allowFunctionInput === true,
        allowAsync: sf.allowAsync === true
      },
      requestShape: {
        maxStringLength: maxLen,
        metadataAllowedFields: metaAllowed,
        payloadSummaryAllowedFields: allowedFields
      },
      wording: { sanitizeMode: sanitizeMode },
      debug: { enabled: db.enabled === true, allowedFields: debugAllowed }
    };
  }

  // §credential / env / function detection ───────────────────────────────

  function isCredentialKey(keyName, allowList) {
    if (typeof keyName !== 'string' || keyName.length === 0) return false;
    var r;
    for (r = 0; r < RESERVED_FRAMEWORK_METADATA_KEYS.length; r++) {
      if (RESERVED_FRAMEWORK_METADATA_KEYS[r] === keyName) return false;
    }
    if (Array.isArray(allowList)) {
      var a;
      for (a = 0; a < allowList.length; a++) {
        if (allowList[a] === keyName) return false;
      }
    }
    var lower = keyName.toLowerCase();
    var i;
    for (i = 0; i < CREDENTIAL_KEYS_BASE.length; i++) {
      if (lower.indexOf(CREDENTIAL_KEYS_BASE[i]) !== -1) return true;
    }
    return false;
  }

  function isEnvLikeKey(keyName) {
    if (typeof keyName !== 'string' || keyName.length === 0) return false;
    var i;
    for (i = 0; i < ENV_LIKE_KEYS_EXACT.length; i++) {
      if (keyName === ENV_LIKE_KEYS_EXACT[i]) return true;
    }
    return false;
  }

  function detectCredentialFields(input, config) {
    var cfg = mergeTransportExecutorSandboxRunnerConfig(config);
    var detections = [];
    var depthWarnings = [];

    if (cfg.safety.blockCredentialFields !== true) {
      return { detections: detections, depthWarnings: depthWarnings };
    }

    function walk(value, path, depth) {
      if (!isPlainObject(value) && !Array.isArray(value)) return;
      if (depth > cfg.safety.credentialMaxDepth) {
        depthWarnings.push(path);
        return;
      }
      if (Array.isArray(value)) {
        var i;
        for (i = 0; i < value.length; i++) walk(value[i], path + '[' + i + ']', depth + 1);
        return;
      }
      if (isPlainObject(value)) {
        var keys = Object.keys(value);
        var k;
        for (k = 0; k < keys.length; k++) {
          var keyName = keys[k];
          var nextPath = path ? (path + '.' + keyName) : keyName;
          if (isCredentialKey(keyName, cfg.safety.credentialAllowList)) {
            detections.push(nextPath);
          } else {
            walk(value[keyName], nextPath, depth + 1);
          }
        }
        return;
      }
    }

    if (isPlainObject(input)) {
      var iKeys = Object.keys(input);
      var ix;
      for (ix = 0; ix < iKeys.length; ix++) {
        var ik = iKeys[ix];
        if (isCredentialKey(ik, cfg.safety.credentialAllowList)) detections.push('input.' + ik);
        else walk(input[ik], 'input.' + ik, 1);
      }
    }
    if (isPlainObject(config)) {
      var cKeys = Object.keys(config);
      var cx;
      for (cx = 0; cx < cKeys.length; cx++) {
        var ck = cKeys[cx];
        if (isCredentialKey(ck, cfg.safety.credentialAllowList)) detections.push('config.' + ck);
        else walk(config[ck], 'config.' + ck, 1);
      }
    }
    return { detections: detections, depthWarnings: depthWarnings };
  }

  function detectEnvLikeObjects(input, config) {
    var cfg = mergeTransportExecutorSandboxRunnerConfig(config);
    var detections = [];
    var depthBlocks = [];

    if (cfg.safety.blockEnvLikeObjects !== true) {
      return { detections: detections, depthBlocks: depthBlocks };
    }

    function walk(value, path, depth) {
      if (!isPlainObject(value) && !Array.isArray(value)) return;
      if (depth > cfg.safety.credentialMaxDepth) {
        if (cfg.safety.blockObjectTooDeep === true) depthBlocks.push(path);
        return;
      }
      if (Array.isArray(value)) {
        var i;
        for (i = 0; i < value.length; i++) walk(value[i], path + '[' + i + ']', depth + 1);
        return;
      }
      if (isPlainObject(value)) {
        var keys = Object.keys(value);
        var k;
        for (k = 0; k < keys.length; k++) {
          var keyName = keys[k];
          var nextPath = path ? (path + '.' + keyName) : keyName;
          var childVal = value[keyName];
          if (isEnvLikeKey(keyName) && isPlainObject(childVal)) {
            detections.push(nextPath);
            continue;
          }
          walk(childVal, nextPath, depth + 1);
        }
        return;
      }
    }

    if (isPlainObject(input)) {
      var iKeys = Object.keys(input);
      var ix;
      for (ix = 0; ix < iKeys.length; ix++) {
        var ik = iKeys[ix];
        var iv = input[ik];
        if (isEnvLikeKey(ik) && isPlainObject(iv)) detections.push('input.' + ik);
        else walk(iv, 'input.' + ik, 1);
      }
    }
    if (isPlainObject(config)) {
      var cKeys = Object.keys(config);
      var cx;
      for (cx = 0; cx < cKeys.length; cx++) {
        var ck = cKeys[cx];
        var cv = config[ck];
        if (isEnvLikeKey(ck) && isPlainObject(cv)) detections.push('config.' + ck);
        else walk(cv, 'config.' + ck, 1);
      }
    }
    return { detections: detections, depthBlocks: depthBlocks };
  }

  function detectFunctionInputs(input, config) {
    var cfg = mergeTransportExecutorSandboxRunnerConfig(config);
    var detections = [];

    if (cfg.safety.blockFunctionInputs !== true) {
      return { detections: detections };
    }

    function isFunctionLike(value) {
      if (typeof value === 'function') return true;
      if (isPlainObject(value) && typeof value.then === 'function') return true;
      return false;
    }

    function walk(value, path, depth) {
      if (!isPlainObject(value) && !Array.isArray(value)) return;
      if (depth > cfg.safety.credentialMaxDepth) return;
      if (Array.isArray(value)) {
        var i;
        for (i = 0; i < value.length; i++) {
          var av = value[i];
          if (isFunctionLike(av)) {
            detections.push(path + '[' + i + ']');
            continue;
          }
          walk(av, path + '[' + i + ']', depth + 1);
        }
        return;
      }
      if (isPlainObject(value)) {
        var keys = Object.keys(value);
        var k;
        for (k = 0; k < keys.length; k++) {
          var keyName = keys[k];
          var nextPath = path ? (path + '.' + keyName) : keyName;
          var childVal = value[keyName];
          if (isFunctionLike(childVal)) {
            detections.push(nextPath);
            continue;
          }
          walk(childVal, nextPath, depth + 1);
        }
        return;
      }
    }

    if (isPlainObject(input)) {
      var iKeys = Object.keys(input);
      var ix;
      for (ix = 0; ix < iKeys.length; ix++) {
        var ik = iKeys[ix];
        var iv = input[ik];
        if (isFunctionLike(iv)) { detections.push('input.' + ik); continue; }
        walk(iv, 'input.' + ik, 1);
      }
    }
    if (isPlainObject(config)) {
      var cKeys = Object.keys(config);
      var cx;
      for (cx = 0; cx < cKeys.length; cx++) {
        var ck = cKeys[cx];
        var cv = config[ck];
        if (isFunctionLike(cv)) { detections.push('config.' + ck); continue; }
        walk(cv, 'config.' + ck, 1);
      }
    }
    return { detections: detections };
  }

  // §validateLogicalRef (v0.16 동일 — IIFE private 재정의)

  var LOGICAL_REF_PATTERN = /^[A-Z][A-Z0-9_]*$/;

  function validateLogicalRef(ref, cfg) {
    var allowList = (cfg && cfg.safety && Array.isArray(cfg.safety.logicalRefAllowList))
      ? cfg.safety.logicalRefAllowList
      : [];
    if (Array.isArray(allowList)) {
      var a;
      for (a = 0; a < allowList.length; a++) {
        if (allowList[a] === ref) return { valid: true, reason: null };
      }
    }
    if (typeof ref !== 'string') return { valid: false, reason: 'LOGICAL_REF_INVALID_FORMAT' };
    if (ref.length < 3 || ref.length > 64) return { valid: false, reason: 'LOGICAL_REF_INVALID_FORMAT' };
    if (!LOGICAL_REF_PATTERN.test(ref)) return { valid: false, reason: 'LOGICAL_REF_INVALID_FORMAT' };

    var credAllow = (cfg && cfg.safety && Array.isArray(cfg.safety.credentialAllowList))
      ? cfg.safety.credentialAllowList
      : [];
    if (isCredentialKey(ref, credAllow)) {
      return { valid: false, reason: 'LOGICAL_REF_CONTAINS_CREDENTIAL_PATTERN' };
    }

    var i;
    for (i = 0; i < LOGICAL_REF_FORBIDDEN_SUBSTRINGS.length; i++) {
      if (ref.indexOf(LOGICAL_REF_FORBIDDEN_SUBSTRINGS[i]) !== -1) {
        return { valid: false, reason: 'LOGICAL_REF_INVALID_FORMAT' };
      }
    }
    if (/bot[0-9]+/i.test(ref)) return { valid: false, reason: 'LOGICAL_REF_INVALID_FORMAT' };
    if (/^[0-9]+$/.test(ref)) return { valid: false, reason: 'LOGICAL_REF_INVALID_FORMAT' };

    var tokens = ref.split('_');
    var j;
    for (j = 0; j < tokens.length; j++) {
      var tok = tokens[j].toUpperCase();
      var k;
      for (k = 0; k < LOGICAL_REF_FUNCTION_TOKENS.length; k++) {
        if (LOGICAL_REF_FUNCTION_TOKENS[k] === tok) {
          return { valid: false, reason: 'LOGICAL_REF_CONTAINS_FUNCTION_PATTERN' };
        }
      }
    }
    return { valid: true, reason: null };
  }

  // §wording sanitize

  function lineContainsForbiddenWord(line) {
    if (typeof line !== 'string' || line.length === 0) return null;
    var lower = line.toLowerCase();
    var i;
    for (i = 0; i < FORBIDDEN_WORDS.length; i++) {
      var w = FORBIDDEN_WORDS[i];
      if (lower.indexOf(w.toLowerCase()) !== -1) return w;
    }
    return null;
  }

  function lineContainsCredentialPattern(line) {
    if (typeof line !== 'string' || line.length === 0) return false;
    var lower = line.toLowerCase();
    var i;
    for (i = 0; i < CREDENTIAL_KEYS_BASE.length; i++) {
      if (lower.indexOf(CREDENTIAL_KEYS_BASE[i]) !== -1) return true;
    }
    return false;
  }

  function replaceLineForbiddenWords(line) {
    if (typeof line !== 'string') return line;
    var out = line;
    var i;
    for (i = 0; i < FORBIDDEN_WORDS.length; i++) {
      var w = FORBIDDEN_WORDS[i];
      var safe = getSafeReplacement(w);
      var lowerOut = out.toLowerCase();
      var lowerW = w.toLowerCase();
      var idx = lowerOut.indexOf(lowerW);
      while (idx !== -1) {
        out = out.substring(0, idx) + safe + out.substring(idx + w.length);
        lowerOut = out.toLowerCase();
        idx = lowerOut.indexOf(lowerW, idx + safe.length);
      }
    }
    return out;
  }

  function sanitizeMessageLines(lines, cfg) {
    var result = { lines: [], warnings: [] };
    if (!Array.isArray(lines)) return result;
    var mode = (cfg && cfg.wording && typeof cfg.wording.sanitizeMode === 'string')
      ? cfg.wording.sanitizeMode
      : WORDING_SANITIZE_MODE.REJECT;
    var maxLen = (cfg && cfg.requestShape && typeof cfg.requestShape.maxStringLength === 'number')
      ? cfg.requestShape.maxStringLength
      : 200;

    var i;
    for (i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (typeof line !== 'string') continue;
      if (line.length > maxLen) continue;
      if (lineContainsCredentialPattern(line)) {
        result.warnings.push('CREDENTIAL_IN_LINE_REJECTED');
        continue;
      }
      var hit = lineContainsForbiddenWord(line);
      if (hit === null) { result.lines.push(line); continue; }
      if (mode === WORDING_SANITIZE_MODE.REJECT) {
        result.warnings.push('FORBIDDEN_WORD_LINE_REJECTED:' + hit);
        continue;
      }
      if (mode === WORDING_SANITIZE_MODE.REPLACE) {
        var replaced = replaceLineForbiddenWords(line);
        if (typeof replaced === 'string' && replaced.length <= maxLen) result.lines.push(replaced);
        result.warnings.push('FORBIDDEN_WORD_SANITIZED:' + hit);
        continue;
      }
      if (mode === WORDING_SANITIZE_MODE.WARN_ONLY) {
        result.lines.push(line);
        result.warnings.push('FORBIDDEN_WORD_LINE_KEPT:' + hit);
        continue;
      }
      result.warnings.push('FORBIDDEN_WORD_LINE_REJECTED:' + hit);
    }
    return result;
  }

  // §payloadSummary / metadata revalidation (DP-SANDBOX2 — v0.16 신뢰 X)

  function buildSafePayloadSummary(harnessSummary, cfg) {
    var warnings = [];
    var out = {};
    var allowed = (cfg && cfg.requestShape && Array.isArray(cfg.requestShape.payloadSummaryAllowedFields))
      ? cfg.requestShape.payloadSummaryAllowedFields
      : [];
    var maxLen = (cfg && cfg.requestShape && typeof cfg.requestShape.maxStringLength === 'number')
      ? cfg.requestShape.maxStringLength : 200;
    var allowList = (cfg && cfg.safety && Array.isArray(cfg.safety.credentialAllowList))
      ? cfg.safety.credentialAllowList : [];

    if (!isPlainObject(harnessSummary)) return { summary: out, warnings: warnings };

    var i;
    for (i = 0; i < allowed.length; i++) {
      var fld = allowed[i];
      if (typeof fld !== 'string' || fld.length === 0) continue;
      if (isCredentialKey(fld, allowList)) { warnings.push('CREDENTIAL_FIELD_REJECTED:' + fld); continue; }
      if (Object.prototype.hasOwnProperty.call(harnessSummary, fld) === false) { out[fld] = null; continue; }
      var v = harnessSummary[fld];
      if (v === null || v === undefined) { out[fld] = null; continue; }
      if (typeof v === 'string') {
        var s = safeString(v, maxLen);
        if (s === null) { warnings.push('NON_SCALAR_VALUE_SKIPPED:' + fld); out[fld] = null; }
        else out[fld] = s;
        continue;
      }
      if (typeof v === 'number') {
        var n = safeNumber(v);
        if (n === null) { warnings.push('NON_SCALAR_VALUE_SKIPPED:' + fld); out[fld] = null; }
        else out[fld] = n;
        continue;
      }
      if (typeof v === 'boolean') { out[fld] = v; continue; }
      warnings.push('NON_SCALAR_VALUE_SKIPPED:' + fld);
      out[fld] = null;
    }
    return { summary: out, warnings: warnings };
  }

  function buildSafeMetadata(harnessMetadata, cfg) {
    var warnings = [];
    var out = {};
    var allowed = (cfg && cfg.requestShape && Array.isArray(cfg.requestShape.metadataAllowedFields))
      ? cfg.requestShape.metadataAllowedFields : [];
    if (allowed.length === 0) return { metadata: out, warnings: warnings };
    if (!isPlainObject(harnessMetadata)) return { metadata: out, warnings: warnings };

    var maxLen = (cfg && cfg.requestShape && typeof cfg.requestShape.maxStringLength === 'number')
      ? cfg.requestShape.maxStringLength : 200;
    var allowList = (cfg && cfg.safety && Array.isArray(cfg.safety.credentialAllowList))
      ? cfg.safety.credentialAllowList : [];

    var i;
    for (i = 0; i < allowed.length; i++) {
      var fld = allowed[i];
      if (typeof fld !== 'string' || fld.length === 0) continue;
      if (isCredentialKey(fld, allowList)) { warnings.push('CREDENTIAL_METADATA_FIELD_REJECTED:' + fld); continue; }
      if (Object.prototype.hasOwnProperty.call(harnessMetadata, fld) === false) continue;
      var v = harnessMetadata[fld];
      if (v === null || v === undefined) { out[fld] = null; continue; }
      if (typeof v === 'string') {
        var s = safeString(v, maxLen);
        if (s === null) { warnings.push('NON_SCALAR_METADATA_SKIPPED:' + fld); continue; }
        out[fld] = s;
        continue;
      }
      if (typeof v === 'number') {
        var n = safeNumber(v);
        if (n === null) { warnings.push('NON_SCALAR_METADATA_SKIPPED:' + fld); continue; }
        out[fld] = n;
        continue;
      }
      if (typeof v === 'boolean') { out[fld] = v; continue; }
      warnings.push('NON_SCALAR_METADATA_SKIPPED:' + fld);
    }
    return { metadata: out, warnings: warnings };
  }

  // buildSafeRequestShape — interface.interfaceSpec.requestShape 재검증
  function buildSafeRequestShape(interfaceTarget, targetType, cfg) {
    var warnings = [];
    var iTgt = isPlainObject(interfaceTarget) ? interfaceTarget : {};
    var iSpec = isPlainObject(iTgt.interfaceSpec) ? iTgt.interfaceSpec : {};
    var iReq = isPlainObject(iSpec.requestShape) ? iSpec.requestShape : {};
    var iSummary = isPlainObject(iReq.payloadSummary) ? iReq.payloadSummary : {};
    var iMeta = isPlainObject(iReq.metadata) ? iReq.metadata : {};

    var sumResult = buildSafePayloadSummary(iSummary, cfg);
    var i;
    for (i = 0; i < sumResult.warnings.length; i++) warnings.push(sumResult.warnings[i]);

    var metaResult = buildSafeMetadata(iMeta, cfg);
    var m;
    for (m = 0; m < metaResult.warnings.length; m++) warnings.push(metaResult.warnings[m]);

    var maxLen = (cfg && cfg.requestShape && typeof cfg.requestShape.maxStringLength === 'number')
      ? cfg.requestShape.maxStringLength : 200;

    var requestShape;
    if (targetType === TARGET.TELEGRAM) {
      var lines = [];
      if (Array.isArray(iReq.lines)) {
        var s = sanitizeMessageLines(iReq.lines, cfg);
        var li;
        for (li = 0; li < s.warnings.length; li++) warnings.push(s.warnings[li]);
        lines = s.lines;
      }
      requestShape = {
        channelRef: 'SECURE_CHANNEL_REF',
        messageType: (typeof iReq.messageType === 'string') ? safeString(iReq.messageType, maxLen) : 'NONE',
        title: (typeof iReq.title === 'string') ? safeString(iReq.title, maxLen) : null,
        lines: lines,
        payloadSummary: sumResult.summary,
        metadata: metaResult.metadata
      };
      if (requestShape.messageType === null) requestShape.messageType = 'NONE';
    } else if (targetType === TARGET.SNAPSHOT_STORE) {
      requestShape = {
        bucketRef: 'SECURE_BUCKET_REF',
        snapshotType: (typeof iReq.snapshotType === 'string') ? safeString(iReq.snapshotType, maxLen) : 'NONE',
        keyHint: (typeof iReq.keyHint === 'string') ? safeString(iReq.keyHint, maxLen) : null,
        payloadSummary: sumResult.summary,
        metadata: metaResult.metadata
      };
      if (requestShape.snapshotType === null) requestShape.snapshotType = 'NONE';
    } else if (targetType === TARGET.EVALUATION_STORE) {
      requestShape = {
        evaluationType: (typeof iReq.evaluationType === 'string') ? safeString(iReq.evaluationType, maxLen) : 'NONE',
        resultType: (typeof iReq.resultType === 'string') ? safeString(iReq.resultType, maxLen) : 'NONE',
        keyHint: (typeof iReq.keyHint === 'string') ? safeString(iReq.keyHint, maxLen) : null,
        payloadSummary: sumResult.summary,
        metadata: metaResult.metadata
      };
      if (requestShape.evaluationType === null) requestShape.evaluationType = 'NONE';
      if (requestShape.resultType === null) requestShape.resultType = 'NONE';
    } else if (targetType === TARGET.AUDIT_STORE) {
      requestShape = {
        auditType: (typeof iReq.auditType === 'string') ? safeString(iReq.auditType, maxLen) : 'NONE',
        keyHint: (typeof iReq.keyHint === 'string') ? safeString(iReq.keyHint, maxLen) : null,
        payloadSummary: sumResult.summary,
        metadata: metaResult.metadata
      };
      if (requestShape.auditType === null) requestShape.auditType = 'NONE';
    } else {
      requestShape = { payloadSummary: sumResult.summary, metadata: metaResult.metadata };
    }

    return {
      action: getActionForTarget(targetType),
      requestShape: requestShape,
      warnings: warnings
    };
  }

  // §rateLimit / circuitBreaker pass-through revalidation

  function buildRateLimitContractFromInterface(interfaceTarget, targetType /*, cfg */) {
    var src = (interfaceTarget && isPlainObject(interfaceTarget.rateLimitContract))
      ? interfaceTarget.rateLimitContract : null;
    if (src === null) return { contract: null, valid: false };
    var enabled = src.enabled === true;
    var key = src.key;
    var windowMs = src.windowMs;
    var maxAttempts = src.maxAttempts;
    var keyValid = (typeof key === 'string' && /^[A-Z][A-Z0-9_]*$/.test(key));
    var windowValid = (typeof windowMs === 'number' && isFinite(windowMs) && windowMs > 0);
    var attemptsValid = (typeof maxAttempts === 'number' && isFinite(maxAttempts) && maxAttempts > 0);
    var keyMatchesTarget = (key === targetType);
    var ok = enabled && keyValid && windowValid && attemptsValid && keyMatchesTarget;
    if (!ok) return { contract: null, valid: false };
    return {
      contract: { enabled: enabled, key: key, windowMs: windowMs, maxAttempts: maxAttempts },
      valid: true
    };
  }

  function buildCircuitBreakerContractFromInterface(interfaceTarget /*, targetType, cfg */) {
    var src = (interfaceTarget && isPlainObject(interfaceTarget.circuitBreakerContract))
      ? interfaceTarget.circuitBreakerContract : null;
    if (src === null) return { contract: null, valid: false };
    var enabled = src.enabled === true;
    var state = src.state;
    var failureThreshold = src.failureThreshold;
    // OPEN_IN_DRY_RUN only. CLOSED / HALF_OPEN 금지.
    var stateValid = (state === 'OPEN_IN_DRY_RUN');
    var thresholdValid = (typeof failureThreshold === 'number' && isFinite(failureThreshold) && failureThreshold > 0);
    var ok = enabled && stateValid && thresholdValid;
    if (!ok) return { contract: null, valid: false };
    return {
      contract: { enabled: enabled, state: state, failureThreshold: failureThreshold },
      valid: true
    };
  }

  // §sandbox fixture validation (DP-SANDBOX5)

  function validateSandboxFixture(targetType, fixture, cfg) {
    var allowList = (cfg && cfg.safety && Array.isArray(cfg.safety.credentialAllowList))
      ? cfg.safety.credentialAllowList : [];
    var maxLen = (cfg && cfg.requestShape && typeof cfg.requestShape.maxStringLength === 'number')
      ? cfg.requestShape.maxStringLength : 200;

    // 1. plain object only (no arrays, no function-like)
    if (!isPlainObject(fixture)) return { valid: false, reason: 'INVALID_SANDBOX_FIXTURE:NOT_PLAIN_OBJECT' };
    if (typeof fixture.then === 'function') return { valid: false, reason: 'INVALID_SANDBOX_FIXTURE:THENABLE' };

    // 2. allowed keys whitelist + extra key 차단
    var keys = Object.keys(fixture);
    var i;
    for (i = 0; i < keys.length; i++) {
      var k = keys[i];
      var allowed = false;
      var ai;
      for (ai = 0; ai < SANDBOX_FIXTURE_ALLOWED_KEYS.length; ai++) {
        if (SANDBOX_FIXTURE_ALLOWED_KEYS[ai] === k) { allowed = true; break; }
      }
      if (!allowed) {
        return { valid: false, reason: 'INVALID_SANDBOX_FIXTURE:EXTRA_KEY:' + k };
      }
      // credential key partial match 차단
      if (isCredentialKey(k, allowList)) {
        return { valid: false, reason: 'INVALID_SANDBOX_FIXTURE:CREDENTIAL_KEY:' + k };
      }
    }

    // 3. nested object 차단 (depth 1 plain object only)
    var k2;
    for (k2 = 0; k2 < keys.length; k2++) {
      var kn = keys[k2];
      var v = fixture[kn];
      if (typeof v === 'function') return { valid: false, reason: 'INVALID_SANDBOX_FIXTURE:FUNCTION_VALUE:' + kn };
      if (isPlainObject(v)) return { valid: false, reason: 'INVALID_SANDBOX_FIXTURE:NESTED_OBJECT:' + kn };
      if (Array.isArray(v)) return { valid: false, reason: 'INVALID_SANDBOX_FIXTURE:ARRAY_VALUE:' + kn };
    }

    // 4. target enum 검증
    if (Object.prototype.hasOwnProperty.call(fixture, 'target')) {
      if (fixture.target !== TARGET.TELEGRAM
          && fixture.target !== TARGET.SNAPSHOT_STORE
          && fixture.target !== TARGET.EVALUATION_STORE
          && fixture.target !== TARGET.AUDIT_STORE) {
        return { valid: false, reason: 'INVALID_SANDBOX_FIXTURE:INVALID_TARGET' };
      }
      if (fixture.target !== targetType) {
        return { valid: false, reason: 'INVALID_SANDBOX_FIXTURE:TARGET_MISMATCH' };
      }
    }

    // 5. action enum 검증 + target ↔ action 매핑
    if (Object.prototype.hasOwnProperty.call(fixture, 'action')) {
      if (fixture.action !== ACTION.TELEGRAM_SEND
          && fixture.action !== ACTION.SNAPSHOT_WRITE
          && fixture.action !== ACTION.EVALUATION_WRITE
          && fixture.action !== ACTION.AUDIT_WRITE) {
        return { valid: false, reason: 'INVALID_SANDBOX_FIXTURE:INVALID_ACTION' };
      }
      var expectedAction = getActionForTarget(targetType);
      if (fixture.action !== expectedAction) {
        return { valid: false, reason: 'INVALID_SANDBOX_FIXTURE:ACTION_TARGET_MISMATCH' };
      }
    }

    // 6. ok: boolean | null
    if (Object.prototype.hasOwnProperty.call(fixture, 'ok')) {
      if (fixture.ok !== true && fixture.ok !== false && fixture.ok !== null) {
        return { valid: false, reason: 'INVALID_SANDBOX_FIXTURE:INVALID_OK' };
      }
    }

    // 7. status enum 검증
    if (Object.prototype.hasOwnProperty.call(fixture, 'status')) {
      if (!isValidSimulatedStatus(fixture.status)) {
        return { valid: false, reason: 'INVALID_SANDBOX_FIXTURE:INVALID_STATUS' };
      }
    }

    // 8. errorType 검증
    if (Object.prototype.hasOwnProperty.call(fixture, 'errorType')) {
      if (!isValidErrorType(fixture.errorType)) {
        return { valid: false, reason: 'INVALID_SANDBOX_FIXTURE:INVALID_ERROR_TYPE' };
      }
    }

    // 9. reasonCode 검증
    if (Object.prototype.hasOwnProperty.call(fixture, 'reasonCode')) {
      var rc = fixture.reasonCode;
      if (rc !== null) {
        if (typeof rc !== 'string') return { valid: false, reason: 'INVALID_SANDBOX_FIXTURE:INVALID_REASON_CODE' };
        if (rc.length > maxLen) return { valid: false, reason: 'INVALID_SANDBOX_FIXTURE:REASON_CODE_TOO_LONG' };
        if (isCredentialKey(rc, allowList)) {
          return { valid: false, reason: 'INVALID_SANDBOX_FIXTURE:REASON_CODE_CREDENTIAL_PATTERN' };
        }
        // function pattern in reasonCode (단순 substring 검사)
        var rcLower = rc.toLowerCase();
        var fp;
        for (fp = 0; fp < LOGICAL_REF_FUNCTION_TOKENS.length; fp++) {
          if (rcLower.indexOf(LOGICAL_REF_FUNCTION_TOKENS[fp].toLowerCase()) !== -1) {
            // 단순 keyword 포함만 차단 (token-level 은 reasonCode 형식 자유)
            // 보수적으로 차단
            return { valid: false, reason: 'INVALID_SANDBOX_FIXTURE:REASON_CODE_FUNCTION_PATTERN' };
          }
        }
      }
    }

    return { valid: true, reason: null };
  }

  function buildSandboxFixture(targetType, fixtureSource /*, cfg */) {
    // fixtureSource null/undefined → default fixture
    if (fixtureSource === null || fixtureSource === undefined) {
      return {
        target: targetType,
        action: getActionForTarget(targetType),
        ok: true,
        status: SIMULATED_STATUS.OK,
        errorType: null,
        reasonCode: null
      };
    }
    if (!isPlainObject(fixtureSource)) {
      return null; // validateSandboxFixture 에서 invalid 처리
    }
    // pass-through copy with whitelist field copy (no spread)
    var out = {};
    var keys = Object.keys(fixtureSource);
    var i;
    for (i = 0; i < keys.length; i++) {
      var k = keys[i];
      var allowed = false;
      var ai;
      for (ai = 0; ai < SANDBOX_FIXTURE_ALLOWED_KEYS.length; ai++) {
        if (SANDBOX_FIXTURE_ALLOWED_KEYS[ai] === k) { allowed = true; break; }
      }
      if (allowed) out[k] = fixtureSource[k];
    }
    // fill defaults
    if (!Object.prototype.hasOwnProperty.call(out, 'target')) out.target = targetType;
    if (!Object.prototype.hasOwnProperty.call(out, 'action')) out.action = getActionForTarget(targetType);
    if (!Object.prototype.hasOwnProperty.call(out, 'ok')) out.ok = null;
    if (!Object.prototype.hasOwnProperty.call(out, 'status')) out.status = SIMULATED_STATUS.OK;
    if (!Object.prototype.hasOwnProperty.call(out, 'errorType')) out.errorType = null;
    if (!Object.prototype.hasOwnProperty.call(out, 'reasonCode')) out.reasonCode = null;
    return out;
  }

  // §sandbox result builder
  function buildSandboxResult(targetType, fixture /*, cfg */) {
    if (!isPlainObject(fixture)) {
      return {
        simulated: true,
        resultType: 'SANDBOX_ONLY',
        target: targetType,
        action: getActionForTarget(targetType),
        ok: null,
        status: SIMULATED_STATUS.SKIPPED,
        errorType: null,
        reasonCode: null
      };
    }
    return {
      simulated: true,
      resultType: 'SANDBOX_ONLY',
      target: fixture.target,
      action: fixture.action,
      ok: (fixture.ok === true || fixture.ok === false) ? fixture.ok : null,
      status: fixture.status,
      errorType: fixture.errorType,
      reasonCode: fixture.reasonCode
    };
  }

  // §sandboxResult validation (whitelist scalar only — DP-SANDBOX7)
  function validateSandboxResult(result, targetType, cfg) {
    if (!isPlainObject(result)) return { valid: false, reason: 'INVALID_SANDBOX_RESULT:NOT_PLAIN_OBJECT' };
    if (result.simulated !== true) return { valid: false, reason: 'INVALID_SANDBOX_RESULT:SIMULATED_NOT_TRUE' };
    if (result.resultType !== 'SANDBOX_ONLY') return { valid: false, reason: 'INVALID_SANDBOX_RESULT:INVALID_RESULT_TYPE' };
    if (result.target !== targetType) return { valid: false, reason: 'INVALID_SANDBOX_RESULT:TARGET_MISMATCH' };
    var expectedAction = getActionForTarget(targetType);
    if (result.action !== expectedAction) return { valid: false, reason: 'INVALID_SANDBOX_RESULT:ACTION_TARGET_MISMATCH' };
    if (!isValidSimulatedStatus(result.status)) return { valid: false, reason: 'INVALID_SANDBOX_RESULT:INVALID_STATUS' };
    if (!isValidErrorType(result.errorType)) return { valid: false, reason: 'INVALID_SANDBOX_RESULT:INVALID_ERROR_TYPE' };
    var maxLen = (cfg && cfg.requestShape && typeof cfg.requestShape.maxStringLength === 'number')
      ? cfg.requestShape.maxStringLength : 200;
    if (result.reasonCode !== null) {
      if (typeof result.reasonCode !== 'string') return { valid: false, reason: 'INVALID_SANDBOX_RESULT:INVALID_REASON_CODE' };
      if (result.reasonCode.length > maxLen) return { valid: false, reason: 'INVALID_SANDBOX_RESULT:REASON_CODE_TOO_LONG' };
    }
    // forbidden keys check
    var keys = Object.keys(result);
    var allowedResult = ['simulated', 'resultType', 'target', 'action', 'ok', 'status', 'errorType', 'reasonCode'];
    var i;
    for (i = 0; i < keys.length; i++) {
      var k = keys[i];
      var allowed = false;
      var ai;
      for (ai = 0; ai < allowedResult.length; ai++) {
        if (allowedResult[ai] === k) { allowed = true; break; }
      }
      if (!allowed) return { valid: false, reason: 'INVALID_SANDBOX_RESULT:EXTRA_KEY:' + k };
    }
    return { valid: true, reason: null };
  }

  // §preview builders (DP-SANDBOX2 — 5종 Contract → preview)

  function buildBindingResolverPreview(/* input, cfg */) {
    return {
      lookupAllowed: false,
      lookupSimulated: false,
      resolved: false,
      resolverRef: 'FUTURE_SECURE_BINDING_RESOLVER',
      credentialHandleRef: 'SECURE_CREDENTIAL_HANDLE_REF',
      bindingRef: 'LOGICAL_BINDING_REF'
    };
  }

  function buildDriverCallPreview(interfaceTarget, targetType /*, cfg */) {
    var dc = (interfaceTarget && isPlainObject(interfaceTarget.driverCallContract))
      ? interfaceTarget.driverCallContract : {};
    return {
      callAllowed: false,
      callSimulated: false,
      wouldCall: false,
      callMode: 'SANDBOX_PREVIEW',
      driverRef: (typeof dc.driverRef === 'string') ? dc.driverRef : null,
      methodRef: (typeof dc.methodRef === 'string') ? dc.methodRef : null,
      inputSchemaRef: (typeof dc.inputSchemaRef === 'string') ? dc.inputSchemaRef : null,
      outputSchemaRef: (typeof dc.outputSchemaRef === 'string') ? dc.outputSchemaRef : null
    };
  }

  function buildResultAdapterPreview(/* interfaceTarget, targetType, cfg */) {
    return {
      resultType: 'SANDBOX_PREVIEW',
      rawResponseAllowed: false,
      safeFieldsOnly: true,
      safeFields: ['action', 'resultType', 'ok', 'status', 'errorType', 'reasonCode']
    };
  }

  function buildErrorAdapterPreview(/* interfaceTarget, targetType, cfg */) {
    return {
      simulatedError: false,
      rawErrorAllowed: false,
      stackAllowed: false,
      responseBodyAllowed: false,
      safeFields: ['errorType', 'reasonCode', 'targetRef'],
      errorTypes: [
        ERROR_TYPE.NETWORK_ERROR,
        ERROR_TYPE.TIMEOUT,
        ERROR_TYPE.AUTH_FAILED,
        ERROR_TYPE.RATE_LIMIT,
        ERROR_TYPE.PAYLOAD_ERROR,
        ERROR_TYPE.SERVER_ERROR,
        ERROR_TYPE.PARSE_ERROR,
        ERROR_TYPE.UNKNOWN,
        ERROR_TYPE.CONTRACT_INVALID
      ]
    };
  }

  function buildRetryPreview(/* interfaceTarget, targetType, cfg */) {
    return {
      retrySimulated: false,
      retryAllowed: false,
      maxRetries: 0,
      backoffMs: 0,
      retryableErrors: []
    };
  }

  // §sandbox builders ───────────────────────────────────────────────────

  function isReadyInterface(it) {
    return isPlainObject(it) && it.ready === true;
  }

  function buildSandboxForTarget(targetType, interfaceTarget, cfg) {
    var blockedReasons = [];
    var warnings = [];
    var sourceReady = isReadyInterface(interfaceTarget);

    var targetEnabled;
    var fixtureSource;
    if (targetType === TARGET.TELEGRAM) {
      targetEnabled = cfg.targets.telegram.enabled === true;
      fixtureSource = cfg.targets.telegram.fixture;
    } else if (targetType === TARGET.SNAPSHOT_STORE) {
      targetEnabled = cfg.targets.snapshot.enabled === true;
      fixtureSource = cfg.targets.snapshot.fixture;
    } else if (targetType === TARGET.EVALUATION_STORE) {
      targetEnabled = cfg.targets.evaluation.enabled === true;
      fixtureSource = cfg.targets.evaluation.fixture;
    } else if (targetType === TARGET.AUDIT_STORE) {
      targetEnabled = cfg.targets.audit.enabled === true;
      fixtureSource = cfg.targets.audit.fixture;
    } else {
      targetEnabled = false;
      fixtureSource = null;
    }

    var modeOk = cfg.sandboxMode === SANDBOX_MODE.SANDBOX_ONLY;
    var liveNotAllowed = cfg.liveExecutionAllowed !== true;
    var sideNotAllowed = cfg.sideEffectAllowed !== true;
    var fetchNotAllowed = cfg.fetchAllowed !== true;
    var writeNotAllowed = cfg.writeAllowed !== true;
    var credLookupNotAllowed = cfg.credentialLookupAllowed !== true;
    var bindingLookupNotAllowed = cfg.bindingLookupAllowed !== true;
    var driverCallNotAllowed = cfg.driverCallAllowed !== true;
    var retryNotAllowed = cfg.retryAllowed !== true;
    var timerNotAllowed = cfg.timerAllowed !== true;

    if (!sourceReady) blockedReasons.push('SOURCE_INTERFACE_NOT_READY');
    if (!targetEnabled) blockedReasons.push('CONFIG_DISALLOW_TARGET:' + targetType);
    if (!modeOk) blockedReasons.push('NON_SANDBOX_ONLY_MODE_BLOCKED');
    if (!liveNotAllowed) blockedReasons.push('LIVE_EXECUTION_ALLOWED_BLOCKED');
    if (!sideNotAllowed) blockedReasons.push('SIDE_EFFECT_ALLOWED_BLOCKED');
    if (!fetchNotAllowed) blockedReasons.push('FETCH_ALLOWED_BLOCKED');
    if (!writeNotAllowed) blockedReasons.push('WRITE_ALLOWED_BLOCKED');
    if (!credLookupNotAllowed) blockedReasons.push('CREDENTIAL_LOOKUP_ALLOWED_BLOCKED');
    if (!bindingLookupNotAllowed) blockedReasons.push('BINDING_LOOKUP_ALLOWED_BLOCKED');
    if (!driverCallNotAllowed) blockedReasons.push('DRIVER_CALL_ALLOWED_BLOCKED');
    if (!retryNotAllowed) blockedReasons.push('RETRY_ALLOWED_BLOCKED');
    if (!timerNotAllowed) blockedReasons.push('TIMER_ALLOWED_BLOCKED');

    // build fixture & validate
    //   user-provided source 는 그대로 validate (extra key / nested object 등 차단 위해).
    //   null/undefined 인 경우만 default fixture 자동 생성 후 validate.
    var fixtureForValidation;
    if (fixtureSource === null || fixtureSource === undefined) {
      fixtureForValidation = {
        target: targetType,
        action: getActionForTarget(targetType),
        ok: true,
        status: SIMULATED_STATUS.OK,
        errorType: null,
        reasonCode: null
      };
    } else {
      fixtureForValidation = fixtureSource;
    }
    var fixtureValidation = validateSandboxFixture(targetType, fixtureForValidation, cfg);
    var fixture = null;
    if (fixtureValidation.valid === true) {
      // build clean fixture (whitelist copy) after validation passes
      fixture = buildSandboxFixture(targetType, fixtureForValidation, cfg);
    } else {
      blockedReasons.push(fixtureValidation.reason + ':' + targetType);
    }

    // build sandbox result
    var result = null;
    var resultValidation = { valid: false, reason: 'INVALID_SANDBOX_RESULT:NO_FIXTURE' };
    if (fixture !== null) {
      result = buildSandboxResult(targetType, fixture, cfg);
      resultValidation = validateSandboxResult(result, targetType, cfg);
      if (resultValidation.valid !== true) {
        blockedReasons.push(resultValidation.reason + ':' + targetType);
      }
    }

    // rate limit / circuit breaker pass-through
    var rlResult = buildRateLimitContractFromInterface(interfaceTarget, targetType, cfg);
    if (rlResult.valid !== true) blockedReasons.push('INVALID_RATE_LIMIT_CONTRACT:' + targetType);
    var cbResult = buildCircuitBreakerContractFromInterface(interfaceTarget, targetType, cfg);
    if (cbResult.valid !== true) blockedReasons.push('INVALID_CIRCUIT_BREAKER_CONTRACT:' + targetType);

    // bindingRef logical validation
    var bindingRef = (interfaceTarget && typeof interfaceTarget.bindingRef === 'string')
      ? interfaceTarget.bindingRef : null;
    var refOk = true;
    if (bindingRef !== null) {
      var brv = validateLogicalRef(bindingRef, cfg);
      if (brv.valid !== true) {
        refOk = false;
        blockedReasons.push((brv.reason || 'LOGICAL_REF_INVALID') + ':bindingRef:' + targetType);
      }
    } else {
      refOk = false;
      blockedReasons.push('LOGICAL_REF_INVALID_FORMAT:bindingRef:' + targetType);
    }

    var ready = sourceReady && targetEnabled && modeOk && liveNotAllowed
                && sideNotAllowed && fetchNotAllowed && writeNotAllowed
                && credLookupNotAllowed && bindingLookupNotAllowed
                && driverCallNotAllowed && retryNotAllowed && timerNotAllowed
                && fixtureValidation.valid && resultValidation.valid
                && rlResult.valid && cbResult.valid && refOk;

    var shapeResult = buildSafeRequestShape(interfaceTarget, targetType, cfg);
    var sw;
    for (sw = 0; sw < shapeResult.warnings.length; sw++) warnings.push(shapeResult.warnings[sw]);

    return {
      ready: ready,
      target: targetType,
      sandboxMode: 'SANDBOX_ONLY',
      sideEffectAllowed: false,
      bindingRef: bindingRef,
      sandboxFixtureRef: getSandboxFixtureRef(targetType),
      sandboxFixture: fixtureValidation.valid ? fixture : null,
      sandboxResult: resultValidation.valid ? result : null,
      interfaceSpec: {
        action: shapeResult.action,
        requestShape: shapeResult.requestShape
      },
      bindingResolverPreview: buildBindingResolverPreview(null, cfg),
      driverCallPreview: buildDriverCallPreview(interfaceTarget, targetType, cfg),
      resultAdapterPreview: buildResultAdapterPreview(interfaceTarget, targetType, cfg),
      errorAdapterPreview: buildErrorAdapterPreview(interfaceTarget, targetType, cfg),
      retryPreview: buildRetryPreview(interfaceTarget, targetType, cfg),
      rateLimitContract: rlResult.valid ? rlResult.contract : null,
      circuitBreakerContract: cbResult.valid ? cbResult.contract : null,
      blockedReasons: blockedReasons,
      warnings: warnings
    };
  }

  function buildTelegramSandbox(input, cfg) {
    var src = isPlainObject(input.transportExecutorInterfaceAdapter) ? input.transportExecutorInterfaceAdapter : null;
    var iTgt = (src && isPlainObject(src.telegramInterface)) ? src.telegramInterface : null;
    return buildSandboxForTarget(TARGET.TELEGRAM, iTgt, cfg);
  }
  function buildSnapshotSandbox(input, cfg) {
    var src = isPlainObject(input.transportExecutorInterfaceAdapter) ? input.transportExecutorInterfaceAdapter : null;
    var iTgt = (src && isPlainObject(src.snapshotInterface)) ? src.snapshotInterface : null;
    return buildSandboxForTarget(TARGET.SNAPSHOT_STORE, iTgt, cfg);
  }
  function buildEvaluationSandbox(input, cfg) {
    var src = isPlainObject(input.transportExecutorInterfaceAdapter) ? input.transportExecutorInterfaceAdapter : null;
    var iTgt = (src && isPlainObject(src.evaluationInterface)) ? src.evaluationInterface : null;
    return buildSandboxForTarget(TARGET.EVALUATION_STORE, iTgt, cfg);
  }
  function buildAuditSandbox(input, cfg) {
    var src = isPlainObject(input.transportExecutorInterfaceAdapter) ? input.transportExecutorInterfaceAdapter : null;
    var iTgt = (src && isPlainObject(src.auditInterface)) ? src.auditInterface : null;
    return buildSandboxForTarget(TARGET.AUDIT_STORE, iTgt, cfg);
  }

  // §summary / classify

  function buildSandboxSummary(sandboxes /*, cfg */) {
    var readyCount = 0;
    var blockedCount = 0;
    var skippedCount = 0;
    var simulatedOkCount = 0;
    var simulatedErrorCount = 0;
    var simulatedSkippedCount = 0;
    var hasReadyTarget = false;
    var hasBlocker = false;

    var keys = ['telegramSandbox', 'snapshotSandbox', 'evaluationSandbox', 'auditSandbox'];
    var i;
    for (i = 0; i < keys.length; i++) {
      var t = sandboxes[keys[i]];
      if (!isPlainObject(t)) continue;
      // simulated counts
      if (isPlainObject(t.sandboxResult)) {
        if (t.sandboxResult.status === SIMULATED_STATUS.OK) simulatedOkCount += 1;
        if (t.sandboxResult.status === SIMULATED_STATUS.ERROR) simulatedErrorCount += 1;
        if (t.sandboxResult.status === SIMULATED_STATUS.SKIPPED) simulatedSkippedCount += 1;
      }
      if (t.ready === true) { hasReadyTarget = true; readyCount += 1; }
      else if (Array.isArray(t.blockedReasons) && t.blockedReasons.length > 0) {
        var realBlock = false;
        var br;
        for (br = 0; br < t.blockedReasons.length; br++) {
          if (t.blockedReasons[br] !== 'SOURCE_INTERFACE_NOT_READY') { realBlock = true; break; }
        }
        if (realBlock) { blockedCount += 1; hasBlocker = true; }
        else skippedCount += 1;
      } else { skippedCount += 1; }
    }

    return {
      readyCount: readyCount,
      blockedCount: blockedCount,
      skippedCount: skippedCount,
      simulatedOkCount: simulatedOkCount,
      simulatedErrorCount: simulatedErrorCount,
      simulatedSkippedCount: simulatedSkippedCount,
      hasReadyTarget: hasReadyTarget,
      hasBlocker: hasBlocker,
      liveGateRequired: true
    };
  }

  function classifySandboxStatus(sandboxes, safety, cfg) {
    // 1. INVALID
    if (safety && safety.invalidAdapter === true) return SANDBOX_STATUS.INVALID;
    if (safety && safety.sourceAdapterStatus === 'ADAPTER_INVALID') return SANDBOX_STATUS.INVALID;

    // 2. BLOCKED
    if (safety && safety.credentialBlocked === true) return SANDBOX_STATUS.BLOCKED;
    if (safety && safety.envLikeBlocked === true) return SANDBOX_STATUS.BLOCKED;
    if (safety && safety.depthBlocked === true) return SANDBOX_STATUS.BLOCKED;
    if (safety && safety.functionInputBlocked === true) return SANDBOX_STATUS.BLOCKED;
    if (safety && safety.modeBlocked === true) return SANDBOX_STATUS.BLOCKED;
    if (safety && safety.hardBlockBoolean === true) return SANDBOX_STATUS.BLOCKED;
    if (cfg && cfg.sandboxMode !== SANDBOX_MODE.SANDBOX_ONLY) return SANDBOX_STATUS.BLOCKED;
    if (cfg && cfg.liveExecutionAllowed === true) return SANDBOX_STATUS.BLOCKED;
    if (cfg && cfg.sideEffectAllowed === true) return SANDBOX_STATUS.BLOCKED;
    if (cfg && cfg.fetchAllowed === true) return SANDBOX_STATUS.BLOCKED;
    if (cfg && cfg.writeAllowed === true) return SANDBOX_STATUS.BLOCKED;
    if (cfg && cfg.credentialLookupAllowed === true) return SANDBOX_STATUS.BLOCKED;
    if (cfg && cfg.bindingLookupAllowed === true) return SANDBOX_STATUS.BLOCKED;
    if (cfg && cfg.driverCallAllowed === true) return SANDBOX_STATUS.BLOCKED;
    if (cfg && cfg.retryAllowed === true) return SANDBOX_STATUS.BLOCKED;
    if (cfg && cfg.timerAllowed === true) return SANDBOX_STATUS.BLOCKED;
    if (safety && safety.sourceAdapterStatus === 'ADAPTER_BLOCKED') return SANDBOX_STATUS.BLOCKED;

    var summary = buildSandboxSummary(sandboxes);

    if (summary.hasReadyTarget && summary.hasBlocker) return SANDBOX_STATUS.PARTIAL;
    if (safety && (safety.sourceAdapterStatus === 'ADAPTER_READY' || safety.sourceAdapterStatus === 'ADAPTER_PARTIAL')
        && summary.hasReadyTarget && !summary.hasBlocker) {
      return SANDBOX_STATUS.READY;
    }
    if (safety && safety.sourceAdapterStatus === 'ADAPTER_SKIPPED') return SANDBOX_STATUS.SKIPPED;
    if (!summary.hasReadyTarget && !summary.hasBlocker) return SANDBOX_STATUS.SKIPPED;
    return SANDBOX_STATUS.UNKNOWN;
  }

  // §normalize

  function normalizeSandboxTarget(target /*, cfg */) {
    var t = isPlainObject(target) ? target : {};
    return {
      ready: t.ready === true,
      target: typeof t.target === 'string' ? t.target : null,
      sandboxMode: 'SANDBOX_ONLY',
      sideEffectAllowed: t.sideEffectAllowed === true,
      bindingRef: typeof t.bindingRef === 'string' ? t.bindingRef : null,
      sandboxFixtureRef: typeof t.sandboxFixtureRef === 'string' ? t.sandboxFixtureRef : null,
      sandboxFixture: t.sandboxFixture,
      sandboxResult: t.sandboxResult,
      interfaceSpec: t.interfaceSpec,
      bindingResolverPreview: t.bindingResolverPreview,
      driverCallPreview: t.driverCallPreview,
      resultAdapterPreview: t.resultAdapterPreview,
      errorAdapterPreview: t.errorAdapterPreview,
      retryPreview: t.retryPreview,
      rateLimitContract: t.rateLimitContract,
      circuitBreakerContract: t.circuitBreakerContract,
      blockedReasons: Array.isArray(t.blockedReasons) ? t.blockedReasons : [],
      warnings: Array.isArray(t.warnings) ? t.warnings : []
    };
  }

  function normalizeTransportExecutorSandboxRunner(result) {
    return {
      valid: result.valid === true,
      version: result.version,
      sandboxMode: typeof result.sandboxMode === 'string' ? result.sandboxMode : 'SANDBOX_ONLY',
      liveExecutionAllowed: result.liveExecutionAllowed === true,
      sandboxStatus: typeof result.sandboxStatus === 'string' ? result.sandboxStatus : SANDBOX_STATUS.UNKNOWN,
      sourceAdapterStatus: typeof result.sourceAdapterStatus === 'string' ? result.sourceAdapterStatus : null,
      sandboxPolicy: result.sandboxPolicy,
      bindingResolverPreview: result.bindingResolverPreview,
      telegramSandbox: result.telegramSandbox,
      snapshotSandbox: result.snapshotSandbox,
      evaluationSandbox: result.evaluationSandbox,
      auditSandbox: result.auditSandbox,
      sandboxSummary: result.sandboxSummary,
      reasons: Array.isArray(result.reasons) ? result.reasons : [],
      warnings: Array.isArray(result.warnings) ? result.warnings : [],
      debug: result.debug,
      configUsed: result.configUsed
    };
  }

  // §main entry ─────────────────────────────────────────────────────────

  function buildTransportExecutorSandboxRunner(input, config) {
    var inp = isPlainObject(input) ? input : {};
    var cfg = mergeTransportExecutorSandboxRunnerConfig(config);
    var reasons = [];
    var warnings = [];

    // STEP 1 — INVALID check
    var src = isPlainObject(inp.transportExecutorInterfaceAdapter) ? inp.transportExecutorInterfaceAdapter : null;
    var invalidAdapter = (src === null) || (src.valid !== true);
    var sourceAdapterStatus = (src && typeof src.adapterStatus === 'string') ? src.adapterStatus : null;

    // STEP 2 — credential / env-like / function input recursive detection
    var credResult = detectCredentialFields(inp, config);
    var credBlocked = false;
    if (cfg.safety.blockCredentialFields === true && credResult.detections.length > 0) {
      credBlocked = true;
      var cd;
      for (cd = 0; cd < credResult.detections.length; cd++) {
        warnings.push('SECRET_FIELD_BLOCKED:' + credResult.detections[cd]);
      }
    }
    var cdw;
    for (cdw = 0; cdw < credResult.depthWarnings.length; cdw++) {
      warnings.push('DETECTION_DEPTH_LIMIT:' + credResult.depthWarnings[cdw]);
    }

    var envResult = detectEnvLikeObjects(inp, config);
    var envLikeBlocked = false;
    var depthBlocked = false;
    if (cfg.safety.blockEnvLikeObjects === true && envResult.detections.length > 0) {
      envLikeBlocked = true;
      var ed;
      for (ed = 0; ed < envResult.detections.length; ed++) {
        warnings.push('ENV_LIKE_OBJECT_DETECTED:' + envResult.detections[ed]);
      }
    }
    if (cfg.safety.blockObjectTooDeep === true && envResult.depthBlocks.length > 0) {
      depthBlocked = true;
      var dbi;
      for (dbi = 0; dbi < envResult.depthBlocks.length; dbi++) {
        warnings.push('OBJECT_TOO_DEEP_BLOCKED:' + envResult.depthBlocks[dbi]);
      }
    }

    var fnResult = detectFunctionInputs(inp, config);
    var functionInputBlocked = false;
    if (cfg.safety.blockFunctionInputs === true && fnResult.detections.length > 0) {
      functionInputBlocked = true;
      var fd;
      for (fd = 0; fd < fnResult.detections.length; fd++) {
        warnings.push('FUNCTION_INPUT_BLOCKED:' + fnResult.detections[fd]);
      }
    }

    // STEP 3 — mode / hard-block 9 boolean
    var modeBlocked = (cfg.sandboxMode !== SANDBOX_MODE.SANDBOX_ONLY);
    var hardBlockBoolean = (cfg.liveExecutionAllowed === true)
                        || (cfg.sideEffectAllowed === true)
                        || (cfg.fetchAllowed === true)
                        || (cfg.writeAllowed === true)
                        || (cfg.credentialLookupAllowed === true)
                        || (cfg.bindingLookupAllowed === true)
                        || (cfg.driverCallAllowed === true)
                        || (cfg.retryAllowed === true)
                        || (cfg.timerAllowed === true);

    // STEP 4 — base sandbox shape
    function makeBase(targetType, bindingRef) {
      return {
        ready: false,
        target: targetType,
        sandboxMode: 'SANDBOX_ONLY',
        sideEffectAllowed: false,
        bindingRef: bindingRef,
        sandboxFixtureRef: getSandboxFixtureRef(targetType),
        sandboxFixture: null,
        sandboxResult: null,
        interfaceSpec: {
          action: getActionForTarget(targetType),
          requestShape: {}
        },
        bindingResolverPreview: buildBindingResolverPreview(null, cfg),
        driverCallPreview: buildDriverCallPreview(null, targetType, cfg),
        resultAdapterPreview: buildResultAdapterPreview(null, targetType, cfg),
        errorAdapterPreview: buildErrorAdapterPreview(null, targetType, cfg),
        retryPreview: buildRetryPreview(null, targetType, cfg),
        rateLimitContract: null,
        circuitBreakerContract: null,
        blockedReasons: [],
        warnings: []
      };
    }

    var teleS = makeBase(TARGET.TELEGRAM, 'TELEGRAM_SECURE_BINDING');
    var snapS = makeBase(TARGET.SNAPSHOT_STORE, 'KV_SNAPSHOT_BINDING');
    var evalS = makeBase(TARGET.EVALUATION_STORE, 'EVALUATION_STORE_BINDING');
    var auditS = makeBase(TARGET.AUDIT_STORE, 'AUDIT_STORE_BINDING');

    function pushBlockToAll(code) {
      teleS.blockedReasons.push(code);
      snapS.blockedReasons.push(code);
      evalS.blockedReasons.push(code);
      auditS.blockedReasons.push(code);
    }

    if (invalidAdapter) {
      reasons.push('TRANSPORT_EXECUTOR_INTERFACE_ADAPTER_INVALID');
    } else if (credBlocked) {
      reasons.push('CREDENTIAL_FIELD_DETECTED');
      var cbi;
      for (cbi = 0; cbi < credResult.detections.length; cbi++) {
        pushBlockToAll('SECRET_FIELD_BLOCKED:' + credResult.detections[cbi]);
      }
    } else if (envLikeBlocked) {
      reasons.push('ENV_LIKE_OBJECT_DETECTED');
      var eb;
      for (eb = 0; eb < envResult.detections.length; eb++) {
        pushBlockToAll('ENV_LIKE_OBJECT_DETECTED:' + envResult.detections[eb]);
      }
    } else if (depthBlocked) {
      reasons.push('OBJECT_TOO_DEEP_BLOCKED');
      var di;
      for (di = 0; di < envResult.depthBlocks.length; di++) {
        pushBlockToAll('OBJECT_TOO_DEEP_BLOCKED:' + envResult.depthBlocks[di]);
      }
    } else if (functionInputBlocked) {
      reasons.push('FUNCTION_INPUT_DETECTED');
      var fi;
      for (fi = 0; fi < fnResult.detections.length; fi++) {
        pushBlockToAll('FUNCTION_INPUT_BLOCKED:' + fnResult.detections[fi]);
      }
    } else if (modeBlocked) {
      reasons.push('NON_SANDBOX_ONLY_MODE_BLOCKED');
      pushBlockToAll('NON_SANDBOX_ONLY_MODE_BLOCKED');
    } else if (hardBlockBoolean) {
      reasons.push('HARD_BLOCK_BOOLEAN_TRUE');
      if (cfg.liveExecutionAllowed === true) pushBlockToAll('LIVE_EXECUTION_ALLOWED_BLOCKED');
      if (cfg.sideEffectAllowed === true) pushBlockToAll('SIDE_EFFECT_ALLOWED_BLOCKED');
      if (cfg.fetchAllowed === true) pushBlockToAll('FETCH_ALLOWED_BLOCKED');
      if (cfg.writeAllowed === true) pushBlockToAll('WRITE_ALLOWED_BLOCKED');
      if (cfg.credentialLookupAllowed === true) pushBlockToAll('CREDENTIAL_LOOKUP_ALLOWED_BLOCKED');
      if (cfg.bindingLookupAllowed === true) pushBlockToAll('BINDING_LOOKUP_ALLOWED_BLOCKED');
      if (cfg.driverCallAllowed === true) pushBlockToAll('DRIVER_CALL_ALLOWED_BLOCKED');
      if (cfg.retryAllowed === true) pushBlockToAll('RETRY_ALLOWED_BLOCKED');
      if (cfg.timerAllowed === true) pushBlockToAll('TIMER_ALLOWED_BLOCKED');
    } else if (sourceAdapterStatus === 'ADAPTER_BLOCKED') {
      reasons.push('SOURCE_ADAPTER_BLOCKED');
      pushBlockToAll('SOURCE_ADAPTER_BLOCKED');
    } else {
      // STEP 5 — normal sandbox builds
      teleS = buildTelegramSandbox(inp, cfg);
      snapS = buildSnapshotSandbox(inp, cfg);
      evalS = buildEvaluationSandbox(inp, cfg);
      auditS = buildAuditSandbox(inp, cfg);
    }

    // STEP 6 — normalize each sandbox
    teleS = normalizeSandboxTarget(teleS, cfg);
    snapS = normalizeSandboxTarget(snapS, cfg);
    evalS = normalizeSandboxTarget(evalS, cfg);
    auditS = normalizeSandboxTarget(auditS, cfg);

    // STEP 7 — bindingResolverPreview (top-level)
    var bindingResolverPreview = buildBindingResolverPreview(inp, cfg);

    // STEP 8 — summary + classify
    var sandboxes = {
      telegramSandbox: teleS,
      snapshotSandbox: snapS,
      evaluationSandbox: evalS,
      auditSandbox: auditS
    };
    var summary = buildSandboxSummary(sandboxes);
    var safetyFlags = {
      invalidAdapter: invalidAdapter,
      sourceAdapterStatus: sourceAdapterStatus,
      credentialBlocked: credBlocked,
      envLikeBlocked: envLikeBlocked,
      depthBlocked: depthBlocked,
      functionInputBlocked: functionInputBlocked,
      modeBlocked: modeBlocked,
      hardBlockBoolean: hardBlockBoolean
    };
    var sandboxStatus = classifySandboxStatus(sandboxes, safetyFlags, cfg);

    // STEP 9 — reasons
    if (sandboxStatus === SANDBOX_STATUS.READY) reasons.push('SANDBOX_READY');
    if (sandboxStatus === SANDBOX_STATUS.PARTIAL) reasons.push('SANDBOX_PARTIAL');
    if (sandboxStatus === SANDBOX_STATUS.SKIPPED) reasons.push('SANDBOX_SKIPPED');
    if (sandboxStatus === SANDBOX_STATUS.UNKNOWN) reasons.push('SANDBOX_UNKNOWN_FALLBACK');
    if (teleS.ready) reasons.push('TELEGRAM_SANDBOX_READY');
    if (snapS.ready) reasons.push('SNAPSHOT_SANDBOX_READY');
    if (evalS.ready) reasons.push('EVALUATION_SANDBOX_READY');
    if (auditS.ready) reasons.push('AUDIT_SANDBOX_READY');

    // STEP 10 — sandboxPolicy fixed contract
    var sandboxPolicy = {
      sandboxOnly: true,
      sideEffectAllowed: false,
      credentialLookupAllowed: false,
      bindingLookupAllowed: false,
      fetchAllowed: false,
      writeAllowed: false,
      driverCallAllowed: false,
      retryAllowed: false,
      timerAllowed: false,
      liveExecutionRequiresExplicitGate: true
    };

    // STEP 11 — configUsed scalar snapshot
    var configUsed = {
      version: cfg.version,
      sandboxMode: cfg.sandboxMode,
      liveExecutionAllowed: cfg.liveExecutionAllowed,
      sideEffectAllowed: cfg.sideEffectAllowed,
      fetchAllowed: cfg.fetchAllowed,
      writeAllowed: cfg.writeAllowed,
      credentialLookupAllowed: cfg.credentialLookupAllowed,
      bindingLookupAllowed: cfg.bindingLookupAllowed,
      driverCallAllowed: cfg.driverCallAllowed,
      retryAllowed: cfg.retryAllowed,
      timerAllowed: cfg.timerAllowed,
      targets: {
        telegram: { enabled: cfg.targets.telegram.enabled, fixtureProvided: cfg.targets.telegram.fixture !== null },
        snapshot: { enabled: cfg.targets.snapshot.enabled, fixtureProvided: cfg.targets.snapshot.fixture !== null },
        evaluation: { enabled: cfg.targets.evaluation.enabled, fixtureProvided: cfg.targets.evaluation.fixture !== null },
        audit: { enabled: cfg.targets.audit.enabled, fixtureProvided: cfg.targets.audit.fixture !== null }
      },
      safety: {
        blockCredentialFields: cfg.safety.blockCredentialFields,
        credentialMaxDepth: cfg.safety.credentialMaxDepth,
        credentialAllowListSize: cfg.safety.credentialAllowList.length,
        logicalRefAllowListSize: cfg.safety.logicalRefAllowList.length,
        blockEnvLikeObjects: cfg.safety.blockEnvLikeObjects,
        blockObjectTooDeep: cfg.safety.blockObjectTooDeep,
        blockFunctionInputs: cfg.safety.blockFunctionInputs,
        allowRawPayload: cfg.safety.allowRawPayload,
        allowEnvRead: cfg.safety.allowEnvRead,
        allowDirectSecretAccess: cfg.safety.allowDirectSecretAccess,
        allowFunctionInput: cfg.safety.allowFunctionInput,
        allowAsync: cfg.safety.allowAsync
      },
      requestShape: {
        maxStringLength: cfg.requestShape.maxStringLength,
        payloadSummaryAllowedFieldCount: cfg.requestShape.payloadSummaryAllowedFields.length,
        metadataAllowedFieldCount: cfg.requestShape.metadataAllowedFields.length
      },
      wording: { sanitizeMode: cfg.wording.sanitizeMode }
    };

    var draft = {
      valid: invalidAdapter ? false : true,
      version: SANDBOX_VERSION,
      sandboxMode: cfg.sandboxMode === SANDBOX_MODE.SANDBOX_ONLY ? 'SANDBOX_ONLY' : cfg.sandboxMode,
      liveExecutionAllowed: cfg.liveExecutionAllowed === true,
      sandboxStatus: sandboxStatus,
      sourceAdapterStatus: sourceAdapterStatus,
      sandboxPolicy: sandboxPolicy,
      bindingResolverPreview: bindingResolverPreview,
      telegramSandbox: teleS,
      snapshotSandbox: snapS,
      evaluationSandbox: evalS,
      auditSandbox: auditS,
      sandboxSummary: summary,
      reasons: reasons,
      warnings: warnings,
      debug: {
        source: 'transportExecutorInterfaceAdapter + transportExecutorHarness + secureTransportExecutorContract + transportExecutionEnvelope + transportPlan + rendererBinding + operationPacket + activeCycleDecision + evaluationOutcome + externalConfluence',
        configVersion: cfg.version,
        invalidAdapter: invalidAdapter,
        credentialBlocked: credBlocked,
        envLikeBlocked: envLikeBlocked,
        depthBlocked: depthBlocked,
        functionInputBlocked: functionInputBlocked,
        modeBlocked: modeBlocked,
        hardBlockBoolean: hardBlockBoolean,
        credentialDetections: credResult.detections.length,
        envLikeDetections: envResult.detections.length,
        objectTooDeepDetections: envResult.depthBlocks.length,
        functionInputDetections: fnResult.detections.length
      },
      configUsed: configUsed
    };
    return normalizeTransportExecutorSandboxRunner(draft);
  }

  // §export ──────────────────────────────────────────────────────────────

  var api = Object.freeze({
    VERSION: SANDBOX_VERSION,
    DEFAULT_TRANSPORT_EXECUTOR_SANDBOX_RUNNER_CONFIG: DEFAULT_TRANSPORT_EXECUTOR_SANDBOX_RUNNER_CONFIG,
    SANDBOX_MODE: SANDBOX_MODE,
    SANDBOX_STATUS: SANDBOX_STATUS,
    TARGET: TARGET,
    ACTION: ACTION,
    ERROR_TYPE: ERROR_TYPE,
    SIMULATED_STATUS: SIMULATED_STATUS,
    WORDING_SANITIZE_MODE: WORDING_SANITIZE_MODE,
    build: buildTransportExecutorSandboxRunner,
    mergeTransportExecutorSandboxRunnerConfig: mergeTransportExecutorSandboxRunnerConfig,
    buildTelegramSandbox: buildTelegramSandbox,
    buildSnapshotSandbox: buildSnapshotSandbox,
    buildEvaluationSandbox: buildEvaluationSandbox,
    buildAuditSandbox: buildAuditSandbox,
    buildBindingResolverPreview: buildBindingResolverPreview,
    buildDriverCallPreview: buildDriverCallPreview,
    buildResultAdapterPreview: buildResultAdapterPreview,
    buildErrorAdapterPreview: buildErrorAdapterPreview,
    buildRetryPreview: buildRetryPreview,
    buildSandboxFixture: buildSandboxFixture,
    validateSandboxFixture: validateSandboxFixture,
    buildSandboxResult: buildSandboxResult,
    validateSandboxResult: validateSandboxResult,
    classifySandboxStatus: classifySandboxStatus,
    detectCredentialFields: detectCredentialFields,
    detectEnvLikeObjects: detectEnvLikeObjects,
    detectFunctionInputs: detectFunctionInputs,
    validateLogicalRef: validateLogicalRef
  });

  global.WS3_TransportExecutorSandboxRunner = api;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
