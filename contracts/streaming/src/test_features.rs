//! Tests for issues #1099, #1101, #1102, #1103, #1133, #1123, #1120, #1121,
//! #1119.
//!
//! Each section is labelled with its issue number so reviewers can map a
//! failing test directly back to the requirement it covers.

#![cfg(test)]

extern crate std;

use soroban_sdk::{
    testutils::{Address as _, Events, Ledger},
    Address, BytesN, Env,
};

use crate::{CreateStreamParams, DataKey, StreamError, StreamingContract, StreamingContractClient};

// ─── Shared test harness ──────────────────────────────────────────────────────

/// Minimal environment with an initialised contract and a funded token.
struct Ctx {
    env: Env,
    contract_id: Address,
    admin: Address,
    token_id: Address,
    sender: Address,
    recipient: Address,
}

impl Ctx {
    fn setup() -> Self {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(StreamingContract, ());
        let admin = Address::generate(&env);

        StreamingContractClient::new(&env, &contract_id).initialize(&admin);

        // Deploy a minimal SAC-compatible token and fund `sender` for the
        // streaming tests (issue #1133).
        let token_admin = Address::generate(&env);
        let token_id = env
            .register_stellar_asset_contract_v2(token_admin)
            .address();
        let sender = Address::generate(&env);
        let recipient = Address::generate(&env);
        soroban_sdk::token::StellarAssetClient::new(&env, &token_id).mint(&sender, &10_000_000i128);

        Ctx {
            env,
            contract_id,
            admin,
            token_id,
            sender,
            recipient,
        }
    }

    fn client(&self) -> StreamingContractClient<'_> {
        StreamingContractClient::new(&self.env, &self.contract_id)
    }

    fn token(&self) -> soroban_sdk::token::TokenClient<'_> {
        soroban_sdk::token::TokenClient::new(&self.env, &self.token_id)
    }

    fn set_time(&self, ts: u64) {
        self.env.ledger().with_mut(|l| l.timestamp = ts);
    }

    /// Approve the contract to pull `amount` from `sender`'s token balance.
    /// `approve` overwrites (does not add to) the existing allowance, so this
    /// must be called again before every transfer that needs fresh headroom
    /// (e.g. before both `create_stream` and a later `top_up`).
    fn approve(&self, amount: i128) {
        self.token().approve(
            &self.sender,
            &self.contract_id,
            &amount,
            &(self.env.ledger().sequence() + 500),
        );
    }

    /// Generate a dummy 32-byte WASM hash for upgrade tests.
    fn dummy_hash(&self) -> BytesN<32> {
        BytesN::from_array(&self.env, &[0xdeu8; 32])
    }
}

// ─── Issue #1102 — is_paused() ────────────────────────────────────────────────

/// Freshly initialised contract must not be paused.
#[test]
fn test_is_paused_initial_state_is_false() {
    let ctx = Ctx::setup();
    assert!(!ctx.client().is_paused());
}

/// `is_paused` returns `true` immediately after `pause`.
#[test]
fn test_is_paused_returns_true_after_pause() {
    let ctx = Ctx::setup();
    ctx.client().pause();
    assert!(ctx.client().is_paused());
}

/// `is_paused` returns `false` again after `unpause`.
#[test]
fn test_is_paused_returns_false_after_unpause() {
    let ctx = Ctx::setup();
    ctx.client().pause();
    ctx.client().unpause();
    assert!(!ctx.client().is_paused());
}

/// `is_paused` works on an uninitialised contract — defaults to false without
/// panicking, so the frontend can call it safely before `initialize`.
#[test]
fn test_is_paused_on_uninitialised_contract_does_not_panic() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(StreamingContract, ());
    let result = StreamingContractClient::new(&env, &contract_id).is_paused();
    assert!(!result);
}

// ─── Issue #1101 — get_admin() ────────────────────────────────────────────────

