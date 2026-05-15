# WS3 Code Contract

> **박제 기준**: WS3 v0.2.0-b-r2 Code Contract Freeze  
> **박제 일자**: 2026-05-14  
> **HEAD**: `da00e62c7d6fe86ab2a51583d0deb3c0cccdb3c9` (b-r1)  
> **branch**: `claude/heuristic-cori-7865e7`  
> **출처**: Claude Code Gate 1 `git show` / `grep` / `cat` 결과
>
> 본 문서는 **v3-feature-payload.js 및 관련 .js 파일의 실제 코드 계약을 박제(freeze)한 단일 기준**이다.  
> 이후 v0.2.0-c-r1 / v0.3.x 등 모든 후속 작업은 이 문서를 기준으로 한다.  
> 백서(WOOS_Scanner_V3_개발백서_v0_3_3.md)와 본 문서가 충돌하면 **본 문서가 우선**.

---

# §1. v3-feature-payload.js

## §1.1 top-level field — 정확한 목록과 순서

`v3-feature-payload.js` 의 `WS3_FeaturePayload.createEmpty()` 가 반환하는 객체의 top-level 키:

```text
1.  identity
2.  ts
3.  candles
4.  indicators
5.  structure
6.  volume
7.  momentum
8.  marketContext
9.  buyPressure
10. coinMeta
11. newsContext
12. risk
13. raw
```

**정확한 표현**: "top-level field 목록"  
**금지 표현**: 이전 오기 표현 (잘못된 슬롯 수 표기)

## §1.2 createEmpty() 함수 — 정확한 초기값

Gate 1 결과로 확정된 초기값:

```js
WS3_FeaturePayload.createEmpty() === {
  identity: {
    base: null,
    quote: 'KRW',
    market: null,
    exchange: 'BITHUMB',
    displayName: null
  },
  ts: null,
  candles: {
    m5: [],
    m15: [],
    h1: [],
    h4: [],
    d1: []
  },
  indicators: {},
  structure: {},
  volume: {},
  momentum: {},
  marketContext: { state: 'UNKNOWN' },
  buyPressure: { state: 'BUY_PRESSURE_UNKNOWN' },
  coinMeta: null,
  newsContext: null,
  risk: {
    penalty: null,
    level: 'UNKNOWN',
    flags: []
  },
  raw: {}
}
```

핵심 사실:
- `identity.quote` default = `'KRW'`
- `identity.exchange` default = `'BITHUMB'`
- `identity.base / market / displayName` default = `null`
- `coinMeta` / `newsContext` default = `null` (object 가 아니라 **null**)
- `marketContext.state` default = `'UNKNOWN'`
- `buyPressure.state` default = `'BUY_PRESSURE_UNKNOWN'`
- `risk` 내부에 `penalty / level / flags` 세 필드

## §1.3 WS3_FeaturePayload.isValid() — 검사 항목 목록

Gate 1 결과로 확인된 검사 조건:

```text
[검사 항목 — string]
- identity.exchange   (string 검사)
- identity.quote      (string 검사)
- risk.level          (string 검사)

[검사 항목 — array]
- candles.m5          (배열)
- candles.m15         (배열)
- candles.h1          (배열)
- candles.h4          (배열)
- candles.d1          (배열)
- risk.flags          (배열)

[검사 항목 — object]
- indicators
- structure
- volume
- momentum
- marketContext
- buyPressure
- risk
- raw

[미검사 항목]
- payload.ts              (key 존재/타입 검사 없음)
- payload.coinMeta        (key 존재/타입 검사 없음)
- payload.newsContext     (key 존재/타입 검사 없음)
- identity.base           (createEmpty 에 존재, isValid 미검사)
- identity.market         (createEmpty 에 존재, isValid 미검사)
- identity.displayName    (createEmpty 에 존재, isValid 미검사)
```

→ v0.2.0-c-r1 builder 가 통과해야 할 기준은 위 [검사 항목] 전체.  
→ 미검사 항목은 builder 가 채워도 / 비워도 isValid 결과에 영향 없음. 단, **13개 top-level field 모두 채우는 게 안전(권장)**.

