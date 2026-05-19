# WS3 v0.31.1 — Natural Validation Stabilization Patch 완료 보고

**작성일**: 2026-05-19
**branch**: `claude/heuristic-cori-7865e7`
**이전 functional baseline**: WS3 v0.31.0 Web-first Minimum Operator Mode + Limited Live Operation Enabled (`70fac00`)
**본 단계 산출**: 2 Web Console 동기화 수정 + 1 신규 보고서 + 2 문서 갱신 (총 5 staged)

---

## 1. 목표

v0.31.0 production 운영 (`WS3_LIMITED_LIVE_ENABLED=true`) 상태에서 자연검증 중 즉시 식별된 운영 안정화 패치. 새 기능 추가 아님. 운영 가능한 최소 웹 콘솔의 첫 안정화 사이클.

```text
1. 40-market preset failCount 줄이기 (의심 8종 제거 → 32 markets)
2. disabled response UI safety fields fallback 표시 (= "-" → false 명시)
3. Worker 미수정 / Web Console fallback 만으로 해결
4. Cron / automatic alerts / candidate storage / tracking start 계속 disabled 유지
```

한 줄 정의: **v0.31.1 = web-only stabilization patch (preset trim + disabled fallback display).**

---

## 2. v0.31 운영 유지 상태 (재인용)

```text
WS3_LIMITED_LIVE_ENABLED=true (유지)
수동 운영자 검토 발송 가능
자동 알람 없음
Cron 없음
candidate 저장 없음
tracking 시작 없음
중복 guard 작동 확인
```

본 패치는 위 운영 상태를 그대로 두고 Web Console 동작만 보완한다.

---

## 3. 자연검증 발견사항

### 3.1 40-market preset failCount 이슈

```text
40-market preset scan:
code=MULTI_CANDIDATE_PARTIAL_OK
marketCount=40
okCount=19
failCount=21
candidateCount=0
```

failCount=21 → preset 내 KRW 마켓 중 약 절반이 Upbit candle fetch 실패. 운영자가 결과 카드를 검토하기 전에 fail 표시로 시야가 분산되는 UX 문제.

식별된 의심 후보 (사용자 지시서 §2.1 권장 목록 기준):

```text
KRW-MATIC, KRW-RENDER, KRW-JUP, KRW-ONDO, KRW-PEPE, KRW-BONK, KRW-TIA, KRW-PYTH
```

본 패치에서는 위 8종을 preset에서 제거한다 (40 → 32). 변수명 `WS3_OPERATOR_REVIEW_PRESET_40`은 코드 호환성을 위해 유지. UI button label "Load 40-market Upbit preset"은 정확도를 위해 "Load Upbit KRW preset"으로 갱신.

주의:

```text
- 특정 코인을 기준점 / 추천 종목으로 삼지 않는다.
- preset은 운영자 카드형 리뷰의 초기 목록일 뿐이다.
- maxMarkets cap=50 (worker MULTI_CANDIDATE_MAX_MARKETS / web validation / request) 모두 변경 없음.
- 자연검증 추가 fail 발견 시 후속 patch (v0.31.x)에서 점진 정리.
```

### 3.2 disabled response UI safety fields "-" 표시 이슈

```text
Limited Live disabled test:
code=LIMITED_LIVE_DISABLED
telegramSent=-
kvWritten=-
candidateStored=-
trackingStarted=-
```

원인: Worker가 503 / 403 / 400 / 401 / 429 / 502 등 error response에 `safety` 객체를 포함하지 않음 (200 LIMITED_LIVE_REVIEW_SENT 시에만 safety 동봉). Section 11 render는 `safety`가 없으면 모든 boolean 필드를 `null`로 두고 `setBoolField`가 "-"를 표시.

UX 문제: 운영자가 "-" 를 보고 "발송이 일어났는지 안 일어났는지 불확실하다"고 오해할 가능성. error response는 워커가 명백히 차단한 경우인데 표시는 모호함.

본 패치에서는 **Web Console renderer fallback만으로** 해결:

```text
safety 객체가 없거나 boolean 필드가 누락되면:
- telegramSent: false (명시)
- kvWritten: false (명시)
- kvWriteScope: "-" (의미 없음 표시)
- candidateStored: false (명시)
- trackingStarted: false (명시)
```

