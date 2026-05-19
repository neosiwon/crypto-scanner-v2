# WS3 P0 복구 작업지시서 v0

**버전**: P0-r0.1
**작성일**: 2026-05-20
**입력 자료**: `docs/ws3/WS3_WHITEPAPER_TRACKING_MATRIX_v0.1.md` (commit `261ea8d`)
**작성자**: Claude Web (claude.ai sonnet)
**대상 검토자**: 사용자 → Claude Web 피드백 → 사용자 최종 승인

---

## 0. 작성 목적

추적표 v0.1 의 P0 6 항목 (Worker grade 정정 / Worker pipeline v3 module chain / proxy 복구 / card() header / card() body 18 sections / cardViewModel 사용) 을 **백서 v0.3.3 기반으로 정확히 복구**하는 작업지시서.

본 지시서 = **검토용 v0**. 사용자 검토 + Claude Web 피드백 + 사용자 최종 승인 후 v1 확정.

---

## 1. 핵심 원칙 (메모리 #27, #28 박제)

```text
1. 검증보다 제품 화면
2. 백서 슬롯 유지
3. 빗썸 메인
4. v2 UI 감각
5. raw/debug 미노출
6. 자가질문 6개 매 패치 시작 전 답
```

---

## 2. P0 6 항목 의존 관계

```text
P0-3 (proxy fetch 복구)
   ↓ (선행)
P0-2 (Worker pipeline → v3 chain)
   ↓ (입력 제공)
P0-1 (Worker grade 정정)
   ↓ (응답 shape 확정)
P0-6 (card() 입력 = Worker + cardVM + rendererBinding)
   ↓
P0-4 (card() header 8 슬롯)
P0-5 (card() body 18 섹션)
```

순서: P0-3 → P0-2 + P0-1 (동시) → P0-6 → P0-4 + P0-5 (동시).

---

## 3. 작업 1단계 — P0-3 proxy fetch 복구 (선행 작업)

### 3.1 문제

- Worker `/multi-candidate-dry-run` 호출 시 모든 결과 `CANDIDATE_DRY_RUN_NETWORK_ERROR`.
- 원인 = `buildLivePreflightUrl()` 가 만드는 URL 의 proxy 가 응답 안 함 (또는 빗썸 API 변경).

### 3.2 작업

1. `workers/ws3-telegram-canary-worker.js` 의 `buildLivePreflightUrl()` 함수 확인 — proxy URL 출처
2. proxy worker (`exchange-proxy-worker-v2`) 의 빗썸 endpoint 상태 확인 (별도 worker)
3. 빗썸 공식 API 직접 호출 vs proxy 경유 결정
4. 백서 §5.1 = "proxy 경유 OK 단 timeout 7000ms"
5. 빗썸 endpoint v0.2.0-a 박제: `/bithumb/candles?market=KRW-BTC&count=100`
   - 응답 shape: `{ candles: [{ time, open, close, high, low, volume }] }`
6. 빗썸 공식 API v2 (`https://api.bithumb.com/v1/candles/...`) 직접 호출 가능 여부 확인

### 3.3 위험 요인

- proxy worker 별도 repo 일 가능성 (본 repo 외부)
- 빗썸 API rate limit
- CORS

### 3.4 산출물

- Worker fetch endpoint 1개 동작 확인 (KRW-BTC h1 100 캔들 정상 응답)
- `docs/ws3/WS3_P0_3_PROXY_RECOVERY_REPORT.md` 박제

---

## 4. 작업 2단계 — P0-2 Worker pipeline → v3 module chain

### 4.1 목표

```text
[현재 — 잘못된 흐름]
fetchLiveCandles → normalizeCandles → calculateCandleStructureFeatures (자체) → 
calculateVolumeFeatures (자체) → calculateMomentumFeatures (자체) → 
calculateCandidateDryRunScore (자체) → classifyCandidateDryRunGrade (자체 P-S/P-A)

[복구 후 — 백서 흐름]
fetchLiveCandles → normalizeCandles → 
WS3_FeaturePayload_Builder.build()        ← v3-feature-payload-builder
→ WS3_ScoreBreakdown.build()              ← v3-score-breakdown
→ WS3_StructureBucket.build()             ← v3-structure-bucket
→ WS3_SignalCycle.build()                 ← v3-signal-cycle
→ WS3_StrategyPlan.build()                ← v3-strategy-plan
→ WS3_CardViewModel.build()               ← v3-card-view-model
→ WS3_OperationPacket.build()             ← v3-operation-packet
→ (optional) WS3_RendererBinding.build()  ← v3-renderer-binding
```

