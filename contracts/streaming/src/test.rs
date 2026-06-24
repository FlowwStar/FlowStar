#![cfg(test)]

extern crate std;

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    token::{Client as TokenClient, StellarAssetClient},
    Address, Env,
};

// ─── Test helpers ─────────────────────────────────────────────────────────────

struct TestEnv {
    env: Env,
    contract_id: Address,
    token_id: Address,
    sender: Address,
    recipient: Address,
}

impl TestEnv {
    fn setup() -> Self {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(StreamingContract, ());
        let sender = Address::generate(&env);
        let recipient = Address::generate(&env);

        // Deploy a native Stellar Asset Contract as the test token.
        let token_admin = Address::generate(&env);
        let token_id = env.register_stellar_asset_contract_v2(token_admin.clone()).address();

        // Mint tokens to sender.
        let asset_client = StellarAssetClient::new(&env, &token_id);
        asset_client.mint(&sender, &1_000_000_0000000); // 1M tokens (7 decimals)

        TestEnv { env, contract_id, token_id, sender, recipient }
    }

    fn client(&self) -> StreamingContractClient {
        StreamingContractClient::new(&self.env, &self.contract_id)
    }

    fn token(&self) -> TokenClient {
        TokenClient::new(&self.env, &self.token_id)
    }

    fn set_time(&self, timestamp: u64) {
        self.env.ledger().with_mut(|l| l.timestamp = timestamp);
    }

    fn default_params(&self, now: u64) -> CreateStreamParams {
        CreateStreamParams {
            recipient: self.recipient.clone(),
            token: self.token_id.clone(),
            total_amount: 1_000_0000000, // 1000 tokens
            start_time: now,
            end_time: now + 1000,        // 1000 seconds
            cliff_time: now,             // no cliff delay
            cliff_amount: 0,
        }
    }
}

// ─── create_stream ─────────────────────────────────────────────────────────────

#[test]
fn test_create_stream_basic() {
    let t = TestEnv::setup();
    let now = 1_000_000u64;
    t.set_time(now);

    let client = t.client();
    let params = t.default_params(now);
    let total = params.total_amount;

    // Approve contract to pull funds.
    t.token().approve(&t.sender, &t.contract_id, &total, &(t.env.ledger().sequence() + 500));

    let stream_id = client.create_stream(&t.sender, &params);

    assert_eq!(stream_id, 1);

    let stream = client.get_stream(&stream_id);
    assert_eq!(stream.sender, t.sender);
    assert_eq!(stream.recipient, t.recipient);
    assert_eq!(stream.deposited_amount, total);
    assert_eq!(stream.withdrawn_amount, 0);
    assert!(!stream.cancelled);

    // Contract should hold the funds.
    assert_eq!(t.token().balance(&t.contract_id), total);
    // Sender balance reduced.
    assert_eq!(t.token().balance(&t.sender), 1_000_000_0000000 - total);
}

#[test]
fn test_create_stream_with_cliff() {
    let t = TestEnv::setup();
    let now = 1_000_000u64;
    t.set_time(now);

    let client = t.client();
    let cliff_amount = 100_0000000i128; // 100 tokens upfront at cliff
    let params = CreateStreamParams {
        recipient: t.recipient.clone(),
        token: t.token_id.clone(),
        total_amount: 1_000_0000000,
        start_time: now,
        end_time: now + 1000,
        cliff_time: now + 200,  // cliff kicks in after 200s
        cliff_amount,
    };

    t.token().approve(
        &t.sender,
        &t.contract_id,
        &params.total_amount,
        &(t.env.ledger().sequence() + 500),
    );

    let stream_id = client.create_stream(&t.sender, &params);
    let stream = client.get_stream(&stream_id);

    assert_eq!(stream.cliff_amount, cliff_amount);
    // Before cliff — nothing withdrawable.
    assert_eq!(client.get_withdrawable(&stream_id), 0);
}

#[test]
#[should_panic(expected = "end_time must be > start_time")]
fn test_create_stream_invalid_times() {
    let t = TestEnv::setup();
    let now = 1_000_000u64;
    t.set_time(now);
    let client = t.client();
    let mut params = t.default_params(now);
    params.end_time = params.start_time; // same = invalid
    t.token().approve(&t.sender, &t.contract_id, &params.total_amount, &(t.env.ledger().sequence() + 500));
    client.create_stream(&t.sender, &params);
}

