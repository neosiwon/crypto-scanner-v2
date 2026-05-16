/**
 * WS3 v0.8.0 — OperationPacket (Notification / Snapshot / Evaluation 후보 패킷)
 *
 * Scope:
 *   V3FeaturePayload (c-r1)
 *   + scoreBreakdown   (v0.3.0)
 *   + structureDecision (v0.4.0)
 *   + signalCycle      (v0.5.0)
 *   + strategyPlan     (v0.6.0)
 *   + cardViewModel    (v0.7.0)
 *   → standalone operationPacket (transport-ready 데이터. transport 자체 아님)
 *
 * 단일 기준 문서:
 *   docs/ws3/WS3_CODE_CONTRACT.md (b-r2 박제본)
 *
 * 확정 DP 정책:
 *   DP-OP1   standalone 반환. 입력 6종 mutate / delete 금지.
 *   DP-OP2   side-effect 금지 (외부 전송 / 영속 저장 / network / DOM / browser storage).
 *   DP-OP3   출력: routing + notificationPacket + snapshotPacket + evaluationSeed +
 *            displaySummary 구조.
 *   DP-OP4   shouldNotify 기본 false. enable && valid && type != NONE 일 때만 true.
 *   DP-OP5   shouldSnapshot 기본 true. enable && valid && type != NONE 일 때만 true.
 *   DP-OP6   shouldEvaluate 기본 true. enable && valid && type != NONE 일 때만 true.
 *   DP-OP7   evaluationSeed 포함 (seed-only. 실제 평가는 후속 계층).
 *   DP-OP8   baselinePrice numeric only. object / range / string entryZone skip.
 *            isNumericPrice() 통과 후보만 사용.
 *   DP-OP9   safeHints numeric hint 허용. 라벨은 '참고 구간' / '무효화 기준' /
 *            '목표 힌트' / '손익비 힌트' 만. 매수가 / 손절가 / 익절가 라벨 금지.
 *   DP-OP10  raw payload / payload.raw / payload.raw.builderDebug 전체 직접 노출 금지.
 *            identityInput / candle raw array 직접 노출 영구 차단.
 *            debug.allowedFields whitelist 도 primitive safe fields 만 허용.
 *   DP-OP11  등급 코드 (단축 토큰) 외부 노출 금지. v0.8.0 은 packet routing 까지만.
 *   DP-OP12  candidateKey 재계산 금지. signalCycle.candidateKey 그대로 복사.
 *            snapshotKey = candidateKey + ':' + payload.ts.
 *
 * U-OP-1 ~ U-OP-3 확정 처리:
 *   U-OP-1 (identity merge)        — Option A: field-by-field fallback (§4 / §18).
 *   U-OP-2 (timestamp 기준 ts)     — Option A: payload.ts 단일 기준. primary candle ts 재해석 금지.
 *   U-OP-3 (isSameCandidate 방어) — defensive check:
 *                                    persistence && persistence.isSameCandidate === false.
 *
 * 금지 (이번 단계):
 *   외부 전송 / 알림 발송 / 메시지 채널 직접 호출.
 *   영속 저장 (KV / DB / 파일 IO / 브라우저 storage).
 *   network 호출 / XHR / 외부 fetch.
 *   DOM 트리 직접 조작 / HTML 문자열 생성 / event 바인딩.
 *   런타임 clock API 사용.
 *   입력 6종 mutation / delete.
 *   행동 지시 어조 ("매수하세요" / "매도하세요" 등).
 *   구버전 라벨 (구분 손절·익절 힌트, 매수·매도 신호 라벨, 등급 힌트 라벨).
 *   raw payload 객체 / payload.raw / payload.raw.builderDebug 전체 직접 노출.
 *   identityInput / candle raw array 직접 노출 (영구 차단 — whitelist 와 무관).
 *   bot 식별 시크릿 / 채널 식별자 / API 키.
 *   등급 코드 / tier 라벨 산출.
 *
 * 의존:
 *   payload          (v3-feature-payload-builder.js 산출)
 *   scoreBreakdown   (v3-score-breakdown.js, optional)
 *   structureDecision (v3-structure-bucket.js, optional)
 *   signalCycle      (v3-signal-cycle.js, optional)
 *   strategyPlan     (v3-strategy-plan.js, optional)
 *   cardViewModel    (v3-card-view-model.js, optional)
 */

