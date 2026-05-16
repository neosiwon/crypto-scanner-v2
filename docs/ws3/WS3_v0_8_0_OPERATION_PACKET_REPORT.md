# WS3 v0.8.0 — OperationPacket 완료 보고

**작성일**: 2026-05-16
**branch**: `claude/heuristic-cori-7865e7`
**이전 functional baseline**: WS3 v0.7.0 cardViewModel (`7e2ef36`)
**본 단계 산출**: `v3/v3-operation-packet.js` (신규)

---

## 1. 단계 개요

- 입력 6종 (`payload` / `scoreBreakdown` / `structureDecision` / `signalCycle` / `strategyPlan` / `cardViewModel`) → standalone `operationPacket` (transport-ready 데이터. transport 자체 아님)
- 모듈 식별자: `WS3_OperationPacket`
- 버전: `OPERATION_PACKET_VERSION = 'WS3_v0.8.0'`
- export 패턴: `global.WS3_OperationPacket = Object.freeze(api)` + `module.exports = api` (이중 환경)
- IIFE / `'use strict'` / `var`-style (v0.7.0 cardViewModel 동일 스타일)

---

## 2. 출력 구조

```text
operationPacket = {
  valid,                  // boolean
  version,                // 'WS3_v0.8.0'
  candidateKey,           // signalCycle.candidateKey 복사 (DP-OP12)
  identity: {             // 6-field (U-OP-1 Option A field-by-field fallback)
    exchange, market, base, quote, displayName, timeframe
  },
  routing: {              // DP-OP4/5/6
    shouldNotify, shouldSnapshot, shouldEvaluate,
    notificationChannel, snapshotBucket, evaluationWindow,
    reasons, warnings
  },
  notificationPacket: {   // §7-9
    valid, type, severity, title, summary,
    lines, chips, metrics, safeHints,
    reasons, warnings
  },
  snapshotPacket: {       // §10-11
    valid, snapshotType, snapshotKey, timestamp,
    identity, state, scores, structure, cycle, strategy, view,
    reasons, warnings
  },
  evaluationSeed: {       // §12-13
    valid, evaluationType, startTs, horizon, baselinePrice,
    targetHints, invalidationHints, expectedFields,
    reasons, warnings
  },
  displaySummary: {       // §19
    title, subtitle, primaryBadge, tone
  },
  reasons, warnings,
  debug: { source, configVersion },
  configUsed: { routing, notification, snapshot, evaluation, safety, debug }
}
```

---

## 3. DP-OP 정책 적용 (12개 모두 적용)

| ID | 정책 | 구현 |
|---|---|---|
| **DP-OP1** | standalone 반환. 6종 입력 mutate / delete 금지 | S1~S5 smoke 에서 5종 시나리오 mutation 검증 (`JSON.stringify(before) === JSON.stringify(after)`) |
| **DP-OP2** | side-effect 금지 (외부 전송 / 영속 저장 / network / DOM / browser storage) | network / persistence / DOM API 호출 0건. 본 모듈은 packet 객체 산출만 |
| **DP-OP3** | routing + notificationPacket + snapshotPacket + evaluationSeed + displaySummary 구조 | `normalizeOperationPacket()` 가 5대 영역 + identity + reasons/warnings/debug/configUsed 출력 |
| **DP-OP4** | shouldNotify 기본 false. enable && valid && type != NONE | `DEFAULT_OPERATION_PACKET_CONFIG.routing.enableNotificationCandidate = false`. Extra-C smoke 검증 |
| **DP-OP5** | shouldSnapshot 기본 true. enable && valid && type != NONE | `enableSnapshotCandidate = true`. invalid 시 false (S9). NONE type 시 false (S6 valid 시 true) |
| **DP-OP6** | shouldEvaluate 기본 true. enable && valid && type != NONE | `enableEvaluationSeed = true`. S3/S5 BLOCKED/EXPIRED 시 false. S8 PLAN_24H 시 true |
| **DP-OP7** | evaluationSeed 포함 (seed-only) | `buildEvaluationSeed()` 산출. 실제 평가 결과 / 수익률 / 성공률 계산 0건 |
| **DP-OP8** | baselinePrice numeric only. object/range/string skip | `isNumericPrice(v)` = `typeof v === 'number' && isFinite(v) && v > 0`. fallback chain: referencePrice → entryZone (numeric) → last close → null. Extra-A smoke 에서 object entryZone 가 skip 되고 last close 로 fallback 검증 |
| **DP-OP9** | safeHints numeric hint 허용. 매수가/손절가/익절가 라벨 금지 | `HINT_LABEL` 정의: '참고 구간' / '무효화 기준' / '목표 힌트' / '손익비 힌트' 만. notificationPacket.safeHints / evaluationSeed.targetHints / evaluationSeed.invalidationHints 에서 사용 |
| **DP-OP10** | raw payload / payload.raw / builderDebug 전체 / identityInput / candle raw array 직접 노출 금지 | `getOperationIdentity()` 가 field-by-field scalar 추출만. `getPrimaryTimeframe()` 가 `payload.raw.builderDebug.primaryTimeframe` 단일 string scalar read (DP-UI8 패턴 그대로). identityInput / candles raw array 노출 0건 |
| **DP-OP11** | 등급 코드 외부 노출 금지 | 등급 코드 / tier 라벨 산출 0건. planQualityTier 는 메타 토큰 (v0.6.0 정합) |
| **DP-OP12** | candidateKey 재계산 금지. signalCycle.candidateKey 복사 | `getCandidateKey(signalCycle)` 는 `signalCycle.candidateKey` string verbatim 복사 (line 333-340). v0.5.0 `getCandidateKey(payload, structureDecision, cfg)` 재호출 0건. S1 smoke 에서 `op.candidateKey === sc.candidateKey` 검증 |

