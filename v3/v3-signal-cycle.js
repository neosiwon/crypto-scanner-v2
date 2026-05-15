/**
 * WS3 v0.5.0 — signalCycle / persistence / cooldown
 *
 * Scope:
 *   v3FeaturePayload (c-r1)
 *   + scoreBreakdown (v0.3.0)
 *   + structureDecision (v0.4.0)
 *   + previousSignalState (optional, Case A full | Case B minimal)
 *   → standalone signalCycle 객체
 *
 * 단일 기준 문서:
 *   docs/ws3/WS3_CODE_CONTRACT.md (b-r2 박제본)
 *
 * U-CYC-1 처리 방침 (Gate 1 발견 — Option A 확정):
 *   currentTs 우선순위:
 *     1. payload.ts
 *     2. payload.candles[primaryTimeframe] 마지막 candle.ts
 *     3. null
 *   payload.raw.builderDebug.sourceTs 는 사용하지 않음 (해당 키 부재).
 *   payload.raw.builderDebug.resolvedTsSource 는 라벨 문자열이며 ts 값 아님.
 *
 * 확정 DP 정책:
 *   DP-CYC1  standalone signalCycle 반환. payload / scoreBreakdown / structureDecision / previousSignalState mutate 금지.
 *   DP-CYC2  previousSignalState optional input. Case A full | Case B minimal 두 형식만 허용.
 *            v0.5.0은 저장소를 read/write 하지 않음.
 *   DP-CYC3  candidateKey = exchange + market + timeframe + bucketFamily (mode: 'bucketFamily').
 *   DP-CYC4  cycleState 8 후보: UNKNOWN / NO_SIGNAL / NEW_CANDIDATE / PERSISTING /
 *            STRENGTHENING / WEAKENING / COOLDOWN / EXPIRED.
 *   DP-CYC5  cyclePhase 5 후보: UNKNOWN / SEED / ACTIVE / COOLING / ENDED.
 *   DP-CYC6  ageBars = 실행 횟수 기반 counter (실제 candle gap 아님).
 *   DP-CYC7  cooldown.bars 기본값 3 (임시, backtest 후 조정).
 *   DP-CYC8  ready threshold: minConfidence=40, minTotalScore=30 (임시).
 *            ready != 전략 진입 가능. signalCycle 판단용 최소 유효성.
 *   DP-CYC9  strengthen/weaken delta ±5/±10 (OR 조건). 동시 충족 → PERSISTING + MIXED_DELTA warning.
 *            한 축만 충족 + 반대 축 작은 변동 → 단순 STRENGTHENING/WEAKENING.
 *   DP-CYC10 런타임 clock API 사용 금지. payload.ts / primary candle.ts 만 사용.
 *   DP-CYC11 EXPIRED: cooldown 소진 또는 ageBars >= maxAgeBars. 1-turn 전환 상태.
 *
 * 금지:
 *   grade / tier / 등급 코드 / strategyBias / entryPlan / exitPlan.
 *   알림 연동 / 화면 모델 / 렌더 계층 / UI / 외부 신호.
 *   payload / scoreBreakdown / structureDecision / previousSignalState mutation 또는 delete.
 *   외부 API 호출 / DOM / 브라우저 storage / KV.
 *   런타임 clock API 사용.
 *   저장소 read/write.
 *
 * 의존:
 *   payload  (v3-feature-payload-builder.js 산출)
 *   scoreBreakdown (v3-score-breakdown.js 산출, optional)
 *   structureDecision (v3-structure-bucket.js 산출, optional)
 *   previousSignalState (호출자 제공, optional)
 */

