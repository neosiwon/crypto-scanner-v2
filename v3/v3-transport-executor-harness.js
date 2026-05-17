/**
 * WS3 v0.15.0 — TransportExecutorHarness (Dry-Run Harness)
 *
 * Scope:
 *   secureTransportExecutorContract (v0.14.0) + transportExecutionEnvelope (v0.13.0) +
 *   transportPlan (v0.12.0) + rendererBinding (v0.12.0) + operationPacket (v0.8.0) +
 *   activeCycleDecision (v0.9.0) + evaluationOutcome (v0.10.0) + externalConfluence (v0.11.0)
 *   → standalone TransportExecutorHarness (DRY_RUN_HARNESS, dry-run only)
 *
 * 단일 기준 문서:
 *   docs/ws3/WS3_CODE_CONTRACT.md (b-r2 박제본)
 *
 * 확정 DP 정책 (Gate 2 spec):
 *   DP-HARNESS1   dry-run harness 만. 실제 발송 / 저장 / 호출 X.
 *   DP-HARNESS2   secureTransportExecutorContract ready/status 결정을 true 로 override 금지.
 *   DP-HARNESS3   harnessMode DRY_RUN_HARNESS only. LIVE / REAL / EXECUTE → HARNESS_BLOCKED.
 *   DP-HARNESS4   liveExecutionAllowed / sideEffectAllowed / fetchAllowed / writeAllowed /
 *                 credentialLookupAllowed 중 하나라도 true → HARNESS_BLOCKED (hard block).
 *   DP-HARNESS5   perTargetGate.allow 항상 false 기본. allow=true 시도 HARNESS_BLOCKED.
 *   DP-HARNESS6   credential 값 / process.env / env 객체 / secure binding value 읽기 0건.
 *                 env-like object 가 input/config 로 들어오면 즉시 HARNESS_BLOCKED.
 *                 credential 9키 재귀 검사 (case-insensitive + partial + depth 5).
 *   DP-HARNESS7   requestShape / payloadSummary / metadata whitelist scalar 만.
 *                 원본 객체 spread / Object.assign / deep clone / for-in 금지.
 *                 v0.14 contract 의 requestShape / payloadSummary / metadata 도 재검증.
 *   DP-HARNESS8   dry-run wording 만. 발송됨 / sent / delivered / 손절 / 익절 / take profit 등 금지.
 *   DP-HARNESS9   8종 입력 (secureTransportExecutorContract + transportExecutionEnvelope +
 *                 transportPlan + rendererBinding + operationPacket + activeCycleDecision +
 *                 evaluationOutcome + externalConfluence) read-only.
 *   DP-HARNESS10  신규 파일 1개 + 문서 갱신만. 보호 파일 25종 수정 금지.
 *
 * N-HARNESS-OBS 처리:
 *   N-HARNESS-OBS-1  보호 baseline false-positive — 본 모듈 fetch / Date.now / new Date /
 *                    performance.now / Object.assign / spread / deep clone / for-in 0건.
 *   N-HARNESS-OBS-2  r0.1 폐기 naming residue 0건 — RealTransportExecutor* / *Execution /
 *                    EXECUTOR_* / classifyExecutorStatus 등 폐기 명명 미사용.
 *   N-HARNESS-OBS-3  v0.14 contract shape 정합 — telegramContract/snapshotContract/
 *                    evaluationContract/auditContract.ready 와 contractStatus 참조.
 *                    ready/status 결정 override 금지.
 *   N-HARNESS-OBS-4  buildSafePayloadSummary / buildSafeMetadata 동명 함수 — IIFE
 *                    module-private 으로 정의. global export 미포함. v0.13/v0.14 와 파일 scope 분리.
 *   N-HARNESS-OBS-5  validateBindingRef 동명 함수 — v0.15 IIFE 내부 private 함수로 재정의.
 *                    global namespace 는 WS3_TransportExecutorHarness 만 노출.
 *   N-HARNESS-OBS-6  보호 파일 25종 — v0.14 commit (644c525) 이후 v3/v3-secure-transport-
 *                    executor-contract.js 추가. v0.15 본체 작성 시 25종 무손상 보장.
 *
 * 출력 (top-level):
 *   valid, version, harnessMode, liveExecutionAllowed, harnessStatus, sourceContractStatus,
 *   harnessPolicy, telegramHarness, snapshotHarness, evaluationHarness, auditHarness,
 *   harnessSummary, reasons[], warnings[], debug, configUsed
 *
 * harnessStatus 6 후보 (first-match-wins):
 *   HARNESS_INVALID  → secureTransportExecutorContract missing 또는 valid !== true
 *   HARNESS_BLOCKED  → source CONTRACT_BLOCKED/INVALID, credential 감지, env-like 감지,
 *                      harnessMode!==DRY_RUN_HARNESS, hard-block 5 booleans true,
 *                      perTargetGate.allow=true
 *   HARNESS_PARTIAL  → ≥1 ready true + ≥1 blocker
 *   HARNESS_READY    → source CONTRACT_READY/PARTIAL + ≥1 ready true + blocker 0
 *   HARNESS_SKIPPED  → source CONTRACT_SKIPPED, 또는 모든 ready false + blocker 0
 *   HARNESS_UNKNOWN  → fallback
 *
 * 의도된 미구현 (이번 단계 제외):
 *   실제 Telegram bot API 호출 / chatId / botToken / webhookUrl 노출.
 *   실제 KV write / DB persist / 파일 IO / 브라우저 storage.
 *   실제 fetch / 외부 호출 / endpoint URL.
 *   실제 rate limit / circuit breaker 실행 (contract object only).
 *   실제 DOM 렌더 / HTML attach / addEventListener.
 *   실제 env 접근 / process.env / Cloudflare env 객체 / secret binding 값 읽기.
 *   입력 객체 mutation.
 *   런타임 clock API (Date.now / new Date / performance.now).
 *   raw payload / payload.raw / identityInput / raw.builderDebug 노출.
 *   dryRunResult.wouldExecute=true.
 *
 * 함수 목록 (§14 spec):
 *   mergeTransportExecutorHarnessConfig(config)
 *   buildTransportExecutorHarness(input, config)        ← 진입점
 *   buildTelegramHarness(input, cfg)
 *   buildSnapshotHarness(input, cfg)
 *   buildEvaluationHarness(input, cfg)
 *   buildAuditHarness(input, cfg)
 *   buildDryRunResult(contract, target, cfg)
 *   buildPerTargetGate(target, cfg)
 *   buildRateLimitContract(target, cfg)
 *   buildCircuitBreakerContract(target, cfg)
 *   buildSafeRequestShape(contract, target, cfg)
 *   buildSafePayloadSummary(input, cfg)                 ← IIFE module-private
 *   buildSafeMetadata(input, cfg)                       ← IIFE module-private
 *   buildHarnessSummary(harnesses, cfg)
 *   classifyHarnessStatus(harnesses, safety, cfg)
 *   detectCredentialFields(input, config)
 *   detectEnvLikeObjects(input, config)
 *   validateBindingRef(bindingRef, cfg)
 *   sanitizeMessageLines(lines, cfg)
 *   normalizeHarnessTarget(target, cfg)
 *   normalizeTransportExecutorHarness(result)
 *   isPlainObject, safeString, safeNumber, pushReason, pushWarning
 *
 * export:
 *   global.WS3_TransportExecutorHarness + module.exports
 */
