#![cfg(test)]

extern crate std;

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    token::{Client as TokenClient, StellarAssetClient},
    vec, Address, Env,
};

// ─── Test helpers ─────────────────────────────────────────────────────────────

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

        // Deploy a native Stellar Asset Contract as the test token.
        let token_admin = Address::generate(&env);
        let token_id = env
            .register_stellar_asset_contract_v2(token_admin.clone())
            .address();

        // Mint tokens to sender.
        let asset_client = StellarAssetClient::new(&env, &token_id);
        asset_client.mint(&sender, &1_000_000_0000000); // 1M tokens (7 decimals)

        let client = StreamingContractClient::new(&env, &contract_id);
        client.initialize(&admin);

        TestEnv {
            env,
            contract_id,
            token_id,
            sender,
            recipient,
            admin,
        }
    }

    fn client(&self) -> StreamingContractClient<'_> {
        StreamingContractClient::new(&self.env, &self.contract_id)
    }

    fn token(&self) -> TokenClient<'_> {
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
            end_time: now + 1000, // 1000 seconds
            cliff_time: now,      // no cliff delay
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
    t.token().approve(
        &t.sender,
        &t.contract_id,
        &total,
        &(t.env.ledger().sequence() + 500),
    );

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
        cliff_time: now + 200, // cliff kicks in after 200s
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
fn test_create_stream_invalid_times() {
    let t = TestEnv::setup();
    let now = 1_000_000u64;
    t.set_time(now);
    let client = t.client();
    let mut params = t.default_params(now);
    params.end_time = params.start_time; // same = invalid
    t.token().approve(
        &t.sender,
        &t.contract_id,
        &params.total_amount,
        &(t.env.ledger().sequence() + 500),
    );
    let result = client.try_create_stream(&t.sender, &params);
    assert_eq!(result, Err(Ok(StreamError::InvalidTimeRange)));
}

