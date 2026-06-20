import { useEffect, useState } from 'react'
import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from '@mysten/dapp-kit'
import { Transaction } from '@mysten/sui/transactions'
import { CONFIG } from '../config'

const DEFAULT_MODEL = {
  weights: { price_velocity:0.35, volatility_regime:0.25, correlation_spike:0.20, oracle_confidence:0.10, utilization_rate:0.10 },
  thresholds: { yellow:60, orange:75, red:85, black:95 },
  cooldown_ms: 300000,
  price_velocity_breakpoints: [5,10,20],
  vol_ratio_breakpoints: [1.5,2.0,3.0],
}

export default function ModelConfig() {
  const account = useCurrentAccount()
  const client = useSuiClient()
  const { mutate: signAndExecute } = useSignAndExecuteTransaction()
  const [blobId, setBlobId] = useState('')
  const [agentState, setAgentState] = useState<any>(null)
  const [status, setStatus] = useState('')
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    const loadPolicy = async () => {
      try {
        const obj = await client.getObject({ id: CONFIG.ARGUS_POLICY_ID, options: { showContent: true } })
        const fields = (obj.data?.content as any)?.fields ?? {}
        const blob = fields.walrus_model_blob_id
        if (Array.isArray(blob)) setBlobId(Buffer.from(blob).toString('utf-8'))
        else setBlobId(blob ?? 'not set')
      } catch {}
    }
    const loadAgent = async () => {
      try {
        const res = await fetch(`${CONFIG.AGENT_API}/state`)
        setAgentState(await res.json())
      } catch {}
    }
    loadPolicy(); loadAgent()
  }, [client])

  const uploadAndUpdate = async () => {
    if (!account) return setStatus('Connect wallet first')
    setUploading(true)
    setStatus('Uploading model config to Walrus...')
    try {
      // Upload to Walrus via agent endpoint
      const res = await fetch(`${CONFIG.AGENT_API}/upload-model`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(DEFAULT_MODEL) })
      const { blobId: newBlobId, error } = await res.json()
      if (error) throw new Error(error)
      setStatus(`Walrus upload done. Blob: ${newBlobId.slice(0,20)}... Updating on-chain...`)

      // Update ArgusPolicy on-chain
      const tx = new Transaction()
      const blobBytes = Array.from(Buffer.from(newBlobId, 'utf-8'))
      tx.moveCall({
        target: `${CONFIG.PACKAGE_ID}::argus_policy::update_model_blob`,
        arguments: [
          tx.object(CONFIG.ARGUS_POLICY_ID),
          tx.pure.vector('u8', blobBytes),
          tx.object(CONFIG.DAO_POLICY_ID),
          tx.object('0x6'),
        ],
      })
      signAndExecute({ transaction: tx }, {
        onSuccess: (r) => {
          setBlobId(newBlobId)
          setStatus(`✅ Model updated on-chain! Tx: ${r.digest.slice(0,20)}...`)
          setUploading(false)
        },
        onError: (e) => { setStatus(`❌ ${e.message}`); setUploading(false) },
      })
    } catch (e: any) { setStatus(`❌ ${e.message}`); setUploading(false) }
  }

  return (
    <div style={{ paddingTop: 80, minHeight: '100vh', background: '#000', padding: '80px 40px 40px' }}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <div style={{ fontSize: 9, letterSpacing: 5, color: 'rgba(255,255,255,0.3)', marginBottom: 24 }}>WALRUS MODEL CONFIGURATION</div>

        {/* Active blob */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 9, letterSpacing: 5, color: 'rgba(255,255,255,0.3)', marginBottom: 16 }}>ACTIVE MODEL BLOB</div>
          <div style={{ fontSize: 10, color: 'rgba(0,220,255,0.6)', letterSpacing: 2, wordBreak: 'break-all', marginBottom: 8 }}>{blobId || 'loading...'}</div>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)', letterSpacing: 1 }}>
            Agent reads this blob every 5 minutes. DAO can update without redeploying contracts.
          </div>
          {agentState?.model_blob_id && (
            <div style={{ marginTop: 8, fontSize: 9, color: 'rgba(0,220,255,0.4)', letterSpacing: 1 }}>
              AGENT READING: {agentState.model_blob_id.slice(0,40)}
            </div>
          )}
        </div>

        {/* Current weights */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 9, letterSpacing: 5, color: 'rgba(255,255,255,0.3)', marginBottom: 16 }}>MODEL WEIGHTS</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {Object.entries(DEFAULT_MODEL.weights).map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 9, letterSpacing: 2, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase' }}>{k.replace(/_/g,' ')}</span>
                <span style={{ fontSize: 11, color: '#00ffc8' }}>{(v*100).toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Thresholds */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 9, letterSpacing: 5, color: 'rgba(255,255,255,0.3)', marginBottom: 16 }}>ALERT THRESHOLDS</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {Object.entries(DEFAULT_MODEL.thresholds).map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 9, letterSpacing: 2, color: k === 'black' ? '#8b0000' : k === 'red' ? '#ff1f3c' : k === 'orange' ? '#ff7300' : '#ffe600', textTransform: 'uppercase' }}>{k}</span>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>≥ {v}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Update button */}
        <div className="card">
          <div style={{ fontSize: 9, letterSpacing: 5, color: 'rgba(255,255,255,0.3)', marginBottom: 12 }}>UPDATE MODEL (DAO ONLY)</div>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)', letterSpacing: 1, marginBottom: 16, lineHeight: 1.8 }}>
            Uploads current config JSON to Walrus, then calls update_model_blob() on ArgusPolicy.<br/>
            Argus agent will pick up the new parameters within 5 minutes. No contract redeployment needed.
          </div>
          <button className="btn" onClick={uploadAndUpdate} disabled={uploading || !account}>
            {uploading ? 'UPLOADING...' : 'UPLOAD TO WALRUS + UPDATE ON-CHAIN'}
          </button>
        </div>

        {status && (
          <div style={{
            marginTop: 16, padding: '12px 20px', fontSize: 10, letterSpacing: 2,
            background: status.startsWith('✅') ? 'rgba(0,255,200,0.08)' : 'rgba(255,30,60,0.08)',
            border: `1px solid ${status.startsWith('✅') ? 'rgba(0,255,200,0.3)' : 'rgba(255,30,60,0.3)'}`,
            color: status.startsWith('✅') ? '#00ffc8' : '#ff1f3c', wordBreak: 'break-all'
          }}>
            {status}
          </div>
        )}
      </div>
    </div>
  )
}
