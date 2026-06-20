export type AlertLevel = "green" | "yellow" | "orange" | "red" | "black"

export interface PricePoint {
  price:      number
  confidence: number
  timestamp:  number
}

export interface RiskScore {
  total:             number
  price_velocity:    number
  vol_regime:        number
  correlation:       number
  oracle_confidence: number
  utilization:       number
  alert_level:       AlertLevel
  reasoning:         string
  pct_change:        number
  vol_ratio:         number
  corr:              number
}

export interface PoolState {
  max_ltv_bps:     number
  borrow_cap:      number
  total_deposited: number
  total_borrowed:  number
  borrows_paused:  boolean
  fully_paused:    boolean
  last_action_at:  number
}

export interface ModelConfig {
  weights: {
    price_velocity:    number
    volatility_regime: number
    correlation_spike: number
    oracle_confidence: number
    utilization_rate:  number
  }
  thresholds: {
    yellow: number
    orange: number
    red:    number
    black:  number
  }
  cooldown_ms:                 number
  price_velocity_breakpoints:  number[]
  vol_ratio_breakpoints:       number[]
}

export const DEFAULT_MODEL: ModelConfig = {
  weights: {
    price_velocity:    0.35,
    volatility_regime: 0.25,
    correlation_spike: 0.20,
    oracle_confidence: 0.10,
    utilization_rate:  0.10,
  },
  thresholds: { yellow:60, orange:75, red:85, black:95 },
  cooldown_ms: 300_000,
  price_velocity_breakpoints: [5, 10, 20],
  vol_ratio_breakpoints:      [1.5, 2.0, 3.0],
}

// ── Math helpers ──────────────────────────────────────────
function logReturns(prices: PricePoint[]): number[] {
  const out: number[] = []
  for (let i = 1; i < prices.length; i++) {
    if (prices[i-1].price > 0)
      out.push(Math.log(prices[i].price / prices[i-1].price))
  }
  return out
}

function stddev(arr: number[]): number {
  if (arr.length < 2) return 0
  const mean = arr.reduce((a,b) => a+b, 0) / arr.length
  const variance = arr.reduce((s,v) => s+(v-mean)**2, 0) / (arr.length-1)
  return Math.sqrt(variance)
}

function annualizedVol(prices: PricePoint[]): number {
  const rets = logReturns(prices)
  if (rets.length < 2) return 0
  return stddev(rets) * Math.sqrt(96 * 365)
}

function pearsonCorrelation(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length)
  if (n < 2) return 0
  const meanA = a.slice(0,n).reduce((s,v) => s+v, 0) / n
  const meanB = b.slice(0,n).reduce((s,v) => s+v, 0) / n
  let num=0, denA=0, denB=0
  for (let i=0; i<n; i++) {
    const da=a[i]-meanA, db=b[i]-meanB
    num+=da*db; denA+=da*da; denB+=db*db
  }
  if (denA===0||denB===0) return 0
  return num/Math.sqrt(denA*denB)
}

function interpolateScore(value: number, breakpoints: number[]): number {
  const [b1,b2,b3] = breakpoints
  if (value <= 0)  return 0
  if (value < b1)  return (value/b1)*25
  if (value < b2)  return 25+((value-b1)/(b2-b1))*25
  if (value < b3)  return 50+((value-b2)/(b3-b2))*25
  return Math.min(75+((value-b3)/b3)*25, 100)
}

function determineAlertLevel(total: number, config: ModelConfig): AlertLevel {
  if (total >= config.thresholds.black)  return "black"
  if (total >= config.thresholds.red)    return "red"
  if (total >= config.thresholds.orange) return "orange"
  if (total >= config.thresholds.yellow) return "yellow"
  return "green"
}

