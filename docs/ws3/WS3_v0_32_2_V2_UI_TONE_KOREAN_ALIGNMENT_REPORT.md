# WS3 v0.32.2 — v2 UI 톤 이식 + 한글 우선 문구 정렬 완료 보고

**작성일**: 2026-05-20
**branch**: `claude/heuristic-cori-7865e7`
**이전 functional baseline**: WS3 v0.32.1 No Invoke Token / Dev Open Operator UX Patch — Live Validation Success (`c6d06d6`)
**본 단계 산출**: 2 Web Console 동기화 보강 + 1 신규 보고서 + 2 문서 갱신 (총 5 staged) / Worker 미수정

---

## 1. 목적

기능 확장 아님. 백서 정렬 + v2 실사용 감성 강화.

```text
1. 기존 WOOS v2의 UI 톤을 WS3 콘솔에 이식
2. v0.32에서 남은 불필요한 영어 UI 문구를 한글 우선으로 정리
3. 기능 로직 미변경, 실사용 체감 완성도 상승
```

한 줄 정의: **v0.32.2 = v2 UI 톤 이식 (다크 네이비 / 글래스 / 시안 네온 / 그리드 / 글로우) + 한글 우선 라벨 정리. 기능 변경 0건. Worker 미수정.**

---

## 2. 백서 기준 (재인용)

```text
1. 기존 v2에서 가져올 것: 디자인 톤 + ViewModel 분리 철학
2. v2의 관심 / 정밀 / 표준 / 24h 퍼센트 / 진행도 의미 가져오지 않음
3. v2 데이터 구조 / active tracking / completed history / 분석기 state pipeline 가져오지 않음
4. V3/WS3는 독립 앱으로 유지
5. 사용자 표시 등급은 S+ 표기 (SPLUS / splus 사용자 노출 금지)
6. 전통 캔들명 (도지 / 망치 / 장악형) 핵심 판단 라벨 금지
7. 구조값 중심 표현 유지
```

본 patch는 위 기준 7개 모두 준수.

---

## 3. v2 UI 톤 참고 범위

`index.html` (root) read-only 참고. 추출한 톤 변수:

```text
색상:
  --bg-primary: #080d13
  --bg-secondary: #0c1420
  --bg-card: #0f1a27
  --bg-panel: #111e2e
  --border: #1a2d42
  --border-bright: #243d57
  --accent-cyan: #00d4ff      ← 핵심 시안 네온
  --accent-green: #00e676
  --accent-orange: #ff8c42
  --accent-red: #ff4560
  --accent-yellow: #ffd600
  --text-primary: #e2eaf5
  --text-secondary: #7a9ab8
  --text-muted: #3d5a72

폰트:
  --mono: 'JetBrains Mono'
  --sans: 'Noto Sans KR'

글로우:
  --glow-cyan: 0 0 12px rgba(0,212,255,0.4)
  --glow-green: 0 0 12px rgba(0,230,118,0.4)
  --glow-red: 0 0 12px rgba(255,69,96,0.4)

배경 그리드:
  linear-gradient(rgba(0,212,255,0.025) 1px, transparent 1px),
  linear-gradient(90deg, rgba(0,212,255,0.025) 1px, transparent 1px);
  background-size: 32px 32px;

기타:
  --radius: 6px
  글래스 카드 / 시안 포인트 / 칩 톤
```

참고만 함. v2 로직 / DOM / 데이터 / class 이름 복사 0건.

---

## 4. 가져온 것

```text
✓ 다크 네이비 배경 (--bg-primary #080d13)
✓ 글래스 카드 (--bg-card #0f1a27 + border)
✓ 시안 네온 포인트 (--accent-cyan #00d4ff)
✓ 부드러운 glow (--glow-cyan / --glow-red / --glow-orange)
✓ 배경 그리드 (body::before 32px×32px)
✓ JetBrains Mono / Noto Sans KR 폰트
✓ 카드 shell (border + bg-card)
✓ chip 톤 (.ws3-tab / .lvl-badge / panel chip)
✓ 모바일 카드 간격
✓ 버튼 톤 (primary cyan / danger red / controlled yellow)
✓ 상태 색상 (READY cyan / OK green / ERROR red / BLOCKED orange)
✓ 텍스트 hierarchy (text-primary / text-secondary / text-muted)
```

