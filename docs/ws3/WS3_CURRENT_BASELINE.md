# WS3 Current Baseline

> 현재 GitHub 박제 기준 (최신).  
> 다음 단계 작업 전에 이 파일로 baseline 을 확인.

**최종 업데이트**: 2026-05-16  
**기능 단계 (current functional baseline)**: WS3 v0.3.0 scoreBreakdown core (`b7e0ea3`)  
**운영 문서**: WS3 Workflow Template v0.1 박제 (`v0.3.0-docs`, 본 단계 — 기능 버전 변동 없음)  
**branch**: `claude/heuristic-cori-7865e7`

---

## 완료된 단계

| 단계 | 파일 | commit | 상태 |
|---|---|---|---|
| WS3 v0.1.0 | `/v3/v3-config.js` | — | ✅ 박제 |
| WS3 v0.1.0 | `/v3/v3-feature-payload.js` | — | ✅ 박제 (코드 계약 정의) |
| WS3 v0.2.0-a | `/v3/v3-bithumb-client.js` | — | ✅ 박제 |
| WS3 v0.2.0-a | `/v3/v3-candle-normalizer.js` | — | ✅ 박제 |
| WS3 v0.2.0-b | `/v3/v3-indicators.js` | `c98cbd8` | ✅ 박제 |
| WS3 v0.2.0-b-r1 | baseline consistency (문서) | `da00e62` | ✅ 박제 |
| WS3 v0.2.0-b-r2 | Code Contract Freeze (문서) | `04eac43` | ✅ 박제 |
| WS3 v0.2.0-c-r1 | `/v3/v3-feature-payload-builder.js` | `51e510d` | ✅ 박제 |
| **WS3 v0.3.0** | **`/v3/v3-score-breakdown.js`** | **(push 후 기록)** | **✅ 박제 (이번 단계)** |

## REJECTED — repo 반영 보류

| 단계 | 사유 |
|---|---|
| WS3 v0.2.0-c (1차 수정본) | REJECTED / NOT APPLIED — v3-feature-payload.js 코드 계약 위반 6건. v0.2.0-c-r1 로 재작성 완료. |

---

## 기준 백서

```text
/docs/ws3/WOOS_Scanner_V3_개발백서_v0_3_3.md
```

> ⚠️ **백서 repo 박제 상태**: 이전 감사 시점 기준, 위 경로의 백서 파일은 실제 repo 에 박제되어 있지 않다.  
> 백서 본문은 별도 위치 (Claude Web / 사용자 로컬) 에서 관리되고 있으며, repo 박제는 추후 별도 단계로 진행될 예정.  
> 본 baseline 의 모든 "기준 백서" 참조는 해당 미박제 문서를 가리킨다.  
> 코드 계약 충돌 시에는 **`WS3_CODE_CONTRACT.md` 가 우선** (백서 박제 여부와 무관).

## 단일 코드 계약 기준 (필수)

```text
/docs/ws3/WS3_CODE_CONTRACT.md   ← v0.2.0-b-r2 박제본 (이번 c-r1 단계에서도 미수정)
```

**충돌 시 우선순위**:
```text
WS3_CODE_CONTRACT.md  >  백서  >  기타 문서
```

---

## 운영 문서 (워크플로우 표준)

```text
/docs/ws3/WS3_WORKFLOW_TEMPLATE.md   ← v0.1 박제본 (v0.3.0-docs 단계, 2026-05-16)
```

**용도**:
- GPT 작업지시서 초안 → Claude Web 피드백 → GPT 최종 전문 → Claude Code 실행 흐름의 단일 표준
- 14단계 흐름 / 4 Gate (Gate 1 사전조사 / Gate 2 코드 작성 / Gate 3 commit / Gate 4 push) / PR-main merge 별도 승인 (Gate 5/6)
- commit 메시지 한 줄 원칙
- DP prefix 명명 규칙 (DP-1~7 / DP-S* / DP-STR* / DP-CYC* / DP-STG*)

**역할 분담** (§0.1):
- **GPT** = 작업지시서 초안 전문 작성 + 최종 전문 작성 + commit 메시지 작성
- **Claude Web** = 작업지시서 피드백만
- **Claude Code** = repo 실제 코드 작성 / 검증 / diff / commit / push

**변경 정책** (§15): 즉흥 수정 금지. 변경 필요 시 별도 단계 (v0.2 등) 로 박제.

---

## V3 핵심 전제

```text
- V3 는 기존 WOOS 확장이 아니라 독립 정밀 스캐너
- 기존 active/completed/history/관심/정밀/표준 의미 이식 금지
- 기존 UI 톤과 raw → state → ViewModel → render 철학만 참고
- Bithumb-only v0
- v3-feature-payload.js 코드 계약 우선
- 백서와 코드 계약이 충돌하면 WS3_CODE_CONTRACT.md 우선
- 외부 신호는 featurePayload 에 넣지 않고 externalConfluence 로 분리
- 외부 신호는 점수/등급 영향 X
- 지표/라벨링 기준값은 항상 config override 가능
```

---

