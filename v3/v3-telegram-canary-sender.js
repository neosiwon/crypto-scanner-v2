/**
 * WS3 v0.21.0 — TelegramCanarySender (Telegram Canary Fast Track Pack Part 2)
 *
 * Scope:
 *   secureRuntimeStateAdapter (v0.20.0) + (read-only chain) liveExecutionPreflightGate (v0.19.0) +
 *   secureBindingGatewayContract (v0.18.0) + ... → Telegram 1 target 한정 첫 LIVE side-effect 모듈
 *
 * 단일 기준 문서:
 *   docs/ws3/WS3_CODE_CONTRACT.md (b-r2 박제본)
 *
 * 확정 DP 정책 (DP-CANARY, Gate 2 spec):
 *   DP-CANARY1   v0.20 secureRuntimeStateAdapter 결과 20 hard precondition AND.
 *                v0.20 결과 mutate / spread / clone / Object.assign 금지.
 *   DP-CANARY2   fetch 4-Gate explicit trigger (env enabled + 24h authorized + invoke token +
 *                manualTrigger). env flag 단독 trigger 금지. cron / 코드배포 자동 발송 금지.
 *   DP-CANARY3   hard timeout 5초 + AbortController. retry=0. timeout 시 CANARY_TIMEOUT.
 *   DP-CANARY4   per-process rate limit 1회 / 60초. CANARY_RATE_LIMITED.
 *   DP-CANARY5   circuit breaker 연속 3실패 시 24시간 차단. CANARY_CIRCUIT_OPEN.
 *   DP-CANARY6   CANARY_FIXED_MESSAGE 5줄 byte-for-byte exact. 변형 금지.
 *   DP-CANARY7   safe response whitelist 6 fields (ok / httpStatus / messageId / sentAt /
 *                messageType / fixedMessageUsed) 만.
 *   DP-CANARY8   safe error whitelist 4 fields + 7 errorCode enum.
 *   DP-CANARY9   safe diagnostics 6 fields. tokenValueExposed / chatIdValueExposed /
 *                rawTelegramResponseExposed === false 강제.
 *   DP-CANARY10  raw Telegram response / description / from.* / chat.* / bot_token /
 *                headers / Set-Cookie / X-* / Server / Date 차단.
 *   DP-CANARY11  token / chatId 코드 / 문서 / 로그 출력 0건. masked / first-4 / last-4 금지.
 *   DP-CANARY12  worker.js / index.html / manifest.json / service-worker.js / wrangler.toml
 *                / workers / .github 신규 파일 생성 0건. endpoint / inbound / canary worker 0건.
 *
 * 계층 분리:
 *   buildTelegramCanaryPlan / validate* / build*Result / build*Error:
 *     sync only. fetch 없음. async / await / Promise / timer / side-effect 없음.
 *   dispatchCanary:
 *     async 허용. fetch via deps.fetchImpl 만. AbortController via deps.AbortControllerImpl.
 *     setTimeout / clearTimeout via deps.setTimeoutImpl / deps.clearTimeoutImpl.
 *     nowMs / nowFn via deps.nowMs / deps.nowFn. global fetch / Date.now / process.env 직접 금지.
 *
 * 시간 source: deps.nowMs (number) 또는 deps.nowFn() (returns number). 미주입 시
 *              CANARY_BLOCKED:MISSING_TIME_SOURCE.
 *
 * runtime env (input.runtimeEnv) 허용 키 5종:
 *   WS3_TELEGRAM_BOT_TOKEN / WS3_TELEGRAM_CHAT_ID / WS3_TELEGRAM_CANARY_ENABLED /
 *   WS3_TELEGRAM_CANARY_AUTHORIZED_AT / WS3_CANARY_INVOKE_TOKEN
 *
 * headers (input.headers) 허용 키 1종:
 *   X-WS3-Canary-Token
 *
 * v0.22+ 분리 사항:
 *   manual canary endpoint / Telegram inbound /canary-test / GitHub Actions workflow_dispatch /
 *   별도 canary worker — 모두 v0.22+ 별도 단계.
 *
 * export:
 *   global.WS3_TelegramCanarySender + module.exports
 */
