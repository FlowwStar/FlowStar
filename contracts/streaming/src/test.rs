//! Core contract tests (create, withdraw, cancel, partial_cancel, top_up,
//! transfer, bump, cleanup, pagination).

#![cfg(test)]

extern crate std;

use soroban_sdk::{
    testutils::{Address as _, Ledger},
    Address, Env,
};

use crate::{CreateStreamParams, StreamError, StreamingContract, StreamingContractClient};

// ─── Shared test harness ──────────────────────────────────────────────────────

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

        // Deploy a minimal SAC-compatible token for testing.
        let token_admin = Address::generate(&env);
        let token_id = env.register_stellar_asset_contract_v2(token_admin.clone())
            .address();

        let sender = Address::generate(&env);
        let recipient = Address::generate(&env);
        let admin = Address::generate(&env);

        // Mint 1_000_000 tokens to sender.
        soroban_sdk::token::StellarAssetClient::new(&env, &token_id)
            .mint(&sender, &1_000_000_0000000i128);

        let contract_id = env.register_contract(None, StreamingContract);
        StreamingContractClient::new(&env, &contract_id)
            .initialize(&admin)
            .unwrap();

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

    fn token(&self) -> soroban_sdk::token::TokenClient<'_> {
        soroban_sdk::token::TokenClient::new(&self.env, &self.token_id)
    }

    fn set_time(&self, timestamp: u64) {
        self.env.ledger().with_mut(|l| l.timestamp = timestamp);
    }

    fn default_params(&self, now: u64) -> CreateStreamParams {
        CreateStreamParams {
            recipient: self.recipient.clone(),
            token: self.token_id.clone(),
            total_amount: 1_000_0000000,
            start_time: now,
            end_time: now + 1000,
            cliff_time: now,
            cliff_amount: 0,
        }
    }
}

// ─── create_stream ────────────────────────────────────────────────────────────

#[test]
fn test_create_stream_basic() {
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

    let stream_id = client.create_stream(&t.sender, &params).unwrap();
    assert_eq!(stream_id, 1);

    let stream = client.get_stream(&stream_id).unwrap();
    assert_eq!(stream.sender, t.sender);
    assert_eq!(stream.recipient, t.recipient);
    assert_eq!(stream.deposited_amount, total);
    assert_eq!(stream.withdrawn_amount, 0);
    assert!(!stream.cancelled);

    assert_eq!(t.token().balance(&t.contract_id), total);
    assert_eq!(t.token().balance(&t.sender), 1_000_000_0000000 - total);
}

#[test]
fn test_create_stream_with_cliff() {
    let t = TestEnv::setup();
    let now = 1_000_000u64;
    t.set_time(now);
    let client = t.client();
    let cliff_amount = 100_0000000i128;
    let params = CreateStreamParams {
        recipient: t.recipient.clone(),
        token: t.token_id.clone(),
        total_amount: 1_000_0000000,
        start_time: now,
        end_time: now + 1000,
        cliff_time: now + 200,
        cliff_amount,
    };

    t.token().approve(
        &t.sender,
        &t.contract_id,
        &params.total_amount,
        &(t.env.ledger().sequence() + 500),
    );

    let stream_id = client.create_stream(&t.sender, &params).unwrap();
    let stream = client.get_stream(&stream_id).unwrap();
    assert_eq!(stream.cliff_amount, cliff_amount);
    assert_eq!(client.get_withdrawable(&stream_id).unwrap(), 0);
}

#[test]
fn test_create_stream_invalid_times() {
    let t = TestEnv::setup();
    let now = 1_000_000u64;
    t.set_time(now);
    let mut params = t.default_params(now);
    params.end_time = params.start_time;

    t.token().approve(
        &t.sender,
        &t.contract_id,
        &params.total_amount,
        &(t.env.ledger().sequence() + 500),
    );

    let result = t.client().try_create_stream(&t.sender, &params);
    assert_eq!(result, Err(Ok(StreamError::InvalidTimeRange)));
}

#[test]
fn test_create_stream_zero_amount() {
    let t = TestEnv::setup();
    let now = 1_000_000u64;
    t.set_time(now);
    let mut params = t.default_params(now);
    params.total_amount = 0;

    t.token().approve(
        &t.sender,
        &t.contract_id,
        &1i128,
        &(t.env.ledger().sequence() + 500),
    );

    let result = t.client().try_create_stream(&t.sender, &params);
    assert_eq!(result, Err(Ok(StreamError::InvalidAmount)));
}