Worker 응답 본문은 변경하지 않는다. 운영 중 production Worker는 그대로.

### 3.3 operator review card 가독성 — skip

권장 사항이었으나 본 patch에서는 의도적으로 skip:

```text
이미 색상 배지 (HOT_REVIEW 빨강 / WATCH_REVIEW 주황 / LOW_SIGNAL 회색)와
[CANDIDATE] / [OP-REVIEW] 라벨이 적용되어 있음. minimal patch 원칙 준수.
운영자 UX 추가 개선은 다음 자연검증 사이클에서 별도 patch.
```

---

## 4. 수정 내용

### 4.1 web/ws3-canary-console.html (1724 → 1731 라인, +7)

**preset list 변경** (line 1546-1552):

- 8종 제거: KRW-MATIC, KRW-RENDER, KRW-JUP, KRW-ONDO, KRW-PEPE, KRW-BONK, KRW-TIA, KRW-PYTH
- 잔여 32종 = 'KRW-BTC' ~ 'KRW-WLD'
- 변수명 `WS3_OPERATOR_REVIEW_PRESET_40` 유지 (back-compat)
- 주석으로 변경 사유 명시

**UI button label** (line 303):

```text
before: "Load 40-market Upbit preset"
after:  "Load Upbit KRW preset"
```

**Section 11 send handler safety fallback** (line ~1696-1701):

```text
before:
  setBoolField(llOTelegramSentEl, saf && typeof saf.telegramSent === 'boolean' ? saf.telegramSent : null);
  ...

after:
  var hasSafety = (saf !== null);
  setBoolField(llOTelegramSentEl, hasSafety && typeof saf.telegramSent === 'boolean' ? saf.telegramSent : false);
  setBoolField(llOKvWrittenEl,    hasSafety && typeof saf.kvWritten    === 'boolean' ? saf.kvWritten    : false);
  setStrField(llOKvWriteScopeEl,  hasSafety && typeof saf.kvWriteScope === 'string'  ? saf.kvWriteScope : null);
  setBoolField(llOCandidateStoredEl,  hasSafety && typeof saf.candidateStored  === 'boolean' ? saf.candidateStored  : false);
  setBoolField(llOTrackingStartedEl,  hasSafety && typeof saf.trackingStarted  === 'boolean' ? saf.trackingStarted  : false);
```

주석으로 변경 사유 + worker 미변경 명시.

### 4.2 web/ws3-canary-console/index.html (1724 → 1731 라인, byte-for-byte mirror 유지)

- `cp web/ws3-canary-console.html web/ws3-canary-console/index.html`
- `diff -q` 0건 검증

### 4.3 Worker 미수정

```text
workers/ws3-telegram-canary-worker.js 변경 0건
node --check workers/ws3-telegram-canary-worker.js 통과
worker.js / wrangler.toml / index.html / manifest.json / service-worker.js / v3/ / WS3_CODE_CONTRACT.md / WS3_WORKFLOW_TEMPLATE.md / workers/ws3-canary-state-kv-adapter.js / wrangler-canary.example.toml / .gitignore diff 0건
```

→ Worker redeploy 불필요. Pages redeploy만 필요.

---

## 5. 테스트 결과

### 5.1 필수 테스트 (사용자 지시서 §5)

```text
node --check workers/ws3-telegram-canary-worker.js               → OK (Worker 미변경 확인)
diff -q web/ws3-canary-console.html web/ws3-canary-console/index.html → 0건 (mirror 일치)
git diff --stat HEAD -- [보호 파일군]                              → 빈 출력 (diff 0건)
```

### 5.2 확인 포인트

| # | 항목 | 결과 |
|---|---|---|
| 1 | console mirror diff 0건 | ✅ |
| 2 | preset list count 30~40 유지 | ✅ (32) |
| 3 | preset list 중복 0건 | ✅ |
| 4 | 제거 대상 8종 모두 제외 확인 | ✅ |
| 5 | maxMarkets cap 50 유지 (worker constant + web validation + request) | ✅ |
| 6 | disabled response fallback false 표시 | ✅ (Section 11 send handler 갱신) |
| 7 | protected files diff 0건 | ✅ |
| 8 | Cloudflare deploy 0건 | ✅ |
| 9 | Telegram API 0건 | ✅ |
| 10 | KV write 0건 | ✅ |
| 11 | candidate 저장 0건 | ✅ |
| 12 | tracking 시작 0건 | ✅ |

