# WS3 Changelog

> 이 파일은 WS3 (WOOS Scanner V3) 작업 변경 이력을 누적 기록한다.  
> 신규 작업 단계는 상단에 추가.

---

## [v0.31.0] — 2026-05-19 (Web-first Minimum Operator Mode Pack)

### 목적 (검증 우선 → 웹 운영 우선 전환 / 자동 알람 아님)
v0.31 = 검증용 콘솔에서 **운영자 수동 운영 최소 웹 콘솔**로 전환. 30~50개 코인 웹 스캔 + 운영자 후보 카드 검토 + 선택 후보 1건 LIMITED LIVE / OPERATOR REVIEW 라벨 수동 전송. 실 Telegram / KV write / Cloudflare deploy / 실 거래소 API 호출 — 본 commit 까지 mock 만.

방향 전환: 기능 단위 사전 검증 minimize → 운영 가능한 최소 웹 기능 한 번에 구현 → 필수 안전 테스트만 → 배포 → 자연검증.

### Added
- `/docs/ws3/WS3_v0_31_0_WEB_FIRST_MINIMUM_OPERATOR_MODE_REPORT.md` — v0.31 완료 보고서 (13 sections)
- `/workers/ws3-telegram-canary-worker.js` 확장 (2381 → 2759 라인, +378):
  - `VERSION = 'WS3_v0.31.0_web_first_minimum_operator_mode'`
  - 신규 상수 6종: `LIMITED_LIVE_MODE='LIMITED_LIVE_OPERATOR_REVIEW'` / `LIMITED_LIVE_MESSAGE_TYPE='LIMITED_LIVE_OPERATOR_REVIEW'` / `LIMITED_LIVE_CONFIRM_PHRASE='SEND_WS3_LIMITED_LIVE_REVIEW'` / `LIMITED_LIVE_GUARD_KEY_PREFIX='ws3:canary:limitedLiveAlertSent:'` / `LIMITED_LIVE_GUARD_REASON='LIMITED_LIVE_REVIEW_SENT'` / `LIMITED_LIVE_GUARD_WINDOW_MS=60000`
  - 신규 env (worker 코드에서 read only, wrangler-canary.toml 미설정 → default 'false' 동작): `WS3_LIMITED_LIVE_ENABLED`
  - 신규 helper 함수 (인라인, 신규 require 0건):
    - `classifyOperatorReview(score, grade, reasonChips, features)` — 운영자 검토 flag + level (HOT_REVIEW / WATCH_REVIEW / LOW_SIGNAL) + reason
    - `operatorReviewLevelPriority(level)` — 정렬 priority
    - `countOperatorReviewByLevel(results)` — 응답 audit count
    - `buildLimitedLiveGuardKey(market, timeframe)` — per-(market,timeframe) KV key
    - `validateLimitedLiveAlertRequest(body)` — 인증 + 자격 (`isCandidate || (operatorReview && allowOperatorReviewSend)`) + chip sanitize
    - `buildLimitedLiveAlertMessageText(c)` — LIMITED LIVE / OPERATOR REVIEW preamble (자동 매수·매도 추천 아님 / 운영자 검토 필요 / Manual operator review only 강제)
    - `sendLimitedLiveAlertTelegram(deps, env, text)` — 인라인 Telegram fetch (5s timeout, raw response 폐기)
    - `buildLimitedLiveAlertResponse(kvWritten)` — `kvWriteScope='LIMITED_LIVE_GUARD_ONLY'` 명시
  - **POST `/send-limited-live-alert`** 엔드포인트 (4중 인증 + enable gate + confirmPhrase + selectedCandidate 자격 검증 + per-(market,timeframe) 60s KV guard + fixed-text Telegram 1건 + KV write 1건 = per-key guard 만)
  - OPTIONS preflight 허용 path 확장: 9 → 10 (`/send-limited-live-alert` 추가)
  - Multi-candidate pipeline 확장 — 각 ok result row 에 `operatorReview` / `operatorReviewLevel` / `operatorReviewReason` 추가, 정렬 priority 변경 (`operatorReviewLevel → score → volumeRatio → closePosition`), 응답에 `operatorReviewCounts: {HOT_REVIEW, WATCH_REVIEW, LOW_SIGNAL}` 신규 필드
- `/web/ws3-canary-console.html` 확장 (1494 → 1724 라인, +230):
  - Section 8 (Multi-market): `Load 40-market Upbit preset` 버튼 추가 (KRW-BTC / KRW-ETH / ... / KRW-PYTH 40종 채우고 limit=60 설정). 결과 카드 rendering 에 `operatorReviewLevel` 색상 배지 (HOT_REVIEW 빨강 / WATCH_REVIEW 주황 / LOW_SIGNAL 회색) + `[OP-REVIEW]` 라벨 (isCandidate=false 이지만 operatorReview=true)
  - **Section 11 신규 "Minimum Operator Mode (v0.31 LIMITED LIVE / OPERATOR REVIEW)"**:
    - Limited Live Mode 상태 표시
    - Selected Operator Review Card select (Section 8 결과에서 HOT_REVIEW / WATCH_REVIEW / isCandidate=true 만 표시, round-trip JSON)
    - `Allow Operator Review send` 체크박스 (isCandidate=false 카드를 LIMITED LIVE 라벨로 전송 허용)
    - Confirm Phrase 입력
    - Send LIMITED LIVE / OPERATOR REVIEW 버튼 (Danger Zone 시각 분리)
    - 결과 panel whitelist 9 fields (code / mode / messageType / fixedMessageUsed / telegramSent / kvWritten / kvWriteScope / candidateStored / trackingStarted)
    - 발송 후 confirm phrase + selection + allowOR 즉시 클리어
  - Section 8 → Section 11 selector 동기화 (mcUpdateCandidateSelector wrap, mc Section 9 Forced selector 와 동시 갱신)
- `/web/ws3-canary-console/index.html` 위 동일 변경 (byte-for-byte mirror 유지, 68102 → 84866 bytes / 1494 → 1724 라인 일치)

### Changed
- `/docs/ws3/WS3_CHANGELOG.md` (본 파일): `[v0.31.0]` entry 상단 추가
- `/docs/ws3/WS3_CURRENT_BASELINE.md`: baseline → v0.31.0 + 완료된 단계 row 추가 + v0.31.0 핵심 메모 추가
- worker `VERSION` 상수: `WS3_v0.30.0_forced_candidate_test_telegram` → `WS3_v0.31.0_web_first_minimum_operator_mode`

### `/send-limited-live-alert` 인증 (7 layers)
| # | 조건 | 위반 시 |
|---|---|---|
| 1 | Origin allowlist | `ORIGIN_MISSING` / `ORIGIN_NOT_ALLOWED` 403 |
| 2 | `X-WS3-Canary-Token` exact | `MISSING_INVOKE_TOKEN` 401 / `INVOKE_TOKEN_MISMATCH` 403 |
| 3 | `body.manualTrigger === true` | `MANUAL_TRIGGER_REQUIRED` 400 |
| 4 | `env.WS3_LIMITED_LIVE_ENABLED === 'true'` | `LIMITED_LIVE_DISABLED` 503 |
| 5 | `body.confirmPhrase === 'SEND_WS3_LIMITED_LIVE_REVIEW'` byte-for-byte | `LIMITED_LIVE_CONFIRM_PHRASE_REQUIRED` 403 |
| 6 | `selectedCandidate.source='multi-candidate-dry-run'` 정합 + 자격 (`isCandidate || (operatorReview && allowOperatorReviewSend)`) | `LIMITED_LIVE_INVALID_PAYLOAD` 400 |
| 7 | KV `limitedLiveAlertSent:<market>:<timeframe>` 60s 윈도우 | `LIMITED_LIVE_ALREADY_SENT` 429 |

별도 enable env (`WS3_LIMITED_LIVE_ENABLED`) — `WS3_CANDIDATE_TEST_ENABLED` (v0.29) / `CANARY_ENABLED` (v0.18) 와 분리.

### operatorReview 분류기 (별도 from isCandidate)
- `isCandidate = (grade === 'P-S' || grade === 'P-A')` (v0.28 그대로, score 산식 기반)
- `operatorReview` 기준 (어느 하나라도 충족):
  - `score >= 20`
  - `grade in {P-S, P-A, P-B}`
  - chip `VOLUME_SURGE` 존재
  - chip `HIGH_CLOSE_POSITION` + `changePct > 0`
  - `volumeRatio >= 1.2` + `closePosition >= 0.6`
  - chip `SHORT_MOMENTUM`
  - chip `POSITIVE_CHANGE`
- Level:
  - `HOT_REVIEW`: score>=45 OR grade>=P-B
  - `WATCH_REVIEW`: operatorReview=true & not HOT_REVIEW
  - `LOW_SIGNAL`: 그 외

### LIMITED LIVE / OPERATOR REVIEW preamble (Telegram 본문)
```text
[WOOS WS3 LIMITED LIVE / OPERATOR REVIEW]
자동 매수/매도 추천 아님
운영자 검토 필요
Manual operator review only.
This is not a live trading alert.

Market / Exchange / Timeframe / Score / Grade
Operator review level
isCandidate
Reason chips
candidateStored: false
trackingStarted: false
```
- 매수 추천 / 진입 추천 / 수익 보장 / 확정 신호 / LIVE BUY 문구 0건 (smoke S7 검증)
- raw exchange data / 가격 / 거래량 숫자 미포함 (score/grade/chips/operatorReviewLevel 만)

### KV duplicate guard (per-key)
- key prefix: `ws3:canary:limitedLiveAlertSent:` + market + ':' + timeframe
- 예: `ws3:canary:limitedLiveAlertSent:KRW-BTC:5m`
- 형식: `{schemaVersion:'v1', lastSentAt:nowMs, reason:'LIMITED_LIVE_REVIEW_SENT', messageType:'LIMITED_LIVE_OPERATOR_REVIEW', market, timeframe, score, grade, operatorReviewLevel}`
- 윈도우: 60s
- per-(market,timeframe) 분리 → KRW-BTC 5m 전송 직후에도 KRW-ETH 5m / KRW-BTC 15m 등은 차단되지 않음 (smoke S5/S5b 검증)
- 사용: `CanaryStateKvAdapter.getJson` / `putJson` generic primitives (어댑터 파일 수정 0건)
- v0.29 candidate test guard (`ws3:canary:candidateTestSent`, single key) 와 별도 namespace

### 신규 safe code (6종)
- `LIMITED_LIVE_REVIEW_SENT` 200
- `LIMITED_LIVE_DISABLED` 503
- `LIMITED_LIVE_CONFIRM_PHRASE_REQUIRED` 403
- `LIMITED_LIVE_INVALID_PAYLOAD` 400
- `LIMITED_LIVE_ALREADY_SENT` 429
- `LIMITED_LIVE_TELEGRAM_ERROR` 502

기존 v0.25-v0.30 safe code 모두 유지.

### no-write scope grep 검증
- `/multi-candidate-dry-run` scope: `putJson` / `.put(` / `sendCanary` / `dispatchCanary` / `sendMessage` 매치 **0건** (v0.30 그대로 유지)
- `/send-limited-live-alert` scope: `putJson(llKv, llGuardKey, ...)` **1건만** (per-(market,timeframe) guard). 다른 KV writer / canary sender 호출 0건.
- `/send-candidate-test` (normal/forced) scope: v0.30 그대로 (`putJson(CANDIDATE_TEST_GUARD_KEY)` 1건만).

### mock smoke 결과 (17 시나리오 — spec 10 essential + 7 추가 audit)
```
TOTAL=17 PASS=17 FAIL=0
```
**Essential (S1-S5b)**: disabled gate / confirm 검증 / 자격 검증 (no allowOR, 자격 없음, allowOR with operatorReview) / mock success natural + OR card / duplicate guard 같은 market+timeframe / 다른 market 차단 안 됨.
**Audit (S6-S13)**: Telegram body 필수 라벨 (LIMITED LIVE / OPERATOR REVIEW / 자동 매수·매도 추천 아님 / 운영자 검토 필요 / Manual operator review only / candidateStored:false / trackingStarted:false) / 금지 라벨 (매수하세요 / 진입 추천 / 수익 보장 / 확정 신호 / LIVE BUY) 0건 / response candidateStored=false / trackingStarted=false / multi-dry-run regression (operatorReview 필드 추가 / Telegram·KV 0건) / raw Telegram response leak CLEAN / secret leak CLEAN / KV guard key per-market+timeframe.

실 거래소 API 호출 0건. 실 Telegram API 호출 0건. 실 KV API 호출 0건.

### Web Console UI 보강
- Section 8 Load 40-market preset 버튼 + 결과 카드 operatorReviewLevel 색상 배지 + [OP-REVIEW] 라벨
- Section 11 신규 (Minimum Operator Mode): selected card / allowOR 체크박스 / confirm phrase / Send 버튼 / 결과 panel
- Section 8 → Section 11 selector 동기화 (eligible 카드만 표시)
- 사용자 클릭시에만 fetch / auto refresh 0건 / 1.5s throttle / token `readTokenAndClear()` 즉시 클리어
- 두 console 파일 byte-for-byte mirror 유지

### Protected (수정 0건)
- 본선 `worker.js` / `wrangler.toml` (repo 미존재) / `index.html` / `manifest.json` / `service-worker.js` — 미수정
- `v3/` 25종 엔진 — 미수정
- `docs/ws3/WS3_CODE_CONTRACT.md` / `WS3_WORKFLOW_TEMPLATE.md` — 미수정
- `workers/ws3-canary-state-kv-adapter.js` — 미수정 (generic getJson/putJson 만 재사용)
- `wrangler-canary.example.toml` / `.gitignore` — 미수정
- `workers/ws3-telegram-canary-entry.mjs` — 미스테이지 유지

### 보안 / 누출 검증 (0건 확인)
- bot token / chatId / invoke token / KV namespace id / Telegram message_id / raw Telegram response / IP / cookie / session id / browser fingerprint — 노출 0건
- exchange API raw native field — response 본문 노출 0건
- 노출된 폐기 hash repo-wide 매치 0건
- masked / first-4 / last-4 / redacted preview 0건
- localStorage / sessionStorage / IndexedDB / document.cookie 호출 0건
- URL query parameter token 전달 0건
- console.log 출력 0건
- 매수 추천 / 진입 추천 / 수익 보장 / 확정 신호 / LIVE BUY — 0건 (smoke S7)
- LIMITED LIVE preamble 안전 라벨 6+ 종 명시 (smoke S6)

### Cloudflare 변경 0건
- worker 재배포 0건 (v0.30 production Version 그대로)
- Pages 재배포 0건
- KV namespace 생성/변경 0건
- KV binding 변경 0건
- secrets 변경 0건
- `WS3_CANARY_ALLOWED_ORIGINS` 변경 0건
- `WS3_CANDIDATE_TEST_ENABLED='false'` 유지 (v0.30 Step M 복귀 상태 유지)
- `WS3_LIMITED_LIVE_ENABLED` 변경 0건 (env 선언 안된 default 'false', deploy Gate 에서 임시 'true' 활성화 예정)
- 실 Telegram API 호출 0건
- 실 KV write 0건
- 실 `/send-limited-live-alert` 호출 0건
- 실 거래소 API 호출 0건

### 의도된 미구현 (다음 Gate)
- v0.31 Deploy/Minimum Live Validation Gate (별도, 필수 테스트만): Worker redeploy + Pages redeploy + Check State + 40-market preset scan + operator review card 확인 + `WS3_LIMITED_LIVE_ENABLED=false` 차단 확인 + 'true' 임시 활성화 + Worker redeploy + Send LIMITED LIVE / OPERATOR REVIEW 1회 + duplicate 차단 확인 + 운영 유지 여부 사용자 결정 (`true` 유지 또는 `false` 복귀)
- v0.32 후보: score / operatorReview 임계값 자연검증 후 조정 / browser memory-only history 확장 / Cloudflare Access 재검토 / rate limit per origin·market·minute / invoke token rotate automation / ipHash + `WS3_CANARY_HASH_SALT`
- 자동 운영 (Cron / auto Telegram / candidate 저장 / tracking 시작) 은 v0.32+ 별도 단계, 사용자 명시 승인 필수

### 기준 commit
- branch: `claude/heuristic-cori-7865e7`
- 이전 functional baseline: WS3 v0.30.0 Forced Candidate TEST_ONLY Telegram + Live Validation Success (`46b6d5d`)
- 본 commit: (push 후 기록, push 별도 승인)

---

## [v0.30.0] — 2026-05-19 (Forced Candidate TEST_ONLY Telegram Validation Pack)

### Verified (Cloudflare Worker redeploy 3회 + Pages deploy + production FORCED Candidate TEST_ONLY Telegram 1회 실 호출 — 코드 변경 0건 / tracked source 변경 0건 / Telegram 발송 1건 / KV write 1건 (CANDIDATE_TEST_GUARD_ONLY))
- v0.30 Worker was deployed successfully (Step B initial / Step K WS3_CANDIDATE_TEST_ENABLED='true' / Step M 'false' 복귀 — 총 3 Worker version, 모두 size 180.33 KiB / gzip 28.15 KiB).
- v0.30 Web Console was deployed successfully to `ws3-canary-console.pages.dev` (production branch, Section 9 forced mode UI 반영).
- Production console Check State returned `version=WS3_v0.30.0_forced_candidate_test_telegram` / `canaryEnabled=false` / `persistenceAvailable=true` / `alreadySent=false` / `cleanupRequired=false` / `circuitOpen=false` / `currentPhase=RESET_CONFIRMED`.
- Multi-market Candidate Dry-run was executed successfully (`exchange=upbit` / `timeframe=5m` / `marketCount=10`, LOW_SIGNAL 계열 결과).
- FORCED Candidate TEST_ONLY Telegram was sent **once**.
- The selected forced test candidate: market=`KRW-NEAR`, score=`19`, grade=`P-C`, reasonChips=`LOW_VOLUME, HIGH_CLOSE_POSITION`, forcedTestReason=`path validation after LOW_SIGNAL multi-market dry-run`, source=`multi-candidate-dry-run`.
- The Telegram message included all required safety labels (7 strict + 4 audit lines):
  - `[WOOS WS3 FORCED CANDIDATE TEST_ONLY]`
  - `This is not a live trading alert.`
  - `manual forced validation only.`
  - `실전 알람 아님`
  - `테스트 전송`
  - `강제 후보 테스트`
  - `매수/매도 추천 아님`
  - `mode: FORCED_TEST_ONLY` / `source: multi-candidate-dry-run` / `candidateStored: false` / `trackingStarted: false`
- 매수 추천 / 수익 보장 / `LIVE BUY` / 진입 추천 문구 0건. raw exchange data / 가격 / 거래량 숫자 미포함.
- Response: `code=FORCED_CANDIDATE_TEST_SENT` / `mode=FORCED_TEST_ONLY` / `messageType=FORCED_CANDIDATE_TEST_ONLY` / `fixedMessageUsed=true` / `telegramSent=true` / `kvWritten=true` / `kvWriteScope=CANDIDATE_TEST_GUARD_ONLY` / `candidateStored=false` / `trackingStarted=false`.
- Step K `WS3_CANDIDATE_TEST_ENABLED="true"` 임시 활성화 → Worker redeploy (Version single fragment `7edff370`).
- Step M `WS3_CANDIDATE_TEST_ENABLED="false"` 복귀 → Worker redeploy (Version single fragment `492abcda`, binding display 풀값 노출 확인). FORCED Candidate TEST_ONLY 추가 발송 차단 production 반영.
- Limited Live Mode remained **DISABLED** throughout.
- Telegram API calls during this gate: **1** (Step L 만).
- KV writes during this gate: **1** (Step L duplicate guard 만, key `ws3:canary:candidateTestSent`, audit `messageType='FORCED_CANDIDATE_TEST_ONLY'` 포함).
- Additional Telegram calls after Step L: 0 / Additional KV writes after Step L: 0.
- raw Telegram response, raw exchange full response, Invoke Token, invite code, invite hash, KV namespace ID — **not recorded** in repo / chat / log.
- 결과 판정: FORCED Candidate TEST_ONLY Telegram 경로 실검증 성공. forced mode 메시지 안전 라벨 / KV write scope 분리 / candidate 저장·tracking 시작 0건 / WS3_CANDIDATE_TEST_ENABLED='false' 복귀 모두 정상 작동 검증.

### 목적 (실코인 자동 알람 아님 / forced Telegram 경로 검증)
v0.30 = **후보 미발생 환경에서도 Candidate Telegram 경로를 1회 검증** 할 수 있도록 `forceTestCandidate=true` 모드 추가. isCandidate=false dry-run 결과도 강제로 1회 TEST_ONLY Telegram 발송 가능. 실 Telegram / KV write / Cloudflare deploy — 본 commit 까지 mock 만, 실 호출은 별도 Deploy Validation Gate.

### Added
- `/docs/ws3/WS3_v0_30_0_FORCED_CANDIDATE_TEST_TELEGRAM_REPORT.md` — v0.30 완료 보고서 (13 sections)
- `/workers/ws3-telegram-canary-worker.js` 확장 (2311 → 2381 라인, +70):
  - `VERSION = 'WS3_v0.30.0_forced_candidate_test_telegram'`
  - 신규 상수 6종: `FORCED_CANDIDATE_TEST_MODE='FORCED_TEST_ONLY'` / `FORCED_CANDIDATE_TEST_MESSAGE_TYPE='FORCED_CANDIDATE_TEST_ONLY'` / `FORCED_CANDIDATE_TEST_CONFIRM_PHRASE='SEND_WS3_FORCED_TEST_CANDIDATE'` / `FORCED_CANDIDATE_TEST_GUARD_REASON='FORCED_CANDIDATE_TEST_SENT'` / `FORCED_CANDIDATE_TEST_REASON_MAX_LEN=128` / `FORCED_CANDIDATE_TEST_REASON_PATTERN=/^[A-Za-z0-9 _\-\.\,\:\!\?\(\)\[\]\/]{1,128}$/`
  - `validateCandidateTestRequest` 확장: `body.forceTestCandidate === true` 감지 → forced 모드 별도 confirmPhrase + forcedTestReason 검증 + 에러 코드 namespace 전체 `FORCED_CANDIDATE_TEST_*` 로 전환. normal 모드 동작 그대로 유지.
  - `buildCandidateTestMessageText` 확장: forced 분기 시 별도 preamble (FORCED CANDIDATE TEST_ONLY / manual forced validation only / 강제 후보 테스트 + mode/source/candidateStored/trackingStarted 명시 라인 + Forced reason 라인)
  - `buildCandidateTestResponse(kvWritten, forced)` 확장: forced 분기 시 `code='FORCED_CANDIDATE_TEST_SENT'` / `mode='FORCED_TEST_ONLY'` / `messageType='FORCED_CANDIDATE_TEST_ONLY'`
  - `/send-candidate-test` 핸들러 변경: disabled gate check 위치를 body parse 직후로 이동 — body.forceTestCandidate 기반 `CANDIDATE_TEST_DISABLED` vs `FORCED_CANDIDATE_TEST_DISABLED` 분기. duplicate guard / Telegram error 코드도 forced-aware 분기.
  - KV guard payload audit 확장: `messageType` (FORCED_CANDIDATE_TEST_ONLY / CANDIDATE_TEST_ONLY) + `market` audit 필드 추가 (closure 시점 normal/forced 구분 가능). guard key 는 동일 `ws3:canary:candidateTestSent`.
- `/web/ws3-canary-console.html` Section 9 확장 (1435 → 1494 라인, +59):
  - `Forced Test Mode` 체크박스 (default off)
  - `Forced Test Reason` 입력칸 (forced 시에만 표시, maxlength=128, 정규식 sanitize)
  - `Confirm Phrase` placeholder + Send 버튼 라벨 모드 따라 swap
  - 결과 panel 에 `mode` 필드 추가
  - mode 토글 시 `confirmPhrase` + `forcedTestReason` 모두 즉시 클리어 (carry-over 방지)
  - 발송 후 / 네트워크 실패 후 `forcedTestReason` 즉시 클리어
- `/web/ws3-canary-console/index.html` 위 동일 변경 (byte-for-byte mirror 유지, 68102 → 71874 bytes / 1435 → 1494 라인 일치)

### Changed
- `/docs/ws3/WS3_CHANGELOG.md` (본 파일): `[v0.30.0]` entry 상단 추가
- `/docs/ws3/WS3_CURRENT_BASELINE.md`: baseline → v0.30.0 + 완료된 단계 row 추가 + v0.30.0 핵심 메모 추가
- worker `VERSION` 상수: `WS3_v0.29.0_integrated_limited_live_pipeline` → `WS3_v0.30.0_forced_candidate_test_telegram`

### `/send-candidate-test` 인증 (5중, forced 모드)
| # | 조건 | 위반 시 |
|---|---|---|
| 1 | Origin allowlist 통과 | `ORIGIN_MISSING` / `ORIGIN_NOT_ALLOWED` 403 |
| 2 | `X-WS3-Canary-Token` exact | `MISSING_INVOKE_TOKEN` 401 / `INVOKE_TOKEN_MISMATCH` 403 |
| 3 | `body.manualTrigger === true` | `MANUAL_TRIGGER_REQUIRED` 400 |
| 4 | `env.WS3_CANDIDATE_TEST_ENABLED === 'true'` | forced 시 `FORCED_CANDIDATE_TEST_DISABLED` 503 / normal 시 `CANDIDATE_TEST_DISABLED` 503 |
| 5 | forced 시 `body.confirmPhrase === 'SEND_WS3_FORCED_TEST_CANDIDATE'` + `body.forcedTestReason` 정규식+길이 통과 / normal 시 `body.confirmPhrase === 'SEND_WS3_TEST_CANDIDATE'` | forced 시 `FORCED_CANDIDATE_TEST_CONFIRM_PHRASE_REQUIRED` 403 / `FORCED_CANDIDATE_TEST_INVALID_PAYLOAD` 400 / normal 시 기존 코드 |
| 6 | `selectedCandidate.source === 'multi-candidate-dry-run'` + 정합 | forced 시 `FORCED_CANDIDATE_TEST_INVALID_PAYLOAD` 400 / normal 시 `CANDIDATE_TEST_NO_CANDIDATE` 400 / `CANDIDATE_TEST_INVALID_PAYLOAD` 400 |
| 7 | KV `candidateTestSent.lastSentAt` 60s 이내면 차단 | forced 시 `FORCED_CANDIDATE_TEST_ALREADY_SENT` 429 / normal 시 `CANDIDATE_TEST_ALREADY_SENT` 429 |

### forced fixed safety preamble (Telegram 본문)
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
- 매수 추천 / 수익 보장 / `LIVE BUY` / 진입 추천 문구 0건 (smoke S13 검증)
- raw exchange data / 가격 / 거래량 숫자 미포함 (score/grade/chips/forcedReason 만)
- normal 모드 preamble 은 v0.29 그대로

### normal preamble 미변경 (v0.29 그대로)
```text
[WOOS WS3 CANDIDATE TEST_ONLY]
This is not a live trading alert.
manual limited validation only.
실전 알람 아님
테스트 전송
매수/매도 추천 아님
...
```

### KV duplicate guard (forced/normal 공통, audit 분리)
- key: `ws3:canary:candidateTestSent` (동일, scope=`CANDIDATE_TEST_GUARD_ONLY`)
- 형식: `{schemaVersion:'v1', lastSentAt:nowMs, reason:..., messageType:..., market:...}`
- forced: `reason='FORCED_CANDIDATE_TEST_SENT'` / `messageType='FORCED_CANDIDATE_TEST_ONLY'`
- normal: `reason='CANDIDATE_TEST_SENT'` / `messageType='CANDIDATE_TEST_ONLY'`
- 윈도우: 60s (normal/forced 공통)
- 사용: `CanaryStateKvAdapter.getJson` / `putJson` generic primitives (어댑터 파일 수정 0건)
- 다른 canary state KV key (alreadySent / cleanupRequired / circuit / invokeFail / operatorReset) 일체 read/write 0건

### 신규 safe code (6종)
- `FORCED_CANDIDATE_TEST_SENT` 200
- `FORCED_CANDIDATE_TEST_DISABLED` 503
- `FORCED_CANDIDATE_TEST_CONFIRM_PHRASE_REQUIRED` 403
- `FORCED_CANDIDATE_TEST_INVALID_PAYLOAD` 400
- `FORCED_CANDIDATE_TEST_ALREADY_SENT` 429
- `FORCED_CANDIDATE_TEST_TELEGRAM_ERROR` 502

기존 v0.25 / v0.26.1 / v0.27 / v0.28 / v0.29 safe code 모두 유지.

### no-write scope grep 검증
- `/multi-candidate-dry-run` handler scope: KV writer / Telegram 호출 매치 **0건** (v0.29 그대로)
- `/send-candidate-test` handler scope: `putJson(CANDIDATE_TEST_GUARD_KEY)` **1건만** (normal/forced 공통, audit payload 만 다름). 다른 KV writer / canary sender 호출 0건.

### mock smoke 결과 (27 시나리오 — spec 20 forced + 7 추가 regression/audit)
```
TOTAL=27 PASS=27 FAIL=0
```
**Forced (S1-S18)**: 인증 3종 + disabled gate + confirm 2종 + payload 검증 4종 + mock success + messageType + Telegram body 필수 라벨 (FORCED CANDIDATE TEST_ONLY / 실전 알람 아님 / 강제 후보 테스트 / mode FORCED_TEST_ONLY 등) + 금지 라벨 (매수하세요 / LIVE BUY 등) 0건 + candidateStored=false + trackingStarted=false + KV put 1건만 + raw Telegram response leak CLEAN + duplicate guard 429.
**Regression / namespace separation (S19-S25)**: normal candidate path 회귀 / multi-dry-run 회귀 (Telegram 0 / KV 0) / forced bad score 차단 / normal disabled gate 정상 코드 / forced phrase 와 normal phrase 교차 사용 차단 / KV guard audit payload messageType 명시.

실 거래소 API 호출 0건. 실 Telegram API 호출 0건. 실 KV API 호출 0건.

### Web Console Section 9 확장
- `Forced Test Mode` 체크박스 + `Forced Test Reason` 입력칸 (forced 시 표시) + 모드별 placeholder/버튼 라벨 swap
- 모드 토글 시 confirmPhrase + forcedTestReason 즉시 클리어 / 발송 후 / 네트워크 실패 후 forcedTestReason 즉시 클리어
- Send 버튼 enable: `hasSel && phraseOk && (forced ? reasonOk : true)`
- 결과 panel `mode` 필드 추가
- client-side `CT_FORCED_REASON_PATTERN` server-side 와 동일
- 두 console 파일 byte-for-byte mirror 유지

### Protected (수정 0건)
- 본선 `worker.js` / `wrangler.toml` (repo 미존재) / `index.html` / `manifest.json` / `service-worker.js` — 미수정
- `v3/` 25종 엔진 — 미수정
- `docs/ws3/WS3_CODE_CONTRACT.md` / `WS3_WORKFLOW_TEMPLATE.md` — 미수정
- `workers/ws3-canary-state-kv-adapter.js` — 미수정 (generic getJson/putJson 만 재사용)
- `wrangler-canary.example.toml` / `.gitignore` — 미수정
- `workers/ws3-telegram-canary-entry.mjs` — 미스테이지 유지

### 보안 / 누출 검증 (0건 확인)
- bot token / chatId / invoke token / KV namespace id / Telegram message_id / raw Telegram response / IP / cookie / session id / browser fingerprint — 노출 0건
- exchange API raw native field — response 본문 노출 0건
- 노출된 폐기 hash repo-wide 매치 0건
- masked / first-4 / last-4 / redacted preview 0건
- localStorage / sessionStorage / IndexedDB / document.cookie 호출 0건
- URL query parameter token 전달 0건
- console.log 출력 0건
- 매수 추천 / 수익 보장 / LIVE BUY / 진입 추천 — 0건 (smoke S13)

### Cloudflare 변경 0건
- worker 재배포 0건 (v0.29 production Version 그대로)
- Pages 재배포 0건
- KV namespace 생성/변경 0건
- KV binding 변경 0건
- secrets 변경 0건
- `WS3_CANARY_ALLOWED_ORIGINS` 변경 0건
- `WS3_CANDIDATE_TEST_ENABLED` 변경 0건 (선언만 v0.29 그대로 default 'false')
- 실 Telegram API 호출 0건
- 실 KV write 0건
- 실 `/send-candidate-test` (normal/forced) 호출 0건
- 실 거래소 API 호출 0건

### 의도된 미구현 (다음 Gate)
- v0.30 Deploy/Live Validation Gate (별도): Worker redeploy + Pages redeploy + `WS3_CANDIDATE_TEST_ENABLED='true'` 임시 활성화 + production console 에서 Multi-market Dry-run → top result 선택 → Section 9 forced 모드 + forcedTestReason + `SEND_WS3_FORCED_TEST_CANDIDATE` 입력 → Send FORCED Candidate TEST_ONLY 1회 → Telegram 수신 확인 (FORCED preamble) → `WS3_CANDIDATE_TEST_ENABLED='false'` 복귀
- v0.31 후보 A: Candidate Scoring Calibration
- v0.31 후보 B: Multi-market history persistence (browser memory-only 확장)
- v0.31 후보 C: Security hardening before live candidate alert
- env-based `MULTI_CANDIDATE_DISABLED` / `CANDIDATE_TEST_DISABLED` 강제 kill switch
- rate limit per origin / market / minute / invoke token rotate automation / ipHash + `WS3_CANARY_HASH_SALT`

### 기준 commit
- branch: `claude/heuristic-cori-7865e7`
- 이전 functional baseline: WS3 v0.29.0 Integrated Limited Live Pipeline + Multi-market LOW_SIGNAL Validation Success (`afa7284`)
- 코드 commit: `3c36d63` (ws3: v0.30.0 forcedCandidateTestTelegram, push 완료)
- live validation closure commit: 본 closure commit (코드 변경 0건 / docs 3개만 — push 별도 승인)

---

## [v0.29.0] — 2026-05-19 (Integrated Limited Live Pipeline Pack)

### Verified (Cloudflare Worker redeploy + Pages deploy + production Multi-market Dry-run 1회 실 호출 — 코드 변경 0건 / tracked source 변경 0건)
- v0.29 Worker was deployed successfully (production version, `/multi-candidate-dry-run` + `/send-candidate-test` route 포함, `WS3_CANDIDATE_TEST_ENABLED` 미설정 default 'false').
- v0.29 Web Console was deployed successfully to `ws3-canary-console.pages.dev` (production branch, Sections 8 / 9 / 10 UI 반영).
- Production console Check State returned `version=WS3_v0.29.0_integrated_limited_live_pipeline` / `canaryEnabled=false` / `persistenceAvailable=true` / `alreadySent=false` / `cleanupRequired=false` / `circuitOpen=false` / `currentPhase=RESET_CONFIRMED`.
- `/multi-candidate-dry-run` was executed **once** for 10 Upbit KRW markets (KRW-BTC, KRW-ETH, KRW-XRP, KRW-SOL, KRW-DOGE, KRW-ADA, KRW-AVAX, KRW-LINK, KRW-NEAR, KRW-SEI) / `timeframe=5m` / `limit=60`.
- The run completed successfully and returned `code=MULTI_CANDIDATE_DRY_RUN_OK` / `mode=MULTI_CANDIDATE_DRY_RUN_ONLY` / `marketCount=10` / `candidateCount=0` → **LOW_SIGNAL_NORMAL** (후보 미발생 = 정상 분류).
- Top result: market=`KRW-NEAR`, score=`24`, grade=`P-C`, reasonChips=`HIGH_CLOSE_POSITION`, latestTime=`2026-05-19T07:50:00Z`, lastClose=`2480`. 모든 10 markets P-C 분류.
- 점수 산식 검증 포인트: KRW-AVAX volRatio=15.102 / volAccel=10.831 (volume surge 강함) → `VOLUME_SURGE` chip +25 가산. 동시에 `upperWickPct >= bodyPct*2 AND closePosition < 0.6` → `UPPER_WICK_RISK` -15 감점. 최종 score=10 / grade=P-C / isCandidate=false. **단순 volume surge 만으로 후보 판정 안 함** = false positive 방지 로직 정상 작동.
- Candidate TEST_ONLY Telegram was **skipped** because `candidateCount=0` → Case 1 LOW_SIGNAL 분기.
- `WS3_CANDIDATE_TEST_ENABLED=true` was **not activated** (Step K/L/M 모두 생략).
- Limited Live Mode remained **DISABLED**.
- `telegramSent=false` / `kvWritten=false` / `candidateStored=false` / `trackingStarted=false`.
- Send Candidate TEST_ONLY / Send Canary / Cleanup Confirm / Operator Reset / Live Preflight / Candidate Dry-run extra calls during this gate: 모두 **0건**.
- Telegram API calls during this gate: **0**.
- KV writes during this gate: **0**.
- Candidate storage and tracking were not started.
- raw exchange full response, raw Telegram response, Invoke Token, invite code, invite hash, KV namespace ID — **not recorded** in repo / chat / log.
- 결과 판정: Multi-market dry-run 실검증 성공. 후보 미발생 = LOW_SIGNAL 정상 판정 (실패 아님). 점수 산식 / volume surge 가산 / upper wick risk 감점 / multi-market 환경 false positive 방지 모두 정상 작동.

### 목적 (실코인 자동 알람 아님 / 통합 제한 라이브 팩)
v0.29 = **여러 코인 dry-run → 후보 리스트 → 선택 후보 1건 TEST_ONLY Telegram 발송**까지 한 번에 검증하는 통합 제한 라이브 팩. **무제한 자동 알람 / Cron / candidate 저장 / tracking 자동 시작 — 모두 0건**. 실 Telegram / KV write / 실 거래소 API 호출 — 본 commit 까지 mock 만, 실 호출은 별도 Deploy Validation Gate.

