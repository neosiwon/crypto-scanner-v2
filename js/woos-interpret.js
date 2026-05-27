/* WOOS Interpret (보조 해석 레이어)
 * Base:    v4.9.5+phase2-v0-shadow-backfill-hotfix-r1
 * Current: v5.2.6 (본체 동기화 — 운영/진단/뉴스 외부화 패치. interpret 자체 변경 0건)
 *
 * 본체 index.html 5개 영역에서 통째 이전:
 *   9626~9790  — calcAccumulationStrength(★) / estimateAccumulationCostRange
 *                / estimateDistributionTargets / calcFakePump(★) / calcLateEntry(★)
 *   9802~9812  — calcPriceGap
 *   10274~10339 — buildScoreSummary / buildAnalysis / buildRiskDetails
 *   10958~10967 — buildRiskTagText
 *   11480~11488 — smartFixed (헬퍼, estimate* 의존)
 *
 * ★ = 동결 함수 (calcAccumulationStrength / calcFakePump / calcLateEntry)
 *     → 본문/시그니처 변경 0건 / 사용자 명시 승인 받음
 *
 * 호출처 (모두 window alias로 도달):
 *   index.html 10437~10489 — analyzeSymbolForExchange 내부
 *   index.html 10683 — calcPriceGap (coin 통합 단계)
 *   index.html 11204 — buildRiskTagText (riskDetails UI 렌더)
 *
 * 외부화 X (본체 잔류):
 *   fetchUSDTKRW (9791~9800) — 네트워크 fetch, interpret 범위 외
 */
