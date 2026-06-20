import { useEffect, useState, useRef } from 'react'
import { CONFIG, ALERT_COLORS, ALERT_LABELS, type AlertLevel } from '../config'

interface AgentState {
  score: {
    total: number
    price_velocity: number
    vol_regime: number
    correlation: number
    oracle_confidence: number
    utilization: number
    alert_level: AlertLevel
    reasoning: string
  } | null
  pool: {
    max_ltv_bps: string
    borrow_cap: string
    total_deposited: string
    total_borrowed: string
    borrows_paused: boolean
    fully_paused: boolean
    last_action_at: string
  } | null
  prices: {
    sui_usd: number
    btc_usd: number
    sui_conf: number
    publish_time: number
  } | null
  last_action: { digest: string; level: string; ts: number } | null
  eval_count: number
  error: string | null
  model_blob_id: string
}

const FACTORS = [
  { key: 'price_velocity',    label: 'PRICE VELOCITY',    weight: '35%' },
  { key: 'vol_regime',        label: 'VOL REGIME',        weight: '25%' },
  { key: 'correlation',       label: 'CROSS-ASSET CORR',  weight: '20%' },
  { key: 'oracle_confidence', label: 'ORACLE CONFIDENCE', weight: '10%' },
  { key: 'utilization',       label: 'POOL UTILIZATION',  weight: '10%' },
] as const

