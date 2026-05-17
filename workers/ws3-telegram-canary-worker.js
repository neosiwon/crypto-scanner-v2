/**
 * WS3 v0.22.0 — Canary Web MVP Worker
 *
 * 별도 Cloudflare Worker. 기존 worker.js 본선을 수정하지 않는다.
 *
 * Route:
 *   GET     /health
 *   POST    /send-canary
 *   OPTIONS /health, /send-canary (CORS preflight)
 *
 * 정책:
 *   - 실제 Telegram API 호출은 v0.21 telegramCanarySender.dispatchCanary 가 deps.fetchImpl 로만 호출.
 *   - process.env / globalThis.env / Date.now 직접 사용은 production fetch handler 안에서만 (Cloudflare 표준 패턴).
 *     테스트 시 deps 인자로 mock 주입 가능.
 *   - Origin allowlist (env.WS3_CANARY_ALLOWED_ORIGINS, comma-separated) + invoke token (env.WS3_CANARY_INVOKE_TOKEN)
 *     + manualTrigger=true 조건 모두 만족 시에만 dispatchCanary 호출.
 *   - per-process state (CANARY_PROCESS_STATE) 는 Cloudflare isolate cold start 시 초기화 가능 (best effort).
 *
 * r0.2-final 보강 (특별관리):
 *   invoke token mismatch 5회 차단도 per-process state 기반 best effort 다. Cloudflare Worker isolate 가
 *   새로 뜨면 counter 가 초기화될 수 있다. v0.22 에서는 brute force 완전 차단이 아니라 Origin allowlist +
 *   high entropy invoke token + manualTrigger + 24h authorized_at expire + UI throttle 에 의존한다.
 *   production-grade persistent 차단은 v0.23+ KV / DO / D1 또는 Cloudflare Rate Limiting API 에서 재논의.
 *
 * export:
 *   module.exports = { handleFetch, default: { fetch: handleFetch }, ... }
 *   Cloudflare workers ES module 변환은 v0.22 단계에서 진행하지 않음 (bundler 단계 분리).
 *
 * 실제 Telegram canary 1회 발송: 사용자 별도 승인 후 별도 단계에서 진행.
 */
'use strict';

var RuntimeStateAdapter = require('../v3/v3-secure-runtime-state-adapter.js');
var TelegramCanarySender = require('../v3/v3-telegram-canary-sender.js');

// §constants ───────────────────────────────────────────────────────────
var VERSION = 'WS3_v0.22.0_canary_web_mvp';
var SERVICE = 'WS3_CANARY_WEB_MVP';
var STATUS_READY_CODE = 'CANARY_READY';
var MAX_BODY_BYTES = 1024;
var INVOKE_TOKEN_MISMATCH_THRESHOLD = 5;
var INVOKE_TOKEN_MISMATCH_BLOCK_MS = 24 * 60 * 60 * 1000;
var CANARY_MESSAGE_TYPE = 'CANARY_TEST_ONLY';

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

// §main entry ──────────────────────────────────────────────────────────

async function handleFetch(request, env, ctx, deps) {
  // deps (optional) — production worker does not receive deps; smoke tests inject.
  var resolvedDeps = isPlainObject(deps) ? deps : {};
  var fetchImpl = (typeof resolvedDeps.fetchImpl === 'function')
    ? resolvedDeps.fetchImpl
    : ((typeof fetch === 'function') ? fetch : null);
  var AbortControllerImpl = (typeof resolvedDeps.AbortControllerImpl === 'function')
    ? resolvedDeps.AbortControllerImpl
    : ((typeof AbortController === 'function') ? AbortController : null);
  var setTimeoutImpl = (typeof resolvedDeps.setTimeoutImpl === 'function')
    ? resolvedDeps.setTimeoutImpl
    : ((typeof setTimeout === 'function') ? setTimeout : null);
  var clearTimeoutImpl = (typeof resolvedDeps.clearTimeoutImpl === 'function')
    ? resolvedDeps.clearTimeoutImpl
    : ((typeof clearTimeout === 'function') ? clearTimeout : null);
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
    if (path !== '/health' && path !== '/send-canary') {
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

  // POST /send-canary
  if (path === '/send-canary' && method === 'POST') {
    if (!origin) {
      return jsonResponse({ ok: false, status: 'BLOCKED', code: 'ORIGIN_MISSING', httpStatus: 403 }, 403, false, null);
    }
    if (!allowed) {
      return jsonResponse({ ok: false, status: 'BLOCKED', code: 'ORIGIN_NOT_ALLOWED', httpStatus: 403 }, 403, false, null);
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

    // Worker-level invoke token mismatch throttle (best effort per-process — see r0.2-final note above)
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

    // deps must be resolvable
    if (fetchImpl === null || AbortControllerImpl === null || setTimeoutImpl === null || clearTimeoutImpl === null) {
      return jsonResponse({ ok: false, status: 'ERROR', code: 'UNKNOWN_ERROR', httpStatus: 500 }, 500, true, origin);
    }

    // Build v0.20 → v0.21 chain
    var preflight = buildMinimalPreflightGate();
    var v20Result = RuntimeStateAdapter.build({ liveExecutionPreflightGate: preflight });

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

    var canaryDeps = {
      fetchImpl: fetchImpl,
      AbortControllerImpl: AbortControllerImpl,
      setTimeoutImpl: setTimeoutImpl,
      clearTimeoutImpl: clearTimeoutImpl,
      nowMs: nowMs,
      state: state
    };

    var result;
    try {
      result = await TelegramCanarySender.dispatchCanary(canaryInput, canaryDeps);
    } catch (e) {
      return jsonResponse({ ok: false, status: 'ERROR', code: 'UNKNOWN_ERROR', httpStatus: 500 }, 500, true, origin);
    }

    if (isPlainObject(result) && result.ok === true) {
      // success — reset invoke token mismatch counter
      state.invokeTokenMismatchCount = 0;
      state.invokeTokenMismatchBlockedUntil = 0;
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

    // Invoke token mismatch counter
    if (mapped.code === 'INVOKE_TOKEN_MISMATCH') {
      state.invokeTokenMismatchCount = (state.invokeTokenMismatchCount || 0) + 1;
      if (state.invokeTokenMismatchCount >= INVOKE_TOKEN_MISMATCH_THRESHOLD) {
        state.invokeTokenMismatchBlockedUntil = nowMs + INVOKE_TOKEN_MISMATCH_BLOCK_MS;
      }
    }

    var outerStatus = (mapped.httpStatus > 0) ? mapped.httpStatus : 502;
    return jsonResponse({
      ok: false,
      status: mapped.status,
      code: mapped.code,
      httpStatus: mapped.httpStatus
    }, outerStatus, true, origin);
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
  CANARY_MESSAGE_TYPE: CANARY_MESSAGE_TYPE,
  mapErrorCodeToWeb: mapErrorCodeToWeb,
  isAllowedOrigin: isAllowedOrigin,
  buildMinimalPreflightGate: buildMinimalPreflightGate,
  default: {
    fetch: function(request, env, ctx) { return handleFetch(request, env, ctx); }
  }
};
