# WS3 v0.32.3 — 백서 카드 슬롯 + v2 제품형 카드 UI + 빗썸 메인 정렬 완료 보고

**작성일**: 2026-05-20
**branch**: `claude/heuristic-cori-7865e7`
**이전 functional baseline**: WS3 v0.32.2 v2 UI 톤 이식 + 한글 우선 문구 정렬 (`1c47161`)
**본 단계 산출**: 2 Web Console 동기화 보강 + 1 신규 보고서 + 2 문서 갱신 (총 5 staged) / Worker 미수정

---

## 1. 목적

기능 확장 아님. 백서 §16 카드 슬롯 구조 + v2 카드 표현 + 빗썸 메인 정렬 + 한글 우선 문구.

```text
1. 백서 §16 카드헤더 슬롯 + 카드바디 18 섹션 구조 적용
2. v2 스크린샷 카드 헤더/바디 디자인 이식 (좌측 네온 라인 / 등급 chip / 점수 큰 표시 / 칩 묶음 / 신호 강도 바 / 펼침 카드)
3. 빗썸 메인 정렬 (거래소 select 순서 빗썸/업비트/바이낸스 + 메인/보조/참고 표기 + 상단 배너 메인 거래소 강조)
4. reasonChips 영문 코드 → 한글 라벨 매핑
5. 개발자 콘솔 느낌 → 제품형 카드 화면 전환
```

한 줄 정의: **v0.32.3 = 백서 §16 카드 슬롯 + v2 카드 표현 + 빗썸 메인. 기능 변경 0건. Worker 미수정.**

---

## 2. 사용자 피드백

```text
v2처럼 바로 이해되는 스캐너 앱 화면
빗썸 중심 실사용 스캐너
카드 리스트 중심 UI
카드 펼침으로 근거 확인
백서에 정의된 카드헤더/카드바디 슬롯 반영
한글 우선 문구
불필요한 영어 제거
```

---

## 3. 백서 §16 카드 슬롯 기준

### 3.1 카드헤더 슬롯 우선순위

```text
1. 등급
2. 전략성향
3. 대표구조
4. 반복신호
5. 시장상황 / 매수세
6. 위험/시총
7. 감지시간
```

본 patch에서 적용한 카드헤더 슬롯 (모바일 우선 5~6개):

```text
- 등급 (P-S+/S/A/B/C chip)
- 운영자 검토 레벨 (HOT 검토/WATCH 관찰/LOW 관망 chip)
- 후보 자격 (후보/검토 chip)
- 거래소 (빗썸/업비트/바이낸스 chip)
- 점수 (큰 수치 표시)
- reasonChips 한글 매핑 (최대 4종)
- 신호 강도 바 (score 기반 0~100%)
- 메타 (기준봉 / 감지시각 / 종가)
```

미구현 슬롯은 카드바디로 내림 (전략성향 / 반복신호 / 위험/시총 / 시장상황).

### 3.2 카드바디 §16.4 18 섹션 (모두 slot 표시)

```text
1. 핵심 요약 ← 구현
2. 카드헤더 상세 해석 ← 구현
3. 점수 요약 ← 구현 (신호 강도 바)
3.5 선별 근거 / 종합 브리핑 ← 구현 (ws3BuildBriefing)
강점 / 약점 ← 구현 (chips kind 기반 분리)
4. 구조 판단 ← 구현 (changePct/closePos/upperWick/range)
5. 매수세 / 수급 ← 구현 (volRatio/volAccel)
6. 시장상황 / BTC 상태 ← 후속 단계 (marketContext 모듈)
7. 전략 성향 ← 후속 단계 (strategyPlan 모듈)
8. 진입 가이드 / 대기 구간 ← 안내문 + 후속 단계
9. 매도전략 A-F ← 6개 slot 표시 + 계산 대기
10. 세력 판단 ← 후속 단계 (volumeClusterZone/orderBlockZone/boxCenter)
11. 반복신호 / 신호 히스토리 ← 후속 단계 (signalCycle 모듈)
12. 지표 상세 ← 구현 (캔들 수/시각/종가)
13. 코인 메타 / 시총 ← 후속 단계 (coinMeta)
14. 뉴스 ← 후속 단계 (newsContext)
15. 시장 참고 ← 후속 단계
16. 외부 보조확인 ← 후속 단계 (externalConfluence, 점수 영향 없음)
17. 후보 검증 / 사후평가 ← 후속 단계 (evaluationOutcome)
18. 고급 상세 ← 구현 (rank/isCandidate/operatorReview/chips 원본)
```

