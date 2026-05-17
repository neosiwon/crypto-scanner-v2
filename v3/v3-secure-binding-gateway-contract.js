/**
 * WS3 v0.18.0 — SecureBindingGatewayContract (Secure Binding Gateway Contract)
 *
 * Scope:
 *   transportExecutorSandboxRunner (v0.17.0) + transportExecutorInterfaceAdapter (v0.16.0) +
 *   transportExecutorHarness (v0.15.0) + secureTransportExecutorContract (v0.14.0) +
 *   transportExecutionEnvelope (v0.13.0) + transportPlan (v0.12.0) + rendererBinding (v0.12.0) +
 *   operationPacket (v0.8.0) + activeCycleDecision (v0.9.0) + evaluationOutcome (v0.10.0) +
 *   externalConfluence (v0.11.0)
 *   → standalone SecureBindingGatewayContract (CONTRACT_ONLY, secure binding boundary)
 *
 * 단일 기준 문서:
 *   docs/ws3/WS3_CODE_CONTRACT.md (b-r2 박제본)
 *
 * 확정 DP 정책 (Gate 2 spec):
 *   DP-GATEWAY1   secure binding gateway contract only.
 *                 실제 credential lookup / env 접근 / binding resolver 호출 X.
 *   DP-GATEWAY2   transportExecutorSandboxRunner ready/status/preview/sandboxResult
 *                 결정을 true 로 override 금지.
 *   DP-GATEWAY3   gatewayMode CONTRACT_ONLY only. LIVE / REAL / EXECUTE → GATEWAY_BLOCKED.
 *   DP-GATEWAY4   11 boolean hard block (liveExecution / lookup / sideEffect / fetch / write /
 *                 credentialLookup / bindingLookup / driverCall / retry / timer / envAccess)
 *                 중 하나라도 true → GATEWAY_BLOCKED.
 *   DP-GATEWAY5   credential value / masked credential / token preview / chatId preview /
 *                 webhook preview / first-4 / last-4 / redacted credential preview 전부 output 금지.
 *   DP-GATEWAY6   process.env / env 객체 / Cloudflare binding / KV namespace / DB connection
 *                 읽기 0건. env-like object → 즉시 GATEWAY_BLOCKED.
 *   DP-GATEWAY7   bindingRef / credentialHandleRef / bindingScope / resolverRef logical only.
 *                 URL / function / credential-like string / raw secret path 금지.
 *                 CREDENTIAL_HANDLE / CREDENTIAL_HANDLE_REF / SCOPE framework term 만 우회 허용.
 *   DP-GATEWAY8   sandboxResult 전체 복사 금지. sandboxResultRef 는 target/action/resultType/
 *                 simulated/status 5 safe scalar 만. ok / errorType / reasonCode 제외.
 *   DP-GATEWAY9   11종 입력 read-only.
 *   DP-GATEWAY10  신규 파일 1개 + 문서 갱신만. 보호 파일 30종 수정 금지.
 *
 * N-GATEWAY-OBS 처리:
 *   N-GATEWAY-OBS-1  신규 식별자 fresh — Gateway / GATEWAY_xxx / buildXxxGateway / credentialHandleRef
 *                    /bindingScope/lookupPlan/bindingPolicy/sandboxResultRef 모두 0건 충돌.
 *   N-GATEWAY-OBS-2  v0.17 sandbox runner shape 정합. ready/status/preview/sandboxResult override 0건.
 *   N-GATEWAY-OBS-3  credentialHandleRef / SECURE_CREDENTIAL_HANDLE_REF / logicalRefAllowList /
 *                    CONTRACT_ONLY 는 v0.14~v0.17 expected reuse. 5종 contract field
 *                    (bindingScope/lookupPlan/bindingPolicy/sandboxResultRef/credentialHandleRef) 박제.
 *   N-GATEWAY-OBS-4  framework logical term 우회 알고리즘 (r0.2 §6.1):
 *                    1) allowList exact match 우선
 *                    2) CREDENTIAL_HANDLE / CREDENTIAL_HANDLE_REF 연속 substring 우회
 *                    3) HANDLE 단독은 secret/token/password override 불가
 *                    4) SCOPE 는 credential 우회 용어 아님 (bindingScope 형식 허용용)
 *   N-GATEWAY-OBS-5  11 boolean hard block — v0.17 9 + lookupAllowed + envAccessAllowed.
 *   N-GATEWAY-OBS-6  masked credential preview 금지 — masked/redacted/first-4/last-4/
 *                    credential preview 전면 0건.
 *   N-GATEWAY-OBS-7  sandboxResultRef safe summary 5 fields (target/action/resultType/simulated/
 *                    status). ok/errorType/reasonCode 제외 (raw error 누출 / LIVE source 오해 위험).
 *   N-GATEWAY-OBS-8  보호 파일 30종 — v0.17 commit 이후 v3-transport-executor-sandbox-runner.js
 *                    추가. 본 단계 30종 무손상.
 *
 * 출력 (top-level):
 *   valid, version, gatewayMode='CONTRACT_ONLY', liveExecutionAllowed=false, lookupAllowed=false,
 *   gatewayStatus, sourceSandboxStatus, gatewayPolicy,
 *   telegramGateway, snapshotGateway, evaluationGateway, auditGateway,
 *   gatewaySummary, reasons[], warnings[], debug, configUsed
 *
 * gatewayStatus 6 후보 (first-match-wins):
 *   GATEWAY_INVALID  → transportExecutorSandboxRunner missing 또는 valid !== true
 *   GATEWAY_BLOCKED  → source SANDBOX_BLOCKED/INVALID, credential 감지, env-like 감지,
 *                      function input 감지, gatewayMode!==CONTRACT_ONLY,
 *                      11 boolean hard block, invalid bindingRef/credentialHandleRef/
 *                      bindingScope/lookupPlan/bindingPolicy/sandboxResultRef/rateLimitContract/
 *                      circuitBreakerContract
 *   GATEWAY_PARTIAL  → ≥1 ready true + ≥1 blocker
 *   GATEWAY_READY    → source SANDBOX_READY/PARTIAL + ≥1 ready true + blocker 0
 *   GATEWAY_SKIPPED  → source SANDBOX_SKIPPED 또는 모든 ready false + blocker 0
 *   GATEWAY_UNKNOWN  → fallback
 *
 * 의도된 미구현 (이번 단계 제외):
 *   실제 credential lookup / process.env / Cloudflare env / globalThis.env / KV namespace /
 *   DB connection / Telegram bot token / chatId / webhookUrl / secret binding value 읽기.
 *   실제 fetch / Telegram 발송 / KV write / DB write / binding resolver function 호출.
 *   실제 driver call / retry / timer.
 *   credential value 저장 / logging / preview / masked preview.
 *   async function / await / Promise / setTimeout / setInterval (sync only).
 *
 * 함수 목록:
 *   mergeSecureBindingGatewayContractConfig(config)
 *   buildSecureBindingGatewayContract(input, config)        ← 진입점
 *   buildTelegramGateway / buildSnapshotGateway / buildEvaluationGateway / buildAuditGateway
 *   buildCredentialHandleRef(target, cfg)
 *   buildBindingScope(target, cfg)
 *   buildLookupPlan(cfg)
 *   buildBindingPolicy(cfg)
 *   buildSandboxResultRef(sandboxTarget, target, cfg)
 *   buildRateLimitContractFromSandbox(sandboxTarget, target, cfg)
 *   buildCircuitBreakerContractFromSandbox(sandboxTarget, target, cfg)
 *   buildGatewaySummary(gateways, cfg)
 *   classifyGatewayStatus(gateways, safety, cfg)
 *   detectCredentialFields / detectEnvLikeObjects / detectFunctionInputs
 *   validateLogicalRef(ref, cfg)
 *   validateLookupPlan(plan, cfg)
 *   validateBindingPolicy(policy, cfg)
 *   validateSandboxResultRef(ref, target, cfg)
 *   sanitizeMessageLines(lines, cfg)                        ← inherited policy
 *   normalizeGatewayTarget / normalizeSecureBindingGatewayContract
 *   isPlainObject, safeString, safeNumber, pushReason, pushWarning
 *
 * export:
 *   global.WS3_SecureBindingGatewayContract + module.exports
 */
