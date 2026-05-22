# WS3 브랜치 파일 지도 (Claude Web 새 채팅 첫 메시지용)

핵심 규칙: **코드/필드 경로를 추측하지 말 것. 아래 전체 raw URL 을 fetch 해서 실제 파일을 읽고 작업할 것.**
(box.boxHigh / cfg.CLASSIFIER_THRESHOLDS.CURRENT_PHASE 등 추측 오류가 v0.45~0.47 에서 반복됨)

- repo: neosiwon/crypto-scanner-v2 (PUBLIC)
- branch: claude/heuristic-cori-7865e7  /  고정 커밋 SHA: d568f8f
- 현재 운영 VERSION: WS3_v0.47.0_current_phase (Worker) / Pages = v0.48.0 배선

---

## 1. 편집 대상 (패치 작성 시 현재 상태 fetch 후 작업)

worker 본체 (10183줄 / 421KB — ⚠️ 한 번에 fetch 시 잘릴 수 있음 / 필요 함수 구역만 Claude Code 에 요청):
https://raw.githubusercontent.com/neosiwon/crypto-scanner-v2/d568f8f/workers/ws3-telegram-canary-worker.js

config — 모든 임계값/상수 + WS3_DISPLAY 라벨맵 + HEADER_SLOT 계약 (v3 중 유일 수정 허용):
https://raw.githubusercontent.com/neosiwon/crypto-scanner-v2/d568f8f/v3/v3-config.js

운영 카드 UI 셸 — renderSec1~16 + ⚠️ 색/디자인 토큰(:root CSS 변수 --bg/--cy/--gSP 등)은 여기 있음:
https://raw.githubusercontent.com/neosiwon/crypto-scanner-v2/d568f8f/web/ws3-canary-console/index.html

## 2. Stage 2(표현/셸) 우선 읽기 (위 3개 + 아래 2개)

카드 ViewModel — sections 7개 + metrics 계약(labelKey/labelKo/labelEn/value/kind/tone/sortKey):
https://raw.githubusercontent.com/neosiwon/crypto-scanner-v2/d568f8f/v3/v3-card-view-model.js

renderer binding:
https://raw.githubusercontent.com/neosiwon/crypto-scanner-v2/d568f8f/v3/v3-renderer-binding.js

⚠️ 정정: "디자인 토큰·색 계약"은 v3-config.js 가 아니라 index.html :root CSS 에 있음.
   v3-config.js 는 매매 상수 + WS3_DISPLAY 라벨맵 + HEADER_SLOT_PRIORITY/DISPLAY (헤더 슬롯 계약).
   카드 섹션 구조/슬롯 = v3-card-view-model.js.

## 3. v3 모듈 (박제 = 변경 0 / 읽기 전용 / 필드 경로 확인용 — 추측 금지, 여기서 grep)

https://raw.githubusercontent.com/neosiwon/crypto-scanner-v2/d568f8f/v3/v3-indicators.js
https://raw.githubusercontent.com/neosiwon/crypto-scanner-v2/d568f8f/v3/v3-feature-payload.js
https://raw.githubusercontent.com/neosiwon/crypto-scanner-v2/d568f8f/v3/v3-feature-payload-builder.js
https://raw.githubusercontent.com/neosiwon/crypto-scanner-v2/d568f8f/v3/v3-score-breakdown.js
https://raw.githubusercontent.com/neosiwon/crypto-scanner-v2/d568f8f/v3/v3-structure-bucket.js
https://raw.githubusercontent.com/neosiwon/crypto-scanner-v2/d568f8f/v3/v3-signal-cycle.js
https://raw.githubusercontent.com/neosiwon/crypto-scanner-v2/d568f8f/v3/v3-strategy-plan.js
https://raw.githubusercontent.com/neosiwon/crypto-scanner-v2/d568f8f/v3/v3-active-cycle.js
https://raw.githubusercontent.com/neosiwon/crypto-scanner-v2/d568f8f/v3/v3-evaluation-outcome.js
https://raw.githubusercontent.com/neosiwon/crypto-scanner-v2/d568f8f/v3/v3-evaluation-observation-adapter.js
https://raw.githubusercontent.com/neosiwon/crypto-scanner-v2/d568f8f/v3/v3-operation-packet.js
https://raw.githubusercontent.com/neosiwon/crypto-scanner-v2/d568f8f/v3/v3-transport-plan.js
https://raw.githubusercontent.com/neosiwon/crypto-scanner-v2/d568f8f/v3/v3-external-confluence.js
https://raw.githubusercontent.com/neosiwon/crypto-scanner-v2/d568f8f/v3/v3-bithumb-client.js
https://raw.githubusercontent.com/neosiwon/crypto-scanner-v2/d568f8f/v3/v3-candle-normalizer.js
https://raw.githubusercontent.com/neosiwon/crypto-scanner-v2/d568f8f/v3/v3-telegram-canary-sender.js
https://raw.githubusercontent.com/neosiwon/crypto-scanner-v2/d568f8f/v3/v3-live-execution-preflight-gate.js
https://raw.githubusercontent.com/neosiwon/crypto-scanner-v2/d568f8f/v3/v3-secure-binding-gateway-contract.js
https://raw.githubusercontent.com/neosiwon/crypto-scanner-v2/d568f8f/v3/v3-secure-runtime-state-adapter.js
https://raw.githubusercontent.com/neosiwon/crypto-scanner-v2/d568f8f/v3/v3-secure-transport-executor-contract.js
https://raw.githubusercontent.com/neosiwon/crypto-scanner-v2/d568f8f/v3/v3-transport-execution-adapter.js
https://raw.githubusercontent.com/neosiwon/crypto-scanner-v2/d568f8f/v3/v3-transport-executor-harness.js
https://raw.githubusercontent.com/neosiwon/crypto-scanner-v2/d568f8f/v3/v3-transport-executor-interface-adapter.js
https://raw.githubusercontent.com/neosiwon/crypto-scanner-v2/d568f8f/v3/v3-transport-executor-sandbox-runner.js

## 4. 핵심 문서

https://raw.githubusercontent.com/neosiwon/crypto-scanner-v2/d568f8f/docs/ws3/WS3_CURRENT_BASELINE.md
https://raw.githubusercontent.com/neosiwon/crypto-scanner-v2/d568f8f/docs/ws3/WS3_CHANGELOG.md
https://raw.githubusercontent.com/neosiwon/crypto-scanner-v2/d568f8f/docs/ws3/WS3_WHITEPAPER_TRACKING_MATRIX_v0.1.md
https://raw.githubusercontent.com/neosiwon/crypto-scanner-v2/d568f8f/docs/ws3/WS3_CODE_CONTRACT.md
https://raw.githubusercontent.com/neosiwon/crypto-scanner-v2/d568f8f/docs/ws3/WS3_WORKFLOW_TEMPLATE.md

---

## 5. 작업 규칙

1. 패치는 git format-patch 형식 (Claude Code 가 git am --3way 로 적용). base = SHA d568f8f.
2. v3 모듈 변경 0 (v3-config.js만 예외). docs 0. main merge/PR 금지.
3. 모든 상수 = WS3_CONFIG 박제 (magic number 0).
4. 필드 경로는 §3 모듈을 fetch 해서 확인 (추측이 v0.45~0.47 버그 원인).
5. raw·KV id·토큰 등 민감값 출력 금지.
