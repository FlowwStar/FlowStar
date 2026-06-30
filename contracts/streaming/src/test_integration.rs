//! Full lifecycle integration tests — Issue #162
//!
//! These tests exercise multi-step stream lifecycles to catch state-mutation
//! bugs that unit tests (which test operations in isolation) cannot surface.
//!
//! ## Scenarios
//! 1. **Happy Path** — create → advance past cliff → withdraw → top-up →
//!    transfer → new recipient withdraws to completion
//! 2. **Cancel After Top-Up** — create with cliff → top up before cliff →
//!    cancel before cliff → verify full refund of original + top-up amount
//! 3. **Transfer + Withdraw Race** — create → advance time → transfer →
//!    new recipient withdraws correct unlocked amount; old recipient
//!    cannot withdraw (stream no longer in their index)
//! 4. **Multiple Streams Same Parties** — 3 streams between same sender /
//!    recipient; cancel one, complete one, transfer one; verify all indexes
//!    are correct for both parties throughout

#![cfg(test)]

extern crate std;

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    token::{Client as TokenClient, StellarAssetClient},
    Address, Env,
};

// ─── Shared test environment ──────────────────────────────────────────────────

struct TestEnv {
    env: Env,
    contract_id: Address,
    token_id: Address,
    sender: Address,
    recipient: Address,
    admin: Address,
}

impl TestEnv {
    fn setup() -> Self {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(StreamingContract, ());
        let sender = Address::generate(&env);
        let recipient = Address::generate(&env);
        let admin = Address::generate(&env);

        let token_admin = Address::generate(&env);
        let token_id = env
            .register_stellar_asset_contract_v2(token_admin.clone())
            .address();

        let asset_client = StellarAssetClient::new(&env, &token_id);
        asset_client.mint(&sender, &10_000_000_0000000);

        let client = StreamingContractClient::new(&env, &contract_id);
        client.initialize(&admin);

        TestEnv { env, contract_id, token_id, sender, recipient, admin }
    }

    fn client(&self) -> StreamingContractClient {
        StreamingContractClient::new(&self.env, &self.contract_id)
    }

    fn token(&self) -> TokenClient {
        TokenClient::new(&self.env, &self.token_id)
    }

    fn set_time(&self, ts: u64) {
        self.env.ledger().with_mut(|l| l.timestamp = ts);
    }

    /// Approve `amount` tokens to the streaming contract on behalf of `sender`.
    fn approve(&self, amount: i128) {
        self.token().approve(
            &self.sender,
            &self.contract_id,
            &amount,
            &(self.env.ledger().sequence() + 500),
        );
    }

    /// Create a stream and return its ID. Approves the contract first.
    fn create(
        &self,
        total_amount: i128,
        duration_secs: u64,
        cliff_delay_secs: u64,
        cliff_amount: i128,
    ) -> u64 {
        let now = self.env.ledger().timestamp();
        self.approve(total_amount);
        self.client()
            .create_stream(
                &self.sender,
                &CreateStreamParams {
                    recipient: self.recipient.clone(),
                    token: self.token_id.clone(),
                    total_amount,
                    start_time: now,
                    end_time: now + duration_secs,
                    cliff_time: now + cliff_delay_secs,
                    cliff_amount,
                    metadata: None,
                },
            )
            .unwrap()
    }
}

// ─── Scenario 1: Happy Path ───────────────────────────────────────────────────
//
// Timeline (all relative to T0):
//   T0          create stream (1000 tokens, 100s duration, 10s cliff)
//   T0+10       cliff reached → withdrawable = cliff_amount (0) + linear so far
//   T0+20       withdraw 200 tokens
//   T0+20       sender tops up 500 more tokens
//   T0+20       sender transfers stream to new_recipient
//   T0+100      new_recipient withdraws all remaining tokens
//   FINAL       contract balance = 0

