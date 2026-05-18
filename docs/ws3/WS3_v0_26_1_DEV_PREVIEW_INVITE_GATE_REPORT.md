# WS3 v0.26.1 — Dev Preview Lightweight Invite Gate 완료 보고

**작성일**: 2026-05-18
**branch**: `claude/heuristic-cori-7865e7`
**이전 functional baseline**: WS3 v0.26.0 Production Web Console Hosting (`55a00d8`)
**본 단계 산출**: 2 console 파일 수정 + 1 신규 보고서 + 2 문서 갱신 (5 staged)

---

## 1. 목표 (실코인 연결 아님 / Cloudflare Access 보류)

v0.26.0 까지 박제됐던 "Cloudflare Access 필수 / Access 없는 public Pages 비채택" 정책을 **Dev Preview 단계용으로 amendment** 하여, Cloudflare Access 대신 **lightweight client-side invite gate** 를 적용. production-grade 운영 / 실코인 연결 단계 진입 시 Cloudflare Access 재검토.

본 단계 목적:
1. Web Console 앞단에 lightweight invite gate 추가
2. invite code 통과 전 console UI 완전 숨김 (`<main hidden>`)
3. invite code 통과 상태는 메모리에만 유지 (storage 사용 0건, 새로고침 시 재인증)
4. 실 worker action 은 기존 `WS3_CANARY_INVOKE_TOKEN` + server-side guard 로 계속 보호
5. Cloudflare Access 는 보류 (정책 amendment 박제)
6. Pages deploy 0건 (별도 Gate)
7. 실제 invite code 원문 / 실 SHA-256 hash repo commit 0건 (placeholder 만 commit)

한 줄 정의: **v0.26.1 = Production Access 아님, Dev Preview Invite Gate.**

---

## 2. v0.26.0 정책 amendment

### 2.1 v0.26.0 박제 정책 (변경 전)

```text
Cloudflare Access 필수
Access 없는 public Pages 비채택
```

### 2.2 v0.26.1 변경 정책

```text
Cloudflare Access      → 지금은 보류, production-grade 운영 / 실코인 연결 전 재검토
Pages deploy           → Dev Preview 용도로 가능하되 이번 단계 미실행
Console 보호           → lightweight invite gate
Worker action 보호     → 기존 Invoke Token + server-side guard 유지 (변경 0건)
```

### 2.3 변경 이유

- 현재 단계 = 개발 / 친구·지인 테스트 목적
- Cloudflare Zero Trust 설정 학습 / 운영 비용이 큼
- 운영자 email allowlist 관리보다 가벼운 테스트 접근성 우선

### 2.4 변경 영향 (Layer 1 약화 / Layer 2-3 유지)

```text
Layer 1 (UI 노출 차단):
  v0.26.0  = Cloudflare Access (network-level, identity verified) ← 강
  v0.26.1  = client-side invite gate (DOM 조작 / hash 추출 / brute force 가능) ← 약

Layer 2 (Worker action 호출 차단):
  WS3_CANARY_INVOKE_TOKEN — 동일 유지

Layer 3 (Worker server-side guard):
  canaryEnabled / alreadySent / cleanupRequired / currentPhase / persistent KV / operator-reset 7중 조건 — 동일 유지
```

실 위험 변화: UI 노출 차단 강도만 약화. **Telegram 발송 / KV write / operator-reset 위험은 Layer 2/3 이 계속 방어** — 본 amendment 가 worker action 위험을 높이지 않음.

### 2.5 향후 재적용 조건

- production-grade 운영 단계 진입 시 Cloudflare Access 재검토
- 실코인 연결 단계 진입 전 (v0.27 진입 전) 재검토 권장
- 사용자 명시 결정 시 즉시 Access 적용 가능 (코드 변경 0건, Cloudflare 측 dashboard 작업만)

---

## 3. 파일 변경

### 3.1 `web/ws3-canary-console.html` (수정)

466 → 641 라인 (+175). 변경 요약:
- 신규 `<section id="inviteGate">` prepend — invite code 입력칸 + Enter 버튼 + status panel
- 기존 5-section UI (Configuration / Status / Controlled Operation / Danger Zone / Safe Result) 를 `<main id="consoleApp" hidden>` 으로 wrap
- CSS: `.invite-gate` / `.invite-status` (err/warn/ok 3-state) 추가
- 신규 IIFE `<script>` 블록 (4428 chars) — invite gate 로직 (placeholder check / SHA-256 / constant-time compare / 5회/60초 throttle / 새로고침 시 재인증)
- 기존 IIFE `<script>` 블록 (11257 chars) — 변경 0건 (DOM hidden 상태에서도 init 정상 동작)

