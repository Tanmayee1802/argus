module argus::dao_policy {
    use sui::object::{Self, UID, ID};
    use sui::table::{Self, Table};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use sui::clock::{Self, Clock};
    use sui::event;
    use std::vector;
    use argus::lending_pool::{Self, LendingPool, LendingPoolAdminCap};

    // ── Errors ────────────────────────────────────────────────
    const E_NOT_GUARDIAN:         u64 = 0;
    const E_ALREADY_SIGNED:       u64 = 1;
    const E_ALREADY_EXECUTED:     u64 = 2;
    const E_INVALID_OVERRIDE_TYPE: u64 = 3;

    // ── Structs ───────────────────────────────────────────────
    public struct PendingOverride has store {
        action_log_entry_idx: u64,
        proposer: address,
        signers: vector<address>,
        created_at: u64,
        override_type: u8,     // 0=restore_ltv  1=unpause  2=restore_cap
        override_value: u64,
        executed: bool,
    }

    public struct DaoPolicy has key {
        id: UID,
        guardians: vector<address>,
        required_signatures: u64,
        pending_overrides: Table<u64, PendingOverride>,
        override_count: u64,
        pool_admin_cap: LendingPoolAdminCap,
    }

    // ── Events ────────────────────────────────────────────────
    public struct OverrideProposedEvent has copy, drop {
        override_index: u64,
        proposer: address,
        override_type: u8,
        action_log_entry_idx: u64,
        ts: u64,
    }

    public struct OverrideCoSignedEvent has copy, drop {
        override_index: u64,
        signer: address,
        signatures_so_far: u64,
        required: u64,
        ts: u64,
    }

    public struct OverrideExecutedEvent has copy, drop {
        override_index: u64,
        override_type: u8,
        executor: address,
        ts: u64,
    }

    // ── Create shared DaoPolicy ───────────────────────────────
    // Takes the LendingPoolAdminCap from lending_pool::create()
    // and wraps it — only DaoPolicy can call pool overrides from now on
    public entry fun create(
        cap: LendingPoolAdminCap,
        guardian_1: address,
        guardian_2: address,
        guardian_3: address,
        ctx: &mut TxContext,
    ) {
        transfer::share_object(DaoPolicy {
            id: object::new(ctx),
            guardians: vector[guardian_1, guardian_2, guardian_3],
            required_signatures: 2,
            pending_overrides: table::new(ctx),
            override_count: 0,
            pool_admin_cap: cap,
        });
    }

    // ── Guardian helpers ──────────────────────────────────────
    public fun is_guardian(policy: &DaoPolicy, addr: address): bool {
        vector::contains(&policy.guardians, &addr)
    }

    public fun assert_guardian(policy: &DaoPolicy, ctx: &TxContext) {
        assert!(
            is_guardian(policy, tx_context::sender(ctx)),
            E_NOT_GUARDIAN
        );
    }

    // ── Step 1: Propose override ──────────────────────────────
    public entry fun propose_override(
        policy: &mut DaoPolicy,
        action_log_entry_idx: u64,
        override_type: u8,
        override_value: u64,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert_guardian(policy, ctx);
        assert!(override_type <= 2, E_INVALID_OVERRIDE_TYPE);

        let proposer = tx_context::sender(ctx);
        let now      = clock::timestamp_ms(clock);
        let idx      = policy.override_count;

        table::add(&mut policy.pending_overrides, idx, PendingOverride {
            action_log_entry_idx,
            proposer,
            signers: vector[proposer],
            created_at: now,
            override_type,
            override_value,
            executed: false,
        });

        policy.override_count = policy.override_count + 1;

        event::emit(OverrideProposedEvent {
            override_index: idx,
            proposer,
            override_type,
            action_log_entry_idx,
            ts: now,
        });
    }

    // ── Step 2: Co-sign — executes if threshold met ───────────
    public entry fun cosign_and_execute(
        policy: &mut DaoPolicy,
        pool: &mut LendingPool,
        override_index: u64,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert_guardian(policy, ctx);

        let sender = tx_context::sender(ctx);
        let now    = clock::timestamp_ms(clock);

        // Must not be already executed
        assert!(
            !table::borrow(&policy.pending_overrides, override_index).executed,
            E_ALREADY_EXECUTED
        );

        // Must not have already signed
        assert!(
            !vector::contains(
                &table::borrow(&policy.pending_overrides, override_index).signers,
                &sender
            ),
            E_ALREADY_SIGNED
        );

        // Add signer
        {
            let entry = table::borrow_mut(&mut policy.pending_overrides, override_index);
            vector::push_back(&mut entry.signers, sender);
        };

        // Read values needed for execution
        let override_type  = table::borrow(&policy.pending_overrides, override_index).override_type;
        let override_value = table::borrow(&policy.pending_overrides, override_index).override_value;
        let signer_count   = vector::length(
            &table::borrow(&policy.pending_overrides, override_index).signers
        );

        if (signer_count >= policy.required_signatures) {
            // Execute via wrapped cap
            if (override_type == 0) {
                lending_pool::override_restore_ltv(
                    pool, override_value, &policy.pool_admin_cap, clock
                );
            } else if (override_type == 1) {
                lending_pool::override_unpause(
                    pool, &policy.pool_admin_cap, clock
                );
            } else if (override_type == 2) {
                lending_pool::override_restore_cap(
                    pool, override_value, &policy.pool_admin_cap, clock
                );
            };

            table::borrow_mut(
                &mut policy.pending_overrides, override_index
            ).executed = true;

            event::emit(OverrideExecutedEvent {
                override_index,
                override_type,
                executor: sender,
                ts: now,
            });
        } else {
            event::emit(OverrideCoSignedEvent {
                override_index,
                signer: sender,
                signatures_so_far: signer_count,
                required: policy.required_signatures,
                ts: now,
            });
        };
    }

    // ── Views ─────────────────────────────────────────────────
    public fun guardians(p: &DaoPolicy): &vector<address> { &p.guardians }
    public fun override_count(p: &DaoPolicy): u64         { p.override_count }
    public fun required_signatures(p: &DaoPolicy): u64    { p.required_signatures }
}