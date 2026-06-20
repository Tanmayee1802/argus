import { SuiClient } from "@mysten/sui/client"
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519"
import { decodeSuiPrivateKey } from "@mysten/sui/cryptography"
import { Transaction } from "@mysten/sui/transactions"
import {
  computeRiskScore, updateBaselineVol, DEFAULT_MODEL,
  type PricePoint, type PoolState, type RiskScore, type ModelConfig,
} from "./risk_engine"

// ── Cloudflare Worker env bindings ────────────────────────
export interface Env {
  ARGUS_KV:           KVNamespace
  AGENT_PRIVATE_KEY:  string
  SUI_RPC_URL:        string
  PACKAGE_ID:         string
  POOL_ID:            string
  ACTION_LOG_ID:      string
  ARGUS_POLICY_ID:    string
  DAO_POLICY_ID:      string
  WALRUS_AGGREGATOR:  string
  WALRUS_MODEL_BLOB_ID: string
  PYTH_SUI_USD_FEED:  string
  PYTH_BTC_USD_FEED:  string
  HERMES_URL:         string
  CLOCK_OBJ:          string
}

// ── KV keys ───────────────────────────────────────────────
const KV = {
  SUI_PRICES:   "sui_prices",
  BTC_PRICES:   "btc_prices",
  BASELINE_VOL: "baseline_vol",
  LAST_STATE:   "last_state",
  EVAL_COUNT:   "eval_count",
  LAST_ACTION:  "last_action",
  MODEL_CACHE:  "model_cache",
  MODEL_TS:     "model_cache_ts",
}

const MAX_PRICES = 8  // 2h at 1-min intervals (workers run every 1 min)
const COOLDOWN_MS = 300_000

// ── Fetch Pyth prices ─────────────────────────────────────
async function fetchPythPrices(env: Env): Promise<{ sui: PricePoint; btc: PricePoint }> {
  const suiFeed = env.PYTH_SUI_USD_FEED.replace("0x", "")
  const btcFeed = env.PYTH_BTC_USD_FEED.replace("0x", "")
  const url = `${env.HERMES_URL}/v2/updates/price/latest?ids[]=${suiFeed}&ids[]=${btcFeed}`

  const res = await fetch(url)
  if (!res.ok) throw new Error(`Hermes error: ${res.status}`)
  const data = await res.json() as {
    parsed: Array<{
      id: string
      price: { price: string; conf: string; expo: number; publish_time: number }
    }>
  }

  const byId = new Map(data.parsed.map(p => [p.id.toLowerCase(), p]))
  const suiRaw = byId.get(suiFeed.toLowerCase())
  const btcRaw = byId.get(btcFeed.toLowerCase())
  if (!suiRaw || !btcRaw) throw new Error("Missing feed from Hermes")

  function parse(raw: typeof suiRaw): PricePoint {
    const scale = Math.pow(10, raw!.price.expo)
    return {
      price:      parseInt(raw!.price.price) * scale,
      confidence: parseInt(raw!.price.conf)  * scale,
      timestamp:  raw!.price.publish_time,
    }
  }
  return { sui: parse(suiRaw), btc: parse(btcRaw) }
}

// ── Fetch pool state from Sui ─────────────────────────────
async function fetchPoolState(env: Env): Promise<PoolState> {
  const client = new SuiClient({ url: env.SUI_RPC_URL })
  const obj = await client.getObject({
    id: env.POOL_ID,
    options: { showContent: true },
  })
  const fields = (obj.data?.content as any)?.fields ?? {}
  return {
    max_ltv_bps:     Number(fields.max_ltv_bps     ?? 7500),
    borrow_cap:      Number(fields.borrow_cap       ?? 0),
    total_deposited: Number(fields.total_deposited  ?? 0),
    total_borrowed:  Number(fields.total_borrowed   ?? 0),
    borrows_paused:  fields.borrows_paused           ?? false,
    fully_paused:    fields.fully_paused             ?? false,
    last_action_at:  Number(fields.last_action_at   ?? 0),
  }
}