(function(global) {
  'use strict';

  // §version
  var GATEWAY_VERSION = 'WS3_v0.18.0_secure_binding_gateway_contract';

  // §gatewayMode (only CONTRACT_ONLY allowed)
  var GATEWAY_MODE = Object.freeze({
    CONTRACT_ONLY: 'CONTRACT_ONLY'
  });

  // §gatewayStatus 6 후보
  var GATEWAY_STATUS = Object.freeze({
    READY: 'GATEWAY_READY',
    SKIPPED: 'GATEWAY_SKIPPED',
    BLOCKED: 'GATEWAY_BLOCKED',
    PARTIAL: 'GATEWAY_PARTIAL',
    INVALID: 'GATEWAY_INVALID',
    UNKNOWN: 'GATEWAY_UNKNOWN'
  });

  // §target enum
  var TARGET = Object.freeze({
    TELEGRAM: 'TELEGRAM',
    SNAPSHOT_STORE: 'SNAPSHOT_STORE',
    EVALUATION_STORE: 'EVALUATION_STORE',
    AUDIT_STORE: 'AUDIT_STORE'
  });

  // §action enum
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

  // §framework logical refs (per target)
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

  // §sandboxResultRef SIMULATED_STATUS enum (v0.17 inherited)
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

  // §framework multi-word logical term — credential keyword 우회 자격 (N-GATEWAY-OBS-4)
  //   CREDENTIAL_HANDLE / CREDENTIAL_HANDLE_REF 가 ref 안에 연속 substring 으로 존재할 때만 우회.
  //   HANDLE 단독 / CREDENTIAL 단독 / SCOPE 단독은 우회 자격 없음.
  var FRAMEWORK_BYPASS_TERMS = Object.freeze([
    'CREDENTIAL_HANDLE',
    'CREDENTIAL_HANDLE_REF'
  ]);

  // §RESERVED framework metadata 키 (v0.13~v0.18 모듈 자체 metadata 식별자)
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
    'credentialHandleRef',
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
    // sandbox policy metadata (v0.17)
    'sandboxFixtureCredentialPatternBlocked',
    'sandboxFixturePatternBlocked',
    'sandboxFixtureFunctionPatternBlocked'
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

  // §masked / preview 금지 substring (DP-GATEWAY5)
  //   credential value 의 masked / first-4 / last-4 / redacted preview 차단 - 어휘 검사용
  //   (RESERVED metadata key 'directSecretAccessAllowed' 등은 isCredentialKey 의 다른 path 로 제외됨)
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

  // §forbidden wording (DP-GATEWAY8 + N-GATEWAY-OBS — lookup/credential loaded 추가)
  //   v0.17 15 + lookup/credential 5 = 20 forbidden phrases.
  var FORBIDDEN_WORDS = Object.freeze([
    // v0.17 inherited 15
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
    // v0.18 신규 5 (lookup / credential loaded 어휘)
    'lookup 완료',
    'resolved credential',
    'credential loaded',
    'secret loaded',
    'token loaded'
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
    return 'redacted';
  }

  // §DEFAULT_CONFIG
  var DEFAULT_SECURE_BINDING_GATEWAY_CONTRACT_CONFIG = Object.freeze({
    version: 'inline-default-v0',
    gatewayMode: 'CONTRACT_ONLY',
    liveExecutionAllowed: false,
    lookupAllowed: false,
    sideEffectAllowed: false,
    fetchAllowed: false,
    writeAllowed: false,
    credentialLookupAllowed: false,
    bindingLookupAllowed: false,
    driverCallAllowed: false,
    retryAllowed: false,
    timerAllowed: false,
    envAccessAllowed: false,
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
      // 기본 logicalRefAllowList — 10 framework ref (N-GATEWAY-OBS-3)
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
        'FUTURE_SECURE_BINDING_RESOLVER'
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
      allowMaskedCredentialPreview: false
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
  function mergeSecureBindingGatewayContractConfig(config) {
    var c = isPlainObject(config) ? config : {};
    var d = DEFAULT_SECURE_BINDING_GATEWAY_CONTRACT_CONFIG;

    var tg = isPlainObject(c.targets) ? c.targets : {};
    var sf = isPlainObject(c.safety) ? c.safety : {};
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
    var debugAllowed = copyStringArray(db.allowedFields, d.debug.allowedFields);

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
      gatewayMode: (typeof c.gatewayMode === 'string' && c.gatewayMode.length > 0) ? c.gatewayMode : d.gatewayMode,
      liveExecutionAllowed: c.liveExecutionAllowed === true,
      lookupAllowed: c.lookupAllowed === true,
      sideEffectAllowed: c.sideEffectAllowed === true,
      fetchAllowed: c.fetchAllowed === true,
      writeAllowed: c.writeAllowed === true,
      credentialLookupAllowed: c.credentialLookupAllowed === true,
      bindingLookupAllowed: c.bindingLookupAllowed === true,
      driverCallAllowed: c.driverCallAllowed === true,
      retryAllowed: c.retryAllowed === true,
      timerAllowed: c.timerAllowed === true,
      envAccessAllowed: c.envAccessAllowed === true,
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
        blockMaskedPreview: sf.blockMaskedPreview !== false,
        allowRawPayload: sf.allowRawPayload === true,
        allowEnvRead: sf.allowEnvRead === true,
        allowDirectSecretAccess: sf.allowDirectSecretAccess === true,
        allowFunctionInput: sf.allowFunctionInput === true,
        allowAsync: sf.allowAsync === true,
        allowMaskedCredentialPreview: sf.allowMaskedCredentialPreview === true
      },
      wording: { sanitizeMode: sanitizeMode },
      debug: { enabled: db.enabled === true, allowedFields: debugAllowed }
    };
  }

  // §credential / env / function detection ───────────────────────────────

  function isCredentialKey(keyName, allowList) {
    if (typeof keyName !== 'string' || keyName.length === 0) return false;
    // RESERVED framework metadata 식별자 자동 차단 제외
    var r;
    for (r = 0; r < RESERVED_FRAMEWORK_METADATA_KEYS.length; r++) {
      if (RESERVED_FRAMEWORK_METADATA_KEYS[r] === keyName) return false;
    }
    // user-provided allowList exact match
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
    var cfg = mergeSecureBindingGatewayContractConfig(config);
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
    var cfg = mergeSecureBindingGatewayContractConfig(config);
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
    var cfg = mergeSecureBindingGatewayContractConfig(config);
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

  // §validateLogicalRef (DP-GATEWAY7 / N-GATEWAY-OBS-4)
  //   framework logical term 우회 알고리즘:
  //   1. allowList exact match → 통과
  //   2. CREDENTIAL_HANDLE / CREDENTIAL_HANDLE_REF 연속 substring → credential keyword 우회
  //   3. 그 외에는 credential keyword partial match 차단

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

    // 1. allowList exact match (우선)
    if (Array.isArray(allowList)) {
      var a;
      for (a = 0; a < allowList.length; a++) {
        if (allowList[a] === ref) return { valid: true, reason: null };
      }
    }

    if (typeof ref !== 'string') return { valid: false, reason: 'LOGICAL_REF_INVALID_FORMAT' };
    if (ref.length < 3 || ref.length > 64) return { valid: false, reason: 'LOGICAL_REF_INVALID_FORMAT' };
    if (!LOGICAL_REF_PATTERN.test(ref)) return { valid: false, reason: 'LOGICAL_REF_INVALID_FORMAT' };

    // 금지 substring (URL / token-like)
    var i;
    for (i = 0; i < LOGICAL_REF_FORBIDDEN_SUBSTRINGS.length; i++) {
      if (ref.indexOf(LOGICAL_REF_FORBIDDEN_SUBSTRINGS[i]) !== -1) {
        return { valid: false, reason: 'LOGICAL_REF_INVALID_FORMAT' };
      }
    }
    if (/bot[0-9]+/i.test(ref)) return { valid: false, reason: 'LOGICAL_REF_INVALID_FORMAT' };
    if (/^[0-9]+$/.test(ref)) return { valid: false, reason: 'LOGICAL_REF_INVALID_FORMAT' };

    // function-body / code pattern (token-level)
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

    // 2. framework bypass term 연속 substring 우회 (N-GATEWAY-OBS-4)
    if (containsFrameworkBypassTerm(ref)) {
      return { valid: true, reason: null };
    }

    // 3. credential keyword partial match — 차단
    var credAllow = (cfg && cfg.safety && Array.isArray(cfg.safety.credentialAllowList))
      ? cfg.safety.credentialAllowList
      : [];
    if (isCredentialKey(ref, credAllow)) {
      return { valid: false, reason: 'LOGICAL_REF_CONTAINS_CREDENTIAL_PATTERN' };
    }

    return { valid: true, reason: null };
  }

  // §validateLookupPlan (DP-GATEWAY7)

  function validateLookupPlan(plan /*, cfg */) {
    if (!isPlainObject(plan)) return { valid: false, reason: 'INVALID_LOOKUP_PLAN:NOT_PLAIN_OBJECT' };
    var keys = Object.keys(plan);
    var allowed = ['lookupMode', 'lookupAllowed', 'resolverRef', 'resolved'];
    var i;
    for (i = 0; i < keys.length; i++) {
      var k = keys[i];
      var ok = false;
      var ai;
      for (ai = 0; ai < allowed.length; ai++) {
        if (allowed[ai] === k) { ok = true; break; }
      }
      if (!ok) return { valid: false, reason: 'INVALID_LOOKUP_PLAN:EXTRA_KEY:' + k };
    }
    if (plan.lookupMode !== 'FUTURE_RUNTIME_LOOKUP') return { valid: false, reason: 'INVALID_LOOKUP_PLAN:INVALID_MODE' };
    if (plan.lookupAllowed !== false) return { valid: false, reason: 'INVALID_LOOKUP_PLAN:LOOKUP_ALLOWED_TRUE' };
    if (plan.resolved !== false) return { valid: false, reason: 'INVALID_LOOKUP_PLAN:RESOLVED_TRUE' };
    if (typeof plan.resolverRef !== 'string') return { valid: false, reason: 'INVALID_LOOKUP_PLAN:INVALID_RESOLVER_REF' };
    return { valid: true, reason: null };
  }

  // §validateBindingPolicy (DP-GATEWAY5)

  function validateBindingPolicy(policy /*, cfg */) {
    if (!isPlainObject(policy)) return { valid: false, reason: 'INVALID_BINDING_POLICY:NOT_PLAIN_OBJECT' };
    var keys = Object.keys(policy);
    var allowed = ['required', 'valueExposed', 'valueMasked', 'valueLogged', 'valueStored', 'valuePreviewAllowed'];
    var i;
    for (i = 0; i < keys.length; i++) {
      var k = keys[i];
      var ok = false;
      var ai;
      for (ai = 0; ai < allowed.length; ai++) {
        if (allowed[ai] === k) { ok = true; break; }
      }
      if (!ok) return { valid: false, reason: 'INVALID_BINDING_POLICY:EXTRA_KEY:' + k };
    }
    if (typeof policy.required !== 'boolean') return { valid: false, reason: 'INVALID_BINDING_POLICY:INVALID_REQUIRED' };
    if (policy.valueExposed !== false) return { valid: false, reason: 'INVALID_BINDING_POLICY:VALUE_EXPOSED_TRUE' };
    if (policy.valueMasked !== false) return { valid: false, reason: 'INVALID_BINDING_POLICY:VALUE_MASKED_TRUE' };
    if (policy.valueLogged !== false) return { valid: false, reason: 'INVALID_BINDING_POLICY:VALUE_LOGGED_TRUE' };
    if (policy.valueStored !== false) return { valid: false, reason: 'INVALID_BINDING_POLICY:VALUE_STORED_TRUE' };
    if (policy.valuePreviewAllowed !== false) return { valid: false, reason: 'INVALID_BINDING_POLICY:VALUE_PREVIEW_ALLOWED_TRUE' };
    return { valid: true, reason: null };
  }

  // §validateSandboxResultRef (DP-GATEWAY8 / N-GATEWAY-OBS-7)

  function validateSandboxResultRef(ref, targetType /*, cfg */) {
    if (!isPlainObject(ref)) return { valid: false, reason: 'INVALID_SANDBOX_RESULT_REF:NOT_PLAIN_OBJECT' };
    var keys = Object.keys(ref);
    var allowed = ['target', 'action', 'resultType', 'simulated', 'status'];
    // forbidden keys explicitly listed
    var forbidden = ['ok', 'errorType', 'reasonCode', 'rawResponse', 'rawError', 'stack', 'body', 'headers', 'responseBody'];
    var i;
    for (i = 0; i < keys.length; i++) {
      var k = keys[i];
      var fb;
      for (fb = 0; fb < forbidden.length; fb++) {
        if (forbidden[fb] === k) return { valid: false, reason: 'INVALID_SANDBOX_RESULT_REF:FORBIDDEN_KEY:' + k };
      }
      var ok = false;
      var ai;
      for (ai = 0; ai < allowed.length; ai++) {
        if (allowed[ai] === k) { ok = true; break; }
      }
      if (!ok) return { valid: false, reason: 'INVALID_SANDBOX_RESULT_REF:EXTRA_KEY:' + k };
    }
    // target enum + target match
    if (ref.target !== TARGET.TELEGRAM
        && ref.target !== TARGET.SNAPSHOT_STORE
        && ref.target !== TARGET.EVALUATION_STORE
        && ref.target !== TARGET.AUDIT_STORE) {
      return { valid: false, reason: 'INVALID_SANDBOX_RESULT_REF:INVALID_TARGET' };
    }
    if (ref.target !== targetType) return { valid: false, reason: 'INVALID_SANDBOX_RESULT_REF:TARGET_MISMATCH' };
    var expectedAction = getActionForTarget(targetType);
    if (ref.action !== expectedAction) return { valid: false, reason: 'INVALID_SANDBOX_RESULT_REF:ACTION_TARGET_MISMATCH' };
    if (ref.resultType !== 'SANDBOX_ONLY') return { valid: false, reason: 'INVALID_SANDBOX_RESULT_REF:INVALID_RESULT_TYPE' };
    if (ref.simulated !== true) return { valid: false, reason: 'INVALID_SANDBOX_RESULT_REF:SIMULATED_NOT_TRUE' };
    if (!isValidSimulatedStatus(ref.status)) return { valid: false, reason: 'INVALID_SANDBOX_RESULT_REF:INVALID_STATUS' };
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
    var maxLen = 200;

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

  // §rate limit / circuit breaker pass-through revalidation

  function buildRateLimitContractFromSandbox(sandboxTarget, targetType /*, cfg */) {
    var src = (sandboxTarget && isPlainObject(sandboxTarget.rateLimitContract))
      ? sandboxTarget.rateLimitContract : null;
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

  function buildCircuitBreakerContractFromSandbox(sandboxTarget /*, targetType, cfg */) {
    var src = (sandboxTarget && isPlainObject(sandboxTarget.circuitBreakerContract))
      ? sandboxTarget.circuitBreakerContract : null;
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

  // §contract builders (per-target)

  function buildCredentialHandleRef(target /*, cfg */) {
    return getCredentialHandleRefForTarget(target);
  }

  function buildBindingScope(target /*, cfg */) {
    return getBindingScopeForTarget(target);
  }

  function buildLookupPlan(/* cfg */) {
    return {
      lookupMode: 'FUTURE_RUNTIME_LOOKUP',
      lookupAllowed: false,
      resolverRef: 'FUTURE_SECURE_BINDING_RESOLVER',
      resolved: false
    };
  }

  function buildBindingPolicy(/* cfg */) {
    return {
      required: true,
      valueExposed: false,
      valueMasked: false,
      valueLogged: false,
      valueStored: false,
      valuePreviewAllowed: false
    };
  }

  function buildSandboxResultRef(sandboxTarget, targetType /*, cfg */) {
    // safe summary 5 fields only
    var sandboxResult = (sandboxTarget && isPlainObject(sandboxTarget.sandboxResult))
      ? sandboxTarget.sandboxResult : null;
    if (sandboxResult === null) {
      // default skipped ref
      return {
        target: targetType,
        action: getActionForTarget(targetType),
        resultType: 'SANDBOX_ONLY',
        simulated: true,
        status: SIMULATED_STATUS.SKIPPED
      };
    }
    return {
      target: sandboxResult.target,
      action: sandboxResult.action,
      resultType: sandboxResult.resultType,
      simulated: sandboxResult.simulated,
      status: sandboxResult.status
    };
  }

  // §gateway target builder

  function isReadySandbox(sandbox) {
    return isPlainObject(sandbox) && sandbox.ready === true;
  }

  function buildGatewayForTarget(targetType, sandboxTarget, cfg) {
    var blockedReasons = [];
    var warnings = [];
    var sourceReady = isReadySandbox(sandboxTarget);

    var targetEnabled;
    if (targetType === TARGET.TELEGRAM) targetEnabled = cfg.targets.telegram.enabled === true;
    else if (targetType === TARGET.SNAPSHOT_STORE) targetEnabled = cfg.targets.snapshot.enabled === true;
    else if (targetType === TARGET.EVALUATION_STORE) targetEnabled = cfg.targets.evaluation.enabled === true;
    else if (targetType === TARGET.AUDIT_STORE) targetEnabled = cfg.targets.audit.enabled === true;
    else targetEnabled = false;

    var modeOk = cfg.gatewayMode === GATEWAY_MODE.CONTRACT_ONLY;
    var liveNotAllowed = cfg.liveExecutionAllowed !== true;
    var lookupNotAllowed = cfg.lookupAllowed !== true;
    var sideNotAllowed = cfg.sideEffectAllowed !== true;
    var fetchNotAllowed = cfg.fetchAllowed !== true;
    var writeNotAllowed = cfg.writeAllowed !== true;
    var credLookupNotAllowed = cfg.credentialLookupAllowed !== true;
    var bindingLookupNotAllowed = cfg.bindingLookupAllowed !== true;
    var driverCallNotAllowed = cfg.driverCallAllowed !== true;
    var retryNotAllowed = cfg.retryAllowed !== true;
    var timerNotAllowed = cfg.timerAllowed !== true;
    var envAccessNotAllowed = cfg.envAccessAllowed !== true;

    if (!sourceReady) blockedReasons.push('SOURCE_SANDBOX_NOT_READY');
    if (!targetEnabled) blockedReasons.push('CONFIG_DISALLOW_TARGET:' + targetType);
    if (!modeOk) blockedReasons.push('NON_CONTRACT_ONLY_MODE_BLOCKED');
    if (!liveNotAllowed) blockedReasons.push('LIVE_EXECUTION_ALLOWED_BLOCKED');
    if (!lookupNotAllowed) blockedReasons.push('LOOKUP_ALLOWED_BLOCKED');
    if (!sideNotAllowed) blockedReasons.push('SIDE_EFFECT_ALLOWED_BLOCKED');
    if (!fetchNotAllowed) blockedReasons.push('FETCH_ALLOWED_BLOCKED');
    if (!writeNotAllowed) blockedReasons.push('WRITE_ALLOWED_BLOCKED');
    if (!credLookupNotAllowed) blockedReasons.push('CREDENTIAL_LOOKUP_ALLOWED_BLOCKED');
    if (!bindingLookupNotAllowed) blockedReasons.push('BINDING_LOOKUP_ALLOWED_BLOCKED');
    if (!driverCallNotAllowed) blockedReasons.push('DRIVER_CALL_ALLOWED_BLOCKED');
    if (!retryNotAllowed) blockedReasons.push('RETRY_ALLOWED_BLOCKED');
    if (!timerNotAllowed) blockedReasons.push('TIMER_ALLOWED_BLOCKED');
    if (!envAccessNotAllowed) blockedReasons.push('ENV_ACCESS_ALLOWED_BLOCKED');

    var bindingRef = (sandboxTarget && typeof sandboxTarget.bindingRef === 'string')
      ? sandboxTarget.bindingRef : null;
    var credentialHandleRef = buildCredentialHandleRef(targetType, cfg);
    var bindingScope = buildBindingScope(targetType, cfg);
    var lookupPlan = buildLookupPlan(cfg);
    var bindingPolicy = buildBindingPolicy(cfg);
    var sandboxResultRef = buildSandboxResultRef(sandboxTarget, targetType, cfg);

    // logical ref validations
    var refsToCheck = [
      { name: 'bindingRef', val: bindingRef },
      { name: 'credentialHandleRef', val: credentialHandleRef },
      { name: 'bindingScope', val: bindingScope },
      { name: 'resolverRef', val: lookupPlan.resolverRef }
    ];
    var rc;
    var refOk = true;
    for (rc = 0; rc < refsToCheck.length; rc++) {
      var item = refsToCheck[rc];
      if (item.val === null) {
        refOk = false;
        blockedReasons.push('LOGICAL_REF_INVALID_FORMAT:' + item.name + ':' + targetType);
        continue;
      }
      var vr = validateLogicalRef(item.val, cfg);
      if (vr.valid !== true) {
        refOk = false;
        blockedReasons.push((vr.reason || 'LOGICAL_REF_INVALID') + ':' + item.name + ':' + targetType);
      }
    }

    var lookupValidation = validateLookupPlan(lookupPlan, cfg);
    if (lookupValidation.valid !== true) blockedReasons.push(lookupValidation.reason + ':' + targetType);
    var policyValidation = validateBindingPolicy(bindingPolicy, cfg);
    if (policyValidation.valid !== true) blockedReasons.push(policyValidation.reason + ':' + targetType);
    var refValidation = validateSandboxResultRef(sandboxResultRef, targetType, cfg);
    if (refValidation.valid !== true) blockedReasons.push(refValidation.reason + ':' + targetType);

    var rlResult = buildRateLimitContractFromSandbox(sandboxTarget, targetType, cfg);
    if (rlResult.valid !== true) blockedReasons.push('INVALID_RATE_LIMIT_CONTRACT:' + targetType);
    var cbResult = buildCircuitBreakerContractFromSandbox(sandboxTarget, targetType, cfg);
    if (cbResult.valid !== true) blockedReasons.push('INVALID_CIRCUIT_BREAKER_CONTRACT:' + targetType);

    var ready = sourceReady && targetEnabled && modeOk && liveNotAllowed
                && lookupNotAllowed && sideNotAllowed && fetchNotAllowed && writeNotAllowed
                && credLookupNotAllowed && bindingLookupNotAllowed && driverCallNotAllowed
                && retryNotAllowed && timerNotAllowed && envAccessNotAllowed
                && refOk && lookupValidation.valid && policyValidation.valid && refValidation.valid
                && rlResult.valid && cbResult.valid;

    return {
      ready: ready,
      target: targetType,
      contractOnly: true,
      lookupAllowed: false,
      sideEffectAllowed: false,
      bindingRef: bindingRef,
      credentialHandleRef: credentialHandleRef,
      bindingScope: bindingScope,
      lookupPlan: lookupPlan,
      bindingPolicy: bindingPolicy,
      sandboxResultRef: refValidation.valid ? sandboxResultRef : null,
      perTargetGate: { allow: false, reason: 'CONTRACT_ONLY' },
      rateLimitContract: rlResult.valid ? rlResult.contract : null,
      circuitBreakerContract: cbResult.valid ? cbResult.contract : null,
      blockedReasons: blockedReasons,
      warnings: warnings
    };
  }

  function buildTelegramGateway(input, cfg) {
    var src = isPlainObject(input.transportExecutorSandboxRunner) ? input.transportExecutorSandboxRunner : null;
    var sandbox = (src && isPlainObject(src.telegramSandbox)) ? src.telegramSandbox : null;
    return buildGatewayForTarget(TARGET.TELEGRAM, sandbox, cfg);
  }
  function buildSnapshotGateway(input, cfg) {
    var src = isPlainObject(input.transportExecutorSandboxRunner) ? input.transportExecutorSandboxRunner : null;
    var sandbox = (src && isPlainObject(src.snapshotSandbox)) ? src.snapshotSandbox : null;
    return buildGatewayForTarget(TARGET.SNAPSHOT_STORE, sandbox, cfg);
  }
  function buildEvaluationGateway(input, cfg) {
    var src = isPlainObject(input.transportExecutorSandboxRunner) ? input.transportExecutorSandboxRunner : null;
    var sandbox = (src && isPlainObject(src.evaluationSandbox)) ? src.evaluationSandbox : null;
    return buildGatewayForTarget(TARGET.EVALUATION_STORE, sandbox, cfg);
  }
  function buildAuditGateway(input, cfg) {
    var src = isPlainObject(input.transportExecutorSandboxRunner) ? input.transportExecutorSandboxRunner : null;
    var sandbox = (src && isPlainObject(src.auditSandbox)) ? src.auditSandbox : null;
    return buildGatewayForTarget(TARGET.AUDIT_STORE, sandbox, cfg);
  }

  // §summary / classify

  function buildGatewaySummary(gateways /*, cfg */) {
    var readyCount = 0;
    var blockedCount = 0;
    var skippedCount = 0;
    var hasReadyTarget = false;
    var hasBlocker = false;

    var keys = ['telegramGateway', 'snapshotGateway', 'evaluationGateway', 'auditGateway'];
    var i;
    for (i = 0; i < keys.length; i++) {
      var t = gateways[keys[i]];
      if (!isPlainObject(t)) continue;
      if (t.ready === true) { hasReadyTarget = true; readyCount += 1; }
      else if (Array.isArray(t.blockedReasons) && t.blockedReasons.length > 0) {
        var realBlock = false;
        var br;
        for (br = 0; br < t.blockedReasons.length; br++) {
          if (t.blockedReasons[br] !== 'SOURCE_SANDBOX_NOT_READY') { realBlock = true; break; }
        }
        if (realBlock) { blockedCount += 1; hasBlocker = true; }
        else skippedCount += 1;
      } else skippedCount += 1;
    }

    return {
      readyCount: readyCount,
      blockedCount: blockedCount,
      skippedCount: skippedCount,
      hasReadyTarget: hasReadyTarget,
      hasBlocker: hasBlocker,
      liveGateRequired: true
    };
  }

  function classifyGatewayStatus(gateways, safety, cfg) {
    // 1. INVALID
    if (safety && safety.invalidSandbox === true) return GATEWAY_STATUS.INVALID;
    if (safety && safety.sourceSandboxStatus === 'SANDBOX_INVALID') return GATEWAY_STATUS.INVALID;

    // 2. BLOCKED
    if (safety && safety.credentialBlocked === true) return GATEWAY_STATUS.BLOCKED;
    if (safety && safety.envLikeBlocked === true) return GATEWAY_STATUS.BLOCKED;
    if (safety && safety.depthBlocked === true) return GATEWAY_STATUS.BLOCKED;
    if (safety && safety.functionInputBlocked === true) return GATEWAY_STATUS.BLOCKED;
    if (safety && safety.modeBlocked === true) return GATEWAY_STATUS.BLOCKED;
    if (safety && safety.hardBlockBoolean === true) return GATEWAY_STATUS.BLOCKED;
    if (cfg && cfg.gatewayMode !== GATEWAY_MODE.CONTRACT_ONLY) return GATEWAY_STATUS.BLOCKED;
    if (cfg && cfg.liveExecutionAllowed === true) return GATEWAY_STATUS.BLOCKED;
    if (cfg && cfg.lookupAllowed === true) return GATEWAY_STATUS.BLOCKED;
    if (cfg && cfg.sideEffectAllowed === true) return GATEWAY_STATUS.BLOCKED;
    if (cfg && cfg.fetchAllowed === true) return GATEWAY_STATUS.BLOCKED;
    if (cfg && cfg.writeAllowed === true) return GATEWAY_STATUS.BLOCKED;
    if (cfg && cfg.credentialLookupAllowed === true) return GATEWAY_STATUS.BLOCKED;
    if (cfg && cfg.bindingLookupAllowed === true) return GATEWAY_STATUS.BLOCKED;
    if (cfg && cfg.driverCallAllowed === true) return GATEWAY_STATUS.BLOCKED;
    if (cfg && cfg.retryAllowed === true) return GATEWAY_STATUS.BLOCKED;
    if (cfg && cfg.timerAllowed === true) return GATEWAY_STATUS.BLOCKED;
    if (cfg && cfg.envAccessAllowed === true) return GATEWAY_STATUS.BLOCKED;
    if (safety && safety.sourceSandboxStatus === 'SANDBOX_BLOCKED') return GATEWAY_STATUS.BLOCKED;

    var summary = buildGatewaySummary(gateways);

    if (summary.hasReadyTarget && summary.hasBlocker) return GATEWAY_STATUS.PARTIAL;
    if (safety && (safety.sourceSandboxStatus === 'SANDBOX_READY' || safety.sourceSandboxStatus === 'SANDBOX_PARTIAL')
        && summary.hasReadyTarget && !summary.hasBlocker) {
      return GATEWAY_STATUS.READY;
    }
    if (safety && safety.sourceSandboxStatus === 'SANDBOX_SKIPPED') return GATEWAY_STATUS.SKIPPED;
    if (!summary.hasReadyTarget && !summary.hasBlocker) return GATEWAY_STATUS.SKIPPED;
    return GATEWAY_STATUS.UNKNOWN;
  }

  // §normalize

  function normalizeGatewayTarget(target /*, cfg */) {
    var t = isPlainObject(target) ? target : {};
    return {
      ready: t.ready === true,
      target: typeof t.target === 'string' ? t.target : null,
      contractOnly: t.contractOnly !== false,
      lookupAllowed: t.lookupAllowed === true,
      sideEffectAllowed: t.sideEffectAllowed === true,
      bindingRef: typeof t.bindingRef === 'string' ? t.bindingRef : null,
      credentialHandleRef: typeof t.credentialHandleRef === 'string' ? t.credentialHandleRef : null,
      bindingScope: typeof t.bindingScope === 'string' ? t.bindingScope : null,
      lookupPlan: t.lookupPlan,
      bindingPolicy: t.bindingPolicy,
      sandboxResultRef: t.sandboxResultRef,
      perTargetGate: t.perTargetGate,
      rateLimitContract: t.rateLimitContract,
      circuitBreakerContract: t.circuitBreakerContract,
      blockedReasons: Array.isArray(t.blockedReasons) ? t.blockedReasons : [],
      warnings: Array.isArray(t.warnings) ? t.warnings : []
    };
  }

  function normalizeSecureBindingGatewayContract(result) {
    return {
      valid: result.valid === true,
      version: result.version,
      gatewayMode: typeof result.gatewayMode === 'string' ? result.gatewayMode : 'CONTRACT_ONLY',
      liveExecutionAllowed: result.liveExecutionAllowed === true,
      lookupAllowed: result.lookupAllowed === true,
      gatewayStatus: typeof result.gatewayStatus === 'string' ? result.gatewayStatus : GATEWAY_STATUS.UNKNOWN,
      sourceSandboxStatus: typeof result.sourceSandboxStatus === 'string' ? result.sourceSandboxStatus : null,
      gatewayPolicy: result.gatewayPolicy,
      telegramGateway: result.telegramGateway,
      snapshotGateway: result.snapshotGateway,
      evaluationGateway: result.evaluationGateway,
      auditGateway: result.auditGateway,
      gatewaySummary: result.gatewaySummary,
      reasons: Array.isArray(result.reasons) ? result.reasons : [],
      warnings: Array.isArray(result.warnings) ? result.warnings : [],
      debug: result.debug,
      configUsed: result.configUsed
    };
  }

  // §main entry ─────────────────────────────────────────────────────────

  function buildSecureBindingGatewayContract(input, config) {
    var inp = isPlainObject(input) ? input : {};
    var cfg = mergeSecureBindingGatewayContractConfig(config);
    var reasons = [];
    var warnings = [];

    // STEP 1 — INVALID
    var src = isPlainObject(inp.transportExecutorSandboxRunner) ? inp.transportExecutorSandboxRunner : null;
    var invalidSandbox = (src === null) || (src.valid !== true);
    var sourceSandboxStatus = (src && typeof src.sandboxStatus === 'string') ? src.sandboxStatus : null;

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
    var modeBlocked = (cfg.gatewayMode !== GATEWAY_MODE.CONTRACT_ONLY);
    var hardBlockBoolean = (cfg.liveExecutionAllowed === true)
                        || (cfg.lookupAllowed === true)
                        || (cfg.sideEffectAllowed === true)
                        || (cfg.fetchAllowed === true)
                        || (cfg.writeAllowed === true)
                        || (cfg.credentialLookupAllowed === true)
                        || (cfg.bindingLookupAllowed === true)
                        || (cfg.driverCallAllowed === true)
                        || (cfg.retryAllowed === true)
                        || (cfg.timerAllowed === true)
                        || (cfg.envAccessAllowed === true);

    // STEP 4 — base gateway (default — non-ready)
    function makeBase(targetType) {
      var bindingRef;
      if (targetType === TARGET.TELEGRAM) bindingRef = 'TELEGRAM_SECURE_BINDING';
      else if (targetType === TARGET.SNAPSHOT_STORE) bindingRef = 'KV_SNAPSHOT_BINDING';
      else if (targetType === TARGET.EVALUATION_STORE) bindingRef = 'EVALUATION_STORE_BINDING';
      else bindingRef = 'AUDIT_STORE_BINDING';
      return {
        ready: false,
        target: targetType,
        contractOnly: true,
        lookupAllowed: false,
        sideEffectAllowed: false,
        bindingRef: bindingRef,
        credentialHandleRef: buildCredentialHandleRef(targetType, cfg),
        bindingScope: buildBindingScope(targetType, cfg),
        lookupPlan: buildLookupPlan(cfg),
        bindingPolicy: buildBindingPolicy(cfg),
        sandboxResultRef: null,
        perTargetGate: { allow: false, reason: 'CONTRACT_ONLY' },
        rateLimitContract: null,
        circuitBreakerContract: null,
        blockedReasons: [],
        warnings: []
      };
    }

    var teleG = makeBase(TARGET.TELEGRAM);
    var snapG = makeBase(TARGET.SNAPSHOT_STORE);
    var evalG = makeBase(TARGET.EVALUATION_STORE);
    var auditG = makeBase(TARGET.AUDIT_STORE);

    function pushBlockToAll(code) {
      teleG.blockedReasons.push(code);
      snapG.blockedReasons.push(code);
      evalG.blockedReasons.push(code);
      auditG.blockedReasons.push(code);
    }

    if (invalidSandbox) {
      reasons.push('TRANSPORT_EXECUTOR_SANDBOX_RUNNER_INVALID');
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
      reasons.push('NON_CONTRACT_ONLY_MODE_BLOCKED');
      pushBlockToAll('NON_CONTRACT_ONLY_MODE_BLOCKED');
    } else if (hardBlockBoolean) {
      reasons.push('HARD_BLOCK_BOOLEAN_TRUE');
      if (cfg.liveExecutionAllowed === true) pushBlockToAll('LIVE_EXECUTION_ALLOWED_BLOCKED');
      if (cfg.lookupAllowed === true) pushBlockToAll('LOOKUP_ALLOWED_BLOCKED');
      if (cfg.sideEffectAllowed === true) pushBlockToAll('SIDE_EFFECT_ALLOWED_BLOCKED');
      if (cfg.fetchAllowed === true) pushBlockToAll('FETCH_ALLOWED_BLOCKED');
      if (cfg.writeAllowed === true) pushBlockToAll('WRITE_ALLOWED_BLOCKED');
      if (cfg.credentialLookupAllowed === true) pushBlockToAll('CREDENTIAL_LOOKUP_ALLOWED_BLOCKED');
      if (cfg.bindingLookupAllowed === true) pushBlockToAll('BINDING_LOOKUP_ALLOWED_BLOCKED');
      if (cfg.driverCallAllowed === true) pushBlockToAll('DRIVER_CALL_ALLOWED_BLOCKED');
      if (cfg.retryAllowed === true) pushBlockToAll('RETRY_ALLOWED_BLOCKED');
      if (cfg.timerAllowed === true) pushBlockToAll('TIMER_ALLOWED_BLOCKED');
      if (cfg.envAccessAllowed === true) pushBlockToAll('ENV_ACCESS_ALLOWED_BLOCKED');
    } else if (sourceSandboxStatus === 'SANDBOX_BLOCKED') {
      reasons.push('SOURCE_SANDBOX_BLOCKED');
      pushBlockToAll('SOURCE_SANDBOX_BLOCKED');
    } else {
      // STEP 5 — normal gateway builds
      teleG = buildTelegramGateway(inp, cfg);
      snapG = buildSnapshotGateway(inp, cfg);
      evalG = buildEvaluationGateway(inp, cfg);
      auditG = buildAuditGateway(inp, cfg);
    }

    // STEP 6 — normalize
    teleG = normalizeGatewayTarget(teleG, cfg);
    snapG = normalizeGatewayTarget(snapG, cfg);
    evalG = normalizeGatewayTarget(evalG, cfg);
    auditG = normalizeGatewayTarget(auditG, cfg);

    // STEP 7 — summary + classify
    var gateways = {
      telegramGateway: teleG,
      snapshotGateway: snapG,
      evaluationGateway: evalG,
      auditGateway: auditG
    };
    var summary = buildGatewaySummary(gateways);
    var safetyFlags = {
      invalidSandbox: invalidSandbox,
      sourceSandboxStatus: sourceSandboxStatus,
      credentialBlocked: credBlocked,
      envLikeBlocked: envLikeBlocked,
      depthBlocked: depthBlocked,
      functionInputBlocked: functionInputBlocked,
      modeBlocked: modeBlocked,
      hardBlockBoolean: hardBlockBoolean
    };
    var gatewayStatus = classifyGatewayStatus(gateways, safetyFlags, cfg);

    // STEP 8 — reasons
    if (gatewayStatus === GATEWAY_STATUS.READY) reasons.push('GATEWAY_READY');
    if (gatewayStatus === GATEWAY_STATUS.PARTIAL) reasons.push('GATEWAY_PARTIAL');
    if (gatewayStatus === GATEWAY_STATUS.SKIPPED) reasons.push('GATEWAY_SKIPPED');
    if (gatewayStatus === GATEWAY_STATUS.UNKNOWN) reasons.push('GATEWAY_UNKNOWN_FALLBACK');
    if (teleG.ready) reasons.push('TELEGRAM_GATEWAY_READY');
    if (snapG.ready) reasons.push('SNAPSHOT_GATEWAY_READY');
    if (evalG.ready) reasons.push('EVALUATION_GATEWAY_READY');
    if (auditG.ready) reasons.push('AUDIT_GATEWAY_READY');

    // STEP 9 — gatewayPolicy fixed contract
    var gatewayPolicy = {
      contractOnly: true,
      lookupAllowed: false,
      sideEffectAllowed: false,
      credentialLookupAllowed: false,
      bindingLookupAllowed: false,
      fetchAllowed: false,
      writeAllowed: false,
      driverCallAllowed: false,
      retryAllowed: false,
      timerAllowed: false,
      envAccessAllowed: false,
      allowMaskedCredentialPreview: false,
      liveExecutionRequiresExplicitGate: true
    };

    // STEP 10 — configUsed scalar snapshot
    var configUsed = {
      version: cfg.version,
      gatewayMode: cfg.gatewayMode,
      liveExecutionAllowed: cfg.liveExecutionAllowed,
      lookupAllowed: cfg.lookupAllowed,
      sideEffectAllowed: cfg.sideEffectAllowed,
      fetchAllowed: cfg.fetchAllowed,
      writeAllowed: cfg.writeAllowed,
      credentialLookupAllowed: cfg.credentialLookupAllowed,
      bindingLookupAllowed: cfg.bindingLookupAllowed,
      driverCallAllowed: cfg.driverCallAllowed,
      retryAllowed: cfg.retryAllowed,
      timerAllowed: cfg.timerAllowed,
      envAccessAllowed: cfg.envAccessAllowed,
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
        blockMaskedPreview: cfg.safety.blockMaskedPreview,
        allowRawPayload: cfg.safety.allowRawPayload,
        allowEnvRead: cfg.safety.allowEnvRead,
        allowDirectSecretAccess: cfg.safety.allowDirectSecretAccess,
        allowFunctionInput: cfg.safety.allowFunctionInput,
        allowAsync: cfg.safety.allowAsync,
        allowMaskedCredentialPreview: cfg.safety.allowMaskedCredentialPreview
      },
      wording: { sanitizeMode: cfg.wording.sanitizeMode }
    };

    var draft = {
      valid: invalidSandbox ? false : true,
      version: GATEWAY_VERSION,
      gatewayMode: cfg.gatewayMode === GATEWAY_MODE.CONTRACT_ONLY ? 'CONTRACT_ONLY' : cfg.gatewayMode,
      liveExecutionAllowed: cfg.liveExecutionAllowed === true,
      lookupAllowed: cfg.lookupAllowed === true,
      gatewayStatus: gatewayStatus,
      sourceSandboxStatus: sourceSandboxStatus,
      gatewayPolicy: gatewayPolicy,
      telegramGateway: teleG,
      snapshotGateway: snapG,
      evaluationGateway: evalG,
      auditGateway: auditG,
      gatewaySummary: summary,
      reasons: reasons,
      warnings: warnings,
      debug: {
        source: 'transportExecutorSandboxRunner + transportExecutorInterfaceAdapter + transportExecutorHarness + secureTransportExecutorContract + transportExecutionEnvelope + transportPlan + rendererBinding + operationPacket + activeCycleDecision + evaluationOutcome + externalConfluence',
        configVersion: cfg.version,
        invalidSandbox: invalidSandbox,
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
    return normalizeSecureBindingGatewayContract(draft);
  }

  // §export ──────────────────────────────────────────────────────────────

  var api = Object.freeze({
    VERSION: GATEWAY_VERSION,
    DEFAULT_SECURE_BINDING_GATEWAY_CONTRACT_CONFIG: DEFAULT_SECURE_BINDING_GATEWAY_CONTRACT_CONFIG,
    GATEWAY_MODE: GATEWAY_MODE,
    GATEWAY_STATUS: GATEWAY_STATUS,
    TARGET: TARGET,
    ACTION: ACTION,
    SIMULATED_STATUS: SIMULATED_STATUS,
    WORDING_SANITIZE_MODE: WORDING_SANITIZE_MODE,
    build: buildSecureBindingGatewayContract,
    mergeSecureBindingGatewayContractConfig: mergeSecureBindingGatewayContractConfig,
    buildTelegramGateway: buildTelegramGateway,
    buildSnapshotGateway: buildSnapshotGateway,
    buildEvaluationGateway: buildEvaluationGateway,
    buildAuditGateway: buildAuditGateway,
    buildCredentialHandleRef: buildCredentialHandleRef,
    buildBindingScope: buildBindingScope,
    buildLookupPlan: buildLookupPlan,
    buildBindingPolicy: buildBindingPolicy,
    buildSandboxResultRef: buildSandboxResultRef,
    classifyGatewayStatus: classifyGatewayStatus,
    detectCredentialFields: detectCredentialFields,
    detectEnvLikeObjects: detectEnvLikeObjects,
    detectFunctionInputs: detectFunctionInputs,
    validateLogicalRef: validateLogicalRef,
    validateLookupPlan: validateLookupPlan,
    validateBindingPolicy: validateBindingPolicy,
    validateSandboxResultRef: validateSandboxResultRef,
    sanitizeMessageLines: sanitizeMessageLines
  });

  global.WS3_SecureBindingGatewayContract = api;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
