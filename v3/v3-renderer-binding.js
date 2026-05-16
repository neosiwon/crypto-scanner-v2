/**
 * WS3 v0.12.0 — RendererBinding (Adapter Output Contract Pack)
 *
 * Scope:
 *   cardViewModel (v0.7.0) + operationPacket (v0.8.0) +
 *   activeCycleDecision (v0.9.0) + evaluationOutcome (v0.10.0) +
 *   externalConfluence (v0.11.0) + transportPlan (v0.12.0)
 *   → standalone RendererBinding (UI binding 객체. DOM-free)
 *
 * 단일 기준 문서:
 *   docs/ws3/WS3_CODE_CONTRACT.md (b-r2 박제본)
 *
 * 확정 DP 정책 (Gate 2 spec):
 *   DP-APO1   output adapter contract 만. 실제 DOM 구현 X.
 *   DP-APO5   UI binding 객체 만. DOM / HTML / CSS / event 연결 금지.
 *   DP-APO6   v0.7.0 cardViewModel superset (대체 X).
 *             cardViewModel.header / chips / metrics 가능한 보존.
 *             cardViewModel.sections.strategy object → display item array 로 변환.
 *   DP-APO7   ExternalConfluence 참고만. scoreBreakdown / strategyPlan 대체 금지.
 *   DP-APO8   입력 6종 read-only.
 *   DP-APO9   fetch / Telegram / KV / DB / DOM / storage / 런타임 clock 금지.
 *   DP-APO10  신규 파일 2개 + 문서 갱신만.
 *
 * U-APO 확정 처리:
 *   U-APO-1 Option B — sections.* 모두 array 로 통일 (strategy/lifecycle/evaluation/
 *                       confluence/transport). cardViewModel.sections.strategy object 는
 *                       display item array 로 변환. cardViewModel 원본 mutate 0건.
 *   U-APO-2 Option A — displayMode 7 후보 (UNKNOWN/DEFAULT/ALERT/REVIEW/CLOSED/BLOCKED/COOLDOWN).
 *                       우선순위: BLOCKED → COOLDOWN → CLOSED → REVIEW → ALERT → DEFAULT → UNKNOWN.
 *   U-APO-3 Option C — flags namespace 분리: flags.binding (visibility / warning) +
 *                       flags.card (cardViewModel.displayFlags 보존).
 *
 * 금지 (이번 단계):
 *   DOM 접근 / innerHTML / document. / addEventListener / className / style. /
 *   querySelector / getElementById.
 *   CSS 생성 / index.html 수정 / HTML 문자열 생성.
 *   실제 발송 / 저장 / 평가 / fetch / 영속 storage / 런타임 clock.
 *   입력 6종 mutation / delete.
 *   "발송됨 / 저장됨 / 전송 완료 / sent / delivered / completed transmission" 문구.
 *   bot 식별 시크릿 / 채널 식별자 / API 키.
 *   raw payload / payload.raw / identityInput / raw.builderDebug 직접 노출.
 *
 * 의존:
 *   cardViewModel             (v3-card-view-model.js 산출)
 *   operationPacket           (v3-operation-packet.js 산출)
 *   activeCycleDecision       (v3-active-cycle.js 산출)
 *   evaluationOutcome         (v3-evaluation-outcome.js 산출)
 *   externalConfluence        (v3-external-confluence.js 산출)
 *   transportPlan             (v3-transport-plan.js 산출)
 */

