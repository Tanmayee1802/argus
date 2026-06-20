# Argus — Autonomous Risk Guardian for Sui DeFi

[![Live Demo](https://img.shields.io/badge/Live_Demo-argus--guardian.pages.dev-00b4d8?style=flat-square)](https://argus-guardian.pages.dev)
[![Network](https://img.shields.io/badge/Network-Sui_Testnet-4f46e5?style=flat-square)](https://testnet.suivision.xyz/)
[![Hackathon](https://img.shields.io/badge/Hackathon-Sui_Overflow_2026-7c3aed?style=flat-square)](https://sui.io/overflow)
[![License](https://img.shields.io/badge/License-MIT-854d0e?style=flat-square)](LICENSE)

> The first autonomous AI risk guardian for Sui DeFi lending pools — monitoring live Pyth price feeds, computing a 5-factor risk score every minute, and firing protective on-chain actions automatically before human damage control is possible.

**Live Demo:** argus-guardian.pages.dev  
**Agent API:** argus-agent.karthik260406t.workers.dev/state

---

## What is Argus?

DeFi lending pools are vulnerable to sudden price crashes. When SUI drops 20% in minutes, human teams can't react fast enough — bad debt accumulates, liquidation cascades begin, and millions are lost before anyone pauses the pool.

**Argus solves this by watching 24/7 and acting in seconds:**

- SUI drops 8% → automatically tightens LTV from 75% to 70%
- SUI drops 15% + BTC correlated drop → pauses new borrows
- SUI crashes 25% → emergency halts the entire pool
- DAO can override any action with 2-of-3 multisig

---

## Hackathon Tracks

| Track | Prize Pool | Why We Qualify |
|-------|-----------|----------------|
| DeFi & Payments | $30,000 | Autonomous risk infrastructure for lending protocols |
| Walrus Storage | $20,000 | Risk model weights stored and updated via Walrus blobs |
| AI / Autonomous Agents | $20,000 | On-chain AI agent with full reasoning trail |
| University Award | $2,500 | VIT-AP University student submission |
| **Total** | **$72,500** | |

---

## Key Features

### Autonomous Risk Engine
- 5-factor composite risk score computed every 60 seconds
- 5 alert levels from GREEN to BLACK with graduated automated responses
- No human intervention required — Argus acts before damage occurs

### Walrus Model Storage
- Risk model weights and thresholds stored encrypted on Walrus decentralised storage
- DAO updates the model by uploading a new config blob — zero contract redeployment needed
- Argus reads new parameters within 5 minutes

### On-Chain Reasoning
- Every autonomous action stores the full 5-factor score breakdown on-chain
- Not just *what* happened — but *why* it triggered
- Fully auditable, forever

### 2-of-3 DAO Multisig
- Any autonomous action can be reversed by 2 of 3 guardian addresses
- No redeployment required
- Humans always have the final word

### Pyth Oracle Integration
- Real-time SUI/USD and BTC/USD prices from Pyth Network
- Stale price protection — rejects prices older than 60 seconds
- Oracle confidence degradation is itself a risk factor

---

## Architecture

```
Pyth Network (SUI/USD + BTC/USD)
        │
        ▼
Cloudflare Worker (every 1 min)
  ├── Fetches live prices
  ├── Computes 5-factor risk score
  ├── Reads model weights from Walrus
  └── Fires on-chain actions if threshold crossed
        │
        ▼
Sui Testnet Smart Contracts (Move)
  ├── lending_pool   — DeFi pool with guardian functions
  ├── argus_policy   — Agent config + Walrus blob reference
  ├── dao_policy     — 2-of-3 multisig override
  └── action_log     — On-chain audit trail with full reasoning
        │
        ▼
React + Vite + Three.js Frontend (Cloudflare Pages)
```

---

## Smart Contracts

**Package Address**
```
0x1fb3180e24c981f523d89bb78c638c6be1019c7d619f19708f2bd23c8f99cf6f
```

### Module: `lending_pool`
Core DeFi pool with guardian-callable protection functions.

| Function | Description |
|----------|-------------|
| `tighten_ltv(registry, new_ltv, clock)` | Reduce max LTV ratio |
| `pause_borrows(registry, clock)` | Halt new borrow activity |
| `emergency_pause(registry, clock)` | Full pool halt |
| `resume(registry, clock)` | Restore normal operation |

### Module: `argus_policy`
Agent configuration and Walrus model reference.

```move
// Read model config from Walrus blob reference
public fun get_policy(policy: &ArgusPolicy): (u64, u64, u64, address)

// Update blob reference — DAO calls this after uploading new model to Walrus
public fun update_walrus_blob(policy: &mut ArgusPolicy, new_blob_id: address)
```

### Module: `dao_policy`
2-of-3 multisig override mechanism.

| Function | Description |
|----------|-------------|
| `propose_override(dao, action, clock)` | Guardian proposes an override |
| `approve_override(dao, proposal_id, clock)` | Second guardian approves |
| `execute_override(dao, proposal_id, pool, clock)` | Execute with 2-of-3 approval |

### Module: `action_log`
Immutable on-chain audit trail.

```move
// Log every autonomous action with full 5-factor breakdown
public fun log_action(
    log: &mut ActionLog,
    action_type: u8,
    risk_score: u64,
    price_velocity: u64,
    volatility_regime: u64,
    cross_asset_corr: u64,
    oracle_confidence: u64,
    pool_utilization: u64,
    clock: &Clock
)
```

---

## 5-Factor Risk Model

Each 1-minute cycle computes a weighted composite score (0–100):

| Factor | Weight | What It Measures |
|--------|--------|-----------------|
| Price Velocity | 35% | SUI 15-minute price change |
| Volatility Regime | 25% | Current vol vs 7-day baseline |
| Cross-Asset Correlation | 20% | SUI + BTC falling together = systemic risk |
| Oracle Confidence | 10% | Pyth confidence interval degradation |
| Pool Utilization | 10% | Borrowed / Deposited ratio |

---

## Alert Levels & Automated Actions

| Score | Level | Automated Action |
|-------|-------|-----------------|
| 0–59 | 🟢 GREEN | Monitor only — no action |
| 60–74 | 🟡 YELLOW | Tighten LTV −500 bps |
| 75–84 | 🟠 ORANGE | Tighten LTV −1000 bps + reduce borrow cap |
| 85–94 | 🔴 RED | Pause new borrows |
| 95–100 | ⚫ BLACK | Emergency pause all activity |

---

## Deployed Objects (Sui Testnet)

```
Package:      0x1fb3180e24c981f523d89bb78c638c6be1019c7d619f19708f2bd23c8f99cf6f
LendingPool:  0xdd98e483bba7bcd2443c32294b8ad83fd9a3e7f18a9ab8c51450bda31b700a38
DaoPolicy:    0x02fe5bb520ad4374b8a63626be277f0a3d6930c8d98ab3effea853601914cdee
ActionLog:    0x47a046473e3dc6b9d6ff8a427fd886df8be424b6decb5b733e2c33b211e330e2
ArgusPolicy:  0x16e8d05eebc40372bb1ccee6c0b86fd667689ed31cec584a9cfaa156a9c902c7
Walrus Blob:  d6mFT8hJJnP3Ic_uOdY0zccFCdRV8hQkg_35OTC3I48
```

---

## Frontend

Built with React + Vite + Three.js, deployed on Cloudflare Pages.

### Pages

| Page | Description |
|------|-------------|
| `/` | Live dashboard — risk score gauge, price feeds, recent actions |
| `/history` | On-chain action log — full 5-factor breakdown per event |
| `/dao` | Multisig panel — propose, approve, and execute overrides |
| `/model` | Model config viewer — current Walrus blob weights and thresholds |

### Tech Stack

```
React 18                   — UI framework
@mysten/dapp-kit            — Sui wallet connection
@mysten/sui                 — Transaction building (PTB)
@tanstack/react-query       — Data fetching + caching
Three.js                    — 3D risk visualisation
@pythnetwork/pyth-sui-js    — Pyth price feed updates
Cloudflare Pages            — Frontend hosting
Cloudflare Workers          — Agent runtime (1-minute cron)
```

### Design System

```
Font:       Space Grotesk (headings) + Inter (body) + JetBrains Mono (data)
Background: #050505 near-black
Text:       #e8e8e8 off-white
Accents:    #00ff88 (green) · #ff4444 (red) · #ffaa00 (amber) · #6366f1 (indigo)
```

---

## Repository Structure

```
argus/
├── contracts/          # Move smart contracts
│   ├── lending_pool/
│   ├── argus_policy/
│   ├── dao_policy/
│   └── action_log/
├── agent/              # Cloudflare Worker
│   └── src/
│       ├── index.ts    # Cron entry point
│       ├── risk.ts     # 5-factor scoring engine
│       └── dispatch.ts # On-chain action dispatcher
├── frontend/           # React + Vite + Three.js
│   └── src/
├── scripts/            # Deployment & test scripts
└── .env.example        # Environment variable template
```

---

## How to Run Locally

**Prerequisites**
- Node.js 18+
- Sui CLI
- Rust (for Move compilation)

**Frontend**
```bash
cd frontend
npm install
npm run dev
# Opens at http://localhost:5173
```

**Contracts (build only)**
```bash
cd contracts
sui move build
```

**Agent (local)**
```bash
cd agent
wrangler dev
```

---

## Demo Flow

1. Visit [argus-guardian.pages.dev](https://argus-guardian.pages.dev)
2. Connect Slush wallet on Sui Testnet
3. Watch the live risk score update every 60 seconds
4. View the action log to see past autonomous decisions with full reasoning
5. DAO panel → simulate a multisig override of the last action

---

## How Autonomous Action Works

```
Agent wakes (every 60s)
  │
  ├── Fetches SUI/USD + BTC/USD from Pyth
  │
  ├── Computes 5-factor score:
  │   price_velocity   × 0.35
  │   volatility       × 0.25
  │   correlation      × 0.20
  │   oracle_conf      × 0.10
  │   pool_util        × 0.10
  │   ──────────────────────────
  │   composite score  = 0–100
  │
  ├── Reads thresholds from Walrus blob
  │
  ├── Score ≥ threshold?
  │   YES → build PTB, call guardian function on lending_pool
  │         log full breakdown to action_log
  │   NO  → sleep until next cycle
  │
  └── DAO can override at any time via dao_policy multisig
```

---

## On-Chain Proof

| Action | Transaction |
|--------|------------|
| Package Deploy | `2gLR7HiAM4WTR4hfYH9FPiHXds3qxQHVkkKyPxUCZ67w` |
| Walrus Model Update | `ARwJVtWjjRFJprswYutpLXbhUrqanqKytEJX1ewp3WRC` |
| LTV Adjust Demo | `JA1ccbveUkbwKbhoimkGuc5mgd8PKcYn9RiHLwSNUtCz` |
| Pool Borrow | `EDdhDZCZyTdAQFFSdoGGmyovQcdqoMWwAQyrEay8Z8uA` |

---

## Roadmap

- [ ] Mainnet deployment
- [ ] Multi-asset support (BTC, ETH collateral pools)
- [ ] ML-based risk model with on-chain verifiable inference
- [ ] Cross-protocol risk correlation (monitor multiple pools simultaneously)
- [ ] Mobile alerts dashboard
- [ ] DAO governance for model weight updates

---

## Team

Karthik Thalari — @karthik26-Thalari

Chinmayi R — @ChinmayiR4

Maddineni Renu Sri — @RenuSri2

Tanmayee — @Tanmayee1802

VIT-AP University · Submission for Sui Overflow 2026

---

## License

This project is licensed under the MIT License — see the LICENSE file for details.
