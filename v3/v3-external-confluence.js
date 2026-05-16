/**
 * WS3 v0.11.0 — ExternalConfluence (Adapter Input Contract Pack)
 *
 * Scope:
 *   외부 보조 신호 (caller 주입)
 *   → standalone externalConfluence (post-evaluation 보조 context layer)
 *
 * 단일 기준 문서:
 *   docs/ws3/WS3_CODE_CONTRACT.md (b-r2 박제본)
 *
 * v0.1.0 marketContext 와의 관계:
 *   v0.1.0 marketContext: payload 단계 기본 market state (build 시점).
 *   v0.11.0 externalConfluence: post-evaluation 보조 context (caller 가 evaluation 후 주입).
 *   두 layer 는 별도. ExternalConfluence 가 payload.marketContext 를 직접 read 하지 않음.
 *
 * 확정 DP 정책 (Gate 2 spec):
 *   DP-ACP1   입력 adapter contract 만. 실제 fetch / transport / renderer 구현 X.
 *   DP-ACP2   v0.11.0 입력 layer (EvaluationObservationAdapter + ExternalConfluence).
 *             출력 layer (TransportPlan / RendererBinding) 는 v0.12.0.
 *   DP-ACP3   side-effect 금지 (외부 전송 / 영속 저장 / network / DOM / 브라우저 storage /
 *             런타임 clock API).
 *   DP-ACP5   기존 scoreBreakdown / structureDecision / strategyPlan 판단 대체 금지.
 *             보조 입력 객체로만 사용.
 *   DP-ACP6   raw candles / full API response / payload.raw / identityInput 저장 / 노출 금지.
 *             요약값과 safe scalar 만 사용.
 *   DP-ACP7   Config-driven (DEFAULT_EXTERNAL_CONFLUENCE_CONFIG).
 *   DP-ACP8   입력 객체 mutation / delete 금지. payload.newsContext 직접 read 금지.
 *
 * U-ACP 확정 처리:
 *   U-ACP-2 — confluenceScore: number 또는 null. 기본 null. 정량화 불충분 시 null 유지.
 *             기본 범위 -100 ~ 100 (negative=adverse / positive=favorable / 0=neutral / null=불충분).
 *             cfg.confluence.enableScore 기본 false. true 일 때만 calculateConfluenceScore 가
 *             정량화 시도. 그래도 불충분하면 null 유지.
 *             confluenceLabel 기본 'UNKNOWN'.
 *
 * N-ACP-OBS 처리:
 *   N-ACP-OBS-1 — payload.newsContext 와 input.newsContext 는 다른 layer.
 *                 본 adapter 는 caller 가 주입한 input.newsContext 만 정규화.
 *                 payload.newsContext 를 read / write 하지 않음.
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
 *   raw external response 저장.
 *   bot 식별 시크릿 / 채널 식별자 / API 키.
 *   payload.newsContext 직접 read.
 *   본 점수 / 매매 판단 대체.
 *
 * 의존:
 *   외부 caller 가 주입한 보조 context 객체.
 *   - btcMarketState / altMarketState / sectorState
 *   - exchangeContext / liquidityContext
 *   - scheduleContext / newsContext / riskContext
 */

