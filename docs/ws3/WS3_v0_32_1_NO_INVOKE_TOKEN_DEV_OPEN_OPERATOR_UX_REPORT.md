# WS3 v0.32.1 — No Invoke Token / Dev Open Operator UX Patch 완료 보고

**작성일**: 2026-05-20
**branch**: `claude/heuristic-cori-7865e7`
**이전 functional baseline**: WS3 v0.32.0 V2-grade Operator Console Fast Track Pack (`519b094`)
**본 단계 산출**: 1 worker 보강 + 2 console 동기화 수정 + 1 신규 보고서 + 2 문서 갱신 (총 6 staged)

---

## 1. 목적

사용자 명시 방향:

```text
지금은 속도를 높이는 단계다.
보안장치는 최종 배포할 때 추가한다.
현재 자연검증/실사용 단계에서 Invoke Token 입력은 불필요하다.
v2처럼 웹에 접속해서 바로 사용할 수 있어야 한다.
```

본 patch의 목적:

```text
1. 사용자가 Invoke Token을 한 번도 입력하지 않게 한다.
2. Worker Endpoint 입력도 없앤다.
3. Console 접속 후 바로 scan / preview / limited live 수동 발송 흐름으로 간다.
4. 최종 보안 구조는 TODO로 문서화만 한다.
```

본 patch는 **보안 강화가 아니라 실사용 UX 속도 개선 패치**.

한 줄 정의: **v0.32.1 = Dev Open Operator Mode. operator-UX routes (state / multi-candidate-dry-run / send-limited-live-alert / live-preflight / candidate-dry-run)는 Invoke Token 없이 호출 가능. side-effect 위험 routes (send-canary / cleanup-confirm / operator-reset / send-candidate-test)는 token check 유지. invite gate 우회.**

---

## 2. v0.32 운영 유지 상태 (재인용)

```text
WS3_LIMITED_LIVE_ENABLED=true 유지
32-market preset 안정
v0.32 UI 9 묶음 모두 작동 (production 자연검증 PASS)
HOT_REVIEW=0 / WATCH_REVIEW=7 / LOW_SIGNAL=22 (자연검증 결과)
failCount=3 (KRW-MANA / KRW-AAVE / +1, 자연 변동)
Cron disabled / 자동 알람 disabled / candidate 저장 disabled / tracking 시작 disabled
```

본 patch는 위 운영 상태 그대로 두고 인증 UX만 완화.

---

## 3. 왜 Invoke Token UX를 제거했는지

```text
- v0.31 ~ v0.32 자연검증 동안 매 Worker 호출마다 token 입력 필요 → 운영자 UX 큰 마찰
- token UI가 있어도 client-side에 token이 잠시 머무는 시점 존재 (입력 직후, header set 전)
- token을 HTML/JS에 박아 넣는 식은 보안 더 약해질 뿐 (front-end secret)
- 자연검증/실사용 단계에서는 token 자체를 요구하지 않는 게 정직하고 깔끔
- 최종 배포 단계에서는 Cloudflare Access / server-side token custody / Pages Function proxy
  로 token UX를 다시 설계 (front-end가 token을 보지 않는 구조)
```

---

## 4. Dev Open Operator Mode 범위

### 4.1 Token 없이 허용 (Dev-open operator routes)

```text
GET  /state
POST /multi-candidate-dry-run
POST /send-limited-live-alert
POST /live-preflight
POST /candidate-dry-run
```

이유: 운영자 일상 워크플로우 (스캔 → 후보 검토 → 선택 카드 수동 발송)에 필요한 routes.

### 4.2 Token check 유지 (Side-effect risk routes)

```text
POST /send-canary           — 첫 실 Telegram canary 발송 (1-time guard)
POST /cleanup-confirm       — cleanupRequired KV write 정리
POST /operator-reset        — alreadySent=true → false 전환 + resetCount 증가 (1 KV write)
POST /send-candidate-test   — Telegram 발송 (TEST_ONLY / FORCED 모드, 별도 confirmPhrase)
```

