export const CONFIG = {
  PACKAGE_ID:      "0x1fb3180e24c981f523d89bb78c638c6be1019c7d619f19708f2bd23c8f99cf6f",
  POOL_ID:         "0xdd98e483bba7bcd2443c32294b8ad83fd9a3e7f18a9ab8c51450bda31b700a38",
  ACTION_LOG_ID:   "0x47a046473e3dc6b9d6ff8a427fd886df8be424b6decb5b733e2c33b211e330e2",
  ARGUS_POLICY_ID: "0x16e8d05eebc40372bb1ccee6c0b86fd667689ed31cec584a9cfaa156a9c902c7",
  DAO_POLICY_ID:   "0x02fe5bb520ad4374b8a63626be277f0a3d6930c8d98ab3effea853601914cdee",
  AGENT_API: "https://argus-agent.karthik260406t.workers.dev",
  NETWORK:         "testnet" as const,
  EXPLORER:        "https://suiexplorer.com/txblock",
}

export type AlertLevel = "green" | "yellow" | "orange" | "red" | "black"

export const ALERT_COLORS: Record<AlertLevel, string> = {
  green:  "#00ffc8",
  yellow: "#ffe600",
  orange: "#ff7300",
  red:    "#ff1f3c",
  black:  "#8b0000",
}

export const ALERT_LABELS: Record<AlertLevel, string> = {
  green:  "MONITORING",
  yellow: "LTV ADJUST",
  orange: "CAP TIGHTEN",
  red:    "BORROWS PAUSED",
  black:  "EMERGENCY PAUSE",
}
