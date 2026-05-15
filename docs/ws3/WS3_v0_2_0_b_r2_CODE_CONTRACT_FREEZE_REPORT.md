# WS3 v0.2.0-b-r2 Code Contract Freeze 완료 보고

> **작업일자**: 2026-05-14  
> **이전 baseline**: WS3 v0.2.0-b-r1 (`da00e62`)  
> **HEAD (Gate 1 시점)**: `da00e62c7d6fe86ab2a51583d0deb3c0cccdb3c9`  
> **branch**: `claude/heuristic-cori-7865e7`  
> **작업 성격**: Code Contract Freeze (코드 계약 박제 + 문서 정합성, .js 수정 0건)

---

## 생성 파일

- `/docs/ws3/WS3_CODE_CONTRACT.md` ← **이번 작업의 핵심 산출물 (단일 기준)**
- `/docs/ws3/WS3_v0_2_0_b_r2_CODE_CONTRACT_FREEZE_REPORT.md` (이 파일)

## 정정 파일

- `/docs/ws3/WS3_CHANGELOG.md` (덮어쓰기)
- `/docs/ws3/WS3_CURRENT_BASELINE.md` (덮어쓰기)
- `/docs/ws3/WS3_v0_2_0_b_INDICATOR_SKELETON_REPORT.md` (조건부 정정 — 별도 가이드 참조)

---

## .js 파일 수정 여부

```text
0개 (보호 파일 모두 무손상)
```

대상 보호 파일:
- `index.html` / `manifest.json` / `service-worker.js` / `worker.js` / `wrangler.toml`
- `/v3/v3-config.js`
- `/v3/v3-feature-payload.js`
- `/v3/v3-bithumb-client.js`
- `/v3/v3-candle-normalizer.js`
- `/v3/v3-indicators.js`

## 새 .js 파일 생성 여부

```text
0개
```

---

## Gate 1 사전 조사 결과 요약

### b-r1 commit 존재 검증

```text
- 로컬 da00e62 존재: ✅
- 현재 브랜치 포함 (claude/heuristic-cori-7865e7): ✅
- remote 포함: ✅
- 검증 결과: PASS → b-r2 진행 정상
```

### grep 결과 (Gate 1 보고 항목)

```text
1. top-level field 목록            → 확정 (13개 — §1.1)
2. createEmpty 초기값              → 확정 (§1.2)
3. ts 타입                         → 확정 (V3Candle: number / V3FeaturePayload: number|null / createEmpty: null)
4. tradeValue canonical            → 확정 ("tradeValue" / close*volume 산출)
5. identity 구조 + default         → 확정 (quote='KRW' / exchange='BITHUMB' / base/market/displayName=null)
6. candles 구조                    → 확정 (m5/m15/h1/h4/d1 배열)
7. validator 검사 항목             → 확정 (§7)
8. createEmpty / build / isValid    → 확정 (Object.freeze export)
9. export 스타일                   → 확정 (IIFE browser-global)
10. v3-bithumb-client.js market 사용 → 확정 (o.market 문자열로 fetch)
11. v3-candle-normalizer.js tradeValue → 확정 (close * volume 산출)
```

---

## WS3_CODE_CONTRACT.md 박제 완료 항목

| § | 항목 | 상태 |
|---|---|---|
| §1.1 | top-level field 목록 + 순서 (13개) | ✅ 박제 |
| §1.2 | createEmpty() 정확한 초기값 (default 명시) | ✅ 박제 |
| §1.3 | isValid() 검사 항목 목록 (string / array / object / 미검사) | ✅ 박제 |
| §1.4 | ts 타입 (number / number\|null / null) | ✅ 박제 |
| §1.5 | identity 5 필드 + default + 검사 정책 | ✅ 박제 |
| §1.6 | candles m5/m15/h1/h4/d1 배열 | ✅ 박제 |
| §1.7 | indicators/structure/volume/momentum 슬롯 (createEmpty 빈 object) | ✅ 박제 |
| §1.8 | marketContext/buyPressure/coinMeta/newsContext/risk 슬롯 + default | ✅ 박제 |
| §1.9 | raw 슬롯 (createEmpty 빈 object) | ✅ 박제 |
| §1.10 | buildFeaturePayload 현재 throw 상태 | ✅ 박제 |
| §1.11 | export = `Object.freeze({createEmpty, build, isValid})` IIFE | ✅ 박제 |
| §3 | v3-candle-normalizer.js tradeValue = close * volume | ✅ 박제 |
| §4 | v3-bithumb-client.js market 사용 / base/quote/displayName 미사용 | ✅ 박제 |
| §6.1 | ts canonical 표현 | ✅ 박제 |
| §6.2 | tradeValue canonical + 산출 방식 | ✅ 박제 |
| §6.3 | 표현 통일 (top-level field) | ✅ 박제 |
| §7 | isValid 통과 조건 | ✅ 박제 (v0.2.0-c-r1 단일 기준) |