### 3.2 `web/ws3-canary-console/index.html` (수정)

466 → 641 라인 (+175). `web/ws3-canary-console.html` 의 byte-for-byte mirror.

```bash
diff -q web/ws3-canary-console.html web/ws3-canary-console/index.html
# 출력: 없음 (diff 0건)
wc -c web/ws3-canary-console.html web/ws3-canary-console/index.html
# 25087 / 25087 → 일치
```

---

## 4. invite gate 구조

### 4.1 DOM 구조

```html
<h1>WS3 Canary Console</h1>

<section id="inviteGate" class="section invite-gate" aria-label="Invite Gate">
  <p class="lead">Dev Preview ... 안내</p>
  <div class="row">
    <label for="inviteCodeInput">Invite Code</label>
    <input id="inviteCodeInput" type="password" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" data-1p-ignore data-bwignore data-lpignore maxlength="128" placeholder="...">
  </div>
  <div class="row">
    <button id="inviteEnterBtn" type="button" class="primary">Enter</button>
  </div>
  <div class="row">
    <div id="inviteStatus" class="invite-status">상태: 대기</div>
  </div>
</section>

<main id="consoleApp" class="console-app" hidden>
  ... existing 5 sections ...
</main>
```

성공 시:
```js
inviteGateEl.hidden = true;
consoleAppEl.hidden = false;
```

### 4.2 placeholder hash 상수

```js
var WS3_INVITE_CODE_SHA256 = 'REPLACE_WITH_INVITE_CODE_SHA256';
```

deploy 전 별도 Gate 에서 실 SHA-256 (lowercase hex 64자) 으로 교체. commit 0건.

### 4.3 placeholder 감지

```js
function isPlaceholderHash(h) {
  if (typeof h !== 'string') return true;
  if (h === 'REPLACE_WITH_INVITE_CODE_SHA256') return true;
  if (!/^[0-9a-f]{64}$/.test(h)) return true;
  return false;
}
```

placeholder 상태에서 verifyInviteCode → `PLACEHOLDER — deploy gate 에서 실 hash 주입 필요` 표시 후 hash 비교 0회 (성공 통과 불가능).

### 4.4 SHA-256 + constant-time 비교

```js
function sha256Hex(input) {
  if (!window.crypto || !window.crypto.subtle) {
    return Promise.reject(new Error('WEBCRYPTO_UNAVAILABLE'));
  }
  var enc = new TextEncoder();
  var data = enc.encode(input);
  return window.crypto.subtle.digest('SHA-256', data).then(function(buf) {
    var arr = new Uint8Array(buf);
    var hex = '';
    for (var i = 0; i < arr.length; i++) {
      var h = arr[i].toString(16);
      if (h.length === 1) hex += '0';
      hex += h;
    }
    return hex;
  });
}

function constantTimeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  var diff = 0;
  for (var i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
```

native `===` 대신 char XOR accumulation 로 timing leak 최소화. JS engine 최적화로 인한 약화 가능성은 있으나 client-side gate 한계 내에서 best-effort.

### 4.5 5회 / 60초 throttle (메모리 only)

```js
var inviteFailureCount = 0;
var inviteThrottleUntilMs = 0;
var THROTTLE_LIMIT = 5;
var THROTTLE_DURATION_MS = 60 * 1000;
```

- 5회 연속 실패 시 60초 disable (`THROTTLED — N초 후 재시도`)
- counter / timestamp **메모리 변수만** 사용
- localStorage / sessionStorage / IndexedDB / cookie 사용 0건
- 새로고침 시 counter reset 허용 (best-effort, UX/노이즈 억제용)

### 4.6 통과 후 처리

```js
function showConsole() {
  inviteGateEl.hidden = true;
  consoleAppEl.hidden = false;
  inviteFailureCount = 0;
  inviteThrottleUntilMs = 0;
}
```

- `inviteCodeInput.value = ''` (verifyInviteCode 진입 직후 즉시 클리어)
- 초대코드 원문 변수 저장 0건 (`input = null` 명시 해제)
- 통과 상태 storage 저장 0건 → 새로고침 시 invite gate 재표시

---