#[test]
fn test_create_stream_rejects_past_start_time() {
    let t = TestEnv::setup();
    let now = 1_000_000u64;
    t.set_time(now);
    let mut params = t.default_params(now);
    params.start_time = now - 1000;
    params.cliff_time = now - 1000;

    t.token().approve(
        &t.sender,
        &t.contract_id,
        &params.total_amount,
        &(t.env.ledger().sequence() + 500),
    );

    let result = t.client().try_create_stream(&t.sender, &params);
    assert_eq!(result, Err(Ok(StreamError::PastStartTime)));
    assert_eq!(t.token().balance(&t.contract_id), 0);
}

#[test]
fn test_create_stream_rejects_backdated_cliff() {
    let t = TestEnv::setup();
    let now = 1_000_000u64;
    t.set_time(now);
    let mut params = t.default_params(now);
    params.cliff_time = params.start_time - 1;

    t.token().approve(
        &t.sender,
        &t.contract_id,
        &params.total_amount,
        &(t.env.ledger().sequence() + 500),
    );

    let result = t.client().try_create_stream(&t.sender, &params);
    assert_eq!(result, Err(Ok(StreamError::InvalidCliff)));
}

// ─── pagination ───────────────────────────────────────────────────────────────

#[test]
fn test_pagination_clamps_large_offset_limit() {
    let t = TestEnv::setup();
    let now = 1_000_000u64;
    t.set_time(now);
    let client = t.client();
    let per_stream = 1_000_0000000i128;

    t.token().approve(
        &t.sender,
        &t.contract_id,
        &(per_stream * 5),
        &(t.env.ledger().sequence() + 500),
    );

    for _ in 0..5 {
        client.create_stream(&t.sender, &t.default_params(now)).unwrap();
    }

    let tail = client.get_sent_streams(&t.sender, &2u32, &u32::MAX);
    assert_eq!(tail.len(), 3);
    assert_eq!(tail.get(0).unwrap(), 3u64);

    let empty = client.get_sent_streams(&t.sender, &u32::MAX, &u32::MAX);
    assert_eq!(empty.len(), 0);

    let all = client.get_sent_streams(&t.sender, &0u32, &u32::MAX);
    assert_eq!(all.len(), 5);
}

// ─── withdraw ─────────────────────────────────────────────────────────────────

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

    let stream_id = client.create_stream(&t.sender, &params).unwrap();
    t.set_time(now + 500);
    let withdrawable = client.get_withdrawable(&stream_id).unwrap();
    assert!(withdrawable > 0);
    assert!(withdrawable <= total / 2 + 1);

    client.withdraw(&stream_id, &withdrawable).unwrap();
    let stream = client.get_stream(&stream_id).unwrap();
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

    let stream_id = client.create_stream(&t.sender, &params).unwrap();
    t.set_time(now + 2000);
    let withdrawable = client.get_withdrawable(&stream_id).unwrap();
    assert_eq!(withdrawable, total);

    client.withdraw(&stream_id, &total).unwrap();
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

    let stream_id = client.create_stream(&t.sender, &params).unwrap();
    t.set_time(now + 500);

    let result = client.try_withdraw(&stream_id, &total);
    assert_eq!(result, Err(Ok(StreamError::InsufficientFunds)));
}

// ─── cancel ───────────────────────────────────────────────────────────────────

#[test]
fn test_cancel_mid_stream() {
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

    let stream_id = client.create_stream(&t.sender, &params).unwrap();
    t.set_time(now + 500);

    client.cancel(&stream_id).unwrap();

    let stream = client.get_stream(&stream_id).unwrap();
    assert!(stream.cancelled);

    // Recipient gets ~half, sender gets ~half back.
    let recipient_bal = t.token().balance(&t.recipient);
    let sender_bal = t.token().balance(&t.sender);
    assert!(recipient_bal > 0);
    assert!(sender_bal > 1_000_000_0000000 - total); // got some back
}

// ─── initialize guard ─────────────────────────────────────────────────────────

#[test]
fn test_double_initialize_fails() {
    let t = TestEnv::setup();
    let result = t.client().try_initialize(&t.admin);
    assert_eq!(result, Err(Ok(StreamError::AlreadyInitialized)));
}