### Added
- `/docs/ws3/WS3_v0_29_0_INTEGRATED_LIMITED_LIVE_PIPELINE_REPORT.md` — v0.29 완료 보고서 (17 sections)
- `/workers/ws3-telegram-canary-worker.js` 확장 (1718 → 2311 라인, +593):
  - `VERSION = 'WS3_v0.29.0_integrated_limited_live_pipeline'`
  - 신규 상수: `MULTI_CANDIDATE_DRY_RUN_MODE='MULTI_CANDIDATE_DRY_RUN_ONLY'` / `MULTI_CANDIDATE_MAX_MARKETS=10` / `CANDIDATE_TEST_MODE='CANDIDATE_TEST_ONLY'` / `CANDIDATE_TEST_CONFIRM_PHRASE='SEND_WS3_TEST_CANDIDATE'` / `CANDIDATE_TEST_MESSAGE_TYPE='CANDIDATE_TEST_ONLY'` / `CANDIDATE_TEST_GUARD_KEY='ws3:canary:candidateTestSent'` / `CANDIDATE_TEST_GUARD_REASON='CANDIDATE_TEST_SENT'` / `CANDIDATE_TEST_GUARD_WINDOW_MS=60000` / `LIMITED_LIVE_MODE_STATUS='DISABLED'`
  - 신규 helper 함수 (인라인, 신규 require 0건):
    - `validateMultiCandidateDryRunRequest(body)` — multi-market 입력 검증 + 정규화 + dedupe
    - `runMultiCandidatePipeline(deps, req)` — Promise.all 병렬 fetch + v0.27/v0.28 helper 재사용 + 정렬
    - `countCandidates(results)` / `buildMultiCandidateDryRunResponse(req, pipelineResult)`
    - `validateCandidateTestRequest(body)` — selectedCandidate 검증 (source/exchange/market/timeframe/score/grade/chips 정합)
    - `buildCandidateTestMessageText(c)` — fixed safety preamble + score/grade/chips (raw 가격/거래량 미포함)
    - `sendCandidateTestTelegram(deps, env, text)` — 인라인 Telegram fetch (5s timeout, raw response 미노출)
    - `buildCandidateTestResponse(kvWritten)` — `kvWriteScope='CANDIDATE_TEST_GUARD_ONLY'` 명시
  - **POST `/multi-candidate-dry-run`** 엔드포인트 (3중 인증 / 입력 검증 / 병렬 파이프라인 / score-desc 정렬 / KV 미사용 / Telegram 미호출)
  - **POST `/send-candidate-test`** 엔드포인트 (4중 인증 + confirmPhrase + selectedCandidate + KV duplicate guard 60s window / fixed-text Telegram 1건 / KV write 1건 = `CANDIDATE_TEST_GUARD_KEY` 만)
  - OPTIONS preflight 허용 path 확장: 7 → 9 (`/multi-candidate-dry-run` / `/send-candidate-test` 추가)
- `/web/ws3-canary-console.html` Sections 8 + 9 + 10 신규 추가 (990 → 1435 라인, +445):
  - Section 8 "Multi-market Candidate Dry-run (v0.29 read-only)": Exchange / Markets textarea (10 markets default, 콤마/줄바꿈) / Timeframe / Limit / Run 버튼 + 후보 리스트 (score desc 정렬) + Memory-only history (max 5 runs)
  - Section 9 "Candidate TEST_ONLY Telegram Send": Selected Candidate select (round-trip JSON 으로 dry-run 결과 전달) / Confirm Phrase 입력 / Send Candidate TEST_ONLY 버튼 (Danger Zone 시각 분리) — 응답 panel whitelist (`kvWriteScope` 명시)
  - Section 10 "Limited Live Mode": **DISABLED** 상태 표시 + 활성화 조건 5개 안내 (자동 활성화 코드 0건)
- `/web/ws3-canary-console/index.html` 위 동일 변경 (byte-for-byte mirror 유지, 45836 → 68102 bytes / 990 → 1435 라인 일치)

### Changed
- `/docs/ws3/WS3_CHANGELOG.md` (본 파일): `[v0.29.0]` entry 상단 추가
- `/docs/ws3/WS3_CURRENT_BASELINE.md`: baseline → v0.29.0 + 완료된 단계 row 추가 + v0.29.0 핵심 메모 추가
- worker `VERSION` 상수: `WS3_v0.28.0_candidate_dry_run` → `WS3_v0.29.0_integrated_limited_live_pipeline`

### 신규 env (선언만, default 'false')
- `WS3_CANDIDATE_TEST_ENABLED` (default 'false') — `/send-candidate-test` enable gate, CANARY_ENABLED 와 분리. **본 commit 까지 변경 0건**, deploy Gate 에서만 임시 'true' 활성화 + 검증 직후 'false' 복귀.

### /multi-candidate-dry-run 인증 (3중) — v0.27/v0.28 와 동일 layer 재사용

### /send-candidate-test 인증 (4중 + selectedCandidate + duplicate guard)
| # | 조건 | 위반 시 |
|---|---|---|
| 1 | Origin allowlist 통과 | `ORIGIN_MISSING` / `ORIGIN_NOT_ALLOWED` 403 |
| 2 | `X-WS3-Canary-Token` exact | `MISSING_INVOKE_TOKEN` 401 / `INVOKE_TOKEN_MISMATCH` 403 |
| 3 | `body.manualTrigger === true` | `MANUAL_TRIGGER_REQUIRED` 400 |
| 4 | `env.WS3_CANDIDATE_TEST_ENABLED === 'true'` | `CANDIDATE_TEST_DISABLED` 503 |
| 5 | `body.confirmPhrase === 'SEND_WS3_TEST_CANDIDATE'` byte-for-byte | `CANDIDATE_TEST_CONFIRM_PHRASE_REQUIRED` 403 |
| 6 | `selectedCandidate.source === 'multi-candidate-dry-run'` + 정합 | `CANDIDATE_TEST_NO_CANDIDATE` 400 / `CANDIDATE_TEST_INVALID_PAYLOAD` 400 |
| 7 | KV `candidateTestSent.lastSentAt` 60s 이내면 차단 | `CANDIDATE_TEST_ALREADY_SENT` 429 |

### v0.27/v0.28 helper 재사용 (multi-market 파이프라인)
- `buildLivePreflightUrl(exchange, market, timeframe, limit)` 그대로
- `fetchLiveCandles(deps, url, 5000)` 그대로 (5초 AbortController timeout)
- `normalizeCandles(exchange, raw, limit)` 그대로
- `calculateCandleStructureFeatures` / `calculateVolumeFeatures` / `calculateMomentumFeatures` 그대로
- `calculateCandidateDryRunScore` / `classifyCandidateDryRunGrade` 그대로

`mapFetchCodeToCandidateDryRunCode` 도 multi-market 개별 market 실패 코드에 그대로 적용 (per-market `results[]` entry 내 code).

### candidate TEST_ONLY fixed safety preamble (Telegram 본문)
```text
[WOOS WS3 CANDIDATE TEST_ONLY]
This is not a live trading alert.
manual limited validation only.
실전 알람 아님
테스트 전송
매수/매도 추천 아님

Exchange: ... / Market: ... / Timeframe: ... / Score: ... / Grade: ... / Reason chips: ...
```
- 매수 추천 / 수익 보장 / 자동 알람 문구 0건
- raw exchange data / 가격 / 거래량 숫자 미포함 (score/grade/chips 만)
- chips `/^[A-Z_]+$/` 화이트리스트 sanitize

### KV duplicate guard (single key only)
- key: `ws3:canary:candidateTestSent`
- 형식: `{schemaVersion:'v1', lastSentAt:nowMs, reason:'CANDIDATE_TEST_SENT'}`
- 윈도우: 60s
- 사용: `CanaryStateKvAdapter.getJson` / `putJson` generic primitives (어댑터 파일 수정 0건)
- alreadySent / cleanupRequired / circuit / invokeFail / operatorReset 등 다른 canary state KV key 는 일체 read/write 0건 (smoke S25 검증)

### 신규 safe code (16종)
**Multi-candidate (9)**: `MULTI_CANDIDATE_DRY_RUN_OK` 200 / `MULTI_CANDIDATE_PARTIAL_OK` 200 / `MULTI_CANDIDATE_ALL_FAILED` 502 / `MULTI_CANDIDATE_INVALID_EXCHANGE` 400 / `MULTI_CANDIDATE_INVALID_MARKETS` 400 / `MULTI_CANDIDATE_TOO_MANY_MARKETS` 400 / `MULTI_CANDIDATE_INVALID_TIMEFRAME` 400 / `MULTI_CANDIDATE_LIMIT_EXCEEDED` 400 / `MULTI_CANDIDATE_FEATURE_ERROR` 500
**Candidate test (7)**: `CANDIDATE_TEST_SENT` 200 / `CANDIDATE_TEST_DISABLED` 503 / `CANDIDATE_TEST_CONFIRM_PHRASE_REQUIRED` 403 / `CANDIDATE_TEST_INVALID_PAYLOAD` 400 / `CANDIDATE_TEST_NO_CANDIDATE` 400 / `CANDIDATE_TEST_ALREADY_SENT` 429 / `CANDIDATE_TEST_TELEGRAM_ERROR` 502

기존 v0.25 / v0.26.1 / v0.27 / v0.28 safe code 모두 유지.

### no-write scope grep 검증
- `/multi-candidate-dry-run` handler scope: `writeAlready*` / `writeCleanupRequired` / `writeCircuit` / `writeInvokeFail` / `writeOperatorReset` / `markAlreadySentReset` / `putJson` / `.put(` / `sendCanary` / `dispatchCanary` / `sendMessage` 매치 **0건**
- `/send-candidate-test` handler scope: `putJson(ctKv, CANDIDATE_TEST_GUARD_KEY, ...)` **1건만** (duplicate guard). 다른 KV writer / Telegram canary sender 호출 0건.
- mock smoke S25: 호출 후 KV store 에 `ws3:canary:candidateTestSent` 1건만 존재, 다른 canary state key 0건.

### mock smoke 결과 (30 시나리오 — spec 24 + 6 추가 leak / scope guards)
```
TOTAL=30 PASS=30 FAIL=0
TELEGRAM_API_CALL_COUNT=1 (S19 mock send only)
KV_PUT_CALL_COUNT=1 (S19 guard write only)
KV_DELETE_CALL_COUNT=0
```
**Multi-candidate (S1-S15)**: 인증 3종 + 입력 검증 4종 + success 10 markets + partial OK + score desc 정렬 + candidateCount 매칭 + safety all false + features all finite + raw exchange field leak CLEAN + token leak CLEAN + KV put/delete 0 + Telegram 0.
**Candidate test (S16-S27)**: 인증 + confirm + payload 검증 5종 + enable gate disabled + mock success (telegramSent=true / kvWritten=true / kvWriteScope=`CANDIDATE_TEST_GUARD_ONLY` / candidateStored=false / trackingStarted=false) + TEST_ONLY messageType + 단일 candidate 강제 + candidate 저장 / tracking 시작 0 + duplicate guard 429 + KV scope = guard only + raw Telegram response leak CLEAN + secret leak CLEAN.

실 거래소 API (api.upbit.com / api.bithumb.com / api.binance.com) 호출 0건. 실 Telegram API (api.telegram.org) 호출 0건. 실 KV API 호출 0건.

### Web Console UI 보강 (3 sections)
- Section 8 Multi-market Candidate Dry-run: 10 markets default / score desc 정렬 / [CANDIDATE] 라벨 (P-S/P-A) / Memory-only history (max 5)
- Section 9 Candidate TEST_ONLY Send: Danger Zone 시각 분리 / round-trip JSON 으로 dry-run 후보 selection / confirmPhrase byte-for-byte / 응답 panel `kvWriteScope` 명시
- Section 10 Limited Live Mode: **DISABLED** + 활성화 조건 5개 + 자동 활성화 0건
- 사용자 클릭시에만 fetch / auto refresh 0건 / 1.5s throttle / token `readTokenAndClear()` 즉시 클리어
- client-side market 정규식 `^[A-Za-z0-9_\-]{2,32}$` + limit `^[0-9]{1,3}$` → [1, 120] 범위
- localStorage / sessionStorage / IndexedDB / cookie 사용 0건 (web grep 매치 2건 모두 정책 부정문맥)

### Protected (수정 0건)
- 본선 `worker.js` / `wrangler.toml` (repo 미존재) / `index.html` / `manifest.json` / `service-worker.js` — 미수정
- `v3/` 25종 엔진 — 미수정
- `docs/ws3/WS3_CODE_CONTRACT.md` / `WS3_WORKFLOW_TEMPLATE.md` — 미수정
- `workers/ws3-canary-state-kv-adapter.js` — **미수정** (generic getJson/putJson 만 재사용)
- `wrangler-canary.example.toml` / `.gitignore` — 미수정
- `workers/ws3-telegram-canary-entry.mjs` — 미스테이지 유지

### 보안 / 누출 검증 (0건 확인)
- bot token / chatId / invoke token / KV namespace id / Telegram message_id / raw Telegram response / IP / cookie / session id / browser fingerprint — 노출 0건
- exchange API raw native field (candle_date_time_kst / opening_price / candle_acc_trade_price 등) — response 본문 노출 0건 (smoke S12)
- 노출된 폐기 hash repo-wide 매치 0건
- masked / first-4 / last-4 / redacted preview 0건
- localStorage / sessionStorage / IndexedDB / document.cookie 호출 0건
- URL query parameter token 전달 0건
- console.log 출력 0건
- 매수 추천 / 수익 보장 문구 0건

### Cloudflare 변경 0건
- worker 재배포 0건 (v0.28 production Version 그대로)
- Pages 재배포 0건
- KV namespace 생성/변경 0건
- KV binding 변경 0건
- secrets 변경 0건
- `WS3_CANARY_ALLOWED_ORIGINS` 변경 0건
- `WS3_CANDIDATE_TEST_ENABLED` env 변경 0건 (선언만, deploy Gate 에서 임시 활성화 예정)
- 실 Telegram API 호출 0건
- 실 KV write 0건
- 실 `/multi-candidate-dry-run` / `/send-candidate-test` 호출 0건
- 실 거래소 API 호출 0건

### 의도된 미구현 (다음 Gate)
- v0.29 Deploy/Live Validation Gate (별도): Worker redeploy + Pages redeploy + `WS3_CANDIDATE_TEST_ENABLED='true'` 임시 활성화 + production console 에서 Check State + Multi-market Dry-run 1회 + 후보 있으면 Candidate TEST_ONLY 1회 / 없으면 LOW_SIGNAL 정상 판정 + 검증 직후 `WS3_CANDIDATE_TEST_ENABLED='false'` 복귀
- v0.30 후보 A: predefined market list expand + watchlist UI
- v0.30 후보 B: Multi-market history persistence (browser only)
- v0.30 후보 C: Security hardening (Cloudflare Access 재검토 / invoke token rotation / origin allowlist 재검토)
- env-based `MULTI_CANDIDATE_DISABLED` / `CANDIDATE_TEST_DISABLED` 강제 kill switch
- rate limit per origin / market / minute
- candidate score 산식 백테스트 결과 기반 조정
- invoke token rotate automation / ipHash + `WS3_CANARY_HASH_SALT`

### 기준 commit
- branch: `claude/heuristic-cori-7865e7`
- 이전 functional baseline: WS3 v0.28.0 Actual Coin Candidate Dry-run + Live Validation Success (`d81b723`)
- 코드 commit: `f923b86` (ws3: v0.29.0 integratedLimitedLivePipeline, push 완료)
- live validation closure commit: 본 closure commit (코드 변경 0건 / docs 3개만 — push 별도 승인)

---

## [v0.28.0] — 2026-05-18 (Actual Coin Candidate Dry-run)

### Verified (Cloudflare Worker redeploy + Pages deploy + production Candidate Dry-run 1회 실 호출 — 코드 변경 0건 / tracked source 변경 0건)
- v0.28 Worker was deployed successfully (production version, `/candidate-dry-run` route 포함).
- v0.28 Web Console was deployed successfully to `ws3-canary-console.pages.dev` (production branch, Candidate Dry-run Section 7 UI 반영).
- Production console Check State returned `version=WS3_v0.28.0_candidate_dry_run` / `canaryEnabled=false` / `persistenceAvailable=true` / `alreadySent=false` / `cleanupRequired=false` / `circuitOpen=false` / `currentPhase=RESET_CONFIRMED`.
- `/candidate-dry-run` was executed **once** for `upbit` / `KRW-BTC` / `5m` / `limit=60`.
- The result returned `code=CANDIDATE_DRY_RUN_OK` / `mode=CANDIDATE_DRY_RUN_ONLY`.
- `candleCount=60`, `latestTime=2026-05-19T06:00:00Z`, `lastClose=114446000`, `changePct=-0.02795296912943972`.
- `volumeRatio=0.22896266841376825`, `volumeAccel=0.37174385029772017`, `closePosition=0.20454545454545456`, `upperWickPct=0.0017470453096201047`, `rangePct=0.03843499681164231`.
- `score=0`, `grade=P-C`, `reasonChips=LOW_VOLUME`, `isCandidate=false`.
- `telegramSent=false` / `kvWritten=false` / `candidateStored=false` / `trackingStarted=false`.
- Candidate storage and tracking were not started.
- Send Canary / Cleanup Confirm / Operator Reset were not triggered.
- 결과 판정: 후보 아님 (현재 KRW-BTC 5m 상태). dry-run 계산이 정상 작동 — 알람 실패가 아니라 정상 분류 결과 (false alarm 방지 동작).
- raw exchange full response, Invoke Token, invite code, invite hash, KV namespace ID — **not recorded** in repo / chat / log.

### 목적 (실코인 자동 알람 아님)
v0.28 = 실 거래소 공개 시세 read-only fetch + candle structure / volume / momentum features 계산 + dry-run score / grade preview. **실 Telegram / KV write / candidate 저장 / tracking 시작 / Cloudflare deploy / 실 거래소 API 호출 — 모두 0건** (mock smoke 만). 점수·등급은 dry-run preview 일뿐 실 알람·매수 조건 아님.

### Added
- `/docs/ws3/WS3_v0_28_0_CANDIDATE_DRY_RUN_REPORT.md` — v0.28 완료 보고서 (18 sections)
- `/workers/ws3-telegram-canary-worker.js` 확장 (1336 → 1718 라인, +382):
  - `VERSION = 'WS3_v0.28.0_candidate_dry_run'`
  - 신규 상수: `CANDIDATE_DRY_RUN_MODE = 'CANDIDATE_DRY_RUN_ONLY'` / `CANDIDATE_DRY_RUN_LIMIT_MIN = 1` / `CANDIDATE_DRY_RUN_LIMIT_MAX = 120` / `CANDIDATE_DRY_RUN_REASON_CHIP_MAX = 8` (exchanges / timeframes / market pattern 은 v0.27 `LIVE_PREFLIGHT_*` 상수 재사용)
  - 신규 helper 함수 (인라인, 신규 require 0건):
    - `safeDivide(num, den, fallback)` — NaN/Infinity 방지 division
    - `validateCandidateDryRunRequest(body)` — 입력 검증 + 정규화
    - `mapFetchCodeToCandidateDryRunCode(code)` — v0.27 fetch/normalize 에러 코드를 v0.28 코드로 매핑
    - `calculateCandleStructureFeatures(candles)` — bodyPct / rangePct / upperWickPct / lowerWickPct / closePosition / changePct
    - `calculateVolumeFeatures(candles)` — lastVolume / avgVolume / volumeRatio / volumeAccel (n≥13 시)
    - `calculateMomentumFeatures(candles)` — shortMomentumPct / midMomentumPct / highBreakProximity / lowBreakRisk
    - `calculateCandidateDryRunScore(inputs)` — 0..100 clamp + reason chips (max 8)
    - `classifyCandidateDryRunGrade(score)` — P-S/P-A/P-B/P-C
    - `buildCandidateDryRunResponse(req, sf, vf, mf, score, grade, chips)` — whitelist 응답
  - **POST `/candidate-dry-run`** 엔드포인트 (Origin allowlist + invoke token + manualTrigger 3중 인증 / Content-Type / Content-Length / body byte limit / v0.27 helper 재사용 — buildLivePreflightUrl / fetchLiveCandles / normalizeCandles / 5s timeout / KV 미사용)
  - OPTIONS preflight 허용 path 확장: `/health` / `/send-canary` / `/state` / `/cleanup-confirm` / `/operator-reset` / `/live-preflight` / `/candidate-dry-run`
- `/web/ws3-canary-console.html` Section 7 "Candidate Dry-run (v0.28 read-only)" 신규 추가 (791 → 990 라인, +199):
  - Exchange / Market / Timeframe / Limit input + Run Candidate Dry-run 버튼 (1.5s throttle, 클릭시에만 1회 fetch)
  - 결과 panel whitelist 22 fields (code / mode / exchange / market / timeframe / candleCount / latestTime / lastClose / changePct / volumeRatio / volumeAccel / closePosition / upperWickPct / rangePct / score / grade / reasonChips / isCandidate / telegramSent / kvWritten / candidateStored / trackingStarted)
- `/web/ws3-canary-console/index.html` 위 동일 변경 (byte-for-byte mirror 유지, 33380 → 45836 bytes / 791 → 990 라인 일치)

### Changed
- `/docs/ws3/WS3_CHANGELOG.md` (본 파일): `[v0.28.0]` entry 상단 추가
- `/docs/ws3/WS3_CURRENT_BASELINE.md`: baseline → v0.28.0 + 완료된 단계 row 추가 + v0.28.0 핵심 메모 추가
- worker `VERSION` 상수: `WS3_v0.27.0_actual_coin_live_preflight` → `WS3_v0.28.0_candidate_dry_run`

### /candidate-dry-run 인증 (3중)
| # | 조건 | 위반 시 |
|---|---|---|
| 1 | Origin allowlist 통과 | `ORIGIN_MISSING` 403 / `ORIGIN_NOT_ALLOWED` 403 |
| 2 | `X-WS3-Canary-Token === env.WS3_CANARY_INVOKE_TOKEN` exact | `MISSING_INVOKE_TOKEN` 401 / `INVOKE_TOKEN_MISMATCH` 403 |
| 3 | `body.manualTrigger === true` | `MANUAL_TRIGGER_REQUIRED` 400 |

KV / circuit / persistent guard 미사용 (read-only). abuse 위험 최소화 위해 limit ≤ 120 / single market 제한.

### request body 검증 (v0.27 helper 호환)
- `exchange`: allowlist 3종 (lowercase 정규화) — v0.27 와 동일
- `market`: `^[A-Za-z0-9_\-]{2,32}$` — v0.27 와 동일
- `timeframe`: allowlist 4종 — v0.27 와 동일
- `limit`: integer in `[1, 120]` (v0.27 60 보다 상향, feature 계산용 데이터 폭)

### v0.27 helper 재사용
- `buildLivePreflightUrl(exchange, market, timeframe, limit)` — 그대로 호출 (upbit/bithumb/binance URL 패턴 100% 재사용)
- `fetchLiveCandles(deps, url, 5000)` — 그대로 호출 (5초 AbortController timeout)
- `normalizeCandles(exchange, raw, limit)` — 그대로 호출 (uniform OHLCV oldest→latest)
- 에러 코드 매핑: `mapFetchCodeToCandidateDryRunCode` 가 `LIVE_PREFLIGHT_*` → `CANDIDATE_DRY_RUN_*` 변환

### feature 계산
- candle structure: 13 fields (candleCount / latestTime / lastOpen,High,Low,Close / prevClose / changePct / bodyPct / upperWickPct / lowerWickPct / closePosition / rangePct)
- volume: 4 fields (lastVolume / avgVolume / volumeRatio / volumeAccel)
- momentum: 4 fields (shortMomentumPct / midMomentumPct / highBreakProximity / lowBreakRisk)
- 모든 divide 는 `safeDivide(num, den, fallback)` — open=0 / high=low / avgVolume=0 등 분기 명시. NaN/Infinity 반환 0건.

### dry-run score / grade
- score: 0..100 clamp + reason chips (max 8)
  - volumeRatio / changePct / closePosition / shortMomentumPct 가산
  - upperWick risk / wide range risk 감산
- grade: `P-S` (≥75) / `P-A` (≥60) / `P-B` (≥45) / `P-C` (<45)
- isCandidate: `(grade === 'P-S' || grade === 'P-A')` UI flag — **실 알람·매수 조건 아님**
- 기존 WOOS S+/S/A 등급과 혼동 금지 (별도 namespace)

### 신규 safe code (11종)
- `CANDIDATE_DRY_RUN_OK` 200
- `CANDIDATE_DRY_RUN_INVALID_EXCHANGE` 400
- `CANDIDATE_DRY_RUN_INVALID_MARKET` 400
- `CANDIDATE_DRY_RUN_INVALID_TIMEFRAME` 400
- `CANDIDATE_DRY_RUN_LIMIT_EXCEEDED` 400
- `CANDIDATE_DRY_RUN_FETCH_TIMEOUT` 504
- `CANDIDATE_DRY_RUN_NETWORK_ERROR` 502
- `CANDIDATE_DRY_RUN_PARSE_ERROR` 502
- `CANDIDATE_DRY_RUN_EMPTY_CANDLES` 502
- `CANDIDATE_DRY_RUN_UNSUPPORTED_SOURCE` 400
- `CANDIDATE_DRY_RUN_FEATURE_ERROR` 500

기존 v0.25 / v0.26.1 / v0.27 safe code 모두 유지.

### no-write 구조 보장 (/candidate-dry-run scope grep)
- `writeAlreadySent` / `writeCleanupRequired` / `writeCircuit` / `writeInvokeFail` / `writeOperatorReset` / `markAlreadySentReset` / `env[` — 매치 **0건**
- `sendCanary` / `dispatchCanary` / `sendMessage` 호출 — 매치 **0건**
- KV binding 자체에 접근 0건

### mock smoke 결과 (21 시나리오 — spec 20 + 1 추가 parse error)
```
TOTAL=21 PASS=21 FAIL=0
```
S1 no token → 401 / S2 bad token → 403 / S3 no manualTrigger → 400 / S4 invalid exchange → 400 / S5 invalid timeframe → 400 / S6 limit>120 → 400 / S7 upbit success → 200 / S8 empty → 502 / S9 network → 502 / S10 timeout → 504 / S10b parse error → 502 / S11 features 14 fields all finite / S12 score clamp [0,100] / S13 grade ∈ {P-S/A/B/C} / S14 reasonChips ≤ 8 / S15 Telegram fetch 0 / S16 KV put/delete 0 / S17 raw exchange field leak CLEAN / S18 invoke token leak CLEAN / S19 candidateStored=false / S20 trackingStarted=false.

실 거래소 API (api.upbit.com / api.bithumb.com / api.binance.com) 호출 0건 (mock fetchImpl 만). 실 KV API 호출 0건 (mock KV null).

### Web Console UI 보강
- Section 7 "Candidate Dry-run (v0.28 read-only)" 신규
- 사용자 클릭시에만 1회 fetch, auto refresh 0건, 페이지 로드 시 자동 호출 0건
- 1.5초 throttle, token `readTokenAndClear()` 즉시 클리어
- client-side market 정규식 `^[A-Za-z0-9_\-]{2,32}$` (server-side 와 일치)
- client-side limit `^[0-9]{1,3}$` → parseInt → [1, 120] 범위 검사
- 결과 panel whitelist 22 fields 외 노출 0건
- 매수 추천 / 수익 보장 문구 0건

### Protected (수정 0건)
- 본선 `worker.js` / `wrangler.toml` (repo 미존재) / `index.html` / `manifest.json` / `service-worker.js` — 미수정
- `v3/` 25종 엔진 — 미수정
- `docs/ws3/WS3_CODE_CONTRACT.md` / `WS3_WORKFLOW_TEMPLATE.md` — 미수정
- `workers/ws3-canary-state-kv-adapter.js` — 미수정 (v0.25.0 그대로)
- `wrangler-canary.example.toml` / `.gitignore` — 미수정
- `workers/ws3-telegram-canary-entry.mjs` — 미스테이지 유지

### 보안 / 누출 검증 (0건 확인)
- bot token / chatId / invoke token / KV namespace id / Telegram message_id / raw Telegram response / IP / cookie / session id / browser fingerprint — 노출 0건
- exchange API raw native field — response 본문 노출 0건 (smoke S17 leak guard PASS)
- 노출된 폐기 hash repo-wide 매치 0건
- masked / first-4 / last-4 / redacted preview 0건
- localStorage / sessionStorage / IndexedDB / document.cookie 호출 0건 (web grep 매치 2건 모두 정책 부정문맥)
- URL query parameter token 전달 0건
- console.log 출력 0건
- 매수 추천 / 수익 보장 문구 0건

### Cloudflare 변경 0건
- worker 재배포 0건 (v0.27 production Version 그대로)
- Pages 재배포 0건
- KV namespace 생성/변경 0건
- KV binding 변경 0건
- secrets 변경 0건
- `WS3_CANARY_ALLOWED_ORIGINS` 변경 0건
- 실 Telegram API 호출 0건
- 실 KV write 0건
- 실 `/candidate-dry-run` 호출 0건
- 실 거래소 API 호출 0건

### 의도된 미구현 (다음 Gate)
- v0.28 Deploy/Live Validation Gate (별도): Worker redeploy (v0.28 production version 반영) + Pages redeploy + production console 에서 Check State + Candidate Dry-run 1회 실 호출 검증
- v0.29 후보 A: Basic Multi-market Dry-run (predefined small list, Telegram·KV 0건)
- v0.29 후보 B: Candidate Dry-run result history in UI (browser memory-only)
- v0.29 후보 C: Security hardening before live candidate alert
- worker `/state` response 자체에서 resetCount 제거 (v0.29+ 후보)
- env-based `CANDIDATE_DRY_RUN_DISABLED` kill switch
- rate limit per origin / market / minute / invoke token rotate automation / ipHash + `WS3_CANARY_HASH_SALT`

### 기준 commit
- branch: `claude/heuristic-cori-7865e7`
- 이전 functional baseline: WS3 v0.27.0 Actual Coin Live Preflight + Live Validation Success (`488cb08`)
- 코드 commit: `cd69760` (ws3: v0.28.0 candidateDryRun, push 완료)
- live validation closure commit: 본 closure commit (코드 변경 0건 / docs 3개만 — push 별도 승인)

---

## [v0.27.0] — 2026-05-18 (Actual Coin Live Preflight)

### Verified (Cloudflare Worker redeploy + Pages deploy + production Live Preflight 1회 실 호출 — 코드 변경 0건 / tracked source 변경 0건)
- v0.27 Worker was deployed successfully (production version, `/live-preflight` route 포함).
- v0.27 Web Console was deployed successfully to `ws3-canary-console.pages.dev` (production branch, Live Preflight Section 6 UI 반영).
- Production console Check State returned `version=WS3_v0.27.0_actual_coin_live_preflight` / `canaryEnabled=false` / `persistenceAvailable=true` / `alreadySent=false` / `cleanupRequired=false` / `circuitOpen=false` / `currentPhase=RESET_CONFIRMED`.
- `/live-preflight` was executed **once** for `upbit` / `KRW-BTC` / `5m` / `limit=30`.
- The result returned `code=LIVE_PREFLIGHT_OK` / `mode=LIVE_PREFLIGHT_ONLY`.
- `candleCount=30`, `latestTime=2026-05-18T16:35:00Z`, `lastClose=113892000`, `changePct=0.11075365223353198`, `volumeRatio=0.2566780720123906`.
- `telegramSent=false` and `kvWritten=false` (and `candidateStored=false` / `trackingStarted=false`).
- Candidate storage and tracking were not started.
- Send Canary / Cleanup Confirm / Operator Reset were not triggered.
- raw exchange full response, Invoke Token, invite code, invite hash, KV namespace ID — **not recorded** in repo / chat / log.

### 목적 (실코인 자동 알람 아님)
v0.27 = 실 거래소 공개 시세 데이터를 read-only 1회 fetch + 정규화 preview. **실 Telegram / KV write / candidate 저장 / tracking 시작 / Cloudflare deploy / 실 거래소 API 호출 — 모두 0건** (mock smoke 만).

### Added
- `/docs/ws3/WS3_v0_27_0_ACTUAL_COIN_LIVE_PREFLIGHT_REPORT.md` — v0.27 완료 보고서 (19 sections)
- `/workers/ws3-telegram-canary-worker.js` 확장 (943 → 1336 라인, +393):
  - `VERSION = 'WS3_v0.27.0_actual_coin_live_preflight'`
  - 신규 상수: `LIVE_PREFLIGHT_MODE = 'LIVE_PREFLIGHT_ONLY'` / `LIVE_PREFLIGHT_FETCH_TIMEOUT_MS = 5000` / `LIVE_PREFLIGHT_LIMIT_MIN = 1` / `LIVE_PREFLIGHT_LIMIT_MAX = 60` / `LIVE_PREFLIGHT_ALLOWED_EXCHANGES = ['upbit','bithumb','binance']` / `LIVE_PREFLIGHT_ALLOWED_TIMEFRAMES = ['1m','5m','15m','1h']` / `LIVE_PREFLIGHT_MARKET_PATTERN = /^[A-Za-z0-9_\-]{2,32}$/`
  - 신규 helper 함수 (인라인, 신규 require 0건): `indexOfString` / `validateLivePreflightRequest` / `mapTimeframeToUpbitUnit` / `mapTimeframeToBithumbInterval` / `mapTimeframeToBinanceInterval` / `buildLivePreflightUrl` / `normalizeCandles` / `summarizeCandles` / `fetchLiveCandles` / `buildLivePreflightResponse`
  - **POST `/live-preflight`** 엔드포인트 (Origin allowlist + invoke token + manualTrigger 3중 인증 / Content-Type / Content-Length / body byte limit / 5s timeout / KV 미사용)
  - OPTIONS preflight 허용 path 확장: `/health` / `/send-canary` / `/state` / `/cleanup-confirm` / `/operator-reset` / `/live-preflight`
- `/web/ws3-canary-console.html` Section 6 "Live Preflight (v0.27 read-only)" 신규 추가 (641 → 791 라인, +150):
  - Exchange select (upbit / bithumb / binance, default upbit)
  - Market input (autocomplete=off / maxlength=32 / 기본 KRW-BTC)
  - Timeframe select (1m / 5m / 15m / 1h, default 5m)
  - Limit input (inputmode=numeric / 기본 30)
  - Run Live Preflight 버튼 (1.5초 throttle, 클릭시에만 1회 fetch)
  - 결과 panel 12 fields whitelist (code / exchange / market / timeframe / candleCount / latestTime / lastClose / changePct / volumeRatio / mode / telegramSent / kvWritten)
- `/web/ws3-canary-console/index.html` 위 동일 변경 (byte-for-byte mirror 유지, 25087 → 33380 bytes / 641 → 791 라인 일치)

### Changed
- `/docs/ws3/WS3_CHANGELOG.md` (본 파일): `[v0.27.0]` entry 상단 추가
- `/docs/ws3/WS3_CURRENT_BASELINE.md`: baseline → v0.27.0 + 완료된 단계 row 추가 + v0.27.0 핵심 메모 추가
- worker `VERSION` 상수: `WS3_v0.25.0_operator_reset_state_lifecycle` → `WS3_v0.27.0_actual_coin_live_preflight`

### /live-preflight 인증 (3중)
| # | 조건 | 위반 시 |
|---|---|---|
| 1 | Origin allowlist 통과 | `ORIGIN_MISSING` 403 / `ORIGIN_NOT_ALLOWED` 403 |
| 2 | `X-WS3-Canary-Token === env.WS3_CANARY_INVOKE_TOKEN` exact | `MISSING_INVOKE_TOKEN` 401 / `INVOKE_TOKEN_MISMATCH` 403 |
| 3 | `body.manualTrigger === true` | `MANUAL_TRIGGER_REQUIRED` 400 |

KV / circuit / persistent guard 미사용 (read-only 이므로 abuse 위험 최소화 위해 limit ≤ 60 / single market 제한).

### request body 검증
- `exchange`: allowlist 3종 (case-insensitive, lowercase 정규화)
- `market`: `^[A-Za-z0-9_\-]{2,32}$` (exchange-native 형식)
- `timeframe`: allowlist 4종
- `limit`: integer in `[1, 60]`

### exchange URL 매핑
| exchange | URL pattern |
|---|---|
| upbit | `https://api.upbit.com/v1/candles/minutes/{1\|5\|15\|60}?market={...}&count={limit}` |
| bithumb | `https://api.bithumb.com/public/candlestick/{market}/{1m\|5m\|15m\|1h}` |
| binance | `https://api.binance.com/api/v3/klines?symbol={market}&interval={1m\|5m\|15m\|1h}&limit={limit}` |

### normalize / summarize
- raw exchange JSON → uniform `[{ time(ISO Z), open, high, low, close, volume }]` (oldest → latest)
- upbit: latest-first → reverse / bithumb: oldest-first 6-tuple `[ts_ms, open, close, high, low, volume]` / binance: oldest-first kline 배열
- 모든 필드 `Number(...)` + `isFinite` 검증, invalid 시 `LIVE_PREFLIGHT_PARSE_ERROR`
- 빈 배열 → `LIVE_PREFLIGHT_EMPTY_CANDLES`
- summarize: `candleCount` / `latestTime` / `lastClose` / `prevClose` / `changePct` / `lastVolume` / `avgVolume` / `volumeRatio`

### 신규 safe code (11종)
- `LIVE_PREFLIGHT_OK` 200 / `LIVE_PREFLIGHT_DISABLED` (예약) / `LIVE_PREFLIGHT_INVALID_EXCHANGE` 400 / `LIVE_PREFLIGHT_INVALID_MARKET` 400 / `LIVE_PREFLIGHT_INVALID_TIMEFRAME` 400 / `LIVE_PREFLIGHT_LIMIT_EXCEEDED` 400 / `LIVE_PREFLIGHT_FETCH_TIMEOUT` 504 / `LIVE_PREFLIGHT_NETWORK_ERROR` 502 / `LIVE_PREFLIGHT_PARSE_ERROR` 502 / `LIVE_PREFLIGHT_EMPTY_CANDLES` 502 / `LIVE_PREFLIGHT_UNSUPPORTED_SOURCE` 400

기존 v0.25 / v0.26.1 safe code 모두 유지.

### no-write 구조 보장 (/live-preflight scope grep)
- `writeAlreadySent` / `writeCleanupRequired` / `writeCircuit` / `writeInvokeFail` / `writeOperatorReset` / `markAlreadySentReset` / `KV_BINDING_NAME` / `env[` — `/live-preflight` 핸들러 내 매치 **0건**
- `sendCanary` / `dispatchCanary` / `sendMessage` 호출 — 핸들러 내 매치 **0건**
- KV binding 자체에 접근 0건 (`env[KV_BINDING_NAME]` 미사용)

### mock smoke 결과 (16 시나리오 — 14 spec + 2 leak guard)
```
TOTAL=16 PASS=16 FAIL=0
```
S1 no token → 401 / S2 bad token → 403 / S3 no manualTrigger → 400 / S4 invalid exchange → 400 / S5 invalid timeframe → 400 / S6 limit > 60 → 400 / S7 invalid market → 400 / S8 upbit mocked success → 200 LIVE_PREFLIGHT_OK / S9 empty candles → 502 / S10 network error → 502 / S11 fetch timeout → 504 / S12 parse error → 502 / S13 Telegram fetch count = 0 / S14 KV put/delete count = 0 / S15 raw exchange native field (candle_date_time_kst / opening_price / candle_acc_trade_price) leak guard CLEAN / S16 invoke token leak in body CLEAN.

실 거래소 API (api.upbit.com / api.bithumb.com / api.binance.com) 호출 0건 (mock fetchImpl 만). 실 KV API 호출 0건 (mock KV null).

### Web Console UI 보강
- Section 6 "Live Preflight (v0.27 read-only)" 신규
- 사용자 클릭시에만 1회 fetch, auto refresh 0건, 페이지 로드 시 자동 호출 0건
- 1.5초 throttle, token `readTokenAndClear()` 즉시 클리어
- client-side market 정규식 `^[A-Za-z0-9_\-]{2,32}$` (server-side 와 일치)
- client-side limit `^[0-9]{1,2}$` → parseInt → [1, 60] 범위 검사
- 결과 panel whitelist 12 fields 외 노출 0건