이유: 일반 운영 플로우가 아닌 reset / cleanup / canary / forced test 경로. 잘못 클릭하면 KV write / Telegram 실 발송 발생. token 없는 호출은 worker가 즉시 차단.

### 4.3 web UI 측

- Section 1 Configuration: Worker Endpoint / Invoke Token 입력 input 제거 (hidden 으로만 back-compat 유지)
- Section 3 Cleanup Confirm / Section 4 Send Canary / Section 4 Operator Reset / Section 9 Candidate TEST_ONLY: 버튼은 그대로 노출되지만 token 없이 호출 → worker가 MISSING_INVOKE_TOKEN 응답. 운영자가 잘못 누른 경우 안전 차단.
- Invite gate: hidden 처리 (코드 보존, 최종 보안 단계에서 재활성화 용이)

---

## 5. Token을 HTML에 박지 않는 원칙

```text
- Worker URL은 secret 아님 → 프론트에 상수로 둠 (WS3_DEFAULT_WORKER_ENDPOINT)
- Invoke Token은 secret → 프론트 어디에도 두지 않음
  · HTML 상수 X
  · JS 상수 X
  · data-* 속성 X
  · postMessage X
  · localStorage / sessionStorage / indexedDB / cookie X (기존 정책 그대로)
- dev-open 5 routes는 token check 자체를 worker에서 skip (token이 필요 없음)
- 잠금 4 routes는 worker가 token 부재 시 401 → 호출 차단 (token이 없으니 못 부름)
- 최종 보안 게이트에서:
  · Cloudflare Access 또는 Pages Function proxy로 server-side token custody
  · front-end는 token을 절대 보지 않음
  · invite gate / role separation 재설계
```

---

## 6. 코드 변경

### 6.1 Worker — `workers/ws3-telegram-canary-worker.js` (+ ~30 lines)

#### 6.1.1 신규 상수 + helper (line 150-159, after v0.31 LIMITED_LIVE block)

```js
// v0.32.1 — No Invoke Token / Dev Open Operator UX Patch
var WS3_OPERATOR_AUTH_MODE = 'DEV_OPEN';
function isDevOpenOperatorRoute(pathname) {
  return pathname === '/state'
    || pathname === '/multi-candidate-dry-run'
    || pathname === '/send-limited-live-alert'
    || pathname === '/live-preflight'
    || pathname === '/candidate-dry-run';
}
```

#### 6.1.2 Token check wrap (5개 endpoint)

각 dev-open endpoint의 기존 token check 3-block (missing / env-missing / mismatch) 을 `if (!isDevOpenOperatorRoute(path)) { ... }` 로 wrap. 기존 코드 자체는 보존 → 최종 보안 게이트에서 isDevOpenOperatorRoute 변경 또는 WS3_OPERATOR_AUTH_MODE flag 변경으로 즉시 재활성화 가능.

위치:
- `/state` (line 1917)
- `/live-preflight` (line 2233)
- `/candidate-dry-run` (line 2312)
- `/multi-candidate-dry-run` (line 2419)
- `/send-limited-live-alert` (line 2608)

#### 6.1.3 변경 없음 (의도적)

- `/send-canary` token check (line 1766) 그대로
- `/cleanup-confirm` token check (line 1999) 그대로
- `/operator-reset` token check (line 2087) 그대로
- `/send-candidate-test` token check (line 2474) 그대로
- KV write scope / Telegram fixed-text / duplicate guard / confirmPhrase / env-gate (`WS3_LIMITED_LIVE_ENABLED`) 모두 그대로
- VERSION 상수 `WS3_v0.31.0_web_first_minimum_operator_mode` 유지 (response shape 변경 0건이라 version 미변경)

### 6.2 Web Console — `web/ws3-canary-console.html` (+ ~30 / − ~25 lines)

#### 6.2.1 invite gate hidden

```html
<section id="inviteGate" class="section invite-gate" aria-label="Invite Gate" hidden>
```

(section 자체 + 내부 코드 모두 보존, hidden 속성만 추가)