원칙:

```text
- 섹션 삭제 0건
- 미구현 섹션은 "데이터 수집 중" / "계산 대기" / "후속 단계" 안내 표시
- 기본 화면은 과밀하지 않게 일부 섹션 접힘 (.collapsed)
- 각 섹션 펼침 mini toggle 제공
```

---

## 4. 첨부 v2 스크린샷 UI 분석 (root index.html 참고)

### 4.1 가져온 카드헤더 표현

```text
좌측 세로 네온 라인 (.ws3-result-card.grade-* border-left 4px 등급 색)
등급 색상 (--accent-red/orange/yellow + 골드 #ffd233 + 핑크 #ff7ad9)
상단 dot (시안 네온 + glow)
코인명 + #rank (monospace 700)
우측 큰 점수 (cyan 큰 폰트)
칩 묶음 (grade / 운영자 검토 / 후보·검토 / 거래소 / reasonChips 한글)
신호 강도 바 (linear-gradient cyan→green + glow)
메타 row (기준봉 / 감지시각 / 종가, monospace muted)
```

### 4.2 가져온 카드바디 표현

```text
펼침 토글 버튼 ("근거 펼치기 ▾")
섹션별 카드 (.ws3-card-section, bg-card border)
섹션 헤더 (cyan + letter-spacing)
강점/약점 list (.strong green / .weak red)
종합 브리핑 박스
전략 A-F slot
세력 판단 slot
대기 구간 안내
고급 상세 mono raw 표시
```

### 4.3 가져오지 않은 것 (의도적 차단)

```text
× v2 관심 / 정밀 / 표준 추적 의미
× v2 24h 퍼센트 / 진행도 의미
× v2 active tracking / completed history 데이터
× v2 tracking pipeline / 분석기 state
× v2 수익/손실 판정 의미
× SPLUS / splus 사용자 노출
× 전통 캔들명 (도지 / 망치 / 장악형) 핵심 판단 라벨
```

---

## 5. 빗썸 메인 정렬

### 5.1 거래소 select 순서

모든 거래소 select (Section 6 / 7 / 8):

```text
bithumb (메인)
upbit (보조)    ← selected (실 동작 가능 상태)
binance (참고)
```

### 5.2 거래소 select label 보조 안내

```text
거래소 (빗썸 메인 · 업비트 보조 · 바이낸스 참고)
```

### 5.3 Dev Open Banner 메인 거래소 강조

```text
[준비] [개발 개방 모드] [수동 운영] [자동 알림 꺼짐]
메인 거래소: 빗썸 · 업비트 보조 검증 · 바이낸스 참고
```

### 5.4 카드 헤더 chip 색상

```text
빗썸 chip: .exchange-bit (#ff7849 / 244,102,90 — v2 빗썸 톤)
업비트 chip: .exchange-upb (#5da9ff / 0,95,255 — v2 업비트 톤)
바이낸스 chip: .exchange-bin (#f0b90b / 240,185,11 — v2 바이낸스 톤)
```

### 5.5 카드바디 핵심 요약 거래소 표시

```text
현재: <등급> · 상태: <레벨> · 점수: <N> · 거래소: 빗썸 · 기준봉: 5m
```

업비트가 메인처럼 보이지 않도록 모든 표시는 빗썸 메인 우선.

---

## 6. 한글 우선 문구 (v0.32.2 누적 + v0.32.3 신규)

### 6.1 reasonChips 한글 매핑 (신규)

```text
VOLUME_SURGE        → 거래량 증가
LOW_VOLUME          → 거래량 부족
HIGH_CLOSE_POSITION → 종가 상단
UPPER_WICK_RISK     → 윗꼬리 리스크
WIDE_RANGE_RISK     → 변동폭 위험
SHORT_MOMENTUM      → 단기 모멘텀
POSITIVE_CHANGE     → 상승 전환
기타 알 수 없는 chip → "기타 근거" + orig 코드는 §18 고급 상세에만 표시
```

### 6.2 카드 라벨 한글 (신규)

