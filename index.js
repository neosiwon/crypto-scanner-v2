/**
 * ═══════════════════════════════════════════════════════════════════
 * Crypto Scanner Auto-Alert Worker v3
 * Release: 2026-04-23
 * ═══════════════════════════════════════════════════════════════════
 *
 * 📦 배포 가이드:
 *
 * 1. Cloudflare Workers 대시보드에서 새 Worker 생성
 * 2. 이 파일 전체를 복사해서 붙여넣기
 * 3. Settings > Variables 에서 다음 환경변수 설정:
 *
 *    [Secrets — 암호화 저장]
 *    TG_BOT_TOKEN   = 텔레그램 봇 토큰 (BotFather에서 발급)
 *    TG_CHAT_ID     = 텔레그램 채팅 ID
 *
 *    [Plain Text Variables]
 *    PROXY_URL      = Exchange Proxy Worker URL (예: https://xxx.workers.dev)
 *    SCANNER_URL    = HTML 스캐너 URL (예: https://user.github.io/repo)
 *                     → 텔레그램 메시지 내 스냅샷 링크 생성용
 *
 * 4. KV Namespace 생성 및 바인딩:
 *    - KV namespace 이름: ALERT_KV
 *    - Binding variable: ALERT_KV
 *
 * 5. Triggers > Cron Triggers 추가:
 *    Cron 표현식: `*‍/10 * * * *`  (10분마다 자동 실행)
 *
 * 6. HTML 스캐너 연동:
 *    - HTML의 proxy URL 입력란에 [이 Worker의 URL] 입력
 *    - Worker가 /snapshot, /cooldown/set, /cooldown/check 엔드포인트 제공
 *
 * ═══════════════════════════════════════════════════════════════════
 * 핵심 철학 — HTML 스캐너와 완전 동기화:
 *
 * 1. 코어 판단 (detectPrePump / calcScore / calcEntryReady) 동일 로직
 * 2. 거래소별 독립 분석 → 코인 단위 통합 → 대표 거래소 선정
 * 3. 설명 레이어 (accCost / phase / fakePump / lateEntry / priceGap) 동일
 * 4. 알람 필터 (finalEntryAllowed / 추격차단 / fallback금지) 동일
 * 5. 메시지 포맷 v3 6~8줄 축약 + snapshotId URL
 * 6. 스냅샷 KV 저장 (HTML과 통합 — /snapshot POST)
 * 7. 쿨다운 HTML ↔ Worker 공유 (/cooldown/* API)
 * 8. 수면 시간 (23:00~08:00 KST) 큐 저장 → 오전 8시 일괄 발송
 * ═══════════════════════════════════════════════════════════════════
 */

// ── 설정 ─────────────────────────────────────────────────────────
var GRADE_THRESHOLD  = { SPLUS:5.0, S:4.5, A:3.5, B:2.0 };
var EXCHANGE_PRIORITY = { BINANCE:3, UPBIT:2, BITHUMB:1 };
var ENTRY_THRESHOLD  = 1.15;
var COOLDOWN = {
  ENTRY:          30*60*1000,
  PREPUMP:        60*60*1000,
  PREPUMP_STRONG: 60*60*1000,
  PREPUMP_WEAK:  120*60*1000,
  S:              30*60*1000,
  A:              60*60*1000,
};
// ════════════════════════════════════════════════════════════════════
// [01] CONFIG — 전역 상수, 빌드 태그, feature flags
// ════════════════════════════════════════════════════════════════════

var BUILD_TAG = 'v4.7.37a-hotfix-parallel-kv';
var FEATURES = {
  newsLink: true,
  newsHideIfNoUrl: true,
  strategyInMessage: true,
  strategyFromSnapshot: true,
  snapshotViewer: true,
  weightedScan: 'BITHUMB 30 / UPBIT 4',
  statsSummary: true,
  outcomeAPI: true,
  prefilter: 'score>=3 cut, priority>=4',  // Phase 3 추가
  sleepToggle: 'on/off/auto via KV',
  tgInbound: '/telegram/webhook POST (chat_id + secret_token)'         // Phase 3 추가
};

var SCAN_LIMIT_TOTAL   = 34;  // 전체 스캔 한도
var SCAN_LIMIT_BITHUMB = 30;  // 빗썸 (펌핑 다발 → 비중 높임)
var SCAN_LIMIT_UPBIT   = 4;   // 업비트
var SCAN_LIMIT         = SCAN_LIMIT_TOTAL;  // (하위 호환 유지)  // 무료 한도 내 (업비트20+빗썸20 = subrequest 47개)
var ENABLE_BINANCE   = true; // [Phase 3.7] 바이낸스 스캔 활성화 (Cloudflare Paid 결제 완료)  // 거래소별 스캔 심볼 수
var MIN_SCORE        = 2;
var CANDLE_COUNT     = 100;
var SLEEP_QUEUE_MAX  = 100; // KV에 보관할 최대 큐 항목


// ══════════════════════════════════════════════════════════════════
// 핵심 함수 (HTML 스캐너와 1:1 동일 로직)
// ══════════════════════════════════════════════════════════════════

function escapeHtml(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function formatPrice(p) {
  if (!p || isNaN(p) || !isFinite(p)) return '-';
  if (p >= 1000000) return p.toLocaleString('ko-KR',{maximumFractionDigits:0});
  if (p >= 100)     return p.toLocaleString('ko-KR',{maximumFractionDigits:2});
  if (p >= 1)       return p.toFixed(4);
  return p.toFixed(8);
}

function formatPriceByExchange(value, exchange) {
  if (value === null || value === undefined) return '-';
  var num = Number(value);
  if (isNaN(num) || !isFinite(num)) return '-';
  if (!exchange) {
    return num >= 1 ? num.toLocaleString('en-US', {minimumFractionDigits:2,maximumFractionDigits:4})
      : num.toLocaleString('en-US', {minimumFractionDigits:4,maximumFractionDigits:8});
  }
  if (exchange === 'UPBIT' || exchange === 'BITHUMB')
    return num.toLocaleString('en-US', {minimumFractionDigits:1,maximumFractionDigits:1});
  if (exchange === 'BINANCE')
    return num < 1 ? num.toLocaleString('en-US',{minimumFractionDigits:5,maximumFractionDigits:5})
      : num.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
  return num.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:4});
}

function normalizeCandles(candles) {
  if (!Array.isArray(candles)) return [];
  return candles.filter(function(c){return c&&c.close>0&&!isNaN(c.close);})
                .sort(function(a,b){return a.time-b.time;});
}


// ════════════════════════════════════════════════════════════════════
// [03] INDICATORS
// RSI, OBV, ATR, MFI, EMA 등 기술지표 계산
// ════════════════════════════════════════════════════════════════════

function calcRSI(closes,period){
  period=period||14;if(closes.length<period+1) return 50;
  var ch=[];for(var i=1;i<closes.length;i++) ch.push(closes[i]-closes[i-1]);
  var ag=0,al=0;
  for(var i=0;i<period;i++){if(ch[i]>=0)ag+=ch[i];else al+=Math.abs(ch[i]);}
  ag/=period;al/=period;
  for(var i=period;i<ch.length;i++){var g=ch[i]>=0?ch[i]:0,l=ch[i]<0?Math.abs(ch[i]):0;ag=(ag*(period-1)+g)/period;al=(al*(period-1)+l)/period;}
  if(al===0) return 100;
  return parseFloat((100-100/(1+ag/al)).toFixed(2));
}

function calcOBV(candles){
  if(candles.length<10) return{trend:'flat',leading:false,divergence:false};
  var obv=[0];
  for(var i=1;i<candles.length;i++){var p=obv[obv.length-1];if(candles[i].close>candles[i-1].close)obv.push(p+candles[i].volume);else if(candles[i].close<candles[i-1].close)obv.push(p-candles[i].volume);else obv.push(p);}
  var r=obv.slice(-20),n=r.length,sumX=0,sumY=0,sumXY=0,sumX2=0;
  for(var i=0;i<n;i++){sumX+=i;sumY+=r[i];sumXY+=i*r[i];sumX2+=i*i;}
  var slope=(n*sumXY-sumX*sumY)/(n*sumX2-sumX*sumX),avgOBV=Math.abs(sumY/n)||1,ns=slope/avgOBV;
  var trend=ns>0.005?'up':ns<-0.005?'down':'flat';
  var priceChange=candles.length>=20?(candles[candles.length-1].close-candles[candles.length-20].close)/candles[candles.length-20].close:0;
  var obvChange=n>1?(r[n-1]-r[0])/(Math.abs(r[0])||1):0;
  return{trend,leading:obvChange>priceChange*1.3,divergence:priceChange>0.02&&obvChange<-0.01};
}

function calcMFI(candles,period){
  period=period||14;if(candles.length<period+1) return 50;
  var posF=0,negF=0,prevTP=(candles[candles.length-period-1].high+candles[candles.length-period-1].low+candles[candles.length-period-1].close)/3;
  for(var i=candles.length-period;i<candles.length;i++){var tp=(candles[i].high+candles[i].low+candles[i].close)/3,mf=tp*candles[i].volume;if(tp>prevTP)posF+=mf;else negF+=mf;prevTP=tp;}
  if(negF===0) return 100;
  return parseFloat((100-100/(1+posF/negF)).toFixed(1));
}

function calcATR(candles,period){
  period=period||14;if(candles.length<period+1) return candles[candles.length-1].high-candles[candles.length-1].low;
  var tr=[];
  for(var i=1;i<candles.length;i++){var h=candles[i].high,l=candles[i].low,pc=candles[i-1].close;tr.push(Math.max(h-l,Math.abs(h-pc),Math.abs(l-pc)));}
  var atr=tr.slice(0,period).reduce(function(a,b){return a+b;},0)/period;
  for(var i=period;i<tr.length;i++) atr=(atr*(period-1)+tr[i])/period;
  return atr;
}

function calcVolumeSpike(volumes){
  if(volumes.length<23) return{ratio:1,accel:1,isSpike:false,trend:'flat',gradual:false};
  var cur3=volumes.slice(-3).reduce(function(a,b){return a+b;},0)/3;
  var prev20=volumes.slice(-23,-3),avg=prev20.reduce(function(a,b){return a+b;},0)/prev20.length;
  var ratio=avg>0?parseFloat((cur3/avg).toFixed(2)):1;
  var p3=volumes.slice(-6,-3).reduce(function(a,b){return a+b;},0)/3;
  var accel=p3>0?parseFloat((cur3/p3).toFixed(2)):1;
  var last5=volumes.slice(-5),inc=0;
  for(var i=1;i<last5.length;i++) if(last5[i]>last5[i-1]) inc++;
  var trend=inc>=3?'increasing':inc<=1?'decreasing':'flat';
  return{ratio,accel,isSpike:ratio>=1.5,trend,gradual:trend==='increasing'&&ratio>=1.1&&ratio<1.8};
}

function calcBoxRange(candles){
  var period=Math.min(40,Math.max(15,Math.floor(candles.length*0.2)));
  var last=candles[candles.length-1];
  if(candles.length<period) return{isSideways:false,isBreakout:false,isNearTop:false,distanceToTop:100,breakoutStrength:0,rangePercent:0,high:last.close,low:last.close,boxPeriod:period};
  var box=candles.slice(-period-1,-1);
  var bH=Math.max.apply(null,box.map(function(x){return x.high;})),bL=Math.min.apply(null,box.map(function(x){return x.low;}));
  var cur=last.close,rPct=bL>0?(bH-bL)/bL*100:0,dTop=bH>0?(bH-cur)/bH*100:0,bStr=cur>bH?(cur-bH)/bH*100:0;
  return{high:bH,low:bL,rangePercent:parseFloat(rPct.toFixed(2)),distanceToTop:parseFloat(dTop.toFixed(2)),breakoutStrength:parseFloat(bStr.toFixed(2)),isSideways:rPct<15&&rPct>1.5,isBreakout:cur>bH,isNearTop:dTop>=0&&dTop<=3,boxPeriod:period};
}

function detectSMC(candles){
  if(candles.length<20) return{signals:[],summary:'〰️ SMC: 신호 없음',direction:'neutral'};
  var signals=[],rec=candles.slice(-20),n=rec.length;
  var highs=rec.map(function(c){return c.high;}),lows=rec.map(function(c){return c.low;});
  var pH=Math.max.apply(null,highs.slice(0,n-3)),pL=Math.min.apply(null,lows.slice(0,n-3));
  var lH=Math.max.apply(null,highs.slice(-3)),lL=Math.min.apply(null,lows.slice(-3));
  var lC=rec[n-1].close,lO=rec[n-1].open;
  if(lH>pH) signals.push('🚀 상승 구조 돌파 (BOS↑)');
  if(lL<pL&&lC>pL) signals.push('🔄 상승 전환 시작 (CHoCH↑)');
  if(lH>pH&&lC<pH) signals.push('⚠ 하락 전환 감지 (CHoCH↓)');
  var range=rec[n-1].high-rec[n-1].low,lowerWick=Math.min(lC,lO)-rec[n-1].low;
  if(range>0&&lowerWick/range>0.6&&lC>lO) signals.push('🪤 유동성 털기 감지');
  var bull=0,bear=0;
  signals.forEach(function(s){if(s.includes('BOS↑')||s.includes('CHoCH↑')||s.includes('유동성'))bull++;if(s.includes('CHoCH↓'))bear++;});
  var summary=signals.length===0?'〰️ SMC: 신호 없음':bull>bear?'📈 SMC: 상승 우세':bear>bull?'📉 SMC: 하락 우세':'〰️ SMC: 혼조';
  return{signals,summary,direction:bull>bear?'bull':bear>bull?'bear':'neutral'};
}

function calcEMA(values, period) {
  if (!Array.isArray(values) || values.length < period) return [];
  var k = 2 / (period + 1);
  var ema = [];
  // 초기값: 첫 period개의 SMA
  var sma = 0;
  for (var i = 0; i < period; i++) sma += values[i];
  sma /= period;
  ema.push(sma);
  for (var j = period; j < values.length; j++) {
    var prev = ema[ema.length - 1];
    ema.push(values[j] * k + prev * (1 - k));
  }
  return ema;
}

function calcBTCFilter(btcCandles){
  if(!btcCandles||btcCandles.length<30) return{trend:'unknown',penalty:0,desc:'',rsi:50};
  var closes=btcCandles.map(function(c){return c.close;}),rsi=calcRSI(closes,14);
  var e12=calcEMA(closes,12),e26=calcEMA(closes,26),off=26-12;
  var macdLine=e26.map(function(v,i){return e12[i+off]-v;}),sigLine=calcEMA(macdLine,9);
  var lM=macdLine[macdLine.length-1],lS=sigLine[sigLine.length-1];
  var crossType=lM>lS?'golden_hold':'dead_hold';
  if(macdLine[macdLine.length-2]<=sigLine[sigLine.length-2]&&lM>lS) crossType='golden';
  if(macdLine[macdLine.length-2]>=sigLine[sigLine.length-2]&&lM<lS) crossType='dead';
  var penalty=0,descs=[];
  if(rsi<42){penalty+=1.5;descs.push('BTC RSI 약세');}else if(rsi<48){penalty+=0.5;descs.push('BTC 중립이하');}
  if(crossType==='dead'){penalty+=2;descs.push('MACD 데드');}else if(crossType==='dead_hold'){penalty+=0.5;descs.push('MACD 약화');}
  return{trend:penalty>=2?'bear':penalty>=0.5?'neutral':'bull',penalty:parseFloat(penalty.toFixed(1)),desc:descs.join('/')||'정상',rsi};
}


// ════════════════════════════════════════════════════════════════════
// [06] ANALYSIS
// PRE-PUMP 감지, 점수, 엔트리 판정 (절대 수정 금지)
// ════════════════════════════════════════════════════════════════════

function detectPrePump(volRatio, rsi, box, changeRate) {
  var d = (
    box.isSideways  === true  &&
    box.isBreakout  === false &&
    box.distanceToTop <  3   &&
    volRatio >= 1.3 && volRatio <= 2.5 &&
    rsi >= 50 && rsi <= 65 &&
    Math.abs(changeRate) < 6
  );
  if (volRatio < 1.2) d = false;
  if (rsi < 48)       d = false;
  return d;
}

function calcScore(prePump, volAccel, obvTrend, btcPenalty) {
  var t = 0;
  if (prePump)              t += 3;
  if (volAccel > 1.2)       t += 1.0;
  else if (volAccel > 1.05) t += 0.5;
  if (obvTrend === 'up')    t += 1.0;
  return parseFloat(Math.max(t - btcPenalty, 0).toFixed(2));
}

function calcEntryReady(prePump, total, volAccel, volRatio, gradeCode) {
  if (gradeCode === 'B' || gradeCode === 'C') return false;
  if (!prePump) return false;
  return total >= 3.5 && volAccel > 1.1 && volRatio >= 1.3;
}

function calcGrade(total) {
  if (total >= GRADE_THRESHOLD.SPLUS) return { code:'SPLUS', label:'🔥 S+', color:'var(--grade-sp)' };
  if (total >= GRADE_THRESHOLD.S)     return { code:'S',     label:'🔥 S',  color:'var(--grade-s)' };
  if (total >= GRADE_THRESHOLD.A)     return { code:'A',     label:'🟠 A',  color:'var(--grade-a)' };
  if (total >= GRADE_THRESHOLD.B)     return { code:'B',     label:'B',     color:'var(--grade-b)' };
  return                                     { code:'C',     label:'C',     color:'var(--grade-c)' };
}

function selectRepresentative(exchanges) {
  return exchanges.slice().sort(function(a, b) {
    if (b.total !== a.total) return b.total - a.total;
    if (a.box.distanceToTop !== b.box.distanceToTop)
      return a.box.distanceToTop - b.box.distanceToTop;
    if (b.volAccel !== a.volAccel) return b.volAccel - a.volAccel;
    return (EXCHANGE_PRIORITY[b.exchange]||0) - (EXCHANGE_PRIORITY[a.exchange]||0);
  })[0];
}

function calcSyncStatus(exchanges) {
  var highCount = exchanges.filter(function(ex){
    return ex.prePump || ex.gradeCode==='SPLUS' || ex.gradeCode==='S' || ex.gradeCode==='A';
  }).length;
  var total = exchanges.length;
  if (total === 1) return { type:'solo',   label:'단독 신호 (' + exchanges[0].exchange + ')',   cls:'sync-solo' };
  if (highCount >= 2) return { type:'strong', label:'동조 신호 (' + highCount + '거래소)', cls:'sync-strong' };
  return              { type:'weak',   label:'약한 동조',                              cls:'sync-weak' };
}

function calcAccumulationStrength(prePump, volRatio, volAccel, obvTrend, btcPenalty) {
  var score = 0;

  // 거래량 점수
  if      (volRatio >= 1.5) score += 2;
  else if (volRatio >= 1.3) score += 1;

  // 속도 점수
  if      (volAccel >= 1.2)  score += 2;
  else if (volAccel >= 1.05) score += 1;

  // OBV 점수
  if (obvTrend === 'up') score += 2;

  // 라벨 결정
  var label  = score >= 5 ? '강함' : score >= 3 ? '보통' : '약함';
  var reason = [];
  if (volRatio >= 1.5) reason.push('거래량 강');
  else if (volRatio >= 1.3) reason.push('거래량 보통');
  if (volAccel >= 1.2) reason.push('속도 강');
  else if (volAccel >= 1.05) reason.push('속도 보통');
  if (obvTrend === 'up') reason.push('OBV 상승');
  var reasonStr = reason.length ? reason.join(' + ') : '신호 약함';

  // PRE-PUMP 가드 — 가장 중요
  // prePump=false이면 내부 score는 보존하되 label=참고 불가
  if (!prePump) {
    return { score: score, label: '참고 불가', reason: 'PRE-PUMP 미충족' };
  }

  // BTC 약세 패널티 하향 보정
  if (btcPenalty >= 2) {
    if      (label === '강함') label = '보통';
    else if (label === '보통') label = '약함';
    reasonStr += ' / BTC 약세 영향';
  }

  return { score: score, label: label, reason: reasonStr };
}

function estimateAccumulationCostRange(candles, box, atr) {
  var THRESHOLD = 1.15; // finalEntryAllowed 기준값 (여기서 정의해 공유)

  // 박스 내부 캔들만 추출
  var inner = candles.filter(function(c) {
    return c.close >= box.low && c.close <= box.high;
  });

  // 데이터 부족 fallback
  if (inner.length < 3) {
    var ctr = (box.high + box.low) / 2;
    return {
      low:        parseFloat((ctr - atr * 0.5).toFixed(4)),
      center:     parseFloat(ctr.toFixed(4)),
      high:       parseFloat((ctr + atr * 0.5).toFixed(4)),
      confidence: '낮음'
    };
  }

  // 거래량 상위 30% (최소 5개)
  var sorted = inner.slice().sort(function(a,b){ return b.volume - a.volume; });
  var topN   = Math.max(5, Math.floor(sorted.length * 0.3));
  var top    = sorted.slice(0, topN);

  // 가중 평균 계산 — 패닉셀 anomaly 보정 (수식 고정)
  var totalW = 0, totalWP = 0, anomalyCount = 0;
  top.forEach(function(c) {
    var range = c.high - c.low;
    var bodyRatio = range > 0 ? (c.open - c.close) / range : 0; // 음봉 기준
    var isPanic   = (c.open > c.close) && (bodyRatio > 0.6);    // 수식 고정
    var w  = isPanic ? c.volume * 0.5 : c.volume;
    var tp = (c.high + c.low + c.close) / 3;
    totalW  += w;
    totalWP += tp * w;
    if (isPanic) anomalyCount++;
  });

  var center = totalW > 0 ? totalWP / totalW : (box.high + box.low) / 2;

  // confidence 판단 (박스 좁으면 하향)
  var conf;
  if (top.length >= 8 && anomalyCount <= 1) conf = '높음';
  else if (top.length >= 5)                  conf = '보통';
  else                                        conf = '낮음';

  if (box.rangePercent < 3) {
    // 좁은 박스 → confidence 한 단계 하향
    if      (conf === '높음') conf = '보통';
    else if (conf === '보통') conf = '낮음';
  }

  return {
    low:        parseFloat((center - atr * 0.5).toFixed(4)),
    center:     parseFloat(center.toFixed(4)),
    high:       parseFloat((center + atr * 0.5).toFixed(4)),
    confidence: conf
  };
}

function estimateDistributionTargets(costCenter, atr, box) {
  if (!costCenter || costCenter <= 0) {
    return { target1:0, target2:0, target3:0, note:'평단 추정 불가' };
  }

  // 1차: 동적 계산 — rangePercent 기반 + 박스 상단 안전장치
  var rawT1 = costCenter * (1 + (box.rangePercent / 100) * 1.5);
  var t1    = Math.max(rawT1, box.high * 1.05);

  // 2차, 3차: 계단형 증가
  var t2 = Math.max(costCenter * 1.65, t1 * 1.15);
  var t3 = Math.max(costCenter * 2.10, t2 * 1.15);

  return {
    target1: parseFloat(t1.toFixed(4)),
    target2: parseFloat(t2.toFixed(4)),
    target3: parseFloat(t3.toFixed(4)),
    note:    '1차: 박스 상단 돌파 이후 / 2차: 메인 분배 / 3차: 과열 확장'
  };
}

function calcFakePump(candles, box, volRatio, obvTrend, currentPrice) {
  if (!candles || candles.length < 10) return false;
  if (obvTrend !== 'up' || volRatio < 1.3) return false;
  var recent10 = candles.slice(-10);
  var recentLow = Math.min.apply(null, recent10.map(function(c){ return c.low; }));
  var risePct = recentLow > 0 ? (currentPrice - recentLow) / recentLow * 100 : 0;
  if (risePct <= 10) return false;
  // 최근 5봉 내 박스 하단 이탈 후 회복
  var recent5Min = Math.min.apply(null, candles.slice(-5).map(function(c){ return c.low; }));
  return (recent5Min < box.low && currentPrice > box.low);
}

function calcLateEntry(candles, cpRatio, boxIsBreakout) {
  if (!candles || candles.length < 10) return false;
  if (!boxIsBreakout) return false;           // 박스 미돌파이면 lateEntry 아님
  if (cpRatio <= 1.10) return false;
  var recent10Max = Math.max.apply(null, candles.slice(-10).map(function(c){ return c.high; }));
  var currentClose = candles[candles.length - 1].close;
  return currentClose > recent10Max;
}

function calcPriceGap(upbitPrice, binancePrice, usdtKrw) {
  // 환율 적용 필수 — binancePrice는 USDT 기준
  if (!binancePrice || binancePrice <= 0 || !upbitPrice || upbitPrice <= 0) {
    return { gap: null, gapStatus: '해외 가격 없음' };
  }
  var rate = (usdtKrw && usdtKrw > 0) ? usdtKrw : 1350;
  var binanceKRW = binancePrice * rate;
  var gap = parseFloat(((upbitPrice - binanceKRW) / binanceKRW * 100).toFixed(2));
  var gapStatus = gap > 2 ? '국내 과열' : gap < -2 ? '해외 선행' : '중립';
  return { gap: gap, gapStatus: gapStatus };
}

function buildScoreSummary(prePump, volAccel, obvTrend, btcPenalty) {
  var parts = [];
  if (prePump) parts.push('+3 PRE-PUMP');
  if      (volAccel > 1.2)  parts.push('+1 속도('+volAccel+'x)');
  else if (volAccel > 1.05) parts.push('+0.5 속도('+volAccel+'x)');
  if (obvTrend === 'up') parts.push('+1 OBV');
  if (btcPenalty > 0) parts.push('-'+btcPenalty+' BTC');
  return parts.length ? parts.join(' / ') : '기본값';
}

function buildAnalysis(prePump, volRatio, rsi, box, obvTrend, btcPenalty, volAccel) {
  var strengths = [], weaknesses = [];
  if (prePump) strengths.push('PRE-PUMP 조건 충족');
  if (box.isSideways && box.isNearTop) strengths.push('박스 상단 근접 — 돌파 직전 구조');
  if (box.isBreakout && box.breakoutStrength <= 5) strengths.push('초기 돌파('+box.breakoutStrength.toFixed(1)+'%) ✅');
  if (rsi >= 50 && rsi <= 62) strengths.push('RSI 적정('+rsi.toFixed(1)+') — 과열 없음');
  if (obvTrend === 'up') strengths.push('OBV 상승 선행');
  if (volRatio >= 1.5) strengths.push('거래량 강('+volRatio+'x)');
  else if (volRatio >= 1.3) strengths.push('거래량 증가('+volRatio+'x)');
  if (volAccel >= 1.2) strengths.push('속도 강('+volAccel+'x)');

  if (!prePump) weaknesses.push('PRE-PUMP 미충족');
  if (rsi > 68) weaknesses.push('RSI 과열('+rsi.toFixed(1)+')');
  if (btcPenalty >= 2) weaknesses.push('BTC 약세 — 알트 동반 하락 위험');
  if (btcPenalty > 0 && btcPenalty < 2) weaknesses.push('BTC 중립 이하');
  if (box.isBreakout && box.breakoutStrength > 8) weaknesses.push('돌파 '+box.breakoutStrength.toFixed(1)+'% — 추격 구간');
  if (volRatio < 1.3) weaknesses.push('거래량 부족 — 매집 확인 필요');

  var conclusion;
  if (strengths.length >= 3 && !weaknesses.length)
    conclusion = '구조 + 거래량 동시 확인 — 진입 유효';
  else if (strengths.length > weaknesses.length)
    conclusion = '구조는 좋지만 일부 리스크 — 단계적 접근';
  else
    conclusion = '신호 미확정 — 관찰 유지';

  return { strengths: strengths, weaknesses: weaknesses, conclusion: conclusion };
}

function buildRiskDetails(box, volRatio, btcPenalty, fakePump, lateEntry, hasBinance, obvDivergence) {
  var risks = [];
  if (!box.isBreakout)
    risks.push({ cat:'구조', desc:'돌파 미확정 — 상단 저항 실패 가능' });
  else if (box.breakoutStrength > 8)
    risks.push({ cat:'구조', desc:'돌파 '+box.breakoutStrength.toFixed(1)+'% — 추격 주의' });
  if (volRatio > 3.0)
    risks.push({ cat:'거래량', desc:volRatio+'x 급증 — 단발성 가능' });
  if (btcPenalty >= 2)
    risks.push({ cat:'시장', desc:'BTC 하락 추세 — 알트 동반 하락 위험' });
  if (!hasBinance)
    risks.push({ cat:'데이터', desc:'바이낸스 미수집 — 교차 검증 약함' });
  if (fakePump)
    risks.push({ cat:'패턴', desc:'반등 가능성 — 물린 세력 탈출 주의' });
  if (lateEntry)
    risks.push({ cat:'타이밍', desc:'돌파 후 늦은 진입 — 눌림 대기 권장' });
  if (obvDivergence)
    risks.push({ cat:'OBV', desc:'OBV 다이버전스 — 상승 모멘텀 약화' });
  return risks;
}

async function fetchUSDTKRW(proxy) {
  try {
    var data = await fetchJson(proxy + '/upbit/ticker?markets=KRW-USDT', 5000);
    if (Array.isArray(data) && data.length && data[0].trade_price > 0) {
      return parseFloat(data[0].trade_price);
    }
  } catch(e) {}
  return 1350; // fallback
}


// ══════════════════════════════════════════════════════════════════
// 데이터 수집 (업비트 / 빗썸 / 바이낸스)
// ══════════════════════════════════════════════════════════════════

// 전역 env 참조 (fetchJson에서 Service Binding 사용하기 위함)
var _envRef = null;

