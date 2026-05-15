# WS3 Workflow Template v0.1

> **박제 기준**: WS3 워크플로우 표준 템플릿 v0.1 (2026-05-16)  
> **개정 사유**: v0 의 §0 13단계 흐름이 구버전 (Claude Web 산출물 생성 방식) 과 혼재되어 있어, 현재 확정된 운영룰 (GPT 작업지시서 / Claude Web 피드백만 / Claude Code 실행) 로 정정.  
> **목적**: GPT 작업지시서 초안 → Claude Web 피드백 → GPT 최종 전문 → Claude Code 실행 흐름의 반복 패턴 박제  
> **사용 방법**: 새 단계 시작 시 본 템플릿을 복사 → 변수 부분만 치환 → 진행
>
> 본 템플릿은 **고정 구조** 다. 변경은 별도 단계 (v0.2 / v1 등) 로 박제. 즉흥 수정 금지.

---

# §0. 운영 룰 (고정, 변경 X)

## §0.1 역할 분담

```text
GPT          = 작업지시서 초안 전문 작성 + 최종 전문 작성 + commit 메시지 작성
Claude Web   = 작업지시서 피드백만
Claude Code  = repo 실제 코드 작성 / 검증 / diff / commit / push
사용자       = 최종 승인 (각 Gate)
```

## §0.2 14단계 흐름 (정정본)

```text
1.  GPT 가 작업지시서 초안 전문 작성
2.  사용자가 Claude Web 에 전달
3.  Claude Web 이 작업지시서 피드백만 수행
4.  사용자가 Claude Web 피드백을 GPT 에 전달
5.  GPT 가 피드백 반영 후 Claude Code 실행용 최종 전문 작성
6.  사용자가 Claude Code 에 전달
7.  Claude Code 가 Gate 1 (사전 조사) 수행 후 보고
8.  GPT / 사용자 승인
9.  Claude Code 가 Gate 2 (코드 작성 / 검증) 후 보고
10. GPT / 사용자 검토 후 staging / commit 승인
11. Claude Code 가 commit 후 보고
12. GPT / 사용자 push 승인
13. Claude Code 가 push
14. PR / main merge = 별도 후속 단계 (본 14단계 흐름 외 별도 승인)
```

## §0.3 절대 금지 (Claude Web)

```text
✗ 코드 작성 / 함수 본문 작성
✗ 파일 생성 / ZIP 생성
✗ repo 반영 지시
✗ Claude Code 에 직접 명령
✗ commit / push 시도
```

Claude Web 역할 = **markdown 텍스트 피드백 응답만**.

## §0.4 절대 금지 (Claude Code)

```text
✗ 작업지시서 (GPT 최종 전문) 없이 수정
✗ Gate 1 보고 전 코드 작성
✗ Gate 2 보고 전 commit
✗ GPT/사용자 승인 전 push
✗ PR / main merge 별도 승인 없이
✗ force push / branch 삭제 / rename
```

## §0.5 절대 금지 (GPT)

```text
✗ Claude Web 피드백 우회 (피드백 없이 최종 전문 작성 금지 — 보강 항목 검토 절차 필수)
✗ 사용자 승인 없이 다음 단계 진행
✗ commit/push 를 본인이 직접 (Claude Code 가 실행, GPT 는 메시지/승인 문구만)
```

---

# §1. 현재 baseline (매 단계 시작 시 갱신)

```text
현재 브랜치:          {{BRANCH}}
현재 최신 commit:     {{LATEST_COMMIT_HASH}}
commit message:       {{LATEST_COMMIT_MESSAGE}}
이전 단계 완료:        {{PREVIOUS_STAGE_LABEL}}
```

**완료된 단계 누적**:

