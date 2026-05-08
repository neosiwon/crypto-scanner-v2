/* WOOS Shadow Kit
 * Base:    v4.9.5+phase2-v0-shadow-backfill-hotfix-r1
 * Current: v5.1.3 (Shadow Score 계산 외부화)
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

  /* ─── 모듈 노출 ─── */
  global.WOOSShadowKit = {
    VERSION: 'v5.1.3',
    calcShadowScore: calcShadowScore,
    hasShadowInputData: hasShadowInputData,
    renderBackfillPanel: renderBackfillPanel
  };

  /* ─── window alias 유지 (D-Q1=A) ───
   * 본체 호출처 5곳 미터치를 위한 alias.
   * - index.html line 10500 (snapshot payload 박제)
   * - index.html line 11512 (buildCoinCardHTML 스캐너 카드)
   * - index.html line 15750/15760/15774 (분석완료 통계)
   */
  global.WOOS_calcShadowScore   = calcShadowScore;
  global.WOOS_hasShadowInputData = hasShadowInputData;

  try {
    if (typeof console !== 'undefined' && console.log) {
      console.log('[WOOS ShadowKit] loaded — VERSION =', global.WOOSShadowKit.VERSION);
    }
  } catch (e) {}
})(typeof window !== 'undefined' ? window : globalThis);