// ── Load model config from Walrus ─────────────────────────
async function loadModelConfig(env: Env): Promise<ModelConfig> {
  try {
    // Cache for 5 min in KV
    const cachedTs = await env.ARGUS_KV.get(KV.MODEL_TS)
    if (cachedTs && Date.now() - parseInt(cachedTs) < 300_000) {
      const cached = await env.ARGUS_KV.get(KV.MODEL_CACHE)
      if (cached) return JSON.parse(cached)
    }

    const url = `${env.WALRUS_AGGREGATOR}/v1/blobs/${env.WALRUS_MODEL_BLOB_ID}`
    const res = await fetch(url)
    if (!res.ok) throw new Error("Walrus fetch failed")
    const config = await res.json() as ModelConfig

    await env.ARGUS_KV.put(KV.MODEL_CACHE, JSON.stringify(config))
    await env.ARGUS_KV.put(KV.MODEL_TS, Date.now().toString())
    return config
  } catch {
    return DEFAULT_MODEL
  }
}

// ── Build keypair ─────────────────────────────────────────
function getKeypair(env: Env): Ed25519Keypair {
  const key = env.AGENT_PRIVATE_KEY
  if (key.startsWith("suiprivkey")) {
    const { secretKey } = decodeSuiPrivateKey(key)
    return Ed25519Keypair.fromSecretKey(secretKey)
  }
  return Ed25519Keypair.fromSecretKey(
    Uint8Array.from(atob(key), c => c.charCodeAt(0))
  )
}

// ── Execute on-chain action ───────────────────────────────
async function executeAction(
  env:     Env,
  score:   RiskScore,
  pool:    PoolState,
  blobId:  string,
  prices:  { sui: PricePoint; btc: PricePoint },
): Promise<string | null> {
  if (score.alert_level === "green") return null

  const now = Date.now()
  if (pool.last_action_at > 0 && now - pool.last_action_at < COOLDOWN_MS) {
    console.log(`Cooldown active`)
    return null
  }

  const client  = new SuiClient({ url: env.SUI_RPC_URL })
  const keypair = getKeypair(env)
  const tx      = new Transaction()

  const poolObj        = tx.object(env.POOL_ID)
  const actionLogObj   = tx.object(env.ACTION_LOG_ID)
  const argusPolicyObj = tx.object(env.ARGUS_POLICY_ID)
  const clockObj       = tx.object(env.CLOCK_OBJ)

  let alertNum = 0, actionNum = 0
  let newLtv   = pool.max_ltv_bps
  let newCap   = pool.borrow_cap

  if (score.alert_level === "yellow") {
    alertNum = 1; actionNum = 0
    newLtv = Math.max(pool.max_ltv_bps - 500, 0)
    tx.moveCall({ target: `${env.PACKAGE_ID}::lending_pool::adjust_ltv`,
      arguments: [poolObj, tx.pure.u64(newLtv), clockObj] })

  } else if (score.alert_level === "orange") {
    alertNum = 2; actionNum = 1
    newLtv = Math.max(pool.max_ltv_bps - 1000, 0)
    newCap = Math.floor(pool.borrow_cap * 0.75)
    tx.moveCall({ target: `${env.PACKAGE_ID}::lending_pool::adjust_ltv`,
      arguments: [poolObj, tx.pure.u64(newLtv), clockObj] })
    tx.moveCall({ target: `${env.PACKAGE_ID}::lending_pool::tighten_borrow_cap`,
      arguments: [poolObj, tx.pure.u64(newCap), clockObj] })

  } else if (score.alert_level === "red") {
    alertNum = 3; actionNum = 2
    tx.moveCall({ target: `${env.PACKAGE_ID}::lending_pool::pause_new_borrows`,
      arguments: [poolObj, clockObj] })

  } else if (score.alert_level === "black") {
    alertNum = 4; actionNum = 3
    tx.moveCall({ target: `${env.PACKAGE_ID}::lending_pool::emergency_pause_all`,
      arguments: [poolObj, clockObj] })
  }

  const utilBps  = pool.total_deposited > 0
    ? Math.round(pool.total_borrowed/pool.total_deposited*10000) : 0
  const confBps  = prices.sui.price > 0
    ? Math.round(prices.sui.confidence/prices.sui.price*10000) : 0
  const blobBytes = Array.from(new TextEncoder().encode(blobId))

  const entry = tx.moveCall({
    target: `${env.PACKAGE_ID}::action_log::new_entry`,
    arguments: [
      tx.pure.u8(alertNum), tx.pure.u8(actionNum),
      tx.pure.u64(Math.round(score.total*100)),
      tx.pure.u64(Math.round(score.price_velocity*100)),
      tx.pure.u64(Math.round(score.vol_regime*100)),
      tx.pure.u64(Math.round(score.correlation*100)),
      tx.pure.u64(Math.round(score.oracle_confidence*100)),
      tx.pure.u64(Math.round(score.utilization*100)),
      tx.pure.u64(Math.round(Math.abs(prices.sui.price)*1e6)),
      tx.pure.u64(Math.round(Math.abs(prices.btc.price)*1e6)),
      tx.pure.u64(Math.round(Math.abs(score.pct_change)*1e6)),
      tx.pure.bool(score.pct_change < 0),
      tx.pure.u64(0), tx.pure.bool(false),
      tx.pure.u64(utilBps), tx.pure.u64(confBps),
      tx.pure.u64(pool.max_ltv_bps), tx.pure.u64(newLtv),
      tx.pure.u64(pool.borrow_cap),  tx.pure.u64(newCap),
      tx.pure.vector("u8", blobBytes),
      tx.pure.u64(now),
    ],
  })

  tx.moveCall({ target: `${env.PACKAGE_ID}::action_log::record`,
    arguments: [actionLogObj, entry, clockObj] })
  tx.moveCall({ target: `${env.PACKAGE_ID}::argus_policy::tick_action`,
    arguments: [argusPolicyObj] })

  const result = await client.signAndExecuteTransaction({
    signer: keypair, transaction: tx, options: { showEffects: true },
  })
  return result.digest
}

