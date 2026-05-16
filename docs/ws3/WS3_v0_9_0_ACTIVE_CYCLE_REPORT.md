# WS3 v0.9.0 — ActiveCycle / Packet Lifecycle 완료 보고

**작성일**: 2026-05-16
**branch**: `claude/heuristic-cori-7865e7`
**이전 functional baseline**: WS3 v0.8.0 operationPacket (`2fb95cf`)
**본 단계 산출**: `v3/v3-active-cycle.js` (신규)

---

## 1. 단계 개요

- 입력 2종 (`operationPacket` (v0.8.0 산출) + `previousOperationState` (caller 주입, v0.9.0 nextState 형식)) → standalone `activeCycleDecision` (lifecycle decision 데이터. state store 아님)
- 모듈 식별자: `WS3_ActiveCycle`
- 버전: `ACTIVE_CYCLE_VERSION = 'WS3_v0.9.0'`
- export 패턴: `global.WS3_ActiveCycle = Object.freeze(api)` + `module.exports = api` (이중 환경)
- IIFE / `'use strict'` / `var`-style (v0.7.0 / v0.8.0 동일 스타일)

---

## 2. 출력 구조 (U-AC-3 — Gate 2 spec top-level shape)

```text
activeCycleDecision = {
  valid, version, candidateKey,
  identity: { exchange, market, base, quote, displayName, timeframe },   // 6-field (operationPacket.identity 그대로)
  lifecycle: {
    active, lifecycleState, lifecyclePhase,
    firstSeenTs, lastSeenTs, ageMs, seenCount
  },
  transition: {
    type, fromState, toState,
    isNewCandidate, isSameCandidate, isCandidateChanged, isStateChanged,
    isStrengthening, isWeakening, isDuplicateSuppressed
  },
  routingDecision: {
    allowNotify, allowSnapshot, allowEvaluate,
    suppressNotify, suppressReason,
    snapshotMode, evaluationMode
  },
  notifyPolicy: {
    canNotify, notificationType,
    notifyCooldownActive, signalCooldownActive,        // DP-AC14 분리
    duplicateSuppressed, lastNotifyTs, nextAllowedNotifyTs,
    reasons, warnings
  },
  snapshotPolicy: { canSnapshot, snapshotType, snapshotMode, reasons, warnings },
  evaluationPolicy: { canEvaluate, evaluationType, evaluationMode, reasons, warnings },
  nextState: {
    valid, version, candidateKey, identity,
    lifecycle: { firstSeenTs, lastSeenTs, lastNotifyTs, lastSnapshotTs, lastEvaluationTs,
                 seenCount, notifyCount, snapshotCount, evaluationCount,
                 ageMs, lifecycleState, lifecyclePhase },
    lastPacketSummary,
    notifyCooldown: { active, lastNotifyTs, nextAllowedNotifyTs },
    signalCooldown: { active },
    expiry: { expired, firstSeenTs, expireAfterMs },
    reasons, warnings
  },
  reasons, warnings,
  debug: { source, configVersion },
  configUsed: { notify, lifecycle, snapshot, evaluation, debug }
}
```

---

## 3. 적용된 DP-AC 정책 (14개 모두 적용)