```text
WS3 v0.1.0       — v3-config.js / v3-feature-payload.js
WS3 v0.2.0-a     — v3-bithumb-client.js / v3-candle-normalizer.js
WS3 v0.2.0-b     — v3-indicators.js                              commit: c98cbd8
WS3 v0.2.0-b-r1  — baseline consistency hotfix                   commit: da00e62
WS3 v0.2.0-b-r2  — Code Contract Freeze                          commit: 04eac43
WS3 v0.2.0-c-r1  — v3-feature-payload-builder.js                 commit: 51e510d
WS3 v0.3.0       — v3-score-breakdown.js                         commit: b7e0ea3
{{NEW_STAGES_APPENDED_HERE}}
```

**REJECTED — repo 반영 보류**:

```text
WS3 v0.2.0-c (1차)  — REJECTED / NOT APPLIED — v3-feature-payload.js 계약 위반 6건
{{OTHER_REJECTED_STAGES}}
```

---

# §2. 작업명 / 목표 / 신규 파일 / 문서 파일

```text
작업명:                {{STAGE_NAME}}                e.g., WS3 v0.4.0 structureBucket
작업 성격:             {{STAGE_CHARACTER}}            e.g., 구조 판단 확정 / 신규 모듈
목표 (한 줄):          {{STAGE_GOAL}}
```

**파일 분류**:

```text
신규 생성 .js:         {{NEW_JS_FILES}}              e.g., v3/v3-structure-bucket.js
신규 생성 보고서:       {{NEW_REPORT_FILES}}          e.g., docs/ws3/WS3_v0_4_0_*_REPORT.md
갱신 가능 문서:         {{UPDATED_DOC_FILES}}         e.g., WS3_CHANGELOG.md / WS3_CURRENT_BASELINE.md
```

**.js 0건 작업 (문서 박제) 인 경우** §2 의 신규 .js = 0건 명시.

---

# §3. 단일 기준 문서 우선순위 (고정)

```text
docs/ws3/WS3_CODE_CONTRACT.md            ← 단일 기준 (b-r2 박제본)
> docs/ws3/WS3_CURRENT_BASELINE.md
> 백서 (WOOS_Scanner_V3_개발백서_v0_3_3.md, repo 미박제)
> 기타 문서
```

충돌 시 항상 `WS3_CODE_CONTRACT.md` 우선.

---

# §4. 보호 파일 목록 (고정 + 단계별 추가)

**핵심 보호 (절대 수정 금지)**:

```text
index.html / manifest.json / service-worker.js / worker.js / wrangler.toml

/v3/v3-config.js
/v3/v3-feature-payload.js                  ← 핵심 보호 (코드 계약)
/v3/v3-bithumb-client.js
/v3/v3-candle-normalizer.js
/v3/v3-indicators.js                        ← v0.2.0-b 박제본
/v3/v3-feature-payload-builder.js           ← v0.2.0-c-r1 박제본
/v3/v3-score-breakdown.js                   ← v0.3.0 박제본
/v3/v3-index.html                           (생성도 X)

docs/ws3/WS3_CODE_CONTRACT.md
{{STAGE_ADDITIONAL_PROTECTED_FILES}}
```

**보호 정책**: 본 단계에서 위 파일 변경 시 → 즉시 중단 + 사용자 보고.

---

# §5. 이번 단계에서 할 것 / 하지 말 것

## §5.1 할 것

```text
{{STAGE_TODO_LIST}}
  - 예: payload.structure 읽어 structureBucket 분류
  - 예: priceZone / referenceLow / sweepReclaim 후보 평가
  - 예: confidence 0~100 산출
  - 예: standalone structureDecision 객체 반환
```

## §5.2 하지 말 것 (조기 구현 금지 — 고정 + 단계별 추가)

**범 단계 금지 (모든 단계 공통)**:

```text
✗ grade 산출 / P-S / P-A / P-B 등급 분류
✗ signalCycle / persistence / cooldown
✗ strategyBias / entryPlan / exitPlan
✗ Telegram / UI / renderer / cardViewModel
✗ externalConfluence
✗ 실거래 / 주문
✗ payload mutation
✗ scoreBreakdown mutation
✗ 새 캔들 fetch / 새 지표 계산
✗ DOM 접근 / localStorage / sessionStorage / fetch
✗ Date.now() (DP-1 박제)
```

