# WS3 v0.11.0 — Adapter Input Contract Pack 완료 보고

**작성일**: 2026-05-16
**branch**: `claude/heuristic-cori-7865e7`
**이전 functional baseline**: WS3 v0.10.0 evaluationOutcome (`887123a`)
**본 단계 산출**: `v3/v3-evaluation-observation-adapter.js` + `v3/v3-external-confluence.js` (2종 신규)

---

## 1. 단계 개요

- **입력 layer 2종 신규**:
  - **EvaluationObservationAdapter** (`WS3_EvaluationObservationAdapter`): 외부 관측 요약값 → v0.10.0 evaluationObservation 호환 객체
  - **ExternalConfluence** (`WS3_ExternalConfluence`): 외부 보조 신호 → standalone externalConfluence (post-evaluation 보조 context layer)
- **모듈 버전**:
  - `ADAPTER_VERSION = 'WS3_v0.11.0_observation_adapter'` (adapter 자체)
  - `OUTPUT_VERSION = 'external-observation-v0'` (v0.10.0 호환용 출력)
  - `CONFLUENCE_VERSION = 'WS3_v0.11.0_confluence'` (externalConfluence 출력)
- **export 패턴**: `global.WS3_EvaluationObservationAdapter` / `global.WS3_ExternalConfluence` + `module.exports` (이중 환경)
- **출력 layer 2종은 v0.12.0 으로 분리**: TransportPlan / RendererBinding 미생성 확인 ✅

---

## 2. EvaluationObservationAdapter 출력 구조 (v0.10.0 호환)

```text
evaluationObservation = {
  valid, version: 'external-observation-v0',
  candidateKey, window, startTs, endTs,
  baselinePrice, currentPrice, highPrice, lowPrice, closePrice,
  highTs, lowTs, closeTs,
  observedBars, complete,
  source: 'adapter-normalized',           // U-ACP-1 Option A
  reasons: ['ADAPTER_NORMALIZED', ...],   // U-ACP-1 reasons[]
  warnings: [...]
}
```

field mapping (외부 입력 → v0.10.0 호환):
- `windowLabel → window`
- `startMs / endMs → startTs / endTs`
- `pricePoints.{baseline,current,high,low,close} → baselinePrice/currentPrice/highPrice/lowPrice/closePrice` (isNumericPrice 통과만)
- `priceTimestamps.{highMs,lowMs,closeMs} → highTs/lowTs/closeTs` (isNumericTs 통과만)
- `barsObserved → observedBars` (isNonNegativeInteger 만)
- `isComplete → complete`

## 3. ExternalConfluence 출력 구조

```text
externalConfluence = {
  valid, version: 'WS3_v0.11.0_confluence',
  market: { btcMarketState, altMarketState, marketRisk },
  sector: { sectorState, sectorStrength },
  exchange: { exchangeContext, liquidityContext },
  schedule: { hasKnownEvent, eventType, eventRisk },
  news: { hasNews, newsTone },
  confluenceScore: null,                  // U-ACP-2 — 기본 null. enableScore=true 시 numeric
  confluenceLabel: 'UNKNOWN',             // 기본 UNKNOWN
  reasons: ['MARKET_*', 'SECTOR_*', 'EXCHANGE_*', 'CONFLUENCE_LABEL_*', 'SCORE_DISABLED'?],
  warnings: [...],
  debug: { source, configVersion },
  configUsed: { confluence, labels, allowedMarketStates, ... }
}
```

라벨 후보:
- **MARKET_STATE**: UNKNOWN / BULL / BEAR / SIDEWAYS / NEUTRAL / RISK_OFF
- **SECTOR_STATE**: UNKNOWN / STRONG / NEUTRAL / WEAK
- **EXCHANGE_STATE**: UNKNOWN / NORMAL / THIN_LIQUIDITY / HIGH_LIQUIDITY / HALTED / DEGRADED
- **SCHEDULE_RISK**: UNKNOWN / LOW / MEDIUM / HIGH / CRITICAL
- **NEWS_TONE**: UNKNOWN / POSITIVE / NEUTRAL / NEGATIVE / MIXED
- **CONFLUENCE_LABEL**: UNKNOWN / FAVORABLE / NEUTRAL / ADVERSE / MIXED

## 4. DP-ACP / U-ACP / N-ACP-OBS 적용 (모두 적용 / 미해결 0건)