## v3FeaturePayload 코드 계약 요약 (WS3_CODE_CONTRACT.md 발췌)

### top-level field (13개)

```text
1.  identity         (object, isValid 검사)
2.  ts               (number | null, isValid 미검사)
3.  candles          (object, m5/m15/h1/h4/d1 배열 — isValid 검사)
4.  indicators       (object, isValid 검사)
5.  structure        (object, isValid 검사)
6.  volume           (object, isValid 검사)
7.  momentum         (object, isValid 검사)
8.  marketContext    (object, isValid 검사, default {state:'UNKNOWN'})
9.  buyPressure      (object, isValid 검사, default {state:'BUY_PRESSURE_UNKNOWN'})
10. coinMeta         (null default, isValid 미검사)
11. newsContext      (null default, isValid 미검사)
12. risk             (object, isValid 검사 — flags[] / level string 포함, default {penalty:null,level:'UNKNOWN',flags:[]})
13. raw              (object, isValid 검사)
```

### identity

```text
{
  base:        null         (default, isValid 미검사)
  quote:       'KRW'        (default, isValid string 검사)
  market:      null         (default, isValid 미검사)
  exchange:    'BITHUMB'    (default, isValid string 검사)
  displayName: null         (default, isValid 미검사)
}
```

### candles

```text
{ m5: [], m15: [], h1: [], h4: [], d1: [] }
모두 배열 검사
```

### export

```text
global.WS3_FeaturePayload = Object.freeze({ createEmpty, build, isValid })
IIFE browser-global 방식
build 함수는 throw 상태 유지 (c-r1 DP-3-A 결정 — builder는 별도 파일).
```

자세한 내용은 `WS3_CODE_CONTRACT.md` 참고.

---

## v3-feature-payload-builder.js 요약 (c-r1 신규)

### 입력 / 출력

```text
입력:
  - V3BuildCandlesInput  { m5, m15, h1, h4, d1 } 객체 (단일 배열 X)
  - V3BuildMarketCtx     { market, exchange?, base?, quote?, displayName?,
                           ts?, timeframe?, coinMeta?, newsContext?,
                           riskOverride?, indicatorConfig? }
출력:
  - V3FeaturePayload (13 top-level field, isValid 통과)
  - 실패 시 throw 없이 safe payload + raw.builderDebug.warnings 기록
```

### 적용 정책 (DP)

```text
DP-1 ts:          marketCtx.ts > primary candle.ts > null  (Date.now 금지)
DP-2 tradeValue:  canonical 'tradeValue' 만 외부 노출 (alias 금지)
DP-3 배치:        별도 파일 신규 (v3-feature-payload.js build 함수 throw 유지)
DP-4 validator:   현행 유지 (builder가 createEmpty 기반 시작)
DP-5 identity:    normalizeIdentity helper ('KRW-BTC' → quote/base 분해)
DP-6 marketCtx:   V3BuildMarketCtx typedef + 안전 정규화
DP-7 raw:         raw.builderDebug 디버그 보조 구조
U-2  candles:     V3BuildCandlesInput typedef (5 timeframe 객체)
```

### indicator snapshot 분리 매핑

```text
WS3Indicators.buildIndicatorSnapshot() 반환:
  { valid, indicators, warnings, debug }

매핑:
  payload.momentum   ← rsi / mfi / obv / ma
  payload.volume     ← volume / volumeAcceleration / tradeValue
  payload.structure  ← candleShape / candleStructure / structure
  payload.indicators ← atr / snapshotValid / warnings / debug / indicatorVersion
```

### export

```text
global.WS3_FeaturePayload_Builder = Object.freeze({
  BUILDER_VERSION, DEFAULT_PRIMARY_TIMEFRAME, TIMEFRAMES,
  build, normalizeIdentity, normalizeCandlesInput, resolveTs, mapIndicatorSnapshot
})

이중 환경: global + module.exports (v3-indicators.js 와 동일 패턴)
```

자세한 내용은 `WS3_v0_2_0_c_r1_BUILD_REPORT.md` 참고.

---

## 보호 파일 (수정 금지)

```text
index.html
manifest.json
service-worker.js
worker.js
wrangler.toml

/v3/v3-config.js
/v3/v3-feature-payload.js                   ← 핵심 보호 (코드 계약). build 함수 throw 유지.
/v3/v3-bithumb-client.js                    ← market 문자열만 fetch 인자로 사용
/v3/v3-candle-normalizer.js                 ← tradeValue = close * volume 산출
/v3/v3-indicators.js                        ← v0.2.0-b 박제본
/v3/v3-feature-payload-builder.js           ← v0.2.0-c-r1 박제본
/v3/v3-score-breakdown.js                   ← v0.3.0 박제본 (이번 단계 신규)
/v3/v3-index.html                           (생성도 X)
```

> 다음 단계 (v0.4.0 structureBucket / priceZone / referenceLow) 진입 후 builder/score 인자 / 매핑 정책 갱신이 필요해지면 별도 r1.x 단계로 분리하여 별도 승인 후에만 수정.

---

## 모듈 의존성

