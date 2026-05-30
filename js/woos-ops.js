/* WOOS Ops (운영/진단/대시보드/뉴스)
 * Base:    v4.9.5+phase2-v0-shadow-backfill-hotfix-r1
 * Current: v5.2.6.1 (본체 동기화 — 텔레그램 발송 차단 hotfix. ops 자체 변경 0건)
 *
 * 본체 index.html 5개 영역(8623~8914 / 8966~9062 / 9068~9120 / 9122~9478 / 10660~10717)에서 통째 이전.
 * 본문/시그니처 변경 X / window alias 유지로 호출처(HTML onclick 등) 미터치.
 *
 * 동결 함수: 0건 (전부 UI/운영, 점수/등급/추적과 무관)
 *
 * 포함 (26종 함수 + 변수 5종 + 자동 실행 IIFE 2개):
 *   섹션 DIAG (6) : diagShowResult / diagClearResult / diagEsc / diagTelegramDirect / diagAlertState / diagKVSave
 *   섹션 OPS  (6) : opsGetBase / opsFormatJSON / opsMigrate / opsVerifyBatch / opsPendingStatus / opsDashboard
 *   섹션 BUILD(4) : fetchBuildInfo / updateBuildBadge / shortenBuildTag / showBuildInfo (+ initBuildInfo IIFE)
 *   섹션 TABS (1) : switchTab (+ initTabFromHash IIFE)
 *   섹션 OUTCOME(10): _outcomeEsc / _outcomeGetBase / refreshOutcomeDashboard / updateOutcomeTabBadge /
 *                    renderOutcomeDashboard / _kpiCard / _renderDistribution / _renderSectionBar /
 *                    _renderSectionRow / _renderGradeEvolution / _renderRecentCard / _outcomeCardClick / setOutcomeUnit
 *   섹션 NEWS (1) : loadCoinNews
 */
