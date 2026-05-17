/**
 * WS3 v0.16.0 — TransportExecutorInterfaceAdapter (Interface Adapter)
 *
 * Scope:
 *   transportExecutorHarness (v0.15.0) + secureTransportExecutorContract (v0.14.0) +
 *   transportExecutionEnvelope (v0.13.0) + transportPlan (v0.12.0) +
 *   rendererBinding (v0.12.0) + operationPacket (v0.8.0) +
 *   activeCycleDecision (v0.9.0) + evaluationOutcome (v0.10.0) +
 *   externalConfluence (v0.11.0)
 *   → standalone TransportExecutorInterfaceAdapter (INTERFACE_ONLY, interface boundary spec)
 *
 * 단일 기준 문서:
 *   docs/ws3/WS3_CODE_CONTRACT.md (b-r2 박제본)
 *
 * 확정 DP 정책 (Gate 2 spec):
 *   DP-ADAPTER1   interface adapter 만. 실제 발송 / 저장 / 호출 / binding lookup / retry X.
 *   DP-ADAPTER2   transportExecutorHarness ready/status/gate/dryRunResult 결정을 true 로
 *                 override 금지. rateLimitContract / circuitBreakerContract / dryRunResult 재검증 후 pass-through.
 *   DP-ADAPTER3   adapterMode INTERFACE_ONLY only. LIVE / REAL / EXECUTE → ADAPTER_BLOCKED.
 *   DP-ADAPTER4   liveExecutionAllowed / sideEffectAllowed / fetchAllowed / writeAllowed /
 *                 credentialLookupAllowed / bindingLookupAllowed / driverCallAllowed / retryAllowed
 *                 중 하나라도 true → ADAPTER_BLOCKED (hard block 8 boolean).
 *   DP-ADAPTER5   function 객체 / async function / Promise / resolver function / driver function /
 *                 retry function 을 input/config 로 받지 않는다. function input 감지 시 ADAPTER_BLOCKED.
 *   DP-ADAPTER6   credential 값 / process.env / env 객체 / secure binding value 읽기 0건.
 *                 env-like object 차단. logicalRef 도 credential / function pattern 검사 통과 필수.
 *   DP-ADAPTER7   requestShape / payloadSummary / metadata 는 whitelist scalar 만.
 *                 원본 객체 spread / Object.assign / deep clone / for-in 금지.
 *                 v0.15 harness 의 requestShape / payloadSummary / metadata 도 재검증.
 *   DP-ADAPTER8   dry-run / interface wording 만. 발송됨 / sent / delivered / 손절 / 익절 등 금지.
 *   DP-ADAPTER9   9종 입력 (transportExecutorHarness + secureTransportExecutorContract +
 *                 transportExecutionEnvelope + transportPlan + rendererBinding + operationPacket +
 *                 activeCycleDecision + evaluationOutcome + externalConfluence) read-only.
 *   DP-ADAPTER10  신규 파일 1개 + 문서 갱신만. 보호 파일 28종 수정 금지.
 *
 * N-ADAPTER-OBS 처리:
 *   N-ADAPTER-OBS-1  보호 baseline false-positive — 본 모듈 fetch / Date.now / new Date /
 *                    performance.now / Object.assign / spread / deep clone / for-in /
 *                    async / await / Promise / setTimeout / setInterval 0건.
 *   N-ADAPTER-OBS-2  신규 식별자 fresh — TransportExecutorInterfaceAdapter* / *Interface /
 *                    ADAPTER_* / classifyAdapterStatus 등 충돌 0건.
 *   N-ADAPTER-OBS-3  v0.15 harness shape 정합 — telegramHarness/snapshotHarness/
 *                    evaluationHarness/auditHarness.ready / harnessStatus / harnessMode 참조.
 *                    ready/status/gate/dryRunResult 결정 override 금지.
 *   N-ADAPTER-OBS-4  target ↔ action 매핑 (1:1):
 *                    TELEGRAM → TELEGRAM_SEND, SNAPSHOT_STORE → SNAPSHOT_WRITE,
 *                    EVALUATION_STORE → EVALUATION_WRITE, AUDIT_STORE → AUDIT_WRITE.
 *                    buildDryRunResultFromHarness 에서 v0.15 harness.dryRunResult.action 검증.
 *                    mismatch → INVALID_DRY_RUN_RESULT:ACTION_TARGET_MISMATCH:<target>.
 *   N-ADAPTER-OBS-5  validateLogicalRef credential pattern 우선순위 — credential keyword
 *                    감지 시 즉시 차단. 일반 용어 허용 list (SECURE/BINDING/BUCKET/CHANNEL/
 *                    STORE/SCHEMA/HANDLE/DRIVER/METHOD/RESULT/ERROR/RETRY) 는 credential
 *                    차단 override 불가.
 *   N-ADAPTER-OBS-6  buildSafePayloadSummary / buildSafeMetadata / validateBindingRef 동명 —
 *                    IIFE module-private. global export 미포함. v0.13/v0.14/v0.15 와 파일 scope 분리.
 *   N-ADAPTER-OBS-7  보호 파일 28종 — v0.15 commit 이후 `v3-transport-executor-harness.js` 추가.
 *                    본 단계 28종 무손상 (`worker.js` / `wrangler.toml` 포함).
 *
 * 출력 (top-level):
 *   valid, version, adapterMode, liveExecutionAllowed, adapterStatus, sourceHarnessStatus,
 *   adapterPolicy, bindingResolverContract, telegramInterface, snapshotInterface,
 *   evaluationInterface, auditInterface, adapterSummary, reasons[], warnings[], debug, configUsed
 *
 * adapterStatus 6 후보 (first-match-wins):
 *   ADAPTER_INVALID  → transportExecutorHarness missing 또는 valid !== true
 *   ADAPTER_BLOCKED  → source HARNESS_BLOCKED/INVALID, credential 감지, env-like 감지,
 *                      function input 감지, adapterMode!==INTERFACE_ONLY, hard-block 8 boolean,
 *                      invalid logical ref / rateLimitContract / circuitBreakerContract / dryRunResult
 *   ADAPTER_PARTIAL  → ≥1 ready true + ≥1 blocker
 *   ADAPTER_READY    → source HARNESS_READY/PARTIAL + ≥1 ready true + blocker 0
 *   ADAPTER_SKIPPED  → source HARNESS_SKIPPED, 또는 모든 ready false + blocker 0
 *   ADAPTER_UNKNOWN  → fallback
 *
 * 의도된 미구현 (이번 단계 제외):
 *   실제 Telegram bot API 호출 / chatId / botToken / webhookUrl 노출.
 *   실제 KV write / DB persist / 파일 IO / 브라우저 storage.
 *   실제 binding lookup / env 접근 / process.env / Cloudflare env.
 *   실제 driver call / retry 실행 / circuit breaker 상태 변경 / rate limit 카운터 증가.
 *   실제 DOM 렌더 / HTML attach / addEventListener.
 *   async function / await / Promise / setTimeout / setInterval (sync only).
 *   raw payload / payload.raw / identityInput / raw.builderDebug 노출.
 *
 * 함수 목록 (§12 spec):
 *   mergeTransportExecutorInterfaceAdapterConfig(config)
 *   buildTransportExecutorInterfaceAdapter(input, config)        ← 진입점
 *   buildTelegramInterface / buildSnapshotInterface / buildEvaluationInterface / buildAuditInterface
 *   buildBindingResolverContract(input, cfg)
 *   buildInterfaceSpec(harness, target, cfg)
 *   buildDriverCallContract(harness, target, cfg)
 *   buildResultAdapterContract(harness, target, cfg)
 *   buildErrorAdapterContract(harness, target, cfg)
 *   buildRetryAdapterContract(harness, target, cfg)
 *   buildRateLimitContractFromHarness(harness, target, cfg)
 *   buildCircuitBreakerContractFromHarness(harness, target, cfg)
 *   buildDryRunResultFromHarness(harness, target, cfg)
 *   buildSafeRequestShape(harness, target, cfg)
 *   buildSafePayloadSummary(input, cfg)                          ← IIFE module-private
 *   buildSafeMetadata(input, cfg)                                ← IIFE module-private
 *   buildAdapterSummary(interfaces, cfg)
 *   classifyAdapterStatus(interfaces, safety, cfg)
 *   detectCredentialFields / detectEnvLikeObjects / detectFunctionInputs
 *   validateLogicalRef(ref, cfg)
 *   sanitizeMessageLines(lines, cfg)
 *   normalizeInterfaceTarget / normalizeTransportExecutorInterfaceAdapter
 *   isPlainObject, safeString, safeNumber, pushReason, pushWarning
 *
 * export:
 *   global.WS3_TransportExecutorInterfaceAdapter + module.exports
 */