| ID | 정책 | 구현 |
|---|---|---|
| **DP-ACP1** Contract Pack 범위 — 입력 adapter 만 | ✅ 2종 입력 layer 신규. fetch/transport/renderer 구현 0건 |
| **DP-ACP2** 2단계 분리 (v0.11.0 입력 / v0.12.0 출력) | ✅ TransportPlan / RendererBinding / AdapterContractPack 미생성 (정책 comment 외 코드 침범 0건) |
| **DP-ACP3** side-effect 금지 | ✅ network / persistence / DOM / storage / clock literal 코드 침범 0건 (JSDoc 정책 comment 만 매치) |
| **DP-ACP4** v0.10.0 호환 (version='external-observation-v0' / source='adapter-normalized' / reasons['ADAPTER_NORMALIZED']) | ✅ `OUTPUT_VERSION / OUTPUT_SOURCE` 상수. S1/S11 smoke 검증 (S11 에서 v0.10.0 buildEvaluationOutcome 이 adapter 출력을 정상 처리) |
| **DP-ACP5** ExternalConfluence 보조 context | ✅ scoreBreakdown / strategyPlan / planQualityTier / totalScore 필드 부재. S7 smoke 검증 |
| **DP-ACP6** raw candles / raw response 금지 | ✅ `normalizeEvaluationObservationInput()` 가 `candles / rawCandles / candleArrays / raw / rawResponse / apiResponse` 감지 후 `RAW_INPUT_STRIPPED` 워닝 추가. S4 smoke 에서 raw 노출 0건 검증 |
| **DP-ACP7** Config-driven | ✅ DEFAULT_EVALUATION_OBSERVATION_ADAPTER_CONFIG / DEFAULT_EXTERNAL_CONFLUENCE_CONFIG. allowedWindows / allowedMarketStates / 등 config 조정 가능 |
| **DP-ACP8** 입력 mutation 금지 | ✅ S10 smoke 에서 2종 adapter 모두 입력 JSON before/after 동일 검증. Extra-A 에서 deepFreeze 입력에 대해 throw 0 |
| **DP-ACP9** 보호 파일 수정 금지 | ✅ 보호 19종 diff 0건 (v3 *.js 14종 + index/manifest/sw 3종 + CODE_CONTRACT + WORKFLOW_TEMPLATE) |
| **DP-ACP10** output adapter 분리 (TransportPlan / RendererBinding → v0.12.0) | ✅ 본 단계 미생성. 정책 comment 외 식별자 0건 |
| **U-ACP-1 Option A** — hint.unit 부재 시 default 'adapter-normalized' source | ✅ `OUTPUT_SOURCE = 'adapter-normalized'`. reasons[] 에 `ADAPTER_NORMALIZED` 항상 추가. caller 가 sourceTag 제공 시 reasons 에 `SOURCE_TAG:<tag>` 별도 기록 (output source 는 항상 cfg.outputSource) |
| **U-ACP-2** — confluenceScore number\|null, 기본 null, -100~100 범위 | ✅ `cfg.confluence.enableScore` 기본 `false` → S8 smoke 검증. `enableScore=true` 시 contribution 합산 + min/max clamp. 정량화 불충분 (contributions=0) 시 null 유지. S9 smoke 에서 favorable 70 (BULL+BULL+STRONG+HIGH_LIQ+POSITIVE=25+15+15+5+10=70) 및 adverse clamp 검증 |
| **N-ACP-OBS-1** payload.newsContext 와 input.newsContext 다른 layer | ✅ `normalizeNewsContext(input, cfg)` 가 `input.newsContext` 만 read. payload 미read |
| **N-ACP-OBS-2** v0.2.0-a baseline 보호 파일 책임 분리 | ✅ 본 2종 모듈 코드 침범 0건 |

## 5. smoke test 결과 (15 시나리오 모두 통과)

