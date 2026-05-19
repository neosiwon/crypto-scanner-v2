# WS3 v0.30.0 — Forced Candidate TEST_ONLY Telegram Validation Pack 완료 보고

**작성일**: 2026-05-19
**branch**: `claude/heuristic-cori-7865e7`
**이전 functional baseline**: WS3 v0.29.0 Integrated Limited Live Pipeline + Multi-market LOW_SIGNAL Validation Success (`afa7284`)
**본 단계 산출**: 1 worker 보강 + 2 console 동기화 수정 + 1 신규 보고서 + 2 문서 갱신 (총 6 staged)

---

## 1. 목표 (실코인 자동 알람 아님 / forced TEST_ONLY 경로)

v0.30 = **후보 미발생 환경에서도 Candidate Telegram 경로를 1회 검증** 할 수 있도록 `forceTestCandidate=true` 모드 추가.

여전히 실전 알람 아님:
- 무제한 자동 알람 0건 / Cron 0건 / 자동 Telegram 0건
- candidate KV 저장 0건 / tracking 시작 0건 / snapshot/evaluation/audit 0건
- Limited Live Mode 변경 0건 (DISABLED 유지)

forced 모드 사용 조건:
- 별도 confirmPhrase `SEND_WS3_FORCED_TEST_CANDIDATE` (normal `SEND_WS3_TEST_CANDIDATE` 와 분리)
- 별도 사유 필드 `forcedTestReason` (1-128자, ASCII+공백+기본 문장부호 정규식)
- `WS3_CANDIDATE_TEST_ENABLED='true'` (env, normal/forced 공통)
- KV duplicate guard 60s window (normal/forced 공통, payload 에 `messageType` audit 구분)

한 줄 정의: **v0.30 = forced TEST_ONLY Telegram 경로 검증, isCandidate=false 결과도 1회 강제 전송 가능, 실전 알람·매수·수익 보장과 무관.**

---

## 2. v0.29 dependency 완료 상태 (입력)

```text
Worker version: WS3_v0.29.0_integrated_limited_live_pipeline (production)
Pages: ws3-canary-console.pages.dev (production, Sections 8/9/10 UI 반영)
WS3_CANDIDATE_TEST_ENABLED 미설정 (default 'false' 동작)
v0.29 production /multi-candidate-dry-run 1회 실 호출 PASS — 10 markets / candidateCount=0 / LOW_SIGNAL_NORMAL 정상 판정
v0.29 mock smoke 30/30 PASS
v0.29 Candidate TEST_ONLY 경로 (Step L/M) 실 검증 미수행 (후보 미발생)
```

---

## 3. 신규 / 확장 (worker)

### 3.1 신규 상수 (6종)

```js
var FORCED_CANDIDATE_TEST_MODE = 'FORCED_TEST_ONLY';
var FORCED_CANDIDATE_TEST_MESSAGE_TYPE = 'FORCED_CANDIDATE_TEST_ONLY';
var FORCED_CANDIDATE_TEST_CONFIRM_PHRASE = 'SEND_WS3_FORCED_TEST_CANDIDATE';
var FORCED_CANDIDATE_TEST_GUARD_REASON = 'FORCED_CANDIDATE_TEST_SENT';
var FORCED_CANDIDATE_TEST_REASON_MAX_LEN = 128;
var FORCED_CANDIDATE_TEST_REASON_PATTERN = /^[A-Za-z0-9 _\-\.\,\:\!\?\(\)\[\]\/]{1,128}$/;
```

기존 v0.29 `CANDIDATE_TEST_*` 상수와 분리. KV `CANDIDATE_TEST_GUARD_KEY` / `CANDIDATE_TEST_GUARD_WINDOW_MS` 는 공유.

### 3.2 `validateCandidateTestRequest` 확장

기존 시그니처 유지. body 의 `forceTestCandidate === true` 감지:
- forced 모드 → `confirmPhrase` 는 `FORCED_CANDIDATE_TEST_CONFIRM_PHRASE` 일치 필수 + `forcedTestReason` (정규식 + 길이) 필수 + 에러 코드 namespace 전체가 `FORCED_CANDIDATE_TEST_*` 로 전환
- normal 모드 → 기존 v0.29 동작 그대로
- 반환된 `normalized` 에 `forced: bool` / `forcedTestReason: string|null` 추가

### 3.3 `buildCandidateTestMessageText` 확장