(function(global) {
  'use strict';

  // §version
  var ADAPTER_VERSION = 'WS3_v0.16.0_transport_executor_interface_adapter';

  // §adapterMode (only INTERFACE_ONLY allowed)
  var ADAPTER_MODE = Object.freeze({
    INTERFACE_ONLY: 'INTERFACE_ONLY'
  });

  // §adapterStatus 6 후보
  var ADAPTER_STATUS = Object.freeze({
    READY: 'ADAPTER_READY',
    SKIPPED: 'ADAPTER_SKIPPED',
    BLOCKED: 'ADAPTER_BLOCKED',
    PARTIAL: 'ADAPTER_PARTIAL',
    INVALID: 'ADAPTER_INVALID',
    UNKNOWN: 'ADAPTER_UNKNOWN'
  });

  // §target enum
  var TARGET = Object.freeze({
    TELEGRAM: 'TELEGRAM',
    SNAPSHOT_STORE: 'SNAPSHOT_STORE',
    EVALUATION_STORE: 'EVALUATION_STORE',
    AUDIT_STORE: 'AUDIT_STORE'
  });

  // §action enum (1:1 target ↔ action 매핑, N-ADAPTER-OBS-4)
  var ACTION = Object.freeze({
    TELEGRAM_SEND: 'TELEGRAM_SEND',
    SNAPSHOT_WRITE: 'SNAPSHOT_WRITE',
    EVALUATION_WRITE: 'EVALUATION_WRITE',
    AUDIT_WRITE: 'AUDIT_WRITE'
  });

  // §target → action lookup
  function getActionForTarget(target) {
    if (target === TARGET.TELEGRAM) return ACTION.TELEGRAM_SEND;
    if (target === TARGET.SNAPSHOT_STORE) return ACTION.SNAPSHOT_WRITE;
    if (target === TARGET.EVALUATION_STORE) return ACTION.EVALUATION_WRITE;
    if (target === TARGET.AUDIT_STORE) return ACTION.AUDIT_WRITE;
    return null;
  }

  // §driver method enum (interface boundary — no real call)
  var DRIVER_METHOD = Object.freeze({
    TELEGRAM: 'SEND_MESSAGE',
    SNAPSHOT_STORE: 'WRITE_SNAPSHOT',
    EVALUATION_STORE: 'WRITE_EVALUATION',
    AUDIT_STORE: 'WRITE_AUDIT'
  });

  function getDriverMethodForTarget(target) {
    if (target === TARGET.TELEGRAM) return DRIVER_METHOD.TELEGRAM;
    if (target === TARGET.SNAPSHOT_STORE) return DRIVER_METHOD.SNAPSHOT_STORE;
    if (target === TARGET.EVALUATION_STORE) return DRIVER_METHOD.EVALUATION_STORE;
    if (target === TARGET.AUDIT_STORE) return DRIVER_METHOD.AUDIT_STORE;
    return null;
  }

  // §future driver / schema logical handle refs
  function getFutureDriverRef(target) {
    if (target === TARGET.TELEGRAM) return 'FUTURE_TELEGRAM_DRIVER';
    if (target === TARGET.SNAPSHOT_STORE) return 'FUTURE_SNAPSHOT_DRIVER';
    if (target === TARGET.EVALUATION_STORE) return 'FUTURE_EVALUATION_DRIVER';
    if (target === TARGET.AUDIT_STORE) return 'FUTURE_AUDIT_DRIVER';
    return null;
  }

  function getInputSchemaRef(target) {
    if (target === TARGET.TELEGRAM) return 'TELEGRAM_MESSAGE_SCHEMA';
    if (target === TARGET.SNAPSHOT_STORE) return 'SNAPSHOT_WRITE_SCHEMA';
    if (target === TARGET.EVALUATION_STORE) return 'EVALUATION_WRITE_SCHEMA';
    if (target === TARGET.AUDIT_STORE) return 'AUDIT_WRITE_SCHEMA';
    return null;
  }

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

  // §RESERVED 프레임워크 metadata 키 — N-ADAPTER-OBS 정합 (v0.13/v0.14/v0.15/v0.16 metadata)
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
    'blockCredentialFields',
    // *Secret* / *Token* policy metadata fields
    'allowWebhookUrl',
    'allowDirectSecretAccess',
    'directSecretAccessAllowed',
    // binding ref policy fields
    'bindingRefAllowList',
    'bindingRefAllowListSize',
    'bindingRefCredentialPatternBlocked',
    // logical ref policy fields (v0.16 신규)
    'logicalRefAllowList',
    'logicalRefAllowListSize',
    'logicalRefCredentialPatternBlocked',
    'logicalRefFunctionPatternBlocked'
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

  // §logical ref 금지 substring (v0.14 BINDING_REF_FORBIDDEN_SUBSTRINGS 와 동일 + 확장)
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

  // §logical ref function-body / code pattern (DP-ADAPTER5 — function input 차단)
  //   token-level match (case-insensitive). UPPER_SNAKE_CASE ref 를 '_' 로 split 한 각 token 이
  //   아래 token 중 하나와 일치 시 block.
  //   token-level 매칭 이유: 'eval' substring 이 'EVALUATION' 안에 자연스럽게 포함되어
  //   false positive 발생 가능. 'EVAL_REF' 는 차단, 'EVALUATION_STORE_BINDING' 은 허용.
  //   특수문자 ( ) { } => ; 등은 정규식 `^[A-Z][A-Z0-9_]*$` 에서 이미 차단.
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

  // §forbidden wording (DP-ADAPTER8) — v0.15 동일
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

  // §errorType enum (interface boundary)
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

  // §DEFAULT_CONFIG
  var DEFAULT_TRANSPORT_EXECUTOR_INTERFACE_ADAPTER_CONFIG = Object.freeze({
    version: 'inline-default-v0',
    adapterMode: 'INTERFACE_ONLY',
    liveExecutionAllowed: false,
    sideEffectAllowed: false,
    fetchAllowed: false,
    writeAllowed: false,
    credentialLookupAllowed: false,
    bindingLookupAllowed: false,
    driverCallAllowed: false,
    retryAllowed: false,
    targets: Object.freeze({
      telegram: Object.freeze({ enabled: true }),
      snapshot: Object.freeze({ enabled: true }),
      evaluation: Object.freeze({ enabled: true }),
      audit: Object.freeze({ enabled: true })
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
    wording: Object.freeze({
      sanitizeMode: 'REJECT'
    }),
    debug: Object.freeze({
      enabled: false,
      allowedFields: Object.freeze([])
    })
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
  function mergeTransportExecutorInterfaceAdapterConfig(config) {
    var c = isPlainObject(config) ? config : {};
    var d = DEFAULT_TRANSPORT_EXECUTOR_INTERFACE_ADAPTER_CONFIG;

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

    return {
      version: (typeof c.version === 'string' && c.version.length > 0) ? c.version : d.version,
      adapterMode: (typeof c.adapterMode === 'string' && c.adapterMode.length > 0) ? c.adapterMode : d.adapterMode,
      liveExecutionAllowed: c.liveExecutionAllowed === true,
      sideEffectAllowed: c.sideEffectAllowed === true,
      fetchAllowed: c.fetchAllowed === true,
      writeAllowed: c.writeAllowed === true,
      credentialLookupAllowed: c.credentialLookupAllowed === true,
      bindingLookupAllowed: c.bindingLookupAllowed === true,
      driverCallAllowed: c.driverCallAllowed === true,
      retryAllowed: c.retryAllowed === true,
      targets: {
        telegram: { enabled: tgTele.enabled !== false },
        snapshot: { enabled: tgSnap.enabled !== false },
        evaluation: { enabled: tgEval.enabled !== false },
        audit: { enabled: tgAudit.enabled !== false }
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
      debug: {
        enabled: db.enabled === true,
        allowedFields: debugAllowed
      }
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

  // detectFunctionInputs — function / async / Promise / thenable 차단
  function detectFunctionInputs(input, config) {
    var cfg = mergeTransportExecutorInterfaceAdapterConfig(config);
    var detections = [];

    if (cfg.safety.blockFunctionInputs !== true) {
      return { detections: detections };
    }

    function isFunctionLike(value) {
      if (typeof value === 'function') return true;
      // thenable / promise-like (has .then function)
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
        if (isFunctionLike(iv)) {
          detections.push('input.' + ik);
          continue;
        }
        walk(iv, 'input.' + ik, 1);
      }
    }
    if (isPlainObject(config)) {
      var cKeys = Object.keys(config);
      var cx;
      for (cx = 0; cx < cKeys.length; cx++) {
        var ck = cKeys[cx];
        var cv = config[ck];
        if (isFunctionLike(cv)) {
          detections.push('config.' + ck);
          continue;
        }
        walk(cv, 'config.' + ck, 1);
      }
    }
    return { detections: detections };
  }

  function detectCredentialFields(input, config) {
    var cfg = mergeTransportExecutorInterfaceAdapterConfig(config);
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
    var cfg = mergeTransportExecutorInterfaceAdapterConfig(config);
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

  // §validateLogicalRef (DP-ADAPTER5/6 — credential pattern 우선 + function pattern 차단)

  var LOGICAL_REF_PATTERN = /^[A-Z][A-Z0-9_]*$/;

  function validateLogicalRef(ref, cfg) {
    var allowList = (cfg && cfg.safety && Array.isArray(cfg.safety.logicalRefAllowList))
      ? cfg.safety.logicalRefAllowList
      : [];
    // allowList check first — exact match
    if (Array.isArray(allowList)) {
      var a;
      for (a = 0; a < allowList.length; a++) {
        if (allowList[a] === ref) return { valid: true, reason: null };
      }
    }

    // 7.1 형식
    if (typeof ref !== 'string') return { valid: false, reason: 'LOGICAL_REF_INVALID_FORMAT' };
    if (ref.length < 3 || ref.length > 64) return { valid: false, reason: 'LOGICAL_REF_INVALID_FORMAT' };
    if (!LOGICAL_REF_PATTERN.test(ref)) return { valid: false, reason: 'LOGICAL_REF_INVALID_FORMAT' };

    // 7.3 credential pattern 우선 (N-ADAPTER-OBS-5)
    var credAllow = (cfg && cfg.safety && Array.isArray(cfg.safety.credentialAllowList))
      ? cfg.safety.credentialAllowList
      : [];
    if (isCredentialKey(ref, credAllow)) {
      return { valid: false, reason: 'LOGICAL_REF_CONTAINS_CREDENTIAL_PATTERN' };
    }

    // 7.2 금지 substring
    var i;
    for (i = 0; i < LOGICAL_REF_FORBIDDEN_SUBSTRINGS.length; i++) {
      if (ref.indexOf(LOGICAL_REF_FORBIDDEN_SUBSTRINGS[i]) !== -1) {
        return { valid: false, reason: 'LOGICAL_REF_INVALID_FORMAT' };
      }
    }
    if (/bot[0-9]+/i.test(ref)) return { valid: false, reason: 'LOGICAL_REF_INVALID_FORMAT' };
    if (/^[0-9]+$/.test(ref)) return { valid: false, reason: 'LOGICAL_REF_INVALID_FORMAT' };

    // 7.4 function-body / code pattern (token-level match)
    //   UPPER_SNAKE_CASE 토큰 단위 매칭 — 'EVAL' 토큰 차단 / 'EVALUATION' 토큰 허용
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
      if (hit === null) {
        result.lines.push(line);
        continue;
      }
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

  // §payloadSummary / metadata revalidation (DP-ADAPTER7 — v0.15 신뢰 X)

  function buildSafePayloadSummary(harnessSummary, cfg) {
    var warnings = [];
    var out = {};
    var allowed = (cfg && cfg.requestShape && Array.isArray(cfg.requestShape.payloadSummaryAllowedFields))
      ? cfg.requestShape.payloadSummaryAllowedFields
      : [];
    var maxLen = (cfg && cfg.requestShape && typeof cfg.requestShape.maxStringLength === 'number')
      ? cfg.requestShape.maxStringLength
      : 200;
    var allowList = (cfg && cfg.safety && Array.isArray(cfg.safety.credentialAllowList))
      ? cfg.safety.credentialAllowList
      : [];

    if (!isPlainObject(harnessSummary)) return { summary: out, warnings: warnings };

    var i;
    for (i = 0; i < allowed.length; i++) {
      var fld = allowed[i];
      if (typeof fld !== 'string' || fld.length === 0) continue;
      if (isCredentialKey(fld, allowList)) {
        warnings.push('CREDENTIAL_FIELD_REJECTED:' + fld);
        continue;
      }
      if (Object.prototype.hasOwnProperty.call(harnessSummary, fld) === false) {
        out[fld] = null;
        continue;
      }
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
      ? cfg.requestShape.metadataAllowedFields
      : [];
    if (allowed.length === 0) return { metadata: out, warnings: warnings };
    if (!isPlainObject(harnessMetadata)) return { metadata: out, warnings: warnings };

    var maxLen = (cfg && cfg.requestShape && typeof cfg.requestShape.maxStringLength === 'number')
      ? cfg.requestShape.maxStringLength
      : 200;
    var allowList = (cfg && cfg.safety && Array.isArray(cfg.safety.credentialAllowList))
      ? cfg.safety.credentialAllowList
      : [];

    var i;
    for (i = 0; i < allowed.length; i++) {
      var fld = allowed[i];
      if (typeof fld !== 'string' || fld.length === 0) continue;
      if (isCredentialKey(fld, allowList)) {
        warnings.push('CREDENTIAL_METADATA_FIELD_REJECTED:' + fld);
        continue;
      }
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

  // §pass-through revalidation helpers (DP-ADAPTER2)

  function buildRateLimitContractFromHarness(harness, targetType /*, cfg */) {
    var src = (harness && isPlainObject(harness.rateLimitContract)) ? harness.rateLimitContract : null;
    if (src === null) return { contract: null, valid: false };
    var enabled = src.enabled === true;
    var key = src.key;
    var windowMs = src.windowMs;
    var maxAttempts = src.maxAttempts;
    // re-validate
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

  function buildCircuitBreakerContractFromHarness(harness /*, targetType, cfg */) {
    var src = (harness && isPlainObject(harness.circuitBreakerContract)) ? harness.circuitBreakerContract : null;
    if (src === null) return { contract: null, valid: false };
    var enabled = src.enabled === true;
    var state = src.state;
    var failureThreshold = src.failureThreshold;
    // OPEN_IN_DRY_RUN only (DP-ADAPTER3 / DP-ADAPTER7). CLOSED / HALF_OPEN 금지.
    var stateValid = (state === 'OPEN_IN_DRY_RUN');
    var thresholdValid = (typeof failureThreshold === 'number' && isFinite(failureThreshold) && failureThreshold > 0);
    var ok = enabled && stateValid && thresholdValid;
    if (!ok) return { contract: null, valid: false };
    return {
      contract: { enabled: enabled, state: state, failureThreshold: failureThreshold },
      valid: true
    };
  }

  function buildDryRunResultFromHarness(harness, targetType /*, cfg */) {
    var src = (harness && isPlainObject(harness.dryRunResult)) ? harness.dryRunResult : null;
    if (src === null) return { result: null, valid: false, reason: 'MISSING_DRY_RUN_RESULT' };
    var wouldExecute = src.wouldExecute;
    var action = src.action;
    var resultType = src.resultType;
    // wouldExecute MUST be false
    if (wouldExecute !== false) return { result: null, valid: false, reason: 'WOULD_EXECUTE_NOT_FALSE' };
    // resultType MUST be DRY_RUN_ONLY
    if (resultType !== 'DRY_RUN_ONLY') return { result: null, valid: false, reason: 'INVALID_RESULT_TYPE' };
    // action MUST match target
    var expectedAction = getActionForTarget(targetType);
    if (action !== expectedAction) return { result: null, valid: false, reason: 'ACTION_TARGET_MISMATCH' };
    return {
      result: { wouldExecute: false, action: action, resultType: 'DRY_RUN_ONLY' },
      valid: true
    };
  }

  // §contract builders (interface boundary only)

  function buildBindingResolverContract(/* input, cfg */) {
    // v0.16 — lookup 0건. resolverRef logical only.
    return {
      lookupAllowed: false,
      resolverRef: 'FUTURE_SECURE_BINDING_RESOLVER',
      credentialHandleRef: 'SECURE_CREDENTIAL_HANDLE_REF',
      bindingRef: 'LOGICAL_BINDING_REF',
      schema: {
        inputRef: null,
        outputRef: null
      }
    };
  }

  function buildDriverCallContract(harness, targetType /*, cfg */) {
    return {
      callAllowed: false,
      callMode: 'INTERFACE_ONLY',
      wouldCall: false,
      driverRef: getFutureDriverRef(targetType),
      methodRef: getDriverMethodForTarget(targetType),
      inputSchemaRef: getInputSchemaRef(targetType),
      outputSchemaRef: 'TRANSPORT_RESULT_SCHEMA'
    };
  }

  function buildResultAdapterContract(/* harness, targetType, cfg */) {
    return {
      resultType: 'INTERFACE_ONLY',
      rawResponseAllowed: false,
      safeFields: ['action', 'resultType', 'wouldExecute', 'timestampHint'],
      timestampHint: null   // v0.16 에서는 값 생성하지 않음 (Date.now 금지)
    };
  }

  function buildErrorAdapterContract(/* harness, targetType, cfg */) {
    return {
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

  function buildRetryAdapterContract(/* harness, targetType, cfg */) {
    return {
      retryAllowed: false,
      maxRetries: 0,
      backoffMs: 0,
      retryableErrors: []
    };
  }

  // §buildInterfaceSpec (sync request shape)

  function buildInterfaceSpec(harness, targetType, cfg) {
    var warnings = [];
    var h = isPlainObject(harness) ? harness : {};
    var hReq = isPlainObject(h.requestShape) ? h.requestShape : {};
    var hSummary = isPlainObject(hReq.payloadSummary) ? hReq.payloadSummary : {};
    var hMeta = isPlainObject(hReq.metadata) ? hReq.metadata : {};

    var sumResult = buildSafePayloadSummary(hSummary, cfg);
    var i;
    for (i = 0; i < sumResult.warnings.length; i++) warnings.push(sumResult.warnings[i]);

    var metaResult = buildSafeMetadata(hMeta, cfg);
    var m;
    for (m = 0; m < metaResult.warnings.length; m++) warnings.push(metaResult.warnings[m]);

    var maxLen = (cfg && cfg.requestShape && typeof cfg.requestShape.maxStringLength === 'number')
      ? cfg.requestShape.maxStringLength : 200;

    var requestShape;
    if (targetType === TARGET.TELEGRAM) {
      var lines = [];
      if (Array.isArray(hReq.lines)) {
        var s = sanitizeMessageLines(hReq.lines, cfg);
        var li;
        for (li = 0; li < s.warnings.length; li++) warnings.push(s.warnings[li]);
        lines = s.lines;
      }
      requestShape = {
        channelRef: 'SECURE_CHANNEL_REF',
        messageType: (typeof hReq.messageType === 'string') ? safeString(hReq.messageType, maxLen) : 'NONE',
        title: (typeof hReq.title === 'string') ? safeString(hReq.title, maxLen) : null,
        lines: lines,
        payloadSummary: sumResult.summary,
        metadata: metaResult.metadata
      };
      if (requestShape.messageType === null) requestShape.messageType = 'NONE';
    } else if (targetType === TARGET.SNAPSHOT_STORE) {
      requestShape = {
        bucketRef: 'SECURE_BUCKET_REF',
        snapshotType: (typeof hReq.snapshotType === 'string') ? safeString(hReq.snapshotType, maxLen) : 'NONE',
        keyHint: (typeof hReq.keyHint === 'string') ? safeString(hReq.keyHint, maxLen) : null,
        payloadSummary: sumResult.summary,
        metadata: metaResult.metadata
      };
      if (requestShape.snapshotType === null) requestShape.snapshotType = 'NONE';
    } else if (targetType === TARGET.EVALUATION_STORE) {
      requestShape = {
        evaluationType: (typeof hReq.evaluationType === 'string') ? safeString(hReq.evaluationType, maxLen) : 'NONE',
        resultType: (typeof hReq.resultType === 'string') ? safeString(hReq.resultType, maxLen) : 'NONE',
        keyHint: (typeof hReq.keyHint === 'string') ? safeString(hReq.keyHint, maxLen) : null,
        payloadSummary: sumResult.summary,
        metadata: metaResult.metadata
      };
      if (requestShape.evaluationType === null) requestShape.evaluationType = 'NONE';
      if (requestShape.resultType === null) requestShape.resultType = 'NONE';
    } else if (targetType === TARGET.AUDIT_STORE) {
      requestShape = {
        auditType: (typeof hReq.auditType === 'string') ? safeString(hReq.auditType, maxLen) : 'NONE',
        keyHint: (typeof hReq.keyHint === 'string') ? safeString(hReq.keyHint, maxLen) : null,
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

  // buildSafeRequestShape alias (spec §12 export name)
  function buildSafeRequestShape(harness, targetType, cfg) {
    var spec = buildInterfaceSpec(harness, targetType, cfg);
    return { requestShape: spec.requestShape, warnings: spec.warnings };
  }

  // §interface builders

  function isReadyHarness(harness) {
    return isPlainObject(harness) && harness.ready === true;
  }

  function buildInterfaceForTarget(targetType, harness, cfg) {
    var blockedReasons = [];
    var warnings = [];
    var sourceReady = isReadyHarness(harness);

    var targetEnabled;
    if (targetType === TARGET.TELEGRAM) targetEnabled = cfg.targets.telegram.enabled === true;
    else if (targetType === TARGET.SNAPSHOT_STORE) targetEnabled = cfg.targets.snapshot.enabled === true;
    else if (targetType === TARGET.EVALUATION_STORE) targetEnabled = cfg.targets.evaluation.enabled === true;
    else if (targetType === TARGET.AUDIT_STORE) targetEnabled = cfg.targets.audit.enabled === true;
    else targetEnabled = false;

    var modeOk = cfg.adapterMode === ADAPTER_MODE.INTERFACE_ONLY;
    var liveNotAllowed = cfg.liveExecutionAllowed !== true;
    var sideNotAllowed = cfg.sideEffectAllowed !== true;
    var fetchNotAllowed = cfg.fetchAllowed !== true;
    var writeNotAllowed = cfg.writeAllowed !== true;
    var credLookupNotAllowed = cfg.credentialLookupAllowed !== true;
    var bindingLookupNotAllowed = cfg.bindingLookupAllowed !== true;
    var driverCallNotAllowed = cfg.driverCallAllowed !== true;
    var retryNotAllowed = cfg.retryAllowed !== true;

    if (!sourceReady) blockedReasons.push('SOURCE_HARNESS_NOT_READY');
    if (!targetEnabled) blockedReasons.push('CONFIG_DISALLOW_TARGET:' + targetType);
    if (!modeOk) blockedReasons.push('NON_INTERFACE_ONLY_MODE_BLOCKED');
    if (!liveNotAllowed) blockedReasons.push('LIVE_EXECUTION_ALLOWED_BLOCKED');
    if (!sideNotAllowed) blockedReasons.push('SIDE_EFFECT_ALLOWED_BLOCKED');
    if (!fetchNotAllowed) blockedReasons.push('FETCH_ALLOWED_BLOCKED');
    if (!writeNotAllowed) blockedReasons.push('WRITE_ALLOWED_BLOCKED');
    if (!credLookupNotAllowed) blockedReasons.push('CREDENTIAL_LOOKUP_ALLOWED_BLOCKED');
    if (!bindingLookupNotAllowed) blockedReasons.push('BINDING_LOOKUP_ALLOWED_BLOCKED');
    if (!driverCallNotAllowed) blockedReasons.push('DRIVER_CALL_ALLOWED_BLOCKED');
    if (!retryNotAllowed) blockedReasons.push('RETRY_ALLOWED_BLOCKED');

    // logicalRef 검증 — bindingRef / driverRef / methodRef / inputSchemaRef / outputSchemaRef
    var driverRef = getFutureDriverRef(targetType);
    var methodRef = getDriverMethodForTarget(targetType);
    var inputSchemaRef = getInputSchemaRef(targetType);
    var outputSchemaRef = 'TRANSPORT_RESULT_SCHEMA';
    var bindingRef = (isPlainObject(harness) && typeof harness.bindingRef === 'string')
      ? harness.bindingRef
      : (targetType === TARGET.TELEGRAM ? 'TELEGRAM_SECURE_BINDING'
        : targetType === TARGET.SNAPSHOT_STORE ? 'KV_SNAPSHOT_BINDING'
        : targetType === TARGET.EVALUATION_STORE ? 'EVALUATION_STORE_BINDING'
        : 'AUDIT_STORE_BINDING');

    var refsToCheck = [
      { name: 'bindingRef', val: bindingRef },
      { name: 'driverRef', val: driverRef },
      { name: 'methodRef', val: methodRef },
      { name: 'inputSchemaRef', val: inputSchemaRef },
      { name: 'outputSchemaRef', val: outputSchemaRef }
    ];
    var refOk = true;
    var rc;
    for (rc = 0; rc < refsToCheck.length; rc++) {
      var refItem = refsToCheck[rc];
      var vr = validateLogicalRef(refItem.val, cfg);
      if (vr.valid !== true) {
        refOk = false;
        blockedReasons.push((vr.reason || 'LOGICAL_REF_INVALID') + ':' + refItem.name + ':' + targetType);
      }
    }

    // rateLimitContract / circuitBreakerContract / dryRunResult re-validate
    var rlResult = buildRateLimitContractFromHarness(harness, targetType, cfg);
    if (rlResult.valid !== true) blockedReasons.push('INVALID_RATE_LIMIT_CONTRACT:' + targetType);
    var cbResult = buildCircuitBreakerContractFromHarness(harness, targetType, cfg);
    if (cbResult.valid !== true) blockedReasons.push('INVALID_CIRCUIT_BREAKER_CONTRACT:' + targetType);
    var drResult = buildDryRunResultFromHarness(harness, targetType, cfg);
    if (drResult.valid !== true) {
      var drReason = drResult.reason || 'INVALID_DRY_RUN_RESULT';
      if (drReason === 'ACTION_TARGET_MISMATCH') {
        blockedReasons.push('INVALID_DRY_RUN_RESULT:ACTION_TARGET_MISMATCH:' + targetType);
      } else {
        blockedReasons.push('INVALID_DRY_RUN_RESULT:' + drReason + ':' + targetType);
      }
    }

    var ready = sourceReady && targetEnabled && modeOk && liveNotAllowed
                && sideNotAllowed && fetchNotAllowed && writeNotAllowed
                && credLookupNotAllowed && bindingLookupNotAllowed
                && driverCallNotAllowed && retryNotAllowed
                && refOk && rlResult.valid && cbResult.valid && drResult.valid;

    // interfaceSpec
    var spec = buildInterfaceSpec(harness, targetType, cfg);
    var sw;
    for (sw = 0; sw < spec.warnings.length; sw++) warnings.push(spec.warnings[sw]);

    return {
      ready: ready,
      target: targetType,
      adapterMode: 'INTERFACE_ONLY',
      sideEffectAllowed: false,
      bindingRef: bindingRef,
      interfaceSpec: {
        action: spec.action,
        requestShape: spec.requestShape
      },
      driverCallContract: buildDriverCallContract(harness, targetType, cfg),
      resultAdapterContract: buildResultAdapterContract(harness, targetType, cfg),
      errorAdapterContract: buildErrorAdapterContract(harness, targetType, cfg),
      retryAdapterContract: buildRetryAdapterContract(harness, targetType, cfg),
      rateLimitContract: rlResult.valid ? rlResult.contract : null,
      circuitBreakerContract: cbResult.valid ? cbResult.contract : null,
      dryRunResult: drResult.valid ? drResult.result : null,
      blockedReasons: blockedReasons,
      warnings: warnings
    };
  }

  function buildTelegramInterface(input, cfg) {
    var src = isPlainObject(input.transportExecutorHarness) ? input.transportExecutorHarness : null;
    var harness = (src && isPlainObject(src.telegramHarness)) ? src.telegramHarness : null;
    return buildInterfaceForTarget(TARGET.TELEGRAM, harness, cfg);
  }

  function buildSnapshotInterface(input, cfg) {
    var src = isPlainObject(input.transportExecutorHarness) ? input.transportExecutorHarness : null;
    var harness = (src && isPlainObject(src.snapshotHarness)) ? src.snapshotHarness : null;
    return buildInterfaceForTarget(TARGET.SNAPSHOT_STORE, harness, cfg);
  }

  function buildEvaluationInterface(input, cfg) {
    var src = isPlainObject(input.transportExecutorHarness) ? input.transportExecutorHarness : null;
    var harness = (src && isPlainObject(src.evaluationHarness)) ? src.evaluationHarness : null;
    return buildInterfaceForTarget(TARGET.EVALUATION_STORE, harness, cfg);
  }

  function buildAuditInterface(input, cfg) {
    var src = isPlainObject(input.transportExecutorHarness) ? input.transportExecutorHarness : null;
    var harness = (src && isPlainObject(src.auditHarness)) ? src.auditHarness : null;
    return buildInterfaceForTarget(TARGET.AUDIT_STORE, harness, cfg);
  }

  // §summary / classify

  function buildAdapterSummary(interfaces /*, cfg */) {
    var readyCount = 0;
    var blockedCount = 0;
    var skippedCount = 0;
    var interfaceOnlyCount = 0;
    var hasReadyTarget = false;
    var hasBlocker = false;

    var keys = ['telegramInterface', 'snapshotInterface', 'evaluationInterface', 'auditInterface'];
    var i;
    for (i = 0; i < keys.length; i++) {
      var t = interfaces[keys[i]];
      if (!isPlainObject(t)) continue;
      if (t.adapterMode === 'INTERFACE_ONLY') interfaceOnlyCount += 1;
      if (t.ready === true) {
        hasReadyTarget = true;
        readyCount += 1;
      } else if (Array.isArray(t.blockedReasons) && t.blockedReasons.length > 0) {
        var realBlock = false;
        var br;
        for (br = 0; br < t.blockedReasons.length; br++) {
          if (t.blockedReasons[br] !== 'SOURCE_HARNESS_NOT_READY') { realBlock = true; break; }
        }
        if (realBlock) { blockedCount += 1; hasBlocker = true; }
        else skippedCount += 1;
      } else {
        skippedCount += 1;
      }
    }

    return {
      readyCount: readyCount,
      blockedCount: blockedCount,
      skippedCount: skippedCount,
      interfaceOnlyCount: interfaceOnlyCount,
      hasReadyTarget: hasReadyTarget,
      hasBlocker: hasBlocker,
      liveGateRequired: true
    };
  }

  function classifyAdapterStatus(interfaces, safety, cfg) {
    // 1. INVALID
    if (safety && safety.invalidHarness === true) return ADAPTER_STATUS.INVALID;
    if (safety && safety.sourceHarnessStatus === 'HARNESS_INVALID') return ADAPTER_STATUS.INVALID;

    // 2. BLOCKED
    if (safety && safety.credentialBlocked === true) return ADAPTER_STATUS.BLOCKED;
    if (safety && safety.envLikeBlocked === true) return ADAPTER_STATUS.BLOCKED;
    if (safety && safety.depthBlocked === true) return ADAPTER_STATUS.BLOCKED;
    if (safety && safety.functionInputBlocked === true) return ADAPTER_STATUS.BLOCKED;
    if (safety && safety.modeBlocked === true) return ADAPTER_STATUS.BLOCKED;
    if (safety && safety.hardBlockBoolean === true) return ADAPTER_STATUS.BLOCKED;
    if (cfg && cfg.adapterMode !== ADAPTER_MODE.INTERFACE_ONLY) return ADAPTER_STATUS.BLOCKED;
    if (cfg && cfg.liveExecutionAllowed === true) return ADAPTER_STATUS.BLOCKED;
    if (cfg && cfg.sideEffectAllowed === true) return ADAPTER_STATUS.BLOCKED;
    if (cfg && cfg.fetchAllowed === true) return ADAPTER_STATUS.BLOCKED;
    if (cfg && cfg.writeAllowed === true) return ADAPTER_STATUS.BLOCKED;
    if (cfg && cfg.credentialLookupAllowed === true) return ADAPTER_STATUS.BLOCKED;
    if (cfg && cfg.bindingLookupAllowed === true) return ADAPTER_STATUS.BLOCKED;
    if (cfg && cfg.driverCallAllowed === true) return ADAPTER_STATUS.BLOCKED;
    if (cfg && cfg.retryAllowed === true) return ADAPTER_STATUS.BLOCKED;
    if (safety && safety.sourceHarnessStatus === 'HARNESS_BLOCKED') return ADAPTER_STATUS.BLOCKED;

    var summary = buildAdapterSummary(interfaces);

    // 3. PARTIAL
    if (summary.hasReadyTarget && summary.hasBlocker) return ADAPTER_STATUS.PARTIAL;

    // 4. READY
    if (safety && (safety.sourceHarnessStatus === 'HARNESS_READY' || safety.sourceHarnessStatus === 'HARNESS_PARTIAL')
        && summary.hasReadyTarget && !summary.hasBlocker) {
      return ADAPTER_STATUS.READY;
    }

    // 5. SKIPPED
    if (safety && safety.sourceHarnessStatus === 'HARNESS_SKIPPED') return ADAPTER_STATUS.SKIPPED;
    if (!summary.hasReadyTarget && !summary.hasBlocker) return ADAPTER_STATUS.SKIPPED;

    // 6. UNKNOWN
    return ADAPTER_STATUS.UNKNOWN;
  }

  // §normalize

  function normalizeInterfaceTarget(target /*, cfg */) {
    var t = isPlainObject(target) ? target : {};
    return {
      ready: t.ready === true,
      target: typeof t.target === 'string' ? t.target : null,
      adapterMode: 'INTERFACE_ONLY',
      sideEffectAllowed: t.sideEffectAllowed === true,
      bindingRef: typeof t.bindingRef === 'string' ? t.bindingRef : null,
      interfaceSpec: t.interfaceSpec,
      driverCallContract: t.driverCallContract,
      resultAdapterContract: t.resultAdapterContract,
      errorAdapterContract: t.errorAdapterContract,
      retryAdapterContract: t.retryAdapterContract,
      rateLimitContract: t.rateLimitContract,
      circuitBreakerContract: t.circuitBreakerContract,
      dryRunResult: t.dryRunResult,
      blockedReasons: Array.isArray(t.blockedReasons) ? t.blockedReasons : [],
      warnings: Array.isArray(t.warnings) ? t.warnings : []
    };
  }

  function normalizeTransportExecutorInterfaceAdapter(result) {
    return {
      valid: result.valid === true,
      version: result.version,
      adapterMode: typeof result.adapterMode === 'string' ? result.adapterMode : 'INTERFACE_ONLY',
      liveExecutionAllowed: result.liveExecutionAllowed === true,
      adapterStatus: typeof result.adapterStatus === 'string' ? result.adapterStatus : ADAPTER_STATUS.UNKNOWN,
      sourceHarnessStatus: typeof result.sourceHarnessStatus === 'string' ? result.sourceHarnessStatus : null,
      adapterPolicy: result.adapterPolicy,
      bindingResolverContract: result.bindingResolverContract,
      telegramInterface: result.telegramInterface,
      snapshotInterface: result.snapshotInterface,
      evaluationInterface: result.evaluationInterface,
      auditInterface: result.auditInterface,
      adapterSummary: result.adapterSummary,
      reasons: Array.isArray(result.reasons) ? result.reasons : [],
      warnings: Array.isArray(result.warnings) ? result.warnings : [],
      debug: result.debug,
      configUsed: result.configUsed
    };
  }

  // §main entry ─────────────────────────────────────────────────────────

  function buildTransportExecutorInterfaceAdapter(input, config) {
    var inp = isPlainObject(input) ? input : {};
    var cfg = mergeTransportExecutorInterfaceAdapterConfig(config);
    var reasons = [];
    var warnings = [];

    // STEP 1 — INVALID check
    var src = isPlainObject(inp.transportExecutorHarness) ? inp.transportExecutorHarness : null;
    var invalidHarness = (src === null) || (src.valid !== true);
    var sourceHarnessStatus = (src && typeof src.harnessStatus === 'string') ? src.harnessStatus : null;

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

    // STEP 3 — mode / hard-block 8 boolean
    var modeBlocked = (cfg.adapterMode !== ADAPTER_MODE.INTERFACE_ONLY);
    var hardBlockBoolean = (cfg.liveExecutionAllowed === true)
                        || (cfg.sideEffectAllowed === true)
                        || (cfg.fetchAllowed === true)
                        || (cfg.writeAllowed === true)
                        || (cfg.credentialLookupAllowed === true)
                        || (cfg.bindingLookupAllowed === true)
                        || (cfg.driverCallAllowed === true)
                        || (cfg.retryAllowed === true);

    // STEP 4 — base interface (default — non-ready, blocked reasons populated)
    function makeBase(targetType, bindingRef) {
      var spec = buildInterfaceSpec(null, targetType, cfg);
      return {
        ready: false,
        target: targetType,
        adapterMode: 'INTERFACE_ONLY',
        sideEffectAllowed: false,
        bindingRef: bindingRef,
        interfaceSpec: {
          action: spec.action,
          requestShape: spec.requestShape
        },
        driverCallContract: buildDriverCallContract(null, targetType, cfg),
        resultAdapterContract: buildResultAdapterContract(null, targetType, cfg),
        errorAdapterContract: buildErrorAdapterContract(null, targetType, cfg),
        retryAdapterContract: buildRetryAdapterContract(null, targetType, cfg),
        rateLimitContract: null,
        circuitBreakerContract: null,
        dryRunResult: null,
        blockedReasons: [],
        warnings: []
      };
    }

    var teleI = makeBase(TARGET.TELEGRAM, 'TELEGRAM_SECURE_BINDING');
    var snapI = makeBase(TARGET.SNAPSHOT_STORE, 'KV_SNAPSHOT_BINDING');
    var evalI = makeBase(TARGET.EVALUATION_STORE, 'EVALUATION_STORE_BINDING');
    var auditI = makeBase(TARGET.AUDIT_STORE, 'AUDIT_STORE_BINDING');

    function pushBlockToAll(code) {
      teleI.blockedReasons.push(code);
      snapI.blockedReasons.push(code);
      evalI.blockedReasons.push(code);
      auditI.blockedReasons.push(code);
    }

    if (invalidHarness) {
      reasons.push('TRANSPORT_EXECUTOR_HARNESS_INVALID');
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
      reasons.push('NON_INTERFACE_ONLY_MODE_BLOCKED');
      pushBlockToAll('NON_INTERFACE_ONLY_MODE_BLOCKED');
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
    } else if (sourceHarnessStatus === 'HARNESS_BLOCKED') {
      reasons.push('SOURCE_HARNESS_BLOCKED');
      pushBlockToAll('SOURCE_HARNESS_BLOCKED');
    } else {
      // STEP 5 — normal interface builds
      teleI = buildTelegramInterface(inp, cfg);
      snapI = buildSnapshotInterface(inp, cfg);
      evalI = buildEvaluationInterface(inp, cfg);
      auditI = buildAuditInterface(inp, cfg);
    }

    // STEP 6 — normalize each interface
    teleI = normalizeInterfaceTarget(teleI, cfg);
    snapI = normalizeInterfaceTarget(snapI, cfg);
    evalI = normalizeInterfaceTarget(evalI, cfg);
    auditI = normalizeInterfaceTarget(auditI, cfg);

    // STEP 7 — bindingResolverContract (top-level, target-agnostic)
    var bindingResolverContract = buildBindingResolverContract(inp, cfg);

    // STEP 8 — summary + classify
    var interfaces = {
      telegramInterface: teleI,
      snapshotInterface: snapI,
      evaluationInterface: evalI,
      auditInterface: auditI
    };
    var summary = buildAdapterSummary(interfaces);
    var safetyFlags = {
      invalidHarness: invalidHarness,
      sourceHarnessStatus: sourceHarnessStatus,
      credentialBlocked: credBlocked,
      envLikeBlocked: envLikeBlocked,
      depthBlocked: depthBlocked,
      functionInputBlocked: functionInputBlocked,
      modeBlocked: modeBlocked,
      hardBlockBoolean: hardBlockBoolean
    };
    var adapterStatus = classifyAdapterStatus(interfaces, safetyFlags, cfg);

    // STEP 9 — reasons
    if (adapterStatus === ADAPTER_STATUS.READY) reasons.push('ADAPTER_READY');
    if (adapterStatus === ADAPTER_STATUS.PARTIAL) reasons.push('ADAPTER_PARTIAL');
    if (adapterStatus === ADAPTER_STATUS.SKIPPED) reasons.push('ADAPTER_SKIPPED');
    if (adapterStatus === ADAPTER_STATUS.UNKNOWN) reasons.push('ADAPTER_UNKNOWN_FALLBACK');
    if (teleI.ready) reasons.push('TELEGRAM_INTERFACE_READY');
    if (snapI.ready) reasons.push('SNAPSHOT_INTERFACE_READY');
    if (evalI.ready) reasons.push('EVALUATION_INTERFACE_READY');
    if (auditI.ready) reasons.push('AUDIT_INTERFACE_READY');

    // STEP 10 — adapterPolicy fixed contract (top-level source of truth)
    var adapterPolicy = {
      interfaceOnly: true,
      sideEffectAllowed: false,
      credentialLookupAllowed: false,
      bindingLookupAllowed: false,
      fetchAllowed: false,
      writeAllowed: false,
      driverCallAllowed: false,
      retryAllowed: false,
      liveExecutionRequiresExplicitGate: true
    };

    // STEP 11 — configUsed scalar snapshot
    var configUsed = {
      version: cfg.version,
      adapterMode: cfg.adapterMode,
      liveExecutionAllowed: cfg.liveExecutionAllowed,
      sideEffectAllowed: cfg.sideEffectAllowed,
      fetchAllowed: cfg.fetchAllowed,
      writeAllowed: cfg.writeAllowed,
      credentialLookupAllowed: cfg.credentialLookupAllowed,
      bindingLookupAllowed: cfg.bindingLookupAllowed,
      driverCallAllowed: cfg.driverCallAllowed,
      retryAllowed: cfg.retryAllowed,
      targets: {
        telegram: { enabled: cfg.targets.telegram.enabled },
        snapshot: { enabled: cfg.targets.snapshot.enabled },
        evaluation: { enabled: cfg.targets.evaluation.enabled },
        audit: { enabled: cfg.targets.audit.enabled }
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
      valid: invalidHarness ? false : true,
      version: ADAPTER_VERSION,
      adapterMode: cfg.adapterMode === ADAPTER_MODE.INTERFACE_ONLY ? 'INTERFACE_ONLY' : cfg.adapterMode,
      liveExecutionAllowed: cfg.liveExecutionAllowed === true,
      adapterStatus: adapterStatus,
      sourceHarnessStatus: sourceHarnessStatus,
      adapterPolicy: adapterPolicy,
      bindingResolverContract: bindingResolverContract,
      telegramInterface: teleI,
      snapshotInterface: snapI,
      evaluationInterface: evalI,
      auditInterface: auditI,
      adapterSummary: summary,
      reasons: reasons,
      warnings: warnings,
      debug: {
        source: 'transportExecutorHarness + secureTransportExecutorContract + transportExecutionEnvelope + transportPlan + rendererBinding + operationPacket + activeCycleDecision + evaluationOutcome + externalConfluence',
        configVersion: cfg.version,
        invalidHarness: invalidHarness,
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
    return normalizeTransportExecutorInterfaceAdapter(draft);
  }

  // §export ──────────────────────────────────────────────────────────────

  var api = Object.freeze({
    VERSION: ADAPTER_VERSION,
    DEFAULT_TRANSPORT_EXECUTOR_INTERFACE_ADAPTER_CONFIG: DEFAULT_TRANSPORT_EXECUTOR_INTERFACE_ADAPTER_CONFIG,
    ADAPTER_MODE: ADAPTER_MODE,
    ADAPTER_STATUS: ADAPTER_STATUS,
    TARGET: TARGET,
    ACTION: ACTION,
    ERROR_TYPE: ERROR_TYPE,
    WORDING_SANITIZE_MODE: WORDING_SANITIZE_MODE,
    build: buildTransportExecutorInterfaceAdapter,
    mergeTransportExecutorInterfaceAdapterConfig: mergeTransportExecutorInterfaceAdapterConfig,
    buildTelegramInterface: buildTelegramInterface,
    buildSnapshotInterface: buildSnapshotInterface,
    buildEvaluationInterface: buildEvaluationInterface,
    buildAuditInterface: buildAuditInterface,
    buildBindingResolverContract: buildBindingResolverContract,
    buildInterfaceSpec: buildInterfaceSpec,
    buildDriverCallContract: buildDriverCallContract,
    buildResultAdapterContract: buildResultAdapterContract,
    buildErrorAdapterContract: buildErrorAdapterContract,
    buildRetryAdapterContract: buildRetryAdapterContract,
    buildSafeRequestShape: buildSafeRequestShape,
    classifyAdapterStatus: classifyAdapterStatus,
    detectCredentialFields: detectCredentialFields,
    detectEnvLikeObjects: detectEnvLikeObjects,
    detectFunctionInputs: detectFunctionInputs,
    validateLogicalRef: validateLogicalRef
  });

  global.WS3_TransportExecutorInterfaceAdapter = api;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