## 4. U-OP-1 ~ U-OP-3 확정 처리

| ID | 확정 | 구현 |
|---|---|---|
| **U-OP-1** identity merge | Option A — field-by-field fallback | `getOperationIdentity()` 6-field 별 fallback chain: exchange(payload.identity) → market(cvm→payload→null) → base(payload→cvm.symbol→null) → quote(payload) → displayName(payload→cvm.title→cvm.symbol→null) → timeframe(cvm→payload.raw.builderDebug.primaryTimeframe→'h1'). Extra-B smoke 검증 |
| **U-OP-2** timestamp/startTs/snapshotKey ts 기준 | Option A — payload.ts only | `getCurrentTs(payload)` 는 `payload.ts` 가 numeric && finite 면 그대로, 아니면 null. primary candle ts 재해석 0건. Extra-D smoke 에서 payload.ts=null → snapshotKey/timestamp/startTs 모두 null 검증 |
| **U-OP-3** isSameCandidate 방어 | defensive check | `classifySnapshotType()` step 4: `var sameCandidateFalse = !!persistence && persistence.isSameCandidate === false`. persistence 부재 / malformed 시 throw 없이 다음 step 으로 진행. S7 smoke 에서 persistence 정상 / isSameCandidate=false / bucketTransition 세 패턴 모두 STATE_CHANGE 분류 검증 |

## 5. 분류 우선순위 적용

### notificationType (§7 6-step)
S1 READY / S2 WATCH / S3 BLOCKED / S4 COOLDOWN / S5 EXPIRED / S9 NONE — 모두 우선순위 정합. 동시 match 위험 0건 (각 step early return).

### snapshotType (§10 7-step)
S4 COOLDOWN / S5 EXPIRED / S6 CANDIDATE / S7 STATE_CHANGE (×3 trigger 패턴) / S9 NONE — 우선순위 정합. U-OP-3 defensive check 적용.

### evaluationType (§12 5-step)
S3 NONE (BLOCKED) / S4 COOLDOWN_REVIEW / S5 EXPIRED_REVIEW / S8 PLAN_24H / S2 WATCH_24H / S9 NONE — 우선순위 정합.

## 6. baselinePrice fallback chain (DP-OP8)

```text
1. strategyPlan.entryPlan.referencePrice  (isNumericPrice 통과 시 사용)
2. strategyPlan.entryPlan.entryZone       (isNumericPrice 통과 시 사용. object/range/string skip)
3. payload.candles[primaryTimeframe] 마지막 close
4. null
```

검증:
- **S8** referencePrice=112 → 사용 → `baselinePrice === 112` ✅
- **Extra-A** referencePrice=null + entryZone={low,high} object → skip → last close=112 사용 → `baselinePrice === 112` ✅
- **S9** null inputs → null ✅

## 7. snapshotKey 정책

```text
snapshotKey = signalCycle.candidateKey + ':' + payload.ts
조건:
  signalCycle.candidateKey string 필요
  payload.ts numeric && isFinite 필요
  둘 중 하나라도 부재 → snapshotKey = null
  Date.now 사용 0건
```

검증:
- **S6** 정상 → `snapshotKey === 'BITHUMB:KRW-BTC:h1:BOX_TOP:1700000000000'` ✅
- **Extra-D** payload.ts=null → `snapshotKey === null`, `timestamp === null`, `startTs === null` ✅

## 8. safeHints / HINT_LABEL 정책 (DP-OP9)

