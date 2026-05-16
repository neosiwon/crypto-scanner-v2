/**
 * WS3 v0.6.0 — strategyBias / entryPlan / exitPlan
 *
 * Scope:
 *   v3FeaturePayload (c-r1)
 *   + scoreBreakdown (v0.3.0)
 *   + structureDecision (v0.4.0)
 *   + signalCycle (v0.5.0)
 *   → standalone strategyPlan 객체
 *
 * 단일 기준 문서:
 *   docs/ws3/WS3_CODE_CONTRACT.md (b-r2 박제본)
 *
 * U-STRAT-1 처리 방침 (Gate 1 발견 — Option B 확정):
 *   작업지시서 표기를 실제 v0.4.0 산출 라벨 기준으로 정정해 구현.
 *     BOX_TOP        → priceZone.zone === 'TOP_NEAR'
 *     BOX_BOTTOM     → priceZone.zone === 'BOTTOM_NEAR'
 *     BOX_MIDDLE     → priceZone.zone === 'MIDDLE'
 *     ABOVE_BOX      → structureDecision.structureBucket === 'ABOVE_BOX_CONFIRMED_CANDIDATE'
 *     BELOW_BOX      → structureDecision.structureBucket === 'BELOW_BOX_CONFIRMED_CANDIDATE'
 *
 * 확정 DP 정책:
 *   DP-STRAT1  standalone strategyPlan. payload/scoreBreakdown/structureDecision/signalCycle mutate 금지.
 *   DP-STRAT2  strategyBias 10 후보 (UNKNOWN / NO_TRADE / WATCH_ONLY / PULLBACK_WAIT / BREAKOUT_READY /
 *              RECLAIM_READY / MOMENTUM_FOLLOW / RISK_OFF / COOLDOWN_WAIT / EXPIRED_IGNORE).
 *   DP-STRAT3  planType 7 후보 (NONE / WATCH / PULLBACK / BREAKOUT / RECLAIM / MOMENTUM / RISK_OFF).
 *   DP-STRAT4  actionability 5 후보 (NONE / LOW / MEDIUM / HIGH / BLOCKED).
 *              HIGH ≠ "매수하라". 엔진상 계획 후보가 상대적으로 명확하다는 의미.
 *   DP-STRAT5  planQualityTier 7 후보 (PLAN_PREMIUM / PLAN_STRONG / PLAN_STANDARD /
 *              PLAN_WATCH / PLAN_WEAK / PLAN_AVOID / NONE). 알림 등급 아님. 등급 코드 매핑 X.
 *   DP-STRAT6  numeric hint 허용. 실제 주문가 아님.
 *   DP-STRAT7  invalidationHint / targetHint 사용. (구버전 손절·익절 힌트 라벨 사용 금지.)
 *   DP-STRAT8  ABOVE_BOX 추격: cfg.risk.allowChaseAboveBox 기본 false. requirePullback.
 *   DP-STRAT9  WEAKENING → RISK_OFF/BLOCKED. COOLDOWN → COOLDOWN_WAIT/BLOCKED.
 *              EXPIRED → EXPIRED_IGNORE/BLOCKED.
 *   DP-STRAT10 strategyBias 분류 우선순위 (risk/cooldown/expired → reclaim/breakout →
 *              BOX_TOP_PRESSURE 분기 → momentum → fallback watch).
 *   DP-STRAT11 4축 용도 분리 (strategyBias / planType / actionability / planQualityTier).
 *
 * 금지 (이번 단계):
 *   실제 매수/매도 주문. 알림 발송. 화면 모델 / 렌더 계층 / UI. 외부 신호.
 *   등급 코드 매핑 / 알림 등급 산출.
 *   payload / scoreBreakdown / structureDecision / signalCycle mutation / delete.
 *   외부 API 호출 / DOM / 브라우저 storage / KV.
 *   런타임 clock API 사용.
 *   저장소 read/write.
 *
 * 의존:
 *   payload  (v3-feature-payload-builder.js 산출)
 *   scoreBreakdown (v3-score-breakdown.js, optional)
 *   structureDecision (v3-structure-bucket.js)
 *   signalCycle (v3-signal-cycle.js)
 */

