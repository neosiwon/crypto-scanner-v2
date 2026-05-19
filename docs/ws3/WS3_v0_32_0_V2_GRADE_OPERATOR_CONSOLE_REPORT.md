# WS3 v0.32.0 — V2-grade Operator Console Fast Track Pack 완료 보고

**작성일**: 2026-05-20
**branch**: `claude/heuristic-cori-7865e7`
**이전 functional baseline**: WS3 v0.31.1 Natural Validation Stabilization Patch (`4c3bf15`)
**본 단계 산출**: 2 Web Console 동기화 보강 + 1 신규 보고서 + 2 문서 갱신 (총 5 staged) / Worker 미수정

---

## 1. 목표

운영 가능한 최소 웹 콘솔을 v2-grade 운영자 판단력으로 빠르게 끌어올린다. 자동화가 아니라 운영자가 웹에서 빠르게 판단·수동 발송할 수 있게 만드는 **V2-grade Operator Console UX Pack**.

```text
- Operator Dashboard Summary (HOT/WATCH/LOW count cards + last scan + operator review total + candidate count)
- Top 5 Fixed Candidates (별도 고정 영역, rank/market/score/grade/level/chips/time/close)
- Failed Market List (results[].ok===false 클라이언트 추출)
- Filter Tabs (ALL / HOT_REVIEW / WATCH_REVIEW / LOW_SIGNAL / VOLUME_SURGE / HIGH_CLOSE_POSITION / isCandidate)
- Selected Candidate Preview (Section 11 강화)
- Telegram Message Preview (client-side, no API call)
- Memory-only Scan History 확장 (HOT/WATCH/LOW counts + okCount + failCount)
- Memory-only Sent History (최근 5건, 메모리만)
- Mobile UX 최소 개선 (button spacing, card padding, tab 크기, danger-zone row 간격)
```

한 줄 정의: **v0.32 = web-only V2-grade operator UX pack (대시보드 + 필터 + Top5 + 프리뷰 + 메모리 히스토리 + 모바일 UX). Worker 미수정, env 변경 0건, Cron / 자동 Telegram / candidate KV 저장 / tracking 시작 0건.**

---

## 2. v0.31.1 운영 유지 상태 (재인용)

```text
WS3_LIMITED_LIVE_ENABLED=true 유지
Manual Limited Live 발송 가능 (KRW-DOT 5m 검증 완료)
32-market preset 적용 (failCount=1로 안정화)
disabled response safety fallback 표시 (telegramSent=false 등 명시)
Cron disabled
Automatic alerts disabled
candidate storage disabled
tracking start disabled
duplicate guard 작동 확인
```

본 v0.32 패치는 위 운영 상태를 그대로 두고 Web Console UI/UX만 확장한다.

---

## 3. 사용자 방향 전환 원칙 (재인용)

```text
빠르게 완성본으로 올린다.
실사용하면서 자연검증한다.
단, 꼭 해야 하는 검증은 무시하지 않는다.
관성적으로 기능 하나마다 과도하게 쪼개지 않는다.
```

위 원칙에 따라 v0.32는 **낮은 위험 UI 묶음**을 한 번에 진행하고, 반복 dry-run 검증 루프 없이 필수 정적 테스트만 수행한다.

위험 분류:
- 낮은 위험: UI / 필터 / 미리보기 / memory-only history → 한 번에 묶어 진행 ✅
- 중간 위험: Telegram 발송 preview / 선택 카드 UI → client-side display only, API 호출 0건 ✅
- 높은 위험: Cron / 자동 Telegram / KV candidate 저장 / tracking 시작 / env 변경 → 이번 단계 금지 ✅

---

## 4. v0.32 목적 (v2-grade 운영자 판단력)

```text
스캔 결과를 한눈에 → operatorReviewLevel 분포가 즉시 보임
Top 5 → 운영자가 매번 전체 결과를 스크롤할 필요 없음
실패 market → 단순 count가 아니라 어떤 코인이 왜 실패했는지 확인 가능
필터 → 화면 안에서 HOT만 / VOLUME_SURGE만 즉시 좁히기
선택 카드 preview → Telegram 전송 전에 실제 본문이 어떻게 나가는지 확인
sent history → 메모리만, 최근 5건만 — KV 저장 / localStorage 사용 0건
```