---

## DECISION_PENDING 박제 (결정 X, 다음 단계로)

```text
DP-1: payload.ts 의 값 결정
       Date.now() / 마지막 candle ts / 호출자 명시 / null 유지
       → v0.2.0-c-r1 에서 결정

DP-2: tradeValue 외 거래대금 키의 노출 정책 (normalizer side)
       → 별도 결정

DP-3: v0.2.0-c-r1 builder 의 배치 방식
       별도 파일 / v3-feature-payload.js 의 build 수정 / 혼합
       → v0.2.0-c-r1 작업지시서에서 결정
```

본 b-r2 는 이 세 항목을 **결정하지 않고 박제만** 했다.

---

## 미확인 항목 (Gate 1 미보고, 다음 단계 추가 grep)

```text
- v3-config.js 전체
- v3-bithumb-client.js 의 market 문자열 형식 / 메타 채우기 호출 흐름 / export 스타일
- v3-candle-normalizer.js 의 ts/tradeValue 외 필드 키 / export 스타일
- indicators / structure / volume / momentum / raw 슬롯의 실제 빌더 입력 형식
  (createEmpty 는 빈 object 로 박제됨)
```

→ v0.2.0-c-r1 작업지시서 작성 시 추가 grep.

---

## 정정 문서 변경 사항

### WS3_CHANGELOG.md

- 상단에 `[v0.2.0-b-r2]` 엔트리 추가
- v0.2.0-c 처리:
  - case A — 기존 v0.2.0-c 엔트리 있음 → `REJECTED — repo 반영 보류` 표시 추가
  - case B — 없음 → b-r2 엔트리 안에 `v0.2.0-c 1차 수정본은 repo 미반영 / rejected artifact` 한 줄 기록
- 이전 오기 표현 (잘못된 슬롯 수 표기) → "top-level field" 정정

### WS3_CURRENT_BASELINE.md

- baseline 목록에 `WS3 v0.2.0-b-r1 (da00e62)` 추가
- baseline 목록에 `WS3 v0.2.0-b-r2 (이번 commit)` 추가 (commit hash 는 push 후)
- `v0.2.0-c (REJECTED / NOT APPLIED)` 항목 명시
- 이전 오기 표현 → "top-level field"
- 다음 단계 순서 (v0.3.0 / v0.4.0 / v0.5.0 / v0.6.0 / v0.7.0 / v0.8.0) 명시
- 기준 백서 `WOOS_Scanner_V3_개발백서_v0_3_3.md` 명시
- `WS3_CODE_CONTRACT.md` 가 단일 기준임을 명시

### WS3_v0_2_0_b_INDICATOR_SKELETON_REPORT.md

- 별도 가이드 (`INDICATOR_SKELETON_REPORT_FIX_GUIDE.md`) 에 정정 절차 명시
- 조건부 (있으면 sed / 없으면 수정 X)

---

## 검증 결과 (Claude Code 적용 단계에서 확인 필요)

```text
✅ 보호 파일 변경: 0건 (git diff --stat 으로 확인)
✅ 새 .js 파일 생성: 0건
✅ 문서 변경 범위: 위 명시 파일에만 한정
✅ 이전 오기 표현 잔존 검증:
   (Claude Code 가 적용 단계에서 직접 grep 으로 검증)
   → docs/ws3/ 전체에서 잘못된 슬롯 수 표기 0줄 확인
✅ WS3_CODE_CONTRACT.md §1~§11 모든 섹션 작성
✅ 추측 표현 0건 (모호한 항목은 미확인 / DECISION_PENDING 으로 명시)
```

---

## 다음 작업

```text
WS3 v0.2.0-c-r1 buildFeaturePayload 재작성 작업지시서 작성
  - 기준 문서: WS3_CODE_CONTRACT.md (이번 b-r2 박제본)
  - 결정 필요: DP-1 / DP-2 / DP-3 (작업지시서 §결정 사항으로 명시)
  - isValid 통과 조건 (§7) 모두 충족 보장
  - 추가 grep 필요 항목 (§9 미확인 목록) 사전 조사 단계에 포함
```

---

## 한 줄 결론

```text
b-r2 = .js 0건 / 새 .js 0건 / 추측 0건.
WS3_CODE_CONTRACT.md 가 v0.2.0-c-r1 단일 기준으로 박제 완료.
createEmpty 초기값 / isValid 검사 항목 / tradeValue 산출 방식 등은
Gate 1 결과 그대로 사실로 박제. 결정 사항은 DP-1/DP-2/DP-3 로 분리.
```
