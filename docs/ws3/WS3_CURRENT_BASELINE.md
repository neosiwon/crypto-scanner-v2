# WS3 Current Baseline

> 현재 GitHub 박제 기준 (최신).  
> 다음 단계 작업 전에 이 파일로 baseline 을 확인.

**최종 업데이트**: 2026-05-19  
**기능 단계 (current functional baseline)**: WS3 v0.31.0 Web-first Minimum Operator Mode + Limited Live Operation Enabled (Production Check State PASS / Worker version WS3_v0.31.0_web_first_minimum_operator_mode / v0.31.0-fix-1 maxMarkets50 deployed / 40-market preset scan PASS marketCount=40 / disabled send gate `LIMITED_LIVE_DISABLED` 정상 차단 / LIMITED LIVE / OPERATOR REVIEW Telegram 1회 발송 PASS — KRW-DOT upbit 5m score=29 P-C operatorReviewLevel=WATCH_REVIEW reasonChips=VOLUME_SURGE / kvWriteScope=LIMITED_LIVE_GUARD_ONLY / candidateStored=false / trackingStarted=false / duplicate 차단 PASS / 사용자 결정 = 운영 유지 / `WS3_LIMITED_LIVE_ENABLED='true'` 유지 / Cron 0건 / 자동 알람 0건 / candidate 저장 0건 / tracking 시작 0건 / 노출된 폐기 hash repo-wide 매치 0건 / raw Telegram response / raw exchange full response / Invoke Token / KV namespace ID 노출 0건)  
**이전 기능 baseline**: WS3 v0.30.0 Forced Candidate TEST_ONLY Telegram + Live Validation Success (`46b6d5d`)  
**운영 문서**: WS3 Workflow Template v0.1 박제 (`d8bebc2`, v0.3.0-docs)  
**branch**: `claude/heuristic-cori-7865e7`

---

## 완료된 단계

| 단계 | 파일 | commit | 상태 |
|---|---|---|---|
| WS3 v0.1.0 | `/v3/v3-config.js` | — | ✅ 박제 |
| WS3 v0.1.0 | `/v3/v3-feature-payload.js` | — | ✅ 박제 (코드 계약 정의) |
| WS3 v0.2.0-a | `/v3/v3-bithumb-client.js` | — | ✅ 박제 |
| WS3 v0.2.0-a | `/v3/v3-candle-normalizer.js` | — | ✅ 박제 |
| WS3 v0.2.0-b | `/v3/v3-indicators.js` | `c98cbd8` | ✅ 박제 |
| WS3 v0.2.0-b-r1 | baseline consistency (문서) | `da00e62` | ✅ 박제 |
| WS3 v0.2.0-b-r2 | Code Contract Freeze (문서) | `04eac43` | ✅ 박제 |
| WS3 v0.2.0-c-r1 | `/v3/v3-feature-payload-builder.js` | `51e510d` | ✅ 박제 |
| WS3 v0.3.0 | `/v3/v3-score-breakdown.js` | `b7e0ea3` | ✅ 박제 |
| WS3 v0.3.0-docs | `/docs/ws3/WS3_WORKFLOW_TEMPLATE.md` | `d8bebc2` | ✅ 박제 (운영 문서) |
| WS3 v0.4.0 | `/v3/v3-structure-bucket.js` | `9e94b4d` | ✅ 박제 |
| WS3 v0.5.0 | `/v3/v3-signal-cycle.js` | `59c8b78` | ✅ 박제 |
| WS3 v0.6.0 | `/v3/v3-strategy-plan.js` | `8ebba40` | ✅ 박제 |
| WS3 v0.7.0 | `/v3/v3-card-view-model.js` | `7e2ef36` | ✅ 박제 |
| WS3 v0.8.0 | `/v3/v3-operation-packet.js` | `2fb95cf` | ✅ 박제 |
| WS3 v0.9.0 | `/v3/v3-active-cycle.js` | `00831af` | ✅ 박제 |
| WS3 v0.10.0 | `/v3/v3-evaluation-outcome.js` | `887123a` | ✅ 박제 |
| WS3 v0.11.0 | `/v3/v3-evaluation-observation-adapter.js` + `/v3/v3-external-confluence.js` | `4c94875` | ✅ 박제 |
| WS3 v0.12.0 | `/v3/v3-transport-plan.js` + `/v3/v3-renderer-binding.js` | `8fd0551` | ✅ 박제 |
| WS3 v0.13.0 | `/v3/v3-transport-execution-adapter.js` | `5d05836` | ✅ 박제 |
| WS3 v0.14.0 | `/v3/v3-secure-transport-executor-contract.js` | `644c525` | ✅ 박제 |
| WS3 v0.15.0 | `/v3/v3-transport-executor-harness.js` | `4a2baa6` | ✅ 박제 |
| WS3 v0.16.0 | `/v3/v3-transport-executor-interface-adapter.js` | `9eaffe5` | ✅ 박제 |
| WS3 v0.17.0 | `/v3/v3-transport-executor-sandbox-runner.js` | `0ddbe85` | ✅ 박제 |
| WS3 v0.18.0 | `/v3/v3-secure-binding-gateway-contract.js` | `32cbc1d` | ✅ 박제 |
| WS3 v0.19.0 | `/v3/v3-live-execution-preflight-gate.js` | `7f2de04` | ✅ 박제 |
| **WS3 v0.20.0** | **`/v3/v3-secure-runtime-state-adapter.js`** | **(push 후 기록)** | **✅ 박제 (이번 단계, CANARY_PREP_ONLY secure runtime state adapter — Gate 2 동시 작성, commit 분리)** |
| **WS3 v0.21.0** | **`/v3/v3-telegram-canary-sender.js`** | **(push 후 기록)** | **✅ 박제 (이번 단계, Telegram canary sender — 첫 LIVE side-effect 모듈, Gate 2 동시 작성, commit 분리)** |
| **WS3 v0.22.0** | **`/workers/ws3-telegram-canary-worker.js` + `/web/ws3-canary-console.html`** | **`69bf5b0`** | **✅ 박제 (Canary Web MVP Pack, 별도 canary worker + local web console, 실제 Telegram 호출은 Gate 5 전까지 0건)** |
| **WS3 v0.22.1** | **`/workers/ws3-telegram-canary-worker.js` + runtime hotfix report** | **`d8b1108`** | **✅ 박제 (Cloudflare runtime hotfix + first live Telegram canary success, cleanup 완료)** |
| **WS3 v0.23.0** | **`/workers/ws3-canary-state-kv-adapter.js` + canary worker (v0.23) + `.gitignore` + `wrangler-canary.example.toml`** | **`5b6c488`** | **✅ 박제 (Persistent Canary Safety Guard — canary 전용 KV write exception, persistent alreadySent/cleanupRequired/circuit/invokeFail counter, /state + /cleanup-confirm endpoint, mock smoke 16/16)** |
| **WS3 v0.24.0** | **`/docs/ws3/WS3_v0_24_0_PERSISTENT_GUARD_STAGING_VALIDATION_REPORT.md`** | **`cd002dc`** | **✅ 박제 (Persistent Guard Staging Validation — 운영 검증 Gate, 코드 변경 0건. 실 Cloudflare KV 에서 1회 한정 Telegram canary 발송 → alreadySent/cleanupRequired KV 저장 + 2차 ALREADY_SENT_PERSISTENT 차단 + /cleanup-confirm + alreadySent=true 유지 + CANARY_ENABLED=false 복귀 9건 검증 완료)** |
| **WS3 v0.25.0** | **`/workers/ws3-telegram-canary-worker.js` + `/workers/ws3-canary-state-kv-adapter.js` + `/docs/ws3/WS3_v0_25_0_OPERATOR_RESET_STATE_LIFECYCLE_REPORT.md`** | **`c3c5ace`** | **✅ 박제 (Operator Reset / State Lifecycle — POST /operator-reset 엔드포인트 7중 조건 + circuit 차단 + 60s cooldown, /state 8→10 fields + currentPhase 9-phase 분류, KV operatorReset 신규 key, mock smoke 19/19. 실 Cloudflare staging deploy + /operator-reset 1회 호출 성공 — alreadySent true→false / resetCount 0→1 / currentPhase OPERATOR_RESETTABLE→RESET_CONFIRMED / Telegram 발송 0건 검증 완료)** |
| **WS3 v0.25.0 closure** | **`/docs/ws3/WS3_v0_25_0_OPERATOR_RESET_STATE_LIFECYCLE_REPORT.md` §18 추가 + `/docs/ws3/WS3_CHANGELOG.md` + `/docs/ws3/WS3_CURRENT_BASELINE.md`** | **`f2d7ddd`** | **✅ 박제 (Operator Reset Staging Success Closure — 코드 변경 0건, 문서 3개만, Cloudflare 변경 0건, /operator-reset 재호출 0건, Telegram 발송 0건)** |
| **WS3 v0.26.0** | **`/web/ws3-canary-console.html` (보강) + `/web/ws3-canary-console/index.html` (신규 mirror) + `/docs/ws3/WS3_v0_26_0_PRODUCTION_WEB_CONSOLE_HOSTING_REPORT.md`** | **`55a00d8`** | **✅ 박제 (Production Web Console Hosting — 5-section UI 구조 + Check State/Cleanup Confirm/Operator Reset 추가 + Danger Zone 시각 분리, resetCount UI 비노출, byte-for-byte mirror production entrypoint, Cloudflare Access 필수 + localhost 2-phase allowlist 정책 박제, worker logic 수정 0건 / 실 Cloudflare 변경 0건 / 실 호출 0건 / 실 KV write 0건)** |
| **WS3 v0.26.1** | **`/web/ws3-canary-console.html` (보강) + `/web/ws3-canary-console/index.html` (mirror) + `/docs/ws3/WS3_v0_26_1_DEV_PREVIEW_INVITE_GATE_REPORT.md`** | **`634093d`** | **✅ 박제 (Dev Preview Lightweight Invite Gate — Cloudflare Access 필수 정책을 Dev Preview 단계용으로 amendment, client-side invite gate prepend + console UI `<main hidden>` wrap, SHA-256 placeholder commit + constant-time compare + 5회·60초 memory throttle, storage 0건, 두 파일 byte-for-byte mirror 유지, 실 invite code 원문/실 hash repo commit 0건, worker logic 수정 0건 / 실 Cloudflare 변경 0건 / 실 호출 0건 / 실 KV write 0건)** |
| **WS3 v0.26.1 Pages Deploy** | **`/docs/ws3/WS3_v0_26_1_DEV_PREVIEW_INVITE_GATE_REPORT.md` §16 추가 + `/docs/ws3/WS3_CHANGELOG.md` + `/docs/ws3/WS3_CURRENT_BASELINE.md`** | **`81964bf`** | **✅ 박제 (Dev Preview Pages Deploy Success Closure — 코드 변경 0건 / tracked source 변경 0건 / 문서 3개만. Cloudflare Pages `ws3-canary-console.pages.dev` 배포 / Worker allowlist = Pages origin only / localhost 제거 / lightweight invite gate active / final production Check State PASS / Cloudflare Access deferred / Send Canary 0건 / Telegram 0건 / KV write 0건 / raw invite code & SHA-256 hash repo 박제 0건)** |
| **WS3 v0.27.0** | **`/workers/ws3-telegram-canary-worker.js` (보강) + `/web/ws3-canary-console.html` (보강) + `/web/ws3-canary-console/index.html` (mirror) + `/docs/ws3/WS3_v0_27_0_ACTUAL_COIN_LIVE_PREFLIGHT_REPORT.md`** | **`d3e80b4`** | **✅ 박제 (Actual Coin Live Preflight — POST /live-preflight 신규 endpoint, 실 거래소 (upbit/bithumb/binance) 공개 시세 read-only fetch + 정규화 preview, 3중 인증 (Origin + Invoke Token + manualTrigger), exchange/timeframe allowlist + market 정규식 sanitize + limit ≤ 60, 5s timeout, mock smoke 16/16. 실 Telegram 0건 / 실 KV write 0건 / 실 거래소 API 호출 0건 / Cloudflare deploy 0건. v0.28+ 후보: dry-run candidate / security hardening before live coin)** |
| **WS3 v0.27.0 Live Validation** | **`/docs/ws3/WS3_v0_27_0_ACTUAL_COIN_LIVE_PREFLIGHT_REPORT.md` §20 추가 + `/docs/ws3/WS3_CHANGELOG.md` + `/docs/ws3/WS3_CURRENT_BASELINE.md`** | **`488cb08`** | **✅ 박제 (Live Validation Success Closure — 코드 변경 0건 / tracked source 변경 0건 / 문서 3개만. Cloudflare Worker v0.27 redeploy + Pages production deploy 완료, production console Check State PASS (v0.27 version 반영 확인), `/live-preflight` 1회 실 호출 PASS — upbit / KRW-BTC / 5m / limit=30 → LIVE_PREFLIGHT_OK / candleCount=30 / mode=LIVE_PREFLIGHT_ONLY / Telegram 0건 / KV write 0건 / candidate 저장 0건 / tracking 시작 0건. 노출된 폐기 hash repo-wide 매치 0건, raw exchange full response / Invoke Token / KV namespace ID 노출 0건)** |
| **WS3 v0.28.0** | **`/workers/ws3-telegram-canary-worker.js` (보강) + `/web/ws3-canary-console.html` (보강) + `/web/ws3-canary-console/index.html` (mirror) + `/docs/ws3/WS3_v0_28_0_CANDIDATE_DRY_RUN_REPORT.md`** | **`cd69760`** | **✅ 박제 (Actual Coin Candidate Dry-run — POST /candidate-dry-run 신규 endpoint, v0.27 fetch/normalize helper 재사용, candle structure 13 + volume 4 + momentum 4 features 계산 + dry-run score 0..100 clamp + P-S/P-A/P-B/P-C grade 분류 + reason chips max 8, exchange/timeframe allowlist + market 정규식 sanitize + limit ≤ 120, mock smoke 21/21. 실 Telegram 0건 / 실 KV write 0건 / 실 candidate 저장 0건 / 실 tracking 시작 0건 / 실 거래소 API 호출 0건 / Cloudflare deploy 0건. 점수·등급은 dry-run preview 일뿐 실 알람·매수 조건 아님)** |
| **WS3 v0.28.0 Live Validation** | **`/docs/ws3/WS3_v0_28_0_CANDIDATE_DRY_RUN_REPORT.md` §19 추가 + `/docs/ws3/WS3_CHANGELOG.md` + `/docs/ws3/WS3_CURRENT_BASELINE.md`** | **`d81b723`** | **✅ 박제 (Live Validation Success Closure — 코드 변경 0건 / tracked source 변경 0건 / 문서 3개만. Cloudflare Worker v0.28 redeploy + Pages production deploy 완료, production console Check State PASS (v0.28 version 반영 확인), `/candidate-dry-run` 1회 실 호출 PASS — upbit / KRW-BTC / 5m / limit=60 → CANDIDATE_DRY_RUN_OK / candleCount=60 / score=0 / grade=P-C / reasonChips=LOW_VOLUME / isCandidate=false / mode=CANDIDATE_DRY_RUN_ONLY / Telegram 0건 / KV write 0건 / candidate 저장 0건 / tracking 시작 0건. 후보 아님 판정 = dry-run 계산 정상 작동. 노출된 폐기 hash repo-wide 매치 0건, raw exchange full response / Invoke Token / KV namespace ID 노출 0건)** |
| **WS3 v0.29.0** | **`/workers/ws3-telegram-canary-worker.js` (보강) + `/web/ws3-canary-console.html` (보강) + `/web/ws3-canary-console/index.html` (mirror) + `/docs/ws3/WS3_v0_29_0_INTEGRATED_LIMITED_LIVE_PIPELINE_REPORT.md`** | **`f923b86`** | **✅ 박제 (Integrated Limited Live Pipeline Pack — POST /multi-candidate-dry-run 신규 (병렬 멀티마켓 dry-run, v0.27/v0.28 helper 재사용, score desc 정렬, max 10 markets, limit ≤ 120) + POST /send-candidate-test 신규 (4중 인증 + confirmPhrase + selectedCandidate source 검증 + KV duplicate guard 60s window + fixed safety preamble TEST_ONLY Telegram 1건 + KV scope = `CANDIDATE_TEST_GUARD_ONLY` 단일 key 만) + UI Sections 8/9/10 (Memory-only history max 5 + Danger Zone + Limited Live Mode DISABLED 상태 + 활성화 조건 5개 박제) + 신규 env `WS3_CANDIDATE_TEST_ENABLED` (default 'false') + safe code 16종 신규, mock smoke 30/30 PASS. 실 Telegram 0건 / 실 KV write 0건 / 실 candidate 저장 0건 / 실 tracking 시작 0건 / 실 거래소 API 호출 0건 / Cloudflare deploy 0건. 무제한 자동 알람 아님 — 선택 후보 1건 수동 TEST_ONLY 발송 endpoint 만 / Limited Live Mode 활성화 0건 / Cron 0건)** |
| **WS3 v0.29.0 Live Validation** | **`/docs/ws3/WS3_v0_29_0_INTEGRATED_LIMITED_LIVE_PIPELINE_REPORT.md` §18 추가 + `/docs/ws3/WS3_CHANGELOG.md` + `/docs/ws3/WS3_CURRENT_BASELINE.md`** | **`afa7284`** | **✅ 박제 (Multi-market LOW_SIGNAL Validation Success Closure — 코드 변경 0건 / tracked source 변경 0건 / 문서 3개만. Cloudflare Worker v0.29 redeploy + Pages production deploy 완료, production console Check State PASS (v0.29 version 반영 확인), `/multi-candidate-dry-run` 1회 실 호출 PASS — upbit / 10 KRW markets / 5m / limit=60 → MULTI_CANDIDATE_DRY_RUN_OK / marketCount=10 / candidateCount=0 / LOW_SIGNAL_NORMAL 정상 판정 / topMarket=KRW-NEAR score=24 P-C reasonChips=HIGH_CLOSE_POSITION / 모든 10 markets P-C / KRW-AVAX volRatio=15.102 + UPPER_WICK_RISK -15 감점 → score=10 P-C (false positive 방지 로직 정상 작동 검증) / Candidate TEST_ONLY Telegram skipped (Case 1) / WS3_CANDIDATE_TEST_ENABLED 활성화 0건 (Step K/L/M 생략) / Limited Live Mode DISABLED 유지 / Telegram 0건 / KV write 0건 / candidate 저장 0건 / tracking 시작 0건. 노출된 폐기 hash repo-wide 매치 0건, raw exchange full response / raw Telegram response / Invoke Token / KV namespace ID 노출 0건)** |
| **WS3 v0.30.0** | **`/workers/ws3-telegram-canary-worker.js` (보강) + `/web/ws3-canary-console.html` (보강) + `/web/ws3-canary-console/index.html` (mirror) + `/docs/ws3/WS3_v0_30_0_FORCED_CANDIDATE_TEST_TELEGRAM_REPORT.md`** | **`3c36d63`** | **✅ 박제 (Forced Candidate TEST_ONLY Telegram Validation Pack — `/send-candidate-test` 확장 (forceTestCandidate=true 모드 신규, 별도 confirmPhrase `SEND_WS3_FORCED_TEST_CANDIDATE` + `forcedTestReason` 정규식 + 128자 + FORCED preamble 강제 + 매수 추천 / 수익 보장 / LIVE BUY / 진입 추천 문구 0건) + UI Section 9 forced 모드 체크박스 + Forced Test Reason 입력 + mode/messageType 결과 panel 표시 + mode 토글 시 confirmPhrase/reason 즉시 클리어 + KV duplicate guard audit (`messageType` 필드로 forced/normal 구분, key 동일 / window 60s 공통) + 신규 safe code 6종 (FORCED_CANDIDATE_TEST_SENT 200 / DISABLED 503 / CONFIRM_PHRASE_REQUIRED 403 / INVALID_PAYLOAD 400 / ALREADY_SENT 429 / TELEGRAM_ERROR 502) + namespace separation (forced↔normal phrase 교차 사용 차단), mock smoke 27/27 PASS. 실 Telegram 0건 / 실 KV write 0건 / 실 candidate 저장 0건 / 실 tracking 시작 0건 / 실 거래소 API 호출 0건 / Cloudflare deploy 0건. 무제한 자동 알람 아님 — forced TEST_ONLY 경로 검증용 1회 발송 endpoint 만 / Limited Live Mode DISABLED 유지)** |
| **WS3 v0.30.0 Live Validation** | **`/docs/ws3/WS3_v0_30_0_FORCED_CANDIDATE_TEST_TELEGRAM_REPORT.md` §14 추가 + `/docs/ws3/WS3_CHANGELOG.md` + `/docs/ws3/WS3_CURRENT_BASELINE.md`** | **`46b6d5d`** | **✅ 박제 (Forced Candidate TEST_ONLY Telegram Live Validation Success Closure — 코드 변경 0건 / tracked source 변경 0건 / 문서 3개만. Cloudflare Worker v0.30 redeploy 3회 (Step B 초기 + Step K enable + Step M disable) + Pages production deploy 완료, production console Check State PASS (v0.30 version 반영 확인), Multi-market Dry-run 1회 PASS (10 markets LOW_SIGNAL), Step J 명시 승인 후 Step K `WS3_CANDIDATE_TEST_ENABLED='true'` 임시 활성화, Step L FORCED Candidate TEST_ONLY Telegram 1회 PASS — KRW-NEAR / score=19 P-C reasonChips=LOW_VOLUME,HIGH_CLOSE_POSITION / forcedTestReason='path validation after LOW_SIGNAL multi-market dry-run' → FORCED_CANDIDATE_TEST_SENT 200 / mode=FORCED_TEST_ONLY / messageType=FORCED_CANDIDATE_TEST_ONLY / fixedMessageUsed=true / telegramSent=true / kvWritten=true / kvWriteScope=CANDIDATE_TEST_GUARD_ONLY / candidateStored=false / trackingStarted=false / Telegram 수신 정상 (7+4 필수 라벨 확인) / 매수·수익·LIVE 금지 문구 0건, Step M `WS3_CANDIDATE_TEST_ENABLED='false'` 복귀 완료 (production binding display 풀값 노출 확인) / FORCED 추가 발송 차단 / Limited Live Mode DISABLED 유지. Telegram API 호출 1건 (Step L 만) / KV write 1건 (Step L duplicate guard 만, audit messageType 분리) / 추가 호출 0건. 노출된 폐기 hash repo-wide 매치 0건, raw Telegram response / raw exchange full response / Invoke Token / KV namespace ID 노출 0건)** |
| **WS3 v0.31.0** | **`/workers/ws3-telegram-canary-worker.js` (보강) + `/web/ws3-canary-console.html` (보강) + `/web/ws3-canary-console/index.html` (mirror) + `/docs/ws3/WS3_v0_31_0_WEB_FIRST_MINIMUM_OPERATOR_MODE_REPORT.md`** | **(push 후 기록)** | **✅ 박제 (Web-first Minimum Operator Mode Pack — POST /send-limited-live-alert 신규 endpoint (7-layer 인증 + 별도 env WS3_LIMITED_LIVE_ENABLED + confirmPhrase SEND_WS3_LIMITED_LIVE_REVIEW + selectedCandidate 자격 검증 `isCandidate || (operatorReview && allowOperatorReviewSend)` + per-(market,timeframe) 60s KV guard `LIMITED_LIVE_GUARD_ONLY` + fixed LIMITED LIVE / OPERATOR REVIEW preamble + 자동 매수·매도 추천 / 진입 추천 / 수익 보장 / 확정 신호 / LIVE BUY 문구 0건) + Multi-candidate pipeline 확장 (`operatorReview` / `operatorReviewLevel` HOT_REVIEW/WATCH_REVIEW/LOW_SIGNAL / `operatorReviewReason` 추가, 정렬 priority 변경, `operatorReviewCounts` 응답 신규) + Web Console Section 8 Load 40-market Upbit preset 버튼 + 카드 색상 배지 + [OP-REVIEW] 라벨 + Section 11 신규 Minimum Operator Mode UI (selected card / allowOR / confirm / Send / 결과 panel 9 fields) + Section 8↔11 selector 동기화 + 신규 safe code 6종 (LIMITED_LIVE_REVIEW_SENT 200 / DISABLED 503 / CONFIRM_PHRASE_REQUIRED 403 / INVALID_PAYLOAD 400 / ALREADY_SENT 429 / TELEGRAM_ERROR 502), mock smoke 17/17 PASS. 실 Telegram 0건 / 실 KV write 0건 / 실 candidate 저장 0건 / 실 tracking 시작 0건 / 실 거래소 API 호출 0건 / Cloudflare deploy 0건. 무제한 자동 알람 아님 — operator 카드 선택 + 클릭만 발송 / Limited Live Mode env-gated)** |
| **WS3 v0.31.0 Minimum Operator Mode Live Validation** | **`/docs/ws3/WS3_v0_31_0_WEB_FIRST_MINIMUM_OPERATOR_MODE_REPORT.md` §14 추가 + `/docs/ws3/WS3_CHANGELOG.md` + `/docs/ws3/WS3_CURRENT_BASELINE.md`** | **(push 후 기록)** | **✅ 박제 (Web-first Minimum Operator Mode Live Validation Success Closure — 코드 변경 0건 / tracked source 변경 0건 / 문서 3개만. Cloudflare Worker v0.31 redeploy 3회 (Step B 초기 + v0.31.0-fix-1 maxMarkets50 + Step K LIMITED_LIVE_ENABLED=true) + Pages production deploy 2회 (Step F + fix-1) 완료, production console Check State PASS (v0.31 version 반영 확인), 40-market preset scan PASS — upbit / 40 KRW markets / 5m → MULTI_CANDIDATE_PARTIAL_OK / marketCount=40 / okCount=19 / failCount=21 / candidateCount=0 (failCount=21은 프리셋 내 미상장/미지원 심볼 가능성 자연검증 후속), Step J disabled 차단 PASS — `WS3_LIMITED_LIVE_ENABLED=false` 상태 /send-limited-live-alert → LIMITED_LIVE_DISABLED 503 정상 (UI safety fields 표시 미흡은 후속 UI 개선 항목), Step K `WS3_LIMITED_LIVE_ENABLED='true'` 임시→유지 활성화 + Worker redeploy, Step L LIMITED LIVE / OPERATOR REVIEW Telegram 1회 PASS — KRW-DOT upbit 5m / score=29 P-C / operatorReviewLevel=WATCH_REVIEW / isCandidate=false / reasonChips=VOLUME_SURGE / allowOperatorReviewSend=true → LIMITED_LIVE_REVIEW_SENT 200 / mode=LIMITED_LIVE_OPERATOR_REVIEW / messageType=LIMITED_LIVE_OPERATOR_REVIEW / fixedMessageUsed=true / telegramSent=true / kvWritten=true / kvWriteScope=LIMITED_LIVE_GUARD_ONLY / candidateStored=false / trackingStarted=false / Telegram 수신 정상 (LIMITED LIVE / OPERATOR REVIEW / 자동 매수·매도 추천 아님 / 운영자 검토 필요 / Manual operator review only / This is not a live trading alert 필수 라벨 확인) / 매수·수익·LIVE 금지 문구 0건, Step M duplicate 차단 PASS — 같은 selected card 2차 클릭 Telegram 추가 수신 0건 / per-(market,timeframe) 60s guard 정상 작동, Step N 사용자 결정 = 운영 유지 / `WS3_LIMITED_LIVE_ENABLED='true'` 유지 / false 복귀 redeploy 0건 / Limited Live는 수동 운영자 검토 전용 / 자동 알람 0건 / Cron 0건 / candidate 저장 0건 / tracking 시작 0건. Telegram API 호출 1건 (Step L 만) / KV write 1건 (Step L LIMITED_LIVE_GUARD_ONLY 만) / 추가 호출 0건. 노출된 폐기 hash repo-wide 매치 0건, raw Telegram response / raw exchange full response / Invoke Token / KV namespace ID 노출 0건)** |

