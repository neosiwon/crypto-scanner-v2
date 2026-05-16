/**
 * WS3 v0.14.0 — SecureTransportExecutorContract (Secure Transport Executor Contract)
 *
 * Scope:
 *   transportExecutionEnvelope (v0.13.0) + transportPlan (v0.12.0) +
 *   rendererBinding (v0.12.0) + operationPacket (v0.8.0) +
 *   activeCycleDecision (v0.9.0) + evaluationOutcome (v0.10.0) +
 *   externalConfluence (v0.11.0)
 *   → standalone SecureTransportExecutorContract (CONTRACT_ONLY, contract-only)
 *
 * 단일 기준 문서:
 *   docs/ws3/WS3_CODE_CONTRACT.md (b-r2 박제본)
 *
 * 확정 DP 정책 (Gate 2 spec):
 *   DP-SEC1   secure executor contract 만. 실제 발송 / 저장 / 호출 X.
 *   DP-SEC2   transportExecutionEnvelope eligible/status 결정을 true 로 override 금지.
 *   DP-SEC3   contractMode CONTRACT_ONLY only. LIVE / REAL / EXECUTE → CONTRACT_BLOCKED.
 *             config.liveExecutionAllowed === true 도 CONTRACT_BLOCKED.
 *   DP-SEC4   credential 값 / process.env / env 객체 / secure binding value 읽기 0건.
 *             env-like object 가 input/config 로 들어오면 즉시 CONTRACT_BLOCKED.
 *             credential 9키 재귀 검사 (case-insensitive + partial + depth 5).
 *   DP-SEC5   bindingRef logical reference only. validateBindingRef 로 형식 / 금지 pattern /
 *             credential pattern 검증. bindingRefAllowList 기본 [].
 *   DP-SEC6   requestShape / payloadSummary / metadata 는 whitelist scalar 만.
 *             원본 객체 spread / Object.assign / deep clone / for-in 금지.
 *             v0.13 envelope 의 payloadSummary / metadata 도 재검증.
 *   DP-SEC7   dry-run wording 만. 발송됨 / sent / delivered / 손절 / 익절 / take profit 등 금지.
 *   DP-SEC8   side-effect 금지 — fetch / Telegram / KV / DB / DOM / storage / runtime clock 0건.
 *   DP-SEC9   7종 입력 (transportExecutionEnvelope + transportPlan + rendererBinding +
 *             operationPacket + activeCycleDecision + evaluationOutcome + externalConfluence)
 *             read-only.
 *   DP-SEC10  신규 파일 1개 + 문서 갱신만. 기존 v3 엔진 파일 (19종) 수정 금지.
 *
 * N-SEC-OBS 처리:
 *   N-SEC-OBS-1  보호 baseline false-positive — 본 모듈 fetch / Date.now / new Date /
 *                performance.now / Object.assign / spread / deep clone / for-in 0건.
 *   N-SEC-OBS-2  payloadSummaryAllowedFields namespace — v0.13.0 의 cfg.payloadSummary.allowedFields
 *                와 다른 namespace (cfg.requestShape.payloadSummaryAllowedFields). 구조적 충돌 없음.
 *   N-SEC-OBS-3  buildSafePayloadSummary 동명 함수 — IIFE module-private 함수로 정의. global export 미포함.
 *                v0.13.0 의 module-private 동명 함수와 파일 scope 분리로 충돌 없음.
 *   N-SEC-OBS-4  RESERVED 프레임워크 metadata 키 자동 차단 제외 — v0.13.0 envelope output 의
 *                자체 정책 metadata field 명 (credentialMaxDepth / credentialAllowList /
 *                allowWebhookUrl / bindingRefAllowList 등) 은 credential keyword substring 을
 *                포함하지만 실제 credential value 가 아니다. isCredentialKey 가 reserved exact
 *                match 를 먼저 검사하여 차단 제외. 사용자 입력에 동명 field 가 들어와도
 *                value 검사 없이 detection 만 회피 (key 이름만 제외).
 *
 * 출력 (top-level):
 *   valid, version, contractMode, liveExecutionAllowed,
 *   contractStatus (6 후보), sourceEnvelopeStatus,
 *   secureBindingPolicy,
 *   telegramContract, snapshotContract, evaluationContract, auditContract,
 *   contractSummary, reasons[], warnings[], debug, configUsed
 *
 * contractStatus 6 후보 (first-match-wins):
 *   CONTRACT_INVALID  → transportExecutionEnvelope missing 또는 valid !== true
 *   CONTRACT_BLOCKED  → source envelope BLOCKED/INVALID, credential 감지, env-like 감지,
 *                       depth 초과, bindingRef credential pattern,
 *                       contractMode!==CONTRACT_ONLY, liveExecutionAllowed===true
 *   CONTRACT_PARTIAL  → ≥1 ready true + ≥1 blocker
 *   CONTRACT_READY    → source envelope READY/PARTIAL + ≥1 ready true + blocker 0
 *   CONTRACT_SKIPPED  → source envelope SKIPPED, 또는 모든 ready false + blocker 0
 *   CONTRACT_UNKNOWN  → fallback
 *
 * 의도된 미구현 (이번 단계 제외):
 *   실제 Telegram bot API 호출 / chatId / botToken / webhookUrl 노출.
 *   실제 KV write / DB persist / 파일 IO / 브라우저 storage.
 *   실제 reviewQueue write / audit log 영속화.
 *   실제 DOM 렌더 / HTML attach / addEventListener.
 *   실제 env 접근 / process.env / Cloudflare env 객체 / secret binding 값 읽기.
 *   입력 객체 mutation.
 *   런타임 clock API (Date.now / new Date / performance.now).
 *   raw payload / payload.raw / identityInput / raw.builderDebug 노출.
 *
 * 함수 목록 (§12 spec):
 *   mergeSecureTransportExecutorContractConfig(config)
 *   buildSecureTransportExecutorContract(input, config)   ← 진입점
 *   buildTelegramContract(input, cfg)
 *   buildSnapshotContract(input, cfg)
 *   buildEvaluationContract(input, cfg)
 *   buildAuditContract(input, cfg)
 *   buildSafeRequestShape(envelope, target, cfg)
 *   buildSafePayloadSummary(input, cfg)
 *   buildSafeMetadata(input, cfg)
 *   buildContractSummary(contracts, cfg)
 *   classifyContractStatus(contracts, safety, cfg)
 *   detectCredentialFields(input, config)
 *   detectEnvLikeObjects(input, config)
 *   isCredentialKey(keyName, allowList)
 *   isEnvLikeKey(keyName)
 *   sanitizeMessageLines(lines, cfg)
 *   validateBindingRef(bindingRef, cfg)
 *   normalizeContractTarget(target, cfg)
 *   normalizeSecureTransportExecutorContract(result)
 *   isPlainObject, safeString, safeNumber, pushReason, pushWarning
 *
 * export:
 *   global.WS3_SecureTransportExecutorContract + module.exports
 */