### Protected (수정 0건)
- 본선 `worker.js` / `wrangler.toml` (repo 미존재) / `index.html` / `manifest.json` / `service-worker.js` — 미수정
- `v3/` 25종 엔진 (telegramCanarySender / secureRuntimeStateAdapter / bithumbClient / etc.) — 미수정
- `docs/ws3/WS3_CODE_CONTRACT.md` / `WS3_WORKFLOW_TEMPLATE.md` — 미수정
- `workers/ws3-canary-state-kv-adapter.js` — 미수정 (v0.25.0 그대로)
- `wrangler-canary.example.toml` / `.gitignore` — 미수정
- `workers/ws3-telegram-canary-entry.mjs` — 미스테이지 유지

### 보안 / 누출 검증 (0건 확인)
- bot token / chatId / invoke token / KV namespace id / Telegram message_id / raw Telegram response / IP / cookie / session id / browser fingerprint — 코드 / 보고서 / 로그 노출 0건
- exchange API raw native field — response 본문 노출 0건 (smoke S15 leak guard PASS)
- masked / first-4 / last-4 / redacted preview 0건
- localStorage / sessionStorage / IndexedDB / document.cookie 호출 0건 (web grep 매치 4건 모두 정책 부정문맥)
- URL query parameter token 전달 0건
- console.log 출력 0건

### Cloudflare 변경 0건
- worker 재배포 0건 (v0.25.0 production Version 그대로)
- KV namespace 생성/변경 0건
- KV binding 변경 0건
- secrets 변경 0건
- `WS3_CANARY_ALLOWED_ORIGINS` 변경 0건
- Pages project 생성/배포 0건
- 실 Telegram API 호출 0건
- 실 KV write 0건
- 실 `/live-preflight` 호출 0건
- 실 거래소 API 호출 0건

### 의도된 미구현 (다음 Gate)
- v0.27 Deploy Gate (별도): Worker redeploy (v0.27 production version 반영) + Pages redeploy (필요 시) + production console 에서 `/live-preflight` 1회 호출 검증
- v0.28 후보 A: Live Preflight 결과 기반 basic candle structure preview
- v0.28 후보 B: Actual Coin Candidate Dry-run (후보 계산만, Telegram / KV 0건)
- v0.28 후보 C: Security hardening before live coin stage (Cloudflare Access 재검토 / invoke token rotation / origin allowlist 재검토)
- worker `/state` response 자체에서 `resetCount` 제거 (v0.28+ 후보)
- env-based `LIVE_PREFLIGHT_DISABLED` flag (자동 disable kill switch)
- rate limit per origin / market / minute / invoke token rotate automation / ipHash + `WS3_CANARY_HASH_SALT`

### 기준 commit
- branch: `claude/heuristic-cori-7865e7`
- 이전 functional baseline: WS3 v0.26.1 Dev Preview Lightweight Invite Gate + Pages Deploy Success (`81964bf`)
- 코드 commit: `d3e80b4` (ws3: v0.27.0 actualCoinLivePreflight, push 완료)
- live validation closure commit: 본 closure commit (코드 변경 0건 / docs 3개만 — push 별도 승인)

---

## [v0.26.1] — 2026-05-18 (Dev Preview Lightweight Invite Gate)

### Verified (Cloudflare Pages Deploy — 코드 변경 0건, tracked source 변경 0건)
- Dev Preview Pages deploy completed (Pages project `ws3-canary-console`, production URL `ws3-canary-console.pages.dev`).
- Lightweight invite gate was active on the production Pages URL (placeholder hash → 실 SHA-256 hash working copy 1회 substitution).
- Production console Check State succeeded — 7-field whitelist (version / persistenceAvailable / canaryEnabled / alreadySent / cleanupRequired / circuitOpen / currentPhase) 모두 정상.
- Worker allowlist was reduced to Pages origin only (Phase 2 적용, `WS3_CANARY_ALLOWED_ORIGINS = "https://ws3-canary-console.pages.dev"`).
- localhost origin was removed after Phase 1 validation (Step F).
- `CANARY_ENABLED=false` remained enforced.
- `AUTHORIZED_AT=0` remained enforced.
- Send Canary / Cleanup Confirm / Operator Reset were not triggered (Step C / E / G 모두 Check State 만).
- Telegram API calls remained 0.
- KV writes remained 0.
- raw invite code and SHA-256 hash were not recorded in repo (placeholder `REPLACE_WITH_INVITE_CODE_SHA256` 박제 유지, `git grep` repo-wide 결과 hash 매치 0건).
- Invoke Token / KV namespace ID 노출 0건.

### 목적 (실코인 연결 아님 / Cloudflare Access 보류)
v0.26.0 까지 박제됐던 "Cloudflare Access 필수 / Access 없는 public Pages 비채택" 정책을 **Dev Preview 단계용으로 amendment** 하여, Cloudflare Access 대신 **lightweight client-side invite gate** 적용. production-grade 운영 / 실코인 연결 단계 진입 시 Cloudflare Access 재검토.

실 Cloudflare Access 설정 / Zero Trust 설정 / Pages deploy / Worker 재배포 / `WS3_CANARY_ALLOWED_ORIGINS` 변경 / `/state` / `/send-canary` / `/cleanup-confirm` / `/operator-reset` 호출 / Telegram API 호출 / KV write — **모두 0건**.

### Added
- `/docs/ws3/WS3_v0_26_1_DEV_PREVIEW_INVITE_GATE_REPORT.md` — v0.26.1 완료 보고서 (15 sections)

### Changed
- `/web/ws3-canary-console.html` 466 → 641 라인 (+175):
  - 신규 `<section id="inviteGate">` prepend — invite code 입력칸 + Enter 버튼 + status panel
  - 기존 5-section UI (Configuration/Status/Controlled Operation/Danger Zone/Safe Result) 를 `<main id="consoleApp" hidden>` 으로 wrap
  - CSS `.invite-gate` / `.invite-status` (err/warn/ok 3-state) 추가
  - 신규 IIFE 블록 (4428 chars) — invite gate 로직 (placeholder check / SHA-256 / constant-time compare / 5회·60초 throttle / 새로고침 시 재인증)
  - 기존 IIFE 블록 (11257 chars) — 변경 0건
- `/web/ws3-canary-console/index.html` 466 → 641 라인 (+175) — `/web/ws3-canary-console.html` 의 byte-for-byte mirror 유지
- `/docs/ws3/WS3_CHANGELOG.md` (본 파일): `[v0.26.1]` entry 상단 추가
- `/docs/ws3/WS3_CURRENT_BASELINE.md`: baseline → v0.26.1 + 완료된 단계 row 추가 + v0.26.1 핵심 메모 추가

### v0.26.0 정책 amendment
| 항목 | v0.26.0 | v0.26.1 |
|---|---|---|
| Cloudflare Access | 필수 | 보류 (production-grade 운영 / 실코인 연결 전 재검토) |
| Pages deploy | Access 없으면 비채택 | Dev Preview 용도로 가능하되 이번 단계 미실행 |
| Console UI 보호 | Access (network-level, identity verified) | client-side invite gate (lightweight) |
| Worker action 보호 | Invoke Token + server-side guard | 동일 유지 (변경 0건) |

변경 이유: 현재 단계 = 개발/지인 테스트 목적. Cloudflare Zero Trust 설정 학습/운영 비용이 큼. 운영자 email allowlist 관리보다 가벼운 테스트 접근성 우선.

변경 영향: Layer 1 (UI 노출 차단) 만 약화. Layer 2 (Invoke Token) / Layer 3 (Worker server-side guard) 동일 유지. **Telegram 발송 / KV write / operator-reset 위험은 본 amendment 가 높이지 않음.**

### invite gate 구조
- DOM: `<section id="inviteGate">` (always-visible) + `<main id="consoleApp" hidden>` (기존 5-section)
- placeholder hash 상수: `var WS3_INVITE_CODE_SHA256 = 'REPLACE_WITH_INVITE_CODE_SHA256';`
- placeholder 감지: `isPlaceholderHash` (lowercase hex 64자 정규식) — placeholder 상태에서 hash 비교 0회, `PLACEHOLDER — deploy gate 에서 실 hash 주입 필요` 표시
- SHA-256: `window.crypto.subtle.digest('SHA-256', ...)` → lowercase hex 변환
- 비교: `constantTimeEqual` (char XOR accumulation, native `===` 회피)
- throttle: 5회 연속 실패 → 60초 disable, counter/timestamp 메모리 only, 새로고침 reset
- 통과 후: `inviteGate.hidden=true` / `consoleApp.hidden=false` + counter/throttle reset
- 입력 즉시 클리어: `inviteCodeInput.value = ''` (verifyInviteCode 진입 직후)
- 초대코드 원문 변수 명시 해제: `input = null`

### invite code commit 정책 (옵션 A 채택)
- **placeholder 만 commit** — 초대코드 원문 / 실 SHA-256 hash 값 모두 repo 박제 0건
- Pages deploy 전 별도 Gate 에서 hash 교체 (working copy only, commit 0건)

### client-side gate 한계 (재인용)
- DOM inspect 우회 가능 (`inviteGate.hidden=true` / `consoleApp.hidden=false` 수동 조작) → UI 노출 가능, 단 실 worker action 은 Invoke Token 없이 불가
- hash 추출 → offline brute force / rainbow table 가능. 완화: 16자 이상 랜덤 초대코드, 짧은 단어/이름/생일/프로젝트명 금지
- network pattern 학습 가능. 단 실 호출에는 Invoke Token + Origin allowlist + server-side gate 모두 필요
- 초대코드 공유 / 유출 가능. 유출 의심 시 hash 교체 + Pages redeploy

### invite gate UI 안전 정책 (Web Console)
- `input type="password"` / `autocomplete="off"` / `autocorrect="off"` / `autocapitalize="off"` / `spellcheck="false"`
- `data-1p-ignore` / `data-bwignore` / `data-lpignore`
- `maxlength="128"`
- **`localStorage` / `sessionStorage` / `IndexedDB` / `document.cookie` 호출 0건**
- URL query parameter invite code 전달 0건
- `console.log` 출력 0건
- 통과 상태 storage 저장 0건 → 새로고침 시 invite gate 재표시
- 초대코드 원문 변수 저장 0건

### 정적 검증 결과
- `grep -Rni "localStorage|sessionStorage|indexedDB|document.cookie" web/` → 매치 4건 (양쪽 파일), 모두 정책 부정문맥. 실 storage API 호출 0건.
- `grep -Rni "resetCount" web/` → 매치 6건 (양쪽 파일), 모두 footnote / Danger Zone warn / 코드 주석. 실 DOM set 0건.
- `grep -Rni "REPLACE_WITH_INVITE_CODE_SHA256|WS3_INVITE_CODE_SHA256" web/` → 매치 12건 (양쪽 파일), placeholder 정상 존재.
- `grep -Rni "bot_token|chat_id|message_id|first-4|last-4|masked|redacted" web/` → 정책 안내 문맥만. 실 값 노출 0건.
- `diff -q web/ws3-canary-console.html web/ws3-canary-console/index.html` → 빈 출력 (25087 bytes / 641 라인 일치).
- embedded `<script>` 블록 2개 (4428 + 11257 chars) Node `new Function(js)` parse 모두 통과.

### Protected (수정 0건)
- 본선 `worker.js` / `wrangler.toml` (repo 미존재) / `index.html` / `manifest.json` / `service-worker.js` — 미수정
- `v3/` 25종 엔진 — 미수정
- `docs/ws3/WS3_CODE_CONTRACT.md` / `WS3_WORKFLOW_TEMPLATE.md` — 미수정
- `workers/ws3-telegram-canary-worker.js` / `workers/ws3-canary-state-kv-adapter.js` — 미수정 (v0.25.0 그대로)
- `wrangler-canary.example.toml` / `.gitignore` — 미수정
- `workers/ws3-telegram-canary-entry.mjs` / `wrangler-canary.toml` / `.claude/` / `.wrangler/` / `.tmp_canary_*` — 미스테이지 유지

### 보안 / 누출 검증 (0건 확인)
- 실 invite code 원문 / 실 SHA-256 hash 값 — repo / 채팅 / 보고서 / 로그 노출 0건 (placeholder 만 박제)
- bot token / chatId / invoke token 실 값 — 노출 0건
- KV namespace id / Telegram message_id / raw Telegram response — 노출 0건
- Origin 실 값 / IP / cookie / session id / browser fingerprint — 노출 0건
- masked / first-4 / last-4 / redacted preview — 0건
- localStorage / sessionStorage / IndexedDB / document.cookie 호출 — 0건
- URL query parameter token / invite code 전달 — 0건
- console.log 출력 — 0건

### Cloudflare 변경 0건
- Cloudflare Access 설정 0건 / Zero Trust 설정 0건
- Pages deploy 0건 (별도 Gate)
- Worker 재배포 0건 (v0.25.0 production Version 그대로)
- `WS3_CANARY_ALLOWED_ORIGINS` 변경 0건
- secrets (BOT_TOKEN / CHAT_ID / INVOKE_TOKEN) 변경 0건
- `/state` / `/send-canary` / `/cleanup-confirm` / `/operator-reset` 실 호출 0건
- Telegram API 호출 0건
- KV write 0건

### Pages deploy 전 절차 (별도 Gate 박제)
```text
1. 사용자가 실제 invite code 결정 (외부, 채팅 노출 금지)
2. SHA-256 hash 생성
3. HTML placeholder → 실 hash 교체 (working copy only)
4. commit 0건
5. Pages deploy
6. Pages origin Worker allowlist 추가 결정 (별도 Step)
7. localhost 제거 결정 (별도 Step)
```

### v0.27 진입 전 보안 재평가 권장
- Cloudflare Access 재적용 여부
- invite gate 유지 / Access 동시 적용 여부
- 실코인 연결 시 page-level 보호 강화 필요 여부
- invoke token rotation 여부
- origin allowlist 정책 (production-only)

권장: **실코인 연결 전 Cloudflare Access 또는 동등한 page-level 보호 재검토.**

### 의도된 미구현 (다음 단계 후보)
- v0.26 Production Pages Deploy Gate (별도, invite hash 교체 + Pages deploy)
- v0.26.x: build script / shared source 도입 (두 파일 자동 동기화)
- v0.27: Actual Coin Live Preflight (실코인 데이터를 canary/live execution 경로에 넣기 전 preflight layer)
- v0.28+: Snapshot / Evaluation / Audit KV write boundary
- worker `/state` response 자체에서 resetCount 제거 (v0.27+, 현재는 UI 비노출만)
- env-based resetPhrase / circuit reset endpoint / failure counter reset endpoint
- invoke token rotate automation
- ipHash + `WS3_CANARY_HASH_SALT`

### 기준 commit
- branch: `claude/heuristic-cori-7865e7`
- 이전 functional baseline: WS3 v0.26.0 Production Web Console Hosting (`55a00d8`)
- 코드 commit: `634093d` (ws3: v0.26.1 devPreviewInviteGate, push 완료)
- staging closure commit: 본 closure commit (코드 변경 0건 / docs 3개만 — push 별도 승인)

---

## [v0.26.0] — 2026-05-18 (Production Web Console Hosting)

### 목적 (실코인 연결 아님)
v0.26 은 기존 local-only Web Console 을 production-safe static hosting 구조로 정리하는 단계.
실 Cloudflare Pages project 생성 / Access 정책 설정 / Worker 재배포 / allowlist 변경 / `/send-canary` / `/cleanup-confirm` / `/operator-reset` 호출 / Telegram API 호출 / KV write — **모두 0건**.

### Added
- `/web/ws3-canary-console/index.html` (신규, 466 라인) — Cloudflare Pages production entrypoint 후보. `/web/ws3-canary-console.html` 의 byte-for-byte mirror.
- `/docs/ws3/WS3_v0_26_0_PRODUCTION_WEB_CONSOLE_HOSTING_REPORT.md` — v0.26 완료 보고서 (15 sections)

### Changed
- `/web/ws3-canary-console.html` 158 → 466 라인 (+308):
  - 5-section UI 구조 (Configuration / Status / Controlled Operation / Danger Zone / Safe Result)
  - 신규 버튼: Check State (`GET /state`) / Cleanup Confirm (`POST /cleanup-confirm`) / Operator Reset (`POST /operator-reset` + Reset Phrase 입력)
  - 기존 Send Canary 버튼 유지 + Danger Zone 시각 분리 (border / warning label / danger class)
  - state-based 버튼 활성화 (UI 보조 안전장치, 최종 판단은 worker server-side gate)
  - status panel 7 fields whitelist: version / persistenceAvailable / canaryEnabled / alreadySent / cleanupRequired / circuitOpen / currentPhase
  - **`resetCount` UI 표시 0건** (worker `/state` 가 반환해도 DOM 에 set 0건, 변수 저장 0건)
  - mobile viewport CSS: input/button `min-height: 44px`, `button min-width: 120px`, `@media (max-width: 420px) button { width: 100% }`
  - meta robots `noindex,nofollow,noarchive` / X-Content-Type-Options nosniff / Referrer-Policy no-referrer
- `/docs/ws3/WS3_CHANGELOG.md` (본 파일): `[v0.26.0]` entry 상단 추가
- `/docs/ws3/WS3_CURRENT_BASELINE.md`: baseline → v0.26.0 + 완료된 단계 row 추가 + v0.26.0 핵심 메모 추가

### 4 핵심 정책 박제 (실 적용은 별도 deploy Gate)
1. **Cloudflare Access 필수** — Access 없는 public Pages 비채택. 권장: Self-hosted application + Email allowlist + Email OTP/SSO.
2. **localhost allowlist 2-phase** — Phase 1 (production 검증 중): `http://localhost:8788,https://<pages-project>.pages.dev`. Phase 2 (production 안정 후): `https://<pages-project>.pages.dev` only. localhost 영구 유지 금지.
3. **/state UI 표시 정책** — UI 허용 8 fields (ok/version/canaryEnabled/persistenceAvailable/alreadySent/cleanupRequired/circuitOpen/currentPhase). UI 금지: resetCount/lastResetAt/sentAt/blockedUntil/failureCount 등. worker `/state` response 자체 변경은 v0.27+ 후보.
4. **파일 구조** — `web/ws3-canary-console.html` (staging 호환) + `web/ws3-canary-console/index.html` (production entrypoint) byte-for-byte 동일. build script / shared source 도입은 v0.26.x 후보.

### token 입력 보안 (Web Console)
- `input type="password"` / `autocomplete="off"` / `autocorrect="off"` / `autocapitalize="off"` / `spellcheck="false"`
- `data-1p-ignore` / `data-bwignore` / `data-lpignore` (password manager 무시)
- `maxlength="128"`
- **`localStorage` / `sessionStorage` / `IndexedDB` / `document.cookie` 호출 0건**
- URL query parameter token 전달 0건
- `console.log(token)` 0건
- `readTokenAndClear()` 패턴 — 각 요청 시점 로컬 변수 1회 사용 후 즉시 `tokenEl.value = ''` 클리어
- Reset Phrase 도 응답 도착 직후 `resetPhraseEl.value = ''` 클리어

### fetch 옵션 일관 (모든 endpoint)
```text
mode: 'cors'
credentials: 'omit'
cache: 'no-store'
redirect: 'error'
```

### UI 버튼 활성화 정책 (보조 안전장치)
| 버튼 | UI 조건 | server-side 최종 가드 |
|---|---|---|
| Check State | token 입력 후 항상 | `/state` Origin allowlist + invoke token |
| Send Canary | persistenceAvailable + canaryEnabled=true + alreadySent=false + cleanupRequired=false + circuitOpen=false | v0.22.1 hard precondition AND + v0.23 persistent guard |
| Cleanup Confirm | cleanupRequired=true | `/cleanup-confirm` server gate |
| Operator Reset | canaryEnabled=false + alreadySent=true + cleanupRequired=false + circuitOpen=false + phrase exact | v0.25 7중 조건 + circuit + 60s cooldown |

### 정적 검증 결과
- `grep -Rni "localStorage|sessionStorage|indexedDB|document.cookie" web/` → 매치 2건 (양쪽 파일), 모두 정책 부정문맥 단일 문장 (`"... 에 저장하지 않는다."`). 실 storage API 호출 0건.
- `grep -Rni "resetCount" web/` → 매치 6건 (양쪽 파일), 모두 정책 footnote / Danger Zone warn 문구 / 코드 주석 (`"// Whitelist: ... Do NOT show resetCount"`). 실 DOM set 0건.
- `grep -Rni "bot_token|chat_id|message_id|first-4|last-4|masked|redacted" web/` → 정책 / 안내 문맥만 매치. 실 값 노출 0건.
- `diff -q web/ws3-canary-console.html web/ws3-canary-console/index.html` → 빈 출력 (diff 0건, 18422 bytes / 466 라인 일치).
- embedded `<script>` 11257 chars Node `new Function(js)` parse 통과.

### Protected (수정 0건)
- 본선 `worker.js` / `wrangler.toml` (repo 미존재) / `index.html` / `manifest.json` / `service-worker.js` — 미수정
- `v3/` 25종 엔진 — 미수정
- `docs/ws3/WS3_CODE_CONTRACT.md` / `WS3_WORKFLOW_TEMPLATE.md` — 미수정
- `workers/ws3-telegram-canary-worker.js` / `workers/ws3-canary-state-kv-adapter.js` — 미수정 (v0.25.0 그대로)
- `wrangler-canary.example.toml` / `.gitignore` — 미수정
- `workers/ws3-telegram-canary-entry.mjs` / `wrangler-canary.toml` / `.claude/` / `.wrangler/` / `.tmp_canary_*` — 미스테이지 유지

### 보안 / 누출 검증 (0건 확인)
- bot token / chatId / invoke token / KV namespace id / Telegram message_id / raw Telegram response / IP / cookie / session id / browser fingerprint — 코드 / 보고서 / 로그 노출 0건
- masked / first-4 / last-4 / redacted preview 0건
- localStorage / sessionStorage / IndexedDB / document.cookie 호출 0건
- URL query parameter token 전달 0건
- console.log 출력 0건

### Cloudflare 변경 0건
- Pages project 생성 0건 / Access 정책 설정 0건 / Pages deploy 0건
- Worker 재배포 0건 (v0.25.0 production Version 그대로)
- `WS3_CANARY_ALLOWED_ORIGINS` 변경 0건 (정책 박제만)
- secrets (BOT_TOKEN / CHAT_ID / INVOKE_TOKEN) 변경 0건
- `/state` / `/send-canary` / `/cleanup-confirm` / `/operator-reset` 실 호출 0건
- Telegram API 호출 0건
- KV write 0건

### production deploy 순서 박제 (실 실행은 별도 Gate)
```text
Step 1: Cloudflare Pages project 생성
Step 2: Cloudflare Access 정책 설정 (Email allowlist + Email OTP / Google SSO)
Step 3: Pages deploy (Build output directory: web/ws3-canary-console/)
Step 4: WS3_CANARY_ALLOWED_ORIGINS 에 Pages origin 임시 추가 (Phase 1)
Step 5: Worker redeploy
Step 6: production console Check State 만 검증 (Send Canary / Cleanup Confirm / Operator Reset 클릭 0건)
Step 7: production 안정 후 localhost 제거 + Worker redeploy (Phase 2)
```
각 Step 별도 사용자 명시 승인 필요.

### 의도된 미구현 (다음 단계 후보)
- v0.26 production deploy Gate (Cloudflare Pages / Access / allowlist / Worker redeploy / Check State 검증)
- v0.26.x: build script / shared source 도입 (두 파일 자동 동기화)
- v0.27+: Actual Coin Live Preflight / Durable Objects strict one-time guarantee
- v0.28+: Snapshot / Evaluation / Audit KV write boundary
- worker `/state` response 자체에서 resetCount 제거 (v0.27+ 후보, 현재는 UI 비노출만)
- env-based resetPhrase / circuit reset endpoint / failure counter reset endpoint
- invoke token rotate automation
- ipHash + `WS3_CANARY_HASH_SALT`

### 기준 commit
- branch: `claude/heuristic-cori-7865e7`
- 이전 functional baseline: WS3 v0.25.0 Operator Reset / State Lifecycle + Staging Success (`f2d7ddd`)
- 본 commit: (push 후 기록)

---

## [v0.25.0] — 2026-05-18 (Operator Reset / State Lifecycle)

### Verified (Cloudflare staging — 코드 변경 0건, 추가 deploy 0건)
- Cloudflare canary worker redeployed with v0.25.0 (`WS3_v0.25.0_operator_reset_state_lifecycle`).
- `/state` returned `currentPhase=OPERATOR_RESETTABLE` before reset (alreadySent=true / cleanupRequired=false / resetCount=0).
- `/operator-reset` returned `OPERATOR_RESET_CONFIRMED` / `httpStatus=200`.
- post-reset `/state` returned `alreadySent=false`, `cleanupRequired=false`, `currentPhase=RESET_CONFIRMED`, `resetCount=1`, `canaryEnabled=false`, `persistenceAvailable=true`, `circuitOpen=false`.
- Telegram send count remained **0** during operator-reset staging.
- Send Canary count remained **0** during operator-reset staging.
- `CANARY_ENABLED=false` remained enforced.
- No bot token / chatId / invoke token / KV namespace ID / raw Telegram response / Telegram message_id recorded.

### Added
- `/docs/ws3/WS3_v0_25_0_OPERATOR_RESET_STATE_LIFECYCLE_REPORT.md` — v0.25 완료 보고서 (17 sections + §18 Final Staging Result 추가, 총 18 sections)
- `workers/ws3-canary-state-kv-adapter.js` 확장 (276 → 360 라인, +84):
  - `keyOperatorReset()` — `ws3:canary:operatorReset` 키 namespacing
  - `readOperatorReset(kv)` / `writeOperatorReset(kv, payload)` — schemaVersion='v1' / `{resetCount, lastResetAt, lastResetReason}`
  - `markAlreadySentReset(kv)` — alreadySent=false 전환 + sentAt audit 보존
  - `computeCurrentPhase(state)` — 9-phase classifier (`PERSISTENCE_UNAVAILABLE` / `CIRCUIT_OPEN` / `CLEANUP_REQUIRED` / `LOCKED_ALREADY_SENT` / `OPERATOR_RESETTABLE` / `RESET_CONFIRMED` / `READY`)
- `workers/ws3-telegram-canary-worker.js` 확장 (737 → 943 라인, +206):
  - `OPERATOR_RESET_PHRASE = 'RESET_WS3_CANARY_STATE'` (hardcoded constant)
  - `OPERATOR_RESET_COOLDOWN_MS = 60 * 1000`
  - `OPERATOR_RESET_REASON = 'OPERATOR_RESET_CONFIRMED'`
  - **POST `/operator-reset` 엔드포인트** — 7중 조건 + circuit 차단 + 60s cooldown 가드
  - OPTIONS preflight 허용 path 확장: `/health` / `/send-canary` / `/state` / `/cleanup-confirm` / `/operator-reset`
  - `/state` 응답 8 → 10 fields (신규 `currentPhase` / `resetCount`)

### Changed
- `/docs/ws3/WS3_CHANGELOG.md` (본 파일): `[v0.25.0]` entry 상단 추가
- `/docs/ws3/WS3_CURRENT_BASELINE.md`: baseline → v0.25.0 + 완료된 단계 v0.25 row 추가 + v0.25.0 핵심 메모 추가
- `VERSION` 상수: `WS3_v0.23.0_persistent_canary_safety_guard` → `WS3_v0.25.0_operator_reset_state_lifecycle`

### /operator-reset 7중 조건 + 2 추가 안전선
| # | 조건 | 위반 시 |
|---|---|---|
| 1 | Origin allowlist 통과 | `ORIGIN_MISSING` 403 / `ORIGIN_NOT_ALLOWED` 403 |
| 2 | `X-WS3-Canary-Token === env.WS3_CANARY_INVOKE_TOKEN` exact | `MISSING_INVOKE_TOKEN` 401 / `INVOKE_TOKEN_MISMATCH` 403 |
| 3 | `body.manualTrigger === true` | `MANUAL_TRIGGER_REQUIRED` 400 |
| 4 | `body.resetPhrase === "RESET_WS3_CANARY_STATE"` byte-for-byte | `RESET_PHRASE_MISMATCH` 403 |
| 5 | `env.WS3_TELEGRAM_CANARY_ENABLED === 'false'` | `RESET_REQUIRES_CANARY_DISABLED` 409 |
| 6 | KV `cleanupRequired === false` | `RESET_REQUIRES_CLEANUP_CONFIRMED` 409 |
| 7 | KV `persistenceAvailable === true` (binding + read 성공) | `PERSISTENCE_UNAVAILABLE` 503 |
| +1 | KV `circuitOpen === false` | `CIRCUIT_OPEN_RESET_BLOCKED` 503 |
| +2 | lastResetAt 기준 60s 이내 재-reset 불가 (idempotent NO_RESET_REQUIRED 제외) | `RESET_COOLDOWN_ACTIVE` 429 |

### 신규 safe code (8종)
- `OPERATOR_RESET_CONFIRMED` 200 — reset 성공 (alreadySent=false + resetCount +1)
- `NO_RESET_REQUIRED` 200 — alreadySent=false 상태, KV 변경 0건 (idempotent)
- `RESET_PHRASE_MISMATCH` 403
- `RESET_PRECONDITION_FAILED` 409
- `RESET_REQUIRES_CANARY_DISABLED` 409
- `RESET_REQUIRES_CLEANUP_CONFIRMED` 409
- `RESET_COOLDOWN_ACTIVE` 429
- `CIRCUIT_OPEN_RESET_BLOCKED` 503

### Protected (수정 0건)
- 본선 `worker.js` / `wrangler.toml` (repo 미존재) / `index.html` / `manifest.json` / `service-worker.js` — 미수정
- `v3/` 25종 엔진 — 미수정
- `docs/ws3/WS3_CODE_CONTRACT.md` / `WS3_WORKFLOW_TEMPLATE.md` — 미수정
- `web/ws3-canary-console.html` — 미수정 (v0.25 에서 web console 변경 없음)
- `wrangler-canary.example.toml` / `.gitignore` — 미수정

### mock smoke (19 시나리오)
```
TOTAL=19 PASS=19 FAIL=0
```
실제 Telegram API 호출 **0건** (mock fetchImpl). 실제 KV API 호출 **0건** (mock in-memory store).

### 보안 / 누출 검증 (0건 확인)
- bot token / chatId / invoke token / KV namespace id / Telegram message_id / raw Telegram response / IP / cookie / session id / browser fingerprint — 채팅 / 보고서 / 로그 노출 0건
- resetPhrase 원문 KV 저장 0건 (smoke S17 검증)
- /state 응답 10 fields whitelist 외 필드 노출 0건 (lastResetAt / sentAt / blockedUntil / failureCount 등 모두 차단)
- masked / first-4 / last-4 / redacted preview 0건
- operator identity 저장 0건

### Cloudflare 변경 0건
- worker 재배포 0건 (v0.23.0 production Version 그대로, v0.25 staging 재배포는 별도 gate)
- KV namespace 생성/변경 0건
- KV binding 변경 0건
- secrets (BOT_TOKEN / CHAT_ID / INVOKE_TOKEN) 변경 0건
- 실제 Telegram API 호출 0건
- 실제 /operator-reset 호출 0건 (mock 만)

### 의도된 미구현 (다음 단계 후보)
- `/operator-reset` 실 staging test (v0.24 잔존 alreadySent=true 상태 → 실 호출 → 검증) — 별도 gate
- v0.25 worker 재배포 — 별도 gate
- Production Web Console hosting — v0.26+
- actual coin live preflight (Snapshot / Evaluation / Audit) — v0.27+
- Durable Objects / D1 strict one-time guarantee — v0.27+
- env-based resetPhrase / circuit reset endpoint / failure counter reset endpoint
- invoke token rotate automation
- ipHash + `WS3_CANARY_HASH_SALT`

### 기준 commit
- branch: `claude/heuristic-cori-7865e7`
- 이전 functional baseline: WS3 v0.24.0 Persistent Guard Staging Validation (`cd002dc`)
- 코드 commit: `c3c5ace` (ws3: v0.25.0 operatorResetStateLifecycle)
- staging closure commit: 본 closure commit (코드 변경 0건 / docs 3개만 — push 별도 승인)

---

## [v0.24.0] — 2026-05-18 (Persistent Guard Staging Validation)

### Verified (운영 검증 Gate — 코드 변경 0건)
v0.23.0 Persistent Canary Safety Guard 가 실제 Cloudflare KV 환경에서 의도대로 작동하는지 1회 한정 staging 발송으로 검증:
1. 첫 Send Canary → 실제 Telegram 1회 수신 성공 (fixed 5-line message exact)
2. 발송 후 KV `ws3:canary:alreadySent` schemaVersion='v1' / alreadySent=true 저장 확인
3. 발송 후 KV `ws3:canary:cleanupRequired` schemaVersion='v1' / cleanupRequired=true / reason='LIVE_CANARY_SENT' 저장 확인
4. 2차 Send Canary 시도 → `ALREADY_SENT_PERSISTENT` 409 차단 확인 (Telegram 추가 발송 0건)
5. Telegram 추가 수신 0건 기준 충족
6. `POST /cleanup-confirm` → `CLEANUP_CONFIRMED` 200 확인 (Telegram 발송 0건)
7. cleanup-confirm 후 cleanupRequired=false 갱신 + lastCleanupAt=nowMs 기록 확인
8. cleanup-confirm 후 alreadySent=true 유지 확인 (cleanup-confirm 이 alreadySent reset 하지 않음)
9. 최종 `CANARY_ENABLED=false` 복귀 + `AUTHORIZED_AT=0` reset 확인

### 최종 /state (8 fields whitelist)
```json
{ "ok": true, "service": "WS3_CANARY_WEB_MVP",
  "version": "WS3_v0.23.0_persistent_canary_safety_guard",
  "canaryEnabled": false, "persistenceAvailable": true,
  "alreadySent": true, "cleanupRequired": false, "circuitOpen": false }
```

### Added
- `/docs/ws3/WS3_v0_24_0_PERSISTENT_GUARD_STAGING_VALIDATION_REPORT.md` — 운영 검증 보고서 (11 sections)

### Changed
- `/docs/ws3/WS3_CHANGELOG.md` (본 파일): `[v0.24.0]` entry 상단 추가
- `/docs/ws3/WS3_CURRENT_BASELINE.md`: baseline → v0.24.0 (코드 변경 0건, 운영 검증 박제만)

### Protected (수정 0건)
- v0.23 worker code / KV adapter / wrangler-canary.example.toml / .gitignore — 변경 0건
- v3 엔진 25종 / worker.js / index.html / manifest.json / service-worker.js / WS3_CODE_CONTRACT.md / WS3_WORKFLOW_TEMPLATE.md — 모두 무손상

### 보안 / 누출 검증 (0건 확인)
- bot token / chatId / invoke token / KV namespace id / Telegram message_id / raw Telegram response / IP / cookie / session id / browser fingerprint — 채팅 / 보고서 / 로그 노출 0건
- /state 응답 8 fields whitelist 외 필드 노출 0건
- masked / first-4 / last-4 / redacted preview 0건

### v0.23 strict-lock 한계 재확인 (r0.2-final 박제 재인용)
- 본 staging 검증 범위: 1 isolate / 1 사용자 시퀀스. mock KV (strong consistency) 와 동등 동작 확인.
- mock KV ↔ real KV 차이: real Cloudflare KV 는 eventually consistent. 동시 다중 isolate 의 read-modify-write race / counter increment race 는 본 검증 범위 밖.
- production-grade strict one-time guarantee 는 v0.27+ Durable Objects / D1 transaction / atomic lock 에서 재논의.

### Cloudflare 변경 0건
- worker 재배포 0건 (v0.23.0 production Version 그대로)
- KV namespace 생성/변경 0건
- KV binding 변경 0건
- secrets (BOT_TOKEN / CHAT_ID / INVOKE_TOKEN) 변경 0건

### 의도된 미구현 (다음 단계 후보)
- `alreadySent` reset endpoint (재staging 검증용) — v0.25+
- Production Web Console hosting (localhost:8788 외 production origin) — v0.25+
- actual coin live 연결 preflight (Snapshot / Evaluation / Audit) — v0.26+
- Durable Objects / D1 strict one-time guarantee — v0.27+
- invoke token rotate automation
- ipHash + `WS3_CANARY_HASH_SALT`

### 기준 commit
- branch: `claude/heuristic-cori-7865e7`
- 이전 functional baseline: WS3 v0.23.0 Persistent Canary Safety Guard (`5b6c488`)
- 본 commit: (closure commit 별도 — 코드 변경 0건, 문서 박제만)

---

## [v0.23.0] — 2026-05-18 (Persistent Canary Safety Guard)

### Added
- `/workers/ws3-canary-state-kv-adapter.js` — Canary State KV Adapter (신규, 276 라인)
  - canary 전용 KV 접근만 담당. binding `WS3_CANARY_STATE_KV` + prefix `ws3:canary:` 만 허용.
  - schemaVersion `v1` 강제. read/write 불일치 → `SCHEMA_VERSION_MISMATCH`.
  - validateCanaryKvKey / safeJsonParse / safeJsonStringify / getJson / putJson / deleteKey / listKeysByPrefix / hashOrigin (SHA-256 lowercase hex first 16 chars).
  - 4 domain readers/writers: alreadySent / cleanupRequired / circuit / invokeFail(per-originHash).
  - INVALID_KV_KEY_PREFIX (non-canary prefix 차단) / INVALID_HASH_FORMAT (16-hex lowercase 만 통과).
  - 저장 금지: Telegram message_id / raw response / bot token / chatId / invoke token / Telegram URL / Origin 실제 값 / IP.
- `/wrangler-canary.example.toml` — commit-safe placeholder (실제 KV namespace id / vars / secrets 기록 0건).
- `/.gitignore` — 신규 (`.claude/` / `.wrangler/` / `wrangler-canary.toml` / `wrangler-canary.toml.local` / `.tmp_canary_*.js` / `.tmp_*.bak` / `.tmp_*.json` / `node_modules/`).
- `/docs/ws3/WS3_v0_23_0_PERSISTENT_CANARY_SAFETY_GUARD_REPORT.md` — 완료 보고서 (15 sections).

### Changed
- `/workers/ws3-telegram-canary-worker.js` — v0.22.1 → v0.23.0 (737 lines, +197 lines)
  - VERSION → `WS3_v0.23.0_persistent_canary_safety_guard`.
  - 신규 endpoint: `GET /state` (safe persistent state read — Origin + invoke token 필수) / `POST /cleanup-confirm` (manual cleanup ack — Telegram 발송 0건).
  - `POST /send-canary` 에 6단계 persistent guard 추가:
    1) KV binding 부재 시 `PERSISTENCE_UNAVAILABLE` (memory fallback 금지)
    2) `readCircuit` → `CANARY_CIRCUIT_OPEN_PERSISTENT` (3회 fail 누적, 24h 차단)
    3) `readAlreadySent` → `ALREADY_SENT_PERSISTENT`
    4) `readCleanupRequired` → `CLEANUP_REQUIRED` (또는 alreadySent=true + state 부재 safe default)
    5) `hashOrigin` → `readInvokeFail` → `INVOKE_TOKEN_BLOCKED_TOO_MANY_FAILURES_PERSISTENT` (per-originHash 5회 / 24h 차단)
    6) 기존 v0.20/v0.21 gate 진행 후 success 시 KV `writeAlreadySent` + `writeCleanupRequired(true)` + circuit reset + invokeFail reset. 실패 시 circuit / invokeFail counter 증가.
