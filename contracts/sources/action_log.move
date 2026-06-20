module argus::action_log {
    use sui::object::{Self, UID, ID};
    use sui::table::{Self, Table};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use sui::clock::{Self, Clock};
    use sui::event;

    // ── Errors ────────────────────────────────────────────────
    const E_NOT_AUTHORIZED: u64 = 0;

    // ── Structs ───────────────────────────────────────────────
    public struct ActionLog has key {
        id: UID,
        entries: Table<u64, ActionEntry>,
        count: u64,
        argus_address: address,
    }

    public struct ActionEntry has store, drop {
        alert_level: u8,
        action_type: u8,
        final_score: u64,
        score_price_velocity: u64,
        score_vol_regime: u64,
        score_correlation: u64,
        score_oracle_conf: u64,
        score_utilization: u64,
        sui_price_usd: u64,
        btc_price_usd: u64,
        sui_price_change_15m_abs: u64,
        sui_price_change_15m_neg: bool,
        btc_price_change_15m_abs: u64,
        btc_price_change_15m_neg: bool,
        pool_utilization_bps: u64,
        oracle_confidence_bps: u64,
        prev_ltv_bps: u64,
        new_ltv_bps: u64,
        prev_cap: u64,
        new_cap: u64,
        walrus_model_blob_id: vector<u8>,
        was_overridden: bool,
        override_at: u64,
        timestamp_ms: u64,
    }

    public struct ActionRecordedEvent has copy, drop {
        log_id: ID,
        entry_index: u64,
        alert_level: u8,
        final_score: u64,
        timestamp_ms: u64,
    }

    // ── Create shared ActionLog ───────────────────────────────
    public entry fun create(argus_address: address, ctx: &mut TxContext) {
        transfer::share_object(ActionLog {
            id: object::new(ctx),
            entries: table::new(ctx),
            count: 0,
            argus_address,
        });
    }

    // ── Build entry ───────────────────────────────────────────
    public fun new_entry(
        alert_level: u8,
        action_type: u8,
        final_score: u64,
        score_price_velocity: u64,
        score_vol_regime: u64,
        score_correlation: u64,
        score_oracle_conf: u64,
        score_utilization: u64,
        sui_price_usd: u64,
        btc_price_usd: u64,
        sui_price_change_15m_abs: u64,
        sui_price_change_15m_neg: bool,
        btc_price_change_15m_abs: u64,
        btc_price_change_15m_neg: bool,
        pool_utilization_bps: u64,
        oracle_confidence_bps: u64,
        prev_ltv_bps: u64,
        new_ltv_bps: u64,
        prev_cap: u64,
        new_cap: u64,
        walrus_model_blob_id: vector<u8>,
        timestamp_ms: u64,
    ): ActionEntry {
        ActionEntry {
            alert_level, action_type, final_score,
            score_price_velocity, score_vol_regime, score_correlation,
            score_oracle_conf, score_utilization,
            sui_price_usd, btc_price_usd,
            sui_price_change_15m_abs, sui_price_change_15m_neg,
            btc_price_change_15m_abs, btc_price_change_15m_neg,
            pool_utilization_bps, oracle_confidence_bps,
            prev_ltv_bps, new_ltv_bps, prev_cap, new_cap,
            walrus_model_blob_id,
            was_overridden: false,
            override_at: 0,
            timestamp_ms,
        }
    }

    // ── Record — Argus-only ───────────────────────────────────
    public fun record(
        log: &mut ActionLog,
        entry: ActionEntry,
        _clock: &Clock,
        ctx: &TxContext,
    ) {
        assert!(tx_context::sender(ctx) == log.argus_address, E_NOT_AUTHORIZED);
        let idx = log.count;
        event::emit(ActionRecordedEvent {
            log_id: object::id(log),
            entry_index: idx,
            alert_level: entry.alert_level,
            final_score: entry.final_score,
            timestamp_ms: entry.timestamp_ms,
        });
        table::add(&mut log.entries, idx, entry);
        log.count = log.count + 1;
    }

    // ── Mark overridden ───────────────────────────────────────
    public fun mark_overridden(
        log: &mut ActionLog,
        index: u64,
        override_at: u64,
    ) {
        let entry = table::borrow_mut(&mut log.entries, index);
        entry.was_overridden = true;
        entry.override_at = override_at;
    }

    // ── Views ─────────────────────────────────────────────────
    public fun count(log: &ActionLog): u64          { log.count }
    public fun argus_address(log: &ActionLog): address { log.argus_address }
}