```text
score → N점
[CANDIDATE] → 후보
[OP-REVIEW] → 검토
HOT_REVIEW → HOT 검토
WATCH_REVIEW → WATCH 관찰
LOW_SIGNAL → LOW 관망
chips: ... → (한글 chip 배열)
close=... → 종가 ...
근거 펼치기 ▾ / 근거 접기 ▴
펼치기 / 접기 (mini toggle)
```

### 6.3 v0.32.2 한글 정렬 그대로 유지

```text
1. 설정 / 2. 상태 / 3. 정리 확인 / 4. 위험 영역 / 5. 결과 / 6. 시세 미리보기 / 7. 단일 코인 점수 / 8. 다종목 스캔 / 9. 테스트 알림 발송 / 10. 제한 운영 모드 / 11. 운영자 검토 발송
운영 요약 / 상위 후보 5개 / 후보 목록 / 실패 마켓 / 필터 / 최근 스캔 기록
선택 후보 미리보기 / 텔레그램 미리보기 / 최근 발송 기록
```

---

## 7. WS3 카드헤더 적용 내용 (구체)

### 7.1 좌측 네온 라인

```text
.ws3-result-card.grade-SP → 4px 골드 #ffd233 + soft gold bg
.ws3-result-card.grade-S  → 4px 핑크 #ff7ad9 + soft pink bg
.ws3-result-card.grade-A  → 4px 빨강 var(--accent-red) + soft red bg
.ws3-result-card.grade-B  → 4px 주황 var(--accent-orange) + soft orange bg
.ws3-result-card.grade-C  → 4px muted + base bg
```

### 7.2 카드 헤더 구성

```html
<div class="ws3-card-header">
  <span class="dot"></span>           <!-- 시안 dot + glow -->
  <span class="name">#1 KRW-BTC</span>
  <span class="score-big">28점</span>
</div>
<div class="ws3-card-chips">
  <span class="ws3-chip grade-A">P-A</span>
  <span class="ws3-chip mode-watch">WATCH 관찰</span>
  <span class="ws3-chip candidate">후보</span>     <!-- 자격 있을 때 -->
  <span class="ws3-chip mode-watch">검토</span>     <!-- operatorReview && !isCandidate -->
  <span class="ws3-chip exchange-bit">빗썸</span>
  <span class="ws3-chip volume">거래량 증가</span>
  <span class="ws3-chip structure">종가 상단</span>
  <span class="ws3-chip risk">윗꼬리 리스크</span>
</div>
<div class="ws3-signal-bar">
  <div class="ws3-signal-fill" style="width:28%"></div>
</div>
<div class="ws3-card-meta">
  <span>신호 28%</span>
  <span>· 기준봉 5m</span>
  <span>· 2026-05-19T16:25:00Z</span>
  <span>· 종가 114161000</span>
</div>
```

### 7.3 펼침 토글

```html
<button class="ws3-card-body-toggle">근거 펼치기 ▾</button>
```

펼침 시: `근거 접기 ▴`. JS hook으로 `.ws3-result-card.expanded` 토글.

---

## 8. WS3 카드바디 적용 내용 (구체)

### 8.1 18 섹션 slot 구조

`ws3BuildCardBody(r, req, idx)` 함수가 18 섹션 모두 생성. 기본 노출 (펼침 시):

```text
1. 핵심 요약
2. 카드헤더 해석
3. 점수 요약 (신호 강도 바)
3.5. 선별 근거 / 종합 브리핑
강점 / 약점
4. 구조 판단
5. 매수세 / 수급 판단
```

기본 접힘 (.collapsed, mini toggle):

```text
6. 시장상황 / BTC 상태
7. 전략 성향
8. 진입 가이드 / 대기 구간
9. 매도전략 A-F
10. 세력 판단
11. 반복신호
12. 지표 상세
13. 코인 메타
14. 뉴스
15. 시장 참고
16. 외부 보조확인
17. 후보 검증 / 사후평가
18. 고급 상세
```

### 8.2 종합 브리핑 (selectionReason.summary 슬롯)

```js
ws3BuildBriefing(r)
```

생성 규칙:

```text
- 강점 chip 있으면 → "<강점 목록> 신호가 감지되었습니다."
- 약점 chip 있으면 → "<약점 목록> 으로 추가 확인이 필요한 구간입니다."
- 둘 다 없으면 → "현재 데이터만으로는 종합 판단이 제한적입니다."
```

예시:

```text
거래량 증가 / 종가 상단 신호가 감지되었습니다. 윗꼬리 리스크 으로 추가 확인이 필요한 구간입니다.
```

### 8.3 강점 / 약점 분리

```js
ws3SplitStrengthsWeaknesses(chips)
```

규칙:

```text
chip.kind === 'volume' || 'structure' → 강점
chip.kind === 'risk'                  → 약점
chip.kind === 'neutral'               → 강점/약점 모두 제외 (고급 상세에만 표시)
```

리스트 표시 (.strong / .weak 색상):

```text
강점
- 거래량 증가
- 종가 상단
약점
- 윗꼬리 리스크
```

### 8.4 신호 강도 바

```text
score 0~100 → ws3-signal-fill width %
linear-gradient cyan → green + glow-cyan
```

---

## 9. 가져온 것 / 가져오지 않은 것 (재인용)

### 9.1 가져온 것

```text
✓ v2 색상 톤 (.grade-SP gold / .grade-S pink / .grade-A red / .grade-B orange — v2 hdr-grade-chip 색)
✓ v2 거래소 chip 색 (.exchange-bit / .exchange-upb / .exchange-bin — v2 hdr-exchange-chip 그대로)
✓ v2 시안 네온 + glow 톤 (v0.32.2 누적)
✓ v2 네온 좌측 라인 카드 shell (.ws3-result-card border-left 4px 등급별)
✓ v2 점수 큰 표시 (.score-big cyan large)
✓ v2 신호 강도 바 (.ws3-signal-bar gradient)
✓ v2 펼침 카드 패턴 (.expanded toggle)
✓ v2 카드 섹션 박스 (.ws3-card-section)
✓ v2 강점/약점 list 표현
```

### 9.2 가져오지 않은 것

```text
× v2 관심 의미
× v2 정밀 / 표준 추적 의미
× v2 24h / 7d 진행도 의미
× v2 active / completed 데이터
× v2 tracking pipeline
× v2 분석기 state
× v2 수익/손실 판정 의미
× v2 ViewModel 의미값
× v2 데이터 구조
× SPLUS / splus 사용자 노출
× 전통 캔들명 (도지 / 망치 / 장악형) 사용자 UI 라벨
```

---

## 10. 빗썸 메인 UI 구체화 (재인용)

```text
기본 거래소 select: bithumb (메인) / upbit (보조, selected) / binance (참고)
거래소 select label: "(빗썸 메인 · 업비트 보조 · 바이낸스 참고)"
상단 banner: "메인 거래소: 빗썸 · 업비트 보조 검증 · 바이낸스 참고"
카드 chip 색: v2 exchange chip 톤 그대로 (.exchange-bit/upb/bin)
카드바디 §1 핵심 요약: "거래소: 빗썸" 표시 (현재 selected가 upbit이면 업비트로 자동 표시 — 실 빗썸 adapter 구현 전까지 업비트 보조 검증 가능)
```

빗썸 adapter 신규 구현은 본 patch 범위 외 (별도 단계).

---

## 11. 기존 v0.32 섹션 재배치 (현재 patch 적용 범위)

```text
운영 요약 → 결과 영역 상단 dashboard (그대로, v2 톤만 적용)
상위 후보 5개 → 카드 리스트 상단 (한글 chip 적용)
실패 마켓 → 결과 영역 보조 (v2 톤)
필터 → 검색/정렬 영역 (현재 그대로, v0.32.x 후속에서 검색창 + 정렬 버튼 추가 검토)
선택 후보 미리보기 → Section 11 (한글 chip 적용)
텔레그램 미리보기 → Section 11 (그대로, fixed-text 한글 라벨 유지)
최근 스캔 기록 → 결과 영역 하단 (그대로)
최근 발송 기록 → Section 11 하단 (그대로)
```

미구현 (v0.32.x / v0.33 후속):

```text
- 상단 탭 (스캐너 / 추적 분석) 신설
- 검색창 (코인명 검색)
- 정렬 버튼 (최신순/점수순/후보순/마감임박)
- 큰 "스캔 시작" 중심 버튼 (현재는 "스캔 실행" 표준 버튼)
```