- `/docs/ws3/WS3_CHANGELOG.md` (본 파일): `[v0.23.0]` entry 상단 추가.
- `/docs/ws3/WS3_CURRENT_BASELINE.md`: baseline → v0.23.0.

### Adopted DP Policy
- canary 전용 KV write exception 만 허용. 본선 / 실코인 / Snapshot / Evaluation / Audit KV write 영구 금지.
- KV binding 없으면 send-canary fallback 금지 (`PERSISTENCE_UNAVAILABLE`).
- schemaVersion v1 강제, INVALID_KV_KEY_PREFIX / INVALID_HASH_FORMAT 가드.
- KV alreadySent 는 strict distributed lock 이 아님 (best effort persistent safety guard). strict one-time guarantee 는 v0.24+ Durable Objects / atomic lock 에서 검토.
- /state 응답 8 fields whitelist: ok / service / version / canaryEnabled / persistenceAvailable / alreadySent / cleanupRequired / circuitOpen. sentAt / blockedUntil / consecutiveFailures / failureCount / Telegram message_id / raw response / token / chatId / Origin 실제 값 출력 0건.

### Protected (수정 0건)
- 본선 / 보호 파일 모두 무손상: worker.js (이 repo 미존재) / wrangler.toml (이 repo 미존재) / index.html / manifest.json / service-worker.js / docs/ws3/WS3_CODE_CONTRACT.md / docs/ws3/WS3_WORKFLOW_TEMPLATE.md / v3/ 전체 (25종) / web/ws3-canary-console.html.

### 의도된 미구현 (이번 단계 제외)
- Cloudflare deploy / KV namespace 실제 생성 / KV binding 활성 / CANARY_ENABLED=true 변경 / Send Canary 클릭 / Telegram API 호출 — 모두 별도 승인 단계.
- ipHash / `WS3_CANARY_HASH_SALT` / Durable Objects / D1 / atomic lock / production Web Console hosting — v0.24+ 검토.

### Verified
- `node --check workers/ws3-telegram-canary-worker.js` + `node --check workers/ws3-canary-state-kv-adapter.js` 모두 SYNTAX_OK.
- mock KV + mock fetch smoke **16 시나리오 전부 PASS** (TOTAL=16 PASS=16 FAIL=0):
  - S1 PERSISTENCE_UNAVAILABLE / S2 INVOKE_TOKEN_BLOCKED_TOO_MANY_FAILURES_PERSISTENT (5x → 6th block) / S3 ALREADY_SENT_PERSISTENT / S4 CLEANUP_REQUIRED
  - S5 CANARY_SENT + KV alreadySent + cleanupRequired=true 자동 저장 / S6 CLEANUP_CONFIRMED + lastCleanupAt / S7 NO_CLEANUP_REQUIRED + state 변경 0건
  - S8 CANARY_CIRCUIT_OPEN_PERSISTENT (3 network fail → 24h) / S9 /state 8-field safe view (no leak)
  - S10 SCHEMA_VERSION_MISMATCH / S11 INVALID_KV_KEY_PREFIX / S12 INVALID_HASH_FORMAT (3 variants)
  - S13 raw Telegram response leak 0건 / S14 token/chatId/invoke token value leak 0건 / S15 message_id leak 0건 / S16 KV strict-lock 한계 문서 박제
- 실제 Telegram API 호출 **0건** (전 시나리오 mock fetchImpl 만). 실제 KV API 호출 **0건** (mock in-memory store 만).
- 보호 파일 `git diff --stat HEAD -- worker.js wrangler.toml index.html manifest.json service-worker.js docs/ws3/WS3_CODE_CONTRACT.md docs/ws3/WS3_WORKFLOW_TEMPLATE.md v3/` 빈 출력 = 0건.

### 기준 commit
- branch: `claude/heuristic-cori-7865e7`
- 이전 functional baseline: WS3 v0.22.1 + Gate 6 closure (`f221e62`)
- 본 commit: (Gate 3 staging + commit 별도 단계)

---

## [v0.22.1] — Canary Worker Runtime Hotfix + First Live Canary Success

### Added / Changed
- Updated canary worker runtime dependency wrapping for Cloudflare runtime safety.
- Added safe worker-level error separation for runtime dependency failures.
- Preserved v0.20/v0.21 runtime and sender contracts without modifying v3 engine files.

### Verified
- Cloudflare production canary worker updated to v0.22.1.
- /health returned CANARY_READY.
- OPTIONS preflight passed for configured staging origin.
- Actual Telegram canary sent successfully exactly once.
- Response code: CANARY_SENT / httpStatus 200 / messageType CANARY_TEST_ONLY / fixedMessageUsed true.
- Telegram received the fixed 5-line canary message.
- Cleanup completed after success: CANARY_ENABLED=false.
- Token/chatId/invoke token/raw Telegram response/message_id were not recorded.

### Next
- v0.23: production-grade enforcement.
- Candidate scope: persistent alreadySent, persistent invoke-token failure counter, cleanup automation, and production Web Console hosting policy.

---

## [v0.21.0] — 2026-05-17 (Telegram Canary Sender)

### Added
- `/v3/v3-telegram-canary-sender.js` — TelegramCanarySender (신규, 608 라인)
  - `WS3_TelegramCanarySender.build(input, deps)` → standalone sync canary plan (precondition / gate / fixed message / safe diagnostics) — fetch/async/timer 0건
  - `WS3_TelegramCanarySender.dispatchCanary(input, deps)` → async — Telegram 1 target 한정 첫 LIVE side-effect. fetch via `deps.fetchImpl` 만. AbortController via `deps.AbortControllerImpl`. setTimeout/clearTimeout via `deps.setTimeoutImpl/deps.clearTimeoutImpl`. nowMs via `deps.nowMs / deps.nowFn`. process.env / globalThis.env / Date.now / new Date 직접 사용 0건.
  - **CANARY_FIXED_MESSAGE** 5줄 byte-for-byte exact: `[WOOS WS3 CANARY]\nTelegram route connected.\nmode: CANARY_ONLY\nlive signal: disabled\nsnapshot/evaluation/audit: disabled`. timestamp/version/env name/error reason/coin symbol/candidate payload/price/percent/score 추가 차단.
  - **20 hard precondition AND** (DP-CANARY1): v0.20 valid + runtimeMode='CANARY_PREP_ONLY' + canaryOnly=true + liveSignalEnabled=false + telegramRuntimeEligibility.eligibleForCanary=true + eligibleForLiveSignal=false + killSwitchRuntimeState.state='CANARY_ALLOWED' + disableRuntimeState.disabled=false + canaryRuntimePolicy (canaryOnly/fixedMessageOnly true, 6 *Allowed false) + WS3_TELEGRAM_CANARY_ENABLED='true' + WS3_TELEGRAM_BOT_TOKEN/CHAT_ID 존재 + messageType='CANARY_TEST_ONLY'
  - **4 explicit gate** (DP-CANARY2): Gate1 env enabled / Gate2 authorized + 24h expire / Gate3 X-WS3-Canary-Token == WS3_CANARY_INVOKE_TOKEN exact / Gate4 manualTrigger=true. env flag 단독 trigger 차단.
  - **fetch safety** (DP-CANARY3~5): hard 5000ms timeout + AbortController / retry=0 / per-process 60s rate limit / 3 연속 실패 후 24h circuit breaker
  - **safe response whitelist 6 fields** (DP-CANARY7): ok/httpStatus/messageId/sentAt/messageType/fixedMessageUsed
  - **safe error whitelist 4 fields + 7 errorCode enum** (DP-CANARY8): ok/httpStatus/errorCode/errorAt — CANARY_BLOCKED:`<reason>`/CANARY_TIMEOUT/CANARY_RATE_LIMITED/CANARY_CIRCUIT_OPEN/CANARY_AUTH_ERROR/CANARY_NOT_FOUND/CANARY_NETWORK_ERROR
  - **safe diagnostics 6 fields** (DP-CANARY9): tokenValueExposed/chatIdValueExposed/rawTelegramResponseExposed 3 boolean false 강제 + tokenPresent/chatIdPresent/canaryEnabled presence flags
  - **raw response 차단** (DP-CANARY10): description / from.* / chat.* / bot_token / response headers / Set-Cookie / X-* / Server / Date 0건 (extractSafeBody whitelist 만)
  - **token/chatId 출력 0건** (DP-CANARY11): masked / first-4 / last-4 / redacted preview 0건
  - **endpoint 0건** (DP-CANARY12): worker.js / index.html / manifest.json / service-worker.js / wrangler.toml 수정 0건. workers/ / .github/ 신규 0건
  - **이중 환경 export**: `global.WS3_TelegramCanarySender` + `module.exports`
- `/docs/ws3/WS3_v0_21_0_TELEGRAM_CANARY_SENDER_REPORT.md` — 완료 보고서 (신규, 14 sections)

### Adopted DP Policy
- **DP-CANARY1** v0.20 secureRuntimeStateAdapter 20 hard precondition AND.
- **DP-CANARY2** fetch 4-Gate explicit trigger. env flag 단독 trigger 금지.
- **DP-CANARY3** 5s hard timeout + AbortController. retry=0.
- **DP-CANARY4** per-process 1회/60초 rate limit.
- **DP-CANARY5** 3 fail / 24h circuit breaker.
- **DP-CANARY6** CANARY_FIXED_MESSAGE 5줄 byte-for-byte exact.
- **DP-CANARY7** safe result whitelist 6 fields.
- **DP-CANARY8** safe error whitelist 4 fields + 7 errorCode enum.
- **DP-CANARY9** safe diagnostics 6 fields. tokenValueExposed/chatIdValueExposed/rawTelegramResponseExposed=false 강제.
- **DP-CANARY10** raw Telegram response 차단 (description/from.*/chat.*/bot_token/headers/Set-Cookie/X-*/Server/Date).
- **DP-CANARY11** token/chatId 코드/문서/로그 출력 0건. masked preview 0건.
- **DP-CANARY12** worker.js/endpoint/inbound/canary worker 0건. module 만 생성.

### Changed
- `/docs/ws3/WS3_CHANGELOG.md` (본 파일): `[v0.21.0]` 엔트리 상단 추가
- `/docs/ws3/WS3_CURRENT_BASELINE.md`: 완료 단계 표 + 보호 파일 목록 (33종) + 모듈 의존성 + v0.21.0 핵심 메모 추가

### Protected (수정 0건 — 32종 + 본 단계 신규 1 = 33종 baseline)
- v3 *.js 25종 (config ~ secure-runtime-state-adapter) — v0.20 신규 포함, v0.21 추가 후 baseline 33종
- `docs/ws3/WS3_CODE_CONTRACT.md` / `docs/ws3/WS3_WORKFLOW_TEMPLATE.md` (b-r2 / v0.1 박제본)
- `index.html` / `manifest.json` / `service-worker.js` / `worker.js` / `wrangler.toml`

### 의도된 미구현 (이번 단계 제외)
- 실제 Telegram API 1회 발송 (별도 staging test 승인 후 별도 단계)
- canary endpoint / inbound /canary-test / GitHub Actions workflow_dispatch — v0.22+
- 별도 canary worker (workers/) — v0.22+
- 실제 코인 후보 알림 연결 / Snapshot / Evaluation / Audit / KV / DB write — v0.22+ 별도 정책
- credential 값 / token / chatId 코드/문서/로그 출력 — 영구 금지

### Verified
- `node --check v3/v3-telegram-canary-sender.js` 통과 (SYNTAX_OK)
- smoke test **47 records (46 spec + 1 circuit threshold 검증 분리) 전부 PASS** (TOTAL=47 PASS=47 FAIL=0)
- 실제 Telegram API 호출 **0건** (mock fetchImpl 만 사용)
- 금지/제한 패턴 grep (비-comment 라인 기준):
  - `async function / await ` **3 매치** (line 439 dispatchCanary, line 523 deps.fetchImpl await, line 549 resp.json await) — 정책 허용 ✅
  - `fetch(` 직접 호출 **0건** (`deps.fetchImpl(` 만 사용)
  - `AbortController / setTimeout / clearTimeout` 직접 사용 **0건** (`deps.*Impl` 만)
  - `Date.now / new Date / performance.now` **0건** (`deps.nowMs / deps.nowFn` 만)
  - `process.env / globalThis.env / globalThis.bindings / globalThis.secrets` **0건** (`input.runtimeEnv` 인자만)
  - `Object.assign / spread `...` / JSON.parse(JSON.stringify) / for-in` **0건**
  - `first-4 / last-4 / masked / redacted` 출력 **0건**
  - `chat.id / chat.title / chat.username / from.username / from.first_name / description / Set-Cookie / response headers / full response body` 실제 출력 **0건** (line 109 FORBIDDEN_RESPONSE_FIELDS 리스트 1 매치 — detection only)
- 보호 파일 `git diff --stat HEAD -- <31+1 protected files>` 빈 출력 = 0건

### 기준 commit
- branch: `claude/heuristic-cori-7865e7`
- 이전 functional baseline: WS3 v0.20.0 secureRuntimeStateAdapter (직전 단계 — 동일 Gate 2, 별도 commit)
- 본 commit: (push 후 기록)

---

## [v0.20.0] — 2026-05-17 (Secure Runtime State Adapter)

### Added
- `/v3/v3-secure-runtime-state-adapter.js` — SecureRuntimeStateAdapter (신규, 961 라인)
  - `WS3_SecureRuntimeStateAdapter.build(input, config)` → standalone CANARY_PREP_ONLY runtime state contract (side-effect 0건, 100% sync)
  - **출력 top-level**: valid/version/runtimeMode('CANARY_PREP_ONLY')/canaryOnly=true/liveSignalEnabled=false/runtimeStatus/sourcePreflightStatus/runtimePolicy/killSwitchRuntimeState/rollbackRuntimeState/disableRuntimeState/telegramRuntimeEligibility/canaryRuntimePolicy/safeDiagnostics + reasons/warnings/debug/configUsed
  - **runtimeStatus 4 후보** first-match-wins: `RUNTIME_INVALID > RUNTIME_BLOCKED > RUNTIME_READY > RUNTIME_UNKNOWN`
  - **6 runtime state contract**:
    - `killSwitchRuntimeState`: `{evaluated:true, state:'CANARY_ALLOWED', source:'explicit_config_only', mutationAllowed:false}` — 금지 state: ON/OFF/UNKNOWN/ERROR/BYPASSED
    - `rollbackRuntimeState`: `{evaluated:true, rollbackAvailable:false, rollbackExecutionAllowed:false}` — 실제 rollback executor 참조 0건
    - `disableRuntimeState`: `{evaluated:true, disabled:false, disableExecutionAllowed:false}` — 실제 disable executor 참조 0건
    - `telegramRuntimeEligibility`: `{target:'TELEGRAM', eligibleForCanary:true, eligibleForLiveSignal:false, reason:'CANARY_ONLY'}`
    - `canaryRuntimePolicy`: `{canaryOnly:true, fixedMessageOnly:true, candidatePayloadAllowed:false, snapshotAllowed:false, evaluationAllowed:false, auditAllowed:false, kvWriteAllowed:false, dbWriteAllowed:false}` — 8 boolean 박제
    - `safeDiagnostics`: `{tokenValueExposed:false, chatIdValueExposed:false, rawTelegramResponseExposed:false}` — 3 boolean false 강제
  - **6 validate 함수** 본문 규칙 박제 (DP-RUNTIME4): plain object only / Array/function/Promise/thenable 차단 / depth limit 1 / whitelist key / enum/boolean 강제 / `INVALID_<TYPE>:<sub-reason>` reason. 6 INVALID_* reason code 신규
  - **v0.19 read-only consume**: liveExecutionPreflightGate ready/status/policy override 0건 (smoke test 9 mutation 검증)
  - **v0.20 별도 객체 정책 박제** (N-PREFLIGHT-OBS-5 박제): v0.19 의 killSwitchPlan/rollbackPlan/disablePlan 은 read-only contract, v0.20 은 별도 runtime state 객체 신규 생성
  - **RESERVED framework metadata 37종** (v0.19 31 + v0.20 신규 6: tokenValueExposed/chatIdValueExposed/rawTelegramResponseExposed + tokenPresent/chatIdPresent/canaryEnabled 사전 등재)
  - **runtimePolicy 박제**: preflightOnly=true + 17 boolean false + liveExecutionRequiresExplicitGate=true
  - **이중 환경 export**: `global.WS3_SecureRuntimeStateAdapter` + `module.exports`
- `/docs/ws3/WS3_v0_20_0_SECURE_RUNTIME_STATE_ADAPTER_REPORT.md` — 완료 보고서 (신규, 12 sections)

### Adopted DP Policy
- **DP-RUNTIME1** side-effect 0건. 실제 LIVE / fetch / KV / DB / credential read / env access 0건. async / await / Promise / thenable / setTimeout / setInterval 0건. Date.now / new Date / performance.now 0건.
- **DP-RUNTIME2** liveExecutionPreflightGate ready/status/policy override 0건. read-only consume.
- **DP-RUNTIME3** runtimeMode CANARY_PREP_ONLY only. LIVE / EXECUTE → RUNTIME_BLOCKED.
- **DP-RUNTIME4** 6 validate 함수 본문 규칙 박제.
- **DP-RUNTIME5** 신규 파일 1개 + 문서 갱신만. 보호 파일 31종 수정 금지.

### Changed
- `/docs/ws3/WS3_CHANGELOG.md` (본 파일): `[v0.20.0]` 엔트리 상단 추가
- `/docs/ws3/WS3_CURRENT_BASELINE.md`: 완료 단계 표 + 보호 파일 목록 (32종) + 모듈 의존성 + v0.20.0 핵심 메모 추가

### Protected (수정 0건 — 31종)
- v3 *.js 25종 (config ~ live-execution-preflight-gate)
- `docs/ws3/WS3_CODE_CONTRACT.md` / `docs/ws3/WS3_WORKFLOW_TEMPLATE.md`
- `index.html` / `manifest.json` / `service-worker.js` / `worker.js` / `wrangler.toml`

### 의도된 미구현 (이번 단계 제외)
- 실제 Telegram 발송 / fetch / KV write / DB write / credential 값 출력 / token/chatId 로그 출력
- 실제 코인 후보 연결 / worker.js 본선 수정 / index.html 수정
- async / await / Promise / timer 사용
- process.env / globalThis.env 접근
- Date.now / new Date / performance.now 사용

### Verified
- `node --check v3/v3-secure-runtime-state-adapter.js` 통과 (SYNTAX_OK)
- smoke test **18 시나리오 전부 PASS** (TOTAL=18 PASS=18 FAIL=0)
- 금지 패턴 grep (비-comment 라인 기준):
  - `async function / await / thenable / setTimeout / setInterval / fetch( / AbortController` **0건**
  - `Promise` **0건 실제 코드** (`hasFunctionOrPromiseInPlainObject` 식별자 substring 7건만)
  - `Date.now / new Date / performance.now` **0건**
  - `process.env / globalThis.env / globalThis.bindings / globalThis.secrets` **0건**
  - `Object.assign / spread `...` / JSON.parse(JSON.stringify) / for-in` **0건**
- v0.19 결과 mutation **0건** (smoke S9 검증: pre.telegramPreflight JSON.stringify before/after 동일)
- 보호 파일 `git diff --stat HEAD -- <31 protected files>` 빈 출력 = 0건

### 기준 commit
- branch: `claude/heuristic-cori-7865e7`
- 이전 functional baseline: WS3 v0.19.0 liveExecutionPreflightGate (`7f2de04`)
- 본 commit: (push 후 기록)

---

## [v0.19.0] — 2026-05-17 (LIVE Execution Preflight Gate)

### Added
- `/v3/v3-live-execution-preflight-gate.js` — LiveExecutionPreflightGate (신규, 1950 라인)
  - `WS3_LiveExecutionPreflightGate.build(input, config)` → standalone PREFLIGHT_ONLY LIVE 실행 사전 안전 contract (입력 12종 mutate 0건)
  - **출력 top-level**: valid/version/preflightMode('PREFLIGHT_ONLY')/liveExecutionAllowed(false)/preflightStatus/sourceGatewayStatus/preflightPolicy/telegramPreflight/snapshotPreflight/evaluationPreflight/auditPreflight/preflightSummary + reasons/warnings/debug/configUsed
  - **preflightStatus 6 후보** first-match-wins 우선순위: `PREFLIGHT_INVALID > PREFLIGHT_BLOCKED > PREFLIGHT_PARTIAL > PREFLIGHT_READY > PREFLIGHT_SKIPPED > PREFLIGHT_UNKNOWN`
  - **4 target preflight** (17-stage AND ready) — 모두 동일 13-key shape: telegramPreflight / snapshotPreflight / evaluationPreflight / auditPreflight. 빈 객체 출력 0건
  - **11 boolean hard block** (DP-PREFLIGHT4): `liveExecutionAllowed / credentialLookupAllowed / bindingLookupAllowed / driverCallAllowed / fetchAllowed / writeAllowed / retryAllowed / timerAllowed / envAccessAllowed / rollbackExecutionAllowed / killSwitchMutationAllowed` 중 하나라도 true → PREFLIGHT_BLOCKED
  - **7 contract field** (per-preflight): `gatewayRef` (5 safe scalar — target/gatewayStatus/bindingRef/credentialHandleRef/bindingScope), `executionIntent` (5 keys — target/action/intentMode='PREFLIGHT_ONLY'/wouldExecuteLive=false/requiresManualApproval=true), `bindingRequirementSnapshot` (7 keys — required + 6 false), `liveReadinessPolicy` (7 keys — 6 requires* + liveReady=false), `killSwitchPlan` (3 keys — required + currentState='NOT_EVALUATED' + mutationAllowed=false), `rollbackPlan` (3 keys — required + rollbackAvailable=false + rollbackExecutionAllowed=false), `disablePlan` (3 keys — required + disableAvailable=false + disableExecutionAllowed=false). 추가 `riskSummary` (3 keys — riskLevel='PREFLIGHT_ONLY' + blockers/warnings string[])
  - **3중 안전망 책임 분리**: killSwitchPlan (system-wide pre-LIVE) / disablePlan (per-target pre-LIVE) / rollbackPlan (post-LIVE recovery). v0.19 셋 모두 실제 실행 0건
  - **8 validate 함수 본문 규칙**: 모두 plain object only + Array/function/Promise/thenable 차단 + depth limit 1 + whitelist key + enum/boolean/강제 false 검증 + `INVALID_<NAME>:<sub-reason>:<target>` reason
  - **target ↔ action 매핑 1:1**: TELEGRAM→TELEGRAM_SEND, SNAPSHOT_STORE→SNAPSHOT_WRITE, EVALUATION_STORE→EVALUATION_WRITE, AUDIT_STORE→AUDIT_WRITE
  - **22 forbidden wording** (DP-PREFLIGHT5): v0.18 inherited 20 + v0.19 신규 2 (`LIVE 실행 완료`, `실제 발송`). credential pattern / masked preview term 우선 검사
  - **RESERVED 31종 자동 차단 제외** (v0.18 26 + v0.19 5 신규 credentialValue* + allowMaskedCredentialPreview)
  - **v0.20 runtimeState 분리 정책** (N-PREFLIGHT-OBS-5): v0.19 결과는 read-only contract. v0.20 가 `killSwitchRuntimeState / rollbackRuntimeState / disableRuntimeState` 별도 객체 생성. v0.19 결과 mutate 금지.
  - **logicalRefAllowList 14종 박제** (v0.18 inherited 10 + v0.19 신규 4 bindingRef): TELEGRAM_SECURE_BINDING / KV_SNAPSHOT_BINDING / EVALUATION_STORE_BINDING / AUDIT_STORE_BINDING
  - **preflightPolicy 박제**: preflightOnly=true + 11 boolean false + liveExecutionRequiresExplicitGate=true
  - **이중 환경 export**: `global.WS3_LiveExecutionPreflightGate` + `module.exports`
- `/docs/ws3/WS3_v0_19_0_LIVE_EXECUTION_PREFLIGHT_GATE_REPORT.md` — 완료 보고서 (신규, 17 sections)

### Adopted DP Policy
- **DP-PREFLIGHT1** LIVE execution preflight gate only. 실제 LIVE 실행 / credential lookup / env / driver call X.
- **DP-PREFLIGHT2** secureBindingGatewayContract ready/status/lookupPlan/bindingPolicy override 0건.
- **DP-PREFLIGHT3** PREFLIGHT_ONLY only. LIVE/REAL/EXECUTE → PREFLIGHT_BLOCKED.
- **DP-PREFLIGHT4** 11 boolean hard block (liveExecution / credentialLookup / bindingLookup / driverCall / fetch / write / retry / timer / envAccess / rollbackExecution / killSwitchMutation).
- **DP-PREFLIGHT5** credential value / masked / token preview / chatId preview / webhook preview 출력 0건.
- **DP-PREFLIGHT6** process.env / env / Cloudflare binding / KV namespace / DB connection 접근 0건. env-like → 즉시 PREFLIGHT_BLOCKED.
- **DP-PREFLIGHT7** executionIntent PREFLIGHT_ONLY 구조. wouldExecuteLive=false 유지.
- **DP-PREFLIGHT8** rollbackPlan / disablePlan / killSwitchPlan preflight contract only. 실행 0건.
- **DP-PREFLIGHT9** 12종 입력 read-only.
- **DP-PREFLIGHT10** 신규 파일 1개 + 문서 갱신만. 보호 파일 31종 수정 금지.

### N-PREFLIGHT-OBS 처리
- **N-PREFLIGHT-OBS-1** 신규 식별자 fresh (LiveExecutionPreflightGate / PREFLIGHT_xxx / buildXxxPreflight / 7 contract / 8 validate / runtimeState 분리 객체 — 25+ 0건 충돌).
- **N-PREFLIGHT-OBS-2** v0.18 secureBindingGatewayContract shape 정합. ready/status/lookupPlan/bindingPolicy override 0건.
- **N-PREFLIGHT-OBS-3** 7 contract field 박제 + 빈 객체 출력 0건.
- **N-PREFLIGHT-OBS-4** 8 validate 본문 규칙 박제 + INVALID_* reason code 8종.
- **N-PREFLIGHT-OBS-5** v0.20 runtimeState 분리 정책 (killSwitchRuntimeState/rollbackRuntimeState/disableRuntimeState 별도 객체, v0.19 결과 read-only).
- **N-PREFLIGHT-OBS-6** 보호 baseline false-positive 모두 정상 (JSDoc / detection list / forbidden list / 식별자 substring).
- **N-PREFLIGHT-OBS-7** 보호 파일 31종 무손상 (v0.18 v3-secure-binding-gateway-contract.js 신규 추가).

### Changed
- `/docs/ws3/WS3_CHANGELOG.md` (본 파일): `[v0.19.0]` 엔트리 상단 추가
- `/docs/ws3/WS3_CURRENT_BASELINE.md`: 완료된 단계 표 + 보호 파일 목록 (31종) + 모듈 의존성 + v0.19.0 핵심 메모 갱신

### Protected (수정 0건 — 31종)
- v3 *.js 24종 (config ~ secure-binding-gateway-contract)
- `docs/ws3/WS3_CODE_CONTRACT.md` (b-r2 박제본 그대로)
- `docs/ws3/WS3_WORKFLOW_TEMPLATE.md` (v0.1 박제본 그대로)
- `index.html` / `manifest.json` / `service-worker.js`
- `worker.js` / `wrangler.toml`

### 의도된 미구현 (이번 단계 제외)
- 실제 LIVE 실행 / credential lookup / process.env / Cloudflare env / globalThis.env / KV namespace / DB connection / Telegram bot token / chatId / webhookUrl / secret binding value 읽기
- 실제 fetch / Telegram 발송 / KV read/write / DB read/write / binding resolver function 호출
- 실제 driver call / retry / timer
- 실제 rollback 실행 / disable 실행 / kill switch 조회 / kill switch 변경
- credential value 저장 / logging / preview / masked preview
- async function / await / Promise / setTimeout / setInterval (sync only)

### Verified
- `node --check v3/v3-live-execution-preflight-gate.js` 통과 (SYNTAX_OK)
- smoke test **68 시나리오 전부 PASS** (TOTAL=68 PASS=68 FAIL=0):
  - S1~S4 preflight READY/SKIPPED/INVALID/BLOCKED-by-source-gateway
  - S5~S16 LIVE mode + 11 boolean hard block → BLOCKED
  - S17~S20 function / thenable / credential / env-like input → BLOCKED
  - S21~S24 telegram/snapshot/evaluation/audit preflight 13-key full shape
  - S25 gatewayRef safe scalar 5 keys (no lookupPlan/bindingPolicy/sandboxResultRef)
  - S26~S33 executionIntent/bindingRequirementSnapshot/liveReadinessPolicy/killSwitchPlan/rollbackPlan/disablePlan + perTargetGate 박제값 검증
  - S34~S35 no credential value output + masked preview blocked
  - S36~S39 no env / no side-effect / mutation 0 / no raw or secret leak
  - S40~S42 v0.20 runtimeState 분리 / preflight gate is not LIVE executor / rollback·killSwitch not executed
  - S43~S46 snapshotPreflight/evaluationPreflight/auditPreflight full shape + empty 금지
  - S47~S51 validateGatewayRef extra key + forbidden keys (lookupPlan/bindingPolicy/sandboxResultRef) + LIVE/REAL/EXECUTE + wouldExecuteLive=true + requiresManualApproval=false blocked
  - S52~S56 validateBindingRequirementSnapshot 5 credentialValue* true blocked
  - S57~S59 validateLiveReadinessPolicy liveReady=true + validateKillSwitchPlan 5 forbidden states + mutationAllowed=true blocked
  - S60~S63 validateRollbackPlan / validateDisablePlan rollback*/disable* true blocked
  - S64~S67 v0.20 executionIntent/liveReadinessPolicy/killSwitchPlan/rollbackPlan/disablePlan read-only policy
  - S68 validateRiskSummary PREFLIGHT_ONLY only (LOW/MEDIUM/HIGH/CRITICAL blocked)
- 모든 시나리오 **입력 mutation 0건** (DP-PREFLIGHT9)
- 금지 패턴 grep:
  - async / await / Promise / thenable / setTimeout / setInterval / fetch / Date.now / new Date / performance.now 실제 사용 **0건** (JSDoc / 식별자 substring `Promise` in `hasFunctionOrPromiseInPlainObject` 만)
  - process.env / globalThis.env / api.telegram.org **0건**
  - Object.assign / spread / clone / for-in / JSON.parse(JSON.stringify) **0건**
  - credential / URL / token 외부 노출 **0건** (detection / RESERVED / framework logical handle 식별자만)
  - 11 boolean `: true` + 5 valueExposed/Masked/Logged/Stored/PreviewAllowed `: true` + liveReady/mutationAllowed/rollback*/disable* `: true` 박제 **0건**
  - CLOSED / HALF_OPEN / OPEN[^_] 실제 state 사용 **0건** (`INVALID_REQUIRES_CIRCUIT_BREAKER_CLOSED` reason 식별자 substring 1건만)
  - currentState 박제 'ON' / 'OFF' / 'UNKNOWN' / 'ERROR' / 'BYPASSED' **0건** (NOT_EVALUATED only)
  - 22 forbidden wording 출력 **0건** (FORBIDDEN_WORDS detection list / getSafeReplacement 치환 매핑만)
- 보호 파일 `git diff --stat HEAD -- <31 protected files>` 빈 출력 = 0건

### 기준 commit
- branch: `claude/heuristic-cori-7865e7`
- 이전 functional baseline: WS3 v0.18.0 secureBindingGatewayContract (`32cbc1d`)
- 본 commit: (push 후 기록)

---

## [v0.18.0] — 2026-05-17 (Secure Binding Gateway Contract)

### Added
- `/v3/v3-secure-binding-gateway-contract.js` — SecureBindingGatewayContract (신규, 1667 라인)
  - `WS3_SecureBindingGatewayContract.build(input, config)` → standalone CONTRACT_ONLY secure binding gateway boundary (입력 11종 mutate 0건)
  - **출력 top-level**: valid/version/gatewayMode('CONTRACT_ONLY')/liveExecutionAllowed(false)/lookupAllowed(false)/gatewayStatus/sourceSandboxStatus/gatewayPolicy/telegramGateway/snapshotGateway/evaluationGateway/auditGateway/gatewaySummary + reasons/warnings/debug/configUsed
  - **gatewayStatus 6 후보** first-match-wins 우선순위: `GATEWAY_INVALID > GATEWAY_BLOCKED > GATEWAY_PARTIAL > GATEWAY_READY > GATEWAY_SKIPPED > GATEWAY_UNKNOWN`
  - **4 target gateway** (17-stage AND ready): telegramGateway / snapshotGateway / evaluationGateway / auditGateway
  - **11 boolean hard block** (DP-GATEWAY4, N-GATEWAY-OBS-5): `liveExecutionAllowed / lookupAllowed / sideEffectAllowed / fetchAllowed / writeAllowed / credentialLookupAllowed / bindingLookupAllowed / driverCallAllowed / retryAllowed / timerAllowed / envAccessAllowed` (v0.17 9 + `lookupAllowed` + `envAccessAllowed` 신규) 중 하나라도 true → GATEWAY_BLOCKED
  - **5종 Contract field** (per-gateway boundary): `credentialHandleRef` (logical only), `bindingScope` (logical only), `lookupPlan` (4 key whitelist: lookupMode='FUTURE_RUNTIME_LOOKUP', lookupAllowed=false, resolverRef='FUTURE_SECURE_BINDING_RESOLVER', resolved=false), `bindingPolicy` (6 key whitelist: required=true, valueExposed=false, valueMasked=false, valueLogged=false, valueStored=false, valuePreviewAllowed=false), `sandboxResultRef` (5 safe scalar)
  - **5 safe sandboxResultRef fields** (DP-GATEWAY8, N-GATEWAY-OBS-7): `target/action/resultType('SANDBOX_ONLY')/simulated(true)/status` only. `ok/errorType/reasonCode/rawResponse/rawError/stack/body/headers/responseBody` 전부 제외 (raw error 누출 / LIVE source 오해 위험 회피)
  - **framework logical term 우회 알고리즘** (N-GATEWAY-OBS-4 / DP-GATEWAY7): 1) allowList exact match → 통과, 2) 형식 / forbidden substring / function token 검사, 3) `CREDENTIAL_HANDLE` / `CREDENTIAL_HANDLE_REF` 연속 substring → credential keyword 우회 허용, 4) 그 외 credential keyword partial match → 차단. `HANDLE` 단독 / `CREDENTIAL` 단독 / `SCOPE` 단독은 우회 자격 없음.
  - **10 framework refs 기본 logicalRefAllowList** (N-GATEWAY-OBS-3): TELEGRAM_CREDENTIAL_HANDLE / SNAPSHOT_STORE_CREDENTIAL_HANDLE / EVALUATION_STORE_CREDENTIAL_HANDLE / AUDIT_STORE_CREDENTIAL_HANDLE / TELEGRAM_SEND_SCOPE / SNAPSHOT_WRITE_SCOPE / EVALUATION_WRITE_SCOPE / AUDIT_WRITE_SCOPE / SECURE_CREDENTIAL_HANDLE_REF / FUTURE_SECURE_BINDING_RESOLVER
  - **target ↔ action 매핑 1:1**: TELEGRAM→TELEGRAM_SEND, SNAPSHOT_STORE→SNAPSHOT_WRITE, EVALUATION_STORE→EVALUATION_WRITE, AUDIT_STORE→AUDIT_WRITE. mismatch → `INVALID_SANDBOX_RESULT_REF:ACTION_TARGET_MISMATCH`
  - **20 forbidden wording** (DP-GATEWAY5): v0.17 inherited 15 + v0.18 신규 5 (`lookup 완료`, `resolved credential`, `credential loaded`, `secret loaded`, `token loaded`). credential pattern / masked preview term 우선 검사
  - **detectCredentialFields / detectEnvLikeObjects / detectFunctionInputs** (재귀, depth ≤5): function / async / Promise / thenable / env-like 11 keys / credential 9 keys 통합 차단
  - **validateLogicalRef 6단계**: 형식 + allowList + function pattern (token-level, EVAL 차단 / EVALUATION 허용) + 금지 substring + bot[0-9]+/digit-only + credential pattern (framework bypass 후)
  - **v0.17 pass-through 재검증**: rateLimitContract (key=target match) / circuitBreakerContract (state='OPEN_IN_DRY_RUN' 강제, CLOSED/HALF_OPEN 금지)
  - **RESERVED 프레임워크 metadata 24종 자동 차단 제외** (N-GATEWAY-OBS-3): v0.14~v0.18 모듈 자체 metadata 식별자 (credentialHandleRef / directSecretAccessAllowed / logicalRefAllowList 등) 충돌 회피
  - **gatewayPolicy 박제**: contractOnly=true, lookupAllowed=false, sideEffectAllowed=false, credentialLookupAllowed=false, bindingLookupAllowed=false, fetchAllowed=false, writeAllowed=false, driverCallAllowed=false, retryAllowed=false, timerAllowed=false, envAccessAllowed=false, allowMaskedCredentialPreview=false, liveExecutionRequiresExplicitGate=true
  - **이중 환경 export**: `global.WS3_SecureBindingGatewayContract` + `module.exports`
- `/docs/ws3/WS3_v0_18_0_SECURE_BINDING_GATEWAY_CONTRACT_REPORT.md` — 완료 보고서 (신규, 16 sections)

### Adopted DP Policy
- **DP-GATEWAY1** secure binding gateway contract only. 실제 credential lookup / env 접근 / binding resolver 호출 X.
- **DP-GATEWAY2** transportExecutorSandboxRunner ready/status/preview/sandboxResult override 0건.
- **DP-GATEWAY3** gatewayMode CONTRACT_ONLY only. LIVE/REAL/EXECUTE → GATEWAY_BLOCKED.
- **DP-GATEWAY4** 11 boolean hard block.
- **DP-GATEWAY5** credential value / masked / first-4 / last-4 / preview / redacted credential preview 전부 output 금지.
- **DP-GATEWAY6** process.env / env 객체 / Cloudflare binding / KV namespace / DB connection 읽기 0건.
- **DP-GATEWAY7** bindingRef / credentialHandleRef / bindingScope / resolverRef logical only. CREDENTIAL_HANDLE / CREDENTIAL_HANDLE_REF framework 우회만 허용.
- **DP-GATEWAY8** sandboxResultRef 5 safe scalar. ok / errorType / reasonCode 제외.
- **DP-GATEWAY9** 11종 입력 read-only.
- **DP-GATEWAY10** 신규 파일 1개 + 문서 갱신만. 보호 파일 30종 수정 금지.

