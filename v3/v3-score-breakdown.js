/**
 * WS3 v0.3.0 — scoreBreakdown Builder
 *
 * Scope:
 *   V3FeaturePayload (c-r1 박제본)
 *   → scoreBreakdown { valid, grossScore, riskPenalty, totalScore, components, risk, ... }
 *
 * 단일 기준 문서:
 *   docs/ws3/WS3_CODE_CONTRACT.md (b-r2 박제본)
 *
 * 확정 DP 정책:
 *   DP-S1 payload mutate 금지. standalone 객체 반환.
 *   DP-S2 weight 25/20/20/15/20 (합계 100). config override 가능.
 *   DP-S3 unavailable: component valid=false → score=0. sub-signal 부분 누락 → 부분점 + warning.
 *   DP-S4 payload.risk 기본값(penalty=null, level='UNKNOWN', flags=[])이면 penalty 0.
 *   DP-S5 grade / tier / label / P-등급 미산출.
 *   DP-S6 buyPressure 점수 미반영. core에서 object 존재만 검사.
 *   DP-S7 DEFAULT_SCORE_CONFIG 본 파일 내부 보관. v3-config.js 미수정.
 *   DP-S8 core(존재성/구조) vs execution(양적 충분성) 평가 범위 분리. 중복 점수화 금지.
 *   DP-S9 valid(계산 가능 여부) vs totalScore(신호 강도) 분리.
 *
 * N-1 ~ N-5 처리:
 *   N-1: 빈 객체 component → valid=false + score=0 + NO_*_SIGNALS warning.
 *   N-2: payload.buyPressure.state 점수화 X. core에서 object 존재만.
 *   N-3: payload.marketContext.state 점수화 X. core에서 object 존재만.
 *   N-4: tradeValue 통계 키 (currentTradeValueKrw 등) v3-indicators 출력 그대로 사용.
 *   N-5: indicator warnings → execution 감점 + 경미한 riskPenalty. 중복 감점 X.
 *
 * 금지:
 *   payload mutate / delete / scoreBreakdown 외부 부착.
 *   grade / tier / label / 등급 코드 산출.
 *   signalCycle / 구조 최종 분류 / 전략 편향 / entryPlan / exitPlan.
 *   렌더 계층 / 화면 모델 / 외부 신호 / 알림 연동 / UI.
 *   외부 호출 (외부 API / DOM / 브라우저 storage / KV).
 *   런타임 clock API 사용.
 *
 * 의존:
 *   global.WS3_FeaturePayload (v3-feature-payload.js — isValid 호출 시도, 없으면 fallback).
 *
 * 입력 / 출력:
 *   입력: payload (V3FeaturePayload), config (선택)
 *   출력: scoreBreakdown 객체 (payload mutate 0건)
 */