| ID | 정책 | 구현 |
|---|---|---|
| **DP-AC1** | standalone 반환. 입력 2종 mutate / delete 금지 | S1 smoke 에서 mutation=0 검증 (`JSON.stringify(before) === JSON.stringify(after)`). `operationPacket.X = / previousOperationState.X = / delete ...` grep 0건 |
| **DP-AC2** | side-effect 금지 (외부 전송 / 영속 저장 / network / DOM / 브라우저 storage) | network / persistence / DOM / storage / clock literal 코드 침범 0건 |
| **DP-AC3** | previousOperationState caller 주입. v0.9.0 직접 읽기 X | `normalizePreviousState()` 가 caller 주입 객체를 read-only 정규화 |
| **DP-AC4** | operationPacket.candidateKey 만 사용. 재계산 금지 | `getCandidateKey(operationPacket)` = `operationPacket.candidateKey` verbatim. exchange/market/timeframe/bucketFamily 재조립 0건 |
| **DP-AC5** | timestamp 기준: `snapshotPacket.timestamp → evaluationSeed.startTs → null`. 런타임 clock 금지 | `getCurrentTs()` 2단계 fallback. Date.now / new Date / performance.now 코드 0건 |
| **DP-AC6** | same candidate + no state change + suppressDuplicate → suppressNotify. currentTs 시 minIntervalMs 적용 | `buildNotifyPolicy()` 의 duplicate 분기 + `isNotifyCooldown()` time 분기. S3/S8 smoke 검증 |
| **DP-AC7** | canSnapshot / canEvaluate boolean 만 | snapshotPolicy.canSnapshot / evaluationPolicy.canEvaluate. 실제 저장/평가 코드 0건 |
| **DP-AC8** | nextState 포함. 저장은 후속 adapter | `buildNextState()` 산출. KV / DB / persistence write 0건 |
| **DP-AC9** | ranking helper. max(). 합산 X | `getStateStrength()` = max() over 5 sources. Extra-A smoke 검증 (sum 240 / avg 48 모두 불일치, max 70 일치) |
| **DP-AC10** | safe summary 만. raw / secret / identityInput / candle raw 저장 금지 | `getPacketSummary()` 가 operationPacket 의 safe 라벨 / scalar 만 추출. raw payload / identityInput 노출 0건 |
| **DP-AC11** | EXPIRED 1순위. expireAfterMs 보조. currentTs/firstSeenTs null 시 시간 기반 생략 | `classifyLifecycleState()` 1순위 = isExpiredByPacket. isExpiredByAge 는 currentTs && firstSeenTs 둘 다 finite 일 때만. S9/S10/S11 smoke 검증 |
| **DP-AC12** | lifecycleState 에 DUPLICATE / SUPPRESSED 금지 | LIFECYCLE_STATE enum 8 후보 (NONE/NEW/ACTIVE/PERSISTING/STRENGTHENING/WEAKENING/COOLDOWN/EXPIRED). DUPLICATE_SUPPRESSED 는 TRANSITION_TYPE 에서만. S1~S12 + Extra-B smoke 16개 케이스에서 검증 |
| **DP-AC13** | lifecyclePhase 7 후보. seenCount 우선. ageMs 보조 | `classifyLifecyclePhase()` seenCount 임계값 (≤2 EARLY / 3-6 ACTIVE / 7-12 MATURE / ≥13 LATE). ageMs ≥ lateAfterMs 시에도 LATE. S11 smoke 에서 currentTs null 시 ageMs 생략 검증 |
| **DP-AC14** | signalCooldown vs notifyCooldown 분리 | notifyPolicy.signalCooldownActive (operationPacket COOLDOWN) vs notifyPolicy.notifyCooldownActive (lastNotifyTs + minIntervalMs). nextState.signalCooldown vs nextState.notifyCooldown 분리. Extra-C smoke 2 케이스 (signal active+notify inactive / signal inactive+notify active) 검증 |

## 4. U-AC / N-AC-OBS 확정 처리

| ID | 확정 | 구현 |
|---|---|---|
| **U-AC-1** STRENGTHENING ranking source | Option A — `snapshotPacket.state.cycleState` / `snapshotPacket.cycle.cycleState` ranking source 추가 | `getPacketSummary()` cycleState 추출 + `STATE_STRENGTH.STRENGTHENING=70 / WEAKENING=-10` 키 활성화. Extra-A smoke 검증 |
| **U-AC-2** previous null/invalid count 시작값 | Option A — base zero state | `normalizePreviousState()` 가 null/invalid 입력에 대해 `{ seenCount: 0, notifyCount: 0, snapshotCount: 0, evaluationCount: 0 }` 반환. `buildNextState()` 에서 +1 → 첫 관측 seenCount=1. S1 smoke 검증 |
| **U-AC-3** activeCycleDecision top-level shape | Gate 2 spec 그대로 구현 | `normalizeActiveCycleDecision()` 가 valid / version / candidateKey / identity / lifecycle / transition / routingDecision / notifyPolicy / snapshotPolicy / evaluationPolicy / nextState / reasons / warnings / debug / configUsed 15-field 출력 |
| **N-AC-OBS-1** helper 이름 회피 | `isActiveLifecycleState` 사용 (v3-signal-cycle.js `isActiveCycleState` 와 분리) | line 316 helper 정의 + line 45 / 316 정책 comment. v3-signal-cycle.js helper 와 module scope 별도 |
| **N-AC-OBS-2** 보호 파일 runtime clock / fetch literal | v0.2.0-a baseline 보호 파일 책임. 본 모듈 침범 금지 | v3-active-cycle.js 에 Date.now / new Date / performance.now / fetch / XMLHttpRequest / localStorage / sessionStorage / document. / addEventListener / innerHTML 코드 침범 0건 |

## 5. lifecycleState 분류 우선순위 (Gate 2 §4)

