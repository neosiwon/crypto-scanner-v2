/**
 * WS3 v0.19.0 — LiveExecutionPreflightGate (LIVE Execution Preflight Gate)
 *
 * Scope:
 *   secureBindingGatewayContract (v0.18.0) + transportExecutorSandboxRunner (v0.17.0) +
 *   transportExecutorInterfaceAdapter (v0.16.0) + transportExecutorHarness (v0.15.0) +
 *   secureTransportExecutorContract (v0.14.0) + transportExecutionEnvelope (v0.13.0) +
 *   transportPlan (v0.12.0) + rendererBinding (v0.12.0) + operationPacket (v0.8.0) +
 *   activeCycleDecision (v0.9.0) + evaluationOutcome (v0.10.0) + externalConfluence (v0.11.0)
 *   → standalone LiveExecutionPreflightGate (PREFLIGHT_ONLY, LIVE 실행 전 사전 안전 contract)
 *
 * 단일 기준 문서:
 *   docs/ws3/WS3_CODE_CONTRACT.md (b-r2 박제본)
 *
 * 확정 DP 정책 (Gate 2 spec):
 *   DP-PREFLIGHT1   LIVE execution preflight gate only.
 *                   실제 LIVE 실행 / credential lookup / env 접근 / driver call X.
 *   DP-PREFLIGHT2   secureBindingGatewayContract ready/status/lookupPlan/bindingPolicy override X.
 *   DP-PREFLIGHT3   preflightMode PREFLIGHT_ONLY only. LIVE / REAL / EXECUTE → PREFLIGHT_BLOCKED.
 *   DP-PREFLIGHT4   11 boolean hard block (liveExecution / credentialLookup / bindingLookup /
 *                   driverCall / fetch / write / retry / timer / envAccess / rollbackExecution /
 *                   killSwitchMutation) 중 하나라도 true → PREFLIGHT_BLOCKED.
 *   DP-PREFLIGHT5   credential value / masked credential / token preview / chatId preview /
 *                   webhook preview 전부 output 금지.
 *   DP-PREFLIGHT6   process.env / env 객체 / Cloudflare binding / KV namespace / DB connection
 *                   읽기 0건. env-like object → 즉시 PREFLIGHT_BLOCKED.
 *   DP-PREFLIGHT7   executionIntent PREFLIGHT_ONLY 구조. wouldExecuteLive=false 유지.
 *   DP-PREFLIGHT8   rollbackPlan / disablePlan / killSwitchPlan preflight contract only.
 *                   실제 rollback / disable / kill switch mutation X.
 *   DP-PREFLIGHT9   12종 입력 read-only.
 *   DP-PREFLIGHT10  신규 파일 1개 + 문서 갱신만. 보호 파일 31종 수정 금지.
 *
 * N-PREFLIGHT-OBS 처리:
 *   N-PREFLIGHT-OBS-1  신규 식별자 fresh — Preflight / PREFLIGHT_xxx / buildXxxPreflight /
 *                      gatewayRef / executionIntent / bindingRequirementSnapshot /
 *                      liveReadinessPolicy / killSwitchPlan / rollbackPlan / disablePlan /
 *                      riskSummary 모두 0건 충돌.
 *   N-PREFLIGHT-OBS-2  v0.18 secureBindingGatewayContract shape 정합. override 0건.
 *   N-PREFLIGHT-OBS-3  7개 contract field 박제 (gatewayRef / executionIntent /
 *                      bindingRequirementSnapshot / liveReadinessPolicy / killSwitchPlan /
 *                      rollbackPlan / disablePlan + riskSummary).
 *   N-PREFLIGHT-OBS-4  8 validate 본문 규칙 박제 (각 INVALID_* reason code).
 *   N-PREFLIGHT-OBS-5  v0.20 runtimeState 분리 정책 — killSwitchRuntimeState /
 *                      rollbackRuntimeState / disableRuntimeState 는 v0.20 별도 객체.
 *                      v0.19 결과 read-only contract.
 *   N-PREFLIGHT-OBS-6  보호 baseline false-positive — async/Promise/setTimeout/fetch 등
 *                      본 모듈 0건. forbidden detection list 박제만.
 *   N-PREFLIGHT-OBS-7  보호 파일 31종 무손상 (v0.18 v3-secure-binding-gateway-contract.js
 *                      추가). 본 단계 31종 무손상.
 *
 * 출력 (top-level):
 *   valid, version, preflightMode='PREFLIGHT_ONLY', liveExecutionAllowed=false,
 *   preflightStatus, sourceGatewayStatus, preflightPolicy,
 *   telegramPreflight, snapshotPreflight, evaluationPreflight, auditPreflight,
 *   preflightSummary, reasons[], warnings[], debug, configUsed
 *
 * preflightStatus 6 후보 (first-match-wins):
 *   PREFLIGHT_INVALID  → secureBindingGatewayContract missing 또는 valid !== true
 *   PREFLIGHT_BLOCKED  → source GATEWAY_BLOCKED/INVALID, credential 감지, env-like 감지,
 *                        function input 감지, preflightMode!==PREFLIGHT_ONLY,
 *                        11 boolean hard block, invalid 7-contract 중 하나
 *   PREFLIGHT_PARTIAL  → ≥1 ready true + ≥1 blocker
 *   PREFLIGHT_READY    → source GATEWAY_READY/PARTIAL + ≥1 ready true + blocker 0
 *   PREFLIGHT_SKIPPED  → source GATEWAY_SKIPPED 또는 모든 ready false + blocker 0
 *   PREFLIGHT_UNKNOWN  → fallback
 *
 * 의도된 미구현 (이번 단계 제외):
 *   실제 LIVE 실행 / credential lookup / process.env / Cloudflare env / globalThis.env /
 *   KV namespace / DB connection / Telegram bot token / chatId / webhookUrl /
 *   secret binding value 읽기.
 *   실제 fetch / Telegram 발송 / KV read/write / DB read/write / binding resolver function 호출.
 *   실제 driver call / retry / timer.
 *   실제 rollback 실행 / disable 실행 / kill switch 조회 / kill switch 변경.
 *   credential value 저장 / logging / preview / masked preview.
 *   async function / await / Promise / setTimeout / setInterval (sync only).
 *
 * 함수 목록:
 *   mergeLiveExecutionPreflightGateConfig(config)
 *   buildLiveExecutionPreflightGate(input, config)              ← 진입점
 *   buildTelegramPreflight / buildSnapshotPreflight / buildEvaluationPreflight / buildAuditPreflight
 *   buildGatewayRef(gateway, target, cfg)
 *   buildExecutionIntent(gateway, target, cfg)
 *   buildBindingRequirementSnapshot(gateway, target, cfg)
 *   buildLiveReadinessPolicy(gateway, target, cfg)
 *   buildKillSwitchPlan(gateway, target, cfg)
 *   buildRollbackPlan(gateway, target, cfg)
 *   buildDisablePlan(gateway, target, cfg)
 *   buildRiskSummary(preflight, target, cfg)
 *   buildPreflightSummary(preflights, cfg)
 *   classifyPreflightStatus(preflights, safety, cfg)
 *   detectCredentialFields / detectEnvLikeObjects / detectFunctionInputs
 *   validateGatewayRef / validateExecutionIntent / validateBindingRequirementSnapshot
 *   validateLiveReadinessPolicy / validateKillSwitchPlan / validateRollbackPlan
 *   validateDisablePlan / validateRiskSummary
 *   sanitizeMessageLines(lines, cfg)
 *   normalizePreflightTarget / normalizeLiveExecutionPreflightGate
 *   isPlainObject, safeString, safeNumber, pushReason, pushWarning
 *
 * export:
 *   global.WS3_LiveExecutionPreflightGate + module.exports
 */
