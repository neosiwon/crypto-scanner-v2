# WS3 Current Baseline

> 현재 GitHub 박제 기준 (최신).  
> 다음 단계 작업 전에 이 파일로 baseline 을 확인.

**최종 업데이트**: 2026-05-14  
**현재 단계**: WS3 v0.2.0-b-r2 Code Contract Freeze 완료  
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
| **WS3 v0.2.0-b-r2** | **Code Contract Freeze (문서)** | **(push 후 기록)** | **✅ 박제 (이번 단계)** |

## REJECTED — repo 반영 보류

| 단계 | 사유 |
|---|---|
| WS3 v0.2.0-c (1차 수정본) | REJECTED / NOT APPLIED — v3-feature-payload.js 코드 계약 위반 6건. v0.2.0-c-r1 로 재작성 예정. |

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
/docs/ws3/WS3_CODE_CONTRACT.md   ← v0.2.0-b-r2 박제본
```

**충돌 시 우선순위**:
```text
WS3_CODE_CONTRACT.md  >  백서  >  기타 문서
```

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
현재 build 함수는 throw 상태 (v0.2.0-c-r1 에서 구현 예정 — DP-3 결정 후)
```

자세한 내용은 `WS3_CODE_CONTRACT.md` 참고.

---

## 보호 파일 (수정 금지)

```text
index.html
manifest.json
service-worker.js
worker.js
wrangler.toml

/v3/v3-config.js
/v3/v3-feature-payload.js                  ← 핵심 보호 (코드 계약)
/v3/v3-bithumb-client.js                    ← market 문자열만 fetch 인자로 사용 (b-r2 박제)
/v3/v3-candle-normalizer.js                 ← tradeValue = close * volume 산출 (b-r2 박제)
/v3/v3-indicators.js                        ← v0.2.0-b 박제본
/v3/v3-index.html                           (생성도 X)
```

---

## 모듈 의존성

```text
v3-bithumb-client.js  (o.market 문자열 fetch)
  ↓ (raw candles)
v3-candle-normalizer.js  (tradeValue = close * volume)
  ↓ (normalized candles)
v3-indicators.js  (v0.2.0-b 박제)
  ↓ (indicator snapshot)
[v0.2.0-c-r1 buildFeaturePayload 재작성 단계 — DP-3 결정 후]
  ↓ (v3FeaturePayload 13 top-level field)
[v0.3.x scoreBreakdown]
```

---

## 미결정 사항 (DECISION_PENDING)

다음 항목은 본 baseline 시점에서 **결정되지 않았다**. 다음 단계 작업지시서에서 사용자/GPT 결정 필요:

```text
DP-1: payload.ts 의 값 결정
       Date.now() / 마지막 candle ts / 호출자 명시 / null 유지

DP-2: tradeValue 외 거래대금 키의 노출 정책 (normalizer side)

DP-3: v0.2.0-c-r1 builder 의 배치 방식
       별도 파일 / 본 파일 수정 / 혼합
```

자세한 내용은 `WS3_CODE_CONTRACT.md` §8 참고.

---

## 미확인 사항 (다음 단계 추가 grep 필요)

```text
- v3-config.js 전체 (export 스타일 / buyPressure 정책값 / 키 목록)
- v3-bithumb-client.js 의 market 문자열 형식 / 메타 채우기 호출 흐름 / export 스타일
- v3-candle-normalizer.js 의 ts/tradeValue 외 필드 키 / export 스타일
- indicators / structure / volume / momentum / raw 슬롯의 실제 빌더 입력 형식
```

자세한 내용은 `WS3_CODE_CONTRACT.md` §9 참고.

---

## 다음 단계 (확정된 순서)

```text
WS3 v0.2.0-c-r1 — buildFeaturePayload 재작성
  기준: WS3_CODE_CONTRACT.md
  필수 결정: DP-1 / DP-2 / DP-3
  필수 통과: WS3_FeaturePayload.isValid() 통과 조건 (§7)

WS3 v0.3.0 — scoreBreakdown 본체
  목적: v3FeaturePayload 13 top-level field 를 읽어 100점 점수 구성요소 계산
        - 코어 25 + 구조 20 + 거래량 20 + 모멘텀 15 + 실행 20 = 100
        - riskPenalty 최대 15 차감
  범위:
        - scoreBreakdown 본체만
        - structureBucket 최종 확정은 v0.4.0
        - grade 산출은 score 결과 + 별도 승인 후

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

## v0.2.0-b-r2 핵심 메모

```text
- .js 파일 0건 수정 / 0건 신규
- 실제 코드 계약을 grep 으로 박제 → WS3_CODE_CONTRACT.md
- top-level field 13개 확정 + createEmpty 초기값 사실 그대로 박제
- DP-1 / DP-2 / DP-3 미결정 → v0.2.0-c-r1 에서 결정
- 미확인 항목 다수 → v0.2.0-c-r1 작업지시서 사전 조사 시 추가 grep
- v0.2.0-c 1차 수정본은 REJECTED / NOT APPLIED → v0.2.0-c-r1 로 재작성
```