// ── Main evaluation cycle (runs every 1 min via cron) ─────
async function evaluationCycle(env: Env): Promise<void> {
  console.log("[Argus Worker] Starting evaluation cycle")

  // 1. Load model config from Walrus
  const config = await loadModelConfig(env)

  // 2. Fetch prices
  const prices = await fetchPythPrices(env)
  console.log(`[Argus] SUI $${prices.sui.price.toFixed(4)} | BTC $${prices.btc.price.toFixed(0)}`)

  // 3. Load + update rolling price history from KV
  const suiRaw = await env.ARGUS_KV.get(KV.SUI_PRICES)
  const btcRaw = await env.ARGUS_KV.get(KV.BTC_PRICES)
  let suiPrices: PricePoint[] = suiRaw ? JSON.parse(suiRaw) : []
  let btcPrices: PricePoint[] = btcRaw ? JSON.parse(btcRaw) : []

  suiPrices.push({ price: prices.sui.price, confidence: prices.sui.confidence, timestamp: Date.now() })
  btcPrices.push({ price: prices.btc.price, confidence: prices.btc.confidence, timestamp: Date.now() })
  if (suiPrices.length > MAX_PRICES) suiPrices = suiPrices.slice(-MAX_PRICES)
  if (btcPrices.length > MAX_PRICES) btcPrices = btcPrices.slice(-MAX_PRICES)

  await env.ARGUS_KV.put(KV.SUI_PRICES, JSON.stringify(suiPrices))
  await env.ARGUS_KV.put(KV.BTC_PRICES, JSON.stringify(btcPrices))

  // 4. Update baseline vol
  const baselineRaw = await env.ARGUS_KV.get(KV.BASELINE_VOL)
  let baselineVol   = baselineRaw ? parseFloat(baselineRaw) : 0.80
  baselineVol = updateBaselineVol(baselineVol, suiPrices)
  await env.ARGUS_KV.put(KV.BASELINE_VOL, baselineVol.toString())

  // 5. Fetch pool state
  const pool = await fetchPoolState(env)

  // 6. Compute risk score
  const score = computeRiskScore(suiPrices, btcPrices, pool, config, baselineVol)
  console.log(`[Argus] Score: ${score.total.toFixed(1)} | Level: ${score.alert_level.toUpperCase()}`)

  // 7. Update eval count
  const evalRaw  = await env.ARGUS_KV.get(KV.EVAL_COUNT)
  const evalCount = (evalRaw ? parseInt(evalRaw) : 0) + 1
  await env.ARGUS_KV.put(KV.EVAL_COUNT, evalCount.toString())

  // 8. Execute action if needed
  let lastAction = null
  const lastActionRaw = await env.ARGUS_KV.get(KV.LAST_ACTION)
  if (lastActionRaw) lastAction = JSON.parse(lastActionRaw)

  if (score.alert_level !== "green") {
    const digest = await executeAction(
      env, score, pool, env.WALRUS_MODEL_BLOB_ID, prices
    )
    if (digest) {
      lastAction = { digest, level: score.alert_level, ts: Date.now() }
      await env.ARGUS_KV.put(KV.LAST_ACTION, JSON.stringify(lastAction))
      console.log(`[Argus] ✅ Action! Tx: ${digest}`)
    }
  }

  // 9. Save full state for API
  const state = {
    score,
    pool: {
      max_ltv_bps:     pool.max_ltv_bps.toString(),
      borrow_cap:      pool.borrow_cap.toString(),
      total_deposited: pool.total_deposited.toString(),
      total_borrowed:  pool.total_borrowed.toString(),
      borrows_paused:  pool.borrows_paused,
      fully_paused:    pool.fully_paused,
      last_action_at:  pool.last_action_at.toString(),
    },
    prices: {
      sui_usd:      prices.sui.price,
      btc_usd:      prices.btc.price,
      sui_conf:     prices.sui.confidence,
      btc_conf:     prices.btc.confidence,
      publish_time: prices.sui.timestamp ?? Date.now()/1000,
    },
    last_action:   lastAction,
    eval_count:    evalCount,
    model_blob_id: env.WALRUS_MODEL_BLOB_ID,
    error:         null,
  }
  await env.ARGUS_KV.put(KV.LAST_STATE, JSON.stringify(state))
}