---

## 5. 구현 1 — Operator Dashboard Summary

위치: Section 8 `mc_runBtn` 결과 panel 직후, results 영역 위에 신규 `mc_dashboard_wrap` 패널.

표시:
- 3-card grid (HOT_REVIEW / WATCH_REVIEW / LOW_SIGNAL) — 색상 분리 (red / orange / gray)
- meta row: Last scan (top result `latestTime`) / Operator review total (HOT + WATCH) / Candidate count
- 기존 8 fields panel에 `operatorReviewCount` 추가 (HOT + WATCH 합산, Worker `operatorReviewCounts` 활용)

데이터 소스: `body.operatorReviewCounts.{HOT_REVIEW, WATCH_REVIEW, LOW_SIGNAL}` (v0.31에서 Worker가 이미 응답에 포함).

표시 규칙:
- 숫자 없으면 0
- undefined / null 노출 0건

Worker 미수정.

---

## 6. 구현 2 — Top 5 Fixed Candidates

위치: dashboard 다음, results 위에 별도 `mc_top5_wrap` 패널.

표시 항목 (각 row 1줄):
- rank
- market (monospace)
- grade (color: P-S 녹색 / P-A 진녹 / P-B 진황 / P-C 빨강)
- score
- operatorReviewLevel badge (HOT red / WATCH orange / LOW gray)
- [CAND] (isCandidate=true) / [OR] (operatorReview && !isCandidate)
- chips (최대 4종)
- @latestTime, close=lastClose

정렬: Worker가 이미 제공한 정렬 우선순위 (operatorReviewLevel → score → volumeRatio → closePosition) 그대로 사용.

표시 금지: raw exchange data, 가격 거래량 raw 숫자 추가 노출 없음.

---

## 7. 구현 3 — Failed Market List

위치: results 패널 아래 별도 `mc_failed_wrap` 패널.

추출 방법: client-side에서 `results.filter(r => r.ok === false)` — Worker 응답에 이미 `{rank, market, ok:false, code}` 형식으로 ok=false rows가 results 배열에 포함되어 있음 (v0.29 multiCandidateRunPipeline 그대로).

표시:
- 각 row: `market — code` (safe error code only)
- 표시 가능 code 예: CANDIDATE_DRY_RUN_NETWORK_ERROR / CANDIDATE_DRY_RUN_FEATURE_ERROR / FETCH_FAILED 등 worker가 명시한 safe code

표시 금지:
- raw exchange full response
- full stack trace
- secret / token
- raw internal error

Worker 미수정. spec §9의 "1순위: existing response에 fields가 있으면 그대로 사용" 적용.

---

## 8. 구현 4 — Filter Tabs

위치: dashboard / top5 다음, results 위에 별도 `mc_filter_wrap` 패널.

필터 종류 (7개):
- `ALL` (default)
- `HOT_REVIEW`
- `WATCH_REVIEW`
- `LOW_SIGNAL`
- `VOLUME_SURGE` (reasonChips 포함)
- `HIGH_CLOSE_POSITION` (reasonChips 포함)
- `isCandidate`

매칭 규칙:
- 레벨 필터 → `r.operatorReviewLevel === filterId`
- chip 필터 → `Array.isArray(r.reasonChips) && r.reasonChips.indexOf(filterId) !== -1`
- `isCandidate` → `r.isCandidate === true`
- `ALL` → ok=true 전부 + failed rows도 포함

기본값: `ws3CurrentFilter = 'ALL'`. 새 scan 실행 시 항상 ALL로 리셋.

탭 표시: 각 탭 우측에 매칭 수 badge (현재 결과 기준 동적 계산).

필터 변경 시:
- mcRenderResults 재호출 (filter 반영)
- mcResultsFilterLbl 갱신
- Top 5 / Dashboard / Failed 패널은 영향 받지 않음 (전체 기준 유지)

Client-side memory-only 처리. Worker 미호출.

---

## 9. 구현 5 — Selected Candidate Preview