## 5. invite code commit 정책 (옵션 A 채택)

### 5.1 옵션 비교

| 옵션 | 장점 | 단점 |
|---|---|---|
| **A: placeholder commit** ✅ | hash 가 git history 에 0건 / 초대코드 원문/해시 모두 repo 박제 0건 / deploy 전 사용자가 직접 hash 주입 | Pages deploy 전 manual 교체 필요 |
| B: 실 hash commit | deploy 즉시 동작 | hash 가 public source / git history 에 박제 / entropy 낮으면 brute force 가능 / rotation 시 commit 필요 |

### 5.2 v0.26.1 결정

```text
옵션 A 채택 — placeholder 상태로만 commit
```

정책:
- 초대코드 원문 commit **금지** (채팅 / 문서 / log 노출 0건)
- 실 SHA-256 hash 값 commit **금지**
- Pages deploy 전 별도 Gate 에서 hash 교체 (working copy only, commit 0건)

### 5.3 Pages deploy 전 절차 (별도 Gate)

```text
1. 사용자가 실제 invite code 결정 (외부, 채팅 노출 금지)
2. SHA-256 hash 생성 (사용자 측 도구 또는 별도 Step)
3. web/ws3-canary-console/index.html (또는 deploy asset) placeholder → 실 hash 교체
4. 필요 시 web/ws3-canary-console.html 도 동일 교체
5. commit 없이 deploy 용 working copy 에서만 사용 (또는 .gitignore 처리)
6. Pages deploy
```

---

## 6. client-side invite gate 한계 (재인용)

### 6.1 DOM inspect 우회 가능

```text
공격자 DevTools 작업:
  inviteGate.hidden = true
  consoleApp.hidden = false

→ console UI 자체는 노출.
  단, 실 worker action 은 Invoke Token 없이는 불가.
```

### 6.2 SHA-256 hash 추출 가능

HTML source 에 hash 상수가 노출되면 offline brute force / rainbow table / 짧은 초대코드 추측 가능.

완화:
- 초대코드 **16자 이상 랜덤 권장**
- 짧은 단어 / 이름 / 생일 / 프로젝트명 금지
- 유출 의심 시 즉시 hash rotation + Pages redeploy

### 6.3 Network pattern 학습 가능

정상 통과자 / source 분석자는 endpoint / API 패턴 노출. 자체 도구 작성 가능. 단, 실 호출에는 여전히:
- Invoke Token
- Origin allowlist 통과
- Worker server-side gate 통과

모두 필요.

### 6.4 초대코드 공유 / 유출 가능

운영 가이드:
- 신뢰 가능한 지인에게만 공유
- 유출 의심 시 hash 교체 + Pages redeploy
- Invoke Token 은 사용자 본인 외 절대 공유 금지
- `CANARY_ENABLED=false` 유지

---

## 7. 정적 검증

### 7.1 storage / cookie API grep

```bash
grep -Rni "localStorage|sessionStorage|indexedDB|document.cookie" web/
```

결과: 매치 4건 (양쪽 파일 각 2건). 모두 **정책 부정문맥** (`"... 에 저장하지 않는다"` / `"... 사용 0건"`). 실제 storage API 호출 **0건**.

### 7.2 resetCount UI 표시 grep

```bash
grep -Rni "resetCount" web/
```

결과: 매치 6건 (양쪽 파일 각 3건). 모두 footnote / Danger Zone warn / 코드 주석 (`"// Whitelist: ... Do NOT show resetCount"`). 실 DOM set **0건**.

### 7.3 placeholder hash grep

```bash
grep -Rni "REPLACE_WITH_INVITE_CODE_SHA256|WS3_INVITE_CODE_SHA256" web/
```

결과: 매치 12건 (양쪽 파일 각 6건). placeholder 정상 존재 — comment / const / isPlaceholderHash check / verifyInviteCode 분기 / 초기 paint.

### 7.4 secret value grep

```bash
grep -Rni "bot_token|chat_id|message_id|first-4|last-4|masked|redacted" web/
```

결과: 매치 4건 (양쪽 파일 각 2건). 모두 정책 / 안내 문맥 (intro note + footnote). 실 값 **0건**.

### 7.5 두 파일 byte-for-byte diff

```bash
diff -q web/ws3-canary-console.html web/ws3-canary-console/index.html
# 출력 없음 (diff 0건)
wc -c web/ws3-canary-console.html web/ws3-canary-console/index.html
# 25087 / 25087 → 일치 (641 라인 동일)
```

