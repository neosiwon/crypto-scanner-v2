/**
 * WS3 v0.20.0 — SecureRuntimeStateAdapter (Telegram Canary Fast Track Pack Part 1)
 *
 * Scope:
 *   liveExecutionPreflightGate (v0.19.0) + (read-only chain) secureBindingGatewayContract (v0.18.0) +
 *   transportExecutorSandboxRunner (v0.17.0) + … + payload
 *   → standalone SecureRuntimeStateAdapter (CANARY_PREP_ONLY runtime state contract)
 *
 * 단일 기준 문서:
 *   docs/ws3/WS3_CODE_CONTRACT.md (b-r2 박제본)
 *
 * 확정 DP 정책 (DP-RUNTIME, Gate 2 spec):
 *   DP-RUNTIME1   side-effect 0건. 실제 LIVE / fetch / KV / DB / credential read / env access 0건.
 *                 sync only. async / await / Promise / thenable / setTimeout / setInterval 0건.
 *                 Date.now / new Date / performance.now 0건.
 *   DP-RUNTIME2   liveExecutionPreflightGate ready/status/policy override 0건. read-only consume.
 *   DP-RUNTIME3   runtimeMode CANARY_PREP_ONLY only. LIVE / EXECUTE → RUNTIME_BLOCKED.
 *   DP-RUNTIME4   6 validate 함수 본문 규칙 박제 (plain object only + depth limit 1 +
 *                 Array/function/Promise/thenable 차단 + whitelist key + enum/boolean 강제 +
 *                 INVALID_<TYPE>:<sub-reason>:<target> reason).
 *   DP-RUNTIME5   신규 파일 1개 + 문서 갱신만. 보호 파일 31종 수정 금지.
 *
 * 출력 (top-level):
 *   valid, version, runtimeMode='CANARY_PREP_ONLY', canaryOnly=true, liveSignalEnabled=false,
 *   runtimeStatus, sourcePreflightStatus, runtimePolicy,
 *   killSwitchRuntimeState, rollbackRuntimeState, disableRuntimeState,
 *   telegramRuntimeEligibility, canaryRuntimePolicy, safeDiagnostics,
 *   reasons[], warnings[], debug, configUsed
 *
 * runtimeStatus 4 후보 (first-match-wins):
 *   RUNTIME_INVALID  → liveExecutionPreflightGate missing 또는 valid !== true
 *   RUNTIME_BLOCKED  → source PREFLIGHT_BLOCKED/INVALID / preflightMode !== PREFLIGHT_ONLY /
 *                      liveExecutionAllowed===true / credential / env-like / function input /
 *                      validation 실패
 *   RUNTIME_READY    → source PREFLIGHT_READY/PARTIAL + telegramPreflight.ready===true + blocker 0
 *   RUNTIME_UNKNOWN  → fallback
 *
 * 의도된 미구현 (이번 단계 제외):
 *   실제 Telegram 발송 / fetch / KV write / DB write / credential 값 출력 / token/chatId 로그 출력
 *   실제 코인 후보 연결 / worker.js 본선 수정 / index.html 수정
 *   async / await / Promise / timer 사용
 *   process.env / globalThis.env 접근
 *   Date.now / new Date / performance.now 사용
 *
 * 함수 목록:
 *   mergeSecureRuntimeStateAdapterConfig(config)
 *   buildSecureRuntimeStateAdapter(input, config)              ← 진입점
 *   buildKillSwitchRuntimeState / buildRollbackRuntimeState / buildDisableRuntimeState
 *   buildTelegramRuntimeEligibility / buildCanaryRuntimePolicy / buildSafeDiagnostics
 *   validateKillSwitchRuntimeState / validateRollbackRuntimeState / validateDisableRuntimeState
 *   validateTelegramRuntimeEligibility / validateCanaryRuntimePolicy / validateSafeDiagnostics
 *   detectCredentialFields / detectEnvLikeObjects / detectFunctionInputs
 *   classifyRuntimeStatus
 *   normalizeSecureRuntimeStateAdapter
 *   isPlainObject, safeString, safeNumber, pushReason, pushWarning
 *
 * export:
 *   global.WS3_SecureRuntimeStateAdapter + module.exports
 */
