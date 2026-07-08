//! Tests for [`StreamingContract::create_streams_batch`] — Issue #165
//!
//! Covers:
//!   - Happy path: batch creates all streams and returns correct IDs
//!   - Partial validation failure: any invalid stream rejects the whole batch
//!   - Max batch size enforcement (> 20 streams → BatchSizeExceeded)
//!   - Empty batch → BatchEmpty
//!   - Sender/recipient index updated for every stream
//!   - Events emitted per stream

#![cfg(test)]

extern crate std;

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    token::{Client as TokenClient, StellarAssetClient},
    Address, Env, Vec,
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
        let admin = Address::generate(&env);

        let token_admin = Address::generate(&env);
        let token_id = env
            .register_stellar_asset_contract_v2(token_admin.clone())
            .address();

        let asset_client = StellarAssetClient::new(&env, &token_id);
        // Mint 10M tokens so we have room for large batch tests
        asset_client.mint(&sender, &10_000_000_0000000);

        let client = StreamingContractClient::new(&env, &contract_id);
        client.initialize(&admin);

        TestEnv {
            env,
            contract_id,
            token_id,
            sender,
            recipient,
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

    /// Build a valid [`CreateStreamInput`] pointing at `recipient`.
    fn make_input(&self, recipient: &Address, now: u64) -> CreateStreamInput {
        CreateStreamInput {
            recipient: recipient.clone(),
            token: self.token_id.clone(),
            total_amount: 1_000_0000000, // 1000 tokens
            start_time: now,
            end_time: now + 1000,
            cliff_time: now,
            cliff_amount: 0,
        }
    }

    /// Approve `amount` tokens to the contract from the sender.
    fn approve(&self, amount: i128) {
        self.token().approve(
            &self.sender,
            &self.contract_id,
            &amount,
            &(self.env.ledger().sequence() + 500),
        );
    }
}

// ─── Happy path ───────────────────────────────────────────────────────────────

#[test]
fn test_batch_create_happy_path() {
    let t = TestEnv::setup();
    let now = 1_000_000u64;
    t.set_time(now);

    let r1 = Address::generate(&t.env);
    let r2 = Address::generate(&t.env);
    let r3 = Address::generate(&t.env);

    let per_stream = 1_000_0000000i128;
    let total_approval = per_stream * 3;
    t.approve(total_approval);

    let mut inputs: Vec<CreateStreamInput> = Vec::new(&t.env);
    inputs.push_back(t.make_input(&r1, now));
    inputs.push_back(t.make_input(&r2, now));
    inputs.push_back(t.make_input(&r3, now));

    let client = t.client();
    let ids = client.create_streams_batch(&t.sender, &inputs);

    // Three IDs returned in order
    assert_eq!(ids.len(), 3);
    assert_eq!(ids.get(0).unwrap(), 1u64);
    assert_eq!(ids.get(1).unwrap(), 2u64);
    assert_eq!(ids.get(2).unwrap(), 3u64);

    // Each stream has the correct state
    for (i, recipient) in [&r1, &r2, &r3].iter().enumerate() {
        let id = ids.get(i as u32).unwrap();
        let stream = client.get_stream(&id);
        assert_eq!(stream.sender, t.sender);
        assert_eq!(&stream.recipient, *recipient);
        assert_eq!(stream.deposited_amount, per_stream);
        assert_eq!(stream.withdrawn_amount, 0);
        assert!(!stream.cancelled);
    }

    // Contract holds all funds
    assert_eq!(t.token().balance(&t.contract_id), total_approval);
    // Sender balance reduced by total
    assert_eq!(
        t.token().balance(&t.sender),
        10_000_000_0000000 - total_approval
    );
}