### 7.6 JS parse

embedded `<script>` 블록 2개:
- Block 0 (invite gate IIFE): 4428 chars — `new Function(js)` parse OK
- Block 1 (console IIFE): 11257 chars — `new Function(js)` parse OK (v0.26.0 그대로)

### 7.7 보호 파일 diff

```bash
git diff --stat HEAD -- worker.js wrangler.toml index.html manifest.json service-worker.js docs/ws3/WS3_CODE_CONTRACT.md docs/ws3/WS3_WORKFLOW_TEMPLATE.md v3/ workers/ wrangler-canary.example.toml .gitignore
```

결과: 빈 출력 = **0건** ✅

- 본선 `worker.js` / `wrangler.toml` (repo 미존재) / `index.html` / `manifest.json` / `service-worker.js` — 미수정
- `v3/` 25종 엔진 — 미수정
- `docs/ws3/WS3_CODE_CONTRACT.md` / `WS3_WORKFLOW_TEMPLATE.md` — 미수정
- `workers/ws3-telegram-canary-worker.js` / `workers/ws3-canary-state-kv-adapter.js` — 미수정 (v0.25.0 그대로)
- `wrangler-canary.example.toml` / `.gitignore` — 미수정

---

## 8. local staging 테스트 항목 12건 vs 정적 검증

지시서 §14 12 항목 중 본 Gate 에서 정적 검증 가능:

| # | 항목 | 결과 |
|---|---|---|
| 1 | 두 URL 모두 로드 가능한 구조 | ✅ 두 파일 동일 콘텐츠, index.html 자동 routing 가능 |
| 2 | 최초 진입 시 invite gate 표시 | ✅ `<section id="inviteGate">` always-visible, `<main hidden>` |
| 3 | console UI hidden | ✅ `<main id="consoleApp" hidden>` |
| 4 | 잘못된 초대코드 입력 시 오류 표시 | ✅ verifyInviteCode → `INVALID_INVITE_CODE (N/5)` |
| 5 | placeholder 상태 통과 불가능 | ✅ `isPlaceholderHash` 분기 — hash 비교 0회 |
| 6 | 통과 흐름 hash 교체 후 deploy gate | ✅ 본 단계 미실행 (정책 박제만) |
| 7 | 새로고침 시 invite gate 재표시 | ✅ 통과 상태 storage 0건, 메모리 only |
| 8 | Check State / Send Canary / Cleanup Confirm / Operator Reset UI 보존 | ✅ 기존 5-section 전체 유지, IIFE 변경 0건 |
| 9 | resetCount 표시 0건 | ✅ DOM set 0건 (코드 주석/footnote 정책 외) |
| 10 | localStorage/sessionStorage 사용 0건 | ✅ 정적 grep 정책 부정문맥만 |
| 11 | token query parameter 사용 0건 | ✅ X-WS3-Canary-Token 헤더만 사용 |
| 12 | mobile viewport 깨짐 없음 | ✅ v0.26.0 CSS 유지 (`min-height: 44px` / `@media (max-width: 420px) button { width: 100% }` / `* { box-sizing: border-box }`) |

브라우저 실 동작 검증 (사용자 키 입력 / 새로고침 / mobile viewport 등) 은 별도 staging Gate.

---

## 9. 이번 단계에서 하지 않는 것 (재인용)

```text
Cloudflare Access 설정 0건
Cloudflare Zero Trust 설정 0건
Pages deploy 0건
Worker redeploy 0건
WS3_CANARY_ALLOWED_ORIGINS 변경 0건
CANARY_ENABLED=true 변경 0건
Send Canary 클릭 0건
/send-canary 실 호출 0건
/cleanup-confirm 실 호출 0건
/operator-reset 실 호출 0건
/state 실 호출 0건
Telegram API 호출 0건
KV write 0건
실코인 연결 0건
PR / main merge 0건
push 0건 (별도 Gate)
```

v0.26.1 = 코드 / 문서 수정 + 정적 검증 + commit 까지만. push 별도 승인.

---

## 10. 보안 / 누출 검증

