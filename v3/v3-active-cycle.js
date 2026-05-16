/**
 * WS3 v0.9.0 — ActiveCycle / Packet Lifecycle
 *
 * Scope:
 *   operationPacket (v0.8.0)
 *   + previousOperationState (caller 주입)
 *   → standalone activeCycleDecision (lifecycle decision 데이터. state store 아님)
 *
 * 단일 기준 문서:
 *   docs/ws3/WS3_CODE_CONTRACT.md (b-r2 박제본)
 *
 * 확정 DP 정책 (Gate 2 spec):
 *   DP-AC1   standalone 반환. operationPacket / previousOperationState mutate 금지.
 *   DP-AC2   side-effect 금지 (외부 전송 / 영속 저장 / network / DOM / 브라우저 storage).
 *   DP-AC3   previousOperationState 는 caller 주입. v0.9.0 이 직접 읽지 않음.
 *   DP-AC4   operationPacket.candidateKey 만 사용. 재계산 금지.
 *   DP-AC5   timestamp 기준: snapshotPacket.timestamp → evaluationSeed.startTs → null.
 *            런타임 clock API 금지.
 *   DP-AC6   same candidate + no state change + suppressDuplicate true → suppressNotify.
 *            currentTs 있으면 minIntervalMs 도 함께 적용.
 *   DP-AC7   canSnapshot / canEvaluate boolean 만 생성. 실제 저장/평가는 후속 adapter.
 *   DP-AC8   nextState 포함. 단, 실제 저장은 후속 adapter.
 *   DP-AC9   ranking helper. 운영 상태 비교용. 매매 점수/등급 아님.
 *            source: notificationType / evaluationType / snapshotType /
 *                    planQualityTier / cycleState.
 *            max() 사용. 합산 / 평균 X.
 *   DP-AC10  operationPacket safe summary 만 사용. raw / secret / identityInput /
 *            candle raw 저장 금지.
 *   DP-AC11  operationPacket EXPIRED 1순위. expireAfterMs 보조.
 *            currentTs 또는 firstSeenTs null 이면 시간 기반 expiry 판단 생략.
 *   DP-AC12  lifecycleState 에 DUPLICATE / SUPPRESSED 사용 금지.
 *            중복/억제는 transition / notifyPolicy / routingDecision 에서 표현.
 *   DP-AC13  lifecyclePhase 7 후보. seenCount 우선. ageMs 보조 (currentTs 있을 때만).
 *   DP-AC14  signalCooldown vs notifyCooldown 분리.
 *
 * U-AC 확정 처리:
 *   U-AC-1 Option A — ranking source 에 snapshotPacket.state.cycleState /
 *                     snapshotPacket.cycle.cycleState 추가. STRENGTHENING / WEAKENING
 *                     ranking 활성화.
 *   U-AC-2 Option A — previous null/invalid 시 base zero state (seenCount=0, ...).
 *                     첫 관측 seenCount=1.
 *   U-AC-3        — Gate 2 spec 의 top-level shape 그대로 구현.
 *
 * N-AC-OBS 처리:
 *   N-AC-OBS-1 — v3-signal-cycle.js 의 `isActiveCycleState` helper 와 충돌 회피.
 *                본 모듈은 `isActiveLifecycleState` 사용.
 *   N-AC-OBS-2 — Date.now / new Date / performance.now / network fetch 사용 0건.
 *                (보호 파일 v0.2.0-a baseline 의 책임. 본 모듈 침범 금지.)
 *
 * 금지 (이번 단계):
 *   외부 전송 / 알림 발송 / 메시지 채널 직접 호출.
 *   영속 저장 (KV / DB / 파일 IO / 브라우저 storage).
 *   network 호출.
 *   DOM 트리 직접 조작 / HTML 문자열 생성 / event 바인딩.
 *   런타임 clock API 사용.
 *   입력 2종 mutation / delete.
 *   행동 지시 어조 ("매수하세요" / "매도하세요" 등).
 *   raw payload 객체 / payload.raw / payload.raw.builderDebug 전체 직접 노출.
 *   identityInput / candle raw array 직접 노출.
 *   bot 식별 시크릿 / 채널 식별자 / API 키 산출.
 *   매매 점수 / 등급 코드 / tier 라벨 외부 노출.
 *
 * 의존:
 *   operationPacket          (v3-operation-packet.js 산출)
 *   previousOperationState   (caller 주입. v0.9.0 자체 nextState 형식)
 */