(function (global) {
  'use strict';

  var SCORE_VERSION = 'WS3_v0.3.0';
  var CONFIG_VERSION = 'inline-default-v0';
  var TIMEFRAMES = ['m5', 'm15', 'h1', 'h4', 'd1'];
  var DEFAULT_PRIMARY_TIMEFRAME = 'h1';
  var TOP_LEVEL_FIELDS = [
    'identity', 'ts', 'candles', 'indicators', 'structure', 'volume',
    'momentum', 'marketContext', 'buyPressure', 'coinMeta', 'newsContext',
    'risk', 'raw'
  ];

  // ==========================================================================
  // DEFAULT_SCORE_CONFIG (DP-S7)
  // ==========================================================================
  var DEFAULT_SCORE_CONFIG = Object.freeze({
    version: CONFIG_VERSION,
    weights: Object.freeze({
      core: 25,
      structure: 20,
      volume: 20,
      momentum: 15,
      execution: 20
    }),
    risk: Object.freeze({
      maxPenalty: 15,
      // 위험 가중치 — sub 항목별 cap (penalty 합산 시 사용)
      levelHigh: 5,
      levelMid: 2,
      flagsCap: 3,
      overrideCap: 5,
      builderWarnPerItem: 2,
      builderWarnCap: 4,
      indicatorWarnPerItem: 1,
      indicatorWarnCap: 2
    }),
    execution: Object.freeze({
      candlesFull: 60,
      candlesHalf: 30,
      candlesMinimal: 10
    })
  });

  function mergeScoreConfig(config) {
    var c = config || {};
    var defWeights = DEFAULT_SCORE_CONFIG.weights;
    var defRisk = DEFAULT_SCORE_CONFIG.risk;
    var defExec = DEFAULT_SCORE_CONFIG.execution;
    var weights = c.weights || {};
    var risk = c.risk || {};
    var exec = c.execution || {};
    return {
      version: typeof c.version === 'string' ? c.version : DEFAULT_SCORE_CONFIG.version,
      weights: {
        core: safeNumber(weights.core, defWeights.core),
        structure: safeNumber(weights.structure, defWeights.structure),
        volume: safeNumber(weights.volume, defWeights.volume),
        momentum: safeNumber(weights.momentum, defWeights.momentum),
        execution: safeNumber(weights.execution, defWeights.execution)
      },
      risk: {
        maxPenalty: safeNumber(risk.maxPenalty, defRisk.maxPenalty),
        levelHigh: safeNumber(risk.levelHigh, defRisk.levelHigh),
        levelMid: safeNumber(risk.levelMid, defRisk.levelMid),
        flagsCap: safeNumber(risk.flagsCap, defRisk.flagsCap),
        overrideCap: safeNumber(risk.overrideCap, defRisk.overrideCap),
        builderWarnPerItem: safeNumber(risk.builderWarnPerItem, defRisk.builderWarnPerItem),
        builderWarnCap: safeNumber(risk.builderWarnCap, defRisk.builderWarnCap),
        indicatorWarnPerItem: safeNumber(risk.indicatorWarnPerItem, defRisk.indicatorWarnPerItem),
        indicatorWarnCap: safeNumber(risk.indicatorWarnCap, defRisk.indicatorWarnCap)
      },
      execution: {
        candlesFull: safeNumber(exec.candlesFull, defExec.candlesFull),
        candlesHalf: safeNumber(exec.candlesHalf, defExec.candlesHalf),
        candlesMinimal: safeNumber(exec.candlesMinimal, defExec.candlesMinimal)
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

  function getFeaturePayloadApi() {
    if (global && global.WS3_FeaturePayload) return global.WS3_FeaturePayload;
    if (typeof globalThis !== 'undefined' && globalThis.WS3_FeaturePayload) return globalThis.WS3_FeaturePayload;
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

  function getPrimaryCandles(payload, primaryTimeframe) {
    var tf = primaryTimeframe || getPrimaryTimeframe(payload);
    if (isPlainObject(payload) && isPlainObject(payload.candles) && Array.isArray(payload.candles[tf])) {
      return payload.candles[tf];
    }
    return [];
  }

  function collectPayloadWarnings(payload) {
    var out = { builder: [], indicators: [] };
    if (!isPlainObject(payload)) return out;
    if (isPlainObject(payload.raw)
        && isPlainObject(payload.raw.builderDebug)
        && Array.isArray(payload.raw.builderDebug.warnings)) {
      out.builder = payload.raw.builderDebug.warnings.slice();
    }
    if (isPlainObject(payload.indicators) && Array.isArray(payload.indicators.warnings)) {
      out.indicators = payload.indicators.warnings.slice();
    }
    return out;
  }

  /**
   * component result 표준화.
   * - score는 0~max 사이로 clamp
   * - valid=false이면 score=0
   * - reasons / warnings 배열 보장
   * - max 값 보장
   * - 알 수 없는 키 (grade/tier/label/P-등급) 반환하지 않음
   */
  function normalizeComponentResult(result, max) {
    var maxN = safeNumber(max, 0);
    var r = isPlainObject(result) ? result : {};
    var valid = r.valid === true;
    var raw = safeNumber(r.score, 0);
    var score = valid ? clampScore(raw, 0, maxN) : 0;
    return {
      valid: valid,
      score: score,
      max: maxN,
      reasons: Array.isArray(r.reasons) ? r.reasons.slice() : [],
      warnings: Array.isArray(r.warnings) ? r.warnings.slice() : []
    };
  }

  function makeResult(valid, score, max, reasons, warnings) {
    return normalizeComponentResult({
      valid: valid,
      score: score,
      max: max,
      reasons: reasons || [],
      warnings: warnings || []
    }, max);
  }

  // ==========================================================================
  // §core — 25점 (존재성 / 계약 / 타입 신뢰도) — DP-S8
  // ==========================================================================
  function scoreCore(payload, cfg) {
    var max = cfg.weights.core;
    var score = 0;
    var reasons = [];
    var warnings = [];

    if (!isPlainObject(payload)) {
      return makeResult(false, 0, max, [], ['PAYLOAD_NOT_OBJECT']);
    }
    score += 3;
    reasons.push('PAYLOAD_OBJECT');

    // 13 top-level field 존재 (3)
    var missing = [];
    for (var i = 0; i < TOP_LEVEL_FIELDS.length; i++) {
      if (!(TOP_LEVEL_FIELDS[i] in payload)) missing.push(TOP_LEVEL_FIELDS[i]);
    }
    if (missing.length === 0) {
      score += 3;
      reasons.push('TOP_LEVEL_FIELDS_COMPLETE');
    } else {
      warnings.push('MISSING_FIELDS_' + missing.length);
    }

    // isValid (6) — DP-S8: core는 contract 검증만
    var fpApi = getFeaturePayloadApi();
    if (fpApi && typeof fpApi.isValid === 'function') {
      if (fpApi.isValid(payload) === true) {
        score += 6;
        reasons.push('ISVALID_PASS');
      } else {
        warnings.push('ISVALID_FAIL');
      }
    } else {
      warnings.push('FEATURE_PAYLOAD_API_MISSING');
    }

    // identity.exchange string (2)
    if (isPlainObject(payload.identity) && typeof payload.identity.exchange === 'string' && payload.identity.exchange) {
      score += 2;
      reasons.push('IDENTITY_EXCHANGE_STRING');
    } else {
      warnings.push('IDENTITY_EXCHANGE_MISSING');
    }

    // identity.quote string (2)
    if (isPlainObject(payload.identity) && typeof payload.identity.quote === 'string' && payload.identity.quote) {
      score += 2;
      reasons.push('IDENTITY_QUOTE_STRING');
    } else {
      warnings.push('IDENTITY_QUOTE_MISSING');
    }

    // candles 5 timeframe Array (5 = 1 each)
    var candlesOk = isPlainObject(payload.candles);
    for (var j = 0; j < TIMEFRAMES.length; j++) {
      var tf = TIMEFRAMES[j];
      if (candlesOk && Array.isArray(payload.candles[tf])) {
        score += 1;
        reasons.push('CANDLES_' + tf.toUpperCase() + '_ARRAY');
      } else {
        warnings.push('CANDLES_' + tf.toUpperCase() + '_NOT_ARRAY');
      }
    }

    // buyPressure object 존재 (1) — N-2: object 존재만 검사, .state 점수화 X
    if (isPlainObject(payload.buyPressure)) {
      score += 1;
      reasons.push('BUY_PRESSURE_OBJECT');
    } else {
      warnings.push('BUY_PRESSURE_MISSING');
    }

    // marketContext object 존재 (1) — N-3: object 존재만 검사, .state 점수화 X
    if (isPlainObject(payload.marketContext)) {
      score += 1;
      reasons.push('MARKET_CONTEXT_OBJECT');
    } else {
      warnings.push('MARKET_CONTEXT_MISSING');
    }

    // risk object 존재 (1)
    if (isPlainObject(payload.risk)) {
      score += 1;
      reasons.push('RISK_OBJECT');
    } else {
      warnings.push('RISK_MISSING');
    }

    // raw object 존재 (1)
    if (isPlainObject(payload.raw)) {
      score += 1;
      reasons.push('RAW_OBJECT');
    } else {
      warnings.push('RAW_MISSING');
    }

    // sub-signal 합계: 3+3+6+2+2+5+1+1+1+1 = 25

    return makeResult(true, score, max, reasons, warnings);
  }

  // ==========================================================================
  // §structure — 20점 (구조 보조값)
  // ==========================================================================
  function scoreStructure(payload, cfg) {
    var max = cfg.weights.structure;
    var s = isPlainObject(payload) && isPlainObject(payload.structure) ? payload.structure : null;

    if (!s || Object.keys(s).length === 0) {
      return makeResult(false, 0, max, [], ['NO_STRUCTURE_SIGNALS']);
    }

    var score = 0;
    var reasons = [];
    var warnings = [];

    // candleShape valid (3)
    if (isPlainObject(s.candleShape) && s.candleShape.valid === true) {
      score += 3;
      reasons.push('CANDLE_SHAPE_VALID');
    } else {
      warnings.push('CANDLE_SHAPE_INVALID');
    }

    // candleStructure valid (3)
    if (isPlainObject(s.candleStructure) && s.candleStructure.valid === true) {
      score += 3;
      reasons.push('CANDLE_STRUCTURE_VALID');
    } else {
      warnings.push('CANDLE_STRUCTURE_INVALID');
    }

    // structure 내부 sub-signals (12)
    var sub = isPlainObject(s.structure) ? s.structure : null;
    if (sub) {
      // box valid (2)
      if (isPlainObject(sub.box) && sub.box.valid === true) {
        score += 2;
        reasons.push('BOX_VALID');
      }
      // priceZone valid (2)
      if (isPlainObject(sub.priceZone) && sub.priceZone.valid === true) {
        score += 2;
        reasons.push('PRICE_ZONE_VALID');
      }
      // referenceLows valid (2)
      if (isPlainObject(sub.referenceLows) && sub.referenceLows.valid === true) {
        score += 2;
        reasons.push('REFERENCE_LOWS_VALID');
      }
      // sweepReclaim valid (2)
      if (isPlainObject(sub.sweepReclaim) && sub.sweepReclaim.valid === true) {
        score += 2;
        reasons.push('SWEEP_RECLAIM_VALID');
        // candidate 반응 (2 + 2)
        if (sub.sweepReclaim.lowSweepCandidate === true) {
          score += 2;
          reasons.push('LOW_SWEEP_CANDIDATE');
        }
        if (sub.sweepReclaim.reclaimCandidate === true) {
          score += 2;
          reasons.push('RECLAIM_CANDIDATE');
        }
      }
    } else {
      warnings.push('STRUCTURE_SUB_MISSING');
    }

    // candleShape flags 반응 (2 = 1+1)
    if (isPlainObject(s.candleShape) && s.candleShape.valid === true && isPlainObject(s.candleShape.flags)) {
      if (s.candleShape.flags.closeNearHigh === true) {
        score += 1;
        reasons.push('CLOSE_NEAR_HIGH');
      }
      if (s.candleShape.flags.longLowerWick === true) {
        score += 1;
        reasons.push('LONG_LOWER_WICK');
      }
    }

    // sub-signal 합계: 3+3+(2+2+2+2+2+2)+(1+1) = 20

    return makeResult(true, score, max, reasons, warnings);
  }

  // ==========================================================================
  // §volume — 20점 (거래량 / 거래대금)
  // ==========================================================================
  function scoreVolume(payload, cfg) {
    var max = cfg.weights.volume;
    var v = isPlainObject(payload) && isPlainObject(payload.volume) ? payload.volume : null;

    if (!v || Object.keys(v).length === 0) {
      return makeResult(false, 0, max, [], ['NO_VOLUME_SIGNALS']);
    }

    var score = 0;
    var reasons = [];
    var warnings = [];

    // volume.valid (4)
    if (isPlainObject(v.volume) && v.volume.valid === true) {
      score += 4;
      reasons.push('VOLUME_STATS_VALID');

      // volumeState 라벨 가산 (8) — v3-indicators 상태 라벨 그대로 활용
      var stateBonus = { EXTREME: 8, SURGE: 6, RISING: 4, NORMAL: 2, LOW: 0, UNKNOWN: 0 };
      var state = v.volume.volumeState;
      if (typeof state === 'string' && stateBonus[state] !== undefined) {
        score += stateBonus[state];
        reasons.push('VOLUME_STATE_' + state);
      }
    } else {
      warnings.push('VOLUME_STATS_INVALID');
    }

    // volumeAcceleration valid (4)
    if (isPlainObject(v.volumeAcceleration) && v.volumeAcceleration.valid === true) {
      score += 4;
      reasons.push('VOLUME_ACCEL_VALID');
    } else {
      warnings.push('VOLUME_ACCEL_INVALID');
    }

    // tradeValue valid (4) — N-4: v3-indicators 출력 키 그대로 사용
    if (isPlainObject(v.tradeValue) && v.tradeValue.valid === true) {
      score += 4;
      reasons.push('TRADE_VALUE_VALID');
    } else {
      warnings.push('TRADE_VALUE_INVALID');
    }

    // sub-signal 합계: 4+8+4+4 = 20

    return makeResult(true, score, max, reasons, warnings);
  }

  // ==========================================================================
  // §momentum — 15점 (RSI / MFI / OBV / MA) — v3-indicators state 라벨 활용
  // ==========================================================================
  function scoreMomentum(payload, cfg) {
    var max = cfg.weights.momentum;
    var m = isPlainObject(payload) && isPlainObject(payload.momentum) ? payload.momentum : null;

    if (!m || Object.keys(m).length === 0) {
      return makeResult(false, 0, max, [], ['NO_MOMENTUM_SIGNALS']);
    }

    var score = 0;
    var reasons = [];
    var warnings = [];

    // RSI state bonus (4)
    var rsiBonus = {
      STRONG: 4, OVERBOUGHT: 2, NEUTRAL: 1, OVERSOLD: 1, OVERHEATED: 0, UNKNOWN: 0
    };
    if (isPlainObject(m.rsi) && m.rsi.valid === true && typeof m.rsi.state === 'string' && rsiBonus[m.rsi.state] !== undefined) {
      score += rsiBonus[m.rsi.state];
      reasons.push('RSI_' + m.rsi.state);
    } else {
      warnings.push('RSI_INVALID');
    }

    // MFI state bonus (4)
    var mfiBonus = {
      STRONG_BUY_PRESSURE: 4, BUY_PRESSURE: 3, NEUTRAL: 1, LOW: 1, OVERHEATED: 0, UNKNOWN: 0
    };
    if (isPlainObject(m.mfi) && m.mfi.valid === true && typeof m.mfi.state === 'string' && mfiBonus[m.mfi.state] !== undefined) {
      score += mfiBonus[m.mfi.state];
      reasons.push('MFI_' + m.mfi.state);
    } else {
      warnings.push('MFI_INVALID');
    }

    // OBV trend bonus (3)
    var obvBonus = { UP: 3, FLAT: 1, DOWN: 0, UNKNOWN: 0 };
    if (isPlainObject(m.obv) && m.obv.valid === true && typeof m.obv.trend === 'string' && obvBonus[m.obv.trend] !== undefined) {
      score += obvBonus[m.obv.trend];
      reasons.push('OBV_' + m.obv.trend);
    } else {
      warnings.push('OBV_INVALID');
    }

    // MA trendLabel bonus (4)
    var maBonus = {
      MA_BULLISH: 4, MA_ABOVE_MIXED: 2, MA_FLAT: 1, MA_MIXED: 1,
      MA_BELOW_MIXED: 0, MA_BEARISH: 0, MA_UNKNOWN: 0
    };
    if (isPlainObject(m.ma) && m.ma.valid === true && typeof m.ma.trendLabel === 'string' && maBonus[m.ma.trendLabel] !== undefined) {
      score += maBonus[m.ma.trendLabel];
      reasons.push(m.ma.trendLabel);
    } else {
      warnings.push('MA_INVALID');
    }

    // sub-signal 합계: 4+4+3+4 = 15

    return makeResult(true, score, max, reasons, warnings);
  }

  // ==========================================================================
  // §execution — 20점 (setup readiness / 실행 준비도) — DP-S8 분리
  // ==========================================================================
  function scoreExecution(payload, cfg) {
    var max = cfg.weights.execution;

    if (!isPlainObject(payload)) {
      return makeResult(false, 0, max, [], ['PAYLOAD_NOT_OBJECT']);
    }

    var score = 0;
    var reasons = [];
    var warnings = [];
    var exec = cfg.execution;

    // primary timeframe candle 개수 (5)
    var primaryTf = getPrimaryTimeframe(payload);
    var primaryCandles = getPrimaryCandles(payload, primaryTf);
    var count = primaryCandles.length;
    if (count >= exec.candlesFull) {
      score += 5;
      reasons.push('PRIMARY_CANDLES_FULL');
    } else if (count >= exec.candlesHalf) {
      score += 3;
      reasons.push('PRIMARY_CANDLES_HALF');
      warnings.push('PRIMARY_CANDLES_PARTIAL');
    } else if (count >= exec.candlesMinimal) {
      score += 1;
      reasons.push('PRIMARY_CANDLES_MINIMAL');
      warnings.push('PRIMARY_CANDLES_PARTIAL');
    } else {
      warnings.push('PRIMARY_CANDLES_INSUFFICIENT');
    }

    // payload.ts resolved (3)
    if (typeof payload.ts === 'number' && isFinite(payload.ts)) {
      score += 3;
      reasons.push('TS_RESOLVED');
    } else {
      warnings.push('TS_UNRESOLVED');
    }

    // identity market 분해 성공 (3)
    var idOk = isPlainObject(payload.identity)
      && typeof payload.identity.market === 'string' && payload.identity.market
      && typeof payload.identity.base === 'string' && payload.identity.base
      && typeof payload.identity.quote === 'string' && payload.identity.quote;
    if (idOk) {
      score += 3;
      reasons.push('IDENTITY_RESOLVED');
    } else {
      warnings.push('IDENTITY_PARTIAL');
    }

    // candles shape 정상 (3)
    var candlesShapeOk = isPlainObject(payload.candles);
    if (candlesShapeOk) {
      for (var i = 0; i < TIMEFRAMES.length; i++) {
        if (!Array.isArray(payload.candles[TIMEFRAMES[i]])) {
          candlesShapeOk = false;
          break;
        }
      }
    }
    if (candlesShapeOk) {
      score += 3;
      reasons.push('CANDLES_SHAPE_OK');
    } else {
      warnings.push('CANDLES_SHAPE_BAD');
    }

    // builderDebug warnings 개수 (3)
    var pw = collectPayloadWarnings(payload);
    var builderWarnCount = pw.builder.length;
    var hasBuilderDebug = isPlainObject(payload.raw)
      && isPlainObject(payload.raw.builderDebug)
      && Array.isArray(payload.raw.builderDebug.warnings);
    if (hasBuilderDebug) {
      if (builderWarnCount === 0) {
        score += 3;
        reasons.push('BUILDER_NO_WARNINGS');
      } else {
        score += 1;
        reasons.push('BUILDER_HAS_WARNINGS');
        warnings.push('BUILDER_WARNINGS_' + builderWarnCount);
      }
    } else {
      warnings.push('BUILDER_DEBUG_MISSING');
    }

    // indicator snapshot warnings 개수 (3)
    var indWarnCount = pw.indicators.length;
    var snapshotValid = isPlainObject(payload.indicators) && payload.indicators.snapshotValid === true;
    if (snapshotValid && indWarnCount === 0) {
      score += 3;
      reasons.push('INDICATORS_NO_WARNINGS');
    } else if (snapshotValid) {
      score += 1;
      reasons.push('INDICATORS_PARTIAL');
      warnings.push('INDICATORS_WARNINGS_' + indWarnCount);
    } else {
      warnings.push('INDICATORS_SNAPSHOT_INVALID');
    }

    // sub-signal 합계: 5+3+3+3+3+3 = 20

    return makeResult(true, score, max, reasons, warnings);
  }

  // ==========================================================================
  // §riskPenalty — 최대 15점 (DP-S4 / N-5)
  // ==========================================================================
  function calculateRiskPenalty(payload, cfg) {
    var max = cfg.risk.maxPenalty;
    var penalty = 0;
    var reasons = [];
    var warnings = [];

    if (!isPlainObject(payload)) {
      return {
        penalty: 0,
        maxPenalty: max,
        reasons: [],
        warnings: ['PAYLOAD_NOT_OBJECT']
      };
    }

    var r = payload.risk;
    var hasRisk = isPlainObject(r);

    if (!hasRisk) {
      warnings.push('RISK_OBJECT_MISSING');
    } else {
      var isDefault = r.penalty === null
        && r.level === 'UNKNOWN'
        && Array.isArray(r.flags) && r.flags.length === 0;

      if (isDefault) {
        // DP-S4: default → penalty 0
        reasons.push('RISK_DEFAULT');
      } else {
        // level
        if (r.level === 'HIGH') {
          penalty += cfg.risk.levelHigh;
          reasons.push('RISK_LEVEL_HIGH');
        } else if (r.level === 'MID') {
          penalty += cfg.risk.levelMid;
          reasons.push('RISK_LEVEL_MID');
        }
        // flags
        if (Array.isArray(r.flags) && r.flags.length > 0) {
          var flagPenalty = Math.min(r.flags.length, cfg.risk.flagsCap);
          penalty += flagPenalty;
          reasons.push('RISK_FLAGS_' + r.flags.length);
        }
        // override penalty
        if (typeof r.penalty === 'number' && isFinite(r.penalty) && r.penalty > 0) {
          var override = Math.min(r.penalty, cfg.risk.overrideCap);
          penalty += override;
          reasons.push('RISK_OVERRIDE_' + r.penalty);
        }
      }
    }

    // builderDebug warnings — N-5
    var pw = collectPayloadWarnings(payload);
    var critWarns = [
      'EMPTY_PRIMARY_CANDLES',
      'INVALID_CANDLES_SHAPE',
      'MISSING_MARKET',
      'INVALID_MARKET_FORMAT',
      'FEATURE_PAYLOAD_API_MISSING',
      'INDICATORS_API_MISSING'
    ];
    var matched = [];
    for (var i = 0; i < pw.builder.length; i++) {
      if (critWarns.indexOf(pw.builder[i]) !== -1) matched.push(pw.builder[i]);
    }
    if (matched.length > 0) {
      var addB = Math.min(matched.length * cfg.risk.builderWarnPerItem, cfg.risk.builderWarnCap);
      penalty += addB;
      for (var j = 0; j < matched.length; j++) {
        reasons.push('BUILDER_WARN_' + matched[j]);
      }
    }

    // indicator warnings — N-5 (경미)
    if (pw.indicators.length > 0) {
      var addI = Math.min(pw.indicators.length * cfg.risk.indicatorWarnPerItem, cfg.risk.indicatorWarnCap);
      penalty += addI;
      reasons.push('INDICATOR_WARNINGS_' + pw.indicators.length);
    }

    penalty = clampScore(penalty, 0, max);

    return {
      penalty: penalty,
      maxPenalty: max,
      reasons: reasons,
      warnings: warnings
    };
  }

  // ==========================================================================
  // §main — buildScoreBreakdown
  // ==========================================================================
  /**
   * payload → scoreBreakdown
   * payload mutate 0건 (DP-S1).
   * 실패 시 throw 없이 safe 결과 반환.
   */
  function buildScoreBreakdown(payload, config) {
    var cfg = mergeScoreConfig(config);

    var componentMaxSum =
      cfg.weights.core + cfg.weights.structure + cfg.weights.volume +
      cfg.weights.momentum + cfg.weights.execution;

    var debugBase = {
      source: 'v3FeaturePayload',
      payloadValid: null,
      componentMaxSum: componentMaxSum,
      configVersion: cfg.version
    };

    var configUsed = {
      weights: {
        core: cfg.weights.core,
        structure: cfg.weights.structure,
        volume: cfg.weights.volume,
        momentum: cfg.weights.momentum,
        execution: cfg.weights.execution
      },
      risk: { maxPenalty: cfg.risk.maxPenalty },
      execution: {
        candlesFull: cfg.execution.candlesFull,
        candlesHalf: cfg.execution.candlesHalf,
        candlesMinimal: cfg.execution.candlesMinimal
      }
    };

    // DP-S9: payload 자체가 객체가 아니면 valid=false 반환 (단, 모든 component shape는 유지)
    if (!isPlainObject(payload)) {
      var emptyCore       = makeResult(false, 0, cfg.weights.core, [], ['PAYLOAD_NOT_OBJECT']);
      var emptyStructure  = makeResult(false, 0, cfg.weights.structure, [], ['PAYLOAD_NOT_OBJECT']);
      var emptyVolume     = makeResult(false, 0, cfg.weights.volume, [], ['PAYLOAD_NOT_OBJECT']);
      var emptyMomentum   = makeResult(false, 0, cfg.weights.momentum, [], ['PAYLOAD_NOT_OBJECT']);
      var emptyExecution  = makeResult(false, 0, cfg.weights.execution, [], ['PAYLOAD_NOT_OBJECT']);
      return {
        valid: false,
        version: SCORE_VERSION,
        grossScore: 0,
        riskPenalty: 0,
        totalScore: 0,
        maxScore: 100,
        components: {
          core: emptyCore,
          structure: emptyStructure,
          volume: emptyVolume,
          momentum: emptyMomentum,
          execution: emptyExecution
        },
        risk: { penalty: 0, maxPenalty: cfg.risk.maxPenalty, reasons: [], warnings: ['PAYLOAD_NOT_OBJECT'] },
        warnings: ['PAYLOAD_NOT_OBJECT'],
        debug: {
          source: debugBase.source,
          payloadValid: false,
          componentMaxSum: componentMaxSum,
          configVersion: cfg.version
        },
        configUsed: configUsed
      };
    }

    // payloadValid (display only, builder가 생성한 payload는 isValid 통과 기대)
    var fpApi = getFeaturePayloadApi();
    var payloadValid = null;
    if (fpApi && typeof fpApi.isValid === 'function') {
      payloadValid = fpApi.isValid(payload) === true;
    }

    // DP-S9: 핵심 필드 (identity / candles) 누락 시 valid=false
    var coreMissing = !isPlainObject(payload.identity) || !isPlainObject(payload.candles);

    // Components 계산
    var coreResult       = scoreCore(payload, cfg);
    var structureResult  = scoreStructure(payload, cfg);
    var volumeResult     = scoreVolume(payload, cfg);
    var momentumResult   = scoreMomentum(payload, cfg);
    var executionResult  = scoreExecution(payload, cfg);

    // Risk penalty
    var riskResult = calculateRiskPenalty(payload, cfg);

    // grossScore (component score 합)
    var grossScore =
      coreResult.score + structureResult.score + volumeResult.score +
      momentumResult.score + executionResult.score;

    // riskPenalty clamp
    var riskPenalty = clampScore(riskResult.penalty, 0, cfg.risk.maxPenalty);

    // totalScore = clamp(gross - penalty, 0, maxScore)
    var maxScore = componentMaxSum;
    var totalScore = clampScore(grossScore - riskPenalty, 0, maxScore);

    // top-level warnings 집계 (각 component warning 그대로 펼치지 않고, 핵심만 노출)
    var topWarnings = [];
    if (coreMissing) topWarnings.push('CORE_PAYLOAD_FIELDS_MISSING');
    if (coreResult.warnings.indexOf('FEATURE_PAYLOAD_API_MISSING') !== -1) {
      topWarnings.push('FEATURE_PAYLOAD_API_MISSING');
    }

    // DP-S9: valid 판정 — 계산 가능 여부
    // 단순히 점수가 낮은 건 valid=true.
    // identity/candles 핵심 필드 누락은 valid=false.
    var valid = !coreMissing;

    return {
      valid: valid,
      version: SCORE_VERSION,
      grossScore: grossScore,
      riskPenalty: riskPenalty,
      totalScore: totalScore,
      maxScore: maxScore,
      components: {
        core: coreResult,
        structure: structureResult,
        volume: volumeResult,
        momentum: momentumResult,
        execution: executionResult
      },
      risk: {
        penalty: riskPenalty,
        maxPenalty: cfg.risk.maxPenalty,
        reasons: riskResult.reasons.slice(),
        warnings: riskResult.warnings.slice()
      },
      warnings: topWarnings,
      debug: {
        source: 'v3FeaturePayload',
        payloadValid: payloadValid,
        componentMaxSum: componentMaxSum,
        configVersion: cfg.version
      },
      configUsed: configUsed
    };
  }

  // ==========================================================================
  // §export — 이중 환경
  // ==========================================================================
  var api = Object.freeze({
    SCORE_VERSION: SCORE_VERSION,
    CONFIG_VERSION: CONFIG_VERSION,
    DEFAULT_SCORE_CONFIG: DEFAULT_SCORE_CONFIG,
    TIMEFRAMES: TIMEFRAMES,
    DEFAULT_PRIMARY_TIMEFRAME: DEFAULT_PRIMARY_TIMEFRAME,

    build: buildScoreBreakdown,
    mergeScoreConfig: mergeScoreConfig,

    scoreCore: scoreCore,
    scoreStructure: scoreStructure,
    scoreVolume: scoreVolume,
    scoreMomentum: scoreMomentum,
    scoreExecution: scoreExecution,
    calculateRiskPenalty: calculateRiskPenalty,

    // helper
    clampScore: clampScore,
    safeNumber: safeNumber,
    isPlainObject: isPlainObject,
    collectPayloadWarnings: collectPayloadWarnings,
    getPrimaryTimeframe: getPrimaryTimeframe,
    getPrimaryCandles: getPrimaryCandles,
    normalizeComponentResult: normalizeComponentResult
  });

  global.WS3_ScoreBreakdown = api;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis
   : typeof window !== 'undefined' ? window
   : typeof self !== 'undefined' ? self
   : this);