---

## 5. 가져오지 않은 것 (의도적 차단)

```text
× v2 관심 / 정밀 / 표준 / 24h 퍼센트 / 진행도 의미
× v2 active tracking / completed history 데이터 구조
× v2 분석기 state pipeline
× v2 ViewModel / state 의미
× v2 logic / DOM 구조 / class 이름
× SPLUS / splus 사용자 표기
× 전통 캔들명 (도지 / 망치 / 장악형) UI 라벨
```

---

## 6. 한글 우선 문구 정리 내역

### 6.1 헤더 / Section 제목

```text
WS3 Canary Console → WS3 운영 콘솔
1. Configuration → 1. 설정
2. Status → 2. 상태
3. Controlled Operation → 3. 정리 확인
4. Danger Zone → 4. 위험 영역
5. Safe Result → 5. 결과
6. Live Preflight (v0.27 read-only) → 6. 시세 미리보기
7. Candidate Dry-run (v0.28 read-only) → 7. 단일 코인 점수
8. Multi-market Candidate Dry-run (v0.29 read-only) → 8. 다종목 스캔
9. Candidate TEST_ONLY Telegram Send (v0.30 — normal + forced mode) → 9. 테스트 알림 발송
10. Limited Live Mode → 10. 제한 운영 모드
11. Minimum Operator Mode (v0.31 LIMITED LIVE / OPERATOR REVIEW) → 11. 운영자 검토 발송
```

### 6.2 Section 8 sub-panel 헤더

```text
Operator Dashboard Summary → 운영 요약
Top 5 Operator Review Candidates → 상위 후보 5개
Candidate List → 후보 목록
Failed Markets (safe error code only) → 실패 마켓 (안전 코드만 표시)
Memory-only Scan History (max 5 runs, no storage) → 최근 스캔 기록 (최대 5회, 메모리 전용)
Filter (filter tabs) → 필터
HOT_REVIEW / WATCH_REVIEW / LOW_SIGNAL (dashboard card label) → HOT / WATCH / LOW
Last scan → 최근 스캔
Operator review total → 검토 대상
Candidates → 후보
```

### 6.3 Section 11 sub-panel 헤더

```text
Selected Candidate (preview) → 선택 후보 미리보기
Telegram Message Preview (display only · no API call · no token leak) →
  텔레그램 미리보기 (표시 전용 · API 호출 없음 · 토큰 노출 없음)
Recent LIMITED LIVE Sent History (max 5, memory-only, no KV) →
  최근 발송 기록 (최대 5건, 메모리 전용, KV 저장 0건)
Limited Live Mode → 제한 운영 모드
Manual operator only → 수동 운영자 전용
Auto Telegram → 자동 텔레그램
Tracking → 자동 추적
Cron → Cron (그대로, 기술 용어)
Allow Operator Review send → 운영자 검토 발송 허용
```

### 6.4 버튼 라벨

```text
Check State → 상태 확인
Cleanup Confirm → 정리 확인
Send Canary → 카나리 발송
Operator Reset → 운영자 리셋
Reset Phrase → 리셋 문구
Run Live Preflight → 시세 미리보기 실행
Run Candidate Dry-run → 단일 코인 점수 실행
Run Multi-market Dry-run → 스캔 실행
Load Upbit KRW preset → 업비트 원화 프리셋 불러오기
Send Candidate TEST_ONLY → 테스트 알림 발송
Send LIMITED LIVE / OPERATOR REVIEW → 제한 운영 알림 보내기
```

### 6.5 input label

```text
Worker Endpoint → Worker 엔드포인트
Invoke Token → (UI 제거됨, v0.32.1)
Operator Mode → 운영 모드
Token input → 토큰 입력
Exchange → 거래소
Market → 마켓
Markets (콤마 또는 줄바꿈, 최대 50) → 마켓 목록 (콤마 또는 줄바꿈, 최대 50)
Timeframe → 타임프레임
Limit → 캔들 수
Selected Candidate (Section 8 결과에서 1건 선택) → 선택 후보 (8번 스캔 결과 중 1건)
Forced Test Mode → 강제 테스트 모드
Forced Test Reason → 강제 테스트 사유
Confirm Phrase → 확인 문구
Selected Operator Review Card → 검토 대상 카드
```

