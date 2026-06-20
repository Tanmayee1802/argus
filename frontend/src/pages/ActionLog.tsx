import { useEffect, useState } from 'react'
import { useSuiClient } from '@mysten/dapp-kit'
import { CONFIG, ALERT_COLORS, type AlertLevel } from '../config'

interface ActionEntry {
  alert_level: number
  action_type: number
  final_score: number
  score_price_velocity: number
  score_vol_regime: number
  score_correlation: number
  score_oracle_conf: number
  score_utilization: number
  sui_price_usd: number
  pool_utilization_bps: number
  prev_ltv_bps: number
  new_ltv_bps: number
  was_overridden: boolean
  timestamp_ms: number
  walrus_model_blob_id: number[]
}

const LEVEL_NAMES = ['', 'YELLOW', 'ORANGE', 'RED', 'BLACK'] as const
const ACTION_NAMES = ['LTV ADJUST', 'CAP TIGHTEN', 'PAUSE BORROWS', 'EMERGENCY PAUSE'] as const
const LEVEL_COLORS: Record<string, string> = { YELLOW:'#ffe600', ORANGE:'#ff7300', RED:'#ff1f3c', BLACK:'#8b0000' }

export default function ActionLog() {
  const client = useSuiClient()
  const [entries, setEntries] = useState<ActionEntry[]>([])
  const [expanded, setExpanded] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const obj = await client.getObject({ id: CONFIG.ACTION_LOG_ID, options: { showContent: true } })
        const fields = (obj.data?.content as any)?.fields ?? {}
        const count = parseInt(fields.count ?? '0')
        const list: ActionEntry[] = []
        for (let i = Math.max(0, count - 20); i < count; i++) {
          try {
            const entry = fields.entries?.fields?.contents?.find((c: any) => c.fields?.key === String(i))
            if (entry) list.unshift(entry.fields?.value?.fields)
          } catch {}
        }
        setEntries(list)
      } catch (e) { console.error(e) }
      finally { setLoading(false) }
    }
    load()
    const id = setInterval(load, 30000)
    return () => clearInterval(id)
  }, [client])

  const blobStr = (blob: number[]) => {
    try { return Buffer.from(blob).toString('utf-8').slice(0, 20) + '...' }
    catch { return 'unknown' }
  }

  return (
    <div style={{ paddingTop: 80, minHeight: '100vh', background: '#000', padding: '80px 40px 40px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ fontSize: 9, letterSpacing: 5, color: 'rgba(255,255,255,0.3)', marginBottom: 24 }}>ON-CHAIN ACTION LOG</div>

        {loading && <div style={{ color: 'rgba(0,220,255,0.4)', fontSize: 11, letterSpacing: 3 }}>LOADING FROM CHAIN...</div>}

        {entries.length === 0 && !loading && (
          <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: 11, letterSpacing: 3 }}>NO ACTIONS RECORDED YET</div>
        )}

        {entries.map((e, i) => {
          const lvName = LEVEL_NAMES[e?.alert_level] ?? 'UNKNOWN'
          const lvColor = LEVEL_COLORS[lvName] ?? '#00ffc8'
          const score = (e?.final_score ?? 0) / 100
          const isOpen = expanded === i

          return (
            <div key={i} className="card" style={{ marginBottom: 8, borderColor: `${lvColor}22`, cursor: 'pointer' }}
              onClick={() => setExpanded(isOpen ? null : i)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
                  <span style={{ fontSize: 8, padding: '2px 10px', border: `1px solid ${lvColor}44`, color: lvColor, letterSpacing: 3 }}>
                    {lvName}
                  </span>
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', letterSpacing: 2 }}>
                    {ACTION_NAMES[e?.action_type] ?? '-'}
                  </span>
                  <span style={{ fontSize: 10, color: lvColor }}>SCORE {score.toFixed(1)}</span>
                  {e?.was_overridden && <span style={{ fontSize: 8, color: '#ffe600', letterSpacing: 2 }}>OVERRIDDEN</span>}
                </div>
                <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
                  <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)', letterSpacing: 1 }}>
                    {new Date(e?.timestamp_ms).toLocaleString()}
                  </span>
                  <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10 }}>{isOpen ? '▲' : '▼'}</span>
                </div>
              </div>

              {isOpen && (
                <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  {/* Score breakdown bars */}
                  <div style={{ fontSize: 9, letterSpacing: 4, color: 'rgba(255,255,255,0.25)', marginBottom: 12 }}>SCORE DECOMPOSITION</div>
                  {[
                    { label: 'PRICE VELOCITY', val: (e?.score_price_velocity??0)/100 },
                    { label: 'VOL REGIME',     val: (e?.score_vol_regime??0)/100 },
                    { label: 'CORRELATION',    val: (e?.score_correlation??0)/100 },
                    { label: 'ORACLE CONF',    val: (e?.score_oracle_conf??0)/100 },
                    { label: 'UTILIZATION',    val: (e?.score_utilization??0)/100 },
                  ].map(f => (
                    <div key={f.label} style={{ marginBottom: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 8, letterSpacing: 2, color: 'rgba(255,255,255,0.35)' }}>{f.label}</span>
                        <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)' }}>{f.val.toFixed(1)}</span>
                      </div>
                      <div style={{ height: 3, background: 'rgba(255,255,255,0.05)' }}>
                        <div style={{ height: '100%', width: `${f.val}%`, background: lvColor, opacity: 0.7 }} />
                      </div>
                    </div>
                  ))}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 16 }}>
                    <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>
                      LTV {(e?.prev_ltv_bps??0)/100}% → {(e?.new_ltv_bps??0)/100}%
                    </div>
                    <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>
                      SUI ${((e?.sui_price_usd??0)/1e6).toFixed(4)}
                    </div>
                    <div style={{ fontSize: 9, color: 'rgba(0,220,255,0.4)' }}>
                      WALRUS: {blobStr(e?.walrus_model_blob_id ?? [])}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
