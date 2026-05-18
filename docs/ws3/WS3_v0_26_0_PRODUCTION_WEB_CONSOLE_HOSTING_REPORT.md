# WS3 v0.26.0 — Production Web Console Hosting 완료 보고

**작성일**: 2026-05-18
**branch**: `claude/heuristic-cori-7865e7`
**이전 functional baseline**: WS3 v0.25.0 Operator Reset / State Lifecycle + Staging Success (`f2d7ddd`)
**본 단계 산출**: 1 수정 + 1 신규 entrypoint + 1 신규 보고서 + 2 문서 갱신

---

## 1. 목적

v0.26 은 **실코인 연결이 아니다**. v0.26 은 기존 local-only Web Console 을 production-safe static hosting 구조로 정리하는 단계.

- 실 Cloudflare Pages project 생성 0건
- 실 Cloudflare Access 정책 설정 0건
- 실 Cloudflare worker 재배포 0건
- 실 `WS3_CANARY_ALLOWED_ORIGINS` 변경 0건
- 실 `/send-canary` / `/cleanup-confirm` / `/operator-reset` 호출 0건
- 실 Telegram API 호출 0건
- 실 KV write 0건

---

## 2. v0.25 dependency 완료 상태 (입력)

```text
Cloudflare worker: WS3_v0.25.0_operator_reset_state_lifecycle
KV state: alreadySent=false / cleanupRequired=false / currentPhase=RESET_CONFIRMED / resetCount=1 / canaryEnabled=false / persistenceAvailable=true / circuitOpen=false
Safety: CANARY_ENABLED=false / Send Canary 0건 / Telegram 추가 발송 0건
```

worker / kv adapter / wrangler-canary.example.toml / .gitignore 모두 v0.25 commit (`f2d7ddd`) 상태 그대로 유지. v0.26 은 worker logic 수정 0건.

---

## 3. 핵심 결정 (4 정책 박제)

### 3.1 Cloudflare Access 필수

v0.26 production hosting 은 **Cloudflare Pages + Cloudflare Access 전제**. Access 없는 public Pages 는 비채택.

권장 Access 정책 (실 적용은 별도 deploy Gate):

```text
Cloudflare Zero Trust → Access → Applications
Application type: Self-hosted
Domain: <pages-project>.pages.dev
Policy: Email allowlist
Identity provider: Email OTP 또는 Google SSO
운영자 email 만 허용
```

### 3.2 localhost allowlist 정책 (2-phase)

```text
Phase 1 (production 검증 중):
  WS3_CANARY_ALLOWED_ORIGINS = http://localhost:8788,https://<pages-project>.pages.dev

Phase 2 (production 안정 후):
  WS3_CANARY_ALLOWED_ORIGINS = https://<pages-project>.pages.dev
```

원칙:
- localhost origin 영구 유지 금지
- staging 재테스트 시에만 일시 추가
- staging 종료 후 즉시 localhost 제거
- 본 Gate 에서 `WS3_CANARY_ALLOWED_ORIGINS` 실 변경 0건 (정책 박제만)

### 3.3 /state UI 표시 정책

UI 표시 허용 (8 fields):
```
ok / version / canaryEnabled / persistenceAvailable / alreadySent / cleanupRequired / circuitOpen / currentPhase
```

UI 표시 금지 (worker /state response 가 반환해도 UI 에서는 미표시):
```
resetCount / lastResetAt / lastSentAt / lastCleanupAt / sentAt / blockedUntil
failureCount / consecutiveFailures / Telegram message_id / raw Telegram response
token / chatId / invoke token / Origin 실제 값 / IP 실제 값 / KV namespace ID
```

중요: worker `/state` response 자체는 v0.25.0 그대로 10 fields (currentPhase + resetCount 포함). v0.26 은 worker logic 수정 없이 **Web Console UI 에서 resetCount 를 표시하지 않는** 방식으로 처리. response 자체에서 제거는 v0.27+ 후보.

### 3.4 파일 구조

```text
web/ws3-canary-console.html               ← staging 호환 (기존, 보강)
web/ws3-canary-console/index.html         ← production entrypoint (신규)
```

v0.26 에서는 두 파일 **byte-for-byte 동일** (diff 0건 검증 완료).

향후 v0.26.x 후보:
- build script / shared source 도입
- production entrypoint 빌드 자동화
- 두 파일 자동 동기화 hook

---

## 4. 파일 변경 (요약)

### 4.1 `web/ws3-canary-console.html` (수정)

