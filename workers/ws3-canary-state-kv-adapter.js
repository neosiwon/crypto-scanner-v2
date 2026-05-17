/**
 * WS3 v0.23.0 — Canary State KV Adapter
 *
 * canary 전용 KV 접근만 담당. 본선 / 실코인 / Snapshot / Evaluation / Audit KV write 금지.
 *
 * 정책:
 *   - prefix: 'ws3:canary:' 만 허용. 다른 prefix 접근 시 INVALID_KV_KEY_PREFIX.
 *   - schemaVersion: 'v1' 강제. 불일치 시 SCHEMA_VERSION_MISMATCH.
 *   - hash: SHA-256 lowercase hex first 16 chars. 위반 시 INVALID_HASH_FORMAT.
 *   - secret / Telegram message_id / raw response / token / chatId / invoke token 저장 금지.
 *
 * 한계 (r0.2-final 박제):
 *   - KV alreadySent 는 strict distributed lock 이 아니다. persistent safety guard.
 *   - strict one-time guarantee 는 v0.24+ Durable Objects / atomic lock 에서 검토.
 *   - mock KV = strong consistency / real KV = eventual consistency 가능. mock 통과 가
 *     production 안정성을 완전히 보장하지 않음.
 *
 * export: CommonJS module.exports. Cloudflare Worker 는 entry shim 통해 import.
 */
'use strict';

var KV_PREFIX = 'ws3:canary:';
var SCHEMA_VERSION = 'v1';
var HASH_HEX_LENGTH = 16;
var MESSAGE_TYPE = 'CANARY_TEST_ONLY';

// §helpers ─────────────────────────────────────────────────────────────

function isPlainObject(v) {
  if (v === null || v === undefined) return false;
  if (typeof v !== 'object') return false;
  if (Array.isArray(v)) return false;
  return true;
}

function safeJsonParse(s) {
  if (typeof s !== 'string') return null;
  try { return JSON.parse(s); } catch (e) { return null; }
}

function safeJsonStringify(obj) {
  if (!isPlainObject(obj)) return null;
  try { return JSON.stringify(obj); } catch (e) { return null; }
}

// §key validation + builders ────────────────────────────────────────────

function validateCanaryKvKey(key) {
  if (typeof key !== 'string' || key.length === 0) {
    return { valid: false, reason: 'INVALID_KV_KEY_PREFIX' };
  }
  if (key.indexOf(KV_PREFIX) !== 0) {
    return { valid: false, reason: 'INVALID_KV_KEY_PREFIX' };
  }
  // additional guard — disallow path traversal / null bytes
  if (key.indexOf('\0') !== -1) return { valid: false, reason: 'INVALID_KV_KEY_PREFIX' };
  if (key.length > 256) return { valid: false, reason: 'INVALID_KV_KEY_PREFIX' };
  return { valid: true, reason: null };
}

function isValidHash(h) {
  if (typeof h !== 'string') return false;
  if (h.length !== HASH_HEX_LENGTH) return false;
  var i;
  for (i = 0; i < h.length; i++) {
    var c = h.charCodeAt(i);
    var isDigit = (c >= 48 && c <= 57);
    var isLowerHex = (c >= 97 && c <= 102);
    if (!isDigit && !isLowerHex) return false;
  }
  return true;
}

function keyAlreadySent() { return KV_PREFIX + 'alreadySent'; }
function keyCleanupRequired() { return KV_PREFIX + 'cleanupRequired'; }
function keyCircuit() { return KV_PREFIX + 'circuit'; }
function keyInvokeFail(originHash) {
  if (!isValidHash(originHash)) return null;
  return KV_PREFIX + 'invokeFail:' + originHash;
}

// §KV CRUD wrappers ─────────────────────────────────────────────────────

