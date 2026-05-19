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
var VERSION = 'WS3_v0.31.0_web_first_minimum_operator_mode';
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
async function runMultiCandidatePipeline(deps, req) {
  var exchange = req.exchange;
  var timeframe = req.timeframe;
  var limit = req.limit;
  var markets = req.markets;

  // Parallel fetch + normalize + features + score for each market.
  var promises = [];
  for (var i = 0; i < markets.length; i++) {
    (function(market, rank) {
      var url = buildLivePreflightUrl(exchange, market, timeframe, limit);
      if (url === null) {
        promises.push(Promise.resolve({
          ok: false,
          market: market,
          code: 'CANDIDATE_DRY_RUN_UNSUPPORTED_SOURCE'
        }));
        return;
      }
      var p = fetchLiveCandles(deps, url, LIVE_PREFLIGHT_FETCH_TIMEOUT_MS).then(function(fetchRes) {
        if (fetchRes.ok !== true) {
          return { ok: false, market: market, code: mapFetchCodeToCandidateDryRunCode(fetchRes.code) };
        }
        var norm = normalizeCandles(exchange, fetchRes.raw, limit);
        if (norm.ok !== true) {
          return { ok: false, market: market, code: mapFetchCodeToCandidateDryRunCode(norm.code) };
        }
        try {
          var sf = calculateCandleStructureFeatures(norm.candles);
          var vf = calculateVolumeFeatures(norm.candles);
          var mf = calculateMomentumFeatures(norm.candles);
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
          var allFinite = isFinite(sf.changePct) && isFinite(sf.bodyPct) && isFinite(sf.rangePct)
            && isFinite(sf.upperWickPct) && isFinite(sf.lowerWickPct) && isFinite(sf.closePosition)
            && isFinite(vf.volumeRatio) && isFinite(vf.volumeAccel)
            && isFinite(mf.shortMomentumPct) && isFinite(mf.midMomentumPct)
            && isFinite(scoreResult.score);
          if (!allFinite) {
            return { ok: false, market: market, code: 'CANDIDATE_DRY_RUN_FEATURE_ERROR' };
          }
          var grade = classifyCandidateDryRunGrade(scoreResult.score);
          var review = classifyOperatorReview(scoreResult.score, grade, scoreResult.reasonChips, {
            volumeRatio: vf.volumeRatio,
            closePosition: sf.closePosition,
            changePct: sf.changePct
          });
          return {
            ok: true,
            market: market,
            score: scoreResult.score,
            grade: grade,
            reasonChips: scoreResult.reasonChips,
            isCandidate: (grade === 'P-S' || grade === 'P-A'),
            operatorReview: review.operatorReview,
            operatorReviewLevel: review.operatorReviewLevel,
            operatorReviewReason: review.operatorReviewReason,
            changePct: sf.changePct,
            volumeRatio: vf.volumeRatio,
            volumeAccel: vf.volumeAccel,
            closePosition: sf.closePosition,
            upperWickPct: sf.upperWickPct,
            rangePct: sf.rangePct,
            candleCount: sf.candleCount,
            latestTime: sf.latestTime,
            lastClose: sf.lastClose
          };
        } catch (e) {
          return { ok: false, market: market, code: 'CANDIDATE_DRY_RUN_FEATURE_ERROR' };
        }
      }).catch(function() {
        return { ok: false, market: market, code: 'CANDIDATE_DRY_RUN_NETWORK_ERROR' };
      });
      promises.push(p);
    })(markets[i], i);
  }

  var raw = await Promise.all(promises);

  // Sort: successful results by score desc, then volumeRatio desc; failures last.
  var ok = [];
  var failed = [];
  for (var j = 0; j < raw.length; j++) {
    if (raw[j].ok === true) ok.push(raw[j]);
    else failed.push(raw[j]);
  }
  // v0.31: sort by operatorReviewLevel priority first, then score desc, then volumeRatio desc, then closePosition desc.
  ok.sort(function(a, b) {
    var pa = operatorReviewLevelPriority(a.operatorReviewLevel);
    var pb = operatorReviewLevelPriority(b.operatorReviewLevel);
    if (pa !== pb) return pa - pb;
    if (b.score !== a.score) return b.score - a.score;
    var va = (typeof a.volumeRatio === 'number') ? a.volumeRatio : 0;
    var vb = (typeof b.volumeRatio === 'number') ? b.volumeRatio : 0;
    if (vb !== va) return vb - va;
    var cpa = (typeof a.closePosition === 'number') ? a.closePosition : 0;
    var cpb = (typeof b.closePosition === 'number') ? b.closePosition : 0;
    return cpb - cpa;
  });

  var allResults = [];
  for (var k = 0; k < ok.length; k++) {
    allResults.push({
      rank: k + 1,
      market: ok[k].market,
      score: ok[k].score,
      grade: ok[k].grade,
      isCandidate: ok[k].isCandidate,
      operatorReview: ok[k].operatorReview,
      operatorReviewLevel: ok[k].operatorReviewLevel,
      operatorReviewReason: ok[k].operatorReviewReason,
      reasonChips: ok[k].reasonChips,
      changePct: ok[k].changePct,
      volumeRatio: ok[k].volumeRatio,
      volumeAccel: ok[k].volumeAccel,
      closePosition: ok[k].closePosition,
      upperWickPct: ok[k].upperWickPct,
      rangePct: ok[k].rangePct,
      candleCount: ok[k].candleCount,
      latestTime: ok[k].latestTime,
      lastClose: ok[k].lastClose,
      ok: true
    });
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
  var orCounts = countOperatorReviewByLevel(pipelineResult.results);
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
    operatorReviewCounts: orCounts,
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