forced 분기:
```text
[WOOS WS3 FORCED CANDIDATE TEST_ONLY]
This is not a live trading alert.
manual forced validation only.
실전 알람 아님
테스트 전송
강제 후보 테스트
매수/매도 추천 아님

mode: FORCED_TEST_ONLY
source: multi-candidate-dry-run
candidateStored: false
trackingStarted: false

Exchange / Market / Timeframe / Score / Grade / Reason chips / Forced reason
```

normal 분기는 기존 v0.29 preamble 그대로. 매수 추천 / 수익 보장 문구 0건. raw exchange data / 가격 / 거래량 숫자 미포함.

### 3.4 `buildCandidateTestResponse(kvWritten, forced)` 확장

forced 분기에서 응답 본문:
- `code: 'FORCED_CANDIDATE_TEST_SENT'`
- `mode: 'FORCED_TEST_ONLY'`
- `messageType: 'FORCED_CANDIDATE_TEST_ONLY'`

normal 분기는 `code: 'CANDIDATE_TEST_SENT'` / `mode: 'CANDIDATE_TEST_ONLY'` / `messageType: 'CANDIDATE_TEST_ONLY'` 그대로.

`safety.kvWriteScope: 'CANDIDATE_TEST_GUARD_ONLY'` 는 normal/forced 공통.

### 3.5 `/send-candidate-test` 핸들러 변경

- 인증 layer 유지 (Origin / Token / manualTrigger 3중)
- **disabled gate check 위치 변경**: body parse 직후로 이동 — body 의 `forceTestCandidate` 플래그 기반으로 `CANDIDATE_TEST_DISABLED` (503) 또는 `FORCED_CANDIDATE_TEST_DISABLED` (503) 분기
- 검증 통과 후 forced 여부 추출 → duplicate guard 에러 코드 + Telegram error 코드 forced-aware 분기 (`CANDIDATE_TEST_ALREADY_SENT` / `FORCED_CANDIDATE_TEST_ALREADY_SENT`, `CANDIDATE_TEST_TELEGRAM_ERROR` / `FORCED_CANDIDATE_TEST_TELEGRAM_ERROR`)
- KV guard write payload 에 `messageType` (FORCED_CANDIDATE_TEST_ONLY / CANDIDATE_TEST_ONLY) + `market` audit 필드 추가 — closure 시점 normal/forced 구분 가능

### 3.6 신규 safe code (6종 forced + 3종 audit 분기)

```text
FORCED_CANDIDATE_TEST_SENT 200
FORCED_CANDIDATE_TEST_DISABLED 503
FORCED_CANDIDATE_TEST_CONFIRM_PHRASE_REQUIRED 403
FORCED_CANDIDATE_TEST_INVALID_PAYLOAD 400
FORCED_CANDIDATE_TEST_ALREADY_SENT 429
FORCED_CANDIDATE_TEST_TELEGRAM_ERROR 502
```

기존 normal `CANDIDATE_TEST_*` safe code 모두 유지. 두 namespace 가 충돌 없이 공존.

### 3.7 OPTIONS allowlist

v0.29 그대로 (9 path). `/send-candidate-test` 는 이미 포함.

### 3.8 module.exports 확장

forced 상수 6종 추가. 기존 모든 exports 유지.

---

## 4. Web Console UI Section 9 확장

### 4.1 신규 UI 요소

- `Forced Test Mode` 체크박스 (default off)
- `Forced Test Reason` 입력칸 (forced 활성화 시에만 표시, maxlength=128, 정규식 sanitize)
- `Confirm Phrase` placeholder 가 mode 에 따라 swap: `SEND_WS3_TEST_CANDIDATE` ↔ `SEND_WS3_FORCED_TEST_CANDIDATE`
- Send 버튼 라벨도 mode 에 따라 swap: "Send Candidate TEST_ONLY" ↔ "Send FORCED Candidate TEST_ONLY"
- 결과 panel 에 `mode` 필드 추가 (CANDIDATE_TEST_ONLY / FORCED_TEST_ONLY 가시)

### 4.2 mode 토글 시 보안

- mode 변경 시 `confirmPhrase` + `forcedTestReason` 모두 즉시 클리어 (실수 carry-over 방지)
- 발송 후 / 네트워크 실패 후 `forcedTestReason` 즉시 클리어
- Send 버튼 enable 조건: `hasSel && phraseOk && (forced ? reasonOk : true)` 모두 충족 시에만