- 실제 invite code 원문 — repo / 채팅 / 보고서 / 로그 노출 **0건**
- 실제 SHA-256 hash 값 — repo / 채팅 / 보고서 / 로그 노출 **0건** (placeholder 만 박제)
- bot token / chatId / invoke token 실 값 — 노출 **0건**
- KV namespace ID — 노출 **0건**
- Telegram message_id / raw Telegram response — 노출 **0건**
- Origin 실 값 / IP / cookie / session id / browser fingerprint — 노출 **0건**
- masked / first-4 / last-4 / redacted preview — **0건**
- localStorage / sessionStorage / IndexedDB / document.cookie 호출 — **0건**
- URL query parameter token / invite code 전달 — **0건**
- `console.log` 출력 — **0건**

---

## 11. Pages deploy 정책 (별도 Gate)

```text
v0.26.1 이후 Pages deploy:
  1. 사용자가 실 invite code 결정 (외부, 채팅 노출 금지)
  2. SHA-256 hash 생성
  3. HTML placeholder → 실 hash 교체 (working copy only)
  4. commit 0건
  5. Pages deploy
  6. Pages origin Worker allowlist 추가 결정 (별도 Step)
  7. localhost 제거 결정 (별도 Step)

주의:
  Access 없는 deploy → invite gate 는 가벼운 보호장치일 뿐
  실 worker action 은 Invoke Token 없이 불가
```

---

## 12. v0.27 진입 전 보안 재평가

v0.27 Actual Coin Live Preflight 진입 전 재평가:

```text
- Cloudflare Access 재적용 여부
- invite gate 유지 여부 (또는 Access 와 동시 적용)
- 실코인 연결 시 page-level 보호 강화 필요 여부
- invoke token rotation 여부
- origin allowlist 정책 (production-only)
```

권장: **실코인 연결 전 Cloudflare Access 또는 동등한 page-level 보호 재검토.**

---

## 13. v0.26.x / v0.27+ 다음 단계 후보

- **v0.26 Production Pages Deploy Gate** (별도 단계, invite hash 교체 + Pages deploy)
- **v0.26.x**: build script / shared source 도입 (현재 두 파일 byte-for-byte 동일 → 자동 동기화)
- **v0.27**: Actual Coin Live Preflight (실코인 데이터를 canary/live execution 경로에 넣기 전 preflight layer)
- **v0.28+**: Snapshot / Evaluation / Audit KV write boundary
- worker `/state` response 자체에서 resetCount 제거 (v0.27+, 현재는 UI 비노출만)
- env-based resetPhrase / circuit reset endpoint / failure counter reset endpoint
- invoke token rotate automation
- ipHash + `WS3_CANARY_HASH_SALT`

---

## 14. 기준 commit

- branch: `claude/heuristic-cori-7865e7`
- 이전 functional baseline: WS3 v0.26.0 Production Web Console Hosting (`55a00d8`)
- 본 commit: (push 후 기록, push 별도 승인)

---

## 15. 이번 단계의 핵심 (재인용)

```text
v0.26.1 = Cloudflare Access 단계 아님
v0.26.1 = Dev Preview lightweight invite gate 단계
친구/지인 테스트용 가벼운 접근 제한만 제공
초대코드 통과 전 console UI 완전 숨김 (<main hidden>)
초대코드 통과 상태 저장 0건 (storage 사용 0건, 새로고침 시 재인증)
client-side gate 우회 가능 (DOM/hash/network 분석)
실 worker action 은 기존 Invoke Token + server-side guard 가 보호
실 invite code 원문 / 실 hash repo commit 0건 (placeholder 만)
```

---

## 16. Final Pages Deploy Result

본 섹션은 v0.26.1 코드 commit (`634093d`) 이후 실제 Cloudflare Pages 배포 + Worker allowlist 임시 추가/제거 + production console 1회 한정 Check State 검증까지 마친 결과 박제다. 코드 변경 0건 / tracked source 변경 0건 / hash 또는 raw invite code repo 박제 0건 / Telegram 발송 0건 / KV write 0건 / Worker action 호출 0건.

- Pages project: `ws3-canary-console`
- Production URL: `ws3-canary-console.pages.dev`
- Invite gate: **active** (lightweight Dev Preview, placeholder hash → 실 SHA-256 hash 로 working copy 1회 substitution → Pages deploy)
- Cloudflare Access: **deferred by user decision** (v0.26.0 정책 amendment, production-grade 운영 / 실코인 연결 전 재검토)
- Worker allowlist (최종): **`https://ws3-canary-console.pages.dev` only**
- localhost origin: **removed** (Phase 2 적용, Step F 완료)
- Final Check State (Step G 사용자 브라우저 검증):
  - `version=WS3_v0.25.0_operator_reset_state_lifecycle`
  - `persistenceAvailable=true`
  - `canaryEnabled=false`
  - `alreadySent=false`
  - `cleanupRequired=false`
  - `circuitOpen=false`
  - `currentPhase=RESET_CONFIRMED`