(function(global) {
  'use strict';

  // §version
  var PREFLIGHT_VERSION = 'WS3_v0.19.0_live_execution_preflight_gate';

  // §preflightMode (only PREFLIGHT_ONLY allowed)
  var PREFLIGHT_MODE = Object.freeze({
    PREFLIGHT_ONLY: 'PREFLIGHT_ONLY'
  });

  // §preflightStatus 6 후보
  var PREFLIGHT_STATUS = Object.freeze({
    READY: 'PREFLIGHT_READY',
    SKIPPED: 'PREFLIGHT_SKIPPED',
    BLOCKED: 'PREFLIGHT_BLOCKED',
    PARTIAL: 'PREFLIGHT_PARTIAL',
    INVALID: 'PREFLIGHT_INVALID',
    UNKNOWN: 'PREFLIGHT_UNKNOWN'
  });

  // §target enum
  var TARGET = Object.freeze({
    TELEGRAM: 'TELEGRAM',
    SNAPSHOT_STORE: 'SNAPSHOT_STORE',
    EVALUATION_STORE: 'EVALUATION_STORE',
    AUDIT_STORE: 'AUDIT_STORE'
  });

  // §action enum (target ↔ action 1:1)
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

  function getBindingRefForTarget(target) {
    if (target === TARGET.TELEGRAM) return 'TELEGRAM_SECURE_BINDING';
    if (target === TARGET.SNAPSHOT_STORE) return 'KV_SNAPSHOT_BINDING';
    if (target === TARGET.EVALUATION_STORE) return 'EVALUATION_STORE_BINDING';
    if (target === TARGET.AUDIT_STORE) return 'AUDIT_STORE_BINDING';
    return null;
  }

  function getCredentialHandleRefForTarget(target) {
    if (target === TARGET.TELEGRAM) return 'TELEGRAM_CREDENTIAL_HANDLE';
    if (target === TARGET.SNAPSHOT_STORE) return 'SNAPSHOT_STORE_CREDENTIAL_HANDLE';
    if (target === TARGET.EVALUATION_STORE) return 'EVALUATION_STORE_CREDENTIAL_HANDLE';
    if (target === TARGET.AUDIT_STORE) return 'AUDIT_STORE_CREDENTIAL_HANDLE';
    return null;
  }

  function getBindingScopeForTarget(target) {
    if (target === TARGET.TELEGRAM) return 'TELEGRAM_SEND_SCOPE';
    if (target === TARGET.SNAPSHOT_STORE) return 'SNAPSHOT_WRITE_SCOPE';
    if (target === TARGET.EVALUATION_STORE) return 'EVALUATION_WRITE_SCOPE';
    if (target === TARGET.AUDIT_STORE) return 'AUDIT_WRITE_SCOPE';
    return null;
  }

  // §gatewayStatus enum (v0.18 inherited — read-only)
  var GATEWAY_STATUS_ENUM = Object.freeze([
    'GATEWAY_READY',
    'GATEWAY_SKIPPED',
    'GATEWAY_BLOCKED',
    'GATEWAY_PARTIAL',
    'GATEWAY_INVALID',
    'GATEWAY_UNKNOWN'
  ]);

  function isValidGatewayStatus(status) {
    if (typeof status !== 'string') return false;
    var i;
    for (i = 0; i < GATEWAY_STATUS_ENUM.length; i++) {
      if (GATEWAY_STATUS_ENUM[i] === status) return true;
    }
    return false;
  }

  // §credential 9개 키 (lower-case, case-insensitive partial match)
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

  // §framework multi-word logical term — credential keyword 우회 자격
  var FRAMEWORK_BYPASS_TERMS = Object.freeze([
    'CREDENTIAL_HANDLE',
    'CREDENTIAL_HANDLE_REF'
  ]);

  // §RESERVED 프레임워크 metadata 키 (v0.13~v0.19 모듈 자체 metadata 식별자)
  var RESERVED_FRAMEWORK_METADATA_KEYS = Object.freeze([
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
    'credentialHandleRef',
    'blockCredentialFields',
    'allowWebhookUrl',
    'allowDirectSecretAccess',
    'directSecretAccessAllowed',
    'bindingRefAllowList',
    'bindingRefAllowListSize',
    'bindingRefCredentialPatternBlocked',
    'logicalRefAllowList',
    'logicalRefAllowListSize',
    'logicalRefCredentialPatternBlocked',
    'logicalRefFunctionPatternBlocked',
    'sandboxFixtureCredentialPatternBlocked',
    'sandboxFixturePatternBlocked',
    'sandboxFixtureFunctionPatternBlocked',
    'credentialValueAvailable',
    'credentialValueExposed',
    'credentialValueMasked',
    'credentialValueLogged',
    'credentialValueStored',
    'allowMaskedCredentialPreview'
  ]);

  // §env-like 11 키 (exact match + value is object)
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

  // §logical ref 금지 substring (URL / token-like)
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

  // §logical ref function-body / code pattern (token-level)
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

  // §masked / preview 금지 substring (DP-PREFLIGHT5)
  var MASKED_PREVIEW_TERMS = Object.freeze([
    'masked',
    'first-4',
    'last-4',
    'firstFour',
    'lastFour'
  ]);

  // §wording sanitize 후보
  var WORDING_SANITIZE_MODE = Object.freeze({
    REJECT: 'REJECT',
    REPLACE: 'REPLACE',
    WARN_ONLY: 'WARN_ONLY'
  });

  // §forbidden wording (v0.18 inherited 20 + v0.19 신규 2)
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
    'stop loss',
    'lookup 완료',
    'resolved credential',
    'credential loaded',
    'secret loaded',
    'token loaded',
    'LIVE 실행 완료',
    '실제 발송'
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
    if (word === 'lookup 완료') return 'lookup 후보';
    if (word === 'resolved credential') return 'credential candidate';
    if (word === 'credential loaded') return 'credential pending';
    if (word === 'secret loaded') return 'secret pending';
    if (word === 'token loaded') return 'token pending';
    if (word === 'LIVE 실행 완료') return 'LIVE preflight only';
    if (word === '실제 발송') return 'preflight only';
    return 'redacted';
  }

  // §killSwitchPlan currentState — NOT_EVALUATED only
  var KILL_SWITCH_STATE_ALLOWED = 'NOT_EVALUATED';
  var KILL_SWITCH_STATE_FORBIDDEN = Object.freeze(['ON', 'OFF', 'UNKNOWN', 'ERROR', 'BYPASSED']);

  // §riskLevel — PREFLIGHT_ONLY only (v0.19)
  var RISK_LEVEL_PREFLIGHT = 'PREFLIGHT_ONLY';

  // §DEFAULT_CONFIG
  var DEFAULT_LIVE_EXECUTION_PREFLIGHT_GATE_CONFIG = Object.freeze({
    version: 'inline-default-v0',
    preflightMode: 'PREFLIGHT_ONLY',
    liveExecutionAllowed: false,
    credentialLookupAllowed: false,
    bindingLookupAllowed: false,
    driverCallAllowed: false,
    fetchAllowed: false,
    writeAllowed: false,
    retryAllowed: false,
    timerAllowed: false,
    envAccessAllowed: false,
    rollbackExecutionAllowed: false,
    killSwitchMutationAllowed: false,
    targets: Object.freeze({
      telegram: Object.freeze({ enabled: true }),
      snapshot: Object.freeze({ enabled: true }),
      evaluation: Object.freeze({ enabled: true }),
      audit: Object.freeze({ enabled: true })
    }),
    liveReadinessPolicy: Object.freeze({
      requiresExplicitUserApproval: true,
      requiresSecureRuntimeAdapter: true,
      requiresKillSwitchOff: true,
      requiresRollbackPlan: true,
      requiresRateLimitPass: true,
      requiresCircuitBreakerClosed: true,
      liveReady: false
    }),
    safety: Object.freeze({
      blockCredentialFields: true,
      credentialMaxDepth: 5,
      credentialAllowList: Object.freeze([]),
      logicalRefAllowList: Object.freeze([
        'TELEGRAM_CREDENTIAL_HANDLE',
        'SNAPSHOT_STORE_CREDENTIAL_HANDLE',
        'EVALUATION_STORE_CREDENTIAL_HANDLE',
        'AUDIT_STORE_CREDENTIAL_HANDLE',
        'TELEGRAM_SEND_SCOPE',
        'SNAPSHOT_WRITE_SCOPE',
        'EVALUATION_WRITE_SCOPE',
        'AUDIT_WRITE_SCOPE',
        'SECURE_CREDENTIAL_HANDLE_REF',
        'FUTURE_SECURE_BINDING_RESOLVER',
        'TELEGRAM_SECURE_BINDING',
        'KV_SNAPSHOT_BINDING',
        'EVALUATION_STORE_BINDING',
        'AUDIT_STORE_BINDING'
      ]),
      blockEnvLikeObjects: true,
      blockObjectTooDeep: true,
      blockFunctionInputs: true,
      blockMaskedPreview: true,
      allowRawPayload: false,
      allowEnvRead: false,
      allowDirectSecretAccess: false,
      allowFunctionInput: false,
      allowAsync: false,
      allowTimer: false,
      allowMaskedCredentialPreview: false
    }),
    requestShape: Object.freeze({
      maxStringLength: 200
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

  // §config merge — field-by-field
  function mergeLiveExecutionPreflightGateConfig(config) {
    var c = isPlainObject(config) ? config : {};
    var d = DEFAULT_LIVE_EXECUTION_PREFLIGHT_GATE_CONFIG;

    var tg = isPlainObject(c.targets) ? c.targets : {};
    var sf = isPlainObject(c.safety) ? c.safety : {};
    var rs = isPlainObject(c.requestShape) ? c.requestShape : {};
    var wd = isPlainObject(c.wording) ? c.wording : {};
    var db = isPlainObject(c.debug) ? c.debug : {};
    var lr = isPlainObject(c.liveReadinessPolicy) ? c.liveReadinessPolicy : {};

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
    var debugAllowed = copyStringArray(db.allowedFields, d.debug.allowedFields);

    var maxDepth = (typeof sf.credentialMaxDepth === 'number' && isFinite(sf.credentialMaxDepth) && sf.credentialMaxDepth > 0)
      ? sf.credentialMaxDepth
      : d.safety.credentialMaxDepth;

    var maxStrLen = (typeof rs.maxStringLength === 'number' && isFinite(rs.maxStringLength) && rs.maxStringLength > 0)
      ? rs.maxStringLength
      : d.requestShape.maxStringLength;

    var sanitizeMode = (typeof wd.sanitizeMode === 'string') ? wd.sanitizeMode : d.wording.sanitizeMode;
    if (sanitizeMode !== WORDING_SANITIZE_MODE.REJECT
        && sanitizeMode !== WORDING_SANITIZE_MODE.REPLACE
        && sanitizeMode !== WORDING_SANITIZE_MODE.WARN_ONLY) {
      sanitizeMode = d.wording.sanitizeMode;
    }

    return {
      version: (typeof c.version === 'string' && c.version.length > 0) ? c.version : d.version,
      preflightMode: (typeof c.preflightMode === 'string' && c.preflightMode.length > 0) ? c.preflightMode : d.preflightMode,
      liveExecutionAllowed: c.liveExecutionAllowed === true,
      credentialLookupAllowed: c.credentialLookupAllowed === true,
      bindingLookupAllowed: c.bindingLookupAllowed === true,
      driverCallAllowed: c.driverCallAllowed === true,
      fetchAllowed: c.fetchAllowed === true,
      writeAllowed: c.writeAllowed === true,
      retryAllowed: c.retryAllowed === true,
      timerAllowed: c.timerAllowed === true,
      envAccessAllowed: c.envAccessAllowed === true,
      rollbackExecutionAllowed: c.rollbackExecutionAllowed === true,
      killSwitchMutationAllowed: c.killSwitchMutationAllowed === true,
      targets: {
        telegram: { enabled: tgTele.enabled !== false },
        snapshot: { enabled: tgSnap.enabled !== false },
        evaluation: { enabled: tgEval.enabled !== false },
        audit: { enabled: tgAudit.enabled !== false }
      },
      liveReadinessPolicy: {
        requiresExplicitUserApproval: lr.requiresExplicitUserApproval !== false,
        requiresSecureRuntimeAdapter: lr.requiresSecureRuntimeAdapter !== false,
        requiresKillSwitchOff: lr.requiresKillSwitchOff !== false,
        requiresRollbackPlan: lr.requiresRollbackPlan !== false,
        requiresRateLimitPass: lr.requiresRateLimitPass !== false,
        requiresCircuitBreakerClosed: lr.requiresCircuitBreakerClosed !== false,
        liveReady: false
      },
      safety: {
        blockCredentialFields: sf.blockCredentialFields !== false,
        credentialMaxDepth: maxDepth,
        credentialAllowList: credAllow,
        logicalRefAllowList: logicalAllow,
        blockEnvLikeObjects: sf.blockEnvLikeObjects !== false,
        blockObjectTooDeep: sf.blockObjectTooDeep !== false,
        blockFunctionInputs: sf.blockFunctionInputs !== false,
        blockMaskedPreview: sf.blockMaskedPreview !== false,
        allowRawPayload: sf.allowRawPayload === true,
        allowEnvRead: sf.allowEnvRead === true,
        allowDirectSecretAccess: sf.allowDirectSecretAccess === true,
        allowFunctionInput: sf.allowFunctionInput === true,
        allowAsync: sf.allowAsync === true,
        allowTimer: sf.allowTimer === true,
        allowMaskedCredentialPreview: sf.allowMaskedCredentialPreview === true
      },
      requestShape: { maxStringLength: maxStrLen },
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
    var cfg = mergeLiveExecutionPreflightGateConfig(config);
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
    var cfg = mergeLiveExecutionPreflightGateConfig(config);
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
    var cfg = mergeLiveExecutionPreflightGateConfig(config);
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
          if (isFunctionLike(av)) { detections.push(path + '[' + i + ']'); continue; }
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
          if (isFunctionLike(childVal)) { detections.push(nextPath); continue; }
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

  // §validateLogicalRef (v0.18 inherited pattern)

  var LOGICAL_REF_PATTERN = /^[A-Z][A-Z0-9_]*$/;

  function containsFrameworkBypassTerm(ref) {
    if (typeof ref !== 'string') return false;
    var i;
    for (i = 0; i < FRAMEWORK_BYPASS_TERMS.length; i++) {
      if (ref.indexOf(FRAMEWORK_BYPASS_TERMS[i]) !== -1) return true;
    }
    return false;
  }

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

    if (containsFrameworkBypassTerm(ref)) {
      return { valid: true, reason: null };
    }

    var credAllow = (cfg && cfg.safety && Array.isArray(cfg.safety.credentialAllowList))
      ? cfg.safety.credentialAllowList
      : [];
    if (isCredentialKey(ref, credAllow)) {
      return { valid: false, reason: 'LOGICAL_REF_CONTAINS_CREDENTIAL_PATTERN' };
    }

    return { valid: true, reason: null };
  }

  // §8 validate functions ────────────────────────────────────────────────

  function isFunctionLikeValue(v) {
    if (typeof v === 'function') return true;
    if (isPlainObject(v) && typeof v.then === 'function') return true;
    return false;
  }

  function hasFunctionOrPromiseInPlainObject(obj) {
    if (!isPlainObject(obj)) return false;
    var keys = Object.keys(obj);
    var i;
    for (i = 0; i < keys.length; i++) {
      var v = obj[keys[i]];
      if (isFunctionLikeValue(v)) return true;
    }
    return false;
  }

  function validateGatewayRef(ref, cfg) {
    if (!isPlainObject(ref)) return { valid: false, reason: 'INVALID_GATEWAY_REF:NOT_PLAIN_OBJECT' };
    if (Array.isArray(ref)) return { valid: false, reason: 'INVALID_GATEWAY_REF:ARRAY_VALUE' };
    if (hasFunctionOrPromiseInPlainObject(ref)) return { valid: false, reason: 'INVALID_GATEWAY_REF:FUNCTION_VALUE' };

    var allowed = ['target', 'gatewayStatus', 'bindingRef', 'credentialHandleRef', 'bindingScope'];
    var forbidden = ['lookupPlan', 'bindingPolicy', 'sandboxResultRef', 'rateLimitContract', 'circuitBreakerContract', 'perTargetGate'];

    var keys = Object.keys(ref);
    var i;
    for (i = 0; i < keys.length; i++) {
      var k = keys[i];
      var fb;
      for (fb = 0; fb < forbidden.length; fb++) {
        if (forbidden[fb] === k) return { valid: false, reason: 'INVALID_GATEWAY_REF:FORBIDDEN_KEY:' + k };
      }
      var ok = false;
      var ai;
      for (ai = 0; ai < allowed.length; ai++) {
        if (allowed[ai] === k) { ok = true; break; }
      }
      if (!ok) return { valid: false, reason: 'INVALID_GATEWAY_REF:EXTRA_KEY:' + k };
      // depth limit 1 — no nested plain object inside
      var v = ref[k];
      if (isPlainObject(v) || Array.isArray(v)) return { valid: false, reason: 'INVALID_GATEWAY_REF:NESTED_OBJECT:' + k };
    }

    if (ref.target !== TARGET.TELEGRAM
        && ref.target !== TARGET.SNAPSHOT_STORE
        && ref.target !== TARGET.EVALUATION_STORE
        && ref.target !== TARGET.AUDIT_STORE) {
      return { valid: false, reason: 'INVALID_GATEWAY_REF:INVALID_TARGET' };
    }
    if (!isValidGatewayStatus(ref.gatewayStatus)) {
      return { valid: false, reason: 'INVALID_GATEWAY_REF:INVALID_GATEWAY_STATUS' };
    }
    // bindingRef / credentialHandleRef / bindingScope — logical ref check via v0.18 pattern
    var br = validateLogicalRef(ref.bindingRef, cfg);
    if (br.valid !== true) return { valid: false, reason: 'INVALID_GATEWAY_REF:BINDING_REF_' + (br.reason || 'INVALID') };
    var ch = validateLogicalRef(ref.credentialHandleRef, cfg);
    if (ch.valid !== true) return { valid: false, reason: 'INVALID_GATEWAY_REF:CREDENTIAL_HANDLE_REF_' + (ch.reason || 'INVALID') };
    var bs = validateLogicalRef(ref.bindingScope, cfg);
    if (bs.valid !== true) return { valid: false, reason: 'INVALID_GATEWAY_REF:BINDING_SCOPE_' + (bs.reason || 'INVALID') };

    return { valid: true, reason: null };
  }

  function validateExecutionIntent(intent /*, cfg */) {
    if (!isPlainObject(intent)) return { valid: false, reason: 'INVALID_EXECUTION_INTENT:NOT_PLAIN_OBJECT' };
    if (Array.isArray(intent)) return { valid: false, reason: 'INVALID_EXECUTION_INTENT:ARRAY_VALUE' };
    if (hasFunctionOrPromiseInPlainObject(intent)) return { valid: false, reason: 'INVALID_EXECUTION_INTENT:FUNCTION_VALUE' };

    var allowed = ['target', 'action', 'intentMode', 'wouldExecuteLive', 'requiresManualApproval'];
    var keys = Object.keys(intent);
    var i;
    for (i = 0; i < keys.length; i++) {
      var k = keys[i];
      var ok = false;
      var ai;
      for (ai = 0; ai < allowed.length; ai++) {
        if (allowed[ai] === k) { ok = true; break; }
      }
      if (!ok) return { valid: false, reason: 'INVALID_EXECUTION_INTENT:EXTRA_KEY:' + k };
      var v = intent[k];
      if (isPlainObject(v) || Array.isArray(v)) return { valid: false, reason: 'INVALID_EXECUTION_INTENT:NESTED_OBJECT:' + k };
    }

    if (intent.target !== TARGET.TELEGRAM
        && intent.target !== TARGET.SNAPSHOT_STORE
        && intent.target !== TARGET.EVALUATION_STORE
        && intent.target !== TARGET.AUDIT_STORE) {
      return { valid: false, reason: 'INVALID_EXECUTION_INTENT:INVALID_TARGET' };
    }
    var expectedAction = getActionForTarget(intent.target);
    if (intent.action !== expectedAction) return { valid: false, reason: 'INVALID_EXECUTION_INTENT:ACTION_TARGET_MISMATCH' };
    if (intent.intentMode !== 'PREFLIGHT_ONLY') return { valid: false, reason: 'INVALID_EXECUTION_INTENT:INVALID_INTENT_MODE' };
    if (intent.wouldExecuteLive !== false) return { valid: false, reason: 'INVALID_EXECUTION_INTENT:WOULD_EXECUTE_LIVE_TRUE' };
    if (intent.requiresManualApproval !== true) return { valid: false, reason: 'INVALID_EXECUTION_INTENT:REQUIRES_MANUAL_APPROVAL_FALSE' };
    return { valid: true, reason: null };
  }

  function validateBindingRequirementSnapshot(snapshot /*, cfg */) {
    if (!isPlainObject(snapshot)) return { valid: false, reason: 'INVALID_BINDING_REQUIREMENT_SNAPSHOT:NOT_PLAIN_OBJECT' };
    if (Array.isArray(snapshot)) return { valid: false, reason: 'INVALID_BINDING_REQUIREMENT_SNAPSHOT:ARRAY_VALUE' };
    if (hasFunctionOrPromiseInPlainObject(snapshot)) return { valid: false, reason: 'INVALID_BINDING_REQUIREMENT_SNAPSHOT:FUNCTION_VALUE' };

    var allowed = ['required', 'lookupAllowed', 'credentialValueAvailable', 'credentialValueExposed', 'credentialValueMasked', 'credentialValueLogged', 'credentialValueStored'];
    var keys = Object.keys(snapshot);
    var i;
    for (i = 0; i < keys.length; i++) {
      var k = keys[i];
      var ok = false;
      var ai;
      for (ai = 0; ai < allowed.length; ai++) {
        if (allowed[ai] === k) { ok = true; break; }
      }
      if (!ok) return { valid: false, reason: 'INVALID_BINDING_REQUIREMENT_SNAPSHOT:EXTRA_KEY:' + k };
      var v = snapshot[k];
      if (isPlainObject(v) || Array.isArray(v)) return { valid: false, reason: 'INVALID_BINDING_REQUIREMENT_SNAPSHOT:NESTED_OBJECT:' + k };
    }

    if (typeof snapshot.required !== 'boolean') return { valid: false, reason: 'INVALID_BINDING_REQUIREMENT_SNAPSHOT:INVALID_REQUIRED' };
    if (snapshot.lookupAllowed !== false) return { valid: false, reason: 'INVALID_BINDING_REQUIREMENT_SNAPSHOT:LOOKUP_ALLOWED_TRUE' };
    if (snapshot.credentialValueAvailable !== false) return { valid: false, reason: 'INVALID_BINDING_REQUIREMENT_SNAPSHOT:CREDENTIAL_VALUE_AVAILABLE_TRUE' };
    if (snapshot.credentialValueExposed !== false) return { valid: false, reason: 'INVALID_BINDING_REQUIREMENT_SNAPSHOT:CREDENTIAL_VALUE_EXPOSED_TRUE' };
    if (snapshot.credentialValueMasked !== false) return { valid: false, reason: 'INVALID_BINDING_REQUIREMENT_SNAPSHOT:CREDENTIAL_VALUE_MASKED_TRUE' };
    if (snapshot.credentialValueLogged !== false) return { valid: false, reason: 'INVALID_BINDING_REQUIREMENT_SNAPSHOT:CREDENTIAL_VALUE_LOGGED_TRUE' };
    if (snapshot.credentialValueStored !== false) return { valid: false, reason: 'INVALID_BINDING_REQUIREMENT_SNAPSHOT:CREDENTIAL_VALUE_STORED_TRUE' };
    return { valid: true, reason: null };
  }

  function validateLiveReadinessPolicy(policy /*, cfg */) {
    if (!isPlainObject(policy)) return { valid: false, reason: 'INVALID_LIVE_READINESS_POLICY:NOT_PLAIN_OBJECT' };
    if (Array.isArray(policy)) return { valid: false, reason: 'INVALID_LIVE_READINESS_POLICY:ARRAY_VALUE' };
    if (hasFunctionOrPromiseInPlainObject(policy)) return { valid: false, reason: 'INVALID_LIVE_READINESS_POLICY:FUNCTION_VALUE' };

    var allowed = ['requiresExplicitUserApproval', 'requiresSecureRuntimeAdapter', 'requiresKillSwitchOff', 'requiresRollbackPlan', 'requiresRateLimitPass', 'requiresCircuitBreakerClosed', 'liveReady'];
    var keys = Object.keys(policy);
    var i;
    for (i = 0; i < keys.length; i++) {
      var k = keys[i];
      var ok = false;
      var ai;
      for (ai = 0; ai < allowed.length; ai++) {
        if (allowed[ai] === k) { ok = true; break; }
      }
      if (!ok) return { valid: false, reason: 'INVALID_LIVE_READINESS_POLICY:EXTRA_KEY:' + k };
      var v = policy[k];
      if (isPlainObject(v) || Array.isArray(v)) return { valid: false, reason: 'INVALID_LIVE_READINESS_POLICY:NESTED_OBJECT:' + k };
    }

    if (typeof policy.requiresExplicitUserApproval !== 'boolean') return { valid: false, reason: 'INVALID_LIVE_READINESS_POLICY:INVALID_REQUIRES_EXPLICIT_USER_APPROVAL' };
    if (typeof policy.requiresSecureRuntimeAdapter !== 'boolean') return { valid: false, reason: 'INVALID_LIVE_READINESS_POLICY:INVALID_REQUIRES_SECURE_RUNTIME_ADAPTER' };
    if (typeof policy.requiresKillSwitchOff !== 'boolean') return { valid: false, reason: 'INVALID_LIVE_READINESS_POLICY:INVALID_REQUIRES_KILL_SWITCH_OFF' };
    if (typeof policy.requiresRollbackPlan !== 'boolean') return { valid: false, reason: 'INVALID_LIVE_READINESS_POLICY:INVALID_REQUIRES_ROLLBACK_PLAN' };
    if (typeof policy.requiresRateLimitPass !== 'boolean') return { valid: false, reason: 'INVALID_LIVE_READINESS_POLICY:INVALID_REQUIRES_RATE_LIMIT_PASS' };
    if (typeof policy.requiresCircuitBreakerClosed !== 'boolean') return { valid: false, reason: 'INVALID_LIVE_READINESS_POLICY:INVALID_REQUIRES_CIRCUIT_BREAKER_CLOSED' };
    if (policy.liveReady !== false) return { valid: false, reason: 'INVALID_LIVE_READINESS_POLICY:LIVE_READY_TRUE' };
    return { valid: true, reason: null };
  }

  function validateKillSwitchPlan(plan /*, cfg */) {
    if (!isPlainObject(plan)) return { valid: false, reason: 'INVALID_KILL_SWITCH_PLAN:NOT_PLAIN_OBJECT' };
    if (Array.isArray(plan)) return { valid: false, reason: 'INVALID_KILL_SWITCH_PLAN:ARRAY_VALUE' };
    if (hasFunctionOrPromiseInPlainObject(plan)) return { valid: false, reason: 'INVALID_KILL_SWITCH_PLAN:FUNCTION_VALUE' };

    var allowed = ['required', 'currentState', 'mutationAllowed'];
    var keys = Object.keys(plan);
    var i;
    for (i = 0; i < keys.length; i++) {
      var k = keys[i];
      var ok = false;
      var ai;
      for (ai = 0; ai < allowed.length; ai++) {
        if (allowed[ai] === k) { ok = true; break; }
      }
      if (!ok) return { valid: false, reason: 'INVALID_KILL_SWITCH_PLAN:EXTRA_KEY:' + k };
      var v = plan[k];
      if (isPlainObject(v) || Array.isArray(v)) return { valid: false, reason: 'INVALID_KILL_SWITCH_PLAN:NESTED_OBJECT:' + k };
    }
    if (typeof plan.required !== 'boolean') return { valid: false, reason: 'INVALID_KILL_SWITCH_PLAN:INVALID_REQUIRED' };
    // currentState — NOT_EVALUATED only
    var j;
    for (j = 0; j < KILL_SWITCH_STATE_FORBIDDEN.length; j++) {
      if (plan.currentState === KILL_SWITCH_STATE_FORBIDDEN[j]) {
        return { valid: false, reason: 'INVALID_KILL_SWITCH_PLAN:FORBIDDEN_CURRENT_STATE:' + plan.currentState };
      }
    }
    if (plan.currentState !== KILL_SWITCH_STATE_ALLOWED) return { valid: false, reason: 'INVALID_KILL_SWITCH_PLAN:INVALID_CURRENT_STATE' };
    if (plan.mutationAllowed !== false) return { valid: false, reason: 'INVALID_KILL_SWITCH_PLAN:MUTATION_ALLOWED_TRUE' };
    return { valid: true, reason: null };
  }

  function validateRollbackPlan(plan /*, cfg */) {
    if (!isPlainObject(plan)) return { valid: false, reason: 'INVALID_ROLLBACK_PLAN:NOT_PLAIN_OBJECT' };
    if (Array.isArray(plan)) return { valid: false, reason: 'INVALID_ROLLBACK_PLAN:ARRAY_VALUE' };
    if (hasFunctionOrPromiseInPlainObject(plan)) return { valid: false, reason: 'INVALID_ROLLBACK_PLAN:FUNCTION_VALUE' };

    var allowed = ['required', 'rollbackAvailable', 'rollbackExecutionAllowed'];
    var keys = Object.keys(plan);
    var i;
    for (i = 0; i < keys.length; i++) {
      var k = keys[i];
      var ok = false;
      var ai;
      for (ai = 0; ai < allowed.length; ai++) {
        if (allowed[ai] === k) { ok = true; break; }
      }
      if (!ok) return { valid: false, reason: 'INVALID_ROLLBACK_PLAN:EXTRA_KEY:' + k };
      var v = plan[k];
      if (isPlainObject(v) || Array.isArray(v)) return { valid: false, reason: 'INVALID_ROLLBACK_PLAN:NESTED_OBJECT:' + k };
    }
    if (typeof plan.required !== 'boolean') return { valid: false, reason: 'INVALID_ROLLBACK_PLAN:INVALID_REQUIRED' };
    if (plan.rollbackAvailable !== false) return { valid: false, reason: 'INVALID_ROLLBACK_PLAN:ROLLBACK_AVAILABLE_TRUE' };
    if (plan.rollbackExecutionAllowed !== false) return { valid: false, reason: 'INVALID_ROLLBACK_PLAN:ROLLBACK_EXECUTION_ALLOWED_TRUE' };
    return { valid: true, reason: null };
  }

  function validateDisablePlan(plan /*, cfg */) {
    if (!isPlainObject(plan)) return { valid: false, reason: 'INVALID_DISABLE_PLAN:NOT_PLAIN_OBJECT' };
    if (Array.isArray(plan)) return { valid: false, reason: 'INVALID_DISABLE_PLAN:ARRAY_VALUE' };
    if (hasFunctionOrPromiseInPlainObject(plan)) return { valid: false, reason: 'INVALID_DISABLE_PLAN:FUNCTION_VALUE' };

    var allowed = ['required', 'disableAvailable', 'disableExecutionAllowed'];
    var keys = Object.keys(plan);
    var i;
    for (i = 0; i < keys.length; i++) {
      var k = keys[i];
      var ok = false;
      var ai;
      for (ai = 0; ai < allowed.length; ai++) {
        if (allowed[ai] === k) { ok = true; break; }
      }
      if (!ok) return { valid: false, reason: 'INVALID_DISABLE_PLAN:EXTRA_KEY:' + k };
      var v = plan[k];
      if (isPlainObject(v) || Array.isArray(v)) return { valid: false, reason: 'INVALID_DISABLE_PLAN:NESTED_OBJECT:' + k };
    }
    if (typeof plan.required !== 'boolean') return { valid: false, reason: 'INVALID_DISABLE_PLAN:INVALID_REQUIRED' };
    if (plan.disableAvailable !== false) return { valid: false, reason: 'INVALID_DISABLE_PLAN:DISABLE_AVAILABLE_TRUE' };
    if (plan.disableExecutionAllowed !== false) return { valid: false, reason: 'INVALID_DISABLE_PLAN:DISABLE_EXECUTION_ALLOWED_TRUE' };
    return { valid: true, reason: null };
  }

  function validateRiskSummary(summary, cfg) {
    if (!isPlainObject(summary)) return { valid: false, reason: 'INVALID_RISK_SUMMARY:NOT_PLAIN_OBJECT' };
    if (Array.isArray(summary)) return { valid: false, reason: 'INVALID_RISK_SUMMARY:ARRAY_VALUE' };

    var allowed = ['riskLevel', 'blockers', 'warnings'];
    var keys = Object.keys(summary);
    var i;
    for (i = 0; i < keys.length; i++) {
      var k = keys[i];
      var ok = false;
      var ai;
      for (ai = 0; ai < allowed.length; ai++) {
        if (allowed[ai] === k) { ok = true; break; }
      }
      if (!ok) return { valid: false, reason: 'INVALID_RISK_SUMMARY:EXTRA_KEY:' + k };
    }
    if (summary.riskLevel !== RISK_LEVEL_PREFLIGHT) return { valid: false, reason: 'INVALID_RISK_SUMMARY:INVALID_RISK_LEVEL' };
    if (!Array.isArray(summary.blockers)) return { valid: false, reason: 'INVALID_RISK_SUMMARY:BLOCKERS_NOT_ARRAY' };
    if (!Array.isArray(summary.warnings)) return { valid: false, reason: 'INVALID_RISK_SUMMARY:WARNINGS_NOT_ARRAY' };

    var maxStrLen = (cfg && cfg.requestShape && typeof cfg.requestShape.maxStringLength === 'number') ? cfg.requestShape.maxStringLength : 200;
    var credAllow = (cfg && cfg.safety && Array.isArray(cfg.safety.credentialAllowList)) ? cfg.safety.credentialAllowList : [];
    var arrPair = [summary.blockers, summary.warnings];
    var ap;
    for (ap = 0; ap < arrPair.length; ap++) {
      var arr = arrPair[ap];
      var x;
      for (x = 0; x < arr.length; x++) {
        var s = arr[x];
        if (typeof s !== 'string') return { valid: false, reason: 'INVALID_RISK_SUMMARY:NON_STRING_ELEMENT' };
        if (s.length === 0 || s.length > maxStrLen) return { valid: false, reason: 'INVALID_RISK_SUMMARY:INVALID_STRING_LENGTH' };
        // credential pattern check via lower-case substring (RESERVED 통과)
        var lower = s.toLowerCase();
        var cc;
        for (cc = 0; cc < CREDENTIAL_KEYS_BASE.length; cc++) {
          if (lower.indexOf(CREDENTIAL_KEYS_BASE[cc]) !== -1) {
            // allow credential framework keywords by exact-token whitelist (e.g., 'CREDENTIAL_HANDLE_REF')
            if (containsFrameworkBypassTerm(s)) continue;
            // user allowList of credential terms
            var allowed2 = false;
            var al;
            for (al = 0; al < credAllow.length; al++) { if (credAllow[al] === s) { allowed2 = true; break; } }
            if (allowed2) continue;
            return { valid: false, reason: 'INVALID_RISK_SUMMARY:CREDENTIAL_PATTERN' };
          }
        }
        // function pattern token-level
        var tokens = s.split(/[\s_]+/);
        var tk;
        for (tk = 0; tk < tokens.length; tk++) {
          var tu = tokens[tk].toUpperCase();
          var ft;
          for (ft = 0; ft < LOGICAL_REF_FUNCTION_TOKENS.length; ft++) {
            if (LOGICAL_REF_FUNCTION_TOKENS[ft] === tu) {
              return { valid: false, reason: 'INVALID_RISK_SUMMARY:FUNCTION_PATTERN' };
            }
          }
        }
      }
    }
    return { valid: true, reason: null };
  }

  // §wording sanitize ────────────────────────────────────────────────────

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

  function lineContainsMaskedPreviewTerm(line) {
    if (typeof line !== 'string' || line.length === 0) return false;
    var lower = line.toLowerCase();
    var i;
    for (i = 0; i < MASKED_PREVIEW_TERMS.length; i++) {
      if (lower.indexOf(MASKED_PREVIEW_TERMS[i].toLowerCase()) !== -1) return true;
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
      if (lineContainsMaskedPreviewTerm(line)) {
        result.warnings.push('MASKED_PREVIEW_LINE_REJECTED');
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

  // §contract builders ────────────────────────────────────────────────

  function buildGatewayRef(gateway, target /*, cfg */) {
    var status = (gateway && typeof gateway.gatewayStatus === 'string') ? gateway.gatewayStatus : null;
    // For per-target gateway shape (v0.18 telegramGateway etc.), no gatewayStatus field. Derive from top-level.
    // But v0.18 each target gateway has its own ready; the overall status is at top. We expect caller to pass status.
    return {
      target: target,
      gatewayStatus: status,
      bindingRef: getBindingRefForTarget(target),
      credentialHandleRef: getCredentialHandleRefForTarget(target),
      bindingScope: getBindingScopeForTarget(target)
    };
  }

  function buildExecutionIntent(gateway, target /*, cfg */) {
    return {
      target: target,
      action: getActionForTarget(target),
      intentMode: 'PREFLIGHT_ONLY',
      wouldExecuteLive: false,
      requiresManualApproval: true
    };
  }

  function buildBindingRequirementSnapshot(gateway, target /*, cfg */) {
    return {
      required: true,
      lookupAllowed: false,
      credentialValueAvailable: false,
      credentialValueExposed: false,
      credentialValueMasked: false,
      credentialValueLogged: false,
      credentialValueStored: false
    };
  }

  function buildLiveReadinessPolicy(gateway, target, cfg) {
    var src = (cfg && isPlainObject(cfg.liveReadinessPolicy)) ? cfg.liveReadinessPolicy : null;
    return {
      requiresExplicitUserApproval: src ? src.requiresExplicitUserApproval !== false : true,
      requiresSecureRuntimeAdapter: src ? src.requiresSecureRuntimeAdapter !== false : true,
      requiresKillSwitchOff: src ? src.requiresKillSwitchOff !== false : true,
      requiresRollbackPlan: src ? src.requiresRollbackPlan !== false : true,
      requiresRateLimitPass: src ? src.requiresRateLimitPass !== false : true,
      requiresCircuitBreakerClosed: src ? src.requiresCircuitBreakerClosed !== false : true,
      liveReady: false
    };
  }

  function buildKillSwitchPlan(/* gateway, target, cfg */) {
    return {
      required: true,
      currentState: KILL_SWITCH_STATE_ALLOWED,
      mutationAllowed: false
    };
  }

  function buildRollbackPlan(/* gateway, target, cfg */) {
    return {
      required: true,
      rollbackAvailable: false,
      rollbackExecutionAllowed: false
    };
  }

  function buildDisablePlan(/* gateway, target, cfg */) {
    return {
      required: true,
      disableAvailable: false,
      disableExecutionAllowed: false
    };
  }

  function buildRiskSummary(preflight /*, target, cfg */) {
    var blockers = [];
    var warnings = [];
    if (preflight && Array.isArray(preflight.blockedReasons)) {
      var i;
      for (i = 0; i < preflight.blockedReasons.length; i++) {
        var s = preflight.blockedReasons[i];
        if (typeof s === 'string' && s.length > 0 && s.length <= 200) blockers.push(s);
      }
    }
    if (preflight && Array.isArray(preflight.warnings)) {
      var j;
      for (j = 0; j < preflight.warnings.length; j++) {
        var w = preflight.warnings[j];
        if (typeof w === 'string' && w.length > 0 && w.length <= 200) warnings.push(w);
      }
    }
    return {
      riskLevel: RISK_LEVEL_PREFLIGHT,
      blockers: blockers,
      warnings: warnings
    };
  }

  // §per-target preflight builder ────────────────────────────────────────

  function isReadyGateway(gateway) {
    return isPlainObject(gateway) && gateway.ready === true;
  }

  function buildPreflightForTarget(targetType, gatewayTarget, sourceGatewayStatus, cfg) {
    var blockedReasons = [];
    var warnings = [];
    var sourceReady = isReadyGateway(gatewayTarget);

    var targetEnabled;
    if (targetType === TARGET.TELEGRAM) targetEnabled = cfg.targets.telegram.enabled === true;
    else if (targetType === TARGET.SNAPSHOT_STORE) targetEnabled = cfg.targets.snapshot.enabled === true;
    else if (targetType === TARGET.EVALUATION_STORE) targetEnabled = cfg.targets.evaluation.enabled === true;
    else if (targetType === TARGET.AUDIT_STORE) targetEnabled = cfg.targets.audit.enabled === true;
    else targetEnabled = false;

    var modeOk = cfg.preflightMode === PREFLIGHT_MODE.PREFLIGHT_ONLY;
    var liveNotAllowed = cfg.liveExecutionAllowed !== true;
    var credLookupNotAllowed = cfg.credentialLookupAllowed !== true;
    var bindLookupNotAllowed = cfg.bindingLookupAllowed !== true;
    var driverCallNotAllowed = cfg.driverCallAllowed !== true;
    var fetchNotAllowed = cfg.fetchAllowed !== true;
    var writeNotAllowed = cfg.writeAllowed !== true;
    var retryNotAllowed = cfg.retryAllowed !== true;
    var timerNotAllowed = cfg.timerAllowed !== true;
    var envNotAllowed = cfg.envAccessAllowed !== true;
    var rollbackExecNotAllowed = cfg.rollbackExecutionAllowed !== true;
    var killSwitchMutNotAllowed = cfg.killSwitchMutationAllowed !== true;

    if (!sourceReady) blockedReasons.push('SOURCE_GATEWAY_NOT_READY');
    if (!targetEnabled) blockedReasons.push('CONFIG_DISALLOW_TARGET:' + targetType);
    if (!modeOk) blockedReasons.push('NON_PREFLIGHT_ONLY_MODE_BLOCKED');
    if (!liveNotAllowed) blockedReasons.push('LIVE_EXECUTION_ALLOWED_BLOCKED');
    if (!credLookupNotAllowed) blockedReasons.push('CREDENTIAL_LOOKUP_ALLOWED_BLOCKED');
    if (!bindLookupNotAllowed) blockedReasons.push('BINDING_LOOKUP_ALLOWED_BLOCKED');
    if (!driverCallNotAllowed) blockedReasons.push('DRIVER_CALL_ALLOWED_BLOCKED');
    if (!fetchNotAllowed) blockedReasons.push('FETCH_ALLOWED_BLOCKED');
    if (!writeNotAllowed) blockedReasons.push('WRITE_ALLOWED_BLOCKED');
    if (!retryNotAllowed) blockedReasons.push('RETRY_ALLOWED_BLOCKED');
    if (!timerNotAllowed) blockedReasons.push('TIMER_ALLOWED_BLOCKED');
    if (!envNotAllowed) blockedReasons.push('ENV_ACCESS_ALLOWED_BLOCKED');
    if (!rollbackExecNotAllowed) blockedReasons.push('ROLLBACK_EXECUTION_ALLOWED_BLOCKED');
    if (!killSwitchMutNotAllowed) blockedReasons.push('KILL_SWITCH_MUTATION_ALLOWED_BLOCKED');

    // 7 contract build (always full shape — no empty objects)
    var gatewayRef = buildGatewayRef({ gatewayStatus: sourceGatewayStatus }, targetType, cfg);
    var executionIntent = buildExecutionIntent(gatewayTarget, targetType, cfg);
    var bindingRequirementSnapshot = buildBindingRequirementSnapshot(gatewayTarget, targetType, cfg);
    var liveReadinessPolicy = buildLiveReadinessPolicy(gatewayTarget, targetType, cfg);
    var killSwitchPlan = buildKillSwitchPlan(gatewayTarget, targetType, cfg);
    var rollbackPlan = buildRollbackPlan(gatewayTarget, targetType, cfg);
    var disablePlan = buildDisablePlan(gatewayTarget, targetType, cfg);

    // 7 contract validations
    var grv = validateGatewayRef(gatewayRef, cfg);
    if (grv.valid !== true) blockedReasons.push(grv.reason + ':' + targetType);
    var eiv = validateExecutionIntent(executionIntent, cfg);
    if (eiv.valid !== true) blockedReasons.push(eiv.reason + ':' + targetType);
    var brsv = validateBindingRequirementSnapshot(bindingRequirementSnapshot, cfg);
    if (brsv.valid !== true) blockedReasons.push(brsv.reason + ':' + targetType);
    var lrpv = validateLiveReadinessPolicy(liveReadinessPolicy, cfg);
    if (lrpv.valid !== true) blockedReasons.push(lrpv.reason + ':' + targetType);
    var kspv = validateKillSwitchPlan(killSwitchPlan, cfg);
    if (kspv.valid !== true) blockedReasons.push(kspv.reason + ':' + targetType);
    var rpv = validateRollbackPlan(rollbackPlan, cfg);
    if (rpv.valid !== true) blockedReasons.push(rpv.reason + ':' + targetType);
    var dpv = validateDisablePlan(disablePlan, cfg);
    if (dpv.valid !== true) blockedReasons.push(dpv.reason + ':' + targetType);

    var ready = sourceReady && targetEnabled && modeOk && liveNotAllowed
                && credLookupNotAllowed && bindLookupNotAllowed && driverCallNotAllowed
                && fetchNotAllowed && writeNotAllowed && retryNotAllowed && timerNotAllowed
                && envNotAllowed && rollbackExecNotAllowed && killSwitchMutNotAllowed
                && grv.valid === true && eiv.valid === true && brsv.valid === true
                && lrpv.valid === true && kspv.valid === true && rpv.valid === true
                && dpv.valid === true;

    var draft = {
      ready: ready,
      target: targetType,
      preflightOnly: true,
      sideEffectAllowed: false,
      gatewayRef: gatewayRef,
      executionIntent: executionIntent,
      bindingRequirementSnapshot: bindingRequirementSnapshot,
      liveReadinessPolicy: liveReadinessPolicy,
      killSwitchPlan: killSwitchPlan,
      rollbackPlan: rollbackPlan,
      disablePlan: disablePlan,
      perTargetGate: { allow: false, reason: 'PREFLIGHT_ONLY' },
      riskSummary: null,
      blockedReasons: blockedReasons,
      warnings: warnings
    };
    var rs = buildRiskSummary(draft, targetType, cfg);
    var rsv = validateRiskSummary(rs, cfg);
    if (rsv.valid !== true) {
      draft.blockedReasons.push(rsv.reason + ':' + targetType);
      draft.ready = false;
    }
    draft.riskSummary = rs;
    return draft;
  }

  function buildTelegramPreflight(input, cfg) {
    var src = isPlainObject(input.secureBindingGatewayContract) ? input.secureBindingGatewayContract : null;
    var gateway = (src && isPlainObject(src.telegramGateway)) ? src.telegramGateway : null;
    var status = (src && typeof src.gatewayStatus === 'string') ? src.gatewayStatus : null;
    return buildPreflightForTarget(TARGET.TELEGRAM, gateway, status, cfg);
  }
  function buildSnapshotPreflight(input, cfg) {
    var src = isPlainObject(input.secureBindingGatewayContract) ? input.secureBindingGatewayContract : null;
    var gateway = (src && isPlainObject(src.snapshotGateway)) ? src.snapshotGateway : null;
    var status = (src && typeof src.gatewayStatus === 'string') ? src.gatewayStatus : null;
    return buildPreflightForTarget(TARGET.SNAPSHOT_STORE, gateway, status, cfg);
  }
  function buildEvaluationPreflight(input, cfg) {
    var src = isPlainObject(input.secureBindingGatewayContract) ? input.secureBindingGatewayContract : null;
    var gateway = (src && isPlainObject(src.evaluationGateway)) ? src.evaluationGateway : null;
    var status = (src && typeof src.gatewayStatus === 'string') ? src.gatewayStatus : null;
    return buildPreflightForTarget(TARGET.EVALUATION_STORE, gateway, status, cfg);
  }
  function buildAuditPreflight(input, cfg) {
    var src = isPlainObject(input.secureBindingGatewayContract) ? input.secureBindingGatewayContract : null;
    var gateway = (src && isPlainObject(src.auditGateway)) ? src.auditGateway : null;
    var status = (src && typeof src.gatewayStatus === 'string') ? src.gatewayStatus : null;
    return buildPreflightForTarget(TARGET.AUDIT_STORE, gateway, status, cfg);
  }

  // §summary / classify ──────────────────────────────────────────────────

  function buildPreflightSummary(preflights /*, cfg */) {
    var readyCount = 0;
    var blockedCount = 0;
    var skippedCount = 0;
    var preflightOnlyCount = 0;
    var liveReadyCount = 0;
    var manualApprovalRequiredCount = 0;
    var hasReadyTarget = false;
    var hasBlocker = false;

    var keys = ['telegramPreflight', 'snapshotPreflight', 'evaluationPreflight', 'auditPreflight'];
    var i;
    for (i = 0; i < keys.length; i++) {
      var t = preflights[keys[i]];
      if (!isPlainObject(t)) continue;
      if (t.preflightOnly === true) preflightOnlyCount += 1;
      if (isPlainObject(t.executionIntent) && t.executionIntent.requiresManualApproval === true) manualApprovalRequiredCount += 1;
      if (isPlainObject(t.liveReadinessPolicy) && t.liveReadinessPolicy.liveReady === true) liveReadyCount += 1;
      if (t.ready === true) { hasReadyTarget = true; readyCount += 1; }
      else if (Array.isArray(t.blockedReasons) && t.blockedReasons.length > 0) {
        var realBlock = false;
        var br;
        for (br = 0; br < t.blockedReasons.length; br++) {
          if (t.blockedReasons[br] !== 'SOURCE_GATEWAY_NOT_READY') { realBlock = true; break; }
        }
        if (realBlock) { blockedCount += 1; hasBlocker = true; }
        else skippedCount += 1;
      } else skippedCount += 1;
    }

    return {
      readyCount: readyCount,
      blockedCount: blockedCount,
      skippedCount: skippedCount,
      preflightOnlyCount: preflightOnlyCount,
      liveReadyCount: liveReadyCount,
      manualApprovalRequiredCount: manualApprovalRequiredCount,
      hasReadyTarget: hasReadyTarget,
      hasBlocker: hasBlocker,
      liveGateRequired: true
    };
  }

  function classifyPreflightStatus(preflights, safety, cfg) {
    if (safety && safety.invalidGateway === true) return PREFLIGHT_STATUS.INVALID;
    if (safety && safety.sourceGatewayStatus === 'GATEWAY_INVALID') return PREFLIGHT_STATUS.INVALID;

    if (safety && safety.credentialBlocked === true) return PREFLIGHT_STATUS.BLOCKED;
    if (safety && safety.envLikeBlocked === true) return PREFLIGHT_STATUS.BLOCKED;
    if (safety && safety.depthBlocked === true) return PREFLIGHT_STATUS.BLOCKED;
    if (safety && safety.functionInputBlocked === true) return PREFLIGHT_STATUS.BLOCKED;
    if (safety && safety.modeBlocked === true) return PREFLIGHT_STATUS.BLOCKED;
    if (safety && safety.hardBlockBoolean === true) return PREFLIGHT_STATUS.BLOCKED;
    if (cfg && cfg.preflightMode !== PREFLIGHT_MODE.PREFLIGHT_ONLY) return PREFLIGHT_STATUS.BLOCKED;
    if (cfg && cfg.liveExecutionAllowed === true) return PREFLIGHT_STATUS.BLOCKED;
    if (cfg && cfg.credentialLookupAllowed === true) return PREFLIGHT_STATUS.BLOCKED;
    if (cfg && cfg.bindingLookupAllowed === true) return PREFLIGHT_STATUS.BLOCKED;
    if (cfg && cfg.driverCallAllowed === true) return PREFLIGHT_STATUS.BLOCKED;
    if (cfg && cfg.fetchAllowed === true) return PREFLIGHT_STATUS.BLOCKED;
    if (cfg && cfg.writeAllowed === true) return PREFLIGHT_STATUS.BLOCKED;
    if (cfg && cfg.retryAllowed === true) return PREFLIGHT_STATUS.BLOCKED;
    if (cfg && cfg.timerAllowed === true) return PREFLIGHT_STATUS.BLOCKED;
    if (cfg && cfg.envAccessAllowed === true) return PREFLIGHT_STATUS.BLOCKED;
    if (cfg && cfg.rollbackExecutionAllowed === true) return PREFLIGHT_STATUS.BLOCKED;
    if (cfg && cfg.killSwitchMutationAllowed === true) return PREFLIGHT_STATUS.BLOCKED;
    if (safety && safety.sourceGatewayStatus === 'GATEWAY_BLOCKED') return PREFLIGHT_STATUS.BLOCKED;

    var summary = buildPreflightSummary(preflights);

    if (safety && (safety.sourceGatewayStatus === 'GATEWAY_READY' || safety.sourceGatewayStatus === 'GATEWAY_PARTIAL')
        && summary.hasReadyTarget && !summary.hasBlocker) {
      return PREFLIGHT_STATUS.READY;
    }
    if (safety && safety.sourceGatewayStatus === 'GATEWAY_SKIPPED') return PREFLIGHT_STATUS.SKIPPED;
    if (summary.hasReadyTarget && summary.hasBlocker) return PREFLIGHT_STATUS.PARTIAL;
    if (!summary.hasReadyTarget && !summary.hasBlocker) return PREFLIGHT_STATUS.SKIPPED;

    return PREFLIGHT_STATUS.UNKNOWN;
  }

  // §normalize ────────────────────────────────────────────────────────────

  function normalizePreflightTarget(t /*, cfg */) {
    if (!isPlainObject(t)) {
      return {
        ready: false,
        target: null,
        preflightOnly: true,
        sideEffectAllowed: false,
        gatewayRef: null,
        executionIntent: null,
        bindingRequirementSnapshot: null,
        liveReadinessPolicy: null,
        killSwitchPlan: null,
        rollbackPlan: null,
        disablePlan: null,
        perTargetGate: { allow: false, reason: 'PREFLIGHT_ONLY' },
        riskSummary: null,
        blockedReasons: [],
        warnings: []
      };
    }
    return {
      ready: t.ready === true,
      target: typeof t.target === 'string' ? t.target : null,
      preflightOnly: true,
      sideEffectAllowed: false,
      gatewayRef: isPlainObject(t.gatewayRef) ? t.gatewayRef : null,
      executionIntent: isPlainObject(t.executionIntent) ? t.executionIntent : null,
      bindingRequirementSnapshot: isPlainObject(t.bindingRequirementSnapshot) ? t.bindingRequirementSnapshot : null,
      liveReadinessPolicy: isPlainObject(t.liveReadinessPolicy) ? t.liveReadinessPolicy : null,
      killSwitchPlan: isPlainObject(t.killSwitchPlan) ? t.killSwitchPlan : null,
      rollbackPlan: isPlainObject(t.rollbackPlan) ? t.rollbackPlan : null,
      disablePlan: isPlainObject(t.disablePlan) ? t.disablePlan : null,
      perTargetGate: isPlainObject(t.perTargetGate) ? { allow: false, reason: 'PREFLIGHT_ONLY' } : { allow: false, reason: 'PREFLIGHT_ONLY' },
      riskSummary: isPlainObject(t.riskSummary) ? t.riskSummary : null,
      blockedReasons: Array.isArray(t.blockedReasons) ? t.blockedReasons : [],
      warnings: Array.isArray(t.warnings) ? t.warnings : []
    };
  }

  function normalizeLiveExecutionPreflightGate(result) {
    if (!isPlainObject(result)) return null;
    return result;
  }

  // §main entry ──────────────────────────────────────────────────────────

  function buildLiveExecutionPreflightGate(input, config) {
    var inp = isPlainObject(input) ? input : {};
    var cfg = mergeLiveExecutionPreflightGateConfig(config);
    var reasons = [];
    var warnings = [];

    // STEP 1 — INVALID
    var src = isPlainObject(inp.secureBindingGatewayContract) ? inp.secureBindingGatewayContract : null;
    var invalidGateway = (src === null) || (src.valid !== true);
    var sourceGatewayStatus = (src && typeof src.gatewayStatus === 'string') ? src.gatewayStatus : null;

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

    // STEP 3 — mode / 11 boolean hard block
    var modeBlocked = (cfg.preflightMode !== PREFLIGHT_MODE.PREFLIGHT_ONLY);
    var hardBlockBoolean = (cfg.liveExecutionAllowed === true)
                        || (cfg.credentialLookupAllowed === true)
                        || (cfg.bindingLookupAllowed === true)
                        || (cfg.driverCallAllowed === true)
                        || (cfg.fetchAllowed === true)
                        || (cfg.writeAllowed === true)
                        || (cfg.retryAllowed === true)
                        || (cfg.timerAllowed === true)
                        || (cfg.envAccessAllowed === true)
                        || (cfg.rollbackExecutionAllowed === true)
                        || (cfg.killSwitchMutationAllowed === true);

    // STEP 4 — base preflight (default — non-ready, full shape)
    function makeBase(targetType) {
      var gatewayRef = buildGatewayRef({ gatewayStatus: sourceGatewayStatus }, targetType, cfg);
      var executionIntent = buildExecutionIntent(null, targetType, cfg);
      var bindingRequirementSnapshot = buildBindingRequirementSnapshot(null, targetType, cfg);
      var liveReadinessPolicy = buildLiveReadinessPolicy(null, targetType, cfg);
      var killSwitchPlan = buildKillSwitchPlan(null, targetType, cfg);
      var rollbackPlan = buildRollbackPlan(null, targetType, cfg);
      var disablePlan = buildDisablePlan(null, targetType, cfg);
      var draft = {
        ready: false,
        target: targetType,
        preflightOnly: true,
        sideEffectAllowed: false,
        gatewayRef: gatewayRef,
        executionIntent: executionIntent,
        bindingRequirementSnapshot: bindingRequirementSnapshot,
        liveReadinessPolicy: liveReadinessPolicy,
        killSwitchPlan: killSwitchPlan,
        rollbackPlan: rollbackPlan,
        disablePlan: disablePlan,
        perTargetGate: { allow: false, reason: 'PREFLIGHT_ONLY' },
        riskSummary: null,
        blockedReasons: [],
        warnings: []
      };
      draft.riskSummary = buildRiskSummary(draft, targetType, cfg);
      return draft;
    }

    var teleP = makeBase(TARGET.TELEGRAM);
    var snapP = makeBase(TARGET.SNAPSHOT_STORE);
    var evalP = makeBase(TARGET.EVALUATION_STORE);
    var auditP = makeBase(TARGET.AUDIT_STORE);

    function pushBlockToAll(code) {
      teleP.blockedReasons.push(code);
      snapP.blockedReasons.push(code);
      evalP.blockedReasons.push(code);
      auditP.blockedReasons.push(code);
    }

    if (invalidGateway) {
      reasons.push('SECURE_BINDING_GATEWAY_CONTRACT_INVALID');
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
      reasons.push('NON_PREFLIGHT_ONLY_MODE_BLOCKED');
      pushBlockToAll('NON_PREFLIGHT_ONLY_MODE_BLOCKED');
    } else if (hardBlockBoolean) {
      reasons.push('HARD_BLOCK_BOOLEAN_TRUE');
      if (cfg.liveExecutionAllowed === true) pushBlockToAll('LIVE_EXECUTION_ALLOWED_BLOCKED');
      if (cfg.credentialLookupAllowed === true) pushBlockToAll('CREDENTIAL_LOOKUP_ALLOWED_BLOCKED');
      if (cfg.bindingLookupAllowed === true) pushBlockToAll('BINDING_LOOKUP_ALLOWED_BLOCKED');
      if (cfg.driverCallAllowed === true) pushBlockToAll('DRIVER_CALL_ALLOWED_BLOCKED');
      if (cfg.fetchAllowed === true) pushBlockToAll('FETCH_ALLOWED_BLOCKED');
      if (cfg.writeAllowed === true) pushBlockToAll('WRITE_ALLOWED_BLOCKED');
      if (cfg.retryAllowed === true) pushBlockToAll('RETRY_ALLOWED_BLOCKED');
      if (cfg.timerAllowed === true) pushBlockToAll('TIMER_ALLOWED_BLOCKED');
      if (cfg.envAccessAllowed === true) pushBlockToAll('ENV_ACCESS_ALLOWED_BLOCKED');
      if (cfg.rollbackExecutionAllowed === true) pushBlockToAll('ROLLBACK_EXECUTION_ALLOWED_BLOCKED');
      if (cfg.killSwitchMutationAllowed === true) pushBlockToAll('KILL_SWITCH_MUTATION_ALLOWED_BLOCKED');
    } else if (sourceGatewayStatus === 'GATEWAY_BLOCKED') {
      reasons.push('SOURCE_GATEWAY_BLOCKED');
      pushBlockToAll('SOURCE_GATEWAY_BLOCKED');
    } else {
      // STEP 5 — normal preflight builds
      teleP = buildTelegramPreflight(inp, cfg);
      snapP = buildSnapshotPreflight(inp, cfg);
      evalP = buildEvaluationPreflight(inp, cfg);
      auditP = buildAuditPreflight(inp, cfg);
    }

    // STEP 6 — normalize
    teleP = normalizePreflightTarget(teleP, cfg);
    snapP = normalizePreflightTarget(snapP, cfg);
    evalP = normalizePreflightTarget(evalP, cfg);
    auditP = normalizePreflightTarget(auditP, cfg);

    // STEP 7 — summary + classify
    var preflights = {
      telegramPreflight: teleP,
      snapshotPreflight: snapP,
      evaluationPreflight: evalP,
      auditPreflight: auditP
    };
    var summary = buildPreflightSummary(preflights);
    var safetyFlags = {
      invalidGateway: invalidGateway,
      sourceGatewayStatus: sourceGatewayStatus,
      credentialBlocked: credBlocked,
      envLikeBlocked: envLikeBlocked,
      depthBlocked: depthBlocked,
      functionInputBlocked: functionInputBlocked,
      modeBlocked: modeBlocked,
      hardBlockBoolean: hardBlockBoolean
    };
    var preflightStatus = classifyPreflightStatus(preflights, safetyFlags, cfg);

    // STEP 8 — reasons
    if (preflightStatus === PREFLIGHT_STATUS.READY) reasons.push('PREFLIGHT_READY');
    if (preflightStatus === PREFLIGHT_STATUS.PARTIAL) reasons.push('PREFLIGHT_PARTIAL');
    if (preflightStatus === PREFLIGHT_STATUS.SKIPPED) reasons.push('PREFLIGHT_SKIPPED');
    if (preflightStatus === PREFLIGHT_STATUS.UNKNOWN) reasons.push('PREFLIGHT_UNKNOWN_FALLBACK');
    if (teleP.ready) reasons.push('TELEGRAM_PREFLIGHT_READY');
    if (snapP.ready) reasons.push('SNAPSHOT_PREFLIGHT_READY');
    if (evalP.ready) reasons.push('EVALUATION_PREFLIGHT_READY');
    if (auditP.ready) reasons.push('AUDIT_PREFLIGHT_READY');

    // STEP 9 — preflightPolicy fixed contract
    var preflightPolicy = {
      preflightOnly: true,
      liveExecutionAllowed: false,
      credentialLookupAllowed: false,
      bindingLookupAllowed: false,
      driverCallAllowed: false,
      fetchAllowed: false,
      writeAllowed: false,
      retryAllowed: false,
      timerAllowed: false,
      envAccessAllowed: false,
      rollbackExecutionAllowed: false,
      killSwitchMutationAllowed: false,
      liveExecutionRequiresExplicitGate: true
    };

    // STEP 10 — configUsed scalar snapshot
    var configUsed = {
      version: cfg.version,
      preflightMode: cfg.preflightMode,
      liveExecutionAllowed: cfg.liveExecutionAllowed,
      credentialLookupAllowed: cfg.credentialLookupAllowed,
      bindingLookupAllowed: cfg.bindingLookupAllowed,
      driverCallAllowed: cfg.driverCallAllowed,
      fetchAllowed: cfg.fetchAllowed,
      writeAllowed: cfg.writeAllowed,
      retryAllowed: cfg.retryAllowed,
      timerAllowed: cfg.timerAllowed,
      envAccessAllowed: cfg.envAccessAllowed,
      rollbackExecutionAllowed: cfg.rollbackExecutionAllowed,
      killSwitchMutationAllowed: cfg.killSwitchMutationAllowed,
      targets: {
        telegram: { enabled: cfg.targets.telegram.enabled },
        snapshot: { enabled: cfg.targets.snapshot.enabled },
        evaluation: { enabled: cfg.targets.evaluation.enabled },
        audit: { enabled: cfg.targets.audit.enabled }
      },
      liveReadinessPolicy: {
        requiresExplicitUserApproval: cfg.liveReadinessPolicy.requiresExplicitUserApproval,
        requiresSecureRuntimeAdapter: cfg.liveReadinessPolicy.requiresSecureRuntimeAdapter,
        requiresKillSwitchOff: cfg.liveReadinessPolicy.requiresKillSwitchOff,
        requiresRollbackPlan: cfg.liveReadinessPolicy.requiresRollbackPlan,
        requiresRateLimitPass: cfg.liveReadinessPolicy.requiresRateLimitPass,
        requiresCircuitBreakerClosed: cfg.liveReadinessPolicy.requiresCircuitBreakerClosed,
        liveReady: cfg.liveReadinessPolicy.liveReady
      },
      safety: {
        blockCredentialFields: cfg.safety.blockCredentialFields,
        credentialMaxDepth: cfg.safety.credentialMaxDepth,
        credentialAllowListSize: cfg.safety.credentialAllowList.length,
        logicalRefAllowListSize: cfg.safety.logicalRefAllowList.length,
        blockEnvLikeObjects: cfg.safety.blockEnvLikeObjects,
        blockObjectTooDeep: cfg.safety.blockObjectTooDeep,
        blockFunctionInputs: cfg.safety.blockFunctionInputs,
        blockMaskedPreview: cfg.safety.blockMaskedPreview,
        allowRawPayload: cfg.safety.allowRawPayload,
        allowEnvRead: cfg.safety.allowEnvRead,
        allowDirectSecretAccess: cfg.safety.allowDirectSecretAccess,
        allowFunctionInput: cfg.safety.allowFunctionInput,
        allowAsync: cfg.safety.allowAsync,
        allowTimer: cfg.safety.allowTimer,
        allowMaskedCredentialPreview: cfg.safety.allowMaskedCredentialPreview
      },
      requestShape: { maxStringLength: cfg.requestShape.maxStringLength },
      wording: { sanitizeMode: cfg.wording.sanitizeMode }
    };

    var draft = {
      valid: invalidGateway ? false : true,
      version: PREFLIGHT_VERSION,
      preflightMode: cfg.preflightMode === PREFLIGHT_MODE.PREFLIGHT_ONLY ? 'PREFLIGHT_ONLY' : cfg.preflightMode,
      liveExecutionAllowed: cfg.liveExecutionAllowed === true,
      preflightStatus: preflightStatus,
      sourceGatewayStatus: sourceGatewayStatus,
      preflightPolicy: preflightPolicy,
      telegramPreflight: teleP,
      snapshotPreflight: snapP,
      evaluationPreflight: evalP,
      auditPreflight: auditP,
      preflightSummary: summary,
      reasons: reasons,
      warnings: warnings,
      debug: {
        source: 'secureBindingGatewayContract + transportExecutorSandboxRunner + transportExecutorInterfaceAdapter + transportExecutorHarness + secureTransportExecutorContract + transportExecutionEnvelope + transportPlan + rendererBinding + operationPacket + activeCycleDecision + evaluationOutcome + externalConfluence',
        configVersion: cfg.version,
        invalidGateway: invalidGateway,
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
    return normalizeLiveExecutionPreflightGate(draft) || draft;
  }

  // §export ──────────────────────────────────────────────────────────────

  var api = Object.freeze({
    VERSION: PREFLIGHT_VERSION,
    DEFAULT_LIVE_EXECUTION_PREFLIGHT_GATE_CONFIG: DEFAULT_LIVE_EXECUTION_PREFLIGHT_GATE_CONFIG,
    PREFLIGHT_MODE: PREFLIGHT_MODE,
    PREFLIGHT_STATUS: PREFLIGHT_STATUS,
    TARGET: TARGET,
    ACTION: ACTION,
    WORDING_SANITIZE_MODE: WORDING_SANITIZE_MODE,
    build: buildLiveExecutionPreflightGate,
    mergeLiveExecutionPreflightGateConfig: mergeLiveExecutionPreflightGateConfig,
    buildTelegramPreflight: buildTelegramPreflight,
    buildSnapshotPreflight: buildSnapshotPreflight,
    buildEvaluationPreflight: buildEvaluationPreflight,
    buildAuditPreflight: buildAuditPreflight,
    buildGatewayRef: buildGatewayRef,
    buildExecutionIntent: buildExecutionIntent,
    buildBindingRequirementSnapshot: buildBindingRequirementSnapshot,
    buildLiveReadinessPolicy: buildLiveReadinessPolicy,
    buildKillSwitchPlan: buildKillSwitchPlan,
    buildRollbackPlan: buildRollbackPlan,
    buildDisablePlan: buildDisablePlan,
    buildRiskSummary: buildRiskSummary,
    buildPreflightSummary: buildPreflightSummary,
    classifyPreflightStatus: classifyPreflightStatus,
    detectCredentialFields: detectCredentialFields,
    detectEnvLikeObjects: detectEnvLikeObjects,
    detectFunctionInputs: detectFunctionInputs,
    validateGatewayRef: validateGatewayRef,
    validateExecutionIntent: validateExecutionIntent,
    validateBindingRequirementSnapshot: validateBindingRequirementSnapshot,
    validateLiveReadinessPolicy: validateLiveReadinessPolicy,
    validateKillSwitchPlan: validateKillSwitchPlan,
    validateRollbackPlan: validateRollbackPlan,
    validateDisablePlan: validateDisablePlan,
    validateRiskSummary: validateRiskSummary,
    sanitizeMessageLines: sanitizeMessageLines
  });

  global.WS3_LiveExecutionPreflightGate = api;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
