/**
 * WS3 v0.13.0 — TransportExecutionAdapter (Transport Execution Envelope)
 *
 * Scope:
 *   transportPlan (v0.12.0) + rendererBinding (v0.12.0) +
 *   operationPacket (v0.8.0) + activeCycleDecision (v0.9.0) +
 *   evaluationOutcome (v0.10.0) + externalConfluence (v0.11.0)
 *   → standalone TransportExecutionEnvelope (dry-run safe envelope)
 *
 * 단일 기준 문서:
 *   docs/ws3/WS3_CODE_CONTRACT.md (b-r2 박제본)
 *
 * 확정 DP 정책 (Gate 2 spec):
 *   DP-TX1   Dry-run envelope builder 만. 실제 발송 / 저장 / 호출 X.
 *   DP-TX2   TransportPlan 의 shouldSend / shouldStore / shouldUpdate / shouldClose /
 *            shouldReview / shouldAudit 결정을 true 로 override 금지.
 *   DP-TX3   envelopeMode DRY_RUN only. LIVE / REAL / SEND 시도 시 ENVELOPE_BLOCKED.
 *   DP-TX4   credential 계열 키 (9종) input/config 전체 nested object 재귀 검사 차단.
 *            case-insensitive + partial match + depth limit 5.
 *   DP-TX5   payloadSummary 는 whitelist scalar 만. 원본 객체 전체 spread / Object.assign /
 *            deep clone (JSON.parse(JSON.stringify)) / for-in 복사 금지.
 *   DP-TX6   dry-run wording 만. 발송됨 / 저장됨 / 전송 완료 / sent / delivered /
 *            완료 표현 금지. trading wording (손절 / 익절 / 매수 성공 등) 금지.
 *   DP-TX7   side-effect 금지 — fetch / Telegram / KV / DB / DOM / storage /
 *            런타임 clock (Date.now / new Date / performance.now) 모두 0건.
 *   DP-TX8   6종 입력 (transportPlan / rendererBinding / operationPacket /
 *            activeCycleDecision / evaluationOutcome / externalConfluence) read-only.
 *   DP-TX9   rendererBinding 은 message preview 보강용. decision source 는 transportPlan.
 *   DP-TX10  신규 파일 1개 + 문서 갱신만. 기존 v3 엔진 파일 (18종) 수정 금지.
 *
 * U-TX / N-TX-OBS 처리:
 *   U-TX-1   credential partial match 안전 우선 차단. cfg.safety.credentialAllowList
 *            기본값 빈 배열. allowList 에 명시된 key 이름만 차단 제외 가능.
 *   U-TX-2   sanitizeMessageLines 기본값 'REJECT'. 금지 표현 포함 line 전체 제거 +
 *            warning FORBIDDEN_WORD_LINE_REJECTED. 'REPLACE' / 'WARN_ONLY' 선택 가능.
 *   N-TX-OBS-1  dryRunOnly namespace 중복 — 기존 transportPlan.wording.dryRunOnly /
 *               rendererBinding.wording.dryRunOnly 와 v0.13.0 top-level /
 *               envelope-level dryRunOnly 는 namespace 가 다르므로 구조적 충돌 아님.
 *   N-TX-OBS-2  보호 baseline false-positive — v3-bithumb-client / v3-candle-normalizer /
 *               v3-indicators / v3-feature-payload-builder 의 fetch / Date.now / spread /
 *               Object.assign 사용은 보호 baseline 책임. 본 모듈은 0건 보장.
 *
 * 출력 (top-level):
 *   valid (boolean), version, dryRun (boolean true), envelopeMode ('DRY_RUN'),
 *   envelopeStatus (6 후보), telegramEnvelope, snapshotEnvelope, evaluationEnvelope,
 *   auditEnvelope, envelopeSummary, reasons[], warnings[], debug, configUsed
 *
 * envelopeStatus 6 후보 (우선순위 first-match-wins):
 *   ENVELOPE_INVALID  → transportPlan invalid/missing
 *   ENVELOPE_BLOCKED  → envelopeMode!=='DRY_RUN' or dryRunOnly false or credential 감지
 *   ENVELOPE_PARTIAL  → ≥1 eligible true + ≥1 blockedReasons (일부 blocked)
 *   ENVELOPE_READY    → ≥1 eligible true + 모든 candidate blockedReasons 없음
 *   ENVELOPE_SKIPPED  → 모든 eligible false + blockedReasons 0건
 *   ENVELOPE_UNKNOWN  → fallback
 *
 * 의도된 미구현:
 *   실제 Telegram bot API 호출 / chatId / botToken / webhookUrl 노출.
 *   실제 KV write / DB persist / 파일 IO / 브라우저 storage.
 *   실제 reviewQueue write / audit log 영속화.
 *   실제 DOM 렌더 / HTML attach / addEventListener.
 *   입력 객체 mutation.
 *   런타임 clock API (Date.now / new Date / performance.now).
 *   raw payload / payload.raw / identityInput / raw.builderDebug 노출.
 *   bot 식별 시크릿 / 채널 식별자 / API 키 / authorization header.
 *
 * 함수 목록 (§11 spec):
 *   mergeTransportExecutionConfig(config)
 *   buildTransportExecution(input, config)         ← 진입점
 *   buildTelegramEnvelope(input, cfg)
 *   buildSnapshotEnvelope(input, cfg)
 *   buildEvaluationEnvelope(input, cfg)
 *   buildAuditEnvelope(input, cfg)
 *   buildSafePayloadSummary(input, cfg)
 *   buildEnvelopeSummary(envelopes, cfg)
 *   classifyEnvelopeStatus(envelopes, safety, cfg)
 *   detectCredentialFields(input, config)
 *   isCredentialKey(keyName)
 *   sanitizeMessageLines(lines, cfg)
 *   normalizeEnvelopeRequest(request, cfg)
 *   normalizeTransportExecution(result)
 *   isPlainObject(value)
 *   safeString(value, cfg)
 *   safeNumber(value)
 *   pushReason(target, code, detail)
 *   pushWarning(target, code, detail)
 *
 * export:
 *   global.WS3_TransportExecutionAdapter + module.exports
 */
