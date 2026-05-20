// ════════════════════════════════════════════════════════════════════════
// WS3 v3 module inline bundle (v0.34.0-r1 P0-v1.1)
//
// 본 블록 = v3/*.js 9개 본문을 worker 진입점 globalThis 에 등록.
// 원본 박제: v3/v3-config.js, v3-feature-payload.js, v3-feature-payload-builder.js,
//             v3-indicators.js, v3-score-breakdown.js, v3-structure-bucket.js,
//             v3-signal-cycle.js, v3-strategy-plan.js, v3-card-view-model.js
//
// 각 모듈은 IIFE 로 wrap 되어 있고, Cloudflare Workers 의 globalThis 에 다음 키를 등록:
//   WS3_CONFIG, WS3_FeaturePayload, WS3_FeaturePayload_Builder, WS3Indicators,
//   WS3_ScoreBreakdown, WS3_StructureBucket, WS3_SignalCycle, WS3_StrategyPlan,
//   WS3_CardViewModel
//
// 정책 (메모리 #25 박제):
//   - v3/*.js 원본은 절대 수정 금지. 본 inline 은 paste-only.
//   - 본 블록 안 수정 = 원본 v3/*.js 동기화 필수 (별도 PR).
//   - 본 블록 마커 (@v3-inline-start / @v3-inline-end) 변경 금지.
// ════════════════════════════════════════════════════════════════════════
/* @v3-inline-start */
/**
 * WS3 v0.1.0 · 초기 골격
 * Scope: config / enum / display mapping only.
 * No fetch, scan, score, structure, UI, Telegram, snapshot, or Worker logic.
 */
(function(global){
  'use strict';

  var WS3_VERSION       = 'WS3 v0.1.0';
  var WS3_VERSION_LABEL = '초기 골격';

  var WS3_EXCHANGES = {
    ENABLE_BITHUMB: true,
    ENABLE_UPBIT:   false,
    ENABLE_BINANCE: false
  };

  var WS3_SCAN = {
    LIMIT_BITHUMB: 30,
    CANDLE_COUNTS: { m5: null, m15: null, h1: 100, h4: null, d1: null },
    MIN_RECORD_SCORE:          0,
    MIN_CANDIDATE_SCORE:       40,
    MIN_C_GRADE_SCORE:         40,
    MIN_TELEGRAM_POLICY_SCORE: 60
  };

  var WS3_WEIGHTS = {
    CORE:             25,
    STRUCTURE:        20,
    VOLUME_SUPPLY:    20,
    MOMENTUM:         15,
    EXECUTION:        20,
    RISK_PENALTY_MAX: 15
  };

  var WS3_GRADE_BANDS = {
    S_PLUS: { code: 'S+',   min: 90, maxExclusive: 101 },
    S:      { code: 'S',    min: 82, maxExclusive: 90  },
    A:      { code: 'A',    min: 72, maxExclusive: 82  },
    B:      { code: 'B',    min: 60, maxExclusive: 72  },
    C:      { code: 'C',    min: 40, maxExclusive: 60  },
    NONE:   { code: 'NONE', min: 0,  maxExclusive: 40, label: '등급없음' }
  };

  var WS3_STRUCTURE_BUCKET = {
    BOX_PRESSURE:      'BOX_PRESSURE',
    BOX_BREAKOUT:      'BOX_BREAKOUT',
    OB_RECLAIM:        'OB_RECLAIM',
    LOW_SWEEP_RECLAIM: 'LOW_SWEEP_RECLAIM',
    MA_RECLAIM:        'MA_RECLAIM'
  };

  var WS3_SIGNAL_PERSISTENCE = {
    SINGLE:        'single',
    REPEAT:        'repeat',
    STRONG_REPEAT: 'strong_repeat',
    HOT_CYCLE:     'hot_cycle'
  };

  var WS3_SIGNAL_LABELS = {
    LIQ_REACTION:  'LIQ_REACTION',
    ABSORPTION:    'ABSORPTION',
    LATE_CHASE:    'LATE_CHASE',
    SELL_PRESSURE: 'SELL_PRESSURE'
  };

  var WS3_STRATEGY_BIAS = {
    SCALP:       'SCALP',
    SWING:       'SWING',
    SCALP_SWING: 'SCALP_SWING',
    WATCH:       'WATCH',
    AVOID:       'AVOID'
  };

  var WS3_EXIT_STRATEGIES = { A: 'EXIT_A', B: 'EXIT_B', C: 'EXIT_C', D: 'EXIT_D', E: 'EXIT_E', F: 'EXIT_F' };

  var WS3_MARKET_CONTEXT = {
    UNKNOWN:        'UNKNOWN',
    BTC_UP:         'BTC_UP',
    BTC_DOWN:       'BTC_DOWN',
    BTC_SIDEWAYS:   'BTC_SIDEWAYS',
    ALT_STRONG:     'ALT_STRONG',
    MARKET_NEUTRAL: 'MARKET_NEUTRAL',
    RISK_OFF:       'RISK_OFF'
  };

  var WS3_BUY_PRESSURE = {
    UNKNOWN: 'BUY_PRESSURE_UNKNOWN',
    STRONG:  'BUY_PRESSURE_STRONG',
    MEDIUM:  'BUY_PRESSURE_MEDIUM',
    WEAK:    'BUY_PRESSURE_WEAK',
    NONE:    'BUY_PRESSURE_NONE'
  };

  var WS3_RISK_LEVEL = { UNKNOWN: 'UNKNOWN', LOW: 'LOW', MID: 'MID', HIGH: 'HIGH' };

  var WS3_DISPLAY = {
    grade: { S_PLUS: 'S+', 'S+': 'S+', S: 'S', A: 'A', B: 'B', C: 'C', NONE: '등급없음' },
    structure: {
      BOX_PRESSURE: '박스압박', BOX_BREAKOUT: '박스돌파', OB_RECLAIM: 'OB회복',
      LOW_SWEEP_RECLAIM: '저점회복', MA_RECLAIM: 'MA회복'
    },
    signalPersistence: { single: '단일', repeat: '반복', strong_repeat: '강한반복', hot_cycle: '핫사이클' },
    signalLabel: { LIQ_REACTION: '수급반응', ABSORPTION: '흡수', LATE_CHASE: '추격주의', SELL_PRESSURE: '매도압' },
    strategyBias: { SCALP: '단타', SWING: '스윙', SCALP_SWING: '단타→스윙', WATCH: '관찰', AVOID: '회피' },
    exitStrategy: { EXIT_A: '매도전략 A', EXIT_B: '매도전략 B', EXIT_C: '매도전략 C', EXIT_D: '매도전략 D', EXIT_E: '매도전략 E', EXIT_F: '매도전략 F' },
    marketContext: { UNKNOWN: '시장미확인', BTC_UP: 'BTC상승', BTC_DOWN: 'BTC하락', BTC_SIDEWAYS: 'BTC횡보', ALT_STRONG: '알트강세', MARKET_NEUTRAL: '시장중립', RISK_OFF: '위험회피' },
    buyPressure: { BUY_PRESSURE_UNKNOWN: '매수세 미확인', BUY_PRESSURE_STRONG: '매수세 강', BUY_PRESSURE_MEDIUM: '매수세 중', BUY_PRESSURE_WEAK: '매수세 약', BUY_PRESSURE_NONE: '매수세 없음' },
    riskLevel: { UNKNOWN: '위험미확인', LOW: '위험 낮음', MID: '위험 보통', HIGH: '위험 높음' },
    exchange: { BITHUMB: '빗썸', UPBIT: '업비트', BINANCE: '바이낸스' }
  };

  function ws3Display(category, id) {
    var bucket = WS3_DISPLAY[category];
    if (!bucket || !bucket[id]) return id;
    if (category === 'grade') return bucket[id];
    return bucket[id] + '(' + id + ')';
  }

  var WS3_HEADER_SLOT_PRIORITY = ['grade','strategyBias','structure','signalPersistence','marketContext','buyPressure','riskMeta','detectedTime'];
  var WS3_HEADER_SLOT_DISPLAY = { mobileMax: 5, desktopMax: 7, alwaysShow: ['grade', 'strategyBias', 'structure'] };

  global.WS3_CONFIG = Object.freeze({
    VERSION: WS3_VERSION,
    VERSION_LABEL: WS3_VERSION_LABEL,
    EXCHANGES: WS3_EXCHANGES,
    SCAN: WS3_SCAN,
    WEIGHTS: WS3_WEIGHTS,
    GRADE_BANDS: WS3_GRADE_BANDS,
    STRUCTURE_BUCKET: WS3_STRUCTURE_BUCKET,
    SIGNAL_PERSISTENCE: WS3_SIGNAL_PERSISTENCE,
    SIGNAL_LABELS: WS3_SIGNAL_LABELS,
    STRATEGY_BIAS: WS3_STRATEGY_BIAS,
    EXIT_STRATEGIES: WS3_EXIT_STRATEGIES,
    MARKET_CONTEXT: WS3_MARKET_CONTEXT,
    BUY_PRESSURE: WS3_BUY_PRESSURE,
    RISK_LEVEL: WS3_RISK_LEVEL,
    DISPLAY: WS3_DISPLAY,
    display: ws3Display,
    HEADER_SLOT_PRIORITY: WS3_HEADER_SLOT_PRIORITY,
    HEADER_SLOT_DISPLAY: WS3_HEADER_SLOT_DISPLAY
  });
})(typeof window !== 'undefined' ? window : globalThis);
/**
 * WS3 v0.1.0 · 초기 골격
 * Scope: V3FeaturePayload typedef / empty factory / validator / unimplemented builder only.
 * No fetch, scan, score, structure, UI, Telegram, snapshot, or Worker logic.
 */
(function(global){
  'use strict';

  /**
   * @typedef {Object} V3Candle
   * @property {number} ts
   * @property {number} open
   * @property {number} high
   * @property {number} low
   * @property {number} close
   * @property {number} volume
   * @property {number|null} tradeValue
   */

  /**
   * @typedef {Object} V3FeaturePayload
   * @property {Object} identity
   * @property {string|null} identity.base
   * @property {string} identity.quote
   * @property {string|null} identity.market
   * @property {string} identity.exchange
   * @property {string|null} identity.displayName
   * @property {number|null} ts
   * @property {Object} candles
   * @property {Array<V3Candle>} candles.m5
   * @property {Array<V3Candle>} candles.m15
   * @property {Array<V3Candle>} candles.h1
   * @property {Array<V3Candle>} candles.h4
   * @property {Array<V3Candle>} candles.d1
   * @property {Object} indicators
   * @property {Object} structure
   * @property {Object} volume
   * @property {Object} momentum
   * @property {Object} marketContext
   * @property {string} marketContext.state
   * @property {Object} buyPressure
   * @property {string} buyPressure.state
   * @property {Object|null} coinMeta
   * @property {Object|null} newsContext
   * @property {Object} risk
   * @property {number|null} risk.penalty
   * @property {string} risk.level
   * @property {Array<string>} risk.flags
   * @property {Object} raw
   */

  function createEmptyFeaturePayload() {
    return {
      identity: { base: null, quote: 'KRW', market: null, exchange: 'BITHUMB', displayName: null },
      ts: null,
      candles: { m5: [], m15: [], h1: [], h4: [], d1: [] },
      indicators: {},
      structure: {},
      volume: {},
      momentum: {},
      marketContext: { state: 'UNKNOWN' },
      buyPressure: { state: 'BUY_PRESSURE_UNKNOWN' },
      coinMeta: null,
      newsContext: null,
      risk: { penalty: null, level: 'UNKNOWN', flags: [] },
      raw: {}
    };
  }

  function buildFeaturePayload(candles, marketCtx) {
    throw new Error('Not implemented yet — WS3 v0.2.0-c 예정');
  }

  function isValidPayload(p) {
    if (!p || typeof p !== 'object') return false;
    if (!p.identity || typeof p.identity !== 'object') return false;
    if (typeof p.identity.exchange !== 'string') return false;
    if (typeof p.identity.quote !== 'string') return false;
    if (!p.candles || typeof p.candles !== 'object') return false;

    var tfs = ['m5', 'm15', 'h1', 'h4', 'd1'];
    for (var i = 0; i < tfs.length; i++) {
      if (!Array.isArray(p.candles[tfs[i]])) return false;
    }

    var required = ['indicators','structure','volume','momentum','marketContext','buyPressure','risk','raw'];
    for (var j = 0; j < required.length; j++) {
      if (typeof p[required[j]] !== 'object' || p[required[j]] === null) return false;
    }

    if (typeof p.marketContext.state !== 'string') return false;
    if (typeof p.buyPressure.state !== 'string') return false;
    if (!Array.isArray(p.risk.flags)) return false;
    if (typeof p.risk.level !== 'string') return false;
    return true;
  }

  global.WS3_FeaturePayload = Object.freeze({
    createEmpty: createEmptyFeaturePayload,
    build: buildFeaturePayload,
    isValid: isValidPayload
  });
})(typeof window !== 'undefined' ? window : globalThis);
/**
 * WS3 v0.2.0-c-r1 — buildFeaturePayload Builder
 *
 * Scope:
 *   normalized candles (5 timeframe 객체)
 *   + V3BuildMarketCtx
 *   → V3FeaturePayload (13 top-level field, WS3_FeaturePayload.isValid 통과)
 *
 * 단일 기준 문서:
 *   docs/ws3/WS3_CODE_CONTRACT.md (b-r2 박제본)
 *   - createEmpty default (§1.2)
 *   - isValid 통과 조건 (§7)
 *
 * 확정 DP 정책 (Gate 1 + GPT 검토 + 사용자 승인):
 *   DP-1 ts:          marketCtx.ts > primary candle.ts > null. 런타임 clock API 사용 금지.
 *   DP-2 tradeValue:  canonical 'tradeValue'만 외부 노출. alias(value/amount/quoteVolume) 금지.
 *                     indicators.tradeValue 내부 통계 키는 v3-indicators.js 결과 그대로 보존.
 *   DP-3 배치:        별도 파일 신규. v3-feature-payload.js 미수정 (build 함수 throw 유지).
 *   DP-4 validator:   현행 유지. builder가 createEmpty 기반으로 13개 key 보장.
 *   DP-5 identity:    normalizeIdentity helper. 'KRW-BTC' → quote='KRW' / base='BTC' 분해.
 *                     분해 실패 시 throw 없이 createEmpty default 유지 + warning 기록.
 *   DP-6 marketCtx:   V3BuildMarketCtx typedef. 안전 정규화 (throw 없이 fallback).
 *   DP-7 raw.builderDebug: 디버그 보조 구조. score/grade/signalCycle/Telegram 판단에 사용 금지.
 *   U-2  candles 입력: V3BuildCandlesInput { m5, m15, h1, h4, d1 } 객체. 단일 배열 X.
 *
 * 금지 (이번 단계):
 *   scoreBreakdown / grade / signalCycle / structureBucket 최종 판정 /
 *   strategyBias 로직 / entryPlan / exitPlan / renderer / cardViewModel /
 *   externalConfluence / Telegram / UI / buyPressure 계산.
 *   fetch 직접 호출 / DOM 접근 / 브라우저 storage 접근 / KV 접근 / 런타임 clock API 사용.
 *
 * 의존:
 *   global.WS3_FeaturePayload  (v3-feature-payload.js — createEmpty / isValid)
 *   global.WS3Indicators       (v3-indicators.js     — buildIndicatorSnapshot)
 *
 * 참고 사실 (b-r2 박제):
 *   v3-bithumb-client.js market 형식: 'KRW-BTC' (QUOTE-BASE).
 *   v3-candle-normalizer.js canonical: { ts, open, high, low, close, volume, tradeValue }.
 *   v3-indicators.buildIndicatorSnapshot 반환: { valid, indicators, warnings, debug }.
 *     indicators 내부 11 key: rsi / mfi / obv / atr / ma / volume / volumeAcceleration /
 *                             tradeValue / candleShape / candleStructure / structure.
 */