#### 6.2.2 `<main hidden>` → `<main>`

```html
<main id="consoleApp" class="console-app">
```

#### 6.2.3 Section 1 Configuration UI 변경

```text
before:
  Worker Endpoint input (type=text, 사용자 입력)
  Invoke Token input (type=password, 사용자 입력)

after:
  Worker Endpoint 표시 (panel display, "ws3-telegram-canary.neosiwon.workers.dev")
  Operator Mode: DEV_OPEN
  Token input: disabled
  <input id="endpoint" type="hidden" value="https://...workers.dev">
  <input id="token" type="hidden" value="">
```

hidden inputs는 기존 JS refs (endpointEl / tokenEl)와의 back-compat을 위해 유지.

#### 6.2.4 Dev Open Banner (Section 1 위)

```html
<div class="section" id="devOpenBanner" style="border:1px solid #ec9; background:#fff8e7; ...">
  <strong>Operator Mode: DEV OPEN</strong>
  | Invoke Token input disabled | Endpoint preset
  Final security (Cloudflare Access / server-side token custody / origin allowlist) deferred to final deploy gate.
</div>
```

#### 6.2.5 JS dependency 제거

```js
var WS3_DEFAULT_WORKER_ENDPOINT = 'https://ws3-telegram-canary.neosiwon.workers.dev';

function safeEndpoint() {
  // Always return the preset endpoint (dev-open mode).
  if (endpointEl && typeof endpointEl.value === 'string' && endpointEl.value.replace(...).length > 0) return endpointEl.value.replace(...);
  return WS3_DEFAULT_WORKER_ENDPOINT;
}
function readTokenAndClear() {
  // Dev-open mode: no token input. Returns null.
  if (tokenEl) tokenEl.value = '';
  return null;
}
function postJson(url, token, body) {
  var headers = { 'Content-Type': 'application/json' };
  if (typeof token === 'string' && token.length > 0) headers['X-WS3-Canary-Token'] = token;
  return fetch(url, { method:'POST', headers:headers, body:JSON.stringify(body||{}), ... });
}
function getJson(url, token) {
  var headers = {};
  if (typeof token === 'string' && token.length > 0) headers['X-WS3-Canary-Token'] = token;
  return fetch(url, { method:'GET', headers:headers, ... });
}
```

dev-open 5개 button handler (checkBtn / lpRunBtn / cdrRunBtn / mcRunBtn / llSendBtn) 에서 `if (!token) { ...MISSING_INVOKE_TOKEN... }` 제거. 4개 잠금 handler (sendBtn / cleanupBtn / operatorResetBtn / ctSendBtn) 은 그대로 — token 없으면 client-side에서 즉시 MISSING_INVOKE_TOKEN 차단 (worker 차단 + UI 안내 이중).

#### 6.2.6 [A] textarea label fix (v0.32 자연검증 minor finding 통합)

```text
before: <label for="mc_markets">Markets (콤마 또는 줄바꿈, 최대 10)</label>
after:  <label for="mc_markets">Markets (콤마 또는 줄바꿈, 최대 50)</label>
```

v0.31.0-fix-1에서 worker / web validation / request 모두 cap=50으로 갱신했으나 label 표기 누락. 32-market preset 사용 시 label과 실 동작 불일치. 본 patch에 통합.

### 6.3 Web Console mirror — `web/ws3-canary-console/index.html`

byte-for-byte mirror 유지.

---

## 7. 허용 routes / 잠금 routes 매트릭스