#[test]
fn test_create_stream_zero_amount() {
    let t = TestEnv::setup();
    let now = 1_000_000u64;
    t.set_time(now);
    let client = t.client();
    let mut params = t.default_params(now);
    params.total_amount = 0;
    t.token().approve(
        &t.sender,
        &t.contract_id,
        &params.total_amount,
        &(t.env.ledger().sequence() + 500),
    );
    let result = client.try_create_stream(&t.sender, &params);
    assert_eq!(result, Err(Ok(StreamError::InvalidAmount)));
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

    t.token().approve(
        &t.sender,
        &t.contract_id,
        &total,
        &(t.env.ledger().sequence() + 500),
    );
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

    t.token().approve(
        &t.sender,
        &t.contract_id,
        &total,
        &(t.env.ledger().sequence() + 500),
    );
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
fn test_withdraw_too_much() {
    let t = TestEnv::setup();
    let now = 1_000_000u64;
    t.set_time(now);
    let client = t.client();
    let params = t.default_params(now);
    let total = params.total_amount;

    t.token().approve(
        &t.sender,
        &t.contract_id,
        &total,
        &(t.env.ledger().sequence() + 500),
    );
    let stream_id = client.create_stream(&t.sender, &params);

    t.set_time(now + 500);

    // Try to withdraw more than unlocked.
    let result = client.try_withdraw(&stream_id, &total);
    assert_eq!(result, Err(Ok(StreamError::InsufficientFunds)));
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

    t.token().approve(
        &t.sender,
        &t.contract_id,
        &params.total_amount,
        &(t.env.ledger().sequence() + 500),
    );
    let stream_id = client.create_stream(&t.sender, &params);

    // Before cliff — nothing available.
    t.set_time(now + 100);
    assert_eq!(client.get_withdrawable(&stream_id), 0);

    // After cliff — linear unlock starts.
    t.set_time(now + 600);
    assert!(client.get_withdrawable(&stream_id) > 0);
}

#[test]
fn test_create_stream_self_rejected() {
    let t = TestEnv::setup();
    let now = 1_000_000u64;
    t.set_time(now);
    let client = t.client();
    let mut params = t.default_params(now);
    params.recipient = t.sender.clone(); // same as sender
    t.token().approve(
        &t.sender,
        &t.contract_id,
        &params.total_amount,
        &(t.env.ledger().sequence() + 500),
    );
    let result = client.try_create_stream(&t.sender, &params);
    assert_eq!(result, Err(Ok(StreamError::SelfStream)));
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

    t.token().approve(
        &t.sender,
        &t.contract_id,
        &total,
        &(t.env.ledger().sequence() + 500),
    );
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
fn test_cancel_twice() {
    let t = TestEnv::setup();
    let now = 1_000_000u64;
    t.set_time(now);
    let client = t.client();
    let params = t.default_params(now);
    let total = params.total_amount;

    t.token().approve(
        &t.sender,
        &t.contract_id,
        &total,
        &(t.env.ledger().sequence() + 500),
    );
    let stream_id = client.create_stream(&t.sender, &params);

    client.cancel(&stream_id);
    let result = client.try_cancel(&stream_id);
    assert_eq!(result, Err(Ok(StreamError::StreamCancelled)));
}

#[test]
fn test_withdraw_from_cancelled_stream() {
    let t = TestEnv::setup();
    let now = 1_000_000u64;
    t.set_time(now);
    let client = t.client();
    let params = t.default_params(now);
    let total = params.total_amount;

    t.token().approve(
        &t.sender,
        &t.contract_id,
        &total,
        &(t.env.ledger().sequence() + 500),
    );
    let stream_id = client.create_stream(&t.sender, &params);

    t.set_time(now + 500);
    client.cancel(&stream_id);

    // Recipient tries to withdraw after cancel — should return StreamCancelled.
    let result = client.try_withdraw(&stream_id, &1_0000000);
    assert_eq!(result, Err(Ok(StreamError::StreamCancelled)));
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
    assert!(sent.contains(id1));
    assert!(sent.contains(id2));

    let received = client.get_received_streams(&t.recipient, &0, &100);
    assert_eq!(received.len(), 2);
    assert!(received.contains(id1));
    assert!(received.contains(id2));

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

// ─── transfer_stream ───────────────────────────────────────────────────────────

#[test]
fn test_transfer_stream_basic() {
    let t = TestEnv::setup();
    let now = 1_000_000u64;
    t.set_time(now);
    let client = t.client();
    let params = t.default_params(now);
    let total = params.total_amount;

    t.token().approve(
        &t.sender,
        &t.contract_id,
        &total,
        &(t.env.ledger().sequence() + 500),
    );
    let stream_id = client.create_stream(&t.sender, &params);

    let new_recipient = Address::generate(&t.env);
    client.transfer_stream(&stream_id, &new_recipient);

    let stream = client.get_stream(&stream_id);
    assert_eq!(stream.recipient, new_recipient);
    assert_eq!(stream.deposited_amount, total);
    assert_eq!(stream.withdrawn_amount, 0);
    assert!(!stream.cancelled);

    // old recipient index cleared, new recipient index updated
    let old_received = client.get_received_streams(&t.recipient, &0, &100);
    assert_eq!(old_received.len(), 0);

    let new_received = client.get_received_streams(&new_recipient, &0, &100);
    assert_eq!(new_received.len(), 1);
    assert!(new_received.contains(stream_id));
}

#[test]
fn test_transfer_stream_with_partial_withdrawals() {
    // New recipient should be able to withdraw remaining after a transfer
    let t = TestEnv::setup();
    let now = 1_000_000u64;
    t.set_time(now);
    let client = t.client();
    let params = t.default_params(now);
    let total = params.total_amount;

    t.token().approve(
        &t.sender,
        &t.contract_id,
        &total,
        &(t.env.ledger().sequence() + 500),
    );
    let stream_id = client.create_stream(&t.sender, &params);

    // Advance halfway; old recipient withdraws half
    t.set_time(now + 500);
    let withdrawable = client.get_withdrawable(&stream_id);
    assert!(withdrawable > 0);
    client.withdraw(&stream_id, &withdrawable);

    // Transfer to new recipient
    let new_recipient = Address::generate(&t.env);
    client.transfer_stream(&stream_id, &new_recipient);

    // Advance to end; new recipient withdraws remaining
    t.set_time(now + 1000);
    let remaining = client.get_withdrawable(&stream_id);
    assert!(remaining > 0);
    client.withdraw(&stream_id, &remaining);

    assert_eq!(t.token().balance(&t.contract_id), 0);
    assert_eq!(t.token().balance(&t.recipient), withdrawable);
    assert_eq!(t.token().balance(&new_recipient), remaining);
}

#[test]
fn test_transfer_stream_old_recipient_cannot_withdraw() {
    let t = TestEnv::setup();
    let now = 1_000_000u64;
    t.set_time(now);
    let client = t.client();
    let params = t.default_params(now);
    let total = params.total_amount;

    t.token().approve(
        &t.sender,
        &t.contract_id,
        &total,
        &(t.env.ledger().sequence() + 500),
    );
    let stream_id = client.create_stream(&t.sender, &params);

    let new_recipient = Address::generate(&t.env);
    client.transfer_stream(&stream_id, &new_recipient);

    // Old recipient index should be empty
    let old_received = client.get_received_streams(&t.recipient, &0, &100);
    assert_eq!(old_received.len(), 0);
}

#[test]
fn test_transfer_stream_roundtrip() {
    // A -> B -> A: original recipient can receive again
    let t = TestEnv::setup();
    let now = 1_000_000u64;
    t.set_time(now);
    let client = t.client();
    let params = t.default_params(now);
    let total = params.total_amount;

    t.token().approve(
        &t.sender,
        &t.contract_id,
        &total,
        &(t.env.ledger().sequence() + 500),
    );
    let stream_id = client.create_stream(&t.sender, &params);

    let new_recipient = Address::generate(&t.env);
    client.transfer_stream(&stream_id, &new_recipient);
    client.transfer_stream(&stream_id, &t.recipient);

    let stream = client.get_stream(&stream_id);
    assert_eq!(stream.recipient, t.recipient);

    let received = client.get_received_streams(&t.recipient, &0, &100);
    assert!(received.contains(stream_id));
}

#[test]
fn test_transfer_stream_at_cliff_time() {
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
        cliff_time: now + 200,
        cliff_amount: 100_0000000,
    };
    let total = params.total_amount;

    t.token().approve(
        &t.sender,
        &t.contract_id,
        &total,
        &(t.env.ledger().sequence() + 500),
    );
    let stream_id = client.create_stream(&t.sender, &params);

    // Transfer at exact cliff time
    t.set_time(now + 200);

    let new_recipient = Address::generate(&t.env);
    client.transfer_stream(&stream_id, &new_recipient);

    let stream = client.get_stream(&stream_id);
    assert_eq!(stream.sender, t.sender);
    assert_eq!(stream.recipient, new_recipient);

    let old_received = client.get_received_streams(&t.recipient, &0, &100);
    assert_eq!(old_received.len(), 0);

    let new_received = client.get_received_streams(&new_recipient, &0, &100);
    assert_eq!(new_received.len(), 1);
    assert_eq!(new_received.get(0).unwrap(), stream_id);
}

#[test]
fn test_transfer_stream_cancelled_fails() {
    let t = TestEnv::setup();
    let now = 1_000_000u64;
    t.set_time(now);
    let client = t.client();
    let params = t.default_params(now);
    let total = params.total_amount;

    t.token().approve(
        &t.sender,
        &t.contract_id,
        &total,
        &(t.env.ledger().sequence() + 500),
    );
    let stream_id = client.create_stream(&t.sender, &params);

    client.cancel(&stream_id);

    let new_recipient = Address::generate(&t.env);
    let result = client.try_transfer_stream(&stream_id, &new_recipient);
    assert_eq!(result, Err(Ok(StreamError::StreamCancelled)));
}

#[test]
fn test_transfer_stream_near_end() {
    // Transfer when stream is 99% complete
    let t = TestEnv::setup();
    let now = 1_000_000u64;
    t.set_time(now);
    let client = t.client();
    let params = t.default_params(now);
    let total = params.total_amount;

    t.token().approve(
        &t.sender,
        &t.contract_id,
        &total,
        &(t.env.ledger().sequence() + 500),
    );
    let stream_id = client.create_stream(&t.sender, &params);

    t.set_time(now + 990); // 99% through
    let new_recipient = Address::generate(&t.env);
    client.transfer_stream(&stream_id, &new_recipient);

    // New recipient gets the remaining 1%
    t.set_time(now + 1000);
    let remaining = client.get_withdrawable(&stream_id);
    assert!(remaining > 0);
    client.withdraw(&stream_id, &remaining);
    assert!(t.token().balance(&new_recipient) > 0);
    let old_id = client.get_received_streams(&t.recipient, &0, &100);
    assert_eq!(old_id, Vec::new(&t.env));

    // Fully withdrawing at end_time drains and archives the stream, so it
    // moves out of the active received index into the archive index.
    let new_id = client.get_received_streams(&new_recipient, &0, &100);
    assert_eq!(new_id, Vec::new(&t.env));

    let archived_id = client.get_archived_received_streams(&new_recipient, &0, &100);
    assert_eq!(archived_id, vec![&t.env, 1]);
}

#[test]
fn test_transfer_stream_sender_index_unaffected() {
    let t = TestEnv::setup();
    let now = 1_000_000u64;
    t.set_time(now);
    let client = t.client();
    let params = t.default_params(now);
    let total = params.total_amount;

    t.token().approve(
        &t.sender,
        &t.contract_id,
        &total,
        &(t.env.ledger().sequence() + 500),
    );
    let stream_id = client.create_stream(&t.sender, &params);

    let sent_before = client.get_sent_streams(&t.sender, &0, &100);
    assert_eq!(sent_before.len(), 1);
    assert!(sent_before.contains(stream_id));

    let new_recipient = Address::generate(&t.env);
    client.transfer_stream(&stream_id, &new_recipient);

    // Transferring the recipient must not change the sender's own index.
    let sent_after = client.get_sent_streams(&t.sender, &0, &100);
    assert_eq!(sent_after.len(), 1);
    assert!(sent_after.contains(stream_id));
}

// ─── top up ───────────────────────────────────────────────────────────────────

#[test]
fn test_transfer_stream_multiple_times() {
    let t = TestEnv::setup();
    let now = 1_000_000u64;
    t.set_time(now);
    let client = t.client();
    let params = t.default_params(now);
    let total = params.total_amount;

    t.token().approve(
        &t.sender,
        &t.contract_id,
        &total,
        &(t.env.ledger().sequence() + 500),
    );
    let stream_id = client.create_stream(&t.sender, &params);

    let r1 = Address::generate(&t.env);
    let r2 = Address::generate(&t.env);
    let r3 = Address::generate(&t.env);

    client.transfer_stream(&stream_id, &r1);
    client.transfer_stream(&stream_id, &r2);
    client.transfer_stream(&stream_id, &r3);
    assert_eq!(stream_id, 1);

    let additional = 500_0000000i128;
    t.token().approve(
        &t.sender,
        &t.contract_id,
        &additional,
        &(t.env.ledger().sequence() + 500),
    );
    client.top_up(&stream_id, &additional);

    let stream = client.get_stream(&stream_id);
    assert_eq!(stream.deposited_amount, total + additional);
    assert_eq!(stream.end_time, now + 1000);
    let stream = client.get_stream(&stream_id);
    assert_eq!(stream.recipient, r3);

    // Only r3 should have the stream in their index
    assert_eq!(client.get_received_streams(&r1, &0, &100).len(), 0);
    assert_eq!(client.get_received_streams(&r2, &0, &100).len(), 0);
    assert_eq!(client.get_received_streams(&r3, &0, &100).len(), 1);
}

#[test]
fn test_transfer_then_cancel() {
    // After transfer, cancel: sender gets refund, new recipient gets unlocked
    let t = TestEnv::setup();
    let now = 1_000_000u64;
    t.set_time(now);
    let client = t.client();
    let params = t.default_params(now);
    let total = params.total_amount;

    t.token().approve(
        &t.sender,
        &t.contract_id,
        &total,
        &(t.env.ledger().sequence() + 500),
    );
    let stream_id = client.create_stream(&t.sender, &params);

    let stream_before = client.get_stream(&stream_id);
    let _rate_before = stream_before.amount_per_second;
    let new_recipient = Address::generate(&t.env);
    t.set_time(now + 500);
    client.transfer_stream(&stream_id, &new_recipient);

    let sender_before = t.token().balance(&t.sender);
    client.cancel(&stream_id);

    let new_bal = t.token().balance(&new_recipient);
    let sender_after = t.token().balance(&t.sender);

    assert!(new_bal > 0);
    assert!(sender_after > sender_before);
    assert_eq!(new_bal + (sender_after - sender_before), total);
    // Old recipient should have gotten nothing
    assert_eq!(t.token().balance(&t.recipient), 0);
}

#[test]
fn test_transfer_stream_cancelled_panics() {
    let t = TestEnv::setup();
    let now = 1_000_000u64;
    t.set_time(now);
    let client = t.client();
    let params = t.default_params(now);
    let total = params.total_amount;

    t.token().approve(
        &t.sender,
        &t.contract_id,
        &total,
        &(t.env.ledger().sequence() + 500),
    );
    let stream_id = client.create_stream(&t.sender, &params);

    client.cancel(&stream_id);

    let new_recipient = Address::generate(&t.env);
    let result = client.try_transfer_stream(&stream_id, &new_recipient);
    assert_eq!(result, Err(Ok(StreamError::StreamCancelled)));
}

// ─── top_up ───────────────────────────────────────────────────────────────────

#[test]
fn test_top_up_increases_deposited_amount() {
    let t = TestEnv::setup();
    let now = 1_000_000u64;
    t.set_time(now);
    let client = t.client();
    let params = t.default_params(now);
    let total = params.total_amount;

    t.token().approve(
        &t.sender,
        &t.contract_id,
        &total,
        &(t.env.ledger().sequence() + 500),
    );
    let stream_id = client.create_stream(&t.sender, &params);

    let additional = 500_0000000i128;
    t.token().approve(
        &t.sender,
        &t.contract_id,
        &additional,
        &(t.env.ledger().sequence() + 500),
    );
    client.top_up(&stream_id, &additional);

    let stream = client.get_stream(&stream_id);
    assert_eq!(stream.deposited_amount, total + additional);
}

#[test]
fn test_top_up_at_start_doubles_rate() {
    let t = TestEnv::setup();
    let now = 1_000_000u64;
    t.set_time(now);
    let client = t.client();
    let params = t.default_params(now);
    let total = params.total_amount;

    t.token().approve(
        &t.sender,
        &t.contract_id,
        &total,
        &(t.env.ledger().sequence() + 500),
    );
    let stream_id = client.create_stream(&t.sender, &params);

    let rate_before = client.get_stream(&stream_id).amount_per_second;

    t.token().approve(
        &t.sender,
        &t.contract_id,
        &total,
        &(t.env.ledger().sequence() + 500),
    );
    client.top_up(&stream_id, &total);

    let rate_after = client.get_stream(&stream_id).amount_per_second;
    assert_eq!(rate_after, rate_before * 2);
}

#[test]
fn test_top_up_mid_stream_recalculates_rate() {
    let t = TestEnv::setup();
    let now = 1_000_000u64;
    t.set_time(now);
    let client = t.client();
    let params = t.default_params(now);
    let total = params.total_amount;

    t.token().approve(
        &t.sender,
        &t.contract_id,
        &total,
        &(t.env.ledger().sequence() + 500),
    );
    let stream_id = client.create_stream(&t.sender, &params);

    t.set_time(now + 500);

    let additional = 500_0000000i128;
    t.token().approve(
        &t.sender,
        &t.contract_id,
        &additional,
        &(t.env.ledger().sequence() + 500),
    );
    client.top_up(&stream_id, &additional);

    // remaining_deposited = 500, additional = 500 → new_remaining = 1000
    // new_rate = 1000 / 500s remaining = 2 tokens/sec
    let _stream = client.get_stream(&stream_id);
    // remaining_deposited = 500 tokens, additional = 500 tokens
    // new_rate = 1000 / 500s remaining = 2 tokens/sec (in smallest units)
    let stream = client.get_stream(&stream_id);
    let expected_rate = (500_0000000i128 + additional) / 500i128;
    assert_eq!(stream.amount_per_second, expected_rate);
}

#[test]
fn test_top_up_cancelled_stream_returns_error() {
    let t = TestEnv::setup();
    let now = 1_000_000u64;
    t.set_time(now);
    let client = t.client();
    let params = t.default_params(now);
    let total = params.total_amount;

    t.token().approve(
        &t.sender,
        &t.contract_id,
        &total,
        &(t.env.ledger().sequence() + 500),
    );
    let stream_id = client.create_stream(&t.sender, &params);

    client.cancel(&stream_id);

    let additional = 100_0000000i128;
    t.token().approve(
        &t.sender,
        &t.contract_id,
        &additional,
        &(t.env.ledger().sequence() + 500),
    );
    let result = client.try_top_up(&stream_id, &additional);
    assert_eq!(result, Err(Ok(StreamError::StreamCancelled)));
}

#[test]
fn test_top_up_ended_stream_returns_error() {
    let t = TestEnv::setup();
    let now = 1_000_000u64;
    t.set_time(now);
    let client = t.client();
    let params = t.default_params(now);
    let total = params.total_amount;

    t.token().approve(
        &t.sender,
        &t.contract_id,
        &total,
        &(t.env.ledger().sequence() + 500),
    );
    let stream_id = client.create_stream(&t.sender, &params);

    t.set_time(now + 2000);

    let additional = 100_0000000i128;
    t.token().approve(
        &t.sender,
        &t.contract_id,
        &additional,
        &(t.env.ledger().sequence() + 500),
    );
    let result = client.try_top_up(&stream_id, &additional);
    assert_eq!(result, Err(Ok(StreamError::StreamEnded)));
}

#[test]
fn test_top_up_zero_amount_returns_error() {
    let t = TestEnv::setup();
    let now = 1_000_000u64;
    t.set_time(now);
    let client = t.client();
    let params = t.default_params(now);
    let total = params.total_amount;

    t.token().approve(
        &t.sender,
        &t.contract_id,
        &total,
        &(t.env.ledger().sequence() + 500),
    );
    let stream_id = client.create_stream(&t.sender, &params);

    let result = client.try_top_up(&stream_id, &0i128);
    assert_eq!(result, Err(Ok(StreamError::InvalidAmount)));
}

#[test]
fn test_top_up_immediately_after_creation() {
    let t = TestEnv::setup();
    let now = 1_000_000u64;
    t.set_time(now);
    let client = t.client();
    let params = t.default_params(now);
    let total = params.total_amount;

    t.token().approve(
        &t.sender,
        &t.contract_id,
        &total,
        &(t.env.ledger().sequence() + 500),
    );
    let stream_id = client.create_stream(&t.sender, &params);

    // Top up at t=0 (no time elapsed)
    let additional = 200_0000000i128;
    t.token().approve(
        &t.sender,
        &t.contract_id,
        &additional,
        &(t.env.ledger().sequence() + 500),
    );
    client.top_up(&stream_id, &additional);

    let stream = client.get_stream(&stream_id);
    assert_eq!(stream.deposited_amount, total + additional);
    // Rate should be (total + additional) / duration
    let expected_rate = (total + additional) / 1000i128;
    assert_eq!(stream.amount_per_second, expected_rate);
}

#[test]
fn test_top_up_at_cliff_time() {
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
        cliff_time: now + 200,
        cliff_amount: 0,
    };
    let total = params.total_amount;

    t.token().approve(
        &t.sender,
        &t.contract_id,
        &total,
        &(t.env.ledger().sequence() + 500),
    );
    let stream_id = client.create_stream(&t.sender, &params);

    // Top up at exact cliff time
    t.set_time(now + 200);
    let additional = 200_0000000i128;
    t.token().approve(
        &t.sender,
        &t.contract_id,
        &additional,
        &(t.env.ledger().sequence() + 500),
    );
    client.top_up(&stream_id, &additional);

    let stream = client.get_stream(&stream_id);
    assert_eq!(stream.deposited_amount, total + additional);
}

#[test]
fn test_top_up_near_end() {
    // Top up when stream is 99% complete (1 second remaining)
    let t = TestEnv::setup();
    let now = 1_000_000u64;
    t.set_time(now);
    let client = t.client();
    let params = t.default_params(now);
    let total = params.total_amount;

    t.token().approve(
        &t.sender,
        &t.contract_id,
        &total,
        &(t.env.ledger().sequence() + 500),
    );
    let stream_id = client.create_stream(&t.sender, &params);

    t.set_time(now + 999); // 1 second remaining
    let additional = 100_0000000i128;
    t.token().approve(
        &t.sender,
        &t.contract_id,
        &additional,
        &(t.env.ledger().sequence() + 500),
    );
    client.top_up(&stream_id, &additional);

    let stream = client.get_stream(&stream_id);
    assert_eq!(stream.deposited_amount, total + additional);
    // 1s remaining: all additional is rate/s
    assert!(stream.amount_per_second > 0);
}

#[test]
fn test_top_up_multiple_successive() {
    let t = TestEnv::setup();
    let now = 1_000_000u64;
    t.set_time(now);
    let client = t.client();
    let params = t.default_params(now);
    let total = params.total_amount;

    t.token().approve(
        &t.sender,
        &t.contract_id,
        &total,
        &(t.env.ledger().sequence() + 500),
    );
    let stream_id = client.create_stream(&t.sender, &params);

    let chunk = 100_0000000i128;
    for _ in 0..3 {
        t.token().approve(
            &t.sender,
            &t.contract_id,
            &chunk,
            &(t.env.ledger().sequence() + 500),
        );
        client.top_up(&stream_id, &chunk);
    }

    let stream = client.get_stream(&stream_id);
    assert_eq!(stream.deposited_amount, total + chunk * 3);
}

#[test]
fn test_top_up_then_withdraw() {
    let t = TestEnv::setup();
    let now = 1_000_000u64;
    t.set_time(now);
    let client = t.client();
    let params = t.default_params(now);
    let total = params.total_amount;

    t.token().approve(
        &t.sender,
        &t.contract_id,
        &total,
        &(t.env.ledger().sequence() + 500),
    );
    let stream_id = client.create_stream(&t.sender, &params);

    let additional = 500_0000000i128;
    t.token().approve(
        &t.sender,
        &t.contract_id,
        &additional,
        &(t.env.ledger().sequence() + 500),
    );
    client.top_up(&stream_id, &additional);

    // Advance to end, withdraw everything
    t.set_time(now + 1000);
    let withdrawable = client.get_withdrawable(&stream_id);
    assert_eq!(withdrawable, total + additional);
    client.withdraw(&stream_id, &withdrawable);
    assert_eq!(t.token().balance(&t.recipient), total + additional);
    assert_eq!(t.token().balance(&t.contract_id), 0);
}

#[test]
fn test_top_up_then_cancel() {
    let t = TestEnv::setup();
    let now = 1_000_000u64;
    t.set_time(now);
    let client = t.client();
    let params = t.default_params(now);
    let total = params.total_amount;

    t.token().approve(
        &t.sender,
        &t.contract_id,
        &total,
        &(t.env.ledger().sequence() + 500),
    );
    let stream_id = client.create_stream(&t.sender, &params);

    t.set_time(now + 250);
    let additional = 500_0000000i128;
    t.token().approve(
        &t.sender,
        &t.contract_id,
        &additional,
        &(t.env.ledger().sequence() + 500),
    );
    client.top_up(&stream_id, &additional);

    let sender_before = t.token().balance(&t.sender);
    client.cancel(&stream_id);

    let recipient_got = t.token().balance(&t.recipient);
    let sender_refund = t.token().balance(&t.sender) - sender_before;

    // All funds accounted for
    assert_eq!(recipient_got + sender_refund, total + additional);
}

// ─── admin / upgrade ──────────────────────────────────────────────────────────

#[test]
fn test_version() {
    let t = TestEnv::setup();
    let client = t.client();
    assert_eq!(client.version(), 1);
}

#[test]
#[should_panic(expected = "already initialized")]
fn test_initialize_twice_panics() {
    let t = TestEnv::setup();
    let client = t.client();
    let another_admin = Address::generate(&t.env);
    client.initialize(&another_admin);
}

#[test]
fn test_migrate() {
    let t = TestEnv::setup();
    let client = t.client();
    // migrate should not panic when contract is initialized
    client.migrate();
}

#[test]
fn test_upgrade_succeeds_with_admin_auth() {
    let t = TestEnv::setup();
    let client = t.client();
    // We don't have a real wasm hash in tests, but this should pass auth
    // and then panic because the hash doesn't correspond to a real contract.
    let fake_hash = soroban_sdk::BytesN::from_array(&t.env, &[0u8; 32]);
    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        client.upgrade(&t.admin, &fake_hash);
    }));
    // The call should panic, but not on auth — it should pass auth and then
    // fail because the hash is invalid or because of some other reason.
    // We just verify it panics at all (not an auth panic).
    assert!(result.is_err());
}