### 4.2 Worker module import 방법

Cloudflare Worker 의 module 시스템:

**옵션 A** : v3 모듈을 worker 디렉토리에 복사 + import 로 사용  
**옵션 B** : v3 모듈 그대로 두고 worker bundle 시점에 inline 추가  
**옵션 C** : v3 모듈을 module worker 형식으로 변환 (현재는 IIFE)

권장 = **옵션 A**: 작업 분량 최소 / 기존 v3 module 변경 없음.

```js
// worker.js 상단에 추가
import { WS3_FeaturePayload_Builder } from './v3/v3-feature-payload-builder.js';
// 또는 wrangler bundle 설정으로 v3/*.js 포함
```

### 4.3 runMultiCandidatePipeline() 재작성

기존 try 블록 (line 1058-1108) 교체:

```js
try {
  // 1. featurePayload build
  var normalized = normalizeCandles(exchange, fetchRes.raw, limit);
  var featurePayload = WS3_FeaturePayload_Builder.build({
    candles: { h1: normalized.candles },  // primary timeframe = h1
    marketCtx: {
      exchange: 'BITHUMB',
      market: market,
      ts: Date.now()  // DP-1 fallback
    }
  });
  
  if (!WS3_FeaturePayload.isValid(featurePayload)) {
    return { ok: false, market: market, code: 'V3_PAYLOAD_INVALID' };
  }
  
  // 2. scoreBreakdown
  var scoreBreakdown = WS3_ScoreBreakdown.build(featurePayload);
  
  // 3. structureDecision
  var structureDecision = WS3_StructureBucket.build(featurePayload, scoreBreakdown);
  
  // 4. signalCycle (previousSignalState = null for now, P2 에서 KV 연결)
  var signalCycle = WS3_SignalCycle.build(featurePayload, scoreBreakdown, structureDecision, null);
  
  // 5. strategyPlan
  var strategyPlan = WS3_StrategyPlan.build(featurePayload, scoreBreakdown, structureDecision, signalCycle);
  
  // 6. cardViewModel
  var cardViewModel = WS3_CardViewModel.build(featurePayload, scoreBreakdown, structureDecision, signalCycle, strategyPlan);
  
  return {
    ok: true,
    market: market,
    score: scoreBreakdown.totalScore,
    grade: classifyGrade(scoreBreakdown.totalScore),  // P0-1 해결
    cardViewModel: cardViewModel,
    // optional debug (raw/debug 노출 X)
    structureBucket: structureDecision.structureBucket,
    strategyBias: strategyPlan.strategyBias,
    signalCyclePhase: signalCycle.cyclePhase,
    latestTime: featurePayload.ts
  };
} catch (e) {
  return { ok: false, market: market, code: 'V3_PIPELINE_ERROR', error: e.message };
}
```

### 4.4 산출물

- Worker `runMultiCandidatePipeline()` 함수 v3 chain 사용
- 응답 shape 확정 (P0-6 의 입력)

---

## 5. 작업 3단계 — P0-1 Worker grade 정정

### 5.1 문제

Worker `classifyCandidateDryRunGrade()` 가 `'P-S'` / `'P-A'` 같은 P-prefix 출력 → 백서 §6.2 위반.

### 5.2 작업

새 함수 `classifyGrade(score)` 추가:

```js
function classifyGrade(score) {
  if (typeof score !== 'number') return 'NONE';
  if (score >= 90) return 'S+';
  if (score >= 82) return 'S';
  if (score >= 72) return 'A';
  if (score >= 60) return 'B';
  if (score >= 40) return 'C';
  return 'NONE';
}
```

`v3-config.js` WS3_GRADE_BANDS 와 정확히 일치 (maxExclusive 방식).

기존 `classifyCandidateDryRunGrade()` 는 backward compat 위해 유지하되 **Worker pipeline 에서 미사용** (deprecation).

### 5.3 산출물

- Worker grade 출력 = `'S+'` / `'S'` / `'A'` / `'B'` / `'C'` / `'NONE'`
- production card() 의 `grade(r.grade)` 함수 (이미 한글 매핑 OK) 그대로 사용 가능

---

## 6. 작업 4단계 — P0-6 card() 입력 확장

### 6.1 변경

production `index.html` 의 `card(r)` 함수 입력 = Worker 응답의 `results[i]`.

