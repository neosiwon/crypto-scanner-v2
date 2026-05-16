/**
 * WS3 v0.12.0 — TransportPlan (Adapter Output Contract Pack)
 *
 * Scope:
 *   operationPacket (v0.8.0) + activeCycleDecision (v0.9.0) +
 *   evaluationOutcome (v0.10.0) + externalConfluence (v0.11.0)
 *   → standalone TransportPlan (dry-run plan)
 *
 * 단일 기준 문서:
 *   docs/ws3/WS3_CODE_CONTRACT.md (b-r2 박제본)
 *
 * 확정 DP 정책 (Gate 2 spec):
 *   DP-APO1   output adapter contract 만. 실제 Telegram / KV / DOM 구현 X.
 *   DP-APO2   v0.11.0 입력 layer / v0.12.0 출력 layer.
 *   DP-APO3   TransportPlan dry-run plan 만. 실제 발송 / 저장 금지.
 *   DP-APO4   기존 routing 재해석 금지. AND 집계만. auditPlan 은 mismatch/warning/review
 *             후보 기록 허용.
 *   DP-APO7   ExternalConfluence 는 참고만. scoreBreakdown / strategyPlan 대체 금지.
 *   DP-APO8   입력 4종 read-only.
 *   DP-APO9   side-effect 금지 (fetch / Telegram / KV / DB / DOM / storage /
 *             런타임 clock).
 *   DP-APO10  신규 파일 2개 + 문서 갱신만. 보호 파일 수정 금지.
 *
 * U-APO 확정 처리:
 *   N-APO-OBS-2 — cfg.audit.warningAuditMode = 'critical' 기본값 (Gate 2 spec).
 *                 critical warning 후보:
 *                   DATA_AMBIGUOUS / DATA_INSUFFICIENT / PATH_ORDER_UNKNOWN /
 *                   ROUTING_CONFLICT / SUPPRESSED_NOTIFY /
 *                   SECRET_FIELD_BLOCKED / RAW_INPUT_BLOCKED
 *
 * snapshotPlan 시점 정책:
 *   snapshotPlan = signal snapshot 저장 후보 (operationPacket / activeCycleDecision 시점).
 *   outcome 시점의 저장은 evaluationPlan 이 담당.
 *   snapshotPlan.shouldStore 는 evaluationOutcome.routingDecision.shouldStoreOutcome
 *   을 참조하지 않음.
 *
 * 금지 (이번 단계):
 *   외부 전송 / 알림 발송 / 메시지 채널 직접 호출.
 *   영속 저장 (KV / DB / 파일 IO / 브라우저 storage).
 *   network 호출 / XHR / 외부 데이터 가져오기.
 *   DOM 트리 직접 조작.
 *   런타임 clock API 사용.
 *   입력 4종 mutation / delete.
 *   "발송됨 / 저장됨 / 전송 완료 / sent / delivered / completed transmission" 문구.
 *   bot 식별 시크릿 / 채널 식별자 / API 키.
 *   raw payload 객체 / payload.raw / payload.raw.builderDebug 직접 노출.
 *
 * 의존:
 *   operationPacket           (v3-operation-packet.js 산출)
 *   activeCycleDecision       (v3-active-cycle.js 산출)
 *   evaluationOutcome         (v3-evaluation-outcome.js 산출)
 *   externalConfluence        (v3-external-confluence.js 산출)
 */