**단계별 추가 금지**:

```text
{{STAGE_ADDITIONAL_FORBIDDEN}}
  - 예 (v0.4.0): grade 임계값 산출 / structureBucket 의 grade 연결
  - 예 (v0.5.0): 백테스트 / 사후평가 / 실제 cycle 매칭
```

---

# §6. DP 결정 항목 (단계별 채움)

**DP 박제 표준 형식**:

```text
DP-{{PREFIX}}{{N}}: {{DP_TITLE}}

  결정 주체:           GPT 검토 + 사용자 승인 흐름
  결정 일자:           {{DECISION_DATE}}

  결정 사항:
    {{DP_DECISION}}

  후보 (참고):
    {{DP_CANDIDATES}}

  적용 시점:           {{DP_APPLY_STAGE}}
```

**prefix 명명 규칙**:

```text
WS3 v0.2.0-c-r1   →  DP-1 / DP-2 / ...        (이미 박제)
WS3 v0.3.0        →  DP-S1 / DP-S2 / ...      (Score)
WS3 v0.4.0        →  DP-STR1 / DP-STR2 / ...  (Structure)
WS3 v0.5.0        →  DP-CYC1 / ...            (Cycle)
WS3 v0.6.0        →  DP-STG1 / ...            (Strategy)
{{NEW_STAGE_PREFIX}}
```

**기존 박제 DP 목록 (변경 X)**:

```text
DP-1     payload.ts 값 정책 (marketCtx.ts → primary candle.ts → null / Date.now 금지)
DP-2     canonical tradeValue alias 정책
DP-3     별도 builder 파일 (v3/v3-feature-payload-builder.js)
DP-4     isValidPayload 현행 유지
DP-5     normalizeIdentity helper (market='KRW-BTC' → quote='KRW', base='BTC')
DP-6     V3BuildMarketCtx typedef + 안전 정규화
DP-7     raw.builderDebug 구조 (builderVersion / warnings / primaryTimeframe / resolvedTsSource / candleCounts / identityInput)

DP-S1    standalone scoreBreakdown 반환 (payload mutate X)
DP-S2    component weight: core 25 / structure 20 / volume 20 / momentum 15 / execution 20
DP-S3    unavailable data 처리: A+C 혼합 (component valid:false 시 0점, sub-signal 만 누락 시 sub 0점+warning)
DP-S4    riskPenalty default: UNKNOWN/penalty=null/flags=[] → penalty 0
DP-S5    grade 미산출 (v0.3.0 범위 외)
DP-S6    buyPressure 점수 미반영 (key 존재만 검증)
DP-S7    inline DEFAULT_SCORE_CONFIG / v3-config.js 미수정
{{NEW_DP_APPENDED}}
```

---

# §7. Gate 1 사전 조사 명령 (Claude Code 실행)

## §7.1 환경 확인 (고정)

```bash
git status
git branch --show-current
git rev-parse HEAD
ls -la v3/
ls -la docs/ws3/
```

기대 HEAD: `{{EXPECTED_HEAD_HASH}}` (= 이전 단계 push 후 commit)

## §7.2 이전 baseline commit 존재 검증 (고정)

```bash
PREV={{PREVIOUS_COMMIT_HASH}}
git cat-file -t $PREV
git branch --contains $PREV
git fetch origin
git branch -r --contains $PREV
git log --all --oneline | grep $PREV
```

→ 누락 시 즉시 중단 + 사용자 보고.

## §7.3 기준 문서 확인 (고정)

```bash
cat docs/ws3/WS3_CODE_CONTRACT.md
cat docs/ws3/WS3_CURRENT_BASELINE.md
```

## §7.4 단계별 grep (변수 부분)

```bash
{{STAGE_GREP_COMMANDS}}
```