위치: Section 11 `ll_selectedCard` select 직후, allowOR 체크박스 위에 신규 `ll_selectedInfo_wrap`.

표시:
- Selected market
- Exchange / Timeframe
- Score / Grade
- Operator review level
- isCandidate
- operatorReview
- Reason chips (최대 8)
- latestTime (lastMultiRunResults 매칭 row에서 추출)
- lastClose (lastMultiRunResults 매칭 row에서 추출)
- changePct / volRatio (lastMultiRunResults 매칭 row에서 추출)
- Risk note (UPPER_WICK_RISK / WIDE_RANGE_RISK / LOW_VOLUME chip 우선)

선택 카드 없을 때: panel hide.

---

## 10. 구현 6 — Telegram Message Preview

위치: Section 11 allowOR 체크박스 직후, confirmPhrase 위에 신규 `ll_preview_wrap`.

Preview 본문 (Worker `buildLimitedLiveAlertMessageText` 와 동일한 안전 라벨, client-side display):

```text
[WOOS WS3 LIMITED LIVE / OPERATOR REVIEW]
자동 매수/매도 추천 아님
운영자 검토 필요
Manual operator review only.
This is not a live trading alert.

Market: <market>
Exchange: <exchange>
Timeframe: <timeframe>
Score: <score>
Grade: <grade>
Operator review level: <level>
isCandidate: <true|false>
Reason chips: <chips>
candidateStored: false
trackingStarted: false
```

자격 검사 (client-side 안내, Worker validateLimitedLiveAlertRequest 와 동일 규칙):
- `isCandidate === true` OR (`operatorReview === true` AND allowOR=checked) → eligible
- 그 외 → preview 하단에 `[NOT ELIGIBLE — Worker will return LIMITED_LIVE_INVALID_PAYLOAD]` 안내

주의:
- 본 preview는 client-side display only — Telegram API 호출 0건
- raw Telegram response 노출 0건
- token / chat_id / bot_token / message_id 노출 0건
- 매수 추천 / 진입 추천 / 수익 보장 / 확정 신호 / LIVE BUY 문구 0건

이벤트 hook:
- 선택 카드 change → preview refresh
- allowOR checkbox change → preview eligibility 재계산
- Send 클릭 후 (성공/실패 무관) → preview clear

---

## 11. 구현 7 — Memory-only Scan History (확장)

기존 `multiRunHistory[]` 배열 그대로 사용 (이미 max 5 / no storage 정책 준수). v0.32에서 row 형식 확장:

```text
before: lastRunAt | markets | candidates | topScore | topGrade
after:  lastRunAt | mkt | ok | fail | cand | H/W/L | top=score/grade
```

추가 필드:
- okCount
- failCount
- HOT_REVIEW / WATCH_REVIEW / LOW_SIGNAL counts

데이터 소스: `body.okCount`, `body.failCount`, `body.operatorReviewCounts`.

저장 방식:
- 변수: `multiRunHistory = []` (브라우저 메모리만)
- 보관: 최근 5회
- localStorage / sessionStorage / indexedDB / document.cookie 사용 0건

---

## 12. 구현 8 — Memory-only Sent History

위치: Section 11 result panel 직후, footnote 위에 신규 `ll_sentHistory_wrap`.

저장 방식:
- 변수: `ws3SentHistory = []` (브라우저 메모리만)
- 보관: 최근 5건
- localStorage / sessionStorage / indexedDB / document.cookie 사용 0건
- 페이지 새로고침 시 자동 클리어

저장 조건: Worker가 `code === 'LIMITED_LIVE_REVIEW_SENT'` AND `safety.telegramSent === true` 응답 시에만 append.

저장 항목 (각 entry):
- time (client-side ISO)
- market
- score
- grade
- operatorReviewLevel
- messageType
- telegramSent (always true at append time)
- kvWriteScope (LIMITED_LIVE_GUARD_ONLY)

표시:
- 각 row: `time | market | grade | score | level | messageType | tg=true | scope=LIMITED_LIVE_GUARD_ONLY`
- operatorReviewLevel 색상 분리

표시 금지:
- raw Telegram response
- Telegram message_id
- bot_token / chat_id
- KV namespace ID
- Invoke Token