(function (global) {
  'use strict';

  // ═══════════════════════════════════════════════════════════════
  // [MODULE: diagnostic_functions]  — v3.5 진단 JS (임시)
  // 향후 제거 또는 dev-only 플래그 뒤로 숨김 예정.
  // UI: [MODULE: diagnostic_panel] 과 페어링.
  // ═══════════════════════════════════════════════════════════════

  function diagShowResult(html) {
    var box = document.getElementById('diagResult');
    var btn = document.getElementById('diagClearBtn');
    if (!box) return;
    box.style.display = 'block';
    box.innerHTML = html;
    if (btn) btn.style.display = 'inline-block';
  }
  function diagClearResult() {
    var box = document.getElementById('diagResult');
    var btn = document.getElementById('diagClearBtn');
    if (box) box.style.display = 'none';
    if (btn) btn.style.display = 'none';
  }
  function diagEsc(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  // 진단 1: 텔레그램 Bot API 직접 호출
  function diagTelegramDirect() {
    var tok = '';
    var cid = '';
    try {
      tok = localStorage.getItem('tg_token') || '';
      cid = localStorage.getItem('tg_chatid') || '';
    } catch(e) {}
    if (!tok || !cid) {
      diagShowResult('<span style="color:#f87171">❌ 토큰 또는 chatID 없음</span>\n텔레그램 알림 설정에서 값을 먼저 입력하세요.');
      return;
    }
    diagShowResult('⏳ 발송 중...');
    var msg = '[DIAG ' + new Date().toLocaleTimeString('ko-KR') + '] 진단 버튼에서 직접 발송';
    fetch('https://api.telegram.org/bot' + tok + '/sendMessage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: cid, text: msg })
    })
    .then(function(r) { return r.json().then(function(d){ return {status:r.status, data:d}; }); })
    .then(function(res) {
      var ok = res.data && res.data.ok;
      var header = ok
        ? '<span style="color:#4ade80">✅ 발송 성공 (HTTP ' + res.status + ')</span>\n텔레그램 확인하세요.'
        : '<span style="color:#f87171">❌ 실패 (HTTP ' + res.status + ')</span>';
      diagShowResult(header + '\n\n' + diagEsc(JSON.stringify(res.data, null, 2)));
    })
    .catch(function(e) {
      diagShowResult('<span style="color:#f87171">❌ 네트워크 에러</span>\n' + diagEsc(e.message));
    });
  }

  // 진단 2: alert_state (쿨다운 상태) 조회
  function diagAlertState() {
    var raw = '';
    try { raw = localStorage.getItem('alert_state') || ''; } catch(e) {}
    if (!raw) {
      diagShowResult('<span style="color:#fbbf24">⚠ alert_state 없음</span>\n아직 한 번도 알람을 보낸 적이 없거나, 쿨다운 이력이 초기화된 상태입니다.');
      return;
    }
    try {
      var parsed = JSON.parse(raw);
      var coins = Object.keys(parsed);
      var now = Date.now();
      var header = '<span style="color:#4ade80">📋 쿨다운 중인 코인: ' + coins.length + '개</span>\n현재 시각: ' + new Date(now).toLocaleTimeString('ko-KR') + '\n\n';
      var lines = [];
      coins.forEach(function(base) {
        var st = parsed[base];
        var grade = st.lastGrade || '?';
        var score = st.lastScore || 0;
        var sentAt = st.sentAt || {};
        var types = Object.keys(sentAt).map(function(t) {
          var elapsed = Math.floor((now - sentAt[t]) / 60000);
          return '  ' + t + ': ' + elapsed + '분 전';
        }).join('\n');
        lines.push('▸ ' + base + ' (' + grade + ' / ' + score + '점)\n' + types);
      });
      diagShowResult(header + diagEsc(lines.join('\n\n')));
    } catch(e) {
      diagShowResult('<span style="color:#f87171">❌ 파싱 실패</span>\n' + diagEsc(e.message) + '\n\nRaw:\n' + diagEsc(raw.substring(0, 500)));
    }
  }

  // 진단 3: Workers KV 저장 테스트 (POST /api/snapshots)
  function diagKVSave() {
    var base = '', tok = '';
    try {
      base = localStorage.getItem('snapshot_api_base') || '';
      tok  = localStorage.getItem('scanner_token') || '';
    } catch(e) {}
    if (!base) {
      diagShowResult('<span style="color:#f87171">❌ SCANNER API BASE 미설정</span>');
      return;
    }
    diagShowResult('⏳ 저장 요청 중...');
    var testSnap = {
      snapshotId: 'DIAG_' + Date.now() + '_TEST',
      timestamp: new Date().toISOString(),
      base: 'DIAG',
      gradeCode: 'A',
      total: 3.5,
      exchange: 'BITHUMB',
      alertType: 'ENTRY',
      source: 'html_manual_test',
      price: 100,
      rsi: 55
    };
    var headers = { 'Content-Type': 'application/json' };
    if (tok) headers['X-Scanner-Token'] = tok;
    fetch(base + '/api/snapshots', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(testSnap)
    })
    .then(function(r) { return r.text().then(function(t){ return {status:r.status, body:t}; }); })
    .then(function(res) {
      var header;
      if (res.status === 200 || res.status === 201) {
        header = '<span style="color:#4ade80">✅ 저장 성공 (HTTP ' + res.status + ')</span>\n/snapshots 조회 시 DIAG 키로 확인 가능';
      } else if (res.status === 401) {
        header = '<span style="color:#f87171">❌ 인증 실패 (401)</span>\nSCANNER_TOKEN 불일치 — Cloudflare 변수와 HTML 입력값 확인';
      } else if (res.status === 404) {
        header = '<span style="color:#f87171">❌ 경로 없음 (404)</span>\nWorkers 에 /api/snapshots 엔드포인트 배포 안 됨 — index.js 재배포 필요';
      } else {
        header = '<span style="color:#f87171">❌ 실패 (HTTP ' + res.status + ')</span>';
      }
      diagShowResult(header + '\n\n' + diagEsc(res.body.substring(0, 500)));
    })
    .catch(function(e) {
      diagShowResult('<span style="color:#f87171">❌ 네트워크 에러</span>\n' + diagEsc(e.message) + '\n\nURL: ' + diagEsc(base + '/api/snapshots'));
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // [MODULE: phase2_ops_functions] — Phase 2.1 운영 버튼
  // 향후 ui/phase2_ops.js 로 분리 예정.
  // 목적: 주소창 Bookmarklet 우회 (삼성 인터넷 javascript: 제한 대응)
  // ═══════════════════════════════════════════════════════════════

  function opsGetBase() {
    var base = '';
    try { base = localStorage.getItem('snapshot_api_base') || ''; } catch(e){}
    return base;
  }

  function opsFormatJSON(obj) {
    try { return diagEsc(JSON.stringify(obj, null, 2)); }
    catch(e){ return diagEsc(String(obj)); }
  }

  // 레거시 53건 pending 큐로 마이그레이션
  async function opsMigrate() {
    var base = opsGetBase();
    if (!base) {
      diagShowResult('<span style="color:#f87171">❌ SCANNER API BASE 미설정</span>');
      return;
    }
    if (!confirm('기존 snap 들을 pending 큐로 이동합니다.\n(이미 outcome 있는 것은 건너뜀)\n\n계속?')) return;
    diagShowResult('⏳ 마이그레이션 실행 중...');
    try {
      var res = await fetch(base + '/outcome/migrate-legacy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: 100 })
      });
      var status = res.status;
      var data = await res.json().catch(function(){ return { error: 'invalid json' }; });
      var hdr;
      if (data.ok) {
        hdr = '<span style="color:#c084fc">✅ 마이그레이션 완료 (HTTP ' + status + ')</span>\n'
            + 'migrated: ' + data.migrated + '건 / skipped: ' + data.skipped + '건 / errors: ' + data.errors + '건\n'
            + 'pending 큐 크기: ' + data.newPendingSize;
      } else if (status === 404) {
        hdr = '<span style="color:#f87171">❌ 엔드포인트 없음 (HTTP 404)</span>\n'
            + 'Workers 가 /outcome/migrate-legacy 포함된 최신 버전 아님.\nindex.js 재배포 필요.';
      } else {
        hdr = '<span style="color:#f87171">❌ 실패 (HTTP ' + status + ')</span>';
      }
      diagShowResult(hdr + '\n\n' + opsFormatJSON(data));
    } catch(e) {
      diagShowResult('<span style="color:#f87171">❌ 네트워크 에러</span>\n' + diagEsc(e.message));
    }
  }

  // 수동 배치 검증 (10건 처리)
  async function opsVerifyBatch() {
    var base = opsGetBase();
    if (!base) {
      diagShowResult('<span style="color:#f87171">❌ SCANNER API BASE 미설정</span>');
      return;
    }
    diagShowResult('⏳ 배치 검증 중 (최대 10건)...');
    try {
      var res = await fetch(base + '/outcome/verify-pending', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: 10 })
      });
      var status = res.status;
      var data = await res.json().catch(function(){ return { error: 'invalid json' }; });
      var hdr;
      if (data.ok) {
        // resultType 분포 집계
        var counts = { SUCCESS:0, WATCH:0, FLAT:0, FAIL:0, ORPHANED:0 };
        (data.results || []).forEach(function(r){
          if (counts[r.resultType] !== undefined) counts[r.resultType]++;
        });
        hdr = '<span style="color:#fb923c">✅ 배치 검증 완료</span>\n'
            + 'processed: ' + data.processed + '건 / remaining: ' + data.remaining + '건\n'
            + 'SUCCESS: ' + counts.SUCCESS + ' / WATCH: ' + counts.WATCH
            + ' / FLAT: ' + counts.FLAT + ' / FAIL: ' + counts.FAIL
            + ' / ORPHANED: ' + counts.ORPHANED;
      } else {
        hdr = '<span style="color:#f87171">❌ 실패 (HTTP ' + status + ')</span>';
      }
      diagShowResult(hdr + '\n\n' + opsFormatJSON(data));
    } catch(e) {
      diagShowResult('<span style="color:#f87171">❌ 네트워크 에러</span>\n' + diagEsc(e.message));
    }
  }

  // pending 큐 상태 조회
  async function opsPendingStatus() {
    var base = opsGetBase();
    if (!base) {
      diagShowResult('<span style="color:#f87171">❌ SCANNER API BASE 미설정</span>');
      return;
    }
    diagShowResult('⏳ 큐 상태 조회 중...');
    try {
      var res = await fetch(base + '/outcome/pending');
      var status = res.status;
      var data = await res.json().catch(function(){ return { error: 'invalid json' }; });
      var hdr = '<span style="color:#60a5fa">📋 Pending 큐 현황</span>\n'
        + 'total: ' + (data.total != null ? data.total : '?')
        + ' / dueForVerify: ' + (data.dueForVerify != null ? data.dueForVerify : '?')
        + ' / cap: ' + (data.cap != null ? data.cap : '?') + '\n'
        + 'batchLimit: ' + data.batchLimit + '건/Cron · 창: ' + data.windowHours + 'h · ORPHAN: ' + data.orphanThresholdDays + '일';
      diagShowResult(hdr + '\n\n' + opsFormatJSON(data));
    } catch(e) {
      diagShowResult('<span style="color:#f87171">❌ 네트워크 에러</span>\n' + diagEsc(e.message));
    }
  }

  // 대시보드 데이터 조회 (캐시 우회)
  async function opsDashboard() {
    var base = opsGetBase();
    if (!base) {
      diagShowResult('<span style="color:#f87171">❌ SCANNER API BASE 미설정</span>');
      return;
    }
    diagShowResult('⏳ 대시보드 데이터 조회 중...');
    try {
      var res = await fetch(base + '/outcome/dashboard?nocache=1');
      var status = res.status;
      var data = await res.json().catch(function(){ return { error: 'invalid json' }; });
      var hdr;
      if (data.alertStats) {
        var a = data.alertStats;
        var c = data.coinStats || {};
        hdr = '<span style="color:#a3e635">📊 대시보드 요약</span>\n\n'
            + '[알람 단위]\n'
            + '  total: ' + a.total + ' (pending: ' + (a.pending||0) + ')\n'
            + '  SUCCESS: ' + a.success + ' / WATCH: ' + a.watch
            + ' / FLAT: ' + a.flat + ' / FAIL: ' + a.fail + ' / ORPHAN: ' + (a.orphaned||0) + '\n'
            + '  도달률: ' + a.successRate + '% · Watch+: ' + a.watchOrBetter + '%\n'
            + '  평균 MaxRise: ' + (a.avgMaxRise||0) + '% · MaxDraw: ' + (a.avgMaxDrawdown||0) + '%\n\n'
            + '[코인 단위]\n'
            + '  total: ' + (c.total||0)
            + ' / SUCCESS: ' + (c.success||0) + ' / FAIL: ' + (c.fail||0) + '\n'
            + '  도달률: ' + (c.successRate||0) + '%\n\n'
            + 'coinEvolution: ' + ((data.coinEvolution||[]).length) + '개 코인 추적 중';
      } else {
        hdr = '<span style="color:#f87171">❌ 대시보드 응답 형식 이상</span>';
      }
      diagShowResult(hdr);
    } catch(e) {
      diagShowResult('<span style="color:#f87171">❌ 네트워크 에러</span>\n' + diagEsc(e.message));
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // [END MODULE: phase2_ops_functions]
  // [END MODULE: diagnostic_functions]
  // ═══════════════════════════════════════════════════════════════

  // ═══════════════════════════════════════════════════════════════
  // [MODULE: build_info]  — v3.6 빌드 버전 표시
  // 로드 시 Workers /health 조회 → buildTag 읽음 → 배지 업데이트
  // 탭 시 상세 팝업
  // ═══════════════════════════════════════════════════════════════
  var _cachedBuildInfo = null;

  async function fetchBuildInfo() {
    var base = '';
    try { base = localStorage.getItem('snapshot_api_base') || ''; } catch(e){}
    if (!base) return null;
    try {
      var res = await fetch(base + '/health', { cache: 'no-store' });
      if (!res.ok) return null;
      var data = await res.json();
      return data;
    } catch(e) { return null; }
  }

  function updateBuildBadge(info) {
    var el = document.getElementById('buildBadge');
    if (!el) return;
    _cachedBuildInfo = info;
    /* [v5.1.5] 한글 요약 동반 표기 — HTML_VERSION_LABEL 추가 (코드 식별자 보존) */
    var verLabel = (typeof global.HTML_VERSION_LABEL !== 'undefined' && global.HTML_VERSION_LABEL) ? global.HTML_VERSION_LABEL : '';
    var htmlVer = (typeof global.HTML_VERSION !== 'undefined') ? global.HTML_VERSION : '';
    if (!info) {
      el.textContent = verLabel ? (htmlVer + ' · ' + verLabel) : htmlVer;
      el.classList.add('build-syncing');
      el.title = 'Workers 연결 확인 중... (탭해서 재시도)';
      return;
    }
    el.classList.remove('build-syncing', 'build-mismatch');
    var serverTag = info.buildTag || '?';
    // 축약: 'phase2.1-outcome-verify-test1-migrate' → 'v2.1 · migrate'
    var shortTag = shortenBuildTag(serverTag);
    el.textContent = verLabel
      ? (htmlVer + ' · ' + verLabel + ' · ' + shortTag)
      : (htmlVer + ' · ' + shortTag);
    el.title = '탭해서 상세 보기';
  }

  function shortenBuildTag(tag) {
    if (!tag) return '?';
    // phase 숫자 추출
    var m = tag.match(/phase(\d+(?:\.\d+)?)/);
    var phase = m ? 'p' + m[1] : 'dev';
    // 뒤쪽 suffix 추출 (outcome-verify, migrate 등 마지막 키워드)
    var parts = tag.split('-');
    var lastKeyword = '';
    for (var i = parts.length - 1; i >= 0; i--) {
      var p = parts[i];
      if (p && !/^\d/.test(p) && p !== 'test1' && p !== 'verify' &&
          !p.startsWith('b') && !p.startsWith('phase')) {
        lastKeyword = p;
        break;
      }
    }
    return lastKeyword ? phase + '·' + lastKeyword : phase;
  }

  function showBuildInfo() {
    var info = _cachedBuildInfo;
    if (!info) {
      // 재시도
      fetchBuildInfo().then(updateBuildBadge).then(function(){
        if (_cachedBuildInfo) showBuildInfo();
        else alert('Workers 연결 실패.\nSCANNER API BASE 설정을 확인하세요.');
      });
      return;
    }
    var htmlVer = (typeof global.HTML_VERSION !== 'undefined') ? global.HTML_VERSION : '';
    var lines = [
      '🏷 빌드 정보',
      '',
      'HTML (스캐너): ' + htmlVer,
      'Workers:       ' + (info.buildTag || '?'),
      'Version:       ' + (info.version || '?'),
      'Release:       ' + (info.release || '?'),
      '',
      'Sleep Mode:    ' + (info.sleepMode ? 'ON 🌙' : 'OFF ☀'),
      '',
      '📦 Features:'
    ];
    if (info.features) {
      Object.keys(info.features).forEach(function(k){
        var v = info.features[k];
        lines.push('  ' + k + ': ' + (typeof v === 'boolean' ? (v ? '✓' : '✗') : v));
      });
    }
    alert(lines.join('\n'));
  }

  // 페이지 로드 + localStorage 변경 시 자동 업데이트
  (function initBuildInfo(){
    function run() {
      fetchBuildInfo().then(updateBuildBadge);
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', run);
    } else {
      setTimeout(run, 500);  // API BASE 세팅 후
    }
    // 5분마다 자동 재조회 (Workers 재배포 감지)
    setInterval(run, 5 * 60 * 1000);
  })();

  // ═══════════════════════════════════════════════════════════════
  // [MODULE: phase22_tabs_js]  — Phase 2.2 탭 전환 로직
  // 탭 3개: scanner / snapshot / outcome
  // 처음엔 scanner 활성화. outcome 탭 첫 진입 시 자동 데이터 로드.
  // ═══════════════════════════════════════════════════════════════
  var _activeTab = 'scanner';
  var _outcomeLoaded = false;

  function switchTab(tabName) {
    if (tabName === _activeTab) return;
    // 탭 버튼 active 전환
    var tabs = document.querySelectorAll('.woos-tab');
    tabs.forEach(function(b){
      if (b.getAttribute('data-tab') === tabName) b.classList.add('active');
      else b.classList.remove('active');
    });
    // 패널 표시 전환
    var panels = document.querySelectorAll('.woos-tab-panel');
    panels.forEach(function(p){
      if (p.id === 'tab-' + tabName) p.classList.add('active');
      else p.classList.remove('active');
    });
    _activeTab = tabName;

    // 탭별 초기 렌더링
    if (tabName === 'outcome' && !_outcomeLoaded) {
      _outcomeLoaded = true;
      refreshOutcomeDashboard(false);
    }
    if (tabName === 'snapshot') {
      // 스냅샷 리스트를 탭 내부 컨테이너로 렌더
      try { global.renderSnapshotPanel('', 'tab'); } catch(e){}
    }
  }

  // 페이지 로드 시 URL hash 가 #outcome 이면 자동 전환
  (function initTabFromHash(){
    function run(){
      try {
        var hash = (window.location.hash || '').replace('#','');
        if (hash === 'outcome' || hash === 'snapshot' || hash === 'scanner') {
          switchTab(hash);
        }
      } catch(e){}
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
    else setTimeout(run, 50);
  })();

  // ═══════════════════════════════════════════════════════════════
  // [MODULE: phase22_outcome_dashboard_js]  — Phase 2.2 Outcome 대시보드
  // ═══════════════════════════════════════════════════════════════
  var _outcomeData = null;
  var _outcomeUnit = 'alert';  // 'alert' or 'coin'

  function _outcomeEsc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  function _outcomeGetBase() {
    try { return (localStorage.getItem('snapshot_api_base') || '').replace(/\/$/, ''); }
    catch(e){ return ''; }
  }

  async function refreshOutcomeDashboard(forceNoCache) {
    var container = document.getElementById('outcomeContent');
    var meta = document.getElementById('outcomeMetaText');
    if (!container) return;

    var base = _outcomeGetBase();
    if (!base) {
      container.innerHTML = '<div class="outcome-error">❌ SCANNER API BASE 미설정<br>ADVANCED SETTINGS 에서 Workers URL 을 입력하세요</div>';
      return;
    }

    container.innerHTML = '<div class="outcome-loading">⏳ 대시보드 로드 중...</div>';
    if (meta) meta.textContent = '조회 중...';

    try {
      var url = base + '/outcome/dashboard' + (forceNoCache ? '?nocache=1' : '');
      var res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      var data = await res.json();
      _outcomeData = data;

      // 메타 표시
      var gen = data.generatedAt ? new Date(data.generatedAt) : new Date();
      var cached = data.cached ? ' · 캐시' : ' · FRESH';
      if (meta) meta.textContent = '생성: ' + gen.toLocaleTimeString('ko-KR') + cached;

      renderOutcomeDashboard(data);
      updateOutcomeTabBadge(data);
    } catch(e) {
      container.innerHTML = '<div class="outcome-error">❌ 대시보드 로드 실패<br>' + _outcomeEsc(e.message) + '</div>';
      if (meta) meta.textContent = '오류';
    }
  }

  function updateOutcomeTabBadge(data) {
    var badge = document.getElementById('outcomeTabBadge');
    if (!badge) return;
    var total = (data.alertStats && data.alertStats.total) || 0;
    if (total > 0) {
      badge.textContent = total;
      badge.style.display = 'inline-block';
    } else {
      badge.style.display = 'none';
    }
  }

  function renderOutcomeDashboard(data) {
    var container = document.getElementById('outcomeContent');
    if (!container) return;

    var html = '';

    // 단위 토글
    html += '<div class="outcome-unit-toggle">'
      + '<button class="outcome-unit-btn ' + (_outcomeUnit === 'alert' ? 'active' : '') + '" onclick="setOutcomeUnit(\'alert\')">알람 단위 (' + ((data.alertStats && data.alertStats.total) || 0) + ')</button>'
      + '<button class="outcome-unit-btn ' + (_outcomeUnit === 'coin' ? 'active' : '') + '" onclick="setOutcomeUnit(\'coin\')">코인 단위 (' + ((data.coinStats && data.coinStats.total) || 0) + ')</button>'
      + '</div>';

    var stats = _outcomeUnit === 'coin' ? (data.coinStats || {}) : (data.alertStats || {});

    // 1) 요약 KPI
    html += '<div class="outcome-kpi-grid">'
      + _kpiCard('Total', stats.total || 0, '')
      + _kpiCard('Success', stats.success || 0, 'success')
      + _kpiCard('Watch+', ((stats.success || 0) + (stats.watch || 0)), 'warn')
      + _kpiCard('도달률', (stats.successRate != null ? stats.successRate + '%' : '-'), 'rate')
      + '</div>';

    // 2) 결과 분포 막대
    html += _renderDistribution(stats);

    // 3) 거래소별 (알람 단위 기준 — 메인)
    if (data.byExchange && _outcomeUnit === 'alert') {
      html += _renderSectionBar('🏛 거래소별 성과 (BITHUMB + UPBIT 메인)',
        data.byExchange, ['BITHUMB', 'UPBIT']);
      // BINANCE 참고
      if (data.byExchangeRef && data.byExchangeRef.BINANCE && data.byExchangeRef.BINANCE.total > 0) {
        html += '<div class="outcome-section" style="opacity:.65">'
          + '<div class="outcome-section-title">📎 BINANCE (참고용 · 메인 KPI 제외)</div>'
          + _renderSectionRow('BINANCE', data.byExchangeRef.BINANCE)
          + '</div>';
      }
    }

    // 4) 등급별 (알람 단위 기준)
    if (data.byGrade && _outcomeUnit === 'alert') {
      html += _renderSectionBar('⭐ 등급별 성과', data.byGrade, ['SPLUS', 'S', 'A']);
    }

    // 5) 등급 진화 시각화
    if (data.coinEvolution && data.coinEvolution.length > 0) {
      html += '<div class="outcome-section">'
        + '<div class="outcome-section-title">📈 등급 진화 — 같은 코인의 시간축 변화</div>';
      // 최대 10개만 표시
      data.coinEvolution.slice(0, 10).forEach(function(evo){
        html += _renderGradeEvolution(evo);
      });
      if (data.coinEvolution.length > 10) {
        html += '<div style="text-align:center;font-size:.58rem;color:var(--text-muted);margin-top:6px">+' + (data.coinEvolution.length - 10) + '개 더 있음</div>';
      }
      html += '</div>';
    }

    // 6) 최근 outcome 카드
    if (data.recentOutcomes && data.recentOutcomes.length > 0) {
      html += '<div class="outcome-section">'
        + '<div class="outcome-section-title">🕐 최근 Outcome (최대 20건)</div>';
      data.recentOutcomes.slice(0, 20).forEach(function(r){
        html += _renderRecentCard(r);
      });
      html += '</div>';
    } else if ((stats.total || 0) === 0) {
      html += '<div class="outcome-empty">아직 검증된 outcome 이 없습니다.<br>마이그레이션 또는 배치검증 실행 후 확인하세요.</div>';
    }

    container.innerHTML = html;
  }

  function _kpiCard(label, value, cls) {
    return '<div class="outcome-kpi ' + (cls || '') + '">'
      + '<div class="outcome-kpi-label">' + _outcomeEsc(label) + '</div>'
      + '<div class="outcome-kpi-value">' + _outcomeEsc(value) + '</div>'
      + '</div>';
  }

  function _renderDistribution(stats) {
    var s = stats.success || 0, w = stats.watch || 0, f = stats.flat || 0, fa = stats.fail || 0;
    var total = s + w + f + fa;
    if (total === 0) {
      return '<div class="outcome-dist"><div class="outcome-dist-title">결과 분포</div>'
        + '<div style="text-align:center;color:var(--text-muted);padding:14px;font-size:.6rem">데이터 없음</div></div>';
    }
    function pct(v){ return ((v / total) * 100).toFixed(1); }
    var segs = [];
    if (s > 0)  segs.push('<div class="outcome-dist-seg success" style="flex:' + s  + '" title="SUCCESS ' + s  + '">' + (s  >= 2 ? s  : '') + '</div>');
    if (w > 0)  segs.push('<div class="outcome-dist-seg watch"   style="flex:' + w  + '" title="WATCH '   + w  + '">' + (w  >= 2 ? w  : '') + '</div>');
    if (f > 0)  segs.push('<div class="outcome-dist-seg flat"    style="flex:' + f  + '" title="FLAT '    + f  + '">' + (f  >= 2 ? f  : '') + '</div>');
    if (fa > 0) segs.push('<div class="outcome-dist-seg fail"    style="flex:' + fa + '" title="FAIL '    + fa + '">' + (fa >= 2 ? fa : '') + '</div>');
    return '<div class="outcome-dist">'
      + '<div class="outcome-dist-title">결과 분포 (총 ' + total + '건)</div>'
      + '<div class="outcome-dist-bar">' + segs.join('') + '</div>'
      + '<div class="outcome-dist-legend">'
      +   '<span>🟢 SUCCESS <b>' + s  + '</b> (' + pct(s)  + '%)</span>'
      +   '<span>🟡 WATCH <b>'   + w  + '</b> (' + pct(w)  + '%)</span>'
      +   '<span>⬜ FLAT <b>'    + f  + '</b> (' + pct(f)  + '%)</span>'
      +   '<span>🔴 FAIL <b>'    + fa + '</b> (' + pct(fa) + '%)</span>'
      + '</div>'
      + '</div>';
  }

  function _renderSectionBar(title, dataObj, keys) {
    var html = '<div class="outcome-section">'
      + '<div class="outcome-section-title">' + _outcomeEsc(title) + '</div>';
    keys.forEach(function(k){
      if (dataObj[k]) html += _renderSectionRow(k, dataObj[k]);
    });
    html += '</div>';
    return html;
  }

  function _renderSectionRow(label, row) {
    var s = row.success || 0, w = row.watch || 0, f = row.flat || 0, fa = row.fail || 0;
    var total = s + w + f + fa;
    var successRate = total > 0 ? ((s / total) * 100).toFixed(1) + '%' : '-';
    // [Phase 4.7 공사 4 — 2-5] SPLUS → S+ 출력 표시 변환
    var displayLabel = (label === 'SPLUS') ? 'S+' : label;
    var segs = '';
    if (total > 0) {
      if (s > 0)  segs += '<div style="flex:' + s  + ';background:#16a34a" title="SUCCESS ' + s + '"></div>';
      if (w > 0)  segs += '<div style="flex:' + w  + ';background:#ca8a04" title="WATCH ' + w + '"></div>';
      if (f > 0)  segs += '<div style="flex:' + f  + ';background:#475569" title="FLAT ' + f + '"></div>';
      if (fa > 0) segs += '<div style="flex:' + fa + ';background:#dc2626" title="FAIL ' + fa + '"></div>';
    } else {
      segs = '<div style="flex:1;background:rgba(0,0,0,.3)"></div>';
    }
    return '<div class="outcome-row">'
      + '<div class="outcome-row-label">' + _outcomeEsc(displayLabel) + '</div>'
      + '<div class="outcome-row-bar">' + segs + '</div>'
      + '<div class="outcome-row-stats">' + total + '건 · ' + successRate + '</div>'
      + '</div>';
  }

  function _renderGradeEvolution(evo) {
    var snaps = evo.snaps || [];
    if (snaps.length === 0) return '';

    // SVG 설정
    var W = 300, H = 56, padX = 30, padY = 10;
    var gradeY = { 'SPLUS': 0, 'S': 1, 'A': 2, 'B': 3 };
    var rowH = (H - padY*2) / 3;  // 4단계 → 3 갭
    var times = snaps.map(function(s){ return s.t; });
    var minT = Math.min.apply(null, times);
    var maxT = Math.max.apply(null, times);
    var rangeT = Math.max(maxT - minT, 1);

    function xFor(t) { return padX + ((t - minT) / rangeT) * (W - padX*2); }
    function yFor(g) {
      var idx = gradeY[g]; if (idx == null) idx = 3;
      return padY + idx * rowH;
    }
    function colorFor(rt) {
      if (rt === 'SUCCESS') return '#4ade80';
      if (rt === 'WATCH')   return '#fbbf24';
      if (rt === 'FLAT')    return '#94a3b8';
      if (rt === 'FAIL')    return '#f87171';
      if (rt === 'ORPHANED') return '#6b7280';
      return '#3a4a6a';
    }

    // 배경 그리드
    var grid = '';
    ['SPLUS', 'S', 'A', 'B'].forEach(function(g){
      var y = yFor(g);
      grid += '<line x1="' + padX + '" y1="' + y + '" x2="' + (W-padX) + '" y2="' + y + '" stroke="rgba(36,61,87,.4)" stroke-width="1" stroke-dasharray="2,3"/>';
      grid += '<text x="' + (padX-4) + '" y="' + (y+3) + '" font-family="monospace" font-size="7" fill="rgba(125,163,193,.6)" text-anchor="end">' + g + '</text>';
    });

    // 선 + 점
    var paths = '';
    if (snaps.length > 1) {
      var d = 'M ' + xFor(snaps[0].t) + ' ' + yFor(snaps[0].grade);
      for (var i=1; i<snaps.length; i++) {
        d += ' L ' + xFor(snaps[i].t) + ' ' + yFor(snaps[i].grade);
      }
      paths += '<path d="' + d + '" fill="none" stroke="rgba(125,211,252,.45)" stroke-width="1.3"/>';
    }
    var dots = '';
    snaps.forEach(function(s){
      var cx = xFor(s.t), cy = yFor(s.grade);
      var c = colorFor(s.resultType);
      dots += '<circle cx="' + cx + '" cy="' + cy + '" r="3.5" fill="' + c + '" stroke="#0c1420" stroke-width="1"><title>' + s.grade + ' @ ' + new Date(s.t).toLocaleString('ko-KR') + (s.resultType ? ' · ' + s.resultType + (s.maxRise!=null?' ('+s.maxRise+'%)':'') : '') + '</title></circle>';
    });

    // 결과 뱃지
    var peakOut = evo.peakOutcome;
    var resultBadge = '';
    if (peakOut && peakOut.resultType) {
      var cls = peakOut.resultType.toLowerCase();
      resultBadge = '<span class="grade-evo-result ' + cls + '">' + peakOut.resultType
        + (peakOut.maxRise != null ? ' ' + (peakOut.maxRise > 0 ? '+' : '') + peakOut.maxRise + '%' : '')
        + '</span>';
    }

    return '<div class="grade-evo-card">'
      + '<div class="grade-evo-header">'
      +   '<span class="grade-evo-coin">' + _outcomeEsc(evo.base) + ' <span style="color:var(--text-muted);font-weight:400">· ' + _outcomeEsc(evo.exchange || '') + '</span></span>'
      +   '<span class="grade-evo-peak">peak: ' + _outcomeEsc(evo.peakGrade || '?') + '</span>'
      +   resultBadge
      + '</div>'
      + '<svg class="grade-evo-svg" viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg">'
      +   grid + paths + dots
      + '</svg>'
      + '</div>';
  }

  function _renderRecentCard(r) {
    var rt = r.resultType || '';
    var rtCls = rt.toLowerCase();
    var rtColor = {
      'success': 'background:rgba(22,163,74,.18);color:#4ade80;border:1px solid rgba(22,163,74,.4)',
      'watch':   'background:rgba(202,138,4,.18);color:#fbbf24;border:1px solid rgba(202,138,4,.4)',
      'flat':    'background:rgba(71,85,105,.22);color:#94a3b8;border:1px solid rgba(71,85,105,.5)',
      'fail':    'background:rgba(220,38,38,.18);color:#f87171;border:1px solid rgba(220,38,38,.4)',
      'orphaned':'background:rgba(100,100,100,.14);color:#6b7280;border:1px solid rgba(100,100,100,.4)'
    }[rtCls] || '';

    var gradeColor = {
      'SPLUS': 'background:linear-gradient(135deg,#ff2d55,#ff6b35);color:#fff',
      'S':     'background:linear-gradient(135deg,#ff6b35,#f59e0b);color:#fff',
      'A':     'background:linear-gradient(135deg,#f59e0b,#fbbf24);color:#1a1a1a',
      'B':     'background:rgba(100,116,139,.3);color:#cbd5e1'
    }[r.grade] || 'background:rgba(50,50,60,.4);color:#94a3b8';

    var rise = r.maxRise != null ? (r.maxRise > 0 ? '+' : '') + r.maxRise.toFixed(1) + '%' : '-';
    var riseCls = (r.maxRise || 0) > 0 ? 'pos' : 'neg';
    var tStr = r.timestamp ? new Date(r.timestamp).toLocaleString('ko-KR',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}) : '';

    var tp1Info = '';
    if (r.strategyTp1Reached === true) tp1Info = ' · TP1 ✓';
    else if (r.strategyTp1Reached === false) tp1Info = ' · TP1 ✗';

    // [Phase 3.1.1] outcome 카드 클릭 시 해당 snapshot 모드로 진입
    // r.snapshotId 있으면 onclick 추가, 없으면 일반 카드
    var clickAttr = r.snapshotId
      ? ' onclick="_outcomeCardClick(\'' + _outcomeEsc(r.snapshotId).replace(/'/g, "\\'") + '\')" style="cursor:pointer"'
      : '';

    return '<div class="recent-outcome-card"' + clickAttr + '>'
      + '<div class="ro-grade" style="' + gradeColor + '">' + _outcomeEsc(r.grade || '?') + '</div>'
      + '<div class="ro-main">'
      +   '<div class="ro-coin">' + _outcomeEsc(r.base || '?') + ' <span style="color:var(--text-muted);font-size:.58rem;font-weight:400">· ' + _outcomeEsc(r.exchange || '') + '</span></div>'
      +   '<div class="ro-meta">' + tStr + tp1Info + '</div>'
      + '</div>'
      + '<div class="ro-right">'
      +   '<div class="ro-rise ' + riseCls + '">' + rise + '</div>'
      +   '<div class="ro-rt" style="' + rtColor + '">' + _outcomeEsc(rt) + '</div>'
      + '</div>'
      + '</div>';
  }

  // [Phase 3.1.1] outcome 카드 클릭 핸들러
  async function _outcomeCardClick(snapshotId) {
    if (!snapshotId) return;
    try {
      if (typeof global.openSnapshotById === 'function') {
        await global.openSnapshotById(snapshotId);
        // 스냅샷 모드 진입 후 스캐너 탭으로 이동
        if (typeof switchTab === 'function') switchTab('scanner');
      }
    } catch(e) {
      if (typeof global.addLog === 'function') global.addLog('[OUTCOME] snapshot 진입 실패: '+e.message, 'err');
    }
  }

  function setOutcomeUnit(unit) {
    if (_outcomeUnit === unit) return;
    _outcomeUnit = unit;
    if (_outcomeData) renderOutcomeDashboard(_outcomeData);
  }

  // ═══════════════════════════════════════════════════════════════
  // [MODULE: news_loader]  — v3.5 신규 (Task 3)
  // Workers GET /news/{base} 호출 → 뉴스 카드 렌더링.
  // S+/S/A 등급 전용. SCANNER API BASE 미설정 시 안내 메시지.
  // ═══════════════════════════════════════════════════════════════
  async function loadCoinNews(coin) {
    if (!coin || !coin.base) return;
    var rep = coin.representative || {};
    var grade = rep.gradeCode;
    var containerId = 'news-' + coin.base;
    var el = document.getElementById(containerId);
    if (!el) return;
    // S+/S/A 등급만 노출
    if (grade !== 'SPLUS' && grade !== 'S' && grade !== 'A') {
      el.innerHTML = '<div class="news-empty">뉴스 조회는 S+/S/A 등급 전용입니다.</div>';
      return;
    }
    var base = (typeof global.getSnapshotApiBase === 'function') ? global.getSnapshotApiBase() : '';
    if (!base) {
      el.innerHTML = '<div class="news-empty">SCANNER API BASE 미설정 — 뉴스 조회 불가</div>';
      return;
    }
    el.innerHTML = '<div class="news-loading"><div class="news-spinner"></div>뉴스 로딩 중...</div>';
    try {
      var res = await fetch(base + '/news/' + encodeURIComponent(coin.base) + '?limit=5');
      if (!res.ok) {
        el.innerHTML = '<div class="news-error">뉴스 로드 실패 (HTTP '+res.status+')</div>';
        return;
      }
      var data = await res.json();
      if (!data || !Array.isArray(data.items) || data.items.length === 0) {
        el.innerHTML = '<div class="news-empty">관련 뉴스가 없습니다.</div>';
        return;
      }
      var escapeHtml = global.escapeHtml || function(s){return String(s);};
      var html = data.items.map(function(n){
        var title = escapeHtml(n.title || '(제목 없음)');
        var link  = n.url ? String(n.url) : '#';
        var src   = n.source ? escapeHtml(n.source) : '';
        var pub   = n.pubDate ? escapeHtml(String(n.pubDate).replace(/\s*\+\d{4}\s*$/, '')) : '';
        return '<div class="news-article">'
          + '<div class="news-title"><a href="'+escapeHtml(link)+'" target="_blank" rel="noopener">'+title+'</a></div>'
          + '<div class="news-meta">'
          + (src ? '<span class="news-source">'+src+'</span>' : '')
          + (pub ? ' <span class="news-time">'+pub+'</span>' : '')
          + '</div></div>';
      }).join('');
      if (data.cached) {
        html += '<div class="news-meta" style="margin-top:6px;color:var(--text-muted);font-size:.62rem">※ 10분 캐시</div>';
      }
      el.innerHTML = html;
    } catch(e) {
      var escapeHtml2 = global.escapeHtml || function(s){return String(s);};
      el.innerHTML = '<div class="news-error">뉴스 네트워크 오류: '+escapeHtml2(e.message)+'</div>';
    }
  }

  /* ─── 모듈 노출 ─── */
  global.WOOSOps = {
    VERSION: 'v5.2.6.1',
    // DIAG
    diagShowResult: diagShowResult,
    diagClearResult: diagClearResult,
    diagEsc: diagEsc,
    diagTelegramDirect: diagTelegramDirect,
    diagAlertState: diagAlertState,
    diagKVSave: diagKVSave,
    // OPS
    opsGetBase: opsGetBase,
    opsFormatJSON: opsFormatJSON,
    opsMigrate: opsMigrate,
    opsVerifyBatch: opsVerifyBatch,
    opsPendingStatus: opsPendingStatus,
    opsDashboard: opsDashboard,
    // BUILD
    fetchBuildInfo: fetchBuildInfo,
    updateBuildBadge: updateBuildBadge,
    shortenBuildTag: shortenBuildTag,
    showBuildInfo: showBuildInfo,
    // TABS
    switchTab: switchTab,
    // OUTCOME
    _outcomeEsc: _outcomeEsc,
    _outcomeGetBase: _outcomeGetBase,
    refreshOutcomeDashboard: refreshOutcomeDashboard,
    updateOutcomeTabBadge: updateOutcomeTabBadge,
    renderOutcomeDashboard: renderOutcomeDashboard,
    _kpiCard: _kpiCard,
    _renderDistribution: _renderDistribution,
    _renderSectionBar: _renderSectionBar,
    _renderSectionRow: _renderSectionRow,
    _renderGradeEvolution: _renderGradeEvolution,
    _renderRecentCard: _renderRecentCard,
    _outcomeCardClick: _outcomeCardClick,
    setOutcomeUnit: setOutcomeUnit,
    // NEWS
    loadCoinNews: loadCoinNews
  };

  /* ─── window alias (본체 HTML onclick 미터치) ─── */
  global.diagShowResult = diagShowResult;
  global.diagClearResult = diagClearResult;
  global.diagEsc = diagEsc;
  global.diagTelegramDirect = diagTelegramDirect;
  global.diagAlertState = diagAlertState;
  global.diagKVSave = diagKVSave;
  global.opsGetBase = opsGetBase;
  global.opsFormatJSON = opsFormatJSON;
  global.opsMigrate = opsMigrate;
  global.opsVerifyBatch = opsVerifyBatch;
  global.opsPendingStatus = opsPendingStatus;
  global.opsDashboard = opsDashboard;
  global.fetchBuildInfo = fetchBuildInfo;
  global.updateBuildBadge = updateBuildBadge;
  global.shortenBuildTag = shortenBuildTag;
  global.showBuildInfo = showBuildInfo;
  global.switchTab = switchTab;
  global._outcomeEsc = _outcomeEsc;
  global._outcomeGetBase = _outcomeGetBase;
  global.refreshOutcomeDashboard = refreshOutcomeDashboard;
  global.updateOutcomeTabBadge = updateOutcomeTabBadge;
  global.renderOutcomeDashboard = renderOutcomeDashboard;
  global._kpiCard = _kpiCard;
  global._renderDistribution = _renderDistribution;
  global._renderSectionBar = _renderSectionBar;
  global._renderSectionRow = _renderSectionRow;
  global._renderGradeEvolution = _renderGradeEvolution;
  global._renderRecentCard = _renderRecentCard;
  global._outcomeCardClick = _outcomeCardClick;
  global.setOutcomeUnit = setOutcomeUnit;
  global.loadCoinNews = loadCoinNews;

  try {
    if (typeof console !== 'undefined' && console.log) {
      console.log('[WOOS Ops] loaded — VERSION =', global.WOOSOps.VERSION);
    }
  } catch (e) {}
})(typeof window !== 'undefined' ? window : globalThis);