(function (global) {
  'use strict';

  var STRATEGY_PLAN_VERSION = 'WS3_v0.6.0';
  var CONFIG_VERSION = 'inline-default-v0';
  var DEFAULT_PRIMARY_TIMEFRAME = 'h1';

  var STRATEGY_BIAS_TO_PLAN_TYPE = Object.freeze({
    UNKNOWN: 'NONE',
    NO_TRADE: 'NONE',
    WATCH_ONLY: 'WATCH',
    PULLBACK_WAIT: 'PULLBACK',
    BREAKOUT_READY: 'BREAKOUT',
    RECLAIM_READY: 'RECLAIM',
    MOMENTUM_FOLLOW: 'MOMENTUM',
    RISK_OFF: 'RISK_OFF',
    COOLDOWN_WAIT: 'NONE',
    EXPIRED_IGNORE: 'NONE'
  });

  var BLOCKED_BIAS_SET = ['NO_TRADE', 'RISK_OFF', 'COOLDOWN_WAIT', 'EXPIRED_IGNORE'];
  var ACTIVE_BIAS_SET = ['BREAKOUT_READY', 'RECLAIM_READY', 'MOMENTUM_FOLLOW'];
  var WATCH_BIAS_SET = ['WATCH_ONLY', 'PULLBACK_WAIT'];
  var AVOID_CYCLE_SET = ['WEAKENING', 'COOLDOWN', 'EXPIRED'];
  var GOOD_CYCLE_SET = ['STRENGTHENING', 'PERSISTING', 'NEW_CANDIDATE'];

  // ==========================================================================
  // DEFAULT_STRATEGY_PLAN_CONFIG
  // ==========================================================================
  var DEFAULT_STRATEGY_PLAN_CONFIG = Object.freeze({
    version: CONFIG_VERSION,
    thresholds: Object.freeze({
      premiumScore: 80,
      strongScore: 70,
      standardScore: 60,
      watchScore: 50,
      premiumConfidence: 80,
      strongConfidence: 70,
      standardConfidence: 60,
      confidenceB: 70,
      minConfidence: 40
    }),
    risk: Object.freeze({
      allowChaseAboveBox: false,
      blockWeakening: true,
      blockCooldown: true,
      blockExpired: true
    }),
    entry: Object.freeze({
      useNumericHints: true,
      preferReferenceLow: true,
      fallbackToBoxCenter: true
    }),
    exit: Object.freeze({
      useNumericHints: true,
      preferReferenceLowInvalidation: true,
      useBoxHighTarget: true
    })
  });

  function mergeStrategyPlanConfig(config) {
    var c = config || {};
    var d = DEFAULT_STRATEGY_PLAN_CONFIG;
    var th = c.thresholds || {};
    var rk = c.risk || {};
    var en = c.entry || {};
    var ex = c.exit || {};
    return {
      version: typeof c.version === 'string' ? c.version : d.version,
      thresholds: {
        premiumScore: safeNumber(th.premiumScore, d.thresholds.premiumScore),
        strongScore: safeNumber(th.strongScore, d.thresholds.strongScore),
        standardScore: safeNumber(th.standardScore, d.thresholds.standardScore),
        watchScore: safeNumber(th.watchScore, d.thresholds.watchScore),
        premiumConfidence: safeNumber(th.premiumConfidence, d.thresholds.premiumConfidence),
        strongConfidence: safeNumber(th.strongConfidence, d.thresholds.strongConfidence),
        standardConfidence: safeNumber(th.standardConfidence, d.thresholds.standardConfidence),
        confidenceB: safeNumber(th.confidenceB, d.thresholds.confidenceB),
        minConfidence: safeNumber(th.minConfidence, d.thresholds.minConfidence)
      },
      risk: {
        allowChaseAboveBox: rk.allowChaseAboveBox === true,
        blockWeakening: rk.blockWeakening !== false,
        blockCooldown: rk.blockCooldown !== false,
        blockExpired: rk.blockExpired !== false
      },
      entry: {
        useNumericHints: en.useNumericHints !== false,
        preferReferenceLow: en.preferReferenceLow !== false,
        fallbackToBoxCenter: en.fallbackToBoxCenter !== false
      },
      exit: {
        useNumericHints: ex.useNumericHints !== false,
        preferReferenceLowInvalidation: ex.preferReferenceLowInvalidation !== false,
        useBoxHighTarget: ex.useBoxHighTarget !== false
      }
    };
  }

  function makeConfigUsed(cfg) {
    return {
      thresholds: {
        premiumScore: cfg.thresholds.premiumScore,
        strongScore: cfg.thresholds.strongScore,
        standardScore: cfg.thresholds.standardScore,
        watchScore: cfg.thresholds.watchScore,
        premiumConfidence: cfg.thresholds.premiumConfidence,
        strongConfidence: cfg.thresholds.strongConfidence,
        standardConfidence: cfg.thresholds.standardConfidence,
        confidenceB: cfg.thresholds.confidenceB,
        minConfidence: cfg.thresholds.minConfidence
      },
      risk: {
        allowChaseAboveBox: cfg.risk.allowChaseAboveBox,
        blockWeakening: cfg.risk.blockWeakening,
        blockCooldown: cfg.risk.blockCooldown,
        blockExpired: cfg.risk.blockExpired
      },
      entry: { useNumericHints: cfg.entry.useNumericHints, preferReferenceLow: cfg.entry.preferReferenceLow, fallbackToBoxCenter: cfg.entry.fallbackToBoxCenter },
      exit: { useNumericHints: cfg.exit.useNumericHints, preferReferenceLowInvalidation: cfg.exit.preferReferenceLowInvalidation, useBoxHighTarget: cfg.exit.useBoxHighTarget }
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

  function getPrimaryTimeframe(payload) {
    if (isPlainObject(payload) && isPlainObject(payload.raw)
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
  // §riskControls (DP-STRAT8 + DP-STRAT9 보조)
  // ==========================================================================
  function getRiskControls(context, cfg) {
    var sc = context.signalCycle;
    var sd = context.structureDecision;
    var ctx = {
      allowChase: false,
      requirePullback: false,
      requireReclaim: false,
      avoidIfWeakening: cfg.risk.blockWeakening === true,
      avoidIfCooldown: cfg.risk.blockCooldown === true,
      reasons: [],
      warnings: []
    };

    // U-STRAT-1 Option B: ABOVE_BOX 매핑 = structureBucket === 'ABOVE_BOX_CONFIRMED_CANDIDATE'
    var isAboveBox = isPlainObject(sd) && sd.structureBucket === 'ABOVE_BOX_CONFIRMED_CANDIDATE';
    ctx.allowChase = isAboveBox ? (cfg.risk.allowChaseAboveBox === true) : false;
    if (isAboveBox && !ctx.allowChase) {
      ctx.requirePullback = true;
      pushReason(ctx, 'ABOVE_BOX_NO_CHASE');
    }

    if (isPlainObject(sd) && sd.structureBucket === 'LOW_SWEEP_RECLAIM_CANDIDATE') {
      ctx.requireReclaim = true;
      pushReason(ctx, 'LOW_SWEEP_REQUIRE_RECLAIM');
    }

    if (isPlainObject(sc)) {
      if (sc.cycleState === 'WEAKENING') pushReason(ctx, 'CYCLE_WEAKENING');
      if (sc.cycleState === 'COOLDOWN') pushReason(ctx, 'CYCLE_COOLDOWN');
      if (sc.cycleState === 'EXPIRED') pushReason(ctx, 'CYCLE_EXPIRED');
    }

    return ctx;
  }

  // ==========================================================================
  // §strategyBias 분류 우선순위 (DP-STRAT10)
  // ==========================================================================
  /**
   * 우선순위:
   *   1. 입력 불가 → UNKNOWN
   *   2. cycleState === EXPIRED → EXPIRED_IGNORE
   *   3. cycleState === COOLDOWN → COOLDOWN_WAIT
   *   4. cycleState === WEAKENING → RISK_OFF
   *   5. signalQuality.ready === false → NO_TRADE
   *   6. structureBucket in [LOW_SWEEP_RECLAIM_CANDIDATE, RECLAIM_READY] → RECLAIM_READY
   *   7. structureBucket in [BREAKOUT_PRESSURE_CANDIDATE, ABOVE_BOX_CONFIRMED_CANDIDATE] → BREAKOUT_READY
   *   8a. structureBucket === BOX_TOP_PRESSURE && priceZone.zone === 'TOP_NEAR' && confidence >= confidenceB → BREAKOUT_READY
   *   8b. structureBucket === BOX_TOP_PRESSURE 그 외 → PULLBACK_WAIT
   *   9. cycleState === STRENGTHENING → MOMENTUM_FOLLOW
   *   10. structureBucket === BOX_MIDDLE → WATCH_ONLY
   *   11. fallback → WATCH_ONLY
   */
  function getStrategyBias(context, cfg) {
    var sq = context.signalQuality;
    var sc = context.signalCycle;
    var sd = context.structureDecision;

    // 1. 입력 불가
    if (!isPlainObject(sq) || !isPlainObject(sc) || !isPlainObject(sd)) return 'UNKNOWN';

    var cycleState = typeof sc.cycleState === 'string' ? sc.cycleState : 'UNKNOWN';

    // 2-4. cycle 우선
    if (cycleState === 'EXPIRED') return 'EXPIRED_IGNORE';
    if (cycleState === 'COOLDOWN') return 'COOLDOWN_WAIT';
    if (cycleState === 'WEAKENING') return 'RISK_OFF';

    // 5. ready=false
    if (sq.ready !== true) return 'NO_TRADE';

    var bucket = typeof sd.structureBucket === 'string' ? sd.structureBucket : 'UNKNOWN';
    var pzZone = isPlainObject(sd.priceZone) && typeof sd.priceZone.zone === 'string'
      ? sd.priceZone.zone : 'UNKNOWN';
    var confidence = safeNumber(sd.confidence, 0);

    // 6. RECLAIM
    if (bucket === 'LOW_SWEEP_RECLAIM_CANDIDATE' || bucket === 'RECLAIM_READY') {
      return 'RECLAIM_READY';
    }
    // 7. BREAKOUT
    if (bucket === 'BREAKOUT_PRESSURE_CANDIDATE' || bucket === 'ABOVE_BOX_CONFIRMED_CANDIDATE') {
      return 'BREAKOUT_READY';
    }
    // 8a / 8b — U-STRAT-1 Option B: 'TOP_NEAR' 라벨 사용
    if (bucket === 'BOX_TOP_PRESSURE') {
      if (pzZone === 'TOP_NEAR' && confidence >= cfg.thresholds.confidenceB) {
        return 'BREAKOUT_READY';
      }
      return 'PULLBACK_WAIT';
    }
    // 9. STRENGTHENING (구조 우선 후)
    if (cycleState === 'STRENGTHENING') return 'MOMENTUM_FOLLOW';
    // 10. BOX_MIDDLE
    if (bucket === 'BOX_MIDDLE') return 'WATCH_ONLY';
    // 11. fallback
    return 'WATCH_ONLY';
  }

  // ==========================================================================
  // §planType (DP-STRAT3)
  // ==========================================================================
  function getPlanType(strategyBias) {
    if (typeof strategyBias !== 'string') return 'NONE';
    return STRATEGY_BIAS_TO_PLAN_TYPE[strategyBias] || 'NONE';
  }

  // ==========================================================================
  // §actionability (DP-STRAT4)
  // ==========================================================================
  function getActionability(strategyBias, riskControls, cfg) {
    if (typeof strategyBias !== 'string') return 'NONE';
    if (BLOCKED_BIAS_SET.indexOf(strategyBias) !== -1) return 'BLOCKED';
    if (strategyBias === 'UNKNOWN') return 'NONE';
    if (WATCH_BIAS_SET.indexOf(strategyBias) !== -1) return 'LOW';

    // ABOVE_BOX & allowChase=false → 완화
    if (riskControls && riskControls.requirePullback === true
        && (strategyBias === 'BREAKOUT_READY' || strategyBias === 'MOMENTUM_FOLLOW')) {
      return 'MEDIUM';
    }

    if (ACTIVE_BIAS_SET.indexOf(strategyBias) !== -1) return 'HIGH';
    return 'NONE';
  }

  // ==========================================================================
  // §entryPlan (DP-STRAT6, DP-STRAT7, DP-STRAT8 / §10)
  // ==========================================================================
  function getEntryPlan(context, strategyBias, riskControls, cfg) {
    var sd = context.structureDecision;
    var ctx = {
      valid: false,
      type: 'NONE',
      entryZone: null,
      trigger: null,
      setupInvalidationHint: null,
      referencePrice: safeNumber(context.currentClose, null),
      reasons: [],
      warnings: []
    };

    // BLOCKED / UNKNOWN → NONE
    if (strategyBias === 'UNKNOWN' || BLOCKED_BIAS_SET.indexOf(strategyBias) !== -1) {
      pushReason(ctx, 'NO_ENTRY_BIAS_' + strategyBias);
      return ctx;
    }

    var refLow = null;
    var boxHigh = null;
    var boxLow = null;
    var boxCenter = null;
    if (isPlainObject(sd)) {
      if (isPlainObject(sd.referenceLow)) refLow = safeNumber(sd.referenceLow.value, null);
      if (isPlainObject(sd.boxContext)) {
        boxHigh = safeNumber(sd.boxContext.boxHigh, null);
        boxLow = safeNumber(sd.boxContext.boxLow, null);
        boxCenter = safeNumber(sd.boxContext.boxCenter, null);
      }
    }

    // type 결정
    if (strategyBias === 'WATCH_ONLY') {
      ctx.type = 'WATCH';
      pushReason(ctx, 'WATCH_ONLY');
    } else if (strategyBias === 'PULLBACK_WAIT') {
      ctx.type = 'PULLBACK_ENTRY';
      pushReason(ctx, 'PULLBACK_WAIT');
    } else if (riskControls && riskControls.requirePullback === true
               && (strategyBias === 'BREAKOUT_READY' || strategyBias === 'MOMENTUM_FOLLOW')) {
      // ABOVE_BOX + allowChase=false → PULLBACK으로 완화
      ctx.type = 'PULLBACK_ENTRY';
      pushReason(ctx, 'ABOVE_BOX_REQUIRE_PULLBACK');
    } else if (strategyBias === 'BREAKOUT_READY') {
      ctx.type = 'BREAKOUT_TRIGGER';
    } else if (strategyBias === 'RECLAIM_READY') {
      ctx.type = 'RECLAIM_CONFIRM';
    } else if (strategyBias === 'MOMENTUM_FOLLOW') {
      ctx.type = 'MOMENTUM_CONTINUATION';
    }

    // entryZone / trigger 결정
    if (ctx.type === 'PULLBACK_ENTRY') {
      if (refLow !== null && cfg.entry.preferReferenceLow) {
        ctx.entryZone = refLow;
        pushReason(ctx, 'ENTRY_ZONE_FROM_REF_LOW');
      } else if (boxCenter !== null && cfg.entry.fallbackToBoxCenter) {
        ctx.entryZone = boxCenter;
        pushReason(ctx, 'ENTRY_ZONE_FROM_BOX_CENTER');
      }
      ctx.trigger = 'PULLBACK_RETEST';
    } else if (ctx.type === 'BREAKOUT_TRIGGER') {
      if (boxHigh !== null) {
        ctx.entryZone = boxHigh;
        ctx.trigger = 'CLOSE_ABOVE_BOX_HIGH';
        pushReason(ctx, 'ENTRY_ZONE_FROM_BOX_HIGH');
      }
    } else if (ctx.type === 'RECLAIM_CONFIRM') {
      if (refLow !== null) {
        ctx.entryZone = refLow;
        ctx.trigger = 'CLOSE_ABOVE_REF_LOW';
        pushReason(ctx, 'ENTRY_ZONE_FROM_REF_LOW');
      }
    } else if (ctx.type === 'MOMENTUM_CONTINUATION') {
      ctx.entryZone = safeNumber(context.currentClose, null);
      ctx.trigger = 'CONTINUATION';
      pushReason(ctx, 'ENTRY_ZONE_FROM_CURRENT_CLOSE');
    }

    // setupInvalidationHint (entry trigger 발생 전 setup 무효화 기준)
    if (refLow !== null) {
      ctx.setupInvalidationHint = refLow;
      pushReason(ctx, 'SETUP_INVALIDATION_FROM_REF_LOW');
    } else if (boxLow !== null) {
      ctx.setupInvalidationHint = boxLow;
      pushReason(ctx, 'SETUP_INVALIDATION_FROM_BOX_LOW');
    }

    // valid 판정
    ctx.valid = (ctx.type !== 'NONE' && ctx.type !== 'WATCH');

    if (ctx.valid && ctx.entryZone === null) {
      pushWarning(ctx, 'ENTRY_ZONE_MISSING');
    }

    return ctx;
  }

  // ==========================================================================
  // §exitPlan (§11 / §12)
  // ==========================================================================
  function getExitPlan(context, strategyBias, riskControls, cfg) {
    var sd = context.structureDecision;
    var sc = context.signalCycle;
    var ctx = {
      valid: false,
      type: 'NONE',
      targetHint: null,
      invalidationHint: null,
      riskRewardHint: null,
      reasons: [],
      warnings: []
    };

    if (strategyBias === 'UNKNOWN'
        || strategyBias === 'WATCH_ONLY'
        || BLOCKED_BIAS_SET.indexOf(strategyBias) !== -1) {
      pushReason(ctx, 'NO_EXIT_BIAS_' + strategyBias);
      return ctx;
    }

    var refLow = null;
    var boxHigh = null;
    var boxLow = null;
    if (isPlainObject(sd)) {
      if (isPlainObject(sd.referenceLow)) refLow = safeNumber(sd.referenceLow.value, null);
      if (isPlainObject(sd.boxContext)) {
        boxHigh = safeNumber(sd.boxContext.boxHigh, null);
        boxLow = safeNumber(sd.boxContext.boxLow, null);
      }
    }

    // invalidationHint (entry 이후 setup 유지 깨지는 기준)
    if (refLow !== null && cfg.exit.preferReferenceLowInvalidation) {
      ctx.invalidationHint = refLow;
      pushReason(ctx, 'INVALIDATION_FROM_REF_LOW');
    } else if (boxLow !== null) {
      ctx.invalidationHint = boxLow;
      pushReason(ctx, 'INVALIDATION_FROM_BOX_LOW');
    }

    // ABOVE_BOX 처리 (U-STRAT-1 Option B)
    var isAboveBox = isPlainObject(sd) && sd.structureBucket === 'ABOVE_BOX_CONFIRMED_CANDIDATE';
    var isStrengthening = isPlainObject(sc) && sc.cycleState === 'STRENGTHENING';

    if (isAboveBox) {
      ctx.targetHint = null;
      if (isStrengthening) {
        ctx.type = 'TRAILING_HINT';
        pushReason(ctx, 'ABOVE_BOX_STRENGTHENING_TRAIL');
      } else {
        ctx.type = 'INVALIDATION_ONLY';
        pushReason(ctx, 'ABOVE_BOX_INVALIDATION_ONLY');
      }
    } else {
      // 일반: boxHigh → targetHint
      if (boxHigh !== null && cfg.exit.useBoxHighTarget) {
        ctx.targetHint = boxHigh;
        ctx.type = 'BOX_TARGET';
        pushReason(ctx, 'TARGET_FROM_BOX_HIGH');
      } else if (ctx.invalidationHint !== null) {
        ctx.type = 'INVALIDATION_ONLY';
        pushReason(ctx, 'TARGET_MISSING_USE_INVALIDATION');
      } else {
        ctx.type = 'RISK_REFERENCE';
        pushReason(ctx, 'NO_TARGET_NO_INVALIDATION');
      }
    }

    // riskRewardHint
    var entryZone = safeNumber(context.entryZone, null);
    if (typeof entryZone === 'number'
        && typeof ctx.invalidationHint === 'number'
        && typeof ctx.targetHint === 'number') {
      var risk = entryZone - ctx.invalidationHint;
      var reward = ctx.targetHint - entryZone;
      if (risk > 0) {
        ctx.riskRewardHint = Math.round((reward / risk) * 100) / 100;
        pushReason(ctx, 'RISK_REWARD_HINT:' + ctx.riskRewardHint);
      }
    }

    ctx.valid = ctx.type !== 'NONE';
    return ctx;
  }

  // ==========================================================================
  // §planQualityTier (DP-STRAT5)
  // ==========================================================================
  function getPlanQualityTier(context, strategyBias, cfg) {
    var sq = context.signalQuality;
    var sc = context.signalCycle;

    if (!isPlainObject(sq) || !isPlainObject(sc)) return 'NONE';

    var totalScore = safeNumber(sq.totalScore, null);
    var confidence = safeNumber(sq.structureConfidence, 0);
    var cycleState = typeof sc.cycleState === 'string' ? sc.cycleState : 'UNKNOWN';

    // PLAN_AVOID (DP-STRAT9)
    var avoidBias = BLOCKED_BIAS_SET.indexOf(strategyBias) !== -1;
    var avoidCycle = AVOID_CYCLE_SET.indexOf(cycleState) !== -1;
    if (avoidBias || avoidCycle) return 'PLAN_AVOID';

    // UNKNOWN
    if (strategyBias === 'UNKNOWN') return 'NONE';

    var activeBias = ACTIVE_BIAS_SET.indexOf(strategyBias) !== -1;
    var goodCycle = GOOD_CYCLE_SET.indexOf(cycleState) !== -1;

    // PLAN_PREMIUM
    if (activeBias && goodCycle
        && typeof totalScore === 'number' && totalScore >= cfg.thresholds.premiumScore
        && confidence >= cfg.thresholds.premiumConfidence) {
      return 'PLAN_PREMIUM';
    }

    // PLAN_STRONG
    if (goodCycle
        && typeof totalScore === 'number' && totalScore >= cfg.thresholds.strongScore
        && confidence >= cfg.thresholds.strongConfidence) {
      return 'PLAN_STRONG';
    }

    // PLAN_STANDARD
    if (typeof totalScore === 'number' && totalScore >= cfg.thresholds.standardScore
        && confidence >= cfg.thresholds.standardConfidence) {
      return 'PLAN_STANDARD';
    }

    // PLAN_WATCH
    if (WATCH_BIAS_SET.indexOf(strategyBias) !== -1) return 'PLAN_WATCH';

    // PLAN_WEAK
    return 'PLAN_WEAK';
  }

  // ==========================================================================
  // §normalize 출력
  // ==========================================================================
  function normalizeStrategyPlan(result) {
    return {
      valid: result.valid === true,
      version: STRATEGY_PLAN_VERSION,
      strategyBias: typeof result.strategyBias === 'string' ? result.strategyBias : 'UNKNOWN',
      planType: typeof result.planType === 'string' ? result.planType : 'NONE',
      actionability: typeof result.actionability === 'string' ? result.actionability : 'NONE',
      riskLevel: typeof result.riskLevel === 'string' ? result.riskLevel : 'UNKNOWN',
      planQualityTier: typeof result.planQualityTier === 'string' ? result.planQualityTier : 'NONE',
      entryPlan: result.entryPlan,
      exitPlan: result.exitPlan,
      riskControls: result.riskControls,
      reasons: Array.isArray(result.reasons) ? result.reasons.slice() : [],
      warnings: Array.isArray(result.warnings) ? result.warnings.slice() : [],
      debug: result.debug,
      configUsed: result.configUsed
    };
  }

  // ==========================================================================
  // §main — buildStrategyPlan
  // ==========================================================================
  /**
   * payload + scoreBreakdown + structureDecision + signalCycle → standalone strategyPlan.
   * 모든 입력 mutate 0건 (DP-STRAT1).
   *
   * @param {Object} payload           V3FeaturePayload
   * @param {Object} [scoreBreakdown]
   * @param {Object} [structureDecision]
   * @param {Object} [signalCycle]
   * @param {Object} [config]
   * @return {Object} strategyPlan
   */
  function buildStrategyPlan(payload, scoreBreakdown, structureDecision, signalCycle, config) {
    var cfg = mergeStrategyPlanConfig(config);
    var configUsed = makeConfigUsed(cfg);

    var topReasons = [];
    var topWarnings = [];

    // signalQuality는 signalCycle 내부 path 사용
    var signalQuality = isPlainObject(signalCycle) && isPlainObject(signalCycle.signalQuality)
      ? signalCycle.signalQuality : null;

    var currentClose = getCurrentClose(payload);

    var context = {
      payload: payload,
      scoreBreakdown: scoreBreakdown,
      structureDecision: structureDecision,
      signalCycle: signalCycle,
      signalQuality: signalQuality,
      currentClose: currentClose
    };

    // 1. riskControls (먼저 산출 — strategyBias / entryPlan / actionability 분기에 사용)
    var riskControls = getRiskControls(context, cfg);

    // 2. strategyBias (DP-STRAT10 우선순위)
    var strategyBias = getStrategyBias(context, cfg);

    // 3. planType
    var planType = getPlanType(strategyBias);

    // 4. entryPlan (riskControls 반영)
    var entryPlan = getEntryPlan(context, strategyBias, riskControls, cfg);

    // 5. exitPlan (entryZone 사용)
    var exitContext = {
      structureDecision: structureDecision,
      signalCycle: signalCycle,
      entryZone: entryPlan.entryZone
    };
    var exitPlan = getExitPlan(exitContext, strategyBias, riskControls, cfg);

    // 6. actionability
    var actionability = getActionability(strategyBias, riskControls, cfg);

    // 7. planQualityTier
    var planQualityTier = getPlanQualityTier(context, strategyBias, cfg);

    // riskLevel — scoreBreakdown.risk.level pass-through (DP-STR8 정합: 구조 판정에 반영 X, 단 메타 보존)
    var riskLevel = 'UNKNOWN';
    if (isPlainObject(scoreBreakdown) && isPlainObject(scoreBreakdown.risk)
        && typeof scoreBreakdown.risk.level === 'string') {
      riskLevel = scoreBreakdown.risk.level;
    }

    // top-level reasons / warnings
    topReasons.push('BIAS_' + strategyBias);
    topReasons.push('PLAN_TYPE_' + planType);
    topReasons.push('ACTIONABILITY_' + actionability);
    topReasons.push('QUALITY_' + planQualityTier);

    if (!isPlainObject(payload)) topWarnings.push('PAYLOAD_NOT_OBJECT');
    if (!isPlainObject(structureDecision)) topWarnings.push('STRUCTURE_DECISION_NOT_OBJECT');
    if (!isPlainObject(signalCycle)) topWarnings.push('SIGNAL_CYCLE_NOT_OBJECT');

    var valid = strategyBias !== 'UNKNOWN';

    return normalizeStrategyPlan({
      valid: valid,
      strategyBias: strategyBias,
      planType: planType,
      actionability: actionability,
      riskLevel: riskLevel,
      planQualityTier: planQualityTier,
      entryPlan: entryPlan,
      exitPlan: exitPlan,
      riskControls: riskControls,
      reasons: topReasons,
      warnings: topWarnings,
      debug: {
        source: 'payload + scoreBreakdown + structureDecision + signalCycle',
        configVersion: cfg.version
      },
      configUsed: configUsed
    });
  }

  // ==========================================================================
  // §export — 이중 환경
  // ==========================================================================
  var api = Object.freeze({
    STRATEGY_PLAN_VERSION: STRATEGY_PLAN_VERSION,
    CONFIG_VERSION: CONFIG_VERSION,
    DEFAULT_STRATEGY_PLAN_CONFIG: DEFAULT_STRATEGY_PLAN_CONFIG,
    DEFAULT_PRIMARY_TIMEFRAME: DEFAULT_PRIMARY_TIMEFRAME,
    STRATEGY_BIAS_TO_PLAN_TYPE: STRATEGY_BIAS_TO_PLAN_TYPE,

    build: buildStrategyPlan,
    mergeStrategyPlanConfig: mergeStrategyPlanConfig,

    getStrategyBias: getStrategyBias,
    getPlanType: getPlanType,
    getActionability: getActionability,
    getPlanQualityTier: getPlanQualityTier,
    getEntryPlan: getEntryPlan,
    getExitPlan: getExitPlan,
    getRiskControls: getRiskControls,

    getPrimaryTimeframe: getPrimaryTimeframe,
    getCurrentClose: getCurrentClose,

    safeNumber: safeNumber,
    isPlainObject: isPlainObject,
    normalizeStrategyPlan: normalizeStrategyPlan
  });

  global.WS3_StrategyPlan = api;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis
   : typeof window !== 'undefined' ? window
   : typeof self !== 'undefined' ? self
   : this);
