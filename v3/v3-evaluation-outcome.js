/**
 * WS3 v0.10.0 — EvaluationOutcome / Result Classifier
 *
 * Scope:
 *   operationPacket (v0.8.0)
 *   + activeCycleDecision (v0.9.0)
 *   + evaluationObservation (caller 주입 외부 관측 요약)
 *   + previousEvaluationState (caller 주입 이전 평가 상태 — null 가능)
 *   → standalone evaluationOutcome (평가 결과 분류 데이터. 저장소 / 수집기 아님)
 *
 * 단일 기준 문서:
 *   docs/ws3/WS3_CODE_CONTRACT.md (b-r2 박제본)
 *
 * 확정 DP 정책 (Gate 2 spec):
 *   DP-EO1   standalone 반환. operationPacket / activeCycleDecision /
 *            evaluationObservation / previousEvaluationState mutate 금지.
 *   DP-EO2   side-effect 금지 (외부 전송 / 영속 저장 / network / DOM / 브라우저 storage).
 *   DP-EO3   evaluationObservation 은 caller 주입. v0.10.0 이 직접 수집하지 않음.
 *   DP-EO4   raw candles array 직접 저장/노출 금지. 요약값만 사용.
 *   DP-EO5   baselinePrice: operationPacket.evaluationSeed.baselinePrice 우선 →
 *            evaluationObservation.baselinePrice → null (DATA_INSUFFICIENT).
 *   DP-EO6   target/invalidation numeric only + value/pct 단위 분리.
 *            unit 없으면 price 우선. pct 는 unit==='pct' 또는 config fallback 만.
 *   DP-EO7   DATA_AMBIGUOUS 는 최후 fallback. highTs / lowTs 모두 numeric 이면
 *            선후 판단으로 TARGET_HIT / INVALIDATED 결정.
 *   DP-EO8   thresholds config-driven (planTargetPct / watchConfirmPct /
 *            invalidationPct 등).
 *   DP-EO9   안전 결과 라벨 (TARGET_HIT / INVALIDATED / WATCH_CONFIRMED 등).
 *            매수 성공 / 손절 / 익절 / 수익·손실 확정 어휘 금지.
 *   DP-EO10  nextEvaluationState 포함. previousEvaluationState 와 결합해
 *            maxFavorablePct / maxAdversePct 누적. 실제 저장은 후속 adapter.
 *   DP-EO11  status (진행 상태) vs resultType (결과 분류) 분리.
 *   DP-EO12  changePct / movementPct 만 사용. 수익·손실 확정 표현 금지.
 *   DP-EO13  previousEvaluationState caller 주입. v0.10.0 직접 읽기/저장 X.
 *            null/invalid 시 base empty state 로 처리.
 *   DP-EO14  movement 누적: max(prev.maxFavorablePct, current.highMovePct) /
 *                          min(prev.maxAdversePct, current.lowMovePct).
 *
 * U-EO 확정 처리:
 *   U-EO-1 Option A — hint.unit 부재 → default 'price' 처리.
 *                     pct 는 hint.unit === 'pct' 또는 config fallback 만.
 *                     UNIT_AMBIGUOUS 검사는 hint value 가 0<v<1 +
 *                     baselinePrice isNumericPrice && >=10 일 때만 trigger.
 *                     baselinePrice null 또는 <10 → 검사 skip + 필요 시
 *                     UNIT_DETECTION_SKIPPED warning.
 *   U-EO-2        — target: targetHints 첫 numeric TARGET → safeHints TARGET →
 *                          cfg.thresholds.planTargetPct → null.
 *                   invalidation: invalidationHints type='INVALIDATION' 우선 →
 *                          'SETUP_INVALIDATION' → safeHints INVALIDATION →
 *                          cfg.thresholds.invalidationPct → null.
 *   U-EO-3        — DATA_AMBIGUOUS 는 pathOrder.pathOrderKnown !== true 일 때만.
 *                   pathOrderKnown=true 면 firstEvent 로 TARGET_HIT / INVALIDATED 결정.
 *
 * N-EO-OBS 처리:
 *   N-EO-OBS-1 — timestamp 는 spec §0 정책 사용 (별도 getCurrentTs 미작성).
 *   N-EO-OBS-2 — v0.2.0-a baseline 보호 파일의 Date.now / fetch 책임 분리.
 *                본 모듈 침범 금지.
 *
 * 금지 (이번 단계):
 *   외부 전송 / 알림 발송 / 메시지 채널 직접 호출.
 *   영속 저장 (KV / DB / 파일 IO / 브라우저 storage).
 *   network 호출 / XHR / 외부 데이터 가져오기.
 *   DOM 트리 직접 조작 / HTML 문자열 생성 / event 바인딩.
 *   런타임 clock API 사용.
 *   입력 4종 mutation / delete.
 *   행동 지시 어조 ("매수하세요" / "매도하세요" 등).
 *   raw candles array / payload.raw / payload.raw.builderDebug 전체 직접 노출.
 *   identityInput 직접 노출.
 *   bot 식별 시크릿 / 채널 식별자 / API 키.
 *   매매 성공·실패 / 수익·손실 확정 / 익절·손절 어휘.
 *
 * 의존:
 *   operationPacket           (v3-operation-packet.js 산출)
 *   activeCycleDecision       (v3-active-cycle.js 산출)
 *   evaluationObservation     (caller 주입 외부 요약)
 *   previousEvaluationState   (caller 주입 또는 이전 evaluationOutcome.nextEvaluationState)
 */