---

## 13. 구현 9 — Mobile UX 최소 개선

신규 CSS 클래스 (4xx CSS lines):
- `.ws3-dash-grid`, `.ws3-dash-card` — 3-col 카운트 카드
- `.ws3-tabs`, `.ws3-tab` — flex wrap tab bar, min-height 32px (44px touch보다 작지만 dense 정보 영역)
- `.ws3-top5-row` — flex wrap row, 8px gap
- `.ws3-failed-row`, `.ws3-sent-row` — bordered list row
- `.ws3-preview-box`, `.ws3-preview-empty` — monospace preview / empty placeholder
- `.ws3-selected-card` — 130px lbl col + monospace val col
- `.ws3-mobile-spacer` — utility spacer

`@media (max-width: 420px)` 확장:
- dashboard grid gap 축소
- dashboard card val 14px
- tab min-width 56px, padding 5px 8px
- selected-card lbl col 100px
- danger-zone .row margin 14px (액션 버튼 간격 확보)

기존 invite gate 구조 / 본선 CSS / 기존 Section 삭제 0건.

---

## 14. Worker 미수정

```text
workers/ws3-telegram-canary-worker.js diff 0건
node --check workers/ws3-telegram-canary-worker.js PASS
VERSION 상수: WS3_v0.31.0_web_first_minimum_operator_mode 유지
신규 KV write 0건 (LIMITED_LIVE_GUARD_ONLY / CANDIDATE_TEST_GUARD_ONLY 외 추가 0건)
신규 endpoint 0건
신규 env gate 0건
신규 putJson 호출 0건
```

→ Worker redeploy **불필요**. v0.32 deploy gate에서 Pages redeploy 1회만.

v0.29 multiCandidateRunPipeline의 `results[].ok===false` row 형식이 이미 client-side에서 failedMarkets를 추출 가능한 구조였으므로, Worker response 보강 0건.

---

## 15. 필수 테스트 결과

### 15.1 정적 테스트

```text
node --check workers/ws3-telegram-canary-worker.js          → PASS (Worker 미변경 확인)
diff -q web/ws3-canary-console.html web/ws3-canary-console/index.html → 0건 (byte-for-byte mirror 유지)
git diff --stat HEAD -- [보호 파일군]                        → 빈 출력 (diff 0건)
```

### 15.2 Web Embedded JS Parse

```text
<script> 블록 2개 (4428 + 74798 chars)
new Function(block) 통과 → ALL_BLOCKS_OK
```

### 15.3 storage 검사

```text
grep "localStorage|sessionStorage|indexedDB|document.cookie" web/ → 매치 2건 모두 정책 문맥 (line 128 정책 안내, line 559 invite gate 주석 — "사용 0건" / "저장하지 않는다")
실제 storage 호출 0건
```

### 15.4 leak 검사

```text
- 노출된 폐기 hash repo-wide 매치 0건
- KV namespace ID 노출 0건
- bot_token / chat_id / message_id / Invoke Token / SHA-256 hash — 정책 문맥만 (raw value 0건)
- raw Telegram response / raw exchange full response — 정책 문맥만 (실 값 0건)
- 매수 추천 / 진입 추천 / 수익 보장 / 확정 신호 / LIVE BUY — 0건
- masked / first-4 / last-4 / redacted preview — 0건
- URL query parameter token 전달 — 0건
- console.log 출력 — 0건
```

### 15.5 Worker scope (확인용, 수정 0건이므로 새 KV write 검사는 N/A)

```text
기존 putJson 호출: 2건 (LIMITED_LIVE_GUARD_ONLY 1건 + CANDIDATE_TEST_GUARD_ONLY 1건) 그대로 유지
새 KV write 추가 0건
```

---

## 16. 보호 파일 무손상