### 4.3 forced 안내 문구

Danger Zone warn:
> ⚠️ TEST_ONLY 전송. 실제 운영 알람 / 매수 추천 / 수익 보장 아님. ... FORCED 모드: isCandidate=false 결과도 강제로 1회 Telegram 경로 검증 가능 — 별도 confirmPhrase + forcedTestReason 필수.

footnote:
> ... FORCED 모드 응답 시 mode=FORCED_TEST_ONLY / messageType=FORCED_CANDIDATE_TEST_ONLY 로 표시되며, 실전 알람·매수·수익보장과 무관함.

### 4.4 client-side sanitize

```js
var CT_NORMAL_PHRASE_REQUIRED = 'SEND_WS3_TEST_CANDIDATE';
var CT_FORCED_PHRASE_REQUIRED = 'SEND_WS3_FORCED_TEST_CANDIDATE';
var CT_FORCED_REASON_PATTERN = /^[A-Za-z0-9 _\-\.\,\:\!\?\(\)\[\]\/]{1,128}$/;
```

server-side 와 동일 정규식. 한국어/특수문자 입력은 forced mode 에서 차단 (영문/숫자/공백/기본 문장부호만).

### 4.5 두 파일 byte-for-byte mirror

`web/ws3-canary-console.html` / `web/ws3-canary-console/index.html` 모두 1435 → 1494 라인 (+59), 68102 → 71874 bytes. `diff -q` 결과 0건. embedded `<script>` 블록 2개 (4428 + 42718 chars) Node parse 통과.

---

## 5. mock smoke 결과 (27 시나리오 — spec 20 forced + 7 추가 regression / audit)

```
TOTAL=27 PASS=27 FAIL=0
```

### 5.1 Forced (S1-S18)

| # | 시나리오 | 결과 |
|---|---|---|
| S1 | forced no token → 401 | ✅ |
| S2 | forced bad token → 403 | ✅ |
| S3 | forced no manualTrigger → 400 | ✅ |
| S4 | forced disabled gate (env default false) → 503 FORCED_CANDIDATE_TEST_DISABLED | ✅ |
| S5 | forced missing confirmPhrase → 403 FORCED_CANDIDATE_TEST_CONFIRM_PHRASE_REQUIRED | ✅ |
| S6 | forced wrong confirmPhrase → 403 | ✅ |
| S7 | forced missing selectedCandidate → 400 FORCED_CANDIDATE_TEST_INVALID_PAYLOAD | ✅ |
| S8 | forced source mismatch → 400 | ✅ |
| S9 | forced missing forcedTestReason → 400 | ✅ |
| S9b | forced bad reason pattern (한글) → 400 | ✅ |
| S10 | forced mock success (P-C, score=5 candidate) → 200 FORCED_CANDIDATE_TEST_SENT / mode=FORCED_TEST_ONLY / messageType=FORCED_CANDIDATE_TEST_ONLY / fixedMessageUsed=true / safety telegramSent=true / kvWritten=true / kvWriteScope=CANDIDATE_TEST_GUARD_ONLY / candidateStored=false / trackingStarted=false | ✅ |
| S11 | messageType = FORCED_CANDIDATE_TEST_ONLY | ✅ |
| S12 | Telegram body contains required labels (FORCED CANDIDATE TEST_ONLY / This is not a live trading alert / manual forced validation only / 실전 알람 아님 / 테스트 전송 / 강제 후보 테스트 / 매수/매도 추천 아님 / mode: FORCED_TEST_ONLY / source: multi-candidate-dry-run) | ✅ |
| S13 | Telegram body does NOT contain forbidden live-alert phrases (매수하세요 / 진입 추천 / 수익 보장 / LIVE BUY) | ✅ |
| S14 | candidateStored=false | ✅ |
| S15 | trackingStarted=false | ✅ |
| S16 | KV put exactly 1 (forced guard write only) | ✅ |
| S17 | raw Telegram response leak (message_id / result / from / chat) CLEAN | ✅ |
| S18 | forced duplicate guard → 429 FORCED_CANDIDATE_TEST_ALREADY_SENT | ✅ |

### 5.2 Regression / namespace separation (S19-S25)