### 5.3 no-leak 검증

```text
- 노출된 폐기 hash repo-wide 매치 0건
- KV namespace ID 노출 0건
- Invoke Token 노출 0건
- raw Telegram response 기록 0건
- raw exchange full response 기록 0건
- bot_token / chat_id / message_id 노출 0건 (정책 문맥만)
```

---

## 6. 보호 파일 무손상

```text
worker.js                                   ✅ 미수정
wrangler.toml                               ✅ 미수정
index.html (본선)                           ✅ 미수정
manifest.json                               ✅ 미수정
service-worker.js                           ✅ 미수정
v3/ (25종)                                  ✅ 미수정
docs/ws3/WS3_CODE_CONTRACT.md               ✅ 미수정
docs/ws3/WS3_WORKFLOW_TEMPLATE.md           ✅ 미수정
workers/ws3-telegram-canary-worker.js       ✅ 미수정 (본 patch web-only)
workers/ws3-canary-state-kv-adapter.js      ✅ 미수정
wrangler-canary.example.toml                ✅ 미수정
.gitignore                                  ✅ 미수정
wrangler-canary.toml                        ✅ 미트래킹 유지 (5 env vars 유지, LIMITED_LIVE_ENABLED=true 운영 상태)
workers/ws3-telegram-canary-entry.mjs       ✅ 미스테이지 유지
```

---

## 7. Cloudflare 변경 0건 (본 commit 시점)

```text
- Worker 재배포 0건
- Pages 재배포 0건 (post-push gate에서 진행 예정)
- KV namespace 생성/변경 0건
- KV binding 변경 0건
- secrets 변경 0건
- WS3_CANARY_ALLOWED_ORIGINS 변경 0건
- WS3_TELEGRAM_CANARY_ENABLED 변경 0건 (false 유지)
- WS3_CANDIDATE_TEST_ENABLED 변경 0건 (false 유지)
- WS3_LIMITED_LIVE_ENABLED 변경 0건 (true 운영 유지)
- 실 Telegram API 호출 0건
- 실 KV write 0건
- 실 /send-limited-live-alert / /multi-candidate-dry-run / /state / /live-preflight / /candidate-dry-run / /send-candidate-test / /send-canary / /cleanup-confirm / /operator-reset 호출 0건
- 실 거래소 API 호출 0건
```

---

## 8. 남은 자연검증 항목 (v0.31.x 후속 후보)

```text
- preset 추가 정리 (운영 중 추가 fail 식별 시 점진 제거)
- preset 동적 fetch (Upbit /v1/market/all 기반 KRW 자동 목록, 사용자 명시 승인 필요)
- operatorReview score / chip 임계값 자연검증 후 조정
- HOT_REVIEW / WATCH_REVIEW 카드 추가 시각 강조 (chip pill 컬러 / chip pin / sort 가시화)
- duplicate guard window 60s 적정성 자연검증
- 모바일 카드 UX (Section 8 가로 스크롤 / Section 11 select)
- console hosting domain rotate 시점 가이드
- 신규 자동 운영 기능 (Cron / auto Telegram / candidate 저장 / tracking 시작)은 본 patch 범위 외, 별도 사용자 명시 승인 필수
```

---

## 9. 기준 commit

- branch: `claude/heuristic-cori-7865e7`
- 이전 functional baseline: WS3 v0.31.0 Web-first Minimum Operator Mode + Limited Live Operation Enabled (`70fac00`)
- 본 commit: (push 후 기록, push 별도 승인)

---

## 10. 이번 단계의 핵심 (재인용)

```text
v0.31.1은 새 기능이 아니다.
운영 가능한 최소 웹 콘솔을 실제로 쓰기 좋게 만드는 첫 안정화 patch.
preset failCount 줄이기 + disabled response safety 표시 명확화 두 가지만 수정.
Worker 미수정 / Web Console fallback 만으로 해결.
Cloudflare Worker redeploy 불필요.
push 후 Pages redeploy 1회만 진행.
Cron / auto alert / candidate storage / tracking start는 별도 승인 전까지 계속 disabled.
```