## REJECTED — repo 반영 보류

| 단계 | 사유 |
|---|---|
| WS3 v0.2.0-c (1차 수정본) | REJECTED / NOT APPLIED — v3-feature-payload.js 코드 계약 위반 6건. v0.2.0-c-r1 로 재작성 완료. |

---

## 기준 백서

```text
/docs/ws3/WOOS_Scanner_V3_개발백서_v0_3_3.md
```

> ⚠️ **백서 repo 박제 상태**: 이전 감사 시점 기준, 위 경로의 백서 파일은 실제 repo 에 박제되어 있지 않다.  
> 백서 본문은 별도 위치 (Claude Web / 사용자 로컬) 에서 관리되고 있으며, repo 박제는 추후 별도 단계로 진행될 예정.  
> 본 baseline 의 모든 "기준 백서" 참조는 해당 미박제 문서를 가리킨다.  
> 코드 계약 충돌 시에는 **`WS3_CODE_CONTRACT.md` 가 우선** (백서 박제 여부와 무관).

## 단일 코드 계약 기준 (필수)

```text
/docs/ws3/WS3_CODE_CONTRACT.md   ← v0.2.0-b-r2 박제본 (이번 c-r1 단계에서도 미수정)
```

**충돌 시 우선순위**:
```text
WS3_CODE_CONTRACT.md  >  백서  >  기타 문서
```

---

## 운영 문서 (워크플로우 표준)

```text
/docs/ws3/WS3_WORKFLOW_TEMPLATE.md   ← v0.1 박제본 (v0.3.0-docs 단계, 2026-05-16)
```

**용도**:
- GPT 작업지시서 초안 → Claude Web 피드백 → GPT 최종 전문 → Claude Code 실행 흐름의 단일 표준
- 14단계 흐름 / 4 Gate (Gate 1 사전조사 / Gate 2 코드 작성 / Gate 3 commit / Gate 4 push) / PR-main merge 별도 승인 (Gate 5/6)
- commit 메시지 한 줄 원칙
- DP prefix 명명 규칙 (DP-1~7 / DP-S* / DP-STR* / DP-CYC* / DP-STG*)

**역할 분담** (§0.1):
- **GPT** = 작업지시서 초안 전문 작성 + 최종 전문 작성 + commit 메시지 작성
- **Claude Web** = 작업지시서 피드백만
- **Claude Code** = repo 실제 코드 작성 / 검증 / diff / commit / push

**변경 정책** (§15): 즉흥 수정 금지. 변경 필요 시 별도 단계 (v0.2 등) 로 박제.

---

## V3 핵심 전제

```text
- V3 는 기존 WOOS 확장이 아니라 독립 정밀 스캐너
- 기존 active/completed/history/관심/정밀/표준 의미 이식 금지
- 기존 UI 톤과 raw → state → ViewModel → render 철학만 참고
- Bithumb-only v0
- v3-feature-payload.js 코드 계약 우선
- 백서와 코드 계약이 충돌하면 WS3_CODE_CONTRACT.md 우선
- 외부 신호는 featurePayload 에 넣지 않고 externalConfluence 로 분리
- 외부 신호는 점수/등급 영향 X
- 지표/라벨링 기준값은 항상 config override 가능
```

---

## v3FeaturePayload 코드 계약 요약 (WS3_CODE_CONTRACT.md 발췌)

### top-level field (13개)

```text
1.  identity         (object, isValid 검사)
2.  ts               (number | null, isValid 미검사)
3.  candles          (object, m5/m15/h1/h4/d1 배열 — isValid 검사)
4.  indicators       (object, isValid 검사)
5.  structure        (object, isValid 검사)
6.  volume           (object, isValid 검사)
7.  momentum         (object, isValid 검사)
8.  marketContext    (object, isValid 검사, default {state:'UNKNOWN'})
9.  buyPressure      (object, isValid 검사, default {state:'BUY_PRESSURE_UNKNOWN'})
10. coinMeta         (null default, isValid 미검사)
11. newsContext      (null default, isValid 미검사)
12. risk             (object, isValid 검사 — flags[] / level string 포함, default {penalty:null,level:'UNKNOWN',flags:[]})
13. raw              (object, isValid 검사)
```

### identity

```text
{
  base:        null         (default, isValid 미검사)
  quote:       'KRW'        (default, isValid string 검사)
  market:      null         (default, isValid 미검사)
  exchange:    'BITHUMB'    (default, isValid string 검사)
  displayName: null         (default, isValid 미검사)
}
```

### candles

```text
{ m5: [], m15: [], h1: [], h4: [], d1: [] }
모두 배열 검사
```

### export

```text
global.WS3_FeaturePayload = Object.freeze({ createEmpty, build, isValid })
IIFE browser-global 방식
build 함수는 throw 상태 유지 (c-r1 DP-3-A 결정 — builder는 별도 파일).
```

자세한 내용은 `WS3_CODE_CONTRACT.md` 참고.

---

## v3-feature-payload-builder.js 요약 (c-r1 신규)

### 입력 / 출력

```text
입력:
  - V3BuildCandlesInput  { m5, m15, h1, h4, d1 } 객체 (단일 배열 X)
  - V3BuildMarketCtx     { market, exchange?, base?, quote?, displayName?,
                           ts?, timeframe?, coinMeta?, newsContext?,
                           riskOverride?, indicatorConfig? }
출력:
  - V3FeaturePayload (13 top-level field, isValid 통과)
  - 실패 시 throw 없이 safe payload + raw.builderDebug.warnings 기록
```

### 적용 정책 (DP)

```text
DP-1 ts:          marketCtx.ts > primary candle.ts > null  (Date.now 금지)
DP-2 tradeValue:  canonical 'tradeValue' 만 외부 노출 (alias 금지)
DP-3 배치:        별도 파일 신규 (v3-feature-payload.js build 함수 throw 유지)
DP-4 validator:   현행 유지 (builder가 createEmpty 기반 시작)
DP-5 identity:    normalizeIdentity helper ('KRW-BTC' → quote/base 분해)
DP-6 marketCtx:   V3BuildMarketCtx typedef + 안전 정규화
DP-7 raw:         raw.builderDebug 디버그 보조 구조
U-2  candles:     V3BuildCandlesInput typedef (5 timeframe 객체)
```

### indicator snapshot 분리 매핑

```text
WS3Indicators.buildIndicatorSnapshot() 반환:
  { valid, indicators, warnings, debug }

매핑:
  payload.momentum   ← rsi / mfi / obv / ma
  payload.volume     ← volume / volumeAcceleration / tradeValue
  payload.structure  ← candleShape / candleStructure / structure
  payload.indicators ← atr / snapshotValid / warnings / debug / indicatorVersion
```

### export

```text
global.WS3_FeaturePayload_Builder = Object.freeze({
  BUILDER_VERSION, DEFAULT_PRIMARY_TIMEFRAME, TIMEFRAMES,
  build, normalizeIdentity, normalizeCandlesInput, resolveTs, mapIndicatorSnapshot
})

이중 환경: global + module.exports (v3-indicators.js 와 동일 패턴)
```

자세한 내용은 `WS3_v0_2_0_c_r1_BUILD_REPORT.md` 참고.

---

## 보호 파일 (수정 금지)

```text
index.html
manifest.json
service-worker.js
worker.js
wrangler.toml

/v3/v3-config.js
/v3/v3-feature-payload.js                   ← 핵심 보호 (코드 계약). build 함수 throw 유지.
/v3/v3-bithumb-client.js                    ← market 문자열만 fetch 인자로 사용
/v3/v3-candle-normalizer.js                 ← tradeValue = close * volume 산출
/v3/v3-indicators.js                        ← v0.2.0-b 박제본
/v3/v3-feature-payload-builder.js           ← v0.2.0-c-r1 박제본
/v3/v3-score-breakdown.js                   ← v0.3.0 박제본
/v3/v3-structure-bucket.js                  ← v0.4.0 박제본
/v3/v3-signal-cycle.js                      ← v0.5.0 박제본
/v3/v3-strategy-plan.js                     ← v0.6.0 박제본
/v3/v3-card-view-model.js                   ← v0.7.0 박제본
/v3/v3-operation-packet.js                  ← v0.8.0 박제본
/v3/v3-active-cycle.js                      ← v0.9.0 박제본
/v3/v3-evaluation-outcome.js                ← v0.10.0 박제본
/v3/v3-evaluation-observation-adapter.js    ← v0.11.0 박제본 (입력 adapter)
/v3/v3-external-confluence.js               ← v0.11.0 박제본 (보조 context)
/v3/v3-transport-plan.js                    ← v0.12.0 박제본 (출력 dry-run plan)
/v3/v3-renderer-binding.js                  ← v0.12.0 박제본 (UI binding)
/v3/v3-transport-execution-adapter.js       ← v0.13.0 박제본 (dry-run safe envelope)
/v3/v3-secure-transport-executor-contract.js ← v0.14.0 박제본 (CONTRACT_ONLY secure executor contract)
/v3/v3-transport-executor-harness.js        ← v0.15.0 박제본 (DRY_RUN_HARNESS transport executor harness)
/v3/v3-transport-executor-interface-adapter.js ← v0.16.0 박제본 (INTERFACE_ONLY transport executor interface adapter)
/v3/v3-transport-executor-sandbox-runner.js ← v0.17.0 박제본 (SANDBOX_ONLY transport executor sandbox runner)
/v3/v3-secure-binding-gateway-contract.js   ← v0.18.0 박제본 (CONTRACT_ONLY secure binding gateway contract)
/v3/v3-live-execution-preflight-gate.js     ← v0.19.0 박제본 (PREFLIGHT_ONLY LIVE execution preflight gate)
/v3/v3-secure-runtime-state-adapter.js      ← v0.20.0 박제본 (이번 단계 신규, CANARY_PREP_ONLY secure runtime state adapter)
/v3/v3-telegram-canary-sender.js            ← v0.21.0 박제본 (이번 단계 신규, Telegram canary sender — Telegram 1 target 첫 LIVE side-effect 모듈)
/v3/v3-index.html                           (생성도 X)
```

> 다음 단계 (v0.15.x / v0.16.x — 실제 transport executor / renderer / persistence) 진입 후 builder/score/structure/cycle/plan/viewmodel/operationPacket/activeCycle/evaluationOutcome/observationAdapter/externalConfluence/transportPlan/rendererBinding/transportExecutionAdapter/secureTransportExecutorContract/transportExecutorHarness 인자 / 매핑 정책 갱신이 필요해지면 별도 r1.x 단계로 분리하여 별도 승인 후에만 수정.

---

## 모듈 의존성

```text
v3-bithumb-client.js  (o.market 문자열 fetch — proxy worker 경유)
  ↓ (raw candles)
v3-candle-normalizer.js  (tradeValue = close * volume, canonical {ts,open,high,low,close,volume,tradeValue})
  ↓ (normalized candles, timeframe별 배열)
v3-indicators.js  (v0.2.0-b 박제 — buildIndicatorSnapshot)
  ↓ (indicator snapshot)
v3-feature-payload-builder.js  (v0.2.0-c-r1 박제 — V3FeaturePayload 13 top-level field 조립)
  ↓ (V3FeaturePayload, isValid 통과)
v3-score-breakdown.js  (v0.3.0 박제 — 5 component + riskPenalty → totalScore)
  ↓ (standalone scoreBreakdown 객체, payload mutate 0건)
v3-structure-bucket.js  (v0.4.0 박제 — 13 structureBucket + confidence 0~100)
  ↓ (standalone structureDecision 객체, payload·scoreBreakdown mutate 0건)
v3-signal-cycle.js  (v0.5.0 박제 — 8 cycleState + 5 cyclePhase + 7 bucketFamily + cooldown/EXPIRED)
  ↓ (standalone signalCycle 객체, 모든 입력 mutate 0건)
v3-strategy-plan.js  (v0.6.0 박제 — 10 strategyBias + 4축 분류 + entryPlan/exitPlan/riskControls)
  ↓ (standalone strategyPlan 객체, 4종 입력 mutate 0건)
v3-card-view-model.js  (v0.7.0 박제 — identity/header/chips/metrics/sections/displayFlags/tone)
  ↓ (standalone cardViewModel 객체, 5종 입력 mutate 0건, UI-ready, 비-렌더)
v3-operation-packet.js  (v0.8.0 박제 — routing/notificationPacket/snapshotPacket/evaluationSeed/displaySummary)
  ↓ (standalone operationPacket 객체, 6종 입력 mutate 0건, transport-ready, side-effect free)
v3-active-cycle.js  (v0.9.0 박제 — lifecycle/transition/routingDecision/notifyPolicy/snapshotPolicy/evaluationPolicy/nextState)
  ↓ (standalone activeCycleDecision 객체, 2종 입력 mutate 0건, lifecycle decision data, side-effect free)
v3-evaluation-outcome.js  (v0.10.0 박제 — evaluation/priceBasis/movement/targetCheck/invalidationCheck/pathOrder/quality/routingDecision/nextEvaluationState)
  ↓ (standalone evaluationOutcome 객체, 4종 입력 mutate 0건, result classifier data, side-effect free)
v3-evaluation-observation-adapter.js  (v0.11.0 박제 — 외부 관측 요약 → v0.10.0 evaluationObservation 호환)
v3-external-confluence.js  (v0.11.0 박제 — 보조 context: market/sector/exchange/schedule/news/confluenceScore)
  ↓ (standalone adapter outputs, 입력 mutate 0건, side-effect free, v0.10.0 호환)
v3-transport-plan.js  (v0.12.0 박제 — dry-run plan: telegramPlan/snapshotPlan/evaluationPlan/auditPlan)
  ↓ (standalone TransportPlan 객체, 5종 입력 mutate 0건, side-effect free, dry-run only)
v3-renderer-binding.js  (v0.12.0 박제 — UI binding: header/chips/metrics/sections/flags + displayMode)
  ↓ (standalone RendererBinding 객체, 입력 mutate 0건, DOM-free, cardViewModel superset)
v3-transport-execution-adapter.js  (v0.13.0 박제 — dry-run safe envelope: telegramEnvelope/snapshotEnvelope/evaluationEnvelope/auditEnvelope)
  ↓ (standalone TransportExecutionEnvelope 객체, 6종 입력 mutate 0건, side-effect free, dryRun=true 강제, credential recursive 차단, whitelist scalar only)
v3-secure-transport-executor-contract.js  (v0.14.0 박제 — CONTRACT_ONLY secure executor contract: telegramContract/snapshotContract/evaluationContract/auditContract)
  ↓ (standalone SecureTransportExecutorContract 객체, 7종 입력 mutate 0건, side-effect free, contractMode='CONTRACT_ONLY' 강제, liveExecutionAllowed=false 강제, credential recursive + env-like + depth + bindingRef 검증, bindingRef logical reference only, v0.13 envelope 재검증, secureBindingPolicy 박제, v0.15+ real executor 와 credential 비전달 보장)
v3-transport-executor-harness.js  (v0.15.0 박제 — DRY_RUN_HARNESS: telegramHarness/snapshotHarness/evaluationHarness/auditHarness + rateLimitContract + circuitBreakerContract + dryRunResult)
  ↓ (standalone TransportExecutorHarness 객체, 8종 입력 mutate 0건, side-effect free, harnessMode='DRY_RUN_HARNESS' 강제, 5 boolean hard block, perTargetGate.allow=false 강제, dryRunResult.wouldExecute=false 강제, circuitBreaker.state='OPEN_IN_DRY_RUN' 강제, v0.14 contract.requestShape 재검증)
v3-transport-executor-interface-adapter.js  (v0.16.0 박제 — INTERFACE_ONLY: telegramInterface/snapshotInterface/evaluationInterface/auditInterface + 5종 Contract (bindingResolver/driverCall/resultAdapter/errorAdapter/retryAdapter))
  ↓ (standalone TransportExecutorInterfaceAdapter 객체, 9종 입력 mutate 0건, side-effect free, sync only, adapterMode='INTERFACE_ONLY' 강제, 8 boolean hard block, target↔action 매핑 1:1, validateLogicalRef 6단계, v0.15 pass-through 재검증)
v3-transport-executor-sandbox-runner.js  (v0.17.0 박제 — SANDBOX_ONLY: telegramSandbox/snapshotSandbox/evaluationSandbox/auditSandbox + sandboxFixture/sandboxResult + 5종 Preview)
  ↓ (standalone TransportExecutorSandboxRunner 객체, 10종 입력 mutate 0건, side-effect free, sync only, sandboxMode='SANDBOX_ONLY' 강제, 9 boolean hard block (v0.16 8 + timerAllowed 신규), 5종 Preview (callAllowed/lookupAllowed/wouldCall/retryAllowed=false 강제), sandboxFixture 9-step 검증, sandboxResult whitelist scalar only, sandboxResult.ok ≠ target.ready 분리, v0.16 pass-through 재검증, v0.18+ real executor 와 credential 비전달 보장)
v3-secure-binding-gateway-contract.js  (v0.18.0 박제 — CONTRACT_ONLY: telegramGateway/snapshotGateway/evaluationGateway/auditGateway + 5종 Contract field (credentialHandleRef/bindingScope/lookupPlan/bindingPolicy/sandboxResultRef))
  ↓ (standalone SecureBindingGatewayContract 객체, 11종 입력 mutate 0건, side-effect free, sync only, gatewayMode='CONTRACT_ONLY' 강제, 11 boolean hard block (v0.17 9 + lookupAllowed + envAccessAllowed 신규), 5 safe sandboxResultRef fields (target/action/resultType/simulated/status), framework logical term 우회 알고리즘 (CREDENTIAL_HANDLE / CREDENTIAL_HANDLE_REF substring), v0.17 pass-through 재검증, masked credential preview 출력 0건)
v3-live-execution-preflight-gate.js  (v0.19.0 박제 — PREFLIGHT_ONLY: telegramPreflight/snapshotPreflight/evaluationPreflight/auditPreflight + 7종 Contract field (gatewayRef/executionIntent/bindingRequirementSnapshot/liveReadinessPolicy/killSwitchPlan/rollbackPlan/disablePlan) + riskSummary)
  ↓ (standalone LiveExecutionPreflightGate 객체, 12종 입력 mutate 0건, side-effect free, sync only, preflightMode='PREFLIGHT_ONLY' 강제, 11 boolean hard block, 4 target 동일 13-key shape, 8 validate 본문 규칙, killSwitchPlan.currentState='NOT_EVALUATED' 강제, v0.20 별도 runtimeState 객체 분리 정책)
v3-secure-runtime-state-adapter.js  (v0.20.0 박제 — CANARY_PREP_ONLY: killSwitchRuntimeState/rollbackRuntimeState/disableRuntimeState/telegramRuntimeEligibility/canaryRuntimePolicy/safeDiagnostics)
  ↓ (standalone SecureRuntimeStateAdapter 객체, v0.19 결과 mutate 0건, side-effect free, sync only, runtimeMode='CANARY_PREP_ONLY' 강제, 6 runtime state contract (killSwitchRuntimeState.state='CANARY_ALLOWED' 박제 + rollback/disable executor 0건 + telegramRuntimeEligibility (Canary only) + canaryRuntimePolicy 8 boolean (fixedMessageOnly=true, KV/DB/snapshot/evaluation/audit/candidatePayload 0건) + safeDiagnostics 3 false 강제), 6 validate 본문 규칙, async/Promise/timer/Date.now/process.env/globalThis.env 0건)
v3-telegram-canary-sender.js  (v0.21.0 박제 — Telegram canary sender: buildTelegramCanaryPlan sync + dispatchCanary async)
  ↓ (Telegram 1 target 한정 첫 LIVE side-effect 모듈, CANARY_FIXED_MESSAGE 5줄 byte-for-byte exact, 20 hard precondition AND, 4 explicit gate (env enabled + 24h authorized + invoke token + manualTrigger), 5s hard timeout + AbortController via deps, retry=0, 60s rate limit, 3-fail 24h circuit breaker, safe result whitelist 6 fields, safe error whitelist 4 fields + 7 errorCode enum, safeDiagnostics 6 fields (3 false 강제), raw Telegram response 차단 (description/from.*/chat.*/bot_token/headers/Set-Cookie 0건), token/chatId 값 출력 0건, deps.fetchImpl/AbortControllerImpl/setTimeoutImpl/clearTimeoutImpl/nowMs 인자 주입 만, input.runtimeEnv 인자 만 (process.env/globalThis.env 직접 사용 0건), worker.js/endpoint/inbound/canary worker 0건)
workers/ws3-telegram-canary-worker.js + web/ws3-canary-console.html  (v0.22.0/v0.22.1 박제 — separate canary worker, local Web Console, Cloudflare runtime hotfix)
  ↓ (actual live Telegram canary 1회 성공, CANARY_SENT/httpStatus 200/messageType CANARY_TEST_ONLY/fixedMessageUsed true, fixed 5-line message 수신, cleanup 완료, CANARY_ENABLED=false, real coin candidates still not connected, KV/DB writes 0건)
[v0.23.x — production-grade enforcement: persistent alreadySent, persistent invoke-token failure counter, cleanup automation, production Web Console hosting policy]
```