| # | 시나리오 | 결과 |
|---|---|---|
| S19 | normal candidate test path regression → 200 CANDIDATE_TEST_SENT / mode=CANDIDATE_TEST_ONLY / messageType=CANDIDATE_TEST_ONLY | ✅ |
| S20 | multi-candidate-dry-run regression → 200 MULTI_CANDIDATE_DRY_RUN_OK / safety telegramSent=false / kvWritten=false | ✅ |
| S20b | multi 호출 후 Telegram count=0 / KV put count=0 | ✅ |
| S21 | forced + bad score (999, out of [0,100]) → 400 FORCED_CANDIDATE_TEST_INVALID_PAYLOAD | ✅ |
| S22 | normal disabled gate → 503 CANDIDATE_TEST_DISABLED (forced-aware code routing 정확) | ✅ |
| S23 | forced mode 에 normal phrase 사용 → 403 FORCED_CANDIDATE_TEST_CONFIRM_PHRASE_REQUIRED | ✅ |
| S24 | normal mode 에 forced phrase 사용 → 403 CANDIDATE_TEST_CONFIRM_PHRASE_REQUIRED | ✅ |
| S25 | KV guard payload audit: forced 후 store 에 `messageType: 'FORCED_CANDIDATE_TEST_ONLY'` 포함 확인 | ✅ |

실 거래소 API 호출 0건. 실 KV API 호출 0건. 실 Telegram API 호출 0건 (mock fetchImpl 만).

---

## 6. no-write 스코프 (forced/normal 공통)

### 6.1 `/multi-candidate-dry-run` scope

- `writeAlreadySent` / `writeCleanupRequired` / `writeCircuit` / `writeInvokeFail` / `writeOperatorReset` / `markAlreadySentReset` / `putJson` / `.put(` / `sendCanary` / `dispatchCanary` / `sendMessage` 매치 **0건**

### 6.2 `/send-candidate-test` scope

- `putJson(ctKv, CANDIDATE_TEST_GUARD_KEY, ...)` **1건만** (normal/forced 공통, audit payload 만 다름)
- 다른 KV writer / canary sender 호출 0건
- normal/forced 분기에 따라 `reason` + `messageType` audit 값만 변경 (key 동일)

---

## 7. 보호 파일 무손상

`git diff --stat HEAD -- worker.js wrangler.toml index.html manifest.json service-worker.js docs/ws3/WS3_CODE_CONTRACT.md docs/ws3/WS3_WORKFLOW_TEMPLATE.md v3/ workers/ws3-canary-state-kv-adapter.js wrangler-canary.example.toml .gitignore` → 빈 출력 = **0건** ✅

- 본선 `worker.js` / `wrangler.toml` (repo 미존재) / `index.html` / `manifest.json` / `service-worker.js` — 미수정
- `v3/` 25종 엔진 — 미수정
- `docs/ws3/WS3_CODE_CONTRACT.md` / `WS3_WORKFLOW_TEMPLATE.md` — 미수정
- `workers/ws3-canary-state-kv-adapter.js` — **미수정** (generic `getJson` / `putJson` 만 재사용)
- `wrangler-canary.example.toml` / `.gitignore` — 미수정
- `workers/ws3-telegram-canary-entry.mjs` — 미스테이지 유지

---

## 8. 보안 / 누출 검증

- bot token / chatId / invoke token 실 값 — 노출 **0건**
- KV namespace ID — 노출 **0건**
- Telegram message_id / raw Telegram response — 노출 **0건** (smoke S17)
- exchange API raw native field — response 본문 노출 **0건**
- 노출된 폐기 hash repo-wide 매치 **0건**
- masked / first-4 / last-4 / redacted preview — **0건**
- localStorage / sessionStorage / IndexedDB / document.cookie 호출 — **0건** (web grep 매치 2건 모두 정책 부정문맥)
- URL query parameter token 전달 — **0건**
- `console.log` 출력 — **0건**
- 매수 추천 / 수익 보장 / LIVE BUY / 진입 추천 — **0건** (smoke S13 검증)
- forced mode 메시지 body 에 `실전 알람 아님` / `테스트 전송` / `강제 후보 테스트` / `매수/매도 추천 아님` 모두 명시 (smoke S12 검증)

---

## 9. Cloudflare 변경 0건