### N-GATEWAY-OBS 처리
- **N-GATEWAY-OBS-1** 신규 식별자 fresh (Gateway / GATEWAY_xxx / buildXxxGateway / credentialHandleRef / bindingScope / lookupPlan / bindingPolicy / sandboxResultRef).
- **N-GATEWAY-OBS-2** v0.17 sandbox runner shape 정합. ready/status/preview/sandboxResult override 0건.
- **N-GATEWAY-OBS-3** 5종 contract field 박제 + RESERVED 24종 + 기본 logicalRefAllowList 10종.
- **N-GATEWAY-OBS-4** framework logical term 우회 알고리즘 4단계 (allowList → 형식 → CREDENTIAL_HANDLE substring → keyword 차단).
- **N-GATEWAY-OBS-5** 11 boolean hard block (v0.17 9 + lookupAllowed + envAccessAllowed).
- **N-GATEWAY-OBS-6** masked credential preview 금지 (masked / redacted / first-4 / last-4 / credential preview 0건).
- **N-GATEWAY-OBS-7** sandboxResultRef safe summary 5 fields. ok/errorType/reasonCode 제외.
- **N-GATEWAY-OBS-8** 보호 파일 30종 무손상 (v0.17 v3-transport-executor-sandbox-runner.js 신규 추가).

### Changed
- `/docs/ws3/WS3_CHANGELOG.md` (본 파일): `[v0.18.0]` 엔트리 상단 추가
- `/docs/ws3/WS3_CURRENT_BASELINE.md`: 완료된 단계 표 + 보호 파일 목록 (30종) + 모듈 의존성 + v0.18.0 핵심 메모 갱신

### Protected (수정 0건 — 30종)
- v3 *.js 23종 (config ~ transport-executor-sandbox-runner)
- `docs/ws3/WS3_CODE_CONTRACT.md` (b-r2 박제본 그대로)
- `docs/ws3/WS3_WORKFLOW_TEMPLATE.md` (v0.1 박제본 그대로)
- `index.html` / `manifest.json` / `service-worker.js`
- `worker.js` / `wrangler.toml`

### 의도된 미구현 (이번 단계 제외)
- 실제 credential lookup / process.env / Cloudflare env / globalThis.env / KV namespace / DB connection / Telegram bot token / chatId / webhookUrl / secret binding value 읽기
- 실제 fetch / Telegram 발송 / KV write / DB write / binding resolver function 호출
- 실제 driver call / retry / timer
- credential value 저장 / logging / preview / masked preview
- async function / await / Promise / setTimeout / setInterval (sync only)

### Verified
- `node --check v3/v3-secure-binding-gateway-contract.js` 통과 (SYNTAX_OK)
- smoke test **66 시나리오 전부 PASS** (TOTAL=66 PASS=66 FAIL=0):
  - S1~S5 gateway READY/SKIPPED/INVALID(no runner)/INVALID(valid=false)/BLOCKED(source SANDBOX_BLOCKED)
  - S6~S13 credential botToken/secret/apiKey/env/bindings/kv/function input/promise input → BLOCKED
  - S14~S16 gatewayMode LIVE/REAL/EXECUTE → BLOCKED
  - S17~S27 11 boolean hard block (liveExec/lookup/sideEffect/fetch/write/credLookup/bindLookup/driverCall/retry/timer/envAccess) → BLOCKED
  - S28~S29 PARTIAL + invalid sandbox valid=false
  - S30~S35 credentialHandleRef + bindingScope 4 target 매핑
  - S36~S40 lookupPlan / bindingPolicy / sandboxResultRef / target↔action / gatewayPolicy fixed values
  - S41~S43 top-level lookupAllowed=false / liveExecutionAllowed=false / gatewayMode='CONTRACT_ONLY'
  - S44~S47 bindingRef invalid (url / lowercase / bot[0-9]+ / digit-only)
  - S48~S53 framework bypass + credential keyword 차단 + EVAL vs EVALUATION (token-level)
  - S54~S57 rateLimit / circuit breaker 무효 + target disable
  - S58~S61 configUsed scalar / debug counters / RESERVED 정합 / framework allowList 정합
  - S62~S64 sanitizeMessageLines — credential / masked / lookup 완료 / credential loaded
  - S65 framework bypass substring 통과 (CUSTOM_CREDENTIAL_HANDLE_BINDING)
  - S66 sandboxResultRef raw 누출 0건 (rawResponse / body / headers 미반영)
- 모든 시나리오 **입력 mutation 0건** (DP-GATEWAY9)
- 금지 패턴 grep:
  - async / await / Promise / setTimeout / setInterval / fetch / Date.now / new Date 실제 사용 **0건** (JSDoc 정책 설명만 3건 매치)
  - process.env / globalThis.env / api.telegram.org **0건**
  - Object.assign / spread / clone / for-in **0건**
  - credential / URL / token 외부 노출 **0건**
  - liveExecutionAllowed/lookupAllowed/sideEffectAllowed/... `: true` 코드 경로 **0건**
  - CLOSED / HALF_OPEN / OPEN[^_] 실제 사용 **0건**
  - 발송됨 / sent / 손절 / 익절 / lookup 완료 / credential loaded 출력 어휘 **0건**
- 보호 파일 `git diff --stat HEAD -- <30 protected files>` 빈 출력 = 0건

### 기준 commit
- branch: `claude/heuristic-cori-7865e7`
- 이전 functional baseline: WS3 v0.17.0 transportExecutorSandboxRunner (`0ddbe85`)
- 본 commit: (push 후 기록)

---

## [v0.17.0] — 2026-05-17 (Transport Executor Sandbox Runner)

### Added
- `/v3/v3-transport-executor-sandbox-runner.js` — TransportExecutorSandboxRunner (신규, 1995 라인)
  - `WS3_TransportExecutorSandboxRunner.build(input, config)` → standalone SANDBOX_ONLY fixture-based simulated result (입력 10종 mutate 0건)
  - **출력 top-level**: valid/version/sandboxMode('SANDBOX_ONLY')/liveExecutionAllowed(false)/sandboxStatus/sourceAdapterStatus/sandboxPolicy/bindingResolverPreview/telegramSandbox/snapshotSandbox/evaluationSandbox/auditSandbox/sandboxSummary + reasons/warnings/debug/configUsed
  - **sandboxStatus 6 후보** first-match-wins 우선순위: `SANDBOX_INVALID > SANDBOX_BLOCKED > SANDBOX_PARTIAL > SANDBOX_READY > SANDBOX_SKIPPED > SANDBOX_UNKNOWN`
  - **4 target sandbox** (17-stage AND ready): telegramSandbox / snapshotSandbox / evaluationSandbox / auditSandbox
  - **9 boolean hard block** (DP-SANDBOX4, N-SANDBOX-OBS-7): `liveExecutionAllowed / sideEffectAllowed / fetchAllowed / writeAllowed / credentialLookupAllowed / bindingLookupAllowed / driverCallAllowed / retryAllowed / timerAllowed` (v0.16 의 8 + `timerAllowed` 신규) 중 하나라도 true → SANDBOX_BLOCKED
  - **5종 Preview** (DP-SANDBOX2): bindingResolverPreview (top-level) / driverCallPreview / resultAdapterPreview / errorAdapterPreview / retryPreview — 모두 INTERFACE→SANDBOX_PREVIEW 안전 변환, callAllowed/lookupAllowed/wouldCall/retryAllowed/rawResponseAllowed/rawErrorAllowed/stackAllowed/responseBodyAllowed 모두 false 강제
  - **sandboxFixture 9-step validation** (DP-SANDBOX5): plain object only / 허용 키 6종 (target/action/ok/status/errorType/reasonCode) / extra key 차단 / credential key partial match 차단 / nested object 차단 / target enum + target match / action enum + target ↔ action 매핑 / ok boolean|null / status SIMULATED_OK/ERROR/SKIPPED / errorType null 또는 9 enum / reasonCode safe string + credential/function pattern 차단
  - **sandboxResult whitelist scalar only** (DP-SANDBOX7): simulated/resultType/target/action/ok/status/errorType/reasonCode 8종 only. rawResponse/rawError/stack/responseBody/headers/body/credential/timestamp 금지
  - **sandboxResult.ok 와 target.ready 분리** (N-SANDBOX-OBS-8): sandboxResult.ok=true 는 LIVE 실행 결정 source 아님. SIMULATED_OK/ERROR/SKIPPED 모두 audit/canary 자료. SIMULATED_ERROR 도 정상 에러 경로 시뮬레이션 가능. target.ready=true 라도 sandboxResult.ok=false 가능
  - **target ↔ action 매핑 1:1** (TELEGRAM→TELEGRAM_SEND, SNAPSHOT_STORE→SNAPSHOT_WRITE, EVALUATION_STORE→EVALUATION_WRITE, AUDIT_STORE→AUDIT_WRITE) — fixture/result 양쪽 검증
  - **v0.16 pass-through 재검증**: rateLimitContract (key=target match) / circuitBreakerContract (state='OPEN_IN_DRY_RUN' 강제, CLOSED/HALF_OPEN 금지)
  - **detectFunctionInputs 재귀 차단** (DP-SANDBOX5): function / async / Promise / thenable input → SANDBOX_BLOCKED
  - **validateLogicalRef 6단계** (v0.16 동일): 형식 + allowList + credential pattern 우선 + 금지 substring + bot/digit-only + function pattern (token-level)
  - **RESERVED 프레임워크 metadata 24종 자동 차단 제외** (N-SANDBOX-OBS-6): v0.16 `credentialHandleRef` (bindingResolverContract field) 신규 포함 + v0.17 sandbox metadata 3종 (sandboxFixtureCredentialPatternBlocked / sandboxFixturePatternBlocked / sandboxFixtureFunctionPatternBlocked)
  - **sandboxFixtureRef logical handle**: TELEGRAM_SANDBOX_FIXTURE / SNAPSHOT_SANDBOX_FIXTURE / EVALUATION_SANDBOX_FIXTURE / AUDIT_SANDBOX_FIXTURE
  - **이중 환경 export**: `global.WS3_TransportExecutorSandboxRunner` + `module.exports`
- `/docs/ws3/WS3_v0_17_0_TRANSPORT_EXECUTOR_SANDBOX_RUNNER_REPORT.md` — 완료 보고서 (신규, 16 sections)

### Adopted DP Policy
- **DP-SANDBOX1** sandbox runner only. 실제 발송/저장/호출/binding lookup/retry/timer X.
- **DP-SANDBOX2** transportExecutorInterfaceAdapter ready/status/contract override 금지. 5종 Contract preview 변환만.
- **DP-SANDBOX3** SANDBOX_ONLY only. LIVE/REAL/EXECUTE → SANDBOX_BLOCKED.
- **DP-SANDBOX4** 9 boolean hard block (liveExecution/sideEffect/fetch/write/credentialLookup/bindingLookup/driverCall/retry/timer).
- **DP-SANDBOX5** function/async/Promise/thenable/resolver/driver/retry/timer input 차단.
- **DP-SANDBOX6** credential / env / process / secure binding 값 읽기 0건. env-like object → 즉시 SANDBOX_BLOCKED.
- **DP-SANDBOX7** sandboxResult whitelist scalar. raw response/raw error/stack/body/credential/timestamp 금지.
- **DP-SANDBOX8** dry-run / sandbox wording only.
- **DP-SANDBOX9** 10종 입력 read-only.
- **DP-SANDBOX10** 신규 파일 1개 + 문서 갱신만. 보호 파일 29종 수정 금지.

### N-SANDBOX-OBS 처리
- **N-SANDBOX-OBS-1** 신규 식별자 fresh (Sandbox/SANDBOX_*/buildXxxSandbox/WS3_TransportExecutorSandboxRunner).
- **N-SANDBOX-OBS-2** v0.16 interface adapter shape 정합. override 0건.
- **N-SANDBOX-OBS-3** sandbox fixture/result 식별자 fresh.
- **N-SANDBOX-OBS-4** preview 계열 fresh (bindingResolverPreview/driverCallPreview/resultAdapterPreview/errorAdapterPreview/retryPreview).
- **N-SANDBOX-OBS-5** 보호 baseline false-positive — async/Promise/setTimeout/fetch 등 본 모듈 0건.
- **N-SANDBOX-OBS-6** RESERVED 24종 자동 차단 제외 (`credentialHandleRef` v0.16 field 포함 + v0.17 sandbox 3종 신규).
- **N-SANDBOX-OBS-7** timerAllowed 신규 hard block (v0.16 8 + 1 → 9).
- **N-SANDBOX-OBS-8** sandboxResult.ok ≠ target.ready 분리. SIMULATED_ERROR/SKIPPED 도 ready=true 가능.
- **N-SANDBOX-OBS-9** 보호 파일 29종 무손상.

### Changed
- `/docs/ws3/WS3_CHANGELOG.md` (본 파일): `[v0.17.0]` 엔트리 상단 추가
- `/docs/ws3/WS3_CURRENT_BASELINE.md`: 완료된 단계 표 + 보호 파일 목록 (29종) + 모듈 의존성 + 다음 단계 갱신

### Protected (수정 0건 — 29종)
- v3 *.js 22종 (config ~ transport-executor-interface-adapter)
- `docs/ws3/WS3_CODE_CONTRACT.md` (b-r2 박제본 그대로)
- `docs/ws3/WS3_WORKFLOW_TEMPLATE.md` (v0.1 박제본 그대로)
- `index.html` / `manifest.json` / `service-worker.js`
- `worker.js` / `wrangler.toml`

### 의도된 미구현 (이번 단계 제외)
- 실제 Telegram bot API / KV / DB / fetch / binding lookup / env 접근
- 실제 driver call / retry 실행 / circuit breaker 상태 변경 / rate limit 카운터 증가
- timer (setTimeout / setInterval) / Promise / thenable
- raw payload / payload.raw / identityInput / raw.builderDebug / rawResponse / rawError / stack 노출
- sandboxResult 를 LIVE 실행 결정 source 로 사용

### Verified
- `node --check v3/v3-transport-executor-sandbox-runner.js` 통과 (SYNTAX_OK)
- smoke test **60 시나리오 / 134 assertion 전부 PASS**:
  - S1 ready / S2 skipped / S3 invalid / S4 source BLOCKED / S5 LIVE / S6~S14 9 hard block boolean
  - S15 function input / S16 thenable / S17 credential / S18 env-like
  - S19~S22 4 target sandbox shape (sandboxResult.action target 매핑 + sandboxFixtureRef)
  - S23 default fixture / S24 default ok / S25 SIMULATED_ERROR / S26 SIMULATED_SKIPPED
  - S27 ACTION_TARGET_MISMATCH / S28 extra key / S29 nested object / S30 credential key / S31 invalid errorType / S32 reasonCode credential
  - S33 simulated only / S34 no rawResponse / S35 no rawError-stack / S36 no credential leak / S37 sandboxResult.ok ≠ target.ready
  - S38~S42 5 Preview shape / S43 rateLimit pass-through / S44 invalid rate limit / S45 CB pass-through / S46 CLOSED blocked / S47 requestShape revalidation / S48 metadata revalidation
  - S49 wording sanitize / S50~S51 no env / no side-effect / S52 mutation 0 / S53 raw/secret leak
  - S54 v0.18 interface separation / S55 sandboxResult is not LIVE / S56~S59 preview boolean false maintained / S60 simulatedOkCount/ErrorCount/SkippedCount
- 모든 시나리오 **입력 mutation 0건** (DP-SANDBOX9, S52 frozen-input)
- 금지 패턴 grep:
  - async / Promise / setTimeout / setInterval / fetch / Date.now / new Date / performance.now **실제 사용 0건** (150 매치는 JSDoc 정책 + literal + 변수명)
  - 9종 입력 mutation **0건** ✅
  - process.env / globalThis.env / api.telegram.org **0건** (실제 접근)
  - Object.assign / spread / clone / for-in **0건** (실제 사용)
  - credential / URL / token **0건** (외부 노출)
  - lookupAllowed/callAllowed/wouldCall/retryAllowed/rawResponseAllowed/rawErrorAllowed/stackAllowed/responseBodyAllowed/timerAllowed `: true` **0건** ✅
  - CLOSED / HALF_OPEN / OPEN[^_] **0건** (실제 사용, 1 JSDoc 매치만)
  - 발송됨 / sent / 손절 / 익절 출력 어휘 사용 **0건**
- 보호 파일 `git diff --stat HEAD -- <29 protected files>` 빈 출력 = 0건

### 기준 commit
- branch: `claude/heuristic-cori-7865e7`
- 이전 functional baseline: WS3 v0.16.0 transportExecutorInterfaceAdapter (`9eaffe5`)
- 본 commit: (push 후 기록)

---

## [v0.16.0] — 2026-05-17 (Transport Executor Interface Adapter)

### Added
- `/v3/v3-transport-executor-interface-adapter.js` — TransportExecutorInterfaceAdapter (신규, 1788 라인)
  - `WS3_TransportExecutorInterfaceAdapter.build(input, config)` → standalone INTERFACE_ONLY interface boundary spec (입력 9종 mutate 0건)
  - **출력 top-level**: valid/version/adapterMode('INTERFACE_ONLY')/liveExecutionAllowed(false)/adapterStatus/sourceHarnessStatus/adapterPolicy/bindingResolverContract/telegramInterface/snapshotInterface/evaluationInterface/auditInterface/adapterSummary + reasons/warnings/debug/configUsed
  - **adapterStatus 6 후보** first-match-wins 우선순위: `ADAPTER_INVALID > ADAPTER_BLOCKED > ADAPTER_PARTIAL > ADAPTER_READY > ADAPTER_SKIPPED > ADAPTER_UNKNOWN`
  - **4 target interface** (16-stage AND ready): telegramInterface / snapshotInterface / evaluationInterface / auditInterface
  - **5종 Contract** (per-interface boundary): bindingResolverContract (top-level) / driverCallContract / resultAdapterContract / errorAdapterContract / retryAdapterContract
  - **8 boolean hard block** (DP-ADAPTER4): `liveExecutionAllowed / sideEffectAllowed / fetchAllowed / writeAllowed / credentialLookupAllowed / bindingLookupAllowed / driverCallAllowed / retryAllowed` 중 하나라도 true → ADAPTER_BLOCKED
  - **target ↔ action 매핑 1:1** (N-ADAPTER-OBS-4): TELEGRAM→TELEGRAM_SEND, SNAPSHOT_STORE→SNAPSHOT_WRITE, EVALUATION_STORE→EVALUATION_WRITE, AUDIT_STORE→AUDIT_WRITE. mismatch → `INVALID_DRY_RUN_RESULT:ACTION_TARGET_MISMATCH:<target>`
  - **v0.15 pass-through 재검증** (DP-ADAPTER2): rateLimitContract (key=target match) / circuitBreakerContract (state='OPEN_IN_DRY_RUN' 강제, CLOSED/HALF_OPEN 금지) / dryRunResult (wouldExecute=false 강제)
  - **validateLogicalRef 6단계** (DP-ADAPTER5/6): 형식 + allowList + credential pattern 우선 + 금지 substring + bot[0-9]+/digit-only + function pattern (token-level). credential pattern 우선순위 — 일반 용어 허용 list override 불가 (N-ADAPTER-OBS-5)
  - **function pattern token-level 매칭**: UPPER_SNAKE_CASE ref → `_` split → 각 token vs LOGICAL_REF_FUNCTION_TOKENS 10종 (FUNCTION/ASYNC/AWAIT/PROMISE/RETURN/EVAL/THEN/YIELD/GENERATOR/CALLBACK). 'EVAL' 토큰 차단 / 'EVALUATION' 토큰 허용 (false-positive 회피)
  - **detectFunctionInputs**: function value / async function / Promise-like / thenable 재귀 차단 (DP-ADAPTER5)
  - **9 errorType enum** (errorAdapterContract): NETWORK_ERROR/TIMEOUT/AUTH_FAILED/RATE_LIMIT/PAYLOAD_ERROR/SERVER_ERROR/PARSE_ERROR/UNKNOWN/CONTRACT_INVALID
  - **logical handle refs**: FUTURE_SECURE_BINDING_RESOLVER / FUTURE_TELEGRAM_DRIVER / FUTURE_SNAPSHOT_DRIVER / FUTURE_EVALUATION_DRIVER / FUTURE_AUDIT_DRIVER / SEND_MESSAGE / WRITE_SNAPSHOT / WRITE_EVALUATION / WRITE_AUDIT / TELEGRAM_MESSAGE_SCHEMA / SNAPSHOT_WRITE_SCHEMA / EVALUATION_WRITE_SCHEMA / AUDIT_WRITE_SCHEMA / TRANSPORT_RESULT_SCHEMA / SECURE_CREDENTIAL_HANDLE_REF / LOGICAL_BINDING_REF
  - **adapterPolicy 박제**: interfaceOnly=true, sideEffectAllowed=false, credentialLookupAllowed=false, bindingLookupAllowed=false, fetchAllowed=false, writeAllowed=false, driverCallAllowed=false, retryAllowed=false, liveExecutionRequiresExplicitGate=true
  - **requestShape 재검증** (DP-ADAPTER7): v0.15 harness.requestShape 그대로 신뢰 X. whitelist scalar only. Object.assign/spread/clone/for-in 0건
  - **sanitizeMessageLines** (DP-ADAPTER8): exact phrase substring match + CREDENTIAL_IN_LINE_REJECTED. `sanitizeMode='REJECT'` 기본
  - **r0.1 폐기 naming residue 0건** (Gate 1 검증): RealTransportExecutor* / *Execution / EXECUTOR_* 폐기 명명 미사용
  - **이중 환경 export**: `global.WS3_TransportExecutorInterfaceAdapter` + `module.exports`
- `/docs/ws3/WS3_v0_16_0_TRANSPORT_EXECUTOR_INTERFACE_ADAPTER_REPORT.md` — 완료 보고서 (신규, 17 sections)

### Adopted DP Policy
- **DP-ADAPTER1** interface adapter only. 실제 발송/저장/호출/binding lookup/retry X.
- **DP-ADAPTER2** transportExecutorHarness ready/status/gate/dryRunResult override 금지. pass-through 재검증만.
- **DP-ADAPTER3** INTERFACE_ONLY 외 mode → ADAPTER_BLOCKED. LIVE/REAL/EXECUTE 금지.
- **DP-ADAPTER4** 8 boolean hard block.
- **DP-ADAPTER5** function 객체 / async function / Promise / resolver/driver/retry function input 차단.
- **DP-ADAPTER6** credential 값 / process.env / env 객체 / secure binding value 읽기 0건. logicalRef credential / function pattern 검사.
- **DP-ADAPTER7** requestShape / payloadSummary / metadata whitelist scalar. v0.15 재검증.
- **DP-ADAPTER8** dry-run / interface wording only. exact phrase substring match.
- **DP-ADAPTER9** 9종 입력 read-only.
- **DP-ADAPTER10** 신규 파일 1개 + 문서 갱신만. 보호 파일 28종 수정 금지.

### N-ADAPTER-OBS 처리
- **N-ADAPTER-OBS-1** 보호 baseline false-positive — 본 모듈 fetch / Date.now / new Date / performance.now / Object.assign / spread / deep clone / for-in / async / await / Promise / setTimeout / setInterval 0건.
- **N-ADAPTER-OBS-2** 신규 식별자 fresh — 충돌 0건.
- **N-ADAPTER-OBS-3** v0.15 harness shape 정합. override 0건.
- **N-ADAPTER-OBS-4** target ↔ action 매핑 1:1. mismatch → ACTION_TARGET_MISMATCH 차단.
- **N-ADAPTER-OBS-5** validateLogicalRef credential pattern 우선. 일반 용어 허용 override 불가.
- **N-ADAPTER-OBS-6** buildSafePayloadSummary / buildSafeMetadata / validateBindingRef 동명 — IIFE module-private, global export 미포함. v0.13~v0.15 파일 scope 분리.
- **N-ADAPTER-OBS-7** 보호 파일 28종 (worker.js / wrangler.toml 포함).

### Changed
- `/docs/ws3/WS3_CHANGELOG.md` (본 파일): `[v0.16.0]` 엔트리 상단 추가
- `/docs/ws3/WS3_CURRENT_BASELINE.md`: 완료된 단계 표 + 보호 파일 목록 (28종) + 모듈 의존성 + 다음 단계 갱신

### Protected (수정 0건 — 28종)
- v3 *.js 21종 (config / feature-payload / bithumb-client / candle-normalizer / indicators / feature-payload-builder / score-breakdown / structure-bucket / signal-cycle / strategy-plan / card-view-model / operation-packet / active-cycle / evaluation-outcome / evaluation-observation-adapter / external-confluence / transport-plan / renderer-binding / transport-execution-adapter / secure-transport-executor-contract / transport-executor-harness)
- `docs/ws3/WS3_CODE_CONTRACT.md` (b-r2 박제본 그대로)
- `docs/ws3/WS3_WORKFLOW_TEMPLATE.md` (v0.1 박제본 그대로)
- `index.html` / `manifest.json` / `service-worker.js`
- `worker.js` / `wrangler.toml`

### 의도된 미구현 (이번 단계 제외)
- 실제 Telegram bot API 호출 / chatId / botToken / webhookUrl 노출
- 실제 KV write / DB persist / 파일 IO / 브라우저 storage
- 실제 fetch / 외부 호출 / endpoint URL
- 실제 binding lookup / env 접근 / process.env / Cloudflare env
- 실제 driver call / retry 실행 / circuit breaker 상태 변경 / rate limit 카운터 증가
- 실제 DOM 렌더 / HTML attach / addEventListener
- async function / await / Promise / setTimeout / setInterval (sync only)
- raw payload / payload.raw / identityInput / raw.builderDebug 노출

### Verified
- `node --check v3/v3-transport-executor-interface-adapter.js` 통과 (SYNTAX_OK)
- smoke test **46 시나리오 / 147 assertion 전부 PASS**:
  - S1 ready all targets / S2 skipped / S3 invalid / S4 source BLOCKED / S5 LIVE / S6~S13 8 hard block boolean
  - S14 function input / S15 thenable input / S16 credential top-level / S17 env-like object
  - S18~S21 4 target interface shape / S22 bindingResolverContract / S23 driverCallContract / S24 resultAdapterContract / S25 errorAdapterContract / S26 retryAdapterContract
  - S27 rateLimitContract pass-through / S28 invalid rate limit / S29 circuitBreakerContract pass-through / S30 invalid CLOSED state / S31 dryRunResult pass-through / S32 ACTION_TARGET_MISMATCH
  - S33 validateLogicalRef safe (EVALUATION_STORE_BINDING 허용) / S34 invalid format / S35 credential pattern / S36 function pattern (EVAL 차단 / EVALUATION 허용 token-level)
  - S37 requestShape revalidation / S38 metadata revalidation / S39 wording sanitize / S40 no env access / S41 no side-effect / S42 mutation 0
  - S43 raw/secret leak / S44 v0.17 interface separation (process.env / api.telegram.org / sk-/xoxb-/eyJ 0 노출 + adapterPolicy 9 boolean) / S45 driver interface policy (4 target) / S46 retry policy (4 target)
- 모든 시나리오 **입력 mutation 0건** (DP-ADAPTER9, S42 frozen-input 검증)
- 금지 패턴 grep (실제 코드 침범 0건):
  - `async function / await / Promise / setTimeout / setInterval / fetch( / KV. / DB / Telegram 실호출 / XMLHttpRequest / innerHTML / document. / addEventListener / localStorage / sessionStorage / Date.now( / new Date / performance.now` 코드 0건 (sync only)
  - `transportExecutorHarness.X = / secureTransportExecutorContract.X = / ...8 inputs.X =` 입력 mutation **0건** ✅
  - `process.env / globalThis.env / globalThis.bindings / globalThis.secrets / typeof process / typeof globalThis` **0건** ✅
  - `Object.assign / ...spread / JSON.parse(JSON.stringify) / for-in` 실제 사용 **0건**
  - credential / URL / token 매치 = JSDoc + literal 차단 list (CREDENTIAL_KEYS_BASE / RESERVED_FRAMEWORK_METADATA_KEYS 22종 / LOGICAL_REF_FORBIDDEN_SUBSTRINGS) + 변수/함수명. 실제 외부 노출 0건
  - `driverCallAllowed:true / bindingLookupAllowed:true / retryAllowed:true / callAllowed:true / lookupAllowed:true / wouldCall:true / rawResponseAllowed:true / rawErrorAllowed:true / stackAllowed:true / responseBodyAllowed:true` **0건** ✅
  - `CLOSED / HALF_OPEN` circuit breaker state **실제 사용 0건** (1 JSDoc 정책 매치만)
  - 발송됨 / sent / 손절 / 익절 등 출력 어휘 사용 0건 (FORBIDDEN_WORDS literal 차단 list 정의만)
- 보호 파일 `git diff --stat HEAD -- <28 protected files>` 빈 출력 = 0건

### 기준 commit
- branch: `claude/heuristic-cori-7865e7`
- 이전 functional baseline: WS3 v0.15.0 transportExecutorHarness (`4a2baa6`)
- 본 commit: (push 후 기록)

---

## [v0.15.0] — 2026-05-17 (Transport Executor Harness — Dry-Run)

### Added
- `/v3/v3-transport-executor-harness.js` — TransportExecutorHarness (신규, 1603 라인)
  - `WS3_TransportExecutorHarness.build(input, config)` → standalone DRY_RUN_HARNESS object (입력 8종 mutate 0건)
  - **출력 top-level**: valid/version/harnessMode('DRY_RUN_HARNESS')/liveExecutionAllowed(false)/harnessStatus/sourceContractStatus/harnessPolicy/telegramHarness/snapshotHarness/evaluationHarness/auditHarness/harnessSummary + reasons/warnings/debug/configUsed
  - **harnessStatus 6 후보** first-match-wins 우선순위: `HARNESS_INVALID > HARNESS_BLOCKED > HARNESS_PARTIAL > HARNESS_READY > HARNESS_SKIPPED > HARNESS_UNKNOWN`
  - **4 target harness** (9-stage AND ready): telegramHarness / snapshotHarness / evaluationHarness / auditHarness
  - **5 boolean hard block** (DP-HARNESS4): `liveExecutionAllowed / sideEffectAllowed / fetchAllowed / writeAllowed / credentialLookupAllowed` 중 하나라도 true → HARNESS_BLOCKED
  - **perTargetGate.allow=false 강제** (DP-HARNESS5): allow=true 시도 시 HARNESS_BLOCKED
  - **rateLimitContract / circuitBreakerContract per-target override** (§8): top-level → per-target merge 우선순위. key field 자동 설정 (TELEGRAM/SNAPSHOT_STORE/EVALUATION_STORE/AUDIT_STORE)
  - **circuitBreakerContract.state='OPEN_IN_DRY_RUN' 강제** (DP-HARNESS1): 실제 호출 불가능. CLOSED/HALF_OPEN 는 v0.16+ 만
  - **dryRunResult v0.16 정책**: `wouldExecute=false` 강제, `resultType='DRY_RUN_ONLY'`, action enum target 매핑 (TELEGRAM_SEND/SNAPSHOT_WRITE/EVALUATION_WRITE/AUDIT_WRITE). LIVE 실행 결정 source 아님
  - **credential 9키 + env-like 11키 + depth 5 재귀 차단** (DP-HARNESS6): scalar leaf 안전. RESERVED 프레임워크 metadata 18종 자동 차단 제외 (`directSecretAccessAllowed` 등 v0.14 자체 metadata 포함 — N-HARNESS-OBS-4 확장)
  - **validateBindingRef** (N-HARNESS-OBS-5): v0.15 IIFE 내부 private 함수로 재정의. `^[A-Z][A-Z0-9_]*$` + 13 금지 substring + bot[0-9]+ + digit-only + credential partial match + `bindingRefAllowList`
  - **requestShape 재검증** (DP-HARNESS7): v0.14 contract.requestShape 그대로 신뢰 X. whitelist scalar only. Object.assign/spread/clone/for-in 0건
  - **harnessPolicy 박제**: dryRunOnly=true, sideEffectAllowed=false, credentialLookupAllowed=false, fetchAllowed=false, writeAllowed=false, liveExecutionRequiresExplicitGate=true
  - **sanitizeMessageLines 매칭 방식** (r0.2 §6.2): exact phrase substring match (case-insensitive). "전송 완료" 차단 / "전송" 단독 비차단 / "전송 후보" 허용. 추가: CREDENTIAL_IN_LINE_REJECTED (line 내 credential pattern 차단)
  - **r0.1 폐기 naming residue 0건** (N-HARNESS-OBS-2): RealTransportExecutor* / *Execution / EXECUTOR_* / classifyExecutorStatus 등 폐기 명명 미사용
  - **v0.15 ↔ v0.16 인터페이스 분리**: bindingRef logical reference + requestShape scalar + harnessPolicy 만 인계. credential value / URL endpoint / env object / raw payload 0건
  - **이중 환경 export**: `global.WS3_TransportExecutorHarness` + `module.exports`
- `/docs/ws3/WS3_v0_15_0_TRANSPORT_EXECUTOR_HARNESS_REPORT.md` — 완료 보고서 (신규, 19 sections)

### Adopted DP Policy
- **DP-HARNESS1** dry-run harness 만. 실제 발송/저장/호출 X. `harnessMode='DRY_RUN_HARNESS'` + `liveExecutionAllowed=false` + `circuitBreaker.state='OPEN_IN_DRY_RUN'` + `dryRunResult.wouldExecute=false` 강제.
- **DP-HARNESS2** secureTransportExecutorContract ready/status override 금지. boolean AND 집계만.
- **DP-HARNESS3** DRY_RUN_HARNESS 외 mode → HARNESS_BLOCKED. LIVE/REAL/EXECUTE 금지.
- **DP-HARNESS4** 5 boolean (liveExecutionAllowed / sideEffectAllowed / fetchAllowed / writeAllowed / credentialLookupAllowed) hard block.
- **DP-HARNESS5** perTargetGate.allow 항상 false. allow=true 시도 → HARNESS_BLOCKED.
- **DP-HARNESS6** credential 9키 + env-like 11키 input/config 전체 nested object 재귀 검사 차단. depth 5 + case-insensitive + partial. process.env / globalThis.env 코드 0건.
- **DP-HARNESS7** requestShape / payloadSummary / metadata whitelist scalar 만. 원본 객체 spread / Object.assign / deep clone / for-in 금지. v0.14 contract 재검증.
- **DP-HARNESS8** dry-run wording only. exact phrase substring match. sanitizeMode='REJECT' 기본. CREDENTIAL_IN_LINE_REJECTED 추가.
- **DP-HARNESS9** 8종 입력 (secureTransportExecutorContract + transportExecutionEnvelope + transportPlan + rendererBinding + operationPacket + activeCycleDecision + evaluationOutcome + externalConfluence) read-only.
- **DP-HARNESS10** 신규 파일 1개 + 문서 갱신만. 보호 파일 25종 수정 금지.

### N-HARNESS-OBS 처리
- **N-HARNESS-OBS-1** 보호 baseline false-positive — 본 모듈 fetch / Date.now / new Date / performance.now / Object.assign / spread / deep clone / for-in 0건.
- **N-HARNESS-OBS-2** r0.1 폐기 naming residue 0건 — RealTransportExecutor* / *Execution / EXECUTOR_* / classifyExecutorStatus 폐기 명명 미사용.
- **N-HARNESS-OBS-3** v0.14 contract shape 정합 — telegramContract/snapshotContract/evaluationContract/auditContract.ready / contractStatus 참조. override 0건.
- **N-HARNESS-OBS-4** buildSafePayloadSummary / buildSafeMetadata 동명 함수 — IIFE module-private, global export 미포함. RESERVED 18종 framework metadata exact match 사전 제외 (`directSecretAccessAllowed` 등 v0.14 자체 metadata 식별자 확장).
- **N-HARNESS-OBS-5** validateBindingRef 동명 함수 — v0.15 IIFE 내부 private 함수로 재정의. global namespace 는 `WS3_TransportExecutorHarness` 만 노출.
- **N-HARNESS-OBS-6** 보호 파일 25종 — v0.14 commit 이후 `v3-secure-transport-executor-contract.js` 추가. 본 단계 25종 무손상.

### Changed
- `/docs/ws3/WS3_CHANGELOG.md` (본 파일): `[v0.15.0]` 엔트리 상단 추가
- `/docs/ws3/WS3_CURRENT_BASELINE.md`: 완료된 단계 표 + 보호 파일 목록 (25종) + 모듈 의존성 + 다음 단계 갱신

### Protected (수정 0건 — 25종)
- v3 *.js 20종 (config / feature-payload / bithumb-client / candle-normalizer / indicators / feature-payload-builder / score-breakdown / structure-bucket / signal-cycle / strategy-plan / card-view-model / operation-packet / active-cycle / evaluation-outcome / evaluation-observation-adapter / external-confluence / transport-plan / renderer-binding / transport-execution-adapter / secure-transport-executor-contract)
- `docs/ws3/WS3_CODE_CONTRACT.md` (b-r2 박제본 그대로)
- `docs/ws3/WS3_WORKFLOW_TEMPLATE.md` (v0.1 박제본 그대로)
- `index.html` / `manifest.json` / `service-worker.js`
- `worker.js` / `wrangler.toml`

### 의도된 미구현 (이번 단계 제외)
- 실제 Telegram bot API 호출 / chatId / botToken / webhookUrl 노출
- 실제 KV write / DB persist / 파일 IO / 브라우저 storage
- 실제 fetch / 외부 호출 / endpoint URL
- 실제 rate limit / circuit breaker 실행 (contract object only)
- 실제 DOM 렌더 / HTML attach / addEventListener
- 실제 env 접근 / process.env / Cloudflare env 객체 / secret binding 값 읽기
- 입력 객체 mutation
- 런타임 clock API (Date.now / new Date / performance.now)
- raw payload / payload.raw / identityInput / raw.builderDebug 노출
- `dryRunResult.wouldExecute=true`

### Verified
- `node --check v3/v3-transport-executor-harness.js` 통과 (SYNTAX_OK)
- smoke test **30 시나리오 / 95 assertion 전부 PASS**:
  - S1 ready all targets / S2 skipped / S3 invalid / S4 source BLOCKED / S5 LIVE / S6~S10 5 hard block boolean / S11 perTargetGate.allow=true
  - S12 credential top-level / S13 env-like object
  - S14~S17 4 target harness shape (dryRunResult.action enum + wouldExecute=false + bindingRef logical)
  - S18 rateLimitContract shape / S19 circuitBreakerContract.state=OPEN_IN_DRY_RUN / S20 per-target override (telegram 30 / snapshot 1 fallback)
  - S21 requestShape revalidation / S22 metadata revalidation / S23 wording sanitize REJECT (exact phrase, "전송 후보" 허용)
  - S24 no env access / S25 no side-effect / S26 mutation 0 / S27 raw/secret value leak prevention
  - S28 v0.16 interface separation (process.env / api.telegram.org / sk-/xoxb-/eyJ 0 노출 + harnessPolicy 6 boolean) / S29 dryRunResult v0.16 policy (4 target wouldExecute=false / action enum match) / S30 r0.1 naming residue 0