```text
1. EXPIRED       — isExpiredByPacket(currentSummary) OR isExpiredByAge(prev, currentTs, cfg)
2. COOLDOWN      — isSignalCooldown(currentSummary)
3. NEW           — !prevValid OR (prev.candidateKey !== current.candidateKey)
4. STRENGTHENING — sameCandidate && current strength > previous strength
5. WEAKENING     — sameCandidate && current strength < previous strength
                   OR current.notificationType === BLOCKED
6. PERSISTING    — sameCandidate && prevSummary 존재
7. ACTIVE        — fallback (no prevSummary 인 경우 fallthrough)
8. NONE          — invalid / no candidate
```

DP-AC12 정합: DUPLICATE / SUPPRESSED 사용 0건. S1~S12 + Extra-B smoke 16 케이스에서 확인.

## 6. transition 분류 우선순위 (Gate 2 §6 — 11-step)

```text
1. EXPIRED              — lifecycleState === EXPIRED
2. COOLDOWN_ENTERED     — current COOLDOWN && prev !== COOLDOWN
3. COOLDOWN_CONTINUED   — current COOLDOWN && prev === COOLDOWN
4. NEW_CANDIDATE        — !prevValid && current.candidateKey valid
5. CANDIDATE_CHANGED    — prevValid && both valid && key 다름
6. STRENGTHENED         — same candidate && current strength > previous strength
7. WEAKENED             — same candidate && current strength < previous strength (or BLOCKED)
8. STATE_CHANGED        — same candidate && summary 변경
9. DUPLICATE_SUPPRESSED — same candidate && no state change && notify suppressed (DP-AC6)
10. SAME_CANDIDATE      — same candidate (no state change, no suppression)
11. NONE                — fallback
```

DUPLICATE_SUPPRESSED 는 transition 에만 허용 (lifecycleState 에는 금지 — DP-AC12).

## 7. lifecyclePhase 분류 (Gate 2 §5 / DP-AC13)

```text
CLOSED  — lifecycleState === EXPIRED
NEW     — lifecycleState === NEW
EARLY   — seenCount ≤ 2 && state in [ACTIVE/PERSISTING/STRENGTHENING]
ACTIVE  — 3 ≤ seenCount ≤ 6 && state in [ACTIVE/PERSISTING/STRENGTHENING/WEAKENING]
MATURE  — 7 ≤ seenCount ≤ 12 && state in [ACTIVE/PERSISTING/STRENGTHENING/WEAKENING]
LATE    — seenCount ≥ 13 OR ageMs ≥ cfg.lifecycle.lateAfterMs
NONE    — fallback / COOLDOWN / invalid
```

currentTs null 시 ageMs 기반 LATE 분기 생략. seenCount 만 사용. S11 smoke 검증.

## 8. cooldown 분리 (DP-AC14)

| 항목 | signalCooldown | notifyCooldown |
|---|---|---|
| 출처 | operationPacket.notificationPacket.type === COOLDOWN OR evaluationSeed.evaluationType === COOLDOWN_REVIEW | previousOperationState.lifecycle.lastNotifyTs + cfg.notify.minIntervalMs + currentTs |
| 의미 | 후보/신호 자체 쿨다운 (v0.5.0 signalCycle 결정) | 같은 후보의 중복 알림 억제 정책 (운영 정책) |
| 출력 위치 | notifyPolicy.signalCooldownActive / nextState.signalCooldown.active | notifyPolicy.notifyCooldownActive / nextState.notifyCooldown.active |
| suppressReason | `'SIGNAL_COOLDOWN'` | `'NOTIFY_COOLDOWN'` |

Extra-C smoke 에서 둘이 독립적으로 동작하는 것 검증 (signal active+notify inactive / signal inactive+notify active 2 케이스).

## 9. state strength ranking (DP-AC9 / U-AC-1)

```text
EXPIRED:       -100
COOLDOWN:       -50
BLOCKED:        -30
WEAKENING:      -10
NONE:             0
WATCH:           10
WATCH_24H:       15
READY:           30
PLAN_24H:        40
STATE_CHANGE:    45
PLAN_WEAK:       45
PLAN_STRONG:     55
PLAN_PREMIUM:    65
STRENGTHENING:   70
```

source 5종 (max):
- notificationPacket.type
- evaluationSeed.evaluationType
- snapshotPacket.snapshotType
- snapshotPacket.strategy.planQualityTier
- snapshotPacket.state.cycleState / snapshotPacket.cycle.cycleState (U-AC-1 Option A 추가)