(function (global) {
  'use strict';

  var TRANSPORT_PLAN_VERSION = 'WS3_v0.12.0_transport_plan';
  var CONFIG_VERSION = 'inline-default-v0';

  // ==========================================================================
  // 상수
  // ==========================================================================
  var TELEGRAM_CHANNEL = Object.freeze({
    NONE: 'NONE',
    TELEGRAM_CANDIDATE: 'TELEGRAM_CANDIDATE'
  });

  var MESSAGE_TYPE = Object.freeze({
    NONE: 'NONE',
    WATCH: 'WATCH',
    READY: 'READY',
    BLOCKED: 'BLOCKED',
    COOLDOWN: 'COOLDOWN',
    EXPIRED: 'EXPIRED'
  });

  var SNAPSHOT_BUCKET = Object.freeze({
    NONE: 'NONE',
    CANDIDATE_SNAPSHOT: 'CANDIDATE_SNAPSHOT',
    STATE_SNAPSHOT: 'STATE_SNAPSHOT',
    DEBUG_SNAPSHOT: 'DEBUG_SNAPSHOT'
  });

  var AUDIT_TYPE = Object.freeze({
    NONE: 'NONE',
    ROUTING_CONFLICT: 'ROUTING_CONFLICT',
    DATA_AMBIGUOUS: 'DATA_AMBIGUOUS',
    DATA_INSUFFICIENT: 'DATA_INSUFFICIENT',
    REVIEW_REQUIRED: 'REVIEW_REQUIRED',
    SUPPRESSED_NOTIFY: 'SUPPRESSED_NOTIFY',
    WARNING_PRESENT: 'WARNING_PRESENT'
  });

  // critical warning 후보 (N-APO-OBS-2)
  var CRITICAL_WARNINGS = Object.freeze([
    'DATA_AMBIGUOUS', 'DATA_INSUFFICIENT', 'PATH_ORDER_UNKNOWN',
    'ROUTING_CONFLICT', 'SUPPRESSED_NOTIFY',
    'SECRET_FIELD_BLOCKED', 'RAW_INPUT_BLOCKED'
  ]);

  var WARNING_AUDIT_MODES = Object.freeze({
    ALL: 'all',
    CRITICAL: 'critical',
    OFF: 'off'
  });

  // ==========================================================================
  // DEFAULT_TRANSPORT_PLAN_CONFIG
  // ==========================================================================
  var DEFAULT_TRANSPORT_PLAN_CONFIG = Object.freeze({
    version: CONFIG_VERSION,
    dryRun: true,
    audit: Object.freeze({
      warningAuditMode: 'critical',
      suppressReviewAudit: false
    }),
    wording: Object.freeze({
      dryRunOnly: true
    }),
    debug: Object.freeze({
      enabled: false,
      allowedFields: Object.freeze([])
    })
  });

  function mergeTransportPlanConfig(config) {
    var c = config || {};
    var d = DEFAULT_TRANSPORT_PLAN_CONFIG;
    var au = c.audit || {};
    var wd = c.wording || {};
    var dbg = c.debug || {};
    var mode = safeString(au.warningAuditMode, d.audit.warningAuditMode);
    if (mode !== 'all' && mode !== 'critical' && mode !== 'off') mode = d.audit.warningAuditMode;
    return {
      version: typeof c.version === 'string' ? c.version : d.version,
      dryRun: c.dryRun !== false,
      audit: {
        warningAuditMode: mode,
        suppressReviewAudit: au.suppressReviewAudit === true
      },
      wording: {
        dryRunOnly: wd.dryRunOnly !== false
      },
      debug: {
        enabled: dbg.enabled === true,
        allowedFields: Array.isArray(dbg.allowedFields)
          ? dbg.allowedFields.filter(function (f) { return typeof f === 'string' && f; })
          : []
      }
    };
  }

  function makeConfigUsed(cfg) {
    return {
      dryRun: cfg.dryRun,
      audit: {
        warningAuditMode: cfg.audit.warningAuditMode,
        suppressReviewAudit: cfg.audit.suppressReviewAudit
      },
      wording: { dryRunOnly: cfg.wording.dryRunOnly },
      debug: {
        enabled: cfg.debug.enabled,
        allowedFields: cfg.debug.allowedFields.slice()
      }
    };
  }

  // ==========================================================================
  // 공통 helper
  // ==========================================================================
  function safeString(value, fallback) {
    if (typeof value === 'string' && value) return value;
    return (typeof fallback === 'string') ? fallback : null;
  }

  function isPlainObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  function pushReason(target, code, detail) {
    if (!target || !Array.isArray(target.reasons)) return;
    if (typeof code !== 'string' || !code) return;
    var entry = (detail === undefined || detail === null) ? code : (code + ':' + String(detail));
    if (target.reasons.indexOf(entry) === -1) target.reasons.push(entry);
  }

  function pushWarning(target, code, detail) {
    if (!target || !Array.isArray(target.warnings)) return;
    if (typeof code !== 'string' || !code) return;
    var entry = (detail === undefined || detail === null) ? code : (code + ':' + String(detail));
    if (target.warnings.indexOf(entry) === -1) target.warnings.push(entry);
  }

  function pickArray(value) {
    return Array.isArray(value) ? value : [];
  }

  // ==========================================================================
  // §getOperationRouting / §getActiveCycleRouting / §getEvaluationRouting
  // ==========================================================================
  function getOperationRouting(operationPacket) {
    var out = {
      valid: false,
      shouldNotify: false, shouldSnapshot: false, shouldEvaluate: false,
      notificationChannel: 'NONE', snapshotBucket: 'NONE', evaluationWindow: 'NONE',
      notificationType: 'NONE', snapshotType: 'NONE', evaluationType: 'NONE',
      warnings: []
    };
    if (!isPlainObject(operationPacket)) return out;
    out.valid = operationPacket.valid === true;
    var r = isPlainObject(operationPacket.routing) ? operationPacket.routing : null;
    if (r) {
      out.shouldNotify = r.shouldNotify === true;
      out.shouldSnapshot = r.shouldSnapshot === true;
      out.shouldEvaluate = r.shouldEvaluate === true;
      out.notificationChannel = safeString(r.notificationChannel, 'NONE');
      out.snapshotBucket = safeString(r.snapshotBucket, 'NONE');
      out.evaluationWindow = safeString(r.evaluationWindow, 'NONE');
    }
    if (isPlainObject(operationPacket.notificationPacket)) {
      out.notificationType = safeString(operationPacket.notificationPacket.type, 'NONE');
    }
    if (isPlainObject(operationPacket.snapshotPacket)) {
      out.snapshotType = safeString(operationPacket.snapshotPacket.snapshotType, 'NONE');
    }
    if (isPlainObject(operationPacket.evaluationSeed)) {
      out.evaluationType = safeString(operationPacket.evaluationSeed.evaluationType, 'NONE');
    }
    return out;
  }

  function getActiveCycleRouting(activeCycleDecision) {
    var out = {
      valid: false,
      allowNotify: false, allowSnapshot: false, allowEvaluate: false,
      suppressNotify: false, suppressReason: null,
      snapshotMode: 'NONE', evaluationMode: 'NONE',
      canNotify: false, canSnapshot: false, canEvaluate: false,
      notifyCooldownActive: false, signalCooldownActive: false, duplicateSuppressed: false,
      notificationType: 'NONE', snapshotType: 'NONE', evaluationType: 'NONE',
      lifecycleState: 'NONE',
      warnings: []
    };
    if (!isPlainObject(activeCycleDecision)) return out;
    out.valid = activeCycleDecision.valid === true;
    var rd = isPlainObject(activeCycleDecision.routingDecision) ? activeCycleDecision.routingDecision : null;
    if (rd) {
      out.allowNotify = rd.allowNotify === true;
      out.allowSnapshot = rd.allowSnapshot === true;
      out.allowEvaluate = rd.allowEvaluate === true;
      out.suppressNotify = rd.suppressNotify === true;
      out.suppressReason = safeString(rd.suppressReason, null);
      out.snapshotMode = safeString(rd.snapshotMode, 'NONE');
      out.evaluationMode = safeString(rd.evaluationMode, 'NONE');
    }
    var np = isPlainObject(activeCycleDecision.notifyPolicy) ? activeCycleDecision.notifyPolicy : null;
    if (np) {
      out.canNotify = np.canNotify === true;
      out.notifyCooldownActive = np.notifyCooldownActive === true;
      out.signalCooldownActive = np.signalCooldownActive === true;
      out.duplicateSuppressed = np.duplicateSuppressed === true;
      out.notificationType = safeString(np.notificationType, 'NONE');
    }
    var sp = isPlainObject(activeCycleDecision.snapshotPolicy) ? activeCycleDecision.snapshotPolicy : null;
    if (sp) {
      out.canSnapshot = sp.canSnapshot === true;
      out.snapshotType = safeString(sp.snapshotType, 'NONE');
    }
    var ep = isPlainObject(activeCycleDecision.evaluationPolicy) ? activeCycleDecision.evaluationPolicy : null;
    if (ep) {
      out.canEvaluate = ep.canEvaluate === true;
      out.evaluationType = safeString(ep.evaluationType, 'NONE');
    }
    if (isPlainObject(activeCycleDecision.lifecycle)) {
      out.lifecycleState = safeString(activeCycleDecision.lifecycle.lifecycleState, 'NONE');
    }
    return out;
  }

  function getEvaluationRouting(evaluationOutcome) {
    var out = {
      valid: false,
      shouldStoreOutcome: false,
      shouldUpdateEvaluation: false,
      shouldCloseEvaluation: false,
      shouldReview: false,
      resultType: 'NONE',
      status: 'UNKNOWN',
      warnings: []
    };
    if (!isPlainObject(evaluationOutcome)) return out;
    out.valid = evaluationOutcome.valid === true;
    var rd = isPlainObject(evaluationOutcome.routingDecision) ? evaluationOutcome.routingDecision : null;
    if (rd) {
      out.shouldStoreOutcome = rd.shouldStoreOutcome === true;
      out.shouldUpdateEvaluation = rd.shouldUpdateEvaluation === true;
      out.shouldCloseEvaluation = rd.shouldCloseEvaluation === true;
      out.shouldReview = rd.shouldReview === true;
    }
    if (isPlainObject(evaluationOutcome.evaluation)) {
      out.resultType = safeString(evaluationOutcome.evaluation.resultType, 'NONE');
      out.status = safeString(evaluationOutcome.evaluation.status, 'UNKNOWN');
    }
    return out;
  }

  // ==========================================================================
  // §buildTelegramPlan (§4.1)
  // ==========================================================================
  function buildTelegramPlan(operationPacket, activeCycleDecision, externalConfluence, cfg) {
    var ctx = {
      shouldSend: false,
      channel: TELEGRAM_CHANNEL.NONE,
      messageType: MESSAGE_TYPE.NONE,
      title: null,
      lines: [],
      warnings: [],
      reasons: []
    };

    var op = getOperationRouting(operationPacket);
    var ac = getActiveCycleRouting(activeCycleDecision);

    // AND 집계 (DP-APO4)
    ctx.shouldSend = (op.shouldNotify === true)
                     && (ac.allowNotify === true)
                     && (ac.suppressNotify !== true)
                     && (ac.canNotify === true);

    if (ctx.shouldSend) {
      ctx.channel = TELEGRAM_CHANNEL.TELEGRAM_CANDIDATE;
      pushReason(ctx, 'NOTIFY_PLAN_ALL_GREEN');
    } else {
      if (!op.shouldNotify) pushReason(ctx, 'NOTIFY_BLOCKED_BY_OPERATION');
      if (!ac.allowNotify) pushReason(ctx, 'NOTIFY_BLOCKED_BY_ACTIVE_CYCLE');
      if (ac.suppressNotify === true) pushReason(ctx, 'NOTIFY_BLOCKED_BY_SUPPRESS', ac.suppressReason || 'SUPPRESS');
      if (!ac.canNotify) pushReason(ctx, 'NOTIFY_BLOCKED_BY_POLICY');
    }

    // messageType — operationPacket.notificationPacket.type 그대로 사용
    var msgType = op.notificationType;
    if (msgType === 'NONE' || !msgType) msgType = ac.notificationType;
    if (msgType === 'WATCH' || msgType === 'READY' || msgType === 'BLOCKED'
        || msgType === 'COOLDOWN' || msgType === 'EXPIRED') {
      ctx.messageType = msgType;
    }

    // title — safe identity (v0.7.0 cardViewModel.header 와 별도. 본 모듈은 operationPacket.displaySummary 사용 가능)
    if (isPlainObject(operationPacket) && isPlainObject(operationPacket.displaySummary)) {
      ctx.title = safeString(operationPacket.displaySummary.title, null);
    }

    // lines — dry-run 안전 문구 (DP-APO9, 발송됨/sent 등 금지)
    if (cfg.wording.dryRunOnly === true) {
      if (ctx.shouldSend) {
        ctx.lines.push({ key: 'SEND_CANDIDATE', labelKo: '발송 후보', tone: 'info' });
      } else if (ac.suppressNotify === true) {
        ctx.lines.push({ key: 'SUPPRESS_NOTICE', labelKo: '발송 보류', tone: 'caution' });
      }
    }

    return ctx;
  }

  // ==========================================================================
  // §buildSnapshotPlan (§4.2 — signal snapshot 시점)
  // ==========================================================================
  function buildSnapshotPlan(operationPacket, activeCycleDecision, cfg) {
    var ctx = {
      shouldStore: false,
      bucket: SNAPSHOT_BUCKET.NONE,
      snapshotType: 'NONE',
      payloadSummary: {},
      warnings: [],
      reasons: []
    };

    var op = getOperationRouting(operationPacket);
    var ac = getActiveCycleRouting(activeCycleDecision);

    // AND 집계 — evaluationOutcome 참조 없음 (signal snapshot 시점)
    ctx.shouldStore = (op.shouldSnapshot === true)
                      && (ac.allowSnapshot === true)
                      && (ac.canSnapshot === true);

    if (ctx.shouldStore) {
      ctx.bucket = safeString(op.snapshotBucket, SNAPSHOT_BUCKET.NONE);
      if (ctx.bucket === 'NONE' || !ctx.bucket) ctx.bucket = SNAPSHOT_BUCKET.STATE_SNAPSHOT;
      ctx.snapshotType = safeString(op.snapshotType, 'NONE');
      pushReason(ctx, 'SNAPSHOT_PLAN_ALL_GREEN');
    } else {
      if (!op.shouldSnapshot) pushReason(ctx, 'SNAPSHOT_BLOCKED_BY_OPERATION');
      if (!ac.allowSnapshot) pushReason(ctx, 'SNAPSHOT_BLOCKED_BY_ACTIVE_CYCLE');
      if (!ac.canSnapshot) pushReason(ctx, 'SNAPSHOT_BLOCKED_BY_POLICY');
    }

    // payloadSummary — safe scalar 만 (raw 노출 금지)
    ctx.payloadSummary = {
      notificationType: op.notificationType,
      snapshotType: op.snapshotType,
      snapshotMode: ac.snapshotMode,
      lifecycleState: ac.lifecycleState
    };

    return ctx;
  }

  // ==========================================================================
  // §buildEvaluationPlan (§4.3 / §4.4 / §4.5 / §4.6)
  // ==========================================================================
  function buildEvaluationPlan(operationPacket, activeCycleDecision, evaluationOutcome, cfg) {
    var ctx = {
      shouldStore: false,
      shouldUpdate: false,
      shouldClose: false,
      shouldReview: false,
      resultType: 'NONE',
      payloadSummary: {},
      warnings: [],
      reasons: []
    };

    var op = getOperationRouting(operationPacket);
    var ac = getActiveCycleRouting(activeCycleDecision);
    var ev = getEvaluationRouting(evaluationOutcome);

    // shouldStore — 4-stage AND
    ctx.shouldStore = (op.shouldEvaluate === true)
                      && (ac.allowEvaluate === true)
                      && (ac.canEvaluate === true)
                      && (ev.shouldStoreOutcome === true);

    // shouldUpdate / shouldClose / shouldReview — evaluationOutcome 단일 소스
    ctx.shouldUpdate = ev.shouldUpdateEvaluation === true;
    ctx.shouldClose = ev.shouldCloseEvaluation === true;
    ctx.shouldReview = ev.shouldReview === true;

    ctx.resultType = safeString(ev.resultType, 'NONE');

    if (ctx.shouldStore) pushReason(ctx, 'EVALUATE_PLAN_ALL_GREEN');
    else {
      if (!op.shouldEvaluate) pushReason(ctx, 'EVALUATE_BLOCKED_BY_OPERATION');
      if (!ac.allowEvaluate) pushReason(ctx, 'EVALUATE_BLOCKED_BY_ACTIVE_CYCLE');
      if (!ac.canEvaluate) pushReason(ctx, 'EVALUATE_BLOCKED_BY_POLICY');
      if (!ev.shouldStoreOutcome) pushReason(ctx, 'EVALUATE_BLOCKED_BY_OUTCOME');
    }

    if (ctx.shouldUpdate) pushReason(ctx, 'EVALUATE_UPDATE');
    if (ctx.shouldClose) pushReason(ctx, 'EVALUATE_CLOSE');
    if (ctx.shouldReview) pushReason(ctx, 'EVALUATE_REVIEW');

    ctx.payloadSummary = {
      evaluationType: op.evaluationType,
      evaluationMode: ac.evaluationMode,
      resultType: ev.resultType,
      status: ev.status
    };

    return ctx;
  }

  // ==========================================================================
  // §detectRoutingConflict (§5.3)
  // ==========================================================================
  function detectRoutingConflict(operationRouting, activeRouting, evaluationRouting, cfg) {
    var conflicts = [];

    // notify conflict
    if (operationRouting.shouldNotify === true
        && (activeRouting.allowNotify !== true
            || activeRouting.suppressNotify === true
            || activeRouting.canNotify !== true)) {
      conflicts.push('ROUTING_CONFLICT_NOTIFY');
    }

    // snapshot conflict
    if (operationRouting.shouldSnapshot === true
        && (activeRouting.allowSnapshot !== true
            || activeRouting.canSnapshot !== true)) {
      conflicts.push('ROUTING_CONFLICT_SNAPSHOT');
    }

    // evaluation conflict
    if (operationRouting.shouldEvaluate === true
        && (activeRouting.allowEvaluate !== true
            || activeRouting.canEvaluate !== true
            || evaluationRouting.shouldStoreOutcome !== true)) {
      conflicts.push('ROUTING_CONFLICT_EVALUATION');
    }

    return conflicts;
  }

  // ==========================================================================
  // §isCriticalWarning (N-APO-OBS-2)
  // ==========================================================================
  function isCriticalWarning(code) {
    if (typeof code !== 'string' || !code) return false;
    for (var i = 0; i < CRITICAL_WARNINGS.length; i = i + 1) {
      var crit = CRITICAL_WARNINGS[i];
      if (code === crit) return true;
      // prefix match (e.g., "UNIT_AMBIGUOUS:target" 같은 case 도 처리. critical 전체 일치만 우선)
      if (code.indexOf(crit) === 0) return true;
    }
    return false;
  }

  function collectInputWarnings(input) {
    var collected = [];
    var sources = ['operationPacket', 'activeCycleDecision', 'evaluationOutcome', 'externalConfluence'];
    for (var i = 0; i < sources.length; i = i + 1) {
      var src = input[sources[i]];
      if (!isPlainObject(src)) continue;
      var arr = pickArray(src.warnings);
      for (var j = 0; j < arr.length; j = j + 1) {
        var w = arr[j];
        if (typeof w === 'string' && w) collected.push({ source: sources[i], code: w });
      }
    }
    return collected;
  }

  function shouldTriggerWarningAudit(inputWarnings, cfg) {
    var mode = cfg.audit.warningAuditMode;
    if (mode === 'off') return false;
    if (mode === 'all') return inputWarnings.length > 0;
    // 'critical'
    for (var i = 0; i < inputWarnings.length; i = i + 1) {
      if (isCriticalWarning(inputWarnings[i].code)) return true;
    }
    return false;
  }

  // ==========================================================================
  // §classifyAuditType (§5.2)
  // ==========================================================================
  function classifyAuditType(triggers) {
    // 우선순위:
    // 1. ROUTING_CONFLICT  2. DATA_AMBIGUOUS  3. DATA_INSUFFICIENT
    // 4. REVIEW_REQUIRED   5. SUPPRESSED_NOTIFY  6. WARNING_PRESENT  7. NONE
    if (triggers.routingConflict) return AUDIT_TYPE.ROUTING_CONFLICT;
    if (triggers.dataAmbiguous) return AUDIT_TYPE.DATA_AMBIGUOUS;
    if (triggers.dataInsufficient) return AUDIT_TYPE.DATA_INSUFFICIENT;
    if (triggers.reviewRequired) return AUDIT_TYPE.REVIEW_REQUIRED;
    if (triggers.suppressedNotify) return AUDIT_TYPE.SUPPRESSED_NOTIFY;
    if (triggers.warningPresent) return AUDIT_TYPE.WARNING_PRESENT;
    return AUDIT_TYPE.NONE;
  }

  // ==========================================================================
  // §buildAuditPlan (§5)
  // ==========================================================================
  function buildAuditPlan(input, transportPartial, cfg) {
    var ctx = {
      shouldAudit: false,
      auditType: AUDIT_TYPE.NONE,
      reasons: [],
      warnings: []
    };

    var op = getOperationRouting(input.operationPacket);
    var ac = getActiveCycleRouting(input.activeCycleDecision);
    var ev = getEvaluationRouting(input.evaluationOutcome);

    var conflicts = detectRoutingConflict(op, ac, ev, cfg);

    var inputWarnings = collectInputWarnings(input);
    var warningTrigger = shouldTriggerWarningAudit(inputWarnings, cfg);

    var resultType = ev.resultType;
    var dataAmbiguous = (resultType === 'DATA_AMBIGUOUS');
    var dataInsufficient = (resultType === 'DATA_INSUFFICIENT');
    var reviewRequired = (ev.shouldReview === true);
    var suppressedNotify = (ac.suppressNotify === true);

    // cfg.audit.suppressReviewAudit
    if (cfg.audit.suppressReviewAudit === true) {
      // REVIEW_REQUIRED audit 생략
      reviewRequired = false;
    }

    var triggers = {
      routingConflict: conflicts.length > 0,
      dataAmbiguous: dataAmbiguous,
      dataInsufficient: dataInsufficient,
      reviewRequired: reviewRequired,
      suppressedNotify: suppressedNotify,
      warningPresent: warningTrigger
    };

    ctx.shouldAudit = triggers.routingConflict
                    || triggers.dataAmbiguous
                    || triggers.dataInsufficient
                    || triggers.reviewRequired
                    || triggers.suppressedNotify
                    || triggers.warningPresent;

    ctx.auditType = classifyAuditType(triggers);

    // reasons 기록 (DP-APO4 — mismatch / warning / review 후보 기록 허용)
    for (var i = 0; i < conflicts.length; i = i + 1) pushReason(ctx, conflicts[i]);
    if (dataAmbiguous) pushReason(ctx, 'DATA_AMBIGUOUS_OUTCOME');
    if (dataInsufficient) pushReason(ctx, 'DATA_INSUFFICIENT_OUTCOME');
    if (reviewRequired) pushReason(ctx, 'EVALUATION_REVIEW_REQUIRED');
    if (suppressedNotify) pushReason(ctx, 'SUPPRESS_NOTIFY', ac.suppressReason || 'SUPPRESS');
    if (warningTrigger) {
      for (var j = 0; j < inputWarnings.length; j = j + 1) {
        var w = inputWarnings[j];
        if (cfg.audit.warningAuditMode === 'critical' && !isCriticalWarning(w.code)) continue;
        pushReason(ctx, 'WARNING_PRESENT_' + w.source.toUpperCase(), w.code);
      }
    }

    return ctx;
  }

  // ==========================================================================
  // §normalize 출력
  // ==========================================================================
  function normalizeTransportPlan(result) {
    return {
      valid: result.valid === true,
      version: TRANSPORT_PLAN_VERSION,
      dryRun: result.dryRun !== false,
      telegramPlan: result.telegramPlan,
      snapshotPlan: result.snapshotPlan,
      evaluationPlan: result.evaluationPlan,
      auditPlan: result.auditPlan,
      reasons: pickArray(result.reasons).slice(),
      warnings: pickArray(result.warnings).slice(),
      debug: result.debug,
      configUsed: result.configUsed
    };
  }

  // ==========================================================================
  // §main — buildTransportPlan
  // ==========================================================================
  /**
   * dry-run plan. 입력 4종 mutate 0건 (DP-APO8).
   *
   * @param {Object} [input]
   *   { operationPacket, activeCycleDecision, evaluationOutcome, externalConfluence }
   * @param {Object} [config]
   * @return {Object} transportPlan
   */
  function buildTransportPlan(input, config) {
    var cfg = mergeTransportPlanConfig(config);
    var configUsed = makeConfigUsed(cfg);
    var inp = isPlainObject(input) ? input : {};

    var topReasons = [];
    var topWarnings = [];

    var telegramPlan = buildTelegramPlan(inp.operationPacket, inp.activeCycleDecision, inp.externalConfluence, cfg);
    var snapshotPlan = buildSnapshotPlan(inp.operationPacket, inp.activeCycleDecision, cfg);
    var evaluationPlan = buildEvaluationPlan(inp.operationPacket, inp.activeCycleDecision, inp.evaluationOutcome, cfg);

    // partial transport (for audit derivation context)
    var transportPartial = {
      telegramPlan: telegramPlan,
      snapshotPlan: snapshotPlan,
      evaluationPlan: evaluationPlan
    };
    var auditPlan = buildAuditPlan(inp, transportPartial, cfg);

    var valid = isPlainObject(inp.operationPacket)
                && isPlainObject(inp.activeCycleDecision);
    if (!isPlainObject(inp.operationPacket)) topWarnings.push('OPERATION_PACKET_NOT_OBJECT');
    if (!isPlainObject(inp.activeCycleDecision)) topWarnings.push('ACTIVE_CYCLE_DECISION_NOT_OBJECT');

    if (telegramPlan.shouldSend) topReasons.push('TELEGRAM_PLAN_READY');
    else topReasons.push('TELEGRAM_PLAN_SKIPPED');
    if (snapshotPlan.shouldStore) topReasons.push('SNAPSHOT_PLAN_READY');
    if (evaluationPlan.shouldStore) topReasons.push('EVALUATION_PLAN_READY');
    if (auditPlan.shouldAudit) topReasons.push('AUDIT_PLAN_TRIGGERED:' + auditPlan.auditType);

    return normalizeTransportPlan({
      valid: valid,
      dryRun: cfg.dryRun !== false,
      telegramPlan: telegramPlan,
      snapshotPlan: snapshotPlan,
      evaluationPlan: evaluationPlan,
      auditPlan: auditPlan,
      reasons: topReasons,
      warnings: topWarnings,
      debug: {
        source: 'operationPacket + activeCycleDecision + evaluationOutcome + externalConfluence',
        configVersion: cfg.version
      },
      configUsed: configUsed
    });
  }

  // ==========================================================================
  // §export — 이중 환경
  // ==========================================================================
  var api = Object.freeze({
    TRANSPORT_PLAN_VERSION: TRANSPORT_PLAN_VERSION,
    CONFIG_VERSION: CONFIG_VERSION,
    DEFAULT_TRANSPORT_PLAN_CONFIG: DEFAULT_TRANSPORT_PLAN_CONFIG,

    TELEGRAM_CHANNEL: TELEGRAM_CHANNEL,
    MESSAGE_TYPE: MESSAGE_TYPE,
    SNAPSHOT_BUCKET: SNAPSHOT_BUCKET,
    AUDIT_TYPE: AUDIT_TYPE,
    CRITICAL_WARNINGS: CRITICAL_WARNINGS,
    WARNING_AUDIT_MODES: WARNING_AUDIT_MODES,

    build: buildTransportPlan,
    mergeTransportPlanConfig: mergeTransportPlanConfig,

    getOperationRouting: getOperationRouting,
    getActiveCycleRouting: getActiveCycleRouting,
    getEvaluationRouting: getEvaluationRouting,

    buildTelegramPlan: buildTelegramPlan,
    buildSnapshotPlan: buildSnapshotPlan,
    buildEvaluationPlan: buildEvaluationPlan,
    buildAuditPlan: buildAuditPlan,

    detectRoutingConflict: detectRoutingConflict,
    classifyAuditType: classifyAuditType,
    isCriticalWarning: isCriticalWarning,

    normalizeTransportPlan: normalizeTransportPlan,
    pushReason: pushReason,
    pushWarning: pushWarning
  });

  global.WS3_TransportPlan = api;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis
   : typeof window !== 'undefined' ? window
   : typeof self !== 'undefined' ? self
   : this);