- 모든 시나리오 **입력 mutation 0건** (DP-HARNESS9, S26 frozen-input 검증)
- 금지 패턴 grep (실제 코드 침범 0건):
  - `fetch( / KV. / DB / Telegram 실호출 / XMLHttpRequest / innerHTML / document. / addEventListener / localStorage / sessionStorage / Date.now( / new Date / performance.now` 코드 0건
  - `secureTransportExecutorContract.X = / transportExecutionEnvelope.X = / transportPlan.X = / rendererBinding.X = / operationPacket.X = / activeCycleDecision.X = / evaluationOutcome.X = / externalConfluence.X =` **0건** ✅
  - r0.1 폐기 naming (`RealTransportExecutor / *Execution / EXECUTOR_* / classifyExecutorStatus` 등) **0건** ✅
  - `rateLimitPlan / circuitBreakerPlan` (r0.1 Plan 명명) **0건** ✅
  - `process.env / globalThis.env / globalThis.bindings / globalThis.secrets / typeof process / typeof globalThis` **0건** ✅
  - `Object.assign / ...spread / JSON.parse(JSON.stringify) / for-in` 실제 사용 **0건**
  - credential value 매치 = JSDoc 정책 + literal 차단 list + 변수/함수명 (`isCredentialKey`, `bindingRefAllowList` 등). 실제 외부 노출 0건
  - env-like 매치 = JSDoc + ENV_LIKE_KEYS_EXACT literal + KV_SNAPSHOT_BINDING constant + local var `env`. 실제 env 접근 0건
  - 발송됨 / sent / 손절 / 익절 등 출력 어휘 사용 0건 (FORBIDDEN_WORDS literal 차단 list 정의만)
- 보호 파일 `git diff --stat HEAD -- <25 protected files>` 빈 출력 = 0건

### 기준 commit
- branch: `claude/heuristic-cori-7865e7`
- 이전 functional baseline: WS3 v0.14.0 secureTransportExecutorContract (`644c525`)
- 본 commit: (push 후 기록)

---

## [v0.14.0] — 2026-05-17 (Secure Transport Executor Contract)

