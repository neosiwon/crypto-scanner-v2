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

  // ═══════════════════════════════════════════════════════════════════
  // v0.45.0 신규 — P1 분류기 4개 임계값 (백서 §3.2 Config 중심)
  // 백서 §6.3 — context = 점수 가점 X / 카드 표시 + 라벨 + 사후평가 + Telegram 정책 보조
  // ═══════════════════════════════════════════════════════════════════

  // 분류기 임계값 (백서 §11.1 매수세 / §10 시장 / §15.3 세력예상가)
  var WS3_CLASSIFIER_THRESHOLDS = {
    // §11.1 매수세 (v0.46.0 — obvSlope 제거 → obvTrend / 토의 #7 upperWickPct STRONG 차단)
    BUY_PRESSURE: {
      STRONG: { volumeRatio: 2.0, closePosition: 0.7, upperWickPctMax: 0.4 },
      MEDIUM: { volumeRatio: 1.3 },
      WEAK:   { volumeRatio: 0.8 },
      NONE:   { volumeRatioMax: 0.8 }
    },
    // §11.1 OBV (v0.46.0 신규 — V2 calcOBV 산식 기반 / 토의 #8 MIN_SAMPLE 20)
    OBV: {
      LOOKBACK: 20,
      UP_THRESHOLD: 0.005,
      DOWN_THRESHOLD: -0.005,
      MIN_SAMPLE_SIZE: 20
    },
    // §10 시장상황 (DP-P1-2 — v2 btcFilter 임계값 채택)
    MARKET_CONTEXT: {
      BTC_RSI_BEAR: 42,
      BTC_RSI_NEUTRAL: 48,
      MACD_DEAD_PENALTY: 2.0,
      MACD_DEAD_HOLD_PENALTY: 0.5,
      PENALTY_BEAR_MIN: 2.0,
      PENALTY_NEUTRAL_MIN: 0.5
    },
    // §15.3 세력예상가 (v0.46.0 — V2 estimateAccumulationCostRange 산식 기반)
    SMART_MONEY_ZONE: {
      ATR_MULTIPLIER_LOW: 0.5,
      ATR_MULTIPLIER_HIGH: 0.5,
      MIN_INNER_CANDLES: 3,
      MIN_TOP_COUNT: 5,
      TOP_VOLUME_RATIO: 0.3,
      PANIC_BODY_RATIO_MIN: 0.6,
      PANIC_SELL_WEIGHT: 0.5,
      HIGH_CONF_MIN_TOP: 8,
      HIGH_CONF_MAX_ANOMALY: 1,
      MID_CONF_MIN_TOP: 5,
      NARROW_BOX_RANGE_PCT: 3
    },
    // §15.3 현재 단계 (v0.47.0 — V2 currentPhase ratio 산식 / smartMoneyZone.center 대비 현재가)
    // threshold = V2 원본 그대로 (토의 1 확정) / 모든 상수 config (메모리 #11)
    CURRENT_PHASE: {
      THRESHOLDS: {
        ACCUMULATION_MAX: 1.10,
        EARLY_UP_MAX: 1.30,
        MAIN_UP_MAX: 1.70,
        DISTRIBUTION_MAX: 2.00
      },
      NOTES: {
        ACCUMULATION: '아직 평단 근처 — 진입 구간',
        EARLY_UP: '평단 대비 10~30% — 추세 확인',
        MAIN_UP: '평단 대비 30~70% — 추격 주의',
        DISTRIBUTION_RISK: '평단 대비 70~100% — 세력 분배 가능성',
        OVERHEAT: '평단 대비 2배 이상 — 진입 금지'
      },
      DISPLAY: {
        SHOW_RATIO_IN_CARD: false
      }
    }
  };

  // §20.3 표준 섹터 17종 (백서 본문 그대로)
  var WS3_SECTOR_LIST = [
    'L1', 'L2', 'DeFi', 'RWA', 'AI', 'Gaming', 'Meme', 'Infra',
    'Oracle', 'Payment', 'Exchange', 'Privacy', 'NFT-Metaverse',
    'Storage', 'Stablecoin', 'Fan-Social', 'Unknown'
  ];

  // §9.1 시총 임계값 v0 (백서 본문 / 모든 기준 config / 사용자 조정 가능)
  var WS3_CAP_THRESHOLDS_KRW = {
    EXTREME_LOW: 30000000000,    // 300억 (백서 §9.1 극저시총)
    VERY_LOW:    50000000000,    // 500억 (백서 §9.1 초저시총)
    LOW:         100000000000,   // 1000억 (백서 §9.1 저시총)
    MID:         500000000000    // 5000억 (사용자 결정 MID 경계 / 추후 조정)
  };

  // §9.2 Telegram 정책 + §9.3 저시총 B 의미 — 저시총 family 분기
  // (사용자 결정 — 추후 수정 가능 / 메몰 X)
  var WS3_LOW_CAP_FAMILY = ['EXTREME_LOW_CAP', 'VERY_LOW_CAP', 'LOW_CAP'];

  // §20.1 manualMetaMap (4순위 — 빗썸 정보 수동 박제)
  // 213개 박제 / CoinGecko 상위 500위 + 빗썸 459개 KRW 매칭
  // 1회 박제 / 시세 변동해도 분류 결과 거의 동일 / 사용자 갱신 의무 0
  var WS3_COIN_MANUAL_MAP = {
    'BTC': { name: '비트코인', cap: 2316044967254815, sector: 'L1' },
    'ETH': { name: '이더리움', cap: 385522494800768, sector: 'L1' },
    'USDT': { name: '테더', cap: 283908690563231, sector: 'Stablecoin' },
    'BNB': { name: '비앤비', cap: 130759334408853, sector: 'Exchange' },
    'XRP': { name: '엑스알피[리플]', cap: 127272511599239, sector: 'Payment' },
    'USDC': { name: '유에스디코인', cap: 114603146361804, sector: 'Stablecoin' },
    'SOL': { name: '솔라나', cap: 74927955504982, sector: 'L1' },
    'TRX': { name: '트론', cap: 50834066133787, sector: 'L1' },
    'DOGE': { name: '도지코인', cap: 24105323782646, sector: 'Meme' },
    'USDS': { name: '유에스디에스', cap: 16055843194465, sector: 'Stablecoin' },
    'ADA': { name: '에이다', cap: 13859524008322, sector: 'L1' },
    'BCH': { name: '비트코인캐시', cap: 11120974800769, sector: 'L1' },
    'LINK': { name: '체인링크', cap: 10474186200999, sector: 'Oracle' },
    'TON': { name: '톤코인', cap: 8296416107874, sector: 'L1' },
    'XLM': { name: '스텔라루멘', cap: 7231998650041, sector: 'Payment' },
    'USD1': { name: '월드리버티파이낸셜유에스디', cap: 6941610021617, sector: 'Stablecoin' },
    'USDE': { name: '유에스디이', cap: 6650300224110, sector: 'Stablecoin' },
    'SUI': { name: '수이', cap: 6444135349620, sector: 'L1' },
    'AVAX': { name: '아발란체', cap: 6029613957659, sector: 'L1' },
    'HBAR': { name: '헤데라', cap: 5792139955304, sector: 'L1' },
    'SHIB': { name: '시바이누', cap: 5116636404408, sector: 'Meme' },
    'CRO': { name: '크로노스', cap: 4638985077994, sector: 'Exchange' },
    'XAUT': { name: '테더골드', cap: 4013934726824, sector: 'RWA' },
    'TAO': { name: '비트텐서', cap: 3894232588872, sector: 'AI' },
    'UNI': { name: '유니스왑', cap: 3437320104014, sector: 'DeFi' },
    'NEAR': { name: '니어프로토콜', cap: 3262467161102, sector: 'L1' },
    'PAXG': { name: '팍스골드', cap: 3185934466496, sector: 'RWA' },
    'DOT': { name: '폴카닷', cap: 3147774936690, sector: 'L1' },
    'MNT': { name: '맨틀', cap: 3139720577966, sector: 'L2' },
    'WLFI': { name: '월드리버티파이낸셜', cap: 3052821366347, sector: 'DeFi' },
    'ONDO': { name: '온도파이낸스', cap: 2885068001622, sector: 'RWA' },
    'ASTER': { name: '아스터', cap: 2616047959115, sector: 'DeFi' },
    'SKY': { name: '스카이프로토콜', cap: 2440064358662, sector: 'DeFi' },
    'PEPE': { name: '페페', cap: 2342785553044, sector: 'Meme' },
    'ETC': { name: '이더리움클래식', cap: 2129064590491, sector: 'L1' },
    'ICP': { name: '인터넷컴퓨터', cap: 2124078661310, sector: 'L1' },
    'AAVE': { name: '에이브', cap: 2014065591058, sector: 'DeFi' },
    'MORPHO': { name: '모포', cap: 1733100516674, sector: 'DeFi' },
    'ALGO': { name: '알고랜드', cap: 1550663953624, sector: 'L1' },
    'ATOM': { name: '코스모스', cap: 1533137008937, sector: 'L1' },
    'RENDER': { name: '렌더토큰', cap: 1509432875183, sector: 'AI' },
    'POL': { name: '폴리곤에코시스템토큰', cap: 1449568722140, sector: 'L2' },
    'ENA': { name: '에테나', cap: 1442159788962, sector: 'DeFi' },
    'WLD': { name: '월드코인', cap: 1297877120921, sector: 'AI' },
    'VVV': { name: '베니스토큰', cap: 1231275443998, sector: 'AI' },
    'JST': { name: '저스트', cap: 1201521426170, sector: 'Infra' },
    'STABLE': { name: '스테이블', cap: 1188323331788, sector: 'Stablecoin' },
    'APT': { name: '앱토스', cap: 1171210574788, sector: 'L1' },
    'FIL': { name: '파일코인', cap: 1134544955927, sector: 'Storage' },
    'FLR': { name: '플레어', cap: 1077820804760, sector: 'L1' },
    'JUP': { name: '주피터', cap: 1069395782924, sector: 'DeFi' },
    'ARB': { name: '아비트럼', cap: 1055463576615, sector: 'L2' },
    'DEXE': { name: '딕시', cap: 975755933919, sector: 'DeFi' },
    'PUMP': { name: '펌프닷펀', cap: 941387196101, sector: 'Meme' },
    'PENGU': { name: '펏지펭귄', cap: 876058595793, sector: 'NFT-Metaverse' },
    'VET': { name: '비체인', cap: 860864983885, sector: 'L1' },
    'BONK': { name: '봉크', cap: 802423605525, sector: 'Meme' },
    'KITE': { name: '카이트', cap: 790464650787, sector: 'AI' },
    'INJ': { name: '인젝티브', cap: 758261061188, sector: 'L1' },
    'H': { name: '휴머니티', cap: 736779135137, sector: 'AI' },
    'TRUMP': { name: '오피셜트럼프', cap: 729366005960, sector: 'Meme' },
    'VIRTUAL': { name: '버추얼프로토콜', cap: 720023502726, sector: 'AI' },
    'CAKE': { name: '팬케이크스왑', cap: 712369456290, sector: 'DeFi' },
    'CHZ': { name: '칠리즈', cap: 709822069840, sector: 'Fan-Social' },
    'EDGE': { name: '디피니티브', cap: 701661245379, sector: 'DeFi' },
    'STX': { name: '스택스', cap: 677252776228, sector: 'L1' },
    'FET': { name: '페치', cap: 650514000546, sector: 'AI' },
    'SEI': { name: '세이', cap: 618213423149, sector: 'L1' },
    'AERO': { name: '에어로드롬파이낸스', cap: 583343957782, sector: 'DeFi' },
    'SUN': { name: '썬', cap: 574897772458, sector: 'DeFi' },
    'TIA': { name: '셀레스티아', cap: 557989701440, sector: 'L1' },
    'XTZ': { name: '테조스', cap: 556016486951, sector: 'L1' },
    'CRV': { name: '커브', cap: 540942361940, sector: 'DeFi' },
    '2Z': { name: '더블제로', cap: 511261274095, sector: 'Infra' },
    'ETHFI': { name: '이더파이', cap: 508591828826, sector: 'DeFi' },
    'ZRO': { name: '레이어제로', cap: 506942126135, sector: 'Infra' },
    'PYTH': { name: '피스네트워크', cap: 486277259697, sector: 'Oracle' },
    'PENDLE': { name: '펜들', cap: 478154037110, sector: 'DeFi' },
    'BTT': { name: '비트토렌트', cap: 475899857054, sector: 'Storage' },
    'MON': { name: '모나드', cap: 472958847772, sector: 'L1' },
    'GNO': { name: '노시스', cap: 470707857563, sector: 'L1' },
    'LIT': { name: '라이터', cap: 465358261461, sector: 'DeFi' },
    'CFX': { name: '콘플럭스', cap: 458805914539, sector: 'L1' },
    'LDO': { name: '리도다오', cap: 458367524696, sector: 'DeFi' },
    'BSV': { name: '비트코인에스브이', cap: 454857574481, sector: 'Infra' },
    'KAIA': { name: '카이아', cap: 446962705081, sector: 'L1' },
    'FLOKI': { name: '플로키', cap: 439187798373, sector: 'Meme' },
    'NFT': { name: '에이아이앤에프티', cap: 419997945210, sector: 'NFT-Metaverse' },
    'JASMY': { name: '재스미코인', cap: 416443398891, sector: 'L1' },
    'OP': { name: '옵티미즘', cap: 416001834998, sector: 'L2' },
    'FRAX': { name: '프랙스', cap: 410009037172, sector: 'Stablecoin' },
    'GWEI': { name: '이더가스', cap: 407616294072, sector: 'Infra' },
    'GRT': { name: '더그래프', cap: 407500470575, sector: 'Infra' },
    'STRK': { name: '스타크넷', cap: 404366099380, sector: 'L2' },
    'ENS': { name: '이더리움네임서비스', cap: 381361337803, sector: 'Infra' },
    'IOTA': { name: '아이오타', cap: 374790542431, sector: 'L1' },
    'SYRUP': { name: '메이플파이낸스', cap: 368427426965, sector: 'DeFi' },
    'AKT': { name: '아카시네트워크', cap: 349267001221, sector: 'AI' },
    'JTO': { name: '지토', cap: 340495864719, sector: 'DeFi' },
    'COMP': { name: '컴파운드', cap: 330966867862, sector: 'DeFi' },
    'XPL': { name: '플라즈마', cap: 322689663232, sector: 'L1' },
    'AXS': { name: '엑시인피니티', cap: 314063338288, sector: 'Gaming' },
    'RAY': { name: '레이디움', cap: 308910630924, sector: 'DeFi' },
    'FF': { name: '팔콘파이낸스', cap: 308475400031, sector: 'DeFi' },
    'NEO': { name: '네오', cap: 307103370912, sector: 'L1' },
    'THETA': { name: '쎄타토큰', cap: 302113369428, sector: 'L1' },
    'PIEVERSE': { name: '파이버스', cap: 298647492280, sector: 'Gaming' },
    'WIF': { name: '도그위프햇', cap: 293394103034, sector: 'Meme' },
    'SAND': { name: '샌드박스', cap: 288630289540, sector: 'Gaming' },
    'TRAC': { name: '오리진트레일', cap: 283793053507, sector: 'AI' },
    'GRASS': { name: '그래스', cap: 277344642097, sector: 'AI' },
    'XCN': { name: '오닉스코인', cap: 274417709966, sector: 'L1' },
    'MANA': { name: '디센트럴랜드', cap: 259035684743, sector: 'NFT-Metaverse' },
    'IP': { name: '스토리', cap: 257010609964, sector: 'NFT-Metaverse' },
    'S': { name: '소닉', cap: 252472740890, sector: 'L1' },
    'CFG': { name: '센트리퓨즈', cap: 246204754807, sector: 'RWA' },
    'GALA': { name: '갈라', cap: 244960198904, sector: 'Gaming' },
    'WAL': { name: '월러스', cap: 239178518312, sector: 'Storage' },
    'ZK': { name: '지케이싱크', cap: 223983178153, sector: 'L2' },
    'BAT': { name: '베이직어텐션토큰', cap: 222341929201, sector: 'Infra' },
    'AR': { name: '알위브', cap: 218719261352, sector: 'Storage' },
    'APE': { name: '에이프코인', cap: 218154883626, sector: 'NFT-Metaverse' },
    'XEC': { name: '이캐시', cap: 217669830585, sector: 'L1' },
    'IMX': { name: '이뮤터블엑스', cap: 215997143482, sector: 'Gaming' },
    'EIGEN': { name: '아이겐클라우드', cap: 215565077405, sector: 'DeFi' },
    'SFP': { name: '세이프팔', cap: 208306585198, sector: 'DeFi' },
    'GLM': { name: '골렘', cap: 204440007994, sector: 'Infra' },
    'A': { name: '볼타', cap: 199824951986, sector: 'L1' },
    '1INCH': { name: '1인치', cap: 194915050389, sector: 'DeFi' },
    'DYDX': { name: '디와이디엑스', cap: 192056122552, sector: 'DeFi' },
    'FLUID': { name: '플루이드', cap: 190675292076, sector: 'DeFi' },
    'SAHARA': { name: '사하라에이아이', cap: 188015095761, sector: 'AI' },
    'ATH': { name: '에이셔', cap: 185214775546, sector: 'AI' },
    'EGLD': { name: '멀티버스엑스', cap: 177105932034, sector: 'L1' },
    'SENT': { name: '센티언트', cap: 175940592969, sector: 'AI' },
    'RSR': { name: '리저브라이트', cap: 167240781670, sector: 'Stablecoin' },
    'KAITO': { name: '카이토', cap: 166055213039, sector: 'AI' },
    'SNX': { name: '신세틱스', cap: 164023970139, sector: 'DeFi' },
    'CHIP': { name: '유에스디에이아이', cap: 155969628678, sector: 'Stablecoin' },
    'BERA': { name: '베라체인', cap: 155548159731, sector: 'L1' },
    '0G': { name: '제로지', cap: 155307966989, sector: 'Storage' },
    'GAS': { name: '가스', cap: 152724021494, sector: 'L1' },
    'SAFE': { name: '세이프', cap: 152258354643, sector: 'Infra' },
    'LPT': { name: '라이브피어', cap: 151813935009, sector: 'Infra' },
    'AWE': { name: '에이더블유이', cap: 150800398959, sector: 'L1' },
    'COW': { name: '카우프로토콜', cap: 147167651996, sector: 'L1' },
    'QTUM': { name: '퀀텀', cap: 142780538482, sector: 'L1' },
    'KMNO': { name: '카미노파이낸스', cap: 141617012304, sector: 'DeFi' },
    'MEGA': { name: '메가이더', cap: 139456794053, sector: 'L2' },
    'SKR': { name: '시커', cap: 138592047349, sector: 'AI' },
    'NXPC': { name: '넥스페이스', cap: 136931280164, sector: 'Gaming' },
    'KSM': { name: '쿠사마', cap: 136098517133, sector: 'L1' },
    'ZRX': { name: '제로엑스', cap: 135878953943, sector: 'DeFi' },
    'BEAM': { name: '빔', cap: 134341405957, sector: 'Privacy' },
    'RVN': { name: '레이븐코인', cap: 134338959983, sector: 'L1' },
    'YFI': { name: '연파이낸스', cap: 133476748429, sector: 'DeFi' },
    'ENJ': { name: '엔진코인', cap: 131863288911, sector: 'Gaming' },
    'ORCA': { name: '오르카', cap: 130372485631, sector: 'DeFi' },
    'AIOZ': { name: '아이오즈네트워크', cap: 129549020688, sector: 'Infra' },
    'LINEA': { name: '리네아', cap: 126876014232, sector: 'L2' },
    'DEEP': { name: '딥북', cap: 124793404478, sector: 'Unknown' },
    'PROS': { name: '파로스', cap: 123418479323, sector: 'Unknown' },
    'HOME': { name: '디파이앱', cap: 122939912698, sector: 'Unknown' },
    'RON': { name: '로닌', cap: 120423927089, sector: 'Gaming' },
    'TFUEL': { name: '쎄타퓨엘', cap: 117556786856, sector: 'L1' },
    'TURBO': { name: '터보', cap: 116899906948, sector: 'Meme' },
    'ARKM': { name: '아캄', cap: 116482592378, sector: 'AI' },
    'ZIL': { name: '질리카', cap: 116145081443, sector: 'L1' },
    'SPK': { name: '스파크', cap: 115936656662, sector: 'Unknown' },
    'BIO': { name: '바이오프로토콜', cap: 115045826020, sector: 'AI' },
    'BRETT': { name: '브렛', cap: 114656259921, sector: 'Meme' },
    'XPR': { name: '엑스피알네트워크', cap: 113766703338, sector: 'L1' },
    'MET': { name: '메테오라', cap: 113226371304, sector: 'Unknown' },
    'DBR': { name: '디브릿지', cap: 112656081821, sector: 'Unknown' },
    'CTC': { name: '크레딧코인', cap: 111839023108, sector: 'Unknown' },
    'MINA': { name: '미나', cap: 110653928485, sector: 'L1' },
    'BARD': { name: '롬바드', cap: 109747214679, sector: 'Unknown' },
    'AMP': { name: '앰프', cap: 109265409441, sector: 'Unknown' },
    'SUPER': { name: '슈퍼버스', cap: 108005821088, sector: 'Unknown' },
    'TOSHI': { name: '토시', cap: 107381589755, sector: 'Unknown' },
    'ZETA': { name: '제타체인', cap: 106787073691, sector: 'L1' },
    'W': { name: '웜홀', cap: 106562939995, sector: 'Infra' },
    'POLYX': { name: '폴리매쉬', cap: 106460620751, sector: 'RWA' },
    'IRYS': { name: '아이리스', cap: 106317305711, sector: 'Unknown' },
    'CKB': { name: '너보스', cap: 105457049880, sector: 'L1' },
    'META': { name: '메타디움', cap: 105380725477, sector: 'Unknown' },
    'GMX': { name: '지엠엑스', cap: 103683119814, sector: 'DeFi' },
    'CYS': { name: '싸이식', cap: 102936406578, sector: 'Unknown' },
    'ASTR': { name: '아스타', cap: 102804091432, sector: 'Unknown' },
    'PLUME': { name: '플룸', cap: 100973962476, sector: 'RWA' },
    'NMR': { name: '뉴메레르', cap: 98748820129, sector: 'AI' },
    'KAVA': { name: '카바', cap: 95381576807, sector: 'L1' },
    'BLUR': { name: '블러', cap: 95325035214, sector: 'NFT-Metaverse' },
    'MOVE': { name: '무브먼트', cap: 94067701113, sector: 'L1' },
    'ZAMA': { name: '자마', cap: 92306047515, sector: 'Unknown' },
    'ELF': { name: '엘프', cap: 91828721343, sector: 'Unknown' },
    'ONT': { name: '온톨로지', cap: 91158203555, sector: 'L1' },
    'T': { name: '쓰레스홀드', cap: 90001931162, sector: 'L1' },
    'AZTEC': { name: '아즈텍', cap: 88799323774, sector: 'Unknown' },
    'SUSHI': { name: '스시스왑', cap: 86138078218, sector: 'DeFi' },
    'PEAQ': { name: '피크', cap: 84854298967, sector: 'Unknown' },
    'POPCAT': { name: '팝캣', cap: 84381895539, sector: 'Meme' },
    'MOCA': { name: '모카네트워크', cap: 79684507960, sector: 'L1' },
    'SOON': { name: '쑨', cap: 78545765592, sector: 'Unknown' },
    'VTHO': { name: '비토르토큰', cap: 78420787804, sector: 'Unknown' },
    'BABY': { name: '바빌론', cap: 78281464213, sector: 'Unknown' },
    'XYO': { name: '엑스와이오', cap: 77776676791, sector: 'L1' },
    'MOODENG': { name: '무뎅', cap: 76312240403, sector: 'Meme' },
    'PCI': { name: '페이코인', cap: 76190134619, sector: 'Unknown' },
    'REQ': { name: '리퀘스트', cap: 75715168350, sector: 'Unknown' },
    'HOLO': { name: '홀로월드에이아이', cap: 75713536579, sector: 'Unknown' },
    'RED': { name: '레드스톤', cap: 75681126631, sector: 'Unknown' },
    'MEW': { name: '캣인어독스월드', cap: 74542599453, sector: 'Meme' }
  };

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
    HEADER_SLOT_DISPLAY: WS3_HEADER_SLOT_DISPLAY,
    // v0.45.0 신규 (백서 §3.2 Config 중심)
    CLASSIFIER_THRESHOLDS: WS3_CLASSIFIER_THRESHOLDS,
    SECTOR_LIST: WS3_SECTOR_LIST,
    CAP_THRESHOLDS_KRW: WS3_CAP_THRESHOLDS_KRW,
    LOW_CAP_FAMILY: WS3_LOW_CAP_FAMILY,
    COIN_MANUAL_MAP: WS3_COIN_MANUAL_MAP
  });
})(typeof window !== 'undefined' ? window : globalThis);
