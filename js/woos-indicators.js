/* WOOS Indicators (지표 계산 세트)
 * Base:    v4.9.5+phase2-v0-shadow-backfill-hotfix-r1
 * Current: v5.2.5 (본체 동기화 — 보조 해석 외부화 패치. indicators 자체 변경 0건)
 *
 * 본체 index.html line 9615~9719 (~105줄)에서 통째 이전.
 * 본문/시그니처 변경 X / window alias 유지로 호출처 미터치.
 *
 * 포함 함수 9종:
 *   calcRSI / calcOBV / calcMFI / calcVolumeSpike
 *   calcBoxRange (★ 동결) / calcEMA / calcBTCFilter
 *   calcATR (★ 동결) / detectSMC
 *
 * 호출처 (모두 window alias로 도달):
 *   index.html 9681~9683 — calcBTCFilter 내부에서 calcRSI/calcEMA 호출
 *   index.html 10516~10522 — analyzeSymbolForExchange 지표 7종 호출
 *   index.html 10715 — startScan에서 calcBTCFilter 호출
 */
(function (global) {
  'use strict';

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
    return{trend:trend,leading:obvChange>priceChange*1.3,divergence:priceChange>0.02&&obvChange<-0.01};
  }

  function calcMFI(candles,period){
    period=period||14;if(candles.length<period+1) return 50;
    var posF=0,negF=0,prevTP=(candles[candles.length-period-1].high+candles[candles.length-period-1].low+candles[candles.length-period-1].close)/3;
    for(var i=candles.length-period;i<candles.length;i++){var tp=(candles[i].high+candles[i].low+candles[i].close)/3,mf=tp*candles[i].volume;if(tp>prevTP)posF+=mf;else negF+=mf;prevTP=tp;}
    if(negF===0) return 100;
    return parseFloat((100-100/(1+posF/negF)).toFixed(1));
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
    return{ratio:ratio,accel:accel,isSpike:ratio>=1.5,trend:trend,gradual:trend==='increasing'&&ratio>=1.1&&ratio<1.8};
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

  function calcEMA(data,period){
    if(data.length<period) return[];
    var k=2/(period+1),sum=0;
    for(var i=0;i<period;i++) sum+=data[i];
    var ema=[sum/period];
    for(var i=period;i<data.length;i++) ema.push(data[i]*k+ema[ema.length-1]*(1-k));
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
    return{trend:penalty>=2?'bear':penalty>=0.5?'neutral':'bull',penalty:parseFloat(penalty.toFixed(1)),desc:descs.join('/')||'정상',rsi:rsi};
  }

  function calcATR(candles,period){
    period=period||14;if(candles.length<period+1) return candles[candles.length-1].high-candles[candles.length-1].low;
    var tr=[];
    for(var i=1;i<candles.length;i++){var h=candles[i].high,l=candles[i].low,pc=candles[i-1].close;tr.push(Math.max(h-l,Math.abs(h-pc),Math.abs(l-pc)));}
    var atr=tr.slice(0,period).reduce(function(a,b){return a+b;},0)/period;
    for(var i=period;i<tr.length;i++) atr=(atr*(period-1)+tr[i])/period;
    return atr;
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
    signals.forEach(function(s){if(s.indexOf('BOS↑')>=0||s.indexOf('CHoCH↑')>=0||s.indexOf('유동성')>=0)bull++;if(s.indexOf('CHoCH↓')>=0)bear++;});
    var summary=signals.length===0?'〰️ SMC: 신호 없음':bull>bear?'📈 SMC: 상승 우세':bear>bull?'📉 SMC: 하락 우세':'〰️ SMC: 혼조';
    return{signals:signals,summary:summary,direction:bull>bear?'bull':bear>bull?'bear':'neutral'};
  }

  /* ─── 모듈 노출 ─── */
  global.WOOSIndicators = {
    VERSION: 'v5.2.5',
    calcRSI: calcRSI,
    calcOBV: calcOBV,
    calcMFI: calcMFI,
    calcVolumeSpike: calcVolumeSpike,
    calcBoxRange: calcBoxRange,
    calcEMA: calcEMA,
    calcBTCFilter: calcBTCFilter,
    calcATR: calcATR,
    detectSMC: detectSMC
  };

  /* ─── window alias (본체 호출처 미터치) ─── */
  global.calcRSI = calcRSI;
  global.calcOBV = calcOBV;
  global.calcMFI = calcMFI;
  global.calcVolumeSpike = calcVolumeSpike;
  global.calcBoxRange = calcBoxRange;
  global.calcEMA = calcEMA;
  global.calcBTCFilter = calcBTCFilter;
  global.calcATR = calcATR;
  global.detectSMC = detectSMC;

  try {
    if (typeof console !== 'undefined' && console.log) {
      console.log('[WOOS Indicators] loaded — VERSION =', global.WOOSIndicators.VERSION);
    }
  } catch (e) {}
})(typeof window !== 'undefined' ? window : globalThis);