- Send Canary count during this gate: **0**
- Cleanup Confirm count during this gate: **0**
- Operator Reset count during this gate: **0**
- Telegram API calls during this gate: **0**
- KV writes during this gate: **0**
- `CANARY_ENABLED=false` maintained
- `AUTHORIZED_AT=0` maintained
- raw invite code **not recorded** (사용자 본인 메모리/vault 외 어디에도 보관 0건)
- SHA-256 hash **not committed** (placeholder `REPLACE_WITH_INVITE_CODE_SHA256` 박제 유지, `git grep` repo-wide 결과 hash 매치 0건)
- Invoke Token **not recorded**
- KV namespace ID **not recorded**

### 16.1 Gate 진행 흐름 박제 (Step A → G)

```text
Step A (사용자):  invite code 결정 + PowerShell SHA-256 hash 생성 (raw code 채팅 노출 0건)
Step B (자동):    .tmp_pages_deploy/ws3-canary-console/index.html 생성 → 임시 substitution → wrangler pages deploy
                  → branch alias 배포됨 (--branch=main 미지정, wrangler default = current git branch)
                  → temp cleanup → tracked diff 0건 확인
Step B' (자동):   사용자 옵션 A 결정 — production URL 활성화 위해 corrective deploy
                  → wrangler pages deploy ... --branch=main 1회
                  → ws3-canary-console.pages.dev 활성화 → temp cleanup → tracked diff 0건 확인
Step C (사용자):  production URL 접속 → invite gate 표시 / 잘못된 코드 차단 / 실 invite code 통과 후 console UI 표시
                  → Worker Endpoint / Invoke Token 입력 0건 / Check State 0건
Step D (자동):    wrangler-canary.toml WS3_CANARY_ALLOWED_ORIGINS 임시 확장
                  = "http://localhost:8788,https://ws3-canary-console.pages.dev" (Phase 1, localhost 검증용 임시 유지)
                  → wrangler deploy --config wrangler-canary.toml 1회 (Worker Version 39c8ca59)
                  → safety vars 유지: CANARY_ENABLED=false / AUTHORIZED_AT=0
Step E (사용자):  production console 에서 Worker Endpoint / Invoke Token 입력 → Check State 1회 클릭
                  → 7-field whitelist 전부 PASS / Send Canary / Cleanup Confirm / Operator Reset 클릭 0건
Step F (자동):    wrangler-canary.toml WS3_CANARY_ALLOWED_ORIGINS 정정
                  = "https://ws3-canary-console.pages.dev" (Phase 2, localhost 제거)
                  → wrangler deploy --config wrangler-canary.toml 1회 (Worker Version 45fd4787)
                  → wrangler binding display 에서 풀값 노출 확인 / safety vars 유지
Step G (사용자):  final production Check State 1회 → 동일 결과 PASS / Worker action 호출 0건
```

### 16.2 한계 재확인 (v0.26.1 amendment 박제)

- 본 Pages Deploy Gate = Dev Preview 단계. Cloudflare Access **미적용**.
- client-side invite gate = DOM inspect / hash 추출 / network 분석 / 초대코드 공유로 우회 가능.
- 단 실 worker action 은 다음 모두 필요: Invoke Token (Layer 2) + Origin allowlist (`https://ws3-canary-console.pages.dev`) + Worker server-side guard (Layer 3, 7중 조건 + persistent KV + currentPhase).
- production-grade 운영 / 실코인 연결 전 Cloudflare Access 재검토 권장 (v0.27 진입 전).

### 16.3 다음 단계 후보

```text
v0.27 = Actual Coin Live Preflight (실코인 데이터 preflight layer, 실 알림 연결 전 단계)
v0.26.x = build script / shared source 도입 (두 console 파일 자동 동기화)
worker /state response 자체에서 resetCount 제거 (v0.27+)
env-based resetPhrase / circuit reset endpoint / failure counter reset endpoint
invoke token rotate automation / ipHash + WS3_CANARY_HASH_SALT
Cloudflare Access 재적용 (production-grade 운영 / 실코인 연결 전)
```