---

## 해소된 DECISION_PENDING (c-r1 단계 종료 시점)

| ID | 결정 | 적용 |
|---|---|---|
| **DP-1** | explicit ts > primary candle.ts > null. Date.now 금지 | `resolveTs()` |
| **DP-2** | canonical tradeValue만, alias 외부 노출 금지 | 매핑 전체 |
| **DP-3** | DP-3-A: 별도 파일 신규. v3-feature-payload.js build throw 유지 | `v3-feature-payload-builder.js` |
| **DP-4** | validator 현행 유지. builder가 createEmpty 기반 13 key 보장 | `buildFeaturePayload()` step 1 |
| **DP-5** | normalizeIdentity helper. 'KRW-BTC' → quote/base 분해 | `normalizeIdentity()` |
| **DP-6** | V3BuildMarketCtx typedef + 안전 정규화 | typedef + 전반 |
| **DP-7** | raw.builderDebug 디버그 보조 구조 도입 | builderDebug 객체 |
| **U-1** | indicators 내부 통계 키 (currentTradeValueKrw 등) v3-indicators 결과 그대로 보존 — quote-agnostic 리네이밍은 v0.3 이후 별도 검토 | 참고 사항 |
| **U-2** | V3BuildCandlesInput typedef. 5 timeframe 객체 입력. 단일 배열 X | `normalizeCandlesInput()` |

> WS3_CODE_CONTRACT.md (b-r2 박제본) §8 의 DP-1/2/3 + c-r1 신규 DP-4/5/6/7 모두 해소.
> CODE_CONTRACT 본문은 c-r1 단계에서 수정하지 않음. r2.1 박제 검토는 별도 단계.

---

## 다음 단계 (확정된 순서)

```text
(다음) v0.23.x — production-grade enforcement:
                  persistent alreadySent,
                  persistent invoke-token failure counter,
                  cleanup automation,
                  production Web Console hosting policy
(별도) v0.15.x — 실제 transport executor (SecureTransportExecutorContract 출력을 받아 실제 Telegram bot API / KV write / reviewQueue write)
                  bindingRef → secure binding lookup (Cloudflare env / KMS / secret store) — v0.14.0 contract 에는 credential value 0 포함
                  LIVE_EXECUTION explicit gate 별도 정의
(별도) v0.12.x renderer — DOM/HTML attach (RendererBinding 출력을 받아 렌더)
(별도) v0.11.x — 실제 외부 데이터 수집 adapter (EvaluationObservationAdapter 출력을 받아 실제 fetch)
(별도) v0.10.x evaluation adapter — 실제 24h/7d 캔들 fetch + outcome 영속화
(별도) v0.9.x transport adapter — 실제 외부 전송 / KV 저장
(별도) v0.8.x transport — OperationPacket 실제 전송
(별도) v0.7.x renderer — DOM / HTML 렌더
```

---

## v0.31.0 핵심 메모

```text
- workers/ws3-telegram-canary-worker.js 2381 → 2759 라인 (+378 보강, 신규 require 0건, 모두 인라인, v0.29/v0.30 helper 그대로 재사용)
- web/ws3-canary-console.html 1494 → 1724 라인 (+230, Section 8 preset 버튼 + Section 11 신규)
- web/ws3-canary-console/index.html 1494 → 1724 라인 (byte-for-byte mirror 유지, 68102 → 84866 bytes)
- 신규 산출: /docs/ws3/WS3_v0_31_0_WEB_FIRST_MINIMUM_OPERATOR_MODE_REPORT.md (13 sections)
- v0.31 의 핵심: 검증용 콘솔 → 운영자 수동 운영 최소 웹 콘솔 전환 / 자동 알람 아님.
- 방향 전환: 사전 검증 minimize → 운영 가능한 최소 웹 기능 한 번에 구현 → 필수 안전 테스트만 → 배포 → 자연검증.
- 신규 엔드포인트 POST /send-limited-live-alert + OPTIONS allowlist 9→10 path.
- 신규 상수 6종:
  · LIMITED_LIVE_MODE='LIMITED_LIVE_OPERATOR_REVIEW'
  · LIMITED_LIVE_MESSAGE_TYPE='LIMITED_LIVE_OPERATOR_REVIEW'
  · LIMITED_LIVE_CONFIRM_PHRASE='SEND_WS3_LIMITED_LIVE_REVIEW' (별도, normal/forced candidate test 와 분리)
  · LIMITED_LIVE_GUARD_KEY_PREFIX='ws3:canary:limitedLiveAlertSent:'
  · LIMITED_LIVE_GUARD_REASON='LIMITED_LIVE_REVIEW_SENT'
  · LIMITED_LIVE_GUARD_WINDOW_MS=60000
- 별도 env: WS3_LIMITED_LIVE_ENABLED (worker read only, wrangler-canary.toml 미설정 default 'false', deploy Gate 에서 임시 'true' 활성화 + 운영 유지 여부 사용자 결정)
- 인증 7-layer:
  · Origin + Token + manualTrigger 3중 (v0.27 와 동일)
  · env WS3_LIMITED_LIVE_ENABLED='true' (별도 enable gate)
  · confirmPhrase 'SEND_WS3_LIMITED_LIVE_REVIEW' byte-for-byte
  · selectedCandidate 자격: isCandidate=true OR (operatorReview=true AND allowOperatorReviewSend=true)
  · KV per-(market,timeframe) 60s 윈도우
- operatorReview 분류기 (isCandidate 와 별도):
  · isCandidate = grade in {P-S, P-A} (v0.28 score 산식 기반)
  · operatorReview = any of: score≥20 / grade≥P-B / chip VOLUME_SURGE / chip HIGH_CLOSE_POSITION+changePct>0 / volumeRatio≥1.2 AND closePosition≥0.6 / chip SHORT_MOMENTUM / chip POSITIVE_CHANGE
  · level: HOT_REVIEW (score≥45 OR grade≥P-B) / WATCH_REVIEW (operatorReview & not HOT) / LOW_SIGNAL
  · operatorReviewReason: 최대 4종 코드 (SCORE_GE_20 / GRADE_GE_PB / VOLUME_SURGE_CHIP / HIGH_CLOSE_WITH_POSITIVE_CHANGE / VOLUME_RATIO_GE_1_2_CLOSE_POS_GE_0_6 / SHORT_MOMENTUM_CHIP / POSITIVE_CHANGE_CHIP)
- multi-candidate pipeline 확장:
  · 각 ok row 에 operatorReview / operatorReviewLevel / operatorReviewReason 추가
  · 정렬 priority: operatorReviewLevel → score desc → volumeRatio desc → closePosition desc
  · 응답에 operatorReviewCounts: {HOT_REVIEW, WATCH_REVIEW, LOW_SIGNAL} 신규
- LIMITED LIVE / OPERATOR REVIEW preamble (Telegram body, fixed):
  · [WOOS WS3 LIMITED LIVE / OPERATOR REVIEW]
  · 자동 매수/매도 추천 아님 / 운영자 검토 필요 / Manual operator review only. / This is not a live trading alert.
  · Market / Exchange / Timeframe / Score / Grade / Operator review level / isCandidate / Reason chips / candidateStored:false / trackingStarted:false
  · 매수 추천 / 진입 추천 / 수익 보장 / 확정 신호 / LIVE BUY 문구 0건 (smoke S7 검증)
  · raw exchange data / 가격 / 거래량 숫자 미포함 (score/grade/chips/operatorReviewLevel 만)
- KV duplicate guard:
  · key: ws3:canary:limitedLiveAlertSent:<market>:<timeframe> (per-key 분리)
  · 형식: {schemaVersion:'v1', lastSentAt, reason, messageType, market, timeframe, score, grade, operatorReviewLevel}
  · 윈도우 60s / scope LIMITED_LIVE_GUARD_ONLY 응답 명시
  · 다른 market 또는 다른 timeframe 은 즉시 발송 가능 (smoke S5/S5b 검증)
  · v0.29 candidate test guard (`ws3:canary:candidateTestSent` single key) 와 별도 namespace
  · adapter 파일 수정 0건 (CanaryStateKvAdapter.getJson/putJson generic 재사용)
- Web Console Section 8 확장:
  · "Load 40-market Upbit preset" 버튼 (KRW-BTC ~ KRW-PYTH 40종 채우고 limit=60 설정)
  · 결과 카드 rendering operatorReviewLevel 색상 배지 (HOT_REVIEW 빨강 / WATCH_REVIEW 주황 / LOW_SIGNAL 회색)
  · [OP-REVIEW] 라벨 (isCandidate=false 이지만 operatorReview=true)
- Web Console Section 11 신규 (Minimum Operator Mode):
  · Limited Live Mode 상태 표시
  · Selected Operator Review Card select (Section 8 결과에서 eligible 만 표시, round-trip JSON)
  · allowOperatorReviewSend 체크박스
  · Confirm Phrase 입력
  · Send LIMITED LIVE / OPERATOR REVIEW 버튼 (Danger Zone 시각 분리)
  · 결과 panel whitelist 9 fields
  · 발송 후 confirm phrase + selection + allowOR 즉시 클리어
- Section 8 → Section 11 selector 동기화 (mcUpdateCandidateSelector wrap, mc Section 9 Forced selector 와 동시 갱신)
- 신규 safe code 6종: LIMITED_LIVE_REVIEW_SENT 200 / DISABLED 503 / CONFIRM_PHRASE_REQUIRED 403 / INVALID_PAYLOAD 400 / ALREADY_SENT 429 / TELEGRAM_ERROR 502
- no-write scope grep:
  · /multi-candidate-dry-run scope: KV writer / Telegram 호출 0건 (v0.30 그대로 유지)
  · /send-limited-live-alert scope: putJson(llKv, llGuardKey) 1건만, 다른 KV writer / canary sender 호출 0건
  · /send-candidate-test (normal/forced) scope: v0.30 그대로 (putJson(CANDIDATE_TEST_GUARD_KEY) 1건만)
- mock smoke 17/17 PASS (spec 10 essential + 7 추가 audit):
  · Essential (S1-S5b): disabled gate + confirm 검증 + 자격 검증 (no allowOR / 자격 없음 / OR with allowOR) + mock success natural + OR card + duplicate guard same key + 다른 market 차단 안 됨
  · Audit (S6-S13): Telegram body 필수 라벨 (LIMITED LIVE / OPERATOR REVIEW / 자동 매수·매도 추천 아님 / 운영자 검토 필요 / Manual operator review only / candidateStored:false / trackingStarted:false) + 금지 라벨 0건 + response candidateStored=false / trackingStarted=false + multi-dry-run regression (operatorReview 필드 + Telegram·KV 0건) + raw Telegram response leak CLEAN + secret leak CLEAN + KV guard key per-market+timeframe
- 보호 파일 (worker.js + wrangler.toml + index.html + manifest.json + service-worker.js + v3/ 25종 + WS3_CODE_CONTRACT.md + WS3_WORKFLOW_TEMPLATE.md + workers/ws3-canary-state-kv-adapter.js + wrangler-canary.example.toml + .gitignore) diff 0건
- 미스테이지 유지: workers/ws3-telegram-canary-entry.mjs / wrangler-canary.toml / .claude/ / .wrangler/ / .tmp_canary_* / .tmp_pages_deploy/ / smoke 임시 파일 검증 직후 즉시 삭제
- Cloudflare 변경 0건 (worker 재배포 / Pages 재배포 / KV namespace 생성·변경 / allowed origins 변경 / secrets 변경 / WS3_CANDIDATE_TEST_ENABLED 변경 / WS3_LIMITED_LIVE_ENABLED 변경 모두 0건)
- 실 호출 0건 (/send-limited-live-alert production/staging / 실 거래소 API / Telegram API / KV write 모두 0건)
- 다음 후보:
  · v0.31 Deploy Gate (별도, Worker redeploy + Pages redeploy + WS3_LIMITED_LIVE_ENABLED='true' 임시 활성화 + 40-market preset scan + Section 11 Send 1회 + duplicate 차단 확인 + 운영 유지 여부 사용자 결정)
  · v0.32 후보 A: score / operatorReview 임계값 자연검증 후 조정
  · v0.32 후보 B: browser memory-only history 확장
  · v0.32 후보 C: Security hardening before live operation (Cloudflare Access 재검토 / invoke token rotation / origin allowlist 재검토)
  · env-based MULTI_CANDIDATE_DISABLED / CANDIDATE_TEST_DISABLED / LIMITED_LIVE_DISABLED 강제 kill switch
  · rate limit per origin / market / minute
  · invoke token rotate automation / ipHash + WS3_CANARY_HASH_SALT
  · 자동 운영 (Cron / auto Telegram / candidate 저장 / tracking 시작) — v0.32+ 별도, 사용자 명시 승인 필수
- v0.31 한계: mock smoke only / 40 market 병렬 fetch 부하 자연검증 필요 / operatorReview 산식 단순 우회 규칙 (자연검증 후 조정) / KV guard window=60s per-(market,timeframe) — 동일 시장 즉시 재전송 차단, 다른 시장 즉시 가능 / WS3_LIMITED_LIVE_ENABLED 운영 유지 시 confirm phrase + per-key guard + UI 클릭 3중 보호로 우연 발송 방지.
```

## v0.31.0 Minimum Live Validation Success (실 Cloudflare 검증 박제)

```text
v0.31.0 Minimum Live Validation Success:
- Production Check State succeeded
- Worker version: WS3_v0.31.0_web_first_minimum_operator_mode
- v0.31.0-fix-1 maxMarkets50 deployed
- 40-market preset scan succeeded
- marketCount=40
- okCount=19
- failCount=21
- candidateCount=0
- disabled send gate blocked correctly (LIMITED_LIVE_DISABLED 503)
- LIMITED LIVE / OPERATOR REVIEW Telegram sent once
- selectedMarket=KRW-DOT
- exchange=upbit
- timeframe=5m
- score=29
- grade=P-C
- operatorReviewLevel=WATCH_REVIEW
- isCandidate=false
- reasonChips=VOLUME_SURGE
- resultCode=LIMITED_LIVE_REVIEW_SENT
- messageType=LIMITED_LIVE_OPERATOR_REVIEW
- fixedMessageUsed=true
- telegramSent=true
- kvWritten=true
- kvWriteScope=LIMITED_LIVE_GUARD_ONLY
- candidateStored=false
- trackingStarted=false
- duplicate second send blocked (Telegram 추가 수신 0건)
- final operation decision=운영 유지
- WS3_LIMITED_LIVE_ENABLED=true
- Cron disabled
- automatic alerts disabled
- candidate storage disabled
- tracking start disabled
- Telegram API 호출 1건 (Step L 만)
- KV write 1건 (Step L LIMITED_LIVE_GUARD_ONLY 만)
- 추가 호출 0건
- raw Telegram response not recorded
- raw exchange full response not recorded
- Invoke Token not recorded
- KV namespace ID not recorded
- raw invite code / SHA-256 hash not recorded
- 노출된 폐기 hash repo-wide 매치 0건
- UI 후속 개선: disabled response safety fields 표시 (telegramSent/kvWritten/candidateStored/trackingStarted="-" 현상)
- 자연검증 후속: failCount=21 프리셋 내 미상장/미지원 심볼 보정
```

## Next — Natural Validation Phase

```text
- use web console in real operation
- refine 40-market preset based on failCount
- improve disabled response safety fields display
- tune operatorReview score/thresholds
- improve mobile card UX
- keep Cron/candidate storage/tracking disabled until separate approval
```

## v0.30.0 Live Validation Success (실 Cloudflare 검증 박제)

```text
v0.30.0 Live Validation Success:
- Worker deploy 총 3회 (Step B 초기 single fragment 8394b023, Step K enable 7edff370, Step M disable 492abcda, 모두 size 180.33 KiB / gzip 28.15 KiB)
- Pages deploy: completed (production URL ws3-canary-console.pages.dev, --branch=main, Section 9 forced mode UI 반영)
- Production console Check State PASS (v0.30 version 반영 확인):
  · version=WS3_v0.30.0_forced_candidate_test_telegram
  · persistenceAvailable=true / canaryEnabled=false / alreadySent=false / cleanupRequired=false / circuitOpen=false / currentPhase=RESET_CONFIRMED
- Multi-market Dry-run PASS (1회):
  · exchange=upbit / timeframe=5m / marketCount=10 / LOW_SIGNAL 계열
  · forced test 대상 선택: KRW-NEAR / score=19 / grade=P-C / reasonChips=LOW_VOLUME,HIGH_CLOSE_POSITION
- Step J 명시 승인: "FORCED TEST_ONLY 1회 승인"
- Step K Worker redeploy → WS3_CANDIDATE_TEST_ENABLED='true' 임시 활성화 (wrangler-canary.toml line 13 신규 추가)
- Step L FORCED Candidate TEST_ONLY Telegram 1회 PASS:
  · forcedTestReason='path validation after LOW_SIGNAL multi-market dry-run'
  · code=FORCED_CANDIDATE_TEST_SENT / httpStatus=200
  · mode=FORCED_TEST_ONLY / messageType=FORCED_CANDIDATE_TEST_ONLY / fixedMessageUsed=true
  · safety: telegramSent=true / kvWritten=true / kvWriteScope=CANDIDATE_TEST_GUARD_ONLY / candidateStored=false / trackingStarted=false
  · Telegram 수신 정상 — 필수 라벨 7건 + 안내 4건 확인:
    [WOOS WS3 FORCED CANDIDATE TEST_ONLY] / This is not a live trading alert. / manual forced validation only.
    실전 알람 아님 / 테스트 전송 / 강제 후보 테스트 / 매수/매도 추천 아님
    mode: FORCED_TEST_ONLY / source: multi-candidate-dry-run / candidateStored: false / trackingStarted: false
  · 매수 추천 / 수익 보장 / LIVE BUY / 진입 추천 문구 0건 / raw exchange data / 가격 / 거래량 숫자 미포함
- Step M Worker redeploy → WS3_CANDIDATE_TEST_ENABLED='false' 복귀 (binding display 풀값 노출 확인) / FORCED 추가 발송 차단 production 반영
- Telegram API 호출 1건 (Step L 만) / KV write 1건 (Step L duplicate guard 만, key ws3:canary:candidateTestSent, audit messageType='FORCED_CANDIDATE_TEST_ONLY' 포함)
- 추가 호출 0건 (Step M 이후 /send-candidate-test 재호출 / Telegram / KV write 모두 0건)
- candidate 저장 0건 / tracking 시작 0건 / snapshot/evaluation/audit 0건
- CANARY_ENABLED=false maintained / AUTHORIZED_AT=0 maintained / WS3_CANARY_ALLOWED_ORIGINS Pages-only 유지 / Limited Live Mode DISABLED 유지
- raw Telegram response: not recorded (resp.text() 결과 폐기, body 에 message_id / result / from / chat 미포함)
- raw exchange full response: not recorded / Invoke Token: not recorded / KV namespace ID: not recorded
- raw invite code / SHA-256 hash: not recorded (placeholder repo 박제 유지, 노출된 폐기 hash repo-wide 매치 0건)
- deployment ID 전체값: not recorded (Version ID 단편만)
- Gate 진행 흐름: Step A (preflight sanity) → Step B (Worker v0.30 deploy) → Step C (hash reuse) → Step D (.tmp_pages_deploy 생성) → Step E (assignment line 1건만 hash 교체, line 418) → Step F (Pages deploy --branch=main) → Step G (temp cleanup + 검증) → Step H (사용자 Check State PASS) → Step I (사용자 Multi-market Dry-run 10 markets LOW_SIGNAL) → Step J (사용자 명시 승인 FORCED TEST_ONLY 1회) → Step K (Worker redeploy enable WS3_CANDIDATE_TEST_ENABLED='true') → Step L (사용자 FORCED Candidate TEST_ONLY Send 1회 PASS, Telegram 수신 정상, 필수 라벨 11종 확인) → Step M (Worker redeploy disable WS3_CANDIDATE_TEST_ENABLED='false', 추가 발송 차단)
- 결과 판정: FORCED Candidate TEST_ONLY Telegram 경로 실검증 성공 / forced mode 메시지 안전 라벨 정상 / KV write scope CANDIDATE_TEST_GUARD_ONLY 분리 정상 / candidate 저장·tracking 시작 0건 정상 / WS3_CANDIDATE_TEST_ENABLED='false' 복귀 정상 / 모든 안전 가드 정상 작동 검증
- 본 검증 한계 (재인용): 1 isolate / 1 사용자 / 1 forced candidate (KRW-NEAR P-C) / 5m / 단일 시점 범위. forced 활성화↔비활성화 시간 짧음 (Step L 직후 Step M). 60s duplicate guard window 정상 작동 확인. multi-market 분포 / forced 메시지 가독성 / Telegram 길이 제한 / rate limit 응답은 v0.31+ 추가 검증 필요.

Next:
v0.31 candidate:
  - Web-first Minimum Operator Mode Pack (속도전, 사용자 자연 검증 경로)
    · broader market preset
    · operator review candidate cards
    · limited live send button
    · disabled/enabled essential tests only
    · natural validation after web usage
```

## v0.30.0 핵심 메모