#[test]
#[should_panic(expected = "total_amount must be > 0")]
fn test_create_stream_zero_amount() {
    let t = TestEnv::setup();
    let now = 1_000_000u64;
    t.set_time(now);
    let client = t.client();
    let mut params = t.default_params(now);
    params.total_amount = 0;
    t.token().approve(&t.sender, &t.contract_id, &params.total_amount, &(t.env.ledger().sequence() + 500));
    client.create_stream(&t.sender, &params);
}

// ─── withdraw ──────────────────────────────────────────────────────────────────

#[test]
fn test_withdraw_partial() {
    let t = TestEnv::setup();
    let now = 1_000_000u64;
    t.set_time(now);
    let client = t.client();
    let params = t.default_params(now);
    let total = params.total_amount;

    t.token().approve(&t.sender, &t.contract_id, &total, &(t.env.ledger().sequence() + 500));
    let stream_id = client.create_stream(&t.sender, &params);

    // Advance time by 500s (halfway through the 1000s stream).
    t.set_time(now + 500);

    let withdrawable = client.get_withdrawable(&stream_id);
    // Should be ~500/1000 * total.
    assert!(withdrawable > 0);
    assert!(withdrawable <= total / 2 + 1); // allow for rounding

    client.withdraw(&stream_id, &withdrawable);

    let stream = client.get_stream(&stream_id);
    assert_eq!(stream.withdrawn_amount, withdrawable);
    assert_eq!(t.token().balance(&t.recipient), withdrawable);
}

#[test]
fn test_withdraw_full_after_end() {
    let t = TestEnv::setup();
    let now = 1_000_000u64;
    t.set_time(now);
    let client = t.client();
    let params = t.default_params(now);
    let total = params.total_amount;

    t.token().approve(&t.sender, &t.contract_id, &total, &(t.env.ledger().sequence() + 500));
    let stream_id = client.create_stream(&t.sender, &params);

    // After end time — all unlocked.
    t.set_time(now + 2000);
    let withdrawable = client.get_withdrawable(&stream_id);
    assert_eq!(withdrawable, total);

    client.withdraw(&stream_id, &total);

    assert_eq!(t.token().balance(&t.recipient), total);
    assert_eq!(t.token().balance(&t.contract_id), 0);
}

#[test]
#[should_panic(expected = "invalid withdraw amount")]
fn test_withdraw_too_much() {
    let t = TestEnv::setup();
    let now = 1_000_000u64;
    t.set_time(now);
    let client = t.client();
    let params = t.default_params(now);
    let total = params.total_amount;

    t.token().approve(&t.sender, &t.contract_id, &total, &(t.env.ledger().sequence() + 500));
    let stream_id = client.create_stream(&t.sender, &params);

    t.set_time(now + 500);

    // Try to withdraw more than unlocked.
    client.withdraw(&stream_id, &total);
}

#[test]
fn test_withdraw_cliff_before_time() {
    let t = TestEnv::setup();
    let now = 1_000_000u64;
    t.set_time(now);
    let client = t.client();

    let params = CreateStreamParams {
        recipient: t.recipient.clone(),
        token: t.token_id.clone(),
        total_amount: 1_000_0000000,
        start_time: now,
        end_time: now + 1000,
        cliff_time: now + 500, // cliff at halfway
        cliff_amount: 0,
    };

    t.token().approve(&t.sender, &t.contract_id, &params.total_amount, &(t.env.ledger().sequence() + 500));
    let stream_id = client.create_stream(&t.sender, &params);

    // Before cliff — nothing available.
    t.set_time(now + 100);
    assert_eq!(client.get_withdrawable(&stream_id), 0);

    // After cliff — linear unlock starts.
    t.set_time(now + 600);
    assert!(client.get_withdrawable(&stream_id) > 0);
}

#[test]
#[should_panic(expected = "sender cannot be the recipient")]
fn test_create_stream_self_rejected() {
    let t = TestEnv::setup();
    let now = 1_000_000u64;
    t.set_time(now);
    let client = t.client();
    let mut params = t.default_params(now);
    params.recipient = t.sender.clone(); // same as sender
    t.token().approve(&t.sender, &t.contract_id, &params.total_amount, &(t.env.ledger().sequence() + 500));
    client.create_stream(&t.sender, &params);
}

// ─── cancel ────────────────────────────────────────────────────────────────────

