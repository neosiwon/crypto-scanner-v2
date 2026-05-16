/**
 * WS3 v0.11.0 — EvaluationObservationAdapter (Adapter Input Contract Pack)
 *
 * Scope:
 *   외부 입력 (caller 주입 외부 관측 요약값)
 *   → standalone evaluationObservation (v0.10.0 buildEvaluationOutcome 입력 호환)
 *
 * 단일 기준 문서:
 *   docs/ws3/WS3_CODE_CONTRACT.md (b-r2 박제본)
 *
 * 확정 DP 정책 (Gate 2 spec):
 *   DP-ACP1   입력 adapter contract 만. 실제 fetch / transport / renderer 구현 X.
 *   DP-ACP2   v0.11.0 입력 layer (EvaluationObservationAdapter + ExternalConfluence).
 *             출력 layer (TransportPlan / RendererBinding) 는 v0.12.0.
 *   DP-ACP3   side-effect 금지 (외부 전송 / 영속 저장 / network / DOM / 브라우저 storage /
 *             런타임 clock API).
 *   DP-ACP4   v0.10.0 buildEvaluationOutcome 입력 호환:
 *             version 기본 'external-observation-v0', source 'adapter-normalized'.
 *             reasons[] 에 'ADAPTER_NORMALIZED' 추가.
 *   DP-ACP6   raw candles array / payload.raw / identityInput / full API response
 *             저장 / 노출 금지. 요약값과 safe scalar 만 사용.
 *   DP-ACP7   Config-driven (DEFAULT_EVALUATION_OBSERVATION_ADAPTER_CONFIG).
 *   DP-ACP8   입력 객체 mutation / delete 금지.
 *
 * U-ACP 확정 처리:
 *   U-ACP-1 Option A — v0.10.0 evaluationObservation.source 자유 string 확인.
 *                     v0.11.0 출력 source = 'adapter-normalized'.
 *                     reasons[] 에 'ADAPTER_NORMALIZED' 추가.
 *
 * N-ACP-OBS 처리:
 *   N-ACP-OBS-1 — payload.newsContext 와 무관 (본 adapter 는 payload 를 read 하지 않음).
 *                 본 adapter 의 input.newsContext 는 ExternalConfluence 의 책임 — 본 모듈 무관.
 *   N-ACP-OBS-2 — v0.2.0-a baseline 보호 파일의 Date.now / fetch 책임 분리.
 *                 본 모듈 침범 금지.
 *
 * 금지 (이번 단계):
 *   외부 API 호출 / network 호출 / XHR / 외부 데이터 가져오기.
 *   영속 저장 (KV / DB / 파일 IO / 브라우저 storage).
 *   외부 전송 / 알림 발송 / 메시지 채널 직접 호출.
 *   DOM 트리 직접 조작 / HTML 문자열 생성 / event 바인딩.
 *   런타임 clock API 사용.
 *   입력 객체 mutation / delete.
 *   raw candles array / 외부 raw response 저장.
 *   bot 식별 시크릿 / 채널 식별자 / API 키.
 *
 * 의존:
 *   외부 caller 가 주입한 외부 관측 요약 객체.
 *   - candidateKey / windowLabel / startMs / endMs
 *   - pricePoints { baseline, current, high, low, close }
 *   - priceTimestamps { highMs, lowMs, closeMs }
 *   - barsObserved / isComplete / sourceTag
 */

