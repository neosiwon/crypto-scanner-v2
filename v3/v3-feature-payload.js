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
