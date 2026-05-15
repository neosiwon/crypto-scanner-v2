/**
 * WS3 v0.4.0 — structureBucket / priceZone / referenceLow 확정
 *
 * Scope:
 *   v3FeaturePayload (c-r1 박제본)
 *   + scoreBreakdown.components.structure (v0.3.0 박제본)
 *   + payload.raw.builderDebug
 *   → standalone structureDecision 객체
 *
 * 단일 기준 문서:
 *   docs/ws3/WS3_CODE_CONTRACT.md (b-r2 박제본)
 *
 * 확정 path (Gate 1 결과 — CASE B 이중 nesting):
 *   root         : payload.structure.structure
 *   box          : payload.structure.structure.box
 *   referenceLows: payload.structure.structure.referenceLows   (복수형 's')
 *   priceZone    : payload.structure.structure.priceZone
 *   sweepReclaim : payload.structure.structure.sweepReclaim
 *   touch        : payload.structure.structure.box.touchesHigh / touchesLow
 *   distance     : payload.structure.structure.box.distanceToTopPct / distanceToBottomPct
 *   currentClose : payload.candles[primaryTimeframe] last candle.close
 *   primaryTimeframe : payload.raw.builderDebug.primaryTimeframe || 'h1'
 *
 * 확정 DP 정책:
 *   DP-STR1  standalone structureDecision. payload / scoreBreakdown mutate 금지.
 *   DP-STR2  13 structureBucket 후보 (UNKNOWN / NO_STRUCTURE / BOX_MIDDLE / BOX_TOP_PRESSURE /
 *            BOX_BOTTOM_RISK / ABOVE_BOX_CONFIRMED_CANDIDATE / BELOW_BOX_CONFIRMED_CANDIDATE /
 *            LOW_SWEEP_PENDING / LOW_SWEEP_RECLAIM_CANDIDATE / HIGH_SWEEP_REJECT_CANDIDATE /
 *            RECLAIM_READY / BREAKOUT_PRESSURE_CANDIDATE / BREAKDOWN_RISK_CANDIDATE).
 *   DP-STR3  priceZone source 우선순위: structureRoot.priceZone → box distance 보조 → UNKNOWN.
 *   DP-STR4  referenceLow 선택: sweep/reclaim 관련 low → 가장 최근 valid referenceLow → null.
 *            distancePct = (currentClose - refLow.value) / currentClose * 100.
 *   DP-STR5  4-touch 기준: touchesHigh >= cfg.box.breakoutTouchCount,
 *            touchesLow >= cfg.box.breakdownTouchCount. 기본 4.
 *            touch count는 v3-indicators 출력 재사용 (재계산 X).
 *   DP-STR6  confidence 0~100 (등급 사용 금지).
 *            box+25 / priceZone+20 / refLow+20 / sweep/reclaim+20 / structureScore≥15 +15.
 *   DP-STR7  scoreBreakdown.components.structure.score = confidence 보조값만.
 *            scoreBreakdown.totalScore는 직접 사용 안 함.
 *   DP-STR8  riskPenalty 미반영 (후속 strategyBias / entryPlan 단계).
 *   DP-STR9  ABOVE_BOX → ABOVE_BOX_CONFIRMED_CANDIDATE / BELOW_BOX → BELOW_BOX_CONFIRMED_CANDIDATE.
 *   DP-STR10 분류 우선순위:
 *            1) sweep/reclaim → 2) box 외부 → 3) box pressure/risk → 4) priceZone → 5) fallback.
 *
 * N-STR 참고:
 *   N-STR-1  referenceLows 복수형 's' 사용.
 *   N-STR-2  structure compose valid는 4 sub 모두 valid일 때만. 각 sub valid 개별 점검.
 *   N-STR-3  currentClose = primary timeframe (default 'h1') 마지막 candle.close.
 *   N-STR-4  confidence 가산은 components.structure.valid === true && score >= 15 조건만.
 *   N-STR-5  structureBucket === UNKNOWN || NO_STRUCTURE 이면 confidence = 0.
 *
 * 금지 (이번 단계):
 *   grade / tier / 등급 코드 산출.
 *   signalCycle / persistence / strategyBias / entryPlan / exitPlan.
 *   알림 연동 / 화면 모델 / 렌더 계층 / UI / 외부 신호.
 *   payload / scoreBreakdown mutation. delete.
 *   외부 API 호출 / DOM / 브라우저 storage / KV.
 *   런타임 clock API 사용.
 *   새 캔들 fetch / 새 지표 계산 / touch count 재계산.
 *
 * 의존:
 *   payload  (v3-feature-payload-builder.js 산출)
 *   scoreBreakdown  (v3-score-breakdown.js 산출, optional)
 */

