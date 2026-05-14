/**
 * WS3 v0.2.0-a · Bithumb 입력 골격
 * Scope: proxy worker 경유 candles fetch + markets unsupported placeholder.
 * No indicator calc, score, structure, UI, Telegram, snapshot, or Worker logic.
 *
 * 참고만: v5.x index.html fetchCandlesForExchange — proxy URL 패턴 차용
 * proxy 응답 샘플 (Q.A 결과 박제):
 *   { candles: [ { time, open, close, high, low, volume } ] }
 */
(function(global){
  'use strict';

  var FETCH_TIMEOUT_MS = 7000;
  var FETCH_ERROR_CODE = {
    TIMEOUT: 'TIMEOUT',
    ABORTED: 'ABORTED',
    NETWORK_ERROR: 'NETWORK_ERROR',
    HTTP_ERROR: 'HTTP_ERROR',
    PARSE_ERROR: 'PARSE_ERROR',
    EMPTY_RESPONSE: 'EMPTY_RESPONSE',
    INVALID_FORMAT: 'INVALID_FORMAT',
    UNSUPPORTED: 'UNSUPPORTED'
  };

  var PATH_BITHUMB_CANDLES = '/bithumb/candles';
  var PATH_BITHUMB_MARKETS = '/bithumb/markets';

  function createFetchError(stage, ctx, code, message) {
    var c = ctx || {};
    return {
      stage: stage,
      exchange: c.exchange || 'BITHUMB',
      market: c.market || null,
      timeframe: c.timeframe || null,
      code: code,
      message: message || '',
      at: Date.now()
    };
  }

  function joinProxyPath(proxyBaseUrl, path) {
    var base = String(proxyBaseUrl || '').replace(/\/+$/, '');
    var p = String(path || '');
    if (p.charAt(0) !== '/') p = '/' + p;
    return base + p;
  }

  function fetchWithTimeout(url, timeoutMs) {
    var controller = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    var timer = null;
    var aborted = false;

    var timeoutPromise = new Promise(function(resolve){
      timer = setTimeout(function(){
        aborted = true;
        if (controller) { try { controller.abort(); } catch(e){} }
        resolve({ ok: false, code: FETCH_ERROR_CODE.TIMEOUT, message: 'Request timed out after ' + timeoutMs + 'ms' });
      }, timeoutMs);
    });

    var fetchPromise = (function(){
      var opts = controller ? { signal: controller.signal } : {};
      return fetch(url, opts).then(function(resp){
        if (timer) clearTimeout(timer);
        return { ok: true, response: resp };
      }).catch(function(err){
        if (timer) clearTimeout(timer);
        if (aborted) return { ok: false, code: FETCH_ERROR_CODE.TIMEOUT, message: 'Aborted by timeout' };
        var name = (err && err.name) || '';
        if (name === 'AbortError') return { ok: false, code: FETCH_ERROR_CODE.ABORTED, message: 'Fetch aborted' };
        return { ok: false, code: FETCH_ERROR_CODE.NETWORK_ERROR, message: (err && err.message) || 'Network error' };
      });
    })();

    return Promise.race([fetchPromise, timeoutPromise]);
  }

  async function fetchBithumbCandles(opts) {
    var o = opts || {};
    var ctx = { exchange: 'BITHUMB', market: o.market || null, timeframe: o.timeframe || null };

    if (!o.proxyBaseUrl || typeof o.proxyBaseUrl !== 'string') {
      return { ok: false, rawResponse: null, rawCandles: [], error: createFetchError('FETCH_CANDLES', ctx, FETCH_ERROR_CODE.INVALID_FORMAT, 'proxyBaseUrl missing') };
    }
    if (!o.market || typeof o.market !== 'string') {
      return { ok: false, rawResponse: null, rawCandles: [], error: createFetchError('FETCH_CANDLES', ctx, FETCH_ERROR_CODE.INVALID_FORMAT, 'market missing') };
    }
    var count = (typeof o.count === 'number' && o.count > 0) ? o.count : 100;

    var url = joinProxyPath(o.proxyBaseUrl, PATH_BITHUMB_CANDLES)
      + '?market=' + encodeURIComponent(o.market)
      + '&count=' + encodeURIComponent(count);

    var res = await fetchWithTimeout(url, FETCH_TIMEOUT_MS);
    if (!res.ok) {
      return { ok: false, rawResponse: null, rawCandles: [], error: createFetchError('FETCH_CANDLES', ctx, res.code, res.message) };
    }

    var resp = res.response;
    if (!resp || typeof resp.status !== 'number') {
      return { ok: false, rawResponse: null, rawCandles: [], error: createFetchError('FETCH_CANDLES', ctx, FETCH_ERROR_CODE.NETWORK_ERROR, 'No response object') };
    }
    if (resp.status < 200 || resp.status >= 300) {
      return { ok: false, rawResponse: null, rawCandles: [], error: createFetchError('FETCH_CANDLES', ctx, FETCH_ERROR_CODE.HTTP_ERROR, 'HTTP ' + resp.status) };
    }

    var json;
    try { json = await resp.json(); }
    catch (err) {
      return { ok: false, rawResponse: null, rawCandles: [], error: createFetchError('FETCH_CANDLES', ctx, FETCH_ERROR_CODE.PARSE_ERROR, (err && err.message) || 'JSON parse failed') };
    }

    if (!json || typeof json !== 'object') {
      return { ok: false, rawResponse: json, rawCandles: [], error: createFetchError('FETCH_CANDLES', ctx, FETCH_ERROR_CODE.INVALID_FORMAT, 'Response is not an object') };
    }
    var rawCandles = json.candles;
    if (!Array.isArray(rawCandles)) {
      return { ok: false, rawResponse: json, rawCandles: [], error: createFetchError('FETCH_CANDLES', ctx, FETCH_ERROR_CODE.INVALID_FORMAT, 'Response.candles is not an array') };
    }
    if (rawCandles.length === 0) {
      return { ok: false, rawResponse: json, rawCandles: [], error: createFetchError('FETCH_CANDLES', ctx, FETCH_ERROR_CODE.EMPTY_RESPONSE, 'Response.candles is empty') };
    }
    return { ok: true, rawResponse: json, rawCandles: rawCandles };
  }

  async function fetchBithumbMarkets(opts) {
    var ctx = { exchange: 'BITHUMB', market: null, timeframe: null };
    return {
      ok: false,
      rawResponse: null,
      markets: [],
      error: createFetchError('FETCH_MARKETS', ctx, FETCH_ERROR_CODE.UNSUPPORTED, 'proxy /bithumb/markets endpoint is not available (Q.A 2026-05-13)')
    };
  }

  global.WS3_BithumbClient = Object.freeze({
    fetchBithumbCandles: fetchBithumbCandles,
    fetchBithumbMarkets: fetchBithumbMarkets,
    createFetchError: createFetchError,
    FETCH_ERROR_CODE: FETCH_ERROR_CODE,
    FETCH_TIMEOUT_MS: FETCH_TIMEOUT_MS
  });
})(typeof window !== 'undefined' ? window : globalThis);