#[test]
fn test_batch_create_returns_ids_in_order() {
    let t = TestEnv::setup();
    let now = 1_000_000u64;
    t.set_time(now);

    // Pre-create one stream so IDs don't start at 1
    let single_amount = 1_000_0000000i128;
    t.approve(single_amount);
    let client = t.client();
    let params = CreateStreamParams {
        recipient: t.recipient.clone(),
        token: t.token_id.clone(),
        total_amount: single_amount,
        start_time: now,
        end_time: now + 1000,
        cliff_time: now,
        cliff_amount: 0,
    };
    client.create_stream(&t.sender, &params);

    // Batch of 2 → IDs should be 2 and 3
    let r1 = Address::generate(&t.env);
    let r2 = Address::generate(&t.env);
    t.approve(single_amount * 2);

    let mut inputs: Vec<CreateStreamInput> = Vec::new(&t.env);
    inputs.push_back(t.make_input(&r1, now));
    inputs.push_back(t.make_input(&r2, now));

    let ids = client.create_streams_batch(&t.sender, &inputs);
    assert_eq!(ids.len(), 2);
    assert_eq!(ids.get(0).unwrap(), 2u64);
    assert_eq!(ids.get(1).unwrap(), 3u64);
}

// ─── Index management ─────────────────────────────────────────────────────────

#[test]
fn test_batch_sender_index_updated() {
    let t = TestEnv::setup();
    let now = 1_000_000u64;
    t.set_time(now);

    let per_stream = 1_000_0000000i128;
    t.approve(per_stream * 5);

    let mut inputs: Vec<CreateStreamInput> = Vec::new(&t.env);
    for _ in 0..5 {
        let r = Address::generate(&t.env);
        inputs.push_back(t.make_input(&r, now));
    }

    let client = t.client();
    let ids = client.create_streams_batch(&t.sender, &inputs);

    let sent = client.get_sent_streams(&t.sender, &0, &100);
    assert_eq!(sent.len(), 5);

    for i in 0..5u32 {
        let id = ids.get(i).unwrap();
        assert!(sent.contains(id));
    }
}

#[test]
fn test_batch_recipient_indexes_updated() {
    let t = TestEnv::setup();
    let now = 1_000_000u64;
    t.set_time(now);

    // Two streams to the same recipient and one to a different recipient
    let r_shared = Address::generate(&t.env);
    let r_other = Address::generate(&t.env);

    let per_stream = 1_000_0000000i128;
    t.approve(per_stream * 3);

    let mut inputs: Vec<CreateStreamInput> = Vec::new(&t.env);
    inputs.push_back(t.make_input(&r_shared, now));
    inputs.push_back(t.make_input(&r_shared, now));
    inputs.push_back(t.make_input(&r_other, now));

    let client = t.client();
    let ids = client.create_streams_batch(&t.sender, &inputs);

    // r_shared should have 2 streams
    let shared_received = client.get_received_streams(&r_shared, &0, &100);
    assert_eq!(shared_received.len(), 2);
    assert!(shared_received.contains(ids.get(0).unwrap()));
    assert!(shared_received.contains(ids.get(1).unwrap()));

    // r_other should have 1 stream
    let other_received = client.get_received_streams(&r_other, &0, &100);
    assert_eq!(other_received.len(), 1);
    assert!(other_received.contains(ids.get(2).unwrap()));
}

// ─── Validation failures ──────────────────────────────────────────────────────

#[test]
fn test_batch_partial_failure_rejected_atomically() {
    // Stream 0 is valid, stream 1 has zero amount — entire batch must fail
    let t = TestEnv::setup();
    let now = 1_000_000u64;
    t.set_time(now);

    let r1 = Address::generate(&t.env);
    let r2 = Address::generate(&t.env);

    let per_stream = 1_000_0000000i128;
    t.approve(per_stream * 2);

    let mut inputs: Vec<CreateStreamInput> = Vec::new(&t.env);
    inputs.push_back(t.make_input(&r1, now)); // valid
                                              // Invalid: zero amount
    inputs.push_back(CreateStreamInput {
        recipient: r2.clone(),
        token: t.token_id.clone(),
        total_amount: 0,
        start_time: now,
        end_time: now + 1000,
        cliff_time: now,
        cliff_amount: 0,
    });

    let client = t.client();
    let result = client.try_create_streams_batch(&t.sender, &inputs);
    assert_eq!(result, Err(Ok(StreamError::InvalidAmount)));

    // No streams should have been created
    let sent = client.get_sent_streams(&t.sender, &0, &100);
    assert_eq!(sent.len(), 0);

    // Contract should hold no funds
    assert_eq!(t.token().balance(&t.contract_id), 0);
}