(function (global) {
  'use strict';

  // ── 헬퍼: 동적 소수점 ─────────────────────────────────────────────
  function smartFixed(n) {
    if (n == null || isNaN(n)) return n;
    var abs = Math.abs(n);
    if (abs === 0) return 0;
    if (abs >= 1) return parseFloat(n.toFixed(4));
    if (abs >= 0.01) return parseFloat(n.toFixed(6));
    if (abs >= 0.0001) return parseFloat(n.toFixed(8));
    return parseFloat(n.toFixed(10));
  }

  // ══════════════════════════════════════════════════════════════════
  // [v2 PATCH] 설명 레이어 함수 3개
  // 기존 코어 변경 없이 analyzeSymbolForExchange() 마지막에서만 호출
  // ══════════════════════════════════════════════════════════════════

  // ── 1. 매집 강도 계산 ─────────────────────────────────────────────
  // 기존 gradeCode/total/action을 대체하지 않는 보조 해석 정보
  // prePump=false이면 '참고 불가' 반환 (UI/알람에서 사용 불가)
  // BTC 패널티 >= 2이면 라벨 하향
  function calcAccumulationStrength(prePump, volRatio, volAccel, obvTrend, btcPenalty) {
    var score = 0;

    // 거래량 점수
    if      (volRatio >= 1.5) score += 2;
    else if (volRatio >= 1.3) score += 1;

    // 속도 점수
    if      (volAccel >= 1.2)  score += 2;
    else if (volAccel >= 1.05) score += 1;

    // OBV 점수
    if (obvTrend === 'up') score += 2;

    // 라벨 결정
    var label  = score >= 5 ? '강함' : score >= 3 ? '보통' : '약함';
    var reason = [];
    if (volRatio >= 1.5) reason.push('거래량 강');
    else if (volRatio >= 1.3) reason.push('거래량 보통');
    if (volAccel >= 1.2) reason.push('속도 강');
    else if (volAccel >= 1.05) reason.push('속도 보통');
    if (obvTrend === 'up') reason.push('OBV 상승');
    var reasonStr = reason.length ? reason.join(' + ') : '신호 약함';

    // PRE-PUMP 가드 — 가장 중요
    // prePump=false이면 내부 score는 보존하되 label=참고 불가
    if (!prePump) {
      return { score: score, label: '참고 불가', reason: 'PRE-PUMP 미충족' };
    }

    // BTC 약세 패널티 하향 보정
    if (btcPenalty >= 2) {
      if      (label === '강함') label = '보통';
      else if (label === '보통') label = '약함';
      reasonStr += ' / BTC 약세 영향';
    }

    return { score: score, label: label, reason: reasonStr };
  }

  // ── 2. 세력 평단 추정 ─────────────────────────────────────────────
  // 대표 거래소 캔들 기준 VWAP 유사값 (무거운 매물대 대체)
  // 패닉셀 장대음봉은 가중치 0.5로 이상치 완화
  function estimateAccumulationCostRange(candles, box, atr) {
    var THRESHOLD = 1.15; // finalEntryAllowed 기준값 (여기서 정의해 공유)

    // 박스 내부 캔들만 추출
    var inner = candles.filter(function(c) {
      return c.close >= box.low && c.close <= box.high;
    });

    // 데이터 부족 fallback
    if (inner.length < 3) {
      var ctr = (box.high + box.low) / 2;
      return {
        low:        smartFixed(ctr - atr * 0.5),
        center:     smartFixed(ctr),
        high:       smartFixed(ctr + atr * 0.5),
        confidence: '낮음'
      };
    }

    // 거래량 상위 30% (최소 5개)
    var sorted = inner.slice().sort(function(a,b){ return b.volume - a.volume; });
    var topN   = Math.max(5, Math.floor(sorted.length * 0.3));
    var top    = sorted.slice(0, topN);

    // 가중 평균 계산 — 패닉셀 anomaly 보정 (수식 고정)
    var totalW = 0, totalWP = 0, anomalyCount = 0;
    top.forEach(function(c) {
      var range = c.high - c.low;
      var bodyRatio = range > 0 ? (c.open - c.close) / range : 0; // 음봉 기준
      var isPanic   = (c.open > c.close) && (bodyRatio > 0.6);    // 수식 고정
      var w  = isPanic ? c.volume * 0.5 : c.volume;
      var tp = (c.high + c.low + c.close) / 3;
      totalW  += w;
      totalWP += tp * w;
      if (isPanic) anomalyCount++;
    });

    var center = totalW > 0 ? totalWP / totalW : (box.high + box.low) / 2;

    // confidence 판단 (박스 좁으면 하향)
    var conf;
    if (top.length >= 8 && anomalyCount <= 1) conf = '높음';
    else if (top.length >= 5)                  conf = '보통';
    else                                        conf = '낮음';

    if (box.rangePercent < 3) {
      // 좁은 박스 → confidence 한 단계 하향
      if      (conf === '높음') conf = '보통';
      else if (conf === '보통') conf = '낮음';
    }

    return {
      low:        smartFixed(center - atr * 0.5),
      center:     smartFixed(center),
      high:       smartFixed(center + atr * 0.5),
      confidence: conf
    };
  }

  // ── 3. 분배 목표가 계산 ───────────────────────────────────────────
  // 박스 rangePercent 기반 동적 1차 목표 (고정 배수 금지)
  // 박스 상단보다 낮은 목표가 금지 (안전장치)
  function estimateDistributionTargets(costCenter, atr, box) {
    if (!costCenter || costCenter <= 0) {
      return { target1:0, target2:0, target3:0, note:'평단 추정 불가' };
    }

    // 1차: 동적 계산 — rangePercent 기반 + 박스 상단 안전장치
    var rawT1 = costCenter * (1 + (box.rangePercent / 100) * 1.5);
    var t1    = Math.max(rawT1, box.high * 1.05);

    // 2차, 3차: 계단형 증가
    var t2 = Math.max(costCenter * 1.65, t1 * 1.15);
    var t3 = Math.max(costCenter * 2.10, t2 * 1.15);

    return {
      target1: smartFixed(t1),
      target2: smartFixed(t2),
      target3: smartFixed(t3),
      note:    '1차: 박스 상단 돌파 이후 / 2차: 메인 분배 / 3차: 과열 확장'
    };
  }


  // ── [PATCH v2-2] 신규 함수 6개 ────────────────────────────────────
  // calcFakePump / calcLateEntry / calcPriceGap
  // buildScoreSummary / buildAnalysis / buildRiskDetails

  // ── fakePump 탐지 ─────────────────────────────────────────────────
  // 진짜 매집 vs 물린 반등 구분
  // box.isBreakout 불필요 — 박스 내부에서도 반등 가능
  function calcFakePump(candles, box, volRatio, obvTrend, currentPrice) {
    if (!candles || candles.length < 10) return false;
    if (obvTrend !== 'up' || volRatio < 1.3) return false;
    var recent10 = candles.slice(-10);
    var recentLow = Math.min.apply(null, recent10.map(function(c){ return c.low; }));
    var risePct = recentLow > 0 ? (currentPrice - recentLow) / recentLow * 100 : 0;
    if (risePct <= 10) return false;
    // 최근 5봉 내 박스 하단 이탈 후 회복
    var recent5Min = Math.min.apply(null, candles.slice(-5).map(function(c){ return c.low; }));
    return (recent5Min < box.low && currentPrice > box.low);
  }

  // ── lateEntry 탐지 ───────────────────────────────────────────────
  // 돌파 후 늦은 진입 — action 변경 금지, actionDesc만 변경
  // box.isBreakout 조건 복구 (오탐 방지)
  function calcLateEntry(candles, cpRatio, boxIsBreakout) {
    if (!candles || candles.length < 10) return false;
    if (!boxIsBreakout) return false;           // 박스 미돌파이면 lateEntry 아님
    if (cpRatio <= 1.10) return false;
    var recent10Max = Math.max.apply(null, candles.slice(-10).map(function(c){ return c.high; }));
    var currentClose = candles[candles.length - 1].close;
    return currentClose > recent10Max;
  }

  // ── priceGap 계산 ────────────────────────────────────────────────
  // 반드시 coin 통합 단계에서 호출 (거래소별 독립 분석 함수에서 호출 금지)
  // null이면 숫자 출력 금지 — gapStatus 문구만 사용
  function calcPriceGap(upbitPrice, binancePrice, usdtkrw) {
    if (!binancePrice || binancePrice <= 0 || !upbitPrice || upbitPrice <= 0) {
      return { gap: null, gapStatus: '해외 가격 없음' };
    }
    var fx = (usdtkrw && usdtkrw > 0) ? usdtkrw : 1350;
    var binanceKrw = binancePrice * fx;
    if (!binanceKrw || binanceKrw <= 0) return { gap: null, gapStatus: '계산 불가' };
    var gap = parseFloat((((upbitPrice - binanceKrw) / binanceKrw) * 100).toFixed(2));
    var gapStatus = gap > 2 ? '국내 과열' : gap < -2 ? '해외 선행' : '중립';
    return { gap: gap, gapStatus: gapStatus };
  }

  // ── 점수 근거 시각화 ─────────────────────────────────────────────
  // "+3 PRE-PUMP / +1 속도 / +1 OBV / -2 BTC" 형식
  // 기존 scoreSummary 계산 코드 대체
  function buildScoreSummary(prePump, volAccel, obvTrend, btcPenalty) {
    var parts = [];
    if (prePump) parts.push('+3 PRE-PUMP');
    if      (volAccel > 1.2)  parts.push('+1 속도('+volAccel+'x)');
    else if (volAccel > 1.05) parts.push('+0.5 속도('+volAccel+'x)');
    if (obvTrend === 'up') parts.push('+1 OBV');
    if (btcPenalty > 0) parts.push('-'+btcPenalty+' BTC');
    return parts.length ? parts.join(' / ') : '기본값';
  }

  // ── 구조 해석 ────────────────────────────────────────────────────
  // strengths / weaknesses / conclusion 3구조
  function buildAnalysis(prePump, volRatio, rsi, box, obvTrend, btcPenalty, volAccel) {
    var strengths = [], weaknesses = [];
    if (prePump) strengths.push('PRE-PUMP 조건 충족');
    if (box.isSideways && box.isNearTop) strengths.push('박스 상단 근접 — 돌파 직전 구조');
    if (box.isBreakout && box.breakoutStrength <= 5) strengths.push('초기 돌파('+box.breakoutStrength.toFixed(1)+'%) ✅');
    if (rsi >= 50 && rsi <= 62) strengths.push('RSI 적정('+rsi.toFixed(1)+') — 과열 없음');
    if (obvTrend === 'up') strengths.push('OBV 상승 선행');
    if (volRatio >= 1.5) strengths.push('거래량 강('+volRatio+'x)');
    else if (volRatio >= 1.3) strengths.push('거래량 증가('+volRatio+'x)');
    if (volAccel >= 1.2) strengths.push('속도 강('+volAccel+'x)');

    if (!prePump) weaknesses.push('PRE-PUMP 미충족');
    if (rsi > 68) weaknesses.push('RSI 과열('+rsi.toFixed(1)+')');
    if (btcPenalty >= 2) weaknesses.push('BTC 약세 — 알트 동반 하락 위험');
    if (btcPenalty > 0 && btcPenalty < 2) weaknesses.push('BTC 중립 이하');
    if (box.isBreakout && box.breakoutStrength > 8) weaknesses.push('돌파 '+box.breakoutStrength.toFixed(1)+'% — 추격 구간');
    if (volRatio < 1.3) weaknesses.push('거래량 부족 — 매집 확인 필요');

    var conclusion;
    if (strengths.length >= 3 && !weaknesses.length)
      conclusion = '구조 + 거래량 동시 확인 — 진입 유효';
    else if (strengths.length > weaknesses.length)
      conclusion = '구조는 좋지만 일부 리스크 — 단계적 접근';
    else
      conclusion = '신호 미확정 — 관찰 유지';

    return { strengths: strengths, weaknesses: weaknesses, conclusion: conclusion };
  }

  // ── 리스크 상세 ──────────────────────────────────────────────────
  // 카테고리 배지 형태로 출력
  function buildRiskDetails(box, volRatio, btcPenalty, fakePump, lateEntry, hasBinance, obvDivergence) {
    var risks = [];
    if (!box.isBreakout)
      risks.push({ cat:'구조', desc:'돌파 미확정 — 상단 저항 실패 가능' });
    else if (box.breakoutStrength > 8)
      risks.push({ cat:'구조', desc:'돌파 '+box.breakoutStrength.toFixed(1)+'% — 추격 주의' });
    if (volRatio > 3.0)
      risks.push({ cat:'거래량', desc:volRatio+'x 급증 — 단발성 가능' });
    if (btcPenalty >= 2)
      risks.push({ cat:'시장', desc:'BTC 하락 추세 — 알트 동반 하락 위험' });
    if (!hasBinance)
      risks.push({ cat:'데이터', desc:'바이낸스 미수집 — 교차 검증 약함' });
    if (fakePump)
      risks.push({ cat:'패턴', desc:'반등 가능성 — 물린 세력 탈출 주의' });
    if (lateEntry)
      risks.push({ cat:'타이밍', desc:'돌파 후 늦은 진입 — 눌림 대기 권장' });
    if (obvDivergence)
      risks.push({ cat:'OBV', desc:'OBV 다이버전스 — 상승 모멘텀 약화' });
    return risks;
  }

  // ── 리스크 태그 텍스트 (UI 표시용) ───────────────────────────────
  function buildRiskTagText(item){
    if (!item) return '';
    var cat = String(item.cat || '').toLowerCase();
    if (cat.indexOf('fake') >= 0) return '[🚫 ENTRY 차단]';
    if (cat.indexOf('late') >= 0) return '[🚫 ENTRY 차단]';
    if (cat.indexOf('신뢰') >= 0) return '[🚫 ENTRY 차단]';
    if (cat.indexOf('괴리') >= 0 || cat.indexOf('거래소') >= 0) return '[⚠️ 총점 미반영 / 참고용]';
    if (cat.indexOf('btc') >= 0) return '[⚠️ 주의]';
    return '[ℹ️ 설명용]';
  }

  /* ─── 모듈 노출 ─── */
  global.WOOSInterpret = {
    VERSION: 'v5.2.6',
    calcAccumulationStrength: calcAccumulationStrength,
    estimateAccumulationCostRange: estimateAccumulationCostRange,
    estimateDistributionTargets: estimateDistributionTargets,
    calcFakePump: calcFakePump,
    calcLateEntry: calcLateEntry,
    calcPriceGap: calcPriceGap,
    buildScoreSummary: buildScoreSummary,
    buildAnalysis: buildAnalysis,
    buildRiskDetails: buildRiskDetails,
    buildRiskTagText: buildRiskTagText,
    smartFixed: smartFixed
  };

  /* ─── window alias (본체 호출처 미터치) ─── */
  global.calcAccumulationStrength = calcAccumulationStrength;
  global.estimateAccumulationCostRange = estimateAccumulationCostRange;
  global.estimateDistributionTargets = estimateDistributionTargets;
  global.calcFakePump = calcFakePump;
  global.calcLateEntry = calcLateEntry;
  global.calcPriceGap = calcPriceGap;
  global.buildScoreSummary = buildScoreSummary;
  global.buildAnalysis = buildAnalysis;
  global.buildRiskDetails = buildRiskDetails;
  global.buildRiskTagText = buildRiskTagText;
  global.smartFixed = smartFixed;

  try {
    if (typeof console !== 'undefined' && console.log) {
      console.log('[WOOS Interpret] loaded — VERSION =', global.WOOSInterpret.VERSION);
    }
  } catch (e) {}
})(typeof window !== 'undefined' ? window : globalThis);