## §1.4 ts 필드 — 정확한 타입과 의미

```text
V3Candle.ts          : number
V3FeaturePayload.ts  : number | null
createEmpty 의 ts    : null
```

isValid() 는 ts 키 존재/타입 검사 없음 (§1.3).

## §1.5 identity 구조 — 정확한 필드와 default

```text
identity: {
  base:        null         (default, isValid 미검사)
  quote:       'KRW'        (default, isValid string 검사)
  market:      null         (default, isValid 미검사)
  exchange:    'BITHUMB'    (default, isValid string 검사)
  displayName: null         (default, isValid 미검사)
}
```

**검사 정책 정리**:
- `exchange / quote` — isValid 가 string 검사함
- `base / market / displayName` — isValid 미검사 (createEmpty 에는 존재)

## §1.6 candles 구조 — 정확한 필드

```text
candles: {
  m5:  [],
  m15: [],
  h1:  [],
  h4:  [],
  d1:  []
}
```

- 모든 timeframe 키는 **배열**
- isValid 가 5개 모두 배열인지 검사
- 각 배열 원소(V3Candle)의 `ts` 는 number (§1.4)

## §1.7 indicators / structure / volume / momentum 슬롯

```text
indicators   : {}    createEmpty 빈 object, isValid object 검사
structure    : {}    createEmpty 빈 object, isValid object 검사
volume       : {}    createEmpty 빈 object, isValid object 검사
momentum     : {}    createEmpty 빈 object, isValid object 검사
```

**내부 키 / 타입** 은 createEmpty 시점에서 빈 object. 실제 빌더가 어떤 형식으로 채우는지의 명세는 Gate 1 범위 밖 → 본 b-r2 에서는 **빈 object 가 초기값임만 박제**.

v3-indicators.js 의 `buildIndicatorSnapshot` 출력과의 매핑 규칙은 v0.2.0-c-r1 에서 다룬다.

## §1.8 marketContext / buyPressure / coinMeta / newsContext / risk 슬롯

```text
marketContext  : { state: 'UNKNOWN' }
                 isValid object 검사

buyPressure    : { state: 'BUY_PRESSURE_UNKNOWN' }
                 isValid object 검사

coinMeta       : null
                 isValid 미검사 (key 존재/타입 검사 없음)

newsContext    : null
                 isValid 미검사 (key 존재/타입 검사 없음)

risk           : { penalty: null, level: 'UNKNOWN', flags: [] }
                 isValid object 검사
                 isValid 가 risk.flags 배열 + risk.level string 추가 검사
                 risk.penalty 는 미검사 (createEmpty 에 null)
```

## §1.9 raw 슬롯

```text
raw : {}    createEmpty 빈 object, isValid object 검사
```

빌더 디버깅용 자유 필드. 내부 키는 빌더 측 결정.

## §1.10 buildFeaturePayload 현재 상태

```text
WS3_FeaturePayload.build 함수는 현재 throw 상태 유지.
구현 본체는 v0.2.0-c-r1 에서 결정 — DP-3 (§8 참고).
```

→ **v3-feature-payload.js 는 보호 파일이고, b-r2 에서 수정 X**.

## §1.11 export 스타일

```text
global.WS3_FeaturePayload = Object.freeze({
  createEmpty,
  build,
  isValid
})

방식: IIFE browser-global
```

세 함수가 freeze 객체로 노출. `build` 가 v0.2.0-c-r1 에서 채워질 자리.

---

# §2. v3-config.js

Gate 1 결과에서 grep 결과 보고되지 않은 항목 → 다음 단계에서 추가 grep:

```text
- export 스타일: 미확인 (Gate 1 미보고)
- buyPressure 관련 정책값 존재 여부: 미확인
- 기타 V3 관련 설정 키: 미확인
```

→ v0.2.0-c-r1 builder 는 v3-config.js 에 의존하지 않는 것을 권장 (DEFAULT_BUILDER_CONFIG 인라인 유지). 의존성 도입은 별도 결정.

