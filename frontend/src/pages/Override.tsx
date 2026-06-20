import { useState } from 'react'
import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from '@mysten/dapp-kit'
import { Transaction } from '@mysten/sui/transactions'
import { CONFIG } from '../config'

export default function Override() {
  const account = useCurrentAccount()
  const client = useSuiClient()
  const { mutate: signAndExecute } = useSignAndExecuteTransaction()
  const [overrideType, setOverrideType] = useState(1) // 1=unpause default
  const [overrideValue, setOverrideValue] = useState(7500)
  const [entryIdx, setEntryIdx] = useState(0)
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)

  const propose = async () => {
    if (!account) return setStatus('Connect wallet first')
    setLoading(true)
    try {
      const tx = new Transaction()
      tx.moveCall({
        target: `${CONFIG.PACKAGE_ID}::dao_policy::propose_override`,
        arguments: [
          tx.object(CONFIG.DAO_POLICY_ID),
          tx.pure.u64(entryIdx),
          tx.pure.u8(overrideType),
          tx.pure.u64(overrideValue),
          tx.object('0x6'),
        ],
      })
      signAndExecute({ transaction: tx }, {
        onSuccess: (r) => { setStatus(`✅ Proposed! Tx: ${r.digest.slice(0,20)}...`); setLoading(false) },
        onError: (e) => { setStatus(`❌ ${e.message}`); setLoading(false) },
      })
    } catch (e: any) { setStatus(`❌ ${e.message}`); setLoading(false) }
  }

  const cosign = async () => {
    if (!account) return setStatus('Connect wallet first')
    setLoading(true)
    try {
      const tx = new Transaction()
      tx.moveCall({
        target: `${CONFIG.PACKAGE_ID}::dao_policy::cosign_and_execute`,
        arguments: [
          tx.object(CONFIG.DAO_POLICY_ID),
          tx.object(CONFIG.POOL_ID),
          tx.pure.u64(entryIdx),
          tx.object('0x6'),
        ],
      })
      signAndExecute({ transaction: tx }, {
        onSuccess: (r) => { setStatus(`✅ Co-signed! Tx: ${r.digest.slice(0,20)}...`); setLoading(false) },
        onError: (e) => { setStatus(`❌ ${e.message}`); setLoading(false) },
      })
    } catch (e: any) { setStatus(`❌ ${e.message}`); setLoading(false) }
  }

  return (
    <div style={{ paddingTop: 80, minHeight: '100vh', background: '#000', padding: '80px 40px 40px' }}>
      <div style={{ maxWidth: 700, margin: '0 auto' }}>
        <div style={{ fontSize: 9, letterSpacing: 5, color: 'rgba(255,255,255,0.3)', marginBottom: 24 }}>DAO 2-OF-3 OVERRIDE PANEL</div>

        {!account && (
          <div style={{ background: 'rgba(255,230,0,0.08)', border: '1px solid rgba(255,230,0,0.2)', padding: '12px 20px', marginBottom: 20, fontSize: 10, color: '#ffe600', letterSpacing: 2 }}>
            ⚠ CONNECT WALLET TO PROPOSE OR CO-SIGN OVERRIDES
          </div>
        )}

        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 9, letterSpacing: 5, color: 'rgba(255,255,255,0.3)', marginBottom: 20 }}>PROPOSE OVERRIDE</div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <div style={{ fontSize: 9, letterSpacing: 3, color: 'rgba(255,255,255,0.4)', marginBottom: 8 }}>ACTION LOG ENTRY INDEX</div>
              <input type="number" value={entryIdx} onChange={e => setEntryIdx(Number(e.target.value))} min={0}
                style={{ background: 'rgba(0,255,200,0.05)', border: '1px solid rgba(0,255,200,0.2)', color: '#fff', padding: '8px 12px', fontFamily: 'Share Tech Mono', fontSize: 12, width: 120 }} />
            </div>
            <div>
              <div style={{ fontSize: 9, letterSpacing: 3, color: 'rgba(255,255,255,0.4)', marginBottom: 8 }}>OVERRIDE TYPE</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {[{ v:0, l:'RESTORE LTV' }, { v:1, l:'UNPAUSE' }, { v:2, l:'RESTORE CAP' }].map(o => (
                  <button key={o.v} onClick={() => setOverrideType(o.v)}
                    style={{ fontSize: 9, letterSpacing: 2, padding: '6px 14px', cursor: 'pointer', fontFamily: 'Share Tech Mono',
                      border: `1px solid ${overrideType===o.v ? 'rgba(0,255,200,0.6)' : 'rgba(255,255,255,0.1)'}`,
                      background: overrideType===o.v ? 'rgba(0,255,200,0.1)' : 'transparent',
                      color: overrideType===o.v ? '#00ffc8' : 'rgba(255,255,255,0.4)' }}>
                    {o.l}
                  </button>
                ))}
              </div>
            </div>
            {overrideType !== 1 && (
              <div>
                <div style={{ fontSize: 9, letterSpacing: 3, color: 'rgba(255,255,255,0.4)', marginBottom: 8 }}>
                  {overrideType === 0 ? 'NEW LTV (bps, e.g. 7500 = 75%)' : 'NEW CAP (MIST)'}
                </div>
                <input type="number" value={overrideValue} onChange={e => setOverrideValue(Number(e.target.value))}
                  style={{ background: 'rgba(0,255,200,0.05)', border: '1px solid rgba(0,255,200,0.2)', color: '#fff', padding: '8px 12px', fontFamily: 'Share Tech Mono', fontSize: 12, width: 200 }} />
              </div>
            )}
            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn" onClick={propose} disabled={loading}>
                {loading ? 'SUBMITTING...' : 'PROPOSE OVERRIDE'}
              </button>
              <button className="btn" onClick={cosign} disabled={loading}>
                {loading ? 'SUBMITTING...' : 'CO-SIGN & EXECUTE'}
              </button>
            </div>
          </div>
        </div>

        {status && (
          <div style={{
            padding: '12px 20px', fontSize: 10, letterSpacing: 2,
            background: status.startsWith('✅') ? 'rgba(0,255,200,0.08)' : 'rgba(255,30,60,0.08)',
            border: `1px solid ${status.startsWith('✅') ? 'rgba(0,255,200,0.3)' : 'rgba(255,30,60,0.3)'}`,
            color: status.startsWith('✅') ? '#00ffc8' : '#ff1f3c',
            wordBreak: 'break-all'
          }}>
            {status}
          </div>
        )}

        <div className="card" style={{ marginTop: 16 }}>
          <div style={{ fontSize: 9, letterSpacing: 5, color: 'rgba(255,255,255,0.3)', marginBottom: 12 }}>HOW IT WORKS</div>
          {[
            '1. Guardian 1 calls PROPOSE OVERRIDE — sets the type and value',
            '2. Guardian 2 calls CO-SIGN & EXECUTE — triggers execution if 2/3 threshold met',
            '3. Pool state is restored. Override recorded on-chain.',
          ].map((s,i) => (
            <div key={i} style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', letterSpacing: 1, marginBottom: 8, lineHeight: 1.6 }}>{s}</div>
          ))}
        </div>
      </div>
    </div>
  )
}