function buildReasoning(
  level: AlertLevel, pctChange: number,
  volRatio: number, corr: number, total: number
): string {
  const sign = pctChange >= 0 ? "+" : ""
  const drop = `${sign}${(pctChange*100).toFixed(1)}%`
  const vr   = volRatio.toFixed(1)
  const cr   = (corr*100).toFixed(0)
  const sc   = total.toFixed(0)
  switch(level) {
    case "green":  return `Low risk. SUI ${drop} in 15m, vol ${vr}x baseline. Score: ${sc}.`
    case "yellow": return `Elevated: SUI down ${drop}, vol ${vr}x baseline. LTV tightening triggered.`
    case "orange": return `High risk: SUI down ${drop}, BTC corr ${cr}%, vol ${vr}x. LTV + cap tightened.`
    case "red":    return `Severe: SUI down ${drop}, corr ${cr}% with BTC, vol ${vr}x. New borrows paused.`
    case "black":  return `CRITICAL: SUI down ${drop}, systemic selloff, corr ${cr}%. Full emergency pause. Score: ${sc}.`
  }
}

// ── Main scoring function ─────────────────────────────────
export function computeRiskScore(
  suiPrices: PricePoint[],
  btcPrices: PricePoint[],
  pool:      PoolState,
  config:    ModelConfig,
  baselineVol: number,
): RiskScore {
  const n = suiPrices.length

  if (n < 2) {
    return {
      total:0, price_velocity:0, vol_regime:0, correlation:0,
      oracle_confidence:0, utilization:0, alert_level:"green",
      reasoning:"Warming up — insufficient price history.",
      pct_change:0, vol_ratio:1, corr:0,
    }
  }

  // Factor 1: Price Velocity
  const latestSui = suiPrices[n-1].price
  const prevSui   = suiPrices[n-2].price
  const pctChange = prevSui > 0 ? (latestSui-prevSui)/prevSui : 0
  const dropPct   = Math.max(-pctChange*100, 0)
  const pvScore   = interpolateScore(dropPct, config.price_velocity_breakpoints)

  // Factor 2: Volatility Regime
  const currentVol = annualizedVol(suiPrices)
  const volRatio   = baselineVol > 0 ? currentVol/baselineVol : 1
  const vrScore    = interpolateScore(volRatio, config.vol_ratio_breakpoints)

  // Factor 3: Cross-Asset Correlation
  const suiRets = logReturns(suiPrices)
  const btcRets = logReturns(btcPrices.slice(-(suiRets.length+1)))
  const corr    = pearsonCorrelation(suiRets, btcRets)
  let corrScore: number
  if (corr > 0.8 && pctChange < 0)     corrScore = Math.min(60+corr*40, 100)
  else if (corr > 0 && pctChange < 0)  corrScore = corr*50
  else                                  corrScore = Math.max(corr*20, 0)

  // Factor 4: Oracle Confidence
  const latestConf = suiPrices[n-1].confidence
  const confRatio  = latestSui > 0 ? (latestConf/latestSui)*100 : 0
  const ocScore    = Math.min(confRatio*20, 100)

  // Factor 5: Pool Utilization
  const utilRatio = pool.total_deposited > 0 ? pool.total_borrowed/pool.total_deposited : 0
  let utilScore: number
  if (utilRatio > 0.95)      utilScore = 100
  else if (utilRatio > 0.80) utilScore = 60+((utilRatio-0.80)/0.15)*40
  else if (utilRatio > 0.60) utilScore = 30+((utilRatio-0.60)/0.20)*30
  else                       utilScore = utilRatio*50

  const total = Math.min(
    pvScore   * config.weights.price_velocity    +
    vrScore   * config.weights.volatility_regime +
    corrScore * config.weights.correlation_spike +
    ocScore   * config.weights.oracle_confidence +
    utilScore * config.weights.utilization_rate,
    100
  )

  const alert_level = determineAlertLevel(total, config)

  return {
    total:             Math.round(total*100)/100,
    price_velocity:    Math.round(pvScore*100)/100,
    vol_regime:        Math.round(vrScore*100)/100,
    correlation:       Math.round(corrScore*100)/100,
    oracle_confidence: Math.round(ocScore*100)/100,
    utilization:       Math.round(utilScore*100)/100,
    alert_level,
    reasoning: buildReasoning(alert_level, pctChange, volRatio, corr, total),
    pct_change: pctChange,
    vol_ratio:  volRatio,
    corr,
  }
}

// ── Baseline vol updater (EMA) ────────────────────────────
export function updateBaselineVol(
  currentBaseline: number,
  suiPrices: PricePoint[]
): number {
  if (suiPrices.length < 4) return currentBaseline
  const currentVol = annualizedVol(suiPrices)
  return 0.97*currentBaseline + 0.03*currentVol
}