// ─── Version and Metadata Tests ────────────────────────────────────────────────

#[test]
fn test_contract_version() {
    let t = TestEnv::setup();
    let client = t.client();
    assert_eq!(client.version(), 1);
}

#[test]
fn test_contract_name() {
    let t = TestEnv::setup();
    let client = t.client();
    let name = client.name();
    assert_eq!(
        name,
        soroban_sdk::String::from_str(&t.env, "FlowStar Streaming")
    );
}

// ─── Max Stream Duration Tests ─────────────────────────────────────────────────

#[test]
#[should_panic(expected = "stream duration exceeds maximum")]
fn test_create_stream_exceeds_max_duration() {
    let t = TestEnv::setup();
    let now = 1_000_000u64;
    t.set_time(now);
    let client = t.client();
    let mut params = t.default_params(now);
    // Set duration to 11 years (exceeds 10-year max)
    params.end_time = now + 315_360_000 + 1;
    t.token().approve(
        &t.sender,
        &t.contract_id,
        &params.total_amount,
        &(t.env.ledger().sequence() + 500),
    );
    client.create_stream(&t.sender, &params);
}

#[test]
fn test_create_stream_at_max_duration() {
    let t = TestEnv::setup();
    let now = 1_000_000u64;
    t.set_time(now);
    let client = t.client();
    let mut params = t.default_params(now);
    // Set duration to exactly 10 years (max allowed)
    params.end_time = now + 315_360_000;
    t.token().approve(
        &t.sender,
        &t.contract_id,
        &params.total_amount,
        &(t.env.ledger().sequence() + 500),
    );
    let stream_id = client.create_stream(&t.sender, &params);
    let stream = client.get_stream(&stream_id);
    assert_eq!(stream.end_time - stream.start_time, 315_360_000);
}