```text
- workers/ws3-telegram-canary-worker.js 2311 → 2381 라인 (+70 보강, 신규 require 0건, 모두 인라인, v0.29 helper 그대로 재사용)
- web/ws3-canary-console.html 1435 → 1494 라인 (+59, Section 9 forced mode UI 확장)
- web/ws3-canary-console/index.html 1435 → 1494 라인 (byte-for-byte mirror 유지, 68102 → 71874 bytes)
- 신규 산출: /docs/ws3/WS3_v0_30_0_FORCED_CANDIDATE_TEST_TELEGRAM_REPORT.md (13 sections)
- v0.30 의 핵심: 후보 미발생 환경에서도 Candidate Telegram 경로 검증 가능 / forced TEST_ONLY 모드 / 실전 알람 아님.
- 신규 상수 6종:
  · FORCED_CANDIDATE_TEST_MODE='FORCED_TEST_ONLY'
  · FORCED_CANDIDATE_TEST_MESSAGE_TYPE='FORCED_CANDIDATE_TEST_ONLY'
  · FORCED_CANDIDATE_TEST_CONFIRM_PHRASE='SEND_WS3_FORCED_TEST_CANDIDATE' (normal SEND_WS3_TEST_CANDIDATE 와 분리)
  · FORCED_CANDIDATE_TEST_GUARD_REASON='FORCED_CANDIDATE_TEST_SENT'
  · FORCED_CANDIDATE_TEST_REASON_MAX_LEN=128
  · FORCED_CANDIDATE_TEST_REASON_PATTERN=/^[A-Za-z0-9 _\-\.\,\:\!\?\(\)\[\]\/]{1,128}$/
- /send-candidate-test 인증 (5중):
  · Origin allowlist + X-WS3-Canary-Token + manualTrigger 3중 (v0.29 그대로)
  · WS3_CANDIDATE_TEST_ENABLED='true' (normal/forced 공통, forced-aware disabled 코드 분기)
  · forced: confirmPhrase='SEND_WS3_FORCED_TEST_CANDIDATE' byte-for-byte + forcedTestReason 정규식+1-128자 / normal: confirmPhrase='SEND_WS3_TEST_CANDIDATE' (v0.29)
  · selectedCandidate.source='multi-candidate-dry-run' 정합
  · KV candidateTestSent.lastSentAt 60s 윈도우 (forced/normal 공통)
- 코드 변경 포인트:
  · validateCandidateTestRequest 확장: body.forceTestCandidate 감지 → forced 모드 에러 코드 namespace 전환
  · buildCandidateTestMessageText 확장: forced 분기 별도 preamble (FORCED CANDIDATE TEST_ONLY / manual forced validation only / 강제 후보 테스트 + mode/source/candidateStored/trackingStarted 라인 + Forced reason)
  · buildCandidateTestResponse(kvWritten, forced) 확장: forced 시 code='FORCED_CANDIDATE_TEST_SENT' / mode='FORCED_TEST_ONLY' / messageType='FORCED_CANDIDATE_TEST_ONLY'
  · 핸들러 변경: disabled gate check 위치 body parse 직후로 이동 (body.forceTestCandidate 기반 코드 라우팅) / duplicate guard error + Telegram error 코드 forced-aware 분기
  · KV guard payload audit: messageType + market 필드 추가 (closure 시점 forced/normal 구분 가능, key 동일)
- forced FORCED preamble (Telegram body):
  · [WOOS WS3 FORCED CANDIDATE TEST_ONLY] / This is not a live trading alert. / manual forced validation only.
  · 실전 알람 아님 / 테스트 전송 / 강제 후보 테스트 / 매수/매도 추천 아님
  · mode: FORCED_TEST_ONLY / source: multi-candidate-dry-run / candidateStored: false / trackingStarted: false
  · Exchange / Market / Timeframe / Score / Grade / Reason chips / Forced reason
  · 매수 추천 / 수익 보장 / LIVE BUY / 진입 추천 문구 0건 (smoke S13 검증)
  · raw exchange data / 가격 / 거래량 숫자 미포함
- normal preamble: v0.29 그대로 ([WOOS WS3 CANDIDATE TEST_ONLY] / manual limited validation only)
- KV duplicate guard:
  · key: ws3:canary:candidateTestSent (forced/normal 동일)
  · 형식: {schemaVersion:'v1', lastSentAt:nowMs, reason, messageType, market}
  · forced: reason='FORCED_CANDIDATE_TEST_SENT' / messageType='FORCED_CANDIDATE_TEST_ONLY'
  · normal: reason='CANDIDATE_TEST_SENT' / messageType='CANDIDATE_TEST_ONLY'
  · 윈도우 60s 공통 / scope=CANDIDATE_TEST_GUARD_ONLY 응답 명시
  · 어댑터 파일 수정 0건 — CanaryStateKvAdapter.getJson/putJson generic 재사용
- 신규 safe code 6종: FORCED_CANDIDATE_TEST_SENT 200 / DISABLED 503 / CONFIRM_PHRASE_REQUIRED 403 / INVALID_PAYLOAD 400 / ALREADY_SENT 429 / TELEGRAM_ERROR 502
- Web Console Section 9 확장:
  · Forced Test Mode 체크박스 (default off)
  · Forced Test Reason 입력칸 (forced 시에만 표시, maxlength=128, 정규식 sanitize)
  · Confirm Phrase placeholder + Send 버튼 라벨 모드 따라 swap
  · 결과 panel mode 필드 추가
  · mode 토글 시 confirmPhrase + forcedTestReason 즉시 클리어 / 발송 후 / 네트워크 실패 후 즉시 클리어
  · Send 버튼 enable = hasSel && phraseOk && (forced ? reasonOk : true)
  · client-side CT_FORCED_REASON_PATTERN server-side 와 동일
- no-write scope grep:
  · /multi-candidate-dry-run scope: KV writer / Telegram 호출 0건 (v0.29 그대로 유지)
  · /send-candidate-test scope: putJson(CANDIDATE_TEST_GUARD_KEY) 1건만, normal/forced 공통, audit payload 만 다름
- mock smoke 27/27 PASS (spec 20 forced + 7 추가 regression/audit):
  · Forced (S1-S18): 인증 3종 + disabled gate + confirm 2종 + payload 검증 4종 + mock success + messageType + Telegram body 필수 라벨 (FORCED CANDIDATE TEST_ONLY / 실전 알람 아님 / 강제 후보 테스트 등) + 금지 라벨 (매수하세요/LIVE BUY 등) 0건 + candidateStored=false + trackingStarted=false + KV put 1건 + raw Telegram response leak CLEAN + duplicate guard 429
  · Regression / namespace separation (S19-S25): normal candidate path 회귀 / multi-dry-run 회귀 Telegram 0건 KV 0건 / forced bad score 차단 / normal disabled gate 정상 코드 / forced↔normal phrase 교차 사용 차단 / KV guard audit messageType 명시
- 보호 파일 (worker.js + wrangler.toml + index.html + manifest.json + service-worker.js + v3/ 25종 + WS3_CODE_CONTRACT.md + WS3_WORKFLOW_TEMPLATE.md + workers/ws3-canary-state-kv-adapter.js + wrangler-canary.example.toml + .gitignore) diff 0건
- 미스테이지 유지: workers/ws3-telegram-canary-entry.mjs / wrangler-canary.toml / .claude/ / .wrangler/ / .tmp_canary_* / .tmp_pages_deploy/ / smoke 임시 파일 검증 직후 즉시 삭제
- Cloudflare 변경 0건 (worker 재배포 / Pages 재배포 / KV namespace 생성·변경 / allowed origins 변경 / secrets 변경 / WS3_CANDIDATE_TEST_ENABLED env 활성화 모두 0건)
- 실 호출 0건 (/send-candidate-test normal/forced production/staging / 실 거래소 API / Telegram API / KV write 모두 0건)
- 다음 후보:
  · v0.30 Deploy Gate (별도, Worker redeploy + Pages redeploy + WS3_CANDIDATE_TEST_ENABLED='true' 임시 활성화 + Multi-market Dry-run → top result 선택 → Section 9 forced 모드 + forcedTestReason + SEND_WS3_FORCED_TEST_CANDIDATE 입력 → Send FORCED Candidate TEST_ONLY 1회 → Telegram 수신 확인 → 'false' 복귀)
  · v0.31 후보 A: Candidate Scoring Calibration
  · v0.31 후보 B: Multi-market history persistence (browser memory-only 확장)
  · v0.31 후보 C: Security hardening before live candidate alert
  · env-based MULTI_CANDIDATE_DISABLED / CANDIDATE_TEST_DISABLED 강제 kill switch
  · rate limit per origin / market / minute
- v0.30 한계: mock smoke only / forced mode 활성화 = 4중 보호 (별도 confirmPhrase + forcedTestReason 정규식+길이 + 별도 enable env + 60s duplicate guard) / KV guard window=60s normal/forced 공통, 실 환경에서 더 긴 window 필요 시 v0.31+ 조정.
```

## v0.29.0 Live Validation Success (실 Cloudflare 검증 박제)

```text
v0.29.0 Live Validation Success:
- Worker deploy: completed (Version single fragment 901d73dc, size 177.16 KiB / gzip 27.61 KiB)
- Pages deploy: completed (production URL ws3-canary-console.pages.dev, --branch=main, Sections 8/9/10 UI 반영)
- WS3_CANDIDATE_TEST_ENABLED: not activated (default 'false' 동작, Step K/L/M 생략)
- Production console Check State PASS:
  · version=WS3_v0.29.0_integrated_limited_live_pipeline
  · persistenceAvailable=true / canaryEnabled=false / alreadySent=false / cleanupRequired=false / circuitOpen=false / currentPhase=RESET_CONFIRMED
- /multi-candidate-dry-run actual read-only call PASS (1회):
  · exchange=upbit / timeframe=5m / limit=60 / markets 10건 (KRW-BTC, KRW-ETH, KRW-XRP, KRW-SOL, KRW-DOGE, KRW-ADA, KRW-AVAX, KRW-LINK, KRW-NEAR, KRW-SEI)
  · code=MULTI_CANDIDATE_DRY_RUN_OK / mode=MULTI_CANDIDATE_DRY_RUN_ONLY
  · marketCount=10 / candidateCount=0 → LOW_SIGNAL_NORMAL 정상 판정
  · topMarket=KRW-NEAR / topScore=24 / topGrade=P-C / topReasonChips=HIGH_CLOSE_POSITION / latestTime=2026-05-19T07:50:00Z / lastClose=2480
  · 모든 10 markets P-C 분류 (isCandidate=false)
- 점수 산식 검증 포인트 (KRW-AVAX):
  · volRatio=15.102 / volAccel=10.831 (volume surge 매우 강함) → VOLUME_SURGE chip +25 가산
  · upperWickPct >= bodyPct*2 AND closePosition < 0.6 → UPPER_WICK_RISK chip -15 감점
  · 결과 score=10 / grade=P-C / isCandidate=false
  · 결론: 단순 volume surge 만으로 후보 판정 안 함 (false positive 방지 로직 정상 작동)
- safety flags 모두 false: telegramSent / kvWritten / candidateStored / trackingStarted
- Candidate TEST_ONLY Telegram: skipped (Case 1 LOW_SIGNAL 분기, candidateCount=0)
- Step K (WS3_CANDIDATE_TEST_ENABLED='true' 활성화) / Step L (사용자 Telegram 발송) / Step M (disable 복귀) — 모두 생략
- Send Candidate TEST_ONLY count: 0 / Send Canary count: 0 / Cleanup Confirm count: 0 / Operator Reset count: 0
- Live Preflight extra calls: 0 / Candidate Dry-run extra calls: 0
- Telegram API calls: 0 / KV writes: 0
- CANARY_ENABLED=false maintained / AUTHORIZED_AT=0 maintained
- WS3_CANARY_ALLOWED_ORIGINS = https://ws3-canary-console.pages.dev (Pages-only) 유지
- Limited Live Mode: DISABLED 유지 (활성화 코드 0건, env 변경 0건)
- raw exchange full response: not recorded
- raw Telegram response: not recorded (이번 Gate 에서 Telegram 호출 자체 0건)
- Invoke Token: not recorded / KV namespace ID: not recorded
- raw invite code / SHA-256 hash: not recorded (placeholder repo 박제 유지, 노출된 폐기 hash repo-wide 매치 0건)
- deployment ID 전체값: not recorded (Version ID 단편만)
- Gate 진행 흐름: Step A (preflight sanity) → Step B (Worker redeploy) → Step C (hash reuse) → Step D (.tmp_pages_deploy 생성) → Step E (assignment line 1건만 hash 교체, line 409) → Step F (Pages deploy --branch=main) → Step G (temp cleanup + 검증) → Step H (사용자 Check State PASS) → Step I (사용자 Multi-market Dry-run 1회 PASS, 10 markets → candidateCount=0 LOW_SIGNAL) → Step J (Case 1 분기, Step K/L/M 생략)
- 결과 판정: Multi-market dry-run 실검증 성공 / 후보 미발생 = LOW_SIGNAL 정상 판정 (실패 아님) / 점수 산식·volume surge 가산·upper wick risk 감점·multi-market 환경 false positive 방지 모두 정상 작동 검증
- 본 검증 한계 (재인용): 1 isolate / 1 사용자 / 10 markets / 5m / limit 60 / 단일 시점 범위. 활발한 시장 / 강한 surge / 후보 발생 시점 / 다른 timeframe / 다른 exchange / 다른 limit 은 본 검증 범위 밖. Candidate TEST_ONLY Telegram 발송 경로 (Step L/M) 는 본 Gate 미수행 — forced-test candidate mode 또는 surge 시점 재검증은 v0.30+ 별도 단계.

Next:
v0.30 candidate:
  - 후보 A: Candidate Scoring Calibration (산식 threshold 조정 또는 가중치 재배분)
  - 후보 B: Broader Multi-market Dry-run (predefined list 확장, 더 많은 timeframe / 시장 / watchlist)
  - 후보 C: Candidate TEST_ONLY Telegram validation using forced/test candidate mode (Telegram 경로 검증)
  - 후보 D: Security hardening before live candidate alert (Cloudflare Access / invoke token rotation / origin allowlist 재검토)
```

## v0.29.0 핵심 메모

```text
- workers/ws3-telegram-canary-worker.js 1718 → 2311 라인 (+593 보강, 신규 require 0건, 모두 인라인, v0.27/v0.28 helper 그대로 재사용)
- web/ws3-canary-console.html 990 → 1435 라인 (+445, Sections 8/9/10 추가)
- web/ws3-canary-console/index.html 990 → 1435 라인 (byte-for-byte mirror 유지, 45836 → 68102 bytes)
- 신규 산출: /docs/ws3/WS3_v0_29_0_INTEGRATED_LIMITED_LIVE_PIPELINE_REPORT.md (17 sections)
- v0.29 의 핵심: 통합 제한 라이브 팩 / 무제한 자동 알람 아님 / Cron 없음.
- 신규 엔드포인트 2종 + OPTIONS allowlist 9 path:
  · POST /multi-candidate-dry-run — 병렬 multi-market dry-run, KV 미사용, Telegram 미호출
  · POST /send-candidate-test — 선택 후보 1건 수동 TEST_ONLY Telegram 발송 + KV duplicate guard 60s window
- 인증 layer:
  · multi: Origin + Invoke Token + manualTrigger 3중
  · send-candidate-test: 위 3중 + WS3_CANDIDATE_TEST_ENABLED='true' + confirmPhrase 'SEND_WS3_TEST_CANDIDATE' byte-for-byte + selectedCandidate source='multi-candidate-dry-run' 정합 + KV 60s duplicate guard
- multi-market 파이프라인:
  · Promise.all 병렬 fetch (각 5s AbortController timeout)
  · v0.27 buildLivePreflightUrl / fetchLiveCandles / normalizeCandles 그대로
  · v0.28 calculateCandleStructureFeatures / calculateVolumeFeatures / calculateMomentumFeatures / calculateCandidateDryRunScore / classifyCandidateDryRunGrade 그대로
  · 정렬: score desc, 동점 시 volumeRatio desc / 실패 결과는 성공 결과 뒤 부착 (rank 연속)
  · 개별 market 실패 격리 — 한 market 실패가 다른 market 결과 차단 X
  · markets max 10 (MULTI_CANDIDATE_MAX_MARKETS), limit max 120 (v0.28 와 동일)
  · markets dedupe (순서 보존)
- candidate test 메시지 (fixed safety preamble):
  · [WOOS WS3 CANDIDATE TEST_ONLY] / This is not a live trading alert. / manual limited validation only. / 실전 알람 아님 / 테스트 전송 / 매수/매도 추천 아님
  · 본문 = Exchange/Market/Timeframe/Score/Grade/Reason chips 만
  · 매수 추천 / 수익 보장 문구 0건
  · raw exchange data / 가격 / 거래량 숫자 미포함 (score/grade/chips 만)
  · chips /^[A-Z_]+$/ 화이트리스트 sanitize
- candidate test KV scope:
  · key: ws3:canary:candidateTestSent (CANDIDATE_TEST_GUARD_KEY)
  · 형식: {schemaVersion:'v1', lastSentAt:nowMs, reason:'CANDIDATE_TEST_SENT'}
  · 윈도우: 60s (CANDIDATE_TEST_GUARD_WINDOW_MS)
  · adapter 파일 수정 0건 — CanaryStateKvAdapter.getJson / putJson generic primitives 재사용
  · alreadySent / cleanupRequired / circuit / invokeFail / operatorReset 등 다른 canary state KV key 일체 read/write 0건
  · 응답 본문 safety.kvWriteScope='CANDIDATE_TEST_GUARD_ONLY' 명시
- 신규 env (선언만, default 'false'):
  · WS3_CANDIDATE_TEST_ENABLED — /send-candidate-test enable gate, CANARY_ENABLED 와 분리
  · 본 commit 까지 변경 0건, deploy Gate 에서만 임시 'true' 활성화 + 검증 직후 'false' 복귀
- raw Telegram response 미노출:
  · sendCandidateTestTelegram = resp.text() 결과 받기만 하고 폐기
  · 응답 본문에 message_id / result / from / chat 등 native field 미포함 (smoke S26 검증)
  · bot token / chat id 응답 본문 노출 0건 (smoke S27 검증)
- 신규 safe code 16종:
  · Multi (9): MULTI_CANDIDATE_DRY_RUN_OK 200 / PARTIAL_OK 200 / ALL_FAILED 502 / INVALID_EXCHANGE 400 / INVALID_MARKETS 400 / TOO_MANY_MARKETS 400 / INVALID_TIMEFRAME 400 / LIMIT_EXCEEDED 400 / FEATURE_ERROR 500
  · Candidate test (7): CANDIDATE_TEST_SENT 200 / DISABLED 503 / CONFIRM_PHRASE_REQUIRED 403 / INVALID_PAYLOAD 400 / NO_CANDIDATE 400 / ALREADY_SENT 429 / TELEGRAM_ERROR 502
- no-write scope grep 검증:
  · /multi-candidate-dry-run handler scope: writeAlready* / writeCleanup* / writeCircuit / writeInvokeFail / writeOperatorReset / markAlreadySentReset / putJson / .put( / sendCanary / dispatchCanary / sendMessage 매치 0건
  · /send-candidate-test handler scope: putJson(ctKv, CANDIDATE_TEST_GUARD_KEY, ...) 1건만, 다른 KV writer / canary sender 호출 0건
- Web Console UI:
  · Section 8 Multi-market Candidate Dry-run: Exchange/Markets textarea (10 markets default, 콤마 또는 줄바꿈)/Timeframe/Limit + 후보 리스트 (score desc, [CANDIDATE] 라벨 P-S/P-A) + Memory-only history (max 5 runs, localStorage/sessionStorage/IndexedDB/cookie 0건)
  · Section 9 Candidate TEST_ONLY Send: selected candidate select (round-trip JSON) + confirm phrase + Danger Zone 시각 분리 + 응답 panel kvWriteScope='CANDIDATE_TEST_GUARD_ONLY' 명시 + 발송 후 confirm/selection 즉시 클리어
  · Section 10 Limited Live Mode: DISABLED 상태 + 활성화 조건 5개 박제 (자동 활성화 코드 0건)
  · 사용자 클릭시에만 fetch / auto refresh 0건 / 1.5s throttle / token readTokenAndClear() 즉시 클리어
  · client-side sanitize: market 정규식 + limit ^[0-9]{1,3}$ → [1, 120]
- mock smoke 30/30 PASS (spec 24 + 6 추가 leak / scope guards):
  · Multi (S1-S15): 인증 3종 + 입력 검증 4종 + success 10 markets + partial OK + score desc 정렬 + candidateCount 매칭 + safety 4 all false + features 8 all finite + raw exchange field leak CLEAN + token leak CLEAN + KV put/delete 0 + Telegram 0
  · Candidate test (S16-S27): 인증 + confirm + payload 검증 5종 + enable gate disabled + mock success (kvWriteScope=CANDIDATE_TEST_GUARD_ONLY) + TEST_ONLY messageType + 단일 candidate 강제 + candidate 저장/tracking 0 + duplicate guard 429 + KV scope = guard only + raw Telegram response leak CLEAN + secret leak CLEAN
  · TELEGRAM_API_CALL_COUNT=1 (S19 mock send only) / KV_PUT_CALL_COUNT=1 (S19 guard write only) / KV_DELETE_CALL_COUNT=0
- 보호 파일 (worker.js + wrangler.toml + index.html + manifest.json + service-worker.js + v3/ 25종 + WS3_CODE_CONTRACT.md + WS3_WORKFLOW_TEMPLATE.md + workers/ws3-canary-state-kv-adapter.js + wrangler-canary.example.toml + .gitignore) diff 0건
- 미스테이지 유지: workers/ws3-telegram-canary-entry.mjs / wrangler-canary.toml / .claude/ / .wrangler/ / .tmp_canary_* / .tmp_pages_deploy/ / smoke 임시 파일 검증 직후 즉시 삭제
- Cloudflare 변경 0건 (worker 재배포 / Pages 재배포 / KV namespace 생성·변경 / allowed origins 변경 / secrets 변경 / WS3_CANDIDATE_TEST_ENABLED env 활성화 모두 0건)
- 실 호출 0건 (/multi-candidate-dry-run / /send-candidate-test production/staging / 실 거래소 API / Telegram API / KV write 모두 0건)
- 다음 후보:
  · v0.29 Deploy Gate (별도, Worker redeploy + Pages redeploy + WS3_CANDIDATE_TEST_ENABLED='true' 임시 활성화 + production console 에서 Multi-market Dry-run 1회 + 후보 있으면 Candidate TEST_ONLY 1회 / 없으면 LOW_SIGNAL 정상 판정 + 검증 직후 'false' 복귀)
  · v0.30 후보 A: predefined market list expand + watchlist UI
  · v0.30 후보 B: Multi-market history persistence (browser only)
  · v0.30 후보 C: Security hardening (Cloudflare Access 재검토 / invoke token rotation / origin allowlist 재검토)
  · env-based MULTI_CANDIDATE_DISABLED / CANDIDATE_TEST_DISABLED 강제 kill switch
  · rate limit per origin / market / minute
  · candidate score 산식 백테스트 결과 기반 조정
- v0.29 한계: mock smoke only. real 거래소 응답 다양성 / 실 Telegram 발송 / 실 KV write 는 별도 Deploy Validation Gate 에서만 1회 한정. duplicate guard window=60s 는 실 환경 재평가 필요. candidate score 산식은 v0.28 그대로 — multi-market 분포는 별도 백테스트 필요.
```

## v0.28.0 Live Validation Success (실 Cloudflare 검증 박제)

```text
v0.28.0 Live Validation Success:
- Worker deploy: completed (Version single fragment 75edfb1f, size 151.91 KiB / gzip 24.23 KiB)
- Pages deploy: completed (production URL ws3-canary-console.pages.dev, --branch=main, lightweight invite gate 활성 유지)
- Production console Check State PASS:
  · version=WS3_v0.28.0_candidate_dry_run
  · persistenceAvailable=true
  · canaryEnabled=false
  · alreadySent=false
  · cleanupRequired=false
  · circuitOpen=false
  · currentPhase=RESET_CONFIRMED
- /candidate-dry-run actual read-only call PASS (1회):
  · exchange=upbit / market=KRW-BTC / timeframe=5m / limit=60
  · code=CANDIDATE_DRY_RUN_OK / mode=CANDIDATE_DRY_RUN_ONLY
  · candleCount=60 / latestTime=2026-05-19T06:00:00Z
  · lastClose=114446000 / changePct=-0.02795296912943972
  · volumeRatio=0.22896266841376825 / volumeAccel=0.37174385029772017
  · closePosition=0.20454545454545456 / upperWickPct=0.0017470453096201047 / rangePct=0.03843499681164231
  · score=0 / grade=P-C / reasonChips=LOW_VOLUME / isCandidate=false
- safety flags 모두 false: telegramSent / kvWritten / candidateStored / trackingStarted
- Send Canary count: 0 / Cleanup Confirm count: 0 / Operator Reset count: 0 / Live Preflight extra calls: 0
- Telegram API calls: 0 / KV writes: 0
- CANARY_ENABLED=false maintained / AUTHORIZED_AT=0 maintained
- WS3_CANARY_ALLOWED_ORIGINS = https://ws3-canary-console.pages.dev (Pages-only) 유지
- 결과 판정: 후보 아님 (현재 KRW-BTC 5m 상태 — volumeRatio < 0.5 → LOW_VOLUME chip / score 0 / grade P-C). dry-run 계산이 정상 작동 — 알람 실패가 아니라 정상 분류 결과 (false alarm 방지 동작 검증).
- raw exchange full response: not recorded
- Invoke Token: not recorded / KV namespace ID: not recorded
- raw invite code / SHA-256 hash: not recorded (placeholder repo 박제 유지, 노출된 폐기 hash repo-wide 매치 0건)
- deployment ID 전체값: not recorded (Version ID 단편만)
- Gate 진행 흐름: Step A (preflight sanity) → Step B (Worker redeploy) → Step C (hash reuse) → Step D (.tmp_pages_deploy 생성) → Step E (assignment line 1건만 hash 교체, line 301) → Step F (Pages deploy --branch=main) → Step G (temp cleanup + 검증) → Step H (사용자 Check State PASS) → Step I (사용자 Candidate Dry-run 1회 PASS, KRW-BTC 5m → P-C / LOW_VOLUME)
- 본 검증 한계 (재인용): 1 isolate / 1 사용자 / 1 market (upbit KRW-BTC 5m / limit 60) / 단일 timeframe / 단일 시점 범위. 활발한 시장 / surge 시점 / 다른 exchange / 다른 timeframe / 비정상 candle / rate limit / partial data 는 본 검증 범위 밖. score 산식 = 초기 dry-run 공식, v0.29+ 백테스트 결과로 조정 가능.

Next:
v0.29 candidate:
  - 후보 A: Multi-market Candidate Dry-run (predefined small list, Telegram·KV 0건)
  - 후보 B: Candidate Dry-run result history in UI (browser memory-only, 저장 없음)
  - 후보 C: Security Hardening Before Live Candidate Alert (Cloudflare Access 재검토 / invoke token rotation / origin allowlist 재검토)
```