(function (global) {
  'use strict';

  var STRUCTURE_VERSION = 'WS3_v0.4.0';
  var CONFIG_VERSION = 'inline-default-v0';
  var DEFAULT_PRIMARY_TIMEFRAME = 'h1';
  var TIMEFRAMES = ['m5', 'm15', 'h1', 'h4', 'd1'];

  // ==========================================================================
  // DEFAULT_STRUCTURE_BUCKET_CONFIG (DP-STR5/6 + priceZone 임계값)
  // ==========================================================================
  var DEFAULT_STRUCTURE_BUCKET_CONFIG = Object.freeze({
    version: CONFIG_VERSION,
    priceZone: Object.freeze({
      topNearPct: 15,
      bottomNearPct: 15,
      breakoutBufferPct: 2
    }),
    box: Object.freeze({
      breakoutTouchCount: 4,
      breakdownTouchCount: 4
    }),
    confidence: Object.freeze({
      boxValid: 25,
      priceZoneValid: 20,
      referenceLowValid: 20,
      sweepReclaimValid: 20,
      structureScoreHigh: 15,
      structureScoreHighThreshold: 15
    })
  });

  function mergeStructureBucketConfig(config) {
    var c = config || {};
    var defPZ = DEFAULT_STRUCTURE_BUCKET_CONFIG.priceZone;
    var defBox = DEFAULT_STRUCTURE_BUCKET_CONFIG.box;
    var defConf = DEFAULT_STRUCTURE_BUCKET_CONFIG.confidence;
    var pz = c.priceZone || {};
    var bx = c.box || {};
    var cf = c.confidence || {};
    return {
      version: typeof c.version === 'string' ? c.version : DEFAULT_STRUCTURE_BUCKET_CONFIG.version,
      priceZone: {
        topNearPct: safeNumber(pz.topNearPct, defPZ.topNearPct),
        bottomNearPct: safeNumber(pz.bottomNearPct, defPZ.bottomNearPct),
        breakoutBufferPct: safeNumber(pz.breakoutBufferPct, defPZ.breakoutBufferPct)
      },
      box: {
        breakoutTouchCount: safeNumber(bx.breakoutTouchCount, defBox.breakoutTouchCount),
        breakdownTouchCount: safeNumber(bx.breakdownTouchCount, defBox.breakdownTouchCount)
      },
      confidence: {
        boxValid: safeNumber(cf.boxValid, defConf.boxValid),
        priceZoneValid: safeNumber(cf.priceZoneValid, defConf.priceZoneValid),
        referenceLowValid: safeNumber(cf.referenceLowValid, defConf.referenceLowValid),
        sweepReclaimValid: safeNumber(cf.sweepReclaimValid, defConf.sweepReclaimValid),
        structureScoreHigh: safeNumber(cf.structureScoreHigh, defConf.structureScoreHigh),
        structureScoreHighThreshold: safeNumber(cf.structureScoreHighThreshold, defConf.structureScoreHighThreshold)
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

  function clampScore(value, min, max) {
    var lo = (min === undefined) ? 0 : min;
    var hi = (max === undefined) ? 100 : max;
    var n = safeNumber(value, 0);
    if (n < lo) return lo;
    if (n > hi) return hi;
    return n;
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

  // ==========================================================================
  // §path resolvers (CASE B 이중 nesting 확정 기준)
  // ==========================================================================
  function getStructureRoot(payload) {
    if (!isPlainObject(payload)) return null;
    if (!isPlainObject(payload.structure)) return null;
    if (!isPlainObject(payload.structure.structure)) return null;
    return payload.structure.structure;
  }

  function getActualStructurePath(payload) {
    if (getStructureRoot(payload)) return 'payload.structure.structure';
    return null;
  }

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
  // §sub-context builders
  // ==========================================================================
  /**
   * boxContext 구성. v3-indicators의 box 출력 그대로 재사용 (touch count 재계산 X).
   */
  function getBoxContext(structureRoot, cfg) {
    var ctx = {
      valid: false,
      boxHigh: null,
      boxLow: null,
      boxCenter: null,
      touchesHigh: null,
      touchesLow: null,
      reasons: [],
      warnings: []
    };
    if (!isPlainObject(structureRoot)) {
      pushWarning(ctx, 'STRUCTURE_ROOT_MISSING');
      return ctx;
    }
    var box = structureRoot.box;
    if (!isPlainObject(box)) {
      pushWarning(ctx, 'BOX_MISSING');
      return ctx;
    }
    if (box.valid !== true) {
      pushWarning(ctx, 'BOX_INVALID');
      // 그래도 가능한 값은 보존
    } else {
      ctx.valid = true;
      pushReason(ctx, 'BOX_VALID');
    }

    ctx.boxHigh = safeNumber(box.boxHigh, null);
    ctx.boxLow = safeNumber(box.boxLow, null);
    ctx.boxCenter = safeNumber(box.boxCenter, null);
    ctx.touchesHigh = safeNumber(box.touchesHigh, null);
    ctx.touchesLow = safeNumber(box.touchesLow, null);

    if (typeof ctx.touchesHigh === 'number' && ctx.touchesHigh >= cfg.box.breakoutTouchCount) {
      pushReason(ctx, 'TOUCHES_HIGH_AT_THRESHOLD', ctx.touchesHigh);
    }
    if (typeof ctx.touchesLow === 'number' && ctx.touchesLow >= cfg.box.breakdownTouchCount) {
      pushReason(ctx, 'TOUCHES_LOW_AT_THRESHOLD', ctx.touchesLow);
    }

    return ctx;
  }

  /**
   * priceZone 결정. DP-STR3 우선순위.
   */
  function getPriceZone(structureRoot, boxContext, currentClose, cfg) {
    var ctx = {
      valid: false,
      zone: 'UNKNOWN',
      source: null,
      distanceToTopPct: null,
      distanceToBottomPct: null,
      reasons: [],
      warnings: []
    };

    // box의 distance 정보 미리 채움 (있으면 항상 보존)
    if (isPlainObject(structureRoot) && isPlainObject(structureRoot.box)) {
      ctx.distanceToTopPct = safeNumber(structureRoot.box.distanceToTopPct, null);
      ctx.distanceToBottomPct = safeNumber(structureRoot.box.distanceToBottomPct, null);
    }

    // 1) structureRoot.priceZone 후보값 우선
    var pz = isPlainObject(structureRoot) ? structureRoot.priceZone : null;
    if (isPlainObject(pz) && pz.valid === true) {
      ctx.valid = true;
      ctx.source = 'STRUCTURE_PRICE_ZONE';
      // zone 라벨이 priceZone에 있으면 활용, 없으면 box distance로 보강
      if (typeof pz.zone === 'string' && pz.zone) {
        ctx.zone = pz.zone;
        pushReason(ctx, 'PRICE_ZONE_FROM_STRUCTURE', pz.zone);
        return ctx;
      }
      // 라벨이 없어도 valid면 box distance로 zone 결정
      var zoneFromDist = deriveZoneFromBoxDistance(ctx, cfg);
      if (zoneFromDist) {
        ctx.zone = zoneFromDist;
        pushReason(ctx, 'PRICE_ZONE_DERIVED', zoneFromDist);
      } else {
        pushWarning(ctx, 'PRICE_ZONE_LABEL_MISSING');
      }
      return ctx;
    }

    // 2) box distance 기반 보조 판정
    if (boxContext && boxContext.valid && (ctx.distanceToTopPct !== null || ctx.distanceToBottomPct !== null)) {
      var z = deriveZoneFromBoxDistance(ctx, cfg);
      if (z) {
        ctx.valid = true;
        ctx.zone = z;
        ctx.source = 'BOX_DISTANCE';
        pushReason(ctx, 'PRICE_ZONE_FROM_BOX_DISTANCE', z);
        return ctx;
      }
    }

    // 3) UNKNOWN
    pushWarning(ctx, 'PRICE_ZONE_UNKNOWN');
    return ctx;
  }

  /**
   * box distance로부터 zone 라벨 추출.
   * distanceToTopPct < topNearPct  → TOP_NEAR
   * distanceToBottomPct < bottomNearPct → BOTTOM_NEAR
   * 그 외 valid distance → MIDDLE
   */
  function deriveZoneFromBoxDistance(ctx, cfg) {
    var dt = ctx.distanceToTopPct;
    var db = ctx.distanceToBottomPct;
    if (typeof dt !== 'number' && typeof db !== 'number') return null;

    if (typeof dt === 'number' && dt < cfg.priceZone.topNearPct
        && (typeof db !== 'number' || dt < db)) {
      return 'TOP_NEAR';
    }
    if (typeof db === 'number' && db < cfg.priceZone.bottomNearPct
        && (typeof dt !== 'number' || db <= dt)) {
      return 'BOTTOM_NEAR';
    }
    return 'MIDDLE';
  }

  /**
   * referenceLow 선택. DP-STR4 우선순위.
   */
  function getReferenceLow(structureRoot, priceZone, currentClose, sweepReclaimContext, cfg) {
    var ctx = {
      valid: false,
      value: null,
      source: null,
      distancePct: null,
      reasons: [],
      warnings: []
    };

    if (!isPlainObject(structureRoot)) {
      pushWarning(ctx, 'STRUCTURE_ROOT_MISSING');
      return ctx;
    }

    // 1) sweep/reclaim 관련 low 우선
    var sr = structureRoot.sweepReclaim;
    if (isPlainObject(sr) && isPlainObject(sr.details)) {
      var sweepLow = safeNumber(sr.details.previousLow, null);
      if (typeof sweepLow === 'number') {
        ctx.valid = true;
        ctx.value = sweepLow;
        ctx.source = 'SWEEP_RECLAIM_PREVIOUS_LOW';
        pushReason(ctx, 'REF_LOW_FROM_SWEEP');
        ctx.distancePct = computeDistancePct(currentClose, sweepLow);
        return ctx;
      }
    }

    // 2) referenceLows (복수형) 객체에서 가장 최근 valid value
    var refs = structureRoot.referenceLows;
    if (isPlainObject(refs) && refs.valid === true) {
      var picked = pickRecentReferenceLow(refs);
      if (picked && typeof picked.value === 'number') {
        ctx.valid = true;
        ctx.value = picked.value;
        ctx.source = picked.source || 'REFERENCE_LOWS_RECENT';
        pushReason(ctx, 'REF_LOW_FROM_REFERENCES', picked.source || 'recent');
        ctx.distancePct = computeDistancePct(currentClose, picked.value);
        return ctx;
      }
      pushWarning(ctx, 'REFERENCE_LOWS_NO_VALID_VALUE');
    } else {
      pushWarning(ctx, 'REFERENCE_LOWS_INVALID');
    }

    // 3) null
    return ctx;
  }

  /**
   * referenceLows 객체에서 valid 후보 중 가장 최근(또는 최단기) low 선택.
   * indicators의 findReferenceLows 출력 형상이 multi-timeframe일 수 있어
   * 안전하게 내부 number 값을 후보로 수집.
   */
  function pickRecentReferenceLow(refs) {
    if (!isPlainObject(refs)) return null;
    // 우선순위 키 (단기 → 장기)
    var priorityKeys = ['recent', 'h1', 'm15', 'm5', 'h4', 'd1', 'shortTerm', 'midTerm', 'longTerm', 'value', 'price', 'low', 'level'];
    for (var i = 0; i < priorityKeys.length; i++) {
      var k = priorityKeys[i];
      if (!Object.prototype.hasOwnProperty.call(refs, k)) continue;
      var v = refs[k];
      if (typeof v === 'number' && isFinite(v)) {
        return { value: v, source: 'REFERENCE_LOWS_' + k.toUpperCase() };
      }
      if (isPlainObject(v)) {
        // nested: 우선순위 value/price/low/level
        var nestedKeys = ['value', 'price', 'low', 'level'];
        for (var j = 0; j < nestedKeys.length; j++) {
          var nk = nestedKeys[j];
          if (typeof v[nk] === 'number' && isFinite(v[nk])) {
            return { value: v[nk], source: 'REFERENCE_LOWS_' + k.toUpperCase() + '_' + nk.toUpperCase() };
          }
        }
      }
    }
    // 일반 키 탐색: 내부에 finite number 있는 첫 항목
    var keys = Object.keys(refs);
    for (var x = 0; x < keys.length; x++) {
      var key = keys[x];
      if (key === 'valid' || key === 'configUsed' || key === 'reasons' || key === 'warnings') continue;
      var val = refs[key];
      if (typeof val === 'number' && isFinite(val)) {
        return { value: val, source: 'REFERENCE_LOWS_' + key.toUpperCase() };
      }
    }
    return null;
  }

  function computeDistancePct(currentClose, refLowValue) {
    if (typeof currentClose !== 'number' || !isFinite(currentClose) || currentClose === 0) return null;
    if (typeof refLowValue !== 'number' || !isFinite(refLowValue)) return null;
    var pct = (currentClose - refLowValue) / currentClose * 100;
    return Math.round(pct * 100) / 100;
  }

  /**
   * sweepReclaimContext 구성.
   */
  function getSweepReclaimContext(structureRoot, cfg) {
    var ctx = {
      valid: false,
      lowSweepCandidate: false,
      highSweepCandidate: false,
      reclaimCandidate: false,
      reasons: [],
      warnings: []
    };
    if (!isPlainObject(structureRoot)) {
      pushWarning(ctx, 'STRUCTURE_ROOT_MISSING');
      return ctx;
    }
    var sr = structureRoot.sweepReclaim;
    if (!isPlainObject(sr)) {
      pushWarning(ctx, 'SWEEP_RECLAIM_MISSING');
      return ctx;
    }
    if (sr.valid === true) {
      ctx.valid = true;
      pushReason(ctx, 'SWEEP_RECLAIM_VALID');
    } else {
      pushWarning(ctx, 'SWEEP_RECLAIM_INVALID');
    }
    ctx.lowSweepCandidate = sr.lowSweepCandidate === true;
    ctx.highSweepCandidate = sr.highSweepCandidate === true;
    ctx.reclaimCandidate = sr.reclaimCandidate === true;
    if (ctx.lowSweepCandidate) pushReason(ctx, 'LOW_SWEEP_CANDIDATE');
    if (ctx.highSweepCandidate) pushReason(ctx, 'HIGH_SWEEP_CANDIDATE');
    if (ctx.reclaimCandidate) pushReason(ctx, 'RECLAIM_CANDIDATE');
    return ctx;
  }

  // ==========================================================================
  // §classifyStructureBucket (DP-STR10 우선순위)
  // ==========================================================================
  function classifyStructureBucket(context, cfg) {
    var sr = context.sweepReclaimContext;
    var box = context.boxContext;
    var pz = context.priceZone;
    var rl = context.referenceLow;
    var currentClose = context.currentClose;

    // 1) sweep/reclaim 계열
    if (sr && sr.valid) {
      if (sr.lowSweepCandidate && sr.reclaimCandidate) return 'LOW_SWEEP_RECLAIM_CANDIDATE';
      if (sr.lowSweepCandidate) return 'LOW_SWEEP_PENDING';
      if (sr.highSweepCandidate) return 'HIGH_SWEEP_REJECT_CANDIDATE';
      if (sr.reclaimCandidate) return 'RECLAIM_READY';
    }

    // 2) box 외부 위치 — DP-STR9
    if (box && box.valid && typeof currentClose === 'number') {
      if (typeof box.boxHigh === 'number' && currentClose > box.boxHigh) {
        return 'ABOVE_BOX_CONFIRMED_CANDIDATE';
      }
      if (typeof box.boxLow === 'number' && currentClose < box.boxLow) {
        return 'BELOW_BOX_CONFIRMED_CANDIDATE';
      }
    }

    // 3) box pressure/risk — 4-touch 기준 (DP-STR5)
    if (box && box.valid) {
      if (typeof box.touchesHigh === 'number' && box.touchesHigh >= cfg.box.breakoutTouchCount) {
        return 'BREAKOUT_PRESSURE_CANDIDATE';
      }
      if (typeof box.touchesLow === 'number' && box.touchesLow >= cfg.box.breakdownTouchCount) {
        return 'BREAKDOWN_RISK_CANDIDATE';
      }
    }

    // 4) priceZone 기반
    if (pz && pz.valid) {
      if (pz.zone === 'TOP_NEAR') return 'BOX_TOP_PRESSURE';
      if (pz.zone === 'BOTTOM_NEAR') return 'BOX_BOTTOM_RISK';
      if (pz.zone === 'MIDDLE') return 'BOX_MIDDLE';
    }

    // 5) fallback
    var anyValid = (box && box.valid) || (pz && pz.valid) || (rl && rl.valid) || (sr && sr.valid);
    if (!anyValid) return 'NO_STRUCTURE';
    return 'UNKNOWN';
  }

  // ==========================================================================
  // §calculateStructureConfidence (DP-STR6 + N-STR-4 / N-STR-5)
  // ==========================================================================
  function calculateStructureConfidence(context, scoreBreakdown, cfg) {
    // N-STR-5: UNKNOWN / NO_STRUCTURE → 0
    if (context.structureBucket === 'UNKNOWN' || context.structureBucket === 'NO_STRUCTURE') {
      return { value: 0, reasons: ['BUCKET_TRIVIAL'], structureScore: null, scoreBreakdownUsed: false };
    }

    var c = cfg.confidence;
    var score = 0;
    var reasons = [];

    if (context.boxContext && context.boxContext.valid) {
      score += c.boxValid;
      reasons.push('BOX_VALID+' + c.boxValid);
    }
    if (context.priceZone && context.priceZone.valid) {
      score += c.priceZoneValid;
      reasons.push('PRICE_ZONE_VALID+' + c.priceZoneValid);
    }
    if (context.referenceLow && context.referenceLow.valid) {
      score += c.referenceLowValid;
      reasons.push('REFERENCE_LOW_VALID+' + c.referenceLowValid);
    }
    if (context.sweepReclaimContext && context.sweepReclaimContext.valid) {
      score += c.sweepReclaimValid;
      reasons.push('SWEEP_RECLAIM_VALID+' + c.sweepReclaimValid);
    }

    // N-STR-4: structureScore 가산은 valid=true && score>=threshold일 때만
    var structureScore = null;
    var scoreBreakdownUsed = false;
    if (isPlainObject(scoreBreakdown)
        && isPlainObject(scoreBreakdown.components)
        && isPlainObject(scoreBreakdown.components.structure)) {
      var ss = scoreBreakdown.components.structure;
      if (typeof ss.score === 'number') structureScore = ss.score;
      if (ss.valid === true
          && typeof ss.score === 'number'
          && ss.score >= c.structureScoreHighThreshold) {
        score += c.structureScoreHigh;
        reasons.push('STRUCTURE_SCORE_HIGH+' + c.structureScoreHigh);
        scoreBreakdownUsed = true;
      }
    }

    return {
      value: clampScore(score, 0, 100),
      reasons: reasons,
      structureScore: structureScore,
      scoreBreakdownUsed: scoreBreakdownUsed
    };
  }

  // ==========================================================================
  // §normalizeStructureDecision — 출력 정형화
  // ==========================================================================
  function normalizeStructureDecision(result) {
    return {
      valid: result.valid === true,
      version: STRUCTURE_VERSION,
      structureBucket: typeof result.structureBucket === 'string' ? result.structureBucket : 'UNKNOWN',
      confidence: clampScore(safeNumber(result.confidence, 0), 0, 100),
      priceZone: result.priceZone,
      referenceLow: result.referenceLow,
      boxContext: result.boxContext,
      sweepReclaimContext: result.sweepReclaimContext,
      reasons: Array.isArray(result.reasons) ? result.reasons.slice() : [],
      warnings: Array.isArray(result.warnings) ? result.warnings.slice() : [],
      debug: result.debug,
      configUsed: result.configUsed
    };
  }

  // ==========================================================================
  // §main — buildStructureDecision
  // ==========================================================================
  /**
   * V3FeaturePayload + scoreBreakdown → standalone structureDecision.
   * payload / scoreBreakdown mutate 0건 (DP-STR1).
   *
   * @param {Object} payload          V3FeaturePayload
   * @param {Object} [scoreBreakdown] WS3_ScoreBreakdown 출력 (optional)
   * @param {Object} [config]         override config
   * @return {Object} structureDecision
   */
  function buildStructureDecision(payload, scoreBreakdown, config) {
    var cfg = mergeStructureBucketConfig(config);
    var configUsed = {
      priceZone: { topNearPct: cfg.priceZone.topNearPct, bottomNearPct: cfg.priceZone.bottomNearPct, breakoutBufferPct: cfg.priceZone.breakoutBufferPct },
      box: { breakoutTouchCount: cfg.box.breakoutTouchCount, breakdownTouchCount: cfg.box.breakdownTouchCount },
      confidence: {
        boxValid: cfg.confidence.boxValid,
        priceZoneValid: cfg.confidence.priceZoneValid,
        referenceLowValid: cfg.confidence.referenceLowValid,
        sweepReclaimValid: cfg.confidence.sweepReclaimValid,
        structureScoreHigh: cfg.confidence.structureScoreHigh,
        structureScoreHighThreshold: cfg.confidence.structureScoreHighThreshold
      }
    };

    var topReasons = [];
    var topWarnings = [];

    // payload 미존재 → safe NO_STRUCTURE
    if (!isPlainObject(payload)) {
      var safeRL = { valid: false, value: null, source: null, distancePct: null, reasons: [], warnings: ['PAYLOAD_NOT_OBJECT'] };
      var safeBC = { valid: false, boxHigh: null, boxLow: null, boxCenter: null, touchesHigh: null, touchesLow: null, reasons: [], warnings: ['PAYLOAD_NOT_OBJECT'] };
      var safePZ = { valid: false, zone: 'UNKNOWN', source: null, distanceToTopPct: null, distanceToBottomPct: null, reasons: [], warnings: ['PAYLOAD_NOT_OBJECT'] };
      var safeSR = { valid: false, lowSweepCandidate: false, highSweepCandidate: false, reclaimCandidate: false, reasons: [], warnings: ['PAYLOAD_NOT_OBJECT'] };
      return normalizeStructureDecision({
        valid: false,
        structureBucket: 'NO_STRUCTURE',
        confidence: 0,
        priceZone: safePZ,
        referenceLow: safeRL,
        boxContext: safeBC,
        sweepReclaimContext: safeSR,
        reasons: [],
        warnings: ['PAYLOAD_NOT_OBJECT'],
        debug: {
          source: 'v3FeaturePayload.structure',
          actualStructurePath: null,
          scoreBreakdownUsed: false,
          structureScore: null,
          configVersion: cfg.version
        },
        configUsed: configUsed
      });
    }

    var structureRoot = getStructureRoot(payload);
    var actualPath = getActualStructurePath(payload);
    var currentClose = getCurrentClose(payload);

    if (!structureRoot) {
      topWarnings.push('STRUCTURE_ROOT_NOT_FOUND');
    }

    // sub-context 빌드
    var boxContext = getBoxContext(structureRoot, cfg);
    var sweepReclaimContext = getSweepReclaimContext(structureRoot, cfg);
    var priceZone = getPriceZone(structureRoot, boxContext, currentClose, cfg);
    var referenceLow = getReferenceLow(structureRoot, priceZone, currentClose, sweepReclaimContext, cfg);

    // classify
    var classifyCtx = {
      boxContext: boxContext,
      sweepReclaimContext: sweepReclaimContext,
      priceZone: priceZone,
      referenceLow: referenceLow,
      currentClose: currentClose
    };
    var structureBucket = classifyStructureBucket(classifyCtx, cfg);

    // confidence (N-STR-4 / N-STR-5)
    var confidenceCtx = {
      boxContext: boxContext,
      priceZone: priceZone,
      referenceLow: referenceLow,
      sweepReclaimContext: sweepReclaimContext,
      structureBucket: structureBucket
    };
    var confResult = calculateStructureConfidence(confidenceCtx, scoreBreakdown, cfg);

    // top-level reasons / warnings 집계
    topReasons.push('BUCKET_' + structureBucket);
    if (confResult.reasons && confResult.reasons.length > 0) {
      for (var i = 0; i < confResult.reasons.length; i++) {
        if (topReasons.indexOf(confResult.reasons[i]) === -1) {
          topReasons.push(confResult.reasons[i]);
        }
      }
    }
    if (typeof currentClose !== 'number') {
      topWarnings.push('CURRENT_CLOSE_MISSING');
    }

    // valid = 계산 가능 여부 (structureRoot 있고 sub-context 1개 이상 valid)
    var anySubValid = boxContext.valid || priceZone.valid || referenceLow.valid || sweepReclaimContext.valid;
    var valid = !!structureRoot && (anySubValid || structureBucket === 'NO_STRUCTURE' || structureBucket === 'UNKNOWN');

    return normalizeStructureDecision({
      valid: valid,
      structureBucket: structureBucket,
      confidence: confResult.value,
      priceZone: priceZone,
      referenceLow: referenceLow,
      boxContext: boxContext,
      sweepReclaimContext: sweepReclaimContext,
      reasons: topReasons,
      warnings: topWarnings,
      debug: {
        source: 'v3FeaturePayload.structure',
        actualStructurePath: actualPath,
        scoreBreakdownUsed: confResult.scoreBreakdownUsed,
        structureScore: confResult.structureScore,
        configVersion: cfg.version
      },
      configUsed: configUsed
    });
  }

  // ==========================================================================
  // §export — 이중 환경
  // ==========================================================================
  var api = Object.freeze({
    STRUCTURE_VERSION: STRUCTURE_VERSION,
    CONFIG_VERSION: CONFIG_VERSION,
    DEFAULT_STRUCTURE_BUCKET_CONFIG: DEFAULT_STRUCTURE_BUCKET_CONFIG,
    TIMEFRAMES: TIMEFRAMES,
    DEFAULT_PRIMARY_TIMEFRAME: DEFAULT_PRIMARY_TIMEFRAME,

    build: buildStructureDecision,
    mergeStructureBucketConfig: mergeStructureBucketConfig,
    classifyStructureBucket: classifyStructureBucket,
    calculateStructureConfidence: calculateStructureConfidence,

    getStructureRoot: getStructureRoot,
    getActualStructurePath: getActualStructurePath,
    getCurrentClose: getCurrentClose,
    getPrimaryTimeframe: getPrimaryTimeframe,
    getBoxContext: getBoxContext,
    getPriceZone: getPriceZone,
    getReferenceLow: getReferenceLow,
    getSweepReclaimContext: getSweepReclaimContext,

    safeNumber: safeNumber,
    clampScore: clampScore,
    isPlainObject: isPlainObject,
    normalizeStructureDecision: normalizeStructureDecision
  });

  global.WS3_StructureBucket = api;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis
   : typeof window !== 'undefined' ? window
   : typeof self !== 'undefined' ? self
   : this);