### 6.6 상태 / 안내문

```text
status: READY → 상태: READY (상태값 코드는 그대로)
Dev Open Operator Mode / Operator Mode: DEV OPEN → 운영 모드: 개발 개방(Dev Open)
Invoke Token input disabled → 호출 토큰 입력 없음
Endpoint preset → 엔드포인트 자동 설정
Final security ... deferred → 최종 보안 강화 ... 별도 단계에서 다시 적용
Manual test only → 수동 테스트 전용
DISABLED → 사용 안 함
DISABLED until env enable → env 활성화 필요
none → 없음
```

### 6.7 영어 병기 정책

```text
운영자 검토(Operator Review) — UI 안내문에서 필요시 병기
제한 운영(Limited Live) — UI 안내문에서 필요시 병기
개발 개방(Dev Open) — UI 안내문에서 필요시 병기
P-S / P-A / P-B / P-C — 등급 코드 그대로 (기술 용어)
HOT / WATCH / LOW — 운영자 검토 레벨 짧은 표기 (badge 영역)
Telegram message_id / bot_token / chat_id / KV namespace ID — 정책 금지 표기 그대로 (정책 안내 컨텍스트)
mode / messageType / fixedMessageUsed / telegramSent / kvWritten / kvWriteScope / candidateStored / trackingStarted — Worker 응답 raw key (디버깅/매핑 일관성 위해 그대로)
code / httpStatus — HTTP 응답 raw key (그대로)
Cron — 기술 용어 그대로
```

### 6.8 사용자 UI label에서 영어 단독 표기 제거 확인

```bash
grep -RnE "Operator Dashboard Summary|Top 5 Fixed Candidates|Failed Market List|Filter Tabs|Selected Candidate Preview|Telegram Message Preview|Memory-only Scan History|Memory-only Sent History" web/
→ 매치 0건 (사용자 UI 영어 단독 표기 모두 제거됨)
```

---

## 7. S+ / 전통 캔들명 금지 점검

```text
grep "SPLUS|splus|도지|망치|장악형" web/ → 사용자 UI 매치 0건 ✓
P-S / P-A / P-B / P-C 등급 코드는 사용 (기술 용어, 백서 허용 범위)
[CAND] / [OR] / [OP-REVIEW] 짧은 chip 라벨은 사용 (구조값 중심 표현)
reasonChips (VOLUME_SURGE / HIGH_CLOSE_POSITION / LOW_VOLUME / UPPER_WICK_RISK 등) 사용 — 구조값 chip, 전통 캔들명 아님
```

---

## 8. Worker 미수정

```text
workers/ws3-telegram-canary-worker.js diff 0건
VERSION 상수 WS3_v0.31.0_web_first_minimum_operator_mode 유지
Worker auth 경로 / KV write scope / Telegram fixed-text / duplicate guard / confirmPhrase / env-gate 모두 그대로
Worker redeploy 불필요 → Pages redeploy 1회만 후속
```

---

## 9. 기존 v0.32 기능 모두 유지

```text
✓ 운영 요약 (Dashboard Summary)
✓ 상위 후보 5개 (Top 5)
✓ 실패 마켓 목록 (Failed Markets)
✓ 필터 7종 + count badge (Filter Tabs)
✓ 선택 후보 미리보기 (Selected Candidate Preview)
✓ 텔레그램 미리보기 (Telegram Preview)
✓ 최근 스캔 기록 (Memory-only Scan History)
✓ 최근 발송 기록 (Memory-only Sent History)
✓ 32-market preset (업비트 원화 프리셋 불러오기)
✓ Dev Open route + token 없는 진입
✓ 모바일 카드 간격 + Mobile UX
```

기능 삭제 0건. ID / class / JS 변수 / 함수 / Worker 응답 매핑 모두 그대로.

---

## 10. 이번 작업에서 하지 않은 것