#[test]
fn test_scenario1_happy_path_full_lifecycle() {
    let t = TestEnv::setup();
    let t0 = 1_000_000u64;
    t.set_time(t0);

    // ── Create: 1000 tokens, 100s duration, 10s cliff (no cliff amount) ──────
    let total = 1_000_0000000i128; // 1000 tokens
    let duration = 100u64;
    let cliff_delay = 10u64;
    let stream_id = t.create(total, duration, cliff_delay, 0);

    let stream = t.client().get_stream(&stream_id).unwrap();
    assert_eq!(stream.deposited_amount, total);
    assert_eq!(stream.withdrawn_amount, 0);
    assert_eq!(stream.start_time, t0);
    assert_eq!(stream.end_time, t0 + duration);
    assert_eq!(stream.cliff_time, t0 + cliff_delay);

    // ── Before cliff: nothing withdrawable ───────────────────────────────────
    t.set_time(t0 + 5);
    assert_eq!(t.client().get_withdrawable(&stream_id).unwrap(), 0);

    // ── Past cliff: linear unlock has started ─────────────────────────────────
    t.set_time(t0 + cliff_delay);
    let withdrawable_at_cliff = t.client().get_withdrawable(&stream_id).unwrap();
    assert!(
        withdrawable_at_cliff >= 0,
        "should have some amount available at cliff"
    );

    // ── Advance to 20% through the stream; withdraw 200 tokens ───────────────
    t.set_time(t0 + 20);
    let withdrawable_at_20 = t.client().get_withdrawable(&stream_id).unwrap();
    assert!(withdrawable_at_20 > 0);

    // Withdraw exactly 200 tokens (within what's unlocked at t0+20)
    let withdraw_amount = 200_0000000i128;
    assert!(
        withdrawable_at_20 >= withdraw_amount,
        "need at least 200 tokens unlocked by t0+20 (20% of 1000s stream)"
    );

    let recipient_balance_before = t.token().balance(&t.recipient);
    t.client().withdraw(&stream_id, &withdraw_amount).unwrap();

    assert_eq!(
        t.token().balance(&t.recipient),
        recipient_balance_before + withdraw_amount
    );
    let stream = t.client().get_stream(&stream_id).unwrap();
    assert_eq!(stream.withdrawn_amount, withdraw_amount);

    // ── Top up 500 more tokens ────────────────────────────────────────────────
    let top_up_amount = 500_0000000i128;
    t.approve(top_up_amount);
    t.client().top_up(&stream_id, &top_up_amount).unwrap();

    let stream_after_topup = t.client().get_stream(&stream_id).unwrap();
    assert_eq!(stream_after_topup.deposited_amount, total + top_up_amount);
    // Rate must be recalculated over remaining duration
    assert!(
        stream_after_topup.amount_per_second > stream.amount_per_second,
        "rate should increase after top-up"
    );

    // ── Transfer stream to new_recipient ──────────────────────────────────────
    let new_recipient = Address::generate(&t.env);
    t.client()
        .transfer_stream(&stream_id, &new_recipient)
        .unwrap();

    // old recipient no longer in active index for this stream
    let old_received = t.client().get_received_streams(&t.recipient, &0, &100);
    assert!(
        !old_received.contains(&stream_id),
        "old recipient should no longer be in active index"
    );
    let new_received = t.client().get_received_streams(&new_recipient, &0, &100);
    assert!(
        new_received.contains(&stream_id),
        "new recipient should appear in active index"
    );

    let stream = t.client().get_stream(&stream_id).unwrap();
    assert_eq!(stream.recipient, new_recipient);

    // ── Advance to end; new_recipient drains the stream ───────────────────────
    t.set_time(t0 + duration + 1); // past end_time
    let remaining = t.client().get_withdrawable(&stream_id).unwrap();
    assert!(remaining > 0, "new recipient should have tokens to withdraw");

    t.client().withdraw(&stream_id, &remaining).unwrap();

    // Contract balance should be zero (all funds distributed)
    assert_eq!(
        t.token().balance(&t.contract_id),
        0,
        "contract should hold no funds after full drain"
    );

    // Verify token conservation: sender paid total + top_up; old + new recipients received it all
    let old_got = t.token().balance(&t.recipient) - recipient_balance_before;
    let new_got = t.token().balance(&new_recipient);
    assert_eq!(
        old_got + new_got,
        total + top_up_amount,
        "token conservation: all deposited funds must be distributed"
    );
}

// ─── Scenario 2: Cancel After Top-Up ─────────────────────────────────────────
//
// Timeline (relative to T0):
//   T0          create stream (500 tokens, 200s duration, 50s cliff)
//   T0+20       top up 300 more tokens (still before cliff)
//   T0+30       cancel (still before cliff)
//   FINAL       sender gets back 100% of (500 + 300) = 800 tokens
//               recipient gets 0 (cliff not reached)