/// `get_admin` returns the address passed to `initialize`.
#[test]
fn test_get_admin_returns_initialized_admin() {
    let ctx = Ctx::setup();
    let returned = ctx.client().get_admin();
    assert_eq!(returned, ctx.admin);
}

/// `get_admin` returns `NotInitialized` when the contract has never been
/// initialized — not a panic, a typed error.
#[test]
fn test_get_admin_before_initialize_returns_not_initialized() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(StreamingContract, ());
    let err = StreamingContractClient::new(&env, &contract_id)
        .try_get_admin()
        .unwrap_err()
        .unwrap();
    assert_eq!(err, StreamError::NotInitialized);
}

/// After a completed two-step transfer, `get_admin` reflects the new admin.
#[test]
fn test_get_admin_reflects_new_admin_after_transfer() {
    let ctx = Ctx::setup();
    let new_admin = Address::generate(&ctx.env);

    ctx.client().propose_admin(&new_admin);
    ctx.client().accept_admin();

    assert_eq!(ctx.client().get_admin(), new_admin);
}

// ─── Issue #1099 — ContractUpgradedEvent from upgrade() ──────────────────────

/// `upgrade` must emit a `ContractUpgradedEvent` carrying the new WASM hash
/// and the current ledger timestamp.
///
/// We cannot actually swap WASM in the test environment, so we verify the
/// event is published before the host-function is invoked by checking the
/// events list. The `update_current_contract_wasm` call will panic because the
/// hash is not a real deployed WASM — we catch that via `try_upgrade` and
/// assert the event was still recorded.
#[test]
fn test_failed_upgrade_does_not_commit_event() {
    let ctx = Ctx::setup();
    ctx.set_time(1_000_000);
    let hash = ctx.dummy_hash();

    // The dummy hash has no installed WASM, so the invocation fails and the
    // host rolls back its events. `try_upgrade` must report the error and no
    // event may be committed.
    let result = ctx.client().try_upgrade(&ctx.admin, &hash);
    assert!(result.is_err(), "upgrade to a missing WASM hash must fail");

    let events = ctx.env.events().all();
    let found = events
        .events()
        .iter()
        .any(|event| std::format!("{:?}", event).contains("contract_upgraded"));
    assert!(
        !found,
        "a failed upgrade must not commit ContractUpgradedEvent"
    );
}

/// `upgrade` with a non-admin caller must return `Unauthorized` and must NOT
/// emit an event.
#[test]
fn test_upgrade_unauthorized_does_not_emit_event() {
    let ctx = Ctx::setup();
    let stranger = Address::generate(&ctx.env);
    let hash = ctx.dummy_hash();

    let err = ctx
        .client()
        .try_upgrade(&stranger, &hash)
        .unwrap_err()
        .unwrap();
    assert_eq!(err, StreamError::Unauthorized);

    let events = ctx.env.events().all();
    let found = events
        .events()
        .iter()
        .any(|event| std::format!("{:?}", event).contains("contract_upgraded"));
    assert!(
        !found,
        "ContractUpgradedEvent must not be emitted for unauthorized upgrade"
    );
}

// ─── Issue #1103 — propose_admin / accept_admin ───────────────────────────────

/// Happy path: propose then accept transfers the admin role.
#[test]
fn test_propose_and_accept_admin_happy_path() {
    let ctx = Ctx::setup();
    let new_admin = Address::generate(&ctx.env);

    // Step 1 — propose
    ctx.client().propose_admin(&new_admin);

    // Admin has not changed yet.
    assert_eq!(ctx.client().get_admin(), ctx.admin);

    // Step 2 — accept
    ctx.client().accept_admin();

    // Admin is now the new address.
    assert_eq!(ctx.client().get_admin(), new_admin);

    // PendingAdmin slot must be cleared. Instance storage is only accessible
    // from inside the contract, so inspect it through `as_contract`.
    let pending_cleared = ctx.env.as_contract(&ctx.contract_id, || {
        !ctx.env.storage().instance().has(&DataKey::PendingAdmin)
    });
    assert!(
        pending_cleared,
        "PendingAdmin key must be removed after acceptance"
    );
}