```text
× Worker auth 변경
× Worker route 변경
× Telegram 발송 로직 변경
× KV write scope 변경
× candidate 저장 추가
× tracking 시작 추가
× Cron 추가
× 자동 Telegram 추가
× Bithumb 전환
× P-grade / S+ 등급 체계 변경
× structureBucket 엔진 추가
× signalCycle 추가
```

Bithumb 전환 / 등급 정렬 / 구조 엔진은 후속 단계.

---

## 11. 필수 정적 테스트

```text
diff -q web/ws3-canary-console.html web/ws3-canary-console/index.html → 0건 (byte-for-byte mirror)
Embedded <script> parse: 2 blocks new Function(block) ALL_BLOCKS_OK
git diff --stat HEAD -- [보호 파일군] → 빈 출력 (Worker / root index / v3/ / CODE_CONTRACT / WORKFLOW_TEMPLATE / wrangler 등 0건)
영어 UI label 잔존 grep → 사용자 UI 매치 0건
SPLUS / splus / 도지 / 망치 / 장악형 grep → 사용자 UI 매치 0건
노출된 폐기 hash repo-wide 매치 0건
bot_token / chat_id / message_id / Invoke Token / SHA-256 hash / KV namespace ID / raw Telegram response / raw exchange full response — 정책 문맥만
매수 추천 / 진입 추천 / 수익 보장 / 확정 신호 / LIVE BUY — 0건
```

---

## 12. 보호 파일 무손상

```text
workers/ws3-telegram-canary-worker.js       ✅ 미수정
workers/ws3-canary-state-kv-adapter.js      ✅ 미수정
worker.js                                    ✅ 미수정
wrangler.toml                                ✅ 미수정
wrangler-canary.toml                         ✅ 미수정 / 미트래킹 유지 (5 env vars 유지)
wrangler-canary.example.toml                 ✅ 미수정
index.html (본선)                            ✅ 미수정 (참고만, read-only)
manifest.json                                ✅ 미수정
service-worker.js                            ✅ 미수정
v3/ (25종)                                   ✅ 미수정
docs/ws3/WS3_CODE_CONTRACT.md                ✅ 미수정
docs/ws3/WS3_WORKFLOW_TEMPLATE.md            ✅ 미수정
.gitignore                                   ✅ 미수정
workers/ws3-telegram-canary-entry.mjs        ✅ 미스테이지 유지
```

---

## 13. Cloudflare 변경 0건

```text
- Worker 재배포 0건
- Pages 재배포 0건 (deploy gate에서 별도 진행)
- KV namespace 0건
- secrets / env 0건
- Telegram API 0건
- KV write 0건
- 실 거래소 API 호출 0건
- 모든 endpoint 호출 0건
```

---

## 14. 남은 후속 과제

```text
- Bithumb 전환 (백서 v0 Bithumb-only 기준, 별도 단계)
- P-grade / S+ 등급 정렬 (현재 P-S / P-A / P-B / P-C / S+ 분리 — 추가 정렬 검토)
- structureBucket 엔진 추가 (백서 §13 / WS3_CODE_CONTRACT 준수)
- signalCycle / cyclePhase / bucketFamily 추가 (백서 §15)
- 백서 색상/카드 톤 자연검증 후 미세 조정 (모바일 dashboard / Top 5 wrap / preview 폰트)
- 한글 문구 자연검증 누적 후 미세 조정
- 모바일 UX 자연 검증
- Cron / 자동 Telegram / candidate KV 저장 / tracking 시작은 별도 사용자 명시 승인 전까지 계속 disabled
```

---

## 15. 기준 commit

- branch: `claude/heuristic-cori-7865e7`
- 이전 functional baseline: WS3 v0.32.1 No Invoke Token / Dev Open Operator UX Patch — Live Validation Success (`c6d06d6`)
- 본 commit: (push 후 기록, push 별도 승인)

---

## 16. 이번 단계의 핵심

```text
백서 기준으로 다시 정렬.
v2 UI 톤은 root index.html 코드에서 참고.
하지만 v2 데이터/의미는 가져오지 않음.
영어 UI 남발 제거.
한글 우선 원칙 적용.
속도 우선, 과잉 검증 금지.
기능 변경 0건 / Worker 미수정 / Pages redeploy 1회로 충분.
```