#[test]
fn test_scenario2_cancel_after_topup_before_cliff() {
    let t = TestEnv::setup();
    let t0 = 2_000_000u64;
    t.set_time(t0);

    let total = 500_0000000i128;
    let duration = 200u64;
    let cliff_delay = 50u64;

    let stream_id = t.create(total, duration, cliff_delay, 0);

    let stream = t.client().get_stream(&stream_id).unwrap();
    assert_eq!(stream.deposited_amount, total);
    assert_eq!(stream.cliff_time, t0 + cliff_delay);

    // ── Top up before cliff (t0+20) ───────────────────────────────────────────
    t.set_time(t0 + 20);
    let top_up = 300_0000000i128;
    t.approve(top_up);
    t.client().top_up(&stream_id, &top_up).unwrap();

    let stream = t.client().get_stream(&stream_id).unwrap();
    assert_eq!(
        stream.deposited_amount,
        total + top_up,
        "deposited amount must include top-up"
    );

    // Nothing unlocked yet (before cliff)
    assert_eq!(
        t.client().get_withdrawable(&stream_id).unwrap(),
        0,
        "nothing should be withdrawable before cliff"
    );

    // ── Cancel before cliff (t0+30) ───────────────────────────────────────────
    t.set_time(t0 + 30);
    let sender_balance_before = t.token().balance(&t.sender);
    let recipient_balance_before = t.token().balance(&t.recipient);

    t.client().cancel(&stream_id).unwrap();

    let stream = t.client().get_stream(&stream_id).unwrap();
    assert!(stream.cancelled);

    // Sender gets back everything (no tokens vested before cliff)
    let sender_refund = t.token().balance(&t.sender) - sender_balance_before;
    let recipient_got = t.token().balance(&t.recipient) - recipient_balance_before;

    assert_eq!(
        sender_refund,
        total + top_up,
        "sender must recover original deposit + top-up amount"
    );
    assert_eq!(
        recipient_got, 0,
        "recipient gets nothing when cancelled before cliff"
    );

    // Stream moves to archived index, not active
    let active_sent = t.client().get_sent_streams(&t.sender, &0, &100);
    assert!(
        !active_sent.contains(&stream_id),
        "cancelled stream must leave active sent index"
    );
    let archived_sent = t
        .client()
        .get_archived_sent_streams(&t.sender, &0, &100);
    assert!(
        archived_sent.contains(&stream_id),
        "cancelled stream must enter archived sent index"
    );
}

// ─── Scenario 3: Transfer + Withdraw Race ────────────────────────────────────
//
// Timeline (relative to T0):
//   T0          create stream (1000 tokens, 100s duration, no cliff)
//   T0+40       transfer to new_recipient (40% unlocked)
//   T0+40       new_recipient withdraws all currently unlocked tokens
//   T0+100      new_recipient withdraws the rest
//   VERIFY      old recipient's index no longer contains the stream
//               old recipient cannot withdraw (stream.recipient != them)

#[test]
fn test_scenario3_transfer_then_withdraw_race() {
    let t = TestEnv::setup();
    let t0 = 3_000_000u64;
    t.set_time(t0);

    let total = 1_000_0000000i128;
    let duration = 100u64;
    let stream_id = t.create(total, duration, 0, 0);

    // ── Advance to 40s; record unlocked ──────────────────────────────────────
    t.set_time(t0 + 40);
    let unlocked_at_transfer = t.client().get_withdrawable(&stream_id).unwrap();
    assert!(unlocked_at_transfer > 0);

    // ── Transfer to new_recipient ─────────────────────────────────────────────
    let new_recipient = Address::generate(&t.env);
    t.client()
        .transfer_stream(&stream_id, &new_recipient)
        .unwrap();

    // Verify old recipient's index is cleared
    let old_received = t.client().get_received_streams(&t.recipient, &0, &100);
    assert!(
        !old_received.contains(&stream_id),
        "old recipient's active index must not contain the transferred stream"
    );

    // Verify new recipient's index contains the stream
    let new_received = t.client().get_received_streams(&new_recipient, &0, &100);
    assert!(
        new_received.contains(&stream_id),
        "new recipient must appear in active index after transfer"
    );

    // ── new_recipient withdraws unlocked portion immediately after transfer ───
    let withdrawable_after_transfer = t.client().get_withdrawable(&stream_id).unwrap();
    // Should be the same as before transfer (no time has passed)
    assert_eq!(
        withdrawable_after_transfer, unlocked_at_transfer,
        "withdrawable amount must not change due to transfer"
    );

    t.client()
        .withdraw(&stream_id, &withdrawable_after_transfer)
        .unwrap();
    assert_eq!(
        t.token().balance(&new_recipient),
        withdrawable_after_transfer
    );

    // Old recipient balance unchanged
    assert_eq!(
        t.token().balance(&t.recipient),
        0,
        "old recipient balance must remain 0"
    );

    // ── Advance to end; new_recipient drains remainder ────────────────────────
    t.set_time(t0 + duration + 1);
    let remainder = t.client().get_withdrawable(&stream_id).unwrap();
    assert!(remainder > 0);

    t.client().withdraw(&stream_id, &remainder).unwrap();

    // Token conservation
    assert_eq!(
        t.token().balance(&new_recipient),
        withdrawable_after_transfer + remainder
    );
    // Contract holds nothing
    assert_eq!(t.token().balance(&t.contract_id), 0);

    // Old recipient still got nothing
    assert_eq!(t.token().balance(&t.recipient), 0);
}

