# WS3 Current Baseline

> 현재 GitHub 박제 기준 (최신).  
> 다음 단계 작업 전에 이 파일로 baseline을 확인.

**최종 업데이트**: 2026-05-15  
**현재 단계**: WS3 v0.2.0-b-r1 (Baseline Consistency Hotfix)

---

## 완료된 단계

| 단계 | 파일 | 상태 |
|---|---|---|
| WS3 v0.1.0 | `/v3/v3-config.js` | ✅ 박제 |
| WS3 v0.1.0 | `/v3/v3-feature-payload.js` | ✅ 박제 |
| WS3 v0.2.0-a | `/v3/v3-bithumb-client.js` | ✅ 박제 |
| WS3 v0.2.0-a | `/v3/v3-candle-normalizer.js` | ✅ 박제 |
| WS3 v0.2.0-b | `/v3/v3-indicators.js` | ✅ 박제 |
| **WS3 v0.2.0-b-r1** | **Baseline Consistency Hotfix (문서/주석/후보키)** | **✅ 적용 (이번 단계)** |

---

## 기준 백서

```text
/docs/ws3/WOOS_Scanner_V3_개발백서_v0_3_3.md   ← 미박제 상태 / 외부 파일 기준
```

> **주의 (v0.2.0-b-r1)**:
> 현재 repo의 `docs/ws3/`에 v0.3.3 백서 파일이 **존재하지 않음**.
> 다음 작업자는 외부 보관본을 참조해야 하며, baseline에 박제되기 전까지는
> "백서 원본 필요" 상태로 간주한다. 임의 생성 금지.

---

## V3 핵심 전제

```text
- V3는 기존 WOOS 확장이 아니라 독립 정밀 스캐너
- 기존 active/completed/history/관심/정밀/표준 의미 이식 금지
- 기존 UI 톤과 raw → state → ViewModel → render 철학만 참고
- Bithumb-only v0
- featurePayload 기존 코드 계약 우선
- 백서와 코드 계약이 충돌하면 기존 박제 코드 계약 확인 후 백서 패치
- 외부 신호는 featurePayload에 넣지 않고 externalConfluence로 분리
- 외부 신호는 점수/등급 영향 X
```

---

## V3Candle canonical 계약

```js
{
  ts,          // canonical (number)
  open,
  high,
  low,
  close,
  volume,
  tradeValue   // canonical (number | null, normalizer가 close × volume으로 estimated 채움)
}
```

- 출력 canonical: `v3-candle-normalizer.js` 가 위 형태로 반환.
- typedef: `v3-feature-payload.js` 의 `V3Candle` typedef와 일치.
- 외부 raw 호환은 `v3-indicators.js` 의 `readCandleField()` fallback 후보 키로만 처리.
- 다음 단계 (v0.2.0-c) `buildFeaturePayload` 에서는 반드시 **canonical `ts` / `tradeValue`** 만 사용한다.
- `timestamp` / `value` 는 외부 raw fallback이며 canonical 아님.

---

## V3FeaturePayload top-level field (13개)

```text
identity
ts
candles
indicators
structure
volume
momentum
marketContext
buyPressure
coinMeta
newsContext
risk
raw
```

> **표현 주의**:
> 외부 작업지시서에 "12 슬롯"으로 표기된 경우가 있으나, `createEmptyFeaturePayload()` 기준 실제 top-level field는 **13개** 이다.
> v0.2.0-c `buildFeaturePayload` 는 13개 field를 모두 유지해야 한다.
> - 어떤 field도 `delete` 금지
> - `skipPlaceholders` / `omitNullSlots` 같은 옵션 추가 금지
> - `coinMeta`, `newsContext` 가 null 이어도 key 자체는 유지

### Validator 정책 결정 대기 (v0.2.0-c 진입 전 결정 필요)

현재 `isValidPayload` 는 `ts` / `coinMeta` / `newsContext` 의 key 존재 여부를 검사하지 않는다.
v0.2.0-c 진입 전에 아래 중 하나를 결정해야 한다.

- (A) nullable field라도 key 존재를 강제하도록 validator 강화
- (B) 현행 validator 정책 유지하고, `buildFeaturePayload` 가 항상 `createEmptyFeaturePayload` 기반으로 시작해 모든 key를 보장

> 이번 핫픽스(v0.2.0-b-r1)에서는 `v3-feature-payload.js` 코드를 수정하지 않는다.
> 결정 자체를 v0.2.0-c 작업지시서에서 확정한다.

---

## strategyBias / display 선박제 주의

`v3-config.js` 에는 아래 항목이 이미 박제되어 있다.

- `WS3_STRATEGY_BIAS` enum (SCALP / SWING / SCALP_SWING / WATCH / AVOID)
- `WS3_DISPLAY.strategyBias` 한글 라벨
- `WS3_HEADER_SLOT_PRIORITY` 의 `strategyBias` 항목

> **주의**:
> strategyBias enum/display/header slot 은 v0.1.0 config 계약에 **선박제**된 것이다.
> 실제 strategyBias **계산 로직 구현은 WS3 v0.6.0 단계**에서 이루어진다.
> 현재 단계에서 strategyBias 로직이 구현된 것으로 해석하지 않는다.

---

## 보호 파일 (수정 금지)

```text
index.html
manifest.json
service-worker.js
worker.js
wrangler.toml
/v3/v3-config.js
/v3/v3-feature-payload.js
/v3/v3-bithumb-client.js
/v3/v3-candle-normalizer.js
/v3/v3-indicators.js              ← v0.2.0-b 박제 / v0.2.0-b-r1에서 주석·후보키만 정합성 조정
/v3/v3-index.html (생성도 X)
```

---

## 다음 단계

```text
WS3 v0.2.0-c — buildFeaturePayload 본체 작업

목적:
  normalized candles
  + indicator snapshot
  + meta/context
  → v3FeaturePayload 코드 계약(13 top-level field)에 맞게 조립

이번 단계 (v0.2.0-b/-b-r1)는 indicator snapshot + 정합성 정리까지만.
featurePayload 본체 조립은 v0.2.0-c 에서.
```

---

## 아직 도래하지 않은 단계

```text
WS3 v0.2.0-c    buildFeaturePayload 본체
WS3 v0.3.0      scoreBreakdown
WS3 v0.4.0      structureBucket / priceZone / referenceLow
WS3 v0.5.0      signalCycle / persistence
WS3 v0.6.0      strategyBias / entryPlan / exitPlan
WS3 v0.7.0      UI / CardViewModel
WS3 v0.8.0      Telegram / snapshot / evaluation
WS3 v0.9.x+     externalConfluence / LW activeCycle / 사후평가 보정 분석
```

> **순서 주의**:
> - `signalCycle` 은 v0.5.0 이다. v0.4.0 의 structureBucket 묶음에 넣지 않는다.
> - UI 와 Telegram 은 같은 단계가 아니다. UI 는 v0.7.0, Telegram 은 v0.8.0.
> - 코드 버전(`v0.x`) 과 제품 Phase(Phase 4/5) 표현을 같은 라인에서 혼합하지 않는다. Phase 표기가 필요하면 별도 단락으로 분리한다.