(function (global) {
  'use strict';

  var EVALUATION_OUTCOME_VERSION = 'WS3_v0.10.0';
  var CONFIG_VERSION = 'inline-default-v0';

  // ==========================================================================
  // 상수 (Gate 2 spec §6 / §7 / §10 / §11)
  // ==========================================================================
  var STATUS = Object.freeze({
    UNKNOWN: 'UNKNOWN',
    PENDING: 'PENDING',
    IN_PROGRESS: 'IN_PROGRESS',
    COMPLETED: 'COMPLETED',
    CLOSED: 'CLOSED',
    INVALID: 'INVALID'
  });

  var RESULT_TYPE = Object.freeze({
    NONE: 'NONE',
    IN_PROGRESS: 'IN_PROGRESS',
    TARGET_HIT: 'TARGET_HIT',
    INVALIDATED: 'INVALIDATED',
    WATCH_CONFIRMED: 'WATCH_CONFIRMED',
    WATCH_FAILED: 'WATCH_FAILED',
    NEUTRAL: 'NEUTRAL',
    EXPIRED_REVIEW: 'EXPIRED_REVIEW',
    COOLDOWN_REVIEW: 'COOLDOWN_REVIEW',
    DATA_INSUFFICIENT: 'DATA_INSUFFICIENT',
    DATA_AMBIGUOUS: 'DATA_AMBIGUOUS'
  });

  var RESULT_PHASE = Object.freeze({
    NONE: 'NONE',
    EARLY: 'EARLY',
    MID: 'MID',
    LATE: 'LATE',
    DONE: 'DONE',
    REVIEW: 'REVIEW'
  });

  var OUTCOME_QUALITY = Object.freeze({
    UNKNOWN: 'UNKNOWN',
    LOW: 'LOW',
    MEDIUM: 'MEDIUM',
    HIGH: 'HIGH'
  });

  var WINDOW = Object.freeze({
    NONE: 'NONE',
    H24: '24H',
    D7: '7D',
    CUSTOM: 'CUSTOM'
  });

  var HIT_TYPE = Object.freeze({
    NONE: 'NONE',
    BY_VALUE: 'BY_VALUE',
    BY_PCT: 'BY_PCT',
    BY_BOTH: 'BY_BOTH'
  });

  var PATH_FIRST_EVENT = Object.freeze({
    NONE: 'NONE',
    TARGET: 'TARGET',
    INVALIDATION: 'INVALIDATION'
  });

  // ==========================================================================
  // DEFAULT_EVALUATION_OUTCOME_CONFIG (Gate 2 spec §11)
  // ==========================================================================
  var DEFAULT_EVALUATION_OUTCOME_CONFIG = Object.freeze({
    version: CONFIG_VERSION,
    thresholds: Object.freeze({
      planTargetPct: 5,
      watchConfirmPct: 3,
      neutralBandPct: 1,
      invalidationPct: -5,
      minObservationBars: 1
    }),
    routing: Object.freeze({
      storeInProgress: true,
      storeCompleted: true,
      closeOnTargetHit: true,
      closeOnInvalidated: true,
      reviewCooldown: true,
      reviewExpired: true
    }),
    safety: Object.freeze({
      allowTradingLanguage: false,
      allowRawCandles: false,
      allowOrderAssumption: false
    }),
    debug: Object.freeze({
      enabled: false,
      allowedFields: Object.freeze([])
    })
  });

  function mergeEvaluationOutcomeConfig(config) {
    var c = config || {};
    var d = DEFAULT_EVALUATION_OUTCOME_CONFIG;
    var th = c.thresholds || {};
    var rt = c.routing || {};
    var sf = c.safety || {};
    var dbg = c.debug || {};
    return {
      version: typeof c.version === 'string' ? c.version : d.version,
      thresholds: {
        planTargetPct: safeNumber(th.planTargetPct, d.thresholds.planTargetPct),
        watchConfirmPct: safeNumber(th.watchConfirmPct, d.thresholds.watchConfirmPct),
        neutralBandPct: safeNumber(th.neutralBandPct, d.thresholds.neutralBandPct),
        invalidationPct: safeNumber(th.invalidationPct, d.thresholds.invalidationPct),
        minObservationBars: safeNumber(th.minObservationBars, d.thresholds.minObservationBars)
      },
      routing: {
        storeInProgress: rt.storeInProgress !== false,
        storeCompleted: rt.storeCompleted !== false,
        closeOnTargetHit: rt.closeOnTargetHit !== false,
        closeOnInvalidated: rt.closeOnInvalidated !== false,
        reviewCooldown: rt.reviewCooldown !== false,
        reviewExpired: rt.reviewExpired !== false
      },
      safety: {
        allowTradingLanguage: sf.allowTradingLanguage === true,
        allowRawCandles: sf.allowRawCandles === true,
        allowOrderAssumption: sf.allowOrderAssumption === true
      },
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
      thresholds: {
        planTargetPct: cfg.thresholds.planTargetPct,
        watchConfirmPct: cfg.thresholds.watchConfirmPct,
        neutralBandPct: cfg.thresholds.neutralBandPct,
        invalidationPct: cfg.thresholds.invalidationPct,
        minObservationBars: cfg.thresholds.minObservationBars
      },
      routing: {
        storeInProgress: cfg.routing.storeInProgress,
        storeCompleted: cfg.routing.storeCompleted,
        closeOnTargetHit: cfg.routing.closeOnTargetHit,
        closeOnInvalidated: cfg.routing.closeOnInvalidated,
        reviewCooldown: cfg.routing.reviewCooldown,
        reviewExpired: cfg.routing.reviewExpired
      },
      safety: {
        allowTradingLanguage: cfg.safety.allowTradingLanguage,
        allowRawCandles: cfg.safety.allowRawCandles,
        allowOrderAssumption: cfg.safety.allowOrderAssumption
      },
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

  function isNumericPct(value) {
    return typeof value === 'number' && isFinite(value);
  }

  function safePct(numerator, denominator) {
    if (typeof numerator !== 'number' || !isFinite(numerator)) return null;
    if (typeof denominator !== 'number' || !isFinite(denominator)) return null;
    if (denominator === 0) return null;
    return ((numerator) / denominator) * 100;
  }

  function safeMaxOrPick(prevValue, currentValue) {
    var hasPrev = typeof prevValue === 'number' && isFinite(prevValue);
    var hasCur = typeof currentValue === 'number' && isFinite(currentValue);
    if (hasPrev && hasCur) return Math.max(prevValue, currentValue);
    if (hasPrev) return prevValue;
    if (hasCur) return currentValue;
    return null;
  }

  function safeMinOrPick(prevValue, currentValue) {
    var hasPrev = typeof prevValue === 'number' && isFinite(prevValue);
    var hasCur = typeof currentValue === 'number' && isFinite(currentValue);
    if (hasPrev && hasCur) return Math.min(prevValue, currentValue);
    if (hasPrev) return prevValue;
    if (hasCur) return currentValue;
    return null;
  }

  // ==========================================================================
  // §getCandidateKey / §getIdentity / §getEvaluationType / §getEvaluationWindow
  // ==========================================================================
  function getCandidateKey(operationPacket, activeCycleDecision, evaluationObservation) {
    if (isPlainObject(operationPacket)
        && typeof operationPacket.candidateKey === 'string' && operationPacket.candidateKey) {
      return operationPacket.candidateKey;
    }
    if (isPlainObject(activeCycleDecision)
        && typeof activeCycleDecision.candidateKey === 'string' && activeCycleDecision.candidateKey) {
      return activeCycleDecision.candidateKey;
    }
    if (isPlainObject(evaluationObservation)
        && typeof evaluationObservation.candidateKey === 'string' && evaluationObservation.candidateKey) {
      return evaluationObservation.candidateKey;
    }
    return null;
  }

  function getIdentity(operationPacket, activeCycleDecision) {
    var id = {
      exchange: null, market: null, base: null, quote: null,
      displayName: null, timeframe: null
    };
    var src = null;
    if (isPlainObject(operationPacket) && isPlainObject(operationPacket.identity)) {
      src = operationPacket.identity;
    } else if (isPlainObject(activeCycleDecision) && isPlainObject(activeCycleDecision.identity)) {
      src = activeCycleDecision.identity;
    }
    if (!src) return id;
    id.exchange = safeString(src.exchange, null);
    id.market = safeString(src.market, null);
    id.base = safeString(src.base, null);
    id.quote = safeString(src.quote, null);
    id.displayName = safeString(src.displayName, null);
    id.timeframe = safeString(src.timeframe, null);
    return id;
  }

  function getEvaluationType(operationPacket) {
    if (isPlainObject(operationPacket)
        && isPlainObject(operationPacket.evaluationSeed)
        && typeof operationPacket.evaluationSeed.evaluationType === 'string') {
      return operationPacket.evaluationSeed.evaluationType;
    }
    return 'NONE';
  }

  function getEvaluationWindow(operationPacket, evaluationObservation) {
    if (isPlainObject(evaluationObservation)
        && typeof evaluationObservation.window === 'string' && evaluationObservation.window) {
      return evaluationObservation.window;
    }
    if (isPlainObject(operationPacket)
        && isPlainObject(operationPacket.evaluationSeed)
        && typeof operationPacket.evaluationSeed.horizon === 'string'
        && operationPacket.evaluationSeed.horizon) {
      return operationPacket.evaluationSeed.horizon;
    }
    return WINDOW.NONE;
  }

  // ==========================================================================
  // §getBaselinePrice (DP-EO5)
  // ==========================================================================
  function getBaselinePrice(operationPacket, evaluationObservation) {
    if (isPlainObject(operationPacket) && isPlainObject(operationPacket.evaluationSeed)) {
      var bp = operationPacket.evaluationSeed.baselinePrice;
      if (isNumericPrice(bp)) return bp;
    }
    if (isPlainObject(evaluationObservation)) {
      var ob = evaluationObservation.baselinePrice;
      if (isNumericPrice(ob)) return ob;
    }
    return null;
  }

  // ==========================================================================
  // §getObservationPrices
  // ==========================================================================
  function getObservationPrices(evaluationObservation) {
    var p = {
      currentPrice: null, highPrice: null, lowPrice: null, closePrice: null,
      highTs: null, lowTs: null, closeTs: null,
      startTs: null, endTs: null,
      observedBars: 0, complete: false
    };
    if (!isPlainObject(evaluationObservation)) return p;
    p.currentPrice = isNumericPrice(evaluationObservation.currentPrice) ? evaluationObservation.currentPrice : null;
    p.highPrice = isNumericPrice(evaluationObservation.highPrice) ? evaluationObservation.highPrice : null;
    p.lowPrice = isNumericPrice(evaluationObservation.lowPrice) ? evaluationObservation.lowPrice : null;
    p.closePrice = isNumericPrice(evaluationObservation.closePrice) ? evaluationObservation.closePrice : null;
    p.highTs = (typeof evaluationObservation.highTs === 'number' && isFinite(evaluationObservation.highTs)) ? evaluationObservation.highTs : null;
    p.lowTs = (typeof evaluationObservation.lowTs === 'number' && isFinite(evaluationObservation.lowTs)) ? evaluationObservation.lowTs : null;
    p.closeTs = (typeof evaluationObservation.closeTs === 'number' && isFinite(evaluationObservation.closeTs)) ? evaluationObservation.closeTs : null;
    p.startTs = (typeof evaluationObservation.startTs === 'number' && isFinite(evaluationObservation.startTs)) ? evaluationObservation.startTs : null;
    p.endTs = (typeof evaluationObservation.endTs === 'number' && isFinite(evaluationObservation.endTs)) ? evaluationObservation.endTs : null;
    p.observedBars = safeNumber(evaluationObservation.observedBars, 0);
    p.complete = evaluationObservation.complete === true;
    return p;
  }

  // ==========================================================================
  // §normalizePreviousEvaluationState (U-AC-2 정합 — base empty state)
  // ==========================================================================
  function normalizePreviousEvaluationState(previousEvaluationState) {
    var base = {
      valid: false,
      candidateKey: null,
      evaluationType: 'NONE',
      window: 'NONE',
      status: 'UNKNOWN',
      resultType: 'NONE',
      startTs: null,
      lastObservedTs: null,
      completedTs: null,
      baselinePrice: null,
      lastPrice: null,
      maxFavorablePct: null,
      maxAdversePct: null,
      targetHit: false,
      invalidated: false
    };
    if (!isPlainObject(previousEvaluationState)) return base;
    base.valid = previousEvaluationState.valid === true;
    base.candidateKey = safeString(previousEvaluationState.candidateKey, null);
    base.evaluationType = safeString(previousEvaluationState.evaluationType, 'NONE');
    base.window = safeString(previousEvaluationState.window, 'NONE');
    base.status = safeString(previousEvaluationState.status, 'UNKNOWN');
    base.resultType = safeString(previousEvaluationState.resultType, 'NONE');
    base.startTs = safeNumber(previousEvaluationState.startTs, null);
    base.lastObservedTs = safeNumber(previousEvaluationState.lastObservedTs, null);
    base.completedTs = safeNumber(previousEvaluationState.completedTs, null);
    base.baselinePrice = isNumericPrice(previousEvaluationState.baselinePrice)
      ? previousEvaluationState.baselinePrice : null;
    base.lastPrice = isNumericPrice(previousEvaluationState.lastPrice)
      ? previousEvaluationState.lastPrice : null;
    base.maxFavorablePct = isNumericPct(previousEvaluationState.maxFavorablePct)
      ? previousEvaluationState.maxFavorablePct : null;
    base.maxAdversePct = isNumericPct(previousEvaluationState.maxAdversePct)
      ? previousEvaluationState.maxAdversePct : null;
    base.targetHit = previousEvaluationState.targetHit === true;
    base.invalidated = previousEvaluationState.invalidated === true;
    return base;
  }

  // ==========================================================================
  // §calculateMovement (DP-EO14 — 누적)
  // ==========================================================================
  function calculateMovement(priceBasis, previousNormalized) {
    var out = {
      currentChangePct: null,
      maxFavorablePct: null,
      maxAdversePct: null,
      closeChangePct: null,
      highMovePct: null,
      lowMovePct: null,
      previousMaxFavorablePct: null,
      previousMaxAdversePct: null
    };
    if (!isPlainObject(priceBasis)) return out;
    var base = priceBasis.baselinePrice;
    if (!isNumericPrice(base)) {
      if (previousNormalized) {
        out.previousMaxFavorablePct = previousNormalized.maxFavorablePct;
        out.previousMaxAdversePct = previousNormalized.maxAdversePct;
        out.maxFavorablePct = previousNormalized.maxFavorablePct;
        out.maxAdversePct = previousNormalized.maxAdversePct;
      }
      return out;
    }

    if (isNumericPrice(priceBasis.currentPrice)) {
      out.currentChangePct = safePct(priceBasis.currentPrice - base, base);
    }
    if (isNumericPrice(priceBasis.closePrice)) {
      out.closeChangePct = safePct(priceBasis.closePrice - base, base);
    }
    if (isNumericPrice(priceBasis.highPrice)) {
      out.highMovePct = safePct(priceBasis.highPrice - base, base);
    }
    if (isNumericPrice(priceBasis.lowPrice)) {
      out.lowMovePct = safePct(priceBasis.lowPrice - base, base);
    }

    if (previousNormalized) {
      out.previousMaxFavorablePct = previousNormalized.maxFavorablePct;
      out.previousMaxAdversePct = previousNormalized.maxAdversePct;
    }

    // DP-EO14 누적
    out.maxFavorablePct = safeMaxOrPick(
      previousNormalized ? previousNormalized.maxFavorablePct : null,
      out.highMovePct
    );
    out.maxAdversePct = safeMinOrPick(
      previousNormalized ? previousNormalized.maxAdversePct : null,
      out.lowMovePct
    );

    return out;
  }

  // ==========================================================================
  // §getTargetRefs / §getInvalidationRefs (U-EO-2 + DP-EO6 unit 분리)
  //   hint shape (v0.8.0 산출): { type, labelKo, labelEn, value, valueText, source }
  //   - hint.unit 부재 → default 'price'
  //   - hint.unit === 'pct' → pct
  //   - cfg.thresholds.* fallback → pct
  // ==========================================================================
  function classifyHintUnit(hint) {
    if (!isPlainObject(hint)) return 'price';
    if (typeof hint.unit === 'string') {
      if (hint.unit === 'pct') return 'pct';
      if (hint.unit === 'price') return 'price';
    }
    return 'price';
  }

  function checkUnitAmbiguity(hintValue, baselinePrice) {
    // U-EO-1: 0 < value < 1 && baselinePrice >= 10 → AMBIGUOUS
    if (typeof hintValue !== 'number' || !isFinite(hintValue)) return { ambiguous: false, skipped: false };
    if (!isNumericPrice(baselinePrice) || baselinePrice < 10) {
      return { ambiguous: false, skipped: true };
    }
    if (hintValue > 0 && hintValue < 1) return { ambiguous: true, skipped: false };
    return { ambiguous: false, skipped: false };
  }

  function getTargetRefs(operationPacket, cfg, ctx) {
    var refs = {
      targetValue: null,
      targetPct: null,
      source: null,
      sourceUnit: 'price',
      unitAmbiguous: false
    };
    var op = operationPacket;
    var es = (isPlainObject(op) && isPlainObject(op.evaluationSeed)) ? op.evaluationSeed : null;
    var np = (isPlainObject(op) && isPlainObject(op.notificationPacket)) ? op.notificationPacket : null;

    // U-EO-2: evaluationSeed.targetHints 첫 numeric TARGET
    if (es && Array.isArray(es.targetHints)) {
      for (var i = 0; i < es.targetHints.length; i = i + 1) {
        var h = es.targetHints[i];
        if (!isPlainObject(h)) continue;
        if (h.type !== 'TARGET') continue;
        if (!(typeof h.value === 'number' && isFinite(h.value))) continue;
        var u1 = classifyHintUnit(h);
        var amb1 = checkUnitAmbiguity(h.value, ctx ? ctx.baselinePrice : null);
        if (amb1.ambiguous) refs.unitAmbiguous = true;
        if (u1 === 'pct') {
          refs.targetPct = h.value;
        } else {
          refs.targetValue = h.value;
        }
        refs.sourceUnit = u1;
        refs.source = 'evaluationSeed.targetHints';
        return refs;
      }
    }

    // safeHints TARGET
    if (np && Array.isArray(np.safeHints)) {
      for (var j = 0; j < np.safeHints.length; j = j + 1) {
        var sh = np.safeHints[j];
        if (!isPlainObject(sh)) continue;
        if (sh.type !== 'TARGET') continue;
        if (!(typeof sh.value === 'number' && isFinite(sh.value))) continue;
        var u2 = classifyHintUnit(sh);
        var amb2 = checkUnitAmbiguity(sh.value, ctx ? ctx.baselinePrice : null);
        if (amb2.ambiguous) refs.unitAmbiguous = true;
        if (u2 === 'pct') {
          refs.targetPct = sh.value;
        } else {
          refs.targetValue = sh.value;
        }
        refs.sourceUnit = u2;
        refs.source = 'notificationPacket.safeHints';
        return refs;
      }
    }

    // config fallback (pct)
    if (cfg && cfg.thresholds && isNumericPct(cfg.thresholds.planTargetPct)) {
      refs.targetPct = cfg.thresholds.planTargetPct;
      refs.sourceUnit = 'pct';
      refs.source = 'cfg.thresholds.planTargetPct';
      return refs;
    }
    return refs;
  }

  function getInvalidationRefs(operationPacket, cfg, ctx) {
    var refs = {
      invalidationValue: null,
      invalidationPct: null,
      source: null,
      sourceUnit: 'price',
      unitAmbiguous: false
    };
    var op = operationPacket;
    var es = (isPlainObject(op) && isPlainObject(op.evaluationSeed)) ? op.evaluationSeed : null;
    var np = (isPlainObject(op) && isPlainObject(op.notificationPacket)) ? op.notificationPacket : null;

    // U-EO-2 priority 1: evaluationSeed.invalidationHints type='INVALIDATION'
    if (es && Array.isArray(es.invalidationHints)) {
      for (var i = 0; i < es.invalidationHints.length; i = i + 1) {
        var h = es.invalidationHints[i];
        if (!isPlainObject(h)) continue;
        if (h.type !== 'INVALIDATION') continue;
        if (!(typeof h.value === 'number' && isFinite(h.value))) continue;
        var u1 = classifyHintUnit(h);
        var amb1 = checkUnitAmbiguity(h.value, ctx ? ctx.baselinePrice : null);
        if (amb1.ambiguous) refs.unitAmbiguous = true;
        if (u1 === 'pct') refs.invalidationPct = h.value;
        else refs.invalidationValue = h.value;
        refs.sourceUnit = u1;
        refs.source = 'evaluationSeed.invalidationHints:INVALIDATION';
        return refs;
      }
      // U-EO-2 priority 2: SETUP_INVALIDATION
      for (var k = 0; k < es.invalidationHints.length; k = k + 1) {
        var hs = es.invalidationHints[k];
        if (!isPlainObject(hs)) continue;
        if (hs.type !== 'SETUP_INVALIDATION') continue;
        if (!(typeof hs.value === 'number' && isFinite(hs.value))) continue;
        var u2 = classifyHintUnit(hs);
        var amb2 = checkUnitAmbiguity(hs.value, ctx ? ctx.baselinePrice : null);
        if (amb2.ambiguous) refs.unitAmbiguous = true;
        if (u2 === 'pct') refs.invalidationPct = hs.value;
        else refs.invalidationValue = hs.value;
        refs.sourceUnit = u2;
        refs.source = 'evaluationSeed.invalidationHints:SETUP_INVALIDATION';
        return refs;
      }
    }

    // safeHints INVALIDATION
    if (np && Array.isArray(np.safeHints)) {
      for (var j = 0; j < np.safeHints.length; j = j + 1) {
        var sh = np.safeHints[j];
        if (!isPlainObject(sh)) continue;
        if (sh.type !== 'INVALIDATION') continue;
        if (!(typeof sh.value === 'number' && isFinite(sh.value))) continue;
        var u3 = classifyHintUnit(sh);
        var amb3 = checkUnitAmbiguity(sh.value, ctx ? ctx.baselinePrice : null);
        if (amb3.ambiguous) refs.unitAmbiguous = true;
        if (u3 === 'pct') refs.invalidationPct = sh.value;
        else refs.invalidationValue = sh.value;
        refs.sourceUnit = u3;
        refs.source = 'notificationPacket.safeHints:INVALIDATION';
        return refs;
      }
    }

    // config fallback
    if (cfg && cfg.thresholds && isNumericPct(cfg.thresholds.invalidationPct)) {
      refs.invalidationPct = cfg.thresholds.invalidationPct;
      refs.sourceUnit = 'pct';
      refs.source = 'cfg.thresholds.invalidationPct';
      return refs;
    }
    return refs;
  }

  // ==========================================================================
  // §checkTarget (Gate 2 spec §9)
  // ==========================================================================
  function checkTarget(priceBasis, movement, targetRefs, observation, cfg) {
    var ctx = {
      targetHit: false,
      targetHitType: HIT_TYPE.NONE,
      targetValue: targetRefs ? targetRefs.targetValue : null,
      targetPct: targetRefs ? targetRefs.targetPct : null,
      targetHitTs: null,
      reasons: [],
      warnings: []
    };

    var byValue = false;
    var byPct = false;

    if (targetRefs && typeof targetRefs.targetValue === 'number' && isFinite(targetRefs.targetValue)
        && priceBasis && isNumericPrice(priceBasis.highPrice)
        && priceBasis.highPrice >= targetRefs.targetValue) {
      byValue = true;
      pushReason(ctx, 'TARGET_BY_VALUE');
    }

    if (targetRefs && isNumericPct(targetRefs.targetPct)
        && movement && isNumericPct(movement.maxFavorablePct)
        && movement.maxFavorablePct >= targetRefs.targetPct) {
      byPct = true;
      pushReason(ctx, 'TARGET_BY_PCT');
    }

    ctx.targetHit = byValue || byPct;
    if (byValue && byPct) ctx.targetHitType = HIT_TYPE.BY_BOTH;
    else if (byValue) ctx.targetHitType = HIT_TYPE.BY_VALUE;
    else if (byPct) ctx.targetHitType = HIT_TYPE.BY_PCT;

    if (ctx.targetHit && isPlainObject(observation)
        && typeof observation.highTs === 'number' && isFinite(observation.highTs)) {
      ctx.targetHitTs = observation.highTs;
    }

    if (targetRefs && targetRefs.unitAmbiguous === true) {
      pushWarning(ctx, 'UNIT_AMBIGUOUS', 'target');
    }

    return ctx;
  }

  // ==========================================================================
  // §checkInvalidation (Gate 2 spec §9)
  // ==========================================================================
  function checkInvalidation(priceBasis, movement, invalidationRefs, observation, cfg) {
    var ctx = {
      invalidated: false,
      invalidationType: HIT_TYPE.NONE,
      invalidationValue: invalidationRefs ? invalidationRefs.invalidationValue : null,
      invalidationPct: invalidationRefs ? invalidationRefs.invalidationPct : null,
      invalidatedTs: null,
      reasons: [],
      warnings: []
    };

    var byValue = false;
    var byPct = false;

    if (invalidationRefs && typeof invalidationRefs.invalidationValue === 'number'
        && isFinite(invalidationRefs.invalidationValue)
        && priceBasis && isNumericPrice(priceBasis.lowPrice)
        && priceBasis.lowPrice <= invalidationRefs.invalidationValue) {
      byValue = true;
      pushReason(ctx, 'INVALIDATION_BY_VALUE');
    }

    if (invalidationRefs && isNumericPct(invalidationRefs.invalidationPct)
        && movement && isNumericPct(movement.maxAdversePct)
        && movement.maxAdversePct <= invalidationRefs.invalidationPct) {
      byPct = true;
      pushReason(ctx, 'INVALIDATION_BY_PCT');
    }

    ctx.invalidated = byValue || byPct;
    if (byValue && byPct) ctx.invalidationType = HIT_TYPE.BY_BOTH;
    else if (byValue) ctx.invalidationType = HIT_TYPE.BY_VALUE;
    else if (byPct) ctx.invalidationType = HIT_TYPE.BY_PCT;

    if (ctx.invalidated && isPlainObject(observation)
        && typeof observation.lowTs === 'number' && isFinite(observation.lowTs)) {
      ctx.invalidatedTs = observation.lowTs;
    }

    if (invalidationRefs && invalidationRefs.unitAmbiguous === true) {
      pushWarning(ctx, 'UNIT_AMBIGUOUS', 'invalidation');
    }

    return ctx;
  }

  // ==========================================================================
  // §detectPathOrder (Gate 2 spec §10 / U-EO-3)
  // ==========================================================================
  function detectPathOrder(targetCheck, invalidationCheck, observation, cfg) {
    var ctx = {
      pathOrderKnown: false,
      firstEvent: PATH_FIRST_EVENT.NONE,
      ambiguous: false,
      reason: null,
      warnings: []
    };

    if (!targetCheck || !invalidationCheck) return ctx;
    if (!(targetCheck.targetHit === true && invalidationCheck.invalidated === true)) {
      // 둘 다 hit 아닐 때 — 단일 event 분기는 resultType 분류에서 처리
      if (targetCheck.targetHit === true) {
        ctx.firstEvent = PATH_FIRST_EVENT.TARGET;
        ctx.pathOrderKnown = true;
      } else if (invalidationCheck.invalidated === true) {
        ctx.firstEvent = PATH_FIRST_EVENT.INVALIDATION;
        ctx.pathOrderKnown = true;
      }
      return ctx;
    }

    var hTs = (isPlainObject(observation) && typeof observation.highTs === 'number' && isFinite(observation.highTs))
      ? observation.highTs : null;
    var lTs = (isPlainObject(observation) && typeof observation.lowTs === 'number' && isFinite(observation.lowTs))
      ? observation.lowTs : null;

    if (hTs === null || lTs === null) {
      ctx.ambiguous = true;
      ctx.reason = 'PATH_ORDER_UNKNOWN';
      pushWarning(ctx, 'PATH_ORDER_UNKNOWN');
      return ctx;
    }

    if (hTs < lTs) {
      ctx.pathOrderKnown = true;
      ctx.firstEvent = PATH_FIRST_EVENT.TARGET;
      ctx.reason = 'TARGET_HIT_BEFORE_INVALIDATION';
      return ctx;
    }
    if (hTs > lTs) {
      ctx.pathOrderKnown = true;
      ctx.firstEvent = PATH_FIRST_EVENT.INVALIDATION;
      ctx.reason = 'INVALIDATION_BEFORE_TARGET';
      return ctx;
    }
    // hTs === lTs
    ctx.ambiguous = true;
    ctx.reason = 'SIMULTANEOUS_HIGH_LOW';
    pushWarning(ctx, 'SIMULTANEOUS_HIGH_LOW');
    return ctx;
  }

  // ==========================================================================
  // §classifyStatus (Gate 2 spec §6 — 6 priority steps)
  // ==========================================================================
  function classifyStatus(inputs, checks, cfg) {
    var op = inputs.operationPacket;
    var ac = inputs.activeCycleDecision;
    var obs = inputs.evaluationObservation;
    var candidateKey = inputs.candidateKey;

    var opValid = isPlainObject(op) && op.valid === true;
    var acValid = isPlainObject(ac) && ac.valid === true;
    var hasKey = typeof candidateKey === 'string' && candidateKey;

    // 1. INVALID
    if (!opValid || !acValid || !hasKey) return STATUS.INVALID;

    // 2. CLOSED
    var lcState = (isPlainObject(ac.lifecycle) && typeof ac.lifecycle.lifecycleState === 'string')
      ? ac.lifecycle.lifecycleState : null;
    var evalMode = (isPlainObject(ac.evaluationPolicy) && typeof ac.evaluationPolicy.evaluationMode === 'string')
      ? ac.evaluationPolicy.evaluationMode : null;
    if (lcState === 'EXPIRED' || evalMode === 'CLOSE') return STATUS.CLOSED;

    var obsValid = isPlainObject(obs) && obs.valid === true;
    var obsComplete = obsValid && obs.complete === true;
    var targetHit = checks && checks.targetCheck && checks.targetCheck.targetHit === true;
    var invalidated = checks && checks.invalidationCheck && checks.invalidationCheck.invalidated === true;

    // 3. COMPLETED
    if (obsComplete || targetHit || invalidated) return STATUS.COMPLETED;

    // 4. IN_PROGRESS
    if (obsValid && !obsComplete && !targetHit && !invalidated) return STATUS.IN_PROGRESS;

    // 5. PENDING
    if (!isPlainObject(obs) || obs.valid !== true) return STATUS.PENDING;

    // 6. UNKNOWN
    return STATUS.UNKNOWN;
  }

  // ==========================================================================
  // §classifyResultType (Gate 2 spec §7 — 11 priority steps)
  // ==========================================================================
  function classifyResultType(inputs, checks, movement, pathOrder, cfg) {
    var op = inputs.operationPacket;
    var ac = inputs.activeCycleDecision;
    var obs = inputs.evaluationObservation;
    var priceBasis = inputs.priceBasis;
    var evalType = inputs.evaluationType;

    var baselineOK = isNumericPrice(priceBasis ? priceBasis.baselinePrice : null);
    var hasAnyPrice = priceBasis && (isNumericPrice(priceBasis.currentPrice)
                                     || isNumericPrice(priceBasis.highPrice)
                                     || isNumericPrice(priceBasis.lowPrice)
                                     || isNumericPrice(priceBasis.closePrice));

    // 1. DATA_INSUFFICIENT
    if (!baselineOK || !hasAnyPrice) return RESULT_TYPE.DATA_INSUFFICIENT;

    var lcState = (isPlainObject(ac) && isPlainObject(ac.lifecycle)
                    && typeof ac.lifecycle.lifecycleState === 'string')
      ? ac.lifecycle.lifecycleState : null;
    var seedEvalType = (isPlainObject(op) && isPlainObject(op.evaluationSeed)
                        && typeof op.evaluationSeed.evaluationType === 'string')
      ? op.evaluationSeed.evaluationType : null;

    // 2. EXPIRED_REVIEW
    if (seedEvalType === 'EXPIRED_REVIEW' || lcState === 'EXPIRED') return RESULT_TYPE.EXPIRED_REVIEW;

    // 3. COOLDOWN_REVIEW
    if (seedEvalType === 'COOLDOWN_REVIEW' || lcState === 'COOLDOWN') return RESULT_TYPE.COOLDOWN_REVIEW;

    var targetHit = checks && checks.targetCheck && checks.targetCheck.targetHit === true;
    var invalidated = checks && checks.invalidationCheck && checks.invalidationCheck.invalidated === true;
    var pathKnown = pathOrder && pathOrder.pathOrderKnown === true;
    var firstEvent = pathOrder ? pathOrder.firstEvent : 'NONE';

    // 4. DATA_AMBIGUOUS (U-EO-3: pathOrderKnown !== true 일 때만)
    if (targetHit && invalidated && pathKnown !== true) {
      return RESULT_TYPE.DATA_AMBIGUOUS;
    }

    // 5. INVALIDATED
    if (invalidated && !targetHit) return RESULT_TYPE.INVALIDATED;
    if (targetHit && invalidated && pathKnown === true && firstEvent === PATH_FIRST_EVENT.INVALIDATION) {
      return RESULT_TYPE.INVALIDATED;
    }

    // 6. TARGET_HIT
    if (targetHit && !invalidated) return RESULT_TYPE.TARGET_HIT;
    if (targetHit && invalidated && pathKnown === true && firstEvent === PATH_FIRST_EVENT.TARGET) {
      return RESULT_TYPE.TARGET_HIT;
    }

    var obsComplete = isPlainObject(obs) && obs.complete === true;
    var maxFav = movement ? movement.maxFavorablePct : null;
    var watchConfirmPct = cfg && cfg.thresholds ? cfg.thresholds.watchConfirmPct : null;

    // 7. WATCH_CONFIRMED
    if (evalType === 'WATCH_24H' && isNumericPct(maxFav) && isNumericPct(watchConfirmPct)
        && maxFav >= watchConfirmPct) {
      return RESULT_TYPE.WATCH_CONFIRMED;
    }

    // 8. WATCH_FAILED
    if (evalType === 'WATCH_24H' && obsComplete && isNumericPct(maxFav) && isNumericPct(watchConfirmPct)
        && maxFav < watchConfirmPct) {
      return RESULT_TYPE.WATCH_FAILED;
    }

    // 9. NEUTRAL
    if (obsComplete) return RESULT_TYPE.NEUTRAL;

    // 10. IN_PROGRESS
    if (!obsComplete) return RESULT_TYPE.IN_PROGRESS;

    // 11. NONE
    return RESULT_TYPE.NONE;
  }

  // ==========================================================================
  // §classifyResultPhase
  // ==========================================================================
  function classifyResultPhase(status, resultType, observation, cfg) {
    if (resultType === RESULT_TYPE.EXPIRED_REVIEW
        || resultType === RESULT_TYPE.COOLDOWN_REVIEW) return RESULT_PHASE.REVIEW;
    if (status === STATUS.COMPLETED || status === STATUS.CLOSED) return RESULT_PHASE.DONE;
    if (status === STATUS.IN_PROGRESS) {
      var bars = (isPlainObject(observation) && typeof observation.observedBars === 'number')
        ? observation.observedBars : 0;
      if (bars <= 2) return RESULT_PHASE.EARLY;
      if (bars <= 6) return RESULT_PHASE.MID;
      return RESULT_PHASE.LATE;
    }
    return RESULT_PHASE.NONE;
  }

  // ==========================================================================
  // §classifyOutcomeQuality
  // ==========================================================================
  function classifyOutcomeQuality(inputs, movement, checks, cfg) {
    var ctx = {
      outcomeQuality: OUTCOME_QUALITY.UNKNOWN,
      confidence: 0,
      enoughObservation: false,
      dataWarnings: []
    };

    var priceBasis = inputs.priceBasis;
    var obs = inputs.evaluationObservation;

    var hasBaseline = isNumericPrice(priceBasis ? priceBasis.baselinePrice : null);
    var pricesAvailable = 0;
    if (priceBasis) {
      if (isNumericPrice(priceBasis.currentPrice)) pricesAvailable = pricesAvailable + 1;
      if (isNumericPrice(priceBasis.highPrice)) pricesAvailable = pricesAvailable + 1;
      if (isNumericPrice(priceBasis.lowPrice)) pricesAvailable = pricesAvailable + 1;
      if (isNumericPrice(priceBasis.closePrice)) pricesAvailable = pricesAvailable + 1;
    }

    var observedBars = (isPlainObject(obs) && typeof obs.observedBars === 'number') ? obs.observedBars : 0;
    var minBars = (cfg && cfg.thresholds && isNumericPct(cfg.thresholds.minObservationBars))
      ? cfg.thresholds.minObservationBars : 1;
    ctx.enoughObservation = observedBars >= minBars;

    if (!hasBaseline) {
      ctx.outcomeQuality = OUTCOME_QUALITY.LOW;
      ctx.confidence = 0;
      pushWarning(ctx, 'NO_BASELINE_PRICE');
      ctx.dataWarnings.push('NO_BASELINE_PRICE');
      return ctx;
    }
    if (pricesAvailable === 0) {
      ctx.outcomeQuality = OUTCOME_QUALITY.LOW;
      ctx.confidence = 10;
      pushWarning(ctx, 'NO_OBSERVED_PRICES');
      ctx.dataWarnings.push('NO_OBSERVED_PRICES');
      return ctx;
    }
    if (!ctx.enoughObservation) {
      ctx.outcomeQuality = OUTCOME_QUALITY.LOW;
      ctx.confidence = 25;
      pushWarning(ctx, 'NOT_ENOUGH_OBSERVATION');
      ctx.dataWarnings.push('NOT_ENOUGH_OBSERVATION');
      return ctx;
    }

    if (pricesAvailable >= 4 && observedBars >= minBars) {
      ctx.outcomeQuality = OUTCOME_QUALITY.HIGH;
      ctx.confidence = 80;
    } else if (pricesAvailable >= 2) {
      ctx.outcomeQuality = OUTCOME_QUALITY.MEDIUM;
      ctx.confidence = 55;
    } else {
      ctx.outcomeQuality = OUTCOME_QUALITY.LOW;
      ctx.confidence = 30;
    }

    // checks 의 unit ambiguity warning 누적
    if (checks && checks.targetCheck && Array.isArray(checks.targetCheck.warnings)) {
      for (var i = 0; i < checks.targetCheck.warnings.length; i = i + 1) {
        ctx.dataWarnings.push('TARGET:' + checks.targetCheck.warnings[i]);
      }
    }
    if (checks && checks.invalidationCheck && Array.isArray(checks.invalidationCheck.warnings)) {
      for (var j = 0; j < checks.invalidationCheck.warnings.length; j = j + 1) {
        ctx.dataWarnings.push('INVALIDATION:' + checks.invalidationCheck.warnings[j]);
      }
    }

    return ctx;
  }

  // ==========================================================================
  // §buildRoutingDecision (Gate 2 spec §13)
  // ==========================================================================
  function buildRoutingDecision(status, resultType, quality, cfg) {
    var ctx = {
      shouldStoreOutcome: false,
      shouldUpdateEvaluation: false,
      shouldCloseEvaluation: false,
      shouldReview: false,
      reasons: [],
      warnings: []
    };

    // shouldStoreOutcome
    if (status === STATUS.IN_PROGRESS && cfg.routing.storeInProgress === true) {
      ctx.shouldStoreOutcome = true;
      pushReason(ctx, 'STORE_IN_PROGRESS');
    } else if ((status === STATUS.COMPLETED || status === STATUS.CLOSED)
               && cfg.routing.storeCompleted === true) {
      ctx.shouldStoreOutcome = true;
      pushReason(ctx, 'STORE_COMPLETED');
    }

    // shouldUpdateEvaluation
    if ((status === STATUS.IN_PROGRESS || status === STATUS.COMPLETED)
        && resultType !== RESULT_TYPE.DATA_INSUFFICIENT) {
      ctx.shouldUpdateEvaluation = true;
      pushReason(ctx, 'UPDATE_EVALUATION');
    }

    // shouldCloseEvaluation
    if (resultType === RESULT_TYPE.TARGET_HIT && cfg.routing.closeOnTargetHit === true) {
      ctx.shouldCloseEvaluation = true;
      pushReason(ctx, 'CLOSE_TARGET_HIT');
    } else if (resultType === RESULT_TYPE.INVALIDATED && cfg.routing.closeOnInvalidated === true) {
      ctx.shouldCloseEvaluation = true;
      pushReason(ctx, 'CLOSE_INVALIDATED');
    } else if (resultType === RESULT_TYPE.EXPIRED_REVIEW && cfg.routing.reviewExpired === true) {
      ctx.shouldCloseEvaluation = true;
      pushReason(ctx, 'CLOSE_EXPIRED');
    }

    // shouldReview
    if (resultType === RESULT_TYPE.COOLDOWN_REVIEW
        || resultType === RESULT_TYPE.EXPIRED_REVIEW
        || resultType === RESULT_TYPE.DATA_AMBIGUOUS) {
      ctx.shouldReview = true;
      pushReason(ctx, 'REVIEW_' + resultType);
    }

    return ctx;
  }

  // ==========================================================================
  // §buildNextEvaluationState (Gate 2 spec §18 / DP-EO10 / DP-EO14)
  //   N-EO-OBS-1 timestamp 정책:
  //     startTs: operationPacket.evaluationSeed.startTs → observation.startTs →
  //              previousEvaluationState.startTs → null
  //     lastObservedTs: observation.endTs → observation.closeTs →
  //                     previousEvaluationState.lastObservedTs → null
  // ==========================================================================
  function pickStartTs(operationPacket, observation, prevNorm) {
    if (isPlainObject(operationPacket) && isPlainObject(operationPacket.evaluationSeed)
        && typeof operationPacket.evaluationSeed.startTs === 'number'
        && isFinite(operationPacket.evaluationSeed.startTs)) {
      return operationPacket.evaluationSeed.startTs;
    }
    if (isPlainObject(observation) && typeof observation.startTs === 'number'
        && isFinite(observation.startTs)) {
      return observation.startTs;
    }
    if (prevNorm && typeof prevNorm.startTs === 'number' && isFinite(prevNorm.startTs)) {
      return prevNorm.startTs;
    }
    return null;
  }

  function pickLastObservedTs(observation, prevNorm) {
    if (isPlainObject(observation) && typeof observation.endTs === 'number'
        && isFinite(observation.endTs)) {
      return observation.endTs;
    }
    if (isPlainObject(observation) && typeof observation.closeTs === 'number'
        && isFinite(observation.closeTs)) {
      return observation.closeTs;
    }
    if (prevNorm && typeof prevNorm.lastObservedTs === 'number' && isFinite(prevNorm.lastObservedTs)) {
      return prevNorm.lastObservedTs;
    }
    return null;
  }

  function buildNextEvaluationState(inputs, status, resultType, movement, checks, cfg) {
    var op = inputs.operationPacket;
    var obs = inputs.evaluationObservation;
    var prevNorm = inputs.previousEvaluationStateNorm;

    var startTs = pickStartTs(op, obs, prevNorm);
    var lastObservedTs = pickLastObservedTs(obs, prevNorm);
    var completedTs = null;
    if (status === STATUS.COMPLETED || status === STATUS.CLOSED) {
      if (typeof lastObservedTs === 'number' && isFinite(lastObservedTs)) completedTs = lastObservedTs;
      else if (prevNorm && typeof prevNorm.completedTs === 'number' && isFinite(prevNorm.completedTs)) {
        completedTs = prevNorm.completedTs;
      }
    } else if (prevNorm && typeof prevNorm.completedTs === 'number' && isFinite(prevNorm.completedTs)) {
      completedTs = prevNorm.completedTs;
    }

    var baselinePrice = isNumericPrice(inputs.priceBasis ? inputs.priceBasis.baselinePrice : null)
      ? inputs.priceBasis.baselinePrice : (prevNorm ? prevNorm.baselinePrice : null);

    var lastPrice = null;
    if (isPlainObject(inputs.priceBasis)) {
      if (isNumericPrice(inputs.priceBasis.closePrice)) lastPrice = inputs.priceBasis.closePrice;
      else if (isNumericPrice(inputs.priceBasis.currentPrice)) lastPrice = inputs.priceBasis.currentPrice;
    }
    if (lastPrice === null && prevNorm && isNumericPrice(prevNorm.lastPrice)) lastPrice = prevNorm.lastPrice;

    var targetHit = checks && checks.targetCheck && checks.targetCheck.targetHit === true;
    var invalidated = checks && checks.invalidationCheck && checks.invalidationCheck.invalidated === true;
    if (!targetHit && prevNorm && prevNorm.targetHit === true) targetHit = true;
    if (!invalidated && prevNorm && prevNorm.invalidated === true) invalidated = true;

    return {
      valid: true,
      candidateKey: inputs.candidateKey,
      evaluationType: inputs.evaluationType,
      window: inputs.evaluationWindow,
      status: status,
      resultType: resultType,
      startTs: startTs,
      lastObservedTs: lastObservedTs,
      completedTs: completedTs,
      baselinePrice: baselinePrice,
      lastPrice: lastPrice,
      maxFavorablePct: movement ? movement.maxFavorablePct : null,
      maxAdversePct: movement ? movement.maxAdversePct : null,
      targetHit: targetHit === true,
      invalidated: invalidated === true,
      reasons: [],
      warnings: []
    };
  }

  // ==========================================================================
  // §normalize 출력
  // ==========================================================================
  function normalizeEvaluationOutcome(result) {
    return {
      valid: result.valid === true,
      version: EVALUATION_OUTCOME_VERSION,
      candidateKey: typeof result.candidateKey === 'string' ? result.candidateKey : null,
      identity: result.identity,
      evaluation: result.evaluation,
      priceBasis: result.priceBasis,
      movement: result.movement,
      targetCheck: result.targetCheck,
      invalidationCheck: result.invalidationCheck,
      pathOrder: result.pathOrder,
      quality: result.quality,
      routingDecision: result.routingDecision,
      nextEvaluationState: result.nextEvaluationState,
      reasons: Array.isArray(result.reasons) ? result.reasons.slice() : [],
      warnings: Array.isArray(result.warnings) ? result.warnings.slice() : [],
      debug: result.debug,
      configUsed: result.configUsed
    };
  }

  // ==========================================================================
  // §main — buildEvaluationOutcome
  // ==========================================================================
  /**
   * operationPacket + activeCycleDecision + evaluationObservation +
   * previousEvaluationState → standalone evaluationOutcome. 4종 입력 mutate 0건 (DP-EO1).
   *
   * @param {Object} operationPacket
   * @param {Object} activeCycleDecision
   * @param {Object} [evaluationObservation]
   * @param {Object} [previousEvaluationState]
   * @param {Object} [config]
   * @return {Object} evaluationOutcome
   */
  function buildEvaluationOutcome(operationPacket, activeCycleDecision, evaluationObservation, previousEvaluationState, config) {
    var cfg = mergeEvaluationOutcomeConfig(config);
    var configUsed = makeConfigUsed(cfg);

    var topWarnings = [];
    if (!isPlainObject(operationPacket)) topWarnings.push('OPERATION_PACKET_NOT_OBJECT');
    if (!isPlainObject(activeCycleDecision)) topWarnings.push('ACTIVE_CYCLE_DECISION_NOT_OBJECT');

    var candidateKey = getCandidateKey(operationPacket, activeCycleDecision, evaluationObservation);
    var identity = getIdentity(operationPacket, activeCycleDecision);
    var evaluationType = getEvaluationType(operationPacket);
    var evaluationWindow = getEvaluationWindow(operationPacket, evaluationObservation);

    var baselinePrice = getBaselinePrice(operationPacket, evaluationObservation);
    var obsPrices = getObservationPrices(evaluationObservation);

    var priceBasis = {
      baselinePrice: baselinePrice,
      currentPrice: obsPrices.currentPrice,
      highPrice: obsPrices.highPrice,
      lowPrice: obsPrices.lowPrice,
      closePrice: obsPrices.closePrice
    };

    var prevNorm = normalizePreviousEvaluationState(previousEvaluationState);

    // movement
    var movement = calculateMovement(priceBasis, prevNorm);

    // target / invalidation refs
    var refsCtx = { baselinePrice: baselinePrice };
    var targetRefs = getTargetRefs(operationPacket, cfg, refsCtx);
    var invalidationRefs = getInvalidationRefs(operationPacket, cfg, refsCtx);

    // checks
    var targetCheck = checkTarget(priceBasis, movement, targetRefs, evaluationObservation, cfg);
    var invalidationCheck = checkInvalidation(priceBasis, movement, invalidationRefs, evaluationObservation, cfg);

    // pathOrder (U-EO-3)
    var pathOrder = detectPathOrder(targetCheck, invalidationCheck, evaluationObservation, cfg);

    var inputs = {
      operationPacket: operationPacket,
      activeCycleDecision: activeCycleDecision,
      evaluationObservation: evaluationObservation,
      previousEvaluationStateNorm: prevNorm,
      candidateKey: candidateKey,
      identity: identity,
      evaluationType: evaluationType,
      evaluationWindow: evaluationWindow,
      priceBasis: priceBasis
    };
    var checks = { targetCheck: targetCheck, invalidationCheck: invalidationCheck };

    // status / resultType / phase / quality
    var status = classifyStatus(inputs, checks, cfg);
    var resultType = classifyResultType(inputs, checks, movement, pathOrder, cfg);
    var resultPhase = classifyResultPhase(status, resultType, evaluationObservation, cfg);
    var quality = classifyOutcomeQuality(inputs, movement, checks, cfg);

    // routingDecision
    var routingDecision = buildRoutingDecision(status, resultType, quality, cfg);

    // nextEvaluationState
    var nextEvaluationState = buildNextEvaluationState(inputs, status, resultType, movement, checks, cfg);

    // evaluation 객체
    var evaluation = {
      evaluationType: evaluationType,
      window: evaluationWindow,
      status: status,
      resultType: resultType,
      resultPhase: resultPhase,
      complete: (isPlainObject(evaluationObservation) && evaluationObservation.complete === true)
                || status === STATUS.COMPLETED || status === STATUS.CLOSED,
      startTs: nextEvaluationState.startTs,
      endTs: nextEvaluationState.lastObservedTs
    };

    // top-level reasons / warnings
    var topReasons = [];
    topReasons.push('STATUS_' + status);
    topReasons.push('RESULT_TYPE_' + resultType);
    topReasons.push('RESULT_PHASE_' + resultPhase);
    if (candidateKey === null) topWarnings.push('CANDIDATE_KEY_MISSING');
    if (targetRefs && targetRefs.unitAmbiguous === true) topWarnings.push('UNIT_AMBIGUOUS:target');
    if (invalidationRefs && invalidationRefs.unitAmbiguous === true) topWarnings.push('UNIT_AMBIGUOUS:invalidation');

    var valid = isPlainObject(operationPacket)
                && isPlainObject(activeCycleDecision)
                && typeof candidateKey === 'string' && candidateKey
                && status !== STATUS.INVALID;

    return normalizeEvaluationOutcome({
      valid: valid,
      candidateKey: candidateKey,
      identity: identity,
      evaluation: evaluation,
      priceBasis: priceBasis,
      movement: movement,
      targetCheck: targetCheck,
      invalidationCheck: invalidationCheck,
      pathOrder: pathOrder,
      quality: quality,
      routingDecision: routingDecision,
      nextEvaluationState: nextEvaluationState,
      reasons: topReasons,
      warnings: topWarnings,
      debug: {
        source: 'operationPacket + activeCycleDecision + evaluationObservation + previousEvaluationState',
        configVersion: cfg.version
      },
      configUsed: configUsed
    });
  }

  // ==========================================================================
  // §export — 이중 환경
  // ==========================================================================
  var api = Object.freeze({
    EVALUATION_OUTCOME_VERSION: EVALUATION_OUTCOME_VERSION,
    CONFIG_VERSION: CONFIG_VERSION,
    DEFAULT_EVALUATION_OUTCOME_CONFIG: DEFAULT_EVALUATION_OUTCOME_CONFIG,

    STATUS: STATUS,
    RESULT_TYPE: RESULT_TYPE,
    RESULT_PHASE: RESULT_PHASE,
    OUTCOME_QUALITY: OUTCOME_QUALITY,
    WINDOW: WINDOW,
    HIT_TYPE: HIT_TYPE,
    PATH_FIRST_EVENT: PATH_FIRST_EVENT,

    build: buildEvaluationOutcome,
    mergeEvaluationOutcomeConfig: mergeEvaluationOutcomeConfig,

    getCandidateKey: getCandidateKey,
    getIdentity: getIdentity,
    getEvaluationType: getEvaluationType,
    getEvaluationWindow: getEvaluationWindow,
    getBaselinePrice: getBaselinePrice,
    getObservationPrices: getObservationPrices,
    normalizePreviousEvaluationState: normalizePreviousEvaluationState,

    calculateMovement: calculateMovement,
    getTargetRefs: getTargetRefs,
    getInvalidationRefs: getInvalidationRefs,
    checkTarget: checkTarget,
    checkInvalidation: checkInvalidation,
    detectPathOrder: detectPathOrder,

    classifyStatus: classifyStatus,
    classifyResultType: classifyResultType,
    classifyResultPhase: classifyResultPhase,
    classifyOutcomeQuality: classifyOutcomeQuality,

    buildRoutingDecision: buildRoutingDecision,
    buildNextEvaluationState: buildNextEvaluationState,

    isNumericPrice: isNumericPrice,
    isNumericPct: isNumericPct,
    safePct: safePct,
    normalizeEvaluationOutcome: normalizeEvaluationOutcome,
    pushReason: pushReason,
    pushWarning: pushWarning
  });

  global.WS3_EvaluationOutcome = api;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis
   : typeof window !== 'undefined' ? window
   : typeof self !== 'undefined' ? self
   : this);