새 응답 shape (P0-2 완료 후):

```js
results[i] = {
  ok: true,
  rank,
  market,
  score,                  // 100점 점수
  grade,                  // 'S+' / 'S' / 'A' / 'B' / 'C' / 'NONE'
  structureBucket,        // 'BOX_PRESSURE' 등
  strategyBias,           // 'SCALP' 등
  signalCyclePhase,       // 'NEW_CANDIDATE' 등
  cardViewModel: {        // ← 핵심 신규
    identity, header, chips, metrics,
    sections: { overview, score, structure, cycle, strategy, risk, debug },
    displayFlags, tone, reasons, warnings
  },
  latestTime
}
```

### 6.2 card() 함수 시그니처 유지

기존:
```js
function card(r) {
  // r = results[i]
  ...
}
```

변경 없음. 단 r 의 새 필드 (cardViewModel) 활용.

---

## 7. 작업 5단계 — P0-4 card() header 8 슬롯

### 7.1 백서 §16.2 + §16.3 + v3-config 기준

```text
HEADER_SLOT_PRIORITY = [
  'grade',               // 1순위 - 항상 표시
  'strategyBias',        // 2순위 - 항상 표시
  'structure',           // 3순위 - 항상 표시
  'signalPersistence',   // 4순위
  'marketContext',       // 5순위 (또는 buyPressure)
  'buyPressure',         // 5순위 alt
  'riskMeta',            // 6순위
  'detectedTime'         // 7순위 - 항상 마지막
]

mobileMax = 5
alwaysShow = ['grade', 'strategyBias', 'structure']
```

### 7.2 card() header 재작성

```js
function buildHeader(r) {
  var cvm = r.cardViewModel || {};
  var header = cvm.header || {};
  
  var slots = [];
  
  // 1. 등급
  if (r.grade) {
    var g = WS3_DISPLAY.grade[r.grade] || r.grade;
    slots.push({ type: 'grade', label: g, tone: gradeTone(r.grade) });
  }
  
  // 2. strategyBias (백서 핵심)
  if (r.strategyBias) {
    var sb = WS3_DISPLAY.strategyBias[r.strategyBias] || r.strategyBias;
    slots.push({ type: 'strategy', label: sb, tone: 'cyan' });
  }
  
  // 3. structureBucket
  if (r.structureBucket) {
    var sBucket = WS3_DISPLAY.structure[r.structureBucket] || r.structureBucket;
    slots.push({ type: 'structure', label: sBucket, tone: 'orange' });
  }
  
  // 4. signalPersistence
  if (cvm.metrics && cvm.metrics.signalPersistence) {
    var sp = WS3_DISPLAY.signalPersistence[cvm.metrics.signalPersistence];
    if (sp) slots.push({ type: 'persistence', label: sp, tone: 'yellow' });
  }
  
  // 5. marketContext or buyPressure (둘 중 강한 것)
  // (마켓 강할 때 marketContext, 매수세 강할 때 buyPressure)
  
  // 6. riskMeta (위험·시총)
  
  // 7. 감지 시각
  if (r.latestTime) {
    slots.push({ type: 'time', label: tm(r.latestTime), tone: 'muted' });
  }
  
  // 모바일: 최대 5개. alwaysShow 3개 + 나머지 2개 자동 선택.
  var mobileSlots = slots.slice(0, 5);
  
  return mobileSlots.map(slot => 
    '<span class="chip ' + slot.tone + '">' + slot.label + '</span>'
  ).join('');
}
```

### 7.3 자가질문 답

```text
1. 펌핑 후보 찾는 데 도움? → ✅ (등급/strategyBias/structure 가 핵심)
2. 백서 슬롯 유지? → ✅ (HEADER_SLOT_PRIORITY 8개 정확)
3. 빗썸 메인? → ✅ (exchange chip 도 빗썸 정렬)
4. v2 UI 감각? → ✅ (chip variant 17종 유지)
5. raw/debug 미노출? → ✅ (모든 라벨이 한글 매핑)
6. 검증 과몰입 X? → ✅ (operator review chip 제거)
```

---

## 8. 작업 6단계 — P0-5 card() body 18 섹션

### 8.1 백서 §16.4 18 섹션 (필수 전체 표시 / 미구현 = "데이터 수집 중")