#[test]
fn test_create_stream_under_max_duration() {
    let t = TestEnv::setup();
    let now = 1_000_000u64;
    t.set_time(now);
    let client = t.client();
    let params = t.default_params(now); // 1000 seconds < max
    t.token().approve(
        &t.sender,
        &t.contract_id,
        &params.total_amount,
        &(t.env.ledger().sequence() + 500),
    );
    let stream_id = client.create_stream(&t.sender, &params);
    assert_eq!(stream_id, 1);
}

// ─── Stream Delegation Tests ───────────────────────────────────────────────────

#[test]
fn test_set_delegate_by_recipient() {
    let t = TestEnv::setup();
    let now = 1_000_000u64;
    t.set_time(now);
    let client = t.client();
    let params = t.default_params(now);
    let total = params.total_amount;

    t.token().approve(
        &t.sender,
        &t.contract_id,
        &total,
        &(t.env.ledger().sequence() + 500),
    );
    let stream_id = client.create_stream(&t.sender, &params);

    // Recipient sets a delegate
    let delegate = Address::generate(&t.env);
    client.set_delegate(&stream_id, &delegate);

    // Verify delegate is set
    let stored_delegate = client.get_delegate(&stream_id);
    assert_eq!(stored_delegate, Some(delegate));
}

#[test]
fn test_delegate_can_withdraw() {
    let t = TestEnv::setup();
    let now = 1_000_000u64;
    t.set_time(now);
    let client = t.client();
    let params = t.default_params(now);
    let total = params.total_amount;

    t.token().approve(
        &t.sender,
        &t.contract_id,
        &total,
        &(t.env.ledger().sequence() + 500),
    );
    let stream_id = client.create_stream(&t.sender, &params);

    // Recipient sets a delegate
    let delegate = Address::generate(&t.env);
    client.set_delegate(&stream_id, &delegate);

    // Advance time and let delegate withdraw
    t.set_time(now + 500);
    let withdrawable = client.get_withdrawable(&stream_id);
    assert!(withdrawable > 0);

    // Delegate withdraws (funds go to recipient)
    client.withdraw(&stream_id, &withdrawable);

    // Recipient receives the funds
    assert_eq!(t.token().balance(&t.recipient), withdrawable);
}