(function (global) {
  'use strict';

  var ADAPTER_VERSION = 'WS3_v0.11.0_observation_adapter';
  var CONFIG_VERSION = 'inline-default-v0';
  var OUTPUT_VERSION = 'external-observation-v0';
  var OUTPUT_SOURCE = 'adapter-normalized';

  // ==========================================================================
  // 상수
  // ==========================================================================
  var WINDOW = Object.freeze({
    NONE: 'NONE',
    H24: '24H',
    D7: '7D',
    CUSTOM: 'CUSTOM'
  });

  // ==========================================================================
  // DEFAULT_EVALUATION_OBSERVATION_ADAPTER_CONFIG
  // ==========================================================================
  var DEFAULT_EVALUATION_OBSERVATION_ADAPTER_CONFIG = Object.freeze({
    version: CONFIG_VERSION,
    outputVersion: OUTPUT_VERSION,
    outputSource: OUTPUT_SOURCE,
    allowedWindows: Object.freeze(['NONE', '24H', '7D', 'CUSTOM']),
    fallbackWindow: 'CUSTOM',
    strictCandidateKey: false,
    stripRawInput: true,
    debug: Object.freeze({
      enabled: false,
      allowedFields: Object.freeze([])
    })
  });

  function mergeEvaluationObservationAdapterConfig(config) {
    var c = config || {};
    var d = DEFAULT_EVALUATION_OBSERVATION_ADAPTER_CONFIG;
    var dbg = c.debug || {};
    return {
      version: typeof c.version === 'string' ? c.version : d.version,
      outputVersion: safeString(c.outputVersion, d.outputVersion),
      outputSource: safeString(c.outputSource, d.outputSource),
      allowedWindows: Array.isArray(c.allowedWindows)
        ? c.allowedWindows.filter(function (w) { return typeof w === 'string' && w; })
        : d.allowedWindows.slice(),
      fallbackWindow: safeString(c.fallbackWindow, d.fallbackWindow),
      strictCandidateKey: c.strictCandidateKey === true,
      stripRawInput: c.stripRawInput !== false,
      debug: {
        enabled: dbg.enabled === true,
        allowedFields: Array.isArray(dbg.allowedFields)
          ? dbg.allowedFields.filter(function (f) { return typeof f === 'string' && f; })
          : []
      }
    };
  }

  function makeConfigUsed(cfg) {
    return {
      outputVersion: cfg.outputVersion,
      outputSource: cfg.outputSource,
      allowedWindows: cfg.allowedWindows.slice(),
      fallbackWindow: cfg.fallbackWindow,
      strictCandidateKey: cfg.strictCandidateKey,
      stripRawInput: cfg.stripRawInput,
      debug: {
        enabled: cfg.debug.enabled,
        allowedFields: cfg.debug.allowedFields.slice()
      }
    };
  }

  // ==========================================================================
  // 공통 helper
  // ==========================================================================
  function safeNumber(value, fallback) {
    var fb = (fallback === undefined) ? null : fallback;
    if (value === null || value === undefined) return fb;
    if (typeof value === 'number') return isFinite(value) ? value : fb;
    if (typeof value === 'string' && value.trim() !== '') {
      var n = Number(value);
      return isFinite(n) ? n : fb;
    }
    return fb;
  }

  function safeString(value, fallback) {
    if (typeof value === 'string' && value) return value;
    return (typeof fallback === 'string') ? fallback : null;
  }

  function isPlainObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  function pushReason(target, code, detail) {
    if (!target || !Array.isArray(target.reasons)) return;
    if (typeof code !== 'string' || !code) return;
    var entry = (detail === undefined || detail === null) ? code : (code + ':' + String(detail));
    if (target.reasons.indexOf(entry) === -1) target.reasons.push(entry);
  }

  function pushWarning(target, code, detail) {
    if (!target || !Array.isArray(target.warnings)) return;
    if (typeof code !== 'string' || !code) return;
    var entry = (detail === undefined || detail === null) ? code : (code + ':' + String(detail));
    if (target.warnings.indexOf(entry) === -1) target.warnings.push(entry);
  }

  function isNumericPrice(value) {
    return typeof value === 'number' && isFinite(value) && value > 0;
  }

  function isNumericTs(value) {
    return typeof value === 'number' && isFinite(value);
  }

  function isNonNegativeInteger(value) {
    if (typeof value !== 'number') return false;
    if (!isFinite(value)) return false;
    if (value < 0) return false;
    return Math.floor(value) === value;
  }

  // ==========================================================================
  // §normalizeObservationWindow
  // ==========================================================================
  function normalizeObservationWindow(value, cfg) {
    if (typeof value !== 'string' || !value) return { value: WINDOW.NONE, ok: false };
    var allowed = (cfg && Array.isArray(cfg.allowedWindows)) ? cfg.allowedWindows : DEFAULT_EVALUATION_OBSERVATION_ADAPTER_CONFIG.allowedWindows;
    if (allowed.indexOf(value) !== -1) return { value: value, ok: true };
    var fb = (cfg && typeof cfg.fallbackWindow === 'string' && cfg.fallbackWindow) ? cfg.fallbackWindow : WINDOW.CUSTOM;
    return { value: fb, ok: false };
  }

  // ==========================================================================
  // §normalizeObservationSource (DP-ACP4 / U-ACP-1)
  //   cfg.outputSource 우선 (기본 'adapter-normalized').
  //   sourceTag 가 valid string 이면 reasons 에만 기록. output source 는 항상 cfg.outputSource.
  // ==========================================================================
  function normalizeObservationSource(value, cfg) {
    var outSource = (cfg && typeof cfg.outputSource === 'string' && cfg.outputSource)
      ? cfg.outputSource : OUTPUT_SOURCE;
    return outSource;
  }

  // ==========================================================================
  // §getObservationPrices (DP-ACP6 — pricePoints scalar 만)
  // ==========================================================================
  function getObservationPrices(input) {
    var out = {
      baselinePrice: null,
      currentPrice: null,
      highPrice: null,
      lowPrice: null,
      closePrice: null,
      _invalid: []
    };
    if (!isPlainObject(input)) return out;
    var pp = isPlainObject(input.pricePoints) ? input.pricePoints : null;
    if (!pp) return out;

    var mapping = [
      ['baseline', 'baselinePrice'],
      ['current', 'currentPrice'],
      ['high', 'highPrice'],
      ['low', 'lowPrice'],
      ['close', 'closePrice']
    ];
    for (var i = 0; i < mapping.length; i = i + 1) {
      var srcKey = mapping[i][0];
      var dstKey = mapping[i][1];
      var v = pp[srcKey];
      if (v === null || v === undefined) continue;
      if (isNumericPrice(v)) {
        out[dstKey] = v;
      } else {
        out._invalid.push(srcKey);
      }
    }
    return out;
  }

  // ==========================================================================
  // §getObservationTimestamps
  // ==========================================================================
  function getObservationTimestamps(input) {
    var out = {
      startTs: null,
      endTs: null,
      highTs: null,
      lowTs: null,
      closeTs: null,
      _invalid: []
    };
    if (!isPlainObject(input)) return out;

    if (input.startMs !== null && input.startMs !== undefined) {
      if (isNumericTs(input.startMs)) out.startTs = input.startMs;
      else out._invalid.push('startMs');
    }
    if (input.endMs !== null && input.endMs !== undefined) {
      if (isNumericTs(input.endMs)) out.endTs = input.endMs;
      else out._invalid.push('endMs');
    }

    var pt = isPlainObject(input.priceTimestamps) ? input.priceTimestamps : null;
    if (pt) {
      if (pt.highMs !== null && pt.highMs !== undefined) {
        if (isNumericTs(pt.highMs)) out.highTs = pt.highMs;
        else out._invalid.push('highMs');
      }
      if (pt.lowMs !== null && pt.lowMs !== undefined) {
        if (isNumericTs(pt.lowMs)) out.lowTs = pt.lowMs;
        else out._invalid.push('lowMs');
      }
      if (pt.closeMs !== null && pt.closeMs !== undefined) {
        if (isNumericTs(pt.closeMs)) out.closeTs = pt.closeMs;
        else out._invalid.push('closeMs');
      }
    }
    return out;
  }

  // ==========================================================================
  // §normalizeEvaluationObservationInput
  //   외부 raw input 을 안전한 정규화 컨테이너로 read-only 변환.
  //   stripRawInput=true (기본) → 입력의 알려지지 않은 키나 nested array 는 무시.
  // ==========================================================================
  function normalizeEvaluationObservationInput(input) {
    var ctx = {
      candidateKey: null,
      windowLabel: null,
      startMs: null,
      endMs: null,
      pricePoints: null,
      priceTimestamps: null,
      barsObserved: 0,
      isComplete: false,
      sourceTag: null,
      hasRawInput: false
    };
    if (!isPlainObject(input)) return ctx;

    ctx.candidateKey = safeString(input.candidateKey, null);
    ctx.windowLabel = safeString(input.windowLabel, null);
    ctx.startMs = (input.startMs === undefined) ? null : input.startMs;
    ctx.endMs = (input.endMs === undefined) ? null : input.endMs;
    ctx.pricePoints = isPlainObject(input.pricePoints) ? input.pricePoints : null;
    ctx.priceTimestamps = isPlainObject(input.priceTimestamps) ? input.priceTimestamps : null;
    ctx.barsObserved = (typeof input.barsObserved === 'number' && isFinite(input.barsObserved))
      ? input.barsObserved : 0;
    ctx.isComplete = input.isComplete === true;
    ctx.sourceTag = safeString(input.sourceTag, null);

    // raw array 감지 (예: input.candles / input.rawCandles / input.candleArrays / input.raw)
    if (Array.isArray(input.candles) || Array.isArray(input.rawCandles)
        || Array.isArray(input.candleArrays) || isPlainObject(input.raw)
        || isPlainObject(input.rawResponse) || isPlainObject(input.apiResponse)) {
      ctx.hasRawInput = true;
    }

    return ctx;
  }

  // ==========================================================================
  // §normalize 출력 (v0.10.0 evaluationObservation 호환 shape)
  // ==========================================================================
  function normalizeEvaluationObservation(result) {
    return {
      valid: result.valid === true,
      version: typeof result.version === 'string' ? result.version : OUTPUT_VERSION,
      candidateKey: typeof result.candidateKey === 'string' ? result.candidateKey : null,
      window: typeof result.window === 'string' ? result.window : WINDOW.NONE,
      startTs: (typeof result.startTs === 'number' && isFinite(result.startTs)) ? result.startTs : null,
      endTs: (typeof result.endTs === 'number' && isFinite(result.endTs)) ? result.endTs : null,
      baselinePrice: isNumericPrice(result.baselinePrice) ? result.baselinePrice : null,
      currentPrice: isNumericPrice(result.currentPrice) ? result.currentPrice : null,
      highPrice: isNumericPrice(result.highPrice) ? result.highPrice : null,
      lowPrice: isNumericPrice(result.lowPrice) ? result.lowPrice : null,
      closePrice: isNumericPrice(result.closePrice) ? result.closePrice : null,
      highTs: (typeof result.highTs === 'number' && isFinite(result.highTs)) ? result.highTs : null,
      lowTs: (typeof result.lowTs === 'number' && isFinite(result.lowTs)) ? result.lowTs : null,
      closeTs: (typeof result.closeTs === 'number' && isFinite(result.closeTs)) ? result.closeTs : null,
      observedBars: isNonNegativeInteger(result.observedBars) ? result.observedBars : 0,
      complete: result.complete === true,
      source: typeof result.source === 'string' ? result.source : OUTPUT_SOURCE,
      reasons: Array.isArray(result.reasons) ? result.reasons.slice() : [],
      warnings: Array.isArray(result.warnings) ? result.warnings.slice() : []
    };
  }

  // ==========================================================================
  // §main — buildEvaluationObservation
  // ==========================================================================
  /**
   * 외부 입력 → v0.10.0 evaluationObservation 호환 객체.
   * 입력 mutate 0건 (DP-ACP8).
   *
   * @param {Object} input
   * @param {Object} [config]
   * @return {Object} evaluationObservation (v0.10.0 호환)
   */
  function buildEvaluationObservation(input, config) {
    var cfg = mergeEvaluationObservationAdapterConfig(config);
    var configUsed = makeConfigUsed(cfg);

    var reasons = [];
    var warnings = [];

    // ADAPTER_NORMALIZED (U-ACP-1 + DP-ACP4)
    if (reasons.indexOf('ADAPTER_NORMALIZED') === -1) reasons.push('ADAPTER_NORMALIZED');

    var nctx = normalizeEvaluationObservationInput(input);

    // candidateKey
    var candidateKey = nctx.candidateKey;
    if (candidateKey === null) {
      if (cfg.strictCandidateKey === true) {
        pushWarning({ warnings: warnings }, 'INVALID_CANDIDATE_KEY', 'missing');
      } else {
        pushWarning({ warnings: warnings }, 'INVALID_CANDIDATE_KEY', 'missing');
      }
    }

    // window
    var winRes = normalizeObservationWindow(nctx.windowLabel, cfg);
    if (!winRes.ok && nctx.windowLabel !== null) {
      pushWarning({ warnings: warnings }, 'INVALID_WINDOW', nctx.windowLabel);
    }

    // source
    var outputSource = normalizeObservationSource(nctx.sourceTag, cfg);

    // prices
    var prices = getObservationPrices(input);
    if (prices._invalid.length > 0) {
      for (var i = 0; i < prices._invalid.length; i = i + 1) {
        pushWarning({ warnings: warnings }, 'INVALID_PRICE_FIELD', prices._invalid[i]);
      }
    }

    // timestamps
    var ts = getObservationTimestamps(input);
    if (ts._invalid.length > 0) {
      for (var j = 0; j < ts._invalid.length; j = j + 1) {
        pushWarning({ warnings: warnings }, 'INVALID_TIMESTAMP_FIELD', ts._invalid[j]);
      }
    }

    // observedBars
    var observedBars = 0;
    if (isNonNegativeInteger(nctx.barsObserved)) {
      observedBars = nctx.barsObserved;
    } else if (nctx.barsObserved !== 0 && nctx.barsObserved !== null && nctx.barsObserved !== undefined) {
      pushWarning({ warnings: warnings }, 'INVALID_OBSERVED_BARS', String(nctx.barsObserved));
    }

    // raw input stripped (DP-ACP6)
    if (nctx.hasRawInput === true && cfg.stripRawInput === true) {
      pushWarning({ warnings: warnings }, 'RAW_INPUT_STRIPPED');
      pushReason({ reasons: reasons }, 'RAW_INPUT_STRIPPED');
    }

    // sourceTag (caller 가 제공한 sourceTag 는 reasons 에 기록만, output source 는 cfg.outputSource)
    if (nctx.sourceTag !== null && nctx.sourceTag !== outputSource) {
      pushReason({ reasons: reasons }, 'SOURCE_TAG', nctx.sourceTag);
    }

    // valid 판정
    var valid = (candidateKey !== null)
                && (prices.baselinePrice !== null
                    || prices.currentPrice !== null
                    || prices.highPrice !== null
                    || prices.lowPrice !== null
                    || prices.closePrice !== null);

    var result = {
      valid: valid,
      version: cfg.outputVersion,
      candidateKey: candidateKey,
      window: winRes.value,
      startTs: ts.startTs,
      endTs: ts.endTs,
      baselinePrice: prices.baselinePrice,
      currentPrice: prices.currentPrice,
      highPrice: prices.highPrice,
      lowPrice: prices.lowPrice,
      closePrice: prices.closePrice,
      highTs: ts.highTs,
      lowTs: ts.lowTs,
      closeTs: ts.closeTs,
      observedBars: observedBars,
      complete: nctx.isComplete === true,
      source: outputSource,
      reasons: reasons,
      warnings: warnings
    };

    var normalized = normalizeEvaluationObservation(result);
    // configUsed / debug 은 v0.10.0 호환을 위해 normalized output 에 포함하지 않음.
    // 호환 우선 정책 (DP-ACP4).
    return normalized;
  }

  // ==========================================================================
  // §export — 이중 환경
  // ==========================================================================
  var api = Object.freeze({
    ADAPTER_VERSION: ADAPTER_VERSION,
    CONFIG_VERSION: CONFIG_VERSION,
    OUTPUT_VERSION: OUTPUT_VERSION,
    OUTPUT_SOURCE: OUTPUT_SOURCE,
    DEFAULT_EVALUATION_OBSERVATION_ADAPTER_CONFIG: DEFAULT_EVALUATION_OBSERVATION_ADAPTER_CONFIG,
    WINDOW: WINDOW,

    build: buildEvaluationObservation,
    mergeEvaluationObservationAdapterConfig: mergeEvaluationObservationAdapterConfig,

    normalizeEvaluationObservationInput: normalizeEvaluationObservationInput,
    normalizeObservationWindow: normalizeObservationWindow,
    normalizeObservationSource: normalizeObservationSource,
    getObservationPrices: getObservationPrices,
    getObservationTimestamps: getObservationTimestamps,

    isNumericPrice: isNumericPrice,
    isNumericTs: isNumericTs,
    isNonNegativeInteger: isNonNegativeInteger,

    normalizeEvaluationObservation: normalizeEvaluationObservation,
    pushReason: pushReason,
    pushWarning: pushWarning
  });

  global.WS3_EvaluationObservationAdapter = api;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis
   : typeof window !== 'undefined' ? window
   : typeof self !== 'undefined' ? self
   : this);