### Added
- `/v3/v3-secure-transport-executor-contract.js` — SecureTransportExecutorContract (신규, 1595 라인)
  - `WS3_SecureTransportExecutorContract.build(input, config)` → standalone CONTRACT_ONLY contract object (입력 7종 mutate 0건)
  - **출력 top-level**: valid/version/contractMode('CONTRACT_ONLY')/liveExecutionAllowed(false)/contractStatus/sourceEnvelopeStatus/secureBindingPolicy/telegramContract/snapshotContract/evaluationContract/auditContract/contractSummary + reasons/warnings/debug/configUsed
  - **contractStatus 6 후보** first-match-wins 우선순위: `CONTRACT_INVALID > CONTRACT_BLOCKED > CONTRACT_PARTIAL > CONTRACT_READY > CONTRACT_SKIPPED > CONTRACT_UNKNOWN`
  - **4 target contract** (5-stage AND ready): telegramContract / snapshotContract / evaluationContract / auditContract
  - **credential 9키 recursive 차단** (DP-SEC4): case-insensitive + partial match + depth limit 5 + scalar leaf 안전. RESERVED 프레임워크 metadata 16종 자동 차단 제외 (N-SEC-OBS-4)
  - **env-like 11키 exact match + value object 차단** (DP-SEC4): env/ENV/environment/bindings/cfEnv/cloudflareEnv/secrets/kvNamespace/kv/KV/process — false-positive 완화 (r0.2 §6.2 spec)
  - **validateBindingRef** (DP-SEC5): `^[A-Z][A-Z0-9_]*$` UPPER_SNAKE_CASE + 13 금지 substring (http/https/://, sk-, xoxb-, xoxp-, eyJ 등) + bot[0-9]+ 정규식 + digit-only 차단 + credential partial match + `bindingRefAllowList` 기본 []
  - **payloadSummary 14 whitelist scalar only** + metadata 기본 빈 배열. Object.assign / spread / clone / for-in 0건
  - **secureBindingPolicy 박제**: credentialSource='SECURE_BINDING_ONLY', credentialInPayloadAllowed=false, credentialInEnvelopeAllowed=false, envReadAllowed=false, directSecretAccessAllowed=false, liveExecutionRequiresExplicitGate=true
  - **v0.13 envelope 재검증** (DP-SEC6): payloadSummary / metadata 그대로 신뢰 X. v0.14 whitelist 로 재검증
  - **v0.14 ↔ v0.15 인터페이스 분리**: bindingRef logical reference + requestShape scalar 만 인계. credential value / URL endpoint / env object / raw payload 0건
  - **이중 환경 export**: `global.WS3_SecureTransportExecutorContract` + `module.exports`
- `/docs/ws3/WS3_v0_14_0_SECURE_TRANSPORT_EXECUTOR_CONTRACT_REPORT.md` — 완료 보고서 (신규, 17 sections)

### Adopted DP Policy
- **DP-SEC1** secure executor contract 만. 실제 발송/저장/호출 X. `contractMode='CONTRACT_ONLY'` + `liveExecutionAllowed=false` 강제.
- **DP-SEC2** transportExecutionEnvelope eligible/status override 금지. boolean AND 집계만.
- **DP-SEC3** CONTRACT_ONLY 외 mode → CONTRACT_BLOCKED. LIVE/REAL/EXECUTE 금지. liveExecutionAllowed=true 도 BLOCKED.
- **DP-SEC4** credential 9키 + env-like 11키 input/config 전체 nested object 재귀 검사 차단. case-insensitive + partial + depth 5. process.env / globalThis.env 코드 0건.
- **DP-SEC5** bindingRef logical reference only. validateBindingRef 형식 / 금지 substring / credential pattern 검증.
- **DP-SEC6** requestShape / payloadSummary / metadata whitelist scalar 만. 원본 객체 spread / Object.assign / deep clone / for-in 금지. v0.13 envelope 재검증.
- **DP-SEC7** dry-run wording only. 15 금지 어휘 sanitize ('REJECT' 기본).
- **DP-SEC8** side-effect 금지 — fetch / Telegram / KV / DB / DOM / storage / runtime clock 모두 0건.
- **DP-SEC9** 7종 입력 (transportExecutionEnvelope + transportPlan + rendererBinding + operationPacket + activeCycleDecision + evaluationOutcome + externalConfluence) read-only.
- **DP-SEC10** 신규 파일 1개 + 문서 갱신만. 보호 파일 24종 수정 금지.

### N-SEC-OBS 처리
- **N-SEC-OBS-1** 보호 baseline false-positive — 본 모듈 fetch / Date.now / new Date / performance.now / Object.assign / spread / deep clone / for-in 0건.
- **N-SEC-OBS-2** `payloadSummaryAllowedFields` namespace — v0.13 (`cfg.payloadSummary.allowedFields`) vs v0.14 (`cfg.requestShape.payloadSummaryAllowedFields`) namespace 분리. 구조적 충돌 없음.
- **N-SEC-OBS-3** `buildSafePayloadSummary` 동명 함수 — IIFE module-private. global export 미포함. v0.13 과 파일 scope 분리로 충돌 없음.
- **N-SEC-OBS-4** RESERVED 프레임워크 metadata 키 자동 차단 제외 — v0.13/v0.14 정책 metadata field 명 16종 (credentialMaxDepth / credentialAllowList / allowWebhookUrl / bindingRefAllowList 등) `isCredentialKey` exact match 사전 검사 통해 차단 회피. 사용자 입력의 동명 키도 detection 만 회피 (실제 credential value 검증은 다른 layer 책임).

### Changed
- `/docs/ws3/WS3_CHANGELOG.md` (본 파일): `[v0.14.0]` 엔트리 상단 추가
- `/docs/ws3/WS3_CURRENT_BASELINE.md`: 완료된 단계 표 + 보호 파일 목록 (24종) + 모듈 의존성 + 다음 단계 갱신

### Protected (수정 0건 — 24종)
- v3 *.js 19종 (config / feature-payload / bithumb-client / candle-normalizer / indicators / feature-payload-builder / score-breakdown / structure-bucket / signal-cycle / strategy-plan / card-view-model / operation-packet / active-cycle / evaluation-outcome / evaluation-observation-adapter / external-confluence / transport-plan / renderer-binding / transport-execution-adapter)
- `docs/ws3/WS3_CODE_CONTRACT.md` (b-r2 박제본 그대로)
- `docs/ws3/WS3_WORKFLOW_TEMPLATE.md` (v0.1 박제본 그대로)
- `index.html` / `manifest.json` / `service-worker.js`
- `worker.js` / `wrangler.toml`

### 의도된 미구현 (이번 단계 제외)
- 실제 Telegram bot API 호출 / chatId / botToken / webhookUrl 노출
- 실제 KV write / DB persist / 파일 IO / 브라우저 storage
- 실제 reviewQueue write / audit log 영속화
- 실제 DOM 렌더 / HTML attach / addEventListener
- 실제 env 접근 / process.env / Cloudflare env 객체 / secret binding 값 읽기
- 입력 객체 mutation
- 런타임 clock API (Date.now / new Date / performance.now)
- raw payload / payload.raw / identityInput / raw.builderDebug 노출

### Verified
- `node --check v3/v3-secure-transport-executor-contract.js` 통과 (SYNTAX_OK)
- smoke test **26 시나리오 / 82 assertion 전부 PASS**:
  - S1 ready all targets / S2 skipped / S3 invalid / S4 source BLOCKED / S5 LIVE BLOCKED / S6 liveExecutionAllowed=true BLOCKED
  - S7 credential top-level / S8 credential nested / S9 bindingRef safe / S10 URL/dot/colon / S11 token-like / S12 credential pattern
  - S13 env-like object (input.env / config.bindings / config.cloudflareEnv) / S14 object too deep
  - S15~S18 4 target contract shape (channelRef / bucketRef / evaluationType / auditType + bindingRef logical)
  - S19 payloadSummary revalidation / S20 metadata revalidation / S21 wording sanitize REJECT
  - S22 no env access / S23 no side-effect / S24 mutation 0 / S25 raw/secret value leak prevention
  - S26 v0.15 interface separation (process.env / api.telegram.org / sk-/xoxb-/eyJ 0 노출 + secureBindingPolicy 5 boolean 검증)
- 모든 시나리오 **입력 mutation 0건** (DP-SEC9, S24 frozen-input 검증)
- 금지 패턴 grep (실제 코드 침범 0건, 매치는 JSDoc 정책 + literal 차단 list + 변수/함수명):
  - `fetch( / KV. / DB / Telegram 실호출 / XMLHttpRequest / innerHTML / document. / addEventListener / localStorage / sessionStorage / Date.now( / new Date / performance.now` 코드 0건
  - `transportExecutionEnvelope.X = / transportPlan.X = / rendererBinding.X = / operationPacket.X = / activeCycleDecision.X = / evaluationOutcome.X = / externalConfluence.X =` **0건** ✅
  - `process.env / globalThis.env / globalThis.bindings / globalThis.secrets / typeof process !== / typeof globalThis ===` **0건** ✅ (2 JSDoc 정책 매치만)
  - `Object.assign / ...spread / JSON.parse(JSON.stringify) / for-in` 실제 사용 **0건** (3 JSDoc 정책)
  - `발송됨 / 저장됨 / 전송 완료 / sent / delivered / 매수 성공 / 손절 / 익절 / take profit / stop loss` 실제 출력 어휘 사용 0건 (FORBIDDEN_WORDS literal 차단 list 정의만)
  - env-like 키 매치 = JSDoc + `ENV_LIKE_KEYS_EXACT` literal array + `KV_SNAPSHOT_BINDING` constant + local var `env` (v0.13 envelope variable). 실제 env 접근 0건
- 보호 파일 `git diff --stat HEAD -- <24 protected files>` 빈 출력 = 0건

### 기준 commit
- branch: `claude/heuristic-cori-7865e7`
- 이전 functional baseline: WS3 v0.13.0 transportExecutionEnvelope (`5d05836`)
- 본 commit: (push 후 기록)

---

## [v0.13.0] — 2026-05-17 (Transport Execution Envelope)

### Added
- `/v3/v3-transport-execution-adapter.js` — TransportExecutionAdapter (신규, ~1400 라인)
  - `WS3_TransportExecutionAdapter.build(input, config)` → standalone dry-run safe envelope (입력 6종 mutate 0건)
  - **출력 top-level**: valid/version/dryRun(true)/envelopeMode('DRY_RUN')/envelopeStatus/telegramEnvelope/snapshotEnvelope/evaluationEnvelope/auditEnvelope/envelopeSummary + reasons/warnings/debug/configUsed
  - **envelopeStatus 6 후보** first-match-wins 우선순위: `ENVELOPE_INVALID > ENVELOPE_BLOCKED > ENVELOPE_PARTIAL > ENVELOPE_READY > ENVELOPE_SKIPPED > ENVELOPE_UNKNOWN`
  - **telegramEnvelope.eligible = 3-stage AND**: `tp.telegramPlan.shouldSend && cfg.execution.allowTelegram && envelopeMode==='DRY_RUN'`
  - **snapshotEnvelope.eligible = 3-stage AND**: `tp.snapshotPlan.shouldStore && cfg.execution.allowSnapshot && envelopeMode==='DRY_RUN'`
  - **evaluationEnvelope.eligible**: `(shouldStore || shouldUpdate || shouldClose || shouldReview) && cfg.execution.allowEvaluation && envelopeMode==='DRY_RUN'`
  - **auditEnvelope.eligible = 3-stage AND**: `tp.auditPlan.shouldAudit && cfg.execution.allowAudit && envelopeMode==='DRY_RUN'`
  - **credential 9키 recursive 차단** (DP-TX4): `secret/token/chatid/bottoken/apikey/authorization/password/credential/webhookurl` — case-insensitive + partial match + depth limit 5 + value output 0 노출
  - **payloadSummary 14 whitelist scalar only** (DP-TX5): candidateKey/base/quote/market/exchange/timeframe/messageType/snapshotType/evaluationType/resultType/auditType/displayMode/confluenceLabel/confluenceScore. Object.assign/spread/clone/for-in 코드 0건
  - **sanitizeMessageLines 3 모드** (U-TX-2): `REJECT` (기본, 안전 우선) / `REPLACE` / `WARN_ONLY`. 15 금지 어휘 (발송됨/sent/delivered/손절/익절/take profit 등) 차단
  - **v0.14.0+ real executor 와 credential 비전달 보장** — envelope 만 인계
  - **이중 환경 export**: `global.WS3_TransportExecutionAdapter` + `module.exports`
- `/docs/ws3/WS3_v0_13_0_TRANSPORT_EXECUTION_ADAPTER_REPORT.md` — 완료 보고서 (신규, 15 sections)

### Adopted DP Policy
- **DP-TX1** Dry-run envelope builder 만. 실제 발송/저장/호출 X. `dryRun=true` 강제.
- **DP-TX2** TransportPlan override 금지. 6 should* flag boolean AND 집계만.
- **DP-TX3** envelopeMode DRY_RUN only. LIVE/REAL/SEND 시도 시 ENVELOPE_BLOCKED.
- **DP-TX4** credential 9키 input/config 전체 nested object 재귀 검사 차단. case-insensitive + partial + depth 5.
- **DP-TX5** payloadSummary whitelist scalar only. 원본 객체 전체 spread / Object.assign / deep clone / for-in 금지.
- **DP-TX6** dry-run wording only. 발송됨/저장됨/전송 완료/sent/delivered/매수 성공/손절/익절/수익 확정/손실 확정/buy now/sell now/take profit/stop loss 금지.
- **DP-TX7** side-effect 금지 — fetch / Telegram / KV / DB / DOM / storage / runtime clock 모두 0건.
- **DP-TX8** 6종 입력 (transportPlan / rendererBinding / operationPacket / activeCycleDecision / evaluationOutcome / externalConfluence) read-only.
- **DP-TX9** rendererBinding 은 message preview 보강용. decision source = transportPlan.
- **DP-TX10** 신규 파일 1개 + 문서 갱신만. 보호 파일 23종 수정 금지.

### U-TX / N-TX-OBS 처리
- **U-TX-1** credential partial match 안전 우선 차단. `cfg.safety.credentialAllowList` 기본 빈 배열. allowList 에 명시된 key 이름만 차단 제외 가능.
- **U-TX-2** `cfg.wording.sanitizeMode = 'REJECT'` 기본값. REJECT (line 제거) / REPLACE (safe wording 치환) / WARN_ONLY (line 유지) 3 모드.
- **N-TX-OBS-1** dryRunOnly namespace 중복 (기존 `wording.dryRunOnly` vs v0.13.0 top-level/envelope-level `dryRunOnly`) — namespace 분리로 구조적 충돌 없음. JSDoc 으로 layer 출처 명시.
- **N-TX-OBS-2** 보호 baseline false-positive — v3-bithumb-client / v3-candle-normalizer / v3-indicators / v3-feature-payload-builder 의 fetch / Date.now / spread / Object.assign 사용은 보호 baseline 책임. 본 모듈은 0건 보장.

### Changed
- `/docs/ws3/WS3_CHANGELOG.md` (본 파일): `[v0.13.0]` 엔트리 상단 추가
- `/docs/ws3/WS3_CURRENT_BASELINE.md`: 완료된 단계 표 + 보호 파일 목록 (23종) + 모듈 의존성 + 다음 단계 갱신

### Protected (수정 0건 — 23종)
- v3 *.js 18종 (config / feature-payload / bithumb-client / candle-normalizer / indicators / feature-payload-builder / score-breakdown / structure-bucket / signal-cycle / strategy-plan / card-view-model / operation-packet / active-cycle / evaluation-outcome / evaluation-observation-adapter / external-confluence / transport-plan / renderer-binding)
- `docs/ws3/WS3_CODE_CONTRACT.md` (b-r2 박제본 그대로)
- `docs/ws3/WS3_WORKFLOW_TEMPLATE.md` (v0.1 박제본 그대로)
- `index.html` / `manifest.json` / `service-worker.js`

### 의도된 미구현 (이번 단계 제외)
- 실제 Telegram bot API 호출 / chatId / botToken / webhookUrl 노출
- 실제 KV write / DB persist / 파일 IO / 브라우저 storage
- 실제 reviewQueue write / audit log 영속화
- 실제 DOM 렌더 / HTML attach / addEventListener
- 입력 객체 mutation
- 런타임 clock API (Date.now / new Date / performance.now)
- raw payload / payload.raw / identityInput / raw.builderDebug 노출
- bot 식별 시크릿 / 채널 식별자 / API 키 / authorization header

### Verified
- `node --check v3/v3-transport-execution-adapter.js` 통과 (SYNTAX_OK)
- smoke test **21 시나리오 / 59 assertion 전부 PASS**:
  - S1 all eligible dry-run / S2 all skipped / S3 partial envelope / S4 invalid plan / S5 LIVE BLOCKED
  - S6 credential top-level / S7 credential nested / S8 case-insensitive / S9 partial match
  - S10~S13 4 envelope request shape / S14 safe payload summary / S15 no spread leak / S16 metadata whitelist
  - S17 wording sanitize REJECT / S18 rendererBinding reference only (decision 미override) / S19 mutation 0
  - S20 no exception under load / S21 raw/secret value leak prevention
- 모든 시나리오 **입력 mutation 0건** (DP-TX8, S19 검증 frozen input)
- 금지 패턴 grep (실제 코드 침범 0건, 매치는 모두 JSDoc 정책 + literal 차단 list + 변수/함수명):
  - `fetch( / KV. / DB / Telegram 실호출 / XMLHttpRequest / innerHTML / document. / addEventListener / localStorage / sessionStorage / Date.now( / new Date / performance.now` 코드 0건
  - `transportPlan.X = / rendererBinding.X = / operationPacket.X = / activeCycleDecision.X = / evaluationOutcome.X = / externalConfluence.X =` **0건** ✅
  - `Object.assign / ... spread / JSON.parse(JSON.stringify) / for-in` **실제 사용 0건** (4 매치 모두 JSDoc 정책)
  - `발송됨 / 저장됨 / 전송 완료 / sent / delivered / 매수 성공 / 손절 / 익절 / take profit / stop loss` 실제 출력 어휘 사용 0건 (literal 은 FORBIDDEN_WORDS 차단 list 정의)
  - credential value `payload.raw / identityInput / raw.builderDebug / chatId 값 / botToken 값 / apiKey 값` output 노출 0건
- 보호 파일 `git diff --stat HEAD -- <23종>` 빈 출력 = 0건

### 기준 commit
- branch: `claude/heuristic-cori-7865e7`
- 이전 functional baseline: WS3 v0.12.0 adapterOutputContractPack (`8fd0551`)
- 본 commit: (push 후 기록)

---

## [v0.12.0] — 2026-05-17 (Adapter Output Contract Pack)

### Added
- `/v3/v3-transport-plan.js` — TransportPlan (신규, 740 라인)
  - `WS3_TransportPlan.build(input, config)` → standalone dry-run plan 객체 (입력 5종 mutate 0건)
  - **출력 top-level**: valid/version/dryRun/telegramPlan/snapshotPlan/evaluationPlan/auditPlan + reasons/warnings/debug/configUsed
  - **telegramPlan.shouldSend = 4단계 AND**: `op.shouldNotify && ac.allowNotify && !ac.suppressNotify && ac.canNotify`
  - **snapshotPlan.shouldStore = 3단계 AND** (signal snapshot timing — outcome timing 제외)
  - **evaluationPlan.shouldStore = 4단계 AND** (outcome.shouldStoreOutcome 포함)
  - **auditPlan 7 후보** 우선순위: ROUTING_CONFLICT > DATA_AMBIGUOUS > DATA_INSUFFICIENT > REVIEW_REQUIRED > SUPPRESSED_NOTIFY > WARNING_PRESENT > NONE
  - **warningAuditMode = 'critical'** default (7 critical warning 만 audit trigger). 'all' / 'off' 옵션
  - **detectRoutingConflict() 분리**: ROUTING_CONFLICT_NOTIFY / ROUTING_CONFLICT_SNAPSHOT / ROUTING_CONFLICT_EVALUATION 각각 별도 reason
  - **dry-run 어휘 강제**: '발송됨/저장됨/sent/delivered/completed transmission' 코드 0건. '발송 후보/dry-run/저장 계획' 만 허용
  - **이중 환경 export**: `global.WS3_TransportPlan` + `module.exports`
- `/v3/v3-renderer-binding.js` — RendererBinding (신규, 834 라인)
  - `WS3_RendererBinding.build(input, config)` → standalone UI binding 객체 (DOM-free, 입력 mutate 0건)
  - **출력 top-level**: valid/version/displayMode/header/chips/metrics/sections/flags + reasons/warnings/debug/configUsed
  - **U-APO-1 Option B**: `sections.{strategy/lifecycle/evaluation/confluence/transport}` 모두 array
  - **U-APO-2 Option A**: `displayMode 7 후보` 우선순위 (BLOCKED→COOLDOWN→CLOSED→REVIEW→ALERT→DEFAULT→UNKNOWN)
  - **U-APO-3 Option C**: `flags` namespace 분리 (`flags.binding` + `flags.card`) — cardViewModel.displayFlags 10 boolean 보존
  - **cardViewModel superset** (header/chips/metrics) — mutation 없이 추가 정보 적층
  - **sections.strategy** cardViewModel.sections.strategy (object) → display item array 변환 (입력 mutate 0건)
  - **이중 환경 export**: `global.WS3_RendererBinding` + `module.exports`
- `/docs/ws3/WS3_v0_12_0_ADAPTER_OUTPUT_CONTRACT_PACK_REPORT.md` — 완료 보고서 (신규, 297 라인)

### Adopted DP Policy
- **DP-APO1** 출력 adapter contract 만. 실제 transport / renderer 구현 X. dry-run plan / binding 객체만 산출.
- **DP-APO2** v0.12.0 출력 layer (TransportPlan + RendererBinding). 입력 layer 는 v0.11.0 에서 완료.
- **DP-APO3** side-effect 금지 (fetch / Telegram 전송 / KV write / DB / DOM / storage / runtime clock / persist).
- **DP-APO4** snapshotPlan = **signal snapshot timing** (evaluationOutcome.shouldStoreOutcome 제외). evaluationPlan = **outcome timing**. timing 혼동 금지.
- **DP-APO5** TransportPlan 의 모든 routing 결정은 v0.8/v0.9/v0.10 출력의 boolean AND 집계. 재해석 / 재산출 금지.
- **DP-APO6** RendererBinding 은 cardViewModel superset. 기존 header/chips/metrics 보존하면서 추가 layer 적층. 기존 시각화 손상 0건.
- **DP-APO7** Config-driven (DEFAULT_*_CONFIG + mergeXxxConfig).
- **DP-APO8** 입력 객체 mutation / delete / Object.assign mutation 금지.
- **DP-APO9** 신규 파일 2개 + 문서 갱신만. 기존 v3 엔진 파일 (21종) 수정 금지.
- **DP-APO10** dry-run 어휘 강제 — '발송됨 / 저장됨 / 전송 완료 / sent / delivered / completed transmission' 코드 0건. '발송 후보 / dry-run / 저장 계획' 어휘만 사용.

### U-APO / N-APO-OBS 처리
- **U-APO-1 Option B** RendererBinding.sections.{strategy/lifecycle/evaluation/confluence/transport} 5종 모두 array. cardViewModel.sections.strategy (object) 는 display item array 로 변환 (입력 mutate 0건).
- **U-APO-2 Option A** displayMode 7 후보 (BLOCKED / COOLDOWN / CLOSED / REVIEW / ALERT / DEFAULT / UNKNOWN) 우선순위 first-match-wins. cardViewModel.tone / activeCycle.lifecycleState / evaluationOutcome.status 종합.
- **U-APO-3 Option C** flags namespace 분리 — `flags.binding` (RendererBinding 신규 boolean) + `flags.card` (cardViewModel.displayFlags 10 boolean preserved verbatim). 충돌 없이 양쪽 layer 보존.
- **N-APO-OBS-1** TransportPlan 의 auditPlan 은 reviewQueue 후보. 실제 reviewQueue write 0건 (v0.12.x 분리).
- **N-APO-OBS-2** dry-run 어휘 강제 (DP-APO10) — '전송 완료/sent' 표현 코드 침범 0건.

### Changed
- `/docs/ws3/WS3_CHANGELOG.md` (본 파일): `[v0.12.0]` 엔트리 상단 추가
- `/docs/ws3/WS3_CURRENT_BASELINE.md`: 완료된 단계 표 + 보호 파일 목록 (21종) + 모듈 의존성 + 다음 단계 갱신

### Protected (수정 0건 — 21종)
- v3 *.js 16종 (config / feature-payload / bithumb-client / candle-normalizer / indicators / feature-payload-builder / score-breakdown / structure-bucket / signal-cycle / strategy-plan / card-view-model / operation-packet / active-cycle / evaluation-outcome / evaluation-observation-adapter / external-confluence)
- `docs/ws3/WS3_CODE_CONTRACT.md` (b-r2 박제본 그대로)
- `docs/ws3/WS3_WORKFLOW_TEMPLATE.md` (v0.1 박제본 그대로)
- `index.html` / `manifest.json` / `service-worker.js`

### 의도된 미구현 (이번 단계 제외)
- 실제 Telegram bot API 호출 / chatId / botToken
- 실제 KV write / DB persist / 파일 IO / 브라우저 storage
- 실제 reviewQueue write (auditPlan 은 후보 산출 까지)
- 실제 DOM 렌더 / HTML attach / addEventListener
- 입력 객체 mutation
- 런타임 clock API (Date.now / new Date / performance.now)
- bot 식별 시크릿 / 채널 식별자 / API 키

### Verified
- `node --check v3/v3-transport-plan.js` 통과 (SYNTAX_OK)
- `node --check v3/v3-renderer-binding.js` 통과 (SYNTAX_OK)
- smoke test **22 시나리오** (20 핵심 + 2 Extra) 모두 통과:
  - S1 telegramPlan AND 4단계 / S2 shouldNotify false → block / S3 allowNotify false → block / S4 suppressNotify true → block / S5 canNotify false → block
  - S6 snapshotPlan 3단계 AND / S7 evaluationPlan 4단계 AND (outcome.shouldStoreOutcome 포함)
  - S8 auditPlan ROUTING_CONFLICT 우선 / S9 DATA_AMBIGUOUS / S10 DATA_INSUFFICIENT / S11 REVIEW_REQUIRED / S12 SUPPRESSED_NOTIFY / S13 WARNING_PRESENT critical-only / S14 NONE
  - S15 RendererBinding cardViewModel superset (header/chips/metrics preserved)
  - S16 sections 5종 모두 array (U-APO-1 B)
  - S17 displayMode 7 후보 우선순위 (BLOCKED win)
  - S18 flags namespace 분리 (binding + card 10 boolean preserved)
  - S19 mutation 0건 (양쪽 모듈 — frozen input)
  - S20 dry-run 어휘 / forbidden patterns 0건
  - Extra-A flags.card.* 10 key 보존 / Extra-B warningAuditMode='all'/'off' 분기
- 모든 시나리오 **입력 mutation 0건** (DP-APO8, S19 검증)
- 금지 패턴 grep (코드 침범 0건, 매치는 모두 정책 명시 JSDoc comment):
  - `fetch( / XMLHttpRequest / Telegram bot 호출 / sendMessage 실호출 / KV.put / KV.get / DB / localStorage / sessionStorage / Date.now( / new Date / performance.now` 코드 0건
  - `document. / innerHTML / addEventListener / DOMContentLoaded` 코드 0건
  - `발송됨 / 저장됨 / 전송 완료 / sent / delivered / completed transmission` 코드 0건 (dry-run 어휘 강제, DP-APO10)
  - `매수 성공 / 손절 / 익절 / 수익 확정 / 손실 확정 / profit / loss / take profit / stop loss / 매수하세요 / 매도하세요` 코드 0건
  - `chatId / botToken / apiKey / secret / token` 코드 0건
  - 입력 mutation (`input.X = / op.X = / ac.X = / ob.X = / oc.X = / cv.X = / delete <input>.X`) 0건
- 보호 파일 `git diff --stat HEAD --` 빈 출력 = 0건 (21종)

### 기준 commit
- branch: `claude/heuristic-cori-7865e7`
- 이전 functional baseline: WS3 v0.11.0 adapterInputContractPack (`4c94875`)
- 본 commit: (push 후 기록)

---

## [v0.11.0] — 2026-05-16 (Adapter Input Contract Pack)

### Added
- `/v3/v3-evaluation-observation-adapter.js` — EvaluationObservationAdapter (신규, 497 라인)
  - `WS3_EvaluationObservationAdapter.build(input, config)` → standalone evaluationObservation 객체 (v0.10.0 buildEvaluationOutcome 입력 호환)
  - **출력 17-field**: valid/version/candidateKey/window/startTs/endTs/baselinePrice/currentPrice/highPrice/lowPrice/closePrice/highTs/lowTs/closeTs/observedBars/complete/source + reasons/warnings
  - **field mapping 13종** (windowLabel/startMs/endMs/pricePoints×5/priceTimestamps×3/barsObserved/isComplete/sourceTag)
  - **U-ACP-1 Option A**: `source='adapter-normalized'` + `reasons[]='ADAPTER_NORMALIZED'`
  - **DP-ACP6 raw 차단**: `candles/rawCandles/candleArrays/raw/rawResponse/apiResponse` 입력 감지 시 `RAW_INPUT_STRIPPED` 워닝 + 출력 제외
  - **v0.10.0 호환 보장**: S11 smoke 에서 buildEvaluationOutcome 정상 처리 검증
  - **이중 환경 export**: `global.WS3_EvaluationObservationAdapter` + `module.exports`
- `/v3/v3-external-confluence.js` — ExternalConfluence (신규, 736 라인)
  - `WS3_ExternalConfluence.build(input, config)` → standalone externalConfluence 객체 (post-evaluation 보조 context layer)
  - **출력 top-level**: valid/version/market/sector/exchange/schedule/news/confluenceScore/confluenceLabel + reasons/warnings/debug/configUsed
  - **5종 sub-context 정규화**: market (btcMarketState/altMarketState/marketRisk) / sector (sectorState/sectorStrength) / exchange (exchangeContext/liquidityContext) / schedule (hasKnownEvent/eventType/eventRisk) / news (hasNews/newsTone)
  - **6 confluenceLabel 후보** (UNKNOWN/FAVORABLE/NEUTRAL/ADVERSE/MIXED)
  - **U-ACP-2**: `confluenceScore` number\|null, 기본 null, -100~100 범위. `enableScore` 기본 false → null. true 시 contribution 합산 + clamp
  - **DP-ACP5 보조 context**: scoreBreakdown/strategyPlan/totalScore/planQualityTier/strategyBias 필드 부재 (S7 검증)
  - **N-ACP-OBS-1**: payload.newsContext 직접 read 0건. caller-provided input.newsContext 만 처리
  - **이중 환경 export**: `global.WS3_ExternalConfluence` + `module.exports`
- `/docs/ws3/WS3_v0_11_0_ADAPTER_INPUT_CONTRACT_PACK_REPORT.md` — 완료 보고서 (신규)

### Adopted DP Policy
- **DP-ACP1** 입력 adapter contract 만. 실제 fetch / transport / renderer 구현 X.
- **DP-ACP2** v0.11.0 입력 layer (EvaluationObservationAdapter + ExternalConfluence). 출력 layer (TransportPlan / RendererBinding) 는 v0.12.0.
- **DP-ACP3** side-effect 금지 (fetch / Telegram / KV / DB / DOM / storage / runtime clock).
- **DP-ACP4** EvaluationObservation v0.10.0 호환: version='external-observation-v0', source='adapter-normalized', reasons[]에 ADAPTER_NORMALIZED 추가.
- **DP-ACP5** ExternalConfluence 보조 context. scoreBreakdown / strategyPlan 판단 대체 금지.
- **DP-ACP6** raw candles / full API response / payload.raw / identityInput 저장/노출 금지.
- **DP-ACP7** Config-driven (DEFAULT_*_CONFIG).
- **DP-ACP8** 입력 객체 mutation / delete 금지.
- **DP-ACP9** 신규 파일 2개 + 문서 갱신만. 기존 v3 엔진 파일 수정 금지.
- **DP-ACP10** TransportPlan / RendererBinding 미생성. v0.12.0 으로 분리.

### U-ACP / N-ACP-OBS 처리
- **U-ACP-1 Option A** EvaluationObservation.source = 'adapter-normalized'. reasons[]에 ADAPTER_NORMALIZED 추가. version='external-observation-v0' 유지. v0.10.0 호환 우선.
- **U-ACP-2** confluenceScore number\|null, 기본 null, 범위 -100~100. config `enableScore` 기본 false. true 시 contribution 합산 후 min/max clamp. 정량화 불충분 시 null 유지. confluenceLabel 기본 'UNKNOWN'.
- **N-ACP-OBS-1** payload.newsContext (v0.1.0) 와 input.newsContext (v0.11.0) 별도 layer. ExternalConfluence 는 caller 가 주입한 input.newsContext 만 처리. payload 직접 read 0건.
- **N-ACP-OBS-2** v0.2.0-a baseline 보호 파일의 Date.now / fetch 책임 분리. 본 2종 모듈 코드 침범 0건.

### Changed
- `/docs/ws3/WS3_CHANGELOG.md` (본 파일): `[v0.11.0]` 엔트리 상단 추가
- `/docs/ws3/WS3_CURRENT_BASELINE.md`: 완료된 단계 표 + 보호 파일 목록 + 모듈 의존성 + 다음 단계 갱신

### Protected (수정 0건 — 19종)
- v3 *.js 14종 (config / feature-payload / bithumb-client / candle-normalizer / indicators / feature-payload-builder / score-breakdown / structure-bucket / signal-cycle / strategy-plan / card-view-model / operation-packet / active-cycle / evaluation-outcome)
- `docs/ws3/WS3_CODE_CONTRACT.md` (b-r2 박제본 그대로)
- `docs/ws3/WS3_WORKFLOW_TEMPLATE.md` (v0.1 박제본 그대로)
- `index.html` / `manifest.json` / `service-worker.js`

### 의도된 미구현 (이번 단계 제외)
- 실제 Bithumb / Upbit / Binance / 외부 API fetch
- 실제 뉴스 fetch / 일정 API
- 실제 Telegram 발송 / KV / DB / 파일 IO / 브라우저 storage
- DOM 렌더 / UI 이벤트 연결
- 입력 객체 mutation
- 런타임 clock API (Date.now / new Date / performance.now)
- **TransportPlan / RendererBinding / AdapterContractPack / buildAdapterContractPack** (v0.12.0 으로 분리)
- bot 식별 시크릿 / 채널 식별자 / API 키

### Verified
- `node --check v3/v3-evaluation-observation-adapter.js` 통과
- `node --check v3/v3-external-confluence.js` 통과
- smoke test **15 시나리오** (12 핵심 + 3 Extra) 모두 통과:
  - S1 evaluationObservation normalize / S2 invalid price / S3 window normalize / S4 no raw candles
  - S5 externalConfluence normalize / S6 unknown defaults / S7 does NOT replace score
  - S8 score disabled by default / S9 score enabled (favorable 70 / adverse clamp)
  - S10 mutation check (양쪽 adapter) / S11 v0.10.0 compatibility / S12 forbidden patterns (runtime)
  - Extra-A frozen-input safety / Extra-B candidateKey missing / Extra-C marketRisk derivation
- 모든 시나리오 **입력 mutation 0건** (DP-ACP8, smoke 검증)
- **v0.10.0 buildEvaluationOutcome 호환 보장** (S11 — adapter 출력을 EO 가 정상 처리)
- 금지 패턴 grep (코드 침범 0건, 매치는 모두 정책 명시 comment):
  - `fetch( / KV. / DB / Telegram / sendTelegram / XMLHttpRequest / innerHTML / document. / addEventListener / localStorage / sessionStorage / Date.now( / new Date / performance.now` 코드 0건
  - `evaluationObservation.X = / externalConfluence.X = mutation` 0건
  - `delete <input>.X` 0건
  - `payload.raw / identityInput / raw.builderDebug / secret / chatId / botToken / apiKey / raw candles / full API response` 코드 0건
  - `매수 성공 / 손절 / 익절 / 수익 확정 / 손실 확정 / profit / loss / 매수하세요 / 매도하세요 / buy now / sell now / take profit / stop loss` 코드 0건 (양쪽 모듈)
  - `TransportPlan / RendererBinding / AdapterContractPack / buildAdapterContractPack / telegramPlan / snapshotPlan / evaluationPlan / rendererBinding` 정의 0건 (정책 comment 만)
- 보호 파일 `git diff` 빈 출력 = 0건 (19종)

### 기준 commit
- branch: `claude/heuristic-cori-7865e7`
- 이전 functional baseline: WS3 v0.10.0 evaluationOutcome (`887123a`)
- 본 commit: (push 후 기록)

---

## [v0.10.0] — 2026-05-16 (EvaluationOutcome / Result Classifier)

### Added
- `/v3/v3-evaluation-outcome.js` — evaluationOutcome 본체 (신규, 1407 라인)
  - `WS3_EvaluationOutcome.build(operationPacket, activeCycleDecision, evaluationObservation, previousEvaluationState, config)` → standalone evaluationOutcome 객체 (4종 입력 mutate 0건)
  - **출력 top-level 15-field**: `valid` / `version` / `candidateKey` / `identity` / `evaluation` / `priceBasis` / `movement` / `targetCheck` / `invalidationCheck` / `pathOrder` / `quality` / `routingDecision` / `nextEvaluationState` / `reasons` / `warnings` / `debug` / `configUsed`
  - **status 6 후보** (UNKNOWN/PENDING/IN_PROGRESS/COMPLETED/CLOSED/INVALID)
  - **resultType 11 후보** (NONE/IN_PROGRESS/TARGET_HIT/INVALIDATED/WATCH_CONFIRMED/WATCH_FAILED/NEUTRAL/EXPIRED_REVIEW/COOLDOWN_REVIEW/DATA_INSUFFICIENT/DATA_AMBIGUOUS) — 매수 성공/손절/익절 어휘 0건
  - **resultPhase 6 후보** (NONE/EARLY/MID/LATE/DONE/REVIEW)
  - **outcomeQuality 4 후보** (UNKNOWN/LOW/MEDIUM/HIGH)
  - **movement 누적** (DP-EO14): max(prev.maxFav, cur.highMove) / min(prev.maxAdv, cur.lowMove)
  - **target/invalidation source priority chain** (U-EO-2)
  - **unit 분리** (DP-EO6 + U-EO-1 Option A): hint.unit 부재 → default 'price'. cfg fallback 만 pct. UNIT_AMBIGUOUS 검사 (0<v<1 + baseline≥10)
  - **path order** (U-EO-3): DATA_AMBIGUOUS 는 pathOrderKnown=false 일 때만. highTs/lowTs numeric 시 firstEvent 결정
  - **nextEvaluationState 후보 산출** (DP-EO10) — 실제 저장 0건
  - **이중 환경 export**: `global.WS3_EvaluationOutcome` + `module.exports`
- `/docs/ws3/WS3_v0_10_0_EVALUATION_OUTCOME_REPORT.md` — 완료 보고서 (신규)

### Adopted DP Policy
- **DP-EO1** standalone 반환. operationPacket / activeCycleDecision / evaluationObservation / previousEvaluationState mutate 금지.
- **DP-EO2** side-effect 금지 (외부 전송 / 영속 저장 / network / DOM / 브라우저 storage).
- **DP-EO3** evaluationObservation caller 주입. v0.10.0 직접 수집 X.
- **DP-EO4** raw candles array 직접 저장/노출 금지.
- **DP-EO5** baselinePrice: evaluationSeed.baselinePrice → observation.baselinePrice → null (DATA_INSUFFICIENT).
- **DP-EO6** target/invalidation numeric only + value/pct 단위 분리. unit 부재 → default 'price'.
- **DP-EO7** DATA_AMBIGUOUS 최후 fallback. highTs/lowTs 비교로 선후 판단 우선.
- **DP-EO8** thresholds config-driven (planTargetPct=5 / watchConfirmPct=3 / invalidationPct=-5 등).
- **DP-EO9** 안전 결과 라벨. 매수 성공/손절/익절/수익·손실 확정 금지.
- **DP-EO10** nextEvaluationState 포함. 실제 저장은 후속 adapter.
- **DP-EO11** status (진행 상태) vs resultType (결과 분류) 분리.
- **DP-EO12** changePct/movementPct 만. profit/loss 표현 금지.
- **DP-EO13** previousEvaluationState caller 주입. null/invalid → base empty state.
- **DP-EO14** movement 누적: max(prev.maxFavorablePct, cur.highMovePct) / min(prev.maxAdversePct, cur.lowMovePct).

### U-EO / N-EO-OBS 처리
- **U-EO-1 Option A** hint.unit 부재 → default 'price'. pct 는 hint.unit==='pct' 또는 cfg fallback 만. UNIT_AMBIGUOUS detection (0<v<1 + baseline≥10).
- **U-EO-2** target: targetHints[0] → safeHints TARGET → cfg.planTargetPct. invalidation: type='INVALIDATION' 우선 → 'SETUP_INVALIDATION' → safeHints INVALIDATION → cfg.invalidationPct.
- **U-EO-3** DATA_AMBIGUOUS 는 pathOrderKnown !== true 일 때만. pathOrderKnown=true 면 firstEvent 로 TARGET_HIT/INVALIDATED 분기.
- **N-EO-OBS-1** timestamp 정책: pickStartTs (evaluationSeed.startTs → observation.startTs → prev.startTs → null). pickLastObservedTs (endTs → closeTs → prev → null). Date.now 사용 0건.
- **N-EO-OBS-2** v0.2.0-a baseline 보호 파일의 Date.now/fetch 책임 분리. 본 모듈 코드 침범 0건.

### Changed
- `/docs/ws3/WS3_CHANGELOG.md` (본 파일): `[v0.10.0]` 엔트리 상단 추가
- `/docs/ws3/WS3_CURRENT_BASELINE.md`: 완료된 단계 표 + 보호 파일 목록 + 모듈 의존성 + 다음 단계 갱신

### Protected (수정 0건 — 18종)
- v3 *.js 13종 (config / feature-payload / bithumb-client / candle-normalizer / indicators / feature-payload-builder / score-breakdown / structure-bucket / signal-cycle / strategy-plan / card-view-model / operation-packet / active-cycle)
- `docs/ws3/WS3_CODE_CONTRACT.md` (b-r2 박제본 그대로)
- `docs/ws3/WS3_WORKFLOW_TEMPLATE.md` (v0.1 박제본 그대로)
- `index.html` / `manifest.json` / `service-worker.js`

### 의도된 미구현 (이번 단계 제외)
- 24h/7d 캔들 실제 fetch / 외부 API 호출
- KV / DB / 파일 IO / 브라우저 storage read/write
- 알림 발송 / snapshot 저장 / outcome 영속화
- DOM 렌더 / UI 이벤트 연결
- 입력 4종 mutation
- 런타임 clock API (Date.now / new Date / performance.now)
- 매매 권고 / 매수·매도 어휘 / 수익·손실 확정

### Verified
- `node --check v3/v3-evaluation-outcome.js` 통과
- smoke test **21 시나리오** (15 핵심 + 6 Extra) 모두 통과:
  - S1 in progress / S2 target hit by value / S3 target hit by pct (cfg fallback) / S4 hint value > cfg pct (priority chain)
  - S5 invalidated by value / S6 invalidated by pct (cfg fallback) / S7 hint value > cfg pct (invalidation priority chain)
  - S8 watch confirmed / S9 watch failed / S10 data insufficient
  - S11 path target first / S12 path invalidation first / S13 path ambiguous
  - S14 movement cumulative / S15 invalid inputs
  - Extra-A status CLOSED via evaluationMode=CLOSE / Extra-B COOLDOWN_REVIEW
  - Extra-C U-EO-2 INVALIDATION priority (95 wins over SETUP_INVALIDATION 50)
  - Extra-D U-EO-1 hint w/o unit → default 'price'
  - Extra-E UNIT_AMBIGUOUS detection (0.05 + baseline 100 → 워닝)
  - Extra-F frozen-input safety
- 모든 시나리오 **4종 입력 mutation 0건** (DP-EO1, smoke 검증)
- 금지 패턴 grep (코드 침범 0건, 매치는 모두 정책 명시 comment):
  - `fetch( / KV. / DB / Telegram / sendTelegram / XMLHttpRequest / innerHTML / document. / addEventListener / localStorage / sessionStorage / Date.now( / new Date / performance.now` 코드 0건
  - `operationPacket.X = / activeCycleDecision.X = / evaluationObservation.X = / previousEvaluationState.X = mutation` 0건
  - `delete <input>.` 0건
  - `payload.raw / identityInput / raw.builderDebug / secret / token / chatId / botToken / apiKey / raw candles / full API response` 코드 0건
  - `매수 성공 / 손절 / 익절 / 수익 확정 / 손실 확정 / profit / loss / 매수하세요 / 매도하세요 / buy now / sell now / take profit / stop loss` 코드 0건
- 보호 파일 `git diff` 빈 출력 = 0건 (18종)

### 기준 commit
- branch: `claude/heuristic-cori-7865e7`
- 이전 functional baseline: WS3 v0.9.0 activeCycle (`00831af`)
- 본 commit: (push 후 기록)

---

## [v0.9.0] — 2026-05-16 (ActiveCycle / Packet Lifecycle)

### Added
- `/v3/v3-active-cycle.js` — activeCycleDecision 본체 (신규, 1279 라인)
  - `WS3_ActiveCycle.build(operationPacket, previousOperationState, config)` → standalone activeCycleDecision 객체 (2종 입력 mutate 0건)
  - **출력 top-level 15-field**: `valid` / `version` / `candidateKey` / `identity` / `lifecycle` / `transition` / `routingDecision` / `notifyPolicy` / `snapshotPolicy` / `evaluationPolicy` / `nextState` / `reasons` / `warnings` / `debug` / `configUsed` (U-AC-3)
  - **lifecycleState 8 후보** (NONE/NEW/ACTIVE/PERSISTING/STRENGTHENING/WEAKENING/COOLDOWN/EXPIRED). DUPLICATE/SUPPRESSED 금지 (DP-AC12)
  - **lifecyclePhase 7 후보** (NONE/NEW/EARLY/ACTIVE/MATURE/LATE/CLOSED). seenCount 우선 + ageMs 보조 (DP-AC13)
  - **transition 11 후보** (NONE/NEW_CANDIDATE/SAME_CANDIDATE/CANDIDATE_CHANGED/STATE_CHANGED/STRENGTHENED/WEAKENED/COOLDOWN_ENTERED/COOLDOWN_CONTINUED/EXPIRED/DUPLICATE_SUPPRESSED). DUPLICATE_SUPPRESSED 는 transition 에만 허용
  - **cooldown 2종 분리** (DP-AC14): signalCooldown (operationPacket COOLDOWN) vs notifyCooldown (lastNotifyTs + minIntervalMs)
  - **state strength ranking** (DP-AC9 + U-AC-1 Option A): EXPIRED -100 / COOLDOWN -50 / BLOCKED -30 / WEAKENING -10 / NONE 0 / WATCH 10 / WATCH_24H 15 / READY 30 / PLAN_24H 40 / STATE_CHANGE 45 / PLAN_WEAK 45 / PLAN_STRONG 55 / PLAN_PREMIUM 65 / STRENGTHENING 70. max() 사용 (합산/평균 X)
  - **이중 환경 export**: `global.WS3_ActiveCycle` + `module.exports`
- `/docs/ws3/WS3_v0_9_0_ACTIVE_CYCLE_REPORT.md` — 완료 보고서 (신규)

### Adopted DP Policy
- **DP-AC1** standalone 반환. operationPacket / previousOperationState mutate 금지.
- **DP-AC2** side-effect 금지 (외부 전송 / 영속 저장 / network / DOM / 브라우저 storage).
- **DP-AC3** previousOperationState caller 주입. v0.9.0 직접 읽지 않음.
- **DP-AC4** operationPacket.candidateKey 만 사용. 재계산 금지.
- **DP-AC5** timestamp 기준: snapshotPacket.timestamp → evaluationSeed.startTs → null. 런타임 clock API 금지.
- **DP-AC6** same candidate + no state change + suppressDuplicate → suppressNotify. currentTs 시 minIntervalMs 적용.
- **DP-AC7** canSnapshot / canEvaluate boolean 만. 실제 저장/평가는 후속 adapter.
- **DP-AC8** nextState 포함. 저장은 후속 adapter.
- **DP-AC9** ranking helper. max() 사용. 합산 / 평균 X. 매매 점수 / 알림 등급 아님.
- **DP-AC10** safe summary 만. raw / secret / identityInput / candle raw 저장 금지.
- **DP-AC11** operationPacket EXPIRED 1순위. expireAfterMs 보조. currentTs/firstSeenTs null 시 시간 기반 생략.
- **DP-AC12** lifecycleState 에 DUPLICATE / SUPPRESSED 금지. 중복/억제는 transition / notifyPolicy / routingDecision 에서.
- **DP-AC13** lifecyclePhase 7 후보. seenCount 우선 + ageMs 보조 (currentTs 있을 때만).
- **DP-AC14** signalCooldown vs notifyCooldown 분리.

### U-AC / N-AC-OBS 처리
- **U-AC-1 Option A** STRENGTHENING ranking source 확장 — `snapshotPacket.state.cycleState` / `snapshotPacket.cycle.cycleState` 추가. STRENGTHENING(70) / WEAKENING(-10) ranking 활성화.
- **U-AC-2 Option A** previous null/invalid → base zero state (seenCount=0). 첫 관측 seenCount=1.
- **U-AC-3** Gate 2 spec top-level shape 그대로 구현 (15-field).
- **N-AC-OBS-1** v3-signal-cycle.js `isActiveCycleState` helper 와 충돌 회피 — 본 모듈은 `isActiveLifecycleState` 사용.
- **N-AC-OBS-2** v0.2.0-a baseline 보호 파일의 Date.now / fetch literal 책임. 본 모듈 코드 침범 0건.

### Changed
- `/docs/ws3/WS3_CHANGELOG.md` (본 파일): `[v0.9.0]` 엔트리 상단 추가
- `/docs/ws3/WS3_CURRENT_BASELINE.md`: 완료된 단계 표 + 보호 파일 목록 + 모듈 의존성 + 다음 단계 갱신

### Protected (수정 0건 — 17종)
- `v3-config.js` / `v3-feature-payload.js` / `v3-bithumb-client.js` / `v3-candle-normalizer.js` / `v3-indicators.js` / `v3-feature-payload-builder.js` / `v3-score-breakdown.js` / `v3-structure-bucket.js` / `v3-signal-cycle.js` / `v3-strategy-plan.js` / `v3-card-view-model.js` / `v3-operation-packet.js`
- `docs/ws3/WS3_CODE_CONTRACT.md` (b-r2 박제본 그대로)
- `docs/ws3/WS3_WORKFLOW_TEMPLATE.md` (v0.1 박제본 그대로)
- `index.html` / `manifest.json` / `service-worker.js`

### 의도된 미구현 (이번 단계 제외)
- KV / DB / 파일 IO / 브라우저 storage read/write
- 외부 전송 / 알림 발송 (별도 transport adapter)
- snapshot 실제 저장
- evaluation 실제 실행 / 24h / 7d outcome 계산
- DOM / 렌더 / UI 이벤트 연결
- 입력 2종 mutation
- 런타임 clock API 사용
- 등급 코드 / 매매 점수 / 매매 권고
- bot 식별 시크릿 / 채널 식별자 / API 키

### Verified
- `node --check v3/v3-active-cycle.js` 통과
- smoke test **16 시나리오** (12 핵심 + 4 Extra) 모두 통과:
  - S1 new candidate → lifecycleState=NEW / transition=NEW_CANDIDATE / seenCount=1 (U-AC-2)
  - S2 same candidate persisting → lifecycleState=PERSISTING / seenCount += 1
  - S3 duplicate suppressed → duplicateSuppressed=true / suppressNotify=true / suppressReason=DUPLICATE
  - S4 candidate changed → CANDIDATE_CHANGED transition
  - S5 strengthening → STRENGTHENING / STRENGTHENED transition
  - S6 weakening / risk change → WEAKENING / WEAKENED transition
  - S7 signal cooldown → signalCooldownActive=true / notifyCooldownActive=false / suppressReason=SIGNAL_COOLDOWN
  - S8 notify cooldown → notifyCooldownActive=true / signalCooldownActive=false / suppressReason=NOTIFY_COOLDOWN
  - S9 expired by packet → lifecycleState=EXPIRED / lifecyclePhase=CLOSED
  - S10 expired by age → lifecycleState=EXPIRED (시간 기반)
  - S11 no timestamp → ageMs=null / notifyCooldownActive=false / seenCount 증가. throw 0
  - S12 invalid inputs → valid=false / OPERATION_PACKET_NOT_OBJECT 워닝
  - Extra-A state ranking max() — 합산/평균 불일치, max 일치
  - Extra-B lifecycleState DUPLICATE/SUPPRESSED 미사용 (4 케이스)
  - Extra-C cooldown 분리 — signal/notify 독립 동작
  - Extra-D frozen-input safety
- 모든 시나리오 **2종 입력 mutation 0건** (DP-AC1, smoke 검증)
- 금지 패턴 grep (코드 침범 0건, 매치는 모두 정책 명시 comment):
  - `KV. / DB / Telegram / sendTelegram / fetch( / XMLHttpRequest / innerHTML / document. / addEventListener / localStorage / sessionStorage / Date.now( / new Date / performance.now` 코드 0건
  - `operationPacket.X = / previousOperationState.X = mutation` 0건
  - `delete <input>.` 0건
  - `payload.raw / identityInput / raw.builderDebug / secret / token / chatId / botToken / apiKey` 코드 0건
  - `매수하세요 / 매도하세요 / buy now / sell now / take profit / stop loss` 코드 0건
  - `lifecycleState DUPLICATE / SUPPRESSED` 사용 0건 (LIFECYCLE_STATE enum 부재)
  - `isActiveCycleState` v3-active-cycle.js 본 모듈 사용 0건 (정책 comment 만)
- 보호 파일 `git diff` 빈 출력 = 0건 (17종)

### 기준 commit
- branch: `claude/heuristic-cori-7865e7`
- 이전 functional baseline: WS3 v0.8.0 operationPacket (`2fb95cf`)
- 본 commit: (push 후 기록)

---

## [v0.8.0] — 2026-05-16 (OperationPacket · notification/snapshot/evaluation 후보 패킷)

### Added
- `/v3/v3-operation-packet.js` — operationPacket 본체 (신규)
  - `WS3_OperationPacket.build(payload, scoreBreakdown, structureDecision, signalCycle, strategyPlan, cardViewModel, config)` → standalone operationPacket 객체 (6종 입력 mutate 0건)
  - **출력 7대 영역**: `identity` (6-field) / `candidateKey` / `routing` / `notificationPacket` / `snapshotPacket` / `evaluationSeed` / `displaySummary` + reasons / warnings / debug / configUsed
  - **3가지 분류 type** — notificationType (6) / snapshotType (6) / evaluationType (5) 우선순위 분류
  - **routing 3-flag** — shouldNotify / shouldSnapshot / shouldEvaluate (boolean, config 게이트)
  - **safeHints 4 라벨** — REFERENCE_ZONE / INVALIDATION_LEVEL / TARGET_HINT / RISK_REWARD_HINT (HINT_LABEL ko/en)
  - **이중 환경 export**: `global.WS3_OperationPacket` + `module.exports`
- `/docs/ws3/WS3_v0_8_0_OPERATION_PACKET_REPORT.md` — 완료 보고서 (신규)

### Adopted DP Policy
- **DP-OP1** standalone 반환. 6종 입력 (payload/scoreBreakdown/structureDecision/signalCycle/strategyPlan/cardViewModel) mutate/delete 금지.
- **DP-OP2** side-effect 금지 (외부 전송 / 영속 저장 / network / DOM / browser storage).
- **DP-OP3** 출력: routing + notificationPacket + snapshotPacket + evaluationSeed + displaySummary 구조.
- **DP-OP4** shouldNotify 기본 false. enable && valid && type != NONE 일 때만 true.
- **DP-OP5** shouldSnapshot 기본 true (config 활성화). invalid/NONE 시 false.
- **DP-OP6** shouldEvaluate 기본 true (config 활성화). invalid/NONE 시 false.
- **DP-OP7** evaluationSeed 포함 (seed-only). 실제 평가는 후속 계층.
- **DP-OP8** baselinePrice numeric only. object/range/string entryZone skip. isNumericPrice() fallback chain.
- **DP-OP9** safeHints numeric hint 허용. 매수가/손절가/익절가 라벨 금지. 안전 라벨 4종만.
- **DP-OP10** raw payload / payload.raw / builderDebug 전체 / identityInput / candle raw array 직접 노출 금지.
- **DP-OP11** 등급 코드 외부 노출 금지.
- **DP-OP12** candidateKey 재계산 금지. signalCycle.candidateKey 그대로 복사.

### U-OP 처리 (Gate 1 unclear 해소)
- **U-OP-1 Option A** identity merge — field-by-field fallback (6-field 풀-set):
  - exchange: payload.identity.exchange → null
  - market: cardViewModel.identity.market → payload.identity.market → null
  - base: payload.identity.base → cardViewModel.identity.symbol → null
  - quote: payload.identity.quote → null
  - displayName: payload.identity.displayName → cardViewModel.header.title → cardViewModel.identity.symbol → null
  - timeframe: cardViewModel.identity.timeframe → payload.raw.builderDebug.primaryTimeframe → 'h1'
- **U-OP-2 Option A** timestamp/startTs/snapshotKey ts 기준 — `payload.ts` 단일 기준. primary candle ts 재해석 금지.
- **U-OP-3** isSameCandidate 방어 — `persistence && persistence.isSameCandidate === false` defensive check.

### Changed
- `/docs/ws3/WS3_CHANGELOG.md` (본 파일): `[v0.8.0]` 엔트리 상단 추가
- `/docs/ws3/WS3_CURRENT_BASELINE.md`: 완료된 단계 표 + 보호 파일 목록 + 모듈 의존성 + 다음 단계 갱신

### Protected (수정 0건 — 16종)
- `v3-config.js` / `v3-feature-payload.js` / `v3-bithumb-client.js` / `v3-candle-normalizer.js` / `v3-indicators.js` / `v3-feature-payload-builder.js` / `v3-score-breakdown.js` / `v3-structure-bucket.js` / `v3-signal-cycle.js` / `v3-strategy-plan.js` / `v3-card-view-model.js`
- `docs/ws3/WS3_CODE_CONTRACT.md` (b-r2 박제본 그대로)
- `docs/ws3/WS3_WORKFLOW_TEMPLATE.md` (v0.1 박제본 그대로)
- `index.html` / `manifest.json` / `service-worker.js`

### 의도된 미구현 (이번 단계 제외)
- 실제 외부 전송 / 알림 발송 (별도 transport 단계)
- KV / DB / 파일 IO / 브라우저 storage 저장
- network 호출 / XHR / 외부 fetch
- 평가 결과 계산 (returnPct / maxDrawdownPct / reachedTarget / invalidated)
- 24h / 7d outcome 산출
- DOM / 렌더 / HTML 생성 (별도 renderer 단계)
- 등급 코드 / tier 산출
- 런타임 clock API 사용
- bot 식별 시크릿 / 채널 식별자 / API 키

### Verified
- `node --check v3/v3-operation-packet.js` 통과
- smoke test **14 시나리오** (9 핵심 + 5 Extra) 모두 통과:
  - S1 ready notification candidate → notification READY / shouldNotify default false / candidateKey 복사
  - S2 watch candidate → notification WATCH / evaluation WATCH_24H
  - S3 blocked risk → notification BLOCKED / evaluation NONE
  - S4 cooldown → notification COOLDOWN / snapshot COOLDOWN / evaluation COOLDOWN_REVIEW
  - S5 expired → notification EXPIRED / snapshot EXPIRED / evaluation EXPIRED_REVIEW
  - S6 snapshot candidate → snapshot CANDIDATE / shouldSnapshot true / snapshotKey 에 payload.ts 포함
  - S7 state change → STATE_CHANGE 3 패턴 (strengthening / isSameCandidate=false / bucketTransition)
  - S8 evaluation seed → PLAN_24H / horizon 24H / baselinePrice 112 (referencePrice)
  - S9 null inputs → 모두 NONE / shouldX 모두 false / identity.timeframe default 'h1'
  - Extra-A baselinePrice numeric only — object entryZone skip → last close fallback
  - Extra-B identity field-by-field fallback — 6-field 정확히 채워짐
  - Extra-C shouldNotify default false — enable 시 true
  - Extra-D snapshotKey null when ts missing
  - Extra-E frozen-input safety
- 모든 시나리오 **6종 입력 mutation 0건** (DP-OP1, smoke 검증)
- 금지 패턴 grep (identifier 기반):
  - `Date.now(` / `performance.now(` / `new Date(` / `setTimeout` / `setInterval` 0건
  - `document.` / `window.` / `localStorage` / `sessionStorage` / `XMLHttpRequest` / `fetch(` / `addEventListener` / `innerHTML` 0건
  - `Telegram` / `sendTelegram` / `telegramFetch` / `botToken` / `chatId` / `apiKey` / `secret` / `token` 0건
  - `payload.X = / scoreBreakdown.X = / structureDecision.X = / signalCycle.X = / strategyPlan.X = / cardViewModel.X = mutation` 0건
  - `delete <input>.` 0건
  - `매수하세요 / 매도하세요 / buy now / sell now / take profit / stop loss` 0건 (comment 외)
  - `buySignal / sellSignal / orderSignal / realEntryPrice / realStopLoss / realTakeProfit / stopLossHint / takeProfitHint / planGradeHint` 0건
  - `payload.raw / identityInput / raw.builderDebug` — raw 객체 전체 / identityInput 객체 노출 0건. `payload.raw.builderDebug.primaryTimeframe` scalar read 만 허용 (v0.7.0 정합)
  - refined: `(^|[^A-Za-z0-9_])P-(S|A|B)([^A-Za-z0-9_]|$)` (word-boundary) 0건
- 보호 파일 `git diff` 빈 출력 = 0건 (16종)

### 기준 commit
- branch: `claude/heuristic-cori-7865e7`
- 이전 functional baseline: WS3 v0.7.0 cardViewModel (`7e2ef36`)
- 본 commit: (push 후 기록)

---

## [v0.7.0] — 2026-05-16 (CardViewModel · hotfix 반영)

### Added
- `/v3/v3-card-view-model.js` — cardViewModel 본체 (신규, hotfix 반영본)
  - `WS3_CardViewModel.build(payload, scoreBreakdown, structureDecision, signalCycle, strategyPlan, config)` → standalone cardViewModel 객체 (5종 입력 mutate 0건)
  - **출력 7대 영역** (DP-UI3): `identity` / `header` / `chips` / `metrics` / `sections` / `displayFlags` / `tone` + reasons / warnings / debug / configUsed
  - **sections 7개** (DP-UI9): overview / score / structure / cycle / strategy / risk / debug
  - **metrics 는 array** (DP-UI4) — 각 item = { id, labelKey, labelKo, labelEn, value, kind, tone, sortKey }
  - **라벨 패턴** (DP-UI5): labelKey + labelKo + labelEn 직접 포함 — badge / chip / metric 동일
  - **tone semantic token 8종** (DP-UI6): positive/neutral/caution/warning/muted/info/critical/unknown — 색상 코드 X
  - **displayFlags 정확히 10 boolean** (DP-UI7 / r0.2-final): isReady / isBlocked / isCooldown / isExpired / isWeakening / isHighActionability / showEntryPlan / showExitPlan / showRiskWarning / showDebug
  - **debug 기본 숨김 + allowedFields whitelist 기본 빈 배열** (DP-UI8): identityInput / candles / rawCandles / candleArrays / raw / builderDebug 영구 차단 (BLOCKED_FIELDS). primitive 값만 통과
  - **8개 라벨 사전** — STRATEGY_BIAS_LABEL (10) / CYCLE_STATE_LABEL (8) / CYCLE_PHASE_LABEL (5) / ACTIONABILITY_LABEL (5) / PLAN_QUALITY_LABEL (7) / STRUCTURE_BUCKET_LABEL (13) / PRICE_ZONE_LABEL (4) / RISK_LEVEL_LABEL (4)
  - **이중 환경 export**: `global.WS3_CardViewModel` + `module.exports`
- `/docs/ws3/WS3_v0_7_0_CARD_VIEW_MODEL_REPORT.md` — 완료 보고서 (신규, hotfix 반영본)

### Adopted DP Policy (r0.2-final 매핑)
- **DP-UI1** standalone cardViewModel. 입력 5종 (payload/scoreBreakdown/structureDecision/signalCycle/strategyPlan) mutate/delete 금지.
- **DP-UI2** DOM / HTML / renderer 작성 금지. 데이터 객체만 산출.
- **DP-UI3** 출력 7대 영역: identity + header + chips + metrics + sections + displayFlags + tone.
- **DP-UI4** metrics 는 array. object 형태 metrics 금지.
- **DP-UI5** 라벨은 labelKey + labelKo + labelEn 직접 포함.
- **DP-UI6** tone semantic token 사용 (positive/neutral/caution/warning/muted/info/critical/unknown). 색상 코드 / hex / inline style 금지.
- **DP-UI7** showEntryPlan / showExitPlan boolean. displayFlags 에 위치.
- **DP-UI8** debug 기본 숨김. raw payload / payload.raw / payload.raw.builderDebug 전체 직접 노출 금지. identityInput / candle raw array 직접 노출 영구 차단. cfg.debug.allowedFields whitelist 방식. 기본값 빈 배열.
- **DP-UI9** sections 7개 생성 (overview / score / structure / cycle / strategy / risk / debug).
- **DP-UI10** P-S / P-A / P-B 최종 알림 등급 표시 금지.
- **DP-UI11** numeric hint (entryZone/invalidationHint/targetHint/penalty) 는 sections.strategy / sections.risk 만.

### 부가 정책 (코드 헤더 명시)
- header.primaryBadge 는 strategyBias 우선 (cycleState override 금지). cycleState 는 chips.
- reasons / warnings 는 4종 산출 객체로부터 dedupe 누적.
- "매수하세요" / "매도하세요" 명령 어조 금지.
- stopLossHint / takeProfitHint / buySignal / sellSignal / planGradeHint 등 구버전 라벨 금지.

### N-UI-OBS 처리 (Gate 1)
- **N-UI-OBS-1** `index.html` 의 `w1_buildCardViewModel` 은 WOOS v5.x 운영 스코프. 본 단계 `WS3_CardViewModel` 과 prefix 분리. 충돌 0건.
- **N-UI-OBS-2** `v3-candle-normalizer.js:30` `Date.now()` 는 v0.2.0-a 박제본. 본 단계 비대상. 미수정.
- **N-UI-OBS-3** `payload.raw.builderDebug.identityInput` 은 payload 내부에 존재하지만, **CardViewModel debug section 에서는 직접 노출 금지**. cfg.debug.allowedFields 기본값은 빈 배열이며, identityInput / payload.raw / raw.builderDebug blanket 노출은 BLOCKED_FIELDS 로 영구 차단. Extra-B smoke 에서 identityInput / SECRET_DO_NOT_LEAK 노출 0건 확인.

### Changed
- `/docs/ws3/WS3_CHANGELOG.md` (본 파일): `[v0.7.0]` 엔트리 상단 추가
- `/docs/ws3/WS3_CURRENT_BASELINE.md`: 완료된 단계 표 + 보호 파일 목록 + 모듈 의존성 + 다음 단계 갱신

### Protected (수정 0건 — 15종)
- `v3-config.js` / `v3-feature-payload.js` / `v3-bithumb-client.js` / `v3-candle-normalizer.js` / `v3-indicators.js` / `v3-feature-payload-builder.js` / `v3-score-breakdown.js` / `v3-structure-bucket.js` / `v3-signal-cycle.js` / `v3-strategy-plan.js`
- `docs/ws3/WS3_CODE_CONTRACT.md` (b-r2 박제본 그대로)
- `docs/ws3/WS3_WORKFLOW_TEMPLATE.md` (v0.1 박제본 그대로)
- `index.html` / `manifest.json` / `service-worker.js`

### 의도된 미구현 (이번 단계 제외)
- 실제 매수/매도 주문
- Telegram / 알림 발송 (v0.8.0)
- DOM 렌더 계층 / 실제 HTML 출력 (별도 renderer 단계)
- snapshot URL / 저장 / 사후평가 (v0.8.0)
- 외부 신호 / LW activeCycle (v0.9.x+)
- 등급 코드 매핑 / 알림 등급 산출
- 저장소 read/write
- 외부 호출 / 브라우저 storage / KV
- 런타임 clock API 사용

### Verified
- `node --check v3/v3-card-view-model.js` 통과
- smoke test **12 시나리오** (8 핵심 + 4 Extra) 모두 통과 (10-key displayFlags + labelKey + allowedFields whitelist):
  - S1 reclaim ready → isReady / isHighActionability / showEntryPlan / showExitPlan / labelKey 존재 / primaryBadge=BIAS / tone=positive
  - S2 breakout ready → isReady + isHighActionability / tone=positive
  - S3 pullback wait → not high / not blocked / showEntryPlan=false / tone=neutral
  - S4 risk off → isBlocked / isWeakening / showRiskWarning / tone=warning
  - S5 cooldown → isCooldown + isBlocked / primaryBadge=BIAS_COOLDOWN_WAIT
  - S6 expired → isExpired / tone=critical
  - S7 numeric hint exposure → entryZone/invalidationHint/targetHint 는 sections.strategy 만. header/chips/metrics 0건
  - S8 null inputs → valid=false / labelKey='UNKNOWN' / tone=unknown / NOT_OBJECT warning
  - **Extra-A** debug default null (showDebug=false → sections.debug === null)
  - **Extra-B** identityInput / raw / builderDebug / candles / rawCandles / candleArrays / LEAK_OBJECT 하드 블록 (allowedFields 통과해도 차단)
  - **Extra-C** allowedFields scalar passthrough (primaryTimeframe/resolvedTsSource/builderVersion)
  - **Extra-D** allowedFields 기본 빈 배열 → builderDebug 필드 추가 노출 0건
  - **Extra-E** frozen-input safety (deepFreeze 5종 입력에 대해 throw 0)
- 모든 시나리오에서 **displayFlags 10 keys 모두 boolean** 검증
- 모든 시나리오에서 **5종 입력 mutation 0건** (DP-UI1, S1~S6 smoke 검증)
- 금지 패턴 grep (identifier 기반):
  - `Date.now(` / `performance.now(` / `new Date(` / `setTimeout` / `setInterval` 0건
  - `document.` / `window.` / `localStorage` / `sessionStorage` / `XMLHttpRequest` / `fetch(` / `addEventListener` 0건 (comment 외)
  - `Telegram` / `externalConfluence` / `renderer` / `innerHTML` / `outerHTML` / `appendChild` 0건 (comment 외)
  - `payload.<x>= / scoreBreakdown.<x>= / structureDecision.<x>= / signalCycle.<x>= / strategyPlan.<x>= mutation` 0건
  - `delete <input>.` 0건
  - **`stopLossHint` / `takeProfitHint` / `buySignal` / `sellSignal` / `planGradeHint` 잔존 0건** (comment 외)
  - **`매수하세요` / `매도하세요` 등 명령 어조 0건** (comment 외)
  - **`metrics:\s*\{` 2건 모두 config.metrics object** (mergeConfig/makeConfigUsed). output cardViewModel.metrics 는 array (smoke 검증)
  - `primaryBadge.*cycleState/CYCLE_/COOLDOWN/EXPIRED/WEAKENING` override 0건
  - `payload.raw` / `identityInput` / `raw.builderDebug` 매치는 모두 (a) 정책 주석, (b) BLOCKED_FIELDS 배열 리터럴, (c) buildIdentity 의 primaryTimeframe scalar read, (d) buildDebugSection 가드 — **raw 객체 전체 노출 0건. identityInput 노출 0건** (Extra-B smoke 검증)
  - refined: `P-S/A/B` (word-boundary) 1건 — DP-UI10 정책 주석 line 40 (false-positive, 코드 사용 0건)
- 보호 파일 `git diff` 빈 출력 = 0건 (15종)

### 기준 commit
- branch: `claude/heuristic-cori-7865e7`
- 이전 functional baseline: WS3 v0.6.0 strategyPlan (`8ebba40`)
- 본 commit: (push 후 기록)

---

## [v0.6.0] — 2026-05-16 (strategyBias / entryPlan / exitPlan)

### Added
- `/v3/v3-strategy-plan.js` — strategyPlan 본체 (신규)
  - `WS3_StrategyPlan.build(payload, scoreBreakdown, structureDecision, signalCycle, config)` → standalone strategyPlan 객체 (모든 입력 mutate 0건)
  - **4축 분류**: strategyBias (10) / planType (7) / actionability (5) / planQualityTier (7) 독립 산출
  - **entryPlan + exitPlan + riskControls** 후보 산출 (실제 주문 지시 아님)
  - **이중 환경 export**: `global.WS3_StrategyPlan` + `module.exports`
- `/docs/ws3/WS3_v0_6_0_STRATEGY_PLAN_REPORT.md` — 완료 보고서 (신규)

### U-STRAT-1 처리 방침 (Option B 확정)
작업지시서의 priceZone 라벨을 실제 v0.4.0 산출 라벨로 매핑:
- `BOX_TOP` → `priceZone.zone === 'TOP_NEAR'`
- `BOX_BOTTOM` → `priceZone.zone === 'BOTTOM_NEAR'`
- `BOX_MIDDLE` → `priceZone.zone === 'MIDDLE'`
- `ABOVE_BOX` → `structureDecision.structureBucket === 'ABOVE_BOX_CONFIRMED_CANDIDATE'`
- `BELOW_BOX` → `structureDecision.structureBucket === 'BELOW_BOX_CONFIRMED_CANDIDATE'`

### Adopted DP Policy
- **DP-STRAT1** standalone strategyPlan. payload/scoreBreakdown/structureDecision/signalCycle mutate 금지.
- **DP-STRAT2** 10 strategyBias 후보 (UNKNOWN/NO_TRADE/WATCH_ONLY/PULLBACK_WAIT/BREAKOUT_READY/RECLAIM_READY/MOMENTUM_FOLLOW/RISK_OFF/COOLDOWN_WAIT/EXPIRED_IGNORE).
- **DP-STRAT3** planType 7 후보 (NONE/WATCH/PULLBACK/BREAKOUT/RECLAIM/MOMENTUM/RISK_OFF).
- **DP-STRAT4** actionability 5 후보 (NONE/LOW/MEDIUM/HIGH/BLOCKED). HIGH ≠ "매수하라".
- **DP-STRAT5** planQualityTier 7 후보 (PLAN_PREMIUM/PLAN_STRONG/PLAN_STANDARD/PLAN_WATCH/PLAN_WEAK/PLAN_AVOID/NONE). 알림 등급 아님. 등급 코드 매핑 X.
- **DP-STRAT6** numeric hint 허용. 실제 주문가 아님.
- **DP-STRAT7** invalidationHint / targetHint 사용 (구버전 손절·익절 힌트 라벨 사용 금지).
- **DP-STRAT8** ABOVE_BOX 추격: cfg.risk.allowChaseAboveBox 기본 false. requirePullback.
- **DP-STRAT9** WEAKENING → RISK_OFF/BLOCKED. COOLDOWN → COOLDOWN_WAIT/BLOCKED. EXPIRED → EXPIRED_IGNORE/BLOCKED.
- **DP-STRAT10** strategyBias 분류 우선순위 11단계 (risk/cooldown/expired → reclaim/breakout → BOX_TOP_PRESSURE 분기 → momentum → fallback).
- **DP-STRAT11** 4축 용도 분리 (strategyBias / planType / actionability / planQualityTier).

### Changed
- `/docs/ws3/WS3_CHANGELOG.md` (본 파일): `[v0.6.0]` 엔트리 상단 추가
- `/docs/ws3/WS3_CURRENT_BASELINE.md`: 완료된 단계 표 + 보호 파일 목록 + 모듈 의존성 + 다음 단계 갱신

### Protected (수정 0건 — 14종)
- `v3-config.js` / `v3-feature-payload.js` / `v3-bithumb-client.js` / `v3-candle-normalizer.js` / `v3-indicators.js` / `v3-feature-payload-builder.js` / `v3-score-breakdown.js` / `v3-structure-bucket.js` / `v3-signal-cycle.js`
- `docs/ws3/WS3_CODE_CONTRACT.md` (b-r2 박제본 그대로)
- `docs/ws3/WS3_WORKFLOW_TEMPLATE.md` (v0.1 박제본 그대로)
- `index.html` / `manifest.json` / `service-worker.js`

### 의도된 미구현 (이번 단계 제외)
- 실제 매수/매도 주문
- 알림 발송 (v0.8.0)
- 화면 모델 / 렌더 계층 / UI (v0.7.0)
- 외부 신호 / LW activeCycle (v0.9.x+)
- 등급 코드 매핑 / 알림 등급 산출
- 저장소 read/write
- 외부 호출 / DOM / 브라우저 storage / KV
- 런타임 clock API 사용

### Verified
- `node --check v3/v3-strategy-plan.js` 통과
- smoke test **12 시나리오** 모두 통과:
  - RECLAIM (LOW_SWEEP_RECLAIM_CANDIDATE / NEW_CANDIDATE) → RECLAIM_READY / RECLAIM / HIGH / PLAN_PREMIUM
  - EXPIRED → EXPIRED_IGNORE / BLOCKED / PLAN_AVOID
  - COOLDOWN → COOLDOWN_WAIT / BLOCKED / PLAN_AVOID
  - WEAKENING → RISK_OFF / BLOCKED / PLAN_AVOID
  - NOT_READY → NO_TRADE / BLOCKED / PLAN_AVOID
  - ABOVE_BOX (default allowChase=false) → BREAKOUT_READY / MEDIUM + requirePullback / PULLBACK_ENTRY / INVALIDATION_ONLY
  - ABOVE_BOX + STRENGTHENING → exitPlan.type = TRAILING_HINT
  - ABOVE_BOX + allowChase=true override → BREAKOUT_READY / HIGH (완화 없음)
  - BOX_TOP_PRESSURE + TOP_NEAR + conf=80 → BREAKOUT_READY / BREAKOUT_TRIGGER
  - BOX_TOP_PRESSURE + low conf → PULLBACK_WAIT
  - BOX_MIDDLE → WATCH_ONLY
  - null inputs → UNKNOWN / NONE×4 / valid=false
- 모든 시나리오 **payload/scoreBreakdown/structureDecision/signalCycle mutation 0건** (DP-STRAT1, smoke 검증)
- 금지 패턴 grep (identifier 기반):
  - `grade` literal 0건 (entryPlan/exitPlan/signalCycle은 v0.6.0 허용 식별자)
  - `payload.<x>= mutation` 0건 (line 19/20 헤더 주석의 매핑 표 `===` false-positive)
  - `scoreBreakdown.<x>= / structureDecision.<x>= / signalCycle.<x>= mutation` 0건
  - `delete <input>.` 0건
  - `fetch(` / `document.` / `localStorage` / `sessionStorage` / `XMLHttpRequest` / `Date.now(` 0건
  - **`stopLossHint` / `takeProfitHint` / `planGradeHint` 잔존 0건** (구버전 라벨)
  - refined: `P-S/A/B` / `Telegram` / `externalConfluence` / 렌더 / UI 모델 식별자 0건
- 보호 파일 `git diff` 빈 출력 = 0건

### 기준 commit
- branch: `claude/heuristic-cori-7865e7`
- 이전 functional baseline: WS3 v0.5.0 signalCycle (`59c8b78`)
- 본 commit: (push 후 기록)

---

## [v0.5.0] — 2026-05-16 (signalCycle / persistence / cooldown)

### Added
- `/v3/v3-signal-cycle.js` — signalCycle 본체 (신규)
  - `WS3_SignalCycle.build(payload, scoreBreakdown, structureDecision, previousSignalState, config)` → standalone signalCycle 객체 (모든 입력 mutate 0건)
  - **8 cycleState** — UNKNOWN / NO_SIGNAL / NEW_CANDIDATE / PERSISTING / STRENGTHENING / WEAKENING / COOLDOWN / EXPIRED
  - **5 cyclePhase** — UNKNOWN / SEED / ACTIVE / COOLING / ENDED
  - **7 bucketFamily** — TOP_FAMILY / BOTTOM_FAMILY / LOW_SWEEP_FAMILY / RECLAIM_FAMILY / HIGH_SWEEP_FAMILY / NEUTRAL_FAMILY / NONE
  - **candidateKey** = `exchange:market:timeframe:bucketFamily`
  - **이중 환경 export**: `global.WS3_SignalCycle` + `module.exports`
- `/docs/ws3/WS3_v0_5_0_SIGNAL_CYCLE_REPORT.md` — 완료 보고서 (신규)

### Adopted DP Policy
- **DP-CYC1** standalone signalCycle 반환. payload/scoreBreakdown/structureDecision/previousSignalState mutate 금지.
- **DP-CYC2** previousSignalState optional input. Case A full / Case B minimal 두 형식만 허용. 저장소 read/write 0건.
- **DP-CYC3** candidateKey = exchange + market + timeframe + bucketFamily (`mode: 'bucketFamily'`).
- **DP-CYC4** 8 cycleState 후보.
- **DP-CYC5** cyclePhase 5 후보 (NEW_CANDIDATE → SEED / PERSISTING·STRENGTHENING·WEAKENING → ACTIVE / COOLDOWN → COOLING / EXPIRED·NO_SIGNAL → ENDED).
- **DP-CYC6** ageBars = 실행 횟수 카운터 (실제 candle gap 아님).
- **DP-CYC7** cooldown.bars=3 (임시 기본값, backtest 후 조정).
- **DP-CYC8** ready threshold: minConfidence=40, minTotalScore=30 (임시 기본값). ready != 전략 진입 가능.
- **DP-CYC9** strengthen/weaken delta ±5/±10 (OR). 동시 충족 → PERSISTING + MIXED_DELTA warning. 한 축만 충족 + 반대 축 작은 변동 → 단순 분류.
- **DP-CYC10** 런타임 clock API 사용 금지. `payload.ts` → `payload.candles[primaryTimeframe]` 마지막 candle.ts → null 우선순위 (U-CYC-1 Option A 확정).
- **DP-CYC11** EXPIRED 1-turn 전환 (cooldown 소진 또는 ageBars >= maxAgeBars=20).
- **U-CYC-1 Option A** — `payload.raw.builderDebug.sourceTs` 부재 확인. 우선순위 2번을 primary candle.ts로 흡수. 보호 파일 무손상.

### Changed
- `/docs/ws3/WS3_CHANGELOG.md` (본 파일): `[v0.5.0]` 엔트리 상단 추가
- `/docs/ws3/WS3_CURRENT_BASELINE.md`: 완료된 단계 표 + 보호 파일 목록 + 모듈 의존성 + 다음 단계 갱신

### Protected (수정 0건)
- `v3-config.js` / `v3-feature-payload.js` / `v3-bithumb-client.js` / `v3-candle-normalizer.js` / `v3-indicators.js` / `v3-feature-payload-builder.js` / `v3-score-breakdown.js` / `v3-structure-bucket.js`
- `docs/ws3/WS3_CODE_CONTRACT.md` (b-r2 박제본 그대로)
- `docs/ws3/WS3_WORKFLOW_TEMPLATE.md` (v0.1 박제본 그대로)
- `index.html` / `manifest.json` / `service-worker.js`

### 의도된 미구현 (이번 단계 제외)
- `grade` / `tier` / 등급 코드
- `strategyBias` / `entryPlan` / `exitPlan` — v0.6.0
- `renderer` / `cardViewModel` / `UI` — v0.7.0
- 알림 연동 / `snapshot` / `evaluation` — v0.8.0
- 외부 신호 / `LW activeCycle` — v0.9.x+
- 저장소 read/write (KV / 브라우저 storage / DB / snapshot) 0건
- 외부 호출 (외부 API / DOM / 브라우저 storage / KV) 0건
- 런타임 clock API 사용 0건

### Verified
- `node --check v3/v3-signal-cycle.js` 통과
- smoke test 7 시나리오 + 2 추가 시나리오 모두 통과:
  - **NEW_CANDIDATE** (no previous state) → SEED, streak=1
  - **PERSISTING** (same candidate, delta neutral) → ACTIVE, streak=3
  - **STRENGTHENING** (delta +10/+20) → ACTIVE, isStrengthening=true
  - **WEAKENING** (delta -20/-30) → ACTIVE, isWeakening=true
  - **COOLDOWN** (prev active + current not ready) → COOLING, barsRemaining=3
  - **EXPIRED via cooldown** (barsRemaining 1→0) → ENDED, barsRemaining=0
  - **EXPIRED via maxAge** (ageBars 19+1=20=maxAgeBars) → ENDED, MAX_AGE_REACHED:20
  - + invalid previous state → NEW_CANDIDATE + `PREVIOUS_STATE_INVALID` warning
  - + null payload → NO_SIGNAL, candidateKey=null, ready=false
- 모든 시나리오 **payload/scoreBreakdown/structureDecision/previousSignalState mutation 0건** (DP-CYC1, smoke 검증)
- 금지 패턴 grep (identifier 기반):
  - `(grade|strategyBias|entryPlan|exitPlan)\s*[:=]` 0건
  - `\.(grade|strategyBias|entryPlan|exitPlan)` 0건
  - `payload.<x> = mutation` 0건 (line 276 `===` 비교 false-positive)
  - `scoreBreakdown.<x>= / structureDecision.<x>= / previousSignalState.<x>= mutation` 0건 (line 325/342 `===` 비교 false-positive)
  - `delete payload./scoreBreakdown./structureDecision./previousSignalState.` 0건
  - `fetch(` / `document.` / `localStorage` / `sessionStorage` / `XMLHttpRequest` / `Date.now(` 0건 (주석 literal도 0건)
  - refined: `P-S/A/B` / `Telegram` / `externalConfluence` / 렌더 식별자 / UI 모델 식별자 0건
- 보호 파일 `git diff` 빈 출력 = 0건

### 기준 commit
- branch: `claude/heuristic-cori-7865e7`
- 이전 functional baseline: WS3 v0.4.0 structureBucket decision (`9e94b4d`)
- 본 commit: (push 후 기록)

---

## [v0.4.0] — 2026-05-16 (structureBucket / priceZone / referenceLow)

### Added
- `/v3/v3-structure-bucket.js` — structureBucket 본체 (신규)
  - `WS3_StructureBucket.build(payload, scoreBreakdown, config)` → standalone structureDecision 객체 (payload / scoreBreakdown mutate 0건)
  - **13 structureBucket 후보** — UNKNOWN / NO_STRUCTURE / BOX_MIDDLE / BOX_TOP_PRESSURE / BOX_BOTTOM_RISK / ABOVE_BOX_CONFIRMED_CANDIDATE / BELOW_BOX_CONFIRMED_CANDIDATE / LOW_SWEEP_PENDING / LOW_SWEEP_RECLAIM_CANDIDATE / HIGH_SWEEP_REJECT_CANDIDATE / RECLAIM_READY / BREAKOUT_PRESSURE_CANDIDATE / BREAKDOWN_RISK_CANDIDATE
  - **confidence 0~100** (등급 미사용. 가산식: box+25 / priceZone+20 / refLow+20 / sweep/reclaim+20 / structureScore≥15 +15)
  - **이중 환경 export**: `global.WS3_StructureBucket` + `module.exports`
- `/docs/ws3/WS3_v0_4_0_STRUCTURE_BUCKET_REPORT.md` — 완료 보고서 (신규)

### Confirmed paths (Gate 1 결과 — CASE B 이중 nesting)
- structure root: `payload.structure.structure`
- box: `payload.structure.structure.box`
- referenceLows (복수형 's'): `payload.structure.structure.referenceLows`
- priceZone: `payload.structure.structure.priceZone`
- sweepReclaim: `payload.structure.structure.sweepReclaim`
- touch count: `payload.structure.structure.box.touchesHigh / touchesLow` (v3-indicators.js 출력 재사용, 재계산 0건)
- distance: `payload.structure.structure.box.distanceToTopPct / distanceToBottomPct`
- currentClose: `payload.candles[primaryTimeframe]` last `.close`
- primaryTimeframe: `payload.raw.builderDebug.primaryTimeframe || 'h1'`

### Adopted DP Policy
- **DP-STR1** standalone structureDecision. payload / scoreBreakdown mutate 금지.
- **DP-STR2** 13 structureBucket 후보 사용.
- **DP-STR3** priceZone source 우선순위 (structureRoot.priceZone → box distance 보조 → UNKNOWN).
- **DP-STR4** referenceLow 선택 (sweep/reclaim 관련 low → 최근 valid → null). `distancePct = (currentClose - refLow.value) / currentClose * 100`.
- **DP-STR5** 4-touch 기준 (`breakoutTouchCount=4`, `breakdownTouchCount=4`). touch count 재계산 0건.
- **DP-STR6** confidence 0~100. 등급 미사용.
- **DP-STR7** scoreBreakdown.components.structure.score만 confidence 보조값. totalScore 미사용.
- **DP-STR8** riskPenalty 미반영 (후속 strategyBias / entryPlan 단계).
- **DP-STR9** ABOVE_BOX → ABOVE_BOX_CONFIRMED_CANDIDATE / BELOW_BOX → BELOW_BOX_CONFIRMED_CANDIDATE.
- **DP-STR10** 분류 우선순위 (sweep/reclaim → box 외부 → box pressure/risk → priceZone → fallback).
- **N-STR-1** referenceLows 복수형 's' 사용.
- **N-STR-2** 각 sub-component (box / priceZone / referenceLow / sweepReclaim) valid 개별 점검.
- **N-STR-3** currentClose = primary timeframe (default 'h1') 마지막 candle.close.
- **N-STR-4** confidence 가산은 `components.structure.valid === true && score >= 15` 조건만.
- **N-STR-5** structureBucket === UNKNOWN || NO_STRUCTURE → confidence = 0.

### Changed
- `/docs/ws3/WS3_CHANGELOG.md` (본 파일): `[v0.4.0]` 엔트리 상단 추가
- `/docs/ws3/WS3_CURRENT_BASELINE.md`: 완료된 단계 표 + 보호 파일 목록 + 모듈 의존성 + 다음 단계 갱신

### Protected (수정 0건)
- `v3-config.js` / `v3-feature-payload.js` / `v3-bithumb-client.js` / `v3-candle-normalizer.js` / `v3-indicators.js` / `v3-feature-payload-builder.js` / `v3-score-breakdown.js`
- `docs/ws3/WS3_CODE_CONTRACT.md` (b-r2 박제본 그대로)
- `docs/ws3/WS3_WORKFLOW_TEMPLATE.md` (v0.1 박제본 그대로)
- `index.html` / `manifest.json` / `service-worker.js`

### 의도된 미구현 (이번 단계 제외)
- `grade` 산출 / `tier` / 등급 코드
- `signalCycle` / `persistence` / `cooldown` — v0.5.0
- `strategyBias` / `entryPlan` / `exitPlan` — v0.6.0
- `renderer` / `cardViewModel` / `UI` — v0.7.0
- 알림 연동 / `snapshot` / `evaluation` — v0.8.0
- 외부 신호 / `LW activeCycle` — v0.9.x+
- `riskPenalty` 반영 (DP-STR8)
- 새 캔들 fetch / 새 지표 계산 / touch count 재계산 — 0건
- 외부 호출 (외부 API / DOM / 브라우저 storage / KV) 0건
- 런타임 clock API 사용 0건

### Verified
- `node --check v3/v3-structure-bucket.js` 통과
- smoke test 4 시나리오 모두 통과:
  - **consolidation box** (h1 60개) → `RECLAIM_READY` (DP-STR10 우선순위 1번 적용), confidence 100, payload/scoreBreakdown mutation 0건
  - **low sweep + reclaim** → `LOW_SWEEP_RECLAIM_CANDIDATE`, confidence 100
  - **empty / createEmpty payload** → `NO_STRUCTURE`, confidence 0 (N-STR-5)
  - **null payload** → `NO_STRUCTURE`, confidence 0, components shape 유지, warnings `['PAYLOAD_NOT_OBJECT']`
- 금지 패턴 grep (identifier 기반): 모두 0건
  - `(grade|signalCycle|entryPlan|exitPlan)\s*[:=]` 0건
  - `\.(grade|signalCycle|entryPlan|exitPlan)` 0건
  - `payload.<x> = mutation` 0건 (이전 단계 false-positive조차 없음)
  - `scoreBreakdown.<x> = mutation` 0건
  - `delete payload.` / `delete scoreBreakdown.` 0건
  - `fetch(` / `document.` / `localStorage` / `sessionStorage` / `XMLHttpRequest` / `Date.now(` 0건 (주석 literal도 0건)
  - refined `P-S/A/B` / `Telegram` / `externalConfluence` / 렌더/UI 식별자 0건
- 보호 파일 `git diff` 빈 출력 = 0건

### 기준 commit
- branch: `claude/heuristic-cori-7865e7`
- 이전 functional baseline: WS3 v0.3.0 scoreBreakdown core (`b7e0ea3`)
- 이전 commit (직전): WS3 v0.3.0-docs Workflow Template v0.1 (`d8bebc2`)
- 본 commit: (push 후 기록)

---

## [v0.3.0-docs] — 2026-05-16 (Workflow Template v0.1)

문서 박제 단계. 기능 코드 변경 없음. 운영 워크플로우 표준 템플릿을 repo 운영 문서로 박제.

### Added
- `/docs/ws3/WS3_WORKFLOW_TEMPLATE.md` — WS3 Workflow Template v0.1 (신규)
  - GPT 작업지시서 초안 → Claude Web 피드백 → GPT 최종 전문 → Claude Code 실행 흐름 박제
  - **Claude Web 역할 = 작업지시서 피드백만** (§0.1 / §0.3 / §8 / §14.3 재확인)
  - **Claude Code 역할 = repo 실제 코드 작성 / 검증 / diff / commit / push** (§0.1 / §0.4)
  - **GPT 역할 = 작업지시서 초안 전문 작성 + 최종 전문 작성 + commit 메시지 작성** (§0.1 / §0.5)
  - **14단계 흐름** (§0.2) — Gate 1 (사전 조사) → Gate 2 (코드 작성) → Gate 3 (commit) → Gate 4 (push) + Gate 5/6 (PR/main merge 별도 승인)
  - **4 Gate** 승인 게이트 (§12.1)
  - **commit 한 줄 원칙** (§12.2) — 기본 한 줄 subject. multi-line body는 사용자 별도 요청 시에만
  - **PR / main merge 별도 승인 원칙** (§13) — feature branch push까지는 Gate 4까지, main merge는 항상 Gate 5/6 별도
  - DP prefix 명명 규칙 (§6) — DP-1~7 (c-r1) / DP-S1~7 (v0.3.0 score) / DP-STR* (v0.4.0 structure) / DP-CYC* / DP-STG* 등
  - 변수 치환 체크리스트 (§16) — `{{...}}` 34종
  - v0 → v0.1 개정 사항 (§17) — GPT 검토 6건 반영
- 원본 파일: `C:\Users\neosi\Desktop\WOOS_V3\Output\WS3_Workflow_Template_v0_1.md` (24,261 B, SHA256 무결성 검증)

### Changed
- `/docs/ws3/WS3_CHANGELOG.md` (본 파일): `[v0.3.0-docs]` 엔트리 상단 추가
- `/docs/ws3/WS3_CURRENT_BASELINE.md`: 운영 문서 섹션에 `WS3_WORKFLOW_TEMPLATE.md` 추가

### Functional Baseline (변경 없음)
- 기능 baseline: **WS3 v0.3.0 scoreBreakdown core** (`b7e0ea3`) — 본 단계는 문서 박제이므로 기능 버전 상승 X
- 다음 기능 단계: **WS3 v0.4.0 structureBucket / priceZone / referenceLow 확정**

### Protected (수정 0건)
- `v3-config.js` / `v3-feature-payload.js` / `v3-bithumb-client.js` / `v3-candle-normalizer.js` / `v3-indicators.js` / `v3-feature-payload-builder.js` / `v3-score-breakdown.js`
- `docs/ws3/WS3_CODE_CONTRACT.md` (b-r2 박제본 그대로)
- `index.html` / `manifest.json` / `service-worker.js` / `worker.js` / `wrangler.toml`

### Code change
- **0건** (문서 박제 전용 단계)

### Verified
- 원본 파일 SHA256 == 복사본 SHA256 (`FC9E66F9...8FCF0D`)
- 보호 파일 `git diff` 빈 출력 = 0건
- 구버전 표현 grep 0건 (`Claude Web 산출물 생성` / `사용자 산출물 다운로드` / `Claude Web 작업지시서 생성`)
- 역할 분담 grep 매치 확인 (§0.1)

### 기준 commit
- branch: `claude/heuristic-cori-7865e7`
- 이전 baseline: WS3 v0.3.0 scoreBreakdown core (`b7e0ea3`)
- 본 commit: (push 후 기록)

---

## [v0.3.0] — 2026-05-16 (scoreBreakdown 본체)

### Added
- `/v3/v3-score-breakdown.js` — scoreBreakdown 본체 (신규)
  - `WS3_ScoreBreakdown.build(payload, config)` → standalone scoreBreakdown 객체 (13 top-level field payload mutate 0건)
  - 5 component (core 25 / structure 20 / volume 20 / momentum 15 / execution 20 = 100)
  - riskPenalty 최대 15
  - `grossScore = sum(components)`, `totalScore = clamp(grossScore - riskPenalty, 0, maxScore)`
  - 이중 환경 export: `global.WS3_ScoreBreakdown` + `module.exports`
- `/docs/ws3/WS3_v0_3_0_SCORE_BREAKDOWN_REPORT.md` — 완료 보고서 (신규)

### Adopted DP Policy
- **DP-S1** payload mutate 금지. standalone 객체 반환.
- **DP-S2** weight 25/20/20/15/20 = 100. config override 가능.
- **DP-S3** unavailable component → valid=false + score=0. sub-signal 부분 누락 → 부분점 + warning.
- **DP-S4** payload.risk 기본값(penalty=null, level='UNKNOWN', flags=[])이면 penalty 0.
- **DP-S5** grade / tier / label / P-S/A/B 미산출.
- **DP-S6** buyPressure 점수 미반영. core에서 object 존재만 검사.
- **DP-S7** DEFAULT_SCORE_CONFIG 본 파일 내부 보관. v3-config.js 미수정.
- **DP-S8** core(존재성/구조) vs execution(양적 충분성) 평가 범위 분리. 중복 점수화 금지.
- **DP-S9** valid(계산 가능 여부) vs totalScore(신호 강도) 분리.
- **N-1** 빈 객체 component → valid=false + score=0 + `NO_*_SIGNALS` warning.
- **N-2** buyPressure 점수 미반영 (DP-S6 정합).
- **N-3** marketContext 점수 미반영. core에서 object 존재만.
- **N-4** tradeValue 통계 키 (`currentTradeValueKrw` 등) v3-indicators 출력 그대로 사용.
- **N-5** indicator warnings → execution 감점 + 경미한 riskPenalty. 중복 감점 X (builderWarnCap=4 / indicatorWarnCap=2).

### Indicator state 라벨 활용 (별도 임계값 하드코딩 0건)
- RSI state: STRONG=4 / OVERBOUGHT=2 / NEUTRAL=1 / OVERSOLD=1 / OVERHEATED=0
- MFI state: STRONG_BUY_PRESSURE=4 / BUY_PRESSURE=3 / NEUTRAL=1 / LOW=1 / OVERHEATED=0
- OBV trend: UP=3 / FLAT=1 / DOWN=0
- MA trendLabel: MA_BULLISH=4 / MA_ABOVE_MIXED=2 / MA_FLAT=1 / MA_MIXED=1 / 나머지=0
- volumeState: EXTREME=8 / SURGE=6 / RISING=4 / NORMAL=2 / LOW=0

### Changed
- `/docs/ws3/WS3_CHANGELOG.md` (본 파일): `[v0.3.0]` 엔트리 상단 추가
- `/docs/ws3/WS3_CURRENT_BASELINE.md`: 완료된 단계 표 + 보호 파일 목록 + 모듈 의존성 + 다음 단계 갱신

### Protected (수정 0건)
- `v3-config.js` / `v3-feature-payload.js` / `v3-bithumb-client.js` / `v3-candle-normalizer.js` / `v3-indicators.js` / `v3-feature-payload-builder.js`
- `docs/ws3/WS3_CODE_CONTRACT.md` (b-r2 박제본 그대로)
- `index.html` / `manifest.json` / `service-worker.js`

### 의도된 미구현 (이번 단계 제외)
- `grade` 산출 / `tier` / `label` / `P-S/A/B`
- `signalCycle` / `structureBucket` 최종 판정
- `strategyBias` / `entryPlan` / `exitPlan`
- `renderer` / `cardViewModel` / `UI`
- `externalConfluence` / `Telegram`
- `buyPressure` 계산 / `marketContext` 라벨링 (createEmpty default 유지)
- 외부 호출 (외부 API / DOM / 브라우저 storage / KV) 0건
- 런타임 clock API 사용 0건

### Verified
- `node --check v3/v3-score-breakdown.js` 통과
- smoke test (h1 60개 synthetic candle) 통과:
  - `valid: true / grossScore: 84 / riskPenalty: 0 / totalScore: 84`
  - components 5개 / max 합계 100
  - grade/signalCycle/entryPlan/exitPlan/tier/label 모두 부재
  - **payload mutated: false** (DP-S1)
- edge null: `valid=false / grossScore=0 / totalScore=0` + components shape 유지
- edge empty signals (createEmpty + identity 채움): `valid=true / totalScore=31` (DP-S9 — momentum/volume/structure valid=false, core/execution valid=true)
- 금지 패턴 grep (identifier 기반):
  - `(grade|signalCycle|entryPlan|exitPlan)\s*[:=]` 0건
  - `\.(grade|signalCycle|entryPlan|exitPlan)` 0건
  - `delete payload.` 0건
  - `fetch(` / `document.` / `localStorage` / `sessionStorage` / `XMLHttpRequest` / `Date.now(` 0건 (주석에도 literal 0건)
  - `payload.<x> = mutation` 0건 (line 563 `===` 비교문 false-positive 검토 완료)
- 보호 파일 `git diff` 빈 출력 = 0건

### 기준 commit
- branch: `claude/heuristic-cori-7865e7`
- 이전 baseline: WS3 v0.2.0-c-r1 (`51e510d`)
- 본 commit: (push 후 기록)

---

## [v0.2.0-c-r1] — 2026-05-16 (buildFeaturePayload Builder)

### Added
- `/v3/v3-feature-payload-builder.js` — WS3 v0.2.0-c-r1 builder 본체 (신규)
  - `WS3_FeaturePayload.createEmpty()` 기반 13 top-level field 조립
  - `WS3_FeaturePayload.isValid(payload) === true` 통과 보장
  - 이중 환경 export: `global.WS3_FeaturePayload_Builder` + `module.exports`
- `/docs/ws3/WS3_v0_2_0_c_r1_BUILD_REPORT.md` — 완료 보고서 (신규)

### Adopted DP Policy
- **DP-1** ts 우선순위: `marketCtx.ts` > primary candle.ts > `null`. `Date.now()` 금지.
- **DP-2** canonical `tradeValue`만 외부 노출. `value/amount/quoteVolume` alias 금지. indicators 내부 통계 키(`currentTradeValueKrw` 등)는 v3-indicators.js 결과 그대로 보존 (U-1).
- **DP-3** 별도 파일 신규. `v3-feature-payload.js` 미수정 (build 함수 throw 유지).
- **DP-4** validator 현행 유지. builder가 `createEmpty` 기반으로 13 key 보장.
- **DP-5** `normalizeIdentity(identity, input, builderDebug)` helper. `'KRW-BTC'` → `quote='KRW'` / `base='BTC'` 분해. 분해 실패 시 throw 없이 createEmpty default + warning.
- **DP-6** `V3BuildMarketCtx` typedef. 안전 정규화 (throw 없이 fallback).
- **DP-7** `raw.builderDebug` 디버그 보조 구조 (builderVersion / warnings / primaryTimeframe / resolvedTsSource / candleCounts / identityInput).
- **U-2** `V3BuildCandlesInput` typedef. `{ m5, m15, h1, h4, d1 }` 객체 입력. 단일 배열 X.

### Indicator Snapshot Mapping
- `payload.momentum` ← `rsi` / `mfi` / `obv` / `ma`
- `payload.volume` ← `volume` / `volumeAcceleration` / `tradeValue` (indicators 내부 통계 키 그대로)
- `payload.structure` ← `candleShape` / `candleStructure` / `structure`
- `payload.indicators` ← `atr` / `snapshotValid` / `warnings` / `debug` / `indicatorVersion`

### Changed
- `/docs/ws3/WS3_CHANGELOG.md` (본 파일): `[v0.2.0-c-r1]` 엔트리 상단 추가
- `/docs/ws3/WS3_CURRENT_BASELINE.md`: 완료된 단계 표 + 보호 파일 목록 + 다음 단계 갱신

### Protected (수정 0건)
- `v3-feature-payload.js` (build 함수 throw 유지 — DP-3-A 정합)
- `v3-config.js` / `v3-bithumb-client.js` / `v3-candle-normalizer.js` / `v3-indicators.js`
- `index.html` / `manifest.json` / `service-worker.js`
- `docs/ws3/WS3_CODE_CONTRACT.md` (b-r2 박제본 그대로)

### 의도된 미구현 (이번 단계 제외)
- `buyPressure` 계산/라벨링 (createEmpty default `BUY_PRESSURE_UNKNOWN` 유지)
- `marketContext` 라벨링 (createEmpty default `UNKNOWN` 유지)
- `scoreBreakdown` / `grade` / `signalCycle` / `structureBucket` 최종 판정
- `strategyBias` / `entryPlan` / `exitPlan`
- `renderer` / `cardViewModel` / `UI`
- `externalConfluence` / `Telegram`
- `fetch` / `document` / `localStorage` / `KV` 직접 호출 0건
- `Date.now()` 사용 0건

### Verified
- `node --check v3/v3-feature-payload-builder.js` 통과
- smoke test (h1 60개 synthetic candle) 11항목 모두 통과:
  - `Object.keys(payload).length === 13`
  - `WS3_FeaturePayload.isValid(payload) === true`
  - 5 timeframe 모두 Array
  - `identity.quote` / `identity.exchange` 모두 string
  - `payload.ts === sampleCandles.h1[last].ts` (DP-1 우선순위 2 적용)
  - `payload.buyPressure.state === 'BUY_PRESSURE_UNKNOWN'`
- 안전성 검증: `build(null, null)` → isValid true + warnings `['INVALID_CANDLES_SHAPE', 'MISSING_MARKET', 'EMPTY_PRIMARY_CANDLES']`
- 금지 패턴 grep:
  - `Date.now(` 코드 침범 0건 (주석 3건만)
  - `fetch(` / `delete payload.` / `skipPlaceholders` / `omitNullSlots` / alias 노출 / DOM·localStorage 코드 침범 0건
- 보호 파일 `git diff` 빈 출력 = 0건

### 기준 commit
- branch: `claude/heuristic-cori-7865e7`
- 이전 baseline: WS3 v0.2.0-b-r2 (`04eac43`)
- 본 commit: (push 후 기록)

---

## [v0.2.0-b-r2] — 2026-05-14 (Code Contract Freeze)

### Added
- `/docs/ws3/WS3_CODE_CONTRACT.md` — v3-feature-payload.js 등 실제 코드 계약 박제 (단일 기준 문서)
  - top-level field 목록 박제 (13개 — identity/ts/candles/indicators/structure/volume/momentum/marketContext/buyPressure/coinMeta/newsContext/risk/raw)
  - createEmpty() 초기값 박제 (identity.quote='KRW' / identity.exchange='BITHUMB' / coinMeta=null / newsContext=null / marketContext.state='UNKNOWN' / buyPressure.state='BUY_PRESSURE_UNKNOWN' / risk={penalty,level,flags})
  - isValid() 검사 항목 목록 박제 (string / array / object / 미검사 항목 분리)
  - ts canonical (V3Candle: number / V3FeaturePayload: number\|null / createEmpty: null)
  - tradeValue canonical = "tradeValue" (close * volume 산출)
  - v3-bithumb-client.js 사실 박제: o.market 사용, base/quote/displayName 직접 사용 X
  - export 박제: `Object.freeze({createEmpty, build, isValid})` IIFE
  - DECISION_PENDING (DP-1 / DP-2 / DP-3) 박제 — 본 b-r2 에서 결정 X
- `/docs/ws3/WS3_v0_2_0_b_r2_CODE_CONTRACT_FREEZE_REPORT.md` — 완료 보고서

### Changed (정정만)
- `/docs/ws3/WS3_CHANGELOG.md` (본 파일):
  - 이전 오기 표현 (잘못된 슬롯 수 표기) → "top-level field"
  - v0.2.0-c 처리 (아래 엔트리 참고)
- `/docs/ws3/WS3_CURRENT_BASELINE.md`:
  - baseline 목록에 v0.2.0-b-r1 / v0.2.0-b-r2 추가
  - v0.2.0-c REJECTED / NOT APPLIED 명시
  - 다음 단계 순서 (v0.3.0~v0.8.0) 명시
  - WS3_CODE_CONTRACT.md 가 단일 기준임을 명시

### Protected (수정 0건)
- `.js` 파일 0건 수정 / 0건 신규
- 보호 파일 모두 무손상

### 기준 commit
- branch: `claude/heuristic-cori-7865e7`
- 이전 baseline: WS3 v0.2.0-b-r1 (`da00e62`)
- 본 commit: (push 후 기록)

### Verified
- b-r1 commit `da00e62` 로컬 + remote 존재 확인 ✅
- Gate 1 grep 결과 박제 완료
- 보호 파일 0건 변경
- 새 .js 파일 0건 생성

---

## [v0.2.0-c] — 1차 수정본 — REJECTED — repo 반영 보류

### Status
```text
REJECTED / NOT APPLIED
적용 보류 / commit 금지
```

### 사유
v3-feature-payload.js 코드 계약 위반 6건 (GPT 감사 결과):
1. top-level `ts` 필드 누락 (실제는 13개 field 중 하나)
2. `candles` 구조 다름 — builder 산출은 `{valid, data, count, totalAvailable, policy}`, 실제 계약은 `{m5, m15, h1, h4, d1}` 배열
3. `identity` 구조 다름 — builder 산출은 `{valid, base, exchange, symbol, timeframe, detectedAt}`, 실제 계약은 `{base, quote, market, exchange, displayName}` + default 값 명시
4. 자체 validator 가 기존 `WS3_FeaturePayload.isValid()` 와 다름
5. 이전 오기 표현 (잘못된 슬롯 수 표기 — 실제는 13개 top-level field)
6. b-r1 핫픽스가 v0.2.0-c 보다 먼저 와야 했음

### 처리
- repo 미반영 / rejected artifact
- 재작성은 별도 단계 `v0.2.0-c-r1` 로 분리
- 단일 기준: `WS3_CODE_CONTRACT.md` (b-r2 박제본)

---

## [v0.2.0-b-r1] — 2026-05-15

Baseline Consistency Hotfix. 기능 변경 없음. 문서/주석/fallback 후보키만 정리.

### Commit
- commit: `da00e62`
- branch: `claude/heuristic-cori-7865e7`

### Fixed
- 기준 백서 경로/존재 여부 명시 (`/docs/ws3/WOOS_Scanner_V3_개발백서_v0_3_3.md` 미박제 상태로 baseline에 표기)
- WS3 후속 단계 순서 정합성 정리 (signalCycle은 v0.5.0, UI는 v0.7.0, Telegram은 v0.8.0)
- 코드 버전과 제품 Phase 표현 혼용 제거
- V3Candle canonical을 `ts / tradeValue` 로 baseline에 통일 표기
- V3FeaturePayload top-level field count를 명확히 13개로 표기
- `v3-indicators.js` `readCandleField` 주석을 canonical 명시형으로 정리
- `v3-indicators.js` array index map에 canonical `ts` key 추가 (`ts: 0, timestamp: 0, ...`)
- `v3-indicators.js` array index map의 tradeValue를 canonical-first로 재정렬 (`tradeValue: 6, value: 6, ...`)
- `v3-indicators.js` `getTradeValue` 후보키 우선순위를 canonical-first로 변경 (`['tradeValue', 'value', ...]`)
- `strategyBias` enum/display 선박제와 v0.6.0 실제 로직 구현 단계를 baseline에 분리 명시
- `isValidPayload` 정책(ts/coinMeta/newsContext key 존재 검사 여부)을 v0.2.0-c 작업지시서에서 결정하도록 baseline에 메모

### Not Changed
- indicator 계산 로직 변경 없음
- 함수 추가/삭제 없음
- `v3-feature-payload.js` 코드 수정 없음 (validator 결정은 v0.2.0-c 작업지시서로 이관)
- `v3-config.js` / `v3-bithumb-client.js` / `v3-candle-normalizer.js` 수정 없음
- scoreBreakdown / grade / signalCycle / structureBucket 판정 / strategyBias / entryPlan / exitPlan 구현 없음
- buildFeaturePayload 본체 구현 없음
- Telegram / UI / externalConfluence 구현 없음
- 신규 파일 없음

### Verified
- `node --check v3/v3-indicators.js` 통과
- 보호 파일(`v3-config.js`, `v3-feature-payload.js`, `v3-bithumb-client.js`, `v3-candle-normalizer.js`, `index.html`, `manifest.json`, `service-worker.js`) 미수정

---

## [v0.2.0-b] — 2026-05-14

### Added
- `/v3/v3-indicators.js` — Indicator Function Skeleton (Config-Driven)
  - 32개 함수 (Config 유틸 12 / 이동평균 3 / RSI MFI OBV ATR 5 / 거래량 3 / 캔들구조 3 / 박스구조 5 / 통합 1)
  - `DEFAULT_INDICATOR_CONFIG` 박제
  - `mergeIndicatorConfig(config)` helper
  - 각 함수가 `configUsed` 반환
- `/docs/ws3/WS3_v0_2_0_b_INDICATOR_SKELETON_REPORT.md` — 완료 보고서

### Commit
- branch: `claude/heuristic-cori-7865e7`
- commit: `c98cbd88b048c3e51571030b696a6b590e2c0030`

### Design
- 함수 시그니처 `calculate*(candles, config = {})` 표준화
- MA/RSI/MFI/OBV/ATR/거래량/거래대금/캔들구조 기준값 = config override 가능
- 전통 캔들패턴명 (도지/망치형/장악형 등) 미구현
- V3에서 캔들패턴 = candleStructureFeatures 보조값
- structureBucket 최종 판정 X (WS3 v0.4.0에서)

---

## [v0.2.0-a] — (이전 baseline)

### Added
- `/v3/v3-bithumb-client.js`
- `/v3/v3-candle-normalizer.js`

---

## [v0.1.0] — (이전 baseline)

### Added
- `/v3/v3-config.js`
- `/v3/v3-feature-payload.js` (코드 계약 정의 — WS3_CODE_CONTRACT.md 박제 대상)