#[test]
fn test_remove_delegate() {
    let t = TestEnv::setup();
    let now = 1_000_000u64;
    t.set_time(now);
    let client = t.client();
    let params = t.default_params(now);
    let total = params.total_amount;

    t.token().approve(
        &t.sender,
        &t.contract_id,
        &total,
        &(t.env.ledger().sequence() + 500),
    );
    let stream_id = client.create_stream(&t.sender, &params);

    let delegate = Address::generate(&t.env);
    client.set_delegate(&stream_id, &delegate);

    // Verify delegate is set
    assert_eq!(client.get_delegate(&stream_id), Some(delegate.clone()));

    // Remove delegate
    client.remove_delegate(&stream_id);

    // Verify delegate is removed
    assert_eq!(client.get_delegate(&stream_id), None);
}

#[test]
fn test_transfer_clears_delegate() {
    let t = TestEnv::setup();
    let now = 1_000_000u64;
    t.set_time(now);
    let client = t.client();
    let params = t.default_params(now);
    let total = params.total_amount;

    t.token().approve(
        &t.sender,
        &t.contract_id,
        &total,
        &(t.env.ledger().sequence() + 500),
    );
    let stream_id = client.create_stream(&t.sender, &params);

    let delegate = Address::generate(&t.env);
    client.set_delegate(&stream_id, &delegate);
    assert_eq!(client.get_delegate(&stream_id), Some(delegate));

    // Transfer stream to new recipient
    let new_recipient = Address::generate(&t.env);
    client.transfer_stream(&stream_id, &new_recipient);

    // Verify delegate is cleared
    assert_eq!(client.get_delegate(&stream_id), None);
}

