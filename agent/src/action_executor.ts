import { Transaction } from "@mysten/sui/transactions";
import { SuiClient } from "@mysten/sui/client";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { CONFIG } from "./config";
import type { RiskScore, PoolState } from "./risk_engine";
import type { ModelConfig } from "./config";

export interface PythPrice {
  price:       number;
  confidence:  number;
  expo:        number;
  publishTime: number;
}

export async function fetchPythPrices(): Promise<{ sui: PythPrice; btc: PythPrice }> {
  const suiFeed = CONFIG.PYTH_SUI_USD_FEED.replace("0x", "");
  const btcFeed = CONFIG.PYTH_BTC_USD_FEED.replace("0x", "");
  const url =
    `${CONFIG.HERMES_URL}/v2/updates/price/latest` +
    `?ids[]=${suiFeed}&ids[]=${btcFeed}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Hermes API error: ${res.status}`);
  const data = (await res.json()) as {
    parsed: Array<{
      id: string;
      price: { price: string; conf: string; expo: number; publish_time: number };
    }>;
  };
  if (!data.parsed || data.parsed.length < 2)
    throw new Error("Hermes returned fewer than 2 feeds");

  const byId = new Map(data.parsed.map((p) => [p.id.toLowerCase(), p]));
  const suiRaw = byId.get(suiFeed.toLowerCase()) ?? byId.get(CONFIG.PYTH_SUI_USD_FEED.toLowerCase());
  const btcRaw = byId.get(btcFeed.toLowerCase()) ?? byId.get(CONFIG.PYTH_BTC_USD_FEED.toLowerCase());
  if (!suiRaw || !btcRaw) throw new Error(`Missing feed. Got: ${[...byId.keys()].join(", ")}`);

  function parseFeed(raw: (typeof data.parsed)[0]): PythPrice {
    const scale = Math.pow(10, raw.price.expo);
    return {
      price:       parseInt(raw.price.price) * scale,
      confidence:  parseInt(raw.price.conf)  * scale,
      expo:        raw.price.expo,
      publishTime: raw.price.publish_time,
    };
  }
  return { sui: parseFeed(suiRaw), btc: parseFeed(btcRaw) };
}

export async function fetchPoolState(client: SuiClient): Promise<PoolState> {
  const obj = await client.getObject({ id: CONFIG.POOL_ID, options: { showContent: true } });
  const fields = (obj.data?.content as any)?.fields ?? {};
  return {
    total_deposited: BigInt(fields.total_deposited ?? 0),
    total_borrowed:  BigInt(fields.total_borrowed  ?? 0),
    max_ltv_bps:     BigInt(fields.max_ltv_bps     ?? 7500),
    borrow_cap:      BigInt(fields.borrow_cap      ?? 0),
    borrows_paused:  fields.borrows_paused          ?? false,
    fully_paused:    fields.fully_paused            ?? false,
    last_action_at:  BigInt(fields.last_action_at   ?? 0),
  };
}