## v0.28.0 핵심 메모

```text
- workers/ws3-telegram-canary-worker.js 1336 → 1718 라인 (+382 보강, 신규 require 0건, 모두 인라인)
- web/ws3-canary-console.html 791 → 990 라인 (+199)
- web/ws3-canary-console/index.html 791 → 990 라인 (byte-for-byte mirror 유지, 33380 → 45836 bytes)
- 신규 산출: /docs/ws3/WS3_v0_28_0_CANDIDATE_DRY_RUN_REPORT.md (18 sections)
- v0.28 의 핵심: 실코인 자동 알람 아님 / 실코인 데이터 기반 후보 계산 dry-run.
- 신규 엔드포인트: POST /candidate-dry-run
  · OPTIONS allowlist 확장: /candidate-dry-run 추가
  · 인증 3중: Origin allowlist + X-WS3-Canary-Token + manualTrigger (v0.27 와 동일 layer 재사용)
  · KV / circuit / persistent guard 미사용 (read-only)
- input 검증:
  · exchange = ['upbit', 'bithumb', 'binance'] (v0.27 와 동일)
  · market = ^[A-Za-z0-9_\-]{2,32}$ (v0.27 와 동일)
  · timeframe = ['1m', '5m', '15m', '1h'] (v0.27 와 동일)
  · limit = integer in [1, 120] (v0.27 60 → 120 상향, feature 계산용 데이터 폭)
- v0.27 helper 재사용 (인라인 호출):
  · buildLivePreflightUrl(exchange, market, timeframe, limit) — upbit/bithumb/binance URL 패턴
  · fetchLiveCandles(deps, url, 5000) — 5s AbortController timeout
  · normalizeCandles(exchange, raw, limit) — uniform OHLCV oldest→latest
  · mapFetchCodeToCandidateDryRunCode 가 LIVE_PREFLIGHT_* → CANDIDATE_DRY_RUN_* 매핑
- 신규 헬퍼 (인라인):
  · safeDivide(num, den, fallback) — typeof+isFinite+den!==0 보호, NaN/Infinity 반환 0건
  · validateCandidateDryRunRequest
  · calculateCandleStructureFeatures: 13 fields (candleCount/latestTime/lastOpen,High,Low,Close/prevClose/changePct/bodyPct/upperWickPct/lowerWickPct/closePosition/rangePct)
  · calculateVolumeFeatures: 4 fields (lastVolume/avgVolume/volumeRatio/volumeAccel) — volumeAccel = n>=13 일 때만 계산
  · calculateMomentumFeatures: 4 fields (shortMomentumPct/midMomentumPct/highBreakProximity/lowBreakRisk)
  · calculateCandidateDryRunScore: 0..100 clamp + reason chips max 8
  · classifyCandidateDryRunGrade: P-S(>=75) / P-A(>=60) / P-B(>=45) / P-C(<45)
  · buildCandidateDryRunResponse: whitelist 응답 합성
- score 산식 (초기 dry-run, 실 환경 백테스트 결과로 v0.29+ 조정 가능):
  · volumeRatio gate: 3.0/2.0/1.5/1.2 thresholds, surge chip
  · changePct gate: 3.0/1.5/0.5 thresholds
  · closePosition gate: 0.8/0.6/0.4 thresholds
  · shortMomentumPct*100 gate: 2.0/1.0/0.3 thresholds
  · upperWick risk: -15 (upperWickPct >= bodyPct*2 AND closePosition < 0.6)
  · wide range risk: -10 (rangePct >= 8)
- response whitelist:
  · top-level: ok / status / code / httpStatus / version / mode (=CANDIDATE_DRY_RUN_ONLY) / exchange / market / timeframe / limit
  · features (14): candleCount / latestTime / lastClose / changePct / bodyPct / upperWickPct / lowerWickPct / closePosition / rangePct / lastVolume / avgVolume / volumeRatio / volumeAccel / shortMomentumPct / midMomentumPct
  · dryRun (4): score / grade / reasonChips / isCandidate
  · safety (4): telegramSent / kvWritten / candidateStored / trackingStarted 모두 false 고정
- response 금지: raw exchange native field (candle_date_time_kst / opening_price / candle_acc_trade_price 등) / token / secret / chatId / bot_token / KV namespace ID / Telegram message_id / full headers / stack trace / 매수 추천 문구 / 수익 보장 문구
- 신규 safe code 11종: CANDIDATE_DRY_RUN_OK 200 / INVALID_EXCHANGE 400 / INVALID_MARKET 400 / INVALID_TIMEFRAME 400 / LIMIT_EXCEEDED 400 / FETCH_TIMEOUT 504 / NETWORK_ERROR 502 / PARSE_ERROR 502 / EMPTY_CANDLES 502 / UNSUPPORTED_SOURCE 400 / FEATURE_ERROR 500
- no-write 구조 보장 (handler scope grep):
  · writeAlreadySent / writeCleanupRequired / writeCircuit / writeInvokeFail / writeOperatorReset / markAlreadySentReset / env[ — 매치 0건
  · sendCanary / dispatchCanary / sendMessage — 매치 0건
  · KV binding 자체 미참조
- Web Console UI Section 7 "Candidate Dry-run (v0.28 read-only)":
  · Exchange select (upbit default) / Market text (KRW-BTC default) / Timeframe select (5m default) / Limit (60 default, max 120)
  · Run Candidate Dry-run 버튼 (1.5초 throttle, 클릭시에만 1회 fetch)
  · 결과 panel whitelist 22 fields
  · auto refresh 0건 / 페이지 로드 시 자동 호출 0건
  · token readTokenAndClear() 즉시 클리어
  · client-side sanitize: market 정규식 + limit ^[0-9]{1,3}$ → parseInt → [1, 120]
- mock smoke 21/21 PASS (spec 20 + 추가 parse error):
  · S1-S6 입력 검증 6종
  · S7 mocked success (candleCount=60, score finite, grade 분류, safety 4 false)
  · S8 empty / S9 network / S10 timeout / S10b parse error
  · S11 features 14 fields all finite
  · S12 score [0, 100] clamp / S13 grade enum / S14 chips ≤ 8
  · S15 Telegram fetch 0 / S16 KV put/delete 0
  · S17 raw exchange field leak CLEAN / S18 token leak CLEAN
  · S19 candidateStored=false / S20 trackingStarted=false
- 보호 파일 (worker.js + wrangler.toml + index.html + manifest.json + service-worker.js + v3/ 25종 + WS3_CODE_CONTRACT.md + WS3_WORKFLOW_TEMPLATE.md + workers/ws3-canary-state-kv-adapter.js + wrangler-canary.example.toml + .gitignore) diff 0건
- 미스테이지 유지: workers/ws3-telegram-canary-entry.mjs / wrangler-canary.toml / .claude/ / .wrangler/ / .tmp_canary_* / .tmp_pages_deploy/ / smoke 임시 파일 검증 직후 즉시 삭제
- Cloudflare 변경 0건 (worker 재배포 / Pages 재배포 / KV namespace 생성·변경 / allowed origins 변경 / secrets 변경 모두 0건)
- 실 호출 0건 (/candidate-dry-run production/staging / 실 거래소 API / Telegram API / KV write 모두 0건)
- 다음 후보:
  · v0.28 Deploy Gate (별도, Worker redeploy + Pages redeploy + /candidate-dry-run 실 호출 검증)
  · v0.29 후보 A: Basic Multi-market Dry-run (predefined small list, Telegram·KV 0건)
  · v0.29 후보 B: Candidate Dry-run result history in UI (browser memory-only, 저장 없음)
  · v0.29 후보 C: Security hardening before live candidate alert (Cloudflare Access 재검토 / invoke token rotation / origin allowlist 재검토)
  · worker /state response 자체에서 resetCount 제거 (v0.29+)
  · env-based CANDIDATE_DRY_RUN_DISABLED kill switch
  · rate limit per origin / market / minute
- v0.28 한계: mock smoke only. real 거래소 응답 다양성 (rate limit / partial data / market suspension / 비정상 candle / 분모 0) 은 별도 staging Gate. score 산식은 초기 dry-run 공식이며 실 환경 백테스트 결과로 v0.29+ 조정 가능.
```

## v0.27.0 Live Validation Success (실 Cloudflare 검증 박제)

```text
v0.27.0 Live Validation Success:
- Worker deploy: completed (Version single fragment 19f89bf6, size 136.03 KiB / gzip 21.71 KiB)
- Pages deploy: completed (production URL ws3-canary-console.pages.dev, --branch=main, lightweight invite gate 활성 유지)
- Production console Check State PASS:
  · version=WS3_v0.27.0_actual_coin_live_preflight
  · persistenceAvailable=true
  · canaryEnabled=false
  · alreadySent=false
  · cleanupRequired=false
  · circuitOpen=false
  · currentPhase=RESET_CONFIRMED
- /live-preflight actual read-only call PASS (1회):
  · exchange=upbit / market=KRW-BTC / timeframe=5m / limit=30
  · code=LIVE_PREFLIGHT_OK / mode=LIVE_PREFLIGHT_ONLY
  · candleCount=30 / latestTime=2026-05-18T16:35:00Z
  · lastClose=113892000 / changePct=0.11075365223353198 / volumeRatio=0.2566780720123906
- safety flags 모두 false: telegramSent / kvWritten / candidateStored / trackingStarted
- Send Canary count: 0 / Cleanup Confirm count: 0 / Operator Reset count: 0
- Telegram API calls: 0 / KV writes: 0
- CANARY_ENABLED=false maintained / AUTHORIZED_AT=0 maintained
- WS3_CANARY_ALLOWED_ORIGINS = https://ws3-canary-console.pages.dev (Pages-only) 유지
- raw exchange full response (candle_date_time_kst / opening_price / candle_acc_trade_price 등): not recorded
- Invoke Token: not recorded / KV namespace ID: not recorded
- raw invite code / SHA-256 hash: not recorded (placeholder repo 박제 유지, git grep repo-wide 노출 폐기 hash 매치 0건)
- deployment ID 전체값: not recorded (Version ID 단편만)
- Gate 진행 흐름: Step A (preflight sanity) → Step B (Worker redeploy) → Step C (hash reuse) → Step D (.tmp_pages_deploy 생성) → Step E (assignment line 1건만 hash 교체) → Step F (Pages deploy --branch=main) → Step G (temp cleanup + 검증) → Step H (사용자 Check State PASS) → Step I (사용자 Live Preflight 1회 PASS)
- 본 검증 한계 (재인용): 1 isolate / 1 사용자 / 1 market (upbit KRW-BTC 5m) 범위. 다른 exchange (bithumb / binance) / 다른 timeframe / 다른 limit / rate limit 응답 / partial data / market suspension / DNS 차단은 본 검증 범위 밖.

Next:
v0.28 candidate:
  - 후보 A: basic candle structure preview
  - 후보 B: Actual Coin Candidate Dry-run (계산만, Telegram/KV 0건)
  - 후보 C: Security hardening before live coin stage (Cloudflare Access 재검토 / invoke token rotation / origin allowlist 재검토)
```

## v0.27.0 핵심 메모

```text
- workers/ws3-telegram-canary-worker.js 943 → 1336 라인 (+393 보강, 신규 require 0건, 모두 인라인)
- web/ws3-canary-console.html 641 → 791 라인 (+150)
- web/ws3-canary-console/index.html 641 → 791 라인 (byte-for-byte mirror 유지, 25087 → 33380 bytes)
- 신규 산출: /docs/ws3/WS3_v0_27_0_ACTUAL_COIN_LIVE_PREFLIGHT_REPORT.md (19 sections)
- v0.27 의 핵심: 실코인 자동 알람 아님 / read-only live data preflight layer.
- 신규 엔드포인트: POST /live-preflight
  · OPTIONS allowlist 확장: /live-preflight 추가
  · 인증 3중: Origin allowlist + X-WS3-Canary-Token + manualTrigger
  · KV / circuit / persistent guard 미사용 (read-only)
- input 검증:
  · exchange = ['upbit', 'bithumb', 'binance'] (lowercase 정규화)
  · market = ^[A-Za-z0-9_\-]{2,32}$ (exchange-native 형식: upbit=KRW-BTC / bithumb=BTC_KRW / binance=BTCUSDT)
  · timeframe = ['1m', '5m', '15m', '1h']
  · limit = integer in [1, 60]
- exchange URL 매핑:
  · upbit: https://api.upbit.com/v1/candles/minutes/{unit}?market={...}&count={limit} (unit=1/5/15/60)
  · bithumb: https://api.bithumb.com/public/candlestick/{market}/{interval} (interval=1m/5m/15m/1h)
  · binance: https://api.binance.com/api/v3/klines?symbol={market}&interval={1m/5m/15m/1h}&limit={limit}
- normalize: raw → uniform [{ time(ISO Z), open, high, low, close, volume }] (oldest → latest)
  · upbit latest-first → reverse / bithumb 6-tuple [ts_ms, open, close, high, low, volume] / binance kline 배열
  · 모든 필드 Number + isFinite 검증, invalid → LIVE_PREFLIGHT_PARSE_ERROR
  · 빈 배열 → LIVE_PREFLIGHT_EMPTY_CANDLES
- summarize 출력 필드: candleCount / latestTime / lastClose / prevClose / changePct / lastVolume / avgVolume / volumeRatio
  · prevClose fallback (n<2): candles[n-1].open
  · changePct=0 (prevClose=0 일 때) / volumeRatio=0 (avgVolume=0 일 때)
- response whitelist 17 fields: ok / status / code / httpStatus / version / mode (=LIVE_PREFLIGHT_ONLY) / exchange / market / timeframe / limit / normalized.{8} / safety.{telegramSent, kvWritten, candidateStored, trackingStarted} 모두 false 고정
- response 금지: raw exchange native field (candle_date_time_kst / opening_price / candle_acc_trade_price 등) / token / secret / chatId / bot_token / KV namespace ID / Telegram message_id / full headers / stack trace / internal exception
- 신규 safe code 11종: LIVE_PREFLIGHT_OK 200 / DISABLED (예약) / INVALID_EXCHANGE 400 / INVALID_MARKET 400 / INVALID_TIMEFRAME 400 / LIMIT_EXCEEDED 400 / FETCH_TIMEOUT 504 / NETWORK_ERROR 502 / PARSE_ERROR 502 / EMPTY_CANDLES 502 / UNSUPPORTED_SOURCE 400
- fetch: 5초 timeout (AbortController) / buildWorkerRuntimeDeps 기존 deps 패턴 재사용 (fetchImpl / AbortControllerImpl / setTimeoutImpl / clearTimeoutImpl)
- no-write 구조 보장 (handler scope grep):
  · writeAlreadySent / writeCleanupRequired / writeCircuit / writeInvokeFail / writeOperatorReset / markAlreadySentReset / KV_BINDING_NAME / env[ — 매치 0건
  · sendCanary / dispatchCanary / sendMessage — 매치 0건
  · "Telegram" 키워드 — 핸들러 코멘트 헤더 1줄만 (정책 부정문맥 "NO Telegram, NO KV write, NO candidate store")
- Web Console UI Section 6 "Live Preflight (v0.27 read-only)":
  · Exchange select (upbit default) / Market text (KRW-BTC default) / Timeframe select (5m default) / Limit (30 default)
  · Run Live Preflight 버튼 (1.5초 throttle, 클릭시에만 1회 fetch)
  · 결과 panel whitelist 12 fields (code / exchange / market / timeframe / candleCount / latestTime / lastClose / changePct / volumeRatio / mode / telegramSent / kvWritten)
  · auto refresh 0건 / 페이지 로드 시 자동 호출 0건
  · token readTokenAndClear() 즉시 클리어
  · client-side sanitize: market 정규식 + limit ^[0-9]{1,2}$ → parseInt → [1, 60]
- mock smoke 16/16 PASS:
  · S1 no token → 401 / S2 bad token → 403 / S3 no manualTrigger → 400
  · S4-S7 input 검증 4종 → 400
  · S8 upbit mocked success → 200 (candleCount=30 / safety 4 fields 모두 false)
  · S9 empty → 502 / S10 network → 502 / S11 timeout (AbortError) → 504 / S12 parse → 502
  · S13 Telegram fetch count 0 / S14 KV put/delete count 0
  · S15 raw exchange native field leak guard CLEAN / S16 invoke token leak guard CLEAN
- 보호 파일 (worker.js + wrangler.toml + index.html + manifest.json + service-worker.js + v3/ 25종 + WS3_CODE_CONTRACT.md + WS3_WORKFLOW_TEMPLATE.md + workers/ws3-canary-state-kv-adapter.js + wrangler-canary.example.toml + .gitignore) diff 0건
- 미스테이지 유지: workers/ws3-telegram-canary-entry.mjs / wrangler-canary.toml / .claude/ / .wrangler/ / .tmp_canary_*
- Cloudflare 변경 0건 (worker 재배포 / Pages 배포 / KV namespace 생성·변경 / allowed origins 변경 / secrets 변경 모두 0건)
- 실 호출 0건 (/live-preflight production/staging / 실 거래소 API / Telegram API / KV write 모두 0건)
- 다음 후보:
  · v0.27 Deploy Gate (별도, Worker redeploy + /live-preflight 실 호출 검증)
  · v0.28 후보 A: candle structure preview
  · v0.28 후보 B: candidate dry-run (계산만, Telegram/KV 0건)
  · v0.28 후보 C: security hardening (Cloudflare Access 재검토 / invoke token rotation / origin allowlist 재검토)
  · worker /state response 자체에서 resetCount 제거 (v0.28+)
  · env-based LIVE_PREFLIGHT_DISABLED kill switch
  · rate limit per origin / market / minute
- v0.27 한계: mock smoke only. real 거래소 응답 다양성 (rate limit / partial data / market suspension) 은 별도 staging Gate 에서 검증. limit ≤ 60 / single market 으로 abuse 위험 최소화.
```

## v0.26.1 Pages Deploy Success (실 Cloudflare 검증 박제)

```text
v0.26.1 Pages Deploy Success:
- Pages project: ws3-canary-console
- Production URL: ws3-canary-console.pages.dev (active)
- Lightweight invite gate: active (placeholder → 실 SHA-256 hash working copy 1회 substitution → Pages deploy)
- Cloudflare Access: deferred by user decision (production-grade 운영 / 실코인 연결 전 재검토)
- Worker allowlist (Phase 2 최종): https://ws3-canary-console.pages.dev only
- localhost origin: removed (Step F)
- final production Check State PASS:
  · version=WS3_v0.25.0_operator_reset_state_lifecycle
  · persistenceAvailable=true
  · canaryEnabled=false
  · alreadySent=false
  · cleanupRequired=false
  · circuitOpen=false
  · currentPhase=RESET_CONFIRMED
- Send Canary count: 0 / Cleanup Confirm count: 0 / Operator Reset count: 0
- Telegram API calls: 0 / KV writes: 0
- CANARY_ENABLED=false maintained / AUTHORIZED_AT=0 maintained
- raw invite code: not recorded (사용자 본인 vault 외 0건)
- SHA-256 hash: not committed (placeholder REPLACE_WITH_INVITE_CODE_SHA256 박제 유지, git grep repo-wide 매치 0건)
- Invoke Token: not recorded / KV namespace ID: not recorded
- Gate 진행 흐름: Step A (사용자 hash 생성) → Step B (branch alias deploy) → Step B' (production --branch=main corrective deploy) → Step C (사용자 invite gate UI 확인) → Step D (Worker allowlist Phase 1 확장 + redeploy) → Step E (사용자 Check State PASS) → Step F (localhost 제거 Phase 2 + redeploy) → Step G (사용자 final Check State PASS)
- 본 staging 한계 (재인용): client-side invite gate 우회 가능 (DOM/hash/network/공유). 실 worker action 은 Invoke Token + Origin allowlist + Worker server-side guard 필요.

Next:
v0.27 candidate: Actual Coin Live Preflight (실코인 데이터 preflight layer)
```

## v0.26.1 핵심 메모

```text
- web/ws3-canary-console.html 466 → 641 라인 (+175 보강)
- web/ws3-canary-console/index.html 466 → 641 라인 (byte-for-byte mirror 유지)
- 신규 산출: /docs/ws3/WS3_v0_26_1_DEV_PREVIEW_INVITE_GATE_REPORT.md (15 sections)
- v0.26.1 의 핵심: 실코인 연결 아님 / Cloudflare Access 단계 아님 / Dev Preview lightweight invite gate 단계.
- v0.26.0 정책 amendment:
  · Cloudflare Access 필수 → 보류 (production-grade 운영 / 실코인 연결 전 재검토)
  · Access 없는 public Pages 비채택 → Dev Preview 용도로 가능 (이번 단계 미실행)
  · Console 보호 → client-side invite gate
  · Worker action 보호 → 기존 Invoke Token + server-side guard 유지 (변경 0건)
- 변경 영향:
  · Layer 1 (UI 노출 차단): 약화 — Access (network-level identity verified) → client-side invite gate (DOM/hash/network 분석 가능)
  · Layer 2 (Invoke Token): 동일 유지
  · Layer 3 (Worker server-side guard, 7중 조건 등): 동일 유지
  · Telegram 발송 / KV write / operator-reset 위험은 본 amendment 가 높이지 않음
- invite gate 구조:
  · DOM: <section id="inviteGate"> always-visible + <main id="consoleApp" hidden> (기존 5-section)
  · placeholder hash 상수: var WS3_INVITE_CODE_SHA256 = 'REPLACE_WITH_INVITE_CODE_SHA256';
  · placeholder 감지: isPlaceholderHash (lowercase hex 64자 정규식 외 = placeholder)
  · SHA-256: window.crypto.subtle.digest('SHA-256', ...) → lowercase hex
  · 비교: constantTimeEqual (char XOR accumulation, native === 회피)
  · 5회/60초 throttle: counter/timestamp 메모리 only, 새로고침 reset
  · 통과 후: inviteGate.hidden=true / consoleApp.hidden=false + counter/throttle reset
  · 입력 즉시 클리어: inviteCodeInput.value='' (verifyInviteCode 진입 직후)
  · 초대코드 원문 변수 명시 해제: input = null
  · 통과 상태 storage 0건 → 새로고침 시 invite gate 재표시
- invite code commit 정책 (옵션 A):
  · placeholder 만 commit
  · 실 invite code 원문 / 실 SHA-256 hash 값 repo 박제 0건
  · Pages deploy 전 별도 Gate 에서 working copy only hash 교체 (commit 0건)
- client-side gate 한계 (재인용): DOM inspect 우회 / hash 추출 brute force / network 분석 / 초대코드 공유 — 모두 가능. 단 실 worker action 은 Invoke Token + Origin allowlist + server-side gate 필요.
- 완화책:
  · 16자 이상 랜덤 초대코드 권장
  · 짧은 단어 / 이름 / 생일 / 프로젝트명 금지
  · 유출 의심 시 hash 교체 + Pages redeploy
  · Invoke Token 절대 공유 금지
  · CANARY_ENABLED=false 유지
- token / invite 입력 보안:
  · input type=password / autocomplete=off / autocorrect=off / autocapitalize=off / spellcheck=false
  · data-1p-ignore / data-bwignore / data-lpignore
  · maxlength=128
  · localStorage / sessionStorage / IndexedDB / document.cookie 호출 0건
  · URL query parameter token/invite code 전달 0건
  · console.log 출력 0건
- 정적 검증:
  · storage API 호출 0건 (grep 매치 4건 모두 정책 부정문맥)
  · resetCount DOM set 0건 (grep 매치 6건 모두 footnote/warn/주석)
  · placeholder 정상 존재 (grep 매치 12건)
  · secret 실 값 0건
  · 두 파일 byte-for-byte diff 0건 (25087 bytes / 641 라인 일치)
  · embedded <script> 블록 2개 (4428 + 11257 chars) Node parse OK
- 보호 파일 (worker.js + wrangler.toml + index.html + manifest.json + service-worker.js + v3/ 25종 + WS3_CODE_CONTRACT.md + WS3_WORKFLOW_TEMPLATE.md + workers/ws3-telegram-canary-worker.js + workers/ws3-canary-state-kv-adapter.js + wrangler-canary.example.toml + .gitignore) diff 0건
- 미스테이지 유지: workers/ws3-telegram-canary-entry.mjs / wrangler-canary.toml / .claude/ / .wrangler/ / .tmp_canary_*
- Cloudflare 변경 0건 (Access 설정 0건 / Zero Trust 설정 0건 / Pages deploy 0건 / Worker 재배포 0건 / WS3_CANARY_ALLOWED_ORIGINS 변경 0건 / secrets 변경 0건)
- 실 호출 0건 (/state / /send-canary / /cleanup-confirm / /operator-reset 모두 0건) / 실 Telegram API 0건 / 실 KV write 0건
- Pages deploy 전 절차 (별도 Gate):
  · 사용자가 실 invite code 결정 (외부, 채팅 노출 금지)
  · SHA-256 hash 생성
  · HTML placeholder → 실 hash 교체 (working copy only)
  · commit 0건
  · Pages deploy
  · Pages origin Worker allowlist 추가 결정 (별도 Step)
  · localhost 제거 결정 (별도 Step)
- v0.27 진입 전 보안 재평가 권장:
  · Cloudflare Access 재적용 여부
  · invite gate 유지 / Access 동시 적용 여부
  · 실코인 연결 시 page-level 보호 강화 필요 여부
  · invoke token rotation 여부
  · origin allowlist 정책 (production-only)
- 다음 후보:
  · v0.26 Production Pages Deploy Gate (별도, invite hash 교체 + Pages deploy)
  · v0.26.x: build script / shared source 도입 (두 파일 자동 동기화)
  · v0.27: Actual Coin Live Preflight (실코인 데이터 preflight layer)
  · v0.28+: Snapshot / Evaluation / Audit KV write boundary
  · worker /state response 자체에서 resetCount 제거 (v0.27+)
  · env-based resetPhrase / circuit reset endpoint / failure counter reset endpoint
  · invoke token rotate automation / ipHash + WS3_CANARY_HASH_SALT
```

