/* WOOS Shadow Kit
 * Base:    v4.9.5+phase2-v0-shadow-backfill-hotfix-r1
 * Current: v5.1.1 (최소 브릿지 모듈화)
 *
 * Shadow Score / 라벨 / Backfill / ATR B / B-C 검증샘플 담당.
 * v5.1.1 = namespace만. 실제 로직 이전은 v5.1.2부터.
 *
 * 이전 로드맵:
 *   v5.1.2 = 분석완료 Backfill 외부화
 *   v5.1.3 = Shadow Score 계산 로직 외부화
 *   v5.1.4 = ATR B / 라벨 / 검증샘플 외부화
 *   v5.1.5 = Shadow CSS/디자인 정리
 */
(function (global) {
  'use strict';

  global.WOOSShadowKit = {
    VERSION: 'v5.1.1'
  };

  try {
    if (typeof console !== 'undefined' && console.log) {
      console.log('[WOOS ShadowKit] loaded — VERSION =', global.WOOSShadowKit.VERSION);
    }
  } catch (e) {}
})(typeof window !== 'undefined' ? window : globalThis);
