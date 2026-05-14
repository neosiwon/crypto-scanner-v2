# WS3 Current Baseline

> 현재 GitHub 박제 기준 (최신).  
> 다음 단계 작업 전에 이 파일로 baseline을 확인.

**최종 업데이트**: 2026-05-14  
**현재 단계**: WS3 v0.2.0-b 완료

---

## 완료된 단계

| 단계 | 파일 | 상태 |
|---|---|---|
| WS3 v0.1.0 | `/v3/v3-config.js` | ✅ 박제 |
| WS3 v0.1.0 | `/v3/v3-feature-payload.js` | ✅ 박제 |
| WS3 v0.2.0-a | `/v3/v3-bithumb-client.js` | ✅ 박제 |
| WS3 v0.2.0-a | `/v3/v3-candle-normalizer.js` | ✅ 박제 |
| **WS3 v0.2.0-b** | **`/v3/v3-indicators.js`** | **✅ 박제 (이번 단계)** |

---

## 기준 백서

```text
/docs/ws3/WOOS_Scanner_V3_개발백서_v0_3_3.md
```

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
/v3/v3-indicators.js              ← v0.2.0-b부터 추가
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
  → v3FeaturePayload 코드 계약에 맞게 조립

이번 단계 (v0.2.0-b)는 indicator snapshot까지만.
featurePayload 본체 조립은 v0.2.0-c에서.
```

---

## 아직 도래하지 않은 단계

```text
WS3 v0.2.0-c    buildFeaturePayload 본체
WS3 v0.3.x      scoreBreakdown / grade 산출
WS3 v0.4.0      structureBucket 최종 판정 / signalCycle / priceZone
WS3 v0.5.x      strategyBias / entryPlan / exitPlan A-F
WS3 v0.6.x+     Phase 4 — UI / Telegram / 빗썸 공식 externalConfluence
WS3 v0.7.x+     Phase 5 — LW activeCycle tracker / 사후평가 보정
```
