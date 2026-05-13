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

  // ════════════════════════════════════════════════════════════════════
  // [Section 01] CONSTANTS — 내부 상수 (config 승격 X / v0.1.0 박제 보호)
  // ════════════════════════════════════════════════════════════════════
  var FETCH_TIMEOUT_MS = 7000;

  // 에러 코드 enum — Q.E 결정: client 내부 상수 (config 외부)
  var FETCH_ERROR_CODE = {
    TIMEOUT:        'TIMEOUT',
    ABORTED:        'ABORTED',
    NETWORK_ERROR:  'NETWORK_ERROR',
    HTTP_ERROR:     'HTTP_ERROR',
    PARSE_ERROR:    'PARSE_ERROR',
    EMPTY_RESPONSE: 'EMPTY_RESPONSE',
    INVALID_FORMAT: 'INVALID_FORMAT',
    UNSUPPORTED:    'UNSUPPORTED'      // v0.3 — endpoint 미지원
  };

  // proxy endpoint path
  var PATH_BITHUMB_CANDLES = '/bithumb/candles';
  var PATH_BITHUMB_MARKETS = '/bithumb/markets';   // 미지원 확인됨 (Q.A 결과)


  // ════════════════════════════════════════════════════════════════════
  // [Section 02] ERROR FACTORY — raw.errors 호환 형식
  // ════════════════════════════════════════════════════════════════════
  /**
   * 에러 객체 생성 (raw.errors 누적용)
   *
   * @param {string} stage    - 'FETCH_CANDLES' | 'FETCH_MARKETS' | 'NORMALIZE_CANDLE'
   * @param {Object} ctx      - { exchange?, market?, timeframe? } (각 필드 null 허용)
   * @param {string} code     - FETCH_ERROR_CODE 값
   * @param {string} message  - 사람이 읽는 메시지
   * @returns {{stage, exchange, market, timeframe, code, message, at}}
   */
  function createFetchError(stage, ctx, code, message) {
    var c = ctx || {};
    return {
      stage:     stage,
      exchange:  c.exchange  || 'BITHUMB',
      market:    c.market    || null,
      timeframe: c.timeframe || null,
      code:      code,
      message:   message || '',
      at:        Date.now()
    };
  }


  // ════════════════════════════════════════════════════════════════════
  // [Section 03] FETCH HELPER — timeout + AbortController
  // ════════════════════════════════════════════════════════════════════
  /**
   * proxyBaseUrl과 path를 안전하게 결합.
   * proxyBaseUrl 끝의 trailing slash(들)를 제거하고, path 앞에 leading slash 보장.
   * 단순 문자열 연결로 '//bithumb/candles' 같은 이중 슬래시 발생 방지.
   *
   * 예시:
   *   joinProxyPath('https://x.workers.dev',  '/bithumb/candles')
   *   joinProxyPath('https://x.workers.dev/', '/bithumb/candles')
   *   → 둘 다 'https://x.workers.dev/bithumb/candles'
   *
   * @param {string} proxyBaseUrl
   * @param {string} path
   * @returns {string}
   */
  function joinProxyPath(proxyBaseUrl, path) {
    var base = String(proxyBaseUrl || '').replace(/\/+$/, '');
    var p = String(path || '');
    if (p.charAt(0) !== '/') p = '/' + p;
    return base + p;
  }

  /**
   * timeout을 가진 fetch 래퍼.
   * 실패 사유를 FETCH_ERROR_CODE로 분류.
   *
   * @param {string} url
   * @param {number} timeoutMs
   * @returns {Promise<{ok: boolean, response?: Response, code?: string, message?: string}>}
   */
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
        if (aborted) {
          // timeout 경로에서 이미 처리됨
          return { ok: false, code: FETCH_ERROR_CODE.TIMEOUT, message: 'Aborted by timeout' };
        }
        var name = (err && err.name) || '';
        if (name === 'AbortError') {
          return { ok: false, code: FETCH_ERROR_CODE.ABORTED, message: 'Fetch aborted' };
        }
        return { ok: false, code: FETCH_ERROR_CODE.NETWORK_ERROR, message: (err && err.message) || 'Network error' };
      });
    })();

    return Promise.race([fetchPromise, timeoutPromise]);
  }


  // ════════════════════════════════════════════════════════════════════
  // [Section 04] FETCH CANDLES
  // ════════════════════════════════════════════════════════════════════
  /**
   * 빗썸 캔들 fetch (proxy worker 경유).
   *
   * v0.2.0-a 호출은 timeframe: 'h1' 고정. 함수 시그니처는 multi-TF 확장 가능.
   * URL에는 timeframe을 반영하지 않음 (proxy timeframe 파라미터 지원 여부 미확인 / 후속 단계 결정).
   *
   * 응답 구조 (Q.A 확인):
   *   { candles: [ { time, open, close, high, low, volume } ] }
   *
   * @param {Object} opts
   * @param {string} opts.market         - 'KRW-BTC' (내부 표준)
   * @param {string} opts.timeframe      - 'm5' | 'm15' | 'h1' | 'h4' | 'd1' (현재 URL 미반영)
   * @param {number} opts.count          - 예: 100
   * @param {string} opts.proxyBaseUrl   - 예: 'https://exchange-proxy-worker-v2.neosiwon.workers.dev'
   * @returns {Promise<{
   *   ok: boolean,
   *   rawResponse: any,
   *   rawCandles: Array,
   *   error?: Object
   * }>}
   */
  async function fetchBithumbCandles(opts) {
    var o = opts || {};
    var ctx = {
      exchange:  'BITHUMB',
      market:    o.market    || null,
      timeframe: o.timeframe || null
    };

    if (!o.proxyBaseUrl || typeof o.proxyBaseUrl !== 'string') {
      return { ok: false, rawResponse: null, rawCandles: [],
        error: createFetchError('FETCH_CANDLES', ctx, FETCH_ERROR_CODE.INVALID_FORMAT, 'proxyBaseUrl missing') };
    }
    if (!o.market || typeof o.market !== 'string') {
      return { ok: false, rawResponse: null, rawCandles: [],
        error: createFetchError('FETCH_CANDLES', ctx, FETCH_ERROR_CODE.INVALID_FORMAT, 'market missing') };
    }
    var count = (typeof o.count === 'number' && o.count > 0) ? o.count : 100;

    var url = joinProxyPath(o.proxyBaseUrl, PATH_BITHUMB_CANDLES)
      + '?market=' + encodeURIComponent(o.market)
      + '&count='  + encodeURIComponent(count);

    var res = await fetchWithTimeout(url, FETCH_TIMEOUT_MS);
    if (!res.ok) {
      return { ok: false, rawResponse: null, rawCandles: [],
        error: createFetchError('FETCH_CANDLES', ctx, res.code, res.message) };
    }

    var resp = res.response;
    if (!resp || typeof resp.status !== 'number') {
      return { ok: false, rawResponse: null, rawCandles: [],
        error: createFetchError('FETCH_CANDLES', ctx, FETCH_ERROR_CODE.NETWORK_ERROR, 'No response object') };
    }
    if (resp.status < 200 || resp.status >= 300) {
      return { ok: false, rawResponse: null, rawCandles: [],
        error: createFetchError('FETCH_CANDLES', ctx, FETCH_ERROR_CODE.HTTP_ERROR, 'HTTP ' + resp.status) };
    }

    var json;
    try {
      json = await resp.json();
    } catch (err) {
      return { ok: false, rawResponse: null, rawCandles: [],
        error: createFetchError('FETCH_CANDLES', ctx, FETCH_ERROR_CODE.PARSE_ERROR, (err && err.message) || 'JSON parse failed') };
    }

    if (!json || typeof json !== 'object') {
      return { ok: false, rawResponse: json, rawCandles: [],
        error: createFetchError('FETCH_CANDLES', ctx, FETCH_ERROR_CODE.INVALID_FORMAT, 'Response is not an object') };
    }

    var rawCandles = json.candles;
    if (!Array.isArray(rawCandles)) {
      return { ok: false, rawResponse: json, rawCandles: [],
        error: createFetchError('FETCH_CANDLES', ctx, FETCH_ERROR_CODE.INVALID_FORMAT, 'Response.candles is not an array') };
    }
    if (rawCandles.length === 0) {
      return { ok: false, rawResponse: json, rawCandles: [],
        error: createFetchError('FETCH_CANDLES', ctx, FETCH_ERROR_CODE.EMPTY_RESPONSE, 'Response.candles is empty') };
    }

    return { ok: true, rawResponse: json, rawCandles: rawCandles };
  }


  // ════════════════════════════════════════════════════════════════════
  // [Section 05] FETCH MARKETS — UNSUPPORTED placeholder
  // ════════════════════════════════════════════════════════════════════
  /**
   * 빗썸 KRW 마켓 목록 fetch — v0.2.0-a 미지원 placeholder.
   *
   * proxy `/bithumb/markets` endpoint가 현재 미지원으로 확인됨 (Q.A 결과).
   * 정상 구현 보류 / 본 함수는 항상 ok:false + UNSUPPORTED 반환.
   *
   * 마켓 목록 / 상위 30 선별은 후속 단계에서 결정.
   *
   * @param {Object} opts
   * @param {string} opts.proxyBaseUrl
   * @returns {Promise<{ok: false, rawResponse: null, markets: [], error: Object}>}
   */
  async function fetchBithumbMarkets(opts) {
    var ctx = { exchange: 'BITHUMB', market: null, timeframe: null };
    return {
      ok: false,
      rawResponse: null,
      markets: [],
      error: createFetchError(
        'FETCH_MARKETS',
        ctx,
        FETCH_ERROR_CODE.UNSUPPORTED,
        'proxy /bithumb/markets endpoint is not available (Q.A 2026-05-13)'
      )
    };
  }


  // ════════════════════════════════════════════════════════════════════
  // [Section 06] EXPORT — IIFE + Object.freeze
  // ════════════════════════════════════════════════════════════════════
  global.WS3_BithumbClient = Object.freeze({
    fetchBithumbCandles: fetchBithumbCandles,
    fetchBithumbMarkets: fetchBithumbMarkets,
    createFetchError:    createFetchError,
    FETCH_ERROR_CODE:    FETCH_ERROR_CODE,
    FETCH_TIMEOUT_MS:    FETCH_TIMEOUT_MS
  });

})(typeof window !== 'undefined' ? window : globalThis);