(function (global) {
  'use strict';

  var BUILDER_VERSION = 'WS3_v0.2.0-c-r1';
  var DEFAULT_PRIMARY_TIMEFRAME = 'h1';
  var TIMEFRAMES = ['m5', 'm15', 'h1', 'h4', 'd1'];

  // ==========================================================================
  // typedef — DP-6 / U-2
  // ==========================================================================
  /**
   * @typedef {Object} V3BuildMarketCtx
   * @property {string}              [market]          예: 'KRW-BTC'
   * @property {string|null}         [exchange]        예: 'BITHUMB'
   * @property {string|null}         [base]            예: 'BTC' (없으면 market에서 분해)
   * @property {string|null}         [quote]           예: 'KRW' (없으면 market에서 분해)
   * @property {string|null}         [displayName]
   * @property {number|null}         [ts]              explicit ts (DP-1 우선순위 1)
   * @property {string}              [timeframe]       primary timeframe, default 'h1'
   * @property {Object|null}         [coinMeta]
   * @property {Object|null}         [newsContext]
   * @property {Object|null}         [riskOverride]    { penalty?, level?, flags? }
   * @property {Object|null}         [indicatorConfig] WS3Indicators 호출용 config
   */

  /**
   * @typedef {Object} V3BuildCandlesInput
   * @property {Array<Object>} [m5]
   * @property {Array<Object>} [m15]
   * @property {Array<Object>} [h1]
   * @property {Array<Object>} [h4]
   * @property {Array<Object>} [d1]
   */

  // ==========================================================================
  // §helper — 외부 의존 모듈 접근
  // ==========================================================================
  function getFeaturePayloadApi() {
    if (global && global.WS3_FeaturePayload) return global.WS3_FeaturePayload;
    if (typeof globalThis !== 'undefined' && globalThis.WS3_FeaturePayload) return globalThis.WS3_FeaturePayload;
    return null;
  }

  function getIndicatorsApi() {
    if (global && global.WS3Indicators) return global.WS3Indicators;
    if (typeof globalThis !== 'undefined' && globalThis.WS3Indicators) return globalThis.WS3Indicators;
    return null;
  }

  function pushWarning(builderDebug, code) {
    if (!builderDebug || !Array.isArray(builderDebug.warnings)) return;
    if (typeof code !== 'string' || !code) return;
    if (builderDebug.warnings.indexOf(code) === -1) {
      builderDebug.warnings.push(code);
    }
  }

  // ==========================================================================
  // §DP-5 — normalizeIdentity
  // ==========================================================================
  /**
   * identity 정규화. createEmpty default를 base로, marketCtx 입력으로 override.
   * - market 'KRW-BTC' → quote='KRW', base='BTC' 분해
   * - market 누락 시 throw 없이 createEmpty default 유지 + 'MISSING_MARKET' warning
   * - market 형식 이상 시 throw 없이 'INVALID_MARKET_FORMAT' warning
   *
   * @param {Object} createEmptyIdentity  WS3_FeaturePayload.createEmpty().identity
   * @param {Object} input                marketCtx에서 추출한 5-field 후보
   * @param {Object} builderDebug         warnings 기록용
   * @return {Object}                     정규화된 identity 5-field
   */
  function normalizeIdentity(createEmptyIdentity, input, builderDebug) {
    var src = input || {};
    var identity = {
      base: createEmptyIdentity.base,
      quote: createEmptyIdentity.quote,
      market: createEmptyIdentity.market,
      exchange: createEmptyIdentity.exchange,
      displayName: createEmptyIdentity.displayName
    };

    // exchange — input 우선
    if (typeof src.exchange === 'string' && src.exchange) {
      identity.exchange = src.exchange;
    }

    // market 분해
    var market = (typeof src.market === 'string' && src.market) ? src.market : null;
    if (market) {
      identity.market = market;
      if (market.indexOf('-') > 0) {
        var parts = market.split('-');
        if (parts.length === 2 && parts[0] && parts[1]) {
          if (!src.quote) identity.quote = parts[0];
          if (!src.base) identity.base = parts[1];
        } else {
          pushWarning(builderDebug, 'INVALID_MARKET_FORMAT');
        }
      } else {
        pushWarning(builderDebug, 'INVALID_MARKET_FORMAT');
      }
    } else {
      pushWarning(builderDebug, 'MISSING_MARKET');
    }

    // base / quote — input 명시 override
    if (typeof src.base === 'string' && src.base) identity.base = src.base;
    if (typeof src.quote === 'string' && src.quote) identity.quote = src.quote;

    // displayName — input > base > createEmpty default
    if (typeof src.displayName === 'string' && src.displayName) {
      identity.displayName = src.displayName;
    } else if (typeof identity.base === 'string' && identity.base) {
      identity.displayName = identity.base;
    }

    return identity;
  }

  // ==========================================================================
  // §U-2 — normalizeCandlesInput (V3BuildCandlesInput)
  // ==========================================================================
  /**
   * candles 입력 정규화. { m5, m15, h1, h4, d1 } 객체만 허용.
   * - 단일 배열 / 비객체 입력 → 'INVALID_CANDLES_SHAPE' warning + 5 timeframe 빈 배열
   * - 누락 timeframe → 빈 배열 fallback
   *
   * @param {V3BuildCandlesInput} input
   * @param {Object}              builderDebug
   * @return {Object}             { m5, m15, h1, h4, d1 } 5 key 모두 Array
   */
  function normalizeCandlesInput(input, builderDebug) {
    var result = { m5: [], m15: [], h1: [], h4: [], d1: [] };

    if (Array.isArray(input)) {
      pushWarning(builderDebug, 'INVALID_CANDLES_SHAPE');
      return result;
    }
    if (!input || typeof input !== 'object') {
      pushWarning(builderDebug, 'INVALID_CANDLES_SHAPE');
      return result;
    }

    for (var i = 0; i < TIMEFRAMES.length; i++) {
      var tf = TIMEFRAMES[i];
      if (Array.isArray(input[tf])) {
        result[tf] = input[tf];
      }
    }
    return result;
  }

  // ==========================================================================
  // §DP-1 — resolveTs
  // ==========================================================================
  /**
   * ts 결정. 런타임 clock API 사용 금지.
   * 우선순위:
   *   1. marketCtx.ts (number, finite)
   *   2. primary timeframe 마지막 candle.ts
   *   3. null
   *
   * @param {Object} candles
   * @param {string} primaryTimeframe
   * @param {Object} marketCtx
   * @param {Object} builderDebug
   * @return {{ ts: (number|null), source: (string|null) }}
   */
  function resolveTs(candles, primaryTimeframe, marketCtx, builderDebug) {
    var src = marketCtx || {};

    // 1) explicit
    if (typeof src.ts === 'number' && isFinite(src.ts)) {
      return { ts: src.ts, source: 'marketCtx.ts' };
    }

    // 2) primary timeframe last candle ts
    var arr = (candles && Array.isArray(candles[primaryTimeframe])) ? candles[primaryTimeframe] : null;
    if (arr && arr.length > 0) {
      var last = arr[arr.length - 1];
      if (last && typeof last.ts === 'number' && isFinite(last.ts)) {
        return { ts: last.ts, source: 'primary.last.ts' };
      }
    } else {
      pushWarning(builderDebug, 'EMPTY_PRIMARY_CANDLES');
    }

    // 3) null
    return { ts: null, source: null };
  }

  // ==========================================================================
  // §indicator snapshot 매핑
  // ==========================================================================
  /**
   * indicator snapshot → payload slot 분리 매핑.
   *
   * 매핑:
   *   payload.momentum   ← rsi / mfi / obv / ma
   *   payload.volume     ← volume / volumeAcceleration / tradeValue
   *                        (indicators 내부 통계 키 그대로 — DP-2 U-1 참고)
   *   payload.structure  ← candleShape / candleStructure / structure
   *   payload.indicators ← atr / snapshotValid / warnings / debug / indicatorVersion
   *
   * @param {Object} snapshot  WS3Indicators.buildIndicatorSnapshot 반환
   * @return {{momentum: Object, volume: Object, structure: Object, indicators: Object}}
   */
  function mapIndicatorSnapshot(snapshot) {
    var snap = snapshot || {};
    var ind = (snap.indicators && typeof snap.indicators === 'object') ? snap.indicators : {};
    var debug = (snap.debug && typeof snap.debug === 'object') ? snap.debug : {};

    var momentum = {};
    if (ind.rsi) momentum.rsi = ind.rsi;
    if (ind.mfi) momentum.mfi = ind.mfi;
    if (ind.obv) momentum.obv = ind.obv;
    if (ind.ma)  momentum.ma  = ind.ma;

    var volume = {};
    if (ind.volume)             volume.volume = ind.volume;
    if (ind.volumeAcceleration) volume.volumeAcceleration = ind.volumeAcceleration;
    if (ind.tradeValue)         volume.tradeValue = ind.tradeValue;

    var structure = {};
    if (ind.candleShape)     structure.candleShape = ind.candleShape;
    if (ind.candleStructure) structure.candleStructure = ind.candleStructure;
    if (ind.structure)       structure.structure = ind.structure;

    var indicators = {};
    if (ind.atr) indicators.atr = ind.atr;
    indicators.snapshotValid = !!snap.valid;
    indicators.warnings = Array.isArray(snap.warnings) ? snap.warnings.slice() : [];
    indicators.debug = {
      candleCount: typeof debug.candleCount === 'number' ? debug.candleCount : null,
      configVersion: typeof debug.configVersion === 'string' ? debug.configVersion : null
    };
    indicators.indicatorVersion = typeof debug.indicatorVersion === 'string' ? debug.indicatorVersion : null;

    return {
      momentum: momentum,
      volume: volume,
      structure: structure,
      indicators: indicators
    };
  }

  // ==========================================================================
  // §main — buildFeaturePayload
  // ==========================================================================
  /**
   * V3FeaturePayload builder.
   * 반드시 WS3_FeaturePayload.createEmpty() 결과로 시작해 13 top-level field 보장.
   * 실패 시 throw 하지 않고 safe payload + raw.builderDebug.warnings 기록.
   *
   * @param {V3BuildCandlesInput} candles
   * @param {V3BuildMarketCtx}    marketCtx
   * @return {Object}             V3FeaturePayload
   */
  function buildFeaturePayload(candles, marketCtx) {
    var fpApi = getFeaturePayloadApi();
    var indApi = getIndicatorsApi();

    // 1. createEmpty 기반 시작 (DP-4) — 13 key 보장
    var payload;
    if (fpApi && typeof fpApi.createEmpty === 'function') {
      payload = fpApi.createEmpty();
    } else {
      // defensive fallback — 정상 환경에서는 도달하지 않음
      payload = {
        identity: { base: null, quote: 'KRW', market: null, exchange: 'BITHUMB', displayName: null },
        ts: null,
        candles: { m5: [], m15: [], h1: [], h4: [], d1: [] },
        indicators: {},
        structure: {},
        volume: {},
        momentum: {},
        marketContext: { state: 'UNKNOWN' },
        buyPressure: { state: 'BUY_PRESSURE_UNKNOWN' },
        coinMeta: null,
        newsContext: null,
        risk: { penalty: null, level: 'UNKNOWN', flags: [] },
        raw: {}
      };
    }

    // 2. raw.builderDebug 초기화 (DP-7)
    var ctx = marketCtx || {};
    var primaryTimeframe = (typeof ctx.timeframe === 'string' && ctx.timeframe)
      ? ctx.timeframe
      : DEFAULT_PRIMARY_TIMEFRAME;

    var builderDebug = {
      builderVersion: BUILDER_VERSION,
      warnings: [],
      primaryTimeframe: primaryTimeframe,
      resolvedTsSource: null,
      candleCounts: { m5: 0, m15: 0, h1: 0, h4: 0, d1: 0 },
      identityInput: null
    };

    if (!fpApi) {
      pushWarning(builderDebug, 'FEATURE_PAYLOAD_API_MISSING');
    }

    // 3. candles 5 timeframe 정규화 (U-2)
    var normalizedCandles = normalizeCandlesInput(candles, builderDebug);
    payload.candles = normalizedCandles;
    for (var i = 0; i < TIMEFRAMES.length; i++) {
      var tf = TIMEFRAMES[i];
      builderDebug.candleCounts[tf] = normalizedCandles[tf].length;
    }

    // 4. identity 정규화 (DP-5)
    var identityInput = {
      market: typeof ctx.market === 'string' ? ctx.market : null,
      exchange: typeof ctx.exchange === 'string' ? ctx.exchange : null,
      base: typeof ctx.base === 'string' ? ctx.base : null,
      quote: typeof ctx.quote === 'string' ? ctx.quote : null,
      displayName: typeof ctx.displayName === 'string' ? ctx.displayName : null
    };
    builderDebug.identityInput = {
      market: identityInput.market,
      exchange: identityInput.exchange,
      base: identityInput.base,
      quote: identityInput.quote,
      displayName: identityInput.displayName
    };
    payload.identity = normalizeIdentity(payload.identity, identityInput, builderDebug);

    // 5. ts resolve (DP-1)
    var tsResult = resolveTs(payload.candles, primaryTimeframe, ctx, builderDebug);
    payload.ts = tsResult.ts;
    builderDebug.resolvedTsSource = tsResult.source;

    // 6. indicator snapshot 호출 + slot 분리 매핑
    var primaryCandles = Array.isArray(payload.candles[primaryTimeframe]) ? payload.candles[primaryTimeframe] : [];
    var indicatorConfig = (ctx.indicatorConfig && typeof ctx.indicatorConfig === 'object') ? ctx.indicatorConfig : {};

    if (indApi && typeof indApi.buildIndicatorSnapshot === 'function') {
      var snapshot = indApi.buildIndicatorSnapshot(primaryCandles, indicatorConfig);
      var mapped = mapIndicatorSnapshot(snapshot);
      payload.momentum = mapped.momentum;
      payload.volume = mapped.volume;
      payload.structure = mapped.structure;
      payload.indicators = mapped.indicators;
    } else {
      pushWarning(builderDebug, 'INDICATORS_API_MISSING');
      // createEmpty default ({}) 유지
    }

    // 7. marketContext: createEmpty default 유지 (이번 단계 라벨링 금지)
    // 8. buyPressure:   createEmpty default 유지 ('BUY_PRESSURE_UNKNOWN', 이번 단계 계산 금지)

    // 9. coinMeta / newsContext: marketCtx에 있으면 채움
    if (ctx.coinMeta !== undefined) payload.coinMeta = ctx.coinMeta;
    if (ctx.newsContext !== undefined) payload.newsContext = ctx.newsContext;

    // 10. riskOverride 병합
    if (ctx.riskOverride && typeof ctx.riskOverride === 'object') {
      var ov = ctx.riskOverride;
      payload.risk = {
        penalty: (typeof ov.penalty === 'number' && isFinite(ov.penalty)) ? ov.penalty
                 : (ov.penalty === null ? null : payload.risk.penalty),
        level: typeof ov.level === 'string' ? ov.level : payload.risk.level,
        flags: Array.isArray(ov.flags) ? ov.flags.slice() : payload.risk.flags
      };
    }

    // 11. raw 병합 (createEmpty raw default 보존 + builderDebug 부착)
    var rawDefault = (payload.raw && typeof payload.raw === 'object') ? payload.raw : {};
    payload.raw = Object.assign({}, rawDefault, { builderDebug: builderDebug });

    return payload;
  }

  // ==========================================================================
  // §export — 이중 환경 (global + module.exports)
  // ==========================================================================
  var api = Object.freeze({
    BUILDER_VERSION: BUILDER_VERSION,
    DEFAULT_PRIMARY_TIMEFRAME: DEFAULT_PRIMARY_TIMEFRAME,
    TIMEFRAMES: TIMEFRAMES,
    build: buildFeaturePayload,
    normalizeIdentity: normalizeIdentity,
    normalizeCandlesInput: normalizeCandlesInput,
    resolveTs: resolveTs,
    mapIndicatorSnapshot: mapIndicatorSnapshot
  });

  global.WS3_FeaturePayload_Builder = api;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis
   : typeof window !== 'undefined' ? window
   : typeof self !== 'undefined' ? self
   : this);
/**
 * WS3 v0.2.0-b — V3 Indicator Function Skeleton (Config-Driven)
 *
 * 정규화된 Bithumb candles를 입력으로 받아
 * V3 featurePayload가 사용할 기본 indicator snapshot을 계산한다.
 *
 * 핵심 설계 원칙 (작업지시서 §2):
 *   - MA / EMA / RSI / MFI / OBV / ATR / 거래량 / 캔들구조 기준값은
 *     함수 내부에 고정하지 않고 config override 가능하게 설계
 *   - 함수 내부 곳곳에 임계값 흩뿌리지 않음
 *   - DEFAULT_INDICATOR_CONFIG에 기본값 모음
 *   - 나중에 v3-config.js로 옮기기 쉬운 구조
 *
 * 절대 원칙 (작업지시서 §9):
 *   - 외부 API 호출 / fetch 금지
 *   - DOM / localStorage / KV / Telegram 접근 금지
 *   - UI 렌더링 / 기존 WOOS 상태값 접근 금지
 *   - console spam / 자동 실행 금지
 *   - 실패 시 throw 대신 safe result 반환
 *
 * 미포함 (작업지시서 §12):
 *   externalConfluence / bithumbOfficial / LW / SeoulKIM
 *   Telegram / news / snapshot / marketCap / sector
 *   strategyBias / entryPlan / exitPlan
 *   scoreBreakdown / grade / signalCycle
 *   cardViewModel / renderer
 *
 * 캔들패턴 정책 (작업지시서 §7):
 *   - 전통 캔들패턴명 (도지/망치형/장악형 등) 구현 X
 *   - V3에서 캔들패턴 = structureBucket 판단용 candleStructureFeatures 보조값
 *   - structureBucket 최종 판정은 WS3 v0.4.0에서 다룸
 *
 * 기준 백서: WOOS_Scanner_V3_개발백서_v0_3_3.md
 * Baseline: v3-config.js / v3-feature-payload.js / v3-bithumb-client.js / v3-candle-normalizer.js
 */

(function (global) {
  'use strict';

  const INDICATOR_VERSION = 'WS3_v0.2.0-b';
  const CONFIG_VERSION = 'inline-default-v0';

  // ==========================================================================
  // §8 DEFAULT_INDICATOR_CONFIG — 모든 기준값 집중 관리
  // 함수 내부 하드코딩 금지. config override 가능하게 설계.
  // ==========================================================================

  const DEFAULT_INDICATOR_CONFIG = Object.freeze({
    ma: {
      periods: [10, 20, 50],
      optionalPeriods: [100, 200],
      trendFlatTolerancePct: 0.15
    },
    ema: {
      periods: [12, 26]
    },
    rsi: {
      period: 14,
      oversold: 30,
      neutralLow: 45,
      neutralHigh: 55,
      strong: 60,
      overbought: 70,
      overheated: 80
    },
    mfi: {
      period: 14,
      low: 35,
      neutralLow: 45,
      buyPressure: 60,
      strongBuyPressure: 70,
      overheated: 85
    },
    obv: {
      trendLookback: 10,
      flatTolerancePct: 0.3
    },
    atr: {
      period: 14
    },
    volume: {
      averagePeriod: 20,
      shortPeriod: 5,
      lowRatio: 0.7,
      risingRatio: 1.2,
      surgeRatio: 2.0,
      extremeRatio: 4.0
    },
    tradeValue: {
      averagePeriod: 20
    },
    candleStructure: {
      lookback: 40,
      boxLookback: 40,
      touchTolerancePct: 0.5,
      longWickRatio: 0.45,
      wideRangeMultiplier: 1.8,
      closeTopZone: 0.7,
      closeBottomZone: 0.3,
      sweepTolerancePct: 0.3,
      reclaimClosePosition: 0.5
    }
  });

  /**
   * config override를 default에 안전하게 merge.
   * deep merge는 필요한 수준까지만.
   */
  function mergeIndicatorConfig(config = {}) {
    const c = config || {};
    return {
      ma: { ...DEFAULT_INDICATOR_CONFIG.ma, ...(c.ma || {}) },
      ema: { ...DEFAULT_INDICATOR_CONFIG.ema, ...(c.ema || {}) },
      rsi: { ...DEFAULT_INDICATOR_CONFIG.rsi, ...(c.rsi || {}) },
      mfi: { ...DEFAULT_INDICATOR_CONFIG.mfi, ...(c.mfi || {}) },
      obv: { ...DEFAULT_INDICATOR_CONFIG.obv, ...(c.obv || {}) },
      atr: { ...DEFAULT_INDICATOR_CONFIG.atr, ...(c.atr || {}) },
      volume: { ...DEFAULT_INDICATOR_CONFIG.volume, ...(c.volume || {}) },
      tradeValue: { ...DEFAULT_INDICATOR_CONFIG.tradeValue, ...(c.tradeValue || {}) },
      candleStructure: {
        ...DEFAULT_INDICATOR_CONFIG.candleStructure,
        ...(c.candleStructure || {})
      }
    };
  }

  // ==========================================================================
  // §11.1 Config / 공통 유틸
  // ==========================================================================

  /**
   * 안전한 숫자 변환. 숫자가 아니면 fallback 반환.
   */
  function safeNumber(value, fallback = null) {
    if (value === null || value === undefined) return fallback;
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : fallback;
    }
    if (typeof value === 'string' && value.trim() !== '') {
      const n = Number(value);
      return Number.isFinite(n) ? n : fallback;
    }
    return fallback;
  }

  /**
   * candle 객체에서 필드값을 안전하게 추출.
   * normalizer canonical은 `ts / tradeValue` (v3-candle-normalizer.js 기준).
   * 외부 raw 호환을 위해 fallback 후보 키 지원 (객체/배열 OHLCV 모두 허용).
   * (작업지시서 §5: "필드명이 다르면 indicator 쪽에서 임의 변환하지 말고 helper로 안전하게 읽는다")
   */
  function readCandleField(candle, keys) {
    if (candle === null || candle === undefined) return null;

    // 배열 OHLCV 형태 지원 [ts, open, high, low, close, volume, tradeValue?]
    if (Array.isArray(candle)) {
      const arrayIndexMap = {
        ts: 0, timestamp: 0, t: 0, time: 0,
        open: 1, o: 1,
        high: 2, h: 2,
        low: 3, l: 3,
        close: 4, c: 4,
        volume: 5, v: 5,
        tradeValue: 6, value: 6, quoteVolume: 6
      };
      for (const key of keys) {
        const idx = arrayIndexMap[key];
        if (idx !== undefined && idx < candle.length) {
          const n = safeNumber(candle[idx]);
          if (n !== null) return n;
        }
      }
      return null;
    }

    // 객체 형태
    if (typeof candle !== 'object') return null;
    for (const key of keys) {
      if (candle[key] !== undefined && candle[key] !== null) {
        const n = safeNumber(candle[key]);
        if (n !== null) return n;
      }
    }
    return null;
  }

  function getOpen(candle) {
    return readCandleField(candle, ['open', 'o', 'openPrice']);
  }

  function getHigh(candle) {
    return readCandleField(candle, ['high', 'h', 'highPrice']);
  }

  function getLow(candle) {
    return readCandleField(candle, ['low', 'l', 'lowPrice']);
  }

  function getClose(candle) {
    return readCandleField(candle, ['close', 'c', 'closePrice']);
  }

  function getVolume(candle) {
    return readCandleField(candle, ['volume', 'v', 'baseVolume', 'vol']);
  }

  function getTradeValue(candle) {
    return readCandleField(candle, ['tradeValue', 'value', 'quoteVolume', 'tradeValueKrw', 'amount']);
  }

  function sliceRecent(candles, length) {
    if (!Array.isArray(candles)) return [];
    if (length <= 0) return [];
    if (candles.length <= length) return candles.slice();
    return candles.slice(candles.length - length);
  }

  function hasEnoughCandles(candles, minLength) {
    return Array.isArray(candles) && candles.length >= minLength;
  }

  function calculatePctChange(from, to) {
    const a = safeNumber(from);
    const b = safeNumber(to);
    if (a === null || b === null || a === 0) return null;
    return ((b - a) / a) * 100;
  }

  function calculateAverage(values) {
    if (!Array.isArray(values) || values.length === 0) return null;
    let sum = 0;
    let count = 0;
    for (const v of values) {
      const n = safeNumber(v);
      if (n !== null) {
        sum += n;
        count += 1;
      }
    }
    if (count === 0) return null;
    return sum / count;
  }

  /** candles → close 배열 추출 helper */
  function extractCloses(candles) {
    if (!Array.isArray(candles)) return [];
    const out = [];
    for (const c of candles) {
      const v = getClose(c);
      if (v !== null) out.push(v);
    }
    return out;
  }

  // ==========================================================================
  // §11.2 이동평균 MA / EMA
  // ==========================================================================

  /**
   * 단순 이동평균. 마지막 period 개의 평균.
   * values 배열 (숫자) 또는 candles 배열 모두 허용.
   */
  function calculateSMA(values, period) {
    if (!Array.isArray(values) || values.length < period || period <= 0) {
      return null;
    }
    const slice = values.slice(values.length - period);
    return calculateAverage(slice);
  }

  /**
   * 지수 이동평균. 마지막 값.
   * 표준 EMA 공식: EMA_t = price_t * k + EMA_{t-1} * (1-k), k = 2/(period+1)
   * 초기값은 첫 period 개의 SMA.
   */
  function calculateEMA(values, period) {
    if (!Array.isArray(values) || values.length < period || period <= 0) {
      return null;
    }
    const k = 2 / (period + 1);
    // 시드 SMA
    let ema = calculateAverage(values.slice(0, period));
    if (ema === null) return null;
    for (let i = period; i < values.length; i++) {
      const v = safeNumber(values[i]);
      if (v === null) continue;
      ema = v * k + ema * (1 - k);
    }
    return ema;
  }

  /**
   * MA 상태 종합. config.ma.periods로 기간 수정 가능.
   */
  function calculateMAState(candles, config = {}) {
    const cfg = mergeIndicatorConfig(config);
    const periods = cfg.ma.periods;
    const optionalPeriods = cfg.ma.optionalPeriods;
    const flatTol = cfg.ma.trendFlatTolerancePct;

    const closes = extractCloses(candles);
    if (closes.length === 0) {
      return {
        valid: false,
        reason: 'NOT_ENOUGH_CANDLES',
        configUsed: { periods, optionalPeriods }
      };
    }

    const lastClose = closes[closes.length - 1];

    const values = {};
    const closeAbove = {};

    for (const p of periods) {
      const ma = calculateSMA(closes, p);
      const key = `ma${p}`;
      values[key] = ma;
      closeAbove[key] = (ma !== null) ? (lastClose >= ma) : null;
    }
    for (const p of optionalPeriods) {
      if (closes.length >= p) {
        const ma = calculateSMA(closes, p);
        const key = `ma${p}`;
        values[key] = ma;
        closeAbove[key] = (ma !== null) ? (lastClose >= ma) : null;
      }
    }

    // trendLabel — 상태 라벨 수준. 과도한 판단 X.
    let trendLabel = 'MA_UNKNOWN';
    const main = periods.slice().sort((a, b) => a - b); // 짧은 → 긴
    const orderedMAs = main.map(p => values[`ma${p}`]);
    if (orderedMAs.every(v => v !== null)) {
      const allAscending = orderedMAs.every((v, i, arr) => i === 0 || arr[i - 1] >= v);
      const allDescending = orderedMAs.every((v, i, arr) => i === 0 || arr[i - 1] <= v);
      const aboveAll = main.every(p => closeAbove[`ma${p}`] === true);
      const belowAll = main.every(p => closeAbove[`ma${p}`] === false);

      // flat 판정 (가장 짧은 MA 대비 가장 긴 MA의 차이)
      const shortMA = orderedMAs[0];
      const longMA = orderedMAs[orderedMAs.length - 1];
      const diffPct = shortMA !== 0 ? Math.abs((shortMA - longMA) / shortMA) * 100 : 0;

      if (diffPct < flatTol) {
        trendLabel = 'MA_FLAT';
      } else if (aboveAll && allAscending) {
        trendLabel = 'MA_BULLISH';
      } else if (belowAll && allDescending) {
        trendLabel = 'MA_BEARISH';
      } else if (aboveAll) {
        trendLabel = 'MA_ABOVE_MIXED';
      } else if (belowAll) {
        trendLabel = 'MA_BELOW_MIXED';
      } else {
        trendLabel = 'MA_MIXED';
      }
    }

    return {
      valid: true,
      values,
      closeAbove,
      trendLabel,
      configUsed: {
        periods,
        optionalPeriods,
        trendFlatTolerancePct: flatTol
      }
    };
  }

  // ==========================================================================
  // §11.3 RSI
  // ==========================================================================

  /**
   * RSI (Wilder smoothing).
   * config.rsi.period / oversold / strong / overbought / overheated 수정 가능.
   */
  function calculateRSI(candles, config = {}) {
    const cfg = mergeIndicatorConfig(config);
    const r = cfg.rsi;
    const period = r.period;

    const closes = extractCloses(candles);
    if (closes.length < period + 1) {
      return {
        valid: false,
        value: null,
        state: 'UNKNOWN',
        reason: 'NOT_ENOUGH_CANDLES',
        configUsed: r
      };
    }

    let gainSum = 0;
    let lossSum = 0;
    // 초기 평균
    for (let i = 1; i <= period; i++) {
      const diff = closes[i] - closes[i - 1];
      if (diff >= 0) gainSum += diff;
      else lossSum -= diff;
    }
    let avgGain = gainSum / period;
    let avgLoss = lossSum / period;

    // Wilder smoothing
    for (let i = period + 1; i < closes.length; i++) {
      const diff = closes[i] - closes[i - 1];
      const gain = diff > 0 ? diff : 0;
      const loss = diff < 0 ? -diff : 0;
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
    }

    let rsi;
    if (avgLoss === 0) {
      rsi = 100;
    } else {
      const rs = avgGain / avgLoss;
      rsi = 100 - (100 / (1 + rs));
    }

    let state = 'NEUTRAL';
    if (rsi >= r.overheated) state = 'OVERHEATED';
    else if (rsi >= r.overbought) state = 'OVERBOUGHT';
    else if (rsi >= r.strong) state = 'STRONG';
    else if (rsi <= r.oversold) state = 'OVERSOLD';
    else state = 'NEUTRAL';

    return {
      valid: true,
      value: Math.round(rsi * 100) / 100,
      state,
      configUsed: r
    };
  }

  // ==========================================================================
  // §11.4 MFI
  // ==========================================================================

  /**
   * Money Flow Index.
   * config.mfi.period / low / buyPressure / strongBuyPressure / overheated 수정 가능.
   */
  function calculateMFI(candles, config = {}) {
    const cfg = mergeIndicatorConfig(config);
    const m = cfg.mfi;
    const period = m.period;

    if (!hasEnoughCandles(candles, period + 1)) {
      return {
        valid: false,
        value: null,
        state: 'UNKNOWN',
        reason: 'NOT_ENOUGH_CANDLES',
        configUsed: m
      };
    }

    const recent = sliceRecent(candles, period + 1);
    let positiveFlow = 0;
    let negativeFlow = 0;
    let prevTP = null;

    for (let i = 0; i < recent.length; i++) {
      const h = getHigh(recent[i]);
      const l = getLow(recent[i]);
      const c = getClose(recent[i]);
      const v = getVolume(recent[i]);
      if (h === null || l === null || c === null || v === null) {
        prevTP = null;
        continue;
      }
      const tp = (h + l + c) / 3;
      const rmf = tp * v;
      if (prevTP !== null) {
        if (tp > prevTP) positiveFlow += rmf;
        else if (tp < prevTP) negativeFlow += rmf;
      }
      prevTP = tp;
    }

    let mfi;
    if (negativeFlow === 0) {
      mfi = positiveFlow === 0 ? 50 : 100;
    } else {
      const mfr = positiveFlow / negativeFlow;
      mfi = 100 - (100 / (1 + mfr));
    }

    let state = 'NEUTRAL';
    if (mfi >= m.overheated) state = 'OVERHEATED';
    else if (mfi >= m.strongBuyPressure) state = 'STRONG_BUY_PRESSURE';
    else if (mfi >= m.buyPressure) state = 'BUY_PRESSURE';
    else if (mfi <= m.low) state = 'LOW';
    else state = 'NEUTRAL';

    return {
      valid: true,
      value: Math.round(mfi * 100) / 100,
      state,
      configUsed: m
    };
  }

  // ==========================================================================
  // §11.5 OBV
  // ==========================================================================

  function calculateOBV(candles) {
    if (!Array.isArray(candles) || candles.length < 2) {
      return {
        valid: false,
        series: [],
        last: null,
        reason: 'NOT_ENOUGH_CANDLES'
      };
    }
    const series = [];
    let obv = 0;
    let prevClose = getClose(candles[0]);
    series.push(0);
    for (let i = 1; i < candles.length; i++) {
      const close = getClose(candles[i]);
      const volume = getVolume(candles[i]);
      if (close === null || volume === null || prevClose === null) {
        series.push(obv);
        prevClose = close !== null ? close : prevClose;
        continue;
      }
      if (close > prevClose) obv += volume;
      else if (close < prevClose) obv -= volume;
      // close === prevClose이면 변동 없음
      series.push(obv);
      prevClose = close;
    }
    return {
      valid: true,
      series,
      last: obv
    };
  }

  /**
   * OBV trend. config.obv.trendLookback / flatTolerancePct 수정 가능.
   */
  function calculateOBVTrend(candles, config = {}) {
    const cfg = mergeIndicatorConfig(config);
    const o = cfg.obv;
    const lookback = o.trendLookback;
    const flatTol = o.flatTolerancePct;

    const obvResult = calculateOBV(candles);
    if (!obvResult.valid) {
      return {
        valid: false,
        current: null,
        previous: null,
        trend: 'UNKNOWN',
        reason: obvResult.reason,
        configUsed: o
      };
    }
    const series = obvResult.series;
    if (series.length < lookback + 1) {
      return {
        valid: false,
        current: series[series.length - 1] ?? null,
        previous: null,
        trend: 'UNKNOWN',
        reason: 'NOT_ENOUGH_CANDLES',
        configUsed: o
      };
    }

    const current = series[series.length - 1];
    const previous = series[series.length - 1 - lookback];

    let trend = 'FLAT';
    if (previous === 0) {
      trend = current > 0 ? 'UP' : current < 0 ? 'DOWN' : 'FLAT';
    } else {
      const changePct = Math.abs((current - previous) / Math.abs(previous)) * 100;
      if (changePct < flatTol) {
        trend = 'FLAT';
      } else if (current > previous) {
        trend = 'UP';
      } else if (current < previous) {
        trend = 'DOWN';
      }
    }

    return {
      valid: true,
      current,
      previous,
      trend,
      configUsed: o
    };
  }

  // ==========================================================================
  // §11.6 ATR
  // ==========================================================================

  /**
   * Average True Range (Wilder).
   * config.atr.period 수정 가능.
   * atrPct = (atr / lastClose) * 100
   */
  function calculateATR(candles, config = {}) {
    const cfg = mergeIndicatorConfig(config);
    const a = cfg.atr;
    const period = a.period;

    if (!hasEnoughCandles(candles, period + 1)) {
      return {
        valid: false,
        value: null,
        atrPct: null,
        reason: 'NOT_ENOUGH_CANDLES',
        configUsed: a
      };
    }

    const trs = [];
    for (let i = 1; i < candles.length; i++) {
      const h = getHigh(candles[i]);
      const l = getLow(candles[i]);
      const prevClose = getClose(candles[i - 1]);
      if (h === null || l === null || prevClose === null) {
        trs.push(null);
        continue;
      }
      const tr = Math.max(
        h - l,
        Math.abs(h - prevClose),
        Math.abs(l - prevClose)
      );
      trs.push(tr);
    }
    const validTrs = trs.filter(v => v !== null);
    if (validTrs.length < period) {
      return {
        valid: false,
        value: null,
        atrPct: null,
        reason: 'NOT_ENOUGH_CANDLES',
        configUsed: a
      };
    }

    // 초기 ATR = SMA of first period
    let atr = calculateAverage(validTrs.slice(0, period));
    if (atr === null) {
      return {
        valid: false,
        value: null,
        atrPct: null,
        reason: 'CALC_FAILED',
        configUsed: a
      };
    }
    // Wilder smoothing
    for (let i = period; i < validTrs.length; i++) {
      atr = (atr * (period - 1) + validTrs[i]) / period;
    }

    const lastClose = getClose(candles[candles.length - 1]);
    const atrPct = (lastClose !== null && lastClose !== 0)
      ? (atr / lastClose) * 100
      : null;

    return {
      valid: true,
      value: Math.round(atr * 1000000) / 1000000,
      atrPct: atrPct !== null ? Math.round(atrPct * 100) / 100 : null,
      configUsed: a
    };
  }

  // ==========================================================================
  // §11.7 거래량 / 거래대금
  // ==========================================================================

  function calculateVolumeStats(candles, config = {}) {
    const cfg = mergeIndicatorConfig(config);
    const v = cfg.volume;
    const avgPeriod = v.averagePeriod;

    if (!hasEnoughCandles(candles, avgPeriod + 1)) {
      return {
        valid: false,
        currentVolume: null,
        avgVolume: null,
        volRatio: null,
        volumeState: 'UNKNOWN',
        reason: 'NOT_ENOUGH_CANDLES',
        configUsed: v
      };
    }

    const last = candles[candles.length - 1];
    const currentVolume = getVolume(last);
    // 현재 봉 제외 평균
    const prevSlice = candles.slice(candles.length - 1 - avgPeriod, candles.length - 1);
    const prevVols = prevSlice.map(getVolume).filter(x => x !== null);
    const avgVolume = calculateAverage(prevVols);

    if (currentVolume === null || avgVolume === null || avgVolume === 0) {
      return {
        valid: false,
        currentVolume,
        avgVolume,
        volRatio: null,
        volumeState: 'UNKNOWN',
        reason: 'CALC_FAILED',
        configUsed: v
      };
    }

    const volRatio = currentVolume / avgVolume;
    let volumeState = 'NORMAL';
    if (volRatio >= v.extremeRatio) volumeState = 'EXTREME';
    else if (volRatio >= v.surgeRatio) volumeState = 'SURGE';
    else if (volRatio >= v.risingRatio) volumeState = 'RISING';
    else if (volRatio < v.lowRatio) volumeState = 'LOW';

    return {
      valid: true,
      currentVolume,
      avgVolume,
      volRatio: Math.round(volRatio * 100) / 100,
      volumeState,
      configUsed: {
        averagePeriod: v.averagePeriod,
        lowRatio: v.lowRatio,
        risingRatio: v.risingRatio,
        surgeRatio: v.surgeRatio,
        extremeRatio: v.extremeRatio
      }
    };
  }

  /**
   * 거래량 가속도 = (최근 shortPeriod 평균) / (전체 averagePeriod 평균).
   */
  function calculateVolumeAcceleration(candles, config = {}) {
    const cfg = mergeIndicatorConfig(config);
    const v = cfg.volume;
    const shortP = v.shortPeriod;
    const avgP = v.averagePeriod;

    if (!hasEnoughCandles(candles, avgP)) {
      return {
        valid: false,
        volAccel: null,
        reason: 'NOT_ENOUGH_CANDLES',
        configUsed: v
      };
    }

    const shortVols = sliceRecent(candles, shortP).map(getVolume).filter(x => x !== null);
    const longVols = sliceRecent(candles, avgP).map(getVolume).filter(x => x !== null);
    const shortAvg = calculateAverage(shortVols);
    const longAvg = calculateAverage(longVols);

    if (shortAvg === null || longAvg === null || longAvg === 0) {
      return {
        valid: false,
        volAccel: null,
        reason: 'CALC_FAILED',
        configUsed: v
      };
    }

    const volAccel = shortAvg / longAvg;
    return {
      valid: true,
      volAccel: Math.round(volAccel * 100) / 100,
      shortAvg,
      longAvg,
      configUsed: {
        shortPeriod: v.shortPeriod,
        averagePeriod: v.averagePeriod
      }
    };
  }

  function calculateTradeValueStats(candles, config = {}) {
    const cfg = mergeIndicatorConfig(config);
    const t = cfg.tradeValue;
    const avgPeriod = t.averagePeriod;

    if (!hasEnoughCandles(candles, avgPeriod + 1)) {
      return {
        valid: false,
        currentTradeValueKrw: null,
        avgTradeValueKrw: null,
        tradeValueRatio: null,
        reason: 'NOT_ENOUGH_CANDLES',
        configUsed: t
      };
    }

    const last = candles[candles.length - 1];
    const currentTV = getTradeValue(last);
    const prevSlice = candles.slice(candles.length - 1 - avgPeriod, candles.length - 1);
    const prevTVs = prevSlice.map(getTradeValue).filter(x => x !== null);
    const avgTV = calculateAverage(prevTVs);

    if (currentTV === null || avgTV === null) {
      return {
        valid: false,
        currentTradeValueKrw: currentTV,
        avgTradeValueKrw: avgTV,
        tradeValueRatio: null,
        reason: 'CALC_FAILED',
        configUsed: t
      };
    }

    const ratio = avgTV === 0 ? null : currentTV / avgTV;

    return {
      valid: true,
      currentTradeValueKrw: currentTV,
      avgTradeValueKrw: avgTV,
      tradeValueRatio: ratio !== null ? Math.round(ratio * 100) / 100 : null,
      configUsed: { averagePeriod: t.averagePeriod }
    };
  }

  // ==========================================================================
  // §11.8 캔들 구조 특징 (전통 패턴명 X, candleStructureFeatures O)
  // ==========================================================================

  /**
   * 단일 candle의 모양(구조) 보조값.
   * - body / wick / range / closePosition / direction / flags
   * - 전통 패턴명 (doji/hammer/engulfing 등) X
   */
  function calculateCandleShape(candle, config = {}) {
    const cfg = mergeIndicatorConfig(config);
    const cs = cfg.candleStructure;

    const open = getOpen(candle);
    const high = getHigh(candle);
    const low = getLow(candle);
    const close = getClose(candle);

    if (open === null || high === null || low === null || close === null) {
      return {
        valid: false,
        reason: 'MISSING_OHLC'
      };
    }

    const range = high - low;
    const body = Math.abs(close - open);
    const upperWick = high - Math.max(open, close);
    const lowerWick = Math.min(open, close) - low;

    const bodyPct = range > 0 ? (body / range) * 100 : 0;
    const upperWickPct = range > 0 ? (upperWick / range) * 100 : 0;
    const lowerWickPct = range > 0 ? (lowerWick / range) * 100 : 0;

    // closePosition: close가 range 내 어디에 있는지 (0=low, 1=high)
    const closePosition = range > 0 ? (close - low) / range : 0.5;

    let direction = 'NEUTRAL';
    if (close > open) direction = 'BULLISH';
    else if (close < open) direction = 'BEARISH';

    const flags = {
      longUpperWick: range > 0 && (upperWick / range) >= cs.longWickRatio,
      longLowerWick: range > 0 && (lowerWick / range) >= cs.longWickRatio,
      wideRange: false,  // 단일 candle만으로는 판정 불가. Series에서 채움
      closeNearHigh: closePosition >= cs.closeTopZone,
      closeNearLow: closePosition <= cs.closeBottomZone
    };

    return {
      valid: true,
      open,
      high,
      low,
      close,
      range: Math.round(range * 1000000) / 1000000,
      body: Math.round(body * 1000000) / 1000000,
      bodyPct: Math.round(bodyPct * 100) / 100,
      upperWick: Math.round(upperWick * 1000000) / 1000000,
      lowerWick: Math.round(lowerWick * 1000000) / 1000000,
      upperWickPct: Math.round(upperWickPct * 100) / 100,
      lowerWickPct: Math.round(lowerWickPct * 100) / 100,
      closePosition: Math.round(closePosition * 1000) / 1000,
      direction,
      flags
    };
  }

  /**
   * candle series에서 각 봉의 모양 + wideRange 판정 추가.
   * wideRange = 해당 봉 range >= (평균 range * wideRangeMultiplier)
   */
  function calculateCandleShapeSeries(candles, config = {}) {
    const cfg = mergeIndicatorConfig(config);
    const cs = cfg.candleStructure;

    if (!hasEnoughCandles(candles, 1)) {
      return {
        valid: false,
        shapes: [],
        reason: 'NOT_ENOUGH_CANDLES',
        configUsed: cs
      };
    }

    const lookback = Math.min(cs.lookback, candles.length);
    const recent = sliceRecent(candles, lookback);

    // 각 봉 모양
    const shapes = recent.map(c => calculateCandleShape(c, config));

    // 평균 range
    const ranges = shapes.filter(s => s.valid).map(s => s.range);
    const avgRange = calculateAverage(ranges);

    // wideRange 표식
    if (avgRange !== null && avgRange > 0) {
      for (const s of shapes) {
        if (s.valid && typeof s.range === 'number') {
          s.flags.wideRange = s.range >= avgRange * cs.wideRangeMultiplier;
        }
      }
    }

    return {
      valid: true,
      shapes,
      avgRange: avgRange !== null ? Math.round(avgRange * 1000000) / 1000000 : null,
      configUsed: {
        lookback: cs.lookback,
        wideRangeMultiplier: cs.wideRangeMultiplier,
        longWickRatio: cs.longWickRatio,
        closeTopZone: cs.closeTopZone,
        closeBottomZone: cs.closeBottomZone
      }
    };
  }

  /**
   * 최근 N봉의 캔들 구조 요약. structureBucket 확정이 아니라 보조 통계만.
   */
  function calculateRecentCandleStructure(candles, config = {}) {
    const cfg = mergeIndicatorConfig(config);
    const cs = cfg.candleStructure;
    const lookback = Math.min(cs.lookback, Array.isArray(candles) ? candles.length : 0);

    const series = calculateCandleShapeSeries(sliceRecent(candles, lookback), config);
    if (!series.valid) {
      return {
        valid: false,
        reason: series.reason,
        configUsed: cs
      };
    }

    const validShapes = series.shapes.filter(s => s.valid);
    if (validShapes.length === 0) {
      return {
        valid: false,
        reason: 'NO_VALID_SHAPES',
        configUsed: cs
      };
    }

    let bullCount = 0;
    let bearCount = 0;
    let neutralCount = 0;
    let longUpperWickCount = 0;
    let longLowerWickCount = 0;
    let wideRangeCount = 0;
    let closeNearHighCount = 0;
    let closeNearLowCount = 0;

    for (const s of validShapes) {
      if (s.direction === 'BULLISH') bullCount++;
      else if (s.direction === 'BEARISH') bearCount++;
      else neutralCount++;
      if (s.flags.longUpperWick) longUpperWickCount++;
      if (s.flags.longLowerWick) longLowerWickCount++;
      if (s.flags.wideRange) wideRangeCount++;
      if (s.flags.closeNearHigh) closeNearHighCount++;
      if (s.flags.closeNearLow) closeNearLowCount++;
    }

    const total = validShapes.length;
    const last = validShapes[validShapes.length - 1];

    return {
      valid: true,
      sampleSize: total,
      counts: {
        bullish: bullCount,
        bearish: bearCount,
        neutral: neutralCount,
        longUpperWick: longUpperWickCount,
        longLowerWick: longLowerWickCount,
        wideRange: wideRangeCount,
        closeNearHigh: closeNearHighCount,
        closeNearLow: closeNearLowCount
      },
      pct: {
        bullishPct: Math.round((bullCount / total) * 10000) / 100,
        bearishPct: Math.round((bearCount / total) * 10000) / 100,
        wideRangePct: Math.round((wideRangeCount / total) * 10000) / 100
      },
      lastCandle: last,
      avgRange: series.avgRange,
      configUsed: {
        lookback: cs.lookback,
        longWickRatio: cs.longWickRatio,
        wideRangeMultiplier: cs.wideRangeMultiplier
      }
    };
  }

  // ==========================================================================
  // §11.9 박스 / 구조 보조 Skeleton
  // structureBucket 최종 판정 X. 기초값만 계산.
  // ==========================================================================

  /**
   * 최근 N봉 박스 (최고/최저) + 터치 카운트 + 위치.
   */
  function detectRecentHighLowBox(candles, config = {}) {
    const cfg = mergeIndicatorConfig(config);
    const cs = cfg.candleStructure;
    const lookback = cs.boxLookback;
    const tolPct = cs.touchTolerancePct;

    if (!hasEnoughCandles(candles, Math.min(lookback, 5))) {
      return {
        valid: false,
        reason: 'NOT_ENOUGH_CANDLES',
        configUsed: { boxLookback: lookback, touchTolerancePct: tolPct }
      };
    }

    const recent = sliceRecent(candles, lookback);
    let boxHigh = -Infinity;
    let boxLow = Infinity;
    for (const c of recent) {
      const h = getHigh(c);
      const l = getLow(c);
      if (h !== null && h > boxHigh) boxHigh = h;
      if (l !== null && l < boxLow) boxLow = l;
    }
    if (!Number.isFinite(boxHigh) || !Number.isFinite(boxLow)) {
      return {
        valid: false,
        reason: 'NO_VALID_HIGH_LOW',
        configUsed: { boxLookback: lookback, touchTolerancePct: tolPct }
      };
    }
    const boxCenter = (boxHigh + boxLow) / 2;
    const lastClose = getClose(candles[candles.length - 1]);

    const distanceToTopPct = (lastClose !== null && boxHigh !== 0)
      ? ((boxHigh - lastClose) / lastClose) * 100
      : null;
    const distanceToBottomPct = (lastClose !== null && boxLow !== 0)
      ? ((lastClose - boxLow) / lastClose) * 100
      : null;

    const touchesHigh = countLevelTouches(recent, boxHigh, config).touches;
    const touchesLow = countLevelTouches(recent, boxLow, config).touches;

    return {
      valid: true,
      boxHigh,
      boxLow,
      boxCenter,
      distanceToTopPct: distanceToTopPct !== null
        ? Math.round(distanceToTopPct * 100) / 100 : null,
      distanceToBottomPct: distanceToBottomPct !== null
        ? Math.round(distanceToBottomPct * 100) / 100 : null,
      touchesHigh,
      touchesLow,
      configUsed: {
        boxLookback: lookback,
        touchTolerancePct: tolPct
      }
    };
  }

  /**
   * 특정 가격 level에 high/low가 tolerance% 안에 들어온 횟수.
   */
  function countLevelTouches(candles, level, config = {}) {
    const cfg = mergeIndicatorConfig(config);
    const tolPct = cfg.candleStructure.touchTolerancePct;
    if (!Array.isArray(candles) || level === null || level === undefined) {
      return { valid: false, touches: 0, reason: 'INVALID_INPUT' };
    }
    const tol = Math.abs(level) * (tolPct / 100);
    let touches = 0;
    for (const c of candles) {
      const h = getHigh(c);
      const l = getLow(c);
      if (h !== null && Math.abs(h - level) <= tol) touches++;
      else if (l !== null && Math.abs(l - level) <= tol) touches++;
    }
    return {
      valid: true,
      touches,
      level,
      configUsed: { touchTolerancePct: tolPct }
    };
  }

  /**
   * priceZone — 같은 signalCycle 묶음 판단 기초값.
   * 현재 박스 기반 zone 후보를 반환.
   */
  function calculatePriceZone(candles, config = {}) {
    const cfg = mergeIndicatorConfig(config);
    const cs = cfg.candleStructure;
    const box = detectRecentHighLowBox(candles, config);
    if (!box.valid) {
      return {
        valid: false,
        reason: box.reason,
        configUsed: cs
      };
    }
    const last = getClose(candles[candles.length - 1]);
    // 단순 zone 후보: 최근 lookback의 박스 [boxLow, boxHigh] / center
    return {
      valid: true,
      from: box.boxLow,
      to: box.boxHigh,
      center: box.boxCenter,
      lastClose: last,
      source: 'BOX_RECENT',
      bufferType: 'BOX_RANGE',
      configUsed: {
        boxLookback: cs.boxLookback,
        touchTolerancePct: cs.touchTolerancePct
      }
    };
  }

  /**
   * referenceLow 후보 (백서 §7.3 분류).
   * Skeleton — 실제 multi-timeframe은 후속.
   */
  function findReferenceLows(candles, config = {}) {
    const cfg = mergeIndicatorConfig(config);
    const cs = cfg.candleStructure;
    if (!hasEnoughCandles(candles, 5)) {
      return {
        valid: false,
        reason: 'NOT_ENOUGH_CANDLES',
        configUsed: cs
      };
    }

    // 단일 timeframe 기준 — scalpSwingLow (최근 5~20봉 중 최저)
    const scalpWindow = sliceRecent(candles, Math.min(20, candles.length));
    let scalpSwingLow = Infinity;
    for (const c of scalpWindow) {
      const l = getLow(c);
      if (l !== null && l < scalpSwingLow) scalpSwingLow = l;
    }
    if (!Number.isFinite(scalpSwingLow)) scalpSwingLow = null;

    // intradaySwingLow (lookback 절반 정도) - skeleton placeholder
    const intradayWindow = sliceRecent(candles, Math.min(60, candles.length));
    let intradaySwingLow = Infinity;
    for (const c of intradayWindow) {
      const l = getLow(c);
      if (l !== null && l < intradaySwingLow) intradaySwingLow = l;
    }
    if (!Number.isFinite(intradaySwingLow)) intradaySwingLow = null;

    // structuralSwingLow - 충분한 데이터 없으면 null
    let structuralSwingLow = null;
    if (candles.length >= 100) {
      let m = Infinity;
      for (const c of candles) {
        const l = getLow(c);
        if (l !== null && l < m) m = l;
      }
      if (Number.isFinite(m)) structuralSwingLow = m;
    }

    // boxLow
    const box = detectRecentHighLowBox(candles, config);
    const boxLow = box.valid ? box.boxLow : null;

    // orderBlockLow — 이번 단계에서는 null. 후속 구현.
    const orderBlockLow = null;

    return {
      valid: true,
      scalpSwingLow,
      intradaySwingLow,
      structuralSwingLow,
      boxLow,
      orderBlockLow,
      configUsed: {
        boxLookback: cs.boxLookback
      }
    };
  }

  /**
   * sweep / reclaim 후보 — structureBucket 확정 X. 후보 플래그만.
   * lowSweep: 직전 N봉 최저 살짝 깬 뒤 회복 close
   * highSweep: 직전 N봉 최고 살짝 넘은 뒤 회복 종가 (역방향)
   * reclaim: 종가가 close position 임계 이상 회복
   */
  function detectSweepReclaimCandidates(candles, config = {}) {
    const cfg = mergeIndicatorConfig(config);
    const cs = cfg.candleStructure;
    const sweepTolPct = cs.sweepTolerancePct;
    const reclaimCP = cs.reclaimClosePosition;

    if (!hasEnoughCandles(candles, 5)) {
      return {
        valid: false,
        reason: 'NOT_ENOUGH_CANDLES',
        configUsed: { sweepTolerancePct: sweepTolPct, reclaimClosePosition: reclaimCP }
      };
    }

    const last = candles[candles.length - 1];
    const prevs = candles.slice(0, candles.length - 1);

    const curHigh = getHigh(last);
    const curLow = getLow(last);
    const curClose = getClose(last);
    const curOpen = getOpen(last);

    if (curHigh === null || curLow === null || curClose === null) {
      return {
        valid: false,
        reason: 'MISSING_OHLC',
        configUsed: { sweepTolerancePct: sweepTolPct, reclaimClosePosition: reclaimCP }
      };
    }

    // 직전 N봉의 최저 / 최고
    const prevWindow = sliceRecent(prevs, Math.min(20, prevs.length));
    let prevLow = Infinity;
    let prevHigh = -Infinity;
    for (const c of prevWindow) {
      const l = getLow(c);
      const h = getHigh(c);
      if (l !== null && l < prevLow) prevLow = l;
      if (h !== null && h > prevHigh) prevHigh = h;
    }
    if (!Number.isFinite(prevLow)) prevLow = null;
    if (!Number.isFinite(prevHigh)) prevHigh = null;

    const range = curHigh - curLow;
    const closePosition = range > 0 ? (curClose - curLow) / range : 0.5;

    // lowSweepCandidate: 현재 봉이 prevLow를 sweepTol% 안에서 깼다가 종가 회복
    let lowSweepCandidate = false;
    let closeRecoveredAbovePreviousLow = false;
    if (prevLow !== null) {
      const tol = Math.abs(prevLow) * (sweepTolPct / 100);
      const breachedBelow = curLow < prevLow && (prevLow - curLow) <= tol * 5;
      closeRecoveredAbovePreviousLow = curClose > prevLow;
      lowSweepCandidate = breachedBelow && closeRecoveredAbovePreviousLow;
    }

    // highSweepCandidate: 현재 봉이 prevHigh를 살짝 넘었다가 종가 다시 안쪽
    let highSweepCandidate = false;
    if (prevHigh !== null) {
      const tol = Math.abs(prevHigh) * (sweepTolPct / 100);
      const breachedAbove = curHigh > prevHigh && (curHigh - prevHigh) <= tol * 5;
      const closeBackInside = curClose < prevHigh;
      highSweepCandidate = breachedAbove && closeBackInside;
    }

    // reclaimCandidate: 종가가 range 상단부 (reclaimClosePosition 이상)에 위치
    const reclaimCandidate = closePosition >= reclaimCP;

    return {
      valid: true,
      lowSweepCandidate,
      highSweepCandidate,
      reclaimCandidate,
      details: {
        previousLow: prevLow,
        previousHigh: prevHigh,
        currentLow: curLow,
        currentHigh: curHigh,
        currentClose: curClose,
        currentOpen: curOpen,
        closePosition: Math.round(closePosition * 1000) / 1000,
        closeRecoveredAbovePreviousLow
      },
      configUsed: {
        sweepTolerancePct: sweepTolPct,
        reclaimClosePosition: reclaimCP
      }
    };
  }

  // ==========================================================================
  // §11.10 통합 Indicator Snapshot
  // ==========================================================================

  /**
   * 모든 지표를 한 번에 계산해서 구조화된 snapshot 반환.
   * 실패 지표는 warnings에 누적.
   * featurePayload 본체가 읽기 쉽게 모음.
   */
  function buildIndicatorSnapshot(candles, config = {}) {
    const cfg = mergeIndicatorConfig(config);
    const candleCount = Array.isArray(candles) ? candles.length : 0;
    const warnings = [];

    if (!hasEnoughCandles(candles, 2)) {
      return {
        valid: false,
        indicators: {},
        warnings: ['NOT_ENOUGH_CANDLES'],
        debug: {
          candleCount,
          indicatorVersion: INDICATOR_VERSION,
          configVersion: CONFIG_VERSION
        }
      };
    }

    const indicators = {};

    const collect = (key, result) => {
      indicators[key] = result;
      if (result && result.valid === false && result.reason) {
        warnings.push(`${key.toUpperCase()}_${result.reason}`);
      }
    };

    collect('rsi', calculateRSI(candles, config));
    collect('mfi', calculateMFI(candles, config));
    collect('obv', calculateOBVTrend(candles, config));
    collect('atr', calculateATR(candles, config));
    collect('ma', calculateMAState(candles, config));
    collect('volume', calculateVolumeStats(candles, config));
    collect('volumeAcceleration', calculateVolumeAcceleration(candles, config));
    collect('tradeValue', calculateTradeValueStats(candles, config));
    collect('candleShape', (function () {
      // 마지막 봉만 (구조 보조용)
      return calculateCandleShape(candles[candles.length - 1], config);
    })());
    collect('candleStructure', calculateRecentCandleStructure(candles, config));
    collect('structure', (function () {
      const box = detectRecentHighLowBox(candles, config);
      const refLows = findReferenceLows(candles, config);
      const priceZone = calculatePriceZone(candles, config);
      const sweepReclaim = detectSweepReclaimCandidates(candles, config);
      return {
        valid: box.valid && refLows.valid && priceZone.valid && sweepReclaim.valid,
        box,
        referenceLows: refLows,
        priceZone,
        sweepReclaim
      };
    })());

    // 전체 valid 판정 — 최소 RSI + MA + volume 정도 valid면 true
    const overallValid =
      indicators.rsi.valid &&
      indicators.ma.valid &&
      indicators.volume.valid;

    return {
      valid: overallValid,
      indicators,
      warnings,
      debug: {
        candleCount,
        indicatorVersion: INDICATOR_VERSION,
        configVersion: CONFIG_VERSION
      }
    };
  }

  // ==========================================================================
  // §14 Self-test Helper — 자동 실행 X
  // ==========================================================================

  function __testIndicatorsWithSampleCandles(sampleCandles, config = {}) {
    return buildIndicatorSnapshot(sampleCandles, config);
  }

  // ==========================================================================
  // §13 Export
  // 기존 /v3 파일이 브라우저 전역 (window.*) 스타일이라면 window에 부착.
  // module 환경(Cloudflare Workers / Node)이면 module.exports로 부착.
  // ==========================================================================

  const api = {
    // version
    INDICATOR_VERSION,
    CONFIG_VERSION,
    DEFAULT_INDICATOR_CONFIG,

    // config / 유틸
    mergeIndicatorConfig,
    safeNumber,
    getOpen,
    getHigh,
    getLow,
    getClose,
    getVolume,
    getTradeValue,
    sliceRecent,
    hasEnoughCandles,
    calculatePctChange,
    calculateAverage,

    // 이동평균
    calculateSMA,
    calculateEMA,
    calculateMAState,

    // RSI / MFI / OBV / ATR
    calculateRSI,
    calculateMFI,
    calculateOBV,
    calculateOBVTrend,
    calculateATR,

    // 거래량 / 거래대금
    calculateVolumeStats,
    calculateVolumeAcceleration,
    calculateTradeValueStats,

    // 캔들 구조
    calculateCandleShape,
    calculateCandleShapeSeries,
    calculateRecentCandleStructure,

    // 박스 / 구조 보조
    detectRecentHighLowBox,
    countLevelTouches,
    calculatePriceZone,
    findReferenceLows,
    detectSweepReclaimCandidates,

    // 통합
    buildIndicatorSnapshot,

    // test helper (자동 실행 X)
    __testIndicatorsWithSampleCandles
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (typeof global !== 'undefined' && global) {
    global.WS3Indicators = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis
   : typeof window !== 'undefined' ? window
   : typeof self !== 'undefined' ? self
   : this);
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
/**
 * WS3 v0.7.0 — CardViewModel
 *
 * Scope:
 *   V3FeaturePayload (c-r1)
 *   + scoreBreakdown (v0.3.0)
 *   + structureDecision (v0.4.0)
 *   + signalCycle (v0.5.0)
 *   + strategyPlan (v0.6.0)
 *   → standalone cardViewModel (UI-ready, 비-mutating, 비-렌더)
 *
 * 단일 기준 문서:
 *   docs/ws3/WS3_CODE_CONTRACT.md (b-r2 박제본)
 *
 * 주의 (U-STRAT-1 Option B 정합 유지):
 *   priceZone.zone 라벨은 'TOP_NEAR' / 'BOTTOM_NEAR' / 'MIDDLE' / 'UNKNOWN'.
 *   ABOVE_BOX 매핑은 structureDecision.structureBucket === 'ABOVE_BOX_CONFIRMED_CANDIDATE'.
 *
 * 확정 DP 정책 (r0.2-final 매핑):
 *   DP-UI1   standalone cardViewModel. 입력 5종 (payload / scoreBreakdown /
 *            structureDecision / signalCycle / strategyPlan) mutate / delete 금지.
 *   DP-UI2   DOM / HTML / renderer 작성 금지. 데이터 객체만 산출.
 *   DP-UI3   출력 7대 영역 구조 보장:
 *            identity + header + chips + metrics + sections + displayFlags + tone.
 *   DP-UI4   metrics 는 array. object 형태 metrics 금지.
 *            각 metric = { id, labelKey, labelKo, labelEn, value, kind, tone, sortKey }.
 *   DP-UI5   라벨은 labelKey + labelKo + labelEn 직접 포함.
 *            (chip / metric / badge 모두 동일 패턴.)
 *   DP-UI6   tone semantic token 사용. 색상 코드 / hex / inline style 금지.
 *            토큰 8종: positive / neutral / caution / warning / muted / info /
 *            critical / unknown.
 *   DP-UI7   showEntryPlan / showExitPlan boolean. displayFlags 에 위치.
 *            sections.strategy 외 numeric hint 노출 금지.
 *   DP-UI8   debug 기본 숨김 (cfg.sections.showDebug=false).
 *            raw payload / payload.raw / payload.raw.builderDebug 전체 직접 노출 금지.
 *            identityInput / candle raw array 직접 노출 영구 차단.
 *            cfg.debug.allowedFields whitelist 방식. 기본값 빈 배열.
 *   DP-UI9   sections 7개 생성:
 *            overview / score / structure / cycle / strategy / risk / debug.
 *   DP-UI10  P-S / P-A / P-B 최종 알림 등급 표시 금지. 등급 코드 / tier 라벨 외부 노출 X.
 *   DP-UI11  numeric hint (entryZone / invalidationHint / targetHint / penalty 등) 는
 *            sections.strategy / sections.risk 에서만 노출.
 *            header / chips / metrics 에 가격 숫자 직접 노출 금지.
 *
 * 부가:
 *   header.primaryBadge 는 strategyBias 우선 (cycleState override 금지). cycleState 는 chips.
 *   reasons / warnings 는 4종 산출 객체로부터 dedupe 누적.
 *   "매수하세요" / "매도하세요" 명령 어조 금지. 정보 전달 어조만.
 *   stopLossHint / takeProfitHint / buySignal / sellSignal / planGradeHint 등 구버전 라벨 금지.
 *
 * displayFlags (정확히 10 boolean keys — r0.2-final):
 *   isReady / isBlocked / isCooldown / isExpired / isWeakening /
 *   isHighActionability / showEntryPlan / showExitPlan / showRiskWarning / showDebug
 *
 * 금지 (이번 단계):
 *   실제 매수/매도 주문 실행. 외부 알림 발송 (별도 단계).
 *   DOM 트리 직접 조작 / HTML 문자열 생성 / event 바인딩.
 *   브라우저 영속 저장소 사용 / 네트워크 호출 / 파일 IO / KV.
 *   런타임 clock API 사용.
 *   입력 5종 mutation / delete.
 *   색상 코드 / hex / inline style.
 *   행동 지시 어조 ("매수하세요" / "매도하세요" 등).
 *   구버전 라벨 (구분 손절·익절 힌트 라벨, 매수·매도 신호 라벨, 등급 힌트 라벨).
 *   raw payload 객체 / payload.raw / payload.raw.builderDebug 전체 직접 노출.
 *   identityInput / candle raw array 직접 노출 (영구 차단 — whitelist 와 무관).
 *
 * 의존:
 *   payload          (v3-feature-payload-builder.js 산출)
 *   scoreBreakdown   (v3-score-breakdown.js, optional)
 *   structureDecision (v3-structure-bucket.js, optional)
 *   signalCycle      (v3-signal-cycle.js, optional)
 *   strategyPlan     (v3-strategy-plan.js, optional)
 */

(function (global) {
  'use strict';

  var CARD_VIEW_MODEL_VERSION = 'WS3_v0.7.0';
  var CONFIG_VERSION = 'inline-default-v0';

  // ==========================================================================
  // 의미 토큰 (DP-UI6)
  // ==========================================================================
  var TONE = Object.freeze({
    POSITIVE: 'positive',
    NEUTRAL: 'neutral',
    CAUTION: 'caution',
    WARNING: 'warning',
    MUTED: 'muted',
    INFO: 'info',
    CRITICAL: 'critical',
    UNKNOWN: 'unknown'
  });

  // ==========================================================================
  // 라벨 사전 (DP-UI5) — labelKey / labelKo / labelEn 직접 포함. 정보 전달 어조.
  // ==========================================================================
  var STRATEGY_BIAS_LABEL = Object.freeze({
    UNKNOWN:         { ko: '판단 보류',     en: 'Unknown',          tone: TONE.UNKNOWN },
    NO_TRADE:        { ko: '거래 대상 아님', en: 'No Trade',         tone: TONE.MUTED },
    WATCH_ONLY:      { ko: '관찰 우선',     en: 'Watch Only',       tone: TONE.NEUTRAL },
    PULLBACK_WAIT:   { ko: '눌림 대기',     en: 'Pullback Wait',    tone: TONE.INFO },
    BREAKOUT_READY:  { ko: '돌파 후보',     en: 'Breakout Ready',   tone: TONE.POSITIVE },
    RECLAIM_READY:   { ko: '되돌림 회복 후보', en: 'Reclaim Ready',   tone: TONE.POSITIVE },
    MOMENTUM_FOLLOW: { ko: '모멘텀 추세',   en: 'Momentum Follow',  tone: TONE.POSITIVE },
    RISK_OFF:        { ko: '리스크 우선',   en: 'Risk Off',         tone: TONE.WARNING },
    COOLDOWN_WAIT:   { ko: '냉각 대기',     en: 'Cooldown Wait',    tone: TONE.CAUTION },
    EXPIRED_IGNORE:  { ko: '만료 무시',     en: 'Expired Ignore',   tone: TONE.CRITICAL }
  });

  var CYCLE_STATE_LABEL = Object.freeze({
    UNKNOWN:        { ko: '사이클 미상',       en: 'Cycle Unknown',     tone: TONE.UNKNOWN },
    NEW_CANDIDATE:  { ko: '신규 후보',         en: 'New Candidate',     tone: TONE.INFO },
    STRENGTHENING:  { ko: '강화 중',           en: 'Strengthening',     tone: TONE.POSITIVE },
    PERSISTING:     { ko: '지속 중',           en: 'Persisting',        tone: TONE.NEUTRAL },
    WEAKENING:      { ko: '약화 중',           en: 'Weakening',         tone: TONE.WARNING },
    COOLDOWN:       { ko: '냉각',              en: 'Cooldown',          tone: TONE.CAUTION },
    EXPIRED:        { ko: '만료',              en: 'Expired',           tone: TONE.CRITICAL },
    RESET:          { ko: '초기화',            en: 'Reset',             tone: TONE.MUTED }
  });

  var CYCLE_PHASE_LABEL = Object.freeze({
    UNKNOWN: { ko: '단계 미상', en: 'Phase Unknown', tone: TONE.UNKNOWN },
    EARLY:   { ko: '초기',     en: 'Early',         tone: TONE.INFO },
    MID:     { ko: '중기',     en: 'Mid',           tone: TONE.NEUTRAL },
    LATE:    { ko: '후기',     en: 'Late',          tone: TONE.CAUTION },
    POST:    { ko: '사후',     en: 'Post',          tone: TONE.MUTED }
  });

  var ACTIONABILITY_LABEL = Object.freeze({
    NONE:    { ko: '판단 없음',   en: 'None',     tone: TONE.UNKNOWN },
    LOW:     { ko: '낮음',        en: 'Low',      tone: TONE.MUTED },
    MEDIUM:  { ko: '보통',        en: 'Medium',   tone: TONE.INFO },
    HIGH:    { ko: '계획 명확',    en: 'High',     tone: TONE.POSITIVE },
    BLOCKED: { ko: '진입 차단',   en: 'Blocked',  tone: TONE.WARNING }
  });

  var PLAN_QUALITY_LABEL = Object.freeze({
    NONE:           { ko: '등급 없음',     en: 'None',            tone: TONE.UNKNOWN },
    PLAN_AVOID:     { ko: '회피 권장',     en: 'Plan Avoid',      tone: TONE.WARNING },
    PLAN_WEAK:      { ko: '약한 계획',     en: 'Plan Weak',       tone: TONE.MUTED },
    PLAN_WATCH:     { ko: '관찰 계획',     en: 'Plan Watch',      tone: TONE.NEUTRAL },
    PLAN_STANDARD:  { ko: '표준 계획',     en: 'Plan Standard',   tone: TONE.INFO },
    PLAN_STRONG:    { ko: '강한 계획',     en: 'Plan Strong',     tone: TONE.POSITIVE },
    PLAN_PREMIUM:   { ko: '프리미엄 계획', en: 'Plan Premium',    tone: TONE.POSITIVE }
  });

  var STRUCTURE_BUCKET_LABEL = Object.freeze({
    UNKNOWN:                        { ko: '구조 미상',           tone: TONE.UNKNOWN },
    BOX_INSIDE:                     { ko: '박스 내부',           tone: TONE.NEUTRAL },
    BOX_MIDDLE:                     { ko: '박스 중앙',           tone: TONE.NEUTRAL },
    BOX_TOP_PRESSURE:               { ko: '박스 상단 압력',      tone: TONE.INFO },
    BOX_BOTTOM_PRESSURE:            { ko: '박스 하단 압력',      tone: TONE.CAUTION },
    BREAKOUT_PRESSURE_CANDIDATE:    { ko: '돌파 압력 후보',      tone: TONE.POSITIVE },
    BREAKDOWN_PRESSURE_CANDIDATE:   { ko: '이탈 압력 후보',      tone: TONE.WARNING },
    ABOVE_BOX_CONFIRMED_CANDIDATE:  { ko: '박스 상단 돌파 확정', tone: TONE.POSITIVE },
    BELOW_BOX_CONFIRMED_CANDIDATE:  { ko: '박스 하단 이탈 확정', tone: TONE.WARNING },
    LOW_SWEEP_RECLAIM_CANDIDATE:    { ko: '저점 청소 회복 후보', tone: TONE.POSITIVE },
    RECLAIM_READY:                  { ko: '회복 후보',           tone: TONE.POSITIVE },
    RANGE_EXPANSION:                { ko: '레인지 확장',         tone: TONE.INFO },
    RANGE_CONTRACTION:              { ko: '레인지 수축',         tone: TONE.NEUTRAL }
  });

  var PRICE_ZONE_LABEL = Object.freeze({
    UNKNOWN:     { ko: '구역 미상',  tone: TONE.UNKNOWN },
    TOP_NEAR:    { ko: '상단 근접',  tone: TONE.INFO },
    BOTTOM_NEAR: { ko: '하단 근접',  tone: TONE.CAUTION },
    MIDDLE:      { ko: '중앙',       tone: TONE.NEUTRAL }
  });

  var RISK_LEVEL_LABEL = Object.freeze({
    UNKNOWN: { ko: '리스크 미상', tone: TONE.UNKNOWN },
    LOW:     { ko: '낮음',       tone: TONE.POSITIVE },
    MEDIUM:  { ko: '보통',       tone: TONE.INFO },
    HIGH:    { ko: '높음',       tone: TONE.WARNING }
  });

  // ==========================================================================
  // DEFAULT_CARD_VIEW_MODEL_CONFIG
  // ==========================================================================
  var DEFAULT_CARD_VIEW_MODEL_CONFIG = Object.freeze({
    version: CONFIG_VERSION,
    sections: Object.freeze({
      showStructure: true,
      showCycle: true,
      showScore: true,
      showStrategy: true,
      showRisk: true,
      showDebug: false
    }),
    metrics: Object.freeze({
      showTotalScore: true,
      showStructureConfidence: true,
      showAgeBars: true,
      showCyclePhase: true,
      showActionability: true,
      showPlanQuality: true
    }),
    debug: Object.freeze({
      allowedFields: Object.freeze([])
    }),
    chips: Object.freeze({
      maxChips: 6,
      includeCycleState: true,
      includeCyclePhase: true,
      includeActionability: true,
      includePlanQuality: true,
      includeStructureBucket: true,
      includePriceZone: true
    })
  });

  function mergeCardViewModelConfig(config) {
    var c = config || {};
    var d = DEFAULT_CARD_VIEW_MODEL_CONFIG;
    var sec = c.sections || {};
    var met = c.metrics || {};
    var dbg = c.debug || {};
    var chp = c.chips || {};
    return {
      version: typeof c.version === 'string' ? c.version : d.version,
      sections: {
        showStructure: sec.showStructure !== false,
        showCycle: sec.showCycle !== false,
        showScore: sec.showScore !== false,
        showStrategy: sec.showStrategy !== false,
        showRisk: sec.showRisk !== false,
        showDebug: sec.showDebug === true
      },
      metrics: {
        showTotalScore: met.showTotalScore !== false,
        showStructureConfidence: met.showStructureConfidence !== false,
        showAgeBars: met.showAgeBars !== false,
        showCyclePhase: met.showCyclePhase !== false,
        showActionability: met.showActionability !== false,
        showPlanQuality: met.showPlanQuality !== false
      },
      debug: {
        allowedFields: Array.isArray(dbg.allowedFields)
          ? dbg.allowedFields.filter(function (f) { return typeof f === 'string' && f; })
          : []
      },
      chips: {
        maxChips: safeNumber(chp.maxChips, d.chips.maxChips),
        includeCycleState: chp.includeCycleState !== false,
        includeCyclePhase: chp.includeCyclePhase !== false,
        includeActionability: chp.includeActionability !== false,
        includePlanQuality: chp.includePlanQuality !== false,
        includeStructureBucket: chp.includeStructureBucket !== false,
        includePriceZone: chp.includePriceZone !== false
      }
    };
  }

  function makeConfigUsed(cfg) {
    return {
      sections: {
        showStructure: cfg.sections.showStructure,
        showCycle: cfg.sections.showCycle,
        showScore: cfg.sections.showScore,
        showStrategy: cfg.sections.showStrategy,
        showRisk: cfg.sections.showRisk,
        showDebug: cfg.sections.showDebug
      },
      metrics: {
        showTotalScore: cfg.metrics.showTotalScore,
        showStructureConfidence: cfg.metrics.showStructureConfidence,
        showAgeBars: cfg.metrics.showAgeBars,
        showCyclePhase: cfg.metrics.showCyclePhase,
        showActionability: cfg.metrics.showActionability,
        showPlanQuality: cfg.metrics.showPlanQuality
      },
      debug: {
        allowedFields: cfg.debug.allowedFields.slice()
      },
      chips: {
        maxChips: cfg.chips.maxChips,
        includeCycleState: cfg.chips.includeCycleState,
        includeCyclePhase: cfg.chips.includeCyclePhase,
        includeActionability: cfg.chips.includeActionability,
        includePlanQuality: cfg.chips.includePlanQuality,
        includeStructureBucket: cfg.chips.includeStructureBucket,
        includePriceZone: cfg.chips.includePriceZone
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

  function pushUnique(arr, value) {
    if (!Array.isArray(arr) || typeof value !== 'string' || !value) return;
    if (arr.indexOf(value) === -1) arr.push(value);
  }

  function safeString(value, fallback) {
    if (typeof value === 'string' && value) return value;
    return (typeof fallback === 'string') ? fallback : null;
  }

  function lookupLabel(dict, key) {
    if (!isPlainObject(dict)) return null;
    if (typeof key !== 'string' || !key) return null;
    if (!Object.prototype.hasOwnProperty.call(dict, key)) return null;
    return dict[key];
  }

  function pickLabel(dict, key, fallbackKo, fallbackTone) {
    var safeKey = (typeof key === 'string' && key) ? key : 'UNKNOWN';
    var entry = lookupLabel(dict, key);
    if (entry) {
      return {
        labelKey: safeKey,
        labelKo: typeof entry.ko === 'string' ? entry.ko : (fallbackKo || ''),
        labelEn: typeof entry.en === 'string' ? entry.en : safeKey,
        tone: typeof entry.tone === 'string' ? entry.tone : (fallbackTone || TONE.UNKNOWN)
      };
    }
    return {
      labelKey: safeKey,
      labelKo: fallbackKo || '',
      labelEn: safeKey,
      tone: fallbackTone || TONE.UNKNOWN
    };
  }

  // ==========================================================================
  // §identity
  // ==========================================================================
  function buildIdentity(payload) {
    var id = {
      symbol: null,
      market: null,
      timeframe: null,
      asOfTs: null
    };
    if (!isPlainObject(payload)) return id;
    id.symbol = safeString(payload.symbol, null);
    id.market = safeString(payload.market, null);

    var raw = isPlainObject(payload.raw) ? payload.raw : null;
    var bd = (raw && isPlainObject(raw.builderDebug)) ? raw.builderDebug : null;
    if (bd && typeof bd.primaryTimeframe === 'string' && bd.primaryTimeframe) {
      id.timeframe = bd.primaryTimeframe;
    }

    var ts = safeNumber(payload.ts, null);
    if (ts !== null) {
      id.asOfTs = ts;
    } else if (isPlainObject(payload.candles) && id.timeframe) {
      var arr = payload.candles[id.timeframe];
      if (Array.isArray(arr) && arr.length > 0) {
        var last = arr[arr.length - 1];
        if (isPlainObject(last)) {
          var candleTs = safeNumber(last.ts, null);
          if (candleTs !== null) id.asOfTs = candleTs;
        }
      }
    }
    return id;
  }

  // ==========================================================================
  // §header (DP-UI3 / DP-UI5 / DP-UI11 — primaryBadge=strategyBias, numeric hint X)
  // ==========================================================================
  function buildHeader(strategyPlan, signalCycle, identity) {
    var strategyBias = (isPlainObject(strategyPlan) && typeof strategyPlan.strategyBias === 'string')
      ? strategyPlan.strategyBias : 'UNKNOWN';
    var primary = pickLabel(STRATEGY_BIAS_LABEL, strategyBias, '판단 보류', TONE.UNKNOWN);

    var cycleState = (isPlainObject(signalCycle) && typeof signalCycle.cycleState === 'string')
      ? signalCycle.cycleState : 'UNKNOWN';
    var secondary = pickLabel(CYCLE_STATE_LABEL, cycleState, '사이클 미상', TONE.UNKNOWN);

    var actionability = (isPlainObject(strategyPlan) && typeof strategyPlan.actionability === 'string')
      ? strategyPlan.actionability : 'NONE';
    var actionLabel = pickLabel(ACTIONABILITY_LABEL, actionability, '판단 없음', TONE.UNKNOWN);

    var symbol = safeString(identity.symbol, '');
    var market = safeString(identity.market, '');
    var symbolText = symbol || (market ? market : '');

    return {
      title: symbolText,
      subtitle: market && symbol ? market : '',
      primaryBadge: {
        id: 'BIAS_' + strategyBias,
        labelKey: primary.labelKey,
        labelKo: primary.labelKo,
        labelEn: primary.labelEn,
        tone: primary.tone
      },
      secondaryBadge: {
        id: 'CYCLE_' + cycleState,
        labelKey: secondary.labelKey,
        labelKo: secondary.labelKo,
        labelEn: secondary.labelEn,
        tone: secondary.tone
      },
      actionability: {
        id: 'ACTION_' + actionability,
        labelKey: actionLabel.labelKey,
        labelKo: actionLabel.labelKo,
        labelEn: actionLabel.labelEn,
        tone: actionLabel.tone
      }
    };
  }

  // ==========================================================================
  // §chips (DP-UI3 / DP-UI5)
  // ==========================================================================
  function buildChips(strategyPlan, signalCycle, structureDecision, cfg) {
    var chips = [];
    var max = safeNumber(cfg.chips.maxChips, 6);

    var add = function (id, labelKey, labelKo, labelEn, tone) {
      if (chips.length >= max) return;
      chips.push({
        id: id,
        labelKey: labelKey,
        labelKo: labelKo,
        labelEn: labelEn,
        tone: tone || TONE.NEUTRAL
      });
    };

    if (cfg.chips.includeCycleState && isPlainObject(signalCycle)) {
      var cs = typeof signalCycle.cycleState === 'string' ? signalCycle.cycleState : 'UNKNOWN';
      var csLabel = pickLabel(CYCLE_STATE_LABEL, cs, '사이클 미상', TONE.UNKNOWN);
      add('CYCLE_STATE_' + cs, csLabel.labelKey, csLabel.labelKo, csLabel.labelEn, csLabel.tone);
    }

    if (cfg.chips.includeCyclePhase && isPlainObject(signalCycle)) {
      var cp = typeof signalCycle.cyclePhase === 'string' ? signalCycle.cyclePhase : 'UNKNOWN';
      var cpLabel = pickLabel(CYCLE_PHASE_LABEL, cp, '단계 미상', TONE.UNKNOWN);
      add('CYCLE_PHASE_' + cp, cpLabel.labelKey, cpLabel.labelKo, cpLabel.labelEn, cpLabel.tone);
    }

    if (cfg.chips.includeStructureBucket && isPlainObject(structureDecision)) {
      var sb = typeof structureDecision.structureBucket === 'string'
        ? structureDecision.structureBucket : 'UNKNOWN';
      var sbLabel = pickLabel(STRUCTURE_BUCKET_LABEL, sb, '구조 미상', TONE.UNKNOWN);
      add('STRUCTURE_BUCKET_' + sb, sbLabel.labelKey, sbLabel.labelKo, sb, sbLabel.tone);
    }

    if (cfg.chips.includePriceZone && isPlainObject(structureDecision)
        && isPlainObject(structureDecision.priceZone)) {
      var pz = typeof structureDecision.priceZone.zone === 'string'
        ? structureDecision.priceZone.zone : 'UNKNOWN';
      var pzLabel = pickLabel(PRICE_ZONE_LABEL, pz, '구역 미상', TONE.UNKNOWN);
      add('PRICE_ZONE_' + pz, pzLabel.labelKey, pzLabel.labelKo, pz, pzLabel.tone);
    }

    if (cfg.chips.includeActionability && isPlainObject(strategyPlan)) {
      var ac = typeof strategyPlan.actionability === 'string' ? strategyPlan.actionability : 'NONE';
      var acLabel = pickLabel(ACTIONABILITY_LABEL, ac, '판단 없음', TONE.UNKNOWN);
      add('ACTIONABILITY_' + ac, acLabel.labelKey, acLabel.labelKo, acLabel.labelEn, acLabel.tone);
    }

    if (cfg.chips.includePlanQuality && isPlainObject(strategyPlan)) {
      var pq = typeof strategyPlan.planQualityTier === 'string'
        ? strategyPlan.planQualityTier : 'NONE';
      var pqLabel = pickLabel(PLAN_QUALITY_LABEL, pq, '등급 없음', TONE.UNKNOWN);
      add('PLAN_QUALITY_' + pq, pqLabel.labelKey, pqLabel.labelKo, pqLabel.labelEn, pqLabel.tone);
    }

    return chips;
  }

  // ==========================================================================
  // §metrics (DP-UI4 / DP-UI5)
  // metrics 는 array. 각 item = { id, labelKey, labelKo, labelEn, value, kind, tone, sortKey }.
  // ==========================================================================
  function buildMetrics(scoreBreakdown, structureDecision, signalCycle, strategyPlan, cfg) {
    var metrics = [];
    var order = 0;
    var push = function (id, labelKey, labelKo, labelEn, value, kind, tone) {
      metrics.push({
        id: id,
        labelKey: labelKey,
        labelKo: labelKo,
        labelEn: labelEn,
        value: value,
        kind: kind || 'string',
        tone: tone || TONE.NEUTRAL,
        sortKey: order
      });
      order = order + 1;
    };

    if (cfg.metrics.showTotalScore && isPlainObject(scoreBreakdown)) {
      var totalScore = safeNumber(scoreBreakdown.totalScore, null);
      var tone = TONE.NEUTRAL;
      if (typeof totalScore === 'number') {
        if (totalScore >= 80) tone = TONE.POSITIVE;
        else if (totalScore >= 60) tone = TONE.INFO;
        else if (totalScore >= 40) tone = TONE.NEUTRAL;
        else tone = TONE.MUTED;
      }
      push('METRIC_TOTAL_SCORE', 'TOTAL_SCORE', '총점', 'Total Score', totalScore, 'score', tone);
    }

    if (cfg.metrics.showStructureConfidence && isPlainObject(structureDecision)) {
      var conf = safeNumber(structureDecision.confidence, null);
      var ctone = TONE.NEUTRAL;
      if (typeof conf === 'number') {
        if (conf >= 80) ctone = TONE.POSITIVE;
        else if (conf >= 60) ctone = TONE.INFO;
        else if (conf >= 40) ctone = TONE.NEUTRAL;
        else ctone = TONE.MUTED;
      }
      push('METRIC_STRUCTURE_CONFIDENCE', 'STRUCTURE_CONFIDENCE', '구조 확신도', 'Structure Confidence', conf, 'percent', ctone);
    }

    if (cfg.metrics.showAgeBars && isPlainObject(signalCycle)) {
      var age = safeNumber(signalCycle.ageBars, null);
      push('METRIC_AGE_BARS', 'AGE_BARS', '신호 경과 봉', 'Age Bars', age, 'count', TONE.NEUTRAL);
    }

    if (cfg.metrics.showCyclePhase && isPlainObject(signalCycle)) {
      var phase = typeof signalCycle.cyclePhase === 'string' ? signalCycle.cyclePhase : 'UNKNOWN';
      var phaseLabel = pickLabel(CYCLE_PHASE_LABEL, phase, '단계 미상', TONE.UNKNOWN);
      push('METRIC_CYCLE_PHASE', 'CYCLE_PHASE_' + phase, '사이클 단계', 'Cycle Phase', phaseLabel.labelKo, 'enum', phaseLabel.tone);
    }

    if (cfg.metrics.showActionability && isPlainObject(strategyPlan)) {
      var ac = typeof strategyPlan.actionability === 'string' ? strategyPlan.actionability : 'NONE';
      var acLabel = pickLabel(ACTIONABILITY_LABEL, ac, '판단 없음', TONE.UNKNOWN);
      push('METRIC_ACTIONABILITY', 'ACTIONABILITY_' + ac, '실행 가능성', 'Actionability', acLabel.labelKo, 'enum', acLabel.tone);
    }

    if (cfg.metrics.showPlanQuality && isPlainObject(strategyPlan)) {
      var pq = typeof strategyPlan.planQualityTier === 'string'
        ? strategyPlan.planQualityTier : 'NONE';
      var pqLabel = pickLabel(PLAN_QUALITY_LABEL, pq, '등급 없음', TONE.UNKNOWN);
      push('METRIC_PLAN_QUALITY', 'PLAN_QUALITY_' + pq, '계획 등급', 'Plan Quality', pqLabel.labelKo, 'enum', pqLabel.tone);
    }

    return metrics;
  }

  // ==========================================================================
  // §sections.overview
  // ==========================================================================
  function buildOverviewSection(payload, identity) {
    var section = {
      symbol: identity.symbol,
      market: identity.market,
      timeframe: identity.timeframe,
      asOfTs: identity.asOfTs
    };
    if (isPlainObject(payload)) {
      var v = safeString(payload.payloadVersion, null);
      if (v) section.payloadVersion = v;
    }
    return section;
  }

  // ==========================================================================
  // §sections.score
  // ==========================================================================
  function buildScoreSection(scoreBreakdown) {
    if (!isPlainObject(scoreBreakdown)) {
      return {
        valid: false,
        version: null,
        totalScore: null,
        grossScore: null,
        riskPenalty: null,
        components: null
      };
    }
    var comp = isPlainObject(scoreBreakdown.components) ? scoreBreakdown.components : null;
    var pickComponent = function (name) {
      if (!comp || !isPlainObject(comp[name])) return null;
      var c = comp[name];
      return {
        score: safeNumber(c.score, null),
        maxScore: safeNumber(c.maxScore, null)
      };
    };
    return {
      valid: scoreBreakdown.valid === true,
      version: safeString(scoreBreakdown.version, null),
      totalScore: safeNumber(scoreBreakdown.totalScore, null),
      grossScore: safeNumber(scoreBreakdown.grossScore, null),
      riskPenalty: safeNumber(scoreBreakdown.riskPenalty, null),
      components: comp ? {
        structure: pickComponent('structure'),
        momentum: pickComponent('momentum'),
        volume: pickComponent('volume'),
        candle: pickComponent('candle'),
        execution: pickComponent('execution')
      } : null
    };
  }

  // ==========================================================================
  // §sections.structure
  // ==========================================================================
  function buildStructureSection(structureDecision) {
    if (!isPlainObject(structureDecision)) {
      return {
        valid: false,
        version: null,
        structureBucket: 'UNKNOWN',
        confidence: null,
        priceZone: null,
        labelKo: '구조 미상',
        tone: TONE.UNKNOWN
      };
    }
    var bucket = typeof structureDecision.structureBucket === 'string'
      ? structureDecision.structureBucket : 'UNKNOWN';
    var bucketLabel = pickLabel(STRUCTURE_BUCKET_LABEL, bucket, '구조 미상', TONE.UNKNOWN);

    var zone = null;
    if (isPlainObject(structureDecision.priceZone)) {
      var zoneKey = typeof structureDecision.priceZone.zone === 'string'
        ? structureDecision.priceZone.zone : 'UNKNOWN';
      var zoneLabel = pickLabel(PRICE_ZONE_LABEL, zoneKey, '구역 미상', TONE.UNKNOWN);
      zone = {
        zone: zoneKey,
        labelKo: zoneLabel.labelKo,
        tone: zoneLabel.tone,
        distancePct: safeNumber(structureDecision.priceZone.distancePct, null)
      };
    }

    return {
      valid: structureDecision.valid === true,
      version: safeString(structureDecision.version, null),
      structureBucket: bucket,
      labelKo: bucketLabel.labelKo,
      tone: bucketLabel.tone,
      confidence: safeNumber(structureDecision.confidence, null),
      priceZone: zone
    };
  }

  // ==========================================================================
  // §sections.cycle
  // ==========================================================================
  function buildCycleSection(signalCycle) {
    if (!isPlainObject(signalCycle)) {
      return {
        valid: false,
        version: null,
        cycleState: 'UNKNOWN',
        cyclePhase: 'UNKNOWN',
        bucketFamily: 'NONE',
        ageBars: null,
        stateLabelKo: '사이클 미상',
        phaseLabelKo: '단계 미상',
        stateTone: TONE.UNKNOWN,
        phaseTone: TONE.UNKNOWN
      };
    }
    var cs = typeof signalCycle.cycleState === 'string' ? signalCycle.cycleState : 'UNKNOWN';
    var cp = typeof signalCycle.cyclePhase === 'string' ? signalCycle.cyclePhase : 'UNKNOWN';
    var csLabel = pickLabel(CYCLE_STATE_LABEL, cs, '사이클 미상', TONE.UNKNOWN);
    var cpLabel = pickLabel(CYCLE_PHASE_LABEL, cp, '단계 미상', TONE.UNKNOWN);

    return {
      valid: signalCycle.valid === true,
      version: safeString(signalCycle.version, null),
      cycleState: cs,
      cyclePhase: cp,
      bucketFamily: typeof signalCycle.bucketFamily === 'string' ? signalCycle.bucketFamily : 'NONE',
      ageBars: safeNumber(signalCycle.ageBars, null),
      stateLabelKo: csLabel.labelKo,
      stateTone: csLabel.tone,
      phaseLabelKo: cpLabel.labelKo,
      phaseTone: cpLabel.tone
    };
  }

  // ==========================================================================
  // §sections.strategy (DP-UI9 / DP-UI11 — numeric hint 노출 허용 구역)
  // invalidationHint / targetHint / entryZone 은 여기서만 노출.
  // ==========================================================================
  function buildStrategySection(strategyPlan) {
    if (!isPlainObject(strategyPlan)) {
      return {
        valid: false,
        version: null,
        strategyBias: 'UNKNOWN',
        planType: 'NONE',
        actionability: 'NONE',
        planQualityTier: 'NONE',
        entry: null,
        exit: null,
        biasLabelKo: '판단 보류',
        biasTone: TONE.UNKNOWN
      };
    }
    var bias = typeof strategyPlan.strategyBias === 'string' ? strategyPlan.strategyBias : 'UNKNOWN';
    var biasLabel = pickLabel(STRATEGY_BIAS_LABEL, bias, '판단 보류', TONE.UNKNOWN);

    var entry = null;
    if (isPlainObject(strategyPlan.entryPlan)) {
      var ep = strategyPlan.entryPlan;
      entry = {
        valid: ep.valid === true,
        type: typeof ep.type === 'string' ? ep.type : 'NONE',
        entryZone: safeNumber(ep.entryZone, null),
        trigger: typeof ep.trigger === 'string' ? ep.trigger : null,
        setupInvalidationHint: safeNumber(ep.setupInvalidationHint, null),
        referencePrice: safeNumber(ep.referencePrice, null)
      };
    }

    var exit = null;
    if (isPlainObject(strategyPlan.exitPlan)) {
      var xp = strategyPlan.exitPlan;
      exit = {
        valid: xp.valid === true,
        type: typeof xp.type === 'string' ? xp.type : 'NONE',
        targetHint: safeNumber(xp.targetHint, null),
        invalidationHint: safeNumber(xp.invalidationHint, null),
        riskRewardHint: safeNumber(xp.riskRewardHint, null)
      };
    }

    return {
      valid: strategyPlan.valid === true,
      version: safeString(strategyPlan.version, null),
      strategyBias: bias,
      planType: typeof strategyPlan.planType === 'string' ? strategyPlan.planType : 'NONE',
      actionability: typeof strategyPlan.actionability === 'string' ? strategyPlan.actionability : 'NONE',
      planQualityTier: typeof strategyPlan.planQualityTier === 'string' ? strategyPlan.planQualityTier : 'NONE',
      entry: entry,
      exit: exit,
      biasLabelKo: biasLabel.labelKo,
      biasTone: biasLabel.tone
    };
  }

  // ==========================================================================
  // §sections.risk (DP-UI9 / DP-UI11 — numeric hint 노출 허용 구역)
  // ==========================================================================
  function buildRiskSection(strategyPlan, scoreBreakdown) {
    var riskLevel = 'UNKNOWN';
    if (isPlainObject(strategyPlan) && typeof strategyPlan.riskLevel === 'string') {
      riskLevel = strategyPlan.riskLevel;
    } else if (isPlainObject(scoreBreakdown) && isPlainObject(scoreBreakdown.risk)
               && typeof scoreBreakdown.risk.level === 'string') {
      riskLevel = scoreBreakdown.risk.level;
    }
    var rlLabel = pickLabel(RISK_LEVEL_LABEL, riskLevel, '리스크 미상', TONE.UNKNOWN);

    var penalty = null;
    var maxPenalty = null;
    if (isPlainObject(scoreBreakdown) && isPlainObject(scoreBreakdown.risk)) {
      penalty = safeNumber(scoreBreakdown.risk.penalty, null);
      maxPenalty = safeNumber(scoreBreakdown.risk.maxPenalty, null);
    }

    var rc = null;
    if (isPlainObject(strategyPlan) && isPlainObject(strategyPlan.riskControls)) {
      rc = {
        allowChase: strategyPlan.riskControls.allowChase === true,
        requirePullback: strategyPlan.riskControls.requirePullback === true,
        requireReclaim: strategyPlan.riskControls.requireReclaim === true,
        avoidIfWeakening: strategyPlan.riskControls.avoidIfWeakening === true,
        avoidIfCooldown: strategyPlan.riskControls.avoidIfCooldown === true
      };
    }

    return {
      riskLevel: riskLevel,
      labelKo: rlLabel.labelKo,
      tone: rlLabel.tone,
      penalty: penalty,
      maxPenalty: maxPenalty,
      controls: rc
    };
  }

  // ==========================================================================
  // §sections.debug (DP-UI8)
  //   기본: showDebug=false → null
  //   허용 노출:
  //     1. cardViewModel 자체 버전 / 모듈 버전 메타 (always)
  //     2. cfg.debug.allowedFields 에 명시된 builderDebug 필드 (whitelist)
  //   영구 차단 (whitelist 와 무관):
  //     - identityInput (object) / candles 배열 / rawCandles / candleArrays
  //     - payload.raw 객체 전체 / payload.raw.builderDebug 객체 전체
  //   추가 안전장치:
  //     - whitelist 통과 값이라도 primitive (string/number/boolean/null) 만 노출.
  //       object / array 는 자동 차단.
  // ==========================================================================
  function buildDebugSection(payload, scoreBreakdown, structureDecision, signalCycle, strategyPlan, cfg) {
    if (!cfg.sections.showDebug) return null;

    var debug = {
      cardViewModelVersion: CARD_VIEW_MODEL_VERSION
    };
    if (isPlainObject(scoreBreakdown) && typeof scoreBreakdown.version === 'string') {
      debug.scoreVersion = scoreBreakdown.version;
    }
    if (isPlainObject(structureDecision) && typeof structureDecision.version === 'string') {
      debug.structureVersion = structureDecision.version;
    }
    if (isPlainObject(signalCycle) && typeof signalCycle.version === 'string') {
      debug.cycleVersion = signalCycle.version;
    }
    if (isPlainObject(strategyPlan) && typeof strategyPlan.version === 'string') {
      debug.strategyVersion = strategyPlan.version;
    }

    // 영구 차단 필드 (whitelist 통과해도 노출 X)
    var BLOCKED_FIELDS = ['identityInput', 'candles', 'rawCandles', 'candleArrays', 'raw', 'builderDebug'];

    var allowed = Array.isArray(cfg.debug.allowedFields) ? cfg.debug.allowedFields : [];
    if (allowed.length === 0) return debug;

    var bd = (isPlainObject(payload) && isPlainObject(payload.raw)
              && isPlainObject(payload.raw.builderDebug)) ? payload.raw.builderDebug : null;
    if (!bd) return debug;

    for (var i = 0; i < allowed.length; i = i + 1) {
      var f = allowed[i];
      if (typeof f !== 'string' || !f) continue;
      if (BLOCKED_FIELDS.indexOf(f) !== -1) continue;
      if (!Object.prototype.hasOwnProperty.call(bd, f)) continue;
      var v = bd[f];
      // primitive only — object / array 자동 차단
      if (v === null) {
        debug[f] = null;
      } else if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
        debug[f] = v;
      }
    }

    return debug;
  }

  // ==========================================================================
  // §displayFlags (DP-UI7 / r0.2-final — 정확히 10개 boolean)
  //   isReady              — signalCycle.signalQuality.ready === true
  //   isBlocked            — actionability === 'BLOCKED' or bias in {NO_TRADE, RISK_OFF}
  //   isCooldown           — cycleState === 'COOLDOWN' or bias === 'COOLDOWN_WAIT'
  //   isExpired            — cycleState === 'EXPIRED' or bias === 'EXPIRED_IGNORE'
  //   isWeakening          — cycleState === 'WEAKENING'
  //   isHighActionability  — actionability === 'HIGH'
  //   showEntryPlan        — strategyPlan.entryPlan.valid === true
  //   showExitPlan         — strategyPlan.exitPlan.valid === true
  //   showRiskWarning      — isBlocked || isWeakening || riskLevel === 'HIGH'
  //   showDebug            — cfg.sections.showDebug === true
  // ==========================================================================
  function buildDisplayFlags(strategyPlan, signalCycle, cfg) {
    var actionability = (isPlainObject(strategyPlan) && typeof strategyPlan.actionability === 'string')
      ? strategyPlan.actionability : 'NONE';
    var bias = (isPlainObject(strategyPlan) && typeof strategyPlan.strategyBias === 'string')
      ? strategyPlan.strategyBias : 'UNKNOWN';
    var cycleState = (isPlainObject(signalCycle) && typeof signalCycle.cycleState === 'string')
      ? signalCycle.cycleState : 'UNKNOWN';

    var ready = false;
    if (isPlainObject(signalCycle) && isPlainObject(signalCycle.signalQuality)) {
      ready = signalCycle.signalQuality.ready === true;
    }

    var isBlocked = (actionability === 'BLOCKED' || bias === 'NO_TRADE' || bias === 'RISK_OFF');
    var isCooldown = (cycleState === 'COOLDOWN' || bias === 'COOLDOWN_WAIT');
    var isExpired = (cycleState === 'EXPIRED' || bias === 'EXPIRED_IGNORE');
    var isWeakening = (cycleState === 'WEAKENING');
    var isHighActionability = (actionability === 'HIGH');

    var showEntryPlan = false;
    var showExitPlan = false;
    if (isPlainObject(strategyPlan)) {
      if (isPlainObject(strategyPlan.entryPlan)) showEntryPlan = strategyPlan.entryPlan.valid === true;
      if (isPlainObject(strategyPlan.exitPlan)) showExitPlan = strategyPlan.exitPlan.valid === true;
    }

    var riskLevel = (isPlainObject(strategyPlan) && typeof strategyPlan.riskLevel === 'string')
      ? strategyPlan.riskLevel : 'UNKNOWN';
    var showRiskWarning = (isBlocked || isWeakening || riskLevel === 'HIGH');

    return {
      isReady: ready === true,
      isBlocked: isBlocked === true,
      isCooldown: isCooldown === true,
      isExpired: isExpired === true,
      isWeakening: isWeakening === true,
      isHighActionability: isHighActionability === true,
      showEntryPlan: showEntryPlan === true,
      showExitPlan: showExitPlan === true,
      showRiskWarning: showRiskWarning === true,
      showDebug: cfg.sections.showDebug === true
    };
  }

  // ==========================================================================
  // §tone — card overall tone
  // ==========================================================================
  function buildOverallTone(strategyPlan, signalCycle, displayFlags) {
    if (displayFlags.isExpired) return TONE.CRITICAL;
    if (displayFlags.isBlocked) return TONE.WARNING;
    if (displayFlags.isCooldown) return TONE.CAUTION;
    if (displayFlags.isWeakening) return TONE.WARNING;
    if (displayFlags.isHighActionability) return TONE.POSITIVE;

    var bias = (isPlainObject(strategyPlan) && typeof strategyPlan.strategyBias === 'string')
      ? strategyPlan.strategyBias : 'UNKNOWN';
    if (bias === 'UNKNOWN') return TONE.UNKNOWN;
    if (bias === 'WATCH_ONLY' || bias === 'PULLBACK_WAIT') return TONE.NEUTRAL;
    if (bias === 'BREAKOUT_READY' || bias === 'RECLAIM_READY' || bias === 'MOMENTUM_FOLLOW') return TONE.POSITIVE;
    return TONE.NEUTRAL;
  }

  // ==========================================================================
  // §reasons / warnings dedupe (4종 산출 객체로부터 누적)
  // ==========================================================================
  function collectReasonsAndWarnings(scoreBreakdown, structureDecision, signalCycle, strategyPlan) {
    var reasons = [];
    var warnings = [];

    var sources = [scoreBreakdown, structureDecision, signalCycle, strategyPlan];
    for (var i = 0; i < sources.length; i = i + 1) {
      var src = sources[i];
      if (!isPlainObject(src)) continue;
      if (Array.isArray(src.reasons)) {
        for (var j = 0; j < src.reasons.length; j = j + 1) {
          pushUnique(reasons, String(src.reasons[j]));
        }
      }
      if (Array.isArray(src.warnings)) {
        for (var k = 0; k < src.warnings.length; k = k + 1) {
          pushUnique(warnings, String(src.warnings[k]));
        }
      }
    }
    return { reasons: reasons, warnings: warnings };
  }

  // ==========================================================================
  // §normalize 출력
  // ==========================================================================
  function normalizeCardViewModel(result) {
    return {
      valid: result.valid === true,
      version: CARD_VIEW_MODEL_VERSION,
      identity: result.identity,
      header: result.header,
      chips: Array.isArray(result.chips) ? result.chips.slice() : [],
      metrics: Array.isArray(result.metrics) ? result.metrics.slice() : [],
      sections: result.sections,
      displayFlags: result.displayFlags,
      tone: typeof result.tone === 'string' ? result.tone : TONE.UNKNOWN,
      reasons: Array.isArray(result.reasons) ? result.reasons.slice() : [],
      warnings: Array.isArray(result.warnings) ? result.warnings.slice() : [],
      debug: result.debug,
      configUsed: result.configUsed
    };
  }

  // ==========================================================================
  // §main — buildCardViewModel
  // ==========================================================================
  /**
   * payload + scoreBreakdown + structureDecision + signalCycle + strategyPlan
   * → standalone cardViewModel (UI-ready). 모든 입력 mutate 0건 (DP-UI1).
   *
   * @param {Object} payload
   * @param {Object} [scoreBreakdown]
   * @param {Object} [structureDecision]
   * @param {Object} [signalCycle]
   * @param {Object} [strategyPlan]
   * @param {Object} [config]
   * @return {Object} cardViewModel
   */
  function buildCardViewModel(payload, scoreBreakdown, structureDecision, signalCycle, strategyPlan, config) {
    var cfg = mergeCardViewModelConfig(config);
    var configUsed = makeConfigUsed(cfg);

    var topWarnings = [];
    if (!isPlainObject(payload)) topWarnings.push('PAYLOAD_NOT_OBJECT');
    if (!isPlainObject(strategyPlan)) topWarnings.push('STRATEGY_PLAN_NOT_OBJECT');
    if (!isPlainObject(signalCycle)) topWarnings.push('SIGNAL_CYCLE_NOT_OBJECT');
    if (!isPlainObject(structureDecision)) topWarnings.push('STRUCTURE_DECISION_NOT_OBJECT');
    if (!isPlainObject(scoreBreakdown)) topWarnings.push('SCORE_BREAKDOWN_NOT_OBJECT');

    var identity = buildIdentity(payload);
    var header = buildHeader(strategyPlan, signalCycle, identity);
    var chips = buildChips(strategyPlan, signalCycle, structureDecision, cfg);
    var metrics = buildMetrics(scoreBreakdown, structureDecision, signalCycle, strategyPlan, cfg);

    var sections = {
      overview: buildOverviewSection(payload, identity),
      score: buildScoreSection(scoreBreakdown),
      structure: buildStructureSection(structureDecision),
      cycle: buildCycleSection(signalCycle),
      strategy: buildStrategySection(strategyPlan),
      risk: buildRiskSection(strategyPlan, scoreBreakdown),
      debug: buildDebugSection(payload, scoreBreakdown, structureDecision, signalCycle, strategyPlan, cfg)
    };

    var displayFlags = buildDisplayFlags(strategyPlan, signalCycle, cfg);
    var tone = buildOverallTone(strategyPlan, signalCycle, displayFlags);

    var collected = collectReasonsAndWarnings(scoreBreakdown, structureDecision, signalCycle, strategyPlan);
    var topReasons = collected.reasons;
    var mergedWarnings = collected.warnings.slice();
    for (var w = 0; w < topWarnings.length; w = w + 1) {
      pushUnique(mergedWarnings, topWarnings[w]);
    }

    var valid = isPlainObject(payload) && isPlainObject(strategyPlan);

    return normalizeCardViewModel({
      valid: valid,
      identity: identity,
      header: header,
      chips: chips,
      metrics: metrics,
      sections: sections,
      displayFlags: displayFlags,
      tone: tone,
      reasons: topReasons,
      warnings: mergedWarnings,
      debug: {
        source: 'payload + scoreBreakdown + structureDecision + signalCycle + strategyPlan',
        configVersion: cfg.version
      },
      configUsed: configUsed
    });
  }

  // ==========================================================================
  // §export — 이중 환경
  // ==========================================================================
  var api = Object.freeze({
    CARD_VIEW_MODEL_VERSION: CARD_VIEW_MODEL_VERSION,
    CONFIG_VERSION: CONFIG_VERSION,
    DEFAULT_CARD_VIEW_MODEL_CONFIG: DEFAULT_CARD_VIEW_MODEL_CONFIG,
    TONE: TONE,
    STRATEGY_BIAS_LABEL: STRATEGY_BIAS_LABEL,
    CYCLE_STATE_LABEL: CYCLE_STATE_LABEL,
    CYCLE_PHASE_LABEL: CYCLE_PHASE_LABEL,
    ACTIONABILITY_LABEL: ACTIONABILITY_LABEL,
    PLAN_QUALITY_LABEL: PLAN_QUALITY_LABEL,
    STRUCTURE_BUCKET_LABEL: STRUCTURE_BUCKET_LABEL,
    PRICE_ZONE_LABEL: PRICE_ZONE_LABEL,
    RISK_LEVEL_LABEL: RISK_LEVEL_LABEL,

    build: buildCardViewModel,
    mergeCardViewModelConfig: mergeCardViewModelConfig,

    buildIdentity: buildIdentity,
    buildHeader: buildHeader,
    buildChips: buildChips,
    buildMetrics: buildMetrics,
    buildOverviewSection: buildOverviewSection,
    buildScoreSection: buildScoreSection,
    buildStructureSection: buildStructureSection,
    buildCycleSection: buildCycleSection,
    buildStrategySection: buildStrategySection,
    buildRiskSection: buildRiskSection,
    buildDebugSection: buildDebugSection,
    buildDisplayFlags: buildDisplayFlags,
    buildOverallTone: buildOverallTone,

    safeNumber: safeNumber,
    isPlainObject: isPlainObject,
    normalizeCardViewModel: normalizeCardViewModel
  });

  global.WS3_CardViewModel = api;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis
   : typeof window !== 'undefined' ? window
   : typeof self !== 'undefined' ? self
   : this);
/* @v3-inline-end */
// ════════════════════════════════════════════════════════════════════════
// END: WS3 v3 module inline bundle
// ════════════════════════════════════════════════════════════════════════


// ════════════════════════════════════════════════════════════════════════
// WS3 v0.34.0 P0-v1.1 신규 함수 (Worker pipeline / grade / timeframe)
// ════════════════════════════════════════════════════════════════════════

/**
 * 백서 §6.2 등급 체계 — v3-config.js WS3_GRADE_BANDS 와 100% 일치
 * S+ (>=90) / S (>=82) / A (>=72) / B (>=60) / C (>=40) / NONE (<40)
 * v0.34.0 신규 — P0-v1.1 (기존 classifyCandidateDryRunGrade 의 P-prefix 출력 대체)
 */
function classifyV3Grade(score) {
  if (typeof score !== 'number' || !isFinite(score)) return 'NONE';
  if (score >= 90) return 'S+';
  if (score >= 82) return 'S';
  if (score >= 72) return 'A';
  if (score >= 60) return 'B';
  if (score >= 40) return 'C';
  return 'NONE';
}

/**
 * 사용자 timeframe → v3 featurePayload primary timeframe key 매핑
 * v3-feature-payload.js / v3-feature-payload-builder.js DEFAULT_PRIMARY_TIMEFRAME = 'h1'
 * v0.34.0 신규 — P0-v1.1
 */
function mapToV3Timeframe(uiTimeframe) {
  var map = {
    '1m':  'm5',   // 1m 은 v3 미지원 → m5 fallback
    '5m':  'm5',
    '15m': 'm15',
    '1h':  'h1',
    '4h':  'h4',
    '1d':  'd1',
    'm5':  'm5',
    'm15': 'm15',
    'h1':  'h1',
    'h4':  'h4',
    'd1':  'd1'
  };
  return map[String(uiTimeframe || '').toLowerCase()] || 'h1';
}
/**
 * WS3 v0.25.0 — Canary Web MVP Worker (Operator Reset / State Lifecycle)
 *
 * 별도 Cloudflare Worker. 기존 worker.js 본선을 수정하지 않는다.
 *
 * Route:
 *   GET     /health
 *   POST    /send-canary
 *   GET     /state            (v0.23 — safe persistent state read; v0.25 currentPhase+resetCount 추가)
 *   POST    /cleanup-confirm  (v0.23 — manual cleanup ack)
 *   POST    /operator-reset   (v0.25 신규 — operator reset, 7중 조건 보호, Telegram 발송 0건)
 *   OPTIONS /health, /send-canary, /state, /cleanup-confirm, /operator-reset (CORS preflight)
 *
 * v0.25 핵심 정책:
 *   /operator-reset 은 ALREADY_SENT_PERSISTENT 우회문 가능성이 있으므로 7중 조건으로 보호:
 *     1) Origin allowlist 통과
 *     2) X-WS3-Canary-Token === env.WS3_CANARY_INVOKE_TOKEN exact
 *     3) body.manualTrigger === true
 *     4) body.resetPhrase === "RESET_WS3_CANARY_STATE" (byte-for-byte exact, hardcoded)
 *     5) env.WS3_TELEGRAM_CANARY_ENABLED === 'false' (canary disabled 강제)
 *     6) KV cleanupRequired === false (cleanup-confirm 이미 완료)
 *     7) KV persistenceAvailable === true
 *   추가: KV circuitOpen === true 면 CIRCUIT_OPEN_RESET_BLOCKED 차단.
 *   추가: lastResetAt 기준 60s 이내 재-reset 시 RESET_COOLDOWN_ACTIVE.
 *   reset 은 alreadySent=false 로만 전환 + resetCount 증가 + lastResetAt 기록 — Telegram 발송 / secret
 *   변경 / failure counter 삭제 / circuit 강제 해제 0건.
 *
 * 정책:
 *   - 실제 Telegram API 호출은 v0.21 telegramCanarySender.dispatchCanary 가 deps.fetchImpl 로만 호출.
 *   - canary 전용 KV (binding WS3_CANARY_STATE_KV, prefix `ws3:canary:`) 만 write/read. 본선 / 실코인 /
 *     Snapshot / Evaluation / Audit KV write 금지.
 *   - KV binding 없으면 Send Canary fallback 금지. process memory fallback 금지 — PERSISTENCE_UNAVAILABLE 반환.
 *   - Origin allowlist (env.WS3_CANARY_ALLOWED_ORIGINS, comma-separated) + invoke token (env.WS3_CANARY_INVOKE_TOKEN)
 *     + manualTrigger=true + persistent guards (alreadySent / cleanupRequired / circuit / invokeFail) 모두
 *     만족 시에만 dispatchCanary 호출.
 *   - per-process state 는 transient 보조 (best effort). persistent enforcement 는 KV.
 *
 * v0.23 KV strict 한계 (r0.2-final 박제):
 *   KV alreadySent 는 strict distributed lock 이 아니다. persistent safety guard 다. 동시 다중 worker isolate
 *   에서 정확히 1회 보장은 KV eventual consistency / read-modify-write race 로 불완전. strict one-time
 *   guarantee 는 v0.24+ Durable Objects 또는 atomic lock 설계 에서 검토.
 *
 * v0.23 보안 의존성 (best effort layered defense):
 *   1) Origin allowlist  2) High entropy invoke token  3) manualTrigger  4) 24h authorized_at expire
 *   5) KV persistent alreadySent  6) KV cleanupRequired  7) KV persistent circuit  8) KV persistent
 *      invoke-token failure counter (per originHash)  9) UI throttle.
 *
 * export:
 *   module.exports = { handleFetch, default: { fetch: handleFetch }, ... }
 *   Cloudflare workers ES module 변환은 entry shim (ws3-telegram-canary-entry.mjs) 에서 진행.
 *
 * 실제 Telegram canary 1회 발송: 사용자 별도 승인 후 별도 단계에서 진행. v0.23 코드 작성 단계 0건.
 */
'use strict';

var RuntimeStateAdapter = require('../v3/v3-secure-runtime-state-adapter.js');
var TelegramCanarySender = require('../v3/v3-telegram-canary-sender.js');
var CanaryStateKvAdapter = require('./ws3-canary-state-kv-adapter.js');

// §constants ───────────────────────────────────────────────────────────
var VERSION = 'WS3_v0.35.0_phase1_card_connection';
var SERVICE = 'WS3_CANARY_WEB_MVP';
var STATUS_READY_CODE = 'CANARY_READY';
var MAX_BODY_BYTES = 1024;
var INVOKE_TOKEN_MISMATCH_THRESHOLD = 5;
var INVOKE_TOKEN_MISMATCH_BLOCK_MS = 24 * 60 * 60 * 1000;
var CANARY_MESSAGE_TYPE = 'CANARY_TEST_ONLY';

// §v0.23 persistent guard constants
var KV_BINDING_NAME = 'WS3_CANARY_STATE_KV';
var CIRCUIT_PERSISTENT_FAIL_THRESHOLD = 3;
var CIRCUIT_PERSISTENT_BLOCK_MS = 24 * 60 * 60 * 1000;
var INVOKE_TOKEN_PERSISTENT_THRESHOLD = 5;
var INVOKE_TOKEN_PERSISTENT_BLOCK_MS = 24 * 60 * 60 * 1000;
var CLEANUP_REASON_LIVE_SENT = 'LIVE_CANARY_SENT';

// §v0.25 operator reset constants
var OPERATOR_RESET_PHRASE = 'RESET_WS3_CANARY_STATE';
var OPERATOR_RESET_COOLDOWN_MS = 60 * 1000;
var OPERATOR_RESET_REASON = 'OPERATOR_RESET_CONFIRMED';

// v0.27 — Actual Coin Live Preflight (read-only public market data preview)
//   NO Telegram send / NO KV write / NO candidate store / NO tracking start.
//   Direct exchange public endpoint fetch with 5s timeout.
var LIVE_PREFLIGHT_MODE = 'LIVE_PREFLIGHT_ONLY';
var LIVE_PREFLIGHT_FETCH_TIMEOUT_MS = 5000;
var LIVE_PREFLIGHT_LIMIT_MIN = 1;
var LIVE_PREFLIGHT_LIMIT_MAX = 60;
var LIVE_PREFLIGHT_ALLOWED_EXCHANGES = ['upbit', 'bithumb', 'binance'];
var LIVE_PREFLIGHT_ALLOWED_TIMEFRAMES = ['1m', '5m', '15m', '1h'];
// market string sanitize — alphanumeric + - _ only, length 2..32
var LIVE_PREFLIGHT_MARKET_PATTERN = /^[A-Za-z0-9_\-]{2,32}$/;

// v0.28 — Actual Coin Candidate Dry-run (read-only feature calc + dry-run score)
//   NO Telegram send / NO KV write / NO candidate store / NO tracking start.
//   Reuses v0.27 fetch/normalize helpers + adds feature/score/grade calc.
var CANDIDATE_DRY_RUN_MODE = 'CANDIDATE_DRY_RUN_ONLY';
var CANDIDATE_DRY_RUN_LIMIT_MIN = 1;
var CANDIDATE_DRY_RUN_LIMIT_MAX = 120;
var CANDIDATE_DRY_RUN_REASON_CHIP_MAX = 8;
// Exchanges / timeframes / market pattern reuse LIVE_PREFLIGHT_* constants (same v0.27 allowlist).

// v0.29 — Integrated Limited Live Pipeline
//   /multi-candidate-dry-run: multi-market parallel dry-run (NO Telegram / NO KV write)
//   /send-candidate-test: TEST_ONLY Telegram send for ONE selected candidate (KV duplicate guard write only)
//   Limited Live Mode skeleton: DISABLED by default. No cron, no auto alert.
var MULTI_CANDIDATE_DRY_RUN_MODE = 'MULTI_CANDIDATE_DRY_RUN_ONLY';
var MULTI_CANDIDATE_MAX_MARKETS = 50;
var CANDIDATE_TEST_MODE = 'CANDIDATE_TEST_ONLY';
var CANDIDATE_TEST_CONFIRM_PHRASE = 'SEND_WS3_TEST_CANDIDATE';
var CANDIDATE_TEST_MESSAGE_TYPE = 'CANDIDATE_TEST_ONLY';
var CANDIDATE_TEST_GUARD_KEY = 'ws3:canary:candidateTestSent';
var CANDIDATE_TEST_GUARD_REASON = 'CANDIDATE_TEST_SENT';
var CANDIDATE_TEST_GUARD_WINDOW_MS = 60 * 1000; // 60s minimum gap between sends
var LIMITED_LIVE_MODE_STATUS = 'DISABLED';

// v0.30 — Forced Candidate TEST_ONLY Telegram (Telegram path validation when no natural candidate)
//   forceTestCandidate=true 모드 시 isCandidate=false dry-run 결과도 TEST_ONLY 로 1회 발송 가능
//   별도 confirmPhrase + forcedTestReason 필수 / FORCED preamble 강제 / candidate 저장 0건 / tracking 시작 0건
//   동일 KV guard key 재사용 (messageType 으로 audit 구분, 60s 윈도우 공통)
var FORCED_CANDIDATE_TEST_MODE = 'FORCED_TEST_ONLY';
var FORCED_CANDIDATE_TEST_MESSAGE_TYPE = 'FORCED_CANDIDATE_TEST_ONLY';
var FORCED_CANDIDATE_TEST_CONFIRM_PHRASE = 'SEND_WS3_FORCED_TEST_CANDIDATE';
var FORCED_CANDIDATE_TEST_GUARD_REASON = 'FORCED_CANDIDATE_TEST_SENT';
var FORCED_CANDIDATE_TEST_REASON_MAX_LEN = 128;
var FORCED_CANDIDATE_TEST_REASON_PATTERN = /^[A-Za-z0-9 _\-\.\,\:\!\?\(\)\[\]\/]{1,128}$/;

// v0.31 — Web-first Minimum Operator Mode (LIMITED LIVE / OPERATOR REVIEW)
//   Operator-review flag on multi-candidate results + dedicated /send-limited-live-alert endpoint.
//   Separate enable env (WS3_LIMITED_LIVE_ENABLED) + separate confirmPhrase + per-(market,timeframe) KV guard.
//   NO Cron / NO auto Telegram / NO candidate store / NO tracking start.
var LIMITED_LIVE_MODE = 'LIMITED_LIVE_OPERATOR_REVIEW';
var LIMITED_LIVE_MESSAGE_TYPE = 'LIMITED_LIVE_OPERATOR_REVIEW';
var LIMITED_LIVE_CONFIRM_PHRASE = 'SEND_WS3_LIMITED_LIVE_REVIEW';
var LIMITED_LIVE_GUARD_KEY_PREFIX = 'ws3:canary:limitedLiveAlertSent:';
var LIMITED_LIVE_GUARD_REASON = 'LIMITED_LIVE_REVIEW_SENT';
var LIMITED_LIVE_GUARD_WINDOW_MS = 60 * 1000; // 60s per-(market,timeframe) cooldown

// v0.32.1 — No Invoke Token / Dev Open Operator UX Patch
//   Speed-over-security: operator-side routes (state, multi-candidate-dry-run,
//   send-limited-live-alert, live-preflight, candidate-dry-run) skip the Invoke
//   Token check so the web console can call them without prompting the operator
//   for a token. Routes with real side-effect risk (send-canary, cleanup-confirm,
//   operator-reset, send-candidate-test) keep the token check.
//   Telegram fixed-text path, KV write scope, duplicate guard, confirmPhrase, and
//   env-gate (WS3_LIMITED_LIVE_ENABLED) are all unchanged — the only relaxation
//   is the Invoke Token requirement on operator-UX routes.
//   Final security (Cloudflare Access / Pages Function proxy / server-side token
//   custody / origin allowlist hardening / invite gate re-activation) is deferred
//   to a separate gate before public release.
var WS3_OPERATOR_AUTH_MODE = 'DEV_OPEN';
function isDevOpenOperatorRoute(pathname) {
  return pathname === '/state'
    || pathname === '/multi-candidate-dry-run'
    || pathname === '/send-limited-live-alert'
    || pathname === '/live-preflight'
    || pathname === '/candidate-dry-run';
}

// §per-process state (Cloudflare isolate cold-start 시 초기화 — best effort)
var CANARY_PROCESS_STATE = {
  alreadySent: false,
  lastSentAt: 0,
  consecutiveFailures: 0,
  circuitOpenUntil: 0,
  invokeTokenMismatchCount: 0,
  invokeTokenMismatchBlockedUntil: 0
};

// §helpers ─────────────────────────────────────────────────────────────

function isPlainObject(v) {
  if (v === null || v === undefined) return false;
  if (typeof v !== 'object') return false;
  if (Array.isArray(v)) return false;
  return true;
}

function trimString(s) {
  if (typeof s !== 'string') return '';
  return s.replace(/^\s+|\s+$/g, '');
}

function isAllowedOrigin(origin, env) {
  if (typeof origin !== 'string' || origin.length === 0) return false;
  if (!env || typeof env.WS3_CANARY_ALLOWED_ORIGINS !== 'string') return false;
  var parts = env.WS3_CANARY_ALLOWED_ORIGINS.split(',');
  var i;
  for (i = 0; i < parts.length; i++) {
    var p = trimString(parts[i]);
    if (p.length > 0 && p === origin) return true;
  }
  return false;
}

function buildCorsHeaders(allowed, origin) {
  // returns plain object (field-by-field; no Object.assign / spread)
  var h = { 'Content-Type': 'application/json; charset=utf-8' };
  if (allowed === true && typeof origin === 'string') {
    h['Access-Control-Allow-Origin'] = origin;
    h['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS';
    h['Access-Control-Allow-Headers'] = 'Content-Type, X-WS3-Canary-Token';
    h['Access-Control-Max-Age'] = '600';
    h['Access-Control-Allow-Credentials'] = 'false';
    h['Vary'] = 'Origin';
  }
  return h;
}

function jsonResponse(body, status, allowed, origin) {
  var headers = buildCorsHeaders(allowed, origin);
  if (typeof Response === 'undefined') {
    return { _mockResponse: true, status: status, body: body, headers: headers };
  }
  return new Response(JSON.stringify(body), { status: status, headers: headers });
}

function emptyResponse(status, allowed, origin) {
  var headers = buildCorsHeaders(allowed, origin);
  if (typeof Response === 'undefined') {
    return { _mockResponse: true, status: status, body: null, headers: headers };
  }
  return new Response(null, { status: status, headers: headers });
}

function makeWorkerSafeError(code) {
  return { ws3WorkerSafeCode: code };
}

function getWorkerSafeErrorCode(err, fallback) {
  if (err && typeof err.ws3WorkerSafeCode === 'string') return err.ws3WorkerSafeCode;
  return fallback;
}

function workerSafeErrorResponse(code, allowed, origin) {
  return jsonResponse({ ok: false, status: 'ERROR', code: code, httpStatus: 500 }, 500, allowed, origin);
}

function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function resolveRuntimeFunction(resolvedDeps, key, globalFactory) {
  if (isPlainObject(resolvedDeps) && hasOwn(resolvedDeps, key)) {
    return (typeof resolvedDeps[key] === 'function') ? resolvedDeps[key] : null;
  }
  return (typeof globalFactory === 'function') ? globalFactory() : null;
}

function buildWorkerRuntimeDeps(resolvedDeps, nowMs, state) {
  var rawFetch = resolveRuntimeFunction(resolvedDeps, 'fetchImpl', function() {
    if (typeof fetch !== 'function') return null;
    return function(url, init) { return fetch(url, init); };
  });
  var RawAbortController = resolveRuntimeFunction(resolvedDeps, 'AbortControllerImpl', function() {
    if (typeof AbortController !== 'function') return null;
    return function() { return new AbortController(); };
  });
  var rawSetTimeout = resolveRuntimeFunction(resolvedDeps, 'setTimeoutImpl', function() {
    if (typeof setTimeout !== 'function') return null;
    return function(fn, ms) { return setTimeout(fn, ms); };
  });
  var rawClearTimeout = resolveRuntimeFunction(resolvedDeps, 'clearTimeoutImpl', function() {
    if (typeof clearTimeout !== 'function') return null;
    return function(handle) { return clearTimeout(handle); };
  });

  if (rawFetch === null) return { ok: false, code: 'WORKER_DEP_FETCH_FAILED' };
  if (RawAbortController === null) return { ok: false, code: 'WORKER_DEP_ABORT_CONTROLLER_FAILED' };
  if (rawSetTimeout === null || rawClearTimeout === null) return { ok: false, code: 'WORKER_DEP_TIMER_FAILED' };

  function safeFetch(url, init) {
    try {
      return rawFetch(url, init);
    } catch (e) {
      throw makeWorkerSafeError('WORKER_DEP_FETCH_FAILED');
    }
  }

  function SafeAbortController() {
    try {
      return new RawAbortController();
    } catch (e) {
      throw makeWorkerSafeError('WORKER_DEP_ABORT_CONTROLLER_FAILED');
    }
  }

  function safeSetTimeout(fn, ms) {
    try {
      return rawSetTimeout(fn, ms);
    } catch (e) {
      throw makeWorkerSafeError('WORKER_DEP_TIMER_FAILED');
    }
  }

  function safeClearTimeout(handle) {
    try {
      return rawClearTimeout(handle);
    } catch (e) {
      throw makeWorkerSafeError('WORKER_DEP_TIMER_FAILED');
    }
  }

  return {
    ok: true,
    deps: {
      fetchImpl: safeFetch,
      AbortControllerImpl: SafeAbortController,
      setTimeoutImpl: safeSetTimeout,
      clearTimeoutImpl: safeClearTimeout,
      nowMs: nowMs,
      state: state
    }
  };
}

// §minimal v0.19 preflightGate fixture (canary 한정 단순 path)
//   v0.22 canary worker 는 LIVE pipeline 전체 의존 없이 canary 단일 path 만 사용.
//   v0.19 preflightGate 결과의 'PREFLIGHT_READY for telegram' 시나리오만 필요.
function buildMinimalPreflightGate() {
  return {
    valid: true,
    preflightStatus: 'PREFLIGHT_READY',
    preflightMode: 'PREFLIGHT_ONLY',
    liveExecutionAllowed: false,
    telegramPreflight: { ready: true }
  };
}

// §v0.21 errorCode → web safe code mapping (DP-CANARY-WEB)
function mapErrorCodeToWeb(errorCode) {
  if (typeof errorCode !== 'string') return { code: 'UNKNOWN_ERROR', httpStatus: 500, status: 'ERROR' };
  if (errorCode === 'CANARY_TIMEOUT') return { code: 'CANARY_TIMEOUT', httpStatus: 504, status: 'ERROR' };
  if (errorCode === 'CANARY_RATE_LIMITED') return { code: 'CANARY_RATE_LIMITED', httpStatus: 429, status: 'BLOCKED' };
  if (errorCode === 'CANARY_CIRCUIT_OPEN') return { code: 'CANARY_CIRCUIT_OPEN', httpStatus: 503, status: 'BLOCKED' };
  if (errorCode === 'CANARY_AUTH_ERROR') return { code: 'TELEGRAM_AUTH_ERROR', httpStatus: 502, status: 'ERROR' };
  if (errorCode === 'CANARY_NOT_FOUND') return { code: 'TELEGRAM_NOT_FOUND', httpStatus: 502, status: 'ERROR' };
  if (errorCode === 'CANARY_NETWORK_ERROR') return { code: 'TELEGRAM_NETWORK_ERROR', httpStatus: 502, status: 'ERROR' };
  if (errorCode.indexOf('CANARY_BLOCKED:') === 0) {
    var sub = errorCode.substring('CANARY_BLOCKED:'.length);
    if (sub === 'CANARY_NOT_ENABLED') return { code: 'CANARY_DISABLED', httpStatus: 503, status: 'BLOCKED' };
    if (sub === 'BOT_TOKEN_MISSING') return { code: 'MISSING_TOKEN', httpStatus: 503, status: 'BLOCKED' };
    if (sub === 'CHAT_ID_MISSING') return { code: 'MISSING_CHAT_ID', httpStatus: 503, status: 'BLOCKED' };
    if (sub === 'GATE1_CANARY_NOT_ENABLED') return { code: 'CANARY_DISABLED', httpStatus: 503, status: 'BLOCKED' };
    if (sub === 'GATE2_AUTHORIZED_AT_EXPIRED') return { code: 'AUTH_EXPIRED', httpStatus: 403, status: 'BLOCKED' };
    if (sub === 'GATE2_AUTHORIZED_AT_MISSING') return { code: 'AUTH_EXPIRED', httpStatus: 403, status: 'BLOCKED' };
    if (sub === 'GATE2_AUTHORIZED_AT_INVALID') return { code: 'AUTH_EXPIRED', httpStatus: 403, status: 'BLOCKED' };
    if (sub === 'GATE3_INVOKE_TOKEN_MISMATCH') return { code: 'INVOKE_TOKEN_MISMATCH', httpStatus: 403, status: 'BLOCKED' };
    if (sub === 'GATE3_INVOKE_TOKEN_MISSING') return { code: 'MISSING_INVOKE_TOKEN', httpStatus: 401, status: 'BLOCKED' };
    if (sub === 'GATE3_INVOKE_TOKEN_ENV_MISSING') return { code: 'MISSING_INVOKE_TOKEN', httpStatus: 503, status: 'BLOCKED' };
    if (sub === 'GATE4_MANUAL_TRIGGER_MISSING') return { code: 'MANUAL_TRIGGER_REQUIRED', httpStatus: 400, status: 'BLOCKED' };
    if (sub === 'MESSAGE_TYPE_NOT_CANARY_TEST_ONLY') return { code: 'NOT_FIXED_MESSAGE', httpStatus: 400, status: 'BLOCKED' };
    if (sub === 'ALREADY_SENT') return { code: 'ALREADY_SENT', httpStatus: 429, status: 'BLOCKED' };
    if (sub.indexOf('V20_') === 0) return { code: 'CANARY_DISABLED', httpStatus: 503, status: 'BLOCKED' };
    if (sub === 'MISSING_TIME_SOURCE') return { code: 'UNKNOWN_ERROR', httpStatus: 500, status: 'ERROR' };
    if (sub === 'MISSING_FETCH_IMPL') return { code: 'UNKNOWN_ERROR', httpStatus: 500, status: 'ERROR' };
    if (sub === 'MISSING_ABORT_CONTROLLER_IMPL') return { code: 'UNKNOWN_ERROR', httpStatus: 500, status: 'ERROR' };
    if (sub === 'MISSING_SET_TIMEOUT_IMPL') return { code: 'UNKNOWN_ERROR', httpStatus: 500, status: 'ERROR' };
    if (sub === 'MISSING_CLEAR_TIMEOUT_IMPL') return { code: 'UNKNOWN_ERROR', httpStatus: 500, status: 'ERROR' };
    if (sub === 'INPUT_NOT_PLAIN_OBJECT') return { code: 'INVALID_JSON', httpStatus: 400, status: 'ERROR' };
    if (sub === 'NOT_FIXED_MESSAGE') return { code: 'NOT_FIXED_MESSAGE', httpStatus: 400, status: 'BLOCKED' };
    return { code: 'CANARY_BLOCKED', httpStatus: 403, status: 'BLOCKED' };
  }
  return { code: 'UNKNOWN_ERROR', httpStatus: 500, status: 'ERROR' };
}

// §v0.27 Live Preflight helpers ────────────────────────────────────────
// All pure functions. No fetch/KV/Telegram inside helpers (except
// fetchLiveCandles which uses injected deps.fetchImpl).

function indexOfString(arr, s) {
  if (!Array.isArray(arr)) return -1;
  for (var i = 0; i < arr.length; i++) {
    if (arr[i] === s) return i;
  }
  return -1;
}

function validateLivePreflightRequest(body) {
  if (!isPlainObject(body)) {
    return { ok: false, code: 'INVALID_JSON', httpStatus: 400 };
  }
  if (body.manualTrigger !== true) {
    return { ok: false, code: 'MANUAL_TRIGGER_REQUIRED', httpStatus: 400 };
  }
  var exchange = (typeof body.exchange === 'string') ? body.exchange.toLowerCase() : null;
  if (exchange === null || indexOfString(LIVE_PREFLIGHT_ALLOWED_EXCHANGES, exchange) === -1) {
    return { ok: false, code: 'LIVE_PREFLIGHT_INVALID_EXCHANGE', httpStatus: 400 };
  }
  var market = (typeof body.market === 'string') ? body.market : null;
  if (market === null || !LIVE_PREFLIGHT_MARKET_PATTERN.test(market)) {
    return { ok: false, code: 'LIVE_PREFLIGHT_INVALID_MARKET', httpStatus: 400 };
  }
  var timeframe = (typeof body.timeframe === 'string') ? body.timeframe : null;
  if (timeframe === null || indexOfString(LIVE_PREFLIGHT_ALLOWED_TIMEFRAMES, timeframe) === -1) {
    return { ok: false, code: 'LIVE_PREFLIGHT_INVALID_TIMEFRAME', httpStatus: 400 };
  }
  var limit = body.limit;
  if (typeof limit !== 'number' || !isFinite(limit) || Math.floor(limit) !== limit) {
    return { ok: false, code: 'LIVE_PREFLIGHT_LIMIT_EXCEEDED', httpStatus: 400 };
  }
  if (limit < LIVE_PREFLIGHT_LIMIT_MIN || limit > LIVE_PREFLIGHT_LIMIT_MAX) {
    return { ok: false, code: 'LIVE_PREFLIGHT_LIMIT_EXCEEDED', httpStatus: 400 };
  }
  return {
    ok: true,
    normalized: {
      exchange: exchange,
      market: market,
      timeframe: timeframe,
      limit: limit
    }
  };
}

function mapTimeframeToUpbitUnit(tf) {
  if (tf === '1m') return '1';
  if (tf === '5m') return '5';
  if (tf === '15m') return '15';
  if (tf === '1h') return '60';
  return null;
}

function mapTimeframeToBithumbInterval(tf) {
  if (tf === '1m') return '1m';
  if (tf === '5m') return '5m';
  if (tf === '15m') return '15m';
  if (tf === '1h') return '1h';
  return null;
}

function mapTimeframeToBinanceInterval(tf) {
  if (tf === '1m') return '1m';
  if (tf === '5m') return '5m';
  if (tf === '15m') return '15m';
  if (tf === '1h') return '1h';
  return null;
}

function buildLivePreflightUrl(exchange, market, timeframe, limit) {
  if (exchange === 'upbit') {
    var unit = mapTimeframeToUpbitUnit(timeframe);
    if (unit === null) return null;
    return 'https://api.upbit.com/v1/candles/minutes/' + unit
      + '?market=' + encodeURIComponent(market)
      + '&count=' + encodeURIComponent(String(limit));
  }
  if (exchange === 'bithumb') {
    var bInt = mapTimeframeToBithumbInterval(timeframe);
    if (bInt === null) return null;
    // Bithumb path-based interval; limit not server-controlled.
    return 'https://api.bithumb.com/public/candlestick/' + encodeURIComponent(market) + '/' + bInt;
  }
  if (exchange === 'binance') {
    var bnInt = mapTimeframeToBinanceInterval(timeframe);
    if (bnInt === null) return null;
    return 'https://api.binance.com/api/v3/klines'
      + '?symbol=' + encodeURIComponent(market)
      + '&interval=' + bnInt
      + '&limit=' + encodeURIComponent(String(limit));
  }
  return null;
}

// Normalize raw exchange JSON → uniform array of OHLCV objects sorted oldest→latest.
// Each candle: { time: ISO string, open, high, low, close, volume } (all numbers).
function normalizeCandles(exchange, raw, limit) {
  if (exchange === 'upbit') {
    if (!Array.isArray(raw)) return { ok: false, code: 'LIVE_PREFLIGHT_PARSE_ERROR' };
    if (raw.length === 0) return { ok: false, code: 'LIVE_PREFLIGHT_EMPTY_CANDLES' };
    // Upbit: latest-first → reverse to oldest-first
    var rev = raw.slice().reverse();
    var out = [];
    for (var i = 0; i < rev.length && i < limit; i++) {
      var r = rev[i];
      if (!isPlainObject(r)) return { ok: false, code: 'LIVE_PREFLIGHT_PARSE_ERROR' };
      var op = Number(r.opening_price);
      var hp = Number(r.high_price);
      var lp = Number(r.low_price);
      var cp = Number(r.trade_price);
      var vol = Number(r.candle_acc_trade_volume);
      var t = (typeof r.candle_date_time_utc === 'string') ? r.candle_date_time_utc : null;
      if (!t || !isFinite(op) || !isFinite(hp) || !isFinite(lp) || !isFinite(cp) || !isFinite(vol)) {
        return { ok: false, code: 'LIVE_PREFLIGHT_PARSE_ERROR' };
      }
      // Upbit candle_date_time_utc is like '2026-05-18T00:00:00' (no Z). Force ISO Z form.
      var iso = (t.charAt(t.length - 1) === 'Z') ? t : (t + 'Z');
      out.push({ time: iso, open: op, high: hp, low: lp, close: cp, volume: vol });
    }
    if (out.length === 0) return { ok: false, code: 'LIVE_PREFLIGHT_EMPTY_CANDLES' };
    return { ok: true, candles: out };
  }
  if (exchange === 'bithumb') {
    if (!isPlainObject(raw)) return { ok: false, code: 'LIVE_PREFLIGHT_PARSE_ERROR' };
    if (raw.status !== '0000') return { ok: false, code: 'LIVE_PREFLIGHT_PARSE_ERROR' };
    if (!Array.isArray(raw.data)) return { ok: false, code: 'LIVE_PREFLIGHT_PARSE_ERROR' };
    if (raw.data.length === 0) return { ok: false, code: 'LIVE_PREFLIGHT_EMPTY_CANDLES' };
    // Bithumb: oldest→latest. Take last `limit`.
    var src = raw.data;
    var start = (src.length > limit) ? (src.length - limit) : 0;
    var bOut = [];
    for (var j = start; j < src.length; j++) {
      var row = src[j];
      if (!Array.isArray(row) || row.length < 6) {
        return { ok: false, code: 'LIVE_PREFLIGHT_PARSE_ERROR' };
      }
      var tms = Number(row[0]);
      var bOp = Number(row[1]);
      var bCp = Number(row[2]);
      var bHp = Number(row[3]);
      var bLp = Number(row[4]);
      var bVol = Number(row[5]);
      if (!isFinite(tms) || !isFinite(bOp) || !isFinite(bHp) || !isFinite(bLp) || !isFinite(bCp) || !isFinite(bVol)) {
        return { ok: false, code: 'LIVE_PREFLIGHT_PARSE_ERROR' };
      }
      var bIso;
      try { bIso = new Date(tms).toISOString(); } catch (e) { return { ok: false, code: 'LIVE_PREFLIGHT_PARSE_ERROR' }; }
      bOut.push({ time: bIso, open: bOp, high: bHp, low: bLp, close: bCp, volume: bVol });
    }
    if (bOut.length === 0) return { ok: false, code: 'LIVE_PREFLIGHT_EMPTY_CANDLES' };
    return { ok: true, candles: bOut };
  }
  if (exchange === 'binance') {
    if (!Array.isArray(raw)) return { ok: false, code: 'LIVE_PREFLIGHT_PARSE_ERROR' };
    if (raw.length === 0) return { ok: false, code: 'LIVE_PREFLIGHT_EMPTY_CANDLES' };
    var cOut = [];
    for (var k = 0; k < raw.length && k < limit; k++) {
      var kln = raw[k];
      if (!Array.isArray(kln) || kln.length < 6) {
        return { ok: false, code: 'LIVE_PREFLIGHT_PARSE_ERROR' };
      }
      var koT = Number(kln[0]);
      var kOp = Number(kln[1]);
      var kHp = Number(kln[2]);
      var kLp = Number(kln[3]);
      var kCp = Number(kln[4]);
      var kVol = Number(kln[5]);
      if (!isFinite(koT) || !isFinite(kOp) || !isFinite(kHp) || !isFinite(kLp) || !isFinite(kCp) || !isFinite(kVol)) {
        return { ok: false, code: 'LIVE_PREFLIGHT_PARSE_ERROR' };
      }
      var kIso;
      try { kIso = new Date(koT).toISOString(); } catch (e) { return { ok: false, code: 'LIVE_PREFLIGHT_PARSE_ERROR' }; }
      cOut.push({ time: kIso, open: kOp, high: kHp, low: kLp, close: kCp, volume: kVol });
    }
    if (cOut.length === 0) return { ok: false, code: 'LIVE_PREFLIGHT_EMPTY_CANDLES' };
    return { ok: true, candles: cOut };
  }
  return { ok: false, code: 'LIVE_PREFLIGHT_UNSUPPORTED_SOURCE' };
}

function summarizeCandles(candles) {
  // candles oldest→latest. Safe defaults when length < 2.
  var n = candles.length;
  var last = candles[n - 1];
  var prev = (n >= 2) ? candles[n - 2] : null;
  var lastClose = last.close;
  var prevClose = prev ? prev.close : last.open;
  var changePct = 0;
  if (isFinite(prevClose) && prevClose !== 0) {
    changePct = ((lastClose - prevClose) / prevClose) * 100;
  }
  var lastVolume = last.volume;
  var sumVol = 0;
  for (var i = 0; i < n; i++) { sumVol += candles[i].volume; }
  var avgVolume = (n > 0) ? (sumVol / n) : 0;
  var volumeRatio = (avgVolume > 0) ? (lastVolume / avgVolume) : 0;
  return {
    candleCount: n,
    latestTime: last.time,
    lastClose: lastClose,
    prevClose: prevClose,
    changePct: changePct,
    lastVolume: lastVolume,
    avgVolume: avgVolume,
    volumeRatio: volumeRatio
  };
}

// fetchLiveCandles — uses injected deps.fetchImpl with AbortController timeout.
// Returns { ok: bool, code: 'LIVE_PREFLIGHT_OK' | 'LIVE_PREFLIGHT_FETCH_TIMEOUT' | 'LIVE_PREFLIGHT_NETWORK_ERROR' | 'LIVE_PREFLIGHT_PARSE_ERROR', raw }
async function fetchLiveCandles(deps, url, timeoutMs) {
  if (!deps || typeof deps.fetchImpl !== 'function') {
    return { ok: false, code: 'LIVE_PREFLIGHT_NETWORK_ERROR' };
  }
  var controller = null;
  if (typeof deps.AbortControllerImpl === 'function') {
    try { controller = deps.AbortControllerImpl(); } catch (e) { controller = null; }
  }
  var timedOut = false;
  var timer = null;
  if (controller && typeof deps.setTimeoutImpl === 'function' && typeof deps.clearTimeoutImpl === 'function') {
    timer = deps.setTimeoutImpl(function() {
      timedOut = true;
      try { controller.abort(); } catch (e) {}
    }, timeoutMs);
  }
  var resp;
  try {
    var opts = controller ? { signal: controller.signal } : {};
    resp = await deps.fetchImpl(url, opts);
  } catch (e) {
    if (timer && typeof deps.clearTimeoutImpl === 'function') {
      try { deps.clearTimeoutImpl(timer); } catch (e2) {}
    }
    if (timedOut) return { ok: false, code: 'LIVE_PREFLIGHT_FETCH_TIMEOUT' };
    var name = (e && e.name) || '';
    if (name === 'AbortError') return { ok: false, code: 'LIVE_PREFLIGHT_FETCH_TIMEOUT' };
    return { ok: false, code: 'LIVE_PREFLIGHT_NETWORK_ERROR' };
  }
  if (timer && typeof deps.clearTimeoutImpl === 'function') {
    try { deps.clearTimeoutImpl(timer); } catch (e3) {}
  }
  if (!resp || typeof resp.status !== 'number') {
    return { ok: false, code: 'LIVE_PREFLIGHT_NETWORK_ERROR' };
  }
  if (resp.status < 200 || resp.status >= 300) {
    return { ok: false, code: 'LIVE_PREFLIGHT_NETWORK_ERROR' };
  }
  var raw;
  try {
    raw = await resp.json();
  } catch (e4) {
    return { ok: false, code: 'LIVE_PREFLIGHT_PARSE_ERROR' };
  }
  return { ok: true, code: 'LIVE_PREFLIGHT_OK', raw: raw };
}

function buildLivePreflightResponse(req, summary) {
  return {
    ok: true,
    status: 'OK',
    code: 'LIVE_PREFLIGHT_OK',
    httpStatus: 200,
    version: VERSION,
    mode: LIVE_PREFLIGHT_MODE,
    exchange: req.exchange,
    market: req.market,
    timeframe: req.timeframe,
    limit: req.limit,
    normalized: {
      candleCount: summary.candleCount,
      latestTime: summary.latestTime,
      lastClose: summary.lastClose,
      prevClose: summary.prevClose,
      changePct: summary.changePct,
      lastVolume: summary.lastVolume,
      avgVolume: summary.avgVolume,
      volumeRatio: summary.volumeRatio
    },
    safety: {
      telegramSent: false,
      kvWritten: false,
      candidateStored: false,
      trackingStarted: false
    }
  };
}

// §v0.28 Candidate Dry-run helpers ─────────────────────────────────────
// All pure functions. NO fetch / NO KV / NO Telegram. Reuses v0.27
// buildLivePreflightUrl / fetchLiveCandles / normalizeCandles upstream.

function safeDivide(num, den, fallback) {
  if (typeof num !== 'number' || typeof den !== 'number') return fallback;
  if (!isFinite(num) || !isFinite(den)) return fallback;
  if (den === 0) return fallback;
  var r = num / den;
  if (!isFinite(r)) return fallback;
  return r;
}

function validateCandidateDryRunRequest(body) {
  if (!isPlainObject(body)) {
    return { ok: false, code: 'INVALID_JSON', httpStatus: 400 };
  }
  if (body.manualTrigger !== true) {
    return { ok: false, code: 'MANUAL_TRIGGER_REQUIRED', httpStatus: 400 };
  }
  var exchange = (typeof body.exchange === 'string') ? body.exchange.toLowerCase() : null;
  if (exchange === null || indexOfString(LIVE_PREFLIGHT_ALLOWED_EXCHANGES, exchange) === -1) {
    return { ok: false, code: 'CANDIDATE_DRY_RUN_INVALID_EXCHANGE', httpStatus: 400 };
  }
  var market = (typeof body.market === 'string') ? body.market : null;
  if (market === null || !LIVE_PREFLIGHT_MARKET_PATTERN.test(market)) {
    return { ok: false, code: 'CANDIDATE_DRY_RUN_INVALID_MARKET', httpStatus: 400 };
  }
  var timeframe = (typeof body.timeframe === 'string') ? body.timeframe : null;
  if (timeframe === null || indexOfString(LIVE_PREFLIGHT_ALLOWED_TIMEFRAMES, timeframe) === -1) {
    return { ok: false, code: 'CANDIDATE_DRY_RUN_INVALID_TIMEFRAME', httpStatus: 400 };
  }
  var limit = body.limit;
  if (typeof limit !== 'number' || !isFinite(limit) || Math.floor(limit) !== limit) {
    return { ok: false, code: 'CANDIDATE_DRY_RUN_LIMIT_EXCEEDED', httpStatus: 400 };
  }
  if (limit < CANDIDATE_DRY_RUN_LIMIT_MIN || limit > CANDIDATE_DRY_RUN_LIMIT_MAX) {
    return { ok: false, code: 'CANDIDATE_DRY_RUN_LIMIT_EXCEEDED', httpStatus: 400 };
  }
  return {
    ok: true,
    normalized: {
      exchange: exchange,
      market: market,
      timeframe: timeframe,
      limit: limit
    }
  };
}

function mapFetchCodeToCandidateDryRunCode(code) {
  if (code === 'LIVE_PREFLIGHT_FETCH_TIMEOUT') return 'CANDIDATE_DRY_RUN_FETCH_TIMEOUT';
  if (code === 'LIVE_PREFLIGHT_NETWORK_ERROR') return 'CANDIDATE_DRY_RUN_NETWORK_ERROR';
  if (code === 'LIVE_PREFLIGHT_PARSE_ERROR') return 'CANDIDATE_DRY_RUN_PARSE_ERROR';
  if (code === 'LIVE_PREFLIGHT_EMPTY_CANDLES') return 'CANDIDATE_DRY_RUN_EMPTY_CANDLES';
  if (code === 'LIVE_PREFLIGHT_UNSUPPORTED_SOURCE') return 'CANDIDATE_DRY_RUN_UNSUPPORTED_SOURCE';
  return 'CANDIDATE_DRY_RUN_FEATURE_ERROR';
}

// candles oldest→latest, n >= 1
function calculateCandleStructureFeatures(candles) {
  var n = candles.length;
  var last = candles[n - 1];
  var prev = (n >= 2) ? candles[n - 2] : null;
  var lastOpen = last.open;
  var lastHigh = last.high;
  var lastLow = last.low;
  var lastClose = last.close;
  var prevClose = prev ? prev.close : last.open;

  var changePct = safeDivide(lastClose - prevClose, prevClose, 0) * 100;
  var bodyPct = safeDivide(Math.abs(lastClose - lastOpen), lastOpen, 0) * 100;
  var rangePct = safeDivide(lastHigh - lastLow, lastOpen, 0) * 100;
  var upperWickPct = safeDivide(lastHigh - Math.max(lastOpen, lastClose), lastOpen, 0) * 100;
  var lowerWickPct = safeDivide(Math.min(lastOpen, lastClose) - lastLow, lastOpen, 0) * 100;
  var closePosition = (lastHigh === lastLow)
    ? 0.5
    : safeDivide(lastClose - lastLow, lastHigh - lastLow, 0.5);

  return {
    candleCount: n,
    latestTime: last.time,
    lastOpen: lastOpen,
    lastHigh: lastHigh,
    lastLow: lastLow,
    lastClose: lastClose,
    prevClose: prevClose,
    changePct: changePct,
    bodyPct: bodyPct,
    upperWickPct: upperWickPct,
    lowerWickPct: lowerWickPct,
    closePosition: closePosition,
    rangePct: rangePct
  };
}

function calculateVolumeFeatures(candles) {
  var n = candles.length;
  var last = candles[n - 1];
  var lastVolume = last.volume;
  var sum = 0;
  for (var i = 0; i < n; i++) { sum += candles[i].volume; }
  var avgVolume = (n > 0) ? (sum / n) : 0;
  var volumeRatio = safeDivide(lastVolume, avgVolume, 0);

  var volumeAccel = 0;
  if (n >= 13) {
    var recent3Sum = 0;
    for (var j = n - 3; j < n; j++) recent3Sum += candles[j].volume;
    var prior10Sum = 0;
    for (var k = n - 13; k < n - 3; k++) prior10Sum += candles[k].volume;
    var recent3Avg = recent3Sum / 3;
    var prior10Avg = prior10Sum / 10;
    volumeAccel = safeDivide(recent3Avg, prior10Avg, 0);
  }

  return {
    lastVolume: lastVolume,
    avgVolume: avgVolume,
    volumeRatio: volumeRatio,
    volumeAccel: volumeAccel
  };
}

function calculateMomentumFeatures(candles) {
  var n = candles.length;
  var last = candles[n - 1];
  var lastClose = last.close;

  var shortMomentumPct = 0;
  if (n >= 5) {
    var c4 = candles[n - 5].close;
    shortMomentumPct = safeDivide(lastClose, c4, 1) - 1;
  }
  var midMomentumPct = 0;
  if (n >= 11) {
    var c10 = candles[n - 11].close;
    midMomentumPct = safeDivide(lastClose, c10, 1) - 1;
  }

  var recentHigh = -Infinity;
  var recentLow = Infinity;
  for (var i = 0; i < n; i++) {
    if (candles[i].high > recentHigh) recentHigh = candles[i].high;
    if (candles[i].low < recentLow) recentLow = candles[i].low;
  }
  var highBreakProximity = (isFinite(recentHigh) && recentHigh !== 0)
    ? (safeDivide(lastClose, recentHigh, 1) - 1) : 0;
  var lowBreakRisk = (isFinite(recentLow) && recentLow !== 0)
    ? (safeDivide(lastClose, recentLow, 1) - 1) : 0;

  return {
    shortMomentumPct: shortMomentumPct,
    midMomentumPct: midMomentumPct,
    highBreakProximity: highBreakProximity,
    lowBreakRisk: lowBreakRisk
  };
}

function calculateCandidateDryRunScore(inputs) {
  var score = 0;
  var chips = [];

  var vr = inputs.volumeRatio;
  if (vr >= 3.0) { score += 25; chips.push('VOLUME_SURGE'); }
  else if (vr >= 2.0) { score += 18; chips.push('VOLUME_SURGE'); }
  else if (vr >= 1.5) { score += 12; }
  else if (vr >= 1.2) { score += 6; }
  else if (vr > 0 && vr < 0.5) { chips.push('LOW_VOLUME'); }

  var cp = inputs.changePct;
  if (cp >= 3.0) { score += 20; chips.push('POSITIVE_CHANGE'); }
  else if (cp >= 1.5) { score += 14; chips.push('POSITIVE_CHANGE'); }
  else if (cp >= 0.5) { score += 8; }
  else if (cp > 0) { score += 4; }

  var pos = inputs.closePosition;
  if (pos >= 0.8) { score += 15; chips.push('HIGH_CLOSE_POSITION'); }
  else if (pos >= 0.6) { score += 10; }
  else if (pos >= 0.4) { score += 5; }

  // shortMomentumPct stored as decimal (e.g., 0.02 = 2%). Convert to percent for threshold.
  var sm = inputs.shortMomentumPct * 100;
  if (sm >= 2.0) { score += 15; chips.push('SHORT_MOMENTUM'); }
  else if (sm >= 1.0) { score += 10; chips.push('SHORT_MOMENTUM'); }
  else if (sm >= 0.3) { score += 5; }

  if (inputs.upperWickPct >= inputs.bodyPct * 2 && inputs.closePosition < 0.6) {
    score -= 15;
    chips.push('UPPER_WICK_RISK');
  }
  if (inputs.rangePct >= 8) {
    score -= 10;
    chips.push('WIDE_RANGE_RISK');
  }

  if (score < 0) score = 0;
  if (score > 100) score = 100;
  if (chips.length > CANDIDATE_DRY_RUN_REASON_CHIP_MAX) {
    chips = chips.slice(0, CANDIDATE_DRY_RUN_REASON_CHIP_MAX);
  }
  return { score: score, reasonChips: chips };
}

function classifyCandidateDryRunGrade(score) {
  if (typeof score !== 'number' || !isFinite(score)) return 'P-C';
  if (score >= 75) return 'P-S';
  if (score >= 60) return 'P-A';
  if (score >= 45) return 'P-B';
  return 'P-C';
}

function buildCandidateDryRunResponse(req, sf, vf, mf, score, grade, chips) {
  return {
    ok: true,
    status: 'OK',
    code: 'CANDIDATE_DRY_RUN_OK',
    httpStatus: 200,
    version: VERSION,
    mode: CANDIDATE_DRY_RUN_MODE,
    exchange: req.exchange,
    market: req.market,
    timeframe: req.timeframe,
    limit: req.limit,
    features: {
      candleCount: sf.candleCount,
      latestTime: sf.latestTime,
      lastClose: sf.lastClose,
      changePct: sf.changePct,
      bodyPct: sf.bodyPct,
      upperWickPct: sf.upperWickPct,
      lowerWickPct: sf.lowerWickPct,
      closePosition: sf.closePosition,
      rangePct: sf.rangePct,
      lastVolume: vf.lastVolume,
      avgVolume: vf.avgVolume,
      volumeRatio: vf.volumeRatio,
      volumeAccel: vf.volumeAccel,
      shortMomentumPct: mf.shortMomentumPct,
      midMomentumPct: mf.midMomentumPct
    },
    dryRun: {
      score: score,
      grade: grade,
      reasonChips: chips,
      isCandidate: (grade === 'P-S' || grade === 'P-A')
    },
    safety: {
      telegramSent: false,
      kvWritten: false,
      candidateStored: false,
      trackingStarted: false
    }
  };
}

// §v0.29 Multi-market + Candidate TEST_ONLY helpers ────────────────────
// NO automatic cron / NO auto Telegram. Multi-market = dry-run only (NO KV write).
// /send-candidate-test = ONE manual Telegram send with confirmPhrase + KV duplicate guard.

function validateMultiCandidateDryRunRequest(body) {
  if (!isPlainObject(body)) {
    return { ok: false, code: 'INVALID_JSON', httpStatus: 400 };
  }
  if (body.manualTrigger !== true) {
    return { ok: false, code: 'MANUAL_TRIGGER_REQUIRED', httpStatus: 400 };
  }
  var exchange = (typeof body.exchange === 'string') ? body.exchange.toLowerCase() : null;
  if (exchange === null || indexOfString(LIVE_PREFLIGHT_ALLOWED_EXCHANGES, exchange) === -1) {
    return { ok: false, code: 'MULTI_CANDIDATE_INVALID_EXCHANGE', httpStatus: 400 };
  }
  var timeframe = (typeof body.timeframe === 'string') ? body.timeframe : null;
  if (timeframe === null || indexOfString(LIVE_PREFLIGHT_ALLOWED_TIMEFRAMES, timeframe) === -1) {
    return { ok: false, code: 'MULTI_CANDIDATE_INVALID_TIMEFRAME', httpStatus: 400 };
  }
  var limit = body.limit;
  if (typeof limit !== 'number' || !isFinite(limit) || Math.floor(limit) !== limit) {
    return { ok: false, code: 'MULTI_CANDIDATE_LIMIT_EXCEEDED', httpStatus: 400 };
  }
  if (limit < CANDIDATE_DRY_RUN_LIMIT_MIN || limit > CANDIDATE_DRY_RUN_LIMIT_MAX) {
    return { ok: false, code: 'MULTI_CANDIDATE_LIMIT_EXCEEDED', httpStatus: 400 };
  }
  if (!Array.isArray(body.markets)) {
    return { ok: false, code: 'MULTI_CANDIDATE_INVALID_MARKETS', httpStatus: 400 };
  }
  var rawMarkets = body.markets;
  if (rawMarkets.length === 0) {
    return { ok: false, code: 'MULTI_CANDIDATE_INVALID_MARKETS', httpStatus: 400 };
  }
  // Enforce maxMarkets (effective cap = min(spec MAX, body.maxMarkets if any))
  var effectiveMax = MULTI_CANDIDATE_MAX_MARKETS;
  if (typeof body.maxMarkets === 'number' && isFinite(body.maxMarkets) && body.maxMarkets > 0) {
    effectiveMax = Math.min(effectiveMax, Math.floor(body.maxMarkets));
  }
  if (rawMarkets.length > effectiveMax) {
    return { ok: false, code: 'MULTI_CANDIDATE_TOO_MANY_MARKETS', httpStatus: 400 };
  }
  // Validate each market string + dedupe (preserve order)
  var seen = {};
  var markets = [];
  for (var i = 0; i < rawMarkets.length; i++) {
    var m = rawMarkets[i];
    if (typeof m !== 'string' || !LIVE_PREFLIGHT_MARKET_PATTERN.test(m)) {
      return { ok: false, code: 'MULTI_CANDIDATE_INVALID_MARKETS', httpStatus: 400 };
    }
    if (Object.prototype.hasOwnProperty.call(seen, m)) continue;
    seen[m] = true;
    markets.push(m);
  }
  if (markets.length === 0) {
    return { ok: false, code: 'MULTI_CANDIDATE_INVALID_MARKETS', httpStatus: 400 };
  }
  return {
    ok: true,
    normalized: {
      exchange: exchange,
      timeframe: timeframe,
      limit: limit,
      markets: markets
    }
  };
}

// v0.31 — Operator Review flag classifier (separate from isCandidate)
// Returns { operatorReview: bool, operatorReviewLevel: 'HOT_REVIEW'|'WATCH_REVIEW'|'LOW_SIGNAL', operatorReviewReason: [...] }
function classifyOperatorReview(score, grade, reasonChips, features) {
  var chipSet = {};
  if (Array.isArray(reasonChips)) {
    for (var i = 0; i < reasonChips.length; i++) chipSet[reasonChips[i]] = true;
  }
  var hasVolumeSurge = chipSet['VOLUME_SURGE'] === true;
  var hasHighClose = chipSet['HIGH_CLOSE_POSITION'] === true;
  var hasShortMomentum = chipSet['SHORT_MOMENTUM'] === true;
  var hasPositiveChange = chipSet['POSITIVE_CHANGE'] === true;
  var volumeRatio = (features && typeof features.volumeRatio === 'number' && isFinite(features.volumeRatio)) ? features.volumeRatio : 0;
  var closePosition = (features && typeof features.closePosition === 'number' && isFinite(features.closePosition)) ? features.closePosition : 0;
  var changePct = (features && typeof features.changePct === 'number' && isFinite(features.changePct)) ? features.changePct : 0;

  var reasons = [];
  if (typeof score === 'number' && score >= 20) reasons.push('SCORE_GE_20');
  if (grade === 'P-S' || grade === 'P-A' || grade === 'P-B') reasons.push('GRADE_GE_PB');
  if (hasVolumeSurge) reasons.push('VOLUME_SURGE_CHIP');
  if (hasHighClose && changePct > 0) reasons.push('HIGH_CLOSE_WITH_POSITIVE_CHANGE');
  if (volumeRatio >= 1.2 && closePosition >= 0.6) reasons.push('VOLUME_RATIO_GE_1_2_CLOSE_POS_GE_0_6');
  if (hasShortMomentum) reasons.push('SHORT_MOMENTUM_CHIP');
  if (hasPositiveChange) reasons.push('POSITIVE_CHANGE_CHIP');

  var operatorReview = reasons.length > 0;
  // Level priority: HOT_REVIEW > WATCH_REVIEW > LOW_SIGNAL
  var level = 'LOW_SIGNAL';
  if ((typeof score === 'number' && score >= 45) || grade === 'P-S' || grade === 'P-A' || grade === 'P-B') {
    level = 'HOT_REVIEW';
  } else if (operatorReview) {
    level = 'WATCH_REVIEW';
  }
  if (reasons.length > 4) reasons = reasons.slice(0, 4);
  return {
    operatorReview: operatorReview,
    operatorReviewLevel: level,
    operatorReviewReason: operatorReview ? reasons : []
  };
}

function operatorReviewLevelPriority(level) {
  if (level === 'HOT_REVIEW') return 0;
  if (level === 'WATCH_REVIEW') return 1;
  return 2;
}

// Run multi-market pipeline. Returns { results: [...], partial: bool }.
// NO KV / NO Telegram. Reuses buildLivePreflightUrl + fetchLiveCandles + normalizeCandles + v0.28 feature/score helpers.
// v0.31: each ok result now includes operatorReview / operatorReviewLevel / operatorReviewReason.
// Run multi-market pipeline. Returns { results: [...], partial: bool }.
//
// v0.34.0 P0-v1.1 — runMultiCandidatePipeline 재작성:
//   기존 (v0.31) 자체 calculateCandleStructureFeatures/calculateVolumeFeatures/
//   calculateMomentumFeatures/calculateCandidateDryRunScore/classifyCandidateDryRunGrade
//   대신 v3 module chain 호출 — 백서 §4 운영 파이프라인 정합.
//
//     fetchLiveCandles → normalizeCandles →
//     WS3_FeaturePayload_Builder.build(candlesObj, marketCtx) →
//     WS3_ScoreBreakdown.build(featurePayload) →
//     WS3_StructureBucket.build(featurePayload, scoreBreakdown) →
//     WS3_SignalCycle.build(featurePayload, scoreBreakdown, structureDecision, null) →
//     WS3_StrategyPlan.build(...) →
//     WS3_CardViewModel.build(...)
//
//   응답 grade = 백서 §6.2 (S+/S/A/B/C/NONE / P-prefix X)
//   응답 shape = score / grade / structureBucket / strategyBias / signalCyclePhase /
//                signalCycleState / cardViewModel / latestTime / isCandidate / primaryTimeframe
//
// 사전 조사 발견 5건 반영:
//   🔴 builder.build() 2-인자 (candlesObj, marketCtx) — 단일객체 X
//   🔴 structureBucket 13+종 그대로 응답에 노출 (백서 5종 fold-up 은 P1 별도)
//   🔴 strategyBias 10종 그대로 응답에 노출 (백서 5종 SCALP/SWING 도출은 P1 별도)
//   🟡 cyclePhase + cycleState 둘 다 응답에 노출
//   🟡 primary timeframe = 사용자 선택 1개 / 나머지 4 timeframe = empty array
//
// 기존 함수 (calculateCandleStructureFeatures 등) 는 다른 endpoint 사용 가능성 유지 — 삭제 X.
// NO KV / NO Telegram. Reuses buildLivePreflightUrl + fetchLiveCandles + normalizeCandles upstream.
async function runMultiCandidatePipeline(deps, req) {
  var exchange = req.exchange;
  var timeframe = req.timeframe;
  var limit = req.limit;
  var markets = req.markets;

  // primary timeframe 결정 — 사용자 선택 timeframe 1개만 fetch.
  // featurePayload 의 다른 4 timeframe 자리는 empty array 로 채움 (v3-feature-payload-builder DP-4 createEmpty default 보장).
  var primaryTimeframe = mapToV3Timeframe(timeframe);

  var promises = [];
  for (var i = 0; i < markets.length; i++) {
    (function(market, rank) {
      // v0.35.0 — 1차 패치: bithumb 전용 (백서 §4.2 / v3-config.ENABLE_BITHUMB=true 외 false)
      if (exchange !== 'bithumb') {
        promises.push(Promise.resolve({ ok: false, market: market, code: 'V3_EXCHANGE_NOT_SUPPORTED' }));
        return;
      }
      var p = (async function fetchAndProcess() {
        // ──────────────────────────────────────────────────────────────
        // 3TF 병렬 fetch (백서 §4.1 / Bithumb API 한도: 5m/15m/1h 만 지원)
        // v3 timeframe key ('m5','m15','h1') ↔ Bithumb interval ('5m','15m','1h') 변환
        // h4/d1 는 mapTimeframeToBithumbInterval 미지원 → v3 builder 빈 배열 default 처리
        // ──────────────────────────────────────────────────────────────
        var tfList = [
          { v3: 'm5',  bithumb: '5m'  },
          { v3: 'm15', bithumb: '15m' },
          { v3: 'h1',  bithumb: '1h'  }
        ];
        var fetchResults;
        try {
          fetchResults = await Promise.all(tfList.map(function(tf) {
            var u = buildLivePreflightUrl(exchange, market, tf.bithumb, limit);
            if (u === null) return Promise.resolve({ tf: tf.v3, ok: false, candles: [] });
            return fetchLiveCandles(deps, u, LIVE_PREFLIGHT_FETCH_TIMEOUT_MS).then(function(fr) {
              if (fr.ok !== true) return { tf: tf.v3, ok: false, candles: [] };
              var n = normalizeCandles(exchange, fr.raw, limit);
              if (n.ok !== true) return { tf: tf.v3, ok: false, candles: [] };
              return { tf: tf.v3, ok: true, candles: n.candles };
            }).catch(function() { return { tf: tf.v3, ok: false, candles: [] }; });
          }));
        } catch (e) {
          return { ok: false, market: market, code: 'CANDIDATE_DRY_RUN_NETWORK_ERROR' };
        }
        // candlesObj 5 TF key 유지 (h4/d1 = 빈 배열 / v3 builder default 처리)
        var candlesObj = { m5: [], m15: [], h1: [], h4: [], d1: [] };
        var fetchOkCount = 0;
        for (var fi = 0; fi < fetchResults.length; fi++) {
          candlesObj[fetchResults[fi].tf] = fetchResults[fi].candles;
          if (fetchResults[fi].ok) fetchOkCount++;
        }
        if (fetchOkCount === 0) {
          return { ok: false, market: market, code: 'CANDIDATE_DRY_RUN_NETWORK_ERROR' };
        }
        try {
          // ──────────────────────────────────────────────────────────────
          // 백서 §4.1 운영 파이프라인 — v3 chain (Feature → Score → Structure → Cycle → Strategy → CardVM → RendererBinding)
          // ──────────────────────────────────────────────────────────────
          var marketCtx = { exchange: 'BITHUMB', market: market, ts: Date.now() };
          var featurePayload = globalThis.WS3_FeaturePayload_Builder.build(candlesObj, marketCtx);
          if (!globalThis.WS3_FeaturePayload.isValid(featurePayload)) {
            return { ok: false, market: market, code: 'V3_PAYLOAD_INVALID' };
          }
          // 백서 §6 100점 점수제
          var scoreBreakdown    = globalThis.WS3_ScoreBreakdown.build(featurePayload);
          // 백서 §7 structureBucket / priceZone / referenceLow
          var structureDecision = globalThis.WS3_StructureBucket.build(featurePayload, scoreBreakdown);
          // 백서 §8 signalCycle / persistence (previousState = null / 2차 패치 KV write 후속)
          var signalCycle       = globalThis.WS3_SignalCycle.build(featurePayload, scoreBreakdown, structureDecision, null);
          // 백서 §12, §13 strategyBias / entryPlan / exitPlan A-F
          var strategyPlan      = globalThis.WS3_StrategyPlan.build(featurePayload, scoreBreakdown, structureDecision, signalCycle);
          // 백서 §16 카드 헤더 + 18 섹션
          var cardViewModel     = globalThis.WS3_CardViewModel.build(featurePayload, scoreBreakdown, structureDecision, signalCycle, strategyPlan);
          // 백서 §16 rendererBinding (현재 cardViewModel 만 / activeCycleDecision·evaluationOutcome·operationPacket·transportPlan·externalConfluence 는 2차 패치 입력)
          var rendererBinding   = (globalThis.WS3_RendererBinding && globalThis.WS3_RendererBinding.build)
            ? globalThis.WS3_RendererBinding.build({
                cardViewModel: cardViewModel
              })
            : null;
          var totalScore = (scoreBreakdown && scoreBreakdown.valid) ? scoreBreakdown.totalScore : 0;
          var grade = classifyV3Grade(totalScore);
          return {
            ok: true,
            market: market,
            // 핵심 헤더 슬롯 (백서 §16.2 — production card header chip 용)
            score: totalScore,
            grade: grade,                                                                          // S+/S/A/B/C/NONE
            structureBucket:   (structureDecision && structureDecision.structureBucket) || 'UNKNOWN',
            priceZone:         (structureDecision && structureDecision.priceZone) || null,
            strategyBias:      (strategyPlan && strategyPlan.strategyBias) || 'UNKNOWN',
            planType:          (strategyPlan && strategyPlan.planType) || 'NONE',
            entryPlan:         (strategyPlan && strategyPlan.entryPlan) || null,
            exitPlan:          (strategyPlan && strategyPlan.exitPlan) || null,
            // signalCycle 정정 — v0.34.0 swap 버그 해소 (phase=lifecycle / state=semantic)
            signalCyclePhase:  (signalCycle && signalCycle.cyclePhase) || 'UNKNOWN',               // SEED/ACTIVE/COOLING/ENDED
            signalCycleState:  (signalCycle && signalCycle.cycleState) || 'UNKNOWN',               // NEW_CANDIDATE/PERSISTING/...
            signalPersistence: (signalCycle && signalCycle.persistence) || 'single',               // single/repeat/strong_repeat/hot_cycle
            // 백서 §16.4 카드바디 입력 (정확 shape — components.volume + riskPenalty/totalScore 명시)
            scoreBreakdown:    scoreBreakdown ? {
                core:        (scoreBreakdown.components && scoreBreakdown.components.core)        || null,
                structure:   (scoreBreakdown.components && scoreBreakdown.components.structure)   || null,
                volume:      (scoreBreakdown.components && scoreBreakdown.components.volume)      || null,
                momentum:    (scoreBreakdown.components && scoreBreakdown.components.momentum)    || null,
                execution:   (scoreBreakdown.components && scoreBreakdown.components.execution)   || null,
                grossScore:  scoreBreakdown.grossScore,
                totalScore:  scoreBreakdown.totalScore,
                riskPenalty: scoreBreakdown.riskPenalty
              } : null,
            cardViewModel:     cardViewModel,
            rendererBinding:   rendererBinding,
            // 메타
            latestTime:        featurePayload.ts,
            isCandidate:       (totalScore >= 40),
            primaryTimeframe:  primaryTimeframe
          };
        } catch (e) {
          return { ok: false, market: market, code: 'V3_PIPELINE_ERROR', error: String((e && e.message) || e) };
        }
      })();
      promises.push(p);
    })(markets[i], i);
  }

  var raw = await Promise.all(promises);

  // sort: score desc (1차 패치 단순화 / v0.31 operatorReviewLevel 정렬 제거)
  var ok = [];
  var failed = [];
  for (var j = 0; j < raw.length; j++) {
    if (raw[j].ok === true) ok.push(raw[j]);
    else failed.push(raw[j]);
  }
  ok.sort(function(a, b) {
    return (Number(b.score) || 0) - (Number(a.score) || 0);
  });

  var allResults = [];
  for (var k = 0; k < ok.length; k++) {
    allResults.push(Object.assign({ rank: k + 1 }, ok[k]));
  }
  for (var l = 0; l < failed.length; l++) {
    allResults.push({
      rank: ok.length + l + 1,
      market: failed[l].market,
      ok: false,
      code: failed[l].code
    });
  }
  return {
    results: allResults,
    okCount: ok.length,
    failCount: failed.length,
    partial: (ok.length > 0 && failed.length > 0)
  };
}

function countCandidates(results) {
  var n = 0;
  for (var i = 0; i < results.length; i++) {
    if (results[i].ok === true && results[i].isCandidate === true) n++;
  }
  return n;
}

// v0.31 — counts for operator review breakdown.
function countOperatorReviewByLevel(results) {
  var counts = { HOT_REVIEW: 0, WATCH_REVIEW: 0, LOW_SIGNAL: 0 };
  for (var i = 0; i < results.length; i++) {
    if (results[i].ok !== true) continue;
    var lvl = results[i].operatorReviewLevel;
    if (lvl === 'HOT_REVIEW') counts.HOT_REVIEW++;
    else if (lvl === 'WATCH_REVIEW') counts.WATCH_REVIEW++;
    else counts.LOW_SIGNAL++;
  }
  return counts;
}

function buildMultiCandidateDryRunResponse(req, pipelineResult) {
  return {
    ok: true,
    status: 'OK',
    code: pipelineResult.partial ? 'MULTI_CANDIDATE_PARTIAL_OK' : 'MULTI_CANDIDATE_DRY_RUN_OK',
    httpStatus: 200,
    version: VERSION,
    mode: MULTI_CANDIDATE_DRY_RUN_MODE,
    exchange: req.exchange,
    timeframe: req.timeframe,
    limit: req.limit,
    marketCount: req.markets.length,
    okCount: pipelineResult.okCount,
    failCount: pipelineResult.failCount,
    candidateCount: countCandidates(pipelineResult.results),
    results: pipelineResult.results,
    safety: {
      telegramSent: false,
      kvWritten: false,
      candidateStored: false,
      trackingStarted: false
    }
  };
}

// ── /send-candidate-test helpers ──────────────────────────────────────

function validateCandidateTestRequest(body) {
  if (!isPlainObject(body)) {
    return { ok: false, code: 'INVALID_JSON', httpStatus: 400 };
  }
  if (body.manualTrigger !== true) {
    return { ok: false, code: 'MANUAL_TRIGGER_REQUIRED', httpStatus: 400 };
  }
  // v0.30: detect forced mode first (changes confirmPhrase + error code namespace).
  var forced = (body.forceTestCandidate === true);
  if (forced) {
    if (typeof body.confirmPhrase !== 'string' || body.confirmPhrase !== FORCED_CANDIDATE_TEST_CONFIRM_PHRASE) {
      return { ok: false, code: 'FORCED_CANDIDATE_TEST_CONFIRM_PHRASE_REQUIRED', httpStatus: 403 };
    }
    var reason = body.forcedTestReason;
    if (typeof reason !== 'string' || reason.length === 0 || reason.length > FORCED_CANDIDATE_TEST_REASON_MAX_LEN || !FORCED_CANDIDATE_TEST_REASON_PATTERN.test(reason)) {
      return { ok: false, code: 'FORCED_CANDIDATE_TEST_INVALID_PAYLOAD', httpStatus: 400 };
    }
  } else {
    if (typeof body.confirmPhrase !== 'string' || body.confirmPhrase !== CANDIDATE_TEST_CONFIRM_PHRASE) {
      return { ok: false, code: 'CANDIDATE_TEST_CONFIRM_PHRASE_REQUIRED', httpStatus: 403 };
    }
  }
  var invalidPayloadCode = forced ? 'FORCED_CANDIDATE_TEST_INVALID_PAYLOAD' : 'CANDIDATE_TEST_INVALID_PAYLOAD';
  var noCandidateCode = forced ? 'FORCED_CANDIDATE_TEST_INVALID_PAYLOAD' : 'CANDIDATE_TEST_NO_CANDIDATE';
  var c = body.selectedCandidate;
  if (!isPlainObject(c)) {
    return { ok: false, code: noCandidateCode, httpStatus: 400 };
  }
  if (typeof c.source !== 'string' || c.source !== 'multi-candidate-dry-run') {
    return { ok: false, code: invalidPayloadCode, httpStatus: 400 };
  }
  if (typeof c.exchange !== 'string' || indexOfString(LIVE_PREFLIGHT_ALLOWED_EXCHANGES, c.exchange.toLowerCase()) === -1) {
    return { ok: false, code: invalidPayloadCode, httpStatus: 400 };
  }
  if (typeof c.market !== 'string' || !LIVE_PREFLIGHT_MARKET_PATTERN.test(c.market)) {
    return { ok: false, code: invalidPayloadCode, httpStatus: 400 };
  }
  if (typeof c.timeframe !== 'string' || indexOfString(LIVE_PREFLIGHT_ALLOWED_TIMEFRAMES, c.timeframe) === -1) {
    return { ok: false, code: invalidPayloadCode, httpStatus: 400 };
  }
  if (typeof c.score !== 'number' || !isFinite(c.score) || c.score < 0 || c.score > 100) {
    return { ok: false, code: invalidPayloadCode, httpStatus: 400 };
  }
  if (typeof c.grade !== 'string' || (c.grade !== 'P-S' && c.grade !== 'P-A' && c.grade !== 'P-B' && c.grade !== 'P-C')) {
    return { ok: false, code: invalidPayloadCode, httpStatus: 400 };
  }
  if (!Array.isArray(c.reasonChips)) {
    return { ok: false, code: invalidPayloadCode, httpStatus: 400 };
  }
  var safeChips = [];
  for (var i = 0; i < c.reasonChips.length && i < CANDIDATE_DRY_RUN_REASON_CHIP_MAX; i++) {
    var ch = c.reasonChips[i];
    if (typeof ch === 'string' && ch.length > 0 && ch.length < 64 && /^[A-Z_]+$/.test(ch)) {
      safeChips.push(ch);
    }
  }
  return {
    ok: true,
    normalized: {
      exchange: c.exchange.toLowerCase(),
      market: c.market,
      timeframe: c.timeframe,
      score: c.score,
      grade: c.grade,
      reasonChips: safeChips,
      forced: forced,
      forcedTestReason: forced ? body.forcedTestReason : null
    }
  };
}

function buildCandidateTestMessageText(c) {
  // Fixed safety preamble. NO raw exchange data. NO embedded urls/tokens.
  // v0.30: forced mode uses different preamble + adds mode/source/reason lines.
  var chipsLine = (c.reasonChips.length > 0) ? c.reasonChips.join(', ') : '-';
  if (c.forced === true) {
    return [
      '[WOOS WS3 FORCED CANDIDATE TEST_ONLY]',
      'This is not a live trading alert.',
      'manual forced validation only.',
      '실전 알람 아님',
      '테스트 전송',
      '강제 후보 테스트',
      '매수/매도 추천 아님',
      '',
      'mode: FORCED_TEST_ONLY',
      'source: multi-candidate-dry-run',
      'candidateStored: false',
      'trackingStarted: false',
      '',
      'Exchange: ' + c.exchange,
      'Market: ' + c.market,
      'Timeframe: ' + c.timeframe,
      'Score: ' + c.score,
      'Grade: ' + c.grade,
      'Reason chips: ' + chipsLine,
      'Forced reason: ' + (typeof c.forcedTestReason === 'string' ? c.forcedTestReason : '-')
    ].join('\n');
  }
  return [
    '[WOOS WS3 CANDIDATE TEST_ONLY]',
    'This is not a live trading alert.',
    'manual limited validation only.',
    '실전 알람 아님',
    '테스트 전송',
    '매수/매도 추천 아님',
    '',
    'Exchange: ' + c.exchange,
    'Market: ' + c.market,
    'Timeframe: ' + c.timeframe,
    'Score: ' + c.score,
    'Grade: ' + c.grade,
    'Reason chips: ' + chipsLine
  ].join('\n');
}

async function sendCandidateTestTelegram(deps, env, text) {
  if (typeof env.WS3_TELEGRAM_BOT_TOKEN !== 'string' || env.WS3_TELEGRAM_BOT_TOKEN.length === 0) {
    return { ok: false, code: 'CANDIDATE_TEST_TELEGRAM_ERROR' };
  }
  if (typeof env.WS3_TELEGRAM_CHAT_ID !== 'string' || env.WS3_TELEGRAM_CHAT_ID.length === 0) {
    return { ok: false, code: 'CANDIDATE_TEST_TELEGRAM_ERROR' };
  }
  if (!deps || typeof deps.fetchImpl !== 'function') {
    return { ok: false, code: 'CANDIDATE_TEST_TELEGRAM_ERROR' };
  }
  var url = 'https://api.telegram.org/bot' + env.WS3_TELEGRAM_BOT_TOKEN + '/sendMessage';
  var payload = {
    chat_id: env.WS3_TELEGRAM_CHAT_ID,
    text: text,
    disable_web_page_preview: true,
    disable_notification: false
  };
  var controller = null;
  if (typeof deps.AbortControllerImpl === 'function') {
    try { controller = deps.AbortControllerImpl(); } catch (e) { controller = null; }
  }
  var timer = null;
  var timedOut = false;
  if (controller && typeof deps.setTimeoutImpl === 'function' && typeof deps.clearTimeoutImpl === 'function') {
    timer = deps.setTimeoutImpl(function() {
      timedOut = true;
      try { controller.abort(); } catch (e) {}
    }, LIVE_PREFLIGHT_FETCH_TIMEOUT_MS);
  }
  var resp;
  try {
    var opts = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    };
    if (controller) opts.signal = controller.signal;
    resp = await deps.fetchImpl(url, opts);
  } catch (e) {
    if (timer && typeof deps.clearTimeoutImpl === 'function') {
      try { deps.clearTimeoutImpl(timer); } catch (e2) {}
    }
    return { ok: false, code: 'CANDIDATE_TEST_TELEGRAM_ERROR' };
  }
  if (timer && typeof deps.clearTimeoutImpl === 'function') {
    try { deps.clearTimeoutImpl(timer); } catch (e3) {}
  }
  if (!resp || typeof resp.status !== 'number') {
    return { ok: false, code: 'CANDIDATE_TEST_TELEGRAM_ERROR' };
  }
  if (resp.status < 200 || resp.status >= 300) {
    return { ok: false, code: 'CANDIDATE_TEST_TELEGRAM_ERROR' };
  }
  // Discard raw Telegram response body. Do NOT echo message_id / chat / from.
  try { await resp.text(); } catch (e4) {}
  return { ok: true };
}

function buildCandidateTestResponse(kvWritten, forced) {
  var isForced = (forced === true);
  return {
    ok: true,
    status: 'OK',
    code: isForced ? 'FORCED_CANDIDATE_TEST_SENT' : 'CANDIDATE_TEST_SENT',
    httpStatus: 200,
    version: VERSION,
    mode: isForced ? FORCED_CANDIDATE_TEST_MODE : CANDIDATE_TEST_MODE,
    messageType: isForced ? FORCED_CANDIDATE_TEST_MESSAGE_TYPE : CANDIDATE_TEST_MESSAGE_TYPE,
    fixedMessageUsed: true,
    safety: {
      telegramSent: true,
      kvWritten: (kvWritten === true),
      kvWriteScope: 'CANDIDATE_TEST_GUARD_ONLY',
      candidateStored: false,
      trackingStarted: false
    }
  };
}

// §v0.31 Limited Live Operator Review helpers ──────────────────────────
// /send-limited-live-alert: operator-selected candidate (isCandidate OR operatorReview)
// 1회 LIMITED_LIVE_OPERATOR_REVIEW Telegram 발송. KV guard per-(market,timeframe).

function buildLimitedLiveGuardKey(market, timeframe) {
  // market: ^[A-Za-z0-9_\-]{2,32}$ (validated upstream)
  // timeframe: allowlist (validated upstream)
  return LIMITED_LIVE_GUARD_KEY_PREFIX + market + ':' + timeframe;
}

function validateLimitedLiveAlertRequest(body) {
  if (!isPlainObject(body)) {
    return { ok: false, code: 'INVALID_JSON', httpStatus: 400 };
  }
  if (body.manualTrigger !== true) {
    return { ok: false, code: 'MANUAL_TRIGGER_REQUIRED', httpStatus: 400 };
  }
  if (typeof body.confirmPhrase !== 'string' || body.confirmPhrase !== LIMITED_LIVE_CONFIRM_PHRASE) {
    return { ok: false, code: 'LIMITED_LIVE_CONFIRM_PHRASE_REQUIRED', httpStatus: 403 };
  }
  var c = body.selectedCandidate;
  if (!isPlainObject(c)) {
    return { ok: false, code: 'LIMITED_LIVE_INVALID_PAYLOAD', httpStatus: 400 };
  }
  if (typeof c.source !== 'string' || c.source !== 'multi-candidate-dry-run') {
    return { ok: false, code: 'LIMITED_LIVE_INVALID_PAYLOAD', httpStatus: 400 };
  }
  if (typeof c.exchange !== 'string' || indexOfString(LIVE_PREFLIGHT_ALLOWED_EXCHANGES, c.exchange.toLowerCase()) === -1) {
    return { ok: false, code: 'LIMITED_LIVE_INVALID_PAYLOAD', httpStatus: 400 };
  }
  if (typeof c.market !== 'string' || !LIVE_PREFLIGHT_MARKET_PATTERN.test(c.market)) {
    return { ok: false, code: 'LIMITED_LIVE_INVALID_PAYLOAD', httpStatus: 400 };
  }
  if (typeof c.timeframe !== 'string' || indexOfString(LIVE_PREFLIGHT_ALLOWED_TIMEFRAMES, c.timeframe) === -1) {
    return { ok: false, code: 'LIMITED_LIVE_INVALID_PAYLOAD', httpStatus: 400 };
  }
  if (typeof c.score !== 'number' || !isFinite(c.score) || c.score < 0 || c.score > 100) {
    return { ok: false, code: 'LIMITED_LIVE_INVALID_PAYLOAD', httpStatus: 400 };
  }
  if (typeof c.grade !== 'string' || (c.grade !== 'P-S' && c.grade !== 'P-A' && c.grade !== 'P-B' && c.grade !== 'P-C')) {
    return { ok: false, code: 'LIMITED_LIVE_INVALID_PAYLOAD', httpStatus: 400 };
  }
  // Eligibility: isCandidate OR (operatorReview AND allowOperatorReviewSend === true)
  var isCandidate = (c.isCandidate === true);
  var operatorReview = (c.operatorReview === true);
  var allowOR = (body.allowOperatorReviewSend === true);
  if (!isCandidate && !(operatorReview && allowOR)) {
    return { ok: false, code: 'LIMITED_LIVE_INVALID_PAYLOAD', httpStatus: 400 };
  }
  var operatorReviewLevel = (typeof c.operatorReviewLevel === 'string')
    ? c.operatorReviewLevel : 'LOW_SIGNAL';
  var safeChips = [];
  if (Array.isArray(c.reasonChips)) {
    for (var i = 0; i < c.reasonChips.length && i < CANDIDATE_DRY_RUN_REASON_CHIP_MAX; i++) {
      var ch = c.reasonChips[i];
      if (typeof ch === 'string' && ch.length > 0 && ch.length < 64 && /^[A-Z_]+$/.test(ch)) {
        safeChips.push(ch);
      }
    }
  }
  return {
    ok: true,
    normalized: {
      exchange: c.exchange.toLowerCase(),
      market: c.market,
      timeframe: c.timeframe,
      score: c.score,
      grade: c.grade,
      isCandidate: isCandidate,
      operatorReview: operatorReview,
      operatorReviewLevel: operatorReviewLevel,
      reasonChips: safeChips
    }
  };
}

function buildLimitedLiveAlertMessageText(c) {
  // Fixed safety preamble for LIMITED LIVE / OPERATOR REVIEW.
  // NO raw exchange data / NO price / NO embedded urls / tokens.
  var chipsLine = (c.reasonChips.length > 0) ? c.reasonChips.join(', ') : '-';
  return [
    '[WOOS WS3 LIMITED LIVE / OPERATOR REVIEW]',
    '자동 매수/매도 추천 아님',
    '운영자 검토 필요',
    'Manual operator review only.',
    'This is not a live trading alert.',
    '',
    'Market: ' + c.market,
    'Exchange: ' + c.exchange,
    'Timeframe: ' + c.timeframe,
    'Score: ' + c.score,
    'Grade: ' + c.grade,
    'Operator review level: ' + c.operatorReviewLevel,
    'isCandidate: ' + (c.isCandidate === true),
    'Reason chips: ' + chipsLine,
    'candidateStored: false',
    'trackingStarted: false'
  ].join('\n');
}

async function sendLimitedLiveAlertTelegram(deps, env, text) {
  if (typeof env.WS3_TELEGRAM_BOT_TOKEN !== 'string' || env.WS3_TELEGRAM_BOT_TOKEN.length === 0) {
    return { ok: false, code: 'LIMITED_LIVE_TELEGRAM_ERROR' };
  }
  if (typeof env.WS3_TELEGRAM_CHAT_ID !== 'string' || env.WS3_TELEGRAM_CHAT_ID.length === 0) {
    return { ok: false, code: 'LIMITED_LIVE_TELEGRAM_ERROR' };
  }
  if (!deps || typeof deps.fetchImpl !== 'function') {
    return { ok: false, code: 'LIMITED_LIVE_TELEGRAM_ERROR' };
  }
  var url = 'https://api.telegram.org/bot' + env.WS3_TELEGRAM_BOT_TOKEN + '/sendMessage';
  var payload = {
    chat_id: env.WS3_TELEGRAM_CHAT_ID,
    text: text,
    disable_web_page_preview: true,
    disable_notification: false
  };
  var controller = null;
  if (typeof deps.AbortControllerImpl === 'function') {
    try { controller = deps.AbortControllerImpl(); } catch (e) { controller = null; }
  }
  var timer = null;
  if (controller && typeof deps.setTimeoutImpl === 'function' && typeof deps.clearTimeoutImpl === 'function') {
    timer = deps.setTimeoutImpl(function() {
      try { controller.abort(); } catch (e) {}
    }, LIVE_PREFLIGHT_FETCH_TIMEOUT_MS);
  }
  var resp;
  try {
    var opts = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    };
    if (controller) opts.signal = controller.signal;
    resp = await deps.fetchImpl(url, opts);
  } catch (e) {
    if (timer && typeof deps.clearTimeoutImpl === 'function') {
      try { deps.clearTimeoutImpl(timer); } catch (e2) {}
    }
    return { ok: false, code: 'LIMITED_LIVE_TELEGRAM_ERROR' };
  }
  if (timer && typeof deps.clearTimeoutImpl === 'function') {
    try { deps.clearTimeoutImpl(timer); } catch (e3) {}
  }
  if (!resp || typeof resp.status !== 'number') {
    return { ok: false, code: 'LIMITED_LIVE_TELEGRAM_ERROR' };
  }
  if (resp.status < 200 || resp.status >= 300) {
    return { ok: false, code: 'LIMITED_LIVE_TELEGRAM_ERROR' };
  }
  // Discard raw Telegram response body — never echo message_id / chat / from.
  try { await resp.text(); } catch (e4) {}
  return { ok: true };
}

function buildLimitedLiveAlertResponse(kvWritten) {
  return {
    ok: true,
    status: 'OK',
    code: 'LIMITED_LIVE_REVIEW_SENT',
    httpStatus: 200,
    version: VERSION,
    mode: LIMITED_LIVE_MODE,
    messageType: LIMITED_LIVE_MESSAGE_TYPE,
    fixedMessageUsed: true,
    safety: {
      telegramSent: true,
      kvWritten: (kvWritten === true),
      kvWriteScope: 'LIMITED_LIVE_GUARD_ONLY',
      candidateStored: false,
      trackingStarted: false
    }
  };
}

// §main entry ──────────────────────────────────────────────────────────

async function handleFetch(request, env, ctx, deps) {
  // deps (optional) — production worker does not receive deps; smoke tests inject.
  var resolvedDeps = isPlainObject(deps) ? deps : {};
  var nowMs = (typeof resolvedDeps.nowMs === 'number' && isFinite(resolvedDeps.nowMs))
    ? resolvedDeps.nowMs
    : ((typeof Date !== 'undefined') ? Date.now() : 0);
  var state = isPlainObject(resolvedDeps.state) ? resolvedDeps.state : CANARY_PROCESS_STATE;

  var url;
  var method;
  try {
    url = new URL(request.url);
    method = request.method;
  } catch (e) {
    return jsonResponse({ ok: false, status: 'ERROR', code: 'INVALID_JSON', httpStatus: 400 }, 400, false, null);
  }
  var path = url.pathname;
  var origin = request.headers.get('Origin');
  var allowed = isAllowedOrigin(origin, env);

  // OPTIONS preflight
  if (method === 'OPTIONS') {
    if (path !== '/health' && path !== '/send-canary' && path !== '/state' && path !== '/cleanup-confirm' && path !== '/operator-reset' && path !== '/live-preflight' && path !== '/candidate-dry-run' && path !== '/multi-candidate-dry-run' && path !== '/send-candidate-test' && path !== '/send-limited-live-alert') {
      return jsonResponse({ ok: false, status: 'ERROR', code: 'METHOD_NOT_ALLOWED', httpStatus: 405 }, 405, false, null);
    }
    if (!origin) {
      return jsonResponse({ ok: false, status: 'BLOCKED', code: 'ORIGIN_MISSING', httpStatus: 403 }, 403, false, null);
    }
    if (!allowed) {
      return jsonResponse({ ok: false, status: 'BLOCKED', code: 'ORIGIN_NOT_ALLOWED', httpStatus: 403 }, 403, false, null);
    }
    return emptyResponse(204, allowed, origin);
  }

  // GET /health
  if (path === '/health' && method === 'GET') {
    if (origin && !allowed) {
      return jsonResponse({ ok: false, status: 'BLOCKED', code: 'ORIGIN_NOT_ALLOWED', httpStatus: 403 }, 403, false, null);
    }
    return jsonResponse({
      ok: true,
      service: SERVICE,
      version: VERSION,
      status: STATUS_READY_CODE
    }, 200, allowed === true, origin);
  }

  // POST /send-canary  (v0.23 — KV persistent guard 통합)
  if (path === '/send-canary' && method === 'POST') {
    if (!origin) {
      return jsonResponse({ ok: false, status: 'BLOCKED', code: 'ORIGIN_MISSING', httpStatus: 403 }, 403, false, null);
    }
    if (!allowed) {
      return jsonResponse({ ok: false, status: 'BLOCKED', code: 'ORIGIN_NOT_ALLOWED', httpStatus: 403 }, 403, false, null);
    }

    // v0.23 — KV binding 필수. 없으면 PERSISTENCE_UNAVAILABLE. process memory fallback 금지.
    var kv = isPlainObject(resolvedDeps) && hasOwn(resolvedDeps, 'kv') ? resolvedDeps.kv : (env ? env[KV_BINDING_NAME] : null);
    if (!kv || typeof kv.get !== 'function' || typeof kv.put !== 'function') {
      return jsonResponse({ ok: false, status: 'BLOCKED', code: 'PERSISTENCE_UNAVAILABLE', httpStatus: 503 }, 503, true, origin);
    }

    // Content-Type
    var ct = request.headers.get('Content-Type');
    if (typeof ct !== 'string' || ct.toLowerCase().indexOf('application/json') === -1) {
      return jsonResponse({ ok: false, status: 'BLOCKED', code: 'UNSUPPORTED_MEDIA_TYPE', httpStatus: 415 }, 415, true, origin);
    }

    // Content-Length pre-check
    var cl = request.headers.get('Content-Length');
    if (typeof cl === 'string' && cl.length > 0) {
      var n = parseInt(cl, 10);
      if (isFinite(n) && n > MAX_BODY_BYTES) {
        return jsonResponse({ ok: false, status: 'BLOCKED', code: 'PAYLOAD_TOO_LARGE', httpStatus: 413 }, 413, true, origin);
      }
    }
    var bodyText = '';
    try {
      bodyText = await request.text();
    } catch (e) {
      return jsonResponse({ ok: false, status: 'ERROR', code: 'INVALID_JSON', httpStatus: 400 }, 400, true, origin);
    }
    if (typeof bodyText === 'string' && bodyText.length > MAX_BODY_BYTES) {
      return jsonResponse({ ok: false, status: 'BLOCKED', code: 'PAYLOAD_TOO_LARGE', httpStatus: 413 }, 413, true, origin);
    }
    var body;
    try {
      body = JSON.parse(bodyText);
    } catch (e) {
      return jsonResponse({ ok: false, status: 'ERROR', code: 'INVALID_JSON', httpStatus: 400 }, 400, true, origin);
    }
    if (!isPlainObject(body)) {
      return jsonResponse({ ok: false, status: 'ERROR', code: 'INVALID_JSON', httpStatus: 400 }, 400, true, origin);
    }
    var manualTrigger = body.manualTrigger === true;

    // v0.23 — persistent circuit guard
    var circuitRead = await CanaryStateKvAdapter.readCircuit(kv);
    if (circuitRead.ok !== true) {
      if (circuitRead.reason === 'PERSISTENCE_UNAVAILABLE') {
        return jsonResponse({ ok: false, status: 'BLOCKED', code: 'PERSISTENCE_UNAVAILABLE', httpStatus: 503 }, 503, true, origin);
      }
      if (circuitRead.reason === 'SCHEMA_VERSION_MISMATCH') {
        return jsonResponse({ ok: false, status: 'ERROR', code: 'SCHEMA_VERSION_MISMATCH', httpStatus: 503 }, 503, true, origin);
      }
      // INVALID_KV_VALUE → safe default: treat as missing
    }
    var circuit = (circuitRead.ok === true && isPlainObject(circuitRead.value)) ? circuitRead.value : null;
    if (circuit && circuit.circuitOpen === true) {
      if (typeof circuit.circuitOpenUntil === 'number' && circuit.circuitOpenUntil > 0 && nowMs < circuit.circuitOpenUntil) {
        return jsonResponse({ ok: false, status: 'BLOCKED', code: 'CANARY_CIRCUIT_OPEN_PERSISTENT', httpStatus: 503 }, 503, true, origin);
      }
    }

    // v0.23 — persistent alreadySent guard
    var alreadyRead = await CanaryStateKvAdapter.readAlreadySent(kv);
    if (alreadyRead.ok !== true) {
      if (alreadyRead.reason === 'PERSISTENCE_UNAVAILABLE') {
        return jsonResponse({ ok: false, status: 'BLOCKED', code: 'PERSISTENCE_UNAVAILABLE', httpStatus: 503 }, 503, true, origin);
      }
      if (alreadyRead.reason === 'SCHEMA_VERSION_MISMATCH') {
        return jsonResponse({ ok: false, status: 'ERROR', code: 'SCHEMA_VERSION_MISMATCH', httpStatus: 503 }, 503, true, origin);
      }
    }
    var alreadySentVal = (alreadyRead.ok === true && isPlainObject(alreadyRead.value)) ? alreadyRead.value : null;
    if (alreadySentVal && alreadySentVal.alreadySent === true) {
      return jsonResponse({ ok: false, status: 'BLOCKED', code: 'ALREADY_SENT_PERSISTENT', httpStatus: 409 }, 409, true, origin);
    }

    // v0.23 — persistent cleanupRequired guard
    var cleanupRead = await CanaryStateKvAdapter.readCleanupRequired(kv);
    if (cleanupRead.ok !== true) {
      if (cleanupRead.reason === 'PERSISTENCE_UNAVAILABLE') {
        return jsonResponse({ ok: false, status: 'BLOCKED', code: 'PERSISTENCE_UNAVAILABLE', httpStatus: 503 }, 503, true, origin);
      }
      if (cleanupRead.reason === 'SCHEMA_VERSION_MISMATCH') {
        return jsonResponse({ ok: false, status: 'ERROR', code: 'SCHEMA_VERSION_MISMATCH', httpStatus: 503 }, 503, true, origin);
      }
    }
    var cleanupVal = (cleanupRead.ok === true && isPlainObject(cleanupRead.value)) ? cleanupRead.value : null;
    if (cleanupVal && cleanupVal.cleanupRequired === true) {
      return jsonResponse({ ok: false, status: 'BLOCKED', code: 'CLEANUP_REQUIRED', httpStatus: 409 }, 409, true, origin);
    }
    // Safe default — alreadySent=true but cleanupRequired absent → treat as blocking
    if (alreadySentVal && alreadySentVal.alreadySent === true && cleanupVal === null) {
      return jsonResponse({ ok: false, status: 'BLOCKED', code: 'CLEANUP_REQUIRED', httpStatus: 409 }, 409, true, origin);
    }

    // v0.23 — persistent invoke-token failure counter (per originHash)
    var originHash;
    try {
      originHash = await CanaryStateKvAdapter.hashOrigin(origin, resolvedDeps.cryptoImpl);
    } catch (e) {
      return jsonResponse({ ok: false, status: 'ERROR', code: 'INVALID_HASH_FORMAT', httpStatus: 500 }, 500, true, origin);
    }
    if (!CanaryStateKvAdapter.isValidHash(originHash)) {
      return jsonResponse({ ok: false, status: 'ERROR', code: 'INVALID_HASH_FORMAT', httpStatus: 500 }, 500, true, origin);
    }
    var invokeRead = await CanaryStateKvAdapter.readInvokeFail(kv, originHash);
    if (invokeRead.ok !== true) {
      if (invokeRead.reason === 'PERSISTENCE_UNAVAILABLE') {
        return jsonResponse({ ok: false, status: 'BLOCKED', code: 'PERSISTENCE_UNAVAILABLE', httpStatus: 503 }, 503, true, origin);
      }
      if (invokeRead.reason === 'SCHEMA_VERSION_MISMATCH') {
        return jsonResponse({ ok: false, status: 'ERROR', code: 'SCHEMA_VERSION_MISMATCH', httpStatus: 503 }, 503, true, origin);
      }
    }
    var invokeVal = (invokeRead.ok === true && isPlainObject(invokeRead.value)) ? invokeRead.value : null;
    if (invokeVal && typeof invokeVal.blockedUntil === 'number' && invokeVal.blockedUntil > 0 && nowMs < invokeVal.blockedUntil) {
      return jsonResponse({
        ok: false, status: 'BLOCKED',
        code: 'INVOKE_TOKEN_BLOCKED_TOO_MANY_FAILURES_PERSISTENT',
        httpStatus: 429
      }, 429, true, origin);
    }

    // Worker-level invoke token mismatch throttle (transient — best effort per-process)
    if (state.invokeTokenMismatchBlockedUntil > 0 && nowMs < state.invokeTokenMismatchBlockedUntil) {
      return jsonResponse({
        ok: false, status: 'BLOCKED',
        code: 'INVOKE_TOKEN_BLOCKED_TOO_MANY_FAILURES',
        httpStatus: 429
      }, 429, true, origin);
    }

    var headerToken = request.headers.get('X-WS3-Canary-Token');
    if (typeof headerToken !== 'string' || headerToken.length === 0) {
      return jsonResponse({ ok: false, status: 'BLOCKED', code: 'MISSING_INVOKE_TOKEN', httpStatus: 401 }, 401, true, origin);
    }

    var runtimeDeps = buildWorkerRuntimeDeps(resolvedDeps, nowMs, state);
    if (!runtimeDeps.ok) {
      return workerSafeErrorResponse(runtimeDeps.code, true, origin);
    }

    // Build v0.20 → v0.21 chain
    var preflight;
    var v20Result;
    try {
      preflight = buildMinimalPreflightGate();
      v20Result = RuntimeStateAdapter.build({ liveExecutionPreflightGate: preflight });
    } catch (e) {
      return workerSafeErrorResponse('WORKER_DISPATCH_THROWN', true, origin);
    }

    var canaryInput = {
      secureRuntimeStateAdapterResult: v20Result,
      runtimeEnv: {
        WS3_TELEGRAM_BOT_TOKEN: env.WS3_TELEGRAM_BOT_TOKEN,
        WS3_TELEGRAM_CHAT_ID: env.WS3_TELEGRAM_CHAT_ID,
        WS3_TELEGRAM_CANARY_ENABLED: env.WS3_TELEGRAM_CANARY_ENABLED,
        WS3_TELEGRAM_CANARY_AUTHORIZED_AT: env.WS3_TELEGRAM_CANARY_AUTHORIZED_AT,
        WS3_CANARY_INVOKE_TOKEN: env.WS3_CANARY_INVOKE_TOKEN
      },
      headers: { 'X-WS3-Canary-Token': headerToken },
      manualTrigger: manualTrigger,
      messageType: CANARY_MESSAGE_TYPE
    };

    var canaryDeps = runtimeDeps.deps;

    var result;
    try {
      result = await TelegramCanarySender.dispatchCanary(canaryInput, canaryDeps);
    } catch (e) {
      return workerSafeErrorResponse(getWorkerSafeErrorCode(e, 'WORKER_DISPATCH_THROWN'), true, origin);
    }

    try {
      if (isPlainObject(result) && result.ok === true) {
        // success — reset transient counter, write KV alreadySent + cleanupRequired=true
        state.invokeTokenMismatchCount = 0;
        state.invokeTokenMismatchBlockedUntil = 0;
        await CanaryStateKvAdapter.writeAlreadySent(kv, nowMs);
        await CanaryStateKvAdapter.writeCleanupRequired(kv, {
          cleanupRequired: true,
          reason: CLEANUP_REASON_LIVE_SENT,
          createdAt: nowMs,
          lastCleanupAt: null
        });
        // Reset persistent circuit + invokeFail on success
        await CanaryStateKvAdapter.writeCircuit(kv, {
          circuitOpen: false, consecutiveFailures: 0, lastFailureAt: null, circuitOpenUntil: null
        });
        await CanaryStateKvAdapter.writeInvokeFail(kv, originHash, {
          failureCount: 0, lastFailureAt: null, blockedUntil: null
        });
        return jsonResponse({
          ok: true,
          status: 'SENT',
          code: 'CANARY_SENT',
          httpStatus: (typeof result.httpStatus === 'number') ? result.httpStatus : 200,
          messageType: CANARY_MESSAGE_TYPE,
          fixedMessageUsed: true
        }, 200, true, origin);
      }

      // Mapped error
      var errorCode = (isPlainObject(result) && typeof result.errorCode === 'string') ? result.errorCode : 'UNKNOWN_ERROR';
      var mapped = mapErrorCodeToWeb(errorCode);

      // Transient invoke token mismatch counter (per-process)
      if (mapped.code === 'INVOKE_TOKEN_MISMATCH') {
        state.invokeTokenMismatchCount = (state.invokeTokenMismatchCount || 0) + 1;
        if (state.invokeTokenMismatchCount >= INVOKE_TOKEN_MISMATCH_THRESHOLD) {
          state.invokeTokenMismatchBlockedUntil = nowMs + INVOKE_TOKEN_MISMATCH_BLOCK_MS;
        }
        // Persistent invoke-token failure counter (per originHash)
        var prevFail = (invokeVal && typeof invokeVal.failureCount === 'number') ? invokeVal.failureCount : 0;
        var newFail = prevFail + 1;
        var newBlockedUntil = (newFail >= INVOKE_TOKEN_PERSISTENT_THRESHOLD) ? (nowMs + INVOKE_TOKEN_PERSISTENT_BLOCK_MS) : null;
        await CanaryStateKvAdapter.writeInvokeFail(kv, originHash, {
          failureCount: newFail,
          lastFailureAt: nowMs,
          blockedUntil: newBlockedUntil
        });
      }

      // Persistent circuit counter on Telegram/network failures
      if (mapped.code === 'TELEGRAM_NETWORK_ERROR'
          || mapped.code === 'TELEGRAM_AUTH_ERROR'
          || mapped.code === 'TELEGRAM_NOT_FOUND'
          || mapped.code === 'CANARY_TIMEOUT') {
        var prevCf = (circuit && typeof circuit.consecutiveFailures === 'number') ? circuit.consecutiveFailures : 0;
        var newCf = prevCf + 1;
        var openUntil = (newCf >= CIRCUIT_PERSISTENT_FAIL_THRESHOLD) ? (nowMs + CIRCUIT_PERSISTENT_BLOCK_MS) : null;
        await CanaryStateKvAdapter.writeCircuit(kv, {
          circuitOpen: (openUntil !== null),
          consecutiveFailures: newCf,
          lastFailureAt: nowMs,
          circuitOpenUntil: openUntil
        });
      }

      var outerStatus = (mapped.httpStatus > 0) ? mapped.httpStatus : 502;
      return jsonResponse({
        ok: false,
        status: mapped.status,
        code: mapped.code,
        httpStatus: mapped.httpStatus
      }, outerStatus, true, origin);
    } catch (e) {
      return workerSafeErrorResponse('WORKER_RESPONSE_MAP_FAILED', true, origin);
    }
  }

  // GET /state  (v0.23 — safe persistent state read; requires Origin + invoke token)
  if (path === '/state' && method === 'GET') {
    if (!origin) {
      return jsonResponse({ ok: false, status: 'BLOCKED', code: 'ORIGIN_MISSING', httpStatus: 403 }, 403, false, null);
    }
    if (!allowed) {
      return jsonResponse({ ok: false, status: 'BLOCKED', code: 'ORIGIN_NOT_ALLOWED', httpStatus: 403 }, 403, false, null);
    }
    // v0.32.1 dev-open: skip Invoke Token check for operator-UX routes
    if (!isDevOpenOperatorRoute(path)) {
      var stateToken = request.headers.get('X-WS3-Canary-Token');
      if (typeof stateToken !== 'string' || stateToken.length === 0) {
        return jsonResponse({ ok: false, status: 'BLOCKED', code: 'MISSING_INVOKE_TOKEN', httpStatus: 401 }, 401, true, origin);
      }
      if (typeof env.WS3_CANARY_INVOKE_TOKEN !== 'string' || env.WS3_CANARY_INVOKE_TOKEN.length === 0) {
        return jsonResponse({ ok: false, status: 'BLOCKED', code: 'MISSING_INVOKE_TOKEN', httpStatus: 503 }, 503, true, origin);
      }
      if (stateToken !== env.WS3_CANARY_INVOKE_TOKEN) {
        return jsonResponse({ ok: false, status: 'BLOCKED', code: 'INVOKE_TOKEN_MISMATCH', httpStatus: 403 }, 403, true, origin);
      }
    }

    var stateKv = isPlainObject(resolvedDeps) && hasOwn(resolvedDeps, 'kv') ? resolvedDeps.kv : (env ? env[KV_BINDING_NAME] : null);
    var canaryEnabled = env && env.WS3_TELEGRAM_CANARY_ENABLED === 'true';
    if (!stateKv || typeof stateKv.get !== 'function') {
      // KV missing — degraded safe view (no leak)
      var degradedState = {
        persistenceAvailable: false,
        alreadySent: false,
        cleanupRequired: false,
        circuitOpen: false,
        canaryEnabled: canaryEnabled,
        resetCount: 0
      };
      return jsonResponse({
        ok: true,
        service: SERVICE,
        version: VERSION,
        canaryEnabled: canaryEnabled,
        persistenceAvailable: false,
        alreadySent: false,
        cleanupRequired: false,
        circuitOpen: false,
        currentPhase: CanaryStateKvAdapter.computeCurrentPhase(degradedState),
        resetCount: 0
      }, 200, true, origin);
    }

    var sAlready = await CanaryStateKvAdapter.readAlreadySent(stateKv);
    var sCleanup = await CanaryStateKvAdapter.readCleanupRequired(stateKv);
    var sCircuit = await CanaryStateKvAdapter.readCircuit(stateKv);
    var sReset = await CanaryStateKvAdapter.readOperatorReset(stateKv);

    var alreadyFlag = (sAlready.ok === true && isPlainObject(sAlready.value) && sAlready.value.alreadySent === true);
    var cleanupFlag = (sCleanup.ok === true && isPlainObject(sCleanup.value) && sCleanup.value.cleanupRequired === true);
    var circuitFlag = (sCircuit.ok === true && isPlainObject(sCircuit.value) && sCircuit.value.circuitOpen === true);
    var resetCount = (sReset.ok === true && isPlainObject(sReset.value) && typeof sReset.value.resetCount === 'number' && isFinite(sReset.value.resetCount)) ? sReset.value.resetCount : 0;

    var phaseState = {
      persistenceAvailable: true,
      alreadySent: alreadyFlag,
      cleanupRequired: cleanupFlag,
      circuitOpen: circuitFlag,
      canaryEnabled: canaryEnabled,
      resetCount: resetCount
    };
    var currentPhase = CanaryStateKvAdapter.computeCurrentPhase(phaseState);

    return jsonResponse({
      ok: true,
      service: SERVICE,
      version: VERSION,
      canaryEnabled: canaryEnabled,
      persistenceAvailable: true,
      alreadySent: alreadyFlag,
      cleanupRequired: cleanupFlag,
      circuitOpen: circuitFlag,
      currentPhase: currentPhase,
      resetCount: resetCount
    }, 200, true, origin);
  }

  // POST /cleanup-confirm  (v0.23 — manual cleanup ack; NO Telegram call)
  if (path === '/cleanup-confirm' && method === 'POST') {
    if (!origin) {
      return jsonResponse({ ok: false, status: 'BLOCKED', code: 'ORIGIN_MISSING', httpStatus: 403 }, 403, false, null);
    }
    if (!allowed) {
      return jsonResponse({ ok: false, status: 'BLOCKED', code: 'ORIGIN_NOT_ALLOWED', httpStatus: 403 }, 403, false, null);
    }
    var ccCt = request.headers.get('Content-Type');
    if (typeof ccCt !== 'string' || ccCt.toLowerCase().indexOf('application/json') === -1) {
      return jsonResponse({ ok: false, status: 'BLOCKED', code: 'UNSUPPORTED_MEDIA_TYPE', httpStatus: 415 }, 415, true, origin);
    }
    var ccCl = request.headers.get('Content-Length');
    if (typeof ccCl === 'string' && ccCl.length > 0) {
      var ccN = parseInt(ccCl, 10);
      if (isFinite(ccN) && ccN > MAX_BODY_BYTES) {
        return jsonResponse({ ok: false, status: 'BLOCKED', code: 'PAYLOAD_TOO_LARGE', httpStatus: 413 }, 413, true, origin);
      }
    }
    var ccBodyText = '';
    try { ccBodyText = await request.text(); } catch (e) {
      return jsonResponse({ ok: false, status: 'ERROR', code: 'INVALID_JSON', httpStatus: 400 }, 400, true, origin);
    }
    if (typeof ccBodyText === 'string' && ccBodyText.length > MAX_BODY_BYTES) {
      return jsonResponse({ ok: false, status: 'BLOCKED', code: 'PAYLOAD_TOO_LARGE', httpStatus: 413 }, 413, true, origin);
    }
    var ccBody;
    try { ccBody = JSON.parse(ccBodyText); } catch (e) {
      return jsonResponse({ ok: false, status: 'ERROR', code: 'INVALID_JSON', httpStatus: 400 }, 400, true, origin);
    }
    if (!isPlainObject(ccBody) || ccBody.manualTrigger !== true) {
      return jsonResponse({ ok: false, status: 'BLOCKED', code: 'MANUAL_TRIGGER_REQUIRED', httpStatus: 400 }, 400, true, origin);
    }
    var ccToken = request.headers.get('X-WS3-Canary-Token');
    if (typeof ccToken !== 'string' || ccToken.length === 0) {
      return jsonResponse({ ok: false, status: 'BLOCKED', code: 'MISSING_INVOKE_TOKEN', httpStatus: 401 }, 401, true, origin);
    }
    if (typeof env.WS3_CANARY_INVOKE_TOKEN !== 'string' || env.WS3_CANARY_INVOKE_TOKEN.length === 0) {
      return jsonResponse({ ok: false, status: 'BLOCKED', code: 'MISSING_INVOKE_TOKEN', httpStatus: 503 }, 503, true, origin);
    }
    if (ccToken !== env.WS3_CANARY_INVOKE_TOKEN) {
      return jsonResponse({ ok: false, status: 'BLOCKED', code: 'INVOKE_TOKEN_MISMATCH', httpStatus: 403 }, 403, true, origin);
    }

    var ccKv = isPlainObject(resolvedDeps) && hasOwn(resolvedDeps, 'kv') ? resolvedDeps.kv : (env ? env[KV_BINDING_NAME] : null);
    if (!ccKv || typeof ccKv.get !== 'function' || typeof ccKv.put !== 'function') {
      return jsonResponse({ ok: false, status: 'BLOCKED', code: 'PERSISTENCE_UNAVAILABLE', httpStatus: 503 }, 503, true, origin);
    }

    var ccCleanupRead = await CanaryStateKvAdapter.readCleanupRequired(ccKv);
    if (ccCleanupRead.ok !== true) {
      if (ccCleanupRead.reason === 'PERSISTENCE_UNAVAILABLE') {
        return jsonResponse({ ok: false, status: 'BLOCKED', code: 'PERSISTENCE_UNAVAILABLE', httpStatus: 503 }, 503, true, origin);
      }
      if (ccCleanupRead.reason === 'SCHEMA_VERSION_MISMATCH') {
        return jsonResponse({ ok: false, status: 'ERROR', code: 'SCHEMA_VERSION_MISMATCH', httpStatus: 503 }, 503, true, origin);
      }
      // INVALID_KV_VALUE → safe default: NO_CLEANUP_REQUIRED
    }
    var ccVal = (ccCleanupRead.ok === true && isPlainObject(ccCleanupRead.value)) ? ccCleanupRead.value : null;
    if (ccVal && ccVal.cleanupRequired === true) {
      var writeRes = await CanaryStateKvAdapter.writeCleanupRequired(ccKv, {
        cleanupRequired: false,
        reason: (typeof ccVal.reason === 'string') ? ccVal.reason : null,
        createdAt: (typeof ccVal.createdAt === 'number') ? ccVal.createdAt : null,
        lastCleanupAt: nowMs
      });
      if (writeRes.ok !== true) {
        return jsonResponse({ ok: false, status: 'BLOCKED', code: 'PERSISTENCE_UNAVAILABLE', httpStatus: 503 }, 503, true, origin);
      }
      return jsonResponse({ ok: true, status: 'OK', code: 'CLEANUP_CONFIRMED', httpStatus: 200 }, 200, true, origin);
    }
    // cleanupRequired=false or absent → no state change
    return jsonResponse({ ok: true, status: 'OK', code: 'NO_CLEANUP_REQUIRED', httpStatus: 200 }, 200, true, origin);
  }

  // POST /operator-reset  (v0.25 — 7중 조건 보호, Telegram 발송 0건)
  if (path === '/operator-reset' && method === 'POST') {
    // §1 Origin allowlist
    if (!origin) {
      return jsonResponse({ ok: false, status: 'BLOCKED', code: 'ORIGIN_MISSING', httpStatus: 403 }, 403, false, null);
    }
    if (!allowed) {
      return jsonResponse({ ok: false, status: 'BLOCKED', code: 'ORIGIN_NOT_ALLOWED', httpStatus: 403 }, 403, false, null);
    }
    var orCt = request.headers.get('Content-Type');
    if (typeof orCt !== 'string' || orCt.toLowerCase().indexOf('application/json') === -1) {
      return jsonResponse({ ok: false, status: 'BLOCKED', code: 'UNSUPPORTED_MEDIA_TYPE', httpStatus: 415 }, 415, true, origin);
    }
    var orCl = request.headers.get('Content-Length');
    if (typeof orCl === 'string' && orCl.length > 0) {
      var orN = parseInt(orCl, 10);
      if (isFinite(orN) && orN > MAX_BODY_BYTES) {
        return jsonResponse({ ok: false, status: 'BLOCKED', code: 'PAYLOAD_TOO_LARGE', httpStatus: 413 }, 413, true, origin);
      }
    }
    var orBodyText = '';
    try { orBodyText = await request.text(); } catch (e) {
      return jsonResponse({ ok: false, status: 'ERROR', code: 'INVALID_JSON', httpStatus: 400 }, 400, true, origin);
    }
    if (typeof orBodyText === 'string' && orBodyText.length > MAX_BODY_BYTES) {
      return jsonResponse({ ok: false, status: 'BLOCKED', code: 'PAYLOAD_TOO_LARGE', httpStatus: 413 }, 413, true, origin);
    }
    var orBody;
    try { orBody = JSON.parse(orBodyText); } catch (e) {
      return jsonResponse({ ok: false, status: 'ERROR', code: 'INVALID_JSON', httpStatus: 400 }, 400, true, origin);
    }
    if (!isPlainObject(orBody)) {
      return jsonResponse({ ok: false, status: 'ERROR', code: 'INVALID_JSON', httpStatus: 400 }, 400, true, origin);
    }

    // §3 manualTrigger === true
    if (orBody.manualTrigger !== true) {
      return jsonResponse({ ok: false, status: 'BLOCKED', code: 'MANUAL_TRIGGER_REQUIRED', httpStatus: 400 }, 400, true, origin);
    }

    // §4 resetPhrase byte-for-byte exact (hardcoded)
    if (typeof orBody.resetPhrase !== 'string' || orBody.resetPhrase !== OPERATOR_RESET_PHRASE) {
      return jsonResponse({ ok: false, status: 'BLOCKED', code: 'RESET_PHRASE_MISMATCH', httpStatus: 403 }, 403, true, origin);
    }

    // §2 X-WS3-Canary-Token exact match
    var orToken = request.headers.get('X-WS3-Canary-Token');
    if (typeof orToken !== 'string' || orToken.length === 0) {
      return jsonResponse({ ok: false, status: 'BLOCKED', code: 'MISSING_INVOKE_TOKEN', httpStatus: 401 }, 401, true, origin);
    }
    if (typeof env.WS3_CANARY_INVOKE_TOKEN !== 'string' || env.WS3_CANARY_INVOKE_TOKEN.length === 0) {
      return jsonResponse({ ok: false, status: 'BLOCKED', code: 'MISSING_INVOKE_TOKEN', httpStatus: 503 }, 503, true, origin);
    }
    if (orToken !== env.WS3_CANARY_INVOKE_TOKEN) {
      return jsonResponse({ ok: false, status: 'BLOCKED', code: 'INVOKE_TOKEN_MISMATCH', httpStatus: 403 }, 403, true, origin);
    }

    // §5 CANARY_ENABLED === 'false' 강제 (canary 가 활성화 상태에선 reset 차단)
    if (env.WS3_TELEGRAM_CANARY_ENABLED === 'true') {
      return jsonResponse({ ok: false, status: 'BLOCKED', code: 'RESET_REQUIRES_CANARY_DISABLED', httpStatus: 409 }, 409, true, origin);
    }

    // §7 KV binding 필수 (persistenceAvailable=true)
    var orKv = isPlainObject(resolvedDeps) && hasOwn(resolvedDeps, 'kv') ? resolvedDeps.kv : (env ? env[KV_BINDING_NAME] : null);
    if (!orKv || typeof orKv.get !== 'function' || typeof orKv.put !== 'function') {
      return jsonResponse({ ok: false, status: 'BLOCKED', code: 'PERSISTENCE_UNAVAILABLE', httpStatus: 503 }, 503, true, origin);
    }

    // §6 cleanupRequired === false 강제
    var orCleanupRead = await CanaryStateKvAdapter.readCleanupRequired(orKv);
    if (orCleanupRead.ok !== true) {
      if (orCleanupRead.reason === 'PERSISTENCE_UNAVAILABLE') {
        return jsonResponse({ ok: false, status: 'BLOCKED', code: 'PERSISTENCE_UNAVAILABLE', httpStatus: 503 }, 503, true, origin);
      }
      if (orCleanupRead.reason === 'SCHEMA_VERSION_MISMATCH') {
        return jsonResponse({ ok: false, status: 'ERROR', code: 'SCHEMA_VERSION_MISMATCH', httpStatus: 503 }, 503, true, origin);
      }
      // INVALID_KV_VALUE — safe default treats as cleanupRequired=true (must cleanup first)
    }
    var orCleanupVal = (orCleanupRead.ok === true && isPlainObject(orCleanupRead.value)) ? orCleanupRead.value : null;
    if (orCleanupVal && orCleanupVal.cleanupRequired === true) {
      return jsonResponse({ ok: false, status: 'BLOCKED', code: 'RESET_REQUIRES_CLEANUP_CONFIRMED', httpStatus: 409 }, 409, true, origin);
    }

    // §extra circuitOpen === true 차단
    var orCircuitRead = await CanaryStateKvAdapter.readCircuit(orKv);
    if (orCircuitRead.ok !== true) {
      if (orCircuitRead.reason === 'PERSISTENCE_UNAVAILABLE') {
        return jsonResponse({ ok: false, status: 'BLOCKED', code: 'PERSISTENCE_UNAVAILABLE', httpStatus: 503 }, 503, true, origin);
      }
      if (orCircuitRead.reason === 'SCHEMA_VERSION_MISMATCH') {
        return jsonResponse({ ok: false, status: 'ERROR', code: 'SCHEMA_VERSION_MISMATCH', httpStatus: 503 }, 503, true, origin);
      }
    }
    var orCircuitVal = (orCircuitRead.ok === true && isPlainObject(orCircuitRead.value)) ? orCircuitRead.value : null;
    if (orCircuitVal && orCircuitVal.circuitOpen === true) {
      return jsonResponse({ ok: false, status: 'BLOCKED', code: 'CIRCUIT_OPEN_RESET_BLOCKED', httpStatus: 503 }, 503, true, origin);
    }

    // §idempotent — alreadySent=false 면 NO_RESET_REQUIRED (cooldown 적용 X, KV 변경 0건)
    var orAlreadyRead = await CanaryStateKvAdapter.readAlreadySent(orKv);
    if (orAlreadyRead.ok !== true) {
      if (orAlreadyRead.reason === 'PERSISTENCE_UNAVAILABLE') {
        return jsonResponse({ ok: false, status: 'BLOCKED', code: 'PERSISTENCE_UNAVAILABLE', httpStatus: 503 }, 503, true, origin);
      }
      if (orAlreadyRead.reason === 'SCHEMA_VERSION_MISMATCH') {
        return jsonResponse({ ok: false, status: 'ERROR', code: 'SCHEMA_VERSION_MISMATCH', httpStatus: 503 }, 503, true, origin);
      }
      // INVALID_KV_VALUE — fall through; treat as no record
    }
    var orAlreadyVal = (orAlreadyRead.ok === true && isPlainObject(orAlreadyRead.value)) ? orAlreadyRead.value : null;
    var alreadyTrue = (orAlreadyVal && orAlreadyVal.alreadySent === true);
    if (alreadyTrue !== true) {
      // No reset needed (alreadySent already false or record missing) — no KV mutation, no cooldown apply
      return jsonResponse({ ok: true, status: 'OK', code: 'NO_RESET_REQUIRED', httpStatus: 200 }, 200, true, origin);
    }

    // §cooldown — lastResetAt 기준 60s 이내 재-reset 차단
    var orResetRead = await CanaryStateKvAdapter.readOperatorReset(orKv);
    if (orResetRead.ok !== true) {
      if (orResetRead.reason === 'PERSISTENCE_UNAVAILABLE') {
        return jsonResponse({ ok: false, status: 'BLOCKED', code: 'PERSISTENCE_UNAVAILABLE', httpStatus: 503 }, 503, true, origin);
      }
      if (orResetRead.reason === 'SCHEMA_VERSION_MISMATCH') {
        return jsonResponse({ ok: false, status: 'ERROR', code: 'SCHEMA_VERSION_MISMATCH', httpStatus: 503 }, 503, true, origin);
      }
    }
    var orResetVal = (orResetRead.ok === true && isPlainObject(orResetRead.value)) ? orResetRead.value : null;
    var prevResetCount = (orResetVal && typeof orResetVal.resetCount === 'number' && isFinite(orResetVal.resetCount) && orResetVal.resetCount >= 0) ? orResetVal.resetCount : 0;
    if (orResetVal && typeof orResetVal.lastResetAt === 'number' && isFinite(orResetVal.lastResetAt) && orResetVal.lastResetAt > 0) {
      if ((nowMs - orResetVal.lastResetAt) < OPERATOR_RESET_COOLDOWN_MS) {
        return jsonResponse({ ok: false, status: 'BLOCKED', code: 'RESET_COOLDOWN_ACTIVE', httpStatus: 429 }, 429, true, origin);
      }
    }

    // §perform reset
    var markRes = await CanaryStateKvAdapter.markAlreadySentReset(orKv);
    if (markRes.ok !== true) {
      if (markRes.reason === 'PERSISTENCE_UNAVAILABLE') {
        return jsonResponse({ ok: false, status: 'BLOCKED', code: 'PERSISTENCE_UNAVAILABLE', httpStatus: 503 }, 503, true, origin);
      }
      if (markRes.reason === 'SCHEMA_VERSION_MISMATCH') {
        return jsonResponse({ ok: false, status: 'ERROR', code: 'SCHEMA_VERSION_MISMATCH', httpStatus: 503 }, 503, true, origin);
      }
      return jsonResponse({ ok: false, status: 'ERROR', code: 'RESET_PRECONDITION_FAILED', httpStatus: 409 }, 409, true, origin);
    }
    var resetWriteRes = await CanaryStateKvAdapter.writeOperatorReset(orKv, {
      resetCount: prevResetCount + 1,
      lastResetAt: nowMs,
      lastResetReason: OPERATOR_RESET_REASON
    });
    if (resetWriteRes.ok !== true) {
      return jsonResponse({ ok: false, status: 'BLOCKED', code: 'PERSISTENCE_UNAVAILABLE', httpStatus: 503 }, 503, true, origin);
    }

    return jsonResponse({ ok: true, status: 'OK', code: 'OPERATOR_RESET_CONFIRMED', httpStatus: 200 }, 200, true, origin);
  }

  // POST /live-preflight  (v0.27 — read-only public market data preview; NO Telegram, NO KV write, NO candidate store)
  if (path === '/live-preflight' && method === 'POST') {
    if (!origin) {
      return jsonResponse({ ok: false, status: 'BLOCKED', code: 'ORIGIN_MISSING', httpStatus: 403 }, 403, false, null);
    }
    if (!allowed) {
      return jsonResponse({ ok: false, status: 'BLOCKED', code: 'ORIGIN_NOT_ALLOWED', httpStatus: 403 }, 403, false, null);
    }
    // v0.32.1 dev-open: skip Invoke Token check for operator-UX routes
    if (!isDevOpenOperatorRoute(path)) {
      var lpToken = request.headers.get('X-WS3-Canary-Token');
      if (typeof lpToken !== 'string' || lpToken.length === 0) {
        return jsonResponse({ ok: false, status: 'BLOCKED', code: 'MISSING_INVOKE_TOKEN', httpStatus: 401 }, 401, true, origin);
      }
      if (typeof env.WS3_CANARY_INVOKE_TOKEN !== 'string' || env.WS3_CANARY_INVOKE_TOKEN.length === 0) {
        return jsonResponse({ ok: false, status: 'BLOCKED', code: 'MISSING_INVOKE_TOKEN', httpStatus: 503 }, 503, true, origin);
      }
      if (lpToken !== env.WS3_CANARY_INVOKE_TOKEN) {
        return jsonResponse({ ok: false, status: 'BLOCKED', code: 'INVOKE_TOKEN_MISMATCH', httpStatus: 403 }, 403, true, origin);
      }
    }

    var lpCt = request.headers.get('Content-Type');
    if (typeof lpCt !== 'string' || lpCt.toLowerCase().indexOf('application/json') === -1) {
      return jsonResponse({ ok: false, status: 'BLOCKED', code: 'UNSUPPORTED_MEDIA_TYPE', httpStatus: 415 }, 415, true, origin);
    }
    var lpCl = request.headers.get('Content-Length');
    if (typeof lpCl === 'string' && lpCl.length > 0) {
      var lpN = parseInt(lpCl, 10);
      if (isFinite(lpN) && lpN > MAX_BODY_BYTES) {
        return jsonResponse({ ok: false, status: 'BLOCKED', code: 'PAYLOAD_TOO_LARGE', httpStatus: 413 }, 413, true, origin);
      }
    }
    var lpBodyText = '';
    try { lpBodyText = await request.text(); } catch (e) {
      return jsonResponse({ ok: false, status: 'ERROR', code: 'INVALID_JSON', httpStatus: 400 }, 400, true, origin);
    }
    if (typeof lpBodyText === 'string' && lpBodyText.length > MAX_BODY_BYTES) {
      return jsonResponse({ ok: false, status: 'BLOCKED', code: 'PAYLOAD_TOO_LARGE', httpStatus: 413 }, 413, true, origin);
    }
    var lpBody;
    try { lpBody = JSON.parse(lpBodyText); } catch (e) {
      return jsonResponse({ ok: false, status: 'ERROR', code: 'INVALID_JSON', httpStatus: 400 }, 400, true, origin);
    }

    var lpValidate = validateLivePreflightRequest(lpBody);
    if (lpValidate.ok !== true) {
      return jsonResponse({ ok: false, status: 'BLOCKED', code: lpValidate.code, httpStatus: lpValidate.httpStatus }, lpValidate.httpStatus, true, origin);
    }
    var lpReq = lpValidate.normalized;

    var lpUrl = buildLivePreflightUrl(lpReq.exchange, lpReq.market, lpReq.timeframe, lpReq.limit);
    if (lpUrl === null) {
      return jsonResponse({ ok: false, status: 'BLOCKED', code: 'LIVE_PREFLIGHT_UNSUPPORTED_SOURCE', httpStatus: 400 }, 400, true, origin);
    }

    var lpDepsRes = buildWorkerRuntimeDeps(resolvedDeps, nowMs, state);
    if (lpDepsRes.ok !== true) {
      return jsonResponse({ ok: false, status: 'ERROR', code: 'UNKNOWN_ERROR', httpStatus: 500 }, 500, true, origin);
    }
    var lpDeps = lpDepsRes.deps;

    var lpFetchRes = await fetchLiveCandles(lpDeps, lpUrl, LIVE_PREFLIGHT_FETCH_TIMEOUT_MS);
    if (lpFetchRes.ok !== true) {
      var lpFetchStatus = 502;
      if (lpFetchRes.code === 'LIVE_PREFLIGHT_FETCH_TIMEOUT') lpFetchStatus = 504;
      return jsonResponse({ ok: false, status: 'ERROR', code: lpFetchRes.code, httpStatus: lpFetchStatus }, lpFetchStatus, true, origin);
    }

    var lpNorm = normalizeCandles(lpReq.exchange, lpFetchRes.raw, lpReq.limit);
    if (lpNorm.ok !== true) {
      var lpNormStatus = (lpNorm.code === 'LIVE_PREFLIGHT_EMPTY_CANDLES') ? 502 : 502;
      return jsonResponse({ ok: false, status: 'ERROR', code: lpNorm.code, httpStatus: lpNormStatus }, lpNormStatus, true, origin);
    }
    var lpSummary = summarizeCandles(lpNorm.candles);
    var lpResponse = buildLivePreflightResponse(lpReq, lpSummary);
    return jsonResponse(lpResponse, 200, true, origin);
  }

  // POST /candidate-dry-run  (v0.28 — read-only feature/score/grade dry-run; NO Telegram, NO KV write, NO candidate store, NO tracking start)
  if (path === '/candidate-dry-run' && method === 'POST') {
    if (!origin) {
      return jsonResponse({ ok: false, status: 'BLOCKED', code: 'ORIGIN_MISSING', httpStatus: 403 }, 403, false, null);
    }
    if (!allowed) {
      return jsonResponse({ ok: false, status: 'BLOCKED', code: 'ORIGIN_NOT_ALLOWED', httpStatus: 403 }, 403, false, null);
    }
    // v0.32.1 dev-open: skip Invoke Token check for operator-UX routes
    if (!isDevOpenOperatorRoute(path)) {
      var cdrToken = request.headers.get('X-WS3-Canary-Token');
      if (typeof cdrToken !== 'string' || cdrToken.length === 0) {
        return jsonResponse({ ok: false, status: 'BLOCKED', code: 'MISSING_INVOKE_TOKEN', httpStatus: 401 }, 401, true, origin);
      }
      if (typeof env.WS3_CANARY_INVOKE_TOKEN !== 'string' || env.WS3_CANARY_INVOKE_TOKEN.length === 0) {
        return jsonResponse({ ok: false, status: 'BLOCKED', code: 'MISSING_INVOKE_TOKEN', httpStatus: 503 }, 503, true, origin);
      }
      if (cdrToken !== env.WS3_CANARY_INVOKE_TOKEN) {
        return jsonResponse({ ok: false, status: 'BLOCKED', code: 'INVOKE_TOKEN_MISMATCH', httpStatus: 403 }, 403, true, origin);
      }
    }

    var cdrCt = request.headers.get('Content-Type');
    if (typeof cdrCt !== 'string' || cdrCt.toLowerCase().indexOf('application/json') === -1) {
      return jsonResponse({ ok: false, status: 'BLOCKED', code: 'UNSUPPORTED_MEDIA_TYPE', httpStatus: 415 }, 415, true, origin);
    }
    var cdrCl = request.headers.get('Content-Length');
    if (typeof cdrCl === 'string' && cdrCl.length > 0) {
      var cdrN = parseInt(cdrCl, 10);
      if (isFinite(cdrN) && cdrN > MAX_BODY_BYTES) {
        return jsonResponse({ ok: false, status: 'BLOCKED', code: 'PAYLOAD_TOO_LARGE', httpStatus: 413 }, 413, true, origin);
      }
    }
    var cdrBodyText = '';
    try { cdrBodyText = await request.text(); } catch (e) {
      return jsonResponse({ ok: false, status: 'ERROR', code: 'INVALID_JSON', httpStatus: 400 }, 400, true, origin);
    }
    if (typeof cdrBodyText === 'string' && cdrBodyText.length > MAX_BODY_BYTES) {
      return jsonResponse({ ok: false, status: 'BLOCKED', code: 'PAYLOAD_TOO_LARGE', httpStatus: 413 }, 413, true, origin);
    }
    var cdrBody;
    try { cdrBody = JSON.parse(cdrBodyText); } catch (e) {
      return jsonResponse({ ok: false, status: 'ERROR', code: 'INVALID_JSON', httpStatus: 400 }, 400, true, origin);
    }

    var cdrValidate = validateCandidateDryRunRequest(cdrBody);
    if (cdrValidate.ok !== true) {
      return jsonResponse({ ok: false, status: 'BLOCKED', code: cdrValidate.code, httpStatus: cdrValidate.httpStatus }, cdrValidate.httpStatus, true, origin);
    }
    var cdrReq = cdrValidate.normalized;

    var cdrUrl = buildLivePreflightUrl(cdrReq.exchange, cdrReq.market, cdrReq.timeframe, cdrReq.limit);
    if (cdrUrl === null) {
      return jsonResponse({ ok: false, status: 'BLOCKED', code: 'CANDIDATE_DRY_RUN_UNSUPPORTED_SOURCE', httpStatus: 400 }, 400, true, origin);
    }

    var cdrDepsRes = buildWorkerRuntimeDeps(resolvedDeps, nowMs, state);
    if (cdrDepsRes.ok !== true) {
      return jsonResponse({ ok: false, status: 'ERROR', code: 'UNKNOWN_ERROR', httpStatus: 500 }, 500, true, origin);
    }
    var cdrDeps = cdrDepsRes.deps;

    var cdrFetchRes = await fetchLiveCandles(cdrDeps, cdrUrl, LIVE_PREFLIGHT_FETCH_TIMEOUT_MS);
    if (cdrFetchRes.ok !== true) {
      var mappedFetchCode = mapFetchCodeToCandidateDryRunCode(cdrFetchRes.code);
      var cdrFetchStatus = 502;
      if (mappedFetchCode === 'CANDIDATE_DRY_RUN_FETCH_TIMEOUT') cdrFetchStatus = 504;
      if (mappedFetchCode === 'CANDIDATE_DRY_RUN_UNSUPPORTED_SOURCE') cdrFetchStatus = 400;
      return jsonResponse({ ok: false, status: 'ERROR', code: mappedFetchCode, httpStatus: cdrFetchStatus }, cdrFetchStatus, true, origin);
    }

    var cdrNorm = normalizeCandles(cdrReq.exchange, cdrFetchRes.raw, cdrReq.limit);
    if (cdrNorm.ok !== true) {
      var mappedNormCode = mapFetchCodeToCandidateDryRunCode(cdrNorm.code);
      return jsonResponse({ ok: false, status: 'ERROR', code: mappedNormCode, httpStatus: 502 }, 502, true, origin);
    }

    try {
      var sf = calculateCandleStructureFeatures(cdrNorm.candles);
      var vf = calculateVolumeFeatures(cdrNorm.candles);
      var mf = calculateMomentumFeatures(cdrNorm.candles);
      var scoreInputs = {
        bodyPct: sf.bodyPct,
        closePosition: sf.closePosition,
        changePct: sf.changePct,
        rangePct: sf.rangePct,
        upperWickPct: sf.upperWickPct,
        volumeRatio: vf.volumeRatio,
        shortMomentumPct: mf.shortMomentumPct
      };
      var scoreResult = calculateCandidateDryRunScore(scoreInputs);
      // Validate all feature numbers are finite (defense in depth).
      var allFinite = isFinite(sf.changePct) && isFinite(sf.bodyPct) && isFinite(sf.rangePct)
        && isFinite(sf.upperWickPct) && isFinite(sf.lowerWickPct) && isFinite(sf.closePosition)
        && isFinite(vf.volumeRatio) && isFinite(vf.volumeAccel)
        && isFinite(mf.shortMomentumPct) && isFinite(mf.midMomentumPct);
      if (!allFinite || !isFinite(scoreResult.score)) {
        return jsonResponse({ ok: false, status: 'ERROR', code: 'CANDIDATE_DRY_RUN_FEATURE_ERROR', httpStatus: 500 }, 500, true, origin);
      }
      var grade = classifyCandidateDryRunGrade(scoreResult.score);
      var cdrResponse = buildCandidateDryRunResponse(cdrReq, sf, vf, mf, scoreResult.score, grade, scoreResult.reasonChips);
      return jsonResponse(cdrResponse, 200, true, origin);
    } catch (e) {
      return jsonResponse({ ok: false, status: 'ERROR', code: 'CANDIDATE_DRY_RUN_FEATURE_ERROR', httpStatus: 500 }, 500, true, origin);
    }
  }

  // POST /multi-candidate-dry-run  (v0.29 — multi-market dry-run; NO Telegram, NO KV write, NO candidate store, NO tracking start)
  if (path === '/multi-candidate-dry-run' && method === 'POST') {
    if (!origin) {
      return jsonResponse({ ok: false, status: 'BLOCKED', code: 'ORIGIN_MISSING', httpStatus: 403 }, 403, false, null);
    }
    if (!allowed) {
      return jsonResponse({ ok: false, status: 'BLOCKED', code: 'ORIGIN_NOT_ALLOWED', httpStatus: 403 }, 403, false, null);
    }
    // v0.32.1 dev-open: skip Invoke Token check for operator-UX routes
    if (!isDevOpenOperatorRoute(path)) {
      var mcToken = request.headers.get('X-WS3-Canary-Token');
      if (typeof mcToken !== 'string' || mcToken.length === 0) {
        return jsonResponse({ ok: false, status: 'BLOCKED', code: 'MISSING_INVOKE_TOKEN', httpStatus: 401 }, 401, true, origin);
      }
      if (typeof env.WS3_CANARY_INVOKE_TOKEN !== 'string' || env.WS3_CANARY_INVOKE_TOKEN.length === 0) {
        return jsonResponse({ ok: false, status: 'BLOCKED', code: 'MISSING_INVOKE_TOKEN', httpStatus: 503 }, 503, true, origin);
      }
      if (mcToken !== env.WS3_CANARY_INVOKE_TOKEN) {
        return jsonResponse({ ok: false, status: 'BLOCKED', code: 'INVOKE_TOKEN_MISMATCH', httpStatus: 403 }, 403, true, origin);
      }
    }

    var mcCt = request.headers.get('Content-Type');
    if (typeof mcCt !== 'string' || mcCt.toLowerCase().indexOf('application/json') === -1) {
      return jsonResponse({ ok: false, status: 'BLOCKED', code: 'UNSUPPORTED_MEDIA_TYPE', httpStatus: 415 }, 415, true, origin);
    }
    var mcCl = request.headers.get('Content-Length');
    if (typeof mcCl === 'string' && mcCl.length > 0) {
      var mcN = parseInt(mcCl, 10);
      if (isFinite(mcN) && mcN > MAX_BODY_BYTES) {
        return jsonResponse({ ok: false, status: 'BLOCKED', code: 'PAYLOAD_TOO_LARGE', httpStatus: 413 }, 413, true, origin);
      }
    }
    var mcBodyText = '';
    try { mcBodyText = await request.text(); } catch (e) {
      return jsonResponse({ ok: false, status: 'ERROR', code: 'INVALID_JSON', httpStatus: 400 }, 400, true, origin);
    }
    if (typeof mcBodyText === 'string' && mcBodyText.length > MAX_BODY_BYTES) {
      return jsonResponse({ ok: false, status: 'BLOCKED', code: 'PAYLOAD_TOO_LARGE', httpStatus: 413 }, 413, true, origin);
    }
    var mcBody;
    try { mcBody = JSON.parse(mcBodyText); } catch (e) {
      return jsonResponse({ ok: false, status: 'ERROR', code: 'INVALID_JSON', httpStatus: 400 }, 400, true, origin);
    }

    var mcValidate = validateMultiCandidateDryRunRequest(mcBody);
    if (mcValidate.ok !== true) {
      return jsonResponse({ ok: false, status: 'BLOCKED', code: mcValidate.code, httpStatus: mcValidate.httpStatus }, mcValidate.httpStatus, true, origin);
    }
    var mcReq = mcValidate.normalized;

    var mcDepsRes = buildWorkerRuntimeDeps(resolvedDeps, nowMs, state);
    if (mcDepsRes.ok !== true) {
      return jsonResponse({ ok: false, status: 'ERROR', code: 'UNKNOWN_ERROR', httpStatus: 500 }, 500, true, origin);
    }
    var mcDeps = mcDepsRes.deps;

    var pipelineResult;
    try {
      pipelineResult = await runMultiCandidatePipeline(mcDeps, mcReq);
    } catch (e) {
      return jsonResponse({ ok: false, status: 'ERROR', code: 'MULTI_CANDIDATE_FEATURE_ERROR', httpStatus: 500 }, 500, true, origin);
    }

    if (pipelineResult.okCount === 0 && pipelineResult.failCount > 0) {
      // All markets failed.
      return jsonResponse({
        ok: false,
        status: 'ERROR',
        code: 'MULTI_CANDIDATE_ALL_FAILED',
        httpStatus: 502,
        version: VERSION,
        mode: MULTI_CANDIDATE_DRY_RUN_MODE,
        exchange: mcReq.exchange,
        timeframe: mcReq.timeframe,
        limit: mcReq.limit,
        marketCount: mcReq.markets.length,
        okCount: 0,
        failCount: pipelineResult.failCount,
        candidateCount: 0,
        results: pipelineResult.results,
        safety: { telegramSent: false, kvWritten: false, candidateStored: false, trackingStarted: false }
      }, 502, true, origin);
    }

    var mcResponse = buildMultiCandidateDryRunResponse(mcReq, pipelineResult);
    return jsonResponse(mcResponse, 200, true, origin);
  }

  // POST /send-candidate-test  (v0.29 — ONE TEST_ONLY Telegram send + KV duplicate guard ONLY; NO candidate store, NO tracking start)
  if (path === '/send-candidate-test' && method === 'POST') {
    if (!origin) {
      return jsonResponse({ ok: false, status: 'BLOCKED', code: 'ORIGIN_MISSING', httpStatus: 403 }, 403, false, null);
    }
    if (!allowed) {
      return jsonResponse({ ok: false, status: 'BLOCKED', code: 'ORIGIN_NOT_ALLOWED', httpStatus: 403 }, 403, false, null);
    }
    var ctToken = request.headers.get('X-WS3-Canary-Token');
    if (typeof ctToken !== 'string' || ctToken.length === 0) {
      return jsonResponse({ ok: false, status: 'BLOCKED', code: 'MISSING_INVOKE_TOKEN', httpStatus: 401 }, 401, true, origin);
    }
    if (typeof env.WS3_CANARY_INVOKE_TOKEN !== 'string' || env.WS3_CANARY_INVOKE_TOKEN.length === 0) {
      return jsonResponse({ ok: false, status: 'BLOCKED', code: 'MISSING_INVOKE_TOKEN', httpStatus: 503 }, 503, true, origin);
    }
    if (ctToken !== env.WS3_CANARY_INVOKE_TOKEN) {
      return jsonResponse({ ok: false, status: 'BLOCKED', code: 'INVOKE_TOKEN_MISMATCH', httpStatus: 403 }, 403, true, origin);
    }

    // v0.30: enable gate check moved to AFTER body parse so forced-mode flag can route error code.
    var ctEnabled = (typeof env.WS3_CANDIDATE_TEST_ENABLED === 'string' && env.WS3_CANDIDATE_TEST_ENABLED === 'true');

    var ctCt = request.headers.get('Content-Type');
    if (typeof ctCt !== 'string' || ctCt.toLowerCase().indexOf('application/json') === -1) {
      return jsonResponse({ ok: false, status: 'BLOCKED', code: 'UNSUPPORTED_MEDIA_TYPE', httpStatus: 415 }, 415, true, origin);
    }
    var ctCl = request.headers.get('Content-Length');
    if (typeof ctCl === 'string' && ctCl.length > 0) {
      var ctN = parseInt(ctCl, 10);
      if (isFinite(ctN) && ctN > MAX_BODY_BYTES * 2) {
        return jsonResponse({ ok: false, status: 'BLOCKED', code: 'PAYLOAD_TOO_LARGE', httpStatus: 413 }, 413, true, origin);
      }
    }
    var ctBodyText = '';
    try { ctBodyText = await request.text(); } catch (e) {
      return jsonResponse({ ok: false, status: 'ERROR', code: 'INVALID_JSON', httpStatus: 400 }, 400, true, origin);
    }
    if (typeof ctBodyText === 'string' && ctBodyText.length > MAX_BODY_BYTES * 2) {
      return jsonResponse({ ok: false, status: 'BLOCKED', code: 'PAYLOAD_TOO_LARGE', httpStatus: 413 }, 413, true, origin);
    }
    var ctBody;
    try { ctBody = JSON.parse(ctBodyText); } catch (e) {
      return jsonResponse({ ok: false, status: 'ERROR', code: 'INVALID_JSON', httpStatus: 400 }, 400, true, origin);
    }

    // v0.30: enable gate check (forced-aware code routing based on body.forceTestCandidate).
    if (!ctEnabled) {
      var disabledCode = (isPlainObject(ctBody) && ctBody.forceTestCandidate === true)
        ? 'FORCED_CANDIDATE_TEST_DISABLED'
        : 'CANDIDATE_TEST_DISABLED';
      return jsonResponse({ ok: false, status: 'BLOCKED', code: disabledCode, httpStatus: 503 }, 503, true, origin);
    }

    var ctValidate = validateCandidateTestRequest(ctBody);
    if (ctValidate.ok !== true) {
      return jsonResponse({ ok: false, status: 'BLOCKED', code: ctValidate.code, httpStatus: ctValidate.httpStatus }, ctValidate.httpStatus, true, origin);
    }
    var ctCandidate = ctValidate.normalized;
    var ctForced = (ctCandidate.forced === true);
    // v0.30: error code namespace switches based on forced mode (already used by validate; below codes are post-validate)
    var ctAlreadySentCode = ctForced ? 'FORCED_CANDIDATE_TEST_ALREADY_SENT' : 'CANDIDATE_TEST_ALREADY_SENT';
    var ctTelegramErrorCode = ctForced ? 'FORCED_CANDIDATE_TEST_TELEGRAM_ERROR' : 'CANDIDATE_TEST_TELEGRAM_ERROR';

    // KV duplicate guard (read-modify-write only on this dedicated key). Shared across normal + forced modes.
    var ctKv = isPlainObject(resolvedDeps) && hasOwn(resolvedDeps, 'kv') ? resolvedDeps.kv : (env ? env[KV_BINDING_NAME] : null);
    if (!ctKv || typeof ctKv.get !== 'function' || typeof ctKv.put !== 'function') {
      return jsonResponse({ ok: false, status: 'BLOCKED', code: 'PERSISTENCE_UNAVAILABLE', httpStatus: 503 }, 503, true, origin);
    }
    var guardRead = await CanaryStateKvAdapter.getJson(ctKv, CANDIDATE_TEST_GUARD_KEY);
    if (guardRead && guardRead.ok === true && isPlainObject(guardRead.value)) {
      var lastSent = guardRead.value.lastSentAt;
      if (typeof lastSent === 'number' && isFinite(lastSent) && (nowMs - lastSent) < CANDIDATE_TEST_GUARD_WINDOW_MS) {
        return jsonResponse({ ok: false, status: 'BLOCKED', code: ctAlreadySentCode, httpStatus: 429 }, 429, true, origin);
      }
    }

    var ctDepsRes = buildWorkerRuntimeDeps(resolvedDeps, nowMs, state);
    if (ctDepsRes.ok !== true) {
      return jsonResponse({ ok: false, status: 'ERROR', code: 'UNKNOWN_ERROR', httpStatus: 500 }, 500, true, origin);
    }
    var ctDeps = ctDepsRes.deps;

    var ctMessageText = buildCandidateTestMessageText(ctCandidate);
    var ctSendRes = await sendCandidateTestTelegram(ctDeps, env, ctMessageText);
    if (ctSendRes.ok !== true) {
      return jsonResponse({ ok: false, status: 'ERROR', code: ctTelegramErrorCode, httpStatus: 502 }, 502, true, origin);
    }

    // Write duplicate guard immediately after successful send. messageType audit included for forced/normal distinction.
    var guardWriteRes = await CanaryStateKvAdapter.putJson(ctKv, CANDIDATE_TEST_GUARD_KEY, {
      schemaVersion: 'v1',
      lastSentAt: nowMs,
      reason: ctForced ? FORCED_CANDIDATE_TEST_GUARD_REASON : CANDIDATE_TEST_GUARD_REASON,
      messageType: ctForced ? FORCED_CANDIDATE_TEST_MESSAGE_TYPE : CANDIDATE_TEST_MESSAGE_TYPE,
      market: ctCandidate.market
    });
    var kvWritten = (guardWriteRes && guardWriteRes.ok === true);
    return jsonResponse(buildCandidateTestResponse(kvWritten, ctForced), 200, true, origin);
  }

  // POST /send-limited-live-alert  (v0.31 — LIMITED LIVE / OPERATOR REVIEW Telegram 1회 발송; per-(market,timeframe) KV guard 만)
  if (path === '/send-limited-live-alert' && method === 'POST') {
    if (!origin) {
      return jsonResponse({ ok: false, status: 'BLOCKED', code: 'ORIGIN_MISSING', httpStatus: 403 }, 403, false, null);
    }
    if (!allowed) {
      return jsonResponse({ ok: false, status: 'BLOCKED', code: 'ORIGIN_NOT_ALLOWED', httpStatus: 403 }, 403, false, null);
    }
    // v0.32.1 dev-open: skip Invoke Token check for operator-UX routes
    if (!isDevOpenOperatorRoute(path)) {
      var llToken = request.headers.get('X-WS3-Canary-Token');
      if (typeof llToken !== 'string' || llToken.length === 0) {
        return jsonResponse({ ok: false, status: 'BLOCKED', code: 'MISSING_INVOKE_TOKEN', httpStatus: 401 }, 401, true, origin);
      }
      if (typeof env.WS3_CANARY_INVOKE_TOKEN !== 'string' || env.WS3_CANARY_INVOKE_TOKEN.length === 0) {
        return jsonResponse({ ok: false, status: 'BLOCKED', code: 'MISSING_INVOKE_TOKEN', httpStatus: 503 }, 503, true, origin);
      }
      if (llToken !== env.WS3_CANARY_INVOKE_TOKEN) {
        return jsonResponse({ ok: false, status: 'BLOCKED', code: 'INVOKE_TOKEN_MISMATCH', httpStatus: 403 }, 403, true, origin);
      }
    }

    var llEnabled = (typeof env.WS3_LIMITED_LIVE_ENABLED === 'string' && env.WS3_LIMITED_LIVE_ENABLED === 'true');

    var llCt = request.headers.get('Content-Type');
    if (typeof llCt !== 'string' || llCt.toLowerCase().indexOf('application/json') === -1) {
      return jsonResponse({ ok: false, status: 'BLOCKED', code: 'UNSUPPORTED_MEDIA_TYPE', httpStatus: 415 }, 415, true, origin);
    }
    var llCl = request.headers.get('Content-Length');
    if (typeof llCl === 'string' && llCl.length > 0) {
      var llN = parseInt(llCl, 10);
      if (isFinite(llN) && llN > MAX_BODY_BYTES * 2) {
        return jsonResponse({ ok: false, status: 'BLOCKED', code: 'PAYLOAD_TOO_LARGE', httpStatus: 413 }, 413, true, origin);
      }
    }
    var llBodyText = '';
    try { llBodyText = await request.text(); } catch (e) {
      return jsonResponse({ ok: false, status: 'ERROR', code: 'INVALID_JSON', httpStatus: 400 }, 400, true, origin);
    }
    if (typeof llBodyText === 'string' && llBodyText.length > MAX_BODY_BYTES * 2) {
      return jsonResponse({ ok: false, status: 'BLOCKED', code: 'PAYLOAD_TOO_LARGE', httpStatus: 413 }, 413, true, origin);
    }
    var llBody;
    try { llBody = JSON.parse(llBodyText); } catch (e) {
      return jsonResponse({ ok: false, status: 'ERROR', code: 'INVALID_JSON', httpStatus: 400 }, 400, true, origin);
    }

    // Disabled gate (after parse so error code is consistent).
    if (!llEnabled) {
      return jsonResponse({ ok: false, status: 'BLOCKED', code: 'LIMITED_LIVE_DISABLED', httpStatus: 503 }, 503, true, origin);
    }

    var llValidate = validateLimitedLiveAlertRequest(llBody);
    if (llValidate.ok !== true) {
      return jsonResponse({ ok: false, status: 'BLOCKED', code: llValidate.code, httpStatus: llValidate.httpStatus }, llValidate.httpStatus, true, origin);
    }
    var llCandidate = llValidate.normalized;

    // KV duplicate guard (per-(market,timeframe) key, 60s window).
    var llKv = isPlainObject(resolvedDeps) && hasOwn(resolvedDeps, 'kv') ? resolvedDeps.kv : (env ? env[KV_BINDING_NAME] : null);
    if (!llKv || typeof llKv.get !== 'function' || typeof llKv.put !== 'function') {
      return jsonResponse({ ok: false, status: 'BLOCKED', code: 'PERSISTENCE_UNAVAILABLE', httpStatus: 503 }, 503, true, origin);
    }
    var llGuardKey = buildLimitedLiveGuardKey(llCandidate.market, llCandidate.timeframe);
    var llGuardRead = await CanaryStateKvAdapter.getJson(llKv, llGuardKey);
    if (llGuardRead && llGuardRead.ok === true && isPlainObject(llGuardRead.value)) {
      var llLastSent = llGuardRead.value.lastSentAt;
      if (typeof llLastSent === 'number' && isFinite(llLastSent) && (nowMs - llLastSent) < LIMITED_LIVE_GUARD_WINDOW_MS) {
        return jsonResponse({ ok: false, status: 'BLOCKED', code: 'LIMITED_LIVE_ALREADY_SENT', httpStatus: 429 }, 429, true, origin);
      }
    }

    var llDepsRes = buildWorkerRuntimeDeps(resolvedDeps, nowMs, state);
    if (llDepsRes.ok !== true) {
      return jsonResponse({ ok: false, status: 'ERROR', code: 'UNKNOWN_ERROR', httpStatus: 500 }, 500, true, origin);
    }
    var llDeps = llDepsRes.deps;

    var llMessageText = buildLimitedLiveAlertMessageText(llCandidate);
    var llSendRes = await sendLimitedLiveAlertTelegram(llDeps, env, llMessageText);
    if (llSendRes.ok !== true) {
      return jsonResponse({ ok: false, status: 'ERROR', code: 'LIMITED_LIVE_TELEGRAM_ERROR', httpStatus: 502 }, 502, true, origin);
    }

    // Write per-(market,timeframe) guard. messageType + market + timeframe audit included.
    var llGuardWriteRes = await CanaryStateKvAdapter.putJson(llKv, llGuardKey, {
      schemaVersion: 'v1',
      lastSentAt: nowMs,
      reason: LIMITED_LIVE_GUARD_REASON,
      messageType: LIMITED_LIVE_MESSAGE_TYPE,
      market: llCandidate.market,
      timeframe: llCandidate.timeframe,
      score: llCandidate.score,
      grade: llCandidate.grade,
      operatorReviewLevel: llCandidate.operatorReviewLevel
    });
    var llKvWritten = (llGuardWriteRes && llGuardWriteRes.ok === true);
    return jsonResponse(buildLimitedLiveAlertResponse(llKvWritten), 200, true, origin);
  }

  // Fallback — unknown path/method
  return jsonResponse({ ok: false, status: 'ERROR', code: 'METHOD_NOT_ALLOWED', httpStatus: 405 }, 405, allowed === true, origin);
}

// §export ──────────────────────────────────────────────────────────────
// CommonJS for Node testing. For Cloudflare deploy, bundler should convert
// `module.exports.default` into `export default`.
module.exports = {
  handleFetch: handleFetch,
  CANARY_PROCESS_STATE: CANARY_PROCESS_STATE,
  VERSION: VERSION,
  SERVICE: SERVICE,
  STATUS_READY_CODE: STATUS_READY_CODE,
  MAX_BODY_BYTES: MAX_BODY_BYTES,
  INVOKE_TOKEN_MISMATCH_THRESHOLD: INVOKE_TOKEN_MISMATCH_THRESHOLD,
  INVOKE_TOKEN_MISMATCH_BLOCK_MS: INVOKE_TOKEN_MISMATCH_BLOCK_MS,
  INVOKE_TOKEN_PERSISTENT_THRESHOLD: INVOKE_TOKEN_PERSISTENT_THRESHOLD,
  INVOKE_TOKEN_PERSISTENT_BLOCK_MS: INVOKE_TOKEN_PERSISTENT_BLOCK_MS,
  CIRCUIT_PERSISTENT_FAIL_THRESHOLD: CIRCUIT_PERSISTENT_FAIL_THRESHOLD,
  CIRCUIT_PERSISTENT_BLOCK_MS: CIRCUIT_PERSISTENT_BLOCK_MS,
  CANARY_MESSAGE_TYPE: CANARY_MESSAGE_TYPE,
  KV_BINDING_NAME: KV_BINDING_NAME,
  CLEANUP_REASON_LIVE_SENT: CLEANUP_REASON_LIVE_SENT,
  OPERATOR_RESET_PHRASE: OPERATOR_RESET_PHRASE,
  OPERATOR_RESET_COOLDOWN_MS: OPERATOR_RESET_COOLDOWN_MS,
  OPERATOR_RESET_REASON: OPERATOR_RESET_REASON,
  LIVE_PREFLIGHT_MODE: LIVE_PREFLIGHT_MODE,
  LIVE_PREFLIGHT_FETCH_TIMEOUT_MS: LIVE_PREFLIGHT_FETCH_TIMEOUT_MS,
  LIVE_PREFLIGHT_LIMIT_MIN: LIVE_PREFLIGHT_LIMIT_MIN,
  LIVE_PREFLIGHT_LIMIT_MAX: LIVE_PREFLIGHT_LIMIT_MAX,
  LIVE_PREFLIGHT_ALLOWED_EXCHANGES: LIVE_PREFLIGHT_ALLOWED_EXCHANGES,
  LIVE_PREFLIGHT_ALLOWED_TIMEFRAMES: LIVE_PREFLIGHT_ALLOWED_TIMEFRAMES,
  LIVE_PREFLIGHT_MARKET_PATTERN: LIVE_PREFLIGHT_MARKET_PATTERN,
  validateLivePreflightRequest: validateLivePreflightRequest,
  buildLivePreflightUrl: buildLivePreflightUrl,
  normalizeCandles: normalizeCandles,
  summarizeCandles: summarizeCandles,
  fetchLiveCandles: fetchLiveCandles,
  buildLivePreflightResponse: buildLivePreflightResponse,
  CANDIDATE_DRY_RUN_MODE: CANDIDATE_DRY_RUN_MODE,
  CANDIDATE_DRY_RUN_LIMIT_MIN: CANDIDATE_DRY_RUN_LIMIT_MIN,
  CANDIDATE_DRY_RUN_LIMIT_MAX: CANDIDATE_DRY_RUN_LIMIT_MAX,
  CANDIDATE_DRY_RUN_REASON_CHIP_MAX: CANDIDATE_DRY_RUN_REASON_CHIP_MAX,
  validateCandidateDryRunRequest: validateCandidateDryRunRequest,
  mapFetchCodeToCandidateDryRunCode: mapFetchCodeToCandidateDryRunCode,
  calculateCandleStructureFeatures: calculateCandleStructureFeatures,
  calculateVolumeFeatures: calculateVolumeFeatures,
  calculateMomentumFeatures: calculateMomentumFeatures,
  calculateCandidateDryRunScore: calculateCandidateDryRunScore,
  classifyCandidateDryRunGrade: classifyCandidateDryRunGrade,
  buildCandidateDryRunResponse: buildCandidateDryRunResponse,
  safeDivide: safeDivide,
  MULTI_CANDIDATE_DRY_RUN_MODE: MULTI_CANDIDATE_DRY_RUN_MODE,
  MULTI_CANDIDATE_MAX_MARKETS: MULTI_CANDIDATE_MAX_MARKETS,
  CANDIDATE_TEST_MODE: CANDIDATE_TEST_MODE,
  CANDIDATE_TEST_CONFIRM_PHRASE: CANDIDATE_TEST_CONFIRM_PHRASE,
  CANDIDATE_TEST_MESSAGE_TYPE: CANDIDATE_TEST_MESSAGE_TYPE,
  CANDIDATE_TEST_GUARD_KEY: CANDIDATE_TEST_GUARD_KEY,
  CANDIDATE_TEST_GUARD_REASON: CANDIDATE_TEST_GUARD_REASON,
  CANDIDATE_TEST_GUARD_WINDOW_MS: CANDIDATE_TEST_GUARD_WINDOW_MS,
  LIMITED_LIVE_MODE_STATUS: LIMITED_LIVE_MODE_STATUS,
  FORCED_CANDIDATE_TEST_MODE: FORCED_CANDIDATE_TEST_MODE,
  FORCED_CANDIDATE_TEST_MESSAGE_TYPE: FORCED_CANDIDATE_TEST_MESSAGE_TYPE,
  FORCED_CANDIDATE_TEST_CONFIRM_PHRASE: FORCED_CANDIDATE_TEST_CONFIRM_PHRASE,
  FORCED_CANDIDATE_TEST_GUARD_REASON: FORCED_CANDIDATE_TEST_GUARD_REASON,
  FORCED_CANDIDATE_TEST_REASON_MAX_LEN: FORCED_CANDIDATE_TEST_REASON_MAX_LEN,
  FORCED_CANDIDATE_TEST_REASON_PATTERN: FORCED_CANDIDATE_TEST_REASON_PATTERN,
  LIMITED_LIVE_MODE: LIMITED_LIVE_MODE,
  LIMITED_LIVE_MESSAGE_TYPE: LIMITED_LIVE_MESSAGE_TYPE,
  LIMITED_LIVE_CONFIRM_PHRASE: LIMITED_LIVE_CONFIRM_PHRASE,
  LIMITED_LIVE_GUARD_KEY_PREFIX: LIMITED_LIVE_GUARD_KEY_PREFIX,
  LIMITED_LIVE_GUARD_REASON: LIMITED_LIVE_GUARD_REASON,
  LIMITED_LIVE_GUARD_WINDOW_MS: LIMITED_LIVE_GUARD_WINDOW_MS,
  classifyOperatorReview: classifyOperatorReview,
  operatorReviewLevelPriority: operatorReviewLevelPriority,
  countOperatorReviewByLevel: countOperatorReviewByLevel,
  buildLimitedLiveGuardKey: buildLimitedLiveGuardKey,
  validateLimitedLiveAlertRequest: validateLimitedLiveAlertRequest,
  buildLimitedLiveAlertMessageText: buildLimitedLiveAlertMessageText,
  sendLimitedLiveAlertTelegram: sendLimitedLiveAlertTelegram,
  buildLimitedLiveAlertResponse: buildLimitedLiveAlertResponse,
  validateMultiCandidateDryRunRequest: validateMultiCandidateDryRunRequest,
  runMultiCandidatePipeline: runMultiCandidatePipeline,
  classifyV3Grade: classifyV3Grade,
  mapToV3Timeframe: mapToV3Timeframe,
  buildMultiCandidateDryRunResponse: buildMultiCandidateDryRunResponse,
  countCandidates: countCandidates,
  validateCandidateTestRequest: validateCandidateTestRequest,
  buildCandidateTestMessageText: buildCandidateTestMessageText,
  sendCandidateTestTelegram: sendCandidateTestTelegram,
  buildCandidateTestResponse: buildCandidateTestResponse,
  mapErrorCodeToWeb: mapErrorCodeToWeb,
  isAllowedOrigin: isAllowedOrigin,
  buildMinimalPreflightGate: buildMinimalPreflightGate,
  buildWorkerRuntimeDeps: buildWorkerRuntimeDeps,
  default: {
    fetch: function(request, env, ctx) { return handleFetch(request, env, ctx); }
  }
};