---

# §3. v3-candle-normalizer.js

Gate 1 결과로 확정된 사실:

```text
- V3Candle.ts : number
- tradeValue 계산: close * volume 로 산출 후 canonical key "tradeValue" 로 출력
```

미확인 (다음 단계 추가 grep):

```text
- ts / tradeValue 외 필드 키 (open / high / low / close / volume 등의 정확한 키명 / 타입)
- 정규화 과정의 세부 변환 규칙
- export 스타일
```

v3-indicators.js 의 `readCandleField` helper 가 여러 후보 키를 지원하므로, normalized candle 의 실제 필드 키와 무관하게 동작.

---

# §4. v3-bithumb-client.js

Gate 1 결과로 확정된 사실:

```text
- o.market 문자열을 fetch 인자로 사용
- base / quote / displayName 을 직접 사용하지 않음
- market → base / quote 분해 로직 없음
```

미확인 (다음 단계 추가 grep):

```text
- market 문자열의 정확한 형식: Gate 1 기준 미확인
- 확인된 사실: v3-bithumb-client.js 는 o.market 문자열을 fetch 인자로 사용함
- base / quote / displayName 분해 로직은 현재 코드에 없음
- identity 메타 (base / quote / displayName) 가 어디서 채워지는지의 호출 흐름
- export 스타일
```

**시사점**: bithumb-client 는 `market` 만 사용한다. 따라서 builder 입장에서는 `identity.base / quote / displayName` 을 호출자가 직접 채우거나, 또는 별도 메타 fetcher 가 필요. 이는 DP-3 / v0.2.0-c-r1 에서 결정.

---

# §5. v3-indicators.js (v0.2.0-b)

```text
- 박제 commit: c98cbd88b048c3e51571030b696a6b590e2c0030
- export: global.WS3Indicators = { ... } + module.exports (양쪽 환경 자동 감지, IIFE)
- buildIndicatorSnapshot(candles, config) 함수가 핵심
```

본 b-r2 에서 별도 grep 박제는 생략 (v0.2.0-b 단계에서 박제 완료).

---

# §6. Canonical 표현

## §6.1 ts canonical

```text
V3Candle.ts          : number               (단일 candle 의 시각)
V3FeaturePayload.ts  : number | null        (top-level payload 의 시각)
createEmpty 시 ts    : null                 (초기값)
```

## §6.2 tradeValue canonical

```text
canonical key : "tradeValue"
산출 방식      : close * volume (v3-candle-normalizer.js)
```

## §6.3 표현 통일

```text
허용: "top-level field"
이전 오기 표현(잘못된 슬롯 수 표기): 모든 후속 문서에서 사용 X
```

모든 후속 문서/작업지시서/보고서는 위 정확한 표현을 사용한다.

---

# §7. WS3_FeaturePayload.isValid() 통과 조건 (v0.2.0-c-r1 단일 기준)

v0.2.0-c-r1 의 build 함수가 만든 payload 가 `WS3_FeaturePayload.isValid(payload) === true` 가 되려면 다음을 모두 만족해야 한다:

**Object 검사 항목**
- `payload.identity` is object
- `payload.candles` is object
- `payload.indicators` is object
- `payload.structure` is object
- `payload.volume` is object
- `payload.momentum` is object
- `payload.marketContext` is object
- `payload.buyPressure` is object
- `payload.risk` is object
- `payload.raw` is object

**String 검사 항목**
- `payload.identity.exchange` is string
- `payload.identity.quote` is string
- `payload.risk.level` is string

**Array 검사 항목**
- `payload.candles.m5` is Array
- `payload.candles.m15` is Array
- `payload.candles.h1` is Array
- `payload.candles.h4` is Array
- `payload.candles.d1` is Array
- `payload.risk.flags` is Array

**미검사 항목 (있어도/없어도 통과)**
- `payload.ts`
- `payload.coinMeta`
- `payload.newsContext`
- `payload.identity.base`
- `payload.identity.market`
- `payload.identity.displayName`
- `payload.risk.penalty`