158 → 466 라인 (+308). 기존 single Send Canary UI 를 5-section production-safe console 로 보강.

신규 구역:
1. Configuration — Worker Endpoint / Invoke Token
2. Status — Check State 버튼 + 7-field status panel (`/state` 호출)
3. Controlled Operation — Cleanup Confirm 버튼 (cleanupRequired-gated)
4. Danger Zone — Send Canary / Reset Phrase / Operator Reset (시각 분리 border + warning label)
5. Safe Result — code / httpStatus / messageType / fixedMessageUsed

### 4.2 `web/ws3-canary-console/index.html` (신규)

466 라인. 4.1 의 byte-for-byte mirror. production Cloudflare Pages entrypoint 후보.

```bash
diff web/ws3-canary-console.html web/ws3-canary-console/index.html
# 출력: 없음 (diff 0건 확인)
wc -c web/ws3-canary-console.html web/ws3-canary-console/index.html
# 18422 / 18422 → 일치
```

---

## 5. UI 구역 상세

### 5.1 Section 1: Configuration

| input | type | autocomplete | spellcheck | autocorrect | autocapitalize | data-* |
|---|---|---|---|---|---|---|
| Worker Endpoint | text | off | false | off | off | - |
| Invoke Token | password | off | false | off | off | data-1p-ignore / data-bwignore / data-lpignore |

### 5.2 Section 2: Status

Check State 버튼 → `GET /state` 호출 → 응답 본문에서 whitelist 7 fields 만 panel 에 표시:
- `version` / `persistenceAvailable` / `canaryEnabled` / `alreadySent` / `cleanupRequired` / `circuitOpen` / `currentPhase`

응답에 `resetCount` 가 포함되어도 UI 에는 표시하지 않음 (whitelist 비포함). 변수에도 저장하지 않음.

### 5.3 Section 3: Controlled Operation

Cleanup Confirm 버튼 → `POST /cleanup-confirm` (manualTrigger=true).

조건부 활성화:
```text
state.cleanupRequired === true
```

worker server-side gate 가 최종 판단 (UI 활성화는 보조 안전장치).

### 5.4 Section 4: Danger Zone

시각 분리 — `border: 2px solid #c66`, warning label, `class="danger"` 빨강 강조.

Send Canary 조건부 활성화:
```text
state.persistenceAvailable === true
state.canaryEnabled === true
state.alreadySent === false
state.cleanupRequired === false
state.circuitOpen === false
```

Reset Phrase 입력칸 (type=text, 패턴 byte 단위 비교).

Operator Reset 조건부 활성화:
```text
state.canaryEnabled === false
state.alreadySent === true
state.cleanupRequired === false
state.circuitOpen === false
resetPhrase === "RESET_WS3_CANARY_STATE"
```

worker server-side gate 가 최종 판단 (UI 활성화는 보조 안전장치).

### 5.5 Section 5: Safe Result

응답에서 whitelist 4 fields 만:
- `code` / `httpStatus` / `messageType` / `fixedMessageUsed`

`status` 는 별도 상단 status badge 에서 표시.

---

## 6. 보안 정책 적용

### 6.1 token 입력 보안

- `input type="password"`
- `autocomplete="off"` / `autocorrect="off"` / `autocapitalize="off"` / `spellcheck="false"`
- `data-1p-ignore` / `data-bwignore` / `data-lpignore` (1Password / Bitwarden / LastPass 무시)
- `maxlength="128"`
- **`localStorage` / `sessionStorage` / `IndexedDB` / `cookie` 사용 0건**
- URL query parameter 로 token 전달 0건
- `console.log(token)` 0건
- 각 요청 시점에 `readTokenAndClear()` → 로컬 변수에 1회 사용 후 즉시 `tokenEl.value = ''` 클리어
- Reset Phrase 도 응답 도착 직후 `resetPhraseEl.value = ''` 클리어

### 6.2 response 표시 정책 적용

- whitelist 매칭만 `applyState` / `applyResult` 에 통과
- 타입 검증 (typeof boolean / string / number) + 길이 제한 (string < 64 또는 96)
- `applyState` 코드 주석: `// Whitelist: assign each field independently. Do NOT show resetCount or any other field.`
- raw response JSON dump 없음 / Telegram message_id 출력 없음 / headers 표시 없음 / stack trace 표시 없음

### 6.3 fetch 옵션 일관

모든 호출 (`/state` GET / `/send-canary` POST / `/cleanup-confirm` POST / `/operator-reset` POST):
```text
mode: 'cors'
credentials: 'omit'
cache: 'no-store'
redirect: 'error'
```