(function (global) {
  'use strict';

  var SIGNAL_CYCLE_VERSION = 'WS3_v0.5.0';
  var CONFIG_VERSION = 'inline-default-v0';
  var DEFAULT_PRIMARY_TIMEFRAME = 'h1';

  var ACTIVE_CYCLE_STATES = ['NEW_CANDIDATE', 'PERSISTING', 'STRENGTHENING', 'WEAKENING'];

  var BUCKET_FAMILY_MAP = Object.freeze({
    BOX_TOP_PRESSURE: 'TOP_FAMILY',
    BREAKOUT_PRESSURE_CANDIDATE: 'TOP_FAMILY',
    ABOVE_BOX_CONFIRMED_CANDIDATE: 'TOP_FAMILY',
    BOX_BOTTOM_RISK: 'BOTTOM_FAMILY',
    BREAKDOWN_RISK_CANDIDATE: 'BOTTOM_FAMILY',
    BELOW_BOX_CONFIRMED_CANDIDATE: 'BOTTOM_FAMILY',
    LOW_SWEEP_PENDING: 'LOW_SWEEP_FAMILY',
    LOW_SWEEP_RECLAIM_CANDIDATE: 'LOW_SWEEP_FAMILY',
    RECLAIM_READY: 'RECLAIM_FAMILY',
    HIGH_SWEEP_REJECT_CANDIDATE: 'HIGH_SWEEP_FAMILY',
    BOX_MIDDLE: 'NEUTRAL_FAMILY',
    UNKNOWN: 'NONE',
    NO_STRUCTURE: 'NONE'
  });

  var CYCLE_PHASE_MAP = Object.freeze({
    NEW_CANDIDATE: 'SEED',
    PERSISTING: 'ACTIVE',
    STRENGTHENING: 'ACTIVE',
    WEAKENING: 'ACTIVE',
    COOLDOWN: 'COOLING',
    EXPIRED: 'ENDED',
    NO_SIGNAL: 'ENDED',
    UNKNOWN: 'UNKNOWN'
  });

  // ==========================================================================
  // DEFAULT_SIGNAL_CYCLE_CONFIG
  // ==========================================================================
  var DEFAULT_SIGNAL_CYCLE_CONFIG = Object.freeze({
    version: CONFIG_VERSION,
    ready: Object.freeze({
      minConfidence: 40,
      minTotalScore: 30
    }),
    delta: Object.freeze({
      strengthenScoreDelta: 5,
      weakenScoreDelta: 5,
      strengthenConfidenceDelta: 10,
      weakenConfidenceDelta: 10
    }),
    cooldown: Object.freeze({
      bars: 3
    }),
    expire: Object.freeze({
      maxAgeBars: 20
    }),
    candidateKey: Object.freeze({
      mode: 'bucketFamily'
    })
  });

  function mergeSignalCycleConfig(config) {
    var c = config || {};
    var d = DEFAULT_SIGNAL_CYCLE_CONFIG;
    var ready = c.ready || {};
    var delta = c.delta || {};
    var cooldown = c.cooldown || {};
    var expire = c.expire || {};
    var ck = c.candidateKey || {};
    return {
      version: typeof c.version === 'string' ? c.version : d.version,
      ready: {
        minConfidence: safeNumber(ready.minConfidence, d.ready.minConfidence),
        minTotalScore: safeNumber(ready.minTotalScore, d.ready.minTotalScore)
      },
      delta: {
        strengthenScoreDelta: safeNumber(delta.strengthenScoreDelta, d.delta.strengthenScoreDelta),
        weakenScoreDelta: safeNumber(delta.weakenScoreDelta, d.delta.weakenScoreDelta),
        strengthenConfidenceDelta: safeNumber(delta.strengthenConfidenceDelta, d.delta.strengthenConfidenceDelta),
        weakenConfidenceDelta: safeNumber(delta.weakenConfidenceDelta, d.delta.weakenConfidenceDelta)
      },
      cooldown: {
        bars: safeNumber(cooldown.bars, d.cooldown.bars)
      },
      expire: {
        maxAgeBars: safeNumber(expire.maxAgeBars, d.expire.maxAgeBars)
      },
      candidateKey: {
        mode: typeof ck.mode === 'string' ? ck.mode : d.candidateKey.mode
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

  function isActiveCycleState(state) {
    return typeof state === 'string' && ACTIVE_CYCLE_STATES.indexOf(state) !== -1;
  }

  // ==========================================================================
  // §previousSignalState normalize (DP-CYC2)
  // ==========================================================================
  function normalizePreviousSignalState(state) {
    if (state === null || state === undefined) {
      return { valid: false, normalized: null, shape: null, reason: 'NO_PREVIOUS_STATE' };
    }
    if (!isPlainObject(state)) {
      return { valid: false, normalized: null, shape: null, reason: 'PREVIOUS_STATE_INVALID' };
    }

    // Case A — full signalCycle (이전 buildSignalCycle 반환값)
    var hasCaseA = isPlainObject(state.persistence)
                && isPlainObject(state.signalQuality)
                && isPlainObject(state.cooldown)
                && Object.prototype.hasOwnProperty.call(state, 'candidateKey')
                && Object.prototype.hasOwnProperty.call(state, 'cycleState');

    if (hasCaseA) {
      return {
        valid: true,
        normalized: {
          candidateKey: (typeof state.candidateKey === 'string') ? state.candidateKey : null,
          currentTs: safeNumber(state.currentTs, null),
          ageBars: safeNumber(state.ageBars, 0),
          cycleState: (typeof state.cycleState === 'string') ? state.cycleState : 'UNKNOWN',
          streak: safeNumber(state.persistence.streak, 0),
          totalScore: safeNumber(state.signalQuality.totalScore, null),
          structureConfidence: safeNumber(state.signalQuality.structureConfidence, 0),
          cooldownBarsRemaining: safeNumber(state.cooldown.barsRemaining, 0),
          structureBucket: (typeof state.signalQuality.structureBucket === 'string') ? state.signalQuality.structureBucket : null
        },
        shape: 'FULL',
        reason: null
      };
    }

    // Case B — minimal state
    var hasCaseB = Object.prototype.hasOwnProperty.call(state, 'candidateKey')
                && Object.prototype.hasOwnProperty.call(state, 'cycleState')
                && Object.prototype.hasOwnProperty.call(state, 'streak');

    if (hasCaseB) {
      return {
        valid: true,
        normalized: {
          candidateKey: (typeof state.candidateKey === 'string') ? state.candidateKey : null,
          currentTs: safeNumber(state.currentTs, null),
          ageBars: safeNumber(state.ageBars, 0),
          cycleState: (typeof state.cycleState === 'string') ? state.cycleState : 'UNKNOWN',
          streak: safeNumber(state.streak, 0),
          totalScore: safeNumber(state.totalScore, null),
          structureConfidence: safeNumber(state.structureConfidence, 0),
          cooldownBarsRemaining: safeNumber(state.cooldownBarsRemaining, 0),
          structureBucket: null
        },
        shape: 'MINIMAL',
        reason: null
      };
    }

    return { valid: false, normalized: null, shape: null, reason: 'PREVIOUS_STATE_INVALID' };
  }

  // ==========================================================================
  // §currentTs / primaryTimeframe (U-CYC-1 Option A)
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

  function getPrimaryCandles(payload) {
    if (!isPlainObject(payload) || !isPlainObject(payload.candles)) return [];
    var tf = getPrimaryTimeframe(payload);
    return Array.isArray(payload.candles[tf]) ? payload.candles[tf] : [];
  }

  /**
   * currentTs 우선순위 (U-CYC-1 Option A):
   *   1. payload.ts
   *   2. primary timeframe 마지막 candle.ts
   *   3. null
   */
  function getCurrentTs(payload) {
    if (!isPlainObject(payload)) return null;
    if (typeof payload.ts === 'number' && isFinite(payload.ts)) {
      return payload.ts;
    }
    var arr = getPrimaryCandles(payload);
    if (arr.length > 0) {
      var last = arr[arr.length - 1];
      if (isPlainObject(last) && typeof last.ts === 'number' && isFinite(last.ts)) {
        return last.ts;
      }
    }
    return null;
  }

  // ==========================================================================
  // §bucketFamily / candidateKey / bucketTransition
  // ==========================================================================
  function getBucketFamily(structureBucket) {
    if (typeof structureBucket !== 'string') return 'NONE';
    return BUCKET_FAMILY_MAP[structureBucket] || 'NONE';
  }

  function getCandidateKey(payload, structureDecision, cfg) {
    if (!isPlainObject(payload) || !isPlainObject(structureDecision)) return null;
    var identity = payload.identity;
    if (!isPlainObject(identity)) return null;
    var family = getBucketFamily(structureDecision.structureBucket);
    if (family === 'NONE') return null;
    var exchange = (typeof identity.exchange === 'string' && identity.exchange) ? identity.exchange : 'UNKNOWN';
    var market = (typeof identity.market === 'string' && identity.market) ? identity.market : 'UNKNOWN';
    var timeframe = getPrimaryTimeframe(payload);
    return exchange + ':' + market + ':' + timeframe + ':' + family;
  }

  function getBucketTransition(previousBucket, currentBucket) {
    if (typeof previousBucket !== 'string' || !previousBucket) return null;
    if (typeof currentBucket !== 'string' || !currentBucket) return null;
    if (previousBucket === currentBucket) return null;
    return { from: previousBucket, to: currentBucket };
  }

  function getCyclePhase(cycleState) {
    if (typeof cycleState !== 'string') return 'UNKNOWN';
    return CYCLE_PHASE_MAP[cycleState] || 'UNKNOWN';
  }

  // ==========================================================================
  // §signalQuality (DP-CYC8 ready)
  // ==========================================================================
  function getSignalQuality(scoreBreakdown, structureDecision, cfg) {
    var bucket = isPlainObject(structureDecision) && typeof structureDecision.structureBucket === 'string'
      ? structureDecision.structureBucket : 'UNKNOWN';
    var family = getBucketFamily(bucket);
    var confidence = isPlainObject(structureDecision) ? safeNumber(structureDecision.confidence, 0) : 0;

    var totalScore = null;
    var structureScore = null;
    if (isPlainObject(scoreBreakdown)) {
      totalScore = safeNumber(scoreBreakdown.totalScore, null);
      if (isPlainObject(scoreBreakdown.components) && isPlainObject(scoreBreakdown.components.structure)) {
        structureScore = safeNumber(scoreBreakdown.components.structure.score, null);
      }
    }

    var reasons = [];
    var warnings = [];

    var structureValid = isPlainObject(structureDecision) && structureDecision.valid === true;
    var bucketReady = bucket !== 'UNKNOWN' && bucket !== 'NO_STRUCTURE';
    var confidenceOk = typeof confidence === 'number' && confidence >= cfg.ready.minConfidence;
    var scoreOk = typeof totalScore === 'number' && totalScore >= cfg.ready.minTotalScore;

    var ready = structureValid && bucketReady && confidenceOk && scoreOk;

    if (structureValid) reasons.push('STRUCTURE_VALID');
    else warnings.push('STRUCTURE_INVALID');
    if (bucketReady) reasons.push('BUCKET_' + bucket);
    else warnings.push('BUCKET_TRIVIAL:' + bucket);
    if (confidenceOk) reasons.push('CONFIDENCE_OK:' + confidence);
    else warnings.push('CONFIDENCE_LOW:' + confidence);
    if (scoreOk) reasons.push('TOTAL_SCORE_OK:' + totalScore);
    else warnings.push('TOTAL_SCORE_LOW:' + (totalScore === null ? 'null' : totalScore));

    return {
      structureBucket: bucket,
      bucketFamily: family,
      structureConfidence: confidence,
      totalScore: totalScore,
      structureScore: structureScore,
      ready: ready,
      reasons: reasons,
      warnings: warnings
    };
  }

  // ==========================================================================
  // §delta 계산 (DP-CYC9)
  // ==========================================================================
  function calculateDeltas(signalQuality, previousState) {
    var out = { scoreDelta: null, confidenceDelta: null };
    if (!previousState || !previousState.valid || !signalQuality) return out;
    var prev = previousState.normalized;
    if (typeof signalQuality.totalScore === 'number' && typeof prev.totalScore === 'number') {
      out.scoreDelta = signalQuality.totalScore - prev.totalScore;
    }
    if (typeof signalQuality.structureConfidence === 'number' && typeof prev.structureConfidence === 'number') {
      out.confidenceDelta = signalQuality.structureConfidence - prev.structureConfidence;
    }
    return out;
  }

  // ==========================================================================
  // §classify (DP-CYC4 + 분류 우선순위 12단계)
  // ==========================================================================
  function classifySignalCycle(context, cfg) {
    var sq = context.signalQuality;
    var prev = context.previousState;
    var currentKey = context.candidateKey;
    var deltas = context.deltas;

    // 1. 입력 계산 불가
    if (!sq) {
      return { cycleState: 'UNKNOWN', reason: 'NO_SIGNAL_QUALITY', mixedDelta: false };
    }

    var hasPrev = prev && prev.valid;
    var prevState = hasPrev ? prev.normalized.cycleState : null;
    var prevKey = hasPrev ? prev.normalized.candidateKey : null;
    var prevAgeBars = hasPrev ? safeNumber(prev.normalized.ageBars, 0) : 0;
    var prevActive = isActiveCycleState(prevState);

    // 2/3. current ready=false
    if (!sq.ready) {
      if (prevActive) {
        return { cycleState: 'COOLDOWN', reason: 'PREV_ACTIVE_NOW_NOT_READY', mixedDelta: false };
      }
      if (prevState === 'COOLDOWN') {
        return { cycleState: 'COOLDOWN', reason: 'PREV_COOLDOWN_STILL_NOT_READY', mixedDelta: false };
      }
      return { cycleState: 'NO_SIGNAL', reason: 'NOT_READY', mixedDelta: false };
    }

    // current ready=true
    // 4/5. previous trivial
    var triviallyPrev = !hasPrev
      || prevState === 'EXPIRED'
      || prevState === 'NO_SIGNAL'
      || prevState === 'UNKNOWN';
    if (triviallyPrev) {
      return { cycleState: 'NEW_CANDIDATE', reason: 'NO_PREV_ACTIVE', mixedDelta: false };
    }

    // 6. candidateKey 다름
    if (prevKey !== currentKey) {
      return { cycleState: 'NEW_CANDIDATE', reason: 'CANDIDATE_KEY_CHANGED', mixedDelta: false };
    }

    // 7. ageBars >= maxAgeBars
    var projectedAgeBars = prevAgeBars + 1;
    if (projectedAgeBars >= cfg.expire.maxAgeBars) {
      return { cycleState: 'EXPIRED', reason: 'MAX_AGE_REACHED:' + projectedAgeBars, mixedDelta: false };
    }

    // 8-11. delta 평가
    var strengthening = false;
    var weakening = false;
    if (deltas) {
      if (typeof deltas.scoreDelta === 'number' && deltas.scoreDelta >= cfg.delta.strengthenScoreDelta) strengthening = true;
      if (typeof deltas.confidenceDelta === 'number' && deltas.confidenceDelta >= cfg.delta.strengthenConfidenceDelta) strengthening = true;
      if (typeof deltas.scoreDelta === 'number' && deltas.scoreDelta <= -cfg.delta.weakenScoreDelta) weakening = true;
      if (typeof deltas.confidenceDelta === 'number' && deltas.confidenceDelta <= -cfg.delta.weakenConfidenceDelta) weakening = true;
    }

    if (strengthening && weakening) {
      return { cycleState: 'PERSISTING', reason: 'MIXED_DELTA', mixedDelta: true };
    }
    if (strengthening) {
      return { cycleState: 'STRENGTHENING', reason: 'DELTA_STRENGTHEN', mixedDelta: false };
    }
    if (weakening) {
      return { cycleState: 'WEAKENING', reason: 'DELTA_WEAKEN', mixedDelta: false };
    }
    return { cycleState: 'PERSISTING', reason: 'DELTA_NEUTRAL', mixedDelta: false };
  }

  // ==========================================================================
  // §cooldown 계산 (DP-CYC7 + DP-CYC11)
  // ==========================================================================
  function calculateCooldown(context, cfg) {
    var ctx = {
      active: false,
      reason: null,
      barsRemaining: 0,
      startedTs: null,
      expired: false,
      reasons: [],
      warnings: []
    };
    var prev = context.previousState;
    var sq = context.signalQuality;
    if (!prev || !prev.valid) return ctx;
    if (sq && sq.ready) return ctx; // ready면 cooldown 진입 X

    var prevState = prev.normalized.cycleState;
    var prevActive = isActiveCycleState(prevState);

    if (prevActive) {
      // newly cooldown
      ctx.barsRemaining = cfg.cooldown.bars;
      ctx.startedTs = context.currentTs;
      ctx.reason = 'NEWLY_ENTERED_AFTER_ACTIVE';
      pushReason(ctx, 'COOLDOWN_NEW');
      if (ctx.barsRemaining <= 0) {
        ctx.expired = true;
        ctx.active = false;
        ctx.barsRemaining = 0;
        pushReason(ctx, 'COOLDOWN_BARS_ZERO_CONFIG');
      } else {
        ctx.active = true;
      }
      return ctx;
    }

    if (prevState === 'COOLDOWN') {
      var prevBars = safeNumber(prev.normalized.cooldownBarsRemaining, 0);
      var remaining = Math.max(prevBars - 1, 0);
      ctx.barsRemaining = remaining;
      ctx.startedTs = null; // 새로 시작 아님
      if (remaining <= 0) {
        ctx.expired = true;
        ctx.active = false;
        ctx.reason = 'COOLDOWN_EXHAUSTED';
        pushReason(ctx, 'COOLDOWN_EXHAUSTED');
      } else {
        ctx.active = true;
        ctx.reason = 'COOLDOWN_CONTINUING';
        pushReason(ctx, 'COOLDOWN_CONTINUING:' + remaining);
      }
      return ctx;
    }

    return ctx;
  }

  // ==========================================================================
  // §ageBars 계산
  // ==========================================================================
  function calculateAgeBars(cycleState, candidateKey, previousState) {
    if (!previousState || !previousState.valid) return 0;
    var prev = previousState.normalized;
    var prevAgeBars = safeNumber(prev.ageBars, 0);

    if (cycleState === 'NEW_CANDIDATE') return 0;
    if (cycleState === 'NO_SIGNAL') return 0;
    if (cycleState === 'UNKNOWN') return 0;

    if (prev.candidateKey !== candidateKey) return 0;

    if (cycleState === 'PERSISTING' || cycleState === 'STRENGTHENING' || cycleState === 'WEAKENING') {
      return prevAgeBars + 1;
    }
    if (cycleState === 'COOLDOWN') {
      if (prev.cycleState === 'COOLDOWN') return prevAgeBars + 1;
      // newly cooldown — prev.ageBars 유지
      return prevAgeBars;
    }
    if (cycleState === 'EXPIRED') {
      // previousAgeBars 또는 computed 유지 (후속 사용 금지)
      return prevAgeBars;
    }
    return 0;
  }

  // ==========================================================================
  // §persistence 계산
  // ==========================================================================
  function calculatePersistence(context, cfg) {
    var sq = context.signalQuality;
    var prev = context.previousState;
    var cycleState = context.cycleState;
    var deltas = context.deltas;
    var mixedDelta = context.mixedDelta === true;

    var p = {
      active: false,
      streak: 0,
      previousStreak: 0,
      isSameCandidate: false,
      isStrengthening: false,
      isWeakening: false,
      mixedDelta: mixedDelta,
      scoreDelta: deltas ? deltas.scoreDelta : null,
      confidenceDelta: deltas ? deltas.confidenceDelta : null,
      reasons: [],
      warnings: []
    };

    if (prev && prev.valid) {
      p.previousStreak = safeNumber(prev.normalized.streak, 0);
      p.isSameCandidate = (prev.normalized.candidateKey === context.candidateKey)
                          && context.candidateKey !== null;
    }

    if (cycleState === 'NEW_CANDIDATE') {
      p.streak = 1;
      p.active = true;
      pushReason(p, 'NEW_STREAK');
    } else if (cycleState === 'PERSISTING' || cycleState === 'STRENGTHENING' || cycleState === 'WEAKENING') {
      p.streak = p.previousStreak + 1;
      p.active = true;
      pushReason(p, 'STREAK_PLUS_ONE:' + p.streak);
    } else {
      p.streak = 0;
    }

    if (cycleState === 'STRENGTHENING') {
      p.isStrengthening = true;
      pushReason(p, 'STRENGTHENING');
    }
    if (cycleState === 'WEAKENING') {
      p.isWeakening = true;
      pushReason(p, 'WEAKENING');
    }
    if (mixedDelta) {
      pushWarning(p, 'MIXED_DELTA');
    }

    return p;
  }

  // ==========================================================================
  // §normalize 출력
  // ==========================================================================
  function normalizeSignalCycle(result) {
    return {
      valid: result.valid === true,
      version: SIGNAL_CYCLE_VERSION,
      cycleState: typeof result.cycleState === 'string' ? result.cycleState : 'UNKNOWN',
      cyclePhase: typeof result.cyclePhase === 'string' ? result.cyclePhase : 'UNKNOWN',
      candidateKey: typeof result.candidateKey === 'string' ? result.candidateKey : null,
      bucketFamily: typeof result.bucketFamily === 'string' ? result.bucketFamily : 'NONE',
      bucketTransition: result.bucketTransition || null,
      currentTs: (typeof result.currentTs === 'number' && isFinite(result.currentTs)) ? result.currentTs : null,
      previousTs: (typeof result.previousTs === 'number' && isFinite(result.previousTs)) ? result.previousTs : null,
      ageBars: safeNumber(result.ageBars, 0),
      ageMs: (typeof result.ageMs === 'number' && isFinite(result.ageMs)) ? result.ageMs : null,
      persistence: result.persistence,
      cooldown: result.cooldown,
      signalQuality: result.signalQuality,
      reasons: Array.isArray(result.reasons) ? result.reasons.slice() : [],
      warnings: Array.isArray(result.warnings) ? result.warnings.slice() : [],
      debug: result.debug,
      configUsed: result.configUsed
    };
  }

  function makeConfigUsed(cfg) {
    return {
      ready: { minConfidence: cfg.ready.minConfidence, minTotalScore: cfg.ready.minTotalScore },
      delta: {
        strengthenScoreDelta: cfg.delta.strengthenScoreDelta,
        weakenScoreDelta: cfg.delta.weakenScoreDelta,
        strengthenConfidenceDelta: cfg.delta.strengthenConfidenceDelta,
        weakenConfidenceDelta: cfg.delta.weakenConfidenceDelta
      },
      cooldown: { bars: cfg.cooldown.bars },
      expire: { maxAgeBars: cfg.expire.maxAgeBars },
      candidateKey: { mode: cfg.candidateKey.mode }
    };
  }

  // ==========================================================================
  // §main — buildSignalCycle
  // ==========================================================================
  /**
   * payload + scoreBreakdown + structureDecision + previousSignalState → standalone signalCycle.
   * 모든 입력 mutate 0건 (DP-CYC1).
   *
   * @param {Object}      payload              V3FeaturePayload
   * @param {Object}      [scoreBreakdown]
   * @param {Object}      [structureDecision]
   * @param {Object|null} [previousSignalState]
   * @param {Object}      [config]
   * @return {Object} signalCycle
   */
  function buildSignalCycle(payload, scoreBreakdown, structureDecision, previousSignalState, config) {
    var cfg = mergeSignalCycleConfig(config);
    var configUsed = makeConfigUsed(cfg);

    var topReasons = [];
    var topWarnings = [];

    // 1. previousState 정규화
    var previousState = normalizePreviousSignalState(previousSignalState === undefined ? null : previousSignalState);
    var previousStateUsed = previousState.valid;
    var previousStateShape = previousState.shape;
    if (previousSignalState && !previousState.valid) {
      topWarnings.push('PREVIOUS_STATE_INVALID');
    }

    // 2. currentTs / primaryTimeframe (U-CYC-1 Option A)
    var currentTs = getCurrentTs(payload);
    var primaryTimeframe = getPrimaryTimeframe(payload);
    var previousTs = previousState.valid ? safeNumber(previousState.normalized.currentTs, null) : null;
    var ageMs = null;
    if (typeof currentTs === 'number' && typeof previousTs === 'number') {
      ageMs = currentTs - previousTs;
    }

    // 3. signalQuality (DP-CYC8 ready)
    var signalQuality = getSignalQuality(scoreBreakdown, structureDecision, cfg);
    var bucket = signalQuality.structureBucket;
    var bucketFamily = signalQuality.bucketFamily;

    // 4. candidateKey (DP-CYC3)
    var candidateKey = getCandidateKey(payload, structureDecision, cfg);

    // 5. delta (DP-CYC9)
    var deltas = calculateDeltas(signalQuality, previousState);

    // 6. classify
    var classifyContext = {
      signalQuality: signalQuality,
      previousState: previousState,
      candidateKey: candidateKey,
      deltas: deltas
    };
    var classifyResult = classifySignalCycle(classifyContext, cfg);
    var cycleState = classifyResult.cycleState;
    var mixedDelta = classifyResult.mixedDelta === true;
    topReasons.push('CYCLE_' + cycleState);
    if (classifyResult.reason) topReasons.push(classifyResult.reason);
    if (mixedDelta) topWarnings.push('MIXED_DELTA');

    // 7. cooldown 계산 (cycleState === 'COOLDOWN' 인 경우)
    var cooldownContext = {
      signalQuality: signalQuality,
      previousState: previousState,
      currentTs: currentTs
    };
    var cooldown = calculateCooldown(cooldownContext, cfg);
    // 안전: cycleState !== COOLDOWN이면 cooldown 객체는 비활성
    if (cycleState !== 'COOLDOWN') {
      cooldown = {
        active: false,
        reason: null,
        barsRemaining: 0,
        startedTs: null,
        reasons: [],
        warnings: []
      };
    } else {
      // cooldown.expired === true 이면 EXPIRED 전환 (DP-CYC11)
      if (cooldown.expired === true) {
        cycleState = 'EXPIRED';
        topReasons.push('COOLDOWN_EXHAUSTED_TO_EXPIRED');
      }
    }
    // expired 필드는 출력 스키마에 포함하지 않음 (cooldown 내부 명세 외)
    var cooldownOut = {
      active: cooldown.active === true,
      reason: cooldown.reason || null,
      barsRemaining: safeNumber(cooldown.barsRemaining, 0),
      startedTs: (typeof cooldown.startedTs === 'number' && isFinite(cooldown.startedTs)) ? cooldown.startedTs : null,
      reasons: Array.isArray(cooldown.reasons) ? cooldown.reasons.slice() : [],
      warnings: Array.isArray(cooldown.warnings) ? cooldown.warnings.slice() : []
    };

    // 8. ageBars 산출 (final cycleState 기준)
    var ageBars = calculateAgeBars(cycleState, candidateKey, previousState);

    // 9. persistence 산출
    var persistence = calculatePersistence({
      signalQuality: signalQuality,
      previousState: previousState,
      cycleState: cycleState,
      candidateKey: candidateKey,
      deltas: deltas,
      mixedDelta: mixedDelta
    }, cfg);

    // 10. bucketTransition (debug/diagnostic — DP-STR 호환 메타)
    var bucketTransition = null;
    if (previousState.valid && typeof previousState.normalized.structureBucket === 'string') {
      bucketTransition = getBucketTransition(previousState.normalized.structureBucket, bucket);
    }

    // 11. cyclePhase
    var cyclePhase = getCyclePhase(cycleState);

    // 12. valid 결정 — UNKNOWN 이외는 유효
    var valid = cycleState !== 'UNKNOWN';

    return normalizeSignalCycle({
      valid: valid,
      cycleState: cycleState,
      cyclePhase: cyclePhase,
      candidateKey: candidateKey,
      bucketFamily: bucketFamily,
      bucketTransition: bucketTransition,
      currentTs: currentTs,
      previousTs: previousTs,
      ageBars: ageBars,
      ageMs: ageMs,
      persistence: persistence,
      cooldown: cooldownOut,
      signalQuality: signalQuality,
      reasons: topReasons,
      warnings: topWarnings,
      debug: {
        source: 'payload + scoreBreakdown + structureDecision',
        previousStateUsed: previousStateUsed,
        previousStateShape: previousStateShape,
        configVersion: cfg.version
      },
      configUsed: configUsed
    });
  }

  // ==========================================================================
  // §export — 이중 환경
  // ==========================================================================
  var api = Object.freeze({
    SIGNAL_CYCLE_VERSION: SIGNAL_CYCLE_VERSION,
    CONFIG_VERSION: CONFIG_VERSION,
    DEFAULT_SIGNAL_CYCLE_CONFIG: DEFAULT_SIGNAL_CYCLE_CONFIG,
    DEFAULT_PRIMARY_TIMEFRAME: DEFAULT_PRIMARY_TIMEFRAME,
    ACTIVE_CYCLE_STATES: ACTIVE_CYCLE_STATES,
    BUCKET_FAMILY_MAP: BUCKET_FAMILY_MAP,
    CYCLE_PHASE_MAP: CYCLE_PHASE_MAP,

    build: buildSignalCycle,
    mergeSignalCycleConfig: mergeSignalCycleConfig,
    normalizePreviousSignalState: normalizePreviousSignalState,

    getCurrentTs: getCurrentTs,
    getPrimaryTimeframe: getPrimaryTimeframe,
    getPrimaryCandles: getPrimaryCandles,
    getBucketFamily: getBucketFamily,
    getBucketTransition: getBucketTransition,
    getCandidateKey: getCandidateKey,
    getCyclePhase: getCyclePhase,
    getSignalQuality: getSignalQuality,
    calculateDeltas: calculateDeltas,
    calculatePersistence: calculatePersistence,
    calculateCooldown: calculateCooldown,
    calculateAgeBars: calculateAgeBars,
    classifySignalCycle: classifySignalCycle,

    safeNumber: safeNumber,
    isPlainObject: isPlainObject,
    normalizeSignalCycle: normalizeSignalCycle
  });

  global.WS3_SignalCycle = api;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis
   : typeof window !== 'undefined' ? window
   : typeof self !== 'undefined' ? self
   : this);