예시 (v0.4.0 structureBucket):

```bash
grep -nE "structure|candleShape|candleStructure|box|referenceLow|priceZone|sweepReclaim" v3/v3-feature-payload-builder.js
grep -nE "structure|box|referenceLow|priceZone|sweepReclaim|touchesHigh|touchesLow" v3/v3-indicators.js
grep -nE "components|structure|scoreBreakdown" v3/v3-score-breakdown.js
grep -RIn "structureBucket|structureDecision" v3 docs/ws3 || true
```

## §7.5 신규 identifier 충돌 검사 (고정 형식)

```bash
grep -RIn "{{NEW_IDENTIFIER_LIST}}" v3 docs/ws3 || true
```

기대: 0줄 (신규 식별자). 잔존 시 충돌 가능성 보고.

---

# §8. Claude Web 피드백 요청 형식 (GPT 가 Claude Web 에 요청 시 사용)

GPT 가 작업지시서 초안을 Claude Web 에 던질 때 **반드시 다음 형식** 으로 응답 요청:

```md
# Claude Web 피드백 — {{STAGE_NAME}} 작업지시서 검토

## 1. 전체 판단
- 통과 가능 / 수정 필요 / 위험

## 2. 반드시 수정해야 할 항목
- 계약 위반 가능성
- {{STAGE_NAME}} 범위 초과
- 보호 파일 정책 충돌
- grade/signalCycle/entryPlan/exitPlan 등 조기 구현 위험
- {{STAGE_SPECIFIC_RISKS}}

## 3. 권장 보강 항목
- {{STAGE_SPECIFIC_BOOST}}
- smoke test
- grep 검증
- helper 함수 분리
- config-driven 구조

## 4. DP-{{PREFIX}}1~DP-{{PREFIX}}N 피드백
- DP-{{PREFIX}}1: ...
- DP-{{PREFIX}}2: ...
- ...

## 5. Claude Code 가 구현 전 반드시 확인해야 할 grep 항목
- 추가 grep 명령 또는 확인 포인트

## 6. 최종 의견
- 이 작업지시서로 Claude Code 에 코드 작성을 맡겨도 되는지
- 아직 작업지시서 수정이 필요한지

## 7. §{{Q}} 핵심 질문 답변
- Q1. ...
- Q2. ...
- ...
```

**Claude Web 응답 시 절대 금지 (§0.3 재확인)**:

```text
✗ 코드 작성 / 함수 본문 작성
✗ 파일 생성 / ZIP 생성
✗ repo 반영 지시
✗ Claude Code 에 직접 명령
```

Claude Web 역할 = **markdown 텍스트 피드백 응답만**.

---

# §9. Claude Code 실행 지시 형식 (GPT 가 최종 전문 작성 시 사용)

Claude Web 피드백 반영 후 GPT 가 작성하는 Claude Code 용 최종 전문은 다음 구조:

```text
[WOOS 운영 v4.9.6 / {{STAGE_NAME}} Gate 1 시작]

§0. 현재 기준 (branch / base commit / 단일 기준 문서 / 우선순위)
§1. 이번 작업명 / 목표 / 신규 파일
§2. DP 결정 상태 (DP-{{PREFIX}}1 ~ DP-{{PREFIX}}N)
§3. 보호 파일
§4. 금지 구현 (§5.2 범 단계 금지 + 단계 추가 금지)
§5. Gate 1 에서 할 일
    §5.1 환경 확인 (고정)
    §5.2 이전 baseline commit 확인 (고정)
    §5.3 기준 문서 확인 (고정)
    §5.4 단계별 grep
    §5.5 신규 identifier 충돌 검사
§6. Gate 1 보고 형식
§7. Gate 2 (코드 작성) 보고 형식
§8. 검증 + commit/push 절차
```

**원칙**:

