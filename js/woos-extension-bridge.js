/* WOOS Extension Bridge
 * Base:    v4.9.5+phase2-v0-shadow-backfill-hotfix-r1
 * Current: v5.1.6 (ATR B 함수 외부화)
 *
 * 본체 ↔ shadow-kit 어댑터. hook point 단일 관리.
 *
 * v5.1.5 변경:
 *   - 본체 인라인 CSS(line 5792~6322)를 woos-shadow.css로 이전 (Bridge JS 시그니처 변경 없음)
 *   - 한글 요약 화면 표기 (HTML_VERSION_LABEL 추가)
 * v5.1.4 변경:
 *   - ShadowKit이 라벨 UI 5종 추가 노출
 * v5.1.3 변경:
 *   - ShadowKit이 calcShadowScore / hasShadowInputData까지 책임
 * v5.1.2 변경:
 *   - renderHistoryAddon(item, ctx)로 시그니처 확장 — outcome 전달
 *
 * 보류 (v5.1.5 외):
 *   - renderAnalyzerAddon
 *   - buildSnapshotAddon
 *   - ATR B (전략 B 함수/HTML/CSS — v5.1.6 예정)
 */
(function (global) {
  'use strict';

  global.WOOSExtensionBridge = {
    VERSION: 'v5.1.6',

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
    }
  };

  try {
    if (typeof console !== 'undefined' && console.log) {
      console.log('[WOOS Bridge] loaded — VERSION =', global.WOOSExtensionBridge.VERSION);
    }
  } catch (e) {}
})(typeof window !== 'undefined' ? window : globalThis);