export default function Dashboard() {
  const [state, setState] = useState<AgentState | null>(null)
  const [prevScore, setPrevScore] = useState(0)
  const scoreRef = useRef(0)

  useEffect(() => {
    const fetch_ = async () => {
      try {
        const res = await fetch(`${CONFIG.AGENT_API}/state`)
        const data = await res.json()
        setState(data)
        if (data.score) {
          setPrevScore(scoreRef.current)
          scoreRef.current = data.score.total
        }
      } catch { setState(prev => prev ? { ...prev, error: 'Agent offline' } : null) }
    }
    fetch_()
    const id = setInterval(fetch_, 15000)
    return () => clearInterval(id)
  }, [])

  const level: AlertLevel = state?.score?.alert_level ?? 'green'
  const score = state?.score?.total ?? 0
  const color = ALERT_COLORS[level]

  const utilPct = state?.pool
    ? (Number(state.pool.total_borrowed) / Number(state.pool.total_deposited) * 100).toFixed(1)
    : '0.0'

  return (
    <div style={{ paddingTop: 80, minHeight: '100vh', background: '#000', padding: '80px 40px 40px' }}>

      {/* Error banner */}
      {state?.error && (
        <div style={{ background: 'rgba(255,30,60,0.1)', border: '1px solid rgba(255,30,60,0.3)', padding: '10px 20px', marginBottom: 24, fontSize: 11, color: '#ff1f3c', letterSpacing: 2 }}>
          ⚠ {state.error.toUpperCase()}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 24, maxWidth: 1200, margin: '0 auto' }}>

        {/* LEFT — Score gauge */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Big score */}
          <div className="card" style={{ textAlign: 'center', padding: 32, borderColor: `${color}33` }}>
            <div style={{ fontSize: 9, letterSpacing: 5, color: 'rgba(255,255,255,0.3)', marginBottom: 16 }}>RISK SCORE</div>

            {/* Arc gauge */}
            <div style={{ position: 'relative', width: 200, height: 120, margin: '0 auto 16px' }}>
              <svg viewBox="0 0 200 110" style={{ width: '100%' }}>
                {/* Background arc */}
                <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" strokeLinecap="round" />
                {/* Score arc */}
                <path
                  d="M 20 100 A 80 80 0 0 1 180 100"
                  fill="none"
                  stroke={color}
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${(score / 100) * 251.2} 251.2`}
                  style={{ transition: 'stroke-dasharray 1s ease, stroke 1s ease' }}
                />
                {/* Score text */}
                <text x="100" y="90" textAnchor="middle" fill="#fff" fontSize="32" fontFamily="Orbitron" fontWeight="700">
                  {score.toFixed(0)}
                </text>
              </svg>
            </div>

            <div style={{
              display: 'inline-block', padding: '4px 16px',
              border: `1px solid ${color}66`, color, fontSize: 10, letterSpacing: 4,
              transition: 'all 1s ease'
            }}>
              ● {level.toUpperCase()} — {ALERT_LABELS[level]}
            </div>

            <div style={{ marginTop: 16, fontSize: 10, color: 'rgba(255,255,255,0.35)', letterSpacing: 1, lineHeight: 1.6 }}>
              {state?.score?.reasoning ?? 'Waiting for agent...'}
            </div>
          </div>

          {/* Eval counter */}
          <div className="card" style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 20px' }}>
            <span style={{ fontSize: 9, letterSpacing: 3, color: 'rgba(255,255,255,0.3)' }}>EVALUATIONS</span>
            <span style={{ fontSize: 12, color: 'rgba(0,255,200,0.7)' }}>{state?.eval_count ?? 0}</span>
          </div>

          {/* Last action */}
          {state?.last_action && (
            <div className="card" style={{ padding: '12px 20px' }}>
              <div style={{ fontSize: 9, letterSpacing: 3, color: 'rgba(255,255,255,0.3)', marginBottom: 8 }}>LAST ACTION</div>
              <div style={{ fontSize: 10, color: ALERT_COLORS[state.last_action.level as AlertLevel] ?? '#fff', letterSpacing: 2, marginBottom: 6 }}>
                {state.last_action.level.toUpperCase()}
              </div>
              <a
                href={`${CONFIG.EXPLORER}/${state.last_action.digest}?network=testnet`}
                target="_blank" rel="noreferrer"
                style={{ fontSize: 9, color: 'rgba(0,220,255,0.5)', letterSpacing: 1, wordBreak: 'break-all' }}
              >
                {state.last_action.digest.slice(0, 20)}...
              </a>
            </div>
          )}
        </div>

        {/* RIGHT — panels */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* 5-factor breakdown */}
          <div className="card">
            <div style={{ fontSize: 9, letterSpacing: 5, color: 'rgba(255,255,255,0.3)', marginBottom: 20 }}>RISK FACTOR BREAKDOWN</div>
            {FACTORS.map(f => {
              const val = state?.score?.[f.key] ?? 0
              return (
                <div key={f.key} style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 9, letterSpacing: 3, color: 'rgba(255,255,255,0.5)' }}>{f.label}</span>
                    <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>
                      {val.toFixed(1)} <span style={{ color: 'rgba(0,220,255,0.4)' }}>w:{f.weight}</span>
                    </span>
                  </div>
                  <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2 }}>
                    <div style={{
                      height: '100%', borderRadius: 2,
                      width: `${val}%`,
                      background: val > 80 ? '#ff1f3c' : val > 60 ? '#ff7300' : val > 40 ? '#ffe600' : '#00ffc8',
                      transition: 'width 1s ease, background 1s ease'
                    }} />
                  </div>
                </div>
              )
            })}
          </div>

          {/* Prices + Pool in a row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

            {/* Live prices */}
            <div className="card">
              <div style={{ fontSize: 9, letterSpacing: 5, color: 'rgba(255,255,255,0.3)', marginBottom: 16 }}>LIVE PRICES</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 9, letterSpacing: 3, color: 'rgba(0,220,255,0.4)', marginBottom: 4 }}>SUI / USD</div>
                  <div style={{ fontSize: 24, fontFamily: 'Orbitron', color: '#fff' }}>
                    ${state?.prices?.sui_usd?.toFixed(4) ?? '-.----'}
                  </div>
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)', marginTop: 2 }}>
                    conf ±{state?.prices?.sui_conf?.toFixed(4) ?? '0'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 9, letterSpacing: 3, color: 'rgba(0,220,255,0.4)', marginBottom: 4 }}>BTC / USD</div>
                  <div style={{ fontSize: 18, fontFamily: 'Orbitron', color: '#fff' }}>
                    ${state?.prices?.btc_usd?.toLocaleString('en-US', { maximumFractionDigits: 0 }) ?? '-'}
                  </div>
                </div>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)', letterSpacing: 2 }}>
                  PYTH · UPDATED {state?.prices?.publish_time
                    ? new Date(state.prices.publish_time * 1000).toLocaleTimeString()
                    : '--:--:--'}
                </div>
              </div>
            </div>

            {/* Pool state */}
            <div className="card">
              <div style={{ fontSize: 9, letterSpacing: 5, color: 'rgba(255,255,255,0.3)', marginBottom: 16 }}>POOL STATE</div>
              {[
                { label: 'MAX LTV', val: state?.pool ? `${(Number(state.pool.max_ltv_bps)/100).toFixed(0)}%` : '--' },
                { label: 'UTILIZATION', val: `${utilPct}%` },
                { label: 'BORROW CAP', val: state?.pool ? `${(Number(state.pool.borrow_cap)/1e9).toFixed(2)} SUI` : '--' },
                { label: 'DEPOSITED', val: state?.pool ? `${(Number(state.pool.total_deposited)/1e9).toFixed(2)} SUI` : '--' },
                { label: 'BORROWED', val: state?.pool ? `${(Number(state.pool.total_borrowed)/1e9).toFixed(2)} SUI` : '--' },
              ].map(r => (
                <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                  <span style={{ fontSize: 9, letterSpacing: 2, color: 'rgba(255,255,255,0.3)' }}>{r.label}</span>
                  <span style={{ fontSize: 11, color: 'rgba(0,255,200,0.7)' }}>{r.val}</span>
                </div>
              ))}
              {/* Status badges */}
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <span style={{ fontSize: 8, letterSpacing: 2, padding: '2px 8px', border: `1px solid ${state?.pool?.borrows_paused ? '#ff1f3c44' : '#00ffc844'}`, color: state?.pool?.borrows_paused ? '#ff1f3c' : '#00ffc8' }}>
                  {state?.pool?.borrows_paused ? 'BORROWS PAUSED' : 'BORROWS ACTIVE'}
                </span>
                {state?.pool?.fully_paused && (
                  <span style={{ fontSize: 8, letterSpacing: 2, padding: '2px 8px', border: '1px solid #8b000044', color: '#8b0000' }}>EMERGENCY HALT</span>
                )}
              </div>
            </div>
          </div>

          {/* Walrus model blob */}
          <div className="card" style={{ padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 9, letterSpacing: 3, color: 'rgba(255,255,255,0.3)' }}>WALRUS MODEL BLOB</span>
            <span style={{ fontSize: 9, color: 'rgba(0,220,255,0.5)', letterSpacing: 1 }}>
              {state?.model_blob_id?.slice(0, 32) ?? 'placeholder'}...
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