// ── Worker export ─────────────────────────────────────────
export default {

  // Cron trigger — runs every minute
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(evaluationCycle(env))
  },

  // Fetch handler — serves the /state API
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url  = new URL(request.url)
    const cors = {
      "Access-Control-Allow-Origin":  "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    }

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: cors })
    }

    // GET /state — main endpoint frontend polls
    if (url.pathname === "/state" && request.method === "GET") {
      const raw = await env.ARGUS_KV.get(KV.LAST_STATE)
      if (!raw) {
        return new Response(JSON.stringify({
          score: null, pool: null, prices: null,
          last_action: null, eval_count: 0,
          model_blob_id: env.WALRUS_MODEL_BLOB_ID,
          error: "No data yet — waiting for first cron cycle",
        }), { headers: { "Content-Type": "application/json", ...cors } })
      }
      return new Response(raw, {
        headers: { "Content-Type": "application/json", ...cors }
      })
    }

    // GET /health
    if (url.pathname === "/health") {
      return new Response(JSON.stringify({ status: "ok", ts: Date.now() }), {
        headers: { "Content-Type": "application/json", ...cors }
      })
    }

    // POST /trigger — manually trigger a cycle (for demo)
    if (url.pathname === "/trigger" && request.method === "POST") {
      try {
        await evaluationCycle(env)
        const raw = await env.ARGUS_KV.get(KV.LAST_STATE)
        return new Response(raw ?? "{}", {
          headers: { "Content-Type": "application/json", ...cors }
        })
      } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500,
          headers: { "Content-Type": "application/json", ...cors }
        })
      }
    }

    return new Response("Not found", { status: 404, headers: cors })
  },
}