---

## 12. 이번 작업에서 하지 않은 것

```text
× Worker 수정
× 점수 산식 변경
× 등급 체계 전면 변경
× Bithumb adapter 신규 구현
× Telegram 발송 로직 변경
× KV 저장 추가
× tracking 시작
× Cron 추가
× 자동 알림 추가
× 보안 구조 재논의
```

---

## 13. 필수 정적 테스트

```text
diff -q web/ws3-canary-console.html web/ws3-canary-console/index.html → 0건 (byte-for-byte mirror)
Embedded <script> parse: 2 blocks new Function(block) ALL_BLOCKS_OK
git diff --stat HEAD -- [보호 파일군] → 빈 출력 (workers/ worker.js wrangler index.html manifest service-worker v3/ CODE_CONTRACT WORKFLOW_TEMPLATE 0건)
영어 UI label 잔존 grep → 사용자 UI 매치 0건
SPLUS / splus / 도지 / 망치 / 장악형 grep → 사용자 UI + 코드 주석 매치 0건 (주석에서도 제거)
정밀 / 표준 / 24h / 진행도 grep → 사용자 UI 매치 0건 (v2 의미 사용 0건)
노출된 폐기 hash repo-wide 매치 0건
bot_token / chat_id / message_id / Invoke Token / SHA-256 hash / KV namespace ID / raw Telegram response / raw exchange full response — 정책 문맥만 (raw value 0건)
매수 추천 / 진입 추천 / 수익 보장 / 확정 신호 / LIVE BUY — 0건
```

---

## 14. 보호 파일 무손상

```text
workers/ws3-telegram-canary-worker.js       ✅ 미수정 (Worker 미변경)
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

## 15. Cloudflare 변경 0건 (본 commit 시점)

```text
- Worker 재배포 0건
- Pages 재배포 0건 (deploy gate에서 별도 진행)
- KV namespace 0건 / secrets / env 0건
- Telegram API 0건 / KV write 0건
- 실 거래소 API 호출 0건
- 모든 endpoint 호출 0건
```

---

## 16. 남은 후속 과제

```text
- 상단 탭 (스캐너 / 추적 분석)
- 검색창 / 정렬 버튼 (최신순 / 점수순 / 후보순 / 마감임박)
- 큰 "스캔 시작" 중심 버튼 (v2 SCAN START 감성)
- 빗썸 adapter 신규 구현 (v0 Bithumb-only 기준 별도 단계)
- 카드바디 미구현 모듈 점진 구현 (marketContext / strategyPlan / volumeClusterZone / signalCycle / coinMeta / newsContext / externalConfluence / evaluationOutcome)
- S+ 등급 정렬 (현재 P-S/P-A/P-B/P-C + S+ 호환 표기, 정식 정렬은 별도)
- structureBucket 엔진 추가 (백서 §13 / WS3_CODE_CONTRACT 준수)
- signalCycle / cyclePhase / bucketFamily 추가 (백서 §15)
- 자연검증 후 색상 / 톤 / 한글 문구 미세 조정
- 모바일 카드 UX 자연검증
- Cron / 자동 Telegram / candidate KV 저장 / tracking 시작은 별도 사용자 명시 승인 전까지 계속 disabled
```

---

## 17. 기준 commit

- branch: `claude/heuristic-cori-7865e7`
- 이전 functional baseline: WS3 v0.32.2 v2 UI 톤 이식 + 한글 우선 문구 정렬 (`1c47161`)
- 본 commit: (push 후 기록, push 별도 승인)

---

## 18. 이번 단계의 핵심

```text
카드 내용은 백서가 정한다.
v2 스크린샷은 카드 표현 방식을 정한다.
빗썸이 메인이다.
업비트는 보조 검증용이다.
색만 v2가 아니라 카드헤더와 카드바디 구조를 v2처럼 만든다.
기존 v2의 관심/정밀/표준/24h/진행도 의미는 가져오지 않는다.
영어 남발 금지, 한글 우선.
백서 §16.4 18 섹션은 모두 slot 표시 (미구현은 "데이터 수집 중" / "후속 단계" 안내, 절대 삭제하지 않음).
Worker 미수정 / Worker redeploy 불필요 / Pages redeploy 1회만 후속.
```
