/* WOOS Extension Bridge
 * Base:    v4.9.5+phase2-v0-shadow-backfill-hotfix-r1
 * Current: v5.1.1 (최소 브릿지 모듈화)
 *
 * 본체 ↔ shadow-kit 어댑터. hook point 단일 관리.
 * v5.1.1 = 빈 어댑터 (모든 hook이 '' 반환). 기능 동작 변경 0.
 *
 * 보류 (v5.1.1 외):
 *   - renderAnalyzerAddon
 *   - buildSnapshotAddon
 */
(function (global) {
  'use strict';

  global.WOOSExtensionBridge = {
    VERSION: 'v5.1.1',

    // 스캐너 결과 카드 (buildCoinCardHTML)
    renderScannerCardAddon: function (coin, rep, idx) {
      return '';
    },

    // 추적 그룹/단일 카드 (v40_buildGroupCardHTML)
    renderCardAddon: function (group, vm) {
      return '';
    },

    // 분석완료 카드 (v462_buildHistoryCard)
    renderHistoryAddon: function (item) {
      return '';
    }
  };

  try {
    if (typeof console !== 'undefined' && console.log) {
      console.log('[WOOS Bridge] loaded — VERSION =', global.WOOSExtensionBridge.VERSION);
    }
  } catch (e) {}
})(typeof window !== 'undefined' ? window : globalThis);