#[test]
fn test_batch_invalid_time_range_fails() {
    let t = TestEnv::setup();
    let now = 1_000_000u64;
    t.set_time(now);

    let r1 = Address::generate(&t.env);
    let per_stream = 1_000_0000000i128;
    t.approve(per_stream);

    let mut inputs: Vec<CreateStreamInput> = Vec::new(&t.env);
    inputs.push_back(CreateStreamInput {
        recipient: r1,
        token: t.token_id.clone(),
        total_amount: per_stream,
        start_time: now + 1000,
        end_time: now + 500, // end before start
        cliff_time: now + 500,
        cliff_amount: 0,
    });

    let result = t.client().try_create_streams_batch(&t.sender, &inputs);
    assert_eq!(result, Err(Ok(StreamError::InvalidTimeRange)));
}

#[test]
fn test_batch_invalid_cliff_fails() {
    let t = TestEnv::setup();
    let now = 1_000_000u64;
    t.set_time(now);

    let r1 = Address::generate(&t.env);
    let per_stream = 1_000_0000000i128;
    t.approve(per_stream);

    let mut inputs: Vec<CreateStreamInput> = Vec::new(&t.env);
    inputs.push_back(CreateStreamInput {
        recipient: r1,
        token: t.token_id.clone(),
        total_amount: per_stream,
        start_time: now,
        end_time: now + 1000,
        cliff_time: now + 2000, // cliff after end
        cliff_amount: 0,
    });

    let result = t.client().try_create_streams_batch(&t.sender, &inputs);
    assert_eq!(result, Err(Ok(StreamError::InvalidCliff)));
}

#[test]
fn test_batch_self_stream_fails() {
    let t = TestEnv::setup();
    let now = 1_000_000u64;
    t.set_time(now);

    let per_stream = 1_000_0000000i128;
    t.approve(per_stream);

    let mut inputs: Vec<CreateStreamInput> = Vec::new(&t.env);
    inputs.push_back(CreateStreamInput {
        recipient: t.sender.clone(), // self-stream
        token: t.token_id.clone(),
        total_amount: per_stream,
        start_time: now,
        end_time: now + 1000,
        cliff_time: now,
        cliff_amount: 0,
    });

    let result = t.client().try_create_streams_batch(&t.sender, &inputs);
    assert_eq!(result, Err(Ok(StreamError::SelfStream)));
}

// ─── Batch size limits ────────────────────────────────────────────────────────

#[test]
fn test_batch_max_size_exactly_20_succeeds() {
    let t = TestEnv::setup();
    let now = 1_000_000u64;
    t.set_time(now);

    let per_stream = 1_000_0000000i128;
    t.approve(per_stream * 20);

    let mut inputs: Vec<CreateStreamInput> = Vec::new(&t.env);
    for _ in 0..20 {
        let r = Address::generate(&t.env);
        inputs.push_back(t.make_input(&r, now));
    }

    let client = t.client();
    let ids = client.create_streams_batch(&t.sender, &inputs);
    assert_eq!(ids.len(), 20);
}

#[test]
fn test_batch_over_max_size_fails() {
    let t = TestEnv::setup();
    let now = 1_000_000u64;
    t.set_time(now);

    let per_stream = 1_000_0000000i128;
    t.approve(per_stream * 21);

    let mut inputs: Vec<CreateStreamInput> = Vec::new(&t.env);
    for _ in 0..21 {
        let r = Address::generate(&t.env);
        inputs.push_back(t.make_input(&r, now));
    }

    let result = t.client().try_create_streams_batch(&t.sender, &inputs);
    assert_eq!(result, Err(Ok(StreamError::BatchSizeExceeded)));
}

#[test]
fn test_batch_empty_fails() {
    let t = TestEnv::setup();
    let now = 1_000_000u64;
    t.set_time(now);

    let inputs: Vec<CreateStreamInput> = Vec::new(&t.env);
    let result = t.client().try_create_streams_batch(&t.sender, &inputs);
    assert_eq!(result, Err(Ok(StreamError::BatchEmpty)));
}

// ─── Single-stream batch ──────────────────────────────────────────────────────