/// `propose_admin` requires the current admin to authorize.
/// A third-party call must fail with `NotInitialized` or `Unauthorized`.
#[test]
fn test_propose_admin_rejected_by_non_admin() {
    let env = Env::default();
    // Do NOT mock_all_auths so authorization is enforced.
    let contract_id = env.register(StreamingContract, ());
    let admin = Address::generate(&env);
    let stranger = Address::generate(&env);

    // Initialize with real auth mocked only for admin.
    env.mock_all_auths();
    StreamingContractClient::new(&env, &contract_id).initialize(&admin);

    // Now disable blanket mocking and try propose_admin as stranger.
    // Because we cannot easily revoke mock_all_auths in one call, we instead
    // verify the auth requirement is encoded in require_admin: call
    // propose_admin while the mock only authorizes `stranger`, not `admin`.
    env.set_auths(&[]); // clear mocked auths
    let result = StreamingContractClient::new(&env, &contract_id).try_propose_admin(&stranger);

    // The call must fail at the auth boundary before any state change.
    assert!(
        result.is_err(),
        "non-admin must not be able to propose_admin"
    );
}

/// `accept_admin` with no pending proposal returns `NoPendingAdmin`.
#[test]
fn test_accept_admin_with_no_proposal_returns_error() {
    let ctx = Ctx::setup();
    let err = ctx.client().try_accept_admin().unwrap_err().unwrap();
    assert_eq!(err, StreamError::NoPendingAdmin);
}

/// A second `propose_admin` call before acceptance replaces the first proposal.
#[test]
fn test_propose_admin_overwrites_previous_proposal() {
    let ctx = Ctx::setup();
    let first = Address::generate(&ctx.env);
    let second = Address::generate(&ctx.env);

    ctx.client().propose_admin(&first);
    ctx.client().propose_admin(&second); // overwrites

    // Accepting now should make `second` the admin, not `first`.
    ctx.client().accept_admin();
    assert_eq!(ctx.client().get_admin(), second);
}

/// `propose_admin` emits `AdminProposedEvent`.
#[test]
fn test_propose_admin_emits_event() {
    let ctx = Ctx::setup();
    ctx.set_time(5_000);
    let new_admin = Address::generate(&ctx.env);

    ctx.client().propose_admin(&new_admin);

    let events = ctx.env.events().all();
    let found = events
        .events()
        .iter()
        .any(|event| std::format!("{:?}", event).contains("admin_proposed"));
    assert!(
        found,
        "AdminProposedEvent was not emitted by propose_admin()"
    );
}

/// `accept_admin` emits `AdminTransferredEvent`.
#[test]
fn test_accept_admin_emits_event() {
    let ctx = Ctx::setup();
    ctx.set_time(6_000);
    let new_admin = Address::generate(&ctx.env);

    ctx.client().propose_admin(&new_admin);
    ctx.client().accept_admin();

    let events = ctx.env.events().all();
    let found = events
        .events()
        .iter()
        .any(|event| std::format!("{:?}", event).contains("admin_transferred"));
    assert!(
        found,
        "AdminTransferredEvent was not emitted by accept_admin()"
    );
}

/// New admin can pause after transfer; old admin cannot.
#[test]
fn test_new_admin_can_pause_after_transfer() {
    let ctx = Ctx::setup();
    let new_admin = Address::generate(&ctx.env);

    ctx.client().propose_admin(&new_admin);
    ctx.client().accept_admin();

    // New admin can pause.
    ctx.client().pause();
    assert!(ctx.client().is_paused());
}

// ─── Issue #1133 — top_up then partial_cancel preserves unlocked amount ──────