매매 점수 / 알림 등급 아님. 운영 상태 비교용 내부 순위. 합산 / 평균 0건 (Extra-A smoke 검증).

## 10. smoke test 결과 (16 시나리오 모두 통과)

| # | 시나리오 | 핵심 검증 |
|---|---|---|
| S1 | new candidate | previousOperationState=null → lifecycleState=NEW / transition=NEW_CANDIDATE / seenCount=1 (U-AC-2 base zero) / mutation=0 |
| S2 | same candidate persisting | suppressDuplicate=false 시 lifecycleState=PERSISTING / seenCount += 1 |
| S3 | duplicate suppressed | suppressDuplicate=true 시 duplicateSuppressed=true / suppressNotify=true / suppressReason=DUPLICATE / canNotify=false |
| S4 | candidate changed | 다른 candidateKey → CANDIDATE_CHANGED transition / NEW lifecycle |
| S5 | strengthening | strength 70 > 15 → lifecycleState=STRENGTHENING / transition=STRENGTHENED |
| S6 | weakening / risk change | BLOCKED → lifecycleState=WEAKENING / transition=WEAKENED |
| S7 | signal cooldown | notificationType=COOLDOWN → signalCooldownActive=true / notifyCooldownActive=false / suppressReason=SIGNAL_COOLDOWN |
| S8 | notify cooldown | lastNotifyTs=1min ago → notifyCooldownActive=true / signalCooldownActive=false / suppressReason=NOTIFY_COOLDOWN |
| S9 | expired by packet | notificationType=EXPIRED → lifecycleState=EXPIRED / lifecyclePhase=CLOSED / notify blocked |
| S10 | expired by age | firstSeenTs=25h ago → lifecycleState=EXPIRED (시간 기반) |
| S11 | no timestamp | currentTs=null → ageMs=null / notifyCooldownActive=false / nextAllowedNotifyTs=null. seenCount 증가 허용. throw 0 |
| S12 | invalid inputs | null operationPacket → valid=false / lifecycleState=NONE / OPERATION_PACKET_NOT_OBJECT 워닝 |
| Extra-A | state ranking max() | strength=70 (max from STRENGTHENING). sum=240 / avg=48 불일치 확인 |
| Extra-B | lifecycleState DUPLICATE/SUPPRESSED 미사용 | 4 케이스 모두 lifecycleState ∉ {DUPLICATE, SUPPRESSED} |
| Extra-C | cooldown 분리 (DP-AC14) | signal active+notify inactive / signal inactive+notify active 독립 동작 |
| Extra-D | frozen input safety | deepFreeze 2종 입력에 대해 throw 0 |

(smoke 파일 `_ws3_v090_smoke.js` 는 검증 후 worktree 에서 제거. repo 영구 박제 X)

## 11. 금지 패턴 grep 결과

| 패턴 | 결과 |
|---|---|
| `KV.\|DB\|Telegram\|sendTelegram\|fetch(\|XMLHttpRequest\|innerHTML\|document.\|addEventListener\|localStorage\|sessionStorage\|Date.now(\|new Date\|performance.now` | comment 2건 (line 47 N-AC-OBS-2 / line 52 DP-AC2 정책 명시) — **코드 침범 0건** ✅ |
| `operationPacket.X = / previousOperationState.X = mutation` | **0건** ✅ |
| `delete operationPacket. / delete previousOperationState.` | **0건** ✅ |
| `payload.raw / identityInput / raw.builderDebug / secret / token / chatId / botToken / apiKey` | comment 3건 (line 27 DP-AC10 / line 58-59 금지 명시) — **코드 침범 0건** ✅ |
| `매수하세요 / 매도하세요 / buy now / sell now / take profit / stop loss` | comment 1건 (line 57 금지 어조 명시) — **코드 침범 0건** ✅ |
| `lifecycleState 에 DUPLICATE / SUPPRESSED` | comment 1건 (line 31 DP-AC12 정책 명시) — **코드 침범 0건. LIFECYCLE_STATE enum 에 DUPLICATE/SUPPRESSED 부재** ✅ |
| `isActiveCycleState` (v3-signal-cycle.js 동명 helper) | comment 2건 (line 45 N-AC-OBS-1 / line 316 회피 명시) — **새 helper 이름은 `isActiveLifecycleState`** ✅ |

## 12. 보호 파일 diff 검증

`git diff --stat HEAD -- <protected17>` = 빈 출력 ✅