(function(global) {
  'use strict';

  // §version
  var HARNESS_VERSION = 'WS3_v0.15.0_transport_executor_harness';

  // §harnessMode (only DRY_RUN_HARNESS allowed)
  var HARNESS_MODE = Object.freeze({
    DRY_RUN_HARNESS: 'DRY_RUN_HARNESS'
  });

  // §harnessStatus 6 후보
  var HARNESS_STATUS = Object.freeze({
    READY: 'HARNESS_READY',
    SKIPPED: 'HARNESS_SKIPPED',
    BLOCKED: 'HARNESS_BLOCKED',
    PARTIAL: 'HARNESS_PARTIAL',
    INVALID: 'HARNESS_INVALID',
    UNKNOWN: 'HARNESS_UNKNOWN'
  });

  // §target enum (logical only)
  var TARGET = Object.freeze({
    TELEGRAM: 'TELEGRAM',
    SNAPSHOT_STORE: 'SNAPSHOT_STORE',
    EVALUATION_STORE: 'EVALUATION_STORE',
    AUDIT_STORE: 'AUDIT_STORE'
  });

  // §action enum (dryRunResult.action only — no actual execution)
  var ACTION = Object.freeze({
    TELEGRAM_SEND: 'TELEGRAM_SEND',
    SNAPSHOT_WRITE: 'SNAPSHOT_WRITE',
    EVALUATION_WRITE: 'EVALUATION_WRITE',
    AUDIT_WRITE: 'AUDIT_WRITE'
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

  // §RESERVED 프레임워크 metadata 키 — N-HARNESS-OBS 정합 (v0.13/v0.14/v0.15 framework metadata)
  //   v0.13/v0.14/v0.15 envelope/contract/harness output 의 자체 정책 metadata field 중
  //   credential keyword substring 을 포함하지만 실제 credential value 가 아닌 것들.
  //   exact match 로 차단 제외 (v0.14 N-SEC-OBS-4 + v0.15 N-HARNESS-OBS 확장).
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
    'bindingRefCredentialPatternBlocked'
  ]);

  // §env-like 금지 키 (exact match + value is object — r0.2 §6.2 false-positive 완화)
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

  // §bindingRef 금지 substring (literal)
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

  // §forbidden wording (DP-HARNESS8)
  //   금지: trading wording (손절/익절/수익 확정/매수 성공 등)
  //   금지: transmission completion (발송됨/저장됨/전송 완료/sent/delivered/completed transmission)
  //   매칭 방식: exact phrase substring (case-insensitive).
  //   예: "전송 완료" 전체 phrase 차단 / "전송" 단독 차단 X / "전송 후보" 허용.
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

  // §DEFAULT_CONFIG (§13)
  var DEFAULT_TRANSPORT_EXECUTOR_HARNESS_CONFIG = Object.freeze({
    version: 'inline-default-v0',
    harnessMode: 'DRY_RUN_HARNESS',
    liveExecutionAllowed: false,
    sideEffectAllowed: false,
    fetchAllowed: false,
    writeAllowed: false,
    credentialLookupAllowed: false,
    targets: Object.freeze({
      telegram: Object.freeze({
        enabled: true,
        rateLimitContract: null,
        circuitBreakerContract: null
      }),
      snapshot: Object.freeze({
        enabled: true,
        rateLimitContract: null,
        circuitBreakerContract: null
      }),
      evaluation: Object.freeze({
        enabled: true,
        rateLimitContract: null,
        circuitBreakerContract: null
      }),
      audit: Object.freeze({
        enabled: true,
        rateLimitContract: null,
        circuitBreakerContract: null
      })
    }),
    perTargetGate: Object.freeze({
      allow: false,
      reason: 'DRY_RUN_HARNESS_ONLY'
    }),
    rateLimitContract: Object.freeze({
      enabled: true,
      windowMs: 60000,
      maxAttempts: 1
    }),
    circuitBreakerContract: Object.freeze({
      enabled: true,
      state: 'OPEN_IN_DRY_RUN',
      failureThreshold: 1
    }),
    safety: Object.freeze({
      blockCredentialFields: true,
      credentialMaxDepth: 5,
      credentialAllowList: Object.freeze([]),
      blockEnvLikeObjects: true,
      blockObjectTooDeep: true,
      allowRawPayload: false,
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
  function mergeTransportExecutorHarnessConfig(config) {
    var c = isPlainObject(config) ? config : {};
    var d = DEFAULT_TRANSPORT_EXECUTOR_HARNESS_CONFIG;

    var tg = isPlainObject(c.targets) ? c.targets : {};
    var sf = isPlainObject(c.safety) ? c.safety : {};
    var rs = isPlainObject(c.requestShape) ? c.requestShape : {};
    var wd = isPlainObject(c.wording) ? c.wording : {};
    var db = isPlainObject(c.debug) ? c.debug : {};
    var pg = isPlainObject(c.perTargetGate) ? c.perTargetGate : {};
    var rl = isPlainObject(c.rateLimitContract) ? c.rateLimitContract : {};
    var cb = isPlainObject(c.circuitBreakerContract) ? c.circuitBreakerContract : {};

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

    function normalizePerTargetOverride(src) {
      if (!isPlainObject(src)) return null;
      return src; // keep object — buildRateLimitContract / buildCircuitBreakerContract 가 자체 검증
    }

    // top-level rateLimitContract / circuitBreakerContract (field-by-field)
    var topRL = {
      enabled: rl.enabled !== false,
      windowMs: (typeof rl.windowMs === 'number' && isFinite(rl.windowMs) && rl.windowMs > 0) ? rl.windowMs : d.rateLimitContract.windowMs,
      maxAttempts: (typeof rl.maxAttempts === 'number' && isFinite(rl.maxAttempts) && rl.maxAttempts > 0) ? rl.maxAttempts : d.rateLimitContract.maxAttempts
    };
    var topCB = {
      enabled: cb.enabled !== false,
      state: (typeof cb.state === 'string' && cb.state.length > 0) ? cb.state : d.circuitBreakerContract.state,
      failureThreshold: (typeof cb.failureThreshold === 'number' && isFinite(cb.failureThreshold) && cb.failureThreshold > 0) ? cb.failureThreshold : d.circuitBreakerContract.failureThreshold
    };

    return {
      version: (typeof c.version === 'string' && c.version.length > 0) ? c.version : d.version,
      harnessMode: (typeof c.harnessMode === 'string' && c.harnessMode.length > 0) ? c.harnessMode : d.harnessMode,
      liveExecutionAllowed: c.liveExecutionAllowed === true,
      sideEffectAllowed: c.sideEffectAllowed === true,
      fetchAllowed: c.fetchAllowed === true,
      writeAllowed: c.writeAllowed === true,
      credentialLookupAllowed: c.credentialLookupAllowed === true,
      targets: {
        telegram: {
          enabled: tgTele.enabled !== false,
          rateLimitContract: normalizePerTargetOverride(tgTele.rateLimitContract),
          circuitBreakerContract: normalizePerTargetOverride(tgTele.circuitBreakerContract)
        },
        snapshot: {
          enabled: tgSnap.enabled !== false,
          rateLimitContract: normalizePerTargetOverride(tgSnap.rateLimitContract),
          circuitBreakerContract: normalizePerTargetOverride(tgSnap.circuitBreakerContract)
        },
        evaluation: {
          enabled: tgEval.enabled !== false,
          rateLimitContract: normalizePerTargetOverride(tgEval.rateLimitContract),
          circuitBreakerContract: normalizePerTargetOverride(tgEval.circuitBreakerContract)
        },
        audit: {
          enabled: tgAudit.enabled !== false,
          rateLimitContract: normalizePerTargetOverride(tgAudit.rateLimitContract),
          circuitBreakerContract: normalizePerTargetOverride(tgAudit.circuitBreakerContract)
        }
      },
      perTargetGate: {
        allow: pg.allow === true,
        reason: (typeof pg.reason === 'string' && pg.reason.length > 0) ? pg.reason : d.perTargetGate.reason
      },
      rateLimitContract: topRL,
      circuitBreakerContract: topCB,
      safety: {
        blockCredentialFields: sf.blockCredentialFields !== false,
        credentialMaxDepth: maxDepth,
        credentialAllowList: credAllow,
        blockEnvLikeObjects: sf.blockEnvLikeObjects !== false,
        blockObjectTooDeep: sf.blockObjectTooDeep !== false,
        allowRawPayload: sf.allowRawPayload === true,
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
    // 1. RESERVED 프레임워크 metadata 자동 차단 제외 (N-HARNESS-OBS / v0.14 N-SEC-OBS-4 동일 패턴)
    var r;
    for (r = 0; r < RESERVED_FRAMEWORK_METADATA_KEYS.length; r++) {
      if (RESERVED_FRAMEWORK_METADATA_KEYS[r] === keyName) return false;
    }
    // 2. user-provided allowList
    if (Array.isArray(allowList)) {
      var a;
      for (a = 0; a < allowList.length; a++) {
        if (allowList[a] === keyName) return false;
      }
    }
    // 3. 9키 partial substring match (case-insensitive)
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
    var cfg = mergeTransportExecutorHarnessConfig(config);
    var detections = [];
    var depthWarnings = [];

    if (cfg.safety.blockCredentialFields !== true) {
      return { detections: detections, depthWarnings: depthWarnings };
    }

    function walk(value, path, depth) {
      // scalar leaf 안전 (depth 무관)
      if (!isPlainObject(value) && !Array.isArray(value)) return;
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

  function detectEnvLikeObjects(input, config) {
    var cfg = mergeTransportExecutorHarnessConfig(config);
    var detections = [];
    var depthBlocks = [];

    if (cfg.safety.blockEnvLikeObjects !== true) {
      return { detections: detections, depthBlocks: depthBlocks };
    }

    function walk(value, path, depth) {
      if (!isPlainObject(value) && !Array.isArray(value)) return;
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

  // §validateBindingRef (N-HARNESS-OBS-5 — IIFE private 재정의)

  var BINDING_REF_PATTERN = /^[A-Z][A-Z0-9_]*$/;

  function validateBindingRef(bindingRef, cfg) {
    var allowList = (cfg && cfg.safety && Array.isArray(cfg.safety.bindingRefAllowList))
      ? cfg.safety.bindingRefAllowList
      : [];
    if (Array.isArray(allowList)) {
      var a;
      for (a = 0; a < allowList.length; a++) {
        if (allowList[a] === bindingRef) return { valid: true, reason: null };
      }
    }
    if (typeof bindingRef !== 'string') return { valid: false, reason: 'BINDING_REF_INVALID_FORMAT' };
    if (bindingRef.length < 3 || bindingRef.length > 64) return { valid: false, reason: 'BINDING_REF_INVALID_FORMAT' };
    if (!BINDING_REF_PATTERN.test(bindingRef)) return { valid: false, reason: 'BINDING_REF_INVALID_FORMAT' };
    var i;
    for (i = 0; i < BINDING_REF_FORBIDDEN_SUBSTRINGS.length; i++) {
      if (bindingRef.indexOf(BINDING_REF_FORBIDDEN_SUBSTRINGS[i]) !== -1) {
        return { valid: false, reason: 'BINDING_REF_INVALID_FORMAT' };
      }
    }
    if (/bot[0-9]+/i.test(bindingRef)) return { valid: false, reason: 'BINDING_REF_INVALID_FORMAT' };
    if (/^[0-9]+$/.test(bindingRef)) return { valid: false, reason: 'BINDING_REF_INVALID_FORMAT' };
    if (isCredentialKey(bindingRef, allowList)) return { valid: false, reason: 'BINDING_REF_CONTAINS_CREDENTIAL_PATTERN' };
    return { valid: true, reason: null };
  }

  // §wording sanitize (exact phrase substring match, case-insensitive)

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

  // detect credential pattern in raw text line (e.g. URL with token)
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
      // credential pattern 우선 차단 (CREDENTIAL_IN_LINE_REJECTED)
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

  // §payloadSummary / metadata revalidation (DP-HARNESS7 — v0.14 신뢰 X)

  function buildSafePayloadSummary(contractSummary, cfg) {
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

    if (!isPlainObject(contractSummary)) return { summary: out, warnings: warnings };

    var i;
    for (i = 0; i < allowed.length; i++) {
      var fld = allowed[i];
      if (typeof fld !== 'string' || fld.length === 0) continue;
      if (isCredentialKey(fld, allowList)) {
        warnings.push('CREDENTIAL_FIELD_REJECTED:' + fld);
        continue;
      }
      if (Object.prototype.hasOwnProperty.call(contractSummary, fld) === false) {
        out[fld] = null;
        continue;
      }
      var v = contractSummary[fld];
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

  function buildSafeMetadata(contractMetadata, cfg) {
    var warnings = [];
    var out = {};
    var allowed = (cfg && cfg.requestShape && Array.isArray(cfg.requestShape.metadataAllowedFields))
      ? cfg.requestShape.metadataAllowedFields
      : [];
    if (allowed.length === 0) return { metadata: out, warnings: warnings };
    if (!isPlainObject(contractMetadata)) return { metadata: out, warnings: warnings };

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
      if (Object.prototype.hasOwnProperty.call(contractMetadata, fld) === false) continue;
      var v = contractMetadata[fld];
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

  // buildSafeRequestShape — v0.14 contract.requestShape 재검증
  function buildSafeRequestShape(contract, targetType, cfg) {
    var warnings = [];
    var c = isPlainObject(contract) ? contract : {};
    var cReq = isPlainObject(c.requestShape) ? c.requestShape : {};
    var cSummary = isPlainObject(cReq.payloadSummary) ? cReq.payloadSummary : {};
    var cMeta = isPlainObject(cReq.metadata) ? cReq.metadata : {};

    var sumResult = buildSafePayloadSummary(cSummary, cfg);
    var i;
    for (i = 0; i < sumResult.warnings.length; i++) warnings.push(sumResult.warnings[i]);

    var metaResult = buildSafeMetadata(cMeta, cfg);
    var m;
    for (m = 0; m < metaResult.warnings.length; m++) warnings.push(metaResult.warnings[m]);

    var maxLen = (cfg && cfg.requestShape && typeof cfg.requestShape.maxStringLength === 'number')
      ? cfg.requestShape.maxStringLength : 200;

    var requestShape;
    if (targetType === TARGET.TELEGRAM) {
      var lines = [];
      if (Array.isArray(cReq.lines)) {
        var s = sanitizeMessageLines(cReq.lines, cfg);
        var li;
        for (li = 0; li < s.warnings.length; li++) warnings.push(s.warnings[li]);
        lines = s.lines;
      }
      requestShape = {
        channelRef: 'SECURE_CHANNEL_REF',
        messageType: (typeof cReq.messageType === 'string') ? safeString(cReq.messageType, maxLen) : 'NONE',
        title: (typeof cReq.title === 'string') ? safeString(cReq.title, maxLen) : null,
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
        snapshotType: (typeof cReq.snapshotType === 'string') ? safeString(cReq.snapshotType, maxLen) : 'NONE',
        keyHint: (typeof cReq.keyHint === 'string') ? safeString(cReq.keyHint, maxLen) : null,
        payloadSummary: sumResult.summary,
        metadata: metaResult.metadata
      };
      if (requestShape.snapshotType === null) requestShape.snapshotType = 'NONE';
      return { requestShape: requestShape, warnings: warnings };
    }
    if (targetType === TARGET.EVALUATION_STORE) {
      requestShape = {
        evaluationType: (typeof cReq.evaluationType === 'string') ? safeString(cReq.evaluationType, maxLen) : 'NONE',
        resultType: (typeof cReq.resultType === 'string') ? safeString(cReq.resultType, maxLen) : 'NONE',
        keyHint: (typeof cReq.keyHint === 'string') ? safeString(cReq.keyHint, maxLen) : null,
        payloadSummary: sumResult.summary,
        metadata: metaResult.metadata
      };
      if (requestShape.evaluationType === null) requestShape.evaluationType = 'NONE';
      if (requestShape.resultType === null) requestShape.resultType = 'NONE';
      return { requestShape: requestShape, warnings: warnings };
    }
    if (targetType === TARGET.AUDIT_STORE) {
      requestShape = {
        auditType: (typeof cReq.auditType === 'string') ? safeString(cReq.auditType, maxLen) : 'NONE',
        keyHint: (typeof cReq.keyHint === 'string') ? safeString(cReq.keyHint, maxLen) : null,
        payloadSummary: sumResult.summary,
        metadata: metaResult.metadata
      };
      if (requestShape.auditType === null) requestShape.auditType = 'NONE';
      return { requestShape: requestShape, warnings: warnings };
    }
    return { requestShape: { payloadSummary: sumResult.summary, metadata: metaResult.metadata }, warnings: warnings };
  }

  // §rate limit / circuit breaker contract builders

  function buildRateLimitContract(targetType, cfg) {
    var top = cfg.rateLimitContract;
    var perTarget = null;
    if (targetType === TARGET.TELEGRAM && cfg.targets.telegram.rateLimitContract) perTarget = cfg.targets.telegram.rateLimitContract;
    if (targetType === TARGET.SNAPSHOT_STORE && cfg.targets.snapshot.rateLimitContract) perTarget = cfg.targets.snapshot.rateLimitContract;
    if (targetType === TARGET.EVALUATION_STORE && cfg.targets.evaluation.rateLimitContract) perTarget = cfg.targets.evaluation.rateLimitContract;
    if (targetType === TARGET.AUDIT_STORE && cfg.targets.audit.rateLimitContract) perTarget = cfg.targets.audit.rateLimitContract;

    var enabled = (perTarget && perTarget.enabled === false) ? false : (top.enabled !== false);
    var windowMs = (perTarget && typeof perTarget.windowMs === 'number' && isFinite(perTarget.windowMs) && perTarget.windowMs > 0)
      ? perTarget.windowMs : top.windowMs;
    var maxAttempts = (perTarget && typeof perTarget.maxAttempts === 'number' && isFinite(perTarget.maxAttempts) && perTarget.maxAttempts > 0)
      ? perTarget.maxAttempts : top.maxAttempts;
    return {
      enabled: enabled,
      key: targetType,
      windowMs: windowMs,
      maxAttempts: maxAttempts
    };
  }

  function buildCircuitBreakerContract(targetType, cfg) {
    var top = cfg.circuitBreakerContract;
    var perTarget = null;
    if (targetType === TARGET.TELEGRAM && cfg.targets.telegram.circuitBreakerContract) perTarget = cfg.targets.telegram.circuitBreakerContract;
    if (targetType === TARGET.SNAPSHOT_STORE && cfg.targets.snapshot.circuitBreakerContract) perTarget = cfg.targets.snapshot.circuitBreakerContract;
    if (targetType === TARGET.EVALUATION_STORE && cfg.targets.evaluation.circuitBreakerContract) perTarget = cfg.targets.evaluation.circuitBreakerContract;
    if (targetType === TARGET.AUDIT_STORE && cfg.targets.audit.circuitBreakerContract) perTarget = cfg.targets.audit.circuitBreakerContract;

    var enabled = (perTarget && perTarget.enabled === false) ? false : (top.enabled !== false);
    // v0.15.0 — state 는 OPEN_IN_DRY_RUN 강제 (DP-HARNESS1)
    var state = 'OPEN_IN_DRY_RUN';
    var failureThreshold = (perTarget && typeof perTarget.failureThreshold === 'number' && isFinite(perTarget.failureThreshold) && perTarget.failureThreshold > 0)
      ? perTarget.failureThreshold : top.failureThreshold;
    return {
      enabled: enabled,
      state: state,
      failureThreshold: failureThreshold
    };
  }

  function buildPerTargetGate(/* targetType, */ cfg) {
    // v0.15.0 — perTargetGate.allow 항상 false 강제 (DP-HARNESS5)
    return {
      allow: false,
      reason: (cfg && cfg.perTargetGate && typeof cfg.perTargetGate.reason === 'string')
        ? cfg.perTargetGate.reason
        : 'DRY_RUN_HARNESS_ONLY'
    };
  }

  function buildDryRunResult(contract, targetType /*, cfg */) {
    var action;
    if (targetType === TARGET.TELEGRAM) action = ACTION.TELEGRAM_SEND;
    else if (targetType === TARGET.SNAPSHOT_STORE) action = ACTION.SNAPSHOT_WRITE;
    else if (targetType === TARGET.EVALUATION_STORE) action = ACTION.EVALUATION_WRITE;
    else if (targetType === TARGET.AUDIT_STORE) action = ACTION.AUDIT_WRITE;
    else action = 'UNKNOWN';
    return {
      wouldExecute: false,
      action: action,
      resultType: 'DRY_RUN_ONLY'
    };
  }

  function getContractBindingRef(contract, cfg, defaultBinding) {
    if (isPlainObject(contract) && typeof contract.bindingRef === 'string') {
      return contract.bindingRef;
    }
    return defaultBinding;
  }

  // §harness builders ──────────────────────────────────────────────────

  function isReadyContract(contract) {
    return isPlainObject(contract) && contract.ready === true;
  }

  function buildHarnessForTarget(targetType, contract, cfg, defaultBinding) {
    var blockedReasons = [];
    var warnings = [];
    var sourceReady = contract ? isReadyContract(contract) : false;

    var targetEnabled;
    if (targetType === TARGET.TELEGRAM) targetEnabled = cfg.targets.telegram.enabled === true;
    else if (targetType === TARGET.SNAPSHOT_STORE) targetEnabled = cfg.targets.snapshot.enabled === true;
    else if (targetType === TARGET.EVALUATION_STORE) targetEnabled = cfg.targets.evaluation.enabled === true;
    else if (targetType === TARGET.AUDIT_STORE) targetEnabled = cfg.targets.audit.enabled === true;
    else targetEnabled = false;

    var dryMode = cfg.harnessMode === HARNESS_MODE.DRY_RUN_HARNESS;
    var liveNotAllowed = cfg.liveExecutionAllowed !== true;
    var sideNotAllowed = cfg.sideEffectAllowed !== true;
    var fetchNotAllowed = cfg.fetchAllowed !== true;
    var writeNotAllowed = cfg.writeAllowed !== true;
    var credLookupNotAllowed = cfg.credentialLookupAllowed !== true;
    var perTargetGateBlocked = cfg.perTargetGate.allow !== true;

    if (!sourceReady) blockedReasons.push('SOURCE_CONTRACT_NOT_READY');
    if (!targetEnabled) blockedReasons.push('CONFIG_DISALLOW_TARGET:' + targetType);
    if (!dryMode) blockedReasons.push('NON_DRY_RUN_HARNESS_MODE_BLOCKED');
    if (!liveNotAllowed) blockedReasons.push('LIVE_EXECUTION_ALLOWED_BLOCKED');
    if (!sideNotAllowed) blockedReasons.push('SIDE_EFFECT_ALLOWED_BLOCKED');
    if (!fetchNotAllowed) blockedReasons.push('FETCH_ALLOWED_BLOCKED');
    if (!writeNotAllowed) blockedReasons.push('WRITE_ALLOWED_BLOCKED');
    if (!credLookupNotAllowed) blockedReasons.push('CREDENTIAL_LOOKUP_ALLOWED_BLOCKED');
    if (!perTargetGateBlocked) blockedReasons.push('PER_TARGET_GATE_ALLOW_BLOCKED');

    var ready = sourceReady && targetEnabled && dryMode && liveNotAllowed
                && sideNotAllowed && fetchNotAllowed && writeNotAllowed
                && credLookupNotAllowed && perTargetGateBlocked;

    var bindingRef = getContractBindingRef(contract, cfg, defaultBinding);
    // v0.15.0 도 bindingRef 재검증
    var brResult = validateBindingRef(bindingRef, cfg);
    if (brResult.valid !== true) {
      blockedReasons.push((brResult.reason || 'BINDING_REF_INVALID') + ':' + targetType);
      ready = false;
    }

    var shapeResult = buildSafeRequestShape(contract, targetType, cfg);
    var sw;
    for (sw = 0; sw < shapeResult.warnings.length; sw++) warnings.push(shapeResult.warnings[sw]);

    return {
      ready: ready,
      target: targetType,
      dryRunOnly: true,
      sideEffectAllowed: false,
      bindingRef: bindingRef,
      requestShape: shapeResult.requestShape,
      perTargetGate: buildPerTargetGate(cfg),
      rateLimitContract: buildRateLimitContract(targetType, cfg),
      circuitBreakerContract: buildCircuitBreakerContract(targetType, cfg),
      dryRunResult: buildDryRunResult(contract, targetType, cfg),
      blockedReasons: blockedReasons,
      warnings: warnings
    };
  }

  function buildTelegramHarness(input, cfg) {
    var src = isPlainObject(input.secureTransportExecutorContract) ? input.secureTransportExecutorContract : null;
    var contract = (src && isPlainObject(src.telegramContract)) ? src.telegramContract : null;
    return buildHarnessForTarget(TARGET.TELEGRAM, contract, cfg, 'TELEGRAM_SECURE_BINDING');
  }

  function buildSnapshotHarness(input, cfg) {
    var src = isPlainObject(input.secureTransportExecutorContract) ? input.secureTransportExecutorContract : null;
    var contract = (src && isPlainObject(src.snapshotContract)) ? src.snapshotContract : null;
    return buildHarnessForTarget(TARGET.SNAPSHOT_STORE, contract, cfg, 'KV_SNAPSHOT_BINDING');
  }

  function buildEvaluationHarness(input, cfg) {
    var src = isPlainObject(input.secureTransportExecutorContract) ? input.secureTransportExecutorContract : null;
    var contract = (src && isPlainObject(src.evaluationContract)) ? src.evaluationContract : null;
    return buildHarnessForTarget(TARGET.EVALUATION_STORE, contract, cfg, 'EVALUATION_STORE_BINDING');
  }

  function buildAuditHarness(input, cfg) {
    var src = isPlainObject(input.secureTransportExecutorContract) ? input.secureTransportExecutorContract : null;
    var contract = (src && isPlainObject(src.auditContract)) ? src.auditContract : null;
    return buildHarnessForTarget(TARGET.AUDIT_STORE, contract, cfg, 'AUDIT_STORE_BINDING');
  }

  // §summary / classify

  function buildHarnessSummary(harnesses /*, cfg */) {
    var readyCount = 0;
    var blockedCount = 0;
    var skippedCount = 0;
    var dryRunOnlyCount = 0;
    var hasReadyTarget = false;
    var hasBlocker = false;

    var keys = ['telegramHarness', 'snapshotHarness', 'evaluationHarness', 'auditHarness'];
    var i;
    for (i = 0; i < keys.length; i++) {
      var h = harnesses[keys[i]];
      if (!isPlainObject(h)) continue;
      if (h.dryRunOnly === true) dryRunOnlyCount += 1;
      if (h.ready === true) {
        hasReadyTarget = true;
        readyCount += 1;
      } else if (Array.isArray(h.blockedReasons) && h.blockedReasons.length > 0) {
        var realBlock = false;
        var br;
        for (br = 0; br < h.blockedReasons.length; br++) {
          var rc = h.blockedReasons[br];
          if (rc !== 'SOURCE_CONTRACT_NOT_READY') { realBlock = true; break; }
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
      dryRunOnlyCount: dryRunOnlyCount,
      hasReadyTarget: hasReadyTarget,
      hasBlocker: hasBlocker,
      liveGateRequired: true
    };
  }

  function classifyHarnessStatus(harnesses, safety, cfg) {
    // 1. INVALID
    if (safety && safety.invalidContract === true) return HARNESS_STATUS.INVALID;
    if (safety && safety.sourceContractStatus === 'CONTRACT_INVALID') return HARNESS_STATUS.INVALID;

    // 2. BLOCKED
    if (safety && safety.credentialBlocked === true) return HARNESS_STATUS.BLOCKED;
    if (safety && safety.envLikeBlocked === true) return HARNESS_STATUS.BLOCKED;
    if (safety && safety.depthBlocked === true) return HARNESS_STATUS.BLOCKED;
    if (safety && safety.modeBlocked === true) return HARNESS_STATUS.BLOCKED;
    if (safety && safety.hardBlockBoolean === true) return HARNESS_STATUS.BLOCKED;
    if (safety && safety.perTargetGateBlocked === true) return HARNESS_STATUS.BLOCKED;
    if (safety && safety.policyInconsistency === true) return HARNESS_STATUS.BLOCKED;
    if (cfg && cfg.harnessMode !== HARNESS_MODE.DRY_RUN_HARNESS) return HARNESS_STATUS.BLOCKED;
    if (cfg && cfg.liveExecutionAllowed === true) return HARNESS_STATUS.BLOCKED;
    if (cfg && cfg.sideEffectAllowed === true) return HARNESS_STATUS.BLOCKED;
    if (cfg && cfg.fetchAllowed === true) return HARNESS_STATUS.BLOCKED;
    if (cfg && cfg.writeAllowed === true) return HARNESS_STATUS.BLOCKED;
    if (cfg && cfg.credentialLookupAllowed === true) return HARNESS_STATUS.BLOCKED;
    if (cfg && cfg.perTargetGate && cfg.perTargetGate.allow === true) return HARNESS_STATUS.BLOCKED;
    if (safety && safety.sourceContractStatus === 'CONTRACT_BLOCKED') return HARNESS_STATUS.BLOCKED;

    var summary = buildHarnessSummary(harnesses);

    // 3. PARTIAL
    if (summary.hasReadyTarget && summary.hasBlocker) return HARNESS_STATUS.PARTIAL;

    // 4. READY
    if (safety && (safety.sourceContractStatus === 'CONTRACT_READY' || safety.sourceContractStatus === 'CONTRACT_PARTIAL')
        && summary.hasReadyTarget && !summary.hasBlocker) {
      return HARNESS_STATUS.READY;
    }

    // 5. SKIPPED
    if (safety && safety.sourceContractStatus === 'CONTRACT_SKIPPED') return HARNESS_STATUS.SKIPPED;
    if (!summary.hasReadyTarget && !summary.hasBlocker) return HARNESS_STATUS.SKIPPED;

    // 6. UNKNOWN
    return HARNESS_STATUS.UNKNOWN;
  }

  // §normalize

  function normalizeHarnessTarget(target /*, cfg */) {
    var h = isPlainObject(target) ? target : {};
    return {
      ready: h.ready === true,
      target: typeof h.target === 'string' ? h.target : null,
      dryRunOnly: h.dryRunOnly !== false,
      sideEffectAllowed: h.sideEffectAllowed === true,
      bindingRef: typeof h.bindingRef === 'string' ? h.bindingRef : null,
      requestShape: h.requestShape,
      perTargetGate: h.perTargetGate,
      rateLimitContract: h.rateLimitContract,
      circuitBreakerContract: h.circuitBreakerContract,
      dryRunResult: h.dryRunResult,
      blockedReasons: Array.isArray(h.blockedReasons) ? h.blockedReasons : [],
      warnings: Array.isArray(h.warnings) ? h.warnings : []
    };
  }

  function normalizeTransportExecutorHarness(result) {
    return {
      valid: result.valid === true,
      version: result.version,
      harnessMode: typeof result.harnessMode === 'string' ? result.harnessMode : 'DRY_RUN_HARNESS',
      liveExecutionAllowed: result.liveExecutionAllowed === true,
      harnessStatus: typeof result.harnessStatus === 'string' ? result.harnessStatus : HARNESS_STATUS.UNKNOWN,
      sourceContractStatus: typeof result.sourceContractStatus === 'string' ? result.sourceContractStatus : null,
      harnessPolicy: result.harnessPolicy,
      telegramHarness: result.telegramHarness,
      snapshotHarness: result.snapshotHarness,
      evaluationHarness: result.evaluationHarness,
      auditHarness: result.auditHarness,
      harnessSummary: result.harnessSummary,
      reasons: Array.isArray(result.reasons) ? result.reasons : [],
      warnings: Array.isArray(result.warnings) ? result.warnings : [],
      debug: result.debug,
      configUsed: result.configUsed
    };
  }

  // §main entry ─────────────────────────────────────────────────────────

  function buildTransportExecutorHarness(input, config) {
    var inp = isPlainObject(input) ? input : {};
    var cfg = mergeTransportExecutorHarnessConfig(config);
    var reasons = [];
    var warnings = [];

    // STEP 1 — INVALID check
    var src = isPlainObject(inp.secureTransportExecutorContract) ? inp.secureTransportExecutorContract : null;
    var invalidContract = (src === null) || (src.valid !== true);
    var sourceContractStatus = (src && typeof src.contractStatus === 'string') ? src.contractStatus : null;

    // STEP 2 — credential / env-like / depth recursive detection
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

    // STEP 3 — mode / hard-block 5 booleans / perTargetGate
    var modeBlocked = (cfg.harnessMode !== HARNESS_MODE.DRY_RUN_HARNESS);
    var hardBlockBoolean = (cfg.liveExecutionAllowed === true)
                        || (cfg.sideEffectAllowed === true)
                        || (cfg.fetchAllowed === true)
                        || (cfg.writeAllowed === true)
                        || (cfg.credentialLookupAllowed === true);
    var perTargetGateBlocked = (cfg.perTargetGate.allow === true);

    // STEP 4 — base harness (default SKIPPED — non-ready, perTargetGate.allow=false)
    function makeBase(targetType, bindingRef) {
      var shape;
      if (targetType === TARGET.TELEGRAM) {
        shape = {
          channelRef: 'SECURE_CHANNEL_REF',
          messageType: 'NONE',
          title: null,
          lines: [],
          payloadSummary: {},
          metadata: {}
        };
      } else if (targetType === TARGET.SNAPSHOT_STORE) {
        shape = {
          bucketRef: 'SECURE_BUCKET_REF',
          snapshotType: 'NONE',
          keyHint: null,
          payloadSummary: {},
          metadata: {}
        };
      } else if (targetType === TARGET.EVALUATION_STORE) {
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
        target: targetType,
        dryRunOnly: true,
        sideEffectAllowed: false,
        bindingRef: bindingRef,
        requestShape: shape,
        perTargetGate: buildPerTargetGate(cfg),
        rateLimitContract: buildRateLimitContract(targetType, cfg),
        circuitBreakerContract: buildCircuitBreakerContract(targetType, cfg),
        dryRunResult: buildDryRunResult(null, targetType, cfg),
        blockedReasons: [],
        warnings: []
      };
    }

    var teleH = makeBase(TARGET.TELEGRAM, 'TELEGRAM_SECURE_BINDING');
    var snapH = makeBase(TARGET.SNAPSHOT_STORE, 'KV_SNAPSHOT_BINDING');
    var evalH = makeBase(TARGET.EVALUATION_STORE, 'EVALUATION_STORE_BINDING');
    var auditH = makeBase(TARGET.AUDIT_STORE, 'AUDIT_STORE_BINDING');

    function pushBlockToAll(code) {
      teleH.blockedReasons.push(code);
      snapH.blockedReasons.push(code);
      evalH.blockedReasons.push(code);
      auditH.blockedReasons.push(code);
    }

    if (invalidContract) {
      reasons.push('SECURE_CONTRACT_INVALID');
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
    } else if (modeBlocked) {
      reasons.push('NON_DRY_RUN_HARNESS_MODE_BLOCKED');
      pushBlockToAll('NON_DRY_RUN_HARNESS_MODE_BLOCKED');
    } else if (hardBlockBoolean) {
      reasons.push('HARD_BLOCK_BOOLEAN_TRUE');
      if (cfg.liveExecutionAllowed === true) pushBlockToAll('LIVE_EXECUTION_ALLOWED_BLOCKED');
      if (cfg.sideEffectAllowed === true) pushBlockToAll('SIDE_EFFECT_ALLOWED_BLOCKED');
      if (cfg.fetchAllowed === true) pushBlockToAll('FETCH_ALLOWED_BLOCKED');
      if (cfg.writeAllowed === true) pushBlockToAll('WRITE_ALLOWED_BLOCKED');
      if (cfg.credentialLookupAllowed === true) pushBlockToAll('CREDENTIAL_LOOKUP_ALLOWED_BLOCKED');
    } else if (perTargetGateBlocked) {
      reasons.push('PER_TARGET_GATE_ALLOW_BLOCKED');
      pushBlockToAll('PER_TARGET_GATE_ALLOW_BLOCKED');
    } else if (sourceContractStatus === 'CONTRACT_BLOCKED') {
      reasons.push('SOURCE_CONTRACT_BLOCKED');
      pushBlockToAll('SOURCE_CONTRACT_BLOCKED');
    } else {
      // STEP 5 — normal harness builds
      teleH = buildTelegramHarness(inp, cfg);
      snapH = buildSnapshotHarness(inp, cfg);
      evalH = buildEvaluationHarness(inp, cfg);
      auditH = buildAuditHarness(inp, cfg);
    }

    // STEP 6 — normalize each harness
    teleH = normalizeHarnessTarget(teleH, cfg);
    snapH = normalizeHarnessTarget(snapH, cfg);
    evalH = normalizeHarnessTarget(evalH, cfg);
    auditH = normalizeHarnessTarget(auditH, cfg);

    // STEP 7 — summary + classify
    var harnesses = {
      telegramHarness: teleH,
      snapshotHarness: snapH,
      evaluationHarness: evalH,
      auditHarness: auditH
    };
    var summary = buildHarnessSummary(harnesses);
    var safetyFlags = {
      invalidContract: invalidContract,
      sourceContractStatus: sourceContractStatus,
      credentialBlocked: credBlocked,
      envLikeBlocked: envLikeBlocked,
      depthBlocked: depthBlocked,
      modeBlocked: modeBlocked,
      hardBlockBoolean: hardBlockBoolean,
      perTargetGateBlocked: perTargetGateBlocked,
      policyInconsistency: false
    };
    var harnessStatus = classifyHarnessStatus(harnesses, safetyFlags, cfg);

    // STEP 8 — reasons
    if (harnessStatus === HARNESS_STATUS.READY) reasons.push('HARNESS_READY');
    if (harnessStatus === HARNESS_STATUS.PARTIAL) reasons.push('HARNESS_PARTIAL');
    if (harnessStatus === HARNESS_STATUS.SKIPPED) reasons.push('HARNESS_SKIPPED');
    if (harnessStatus === HARNESS_STATUS.UNKNOWN) reasons.push('HARNESS_UNKNOWN_FALLBACK');
    if (teleH.ready) reasons.push('TELEGRAM_HARNESS_READY');
    if (snapH.ready) reasons.push('SNAPSHOT_HARNESS_READY');
    if (evalH.ready) reasons.push('EVALUATION_HARNESS_READY');
    if (auditH.ready) reasons.push('AUDIT_HARNESS_READY');

    // STEP 9 — harnessPolicy fixed contract (top-level source of truth — DP-HARNESS1/4)
    var harnessPolicy = {
      dryRunOnly: true,
      sideEffectAllowed: false,
      credentialLookupAllowed: false,
      fetchAllowed: false,
      writeAllowed: false,
      liveExecutionRequiresExplicitGate: true
    };

    // STEP 10 — configUsed scalar snapshot
    var configUsed = {
      version: cfg.version,
      harnessMode: cfg.harnessMode,
      liveExecutionAllowed: cfg.liveExecutionAllowed,
      sideEffectAllowed: cfg.sideEffectAllowed,
      fetchAllowed: cfg.fetchAllowed,
      writeAllowed: cfg.writeAllowed,
      credentialLookupAllowed: cfg.credentialLookupAllowed,
      targets: {
        telegram: {
          enabled: cfg.targets.telegram.enabled,
          rateLimitContractOverride: cfg.targets.telegram.rateLimitContract !== null,
          circuitBreakerContractOverride: cfg.targets.telegram.circuitBreakerContract !== null
        },
        snapshot: {
          enabled: cfg.targets.snapshot.enabled,
          rateLimitContractOverride: cfg.targets.snapshot.rateLimitContract !== null,
          circuitBreakerContractOverride: cfg.targets.snapshot.circuitBreakerContract !== null
        },
        evaluation: {
          enabled: cfg.targets.evaluation.enabled,
          rateLimitContractOverride: cfg.targets.evaluation.rateLimitContract !== null,
          circuitBreakerContractOverride: cfg.targets.evaluation.circuitBreakerContract !== null
        },
        audit: {
          enabled: cfg.targets.audit.enabled,
          rateLimitContractOverride: cfg.targets.audit.rateLimitContract !== null,
          circuitBreakerContractOverride: cfg.targets.audit.circuitBreakerContract !== null
        }
      },
      perTargetGate: {
        allow: cfg.perTargetGate.allow,
        reason: cfg.perTargetGate.reason
      },
      rateLimitContract: {
        enabled: cfg.rateLimitContract.enabled,
        windowMs: cfg.rateLimitContract.windowMs,
        maxAttempts: cfg.rateLimitContract.maxAttempts
      },
      circuitBreakerContract: {
        enabled: cfg.circuitBreakerContract.enabled,
        state: cfg.circuitBreakerContract.state,
        failureThreshold: cfg.circuitBreakerContract.failureThreshold
      },
      safety: {
        blockCredentialFields: cfg.safety.blockCredentialFields,
        credentialMaxDepth: cfg.safety.credentialMaxDepth,
        credentialAllowListSize: cfg.safety.credentialAllowList.length,
        blockEnvLikeObjects: cfg.safety.blockEnvLikeObjects,
        blockObjectTooDeep: cfg.safety.blockObjectTooDeep,
        allowRawPayload: cfg.safety.allowRawPayload,
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
      valid: invalidContract ? false : true,
      version: HARNESS_VERSION,
      harnessMode: cfg.harnessMode === HARNESS_MODE.DRY_RUN_HARNESS ? 'DRY_RUN_HARNESS' : cfg.harnessMode,
      liveExecutionAllowed: cfg.liveExecutionAllowed === true,
      harnessStatus: harnessStatus,
      sourceContractStatus: sourceContractStatus,
      harnessPolicy: harnessPolicy,
      telegramHarness: teleH,
      snapshotHarness: snapH,
      evaluationHarness: evalH,
      auditHarness: auditH,
      harnessSummary: summary,
      reasons: reasons,
      warnings: warnings,
      debug: {
        source: 'secureTransportExecutorContract + transportExecutionEnvelope + transportPlan + rendererBinding + operationPacket + activeCycleDecision + evaluationOutcome + externalConfluence',
        configVersion: cfg.version,
        invalidContract: invalidContract,
        credentialBlocked: credBlocked,
        envLikeBlocked: envLikeBlocked,
        depthBlocked: depthBlocked,
        modeBlocked: modeBlocked,
        hardBlockBoolean: hardBlockBoolean,
        perTargetGateBlocked: perTargetGateBlocked,
        credentialDetections: credResult.detections.length,
        envLikeDetections: envResult.detections.length,
        objectTooDeepDetections: envResult.depthBlocks.length
      },
      configUsed: configUsed
    };

    return normalizeTransportExecutorHarness(draft);
  }

  // §export ──────────────────────────────────────────────────────────────

  var api = Object.freeze({
    VERSION: HARNESS_VERSION,
    DEFAULT_TRANSPORT_EXECUTOR_HARNESS_CONFIG: DEFAULT_TRANSPORT_EXECUTOR_HARNESS_CONFIG,
    HARNESS_MODE: HARNESS_MODE,
    HARNESS_STATUS: HARNESS_STATUS,
    TARGET: TARGET,
    ACTION: ACTION,
    WORDING_SANITIZE_MODE: WORDING_SANITIZE_MODE,
    build: buildTransportExecutorHarness,
    mergeTransportExecutorHarnessConfig: mergeTransportExecutorHarnessConfig,
    buildTelegramHarness: buildTelegramHarness,
    buildSnapshotHarness: buildSnapshotHarness,
    buildEvaluationHarness: buildEvaluationHarness,
    buildAuditHarness: buildAuditHarness,
    buildDryRunResult: buildDryRunResult,
    buildPerTargetGate: buildPerTargetGate,
    buildRateLimitContract: buildRateLimitContract,
    buildCircuitBreakerContract: buildCircuitBreakerContract,
    buildSafeRequestShape: buildSafeRequestShape,
    classifyHarnessStatus: classifyHarnessStatus,
    detectCredentialFields: detectCredentialFields,
    detectEnvLikeObjects: detectEnvLikeObjects,
    validateBindingRef: validateBindingRef
  });

  global.WS3_TransportExecutorHarness = api;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