**시사점**:
- builder 가 13개 top-level field 모두 채우는 게 안전(권장).
- 미검사 항목이라도 createEmpty 의 default 값을 따르는 것이 정합성 차원에서 유리.

---

# §8. DECISION_PENDING (본 b-r2 에서 결정 X)

| ID | 항목 | 처리 |
|---|---|---|
| **DP-1** | `payload.ts` 의 값 결정 (Date.now / 마지막 candle ts / 호출자 명시 / null 유지) | v0.2.0-c-r1 에서 결정 |
| **DP-2** | tradeValue 외 거래대금 키의 노출 정책 (normalizer side) | 별도 결정 |
| **DP-3** | v0.2.0-c-r1 builder 의 배치 방식 (별도 파일 / v3-feature-payload.js 의 build 수정 / 혼합) | v0.2.0-c-r1 작업지시서에서 결정 |

### DP-1 후보

```text
DP-1-A: 호출 시각 Date.now()
DP-1-B: 입력 candles[-1].ts (마지막 candle 의 ts)
DP-1-C: 호출자가 input.ts 로 명시한 값
DP-1-D: null 유지 (validator 미검사)
```

### DP-3 후보

```text
DP-3-A: 별도 파일 /v3/v3-feature-payload-builder.js 신규 생성
        + v3-feature-payload.js 의 WS3_FeaturePayload.build 는 throw 상태 유지
        → 보호 파일 무손상

DP-3-B: v3-feature-payload.js 내부의 build 함수에 구현 채워 넣기
        → 보호 파일 수정 (별도 승인 필요)

DP-3-C: 별도 builder 파일 + v3-feature-payload.js 의 build 가 builder 호출
        → 보호 파일 수정 (별도 승인 필요)
```

본 b-r2 는 위 세 항목 모두 **결정하지 않고 박제만** 한다.

---

# §9. 미확인 항목 (Gate 1 미보고 — 다음 단계 추가 grep)

```text
- v3-config.js 전체 (export 스타일 / buyPressure 정책값 / 키 목록)
- v3-bithumb-client.js 의 market 문자열 형식 / 메타 채우기 호출 흐름 / export 스타일
- v3-candle-normalizer.js 의 ts/tradeValue 외 필드 키 (open/high/low/close/volume 의 정확한 키명) / export 스타일
- indicators / structure / volume / momentum / raw 슬롯의 실제 빌더 입력 형식
  (createEmpty 는 빈 object 로 박제됨 — §1.7 / §1.9)
```

위 항목은 v0.2.0-c-r1 작업지시서 작성 시 추가 grep 으로 해소.

---

# §10. 본 문서의 활용

```text
- v0.2.0-c-r1 buildFeaturePayload 재작성:
    §7 (isValid 통과 조건) 을 단일 기준으로 사용
    §1.2 (createEmpty default) 를 그대로 따름
    §1.4 / §1.5 / §1.6 (ts / identity / candles 구조)
    DP-1 / DP-2 / DP-3 는 작업지시서에서 결정

- v0.3.x scoreBreakdown 본체:
    §1.7 / §1.8 슬롯 구조
    필요 시 b-r3 등으로 추가 grep 박제

- 백서와 충돌 시:
    본 문서 우선. 백서는 v0.3.4+ 패치로 정합화.
```

---

# §11. 한 줄 결론

```text
v3-feature-payload.js 의 createEmpty 초기값은 §1.2 에 명시되어 있으며,
isValid() 는 §7 의 항목만 검사한다.
미검사 항목(ts / coinMeta / newsContext / identity.base/market/displayName / risk.penalty)도
builder 는 createEmpty default 를 따라 채우는 게 안전하다.
모든 미결정 사항(DP-1/DP-2/DP-3)은 본 문서에 명시되어 있으며,
v0.2.0-c-r1 작업지시서가 이를 단일 기준으로 사용한다.
```
