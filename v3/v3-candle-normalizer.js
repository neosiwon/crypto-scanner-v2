/**
 * WS3 v0.2.0-a · Bithumb 입력 골격
 * Scope: raw candle → V3Candle normalization only.
 * No fetch, indicator calc, score, structure, UI, Telegram, snapshot logic.
 *
 * Depends on: v3-feature-payload.js (V3Candle typedef — IIFE export 없음 / typedef only)
 *
 * proxy 응답 샘플 (Q.A 결과 박제):
 *   { time, open, close, high, low, volume }
 * → 거래대금 필드 없음 → 모든 캔들이 estimated_close_volume 분기.
 */
(function(global){
  'use strict';

  var TRADE_VALUE_SOURCE = { API: 'api', ESTIMATED_CLOSE_VOLUME: 'estimated_close_volume', MISSING: 'missing' };
  var ERR_INVALID_FORMAT = 'INVALID_FORMAT';
  var ERR_PARSE_ERROR = 'PARSE_ERROR';

  function isFiniteNumber(v) { return typeof v === 'number' && isFinite(v); }

  function createNormalizeError(ctx, code, message, index) {
    var c = ctx || {};
    return {
      stage: 'NORMALIZE_CANDLE',
      exchange: c.exchange || 'BITHUMB',
      market: c.market || null,
      timeframe: c.timeframe || null,
      code: code,
      message: (typeof index === 'number') ? ('[index=' + index + '] ' + (message || '')) : (message || ''),
      at: Date.now()
    };
  }

  function normalizeCandle(raw, ctx) {
    if (raw === null || raw === undefined || (typeof raw !== 'object')) {
      return { ok: false, candle: null, tradeValueSource: TRADE_VALUE_SOURCE.MISSING, error: createNormalizeError(ctx, ERR_INVALID_FORMAT, 'raw is not an object') };
    }
    if (Array.isArray(raw)) {
      return { ok: false, candle: null, tradeValueSource: TRADE_VALUE_SOURCE.MISSING, error: createNormalizeError(ctx, ERR_INVALID_FORMAT, 'Array raw not supported in v0.2.0-a') };
    }

    var ts = raw.time;
    var open = raw.open;
    var high = raw.high;
    var low = raw.low;
    var close = raw.close;
    var volume = raw.volume;

    if (!isFiniteNumber(ts)) return { ok: false, candle: null, tradeValueSource: TRADE_VALUE_SOURCE.MISSING, error: createNormalizeError(ctx, ERR_PARSE_ERROR, 'time is not a finite number') };
    if (!isFiniteNumber(open)) return { ok: false, candle: null, tradeValueSource: TRADE_VALUE_SOURCE.MISSING, error: createNormalizeError(ctx, ERR_PARSE_ERROR, 'open is not a finite number') };
    if (!isFiniteNumber(high)) return { ok: false, candle: null, tradeValueSource: TRADE_VALUE_SOURCE.MISSING, error: createNormalizeError(ctx, ERR_PARSE_ERROR, 'high is not a finite number') };
    if (!isFiniteNumber(low)) return { ok: false, candle: null, tradeValueSource: TRADE_VALUE_SOURCE.MISSING, error: createNormalizeError(ctx, ERR_PARSE_ERROR, 'low is not a finite number') };
    if (!isFiniteNumber(close)) return { ok: false, candle: null, tradeValueSource: TRADE_VALUE_SOURCE.MISSING, error: createNormalizeError(ctx, ERR_PARSE_ERROR, 'close is not a finite number') };
    if (!isFiniteNumber(volume)) return { ok: false, candle: null, tradeValueSource: TRADE_VALUE_SOURCE.MISSING, error: createNormalizeError(ctx, ERR_PARSE_ERROR, 'volume is not a finite number') };

    var tradeValue = null;
    var source = TRADE_VALUE_SOURCE.MISSING;
    if (close > 0 && volume >= 0) {
      tradeValue = close * volume;
      source = TRADE_VALUE_SOURCE.ESTIMATED_CLOSE_VOLUME;
    }

    return {
      ok: true,
      candle: { ts: ts, open: open, high: high, low: low, close: close, volume: volume, tradeValue: tradeValue },
      tradeValueSource: source
    };
  }

  function normalizeCandleArray(rawArray, ctx) {
    var result = { candles: [], sources: [], errors: [] };
    if (!Array.isArray(rawArray)) {
      result.errors.push(createNormalizeError(ctx, ERR_INVALID_FORMAT, 'rawArray is not an array'));
      return result;
    }
    for (var i = 0; i < rawArray.length; i++) {
      var r = normalizeCandle(rawArray[i], ctx);
      if (r.ok && r.candle) {
        var idx = result.candles.length;
        result.candles.push(r.candle);
        result.sources.push({ index: idx, source: r.tradeValueSource });
      } else if (r.error) {
        r.error.message = '[rawIndex=' + i + '] ' + (r.error.message || '');
        result.errors.push(r.error);
      }
    }
    return result;
  }

  global.WS3_CandleNormalizer = Object.freeze({
    normalizeCandle: normalizeCandle,
    normalizeCandleArray: normalizeCandleArray,
    TRADE_VALUE_SOURCE: TRADE_VALUE_SOURCE
  });
})(typeof window !== 'undefined' ? window : globalThis);
