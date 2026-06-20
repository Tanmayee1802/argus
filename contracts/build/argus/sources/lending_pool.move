module argus::lending_pool {
    use sui::object::{Self, UID, ID};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use sui::clock::{Self, Clock};
    use sui::event;

    // ── Errors ────────────────────────────────────────────────
    const E_NOT_ARGUS:      u64 = 0;
    const E_WRONG_CAP:      u64 = 1;
    const E_INVALID_LTV:    u64 = 2;
    const E_COOLDOWN_ACTIVE: u64 = 3;

    // 5 minutes in ms
    const COOLDOWN_MS: u64 = 300_000;

    // ── Admin Cap (wrapped inside DaoPolicy) ──────────────────
    public struct LendingPoolAdminCap has key, store {
        id: UID,
        pool_id: ID,
    }

    // ── Main pool object ──────────────────────────────────────
    public struct LendingPool has key {
        id: UID,
        asset_name: vector<u8>,
        total_deposited: u64,
        total_borrowed: u64,
        max_ltv_bps: u64,
        borrow_cap: u64,
        borrows_paused: bool,
        fully_paused: bool,
        argus_address: address,
        last_action_at: u64,
    }

    // ── Events ────────────────────────────────────────────────
    public struct LtvAdjustedEvent has copy, drop {
        pool_id: ID, prev_ltv: u64, new_ltv: u64, ts: u64,
    }
    public struct CapTightenedEvent has copy, drop {
        pool_id: ID, prev_cap: u64, new_cap: u64, ts: u64,
    }
    public struct BorrowsPausedEvent has copy, drop {
        pool_id: ID, ts: u64,
    }
    public struct EmergencyPauseEvent has copy, drop {
        pool_id: ID, ts: u64,
    }
    public struct OverrideRestoredEvent has copy, drop {
        pool_id: ID, action: u8, new_value: u64, ts: u64,
    }

    // ── Create ────────────────────────────────────────────────
    public entry fun create(
        asset_name: vector<u8>,
        total_deposited: u64,
        max_ltv_bps: u64,
        borrow_cap: u64,
        argus_address: address,
        ctx: &mut TxContext,
    ) {
        let pool_uid = object::new(ctx);
        let pool_id  = object::uid_to_inner(&pool_uid);

        let cap = LendingPoolAdminCap {
            id: object::new(ctx),
            pool_id,
        };

        transfer::share_object(LendingPool {
            id: pool_uid,
            asset_name,
            total_deposited,
            total_borrowed: 0,
            max_ltv_bps,
            borrow_cap,
            borrows_paused: false,
            fully_paused: false,
            argus_address,
            last_action_at: 0,
        });

        // Cap goes to deployer — pass it to dao_policy::create()
        transfer::transfer(cap, tx_context::sender(ctx));
    }

    // ── Internal helpers ──────────────────────────────────────
    fun assert_argus(pool: &LendingPool, ctx: &TxContext) {
        assert!(tx_context::sender(ctx) == pool.argus_address, E_NOT_ARGUS);
    }

    fun check_cooldown(pool: &LendingPool, now_ms: u64) {
        assert!(
            pool.last_action_at == 0 ||
            now_ms >= pool.last_action_at + COOLDOWN_MS,
            E_COOLDOWN_ACTIVE
        );
    }

    fun assert_cap(pool: &LendingPool, cap: &LendingPoolAdminCap) {
        assert!(cap.pool_id == object::id(pool), E_WRONG_CAP);
    }

    // ── Argus-only guardian functions ─────────────────────────
    public fun adjust_ltv(
        pool: &mut LendingPool,
        new_ltv_bps: u64,
        clock: &Clock,
        ctx: &TxContext,
    ) {
        assert_argus(pool, ctx);
        assert!(new_ltv_bps <= 10_000, E_INVALID_LTV);
        let now = clock::timestamp_ms(clock);
        check_cooldown(pool, now);
        let prev = pool.max_ltv_bps;
        pool.max_ltv_bps = new_ltv_bps;
        pool.last_action_at = now;
        event::emit(LtvAdjustedEvent {
            pool_id: object::id(pool), prev_ltv: prev, new_ltv: new_ltv_bps, ts: now,
        });
    }

    public fun tighten_borrow_cap(
        pool: &mut LendingPool,
        new_cap: u64,
        clock: &Clock,
        ctx: &TxContext,
    ) {
        assert_argus(pool, ctx);
        let now = clock::timestamp_ms(clock);
        let prev = pool.borrow_cap;
        pool.borrow_cap = new_cap;
        pool.last_action_at = now;
        event::emit(CapTightenedEvent {
            pool_id: object::id(pool), prev_cap: prev, new_cap, ts: now,
        });
    }

    public fun pause_new_borrows(
        pool: &mut LendingPool,
        clock: &Clock,
        ctx: &TxContext,
    ) {
        assert_argus(pool, ctx);
        let now = clock::timestamp_ms(clock);
        check_cooldown(pool, now);
        pool.borrows_paused = true;
        pool.last_action_at = now;
        event::emit(BorrowsPausedEvent {
            pool_id: object::id(pool), ts: now,
        });
    }

    public fun emergency_pause_all(
        pool: &mut LendingPool,
        clock: &Clock,
        ctx: &TxContext,
    ) {
        assert_argus(pool, ctx);
        let now = clock::timestamp_ms(clock);
        pool.borrows_paused = true;
        pool.fully_paused = true;
        pool.last_action_at = now;
        event::emit(EmergencyPauseEvent {
            pool_id: object::id(pool), ts: now,
        });
    }

    // ── DAO override functions (need LendingPoolAdminCap) ─────
    public fun override_restore_ltv(
        pool: &mut LendingPool,
        ltv_bps: u64,
        cap: &LendingPoolAdminCap,
        clock: &Clock,
    ) {
        assert_cap(pool, cap);
        assert!(ltv_bps <= 10_000, E_INVALID_LTV);
        pool.max_ltv_bps = ltv_bps;
        event::emit(OverrideRestoredEvent {
            pool_id: object::id(pool), action: 0, new_value: ltv_bps,
            ts: clock::timestamp_ms(clock),
        });
    }

    public fun override_unpause(
        pool: &mut LendingPool,
        cap: &LendingPoolAdminCap,
        clock: &Clock,
    ) {
        assert_cap(pool, cap);
        pool.borrows_paused = false;
        pool.fully_paused = false;
        event::emit(OverrideRestoredEvent {
            pool_id: object::id(pool), action: 1, new_value: 0,
            ts: clock::timestamp_ms(clock),
        });
    }

    public fun override_restore_cap(
        pool: &mut LendingPool,
        cap_value: u64,
        cap: &LendingPoolAdminCap,
        clock: &Clock,
    ) {
        assert_cap(pool, cap);
        pool.borrow_cap = cap_value;
        event::emit(OverrideRestoredEvent {
            pool_id: object::id(pool), action: 2, new_value: cap_value,
            ts: clock::timestamp_ms(clock),
        });
    }

    // ── Demo deposit / borrow stubs ───────────────────────────
    public entry fun deposit(
        pool: &mut LendingPool,
        amount: u64,
        _ctx: &TxContext,
    ) {
        pool.total_deposited = pool.total_deposited + amount;
    }

    public entry fun borrow(
        pool: &mut LendingPool,
        amount: u64,
        _ctx: &TxContext,
    ) {
        assert!(!pool.borrows_paused && !pool.fully_paused, E_NOT_ARGUS);
        assert!(pool.total_borrowed + amount <= pool.borrow_cap, E_INVALID_LTV);
        pool.total_borrowed = pool.total_borrowed + amount;
    }

    // ── Views ─────────────────────────────────────────────────
    public fun max_ltv_bps(p: &LendingPool): u64     { p.max_ltv_bps }
    public fun borrow_cap(p: &LendingPool): u64      { p.borrow_cap }
    public fun total_deposited(p: &LendingPool): u64 { p.total_deposited }
    public fun total_borrowed(p: &LendingPool): u64  { p.total_borrowed }
    public fun borrows_paused(p: &LendingPool): bool { p.borrows_paused }
    public fun fully_paused(p: &LendingPool): bool   { p.fully_paused }
    public fun last_action_at(p: &LendingPool): u64  { p.last_action_at }
    public fun argus_address(p: &LendingPool): address { p.argus_address }
}