(function (global) {
  'use strict';

  var ACTIVE_CYCLE_VERSION = 'WS3_v0.9.0';
  var CONFIG_VERSION = 'inline-default-v0';

  // ==========================================================================
  // 상수 (Gate 2 spec §4 / §5 / §6)
  // ==========================================================================
  var LIFECYCLE_STATE = Object.freeze({
    NONE: 'NONE',
    NEW: 'NEW',
    ACTIVE: 'ACTIVE',
    PERSISTING: 'PERSISTING',
    STRENGTHENING: 'STRENGTHENING',
    WEAKENING: 'WEAKENING',
    COOLDOWN: 'COOLDOWN',
    EXPIRED: 'EXPIRED'
  });

  var LIFECYCLE_PHASE = Object.freeze({
    NONE: 'NONE',
    NEW: 'NEW',
    EARLY: 'EARLY',
    ACTIVE: 'ACTIVE',
    MATURE: 'MATURE',
    LATE: 'LATE',
    CLOSED: 'CLOSED'
  });

  var TRANSITION_TYPE = Object.freeze({
    NONE: 'NONE',
    NEW_CANDIDATE: 'NEW_CANDIDATE',
    SAME_CANDIDATE: 'SAME_CANDIDATE',
    CANDIDATE_CHANGED: 'CANDIDATE_CHANGED',
    STATE_CHANGED: 'STATE_CHANGED',
    STRENGTHENED: 'STRENGTHENED',
    WEAKENED: 'WEAKENED',
    COOLDOWN_ENTERED: 'COOLDOWN_ENTERED',
    COOLDOWN_CONTINUED: 'COOLDOWN_CONTINUED',
    EXPIRED: 'EXPIRED',
    DUPLICATE_SUPPRESSED: 'DUPLICATE_SUPPRESSED'
  });

  var SNAPSHOT_MODE = Object.freeze({
    NONE: 'NONE',
    CREATE: 'CREATE',
    UPDATE: 'UPDATE',
    STATE_CHANGE: 'STATE_CHANGE',
    COOLDOWN: 'COOLDOWN',
    EXPIRED: 'EXPIRED'
  });

  var EVALUATION_MODE = Object.freeze({
    NONE: 'NONE',
    START: 'START',
    UPDATE: 'UPDATE',
    REVIEW: 'REVIEW',
    CLOSE: 'CLOSE'
  });

  // ==========================================================================
  // §state strength ranking (DP-AC9 + U-AC-1)
  //   매매 점수 / 알림 등급 아님. 운영 상태 비교용 내부 순위.
  //   source: notificationType / evaluationType / snapshotType /
  //           planQualityTier / cycleState (U-AC-1 Option A 추가).
  //   max() 만 사용. 합산/평균 금지.
  // ==========================================================================
  var STATE_STRENGTH = Object.freeze({
    EXPIRED: -100,
    COOLDOWN: -50,
    BLOCKED: -30,
    WEAKENING: -10,
    NONE: 0,
    WATCH: 10,
    WATCH_24H: 15,
    READY: 30,
    PLAN_24H: 40,
    STATE_CHANGE: 45,
    PLAN_WEAK: 45,
    PLAN_STRONG: 55,
    PLAN_PREMIUM: 65,
    STRENGTHENING: 70
  });

  // ==========================================================================
  // DEFAULT_ACTIVE_CYCLE_CONFIG (Gate 2 §10)
  // ==========================================================================
  var DEFAULT_ACTIVE_CYCLE_CONFIG = Object.freeze({
    version: CONFIG_VERSION,
    notify: Object.freeze({
      minIntervalMs: 30 * 60 * 1000,
      allowNotifyOnNewCandidate: true,
      allowNotifyOnStrengthening: true,
      allowNotifyOnRiskChange: true,
      suppressDuplicate: true
    }),
    lifecycle: Object.freeze({
      expireAfterMs: 24 * 60 * 60 * 1000,
      cooldownAfterExpired: true,
      maxSeenCount: 999,
      earlyMaxSeenCount: 2,
      matureMinSeenCount: 7,
      lateMinSeenCount: 13,
      lateAfterMs: 12 * 60 * 60 * 1000
    }),
    snapshot: Object.freeze({
      allowCreate: true,
      allowUpdate: true,
      allowStateChange: true,
      allowCooldown: true,
      allowExpired: true
    }),
    evaluation: Object.freeze({
      allowStart: true,
      allowUpdate: true,
      allowReview: true,
      allowClose: true
    }),
    debug: Object.freeze({
      enabled: false,
      allowedFields: Object.freeze([])
    })
  });

  function mergeActiveCycleConfig(config) {
    var c = config || {};
    var d = DEFAULT_ACTIVE_CYCLE_CONFIG;
    var nf = c.notify || {};
    var lc = c.lifecycle || {};
    var sn = c.snapshot || {};
    var ev = c.evaluation || {};
    var dbg = c.debug || {};
    return {
      version: typeof c.version === 'string' ? c.version : d.version,
      notify: {
        minIntervalMs: safeNumber(nf.minIntervalMs, d.notify.minIntervalMs),
        allowNotifyOnNewCandidate: nf.allowNotifyOnNewCandidate !== false,
        allowNotifyOnStrengthening: nf.allowNotifyOnStrengthening !== false,
        allowNotifyOnRiskChange: nf.allowNotifyOnRiskChange !== false,
        suppressDuplicate: nf.suppressDuplicate !== false
      },
      lifecycle: {
        expireAfterMs: safeNumber(lc.expireAfterMs, d.lifecycle.expireAfterMs),
        cooldownAfterExpired: lc.cooldownAfterExpired !== false,
        maxSeenCount: safeNumber(lc.maxSeenCount, d.lifecycle.maxSeenCount),
        earlyMaxSeenCount: safeNumber(lc.earlyMaxSeenCount, d.lifecycle.earlyMaxSeenCount),
        matureMinSeenCount: safeNumber(lc.matureMinSeenCount, d.lifecycle.matureMinSeenCount),
        lateMinSeenCount: safeNumber(lc.lateMinSeenCount, d.lifecycle.lateMinSeenCount),
        lateAfterMs: safeNumber(lc.lateAfterMs, d.lifecycle.lateAfterMs)
      },
      snapshot: {
        allowCreate: sn.allowCreate !== false,
        allowUpdate: sn.allowUpdate !== false,
        allowStateChange: sn.allowStateChange !== false,
        allowCooldown: sn.allowCooldown !== false,
        allowExpired: sn.allowExpired !== false
      },
      evaluation: {
        allowStart: ev.allowStart !== false,
        allowUpdate: ev.allowUpdate !== false,
        allowReview: ev.allowReview !== false,
        allowClose: ev.allowClose !== false
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
      notify: {
        minIntervalMs: cfg.notify.minIntervalMs,
        allowNotifyOnNewCandidate: cfg.notify.allowNotifyOnNewCandidate,
        allowNotifyOnStrengthening: cfg.notify.allowNotifyOnStrengthening,
        allowNotifyOnRiskChange: cfg.notify.allowNotifyOnRiskChange,
        suppressDuplicate: cfg.notify.suppressDuplicate
      },
      lifecycle: {
        expireAfterMs: cfg.lifecycle.expireAfterMs,
        cooldownAfterExpired: cfg.lifecycle.cooldownAfterExpired,
        maxSeenCount: cfg.lifecycle.maxSeenCount,
        earlyMaxSeenCount: cfg.lifecycle.earlyMaxSeenCount,
        matureMinSeenCount: cfg.lifecycle.matureMinSeenCount,
        lateMinSeenCount: cfg.lifecycle.lateMinSeenCount,
        lateAfterMs: cfg.lifecycle.lateAfterMs
      },
      snapshot: {
        allowCreate: cfg.snapshot.allowCreate,
        allowUpdate: cfg.snapshot.allowUpdate,
        allowStateChange: cfg.snapshot.allowStateChange,
        allowCooldown: cfg.snapshot.allowCooldown,
        allowExpired: cfg.snapshot.allowExpired
      },
      evaluation: {
        allowStart: cfg.evaluation.allowStart,
        allowUpdate: cfg.evaluation.allowUpdate,
        allowReview: cfg.evaluation.allowReview,
        allowClose: cfg.evaluation.allowClose
      },
      debug: {
        enabled: cfg.debug.enabled,
        allowedFields: cfg.debug.allowedFields.slice()
      }
    };
  }

  // ==========================================================================
  // 공통 helper
  // ==========================================================================
  function safeNumber(value, fallback) {
    var fb = (fallback === undefined) ? null : fallback;
    if (value === null || value === undefined) return fb;
    if (typeof value === 'number') return isFinite(value) ? value : fb;
    if (typeof value === 'string' && value.trim() !== '') {
      var n = Number(value);
      return isFinite(n) ? n : fb;
    }
    return fb;
  }

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

  // N-AC-OBS-1: 동명 helper 회피. v3-signal-cycle.js 의 isActiveCycleState 와 분리.
  function isActiveLifecycleState(state) {
    return state === LIFECYCLE_STATE.ACTIVE
        || state === LIFECYCLE_STATE.PERSISTING
        || state === LIFECYCLE_STATE.STRENGTHENING
        || state === LIFECYCLE_STATE.WEAKENING
        || state === LIFECYCLE_STATE.NEW;
  }

  // ==========================================================================
  // §getCandidateKey (DP-AC4 — operationPacket.candidateKey 만)
  // ==========================================================================
  function getCandidateKey(operationPacket) {
    if (!isPlainObject(operationPacket)) return null;
    if (typeof operationPacket.candidateKey === 'string' && operationPacket.candidateKey) {
      return operationPacket.candidateKey;
    }
    return null;
  }

  // ==========================================================================
  // §getCurrentTs (DP-AC5 — snapshotPacket.timestamp → evaluationSeed.startTs → null)
  // ==========================================================================
  function getCurrentTs(operationPacket) {
    if (!isPlainObject(operationPacket)) return null;
    var sp = isPlainObject(operationPacket.snapshotPacket) ? operationPacket.snapshotPacket : null;
    if (sp && typeof sp.timestamp === 'number' && isFinite(sp.timestamp)) return sp.timestamp;
    var es = isPlainObject(operationPacket.evaluationSeed) ? operationPacket.evaluationSeed : null;
    if (es && typeof es.startTs === 'number' && isFinite(es.startTs)) return es.startTs;
    return null;
  }

  // ==========================================================================
  // §getIdentity (DP-AC10 — operationPacket.identity safe pass-through)
  // ==========================================================================
  function getIdentity(operationPacket) {
    var id = {
      exchange: null, market: null, base: null, quote: null,
      displayName: null, timeframe: null
    };
    if (!isPlainObject(operationPacket) || !isPlainObject(operationPacket.identity)) return id;
    var src = operationPacket.identity;
    id.exchange = safeString(src.exchange, null);
    id.market = safeString(src.market, null);
    id.base = safeString(src.base, null);
    id.quote = safeString(src.quote, null);
    id.displayName = safeString(src.displayName, null);
    id.timeframe = safeString(src.timeframe, null);
    return id;
  }

  // ==========================================================================
  // §getPacketSummary (DP-AC10 — safe summary 만. raw 노출 X)
  // ==========================================================================
  function getPacketSummary(operationPacket) {
    var summary = {
      valid: false,
      candidateKey: null,
      notificationType: 'NONE',
      snapshotType: 'NONE',
      evaluationType: 'NONE',
      cycleState: 'UNKNOWN',
      cyclePhase: 'UNKNOWN',
      bucketFamily: 'NONE',
      strategyBias: 'UNKNOWN',
      actionability: 'NONE',
      planQualityTier: 'NONE',
      riskLevel: 'UNKNOWN',
      tone: null,
      primaryBadgeKey: null,
      timestamp: null,
      isExpiredByPacket: false,
      isCooldownByPacket: false
    };
    if (!isPlainObject(operationPacket)) return summary;

    summary.valid = operationPacket.valid === true;
    summary.candidateKey = getCandidateKey(operationPacket);
    summary.timestamp = getCurrentTs(operationPacket);

    var np = isPlainObject(operationPacket.notificationPacket) ? operationPacket.notificationPacket : null;
    var sp = isPlainObject(operationPacket.snapshotPacket) ? operationPacket.snapshotPacket : null;
    var es = isPlainObject(operationPacket.evaluationSeed) ? operationPacket.evaluationSeed : null;
    var ds = isPlainObject(operationPacket.displaySummary) ? operationPacket.displaySummary : null;

    if (np) summary.notificationType = safeString(np.type, 'NONE');
    if (sp) summary.snapshotType = safeString(sp.snapshotType, 'NONE');
    if (es) summary.evaluationType = safeString(es.evaluationType, 'NONE');

    // U-AC-1 Option A — cycleState 는 snapshotPacket.state.cycleState 또는
    //                   snapshotPacket.cycle.cycleState 에서 읽는다.
    if (sp && isPlainObject(sp.state) && typeof sp.state.cycleState === 'string') {
      summary.cycleState = sp.state.cycleState;
    } else if (sp && isPlainObject(sp.cycle) && typeof sp.cycle.cycleState === 'string') {
      summary.cycleState = sp.cycle.cycleState;
    }
    if (sp && isPlainObject(sp.state) && typeof sp.state.cyclePhase === 'string') {
      summary.cyclePhase = sp.state.cyclePhase;
    }
    if (sp && isPlainObject(sp.state) && typeof sp.state.bucketFamily === 'string') {
      summary.bucketFamily = sp.state.bucketFamily;
    }
    if (sp && isPlainObject(sp.strategy)) {
      summary.strategyBias = safeString(sp.strategy.strategyBias, 'UNKNOWN');
      summary.actionability = safeString(sp.strategy.actionability, 'NONE');
      summary.planQualityTier = safeString(sp.strategy.planQualityTier, 'NONE');
    }
    if (sp && isPlainObject(sp.view)) {
      summary.tone = safeString(sp.view.tone, null);
      if (isPlainObject(sp.view.primaryBadge)) {
        summary.primaryBadgeKey = safeString(sp.view.primaryBadge.labelKey, null);
      }
    } else if (ds) {
      summary.tone = safeString(ds.tone, null);
      if (isPlainObject(ds.primaryBadge)) {
        summary.primaryBadgeKey = safeString(ds.primaryBadge.labelKey, null);
      }
    }

    summary.isExpiredByPacket = (summary.notificationType === 'EXPIRED')
                              || (summary.evaluationType === 'EXPIRED_REVIEW');
    summary.isCooldownByPacket = (summary.notificationType === 'COOLDOWN')
                               || (summary.evaluationType === 'COOLDOWN_REVIEW');

    return summary;
  }

  // ==========================================================================
  // §getStateStrength (DP-AC9 + U-AC-1 — max(), 합산/평균 X)
  // ==========================================================================
  function lookupStrength(key) {
    if (typeof key !== 'string' || !key) return null;
    if (Object.prototype.hasOwnProperty.call(STATE_STRENGTH, key)) return STATE_STRENGTH[key];
    return null;
  }

  function getStateStrength(summary) {
    if (!isPlainObject(summary)) return 0;

    var sources = [
      summary.notificationType,
      summary.evaluationType,
      summary.snapshotType,
      summary.planQualityTier,
      summary.cycleState
    ];

    var picked = null;
    for (var i = 0; i < sources.length; i = i + 1) {
      var v = lookupStrength(sources[i]);
      if (v === null) continue;
      if (picked === null || v > picked) picked = v;
    }
    return picked === null ? 0 : picked;
  }

  // ==========================================================================
  // §isSameCandidate / §isStateChanged / §isStrengthening / §isWeakening
  // ==========================================================================
  function isSameCandidate(currentSummary, previousSummary) {
    if (!isPlainObject(currentSummary) || !isPlainObject(previousSummary)) return false;
    if (typeof currentSummary.candidateKey !== 'string' || !currentSummary.candidateKey) return false;
    if (typeof previousSummary.candidateKey !== 'string' || !previousSummary.candidateKey) return false;
    return currentSummary.candidateKey === previousSummary.candidateKey;
  }

  function isStateChanged(currentSummary, previousSummary) {
    if (!isPlainObject(currentSummary) || !isPlainObject(previousSummary)) return false;
    var fields = ['notificationType', 'snapshotType', 'evaluationType',
                  'cycleState', 'cyclePhase', 'strategyBias',
                  'actionability', 'planQualityTier'];
    for (var i = 0; i < fields.length; i = i + 1) {
      var f = fields[i];
      if (currentSummary[f] !== previousSummary[f]) return true;
    }
    return false;
  }

  function isStrengthening(currentSummary, previousSummary) {
    if (!isPlainObject(currentSummary) || !isPlainObject(previousSummary)) return false;
    if (!isSameCandidate(currentSummary, previousSummary)) return false;
    return getStateStrength(currentSummary) > getStateStrength(previousSummary);
  }

  function isWeakening(currentSummary, previousSummary) {
    if (!isPlainObject(currentSummary) || !isPlainObject(previousSummary)) return false;
    if (!isSameCandidate(currentSummary, previousSummary)) return false;
    if (currentSummary.notificationType === 'BLOCKED') return true;
    return getStateStrength(currentSummary) < getStateStrength(previousSummary);
  }

  // ==========================================================================
  // §cooldown helpers
  // ==========================================================================
  function isSignalCooldown(currentSummary) {
    if (!isPlainObject(currentSummary)) return false;
    return currentSummary.isCooldownByPacket === true;
  }

  function isNotifyCooldown(previousState, currentTs, cfg) {
    if (!isPlainObject(previousState)) return false;
    if (typeof currentTs !== 'number' || !isFinite(currentTs)) return false;
    var ln = previousState.lifecycle ? safeNumber(previousState.lifecycle.lastNotifyTs, null) : null;
    if (ln === null) return false;
    var elapsed = currentTs - ln;
    var minInterval = safeNumber(cfg.notify.minIntervalMs, 0);
    return elapsed < minInterval;
  }

  // ==========================================================================
  // §expiry helpers (DP-AC11)
  // ==========================================================================
  function isExpiredByPacket(currentSummary) {
    if (!isPlainObject(currentSummary)) return false;
    return currentSummary.isExpiredByPacket === true;
  }

  function isExpiredByAge(previousState, currentTs, cfg) {
    if (!isPlainObject(previousState)) return false;
    if (typeof currentTs !== 'number' || !isFinite(currentTs)) return false;
    var firstSeen = previousState.lifecycle ? safeNumber(previousState.lifecycle.firstSeenTs, null) : null;
    if (firstSeen === null) return false;
    var expireAfter = safeNumber(cfg.lifecycle.expireAfterMs, null);
    if (expireAfter === null) return false;
    return (currentTs - firstSeen) >= expireAfter;
  }

  // ==========================================================================
  // §normalizePreviousState (U-AC-2 Option A — null/invalid → base zero state)
  // ==========================================================================
  function normalizePreviousState(previousState) {
    var base = {
      valid: false,
      candidateKey: null,
      identity: {},
      lifecycle: {
        firstSeenTs: null,
        lastSeenTs: null,
        lastNotifyTs: null,
        lastSnapshotTs: null,
        lastEvaluationTs: null,
        seenCount: 0,
        notifyCount: 0,
        snapshotCount: 0,
        evaluationCount: 0,
        lifecycleState: 'NONE',
        lifecyclePhase: 'NONE'
      },
      lastPacketSummary: null,
      notifyCooldown: { active: false },
      signalCooldown: { active: false },
      expiry: { expired: false }
    };
    if (!isPlainObject(previousState)) return base;

    base.valid = previousState.valid === true;
    base.candidateKey = safeString(previousState.candidateKey, null);
    if (isPlainObject(previousState.identity)) {
      base.identity = {
        exchange: safeString(previousState.identity.exchange, null),
        market: safeString(previousState.identity.market, null),
        base: safeString(previousState.identity.base, null),
        quote: safeString(previousState.identity.quote, null),
        displayName: safeString(previousState.identity.displayName, null),
        timeframe: safeString(previousState.identity.timeframe, null)
      };
    }
    if (isPlainObject(previousState.lifecycle)) {
      var lc = previousState.lifecycle;
      base.lifecycle.firstSeenTs = safeNumber(lc.firstSeenTs, null);
      base.lifecycle.lastSeenTs = safeNumber(lc.lastSeenTs, null);
      base.lifecycle.lastNotifyTs = safeNumber(lc.lastNotifyTs, null);
      base.lifecycle.lastSnapshotTs = safeNumber(lc.lastSnapshotTs, null);
      base.lifecycle.lastEvaluationTs = safeNumber(lc.lastEvaluationTs, null);
      base.lifecycle.seenCount = safeNumber(lc.seenCount, 0);
      base.lifecycle.notifyCount = safeNumber(lc.notifyCount, 0);
      base.lifecycle.snapshotCount = safeNumber(lc.snapshotCount, 0);
      base.lifecycle.evaluationCount = safeNumber(lc.evaluationCount, 0);
      base.lifecycle.lifecycleState = safeString(lc.lifecycleState, 'NONE');
      base.lifecycle.lifecyclePhase = safeString(lc.lifecyclePhase, 'NONE');
    }
    if (isPlainObject(previousState.lastPacketSummary)) {
      base.lastPacketSummary = previousState.lastPacketSummary;
    }
    if (isPlainObject(previousState.notifyCooldown)) {
      base.notifyCooldown = {
        active: previousState.notifyCooldown.active === true
      };
    }
    if (isPlainObject(previousState.signalCooldown)) {
      base.signalCooldown = {
        active: previousState.signalCooldown.active === true
      };
    }
    if (isPlainObject(previousState.expiry)) {
      base.expiry = {
        expired: previousState.expiry.expired === true
      };
    }
    return base;
  }

  // ==========================================================================
  // §classifyLifecycleState (Gate 2 §4 — 8 priority steps)
  // ==========================================================================
  function classifyLifecycleState(currentSummary, normalizedPrev, currentTs, cfg) {
    if (!isPlainObject(currentSummary)) return LIFECYCLE_STATE.NONE;

    // 1. EXPIRED
    if (isExpiredByPacket(currentSummary)) return LIFECYCLE_STATE.EXPIRED;
    if (isExpiredByAge(normalizedPrev, currentTs, cfg)) return LIFECYCLE_STATE.EXPIRED;

    // 2. COOLDOWN
    if (isSignalCooldown(currentSummary)) return LIFECYCLE_STATE.COOLDOWN;

    var hasCandidate = typeof currentSummary.candidateKey === 'string' && currentSummary.candidateKey;
    if (!hasCandidate) return LIFECYCLE_STATE.NONE;
    if (currentSummary.valid !== true) return LIFECYCLE_STATE.NONE;

    var prevSummary = (normalizedPrev && isPlainObject(normalizedPrev.lastPacketSummary))
      ? normalizedPrev.lastPacketSummary : null;
    var prevValid = normalizedPrev.valid === true
                    && typeof normalizedPrev.candidateKey === 'string'
                    && normalizedPrev.candidateKey;

    // 3. NEW
    if (!prevValid) return LIFECYCLE_STATE.NEW;

    var sameCandidate = (normalizedPrev.candidateKey === currentSummary.candidateKey);
    if (!sameCandidate) return LIFECYCLE_STATE.NEW;

    // 4. STRENGTHENING
    if (prevSummary && isStrengthening(currentSummary, prevSummary)) {
      return LIFECYCLE_STATE.STRENGTHENING;
    }
    // 5. WEAKENING
    if (prevSummary && isWeakening(currentSummary, prevSummary)) {
      return LIFECYCLE_STATE.WEAKENING;
    }
    // 6. PERSISTING
    if (prevSummary) {
      return LIFECYCLE_STATE.PERSISTING;
    }
    // 7. ACTIVE
    return LIFECYCLE_STATE.ACTIVE;
  }

  // ==========================================================================
  // §classifyLifecyclePhase (Gate 2 §5 — seenCount + ageMs)
  // ==========================================================================
  function classifyLifecyclePhase(lifecycleState, nextSeenCount, ageMs, cfg) {
    if (lifecycleState === LIFECYCLE_STATE.EXPIRED) return LIFECYCLE_PHASE.CLOSED;
    if (lifecycleState === LIFECYCLE_STATE.NEW) return LIFECYCLE_PHASE.NEW;
    if (lifecycleState === LIFECYCLE_STATE.NONE || lifecycleState === LIFECYCLE_STATE.COOLDOWN) {
      return LIFECYCLE_PHASE.NONE;
    }

    var sc = safeNumber(nextSeenCount, 0);
    var earlyMax = safeNumber(cfg.lifecycle.earlyMaxSeenCount, 2);
    var matureMin = safeNumber(cfg.lifecycle.matureMinSeenCount, 7);
    var lateMin = safeNumber(cfg.lifecycle.lateMinSeenCount, 13);
    var lateAfter = safeNumber(cfg.lifecycle.lateAfterMs, null);

    // LATE: seenCount > 12 or ageMs >= cfg.lifecycle.lateAfterMs
    if (sc >= lateMin) return LIFECYCLE_PHASE.LATE;
    if (lateAfter !== null && typeof ageMs === 'number' && isFinite(ageMs) && ageMs >= lateAfter) {
      return LIFECYCLE_PHASE.LATE;
    }

    var activeOrPersisting =
         lifecycleState === LIFECYCLE_STATE.ACTIVE
      || lifecycleState === LIFECYCLE_STATE.PERSISTING
      || lifecycleState === LIFECYCLE_STATE.STRENGTHENING;
    var activeOrPersistingOrWeak =
         activeOrPersisting
      || lifecycleState === LIFECYCLE_STATE.WEAKENING;

    // EARLY: seenCount <= 2 && state in [ACTIVE, PERSISTING, STRENGTHENING]
    if (sc <= earlyMax && activeOrPersisting) return LIFECYCLE_PHASE.EARLY;
    // ACTIVE: 3 <= seenCount <= 6 && state in [...]
    if (sc >= (earlyMax + 1) && sc <= (matureMin - 1) && activeOrPersistingOrWeak) {
      return LIFECYCLE_PHASE.ACTIVE;
    }
    // MATURE: 7 <= seenCount <= 12 && state in [...]
    if (sc >= matureMin && sc <= (lateMin - 1) && activeOrPersistingOrWeak) {
      return LIFECYCLE_PHASE.MATURE;
    }

    return LIFECYCLE_PHASE.NONE;
  }

  // ==========================================================================
  // §classifyTransition (Gate 2 §6 — 11 priority steps)
  // ==========================================================================
  function classifyTransition(currentSummary, normalizedPrev, lifecycleState, duplicateSuppressed) {
    if (!isPlainObject(currentSummary)) return TRANSITION_TYPE.NONE;

    var prevSummary = (normalizedPrev && isPlainObject(normalizedPrev.lastPacketSummary))
      ? normalizedPrev.lastPacketSummary : null;
    var prevState = normalizedPrev ? normalizedPrev.lifecycle.lifecycleState : 'NONE';
    var prevValid = normalizedPrev.valid === true
                    && typeof normalizedPrev.candidateKey === 'string'
                    && normalizedPrev.candidateKey;

    // 1. EXPIRED
    if (lifecycleState === LIFECYCLE_STATE.EXPIRED) return TRANSITION_TYPE.EXPIRED;
    // 2. COOLDOWN_ENTERED
    if (lifecycleState === LIFECYCLE_STATE.COOLDOWN && prevState !== LIFECYCLE_STATE.COOLDOWN) {
      return TRANSITION_TYPE.COOLDOWN_ENTERED;
    }
    // 3. COOLDOWN_CONTINUED
    if (lifecycleState === LIFECYCLE_STATE.COOLDOWN && prevState === LIFECYCLE_STATE.COOLDOWN) {
      return TRANSITION_TYPE.COOLDOWN_CONTINUED;
    }
    // 4. NEW_CANDIDATE
    if (!prevValid && typeof currentSummary.candidateKey === 'string' && currentSummary.candidateKey) {
      return TRANSITION_TYPE.NEW_CANDIDATE;
    }
    // 5. CANDIDATE_CHANGED
    if (prevValid
        && typeof currentSummary.candidateKey === 'string' && currentSummary.candidateKey
        && normalizedPrev.candidateKey !== currentSummary.candidateKey) {
      return TRANSITION_TYPE.CANDIDATE_CHANGED;
    }
    // 6. STRENGTHENED
    if (prevSummary && isStrengthening(currentSummary, prevSummary)) {
      return TRANSITION_TYPE.STRENGTHENED;
    }
    // 7. WEAKENED
    if (prevSummary && isWeakening(currentSummary, prevSummary)) {
      return TRANSITION_TYPE.WEAKENED;
    }
    // 8. STATE_CHANGED
    if (prevSummary && isStateChanged(currentSummary, prevSummary)) {
      return TRANSITION_TYPE.STATE_CHANGED;
    }
    // 9. DUPLICATE_SUPPRESSED
    if (duplicateSuppressed === true) return TRANSITION_TYPE.DUPLICATE_SUPPRESSED;
    // 10. SAME_CANDIDATE
    if (prevValid
        && typeof currentSummary.candidateKey === 'string' && currentSummary.candidateKey
        && normalizedPrev.candidateKey === currentSummary.candidateKey) {
      return TRANSITION_TYPE.SAME_CANDIDATE;
    }
    // 11. NONE
    return TRANSITION_TYPE.NONE;
  }

  // ==========================================================================
  // §buildNotifyPolicy (DP-AC6 / DP-AC14)
  // ==========================================================================
  function buildNotifyPolicy(currentSummary, normalizedPrev, transitionPre, lifecycleState, currentTs, cfg) {
    var ctx = {
      canNotify: false,
      notificationType: currentSummary ? safeString(currentSummary.notificationType, 'NONE') : 'NONE',
      notifyCooldownActive: false,
      signalCooldownActive: false,
      duplicateSuppressed: false,
      lastNotifyTs: normalizedPrev && normalizedPrev.lifecycle
        ? safeNumber(normalizedPrev.lifecycle.lastNotifyTs, null) : null,
      nextAllowedNotifyTs: null,
      reasons: [],
      warnings: []
    };

    ctx.signalCooldownActive = isSignalCooldown(currentSummary);
    ctx.notifyCooldownActive = isNotifyCooldown(normalizedPrev, currentTs, cfg);

    if (typeof currentTs === 'number' && isFinite(currentTs)
        && typeof ctx.lastNotifyTs === 'number' && isFinite(ctx.lastNotifyTs)) {
      ctx.nextAllowedNotifyTs = ctx.lastNotifyTs + safeNumber(cfg.notify.minIntervalMs, 0);
    }

    if (lifecycleState === LIFECYCLE_STATE.EXPIRED) {
      pushReason(ctx, 'NOTIFY_BLOCKED_EXPIRED');
      return ctx;
    }
    if (ctx.signalCooldownActive) {
      pushReason(ctx, 'NOTIFY_BLOCKED_SIGNAL_COOLDOWN');
      return ctx;
    }
    if (ctx.notifyCooldownActive) {
      pushReason(ctx, 'NOTIFY_BLOCKED_NOTIFY_COOLDOWN');
      return ctx;
    }

    // DP-AC6: same candidate + no state change + suppressDuplicate
    var prevSummary = (normalizedPrev && isPlainObject(normalizedPrev.lastPacketSummary))
      ? normalizedPrev.lastPacketSummary : null;
    var sameCand = prevSummary && isSameCandidate(currentSummary, prevSummary);
    var noChange = prevSummary && !isStateChanged(currentSummary, prevSummary);
    if (sameCand && noChange && cfg.notify.suppressDuplicate === true) {
      ctx.duplicateSuppressed = true;
      pushReason(ctx, 'NOTIFY_DUPLICATE_SUPPRESSED');
      return ctx;
    }

    // notification type 별 허용 조건
    if (ctx.notificationType === 'NONE') {
      pushReason(ctx, 'NOTIFY_TYPE_NONE');
      return ctx;
    }
    if (ctx.notificationType === 'READY' && cfg.notify.allowNotifyOnStrengthening !== true) {
      pushReason(ctx, 'NOTIFY_DISABLED_READY');
      return ctx;
    }
    if (ctx.notificationType === 'BLOCKED' && cfg.notify.allowNotifyOnRiskChange !== true) {
      pushReason(ctx, 'NOTIFY_DISABLED_BLOCKED');
      return ctx;
    }
    if (lifecycleState === LIFECYCLE_STATE.NEW && cfg.notify.allowNotifyOnNewCandidate !== true) {
      pushReason(ctx, 'NOTIFY_DISABLED_NEW');
      return ctx;
    }

    ctx.canNotify = true;
    pushReason(ctx, 'NOTIFY_ALLOWED_TYPE_' + ctx.notificationType);
    return ctx;
  }

  // ==========================================================================
  // §buildSnapshotPolicy (DP-AC7)
  // ==========================================================================
  function buildSnapshotPolicy(currentSummary, transition, lifecycleState, cfg) {
    var ctx = {
      canSnapshot: false,
      snapshotType: currentSummary ? safeString(currentSummary.snapshotType, 'NONE') : 'NONE',
      snapshotMode: SNAPSHOT_MODE.NONE,
      reasons: [],
      warnings: []
    };

    if (ctx.snapshotType === 'NONE') {
      pushReason(ctx, 'SNAPSHOT_TYPE_NONE');
      return ctx;
    }

    if (lifecycleState === LIFECYCLE_STATE.EXPIRED) {
      if (cfg.snapshot.allowExpired === true) {
        ctx.canSnapshot = true;
        ctx.snapshotMode = SNAPSHOT_MODE.EXPIRED;
        pushReason(ctx, 'SNAPSHOT_EXPIRED');
      } else {
        pushReason(ctx, 'SNAPSHOT_DISABLED_EXPIRED');
      }
      return ctx;
    }

    if (lifecycleState === LIFECYCLE_STATE.COOLDOWN) {
      if (cfg.snapshot.allowCooldown === true) {
        ctx.canSnapshot = true;
        ctx.snapshotMode = SNAPSHOT_MODE.COOLDOWN;
        pushReason(ctx, 'SNAPSHOT_COOLDOWN');
      } else {
        pushReason(ctx, 'SNAPSHOT_DISABLED_COOLDOWN');
      }
      return ctx;
    }

    if (transition === TRANSITION_TYPE.NEW_CANDIDATE
        || transition === TRANSITION_TYPE.CANDIDATE_CHANGED) {
      if (cfg.snapshot.allowCreate === true) {
        ctx.canSnapshot = true;
        ctx.snapshotMode = SNAPSHOT_MODE.CREATE;
        pushReason(ctx, 'SNAPSHOT_CREATE');
      } else {
        pushReason(ctx, 'SNAPSHOT_DISABLED_CREATE');
      }
      return ctx;
    }

    if (transition === TRANSITION_TYPE.STRENGTHENED
        || transition === TRANSITION_TYPE.WEAKENED
        || transition === TRANSITION_TYPE.STATE_CHANGED) {
      if (cfg.snapshot.allowStateChange === true) {
        ctx.canSnapshot = true;
        ctx.snapshotMode = SNAPSHOT_MODE.STATE_CHANGE;
        pushReason(ctx, 'SNAPSHOT_STATE_CHANGE');
      } else {
        pushReason(ctx, 'SNAPSHOT_DISABLED_STATE_CHANGE');
      }
      return ctx;
    }

    if (cfg.snapshot.allowUpdate === true) {
      ctx.canSnapshot = true;
      ctx.snapshotMode = SNAPSHOT_MODE.UPDATE;
      pushReason(ctx, 'SNAPSHOT_UPDATE');
    } else {
      pushReason(ctx, 'SNAPSHOT_DISABLED_UPDATE');
    }
    return ctx;
  }

  // ==========================================================================
  // §buildEvaluationPolicy (DP-AC7)
  // ==========================================================================
  function buildEvaluationPolicy(currentSummary, transition, lifecycleState, cfg) {
    var ctx = {
      canEvaluate: false,
      evaluationType: currentSummary ? safeString(currentSummary.evaluationType, 'NONE') : 'NONE',
      evaluationMode: EVALUATION_MODE.NONE,
      reasons: [],
      warnings: []
    };

    if (ctx.evaluationType === 'NONE') {
      pushReason(ctx, 'EVALUATION_TYPE_NONE');
      return ctx;
    }

    if (ctx.evaluationType === 'EXPIRED_REVIEW') {
      if (cfg.evaluation.allowClose === true) {
        ctx.canEvaluate = true;
        ctx.evaluationMode = EVALUATION_MODE.CLOSE;
        pushReason(ctx, 'EVALUATION_CLOSE');
      } else {
        pushReason(ctx, 'EVALUATION_DISABLED_CLOSE');
      }
      return ctx;
    }
    if (ctx.evaluationType === 'COOLDOWN_REVIEW') {
      if (cfg.evaluation.allowReview === true) {
        ctx.canEvaluate = true;
        ctx.evaluationMode = EVALUATION_MODE.REVIEW;
        pushReason(ctx, 'EVALUATION_REVIEW');
      } else {
        pushReason(ctx, 'EVALUATION_DISABLED_REVIEW');
      }
      return ctx;
    }

    if (transition === TRANSITION_TYPE.NEW_CANDIDATE
        || transition === TRANSITION_TYPE.CANDIDATE_CHANGED) {
      if (cfg.evaluation.allowStart === true) {
        ctx.canEvaluate = true;
        ctx.evaluationMode = EVALUATION_MODE.START;
        pushReason(ctx, 'EVALUATION_START');
      } else {
        pushReason(ctx, 'EVALUATION_DISABLED_START');
      }
      return ctx;
    }

    if (cfg.evaluation.allowUpdate === true) {
      ctx.canEvaluate = true;
      ctx.evaluationMode = EVALUATION_MODE.UPDATE;
      pushReason(ctx, 'EVALUATION_UPDATE');
    } else {
      pushReason(ctx, 'EVALUATION_DISABLED_UPDATE');
    }
    return ctx;
  }

  // ==========================================================================
  // §buildRoutingDecision
  // ==========================================================================
  function buildRoutingDecision(currentSummary, notifyPolicy, snapshotPolicy, evaluationPolicy) {
    var ctx = {
      allowNotify: notifyPolicy ? notifyPolicy.canNotify === true : false,
      allowSnapshot: snapshotPolicy ? snapshotPolicy.canSnapshot === true : false,
      allowEvaluate: evaluationPolicy ? evaluationPolicy.canEvaluate === true : false,
      suppressNotify: false,
      suppressReason: null,
      snapshotMode: snapshotPolicy ? safeString(snapshotPolicy.snapshotMode, SNAPSHOT_MODE.NONE) : SNAPSHOT_MODE.NONE,
      evaluationMode: evaluationPolicy ? safeString(evaluationPolicy.evaluationMode, EVALUATION_MODE.NONE) : EVALUATION_MODE.NONE
    };

    if (notifyPolicy) {
      if (notifyPolicy.signalCooldownActive === true) {
        ctx.suppressNotify = true;
        ctx.suppressReason = 'SIGNAL_COOLDOWN';
      } else if (notifyPolicy.notifyCooldownActive === true) {
        ctx.suppressNotify = true;
        ctx.suppressReason = 'NOTIFY_COOLDOWN';
      } else if (notifyPolicy.duplicateSuppressed === true) {
        ctx.suppressNotify = true;
        ctx.suppressReason = 'DUPLICATE';
      }
    }

    return ctx;
  }

  // ==========================================================================
  // §buildNextState (Gate 2 §9 + U-AC-2 base zero)
  // ==========================================================================
  function buildNextState(currentSummary, normalizedPrev, lifecycleState, lifecyclePhase, policies, currentTs, cfg) {
    var hasTs = (typeof currentTs === 'number' && isFinite(currentTs));
    var prevLc = normalizedPrev.lifecycle;
    var firstSeenTs = (typeof prevLc.firstSeenTs === 'number' && isFinite(prevLc.firstSeenTs))
      ? prevLc.firstSeenTs : (hasTs ? currentTs : null);
    var lastSeenTs = hasTs ? currentTs : safeNumber(prevLc.lastSeenTs, null);

    var allowNotify = policies.notifyPolicy.canNotify === true;
    var canSnapshot = policies.snapshotPolicy.canSnapshot === true;
    var canEvaluate = policies.evaluationPolicy.canEvaluate === true;

    var lastNotifyTs = (allowNotify && hasTs) ? currentTs : safeNumber(prevLc.lastNotifyTs, null);
    var lastSnapshotTs = (canSnapshot && hasTs) ? currentTs : safeNumber(prevLc.lastSnapshotTs, null);
    var lastEvaluationTs = (canEvaluate && hasTs) ? currentTs : safeNumber(prevLc.lastEvaluationTs, null);

    // U-AC-2 Option A — previous null/invalid 시 base zero state. normalizePreviousState 가 이미 처리.
    var seenCount = safeNumber(prevLc.seenCount, 0) + 1;
    var notifyCount = safeNumber(prevLc.notifyCount, 0) + (allowNotify ? 1 : 0);
    var snapshotCount = safeNumber(prevLc.snapshotCount, 0) + (canSnapshot ? 1 : 0);
    var evaluationCount = safeNumber(prevLc.evaluationCount, 0) + (canEvaluate ? 1 : 0);

    var nextCandidateKey = currentSummary ? currentSummary.candidateKey : null;
    var ageMs = (hasTs && typeof firstSeenTs === 'number' && isFinite(firstSeenTs))
      ? (currentTs - firstSeenTs) : null;

    return {
      valid: true,
      version: ACTIVE_CYCLE_VERSION,
      candidateKey: nextCandidateKey,
      identity: currentSummary && isPlainObject(currentSummary.identity)
        ? currentSummary.identity : {},
      lifecycle: {
        firstSeenTs: firstSeenTs,
        lastSeenTs: lastSeenTs,
        lastNotifyTs: lastNotifyTs,
        lastSnapshotTs: lastSnapshotTs,
        lastEvaluationTs: lastEvaluationTs,
        seenCount: seenCount,
        notifyCount: notifyCount,
        snapshotCount: snapshotCount,
        evaluationCount: evaluationCount,
        ageMs: ageMs,
        lifecycleState: lifecycleState,
        lifecyclePhase: lifecyclePhase
      },
      lastPacketSummary: currentSummary || null,
      notifyCooldown: {
        active: policies.notifyPolicy.notifyCooldownActive === true,
        lastNotifyTs: lastNotifyTs,
        nextAllowedNotifyTs: policies.notifyPolicy.nextAllowedNotifyTs
      },
      signalCooldown: {
        active: policies.notifyPolicy.signalCooldownActive === true
      },
      expiry: {
        expired: lifecycleState === LIFECYCLE_STATE.EXPIRED,
        firstSeenTs: firstSeenTs,
        expireAfterMs: safeNumber(cfg.lifecycle.expireAfterMs, null)
      },
      reasons: [],
      warnings: []
    };
  }

  // ==========================================================================
  // §normalize 출력 (U-AC-3 top-level shape)
  // ==========================================================================
  function normalizeActiveCycleDecision(result) {
    return {
      valid: result.valid === true,
      version: ACTIVE_CYCLE_VERSION,
      candidateKey: typeof result.candidateKey === 'string' ? result.candidateKey : null,
      identity: result.identity,
      lifecycle: result.lifecycle,
      transition: result.transition,
      routingDecision: result.routingDecision,
      notifyPolicy: result.notifyPolicy,
      snapshotPolicy: result.snapshotPolicy,
      evaluationPolicy: result.evaluationPolicy,
      nextState: result.nextState,
      reasons: Array.isArray(result.reasons) ? result.reasons.slice() : [],
      warnings: Array.isArray(result.warnings) ? result.warnings.slice() : [],
      debug: result.debug,
      configUsed: result.configUsed
    };
  }

  // ==========================================================================
  // §main — buildActiveCycleDecision
  // ==========================================================================
  /**
   * operationPacket + previousOperationState → standalone activeCycleDecision.
   * 입력 2종 mutate 0건 (DP-AC1).
   *
   * @param {Object} operationPacket
   * @param {Object} [previousOperationState]
   * @param {Object} [config]
   * @return {Object} activeCycleDecision
   */
  function buildActiveCycleDecision(operationPacket, previousOperationState, config) {
    var cfg = mergeActiveCycleConfig(config);
    var configUsed = makeConfigUsed(cfg);

    var topWarnings = [];
    if (!isPlainObject(operationPacket)) topWarnings.push('OPERATION_PACKET_NOT_OBJECT');

    var currentSummary = getPacketSummary(operationPacket);
    var identity = getIdentity(operationPacket);
    currentSummary.identity = identity;

    var normalizedPrev = normalizePreviousState(previousOperationState);
    var currentTs = getCurrentTs(operationPacket);

    // ageMs (for phase classification)
    var firstSeenForAge = (typeof normalizedPrev.lifecycle.firstSeenTs === 'number'
                           && isFinite(normalizedPrev.lifecycle.firstSeenTs))
      ? normalizedPrev.lifecycle.firstSeenTs
      : currentTs;
    var ageMs = (typeof currentTs === 'number' && isFinite(currentTs)
                 && typeof firstSeenForAge === 'number' && isFinite(firstSeenForAge))
      ? (currentTs - firstSeenForAge) : null;

    // 1. lifecycleState
    var lifecycleState = classifyLifecycleState(currentSummary, normalizedPrev, currentTs, cfg);

    // 2. nextSeenCount (for phase classification)
    var nextSeenCount = safeNumber(normalizedPrev.lifecycle.seenCount, 0) + 1;

    // 3. lifecyclePhase
    var lifecyclePhase = classifyLifecyclePhase(lifecycleState, nextSeenCount, ageMs, cfg);

    // 4. policies — notify 먼저 (transition 의 DUPLICATE_SUPPRESSED 입력)
    var notifyPolicy = buildNotifyPolicy(currentSummary, normalizedPrev, null,
                                          lifecycleState, currentTs, cfg);

    // 5. transition
    var transition = classifyTransition(currentSummary, normalizedPrev,
                                         lifecycleState, notifyPolicy.duplicateSuppressed);

    // 6. snapshot / evaluation policies
    var snapshotPolicy = buildSnapshotPolicy(currentSummary, transition, lifecycleState, cfg);
    var evaluationPolicy = buildEvaluationPolicy(currentSummary, transition, lifecycleState, cfg);

    // 7. routingDecision
    var routingDecision = buildRoutingDecision(currentSummary, notifyPolicy,
                                                snapshotPolicy, evaluationPolicy);

    // 8. nextState
    var nextState = buildNextState(currentSummary, normalizedPrev,
                                    lifecycleState, lifecyclePhase,
                                    {
                                      notifyPolicy: notifyPolicy,
                                      snapshotPolicy: snapshotPolicy,
                                      evaluationPolicy: evaluationPolicy
                                    }, currentTs, cfg);

    // transition flags
    var transitionObj = {
      type: transition,
      fromState: safeString(normalizedPrev.lifecycle.lifecycleState, 'NONE'),
      toState: lifecycleState,
      isNewCandidate: transition === TRANSITION_TYPE.NEW_CANDIDATE,
      isSameCandidate: transition === TRANSITION_TYPE.SAME_CANDIDATE,
      isCandidateChanged: transition === TRANSITION_TYPE.CANDIDATE_CHANGED,
      isStateChanged: transition === TRANSITION_TYPE.STATE_CHANGED,
      isStrengthening: transition === TRANSITION_TYPE.STRENGTHENED,
      isWeakening: transition === TRANSITION_TYPE.WEAKENED,
      isDuplicateSuppressed: transition === TRANSITION_TYPE.DUPLICATE_SUPPRESSED
    };

    // lifecycle (출력용)
    var lifecycleOut = {
      active: isActiveLifecycleState(lifecycleState),
      lifecycleState: lifecycleState,
      lifecyclePhase: lifecyclePhase,
      firstSeenTs: nextState.lifecycle.firstSeenTs,
      lastSeenTs: nextState.lifecycle.lastSeenTs,
      ageMs: ageMs,
      seenCount: nextSeenCount
    };

    // top-level reasons / warnings
    var topReasons = [];
    if (typeof currentSummary.candidateKey === 'string' && currentSummary.candidateKey) {
      topReasons.push('CANDIDATE_KEY_PRESENT');
    } else {
      topWarnings.push('CANDIDATE_KEY_MISSING');
    }
    topReasons.push('LIFECYCLE_STATE_' + lifecycleState);
    topReasons.push('LIFECYCLE_PHASE_' + lifecyclePhase);
    topReasons.push('TRANSITION_' + transition);

    var valid = isPlainObject(operationPacket)
                && typeof currentSummary.candidateKey === 'string'
                && currentSummary.candidateKey
                && lifecycleState !== LIFECYCLE_STATE.NONE;

    return normalizeActiveCycleDecision({
      valid: valid,
      candidateKey: currentSummary.candidateKey,
      identity: identity,
      lifecycle: lifecycleOut,
      transition: transitionObj,
      routingDecision: routingDecision,
      notifyPolicy: notifyPolicy,
      snapshotPolicy: snapshotPolicy,
      evaluationPolicy: evaluationPolicy,
      nextState: nextState,
      reasons: topReasons,
      warnings: topWarnings,
      debug: {
        source: 'operationPacket + previousOperationState',
        configVersion: cfg.version
      },
      configUsed: configUsed
    });
  }

  // ==========================================================================
  // §export — 이중 환경
  // ==========================================================================
  var api = Object.freeze({
    ACTIVE_CYCLE_VERSION: ACTIVE_CYCLE_VERSION,
    CONFIG_VERSION: CONFIG_VERSION,
    DEFAULT_ACTIVE_CYCLE_CONFIG: DEFAULT_ACTIVE_CYCLE_CONFIG,

    LIFECYCLE_STATE: LIFECYCLE_STATE,
    LIFECYCLE_PHASE: LIFECYCLE_PHASE,
    TRANSITION_TYPE: TRANSITION_TYPE,
    SNAPSHOT_MODE: SNAPSHOT_MODE,
    EVALUATION_MODE: EVALUATION_MODE,
    STATE_STRENGTH: STATE_STRENGTH,

    build: buildActiveCycleDecision,
    mergeActiveCycleConfig: mergeActiveCycleConfig,

    classifyLifecycleState: classifyLifecycleState,
    classifyLifecyclePhase: classifyLifecyclePhase,
    classifyTransition: classifyTransition,
    buildNotifyPolicy: buildNotifyPolicy,
    buildSnapshotPolicy: buildSnapshotPolicy,
    buildEvaluationPolicy: buildEvaluationPolicy,
    buildRoutingDecision: buildRoutingDecision,
    buildNextState: buildNextState,

    getCandidateKey: getCandidateKey,
    getCurrentTs: getCurrentTs,
    getIdentity: getIdentity,
    getPacketSummary: getPacketSummary,
    getStateStrength: getStateStrength,

    isActiveLifecycleState: isActiveLifecycleState,
    isSameCandidate: isSameCandidate,
    isStateChanged: isStateChanged,
    isStrengthening: isStrengthening,
    isWeakening: isWeakening,
    isSignalCooldown: isSignalCooldown,
    isNotifyCooldown: isNotifyCooldown,
    isExpiredByPacket: isExpiredByPacket,
    isExpiredByAge: isExpiredByAge,

    normalizePreviousState: normalizePreviousState,
    normalizeActiveCycleDecision: normalizeActiveCycleDecision,

    safeNumber: safeNumber,
    isPlainObject: isPlainObject
  });

  global.WS3_ActiveCycle = api;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis
   : typeof window !== 'undefined' ? window
   : typeof self !== 'undefined' ? self
   : this);
