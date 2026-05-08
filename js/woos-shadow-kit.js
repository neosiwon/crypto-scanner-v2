/* WOOS Shadow Kit
 * Base:    v4.9.5+phase2-v0-shadow-backfill-hotfix-r1
 * Current: v5.1.2 (분석완료 Backfill 외부화)
 *
 * Shadow Score / 라벨 / Backfill / ATR B / B-C 검증샘플 담당.
 *
 * v5.1.2 = 분석완료 Backfill 인라인을 본체에서 이전 (재작성 X, 동작 동일).
 *   - 데이터 부족 시 가짜 점수 차단 (hotfix-r1 의도 보존)
 *   - TP / TN / FP / FN / 중립 라벨 매칭 (outcome 기준)
 *   - WOOS_calcShadowScore / WOOS_hasShadowInputData 는 본체 그대로 호출
 *
 * 후속 라운드:
 *   v5.1.3 (Shadow Score 계산 외부화) — calc/has 함수 외부화
 *   v5.1.4 (ATR B 라벨 검증샘플 외부화)
 *   v5.1.5 (Shadow CSS 디자인 정리)
 */
(function (global) {
  'use strict';

  /* 막대 게이지 헬퍼 — 본체 _bbar 와 동일 구현 */
  function _bbar(val, max) {
    var pct = Math.min(100, Math.max(0, (val / max) * 100));
    return '<span class="ss-bar-track"><span class="ss-bar-fill" style="width:' + pct + '%;"></span></span>';
  }

  /**
   * 분석완료 Backfill 패널 HTML 빌드 (이전: index.html line 20467~20549 인라인)
   *
   * @param {Object} item  - history item
   * @param {Object} ctx   - { outcome: 'success'|'partial'|'fail'|'neutral' }
   * @return {string}      - HTML 문자열 또는 '' (의존 함수 부재 / 예외 시)
   *
   * 분기:
   *   1) WOOS_calcShadowScore 미정의 → ''
   *   2) WOOS_hasShadowInputData(snap) === false → "데이터 부족" 패널
   *   3) 정상 → Shadow Score 패널 + 검증 매칭 라벨 + 4-bar
   */
  function renderBackfillPanel(item, ctx) {
    ctx = ctx || {};
    var outcome = ctx.outcome || '';
    var html = '';
    try {
      if (typeof global.WOOS_calcShadowScore === 'function') {
        // alertSnap에서 coin/rep 재구성하여 Shadow Score 계산
        var snap = (item && (item.alertSnap || item)) || {};
        if (typeof global.WOOS_hasShadowInputData === 'function' && !global.WOOS_hasShadowInputData(snap)) {
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
          var ssBackfill = global.WOOS_calcShadowScore(pseudoCoin, pseudoRep);
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
      }
    } catch (_bfErr) {}
    return html;
  }

  global.WOOSShadowKit = {
    VERSION: 'v5.1.2',
    renderBackfillPanel: renderBackfillPanel
  };

  try {
    if (typeof console !== 'undefined' && console.log) {
      console.log('[WOOS ShadowKit] loaded — VERSION =', global.WOOSShadowKit.VERSION);
    }
  } catch (e) {}
})(typeof window !== 'undefined' ? window : globalThis);