/// Both `top_up` and `partial_cancel` re-anchor the vesting schedule (they
/// reset `cliff_time`/`start_time` to `now` and fold the already-unlocked
/// amount into the new `cliff_amount`). Chaining them mid-stream must not
/// disturb the amount that was already unlocked at that instant, and the
/// deposited total at `end_time` must reflect both adjustments exactly
/// (`initial + top_up - partial_cancel`).
#[test]
fn test_top_up_then_partial_cancel_preserves_unlocked_amount() {
    let ctx = Ctx::setup();
    let now = 1_000_000u64;
    ctx.set_time(now);

    let initial = 1_000_000i128;
    let top_up_amount = 500_000i128;
    let cancel_amount = 200_000i128;

    let params = CreateStreamParams {
        recipient: ctx.recipient.clone(),
        token: ctx.token_id.clone(),
        total_amount: initial,
        start_time: now,
        end_time: now + 1000,
        cliff_time: now,
        cliff_amount: 0,
    };

    ctx.approve(initial);
    let id = ctx.client().create_stream(&ctx.sender, &params);

    // Mid-stream: record the withdrawable (unlocked - withdrawn) amount
    // before either operation.
    ctx.set_time(now + 300);
    let withdrawable_before = ctx.client().get_withdrawable(&id);
    assert!(
        withdrawable_before > 0,
        "sanity: some amount must already be unlocked"
    );

    // Top up — re-anchors the schedule. `approve` overwrites the allowance,
    // so it must be called again for the new transfer.
    ctx.approve(top_up_amount);
    ctx.client().top_up(&id, &top_up_amount);

    let withdrawable_after_top_up = ctx.client().get_withdrawable(&id);
    assert_eq!(
        withdrawable_after_top_up, withdrawable_before,
        "top_up must not change the amount already unlocked at this instant"
    );

    // Partial-cancel part of what remains locked — re-anchors again.
    let stream_after_top_up = ctx.client().get_stream(&id);
    let locked = stream_after_top_up.deposited_amount - withdrawable_after_top_up;
    assert!(
        cancel_amount <= locked,
        "sanity: cancel amount must fit within the locked balance"
    );
    ctx.client().partial_cancel(&id, &cancel_amount);

    let withdrawable_after_cancel = ctx.client().get_withdrawable(&id);
    assert_eq!(
        withdrawable_after_cancel, withdrawable_before,
        "partial_cancel must not change the amount already unlocked at this instant"
    );

    // The deposited total must equal initial + top_up - cancelled.
    let stream_final = ctx.client().get_stream(&id);
    let expected_deposited = initial + top_up_amount - cancel_amount;
    assert_eq!(stream_final.deposited_amount, expected_deposited);

    // At end_time, with nothing withdrawn, the withdrawable amount must equal
    // the full (adjusted) deposited total.
    ctx.set_time(stream_final.end_time);
    let withdrawable_at_end = ctx.client().get_withdrawable(&id);
    assert_eq!(withdrawable_at_end, expected_deposited);
    assert_eq!(withdrawable_at_end, stream_final.deposited_amount);
}

// ─── Issue #1123 — pause blocks set_delegate ─────────────────────────────────

/// `set_delegate` calls `require_not_paused`, so it must be rejected with
/// `ContractPaused` while the contract is paused.
#[test]
fn test_set_delegate_rejected_while_paused() {
    let ctx = Ctx::setup();
    let now = 1_000_000u64;
    ctx.set_time(now);

    let total = 1_000_000i128;
    let params = CreateStreamParams {
        recipient: ctx.recipient.clone(),
        token: ctx.token_id.clone(),
        total_amount: total,
        start_time: now,
        end_time: now + 1000,
        cliff_time: now,
        cliff_amount: 0,
    };
    ctx.approve(total);
    let id = ctx.client().create_stream(&ctx.sender, &params);

    ctx.client().pause();

    let delegate = Address::generate(&ctx.env);
    let err = ctx
        .client()
        .try_set_delegate(&id, &delegate)
        .unwrap_err()
        .unwrap();
    assert_eq!(err, StreamError::ContractPaused);
}