#[test]
fn test_cancel_midway() {
    let t = TestEnv::setup();
    let now = 1_000_000u64;
    t.set_time(now);
    let client = t.client();
    let params = t.default_params(now);
    let total = params.total_amount;

    t.token().approve(&t.sender, &t.contract_id, &total, &(t.env.ledger().sequence() + 500));
    let stream_id = client.create_stream(&t.sender, &params);

    // Advance halfway.
    t.set_time(now + 500);

    let sender_balance_before = t.token().balance(&t.sender);

    client.cancel(&stream_id);

    let stream = client.get_stream(&stream_id);
    assert!(stream.cancelled);

    let recipient_balance = t.token().balance(&t.recipient);
    let sender_balance_after = t.token().balance(&t.sender);

    // Recipient gets unlocked portion, sender gets the rest.
    assert!(recipient_balance > 0);
    assert!(sender_balance_after > sender_balance_before);
    assert_eq!(
        recipient_balance + sender_balance_after - sender_balance_before,
        total
    );
}

#[test]
#[should_panic(expected = "stream already cancelled")]
fn test_cancel_twice() {
    let t = TestEnv::setup();
    let now = 1_000_000u64;
    t.set_time(now);
    let client = t.client();
    let params = t.default_params(now);
    let total = params.total_amount;

    t.token().approve(&t.sender, &t.contract_id, &total, &(t.env.ledger().sequence() + 500));
    let stream_id = client.create_stream(&t.sender, &params);

    client.cancel(&stream_id);
    client.cancel(&stream_id); // should panic
}

#[test]
#[should_panic(expected = "stream is cancelled")]
fn test_withdraw_from_cancelled_stream() {
    let t = TestEnv::setup();
    let now = 1_000_000u64;
    t.set_time(now);
    let client = t.client();
    let params = t.default_params(now);
    let total = params.total_amount;

    t.token().approve(&t.sender, &t.contract_id, &total, &(t.env.ledger().sequence() + 500));
    let stream_id = client.create_stream(&t.sender, &params);

    t.set_time(now + 500);
    client.cancel(&stream_id);

    // Recipient tries to withdraw after cancel — should fail.
    client.withdraw(&stream_id, &1_0000000);
}

// ─── indexes ───────────────────────────────────────────────────────────────────

#[test]
fn test_stream_indexes() {
    let t = TestEnv::setup();
    let now = 1_000_000u64;
    t.set_time(now);
    let client = t.client();

    let approve_and_create = |params: CreateStreamParams| {
        t.token().approve(
            &t.sender,
            &t.contract_id,
            &params.total_amount,
            &(t.env.ledger().sequence() + 500),
        );
        client.create_stream(&t.sender, &params)
    };

    let id1 = approve_and_create(t.default_params(now));
    let id2 = approve_and_create(t.default_params(now));

    let sent = client.get_sent_streams(&t.sender, &0, &100);
    assert_eq!(sent.len(), 2);
    assert!(sent.contains(&id1));
    assert!(sent.contains(&id2));

    let received = client.get_received_streams(&t.recipient, &0, &100);
    assert_eq!(received.len(), 2);
    assert!(received.contains(&id1));
    assert!(received.contains(&id2));

    // Test pagination and count
    let sent_page1 = client.get_sent_streams(&t.sender, &0, &1);
    assert_eq!(sent_page1.len(), 1);
    let sent_page2 = client.get_sent_streams(&t.sender, &1, &1);
    assert_eq!(sent_page2.len(), 1);
    assert_eq!(client.get_sent_stream_count(&t.sender), 2);
    assert_eq!(client.get_received_stream_count(&t.recipient), 2);
}

#[test]
fn test_incrementing_ids() {
    let t = TestEnv::setup();
    let now = 1_000_000u64;
    t.set_time(now);
    let client = t.client();

    for expected_id in 1u64..=3 {
        let params = t.default_params(now);
        t.token().approve(
            &t.sender,
            &t.contract_id,
            &params.total_amount,
            &(t.env.ledger().sequence() + 500),
        );
        let id = client.create_stream(&t.sender, &params);
        assert_eq!(id, expected_id);
    }
}

// ─── top up ───────────────────────────────────────────────────────────────────