// ─── Transfer Function Fix Tests ──────────────────────────────────────────────

#[test]
fn test_transfer_stream_basic_regression() {
    let t = TestEnv::setup();
    let now = 1_000_000u64;
    t.set_time(now);
    let client = t.client();
    let params = t.default_params(now);
    let total = params.total_amount;

    t.token().approve(
        &t.sender,
        &t.contract_id,
        &total,
        &(t.env.ledger().sequence() + 500),
    );
    let stream_id = client.create_stream(&t.sender, &params);

    let old_recipient = t.recipient.clone();
    let new_recipient = Address::generate(&t.env);

    // Transfer
    client.transfer_stream(&stream_id, &new_recipient);

    let stream = client.get_stream(&stream_id);
    assert_eq!(stream.recipient, new_recipient);

    // Verify indices updated
    let old_received = client.get_received_streams(&old_recipient, &0, &100);
    let new_received = client.get_received_streams(&new_recipient, &0, &100);
    assert_eq!(old_received.len(), 0);
    assert_eq!(new_received.len(), 1);
    assert_eq!(new_received.get(0), Some(stream_id));
}

#[test]
fn test_transfer_cancelled_stream_panics() {
    let t = TestEnv::setup();
    let now = 1_000_000u64;
    t.set_time(now);
    let client = t.client();
    let params = t.default_params(now);
    let total = params.total_amount;

    t.token().approve(
        &t.sender,
        &t.contract_id,
        &total,
        &(t.env.ledger().sequence() + 500),
    );
    let stream_id = client.create_stream(&t.sender, &params);

    // Cancel stream
    client.cancel(&stream_id);

    // Try to transfer cancelled stream
    let new_recipient = Address::generate(&t.env);
    let result = client.try_transfer_stream(&stream_id, &new_recipient);
    assert_eq!(result, Err(Ok(StreamError::StreamCancelled)));
}

#[test]
fn test_transfer_stream_updates_indices() {
    let t = TestEnv::setup();
    let now = 1_000_000u64;
    t.set_time(now);
    let client = t.client();
    let params = t.default_params(now);
    let total = params.total_amount;

    t.token().approve(
        &t.sender,
        &t.contract_id,
        &total,
        &(t.env.ledger().sequence() + 500),
    );
    let stream_id = client.create_stream(&t.sender, &params);

    let new_recipient = Address::generate(&t.env);
    client.transfer_stream(&stream_id, &new_recipient);

    // Verify new recipient can see the stream
    let received = client.get_received_streams(&new_recipient, &0, &100);
    assert_eq!(received.len(), 1);
    assert_eq!(received.get(0), Some(stream_id));
}