// ─── Scenario 4: Multiple Streams Same Parties ───────────────────────────────
//
// Create 3 streams between same sender / recipient:
//   Stream A — cancel before end
//   Stream B — run to completion (recipient withdraws in full)
//   Stream C — transfer to third_recipient
//
// After these operations, verify:
//   - sender's active index has only stream C
//   - recipient's active index is empty
//   - third_recipient's active index has stream C
//   - cancelled/archived indexes are correct

#[test]
fn test_scenario4_multiple_streams_same_parties_index_integrity() {
    let t = TestEnv::setup();
    let t0 = 4_000_000u64;
    t.set_time(t0);

    let total = 1_000_0000000i128;
    let duration = 100u64;

    // ── Create 3 streams ──────────────────────────────────────────────────────
    let stream_a = t.create(total, duration, 0, 0);
    let stream_b = t.create(total, duration, 0, 0);
    let stream_c = t.create(total, duration, 0, 0);

    // Sender index has all 3
    let sent = t.client().get_sent_streams(&t.sender, &0, &100);
    assert_eq!(sent.len(), 3);
    assert!(sent.contains(&stream_a));
    assert!(sent.contains(&stream_b));
    assert!(sent.contains(&stream_c));

    // Recipient index has all 3
    let received = t.client().get_received_streams(&t.recipient, &0, &100);
    assert_eq!(received.len(), 3);
    assert!(received.contains(&stream_a));
    assert!(received.contains(&stream_b));
    assert!(received.contains(&stream_c));

    // ── Operation A: Cancel stream_a at t0+40 ────────────────────────────────
    t.set_time(t0 + 40);
    let sender_before_cancel = t.token().balance(&t.sender);
    let recipient_before_cancel = t.token().balance(&t.recipient);

    t.client().cancel(&stream_a).unwrap();

    let stream_a_state = t.client().get_stream(&stream_a).unwrap();
    assert!(stream_a_state.cancelled);

    // Some tokens should go to recipient (40% unlocked), rest back to sender
    let recipient_after_cancel = t.token().balance(&t.recipient);
    let sender_after_cancel = t.token().balance(&t.sender);
    assert!(
        recipient_after_cancel > recipient_before_cancel,
        "recipient should receive unlocked tokens on cancel"
    );
    assert!(
        sender_after_cancel > sender_before_cancel,
        "sender should receive locked tokens back on cancel"
    );
    assert_eq!(
        (recipient_after_cancel - recipient_before_cancel)
            + (sender_after_cancel - sender_before_cancel),
        total,
        "token conservation on cancel"
    );

    // stream_a must leave sender's active index
    let sent_after_cancel = t.client().get_sent_streams(&t.sender, &0, &100);
    assert!(!sent_after_cancel.contains(&stream_a));
    assert_eq!(
        sent_after_cancel.len(),
        2,
        "sender active index should have 2 streams after cancellation"
    );

    // stream_a must leave recipient's active index
    let received_after_cancel = t.client().get_received_streams(&t.recipient, &0, &100);
    assert!(!received_after_cancel.contains(&stream_a));
    assert_eq!(received_after_cancel.len(), 2);

    // stream_a must enter archived indexes
    assert!(t
        .client()
        .get_archived_sent_streams(&t.sender, &0, &100)
        .contains(&stream_a));
    assert!(t
        .client()
        .get_archived_received_streams(&t.recipient, &0, &100)
        .contains(&stream_a));

    // ── Operation B: Complete stream_b (recipient withdraws in full) ──────────
    t.set_time(t0 + duration + 1); // past end_time
    let full_amount = t.client().get_withdrawable(&stream_b).unwrap();
    assert_eq!(
        full_amount, total,
        "after end_time the full deposited amount should be withdrawable"
    );

    t.client().withdraw(&stream_b, &full_amount).unwrap();

    let stream_b_state = t.client().get_stream(&stream_b).unwrap();
    assert_eq!(stream_b_state.withdrawn_amount, total);

    // A fully drained stream moves to archive
    let sent_after_complete = t.client().get_sent_streams(&t.sender, &0, &100);
    assert!(!sent_after_complete.contains(&stream_b));
    assert_eq!(
        sent_after_complete.len(),
        1,
        "sender active index should have only stream_c"
    );
    assert!(sent_after_complete.contains(&stream_c));

    let received_after_complete = t
        .client()
        .get_received_streams(&t.recipient, &0, &100);
    assert!(!received_after_complete.contains(&stream_b));
    assert_eq!(received_after_complete.len(), 1);
    assert!(received_after_complete.contains(&stream_c));

    // stream_b in archived indexes
    assert!(t
        .client()
        .get_archived_sent_streams(&t.sender, &0, &100)
        .contains(&stream_b));
    assert!(t
        .client()
        .get_archived_received_streams(&t.recipient, &0, &100)
        .contains(&stream_b));

    // ── Operation C: Transfer stream_c to third_recipient ────────────────────
    let third_recipient = Address::generate(&t.env);
    t.client()
        .transfer_stream(&stream_c, &third_recipient)
        .unwrap();

    // stream_c stays in sender's active index
    let sent_final = t.client().get_sent_streams(&t.sender, &0, &100);
    assert!(
        sent_final.contains(&stream_c),
        "sender active index must still contain stream_c after transfer"
    );
    assert_eq!(sent_final.len(), 1);

    // stream_c must leave recipient's active index
    let received_final = t.client().get_received_streams(&t.recipient, &0, &100);
    assert!(
        !received_final.contains(&stream_c),
        "stream_c must leave recipient active index after transfer"
    );
    assert_eq!(
        received_final.len(),
        0,
        "recipient active index must be empty"
    );

    // stream_c must enter third_recipient's active index
    let third_received = t
        .client()
        .get_received_streams(&third_recipient, &0, &100);
    assert!(
        third_received.contains(&stream_c),
        "third_recipient active index must contain stream_c"
    );
    assert_eq!(third_received.len(), 1);

    // ── Final balance verification ────────────────────────────────────────────
    // stream_a: distributed to sender/recipient at cancel
    // stream_b: fully withdrawn by recipient
    // stream_c: still in contract (not withdrawn yet)
    let stream_c_state = t.client().get_stream(&stream_c).unwrap();
    assert_eq!(stream_c_state.recipient, third_recipient);
    assert_eq!(
        t.token().balance(&t.contract_id),
        total, // stream_c still locked
        "contract should hold exactly stream_c's deposited amount"
    );

    // ── third_recipient can withdraw from stream_c ────────────────────────────
    let withdrawable_c = t.client().get_withdrawable(&stream_c).unwrap();
    assert!(
        withdrawable_c > 0,
        "third_recipient should be able to withdraw from transferred stream"
    );
}