- worker 재배포 0건 (v0.29 production Version 그대로)
- Pages 재배포 0건
- KV namespace 생성/변경 0건
- KV binding 변경 0건
- secrets (BOT_TOKEN / CHAT_ID / INVOKE_TOKEN) 변경 0건
- `WS3_CANARY_ALLOWED_ORIGINS` 변경 0건
- `WS3_CANDIDATE_TEST_ENABLED` 변경 0건 (선언만 v0.29 그대로 default 'false', deploy Gate 에서만 임시 'true' 활성화)
- 실 Telegram API 호출 0건
- 실 KV write 0건
- 실 `/send-candidate-test` (normal / forced) 호출 0건
- 실 거래소 API 호출 0건

---

## 10. 의도된 미구현 (다음 Gate)

본 commit 까지 = v0.30 코드 / 문서 / mock 검증 만. 실제 deploy / 실 호출은 별도 승인 단계:

- v0.30 Deploy/Live Validation Gate (별도):
  1. Worker redeploy (v0.30 production version 반영)
  2. Pages redeploy (Section 9 forced mode UI 반영)
  3. Check State
  4. Multi-market Dry-run 1회 (top result 선택)
  5. `WS3_CANDIDATE_TEST_ENABLED='true'` 임시 활성화 + Worker redeploy
  6. Section 9 forced 모드 체크 + forcedTestReason 입력 + `SEND_WS3_FORCED_TEST_CANDIDATE` 입력
  7. Send FORCED Candidate TEST_ONLY 1회 클릭
  8. Telegram 수신 확인 (FORCED preamble 포함 / 실전 알람 아님 / 강제 후보 테스트 라벨)
  9. `WS3_CANDIDATE_TEST_ENABLED='false'` 복귀 + Worker redeploy
- v0.31 후보 A: Candidate Scoring Calibration
- v0.31 후보 B: Multi-market history persistence (browser memory-only 확장)
- v0.31 후보 C: Security hardening before live candidate alert (Cloudflare Access / invoke token rotation / origin allowlist 재검토)
- v0.31+: env-based `MULTI_CANDIDATE_DISABLED` / `CANDIDATE_TEST_DISABLED` 강제 kill switch
- rate limit per origin / market / minute / invoke token rotate automation / ipHash + `WS3_CANARY_HASH_SALT`

---

## 11. v0.30 한계 (재확인)

- mock smoke only. real Telegram API 응답 다양성 (rate limit / network error / 메시지 길이 제한 / 메시지 포맷 깨짐) 은 별도 staging Gate.
- forced mode 는 boolean flag 1개로 활성화. 실수로 false positive 활성화를 막기 위한 보호: (a) 별도 confirmPhrase, (b) forcedTestReason 정규식 + 길이, (c) 별도 enable env 'true' 필수, (d) 60s duplicate guard.
- forced mode 메시지에 raw 시장 가격 / 거래량 숫자 미포함. score/grade/chips 만. 실 후보 알람으로 오인되지 않도록 preamble 강제.
- KV guard window=60s 는 normal/forced 공통. 단기 연속 호출은 차단. 60s 이후 재호출은 허용 (실 검증 / 디버깅 용도). 실 환경에서 더 긴 window 필요 시 v0.31+ 조정.

---

## 12. 기준 commit

- branch: `claude/heuristic-cori-7865e7`
- 이전 functional baseline: WS3 v0.29.0 Integrated Limited Live Pipeline + Multi-market LOW_SIGNAL Validation Success (`afa7284`)
- 본 commit: (push 후 기록, push 별도 승인)

---

## 13. 이번 단계의 핵심 (재인용)

```text
v0.30 = 실코인 자동 알람 아님
v0.30 = forced TEST_ONLY Telegram 경로 검증 모드
후보가 없어도 isCandidate=false 결과 1건을 강제로 Telegram 발송 가능
별도 confirmPhrase 'SEND_WS3_FORCED_TEST_CANDIDATE' + forcedTestReason 필수
별도 enable env 'WS3_CANDIDATE_TEST_ENABLED=true' 필수 (normal/forced 공통)
모든 메시지에 TEST_ONLY / 실전 알람 아님 / 강제 후보 테스트 / 매수·매도 추천 아님 라벨 강제
candidate 저장 0건 / tracking 시작 0건 / snapshot 0건 / evaluation 0건 / audit 0건
KV write 가능 범위 = candidate test duplicate guard 단일 key 만 (audit payload 에 messageType 명시)
Limited Live Mode 변경 0건 (DISABLED 유지)
실 Telegram 발송 / 실 KV write / 실 deploy = 별도 Deploy Validation Gate 에서만 1회 한정
실전 스캐너 알람은 v0.31 이후 별도 승인으로만 진행
```