| HINT_LABEL key | ko | en | source |
|---|---|---|---|
| `REFERENCE_ZONE` | 참고 구간 | Reference Zone | `strategyPlan.entryPlan.entryZone` |
| `INVALIDATION_LEVEL` | 무효화 기준 | Invalidation Level | `strategyPlan.entryPlan.setupInvalidationHint` / `strategyPlan.exitPlan.invalidationHint` |
| `TARGET_HINT` | 목표 힌트 | Target Hint | `strategyPlan.exitPlan.targetHint` |
| `RISK_REWARD_HINT` | 손익비 힌트 | Risk/Reward Hint | `strategyPlan.exitPlan.riskRewardHint` |

매수가 / 손절가 / 익절가 / 진입가 라벨 산출 0건 (구버전 라벨 grep 검증).

## 9. smoke test 결과 (14 시나리오 모두 통과)

| # | 시나리오 | 핵심 검증 |
|---|---|---|
| S1 | ready notification candidate | notificationPacket.type=READY / shouldNotify default=false / candidateKey === sc.candidateKey / 6종 mutation=0 |
| S2 | watch candidate | notificationPacket.type=WATCH / evaluationType=WATCH_24H / horizon=24H |
| S3 | blocked risk | notificationPacket.type=BLOCKED / evaluationType=NONE / shouldEvaluate=false |
| S4 | cooldown | notification COOLDOWN / snapshot COOLDOWN / evaluation COOLDOWN_REVIEW / horizon=NONE |
| S5 | expired | notification EXPIRED / snapshot EXPIRED / evaluation EXPIRED_REVIEW |
| S6 | snapshot candidate | snapshot.snapshotType=CANDIDATE / valid=true / shouldSnapshot=true / snapshotKey 에 payload.ts 포함 |
| S7 | state change | snapshot.snapshotType=STATE_CHANGE 3 패턴 (STRENGTHENING / isSameCandidate=false / bucketTransition) |
| S8 | evaluation seed | evaluation valid / type=PLAN_24H / horizon=24H / shouldEvaluate=true / evaluationWindow=24H / baselinePrice=112 (referencePrice) / targetHints/invalidationHints 존재 / expectedFields 길이 4 |
| S9 | null / invalid inputs | valid=false / candidateKey=null / 모두 NONE / shouldX 모두 false / PAYLOAD_NOT_OBJECT 워닝 / identity.timeframe default 'h1' |
| Extra-A | baselinePrice numeric only | object entryZone skip → last close fallback (112) |
| Extra-B | identity field-by-field fallback | 6-field 정확히 채워짐 (exchange/base/quote/displayName from payload.identity, timeframe from cardViewModel.identity) |
| Extra-C | shouldNotify default false | 기본 false / enableNotificationCandidate=true 시 true / notificationChannel=TELEGRAM_CANDIDATE |
| Extra-D | snapshotKey null when ts missing | payload.ts=null → snapshotKey/timestamp/startTs 모두 null |
| Extra-E | frozen input safety | deepFreeze 6종 입력에 대해 throw 없이 build 성공 |

(smoke 파일 `_ws3_v080_smoke.js` 는 검증 후 worktree 에서 제거. repo 영구 박제 X)

## 10. 금지 패턴 grep 결과

| 패턴 | 결과 | 비고 |
|---|---|---|
| `(^\|[^A-Za-z0-9_])P-(S\|A\|B)([^A-Za-z0-9_]\|$)` | **0건** ✅ | 코드 침범 0건. 정책 주석에서도 등급 토큰 literal 회피 |
| `Telegram\|sendTelegram\|telegramFetch\|botToken\|chatId\|KV.\|DB\|database\|snapshot save\|.put(\|.post(\|fetch(\|XMLHttpRequest` | line 44 헤더 주석 1건 (`KV / DB`) | DP-OP2 정책 명시 ("영속 저장 (KV / DB / 파일 IO / 브라우저 storage)"). false-positive |
| `innerHTML\|document.\|addEventListener\|localStorage\|sessionStorage\|Date.now(` | **0건** ✅ | 런타임 clock API / DOM / storage literal 0건 |
| `payload.X = ...` mutation | **0건** ✅ | DP-OP1 |
| `scoreBreakdown.X = ...` / `structureDecision.X = ...` / `signalCycle.X = ...` / `strategyPlan.X = ...` / `cardViewModel.X = ...` | **0건** ✅ | DP-OP1 |
| `delete <input>.X` | **0건** ✅ |  |
| `매수하세요/매도하세요/...` 명령 어조 | line 49 헤더 주석 1건 (정책 금지 명시) | false-positive |
| `payload.raw\|identityInput\|raw.builderDebug` (필드 노출 위험) | 정책 주석 4건 (line 29-30, 51-52), `getPrimaryTimeframe()` scalar read 4건 (line 313-317), `getOperationIdentity` 주석 1건 (line 376) | **raw 객체 / identityInput 객체 전체 노출 0건**. `payload.raw.builderDebug.primaryTimeframe` 은 string scalar read 만 (DP-UI8 / v0.7.0 패턴 그대로) |
| `secret\|token\|chatId\|botToken\|apiKey` | **0건** ✅ |  |