| Route | Method | Dev-open? | Token | Worker side check |
|---|---|---|---|---|
| `/state` | GET | ✅ | skip | Origin only |
| `/live-preflight` | POST | ✅ | skip | Origin + manualTrigger |
| `/candidate-dry-run` | POST | ✅ | skip | Origin + manualTrigger |
| `/multi-candidate-dry-run` | POST | ✅ | skip | Origin + manualTrigger |
| `/send-limited-live-alert` | POST | ✅ | skip | Origin + manualTrigger + confirmPhrase + WS3_LIMITED_LIVE_ENABLED env-gate + per-(market,timeframe) KV guard |
| `/send-canary` | POST | ❌ | required | Origin + Token + AUTHORIZED_AT + ENABLED + GATE3 + KV alreadySent guard + circuit |
| `/cleanup-confirm` | POST | ❌ | required | Origin + Token + cleanupRequired check |
| `/operator-reset` | POST | ❌ | required | Origin + Token + 7-condition check + circuit |
| `/send-candidate-test` | POST | ❌ | required | Origin + Token + manualTrigger + confirmPhrase + WS3_CANDIDATE_TEST_ENABLED + duplicate guard |

→ dev-open 5 routes는 token 없이도 정상 동작. 잠금 4 routes는 token 필수 (web UI에서는 자동으로 token=null로 호출 → worker가 MISSING_INVOKE_TOKEN 차단).

---

## 8. 남은 final security TODO

```text
- Cloudflare Access 재검토 (front-end에서 token을 절대 보지 않는 server-side custody)
- Pages Function proxy 검토 (web → Pages Function → worker, token은 Function에만)
- server-side token 보관 (Cloudflare secrets / KV)
- origin allowlist 재정리 (현재 Pages-only)
- invite gate 재활성화 또는 대체 (CF Access 토대 위에서 재설계)
- operator role 분리 (read-only viewer / scan operator / send operator)
- production release 전 보안 검증 단계 (별도 게이트)
- 잠금 4 routes (send-canary / cleanup-confirm / operator-reset / send-candidate-test) 호출 경로는
  production release 시 별도 운영자 도구 (CLI / 보안 영역)로 이전 고려
```

---

## 9. 필수 테스트 결과

### 9.1 정적 테스트

```text
node --check workers/ws3-telegram-canary-worker.js                                → WORKER_PARSE_OK
diff -q web/ws3-canary-console.html web/ws3-canary-console/index.html             → 0건 (byte-for-byte mirror)
git diff --stat HEAD -- [보호 파일군]                                              → 빈 출력 (diff 0건)
```

### 9.2 Embedded JS parse

```text
<script> 블록 2개 (4428 + 75100+ chars)
new Function(block) ALL_BLOCKS_OK
```

### 9.3 Storage 검사

```text
grep "localStorage|sessionStorage|indexedDB|document.cookie" web/
  → 정책 문맥만 (line 128, 559 — "저장하지 않는다" / "사용 0건")
  → 실제 호출 0건
```

### 9.4 Token UI 제거 검사

```text
grep "type=\"text\".*id=\"endpoint\"|type=\"password\".*id=\"token\"" web/
  → 0건 (사용자 입력 UI 제거 완료, hidden 으로만 back-compat)
```

### 9.5 Worker scope (KV write 추가 0건)

```text
변경 endpoint = 5 dev-open routes만 token check wrap. KV write / Telegram 호출 로직 변경 0건.
기존 KV write scope (CANDIDATE_TEST_GUARD_ONLY / LIMITED_LIVE_GUARD_ONLY / alreadySent / cleanupRequired / operatorReset / invokeTokenMismatch) 그대로 유지.
새 putJson / 새 KV write 추가 0건.
```

### 9.6 Leak 검사

```text
- 노출된 폐기 hash repo-wide 매치 0건
- KV namespace ID 노출 0건
- Invoke Token 노출 0건 (`Invoke Token`/`X-WS3-Canary-Token` 매치는 정책 / 코드 문맥만)
- raw Telegram response / raw exchange full response — 정책 문맥만
- 매수 추천 / 진입 추천 / 수익 보장 / 확정 신호 / LIVE BUY — 0건
- masked / first-4 / last-4 / redacted preview — 0건
- URL query parameter token 전달 — 0건
- console.log 출력 — 0건
```

---

## 10. 보호 파일 무손상