export async function executeAction(
  client:  SuiClient,
  keypair: Ed25519Keypair,
  score:   RiskScore,
  pool:    PoolState,
  config:  ModelConfig,
  blobId:  string,
  prices:  { sui: PythPrice; btc: PythPrice },
): Promise<string | null> {
  if (score.alert_level === "green") return null;

  const now = Date.now();
  const lastAction = Number(pool.last_action_at);
  if (lastAction > 0 && now - lastAction < config.cooldown_ms) {
    const remaining = Math.round((config.cooldown_ms - (now - lastAction)) / 1000);
    console.log(`[Executor] Cooldown active. ${remaining}s remaining.`);
    return null;
  }

  const tx = new Transaction();
  const poolObj        = tx.object(CONFIG.POOL_ID);
  const actionLogObj   = tx.object(CONFIG.ACTION_LOG_ID);
  const argusPolicyObj = tx.object(CONFIG.ARGUS_POLICY_ID);
  const clockObj       = tx.object(CONFIG.CLOCK_OBJ);

  let alertLevelNum = 0;
  let actionTypeNum = 0;
  let newLtv        = Number(pool.max_ltv_bps);
  let newCap        = Number(pool.borrow_cap);

  if (score.alert_level === "yellow") {
    alertLevelNum = 1; actionTypeNum = 0;
    newLtv = Math.max(Number(pool.max_ltv_bps) - 500, 0);
    tx.moveCall({ target: `${CONFIG.PACKAGE_ID}::lending_pool::adjust_ltv`,
      arguments: [poolObj, tx.pure.u64(newLtv), clockObj] });
  } else if (score.alert_level === "orange") {
    alertLevelNum = 2; actionTypeNum = 1;
    newLtv = Math.max(Number(pool.max_ltv_bps) - 1000, 0);
    newCap = Math.floor(Number(pool.borrow_cap) * 0.75);
    tx.moveCall({ target: `${CONFIG.PACKAGE_ID}::lending_pool::adjust_ltv`,
      arguments: [poolObj, tx.pure.u64(newLtv), clockObj] });
    tx.moveCall({ target: `${CONFIG.PACKAGE_ID}::lending_pool::tighten_borrow_cap`,
      arguments: [poolObj, tx.pure.u64(newCap), clockObj] });
  } else if (score.alert_level === "red") {
    alertLevelNum = 3; actionTypeNum = 2;
    tx.moveCall({ target: `${CONFIG.PACKAGE_ID}::lending_pool::pause_new_borrows`,
      arguments: [poolObj, clockObj] });
  } else if (score.alert_level === "black") {
    alertLevelNum = 4; actionTypeNum = 3;
    tx.moveCall({ target: `${CONFIG.PACKAGE_ID}::lending_pool::emergency_pause_all`,
      arguments: [poolObj, clockObj] });
  }

  const suiPriceU64  = Math.round(Math.abs(prices.sui.price) * 1e6);
  const btcPriceU64  = Math.round(Math.abs(prices.btc.price) * 1e6);
  const suiChangeAbs = Math.round(Math.abs(score.pct_change) * 1e6);
  const suiChangeNeg = score.pct_change < 0;
  const utilBps = Number(pool.total_deposited) > 0
    ? Math.round((Number(pool.total_borrowed) / Number(pool.total_deposited)) * 10000) : 0;
  const confBps = prices.sui.price > 0
    ? Math.round((prices.sui.confidence / prices.sui.price) * 10000) : 0;
  const blobBytes = Array.from(Buffer.from(blobId, "utf-8"));

  const entry = tx.moveCall({
    target: `${CONFIG.PACKAGE_ID}::action_log::new_entry`,
    arguments: [
      tx.pure.u8(alertLevelNum), tx.pure.u8(actionTypeNum),
      tx.pure.u64(Math.round(score.total * 100)),
      tx.pure.u64(Math.round(score.price_velocity * 100)),
      tx.pure.u64(Math.round(score.vol_regime * 100)),
      tx.pure.u64(Math.round(score.correlation * 100)),
      tx.pure.u64(Math.round(score.oracle_confidence * 100)),
      tx.pure.u64(Math.round(score.utilization * 100)),
      tx.pure.u64(suiPriceU64), tx.pure.u64(btcPriceU64),
      tx.pure.u64(suiChangeAbs), tx.pure.bool(suiChangeNeg),
      tx.pure.u64(0), tx.pure.bool(false),
      tx.pure.u64(utilBps), tx.pure.u64(confBps),
      tx.pure.u64(Number(pool.max_ltv_bps)), tx.pure.u64(newLtv),
      tx.pure.u64(Number(pool.borrow_cap)), tx.pure.u64(newCap),
      tx.pure.vector("u8", blobBytes), tx.pure.u64(now),
    ],
  });

  tx.moveCall({ target: `${CONFIG.PACKAGE_ID}::action_log::record`,
    arguments: [actionLogObj, entry, clockObj] });
  tx.moveCall({ target: `${CONFIG.PACKAGE_ID}::argus_policy::tick_action`,
    arguments: [argusPolicyObj] });

  console.log(`[Executor] Firing ${score.alert_level.toUpperCase()} action. Score: ${score.total.toFixed(1)}`);
  const result = await client.signAndExecuteTransaction({
    signer: keypair, transaction: tx, options: { showEffects: true },
  });
  if (result.effects?.status?.status !== "success")
    throw new Error(`Tx failed: ${JSON.stringify(result.effects?.status)}`);
  return result.digest;
}