(function(global) {
  'use strict';

  // §version
  var SECURE_CONTRACT_VERSION = 'WS3_v0.14.0_secure_transport_executor_contract';

  // §contractMode 후보 (only CONTRACT_ONLY allowed in v0.14.0)
  var CONTRACT_MODE = Object.freeze({
    CONTRACT_ONLY: 'CONTRACT_ONLY'
  });

  // §contractStatus 6 후보
  var CONTRACT_STATUS = Object.freeze({
    READY: 'CONTRACT_READY',
    SKIPPED: 'CONTRACT_SKIPPED',
    BLOCKED: 'CONTRACT_BLOCKED',
    PARTIAL: 'CONTRACT_PARTIAL',
    INVALID: 'CONTRACT_INVALID',
    UNKNOWN: 'CONTRACT_UNKNOWN'
  });

  // §target enum (logical only — no real API endpoints)
  var TARGET = Object.freeze({
    TELEGRAM: 'TELEGRAM',
    SNAPSHOT_STORE: 'SNAPSHOT_STORE',
    EVALUATION_STORE: 'EVALUATION_STORE',
    AUDIT_STORE: 'AUDIT_STORE'
  });

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

  // §RESERVED 프레임워크 metadata 키 (자체 정책 metadata 식별자 — credential 아님)
  //   v0.13.0 envelope output / v0.14.0 contract output 의 자체 metadata 필드 중
  //   credential 키워드 substring 을 포함하지만 실제 credential value 가 아닌 것들.
  //   exact match 로 차단 제외 (N-SEC-OBS-4 reserved framework metadata exclusion).
  var RESERVED_FRAMEWORK_METADATA_KEYS = Object.freeze([
    // v0.14.0 safety / policy metadata
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
    'allowWebhookUrl',
    'allowDirectSecretAccess',
    'bindingRefAllowList',
    'bindingRefAllowListSize',
    'bindingRefCredentialPatternBlocked',
    'blockCredentialFields'
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

  // §bindingRef 금지 substring / pattern (literal)
  var BINDING_REF_FORBIDDEN_SUBSTRINGS = Object.freeze([
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

  // §wording sanitize 후보
  var WORDING_SANITIZE_MODE = Object.freeze({
    REJECT: 'REJECT',
    REPLACE: 'REPLACE',
    WARN_ONLY: 'WARN_ONLY'
  });

  // §forbidden wording (DP-SEC7) — v0.13.0 동일 정책
  //   금지: trading wording (손절/익절/수익 확정/매수 성공 등)
  //   금지: transmission completion (발송됨/저장됨/전송 완료/sent/delivered/completed transmission)
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

  // §DEFAULT_CONFIG (§11)
  var DEFAULT_SECURE_TRANSPORT_EXECUTOR_CONTRACT_CONFIG = Object.freeze({
    version: 'inline-default-v0',
    contractMode: 'CONTRACT_ONLY',
    liveExecutionAllowed: false,
    targets: Object.freeze({
      telegram: Object.freeze({
        enabled: true,
        bindingRequired: true,
        bindingRef: 'TELEGRAM_SECURE_BINDING'
      }),
      snapshot: Object.freeze({
        enabled: true,
        bindingRequired: true,
        bindingRef: 'KV_SNAPSHOT_BINDING'
      }),
      evaluation: Object.freeze({
        enabled: true,
        bindingRequired: true,
        bindingRef: 'EVALUATION_STORE_BINDING'
      }),
      audit: Object.freeze({
        enabled: true,
        bindingRequired: true,
        bindingRef: 'AUDIT_STORE_BINDING'
      })
    }),
    safety: Object.freeze({
      blockCredentialFields: true,
      credentialMaxDepth: 5,
      credentialAllowList: Object.freeze([]),
      bindingRefAllowList: Object.freeze([]),
      blockEnvLikeObjects: true,
      blockObjectTooDeep: true,
      allowRawPayload: false,
      allowLiveExecution: false,
      allowEnvRead: false,
      allowDirectSecretAccess: false
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
  function mergeSecureTransportExecutorContractConfig(config) {
    var c = isPlainObject(config) ? config : {};
    var d = DEFAULT_SECURE_TRANSPORT_EXECUTOR_CONTRACT_CONFIG;

    var tg = isPlainObject(c.targets) ? c.targets : {};
    var sf = isPlainObject(c.safety) ? c.safety : {};
    var rs = isPlainObject(c.requestShape) ? c.requestShape : {};
    var wd = isPlainObject(c.wording) ? c.wording : {};
    var db = isPlainObject(c.debug) ? c.debug : {};

    var tgTele = isPlainObject(tg.telegram) ? tg.telegram : {};
    var tgSnap = isPlainObject(tg.snapshot) ? tg.snapshot : {};
    var tgEval = isPlainObject(tg.evaluation) ? tg.evaluation : {};
    var tgAudit = isPlainObject(tg.audit) ? tg.audit : {};

    // copy array of strings field-by-field (no spread)
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
    var bindingAllow = copyStringArray(sf.bindingRefAllowList, d.safety.bindingRefAllowList);
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
      contractMode: (typeof c.contractMode === 'string' && c.contractMode.length > 0) ? c.contractMode : d.contractMode,
      liveExecutionAllowed: c.liveExecutionAllowed === true,
      targets: {
        telegram: {
          enabled: tgTele.enabled !== false,
          bindingRequired: tgTele.bindingRequired !== false,
          bindingRef: (typeof tgTele.bindingRef === 'string' && tgTele.bindingRef.length > 0)
            ? tgTele.bindingRef
            : d.targets.telegram.bindingRef
        },
        snapshot: {
          enabled: tgSnap.enabled !== false,
          bindingRequired: tgSnap.bindingRequired !== false,
          bindingRef: (typeof tgSnap.bindingRef === 'string' && tgSnap.bindingRef.length > 0)
            ? tgSnap.bindingRef
            : d.targets.snapshot.bindingRef
        },
        evaluation: {
          enabled: tgEval.enabled !== false,
          bindingRequired: tgEval.bindingRequired !== false,
          bindingRef: (typeof tgEval.bindingRef === 'string' && tgEval.bindingRef.length > 0)
            ? tgEval.bindingRef
            : d.targets.evaluation.bindingRef
        },
        audit: {
          enabled: tgAudit.enabled !== false,
          bindingRequired: tgAudit.bindingRequired !== false,
          bindingRef: (typeof tgAudit.bindingRef === 'string' && tgAudit.bindingRef.length > 0)
            ? tgAudit.bindingRef
            : d.targets.audit.bindingRef
        }
      },
      safety: {
        blockCredentialFields: sf.blockCredentialFields !== false,
        credentialMaxDepth: maxDepth,
        credentialAllowList: credAllow,
        bindingRefAllowList: bindingAllow,
        blockEnvLikeObjects: sf.blockEnvLikeObjects !== false,
        blockObjectTooDeep: sf.blockObjectTooDeep !== false,
        allowRawPayload: sf.allowRawPayload === true,
        allowLiveExecution: sf.allowLiveExecution === true,
        allowEnvRead: sf.allowEnvRead === true,
        allowDirectSecretAccess: sf.allowDirectSecretAccess === true
      },
      requestShape: {
        maxStringLength: maxLen,
        metadataAllowedFields: metaAllowed,
        payloadSummaryAllowedFields: allowedFields
      },
      wording: {
        sanitizeMode: sanitizeMode
      },
      debug: {
        enabled: db.enabled === true,
        allowedFields: debugAllowed
      }
    };
  }

  // §credential / env detection ─────────────────────────────────────────

  function isCredentialKey(keyName, allowList) {
    if (typeof keyName !== 'string' || keyName.length === 0) return false;

    // 1. RESERVED 프레임워크 metadata 키 — 자동 차단 제외 (N-SEC-OBS-4)
    //    v0.13/v0.14 자체 정책 metadata field 명이 credential substring 을 포함하는 경우.
    var r;
    for (r = 0; r < RESERVED_FRAMEWORK_METADATA_KEYS.length; r++) {
      if (RESERVED_FRAMEWORK_METADATA_KEYS[r] === keyName) return false;
    }

    // 2. user-provided allowList — exact string match
    if (Array.isArray(allowList)) {
      var a;
      for (a = 0; a < allowList.length; a++) {
        if (allowList[a] === keyName) return false;
      }
    }

    // 3. 9종 credential 키 partial substring match (case-insensitive)
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

  // detectCredentialFields — recursive nested object scan
  //   depth 검사는 nested object/array 에 대해서만 적용 (scalar leaf 는 안전, depth 무관)
  function detectCredentialFields(input, config) {
    var cfg = mergeSecureTransportExecutorContractConfig(config);
    var detections = [];
    var depthWarnings = [];

    if (cfg.safety.blockCredentialFields !== true) {
      return { detections: detections, depthWarnings: depthWarnings };
    }

    function walk(value, path, depth) {
      // scalar leaf — 안전, depth 무관
      if (!isPlainObject(value) && !Array.isArray(value)) return;
      // depth 검사는 nested container 에만 적용
      if (depth > cfg.safety.credentialMaxDepth) {
        depthWarnings.push(path);
        return;
      }
      if (Array.isArray(value)) {
        var i;
        for (i = 0; i < value.length; i++) {
          walk(value[i], path + '[' + i + ']', depth + 1);
        }
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
        if (isCredentialKey(ik, cfg.safety.credentialAllowList)) {
          detections.push('input.' + ik);
        } else {
          walk(input[ik], 'input.' + ik, 1);
        }
      }
    }
    if (isPlainObject(config)) {
      var cKeys = Object.keys(config);
      var cx;
      for (cx = 0; cx < cKeys.length; cx++) {
        var ck = cKeys[cx];
        if (isCredentialKey(ck, cfg.safety.credentialAllowList)) {
          detections.push('config.' + ck);
        } else {
          walk(config[ck], 'config.' + ck, 1);
        }
      }
    }
    return { detections: detections, depthWarnings: depthWarnings };
  }

  // detectEnvLikeObjects — exact key match + value is object
  //   value 는 enumerate 하지 않는다. depth limit 초과는 별도 차단.
  function detectEnvLikeObjects(input, config) {
    var cfg = mergeSecureTransportExecutorContractConfig(config);
    var detections = [];
    var depthBlocks = [];

    if (cfg.safety.blockEnvLikeObjects !== true) {
      return { detections: detections, depthBlocks: depthBlocks };
    }

    function walk(value, path, depth) {
      // scalar leaf — 안전, depth 무관
      if (!isPlainObject(value) && !Array.isArray(value)) return;
      // depth 검사는 nested container 에만 적용
      if (depth > cfg.safety.credentialMaxDepth) {
        if (cfg.safety.blockObjectTooDeep === true) {
          depthBlocks.push(path);
        }
        return;
      }
      if (Array.isArray(value)) {
        var i;
        for (i = 0; i < value.length; i++) {
          walk(value[i], path + '[' + i + ']', depth + 1);
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
          // env-like: key exact match + value is object
          if (isEnvLikeKey(keyName) && isPlainObject(childVal)) {
            detections.push(nextPath);
            // do NOT enumerate this env-like object's contents
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
        if (isEnvLikeKey(ik) && isPlainObject(iv)) {
          detections.push('input.' + ik);
        } else {
          walk(iv, 'input.' + ik, 1);
        }
      }
    }
    if (isPlainObject(config)) {
      var cKeys = Object.keys(config);
      var cx;
      for (cx = 0; cx < cKeys.length; cx++) {
        var ck = cKeys[cx];
        var cv = config[ck];
        if (isEnvLikeKey(ck) && isPlainObject(cv)) {
          detections.push('config.' + ck);
        } else {
          walk(cv, 'config.' + ck, 1);
        }
      }
    }
    return { detections: detections, depthBlocks: depthBlocks };
  }

  // §validateBindingRef ─────────────────────────────────────────────────

  var BINDING_REF_PATTERN = /^[A-Z][A-Z0-9_]*$/;

  function validateBindingRef(bindingRef, cfg) {
    var allowList = (cfg && cfg.safety && Array.isArray(cfg.safety.bindingRefAllowList))
      ? cfg.safety.bindingRefAllowList
      : [];

    // allowList check first — exact string match
    if (Array.isArray(allowList)) {
      var a;
      for (a = 0; a < allowList.length; a++) {
        if (allowList[a] === bindingRef) {
          return { valid: true, reason: null };
        }
      }
    }

    if (typeof bindingRef !== 'string') {
      return { valid: false, reason: 'BINDING_REF_INVALID_FORMAT' };
    }
    if (bindingRef.length < 3 || bindingRef.length > 64) {
      return { valid: false, reason: 'BINDING_REF_INVALID_FORMAT' };
    }
    if (!BINDING_REF_PATTERN.test(bindingRef)) {
      return { valid: false, reason: 'BINDING_REF_INVALID_FORMAT' };
    }

    // forbidden substrings (literal)
    var i;
    for (i = 0; i < BINDING_REF_FORBIDDEN_SUBSTRINGS.length; i++) {
      if (bindingRef.indexOf(BINDING_REF_FORBIDDEN_SUBSTRINGS[i]) !== -1) {
        return { valid: false, reason: 'BINDING_REF_INVALID_FORMAT' };
      }
    }

    // bot[0-9]+ pattern
    if (/bot[0-9]+/i.test(bindingRef)) {
      return { valid: false, reason: 'BINDING_REF_INVALID_FORMAT' };
    }
    // digit-only string
    if (/^[0-9]+$/.test(bindingRef)) {
      return { valid: false, reason: 'BINDING_REF_INVALID_FORMAT' };
    }

    // credential pattern detection (partial + case-insensitive)
    if (isCredentialKey(bindingRef, allowList)) {
      return { valid: false, reason: 'BINDING_REF_CONTAINS_CREDENTIAL_PATTERN' };
    }

    return { valid: true, reason: null };
  }

  // §wording sanitize ───────────────────────────────────────────────────

  function lineContainsForbiddenWord(line) {
    if (typeof line !== 'string' || line.length === 0) return null;
    var lower = line.toLowerCase();
    var i;
    for (i = 0; i < FORBIDDEN_WORDS.length; i++) {
      var w = FORBIDDEN_WORDS[i];
      var lw = w.toLowerCase();
      if (lower.indexOf(lw) !== -1) return w;
    }
    return null;
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
        if (typeof replaced === 'string' && replaced.length <= maxLen) {
          result.lines.push(replaced);
        }
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

  // §payloadSummary / metadata revalidation ────────────────────────────

  // buildSafePayloadSummary — v0.13 envelope.payloadSummary 재검증
  //   v0.14.0 cfg.requestShape.payloadSummaryAllowedFields whitelist 만 복사
  //   IIFE module-private (N-SEC-OBS-3 — global export 미포함)
  function buildSafePayloadSummary(envelopeSummary, cfg) {
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

    if (!isPlainObject(envelopeSummary)) return { summary: out, warnings: warnings };

    var i;
    for (i = 0; i < allowed.length; i++) {
      var fld = allowed[i];
      if (typeof fld !== 'string' || fld.length === 0) continue;
      if (isCredentialKey(fld, allowList)) {
        warnings.push('CREDENTIAL_FIELD_REJECTED:' + fld);
        continue;
      }
      if (Object.prototype.hasOwnProperty.call(envelopeSummary, fld) === false) {
        out[fld] = null;
        continue;
      }
      var v = envelopeSummary[fld];
      if (v === null || v === undefined) { out[fld] = null; continue; }
      if (typeof v === 'string') {
        var s = safeString(v, maxLen);
        if (s === null) {
          warnings.push('NON_SCALAR_VALUE_SKIPPED:' + fld);
          out[fld] = null;
        } else {
          out[fld] = s;
        }
        continue;
      }
      if (typeof v === 'number') {
        var n = safeNumber(v);
        if (n === null) {
          warnings.push('NON_SCALAR_VALUE_SKIPPED:' + fld);
          out[fld] = null;
        } else {
          out[fld] = n;
        }
        continue;
      }
      if (typeof v === 'boolean') {
        out[fld] = v;
        continue;
      }
      warnings.push('NON_SCALAR_VALUE_SKIPPED:' + fld);
      out[fld] = null;
    }
    return { summary: out, warnings: warnings };
  }

  function buildSafeMetadata(envelopeMetadata, cfg) {
    var warnings = [];
    var out = {};
    var allowed = (cfg && cfg.requestShape && Array.isArray(cfg.requestShape.metadataAllowedFields))
      ? cfg.requestShape.metadataAllowedFields
      : [];
    if (allowed.length === 0) return { metadata: out, warnings: warnings };
    if (!isPlainObject(envelopeMetadata)) return { metadata: out, warnings: warnings };

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
      if (Object.prototype.hasOwnProperty.call(envelopeMetadata, fld) === false) continue;
      var v = envelopeMetadata[fld];
      if (v === null || v === undefined) { out[fld] = null; continue; }
      if (typeof v === 'string') {
        var s = safeString(v, maxLen);
        if (s === null) {
          warnings.push('NON_SCALAR_METADATA_SKIPPED:' + fld);
          continue;
        }
        out[fld] = s;
        continue;
      }
      if (typeof v === 'number') {
        var n = safeNumber(v);
        if (n === null) {
          warnings.push('NON_SCALAR_METADATA_SKIPPED:' + fld);
          continue;
        }
        out[fld] = n;
        continue;
      }
      if (typeof v === 'boolean') {
        out[fld] = v;
        continue;
      }
      warnings.push('NON_SCALAR_METADATA_SKIPPED:' + fld);
    }
    return { metadata: out, warnings: warnings };
  }

  // buildSafeRequestShape — target 별 requestShape 생성
  function buildSafeRequestShape(envelope, targetType, cfg) {
    var warnings = [];
    var env = isPlainObject(envelope) ? envelope : {};
    var envReq = isPlainObject(env.request) ? env.request : {};
    var envSummary = isPlainObject(envReq.payloadSummary) ? envReq.payloadSummary : {};
    var envMeta = isPlainObject(envReq.metadata) ? envReq.metadata : {};

    // 재검증 (v0.13 신뢰 X — DP-SEC6)
    var sumResult = buildSafePayloadSummary(envSummary, cfg);
    var i;
    for (i = 0; i < sumResult.warnings.length; i++) warnings.push(sumResult.warnings[i]);

    var metaResult = buildSafeMetadata(envMeta, cfg);
    var m;
    for (m = 0; m < metaResult.warnings.length; m++) warnings.push(metaResult.warnings[m]);

    var maxLen = (cfg && cfg.requestShape && typeof cfg.requestShape.maxStringLength === 'number')
      ? cfg.requestShape.maxStringLength
      : 200;

    // base structure (logical only — no real channel/bucket value)
    var requestShape;
    if (targetType === TARGET.TELEGRAM) {
      var lines = [];
      if (Array.isArray(envReq.lines)) {
        var s = sanitizeMessageLines(envReq.lines, cfg);
        var li;
        for (li = 0; li < s.warnings.length; li++) warnings.push(s.warnings[li]);
        lines = s.lines;
      }
      requestShape = {
        channelRef: 'SECURE_CHANNEL_REF',
        messageType: (typeof envReq.messageType === 'string') ? safeString(envReq.messageType, maxLen) : 'NONE',
        title: (typeof envReq.title === 'string') ? safeString(envReq.title, maxLen) : null,
        lines: lines,
        payloadSummary: sumResult.summary,
        metadata: metaResult.metadata
      };
      if (requestShape.messageType === null) requestShape.messageType = 'NONE';
      return { requestShape: requestShape, warnings: warnings };
    }
    if (targetType === TARGET.SNAPSHOT_STORE) {
      requestShape = {
        bucketRef: 'SECURE_BUCKET_REF',
        snapshotType: (typeof envReq.snapshotType === 'string') ? safeString(envReq.snapshotType, maxLen) : 'NONE',
        keyHint: (typeof envReq.keyHint === 'string') ? safeString(envReq.keyHint, maxLen) : null,
        payloadSummary: sumResult.summary,
        metadata: metaResult.metadata
      };
      if (requestShape.snapshotType === null) requestShape.snapshotType = 'NONE';
      return { requestShape: requestShape, warnings: warnings };
    }
    if (targetType === TARGET.EVALUATION_STORE) {
      requestShape = {
        evaluationType: (typeof envReq.evaluationType === 'string') ? safeString(envReq.evaluationType, maxLen) : 'NONE',
        resultType: (typeof envReq.resultType === 'string') ? safeString(envReq.resultType, maxLen) : 'NONE',
        keyHint: (typeof envReq.keyHint === 'string') ? safeString(envReq.keyHint, maxLen) : null,
        payloadSummary: sumResult.summary,
        metadata: metaResult.metadata
      };
      if (requestShape.evaluationType === null) requestShape.evaluationType = 'NONE';
      if (requestShape.resultType === null) requestShape.resultType = 'NONE';
      return { requestShape: requestShape, warnings: warnings };
    }
    if (targetType === TARGET.AUDIT_STORE) {
      requestShape = {
        auditType: (typeof envReq.auditType === 'string') ? safeString(envReq.auditType, maxLen) : 'NONE',
        keyHint: (typeof envReq.keyHint === 'string') ? safeString(envReq.keyHint, maxLen) : null,
        payloadSummary: sumResult.summary,
        metadata: metaResult.metadata
      };
      if (requestShape.auditType === null) requestShape.auditType = 'NONE';
      return { requestShape: requestShape, warnings: warnings };
    }
    // unknown target — minimal scalar map
    return { requestShape: { payloadSummary: sumResult.summary, metadata: metaResult.metadata }, warnings: warnings };
  }

  // §contract builders ──────────────────────────────────────────────────

  function isReadyEnvelope(envelope) {
    return isPlainObject(envelope)
      && envelope.eligible === true
      && envelope.status === 'ENVELOPE_READY';
  }

  function buildTelegramContract(input, cfg) {
    var blockedReasons = [];
    var warnings = [];
    var env = isPlainObject(input.transportExecutionEnvelope) ? input.transportExecutionEnvelope : null;
    var teleEnv = (env && isPlainObject(env.telegramEnvelope)) ? env.telegramEnvelope : null;

    var sourceReady = teleEnv ? isReadyEnvelope(teleEnv) : false;
    var targetEnabled = cfg.targets.telegram.enabled === true;
    var bindingRef = cfg.targets.telegram.bindingRef;
    var bindingResult = validateBindingRef(bindingRef, cfg);
    var bindingValid = bindingResult.valid === true;
    var contractOnly = cfg.contractMode === CONTRACT_MODE.CONTRACT_ONLY;
    var liveNotAllowed = cfg.liveExecutionAllowed !== true;

    if (!sourceReady) blockedReasons.push('SOURCE_ENVELOPE_NOT_READY');
    if (!targetEnabled) blockedReasons.push('CONFIG_DISALLOW_TELEGRAM');
    if (!bindingValid) blockedReasons.push((bindingResult.reason || 'BINDING_REF_INVALID') + ':TELEGRAM');
    if (!contractOnly) blockedReasons.push('NON_CONTRACT_ONLY_MODE_BLOCKED');
    if (!liveNotAllowed) blockedReasons.push('LIVE_EXECUTION_ALLOWED_BLOCKED');

    var ready = sourceReady && targetEnabled && bindingValid && contractOnly && liveNotAllowed;

    var shapeResult = buildSafeRequestShape(teleEnv, TARGET.TELEGRAM, cfg);
    var sw;
    for (sw = 0; sw < shapeResult.warnings.length; sw++) warnings.push(shapeResult.warnings[sw]);

    return {
      ready: ready,
      target: TARGET.TELEGRAM,
      contractOnly: true,
      bindingRequired: cfg.targets.telegram.bindingRequired === true,
      bindingRef: bindingRef,
      credentialPolicy: 'NEVER_IN_PAYLOAD',
      requestShape: shapeResult.requestShape,
      blockedReasons: blockedReasons,
      warnings: warnings
    };
  }

  function buildSnapshotContract(input, cfg) {
    var blockedReasons = [];
    var warnings = [];
    var env = isPlainObject(input.transportExecutionEnvelope) ? input.transportExecutionEnvelope : null;
    var snapEnv = (env && isPlainObject(env.snapshotEnvelope)) ? env.snapshotEnvelope : null;

    var sourceReady = snapEnv ? isReadyEnvelope(snapEnv) : false;
    var targetEnabled = cfg.targets.snapshot.enabled === true;
    var bindingRef = cfg.targets.snapshot.bindingRef;
    var bindingResult = validateBindingRef(bindingRef, cfg);
    var bindingValid = bindingResult.valid === true;
    var contractOnly = cfg.contractMode === CONTRACT_MODE.CONTRACT_ONLY;
    var liveNotAllowed = cfg.liveExecutionAllowed !== true;

    if (!sourceReady) blockedReasons.push('SOURCE_ENVELOPE_NOT_READY');
    if (!targetEnabled) blockedReasons.push('CONFIG_DISALLOW_SNAPSHOT');
    if (!bindingValid) blockedReasons.push((bindingResult.reason || 'BINDING_REF_INVALID') + ':SNAPSHOT');
    if (!contractOnly) blockedReasons.push('NON_CONTRACT_ONLY_MODE_BLOCKED');
    if (!liveNotAllowed) blockedReasons.push('LIVE_EXECUTION_ALLOWED_BLOCKED');

    var ready = sourceReady && targetEnabled && bindingValid && contractOnly && liveNotAllowed;

    var shapeResult = buildSafeRequestShape(snapEnv, TARGET.SNAPSHOT_STORE, cfg);
    var sw;
    for (sw = 0; sw < shapeResult.warnings.length; sw++) warnings.push(shapeResult.warnings[sw]);

    return {
      ready: ready,
      target: TARGET.SNAPSHOT_STORE,
      contractOnly: true,
      bindingRequired: cfg.targets.snapshot.bindingRequired === true,
      bindingRef: bindingRef,
      credentialPolicy: 'NEVER_IN_PAYLOAD',
      requestShape: shapeResult.requestShape,
      blockedReasons: blockedReasons,
      warnings: warnings
    };
  }

  function buildEvaluationContract(input, cfg) {
    var blockedReasons = [];
    var warnings = [];
    var env = isPlainObject(input.transportExecutionEnvelope) ? input.transportExecutionEnvelope : null;
    var evalEnv = (env && isPlainObject(env.evaluationEnvelope)) ? env.evaluationEnvelope : null;

    var sourceReady = evalEnv ? isReadyEnvelope(evalEnv) : false;
    var targetEnabled = cfg.targets.evaluation.enabled === true;
    var bindingRef = cfg.targets.evaluation.bindingRef;
    var bindingResult = validateBindingRef(bindingRef, cfg);
    var bindingValid = bindingResult.valid === true;
    var contractOnly = cfg.contractMode === CONTRACT_MODE.CONTRACT_ONLY;
    var liveNotAllowed = cfg.liveExecutionAllowed !== true;

    if (!sourceReady) blockedReasons.push('SOURCE_ENVELOPE_NOT_READY');
    if (!targetEnabled) blockedReasons.push('CONFIG_DISALLOW_EVALUATION');
    if (!bindingValid) blockedReasons.push((bindingResult.reason || 'BINDING_REF_INVALID') + ':EVALUATION');
    if (!contractOnly) blockedReasons.push('NON_CONTRACT_ONLY_MODE_BLOCKED');
    if (!liveNotAllowed) blockedReasons.push('LIVE_EXECUTION_ALLOWED_BLOCKED');

    var ready = sourceReady && targetEnabled && bindingValid && contractOnly && liveNotAllowed;

    var shapeResult = buildSafeRequestShape(evalEnv, TARGET.EVALUATION_STORE, cfg);
    var sw;
    for (sw = 0; sw < shapeResult.warnings.length; sw++) warnings.push(shapeResult.warnings[sw]);

    return {
      ready: ready,
      target: TARGET.EVALUATION_STORE,
      contractOnly: true,
      bindingRequired: cfg.targets.evaluation.bindingRequired === true,
      bindingRef: bindingRef,
      credentialPolicy: 'NEVER_IN_PAYLOAD',
      requestShape: shapeResult.requestShape,
      blockedReasons: blockedReasons,
      warnings: warnings
    };
  }

  function buildAuditContract(input, cfg) {
    var blockedReasons = [];
    var warnings = [];
    var env = isPlainObject(input.transportExecutionEnvelope) ? input.transportExecutionEnvelope : null;
    var auditEnv = (env && isPlainObject(env.auditEnvelope)) ? env.auditEnvelope : null;

    var sourceReady = auditEnv ? isReadyEnvelope(auditEnv) : false;
    var targetEnabled = cfg.targets.audit.enabled === true;
    var bindingRef = cfg.targets.audit.bindingRef;
    var bindingResult = validateBindingRef(bindingRef, cfg);
    var bindingValid = bindingResult.valid === true;
    var contractOnly = cfg.contractMode === CONTRACT_MODE.CONTRACT_ONLY;
    var liveNotAllowed = cfg.liveExecutionAllowed !== true;

    if (!sourceReady) blockedReasons.push('SOURCE_ENVELOPE_NOT_READY');
    if (!targetEnabled) blockedReasons.push('CONFIG_DISALLOW_AUDIT');
    if (!bindingValid) blockedReasons.push((bindingResult.reason || 'BINDING_REF_INVALID') + ':AUDIT');
    if (!contractOnly) blockedReasons.push('NON_CONTRACT_ONLY_MODE_BLOCKED');
    if (!liveNotAllowed) blockedReasons.push('LIVE_EXECUTION_ALLOWED_BLOCKED');

    var ready = sourceReady && targetEnabled && bindingValid && contractOnly && liveNotAllowed;

    var shapeResult = buildSafeRequestShape(auditEnv, TARGET.AUDIT_STORE, cfg);
    var sw;
    for (sw = 0; sw < shapeResult.warnings.length; sw++) warnings.push(shapeResult.warnings[sw]);

    return {
      ready: ready,
      target: TARGET.AUDIT_STORE,
      contractOnly: true,
      bindingRequired: cfg.targets.audit.bindingRequired === true,
      bindingRef: bindingRef,
      credentialPolicy: 'NEVER_IN_PAYLOAD',
      requestShape: shapeResult.requestShape,
      blockedReasons: blockedReasons,
      warnings: warnings
    };
  }

  // §summary / classify ─────────────────────────────────────────────────

  function buildContractSummary(contracts /*, cfg */) {
    var readyCount = 0;
    var blockedCount = 0;
    var skippedCount = 0;
    var hasReadyTarget = false;
    var hasBlocker = false;

    var keys = ['telegramContract', 'snapshotContract', 'evaluationContract', 'auditContract'];
    var i;
    for (i = 0; i < keys.length; i++) {
      var c = contracts[keys[i]];
      if (!isPlainObject(c)) continue;
      if (c.ready === true) {
        hasReadyTarget = true;
        readyCount += 1;
      } else if (Array.isArray(c.blockedReasons) && c.blockedReasons.length > 0) {
        var realBlock = false;
        var br;
        for (br = 0; br < c.blockedReasons.length; br++) {
          var rc = c.blockedReasons[br];
          if (rc !== 'SOURCE_ENVELOPE_NOT_READY') { realBlock = true; break; }
        }
        if (realBlock) {
          blockedCount += 1;
          hasBlocker = true;
        } else {
          skippedCount += 1;
        }
      } else {
        skippedCount += 1;
      }
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

  function classifyContractStatus(contracts, safety, cfg) {
    // 1. INVALID — transportExecutionEnvelope missing 또는 valid !== true
    if (safety && safety.invalidEnvelope === true) return CONTRACT_STATUS.INVALID;
    if (safety && safety.sourceEnvelopeStatus === 'ENVELOPE_INVALID') return CONTRACT_STATUS.INVALID;

    // 2. BLOCKED — credential / env-like / depth / mode / live / bindingRef credential
    if (safety && safety.credentialBlocked === true) return CONTRACT_STATUS.BLOCKED;
    if (safety && safety.envLikeBlocked === true) return CONTRACT_STATUS.BLOCKED;
    if (safety && safety.depthBlocked === true) return CONTRACT_STATUS.BLOCKED;
    if (safety && safety.bindingRefCredentialPatternBlocked === true) return CONTRACT_STATUS.BLOCKED;
    if (cfg && cfg.contractMode !== CONTRACT_MODE.CONTRACT_ONLY) return CONTRACT_STATUS.BLOCKED;
    if (cfg && cfg.liveExecutionAllowed === true) return CONTRACT_STATUS.BLOCKED;
    if (safety && safety.sourceEnvelopeStatus === 'ENVELOPE_BLOCKED') return CONTRACT_STATUS.BLOCKED;

    var summary = buildContractSummary(contracts);

    // 3. PARTIAL — 일부 ready + 일부 blocked
    if (summary.hasReadyTarget && summary.hasBlocker) return CONTRACT_STATUS.PARTIAL;

    // 4. READY — source READY/PARTIAL + 1개 이상 ready + blocker 0
    if (safety && (safety.sourceEnvelopeStatus === 'ENVELOPE_READY'
                   || safety.sourceEnvelopeStatus === 'ENVELOPE_PARTIAL')
        && summary.hasReadyTarget && !summary.hasBlocker) {
      return CONTRACT_STATUS.READY;
    }

    // 5. SKIPPED — source SKIPPED 또는 모든 ready false + blocker 0
    if (safety && safety.sourceEnvelopeStatus === 'ENVELOPE_SKIPPED') return CONTRACT_STATUS.SKIPPED;
    if (!summary.hasReadyTarget && !summary.hasBlocker) return CONTRACT_STATUS.SKIPPED;

    // 6. UNKNOWN — fallback
    return CONTRACT_STATUS.UNKNOWN;
  }

  // §normalize / target shape lock

  function normalizeContractTarget(contract /*, cfg */) {
    var c = isPlainObject(contract) ? contract : {};
    return {
      ready: c.ready === true,
      target: typeof c.target === 'string' ? c.target : null,
      contractOnly: c.contractOnly !== false,
      bindingRequired: c.bindingRequired !== false,
      bindingRef: typeof c.bindingRef === 'string' ? c.bindingRef : null,
      credentialPolicy: typeof c.credentialPolicy === 'string' ? c.credentialPolicy : 'NEVER_IN_PAYLOAD',
      requestShape: c.requestShape,
      blockedReasons: Array.isArray(c.blockedReasons) ? c.blockedReasons : [],
      warnings: Array.isArray(c.warnings) ? c.warnings : []
    };
  }

  function normalizeSecureTransportExecutorContract(result) {
    return {
      valid: result.valid === true,
      version: result.version,
      contractMode: typeof result.contractMode === 'string' ? result.contractMode : 'CONTRACT_ONLY',
      liveExecutionAllowed: result.liveExecutionAllowed === true,
      contractStatus: typeof result.contractStatus === 'string' ? result.contractStatus : CONTRACT_STATUS.UNKNOWN,
      sourceEnvelopeStatus: typeof result.sourceEnvelopeStatus === 'string' ? result.sourceEnvelopeStatus : null,
      secureBindingPolicy: result.secureBindingPolicy,
      telegramContract: result.telegramContract,
      snapshotContract: result.snapshotContract,
      evaluationContract: result.evaluationContract,
      auditContract: result.auditContract,
      contractSummary: result.contractSummary,
      reasons: Array.isArray(result.reasons) ? result.reasons : [],
      warnings: Array.isArray(result.warnings) ? result.warnings : [],
      debug: result.debug,
      configUsed: result.configUsed
    };
  }

  // §main entry ─────────────────────────────────────────────────────────

  function buildSecureTransportExecutorContract(input, config) {
    var inp = isPlainObject(input) ? input : {};
    var cfg = mergeSecureTransportExecutorContractConfig(config);
    var reasons = [];
    var warnings = [];

    // STEP 1 — INVALID check
    var env = isPlainObject(inp.transportExecutionEnvelope) ? inp.transportExecutionEnvelope : null;
    var invalidEnvelope = (env === null) || (env.valid !== true);
    var sourceEnvelopeStatus = (env && typeof env.envelopeStatus === 'string') ? env.envelopeStatus : null;

    // STEP 2 — credential recursive detection
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

    // STEP 3 — env-like recursive detection
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
      var db;
      for (db = 0; db < envResult.depthBlocks.length; db++) {
        warnings.push('OBJECT_TOO_DEEP_BLOCKED:' + envResult.depthBlocks[db]);
      }
    }

    // STEP 4 — bindingRef credential pattern check (top-level config targets)
    var bindingRefCredBlocked = false;
    var defaultTeleVal = validateBindingRef(cfg.targets.telegram.bindingRef, cfg);
    var defaultSnapVal = validateBindingRef(cfg.targets.snapshot.bindingRef, cfg);
    var defaultEvalVal = validateBindingRef(cfg.targets.evaluation.bindingRef, cfg);
    var defaultAuditVal = validateBindingRef(cfg.targets.audit.bindingRef, cfg);
    if (defaultTeleVal.reason === 'BINDING_REF_CONTAINS_CREDENTIAL_PATTERN') {
      bindingRefCredBlocked = true;
      warnings.push('BINDING_REF_CREDENTIAL_PATTERN:TELEGRAM');
    }
    if (defaultSnapVal.reason === 'BINDING_REF_CONTAINS_CREDENTIAL_PATTERN') {
      bindingRefCredBlocked = true;
      warnings.push('BINDING_REF_CREDENTIAL_PATTERN:SNAPSHOT');
    }
    if (defaultEvalVal.reason === 'BINDING_REF_CONTAINS_CREDENTIAL_PATTERN') {
      bindingRefCredBlocked = true;
      warnings.push('BINDING_REF_CREDENTIAL_PATTERN:EVALUATION');
    }
    if (defaultAuditVal.reason === 'BINDING_REF_CONTAINS_CREDENTIAL_PATTERN') {
      bindingRefCredBlocked = true;
      warnings.push('BINDING_REF_CREDENTIAL_PATTERN:AUDIT');
    }

    // STEP 5 — mode / live gate
    var modeBlocked = (cfg.contractMode !== CONTRACT_MODE.CONTRACT_ONLY);
    var liveBlocked = (cfg.liveExecutionAllowed === true);

    // STEP 6 — base contracts (default SKIPPED — non-ready, blocked reasons populated by gate checks)
    function makeBase(target, bindingRef) {
      var shape;
      if (target === TARGET.TELEGRAM) {
        shape = {
          channelRef: 'SECURE_CHANNEL_REF',
          messageType: 'NONE',
          title: null,
          lines: [],
          payloadSummary: {},
          metadata: {}
        };
      } else if (target === TARGET.SNAPSHOT_STORE) {
        shape = {
          bucketRef: 'SECURE_BUCKET_REF',
          snapshotType: 'NONE',
          keyHint: null,
          payloadSummary: {},
          metadata: {}
        };
      } else if (target === TARGET.EVALUATION_STORE) {
        shape = {
          evaluationType: 'NONE',
          resultType: 'NONE',
          keyHint: null,
          payloadSummary: {},
          metadata: {}
        };
      } else {
        shape = {
          auditType: 'NONE',
          keyHint: null,
          payloadSummary: {},
          metadata: {}
        };
      }
      return {
        ready: false,
        target: target,
        contractOnly: true,
        bindingRequired: true,
        bindingRef: bindingRef,
        credentialPolicy: 'NEVER_IN_PAYLOAD',
        requestShape: shape,
        blockedReasons: [],
        warnings: []
      };
    }

    var teleC = makeBase(TARGET.TELEGRAM, cfg.targets.telegram.bindingRef);
    var snapC = makeBase(TARGET.SNAPSHOT_STORE, cfg.targets.snapshot.bindingRef);
    var evalC = makeBase(TARGET.EVALUATION_STORE, cfg.targets.evaluation.bindingRef);
    var auditC = makeBase(TARGET.AUDIT_STORE, cfg.targets.audit.bindingRef);

    if (invalidEnvelope) {
      reasons.push('TRANSPORT_EXECUTION_ENVELOPE_INVALID');
    } else if (credBlocked) {
      reasons.push('CREDENTIAL_FIELD_DETECTED');
      var cb;
      for (cb = 0; cb < credResult.detections.length; cb++) {
        teleC.blockedReasons.push('SECRET_FIELD_BLOCKED:' + credResult.detections[cb]);
        snapC.blockedReasons.push('SECRET_FIELD_BLOCKED:' + credResult.detections[cb]);
        evalC.blockedReasons.push('SECRET_FIELD_BLOCKED:' + credResult.detections[cb]);
        auditC.blockedReasons.push('SECRET_FIELD_BLOCKED:' + credResult.detections[cb]);
      }
    } else if (envLikeBlocked) {
      reasons.push('ENV_LIKE_OBJECT_DETECTED');
      var eb;
      for (eb = 0; eb < envResult.detections.length; eb++) {
        teleC.blockedReasons.push('ENV_LIKE_OBJECT_DETECTED:' + envResult.detections[eb]);
        snapC.blockedReasons.push('ENV_LIKE_OBJECT_DETECTED:' + envResult.detections[eb]);
        evalC.blockedReasons.push('ENV_LIKE_OBJECT_DETECTED:' + envResult.detections[eb]);
        auditC.blockedReasons.push('ENV_LIKE_OBJECT_DETECTED:' + envResult.detections[eb]);
      }
    } else if (depthBlocked) {
      reasons.push('OBJECT_TOO_DEEP_BLOCKED');
      var dbi;
      for (dbi = 0; dbi < envResult.depthBlocks.length; dbi++) {
        teleC.blockedReasons.push('OBJECT_TOO_DEEP_BLOCKED:' + envResult.depthBlocks[dbi]);
        snapC.blockedReasons.push('OBJECT_TOO_DEEP_BLOCKED:' + envResult.depthBlocks[dbi]);
        evalC.blockedReasons.push('OBJECT_TOO_DEEP_BLOCKED:' + envResult.depthBlocks[dbi]);
        auditC.blockedReasons.push('OBJECT_TOO_DEEP_BLOCKED:' + envResult.depthBlocks[dbi]);
      }
    } else if (bindingRefCredBlocked) {
      reasons.push('BINDING_REF_CREDENTIAL_PATTERN');
      teleC.blockedReasons.push('BINDING_REF_CREDENTIAL_PATTERN');
      snapC.blockedReasons.push('BINDING_REF_CREDENTIAL_PATTERN');
      evalC.blockedReasons.push('BINDING_REF_CREDENTIAL_PATTERN');
      auditC.blockedReasons.push('BINDING_REF_CREDENTIAL_PATTERN');
    } else if (modeBlocked) {
      reasons.push('NON_CONTRACT_ONLY_MODE_BLOCKED');
      teleC.blockedReasons.push('NON_CONTRACT_ONLY_MODE_BLOCKED');
      snapC.blockedReasons.push('NON_CONTRACT_ONLY_MODE_BLOCKED');
      evalC.blockedReasons.push('NON_CONTRACT_ONLY_MODE_BLOCKED');
      auditC.blockedReasons.push('NON_CONTRACT_ONLY_MODE_BLOCKED');
    } else if (liveBlocked) {
      reasons.push('LIVE_EXECUTION_ALLOWED_BLOCKED');
      teleC.blockedReasons.push('LIVE_EXECUTION_ALLOWED_BLOCKED');
      snapC.blockedReasons.push('LIVE_EXECUTION_ALLOWED_BLOCKED');
      evalC.blockedReasons.push('LIVE_EXECUTION_ALLOWED_BLOCKED');
      auditC.blockedReasons.push('LIVE_EXECUTION_ALLOWED_BLOCKED');
    } else if (sourceEnvelopeStatus === 'ENVELOPE_BLOCKED') {
      reasons.push('SOURCE_ENVELOPE_BLOCKED');
      teleC.blockedReasons.push('SOURCE_ENVELOPE_BLOCKED');
      snapC.blockedReasons.push('SOURCE_ENVELOPE_BLOCKED');
      evalC.blockedReasons.push('SOURCE_ENVELOPE_BLOCKED');
      auditC.blockedReasons.push('SOURCE_ENVELOPE_BLOCKED');
    } else {
      // STEP 7 — normal contract builds
      teleC = buildTelegramContract(inp, cfg);
      snapC = buildSnapshotContract(inp, cfg);
      evalC = buildEvaluationContract(inp, cfg);
      auditC = buildAuditContract(inp, cfg);
    }

    // STEP 8 — normalize each contract shape
    teleC = normalizeContractTarget(teleC, cfg);
    snapC = normalizeContractTarget(snapC, cfg);
    evalC = normalizeContractTarget(evalC, cfg);
    auditC = normalizeContractTarget(auditC, cfg);

    // STEP 9 — summary + classify
    var contracts = {
      telegramContract: teleC,
      snapshotContract: snapC,
      evaluationContract: evalC,
      auditContract: auditC
    };
    var summary = buildContractSummary(contracts);
    var safetyFlags = {
      invalidEnvelope: invalidEnvelope,
      sourceEnvelopeStatus: sourceEnvelopeStatus,
      credentialBlocked: credBlocked,
      envLikeBlocked: envLikeBlocked,
      depthBlocked: depthBlocked,
      bindingRefCredentialPatternBlocked: bindingRefCredBlocked,
      modeBlocked: modeBlocked,
      liveBlocked: liveBlocked
    };
    var contractStatus = classifyContractStatus(contracts, safetyFlags, cfg);

    // STEP 10 — top-level reasons
    if (contractStatus === CONTRACT_STATUS.READY) reasons.push('CONTRACT_READY');
    if (contractStatus === CONTRACT_STATUS.PARTIAL) reasons.push('CONTRACT_PARTIAL');
    if (contractStatus === CONTRACT_STATUS.SKIPPED) reasons.push('CONTRACT_SKIPPED');
    if (contractStatus === CONTRACT_STATUS.UNKNOWN) reasons.push('CONTRACT_UNKNOWN_FALLBACK');
    if (teleC.ready) reasons.push('TELEGRAM_CONTRACT_READY');
    if (snapC.ready) reasons.push('SNAPSHOT_CONTRACT_READY');
    if (evalC.ready) reasons.push('EVALUATION_CONTRACT_READY');
    if (auditC.ready) reasons.push('AUDIT_CONTRACT_READY');

    // STEP 11 — secureBindingPolicy fixed contract (no credential / env-related dynamic fields)
    var secureBindingPolicy = {
      credentialSource: 'SECURE_BINDING_ONLY',
      credentialInPayloadAllowed: false,
      credentialInEnvelopeAllowed: false,
      envReadAllowed: false,
      directSecretAccessAllowed: false,
      liveExecutionRequiresExplicitGate: true
    };

    // STEP 12 — configUsed scalar/shallow snapshot
    var configUsed = {
      version: cfg.version,
      contractMode: cfg.contractMode,
      liveExecutionAllowed: cfg.liveExecutionAllowed,
      targets: {
        telegram: {
          enabled: cfg.targets.telegram.enabled,
          bindingRequired: cfg.targets.telegram.bindingRequired,
          bindingRef: cfg.targets.telegram.bindingRef
        },
        snapshot: {
          enabled: cfg.targets.snapshot.enabled,
          bindingRequired: cfg.targets.snapshot.bindingRequired,
          bindingRef: cfg.targets.snapshot.bindingRef
        },
        evaluation: {
          enabled: cfg.targets.evaluation.enabled,
          bindingRequired: cfg.targets.evaluation.bindingRequired,
          bindingRef: cfg.targets.evaluation.bindingRef
        },
        audit: {
          enabled: cfg.targets.audit.enabled,
          bindingRequired: cfg.targets.audit.bindingRequired,
          bindingRef: cfg.targets.audit.bindingRef
        }
      },
      safety: {
        blockCredentialFields: cfg.safety.blockCredentialFields,
        credentialMaxDepth: cfg.safety.credentialMaxDepth,
        credentialAllowListSize: cfg.safety.credentialAllowList.length,
        bindingRefAllowListSize: cfg.safety.bindingRefAllowList.length,
        blockEnvLikeObjects: cfg.safety.blockEnvLikeObjects,
        blockObjectTooDeep: cfg.safety.blockObjectTooDeep,
        allowRawPayload: cfg.safety.allowRawPayload,
        allowLiveExecution: cfg.safety.allowLiveExecution,
        allowEnvRead: cfg.safety.allowEnvRead,
        allowDirectSecretAccess: cfg.safety.allowDirectSecretAccess
      },
      requestShape: {
        maxStringLength: cfg.requestShape.maxStringLength,
        payloadSummaryAllowedFieldCount: cfg.requestShape.payloadSummaryAllowedFields.length,
        metadataAllowedFieldCount: cfg.requestShape.metadataAllowedFields.length
      },
      wording: {
        sanitizeMode: cfg.wording.sanitizeMode
      }
    };

    var draft = {
      valid: invalidEnvelope ? false : true,
      version: SECURE_CONTRACT_VERSION,
      contractMode: cfg.contractMode === CONTRACT_MODE.CONTRACT_ONLY ? 'CONTRACT_ONLY' : cfg.contractMode,
      liveExecutionAllowed: cfg.liveExecutionAllowed === true,
      contractStatus: contractStatus,
      sourceEnvelopeStatus: sourceEnvelopeStatus,
      secureBindingPolicy: secureBindingPolicy,
      telegramContract: teleC,
      snapshotContract: snapC,
      evaluationContract: evalC,
      auditContract: auditC,
      contractSummary: summary,
      reasons: reasons,
      warnings: warnings,
      debug: {
        source: 'transportExecutionEnvelope + transportPlan + rendererBinding + operationPacket + activeCycleDecision + evaluationOutcome + externalConfluence',
        configVersion: cfg.version,
        invalidEnvelope: invalidEnvelope,
        credentialBlocked: credBlocked,
        envLikeBlocked: envLikeBlocked,
        depthBlocked: depthBlocked,
        bindingRefCredentialPatternBlocked: bindingRefCredBlocked,
        modeBlocked: modeBlocked,
        liveBlocked: liveBlocked,
        credentialDetections: credResult.detections.length,
        envLikeDetections: envResult.detections.length,
        objectTooDeepDetections: envResult.depthBlocks.length
      },
      configUsed: configUsed
    };
    return normalizeSecureTransportExecutorContract(draft);
  }

  // §export ──────────────────────────────────────────────────────────────

  var api = Object.freeze({
    VERSION: SECURE_CONTRACT_VERSION,
    DEFAULT_SECURE_TRANSPORT_EXECUTOR_CONTRACT_CONFIG: DEFAULT_SECURE_TRANSPORT_EXECUTOR_CONTRACT_CONFIG,
    CONTRACT_MODE: CONTRACT_MODE,
    CONTRACT_STATUS: CONTRACT_STATUS,
    TARGET: TARGET,
    WORDING_SANITIZE_MODE: WORDING_SANITIZE_MODE,
    build: buildSecureTransportExecutorContract,
    mergeSecureTransportExecutorContractConfig: mergeSecureTransportExecutorContractConfig,
    buildTelegramContract: buildTelegramContract,
    buildSnapshotContract: buildSnapshotContract,
    buildEvaluationContract: buildEvaluationContract,
    buildAuditContract: buildAuditContract,
    buildSafeRequestShape: buildSafeRequestShape,
    classifyContractStatus: classifyContractStatus,
    detectCredentialFields: detectCredentialFields,
    detectEnvLikeObjects: detectEnvLikeObjects,
    validateBindingRef: validateBindingRef
  });

  global.WS3_SecureTransportExecutorContract = api;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