## v0.26.0 핵심 메모

```text
- web/ws3-canary-console.html 158 → 466 라인 (+308 보강)
- web/ws3-canary-console/index.html 신규 (466 라인, byte-for-byte mirror of staging file)
- 신규 산출: /docs/ws3/WS3_v0_26_0_PRODUCTION_WEB_CONSOLE_HOSTING_REPORT.md (15 sections)
- v0.26 의 핵심: 실코인 연결 아님. local-only Web Console → production-safe static hosting 구조 정리.
- 4 핵심 정책 박제 (실 적용은 별도 deploy Gate):
  1. Cloudflare Access 필수 (Self-hosted + Email allowlist + Email OTP/SSO). 운영자 email 만 허용. Access 없는 public Pages 비채택.
  2. localhost allowlist 2-phase. Phase 1 (production 검증 중) = http://localhost:8788 + Pages origin. Phase 2 (production 안정 후) = Pages origin only. localhost 영구 유지 금지, staging 종료 직후 제거.
  3. /state UI 표시 정책. UI 허용 8 fields: ok/version/canaryEnabled/persistenceAvailable/alreadySent/cleanupRequired/circuitOpen/currentPhase. UI 금지: resetCount/lastResetAt/sentAt/blockedUntil/failureCount/Telegram message_id/raw response/token/chatId/Origin 실제 값/IP/KV namespace ID.
  4. 파일 구조. web/ws3-canary-console.html (staging 호환) + web/ws3-canary-console/index.html (production entrypoint). v0.26 에서는 byte-for-byte 동일. build script / shared source 는 v0.26.x 후보.
- Web Console UI 5-section 구조:
  · Section 1 Configuration (Worker Endpoint / Invoke Token)
  · Section 2 Status (Check State 버튼 + 7-field panel)
  · Section 3 Controlled Operation (Cleanup Confirm, cleanupRequired-gated)
  · Section 4 Danger Zone (Send Canary / Reset Phrase / Operator Reset, border + warn + danger class 시각 분리)
  · Section 5 Safe Result (code/httpStatus/messageType/fixedMessageUsed whitelist 4 fields)
- UI 버튼 활성화 정책 (보조 안전장치, 최종 판단은 worker server-side):
  · Check State: token 입력 후
  · Send Canary: persistenceAvailable + canaryEnabled=true + alreadySent=false + cleanupRequired=false + circuitOpen=false
  · Cleanup Confirm: cleanupRequired=true
  · Operator Reset: canaryEnabled=false + alreadySent=true + cleanupRequired=false + circuitOpen=false + phrase exact ("RESET_WS3_CANARY_STATE" byte-for-byte)
- token 입력 보안:
  · input type=password / autocomplete=off / autocorrect=off / autocapitalize=off / spellcheck=false
  · data-1p-ignore / data-bwignore / data-lpignore (password manager 무시)
  · maxlength=128
  · localStorage / sessionStorage / IndexedDB / document.cookie 호출 0건
  · URL query parameter token 전달 0건
  · console.log(token) 0건
  · readTokenAndClear() 패턴: 각 요청 시점 로컬 변수 1회 사용 후 tokenEl.value='' 즉시 클리어
  · Reset Phrase 도 응답 도착 직후 resetPhraseEl.value='' 즉시 클리어
- fetch 옵션 일관 (모든 endpoint): mode='cors' / credentials='omit' / cache='no-store' / redirect='error'
- meta-level: robots=noindex,nofollow,noarchive / X-Content-Type-Options=nosniff / Referrer-Policy=no-referrer
- mobile viewport CSS: input/button min-height 44px / button min-width 120px / @media (max-width 420px) button { width 100% } / 가로 스크롤 없음 (max-width 520px + box-sizing border-box)
- 정적 검증:
  · localStorage/sessionStorage/IndexedDB/document.cookie 호출 0건 (매치 2건은 모두 정책 부정문맥)
  · resetCount DOM set 0건 (매치 6건은 모두 정책 footnote / Danger Zone warn / 코드 주석)
  · bot_token/chat_id/message_id 실 값 노출 0건
  · diff -q 결과 두 파일 0건 (18422 bytes / 466 라인 일치)
  · embedded <script> 11257 chars Node parse 통과
- 보호 파일 (worker.js + wrangler.toml + index.html + manifest.json + service-worker.js + v3/ 25종 + WS3_CODE_CONTRACT.md + WS3_WORKFLOW_TEMPLATE.md + workers/ws3-telegram-canary-worker.js + workers/ws3-canary-state-kv-adapter.js + wrangler-canary.example.toml + .gitignore) diff 0건
- 미스테이지 유지: workers/ws3-telegram-canary-entry.mjs / wrangler-canary.toml / .claude/ / .wrangler/ / .tmp_canary_*
- Cloudflare 변경 0건 (Pages project 생성 0건 / Access 정책 0건 / Pages deploy 0건 / worker 재배포 0건 / WS3_CANARY_ALLOWED_ORIGINS 변경 0건 / secrets 변경 0건)
- 실 호출 0건 (/state / /send-canary / /cleanup-confirm / /operator-reset 모두 0건) / 실 Telegram API 호출 0건 / 실 KV write 0건
- production deploy 순서 박제 (실 실행은 별도 Gate):
  · Step 1 Cloudflare Pages project 생성
  · Step 2 Cloudflare Access 정책 설정 (Email allowlist + OTP/SSO)
  · Step 3 Pages deploy (Build output: web/ws3-canary-console/)
  · Step 4 WS3_CANARY_ALLOWED_ORIGINS 임시 추가 (Phase 1)
  · Step 5 Worker redeploy
  · Step 6 production console Check State 만 검증 (Send Canary / Cleanup Confirm / Operator Reset 클릭 0건)
  · Step 7 production 안정 후 localhost 제거 + Worker redeploy (Phase 2)
- 다음 후보:
  · v0.26 production deploy Gate (별도 Cloudflare Pages 생성 / Access / allowlist / Worker redeploy)
  · v0.26.x: build script / shared source 도입 (두 파일 자동 동기화)
  · v0.27+: Actual Coin Live Preflight / Durable Objects strict one-time guarantee
  · v0.28+: Snapshot / Evaluation / Audit KV write boundary
  · worker /state response 자체에서 resetCount 제거 (v0.27+, 현재는 UI 비노출만)
  · env-based resetPhrase / circuit reset endpoint / failure counter reset endpoint
  · invoke token rotate automation / ipHash + WS3_CANARY_HASH_SALT
```

## v0.25.0 Staging Success (실 Cloudflare 검증 박제)

```text
v0.25.0 actual staging result:
- Cloudflare worker version: WS3_v0.25.0_operator_reset_state_lifecycle
- /operator-reset staging succeeded (1회 한정 KV write, Cloudflare 재배포 1회)
- pre-reset phase: OPERATOR_RESETTABLE (alreadySent=true / cleanupRequired=false / resetCount=0)
- reset result: OPERATOR_RESET_CONFIRMED / 200
- post-reset phase: RESET_CONFIRMED (alreadySent=false / cleanupRequired=false / resetCount=1 / canaryEnabled=false / persistenceAvailable=true / circuitOpen=false)
- alreadySent true → false 전환 성공
- cleanupRequired=false 유지 (reset 이 cleanup record 수정 0건)
- resetCount 0 → 1 증가
- Telegram sends during reset gate: 0
- Send Canary during reset gate: 0
- CANARY_ENABLED=false maintained
- secret / token / chatId / KV namespace ID / raw Telegram response / message_id — 채팅 / 보고서 / 로그 노출 0건
- 본 staging 한계 (재인용): 1 isolate / 1 사용자 시퀀스 범위. real Cloudflare KV (eventually consistent) 다중 isolate race 는 본 검증 범위 밖. production-grade strict one-time guarantee 는 v0.27+ Durable Objects / D1 transaction.

Next:
v0.26 candidate: Production Web Console Hosting (localhost:8788 외 production origin)
```

## v0.25.0 핵심 메모

```text
- workers/ws3-telegram-canary-worker.js v0.23.0 → v0.25.0 (737 → 943 라인, +206)
- workers/ws3-canary-state-kv-adapter.js v0.23.0 → v0.25.0 (276 → 360 라인, +84)
- 신규 산출: /docs/ws3/WS3_v0_25_0_OPERATOR_RESET_STATE_LIFECYCLE_REPORT.md (17 sections)
- 신규 엔드포인트: POST /operator-reset — alreadySent=true 잠금을 안전하게 재테스트 가능 상태로 되돌림
- 가드: 7중 조건 + circuit 차단 + 60s cooldown
  1. Origin allowlist (ORIGIN_MISSING / ORIGIN_NOT_ALLOWED)
  2. X-WS3-Canary-Token exact (MISSING_INVOKE_TOKEN / INVOKE_TOKEN_MISMATCH)
  3. body.manualTrigger === true (MANUAL_TRIGGER_REQUIRED)
  4. body.resetPhrase === 'RESET_WS3_CANARY_STATE' byte-for-byte (RESET_PHRASE_MISMATCH)
  5. env.WS3_TELEGRAM_CANARY_ENABLED === 'false' (RESET_REQUIRES_CANARY_DISABLED)
  6. KV cleanupRequired === false (RESET_REQUIRES_CLEANUP_CONFIRMED)
  7. KV persistenceAvailable === true (PERSISTENCE_UNAVAILABLE)
  +1. KV circuitOpen === false (CIRCUIT_OPEN_RESET_BLOCKED)
  +2. lastResetAt 기준 60s 이내 재-reset 차단 (RESET_COOLDOWN_ACTIVE) — idempotent NO_RESET_REQUIRED 에는 적용 X
- 성공 시 KV write 2개:
  · ws3:canary:alreadySent → alreadySent=false 전환 + sentAt audit 보존
  · ws3:canary:operatorReset → resetCount +1 + lastResetAt=nowMs + lastResetReason='OPERATOR_RESET_CONFIRMED'
- idempotent: alreadySent=false 상태 reset → NO_RESET_REQUIRED 200 (KV 변경 0건 / resetCount 증가 X / cooldown 적용 X)
- /state 응답 8 → 10 fields whitelist:
  · 신규: currentPhase (computeCurrentPhase 계산) / resetCount (operatorReset KV 값)
  · 여전히 출력 금지: lastResetAt / sentAt / blockedUntil / failureCount / message_id / token / chatId / Origin 실제 값 / IP
- currentPhase 9-phase enum (first-match-wins):
  · PERSISTENCE_UNAVAILABLE / CIRCUIT_OPEN / CLEANUP_REQUIRED / LOCKED_ALREADY_SENT / OPERATOR_RESETTABLE / RESET_CONFIRMED / READY
- KV schemaVersion='v1' 유지 (v0.23 → v0.25 backward-compatible, resetCount default 0 / lastResetAt default null)
- resetPhrase 정책: hardcoded 상수 'RESET_WS3_CANARY_STATE', env override 0건, trim 0건, 대소문자/공백/개행 byte 단위 차단, KV 저장 0건 (smoke S17)
- 신규 safe code 8종:
  · OPERATOR_RESET_CONFIRMED 200 / NO_RESET_REQUIRED 200
  · RESET_PHRASE_MISMATCH 403 / RESET_PRECONDITION_FAILED 409
  · RESET_REQUIRES_CANARY_DISABLED 409 / RESET_REQUIRES_CLEANUP_CONFIRMED 409
  · RESET_COOLDOWN_ACTIVE 429 / CIRCUIT_OPEN_RESET_BLOCKED 503
- mock smoke 19/19 PASS:
  1. /state currentPhase=OPERATOR_RESETTABLE
  2. resetPhrase mismatch → 403
  3. manualTrigger=false → 400
  4. CANARY_ENABLED=true → 409
  5. cleanupRequired=true → 409
  6. circuitOpen=true → 503
  7. 정상 reset → 200
  8. reset 후 alreadySent=false + sentAt audit 보존
  9. reset 후 cleanupRequired 레코드 변경 0건
  10. resetCount 0→1 + schemaVersion='v1' + lastResetReason
  11. lastResetAt = nowMs
  12. 60s 이내 재-reset → 429
  13. alreadySent=false 상태 reset → NO_RESET_REQUIRED 200 (KV 변경 0건)
  14. reset 후 /state currentPhase=RESET_CONFIRMED + resetCount=1
  15. Telegram fetch 호출 0건
  16. token/chatId/invoke token leak 0건
  17. resetPhrase 원문 KV 저장 0건
  18. raw Telegram response leak 0건
  19. message_id leak 0건
- 보호 파일 (v3/ 25종 + worker.js + index.html + manifest.json + service-worker.js + WS3_CODE_CONTRACT.md + WS3_WORKFLOW_TEMPLATE.md + web/ws3-canary-console.html + wrangler-canary.example.toml + .gitignore) diff 0건
- Cloudflare 변경 0건 (worker 재배포 / KV namespace 생성·변경 / KV binding 변경 / secrets 변경 0건)
- 실 Telegram API 호출 0건 / 실 /operator-reset 호출 0건 (mock 만)
- 누출 검증: bot token / chatId / invoke token / KV namespace id / Telegram message_id / raw Telegram response / IP / cookie / session / browser fingerprint / masked preview / operator identity — 모두 0건
- 다음 후보:
  · v0.25 worker 재배포 (별도 staging gate)
  · /operator-reset 실 staging test (v0.24 잔존 alreadySent=true → 실 호출 → KV alreadySent=false 확인 → /state currentPhase=RESET_CONFIRMED 확인) 별도 gate
  · 재-canary staging test 별도 gate
  · v0.26: Production Web Console hosting
  · v0.27+: actual coin live preflight / Durable Objects / D1 strict one-time guarantee
  · env-based resetPhrase / circuit reset endpoint / failure counter reset endpoint
  · invoke token rotate automation / ipHash + WS3_CANARY_HASH_SALT
```

## v0.24.0 핵심 메모

```text
- 운영 검증 Gate — 코드 변경 0건, 신규 docs 1건 (WS3_v0_24_0_PERSISTENT_GUARD_STAGING_VALIDATION_REPORT.md) + CHANGELOG/BASELINE 갱신
- v0.23 persistent guard 가 실제 Cloudflare KV 환경에서 의도대로 작동함을 1 isolate / 1 사용자 시퀀스 범위에서 검증
- 검증 9건 모두 PASS:
  1. 첫 Send Canary → 실제 Telegram 1회 수신 성공 (fixed 5-line message exact)
  2. KV ws3:canary:alreadySent schemaVersion='v1' / alreadySent=true 저장 확인
  3. KV ws3:canary:cleanupRequired schemaVersion='v1' / cleanupRequired=true / reason='LIVE_CANARY_SENT' 저장 확인
  4. 2차 Send Canary 시도 → ALREADY_SENT_PERSISTENT 409 차단 (Telegram 추가 발송 0건)
  5. Telegram 추가 수신 0건 충족
  6. /cleanup-confirm → CLEANUP_CONFIRMED 200 (Telegram 발송 0건)
  7. cleanup-confirm 후 cleanupRequired=false + lastCleanupAt=nowMs 갱신
  8. cleanup-confirm 후 alreadySent=true 유지 (cleanup-confirm 이 alreadySent reset 하지 않음)
  9. 최종 CANARY_ENABLED=false 복귀 + AUTHORIZED_AT=0 reset
- 최종 /state 8 fields whitelist: ok=true / service=WS3_CANARY_WEB_MVP / version=WS3_v0.23.0_persistent_canary_safety_guard / canaryEnabled=false / persistenceAvailable=true / alreadySent=true / cleanupRequired=false / circuitOpen=false
- 누출 검증: bot token / chatId / invoke token / KV namespace id / Telegram message_id / raw Telegram response / IP / cookie / session / browser fingerprint / masked preview — 모두 0건
- Cloudflare 변경: worker 재배포 0건 / KV namespace 생성·변경 0건 / KV binding 변경 0건 / secrets 변경 0건
- v0.23 strict-lock 한계 재확인 (r0.2-final):
  · 본 검증 = 1 isolate / 1 사용자 시퀀스 범위. mock KV (strong consistency) 와 동등 동작.
  · real Cloudflare KV (eventually consistent) 의 다중 isolate race 는 본 검증 범위 밖.
  · production-grade strict one-time guarantee 는 v0.27+ Durable Objects / D1 transaction / atomic lock.
- 보호 파일 (v3/ 25종 + worker.js + index.html + manifest.json + service-worker.js + WS3_CODE_CONTRACT.md + WS3_WORKFLOW_TEMPLATE.md + web/ws3-canary-console.html) diff 0건
- 다음 후보:
  · v0.25: alreadySent reset endpoint / production Web Console hosting
  · v0.26+: actual coin live preflight
  · v0.27+: Durable Objects / D1 strict one-time guarantee
  · invoke token rotate automation / ipHash + WS3_CANARY_HASH_SALT
```

## v0.23.0 핵심 메모

```text
- workers/ws3-canary-state-kv-adapter.js 신규 (276 라인) — canary 전용 KV CRUD safe adapter
- workers/ws3-telegram-canary-worker.js v0.22.1 → v0.23.0 (737 라인, +197) — persistent guard 통합
- wrangler-canary.example.toml 신규 (commit-safe placeholder) + .gitignore 신규 (canary local-only 보호)
- KV binding: WS3_CANARY_STATE_KV (canary 전용, 본선 KV namespace 와 공유 금지)
- KV prefix: ws3:canary: 만 허용 (INVALID_KV_KEY_PREFIX 차단)
- schemaVersion: 'v1' 강제 (SCHEMA_VERSION_MISMATCH 차단)
- hash: SHA-256 lowercase hex first 16 chars (INVALID_HASH_FORMAT 차단)
- 4 persistent guard: alreadySent / cleanupRequired / circuit / invokeFail (per-originHash)
- 신규 endpoint: GET /state (safe 8-field view) / POST /cleanup-confirm (manual ack, Telegram 발송 0건)
- 신규 safe code: PERSISTENCE_UNAVAILABLE / ALREADY_SENT_PERSISTENT / CANARY_CIRCUIT_OPEN_PERSISTENT / INVOKE_TOKEN_BLOCKED_TOO_MANY_FAILURES_PERSISTENT / CLEANUP_REQUIRED / NO_CLEANUP_REQUIRED / CLEANUP_CONFIRMED / INVALID_KV_KEY_PREFIX / SCHEMA_VERSION_MISMATCH / INVALID_HASH_FORMAT
- KV binding 없으면 send-canary fallback 금지 (PERSISTENCE_UNAVAILABLE). process memory fallback 0건.
- 본선 / 실코인 / Snapshot / Evaluation / Audit KV write 영구 금지. canary 전용 namespace 만.
- 실제 KV namespace ID 노출 0건 (commit / 채팅 / 보고서 / 로그 모두). example.toml 에는 placeholder 만.
- KV alreadySent 는 strict distributed lock 이 아님 (best effort persistent safety guard).
  · mock KV = strong consistency / real KV = eventually consistent → race 가능
  · strict one-time guarantee 는 v0.24+ Durable Objects / atomic lock / D1 transaction 에서 검토
- mock KV + mock fetch smoke 16 시나리오 전부 PASS (TOTAL=16 PASS=16 FAIL=0)
- 실제 Telegram API 호출 0건 / 실제 KV API 호출 0건 / Cloudflare deploy 0건 / KV namespace 생성 0건
- 보호 파일 (v3/ 25종 + worker.js + index.html + manifest.json + service-worker.js + WS3_CODE_CONTRACT.md + WS3_WORKFLOW_TEMPLATE.md + web/ws3-canary-console.html) diff 0건
- 다음: Gate 3 staging + commit + push 별도 단계 → KV namespace 생성 + deploy + retest 별도 단계
```

## v0.22.1 actual live canary result

```text
- first real Telegram canary send succeeded
- code CANARY_SENT / httpStatus 200
- messageType CANARY_TEST_ONLY
- fixedMessageUsed true
- fixed 5-line Telegram message received
- cleanup completed
- CANARY_ENABLED=false after test
- real coin candidates still not connected
- KV/DB writes still 0
- production-grade enforcement deferred to v0.23+
```

## v0.21.0 핵심 메모

