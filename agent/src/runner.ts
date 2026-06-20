import express from "express";
import cors from "cors";
import { SuiClient } from "@mysten/sui/client";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { decodeSuiPrivateKey } from "@mysten/sui/cryptography";
import { Transaction } from "@mysten/sui/transactions";
import { CONFIG } from "./config";
import { PriceHistory } from "./price_history";
import { computeRiskScoreWithUtil, type RiskScore, type PoolState } from "./risk_engine";
import { loadModelConfig, uploadModelConfigToWalrus, clearModelCache, getCachedBlobId } from "./model_loader";
import { fetchPythPrices, fetchPoolState, executeAction, type PythPrice } from "./action_executor";

// ── Agent state ───────────────────────────────────────────────
interface AgentState {
  score:       RiskScore | null;
  pool:        PoolState | null;
  prices:      { sui: PythPrice; btc: PythPrice } | null;
  lastAction:  { digest: string; level: string; ts: number } | null;
  evalCount:   number;
  startedAt:   number;
  error:       string | null;
  modelBlobId: string;
}

const state: AgentState = {
  score:       null,
  pool:        null,
  prices:      null,
  lastAction:  null,
  evalCount:   0,
  startedAt:   Date.now(),
  error:       null,
  modelBlobId: "placeholder",
};

// ── Sui client ────────────────────────────────────────────────
const client = new SuiClient({ url: CONFIG.SUI_RPC_URL });

// ── Keypair ───────────────────────────────────────────────────
let keypair: Ed25519Keypair;
try {
  if (!CONFIG.AGENT_PRIVATE_KEY) throw new Error("AGENT_PRIVATE_KEY not set in .env");

  let secretKey: Uint8Array;

  if (CONFIG.AGENT_PRIVATE_KEY.startsWith("suiprivkey")) {
    // Bech32 format — from sui keytool export
    const decoded = decodeSuiPrivateKey(CONFIG.AGENT_PRIVATE_KEY);
    secretKey = decoded.secretKey;
  } else {
    // Raw base64 fallback
    const buf = Buffer.from(CONFIG.AGENT_PRIVATE_KEY, "base64");
    secretKey = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  }

  keypair = Ed25519Keypair.fromSecretKey(secretKey);
  console.log(`[Argus] Agent address: ${keypair.getPublicKey().toSuiAddress()}`);
} catch (e) {
  console.error("[Argus] Keypair init failed:", e);
  process.exit(1);
}

// ── Price history ─────────────────────────────────────────────
const history = new PriceHistory();

// ── Main evaluation cycle ─────────────────────────────────────
async function evaluationCycle(): Promise<void> {
  try {
    state.error = null;

    // 1. Load model config from Walrus (cached 5 min)
    const config = await loadModelConfig();
    state.modelBlobId = getCachedBlobId();

    // 2. Fetch live Pyth prices
    const prices = await fetchPythPrices();
    state.prices = prices;
    console.log(
      `[Argus] #${state.evalCount + 1} | ` +
      `SUI $${prices.sui.price.toFixed(4)} | ` +
      `BTC $${prices.btc.price.toFixed(0)}`
    );

    // 3. Push into rolling history
    history.push(
      {
        price:      prices.sui.price,
        confidence: prices.sui.confidence,
        timestamp:  Date.now(),
      },
      {
        price:      prices.btc.price,
        confidence: prices.btc.confidence,
        timestamp:  Date.now(),
      }
    );

    // 4. Fetch on-chain pool state
    const pool = await fetchPoolState(client);
    state.pool = pool;

    // 5. Compute 5-factor risk score
    const score = computeRiskScoreWithUtil(history, config, pool);
    state.score = score;
    state.evalCount++;

    console.log(
      `[Argus] Score: ${score.total.toFixed(1)} | ` +
      `Level: ${score.alert_level.toUpperCase()} | ` +
      `${score.reasoning}`
    );

    // 6. Tick on-chain counter every 10 cycles (saves gas)
    if (state.evalCount % 10 === 0) {
      try {
        const tx = new Transaction();
        tx.moveCall({
          target: `${CONFIG.PACKAGE_ID}::argus_policy::tick_evaluation`,
          arguments: [
            tx.object(CONFIG.ARGUS_POLICY_ID),
            tx.object(CONFIG.CLOCK_OBJ),
          ],
        });
        await client.signAndExecuteTransaction({
          signer: keypair,
          transaction: tx,
        });
        console.log(`[Argus] Ticked evaluation counter on-chain.`);
      } catch (tickErr: any) {
        console.warn("[Argus] Tick failed (non-fatal):", tickErr?.message);
      }
    }

    // 7. Execute protective action if needed
    if (score.alert_level !== "green") {
      const digest = await executeAction(
        client,
        keypair,
        score,
        pool,
        config,
        state.modelBlobId,
        prices,
      );
      if (digest) {
        state.lastAction = {
          digest,
          level: score.alert_level,
          ts:    Date.now(),
        };
        console.log(
          `[Argus] ✅ Action executed! ` +
          `Level: ${score.alert_level.toUpperCase()} | Tx: ${digest}`
        );
      }
    }

  } catch (err: any) {
    state.error = err?.message ?? "Unknown error in evaluation cycle";
    console.error("[Argus] ❌ Cycle error:", err?.message);
  }
}

// ── Express API ───────────────────────────────────────────────
const app = express();
app.use(cors());
app.use(express.json());

// Main state — frontend polls this every 15s
app.get("/state", (_req, res) => {
  res.json({
    score: state.score,
    pool: state.pool
      ? {
          max_ltv_bps:     state.pool.max_ltv_bps.toString(),
          borrow_cap:      state.pool.borrow_cap.toString(),
          total_deposited: state.pool.total_deposited.toString(),
          total_borrowed:  state.pool.total_borrowed.toString(),
          borrows_paused:  state.pool.borrows_paused,
          fully_paused:    state.pool.fully_paused,
          last_action_at:  state.pool.last_action_at.toString(),
        }
      : null,
    prices: state.prices
      ? {
          sui_usd:      state.prices.sui.price,
          btc_usd:      state.prices.btc.price,
          sui_conf:     state.prices.sui.confidence,
          btc_conf:     state.prices.btc.confidence,
          publish_time: state.prices.sui.publishTime,
        }
      : null,
    last_action:   state.lastAction,
    eval_count:    state.evalCount,
    uptime_ms:     Date.now() - state.startedAt,
    error:         state.error,
    model_blob_id: state.modelBlobId,
  });
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok", ts: Date.now() });
});

// Upload default model config to Walrus
app.post("/upload-model", async (_req, res) => {
  try {
    const { DEFAULT_MODEL_CONFIG } = await import("./config");
    const blobId = await uploadModelConfigToWalrus(DEFAULT_MODEL_CONFIG);
    clearModelCache();
    res.json({ blobId });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Force model cache refresh
app.post("/refresh-model", (_req, res) => {
  clearModelCache();
  res.json({ ok: true });
});

app.listen(CONFIG.PORT, () => {
  console.log(`[Argus] API on http://localhost:${CONFIG.PORT}`);
  console.log(`[Argus] State: http://localhost:${CONFIG.PORT}/state`);
});

// ── Start evaluation loop ─────────────────────────────────────
console.log("[Argus] Starting — first cycle in 2s...");
setTimeout(() => {
  evaluationCycle();
  setInterval(evaluationCycle, CONFIG.EVAL_INTERVAL_MS);
}, 2_000);