#[test]
fn test_top_up_increases_deposited_amount() {
    let t = TestEnv::setup();
    let now = 1_000_000u64;
    t.set_time(now);
    let client = t.client();
    let params = t.default_params(now);
    let total = params.total_amount;

    t.token().approve(&t.sender, &t.contract_id, &total, &(t.env.ledger().sequence() + 500));
    let stream_id = client.create_stream(&t.sender, &params);

    let additional = 500_0000000i128;
    t.token().approve(&t.sender, &t.contract_id, &additional, &(t.env.ledger().sequence() + 500));
    client.top_up(&stream_id, &additional);

    let stream = client.get_stream(&stream_id);
    assert_eq!(stream.deposited_amount, total + additional);
    assert_eq!(stream.end_time, now + 1000);
}

#[test]
fn test_top_up_at_start_doubles_rate() {
    let t = TestEnv::setup();
    let now = 1_000_000u64;
    t.set_time(now);
    let client = t.client();
    let params = t.default_params(now);
    let total = params.total_amount;

    t.token().approve(&t.sender, &t.contract_id, &total, &(t.env.ledger().sequence() + 500));
    let stream_id = client.create_stream(&t.sender, &params);

    let stream_before = client.get_stream(&stream_id);
    let rate_before = stream_before.amount_per_second;

    // Top up equal amount at start time so rate should double
    t.token().approve(&t.sender, &t.contract_id, &total, &(t.env.ledger().sequence() + 500));
    client.top_up(&stream_id, &total);

    let stream_after = client.get_stream(&stream_id);
    assert_eq!(stream_after.amount_per_second, rate_before * 2);
}


#[test]
fn test_top_up_mid_stream_recalculates_rate() {
    let t = TestEnv::setup();
    let now = 1_000_000u64;
    t.set_time(now);
    let client = t.client();
    let params = t.default_params(now);
    let total = params.total_amount;

    t.token().approve(&t.sender, &t.contract_id, &total, &(t.env.ledger().sequence() + 500));
    let stream_id = client.create_stream(&t.sender, &params);

    t.set_time(now + 500);

    let additional = 500_0000000i128;
    t.token().approve(&t.sender, &t.contract_id, &additional, &(t.env.ledger().sequence() + 500));
    client.top_up(&stream_id, &additional);

    // remaining_deposited = 500, additional = 500 → new_remaining = 1000
    // new_rate = 1000 / 500s remaining = 2 tokens/sec
    let stream = client.get_stream(&stream_id);
    let expected_rate = (500_0000000i128 + additional) / 500i128;
    assert_eq!(stream.amount_per_second, expected_rate);
}

#[test]
#[should_panic(expected = "cannot top up a cancelled stream")]
fn test_top_up_cancelled_stream_panics() {
    let t = TestEnv::setup();
    let now = 1_000_000u64;
    t.set_time(now);
    let client = t.client();
    let params = t.default_params(now);
    let total = params.total_amount;

    t.token().approve(&t.sender, &t.contract_id, &total, &(t.env.ledger().sequence() + 500));
    let stream_id = client.create_stream(&t.sender, &params);

    client.cancel(&stream_id);

    let additional = 100_0000000i128;
    t.token().approve(&t.sender, &t.contract_id, &additional, &(t.env.ledger().sequence() + 500));
    client.top_up(&stream_id, &additional);
}

#[test]
#[should_panic(expected = "cannot top up an ended stream")]
fn test_top_up_ended_stream_panics() {
    let t = TestEnv::setup();
    let now = 1_000_000u64;
    t.set_time(now);
    let client = t.client();
    let params = t.default_params(now);
    let total = params.total_amount;

    t.token().approve(&t.sender, &t.contract_id, &total, &(t.env.ledger().sequence() + 500));
    let stream_id = client.create_stream(&t.sender, &params);

    t.set_time(now + 2000);

    let additional = 100_0000000i128;
    t.token().approve(&t.sender, &t.contract_id, &additional, &(t.env.ledger().sequence() + 500));
    client.top_up(&stream_id, &additional);
}

#[test]
#[should_panic(expected = "additional_amount must be > 0")]
fn test_top_up_zero_amount_panics() {
    let t = TestEnv::setup();
    let now = 1_000_000u64;
    t.set_time(now);
    let client = t.client();
    let params = t.default_params(now);
    let total = params.total_amount;

    t.token().approve(&t.sender, &t.contract_id, &total, &(t.env.ledger().sequence() + 500));
    let stream_id = client.create_stream(&t.sender, &params);

    client.top_up(&stream_id, &0i128);
}