(function (global) {
  'use strict';

  var CONFLUENCE_VERSION = 'WS3_v0.11.0_confluence';
  var CONFIG_VERSION = 'inline-default-v0';

  // ==========================================================================
  // 라벨 후보
  // ==========================================================================
  var MARKET_STATE = Object.freeze({
    UNKNOWN: 'UNKNOWN',
    BULL: 'BULL',
    BEAR: 'BEAR',
    SIDEWAYS: 'SIDEWAYS',
    NEUTRAL: 'NEUTRAL',
    RISK_OFF: 'RISK_OFF'
  });

  var SECTOR_STATE = Object.freeze({
    UNKNOWN: 'UNKNOWN',
    STRONG: 'STRONG',
    NEUTRAL: 'NEUTRAL',
    WEAK: 'WEAK'
  });

  var EXCHANGE_STATE = Object.freeze({
    UNKNOWN: 'UNKNOWN',
    NORMAL: 'NORMAL',
    THIN_LIQUIDITY: 'THIN_LIQUIDITY',
    HIGH_LIQUIDITY: 'HIGH_LIQUIDITY',
    HALTED: 'HALTED',
    DEGRADED: 'DEGRADED'
  });

  var SCHEDULE_RISK = Object.freeze({
    UNKNOWN: 'UNKNOWN',
    LOW: 'LOW',
    MEDIUM: 'MEDIUM',
    HIGH: 'HIGH',
    CRITICAL: 'CRITICAL'
  });

  var NEWS_TONE = Object.freeze({
    UNKNOWN: 'UNKNOWN',
    POSITIVE: 'POSITIVE',
    NEUTRAL: 'NEUTRAL',
    NEGATIVE: 'NEGATIVE',
    MIXED: 'MIXED'
  });

  var CONFLUENCE_LABEL = Object.freeze({
    UNKNOWN: 'UNKNOWN',
    FAVORABLE: 'FAVORABLE',
    NEUTRAL: 'NEUTRAL',
    ADVERSE: 'ADVERSE',
    MIXED: 'MIXED'
  });

  // ==========================================================================
  // DEFAULT_EXTERNAL_CONFLUENCE_CONFIG
  // ==========================================================================
  var DEFAULT_EXTERNAL_CONFLUENCE_CONFIG = Object.freeze({
    version: CONFIG_VERSION,
    confluence: Object.freeze({
      minScore: -100,
      maxScore: 100,
      neutralScore: 0,
      enableScore: false,
      favorableThreshold: 30,
      adverseThreshold: -30
    }),
    labels: Object.freeze({
      unknown: 'UNKNOWN',
      favorable: 'FAVORABLE',
      neutral: 'NEUTRAL',
      adverse: 'ADVERSE',
      mixed: 'MIXED'
    }),
    allowedMarketStates: Object.freeze(['UNKNOWN', 'BULL', 'BEAR', 'SIDEWAYS', 'NEUTRAL', 'RISK_OFF']),
    allowedSectorStates: Object.freeze(['UNKNOWN', 'STRONG', 'NEUTRAL', 'WEAK']),
    allowedExchangeStates: Object.freeze(['UNKNOWN', 'NORMAL', 'THIN_LIQUIDITY', 'HIGH_LIQUIDITY', 'HALTED', 'DEGRADED']),
    allowedScheduleRisks: Object.freeze(['UNKNOWN', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
    allowedNewsTones: Object.freeze(['UNKNOWN', 'POSITIVE', 'NEUTRAL', 'NEGATIVE', 'MIXED']),
    debug: Object.freeze({
      enabled: false,
      allowedFields: Object.freeze([])
    })
  });

  function mergeExternalConfluenceConfig(config) {
    var c = config || {};
    var d = DEFAULT_EXTERNAL_CONFLUENCE_CONFIG;
    var co = c.confluence || {};
    var la = c.labels || {};
    var dbg = c.debug || {};
    return {
      version: typeof c.version === 'string' ? c.version : d.version,
      confluence: {
        minScore: safeNumber(co.minScore, d.confluence.minScore),
        maxScore: safeNumber(co.maxScore, d.confluence.maxScore),
        neutralScore: safeNumber(co.neutralScore, d.confluence.neutralScore),
        enableScore: co.enableScore === true,
        favorableThreshold: safeNumber(co.favorableThreshold, d.confluence.favorableThreshold),
        adverseThreshold: safeNumber(co.adverseThreshold, d.confluence.adverseThreshold)
      },
      labels: {
        unknown: safeString(la.unknown, d.labels.unknown),
        favorable: safeString(la.favorable, d.labels.favorable),
        neutral: safeString(la.neutral, d.labels.neutral),
        adverse: safeString(la.adverse, d.labels.adverse),
        mixed: safeString(la.mixed, d.labels.mixed)
      },
      allowedMarketStates: Array.isArray(c.allowedMarketStates)
        ? c.allowedMarketStates.filter(function (s) { return typeof s === 'string' && s; })
        : d.allowedMarketStates.slice(),
      allowedSectorStates: Array.isArray(c.allowedSectorStates)
        ? c.allowedSectorStates.filter(function (s) { return typeof s === 'string' && s; })
        : d.allowedSectorStates.slice(),
      allowedExchangeStates: Array.isArray(c.allowedExchangeStates)
        ? c.allowedExchangeStates.filter(function (s) { return typeof s === 'string' && s; })
        : d.allowedExchangeStates.slice(),
      allowedScheduleRisks: Array.isArray(c.allowedScheduleRisks)
        ? c.allowedScheduleRisks.filter(function (s) { return typeof s === 'string' && s; })
        : d.allowedScheduleRisks.slice(),
      allowedNewsTones: Array.isArray(c.allowedNewsTones)
        ? c.allowedNewsTones.filter(function (s) { return typeof s === 'string' && s; })
        : d.allowedNewsTones.slice(),
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
      confluence: {
        minScore: cfg.confluence.minScore,
        maxScore: cfg.confluence.maxScore,
        neutralScore: cfg.confluence.neutralScore,
        enableScore: cfg.confluence.enableScore,
        favorableThreshold: cfg.confluence.favorableThreshold,
        adverseThreshold: cfg.confluence.adverseThreshold
      },
      labels: {
        unknown: cfg.labels.unknown,
        favorable: cfg.labels.favorable,
        neutral: cfg.labels.neutral,
        adverse: cfg.labels.adverse,
        mixed: cfg.labels.mixed
      },
      allowedMarketStates: cfg.allowedMarketStates.slice(),
      allowedSectorStates: cfg.allowedSectorStates.slice(),
      allowedExchangeStates: cfg.allowedExchangeStates.slice(),
      allowedScheduleRisks: cfg.allowedScheduleRisks.slice(),
      allowedNewsTones: cfg.allowedNewsTones.slice(),
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

  function pickAllowedLabel(value, allowed, fallback) {
    if (typeof value !== 'string' || !value) return { value: fallback, fallback: true };
    if (Array.isArray(allowed) && allowed.indexOf(value) !== -1) return { value: value, fallback: false };
    return { value: fallback, fallback: true };
  }

  // ==========================================================================
  // §normalizeMarketContext
  //   input.btcMarketState / input.altMarketState 또는 input 자체에서 추출.
  //   payload.marketContext 와 무관 (caller 가 주입한 input 만 사용).
  // ==========================================================================
  function normalizeMarketContext(input, cfg) {
    var out = {
      btcMarketState: 'UNKNOWN',
      altMarketState: 'UNKNOWN',
      marketRisk: 'UNKNOWN',
      _warnings: []
    };
    if (!isPlainObject(input)) return out;

    var btcRaw = (typeof input.btcMarketState === 'string') ? input.btcMarketState
                  : (isPlainObject(input.btcMarketState) && typeof input.btcMarketState.state === 'string'
                     ? input.btcMarketState.state : null);
    var altRaw = (typeof input.altMarketState === 'string') ? input.altMarketState
                  : (isPlainObject(input.altMarketState) && typeof input.altMarketState.state === 'string'
                     ? input.altMarketState.state : null);

    var btc = pickAllowedLabel(btcRaw, cfg.allowedMarketStates, 'UNKNOWN');
    var alt = pickAllowedLabel(altRaw, cfg.allowedMarketStates, 'UNKNOWN');

    out.btcMarketState = btc.value;
    out.altMarketState = alt.value;
    if (btc.fallback && btcRaw !== null) out._warnings.push('INVALID_BTC_MARKET_STATE:' + btcRaw);
    if (alt.fallback && altRaw !== null) out._warnings.push('INVALID_ALT_MARKET_STATE:' + altRaw);

    // marketRisk 파생 (단순 규칙)
    if (btc.value === 'RISK_OFF' || alt.value === 'RISK_OFF') {
      out.marketRisk = 'HIGH';
    } else if (btc.value === 'BEAR' || alt.value === 'BEAR') {
      out.marketRisk = 'ELEVATED';
    } else if (btc.value === 'SIDEWAYS' || alt.value === 'SIDEWAYS') {
      out.marketRisk = 'NEUTRAL';
    } else if (btc.value === 'BULL' || alt.value === 'BULL') {
      out.marketRisk = 'LOW';
    } else if (btc.value === 'NEUTRAL' && alt.value === 'NEUTRAL') {
      out.marketRisk = 'NEUTRAL';
    } else {
      out.marketRisk = 'UNKNOWN';
    }
    return out;
  }

  // ==========================================================================
  // §normalizeSectorContext
  // ==========================================================================
  function normalizeSectorContext(input, cfg) {
    var out = {
      sectorState: 'UNKNOWN',
      sectorStrength: 'UNKNOWN',
      _warnings: []
    };
    if (!isPlainObject(input)) return out;

    var raw = null;
    if (typeof input.sectorState === 'string') raw = input.sectorState;
    else if (isPlainObject(input.sectorState) && typeof input.sectorState.state === 'string') {
      raw = input.sectorState.state;
    }

    var ss = pickAllowedLabel(raw, cfg.allowedSectorStates, 'UNKNOWN');
    out.sectorState = ss.value;
    if (ss.fallback && raw !== null) out._warnings.push('INVALID_SECTOR_STATE:' + raw);

    if (ss.value === 'STRONG') out.sectorStrength = 'STRONG';
    else if (ss.value === 'WEAK') out.sectorStrength = 'WEAK';
    else if (ss.value === 'NEUTRAL') out.sectorStrength = 'NEUTRAL';
    else out.sectorStrength = 'UNKNOWN';
    return out;
  }

  // ==========================================================================
  // §normalizeExchangeContext
  // ==========================================================================
  function normalizeExchangeContext(input, cfg) {
    var out = {
      exchangeContext: 'UNKNOWN',
      liquidityContext: 'UNKNOWN',
      _warnings: []
    };
    if (!isPlainObject(input)) return out;

    var exRaw = (typeof input.exchangeContext === 'string') ? input.exchangeContext
                  : (isPlainObject(input.exchangeContext) && typeof input.exchangeContext.state === 'string'
                     ? input.exchangeContext.state : null);
    var liqRaw = (typeof input.liquidityContext === 'string') ? input.liquidityContext
                  : (isPlainObject(input.liquidityContext) && typeof input.liquidityContext.state === 'string'
                     ? input.liquidityContext.state : null);

    var ex = pickAllowedLabel(exRaw, cfg.allowedExchangeStates, 'UNKNOWN');
    out.exchangeContext = ex.value;
    if (ex.fallback && exRaw !== null) out._warnings.push('INVALID_EXCHANGE_CONTEXT:' + exRaw);

    if (liqRaw !== null) {
      var liq = pickAllowedLabel(liqRaw, cfg.allowedExchangeStates, 'UNKNOWN');
      out.liquidityContext = liq.value;
      if (liq.fallback) out._warnings.push('INVALID_LIQUIDITY_CONTEXT:' + liqRaw);
    } else {
      // liquidity 미주입 시 exchange 에서 파생
      if (ex.value === 'THIN_LIQUIDITY') out.liquidityContext = 'THIN_LIQUIDITY';
      else if (ex.value === 'HIGH_LIQUIDITY') out.liquidityContext = 'HIGH_LIQUIDITY';
      else out.liquidityContext = 'UNKNOWN';
    }
    return out;
  }

  // ==========================================================================
  // §normalizeScheduleContext
  // ==========================================================================
  function normalizeScheduleContext(input, cfg) {
    var out = {
      hasKnownEvent: false,
      eventType: 'NONE',
      eventRisk: 'UNKNOWN',
      _warnings: []
    };
    if (!isPlainObject(input)) return out;
    var sc = isPlainObject(input.scheduleContext) ? input.scheduleContext : null;
    if (!sc) return out;

    out.hasKnownEvent = sc.hasKnownEvent === true;
    if (typeof sc.eventType === 'string' && sc.eventType) {
      out.eventType = sc.eventType;
    }
    var rr = pickAllowedLabel(typeof sc.eventRisk === 'string' ? sc.eventRisk : null,
                              cfg.allowedScheduleRisks, 'UNKNOWN');
    out.eventRisk = rr.value;
    if (rr.fallback && sc.eventRisk !== null && sc.eventRisk !== undefined) {
      out._warnings.push('INVALID_EVENT_RISK:' + String(sc.eventRisk));
    }
    return out;
  }

  // ==========================================================================
  // §normalizeNewsContext (N-ACP-OBS-1 — input.newsContext 만, payload 미read)
  // ==========================================================================
  function normalizeNewsContext(input, cfg) {
    var out = {
      hasNews: false,
      newsTone: 'UNKNOWN',
      _warnings: []
    };
    if (!isPlainObject(input)) return out;
    var nc = isPlainObject(input.newsContext) ? input.newsContext : null;
    if (!nc) return out;

    out.hasNews = nc.hasNews === true;
    var toneRaw = (typeof nc.newsTone === 'string') ? nc.newsTone : null;
    var tr = pickAllowedLabel(toneRaw, cfg.allowedNewsTones, 'UNKNOWN');
    out.newsTone = tr.value;
    if (tr.fallback && toneRaw !== null) out._warnings.push('INVALID_NEWS_TONE:' + toneRaw);
    return out;
  }

  // ==========================================================================
  // §normalizeRiskContext
  //   riskContext 는 캡션 / level / flags 같은 다양한 구조를 가질 수 있어
  //   safe scalar / flag boolean 만 추출.
  // ==========================================================================
  function normalizeRiskContext(input, cfg) {
    var out = {
      riskLevel: 'UNKNOWN',
      riskFlags: [],
      _warnings: []
    };
    if (!isPlainObject(input)) return out;
    var rc = isPlainObject(input.riskContext) ? input.riskContext : null;
    if (!rc) return out;

    if (typeof rc.level === 'string' && rc.level) out.riskLevel = rc.level;
    if (Array.isArray(rc.flags)) {
      for (var i = 0; i < rc.flags.length; i = i + 1) {
        var f = rc.flags[i];
        if (typeof f === 'string' && f && out.riskFlags.indexOf(f) === -1) {
          out.riskFlags.push(f);
        }
      }
    }
    return out;
  }

  // ==========================================================================
  // §calculateConfluenceScore (U-ACP-2)
  //   cfg.confluence.enableScore === false → null 반환 (기본).
  //   true 인 경우에만 정량화 시도. 정량화 불충분 → null.
  //   매매 점수 아님. 운영 상태 비교용 보조 점수.
  // ==========================================================================
  function calculateConfluenceScore(normalized, cfg) {
    if (!cfg || !cfg.confluence || cfg.confluence.enableScore !== true) return null;
    if (!isPlainObject(normalized)) return null;

    var mn = cfg.confluence.minScore;
    var mx = cfg.confluence.maxScore;
    if (typeof mn !== 'number' || typeof mx !== 'number' || !isFinite(mn) || !isFinite(mx) || mn >= mx) {
      return null;
    }

    var contributions = [];

    // market: BULL=+25 / BEAR=-25 / SIDEWAYS=0 / RISK_OFF=-30 / NEUTRAL=0 / UNKNOWN=skip
    if (isPlainObject(normalized.market)) {
      var btc = normalized.market.btcMarketState;
      var alt = normalized.market.altMarketState;
      if (btc === 'BULL') contributions.push(25);
      else if (btc === 'BEAR') contributions.push(-25);
      else if (btc === 'RISK_OFF') contributions.push(-30);
      else if (btc === 'SIDEWAYS' || btc === 'NEUTRAL') contributions.push(0);
      if (alt === 'BULL') contributions.push(15);
      else if (alt === 'BEAR') contributions.push(-15);
      else if (alt === 'RISK_OFF') contributions.push(-20);
      else if (alt === 'SIDEWAYS' || alt === 'NEUTRAL') contributions.push(0);
    }

    // sector: STRONG=+15 / WEAK=-15 / NEUTRAL=0 / UNKNOWN=skip
    if (isPlainObject(normalized.sector)) {
      var ss = normalized.sector.sectorState;
      if (ss === 'STRONG') contributions.push(15);
      else if (ss === 'WEAK') contributions.push(-15);
      else if (ss === 'NEUTRAL') contributions.push(0);
    }

    // exchange / liquidity: THIN=-10 / HIGH=+5 / HALTED=-30 / DEGRADED=-20 / NORMAL=0
    if (isPlainObject(normalized.exchange)) {
      var ex = normalized.exchange.exchangeContext;
      var liq = normalized.exchange.liquidityContext;
      if (ex === 'THIN_LIQUIDITY') contributions.push(-10);
      else if (ex === 'HIGH_LIQUIDITY') contributions.push(5);
      else if (ex === 'HALTED') contributions.push(-30);
      else if (ex === 'DEGRADED') contributions.push(-20);
      else if (ex === 'NORMAL') contributions.push(0);
      if (liq === 'THIN_LIQUIDITY' && ex !== 'THIN_LIQUIDITY') contributions.push(-5);
      if (liq === 'HIGH_LIQUIDITY' && ex !== 'HIGH_LIQUIDITY') contributions.push(5);
    }

    // schedule: HIGH=-15 / CRITICAL=-25 / MEDIUM=-5 / LOW=0
    if (isPlainObject(normalized.schedule)) {
      var er = normalized.schedule.eventRisk;
      if (er === 'CRITICAL') contributions.push(-25);
      else if (er === 'HIGH') contributions.push(-15);
      else if (er === 'MEDIUM') contributions.push(-5);
      else if (er === 'LOW') contributions.push(0);
    }

    // news: POSITIVE=+10 / NEGATIVE=-10 / MIXED=-5 / NEUTRAL=0
    if (isPlainObject(normalized.news)) {
      var tone = normalized.news.newsTone;
      if (tone === 'POSITIVE') contributions.push(10);
      else if (tone === 'NEGATIVE') contributions.push(-10);
      else if (tone === 'MIXED') contributions.push(-5);
      else if (tone === 'NEUTRAL') contributions.push(0);
    }

    // 정량화 불충분 — 기여 0건이면 null 유지
    if (contributions.length === 0) return null;

    var sum = 0;
    for (var i = 0; i < contributions.length; i = i + 1) sum = sum + contributions[i];
    // clamp
    if (sum < mn) sum = mn;
    if (sum > mx) sum = mx;
    return sum;
  }

  // ==========================================================================
  // §classifyConfluenceLabel
  // ==========================================================================
  function classifyConfluenceLabel(score, normalized, cfg) {
    var labels = cfg.labels;
    if (score === null || typeof score !== 'number' || !isFinite(score)) {
      // score 없을 때 — normalized 의 market.risk + news 기반 간단 분류 시도. 불충분 시 UNKNOWN
      if (isPlainObject(normalized) && isPlainObject(normalized.market)) {
        var mr = normalized.market.marketRisk;
        if (mr === 'HIGH') return labels.adverse;
        if (mr === 'ELEVATED') return labels.adverse;
        if (mr === 'LOW') return labels.favorable;
        if (mr === 'NEUTRAL') return labels.neutral;
      }
      return labels.unknown;
    }
    var fav = cfg.confluence.favorableThreshold;
    var adv = cfg.confluence.adverseThreshold;
    if (score >= fav) return labels.favorable;
    if (score <= adv) return labels.adverse;
    return labels.neutral;
  }

  // ==========================================================================
  // §normalize 출력
  // ==========================================================================
  function normalizeExternalConfluence(result) {
    return {
      valid: result.valid === true,
      version: CONFLUENCE_VERSION,
      market: result.market,
      sector: result.sector,
      exchange: result.exchange,
      schedule: result.schedule,
      news: result.news,
      confluenceScore: (typeof result.confluenceScore === 'number' && isFinite(result.confluenceScore))
        ? result.confluenceScore : null,
      confluenceLabel: typeof result.confluenceLabel === 'string' ? result.confluenceLabel : 'UNKNOWN',
      reasons: Array.isArray(result.reasons) ? result.reasons.slice() : [],
      warnings: Array.isArray(result.warnings) ? result.warnings.slice() : [],
      debug: result.debug,
      configUsed: result.configUsed
    };
  }

  // ==========================================================================
  // §main — buildExternalConfluence
  // ==========================================================================
  /**
   * 외부 보조 신호 → standalone externalConfluence.
   * 입력 mutate 0건 (DP-ACP8).
   *
   * @param {Object} input
   * @param {Object} [config]
   * @return {Object} externalConfluence
   */
  function buildExternalConfluence(input, config) {
    var cfg = mergeExternalConfluenceConfig(config);
    var configUsed = makeConfigUsed(cfg);

    var reasons = [];
    var warnings = [];

    var marketCtx = normalizeMarketContext(input, cfg);
    var sectorCtx = normalizeSectorContext(input, cfg);
    var exchangeCtx = normalizeExchangeContext(input, cfg);
    var scheduleCtx = normalizeScheduleContext(input, cfg);
    var newsCtx = normalizeNewsContext(input, cfg);
    var riskCtx = normalizeRiskContext(input, cfg);

    // warnings 누적
    var addWarnings = function (arr) {
      for (var i = 0; i < arr.length; i = i + 1) {
        var w = arr[i];
        if (typeof w !== 'string' || !w) continue;
        if (warnings.indexOf(w) === -1) warnings.push(w);
      }
    };
    addWarnings(marketCtx._warnings);
    addWarnings(sectorCtx._warnings);
    addWarnings(exchangeCtx._warnings);
    addWarnings(scheduleCtx._warnings);
    addWarnings(newsCtx._warnings);
    addWarnings(riskCtx._warnings);

    // public output (internal _warnings 제외)
    var market = {
      btcMarketState: marketCtx.btcMarketState,
      altMarketState: marketCtx.altMarketState,
      marketRisk: marketCtx.marketRisk
    };
    var sector = {
      sectorState: sectorCtx.sectorState,
      sectorStrength: sectorCtx.sectorStrength
    };
    var exchange = {
      exchangeContext: exchangeCtx.exchangeContext,
      liquidityContext: exchangeCtx.liquidityContext
    };
    var schedule = {
      hasKnownEvent: scheduleCtx.hasKnownEvent,
      eventType: scheduleCtx.eventType,
      eventRisk: scheduleCtx.eventRisk
    };
    var news = {
      hasNews: newsCtx.hasNews,
      newsTone: newsCtx.newsTone
    };

    var normalized = {
      market: market,
      sector: sector,
      exchange: exchange,
      schedule: schedule,
      news: news,
      risk: { riskLevel: riskCtx.riskLevel, riskFlags: riskCtx.riskFlags.slice() }
    };

    // U-ACP-2 — score (기본 null)
    var score = calculateConfluenceScore(normalized, cfg);
    var label = classifyConfluenceLabel(score, normalized, cfg);

    // reasons
    pushReason({ reasons: reasons }, 'MARKET_' + market.btcMarketState);
    pushReason({ reasons: reasons }, 'SECTOR_' + sector.sectorState);
    pushReason({ reasons: reasons }, 'EXCHANGE_' + exchange.exchangeContext);
    pushReason({ reasons: reasons }, 'CONFLUENCE_LABEL_' + label);
    if (cfg.confluence.enableScore !== true) pushReason({ reasons: reasons }, 'SCORE_DISABLED');

    // valid 판정 — input 존재 + 적어도 하나의 known 라벨
    var valid = isPlainObject(input)
                && (market.btcMarketState !== 'UNKNOWN'
                    || market.altMarketState !== 'UNKNOWN'
                    || sector.sectorState !== 'UNKNOWN'
                    || exchange.exchangeContext !== 'UNKNOWN'
                    || scheduleCtx.hasKnownEvent === true
                    || newsCtx.hasNews === true
                    || riskCtx.riskLevel !== 'UNKNOWN'
                    || riskCtx.riskFlags.length > 0);

    return normalizeExternalConfluence({
      valid: valid,
      market: market,
      sector: sector,
      exchange: exchange,
      schedule: schedule,
      news: news,
      confluenceScore: score,
      confluenceLabel: label,
      reasons: reasons,
      warnings: warnings,
      debug: {
        source: 'externalConfluence input (caller-provided)',
        configVersion: cfg.version
      },
      configUsed: configUsed
    });
  }

  // ==========================================================================
  // §export — 이중 환경
  // ==========================================================================
  var api = Object.freeze({
    CONFLUENCE_VERSION: CONFLUENCE_VERSION,
    CONFIG_VERSION: CONFIG_VERSION,
    DEFAULT_EXTERNAL_CONFLUENCE_CONFIG: DEFAULT_EXTERNAL_CONFLUENCE_CONFIG,

    MARKET_STATE: MARKET_STATE,
    SECTOR_STATE: SECTOR_STATE,
    EXCHANGE_STATE: EXCHANGE_STATE,
    SCHEDULE_RISK: SCHEDULE_RISK,
    NEWS_TONE: NEWS_TONE,
    CONFLUENCE_LABEL: CONFLUENCE_LABEL,

    build: buildExternalConfluence,
    mergeExternalConfluenceConfig: mergeExternalConfluenceConfig,

    normalizeMarketContext: normalizeMarketContext,
    normalizeSectorContext: normalizeSectorContext,
    normalizeExchangeContext: normalizeExchangeContext,
    normalizeScheduleContext: normalizeScheduleContext,
    normalizeNewsContext: normalizeNewsContext,
    normalizeRiskContext: normalizeRiskContext,

    calculateConfluenceScore: calculateConfluenceScore,
    classifyConfluenceLabel: classifyConfluenceLabel,

    normalizeExternalConfluence: normalizeExternalConfluence,
    pushReason: pushReason,
    pushWarning: pushWarning
  });

  global.WS3_ExternalConfluence = api;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis
   : typeof window !== 'undefined' ? window
   : typeof self !== 'undefined' ? self
   : this);