```text
worker.js                                   ✅ 미수정
wrangler.toml                               ✅ 미수정
index.html (본선)                           ✅ 미수정
manifest.json                               ✅ 미수정
service-worker.js                           ✅ 미수정
v3/ (25종)                                  ✅ 미수정
docs/ws3/WS3_CODE_CONTRACT.md               ✅ 미수정
docs/ws3/WS3_WORKFLOW_TEMPLATE.md           ✅ 미수정
workers/ws3-canary-state-kv-adapter.js      ✅ 미수정
wrangler-canary.example.toml                ✅ 미수정
.gitignore                                  ✅ 미수정
wrangler-canary.toml                        ✅ 미트래킹 유지 (5 env vars 그대로, LIMITED_LIVE_ENABLED=true 운영)
workers/ws3-telegram-canary-entry.mjs       ✅ 미스테이지 유지
```

---

## 11. Cloudflare 변경 0건 (본 commit 시점)

```text
- Worker 재배포 0건
- Pages 재배포 0건 (deploy gate에서 별도 진행)
- KV namespace 생성/변경 0건
- KV binding 변경 0건
- secrets 변경 0건
- WS3_CANARY_ALLOWED_ORIGINS / WS3_TELEGRAM_CANARY_ENABLED / WS3_TELEGRAM_CANARY_AUTHORIZED_AT / WS3_CANDIDATE_TEST_ENABLED / WS3_LIMITED_LIVE_ENABLED 모두 변경 0건
- 실 Telegram API 호출 0건
- 실 KV write 0건
- 실 endpoint 호출 0건
- 실 거래소 API 호출 0건
```

---

## 12. 의도된 미구현 / deploy validation 간소화

```text
- v0.32.1 deploy gate (별도):
  1. Worker redeploy (5 dev-open routes wrap 반영)
  2. Pages redeploy (invite gate hidden / token UI 제거 / banner 추가 / label fix)
  3. Production console 접속 → invite/token 없이 바로 UI 표시 확인
  4. 32-market scan 1회 → dashboard / top5 / filter / preview 확인
  5. Limited Live 실제 발송: 발송 로직 미변경이므로 필수 아님 (v0.31 검증 그대로)
- final security gate (별도, production release 전):
  Cloudflare Access / Pages Function proxy / server-side token / invite gate 재활성화 등
```

---

## 13. 자연검증 누적 항목 (코드 변경 X, 누적 관찰)

```text
[B] failCount=3 (v0.31.1 1건 → 3건)
  관측: KRW-MANA, KRW-AAVE + 1
  자연 변동 가능성 — 1회로 단정 불가. 추가 자연검증 누적 후 patch 판단.

[C] WATCH_REVIEW 분포 (자연검증 1회)
  관측: HOT=0 / WATCH=7 / LOW=22 (7/29 = 24%)
  운영자 검토 부담 적정. 추가 누적 후 임계값 미세 조정 가능성.
```

본 patch에는 [B] [C] 코드 변경 없음 — 추가 자연검증 누적 후 별도 patch에서 처리.

---

## 14. 기준 commit

- branch: `claude/heuristic-cori-7865e7`
- 이전 functional baseline: WS3 v0.32.0 V2-grade Operator Console Fast Track Pack (`519b094`)
- 본 commit: (push 후 기록, push 별도 승인)

---

## 15. 이번 단계의 핵심

```text
지금은 최종 보안 배포가 아니다.
지금은 빠른 웹 실사용화 단계다.
Invoke Token 입력은 제거한다.
보안은 최종 배포 전 별도 단계에서 다시 설계한다.
HTML/JS에 token을 숨겨 넣지 않는다.
사용자 UX는 v2처럼 간단해야 한다.
Worker 5 dev-open routes는 token 없이 동작.
Worker 4 잠금 routes는 token check 그대로 유지 (잘못 누른 운영자 안전 차단).
invite gate 코드 보존 / 최종 보안 단계에서 재활성화 용이.
[A] textarea label "최대 10" → "최대 50" 통합 (v0.32 자연검증 minor finding).
[B] failCount [C] WATCH 분포 — 자연검증 누적 후 별도 patch.
```
