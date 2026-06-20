module argus::argus_policy {
    use sui::object::{Self, UID, ID};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use sui::clock::{Self, Clock};
    use sui::event;
    use argus::dao_policy::{Self, DaoPolicy};

    // ── Errors ────────────────────────────────────────────────
    const E_NOT_AGENT: u64 = 0;

    // ── Structs ───────────────────────────────────────────────
    public struct ArgusPolicy has key {
        id: UID,
        agent_address: address,
        walrus_model_blob_id: vector<u8>,
        seal_policy_id: ID,
        created_at: u64,
        evaluation_count: u64,
        action_count: u64,
    }

    // ── Events ────────────────────────────────────────────────
    public struct ModelUpdatedEvent has copy, drop {
        policy_id: ID,
        new_blob_id: vector<u8>,
        updater: address,
        ts: u64,
    }

    public struct EvaluationTickEvent has copy, drop {
        policy_id: ID,
        evaluation_count: u64,
        ts: u64,
    }

    // ── Create shared ArgusPolicy ─────────────────────────────
    public entry fun create(
        agent_address: address,
        walrus_model_blob_id: vector<u8>,
        seal_policy_id: ID,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        transfer::share_object(ArgusPolicy {
            id: object::new(ctx),
            agent_address,
            walrus_model_blob_id,
            seal_policy_id,
            created_at: clock::timestamp_ms(clock),
            evaluation_count: 0,
            action_count: 0,
        });
    }

    // ── DAO guardian: update Walrus model blob ────────────────
    // DAO uploads new encrypted config to Walrus, then calls
    // this to point ArgusPolicy at the new blob. Zero redeployment.
    public entry fun update_model_blob(
        policy: &mut ArgusPolicy,
        new_blob_id: vector<u8>,
        dao_policy: &DaoPolicy,
        clock: &Clock,
        ctx: &TxContext,
    ) {
        dao_policy::assert_guardian(dao_policy, ctx);
        policy.walrus_model_blob_id = new_blob_id;
        event::emit(ModelUpdatedEvent {
            policy_id: object::id(policy),
            new_blob_id: policy.walrus_model_blob_id,
            updater: tx_context::sender(ctx),
            ts: clock::timestamp_ms(clock),
        });
    }

    // ── Agent only: tick evaluation counter ───────────────────
    public fun tick_evaluation(
        policy: &mut ArgusPolicy,
        clock: &Clock,
        ctx: &TxContext,
    ) {
        assert!(tx_context::sender(ctx) == policy.agent_address, E_NOT_AGENT);
        policy.evaluation_count = policy.evaluation_count + 1;
        event::emit(EvaluationTickEvent {
            policy_id: object::id(policy),
            evaluation_count: policy.evaluation_count,
            ts: clock::timestamp_ms(clock),
        });
    }

    // ── Agent only: tick action counter ──────────────────────
    public fun tick_action(
        policy: &mut ArgusPolicy,
        ctx: &TxContext,
    ) {
        assert!(tx_context::sender(ctx) == policy.agent_address, E_NOT_AGENT);
        policy.action_count = policy.action_count + 1;
    }

    // ── Views ─────────────────────────────────────────────────
    public fun walrus_model_blob_id(p: &ArgusPolicy): &vector<u8> { &p.walrus_model_blob_id }
    public fun evaluation_count(p: &ArgusPolicy): u64             { p.evaluation_count }
    public fun action_count(p: &ArgusPolicy): u64                 { p.action_count }
    public fun agent_address(p: &ArgusPolicy): address            { p.agent_address }
}