(function(global) {
  'use strict';

  // §version
  var CANARY_VERSION = 'WS3_v0.21.0_telegram_canary_sender';

  // §fixed message — byte-for-byte exact, 5 lines
  var CANARY_FIXED_MESSAGE =
    '[WOOS WS3 CANARY]\n' +
    'Telegram route connected.\n' +
    'mode: CANARY_ONLY\n' +
    'live signal: disabled\n' +
    'snapshot/evaluation/audit: disabled';

  // §canary safety constants (hardcoded — env/config override 금지)
  var CANARY_HARD_TIMEOUT_MS = 5000;
  var CANARY_RATE_LIMIT_MS = 60 * 1000;
  var CANARY_CIRCUIT_FAIL_THRESHOLD = 3;
  var CANARY_CIRCUIT_OPEN_MS = 24 * 60 * 60 * 1000;
  var CANARY_AUTH_EXPIRE_MS = 24 * 60 * 60 * 1000;
  var CANARY_RETRY_COUNT = 0;

  // §message type / mode constants
  var CANARY_MESSAGE_TYPE = 'CANARY_TEST_ONLY';
  var CANARY_TARGET = 'TELEGRAM';

  // §allowed runtimeEnv keys (5)
  var ALLOWED_RUNTIME_ENV_KEYS = Object.freeze([
    'WS3_TELEGRAM_BOT_TOKEN',
    'WS3_TELEGRAM_CHAT_ID',
    'WS3_TELEGRAM_CANARY_ENABLED',
    'WS3_TELEGRAM_CANARY_AUTHORIZED_AT',
    'WS3_CANARY_INVOKE_TOKEN'
  ]);

  // §allowed header keys (1)
  var ALLOWED_HEADER_KEYS = Object.freeze([
    'X-WS3-Canary-Token'
  ]);

  // §error codes (enum)
  var ERROR_CODES = Object.freeze({
    BLOCKED: 'CANARY_BLOCKED',
    TIMEOUT: 'CANARY_TIMEOUT',
    RATE_LIMITED: 'CANARY_RATE_LIMITED',
    CIRCUIT_OPEN: 'CANARY_CIRCUIT_OPEN',
    AUTH_ERROR: 'CANARY_AUTH_ERROR',
    NOT_FOUND: 'CANARY_NOT_FOUND',
    NETWORK_ERROR: 'CANARY_NETWORK_ERROR'
  });

  // §forbidden response fields (DP-CANARY10)
  var FORBIDDEN_RESPONSE_FIELDS = Object.freeze([
    'description', 'from', 'chat', 'bot_token',
    'photo', 'document', 'audio', 'video', 'voice',
    'sticker', 'animation', 'video_note', 'caption',
    'reply_markup', 'reply_to_message', 'pinned_message',
    'entities', 'forward_from', 'forward_date'
  ]);

  // §default config (per-process constants — env/config override 금지)
  var DEFAULT_TELEGRAM_CANARY_SENDER_CONFIG = Object.freeze({
    version: 'inline-default-v0',
    canaryHardTimeoutMs: CANARY_HARD_TIMEOUT_MS,
    canaryRateLimitMs: CANARY_RATE_LIMIT_MS,
    canaryCircuitFailThreshold: CANARY_CIRCUIT_FAIL_THRESHOLD,
    canaryCircuitOpenMs: CANARY_CIRCUIT_OPEN_MS,
    canaryAuthExpireMs: CANARY_AUTH_EXPIRE_MS,
    canaryRetryCount: CANARY_RETRY_COUNT,
    canaryMessageType: CANARY_MESSAGE_TYPE
  });

  // §helpers (sync, no Date.now, no env, no fetch) ───────────────────────

  function isPlainObject(value) {
    if (value === null || value === undefined) return false;
    if (typeof value !== 'object') return false;
    if (Array.isArray(value)) return false;
    return true;
  }

  function safeString(value, maxLen) {
    if (value === null || value === undefined) return null;
    if (typeof value !== 'string') return null;
    var lim = (typeof maxLen === 'number' && isFinite(maxLen) && maxLen > 0) ? maxLen : 200;
    if (value.length > lim) return null;
    return value;
  }

  function safeNumber(value) {
    if (typeof value !== 'number') return null;
    if (!isFinite(value)) return null;
    return value;
  }

  function resolveNow(deps) {
    if (!deps) return null;
    if (typeof deps.nowMs === 'number' && isFinite(deps.nowMs)) return deps.nowMs;
    if (typeof deps.nowFn === 'function') {
      var v = deps.nowFn();
      if (typeof v === 'number' && isFinite(v)) return v;
    }
    return null;
  }

  function mergeTelegramCanarySenderConfig(config) {
    // Hardcoded — config override 금지 (timeout / retry / rate limit / circuit breaker).
    // 정책: spec §4.6 — env override 금지 / config override 금지.
    // 반환은 DEFAULT shallow copy 만.
    var d = DEFAULT_TELEGRAM_CANARY_SENDER_CONFIG;
    return {
      version: d.version,
      canaryHardTimeoutMs: d.canaryHardTimeoutMs,
      canaryRateLimitMs: d.canaryRateLimitMs,
      canaryCircuitFailThreshold: d.canaryCircuitFailThreshold,
      canaryCircuitOpenMs: d.canaryCircuitOpenMs,
      canaryAuthExpireMs: d.canaryAuthExpireMs,
      canaryRetryCount: d.canaryRetryCount,
      canaryMessageType: d.canaryMessageType
    };
  }

  // §safe diagnostics (no value exposure) ────────────────────────────────

  function buildSafeDiagnostics(runtimeEnv) {
    var env = isPlainObject(runtimeEnv) ? runtimeEnv : {};
    var tokenPresent = typeof env.WS3_TELEGRAM_BOT_TOKEN === 'string' && env.WS3_TELEGRAM_BOT_TOKEN.length > 0;
    var chatIdPresent = typeof env.WS3_TELEGRAM_CHAT_ID === 'string' && env.WS3_TELEGRAM_CHAT_ID.length > 0;
    var canaryEnabled = env.WS3_TELEGRAM_CANARY_ENABLED === 'true';
    return {
      tokenValueExposed: false,
      chatIdValueExposed: false,
      rawTelegramResponseExposed: false,
      tokenPresent: tokenPresent,
      chatIdPresent: chatIdPresent,
      canaryEnabled: canaryEnabled
    };
  }

  // §safe result / safe error builders ───────────────────────────────────

  function buildSafeTelegramResult(httpStatus, parsedBody, deps) {
    var nowMs = resolveNow(deps);
    var messageId = null;
    if (isPlainObject(parsedBody) && isPlainObject(parsedBody.result)) {
      var raw = parsedBody.result.message_id;
      if (typeof raw === 'number' && isFinite(raw)) messageId = raw;
    }
    return {
      ok: true,
      httpStatus: (typeof httpStatus === 'number' && isFinite(httpStatus)) ? httpStatus : 200,
      messageId: messageId,
      sentAt: (typeof nowMs === 'number') ? nowMs : null,
      messageType: CANARY_MESSAGE_TYPE,
      fixedMessageUsed: true
    };
  }

  function buildSafeTelegramError(httpStatus, errorCode, deps) {
    var nowMs = resolveNow(deps);
    return {
      ok: false,
      httpStatus: (typeof httpStatus === 'number' && isFinite(httpStatus)) ? httpStatus : 0,
      errorCode: (typeof errorCode === 'string') ? errorCode : ERROR_CODES.BLOCKED + ':UNKNOWN',
      errorAt: (typeof nowMs === 'number') ? nowMs : null
    };
  }

  // §validateFixedMessage (byte-for-byte exact) ──────────────────────────

  function validateFixedMessage(msg) {
    if (typeof msg !== 'string') return { valid: false, reason: 'NOT_STRING' };
    if (msg.length !== CANARY_FIXED_MESSAGE.length) return { valid: false, reason: 'LENGTH_MISMATCH' };
    if (msg !== CANARY_FIXED_MESSAGE) return { valid: false, reason: 'BYTE_MISMATCH' };
    return { valid: true, reason: null };
  }

  // §validateRuntimePreconditions (20 hard AND) ──────────────────────────

  function validateRuntimePreconditions(input) {
    if (!isPlainObject(input)) return { valid: false, reason: 'INPUT_NOT_PLAIN_OBJECT', blockers: ['INPUT_NOT_PLAIN_OBJECT'] };
    var v20 = isPlainObject(input.secureRuntimeStateAdapterResult) ? input.secureRuntimeStateAdapterResult : null;
    var runtimeEnv = isPlainObject(input.runtimeEnv) ? input.runtimeEnv : null;
    var messageType = input.messageType;
    var blockers = [];

    // 1
    if (v20 === null || v20.valid !== true) {
      blockers.push('V20_RESULT_INVALID');
      return { valid: false, reason: 'V20_RESULT_INVALID', blockers: blockers };
    }
    // 2
    if (v20.runtimeMode !== 'CANARY_PREP_ONLY') blockers.push('V20_RUNTIME_MODE_NOT_CANARY_PREP_ONLY');
    // 3
    if (v20.canaryOnly !== true) blockers.push('V20_CANARY_ONLY_FALSE');
    // 4
    if (v20.liveSignalEnabled !== false) blockers.push('V20_LIVE_SIGNAL_ENABLED_TRUE');
    // 5
    var elig = isPlainObject(v20.telegramRuntimeEligibility) ? v20.telegramRuntimeEligibility : null;
    if (!elig || elig.eligibleForCanary !== true) blockers.push('V20_NOT_ELIGIBLE_FOR_CANARY');
    // 6
    if (!elig || elig.eligibleForLiveSignal !== false) blockers.push('V20_ELIGIBLE_FOR_LIVE_SIGNAL_TRUE');
    // 7
    var ks = isPlainObject(v20.killSwitchRuntimeState) ? v20.killSwitchRuntimeState : null;
    if (!ks || ks.state !== 'CANARY_ALLOWED') blockers.push('V20_KILL_SWITCH_NOT_CANARY_ALLOWED');
    // 8
    var dis = isPlainObject(v20.disableRuntimeState) ? v20.disableRuntimeState : null;
    if (!dis || dis.disabled !== false) blockers.push('V20_DISABLED_TRUE');
    // 9
    var pol = isPlainObject(v20.canaryRuntimePolicy) ? v20.canaryRuntimePolicy : null;
    if (!pol || pol.canaryOnly !== true) blockers.push('V20_POLICY_CANARY_ONLY_FALSE');
    // 10
    if (!pol || pol.fixedMessageOnly !== true) blockers.push('V20_POLICY_FIXED_MESSAGE_ONLY_FALSE');
    // 11
    if (!pol || pol.candidatePayloadAllowed !== false) blockers.push('V20_POLICY_CANDIDATE_PAYLOAD_ALLOWED_TRUE');
    // 12
    if (!pol || pol.snapshotAllowed !== false) blockers.push('V20_POLICY_SNAPSHOT_ALLOWED_TRUE');
    // 13
    if (!pol || pol.evaluationAllowed !== false) blockers.push('V20_POLICY_EVALUATION_ALLOWED_TRUE');
    // 14
    if (!pol || pol.auditAllowed !== false) blockers.push('V20_POLICY_AUDIT_ALLOWED_TRUE');
    // 15
    if (!pol || pol.kvWriteAllowed !== false) blockers.push('V20_POLICY_KV_WRITE_ALLOWED_TRUE');
    // 16
    if (!pol || pol.dbWriteAllowed !== false) blockers.push('V20_POLICY_DB_WRITE_ALLOWED_TRUE');
    // 17
    if (!runtimeEnv || runtimeEnv.WS3_TELEGRAM_CANARY_ENABLED !== 'true') blockers.push('CANARY_NOT_ENABLED');
    // 18
    if (!runtimeEnv || typeof runtimeEnv.WS3_TELEGRAM_BOT_TOKEN !== 'string' || runtimeEnv.WS3_TELEGRAM_BOT_TOKEN.length === 0) blockers.push('BOT_TOKEN_MISSING');
    // 19
    if (!runtimeEnv || typeof runtimeEnv.WS3_TELEGRAM_CHAT_ID !== 'string' || runtimeEnv.WS3_TELEGRAM_CHAT_ID.length === 0) blockers.push('CHAT_ID_MISSING');
    // 20
    if (messageType !== CANARY_MESSAGE_TYPE) blockers.push('MESSAGE_TYPE_NOT_CANARY_TEST_ONLY');

    if (blockers.length > 0) return { valid: false, reason: blockers[0], blockers: blockers };
    return { valid: true, reason: null, blockers: [] };
  }

  // §validateExplicitGate (4 gates — Gate 2 requires nowMs) ──────────────

  function validateExplicitGate(input, deps) {
    if (!isPlainObject(input)) return { valid: false, reason: 'INPUT_NOT_PLAIN_OBJECT', gate: 0 };
    var runtimeEnv = isPlainObject(input.runtimeEnv) ? input.runtimeEnv : null;
    var headers = isPlainObject(input.headers) ? input.headers : null;
    var manualTrigger = input.manualTrigger;

    // Gate 1 — env enabled
    if (!runtimeEnv || runtimeEnv.WS3_TELEGRAM_CANARY_ENABLED !== 'true') {
      return { valid: false, reason: 'GATE1_CANARY_NOT_ENABLED', gate: 1 };
    }

    // Gate 2 — env authorized_at + 24h expire (deps.nowMs required)
    var nowMs = resolveNow(deps);
    if (nowMs === null) return { valid: false, reason: 'MISSING_TIME_SOURCE', gate: 2 };
    if (!runtimeEnv.WS3_TELEGRAM_CANARY_AUTHORIZED_AT) {
      return { valid: false, reason: 'GATE2_AUTHORIZED_AT_MISSING', gate: 2 };
    }
    var authorizedAt = parseInt(runtimeEnv.WS3_TELEGRAM_CANARY_AUTHORIZED_AT, 10);
    if (!isFinite(authorizedAt) || authorizedAt <= 0) {
      return { valid: false, reason: 'GATE2_AUTHORIZED_AT_INVALID', gate: 2 };
    }
    if ((nowMs - authorizedAt) > CANARY_AUTH_EXPIRE_MS) {
      return { valid: false, reason: 'GATE2_AUTHORIZED_AT_EXPIRED', gate: 2 };
    }

    // Gate 3 — header invoke token exact match
    if (!headers || typeof headers['X-WS3-Canary-Token'] !== 'string') {
      return { valid: false, reason: 'GATE3_INVOKE_TOKEN_MISSING', gate: 3 };
    }
    if (typeof runtimeEnv.WS3_CANARY_INVOKE_TOKEN !== 'string' || runtimeEnv.WS3_CANARY_INVOKE_TOKEN.length === 0) {
      return { valid: false, reason: 'GATE3_INVOKE_TOKEN_ENV_MISSING', gate: 3 };
    }
    if (headers['X-WS3-Canary-Token'] !== runtimeEnv.WS3_CANARY_INVOKE_TOKEN) {
      return { valid: false, reason: 'GATE3_INVOKE_TOKEN_MISMATCH', gate: 3 };
    }

    // Gate 4 — manualTrigger === true
    if (manualTrigger !== true) {
      return { valid: false, reason: 'GATE4_MANUAL_TRIGGER_MISSING', gate: 4 };
    }

    return { valid: true, reason: null, gate: 4 };
  }

  // §buildTelegramCanaryPlan (sync, no fetch) ────────────────────────────

  function buildTelegramCanaryPlan(input, deps) {
    var cfg = mergeTelegramCanarySenderConfig(null);
    var pre = validateRuntimePreconditions(input);
    var fixedMessage = validateFixedMessage(CANARY_FIXED_MESSAGE);
    var gate = (pre.valid === true) ? validateExplicitGate(input, deps) : { valid: false, reason: 'PRECONDITION_FAILED', gate: 0 };
    var runtimeEnv = (isPlainObject(input) && isPlainObject(input.runtimeEnv)) ? input.runtimeEnv : null;
    var diag = buildSafeDiagnostics(runtimeEnv);

    var valid = (pre.valid === true) && (gate.valid === true) && (fixedMessage.valid === true);
    var errorCode = null;
    if (!valid) {
      if (pre.valid !== true) errorCode = ERROR_CODES.BLOCKED + ':' + pre.reason;
      else if (gate.valid !== true) errorCode = ERROR_CODES.BLOCKED + ':' + gate.reason;
      else errorCode = ERROR_CODES.BLOCKED + ':NOT_FIXED_MESSAGE';
    }

    return {
      valid: valid,
      version: CANARY_VERSION,
      precondition: { valid: pre.valid, reason: pre.reason, blockers: pre.blockers || [] },
      gate: { valid: gate.valid, reason: gate.reason, gate: (typeof gate.gate === 'number') ? gate.gate : 0 },
      fixedMessage: { valid: fixedMessage.valid, reason: fixedMessage.reason },
      target: CANARY_TARGET,
      messageType: CANARY_MESSAGE_TYPE,
      fixedMessageBytesLen: CANARY_FIXED_MESSAGE.length,
      errorCode: errorCode,
      safeDiagnostics: diag,
      configUsed: {
        version: cfg.version,
        canaryHardTimeoutMs: cfg.canaryHardTimeoutMs,
        canaryRateLimitMs: cfg.canaryRateLimitMs,
        canaryCircuitFailThreshold: cfg.canaryCircuitFailThreshold,
        canaryCircuitOpenMs: cfg.canaryCircuitOpenMs,
        canaryAuthExpireMs: cfg.canaryAuthExpireMs,
        canaryRetryCount: cfg.canaryRetryCount,
        canaryMessageType: cfg.canaryMessageType
      }
    };
  }

  // §rate limit / circuit breaker (per-process — state injected via deps) ─

  function getOrInitState(deps) {
    if (!deps || !isPlainObject(deps.state)) return null;
    var s = deps.state;
    if (typeof s.lastSentAt !== 'number') s.lastSentAt = 0;
    if (typeof s.consecutiveFailures !== 'number') s.consecutiveFailures = 0;
    if (typeof s.circuitOpenUntil !== 'number') s.circuitOpenUntil = 0;
    if (typeof s.alreadySent !== 'boolean') s.alreadySent = false;
    return s;
  }

  function checkRateLimit(state, nowMs) {
    if (!state) return { ok: true };
    if (state.lastSentAt <= 0) return { ok: true };
    if ((nowMs - state.lastSentAt) < CANARY_RATE_LIMIT_MS) return { ok: false };
    return { ok: true };
  }

  function checkCircuitBreaker(state, nowMs) {
    if (!state) return { ok: true };
    if (state.circuitOpenUntil > 0 && nowMs < state.circuitOpenUntil) return { ok: false };
    return { ok: true };
  }

  function recordSuccess(state, nowMs) {
    if (!state) return;
    state.lastSentAt = nowMs;
    state.consecutiveFailures = 0;
    state.circuitOpenUntil = 0;
    state.alreadySent = true;
  }

  function recordFailure(state, nowMs) {
    if (!state) return;
    state.consecutiveFailures = (state.consecutiveFailures || 0) + 1;
    if (state.consecutiveFailures >= CANARY_CIRCUIT_FAIL_THRESHOLD) {
      state.circuitOpenUntil = nowMs + CANARY_CIRCUIT_OPEN_MS;
    }
  }

  // §safe whitelist body extraction (no spread, no Object.assign) ────────

  function extractSafeBody(rawBody) {
    // Returns { result: { message_id: number|null } } 형태만 — 나머지 차단.
    // forbidden field 0건 보장.
    if (!isPlainObject(rawBody)) return { result: { message_id: null } };
    var result = isPlainObject(rawBody.result) ? rawBody.result : null;
    var messageId = null;
    if (result && typeof result.message_id === 'number' && isFinite(result.message_id)) {
      messageId = result.message_id;
    }
    return { result: { message_id: messageId } };
  }

  // §dispatchCanary (async — only place fetch is allowed) ────────────────

  async function dispatchCanary(input, deps) {
    // STEP A — input shape
    if (!isPlainObject(input)) {
      return buildSafeTelegramError(0, ERROR_CODES.BLOCKED + ':INPUT_NOT_PLAIN_OBJECT', deps);
    }
    if (!isPlainObject(deps)) {
      return buildSafeTelegramError(0, ERROR_CODES.BLOCKED + ':DEPS_NOT_PLAIN_OBJECT', null);
    }

    // STEP B — time source required
    var nowMs = resolveNow(deps);
    if (nowMs === null) {
      return buildSafeTelegramError(0, ERROR_CODES.BLOCKED + ':MISSING_TIME_SOURCE', deps);
    }

    // STEP C — fetch / AbortController / setTimeout deps required
    if (typeof deps.fetchImpl !== 'function') {
      return buildSafeTelegramError(0, ERROR_CODES.BLOCKED + ':MISSING_FETCH_IMPL', deps);
    }
    if (typeof deps.AbortControllerImpl !== 'function') {
      return buildSafeTelegramError(0, ERROR_CODES.BLOCKED + ':MISSING_ABORT_CONTROLLER_IMPL', deps);
    }
    if (typeof deps.setTimeoutImpl !== 'function') {
      return buildSafeTelegramError(0, ERROR_CODES.BLOCKED + ':MISSING_SET_TIMEOUT_IMPL', deps);
    }
    if (typeof deps.clearTimeoutImpl !== 'function') {
      return buildSafeTelegramError(0, ERROR_CODES.BLOCKED + ':MISSING_CLEAR_TIMEOUT_IMPL', deps);
    }

    // STEP D — 20 hard precondition
    var pre = validateRuntimePreconditions(input);
    if (pre.valid !== true) {
      return buildSafeTelegramError(0, ERROR_CODES.BLOCKED + ':' + pre.reason, deps);
    }

    // STEP E — 4 explicit gate
    var gate = validateExplicitGate(input, deps);
    if (gate.valid !== true) {
      return buildSafeTelegramError(0, ERROR_CODES.BLOCKED + ':' + gate.reason, deps);
    }

    // STEP F — fixed message exact
    var fm = validateFixedMessage(CANARY_FIXED_MESSAGE);
    if (fm.valid !== true) {
      return buildSafeTelegramError(0, ERROR_CODES.BLOCKED + ':NOT_FIXED_MESSAGE', deps);
    }

    // STEP G — state: rate limit / circuit breaker / already sent
    var state = getOrInitState(deps);
    if (state && state.alreadySent === true) {
      return buildSafeTelegramError(0, ERROR_CODES.BLOCKED + ':ALREADY_SENT', deps);
    }
    var rl = checkRateLimit(state, nowMs);
    if (rl.ok !== true) return buildSafeTelegramError(0, ERROR_CODES.RATE_LIMITED, deps);
    var cb = checkCircuitBreaker(state, nowMs);
    if (cb.ok !== true) return buildSafeTelegramError(0, ERROR_CODES.CIRCUIT_OPEN, deps);

    // STEP H — fetch with hard 5s timeout via AbortController
    var runtimeEnv = input.runtimeEnv;
    var token = runtimeEnv.WS3_TELEGRAM_BOT_TOKEN;
    var chatId = runtimeEnv.WS3_TELEGRAM_CHAT_ID;
    var url = 'https://api.telegram.org/bot' + token + '/sendMessage';
    var bodyJson;
    try {
      bodyJson = JSON.stringify({
        chat_id: chatId,
        text: CANARY_FIXED_MESSAGE,
        disable_web_page_preview: true,
        disable_notification: false
      });
    } catch (e) {
      return buildSafeTelegramError(0, ERROR_CODES.BLOCKED + ':PAYLOAD_STRINGIFY_FAILED', deps);
    }

    var controller = new deps.AbortControllerImpl();
    var timedOut = false;
    var timerHandle = deps.setTimeoutImpl(function() {
      timedOut = true;
      if (controller && typeof controller.abort === 'function') controller.abort();
    }, CANARY_HARD_TIMEOUT_MS);

    var resp = null;
    var fetchErr = null;
    try {
      resp = await deps.fetchImpl(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: bodyJson,
        signal: controller.signal
      });
    } catch (err) {
      fetchErr = err;
    }
    deps.clearTimeoutImpl(timerHandle);

    if (fetchErr !== null) {
      var errName = (fetchErr && typeof fetchErr.name === 'string') ? fetchErr.name : '';
      if (timedOut === true || errName === 'AbortError') {
        recordFailure(state, nowMs);
        return buildSafeTelegramError(0, ERROR_CODES.TIMEOUT, deps);
      }
      recordFailure(state, nowMs);
      return buildSafeTelegramError(0, ERROR_CODES.NETWORK_ERROR, deps);
    }

    var httpStatus = (resp && typeof resp.status === 'number') ? resp.status : 0;

    var parsedBody = null;
    if (resp && typeof resp.json === 'function') {
      try {
        parsedBody = await resp.json();
      } catch (parseErr) {
        recordFailure(state, nowMs);
        return buildSafeTelegramError(httpStatus, ERROR_CODES.NETWORK_ERROR, deps);
      }
    }

    if (httpStatus === 401 || httpStatus === 403) {
      recordFailure(state, nowMs);
      return buildSafeTelegramError(httpStatus, ERROR_CODES.AUTH_ERROR, deps);
    }
    if (httpStatus === 404) {
      recordFailure(state, nowMs);
      return buildSafeTelegramError(httpStatus, ERROR_CODES.NOT_FOUND, deps);
    }
    if (httpStatus < 200 || httpStatus >= 300) {
      recordFailure(state, nowMs);
      return buildSafeTelegramError(httpStatus, ERROR_CODES.NETWORK_ERROR, deps);
    }

    // STEP I — extract safe body whitelist only (no spread, no Object.assign)
    var safeBody = extractSafeBody(parsedBody);
    recordSuccess(state, nowMs);
    return buildSafeTelegramResult(httpStatus, safeBody, deps);
  }

  // §export ──────────────────────────────────────────────────────────────

  var api = Object.freeze({
    VERSION: CANARY_VERSION,
    CANARY_FIXED_MESSAGE: CANARY_FIXED_MESSAGE,
    CANARY_MESSAGE_TYPE: CANARY_MESSAGE_TYPE,
    CANARY_TARGET: CANARY_TARGET,
    CANARY_HARD_TIMEOUT_MS: CANARY_HARD_TIMEOUT_MS,
    CANARY_RATE_LIMIT_MS: CANARY_RATE_LIMIT_MS,
    CANARY_CIRCUIT_FAIL_THRESHOLD: CANARY_CIRCUIT_FAIL_THRESHOLD,
    CANARY_CIRCUIT_OPEN_MS: CANARY_CIRCUIT_OPEN_MS,
    CANARY_AUTH_EXPIRE_MS: CANARY_AUTH_EXPIRE_MS,
    CANARY_RETRY_COUNT: CANARY_RETRY_COUNT,
    ERROR_CODES: ERROR_CODES,
    ALLOWED_RUNTIME_ENV_KEYS: ALLOWED_RUNTIME_ENV_KEYS,
    ALLOWED_HEADER_KEYS: ALLOWED_HEADER_KEYS,
    DEFAULT_TELEGRAM_CANARY_SENDER_CONFIG: DEFAULT_TELEGRAM_CANARY_SENDER_CONFIG,
    build: buildTelegramCanaryPlan,
    dispatchCanary: dispatchCanary,
    validateRuntimePreconditions: validateRuntimePreconditions,
    validateExplicitGate: validateExplicitGate,
    validateFixedMessage: validateFixedMessage,
    buildSafeTelegramResult: buildSafeTelegramResult,
    buildSafeTelegramError: buildSafeTelegramError,
    buildSafeDiagnostics: buildSafeDiagnostics,
    mergeTelegramCanarySenderConfig: mergeTelegramCanarySenderConfig
  });

  global.WS3_TelegramCanarySender = api;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
