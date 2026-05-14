/**
 * WS3 v0.2.0-b — V3 Indicator Function Skeleton (Config-Driven)
 *
 * 정규화된 Bithumb candles를 입력으로 받아
 * V3 featurePayload가 사용할 기본 indicator snapshot을 계산한다.
 *
 * 핵심 설계 원칙 (작업지시서 §2):
 *   - MA / EMA / RSI / MFI / OBV / ATR / 거래량 / 캔들구조 기준값은
 *     함수 내부에 고정하지 않고 config override 가능하게 설계
 *   - 함수 내부 곳곳에 임계값 흩뿌리지 않음
 *   - DEFAULT_INDICATOR_CONFIG에 기본값 모음
 *   - 나중에 v3-config.js로 옮기기 쉬운 구조
 *
 * 절대 원칙 (작업지시서 §9):
 *   - 외부 API 호출 / fetch 금지
 *   - DOM / localStorage / KV / Telegram 접근 금지
 *   - UI 렌더링 / 기존 WOOS 상태값 접근 금지
 *   - console spam / 자동 실행 금지
 *   - 실패 시 throw 대신 safe result 반환
 *
 * 미포함 (작업지시서 §12):
 *   externalConfluence / bithumbOfficial / LW / SeoulKIM
 *   Telegram / news / snapshot / marketCap / sector
 *   strategyBias / entryPlan / exitPlan
 *   scoreBreakdown / grade / signalCycle
 *   cardViewModel / renderer
 *
 * 캔들패턴 정책 (작업지시서 §7):
 *   - 전통 캔들패턴명 (도지/망치형/장악형 등) 구현 X
 *   - V3에서 캔들패턴 = structureBucket 판단용 candleStructureFeatures 보조값
 *   - structureBucket 최종 판정은 WS3 v0.4.0에서 다룸
 *
 * 기준 백서: WOOS_Scanner_V3_개발백서_v0_3_3.md
 * Baseline: v3-config.js / v3-feature-payload.js / v3-bithumb-client.js / v3-candle-normalizer.js
 */