### 6.4 meta-level

- `<meta name="robots" content="noindex,nofollow,noarchive">`
- `<meta http-equiv="X-Content-Type-Options" content="nosniff">`
- `<meta http-equiv="Referrer-Policy" content="no-referrer">`

---

## 7. UI 활성화 정책 (보조 안전장치)

| 버튼 | UI 조건 | server-side 최종 가드 |
|---|---|---|
| Check State | 항상 가능 (token 확인 후) | `/state` Origin allowlist + invoke token |
| Send Canary | persistenceAvailable / canaryEnabled / alreadySent=false / cleanupRequired=false / circuitOpen=false | v0.22.1 hard precondition AND + v0.23 persistent guard |
| Cleanup Confirm | cleanupRequired=true | `/cleanup-confirm` server gate |
| Operator Reset | canaryEnabled=false / alreadySent=true / cleanupRequired=false / circuitOpen=false / phrase exact | v0.25 7중 조건 + circuit + 60s cooldown |

UI 활성화 = 보조 안전장치. 최종 판단은 worker server-side gate.

---

## 8. mobile viewport 검증 정책

테스트 viewport (지시서 §11):
- 360x780
- 375x667
- 390x844
- 768x1024

본 console 적용:
- max-width: 520px (centered)
- @media (max-width: 420px) 적용: `button { width: 100%; }` / panel label min-width 축소
- input `min-height: 44px` / button `min-height: 44px`, `min-width: 120px` (mobile-friendly touch target)
- 가로 스크롤 없음 (max-width / box-sizing border-box / `* { box-sizing: border-box }`)

실 browser viewport 검증은 본 Gate 에서는 local staging server 미기동으로 정적 검증만 수행. 실 mobile 검증은 별도 staging Gate.

---

## 9. 정적 검증 결과

### 9.1 storage / cookie API grep

```bash
grep -Rni "localStorage|sessionStorage|indexedDB|document.cookie" web/
```

결과: 2건 매치 (양쪽 파일 동일 line). 매치 모두 **정책 부정문맥 단일 문장** (`"본 화면 / localStorage / sessionStorage / IndexedDB / cookie 에 저장하지 않는다."`). 실 storage API 호출 **0건**.

### 9.2 resetCount UI 표시 grep

```bash
grep -Rni "resetCount" web/
```

결과: 6건 매치 (양쪽 파일 동일 line). 모두 정책 / 주석 / warn 문구:
- footnote "표시 금지: resetCount..."
- Danger Zone warn "operator-reset 은 alreadySent=false 전환 + resetCount 증가 1회 KV write"
- 코드 주석 "Do NOT show resetCount or any other field"

실제 `resetCount` 값을 DOM 에 set 하는 코드 **0건**.

### 9.3 secret value grep

```bash
grep -Rni "bot_token|chat_id|message_id|first-4|last-4|masked|redacted" web/
```

결과: 정책 / 안내 문맥만 매치. 실제 값 노출 **0건**.

### 9.4 두 파일 byte-for-byte diff

```bash
diff -q web/ws3-canary-console.html web/ws3-canary-console/index.html
# 출력: 없음 (diff 0건)
wc -c web/ws3-canary-console.html web/ws3-canary-console/index.html
# 18422 / 18422
```

### 9.5 보호 파일 diff

```bash
git diff --stat HEAD -- worker.js wrangler.toml index.html manifest.json service-worker.js docs/ws3/WS3_CODE_CONTRACT.md docs/ws3/WS3_WORKFLOW_TEMPLATE.md v3/ workers/ wrangler-canary.example.toml .gitignore
```

결과: 빈 출력 = **0건** ✅

- 본선 `worker.js` / `wrangler.toml` (repo 미존재) / `index.html` / `manifest.json` / `service-worker.js` — 미수정
- `v3/` 25종 엔진 — 미수정
- `docs/ws3/WS3_CODE_CONTRACT.md` / `WS3_WORKFLOW_TEMPLATE.md` — 미수정
- `workers/ws3-telegram-canary-worker.js` / `workers/ws3-canary-state-kv-adapter.js` — 미수정
- `wrangler-canary.example.toml` / `.gitignore` — 미수정

### 9.6 JS parse

embedded `<script>` 블록 11257 chars Node `new Function(js)` parse 통과.

---

## 10. local staging 테스트 정책 (실 기동은 별도 단계)

지시서 §12 에 따른 local server 기동 흐름:

```bash
cd web
python -m http.server 8788
```

