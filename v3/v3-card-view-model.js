/**
 * WS3 v0.7.0 — CardViewModel
 *
 * Scope:
 *   V3FeaturePayload (c-r1)
 *   + scoreBreakdown (v0.3.0)
 *   + structureDecision (v0.4.0)
 *   + signalCycle (v0.5.0)
 *   + strategyPlan (v0.6.0)
 *   → standalone cardViewModel (UI-ready, 비-mutating, 비-렌더)
 *
 * 단일 기준 문서:
 *   docs/ws3/WS3_CODE_CONTRACT.md (b-r2 박제본)
 *
 * 주의 (U-STRAT-1 Option B 정합 유지):
 *   priceZone.zone 라벨은 'TOP_NEAR' / 'BOTTOM_NEAR' / 'MIDDLE' / 'UNKNOWN'.
 *   ABOVE_BOX 매핑은 structureDecision.structureBucket === 'ABOVE_BOX_CONFIRMED_CANDIDATE'.
 *
 * 확정 DP 정책 (r0.2-final 매핑):
 *   DP-UI1   standalone cardViewModel. 입력 5종 (payload / scoreBreakdown /
 *            structureDecision / signalCycle / strategyPlan) mutate / delete 금지.
 *   DP-UI2   DOM / HTML / renderer 작성 금지. 데이터 객체만 산출.
 *   DP-UI3   출력 7대 영역 구조 보장:
 *            identity + header + chips + metrics + sections + displayFlags + tone.
 *   DP-UI4   metrics 는 array. object 형태 metrics 금지.
 *            각 metric = { id, labelKey, labelKo, labelEn, value, kind, tone, sortKey }.
 *   DP-UI5   라벨은 labelKey + labelKo + labelEn 직접 포함.
 *            (chip / metric / badge 모두 동일 패턴.)
 *   DP-UI6   tone semantic token 사용. 색상 코드 / hex / inline style 금지.
 *            토큰 8종: positive / neutral / caution / warning / muted / info /
 *            critical / unknown.
 *   DP-UI7   showEntryPlan / showExitPlan boolean. displayFlags 에 위치.
 *            sections.strategy 외 numeric hint 노출 금지.
 *   DP-UI8   debug 기본 숨김 (cfg.sections.showDebug=false).
 *            raw payload / payload.raw / payload.raw.builderDebug 전체 직접 노출 금지.
 *            identityInput / candle raw array 직접 노출 영구 차단.
 *            cfg.debug.allowedFields whitelist 방식. 기본값 빈 배열.
 *   DP-UI9   sections 7개 생성:
 *            overview / score / structure / cycle / strategy / risk / debug.
 *   DP-UI10  P-S / P-A / P-B 최종 알림 등급 표시 금지. 등급 코드 / tier 라벨 외부 노출 X.
 *   DP-UI11  numeric hint (entryZone / invalidationHint / targetHint / penalty 등) 는
 *            sections.strategy / sections.risk 에서만 노출.
 *            header / chips / metrics 에 가격 숫자 직접 노출 금지.
 *
 * 부가:
 *   header.primaryBadge 는 strategyBias 우선 (cycleState override 금지). cycleState 는 chips.
 *   reasons / warnings 는 4종 산출 객체로부터 dedupe 누적.
 *   "매수하세요" / "매도하세요" 명령 어조 금지. 정보 전달 어조만.
 *   stopLossHint / takeProfitHint / buySignal / sellSignal / planGradeHint 등 구버전 라벨 금지.
 *
 * displayFlags (정확히 10 boolean keys — r0.2-final):
 *   isReady / isBlocked / isCooldown / isExpired / isWeakening /
 *   isHighActionability / showEntryPlan / showExitPlan / showRiskWarning / showDebug
 *
 * 금지 (이번 단계):
 *   실제 매수/매도 주문 실행. 외부 알림 발송 (별도 단계).
 *   DOM 트리 직접 조작 / HTML 문자열 생성 / event 바인딩.
 *   브라우저 영속 저장소 사용 / 네트워크 호출 / 파일 IO / KV.
 *   런타임 clock API 사용.
 *   입력 5종 mutation / delete.
 *   색상 코드 / hex / inline style.
 *   행동 지시 어조 ("매수하세요" / "매도하세요" 등).
 *   구버전 라벨 (구분 손절·익절 힌트 라벨, 매수·매도 신호 라벨, 등급 힌트 라벨).
 *   raw payload 객체 / payload.raw / payload.raw.builderDebug 전체 직접 노출.
 *   identityInput / candle raw array 직접 노출 (영구 차단 — whitelist 와 무관).
 *
 * 의존:
 *   payload          (v3-feature-payload-builder.js 산출)
 *   scoreBreakdown   (v3-score-breakdown.js, optional)
 *   structureDecision (v3-structure-bucket.js, optional)
 *   signalCycle      (v3-signal-cycle.js, optional)
 *   strategyPlan     (v3-strategy-plan.js, optional)
 */