(function (global) {
  'use strict';

  var RENDERER_BINDING_VERSION = 'WS3_v0.12.0_renderer_binding';
  var CONFIG_VERSION = 'inline-default-v0';

  // ==========================================================================
  // 상수 (U-APO-2)
  // ==========================================================================
  var DISPLAY_MODE = Object.freeze({
    UNKNOWN: 'UNKNOWN',
    DEFAULT: 'DEFAULT',
    ALERT: 'ALERT',
    REVIEW: 'REVIEW',
    CLOSED: 'CLOSED',
    BLOCKED: 'BLOCKED',
    COOLDOWN: 'COOLDOWN'
  });

  // ==========================================================================
  // DEFAULT_RENDERER_BINDING_CONFIG
  // ==========================================================================
  var DEFAULT_RENDERER_BINDING_CONFIG = Object.freeze({
    version: CONFIG_VERSION,
    sections: Object.freeze({
      showStrategy: true,
      showLifecycle: true,
      showEvaluation: true,
      showConfluence: true,
      showTransport: true
    }),
    wording: Object.freeze({
      dryRunOnly: true
    }),
    debug: Object.freeze({
      enabled: false,
      allowedFields: Object.freeze([])
    })
  });

  function mergeRendererBindingConfig(config) {
    var c = config || {};
    var d = DEFAULT_RENDERER_BINDING_CONFIG;
    var sec = c.sections || {};
    var wd = c.wording || {};
    var dbg = c.debug || {};
    return {
      version: typeof c.version === 'string' ? c.version : d.version,
      sections: {
        showStrategy: sec.showStrategy !== false,
        showLifecycle: sec.showLifecycle !== false,
        showEvaluation: sec.showEvaluation !== false,
        showConfluence: sec.showConfluence !== false,
        showTransport: sec.showTransport !== false
      },
      wording: { dryRunOnly: wd.dryRunOnly !== false },
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
      sections: {
        showStrategy: cfg.sections.showStrategy,
        showLifecycle: cfg.sections.showLifecycle,
        showEvaluation: cfg.sections.showEvaluation,
        showConfluence: cfg.sections.showConfluence,
        showTransport: cfg.sections.showTransport
      },
      wording: { dryRunOnly: cfg.wording.dryRunOnly },
      debug: {
        enabled: cfg.debug.enabled,
        allowedFields: cfg.debug.allowedFields.slice()
      }
    };
  }

  // ==========================================================================
  // 공통 helper
  // ==========================================================================
  function safeString(value, fallback) {
    if (typeof value === 'string' && value) return value;
    return (typeof fallback === 'string') ? fallback : null;
  }

  function safeNumber(value, fallback) {
    var fb = (fallback === undefined) ? null : fallback;
    if (value === null || value === undefined) return fb;
    if (typeof value === 'number') return isFinite(value) ? value : fb;
    return fb;
  }

  function isPlainObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  function pickArray(value) {
    return Array.isArray(value) ? value : [];
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

  function makeItem(id, label, value, tone, meta) {
    return {
      id: typeof id === 'string' ? id : null,
      label: typeof label === 'string' ? label : null,
      value: (value === undefined) ? null : value,
      tone: typeof tone === 'string' ? tone : 'neutral',
      meta: isPlainObject(meta) ? meta : {}
    };
  }

  // ==========================================================================
  // §buildHeaderBinding (cardViewModel.header 우선 보존)
  // ==========================================================================
  function buildHeaderBinding(cardViewModel, activeCycleDecision, evaluationOutcome, cfg) {
    var out = {
      title: null,
      subtitle: null,
      primaryBadge: null,
      statusText: null
    };
    if (isPlainObject(cardViewModel) && isPlainObject(cardViewModel.header)) {
      var h = cardViewModel.header;
      out.title = safeString(h.title, null);
      out.subtitle = safeString(h.subtitle, null);
      if (isPlainObject(h.primaryBadge)) {
        out.primaryBadge = {
          id: safeString(h.primaryBadge.id, null),
          labelKey: safeString(h.primaryBadge.labelKey, null),
          labelKo: safeString(h.primaryBadge.labelKo, null),
          labelEn: safeString(h.primaryBadge.labelEn, null),
          tone: safeString(h.primaryBadge.tone, 'neutral')
        };
      }
    }

    // statusText — activeCycleDecision.lifecycle.lifecycleState + evaluationOutcome.evaluation.status
    var parts = [];
    if (isPlainObject(activeCycleDecision) && isPlainObject(activeCycleDecision.lifecycle)) {
      var lcs = safeString(activeCycleDecision.lifecycle.lifecycleState, null);
      if (lcs && lcs !== 'NONE') parts.push('LC:' + lcs);
    }
    if (isPlainObject(evaluationOutcome) && isPlainObject(evaluationOutcome.evaluation)) {
      var st = safeString(evaluationOutcome.evaluation.status, null);
      if (st && st !== 'UNKNOWN') parts.push('EV:' + st);
    }
    if (parts.length > 0) out.statusText = parts.join(' / ');

    return out;
  }

  // ==========================================================================
  // §buildChipBindings (cardViewModel.chips 우선 보존 + lifecycle/evaluation/confluence chip 추가)
  // ==========================================================================
  function buildChipBindings(cardViewModel, operationPacket, activeCycleDecision, evaluationOutcome, externalConfluence, cfg) {
    var chips = [];

    // cardViewModel.chips 보존
    if (isPlainObject(cardViewModel) && Array.isArray(cardViewModel.chips)) {
      for (var i = 0; i < cardViewModel.chips.length; i = i + 1) {
        var c = cardViewModel.chips[i];
        if (!isPlainObject(c)) continue;
        chips.push({
          id: safeString(c.id, null),
          labelKey: safeString(c.labelKey, null),
          labelKo: safeString(c.labelKo, null),
          labelEn: safeString(c.labelEn, null),
          tone: safeString(c.tone, 'neutral')
        });
      }
    }

    // lifecycle chip
    if (isPlainObject(activeCycleDecision) && isPlainObject(activeCycleDecision.lifecycle)) {
      var lcs = safeString(activeCycleDecision.lifecycle.lifecycleState, null);
      if (lcs && lcs !== 'NONE') {
        chips.push({
          id: 'LIFECYCLE_' + lcs, labelKey: lcs, labelKo: lcs, labelEn: lcs,
          tone: 'info'
        });
      }
    }

    // evaluation chip
    if (isPlainObject(evaluationOutcome) && isPlainObject(evaluationOutcome.evaluation)) {
      var rt = safeString(evaluationOutcome.evaluation.resultType, null);
      if (rt && rt !== 'NONE') {
        var rtTone = 'info';
        if (rt === 'TARGET_HIT' || rt === 'WATCH_CONFIRMED') rtTone = 'positive';
        else if (rt === 'INVALIDATED' || rt === 'WATCH_FAILED') rtTone = 'warning';
        else if (rt === 'DATA_AMBIGUOUS' || rt === 'DATA_INSUFFICIENT') rtTone = 'caution';
        else if (rt === 'EXPIRED_REVIEW' || rt === 'COOLDOWN_REVIEW') rtTone = 'muted';
        chips.push({
          id: 'RESULT_' + rt, labelKey: rt, labelKo: rt, labelEn: rt, tone: rtTone
        });
      }
    }

    // confluence chip (보조 context)
    if (isPlainObject(externalConfluence)) {
      var cl = safeString(externalConfluence.confluenceLabel, null);
      if (cl && cl !== 'UNKNOWN') {
        var clTone = 'info';
        if (cl === 'FAVORABLE') clTone = 'positive';
        else if (cl === 'ADVERSE') clTone = 'warning';
        else if (cl === 'MIXED') clTone = 'caution';
        else if (cl === 'NEUTRAL') clTone = 'neutral';
        chips.push({
          id: 'CONFLUENCE_' + cl, labelKey: cl, labelKo: cl, labelEn: cl, tone: clTone
        });
      }
    }

    return chips;
  }

  // ==========================================================================
  // §buildMetricBindings (cardViewModel.metrics 우선 보존 + evaluation movement 추가)
  // ==========================================================================
  function buildMetricBindings(cardViewModel, evaluationOutcome, externalConfluence, cfg) {
    var metrics = [];

    if (isPlainObject(cardViewModel) && Array.isArray(cardViewModel.metrics)) {
      for (var i = 0; i < cardViewModel.metrics.length; i = i + 1) {
        var m = cardViewModel.metrics[i];
        if (!isPlainObject(m)) continue;
        metrics.push({
          id: safeString(m.id, null),
          labelKey: safeString(m.labelKey, null),
          labelKo: safeString(m.labelKo, null),
          labelEn: safeString(m.labelEn, null),
          value: (m.value === undefined) ? null : m.value,
          kind: safeString(m.kind, 'string'),
          tone: safeString(m.tone, 'neutral'),
          sortKey: safeNumber(m.sortKey, 0)
        });
      }
    }

    // evaluation movement metric (pct 만 — DP-EO12 정합)
    if (isPlainObject(evaluationOutcome) && isPlainObject(evaluationOutcome.movement)) {
      var mv = evaluationOutcome.movement;
      var sortBase = metrics.length;
      if (typeof mv.maxFavorablePct === 'number' && isFinite(mv.maxFavorablePct)) {
        metrics.push({
          id: 'METRIC_MAX_FAVORABLE_PCT', labelKey: 'MAX_FAVORABLE_PCT',
          labelKo: '최대 유리 변화율', labelEn: 'Max Favorable Pct',
          value: mv.maxFavorablePct, kind: 'pct', tone: 'info', sortKey: sortBase
        });
      }
      if (typeof mv.maxAdversePct === 'number' && isFinite(mv.maxAdversePct)) {
        metrics.push({
          id: 'METRIC_MAX_ADVERSE_PCT', labelKey: 'MAX_ADVERSE_PCT',
          labelKo: '최대 불리 변화율', labelEn: 'Max Adverse Pct',
          value: mv.maxAdversePct, kind: 'pct', tone: 'caution', sortKey: sortBase + 1
        });
      }
    }

    // confluenceScore metric (numeric 일 때만)
    if (isPlainObject(externalConfluence)
        && typeof externalConfluence.confluenceScore === 'number'
        && isFinite(externalConfluence.confluenceScore)) {
      metrics.push({
        id: 'METRIC_CONFLUENCE_SCORE', labelKey: 'CONFLUENCE_SCORE',
        labelKo: '보조 점수', labelEn: 'Confluence Score',
        value: externalConfluence.confluenceScore, kind: 'score',
        tone: 'info', sortKey: metrics.length
      });
    }

    return metrics;
  }

  // ==========================================================================
  // §buildLifecycleSection (array of display items — U-APO-1 Option B)
  // ==========================================================================
  function buildLifecycleSection(activeCycleDecision, cfg) {
    var items = [];
    if (!isPlainObject(activeCycleDecision) || !isPlainObject(activeCycleDecision.lifecycle)) return items;
    var lc = activeCycleDecision.lifecycle;
    items.push(makeItem('lifecycleState', '라이프사이클 상태',
      safeString(lc.lifecycleState, 'NONE'), 'info', { source: 'activeCycleDecision' }));
    items.push(makeItem('lifecyclePhase', '단계',
      safeString(lc.lifecyclePhase, 'NONE'), 'neutral', { source: 'activeCycleDecision' }));
    if (typeof lc.seenCount === 'number' && isFinite(lc.seenCount)) {
      items.push(makeItem('seenCount', '관측 횟수', lc.seenCount, 'neutral',
        { kind: 'count' }));
    }
    if (typeof lc.ageMs === 'number' && isFinite(lc.ageMs)) {
      items.push(makeItem('ageMs', '경과 시간 (ms)', lc.ageMs, 'muted', { kind: 'ms' }));
    }
    // active flag
    items.push(makeItem('active', '활성 여부',
      lc.active === true ? 'YES' : 'NO',
      lc.active === true ? 'positive' : 'muted',
      {}));
    return items;
  }

  // ==========================================================================
  // §buildEvaluationSection (array of display items)
  //   금지: trading wording (손절/익절/수익 확정/profit/loss/매수 성공 등)
  // ==========================================================================
  function buildEvaluationSection(evaluationOutcome, cfg) {
    var items = [];
    if (!isPlainObject(evaluationOutcome)) return items;

    if (isPlainObject(evaluationOutcome.evaluation)) {
      var ev = evaluationOutcome.evaluation;
      items.push(makeItem('status', '진행 상태',
        safeString(ev.status, 'UNKNOWN'), 'info', {}));
      items.push(makeItem('resultType', '결과 분류',
        safeString(ev.resultType, 'NONE'), 'info', {}));
      items.push(makeItem('window', '평가 윈도우',
        safeString(ev.window, 'NONE'), 'muted', {}));
    }

    if (isPlainObject(evaluationOutcome.movement)) {
      var mv = evaluationOutcome.movement;
      if (typeof mv.currentChangePct === 'number' && isFinite(mv.currentChangePct)) {
        items.push(makeItem('currentChangePct', '현재 변화율',
          mv.currentChangePct, 'info', { kind: 'pct' }));
      }
    }

    if (isPlainObject(evaluationOutcome.targetCheck)) {
      var tc = evaluationOutcome.targetCheck;
      items.push(makeItem('targetHit', '목표 도달',
        tc.targetHit === true ? 'YES' : 'NO',
        tc.targetHit === true ? 'positive' : 'muted', { source: 'targetCheck' }));
    }

    if (isPlainObject(evaluationOutcome.invalidationCheck)) {
      var ic = evaluationOutcome.invalidationCheck;
      items.push(makeItem('invalidated', '무효화 발생',
        ic.invalidated === true ? 'YES' : 'NO',
        ic.invalidated === true ? 'warning' : 'muted', { source: 'invalidationCheck' }));
    }

    if (isPlainObject(evaluationOutcome.quality)) {
      var q = evaluationOutcome.quality;
      items.push(makeItem('outcomeQuality', '결과 신뢰도',
        safeString(q.outcomeQuality, 'UNKNOWN'), 'neutral', {}));
    }

    return items;
  }

  // ==========================================================================
  // §buildConfluenceSection (array of display items — 보조 context, DP-APO7)
  // ==========================================================================
  function buildConfluenceSection(externalConfluence, cfg) {
    var items = [];
    if (!isPlainObject(externalConfluence)) return items;

    if (isPlainObject(externalConfluence.market)) {
      items.push(makeItem('btcMarketState', 'BTC 시장 상태',
        safeString(externalConfluence.market.btcMarketState, 'UNKNOWN'), 'info', {}));
      items.push(makeItem('altMarketState', 'ALT 시장 상태',
        safeString(externalConfluence.market.altMarketState, 'UNKNOWN'), 'info', {}));
      items.push(makeItem('marketRisk', '시장 리스크',
        safeString(externalConfluence.market.marketRisk, 'UNKNOWN'), 'caution', {}));
    }
    if (isPlainObject(externalConfluence.sector)) {
      items.push(makeItem('sectorState', '섹터 상태',
        safeString(externalConfluence.sector.sectorState, 'UNKNOWN'), 'info', {}));
    }
    if (isPlainObject(externalConfluence.exchange)) {
      items.push(makeItem('exchangeContext', '거래소 상태',
        safeString(externalConfluence.exchange.exchangeContext, 'UNKNOWN'), 'info', {}));
      items.push(makeItem('liquidityContext', '유동성 상태',
        safeString(externalConfluence.exchange.liquidityContext, 'UNKNOWN'), 'info', {}));
    }
    if (isPlainObject(externalConfluence.schedule)) {
      var sc = externalConfluence.schedule;
      items.push(makeItem('eventRisk', '일정 리스크',
        safeString(sc.eventRisk, 'UNKNOWN'),
        sc.eventRisk === 'HIGH' || sc.eventRisk === 'CRITICAL' ? 'caution' : 'muted',
        { hasKnownEvent: sc.hasKnownEvent === true }));
    }
    if (isPlainObject(externalConfluence.news)) {
      items.push(makeItem('newsTone', '뉴스 톤',
        safeString(externalConfluence.news.newsTone, 'UNKNOWN'), 'info',
        { hasNews: externalConfluence.news.hasNews === true }));
    }

    items.push(makeItem('confluenceLabel', '보조 라벨',
      safeString(externalConfluence.confluenceLabel, 'UNKNOWN'), 'info', {}));
    if (typeof externalConfluence.confluenceScore === 'number'
        && isFinite(externalConfluence.confluenceScore)) {
      items.push(makeItem('confluenceScore', '보조 점수',
        externalConfluence.confluenceScore, 'info', { kind: 'score' }));
    }
    return items;
  }

  // ==========================================================================
  // §buildTransportSection (array of display items, dry-run wording 만 — §11)
  //   금지 표현: 발송됨 / 저장됨 / 전송 완료 / sent / delivered / completed transmission
  //   허용 표현: 발송 후보 / 발송 대기 / dry-run / 저장 계획 / 평가 저장 후보 / 리뷰 후보
  // ==========================================================================
  function buildTransportSection(transportPlan, cfg) {
    var items = [];
    if (!isPlainObject(transportPlan)) return items;

    if (isPlainObject(transportPlan.telegramPlan)) {
      var tp = transportPlan.telegramPlan;
      items.push(makeItem('telegramShouldSend',
        tp.shouldSend === true ? '발송 후보' : '발송 대기',
        tp.shouldSend === true ? 'YES (dry-run)' : 'NO',
        tp.shouldSend === true ? 'info' : 'muted',
        { messageType: safeString(tp.messageType, 'NONE'),
          channel: safeString(tp.channel, 'NONE') }));
    }

    if (isPlainObject(transportPlan.snapshotPlan)) {
      var sp = transportPlan.snapshotPlan;
      items.push(makeItem('snapshotShouldStore',
        sp.shouldStore === true ? '저장 계획' : '저장 대기',
        sp.shouldStore === true ? 'YES (dry-run)' : 'NO',
        sp.shouldStore === true ? 'info' : 'muted',
        { bucket: safeString(sp.bucket, 'NONE'),
          snapshotType: safeString(sp.snapshotType, 'NONE') }));
    }

    if (isPlainObject(transportPlan.evaluationPlan)) {
      var ep = transportPlan.evaluationPlan;
      items.push(makeItem('evaluationShouldStore',
        ep.shouldStore === true ? '평가 저장 후보' : '평가 저장 대기',
        ep.shouldStore === true ? 'YES (dry-run)' : 'NO',
        ep.shouldStore === true ? 'info' : 'muted',
        { resultType: safeString(ep.resultType, 'NONE') }));
      if (ep.shouldUpdate === true) {
        items.push(makeItem('evaluationShouldUpdate', '평가 갱신 후보', 'YES (dry-run)',
          'info', {}));
      }
      if (ep.shouldClose === true) {
        items.push(makeItem('evaluationShouldClose', '평가 종료 후보', 'YES (dry-run)',
          'info', {}));
      }
      if (ep.shouldReview === true) {
        items.push(makeItem('evaluationShouldReview', '평가 리뷰 후보', 'YES (dry-run)',
          'info', {}));
      }
    }

    if (isPlainObject(transportPlan.auditPlan)) {
      var ap = transportPlan.auditPlan;
      items.push(makeItem('auditShouldAudit',
        ap.shouldAudit === true ? '리뷰 후보' : '리뷰 대기',
        ap.shouldAudit === true ? 'YES (dry-run)' : 'NO',
        ap.shouldAudit === true ? 'caution' : 'muted',
        { auditType: safeString(ap.auditType, 'NONE') }));
    }

    return items;
  }

  // ==========================================================================
  // §buildStrategySection (cardViewModel.sections.strategy object → array — U-APO-1 Option B)
  // ==========================================================================
  function buildStrategySection(cardViewModel, cfg) {
    var items = [];
    if (!isPlainObject(cardViewModel) || !isPlainObject(cardViewModel.sections)) return items;
    var st = cardViewModel.sections.strategy;
    if (!isPlainObject(st)) return items;

    var biasTone = safeString(st.biasTone, 'neutral');
    items.push(makeItem('strategyBias', '전략 편향',
      safeString(st.strategyBias, 'UNKNOWN'), biasTone,
      { labelKo: safeString(st.biasLabelKo, null) }));
    items.push(makeItem('planType', '계획 유형',
      safeString(st.planType, 'NONE'), 'info', {}));
    items.push(makeItem('actionability', '실행 가능성',
      safeString(st.actionability, 'NONE'), 'info', {}));
    items.push(makeItem('planQualityTier', '계획 등급',
      safeString(st.planQualityTier, 'NONE'), 'info', {}));

    // entry / exit (numeric hint — DP-UI11 정합으로 sections.strategy 에서만 노출 가능)
    if (isPlainObject(st.entry)) {
      items.push(makeItem('entryValid', '진입 계획 유효',
        st.entry.valid === true ? 'YES' : 'NO',
        st.entry.valid === true ? 'positive' : 'muted',
        { type: safeString(st.entry.type, 'NONE'),
          entryZone: safeNumber(st.entry.entryZone, null) }));
    }
    if (isPlainObject(st.exit)) {
      items.push(makeItem('exitValid', '종료 계획 유효',
        st.exit.valid === true ? 'YES' : 'NO',
        st.exit.valid === true ? 'positive' : 'muted',
        { type: safeString(st.exit.type, 'NONE'),
          targetHint: safeNumber(st.exit.targetHint, null),
          invalidationHint: safeNumber(st.exit.invalidationHint, null) }));
    }
    return items;
  }

  // ==========================================================================
  // §buildSectionBindings — 5종 array 통합 (U-APO-1 Option B)
  // ==========================================================================
  function buildSectionBindings(input, cfg) {
    return {
      strategy: cfg.sections.showStrategy === true
        ? buildStrategySection(input.cardViewModel, cfg) : [],
      lifecycle: cfg.sections.showLifecycle === true
        ? buildLifecycleSection(input.activeCycleDecision, cfg) : [],
      evaluation: cfg.sections.showEvaluation === true
        ? buildEvaluationSection(input.evaluationOutcome, cfg) : [],
      confluence: cfg.sections.showConfluence === true
        ? buildConfluenceSection(input.externalConfluence, cfg) : [],
      transport: cfg.sections.showTransport === true
        ? buildTransportSection(input.transportPlan, cfg) : []
    };
  }

  // ==========================================================================
  // §classifyDisplayMode (U-APO-2 Option A — 7 후보 우선순위)
  // ==========================================================================
  function classifyDisplayMode(input) {
    var cvm = input.cardViewModel;
    var ac = input.activeCycleDecision;
    var ev = input.evaluationOutcome;
    var op = input.operationPacket;
    var tp = input.transportPlan;

    var df = (isPlainObject(cvm) && isPlainObject(cvm.displayFlags)) ? cvm.displayFlags : null;
    var lifecycleState = null;
    if (isPlainObject(ac) && isPlainObject(ac.lifecycle)) {
      lifecycleState = safeString(ac.lifecycle.lifecycleState, null);
    }
    var evalStatus = null;
    if (isPlainObject(ev) && isPlainObject(ev.evaluation)) {
      evalStatus = safeString(ev.evaluation.status, null);
    }

    // 1. BLOCKED
    if (df && df.isBlocked === true) return DISPLAY_MODE.BLOCKED;

    // 2. COOLDOWN
    if (df && df.isCooldown === true) return DISPLAY_MODE.COOLDOWN;
    if (lifecycleState === 'COOLDOWN') return DISPLAY_MODE.COOLDOWN;

    // 3. CLOSED
    if (evalStatus === 'CLOSED') return DISPLAY_MODE.CLOSED;
    if (lifecycleState === 'EXPIRED') return DISPLAY_MODE.CLOSED;

    // 4. REVIEW
    if (isPlainObject(tp) && isPlainObject(tp.auditPlan) && tp.auditPlan.shouldAudit === true) {
      return DISPLAY_MODE.REVIEW;
    }
    if (isPlainObject(ev) && isPlainObject(ev.routingDecision) && ev.routingDecision.shouldReview === true) {
      return DISPLAY_MODE.REVIEW;
    }

    // 5. ALERT
    if (isPlainObject(tp) && isPlainObject(tp.telegramPlan) && tp.telegramPlan.shouldSend === true) {
      return DISPLAY_MODE.ALERT;
    }
    if (isPlainObject(op) && isPlainObject(op.routing) && op.routing.shouldNotify === true) {
      return DISPLAY_MODE.ALERT;
    }

    // 6. DEFAULT (valid input 존재 시)
    if (isPlainObject(cvm) || isPlainObject(ac) || isPlainObject(ev)
        || isPlainObject(op) || isPlainObject(tp)) {
      return DISPLAY_MODE.DEFAULT;
    }

    // 7. UNKNOWN
    return DISPLAY_MODE.UNKNOWN;
  }

  // ==========================================================================
  // §buildDisplayFlags (U-APO-3 Option C — namespace 분리)
  //   flags.binding: visibility / warning 상태 (본 layer)
  //   flags.card: v0.7.0 cardViewModel.displayFlags 보존
  // ==========================================================================
  function buildDisplayFlags(input, binding, cfg) {
    var bd = {
      showStrategy: false,
      showLifecycle: false,
      showEvaluation: false,
      showConfluence: false,
      showTransport: false,
      hasWarning: false,
      hasBlocker: false
    };

    bd.showStrategy = cfg.sections.showStrategy === true && binding.sections.strategy.length > 0;
    bd.showLifecycle = cfg.sections.showLifecycle === true && binding.sections.lifecycle.length > 0;
    bd.showEvaluation = cfg.sections.showEvaluation === true && binding.sections.evaluation.length > 0;
    bd.showConfluence = cfg.sections.showConfluence === true && binding.sections.confluence.length > 0;
    bd.showTransport = cfg.sections.showTransport === true && binding.sections.transport.length > 0;

    // hasWarning — 입력 6종 warning 또는 transportPlan.auditPlan.shouldAudit 기반
    var hasWarn = false;
    var srcs = ['cardViewModel', 'operationPacket', 'activeCycleDecision',
                'evaluationOutcome', 'externalConfluence', 'transportPlan'];
    for (var i = 0; i < srcs.length; i = i + 1) {
      var s = input[srcs[i]];
      if (isPlainObject(s) && Array.isArray(s.warnings) && s.warnings.length > 0) {
        hasWarn = true;
        break;
      }
    }
    if (isPlainObject(input.transportPlan) && isPlainObject(input.transportPlan.auditPlan)
        && input.transportPlan.auditPlan.shouldAudit === true) {
      hasWarn = true;
    }
    bd.hasWarning = hasWarn;

    // hasBlocker — cardViewModel.displayFlags.isBlocked OR isExpired OR isWeakening
    var blocker = false;
    if (isPlainObject(input.cardViewModel) && isPlainObject(input.cardViewModel.displayFlags)) {
      var f = input.cardViewModel.displayFlags;
      if (f.isBlocked === true || f.isExpired === true || f.isWeakening === true) blocker = true;
    }
    bd.hasBlocker = blocker;

    // card namespace — cardViewModel.displayFlags 보존 (read-only)
    var cd = {
      isReady: false, isBlocked: false, isCooldown: false, isExpired: false,
      isWeakening: false, isHighActionability: false,
      showEntryPlan: false, showExitPlan: false, showRiskWarning: false, showDebug: false
    };
    if (isPlainObject(input.cardViewModel) && isPlainObject(input.cardViewModel.displayFlags)) {
      var f2 = input.cardViewModel.displayFlags;
      cd.isReady = f2.isReady === true;
      cd.isBlocked = f2.isBlocked === true;
      cd.isCooldown = f2.isCooldown === true;
      cd.isExpired = f2.isExpired === true;
      cd.isWeakening = f2.isWeakening === true;
      cd.isHighActionability = f2.isHighActionability === true;
      cd.showEntryPlan = f2.showEntryPlan === true;
      cd.showExitPlan = f2.showExitPlan === true;
      cd.showRiskWarning = f2.showRiskWarning === true;
      cd.showDebug = f2.showDebug === true;
    }

    return { binding: bd, card: cd };
  }

  // ==========================================================================
  // §normalize 출력
  // ==========================================================================
  function normalizeRendererBinding(result) {
    return {
      valid: result.valid === true,
      version: RENDERER_BINDING_VERSION,
      displayMode: typeof result.displayMode === 'string' ? result.displayMode : DISPLAY_MODE.UNKNOWN,
      header: result.header,
      chips: pickArray(result.chips).slice(),
      metrics: pickArray(result.metrics).slice(),
      sections: result.sections,
      flags: result.flags,
      reasons: pickArray(result.reasons).slice(),
      warnings: pickArray(result.warnings).slice(),
      debug: result.debug,
      configUsed: result.configUsed
    };
  }

  // ==========================================================================
  // §main — buildRendererBinding
  // ==========================================================================
  /**
   * UI binding 객체. 입력 6종 mutate 0건 (DP-APO8).
   *
   * @param {Object} [input]
   *   { cardViewModel, operationPacket, activeCycleDecision, evaluationOutcome,
   *     externalConfluence, transportPlan }
   * @param {Object} [config]
   * @return {Object} rendererBinding
   */
  function buildRendererBinding(input, config) {
    var cfg = mergeRendererBindingConfig(config);
    var configUsed = makeConfigUsed(cfg);
    var inp = isPlainObject(input) ? input : {};

    var topReasons = [];
    var topWarnings = [];

    var header = buildHeaderBinding(inp.cardViewModel, inp.activeCycleDecision, inp.evaluationOutcome, cfg);
    var chips = buildChipBindings(inp.cardViewModel, inp.operationPacket,
                                   inp.activeCycleDecision, inp.evaluationOutcome,
                                   inp.externalConfluence, cfg);
    var metrics = buildMetricBindings(inp.cardViewModel, inp.evaluationOutcome,
                                       inp.externalConfluence, cfg);
    var sections = buildSectionBindings(inp, cfg);

    var partial = { sections: sections };
    var flags = buildDisplayFlags(inp, partial, cfg);

    var displayMode = classifyDisplayMode(inp);

    // top reasons
    topReasons.push('DISPLAY_MODE_' + displayMode);
    if (flags.binding.hasWarning) topReasons.push('HAS_WARNING');
    if (flags.binding.hasBlocker) topReasons.push('HAS_BLOCKER');

    // valid 판정
    var valid = isPlainObject(inp.cardViewModel)
                || isPlainObject(inp.operationPacket)
                || isPlainObject(inp.activeCycleDecision)
                || isPlainObject(inp.evaluationOutcome);

    if (!isPlainObject(inp.cardViewModel)) topWarnings.push('CARD_VIEW_MODEL_NOT_OBJECT');

    return normalizeRendererBinding({
      valid: valid,
      displayMode: displayMode,
      header: header,
      chips: chips,
      metrics: metrics,
      sections: sections,
      flags: flags,
      reasons: topReasons,
      warnings: topWarnings,
      debug: {
        source: 'cardViewModel + operationPacket + activeCycleDecision + evaluationOutcome + externalConfluence + transportPlan',
        configVersion: cfg.version
      },
      configUsed: configUsed
    });
  }

  // ==========================================================================
  // §export — 이중 환경
  // ==========================================================================
  var api = Object.freeze({
    RENDERER_BINDING_VERSION: RENDERER_BINDING_VERSION,
    CONFIG_VERSION: CONFIG_VERSION,
    DEFAULT_RENDERER_BINDING_CONFIG: DEFAULT_RENDERER_BINDING_CONFIG,
    DISPLAY_MODE: DISPLAY_MODE,

    build: buildRendererBinding,
    mergeRendererBindingConfig: mergeRendererBindingConfig,

    buildHeaderBinding: buildHeaderBinding,
    buildChipBindings: buildChipBindings,
    buildMetricBindings: buildMetricBindings,
    buildSectionBindings: buildSectionBindings,
    buildStrategySection: buildStrategySection,
    buildLifecycleSection: buildLifecycleSection,
    buildEvaluationSection: buildEvaluationSection,
    buildConfluenceSection: buildConfluenceSection,
    buildTransportSection: buildTransportSection,
    buildDisplayFlags: buildDisplayFlags,
    classifyDisplayMode: classifyDisplayMode,

    normalizeRendererBinding: normalizeRendererBinding,
    pushReason: pushReason,
    pushWarning: pushWarning
  });

  global.WS3_RendererBinding = api;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis
   : typeof window !== 'undefined' ? window
   : typeof self !== 'undefined' ? self
   : this);