확인 URL 후보:
```text
http://localhost:8788/ws3-canary-console.html
http://localhost:8788/ws3-canary-console/
```

본 Gate 에서는 local server 실 기동 0건 — 정적 검증만 수행. 실 mobile viewport / 실 클릭 동작 검증은 별도 staging Gate.

지시서 §12 12개 항목 중 정적 검증 가능 항목:

| # | 항목 | 결과 |
|---|---|---|
| 3 | Send Canary 버튼 조건부 disabled | ✅ 초기 disabled 확인 (lastState=null) |
| 4 | Cleanup Confirm 버튼 조건부 disabled | ✅ 초기 disabled 확인 |
| 5 | Operator Reset 버튼 조건부 disabled | ✅ 초기 disabled 확인 |
| 6 | resetPhrase 입력칸 존재 | ✅ |
| 7 | resetCount 표시 0건 | ✅ DOM 에 set 하는 코드 0건 |
| 8 | localStorage/sessionStorage 사용 0건 | ✅ |
| 9 | token query parameter 사용 0건 | ✅ |
| 10 | Safe Result Panel raw response 미표시 | ✅ whitelist 4 fields 만 |
| 12 | 두 파일 diff 0건 | ✅ |

브라우저 동작 검증 (#1, #2, #11): 실 staging server Gate 에서 수행.

---

## 11. 보호 파일 무손상

```text
worker.js                                              — 미수정
wrangler.toml                                          — 미수정 (repo 미존재)
index.html                                             — 미수정
manifest.json                                          — 미수정
service-worker.js                                      — 미수정
docs/ws3/WS3_CODE_CONTRACT.md                          — 미수정
docs/ws3/WS3_WORKFLOW_TEMPLATE.md                      — 미수정
v3/ 25종 엔진                                          — 미수정
workers/ws3-telegram-canary-worker.js                  — 미수정 (v0.25.0 그대로)
workers/ws3-canary-state-kv-adapter.js                 — 미수정 (v0.25.0 그대로)
wrangler-canary.example.toml                           — 미수정
.gitignore                                             — 미수정
workers/ws3-telegram-canary-entry.mjs                  — 미스테이지 유지
wrangler-canary.toml                                   — 미스테이지 유지 (.gitignore)
.claude/                                               — 미스테이지 유지 (.gitignore)
.wrangler/                                             — 미스테이지 유지 (.gitignore)
.tmp_canary_*                                          — 미스테이지 유지 (.gitignore)
```

---

## 12. 보안 / 누출 검증

- bot token / chatId / invoke token 실제 값 — 코드 / 보고서 / 로그 노출 **0건**
- KV namespace ID — 노출 **0건**
- Telegram message_id / raw Telegram response — 노출 **0건**
- Origin 실제 값 / IP / cookie / session id / browser fingerprint — 노출 **0건**
- masked / first-4 / last-4 / redacted preview — **0건**
- localStorage / sessionStorage / IndexedDB / document.cookie 호출 — **0건**
- URL query parameter token 전달 — **0건**
- `console.log` 출력 — **0건**

---

## 13. production deploy 순서 박제 (실 실행은 별도 Gate)

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

---

## 14. v0.26 한계 + 다음 단계 후보

본 Gate 범위:
- Web Console UI 보강 + production entrypoint 분리만
- worker logic 수정 0건
- Cloudflare 환경 변경 0건
- 실 호출 / 실 KV write 0건

다음 후보:
- **v0.26 production deploy Gate** (Cloudflare Pages project / Access / Pages deploy / allowlist 임시 추가 / Worker redeploy / Check State 검증) — 별도 사용자 승인
- **v0.26.x** = build script / shared source 도입 (현재 두 파일 byte-for-byte 동일 → 자동화 시점에서 분기)
- **v0.27+** = Actual Coin Live Preflight / Durable Objects strict one-time guarantee 검토
- **v0.28+** = Snapshot / Evaluation / Audit KV write boundary 검토
- worker `/state` response 자체에서 `resetCount` 제거 — v0.27+ 후보 (현재는 UI 비노출만)
- env-based resetPhrase / circuit reset endpoint / failure counter reset endpoint
- invoke token rotate automation
- ipHash + `WS3_CANARY_HASH_SALT`

---

## 15. 기준 commit

- branch: `claude/heuristic-cori-7865e7`
- 이전 functional baseline: WS3 v0.25.0 Operator Reset / State Lifecycle + Staging Success (`f2d7ddd`)
- 본 commit: (Gate 3 commit 별도 단계 — push 별도 승인)