```text
worker.js                                   ✅ 미수정
wrangler.toml                               ✅ 미수정
index.html (본선)                           ✅ 미수정
manifest.json                               ✅ 미수정
service-worker.js                           ✅ 미수정
v3/ (25종)                                  ✅ 미수정
docs/ws3/WS3_CODE_CONTRACT.md               ✅ 미수정
docs/ws3/WS3_WORKFLOW_TEMPLATE.md           ✅ 미수정
workers/ws3-telegram-canary-worker.js       ✅ 미수정 (Web-only patch)
workers/ws3-canary-state-kv-adapter.js      ✅ 미수정
v3/v3-telegram-canary-sender.js             ✅ 미수정
v3/v3-secure-runtime-state-adapter.js       ✅ 미수정
wrangler-canary.example.toml                ✅ 미수정
.gitignore                                  ✅ 미수정
wrangler-canary.toml                        ✅ 미트래킹 유지 (5 env vars 그대로, LIMITED_LIVE_ENABLED=true 운영)
workers/ws3-telegram-canary-entry.mjs       ✅ 미스테이지 유지
```

---

## 17. Cloudflare 변경 0건 (본 commit 시점)

```text
- Worker 재배포 0건
- Pages 재배포 0건 (deploy gate에서 별도 진행)
- KV namespace 생성/변경 0건
- KV binding 변경 0건
- secrets 변경 0건
- WS3_CANARY_ALLOWED_ORIGINS / WS3_TELEGRAM_CANARY_ENABLED / WS3_TELEGRAM_CANARY_AUTHORIZED_AT / WS3_CANDIDATE_TEST_ENABLED / WS3_LIMITED_LIVE_ENABLED 모두 변경 0건
- 실 Telegram API 호출 0건
- 실 KV write 0건
- 실 /send-limited-live-alert / /send-candidate-test / /multi-candidate-dry-run / /state / /live-preflight / /candidate-dry-run / /send-canary / /cleanup-confirm / /operator-reset 호출 0건
- 실 거래소 API 호출 0건
```

---

## 18. 의도된 미구현 (v0.32 deploy validation 간소화)

본 commit 까지 = v0.32 코드 / 문서 / 정적 검증 만. 실 deploy / 실 호출 / 자연검증은 push 후 별도:

- v0.32 Pages Redeploy Gate (별도):
  1. Worker 미수정 — Worker redeploy 안 함
  2. Pages redeploy (--branch=main, hash 주입 working copy)
  3. cleanup + tracked source 0건 검증

- v0.32 Live Validation (간소화):
  1. Production console 접속 (Ctrl+F5)
  2. 32-market scan 1회 → dashboard / Top5 / filter / failed / history 표시 확인
  3. Limited Live 카드 선택 → selected preview / Telegram preview 표시 확인
  4. (필요 시) Limited Live Send 1회 → sent history append 확인 (이미 v0.31 검증된 발송 경로, 변경 없음 — 운영자 재량으로 생략 가능)

---

## 19. 남은 자연검증 항목 (v0.32+ 자연검증 사이클)

```text
- 모바일에서 dashboard 3-card grid 가독성
- Top 5 카드 line wrap 시 가독성
- Filter tab 7개가 한 줄 안 들어갈 때 wrap 거동
- Telegram preview 본문 모바일 폰트 사이즈
- 32-market scan failCount 추가 감소 가능성 (자연검증 후속)
- operatorReview score / chip 임계값 미세 조정
- duplicate guard window 60s 적정성
- console hosting domain rotate 시점 가이드
- Cron / auto Telegram / candidate KV 저장 / tracking 시작은 별도 사용자 명시 승인 전까지 계속 disabled
```

---

## 20. 기준 commit

- branch: `claude/heuristic-cori-7865e7`
- 이전 functional baseline: WS3 v0.31.1 Natural Validation Stabilization Patch (`4c3bf15`)
- 본 commit: (push 후 기록, push 별도 승인)

---

## 21. 이번 단계의 핵심 (재인용)

```text
v0.32는 속도 우선.
관성적인 과잉 검증 금지.
위험 낮은 웹 UX 개선을 한 번에 묶어 진행.
실사용하면서 자연검증.
storage / secret leak / protected diff / JS parse / mirror 는 반드시 확인.
Cron / 자동 Telegram / candidate KV 저장 / tracking 시작은 별도 승인 전까지 계속 disabled.
Worker 미수정 → Worker redeploy 불필요 → Pages redeploy 1회만.
```
