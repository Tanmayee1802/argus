import dotenv from "dotenv";
dotenv.config();

export const CONFIG = {
  SUI_RPC_URL: process.env.SUI_RPC_URL ?? "https://fullnode.testnet.sui.io:443",
  AGENT_PRIVATE_KEY: process.env.AGENT_PRIVATE_KEY ?? "",
  PACKAGE_ID:       process.env.PACKAGE_ID       ?? "",
  POOL_ID:          process.env.POOL_ID          ?? "",
  ACTION_LOG_ID:    process.env.ACTION_LOG_ID    ?? "",
  ARGUS_POLICY_ID:  process.env.ARGUS_POLICY_ID  ?? "",
  DAO_POLICY_ID:    process.env.DAO_POLICY_ID    ?? "",
  WALRUS_AGGREGATOR: "https://aggregator.walrus-testnet.walrus.space",
  WALRUS_PUBLISHER:  "https://publisher.walrus-testnet.walrus.space",
  WALRUS_MODEL_BLOB_ID: process.env.WALRUS_MODEL_BLOB_ID ?? "placeholder",
  PYTH_SUI_USD_FEED: "0x23d7315113f5b1d3ba7a83604c44b94d79f4fd69af77f804fc7f920a6dc65744",
  PYTH_BTC_USD_FEED: "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
  HERMES_URL:        "https://hermes.pyth.network",
  CLOCK_OBJ: "0x6",
  EVAL_INTERVAL_MS: 15_000,
  MODEL_CACHE_MS:   300_000,
  USE_SEAL_ENCRYPTION: process.env.USE_SEAL_ENCRYPTION === "true",
  PORT: parseInt(process.env.PORT ?? "3001"),
} as const;

export const DEFAULT_MODEL_CONFIG = {
  weights: {
    price_velocity:    0.35,
    volatility_regime: 0.25,
    correlation_spike: 0.20,
    oracle_confidence: 0.10,
    utilization_rate:  0.10,
  },
  thresholds: {
    yellow: 60,
    orange: 75,
    red:    85,
    black:  95,
  },
  cooldown_ms: 300_000,
  price_velocity_breakpoints: [5, 10, 20],
  vol_ratio_breakpoints:      [1.5, 2.0, 3.0],
};

export type ModelConfig = typeof DEFAULT_MODEL_CONFIG;