```js
function buildBody(r) {
  var cvm = r.cardViewModel || {};
  var sections = cvm.sections || {};
  
  var body = [];
  
  // 1. 핵심 요약 (✅ 데이터 있음)
  body.push(section('1. 핵심 요약', 
    formatOverview(sections.overview || {})
  ));
  
  // 2. 카드헤더 상세 해석 (✅ header 객체)
  body.push(section('2. 카드헤더 해석',
    formatHeaderDetail(cvm.header || {})
  ));
  
  // 3. 점수 요약 (✅ score section)
  body.push(section('3. 점수 요약',
    formatScore(sections.score || {})
  ));
  
  // 3.5. 선별 근거 (⚠️ reasons / warnings)
  body.push(section('3.5. 선별 근거',
    formatSelectionReason(cvm.reasons || [], cvm.warnings || [])
  ));
  
  // 4. 구조 판단 (✅ structure section)
  body.push(section('4. 구조 판단',
    formatStructure(sections.structure || {})
  ));
  
  // 5. 매수세 / 수급 판단 (❌ 데이터 미구현 = "데이터 수집 중")
  body.push(section('5. 매수세 / 수급', 
    '<p class="empty">매수세 분류기 후속 단계 (P1)</p>'
  ));
  
  // 6. 시장상황 / BTC (❌ marketContext 분류기 미구현)
  body.push(section('6. 시장상황 / BTC',
    '<p class="empty">marketContext 자동 분류 후속 단계 (P1)</p>'
  ));
  
  // 7. 전략 성향 (✅ strategy section)
  body.push(section('7. 전략 성향',
    formatStrategy(sections.strategy || {})
  ));
  
  // 8. 진입 가이드 (✅ strategy.entry)
  body.push(section('8. 진입 가이드',
    formatEntry((sections.strategy || {}).entry || {})
  ));
  
  // 9. 매도전략 A-F (✅ strategy.exit)
  body.push(section('9. 매도전략 A-F',
    formatExitAF((sections.strategy || {}).exit || {})
  ));
  
  // 10. 세력예상가 (❌ smartMoneyZone 미구현)
  body.push(section('10. 세력예상가',
    '<p class="empty">세력예상가 모듈 후속 단계 (P1)</p>'
  ));
  
  // 11. 반복신호 (✅ cycle section)
  body.push(section('11. 반복신호',
    formatCycle(sections.cycle || {})
  ));
  
  // 12. 지표 상세 (✅ debug 안에 indicators)
  body.push(section('12. 지표 상세',
    formatIndicators((sections.debug || {}).indicators || {})
  ));
  
  // 13. 코인 메타 (❌ coinMeta 미구현)
  body.push(section('13. 코인 메타',
    '<p class="empty">시총 / 섹터 어댑터 후속 단계 (P1)</p>'
  ));
  
  // 14. 뉴스 (❌ Phase 4+)
  body.push(section('14. 뉴스',
    '<p class="empty">뉴스 어댑터 Phase 4+ 후속 단계</p>'
  ));
  
  // 15. 시장 참고 (❌ Phase 4+)
  body.push(section('15. 시장 참고',
    '<p class="empty">시장 참고 Phase 4+ 후속 단계</p>'
  ));
  
  // 16. 외부 보조확인 (✅ rendererBinding.confluence)
  body.push(section('16. 외부 보조확인',
    formatConfluence((r.rendererBinding || {}).sections?.confluence || [])
  ));
  
  // 17. 사후평가 진행 (⚠️ evaluation seed only)
  body.push(section('17. 사후평가',
    '<p class="empty">사후평가 KV write 후속 단계 (P2)</p>'
  ));
  
  // 18. 고급 상세 / 원본 보기 (✅ debug)
  body.push(section('18. 고급 상세',
    '<p class="muted">개발자용 원시값은 기본 화면에 노출하지 않습니다.</p>'
  ));
  
  return body.join('');
}
```

### 8.2 helper 함수들

각 `format*()` 함수는 cardViewModel section 의 한글 라벨 + tone 사용:

```js
function formatStrategy(s) {
  if (!s.valid) return '<p class="empty">전략 계산 대기</p>';
  var html = '';
  html += '<p>전략 성향: <b>' + (s.biasLabelKo || '미확정') + '</b></p>';
  html += '<p>계획 타입: ' + (s.planTypeLabelKo || '-') + '</p>';
  html += '<p>실행 가능성: ' + (s.actionabilityLabelKo || '-') + '</p>';
  return html;
}

function formatExitAF(exit) {
  // 백서 §13.4 A-F 6 slot
  var strategies = ['A', 'B', 'C', 'D', 'E', 'F'];
  var html = '<div class="exit-grid">';
  strategies.forEach(s => {
    var key = 'EXIT_' + s;
    var label = WS3_DISPLAY.exitStrategy[key] || ('매도전략 ' + s);
    var enabled = exit[s] && exit[s].enabled;
    html += '<div class="exit-slot ' + (enabled ? 'enabled' : 'disabled') + '">';
    html += '<b>' + label + '</b>';
    html += enabled ? '<p>' + (exit[s].summary || '활성') + '</p>' : '<p class="empty">미활성</p>';
    html += '</div>';
  });
  html += '</div>';
  return html;
}
```

### 8.3 자가질문 답

```text
1. 펌핑 후보? → ✅ (18 섹션 모두 후보 판단 정보)
2. 백서 슬롯? → ✅ (§16.4 18 순서 정확)
3. 빗썸 메인? → ✅ (영향 없음)
4. v2 UI? → ✅ (sec class / chip 유지)
5. raw/debug 미노출? → ✅ (#18 만 "원시값 미노출" 안내 / 다른 섹션은 한글 라벨)
6. 검증 과몰입? → ✅ (operator review 슬롯 없음 / 카드 = 판단 정보)
```

---

## 9. 작업 분량 추정

| Phase | 작업 | 작업 분량 | 위험도 |
|---|---|---|---|
| P0-3 | proxy fetch 복구 | 1 worker 수정 (소) + 별도 worker 가능성 | 3 (외부 의존) |
| P0-2 | Worker pipeline → v3 chain | 1 함수 재작성 (중) + Cloudflare bundle 설정 | 4 (가장 큼) |
| P0-1 | Worker grade 정정 | 1 함수 추가 (소) | 1 |
| P0-6 | card() 입력 확장 | 자동 (P0-2 가 응답 shape 변경) | 1 |
| P0-4 | card() header 8 슬롯 | 1 함수 재작성 (중) | 2 |
| P0-5 | card() body 18 섹션 | 1 함수 재작성 + 8 helper (대) | 3 |

총 예상 = **2~3일 작업** (full-time / Claude Code 풀가동 기준).

빠른개발모드 (메모리 #22) 적용 시 = **1.5일** (위험도 3 이상 P0-3/P0-2/P0-5 만 평소 모드 유지 / 나머지 빠른 모드).

---

## 10. 검토 사항 (사용자 1~2 확정 필요)

### Q1 — Worker import 방법 결정

```text
A. v3 모듈을 workers/v3/ 디렉토리로 복사 (작업 분량 최소)
B. wrangler.toml bundle 설정 + 원본 v3/ 디렉토리 사용
C. v3 모듈을 module worker 형식 (export) 으로 변환 (전면 수정)
```

권장 = **A** (v3 module 변경 0건 / Worker 만 추가).

### Q2 — 옵션 결정

```text
A. P0 6 항목 한 번에 묶어서 작업 (큰 PR 1개)
B. P0-3 → P0-2+P0-1 → P0-6+P0-4+P0-5 3단계 분할 (PR 3개)
C. P0-1 만 먼저 (가장 작음 / risk 최소) → 검증 후 나머지
```

권장 = **B** (의존 관계 분명 / 각 단계 검증 가능).

### Q3 — proxy worker 책임

```text
A. 본 repo 내에서 exchange-proxy-worker-v2 도 함께 수정
B. 별도 worker repo / Claude Web 권한 외 → 사용자가 별도 처리
C. proxy 우회 — 빗썸 공식 API 직접 호출 (CORS / rate limit 확인 필요)
```

권장 = **B** 또는 **C** (별도 worker 가 본 repo 외부일 가능성 高).

---

## 11. 본 지시서 결론

```text
P0 6 항목 = 백서 §16 + §4 + §6 + §3 정합 복구
= Worker pipeline 을 v3 module chain 으로 연결
= production card() 를 cardViewModel + rendererBinding 으로 연결

다음 단계:
1. 사용자 검토 (본 지시서)
2. Q1 / Q2 / Q3 명시
3. Claude Web 피드백 (백서 정합 / v2 UI / 6 자가질문)
4. 사용자 최종 승인 ("진행")
5. P0-3 부터 순차 실행
```

---

**본 지시서 작성 종료**: 2026-05-20
**다음 단계**: 사용자 검토 → Q1/Q2/Q3 명시 → 피드백 → 승인 → 실행