```text
v3-bithumb-client.js  (o.market 문자열 fetch — proxy worker 경유)
  ↓ (raw candles)
v3-candle-normalizer.js  (tradeValue = close * volume, canonical {ts,open,high,low,close,volume,tradeValue})
  ↓ (normalized candles, timeframe별 배열)
v3-indicators.js  (v0.2.0-b 박제 — buildIndicatorSnapshot)
  ↓ (indicator snapshot)
v3-feature-payload-builder.js  (v0.2.0-c-r1 박제 — V3FeaturePayload 13 top-level field 조립)
  ↓ (V3FeaturePayload, isValid 통과)
v3-score-breakdown.js  (v0.3.0 박제 — 5 component + riskPenalty → totalScore)
  ↓ (standalone scoreBreakdown 객체, payload mutate 0건)
[v0.4.0 structureBucket / priceZone / referenceLow 확정]
```

---

## 해소된 DECISION_PENDING (c-r1 단계 종료 시점)

| ID | 결정 | 적용 |
|---|---|---|
| **DP-1** | explicit ts > primary candle.ts > null. Date.now 금지 | `resolveTs()` |
| **DP-2** | canonical tradeValue만, alias 외부 노출 금지 | 매핑 전체 |
| **DP-3** | DP-3-A: 별도 파일 신규. v3-feature-payload.js build throw 유지 | `v3-feature-payload-builder.js` |
| **DP-4** | validator 현행 유지. builder가 createEmpty 기반 13 key 보장 | `buildFeaturePayload()` step 1 |
| **DP-5** | normalizeIdentity helper. 'KRW-BTC' → quote/base 분해 | `normalizeIdentity()` |
| **DP-6** | V3BuildMarketCtx typedef + 안전 정규화 | typedef + 전반 |
| **DP-7** | raw.builderDebug 디버그 보조 구조 도입 | builderDebug 객체 |
| **U-1** | indicators 내부 통계 키 (currentTradeValueKrw 등) v3-indicators 결과 그대로 보존 — quote-agnostic 리네이밍은 v0.3 이후 별도 검토 | 참고 사항 |
| **U-2** | V3BuildCandlesInput typedef. 5 timeframe 객체 입력. 단일 배열 X | `normalizeCandlesInput()` |

> WS3_CODE_CONTRACT.md (b-r2 박제본) §8 의 DP-1/2/3 + c-r1 신규 DP-4/5/6/7 모두 해소.
> CODE_CONTRACT 본문은 c-r1 단계에서 수정하지 않음. r2.1 박제 검토는 별도 단계.

---

## 다음 단계 (확정된 순서)

```text
WS3 v0.4.0 — structureBucket / priceZone / referenceLow 확정
  - BOX_PRESSURE / BOX_BREAKOUT / OB_RECLAIM / LOW_SWEEP_RECLAIM / MA_RECLAIM
  - priceZone 확정
  - referenceLow 다중 timeframe (5m/15m/1h/4h)

WS3 v0.5.0 — signalCycle / persistence / cooldown
  - signalCycle 생성 / cooldown
  - 반복신호 milestone (3/5/10회)
  - priceZone 기준 cycle 묶음

WS3 v0.6.0 — strategyBias / entryPlan / exitPlan A-F
  - 단타/스윙/관찰/회피 분류
  - LONG 30/30/40 entryPlan
  - exitPlan A~F

WS3 v0.7.0 — UI / CardViewModel
  - 카드헤더 슬롯 / 카드바디 18 섹션
  - selectionReason 표시
  - V3 renderer

WS3 v0.8.0 — Telegram / snapshot / evaluation
  - Telegram 메시지 템플릿
  - snapshot URL/저장
  - 사후평가 15m/1h/4h/24h/3d/7d

WS3 v0.9.0+ — Phase 4-5 (백서 §21)
  - 빗썸 공식 externalConfluence
  - LW activeCycle tracker
  - 사후평가 보정 분석
```

---

## v0.3.0 핵심 메모

```text
- v3/v3-score-breakdown.js 신규 생성 1건 (~880 lines)
- v3-feature-payload-builder.js / v3-feature-payload.js 등 보호 파일 10종 모두 무손상
- WS3_CODE_CONTRACT.md 미수정 (b-r2 박제본 그대로)
- DP-S1 ~ DP-S9 + N-1 ~ N-5 모두 적용 / 미해결 항목 0건
- payload mutation 0건 (DP-S1, smoke test 검증)
- 100점 만점: core 25 + structure 20 + volume 20 + momentum 15 + execution 20
- riskPenalty 최대 15 (default risk이면 penalty 0 — DP-S4)
- grade / tier / label / P-S/A/B 미산출 (DP-S5)
- buyPressure / marketContext 점수 미반영 (DP-S6 / N-2 / N-3, core에서 object 존재만)
- indicator state 라벨 활용 (RSI/MFI/OBV/MA/volumeState) — 별도 임계값 하드코딩 0건
- valid (계산 가능 여부) vs totalScore (신호 강도) 분리 (DP-S9)
- 외부 호출 / DOM / 브라우저 storage / KV 0건
- 런타임 clock API 사용 0건
```
