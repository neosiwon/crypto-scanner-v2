/**
 * WS3 v0.1.0 · 초기 골격
 * Scope: config / enum / display mapping only.
 * No fetch, scan, score, structure, UI, Telegram, snapshot, or Worker logic.
 */
(function(global){
  'use strict';

  var WS3_VERSION       = 'WS3 v0.1.0';
  var WS3_VERSION_LABEL = '초기 골격';

  var WS3_EXCHANGES = {
    ENABLE_BITHUMB: true,
    ENABLE_UPBIT:   false,
    ENABLE_BINANCE: false
  };

  var WS3_SCAN = {
    LIMIT_BITHUMB: 30,
    CANDLE_COUNTS: { m5: null, m15: null, h1: 100, h4: null, d1: null },
    MIN_RECORD_SCORE:          0,
    MIN_CANDIDATE_SCORE:       40,
    MIN_C_GRADE_SCORE:         40,
    MIN_TELEGRAM_POLICY_SCORE: 60
  };

  var WS3_WEIGHTS = {
    CORE:             25,
    STRUCTURE:        20,
    VOLUME_SUPPLY:    20,
    MOMENTUM:         15,
    EXECUTION:        20,
    RISK_PENALTY_MAX: 15
  };

  var WS3_GRADE_BANDS = {
    S_PLUS: { code: 'S+',   min: 90, maxExclusive: 101 },
    S:      { code: 'S',    min: 82, maxExclusive: 90  },
    A:      { code: 'A',    min: 72, maxExclusive: 82  },
    B:      { code: 'B',    min: 60, maxExclusive: 72  },
    C:      { code: 'C',    min: 40, maxExclusive: 60  },
    NONE:   { code: 'NONE', min: 0,  maxExclusive: 40, label: '등급없음' }
  };

  var WS3_STRUCTURE_BUCKET = {
    BOX_PRESSURE:      'BOX_PRESSURE',
    BOX_BREAKOUT:      'BOX_BREAKOUT',
    OB_RECLAIM:        'OB_RECLAIM',
    LOW_SWEEP_RECLAIM: 'LOW_SWEEP_RECLAIM',
    MA_RECLAIM:        'MA_RECLAIM'
  };

  var WS3_SIGNAL_PERSISTENCE = {
    SINGLE:        'single',
    REPEAT:        'repeat',
    STRONG_REPEAT: 'strong_repeat',
    HOT_CYCLE:     'hot_cycle'
  };

  var WS3_SIGNAL_LABELS = {
    LIQ_REACTION:  'LIQ_REACTION',
    ABSORPTION:    'ABSORPTION',
    LATE_CHASE:    'LATE_CHASE',
    SELL_PRESSURE: 'SELL_PRESSURE'
  };

  var WS3_STRATEGY_BIAS = {
    SCALP:       'SCALP',
    SWING:       'SWING',
    SCALP_SWING: 'SCALP_SWING',
    WATCH:       'WATCH',
    AVOID:       'AVOID'
  };

  var WS3_EXIT_STRATEGIES = { A: 'EXIT_A', B: 'EXIT_B', C: 'EXIT_C', D: 'EXIT_D', E: 'EXIT_E', F: 'EXIT_F' };

  var WS3_MARKET_CONTEXT = {
    UNKNOWN:        'UNKNOWN',
    BTC_UP:         'BTC_UP',
    BTC_DOWN:       'BTC_DOWN',
    BTC_SIDEWAYS:   'BTC_SIDEWAYS',
    ALT_STRONG:     'ALT_STRONG',
    MARKET_NEUTRAL: 'MARKET_NEUTRAL',
    RISK_OFF:       'RISK_OFF'
  };

  var WS3_BUY_PRESSURE = {
    UNKNOWN: 'BUY_PRESSURE_UNKNOWN',
    STRONG:  'BUY_PRESSURE_STRONG',
    MEDIUM:  'BUY_PRESSURE_MEDIUM',
    WEAK:    'BUY_PRESSURE_WEAK',
    NONE:    'BUY_PRESSURE_NONE'
  };

  var WS3_RISK_LEVEL = { UNKNOWN: 'UNKNOWN', LOW: 'LOW', MID: 'MID', HIGH: 'HIGH' };

  var WS3_DISPLAY = {
    grade: { S_PLUS: 'S+', 'S+': 'S+', S: 'S', A: 'A', B: 'B', C: 'C', NONE: '등급없음' },
    structure: {
      BOX_PRESSURE: '박스압박', BOX_BREAKOUT: '박스돌파', OB_RECLAIM: 'OB회복',
      LOW_SWEEP_RECLAIM: '저점회복', MA_RECLAIM: 'MA회복'
    },
    signalPersistence: { single: '단일', repeat: '반복', strong_repeat: '강한반복', hot_cycle: '핫사이클' },
    signalLabel: { LIQ_REACTION: '수급반응', ABSORPTION: '흡수', LATE_CHASE: '추격주의', SELL_PRESSURE: '매도압' },
    strategyBias: { SCALP: '단타', SWING: '스윙', SCALP_SWING: '단타→스윙', WATCH: '관찰', AVOID: '회피' },
    exitStrategy: { EXIT_A: '매도전략 A', EXIT_B: '매도전략 B', EXIT_C: '매도전략 C', EXIT_D: '매도전략 D', EXIT_E: '매도전략 E', EXIT_F: '매도전략 F' },
    marketContext: { UNKNOWN: '시장미확인', BTC_UP: 'BTC상승', BTC_DOWN: 'BTC하락', BTC_SIDEWAYS: 'BTC횡보', ALT_STRONG: '알트강세', MARKET_NEUTRAL: '시장중립', RISK_OFF: '위험회피' },
    buyPressure: { BUY_PRESSURE_UNKNOWN: '매수세 미확인', BUY_PRESSURE_STRONG: '매수세 강', BUY_PRESSURE_MEDIUM: '매수세 중', BUY_PRESSURE_WEAK: '매수세 약', BUY_PRESSURE_NONE: '매수세 없음' },
    riskLevel: { UNKNOWN: '위험미확인', LOW: '위험 낮음', MID: '위험 보통', HIGH: '위험 높음' },
    exchange: { BITHUMB: '빗썸', UPBIT: '업비트', BINANCE: '바이낸스' }
  };

  function ws3Display(category, id) {
    var bucket = WS3_DISPLAY[category];
    if (!bucket || !bucket[id]) return id;
    if (category === 'grade') return bucket[id];
    return bucket[id] + '(' + id + ')';
  }

  var WS3_HEADER_SLOT_PRIORITY = ['grade','strategyBias','structure','signalPersistence','marketContext','buyPressure','riskMeta','detectedTime'];
  var WS3_HEADER_SLOT_DISPLAY = { mobileMax: 5, desktopMax: 7, alwaysShow: ['grade', 'strategyBias', 'structure'] };

  global.WS3_CONFIG = Object.freeze({
    VERSION: WS3_VERSION,
    VERSION_LABEL: WS3_VERSION_LABEL,
    EXCHANGES: WS3_EXCHANGES,
    SCAN: WS3_SCAN,
    WEIGHTS: WS3_WEIGHTS,
    GRADE_BANDS: WS3_GRADE_BANDS,
    STRUCTURE_BUCKET: WS3_STRUCTURE_BUCKET,
    SIGNAL_PERSISTENCE: WS3_SIGNAL_PERSISTENCE,
    SIGNAL_LABELS: WS3_SIGNAL_LABELS,
    STRATEGY_BIAS: WS3_STRATEGY_BIAS,
    EXIT_STRATEGIES: WS3_EXIT_STRATEGIES,
    MARKET_CONTEXT: WS3_MARKET_CONTEXT,
    BUY_PRESSURE: WS3_BUY_PRESSURE,
    RISK_LEVEL: WS3_RISK_LEVEL,
    DISPLAY: WS3_DISPLAY,
    display: ws3Display,
    HEADER_SLOT_PRIORITY: WS3_HEADER_SLOT_PRIORITY,
    HEADER_SLOT_DISPLAY: WS3_HEADER_SLOT_DISPLAY
  });
})(typeof window !== 'undefined' ? window : globalThis);