```text
- Gate 1 (사전 조사) 와 Gate 2 (코드 작성) 사이에 사용자/GPT 승인 필수
- Gate 2 완료 후 Gate 3 (commit/push) 사이에 사용자/GPT 승인 필수
- Claude Code 는 매 Gate 후 보고만, 자동 진행 금지
```

---

# §10. 검증 명령 (단계 공통 + 단계별)

## §10.1 공통 검증 (모든 단계)

```bash
# 1. node 구문 체크 (신규 .js 파일)
node --check v3/{{NEW_JS_FILE}}

# 2. 보호 파일 diff 0건 확인
git diff --stat -- index.html manifest.json service-worker.js worker.js wrangler.toml \
  v3/v3-config.js v3/v3-feature-payload.js v3/v3-bithumb-client.js \
  v3/v3-candle-normalizer.js v3/v3-indicators.js v3/v3-feature-payload-builder.js \
  v3/v3-score-breakdown.js
# → 출력 비어있어야 PASS

# 3. 새 .js 파일 개수 (staging 전 신규는 ?? 로 표시되므로 함께 검사)
git status --short | grep -E "^(A |\?\?)\s+.*\.js$" | wc -l
# → 기대값 = §2 §NEW_JS_FILES count

# 4. 금지 패턴 grep (identifier 기반, 주석 제외)
grep -nE "(grade|signalCycle|entryPlan|exitPlan)\s*[:=]" v3/{{NEW_JS_FILE}} || true
grep -nE "\.(grade|signalCycle|entryPlan|exitPlan)\b" v3/{{NEW_JS_FILE}} || true
grep -nE "payload\.[a-zA-Z]+\s*=" v3/{{NEW_JS_FILE}} || true
grep -nE "delete\s+payload\." v3/{{NEW_JS_FILE}} || true
grep -nE "fetch\(|document\.|localStorage|sessionStorage|XMLHttpRequest|Date\.now\(" v3/{{NEW_JS_FILE}} || true
# → 모두 0줄이어야 PASS

# 5. 문서 표현 검증 — 이전 오기 표현 (잘못된 슬롯 수 표기) 잔존 검사
#    Claude Code 가 실제 4종 패턴 (한글 띄어/붙여 / 영문 hyphen/space) 을 alternation 정규식으로 grep
#    대상: 이번 단계에서 새로 생성/갱신된 docs/ws3/ 파일만
#    기존 과거 문서 전체 blanket fail 금지
#    상세 패턴은 INDICATOR_SKELETON_REPORT_FIX_GUIDE.md (b-r2 산출물) 참고

# 6. "추정" 표현 검사 — 이번 단계에서 새로 생성/갱신된 docs 파일만 대상
#    기존 과거 문서 전체 blanket fail 처리하지 않는다
#    예: this_stage_files=( "docs/ws3/{{NEW_REPORT_FILE}}" "docs/ws3/WS3_CHANGELOG.md" )
#    각 파일에서 "추정" 0건이어야 PASS (불가피한 경우 사유 명시)
```

## §10.2 단계별 추가 검증

```text
{{STAGE_SPECIFIC_VERIFICATION}}
```

예시 (v0.4.0 structureBucket):

```bash
# 5. structureDecision 출력 shape 검증
node -e "..."
```

---

# §11. 보고 형식 (Claude Code → 사용자)

## §11.1 Gate 1 보고 형식

```md
# {{STAGE_NAME}} Gate 1 보고

## 1. 환경 / 이전 baseline commit 검증
- branch:
- HEAD:
- 이전 commit local:
- 이전 commit remote:
- working tree:

## 2. 기준 문서 확인
- WS3_CODE_CONTRACT.md 존재:
- WS3_CURRENT_BASELINE.md 존재:

## 3. grep 결과
- 단계별 grep 항목 결과
- 신규 identifier 충돌 검사 결과

## 4. DP-{{PREFIX}}1 ~ DP-{{PREFIX}}N 적용 가능 여부
- 각 DP 별 적용 가능 / 충돌 / blocker

## 5. unclear / blocker
- 없으면 "없음"
- 모호하면 UNCLEAR 또는 BLOCKED

## 6. modification status
- 코드 수정: 0건
- 문서 수정: 0건
- 새 파일 생성: 0건
- staging: 없음
- commit/push: 없음
```

