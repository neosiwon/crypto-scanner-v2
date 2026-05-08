/* WOOS Extension Bridge
 * Base:    v4.9.5+phase2-v0-shadow-backfill-hotfix-r1
 * Current: v5.1.2 (분석완료 Backfill 외부화)
 *
 * 본체 ↔ shadow-kit 어댑터. hook point 단일 관리.
 *
 * v5.1.2 변경:
 *   - renderHistoryAddon(item, ctx)로 시그니처 확장 — outcome 등 컨텍스트 전달
 *   - renderHistoryAddon → ShadowKit.renderBackfillPanel 위임
 *   - scanner / card hook은 v5.1.1 그대로 (빈 반환)
 *
 * 보류 (v5.1.2 외):
 *   - renderAnalyzerAddon
 *   - buildSnapshotAddon
 */
(function (global) {
  'use strict';

  global.WOOSExtensionBridge = {
    VERSION: 'v5.1.2',

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
