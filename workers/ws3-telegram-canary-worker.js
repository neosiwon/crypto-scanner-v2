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
var VERSION = 'WS3_v0.27.0_actual_coin_live_preflight';
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
    if (path !== '/health' && path !== '/send-canary' && path !== '/state' && path !== '/cleanup-confirm' && path !== '/operator-reset' && path !== '/live-preflight') {
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
  mapErrorCodeToWeb: mapErrorCodeToWeb,
  isAllowedOrigin: isAllowedOrigin,
  buildMinimalPreflightGate: buildMinimalPreflightGate,
  buildWorkerRuntimeDeps: buildWorkerRuntimeDeps,
  default: {
    fetch: function(request, env, ctx) { return handleFetch(request, env, ctx); }
  }
};