(function (global) {
  'use strict';

  var CARD_VIEW_MODEL_VERSION = 'WS3_v0.7.0';
  var CONFIG_VERSION = 'inline-default-v0';

  // ==========================================================================
  // 의미 토큰 (DP-UI6)
  // ==========================================================================
  var TONE = Object.freeze({
    POSITIVE: 'positive',
    NEUTRAL: 'neutral',
    CAUTION: 'caution',
    WARNING: 'warning',
    MUTED: 'muted',
    INFO: 'info',
    CRITICAL: 'critical',
    UNKNOWN: 'unknown'
  });

  // ==========================================================================
  // 라벨 사전 (DP-UI5) — labelKey / labelKo / labelEn 직접 포함. 정보 전달 어조.
  // ==========================================================================
  var STRATEGY_BIAS_LABEL = Object.freeze({
    UNKNOWN:         { ko: '판단 보류',     en: 'Unknown',          tone: TONE.UNKNOWN },
    NO_TRADE:        { ko: '거래 대상 아님', en: 'No Trade',         tone: TONE.MUTED },
    WATCH_ONLY:      { ko: '관찰 우선',     en: 'Watch Only',       tone: TONE.NEUTRAL },
    PULLBACK_WAIT:   { ko: '눌림 대기',     en: 'Pullback Wait',    tone: TONE.INFO },
    BREAKOUT_READY:  { ko: '돌파 후보',     en: 'Breakout Ready',   tone: TONE.POSITIVE },
    RECLAIM_READY:   { ko: '되돌림 회복 후보', en: 'Reclaim Ready',   tone: TONE.POSITIVE },
    MOMENTUM_FOLLOW: { ko: '모멘텀 추세',   en: 'Momentum Follow',  tone: TONE.POSITIVE },
    RISK_OFF:        { ko: '리스크 우선',   en: 'Risk Off',         tone: TONE.WARNING },
    COOLDOWN_WAIT:   { ko: '냉각 대기',     en: 'Cooldown Wait',    tone: TONE.CAUTION },
    EXPIRED_IGNORE:  { ko: '만료 무시',     en: 'Expired Ignore',   tone: TONE.CRITICAL }
  });

  var CYCLE_STATE_LABEL = Object.freeze({
    UNKNOWN:        { ko: '사이클 미상',       en: 'Cycle Unknown',     tone: TONE.UNKNOWN },
    NEW_CANDIDATE:  { ko: '신규 후보',         en: 'New Candidate',     tone: TONE.INFO },
    STRENGTHENING:  { ko: '강화 중',           en: 'Strengthening',     tone: TONE.POSITIVE },
    PERSISTING:     { ko: '지속 중',           en: 'Persisting',        tone: TONE.NEUTRAL },
    WEAKENING:      { ko: '약화 중',           en: 'Weakening',         tone: TONE.WARNING },
    COOLDOWN:       { ko: '냉각',              en: 'Cooldown',          tone: TONE.CAUTION },
    EXPIRED:        { ko: '만료',              en: 'Expired',           tone: TONE.CRITICAL },
    RESET:          { ko: '초기화',            en: 'Reset',             tone: TONE.MUTED }
  });

  var CYCLE_PHASE_LABEL = Object.freeze({
    UNKNOWN: { ko: '단계 미상', en: 'Phase Unknown', tone: TONE.UNKNOWN },
    EARLY:   { ko: '초기',     en: 'Early',         tone: TONE.INFO },
    MID:     { ko: '중기',     en: 'Mid',           tone: TONE.NEUTRAL },
    LATE:    { ko: '후기',     en: 'Late',          tone: TONE.CAUTION },
    POST:    { ko: '사후',     en: 'Post',          tone: TONE.MUTED }
  });

  var ACTIONABILITY_LABEL = Object.freeze({
    NONE:    { ko: '판단 없음',   en: 'None',     tone: TONE.UNKNOWN },
    LOW:     { ko: '낮음',        en: 'Low',      tone: TONE.MUTED },
    MEDIUM:  { ko: '보통',        en: 'Medium',   tone: TONE.INFO },
    HIGH:    { ko: '계획 명확',    en: 'High',     tone: TONE.POSITIVE },
    BLOCKED: { ko: '진입 차단',   en: 'Blocked',  tone: TONE.WARNING }
  });

  var PLAN_QUALITY_LABEL = Object.freeze({
    NONE:           { ko: '등급 없음',     en: 'None',            tone: TONE.UNKNOWN },
    PLAN_AVOID:     { ko: '회피 권장',     en: 'Plan Avoid',      tone: TONE.WARNING },
    PLAN_WEAK:      { ko: '약한 계획',     en: 'Plan Weak',       tone: TONE.MUTED },
    PLAN_WATCH:     { ko: '관찰 계획',     en: 'Plan Watch',      tone: TONE.NEUTRAL },
    PLAN_STANDARD:  { ko: '표준 계획',     en: 'Plan Standard',   tone: TONE.INFO },
    PLAN_STRONG:    { ko: '강한 계획',     en: 'Plan Strong',     tone: TONE.POSITIVE },
    PLAN_PREMIUM:   { ko: '프리미엄 계획', en: 'Plan Premium',    tone: TONE.POSITIVE }
  });

  var STRUCTURE_BUCKET_LABEL = Object.freeze({
    UNKNOWN:                        { ko: '구조 미상',           tone: TONE.UNKNOWN },
    BOX_INSIDE:                     { ko: '박스 내부',           tone: TONE.NEUTRAL },
    BOX_MIDDLE:                     { ko: '박스 중앙',           tone: TONE.NEUTRAL },
    BOX_TOP_PRESSURE:               { ko: '박스 상단 압력',      tone: TONE.INFO },
    BOX_BOTTOM_PRESSURE:            { ko: '박스 하단 압력',      tone: TONE.CAUTION },
    BREAKOUT_PRESSURE_CANDIDATE:    { ko: '돌파 압력 후보',      tone: TONE.POSITIVE },
    BREAKDOWN_PRESSURE_CANDIDATE:   { ko: '이탈 압력 후보',      tone: TONE.WARNING },
    ABOVE_BOX_CONFIRMED_CANDIDATE:  { ko: '박스 상단 돌파 확정', tone: TONE.POSITIVE },
    BELOW_BOX_CONFIRMED_CANDIDATE:  { ko: '박스 하단 이탈 확정', tone: TONE.WARNING },
    LOW_SWEEP_RECLAIM_CANDIDATE:    { ko: '저점 청소 회복 후보', tone: TONE.POSITIVE },
    RECLAIM_READY:                  { ko: '회복 후보',           tone: TONE.POSITIVE },
    RANGE_EXPANSION:                { ko: '레인지 확장',         tone: TONE.INFO },
    RANGE_CONTRACTION:              { ko: '레인지 수축',         tone: TONE.NEUTRAL }
  });

  var PRICE_ZONE_LABEL = Object.freeze({
    UNKNOWN:     { ko: '구역 미상',  tone: TONE.UNKNOWN },
    TOP_NEAR:    { ko: '상단 근접',  tone: TONE.INFO },
    BOTTOM_NEAR: { ko: '하단 근접',  tone: TONE.CAUTION },
    MIDDLE:      { ko: '중앙',       tone: TONE.NEUTRAL }
  });

  var RISK_LEVEL_LABEL = Object.freeze({
    UNKNOWN: { ko: '리스크 미상', tone: TONE.UNKNOWN },
    LOW:     { ko: '낮음',       tone: TONE.POSITIVE },
    MEDIUM:  { ko: '보통',       tone: TONE.INFO },
    HIGH:    { ko: '높음',       tone: TONE.WARNING }
  });

  // ==========================================================================
  // DEFAULT_CARD_VIEW_MODEL_CONFIG
  // ==========================================================================
  var DEFAULT_CARD_VIEW_MODEL_CONFIG = Object.freeze({
    version: CONFIG_VERSION,
    sections: Object.freeze({
      showStructure: true,
      showCycle: true,
      showScore: true,
      showStrategy: true,
      showRisk: true,
      showDebug: false
    }),
    metrics: Object.freeze({
      showTotalScore: true,
      showStructureConfidence: true,
      showAgeBars: true,
      showCyclePhase: true,
      showActionability: true,
      showPlanQuality: true
    }),
    debug: Object.freeze({
      allowedFields: Object.freeze([])
    }),
    chips: Object.freeze({
      maxChips: 6,
      includeCycleState: true,
      includeCyclePhase: true,
      includeActionability: true,
      includePlanQuality: true,
      includeStructureBucket: true,
      includePriceZone: true
    })
  });

  function mergeCardViewModelConfig(config) {
    var c = config || {};
    var d = DEFAULT_CARD_VIEW_MODEL_CONFIG;
    var sec = c.sections || {};
    var met = c.metrics || {};
    var dbg = c.debug || {};
    var chp = c.chips || {};
    return {
      version: typeof c.version === 'string' ? c.version : d.version,
      sections: {
        showStructure: sec.showStructure !== false,
        showCycle: sec.showCycle !== false,
        showScore: sec.showScore !== false,
        showStrategy: sec.showStrategy !== false,
        showRisk: sec.showRisk !== false,
        showDebug: sec.showDebug === true
      },
      metrics: {
        showTotalScore: met.showTotalScore !== false,
        showStructureConfidence: met.showStructureConfidence !== false,
        showAgeBars: met.showAgeBars !== false,
        showCyclePhase: met.showCyclePhase !== false,
        showActionability: met.showActionability !== false,
        showPlanQuality: met.showPlanQuality !== false
      },
      debug: {
        allowedFields: Array.isArray(dbg.allowedFields)
          ? dbg.allowedFields.filter(function (f) { return typeof f === 'string' && f; })
          : []
      },
      chips: {
        maxChips: safeNumber(chp.maxChips, d.chips.maxChips),
        includeCycleState: chp.includeCycleState !== false,
        includeCyclePhase: chp.includeCyclePhase !== false,
        includeActionability: chp.includeActionability !== false,
        includePlanQuality: chp.includePlanQuality !== false,
        includeStructureBucket: chp.includeStructureBucket !== false,
        includePriceZone: chp.includePriceZone !== false
      }
    };
  }

  function makeConfigUsed(cfg) {
    return {
      sections: {
        showStructure: cfg.sections.showStructure,
        showCycle: cfg.sections.showCycle,
        showScore: cfg.sections.showScore,
        showStrategy: cfg.sections.showStrategy,
        showRisk: cfg.sections.showRisk,
        showDebug: cfg.sections.showDebug
      },
      metrics: {
        showTotalScore: cfg.metrics.showTotalScore,
        showStructureConfidence: cfg.metrics.showStructureConfidence,
        showAgeBars: cfg.metrics.showAgeBars,
        showCyclePhase: cfg.metrics.showCyclePhase,
        showActionability: cfg.metrics.showActionability,
        showPlanQuality: cfg.metrics.showPlanQuality
      },
      debug: {
        allowedFields: cfg.debug.allowedFields.slice()
      },
      chips: {
        maxChips: cfg.chips.maxChips,
        includeCycleState: cfg.chips.includeCycleState,
        includeCyclePhase: cfg.chips.includeCyclePhase,
        includeActionability: cfg.chips.includeActionability,
        includePlanQuality: cfg.chips.includePlanQuality,
        includeStructureBucket: cfg.chips.includeStructureBucket,
        includePriceZone: cfg.chips.includePriceZone
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

  function isPlainObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  function pushUnique(arr, value) {
    if (!Array.isArray(arr) || typeof value !== 'string' || !value) return;
    if (arr.indexOf(value) === -1) arr.push(value);
  }

  function safeString(value, fallback) {
    if (typeof value === 'string' && value) return value;
    return (typeof fallback === 'string') ? fallback : null;
  }

  function lookupLabel(dict, key) {
    if (!isPlainObject(dict)) return null;
    if (typeof key !== 'string' || !key) return null;
    if (!Object.prototype.hasOwnProperty.call(dict, key)) return null;
    return dict[key];
  }

  function pickLabel(dict, key, fallbackKo, fallbackTone) {
    var safeKey = (typeof key === 'string' && key) ? key : 'UNKNOWN';
    var entry = lookupLabel(dict, key);
    if (entry) {
      return {
        labelKey: safeKey,
        labelKo: typeof entry.ko === 'string' ? entry.ko : (fallbackKo || ''),
        labelEn: typeof entry.en === 'string' ? entry.en : safeKey,
        tone: typeof entry.tone === 'string' ? entry.tone : (fallbackTone || TONE.UNKNOWN)
      };
    }
    return {
      labelKey: safeKey,
      labelKo: fallbackKo || '',
      labelEn: safeKey,
      tone: fallbackTone || TONE.UNKNOWN
    };
  }

  // ==========================================================================
  // §identity
  // ==========================================================================
  function buildIdentity(payload) {
    var id = {
      symbol: null,
      market: null,
      timeframe: null,
      asOfTs: null
    };
    if (!isPlainObject(payload)) return id;
    id.symbol = safeString(payload.symbol, null);
    id.market = safeString(payload.market, null);

    var raw = isPlainObject(payload.raw) ? payload.raw : null;
    var bd = (raw && isPlainObject(raw.builderDebug)) ? raw.builderDebug : null;
    if (bd && typeof bd.primaryTimeframe === 'string' && bd.primaryTimeframe) {
      id.timeframe = bd.primaryTimeframe;
    }

    var ts = safeNumber(payload.ts, null);
    if (ts !== null) {
      id.asOfTs = ts;
    } else if (isPlainObject(payload.candles) && id.timeframe) {
      var arr = payload.candles[id.timeframe];
      if (Array.isArray(arr) && arr.length > 0) {
        var last = arr[arr.length - 1];
        if (isPlainObject(last)) {
          var candleTs = safeNumber(last.ts, null);
          if (candleTs !== null) id.asOfTs = candleTs;
        }
      }
    }
    return id;
  }

  // ==========================================================================
  // §header (DP-UI3 / DP-UI5 / DP-UI11 — primaryBadge=strategyBias, numeric hint X)
  // ==========================================================================
  function buildHeader(strategyPlan, signalCycle, identity) {
    var strategyBias = (isPlainObject(strategyPlan) && typeof strategyPlan.strategyBias === 'string')
      ? strategyPlan.strategyBias : 'UNKNOWN';
    var primary = pickLabel(STRATEGY_BIAS_LABEL, strategyBias, '판단 보류', TONE.UNKNOWN);

    var cycleState = (isPlainObject(signalCycle) && typeof signalCycle.cycleState === 'string')
      ? signalCycle.cycleState : 'UNKNOWN';
    var secondary = pickLabel(CYCLE_STATE_LABEL, cycleState, '사이클 미상', TONE.UNKNOWN);

    var actionability = (isPlainObject(strategyPlan) && typeof strategyPlan.actionability === 'string')
      ? strategyPlan.actionability : 'NONE';
    var actionLabel = pickLabel(ACTIONABILITY_LABEL, actionability, '판단 없음', TONE.UNKNOWN);

    var symbol = safeString(identity.symbol, '');
    var market = safeString(identity.market, '');
    var symbolText = symbol || (market ? market : '');

    return {
      title: symbolText,
      subtitle: market && symbol ? market : '',
      primaryBadge: {
        id: 'BIAS_' + strategyBias,
        labelKey: primary.labelKey,
        labelKo: primary.labelKo,
        labelEn: primary.labelEn,
        tone: primary.tone
      },
      secondaryBadge: {
        id: 'CYCLE_' + cycleState,
        labelKey: secondary.labelKey,
        labelKo: secondary.labelKo,
        labelEn: secondary.labelEn,
        tone: secondary.tone
      },
      actionability: {
        id: 'ACTION_' + actionability,
        labelKey: actionLabel.labelKey,
        labelKo: actionLabel.labelKo,
        labelEn: actionLabel.labelEn,
        tone: actionLabel.tone
      }
    };
  }

  // ==========================================================================
  // §chips (DP-UI3 / DP-UI5)
  // ==========================================================================
  function buildChips(strategyPlan, signalCycle, structureDecision, cfg) {
    var chips = [];
    var max = safeNumber(cfg.chips.maxChips, 6);

    var add = function (id, labelKey, labelKo, labelEn, tone) {
      if (chips.length >= max) return;
      chips.push({
        id: id,
        labelKey: labelKey,
        labelKo: labelKo,
        labelEn: labelEn,
        tone: tone || TONE.NEUTRAL
      });
    };

    if (cfg.chips.includeCycleState && isPlainObject(signalCycle)) {
      var cs = typeof signalCycle.cycleState === 'string' ? signalCycle.cycleState : 'UNKNOWN';
      var csLabel = pickLabel(CYCLE_STATE_LABEL, cs, '사이클 미상', TONE.UNKNOWN);
      add('CYCLE_STATE_' + cs, csLabel.labelKey, csLabel.labelKo, csLabel.labelEn, csLabel.tone);
    }

    if (cfg.chips.includeCyclePhase && isPlainObject(signalCycle)) {
      var cp = typeof signalCycle.cyclePhase === 'string' ? signalCycle.cyclePhase : 'UNKNOWN';
      var cpLabel = pickLabel(CYCLE_PHASE_LABEL, cp, '단계 미상', TONE.UNKNOWN);
      add('CYCLE_PHASE_' + cp, cpLabel.labelKey, cpLabel.labelKo, cpLabel.labelEn, cpLabel.tone);
    }

    if (cfg.chips.includeStructureBucket && isPlainObject(structureDecision)) {
      var sb = typeof structureDecision.structureBucket === 'string'
        ? structureDecision.structureBucket : 'UNKNOWN';
      var sbLabel = pickLabel(STRUCTURE_BUCKET_LABEL, sb, '구조 미상', TONE.UNKNOWN);
      add('STRUCTURE_BUCKET_' + sb, sbLabel.labelKey, sbLabel.labelKo, sb, sbLabel.tone);
    }

    if (cfg.chips.includePriceZone && isPlainObject(structureDecision)
        && isPlainObject(structureDecision.priceZone)) {
      var pz = typeof structureDecision.priceZone.zone === 'string'
        ? structureDecision.priceZone.zone : 'UNKNOWN';
      var pzLabel = pickLabel(PRICE_ZONE_LABEL, pz, '구역 미상', TONE.UNKNOWN);
      add('PRICE_ZONE_' + pz, pzLabel.labelKey, pzLabel.labelKo, pz, pzLabel.tone);
    }

    if (cfg.chips.includeActionability && isPlainObject(strategyPlan)) {
      var ac = typeof strategyPlan.actionability === 'string' ? strategyPlan.actionability : 'NONE';
      var acLabel = pickLabel(ACTIONABILITY_LABEL, ac, '판단 없음', TONE.UNKNOWN);
      add('ACTIONABILITY_' + ac, acLabel.labelKey, acLabel.labelKo, acLabel.labelEn, acLabel.tone);
    }

    if (cfg.chips.includePlanQuality && isPlainObject(strategyPlan)) {
      var pq = typeof strategyPlan.planQualityTier === 'string'
        ? strategyPlan.planQualityTier : 'NONE';
      var pqLabel = pickLabel(PLAN_QUALITY_LABEL, pq, '등급 없음', TONE.UNKNOWN);
      add('PLAN_QUALITY_' + pq, pqLabel.labelKey, pqLabel.labelKo, pqLabel.labelEn, pqLabel.tone);
    }

    return chips;
  }

  // ==========================================================================
  // §metrics (DP-UI4 / DP-UI5)
  // metrics 는 array. 각 item = { id, labelKey, labelKo, labelEn, value, kind, tone, sortKey }.
  // ==========================================================================
  function buildMetrics(scoreBreakdown, structureDecision, signalCycle, strategyPlan, cfg) {
    var metrics = [];
    var order = 0;
    var push = function (id, labelKey, labelKo, labelEn, value, kind, tone) {
      metrics.push({
        id: id,
        labelKey: labelKey,
        labelKo: labelKo,
        labelEn: labelEn,
        value: value,
        kind: kind || 'string',
        tone: tone || TONE.NEUTRAL,
        sortKey: order
      });
      order = order + 1;
    };

    if (cfg.metrics.showTotalScore && isPlainObject(scoreBreakdown)) {
      var totalScore = safeNumber(scoreBreakdown.totalScore, null);
      var tone = TONE.NEUTRAL;
      if (typeof totalScore === 'number') {
        if (totalScore >= 80) tone = TONE.POSITIVE;
        else if (totalScore >= 60) tone = TONE.INFO;
        else if (totalScore >= 40) tone = TONE.NEUTRAL;
        else tone = TONE.MUTED;
      }
      push('METRIC_TOTAL_SCORE', 'TOTAL_SCORE', '총점', 'Total Score', totalScore, 'score', tone);
    }

    if (cfg.metrics.showStructureConfidence && isPlainObject(structureDecision)) {
      var conf = safeNumber(structureDecision.confidence, null);
      var ctone = TONE.NEUTRAL;
      if (typeof conf === 'number') {
        if (conf >= 80) ctone = TONE.POSITIVE;
        else if (conf >= 60) ctone = TONE.INFO;
        else if (conf >= 40) ctone = TONE.NEUTRAL;
        else ctone = TONE.MUTED;
      }
      push('METRIC_STRUCTURE_CONFIDENCE', 'STRUCTURE_CONFIDENCE', '구조 확신도', 'Structure Confidence', conf, 'percent', ctone);
    }

    if (cfg.metrics.showAgeBars && isPlainObject(signalCycle)) {
      var age = safeNumber(signalCycle.ageBars, null);
      push('METRIC_AGE_BARS', 'AGE_BARS', '신호 경과 봉', 'Age Bars', age, 'count', TONE.NEUTRAL);
    }

    if (cfg.metrics.showCyclePhase && isPlainObject(signalCycle)) {
      var phase = typeof signalCycle.cyclePhase === 'string' ? signalCycle.cyclePhase : 'UNKNOWN';
      var phaseLabel = pickLabel(CYCLE_PHASE_LABEL, phase, '단계 미상', TONE.UNKNOWN);
      push('METRIC_CYCLE_PHASE', 'CYCLE_PHASE_' + phase, '사이클 단계', 'Cycle Phase', phaseLabel.labelKo, 'enum', phaseLabel.tone);
    }

    if (cfg.metrics.showActionability && isPlainObject(strategyPlan)) {
      var ac = typeof strategyPlan.actionability === 'string' ? strategyPlan.actionability : 'NONE';
      var acLabel = pickLabel(ACTIONABILITY_LABEL, ac, '판단 없음', TONE.UNKNOWN);
      push('METRIC_ACTIONABILITY', 'ACTIONABILITY_' + ac, '실행 가능성', 'Actionability', acLabel.labelKo, 'enum', acLabel.tone);
    }

    if (cfg.metrics.showPlanQuality && isPlainObject(strategyPlan)) {
      var pq = typeof strategyPlan.planQualityTier === 'string'
        ? strategyPlan.planQualityTier : 'NONE';
      var pqLabel = pickLabel(PLAN_QUALITY_LABEL, pq, '등급 없음', TONE.UNKNOWN);
      push('METRIC_PLAN_QUALITY', 'PLAN_QUALITY_' + pq, '계획 등급', 'Plan Quality', pqLabel.labelKo, 'enum', pqLabel.tone);
    }

    return metrics;
  }

  // ==========================================================================
  // §sections.overview
  // ==========================================================================
  function buildOverviewSection(payload, identity) {
    var section = {
      symbol: identity.symbol,
      market: identity.market,
      timeframe: identity.timeframe,
      asOfTs: identity.asOfTs
    };
    if (isPlainObject(payload)) {
      var v = safeString(payload.payloadVersion, null);
      if (v) section.payloadVersion = v;
    }
    return section;
  }

  // ==========================================================================
  // §sections.score
  // ==========================================================================
  function buildScoreSection(scoreBreakdown) {
    if (!isPlainObject(scoreBreakdown)) {
      return {
        valid: false,
        version: null,
        totalScore: null,
        grossScore: null,
        riskPenalty: null,
        components: null
      };
    }
    var comp = isPlainObject(scoreBreakdown.components) ? scoreBreakdown.components : null;
    var pickComponent = function (name) {
      if (!comp || !isPlainObject(comp[name])) return null;
      var c = comp[name];
      return {
        score: safeNumber(c.score, null),
        maxScore: safeNumber(c.maxScore, null)
      };
    };
    return {
      valid: scoreBreakdown.valid === true,
      version: safeString(scoreBreakdown.version, null),
      totalScore: safeNumber(scoreBreakdown.totalScore, null),
      grossScore: safeNumber(scoreBreakdown.grossScore, null),
      riskPenalty: safeNumber(scoreBreakdown.riskPenalty, null),
      components: comp ? {
        structure: pickComponent('structure'),
        momentum: pickComponent('momentum'),
        volume: pickComponent('volume'),
        candle: pickComponent('candle'),
        execution: pickComponent('execution')
      } : null
    };
  }

  // ==========================================================================
  // §sections.structure
  // ==========================================================================
  function buildStructureSection(structureDecision) {
    if (!isPlainObject(structureDecision)) {
      return {
        valid: false,
        version: null,
        structureBucket: 'UNKNOWN',
        confidence: null,
        priceZone: null,
        labelKo: '구조 미상',
        tone: TONE.UNKNOWN
      };
    }
    var bucket = typeof structureDecision.structureBucket === 'string'
      ? structureDecision.structureBucket : 'UNKNOWN';
    var bucketLabel = pickLabel(STRUCTURE_BUCKET_LABEL, bucket, '구조 미상', TONE.UNKNOWN);

    var zone = null;
    if (isPlainObject(structureDecision.priceZone)) {
      var zoneKey = typeof structureDecision.priceZone.zone === 'string'
        ? structureDecision.priceZone.zone : 'UNKNOWN';
      var zoneLabel = pickLabel(PRICE_ZONE_LABEL, zoneKey, '구역 미상', TONE.UNKNOWN);
      zone = {
        zone: zoneKey,
        labelKo: zoneLabel.labelKo,
        tone: zoneLabel.tone,
        distancePct: safeNumber(structureDecision.priceZone.distancePct, null)
      };
    }

    return {
      valid: structureDecision.valid === true,
      version: safeString(structureDecision.version, null),
      structureBucket: bucket,
      labelKo: bucketLabel.labelKo,
      tone: bucketLabel.tone,
      confidence: safeNumber(structureDecision.confidence, null),
      priceZone: zone
    };
  }

  // ==========================================================================
  // §sections.cycle
  // ==========================================================================
  function buildCycleSection(signalCycle) {
    if (!isPlainObject(signalCycle)) {
      return {
        valid: false,
        version: null,
        cycleState: 'UNKNOWN',
        cyclePhase: 'UNKNOWN',
        bucketFamily: 'NONE',
        ageBars: null,
        stateLabelKo: '사이클 미상',
        phaseLabelKo: '단계 미상',
        stateTone: TONE.UNKNOWN,
        phaseTone: TONE.UNKNOWN
      };
    }
    var cs = typeof signalCycle.cycleState === 'string' ? signalCycle.cycleState : 'UNKNOWN';
    var cp = typeof signalCycle.cyclePhase === 'string' ? signalCycle.cyclePhase : 'UNKNOWN';
    var csLabel = pickLabel(CYCLE_STATE_LABEL, cs, '사이클 미상', TONE.UNKNOWN);
    var cpLabel = pickLabel(CYCLE_PHASE_LABEL, cp, '단계 미상', TONE.UNKNOWN);

    return {
      valid: signalCycle.valid === true,
      version: safeString(signalCycle.version, null),
      cycleState: cs,
      cyclePhase: cp,
      bucketFamily: typeof signalCycle.bucketFamily === 'string' ? signalCycle.bucketFamily : 'NONE',
      ageBars: safeNumber(signalCycle.ageBars, null),
      stateLabelKo: csLabel.labelKo,
      stateTone: csLabel.tone,
      phaseLabelKo: cpLabel.labelKo,
      phaseTone: cpLabel.tone
    };
  }

  // ==========================================================================
  // §sections.strategy (DP-UI9 / DP-UI11 — numeric hint 노출 허용 구역)
  // invalidationHint / targetHint / entryZone 은 여기서만 노출.
  // ==========================================================================
  function buildStrategySection(strategyPlan) {
    if (!isPlainObject(strategyPlan)) {
      return {
        valid: false,
        version: null,
        strategyBias: 'UNKNOWN',
        planType: 'NONE',
        actionability: 'NONE',
        planQualityTier: 'NONE',
        entry: null,
        exit: null,
        biasLabelKo: '판단 보류',
        biasTone: TONE.UNKNOWN
      };
    }
    var bias = typeof strategyPlan.strategyBias === 'string' ? strategyPlan.strategyBias : 'UNKNOWN';
    var biasLabel = pickLabel(STRATEGY_BIAS_LABEL, bias, '판단 보류', TONE.UNKNOWN);

    var entry = null;
    if (isPlainObject(strategyPlan.entryPlan)) {
      var ep = strategyPlan.entryPlan;
      entry = {
        valid: ep.valid === true,
        type: typeof ep.type === 'string' ? ep.type : 'NONE',
        entryZone: safeNumber(ep.entryZone, null),
        trigger: typeof ep.trigger === 'string' ? ep.trigger : null,
        setupInvalidationHint: safeNumber(ep.setupInvalidationHint, null),
        referencePrice: safeNumber(ep.referencePrice, null)
      };
    }

    var exit = null;
    if (isPlainObject(strategyPlan.exitPlan)) {
      var xp = strategyPlan.exitPlan;
      exit = {
        valid: xp.valid === true,
        type: typeof xp.type === 'string' ? xp.type : 'NONE',
        targetHint: safeNumber(xp.targetHint, null),
        invalidationHint: safeNumber(xp.invalidationHint, null),
        riskRewardHint: safeNumber(xp.riskRewardHint, null)
      };
    }

    return {
      valid: strategyPlan.valid === true,
      version: safeString(strategyPlan.version, null),
      strategyBias: bias,
      planType: typeof strategyPlan.planType === 'string' ? strategyPlan.planType : 'NONE',
      actionability: typeof strategyPlan.actionability === 'string' ? strategyPlan.actionability : 'NONE',
      planQualityTier: typeof strategyPlan.planQualityTier === 'string' ? strategyPlan.planQualityTier : 'NONE',
      entry: entry,
      exit: exit,
      biasLabelKo: biasLabel.labelKo,
      biasTone: biasLabel.tone
    };
  }

  // ==========================================================================
  // §sections.risk (DP-UI9 / DP-UI11 — numeric hint 노출 허용 구역)
  // ==========================================================================
  function buildRiskSection(strategyPlan, scoreBreakdown) {
    var riskLevel = 'UNKNOWN';
    if (isPlainObject(strategyPlan) && typeof strategyPlan.riskLevel === 'string') {
      riskLevel = strategyPlan.riskLevel;
    } else if (isPlainObject(scoreBreakdown) && isPlainObject(scoreBreakdown.risk)
               && typeof scoreBreakdown.risk.level === 'string') {
      riskLevel = scoreBreakdown.risk.level;
    }
    var rlLabel = pickLabel(RISK_LEVEL_LABEL, riskLevel, '리스크 미상', TONE.UNKNOWN);

    var penalty = null;
    var maxPenalty = null;
    if (isPlainObject(scoreBreakdown) && isPlainObject(scoreBreakdown.risk)) {
      penalty = safeNumber(scoreBreakdown.risk.penalty, null);
      maxPenalty = safeNumber(scoreBreakdown.risk.maxPenalty, null);
    }

    var rc = null;
    if (isPlainObject(strategyPlan) && isPlainObject(strategyPlan.riskControls)) {
      rc = {
        allowChase: strategyPlan.riskControls.allowChase === true,
        requirePullback: strategyPlan.riskControls.requirePullback === true,
        requireReclaim: strategyPlan.riskControls.requireReclaim === true,
        avoidIfWeakening: strategyPlan.riskControls.avoidIfWeakening === true,
        avoidIfCooldown: strategyPlan.riskControls.avoidIfCooldown === true
      };
    }

    return {
      riskLevel: riskLevel,
      labelKo: rlLabel.labelKo,
      tone: rlLabel.tone,
      penalty: penalty,
      maxPenalty: maxPenalty,
      controls: rc
    };
  }

  // ==========================================================================
  // §sections.debug (DP-UI8)
  //   기본: showDebug=false → null
  //   허용 노출:
  //     1. cardViewModel 자체 버전 / 모듈 버전 메타 (always)
  //     2. cfg.debug.allowedFields 에 명시된 builderDebug 필드 (whitelist)
  //   영구 차단 (whitelist 와 무관):
  //     - identityInput (object) / candles 배열 / rawCandles / candleArrays
  //     - payload.raw 객체 전체 / payload.raw.builderDebug 객체 전체
  //   추가 안전장치:
  //     - whitelist 통과 값이라도 primitive (string/number/boolean/null) 만 노출.
  //       object / array 는 자동 차단.
  // ==========================================================================
  function buildDebugSection(payload, scoreBreakdown, structureDecision, signalCycle, strategyPlan, cfg) {
    if (!cfg.sections.showDebug) return null;

    var debug = {
      cardViewModelVersion: CARD_VIEW_MODEL_VERSION
    };
    if (isPlainObject(scoreBreakdown) && typeof scoreBreakdown.version === 'string') {
      debug.scoreVersion = scoreBreakdown.version;
    }
    if (isPlainObject(structureDecision) && typeof structureDecision.version === 'string') {
      debug.structureVersion = structureDecision.version;
    }
    if (isPlainObject(signalCycle) && typeof signalCycle.version === 'string') {
      debug.cycleVersion = signalCycle.version;
    }
    if (isPlainObject(strategyPlan) && typeof strategyPlan.version === 'string') {
      debug.strategyVersion = strategyPlan.version;
    }

    // 영구 차단 필드 (whitelist 통과해도 노출 X)
    var BLOCKED_FIELDS = ['identityInput', 'candles', 'rawCandles', 'candleArrays', 'raw', 'builderDebug'];

    var allowed = Array.isArray(cfg.debug.allowedFields) ? cfg.debug.allowedFields : [];
    if (allowed.length === 0) return debug;

    var bd = (isPlainObject(payload) && isPlainObject(payload.raw)
              && isPlainObject(payload.raw.builderDebug)) ? payload.raw.builderDebug : null;
    if (!bd) return debug;

    for (var i = 0; i < allowed.length; i = i + 1) {
      var f = allowed[i];
      if (typeof f !== 'string' || !f) continue;
      if (BLOCKED_FIELDS.indexOf(f) !== -1) continue;
      if (!Object.prototype.hasOwnProperty.call(bd, f)) continue;
      var v = bd[f];
      // primitive only — object / array 자동 차단
      if (v === null) {
        debug[f] = null;
      } else if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
        debug[f] = v;
      }
    }

    return debug;
  }

  // ==========================================================================
  // §displayFlags (DP-UI7 / r0.2-final — 정확히 10개 boolean)
  //   isReady              — signalCycle.signalQuality.ready === true
  //   isBlocked            — actionability === 'BLOCKED' or bias in {NO_TRADE, RISK_OFF}
  //   isCooldown           — cycleState === 'COOLDOWN' or bias === 'COOLDOWN_WAIT'
  //   isExpired            — cycleState === 'EXPIRED' or bias === 'EXPIRED_IGNORE'
  //   isWeakening          — cycleState === 'WEAKENING'
  //   isHighActionability  — actionability === 'HIGH'
  //   showEntryPlan        — strategyPlan.entryPlan.valid === true
  //   showExitPlan         — strategyPlan.exitPlan.valid === true
  //   showRiskWarning      — isBlocked || isWeakening || riskLevel === 'HIGH'
  //   showDebug            — cfg.sections.showDebug === true
  // ==========================================================================
  function buildDisplayFlags(strategyPlan, signalCycle, cfg) {
    var actionability = (isPlainObject(strategyPlan) && typeof strategyPlan.actionability === 'string')
      ? strategyPlan.actionability : 'NONE';
    var bias = (isPlainObject(strategyPlan) && typeof strategyPlan.strategyBias === 'string')
      ? strategyPlan.strategyBias : 'UNKNOWN';
    var cycleState = (isPlainObject(signalCycle) && typeof signalCycle.cycleState === 'string')
      ? signalCycle.cycleState : 'UNKNOWN';

    var ready = false;
    if (isPlainObject(signalCycle) && isPlainObject(signalCycle.signalQuality)) {
      ready = signalCycle.signalQuality.ready === true;
    }

    var isBlocked = (actionability === 'BLOCKED' || bias === 'NO_TRADE' || bias === 'RISK_OFF');
    var isCooldown = (cycleState === 'COOLDOWN' || bias === 'COOLDOWN_WAIT');
    var isExpired = (cycleState === 'EXPIRED' || bias === 'EXPIRED_IGNORE');
    var isWeakening = (cycleState === 'WEAKENING');
    var isHighActionability = (actionability === 'HIGH');

    var showEntryPlan = false;
    var showExitPlan = false;
    if (isPlainObject(strategyPlan)) {
      if (isPlainObject(strategyPlan.entryPlan)) showEntryPlan = strategyPlan.entryPlan.valid === true;
      if (isPlainObject(strategyPlan.exitPlan)) showExitPlan = strategyPlan.exitPlan.valid === true;
    }

    var riskLevel = (isPlainObject(strategyPlan) && typeof strategyPlan.riskLevel === 'string')
      ? strategyPlan.riskLevel : 'UNKNOWN';
    var showRiskWarning = (isBlocked || isWeakening || riskLevel === 'HIGH');

    return {
      isReady: ready === true,
      isBlocked: isBlocked === true,
      isCooldown: isCooldown === true,
      isExpired: isExpired === true,
      isWeakening: isWeakening === true,
      isHighActionability: isHighActionability === true,
      showEntryPlan: showEntryPlan === true,
      showExitPlan: showExitPlan === true,
      showRiskWarning: showRiskWarning === true,
      showDebug: cfg.sections.showDebug === true
    };
  }

  // ==========================================================================
  // §tone — card overall tone
  // ==========================================================================
  function buildOverallTone(strategyPlan, signalCycle, displayFlags) {
    if (displayFlags.isExpired) return TONE.CRITICAL;
    if (displayFlags.isBlocked) return TONE.WARNING;
    if (displayFlags.isCooldown) return TONE.CAUTION;
    if (displayFlags.isWeakening) return TONE.WARNING;
    if (displayFlags.isHighActionability) return TONE.POSITIVE;

    var bias = (isPlainObject(strategyPlan) && typeof strategyPlan.strategyBias === 'string')
      ? strategyPlan.strategyBias : 'UNKNOWN';
    if (bias === 'UNKNOWN') return TONE.UNKNOWN;
    if (bias === 'WATCH_ONLY' || bias === 'PULLBACK_WAIT') return TONE.NEUTRAL;
    if (bias === 'BREAKOUT_READY' || bias === 'RECLAIM_READY' || bias === 'MOMENTUM_FOLLOW') return TONE.POSITIVE;
    return TONE.NEUTRAL;
  }

  // ==========================================================================
  // §reasons / warnings dedupe (4종 산출 객체로부터 누적)
  // ==========================================================================
  function collectReasonsAndWarnings(scoreBreakdown, structureDecision, signalCycle, strategyPlan) {
    var reasons = [];
    var warnings = [];

    var sources = [scoreBreakdown, structureDecision, signalCycle, strategyPlan];
    for (var i = 0; i < sources.length; i = i + 1) {
      var src = sources[i];
      if (!isPlainObject(src)) continue;
      if (Array.isArray(src.reasons)) {
        for (var j = 0; j < src.reasons.length; j = j + 1) {
          pushUnique(reasons, String(src.reasons[j]));
        }
      }
      if (Array.isArray(src.warnings)) {
        for (var k = 0; k < src.warnings.length; k = k + 1) {
          pushUnique(warnings, String(src.warnings[k]));
        }
      }
    }
    return { reasons: reasons, warnings: warnings };
  }

  // ==========================================================================
  // §normalize 출력
  // ==========================================================================
  function normalizeCardViewModel(result) {
    return {
      valid: result.valid === true,
      version: CARD_VIEW_MODEL_VERSION,
      identity: result.identity,
      header: result.header,
      chips: Array.isArray(result.chips) ? result.chips.slice() : [],
      metrics: Array.isArray(result.metrics) ? result.metrics.slice() : [],
      sections: result.sections,
      displayFlags: result.displayFlags,
      tone: typeof result.tone === 'string' ? result.tone : TONE.UNKNOWN,
      reasons: Array.isArray(result.reasons) ? result.reasons.slice() : [],
      warnings: Array.isArray(result.warnings) ? result.warnings.slice() : [],
      debug: result.debug,
      configUsed: result.configUsed
    };
  }

  // ==========================================================================
  // §main — buildCardViewModel
  // ==========================================================================
  /**
   * payload + scoreBreakdown + structureDecision + signalCycle + strategyPlan
   * → standalone cardViewModel (UI-ready). 모든 입력 mutate 0건 (DP-UI1).
   *
   * @param {Object} payload
   * @param {Object} [scoreBreakdown]
   * @param {Object} [structureDecision]
   * @param {Object} [signalCycle]
   * @param {Object} [strategyPlan]
   * @param {Object} [config]
   * @return {Object} cardViewModel
   */
  function buildCardViewModel(payload, scoreBreakdown, structureDecision, signalCycle, strategyPlan, config) {
    var cfg = mergeCardViewModelConfig(config);
    var configUsed = makeConfigUsed(cfg);

    var topWarnings = [];
    if (!isPlainObject(payload)) topWarnings.push('PAYLOAD_NOT_OBJECT');
    if (!isPlainObject(strategyPlan)) topWarnings.push('STRATEGY_PLAN_NOT_OBJECT');
    if (!isPlainObject(signalCycle)) topWarnings.push('SIGNAL_CYCLE_NOT_OBJECT');
    if (!isPlainObject(structureDecision)) topWarnings.push('STRUCTURE_DECISION_NOT_OBJECT');
    if (!isPlainObject(scoreBreakdown)) topWarnings.push('SCORE_BREAKDOWN_NOT_OBJECT');

    var identity = buildIdentity(payload);
    var header = buildHeader(strategyPlan, signalCycle, identity);
    var chips = buildChips(strategyPlan, signalCycle, structureDecision, cfg);
    var metrics = buildMetrics(scoreBreakdown, structureDecision, signalCycle, strategyPlan, cfg);

    var sections = {
      overview: buildOverviewSection(payload, identity),
      score: buildScoreSection(scoreBreakdown),
      structure: buildStructureSection(structureDecision),
      cycle: buildCycleSection(signalCycle),
      strategy: buildStrategySection(strategyPlan),
      risk: buildRiskSection(strategyPlan, scoreBreakdown),
      debug: buildDebugSection(payload, scoreBreakdown, structureDecision, signalCycle, strategyPlan, cfg)
    };

    var displayFlags = buildDisplayFlags(strategyPlan, signalCycle, cfg);
    var tone = buildOverallTone(strategyPlan, signalCycle, displayFlags);

    var collected = collectReasonsAndWarnings(scoreBreakdown, structureDecision, signalCycle, strategyPlan);
    var topReasons = collected.reasons;
    var mergedWarnings = collected.warnings.slice();
    for (var w = 0; w < topWarnings.length; w = w + 1) {
      pushUnique(mergedWarnings, topWarnings[w]);
    }

    var valid = isPlainObject(payload) && isPlainObject(strategyPlan);

    return normalizeCardViewModel({
      valid: valid,
      identity: identity,
      header: header,
      chips: chips,
      metrics: metrics,
      sections: sections,
      displayFlags: displayFlags,
      tone: tone,
      reasons: topReasons,
      warnings: mergedWarnings,
      debug: {
        source: 'payload + scoreBreakdown + structureDecision + signalCycle + strategyPlan',
        configVersion: cfg.version
      },
      configUsed: configUsed
    });
  }

  // ==========================================================================
  // §export — 이중 환경
  // ==========================================================================
  var api = Object.freeze({
    CARD_VIEW_MODEL_VERSION: CARD_VIEW_MODEL_VERSION,
    CONFIG_VERSION: CONFIG_VERSION,
    DEFAULT_CARD_VIEW_MODEL_CONFIG: DEFAULT_CARD_VIEW_MODEL_CONFIG,
    TONE: TONE,
    STRATEGY_BIAS_LABEL: STRATEGY_BIAS_LABEL,
    CYCLE_STATE_LABEL: CYCLE_STATE_LABEL,
    CYCLE_PHASE_LABEL: CYCLE_PHASE_LABEL,
    ACTIONABILITY_LABEL: ACTIONABILITY_LABEL,
    PLAN_QUALITY_LABEL: PLAN_QUALITY_LABEL,
    STRUCTURE_BUCKET_LABEL: STRUCTURE_BUCKET_LABEL,
    PRICE_ZONE_LABEL: PRICE_ZONE_LABEL,
    RISK_LEVEL_LABEL: RISK_LEVEL_LABEL,

    build: buildCardViewModel,
    mergeCardViewModelConfig: mergeCardViewModelConfig,

    buildIdentity: buildIdentity,
    buildHeader: buildHeader,
    buildChips: buildChips,
    buildMetrics: buildMetrics,
    buildOverviewSection: buildOverviewSection,
    buildScoreSection: buildScoreSection,
    buildStructureSection: buildStructureSection,
    buildCycleSection: buildCycleSection,
    buildStrategySection: buildStrategySection,
    buildRiskSection: buildRiskSection,
    buildDebugSection: buildDebugSection,
    buildDisplayFlags: buildDisplayFlags,
    buildOverallTone: buildOverallTone,

    safeNumber: safeNumber,
    isPlainObject: isPlainObject,
    normalizeCardViewModel: normalizeCardViewModel
  });

  global.WS3_CardViewModel = api;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis
   : typeof window !== 'undefined' ? window
   : typeof self !== 'undefined' ? self
   : this);