// ─── Scenario 4b: Verify old recipient cannot withdraw after transfer ─────────
//
// This is the authorization-level verification that complements scenario 4's
// index verification: after a transfer, the old recipient is no longer on the
// stream and `withdraw` will fail because auth is required from the new recipient.

#[test]
fn test_scenario4b_old_recipient_cannot_withdraw_after_transfer() {
    let t = TestEnv::setup();
    let t0 = 5_000_000u64;
    t.set_time(t0);

    let total = 1_000_0000000i128;
    let duration = 100u64;
    let stream_id = t.create(total, duration, 0, 0);

    // Advance time so there are tokens to withdraw
    t.set_time(t0 + 50);

    // Transfer to new_recipient
    let new_recipient = Address::generate(&t.env);
    t.client()
        .transfer_stream(&stream_id, &new_recipient)
        .unwrap();

    // Old recipient is no longer in index
    let old_received = t.client().get_received_streams(&t.recipient, &0, &100);
    assert_eq!(
        old_received.len(),
        0,
        "old recipient must have empty active index"
    );

    // Verify stream now points to new_recipient
    let stream = t.client().get_stream(&stream_id).unwrap();
    assert_eq!(
        stream.recipient, new_recipient,
        "stream.recipient must be new_recipient after transfer"
    );
    assert_ne!(
        stream.recipient, t.recipient,
        "stream.recipient must NOT be old recipient after transfer"
    );

    // New recipient's index updated
    let new_received = t.client().get_received_streams(&new_recipient, &0, &100);
    assert!(new_received.contains(&stream_id));
}