```text
v3/v3-config.js / v3-feature-payload.js / v3-bithumb-client.js /
v3-candle-normalizer.js / v3-indicators.js / v3-feature-payload-builder.js /
v3-score-breakdown.js / v3-structure-bucket.js / v3-signal-cycle.js /
v3-strategy-plan.js / v3-card-view-model.js / v3-operation-packet.js     → 0 변경
docs/ws3/WS3_CODE_CONTRACT.md (b-r2 박제) /
docs/ws3/WS3_WORKFLOW_TEMPLATE.md (v0.1 박제)                              → 0 변경
index.html / manifest.json / service-worker.js                            → 0 변경
```

신규 / 변경 파일 (이번 단계):
- `v3/v3-active-cycle.js` (신규, untracked)
- `docs/ws3/WS3_v0_9_0_ACTIVE_CYCLE_REPORT.md` (신규, untracked, 본 파일)
- `docs/ws3/WS3_CHANGELOG.md` (modified — `[v0.9.0]` 엔트리 상단)
- `docs/ws3/WS3_CURRENT_BASELINE.md` (modified — v0.9.0 baseline)

## 13. 의도된 미구현 (이번 단계 제외)

- KV / DB / 파일 IO / 브라우저 storage read/write
- 외부 전송 / 알림 발송 (별도 transport adapter)
- snapshot 실제 저장
- evaluation 실제 실행 / 24h / 7d outcome 계산
- DOM / 렌더 / UI 이벤트 연결
- 입력 2종 mutation
- 런타임 clock API 사용
- 등급 코드 산출 / 매매 점수 / 매매 권고
- bot 식별 시크릿 / 채널 식별자 / API 키

## 14. 기준 commit

- branch: `claude/heuristic-cori-7865e7`
- 이전 functional baseline: WS3 v0.8.0 operationPacket (`2fb95cf`)
- 본 commit: (push 후 기록)

## 15. 핵심 메모

```text
- v3/v3-active-cycle.js 신규 생성 1건 (1279 라인)
- 보호 파일 17종 모두 무손상 (v3 *.js 12종 + index/manifest/sw 3종 + CODE_CONTRACT + WORKFLOW_TEMPLATE)
- WS3_CODE_CONTRACT.md 미수정 (b-r2 박제본 그대로)
- WS3_WORKFLOW_TEMPLATE.md 미수정 (v0.1 박제본 그대로)
- DP-AC1 ~ DP-AC14 모두 적용 / 미해결 항목 0건
- 입력 2종 (operationPacket + previousOperationState) mutation 0건 (DP-AC1, smoke 검증)
- lifecycleState 8 후보 (NONE/NEW/ACTIVE/PERSISTING/STRENGTHENING/WEAKENING/COOLDOWN/EXPIRED). DUPLICATE/SUPPRESSED 0건 (DP-AC12)
- lifecyclePhase 7 후보 (NONE/NEW/EARLY/ACTIVE/MATURE/LATE/CLOSED). seenCount 우선 + ageMs 보조 (DP-AC13)
- transition 11 후보 (NONE/NEW_CANDIDATE/SAME_CANDIDATE/CANDIDATE_CHANGED/STATE_CHANGED/STRENGTHENED/WEAKENED/COOLDOWN_ENTERED/COOLDOWN_CONTINUED/EXPIRED/DUPLICATE_SUPPRESSED)
- candidateKey verbatim 복사 (DP-AC4, signalCycle → operationPacket → activeCycleDecision 연쇄)
- timestamp 기준: snapshotPacket.timestamp → evaluationSeed.startTs → null (DP-AC5)
- signalCooldown vs notifyCooldown 분리 (DP-AC14, Extra-C smoke 검증)
- state strength max() 사용 (DP-AC9 / U-AC-1, Extra-A smoke 검증 — sum/avg 불일치, max 일치)
- U-AC-1 Option A: snapshotPacket.state.cycleState / cycle.cycleState ranking source 추가
- U-AC-2 Option A: previous null = base zero state (seenCount=0). 첫 관측 seenCount=1
- U-AC-3: Gate 2 spec top-level shape 그대로
- N-AC-OBS-1: isActiveCycleState 회피 → isActiveLifecycleState 사용
- N-AC-OBS-2: Date.now / new Date / performance.now / fetch 코드 0건
- 외부 호출 / DOM / 브라우저 storage / KV / persistence 0건
- 런타임 clock API 사용 0건
- 실거래 / 주문 / 알림 / 렌더 / 등급 코드 / secret 0건
- frozen input 안전성 검증 (Extra-D)
```