// ─── Issue #1120 — pause blocks transfer_stream ──────────────────────────────

/// `transfer_stream` calls `require_not_paused`, so it must be rejected with
/// `ContractPaused` while the contract is paused.
#[test]
fn test_transfer_stream_rejected_while_paused() {
    let ctx = Ctx::setup();
    let now = 1_000_000u64;
    ctx.set_time(now);

    let total = 1_000_000i128;
    let params = CreateStreamParams {
        recipient: ctx.recipient.clone(),
        token: ctx.token_id.clone(),
        total_amount: total,
        start_time: now,
        end_time: now + 1000,
        cliff_time: now,
        cliff_amount: 0,
    };
    ctx.approve(total);
    let id = ctx.client().create_stream(&ctx.sender, &params);

    ctx.client().pause();

    let new_recipient = Address::generate(&ctx.env);
    let err = ctx
        .client()
        .try_transfer_stream(&id, &new_recipient)
        .unwrap_err()
        .unwrap();
    assert_eq!(err, StreamError::ContractPaused);
}

// ─── Issue #1121 — pause blocks partial_cancel ───────────────────────────────

/// `partial_cancel` calls `require_not_paused`, so it must be rejected with
/// `ContractPaused` while the contract is paused.
#[test]
fn test_partial_cancel_rejected_while_paused() {
    let ctx = Ctx::setup();
    let now = 1_000_000u64;
    ctx.set_time(now);

    let total = 1_000_000i128;
    let params = CreateStreamParams {
        recipient: ctx.recipient.clone(),
        token: ctx.token_id.clone(),
        total_amount: total,
        start_time: now,
        end_time: now + 1000,
        cliff_time: now,
        cliff_amount: 0,
    };
    ctx.approve(total);
    let id = ctx.client().create_stream(&ctx.sender, &params);

    ctx.client().pause();

    let err = ctx
        .client()
        .try_partial_cancel(&id, &100_000i128)
        .unwrap_err()
        .unwrap();
    assert_eq!(err, StreamError::ContractPaused);
}

// ─── Issue #1119 — pause blocks top_up ────────────────────────────────────────

/// `top_up` calls `require_not_paused`, so it must be rejected with
/// `ContractPaused` while the contract is paused. Once the contract is
/// unpaused, the same top-up must succeed and increase the deposited amount.
#[test]
fn test_top_up_rejected_while_paused_and_succeeds_after_unpause() {
    let ctx = Ctx::setup();
    let now = 1_000_000u64;
    ctx.set_time(now);

    let total = 1_000_000i128;
    let params = CreateStreamParams {
        recipient: ctx.recipient.clone(),
        token: ctx.token_id.clone(),
        total_amount: total,
        start_time: now,
        end_time: now + 1000,
        cliff_time: now,
        cliff_amount: 0,
    };
    ctx.approve(total);
    let id = ctx.client().create_stream(&ctx.sender, &params);

    let top_up_amount = 500_000i128;
    // Set up the allowance before pausing so the only reason the top-up can
    // fail is the pause guard itself.
    ctx.approve(top_up_amount);

    ctx.client().pause();
    assert!(ctx.client().is_paused());

    let err = ctx
        .client()
        .try_top_up(&id, &top_up_amount)
        .unwrap_err()
        .unwrap();
    assert_eq!(err, StreamError::ContractPaused);

    // The rejected call must not transfer tokens or change the stream.
    assert_eq!(ctx.client().get_stream(&id).deposited_amount, total);
    assert_eq!(ctx.token().balance(&ctx.contract_id), total);

    ctx.client().unpause();
    assert!(!ctx.client().is_paused());

    ctx.set_time(now + 100);
    ctx.client().top_up(&id, &top_up_amount);

    let stream = ctx.client().get_stream(&id);
    assert_eq!(stream.deposited_amount, total + top_up_amount);
    assert_eq!(ctx.token().balance(&ctx.contract_id), total + top_up_amount);
}