(function(global) {
  'use strict';

  // §version
  var RUNTIME_VERSION = 'WS3_v0.20.0_secure_runtime_state_adapter';

  // §runtimeMode (only CANARY_PREP_ONLY allowed)
  var RUNTIME_MODE = Object.freeze({
    CANARY_PREP_ONLY: 'CANARY_PREP_ONLY'
  });

  // §runtimeStatus 4 후보
  var RUNTIME_STATUS = Object.freeze({
    READY: 'RUNTIME_READY',
    BLOCKED: 'RUNTIME_BLOCKED',
    INVALID: 'RUNTIME_INVALID',
    UNKNOWN: 'RUNTIME_UNKNOWN'
  });

  // §target enum (Telegram 만 Canary 대상)
  var TARGET = Object.freeze({
    TELEGRAM: 'TELEGRAM'
  });

  // §killSwitch runtime state — CANARY_ALLOWED only (v0.20 단계)
  var KILL_SWITCH_RUNTIME_STATE_ALLOWED = 'CANARY_ALLOWED';
  var KILL_SWITCH_RUNTIME_SOURCE = 'explicit_config_only';

  // §preflightStatus enum (v0.19 inherited — read-only)
  var PREFLIGHT_STATUS_ENUM = Object.freeze([
    'PREFLIGHT_READY',
    'PREFLIGHT_SKIPPED',
    'PREFLIGHT_BLOCKED',
    'PREFLIGHT_PARTIAL',
    'PREFLIGHT_INVALID',
    'PREFLIGHT_UNKNOWN'
  ]);

  function isValidPreflightStatus(s) {
    if (typeof s !== 'string') return false;
    var i;
    for (i = 0; i < PREFLIGHT_STATUS_ENUM.length; i++) {
      if (PREFLIGHT_STATUS_ENUM[i] === s) return true;
    }
    return false;
  }

  // §credential 9 키 (lower-case, case-insensitive partial match)
  var CREDENTIAL_KEYS_BASE = Object.freeze([
    'secret', 'token', 'chatid', 'bottoken', 'apikey',
    'authorization', 'password', 'credential', 'webhookurl'
  ]);

  // §framework multi-word logical term — credential 우회 자격
  var FRAMEWORK_BYPASS_TERMS = Object.freeze([
    'CREDENTIAL_HANDLE',
    'CREDENTIAL_HANDLE_REF'
  ]);

  // §RESERVED framework metadata 키 (v0.13~v0.20 모듈 자체 metadata 식별자)
  var RESERVED_FRAMEWORK_METADATA_KEYS = Object.freeze([
    // credential* metadata fields
    'credentialAllowList', 'credentialAllowListSize', 'credentialMaxDepth',
    'credentialDetections', 'credentialDepthWarnings', 'credentialBlocked',
    'credentialInPayloadAllowed', 'credentialInEnvelopeAllowed',
    'credentialSource', 'credentialPolicy', 'credentialLookupAllowed',
    'credentialHandleRef', 'blockCredentialFields',
    // *Secret*/*Webhook* policy
    'allowWebhookUrl', 'allowDirectSecretAccess', 'directSecretAccessAllowed',
    // binding ref policy fields
    'bindingRefAllowList', 'bindingRefAllowListSize', 'bindingRefCredentialPatternBlocked',
    // logical ref policy fields
    'logicalRefAllowList', 'logicalRefAllowListSize',
    'logicalRefCredentialPatternBlocked', 'logicalRefFunctionPatternBlocked',
    // sandbox policy metadata
    'sandboxFixtureCredentialPatternBlocked', 'sandboxFixturePatternBlocked',
    'sandboxFixtureFunctionPatternBlocked',
    // v0.19 preflight credential value boundary fields
    'credentialValueAvailable', 'credentialValueExposed', 'credentialValueMasked',
    'credentialValueLogged', 'credentialValueStored',
    'allowMaskedCredentialPreview',
    // v0.20/v0.21 safeDiagnostics fields (false-positive 회피)
    'tokenValueExposed', 'chatIdValueExposed', 'rawTelegramResponseExposed',
    'tokenPresent', 'chatIdPresent', 'canaryEnabled'
  ]);

  // §env-like 11 키 (exact match + object)
  var ENV_LIKE_KEYS_EXACT = Object.freeze([
    'env', 'ENV', 'environment', 'bindings', 'cfEnv', 'cloudflareEnv',
    'secrets', 'kvNamespace', 'kv', 'KV', 'process'
  ]);

  // §runtimePolicy 박제
  function buildRuntimePolicy() {
    return {
      runtimeOnly: true,
      canaryOnly: true,
      liveSignalEnabled: false,
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
      kvWriteAllowed: false,
      dbWriteAllowed: false,
      snapshotAllowed: false,
      evaluationAllowed: false,
      auditAllowed: false,
      liveExecutionRequiresExplicitGate: true
    };
  }

  // §DEFAULT_CONFIG
  var DEFAULT_SECURE_RUNTIME_STATE_ADAPTER_CONFIG = Object.freeze({
    version: 'inline-default-v0',
    runtimeMode: 'CANARY_PREP_ONLY',
    canaryOnly: true,
    liveSignalEnabled: false,
    targets: Object.freeze({
      telegram: Object.freeze({ enabled: true })
    }),
    safety: Object.freeze({
      blockCredentialFields: true,
      credentialMaxDepth: 5,
      credentialAllowList: Object.freeze([]),
      blockEnvLikeObjects: true,
      blockObjectTooDeep: true,
      blockFunctionInputs: true
    }),
    debug: Object.freeze({ enabled: false, allowedFields: Object.freeze([]) })
  });

  // §helpers ─────────────────────────────────────────────────────────────

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

  // §config merge — field-by-field
  function mergeSecureRuntimeStateAdapterConfig(config) {
    var c = isPlainObject(config) ? config : {};
    var d = DEFAULT_SECURE_RUNTIME_STATE_ADAPTER_CONFIG;

    var tg = isPlainObject(c.targets) ? c.targets : {};
    var sf = isPlainObject(c.safety) ? c.safety : {};
    var db = isPlainObject(c.debug) ? c.debug : {};

    var tgTele = isPlainObject(tg.telegram) ? tg.telegram : {};

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
    var debugAllowed = copyStringArray(db.allowedFields, d.debug.allowedFields);

    var maxDepth = (typeof sf.credentialMaxDepth === 'number' && isFinite(sf.credentialMaxDepth) && sf.credentialMaxDepth > 0)
      ? sf.credentialMaxDepth
      : d.safety.credentialMaxDepth;

    return {
      version: (typeof c.version === 'string' && c.version.length > 0) ? c.version : d.version,
      runtimeMode: (typeof c.runtimeMode === 'string' && c.runtimeMode.length > 0) ? c.runtimeMode : d.runtimeMode,
      canaryOnly: c.canaryOnly !== false,
      liveSignalEnabled: c.liveSignalEnabled === true,
      targets: {
        telegram: { enabled: tgTele.enabled !== false }
      },
      safety: {
        blockCredentialFields: sf.blockCredentialFields !== false,
        credentialMaxDepth: maxDepth,
        credentialAllowList: credAllow,
        blockEnvLikeObjects: sf.blockEnvLikeObjects !== false,
        blockObjectTooDeep: sf.blockObjectTooDeep !== false,
        blockFunctionInputs: sf.blockFunctionInputs !== false
      },
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
    var cfg = mergeSecureRuntimeStateAdapterConfig(config);
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
    var cfg = mergeSecureRuntimeStateAdapterConfig(config);
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
    var cfg = mergeSecureRuntimeStateAdapterConfig(config);
    var detections = [];

    if (cfg.safety.blockFunctionInputs !== true) {
      return { detections: detections };
    }

    function walk(value, path, depth) {
      if (!isPlainObject(value) && !Array.isArray(value)) return;
      if (depth > cfg.safety.credentialMaxDepth) return;
      if (Array.isArray(value)) {
        var i;
        for (i = 0; i < value.length; i++) {
          var av = value[i];
          if (isFunctionLikeValue(av)) { detections.push(path + '[' + i + ']'); continue; }
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
          if (isFunctionLikeValue(childVal)) { detections.push(nextPath); continue; }
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
        if (isFunctionLikeValue(iv)) { detections.push('input.' + ik); continue; }
        walk(iv, 'input.' + ik, 1);
      }
    }
    if (isPlainObject(config)) {
      var cKeys = Object.keys(config);
      var cx;
      for (cx = 0; cx < cKeys.length; cx++) {
        var ck = cKeys[cx];
        var cv = config[ck];
        if (isFunctionLikeValue(cv)) { detections.push('config.' + ck); continue; }
        walk(cv, 'config.' + ck, 1);
      }
    }
    return { detections: detections };
  }

  // §6 validate functions ────────────────────────────────────────────────

  function validateKillSwitchRuntimeState(s /*, cfg */) {
    if (!isPlainObject(s)) return { valid: false, reason: 'INVALID_KILL_SWITCH_RUNTIME_STATE:NOT_PLAIN_OBJECT' };
    if (Array.isArray(s)) return { valid: false, reason: 'INVALID_KILL_SWITCH_RUNTIME_STATE:ARRAY_VALUE' };
    if (hasFunctionOrPromiseInPlainObject(s)) return { valid: false, reason: 'INVALID_KILL_SWITCH_RUNTIME_STATE:FUNCTION_VALUE' };

    var allowed = ['evaluated', 'state', 'source', 'mutationAllowed'];
    var keys = Object.keys(s);
    var i;
    for (i = 0; i < keys.length; i++) {
      var k = keys[i];
      var ok = false; var ai;
      for (ai = 0; ai < allowed.length; ai++) { if (allowed[ai] === k) { ok = true; break; } }
      if (!ok) return { valid: false, reason: 'INVALID_KILL_SWITCH_RUNTIME_STATE:EXTRA_KEY:' + k };
      var v = s[k];
      if (isPlainObject(v) || Array.isArray(v)) return { valid: false, reason: 'INVALID_KILL_SWITCH_RUNTIME_STATE:NESTED_OBJECT:' + k };
    }
    if (s.evaluated !== true) return { valid: false, reason: 'INVALID_KILL_SWITCH_RUNTIME_STATE:EVALUATED_NOT_TRUE' };
    if (s.state !== KILL_SWITCH_RUNTIME_STATE_ALLOWED) return { valid: false, reason: 'INVALID_KILL_SWITCH_RUNTIME_STATE:INVALID_STATE' };
    if (s.source !== KILL_SWITCH_RUNTIME_SOURCE) return { valid: false, reason: 'INVALID_KILL_SWITCH_RUNTIME_STATE:INVALID_SOURCE' };
    if (s.mutationAllowed !== false) return { valid: false, reason: 'INVALID_KILL_SWITCH_RUNTIME_STATE:MUTATION_ALLOWED_TRUE' };
    return { valid: true, reason: null };
  }

  function validateRollbackRuntimeState(s /*, cfg */) {
    if (!isPlainObject(s)) return { valid: false, reason: 'INVALID_ROLLBACK_RUNTIME_STATE:NOT_PLAIN_OBJECT' };
    if (Array.isArray(s)) return { valid: false, reason: 'INVALID_ROLLBACK_RUNTIME_STATE:ARRAY_VALUE' };
    if (hasFunctionOrPromiseInPlainObject(s)) return { valid: false, reason: 'INVALID_ROLLBACK_RUNTIME_STATE:FUNCTION_VALUE' };

    var allowed = ['evaluated', 'rollbackAvailable', 'rollbackExecutionAllowed'];
    var keys = Object.keys(s);
    var i;
    for (i = 0; i < keys.length; i++) {
      var k = keys[i];
      var ok = false; var ai;
      for (ai = 0; ai < allowed.length; ai++) { if (allowed[ai] === k) { ok = true; break; } }
      if (!ok) return { valid: false, reason: 'INVALID_ROLLBACK_RUNTIME_STATE:EXTRA_KEY:' + k };
      var v = s[k];
      if (isPlainObject(v) || Array.isArray(v)) return { valid: false, reason: 'INVALID_ROLLBACK_RUNTIME_STATE:NESTED_OBJECT:' + k };
    }
    if (s.evaluated !== true) return { valid: false, reason: 'INVALID_ROLLBACK_RUNTIME_STATE:EVALUATED_NOT_TRUE' };
    if (s.rollbackAvailable !== false) return { valid: false, reason: 'INVALID_ROLLBACK_RUNTIME_STATE:ROLLBACK_AVAILABLE_TRUE' };
    if (s.rollbackExecutionAllowed !== false) return { valid: false, reason: 'INVALID_ROLLBACK_RUNTIME_STATE:ROLLBACK_EXECUTION_ALLOWED_TRUE' };
    return { valid: true, reason: null };
  }

  function validateDisableRuntimeState(s /*, cfg */) {
    if (!isPlainObject(s)) return { valid: false, reason: 'INVALID_DISABLE_RUNTIME_STATE:NOT_PLAIN_OBJECT' };
    if (Array.isArray(s)) return { valid: false, reason: 'INVALID_DISABLE_RUNTIME_STATE:ARRAY_VALUE' };
    if (hasFunctionOrPromiseInPlainObject(s)) return { valid: false, reason: 'INVALID_DISABLE_RUNTIME_STATE:FUNCTION_VALUE' };

    var allowed = ['evaluated', 'disabled', 'disableExecutionAllowed'];
    var keys = Object.keys(s);
    var i;
    for (i = 0; i < keys.length; i++) {
      var k = keys[i];
      var ok = false; var ai;
      for (ai = 0; ai < allowed.length; ai++) { if (allowed[ai] === k) { ok = true; break; } }
      if (!ok) return { valid: false, reason: 'INVALID_DISABLE_RUNTIME_STATE:EXTRA_KEY:' + k };
      var v = s[k];
      if (isPlainObject(v) || Array.isArray(v)) return { valid: false, reason: 'INVALID_DISABLE_RUNTIME_STATE:NESTED_OBJECT:' + k };
    }
    if (s.evaluated !== true) return { valid: false, reason: 'INVALID_DISABLE_RUNTIME_STATE:EVALUATED_NOT_TRUE' };
    if (s.disabled !== false) return { valid: false, reason: 'INVALID_DISABLE_RUNTIME_STATE:DISABLED_TRUE' };
    if (s.disableExecutionAllowed !== false) return { valid: false, reason: 'INVALID_DISABLE_RUNTIME_STATE:DISABLE_EXECUTION_ALLOWED_TRUE' };
    return { valid: true, reason: null };
  }

  function validateTelegramRuntimeEligibility(e /*, cfg */) {
    if (!isPlainObject(e)) return { valid: false, reason: 'INVALID_TELEGRAM_RUNTIME_ELIGIBILITY:NOT_PLAIN_OBJECT' };
    if (Array.isArray(e)) return { valid: false, reason: 'INVALID_TELEGRAM_RUNTIME_ELIGIBILITY:ARRAY_VALUE' };
    if (hasFunctionOrPromiseInPlainObject(e)) return { valid: false, reason: 'INVALID_TELEGRAM_RUNTIME_ELIGIBILITY:FUNCTION_VALUE' };

    var allowed = ['target', 'eligibleForCanary', 'eligibleForLiveSignal', 'reason'];
    var keys = Object.keys(e);
    var i;
    for (i = 0; i < keys.length; i++) {
      var k = keys[i];
      var ok = false; var ai;
      for (ai = 0; ai < allowed.length; ai++) { if (allowed[ai] === k) { ok = true; break; } }
      if (!ok) return { valid: false, reason: 'INVALID_TELEGRAM_RUNTIME_ELIGIBILITY:EXTRA_KEY:' + k };
      var v = e[k];
      if (isPlainObject(v) || Array.isArray(v)) return { valid: false, reason: 'INVALID_TELEGRAM_RUNTIME_ELIGIBILITY:NESTED_OBJECT:' + k };
    }
    if (e.target !== TARGET.TELEGRAM) return { valid: false, reason: 'INVALID_TELEGRAM_RUNTIME_ELIGIBILITY:INVALID_TARGET' };
    if (e.eligibleForCanary !== true) return { valid: false, reason: 'INVALID_TELEGRAM_RUNTIME_ELIGIBILITY:ELIGIBLE_FOR_CANARY_FALSE' };
    if (e.eligibleForLiveSignal !== false) return { valid: false, reason: 'INVALID_TELEGRAM_RUNTIME_ELIGIBILITY:ELIGIBLE_FOR_LIVE_SIGNAL_TRUE' };
    if (e.reason !== 'CANARY_ONLY') return { valid: false, reason: 'INVALID_TELEGRAM_RUNTIME_ELIGIBILITY:INVALID_REASON' };
    return { valid: true, reason: null };
  }

  function validateCanaryRuntimePolicy(p /*, cfg */) {
    if (!isPlainObject(p)) return { valid: false, reason: 'INVALID_CANARY_RUNTIME_POLICY:NOT_PLAIN_OBJECT' };
    if (Array.isArray(p)) return { valid: false, reason: 'INVALID_CANARY_RUNTIME_POLICY:ARRAY_VALUE' };
    if (hasFunctionOrPromiseInPlainObject(p)) return { valid: false, reason: 'INVALID_CANARY_RUNTIME_POLICY:FUNCTION_VALUE' };

    var allowed = ['canaryOnly', 'fixedMessageOnly', 'candidatePayloadAllowed', 'snapshotAllowed', 'evaluationAllowed', 'auditAllowed', 'kvWriteAllowed', 'dbWriteAllowed'];
    var keys = Object.keys(p);
    var i;
    for (i = 0; i < keys.length; i++) {
      var k = keys[i];
      var ok = false; var ai;
      for (ai = 0; ai < allowed.length; ai++) { if (allowed[ai] === k) { ok = true; break; } }
      if (!ok) return { valid: false, reason: 'INVALID_CANARY_RUNTIME_POLICY:EXTRA_KEY:' + k };
      var v = p[k];
      if (isPlainObject(v) || Array.isArray(v)) return { valid: false, reason: 'INVALID_CANARY_RUNTIME_POLICY:NESTED_OBJECT:' + k };
    }
    if (p.canaryOnly !== true) return { valid: false, reason: 'INVALID_CANARY_RUNTIME_POLICY:CANARY_ONLY_FALSE' };
    if (p.fixedMessageOnly !== true) return { valid: false, reason: 'INVALID_CANARY_RUNTIME_POLICY:FIXED_MESSAGE_ONLY_FALSE' };
    if (p.candidatePayloadAllowed !== false) return { valid: false, reason: 'INVALID_CANARY_RUNTIME_POLICY:CANDIDATE_PAYLOAD_ALLOWED_TRUE' };
    if (p.snapshotAllowed !== false) return { valid: false, reason: 'INVALID_CANARY_RUNTIME_POLICY:SNAPSHOT_ALLOWED_TRUE' };
    if (p.evaluationAllowed !== false) return { valid: false, reason: 'INVALID_CANARY_RUNTIME_POLICY:EVALUATION_ALLOWED_TRUE' };
    if (p.auditAllowed !== false) return { valid: false, reason: 'INVALID_CANARY_RUNTIME_POLICY:AUDIT_ALLOWED_TRUE' };
    if (p.kvWriteAllowed !== false) return { valid: false, reason: 'INVALID_CANARY_RUNTIME_POLICY:KV_WRITE_ALLOWED_TRUE' };
    if (p.dbWriteAllowed !== false) return { valid: false, reason: 'INVALID_CANARY_RUNTIME_POLICY:DB_WRITE_ALLOWED_TRUE' };
    return { valid: true, reason: null };
  }

  function validateSafeDiagnostics(d /*, cfg */) {
    if (!isPlainObject(d)) return { valid: false, reason: 'INVALID_SAFE_DIAGNOSTICS:NOT_PLAIN_OBJECT' };
    if (Array.isArray(d)) return { valid: false, reason: 'INVALID_SAFE_DIAGNOSTICS:ARRAY_VALUE' };
    if (hasFunctionOrPromiseInPlainObject(d)) return { valid: false, reason: 'INVALID_SAFE_DIAGNOSTICS:FUNCTION_VALUE' };

    var allowed = ['tokenValueExposed', 'chatIdValueExposed', 'rawTelegramResponseExposed'];
    var keys = Object.keys(d);
    var i;
    for (i = 0; i < keys.length; i++) {
      var k = keys[i];
      var ok = false; var ai;
      for (ai = 0; ai < allowed.length; ai++) { if (allowed[ai] === k) { ok = true; break; } }
      if (!ok) return { valid: false, reason: 'INVALID_SAFE_DIAGNOSTICS:EXTRA_KEY:' + k };
      var v = d[k];
      if (isPlainObject(v) || Array.isArray(v)) return { valid: false, reason: 'INVALID_SAFE_DIAGNOSTICS:NESTED_OBJECT:' + k };
    }
    if (d.tokenValueExposed !== false) return { valid: false, reason: 'INVALID_SAFE_DIAGNOSTICS:TOKEN_VALUE_EXPOSED_TRUE' };
    if (d.chatIdValueExposed !== false) return { valid: false, reason: 'INVALID_SAFE_DIAGNOSTICS:CHAT_ID_VALUE_EXPOSED_TRUE' };
    if (d.rawTelegramResponseExposed !== false) return { valid: false, reason: 'INVALID_SAFE_DIAGNOSTICS:RAW_TELEGRAM_RESPONSE_EXPOSED_TRUE' };
    return { valid: true, reason: null };
  }

  // §6 build functions ───────────────────────────────────────────────────

  function buildKillSwitchRuntimeState(/* preflight, cfg */) {
    return {
      evaluated: true,
      state: KILL_SWITCH_RUNTIME_STATE_ALLOWED,
      source: KILL_SWITCH_RUNTIME_SOURCE,
      mutationAllowed: false
    };
  }

  function buildRollbackRuntimeState(/* preflight, cfg */) {
    return {
      evaluated: true,
      rollbackAvailable: false,
      rollbackExecutionAllowed: false
    };
  }

  function buildDisableRuntimeState(/* preflight, cfg */) {
    return {
      evaluated: true,
      disabled: false,
      disableExecutionAllowed: false
    };
  }

  function buildTelegramRuntimeEligibility(/* preflight, cfg */) {
    return {
      target: TARGET.TELEGRAM,
      eligibleForCanary: true,
      eligibleForLiveSignal: false,
      reason: 'CANARY_ONLY'
    };
  }

  function buildCanaryRuntimePolicy(/* preflight, cfg */) {
    return {
      canaryOnly: true,
      fixedMessageOnly: true,
      candidatePayloadAllowed: false,
      snapshotAllowed: false,
      evaluationAllowed: false,
      auditAllowed: false,
      kvWriteAllowed: false,
      dbWriteAllowed: false
    };
  }

  function buildSafeDiagnostics(/* preflight, cfg */) {
    return {
      tokenValueExposed: false,
      chatIdValueExposed: false,
      rawTelegramResponseExposed: false
    };
  }

  // §classify ────────────────────────────────────────────────────────────

  function classifyRuntimeStatus(safety, cfg, telegramReady) {
    if (safety && safety.invalidPreflight === true) return RUNTIME_STATUS.INVALID;
    if (safety && safety.sourcePreflightStatus === 'PREFLIGHT_INVALID') return RUNTIME_STATUS.INVALID;

    if (safety && safety.credentialBlocked === true) return RUNTIME_STATUS.BLOCKED;
    if (safety && safety.envLikeBlocked === true) return RUNTIME_STATUS.BLOCKED;
    if (safety && safety.depthBlocked === true) return RUNTIME_STATUS.BLOCKED;
    if (safety && safety.functionInputBlocked === true) return RUNTIME_STATUS.BLOCKED;
    if (safety && safety.modeBlocked === true) return RUNTIME_STATUS.BLOCKED;
    if (safety && safety.canaryOnlyDisabled === true) return RUNTIME_STATUS.BLOCKED;
    if (safety && safety.liveSignalEnabled === true) return RUNTIME_STATUS.BLOCKED;
    if (safety && safety.preflightLiveExecutionAllowed === true) return RUNTIME_STATUS.BLOCKED;
    if (safety && safety.sourcePreflightStatus === 'PREFLIGHT_BLOCKED') return RUNTIME_STATUS.BLOCKED;
    if (safety && safety.validationFailed === true) return RUNTIME_STATUS.BLOCKED;
    if (cfg && cfg.runtimeMode !== RUNTIME_MODE.CANARY_PREP_ONLY) return RUNTIME_STATUS.BLOCKED;
    if (cfg && cfg.canaryOnly !== true) return RUNTIME_STATUS.BLOCKED;
    if (cfg && cfg.liveSignalEnabled === true) return RUNTIME_STATUS.BLOCKED;

    if (safety && (safety.sourcePreflightStatus === 'PREFLIGHT_READY' || safety.sourcePreflightStatus === 'PREFLIGHT_PARTIAL')
        && telegramReady === true) {
      return RUNTIME_STATUS.READY;
    }

    return RUNTIME_STATUS.UNKNOWN;
  }

  // §normalize ────────────────────────────────────────────────────────────

  function normalizeSecureRuntimeStateAdapter(result) {
    if (!isPlainObject(result)) return null;
    return result;
  }

  // §main entry ──────────────────────────────────────────────────────────

  function buildSecureRuntimeStateAdapter(input, config) {
    var inp = isPlainObject(input) ? input : {};
    var cfg = mergeSecureRuntimeStateAdapterConfig(config);
    var reasons = [];
    var warnings = [];

    // STEP 1 — INVALID
    var src = isPlainObject(inp.liveExecutionPreflightGate) ? inp.liveExecutionPreflightGate : null;
    var invalidPreflight = (src === null) || (src.valid !== true);
    var sourcePreflightStatus = (src && typeof src.preflightStatus === 'string') ? src.preflightStatus : null;
    var preflightMode = (src && typeof src.preflightMode === 'string') ? src.preflightMode : null;
    var preflightLiveExecutionAllowed = !!(src && src.liveExecutionAllowed === true);
    var telegramPreflight = (src && isPlainObject(src.telegramPreflight)) ? src.telegramPreflight : null;
    var telegramReady = !!(telegramPreflight && telegramPreflight.ready === true);

    // STEP 2 — credential / env-like / function input detection
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

    // STEP 3 — mode / canary boolean check
    var modeBlocked = (cfg.runtimeMode !== RUNTIME_MODE.CANARY_PREP_ONLY);
    var canaryOnlyDisabled = (cfg.canaryOnly !== true);
    var liveSignalEnabledHard = (cfg.liveSignalEnabled === true);

    // STEP 4 — build 6 runtime state objects (always full shape)
    var killSwitchRuntimeState = buildKillSwitchRuntimeState(telegramPreflight, cfg);
    var rollbackRuntimeState = buildRollbackRuntimeState(telegramPreflight, cfg);
    var disableRuntimeState = buildDisableRuntimeState(telegramPreflight, cfg);
    var telegramRuntimeEligibility = buildTelegramRuntimeEligibility(telegramPreflight, cfg);
    var canaryRuntimePolicy = buildCanaryRuntimePolicy(telegramPreflight, cfg);
    var safeDiagnostics = buildSafeDiagnostics(telegramPreflight, cfg);

    // STEP 5 — validate 6 runtime state objects
    var v1 = validateKillSwitchRuntimeState(killSwitchRuntimeState, cfg);
    var v2 = validateRollbackRuntimeState(rollbackRuntimeState, cfg);
    var v3 = validateDisableRuntimeState(disableRuntimeState, cfg);
    var v4 = validateTelegramRuntimeEligibility(telegramRuntimeEligibility, cfg);
    var v5 = validateCanaryRuntimePolicy(canaryRuntimePolicy, cfg);
    var v6 = validateSafeDiagnostics(safeDiagnostics, cfg);
    var validationFailed = (v1.valid !== true) || (v2.valid !== true) || (v3.valid !== true)
                        || (v4.valid !== true) || (v5.valid !== true) || (v6.valid !== true);
    if (v1.valid !== true) reasons.push(v1.reason);
    if (v2.valid !== true) reasons.push(v2.reason);
    if (v3.valid !== true) reasons.push(v3.reason);
    if (v4.valid !== true) reasons.push(v4.reason);
    if (v5.valid !== true) reasons.push(v5.reason);
    if (v6.valid !== true) reasons.push(v6.reason);

    // STEP 6 — high-level reasons (first-match-wins ordering)
    if (invalidPreflight) {
      reasons.push('LIVE_EXECUTION_PREFLIGHT_GATE_INVALID');
    } else if (credBlocked) {
      reasons.push('CREDENTIAL_FIELD_DETECTED');
    } else if (envLikeBlocked) {
      reasons.push('ENV_LIKE_OBJECT_DETECTED');
    } else if (depthBlocked) {
      reasons.push('OBJECT_TOO_DEEP_BLOCKED');
    } else if (functionInputBlocked) {
      reasons.push('FUNCTION_INPUT_DETECTED');
    } else if (modeBlocked) {
      reasons.push('NON_CANARY_PREP_ONLY_MODE_BLOCKED');
    } else if (canaryOnlyDisabled) {
      reasons.push('CANARY_ONLY_DISABLED');
    } else if (liveSignalEnabledHard) {
      reasons.push('LIVE_SIGNAL_ENABLED_BLOCKED');
    } else if (preflightLiveExecutionAllowed) {
      reasons.push('PREFLIGHT_LIVE_EXECUTION_ALLOWED_BLOCKED');
    } else if (sourcePreflightStatus === 'PREFLIGHT_BLOCKED' || sourcePreflightStatus === 'PREFLIGHT_INVALID') {
      reasons.push('SOURCE_PREFLIGHT_BLOCKED');
    } else if (preflightMode !== null && preflightMode !== 'PREFLIGHT_ONLY') {
      reasons.push('SOURCE_PREFLIGHT_MODE_NOT_PREFLIGHT_ONLY');
    }

    // STEP 7 — classify
    var safetyFlags = {
      invalidPreflight: invalidPreflight,
      sourcePreflightStatus: sourcePreflightStatus,
      credentialBlocked: credBlocked,
      envLikeBlocked: envLikeBlocked,
      depthBlocked: depthBlocked,
      functionInputBlocked: functionInputBlocked,
      modeBlocked: modeBlocked,
      canaryOnlyDisabled: canaryOnlyDisabled,
      liveSignalEnabled: liveSignalEnabledHard,
      preflightLiveExecutionAllowed: preflightLiveExecutionAllowed,
      validationFailed: validationFailed
    };
    var runtimeStatus = classifyRuntimeStatus(safetyFlags, cfg, telegramReady);
    if (runtimeStatus === RUNTIME_STATUS.READY) reasons.push('RUNTIME_READY');
    if (runtimeStatus === RUNTIME_STATUS.UNKNOWN) reasons.push('RUNTIME_UNKNOWN_FALLBACK');

    // STEP 8 — runtimePolicy 박제
    var runtimePolicy = buildRuntimePolicy();

    // STEP 9 — configUsed scalar snapshot
    var configUsed = {
      version: cfg.version,
      runtimeMode: cfg.runtimeMode,
      canaryOnly: cfg.canaryOnly,
      liveSignalEnabled: cfg.liveSignalEnabled,
      targets: {
        telegram: { enabled: cfg.targets.telegram.enabled }
      },
      safety: {
        blockCredentialFields: cfg.safety.blockCredentialFields,
        credentialMaxDepth: cfg.safety.credentialMaxDepth,
        credentialAllowListSize: cfg.safety.credentialAllowList.length,
        blockEnvLikeObjects: cfg.safety.blockEnvLikeObjects,
        blockObjectTooDeep: cfg.safety.blockObjectTooDeep,
        blockFunctionInputs: cfg.safety.blockFunctionInputs
      }
    };

    var draft = {
      valid: invalidPreflight ? false : true,
      version: RUNTIME_VERSION,
      runtimeMode: cfg.runtimeMode === RUNTIME_MODE.CANARY_PREP_ONLY ? 'CANARY_PREP_ONLY' : cfg.runtimeMode,
      canaryOnly: cfg.canaryOnly === true,
      liveSignalEnabled: cfg.liveSignalEnabled === true,
      runtimeStatus: runtimeStatus,
      sourcePreflightStatus: sourcePreflightStatus,
      runtimePolicy: runtimePolicy,
      killSwitchRuntimeState: killSwitchRuntimeState,
      rollbackRuntimeState: rollbackRuntimeState,
      disableRuntimeState: disableRuntimeState,
      telegramRuntimeEligibility: telegramRuntimeEligibility,
      canaryRuntimePolicy: canaryRuntimePolicy,
      safeDiagnostics: safeDiagnostics,
      reasons: reasons,
      warnings: warnings,
      debug: {
        source: 'liveExecutionPreflightGate + secureBindingGatewayContract + transportExecutorSandboxRunner + transportExecutorInterfaceAdapter + transportExecutorHarness + secureTransportExecutorContract + transportExecutionEnvelope + transportPlan + rendererBinding + operationPacket + activeCycleDecision + evaluationOutcome + externalConfluence',
        configVersion: cfg.version,
        invalidPreflight: invalidPreflight,
        credentialBlocked: credBlocked,
        envLikeBlocked: envLikeBlocked,
        depthBlocked: depthBlocked,
        functionInputBlocked: functionInputBlocked,
        modeBlocked: modeBlocked,
        canaryOnlyDisabled: canaryOnlyDisabled,
        liveSignalEnabledHard: liveSignalEnabledHard,
        preflightLiveExecutionAllowed: preflightLiveExecutionAllowed,
        validationFailed: validationFailed,
        credentialDetections: credResult.detections.length,
        envLikeDetections: envResult.detections.length,
        objectTooDeepDetections: envResult.depthBlocks.length,
        functionInputDetections: fnResult.detections.length
      },
      configUsed: configUsed
    };
    return normalizeSecureRuntimeStateAdapter(draft) || draft;
  }

  // §export ──────────────────────────────────────────────────────────────

  var api = Object.freeze({
    VERSION: RUNTIME_VERSION,
    DEFAULT_SECURE_RUNTIME_STATE_ADAPTER_CONFIG: DEFAULT_SECURE_RUNTIME_STATE_ADAPTER_CONFIG,
    RUNTIME_MODE: RUNTIME_MODE,
    RUNTIME_STATUS: RUNTIME_STATUS,
    TARGET: TARGET,
    build: buildSecureRuntimeStateAdapter,
    mergeSecureRuntimeStateAdapterConfig: mergeSecureRuntimeStateAdapterConfig,
    buildKillSwitchRuntimeState: buildKillSwitchRuntimeState,
    buildRollbackRuntimeState: buildRollbackRuntimeState,
    buildDisableRuntimeState: buildDisableRuntimeState,
    buildTelegramRuntimeEligibility: buildTelegramRuntimeEligibility,
    buildCanaryRuntimePolicy: buildCanaryRuntimePolicy,
    buildSafeDiagnostics: buildSafeDiagnostics,
    validateKillSwitchRuntimeState: validateKillSwitchRuntimeState,
    validateRollbackRuntimeState: validateRollbackRuntimeState,
    validateDisableRuntimeState: validateDisableRuntimeState,
    validateTelegramRuntimeEligibility: validateTelegramRuntimeEligibility,
    validateCanaryRuntimePolicy: validateCanaryRuntimePolicy,
    validateSafeDiagnostics: validateSafeDiagnostics,
    detectCredentialFields: detectCredentialFields,
    detectEnvLikeObjects: detectEnvLikeObjects,
    detectFunctionInputs: detectFunctionInputs,
    classifyRuntimeStatus: classifyRuntimeStatus
  });

  global.WS3_SecureRuntimeStateAdapter = api;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