async function getJson(kv, key) {
  var v = validateCanaryKvKey(key);
  if (v.valid !== true) return { ok: false, reason: v.reason };
  if (!kv || typeof kv.get !== 'function') return { ok: false, reason: 'PERSISTENCE_UNAVAILABLE' };
  var raw;
  try {
    raw = await kv.get(key);
  } catch (e) {
    return { ok: false, reason: 'PERSISTENCE_UNAVAILABLE' };
  }
  if (raw === null || raw === undefined) return { ok: true, value: null };
  if (typeof raw !== 'string') return { ok: false, reason: 'INVALID_KV_VALUE' };
  var parsed = safeJsonParse(raw);
  if (!isPlainObject(parsed)) return { ok: false, reason: 'INVALID_KV_VALUE' };
  if (parsed.schemaVersion !== SCHEMA_VERSION) return { ok: false, reason: 'SCHEMA_VERSION_MISMATCH' };
  return { ok: true, value: parsed };
}

async function putJson(kv, key, value) {
  var v = validateCanaryKvKey(key);
  if (v.valid !== true) return { ok: false, reason: v.reason };
  if (!kv || typeof kv.put !== 'function') return { ok: false, reason: 'PERSISTENCE_UNAVAILABLE' };
  if (!isPlainObject(value)) return { ok: false, reason: 'INVALID_KV_VALUE' };
  if (value.schemaVersion !== SCHEMA_VERSION) return { ok: false, reason: 'SCHEMA_VERSION_MISMATCH' };
  var s = safeJsonStringify(value);
  if (s === null) return { ok: false, reason: 'INVALID_KV_VALUE' };
  try {
    await kv.put(key, s);
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: 'PERSISTENCE_UNAVAILABLE' };
  }
}

async function deleteKey(kv, key) {
  var v = validateCanaryKvKey(key);
  if (v.valid !== true) return { ok: false, reason: v.reason };
  if (!kv || typeof kv.delete !== 'function') return { ok: false, reason: 'PERSISTENCE_UNAVAILABLE' };
  try {
    await kv.delete(key);
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: 'PERSISTENCE_UNAVAILABLE' };
  }
}

async function listKeysByPrefix(kv, prefix) {
  if (typeof prefix !== 'string' || prefix.indexOf(KV_PREFIX) !== 0) {
    return { ok: false, reason: 'INVALID_KV_KEY_PREFIX' };
  }
  if (!kv || typeof kv.list !== 'function') return { ok: false, reason: 'PERSISTENCE_UNAVAILABLE' };
  try {
    var res = await kv.list({ prefix: prefix });
    var out = [];
    if (res && Array.isArray(res.keys)) {
      var i;
      for (i = 0; i < res.keys.length; i++) {
        var entry = res.keys[i];
        if (entry && typeof entry.name === 'string') out.push(entry.name);
      }
    }
    return { ok: true, keys: out };
  } catch (e) {
    return { ok: false, reason: 'PERSISTENCE_UNAVAILABLE' };
  }
}

// §SHA-256 origin hash ──────────────────────────────────────────────────

async function hashOrigin(origin, cryptoImpl) {
  if (typeof origin !== 'string' || origin.length === 0) return null;
  var ci = cryptoImpl;
  if (!ci || !ci.subtle) {
    if (typeof crypto !== 'undefined' && crypto && crypto.subtle) ci = crypto;
  }
  if (!ci || !ci.subtle || typeof ci.subtle.digest !== 'function') return null;
  if (typeof TextEncoder === 'undefined') return null;
  var enc = new TextEncoder();
  var buf = enc.encode(origin);
  var digestBuf;
  try {
    digestBuf = await ci.subtle.digest('SHA-256', buf);
  } catch (e) {
    return null;
  }
  var bytes = new Uint8Array(digestBuf);
  var hex = '';
  var i;
  for (i = 0; i < bytes.length; i++) {
    var b = bytes[i].toString(16);
    if (b.length < 2) b = '0' + b;
    hex += b;
  }
  return hex.substring(0, HASH_HEX_LENGTH);
}

// §domain readers / writers ─────────────────────────────────────────────

async function readAlreadySent(kv) {
  return getJson(kv, keyAlreadySent());
}

async function writeAlreadySent(kv, sentAt) {
  return putJson(kv, keyAlreadySent(), {
    schemaVersion: SCHEMA_VERSION,
    alreadySent: true,
    sentAt: (typeof sentAt === 'number' && isFinite(sentAt)) ? sentAt : null,
    messageType: MESSAGE_TYPE,
    fixedMessageUsed: true
  });
}

async function readCleanupRequired(kv) {
  return getJson(kv, keyCleanupRequired());
}