async function fetchJson(url, timeoutMs) {
  timeoutMs = timeoutMs || 8000;
  var ctrl = new AbortController();
  var t = setTimeout(function(){ ctrl.abort(); }, timeoutMs);
  try {
    var fetchFn = fetch;
    // Service Binding이 있으면 우선 사용 (Worker-to-Worker 최적화)
    if (_envRef && _envRef.PROXY && typeof _envRef.PROXY.fetch === 'function'
        && url.indexOf(_envRef.PROXY_URL || '') === 0) {
      fetchFn = _envRef.PROXY.fetch.bind(_envRef.PROXY);
    }
    var res = await fetchFn(url, {
      signal: ctrl.signal,
      headers: {
        'accept': 'application/json',
        'user-agent': 'Mozilla/5.0 (compatible; CryptoScannerBot/3.0)',
      },
      cf: { cacheTtl: 0, cacheEverything: false }
    });
    if (!res.ok) throw new Error('HTTP '+res.status+' @ '+url);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

// 업비트 후보 + 캔들

// ════════════════════════════════════════════════════════════════════
// [05] EXCHANGES
// 업비트/빗썸/바이낸스 데이터 수집
// ════════════════════════════════════════════════════════════════════

async function fetchUpbitData(proxy) {
  try {
    // 1단계: 마켓 전체 조회 (HTML과 동일 경로)
    var mData = await fetchJson(proxy + '/upbit/markets', 6000);
    if (!Array.isArray(mData)) return [];
    var markets = mData.filter(function(m){return m.market&&m.market.startsWith('KRW-');})
                       .map(function(m){return m.market;});
    if (!markets.length) return [];

    // 2단계: 청크로 나눠서 티커 조회 (HTML과 동일, 100개씩)
    var tickerMap = {};
    var cs = 100;
    for (var i=0; i<markets.length; i+=cs) {
      var chunk = markets.slice(i,i+cs).join(',');
      try {
        var tData = await fetchJson(proxy + '/upbit/ticker?markets=' + encodeURIComponent(chunk), 8000);
        if (Array.isArray(tData)) tData.forEach(function(t){tickerMap[t.market]=t;});
      } catch(e){}
      if (i+cs < markets.length) await new Promise(function(r){setTimeout(r,100);});
    }

    // 거래대금 5억 이상, 상위 한도까지
    var filtered = Object.keys(tickerMap)
      .filter(function(m){var t=tickerMap[m];return t&&(t.acc_trade_price_24h||0)>=500000000;})
      .map(function(m){var t=tickerMap[m];return{
        market:m, base:m.replace('KRW-',''), price:t.trade_price,
        changeRate:t.signed_change_rate*100,
        tradeValue:t.acc_trade_price_24h
      };})
      .sort(function(a,b){return b.tradeValue-a.tradeValue;})
      .slice(0, SCAN_LIMIT_UPBIT);

    // 3단계: 각 코인 캔들 조회
    var out = [];
    for (var j=0; j<filtered.length; j++) {
      var t = filtered[j];
      try {
        var kl = await fetchJson(proxy + '/upbit/candles?market=' + t.market + '&count=' + CANDLE_COUNT, 7000);
        var candles = normalizeCandles(kl.candles || kl);
        if (candles.length < 50) continue;
        out.push({
          exchange: 'UPBIT', base: t.base, market: t.market,
          price: t.price, changeRate: t.changeRate,
          candles: candles
        });
      } catch(e){}
      await new Promise(function(r){setTimeout(r,100);});
    }
    return out;
  } catch(e) { return []; }
}

async function fetchBithumbData(proxy) {
  try {
    var data = await fetchJson(proxy + '/bithumb/ticker', 8000);
    if (!Array.isArray(data)) return [];

    // 거래대금 5억 이상, 상위 한도까지
    var filtered = data
      .filter(function(t){return (parseFloat(t.acc_trade_price_24h)||0) >= 500000000;})
      .map(function(t){return{
        market:t.market, base:t.market.replace('KRW-',''),
        price:t.trade_price, changeRate:t.signed_change_rate*100,
        tradeValue: parseFloat(t.acc_trade_price_24h)||0
      };})
      .sort(function(a,b){return b.tradeValue-a.tradeValue;})
      .slice(0, SCAN_LIMIT_BITHUMB);

    var out = [];
    for (var i=0; i<filtered.length; i++) {
      var t = filtered[i];
      try {
        var kl = await fetchJson(proxy + '/bithumb/candles?market=' + t.market + '&count=' + CANDLE_COUNT, 7000);
        var candles = normalizeCandles(kl.candles || kl);
        if (candles.length < 50) continue;
        out.push({
          exchange: 'BITHUMB', base: t.base, market: t.market,
          price: t.price, changeRate: t.changeRate,
          candles: candles
        });
      } catch(e){}
      await new Promise(function(r){setTimeout(r,100);});
    }
    return out;
  } catch(e) { return []; }
}

async function fetchBinanceData(proxy) {
  try {
    var raw = await fetchJson(proxy + '/api/v3/ticker/24hr', 10000);
    if (!Array.isArray(raw)) return [];

    // USDT 페어, 거래대금 40만 이상, 상위 SCAN_LIMIT개 (ENABLE_BINANCE 시)
    var filtered = raw
      .filter(function(t){return t.symbol.endsWith('USDT') && (parseFloat(t.quoteVolume)||0) >= 400000;})
      .map(function(t){return{
        market:t.symbol, base:t.symbol.replace('USDT',''),
        price:parseFloat(t.lastPrice), changeRate:parseFloat(t.priceChangePercent),
        tradeValue:parseFloat(t.quoteVolume)
      };})
      .sort(function(a,b){return b.tradeValue-a.tradeValue;})
      .slice(0, SCAN_LIMIT);

    var out = [];
    for (var i=0; i<filtered.length; i++) {
      var t = filtered[i];
      try {
        var kl = await fetchJson(proxy + '/api/v3/klines?symbol=' + t.market + '&interval=1h&limit=' + CANDLE_COUNT, 7000);
        if (!Array.isArray(kl)) continue;
        var rawCandles = kl.map(function(c){return{
          time:parseInt(c[0]), open:parseFloat(c[1]), high:parseFloat(c[2]),
          low:parseFloat(c[3]), close:parseFloat(c[4]), volume:parseFloat(c[5])
        };});
        var candles = normalizeCandles(rawCandles);
        if (candles.length < 50) continue;
        out.push({
          exchange: 'BINANCE', base: t.base, market: t.market,
          price: t.price, changeRate: t.changeRate,
          candles: candles
        });
      } catch(e){}
      await new Promise(function(r){setTimeout(r,100);});
    }
    return out;
  } catch(e) { return []; }
}

// ══════════════════════════════════════════════════════════════════
// 심볼 분석 — HTML analyzeSymbolForExchange 와 1:1 동일
// ══════════════════════════════════════════════════════════════════
function analyzeSymbolForExchange(candidate, btcFilter) {
  var candles = candidate.candles;
  var closes  = candles.map(function(c){return c.close;});
  var volumes = candles.map(function(c){return c.volume;});

  var rsi  = calcRSI(closes);
  var obv  = calcOBV(candles);
  var vol  = calcVolumeSpike(volumes);
  var box  = calcBoxRange(candles);
  var mfi  = calcMFI(candles);
  var smc  = detectSMC(candles);
  var atr  = calcATR(candles);

  var prePump      = detectPrePump(vol.ratio, rsi, box, candidate.changeRate);
  var total        = calcScore(prePump, vol.accel, obv.trend, btcFilter.penalty);
  var gradeInfo    = calcGrade(total);
  var isEntryReady = calcEntryReady(prePump, total, vol.accel, vol.ratio, gradeInfo.code);

  var action = '관찰만';
  if (isEntryReady && gradeInfo.code === 'SPLUS') action = '진입 우선';
  else if (isEntryReady)                           action = '분할 진입';
  else if (prePump)                                action = 'PRE-PUMP 대기';
  if (rsi > 75 || (box.isBreakout && box.breakoutStrength > 12)) action = '추격 금지';
  if (btcFilter.trend === 'bear' && total < 4)                    action = '관망 (BTC 약세)';

  var scoreSummary = buildScoreSummary(prePump, vol.accel, obv.trend, btcFilter.penalty);
  var accStr  = calcAccumulationStrength(prePump, vol.ratio, vol.accel, obv.trend, btcFilter.penalty);
  var accCost = estimateAccumulationCostRange(candles, box, parseFloat(atr.toFixed(6)));
  var cpRatio = (candidate.price > 0 && accCost.center > 0)
    ? parseFloat((candidate.price / accCost.center).toFixed(3)) : 1.0;
  var cpLabel, cpNote;
  if      (cpRatio < 1.10) { cpLabel='매집';     cpNote='진입 구간'; }
  else if (cpRatio < 1.30) { cpLabel='초기 상승'; cpNote='추세 확인'; }
  else if (cpRatio < 1.70) { cpLabel='본 상승';   cpNote='추격 주의'; }
  else if (cpRatio < 2.00) { cpLabel='분배 경계'; cpNote='세력 분배 가능성'; }
  else                      { cpLabel='과열';      cpNote='진입 금지'; }
  var currentPhase = { ratio:cpRatio, label:cpLabel, note:cpNote };
  var distTargets  = estimateDistributionTargets(accCost.center, parseFloat(atr.toFixed(6)), box);

  var finalEntryAllowed = (accCost.confidence !== '낮음') && (cpRatio <= ENTRY_THRESHOLD);

  var fakePump  = calcFakePump(candles, box, vol.ratio, obv.trend, candidate.price);
  var lateEntry = calcLateEntry(candles, cpRatio, box.isBreakout);

  var actionDesc;
  if (lateEntry)                        actionDesc = '눌림 대기: 돌파 후 늦은 진입 (추격 주의)';
  else if (action === '진입 우선')      actionDesc = '평단 이격 낮고 구조 양호 — 적극 진입';
  else if (action === '분할 진입')      actionDesc = 'PRE-PUMP 충족 — 분할 매수로 리스크 관리';
  else if (action === 'PRE-PUMP 대기')  actionDesc = '구조는 좋지만 돌파 전 대기 — 눌림 재진입';
  else if (action === '추격 금지')      actionDesc = '이미 '+cpRatio+'x 이격 — 신규 진입 위험';
  else                                   actionDesc = '신호 확정 전 관찰 유지';

  if (fakePump && accStr.label !== '참고 불가') {
    accStr = { score: accStr.score, label: '주의 (반등 가능성)', reason: accStr.reason + ' / fakePump 감지' };
  }

  var analysis    = buildAnalysis(prePump, vol.ratio, rsi, box, obv.trend, btcFilter.penalty, vol.accel);
  var hasBinance  = candidate.exchange === 'BINANCE';
  var riskDetails = buildRiskDetails(box, vol.ratio, btcFilter.penalty, fakePump, lateEntry, hasBinance, obv.divergence || false);

  return {
    exchange: candidate.exchange, base: candidate.base, market: candidate.market,
    price: candidate.price, changeRate: candidate.changeRate,
    gradeCode: gradeInfo.code, gradeLabel: gradeInfo.label, gradeColor: gradeInfo.color,
    total: total, prePump: prePump, isEntryReady: isEntryReady, action: action,
    scoreSummary: scoreSummary, rsi: rsi, mfi: mfi, obv: obv, vol: vol, box: box,
    smc: smc, atr: parseFloat(atr.toFixed(6)),
    accumulationStrength: accStr, accumulationCost: accCost,
    currentPhase: currentPhase, distributionTargets: distTargets,
    finalEntryAllowed: finalEntryAllowed,
    fakePump: fakePump, lateEntry: lateEntry, actionDesc: actionDesc,
    analysis: analysis, riskDetails: riskDetails,
    priceGap: null, gapStatus: '계산 전',
    candles: candles,
  };
}

// ══════════════════════════════════════════════════════════════════
// KV 관리 — 쿨다운 + 스냅샷 + 수면 큐 (HTML과 통합)
// ══════════════════════════════════════════════════════════════════

// 쿨다운 키 패턴: cd_{base}_{type}
async function getCooldown(env, base, type) {
  try {
    var raw = await env.ALERT_KV.get('cd_' + base + '_' + type);
    return raw ? JSON.parse(raw) : null;
  } catch(e) { return null; }
}

async function setCooldown(env, base, type, grade, score) {
  try {
    var data = { sentAt: Date.now(), grade: grade, score: score };
    // TTL = 쿨다운 시간 × 2 (안전 여유)
    var ttl = Math.ceil(((COOLDOWN[type]||3600000) * 2) / 1000);
    await env.ALERT_KV.put('cd_' + base + '_' + type, JSON.stringify(data), { expirationTtl: ttl });
  } catch(e) {}
}

// HTML canSendAlert 와 동일 로직 — KV 기반
async function canSend(env, base, type, newGrade, newScore) {
  var prev = await getCooldown(env, base, type);
  if (!prev) return true;
  var now = Date.now(), last = prev.sentAt || 0;
  var cd  = COOLDOWN[type] || 3600000;
  var inCD = (now - last) < cd;
  if (!inCD) return true;
  // 등급 상승이면 허용
  var gradeOrder = { '':0, 'C':1, 'B':2, 'A':3, 'S':4, 'SPLUS':5 };
  if ((gradeOrder[newGrade]||0) > (gradeOrder[prev.grade]||0)) return true;
  if (newScore - (prev.score||0) >= 1) return true;
  return false;
}

// 스냅샷 KV 저장 (HTML과 동일 구조)
// ═══════════════════════════════════════════════════════════════════
// Stats Summary Helpers (Phase 2)
// ═══════════════════════════════════════════════════════════════════
function defaultStatsSummary() {
  return {
    total: 0,
    success: 0,
    fail: 0,
    pending: 0,
    byGrade: {
      SPLUS: { total: 0, success: 0, fail: 0, pending: 0 },
      S:     { total: 0, success: 0, fail: 0, pending: 0 },
      A:     { total: 0, success: 0, fail: 0, pending: 0 }
    },
    byExchange: {
      UPBIT:   { total: 0, success: 0, fail: 0, pending: 0 },
      BITHUMB: { total: 0, success: 0, fail: 0, pending: 0 },
      BINANCE: { total: 0, success: 0, fail: 0, pending: 0 }
    },
    lastUpdated: null
  };
}

async function getStatsSummary(env) {
  try {
    var raw = await env.ALERT_KV.get('stats_summary');
    if (!raw) return defaultStatsSummary();
    var parsed = JSON.parse(raw);
    // 구조 검증 + 누락 필드 보강
    var def = defaultStatsSummary();
    if (!parsed.byGrade)    parsed.byGrade = def.byGrade;
    if (!parsed.byExchange) parsed.byExchange = def.byExchange;
    ['SPLUS','S','A'].forEach(function(g){
      if (!parsed.byGrade[g]) parsed.byGrade[g] = { total:0, success:0, fail:0, pending:0 };
    });
    ['UPBIT','BITHUMB','BINANCE'].forEach(function(e){
      if (!parsed.byExchange[e]) parsed.byExchange[e] = { total:0, success:0, fail:0, pending:0 };
    });
    return parsed;
  } catch(e) {
    return defaultStatsSummary();
  }
}

// 스냅샷 저장 시 호출 (pending으로 집계)
// delta: +1 = 추가, -1 = 차감
async function updateStatsPending(env, grade, exchange, delta) {
  try {
    var stats = await getStatsSummary(env);
    stats.total   += delta;
    stats.pending += delta;
    if (stats.byGrade[grade]) {
      stats.byGrade[grade].total   += delta;
      stats.byGrade[grade].pending += delta;
    }
    if (stats.byExchange[exchange]) {
      stats.byExchange[exchange].total   += delta;
      stats.byExchange[exchange].pending += delta;
    }
    stats.lastUpdated = new Date().toISOString();
    await env.ALERT_KV.put('stats_summary', JSON.stringify(stats));
    return stats;
  } catch(e) {
    return null;
  }
}

// outcome 기록 시 호출 (pending → success/fail 이동)
// result: 'success' 또는 'fail'
// previousResult: 이전 outcome이 있으면 그 값 (null이면 신규)
async function updateStatsOutcome(env, grade, exchange, result, previousResult) {
  try {
    var stats = await getStatsSummary(env);
    var r = (result === 'success' || result === 'SUCCESS') ? 'success' : 'fail';

    // 신규 outcome (이전 없음): pending-- , r++
    // 수정 (이전 있음): previousR-- , r++ (pending 변화 없음)
    if (!previousResult) {
      stats.pending -= 1;
      stats[r]      += 1;
      if (stats.byGrade[grade]) {
        stats.byGrade[grade].pending -= 1;
        stats.byGrade[grade][r]      += 1;
      }
      if (stats.byExchange[exchange]) {
        stats.byExchange[exchange].pending -= 1;
        stats.byExchange[exchange][r]      += 1;
      }
    } else {
      var prev = (previousResult === 'success' || previousResult === 'SUCCESS') ? 'success' : 'fail';
      if (prev !== r) {
        stats[prev] -= 1;
        stats[r]    += 1;
        if (stats.byGrade[grade]) {
          stats.byGrade[grade][prev] -= 1;
          stats.byGrade[grade][r]    += 1;
        }
        if (stats.byExchange[exchange]) {
          stats.byExchange[exchange][prev] -= 1;
          stats.byExchange[exchange][r]    += 1;
        }
      }
    }
    stats.lastUpdated = new Date().toISOString();
    await env.ALERT_KV.put('stats_summary', JSON.stringify(stats));
    return stats;
  } catch(e) {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════
// Phase 3 - Prefilter (상승 직전 코인 스크리닝)
// 지시서 요구: volRatio, volAccel, OBV, RSI, priceRatio 점수화
// ═══════════════════════════════════════════════════════════════════
function calcPrefilterScore(coin) {
  var rep = coin && coin.representative;
  if (!rep) return { score: 0, pass: false, details: { reason: 'no_rep' } };

  var vol = rep.vol || {};
  var obv = rep.obv || {};
  var rsi = typeof rep.rsi === 'number' ? rep.rsi : null;
  var accCost = rep.accumulationCost || {};
  var price = rep.price || 0;

  var details = {};
  var score = 0;

  // ① volRatio — 거래량 증가율
  var volRatio = vol.ratio || 0;
  details.volRatio = volRatio;
  if (volRatio > 1.5) { score++; details.volRatio_ok = true; }
  if (volRatio > 2.0) { score++; details.volRatio_strong = true; }

  // ② volAccel — 거래량 속도
  var volAccel = vol.accel || 0;
  details.volAccel = volAccel;
  if (volAccel > 1.3) { score++; details.volAccel_ok = true; }

  // ③ OBV 상승/유지
  details.obvTrend = obv.trend || 'unknown';
  if (obv.trend === 'up' || obv.trend === 'flat') {
    score++;
    details.obv_ok = true;
  }

  // ④ RSI 55~70
  details.rsi = rsi;
  if (rsi !== null && rsi >= 55 && rsi <= 70) {
    score++;
    details.rsi_ok = true;
  }

  // ⑤ priceRatio — 현재가 / 매집중심
  //   매집중심 없으면 skip (정밀분석 전 단계이므로 관대)
  if (accCost.center && accCost.center > 0 && price > 0) {
    var priceRatio = price / accCost.center;
    details.priceRatio = parseFloat(priceRatio.toFixed(4));
    if (priceRatio <= 1.15) {
      score++;
      details.priceRatio_ok = true;
    }
  } else {
    details.priceRatio = null;
  }

  return {
    score: score,
    pass: score >= 3,            // 지시서: score >= 3 통과
    priority: score >= 4,        // 지시서: score >= 4 우선 후보
    details: details
  };
}

// 티커 1차 게이트 — 이미 상승한 코인 제외 (24h 변동률 기준)
// 지시서 priceRatio 1.20 이상 제외 철학을 티커 단계에 반영
function passTickerGate(ticker, exchange) {
  try {
    var change24h = 0;
    if (exchange === 'UPBIT') {
      // 업비트 티커: signed_change_rate (-1 ~ 1)
      change24h = (ticker.signed_change_rate || 0) * 100;
    } else if (exchange === 'BITHUMB') {
      // 빗썸 티커: fluctate_rate_24H (퍼센트)
      change24h = parseFloat(ticker.fluctate_rate_24H || 0);
    }
    // 지시서 기준: 이미 +8% 이상 오른 코인 제외
    if (change24h > 8) return { pass: false, reason: 'already_pumped', change24h: change24h };
    if (change24h < -15) return { pass: false, reason: 'too_dumped', change24h: change24h };
    return { pass: true, change24h: change24h };
  } catch(e) {
    return { pass: true, change24h: null };  // 에러 시 관대하게 통과
  }
}

async function saveSnapshotKV(env, snapshot) {
  try {
    var snapshotId = snapshot.snapshotId;
    var base = snapshot.base;
    var grade = snapshot.gradeCode || 'UNKNOWN';
    
    // 1. 상세 저장 (30일 TTL)
    await env.ALERT_KV.put('snap_' + snapshotId, JSON.stringify(snapshot),
      { expirationTtl: 86400 * 30 });

    // 2. 최근 인덱스 업데이트 (최대 100개)
    await updateSnapshotIndex(env, 'snap_idx_recent', snapshotId, snapshot, 100);

    // 3. 코인별 인덱스 (최대 50개)
    if (base) {
      await updateSnapshotIndex(env, 'snap_idx_base_' + base, snapshotId, snapshot, 50);
    }

    // 4. 등급별 인덱스 (최대 50개)
    if (grade) {
      await updateSnapshotIndex(env, 'snap_idx_grade_' + grade, snapshotId, snapshot, 50);
    }

    // 5. stats 집계 (total/pending +1)
    await updateStatsPending(env, grade, snapshot.exchange, +1);

    return true;
  } catch(e) {
    return false;
  }
}

// ══════════════════════════════════════════════════════════════════
// Phase 3.2-A — 분석기(Tracking) 핵심 모듈
// 기반 문서: ANALYZER_PHILOSOPHY_REPORT_v1.3.md
//           STEP_A_TRACKING_DESIGN_v2.0.md
//           ANALYZER_STANDARD_PROMPT_v1.1.md
// ══════════════════════════════════════════════════════════════════

// KV 키 헬퍼 — Race condition 방지를 위한 별도 키 분산 구조
var TRACKING_KEYS = {
  meta:    function(id){ return 'track_meta_' + id; },
  t1:      function(id, idx){ return 'track_t1_' + id + '_' + idx; },
  t2:      function(id, idx){ return 'track_t2_' + id + '_' + idx; },
  thr:     function(id){ return 'track_thr_' + id; },
  tp1:     function(id){ return 'track_tp1_' + id; },
  sum:     function(id){ return 'track_sum_' + id; },
  qty:     function(id){ return 'track_qty_' + id; },
  active:  'track_active',
  doneRecent: 'track_done_recent',
  pending24h: 'track_pending_24h',
  // [Phase 4.7 공사 4 — A2-경량] last_sample_{id} 박제 키
  // /tracking/active 응답 시 추적당 1번 read 로 lastPrice/currentPct 등 즉시 표시
  // 페이지 로드 0.45초 후 모든 카드 정상 표시 (이전: 60초 후 표시)
  lastSample: function(id){ return 'last_sample_' + id; },
  // [Phase 4.7 공사 4 — Q3+G6] notify_sent_{id} 키 (텔레 중복 전송 방지)
  // 만료 1h 전 / 종료 시점 알람 1회만 전송 보장
  notifySent: function(id){ return 'notify_sent_' + id; },
};

// Tier 별 한도
var TRACKING_LIMITS = {
  // [Phase 4.7.9 R8-1] 사용자 결정: 정밀 한도 분리 정책
  // v4.7.15 정책: 정밀은 관심/자동 합산 최대 30개
  // 관심은 사용자가 켠 상태이므로 가능하면 보호하고, 초과 시 자동 정밀부터 강등
  // 한도 초과 시: 자동 정밀만 강등 (관심은 면제) + 텔레 알람
  TIER_A_MAX: 30,
  TIER_A_AUTO_MAX: 30,   // 자동 정밀 한도 (v4.7.15: 정밀 총 30개 정책)
  TIER_A_WATCH_MAX: 30,  // 관심 코인도 정밀 총 30개 정책 안에서 처리
  TIER_B_MAX: 50,
  // Tier C: 무제한 (1회 측정이라 부담 적음)
};

// [Phase 3.13] 중복 등록 차단 윈도우 (D-120 정책)
// [v4.7.15] duplicate 정책: 중복 카드는 만들지 않고 이벤트만 기존 active/meta에 누적
// 값은 debug/meta 호환용으로 남긴다. 실제 차단 판단은 findActiveDuplicate(base+exchange) 존재 여부로 수행.
var DUPLICATE_DEDUPE_WINDOW_MS = 0;

// [Phase 3.14] fetch 실패 시 재시도 cooldown — 매 cron */2 마다 같은 idx 재시도하지 않도록
// fetch 실패 후 nextRetryAt 까지 skip. tier1(30분) 기준 sample 당 최대 3회 시도, tier2(120분) 기준 12회.
// 효과: tier1 ~80%, tier2 ~80% fetchErrors 누적 감소
var FETCH_RETRY_COOLDOWN_MS = 10 * 60 * 1000;

// [핫픽스: 시간 정규화] timestamp 가 ISO 8601 문자열 또는 ms 숫자 어느 쪽이든 안전하게 ms 로 변환
// buildSnapshotData 가 ISO 8601 string 을 저장하므로 startTracking 등에서 type 안전성 확보 필수
// 문자열 + 숫자 = 문자열 결합 (JavaScript) 방지 + 이미 깨진 데이터 자동 복구
function normalizeTimeMs(t) {
  if (t == null) return null;
  if (typeof t === 'number' && isFinite(t) && t > 0) return t;
  if (typeof t === 'string') {
    // 1차: 직접 파싱 시도
    var parsed = Date.parse(t);
    if (!isNaN(parsed)) return parsed;
    // 2차: 숫자 string 시도
    var n = Number(t);
    if (!isNaN(n) && isFinite(n) && n > 0) return n;
    // 3차: 깨진 결합 패턴 복구 — ISO 8601 prefix + 숫자 (예: "2026-04-25T15:20:35.273Z86400000")
    // 이는 string + 86400000 = string 결합 버그의 결과. ISO 부분 + 숫자 부분 분리 후 합산
    var m = t.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z)(\d+)$/);
    if (m) {
      var iso = Date.parse(m[1]);
      var add = Number(m[2]);
      if (!isNaN(iso) && !isNaN(add) && isFinite(iso) && isFinite(add)) {
        return iso + add;
      }
    }
  }
  return null;
}

// [원칙 5: 선별은 추적 빈도의 차등이지, 측정의 배제가 아니다]
// [STEP A v2.0 Section 2.1 — Tier 자동 분류]
// 스캐너 알람 → Tier 결정 (A/B/C)
// 분류 기준: gradeCode + syncStatus + fakePump + lateEntry + btcFilter
function assignTier(snapshot) {
  // snapshot.scanner 가 없는 경우 대비 (legacy/edge case)
  var s = snapshot.scanner || snapshot;
  var grade = s.gradeCode || s.grade || 'UNKNOWN';
  var syncStatus = (s.syncStatus && s.syncStatus.type) || s.syncStatus || '';
  var fakePump = s.fakePump === true;
  var lateEntry = s.lateEntry === true;
  var btcAllow = s.btcFilter ? (s.btcFilter.allow !== false) : true;
  
  // Tier A 조건 (AND): SPLUS/S + sync_strong + !fakePump + !lateEntry + btc_allow
  var isA = (grade === 'SPLUS' || grade === 'S')
    && syncStatus === 'strong'
    && !fakePump
    && !lateEntry
    && btcAllow;
  
  if (isA) {
    return { tier: 'A', reason: 'SPLUS/S+sync_strong+!fakePump+!lateEntry+btc_allow' };
  }
  
  // Tier B 조건: A 등급 OR (SPLUS/S 중 일부 미달)
  var isB = (grade === 'A')
    || ((grade === 'SPLUS' || grade === 'S')
        && (syncStatus !== 'strong' || lateEntry === true));
  
  if (isB) {
    return { tier: 'B', reason: 'A_grade or (SPLUS/S degraded conditions)' };
  }
  
  // Tier C: 그 외
  var reason = 'other';
  if (grade === 'B' || grade === 'C') reason = 'low_grade';
  else if (fakePump) reason = 'fakePump';
  else if (!btcAllow) reason = 'btcFilter_blocked';
  
  return { tier: 'C', reason: reason };
}

// [원칙 4-B: usable 플래그 — Tier 별 차등 임계]
// [STEP A v2.0 Section 2.8 — 봇 인터페이스 표준화]
// 분석기가 미리 판정해서 봇이 매번 임계값 직접 계산하지 않도록 함
function computeUsable(dataQuality, tier) {
  // Tier 별 fetchErrors 임계
  var errThreshold = (tier === 'A') ? 5
                   : (tier === 'B') ? 3
                   : 0;  // Tier C: 1시간봉 손실 치명적
  
  var dq = dataQuality || {};
  var completeness = (typeof dq.completeness === 'number') ? dq.completeness : 0;
  var fetchErrors = (typeof dq.fetchErrors === 'number') ? dq.fetchErrors : 999;
  var status = dq.status || '';
  
  var isUsable = completeness >= 0.7
    && fetchErrors <= errThreshold
    && status === 'completed';
  
  var reason = isUsable
    ? 'completeness=' + completeness + ' >= 0.7 && fetchErrors=' + fetchErrors + ' <= ' + errThreshold
    : 'failed: completeness=' + completeness + ', fetchErrors=' + fetchErrors + ', status=' + status;
  
  return { usable: isUsable, usableReason: reason };
}

// [원칙 5: 한도 강제 — 강등 정책]
// [STEP A v2.0 Section 7.3 — Cron 한도 보호]
// startTracking 시점에 호출 → Tier A/B 한도 초과 시 강등/종료
// Subrequests 한도 50/Cron 보호의 핵심
async function enforceTrackingLimits(env) {
  try {
    var raw = await env.ALERT_KV.get(TRACKING_KEYS.active);
    var active = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(active)) active = [];
    
    // active 항목: { id, tier, tierAssignedAt }
    var tierA = active.filter(function(x){ return x.tier === 'A'; });
    var tierB = active.filter(function(x){ return x.tier === 'B'; });
    var tierC = active.filter(function(x){ return x.tier === 'C'; });
    
    var demoted = [];
    var terminated = [];
    
    // ── [Phase 4.7.9 R8-3] Tier A 한도 초과 → 자동 정밀만 강등 (관심 면제) ──
    // 사용자 결정: 자동 40 + 관심 10 분리 한도
    // 자동 정밀 (isWatchlist=false) > 40 시: 가장 오래된 자동 정밀 → 표준 강등 + 텔레 알람
    // 관심 코인 (isWatchlist=true) 강등 면제 (사용자가 직접 등록)
    var v479_tierA_auto = tierA.filter(function(x){ return !x.isWatchlist; });
    var v479_tierA_watch = tierA.filter(function(x){ return x.isWatchlist; });
    var v479_demotedDetails = [];  // 텔레 알람용 상세 정보
    
    if (tierA.length > TRACKING_LIMITS.TIER_A_MAX && v479_tierA_auto.length > 0) {
      v479_tierA_auto.sort(function(a, b){ return (a.tierAssignedAt || 0) - (b.tierAssignedAt || 0); });
      var demoteCount = Math.min(v479_tierA_auto.length, tierA.length - TRACKING_LIMITS.TIER_A_MAX);
      for (var i = 0; i < demoteCount; i++) {
        var target = v479_tierA_auto[i];
        target.tier = 'B';
        target.trackingMode = 'light';  // 표준으로 변경
        target.windowDays = 1;
        target.demotedAt = Date.now();
        demoted.push(target.id);
        v479_demotedDetails.push({
          id: target.id,
          base: target.base || '?',
          exchange: target.exchange || '?',
        });
        
        // meta KV 도 업데이트
        try {
          var metaRaw = await env.ALERT_KV.get(TRACKING_KEYS.meta(target.id));
          if (metaRaw) {
            var meta = JSON.parse(metaRaw);
            meta.tier = 'B';
            meta.trackingMode = 'light';
            meta.windowDays = 1;
            meta.demotedAt = target.demotedAt;
            meta.demotedFrom = 'A';
            meta.demotedReason = 'tier-a-auto-limit-exceeded';
            await env.ALERT_KV.put(TRACKING_KEYS.meta(target.id), JSON.stringify(meta),
              { expirationTtl: 86400 * 30 });
          }
        } catch(e) { /* meta 업데이트 실패는 무시 */ }
      }
      // 강등 후 Tier B 리스트 재계산
      tierB = active.filter(function(x){ return x.tier === 'B'; });
      
      // [R8-3] 텔레 알람 발송 (강등된 코인 목록)
      if (v479_demotedDetails.length > 0) {
        try {
          var v479_msg = '⚠️ <b>정밀 한도 도달 — 자동 강등</b>\n\n'
                       + '한도: ' + TRACKING_LIMITS.TIER_A_AUTO_MAX + '개 (자동 정밀)\n'
                       + '강등: ' + v479_demotedDetails.length + '개 → 표준\n\n'
                       + v479_demotedDetails.map(function(d){
                           return '• ' + d.base + ' (' + d.exchange + ')';
                         }).join('\n');
          await sendTelegram(env, v479_msg);
        } catch(v479_tgErr) { /* 텔레 알람 실패는 무시 */ }
      }
    }
    
    // 관심 코인 한도 (10) 초과 시: 경고만 (강등 X — 사용자 직접 등록한 것 보호)
    // 실제로는 PUT /watchlist 라우트에서 진입 거부 처리 (R8-4 참조)
    
    // ── Tier B 한도 초과 → 가장 오래된 것 종료 ──
    if (tierB.length > TRACKING_LIMITS.TIER_B_MAX) {
      tierB.sort(function(a, b){ return (a.tierAssignedAt || 0) - (b.tierAssignedAt || 0); });
      var terminateCount = tierB.length - TRACKING_LIMITS.TIER_B_MAX;
      for (var j = 0; j < terminateCount; j++) {
        var t = tierB[j];
        t.status = 'terminated';
        t.terminatedAt = Date.now();
        terminated.push(t.id);
        
        try {
          var mRaw = await env.ALERT_KV.get(TRACKING_KEYS.meta(t.id));
          if (mRaw) {
            var m = JSON.parse(mRaw);
            m.status = 'terminated';
            m.terminatedAt = t.terminatedAt;
            m.terminatedReason = 'tier_B_limit_exceeded';
            await env.ALERT_KV.put(TRACKING_KEYS.meta(t.id), JSON.stringify(m),
              { expirationTtl: 86400 * 30 });
          }
        } catch(e) { /* meta 업데이트 실패는 무시 */ }
      }
    }
    
    // ── 종료된 항목은 active 에서 제거 ──
    var newActive = active.filter(function(x){ return x.status !== 'terminated'; });
    
    // active 리스트 저장
    await env.ALERT_KV.put(TRACKING_KEYS.active, JSON.stringify(newActive),
      { expirationTtl: 86400 * 30 });
    
    return {
      demoted: demoted,
      terminated: terminated,
      tierACount: newActive.filter(function(x){ return x.tier === 'A'; }).length,
      tierBCount: newActive.filter(function(x){ return x.tier === 'B'; }).length,
      tierCCount: newActive.filter(function(x){ return x.tier === 'C'; }).length,
    };
  } catch(e) {
    return { error: String(e), demoted: [], terminated: [] };
  }
}

// [Phase 3.13] snapshotId 에서 base / exchange 추출
// 형식: <BASE>_<YYYYMMDD>_<HHMM>_<EXCHANGE>  예: 'HIGH_20260426_0840_BITHUMB'
// active 항목에 base/exchange 가 없는 경우(Phase 3.13 이전 등록분) 의 fallback
function parseBaseExchange(snapshotId) {
  if (!snapshotId || typeof snapshotId !== 'string') return null;
  var parts = snapshotId.split('_');
  if (parts.length < 4) return null;
  return { base: parts[0], exchange: parts[parts.length - 1] };
}

// [Phase 3.13] active 리스트에서 동일 base + exchange 의 활성 추적 찾기
// active 항목 자체에 base/exchange 가 있으면 그대로 사용 (Phase 3.13 이후),
// 없으면 snapshotId 파싱으로 fallback (Phase 3.13 이전 누적분)
// [중요] 가장 최근 (tierAssignedAt 가 가장 큰) match 를 반환 — D-120 정책 정확 적용
// 이유: 같은 base+exch 가 다중 등록된 경우 가장 최근 등록과 비교해야 120분 윈도우 정확히 작동
function findActiveDuplicate(active, base, exchange) {
  if (!Array.isArray(active) || !base || !exchange) return null;
  var latest = null;
  for (var i = 0; i < active.length; i++) {
    var act = active[i];
    if (!act || !act.id) continue;
    
    var actBase = act.base;
    var actExchange = act.exchange;
    
    if (!actBase || !actExchange) {
      var parsed = parseBaseExchange(act.id);
      if (parsed) {
        actBase = actBase || parsed.base;
        actExchange = actExchange || parsed.exchange;
      }
    }
    
    if (actBase === base && actExchange === exchange) {
      // 가장 최근 등록을 채택 (D-120 정책의 윈도우 기준점)
      if (!latest || (act.tierAssignedAt || 0) > (latest.tierAssignedAt || 0)) {
        latest = act;
      }
    }
  }
  return latest;
}

// [원칙 7: 확장 가능성 — version 필드]
// [원칙 1: 사후 기록 — 추적 시작 시점 기록]
// ══════════════════════════════════════════════════════════════════
// [Phase 4.6.1] sCount24 계산 — 24h 윈도우 + 같은 base+exchange + S/S+ 카운트
// active 리스트 + completed 리스트 통합 스캔
// ══════════════════════════════════════════════════════════════════
async function v461_computeSCount24(env, base, exchange, now) {
  if (!base || !exchange) return 0;
  var DAY_MS = 86400000;
  var threshold = now - DAY_MS;
  var count = 0;
  
  try {
    // 1. active 리스트 스캔
    var rawActive = await env.ALERT_KV.get(TRACKING_KEYS.active);
    var activeList = rawActive ? JSON.parse(rawActive) : [];
    if (!Array.isArray(activeList)) activeList = [];
    
    for (var i = 0; i < activeList.length; i++) {
      var it = activeList[i];
      if (it.base !== base) continue;
      if (it.exchange !== exchange) continue;
      var grade = (it.gradeCode || '').toUpperCase();
      if (grade !== 'S' && grade !== 'SPLUS') continue;
      var startedAt = it.startedAt || it.tierAssignedAt || 0;
      if (startedAt < threshold) continue;
      count++;
    }
    
    // 2. completed 리스트 스캔 (TTL 30일, 24h 안의 항목만 카운트)
    try {
      var rawCompleted = await env.ALERT_KV.get('tracking_completed_index');
      var completedList = rawCompleted ? JSON.parse(rawCompleted) : [];
      if (!Array.isArray(completedList)) completedList = [];
      
      for (var j = 0; j < completedList.length; j++) {
        var ic = completedList[j];
        if (ic.base !== base) continue;
        if (ic.exchange !== exchange) continue;
        var gradeC = (ic.gradeCode || '').toUpperCase();
        if (gradeC !== 'S' && gradeC !== 'SPLUS') continue;
        var startedAtC = ic.startedAt || ic.tierAssignedAt || 0;
        if (startedAtC < threshold) continue;
        count++;
      }
    } catch(eC) {}
  } catch(e) {
    return 0;
  }
  
  return count;
}

// [Phase 4.7 공사 4] aCount24 — A 등급 알람 카운트 (base+거래소 별, 24h)
// 자동 정밀 조건 ③: A 등급 5회 이상 → 정밀 추적 (Tier A)
// sCount24 와 동일 패턴, A 등급만 카운트
async function v47_computeACount24(env, base, exchange, now) {
  if (!base || !exchange) return 0;
  var DAY_MS = 86400000;
  var threshold = now - DAY_MS;
  var count = 0;
  
  try {
    var rawActive = await env.ALERT_KV.get(TRACKING_KEYS.active);
    var activeList = rawActive ? JSON.parse(rawActive) : [];
    if (!Array.isArray(activeList)) activeList = [];
    
    for (var i = 0; i < activeList.length; i++) {
      var it = activeList[i];
      if (it.base !== base) continue;
      if (it.exchange !== exchange) continue;
      var grade = (it.gradeCode || '').toUpperCase();
      if (grade !== 'A' && grade !== 'S' && grade !== 'SPLUS') continue;  // A 이상
      var startedAt = it.startedAt || it.tierAssignedAt || 0;
      if (startedAt < threshold) continue;
      count++;
    }
    
    try {
      var rawCompleted = await env.ALERT_KV.get('tracking_completed_index');
      var completedList = rawCompleted ? JSON.parse(rawCompleted) : [];
      if (!Array.isArray(completedList)) completedList = [];
      
      for (var j = 0; j < completedList.length; j++) {
        var ic = completedList[j];
        if (ic.base !== base) continue;
        if (ic.exchange !== exchange) continue;
        var gradeC = (ic.gradeCode || '').toUpperCase();
        if (gradeC !== 'A' && gradeC !== 'S' && gradeC !== 'SPLUS') continue;
        var startedAtC = ic.startedAt || ic.tierAssignedAt || 0;
        if (startedAtC < threshold) continue;
        count++;
      }
    } catch(eC) {}
  } catch(e) {
    return 0;
  }
  
  return count;
}

// [Phase 4.7 공사 4] Tier A 한도 도달 시 거부 처리
// 사용자 결정 (D3): 한도 50 정확히 유지 (재체크 + 거부)
// 자동 정밀 (S 3회 / A 5회) → 한도 도달 시 표준 추적
// 관심 ⭐ → 한도 도달 시 모달 (취소/확인) — HTML 측 처리
async function v47_checkTierALimit(env, isWatchlist) {
  try {
    var rawActive = await env.ALERT_KV.get(TRACKING_KEYS.active);
    var activeList = rawActive ? JSON.parse(rawActive) : [];
    if (!Array.isArray(activeList)) activeList = [];
    
    // [Phase 4.7.9 R8-4] 자동/관심 분리 검증
    // 사용자 결정: 자동 정밀 40 + 관심 10 분리 한도
    var v479_autoCount = 0;
    var v479_watchCount = 0;
    for (var i = 0; i < activeList.length; i++) {
      if (activeList[i].tier !== 'A') continue;
      if (activeList[i].isWatchlist) v479_watchCount++;
      else v479_autoCount++;
    }
    
    // 호출 측에서 isWatchlist 알려주면 해당 한도만 검증
    // v4.7.15: 정밀은 관심/자동 합산 최대 30개로 통일
    return (v479_autoCount + v479_watchCount) < TRACKING_LIMITS.TIER_A_MAX;
  } catch(e) {
    return true;  // 에러 시 안전 측 = 허용 (race condition 무시)
  }
}


// [v4.7.15] duplicate 이벤트 누적 + 자동 정밀 승격
// 같은 base+exchange 재알람은 새 active 카드를 만들지 않고 기존 active/meta에 이벤트만 누적한다.
async function v4715_accumulateDuplicateAlert(env, activeList, dup, snapshot, now) {
  if (!dup || !dup.id) return { ok:false, error:'no duplicate target' };
  if (!Array.isArray(activeList)) activeList = [];

  var DAY_MS = 24 * 60 * 60 * 1000;
  var gradeCode = String(snapshot.gradeCode || (snapshot.scanner && snapshot.scanner.gradeCode) || '').toUpperCase();
  var base = snapshot.base || (snapshot.scanner && snapshot.scanner.base) || dup.base || '';
  var exchange = snapshot.exchange || (snapshot.scanner && snapshot.scanner.exchange) || dup.exchange || '';

  var meta = null;
  try {
    var metaRaw = await env.ALERT_KV.get(TRACKING_KEYS.meta(dup.id));
    meta = metaRaw ? JSON.parse(metaRaw) : {};
  } catch(e) { meta = {}; }
  if (!meta || typeof meta !== 'object') meta = {};

  var history = Array.isArray(meta.gradeHistory) ? meta.gradeHistory : [];
  history.push({
    gradeCode: gradeCode,
    time: now,
    snapshotId: snapshot.snapshotId || null,
    base: base,
    exchange: exchange,
  });
  history = history.filter(function(ev){ return ev && Number(ev.time || 0) >= now - DAY_MS; });

  var sCount24 = 0;
  var aCount24 = 0;
  for (var i = 0; i < history.length; i++) {
    var g = String(history[i].gradeCode || '').toUpperCase();
    if (g === 'S' || g === 'SPLUS') sCount24++;
    if (g === 'A' || g === 'S' || g === 'SPLUS') aCount24++;
  }

  var alertCount = Number(meta.alertCount || dup.alertCount || 0) + 1;
  var isWatchlist = !!(meta.isWatchlistAtAlarm || meta.isWatchlist || dup.isWatchlist);
  var shouldPromote = isWatchlist || sCount24 >= 3 || aCount24 >= 5;
  var promoted = false;
  var windowEnd = meta.windowEnd || dup.windowEnd || 0;
  var windowStart = meta.windowStart || dup.startedAt || dup.tierAssignedAt || now;

  if (shouldPromote) {
    var alreadyDeep = (dup.trackingMode === 'deep' || meta.trackingMode === 'deep');
    if (!alreadyDeep) {
      var limitOk = await v47_checkTierALimit(env);
      if (limitOk) {
        dup.tier = 'A';
        dup.trackingMode = 'deep';
        dup.windowDays = 7;
        windowEnd = now + 7 * DAY_MS;
        promoted = true;
      }
    } else {
      dup.trackingMode = 'deep';
      dup.windowDays = 7;
      if (!windowEnd || windowEnd < now + DAY_MS) windowEnd = now + 7 * DAY_MS;
    }
  }

  dup.alertCount = alertCount;
  dup.gradeHistory = history;
  dup.sCount24 = sCount24;
  dup.aCount24 = aCount24;
  dup.isAutoPrecise = !!(!isWatchlist && (sCount24 >= 3 || aCount24 >= 5));
  dup.isWatchlist = isWatchlist;
  dup.lastDuplicateAlertAt = now;
  dup.lastGradeCode = gradeCode;
  if (windowEnd) dup.windowEnd = windowEnd;

  meta.status = meta.status || 'active';
  meta.alertCount = alertCount;
  meta.gradeHistory = history;
  meta.sCount24AtAlarm = sCount24;
  meta.aCount24AtAlarm = aCount24;
  meta.isWatchlistAtAlarm = isWatchlist;
  meta.isAutoPreciseAtAlarm = dup.isAutoPrecise;
  meta.lastDuplicateAlertAt = now;
  meta.lastGradeCode = gradeCode;
  meta.base = meta.base || base;
  meta.exchange = meta.exchange || exchange;
  if (shouldPromote && dup.trackingMode === 'deep') {
    meta.tier = 'A';
    meta.trackingMode = 'deep';
    meta.trackingModeReason = isWatchlist ? 'duplicate-watchlist' : ('duplicate-auto-sCount' + sCount24 + '-aCount' + aCount24);
    meta.windowDays = 7;
    meta.windowEnd = windowEnd;
  }

  for (var j = 0; j < activeList.length; j++) {
    if (activeList[j] && activeList[j].id === dup.id) {
      activeList[j] = Object.assign(activeList[j], dup);
      break;
    }
  }

  await env.ALERT_KV.put(TRACKING_KEYS.meta(dup.id), JSON.stringify(meta), { expirationTtl: 86400 * 30 });
  await env.ALERT_KV.put(TRACKING_KEYS.active, JSON.stringify(activeList), { expirationTtl: 86400 * 30 });

  return { ok:true, linkedActiveId: dup.id, alertCount: alertCount, sCount24: sCount24, aCount24: aCount24, promoted: promoted, isAutoPrecise: dup.isAutoPrecise };
}

// [STEP A v2.0 Section 2.1 — startTracking]
// saveSnapshotKV 직후 호출 → Tier 분류 → 한도 검사 → meta 저장 → active 등록
async function startTracking(env, snapshot) {
  try {
    var snapshotId = snapshot.snapshotId;
    if (!snapshotId) return { ok: false, error: 'no snapshotId' };
    
    // 1. Tier 분류
    var tierResult = assignTier(snapshot);
    var tier = tierResult.tier;
    var now = Date.now();
    
    // [Phase 3.13] 중복 등록 체크 (D-120 정책)
    // 동일 base + exchange 의 active 추적이 120분 이내 등록되었으면 SKIP
    // 텔레그램 알림은 startTracking 결과와 무관하게 발송됨 (호출부에서 별도 처리)
    // SKIP 시에도 meta 는 'duplicate_skipped' status 로 저장하여 디버그 추적 가능
    var newBase = snapshot.base || (snapshot.scanner && snapshot.scanner.base) || '';
    var newExchange = snapshot.exchange || (snapshot.scanner && snapshot.scanner.exchange) || '';
    
    if (newBase && newExchange) {
      try {
        var rawActiveCheck = await env.ALERT_KV.get(TRACKING_KEYS.active);
        var activeCheck = rawActiveCheck ? JSON.parse(rawActiveCheck) : [];
        if (!Array.isArray(activeCheck)) activeCheck = [];
        
        var dup = findActiveDuplicate(activeCheck, newBase, newExchange);
        if (dup && dup.id) {
          // v4.7.15: 중복 카드는 만들지 않되 알람 이벤트는 반드시 기존 active/meta에 누적한다.
          var elapsedMs = now - (dup.tierAssignedAt || dup.startedAt || now);
          var acc = await v4715_accumulateDuplicateAlert(env, activeCheck, dup, snapshot, now);
          var skipMeta = {
            version: 'v1',
            snapshotId: snapshotId,
            tier: tier,
            tierAssignedAt: now,
            tierReason: tierResult.reason,
            status: 'duplicate_skipped',
            duplicateSkipped: true,
            duplicateAccumulated: true,
            linkedActiveId: dup.id,
            dedupeWindowMs: DUPLICATE_DEDUPE_WINDOW_MS,
            elapsedSinceLinked: elapsedMs,
            base: newBase,
            exchange: newExchange,
            gradeCode: snapshot.gradeCode || (snapshot.scanner && snapshot.scanner.gradeCode) || '',
            alertCount: acc.alertCount || 0,
            sCount24: acc.sCount24 || 0,
            aCount24: acc.aCount24 || 0,
            isAutoPrecise: acc.isAutoPrecise === true,
            promoted: acc.promoted === true,
          };
          await env.ALERT_KV.put(TRACKING_KEYS.meta(snapshotId), JSON.stringify(skipMeta),
            { expirationTtl: 86400 * 30 });
          
          return {
            ok: true,
            skipped: true,
            accumulated: true,
            reason: 'duplicate_event_accumulated',
            snapshotId: snapshotId,
            tier: tier,
            linkedActiveId: dup.id,
            elapsedSinceLinked: elapsedMs,
            alertCount: acc.alertCount || 0,
            sCount24: acc.sCount24 || 0,
            aCount24: acc.aCount24 || 0,
            promoted: acc.promoted === true,
          };
        }
      } catch(dedupeErr) {
        // 중복 체크 실패는 정상 등록 방해 X (안전 fallback)
      }
    }
    
    // 2. snapshot.timestamp 기준 윈도우 결정 (R8: 시간 anchoring 기준점)
    // [핫픽스] timestamp 가 ISO 8601 string 일 수 있음 → 정규화 필수
    var windowStart = normalizeTimeMs(snapshot.timestamp) || now;
    
    // [Phase 4.6.1] trackingMode 결정 + 7일 추적 자동 조건
    // deep 자동 조건: entryReady / S/S+ 등급 / sCount24 ≥ 3 / watchlist
    // 7일 자동 조건: watchlist OR sCount24 ≥ 3
    var trackingMode = 'light';
    var trackingModeReason = 'default';
    var windowDays = 1;
    
    try {
      var v461_base = snapshot.base || (snapshot.scanner && snapshot.scanner.base) || '';
      var v461_exchange = snapshot.exchange || (snapshot.scanner && snapshot.scanner.exchange) || '';
      var v461_grade = snapshot.gradeCode || (snapshot.scanner && snapshot.scanner.gradeCode) || '';
      var v461_entryReady = snapshot.entryReady === true ||
                            (snapshot.scanner && snapshot.scanner.entryReady === true);
      
      // sCount24 계산 (active + completed 통합)
      var v461_sCount24 = 0;
      if (v461_base && v461_exchange) {
        try {
          v461_sCount24 = await v461_computeSCount24(env, v461_base, v461_exchange, now);
        } catch(e) { v461_sCount24 = 0; }
      }
      if (String(v461_grade || '').toUpperCase() === 'S' || String(v461_grade || '').toUpperCase() === 'SPLUS') {
        v461_sCount24 += 1;  // 현재 알람 포함
      }
      
      // watchlist 조회
      var v461_isWatchlist = false;
      if (v461_base) {
        try {
          var rawWl = await env.ALERT_KV.get('watchlist_global');
          if (rawWl) {
            var wlObj = JSON.parse(rawWl);
            var wlList = (wlObj && Array.isArray(wlObj.bases)) ? wlObj.bases : [];
            v461_isWatchlist = wlList.indexOf(String(v461_base).toUpperCase()) >= 0;
          }
        } catch(e) {}
      }
      
      // [Phase 4.7 공사 1 — Q4-2] 자동 관심 등록 (24h 안 동일 base 5회+)
      // 사용자 의도: 같은 코인 알람 5번 이상 → 자동 관심 (등급 무관)
      // 이미 watchlist 가 아니지만 alarmCount24 >= 5 면 자동 등록 + 7일 리셋
      var v47_alarmCount24 = 0;
      try {
        // 같은 base 의 24h 안 알람 카운트 — sCount24 와 비슷하지만 등급 무관
        // 임시 카운트: 같은 base 의 active 추적 + 최근 24h cooldown 기록
        var v47_24hCutoff = now - 24 * 3600 * 1000;
        var v47_rawAct = await env.ALERT_KV.get(TRACKING_KEYS.active);
        var v47_act = v47_rawAct ? JSON.parse(v47_rawAct) : [];
        if (Array.isArray(v47_act)) {
          v47_alarmCount24 = v47_act.filter(function(a){
            return a.base === v461_base && (a.startedAt || a.tierAssignedAt || 0) >= v47_24hCutoff;
          }).length;
        }
        if (v47_alarmCount24 + 1 >= 5 && !v461_isWatchlist) {  // +1 = 현재 알람 포함
          // 자동 관심 등록
          var v47_curRaw = await env.ALERT_KV.get('watchlist_global');
          var v47_curObj = v47_curRaw ? JSON.parse(v47_curRaw) : { bases: [], pinnedAt: {} };
          if (!Array.isArray(v47_curObj.bases)) v47_curObj.bases = [];
          if (!v47_curObj.pinnedAt) v47_curObj.pinnedAt = {};
          var v47_baseUC = String(v461_base).toUpperCase();
          if (v47_curObj.bases.indexOf(v47_baseUC) < 0) {
            v47_curObj.bases.push(v47_baseUC);
          }
          v47_curObj.pinnedAt[v47_baseUC] = now;  // 7일 카운트 리셋
          v47_curObj.autoAddedAt = v47_curObj.autoAddedAt || {};
          v47_curObj.autoAddedAt[v47_baseUC] = now;  // 자동 등록 마킹
          await env.ALERT_KV.put('watchlist_global', JSON.stringify(v47_curObj));
          v461_isWatchlist = true;  // 즉시 반영
        }
      } catch(autoErr) {
        // 자동 등록 실패해도 추적은 계속
      }
      
      // [Phase 4.7 공사 4] aCount24 계산 (자동 정밀 조건 ③)
      var v47_aCount24 = 0;
      if (v461_base && v461_exchange) {
        try {
          v47_aCount24 = await v47_computeACount24(env, v461_base, v461_exchange, now);
        } catch(e) { v47_aCount24 = 0; }
      }
      if (String(v461_grade || '').toUpperCase() === 'A' || String(v461_grade || '').toUpperCase() === 'S' || String(v461_grade || '').toUpperCase() === 'SPLUS') {
        v47_aCount24 += 1;  // 현재 알람 포함
      }
      
      // [Phase 4.7 공사 4] 정밀 추적 정의 — OR 조건
      // 사용자 결정: 정밀 = 다음 중 하나
      //   ① 관심 코인 (⭐)
      //   ② 24h 안 S 등급 3회 이상 (base+거래소 별)
      //   ③ 24h 안 A 등급 5회 이상 (base+거래소 별)
      // 자동 정밀 (조건 ②③) ≠ 관심 (자동 ⭐ 표시 X)
      var v47_isAutoPrecise = (v461_sCount24 >= 3) || (v47_aCount24 >= 5);
      var v47_isPrecise = v461_isWatchlist || v47_isAutoPrecise;
      
      // [Phase 4.7 공사 4 — D3] Tier A 한도 50 정확히 유지 (재체크 + 거부)
      // 자동 정밀 → 한도 도달 시 표준으로 강등 (조용히)
      // 관심 ⭐ → 한도 도달 시 표준 + UI 모달 (HTML 측 처리)
      if (v47_isPrecise) {
        var v47_tierAvailable = await v47_checkTierALimit(env);
        if (!v47_tierAvailable) {
          // 한도 도달 — 정밀 거부
          v47_isPrecise = false;
          trackingMode = 'standard';
          trackingModeReason = 'tier-a-limit-reached';
          // 관심 코인이면 메타에 마킹 (HTML 측 모달 표시용)
          if (v461_isWatchlist) {
            // meta 에 limitRejected 플래그 저장 (나중에 메타 저장 시 통합)
            // → meta 객체 생성 시 자동 정밀 조건 충족했지만 한도 거부 표시
          }
        }
      }
      
      // 자동 정밀 라벨 — 분석 완료 / 활성 카드 / 텔레 메시지에 표시 (메타 저장)
      var v47_isAutoPreciseFlag = v47_isAutoPrecise && !v461_isWatchlist;
      
      if (v47_isPrecise) {
        trackingMode = 'deep';
        trackingModeReason = v461_isWatchlist 
          ? 'precise-watchlist' 
          : ('precise-auto-sCount' + v461_sCount24 + '-aCount' + v47_aCount24);
      } else if (v461_entryReady) {
        trackingMode = 'deep';
        trackingModeReason = 'entryReady';
      } else if (v461_grade === 'SPLUS' || v461_grade === 'S') {
        trackingMode = 'deep';
        trackingModeReason = 'grade-' + v461_grade;
      } else if (v461_isWatchlist) {
        trackingMode = 'deep';
        trackingModeReason = 'watchlist';
      }
      
      // [Phase 4.7.7 작업 2 — trackingMode ↔ windowDays 강제 일치]
      // trackingMode 결정 완료 직후 강제 (덮어쓰기 방지)
      // deep = 7일 / 나머지(light) = 1일
      // 기존 isWatchlist 단독 조건 → trackingMode 기준으로 통일
      // 사례 해결:
      //   - S+ 등급 알람 (관심 X) → deep + 7일 (이전: deep + 1일 모순)
      //   - 자동 정밀 (S 3회) → deep + 7일 (이전: deep + 1일 모순)
      //   - entryReady → deep + 7일 (이전: deep + 1일 모순)
      if (trackingMode === 'deep') {
        windowDays = 7;
      } else {
        windowDays = 1;
      }
    } catch(modeErr) {
      // 결정 실패 시 light + 24h fallback (안전)
      trackingMode = 'light';
      trackingModeReason = 'default-error';
      windowDays = 1;
    }
    
    var windowEnd = windowStart + windowDays * 24 * 3600 * 1000;
    
    // 3. tracking meta 객체 생성 (R6: 필수 메타 모두 포함)
    // [Phase 4.0] structure / ATR 박제 (4단계 fallback)
    // 1. snapshot 직접 박제값 우선
    // 2. snapshot.scanner 의 박제값
    // 3. snapshot.candles 가 있으면 동결 함수(calcATR, calcBoxRange) 호출
    // 4. 모두 실패 → null fallback (그래프에서 ATR 가이드 미표시)
    var atr_v40 = (snapshot.atr != null ? snapshot.atr : null) ||
                  (snapshot.scanner && snapshot.scanner.atr != null ? snapshot.scanner.atr : null) ||
                  null;
    var boxLow_v40 = (snapshot.box && snapshot.box.low != null ? snapshot.box.low : null) ||
                    (snapshot.scanner && snapshot.scanner.box && snapshot.scanner.box.low != null ? snapshot.scanner.box.low : null) ||
                    null;
    var boxHigh_v40 = (snapshot.box && snapshot.box.high != null ? snapshot.box.high : null) ||
                     (snapshot.scanner && snapshot.scanner.box && snapshot.scanner.box.high != null ? snapshot.scanner.box.high : null) ||
                     null;
    var tp2_v40 = (snapshot.distributionTargets && snapshot.distributionTargets.tp2 != null ? snapshot.distributionTargets.tp2 : null) ||
                 (snapshot.scanner && snapshot.scanner.distributionTargets && snapshot.scanner.distributionTargets.tp2 != null ? snapshot.scanner.distributionTargets.tp2 : null) ||
                 null;
    var gradeLabel_v40 = snapshot.gradeLabel || (snapshot.scanner && snapshot.scanner.gradeLabel) || null;
    
    // candles 가 snapshot 에 있으면 동결 함수 호출로 fallback 시도 (호출만, 함수 자체 수정 X)
    var candles_v40 = snapshot.candles || (snapshot.scanner && snapshot.scanner.candles) || null;
    if (atr_v40 == null && Array.isArray(candles_v40) && candles_v40.length >= 14) {
      try { atr_v40 = calcATR(candles_v40, 14); } catch(e) { atr_v40 = null; }
    }
    if ((boxLow_v40 == null || boxHigh_v40 == null) && Array.isArray(candles_v40) && candles_v40.length > 0) {
      try {
        var box_v40 = calcBoxRange(candles_v40);
        if (box_v40) {
          if (boxLow_v40 == null) boxLow_v40 = box_v40.low != null ? box_v40.low : null;
          if (boxHigh_v40 == null) boxHigh_v40 = box_v40.high != null ? box_v40.high : null;
        }
      } catch(e) { /* null fallback */ }
    }
    
    var meta = {
      version: 'v1',                              // 원칙 7: 확장성
      snapshotId: snapshotId,
      tier: tier,
      tierAssignedAt: now,
      tierReason: tierResult.reason,
      status: 'active',                           // active | measurement_done | completed | expired_partial | terminated
      windowStart: windowStart,                   // R8: 시간 anchoring 기준점
      windowEnd: windowEnd,
      // [Phase 4.6.1] 분석 모드 + 7일 추적 박제
      trackingMode: trackingMode,                 // 'light' | 'deep'
      trackingModeReason: trackingModeReason,
      windowDays: windowDays,                     // 1 (24h) | 7 (7일)
      sCount24AtAlarm: (typeof v461_sCount24 !== 'undefined' ? v461_sCount24 : 0),
      isWatchlistAtAlarm: (typeof v461_isWatchlist !== 'undefined' ? v461_isWatchlist : false),
      // [Phase 4.7 공사 4] 자동 정밀 박제 (분석 완료 카드 + 활성 카드 + 텔레 메시지에 라벨 표시)
      aCount24AtAlarm: (typeof v47_aCount24 !== 'undefined' ? v47_aCount24 : 0),
      isAutoPreciseAtAlarm: (typeof v47_isAutoPreciseFlag !== 'undefined' ? v47_isAutoPreciseFlag : false),
      // 한도 거부 플래그 (관심 ⭐ 인데 한도로 표준 등록된 경우 — HTML 측 모달 표시용)
      tierARejected: (typeof v461_isWatchlist !== 'undefined' && v461_isWatchlist && trackingMode !== 'deep'),
      // 시작 시점에 박제 (스캐너 정보 일부 — 분석기는 자기 데이터 안 만듦)
      base: snapshot.base || (snapshot.scanner && snapshot.scanner.base) || '',
      exchange: snapshot.exchange || (snapshot.scanner && snapshot.scanner.exchange) || '',
      gradeCode: snapshot.gradeCode || (snapshot.scanner && snapshot.scanner.gradeCode) || '',
      gradeLabel: gradeLabel_v40,                 // [Phase 4.0] UI 표시용 라벨
      // [Phase 3.2-C] 분석기에서 사용할 박제 정보 (스캐너 데이터 X 변형)
      openPrice: snapshot.price || (snapshot.scanner && snapshot.scanner.price) || null,
      tp1Price: (snapshot.distributionTargets && snapshot.distributionTargets.tp1)
              || (snapshot.scanner && snapshot.scanner.distributionTargets && snapshot.scanner.distributionTargets.tp1)
              || null,
      // [Phase 4.0] 그래프 가이드 / 전략 보조 데이터 (없으면 null fallback, 그래프에서 미표시)
      tp2Price: tp2_v40,
      boxLow: boxLow_v40,
      boxHigh: boxHigh_v40,
      atr: atr_v40,
      atrPeriod: atr_v40 != null ? 14 : null,
      atrTf: atr_v40 != null ? '1h' : null,
      // [Phase 4.1] alertSnapshot 박제 (A2: snapshot.* 우선 → snapshot.scanner.* fallback)
      // 스캐너가 코인을 뽑은 시점의 근거 정보. 24h 동안 절대 변경 X (R5 박제 정신).
      // 스캐너가 해당 정보를 안 보내면 null fallback (분석기 측에서 안전 처리).
      // [Phase 4.6.5] CRITICAL FIX — snapshot 실제 구조 기반 박제
      // 기존: snapshot.price, snapshot.volume.ratio 등 잘못된 경로 → 모두 null
      // 수정: snapshot.total, snapshot.scoreSummary 등 buildSnapshotData() 실제 반환 구조
      alertSnapshot: (function(){
        function pickPath(o, p) {
          if (o == null) return null;
          var cur = o; var keys = p.split('.');
          for (var i = 0; i < keys.length; i++) {
            if (cur == null || typeof cur !== 'object') return null;
            cur = cur[keys[i]];
          }
          return (cur === undefined) ? null : cur;
        }
        function pickBoth(short, longp) {
          var v = pickPath(snapshot, short);
          if (v !== null && v !== undefined) return v;
          return pickPath(snapshot, longp);
        }
        return {
          // [Phase 4.6.5 CRITICAL] snapshot 실제 구조 (buildSnapshotData 반환) 박제
          total: snapshot.total != null ? snapshot.total : null,
          score: snapshot.total != null ? snapshot.total : null,  // alias
          gradeCode: snapshot.gradeCode || null,
          scoreSummary: snapshot.scoreSummary || null,
          analysis: snapshot.analysis || null,                  // strengths / weaknesses / conclusion
          actionDesc: snapshot.actionDesc || null,
          distributionTargets: snapshot.distributionTargets || null,  // target1 / target2 / target3
          accumulationCost: snapshot.accumulationCost || null,
          currentPhase: snapshot.currentPhase || null,
          riskDetails: snapshot.riskDetails || null,
          strategyA: snapshot.strategyA || null,
          strategyB: snapshot.strategyB || null,
          stopLoss: snapshot.stopLoss != null ? snapshot.stopLoss : null,
          fakePump: snapshot.fakePump === true,
          lateEntry: snapshot.lateEntry === true,
          entryReady: snapshot.entryReady === true ||
                      (snapshot.scanner && snapshot.scanner.entryReady === true) || false,
          priceGap: snapshot.priceGap || null,
          gapStatus: snapshot.gapStatus || '',
          
          // [Phase 4.1] 기존 골격 필드 (호환성 유지 — fallback 으로 picker 그대로)
          price: pickBoth('price', 'scanner.price'),
          volume: {
            ratio: pickBoth('volume.ratio', 'scanner.volume.ratio'),
            acceleration: pickBoth('volume.acceleration', 'scanner.volume.acceleration'),
            quoteVolume: pickBoth('volume.quoteVolume', 'scanner.volume.quoteVolume'),
          },
          momentum: {
            change15m: pickBoth('momentum.change15m', 'scanner.momentum.change15m'),
            change1h: pickBoth('momentum.change1h', 'scanner.momentum.change1h'),
            change4h: pickBoth('momentum.change4h', 'scanner.momentum.change4h'),
          },
          indicators: {
            rsi: pickBoth('indicators.rsi', 'scanner.indicators.rsi'),
            obvTrend: pickBoth('indicators.obvTrend', 'scanner.indicators.obvTrend'),
            macdState: pickBoth('indicators.macdState', 'scanner.indicators.macdState'),
          },
          structure: {
            type: pickBoth('structure.type', 'scanner.structure.type'),
            position: pickBoth('structure.position', 'scanner.structure.position'),
            breakoutState: pickBoth('structure.breakoutState', 'scanner.structure.breakoutState'),
          },
          reason: pickBoth('reason', 'scanner.reason') || [],
        };
      })(),
    };
    
    // 4. meta KV 저장
    await env.ALERT_KV.put(TRACKING_KEYS.meta(snapshotId), JSON.stringify(meta),
      { expirationTtl: 86400 * 30 });
    
    // 5. active 리스트에 등록
    var rawActive = await env.ALERT_KV.get(TRACKING_KEYS.active);
    var active = rawActive ? JSON.parse(rawActive) : [];
    if (!Array.isArray(active)) active = [];
    
    // 중복 제거 (같은 ID 가 있으면 먼저 제거)
    active = active.filter(function(x){ return x.id !== snapshotId; });
    
    active.push({
      id: snapshotId,
      tier: tier,
      tierAssignedAt: now,
      windowEnd: windowEnd,
      base: meta.base,         // [Phase 3.13] 중복 체크 효율화 (KV meta 조회 없이 active 만으로 가능)
      exchange: meta.exchange, // [Phase 3.13]
      // [Phase 4.0] 그룹 카드 UI 효율화 (meta 추가 조회 최소화)
      gradeCode: meta.gradeCode || null,
      gradeLabel: meta.gradeLabel || meta.gradeCode || null,
      startedAt: windowStart,  // = meta.windowStart, 추적 시작 시각
      // [Phase 4.6.1] 분석기 카드 분리 효율 (light/deep 즉시 판별)
      trackingMode: trackingMode,
      windowDays: windowDays,
      // [Phase 4.7 공사 4] 자동 정밀 / 관심 / 한도 거부 박제 (HTML 직접 표시)
      isWatchlist: meta.isWatchlistAtAlarm || false,
      isAutoPrecise: meta.isAutoPreciseAtAlarm || false,
      tierARejected: meta.tierARejected || false,
      sCount24: meta.sCount24AtAlarm || 0,
      aCount24: meta.aCount24AtAlarm || 0,
    });
    
    // active 리스트 저장 (TTL 30일)
    await env.ALERT_KV.put(TRACKING_KEYS.active, JSON.stringify(active),
      { expirationTtl: 86400 * 30 });
    
    // 6. 한도 강제 (Tier A 30 / Tier B 50)
    // [핵심] startTracking 시점에 한도 강제 → Cron 진입 전 active 리스트가 항상 한도 내
    var enforceResult = await enforceTrackingLimits(env);
    
    return {
      ok: true,
      snapshotId: snapshotId,
      tier: tier,
      tierReason: tierResult.reason,
      windowStart: windowStart,
      windowEnd: windowEnd,
      enforce: enforceResult,
    };
  } catch(e) {
    return { ok: false, error: String(e) };
  }
}

// ══════════════════════════════════════════════════════════════════
// Phase 3.2-A 끝 — 분석기 핵심 모듈 (Tier + startTracking + 한도 + usable)
// 다음 Phase 3.2-B: Cron 추적 엔진 (Tier A/B sample + Tier C anchored fetch)
// 다음 Phase 3.2-C: Threshold + TP1 + Pattern 분류 + dataQuality 계산
// ══════════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════════
// Phase 3.2-B — Cron 추적 엔진
// 기반: STEP A v2.0 Section 7.6 (복원력) + R8 (시간 anchored fetch)
//      v1.3 원칙 1 (사후 기록), 5 (추적 빈도 차등)
// ══════════════════════════════════════════════════════════════════

// TrackingMode 별 sample 간격 (분)
// [v4.7.16] 사용자 결정 — 저장 주기 기준을 Tier A/B 에서 deep/standard 로 단일화
// 정밀/deep/관심/자동정밀/windowDays>=7: 5분
// 표준/standard: 15분
// 기존 track_t1/track_t2 키 체계는 유지하되, 실제 write 주기만 모드 기준으로 제한한다.
var TRACKING_SAMPLE_INTERVALS = {
  deep: 5,
  standard: 15,
};

function getTrackingMode(item, meta) {
  try {
    var x = item || {};
    var m = meta || {};
    if (x.isWatchlist || m.isWatchlist) return 'deep';
    if (x.isAutoPrecise || m.isAutoPrecise) return 'deep';
    if (x.trackingMode === 'deep' || m.trackingMode === 'deep') return 'deep';
    if (Number(x.windowDays || m.windowDays || 0) >= 7) return 'deep';
    return 'standard';
  } catch(e) {
    return 'standard';
  }
}

function shouldWriteSample(item, now, meta) {
  var mode = getTrackingMode(item, meta);
  var intervalMin = TRACKING_SAMPLE_INTERVALS[mode] || TRACKING_SAMPLE_INTERVALS.standard;
  var intervalMs = intervalMin * 60 * 1000;
  var last = Number((item && item.lastSampleWriteAt) || (meta && meta.lastSampleWriteAt) || 0);
  if (!last || !isFinite(last)) return true;
  return (now - last) >= intervalMs;
}

function getSampleIntervalMin(item, meta) {
  var mode = getTrackingMode(item, meta);
  return TRACKING_SAMPLE_INTERVALS[mode] || TRACKING_SAMPLE_INTERVALS.standard;
}

// Cron 1회당 Subrequests 한도 보호 (50 - BTC 메타용 1 - 안전 여유 2)
var CRON_FETCH_BUDGET = 47;

// Subrequests 안전 여유 — budget 이 이 값 이하로 떨어지면 즉시 break
// 운영 변동 (Cron 지연, retry, BTC fetch 추가) 대비 폭탄 방어
var CRON_SAFE_MARGIN = 3;

// 24h fetch 재시도 정책 (원칙 4-A: 복원력)
var TIER_C_RETRY_MAX = 3;
var TIER_C_RETRY_GRACE_MIN = 30;  // windowEnd 후 30분 grace (3회 × 10분 = 30분)

// [원칙 5: Tier C 시간 anchored fetch] [R8]
// 1시간봉 캔들 24개를 snapshot+24h 기준 windowEnd 시점에 anchored 로 fetch
// Bithumb: count=24&to=<endTimeMs>
// Upbit:   count=24&to=<ISO8601(endTime)>
async function fetchTierC_Candles(env, exchange, base, windowStart, windowEnd) {
  try {
    var proxy = (env.PROXY_URL || '').replace(/\/$/, '');
    if (!proxy) return { ok: false, error: 'PROXY_URL not set' };
    
    var market = '';
    var url = '';
    
    if (exchange === 'BITHUMB') {
      market = base + '_KRW';
      // 프록시 경로: /bithumb/candles?market=XXX_KRW&count=24&to=<endTimeMs>
      url = proxy + '/bithumb/candles?market=' + encodeURIComponent(market)
          + '&count=24&interval=1h&to=' + windowEnd;
    } else if (exchange === 'UPBIT') {
      market = 'KRW-' + base;
      // Upbit 는 ISO8601 (UTC) 형식 to= 사용
      var isoEnd = new Date(windowEnd).toISOString().replace(/\.\d{3}Z$/, 'Z');
      url = proxy + '/upbit/candles?market=' + encodeURIComponent(market)
          + '&count=24&unit=60&to=' + encodeURIComponent(isoEnd);
    } else if (exchange === 'BINANCE') {
      market = base + 'USDT';
      // Binance: endTime 파라미터 (ms)
      url = proxy + '/api/v3/klines?symbol=' + encodeURIComponent(market)
          + '&interval=1h&limit=24&endTime=' + windowEnd;
    } else {
      return { ok: false, error: 'unknown exchange: ' + exchange };
    }
    
    var raw = await fetchJson(url, 10000);
    if (!raw) return { ok: false, error: 'no data' };
    
    // Fallback slice: 받은 캔들의 timestamp 가 [windowStart, windowEnd] 범위인지 검증
    var candles = [];
    if (Array.isArray(raw)) {
      candles = raw.map(function(c){
        // 거래소별 timestamp 필드 통일
        var t, h, l, o, cl;
        if (exchange === 'BINANCE') {
          // Binance klines: [openTime, open, high, low, close, ...]
          t = c[0]; o = parseFloat(c[1]); h = parseFloat(c[2]); l = parseFloat(c[3]); cl = parseFloat(c[4]);
        } else if (exchange === 'UPBIT') {
          // Upbit: { candle_date_time_utc, opening_price, high_price, low_price, trade_price, ... }
          t = new Date(c.candle_date_time_utc + 'Z').getTime();
          o = parseFloat(c.opening_price); h = parseFloat(c.high_price);
          l = parseFloat(c.low_price); cl = parseFloat(c.trade_price);
        } else if (exchange === 'BITHUMB') {
          // Bithumb: 형식 다양 — array [t,o,c,h,l,v] 또는 object
          if (Array.isArray(c)) {
            t = c[0]; o = parseFloat(c[1]); cl = parseFloat(c[2]);
            h = parseFloat(c[3]); l = parseFloat(c[4]);
          } else {
            t = c.t || c.timestamp || c.time;
            o = parseFloat(c.opening_price || c.open || c.o);
            h = parseFloat(c.high_price || c.high || c.h);
            l = parseFloat(c.low_price || c.low || c.l);
            cl = parseFloat(c.trade_price || c.close || c.c);
          }
        }
        return { t: t, o: o, h: h, l: l, c: cl };
      }).filter(function(c){
        // 유효성 + 윈도우 범위 검증
        return c.t && !isNaN(c.h) && !isNaN(c.l)
            && c.t >= windowStart && c.t <= windowEnd + 60 * 60 * 1000;  // 1h 여유
      });
    }
    
    // 시간순 정렬
    candles.sort(function(a, b){ return a.t - b.t; });
    
    // 24개 초과 시 가장 최근 24개만
    if (candles.length > 24) candles = candles.slice(-24);
    
    return { ok: true, candles: candles, count: candles.length };
  } catch(e) {
    return { ok: false, error: String(e) };
  }
}

// [원칙 1: 사후 기록] [R8 보조]
// Tier A/B 의 단일 가격 fetch (현재 ticker)
async function fetchTierAB_Price(env, exchange, base) {
  try {
    var proxy = (env.PROXY_URL || '').replace(/\/$/, '');
    if (!proxy) return { ok: false, error: 'PROXY_URL not set' };
    
    var url = '';
    if (exchange === 'UPBIT') {
      // [정상] UPBIT: markets= 단/복수 모두 동일 엔드포인트
      url = proxy + '/upbit/ticker?markets=' + encodeURIComponent('KRW-' + base);
    } else if (exchange === 'BITHUMB') {
      // [Phase 3.12] Proxy 가 단일 ticker 미지원 — 정상 스캔과 동일하게 전체 ticker 호출
      // 응답에서 market === 'KRW-' + base 를 찾아 추출
      url = proxy + '/bithumb/ticker';
    } else if (exchange === 'BINANCE') {
      // [Phase 3.12] Proxy 호환성 — 정상 스캔과 동일하게 전체 ticker 호출
      // 응답에서 symbol === base + 'USDT' 를 찾아 추출
      url = proxy + '/api/v3/ticker/24hr';
    } else {
      return { ok: false, error: 'unknown exchange: ' + exchange };
    }
    
    var raw = await fetchJson(url, 8000);
    if (!raw) return { ok: false, error: 'no data' };
    
    // 거래소별 가격 필드 통일
    var price = null;
    if (exchange === 'UPBIT') {
      // /upbit/ticker?markets=KRW-X 는 array 반환
      if (Array.isArray(raw) && raw.length > 0) {
        price = parseFloat(raw[0].trade_price);
      } else if (raw.trade_price) {
        price = parseFloat(raw.trade_price);
      }
    } else if (exchange === 'BITHUMB') {
      // [Phase 3.12] 전체 array 에서 KRW-base 찾기
      if (Array.isArray(raw)) {
        var bithumbTarget = null;
        for (var bi = 0; bi < raw.length; bi++) {
          if (raw[bi] && raw[bi].market === 'KRW-' + base) {
            bithumbTarget = raw[bi];
            break;
          }
        }
        if (bithumbTarget) {
          price = parseFloat(bithumbTarget.trade_price || bithumbTarget.closing_price);
        }
      } else if (raw.closing_price) {
        // 단일 ticker 응답 fallback (Proxy 가 추후 ?market= 지원 시)
        price = parseFloat(raw.closing_price);
      } else if (raw.trade_price) {
        price = parseFloat(raw.trade_price);
      }
    } else if (exchange === 'BINANCE') {
      // [Phase 3.12] 전체 array 에서 base+USDT 찾기
      if (Array.isArray(raw)) {
        var binanceTarget = null;
        for (var ni = 0; ni < raw.length; ni++) {
          if (raw[ni] && raw[ni].symbol === base + 'USDT') {
            binanceTarget = raw[ni];
            break;
          }
        }
        if (binanceTarget) {
          price = parseFloat(binanceTarget.lastPrice || binanceTarget.price);
        }
      } else if (raw.lastPrice) {
        // 단일 ticker 응답 fallback (Proxy 가 ?symbol= 지원 시)
        price = parseFloat(raw.lastPrice);
      } else if (raw.price) {
        price = parseFloat(raw.price);
      }
    }
    
    if (price === null || isNaN(price) || price <= 0) {
      return { ok: false, error: 'invalid price (base=' + base + ', exchange=' + exchange + ')' };
    }
    
    return { ok: true, price: price };
  } catch(e) {
    return { ok: false, error: String(e) };
  }
}

// [원칙 5: Tier 차등 추적] [R6: 메타]
// Tier A/B 의 시간 도래 sample 수집
// 도래 시점 (다음 sample 시각) 이 지났으면 fetch + 저장
async function processTierABTracking(env, item, openPrice) {
  try {
    var snapshotId = item.id;
    var now = Date.now();

    // 가격 fetch 전 meta를 먼저 읽어 모드/lastSampleWriteAt 기준을 active와 동기화한다.
    var meta = await getTrackMeta(env, snapshotId);
    if (!meta) return { ok: false, error: 'meta not found' };

    var trackingMode = getTrackingMode(item, meta);
    var intervalMin = getSampleIntervalMin(item, meta);

    // [v4.7.16] 실제 sample write 주기 제한: deep 5분 / standard 15분
    if (!shouldWriteSample(item, now, meta)) {
      return {
        ok: true,
        skipped: true,
        reason: 'sample_interval_not_due',
        mode: trackingMode,
        intervalMin: intervalMin,
        lastSampleWriteAt: Number(item.lastSampleWriteAt || meta.lastSampleWriteAt || 0),
      };
    }

    var startAt = Number(item.tierAssignedAt || item.startedAt || meta.tierAssignedAt || meta.startedAt || meta.windowStart || now);
    var elapsedMin = (now - startAt) / (60 * 1000);
    if (!isFinite(elapsedMin) || elapsedMin < 0) elapsedMin = 0;

    // 기존 sample key 호환성 유지: 현재 정책상 deep/standard 모두 tier1 단일 구간으로 저장
    var phase = 'tier1';
    var expectedIdx = Math.floor(elapsedMin / intervalMin);

    // 이미 저장된 마지막 idx 확인 — lastSampleWriteAt 없는 기존 추적에 대한 중복 write 방어
    var keyPrefix = 'track_t1_';
    var lastIdxKey = keyPrefix + snapshotId + '_last';
    var lastIdxRaw = await env.ALERT_KV.get(lastIdxKey);
    var lastIdx = lastIdxRaw ? parseInt(lastIdxRaw, 10) : -1;

    if (expectedIdx <= lastIdx) {
      return { ok: true, skipped: true, reason: 'not_due', phase: phase, lastIdx: lastIdx, mode: trackingMode, intervalMin: intervalMin };
    }
    
    // [Phase 3.14] fetch retry cooldown 체크 — 직전 fetch 실패 후 10분 이내면 skip
    // qty.nextRetryAt 가 미래면 도래해도 fetch 안 함 → 매 cron 재시도 폭증 방지
    // KV read 1회 추가 (qty), 추가 키 신설 X
    try {
      var qtyRawCheck = await env.ALERT_KV.get(TRACKING_KEYS.qty(snapshotId));
      if (qtyRawCheck) {
        var qtyCheck = JSON.parse(qtyRawCheck);
        if (qtyCheck && qtyCheck.nextRetryAt && now < qtyCheck.nextRetryAt) {
          return {
            ok: true,
            skipped: true,
            reason: 'fetch_cooldown',
            phase: phase,
            cooldownRemainMs: qtyCheck.nextRetryAt - now,
          };
        }
      }
    } catch(cdErr) { /* qty 파싱 실패는 무시 — 안전 fallback (재시도 진행) */ }
    
    var priceRes = await fetchTierAB_Price(env, meta.exchange, meta.base);
    if (!priceRes.ok) {
      // fetch 실패 — fetchErrors 증가용 마커만 저장
      await incrementFetchError(env, snapshotId);
      return { ok: false, error: priceRes.error, fetchFailed: true };
    }
    
    var sample = {
      t: now,
      price: priceRes.price,
      deltaPct: openPrice ? ((priceRes.price - openPrice) / openPrice * 100) : null,
      idx: expectedIdx,
      phase: phase,
    };
    
    // 무결성 검증 (NaN/Infinity)
    if (isNaN(sample.price) || !isFinite(sample.price) || sample.price <= 0) {
      await incrementFetchError(env, snapshotId);
      return { ok: false, error: 'invalid sample price' };
    }
    
    // sample KV 저장
    var sampleKey = (phase === 'tier1' ? TRACKING_KEYS.t1 : TRACKING_KEYS.t2)(snapshotId, expectedIdx);
    await env.ALERT_KV.put(sampleKey, JSON.stringify(sample),
      { expirationTtl: 86400 * 30 });
    
    // last idx 갱신
    await env.ALERT_KV.put(lastIdxKey, String(expectedIdx),
      { expirationTtl: 86400 * 30 });
    
    // [Phase 4.7 공사 4 — A2-경량] last_sample_{id} 박제
    // /tracking/active 응답 시 추적당 1번 read 로 lastPrice/currentPct 등 즉시 표시
    // 페이지 로드 0.45초 후 모든 카드 정상 표시
    // sample.t (측정 시각) 함께 박제 → HTML "5분 전 데이터" 라벨 정확도 (D1 결정)
    try {
      await env.ALERT_KV.put(TRACKING_KEYS.lastSample(snapshotId), JSON.stringify(sample),
        { expirationTtl: 86400 * 30 });
    } catch(lsErr) { /* last_sample 갱신 실패는 무시 — 다음 cron 재시도 */ }

    // [v4.7.16] sample write 기준 시각을 active/meta에 동시 반영
    item.lastSampleWriteAt = now;
    item.lastSampleMode = trackingMode;
    meta.lastSampleWriteAt = now;
    meta.lastSampleMode = trackingMode;
    try {
      var rawActiveForSample = await env.ALERT_KV.get(TRACKING_KEYS.active);
      var activeForSample = rawActiveForSample ? JSON.parse(rawActiveForSample) : [];
      if (Array.isArray(activeForSample)) {
        for (var asi = 0; asi < activeForSample.length; asi++) {
          if (activeForSample[asi] && activeForSample[asi].id === snapshotId) {
            activeForSample[asi].lastSampleWriteAt = now;
            activeForSample[asi].lastSampleMode = trackingMode;
            activeForSample[asi].trackingMode = activeForSample[asi].trackingMode || item.trackingMode || meta.trackingMode || trackingMode;
            break;
          }
        }
        await env.ALERT_KV.put(TRACKING_KEYS.active, JSON.stringify(activeForSample),
          { expirationTtl: 86400 * 30 });
      }
    } catch(activeSampleErr) { /* active lastSampleWriteAt 갱신 실패는 다음 cron 에서 보정 */ }
    
    // [Phase 3.14] openPrice null fallback — 첫 성공 sample 가격을 pseudo-openPrice 로 박제
    // - meta.openPrice 가 null/0 일 때만 박제 (이미 있으면 X)
    // - 이미 저장된 sample 의 deltaPct 는 재계산 X (R7: 단일 패턴 1회 결정 정신)
    // - 이번 sample 의 deltaPct 도 그대로 (이미 sample 객체에 저장됨)
    // - 다음 sample 부터 정상 deltaPct 계산됨 (runTrackingCycle 의 meta.openPrice 로딩 통해)
    if ((openPrice == null || openPrice <= 0) && (meta.openPrice == null || meta.openPrice <= 0)) {
      try {
        meta.openPrice = priceRes.price;
        meta.pseudoOpenPrice = true;
        meta.pseudoOpenAt = now;
        meta.pseudoOpenIdx = expectedIdx;
        meta.pseudoOpenPhase = phase;
        // openPrice 변수도 갱신 (이번 cron 의 후속 threshold 검사 일관성)
        // 단 sample.deltaPct 는 이미 null 로 저장되었으므로 변경 X
        openPrice = priceRes.price;
      } catch(poErr) { /* meta 갱신 실패는 무시 — 다음 cron 에서 재시도 */ }
    }
    
    try {
      await env.ALERT_KV.put(TRACKING_KEYS.meta(snapshotId), JSON.stringify(meta),
        { expirationTtl: 86400 * 30 });
    } catch(metaSampleErr) { /* meta lastSampleWriteAt 갱신 실패는 다음 cron 에서 보정 */ }

    // [Phase 3.2-C] Threshold 도달 검사 (KV writes 최적화: 이미 reached 면 skip)
    // 최초 도달 시 1회만 저장 — recordThresholdReached 가 내부에서 중복 검사
    if (openPrice && openPrice > 0) {
      var deltaPct = sample.deltaPct;
      var tStart = meta.windowStart || meta.tierAssignedAt;
      
      if (deltaPct >= 3) {
        await recordThresholdReached(env, snapshotId, '+3', now, priceRes.price, openPrice, tStart);
      }
      if (deltaPct >= 5) {
        await recordThresholdReached(env, snapshotId, '+5', now, priceRes.price, openPrice, tStart);
      }
      if (deltaPct >= 10) {
        await recordThresholdReached(env, snapshotId, '+10', now, priceRes.price, openPrice, tStart);
      }
      if (deltaPct <= -5) {
        await recordThresholdReached(env, snapshotId, '-5', now, priceRes.price, openPrice, tStart);
      }
      
      // [Phase 3.2-C] TP1 도달 검사 (1회만)
      // meta.tp1Price 가 있을 때만 (스캐너가 박제한 값)
      if (meta.tp1Price && priceRes.price >= meta.tp1Price) {
        await recordTP1Reached(env, snapshotId, meta.tp1Price, now, priceRes.price, tStart);
      }
    }
    
    return { ok: true, phase: phase, idx: expectedIdx, price: priceRes.price, mode: trackingMode, intervalMin: intervalMin, lastSampleWriteAt: now };
  } catch(e) {
    return { ok: false, error: String(e) };
  }
}

// [원칙 5 + R8] Tier C 의 24h 도래 시 anchored fetch
async function processTierCTracking(env, item) {
  try {
    var snapshotId = item.id;
    var meta = await getTrackMeta(env, snapshotId);
    if (!meta) return { ok: false, error: 'meta not found' };
    
    // 24h 도래 + 재시도 grace (총 30분) 이전이면 skip
    var now = Date.now();
    
    // [핫픽스] meta 의 windowStart/End 가 string 일 수 있음 → 정규화
    var windowEnd = normalizeTimeMs(meta.windowEnd) || normalizeTimeMs(item.windowEnd);
    var windowStart = normalizeTimeMs(meta.windowStart);
    
    // 정규화 결과를 meta 에 반영 (기존 잘못된 데이터 자동 복구)
    if (windowStart && windowStart !== meta.windowStart) {
      meta.windowStart = windowStart;
    }
    if (windowEnd && windowEnd !== meta.windowEnd) {
      meta.windowEnd = windowEnd;
      // 복구된 meta 즉시 저장
      await env.ALERT_KV.put(TRACKING_KEYS.meta(snapshotId), JSON.stringify(meta),
        { expirationTtl: 86400 * 30 });
    }
    
    if (!windowEnd || now < windowEnd) {
      return { ok: true, skipped: true, reason: 'not_24h_yet' };
    }
    
    // 재시도 한도 초과 검사
    var qtyRaw = await env.ALERT_KV.get(TRACKING_KEYS.qty(snapshotId));
    var qty = qtyRaw ? JSON.parse(qtyRaw) : { retryCount: 0, fetchErrors: 0 };
    
    if (qty.retryCount >= TIER_C_RETRY_MAX) {
      // 이미 3회 시도 — expired_partial 마킹
      await markExpiredPartial(env, snapshotId, meta);
      return { ok: false, expired: true, reason: 'retry_max_reached' };
    }
    
    // grace 기간 초과 (windowEnd + 30분) 검사
    var graceEnd = windowEnd + TIER_C_RETRY_GRACE_MIN * 60 * 1000;
    if (now > graceEnd) {
      await markExpiredPartial(env, snapshotId, meta);
      return { ok: false, expired: true, reason: 'grace_period_exceeded' };
    }
    
    // anchored fetch 시도 (정규화된 windowStart/End 사용)
    var fetchRes = await fetchTierC_Candles(env, meta.exchange, meta.base,
                                              windowStart, windowEnd);
    
    if (!fetchRes.ok || fetchRes.count < 20) {
      // 실패 또는 너무 적은 캔들 — retryCount 증가
      qty.retryCount = (qty.retryCount || 0) + 1;
      qty.fetchErrors = (qty.fetchErrors || 0) + 1;
      qty.lastError = fetchRes.error || 'insufficient candles';
      qty.lastTryAt = now;
      await env.ALERT_KV.put(TRACKING_KEYS.qty(snapshotId), JSON.stringify(qty),
        { expirationTtl: 86400 * 30 });
      return { ok: false, retried: true, retryCount: qty.retryCount };
    }
    
    // 성공 — 캔들 저장 (Phase 3.2-C 에서 summary 계산 시 사용)
    await env.ALERT_KV.put('track_candles_' + snapshotId, JSON.stringify(fetchRes.candles),
      { expirationTtl: 86400 * 30 });
    
    // dataQuality 업데이트
    qty.actualCandles = fetchRes.count;
    qty.expectedCandles = 24;
    qty.completeness = fetchRes.count / 24;
    qty.fetchErrors = qty.fetchErrors || 0;
    qty.status = 'completed';
    qty.completedAt = now;
    await env.ALERT_KV.put(TRACKING_KEYS.qty(snapshotId), JSON.stringify(qty),
      { expirationTtl: 86400 * 30 });
    
    // tracking 완료 마킹 (Phase 3.2-C 에서 패턴 분류 + summary)
    await completeTracking(env, snapshotId, meta, qty);
    
    return { ok: true, candles: fetchRes.count };
  } catch(e) {
    return { ok: false, error: String(e) };
  }
}

// 헬퍼: track meta 조회
async function getTrackMeta(env, snapshotId) {
  try {
    var raw = await env.ALERT_KV.get(TRACKING_KEYS.meta(snapshotId));
    return raw ? JSON.parse(raw) : null;
  } catch(e) { return null; }
}

// 헬퍼: fetchErrors 증가
// [Phase 3.14] nextRetryAt 도 함께 박제 → cooldown 동안 같은 idx 재시도 차단
async function incrementFetchError(env, snapshotId) {
  try {
    var raw = await env.ALERT_KV.get(TRACKING_KEYS.qty(snapshotId));
    var qty = raw ? JSON.parse(raw) : { fetchErrors: 0 };
    var now = Date.now();
    qty.fetchErrors = (qty.fetchErrors || 0) + 1;
    qty.lastErrorAt = now;
    qty.nextRetryAt = now + FETCH_RETRY_COOLDOWN_MS;  // [Phase 3.14] 다음 재시도 가능 시각
    await env.ALERT_KV.put(TRACKING_KEYS.qty(snapshotId), JSON.stringify(qty),
      { expirationTtl: 86400 * 30 });
  } catch(e) { /* 무시 */ }
}

// [원칙 4-A: 복원력] expired_partial 마킹
async function markExpiredPartial(env, snapshotId, meta) {
  try {
    if (meta) {
      meta.status = 'expired_partial';
      meta.expiredAt = Date.now();
      await env.ALERT_KV.put(TRACKING_KEYS.meta(snapshotId), JSON.stringify(meta),
        { expirationTtl: 86400 * 30 });
    }
    
    // qty 도 expired_partial 로
    var qtyRaw = await env.ALERT_KV.get(TRACKING_KEYS.qty(snapshotId));
    var qty = qtyRaw ? JSON.parse(qtyRaw) : {};
    qty.status = 'expired_partial';
    qty.expiredAt = Date.now();
    await env.ALERT_KV.put(TRACKING_KEYS.qty(snapshotId), JSON.stringify(qty),
      { expirationTtl: 86400 * 30 });
    
    // active 에서 제거 → done_recent 로
    await moveToDoneRecent(env, snapshotId, 'expired_partial');
  } catch(e) { /* 무시 */ }
}


// [v4.7.17] Deep tracking 판정/완료 결과 헬퍼
function isDeepTrackingItem(item, meta) {
  item = item || {};
  meta = meta || {};
  return !!(
    item.isWatchlist || meta.isWatchlist || meta.isWatchlistAtAlarm ||
    item.isAutoPrecise || meta.isAutoPrecise || meta.isAutoPreciseAtAlarm ||
    item.trackingMode === 'deep' || meta.trackingMode === 'deep' ||
    Number(item.windowDays || meta.windowDays || 0) >= 7
  );
}

function calcDeepResultType(mfe, mae) {
  mfe = Number(mfe || 0);
  mae = Number(mae || 0);
  if (mfe >= 5) return 'Success';
  if (mfe >= 3) return 'Watch';
  if (mae <= -5) return 'Fail';
  return 'Flat';
}

async function markExpireSoonNotified(env, snapshotId, now) {
  try {
    var rawActive = await env.ALERT_KV.get(TRACKING_KEYS.active);
    var active = rawActive ? JSON.parse(rawActive) : [];
    if (Array.isArray(active)) {
      for (var i = 0; i < active.length; i++) {
        if (active[i] && active[i].id === snapshotId) {
          active[i].expireSoonNotified = true;
          active[i].expireSoonNotifiedAt = now;
          break;
        }
      }
      await env.ALERT_KV.put(TRACKING_KEYS.active, JSON.stringify(active), { expirationTtl: 86400 * 30 });
    }
    var meta = await getTrackMeta(env, snapshotId);
    if (meta) {
      meta.expireSoonNotified = true;
      meta.expireSoonNotifiedAt = now;
      await env.ALERT_KV.put(TRACKING_KEYS.meta(snapshotId), JSON.stringify(meta), { expirationTtl: 86400 * 30 });
    }
  } catch(e) { /* 알림 플래그 실패는 다음 cron 에서 notify_sent 키로 중복 방어 */ }
}

async function sendDeepFinalizeNotification(env, item) {
  if (!item || !item.id) return;
  try {
    var key = TRACKING_KEYS.notifySent(item.id);
    var raw = await env.ALERT_KV.get(key);
    var n = raw ? JSON.parse(raw) : {};
    if (n.deep_end) return;
    var msg = await v47_buildExpiryEndMessage(env, item);
    await v47_sendOrQueue(env, msg, 'deep_end', item.id);
    n.deep_end = true;
    n.deepEndAt = Date.now();
    await env.ALERT_KV.put(key, JSON.stringify(n), { expirationTtl: 86400 * 7 });
  } catch(e) { /* 텔레 실패는 추적 완료 흐름을 막지 않음 */ }
}

// [원칙 4-B: usable] [데이터 정합성 — Phase 3.2-B 측정 완료, Phase 3.2-C 분석]
// Phase 3.2-B: status='measurement_done' 마킹만 (active 유지)
// Phase 3.2-C: finalizeTracking 이 분석 + moveToDoneRecent 호출
//
// 이 분리의 이유:
// - Phase 3.2-C 의 분석 (패턴 분류 / summary 생성) 실패 시 측정 데이터 보존
// - active 리스트에 남아있으므로 다음 Cron 에서 재시도 가능
// - "측정 완료"와 "분석 완료"를 명확히 구분
async function completeTracking(env, snapshotId, meta, qty) {
  try {
    if (meta) {
      meta.status = 'measurement_done';     // Phase 3.2-B 측정 완료
      meta.measurementDoneAt = Date.now();
      await env.ALERT_KV.put(TRACKING_KEYS.meta(snapshotId), JSON.stringify(meta),
        { expirationTtl: 86400 * 30 });
    }
    // Phase 3.2-C 의 finalizeTracking 이 다음 Cron 에서 호출됨
    // 분석 완료 후에 moveToDoneRecent 가 호출됨
  } catch(e) { /* 무시 */ }
}

// 헬퍼: active 에서 제거 + done_recent 로 이동
async function moveToDoneRecent(env, snapshotId, finalStatus) {
  try {
    // 1. active 에서 제거
    var rawActive = await env.ALERT_KV.get(TRACKING_KEYS.active);
    var active = rawActive ? JSON.parse(rawActive) : [];
    if (Array.isArray(active)) {
      active = active.filter(function(x){ return x.id !== snapshotId; });
      await env.ALERT_KV.put(TRACKING_KEYS.active, JSON.stringify(active),
        { expirationTtl: 86400 * 30 });
    }
    
    // 2. done_recent 에 추가 (최대 100건)
    var rawDone = await env.ALERT_KV.get(TRACKING_KEYS.doneRecent);
    var done = rawDone ? JSON.parse(rawDone) : [];
    if (!Array.isArray(done)) done = [];
    
    done = done.filter(function(x){ return x.id !== snapshotId; });
    done.unshift({
      id: snapshotId,
      status: finalStatus,
      completedAt: Date.now(),
    });
    if (done.length > 100) done = done.slice(0, 100);
    
    await env.ALERT_KV.put(TRACKING_KEYS.doneRecent, JSON.stringify(done),
      { expirationTtl: 86400 * 30 });
  } catch(e) { /* 무시 */ }
}

// [원칙 5: 추적 빈도 차등] [STEP A v2.0 Section 7.3: Cron 한도 보호]
// 매 10분 Cron 으로 호출되는 메인 함수
// 우선순위: Tier A → Tier B → Tier C (Subrequests 한도 47 보호)
async function runTrackingCycle(env) {
  try {
    var rawActive = await env.ALERT_KV.get(TRACKING_KEYS.active);
    var active = rawActive ? JSON.parse(rawActive) : [];
    if (!Array.isArray(active) || active.length === 0) {
      return { ok: true, processed: 0, reason: 'no_active' };
    }
    
    // Tier 별 분리
    var tierA = active.filter(function(x){ return x.tier === 'A'; });
    var tierB = active.filter(function(x){ return x.tier === 'B'; });
    var tierC = active.filter(function(x){ return x.tier === 'C'; });
    
    var budget = CRON_FETCH_BUDGET;
    var processed = { A: 0, B: 0, C: 0 };
    var failed = { A: 0, B: 0, C: 0 };
    var skipped = 0;
    var finalized = { ok: 0, retry: 0 };  // [Phase 3.2-C] finalize 카운트
    
    // ── [Phase 3.2-C] 0순위: measurement_done 항목 분석 ──
    // 측정 완료된 항목을 finalizeTracking 으로 분석
    // BTC fetch 1회 사용 (예산에서 차감)
    for (var f = 0; f < active.length && budget > CRON_SAFE_MARGIN; f++) {
      var fItem = active[f];
      var fMeta = await getTrackMeta(env, fItem.id);
      if (fMeta && fMeta.status === 'measurement_done') {
        var finalRes = await finalizeTracking(env, fItem.id);
        if (finalRes.ok) {
          finalized.ok++;
          budget--;  // BTC fetch 1회 사용
          
          // [Phase 4.7 공사 4 — 6-3] 정밀 코인 종료 텔레
          // 관심 OR 자동 정밀 → 결과 메시지 발송 (sleep_queue 통합)
          if (isDeepTrackingItem(fItem, fMeta)) {
            try {
              var v47_endNotifyKey = TRACKING_KEYS.notifySent(fItem.id);
              var v47_endRawN = await env.ALERT_KV.get(v47_endNotifyKey);
              var v47_endN = v47_endRawN ? JSON.parse(v47_endRawN) : {};
              if (!v47_endN.deep_end) {
                var v47_endMsg = await v47_buildExpiryEndMessage(env, fItem);
                await v47_sendOrQueue(env, v47_endMsg, 'deep_end', fItem.id);
                v47_endN.deep_end = true;
                await env.ALERT_KV.put(v47_endNotifyKey, JSON.stringify(v47_endN),
                  { expirationTtl: 86400 * 7 });
              }
            } catch(v47_endErr) { /* 텔레 실패는 무시 */ }
          }
        } else if (finalRes.retried) {
          finalized.retry++;
          // 실패 시에도 BTC fetch 시도했을 가능성 → 안전하게 차감
          budget--;
        }
      }
    }
    
    // ── [Phase 4.7 공사 4 — 6-3] 만료 1시간 전 텔레 (정밀 코인) ──
    // active 추적 모두 검사 → 정밀 + 만료 1h 이내 + 1h 텔레 미발송 → 발송
    for (var v47_e = 0; v47_e < active.length; v47_e++) {
      var v47_eItem = active[v47_e];
      if (!v47_eItem || !v47_eItem.windowEnd) continue;
      var v47_isPrecise = isDeepTrackingItem(v47_eItem, null);
      if (!v47_isPrecise) continue;
      var v47_remain = v47_eItem.windowEnd - Date.now();
      if (v47_remain <= 0 || v47_remain > 3600 * 1000) continue;
      try {
        var v47_1hKey = TRACKING_KEYS.notifySent(v47_eItem.id);
        var v47_1hRaw = await env.ALERT_KV.get(v47_1hKey);
        var v47_1hN = v47_1hRaw ? JSON.parse(v47_1hRaw) : {};
        if (v47_1hN.manual_1h) continue;
        var v47_1hMsg = await v47_buildExpiry1hMessage(env, v47_eItem);
        await v47_sendOrQueue(env, v47_1hMsg, 'manual_1h', v47_eItem.id);
        v47_1hN.manual_1h = true;
        await env.ALERT_KV.put(v47_1hKey, JSON.stringify(v47_1hN),
          { expirationTtl: 86400 * 7 });
        await markExpireSoonNotified(env, v47_eItem.id, Date.now());
      } catch(v47_1hErr) { /* 무시 */ }
    }
    
    // ── 1순위: Tier A ──
    for (var i = 0; i < tierA.length && budget > CRON_SAFE_MARGIN; i++) {
      var item = tierA[i];
      var meta = await getTrackMeta(env, item.id);
      var openPrice = meta && meta.openPrice ? meta.openPrice : null;
      
      // openPrice 없으면 snapshot 에서 가져오기 (1회)
      if (!openPrice) {
        try {
          var snapRaw = await env.ALERT_KV.get('snap_' + item.id);
          if (snapRaw) {
            var snap = JSON.parse(snapRaw);
            openPrice = snap.price || (snap.scanner && snap.scanner.price) || null;
            if (openPrice && meta) {
              meta.openPrice = openPrice;
              await env.ALERT_KV.put(TRACKING_KEYS.meta(item.id), JSON.stringify(meta),
                { expirationTtl: 86400 * 30 });
            }
          }
        } catch(e) { /* 무시 */ }
      }
      
      var res = await processTierABTracking(env, item, openPrice);
      if (res.ok && !res.skipped) { processed.A++; budget--; }
      else if (res.skipped) skipped++;
      else { failed.A++; budget--; }  // fetch 실패도 budget 차감
      
      // Tier A/B 종료 검사 (windowEnd 도달) — [핫픽스] 정규화 적용
      var windowEndA = normalizeTimeMs(meta && meta.windowEnd);
      if (windowEndA && Date.now() >= windowEndA) {
        // meta 도 정규화된 값으로 갱신 (적체 방지)
        if (meta && windowEndA !== meta.windowEnd) {
          meta.windowEnd = windowEndA;
          if (meta.windowStart) meta.windowStart = normalizeTimeMs(meta.windowStart) || meta.windowStart;
        }
        await completeTracking(env, item.id, meta, null);
        if (isDeepTrackingItem(item, meta)) {
          var v4717FinalA = await finalizeTracking(env, item.id);
          if (v4717FinalA && v4717FinalA.ok) {
            finalized.ok++;
            await sendDeepFinalizeNotification(env, item);
          } else if (v4717FinalA && v4717FinalA.retried) {
            finalized.retry++;
          }
        }
      }
    }
    
    // ── 2순위: Tier B ──
    for (var j = 0; j < tierB.length && budget > CRON_SAFE_MARGIN; j++) {
      var itemB = tierB[j];
      var metaB = await getTrackMeta(env, itemB.id);
      var openPriceB = metaB && metaB.openPrice ? metaB.openPrice : null;
      
      if (!openPriceB) {
        try {
          var snapRawB = await env.ALERT_KV.get('snap_' + itemB.id);
          if (snapRawB) {
            var snapB = JSON.parse(snapRawB);
            openPriceB = snapB.price || (snapB.scanner && snapB.scanner.price) || null;
            if (openPriceB && metaB) {
              metaB.openPrice = openPriceB;
              await env.ALERT_KV.put(TRACKING_KEYS.meta(itemB.id), JSON.stringify(metaB),
                { expirationTtl: 86400 * 30 });
            }
          }
        } catch(e) { /* 무시 */ }
      }
      
      var resB = await processTierABTracking(env, itemB, openPriceB);
      if (resB.ok && !resB.skipped) { processed.B++; budget--; }
      else if (resB.skipped) skipped++;
      else { failed.B++; budget--; }
      
      // [핫픽스] windowEnd 정규화 적용
      var windowEndB = normalizeTimeMs(metaB && metaB.windowEnd);
      if (windowEndB && Date.now() >= windowEndB) {
        if (metaB && windowEndB !== metaB.windowEnd) {
          metaB.windowEnd = windowEndB;
          if (metaB.windowStart) metaB.windowStart = normalizeTimeMs(metaB.windowStart) || metaB.windowStart;
        }
        await completeTracking(env, itemB.id, metaB, null);
        if (isDeepTrackingItem(itemB, metaB)) {
          var v4717FinalB = await finalizeTracking(env, itemB.id);
          if (v4717FinalB && v4717FinalB.ok) {
            finalized.ok++;
            await sendDeepFinalizeNotification(env, itemB);
          } else if (v4717FinalB && v4717FinalB.retried) {
            finalized.retry++;
          }
        }
      }
    }
    
    // ── 3순위: Tier C ── (24h 도래분만, 보통 분산되어 적음)
    for (var k = 0; k < tierC.length && budget > CRON_SAFE_MARGIN; k++) {
      var itemC = tierC[k];
      var resC = await processTierCTracking(env, itemC);
      if (resC.ok && !resC.skipped) { processed.C++; budget--; }
      else if (resC.skipped) skipped++;
      else if (resC.expired) processed.C++;  // expired 도 처리됨 (budget 차감 안 함, fetch 안 했으면)
      else { failed.C++; budget--; }
    }
    
    return {
      ok: true,
      processed: processed,
      failed: failed,
      skipped: skipped,
      finalized: finalized,
      budgetRemaining: budget,
      activeCounts: { A: tierA.length, B: tierB.length, C: tierC.length },
    };
  } catch(e) {
    return { ok: false, error: String(e) };
  }
}

// ══════════════════════════════════════════════════════════════════
// Phase 3.2-B 끝 — Cron 추적 엔진 (Tier A/B sample + Tier C anchored fetch)
// 다음 Phase 3.2-C: Threshold + TP1 + Pattern 분류 + dataQuality.usable 계산
// ══════════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════════
// Phase 3.2-C — 패턴 분류 + Summary + finalizeTracking
// 기반: STEP A v2.0 Section 8 (분석기 분석 단계)
//      v1.3 원칙 1 (사후 기록), 7 (단일 패턴 1회 결정)
//      KV writes 최적화: threshold/TP1 최초 1회 / summary 24h 1회
//
// Phase 3.2-A: 추적 시작 (assignTier, startTracking)
// Phase 3.2-B: 측정 (sample 수집, anchored fetch, measurement_done)
// Phase 3.2-C: 분석 (이 영역) — 측정 완료 데이터를 한 번 분석 후 completed
// ══════════════════════════════════════════════════════════════════

// 임계값 정의 (Threshold 도달 추적)
var TRACKING_THRESHOLDS = ['+3', '+5', '+10', '-5'];

// [원칙 1: 사후 기록] [R1: 라벨 X, 이벤트만]
// Threshold 도달 — +3/+5/+10/-5 임계값
// [KV writes 최적화] 최초 도달 시 1회만 기록, 이미 reached=true 면 skip
async function recordThresholdReached(env, snapshotId, threshold, atMs, price, openPrice, tStart) {
  try {
    // 1. 기존 thresholds 조회
    var raw = await env.ALERT_KV.get(TRACKING_KEYS.thr(snapshotId));
    var thresholds = raw ? JSON.parse(raw) : {};
    
    // [최적화 1] 이미 도달 기록 있으면 KV write 안 함
    if (thresholds[threshold] && thresholds[threshold].reached) {
      return { ok: true, skipped: true, reason: 'already_recorded' };
    }
    
    // 2. 이벤트 기록 (R1: SUCCESS/FAIL 라벨 X)
    thresholds[threshold] = {
      reached: true,
      atMs: atMs,
      elapsedMin: Math.floor((atMs - tStart) / 60000),
      priceAtReach: price,
      // openPrice 대비 deltaPct
      deltaPct: openPrice > 0 ? ((price - openPrice) / openPrice * 100) : null,
    };
    
    // 3. KV 저장 (최초 도달 시 1회만)
    await env.ALERT_KV.put(TRACKING_KEYS.thr(snapshotId), JSON.stringify(thresholds),
      { expirationTtl: 86400 * 30 });
    
    return { ok: true, threshold: threshold, atMs: atMs, recorded: true };
  } catch(e) {
    return { ok: false, error: String(e) };
  }
}

// [원칙 1: 사후 기록] TP1 도달
// [KV writes 최적화] 최초 도달 시 1회만
async function recordTP1Reached(env, snapshotId, tp1Price, atMs, price, tStart) {
  try {
    var raw = await env.ALERT_KV.get(TRACKING_KEYS.tp1(snapshotId));
    var tp1 = raw ? JSON.parse(raw) : { reached: false };
    
    // [최적화 1] 이미 도달이면 skip
    if (tp1.reached) {
      return { ok: true, skipped: true, reason: 'already_recorded' };
    }
    
    // 도달 기록
    tp1 = {
      targetPrice: tp1Price,
      reached: true,
      atMs: atMs,
      elapsedMin: Math.floor((atMs - tStart) / 60000),
      priceAtReach: price,
    };
    
    await env.ALERT_KV.put(TRACKING_KEYS.tp1(snapshotId), JSON.stringify(tp1),
      { expirationTtl: 86400 * 30 });
    
    return { ok: true, recorded: true };
  } catch(e) {
    return { ok: false, error: String(e) };
  }
}

// [R7: 단일 패턴 1회 결정] [한계 6: Tier C 시간축 부족]
// Tier A/B: 8개 패턴 (precise) / Tier C: 4개 (inferred)
// [순수 함수 — KV write 없음, finalizeTracking 에서 1회 호출]
function classifyBehaviorPattern(samples, summary, tier) {
  if (!summary) return { pattern: 'UNCLASSIFIED', confidence: 'inferred' };
  
  var maxRise = summary.maxRise;
  var maxDrawdown = summary.maxDrawdown;
  var closeReturn = summary.closeReturn;
  
  // ── Tier C: 시간축 부족 → 4개만 (max 값만으로 분류 가능한 것) ──
  if (tier === 'C') {
    if (maxRise >= 10 && maxDrawdown > -3) return { pattern: 'EXPLOSIVE', confidence: 'inferred' };
    if (maxDrawdown <= -5 && maxRise < 2) return { pattern: 'CRASH', confidence: 'inferred' };
    if (maxRise < 3 && maxDrawdown > -3) return { pattern: 'RANGE_BOUND', confidence: 'inferred' };
    return { pattern: 'UNCLASSIFIED', confidence: 'inferred' };
  }
  
  // ── Tier A/B: 8개 패턴 ──
  // 1. EXPLOSIVE: maxRise >= 10, drawdown 작음
  if (maxRise >= 10 && maxDrawdown > -3) return { pattern: 'EXPLOSIVE', confidence: 'precise' };
  
  // 2. CRASH: maxDrawdown <= -5, rise 작음
  if (maxDrawdown <= -5 && maxRise < 2) return { pattern: 'CRASH', confidence: 'precise' };
  
  // 3. RANGE_BOUND: rise < 3 + drawdown > -3
  if (maxRise < 3 && maxDrawdown > -3) return { pattern: 'RANGE_BOUND', confidence: 'precise' };
  
  // 4. PUMP_DUMP: maxRise >= 5 + closeReturn < -2
  if (maxRise >= 5 && closeReturn < -2) return { pattern: 'PUMP_DUMP', confidence: 'precise' };
  
  // 5. STEADY_UP: 시간축 활용 — 후반이 전반보다 높음 + closeReturn 양수
  if (samples && samples.length >= 5) {
    var half = Math.floor(samples.length / 2);
    var firstHalfSum = 0;
    for (var i = 0; i < half; i++) firstHalfSum += samples[i].price;
    var firstHalfAvg = firstHalfSum / half;
    var secondHalfSum = 0;
    for (var j = half; j < samples.length; j++) secondHalfSum += samples[j].price;
    var secondHalfAvg = secondHalfSum / (samples.length - half);
    var isUpTrend = secondHalfAvg > firstHalfAvg;
    if (maxRise >= 3 && maxDrawdown > -3 && closeReturn > 1 && isUpTrend) {
      return { pattern: 'STEADY_UP', confidence: 'precise' };
    }
  }
  
  // 6. BREAKOUT_FAIL: maxRise 3~8 + closeReturn 거의 0
  if (maxRise >= 3 && maxRise < 8 && Math.abs(closeReturn) < 1) {
    return { pattern: 'BREAKOUT_FAIL', confidence: 'precise' };
  }
  
  // 7. SLOW_BLEED: maxDrawdown -3~-5 + rise 작음
  if (maxDrawdown <= -3 && maxDrawdown > -5 && maxRise < 3) {
    return { pattern: 'SLOW_BLEED', confidence: 'precise' };
  }
  
  // 8. UNCLASSIFIED
  return { pattern: 'UNCLASSIFIED', confidence: 'precise' };
}

// [원칙 1: 사후 기록] 24h Summary 계산
// [순수 함수 — KV write 없음, finalizeTracking 에서 1회 호출 후 1회 저장]
function compute24hSummary(samples, openPrice, btcContext, candles) {
  // candles 가 있으면 (Tier C) 그것 사용, 없으면 samples (Tier A/B)
  var dataPoints = null;
  if (candles && candles.length > 0) {
    dataPoints = [];
    for (var i = 0; i < candles.length; i++) {
      var c = candles[i];
      dataPoints.push({
        t: c.t,
        high: c.h !== undefined ? c.h : c.price,
        low: c.l !== undefined ? c.l : c.price,
        close: c.c !== undefined ? c.c : c.price,
      });
    }
  } else if (samples && samples.length > 0) {
    dataPoints = [];
    for (var k = 0; k < samples.length; k++) {
      var s = samples[k];
      dataPoints.push({
        t: s.t,
        high: s.price,
        low: s.price,
        close: s.price,
      });
    }
  }
  
  if (!dataPoints || dataPoints.length === 0) return null;
  
  // closePrice = 마지막 점
  var lastPoint = dataPoints[dataPoints.length - 1];
  var closePrice = lastPoint.close;
  
  // high24h / low24h
  var high24h = -Infinity, low24h = Infinity;
  var highAtMs = null, lowAtMs = null;
  
  for (var m = 0; m < dataPoints.length; m++) {
    var p = dataPoints[m];
    if (p.high > high24h) { high24h = p.high; highAtMs = p.t; }
    if (p.low < low24h) { low24h = p.low; lowAtMs = p.t; }
  }
  
  var summary = {
    openPrice: openPrice,
    closePrice: closePrice,
    closeReturn: openPrice > 0 ? ((closePrice - openPrice) / openPrice) * 100 : 0,
    high24h: high24h,
    low24h: low24h,
    maxRise: openPrice > 0 ? ((high24h - openPrice) / openPrice) * 100 : 0,
    maxRiseAtMs: highAtMs,
    maxDrawdown: openPrice > 0 ? ((low24h - openPrice) / openPrice) * 100 : 0,
    maxDrawdownAtMs: lowAtMs,
  };
  
  // marketContext (모든 Tier — BTC delta 24h)
  if (btcContext && typeof btcContext.delta === 'number') {
    summary.marketContext = {
      btc24hDelta: btcContext.delta,
      btcSnapshotPrice: btcContext.snapshotPrice || null,
    };
  }
  
  // endMomentum (Tier A/B 만 — samples >= 12 일 때 last 2h slope)
  if (samples && samples.length >= 12) {
    var last2h = samples.slice(-12);
    var pStart = last2h[0].price;
    var pEnd = last2h[last2h.length - 1].price;
    if (pStart > 0) {
      summary.endMomentum = {
        last2hSlope: ((pEnd - pStart) / pStart) * 100,
        last2hPriceChange: pEnd,
      };
    }
  }
  
  return summary;
}

// 헬퍼: Tier A/B sample 모두 수집 (track_t1_*, track_t2_*)
async function loadAllSamples(env, snapshotId) {
  try {
    var samples = [];
    
    // tier1 last idx 조회
    var t1Last = await env.ALERT_KV.get('track_t1_' + snapshotId + '_last');
    var t1MaxIdx = t1Last ? parseInt(t1Last, 10) : -1;
    
    for (var i = 0; i <= t1MaxIdx; i++) {
      var raw = await env.ALERT_KV.get(TRACKING_KEYS.t1(snapshotId, i));
      if (raw) {
        try { samples.push(JSON.parse(raw)); } catch(e) {}
      }
    }
    
    // tier2 last idx 조회
    var t2Last = await env.ALERT_KV.get('track_t2_' + snapshotId + '_last');
    var t2MaxIdx = t2Last ? parseInt(t2Last, 10) : -1;
    
    for (var j = 0; j <= t2MaxIdx; j++) {
      var raw2 = await env.ALERT_KV.get(TRACKING_KEYS.t2(snapshotId, j));
      if (raw2) {
        try { samples.push(JSON.parse(raw2)); } catch(e) {}
      }
    }
    
    // 시간순 정렬
    samples.sort(function(a, b){ return (a.t || 0) - (b.t || 0); });
    
    return samples;
  } catch(e) {
    return [];
  }
}

// 헬퍼: Tier C 캔들 조회 (Phase 3.2-B 의 fetchTierC_Candles 가 저장한 것)
async function loadTierCCandles(env, snapshotId) {
  try {
    var raw = await env.ALERT_KV.get('track_candles_' + snapshotId);
    return raw ? JSON.parse(raw) : null;
  } catch(e) { return null; }
}

// 헬퍼: BTC 24h delta 조회 (1회 fetch — marketContext 용)
async function fetchBtcContext(env, windowStart, windowEnd) {
  try {
    var proxy = (env.PROXY_URL || '').replace(/\/$/, '');
    if (!proxy) return null;
    
    // BTC 1시간봉 24개 anchored
    var url = proxy + '/upbit/candles?market=KRW-BTC&count=24&unit=60&to='
            + encodeURIComponent(new Date(windowEnd).toISOString().replace(/\.\d{3}Z$/, 'Z'));
    var raw = await fetchJson(url, 8000);
    if (!Array.isArray(raw) || raw.length === 0) return null;
    
    // 시간순 정렬 (Upbit 는 최신부터)
    raw.sort(function(a, b){
      return new Date(a.candle_date_time_utc).getTime() - new Date(b.candle_date_time_utc).getTime();
    });
    
    var firstCandle = raw[0];
    var lastCandle = raw[raw.length - 1];
    var snapshotPrice = parseFloat(firstCandle.opening_price);
    var endPrice = parseFloat(lastCandle.trade_price);
    
    if (!snapshotPrice || isNaN(snapshotPrice) || snapshotPrice <= 0) return null;
    
    var delta = ((endPrice - snapshotPrice) / snapshotPrice) * 100;
    
    return {
      delta: delta,
      snapshotPrice: snapshotPrice,
      endPrice: endPrice,
    };
  } catch(e) {
    return null;
  }
}

// [원칙 4-B: usable] [R7: 단일 패턴 1회 결정]
// 24h 측정 완료 (status='measurement_done') 항목을 분석
// [KV writes 최적화] summary/pattern/usable 모두 1회만 저장
// 분석 성공 시: status='completed' + active 에서 제거 + done_recent 추가
// 분석 실패 시: status 그대로 measurement_done (다음 Cron 재시도)
async function finalizeTracking(env, snapshotId) {
  try {
    var meta = await getTrackMeta(env, snapshotId);
    if (!meta) return { ok: false, error: 'meta not found' };
    if (meta.status !== 'measurement_done') {
      return { ok: false, error: 'not in measurement_done state', status: meta.status };
    }
    
    var tier = meta.tier;
    var openPrice = meta.openPrice || null;
    if (!openPrice || openPrice <= 0) {
      return { ok: false, error: 'no openPrice', retried: true };
    }
    
    // [Phase 3.2-B 핫픽스] 시간 정규화
    var windowStart = normalizeTimeMs(meta.windowStart);
    var windowEnd = normalizeTimeMs(meta.windowEnd);
    
    // 1. 데이터 조회 (samples or candles)
    var samples = null, candles = null;
    if (tier === 'A' || tier === 'B') {
      samples = await loadAllSamples(env, snapshotId);
      // sample 부족 시 dq 영향 있지만 분석은 진행
    } else if (tier === 'C') {
      candles = await loadTierCCandles(env, snapshotId);
    }
    
    // 데이터 없으면 분석 불가 → expired_partial
    if ((!samples || samples.length === 0) && (!candles || candles.length === 0)) {
      // dataQuality 강제 false 로 마무리 (분석 자체는 끝남)
      var qtyRaw = await env.ALERT_KV.get(TRACKING_KEYS.qty(snapshotId));
      var qty = qtyRaw ? JSON.parse(qtyRaw) : { fetchErrors: 99, completeness: 0 };
      qty.status = 'expired_partial';
      qty.expiredAt = Date.now();
      await env.ALERT_KV.put(TRACKING_KEYS.qty(snapshotId), JSON.stringify(qty),
        { expirationTtl: 86400 * 30 });
      
      meta.status = 'expired_partial';
      meta.expiredAt = Date.now();
      await env.ALERT_KV.put(TRACKING_KEYS.meta(snapshotId), JSON.stringify(meta),
        { expirationTtl: 86400 * 30 });
      
      await moveToDoneRecent(env, snapshotId, 'expired_partial');
      return { ok: false, expired: true, reason: 'no_data' };
    }
    
    // 2. BTC marketContext fetch (1회 — 모든 Tier)
    var btcContext = await fetchBtcContext(env, windowStart, windowEnd);
    
    // 3. summary 계산 (1회만, finalizeTracking 진입 시)
    var summary = compute24hSummary(samples, openPrice, btcContext, candles);
    if (!summary) {
      return { ok: false, error: 'summary calculation failed', retried: true };
    }
    
    // 4. pattern 분류 (R7: 단일 결정)
    var patternResult = classifyBehaviorPattern(samples, summary, tier);
    summary.pattern = patternResult.pattern;
    summary.patternConfidence = patternResult.confidence;
    
    // 5. dataQuality + usable
    var qtyRaw2 = await env.ALERT_KV.get(TRACKING_KEYS.qty(snapshotId));
    var qty2 = qtyRaw2 ? JSON.parse(qtyRaw2) : {};
    
    // Tier A/B: completeness = sample 수 / 예상 sample 수
    if (tier === 'A' || tier === 'B') {
      var expectedSamples = tier === 'A' ? 54 : 21;
      var actualSamples = samples ? samples.length : 0;
      qty2.actualSamples = actualSamples;
      qty2.expectedSamples = expectedSamples;
      qty2.completeness = actualSamples / expectedSamples;
    }
    qty2.fetchErrors = qty2.fetchErrors || 0;
    qty2.status = 'completed';
    qty2.completedAt = Date.now();
    
    var usableResult = computeUsable(qty2, tier);
    qty2.usable = usableResult.usable;
    qty2.usableReason = usableResult.usableReason;
    
    // 6. KV 저장 (4 writes — summary + qty + meta + active 갱신)
    // [최적화] 한 번의 finalizeTracking 호출에서 모든 분석 결과 저장
    await env.ALERT_KV.put(TRACKING_KEYS.sum(snapshotId), JSON.stringify(summary),
      { expirationTtl: 86400 * 30 });
    
    await env.ALERT_KV.put(TRACKING_KEYS.qty(snapshotId), JSON.stringify(qty2),
      { expirationTtl: 86400 * 30 });
    
    meta.status = 'completed';
    meta.completedAt = Date.now();
    meta.pattern = patternResult.pattern;
    meta.patternConfidence = patternResult.confidence;
    meta.usable = usableResult.usable;
    await env.ALERT_KV.put(TRACKING_KEYS.meta(snapshotId), JSON.stringify(meta),
      { expirationTtl: 86400 * 30 });
    
    // [v4.7.17] 완료 결과 타입: Success / Watch / Fail / Flat
    var v4717_mfe = (summary && typeof summary.maxRise === 'number') ? summary.maxRise : 0;
    var v4717_mae = (summary && typeof summary.maxDrawdown === 'number') ? summary.maxDrawdown : 0;
    var v4717_currentPct = (summary && typeof summary.closeReturn === 'number') ? summary.closeReturn : 0;
    var v4717_resultType = calcDeepResultType(v4717_mfe, v4717_mae);

    // [Phase 4.6.1] 히스토리 탭용 — completed 별도 KV 키 + 인덱스 (TTL 30일)
    try {
      var v461_completedItem = {
        id: snapshotId,
        base: meta.base || '',
        exchange: meta.exchange || '',
        tier: meta.tier || 'B',
        gradeCode: meta.gradeCode || '',
        gradeLabel: meta.gradeLabel || meta.gradeCode || '',
        startedAt: meta.windowStart || 0,
        endedAt: windowEnd || meta.completedAt,
        completedAt: meta.completedAt,
        windowDays: meta.windowDays || 1,
        trackingMode: meta.trackingMode || (Number(meta.windowDays || 0) >= 7 ? 'deep' : 'standard'),
        pattern: patternResult.pattern || '',
        patternConfidence: patternResult.confidence || 0,
        usable: usableResult.usable === true,
        // outcome 가 summary 에 있으면 함께 박제
        outcome: (summary && summary.outcome) || meta.outcome || null,
        resultType: v4717_resultType,
        openPrice: openPrice,
        closePrice: (summary && summary.closePrice) || null,
        currentPct: v4717_currentPct,
        mfe: v4717_mfe,
        mae: v4717_mae,
        maxRise: v4717_mfe,
        maxDrop: v4717_mae,
        closeReturn: v4717_currentPct,
        // [Phase 4.7 공사 4 — W3] 자동 정밀 / 관심 / 카운트 박제 (분석 완료 카드 라벨 표시용)
        isWatchlist: meta.isWatchlist || meta.isWatchlistAtAlarm || false,
        isAutoPrecise: meta.isAutoPrecise || meta.isAutoPreciseAtAlarm || false,
        tierARejected: meta.tierARejected || false,
        alertCount: meta.alertCount || meta.alertCountAtAlarm || 1,
        sCount24: meta.sCount24 || meta.sCount24AtAlarm || 0,
        aCount24: meta.aCount24 || meta.aCount24AtAlarm || 0,
        gradeHistory: Array.isArray(meta.gradeHistory) ? meta.gradeHistory : [],
      };
      // 1. tracking_completed:{id} 단일 키
      await env.ALERT_KV.put('tracking_completed:' + snapshotId,
        JSON.stringify(v461_completedItem),
        { expirationTtl: 86400 * 30 });
      
      // 2. tracking_completed_index — 페이지화/검색용 (최신 200개)
      var rawCompletedIdx = await env.ALERT_KV.get('tracking_completed_index');
      var completedIdx = rawCompletedIdx ? JSON.parse(rawCompletedIdx) : [];
      if (!Array.isArray(completedIdx)) completedIdx = [];
      // 중복 제거 후 최신을 앞에 추가
      completedIdx = completedIdx.filter(function(x){ return x && x.id !== snapshotId; });
      completedIdx.unshift(v461_completedItem);
      // 최신 200개만 유지
      if (completedIdx.length > 200) completedIdx = completedIdx.slice(0, 200);
      await env.ALERT_KV.put('tracking_completed_index', JSON.stringify(completedIdx),
        { expirationTtl: 86400 * 30 });
    } catch(v461e) {
      // 히스토리 저장 실패는 정상 흐름 방해 X
    }
    
    // 7. active → done_recent
    await moveToDoneRecent(env, snapshotId, 'completed');
    
    return {
      ok: true,
      status: 'completed',
      pattern: patternResult.pattern,
      confidence: patternResult.confidence,
      usable: usableResult.usable,
      resultType: v4717_resultType,
      sampleCount: samples ? samples.length : 0,
      candleCount: candles ? candles.length : 0,
    };
  } catch(e) {
    return { ok: false, error: String(e), retried: true };
  }
}

// ══════════════════════════════════════════════════════════════════
// Phase 3.2-C 끝 — 패턴 분류 + Summary + finalizeTracking
// 다음 Phase 3.3: UPBIT 전용 fetch + Fallback 강화 + /tracking/quality
// ══════════════════════════════════════════════════════════════════

// 인덱스 업데이트 헬퍼 — 최신 항목을 앞에 추가, 한도 초과 시 오래된 것 제거
async function updateSnapshotIndex(env, indexKey, snapshotId, snapshot, maxItems) {
  try {
    var entry = {
      id: snapshotId,
      t: snapshot.timestamp,
      base: snapshot.base,
      grade: snapshot.gradeCode,
      total: snapshot.total,
      exchange: snapshot.exchange,
      alertType: snapshot.alertType,
    };
    var existing = await env.ALERT_KV.get(indexKey);
    var arr = existing ? JSON.parse(existing) : [];
    // 중복 제거 (같은 ID가 있으면 먼저 제거)
    arr = arr.filter(function(x){ return x.id !== snapshotId; });
    // 맨 앞에 추가
    arr.unshift(entry);
    // 한도 초과 시 자름
    if (arr.length > maxItems) arr = arr.slice(0, maxItems);
    // 인덱스는 TTL 90일
    await env.ALERT_KV.put(indexKey, JSON.stringify(arr),
      { expirationTtl: 86400 * 90 });
    return true;
  } catch(e) {
    return false;
  }
}

// 수면 큐 관리 (23:00~08:00 KST)
// 수면 모드 판정 (동기 버전 — 기본 시간대)
function isInSleepTimeByClock() {
  var h = (new Date().getUTCHours() + 9) % 24;
  return h >= 23 || h < 8;
}

// 수면 모드 판정 (KV 오버라이드 반영)
// override: "on" | "off" | "auto" (없으면 auto)
async function isInSleepTime(env) {
  // env 없는 호출 (동기 fallback)
  if (!env || !env.ALERT_KV) return isInSleepTimeByClock();
  try {
    var override = await env.ALERT_KV.get('sleep_mode_override');
    if (override === 'on')  return true;   // 강제 수면
    if (override === 'off') return false;  // 수면 비활성 (24시간 직송)
    // auto 또는 없음 → 시간대 판정
    return isInSleepTimeByClock();
  } catch(e) {
    return isInSleepTimeByClock();
  }
}

async function pushSleepQueue(env, coin, toSend, snapshotId) {
  try {
    var raw = await env.ALERT_KV.get('sleep_queue');
    var q = raw ? JSON.parse(raw) : [];
    q.push({
      base: coin.base, exchange: coin.representative.exchange,
      toSend: toSend, snapshotId: snapshotId,
      total: coin.representative.total, gradeCode: coin.representative.gradeCode,
      gradeLabel: coin.representative.gradeLabel,
      queuedAt: new Date().toISOString(),
    });
    if (q.length > SLEEP_QUEUE_MAX) q = q.slice(-SLEEP_QUEUE_MAX);
    // TTL 12시간 — 오전 8시 이후 발송 후 정리
    await env.ALERT_KV.put('sleep_queue', JSON.stringify(q), { expirationTtl: 12 * 3600 });
  } catch(e) {}
}

async function flushSleepQueue(env) {
  if (await isInSleepTime(env)) return; // 아직 수면 시간
  try {
    var raw = await env.ALERT_KV.get('sleep_queue');
    var q = raw ? JSON.parse(raw) : [];
    if (!q.length) return;

    // [Phase 4.7 공사 4 — 6-4] type 별 분리
    // 알람 항목 → 요약 메시지 / 만료 텔레(manual_*) → 개별 발송
    var alarmItems = [];
    var manualItems = [];
    for (var fq_i = 0; fq_i < q.length; fq_i++) {
      var fq_it = q[fq_i];
      if (fq_it && (fq_it.type === 'manual_1h' || fq_it.type === 'manual_end')) {
        manualItems.push(fq_it);
      } else {
        alarmItems.push(fq_it);
      }
    }
    
    var scannerUrl = (env.SCANNER_URL || '').replace(/\/$/, '');

    // 1. 알람 요약 메시지 (기존 형식)
    if (alarmItems.length > 0) {
      var listLines = alarmItems.map(function(item, i) {
        var ts = '';
        try { ts = new Date(item.queuedAt).toLocaleString('ko-KR',{hour12:false,timeZone:'Asia/Seoul',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}); } catch(e){}
        return (i+1)+'. <b>'+escapeHtml(item.base||'?')+'</b> ['+escapeHtml(item.toSend||'')+'] '
          +escapeHtml(item.gradeLabel||'')+' '+item.total+'점\n   보관: '+ts;
      }).join('\n\n');

      var summaryMsg = '🌅 <b>수면 중 누적 알람 보고</b>\n'
        +'총 '+alarmItems.length+'건의 알람이 수면 시간(23:00~08:00 KST) 중 발생했습니다.\n\n'
        +listLines
        +'\n\n개별 스냅샷 링크는 스캐너에서 확인하세요.'
        +(scannerUrl ? '\n🔗 '+scannerUrl : '');

      try { await sendTelegram(env, summaryMsg); } catch(e){}
    }

    // 2. 만료 텔레 항목 (개별 발송)
    for (var fq_m = 0; fq_m < manualItems.length; fq_m++) {
      try { await sendTelegram(env, manualItems[fq_m].text); } catch(e) {}
    }

    // 3. 큐 비우기
    await env.ALERT_KV.delete('sleep_queue');
  } catch(e) {}
}

// ════════════════════════════════════════════════════════════════
// [Phase 4.7 공사 4 — 6-3/6-4/6-5] 만료 텔레 알람 헬퍼
// 정밀 코인(관심 OR 자동 정밀)에 대해 만료 1h 전 + 종료 시점 발송
// sleep_queue 통합 (type 'manual_1h' / 'manual_end')
// 6-5 라벨: 관심 → "(관심)" / 자동 정밀 → "(자동)"
// ════════════════════════════════════════════════════════════════

// 가격 포맷 헬퍼
function v47_fmtTelePrice(p, exchange) {
  if (p == null) return '-';
  var ex = String(exchange || '').toUpperCase();
  if (ex === 'BINANCE') {
    if (p < 0.01 && p > 0) return Math.round(p * 100000000) + 'sat';
    if (p < 1) return p.toFixed(6);
    return p.toFixed(4);
  }
  return Math.round(p).toLocaleString() + '원';
}

// 추적 모드 라벨 (6-5)
function v47_modeLabel(item) {
  if (item.isWatchlist) return ' (관심)';
  if (item.isAutoPrecise) return ' (자동)';
  return '';
}

// 만료 1h 전 메시지
async function v47_buildExpiry1hMessage(env, item) {
  var base = item.base || '?';
  var exchange = item.exchange || '?';
  var entryPrice = null, lastPrice = null;
  var currentPct = null, mfe = null, mae = null;
  
  try {
    var lsRaw = await env.ALERT_KV.get(TRACKING_KEYS.lastSample(item.id));
    if (lsRaw) {
      var ls = JSON.parse(lsRaw);
      lastPrice = ls.price != null ? ls.price : null;
      currentPct = ls.deltaPct != null ? ls.deltaPct : null;
      mfe = ls.mfe != null ? ls.mfe : null;
      mae = ls.mae != null ? ls.mae : null;
    }
  } catch(e) {}
  
  try {
    var metaRaw = await env.ALERT_KV.get(TRACKING_KEYS.meta(item.id));
    if (metaRaw) {
      var mt = JSON.parse(metaRaw);
      entryPrice = mt.openPrice || null;
    }
  } catch(e) {}
  
  var remainMs = (item.windowEnd || 0) - Date.now();
  var remainMin = Math.max(0, Math.round(remainMs / 60000));
  
  var lines = [];
  lines.push('⏰ <b>추적 만료 1시간 전 — ' + escapeHtml(base) + '</b>');
  lines.push('거래소: ' + escapeHtml(exchange) + '  |  추적: 정밀' + v47_modeLabel(item));
  if (entryPrice != null && lastPrice != null) {
    lines.push('시작가: ' + v47_fmtTelePrice(entryPrice, exchange)
      + ' → 현재: ' + v47_fmtTelePrice(lastPrice, exchange));
  }
  if (currentPct != null) {
    var ps = currentPct >= 0 ? '+' : '';
    var mfeStr = (mfe != null) ? ((mfe >= 0 ? '+' : '') + mfe.toFixed(2) + '%') : '-';
    var maeStr = (mae != null) ? (mae.toFixed(2) + '%') : '-';
    lines.push('현재 ' + ps + currentPct.toFixed(2) + '% | MFE ' + mfeStr + ' | MAE ' + maeStr);
  }
  lines.push('잔여: ' + remainMin + '분');
  return lines.join('\n');
}

// 종료 시점 메시지 (finalize 직후 호출, tracking_completed:{id} 사용)
async function v47_buildExpiryEndMessage(env, item) {
  var base = item.base || '?';
  var exchange = item.exchange || '?';
  
  var completed = null;
  try {
    var compRaw = await env.ALERT_KV.get('tracking_completed:' + item.id);
    if (compRaw) completed = JSON.parse(compRaw);
  } catch(e) {}
  
  var lines = [];
  lines.push('🏁 <b>추적 종료 — ' + escapeHtml(base) + '</b>');
  lines.push('거래소: ' + escapeHtml(exchange) + '  |  추적: 정밀' + v47_modeLabel(item));
  
  if (!completed) {
    lines.push('(분석 데이터 없음)');
    return lines.join('\n');
  }
  
  var mfe = completed.mfe != null ? completed.mfe : (completed.maxRise || 0);
  var mae = completed.mae != null ? completed.mae : (completed.maxDrop || 0);
  var closeRet = completed.currentPct != null ? completed.currentPct : (completed.closeReturn || 0);
  var pattern = completed.pattern || '';
  
  // 결과 기준: Success / Watch / Fail / Flat
  var resultType = completed.resultType || calcDeepResultType(mfe, mae);
  var resultLabel = resultType === 'Success' ? '✅ Success'
                  : resultType === 'Watch' ? '🟡 Watch'
                  : resultType === 'Fail' ? '🔴 Fail'
                  : '⚪ Flat';
  
  // 직관 점수 (50 + 트래킹점수 * 2.5)
  var trkScore = completed.score != null ? completed.score : 0;
  var score = 50 + trkScore * 2.5;
  score = Math.max(0, Math.min(100, score));
  var scoreEmoji = score >= 80 ? '🚀 대박'
                 : score >= 60 ? '✨ 쏠쏠'
                 : score >= 40 ? '⚖️ 본전'
                 : score >= 20 ? '📉 손실'
                 : '💥 큰 손실';
  
  lines.push('결과: ' + resultLabel);
  lines.push('최종 점수: ' + score.toFixed(0) + '점 (' + scoreEmoji + ')');
  lines.push('MFE ' + (mfe >= 0 ? '+' : '') + mfe.toFixed(2) + '% | MAE ' + mae.toFixed(2)
    + '% | 종가 ' + (closeRet >= 0 ? '+' : '') + closeRet.toFixed(2) + '%');
  if (pattern) lines.push('패턴: ' + escapeHtml(String(pattern)));
  
  return lines.join('\n');
}

// 발송 또는 sleep_queue 큐
async function v47_sendOrQueue(env, text, type, snapshotId) {
  if (!text) return;
  if (await isInSleepTime(env)) {
    try {
      var raw = await env.ALERT_KV.get('sleep_queue');
      var q = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(q)) q = [];
      q.push({
        type: type,
        text: text,
        snapshotId: snapshotId,
        queuedAt: new Date().toISOString(),
      });
      if (q.length > SLEEP_QUEUE_MAX) q = q.slice(-SLEEP_QUEUE_MAX);
      await env.ALERT_KV.put('sleep_queue', JSON.stringify(q), { expirationTtl: 12 * 3600 });
    } catch(e) {}
  } else {
    try { await sendTelegram(env, text); } catch(e) {}
  }
}