```text
- v3/v3-telegram-canary-sender.js 신규 (608 라인) — Telegram 1 target 한정 첫 LIVE side-effect 모듈
- 보호 파일 32종 모두 무손상 (v0.19 + v0.20 신규 v3-secure-runtime-state-adapter.js 추가)
- DP-CANARY1 ~ DP-CANARY12 모두 적용 / 미해결 0건
- 계층 분리: buildTelegramCanaryPlan/validate*/build*Result/build*Error/buildSafeDiagnostics 는 sync, dispatchCanary 만 async
- CANARY_FIXED_MESSAGE 5줄 byte-for-byte exact: '[WOOS WS3 CANARY]\nTelegram route connected.\nmode: CANARY_ONLY\nlive signal: disabled\nsnapshot/evaluation/audit: disabled'. 변형 0건
- 20 hard precondition AND (DP-CANARY1): v0.20 valid + runtimeMode='CANARY_PREP_ONLY' + canaryOnly=true + liveSignalEnabled=false + 4 v0.20 runtime state 박제값 + 8 canaryRuntimePolicy 박제값 + WS3_TELEGRAM_CANARY_ENABLED='true' + token/chatId 존재 + messageType='CANARY_TEST_ONLY'
- 4 explicit gate (DP-CANARY2): Gate1 env enabled / Gate2 24h authorized expire / Gate3 X-WS3-Canary-Token == WS3_CANARY_INVOKE_TOKEN exact / Gate4 manualTrigger=true
- fetch safety (DP-CANARY3~5): 5000ms hard timeout + AbortController / retry=0 / per-process 60s rate limit / 3-fail 24h circuit breaker
- safe response whitelist 6 fields (DP-CANARY7): ok/httpStatus/messageId/sentAt/messageType/fixedMessageUsed
- safe error whitelist 4 fields + 7 errorCode enum (DP-CANARY8): CANARY_BLOCKED:<reason>/CANARY_TIMEOUT/CANARY_RATE_LIMITED/CANARY_CIRCUIT_OPEN/CANARY_AUTH_ERROR/CANARY_NOT_FOUND/CANARY_NETWORK_ERROR
- safe diagnostics 6 fields (DP-CANARY9): tokenValueExposed/chatIdValueExposed/rawTelegramResponseExposed=false 강제 + tokenPresent/chatIdPresent/canaryEnabled presence flags
- raw Telegram response 차단 (DP-CANARY10): description/from.*/chat.*/bot_token/headers/Set-Cookie/X-*/Server/Date 0건. extractSafeBody 가 { result: { message_id } } 만 추출
- token/chatId 코드/문서/로그 출력 0건 (DP-CANARY11). masked/first-4/last-4 0건
- worker.js/endpoint/inbound/canary worker 신규 0건 (DP-CANARY12). module 만 생성
- 시간 source: deps.nowMs 또는 deps.nowFn() 만 (Date.now 직접 사용 0건)
- fetch: deps.fetchImpl 만 (fetch( 직접 호출 0건)
- AbortController: deps.AbortControllerImpl 만 (직접 사용 0건)
- setTimeout/clearTimeout: deps.setTimeoutImpl/deps.clearTimeoutImpl 만 (직접 사용 0건)
- runtime env: input.runtimeEnv 만 (process.env / globalThis.env 직접 사용 0건)
- 허용 runtimeEnv 키 5종 (WS3_TELEGRAM_BOT_TOKEN/CHAT_ID/CANARY_ENABLED/CANARY_AUTHORIZED_AT/CANARY_INVOKE_TOKEN)
- 허용 headers 키 1종 (X-WS3-Canary-Token)
- Object.assign / spread / JSON.parse(JSON.stringify) / for-in 0건
- async function / await 사용 위치: dispatchCanary 1개 함수 내부 한정 (line 439 함수 선언 + line 523 fetch await + line 549 json await)
- smoke test 47 records (46 spec + 1 circuit threshold 분리) 전부 PASS (TOTAL=47 PASS=47 FAIL=0). 실제 Telegram API 호출 0건 (mock fetchImpl 만)
- v0.22+: 실제 endpoint / inbound /canary-test / GitHub Actions workflow_dispatch / 별도 canary worker — 별도 단계
- 실제 1회 canary 발송: 별도 staging test 승인 후 별도 단계
```

## v0.20.0 핵심 메모

```text
- v3/v3-secure-runtime-state-adapter.js 신규 (961 라인) — side-effect 0건 계층
- 보호 파일 31종 모두 무손상 (v0.19 v3-live-execution-preflight-gate.js 추가)
- DP-RUNTIME1 ~ DP-RUNTIME5 모두 적용 / 미해결 0건
- runtimeStatus 4 후보 first-match-wins (INVALID > BLOCKED > READY > UNKNOWN)
- runtimeMode='CANARY_PREP_ONLY' 강제, canaryOnly=true 강제, liveSignalEnabled=false 강제
- 6 runtime state contract:
  - killSwitchRuntimeState (4 keys: evaluated/state='CANARY_ALLOWED'/source='explicit_config_only'/mutationAllowed=false, 금지 state ON/OFF/UNKNOWN/ERROR/BYPASSED)
  - rollbackRuntimeState (3 keys: evaluated/rollbackAvailable=false/rollbackExecutionAllowed=false)
  - disableRuntimeState (3 keys: evaluated/disabled=false/disableExecutionAllowed=false)
  - telegramRuntimeEligibility (4 keys: target='TELEGRAM'/eligibleForCanary=true/eligibleForLiveSignal=false/reason='CANARY_ONLY')
  - canaryRuntimePolicy (8 keys: canaryOnly=true/fixedMessageOnly=true/candidatePayloadAllowed/snapshotAllowed/evaluationAllowed/auditAllowed/kvWriteAllowed/dbWriteAllowed=false)
  - safeDiagnostics (3 keys: tokenValueExposed/chatIdValueExposed/rawTelegramResponseExposed=false 강제)
- 6 validate 본문 규칙 박제 (plain object only / depth limit 1 / Array/function/Promise/thenable 차단 / whitelist key / enum/boolean 강제 / INVALID_<TYPE>:<sub-reason> reason)
- 6 INVALID_* reason code 신규 (INVALID_KILL_SWITCH_RUNTIME_STATE / INVALID_ROLLBACK_RUNTIME_STATE / INVALID_DISABLE_RUNTIME_STATE / INVALID_TELEGRAM_RUNTIME_ELIGIBILITY / INVALID_CANARY_RUNTIME_POLICY / INVALID_SAFE_DIAGNOSTICS)
- runtimePolicy 박제 (preflightOnly=true + 17 boolean false + liveExecutionRequiresExplicitGate=true)
- v0.19 결과 read-only consume: liveExecutionPreflightGate ready/status/policy override 0건 (smoke S9 mutation 검증)
- v0.20 별도 객체 정책 (N-PREFLIGHT-OBS-5 박제): v0.19 plan 객체와 별도 runtime state 객체 신규 생성
- RESERVED framework metadata 37종 (v0.19 31 + v0.20 신규 6 safeDiagnostics presence flags)
- async function / await / Promise / thenable / setTimeout / setInterval / fetch / AbortController 0건 (sync only)
- Date.now / new Date / performance.now / process.env / globalThis.env / globalThis.bindings / globalThis.secrets 0건
- Object.assign / spread / JSON.parse(JSON.stringify) / for-in 0건
- smoke test 18 시나리오 전부 PASS (TOTAL=18 PASS=18 FAIL=0)
- v0.21 의 hard precondition source (20 AND 의 16 조건은 v0.20 결과)
```

## v0.19.0 핵심 메모

```text
- v3/v3-live-execution-preflight-gate.js 신규 (1950 라인)
- 보호 파일 31종 모두 무손상 (v0.18 v3-secure-binding-gateway-contract.js 신규 추가)
- DP-PREFLIGHT1 ~ DP-PREFLIGHT10 + N-PREFLIGHT-OBS-1 ~ N-PREFLIGHT-OBS-7 모두 적용 / 미해결 0건
- preflightStatus 6 후보 first-match-wins (INVALID > BLOCKED > PARTIAL > READY > SKIPPED > UNKNOWN)
- 4 target preflight: telegram / snapshot / evaluation / audit (각 17-stage AND ready)
- preflightMode='PREFLIGHT_ONLY' 강제, liveExecutionAllowed=false 강제 (top-level + preflightPolicy)
- 11 boolean hard block (liveExecution/credentialLookup/bindingLookup/driverCall/fetch/write/retry/timer/envAccess/rollbackExecution/killSwitchMutation)
- 7 Contract field (per-preflight): gatewayRef(5 safe scalar) / executionIntent(5 keys, wouldExecuteLive=false, requiresManualApproval=true) / bindingRequirementSnapshot(7 keys, 6 boolean false) / liveReadinessPolicy(7 keys, liveReady=false) / killSwitchPlan(3 keys, currentState='NOT_EVALUATED', mutationAllowed=false) / rollbackPlan(3 keys, rollback*=false) / disablePlan(3 keys, disable*=false)
- riskSummary(3 keys, riskLevel='PREFLIGHT_ONLY', blockers/warnings string[])
- 빈 preflight 객체 출력 금지 (4 target 동일 13-key shape)
- 3중 안전망: killSwitchPlan(system-wide pre-LIVE) / disablePlan(per-target pre-LIVE) / rollbackPlan(post-LIVE recovery). 셋 모두 v0.19 실제 실행 0건
- 8 validate 본문 규칙 박제 (plain object only, depth limit 1, Array/function/Promise/thenable 차단, whitelist key + enum/boolean/false 강제, INVALID_<NAME>:<sub>:<target> reason)
- target ↔ action 매핑 1:1 (TELEGRAM→TELEGRAM_SEND 등)
- 22 forbidden wording (v0.18 20 + v0.19 신규 2: LIVE 실행 완료, 실제 발송)
- 14 logicalRefAllowList (v0.18 10 + v0.19 신규 4 bindingRef: TELEGRAM_SECURE_BINDING/KV_SNAPSHOT_BINDING/EVALUATION_STORE_BINDING/AUDIT_STORE_BINDING)
- RESERVED 31종 자동 차단 제외 (v0.18 26 + v0.19 신규 5 credentialValue* + allowMaskedCredentialPreview)
- v0.20 runtimeState 분리 정책: killSwitchRuntimeState/rollbackRuntimeState/disableRuntimeState 별도 객체. v0.19 결과 read-only.
- credential 9키 + env-like 11키 + function input 통합 차단
- validateLogicalRef 6단계 (v0.18 inherited — credential pattern 우선 + framework bypass + token-level function pattern)
- preflightPolicy 박제: preflightOnly=true + 11 boolean false + liveExecutionRequiresExplicitGate=true
- Object.assign / spread / JSON.parse(JSON.stringify) / for-in 코드 0건
- async / await / Promise / thenable / setTimeout / setInterval 코드 0건 (sync only)
- fetch / Telegram 실호출 / KV / DB / DOM / storage / clock API / process.env / globalThis 코드 0건
- 실제 rollback 실행 / disable 실행 / kill switch 조회 / kill switch 변경 0건
- sanitizeMode='REJECT' 기본 (22 금지 어휘 substring match + credential pattern + masked preview term 우선 차단)
- smoke test 68 시나리오 전부 PASS (TOTAL=68 PASS=68 FAIL=0)
- 입력 mutation 0건 (DP-PREFLIGHT9)
- v0.20+ real LIVE executor 와 credential 인계 0건 (gatewayRef logical handle 만 인계)
- preflight gate ≠ LIVE executor: liveReadinessPolicy.liveReady=false / executionIntent.wouldExecuteLive=false / perTargetGate.allow=false
```

## v0.18.0 핵심 메모

```text
- v3/v3-secure-binding-gateway-contract.js 신규 (1667 라인)
- 보호 파일 30종 모두 무손상 (v0.17 v3-transport-executor-sandbox-runner.js 신규 추가)
- DP-GATEWAY1 ~ DP-GATEWAY10 + N-GATEWAY-OBS-1 ~ N-GATEWAY-OBS-8 모두 적용 / 미해결 0건
- gatewayStatus 6 후보 first-match-wins (INVALID > BLOCKED > PARTIAL > READY > SKIPPED > UNKNOWN)
- 4 target gateway: telegram / snapshot / evaluation / audit (각 17-stage AND ready)
- gatewayMode='CONTRACT_ONLY' 강제, liveExecutionAllowed=false 강제, lookupAllowed=false 강제 (top-level + gatewayPolicy)
- 11 boolean hard block (v0.17 9 + lookupAllowed + envAccessAllowed 신규)
- 5종 Contract field (per-gateway): credentialHandleRef (logical) / bindingScope (logical) / lookupPlan (4 key whitelist) / bindingPolicy (6 key whitelist) / sandboxResultRef (5 safe scalar)
- sandboxResultRef 5 safe fields (target/action/resultType='SANDBOX_ONLY'/simulated=true/status) — ok / errorType / reasonCode / rawResponse / rawError / stack / body / headers / responseBody 전부 제외
- 10 framework refs 기본 logicalRefAllowList (TELEGRAM_CREDENTIAL_HANDLE … FUTURE_SECURE_BINDING_RESOLVER)
- framework 우회 알고리즘 (N-GATEWAY-OBS-4): allowList exact → 형식 → CREDENTIAL_HANDLE / CREDENTIAL_HANDLE_REF substring → keyword 차단. HANDLE 단독 / CREDENTIAL 단독 / SCOPE 단독은 우회 자격 없음
- target ↔ action 매핑 1:1 (TELEGRAM→TELEGRAM_SEND 등)
- 20 forbidden wording (v0.17 15 + v0.18 신규 5: lookup 완료, resolved credential, credential loaded, secret loaded, token loaded)
- v0.17 pass-through 재검증: rateLimitContract (key=target match) / circuitBreakerContract (state='OPEN_IN_DRY_RUN' 강제)
- CLOSED / HALF_OPEN 절대 금지
- credential 9키 + env-like 11키 + function input 통합 차단
- RESERVED 프레임워크 metadata 24종 자동 차단 제외 (credentialHandleRef / directSecretAccessAllowed / logicalRefAllowList 등)
- validateLogicalRef 6단계 (credential pattern + framework bypass + token-level function pattern, EVAL 차단 / EVALUATION 허용)
- gatewayPolicy 박제: 12 boolean 모두 false + liveExecutionRequiresExplicitGate=true
- Object.assign / spread / JSON.parse(JSON.stringify) / for-in 코드 0건
- async / await / Promise / thenable / setTimeout / setInterval 코드 0건 (sync only)
- fetch / Telegram 실호출 / KV / DB / DOM / storage / clock API / process.env / globalThis 코드 0건
- sanitizeMode='REJECT' 기본 (20 금지 어휘 substring match + credential pattern + masked preview term 우선 차단)
- smoke test 66 시나리오 전부 PASS (TOTAL=66 PASS=66 FAIL=0)
- 입력 mutation 0건 (DP-GATEWAY9)
- v0.19+ real executor 와 credential 인계 0건 (logical handle ref + gatewayPolicy 만 인계)
- sandboxResultRef 5 safe scalar 만 LIVE source 오해 위험 차단
```

## v0.17.0 핵심 메모

```text
- v3/v3-transport-executor-sandbox-runner.js 신규 (1995 라인)
- 보호 파일 29종 모두 무손상
- DP-SANDBOX1 ~ DP-SANDBOX10 + N-SANDBOX-OBS-1 ~ N-SANDBOX-OBS-9 모두 적용 / 미해결 0건
- sandboxStatus 6 후보 first-match-wins (INVALID > BLOCKED > PARTIAL > READY > SKIPPED > UNKNOWN)
- 4 target sandbox: telegram / snapshot / evaluation / audit (각 17-stage AND ready)
- sandboxMode='SANDBOX_ONLY' 강제, liveExecutionAllowed=false 강제
- 9 boolean hard block (v0.16 의 8 + timerAllowed 신규)
- 5종 Preview (bindingResolverPreview/driverCallPreview/resultAdapterPreview/errorAdapterPreview/retryPreview): 모두 SANDBOX_PREVIEW boolean false 강제
- sandboxFixture 허용 키 6종 (target/action/ok/status/errorType/reasonCode), 9-step 검증
- sandboxResult 허용 필드 8종 (simulated/resultType/target/action/ok/status/errorType/reasonCode)
- sandboxResult.ok 와 target.ready 분리 (N-SANDBOX-OBS-8) — SIMULATED_ERROR/SKIPPED 도 ready=true 가능
- target ↔ action 매핑 1:1 (TELEGRAM→TELEGRAM_SEND 등) + ACTION_TARGET_MISMATCH 차단
- v0.16 pass-through 재검증: rateLimitContract (key=target match) / circuitBreakerContract (state=OPEN_IN_DRY_RUN 강제) / dryRunResult
- CLOSED / HALF_OPEN 절대 금지
- credential 9키 + env-like 11키 + function input 통합 차단
- RESERVED 프레임워크 metadata 24종 자동 차단 제외 (`credentialHandleRef` v0.16 field 포함 + v0.17 sandbox metadata 3종 신규)
- validateLogicalRef v0.16 동일 (credential pattern 우선, EVAL 차단 / EVALUATION 허용)
- validateSandboxFixture 9-step (source 직접 검증, extra key / nested object / function value 차단)
- 14 whitelist payloadSummary + metadata 기본 빈 배열, v0.16 재검증
- Object.assign / spread / JSON.parse(JSON.stringify) / for-in 코드 0건
- async / await / Promise / thenable / setTimeout / setInterval 코드 0건 (sync only)
- fetch / Telegram 실호출 / KV / DB / DOM / storage / clock API / process.env / globalThis 코드 0건
- sanitizeMode='REJECT' 기본 (15 금지 어휘 exact phrase substring match) + CREDENTIAL_IN_LINE_REJECTED
- smoke test 60 시나리오 / 134 assertion 전부 PASS
- 입력 mutation 0건 (DP-SANDBOX9, S52 frozen-input 검증)
- v0.18+ real executor 와 credential 인계 0건 (logical handle ref + sandboxPolicy 만 인계)
- sandboxResult.ok=true 를 LIVE 실행 결정 source 로 사용 금지 (audit/canary 자료)
```

## v0.16.0 핵심 메모

```text
- v3/v3-transport-executor-interface-adapter.js 신규 (1788 라인)
- 보호 파일 28종 모두 무손상 (v3 *.js 21종 + index/manifest/sw 3종 + CODE_CONTRACT + WORKFLOW_TEMPLATE + worker.js + wrangler.toml)
- DP-ADAPTER1 ~ DP-ADAPTER10 + N-ADAPTER-OBS-1 ~ N-ADAPTER-OBS-7 모두 적용 / 미해결 항목 0건
- adapterStatus 6 후보 first-match-wins (INVALID > BLOCKED > PARTIAL > READY > SKIPPED > UNKNOWN)
- 4 target interface: telegram / snapshot / evaluation / audit (각 16-stage AND ready)
- adapterMode='INTERFACE_ONLY' 강제, liveExecutionAllowed=false 강제
- 8 boolean hard block: liveExecution / sideEffect / fetch / write / credentialLookup / bindingLookup / driverCall / retry
- 5종 Contract: bindingResolverContract / driverCallContract / resultAdapterContract / errorAdapterContract / retryAdapterContract (모두 INTERFACE_ONLY boolean false 강제)
- target ↔ action 매핑 1:1: TELEGRAM→TELEGRAM_SEND, SNAPSHOT_STORE→SNAPSHOT_WRITE, EVALUATION_STORE→EVALUATION_WRITE, AUDIT_STORE→AUDIT_WRITE
- v0.15 pass-through 재검증: rateLimitContract (key=target match) / circuitBreakerContract (state=OPEN_IN_DRY_RUN 강제, CLOSED/HALF_OPEN 금지) / dryRunResult (wouldExecute=false + action 매핑, ACTION_TARGET_MISMATCH 차단)
- validateLogicalRef 6단계: 형식 + allowList + credential pattern 우선 + 금지 substring + bot/digit-only + function pattern (token-level)
- credential pattern 우선순위 — 일반 용어 허용 list override 불가 (N-ADAPTER-OBS-5)
- function pattern token-level 매칭 — 'EVAL' 토큰 차단 / 'EVALUATION' 토큰 허용 (false-positive 회피)
- detectFunctionInputs 재귀 차단 — function value / async function / Promise / thenable 모두 ADAPTER_BLOCKED
- RESERVED 프레임워크 metadata 22종 자동 차단 제외 (logicalRefAllowList 등 v0.16 신규 4종 포함)
- 9 errorType enum (NETWORK_ERROR/TIMEOUT/AUTH_FAILED/RATE_LIMIT/PAYLOAD_ERROR/SERVER_ERROR/PARSE_ERROR/UNKNOWN/CONTRACT_INVALID)
- adapterPolicy 박제: interfaceOnly=true + 6 boolean false + liveExecutionRequiresExplicitGate=true
- payloadSummary 14 whitelist scalar + metadata 기본 빈 배열, v0.15 재검증
- Object.assign / spread / JSON.parse(JSON.stringify) / for-in 코드 0건
- async / await / Promise / setTimeout / setInterval 코드 0건 (sync only)
- sanitizeMode='REJECT' 기본 (15 금지 어휘 exact phrase substring match) + CREDENTIAL_IN_LINE_REJECTED
- r0.1 폐기 naming residue 0건 (RealTransportExecutor* / *Execution / EXECUTOR_* / classifyExecutorStatus)
- smoke test 46 시나리오 / 147 assertion 전부 PASS
- 입력 mutation 0건 (DP-ADAPTER9, S42 frozen-input 검증)
- fetch / Telegram 실호출 / KV / DB / DOM / storage / clock API / process.env / globalThis 코드 0건
- v0.17+ real executor 와 credential 인계 0건 (logical handle ref + adapterPolicy 만 인계)
```

## v0.15.0 핵심 메모

```text
- v3/v3-transport-executor-harness.js 신규 (1603 라인)
- 보호 파일 25종 모두 무손상 (v3 *.js 20종 + index/manifest/sw 3종 + CODE_CONTRACT + WORKFLOW_TEMPLATE)
- DP-HARNESS1 ~ DP-HARNESS10 + N-HARNESS-OBS-1 ~ N-HARNESS-OBS-6 모두 적용 / 미해결 항목 0건
- harnessStatus 6 후보 first-match-wins (INVALID > BLOCKED > PARTIAL > READY > SKIPPED > UNKNOWN)
- 4 target harness: telegram / snapshot / evaluation / audit (각 9-stage AND ready)
- harnessMode='DRY_RUN_HARNESS' 강제, liveExecutionAllowed=false 강제
- 5 boolean hard block: liveExecution / sideEffect / fetch / write / credentialLookup
- perTargetGate.allow 항상 false 강제 (DP-HARNESS5)
- rateLimitContract per-target key 자동 + per-target override (per-target > top-level > default)
- circuitBreakerContract.state='OPEN_IN_DRY_RUN' 강제
- dryRunResult.wouldExecute=false 강제, resultType=DRY_RUN_ONLY, action enum target 매핑
- credential 9키 재귀 차단 + RESERVED 프레임워크 metadata 18종 자동 차단 제외 (`directSecretAccessAllowed` 등 v0.14 자체 metadata 포함, N-HARNESS-OBS-4 확장)
- env-like 11키 exact match + value object 조건 차단 (r0.2 §6.2 false-positive 완화)
- bindingRef logical reference only — IIFE 내부 private 재정의 (N-HARNESS-OBS-5)
- payloadSummary 14 whitelist scalar + metadata 기본 빈 배열, v0.14 contract 재검증
- Object.assign / spread / JSON.parse(JSON.stringify) / for-in 코드 0건
- sanitizeMode='REJECT' 기본 (15 금지 어휘 exact phrase substring match)
- CREDENTIAL_IN_LINE_REJECTED 추가 (line 내 credential pattern 차단)
- r0.1 폐기 naming residue 0건 (RealTransportExecutor* / *Execution / EXECUTOR_* / classifyExecutorStatus)
- smoke test 30 시나리오 / 95 assertion 전부 PASS
- 입력 mutation 0건 (DP-HARNESS9, S26 frozen-input 검증)
- fetch / Telegram 실호출 / KV / DB / DOM / storage / clock API / process.env / globalThis 코드 0건
- v0.16+ real executor 와 credential 인계 0건 (bindingRef logical + harnessPolicy 만 인계)
```

## v0.14.0 핵심 메모

```text
- v3/v3-secure-transport-executor-contract.js 신규 (1595 라인)
- 보호 파일 24종 모두 무손상 (v3 *.js 19종 + index/manifest/sw 3종 + CODE_CONTRACT + WORKFLOW_TEMPLATE)
- DP-SEC1 ~ DP-SEC10 + N-SEC-OBS-1 ~ N-SEC-OBS-4 모두 적용 / 미해결 항목 0건
- contractMode='CONTRACT_ONLY' 강제, liveExecutionAllowed=false 강제 (LIVE/REAL/EXECUTE → CONTRACT_BLOCKED)
- contractStatus 6 후보 first-match-wins: CONTRACT_INVALID > BLOCKED > PARTIAL > READY > SKIPPED > UNKNOWN
- 4 target contract (5-stage AND ready): telegram / snapshot / evaluation / audit
- credential 9키 재귀 차단 (case-insensitive + partial + depth 5 + scalar leaf 안전)
- RESERVED 프레임워크 metadata 16종 자동 차단 제외 (N-SEC-OBS-4 — credentialMaxDepth / credentialAllowList / allowWebhookUrl / bindingRefAllowList 등)
- env-like 11키 exact match + value object 차단 (r0.2 §6.2 false-positive 완화)
- validateBindingRef: ^[A-Z][A-Z0-9_]*$ + 13 금지 substring (http/https/sk-/xoxb-/eyJ 등) + bot[0-9]+ + digit-only + credential partial match + bindingRefAllowList 기본 []
- payloadSummary 14 whitelist scalar only + metadata 기본 빈 배열
- v0.13 envelope 재검증 (payloadSummary / metadata 그대로 신뢰 X)
- secureBindingPolicy 박제 (credentialSource='SECURE_BINDING_ONLY', envReadAllowed=false, liveExecutionRequiresExplicitGate=true)
- Object.assign / spread / JSON.parse(JSON.stringify) / for-in 코드 0건
- sanitizeMode='REJECT' 기본 (15 금지 어휘 line 제거)
- smoke test 26 시나리오 / 82 assertion 전부 PASS
- 입력 mutation 0건 (DP-SEC9, S24 frozen-input 검증)
- fetch / Telegram 실호출 / KV / DB / DOM / storage / clock API / process.env / globalThis / chatId / botToken / apiKey 코드 0건
- v0.15+ real executor 와 credential 인계 0건 (bindingRef logical reference + requestShape scalar 만 인계)
```