## §11.2 Gate 2 (코드 작성) 보고 형식

```md
# {{STAGE_NAME}} 본체 작성 보고 — commit 전

## 1. 적용된 DP 정책
## 2. 생성/수정 파일
## 3. node --check 결과
## 4. smoke test 결과
## 5. {{STAGE_OUTPUT_OBJECT}} 출력 예시
## 6. 금지 패턴 grep 결과
## 7. 보호 파일 diff 0건 확인
## 8. git status / diff summary
## 9. blocker / unclear
## 10. commit/push 미실행 확인
```

---

# §12. staging / commit / push 승인 절차 (고정)

## §12.1 승인 게이트 (4단계)

```text
Gate 1 (사전 조사) 보고
  ↓ 사용자/GPT 승인
Gate 2 (코드 작성) 보고
  ↓ 사용자/GPT 승인
Gate 3 (검증 완료 + commit 직전) 보고
  ↓ GPT commit 메시지 작성 + 사용자 승인
Gate 4 (push 직전)
  ↓ 사용자 별도 승인
```

## §12.2 commit 메시지 표준 (한 줄 원칙)

**기본 = 한 줄 commit**:

```text
ws3: {{STAGE_NAME_SHORT}} {{ONE_LINE_SUMMARY}}
```

예시:
```text
ws3: v0.2.0-b-r2 code contract freeze
ws3: v0.2.0-c-r1 buildFeaturePayload builder
ws3: v0.3.0 scoreBreakdown core
ws3: v0.4.0 structureBucket decision
```

**원칙**:

```text
- 상세 변경 내용은 commit body 가 아니라 CHANGELOG / REPORT 에 기록
- multi-line commit body 는 사용자 별도 요청 시에만 사용
- multi-line 사용 시에도 한 줄 subject + 빈 줄 + body 형식 유지
- Refs / 이전 baseline 참조 등도 본문 X, CHANGELOG 에 기록
```

## §12.3 commit/push 시 절대 금지

```text
✗ Claude Code 가 자체 판단으로 commit
✗ Gate 2 보고 전 commit
✗ 검증 결과 보고 전 push
✗ PR / main merge 별도 승인 없이
✗ commit 메시지에 추측 / 미확정 사항 포함
✗ 사용자 요청 없는 multi-line body
```

---

# §13. PR / main merge 별도 승인 원칙 (고정)

```text
14단계 흐름의 §14 = PR / main merge 별도 후속 단계

Gate 5 (PR 생성):
  - Claude Code 가 PR 본문 초안 작성
  - GPT 가 PR 본문 검토
  - 사용자 별도 승인 후 PR 생성

Gate 6 (main merge):
  - main 으로의 merge 는 push 와 별도 승인
  - 사용자가 GitHub UI 에서 직접 merge 권장
  - 자동 merge / squash merge 도 별도 승인 없으면 금지
```

**원칙**:

```text
- feature branch (claude/heuristic-cori-7865e7) 에 push = OK (Gate 4 승인 시)
- main 으로 merge = 항상 별도 승인 필요
- force push 절대 금지
- branch 삭제 / rename 절대 금지 (사용자 명시 요청 시 외)
```

---

# §14. 템플릿 사용 흐름 (새 단계 시작 시)

## §14.1 GPT 가 새 단계 작업지시서 초안 작성 시 (1단계)