(function (global) {
  'use strict';

  var OPERATION_PACKET_VERSION = 'WS3_v0.8.0';
  var CONFIG_VERSION = 'inline-default-v0';
  var DEFAULT_PRIMARY_TIMEFRAME = 'h1';

  // ==========================================================================
  // 상수 (DP-OP3 / DP-OP4 / DP-OP5 / DP-OP6)
  // ==========================================================================
  var NOTIFICATION_TYPE = Object.freeze({
    NONE: 'NONE',
    WATCH: 'WATCH',
    READY: 'READY',
    BLOCKED: 'BLOCKED',
    COOLDOWN: 'COOLDOWN',
    EXPIRED: 'EXPIRED'
  });

  var SNAPSHOT_TYPE = Object.freeze({
    NONE: 'NONE',
    CANDIDATE: 'CANDIDATE',
    STATE_CHANGE: 'STATE_CHANGE',
    COOLDOWN: 'COOLDOWN',
    EXPIRED: 'EXPIRED',
    DEBUG: 'DEBUG'
  });

  var EVALUATION_TYPE = Object.freeze({
    NONE: 'NONE',
    WATCH_24H: 'WATCH_24H',
    PLAN_24H: 'PLAN_24H',
    COOLDOWN_REVIEW: 'COOLDOWN_REVIEW',
    EXPIRED_REVIEW: 'EXPIRED_REVIEW'
  });

  var NOTIFICATION_CHANNEL = Object.freeze({
    NONE: 'NONE',
    TELEGRAM_CANDIDATE: 'TELEGRAM_CANDIDATE'
  });

  var SNAPSHOT_BUCKET = Object.freeze({
    NONE: 'NONE',
    CANDIDATE_SNAPSHOT: 'CANDIDATE_SNAPSHOT',
    STATE_SNAPSHOT: 'STATE_SNAPSHOT',
    DEBUG_SNAPSHOT: 'DEBUG_SNAPSHOT'
  });

  var EVALUATION_WINDOW = Object.freeze({
    NONE: 'NONE',
    H24: '24H',
    D7: '7D'
  });

  var SEVERITY = Object.freeze({
    NONE: 'none',
    INFO: 'info',
    NOTICE: 'notice',
    WARNING: 'warning',
    CRITICAL: 'critical'
  });

  // 안전 라벨 (DP-OP9 — 매수가/손절가/익절가 라벨 금지)
  var HINT_LABEL = Object.freeze({
    REFERENCE_ZONE:      { ko: '참고 구간',   en: 'Reference Zone' },
    INVALIDATION_LEVEL:  { ko: '무효화 기준', en: 'Invalidation Level' },
    TARGET_HINT:         { ko: '목표 힌트',   en: 'Target Hint' },
    RISK_REWARD_HINT:    { ko: '손익비 힌트', en: 'Risk/Reward Hint' }
  });

  // ==========================================================================
  // DEFAULT_OPERATION_PACKET_CONFIG (§21)
  // ==========================================================================
  var DEFAULT_OPERATION_PACKET_CONFIG = Object.freeze({
    version: CONFIG_VERSION,
    routing: Object.freeze({
      enableNotificationCandidate: false,
      enableSnapshotCandidate: true,
      enableEvaluationSeed: true
    }),
    notification: Object.freeze({
      maxLines: 8,
      maxChips: 6,
      maxMetrics: 6,
      includeSafeHints: true
    }),
    snapshot: Object.freeze({
      includeView: true,
      includeDebug: false
    }),
    evaluation: Object.freeze({
      defaultPlanHorizon: '24H',
      defaultWatchHorizon: '24H',
      allow7d: false
    }),
    safety: Object.freeze({
      allowTradingLanguage: false,
      allowRawDebug: false,
      allowSecrets: false
    }),
    debug: Object.freeze({
      enabled: false,
      allowedFields: Object.freeze([])
    })
  });

  function mergeOperationPacketConfig(config) {
    var c = config || {};
    var d = DEFAULT_OPERATION_PACKET_CONFIG;
    var rt = c.routing || {};
    var nt = c.notification || {};
    var sn = c.snapshot || {};
    var ev = c.evaluation || {};
    var sf = c.safety || {};
    var dbg = c.debug || {};
    return {
      version: typeof c.version === 'string' ? c.version : d.version,
      routing: {
        enableNotificationCandidate: rt.enableNotificationCandidate === true,
        enableSnapshotCandidate: rt.enableSnapshotCandidate !== false,
        enableEvaluationSeed: rt.enableEvaluationSeed !== false
      },
      notification: {
        maxLines: safeNumber(nt.maxLines, d.notification.maxLines),
        maxChips: safeNumber(nt.maxChips, d.notification.maxChips),
        maxMetrics: safeNumber(nt.maxMetrics, d.notification.maxMetrics),
        includeSafeHints: nt.includeSafeHints !== false
      },
      snapshot: {
        includeView: sn.includeView !== false,
        includeDebug: sn.includeDebug === true
      },
      evaluation: {
        defaultPlanHorizon: safeString(ev.defaultPlanHorizon, d.evaluation.defaultPlanHorizon),
        defaultWatchHorizon: safeString(ev.defaultWatchHorizon, d.evaluation.defaultWatchHorizon),
        allow7d: ev.allow7d === true
      },
      safety: {
        allowTradingLanguage: sf.allowTradingLanguage === true,
        allowRawDebug: sf.allowRawDebug === true,
        allowSecrets: sf.allowSecrets === true
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
      routing: {
        enableNotificationCandidate: cfg.routing.enableNotificationCandidate,
        enableSnapshotCandidate: cfg.routing.enableSnapshotCandidate,
        enableEvaluationSeed: cfg.routing.enableEvaluationSeed
      },
      notification: {
        maxLines: cfg.notification.maxLines,
        maxChips: cfg.notification.maxChips,
        maxMetrics: cfg.notification.maxMetrics,
        includeSafeHints: cfg.notification.includeSafeHints
      },
      snapshot: {
        includeView: cfg.snapshot.includeView,
        includeDebug: cfg.snapshot.includeDebug
      },
      evaluation: {
        defaultPlanHorizon: cfg.evaluation.defaultPlanHorizon,
        defaultWatchHorizon: cfg.evaluation.defaultWatchHorizon,
        allow7d: cfg.evaluation.allow7d
      },
      safety: {
        allowTradingLanguage: cfg.safety.allowTradingLanguage,
        allowRawDebug: cfg.safety.allowRawDebug,
        allowSecrets: cfg.safety.allowSecrets
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

  function pushUnique(arr, value) {
    if (!Array.isArray(arr) || typeof value !== 'string' || !value) return;
    if (arr.indexOf(value) === -1) arr.push(value);
  }

  // ==========================================================================
  // §isNumericPrice (DP-OP8)
  // ==========================================================================
  function isNumericPrice(value) {
    return typeof value === 'number' && isFinite(value) && value > 0;
  }

  // ==========================================================================
  // §getCurrentTs (U-OP-2 Option A — payload.ts only)
  // ==========================================================================
  function getCurrentTs(payload) {
    if (!isPlainObject(payload)) return null;
    if (typeof payload.ts === 'number' && isFinite(payload.ts)) return payload.ts;
    return null;
  }

  // ==========================================================================
  // §getPrimaryTimeframe / §getCurrentClose
  // ==========================================================================
  function getPrimaryTimeframe(payload) {
    if (isPlainObject(payload)
        && isPlainObject(payload.raw)
        && isPlainObject(payload.raw.builderDebug)
        && typeof payload.raw.builderDebug.primaryTimeframe === 'string'
        && payload.raw.builderDebug.primaryTimeframe) {
      return payload.raw.builderDebug.primaryTimeframe;
    }
    return DEFAULT_PRIMARY_TIMEFRAME;
  }

  function getCurrentClose(payload) {
    if (!isPlainObject(payload) || !isPlainObject(payload.candles)) return null;
    var tf = getPrimaryTimeframe(payload);
    var arr = payload.candles[tf];
    if (!Array.isArray(arr) || arr.length === 0) return null;
    var last = arr[arr.length - 1];
    if (!isPlainObject(last)) return null;
    return safeNumber(last.close, null);
  }

  // ==========================================================================
  // §getCandidateKey (DP-OP12 — 재계산 금지, signalCycle.candidateKey 복사)
  // ==========================================================================
  function getCandidateKey(signalCycle) {
    if (!isPlainObject(signalCycle)) return null;
    if (typeof signalCycle.candidateKey === 'string' && signalCycle.candidateKey) {
      return signalCycle.candidateKey;
    }
    return null;
  }

  // ==========================================================================
  // §getOperationIdentity (U-OP-1 Option A — field-by-field fallback)
  // 6-field 풀-set: exchange / market / base / quote / displayName / timeframe
  // ==========================================================================
  function getOperationIdentity(payload, cardViewModel) {
    var pid = (isPlainObject(payload) && isPlainObject(payload.identity)) ? payload.identity : null;
    var cvmId = (isPlainObject(cardViewModel) && isPlainObject(cardViewModel.identity)) ? cardViewModel.identity : null;
    var cvmHeader = (isPlainObject(cardViewModel) && isPlainObject(cardViewModel.header)) ? cardViewModel.header : null;

    // exchange
    var exchange = null;
    if (pid && typeof pid.exchange === 'string' && pid.exchange) exchange = pid.exchange;

    // market: cardViewModel.identity.market → payload.identity.market → null
    var market = null;
    if (cvmId && typeof cvmId.market === 'string' && cvmId.market) market = cvmId.market;
    else if (pid && typeof pid.market === 'string' && pid.market) market = pid.market;

    // base: payload.identity.base → cardViewModel.identity.symbol → null
    var base = null;
    if (pid && typeof pid.base === 'string' && pid.base) base = pid.base;
    else if (cvmId && typeof cvmId.symbol === 'string' && cvmId.symbol) base = cvmId.symbol;

    // quote
    var quote = null;
    if (pid && typeof pid.quote === 'string' && pid.quote) quote = pid.quote;

    // displayName: payload.identity.displayName → cardViewModel.header.title → cardViewModel.identity.symbol → null
    var displayName = null;
    if (pid && typeof pid.displayName === 'string' && pid.displayName) displayName = pid.displayName;
    else if (cvmHeader && typeof cvmHeader.title === 'string' && cvmHeader.title) displayName = cvmHeader.title;
    else if (cvmId && typeof cvmId.symbol === 'string' && cvmId.symbol) displayName = cvmId.symbol;

    // timeframe: cardViewModel.identity.timeframe → payload.raw.builderDebug.primaryTimeframe → 'h1'
    var timeframe = null;
    if (cvmId && typeof cvmId.timeframe === 'string' && cvmId.timeframe) {
      timeframe = cvmId.timeframe;
    } else {
      timeframe = getPrimaryTimeframe(payload);
    }

    return {
      exchange: exchange,
      market: market,
      base: base,
      quote: quote,
      displayName: displayName,
      timeframe: timeframe
    };
  }

  // ==========================================================================
  // §baselinePrice (DP-OP8)
  //   1. strategyPlan.entryPlan.referencePrice
  //   2. strategyPlan.entryPlan.entryZone (numeric only)
  //   3. payload.candles[primaryTimeframe] last close
  //   4. null
  // ==========================================================================
  function getBaselinePrice(inputs, cfg) {
    var sp = inputs.strategyPlan;
    var payload = inputs.payload;

    var ep = (isPlainObject(sp) && isPlainObject(sp.entryPlan)) ? sp.entryPlan : null;

    if (ep) {
      // 1. referencePrice
      if (isNumericPrice(ep.referencePrice)) return ep.referencePrice;
      // 2. entryZone (numeric only; object/range/string skip)
      if (isNumericPrice(ep.entryZone)) return ep.entryZone;
    }
    // 3. last close
    var close = getCurrentClose(payload);
    if (isNumericPrice(close)) return close;
    // 4. null
    return null;
  }

  // ==========================================================================
  // §targetHints / §invalidationHints / §safeHints (DP-OP9 / §15 / §16)
  // ==========================================================================
  function makeSafeHint(type, labelKo, labelEn, value, valueText, source) {
    var hint = {
      type: type,
      labelKo: labelKo,
      labelEn: labelEn,
      value: (typeof value === 'number' && isFinite(value)) ? value : null,
      valueText: (typeof valueText === 'string' && valueText) ? valueText : null,
      source: (typeof source === 'string' && source) ? source : null
    };
    return hint;
  }

  function getTargetHints(inputs, cfg) {
    var sp = inputs.strategyPlan;
    var hints = [];
    if (!isPlainObject(sp) || !isPlainObject(sp.exitPlan)) return hints;
    var th = sp.exitPlan.targetHint;
    if (typeof th === 'number' && isFinite(th)) {
      hints.push(makeSafeHint('TARGET',
        HINT_LABEL.TARGET_HINT.ko, HINT_LABEL.TARGET_HINT.en,
        th, null, 'strategyPlan.exitPlan.targetHint'));
    }
    return hints;
  }

  function getInvalidationHints(inputs, cfg) {
    var sp = inputs.strategyPlan;
    var hints = [];
    if (!isPlainObject(sp)) return hints;
    var ep = isPlainObject(sp.entryPlan) ? sp.entryPlan : null;
    var xp = isPlainObject(sp.exitPlan) ? sp.exitPlan : null;
    if (xp && typeof xp.invalidationHint === 'number' && isFinite(xp.invalidationHint)) {
      hints.push(makeSafeHint('INVALIDATION',
        HINT_LABEL.INVALIDATION_LEVEL.ko, HINT_LABEL.INVALIDATION_LEVEL.en,
        xp.invalidationHint, null, 'strategyPlan.exitPlan.invalidationHint'));
    }
    if (ep && typeof ep.setupInvalidationHint === 'number' && isFinite(ep.setupInvalidationHint)) {
      hints.push(makeSafeHint('SETUP_INVALIDATION',
        HINT_LABEL.INVALIDATION_LEVEL.ko, HINT_LABEL.INVALIDATION_LEVEL.en,
        ep.setupInvalidationHint, null, 'strategyPlan.entryPlan.setupInvalidationHint'));
    }
    return hints;
  }

  function getSafeHints(inputs, cfg) {
    var sp = inputs.strategyPlan;
    var hints = [];
    if (!isPlainObject(sp)) return hints;

    var ep = isPlainObject(sp.entryPlan) ? sp.entryPlan : null;
    var xp = isPlainObject(sp.exitPlan) ? sp.exitPlan : null;

    if (ep && typeof ep.entryZone === 'number' && isFinite(ep.entryZone)) {
      hints.push(makeSafeHint('REFERENCE_ZONE',
        HINT_LABEL.REFERENCE_ZONE.ko, HINT_LABEL.REFERENCE_ZONE.en,
        ep.entryZone, null, 'strategyPlan.entryPlan.entryZone'));
    }
    if (ep && typeof ep.setupInvalidationHint === 'number' && isFinite(ep.setupInvalidationHint)) {
      hints.push(makeSafeHint('INVALIDATION',
        HINT_LABEL.INVALIDATION_LEVEL.ko, HINT_LABEL.INVALIDATION_LEVEL.en,
        ep.setupInvalidationHint, null, 'strategyPlan.entryPlan.setupInvalidationHint'));
    }
    if (xp && typeof xp.invalidationHint === 'number' && isFinite(xp.invalidationHint)) {
      hints.push(makeSafeHint('INVALIDATION',
        HINT_LABEL.INVALIDATION_LEVEL.ko, HINT_LABEL.INVALIDATION_LEVEL.en,
        xp.invalidationHint, null, 'strategyPlan.exitPlan.invalidationHint'));
    }
    if (xp && typeof xp.targetHint === 'number' && isFinite(xp.targetHint)) {
      hints.push(makeSafeHint('TARGET',
        HINT_LABEL.TARGET_HINT.ko, HINT_LABEL.TARGET_HINT.en,
        xp.targetHint, null, 'strategyPlan.exitPlan.targetHint'));
    }
    if (xp && typeof xp.riskRewardHint === 'number' && isFinite(xp.riskRewardHint)) {
      hints.push(makeSafeHint('RISK_REWARD',
        HINT_LABEL.RISK_REWARD_HINT.ko, HINT_LABEL.RISK_REWARD_HINT.en,
        xp.riskRewardHint, null, 'strategyPlan.exitPlan.riskRewardHint'));
    }
    return hints;
  }

  // ==========================================================================
  // §classifyNotificationType (§7 — 6-step priority)
  // ==========================================================================
  function classifyNotificationType(inputs, cfg) {
    var sc = inputs.signalCycle;
    var sp = inputs.strategyPlan;
    var cvm = inputs.cardViewModel;

    var cycleState = (isPlainObject(sc) && typeof sc.cycleState === 'string') ? sc.cycleState : 'UNKNOWN';
    var bias = (isPlainObject(sp) && typeof sp.strategyBias === 'string') ? sp.strategyBias : 'UNKNOWN';
    var actionability = (isPlainObject(sp) && typeof sp.actionability === 'string') ? sp.actionability : 'NONE';
    var df = (isPlainObject(cvm) && isPlainObject(cvm.displayFlags)) ? cvm.displayFlags : null;

    // 1. EXPIRED
    if (cycleState === 'EXPIRED' || bias === 'EXPIRED_IGNORE') return NOTIFICATION_TYPE.EXPIRED;
    // 2. COOLDOWN
    if (cycleState === 'COOLDOWN' || bias === 'COOLDOWN_WAIT') return NOTIFICATION_TYPE.COOLDOWN;
    // 3. BLOCKED
    var isBlocked = (df && df.isBlocked === true) || actionability === 'BLOCKED' || bias === 'RISK_OFF';
    if (isBlocked) return NOTIFICATION_TYPE.BLOCKED;
    // 4. READY
    var isReady = (df && df.isReady === true);
    var notBlocked = !(df && df.isBlocked === true);
    if (isReady && notBlocked && (actionability === 'MEDIUM' || actionability === 'HIGH')) {
      return NOTIFICATION_TYPE.READY;
    }
    // 5. WATCH
    if ((bias === 'WATCH_ONLY' || bias === 'PULLBACK_WAIT') && !isBlocked) return NOTIFICATION_TYPE.WATCH;
    // 6. fallback
    return NOTIFICATION_TYPE.NONE;
  }

  // ==========================================================================
  // §classifySnapshotType (§10 — 7-step priority. U-OP-3 defensive)
  // ==========================================================================
  function classifySnapshotType(inputs, cfg) {
    var sc = inputs.signalCycle;
    var cycleState = (isPlainObject(sc) && typeof sc.cycleState === 'string') ? sc.cycleState : 'UNKNOWN';
    var persistence = (isPlainObject(sc) && isPlainObject(sc.persistence)) ? sc.persistence : null;
    var bucketTransition = (isPlainObject(sc) && sc.bucketTransition) ? sc.bucketTransition : null;

    // 1. DEBUG
    if (cfg.debug.enabled === true) return SNAPSHOT_TYPE.DEBUG;
    // 2. EXPIRED
    if (cycleState === 'EXPIRED') return SNAPSHOT_TYPE.EXPIRED;
    // 3. COOLDOWN
    if (cycleState === 'COOLDOWN') return SNAPSHOT_TYPE.COOLDOWN;
    // 4. STATE_CHANGE — defensive (U-OP-3)
    var sameCandidateFalse = !!persistence && persistence.isSameCandidate === false;
    if (sameCandidateFalse || bucketTransition !== null) return SNAPSHOT_TYPE.STATE_CHANGE;
    // 5. STATE_CHANGE — strengthening / weakening
    if (cycleState === 'STRENGTHENING' || cycleState === 'WEAKENING') return SNAPSHOT_TYPE.STATE_CHANGE;
    // 6. CANDIDATE
    if (cycleState === 'NEW_CANDIDATE' || cycleState === 'PERSISTING') return SNAPSHOT_TYPE.CANDIDATE;
    // 7. fallback
    return SNAPSHOT_TYPE.NONE;
  }

  // ==========================================================================
  // §classifyEvaluationType (§12 — 5-step priority)
  // ==========================================================================
  function classifyEvaluationType(inputs, cfg) {
    var sc = inputs.signalCycle;
    var sp = inputs.strategyPlan;
    var cycleState = (isPlainObject(sc) && typeof sc.cycleState === 'string') ? sc.cycleState : 'UNKNOWN';
    var bias = (isPlainObject(sp) && typeof sp.strategyBias === 'string') ? sp.strategyBias : 'UNKNOWN';
    var actionability = (isPlainObject(sp) && typeof sp.actionability === 'string') ? sp.actionability : 'NONE';

    // 1. EXPIRED_REVIEW
    if (cycleState === 'EXPIRED') return EVALUATION_TYPE.EXPIRED_REVIEW;
    // 2. COOLDOWN_REVIEW
    if (cycleState === 'COOLDOWN') return EVALUATION_TYPE.COOLDOWN_REVIEW;
    // 3. PLAN_24H
    var noTradeBias = (bias === 'NO_TRADE' || bias === 'RISK_OFF'
                       || bias === 'COOLDOWN_WAIT' || bias === 'EXPIRED_IGNORE');
    if ((actionability === 'MEDIUM' || actionability === 'HIGH') && !noTradeBias) {
      return EVALUATION_TYPE.PLAN_24H;
    }
    // 4. WATCH_24H
    if ((bias === 'WATCH_ONLY' || bias === 'PULLBACK_WAIT')
        && cycleState !== 'COOLDOWN' && cycleState !== 'EXPIRED') {
      return EVALUATION_TYPE.WATCH_24H;
    }
    // 5. fallback
    return EVALUATION_TYPE.NONE;
  }

  // ==========================================================================
  // §makeSafeLine / §makeSafeMetric
  // ==========================================================================
  function makeSafeLine(key, labelKo, labelEn, valueText, tone, source) {
    return {
      key: typeof key === 'string' ? key : null,
      labelKo: typeof labelKo === 'string' ? labelKo : null,
      labelEn: typeof labelEn === 'string' ? labelEn : null,
      valueText: typeof valueText === 'string' ? valueText : null,
      tone: typeof tone === 'string' ? tone : 'neutral',
      source: typeof source === 'string' ? source : null
    };
  }

  function makeSafeMetric(key, labelKo, labelEn, value, valueText, source) {
    return {
      key: typeof key === 'string' ? key : null,
      labelKo: typeof labelKo === 'string' ? labelKo : null,
      labelEn: typeof labelEn === 'string' ? labelEn : null,
      value: (typeof value === 'number' && isFinite(value)) ? value
            : (typeof value === 'string' ? value : null),
      valueText: typeof valueText === 'string' ? valueText : null,
      source: typeof source === 'string' ? source : null
    };
  }

  // ==========================================================================
  // §buildNotificationPacket (§7 / §8 / §9)
  // ==========================================================================
  function buildNotificationPacket(inputs, cfg) {
    var ctx = {
      valid: false,
      type: NOTIFICATION_TYPE.NONE,
      severity: SEVERITY.NONE,
      title: null,
      summary: null,
      lines: [],
      chips: [],
      metrics: [],
      safeHints: [],
      reasons: [],
      warnings: []
    };

    var cvm = inputs.cardViewModel;
    var sp = inputs.strategyPlan;
    var sc = inputs.signalCycle;

    var type = classifyNotificationType(inputs, cfg);
    ctx.type = type;

    if (type === NOTIFICATION_TYPE.EXPIRED) ctx.severity = SEVERITY.CRITICAL;
    else if (type === NOTIFICATION_TYPE.BLOCKED) ctx.severity = SEVERITY.WARNING;
    else if (type === NOTIFICATION_TYPE.COOLDOWN) ctx.severity = SEVERITY.NOTICE;
    else if (type === NOTIFICATION_TYPE.READY) ctx.severity = SEVERITY.INFO;
    else if (type === NOTIFICATION_TYPE.WATCH) ctx.severity = SEVERITY.INFO;

    // title / summary — cardViewModel.header 사용 (안전 요약)
    if (isPlainObject(cvm) && isPlainObject(cvm.header)) {
      ctx.title = safeString(cvm.header.title, null);
      ctx.summary = safeString(cvm.header.subtitle, null);
    }

    // chips passthrough (cardViewModel.chips 가 안전 라벨 객체)
    var maxChips = safeNumber(cfg.notification.maxChips, 6);
    if (isPlainObject(cvm) && Array.isArray(cvm.chips)) {
      for (var i = 0; i < cvm.chips.length && ctx.chips.length < maxChips; i = i + 1) {
        var ch = cvm.chips[i];
        if (isPlainObject(ch)) {
          ctx.chips.push({
            key: safeString(ch.id, null),
            labelKey: safeString(ch.labelKey, null),
            labelKo: safeString(ch.labelKo, null),
            labelEn: safeString(ch.labelEn, null),
            tone: safeString(ch.tone, 'neutral')
          });
        }
      }
    }

    // metrics passthrough (cardViewModel.metrics 가 안전 라벨/값 객체)
    var maxMetrics = safeNumber(cfg.notification.maxMetrics, 6);
    if (isPlainObject(cvm) && Array.isArray(cvm.metrics)) {
      for (var j = 0; j < cvm.metrics.length && ctx.metrics.length < maxMetrics; j = j + 1) {
        var m = cvm.metrics[j];
        if (isPlainObject(m)) {
          ctx.metrics.push(makeSafeMetric(
            safeString(m.id, null),
            safeString(m.labelKo, null),
            safeString(m.labelEn, null),
            m.value,
            null,
            'cardViewModel.metrics'
          ));
        }
      }
    }

    // lines (안전 요약, 명령 어조 금지)
    var maxLines = safeNumber(cfg.notification.maxLines, 8);
    if (type !== NOTIFICATION_TYPE.NONE) {
      if (ctx.lines.length < maxLines && isPlainObject(sp)) {
        var biasLabelKo = isPlainObject(cvm) && isPlainObject(cvm.sections)
          && isPlainObject(cvm.sections.strategy) && typeof cvm.sections.strategy.biasLabelKo === 'string'
          ? cvm.sections.strategy.biasLabelKo : null;
        if (biasLabelKo) {
          ctx.lines.push(makeSafeLine('BIAS', '전략 편향', 'Strategy Bias',
            biasLabelKo, ctx.severity, 'cardViewModel.sections.strategy.biasLabelKo'));
        }
      }
      if (ctx.lines.length < maxLines && isPlainObject(sc) && typeof sc.cycleState === 'string') {
        ctx.lines.push(makeSafeLine('CYCLE', '사이클 상태', 'Cycle State',
          sc.cycleState, ctx.severity, 'signalCycle.cycleState'));
      }
    }

    // safeHints (DP-OP9 — 매수가 / 손절가 / 익절가 라벨 금지)
    if (cfg.notification.includeSafeHints === true && type !== NOTIFICATION_TYPE.NONE) {
      var hints = getSafeHints(inputs, cfg);
      for (var h = 0; h < hints.length; h = h + 1) {
        ctx.safeHints.push(hints[h]);
      }
    }

    // valid
    ctx.valid = (type !== NOTIFICATION_TYPE.NONE)
                && (isPlainObject(sp) || isPlainObject(cvm) || isPlainObject(sc));

    if (type === NOTIFICATION_TYPE.NONE) pushReason(ctx, 'NOTIFICATION_NONE');
    else pushReason(ctx, 'NOTIFICATION_TYPE_' + type);

    return ctx;
  }

  // ==========================================================================
  // §buildSnapshotPacket (§10 / §11)
  // ==========================================================================
  function buildSnapshotPacket(inputs, cfg) {
    var ctx = {
      valid: false,
      snapshotType: SNAPSHOT_TYPE.NONE,
      snapshotKey: null,
      timestamp: null,
      identity: {},
      state: {},
      scores: {},
      structure: {},
      cycle: {},
      strategy: {},
      view: {},
      reasons: [],
      warnings: []
    };

    var payload = inputs.payload;
    var sb = inputs.scoreBreakdown;
    var sd = inputs.structureDecision;
    var sc = inputs.signalCycle;
    var sp = inputs.strategyPlan;
    var cvm = inputs.cardViewModel;

    var snapshotType = classifySnapshotType(inputs, cfg);
    ctx.snapshotType = snapshotType;

    // timestamp (U-OP-2 Option A — payload.ts only)
    var ts = getCurrentTs(payload);
    ctx.timestamp = ts;

    // snapshotKey = candidateKey + ':' + ts (둘 다 valid 일 때만)
    var ck = getCandidateKey(sc);
    if (typeof ck === 'string' && ck && typeof ts === 'number' && isFinite(ts)) {
      ctx.snapshotKey = ck + ':' + ts;
    }

    // identity (operation identity 그대로 복사)
    ctx.identity = getOperationIdentity(payload, cvm);

    // state
    if (isPlainObject(sc)) {
      ctx.state = {
        cycleState: safeString(sc.cycleState, 'UNKNOWN'),
        cyclePhase: safeString(sc.cyclePhase, 'UNKNOWN'),
        bucketFamily: safeString(sc.bucketFamily, 'NONE'),
        ageBars: safeNumber(sc.ageBars, null)
      };
    }

    // scores
    if (isPlainObject(sb)) {
      ctx.scores = {
        totalScore: safeNumber(sb.totalScore, null),
        grossScore: safeNumber(sb.grossScore, null),
        riskPenalty: safeNumber(sb.riskPenalty, null),
        structureScore: (isPlainObject(sb.components) && isPlainObject(sb.components.structure))
          ? safeNumber(sb.components.structure.score, null) : null,
        executionScore: (isPlainObject(sb.components) && isPlainObject(sb.components.execution))
          ? safeNumber(sb.components.execution.score, null) : null
      };
    }

    // structure
    if (isPlainObject(sd)) {
      ctx.structure = {
        structureBucket: safeString(sd.structureBucket, 'UNKNOWN'),
        confidence: safeNumber(sd.confidence, null),
        priceZone: (isPlainObject(sd.priceZone) && typeof sd.priceZone.zone === 'string')
          ? sd.priceZone.zone : 'UNKNOWN'
      };
    }

    // cycle
    if (isPlainObject(sc)) {
      var persistence = isPlainObject(sc.persistence) ? sc.persistence : null;
      ctx.cycle = {
        cycleState: safeString(sc.cycleState, 'UNKNOWN'),
        streak: persistence ? safeNumber(persistence.streak, null) : null,
        isSameCandidate: !!persistence && persistence.isSameCandidate === true,
        bucketTransition: (sc.bucketTransition && isPlainObject(sc.bucketTransition))
          ? { from: safeString(sc.bucketTransition.from, null), to: safeString(sc.bucketTransition.to, null) }
          : null
      };
    }

    // strategy
    if (isPlainObject(sp)) {
      ctx.strategy = {
        strategyBias: safeString(sp.strategyBias, 'UNKNOWN'),
        planType: safeString(sp.planType, 'NONE'),
        actionability: safeString(sp.actionability, 'NONE'),
        planQualityTier: safeString(sp.planQualityTier, 'NONE')
      };
    }

    // view (cardViewModel 안전 요약)
    if (cfg.snapshot.includeView === true && isPlainObject(cvm)) {
      ctx.view = {
        title: (isPlainObject(cvm.header) && typeof cvm.header.title === 'string') ? cvm.header.title : null,
        subtitle: (isPlainObject(cvm.header) && typeof cvm.header.subtitle === 'string') ? cvm.header.subtitle : null,
        primaryBadge: (isPlainObject(cvm.header) && isPlainObject(cvm.header.primaryBadge))
          ? {
              id: safeString(cvm.header.primaryBadge.id, null),
              labelKey: safeString(cvm.header.primaryBadge.labelKey, null),
              labelKo: safeString(cvm.header.primaryBadge.labelKo, null),
              tone: safeString(cvm.header.primaryBadge.tone, null)
            }
          : null,
        tone: safeString(cvm.tone, null)
      };
    }

    ctx.valid = (snapshotType !== SNAPSHOT_TYPE.NONE);
    pushReason(ctx, 'SNAPSHOT_TYPE_' + snapshotType);

    if (ctx.valid && ctx.snapshotKey === null) {
      pushWarning(ctx, 'SNAPSHOT_KEY_MISSING');
    }
    if (ts === null) {
      pushWarning(ctx, 'TIMESTAMP_MISSING');
    }

    return ctx;
  }

  // ==========================================================================
  // §buildEvaluationSeed (§12 / §13 / §14 / §15)
  // ==========================================================================
  function buildEvaluationSeed(inputs, cfg) {
    var ctx = {
      valid: false,
      evaluationType: EVALUATION_TYPE.NONE,
      startTs: null,
      horizon: EVALUATION_WINDOW.NONE,
      baselinePrice: null,
      targetHints: [],
      invalidationHints: [],
      expectedFields: [],
      reasons: [],
      warnings: []
    };

    var payload = inputs.payload;
    var evalType = classifyEvaluationType(inputs, cfg);
    ctx.evaluationType = evalType;

    // startTs (U-OP-2 Option A — payload.ts only)
    ctx.startTs = getCurrentTs(payload);

    // horizon
    if (evalType === EVALUATION_TYPE.PLAN_24H) {
      ctx.horizon = safeString(cfg.evaluation.defaultPlanHorizon, EVALUATION_WINDOW.H24);
    } else if (evalType === EVALUATION_TYPE.WATCH_24H) {
      ctx.horizon = safeString(cfg.evaluation.defaultWatchHorizon, EVALUATION_WINDOW.H24);
    } else {
      ctx.horizon = EVALUATION_WINDOW.NONE;
    }

    // baselinePrice (DP-OP8)
    ctx.baselinePrice = getBaselinePrice(inputs, cfg);

    // targetHints / invalidationHints
    var th = getTargetHints(inputs, cfg);
    for (var i = 0; i < th.length; i = i + 1) ctx.targetHints.push(th[i]);
    var ih = getInvalidationHints(inputs, cfg);
    for (var j = 0; j < ih.length; j = j + 1) ctx.invalidationHints.push(ih[j]);

    // expectedFields — 후속 평가 계층이 채울 field 예약 라벨
    ctx.expectedFields = ['returnPct', 'maxDrawdownPct', 'reachedTarget', 'invalidated'];

    ctx.valid = (evalType !== EVALUATION_TYPE.NONE);
    pushReason(ctx, 'EVALUATION_TYPE_' + evalType);

    if (ctx.valid && ctx.startTs === null) pushWarning(ctx, 'START_TS_MISSING');
    if (ctx.valid && ctx.baselinePrice === null) pushWarning(ctx, 'BASELINE_PRICE_MISSING');

    return ctx;
  }

  // ==========================================================================
  // §buildDisplaySummary (§19)
  // ==========================================================================
  function buildDisplaySummary(cardViewModel) {
    var summary = {
      title: null,
      subtitle: null,
      primaryBadge: null,
      tone: null
    };
    if (!isPlainObject(cardViewModel)) return summary;
    var header = isPlainObject(cardViewModel.header) ? cardViewModel.header : null;
    if (header) {
      summary.title = safeString(header.title, null);
      summary.subtitle = safeString(header.subtitle, null);
      if (isPlainObject(header.primaryBadge)) {
        summary.primaryBadge = {
          id: safeString(header.primaryBadge.id, null),
          labelKey: safeString(header.primaryBadge.labelKey, null),
          labelKo: safeString(header.primaryBadge.labelKo, null),
          tone: safeString(header.primaryBadge.tone, null)
        };
      }
    }
    summary.tone = safeString(cardViewModel.tone, null);
    return summary;
  }

  // ==========================================================================
  // §buildRouting (§17 — shouldNotify / shouldSnapshot / shouldEvaluate)
  // ==========================================================================
  function buildRouting(inputs, packets, cfg) {
    var ctx = {
      shouldNotify: false,
      shouldSnapshot: false,
      shouldEvaluate: false,
      notificationChannel: NOTIFICATION_CHANNEL.NONE,
      snapshotBucket: SNAPSHOT_BUCKET.NONE,
      evaluationWindow: EVALUATION_WINDOW.NONE,
      reasons: [],
      warnings: []
    };

    var np = packets.notificationPacket;
    var sp = packets.snapshotPacket;
    var es = packets.evaluationSeed;

    // shouldNotify
    ctx.shouldNotify = (cfg.routing.enableNotificationCandidate === true)
                       && isPlainObject(np)
                       && np.valid === true
                       && np.type !== NOTIFICATION_TYPE.NONE;
    if (ctx.shouldNotify) {
      ctx.notificationChannel = NOTIFICATION_CHANNEL.TELEGRAM_CANDIDATE;
      pushReason(ctx, 'NOTIFY_ENABLED');
    } else {
      pushReason(ctx, 'NOTIFY_SKIPPED');
      if (cfg.routing.enableNotificationCandidate !== true) pushReason(ctx, 'CONFIG_DISABLED');
      if (isPlainObject(np) && np.type === NOTIFICATION_TYPE.NONE) pushReason(ctx, 'TYPE_NONE');
    }

    // shouldSnapshot
    ctx.shouldSnapshot = (cfg.routing.enableSnapshotCandidate === true)
                         && isPlainObject(sp)
                         && sp.valid === true
                         && sp.snapshotType !== SNAPSHOT_TYPE.NONE;
    if (ctx.shouldSnapshot) {
      var st = sp.snapshotType;
      if (st === SNAPSHOT_TYPE.DEBUG) ctx.snapshotBucket = SNAPSHOT_BUCKET.DEBUG_SNAPSHOT;
      else if (st === SNAPSHOT_TYPE.STATE_CHANGE
               || st === SNAPSHOT_TYPE.COOLDOWN
               || st === SNAPSHOT_TYPE.EXPIRED) ctx.snapshotBucket = SNAPSHOT_BUCKET.STATE_SNAPSHOT;
      else if (st === SNAPSHOT_TYPE.CANDIDATE) ctx.snapshotBucket = SNAPSHOT_BUCKET.CANDIDATE_SNAPSHOT;
      pushReason(ctx, 'SNAPSHOT_ENABLED');
    } else {
      pushReason(ctx, 'SNAPSHOT_SKIPPED');
    }

    // shouldEvaluate
    ctx.shouldEvaluate = (cfg.routing.enableEvaluationSeed === true)
                         && isPlainObject(es)
                         && es.valid === true
                         && es.evaluationType !== EVALUATION_TYPE.NONE;
    if (ctx.shouldEvaluate) {
      var eh = safeString(es.horizon, EVALUATION_WINDOW.NONE);
      if (eh === '24H') ctx.evaluationWindow = EVALUATION_WINDOW.H24;
      else if (eh === '7D' && cfg.evaluation.allow7d === true) ctx.evaluationWindow = EVALUATION_WINDOW.D7;
      else ctx.evaluationWindow = EVALUATION_WINDOW.NONE;
      pushReason(ctx, 'EVALUATE_ENABLED');
    } else {
      pushReason(ctx, 'EVALUATE_SKIPPED');
    }

    return ctx;
  }

  // ==========================================================================
  // §collectReasonsAndWarnings (4종 산출 + cardViewModel 의 reasons/warnings dedupe)
  // ==========================================================================
  function collectTopLevel(inputs) {
    var reasons = [];
    var warnings = [];
    var sources = [inputs.scoreBreakdown, inputs.structureDecision, inputs.signalCycle,
                   inputs.strategyPlan, inputs.cardViewModel];
    for (var i = 0; i < sources.length; i = i + 1) {
      var src = sources[i];
      if (!isPlainObject(src)) continue;
      if (Array.isArray(src.reasons)) {
        for (var j = 0; j < src.reasons.length; j = j + 1) pushUnique(reasons, String(src.reasons[j]));
      }
      if (Array.isArray(src.warnings)) {
        for (var k = 0; k < src.warnings.length; k = k + 1) pushUnique(warnings, String(src.warnings[k]));
      }
    }
    return { reasons: reasons, warnings: warnings };
  }

  // ==========================================================================
  // §normalize 출력
  // ==========================================================================
  function normalizeOperationPacket(result) {
    return {
      valid: result.valid === true,
      version: OPERATION_PACKET_VERSION,
      candidateKey: typeof result.candidateKey === 'string' ? result.candidateKey : null,
      identity: result.identity,
      routing: result.routing,
      notificationPacket: result.notificationPacket,
      snapshotPacket: result.snapshotPacket,
      evaluationSeed: result.evaluationSeed,
      displaySummary: result.displaySummary,
      reasons: Array.isArray(result.reasons) ? result.reasons.slice() : [],
      warnings: Array.isArray(result.warnings) ? result.warnings.slice() : [],
      debug: result.debug,
      configUsed: result.configUsed
    };
  }

  // ==========================================================================
  // §main — buildOperationPacket
  // ==========================================================================
  /**
   * payload + scoreBreakdown + structureDecision + signalCycle + strategyPlan + cardViewModel
   * → standalone operationPacket. 입력 6종 mutate 0건 (DP-OP1).
   *
   * @param {Object} payload
   * @param {Object} [scoreBreakdown]
   * @param {Object} [structureDecision]
   * @param {Object} [signalCycle]
   * @param {Object} [strategyPlan]
   * @param {Object} [cardViewModel]
   * @param {Object} [config]
   * @return {Object} operationPacket
   */
  function buildOperationPacket(payload, scoreBreakdown, structureDecision, signalCycle, strategyPlan, cardViewModel, config) {
    var cfg = mergeOperationPacketConfig(config);
    var configUsed = makeConfigUsed(cfg);

    var inputs = {
      payload: payload,
      scoreBreakdown: scoreBreakdown,
      structureDecision: structureDecision,
      signalCycle: signalCycle,
      strategyPlan: strategyPlan,
      cardViewModel: cardViewModel
    };

    var topWarnings = [];
    if (!isPlainObject(payload)) topWarnings.push('PAYLOAD_NOT_OBJECT');
    if (!isPlainObject(scoreBreakdown)) topWarnings.push('SCORE_BREAKDOWN_NOT_OBJECT');
    if (!isPlainObject(structureDecision)) topWarnings.push('STRUCTURE_DECISION_NOT_OBJECT');
    if (!isPlainObject(signalCycle)) topWarnings.push('SIGNAL_CYCLE_NOT_OBJECT');
    if (!isPlainObject(strategyPlan)) topWarnings.push('STRATEGY_PLAN_NOT_OBJECT');
    if (!isPlainObject(cardViewModel)) topWarnings.push('CARD_VIEW_MODEL_NOT_OBJECT');

    // identity / candidateKey
    var identity = getOperationIdentity(payload, cardViewModel);
    var candidateKey = getCandidateKey(signalCycle);

    // packets
    var notificationPacket = buildNotificationPacket(inputs, cfg);
    var snapshotPacket = buildSnapshotPacket(inputs, cfg);
    var evaluationSeed = buildEvaluationSeed(inputs, cfg);
    var displaySummary = buildDisplaySummary(cardViewModel);

    // routing
    var routing = buildRouting(inputs, {
      notificationPacket: notificationPacket,
      snapshotPacket: snapshotPacket,
      evaluationSeed: evaluationSeed
    }, cfg);

    // top-level reasons / warnings
    var collected = collectTopLevel(inputs);
    var topReasons = collected.reasons;
    var mergedWarnings = collected.warnings.slice();
    for (var w = 0; w < topWarnings.length; w = w + 1) pushUnique(mergedWarnings, topWarnings[w]);

    pushUnique(topReasons, 'NOTIFICATION_TYPE_' + notificationPacket.type);
    pushUnique(topReasons, 'SNAPSHOT_TYPE_' + snapshotPacket.snapshotType);
    pushUnique(topReasons, 'EVALUATION_TYPE_' + evaluationSeed.evaluationType);
    if (candidateKey === null) pushUnique(mergedWarnings, 'CANDIDATE_KEY_MISSING');

    var valid = isPlainObject(payload)
                && (isPlainObject(strategyPlan) || isPlainObject(signalCycle) || isPlainObject(cardViewModel));

    return normalizeOperationPacket({
      valid: valid,
      candidateKey: candidateKey,
      identity: identity,
      routing: routing,
      notificationPacket: notificationPacket,
      snapshotPacket: snapshotPacket,
      evaluationSeed: evaluationSeed,
      displaySummary: displaySummary,
      reasons: topReasons,
      warnings: mergedWarnings,
      debug: {
        source: 'payload + scoreBreakdown + structureDecision + signalCycle + strategyPlan + cardViewModel',
        configVersion: cfg.version
      },
      configUsed: configUsed
    });
  }

  // ==========================================================================
  // §export — 이중 환경
  // ==========================================================================
  var api = Object.freeze({
    OPERATION_PACKET_VERSION: OPERATION_PACKET_VERSION,
    CONFIG_VERSION: CONFIG_VERSION,
    DEFAULT_OPERATION_PACKET_CONFIG: DEFAULT_OPERATION_PACKET_CONFIG,

    NOTIFICATION_TYPE: NOTIFICATION_TYPE,
    SNAPSHOT_TYPE: SNAPSHOT_TYPE,
    EVALUATION_TYPE: EVALUATION_TYPE,
    NOTIFICATION_CHANNEL: NOTIFICATION_CHANNEL,
    SNAPSHOT_BUCKET: SNAPSHOT_BUCKET,
    EVALUATION_WINDOW: EVALUATION_WINDOW,
    SEVERITY: SEVERITY,
    HINT_LABEL: HINT_LABEL,

    build: buildOperationPacket,
    mergeOperationPacketConfig: mergeOperationPacketConfig,

    getOperationIdentity: getOperationIdentity,
    getCandidateKey: getCandidateKey,
    getCurrentTs: getCurrentTs,
    getPrimaryTimeframe: getPrimaryTimeframe,
    getCurrentClose: getCurrentClose,

    buildRouting: buildRouting,
    buildNotificationPacket: buildNotificationPacket,
    buildSnapshotPacket: buildSnapshotPacket,
    buildEvaluationSeed: buildEvaluationSeed,
    buildDisplaySummary: buildDisplaySummary,

    classifyNotificationType: classifyNotificationType,
    classifySnapshotType: classifySnapshotType,
    classifyEvaluationType: classifyEvaluationType,

    isNumericPrice: isNumericPrice,
    getBaselinePrice: getBaselinePrice,
    getTargetHints: getTargetHints,
    getInvalidationHints: getInvalidationHints,
    getSafeHints: getSafeHints,

    makeSafeLine: makeSafeLine,
    makeSafeMetric: makeSafeMetric,
    makeSafeHint: makeSafeHint,

    normalizeOperationPacket: normalizeOperationPacket,
    pushReason: pushReason,
    pushWarning: pushWarning,

    safeNumber: safeNumber,
    isPlainObject: isPlainObject
  });

  global.WS3_OperationPacket = api;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis
   : typeof window !== 'undefined' ? window
   : typeof self !== 'undefined' ? self
   : this);