(function (global) {
  'use strict';

  const INDICATOR_VERSION = 'WS3_v0.2.0-b';
  const CONFIG_VERSION = 'inline-default-v0';

  // ==========================================================================
  // §8 DEFAULT_INDICATOR_CONFIG — 모든 기준값 집중 관리
  // 함수 내부 하드코딩 금지. config override 가능하게 설계.
  // ==========================================================================

  const DEFAULT_INDICATOR_CONFIG = Object.freeze({
    ma: {
      periods: [10, 20, 50],
      optionalPeriods: [100, 200],
      trendFlatTolerancePct: 0.15
    },
    ema: {
      periods: [12, 26]
    },
    rsi: {
      period: 14,
      oversold: 30,
      neutralLow: 45,
      neutralHigh: 55,
      strong: 60,
      overbought: 70,
      overheated: 80
    },
    mfi: {
      period: 14,
      low: 35,
      neutralLow: 45,
      buyPressure: 60,
      strongBuyPressure: 70,
      overheated: 85
    },
    obv: {
      trendLookback: 10,
      flatTolerancePct: 0.3
    },
    atr: {
      period: 14
    },
    volume: {
      averagePeriod: 20,
      shortPeriod: 5,
      lowRatio: 0.7,
      risingRatio: 1.2,
      surgeRatio: 2.0,
      extremeRatio: 4.0
    },
    tradeValue: {
      averagePeriod: 20
    },
    candleStructure: {
      lookback: 40,
      boxLookback: 40,
      touchTolerancePct: 0.5,
      longWickRatio: 0.45,
      wideRangeMultiplier: 1.8,
      closeTopZone: 0.7,
      closeBottomZone: 0.3,
      sweepTolerancePct: 0.3,
      reclaimClosePosition: 0.5
    }
  });

  /**
   * config override를 default에 안전하게 merge.
   * deep merge는 필요한 수준까지만.
   */
  function mergeIndicatorConfig(config = {}) {
    const c = config || {};
    return {
      ma: { ...DEFAULT_INDICATOR_CONFIG.ma, ...(c.ma || {}) },
      ema: { ...DEFAULT_INDICATOR_CONFIG.ema, ...(c.ema || {}) },
      rsi: { ...DEFAULT_INDICATOR_CONFIG.rsi, ...(c.rsi || {}) },
      mfi: { ...DEFAULT_INDICATOR_CONFIG.mfi, ...(c.mfi || {}) },
      obv: { ...DEFAULT_INDICATOR_CONFIG.obv, ...(c.obv || {}) },
      atr: { ...DEFAULT_INDICATOR_CONFIG.atr, ...(c.atr || {}) },
      volume: { ...DEFAULT_INDICATOR_CONFIG.volume, ...(c.volume || {}) },
      tradeValue: { ...DEFAULT_INDICATOR_CONFIG.tradeValue, ...(c.tradeValue || {}) },
      candleStructure: {
        ...DEFAULT_INDICATOR_CONFIG.candleStructure,
        ...(c.candleStructure || {})
      }
    };
  }

  // ==========================================================================
  // §11.1 Config / 공통 유틸
  // ==========================================================================

  /**
   * 안전한 숫자 변환. 숫자가 아니면 fallback 반환.
   */
  function safeNumber(value, fallback = null) {
    if (value === null || value === undefined) return fallback;
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : fallback;
    }
    if (typeof value === 'string' && value.trim() !== '') {
      const n = Number(value);
      return Number.isFinite(n) ? n : fallback;
    }
    return fallback;
  }

  /**
   * candle 객체에서 필드값을 안전하게 추출.
   * v3-candle-normalizer.js의 정확한 필드명을 모를 경우를 대비해
   * 여러 후보 키 + 배열 OHLCV 형태도 지원.
   * (작업지시서 §5: "필드명이 다르면 indicator 쪽에서 임의 변환하지 말고 helper로 안전하게 읽는다")
   */
  function readCandleField(candle, keys) {
    if (candle === null || candle === undefined) return null;

    // 배열 OHLCV 형태 지원 [timestamp, open, high, low, close, volume, value?]
    if (Array.isArray(candle)) {
      const arrayIndexMap = {
        timestamp: 0, t: 0, time: 0,
        open: 1, o: 1,
        high: 2, h: 2,
        low: 3, l: 3,
        close: 4, c: 4,
        volume: 5, v: 5,
        value: 6, tradeValue: 6, quoteVolume: 6
      };
      for (const key of keys) {
        const idx = arrayIndexMap[key];
        if (idx !== undefined && idx < candle.length) {
          const n = safeNumber(candle[idx]);
          if (n !== null) return n;
        }
      }
      return null;
    }

    // 객체 형태
    if (typeof candle !== 'object') return null;
    for (const key of keys) {
      if (candle[key] !== undefined && candle[key] !== null) {
        const n = safeNumber(candle[key]);
        if (n !== null) return n;
      }
    }
    return null;
  }

  function getOpen(candle) {
    return readCandleField(candle, ['open', 'o', 'openPrice']);
  }

  function getHigh(candle) {
    return readCandleField(candle, ['high', 'h', 'highPrice']);
  }

  function getLow(candle) {
    return readCandleField(candle, ['low', 'l', 'lowPrice']);
  }

  function getClose(candle) {
    return readCandleField(candle, ['close', 'c', 'closePrice']);
  }

  function getVolume(candle) {
    return readCandleField(candle, ['volume', 'v', 'baseVolume', 'vol']);
  }

  function getTradeValue(candle) {
    return readCandleField(candle, ['value', 'tradeValue', 'quoteVolume', 'tradeValueKrw', 'amount']);
  }

  function sliceRecent(candles, length) {
    if (!Array.isArray(candles)) return [];
    if (length <= 0) return [];
    if (candles.length <= length) return candles.slice();
    return candles.slice(candles.length - length);
  }

  function hasEnoughCandles(candles, minLength) {
    return Array.isArray(candles) && candles.length >= minLength;
  }

  function calculatePctChange(from, to) {
    const a = safeNumber(from);
    const b = safeNumber(to);
    if (a === null || b === null || a === 0) return null;
    return ((b - a) / a) * 100;
  }

  function calculateAverage(values) {
    if (!Array.isArray(values) || values.length === 0) return null;
    let sum = 0;
    let count = 0;
    for (const v of values) {
      const n = safeNumber(v);
      if (n !== null) {
        sum += n;
        count += 1;
      }
    }
    if (count === 0) return null;
    return sum / count;
  }

  /** candles → close 배열 추출 helper */
  function extractCloses(candles) {
    if (!Array.isArray(candles)) return [];
    const out = [];
    for (const c of candles) {
      const v = getClose(c);
      if (v !== null) out.push(v);
    }
    return out;
  }

  // ==========================================================================
  // §11.2 이동평균 MA / EMA
  // ==========================================================================

  /**
   * 단순 이동평균. 마지막 period 개의 평균.
   * values 배열 (숫자) 또는 candles 배열 모두 허용.
   */
  function calculateSMA(values, period) {
    if (!Array.isArray(values) || values.length < period || period <= 0) {
      return null;
    }
    const slice = values.slice(values.length - period);
    return calculateAverage(slice);
  }

  /**
   * 지수 이동평균. 마지막 값.
   * 표준 EMA 공식: EMA_t = price_t * k + EMA_{t-1} * (1-k), k = 2/(period+1)
   * 초기값은 첫 period 개의 SMA.
   */
  function calculateEMA(values, period) {
    if (!Array.isArray(values) || values.length < period || period <= 0) {
      return null;
    }
    const k = 2 / (period + 1);
    // 시드 SMA
    let ema = calculateAverage(values.slice(0, period));
    if (ema === null) return null;
    for (let i = period; i < values.length; i++) {
      const v = safeNumber(values[i]);
      if (v === null) continue;
      ema = v * k + ema * (1 - k);
    }
    return ema;
  }

  /**
   * MA 상태 종합. config.ma.periods로 기간 수정 가능.
   */
  function calculateMAState(candles, config = {}) {
    const cfg = mergeIndicatorConfig(config);
    const periods = cfg.ma.periods;
    const optionalPeriods = cfg.ma.optionalPeriods;
    const flatTol = cfg.ma.trendFlatTolerancePct;

    const closes = extractCloses(candles);
    if (closes.length === 0) {
      return {
        valid: false,
        reason: 'NOT_ENOUGH_CANDLES',
        configUsed: { periods, optionalPeriods }
      };
    }

    const lastClose = closes[closes.length - 1];

    const values = {};
    const closeAbove = {};

    for (const p of periods) {
      const ma = calculateSMA(closes, p);
      const key = `ma${p}`;
      values[key] = ma;
      closeAbove[key] = (ma !== null) ? (lastClose >= ma) : null;
    }
    for (const p of optionalPeriods) {
      if (closes.length >= p) {
        const ma = calculateSMA(closes, p);
        const key = `ma${p}`;
        values[key] = ma;
        closeAbove[key] = (ma !== null) ? (lastClose >= ma) : null;
      }
    }

    // trendLabel — 상태 라벨 수준. 과도한 판단 X.
    let trendLabel = 'MA_UNKNOWN';
    const main = periods.slice().sort((a, b) => a - b); // 짧은 → 긴
    const orderedMAs = main.map(p => values[`ma${p}`]);
    if (orderedMAs.every(v => v !== null)) {
      const allAscending = orderedMAs.every((v, i, arr) => i === 0 || arr[i - 1] >= v);
      const allDescending = orderedMAs.every((v, i, arr) => i === 0 || arr[i - 1] <= v);
      const aboveAll = main.every(p => closeAbove[`ma${p}`] === true);
      const belowAll = main.every(p => closeAbove[`ma${p}`] === false);

      // flat 판정 (가장 짧은 MA 대비 가장 긴 MA의 차이)
      const shortMA = orderedMAs[0];
      const longMA = orderedMAs[orderedMAs.length - 1];
      const diffPct = shortMA !== 0 ? Math.abs((shortMA - longMA) / shortMA) * 100 : 0;

      if (diffPct < flatTol) {
        trendLabel = 'MA_FLAT';
      } else if (aboveAll && allAscending) {
        trendLabel = 'MA_BULLISH';
      } else if (belowAll && allDescending) {
        trendLabel = 'MA_BEARISH';
      } else if (aboveAll) {
        trendLabel = 'MA_ABOVE_MIXED';
      } else if (belowAll) {
        trendLabel = 'MA_BELOW_MIXED';
      } else {
        trendLabel = 'MA_MIXED';
      }
    }

    return {
      valid: true,
      values,
      closeAbove,
      trendLabel,
      configUsed: {
        periods,
        optionalPeriods,
        trendFlatTolerancePct: flatTol
      }
    };
  }

  // ==========================================================================
  // §11.3 RSI
  // ==========================================================================

  /**
   * RSI (Wilder smoothing).
   * config.rsi.period / oversold / strong / overbought / overheated 수정 가능.
   */
  function calculateRSI(candles, config = {}) {
    const cfg = mergeIndicatorConfig(config);
    const r = cfg.rsi;
    const period = r.period;

    const closes = extractCloses(candles);
    if (closes.length < period + 1) {
      return {
        valid: false,
        value: null,
        state: 'UNKNOWN',
        reason: 'NOT_ENOUGH_CANDLES',
        configUsed: r
      };
    }

    let gainSum = 0;
    let lossSum = 0;
    // 초기 평균
    for (let i = 1; i <= period; i++) {
      const diff = closes[i] - closes[i - 1];
      if (diff >= 0) gainSum += diff;
      else lossSum -= diff;
    }
    let avgGain = gainSum / period;
    let avgLoss = lossSum / period;

    // Wilder smoothing
    for (let i = period + 1; i < closes.length; i++) {
      const diff = closes[i] - closes[i - 1];
      const gain = diff > 0 ? diff : 0;
      const loss = diff < 0 ? -diff : 0;
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
    }

    let rsi;
    if (avgLoss === 0) {
      rsi = 100;
    } else {
      const rs = avgGain / avgLoss;
      rsi = 100 - (100 / (1 + rs));
    }

    let state = 'NEUTRAL';
    if (rsi >= r.overheated) state = 'OVERHEATED';
    else if (rsi >= r.overbought) state = 'OVERBOUGHT';
    else if (rsi >= r.strong) state = 'STRONG';
    else if (rsi <= r.oversold) state = 'OVERSOLD';
    else state = 'NEUTRAL';

    return {
      valid: true,
      value: Math.round(rsi * 100) / 100,
      state,
      configUsed: r
    };
  }

  // ==========================================================================
  // §11.4 MFI
  // ==========================================================================

  /**
   * Money Flow Index.
   * config.mfi.period / low / buyPressure / strongBuyPressure / overheated 수정 가능.
   */
  function calculateMFI(candles, config = {}) {
    const cfg = mergeIndicatorConfig(config);
    const m = cfg.mfi;
    const period = m.period;

    if (!hasEnoughCandles(candles, period + 1)) {
      return {
        valid: false,
        value: null,
        state: 'UNKNOWN',
        reason: 'NOT_ENOUGH_CANDLES',
        configUsed: m
      };
    }

    const recent = sliceRecent(candles, period + 1);
    let positiveFlow = 0;
    let negativeFlow = 0;
    let prevTP = null;

    for (let i = 0; i < recent.length; i++) {
      const h = getHigh(recent[i]);
      const l = getLow(recent[i]);
      const c = getClose(recent[i]);
      const v = getVolume(recent[i]);
      if (h === null || l === null || c === null || v === null) {
        prevTP = null;
        continue;
      }
      const tp = (h + l + c) / 3;
      const rmf = tp * v;
      if (prevTP !== null) {
        if (tp > prevTP) positiveFlow += rmf;
        else if (tp < prevTP) negativeFlow += rmf;
      }
      prevTP = tp;
    }

    let mfi;
    if (negativeFlow === 0) {
      mfi = positiveFlow === 0 ? 50 : 100;
    } else {
      const mfr = positiveFlow / negativeFlow;
      mfi = 100 - (100 / (1 + mfr));
    }

    let state = 'NEUTRAL';
    if (mfi >= m.overheated) state = 'OVERHEATED';
    else if (mfi >= m.strongBuyPressure) state = 'STRONG_BUY_PRESSURE';
    else if (mfi >= m.buyPressure) state = 'BUY_PRESSURE';
    else if (mfi <= m.low) state = 'LOW';
    else state = 'NEUTRAL';

    return {
      valid: true,
      value: Math.round(mfi * 100) / 100,
      state,
      configUsed: m
    };
  }

  // ==========================================================================
  // §11.5 OBV
  // ==========================================================================

  function calculateOBV(candles) {
    if (!Array.isArray(candles) || candles.length < 2) {
      return {
        valid: false,
        series: [],
        last: null,
        reason: 'NOT_ENOUGH_CANDLES'
      };
    }
    const series = [];
    let obv = 0;
    let prevClose = getClose(candles[0]);
    series.push(0);
    for (let i = 1; i < candles.length; i++) {
      const close = getClose(candles[i]);
      const volume = getVolume(candles[i]);
      if (close === null || volume === null || prevClose === null) {
        series.push(obv);
        prevClose = close !== null ? close : prevClose;
        continue;
      }
      if (close > prevClose) obv += volume;
      else if (close < prevClose) obv -= volume;
      // close === prevClose이면 변동 없음
      series.push(obv);
      prevClose = close;
    }
    return {
      valid: true,
      series,
      last: obv
    };
  }

  /**
   * OBV trend. config.obv.trendLookback / flatTolerancePct 수정 가능.
   */
  function calculateOBVTrend(candles, config = {}) {
    const cfg = mergeIndicatorConfig(config);
    const o = cfg.obv;
    const lookback = o.trendLookback;
    const flatTol = o.flatTolerancePct;

    const obvResult = calculateOBV(candles);
    if (!obvResult.valid) {
      return {
        valid: false,
        current: null,
        previous: null,
        trend: 'UNKNOWN',
        reason: obvResult.reason,
        configUsed: o
      };
    }
    const series = obvResult.series;
    if (series.length < lookback + 1) {
      return {
        valid: false,
        current: series[series.length - 1] ?? null,
        previous: null,
        trend: 'UNKNOWN',
        reason: 'NOT_ENOUGH_CANDLES',
        configUsed: o
      };
    }

    const current = series[series.length - 1];
    const previous = series[series.length - 1 - lookback];

    let trend = 'FLAT';
    if (previous === 0) {
      trend = current > 0 ? 'UP' : current < 0 ? 'DOWN' : 'FLAT';
    } else {
      const changePct = Math.abs((current - previous) / Math.abs(previous)) * 100;
      if (changePct < flatTol) {
        trend = 'FLAT';
      } else if (current > previous) {
        trend = 'UP';
      } else if (current < previous) {
        trend = 'DOWN';
      }
    }

    return {
      valid: true,
      current,
      previous,
      trend,
      configUsed: o
    };
  }

  // ==========================================================================
  // §11.6 ATR
  // ==========================================================================

  /**
   * Average True Range (Wilder).
   * config.atr.period 수정 가능.
   * atrPct = (atr / lastClose) * 100
   */
  function calculateATR(candles, config = {}) {
    const cfg = mergeIndicatorConfig(config);
    const a = cfg.atr;
    const period = a.period;

    if (!hasEnoughCandles(candles, period + 1)) {
      return {
        valid: false,
        value: null,
        atrPct: null,
        reason: 'NOT_ENOUGH_CANDLES',
        configUsed: a
      };
    }

    const trs = [];
    for (let i = 1; i < candles.length; i++) {
      const h = getHigh(candles[i]);
      const l = getLow(candles[i]);
      const prevClose = getClose(candles[i - 1]);
      if (h === null || l === null || prevClose === null) {
        trs.push(null);
        continue;
      }
      const tr = Math.max(
        h - l,
        Math.abs(h - prevClose),
        Math.abs(l - prevClose)
      );
      trs.push(tr);
    }
    const validTrs = trs.filter(v => v !== null);
    if (validTrs.length < period) {
      return {
        valid: false,
        value: null,
        atrPct: null,
        reason: 'NOT_ENOUGH_CANDLES',
        configUsed: a
      };
    }

    // 초기 ATR = SMA of first period
    let atr = calculateAverage(validTrs.slice(0, period));
    if (atr === null) {
      return {
        valid: false,
        value: null,
        atrPct: null,
        reason: 'CALC_FAILED',
        configUsed: a
      };
    }
    // Wilder smoothing
    for (let i = period; i < validTrs.length; i++) {
      atr = (atr * (period - 1) + validTrs[i]) / period;
    }

    const lastClose = getClose(candles[candles.length - 1]);
    const atrPct = (lastClose !== null && lastClose !== 0)
      ? (atr / lastClose) * 100
      : null;

    return {
      valid: true,
      value: Math.round(atr * 1000000) / 1000000,
      atrPct: atrPct !== null ? Math.round(atrPct * 100) / 100 : null,
      configUsed: a
    };
  }

  // ==========================================================================
  // §11.7 거래량 / 거래대금
  // ==========================================================================

  function calculateVolumeStats(candles, config = {}) {
    const cfg = mergeIndicatorConfig(config);
    const v = cfg.volume;
    const avgPeriod = v.averagePeriod;

    if (!hasEnoughCandles(candles, avgPeriod + 1)) {
      return {
        valid: false,
        currentVolume: null,
        avgVolume: null,
        volRatio: null,
        volumeState: 'UNKNOWN',
        reason: 'NOT_ENOUGH_CANDLES',
        configUsed: v
      };
    }

    const last = candles[candles.length - 1];
    const currentVolume = getVolume(last);
    // 현재 봉 제외 평균
    const prevSlice = candles.slice(candles.length - 1 - avgPeriod, candles.length - 1);
    const prevVols = prevSlice.map(getVolume).filter(x => x !== null);
    const avgVolume = calculateAverage(prevVols);

    if (currentVolume === null || avgVolume === null || avgVolume === 0) {
      return {
        valid: false,
        currentVolume,
        avgVolume,
        volRatio: null,
        volumeState: 'UNKNOWN',
        reason: 'CALC_FAILED',
        configUsed: v
      };
    }

    const volRatio = currentVolume / avgVolume;
    let volumeState = 'NORMAL';
    if (volRatio >= v.extremeRatio) volumeState = 'EXTREME';
    else if (volRatio >= v.surgeRatio) volumeState = 'SURGE';
    else if (volRatio >= v.risingRatio) volumeState = 'RISING';
    else if (volRatio < v.lowRatio) volumeState = 'LOW';

    return {
      valid: true,
      currentVolume,
      avgVolume,
      volRatio: Math.round(volRatio * 100) / 100,
      volumeState,
      configUsed: {
        averagePeriod: v.averagePeriod,
        lowRatio: v.lowRatio,
        risingRatio: v.risingRatio,
        surgeRatio: v.surgeRatio,
        extremeRatio: v.extremeRatio
      }
    };
  }

  /**
   * 거래량 가속도 = (최근 shortPeriod 평균) / (전체 averagePeriod 평균).
   */
  function calculateVolumeAcceleration(candles, config = {}) {
    const cfg = mergeIndicatorConfig(config);
    const v = cfg.volume;
    const shortP = v.shortPeriod;
    const avgP = v.averagePeriod;

    if (!hasEnoughCandles(candles, avgP)) {
      return {
        valid: false,
        volAccel: null,
        reason: 'NOT_ENOUGH_CANDLES',
        configUsed: v
      };
    }

    const shortVols = sliceRecent(candles, shortP).map(getVolume).filter(x => x !== null);
    const longVols = sliceRecent(candles, avgP).map(getVolume).filter(x => x !== null);
    const shortAvg = calculateAverage(shortVols);
    const longAvg = calculateAverage(longVols);

    if (shortAvg === null || longAvg === null || longAvg === 0) {
      return {
        valid: false,
        volAccel: null,
        reason: 'CALC_FAILED',
        configUsed: v
      };
    }

    const volAccel = shortAvg / longAvg;
    return {
      valid: true,
      volAccel: Math.round(volAccel * 100) / 100,
      shortAvg,
      longAvg,
      configUsed: {
        shortPeriod: v.shortPeriod,
        averagePeriod: v.averagePeriod
      }
    };
  }

  function calculateTradeValueStats(candles, config = {}) {
    const cfg = mergeIndicatorConfig(config);
    const t = cfg.tradeValue;
    const avgPeriod = t.averagePeriod;

    if (!hasEnoughCandles(candles, avgPeriod + 1)) {
      return {
        valid: false,
        currentTradeValueKrw: null,
        avgTradeValueKrw: null,
        tradeValueRatio: null,
        reason: 'NOT_ENOUGH_CANDLES',
        configUsed: t
      };
    }

    const last = candles[candles.length - 1];
    const currentTV = getTradeValue(last);
    const prevSlice = candles.slice(candles.length - 1 - avgPeriod, candles.length - 1);
    const prevTVs = prevSlice.map(getTradeValue).filter(x => x !== null);
    const avgTV = calculateAverage(prevTVs);

    if (currentTV === null || avgTV === null) {
      return {
        valid: false,
        currentTradeValueKrw: currentTV,
        avgTradeValueKrw: avgTV,
        tradeValueRatio: null,
        reason: 'CALC_FAILED',
        configUsed: t
      };
    }

    const ratio = avgTV === 0 ? null : currentTV / avgTV;

    return {
      valid: true,
      currentTradeValueKrw: currentTV,
      avgTradeValueKrw: avgTV,
      tradeValueRatio: ratio !== null ? Math.round(ratio * 100) / 100 : null,
      configUsed: { averagePeriod: t.averagePeriod }
    };
  }

  // ==========================================================================
  // §11.8 캔들 구조 특징 (전통 패턴명 X, candleStructureFeatures O)
  // ==========================================================================

  /**
   * 단일 candle의 모양(구조) 보조값.
   * - body / wick / range / closePosition / direction / flags
   * - 전통 패턴명 (doji/hammer/engulfing 등) X
   */
  function calculateCandleShape(candle, config = {}) {
    const cfg = mergeIndicatorConfig(config);
    const cs = cfg.candleStructure;

    const open = getOpen(candle);
    const high = getHigh(candle);
    const low = getLow(candle);
    const close = getClose(candle);

    if (open === null || high === null || low === null || close === null) {
      return {
        valid: false,
        reason: 'MISSING_OHLC'
      };
    }

    const range = high - low;
    const body = Math.abs(close - open);
    const upperWick = high - Math.max(open, close);
    const lowerWick = Math.min(open, close) - low;

    const bodyPct = range > 0 ? (body / range) * 100 : 0;
    const upperWickPct = range > 0 ? (upperWick / range) * 100 : 0;
    const lowerWickPct = range > 0 ? (lowerWick / range) * 100 : 0;

    // closePosition: close가 range 내 어디에 있는지 (0=low, 1=high)
    const closePosition = range > 0 ? (close - low) / range : 0.5;

    let direction = 'NEUTRAL';
    if (close > open) direction = 'BULLISH';
    else if (close < open) direction = 'BEARISH';

    const flags = {
      longUpperWick: range > 0 && (upperWick / range) >= cs.longWickRatio,
      longLowerWick: range > 0 && (lowerWick / range) >= cs.longWickRatio,
      wideRange: false,  // 단일 candle만으로는 판정 불가. Series에서 채움
      closeNearHigh: closePosition >= cs.closeTopZone,
      closeNearLow: closePosition <= cs.closeBottomZone
    };

    return {
      valid: true,
      open,
      high,
      low,
      close,
      range: Math.round(range * 1000000) / 1000000,
      body: Math.round(body * 1000000) / 1000000,
      bodyPct: Math.round(bodyPct * 100) / 100,
      upperWick: Math.round(upperWick * 1000000) / 1000000,
      lowerWick: Math.round(lowerWick * 1000000) / 1000000,
      upperWickPct: Math.round(upperWickPct * 100) / 100,
      lowerWickPct: Math.round(lowerWickPct * 100) / 100,
      closePosition: Math.round(closePosition * 1000) / 1000,
      direction,
      flags
    };
  }

  /**
   * candle series에서 각 봉의 모양 + wideRange 판정 추가.
   * wideRange = 해당 봉 range >= (평균 range * wideRangeMultiplier)
   */
  function calculateCandleShapeSeries(candles, config = {}) {
    const cfg = mergeIndicatorConfig(config);
    const cs = cfg.candleStructure;

    if (!hasEnoughCandles(candles, 1)) {
      return {
        valid: false,
        shapes: [],
        reason: 'NOT_ENOUGH_CANDLES',
        configUsed: cs
      };
    }

    const lookback = Math.min(cs.lookback, candles.length);
    const recent = sliceRecent(candles, lookback);

    // 각 봉 모양
    const shapes = recent.map(c => calculateCandleShape(c, config));

    // 평균 range
    const ranges = shapes.filter(s => s.valid).map(s => s.range);
    const avgRange = calculateAverage(ranges);

    // wideRange 표식
    if (avgRange !== null && avgRange > 0) {
      for (const s of shapes) {
        if (s.valid && typeof s.range === 'number') {
          s.flags.wideRange = s.range >= avgRange * cs.wideRangeMultiplier;
        }
      }
    }

    return {
      valid: true,
      shapes,
      avgRange: avgRange !== null ? Math.round(avgRange * 1000000) / 1000000 : null,
      configUsed: {
        lookback: cs.lookback,
        wideRangeMultiplier: cs.wideRangeMultiplier,
        longWickRatio: cs.longWickRatio,
        closeTopZone: cs.closeTopZone,
        closeBottomZone: cs.closeBottomZone
      }
    };
  }

  /**
   * 최근 N봉의 캔들 구조 요약. structureBucket 확정이 아니라 보조 통계만.
   */
  function calculateRecentCandleStructure(candles, config = {}) {
    const cfg = mergeIndicatorConfig(config);
    const cs = cfg.candleStructure;
    const lookback = Math.min(cs.lookback, Array.isArray(candles) ? candles.length : 0);

    const series = calculateCandleShapeSeries(sliceRecent(candles, lookback), config);
    if (!series.valid) {
      return {
        valid: false,
        reason: series.reason,
        configUsed: cs
      };
    }

    const validShapes = series.shapes.filter(s => s.valid);
    if (validShapes.length === 0) {
      return {
        valid: false,
        reason: 'NO_VALID_SHAPES',
        configUsed: cs
      };
    }

    let bullCount = 0;
    let bearCount = 0;
    let neutralCount = 0;
    let longUpperWickCount = 0;
    let longLowerWickCount = 0;
    let wideRangeCount = 0;
    let closeNearHighCount = 0;
    let closeNearLowCount = 0;

    for (const s of validShapes) {
      if (s.direction === 'BULLISH') bullCount++;
      else if (s.direction === 'BEARISH') bearCount++;
      else neutralCount++;
      if (s.flags.longUpperWick) longUpperWickCount++;
      if (s.flags.longLowerWick) longLowerWickCount++;
      if (s.flags.wideRange) wideRangeCount++;
      if (s.flags.closeNearHigh) closeNearHighCount++;
      if (s.flags.closeNearLow) closeNearLowCount++;
    }

    const total = validShapes.length;
    const last = validShapes[validShapes.length - 1];

    return {
      valid: true,
      sampleSize: total,
      counts: {
        bullish: bullCount,
        bearish: bearCount,
        neutral: neutralCount,
        longUpperWick: longUpperWickCount,
        longLowerWick: longLowerWickCount,
        wideRange: wideRangeCount,
        closeNearHigh: closeNearHighCount,
        closeNearLow: closeNearLowCount
      },
      pct: {
        bullishPct: Math.round((bullCount / total) * 10000) / 100,
        bearishPct: Math.round((bearCount / total) * 10000) / 100,
        wideRangePct: Math.round((wideRangeCount / total) * 10000) / 100
      },
      lastCandle: last,
      avgRange: series.avgRange,
      configUsed: {
        lookback: cs.lookback,
        longWickRatio: cs.longWickRatio,
        wideRangeMultiplier: cs.wideRangeMultiplier
      }
    };
  }

  // ==========================================================================
  // §11.9 박스 / 구조 보조 Skeleton
  // structureBucket 최종 판정 X. 기초값만 계산.
  // ==========================================================================

  /**
   * 최근 N봉 박스 (최고/최저) + 터치 카운트 + 위치.
   */
  function detectRecentHighLowBox(candles, config = {}) {
    const cfg = mergeIndicatorConfig(config);
    const cs = cfg.candleStructure;
    const lookback = cs.boxLookback;
    const tolPct = cs.touchTolerancePct;

    if (!hasEnoughCandles(candles, Math.min(lookback, 5))) {
      return {
        valid: false,
        reason: 'NOT_ENOUGH_CANDLES',
        configUsed: { boxLookback: lookback, touchTolerancePct: tolPct }
      };
    }

    const recent = sliceRecent(candles, lookback);
    let boxHigh = -Infinity;
    let boxLow = Infinity;
    for (const c of recent) {
      const h = getHigh(c);
      const l = getLow(c);
      if (h !== null && h > boxHigh) boxHigh = h;
      if (l !== null && l < boxLow) boxLow = l;
    }
    if (!Number.isFinite(boxHigh) || !Number.isFinite(boxLow)) {
      return {
        valid: false,
        reason: 'NO_VALID_HIGH_LOW',
        configUsed: { boxLookback: lookback, touchTolerancePct: tolPct }
      };
    }
    const boxCenter = (boxHigh + boxLow) / 2;
    const lastClose = getClose(candles[candles.length - 1]);

    const distanceToTopPct = (lastClose !== null && boxHigh !== 0)
      ? ((boxHigh - lastClose) / lastClose) * 100
      : null;
    const distanceToBottomPct = (lastClose !== null && boxLow !== 0)
      ? ((lastClose - boxLow) / lastClose) * 100
      : null;

    const touchesHigh = countLevelTouches(recent, boxHigh, config).touches;
    const touchesLow = countLevelTouches(recent, boxLow, config).touches;

    return {
      valid: true,
      boxHigh,
      boxLow,
      boxCenter,
      distanceToTopPct: distanceToTopPct !== null
        ? Math.round(distanceToTopPct * 100) / 100 : null,
      distanceToBottomPct: distanceToBottomPct !== null
        ? Math.round(distanceToBottomPct * 100) / 100 : null,
      touchesHigh,
      touchesLow,
      configUsed: {
        boxLookback: lookback,
        touchTolerancePct: tolPct
      }
    };
  }

  /**
   * 특정 가격 level에 high/low가 tolerance% 안에 들어온 횟수.
   */
  function countLevelTouches(candles, level, config = {}) {
    const cfg = mergeIndicatorConfig(config);
    const tolPct = cfg.candleStructure.touchTolerancePct;
    if (!Array.isArray(candles) || level === null || level === undefined) {
      return { valid: false, touches: 0, reason: 'INVALID_INPUT' };
    }
    const tol = Math.abs(level) * (tolPct / 100);
    let touches = 0;
    for (const c of candles) {
      const h = getHigh(c);
      const l = getLow(c);
      if (h !== null && Math.abs(h - level) <= tol) touches++;
      else if (l !== null && Math.abs(l - level) <= tol) touches++;
    }
    return {
      valid: true,
      touches,
      level,
      configUsed: { touchTolerancePct: tolPct }
    };
  }

  /**
   * priceZone — 같은 signalCycle 묶음 판단 기초값.
   * 현재 박스 기반 zone 후보를 반환.
   */
  function calculatePriceZone(candles, config = {}) {
    const cfg = mergeIndicatorConfig(config);
    const cs = cfg.candleStructure;
    const box = detectRecentHighLowBox(candles, config);
    if (!box.valid) {
      return {
        valid: false,
        reason: box.reason,
        configUsed: cs
      };
    }
    const last = getClose(candles[candles.length - 1]);
    // 단순 zone 후보: 최근 lookback의 박스 [boxLow, boxHigh] / center
    return {
      valid: true,
      from: box.boxLow,
      to: box.boxHigh,
      center: box.boxCenter,
      lastClose: last,
      source: 'BOX_RECENT',
      bufferType: 'BOX_RANGE',
      configUsed: {
        boxLookback: cs.boxLookback,
        touchTolerancePct: cs.touchTolerancePct
      }
    };
  }

  /**
   * referenceLow 후보 (백서 §7.3 분류).
   * Skeleton — 실제 multi-timeframe은 후속.
   */
  function findReferenceLows(candles, config = {}) {
    const cfg = mergeIndicatorConfig(config);
    const cs = cfg.candleStructure;
    if (!hasEnoughCandles(candles, 5)) {
      return {
        valid: false,
        reason: 'NOT_ENOUGH_CANDLES',
        configUsed: cs
      };
    }

    // 단일 timeframe 기준 — scalpSwingLow (최근 5~20봉 중 최저)
    const scalpWindow = sliceRecent(candles, Math.min(20, candles.length));
    let scalpSwingLow = Infinity;
    for (const c of scalpWindow) {
      const l = getLow(c);
      if (l !== null && l < scalpSwingLow) scalpSwingLow = l;
    }
    if (!Number.isFinite(scalpSwingLow)) scalpSwingLow = null;

    // intradaySwingLow (lookback 절반 정도) - skeleton placeholder
    const intradayWindow = sliceRecent(candles, Math.min(60, candles.length));
    let intradaySwingLow = Infinity;
    for (const c of intradayWindow) {
      const l = getLow(c);
      if (l !== null && l < intradaySwingLow) intradaySwingLow = l;
    }
    if (!Number.isFinite(intradaySwingLow)) intradaySwingLow = null;

    // structuralSwingLow - 충분한 데이터 없으면 null
    let structuralSwingLow = null;
    if (candles.length >= 100) {
      let m = Infinity;
      for (const c of candles) {
        const l = getLow(c);
        if (l !== null && l < m) m = l;
      }
      if (Number.isFinite(m)) structuralSwingLow = m;
    }

    // boxLow
    const box = detectRecentHighLowBox(candles, config);
    const boxLow = box.valid ? box.boxLow : null;

    // orderBlockLow — 이번 단계에서는 null. 후속 구현.
    const orderBlockLow = null;

    return {
      valid: true,
      scalpSwingLow,
      intradaySwingLow,
      structuralSwingLow,
      boxLow,
      orderBlockLow,
      configUsed: {
        boxLookback: cs.boxLookback
      }
    };
  }

  /**
   * sweep / reclaim 후보 — structureBucket 확정 X. 후보 플래그만.
   * lowSweep: 직전 N봉 최저 살짝 깬 뒤 회복 close
   * highSweep: 직전 N봉 최고 살짝 넘은 뒤 회복 종가 (역방향)
   * reclaim: 종가가 close position 임계 이상 회복
   */
  function detectSweepReclaimCandidates(candles, config = {}) {
    const cfg = mergeIndicatorConfig(config);
    const cs = cfg.candleStructure;
    const sweepTolPct = cs.sweepTolerancePct;
    const reclaimCP = cs.reclaimClosePosition;

    if (!hasEnoughCandles(candles, 5)) {
      return {
        valid: false,
        reason: 'NOT_ENOUGH_CANDLES',
        configUsed: { sweepTolerancePct: sweepTolPct, reclaimClosePosition: reclaimCP }
      };
    }

    const last = candles[candles.length - 1];
    const prevs = candles.slice(0, candles.length - 1);

    const curHigh = getHigh(last);
    const curLow = getLow(last);
    const curClose = getClose(last);
    const curOpen = getOpen(last);

    if (curHigh === null || curLow === null || curClose === null) {
      return {
        valid: false,
        reason: 'MISSING_OHLC',
        configUsed: { sweepTolerancePct: sweepTolPct, reclaimClosePosition: reclaimCP }
      };
    }

    // 직전 N봉의 최저 / 최고
    const prevWindow = sliceRecent(prevs, Math.min(20, prevs.length));
    let prevLow = Infinity;
    let prevHigh = -Infinity;
    for (const c of prevWindow) {
      const l = getLow(c);
      const h = getHigh(c);
      if (l !== null && l < prevLow) prevLow = l;
      if (h !== null && h > prevHigh) prevHigh = h;
    }
    if (!Number.isFinite(prevLow)) prevLow = null;
    if (!Number.isFinite(prevHigh)) prevHigh = null;

    const range = curHigh - curLow;
    const closePosition = range > 0 ? (curClose - curLow) / range : 0.5;

    // lowSweepCandidate: 현재 봉이 prevLow를 sweepTol% 안에서 깼다가 종가 회복
    let lowSweepCandidate = false;
    let closeRecoveredAbovePreviousLow = false;
    if (prevLow !== null) {
      const tol = Math.abs(prevLow) * (sweepTolPct / 100);
      const breachedBelow = curLow < prevLow && (prevLow - curLow) <= tol * 5;
      closeRecoveredAbovePreviousLow = curClose > prevLow;
      lowSweepCandidate = breachedBelow && closeRecoveredAbovePreviousLow;
    }

    // highSweepCandidate: 현재 봉이 prevHigh를 살짝 넘었다가 종가 다시 안쪽
    let highSweepCandidate = false;
    if (prevHigh !== null) {
      const tol = Math.abs(prevHigh) * (sweepTolPct / 100);
      const breachedAbove = curHigh > prevHigh && (curHigh - prevHigh) <= tol * 5;
      const closeBackInside = curClose < prevHigh;
      highSweepCandidate = breachedAbove && closeBackInside;
    }

    // reclaimCandidate: 종가가 range 상단부 (reclaimClosePosition 이상)에 위치
    const reclaimCandidate = closePosition >= reclaimCP;

    return {
      valid: true,
      lowSweepCandidate,
      highSweepCandidate,
      reclaimCandidate,
      details: {
        previousLow: prevLow,
        previousHigh: prevHigh,
        currentLow: curLow,
        currentHigh: curHigh,
        currentClose: curClose,
        currentOpen: curOpen,
        closePosition: Math.round(closePosition * 1000) / 1000,
        closeRecoveredAbovePreviousLow
      },
      configUsed: {
        sweepTolerancePct: sweepTolPct,
        reclaimClosePosition: reclaimCP
      }
    };
  }

  // ==========================================================================
  // §11.10 통합 Indicator Snapshot
  // ==========================================================================

  /**
   * 모든 지표를 한 번에 계산해서 구조화된 snapshot 반환.
   * 실패 지표는 warnings에 누적.
   * featurePayload 본체가 읽기 쉽게 모음.
   */
  function buildIndicatorSnapshot(candles, config = {}) {
    const cfg = mergeIndicatorConfig(config);
    const candleCount = Array.isArray(candles) ? candles.length : 0;
    const warnings = [];

    if (!hasEnoughCandles(candles, 2)) {
      return {
        valid: false,
        indicators: {},
        warnings: ['NOT_ENOUGH_CANDLES'],
        debug: {
          candleCount,
          indicatorVersion: INDICATOR_VERSION,
          configVersion: CONFIG_VERSION
        }
      };
    }

    const indicators = {};

    const collect = (key, result) => {
      indicators[key] = result;
      if (result && result.valid === false && result.reason) {
        warnings.push(`${key.toUpperCase()}_${result.reason}`);
      }
    };

    collect('rsi', calculateRSI(candles, config));
    collect('mfi', calculateMFI(candles, config));
    collect('obv', calculateOBVTrend(candles, config));
    collect('atr', calculateATR(candles, config));
    collect('ma', calculateMAState(candles, config));
    collect('volume', calculateVolumeStats(candles, config));
    collect('volumeAcceleration', calculateVolumeAcceleration(candles, config));
    collect('tradeValue', calculateTradeValueStats(candles, config));
    collect('candleShape', (function () {
      // 마지막 봉만 (구조 보조용)
      return calculateCandleShape(candles[candles.length - 1], config);
    })());
    collect('candleStructure', calculateRecentCandleStructure(candles, config));
    collect('structure', (function () {
      const box = detectRecentHighLowBox(candles, config);
      const refLows = findReferenceLows(candles, config);
      const priceZone = calculatePriceZone(candles, config);
      const sweepReclaim = detectSweepReclaimCandidates(candles, config);
      return {
        valid: box.valid && refLows.valid && priceZone.valid && sweepReclaim.valid,
        box,
        referenceLows: refLows,
        priceZone,
        sweepReclaim
      };
    })());

    // 전체 valid 판정 — 최소 RSI + MA + volume 정도 valid면 true
    const overallValid =
      indicators.rsi.valid &&
      indicators.ma.valid &&
      indicators.volume.valid;

    return {
      valid: overallValid,
      indicators,
      warnings,
      debug: {
        candleCount,
        indicatorVersion: INDICATOR_VERSION,
        configVersion: CONFIG_VERSION
      }
    };
  }

  // ==========================================================================
  // §14 Self-test Helper — 자동 실행 X
  // ==========================================================================

  function __testIndicatorsWithSampleCandles(sampleCandles, config = {}) {
    return buildIndicatorSnapshot(sampleCandles, config);
  }

  // ==========================================================================
  // §13 Export
  // 기존 /v3 파일이 브라우저 전역 (window.*) 스타일이라면 window에 부착.
  // module 환경(Cloudflare Workers / Node)이면 module.exports로 부착.
  // ==========================================================================

  const api = {
    // version
    INDICATOR_VERSION,
    CONFIG_VERSION,
    DEFAULT_INDICATOR_CONFIG,

    // config / 유틸
    mergeIndicatorConfig,
    safeNumber,
    getOpen,
    getHigh,
    getLow,
    getClose,
    getVolume,
    getTradeValue,
    sliceRecent,
    hasEnoughCandles,
    calculatePctChange,
    calculateAverage,

    // 이동평균
    calculateSMA,
    calculateEMA,
    calculateMAState,

    // RSI / MFI / OBV / ATR
    calculateRSI,
    calculateMFI,
    calculateOBV,
    calculateOBVTrend,
    calculateATR,

    // 거래량 / 거래대금
    calculateVolumeStats,
    calculateVolumeAcceleration,
    calculateTradeValueStats,

    // 캔들 구조
    calculateCandleShape,
    calculateCandleShapeSeries,
    calculateRecentCandleStructure,

    // 박스 / 구조 보조
    detectRecentHighLowBox,
    countLevelTouches,
    calculatePriceZone,
    findReferenceLows,
    detectSweepReclaimCandidates,

    // 통합
    buildIndicatorSnapshot,

    // test helper (자동 실행 X)
    __testIndicatorsWithSampleCandles
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (typeof global !== 'undefined' && global) {
    global.WS3Indicators = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis
   : typeof window !== 'undefined' ? window
   : typeof self !== 'undefined' ? self
   : this);