| # | 시나리오 | 핵심 검증 |
|---|---|---|
| S1 | evaluationObservation normalize | version=external-observation-v0 / source=adapter-normalized / reasons[ADAPTER_NORMALIZED] / 모든 field mapping / mutation=0 |
| S2 | evaluationObservation invalid price | 'abc' / 0 / -5 → null. INVALID_PRICE_FIELD 워닝 |
| S3 | evaluationObservation window normalize | 24H/7D/CUSTOM 통과. MEGA_LONG → fallback CUSTOM + INVALID_WINDOW 워닝 |
| S4 | evaluationObservation no raw candles | candles / rawCandles / raw.fullApiResponse / rawResponse.apiKey / secret 등 입력에도 출력 0건. RAW_INPUT_STRIPPED 워닝 |
| S5 | externalConfluence normalize | BULL/STRONG/NORMAL/HIGH_LIQ/LOW/POSITIVE 정규화. marketRisk=LOW 파생 |
| S6 | externalConfluence unknown defaults | empty input → 모든 라벨 UNKNOWN / NONE / hasKnownEvent=false / confluenceScore=null / confluenceLabel=UNKNOWN |
| S7 | externalConfluence does NOT replace score | totalScore/planQualityTier/strategyBias/scoreBreakdown 출력 부재 (DP-ACP5) |
| S8 | externalConfluence score disabled by default | enableScore=false → confluenceScore=null / reasons['SCORE_DISABLED'] |
| S9 | externalConfluence score enabled | enableScore=true → numeric score in [-100,100]. favorable 70 / adverse clamp 검증 |
| S10 | mutation check (both adapters) | JSON before/after 동일 (2종 모두) |
| S11 | v0.10.0 compatibility | EO.build(op, ac, adapterOutput, null) 정상 동작. outcome.baselinePrice/highPrice/lowPrice/window adapter 출력 전달 검증 |
| S12 | forbidden patterns (runtime) | 2종 모두 sync return (not Promise). 외부 의존 0건 |
| Extra-A | frozen-input safety | deepFreeze 입력에 throw 0 (2종 모두) |
| Extra-B | candidateKey missing warning | INVALID_CANDIDATE_KEY 워닝 + valid=false |
| Extra-C | marketRisk derivation | RISK_OFF→HIGH / BEAR→ELEVATED / BULL→LOW / NEUTRAL→NEUTRAL |

(smoke 파일 `_ws3_v110_smoke.js` 는 검증 후 worktree 에서 제거)

## 6. v0.10.0 compatibility 검증 (S11 상세)

```text
1. ObsAdapter.build(externalInput) → evaluationObservation (v0.10.0 호환)
2. EvaluationOutcome.build(op, ac, evaluationObservation, null) → 정상 동작
3. 출력 검증:
   - outcome.priceBasis.baselinePrice === 100 ✅
   - outcome.priceBasis.highPrice === 105 ✅
   - outcome.priceBasis.lowPrice === 98 ✅
   - outcome.evaluation.window === '24H' ✅
   - throw 0건 ✅
```

v0.10.0 buildEvaluationOutcome 이 adapter 출력을 그대로 입력으로 받아 정상 처리. **호환 보장 확인**.

## 7. 금지 패턴 grep 결과 (실코드 침범 0건)

| 패턴 | 결과 |
|---|---|
| `fetch(\|KV.\|DB\|Telegram\|sendTelegram\|XMLHttpRequest\|innerHTML\|document.\|addEventListener\|localStorage\|sessionStorage\|Date.now(\|new Date\|performance.now` | 각 모듈 1건 (DP-ACP3 정책 명시 comment "영속 저장 (KV / DB / 파일 IO / 브라우저 storage)") — **코드 침범 0건** ✅ |
| `evaluationObservation.X = ... / externalConfluence.X = ... mutation` | **0건** ✅ (양쪽 모듈 모두) |
| `payload.raw\|identityInput\|raw.builderDebug\|secret\|chatId\|botToken\|apiKey\|raw candles\|full API response` | comment 2-3건 (DP-ACP6 정책 명시) — **코드 침범 0건. raw candles / API response / identityInput / secret 노출 0건** ✅ |
| `매수 성공\|손절\|익절\|수익 확정\|손실 확정\|profit\|loss\|매수하세요\|매도하세요\|buy now\|sell now\|take profit\|stop loss` | **0건** ✅ (양쪽 모듈 모두) |
| `TransportPlan\|RendererBinding\|AdapterContractPack\|buildAdapterContractPack\|telegramPlan\|snapshotPlan\|evaluationPlan\|rendererBinding` | comment 1건 (DP-ACP2 정책 명시 "v0.12.0 으로 분리") — **코드 정의 0건** ✅ (DP-ACP10 정합) |

## 8. v0.12.0 분리 항목 미생성 확인

- `v3/v3-transport-plan.js` — **미생성** ✅
- `v3/v3-renderer-binding.js` — **미생성** ✅
- `v3/v3-adapter-contract-pack.js` — **미생성** ✅
- `buildAdapterContractPack` 함수 — **0건** ✅
- TransportPlan / RendererBinding / telegramPlan / snapshotPlan / evaluationPlan / rendererBinding 식별자 정의 — **0건** ✅

## 9. 보호 파일 diff 검증

`git diff --stat HEAD -- <protected19>` = 빈 출력 ✅

```text
v3 *.js 14종 (config / feature-payload / bithumb-client / candle-normalizer / indicators /
              feature-payload-builder / score-breakdown / structure-bucket / signal-cycle /
              strategy-plan / card-view-model / operation-packet / active-cycle /
              evaluation-outcome)                                                           → 0 변경
docs/ws3/WS3_CODE_CONTRACT.md (b-r2 박제) /
docs/ws3/WS3_WORKFLOW_TEMPLATE.md (v0.1 박제)                                              → 0 변경
index.html / manifest.json / service-worker.js                                            → 0 변경
```