```text
1. 본 템플릿 복사
2. §1 baseline 갱신 (BRANCH / LATEST_COMMIT / PREVIOUS_STAGE)
3. §2 작업명 / 목표 / 신규 파일 채움
4. §5.1 할 것 / §5.2 단계별 추가 금지 채움
5. §6 DP 항목 후보 작성 (DP-{{NEW_PREFIX}}N)
6. §7.4 단계별 grep 채움
7. §10.2 단계별 검증 채움
8. §19 핵심 질문 작성 (선택)
9. Claude Web 피드백 요청 형식 (§8) 으로 초안 끝맺음
10. 사용자에게 전달
```

## §14.2 사용자 → Claude Web 전달 (2단계)

```text
사용자가 GPT 작업지시서 초안 전체를 Claude Web 채팅에 붙여넣기.
```

## §14.3 Claude Web 가 피드백 시 (3단계)

```text
1. §8 응답 형식 그대로
2. §6 DP 항목 적절성 검토
3. §7 grep 누락 확인
4. §10 검증 누락 확인
5. §5.2 금지 항목 누락 확인
6. 단계별 핵심 위험 (예: grade 조기 산출 / payload mutation) 검토

반드시 금지:
- 코드 작성 / 함수 본문 작성
- 파일 생성 / ZIP 생성
- repo 반영 지시
- Claude Code 에 직접 명령
```

## §14.4 사용자 → GPT 피드백 전달 (4단계)

```text
사용자가 Claude Web 피드백 응답을 GPT 채팅에 붙여넣기.
```

## §14.5 GPT 가 최종 전문 작성 (5단계)

```text
1. Claude Web 피드백 반영
2. §9 형식으로 Claude Code 용 최종 전문 작성
3. 사용자에게 전달
```

## §14.6 사용자 → Claude Code 전달 (6단계)

```text
사용자가 GPT 최종 전문을 Claude Code 세션에 붙여넣기.
```

## §14.7 Claude Code 가 실행 (7~13단계)

```text
7.  Gate 1 (사전 조사) → §11.1 형식 보고
8.  사용자/GPT 승인
9.  Gate 2 (코드 작성) → §11.2 형식 보고
10. 사용자/GPT 검토 → staging/commit 승인
11. Claude Code commit 후 보고
12. 사용자/GPT push 승인
13. Claude Code push
```

## §14.8 PR / main merge (14단계 — 별도)

```text
14. PR / main merge = 본 14단계 흐름 외 별도 후속 단계
    §13 절차 따름
```

---

# §15. 템플릿 변경 정책

```text
- 본 템플릿은 워크플로우 표준 박제본이다.
- 즉흥 수정 금지.
- 변경이 필요하면 별도 단계 (예: WS3_WORKFLOW_TEMPLATE_v0_2 박제) 로 처리.
- 새 DP prefix 추가 (DP-CYC / DP-STG 등) 는 §6 prefix 명명 규칙 갱신 후 박제.
- 새 보호 파일 추가는 §4 갱신 후 박제.
- 14단계 흐름 자체는 변경 금지.
- §0.3 / §0.4 / §0.5 절대 금지 변경 금지.
```

---

# §16. 변수 치환 체크리스트 (새 단계 시작 시)

본 템플릿을 복사한 후 다음 `{{...}}` 변수들을 모두 채워야 함:

