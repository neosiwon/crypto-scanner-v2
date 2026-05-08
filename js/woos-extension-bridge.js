/* WOOS Extension Bridge
 * Base:    v4.9.5+phase2-v0-shadow-backfill-hotfix-r1
 * Current: v5.2.2 (스캐너 카드 정밀화 통합 — 본체 동기화. 시그니처 변경 0건)
 *
 * 본체 ↔ shadow-kit 어댑터. hook point 단일 관리.
 *
 * v5.2.1 변경:
 *   - 신규 hook 1개 추가 (기존 hook 7개 시그니처 변경 없음)
 *     · renderClosedHeaderLabelsAddon(rep, hasGroup) — 닫힌 카드 헤더 라벨 칩
 * v5.2.0 변경:
 *   - 신규 hook 4개 추가 (기존 hook 3개 시그니처 변경 없음)
 *     · renderRefinementBlock(rep, item, source) — 펼친 카드 정밀화 블록
 *     · renderBCSampleAddon(item, ctx)           — B/C 검증샘플 안내
 *     · renderCompletedAddon(item, ctx)          — 분석완료 해석 배지
 *     · renderStrategyBNoteAddon(coin)           — ATR B 예상 계산 안내
 * v5.1.5 변경: 본체 CSS 외부화 (Bridge JS 시그니처 변경 없음)
 * v5.1.4 변경: ShadowKit 라벨 UI 5종 추가 노출
 * v5.1.3 변경: ShadowKit이 calcShadowScore / hasShadowInputData까지 책임
 * v5.1.2 변경: renderHistoryAddon(item, ctx)로 시그니처 확장
 *
 * 보류 (v5.2.0 외):
 *   - renderAnalyzerAddon
 *   - buildSnapshotAddon
 */
(function (global) {
  'use strict';

  global.WOOSExtensionBridge = {
    VERSION: 'v5.2.2',

    // 스캐너 결과 카드 (buildCoinCardHTML)
    renderScannerCardAddon: function (coin, rep, idx) {
      return '';
    },

    // 추적 그룹/단일 카드 (v40_buildGroupCardHTML)
    renderCardAddon: function (group, vm) {
      return '';
    },

    // 분석완료 카드 (v462_buildHistoryCard)
    // ctx = { outcome: 'success'|'partial'|'fail'|'neutral' }
    renderHistoryAddon: function (item, ctx) {
      try {
        var k = global.WOOSShadowKit;
        return (k && typeof k.renderBackfillPanel === 'function')
          ? (k.renderBackfillPanel(item, ctx) || '')
          : '';
      } catch (e) { return ''; }
    },

    /* v5.2.0 — H1. 펼친 카드 정밀화 블록 */
    renderRefinementBlock: function (rep, item, source) {
      try {
        var k = global.WOOSShadowKit;
        if (!k || typeof k.renderRefinementExpandedBlock !== 'function' || !rep) return '';
        var labels = (typeof k.classifyRefinementLabels === 'function')
          ? k.classifyRefinementLabels(rep) : null;
        return k.renderRefinementExpandedBlock(rep, labels, { source: source || 'tracker' }) || '';
      } catch (e) { return ''; }
    },

    /* v5.2.0 — H2. B/C 검증샘플 안내 */
    renderBCSampleAddon: function (item, ctx) {
      try {
        var k = global.WOOSShadowKit;
        if (!k || typeof k.buildBCSampleSummary !== 'function' || !item) return '';
        var grade = (item.gradeCode || '').toUpperCase();
        if (grade !== 'B' && grade !== 'C') return '';
        var summary = k.buildBCSampleSummary(item);
        if (!summary) return '';
        return k.renderBCSampleNotice(item, summary) || '';
      } catch (e) { return ''; }
    },

    /* v5.2.0 — H3. 분석완료 해석 배지 */
    renderCompletedAddon: function (item, ctx) {
      try {
        var k = global.WOOSShadowKit;
        if (!k || typeof k.interpretCompletedResult !== 'function' || !item) return '';
        var interpretation = k.interpretCompletedResult(item, ctx || {});
        if (!interpretation) return '';
        return k.renderCompletedInterpretation(item, interpretation) || '';
      } catch (e) { return ''; }
    },

    /* v5.2.0 — H4. ATR B 예상 계산 안내 (HTML 본체 미터치 / 표기 추가만) */
    renderStrategyBNoteAddon: function (coin) {
      try {
        var k = global.WOOSShadowKit;
        if (!k || typeof k.renderStrategyBExpectedNote !== 'function' || !coin) return '';
        return k.renderStrategyBExpectedNote(coin) || '';
      } catch (e) { return ''; }
    },

    /* v5.2.1 — H5. 닫힌 카드 헤더 라벨 칩 (R10 row2 안 4칩 한도)
     * @param rep      추적 카드의 track 객체 (rep 역할 — vol/obv/mfi/currentPhase 등)
     * @param hasGroup 그룹 배지(x{N}) 존재 여부 — true면 라벨 1개로 축소
     */
    renderClosedHeaderLabelsAddon: function (rep, hasGroup) {
      try {
        var k = global.WOOSShadowKit;
        if (!k || typeof k.classifyRefinementLabels !== 'function' ||
                  typeof k.selectClosedCardLabels !== 'function' ||
                  typeof k.renderRefinementLabelChips !== 'function' || !rep) return '';
        var labels = k.classifyRefinementLabels(rep);
        if (!labels || !labels.hasData) return '';
        var subset = k.selectClosedCardLabels(labels, !!hasGroup);
        if (!subset || !subset.hasData) return '';
        return k.renderRefinementLabelChips(subset, 'closed') || '';
      } catch (e) { return ''; }
    }
  };

  try {
    if (typeof console !== 'undefined' && console.log) {
      console.log('[WOOS Bridge] loaded — VERSION =', global.WOOSExtensionBridge.VERSION);
    }
  } catch (e) {}
})(typeof window !== 'undefined' ? window : globalThis);