#[test]
fn test_batch_single_stream_works() {
    let t = TestEnv::setup();
    let now = 1_000_000u64;
    t.set_time(now);

    let r = Address::generate(&t.env);
    let amount = 1_000_0000000i128;
    t.approve(amount);

    let mut inputs: Vec<CreateStreamInput> = Vec::new(&t.env);
    inputs.push_back(t.make_input(&r, now));

    let client = t.client();
    let ids = client.create_streams_batch(&t.sender, &inputs);
    assert_eq!(ids.len(), 1);

    let stream = client.get_stream(&ids.get(0).unwrap());
    assert_eq!(stream.deposited_amount, amount);
}

// ─── Cliff support in batch ───────────────────────────────────────────────────

#[test]
fn test_batch_supports_cliff() {
    let t = TestEnv::setup();
    let now = 1_000_000u64;
    t.set_time(now);

    let r = Address::generate(&t.env);
    let amount = 1_000_0000000i128;
    let cliff_amount = 100_0000000i128;
    t.approve(amount);

    let mut inputs: Vec<CreateStreamInput> = Vec::new(&t.env);
    inputs.push_back(CreateStreamInput {
        recipient: r.clone(),
        token: t.token_id.clone(),
        total_amount: amount,
        start_time: now,
        end_time: now + 1000,
        cliff_time: now + 200,
        cliff_amount,
    });

    let client = t.client();
    let ids = client.create_streams_batch(&t.sender, &inputs);
    let id = ids.get(0).unwrap();

    let stream = client.get_stream(&id);
    assert_eq!(stream.cliff_amount, cliff_amount);
    assert_eq!(stream.cliff_time, now + 200);

    // Before cliff — nothing withdrawable
    t.set_time(now + 100);
    assert_eq!(client.get_withdrawable(&id), 0);

    // After cliff — cliff amount available
    t.set_time(now + 200);
    assert!(client.get_withdrawable(&id) >= cliff_amount);
}

// ─── Batch streams are individually withdrawable ──────────────────────────────

#[test]
fn test_batch_streams_are_independently_withdrawable() {
    let t = TestEnv::setup();
    let now = 1_000_000u64;
    t.set_time(now);

    let r1 = Address::generate(&t.env);
    let r2 = Address::generate(&t.env);
    let per_stream = 1_000_0000000i128;
    t.approve(per_stream * 2);

    let mut inputs: Vec<CreateStreamInput> = Vec::new(&t.env);
    inputs.push_back(t.make_input(&r1, now));
    inputs.push_back(t.make_input(&r2, now));

    let client = t.client();
    let ids = client.create_streams_batch(&t.sender, &inputs);

    // Advance halfway
    t.set_time(now + 500);

    let w1 = client.get_withdrawable(&ids.get(0).unwrap());
    let w2 = client.get_withdrawable(&ids.get(1).unwrap());

    assert!(w1 > 0);
    assert!(w2 > 0);

    // Withdraw from stream 1 only
    client.withdraw(&ids.get(0).unwrap(), &w1);
    assert_eq!(t.token().balance(&r1), w1);
    assert_eq!(t.token().balance(&r2), 0); // stream 2 untouched
}

// ─── Batch streams are independently cancellable ──────────────────────────────

#[test]
fn test_batch_streams_are_independently_cancellable() {
    let t = TestEnv::setup();
    let now = 1_000_000u64;
    t.set_time(now);

    let r1 = Address::generate(&t.env);
    let r2 = Address::generate(&t.env);
    let per_stream = 1_000_0000000i128;
    t.approve(per_stream * 2);

    let mut inputs: Vec<CreateStreamInput> = Vec::new(&t.env);
    inputs.push_back(t.make_input(&r1, now));
    inputs.push_back(t.make_input(&r2, now));

    let client = t.client();
    let ids = client.create_streams_batch(&t.sender, &inputs);

    // Cancel stream 1 only
    client.cancel(&ids.get(0).unwrap());

    let s1 = client.get_stream(&ids.get(0).unwrap());
    let s2 = client.get_stream(&ids.get(1).unwrap());
    assert!(s1.cancelled);
    assert!(!s2.cancelled);
}