## v0.13.0 핵심 메모

```text
- v3/v3-transport-execution-adapter.js 신규 (~1400 라인)
- 보호 파일 23종 모두 무손상 (v3 *.js 18종 + index/manifest/sw 3종 + CODE_CONTRACT + WORKFLOW_TEMPLATE)
- DP-TX1 ~ DP-TX10 + U-TX-1 + U-TX-2 + N-TX-OBS-1 + N-TX-OBS-2 모두 적용 / 미해결 항목 0건
- U-TX-1: cfg.safety.credentialAllowList 기본 빈 배열. partial match 안전 우선 차단
- U-TX-2: cfg.wording.sanitizeMode='REJECT' 기본. REJECT/REPLACE/WARN_ONLY 3 모드
- N-TX-OBS-1: dryRunOnly namespace 중복 (기존 wording vs v0.13.0 top-level/envelope) — namespace 분리로 구조적 충돌 없음
- N-TX-OBS-2: 보호 baseline false-positive — 본 모듈 fetch/Date.now/spread/Object.assign 0건
- TransportExecutionAdapter:
  - 입력 6종 (transportPlan + rendererBinding + operationPacket + activeCycleDecision + evaluationOutcome + externalConfluence) read-only
  - 출력: TransportExecutionEnvelope (dry-run safe envelope)
  - envelopeMode='DRY_RUN' 강제 (LIVE/REAL/SEND → BLOCKED)
  - envelopeStatus 6 후보 first-match-wins: ENVELOPE_INVALID > BLOCKED > PARTIAL > READY > SKIPPED > UNKNOWN
  - 4 envelope: telegramEnvelope / snapshotEnvelope / evaluationEnvelope / auditEnvelope
  - eligible 3-stage AND (plan boolean && cfg.execution.allow* && envelopeMode==='DRY_RUN')
  - DP-TX2 — TransportPlan false 결정 절대 true override 안 함 (S18 검증)
- credential 차단 (DP-TX4):
  - 9 금지 키: secret/token/chatid/bottoken/apikey/authorization/password/credential/webhookurl
  - case-insensitive + partial match + depth limit 5
  - cfg.safety.credentialAllowList 로 차단 제외 가능 (기본 빈 배열)
  - 발견 시 모든 envelope BLOCKED + warnings SECRET_FIELD_BLOCKED:<path>
  - path 에는 key 이름 + 위치만, value 절대 노출 0건 (S6/S7/S8/S9/S15/S21 검증)
- payloadSummary (DP-TX5):
  - 14 whitelist scalar only (candidateKey/base/quote/market/exchange/timeframe/messageType/snapshotType/evaluationType/resultType/auditType/displayMode/confluenceLabel/confluenceScore)
  - Object.assign / spread / JSON.parse(JSON.stringify) / for-in 코드 0건
  - metadata 기본 {}, metadataAllowedFields 기본 빈 배열
- sanitizeMessageLines (DP-TX6 / U-TX-2):
  - 15 금지 어휘: 발송됨/저장됨/전송 완료/sent/delivered/completed transmission/매수 성공/손절/익절/수익 확정/손실 확정/buy now/sell now/take profit/stop loss
  - REJECT 기본 — line 제거 + warning FORBIDDEN_WORD_LINE_REJECTED
  - REPLACE — safe wording 치환 (예: '발송됨' → '발송 후보')
  - WARN_ONLY — line 유지 + warning (운영 사용 금지 권장)
- smoke test 21 시나리오 / 59 assertion 전부 PASS
- 입력 mutation 0건 (DP-TX8, S19 frozen-input 검증)
- fetch / Telegram 실호출 / KV / DB / DOM / storage / clock API / chatId / botToken / apiKey 코드 0건
- v0.14.0+ real executor 와 credential 인계 0건 (envelope 만 인계 보장)
```

## v0.12.0 핵심 메모

```text
- v3/v3-transport-plan.js 신규 (740 라인)
- v3/v3-renderer-binding.js 신규 (834 라인)
- 보호 파일 21종 모두 무손상 (v3 *.js 16종 + index/manifest/sw 3종 + CODE_CONTRACT + WORKFLOW_TEMPLATE)
- DP-APO1 ~ DP-APO10 모두 적용 / 미해결 항목 0건
- U-APO-1 Option B: sections.{strategy/lifecycle/evaluation/confluence/transport} 5종 모두 array
- U-APO-2 Option A: displayMode 7 후보 (BLOCKED→COOLDOWN→CLOSED→REVIEW→ALERT→DEFAULT→UNKNOWN) 우선순위
- U-APO-3 Option C: flags namespace 분리 (flags.binding + flags.card 10 boolean 보존)
- N-APO-OBS-1: auditPlan = reviewQueue 후보만. 실제 reviewQueue write 0건
- N-APO-OBS-2: dry-run 어휘 강제 (DP-APO10) — '전송 완료/sent/delivered' 0건
- TransportPlan:
  - telegramPlan.shouldSend = 4단계 AND (op.shouldNotify && ac.allowNotify && !ac.suppressNotify && ac.canNotify)
  - snapshotPlan.shouldStore = 3단계 AND (signal snapshot timing — outcome timing 제외, DP-APO4)
  - evaluationPlan.shouldStore = 4단계 AND (outcome.shouldStoreOutcome 포함)
  - auditPlan 7 후보 우선순위: ROUTING_CONFLICT > DATA_AMBIGUOUS > DATA_INSUFFICIENT > REVIEW_REQUIRED > SUPPRESSED_NOTIFY > WARNING_PRESENT > NONE
  - warningAuditMode = 'critical' default (7 critical warning 만)
  - detectRoutingConflict() 분리 — NOTIFY/SNAPSHOT/EVALUATION 각각 별도 reason
- RendererBinding:
  - cardViewModel superset (header/chips/metrics) — mutation 없이 적층
  - sections 5종 array, displayMode 7 후보 first-match-wins
  - flags.binding (RendererBinding 신규) + flags.card (cardViewModel.displayFlags verbatim 10 boolean)
- smoke test 22 시나리오 (20 핵심 + 2 Extra) 통과
- 입력 mutation 0건 (DP-APO8, S19 검증)
- fetch / Telegram 실호출 / KV / DB / DOM / storage / clock API / chatId / botToken / apiKey 코드 0건
- '발송됨 / 저장됨 / 전송 완료 / sent / delivered / completed transmission' 코드 0건 (dry-run 어휘 강제)
- 매수 권고 / 매도 권고 / 손절 / 익절 / 수익 확정 / take profit / stop loss 코드 0건
```

## v0.11.0 핵심 메모

```text
- v3/v3-evaluation-observation-adapter.js 신규 (497 라인)
- v3/v3-external-confluence.js 신규 (736 라인)
- 보호 파일 19종 모두 무손상 (v3 *.js 14종 + index/manifest/sw 3종 + CODE_CONTRACT + WORKFLOW_TEMPLATE)
- DP-ACP1 ~ DP-ACP10 모두 적용 / 미해결 항목 0건
- U-ACP-1 Option A: source='adapter-normalized' + reasons['ADAPTER_NORMALIZED']
- U-ACP-2: confluenceScore number|null, 기본 null, -100~100 범위, enableScore 기본 false
- N-ACP-OBS-1: payload.newsContext 직접 read 0건 (input.newsContext 만 처리)
- N-ACP-OBS-2: v0.2.0-a baseline 보호 파일 책임 분리
- EvaluationObservationAdapter:
  - field mapping 13종, v0.10.0 buildEvaluationOutcome 호환 보장 (S11 검증)
  - raw candles / API response 출력 0건 (S4 검증)
- ExternalConfluence:
  - 5종 sub-context 정규화 (market/sector/exchange/schedule/news)
  - 6 confluenceLabel 후보 (UNKNOWN/FAVORABLE/NEUTRAL/ADVERSE/MIXED)
  - confluenceScore 기본 null. enableScore=true 시 contribution 합산 후 clamp
  - scoreBreakdown/strategyPlan 판단 대체 0건 (S7 검증)
- v0.12.0 분리 항목 (TransportPlan/RendererBinding/AdapterContractPack) 미생성
- smoke test 15 시나리오 (12 핵심 + 3 Extra) 통과
- 입력 mutation 0건 (DP-ACP8, S10 검증)
- fetch / KV / DB / Telegram / DOM / storage / clock 코드 침범 0건
- 매매 권고 / secret / token / chatId / botToken / apiKey 코드 0건

## v0.10.0 핵심 메모 (이전 단계)

```text
- v3/v3-evaluation-outcome.js 신규 생성 1건 (1407 라인)
- 보호 파일 18종 모두 무손상 (v3 *.js 13종 + index/manifest/sw 3종 + CODE_CONTRACT + WORKFLOW_TEMPLATE)
- WS3_CODE_CONTRACT.md 미수정 (b-r2 박제본 그대로)
- WS3_WORKFLOW_TEMPLATE.md 미수정 (v0.1 박제본 그대로)
- DP-EO1 ~ DP-EO14 모두 적용 / 미해결 항목 0건
- 입력 4종 (operationPacket + activeCycleDecision + evaluationObservation + previousEvaluationState) mutation 0건 (DP-EO1, smoke 검증)
- status 6 후보 (UNKNOWN/PENDING/IN_PROGRESS/COMPLETED/CLOSED/INVALID) - DP-EO11
- resultType 11 후보 — 매수 성공/손절/익절/수익 확정 어휘 0건 (DP-EO9)
- resultPhase 6 후보 / outcomeQuality 4 후보
- movement 누적 (DP-EO14): max(prev.maxFav, cur.highMove) / min(prev.maxAdv, cur.lowMove). S14 검증
- baselinePrice 2-step fallback (DP-EO5): evaluationSeed → observation → DATA_INSUFFICIENT
- target source: targetHints[0] → safeHints TARGET → cfg.planTargetPct (priority chain first-match-wins)
- invalidation source: type='INVALIDATION' 우선 → 'SETUP_INVALIDATION' → safeHints INVALIDATION → cfg.invalidationPct (U-EO-2)
- unit 분리 (DP-EO6 + U-EO-1): hint.unit 부재 → default 'price'. pct 는 unit==='pct' 또는 cfg fallback. UNIT_AMBIGUOUS 검사 (0<v<1 + baseline≥10)
- path order (U-EO-3): DATA_AMBIGUOUS 는 pathOrderKnown !== true 일 때만. true 면 firstEvent 로 TARGET_HIT/INVALIDATED 분기. S11/S12/S13 검증
- nextEvaluationState 산출 only (DP-EO10). 실제 저장 0건
- 런타임 clock API (Date.now/new Date/performance.now) 0건
- 외부 호출 (fetch/XMLHttpRequest) 0건
- raw candles / payload.raw / identityInput / secret/token/chatId/botToken/apiKey 0건
- 매매 권고 / 매수·매도 어조 / 수익·손실 확정 코드 0건
- frozen input 안전성 검증 (Extra-F)

## v0.9.0 핵심 메모 (이전 단계)

```text
- v3/v3-active-cycle.js 신규 생성 1건 (1279 라인)
- 보호 파일 17종 모두 무손상 (v3 *.js 12종 + index/manifest/sw 3종 + CODE_CONTRACT + WORKFLOW_TEMPLATE)
- WS3_CODE_CONTRACT.md 미수정 (b-r2 박제본 그대로)
- WS3_WORKFLOW_TEMPLATE.md 미수정 (v0.1 박제본 그대로)
- DP-AC1 ~ DP-AC14 모두 적용 / 미해결 항목 0건
- 입력 2종 (operationPacket + previousOperationState) mutation 0건 (DP-AC1, smoke 검증)
- lifecycleState 8 후보 (NONE/NEW/ACTIVE/PERSISTING/STRENGTHENING/WEAKENING/COOLDOWN/EXPIRED). DUPLICATE/SUPPRESSED 0건 (DP-AC12)
- lifecyclePhase 7 후보 (NONE/NEW/EARLY/ACTIVE/MATURE/LATE/CLOSED) (DP-AC13)
- transition 11 후보 (NONE/NEW_CANDIDATE/SAME_CANDIDATE/CANDIDATE_CHANGED/STATE_CHANGED/STRENGTHENED/WEAKENED/COOLDOWN_ENTERED/COOLDOWN_CONTINUED/EXPIRED/DUPLICATE_SUPPRESSED)
- candidateKey verbatim 복사 (DP-AC4)
- timestamp 기준: snapshotPacket.timestamp → evaluationSeed.startTs → null (DP-AC5)
- signalCooldown vs notifyCooldown 분리 (DP-AC14, Extra-C smoke 검증)
- state strength max() (DP-AC9 / U-AC-1, Extra-A 검증). 합산/평균 0건
- U-AC-1 Option A: snapshotPacket.state.cycleState / cycle.cycleState ranking source 추가. STRENGTHENING(70) / WEAKENING(-10) 활성화
- U-AC-2 Option A: previous null = base zero state. 첫 관측 seenCount=1
- U-AC-3: Gate 2 spec top-level 15-field shape 그대로
- N-AC-OBS-1: isActiveCycleState 회피 → isActiveLifecycleState 사용
- N-AC-OBS-2: 보호 파일 책임. 본 모듈 Date.now / new Date / performance.now / fetch 코드 0건
- 외부 호출 / DOM / 브라우저 storage / KV / persistence 0건
- 런타임 clock API 사용 0건
- 실거래 / 주문 / 알림 / 렌더 / 등급 코드 / secret 0건
- frozen input 안전성 검증 (Extra-D)

## v0.8.0 핵심 메모 (이전 단계)

```text
- v3/v3-operation-packet.js 신규 생성 1건
- 보호 파일 16종 모두 무손상 (v3 *.js 11종 + index/manifest/sw 3종 + CODE_CONTRACT + WORKFLOW_TEMPLATE)
- WS3_CODE_CONTRACT.md 미수정 (b-r2 박제본 그대로)
- WS3_WORKFLOW_TEMPLATE.md 미수정 (v0.1 박제본 그대로)
- DP-OP1 ~ DP-OP12 모두 적용 / 미해결 항목 0건
- 6종 입력 (payload / scoreBreakdown / structureDecision / signalCycle / strategyPlan / cardViewModel) mutation 모두 0건 (DP-OP1, smoke 검증)
- DP-OP3 출력 7대 영역 (identity / candidateKey / routing / notificationPacket / snapshotPacket / evaluationSeed / displaySummary)
- DP-OP4 shouldNotify 기본 false (enableNotificationCandidate=false default, Extra-C 검증)
- DP-OP5/6 shouldSnapshot/shouldEvaluate 기본 true (config enable). invalid/NONE 시 false
- DP-OP8 baselinePrice numeric only fallback chain (referencePrice → entryZone numeric → last close → null. Extra-A 검증)
- DP-OP9 safeHints 안전 라벨 4종만 (REFERENCE_ZONE / INVALIDATION_LEVEL / TARGET_HINT / RISK_REWARD_HINT)
- DP-OP10 raw payload / identityInput / candle raw array 직접 노출 0건. primaryTimeframe scalar read 만 허용
- DP-OP11 등급 코드 산출 0건
- DP-OP12 candidateKey 재계산 0건 (signalCycle.candidateKey 그대로 복사. S1 검증)
- U-OP-1 Option A: 6-field field-by-field fallback (Extra-B 검증)
- U-OP-2 Option A: payload.ts only (Extra-D 검증)
- U-OP-3: persistence && persistence.isSameCandidate === false defensive check (S7 검증)
- notificationType 6 후보 (NONE / WATCH / READY / BLOCKED / COOLDOWN / EXPIRED)
- snapshotType 6 후보 (NONE / CANDIDATE / STATE_CHANGE / COOLDOWN / EXPIRED / DEBUG)
- evaluationType 5 후보 (NONE / WATCH_24H / PLAN_24H / COOLDOWN_REVIEW / EXPIRED_REVIEW)
- notificationChannel 2 후보 (NONE / TELEGRAM_CANDIDATE)
- snapshotBucket 4 후보 (NONE / CANDIDATE_SNAPSHOT / STATE_SNAPSHOT / DEBUG_SNAPSHOT)
- evaluationWindow 3 후보 (NONE / 24H / 7D)
- severity 5 후보 (none / info / notice / warning / critical)
- 외부 전송 / 영속 저장 / network fetch / DOM / storage / clock API / bot secret / chatId / apiKey 0건
- 실거래 / 주문 / 알림 / 렌더 / 외부 신호 / 등급 코드 0건
- frozen input 안전성 검증 (Extra-E)

## v0.7.0 핵심 메모 (이전 단계, hotfix 반영)

```text
- v3/v3-card-view-model.js 신규 생성 1건 (hotfix 반영본)
- 보호 파일 15종 모두 무손상 (v3 *.js 10종 + index/manifest/sw 3종 + CODE_CONTRACT + WORKFLOW_TEMPLATE)
- WS3_CODE_CONTRACT.md 미수정 (b-r2 박제본 그대로)
- WS3_WORKFLOW_TEMPLATE.md 미수정 (v0.1 박제본 그대로)
- DP-UI1 ~ DP-UI11 r0.2-final 매핑 모두 적용 / 미해결 항목 0건
- 5종 입력 (payload / scoreBreakdown / structureDecision / signalCycle / strategyPlan) mutation 모두 0건 (DP-UI1, smoke 6 시나리오 검증)
- DP-UI3 출력 7대 영역 (identity / header / chips / metrics / sections / displayFlags / tone)
- DP-UI4 metrics 는 array (S1~S8 smoke 검증)
- DP-UI5 라벨은 labelKey + labelKo + labelEn (badge/chip/metric 동일, smoke 검증)
- DP-UI6 tone semantic token 8종만 (positive/neutral/caution/warning/muted/info/critical/unknown). 색상 코드 0건
- DP-UI7 displayFlags 정확히 10 boolean (isReady/isBlocked/isCooldown/isExpired/isWeakening/isHighActionability/showEntryPlan/showExitPlan/showRiskWarning/showDebug)
- DP-UI8 debug 기본 숨김. allowedFields 기본 빈 배열. identityInput / candles / rawCandles / candleArrays / raw / builderDebug 영구 차단 (BLOCKED_FIELDS, Extra-B smoke 검증)
- DP-UI9 sections 7개 (overview / score / structure / cycle / strategy / risk / debug)
- DP-UI10 P-S / P-A / P-B 최종 알림 등급 표시 0건
- DP-UI11 numeric hint 는 sections.strategy / sections.risk 만 (S7 smoke 검증)
- header.primaryBadge 는 strategyBias 우선 (S5 cooldown smoke 검증)
- 8개 라벨 사전 (STRATEGY_BIAS/CYCLE_STATE/CYCLE_PHASE/ACTIONABILITY/PLAN_QUALITY/STRUCTURE_BUCKET/PRICE_ZONE/RISK_LEVEL)
- 명령 어조 / 구버전 라벨 (buySignal/stopLossHint/takeProfitHint/planGradeHint/매수하세요/매도하세요) 잔존 0건
- 외부 호출 / DOM / 브라우저 storage / KV / network fetch 0건
- 런타임 clock API 사용 0건
- 실거래 / 주문 / 알림 / 렌더 / 외부 신호 0건
- frozen input 안전성 검증 (Extra-E)
- N-UI-OBS-3 정정: identityInput 영구 차단 (whitelist 와 무관, Extra-B 검증)

## v0.6.0 핵심 메모 (이전 단계)

```text
- v3/v3-strategy-plan.js 신규 생성 1건 (commit 8ebba40)
- 보호 파일 14종 모두 무손상 (v3 *.js 9종 + index/manifest/sw 3종 + CODE_CONTRACT + WORKFLOW_TEMPLATE)
- WS3_CODE_CONTRACT.md 미수정 (b-r2 박제본 그대로)
- WS3_WORKFLOW_TEMPLATE.md 미수정 (v0.1 박제본 그대로)
- DP-STRAT1 ~ DP-STRAT11 + U-STRAT-1 Option B 모두 적용 / 미해결 항목 0건
- payload / scoreBreakdown / structureDecision / signalCycle mutation 모두 0건 (DP-STRAT1, smoke 12 시나리오 검증)
- 4축 분류: 10 strategyBias + 7 planType + 5 actionability + 7 planQualityTier (독립 산출)
- entryPlan/exitPlan/riskControls 후보 산출 (실제 주문 지시 아님)
- U-STRAT-1 Option B: 'TOP_NEAR' (priceZone.zone) / 'ABOVE_BOX_CONFIRMED_CANDIDATE' (structureBucket) 매핑 적용
- ABOVE_BOX 추격 default false (cfg.risk.allowChaseAboveBox)
- 구버전 손절·익절 라벨 잔존 0건 (invalidationHint/targetHint 표준화)
- 등급 코드 산출 0건 (planQualityTier는 backtest 통계용)
- 외부 호출 / DOM / 브라우저 storage / KV 0건
- 런타임 clock API 사용 0건
- 실거래 / 주문 / 알림 / UI / 외부 신호 0건

## v0.5.0 핵심 메모 (이전 단계)

```text
- v3/v3-signal-cycle.js 신규 생성 1건
- 보호 파일 13종 모두 무손상 (v3 *.js 8종 + index/manifest/sw 3종 + CODE_CONTRACT + WORKFLOW_TEMPLATE)
- WS3_CODE_CONTRACT.md 미수정 (b-r2 박제본 그대로)
- WS3_WORKFLOW_TEMPLATE.md 미수정 (v0.1 박제본 그대로)
- DP-CYC1 ~ DP-CYC11 + U-CYC-1 Option A 모두 적용 / 미해결 항목 0건
- payload / scoreBreakdown / structureDecision / previousSignalState mutation 모두 0건 (DP-CYC1, smoke 검증)
- 8 cycleState + 5 cyclePhase + 7 bucketFamily 분류
- candidateKey = exchange:market:timeframe:bucketFamily (DP-CYC3)
- previousSignalState Case A full / Case B minimal 두 형식만 허용 (DP-CYC2)
- 저장소 read/write 0건 (KV / 브라우저 storage / DB / snapshot)
- ready threshold 임시: minConfidence=40, minTotalScore=30 (DP-CYC8, backtest 후 조정)
- strengthen/weaken delta ±5/±10 OR 조건. mixedDelta → PERSISTING + warning (DP-CYC9)
- cooldown bars 3, maxAgeBars 20 (임시, backtest 후 조정)
- EXPIRED 1-turn 전환 (DP-CYC11)
- currentTs: payload.ts → primary candle.ts → null (U-CYC-1 Option A)
- 런타임 clock API 사용 0건 (DP-CYC10)
- grade / strategyBias / entryPlan / exitPlan 미산출
- 외부 호출 / DOM / 브라우저 storage / KV 0건

## v0.4.0 핵심 메모 (이전 단계)

```text
- v3/v3-structure-bucket.js 신규 생성
- 13 structureBucket + confidence 0~100
- payload.structure.structure (CASE B 이중 nesting)
- touch count는 v3-indicators 출력 재사용
- riskPenalty 미반영 (DP-STR8)

## v0.3.0 핵심 메모 (이전 단계)

```text
- v3/v3-score-breakdown.js 신규 생성
- 100점 만점: core 25 + structure 20 + volume 20 + momentum 15 + execution 20
- riskPenalty 최대 15 (default risk이면 penalty 0 — DP-S4)
- payload mutation 0건 (DP-S1)
- grade / tier / label / 등급 코드 미산출 (DP-S5)
- indicator state 라벨 활용
```
