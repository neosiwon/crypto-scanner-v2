/* WOOS Shadow Kit
 * Base:    v4.9.5+phase2-v0-shadow-backfill-hotfix-r1
 * Current: v5.2.3 (라벨 설명 모달 + 매수세 강중약 + 매도압 단독표시)
 *
 * Shadow Score / 라벨 / Backfill / ATR B / B-C 검증샘플 담당.
 *
 * v5.1.3 = WOOS_calcShadowScore / WOOS_hasShadowInputData 본문을
 *          본체 index.html(line 11388~11502)에서 이전 (재작성 X, 동작 동일).
 *          본체 호출처 5곳 미터치를 위해 window alias 유지.
 *
 * v5.1.2 = 분석완료 Backfill 인라인을 본체에서 이전.
 *
 * 후속 라운드:
 *   v5.1.4 (ATR B 라벨 검증샘플 외부화)
 *   v5.1.5 (Shadow CSS 디자인 정리)
 *
 * window alias (D-Q1=A 결정 — 점진 이전 정신, 호출처 미터치):
 *   window.WOOS_calcShadowScore   = calcShadowScore
 *   window.WOOS_hasShadowInputData = hasShadowInputData
 *
 * 내부 반환 version 'phase1-v0' 보존 (D-Q4=V1 — payload 호환성).
 */
