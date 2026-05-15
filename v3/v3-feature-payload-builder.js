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