신규/변경 파일 (이번 단계):
- `v3/v3-evaluation-observation-adapter.js` (신규, 497줄, untracked)
- `v3/v3-external-confluence.js` (신규, 736줄, untracked)
- `docs/ws3/WS3_v0_11_0_ADAPTER_INPUT_CONTRACT_PACK_REPORT.md` (신규, 본 파일)
- `docs/ws3/WS3_CHANGELOG.md` (modified — `[v0.11.0]` 엔트리 상단)
- `docs/ws3/WS3_CURRENT_BASELINE.md` (modified — v0.11.0 baseline)

## 10. 의도된 미구현 (이번 단계 제외)

- 실제 Bithumb / Upbit / Binance API fetch
- 실제 외부 API 호출 / 뉴스 fetch / 일정 API
- 실제 Telegram 발송
- KV / DB / 파일 IO / 브라우저 storage read/write
- 실제 snapshot / evaluation 저장
- DOM 렌더 / UI 이벤트
- 입력 객체 mutation
- 런타임 clock API
- TransportPlan / RendererBinding / AdapterContractPack (v0.12.0 으로 분리)
- bot 식별 시크릿 / 채널 식별자 / API 키

## 11. 다음 단계

```text
WS3 v0.12.0 — Adapter Output Contract Pack
  - TransportPlan (기존 routing boolean AND 집계)
  - RendererBinding (v0.7 cardViewModel superset)

(별도) v0.10.x evaluation adapter — 실제 24h/7d 캔들 fetch + outcome 영속화
(별도) v0.9.x transport adapter — 실제 외부 전송 / KV 저장
(별도) v0.8.x transport — OperationPacket 실제 전송
(별도) v0.7.x renderer — DOM / HTML 렌더
```

## 12. 기준 commit

- branch: `claude/heuristic-cori-7865e7`
- 이전 functional baseline: WS3 v0.10.0 evaluationOutcome (`887123a`)
- 본 commit: (push 후 기록)

## 13. 핵심 메모

```text
- v3/v3-evaluation-observation-adapter.js 신규 생성 1건 (497 라인)
- v3/v3-external-confluence.js 신규 생성 1건 (736 라인)
- 보호 파일 19종 모두 무손상 (v3 *.js 14종 + index/manifest/sw 3종 + CODE_CONTRACT + WORKFLOW_TEMPLATE)
- WS3_CODE_CONTRACT.md 미수정 (b-r2 박제본 그대로)
- WS3_WORKFLOW_TEMPLATE.md 미수정 (v0.1 박제본 그대로)
- DP-ACP1 ~ DP-ACP10 모두 적용 / 미해결 항목 0건
- U-ACP-1 Option A (source='adapter-normalized' + reasons['ADAPTER_NORMALIZED']) 적용
- U-ACP-2 (confluenceScore number|null, 기본 null, -100~100 범위, enableScore 기본 false) 적용
- N-ACP-OBS-1 (payload.newsContext 직접 read 금지) 적용
- N-ACP-OBS-2 (보호 파일 책임 분리) 적용
- EvaluationObservationAdapter:
  - field mapping 13종 (windowLabel/startMs/endMs/pricePoints×5/priceTimestamps×3/barsObserved/isComplete/sourceTag)
  - v0.10.0 buildEvaluationOutcome 호환 보장 (S11 smoke 검증)
  - raw candles / API response 노출 0건 (S4 검증)
  - 입력 mutation 0건 (S10 검증)
- ExternalConfluence:
  - 5종 sub-context 정규화 (market / sector / exchange / schedule / news)
  - 6 confluenceLabel 후보 (UNKNOWN/FAVORABLE/NEUTRAL/ADVERSE/MIXED)
  - confluenceScore 기본 null. enableScore=true 시 contribution 합산 (-100~100 clamp)
  - 기존 scoreBreakdown / strategyPlan 판단 대체 0건 (S7 검증)
  - payload.newsContext 직접 read 0건
  - 입력 mutation 0건 (S10 검증)
- v0.12.0 분리 항목 (TransportPlan / RendererBinding / AdapterContractPack / buildAdapterContractPack 등) 미생성 확인
- 외부 호출 / DOM / 브라우저 storage / KV / fetch 0건
- 런타임 clock API 사용 0건
- 매매 권고 / 매수·매도 어휘 / 수익·손실 확정 0건
- secret / token / chatId / botToken / apiKey 0건
- frozen input 안전성 검증 (Extra-A)
```