(function (global) {
  'use strict';

  /* ───────────────────────────────────────────────────────────────
   * Shadow Score 5차원 계산 (이전: index.html line 11388~11477)
   *
   * 사용자 결정 사항 (Phase 1 v0):
   *   1. 매수세 점수 (vRatio + vAccel + OBV + MFI + phase) 0-10
   *   2. 수급반응 점수 (boxRange + phase + accStrength + OBV + vol) 0-10
   *   3. 위치품질 점수 (phase 0.98-1.05=5점 / 1.15+=1점) 0-10
   *   4. 손익비 점수 (RR < 1.5=2점 / 5+=10점) 0-10 + RR 숫자 별도
   *   5. 위험도 가중합 (낮음/보통/높음)
   * 기존 WOOS 점수체계 변경 X / 보조 검증 점수
   * ─────────────────────────────────────────────────────────────── */
  function calcShadowScore(coin, rep) {
    if (!rep) return null;
    try {
      var vol = rep.vol || {};
      var vRatio = vol.ratio || 1.0;
      var vAccel = vol.accel || 1.0;
      var obvTrend = (rep.obv && rep.obv.trend) || 'flat';
      var mfi = (rep.indicators && rep.indicators.mfi) || 50;
      var phase = (rep.currentPhase && rep.currentPhase.ratio) || 1.0;
      var accSc = (rep.accumulationStrength && rep.accumulationStrength.score) || 0;
      var rr = (rep.rr && rep.rr.value) || 0;
      var fakePump = !!rep.fakePump;
      var lateEntry = !!rep.lateEntry;
      var btcBear = (coin && coin.btcFilter && coin.btcFilter.penalty >= 2);
      var upperWick = (rep.candle && rep.candle.upperWickRatio >= 0.4);

      // 1. 매수세 (0-10)
      var bp = 0;
      if (vRatio >= 2.0) bp += 3; else if (vRatio >= 1.5) bp += 2; else if (vRatio >= 1.2) bp += 1;
      if (vAccel >= 1.20) bp += 2; else if (vAccel >= 1.05) bp += 1;
      if (obvTrend === 'up' || obvTrend === 'UP') bp += 2;
      else if (obvTrend === 'flat' || obvTrend === 'FLAT') bp += 1;
      if (mfi >= 85) bp += 0; else if (mfi >= 75) bp += 1; else if (mfi >= 60) bp += 2; else if (mfi >= 50) bp += 1;
      if (phase >= 1.00 && phase < 1.08) bp += 1;
      bp = Math.min(10, Math.max(0, bp));

      // 2. 수급반응 (0-10)
      var lr = 0;
      if (rep.boxRange && rep.boxRange.exists) lr += 2;
      else if (rep.boxRange && rep.boxRange.width) lr += 1;
      if (phase >= 0.98 && phase < 1.05) lr += 3;
      else if (phase >= 1.05 && phase < 1.08) lr += 2;
      else if (phase < 0.98) lr += 1;
      lr += Math.min(3, Math.round(accSc * 0.3));
      if (obvTrend === 'up' || obvTrend === 'UP' || obvTrend === 'flat' || obvTrend === 'FLAT') lr += 1;
      if (vRatio >= 1.2) lr += 1;
      lr = Math.min(10, Math.max(0, lr));

      // 3. 위치품질 (0-10)
      var pos = 0;
      if (phase >= 0.98 && phase < 1.05) pos = 5;
      else if (phase >= 1.05 && phase < 1.08) pos = 4;
      else if (phase >= 1.08 && phase < 1.15) pos = 2;
      else if (phase >= 1.15 && phase < 1.25) pos = 1;
      else if (phase >= 1.25) pos = 0;
      else if (phase < 0.95) pos = 2;
      if (accSc >= 7) pos = Math.min(10, pos + 3);
      else if (accSc >= 4) pos = Math.min(10, pos + 1);
      pos = Math.min(10, Math.max(0, pos));

      // 4. 손익비 (0-10) + RR 숫자
      var rrSc = 0;
      if (rr >= 5.0) rrSc = 10;
      else if (rr >= 3.0) rrSc = 8;
      else if (rr >= 2.0) rrSc = 6;
      else if (rr >= 1.5) rrSc = 4;
      else if (rr > 0) rrSc = 2;

      // 5. 위험도 가중합
      var rw = 0;
      if (phase >= 1.15) rw += 2;
      if (obvTrend === 'down' || obvTrend === 'DOWN') rw += 2;
      if (fakePump) rw += 2;
      if (lateEntry) rw += 2;
      if (mfi >= 85) rw += 1;
      if (btcBear) rw += 1;
      if (upperWick) rw += 1;
      if (rr > 0 && rr < 1.5) rw += 1;
      var riskLevel = (rw >= 4) ? 'high' : ((rw >= 2) ? 'mid' : 'low');
      var riskLabel = (riskLevel === 'high') ? '높음' : ((riskLevel === 'mid') ? '보통' : '낮음');

      var avg = Math.round(((bp + lr + pos + rrSc) / 4) * 10) / 10;

      return {
        buyPressure: bp,
        liquidityReaction: lr,
        positionQuality: pos,
        rrScore: rrSc,
        rrValue: rr,
        riskLevel: riskLevel,
        riskLabel: riskLabel,
        riskWeight: rw,
        avgScore: avg,
        version: 'phase1-v0',  /* payload 호환성용 내부 식별자 — 변경 금지 (D-Q4=V1) */
        calculatedAt: Date.now()
      };
    } catch (e) {
      return { error: e.message, version: 'phase1-v0' };
    }
  }

  /* ───────────────────────────────────────────────────────────────
   * Shadow Score Backfill 안전 가드 (이전: index.html line 11484~11502)
   *
   * 분석완료 export 171건처럼 알람 당시 raw 지표(vol/obv/mfi/currentPhase/rr 등)가
   * 없는 경우, 기본값(거래량=1, MFI=50, phase=1, RR=0)으로 가짜 Shadow Score가
   * 생성되는 것을 차단한다 (hotfix-r1 핵심).
   * 스캐너 실시간 rep에는 영향 없음.
   * ─────────────────────────────────────────────────────────────── */
  function hasShadowInputData(snap) {
    try {
      if (!snap) return false;
      if (snap.shadowScore && !snap.shadowScore.error) return true;
      function has(v) { return v !== undefined && v !== null && v !== ''; }
      return !!(
        snap.vol || has(snap.volumeRatio) || has(snap.volumeAccel) ||
        snap.obv || has(snap.obvDirection) ||
        snap.indicators || has(snap.mfi) || has(snap.rsi) ||
        snap.currentPhase || has(snap.currentPhaseRatio) ||
        snap.accumulationStrength || has(snap.accStrength) ||
        snap.rr || has(snap.rrValue) ||
        snap.fakePump !== undefined || snap.lateEntry !== undefined ||
        snap.boxRange || snap.candle
      );
    } catch (e) {
      return false;
    }
  }

  /* 막대 게이지 헬퍼 — 본체 _bbar 와 동일 구현 */
  function _bbar(val, max) {
    var pct = Math.min(100, Math.max(0, (val / max) * 100));
    return '<span class="ss-bar-track"><span class="ss-bar-fill" style="width:' + pct + '%;"></span></span>';
  }

  /**
   * 분석완료 Backfill 패널 HTML 빌드 (v5.1.2 이전, v5.1.3에서 모듈 내부 함수 직접 호출로 갱신)
   *
   * @param {Object} item  - history item
   * @param {Object} ctx   - { outcome: 'success'|'partial'|'fail'|'neutral' }
   * @return {string}      - HTML 문자열 또는 '' (예외 시)
   *
   * 분기:
   *   1) hasShadowInputData(snap) === false → "데이터 부족" 패널
   *   2) 정상 → Shadow Score 패널 + 검증 매칭 라벨 + 4-bar
   */
  function renderBackfillPanel(item, ctx) {
    ctx = ctx || {};
    var outcome = ctx.outcome || '';
    var html = '';
    try {
      var snap = (item && (item.alertSnap || item)) || {};
      if (!hasShadowInputData(snap)) {
        // 데이터 부족 — 가짜 점수 생성 차단 (hotfix-r1 핵심)
        html = '<div class="ss-shadow-section ss-backfill ss-data-missing">'
          + '<div class="ss-header">'
          +   '<span class="ss-title">💎 Shadow Score</span>'
          +   '<span class="ss-backfill-label">[Backfill]</span>'
          +   '<span class="ss-risk-chip ss-risk-mid">데이터 부족</span>'
          + '</div>'
          + '<div class="ss-data-missing-text">알람 당시 raw 지표 부족 — 기본값 기반 가짜 점수 생성을 차단했습니다.</div>'
          + '</div>';
      } else {
        var pseudoCoin = { btcFilter: snap.btcFilter || null };
        var pseudoRep = {
          vol: snap.vol || { ratio: snap.volumeRatio || 1, accel: snap.volumeAccel || 1 },
          obv: snap.obv || { trend: snap.obvDirection || 'flat' },
          indicators: snap.indicators || { mfi: snap.mfi || 50, rsi: snap.rsi || 50 },
          currentPhase: snap.currentPhase || { ratio: snap.currentPhaseRatio || 1.0 },
          accumulationStrength: snap.accumulationStrength || { score: snap.accStrength || 0 },
          rr: snap.rr || { value: snap.rrValue || 0 },
          fakePump: !!snap.fakePump,
          lateEntry: !!snap.lateEntry,
          boxRange: snap.boxRange || null,
          candle: snap.candle || null
        };
        var ssBackfill = calcShadowScore(pseudoCoin, pseudoRep);
        if (ssBackfill && !ssBackfill.error) {
          var bRiskCls = ssBackfill.riskLevel === 'high'
            ? 'ss-risk-high'
            : (ssBackfill.riskLevel === 'mid' ? 'ss-risk-mid' : 'ss-risk-low');

          // 검증 결과 자동 매칭 (Shadow Score vs 실제 outcome)
          var verifyLabel = '';
          try {
            var ssAvg = ssBackfill.avgScore || 0;
            var ssPred = ssAvg >= 6 ? 'good' : (ssAvg >= 4 ? 'mid' : 'bad');
            var actualGood = (outcome === 'success' || outcome === 'partial');
            var actualBad = (outcome === 'fail');

            if (ssPred === 'good' && actualGood) {
              verifyLabel = '<span class="ss-verify-match ss-verify-tp">✅ 예측 적중 (TP)</span>';
            } else if (ssPred === 'bad' && actualBad) {
              verifyLabel = '<span class="ss-verify-match ss-verify-tn">✅ 예측 적중 (TN)</span>';
            } else if (ssPred === 'good' && actualBad) {
              verifyLabel = '<span class="ss-verify-mismatch ss-verify-fp">❌ 예측 빗나감 (FP)</span>';
            } else if (ssPred === 'bad' && actualGood) {
              verifyLabel = '<span class="ss-verify-mismatch ss-verify-fn">❌ 예측 빗나감 (FN)</span>';
            } else {
              verifyLabel = '<span class="ss-verify-neutral">⚪ 중립</span>';
            }
          } catch (_vErr) {}

          html = '<div class="ss-shadow-section ss-backfill">'
            + '<div class="ss-header">'
            +   '<span class="ss-title">💎 Shadow Score</span>'
            +   '<span class="ss-avg">' + ssBackfill.avgScore + '/10</span>'
            +   '<span class="ss-backfill-label">[Backfill]</span>'
            +   '<span class="ss-risk-chip ' + bRiskCls + '">위험 ' + ssBackfill.riskLabel + '</span>'
            +   verifyLabel
            + '</div>'
            + '<div class="ss-bars">'
            +   '<div class="ss-bar-row"><span class="ss-bar-lbl">매수세</span>' + _bbar(ssBackfill.buyPressure, 10) + '<span class="ss-bar-val">' + ssBackfill.buyPressure + '</span></div>'
            +   '<div class="ss-bar-row"><span class="ss-bar-lbl">수급반응</span>' + _bbar(ssBackfill.liquidityReaction, 10) + '<span class="ss-bar-val">' + ssBackfill.liquidityReaction + '</span></div>'
            +   '<div class="ss-bar-row"><span class="ss-bar-lbl">위치품질</span>' + _bbar(ssBackfill.positionQuality, 10) + '<span class="ss-bar-val">' + ssBackfill.positionQuality + '</span></div>'
            +   '<div class="ss-bar-row"><span class="ss-bar-lbl">손익비</span>' + _bbar(ssBackfill.rrScore, 10) + '<span class="ss-bar-val">' + ssBackfill.rrScore + (ssBackfill.rrValue ? ' RR ' + ssBackfill.rrValue.toFixed(1) : '') + '</span></div>'
            + '</div>'
            + '</div>';
        }
      }
    } catch (_bfErr) {}
    return html;
  }

  /* ═══════════════════════════════════════════════════════════════
   * v5.1.4 — 라벨 UI 5종 외부화
   *
   * 본체 index.html 5곳의 라벨 빌드 인라인을 모듈로 이전 (재작성 X).
   * Shadow Score 자체의 매수세/수급반응/흡수/추격주의/매도압 라벨과는 별개.
   * 5종은 UI 라벨/칩만 다룸.
   *
   * 라벨 클래스명 / HTML 출력 100% 동일 보존 (사용자 절대 유지 조건).
   * ═══════════════════════════════════════════════════════════════ */

  function _ssEscapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /**
   * ① Preview 라벨 (ss-preview-label)
   *    이전: index.html line 11464~11466
   *    표시 조건: rep.isEntryReady X && rep.prePump X (알람 조건 미충족)
   */
  function renderPreviewLabel(rep) {
    if (!rep) return '';
    var isPreview = !rep.isEntryReady && !rep.prePump;
    return isPreview ? '<span class="ss-preview-label">[Preview / 알람 X]</span>' : '';
  }

  /**
   * ② 검증샘플 라벨 (al-sample-tag)
   *    이전: index.html line 16238
   *    표시 조건: noAlert (B/C 박제, 알람 X)
   */
  function renderSampleLabel(noAlert) {
    return noAlert ? '<span class="al-sample-tag">검증샘플</span>' : '';
  }

  /**
   * ③ Shadow 강도 칩 — fallback 분기 (al-shadow-chip 강/중/약)
   *    이전: index.html line 16227~16234 (legacy data, totalScore 기반)
   *    표시 조건: noAlert + ss 객체/숫자 미보유 (legacy data)
   *
   *    객체/숫자 분기(line 16219, 16226)는 본체 그대로 유지.
   */
  function renderShadowChipFallback(item) {
    var totalScore = (item && item.total != null) ? item.total : 0;
    var shadowLabel = '';
    if (totalScore >= 4) shadowLabel = '강';
    else if (totalScore >= 3) shadowLabel = '중';
    else shadowLabel = '약';
    return '<span class="al-shadow-chip al-shadow-' + shadowLabel + '">🔍 ' + shadowLabel + '</span>';
  }

  /**
   * ④ 알람목록 승격/멀티 칩 (al-promo / al-multi)
   *    이전: index.html line 16241~16260
   *
   *    @param {Object} item  - 알람 item
   *    @param {Object} ctx   - { alertListCache: _alertListCache } (D-Q4=U1 — ctx 주입)
   *    같은 base의 다른 등급 카운트 → 승격 / N회 표시
   */
  function renderPromotionChip(item, ctx) {
    ctx = ctx || {};
    var alertListCache = ctx.alertListCache;
    var html = '';
    try {
      if (item && item.base && Array.isArray(alertListCache)) {
        var sameBase = alertListCache.filter(function (s) { return s.base === item.base; });
        if (sameBase.length > 1) {
          var gradeOrderProm = { 'SPLUS': 5, 'S': 4, 'A': 3, 'B': 2, 'C': 1 };
          var maxG = sameBase.reduce(function (m, s) {
            var v = gradeOrderProm[s.gradeCode] || 0;
            return v > m.v ? { v: v, g: s.gradeCode } : m;
          }, { v: 0, g: '' });
          var curV = gradeOrderProm[item.gradeCode] || 0;
          if (maxG.v > curV) {
            var maxLabel = maxG.g === 'SPLUS' ? 'S+' : maxG.g;
            html = '<span class="al-promo">↑ ' + _ssEscapeHtml(maxLabel) + ' 승격</span>';
          } else if (sameBase.length >= 2) {
            html = '<span class="al-multi">×' + sameBase.length + '회</span>';
          }
        }
      }
    } catch (_promErr) {}
    return html;
  }

  /**
   * ⑤ 분석완료 승격/강등 칩 (hist-promotion-chip.hist-promoted / hist-demoted)
   *    이전: index.html line 20321~20347
   *
   *    @param {Object} item           - history item (item.gradeHistory 의존)
   *    @param {string} currentGrade   - 현재 등급 (uppercase, 'SPLUS' 또는 'A'/'B'/'C' 등)
   *    초기 등급 vs 최종 등급 비교 — 승격/강등 칩 반환
   *    "B/C → A/S 승격 여부 검증" 의도 그대로 보존
   */
  function renderHistoryPromotionChip(item, currentGrade) {
    var html = '';
    try {
      if (!item) return '';
      var gradeHist = item.gradeHistory;
      if (Array.isArray(gradeHist) && gradeHist.length > 0) {
        // 시간순 정렬 — 가장 오래된 = 초기
        var sorted = gradeHist.slice().sort(function (a, b) { return (a.time || 0) - (b.time || 0); });
        var initialGrade = (sorted[0].gradeCode || '').toUpperCase();
        if (initialGrade === 'SPLUS') initialGrade = 'S+';
        var finalGrade = currentGrade || '';
        if (finalGrade === 'SPLUS') finalGrade = 'S+';

        // 등급 강도 비교 — 승격/유지/하락
        var gradeRank = { 'B': 1, 'C': 1, 'A': 2, 'S': 3, 'S+': 4, 'SPLUS': 4 };
        var iRank = gradeRank[initialGrade] || 0;
        var fRank = gradeRank[finalGrade] || 0;

        if (initialGrade && initialGrade !== finalGrade) {
          if (fRank > iRank) {
            // 승격
            html = '<span class="hist-promotion-chip hist-promoted" title="초기 ' + initialGrade + ' → ' + finalGrade + ' 승격">⬆ ' + initialGrade + '→' + finalGrade + '</span>';
          } else if (fRank < iRank) {
            // 강등
            html = '<span class="hist-promotion-chip hist-demoted" title="초기 ' + initialGrade + ' → ' + finalGrade + ' 강등">⬇ ' + initialGrade + '→' + finalGrade + '</span>';
          }
        }
      }
    } catch (_phe) {}
    return html;
  }

  /* ═══════════════════════════════════════════════════════════════
   * v5.1.6 — ATR B 함수 외부화
   *
   * 본체 index.html(line 11219~11247) buildAutoTradeStrategyB 함수를
   * 그대로 이전 (재작성 X / 계산식 / 트리거 텍스트 / note 100% 보존).
   *
   * 의존성:
   *   - rep.atr (snapshot 빌드 시 calcATR(candles) 결과 박제값)
   *   - rep.price / rep.box.low
   *   - calcATR 동결 함수 직접 호출 0건 (rep.atr 박제값만 사용)
   *
   * 호출처 (본체 미터치):
   *   - index.html line 9917 (snapshot payload 박제)
   *   - index.html line 11335 (전략 B HTML 빌드)
   *   - alias `window.buildAutoTradeStrategyB`로 작동 (T-Q3=A1)
   *
   * payload strategyB 필드 구조 1:1 보존 (Worker / KV / export 호환성).
   * ═══════════════════════════════════════════════════════════════ */
  function buildAutoTradeStrategyB(coin) {
    var rep = (coin && coin.representative) || {};
    var atr = Number(rep.atr || 0);
    var price = Number(rep.price || 0);
    var boxLow = rep.box ? rep.box.low : null;
    if (!atr || isNaN(atr) || !isFinite(atr) || atr <= 0 || !price) {
      return { ok: false, reason: 'ATR 데이터 부족으로 계산 불가' };
    }
    var trailWidth = atr * 2;
    var stage1Trig = price + atr * 1.5;  // 스탑 → 진입가 (본전)
    var stage2Trig = price + atr * 3.0;  // 스탑 → 고점 - 2ATR
    return {
      ok: true,
      trigger:     '고점 대비 ATR×2 하락 시 전량 청산',
      atr:         atr,
      trailWidth:  trailWidth,
      initialStop: boxLow,
      stage1: {
        trigger: stage1Trig,
        action:  '스탑을 진입가로 이동 (본전 확보)'
      },
      stage2: {
        trigger: stage2Trig,
        action:  '스탑을 고점 - ATR×2 로 이동 (트레일링 시작)'
      },
      finalExit: '고점 - ATR×2 이탈 시 전량 청산',
      note:      '전략 A 와 달리 전량 청산 방식 — 추세 지속 시 수익 극대화, 변동성 큰 코인에 적합'
    };
  }

  /* ═══════════════════════════════════════════════════════════════
   * v5.2.0 (스캐너 정밀화 통합 라운드) — 신규 함수 8개
   *
   * 1. 정밀화 라벨 5종 (매수세/수급반응/흡수/추격주의/매도압)
   * 2. 펼친 카드 정밀화 블록 (ss-refinement-block)
   * 3. B/C 검증샘플 안내 (bc-sample-notice)
   * 4. 분석완료 해석 배지 (result-interp-block)
   * 5. ATR B 예상 계산 안내 (strategy-b-expected-note)
   *
   * 모듈 내부 함수 직접 호출 (this 사용 X).
   * 기존 .ss-bar-row/-lbl/-track/-fill/-val 클래스 재사용 (_bbar 헬퍼).
   * closeReturn 실시간 라벨 미사용 (F1 금지 / F6 분석완료 사후 허용).
   * ═══════════════════════════════════════════════════════════════ */

  /* calcShadowScore 반환 정규화 (실제 필드명: rrScore/avgScore/riskLevel) */
  function _normalizeShadowScore(score) {
    if (!score || score.error) return null;
    return {
      buyPressure:       Number(score.buyPressure || 0),
      liquidityReaction: Number(score.liquidityReaction || 0),
      positionQuality:   Number(score.positionQuality || 0),
      rrScore:           Number(score.rrScore || 0),
      rrValue:           Number(score.rrValue || 0),
      avgScore:          Number(score.avgScore || 0),
      riskLevel:         score.riskLevel || 'low',
      riskLabel:         score.riskLabel || '',
      riskWeight:        Number(score.riskWeight || 0)
    };
  }

  /* F1. 정밀화 라벨 5종 분류 (매수세/수급반응/흡수/추격주의/매도압) */
  function classifyRefinementLabels(rep) {
    if (!rep || !hasShadowInputData(rep)) {
      return {
        hasData: false,
        reason: '데이터 부족',
        buyPressure:       { active: false },
        liquidityReaction: { active: false },
        absorption:        { active: false },
        chaseRisk:         { level: 'none' },
        sellPressure:      { active: false }
      };
    }

    var raw = calcShadowScore(null, rep);
    var s = _normalizeShadowScore(raw);
    if (!s) {
      return { hasData: false, reason: '계산 오류',
               buyPressure: { active: false }, liquidityReaction: { active: false },
               absorption: { active: false }, chaseRisk: { level: 'none' },
               sellPressure: { active: false } };
    }

    var phase    = (rep.currentPhase && rep.currentPhase.ratio) || 1.0;
    var obvTrend = (rep.obv && rep.obv.trend) || 'flat';
    var volRatio = (rep.vol && rep.vol.ratio) || 1.0;
    var mfi      = (rep.indicators && rep.indicators.mfi) || (typeof rep.mfi === 'number' ? rep.mfi : 50);

    /* 윗꼬리 + 종가 약함 (실시간 캔들 OHLC 기반 — closeReturn 사용 X) */
    var upperWickStrong = false;
    var closeWeak = false;
    if (Array.isArray(rep.candles) && rep.candles.length > 0) {
      var last = rep.candles[rep.candles.length - 1];
      if (last && typeof last.high === 'number' && typeof last.low === 'number') {
        var range = last.high - last.low;
        if (range > 0) {
          var upperWick = last.high - Math.max(last.open || 0, last.close || 0);
          upperWickStrong = (upperWick / range) > 0.5;
        }
        if (typeof last.close === 'number') {
          closeWeak = last.close < (last.high + last.low) / 2;
        }
      }
    } else if (rep.candle && typeof rep.candle.upperWickRatio === 'number') {
      /* fallback: rep.candle.upperWickRatio (calcShadowScore와 동일) */
      upperWickStrong = rep.candle.upperWickRatio >= 0.4;
    }

    /* 🟡 매수세 [v5.2.3] 임계 5→1 (스캐너 검출 = 당연 표시 / 강중약으로 차별화) */
    var buyActive = s.buyPressure >= 1 && s.riskLevel !== 'high';
    var buyStrength = s.buyPressure >= 8 ? 'strong' :
                      s.buyPressure >= 5 ? 'mid' : 'weak';

    /* 🔵 수급반응 */
    var liqActive = s.liquidityReaction >= 6 && s.positionQuality >= 5;

    /* 🟢 흡수 (추정 — 입금량 데이터 X) */
    var changeRate = Math.abs(rep.changeRate || 0);
    var absorbActive = (volRatio >= 1.2)
      && (changeRate < 5)
      && (obvTrend === 'up' || obvTrend === 'flat' || obvTrend === 'UP' || obvTrend === 'FLAT')
      && (mfi >= 40)
      && !upperWickStrong;

    /* ⚠️ 추격주의 (phase 기반 단계) */
    var chaseLevel = phase >= 1.25 ? 'extreme' :
                     phase >= 1.15 ? 'high' :
                     phase >= 1.08 ? 'mid' : 'none';

    /* 🔴 매도압 (closeReturn 미사용 — 캔들 OHLC + OBV + MFI 신호 합산) */
    var sellSignals = 0;
    if (volRatio >= 1.3) sellSignals++;
    if (obvTrend === 'down' || obvTrend === 'DOWN') sellSignals++;
    if (closeWeak) sellSignals++;
    if (upperWickStrong) sellSignals++;
    if (mfi < 50 && volRatio >= 1.3) sellSignals++;

    var sellActive = sellSignals >= 3;
    var sellStrength = sellSignals >= 4 ? 'strong' :
                       sellSignals >= 3 ? 'mid' : 'weak';

    return {
      hasData: true,
      buyPressure:       { active: buyActive, strength: buyStrength, score: s.buyPressure },
      liquidityReaction: { active: liqActive,  score: s.liquidityReaction },
      absorption:        { active: absorbActive, note: '추정 (입금량 X)' },
      chaseRisk:         { level: chaseLevel, phase: phase },
      sellPressure:      { active: sellActive, strength: sellStrength, signals: sellSignals }
    };
  }

  /* F2. 정밀화 라벨 칩 렌더 */
  function renderRefinementLabelChips(labels, mode) {
    if (!labels || !labels.hasData) {
      return '<div class="rl-chips rl-chips-nodata">' +
             '<span class="rl-nodata">정밀화 라벨 — 데이터 부족</span></div>';
    }
    mode = mode || 'expanded';

    /* [v5.2.3] 매도압 active 시 단독 표시 — 위험 신호 우선, 다른 4종 숨김 */
    if (labels.sellPressure.active) {
      var sellStrengthText = labels.sellPressure.strength === 'strong' ? '강' :
                             labels.sellPressure.strength === 'mid'    ? '중' : '약';
      return '<div class="rl-chips rl-chips-' + mode + ' rl-chips-sell-only">' +
             '<span class="rl-chip rl-chip-sell rl-chip-' + labels.sellPressure.strength + '">' +
             '🔴 매도압 ' + sellStrengthText + '</span>' +
             '</div>';
    }

    var chips = [];

    /* [v5.2.3] 매수세 강중약 항상 명시 — 스캐너 검출 = 당연 표시 (임계는 classifyRefinementLabels에서 1로 낮춤) */
    if (labels.buyPressure.active) {
      var buyStrengthText = labels.buyPressure.strength === 'strong' ? '강' :
                            labels.buyPressure.strength === 'mid'    ? '중' : '약';
      chips.push('<span class="rl-chip rl-chip-buy rl-chip-' + labels.buyPressure.strength + '">' +
                 '🟡 매수세 ' + buyStrengthText + '</span>');
    }
    if (labels.liquidityReaction.active) {
      chips.push('<span class="rl-chip rl-chip-liquidity">🔵 수급반응</span>');
    }
    if (labels.absorption.active) {
      chips.push('<span class="rl-chip rl-chip-absorption" title="' +
                 _ssEscapeHtml(labels.absorption.note || '') + '">🟢 흡수</span>');
    }
    if (labels.chaseRisk.level !== 'none') {
      var chaseText = labels.chaseRisk.level === 'extreme' ? '진입 부적합' :
                      labels.chaseRisk.level === 'high'    ? '강한 추격주의' : '추격주의';
      chips.push('<span class="rl-chip rl-chip-chase rl-chip-chase-' + labels.chaseRisk.level + '">⚠️ ' +
                 chaseText + '</span>');
    }

    if (chips.length === 0) {
      return '<div class="rl-chips rl-chips-empty">' +
             '<span class="rl-empty">정밀화 라벨 — 활성 신호 없음</span></div>';
    }
    return '<div class="rl-chips rl-chips-' + mode + '">' + chips.join('') + '</div>';
  }

  /* F3. 펼친 카드 정밀화 블록 (5차원 그래프 + 라벨 칩 + 위험도) */
  function renderRefinementExpandedBlock(rep, labels, ctx) {
    if (!rep) return '';
    ctx = ctx || {};

    if (!hasShadowInputData(rep)) {
      return '<div class="ss-refinement-block ss-refinement-nodata">' +
             '<div class="ss-refinement-title">📊 정밀화 검증</div>' +
             '<div class="ss-refinement-msg">알람 당시 raw 지표 부족 — 정밀화 표시 불가</div></div>';
    }

    if (!labels) labels = classifyRefinementLabels(rep);
    var raw = calcShadowScore(null, rep);
    var s = _normalizeShadowScore(raw);
    if (!s) {
      return '<div class="ss-refinement-block ss-refinement-nodata">' +
             '<div class="ss-refinement-title">📊 정밀화 검증</div>' +
             '<div class="ss-refinement-msg">계산 오류</div></div>';
    }

    var phase = (rep.currentPhase && rep.currentPhase.ratio) || 1.0;
    var rrText = s.rrValue > 0 ? ' <span class="ss-rr">RR ' + s.rrValue.toFixed(1) + '</span>' : '';

    var html = '<div class="ss-refinement-block">';
    html += '<div class="ss-refinement-title">📊 정밀화 검증 ' +
            '<span class="ss-refinement-version">phase1-v0</span>' +
            /* [v5.2.3] 라벨 5종 설명 모달 트리거 ❓ */
            '<button type="button" class="rl-info-btn" aria-label="라벨 설명" ' +
            'onclick="if(window.openRefinementLabelInfo)window.openRefinementLabelInfo();">❓</button>' +
            '</div>';

    /* 4차원 점수 그래프 (기존 .ss-bar-* 클래스 재사용) */
    html += '<div class="ss-refinement-scores ss-bars">';
    html += '<div class="ss-bar-row"><span class="ss-bar-lbl">매수세</span>' +
            _bbar(s.buyPressure, 10) +
            '<span class="ss-bar-val">' + s.buyPressure + '/10</span></div>';
    html += '<div class="ss-bar-row"><span class="ss-bar-lbl">수급반응</span>' +
            _bbar(s.liquidityReaction, 10) +
            '<span class="ss-bar-val">' + s.liquidityReaction + '/10</span></div>';
    html += '<div class="ss-bar-row"><span class="ss-bar-lbl">위치품질</span>' +
            _bbar(s.positionQuality, 10) +
            '<span class="ss-bar-val">' + s.positionQuality + '/10</span></div>';
    html += '<div class="ss-bar-row"><span class="ss-bar-lbl">손익비</span>' +
            _bbar(s.rrScore, 10) +
            '<span class="ss-bar-val">' + s.rrScore + '/10' + rrText + '</span></div>';
    html += '</div>';

    /* 위험도 + phase 메타 */
    html += '<div class="ss-refinement-meta">';
    html += '<span class="ss-risk-chip ss-risk-' + s.riskLevel + '">위험 ' + (s.riskLabel || s.riskLevel) + '</span>';
    html += '<span class="ss-phase-chip">📍 phase ' + phase.toFixed(2) + 'x</span>';
    html += '</div>';

    /* 라벨 5종 칩 */
    html += renderRefinementLabelChips(labels, 'expanded');

    html += '</div>';
    return html;
  }

  /* F4. B/C 검증샘플 요약 데이터 (snapshot 박제값 우선) */
  function buildBCSampleSummary(item) {
    if (!item) return null;

    var grade = (item.gradeCode || '').toUpperCase();
    if (grade !== 'B' && grade !== 'C') return null;

    /* Shadow 평균: snapshot 박제값 우선 (gradeHistory.shadowTotal 필드 없음 — 보정 #6) */
    var ss = item.shadowScore || (item.alertSnapshot && item.alertSnapshot.shadowScore) || null;
    var shadowAvg  = (ss && typeof ss.avgScore === 'number' && !ss.error) ? ss.avgScore.toFixed(1) : null;
    var riskLevel  = (ss && ss.riskLevel) || 'unknown';
    var riskLabel  = (ss && ss.riskLabel) || '';

    /* 승격 후보 판정 (gradeHistory 기반) */
    var gradeHistory = Array.isArray(item.gradeHistory) ? item.gradeHistory : [];
    var promotedGrades = gradeHistory.filter(function(ev) {
      var g = (ev && ev.gradeCode || '').toUpperCase();
      return g === 'A' || g === 'S' || g === 'SPLUS';
    });

    var promotionStatus = 'watching';
    var promotionTo = null;
    if (promotedGrades.length > 0) {
      promotionStatus = 'promoted';
      var lastG = (promotedGrades[promotedGrades.length - 1].gradeCode || '').toUpperCase();
      promotionTo = (lastG === 'SPLUS') ? 'S+' : lastG;
    } else if ((Number(item.sCount24) || 0) + (Number(item.aCount24) || 0) >= 2) {
      promotionStatus = 'candidate';
    }

    return {
      grade:      grade,
      shadowAvg:  shadowAvg,
      riskLevel:  riskLevel,
      riskLabel:  riskLabel,
      promotionStatus: promotionStatus,
      promotionTo:     promotionTo,
      sCount24:   Number(item.sCount24) || 0,
      aCount24:   Number(item.aCount24) || 0,
      mfe:        (typeof item.mfe === 'number') ? item.mfe : null,
      mae:        (typeof item.mae === 'number') ? item.mae : null
    };
  }

  /* F5. B/C 검증샘플 안내 HTML */
  function renderBCSampleNotice(item, summary) {
    if (!item || !summary) return '';

    var grade = summary.grade || '?';
    var html = '<div class="bc-sample-notice">';
    html += '<div class="bc-sample-banner">ⓘ 검증샘플 (' + _ssEscapeHtml(grade) +
            ') — 실전 알람 X / 추적 X / 박제만</div>';

    html += '<div class="bc-sample-summary">';
    html += '<span>등급 <b>' + _ssEscapeHtml(grade) + '</b></span>';
    if (summary.shadowAvg !== null) {
      html += '<span>Shadow 평균 <b>' + _ssEscapeHtml(summary.shadowAvg) + '/10</b></span>';
    }
    if (summary.riskLevel && summary.riskLevel !== 'unknown') {
      var rk = summary.riskLabel || (summary.riskLevel === 'high' ? '높음' :
                                     summary.riskLevel === 'mid'  ? '보통' : '낮음');
      html += '<span>위험도 <b>' + _ssEscapeHtml(rk) + '</b></span>';
    }
    if (summary.sCount24 || summary.aCount24) {
      html += '<span>24h 알람 S' + summary.sCount24 + ' / A' + summary.aCount24 + '</span>';
    }
    html += '</div>';

    /* 승격 상태 */
    var promoText = '';
    var promoClass = '';
    if (summary.promotionStatus === 'promoted') {
      promoText = '✅ ' + _ssEscapeHtml(summary.promotionTo || '') + ' 등급으로 승격됨';
      promoClass = 'bc-promotion-status-promoted';
    } else if (summary.promotionStatus === 'candidate') {
      promoText = '⏳ 승격 후보 (24h 누적 진행 중)';
      promoClass = 'bc-promotion-status-candidate';
    } else {
      promoText = '👀 검증 중 — 승격 미발생';
      promoClass = 'bc-promotion-status-watching';
    }
    html += '<div class="bc-promotion-status ' + promoClass + '">' + promoText + '</div>';

    html += '</div>';
    return html;
  }

  /* F6. 분석완료 결과 해석 (closeReturn 사후값 사용 OK) */
  function interpretCompletedResult(item, ctx) {
    if (!item) return null;
    ctx = ctx || {};

    var summary = item.summary || {};
    var mfe = (typeof summary.maxRise === 'number') ? summary.maxRise :
              (typeof item.mfe === 'number')        ? item.mfe :
              (typeof item.maxRise === 'number')    ? item.maxRise : null;
    var mae = (typeof summary.maxDrawdown === 'number') ? summary.maxDrawdown :
              (typeof item.mae === 'number')             ? item.mae :
              (typeof item.maxDrop === 'number')         ? item.maxDrop : null;
    var closeReturn = (typeof summary.closeReturn === 'number') ? summary.closeReturn :
                      (typeof item.closeReturn === 'number')    ? item.closeReturn : null;

    var durationMin = null;
    if (typeof item.completedAt === 'number' && typeof item.windowStart === 'number') {
      durationMin = Math.round((item.completedAt - item.windowStart) / 60000);
    } else if (typeof item.elapsedMs === 'number') {
      durationMin = Math.round(item.elapsedMs / 60000);
    }

    /* 추격 진입 여부 (alert 시점 phase >= 1.08) */
    var chaseEntry = false;
    var alertSnap = item.alertSnap || item.alertSnapshot || null;
    if (alertSnap && alertSnap.currentPhase) {
      var alertPhase = (typeof alertSnap.currentPhase.ratio === 'number') ? alertSnap.currentPhase.ratio : 1.0;
      chaseEntry = alertPhase >= 1.08;
    }

    /* Shadow 예측 vs 실제 매칭 라벨 (TP/TN/FP/FN) — Backfill 패널에서 이미 계산된 값이 있으면 그 라벨 그대로 */
    var shadowMatch = null;
    if (item.shadowVerification) {
      shadowMatch = String(item.shadowVerification).toUpperCase();
    } else if (alertSnap && alertSnap.shadowScore && typeof alertSnap.shadowScore.avgScore === 'number' && !alertSnap.shadowScore.error) {
      var ssAvg = alertSnap.shadowScore.avgScore;
      var ssPred = ssAvg >= 6 ? 'good' : (ssAvg >= 4 ? 'mid' : 'bad');
      var outcome = item.outcome || ctx.outcome || '';
      var actGood = (outcome === 'success' || outcome === 'partial');
      var actBad  = (outcome === 'fail');
      if (ssPred === 'good' && actGood) shadowMatch = 'TP';
      else if (ssPred === 'bad' && actBad) shadowMatch = 'TN';
      else if (ssPred === 'good' && actBad) shadowMatch = 'FP';
      else if (ssPred === 'bad' && actGood) shadowMatch = 'FN';
    }

    return {
      mfe: mfe, mae: mae, closeReturn: closeReturn,
      durationMin: durationMin,
      chaseEntry: chaseEntry,
      shadowMatch: shadowMatch,
      pattern: summary.pattern || item.pattern || null
    };
  }

  /* F7. 분석완료 해석 배지 HTML (데이터 없으면 숨김) */
  function renderCompletedInterpretation(item, interpretation) {
    if (!item || !interpretation) return '';
    var badges = [];

    if (typeof interpretation.mfe === 'number') {
      var sign = interpretation.mfe >= 0 ? '+' : '';
      badges.push('<span class="result-interp-badge result-interp-mfe">MFE ' +
                  sign + interpretation.mfe.toFixed(2) + '%</span>');
    }
    if (typeof interpretation.mae === 'number') {
      badges.push('<span class="result-interp-badge result-interp-mae">MAE ' +
                  interpretation.mae.toFixed(2) + '%</span>');
    }
    if (typeof interpretation.durationMin === 'number') {
      var d = interpretation.durationMin;
      var dStr = d >= 60 ? Math.floor(d / 60) + 'h ' + (d % 60) + 'm' : d + '분';
      badges.push('<span class="result-interp-badge result-interp-time">도달 ' + _ssEscapeHtml(dStr) + '</span>');
    }
    if (typeof interpretation.closeReturn === 'number') {
      var crSign = interpretation.closeReturn >= 0 ? '+' : '';
      badges.push('<span class="result-interp-badge result-interp-rr-match">마감 ' +
                  crSign + interpretation.closeReturn.toFixed(2) + '%</span>');
    }
    if (interpretation.shadowMatch) {
      var matchClass = 'result-interp-shadow-match-' + interpretation.shadowMatch.toLowerCase();
      badges.push('<span class="result-interp-badge ' + matchClass + '">Shadow ' +
                  _ssEscapeHtml(interpretation.shadowMatch) + '</span>');
    }
    if (interpretation.chaseEntry) {
      badges.push('<span class="result-interp-badge result-interp-chase">⚠ 추격 진입</span>');
    }

    if (badges.length === 0) return '';

    var html = '<div class="result-interp-block">';
    html += '<div class="result-interp-title">📈 결과 해석</div>';
    html += '<div class="result-interp-badges">' + badges.join('') + '</div>';
    html += '</div>';
    return html;
  }

  /* F8. ATR B 예상 계산 안내 (HTML 본체 미터치 / 표기 추가만) */
  function renderStrategyBExpectedNote(coin) {
    if (!coin) return '';
    return '<div class="strategy-b-expected-note">' +
           '<div class="strategy-b-expected-note-title">ⓘ 전략 B = 예상 계산 패널 (참고용)</div>' +
           '<div class="strategy-b-expected-note-desc">' +
           '실전 자동전략 X / ATR×N 기반 시뮬레이션 / "손절가" 명시 표기' +
           '</div></div>';
  }

  /* ═══════════════════════════════════════════════════════════════
   * v5.2.1 — F9. 닫힌 카드 라벨 우선순위 선별 (위험 라벨 우선)
   *
   * 닫힌 카드 4칩 한도 (메모리 #16 작업지시서):
   *   slot 1: 등급 칩 (필수)
   *   slot 2: 정밀/표준 칩 (필수)
   *   slot 3: 그룹 배지(N>1) OR 라벨 1
   *   slot 4: 라벨 1 OR 라벨 2
   *
   * → hasGroup=true 시 라벨 maxSlots = 1 (groupBadge 차지)
   * → hasGroup=false 시 라벨 maxSlots = 2
   *
   * 우선순위 7단계 (V-Q2=A 위험 라벨 우선):
   *   1순위: 🔴 매도압 강함 / ⚠️ 추격주의 extreme
   *   2순위: ⚠️ 추격주의 high / 🔴 매도압 일반
   *   3순위: 🟡 매수세 강함
   *   4순위: 🔵 수급반응
   *   5순위: ⚠️ 추격주의 mid
   *   6순위: 🟡 매수세 일반
   *   7순위: 🟢 흡수
   *
   * 충돌 처리:
   *   - 매수세 + 매도압 동시 → 매도압만 (위험 우선)
   *   - 추격주의 + 흡수 동시 → 추격주의만
   *   - 모두 비활성/데이터 부족 → 0개
   *
   * 반환: F1과 동일 형식의 라벨 부분집합 → renderRefinementLabelChips와 호환
   * ═══════════════════════════════════════════════════════════════ */
  function selectClosedCardLabels(labels, hasGroup) {
    /* 빈 부분집합 (모든 라벨 비활성) */
    var subset = {
      hasData: false,
      buyPressure:       { active: false },
      liquidityReaction: { active: false },
      absorption:        { active: false },
      chaseRisk:         { level: 'none' },
      sellPressure:      { active: false }
    };

    if (!labels || !labels.hasData) return subset;
    subset.hasData = true;

    var maxSlots = hasGroup ? 1 : 2;
    var picked = 0;

    /* 1순위: 매도압 강 (위험 최상) */
    if (picked < maxSlots && labels.sellPressure.active && labels.sellPressure.strength === 'strong') {
      subset.sellPressure = labels.sellPressure;
      picked++;
    }
    /* 1순위: 추격주의 extreme */
    if (picked < maxSlots && labels.chaseRisk.level === 'extreme') {
      subset.chaseRisk = labels.chaseRisk;
      picked++;
    }
    /* 2순위: 추격주의 high */
    if (picked < maxSlots && labels.chaseRisk.level === 'high' && subset.chaseRisk.level === 'none') {
      subset.chaseRisk = labels.chaseRisk;
      picked++;
    }
    /* 2순위: 매도압 일반 (강 아님) */
    if (picked < maxSlots && labels.sellPressure.active && labels.sellPressure.strength !== 'strong' && !subset.sellPressure.active) {
      subset.sellPressure = labels.sellPressure;
      picked++;
    }

    /* 위험 라벨이 1개 이상 활성 → 긍정 라벨 노출 차단 (충돌 처리) */
    var hasRisk = subset.sellPressure.active || subset.chaseRisk.level !== 'none';

    if (!hasRisk) {
      /* 3순위: 매수세 강 */
      if (picked < maxSlots && labels.buyPressure.active && labels.buyPressure.strength === 'strong') {
        subset.buyPressure = labels.buyPressure;
        picked++;
      }
      /* 4순위: 수급반응 */
      if (picked < maxSlots && labels.liquidityReaction.active) {
        subset.liquidityReaction = labels.liquidityReaction;
        picked++;
      }
      /* 5순위: 추격주의 mid (위험 라벨 mid는 긍정 라벨과 공존 X — hasRisk 체크 후이므로 여기는 스킵) */
      /* 6순위: 매수세 일반 */
      if (picked < maxSlots && labels.buyPressure.active && labels.buyPressure.strength !== 'strong' && !subset.buyPressure.active) {
        subset.buyPressure = labels.buyPressure;
        picked++;
      }
      /* 7순위: 흡수 */
      if (picked < maxSlots && labels.absorption.active) {
        subset.absorption = labels.absorption;
        picked++;
      }
    } else {
      /* 위험 라벨 활성 — 추격주의 mid는 추가 슬롯에 들어갈 수 있음 */
      if (picked < maxSlots && labels.chaseRisk.level === 'mid' && subset.chaseRisk.level === 'none') {
        subset.chaseRisk = labels.chaseRisk;
        picked++;
      }
    }

    return subset;
  }

  /* ═══════════════════════════════════════════════════════════════
   * F8. 라벨 5종 설명 모달 데이터 + 빌더 (v5.2.3)
   * ═══════════════════════════════════════════════════════════════ */
  var REFINEMENT_LABEL_INFO = [
    {
      icon: '🟡',
      title: '매수세',
      cls: 'rl-info-buy',
      desc: '거래량 / OBV / 가격 모멘텀 합산 점수 (0~10)',
      grades: [
        { tier: '강 (8~10점)', text: '강력한 매수 압력 — 거래량+OBV+모멘텀 모두 양호' },
        { tier: '중 (5~7점)',  text: '보통 매수 압력' },
        { tier: '약 (1~4점)',  text: '미약한 매수 압력 — 일부만 충족' }
      ],
      note: '※ 위험 high 등급에서는 표시 안 됨 / 스캐너 검출 코인은 항상 강중약 차별화 표시'
    },
    {
      icon: '🔵',
      title: '수급반응',
      cls: 'rl-info-liquidity',
      desc: '거래량 변화에 가격이 정상 반응하는지 검증',
      grades: [
        { tier: '활성 조건', text: '수급반응 점수 ≥ 6 + 위치품질 ≥ 5' }
      ],
      note: '※ 단계 구분 없음 (활성/비활성 이진)'
    },
    {
      icon: '🟢',
      title: '흡수',
      cls: 'rl-info-absorption',
      desc: '가격 안정 상태에서 매물 흡수 진행 추정',
      grades: [
        { tier: '활성 조건', text: '거래량 1.2배↑ + 변동률 < 5% + OBV 상승/평탄 + MFI ≥ 40' }
      ],
      note: '※ 입금량 데이터 X — 추정 라벨'
    },
    {
      icon: '⚠️',
      title: '추격주의',
      cls: 'rl-info-chase',
      desc: 'phase (현재가 / 박스 하단) 기반 단계',
      grades: [
        { tier: '진입 부적합 (extreme)', text: 'phase ≥ 1.25 — 너무 늦음, 진입 자제' },
        { tier: '강한 추격주의 (high)',  text: 'phase ≥ 1.15 — 추격 매수 고위험' },
        { tier: '추격주의 (mid)',        text: 'phase ≥ 1.08 — 진입 위치 다소 늦음' }
      ],
      note: '※ phase = 현재가 / 박스 하단 비율'
    },
    {
      icon: '🔴',
      title: '매도압',
      cls: 'rl-info-sell',
      desc: '거래량↑ + OBV↓ + 종가 약 + 윗꼬리 + MFI<50 — 5종 위험 신호 합산',
      grades: [
        { tier: '강 (4~5 신호)', text: '4개 이상 위험 신호 동시 발생 — 즉시 청산 검토' },
        { tier: '중 (3 신호)',   text: '3개 위험 신호 발생 — 주의' }
      ],
      note: '※ 매도압 active 시 다른 라벨 모두 숨김 (위험 신호 우선) / 2개 이하는 표시 안 함'
    }
  ];

  function buildLabelInfoModalHtml() {
    var html = '<div class="rl-info-modal">';
    html += '<div class="rl-info-modal-title">정밀화 라벨 5종 설명</div>';
    html += '<div class="rl-info-modal-cards">';
    for (var i = 0; i < REFINEMENT_LABEL_INFO.length; i++) {
      var info = REFINEMENT_LABEL_INFO[i];
      html += '<div class="rl-info-card ' + info.cls + '">';
      html += '<div class="rl-info-card-head">' + info.icon +
              ' <span class="rl-info-card-title">' + _ssEscapeHtml(info.title) + '</span></div>';
      html += '<div class="rl-info-card-desc">' + _ssEscapeHtml(info.desc) + '</div>';
      html += '<div class="rl-info-card-grades">';
      for (var j = 0; j < info.grades.length; j++) {
        var g = info.grades[j];
        html += '<div class="rl-info-grade">' +
                '<span class="rl-info-grade-tier">' + _ssEscapeHtml(g.tier) + '</span> ' +
                _ssEscapeHtml(g.text) + '</div>';
      }
      html += '</div>';
      if (info.note) {
        html += '<div class="rl-info-card-note">' + _ssEscapeHtml(info.note) + '</div>';
      }
      html += '</div>';
    }
    html += '</div>';
    html += '</div>';
    return html;
  }

  /* ─── 모듈 노출 ─── */
  global.WOOSShadowKit = {
    VERSION: 'v5.2.3',
    calcShadowScore: calcShadowScore,
    hasShadowInputData: hasShadowInputData,
    renderBackfillPanel: renderBackfillPanel,
    /* v5.1.4 — 라벨 UI 5종 */
    renderPreviewLabel: renderPreviewLabel,
    renderSampleLabel: renderSampleLabel,
    renderShadowChipFallback: renderShadowChipFallback,
    renderPromotionChip: renderPromotionChip,
    renderHistoryPromotionChip: renderHistoryPromotionChip,
    /* v5.1.6 — ATR B 함수 외부화 */
    buildAutoTradeStrategyB: buildAutoTradeStrategyB,
    /* v5.2.0 — 스캐너 정밀화 통합 */
    classifyRefinementLabels: classifyRefinementLabels,
    renderRefinementLabelChips: renderRefinementLabelChips,
    renderRefinementExpandedBlock: renderRefinementExpandedBlock,
    buildBCSampleSummary: buildBCSampleSummary,
    renderBCSampleNotice: renderBCSampleNotice,
    interpretCompletedResult: interpretCompletedResult,
    renderCompletedInterpretation: renderCompletedInterpretation,
    renderStrategyBExpectedNote: renderStrategyBExpectedNote,
    /* v5.2.1 — 닫힌 카드 라벨 */
    selectClosedCardLabels: selectClosedCardLabels,
    /* v5.2.3 — 라벨 5종 설명 모달 */
    buildLabelInfoModalHtml: buildLabelInfoModalHtml
  };

  /* ─── window alias 유지 ───
   * 본체 호출처 미터치를 위한 alias.
   * - WOOS_calcShadowScore / WOOS_hasShadowInputData (v5.1.3)
   *     index.html line 10500 / 11394 / 15632 / 15642 / 15656
   * - buildAutoTradeStrategyB (v5.1.6)
   *     index.html line 9917 (snapshot payload 박제)
   *     index.html line 11335 (전략 B HTML 빌드)
   */
  global.WOOS_calcShadowScore   = calcShadowScore;
  global.WOOS_hasShadowInputData = hasShadowInputData;
  global.buildAutoTradeStrategyB = buildAutoTradeStrategyB;

  try {
    if (typeof console !== 'undefined' && console.log) {
      console.log('[WOOS ShadowKit] loaded — VERSION =', global.WOOSShadowKit.VERSION);
    }
  } catch (e) {}
})(typeof window !== 'undefined' ? window : globalThis);