```text
[ ] {{BRANCH}}
[ ] {{LATEST_COMMIT_HASH}}
[ ] {{LATEST_COMMIT_MESSAGE}}
[ ] {{PREVIOUS_STAGE_LABEL}}
[ ] {{NEW_STAGES_APPENDED_HERE}}
[ ] {{OTHER_REJECTED_STAGES}}
[ ] {{STAGE_NAME}}
[ ] {{STAGE_CHARACTER}}
[ ] {{STAGE_GOAL}}
[ ] {{NEW_JS_FILES}}
[ ] {{NEW_REPORT_FILES}}
[ ] {{NEW_REPORT_FILE}}            ← §10.1 #6 추정 검사 대상
[ ] {{UPDATED_DOC_FILES}}
[ ] {{STAGE_ADDITIONAL_PROTECTED_FILES}}
[ ] {{STAGE_TODO_LIST}}
[ ] {{STAGE_ADDITIONAL_FORBIDDEN}}
[ ] {{PREFIX}}    (DP prefix, 예: STR / CYC / STG)
[ ] {{N}}         (DP 번호)
[ ] {{DP_TITLE}}
[ ] {{DECISION_DATE}}
[ ] {{DP_DECISION}}
[ ] {{DP_CANDIDATES}}
[ ] {{DP_APPLY_STAGE}}
[ ] {{NEW_STAGE_PREFIX}}
[ ] {{NEW_DP_APPENDED}}
[ ] {{EXPECTED_HEAD_HASH}}
[ ] {{PREVIOUS_COMMIT_HASH}}
[ ] {{STAGE_GREP_COMMANDS}}
[ ] {{NEW_IDENTIFIER_LIST}}
[ ] {{NEW_JS_FILE}}
[ ] {{STAGE_SPECIFIC_VERIFICATION}}
[ ] {{STAGE_OUTPUT_OBJECT}}
[ ] {{STAGE_NAME_SHORT}}
[ ] {{ONE_LINE_SUMMARY}}
[ ] {{PREVIOUS_STAGE}}
[ ] {{PREVIOUS_COMMIT}}
[ ] {{COUNT}}
[ ] {{STAGE_SPECIFIC_RISKS}}
[ ] {{STAGE_SPECIFIC_BOOST}}
[ ] {{Q}}
```

체크리스트 미완료 시 → Claude Web 가 피드백 단계에서 "템플릿 변수 미치환" 으로 차단.

---

# §17. v0 → v0.1 개정 사항 (변경 이력)

```text
GPT 검토 6건 모두 반영:

1. §0 흐름 정정 (구버전 13단계 → 신규 14단계)
   - "Claude Web 작업지시서 생성" 삭제
   - "Claude Web 산출물 생성" 삭제
   - "사용자 산출물 다운로드" 삭제
   - 새 14단계: GPT 초안 → Claude Web 피드백 → GPT 최종 전문 → Claude Code 실행
   - 14번 PR/main merge 는 별도 후속 단계로 분리

2. Claude Web 역할 명확화
   - §0.3 절대 금지 (Claude Web) 신설
   - §8 본문에 재확인
   - §14.3 에 재확인

3. §12 commit 메시지 표준 정정
   - multi-line body 표준 → 한 줄 commit 기본 원칙으로 변경
   - 실제 예시 추가 (ws3: v0.3.0 scoreBreakdown core 등)
   - multi-line 은 사용자 별도 요청 시에만

4. §10 신규 .js 파일 개수 검증 명령 보완
   - staging 전 신규 ?? 도 함께 검사
   - 정정: grep -E "^(A |\?\?)\s+.*\.js$"

5. §10 "추정" grep 범위 제한
   - blanket grep -rn "추정" docs/ws3/ → 새로 생성/갱신된 파일만 대상
   - 기존 과거 문서 blanket fail 금지

6. §0 절대 금지 분리
   - §0.3 Claude Web / §0.4 Claude Code / §0.5 GPT 로 명확히 분리
```

---

# §18. 한 줄 결론

```text
GPT 작업지시서 초안 → Claude Web 피드백 → GPT 최종 전문 → Claude Code 실행
14단계 / 4 Gate / Claude Web 산출물 생성 X / commit 한 줄 / 추정 grep 신규 파일만
사용자 검토 게이트 유지. 변수 치환만으로 매 단계 진행. 누락 0건.
```

---

# §19. 단계별 핵심 질문 (선택, 단계마다 채움)

GPT 가 작업지시서 초안 작성 시 Claude Web 에 물을 핵심 질문 (선택):

```text
1. {{STAGE_QUESTION_1}}
2. {{STAGE_QUESTION_2}}
3. {{STAGE_QUESTION_3}}
...
```

Claude Web 은 §8 응답 형식의 "## 7. 핵심 질문 답변" 섹션에 답변.