// ══════════════════════════════════════════════════════════════════
// 텔레그램 발송
// ══════════════════════════════════════════════════════════════════
/* [v5.2.6.1] 텔레그램 알람 킬 스위치 (true = 발송 차단 / false = 정상 발송)
 * 재가동: 이 줄을 false 로 바꾸고 wrangler deploy */
var TELEGRAM_KILL_SWITCH = true;

async function sendTelegram(env, text) {
  if (TELEGRAM_KILL_SWITCH) return false;
  if (!env.TG_BOT_TOKEN || !env.TG_CHAT_ID) return false;
  try {
    var res = await fetch('https://api.telegram.org/bot' + env.TG_BOT_TOKEN + '/sendMessage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: env.TG_CHAT_ID, text: text, parse_mode: 'HTML',
        disable_web_page_preview: true,
      })
    });
    var data = await res.json();
    return data.ok === true;
  } catch(e) { return false; }
}

// ══════════════════════════════════════════════════════════════════
// 메시지 빌더 — v3 HTML buildTgMessage 와 1:1 동일 포맷
// ══════════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════════════
// [08] TELEGRAM
// 뉴스 수집, 메시지 조립, 텔레그램 발송
// ════════════════════════════════════════════════════════════════════

async function fetchNewsForCoin(base) {
  // Best Effort: 실패해도 null 반환 (알람은 정상 발송)
  // 반환: { title, url } 또는 null
  try {
    var query = encodeURIComponent(base + ' 코인');
    var url = 'https://news.google.com/rss/search?q=' + query + '&hl=ko&gl=KR&ceid=KR:ko';
    var ctrl = new AbortController();
    var t = setTimeout(function(){ ctrl.abort(); }, 4000);
    try {
      var res = await fetch(url, { signal: ctrl.signal });
      if (!res.ok) return null;
      var text = await res.text();
      // 첫 번째 <item> 블록에서 title, link 추출
      var itemMatch = text.match(/<item>([\s\S]*?)<\/item>/);
      if (!itemMatch) return null;
      var itemXml = itemMatch[1];
      var titleMatch = itemXml.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/);
      var linkMatch = itemXml.match(/<link>([\s\S]*?)<\/link>/);
      if (!titleMatch || !titleMatch[1]) return null;
      var title = titleMatch[1].trim();
      if (title.length > 80) title = title.substring(0, 77) + '...';
      var newsUrl = linkMatch && linkMatch[1] ? linkMatch[1].trim() : null;
      return { title: title, url: newsUrl };
    } finally {
      clearTimeout(t);
    }
  } catch(e) {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════
// renderSnapshotHTML — /s/{id} 모바일 최적화 뷰어
// ═══════════════════════════════════════════════════════════════════
function renderSnapshotHTML(snap, snapshotId) {
  // 등급 색상 테마
  var grade = snap.gradeCode || 'A';
  var themeMap = {
    SPLUS: { primary: '#ffd600', bg: '#1a1600', label: '🔥 S+' },
    S:     { primary: '#ff8c42', bg: '#1a0d05', label: '⭐ S'  },
    A:     { primary: '#ffb347', bg: '#1a1208', label: '🟠 A'  }
  };
  var theme = themeMap[grade] || { primary: '#ccc', bg: '#111', label: grade };

  // 이격도 게이지 (현재가 / 평단 ratio)
  var ratio = parseFloat((snap.currentPhase && snap.currentPhase.ratio) || 1);
  if (isNaN(ratio)) ratio = 1;
  var gaugePercent = Math.max(0, Math.min(100, ((ratio - 1) / 0.15) * 100));
  var gaugeColor = ratio < 1.02 ? '#4ade80' : ratio < 1.08 ? '#fbbf24' : '#ef4444';

  // 기본 값
  var base = snap.base || '?';
  var exchange = snap.exchange || '?';
  var total = snap.total || 0;
  var price = snap.price != null ? snap.price : '-';
  var accCost = snap.accumulationCost || {};
  var tgt = snap.distributionTargets || {};
  var strategyA = snap.strategyA || {};
  var strategyB = snap.strategyB || {};
  var outcome = snap.outcome || null;
  var verified = snap.verifiedAt || null;
  var ts = snap.timestamp || '-';

  // outcome 상태 표시
  var outcomeBadge = '';
  if (outcome) {
    var isOK = outcome.result === 'SUCCESS' || outcome.result === 'success';
    outcomeBadge = '<div class="badge ' + (isOK ? 'ok' : 'fail') + '">'
                 + (isOK ? '✅ SUCCESS' : '❌ FAIL') + '</div>';
  } else {
    outcomeBadge = '<div class="badge pending">⏳ PENDING</div>';
  }

  function fmt(v) {
    if (v == null || v === '') return '-';
    if (typeof v === 'number') return v.toString();
    return String(v);
  }

  function strategyACard() {
    if (!tgt.target1) return '<div class="card">전략 A 데이터 없음</div>';
    var stopA = (snap.box && snap.box.low) ? snap.box.low : '-';
    return '<div class="card strategy">'
         + '<h3>📊 전략 A — 엘더 분할매도</h3>'
         + '<div class="row"><span>1차 (30%)</span><b>' + fmt(tgt.target1) + '</b></div>'
         + '<div class="row"><span>2차 (35%)</span><b>' + fmt(tgt.target2) + '</b></div>'
         + '<div class="row"><span>3차 (35%)</span><b>' + fmt(tgt.target3) + '</b></div>'
         + '<div class="row stop"><span>손절</span><b>' + fmt(stopA) + '</b></div>'
         + '</div>';
  }

  function strategyBCard() {
    if (!snap.atr) return '<div class="card">전략 B 데이터 없음</div>';
    var trail = (snap.atr * 2).toFixed(6);
    var stopB = (snap.box && snap.box.low) ? snap.box.low : '-';
    return '<div class="card strategy">'
         + '<h3>📊 전략 B — ATR 트레일링</h3>'
         + '<div class="row"><span>트레일 폭</span><b>' + trail + ' (ATR×2)</b></div>'
         + '<div class="row stop"><span>손절</span><b>' + fmt(stopB) + '</b></div>'
         + '</div>';
  }

  var escapeAttr = function(s){ return String(s).replace(/[&<>"']/g, function(m){
    return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[m];
  }); };

  return '<!DOCTYPE html>'
  + '<html lang="ko"><head>'
  + '<meta charset="UTF-8">'
  + '<meta name="viewport" content="width=device-width,initial-scale=1.0">'
  + '<title>' + escapeAttr(base) + ' 스냅샷</title>'
  + '<style>'
  + '*{box-sizing:border-box;margin:0;padding:0;}'
  + 'body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;'
  + 'background:' + theme.bg + ';color:#e5e5e5;padding:16px;min-height:100vh;}'
  + '.container{max-width:500px;margin:0 auto;}'
  + '.header{text-align:center;padding:20px 0;}'
  + '.coin{font-size:32px;font-weight:700;color:' + theme.primary + ';}'
  + '.grade{font-size:18px;color:' + theme.primary + ';margin-top:4px;}'
  + '.score{font-size:14px;color:#999;margin-top:4px;}'
  + '.badge{display:inline-block;padding:6px 14px;border-radius:999px;'
  + 'font-size:13px;font-weight:600;margin-top:8px;}'
  + '.badge.ok{background:#16a34a;color:#fff;}'
  + '.badge.fail{background:#dc2626;color:#fff;}'
  + '.badge.pending{background:#525252;color:#fff;}'
  + '.card{background:#1a1a1a;border-radius:12px;padding:16px;margin-bottom:12px;'
  + 'border:1px solid #2a2a2a;}'
  + '.card h3{font-size:14px;color:#aaa;margin-bottom:12px;font-weight:600;}'
  + '.row{display:flex;justify-content:space-between;padding:8px 0;'
  + 'border-bottom:1px solid #222;}'
  + '.row:last-child{border-bottom:none;}'
  + '.row span{color:#999;font-size:13px;}'
  + '.row b{color:#e5e5e5;font-size:14px;font-family:monospace;}'
  + '.row.stop b{color:#ef4444;}'
  + '.gauge-wrap{background:#1a1a1a;border-radius:12px;padding:16px;margin-bottom:12px;'
  + 'border:1px solid #2a2a2a;}'
  + '.gauge-label{display:flex;justify-content:space-between;margin-bottom:8px;font-size:13px;}'
  + '.gauge{height:14px;background:#333;border-radius:7px;overflow:hidden;}'
  + '.gauge-bar{height:100%;background:' + gaugeColor + ';'
  + 'width:' + gaugePercent.toFixed(1) + '%;transition:width 0.4s;}'
  + '.strategy h3{color:' + theme.primary + ';}'
  + '.strategy .row:first-of-type b{color:#4ade80;}'
  + '.footer{text-align:center;color:#555;font-size:11px;margin-top:24px;padding:16px 0;}'
  + '.meta{font-size:11px;color:#666;margin-top:8px;}'
  + '.actions{margin-top:16px;display:grid;grid-template-columns:1fr 1fr;gap:8px;}'
  + '.btn{padding:12px;border:none;border-radius:8px;font-size:14px;font-weight:600;'
  + 'cursor:pointer;color:#fff;}'
  + '.btn-ok{background:#16a34a;}'
  + '.btn-fail{background:#dc2626;}'
  + '.btn:disabled{opacity:0.5;cursor:not-allowed;}'
  + '.result{margin-top:12px;font-size:12px;color:#888;}'
  + 'a{color:' + theme.primary + ';}'
  + '</style></head>'
  + '<body><div class="container">'
  + '<div class="header">'
  + '<div class="coin">' + escapeAttr(base) + '</div>'
  + '<div class="grade">' + theme.label + ' 등급</div>'
  + '<div class="score">점수: ' + total + ' | ' + escapeAttr(exchange) + '</div>'
  + outcomeBadge
  + '</div>'
  + '<div class="gauge-wrap">'
  + '<div class="gauge-label"><span>현재 이격도</span><b>' + ratio.toFixed(3) + 'x</b></div>'
  + '<div class="gauge"><div class="gauge-bar"></div></div>'
  + '</div>'
  + '<div class="card">'
  + '<h3>💰 가격 정보</h3>'
  + '<div class="row"><span>평단 (중심)</span><b>' + fmt(accCost.center) + '</b></div>'
  + '<div class="row"><span>평단 범위</span><b>' + fmt(accCost.low) + ' ~ ' + fmt(accCost.high) + '</b></div>'
  + '<div class="row"><span>현재가</span><b>' + fmt(price) + '</b></div>'
  + '</div>'
  + '<div class="card">'
  + '<h3>🎯 목표가</h3>'
  + '<div class="row"><span>1차</span><b>' + fmt(tgt.target1) + '</b></div>'
  + '<div class="row"><span>2차</span><b>' + fmt(tgt.target2) + '</b></div>'
  + '<div class="row"><span>3차</span><b>' + fmt(tgt.target3) + '</b></div>'
  + '</div>'
  + strategyACard()
  + strategyBCard()
  + (outcome ? ('<div class="card">'
      + '<h3>📝 결과 기록</h3>'
      + '<div class="row"><span>결과</span><b>' + escapeAttr(outcome.result) + '</b></div>'
      + (outcome.maxRise != null ? '<div class="row"><span>최대 상승</span><b>+' + outcome.maxRise + '%</b></div>' : '')
      + (outcome.maxDrop != null ? '<div class="row"><span>최대 하락</span><b>' + outcome.maxDrop + '%</b></div>' : '')
      + (snap.highestPriceAfterAlert != null ? '<div class="row"><span>최고가</span><b>' + snap.highestPriceAfterAlert + '</b></div>' : '')
      + (outcome.note ? '<div class="row"><span>메모</span><b>' + escapeAttr(outcome.note) + '</b></div>' : '')
      + (verified ? '<div class="meta">검증일: ' + escapeAttr(verified) + '</div>' : '')
      + '</div>') : ('<div class="card">'
      + '<h3>📝 결과 기록 (수동)</h3>'
      + '<div class="result">outcome 미기록 — API로 PUT 요청하여 결과 기록 가능</div>'
      + '<div class="meta">PUT /snapshot/' + escapeAttr(snapshotId) + '/outcome</div>'
      + '</div>'))
  + '<div class="footer">'
  + '🆔 ' + escapeAttr(snapshotId) + '<br>'
  + '⏱ ' + escapeAttr(ts)
  + '</div>'
  + '</div></body></html>';
}

function buildMessage(coin, alertType, snapshotId, scannerUrl, newsData, snapshot, buildTag) {
  var rep = coin.representative;
  var exchange = rep.exchange;
  var exists = (coin.existsIn||[rep.exchange]).join(' / ');
  var gradeDisplay = rep.gradeLabel || rep.gradeCode;
  var accCost = rep.accumulationCost || {};
  var phase = rep.currentPhase || {};
  var tgt = rep.distributionTargets || {};
  var vol = rep.vol || {};
  var obv = rep.obv || {};
  var smc = rep.smc || {};
  var mfi = typeof rep.mfi === 'number' ? rep.mfi : null;
  var rsi = typeof rep.rsi === 'number' ? rep.rsi : null;

  // 헤더 타이틀
  var headerTitle;
  switch (alertType) {
    case 'ENTRY':          headerTitle = gradeDisplay + '등급 진입'; break;
    case 'PREPUMP_STRONG': headerTitle = '🟣 <b>PRE-PUMP 강함</b>'; break;
    case 'PREPUMP_WEAK':   headerTitle = '🟣 <b>PRE-PUMP 약함</b>'; break;
    case 'S':              headerTitle = gradeDisplay + '등급 진입'; break;
    case 'A':              headerTitle = '🟠 A등급 진입'; break;
    default:               headerTitle = '📊 알림';
  }

  // ENTRY READY 조건 (절대 수정 금지)
  var entryReadyShown = rep.isEntryReady && rep.finalEntryAllowed && !rep.fakePump && !rep.lateEntry;

  // 상태 라인 (ENTRY 먼저, PRE-PUMP 아래)
  var statusLines = [];
  if (entryReadyShown) statusLines.push('✅ <b>ENTRY READY</b>');
  if (rep.prePump)     statusLines.push('🟣 PRE-PUMP 감지');

  // 지표 상세
  var indLines = [];
  if (rsi !== null)    indLines.push('• RSI: ' + rsi.toFixed(1));
  if (vol.ratio)       indLines.push('• 거래량: ' + vol.ratio.toFixed(2) + 'x');
  if (vol.accel)       indLines.push('• 속도: ' + vol.accel.toFixed(2) + 'x');
  if (obv.trend) {
    var obvArrow = obv.trend === 'up' ? '↑ 상승' : obv.trend === 'down' ? '↓ 하락' : '→ 횡보';
    indLines.push('• OBV: ' + obvArrow);
  }

  // MFI
  var mfiLine = '';
  if (mfi !== null) {
    var mfiLabel = mfi >= 80 ? '과매수' : mfi >= 60 ? '강세' : mfi >= 40 ? '중립' : mfi >= 20 ? '약세' : '과매도';
    mfiLine = '🧠 MFI: ' + mfi.toFixed(1) + ' (' + mfiLabel + ')';
  }

  // SMC
  var smcLine = '';
  if (smc && smc.label) {
    var smcEmoji = smc.direction === 'up' ? '🚀' : smc.direction === 'down' ? '📉' : '➡️';
    smcLine = '📉 SMC:\n' + smcEmoji + ' ' + escapeHtml(smc.label);
  } else if (smc && smc.desc) {
    smcLine = '📉 SMC:\n' + escapeHtml(smc.desc);
  }

  // 뉴스 — URL 있을 때만 출력, 없으면 라인 전체 숨김
  var newsLine = '';
  if (newsData && newsData.title && newsData.url) {
    newsLine = '📰 뉴스: <a href="' + escapeHtml(newsData.url) + '">'
             + escapeHtml(newsData.title) + '</a>';
  }

  // 평단/현재가/목표
  var costLine = (accCost.center && accCost.center > 0)
    ? '📍 평단: '+formatPriceByExchange(accCost.low, exchange)
      +'~'+formatPriceByExchange(accCost.high, exchange)
      +' (중심 '+formatPriceByExchange(accCost.center, exchange)
      +' / '+(accCost.confidence||'보통')+')'
    : '';
  var phaseLine = phase.ratio
    ? '📈 현재: '+formatPriceByExchange(rep.price, exchange)+' ('+phase.ratio+'x → '+(phase.label||'')+')'
    : '';
  var tgtLine = (tgt.target1 && tgt.target1 > 0)
    ? '🎯 1차 '+formatPriceByExchange(tgt.target1, exchange)
      +' / 2차 '+formatPriceByExchange(tgt.target2, exchange)
      +' / 3차 '+formatPriceByExchange(tgt.target3, exchange)
    : '';

  // 액션
  var actionLine = '🎯 액션: ' + escapeHtml(rep.actionDesc || rep.action || '관찰');

  // 경고
  var warnLine = '';
  if (rep.fakePump)       warnLine = '⚠️ fakePump 감지 — ENTRY 차단됨';
  else if (rep.lateEntry) warnLine = '⏳ 늦은 진입 — 눌림 대기';
  else if (coin.priceGap !== null && coin.priceGap !== undefined) {
    warnLine = '⚠️ 가격 괴리 '+(coin.priceGap>0?'+':'')+coin.priceGap.toFixed(1)+'% ('+escapeHtml(coin.gapStatus||'')+')';
  }

  // ━━━ 전략 A/B 상세 (snapshot에서 실제 필드 사용) ━━━
  var stratLines = [];
  if (snapshot && snapshot.strategyA) {
    var sA = snapshot.strategyA;
    stratLines.push('📊 전략 A (엘더 분할매도)');
    if (sA.target1 != null) stratLines.push('  1차(' + (sA.exit1Pct||30) + '%): ' + formatPriceByExchange(sA.target1, exchange));
    else                    stratLines.push('  1차: 데이터 없음');
    if (sA.target2 != null) stratLines.push('  2차(' + (sA.exit2Pct||35) + '%): ' + formatPriceByExchange(sA.target2, exchange));
    else                    stratLines.push('  2차: 데이터 없음');
    if (sA.target3 != null) stratLines.push('  3차(35%): ' + formatPriceByExchange(sA.target3, exchange));
    else                    stratLines.push('  3차: 데이터 없음');
    if (sA.stopLoss != null) stratLines.push('  손절: ' + formatPriceByExchange(sA.stopLoss, exchange));
    else                     stratLines.push('  손절: 계산 불가');
  }
  if (snapshot && snapshot.strategyB) {
    var sB = snapshot.strategyB;
    if (stratLines.length > 0) stratLines.push('');
    stratLines.push('📊 전략 B (ATR 트레일링)');
    if (sB.error) {
      stratLines.push('  ' + sB.error);
    } else {
      if (sB.trailAmount != null) stratLines.push('  트레일 폭: ' + formatPriceByExchange(sB.trailAmount, exchange) + ' (ATR×2)');
      else                        stratLines.push('  트레일 폭: 계산 불가');
      if (sB.stopLoss != null) stratLines.push('  손절: ' + formatPriceByExchange(sB.stopLoss, exchange));
      else                     stratLines.push('  손절: 계산 불가');
    }
  }

  // 스냅샷 링크 — /s/{id} HTML 뷰어 (Phase 2)
  var snapLine = '';
  if (snapshotId) {
    var snapUrl = 'https://auto-alert-worker-v3.neosiwon.workers.dev/s/' + snapshotId;
    snapLine = '🆔 ' + snapshotId + '\n🔗 <a href="'+snapUrl+'">스냅샷 보기</a>';
  }

  // 최종 조립
  var SEP = '━━━━━━━━━━━━━━━━━━';
  var lines = [];

  // 1. 헤더 (대표거래소 포함)
  lines.push('🚀 <b>'+escapeHtml(coin.base)+'</b>  '+headerTitle);
  lines.push('🏪 거래소: ' + escapeHtml(exists));
  lines.push('');

  // 2. 상태 (ENTRY → PRE-PUMP)
  if (statusLines.length > 0) {
    statusLines.forEach(function(s){ lines.push(s); });
    lines.push('');
  }

  // 3. 등급/점수
  lines.push(SEP);
  lines.push('📊 등급: '+gradeDisplay+'  |  점수: '+rep.total);
  lines.push('');

  // 4. 지표
  if (indLines.length > 0) {
    indLines.forEach(function(i){ lines.push(i); });
    lines.push('');
  }

  // 5. MFI
  if (mfiLine) { lines.push(mfiLine); lines.push(''); }

  // 6. SMC
  if (smcLine) { lines.push(smcLine); lines.push(''); }

  // 7. 뉴스 — URL 있을 때만 표시
  if (newsLine) {
    lines.push(newsLine);
    lines.push('');
  }

  // 8. 평단/현재/목표
  lines.push(SEP);
  if (costLine)  lines.push(costLine);
  if (phaseLine) lines.push(phaseLine);
  if (tgtLine)   lines.push(tgtLine);
  if (warnLine)  lines.push(warnLine);
  lines.push('');

  // 9. 액션
  lines.push(actionLine);
  lines.push('');

  // 10. 전략 A/B
  if (stratLines.length > 0) {
    lines.push(SEP);
    stratLines.forEach(function(s){ lines.push(s); });
    lines.push('');
  }

  // 11. 스냅샷
  if (snapLine) {
    lines.push(SEP);
    lines.push(snapLine);
  }

  // 12. 경고문 + 빌드 태그
  lines.push('');
  lines.push('<i>※ 투자 판단은 본인 책임</i>');
  if (buildTag) {
    lines.push('<i>🔧 build: ' + escapeHtml(buildTag) + '</i>');
  }

  return lines.join('\n');
}

// ══════════════════════════════════════════════════════════════════
// 스냅샷 ID 생성
// ══════════════════════════════════════════════════════════════════
function genSnapshotId(base, exchange) {
  var now = new Date();
  var kst = new Date(now.getTime() + 9*3600*1000);
  var ymd = kst.getUTCFullYear()
    + ('0'+(kst.getUTCMonth()+1)).slice(-2)
    + ('0'+kst.getUTCDate()).slice(-2);
  var hm = ('0'+kst.getUTCHours()).slice(-2) + ('0'+kst.getUTCMinutes()).slice(-2);
  return base + '_' + ymd + '_' + hm + '_' + (exchange||'');
}

// ══════════════════════════════════════════════════════════════════
// 알람 처리 — HTML processOneCoinAlert 와 1:1 동일
// ══════════════════════════════════════════════════════════════════
async function processAlert(env, coin) {
  try {
    var rep = coin.representative;

    
    // ═══ Phase 3 프리필터 (Q1=B, Q2=A 엄격 정책) ═══
    // 지시서: score < 3 이면 정밀 분석 자체를 건너뜀
    var pfResult = calcPrefilterScore(coin);
    if (!pfResult.pass) {
      return {
        sent: false,
        reason: 'prefilter_rejected',
        prefilterScore: pfResult.score,
        prefilterDetails: pfResult.details
      };
    }
    var base = coin.base;
    var grade = rep.gradeCode;
    var score = rep.total;

    // 1차: 코어 필터
    if (grade === 'B' || grade === 'C') return { sent: false, reason: 'grade' };
    if (!rep.prePump && !rep.isEntryReady) return { sent: false, reason: 'no signal' };

    // 2차: 설명 레이어 필터
    var accStr  = rep.accumulationStrength || {};
    var accCost = rep.accumulationCost     || {};
    var cpRatio = rep.currentPhase ? rep.currentPhase.ratio : 1.0;

    var btcPenalty = (coin.btcFilter && coin.btcFilter.penalty) ? coin.btcFilter.penalty : 0;
    if (btcPenalty >= 2 && score < 4) return { sent: false, reason: 'BTC' };

    // 추격 차단 (fallback 금지)
    if (cpRatio > ENTRY_THRESHOLD) return { sent: false, reason: 'chase' };
    if (accStr.label === '참고 불가') return { sent: false, reason: 'noref' };

    // 알람 타입 결정
    var toSend = null;
    var finalAllowed = rep.finalEntryAllowed === true;
    var repFake = rep.fakePump === true;
    var repLate = rep.lateEntry === true;

    if (rep.isEntryReady && finalAllowed && !repFake && !repLate
        && await canSend(env, base, 'ENTRY', grade, score)) {
      toSend = 'ENTRY';
    }
    if (!toSend && rep.prePump) {
      var ppScore = accStr.score || 0;
      if (!repFake && ppScore >= 5 && await canSend(env, base, 'PREPUMP_STRONG', grade, score)) {
        toSend = 'PREPUMP_STRONG';
      } else if (await canSend(env, base, 'PREPUMP_WEAK', grade, score)) {
        toSend = 'PREPUMP_WEAK';
      }
    }
    if (!toSend && (grade === 'SPLUS' || grade === 'S')
        && await canSend(env, base, 'S', grade, score)) {
      toSend = 'S';
    }
    if (!toSend && grade === 'A'
        && await canSend(env, base, 'A', grade, score)) {
      toSend = 'A';
    }

    if (!toSend) return { sent: false, reason: 'cooldown' };

    // 스냅샷 생성
    var snapshotId = genSnapshotId(base, rep.exchange);
    var snapshot = buildSnapshotData(coin, rep, toSend, snapshotId);
    await saveSnapshotKV(env, snapshot);
    
    // [Phase 3.2-A] 분석기 추적 자동 시작 (원칙 1: 사후 기록)
    // saveSnapshotKV 직후 호출 → Tier 분류 + 한도 검사 + active 등록
    try { await startTracking(env, snapshot); } catch(e) { /* 추적 실패는 알람 발송 막지 않음 */ }

    // 수면 시간 체크 — 큐 저장
    if (await isInSleepTime(env)) {
      await pushSleepQueue(env, coin, toSend, snapshotId);
      await setCooldown(env, base, toSend, grade, score); // 쿨다운은 즉시 기록
      return { sent: false, reason: 'sleep queued', snapshotId: snapshotId };
    }

    // 텔레그램 발송
    var news = null;
  try { news = await fetchNewsForCoin(coin.base); } catch(e) {}
  var msg = buildMessage(coin, toSend, snapshotId, env.SCANNER_URL || '', news, snapshot, BUILD_TAG);
    
    // [Phase 4.7 공사 4 — 6-5] 추적 모드 라벨 후처리 (buildMessage 본체 무손상 — 동결 함수)
    // rep 객체에 isWatchlist/isAutoPrecise 박제 없으므로 alertSnapshot 또는 watchlist_global 1번 read
    try {
      var v47lbl_rep = coin.representative || {};
      var v47lbl_isWatch = false;
      var v47lbl_isAutoPrecise = false;
      // alertSnapshot 박제값 우선 (1689~1692줄에서 박제됨)
      if (snapshot && snapshot.alertSnapshot) {
        v47lbl_isWatch = !!snapshot.alertSnapshot.isWatchlistAtAlarm;
        v47lbl_isAutoPrecise = !!snapshot.alertSnapshot.isAutoPreciseAtAlarm;
      }
      // fallback: watchlist_global 매칭
      if (!v47lbl_isWatch) {
        try {
          var v47lbl_wlRaw = await env.ALERT_KV.get('watchlist_global');
          if (v47lbl_wlRaw) {
            var v47lbl_wlObj = JSON.parse(v47lbl_wlRaw);
            if (v47lbl_wlObj && Array.isArray(v47lbl_wlObj.bases)) {
              v47lbl_isWatch = v47lbl_wlObj.bases.indexOf(String(coin.base || '').toUpperCase()) >= 0;
            }
          }
        } catch(v47lbl_we) {}
      }
      // 라벨 후처리 (헤더 첫 줄 끝에 추가)
      var v47lbl_label = '';
      if (v47lbl_isWatch) v47lbl_label = ' (관심)';
      else if (v47lbl_isAutoPrecise) v47lbl_label = ' (자동)';
      if (v47lbl_label) {
        // 첫 줄 (헤더 타이틀)에 라벨 추가
        var v47lbl_idx = msg.indexOf('\n');
        if (v47lbl_idx > 0) {
          msg = msg.substring(0, v47lbl_idx) + v47lbl_label + msg.substring(v47lbl_idx);
        } else {
          msg = msg + v47lbl_label;
        }
      }
    } catch(v47lbl_e) { /* 라벨 후처리 실패는 무시 — 기존 메시지 그대로 */ }
    
    var ok = await sendTelegram(env, msg);
    if (ok) {
      await setCooldown(env, base, toSend, grade, score);
      return { sent: true, type: toSend, snapshotId: snapshotId };
    }
    return { sent: false, reason: 'tg failed' };
  } catch(e) {
    return { sent: false, reason: 'error: ' + e.message };
  }
}

function buildSnapshotData(coin, rep, alertType, snapshotId) {
  var strategyB = (function() {
    var a = Number(rep.atr || 0);
    if (!a || isNaN(a) || !isFinite(a) || a <= 0)
      return { type:'atr_trailing', error:'ATR 데이터 부족', trailAmount: null };
    return { type:'atr_trailing', trailAmount: parseFloat((a * 2).toFixed(6)),
             stopLoss: rep.box ? rep.box.low : null };
  })();

  return {
    snapshotId: snapshotId,
    timestamp: new Date().toISOString(),
    alertType: alertType,
    base: coin.base, exchange: rep.exchange,
    existsIn: coin.existsIn || [rep.exchange],
    total: rep.total, gradeCode: rep.gradeCode, scoreSummary: rep.scoreSummary,
    accumulationCost: rep.accumulationCost || null,
    currentPhase: rep.currentPhase || null,
    distributionTargets: rep.distributionTargets || null,
    analysis: rep.analysis || null,
    riskDetails: rep.riskDetails || null,
    actionDesc: rep.actionDesc || '',
    fakePump: rep.fakePump || false, lateEntry: rep.lateEntry || false,
    priceGap: coin.priceGap || null, gapStatus: coin.gapStatus || '',
    stopLoss: rep.box ? rep.box.low : null,
    strategyA: {
      type: 'elder_split',
      target1: (rep.distributionTargets && rep.distributionTargets.target1) || null,
      target2: (rep.distributionTargets && rep.distributionTargets.target2) || null,
      target3: (rep.distributionTargets && rep.distributionTargets.target3) || null,
      exit1Pct: 30, exit2Pct: 35,
      stopLoss: rep.box ? rep.box.low : null,
    },
    strategyB: strategyB,
    source: 'worker',  // HTML 알람과 구분
    outcome: null, failReason: null, verifiedAt: null,
    maxRise: null, maxDrop: null,
  };
}

// ══════════════════════════════════════════════════════════════════
// 메인 스캔 — Cron에서 호출
// ══════════════════════════════════════════════════════════════════
async function runScan(env) {
  var proxy = env.PROXY_URL;
  if (!proxy) return { error: 'PROXY_URL not set' };
  proxy = proxy.replace(/\/$/, '');

  // 1. 환율 조회
  var usdtKrw = await fetchUSDTKRW(proxy);

  // 2. BTC 필터
  var btcFilter = { trend: 'neutral', penalty: 0 };
  try {
    var btcKl = await fetchJson(proxy + '/upbit/candles?market=KRW-BTC&count=80', 7000);
    var btcCandles = normalizeCandles(btcKl.candles || btcKl);
    btcFilter = calcBTCFilter(btcCandles);
  } catch(e) {}

  // 3. 거래소별 병렬 수집
  var results = await Promise.all(
    ENABLE_BINANCE
      ? [fetchUpbitData(proxy), fetchBithumbData(proxy), fetchBinanceData(proxy)]
      : [fetchUpbitData(proxy), fetchBithumbData(proxy)]
  );
  var allCandidates = [].concat(results[0], results[1], results[2]);
  if (!allCandidates.length) return { error: 'no candidates' };

  // 4. 거래소별 독립 분석
  var exAnalyzed = { UPBIT: [], BITHUMB: [], BINANCE: [] };
  for (var i = 0; i < allCandidates.length; i++) {
    try {
      var r = analyzeSymbolForExchange(allCandidates[i], btcFilter);
      if (r.total < MIN_SCORE) continue;
      exAnalyzed[r.exchange].push(r);
    } catch(e) {}
  }

  // 5. 코인 단위 통합 + 대표 거래소 선정
  var coinMap = {};
  ['UPBIT', 'BITHUMB', 'BINANCE'].forEach(function(ex) {
    exAnalyzed[ex].forEach(function(r) {
      if (!coinMap[r.base]) coinMap[r.base] = [];
      coinMap[r.base].push(r);
    });
  });

  var coins = [];
  Object.keys(coinMap).forEach(function(base) {
    var exList = coinMap[base];
    var rep = selectRepresentative(exList);
    if (rep.total < MIN_SCORE) return;
    var sync = calcSyncStatus(exList);

    var upbitEx = null, binanceEx = null;
    exList.forEach(function(ex){
      if (ex.exchange === 'UPBIT')   upbitEx   = ex;
      if (ex.exchange === 'BINANCE') binanceEx = ex;
    });
    var gap = calcPriceGap(
      upbitEx   ? upbitEx.price   : null,
      binanceEx ? binanceEx.price : null,
      usdtKrw || 1350
    );

    coins.push({
      base: base, representative: rep, exchanges: exList,
      existsIn: exList.map(function(e){return e.exchange;}).sort(),
      syncStatus: sync, priceGap: gap.gap, gapStatus: gap.gapStatus,
      btcFilter: btcFilter,
    });
  });

  // 6. 정렬 (점수 높은 순)
  coins.sort(function(a,b){ return b.representative.total - a.representative.total; });

  // 7. 알람 발송 (상위 20개만 처리 — 과도한 KV 호출 방지)
  var processed = [];
  for (var j = 0; j < Math.min(coins.length, 20); j++) {
    var result = await processAlert(env, coins[j]);
    processed.push({ base: coins[j].base, result: result });
    await new Promise(function(r){setTimeout(r, 300);}); // 텔레그램 rate limit 여유
  }

  // 8. 수면 큐 일괄 발송 (아침 시간대면)
  await flushSleepQueue(env);

  return {
    scanned: allCandidates.length,
    coins: coins.length,
    processed: processed,
    btcTrend: btcFilter.trend,
    usdtKrw: usdtKrw,
  };
}

// ══════════════════════════════════════════════════════════════════
// HTTP 엔드포인트 핸들러
// ══════════════════════════════════════════════════════════════════
async function handleRequest(request, env) {
  var url = new URL(request.url);
  var path = url.pathname;

  // CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    });
  }

  var cors = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  try {
    // ═══════════════════════════════════════════════════════════════
    // Phase 3.5 — Telegram Inbound Webhook
    // 
    // POST /telegram/webhook
    //   Telegram Bot API가 호출. 사용자가 봇에게 보낸 명령 처리.
    //   보안: chat_id 일치 + secret_token 헤더 검증
    //
    // 지원 명령:
    //   /sleep on     강제 수면
    //   /sleep off    수면 비활성
    //   /sleep auto   시간대 자동
    //   /sleep status 상태 조회
    // ═══════════════════════════════════════════════════════════════
    if (path === '/telegram/webhook') {
      try {
        // 1) secret_token 검증 (설정된 경우)
        if (env.TG_WEBHOOK_SECRET) {
          var hdr = request.headers.get('X-Telegram-Bot-Api-Secret-Token') || '';
          if (hdr !== env.TG_WEBHOOK_SECRET) {
            return new Response('forbidden', { status: 403 });
          }
        }

        // 2) body 파싱
        var update;
        try { update = await request.json(); } catch(e) {
          return new Response('bad request', { status: 400 });
        }
        var msg = update && update.message;
        if (!msg || !msg.text) {
          return new Response(JSON.stringify({ ok: true, skipped: 'no_text' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        // 3) chat_id 검증
        var fromChatId = msg.chat && msg.chat.id;
        var allowedChatId = env.TG_CHAT_ID;
        if (!allowedChatId || String(fromChatId) !== String(allowedChatId)) {
          // 알림 없이 403 (공격자에게 힌트 안 줌)
          return new Response('forbidden', { status: 403 });
        }

        // 4) 명령 파싱
        var text = String(msg.text || '').trim();
        var replyText = '';

        // /sleep <sub>
        var sleepMatch = text.match(/^\/sleep(?:\s+(on|off|auto|status))?(?:\s+|$)/i);
        if (sleepMatch) {
          var sub = (sleepMatch[1] || 'status').toLowerCase();

          if (sub === 'on') {
            await env.ALERT_KV.put('sleep_mode_override', 'on');
            replyText = '😴 <b>강제 수면 모드 ON</b>\n'
                      + '→ 알람이 즉시 발송되지 않고 큐에 저장됩니다.\n'
                      + '→ 해제: <code>/sleep auto</code> 또는 <code>/sleep off</code>';
          } else if (sub === 'off') {
            await env.ALERT_KV.put('sleep_mode_override', 'off');
            replyText = '🔔 <b>수면 비활성 OFF</b>\n'
                      + '→ 24시간 내내 알람이 즉시 발송됩니다.\n'
                      + '→ 해제: <code>/sleep auto</code>';
          } else if (sub === 'auto') {
            await env.ALERT_KV.delete('sleep_mode_override');
            replyText = '⏰ <b>시간대 자동 복귀</b>\n'
                      + '→ 23:00~08:00 KST 에만 수면 모드 적용\n'
                      + '→ 기본 모드입니다.';
          } else {
            // status
            var override = await env.ALERT_KV.get('sleep_mode_override');
            var effective = await isInSleepTime(env);
            var nowH = (new Date().getUTCHours() + 9) % 24;
            var modeLabel = override === 'on' ? '😴 강제 수면'
                          : override === 'off' ? '🔔 수면 비활성'
                          : '⏰ 시간대 자동';
            replyText = '📊 <b>수면 모드 상태</b>\n\n'
                      + '현재 모드: ' + modeLabel + '\n'
                      + '실효 상태: ' + (effective ? '😴 수면 중' : '🔔 알람 직송') + '\n'
                      + '현재 시각: ' + nowH + '시 KST\n\n'
                      + '<b>명령어</b>:\n'
                      + '<code>/sleep on</code>  강제 수면\n'
                      + '<code>/sleep off</code> 수면 비활성\n'
                      + '<code>/sleep auto</code> 시간대 자동';
          }
        }
        // /help
        else if (/^\/help(\s|$)/i.test(text) || /^\/start(\s|$)/i.test(text)) {
          replyText = '🤖 <b>Crypto Scanner Bot</b>\n\n'
                    + '<b>수면 모드 제어</b>\n'
                    + '<code>/sleep on</code>  강제 수면 (알람 큐에 저장)\n'
                    + '<code>/sleep off</code> 수면 비활성 (24시간 직송)\n'
                    + '<code>/sleep auto</code> 시간대 자동 (23-08 KST)\n'
                    + '<code>/sleep status</code> 현재 상태 조회\n\n'
                    + '<b>도움말</b>\n'
                    + '<code>/help</code> 이 메시지\n\n'
                    + '<i>🔧 build: ' + BUILD_TAG + '</i>';
        }
        // 미지원 명령
        else if (text.startsWith('/')) {
          replyText = '❓ 미지원 명령입니다. <code>/help</code> 를 입력하세요.';
        }
        // 일반 메시지는 무시
        else {
          return new Response(JSON.stringify({ ok: true, skipped: 'not_command' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        // 5) 답장 전송
        if (replyText) {
          await sendTelegram(env, replyText);
        }

        return new Response(JSON.stringify({ ok: true, handled: text.split(' ')[0] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      } catch(e) {
        // 에러 삼킴 (Telegram이 재시도하지 않도록 200 반환)
        return new Response(JSON.stringify({ ok: false, error: e.message }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // 수동 스캔 트리거
    if (path === '/scan' || path === '/run') {
      var result = await runScan(env);
      return new Response(JSON.stringify(result), { headers: cors });
    }

    // 스냅샷 저장 — HTML이 POST로 호출
    if (path === '/snapshot' && request.method === 'POST') {
      var snap = await request.json();
      if (!snap || !snap.snapshotId) {
        return new Response(JSON.stringify({ error: 'invalid snapshot' }),
          { status: 400, headers: cors });
      }
      snap.source = snap.source || 'html';
      var ok = await saveSnapshotKV(env, snap);
      
      // [Phase 3.2-A] HTML 경로 알람도 분석기 추적 자동 시작
      try { await startTracking(env, snap); } catch(e) { /* 추적 실패는 응답 막지 않음 */ }
      
      return new Response(JSON.stringify({ ok: ok, id: snap.snapshotId }),
        { headers: cors });
    }

    // 스냅샷 조회
    if (path.startsWith('/snapshot/') && request.method === 'GET') {
      var id = path.replace('/snapshot/', '');
      var raw = await env.ALERT_KV.get('snap_' + id);
      if (!raw) return new Response(JSON.stringify({ error: 'not found' }),
        { status: 404, headers: cors });
      return new Response(raw, { headers: cors });
    }

    // ═══════════════════════════════════════════════════════════════
    // [Phase 4.7 공사 4 — 6-2] POST /tracking/end-watch-mode/{base}
    // 관심 OFF 모달 [확인] 시 호출
    // 1. watchlist_global 에서 base 제거
    // 2. 해당 base 의 active 7일 추적 모두 강제 finalize
    // 3. 새 24h 표준 추적 등록 (HTML 전달 entryPrice)
    // body: { exchanges: [{ exchange, entryPrice, prevSnapshotId }] }
    // ═══════════════════════════════════════════════════════════════
    if (path.startsWith('/tracking/end-watch-mode/') && request.method === 'POST') {
      var v47ew_base = path.replace('/tracking/end-watch-mode/', '').toUpperCase();
      if (!v47ew_base) {
        return new Response(JSON.stringify({ error: 'base required' }),
          { status: 400, headers: cors });
      }
      
      // body 파싱
      var v47ew_body = {};
      try {
        var v47ew_text = await request.text();
        if (v47ew_text) v47ew_body = JSON.parse(v47ew_text);
      } catch(v47ew_be) {}
      var v47ew_exchanges = (v47ew_body && Array.isArray(v47ew_body.exchanges)) ? v47ew_body.exchanges : [];
      
      // 1. watchlist 에서 제거
      try {
        var v47ew_rawWl = await env.ALERT_KV.get('watchlist_global');
        var v47ew_wl = v47ew_rawWl ? JSON.parse(v47ew_rawWl) : { bases: [], updatedAt: 0 };
        if (!v47ew_wl || !Array.isArray(v47ew_wl.bases)) v47ew_wl = { bases: [], updatedAt: 0 };
        v47ew_wl.bases = v47ew_wl.bases.filter(function(b){ return b !== v47ew_base; });
        v47ew_wl.updatedAt = Date.now();
        await env.ALERT_KV.put('watchlist_global', JSON.stringify(v47ew_wl),
          { expirationTtl: 86400 * 365 });
      } catch(v47ew_we) {}
      
      // 2. active 에서 해당 base 의 7일 추적 검색
      var v47ew_rawAct = await env.ALERT_KV.get(TRACKING_KEYS.active);
      var v47ew_act = v47ew_rawAct ? JSON.parse(v47ew_rawAct) : [];
      if (!Array.isArray(v47ew_act)) v47ew_act = [];
      
      var v47ew_finalizeIds = [];
      var v47ew_remaining = [];
      for (var v47ew_i = 0; v47ew_i < v47ew_act.length; v47ew_i++) {
        var v47ew_a = v47ew_act[v47ew_i];
        if (String(v47ew_a.base || '').toUpperCase() === v47ew_base
            && v47ew_a.trackingMode === 'deep') {
          v47ew_finalizeIds.push(v47ew_a.id);
        } else {
          v47ew_remaining.push(v47ew_a);
        }
      }
      
      // 3. 새 24h 표준 추적 등록 (HTML 전달 exchanges 기준)
      var v47ew_now = Date.now();
      var v47ew_newTrackings = [];
      for (var v47ew_x = 0; v47ew_x < v47ew_exchanges.length; v47ew_x++) {
        var v47ew_eInfo = v47ew_exchanges[v47ew_x];
        if (!v47ew_eInfo || !v47ew_eInfo.exchange || !v47ew_eInfo.entryPrice) continue;
        
        var v47ew_newId = v47ew_base + '_24STD_' + v47ew_eInfo.exchange + '_' + v47ew_now;
        var v47ew_windowEnd = v47ew_now + 24 * 3600 * 1000;
        
        // meta 박제
        var v47ew_newMeta = {
          snapshotId: v47ew_newId,
          base: v47ew_base,
          exchange: v47ew_eInfo.exchange,
          tier: 'B',
          tierAssignedAt: v47ew_now,
          windowStart: v47ew_now,
          windowEnd: v47ew_windowEnd,
          openPrice: v47ew_eInfo.entryPrice,
          trackingMode: 'standard',
          windowDays: 1,
          status: 'active',
          isWatchlistAtAlarm: false,
          isAutoPreciseAtAlarm: false,
          sCount24AtAlarm: 0,
          aCount24AtAlarm: 0,
          tierARejected: false,
          gradeCode: null,
          gradeLabel: null,
          trackingModeReason: 'watch-off-restart-24h',
        };
        try {
          await env.ALERT_KV.put(TRACKING_KEYS.meta(v47ew_newId), JSON.stringify(v47ew_newMeta),
            { expirationTtl: 86400 * 30 });
        } catch(v47ew_me) { continue; }
        
        // active 에 push
        v47ew_remaining.push({
          id: v47ew_newId,
          tier: 'B',
          tierAssignedAt: v47ew_now,
          windowEnd: v47ew_windowEnd,
          base: v47ew_base,
          exchange: v47ew_eInfo.exchange,
          gradeCode: null,
          gradeLabel: null,
          startedAt: v47ew_now,
          trackingMode: 'standard',
          windowDays: 1,
          isWatchlist: false,
          isAutoPrecise: false,
          tierARejected: false,
          sCount24: 0,
          aCount24: 0,
        });
        v47ew_newTrackings.push(v47ew_newId);
      }
      
      // 4. active 갱신 (7일 추적 제거 + 새 24h 추가)
      try {
        await env.ALERT_KV.put(TRACKING_KEYS.active, JSON.stringify(v47ew_remaining),
          { expirationTtl: 86400 * 30 });
      } catch(v47ew_ae) {}
      
      // 5. 7일 추적 강제 finalize (이전 데이터 → 분석 완료 이동)
      var v47ew_finalizedOk = 0;
      for (var v47ew_f = 0; v47ew_f < v47ew_finalizeIds.length; v47ew_f++) {
        try {
          var v47ew_fRes = await finalizeTracking(env, v47ew_finalizeIds[v47ew_f]);
          if (v47ew_fRes && v47ew_fRes.ok) v47ew_finalizedOk++;
        } catch(v47ew_fe) {}
      }
      
      return new Response(JSON.stringify({
        ok: true,
        base: v47ew_base,
        finalized: v47ew_finalizedOk,
        finalizeRequested: v47ew_finalizeIds.length,
        newTrackings: v47ew_newTrackings,
      }), { headers: cors });
    }

    // ═══════════════════════════════════════════════════════════════
    // [Phase 3.2-A] 분석기 API (Tracking)
    // ═══════════════════════════════════════════════════════════════

    // GET /debug/build — 배포 버전 확인
    if (path === '/debug/build' && request.method === 'GET') {
      return new Response(JSON.stringify({
        ok: true,
        BUILD_TAG: BUILD_TAG,
        now: Date.now()
      }), {
        headers: Object.assign({}, cors, {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store'
        })
      });
    }

    // GET /tracking/active — 현재 활성 추적 목록 (프론트 표준 구조 { active, count, byTier })
    if (path === '/tracking/active' && request.method === 'GET') {
      var rawA = await env.ALERT_KV.get(TRACKING_KEYS.active);
      var act = rawA ? JSON.parse(rawA) : [];
      if (!Array.isArray(act)) act = [];
      
      var byTier = { A: 0, B: 0, C: 0 };
      for (var i = 0; i < act.length; i++) {
        var t = act[i].tier || 'C';
        if (byTier[t] !== undefined) byTier[t]++;
        // [핫픽스] 사용자 가시성: 응답에서 windowEnd 정규화
        var normalizedEnd = normalizeTimeMs(act[i].windowEnd);
        if (normalizedEnd) act[i].windowEnd = normalizedEnd;
      }
      
      // [Phase 4.7 공사 4 — HF-A] watchlist 동적 매칭
      // 알람 시점 isWatchlistAtAlarm 박제 + 알람 후 관심 등록 시 watchlist_global 매칭
      // 이로써 사용자가 알람 후 ⭐ 클릭해도 즉시 카드에 반영
      var v47_wlSet = {};
      try {
        var v47_wlRaw = await env.ALERT_KV.get('watchlist_global');
        if (v47_wlRaw) {
          var v47_wlObj = JSON.parse(v47_wlRaw);
          if (v47_wlObj && Array.isArray(v47_wlObj.bases)) {
            for (var v47_w = 0; v47_w < v47_wlObj.bases.length; v47_w++) {
              v47_wlSet[String(v47_wlObj.bases[v47_w]).toUpperCase()] = true;
            }
          }
        }
      } catch(v47_wlErr) { /* watchlist 로드 실패는 무시 — 박제 값 사용 */ }
      // 동적 매칭: 박제 값 OR 동적 매칭 결과 (둘 중 하나라도 true 면 true)
      for (var v47_iw = 0; v47_iw < act.length; v47_iw++) {
        var v47_baseUp = String(act[v47_iw].base || '').toUpperCase();
        if (v47_wlSet[v47_baseUp]) act[v47_iw].isWatchlist = true;
      }
      
      // [Phase 4.7 공사 4 — A2-경량] last_sample 박제 데이터 attach
      // [핫픽스 v4.7.37a] 순차 await → Promise.all 병렬 처리 (12초 타임아웃 수정)
      // 기존: 50개 × 순차 KV reads = 최대 15초 → 12초 타임아웃 초과
      // 변경: 50개 동시 실행 → 약 100ms
      var v47_actEnriched = await Promise.all(act.map(async function(v47_a) {
        var v47_sid = v47_a.id || v47_a.snapshotId;
        if (!v47_sid) return v47_a;
        try {
          var v47_lsRaw = await env.ALERT_KV.get(TRACKING_KEYS.lastSample(v47_sid));
          var v47_ls = v47_lsRaw ? JSON.parse(v47_lsRaw) : null;
          if (!v47_ls) {
            var v47_t1LastRaw = await env.ALERT_KV.get('track_t1_' + v47_sid + '_last');
            if (v47_t1LastRaw) {
              var v47_t1Idx = parseInt(v47_t1LastRaw, 10);
              if (!isNaN(v47_t1Idx) && v47_t1Idx >= 0) {
                var v47_t1Raw = await env.ALERT_KV.get(TRACKING_KEYS.t1(v47_sid, v47_t1Idx));
                v47_ls = v47_t1Raw ? JSON.parse(v47_t1Raw) : null;
              }
            }
          }
          if (v47_ls) {
            v47_a.lastPrice = v47_ls.price || null;
            v47_a.currentPct = v47_ls.deltaPct != null ? v47_ls.deltaPct : null;
            v47_a.mfe = v47_ls.mfe != null ? v47_ls.mfe : null;
            v47_a.mae = v47_ls.mae != null ? v47_ls.mae : null;
            v47_a.lastSampleT = v47_ls.t || null;
          }
        } catch(v47_lsErr) { /* 박제 실패는 무시 */ }
        return v47_a;
      }));
      
      return new Response(JSON.stringify({
        ok: true,
        active: v47_actEnriched,
        count: v47_actEnriched.length,
        byTier: byTier,
        limits: TRACKING_LIMITS,
        updatedAt: Date.now(),
        BUILD_TAG: BUILD_TAG
      }), {
        headers: Object.assign({}, cors, {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store'
        })
      });
    }
    
    // ════════════════════════════════════════════════════════════════
    // [Phase 4.6.1] 히스토리 + Watchlist 신규 API
    // ════════════════════════════════════════════════════════════════
    
    // GET /tracking/completed?limit=N&offset=M — 히스토리 페이지
    if (path === '/tracking/completed' && request.method === 'GET') {
      var v461_limit = parseInt(url.searchParams.get('limit') || '50', 10);
      var v461_offset = parseInt(url.searchParams.get('offset') || '0', 10);
      v461_limit = Math.min(Math.max(v461_limit, 1), 200);
      v461_offset = Math.max(v461_offset, 0);
      
      var v461_rawIdx = await env.ALERT_KV.get('tracking_completed_index');
      var v461_idx = v461_rawIdx ? JSON.parse(v461_rawIdx) : [];
      if (!Array.isArray(v461_idx)) v461_idx = [];
      
      var v461_total = v461_idx.length;
      var v461_page = v461_idx.slice(v461_offset, v461_offset + v461_limit);
      
      return new Response(JSON.stringify({
        total: v461_total,
        limit: v461_limit,
        offset: v461_offset,
        items: v461_page,
      }), { headers: cors });
    }
    
    // GET /tracking/completed/{id} — 히스토리 단일 상세
    if (path.startsWith('/tracking/completed/') && request.method === 'GET') {
      var v461_compId = path.replace('/tracking/completed/', '');
      if (!v461_compId) {
        return new Response(JSON.stringify({ error: 'id required' }),
          { status: 400, headers: cors });
      }
      var v461_rawComp = await env.ALERT_KV.get('tracking_completed:' + v461_compId);
      if (!v461_rawComp) {
        return new Response(JSON.stringify({ error: 'not found' }),
          { status: 404, headers: cors });
      }
      var v461_compItem = JSON.parse(v461_rawComp);
      // meta 도 함께 반환 (분석기 풀 정보용)
      var v461_compMeta = null;
      try {
        var v461_rawCompMeta = await env.ALERT_KV.get(TRACKING_KEYS.meta(v461_compId));
        if (v461_rawCompMeta) v461_compMeta = JSON.parse(v461_rawCompMeta);
      } catch(e) {}
      
      return new Response(JSON.stringify({
        completed: v461_compItem,
        meta: v461_compMeta,
      }), { headers: cors });
    }
    
    // POST /tracking/watchlist — v4.7.14 관심 ON/OFF 단일 API
    // body: { base: "DOGE", enabled: true|false }
    if (path === '/tracking/watchlist' && request.method === 'POST') {
      var v4714_body = {};
      try { v4714_body = await request.json(); } catch(e) { v4714_body = {}; }
      var v4714_base = String(v4714_body.base || '').toUpperCase().trim();
      var v4714_enabled = !!v4714_body.enabled;
      if (!v4714_base) {
        return new Response(JSON.stringify({ ok:false, error:'base required' }),
          { status:400, headers:cors });
      }

      var v4714_rawWl = await env.ALERT_KV.get('watchlist_global');
      var v4714_wl = v4714_rawWl ? JSON.parse(v4714_rawWl) : { bases: [], updatedAt: 0 };
      if (!v4714_wl || !Array.isArray(v4714_wl.bases)) v4714_wl = { bases: [], updatedAt: 0 };

      if (v4714_enabled) {
        if (v4714_wl.bases.indexOf(v4714_base) < 0) v4714_wl.bases.push(v4714_base);
      } else {
        v4714_wl.bases = v4714_wl.bases.filter(function(b){ return String(b).toUpperCase() !== v4714_base; });
      }
      v4714_wl.updatedAt = Date.now();
      await env.ALERT_KV.put('watchlist_global', JSON.stringify(v4714_wl),
        { expirationTtl: 86400 * 365 });

      var v4714_now = Date.now();
      var v4714_upgraded = [];
      var v4714_touched = [];
      try {
        var v4714_actRaw = await env.ALERT_KV.get(TRACKING_KEYS.active);
        var v4714_act = v4714_actRaw ? JSON.parse(v4714_actRaw) : [];
        if (!Array.isArray(v4714_act)) v4714_act = [];
        var v4714_changed = false;

        for (var v4714_i = 0; v4714_i < v4714_act.length; v4714_i++) {
          var v4714_item = v4714_act[v4714_i];
          if (!v4714_item || String(v4714_item.base || '').toUpperCase() !== v4714_base) continue;

          if (v4714_enabled) {
            v4714_item.tier = 'A';
            v4714_item.trackingMode = 'deep';
            v4714_item.windowDays = 7;
            v4714_item.windowEnd = v4714_now + 7 * 24 * 3600 * 1000;
            v4714_item.isWatchlist = true;
            v4714_item.trackingModeReason = 'watchlist-upgrade';
            v4714_upgraded.push(v4714_item.id);
          } else {
            v4714_item.isWatchlist = false;
            v4714_touched.push(v4714_item.id);
          }
          v4714_changed = true;

          try {
            var v4714_metaRaw = await env.ALERT_KV.get(TRACKING_KEYS.meta(v4714_item.id));
            if (v4714_metaRaw) {
              var v4714_meta = JSON.parse(v4714_metaRaw);
              if (v4714_enabled) {
                v4714_meta.tier = 'A';
                v4714_meta.trackingMode = 'deep';
                v4714_meta.windowDays = 7;
                v4714_meta.windowEnd = v4714_item.windowEnd;
                v4714_meta.isWatchlist = true;
                v4714_meta.trackingModeReason = 'watchlist-upgrade';
              } else {
                v4714_meta.isWatchlist = false;
              }
              await env.ALERT_KV.put(TRACKING_KEYS.meta(v4714_item.id), JSON.stringify(v4714_meta),
                { expirationTtl: 86400 * 30 });
            }
          } catch(v4714_metaErr) { /* meta sync failure is non-fatal */ }
        }

        if (v4714_changed) {
          await env.ALERT_KV.put(TRACKING_KEYS.active, JSON.stringify(v4714_act),
            { expirationTtl: 86400 * 30 });
        }
      } catch(v4714_err) {
        console.error('[v4.7.14 /tracking/watchlist]', v4714_err);
      }

      return new Response(JSON.stringify({
        ok: true,
        base: v4714_base,
        enabled: v4714_enabled,
        bases: v4714_wl.bases,
        upgraded: v4714_upgraded,
        touched: v4714_touched
      }), { headers: cors });
    }

    // GET /watchlist — 관심 코인 목록 조회
    if (path === '/watchlist' && request.method === 'GET') {
      var v461_rawWl = await env.ALERT_KV.get('watchlist_global');
      var v461_wlObj = v461_rawWl ? JSON.parse(v461_rawWl) : { bases: [], updatedAt: 0 };
      if (!v461_wlObj || typeof v461_wlObj !== 'object') v461_wlObj = { bases: [], updatedAt: 0 };
      if (!Array.isArray(v461_wlObj.bases)) v461_wlObj.bases = [];
      
      return new Response(JSON.stringify({
        bases: v461_wlObj.bases,
        count: v461_wlObj.bases.length,
        updatedAt: v461_wlObj.updatedAt || 0,
      }), { headers: cors });
    }
    
    // PUT /watchlist/{base} — 관심 코인 추가
    if (path.startsWith('/watchlist/') && request.method === 'PUT') {
      var v461_addBase = path.replace('/watchlist/', '').toUpperCase();
      if (!v461_addBase) {
        return new Response(JSON.stringify({ error: 'base required' }),
          { status: 400, headers: cors });
      }
      var v461_rawWl2 = await env.ALERT_KV.get('watchlist_global');
      var v461_wl2 = v461_rawWl2 ? JSON.parse(v461_rawWl2) : { bases: [], updatedAt: 0 };
      if (!v461_wl2 || !Array.isArray(v461_wl2.bases)) v461_wl2 = { bases: [], updatedAt: 0 };
      
      if (v461_wl2.bases.indexOf(v461_addBase) < 0) {
        v461_wl2.bases.push(v461_addBase);
      }
      v461_wl2.updatedAt = Date.now();
      
      await env.ALERT_KV.put('watchlist_global', JSON.stringify(v461_wl2),
        { expirationTtl: 86400 * 365 });  // 1년 보존
      
      // [Phase 4.7.8 R7-2] #4 관심 등록 시 active 추적 즉시 deep + 7일 전환
      // 사용자 보고: "DOGE ⭐ 관심인데 표준+1일 표시" 핵심 해결
      // 사용자 결정: B (기존 active 추적도 즉시 변경) + B (windowEnd = now + 7일)
      var v478_upgraded = [];
      try {
        var v478_now = Date.now();
        var v478_actRaw = await env.ALERT_KV.get(TRACKING_KEYS.active);
        var v478_act = v478_actRaw ? JSON.parse(v478_actRaw) : [];
        if (!Array.isArray(v478_act)) v478_act = [];
        var v478_changed = false;
        
        for (var v478_i = 0; v478_i < v478_act.length; v478_i++) {
          var v478_a = v478_act[v478_i];
          if (!v478_a || (v478_a.base || '').toUpperCase() !== v461_addBase) continue;
          // active 자체 갱신
          v478_a.tier = 'A';                    // [R8-5] tier 도 'A' 로 변경 (분리 한도 정확 작동)
          v478_a.trackingMode = 'deep';
          v478_a.windowDays = 7;
          v478_a.windowEnd = v478_now + 7 * 24 * 3600 * 1000;
          v478_a.isWatchlist = true;
          v478_changed = true;
          
          // meta KV 갱신
          try {
            var v478_metaRaw = await env.ALERT_KV.get(TRACKING_KEYS.meta(v478_a.id));
            if (v478_metaRaw) {
              var v478_meta = JSON.parse(v478_metaRaw);
              v478_meta.tier = 'A';             // [R8-5] meta tier 도 'A' 로 변경
              v478_meta.trackingMode = 'deep';
              v478_meta.windowDays = 7;
              v478_meta.windowEnd = v478_now + 7 * 24 * 3600 * 1000;
              v478_meta.isWatchlist = true;
              v478_meta.trackingModeReason = 'watchlist-upgrade';
              await env.ALERT_KV.put(TRACKING_KEYS.meta(v478_a.id), JSON.stringify(v478_meta),
                { expirationTtl: 86400 * 30 });
            }
          } catch(v478_metaErr) { /* meta 갱신 실패는 무시 */ }
          
          v478_upgraded.push(v478_a.id);
        }
        
        if (v478_changed) {
          await env.ALERT_KV.put(TRACKING_KEYS.active, JSON.stringify(v478_act),
            { expirationTtl: 86400 * 30 });
        }
      } catch(v478_upErr) {
        console.error('[v478 watchlist upgrade]', v478_upErr);
      }
      
      return new Response(JSON.stringify({
        ok: true,
        base: v461_addBase,
        bases: v461_wl2.bases,
        upgraded: v478_upgraded,  // 즉시 전환된 active id 목록
      }), { headers: cors });
    }
    
    // DELETE /watchlist/{base} — 관심 코인 제거
    if (path.startsWith('/watchlist/') && request.method === 'DELETE') {
      var v461_remBase = path.replace('/watchlist/', '').toUpperCase();
      if (!v461_remBase) {
        return new Response(JSON.stringify({ error: 'base required' }),
          { status: 400, headers: cors });
      }
      var v461_rawWl3 = await env.ALERT_KV.get('watchlist_global');
      var v461_wl3 = v461_rawWl3 ? JSON.parse(v461_rawWl3) : { bases: [], updatedAt: 0 };
      if (!v461_wl3 || !Array.isArray(v461_wl3.bases)) v461_wl3 = { bases: [], updatedAt: 0 };
      
      v461_wl3.bases = v461_wl3.bases.filter(function(b){ return b !== v461_remBase; });
      v461_wl3.updatedAt = Date.now();
      
      await env.ALERT_KV.put('watchlist_global', JSON.stringify(v461_wl3),
        { expirationTtl: 86400 * 365 });
      
      return new Response(JSON.stringify({
        ok: true,
        base: v461_remBase,
        bases: v461_wl3.bases,
      }), { headers: cors });
    }

    // [Phase 3.10] GET /tracking/debug/{sid} — KV 상태 진단 도구
    // 운영 디버깅용: 특정 추적 sid 의 모든 KV 키 상태 + sample 수 + 진단
    if (path.startsWith('/tracking/debug/') && request.method === 'GET') {
      var debugSid = path.replace('/tracking/debug/', '');
      if (!debugSid) {
        return new Response(JSON.stringify({ error: 'sid required' }),
          { status: 400, headers: cors });
      }
      
      var debug = {
        snapshotId: debugSid,
        timestamp: new Date().toISOString(),
        keys: {},
        diagnosis: {}
      };
      
      try {
        // 1. meta
        var metaR = await env.ALERT_KV.get(TRACKING_KEYS.meta(debugSid));
        debug.keys.meta = {
          exists: !!metaR,
          value: metaR ? JSON.parse(metaR) : null
        };
        
        // 2. t1_last / t2_last
        var t1LastR = await env.ALERT_KV.get('track_t1_' + debugSid + '_last');
        var t2LastR = await env.ALERT_KV.get('track_t2_' + debugSid + '_last');
        debug.keys.t1_last = { exists: !!t1LastR, value: t1LastR ? parseInt(t1LastR, 10) : null };
        debug.keys.t2_last = { exists: !!t2LastR, value: t2LastR ? parseInt(t2LastR, 10) : null };
        
        // 3. samples 수집 (t1, t2)
        var t1Samples = [];
        if (t1LastR) {
          var t1MaxIdx = parseInt(t1LastR, 10);
          for (var i = 0; i <= t1MaxIdx; i++) {
            var raw = await env.ALERT_KV.get(TRACKING_KEYS.t1(debugSid, i));
            if (raw) {
              try { 
                var s = JSON.parse(raw);
                t1Samples.push({ idx: i, t: s.t, price: s.price, deltaPct: s.deltaPct });
              } catch(e) {}
            } else {
              t1Samples.push({ idx: i, missing: true });
            }
          }
        }
        debug.keys.samples_t1 = { count: t1Samples.length, items: t1Samples };
        
        var t2Samples = [];
        if (t2LastR) {
          var t2MaxIdx = parseInt(t2LastR, 10);
          for (var j = 0; j <= t2MaxIdx; j++) {
            var raw2 = await env.ALERT_KV.get(TRACKING_KEYS.t2(debugSid, j));
            if (raw2) {
              try {
                var s2 = JSON.parse(raw2);
                t2Samples.push({ idx: j, t: s2.t, price: s2.price, deltaPct: s2.deltaPct });
              } catch(e) {}
            } else {
              t2Samples.push({ idx: j, missing: true });
            }
          }
        }
        debug.keys.samples_t2 = { count: t2Samples.length, items: t2Samples };
        
        // 4. thresholds / tp1 / summary / dataQuality
        var thrR = await env.ALERT_KV.get(TRACKING_KEYS.thr(debugSid));
        debug.keys.thresholds = { exists: !!thrR, value: thrR ? JSON.parse(thrR) : null };
        
        var tp1R = await env.ALERT_KV.get(TRACKING_KEYS.tp1(debugSid));
        debug.keys.tp1 = { exists: !!tp1R, value: tp1R ? JSON.parse(tp1R) : null };
        
        var sumR = await env.ALERT_KV.get(TRACKING_KEYS.sum(debugSid));
        debug.keys.summary = { exists: !!sumR, value: sumR ? JSON.parse(sumR) : null };
        
        var qtyR = await env.ALERT_KV.get(TRACKING_KEYS.qty(debugSid));
        debug.keys.dataQuality = { exists: !!qtyR, value: qtyR ? JSON.parse(qtyR) : null };
        
        // 5. 진단
        if (!debug.keys.meta.exists) {
          debug.diagnosis.likely_cause = 'case_A_no_tracking_started';
          debug.diagnosis.message = '추적 시작 자체 실패: track_meta_<sid> 없음';
        } else {
          var meta = debug.keys.meta.value;
          var tier = meta.tier;
          var tierAssignedAt = meta.tierAssignedAt || 0;
          var elapsedMin = (Date.now() - tierAssignedAt) / 60000;
          
          // 예상 sample 수 계산
          var t1Min = tier === 'A' ? 10 : 30;
          var t2Min = tier === 'A' ? 60 : 120;
          var t1Phase = 360; // 6h
          
          var t1Elapsed = Math.min(elapsedMin, t1Phase);
          var t1Expected = Math.max(0, Math.floor(t1Elapsed / t1Min));
          var t2Elapsed = Math.max(0, elapsedMin - t1Phase);
          var t2Expected = Math.max(0, Math.floor(t2Elapsed / t2Min));
          
          debug.diagnosis.tier = tier;
          debug.diagnosis.elapsed_minutes = Math.round(elapsedMin);
          debug.diagnosis.expected_samples_t1 = t1Expected;
          debug.diagnosis.expected_samples_t2 = t2Expected;
          debug.diagnosis.expected_samples_total = t1Expected + t2Expected;
          debug.diagnosis.actual_samples_t1 = t1Samples.filter(function(s){ return !s.missing; }).length;
          debug.diagnosis.actual_samples_t2 = t2Samples.filter(function(s){ return !s.missing; }).length;
          debug.diagnosis.actual_samples_total = debug.diagnosis.actual_samples_t1 + debug.diagnosis.actual_samples_t2;
          
          if (!t1LastR && !t2LastR) {
            debug.diagnosis.likely_cause = 'case_B_cron_not_running';
            debug.diagnosis.message = 'meta 있지만 t1_last/t2_last 둘 다 없음 → Cron 이 sample 누적 안 함';
          } else if (debug.diagnosis.actual_samples_total < debug.diagnosis.expected_samples_total - 2) {
            debug.diagnosis.likely_cause = 'case_C_partial_fetch_failures';
            debug.diagnosis.message = '예상 ' + debug.diagnosis.expected_samples_total + '개 vs 실제 ' + debug.diagnosis.actual_samples_total + '개 → 일부 fetch 실패';
          } else if (debug.diagnosis.actual_samples_total > 0) {
            debug.diagnosis.likely_cause = 'case_D_data_ok';
            debug.diagnosis.message = '데이터 정상: ' + debug.diagnosis.actual_samples_total + '개 sample 누적됨';
          } else {
            debug.diagnosis.likely_cause = 'case_E_unknown';
            debug.diagnosis.message = '추적 시작 직후 (첫 sample 도래 전)';
          }
        }
        
        return new Response(JSON.stringify(debug, null, 2), { headers: cors });
      } catch(e) {
        return new Response(JSON.stringify({ error: e.message, stack: e.stack }),
          { status: 500, headers: cors });
      }
    }

    // GET /tracking/{id} — 개별 추적 메타 + 상태 + 분석 결과 (Phase 3.2-C)
    if (path.startsWith('/tracking/') && request.method === 'GET') {
      var trackId = path.replace('/tracking/', '');
      // 'active' 는 위에서 처리됐으므로 여기 안 옴
      
      var metaRaw = await env.ALERT_KV.get(TRACKING_KEYS.meta(trackId));
      if (!metaRaw) {
        return new Response(JSON.stringify({ error: 'not found', id: trackId }),
          { status: 404, headers: cors });
      }
      
      var trackMeta = JSON.parse(metaRaw);
      
      // [핫픽스] 응답 시 windowStart/End 정규화
      var nWS = normalizeTimeMs(trackMeta.windowStart);
      var nWE = normalizeTimeMs(trackMeta.windowEnd);
      if (nWS) trackMeta.windowStart = nWS;
      if (nWE) trackMeta.windowEnd = nWE;
      
      // [Phase 3.2-C] 분석 결과 포함 (있으면)
      var summaryRaw = await env.ALERT_KV.get(TRACKING_KEYS.sum(trackId));
      var thresholdRaw = await env.ALERT_KV.get(TRACKING_KEYS.thr(trackId));
      var tp1Raw = await env.ALERT_KV.get(TRACKING_KEYS.tp1(trackId));
      var qtyRaw = await env.ALERT_KV.get(TRACKING_KEYS.qty(trackId));
      
      var response = {
        id: trackId,
        meta: trackMeta,
      };
      if (summaryRaw) {
        try { response.summary = JSON.parse(summaryRaw); } catch(e) {}
      }
      if (thresholdRaw) {
        try { response.thresholds = JSON.parse(thresholdRaw); } catch(e) {}
      }
      if (tp1Raw) {
        try { response.tp1 = JSON.parse(tp1Raw); } catch(e) {}
      }
      if (qtyRaw) {
        try { response.dataQuality = JSON.parse(qtyRaw); } catch(e) {}
      }
      
      // [Phase 3.5] 시간 흐름 시각화용: sample 데이터 포함
      // includeSamples=1 쿼리 파라미터로 활성화 (기본 off, KV reads 절약)
      if (url.searchParams.get('includeSamples') === '1') {
        try {
          var samples = await loadAllSamples(env, trackId);
          if (samples && samples.length > 0) {
            response.samples = samples;
          }
        } catch(e) {}
      }
      
      // [Phase 4.7 공사 1 — Q9/Q12 데이터 연결]
      // 분석기 카드가 신호근거/스캐너점수/세력판단/전략A·B 표시할 수 있도록
      // snap_{snapshotId} 풀 데이터를 응답에 합쳐서 보냄.
      // alertSnapshot (meta) 박제 데이터가 잘못되어 null 인 경우에도
      // 분석기는 이 snapshot 필드를 우선 사용하여 정상 표시 가능.
      try {
        var snapRaw = await env.ALERT_KV.get('snap_' + trackId);
        if (snapRaw) {
          response.snapshot = JSON.parse(snapRaw);
        }
      } catch(e) {
        // snapshot 못 읽어도 응답 막지 않음 (기존 응답 그대로)
      }
      
      return new Response(JSON.stringify(response), { headers: cors });
    }

    // [Phase 3.6] GET /news/{base} — 뉴스 조회 (HTML 카드용)
    // 텔레그램 발송 시에도 같은 fetchNewsForCoin 사용 → 동일 데이터 보장
    if (path.startsWith('/news/') && request.method === 'GET') {
      var newsBase = path.replace('/news/', '');
      if (!newsBase) {
        return new Response(JSON.stringify({ error: 'base required' }),
          { status: 400, headers: cors });
      }
      try {
        var newsLimit = parseInt(url.searchParams.get('limit') || '5', 10);
        var newsData = await fetchNewsForCoin(newsBase);
        // limit 적용 (newsData 가 배열이거나 items 필드일 가능성 둘 다 대응)
        if (Array.isArray(newsData)) {
          newsData = newsData.slice(0, newsLimit);
        } else if (newsData && Array.isArray(newsData.items)) {
          newsData.items = newsData.items.slice(0, newsLimit);
        }
        return new Response(JSON.stringify(newsData), { headers: cors });
      } catch(e) {
        return new Response(JSON.stringify({ error: e.message, items: [] }),
          { status: 500, headers: cors });
      }
    }

    // 쿨다운 체크 — HTML이 알람 발송 전 GET으로 조회
    if (path === '/cooldown/check' && request.method === 'GET') {
      var base = url.searchParams.get('base');
      var type = url.searchParams.get('type');
      var grade = url.searchParams.get('grade');
      var score = parseFloat(url.searchParams.get('score') || '0');
      if (!base || !type) return new Response(JSON.stringify({ error: 'missing params' }),
        { status: 400, headers: cors });
      var canSendResult = await canSend(env, base, type, grade, score);
      return new Response(JSON.stringify({ canSend: canSendResult }),
        { headers: cors });
    }

    // 쿨다운 기록 — HTML이 알람 발송 후 POST로 알림
    if (path === '/cooldown/set' && request.method === 'POST') {
      var body = await request.json();
      if (!body.base || !body.type) return new Response(JSON.stringify({ error: 'missing params' }),
        { status: 400, headers: cors });
      await setCooldown(env, body.base, body.type, body.grade || '', body.score || 0);
      return new Response(JSON.stringify({ ok: true }), { headers: cors });
    }

    // 수면 큐 조회
    if (path === '/sleep/queue' && request.method === 'GET') {
      var rawQ = await env.ALERT_KV.get('sleep_queue');
      return new Response(rawQ || '[]', { headers: cors });
    }

    // ═══════════════════════════════════════════════════════════════
    // Phase 3 — Sleep Toggle API (Q4=A, Q5=A)
    // 
    // GET  /sleep/status  — 현재 상태 조회 (override + 실효 상태)
    // POST /sleep/on      — 강제 수면 모드 (항상 큐에 저장)
    // POST /sleep/off     — 수면 비활성 (24시간 즉시 발송)
    // POST /sleep/auto    — 시간대 자동 (23-08 KST)
    // ═══════════════════════════════════════════════════════════════
    if (path === '/sleep/status') {
      try {
        var override = await env.ALERT_KV.get('sleep_mode_override');
        var effectiveSleep = await isInSleepTime(env);
        var nowH = (new Date().getUTCHours() + 9) % 24;
        return new Response(JSON.stringify({
          override: override || 'auto',
          effectiveSleep: effectiveSleep,
          currentHourKST: nowH,
          clockBasedSleep: isInSleepTimeByClock(),
          explanation: override === 'on' ? '강제 수면 모드' :
                       override === 'off' ? '수면 비활성 (24시간 직송)' :
                       '시간대 자동 (23-08 KST 수면)'
        }, null, 2), {
          status: 200,
          headers: { 'Content-Type': 'application/json; charset=utf-8' }
        });
      } catch(e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    if (path === '/sleep/on' || path === '/sleep/off' || path === '/sleep/auto') {
      try {
        var mode = path === '/sleep/on' ? 'on' :
                   path === '/sleep/off' ? 'off' : 'auto';
        if (mode === 'auto') {
          // auto = KV 키 삭제 (기본 상태로 복귀)
          await env.ALERT_KV.delete('sleep_mode_override');
        } else {
          await env.ALERT_KV.put('sleep_mode_override', mode);
        }
        var effectiveSleep = await isInSleepTime(env);
        return new Response(JSON.stringify({
          ok: true,
          override: mode,
          effectiveSleep: effectiveSleep,
          message: mode === 'on' ? '강제 수면 모드 활성화 (알람 큐에 저장)' :
                   mode === 'off' ? '수면 비활성 (24시간 즉시 발송)' :
                   '시간대 자동 모드로 복귀 (23-08 KST 수면)'
        }, null, 2), {
          status: 200,
          headers: { 'Content-Type': 'application/json; charset=utf-8' }
        });
      } catch(e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }


    // 디버그 엔드포인트 — 단계별 세밀 진단
    if (path === '/debug') {
      var dbg = {
        proxyUrl: (env.PROXY_URL || '').replace(/\/$/, ''),
        stages: {}
      };
      var proxy = dbg.proxyUrl;
      if (!proxy) return new Response(JSON.stringify({ error: 'PROXY_URL not set' }), { headers: cors });

      // Stage 1: 프록시 health
      try {
        var h = await fetchJson(proxy + '/health', 5000);
        dbg.stages.s1_proxy_health = { ok: true, version: h.version, release: h.release };
      } catch(e) { dbg.stages.s1_proxy_health = { ok: false, error: e.message }; }

      // Stage 2: 업비트 원본 raw 응답
      try {
        var m = await fetchJson(proxy + '/upbit/markets', 6000);
        dbg.stages.s2_upbit_markets_raw = {
          isArray: Array.isArray(m),
          count: Array.isArray(m) ? m.length : 0,
          krwCount: Array.isArray(m) ? m.filter(function(x){return x.market&&x.market.startsWith("KRW-");}).length : 0,
        };
      } catch(e) { dbg.stages.s2_upbit_markets_raw = { ok: false, error: e.message }; }

      // Stage 3: 업비트 티커 청크 1개 (10개 심볼)
      try {
        var testMarkets = ["KRW-BTC","KRW-ETH","KRW-XRP","KRW-SOL","KRW-DOGE"].join(",");
        var t = await fetchJson(proxy + '/upbit/ticker?markets=' + encodeURIComponent(testMarkets), 8000);
        dbg.stages.s3_upbit_ticker = {
          isArray: Array.isArray(t),
          count: Array.isArray(t) ? t.length : 0,
          sample: Array.isArray(t) && t[0] ? {
            market: t[0].market,
            trade_price: t[0].trade_price,
            acc_trade_price_24h: t[0].acc_trade_price_24h,
            has_change_rate: typeof t[0].signed_change_rate
          } : null
        };
      } catch(e) { dbg.stages.s3_upbit_ticker = { ok: false, error: e.message }; }

      // Stage 4: 업비트 캔들 (KRW-BTC)
      try {
        var k = await fetchJson(proxy + '/upbit/candles?market=KRW-BTC&count=100', 7000);
        var candles = k.candles || k;
        var normalized = Array.isArray(candles) ? normalizeCandles(candles) : [];
        dbg.stages.s4_upbit_candles = {
          rawShape: candles ? (Array.isArray(candles) ? 'array' : typeof candles) : 'null',
          rawCount: Array.isArray(candles) ? candles.length : 0,
          normalizedCount: normalized.length,
          sampleCandle: normalized[0] || null
        };
      } catch(e) { dbg.stages.s4_upbit_candles = { ok: false, error: e.message }; }

      // Stage 5: fetchUpbitData 실제 시뮬레이션 — 어디서 0이 되는지
      try {
        var t0 = Date.now();
        var upbitResult = await fetchUpbitData(proxy);
        dbg.stages.s5_fetchUpbitData = {
          elapsedMs: Date.now() - t0,
          count: upbitResult.length,
          sample: upbitResult.slice(0, 2).map(function(c){return {
            base: c.base, price: c.price, candlesLen: c.candles.length
          };})
        };
      } catch(e) { dbg.stages.s5_fetchUpbitData = { ok: false, error: e.message }; }

      // Stage 6: 빗썸
      try {
        var t0 = Date.now();
        var b = await fetchBithumbData(proxy);
        dbg.stages.s6_fetchBithumbData = { elapsedMs: Date.now()-t0, count: b.length };
      } catch(e) { dbg.stages.s6_fetchBithumbData = { ok: false, error: e.message }; }

      // Stage 7: 바이낸스
      try {
        var t0 = Date.now();
        var bn = await fetchBinanceData(proxy);
        dbg.stages.s7_fetchBinanceData = { elapsedMs: Date.now()-t0, count: bn.length };
      } catch(e) { dbg.stages.s7_fetchBinanceData = { ok: false, error: e.message }; }

      // Stage 7b: 바이낸스 상세 진단 — 프록시 통해서 /api/v3/ticker/24hr 직접
      try {
        var t0 = Date.now();
        var r = await fetchJson(proxy + '/api/v3/ticker/24hr', 10000);
        dbg.stages.s7b_binance_ticker_raw = {
          elapsedMs: Date.now() - t0,
          isArray: Array.isArray(r),
          count: Array.isArray(r) ? r.length : 0,
          usdtPairs: Array.isArray(r) ? r.filter(function(t){return t.symbol&&t.symbol.endsWith('USDT');}).length : 0,
          highVolume: Array.isArray(r) ? r.filter(function(t){return t.symbol&&t.symbol.endsWith('USDT')&&parseFloat(t.quoteVolume||0)>=400000;}).length : 0,
          sample: Array.isArray(r) && r[0] ? { symbol: r[0].symbol, lastPrice: r[0].lastPrice, quoteVolume: r[0].quoteVolume } : r
        };
      } catch(e) {
        dbg.stages.s7b_binance_ticker_raw = { ok: false, error: e.message };
      }

      // Stage 7c: 바이낸스 klines 샘플 (BTCUSDT)
      try {
        var t0 = Date.now();
        var r = await fetchJson(proxy + '/api/v3/klines?symbol=BTCUSDT&interval=1h&limit=10', 8000);
        dbg.stages.s7c_binance_klines = {
          elapsedMs: Date.now() - t0,
          isArray: Array.isArray(r),
          count: Array.isArray(r) ? r.length : 0,
          sample: Array.isArray(r) ? r[0] : r
        };
      } catch(e) {
        dbg.stages.s7c_binance_klines = { ok: false, error: e.message };
      }

      // Stage 8: 전체 fetch 시간 + subrequest 합계 추정
      dbg.totalCandidates = (dbg.stages.s5_fetchUpbitData.count || 0)
        + (dbg.stages.s6_fetchBithumbData.count || 0)
        + (dbg.stages.s7_fetchBinanceData.count || 0);

      return new Response(JSON.stringify(dbg), { headers: cors });
    }

    // ═══════════════════════════════════════════════════════════════
    // /test — 강제 텔레그램 발송 테스트
    // ═══════════════════════════════════════════════════════════════
    if (path === '/test') {
      var testMsg = '🧪 *테스트 알람*\n\n' +
        'Worker: auto-alert-worker-v3\n' +
        'Release: 2026-04-23\n' +
        'Time: ' + new Date().toISOString() + '\n' +
        'Sleep Mode: ' + ((await isInSleepTime(env)) ? 'YES' : 'NO');
      var result = { 
        envCheck: {
          TG_BOT_TOKEN: env.TG_BOT_TOKEN ? 'SET('+env.TG_BOT_TOKEN.substring(0,10)+'...)' : 'NOT_SET',
          TG_CHAT_ID: env.TG_CHAT_ID ? 'SET('+env.TG_CHAT_ID+')' : 'NOT_SET',
          PROXY_URL: env.PROXY_URL || 'NOT_SET'
        }
      };
      try {
        var tg = await sendTelegramMessage(env, testMsg);
        result.telegramSend = { ok: true, response: tg };
      } catch(e) {
        result.telegramSend = { ok: false, error: e.message, stack: (e.stack||'').substring(0,500) };
      }
      return new Response(JSON.stringify(result, null, 2), { headers: cors });
    }

    // ═══════════════════════════════════════════════════════════════
    // /scan-debug — 모든 후보의 상세 점수 반환 (MIN_SCORE 무시)
    // ═══════════════════════════════════════════════════════════════
    if (path === '/scan-debug') {
      var proxy = (env.PROXY_URL || '').replace(/\/$/, '');
      var usdtKrw = await fetchUSDTKRW(proxy);
      var btcFilter = { trend: 'neutral', penalty: 0 };
      try {
        var btcKl = await fetchJson(proxy + '/api/v3/klines?symbol=BTCUSDT&interval=1h&limit=100', 8000);
        var btcCandles = normalizeCandles(btcKl.map(function(c){return {time:parseInt(c[0]),open:parseFloat(c[1]),high:parseFloat(c[2]),low:parseFloat(c[3]),close:parseFloat(c[4]),volume:parseFloat(c[5])};}));
        btcFilter = calcBTCFilter(btcCandles);
      } catch(e) {}
      var results = await Promise.all([
        fetchUpbitData(proxy).catch(function(){return [];}),
        fetchBithumbData(proxy).catch(function(){return [];}),
      ]);
      var allCandidates = results[0].concat(results[1]);
      var scored = allCandidates.map(function(coin){
        try {
          var volInfo    = calcVolumeSpike(coin.candles.map(function(c){return c.volume;}));
          var prePumpInfo = detectPrePump(coin.candles);
          var obvInfo    = calcOBV(coin.candles);
          var total = calcScore(prePumpInfo.prePump, volInfo.accel, obvInfo.trend, btcFilter.penalty);
          return {
            exchange: coin.exchange,
            base: coin.base,
            total: total,
            prePump: prePumpInfo.prePump,
            volAccel: volInfo.accel,
            volRatio: volInfo.ratio,
            obvTrend: obvInfo.trend,
            btcPenalty: btcFilter.penalty,
            passMinScore: total >= MIN_SCORE
          };
        } catch(e) {
          return { exchange: coin.exchange, base: coin.base, error: e.message };
        }
      });
      scored.sort(function(a,b){ return (b.total||0) - (a.total||0); });
      return new Response(JSON.stringify({
        btcFilter: btcFilter,
        usdtKrw: usdtKrw,
        totalCandidates: allCandidates.length,
        passedMinScore: scored.filter(function(s){return s.passMinScore;}).length,
        top10: scored.slice(0, 10),
        prePumpCoins: scored.filter(function(s){return s.prePump;}).length,
        scoreDistribution: {
          above3: scored.filter(function(s){return (s.total||0) >= 3;}).length,
          above2: scored.filter(function(s){return (s.total||0) >= 2;}).length,
          above1: scored.filter(function(s){return (s.total||0) >= 1;}).length,
          zero:   scored.filter(function(s){return (s.total||0) === 0;}).length,
        }
      }, null, 2), { headers: cors });
    }

    // 헬스 체크
    if (path === '/' || path === '/health') {
      return new Response(JSON.stringify({
        ok: true,
        version: 'v3',
        release: '2026-04-23',
      buildTag: BUILD_TAG,
      features: FEATURES,
        sleepMode: await isInSleepTime(env),
      }), { headers: cors });
    }

    // ═══════════════════════════════════════════════════════════════
    // /s/{snapshotId} — 스냅샷 짧은 링크 리다이렉트 (HTML 스캐너로)
    // ═══════════════════════════════════════════════════════════════
    // ═══════════════════════════════════════════════════════════════
    // ═══════════════════════════════════════════════════════════════
    // GET /demo — 샘플 데이터로 알람 포맷 테스트 (KV 저장 안 함)
    // ═══════════════════════════════════════════════════════════════
    if (path === '/demo') {
      try {
        // 샘플 코인 데이터 (실제 AVNT 알람과 비슷한 구조)
        var demoCoin = {
          base: 'DEMO',
          existsIn: ['UPBIT', 'BITHUMB'],
          priceGap: null,
          gapStatus: null,
          representative: {
            exchange: 'UPBIT',
            price: 215.0,
            total: 5,
            gradeCode: 'SPLUS',
            gradeLabel: '🔥 S+',
            rsi: 58.3,
            mfi: 52.1,
            atr: 2.1,
            vol:  { ratio: 1.96, accel: 2.33 },
            obv:  { trend: 'up' },
            smc:  { label: '상승 구조 돌파 (BOS↑)', direction: 'up' },
            box:  { low: 210.0, high: 220.0 },
            accumulationCost: {
              low: 214.0, high: 216.0, center: 215.0, confidence: '보통'
            },
            currentPhase: { ratio: '1.000', label: '매집' },
            distributionTargets: {
              target1: 226.8, target2: 354.7, target3: 451.5
            },
            isEntryReady: true,
            finalEntryAllowed: true,
            fakePump: false,
            lateEntry: false,
            prePump: true,
            actionDesc: '평단 이격 낮고 구조 양호 — 적극 진입',
          }
        };
        var demoSnapshotId = 'DEMO_' + Date.now() + '_TEST';

        // 뉴스 (Best Effort, 실패 허용)
        var newsData = null;
        try { newsData = await fetchNewsForCoin('Bitcoin'); } catch(e) {}

        // buildMessage 호출 — 실제 알람과 동일한 포맷
        // 샘플 snapshot (전략 A/B 포함)
        var demoSnapshot = {
          strategyA: {
            type: 'elder_split',
            target1: 226.8, target2: 354.7, target3: 451.5,
            exit1Pct: 30, exit2Pct: 35,
            stopLoss: 210.0
          },
          strategyB: {
            type: 'atr_trailing',
            trailAmount: 4.2,
            stopLoss: 210.0
          }
        };
        var msg = buildMessage(demoCoin, 'ENTRY', demoSnapshotId,
                              env.SCANNER_URL || '', newsData, demoSnapshot, BUILD_TAG);

        // DEMO 표식 추가 (맨 위)
        var demoHeader = '🧪 <b>[DEMO 테스트 메시지]</b>\n'
                       + '<i>실제 시그널 아님 — 포맷 확인용</i>\n'
                       + '━━━━━━━━━━━━━━━━━━\n';
        var finalMsg = demoHeader + msg;

        // 텔레그램 발송
        var ok = await sendTelegram(env, finalMsg);

        return new Response(JSON.stringify({
          sent: ok,
          snapshotId: demoSnapshotId,
          newsFound: !!(newsData && newsData.title),
          messageLength: finalMsg.length,
          note: 'KV에 저장되지 않음 (테스트 모드)'
        }, null, 2), {
          status: 200,
          headers: { 'Content-Type': 'application/json; charset=utf-8' }
        });
      } catch(e) {
        return new Response(JSON.stringify({ error: e.message, stack: e.stack }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // GET /snapshots — 스냅샷 목록 조회
    // 쿼리: ?base=STRK  ?grade=SPLUS  ?limit=50
    // ═══════════════════════════════════════════════════════════════
    if (path === '/snapshots') {
      try {
        var qBase = url.searchParams.get('base');
        var qGrade = url.searchParams.get('grade');
        var qLimit = parseInt(url.searchParams.get('limit') || '50', 10);
        if (isNaN(qLimit) || qLimit < 1) qLimit = 50;
        if (qLimit > 100) qLimit = 100;

        var indexKey = 'snap_idx_recent';
        if (qBase)       indexKey = 'snap_idx_base_' + qBase.toUpperCase();
        else if (qGrade) indexKey = 'snap_idx_grade_' + qGrade.toUpperCase();

        var raw = await env.ALERT_KV.get(indexKey);
        var arr = raw ? JSON.parse(raw) : [];
        var items = arr.slice(0, qLimit).map(function(x){
          return {
            snapshotId: x.id,
            timestamp: x.t,
            base: x.base,
            gradeCode: x.grade,
            total: x.total,
            exchange: x.exchange,
            alertType: x.alertType,
          };
        });

        return new Response(JSON.stringify({
          count: items.length,
          total: arr.length,
          indexKey: indexKey,
          filter: { base: qBase, grade: qGrade, limit: qLimit },
          items: items,
        }, null, 2), {
          status: 200,
          headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, cors)
        });
      } catch(e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500,
          headers: Object.assign({ 'Content-Type': 'application/json' }, cors)
        });
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // /snapshot/{id}  — GET (조회) / PUT /snapshot/{id}/outcome (결과 기록)
    // ═══════════════════════════════════════════════════════════════
    if (path.startsWith('/snapshot/')) {
      try {
        // PUT /snapshot/{id}/outcome
        var outcomeMatch = path.match(/^\/snapshot\/([^\/]+)\/outcome$/);
        if (request.method === 'PUT' && outcomeMatch) {
          var snapId = outcomeMatch[1];
          // API_SECRET 검증 (설정된 경우에만)
          if (env.API_SECRET) {
            var auth = request.headers.get('X-API-Secret') || '';
            if (auth !== env.API_SECRET) {
              return new Response(JSON.stringify({ error: 'unauthorized' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' }
              });
            }
          }
          // 스냅샷 조회
          var snapRaw = await env.ALERT_KV.get('snap_' + snapId);
          if (!snapRaw) {
            return new Response(JSON.stringify({ error: 'not found', snapshotId: snapId }), {
              status: 404,
              headers: { 'Content-Type': 'application/json' }
            });
          }
          var snap = JSON.parse(snapRaw);
          // body 파싱
          var body;
          try { body = await request.json(); } catch(e) {
            return new Response(JSON.stringify({ error: 'invalid json body' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' }
            });
          }
          var result = (body.result || '').toUpperCase();
          if (result !== 'SUCCESS' && result !== 'FAIL') {
            return new Response(JSON.stringify({ error: 'result must be SUCCESS or FAIL' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' }
            });
          }
          // 이전 outcome 보존 (중복 호출 시 차감 처리용)
          var previousResult = snap.outcome ? snap.outcome.result : null;
          // outcome 업데이트
          snap.outcome = {
            result: result,
            maxRise:  typeof body.maxRise  === 'number' ? body.maxRise  : null,
            maxDrop:  typeof body.maxDrop  === 'number' ? body.maxDrop  : null,
            note:     body.note || '',
          };
          if (typeof body.highestPriceAfterAlert === 'number') {
            snap.highestPriceAfterAlert = body.highestPriceAfterAlert;
          }
          snap.verifiedAt = new Date().toISOString();
          // 저장 (TTL 유지 - 기존 TTL 그대로 30일)
          await env.ALERT_KV.put('snap_' + snapId, JSON.stringify(snap),
            { expirationTtl: 86400 * 30 });
          // stats 업데이트 (신규 or 수정)
          await updateStatsOutcome(env, snap.gradeCode, snap.exchange, result, previousResult);
          return new Response(JSON.stringify({
            ok: true,
            snapshotId: snapId,
            result: result,
            previousResult: previousResult,
            verifiedAt: snap.verifiedAt
          }, null, 2), {
            status: 200,
            headers: { 'Content-Type': 'application/json; charset=utf-8' }
          });
        }

        // GET /snapshot/{id}
        var snapId2 = path.substring('/snapshot/'.length);
        if (!snapId2) {
          return new Response(JSON.stringify({ error: 'snapshot id required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        var raw = await env.ALERT_KV.get('snap_' + snapId2);
        if (!raw) {
          return new Response(JSON.stringify({ error: 'not found', snapshotId: snapId2 }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        return new Response(raw, {
          status: 200,
          headers: { 'Content-Type': 'application/json; charset=utf-8' }
        });
      } catch(e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // GET /snapshots/stats — O(1) 집계 통계 (KV 1회 read만)
    // ═══════════════════════════════════════════════════════════════
    if (path === '/snapshots/stats') {
      try {
        var stats = await getStatsSummary(env);
        return new Response(JSON.stringify(stats, null, 2), {
          status: 200,
          headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, cors)
        });
      } catch(e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500,
          headers: Object.assign({ 'Content-Type': 'application/json' }, cors)
        });
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // /s/{snapshotId} — 스냅샷 HTML 뷰어 (모바일 최적화)
    // ═══════════════════════════════════════════════════════════════
    if (path.startsWith('/s/')) {
      try {
        var snapshotId = path.substring(3);
        if (!snapshotId) {
          return new Response('snapshot id required', { status: 400 });
        }
        var raw = await env.ALERT_KV.get('snap_' + snapshotId);
        if (!raw) {
          return new Response(
            '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Not Found</title>'
            + '<style>body{background:#111;color:#fff;font-family:sans-serif;text-align:center;padding:60px 20px;}</style>'
            + '</head><body><h1>스냅샷을 찾을 수 없습니다</h1><p>' + snapshotId + '</p></body></html>',
            { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
          );
        }
        var snap = JSON.parse(raw);
        var html = renderSnapshotHTML(snap, snapshotId);
        return new Response(html, {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8' }
        });
      } catch(e) {
        return new Response('Error: ' + e.message, { status: 500 });
      }
    }


    return new Response(JSON.stringify({ error: 'not found', path: path }),
      { status: 404, headers: cors });
  } catch(e) {
    return new Response(JSON.stringify({ error: e.message }),
      { status: 500, headers: cors });
  }
}

// ══════════════════════════════════════════════════════════════════
// Export — Cloudflare Workers 모듈 형식
// ══════════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════════════
// [11] MAIN HANDLER — Cloudflare Workers fetch/scheduled
// ════════════════════════════════════════════════════════════════════

export default {
  async fetch(request, env, ctx) {
    _envRef = env;  // Service Binding용 전역 참조
    return handleRequest(request, env);
  },
  async scheduled(event, env, ctx) {
    _envRef = env;  // Service Binding용 전역 참조
    ctx.waitUntil(runScan(env));
    // [Phase 3.2-B] 분석기 추적 사이클 — runScan 과 병렬 실행
    // ctx.waitUntil 별도 호출로 두 작업을 독립 실행 (한쪽 실패가 다른쪽 막지 않음)
    ctx.waitUntil(runTrackingCycle(env));
  },
};