async function writeCleanupRequired(kv, payload) {
  if (!isPlainObject(payload)) return { ok: false, reason: 'INVALID_KV_VALUE' };
  var cr = payload.cleanupRequired === true;
  var reason = (typeof payload.reason === 'string' && payload.reason.length > 0 && payload.reason.length <= 64) ? payload.reason : null;
  var createdAt = (typeof payload.createdAt === 'number' && isFinite(payload.createdAt)) ? payload.createdAt : null;
  var lastCleanupAt = (typeof payload.lastCleanupAt === 'number' && isFinite(payload.lastCleanupAt)) ? payload.lastCleanupAt : null;
  return putJson(kv, keyCleanupRequired(), {
    schemaVersion: SCHEMA_VERSION,
    cleanupRequired: cr,
    reason: reason,
    createdAt: createdAt,
    lastCleanupAt: lastCleanupAt
  });
}

async function readCircuit(kv) {
  return getJson(kv, keyCircuit());
}

async function writeCircuit(kv, payload) {
  if (!isPlainObject(payload)) return { ok: false, reason: 'INVALID_KV_VALUE' };
  return putJson(kv, keyCircuit(), {
    schemaVersion: SCHEMA_VERSION,
    circuitOpen: payload.circuitOpen === true,
    consecutiveFailures: (typeof payload.consecutiveFailures === 'number' && isFinite(payload.consecutiveFailures)) ? payload.consecutiveFailures : 0,
    lastFailureAt: (typeof payload.lastFailureAt === 'number' && isFinite(payload.lastFailureAt)) ? payload.lastFailureAt : null,
    circuitOpenUntil: (typeof payload.circuitOpenUntil === 'number' && isFinite(payload.circuitOpenUntil)) ? payload.circuitOpenUntil : null
  });
}

async function readInvokeFail(kv, originHash) {
  if (!isValidHash(originHash)) return { ok: false, reason: 'INVALID_HASH_FORMAT' };
  return getJson(kv, keyInvokeFail(originHash));
}

async function writeInvokeFail(kv, originHash, payload) {
  if (!isValidHash(originHash)) return { ok: false, reason: 'INVALID_HASH_FORMAT' };
  if (!isPlainObject(payload)) return { ok: false, reason: 'INVALID_KV_VALUE' };
  return putJson(kv, keyInvokeFail(originHash), {
    schemaVersion: SCHEMA_VERSION,
    originHash: originHash,
    failureCount: (typeof payload.failureCount === 'number' && isFinite(payload.failureCount)) ? payload.failureCount : 0,
    lastFailureAt: (typeof payload.lastFailureAt === 'number' && isFinite(payload.lastFailureAt)) ? payload.lastFailureAt : null,
    blockedUntil: (typeof payload.blockedUntil === 'number' && isFinite(payload.blockedUntil)) ? payload.blockedUntil : null
  });
}

// §export ──────────────────────────────────────────────────────────────

module.exports = {
  KV_PREFIX: KV_PREFIX,
  SCHEMA_VERSION: SCHEMA_VERSION,
  HASH_HEX_LENGTH: HASH_HEX_LENGTH,
  MESSAGE_TYPE: MESSAGE_TYPE,
  isPlainObject: isPlainObject,
  safeJsonParse: safeJsonParse,
  safeJsonStringify: safeJsonStringify,
  validateCanaryKvKey: validateCanaryKvKey,
  isValidHash: isValidHash,
  keyAlreadySent: keyAlreadySent,
  keyCleanupRequired: keyCleanupRequired,
  keyCircuit: keyCircuit,
  keyInvokeFail: keyInvokeFail,
  getJson: getJson,
  putJson: putJson,
  deleteKey: deleteKey,
  listKeysByPrefix: listKeysByPrefix,
  hashOrigin: hashOrigin,
  readAlreadySent: readAlreadySent,
  writeAlreadySent: writeAlreadySent,
  readCleanupRequired: readCleanupRequired,
  writeCleanupRequired: writeCleanupRequired,
  readCircuit: readCircuit,
  writeCircuit: writeCircuit,
  readInvokeFail: readInvokeFail,
  writeInvokeFail: writeInvokeFail
};