## 11. 보호 파일 diff 검증

`git diff --stat HEAD -- <protected16>` = 빈 출력 ✅

```text
v3/v3-config.js / v3-feature-payload.js / v3-bithumb-client.js /
v3-candle-normalizer.js / v3-indicators.js / v3-feature-payload-builder.js /
v3-score-breakdown.js / v3-structure-bucket.js / v3-signal-cycle.js /
v3-strategy-plan.js / v3-card-view-model.js                                → 0 변경
docs/ws3/WS3_CODE_CONTRACT.md (b-r2 박제) /
docs/ws3/WS3_WORKFLOW_TEMPLATE.md (v0.1 박제)                              → 0 변경
index.html / manifest.json / service-worker.js                            → 0 변경
```

신규 / 변경 파일 (이번 단계):
- `v3/v3-operation-packet.js` (신규, untracked)
- `docs/ws3/WS3_v0_8_0_OPERATION_PACKET_REPORT.md` (신규, untracked, 본 파일)
- `docs/ws3/WS3_CHANGELOG.md` (modified — `[v0.8.0]` 엔트리 상단)
- `docs/ws3/WS3_CURRENT_BASELINE.md` (modified — v0.8.0 baseline)

`.claude/` 는 untracked 유지 (commit 대상 아님).

## 12. 의도된 미구현 (이번 단계 제외)

- 실제 외부 전송 (Telegram bot / push / message channel)
- 영속 저장 (KV / DB / 파일 IO / 브라우저 storage)
- network 호출 / XHR / 외부 fetch
- 평가 결과 계산 (returnPct / maxDrawdownPct / reachedTarget / invalidated)
- 24h / 7d outcome 산출
- DOM / 렌더 / HTML 생성
- 등급 코드 / tier 산출
- 런타임 clock API 사용
- bot 식별 시크릿 / 채널 식별자 / API 키 산출

## 13. 다음 단계

```text
WS3 v0.9.0+ — Phase 4-5 (백서 §21)
  - 외부 데이터 합류 (externalConfluence)
  - LW activeCycle tracker
  - 사후평가 보정 분석

(별도) v0.8.x transport 단계 — 실제 외부 전송 / KV 저장 / 평가 실행은 별도 단계로 분리
(별도) v0.7.x renderer 단계 — DOM 렌더는 별도 단계
```

## 14. 기준 commit

- branch: `claude/heuristic-cori-7865e7`
- 이전 functional baseline: WS3 v0.7.0 cardViewModel (`7e2ef36`)
- 본 commit: (push 후 기록)

## 15. 핵심 메모

```text
- v3/v3-operation-packet.js 신규 생성 1건
- 보호 파일 16종 모두 무손상 (v3 *.js 11종 + index/manifest/sw 3종 + CODE_CONTRACT + WORKFLOW_TEMPLATE)
- WS3_CODE_CONTRACT.md 미수정 (b-r2 박제본 그대로)
- WS3_WORKFLOW_TEMPLATE.md 미수정 (v0.1 박제본 그대로)
- DP-OP1 ~ DP-OP12 모두 적용 / 미해결 항목 0건
- 6종 입력 mutation 0건 (DP-OP1, S1 smoke 검증)
- DP-OP3 출력 7대 영역 (routing/notificationPacket/snapshotPacket/evaluationSeed/displaySummary + identity + candidateKey)
- DP-OP4 shouldNotify 기본 false (Extra-C 검증)
- DP-OP5/6 shouldSnapshot/shouldEvaluate 기본 true, invalid/NONE 시 false
- DP-OP8 baselinePrice numeric only fallback chain (Extra-A 검증)
- DP-OP9 safeHints 안전 라벨만 (HINT_LABEL 4종)
- DP-OP10 raw payload / identityInput 직접 노출 0건. primaryTimeframe scalar read 만 허용
- DP-OP11 등급 코드 산출 0건
- DP-OP12 candidateKey 재계산 0건 (signalCycle.candidateKey 그대로 복사)
- U-OP-1 Option A: 6-field field-by-field fallback (Extra-B 검증)
- U-OP-2 Option A: payload.ts only (Extra-D 검증)
- U-OP-3: persistence && persistence.isSameCandidate === false defensive check (S7 검증)
- 외부 전송 / 영속 저장 / network fetch / DOM / storage / clock API 모두 0건
- frozen input 안전성 검증 (Extra-E)
```