(function(global) {
  'use strict';

  // §version
  var TRANSPORT_EXECUTION_VERSION = 'WS3_v0.13.0_transport_execution_envelope';

  // §envelopeMode 후보 (only DRY_RUN allowed in v0.13.0)
  var ENVELOPE_MODE = Object.freeze({
    DRY_RUN: 'DRY_RUN'
  });

  // §envelopeStatus 6 후보
  var ENVELOPE_STATUS = Object.freeze({
    READY: 'ENVELOPE_READY',
    SKIPPED: 'ENVELOPE_SKIPPED',
    BLOCKED: 'ENVELOPE_BLOCKED',
    PARTIAL: 'ENVELOPE_PARTIAL',
    INVALID: 'ENVELOPE_INVALID',
    UNKNOWN: 'ENVELOPE_UNKNOWN'
  });

  // §credential 금지 키 (9종 lower-case base — case-insensitive + partial 차단)
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

  // §wording sanitize 후보
  var WORDING_SANITIZE_MODE = Object.freeze({
    REJECT: 'REJECT',
    REPLACE: 'REPLACE',
    WARN_ONLY: 'WARN_ONLY'
  });

  // §forbidden wording (DP-TX6)
  //   금지: trading wording (손절/익절/수익 확정/profit/loss/매수 성공 등)
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

  // §safe replacement table (REPLACE 모드용)
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

  // §DEFAULT_CONFIG (§10)
  var DEFAULT_TRANSPORT_EXECUTION_CONFIG = Object.freeze({
    version: 'inline-default-v0',
    envelopeMode: 'DRY_RUN',
    dryRunOnly: true,
    execution: Object.freeze({
      allowTelegram: true,
      allowSnapshot: true,
      allowEvaluation: true,
      allowAudit: true
    }),
    safety: Object.freeze({
      blockCredentialFields: true,
      credentialMaxDepth: 5,
      credentialAllowList: Object.freeze([]),
      allowRawPayload: false,
      allowLiveExecution: false,
      allowWebhookUrl: false
    }),
    payloadSummary: Object.freeze({
      maxStringLength: 200,
      allowedFields: Object.freeze([
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
      ]),
      metadataAllowedFields: Object.freeze([])
    }),
    wording: Object.freeze({
      dryRunOnly: true,
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

  // §config merge — field-by-field (no Object.assign, no spread)
  function mergeTransportExecutionConfig(config) {
    var c = isPlainObject(config) ? config : {};

    var d = DEFAULT_TRANSPORT_EXECUTION_CONFIG;

    var ex = isPlainObject(c.execution) ? c.execution : {};
    var sf = isPlainObject(c.safety) ? c.safety : {};
    var ps = isPlainObject(c.payloadSummary) ? c.payloadSummary : {};
    var wd = isPlainObject(c.wording) ? c.wording : {};
    var db = isPlainObject(c.debug) ? c.debug : {};

    // credentialAllowList — array of safe key names (case-insensitive normalized later)
    var aListSrc = Array.isArray(sf.credentialAllowList) ? sf.credentialAllowList : d.safety.credentialAllowList;
    var aList = [];
    var i;
    for (i = 0; i < aListSrc.length; i++) {
      var k = aListSrc[i];
      if (typeof k === 'string' && k.length > 0) aList.push(k);
    }

    // payloadSummary.allowedFields
    var allowedFieldsSrc = Array.isArray(ps.allowedFields) ? ps.allowedFields : d.payloadSummary.allowedFields;
    var allowedFields = [];
    for (i = 0; i < allowedFieldsSrc.length; i++) {
      var f = allowedFieldsSrc[i];
      if (typeof f === 'string' && f.length > 0) allowedFields.push(f);
    }

    // payloadSummary.metadataAllowedFields
    var mafSrc = Array.isArray(ps.metadataAllowedFields) ? ps.metadataAllowedFields : d.payloadSummary.metadataAllowedFields;
    var maf = [];
    for (i = 0; i < mafSrc.length; i++) {
      var mf = mafSrc[i];
      if (typeof mf === 'string' && mf.length > 0) maf.push(mf);
    }

    // debug.allowedFields
    var dbgFSrc = Array.isArray(db.allowedFields) ? db.allowedFields : d.debug.allowedFields;
    var dbgF = [];
    for (i = 0; i < dbgFSrc.length; i++) {
      var df = dbgFSrc[i];
      if (typeof df === 'string' && df.length > 0) dbgF.push(df);
    }

    var maxLen = (typeof ps.maxStringLength === 'number' && isFinite(ps.maxStringLength) && ps.maxStringLength > 0)
      ? ps.maxStringLength
      : d.payloadSummary.maxStringLength;

    var maxDepth = (typeof sf.credentialMaxDepth === 'number' && isFinite(sf.credentialMaxDepth) && sf.credentialMaxDepth > 0)
      ? sf.credentialMaxDepth
      : d.safety.credentialMaxDepth;

    var sanitizeMode = (typeof wd.sanitizeMode === 'string')
      ? wd.sanitizeMode
      : d.wording.sanitizeMode;
    if (sanitizeMode !== WORDING_SANITIZE_MODE.REJECT
        && sanitizeMode !== WORDING_SANITIZE_MODE.REPLACE
        && sanitizeMode !== WORDING_SANITIZE_MODE.WARN_ONLY) {
      sanitizeMode = d.wording.sanitizeMode;
    }

    return {
      version: (typeof c.version === 'string' && c.version.length > 0) ? c.version : d.version,
      envelopeMode: (typeof c.envelopeMode === 'string' && c.envelopeMode.length > 0) ? c.envelopeMode : d.envelopeMode,
      dryRunOnly: c.dryRunOnly !== false,
      execution: {
        allowTelegram: ex.allowTelegram !== false,
        allowSnapshot: ex.allowSnapshot !== false,
        allowEvaluation: ex.allowEvaluation !== false,
        allowAudit: ex.allowAudit !== false
      },
      safety: {
        blockCredentialFields: sf.blockCredentialFields !== false,
        credentialMaxDepth: maxDepth,
        credentialAllowList: aList,
        allowRawPayload: sf.allowRawPayload === true,
        allowLiveExecution: sf.allowLiveExecution === true,
        allowWebhookUrl: sf.allowWebhookUrl === true
      },
      payloadSummary: {
        maxStringLength: maxLen,
        allowedFields: allowedFields,
        metadataAllowedFields: maf
      },
      wording: {
        dryRunOnly: wd.dryRunOnly !== false,
        sanitizeMode: sanitizeMode
      },
      debug: {
        enabled: db.enabled === true,
        allowedFields: dbgF
      }
    };
  }

  // §credential ─────────────────────────────────────────────────────────

  // isCredentialKey — case-insensitive partial substring match (§7 / U-TX-1)
  function isCredentialKey(keyName, allowList) {
    if (typeof keyName !== 'string' || keyName.length === 0) return false;
    var lower = keyName.toLowerCase();

    // allowList check first (U-TX-1 — exact string match, case-sensitive on user-provided list)
    if (Array.isArray(allowList)) {
      var a;
      for (a = 0; a < allowList.length; a++) {
        if (allowList[a] === keyName) return false;
      }
    }

    var i;
    for (i = 0; i < CREDENTIAL_KEYS_BASE.length; i++) {
      if (lower.indexOf(CREDENTIAL_KEYS_BASE[i]) !== -1) return true;
    }
    return false;
  }

  // detectCredentialFields — recursive nested object scan (§7 / DP-TX4)
  //   depth limit cfg.safety.credentialMaxDepth (기본 5)
  //   depth 초과 시 warning DETECTION_DEPTH_LIMIT 추가
  //   value 는 절대 path 에 노출하지 않는다 (key 이름과 위치만)
  function detectCredentialFields(input, config) {
    var cfg = mergeTransportExecutionConfig(config);
    var detections = [];
    var depthWarnings = [];

    if (cfg.safety.blockCredentialFields !== true) {
      return { detections: detections, depthWarnings: depthWarnings };
    }

    function walk(value, path, depth) {
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
      // scalar — no detection
    }

    // input / config 각각 root 부터 재귀 — value 노출 0건
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
      // case-insensitive replace via split/join lowercase scan
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
    var maxLen = (cfg && cfg.payloadSummary && typeof cfg.payloadSummary.maxStringLength === 'number')
      ? cfg.payloadSummary.maxStringLength
      : 200;

    var i;
    for (i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (typeof line !== 'string') continue;
      if (line.length > maxLen) continue; // safe scalar discipline
      var hit = lineContainsForbiddenWord(line);
      if (hit === null) {
        result.lines.push(line);
        continue;
      }
      if (mode === WORDING_SANITIZE_MODE.REJECT) {
        result.warnings.push('FORBIDDEN_WORD_LINE_REJECTED:' + hit);
        continue; // drop
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
      // unknown mode — safe default REJECT
      result.warnings.push('FORBIDDEN_WORD_LINE_REJECTED:' + hit);
    }
    return result;
  }

  // §payloadSummary ─────────────────────────────────────────────────────

  // collectScalarFromSources — field-by-field read from candidate source objects
  //   sources: ordered list of source objects (read-only)
  //   field: target key name
  //   returns first found scalar value (string/number/boolean/null) or null
  function collectScalarFromSources(sources, field) {
    if (!Array.isArray(sources)) return null;
    var i;
    for (i = 0; i < sources.length; i++) {
      var src = sources[i];
      if (!isPlainObject(src)) continue;
      if (Object.prototype.hasOwnProperty.call(src, field) === false) continue;
      var v = src[field];
      if (v === null || v === undefined) continue;
      if (typeof v === 'object' || typeof v === 'function' || typeof v === 'symbol') continue;
      return v;
    }
    return null;
  }

  // buildSafePayloadSummary — whitelist scalar only (DP-TX5 / §8)
  function buildSafePayloadSummary(input, cfg) {
    var summary = {};
    var warnings = [];

    if (!cfg || !cfg.payloadSummary || !Array.isArray(cfg.payloadSummary.allowedFields)) {
      return { summary: summary, warnings: warnings };
    }

    var allowedFields = cfg.payloadSummary.allowedFields;
    var maxLen = cfg.payloadSummary.maxStringLength;
    var allowList = (cfg.safety && Array.isArray(cfg.safety.credentialAllowList))
      ? cfg.safety.credentialAllowList
      : [];

    // candidate sources — operationPacket.identity / displaySummary,
    //                     transportPlan.{telegramPlan / snapshotPlan / evaluationPlan / auditPlan},
    //                     rendererBinding.{displayMode} (DP-TX9 reference only),
    //                     externalConfluence.{confluenceLabel / confluenceScore}
    var op = isPlainObject(input.operationPacket) ? input.operationPacket : {};
    var tp = isPlainObject(input.transportPlan) ? input.transportPlan : {};
    var rb = isPlainObject(input.rendererBinding) ? input.rendererBinding : {};
    var ec = isPlainObject(input.externalConfluence) ? input.externalConfluence : {};
    var ev = isPlainObject(input.evaluationOutcome) ? input.evaluationOutcome : {};

    var opIdentity = isPlainObject(op.identity) ? op.identity : {};
    var opDisplaySummary = isPlainObject(op.displaySummary) ? op.displaySummary : {};
    var tpTele = isPlainObject(tp.telegramPlan) ? tp.telegramPlan : {};
    var tpSnap = isPlainObject(tp.snapshotPlan) ? tp.snapshotPlan : {};
    var tpEval = isPlainObject(tp.evaluationPlan) ? tp.evaluationPlan : {};
    var tpAudit = isPlainObject(tp.auditPlan) ? tp.auditPlan : {};
    var evMain = isPlainObject(ev.evaluation) ? ev.evaluation : {};

    // ordered candidate read for each allowed field
    function pickField(field) {
      // credential block — even though whitelist already protects, double-check
      if (isCredentialKey(field, allowList)) return null;

      if (field === 'candidateKey') {
        return collectScalarFromSources([op, tp, ev], 'candidateKey');
      }
      if (field === 'base') return collectScalarFromSources([opIdentity], 'base');
      if (field === 'quote') return collectScalarFromSources([opIdentity], 'quote');
      if (field === 'market') return collectScalarFromSources([opIdentity], 'market');
      if (field === 'exchange') return collectScalarFromSources([opIdentity], 'exchange');
      if (field === 'timeframe') return collectScalarFromSources([opDisplaySummary, op], 'timeframe');
      if (field === 'messageType') return collectScalarFromSources([tpTele], 'notificationType');
      if (field === 'snapshotType') return collectScalarFromSources([tpSnap], 'snapshotType');
      if (field === 'evaluationType') return collectScalarFromSources([tpEval], 'evaluationType');
      if (field === 'resultType') return collectScalarFromSources([evMain], 'resultType');
      if (field === 'auditType') return collectScalarFromSources([tpAudit], 'auditTrigger');
      if (field === 'displayMode') return collectScalarFromSources([rb], 'displayMode');
      if (field === 'confluenceLabel') return collectScalarFromSources([ec], 'confluenceLabel');
      if (field === 'confluenceScore') return collectScalarFromSources([ec], 'confluenceScore');
      return null;
    }

    var i;
    for (i = 0; i < allowedFields.length; i++) {
      var fld = allowedFields[i];
      if (typeof fld !== 'string' || fld.length === 0) continue;
      if (isCredentialKey(fld, allowList)) {
        warnings.push('CREDENTIAL_FIELD_REJECTED:' + fld);
        continue;
      }
      var v = pickField(fld);
      if (v === null || v === undefined) {
        summary[fld] = null;
        continue;
      }
      if (typeof v === 'string') {
        var s = safeString(v, maxLen);
        if (s === null) {
          warnings.push('NON_SCALAR_VALUE_SKIPPED:' + fld);
          summary[fld] = null;
        } else {
          summary[fld] = s;
        }
        continue;
      }
      if (typeof v === 'number') {
        var n = safeNumber(v);
        if (n === null) {
          warnings.push('NON_SCALAR_VALUE_SKIPPED:' + fld);
          summary[fld] = null;
        } else {
          summary[fld] = n;
        }
        continue;
      }
      if (typeof v === 'boolean') {
        summary[fld] = v;
        continue;
      }
      // object / function / symbol skip
      warnings.push('NON_SCALAR_VALUE_SKIPPED:' + fld);
      summary[fld] = null;
    }

    return { summary: summary, warnings: warnings };
  }

  // buildSafeMetadata — whitelist scalar only (DP-TX5 — metadata layer)
  function buildSafeMetadata(metadataSource, cfg) {
    var meta = {};
    var warnings = [];
    if (!cfg || !cfg.payloadSummary) return { metadata: meta, warnings: warnings };
    var allowed = Array.isArray(cfg.payloadSummary.metadataAllowedFields)
      ? cfg.payloadSummary.metadataAllowedFields : [];
    if (allowed.length === 0) return { metadata: meta, warnings: warnings };
    if (!isPlainObject(metadataSource)) return { metadata: meta, warnings: warnings };

    var maxLen = cfg.payloadSummary.maxStringLength;
    var allowList = (cfg.safety && Array.isArray(cfg.safety.credentialAllowList))
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
      if (Object.prototype.hasOwnProperty.call(metadataSource, fld) === false) continue;
      var v = metadataSource[fld];
      if (v === null || v === undefined) {
        meta[fld] = null;
        continue;
      }
      if (typeof v === 'string') {
        var s = safeString(v, maxLen);
        if (s === null) {
          warnings.push('NON_SCALAR_METADATA_SKIPPED:' + fld);
          continue;
        }
        meta[fld] = s;
        continue;
      }
      if (typeof v === 'number') {
        var n = safeNumber(v);
        if (n === null) {
          warnings.push('NON_SCALAR_METADATA_SKIPPED:' + fld);
          continue;
        }
        meta[fld] = n;
        continue;
      }
      if (typeof v === 'boolean') {
        meta[fld] = v;
        continue;
      }
      warnings.push('NON_SCALAR_METADATA_SKIPPED:' + fld);
    }
    return { metadata: meta, warnings: warnings };
  }

  // §envelope builders ──────────────────────────────────────────────────

  // request normalize — defensive shape lock
  function normalizeEnvelopeRequest(request, cfg) {
    var maxLen = (cfg && cfg.payloadSummary && typeof cfg.payloadSummary.maxStringLength === 'number')
      ? cfg.payloadSummary.maxStringLength : 200;
    var r = isPlainObject(request) ? request : {};
    var summarySource = isPlainObject(r.payloadSummary) ? r.payloadSummary : {};
    var metaSource = isPlainObject(r.metadata) ? r.metadata : {};

    // payloadSummary inside request is already a scalar map; lock shape
    var safeSummary = {};
    var sKeys = Object.keys(summarySource);
    var i;
    for (i = 0; i < sKeys.length; i++) {
      var sk = sKeys[i];
      var sv = summarySource[sk];
      if (sv === null) { safeSummary[sk] = null; continue; }
      if (typeof sv === 'string') { safeSummary[sk] = safeString(sv, maxLen); continue; }
      if (typeof sv === 'number') { safeSummary[sk] = safeNumber(sv); continue; }
      if (typeof sv === 'boolean') { safeSummary[sk] = sv; continue; }
      // skip non-scalar
    }

    var safeMeta = {};
    var mKeys = Object.keys(metaSource);
    var m;
    for (m = 0; m < mKeys.length; m++) {
      var mk = mKeys[m];
      var mv = metaSource[mk];
      if (mv === null) { safeMeta[mk] = null; continue; }
      if (typeof mv === 'string') { safeMeta[mk] = safeString(mv, maxLen); continue; }
      if (typeof mv === 'number') { safeMeta[mk] = safeNumber(mv); continue; }
      if (typeof mv === 'boolean') { safeMeta[mk] = mv; continue; }
    }

    return {
      channel: r.channel,
      messageType: r.messageType,
      title: r.title,
      lines: Array.isArray(r.lines) ? r.lines : null,
      bucket: r.bucket,
      snapshotType: r.snapshotType,
      keyHint: r.keyHint,
      evaluationType: r.evaluationType,
      resultType: r.resultType,
      auditType: r.auditType,
      payloadSummary: safeSummary,
      metadata: safeMeta
    };
  }

  function buildTelegramEnvelope(input, cfg) {
    var blockedReasons = [];
    var warnings = [];
    var op = isPlainObject(input.operationPacket) ? input.operationPacket : null;
    var tp = isPlainObject(input.transportPlan) ? input.transportPlan : null;
    var rb = isPlainObject(input.rendererBinding) ? input.rendererBinding : null;
    var tpTele = (tp && isPlainObject(tp.telegramPlan)) ? tp.telegramPlan : null;
    var notifPacket = (op && isPlainObject(op.notificationPacket)) ? op.notificationPacket : null;

    // gating — never overrides false → true (DP-TX2)
    var shouldSend = (tpTele && tpTele.shouldSend === true);
    var allowTele = cfg.execution.allowTelegram === true;
    var dryRunOk = cfg.envelopeMode === ENVELOPE_MODE.DRY_RUN;

    if (!shouldSend) blockedReasons.push('NOT_ELIGIBLE_PLAN_FALSE');
    if (!allowTele) blockedReasons.push('CONFIG_DISALLOW_TELEGRAM');
    if (!dryRunOk) blockedReasons.push('NON_DRY_RUN_MODE_BLOCKED');

    var eligible = shouldSend && allowTele && dryRunOk;

    // payloadSummary (whitelist scalar only)
    var sums = buildSafePayloadSummary(input, cfg);
    var pi;
    for (pi = 0; pi < sums.warnings.length; pi++) warnings.push(sums.warnings[pi]);

    // metadata (whitelist scalar only; default empty)
    var metaSrc = notifPacket && isPlainObject(notifPacket.metadata) ? notifPacket.metadata : {};
    var metaResult = buildSafeMetadata(metaSrc, cfg);
    var mi;
    for (mi = 0; mi < metaResult.warnings.length; mi++) warnings.push(metaResult.warnings[mi]);

    // lines candidate — preview text (from rendererBinding.sections.transport titles, defensive)
    //   본 모듈은 telegram 메시지 본문을 새로 만들지 않는다 (DP-TX9). preview 라인 후보 만 추출.
    var previewLines = [];
    if (rb && isPlainObject(rb.sections) && Array.isArray(rb.sections.transport)) {
      var ti;
      for (ti = 0; ti < rb.sections.transport.length; ti++) {
        var item = rb.sections.transport[ti];
        if (!isPlainObject(item)) continue;
        var label = item.label;
        if (typeof label === 'string') previewLines.push(label);
      }
    }
    var sanitized = sanitizeMessageLines(previewLines, cfg);
    var li;
    for (li = 0; li < sanitized.warnings.length; li++) warnings.push(sanitized.warnings[li]);

    // channel / messageType — derive from notifPacket (string only)
    var channel = (notifPacket && typeof notifPacket.channel === 'string') ? notifPacket.channel : 'NONE';
    var messageType = (notifPacket && typeof notifPacket.type === 'string')
      ? notifPacket.type
      : ((tpTele && typeof tpTele.notificationType === 'string') ? tpTele.notificationType : 'NONE');
    var title = (notifPacket && typeof notifPacket.title === 'string') ? safeString(notifPacket.title, cfg.payloadSummary.maxStringLength) : null;

    var status = eligible
      ? ENVELOPE_STATUS.READY
      : (blockedReasons.length > 0 && blockedReasons.indexOf('NOT_ELIGIBLE_PLAN_FALSE') === -1)
        ? ENVELOPE_STATUS.BLOCKED
        : ENVELOPE_STATUS.SKIPPED;

    return {
      eligible: eligible,
      dryRunOnly: true,
      status: status,
      request: {
        channel: channel,
        messageType: messageType,
        title: title,
        lines: sanitized.lines,
        payloadSummary: sums.summary,
        metadata: metaResult.metadata
      },
      blockedReasons: blockedReasons,
      warnings: warnings
    };
  }

  function buildSnapshotEnvelope(input, cfg) {
    var blockedReasons = [];
    var warnings = [];
    var op = isPlainObject(input.operationPacket) ? input.operationPacket : null;
    var tp = isPlainObject(input.transportPlan) ? input.transportPlan : null;
    var tpSnap = (tp && isPlainObject(tp.snapshotPlan)) ? tp.snapshotPlan : null;
    var snapPacket = (op && isPlainObject(op.snapshotPacket)) ? op.snapshotPacket : null;

    var shouldStore = (tpSnap && tpSnap.shouldStore === true);
    var allowSnap = cfg.execution.allowSnapshot === true;
    var dryRunOk = cfg.envelopeMode === ENVELOPE_MODE.DRY_RUN;

    if (!shouldStore) blockedReasons.push('NOT_ELIGIBLE_PLAN_FALSE');
    if (!allowSnap) blockedReasons.push('CONFIG_DISALLOW_SNAPSHOT');
    if (!dryRunOk) blockedReasons.push('NON_DRY_RUN_MODE_BLOCKED');

    var eligible = shouldStore && allowSnap && dryRunOk;

    var sums = buildSafePayloadSummary(input, cfg);
    var pi;
    for (pi = 0; pi < sums.warnings.length; pi++) warnings.push(sums.warnings[pi]);

    var metaSrc = snapPacket && isPlainObject(snapPacket.metadata) ? snapPacket.metadata : {};
    var metaResult = buildSafeMetadata(metaSrc, cfg);
    var mi;
    for (mi = 0; mi < metaResult.warnings.length; mi++) warnings.push(metaResult.warnings[mi]);

    var bucket = (snapPacket && typeof snapPacket.bucket === 'string') ? snapPacket.bucket : 'NONE';
    var snapshotType = (tpSnap && typeof tpSnap.snapshotType === 'string') ? tpSnap.snapshotType : 'NONE';
    var keyHint = (snapPacket && typeof snapPacket.keyHint === 'string') ? safeString(snapPacket.keyHint, cfg.payloadSummary.maxStringLength) : null;
    if (keyHint === null && op && typeof op.candidateKey === 'string') {
      keyHint = safeString(op.candidateKey, cfg.payloadSummary.maxStringLength);
    }

    var status = eligible
      ? ENVELOPE_STATUS.READY
      : (blockedReasons.length > 0 && blockedReasons.indexOf('NOT_ELIGIBLE_PLAN_FALSE') === -1)
        ? ENVELOPE_STATUS.BLOCKED
        : ENVELOPE_STATUS.SKIPPED;

    return {
      eligible: eligible,
      dryRunOnly: true,
      status: status,
      request: {
        bucket: bucket,
        snapshotType: snapshotType,
        keyHint: keyHint,
        payloadSummary: sums.summary,
        metadata: metaResult.metadata
      },
      blockedReasons: blockedReasons,
      warnings: warnings
    };
  }

  function buildEvaluationEnvelope(input, cfg) {
    var blockedReasons = [];
    var warnings = [];
    var op = isPlainObject(input.operationPacket) ? input.operationPacket : null;
    var tp = isPlainObject(input.transportPlan) ? input.transportPlan : null;
    var ev = isPlainObject(input.evaluationOutcome) ? input.evaluationOutcome : null;
    var tpEval = (tp && isPlainObject(tp.evaluationPlan)) ? tp.evaluationPlan : null;
    var evSeed = (op && isPlainObject(op.evaluationSeed)) ? op.evaluationSeed : null;
    var evMain = (ev && isPlainObject(ev.evaluation)) ? ev.evaluation : null;

    var shouldStore = (tpEval && tpEval.shouldStore === true);
    var shouldUpdate = (tpEval && tpEval.shouldUpdate === true);
    var shouldClose = (tpEval && tpEval.shouldClose === true);
    var shouldReview = (tpEval && tpEval.shouldReview === true);
    var planActive = shouldStore || shouldUpdate || shouldClose || shouldReview;
    var allowEval = cfg.execution.allowEvaluation === true;
    var dryRunOk = cfg.envelopeMode === ENVELOPE_MODE.DRY_RUN;

    if (!planActive) blockedReasons.push('NOT_ELIGIBLE_PLAN_FALSE');
    if (!allowEval) blockedReasons.push('CONFIG_DISALLOW_EVALUATION');
    if (!dryRunOk) blockedReasons.push('NON_DRY_RUN_MODE_BLOCKED');

    var eligible = planActive && allowEval && dryRunOk;

    var sums = buildSafePayloadSummary(input, cfg);
    var pi;
    for (pi = 0; pi < sums.warnings.length; pi++) warnings.push(sums.warnings[pi]);

    var metaSrc = evSeed && isPlainObject(evSeed.metadata) ? evSeed.metadata : {};
    var metaResult = buildSafeMetadata(metaSrc, cfg);
    var mi;
    for (mi = 0; mi < metaResult.warnings.length; mi++) warnings.push(metaResult.warnings[mi]);

    var evaluationType = (tpEval && typeof tpEval.evaluationType === 'string') ? tpEval.evaluationType : 'NONE';
    var resultType = (evMain && typeof evMain.resultType === 'string') ? evMain.resultType : 'NONE';
    var keyHint = (evSeed && typeof evSeed.keyHint === 'string') ? safeString(evSeed.keyHint, cfg.payloadSummary.maxStringLength) : null;
    if (keyHint === null && ev && typeof ev.candidateKey === 'string') {
      keyHint = safeString(ev.candidateKey, cfg.payloadSummary.maxStringLength);
    }
    if (keyHint === null && op && typeof op.candidateKey === 'string') {
      keyHint = safeString(op.candidateKey, cfg.payloadSummary.maxStringLength);
    }

    var status = eligible
      ? ENVELOPE_STATUS.READY
      : (blockedReasons.length > 0 && blockedReasons.indexOf('NOT_ELIGIBLE_PLAN_FALSE') === -1)
        ? ENVELOPE_STATUS.BLOCKED
        : ENVELOPE_STATUS.SKIPPED;

    return {
      eligible: eligible,
      dryRunOnly: true,
      status: status,
      request: {
        evaluationType: evaluationType,
        resultType: resultType,
        keyHint: keyHint,
        payloadSummary: sums.summary,
        metadata: metaResult.metadata
      },
      blockedReasons: blockedReasons,
      warnings: warnings
    };
  }

  function buildAuditEnvelope(input, cfg) {
    var blockedReasons = [];
    var warnings = [];
    var op = isPlainObject(input.operationPacket) ? input.operationPacket : null;
    var tp = isPlainObject(input.transportPlan) ? input.transportPlan : null;
    var tpAudit = (tp && isPlainObject(tp.auditPlan)) ? tp.auditPlan : null;

    var shouldAudit = (tpAudit && tpAudit.shouldAudit === true);
    var allowAudit = cfg.execution.allowAudit === true;
    var dryRunOk = cfg.envelopeMode === ENVELOPE_MODE.DRY_RUN;

    if (!shouldAudit) blockedReasons.push('NOT_ELIGIBLE_PLAN_FALSE');
    if (!allowAudit) blockedReasons.push('CONFIG_DISALLOW_AUDIT');
    if (!dryRunOk) blockedReasons.push('NON_DRY_RUN_MODE_BLOCKED');

    var eligible = shouldAudit && allowAudit && dryRunOk;

    var sums = buildSafePayloadSummary(input, cfg);
    var pi;
    for (pi = 0; pi < sums.warnings.length; pi++) warnings.push(sums.warnings[pi]);

    var metaSrc = tpAudit && isPlainObject(tpAudit.metadata) ? tpAudit.metadata : {};
    var metaResult = buildSafeMetadata(metaSrc, cfg);
    var mi;
    for (mi = 0; mi < metaResult.warnings.length; mi++) warnings.push(metaResult.warnings[mi]);

    var auditType = (tpAudit && typeof tpAudit.auditTrigger === 'string')
      ? tpAudit.auditTrigger
      : ((tpAudit && typeof tpAudit.auditType === 'string') ? tpAudit.auditType : 'NONE');
    var keyHint = null;
    if (op && typeof op.candidateKey === 'string') {
      keyHint = safeString(op.candidateKey, cfg.payloadSummary.maxStringLength);
    }

    var status = eligible
      ? ENVELOPE_STATUS.READY
      : (blockedReasons.length > 0 && blockedReasons.indexOf('NOT_ELIGIBLE_PLAN_FALSE') === -1)
        ? ENVELOPE_STATUS.BLOCKED
        : ENVELOPE_STATUS.SKIPPED;

    return {
      eligible: eligible,
      dryRunOnly: true,
      status: status,
      request: {
        auditType: auditType,
        keyHint: keyHint,
        payloadSummary: sums.summary,
        metadata: metaResult.metadata
      },
      blockedReasons: blockedReasons,
      warnings: warnings
    };
  }

  // §summary / classify ─────────────────────────────────────────────────

  function buildEnvelopeSummary(envelopes /*, cfg */) {
    var readyCount = 0;
    var skippedCount = 0;
    var blockedCount = 0;
    var hasEligibleCandidate = false;
    var hasBlocker = false;

    var keys = ['telegramEnvelope', 'snapshotEnvelope', 'evaluationEnvelope', 'auditEnvelope'];
    var i;
    for (i = 0; i < keys.length; i++) {
      var e = envelopes[keys[i]];
      if (!isPlainObject(e)) continue;
      if (e.eligible === true) {
        hasEligibleCandidate = true;
        readyCount += 1;
      } else if (Array.isArray(e.blockedReasons) && e.blockedReasons.length > 0) {
        // 가짜 양성 회피 — pure plan-false 만 있으면 SKIPPED, mode/credential 등 진짜 차단이 있으면 BLOCKED
        var realBlock = false;
        var br;
        for (br = 0; br < e.blockedReasons.length; br++) {
          var rc = e.blockedReasons[br];
          if (rc !== 'NOT_ELIGIBLE_PLAN_FALSE') { realBlock = true; break; }
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
      skippedCount: skippedCount,
      blockedCount: blockedCount,
      hasEligibleCandidate: hasEligibleCandidate,
      hasBlocker: hasBlocker
    };
  }

  function classifyEnvelopeStatus(envelopes, safety, cfg) {
    // 1. INVALID — transportPlan 자체가 falsy (caller-level check)
    if (safety && safety.invalidPlan === true) return ENVELOPE_STATUS.INVALID;

    // 2. BLOCKED — non-dry-run mode / credential 감지
    if (safety && safety.modeBlocked === true) return ENVELOPE_STATUS.BLOCKED;
    if (safety && safety.credentialBlocked === true) return ENVELOPE_STATUS.BLOCKED;
    if (cfg && cfg.envelopeMode !== ENVELOPE_MODE.DRY_RUN) return ENVELOPE_STATUS.BLOCKED;
    if (cfg && cfg.dryRunOnly !== true) return ENVELOPE_STATUS.BLOCKED;

    var summary = buildEnvelopeSummary(envelopes);

    // 3. PARTIAL — 일부 eligible + 일부 blocked
    if (summary.hasEligibleCandidate && summary.hasBlocker) return ENVELOPE_STATUS.PARTIAL;

    // 4. READY — 일부 eligible + 0 blocked
    if (summary.hasEligibleCandidate && !summary.hasBlocker) return ENVELOPE_STATUS.READY;

    // 5. SKIPPED — 0 eligible + 0 blocked
    if (!summary.hasEligibleCandidate && !summary.hasBlocker) return ENVELOPE_STATUS.SKIPPED;

    // 6. UNKNOWN — fallback
    return ENVELOPE_STATUS.UNKNOWN;
  }

  // §normalize result shape lock
  function normalizeTransportExecution(result) {
    var out = {
      valid: result.valid === true,
      version: result.version,
      dryRun: result.dryRun === true,
      envelopeMode: typeof result.envelopeMode === 'string' ? result.envelopeMode : 'DRY_RUN',
      envelopeStatus: typeof result.envelopeStatus === 'string' ? result.envelopeStatus : ENVELOPE_STATUS.UNKNOWN,
      telegramEnvelope: result.telegramEnvelope,
      snapshotEnvelope: result.snapshotEnvelope,
      evaluationEnvelope: result.evaluationEnvelope,
      auditEnvelope: result.auditEnvelope,
      envelopeSummary: result.envelopeSummary,
      reasons: Array.isArray(result.reasons) ? result.reasons : [],
      warnings: Array.isArray(result.warnings) ? result.warnings : [],
      debug: result.debug,
      configUsed: result.configUsed
    };
    return out;
  }

  // §main entry ──────────────────────────────────────────────────────────

  function buildTransportExecution(input, config) {
    var inp = isPlainObject(input) ? input : {};
    var cfg = mergeTransportExecutionConfig(config);
    var reasons = [];
    var warnings = [];

    // STEP 1 — INVALID check (transportPlan)
    var tp = isPlainObject(inp.transportPlan) ? inp.transportPlan : null;
    var invalidPlan = (tp === null) || (tp.valid !== true);

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
    var dw;
    for (dw = 0; dw < credResult.depthWarnings.length; dw++) {
      warnings.push('DETECTION_DEPTH_LIMIT:' + credResult.depthWarnings[dw]);
    }

    // STEP 3 — mode block
    var modeBlocked = (cfg.envelopeMode !== ENVELOPE_MODE.DRY_RUN) || (cfg.dryRunOnly !== true);

    // STEP 4 — base envelope shape (default SKIPPED)
    var baseTele = {
      eligible: false,
      dryRunOnly: true,
      status: ENVELOPE_STATUS.SKIPPED,
      request: {
        channel: 'NONE',
        messageType: 'NONE',
        title: null,
        lines: [],
        payloadSummary: {},
        metadata: {}
      },
      blockedReasons: [],
      warnings: []
    };
    var baseSnap = {
      eligible: false,
      dryRunOnly: true,
      status: ENVELOPE_STATUS.SKIPPED,
      request: {
        bucket: 'NONE',
        snapshotType: 'NONE',
        keyHint: null,
        payloadSummary: {},
        metadata: {}
      },
      blockedReasons: [],
      warnings: []
    };
    var baseEval = {
      eligible: false,
      dryRunOnly: true,
      status: ENVELOPE_STATUS.SKIPPED,
      request: {
        evaluationType: 'NONE',
        resultType: 'NONE',
        keyHint: null,
        payloadSummary: {},
        metadata: {}
      },
      blockedReasons: [],
      warnings: []
    };
    var baseAudit = {
      eligible: false,
      dryRunOnly: true,
      status: ENVELOPE_STATUS.SKIPPED,
      request: {
        auditType: 'NONE',
        keyHint: null,
        payloadSummary: {},
        metadata: {}
      },
      blockedReasons: [],
      warnings: []
    };

    var teleEnv = baseTele;
    var snapEnv = baseSnap;
    var evalEnv = baseEval;
    var auditEnv = baseAudit;

    if (invalidPlan) {
      reasons.push('TRANSPORT_PLAN_INVALID');
    } else if (credBlocked) {
      reasons.push('CREDENTIAL_FIELD_DETECTED');
      // 모든 envelope blockedReasons + ENVELOPE_BLOCKED 강제
      var cb;
      for (cb = 0; cb < credResult.detections.length; cb++) {
        var path = credResult.detections[cb];
        baseTele.blockedReasons.push('SECRET_FIELD_BLOCKED:' + path);
        baseSnap.blockedReasons.push('SECRET_FIELD_BLOCKED:' + path);
        baseEval.blockedReasons.push('SECRET_FIELD_BLOCKED:' + path);
        baseAudit.blockedReasons.push('SECRET_FIELD_BLOCKED:' + path);
      }
      baseTele.status = ENVELOPE_STATUS.BLOCKED;
      baseSnap.status = ENVELOPE_STATUS.BLOCKED;
      baseEval.status = ENVELOPE_STATUS.BLOCKED;
      baseAudit.status = ENVELOPE_STATUS.BLOCKED;
    } else if (modeBlocked) {
      reasons.push('NON_DRY_RUN_MODE_BLOCKED');
      baseTele.blockedReasons.push('NON_DRY_RUN_MODE_BLOCKED');
      baseSnap.blockedReasons.push('NON_DRY_RUN_MODE_BLOCKED');
      baseEval.blockedReasons.push('NON_DRY_RUN_MODE_BLOCKED');
      baseAudit.blockedReasons.push('NON_DRY_RUN_MODE_BLOCKED');
      baseTele.status = ENVELOPE_STATUS.BLOCKED;
      baseSnap.status = ENVELOPE_STATUS.BLOCKED;
      baseEval.status = ENVELOPE_STATUS.BLOCKED;
      baseAudit.status = ENVELOPE_STATUS.BLOCKED;
    } else {
      // STEP 5 — normal envelope builds
      teleEnv = buildTelegramEnvelope(inp, cfg);
      snapEnv = buildSnapshotEnvelope(inp, cfg);
      evalEnv = buildEvaluationEnvelope(inp, cfg);
      auditEnv = buildAuditEnvelope(inp, cfg);
    }

    // STEP 6 — request shape lock (defensive)
    teleEnv.request = normalizeEnvelopeRequest({
      channel: teleEnv.request.channel,
      messageType: teleEnv.request.messageType,
      title: teleEnv.request.title,
      lines: teleEnv.request.lines,
      payloadSummary: teleEnv.request.payloadSummary,
      metadata: teleEnv.request.metadata
    }, cfg);
    snapEnv.request = normalizeEnvelopeRequest({
      bucket: snapEnv.request.bucket,
      snapshotType: snapEnv.request.snapshotType,
      keyHint: snapEnv.request.keyHint,
      payloadSummary: snapEnv.request.payloadSummary,
      metadata: snapEnv.request.metadata
    }, cfg);
    evalEnv.request = normalizeEnvelopeRequest({
      evaluationType: evalEnv.request.evaluationType,
      resultType: evalEnv.request.resultType,
      keyHint: evalEnv.request.keyHint,
      payloadSummary: evalEnv.request.payloadSummary,
      metadata: evalEnv.request.metadata
    }, cfg);
    auditEnv.request = normalizeEnvelopeRequest({
      auditType: auditEnv.request.auditType,
      keyHint: auditEnv.request.keyHint,
      payloadSummary: auditEnv.request.payloadSummary,
      metadata: auditEnv.request.metadata
    }, cfg);

    // STEP 7 — summary + classify
    var envelopes = {
      telegramEnvelope: teleEnv,
      snapshotEnvelope: snapEnv,
      evaluationEnvelope: evalEnv,
      auditEnvelope: auditEnv
    };
    var summary = buildEnvelopeSummary(envelopes);
    var safetyFlags = {
      invalidPlan: invalidPlan,
      modeBlocked: modeBlocked,
      credentialBlocked: credBlocked
    };
    var envelopeStatus = classifyEnvelopeStatus(envelopes, safetyFlags, cfg);

    // STEP 8 — top-level reasons
    if (envelopeStatus === ENVELOPE_STATUS.READY) reasons.push('ENVELOPE_READY');
    if (envelopeStatus === ENVELOPE_STATUS.PARTIAL) reasons.push('ENVELOPE_PARTIAL');
    if (envelopeStatus === ENVELOPE_STATUS.SKIPPED) reasons.push('ENVELOPE_SKIPPED');
    if (envelopeStatus === ENVELOPE_STATUS.UNKNOWN) reasons.push('ENVELOPE_UNKNOWN_FALLBACK');

    if (teleEnv.eligible) reasons.push('TELEGRAM_ENVELOPE_READY');
    if (snapEnv.eligible) reasons.push('SNAPSHOT_ENVELOPE_READY');
    if (evalEnv.eligible) reasons.push('EVALUATION_ENVELOPE_READY');
    if (auditEnv.eligible) reasons.push('AUDIT_ENVELOPE_READY');

    // STEP 9 — configUsed snapshot (scalar / shallow safe)
    var configUsed = {
      version: cfg.version,
      envelopeMode: cfg.envelopeMode,
      dryRunOnly: cfg.dryRunOnly,
      execution: {
        allowTelegram: cfg.execution.allowTelegram,
        allowSnapshot: cfg.execution.allowSnapshot,
        allowEvaluation: cfg.execution.allowEvaluation,
        allowAudit: cfg.execution.allowAudit
      },
      safety: {
        blockCredentialFields: cfg.safety.blockCredentialFields,
        credentialMaxDepth: cfg.safety.credentialMaxDepth,
        credentialAllowListSize: cfg.safety.credentialAllowList.length,
        allowRawPayload: cfg.safety.allowRawPayload,
        allowLiveExecution: cfg.safety.allowLiveExecution,
        allowWebhookUrl: cfg.safety.allowWebhookUrl
      },
      payloadSummary: {
        maxStringLength: cfg.payloadSummary.maxStringLength,
        allowedFieldCount: cfg.payloadSummary.allowedFields.length,
        metadataAllowedFieldCount: cfg.payloadSummary.metadataAllowedFields.length
      },
      wording: {
        dryRunOnly: cfg.wording.dryRunOnly,
        sanitizeMode: cfg.wording.sanitizeMode
      }
    };

    // STEP 10 — final shape lock
    var resultDraft = {
      valid: invalidPlan ? false : true,
      version: TRANSPORT_EXECUTION_VERSION,
      dryRun: true,
      envelopeMode: cfg.envelopeMode === ENVELOPE_MODE.DRY_RUN ? 'DRY_RUN' : cfg.envelopeMode,
      envelopeStatus: envelopeStatus,
      telegramEnvelope: teleEnv,
      snapshotEnvelope: snapEnv,
      evaluationEnvelope: evalEnv,
      auditEnvelope: auditEnv,
      envelopeSummary: summary,
      reasons: reasons,
      warnings: warnings,
      debug: {
        source: 'transportPlan + rendererBinding + operationPacket + activeCycleDecision + evaluationOutcome + externalConfluence',
        configVersion: cfg.version,
        invalidPlan: invalidPlan,
        modeBlocked: modeBlocked,
        credentialBlocked: credBlocked,
        credentialDetections: credResult.detections.length,
        credentialDepthWarnings: credResult.depthWarnings.length
      },
      configUsed: configUsed
    };

    return normalizeTransportExecution(resultDraft);
  }

  // §export ─────────────────────────────────────────────────────────────

  var api = Object.freeze({
    VERSION: TRANSPORT_EXECUTION_VERSION,
    DEFAULT_TRANSPORT_EXECUTION_CONFIG: DEFAULT_TRANSPORT_EXECUTION_CONFIG,
    ENVELOPE_MODE: ENVELOPE_MODE,
    ENVELOPE_STATUS: ENVELOPE_STATUS,
    WORDING_SANITIZE_MODE: WORDING_SANITIZE_MODE,
    build: buildTransportExecution,
    mergeTransportExecutionConfig: mergeTransportExecutionConfig,
    buildTelegramEnvelope: buildTelegramEnvelope,
    buildSnapshotEnvelope: buildSnapshotEnvelope,
    buildEvaluationEnvelope: buildEvaluationEnvelope,
    buildAuditEnvelope: buildAuditEnvelope,
    buildSafePayloadSummary: buildSafePayloadSummary,
    classifyEnvelopeStatus: classifyEnvelopeStatus,
    detectCredentialFields: detectCredentialFields,
    isCredentialKey: isCredentialKey,
    sanitizeMessageLines: sanitizeMessageLines
  });

  global.WS3_TransportExecutionAdapter = api;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
