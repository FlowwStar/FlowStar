//! Tests for `create_streams_batch`.

#![cfg(test)]

extern crate std;

use soroban_sdk::{
    testutils::{Address as _, Ledger},
    vec, Address, Env, Vec,
};

use crate::{CreateStreamParams, StreamError, StreamingContract, StreamingContractClient};

struct BatchEnv {
    env: Env,
    contract_id: Address,
    token_id: Address,
    sender: Address,
    recipient: Address,
}

impl BatchEnv {
    fn setup() -> Self {
        let env = Env::default();
        env.mock_all_auths();

        let token_admin = Address::generate(&env);
        let token_id = env
            .register_stellar_asset_contract_v2(token_admin.clone())
            .address();

        soroban_sdk::token::StellarAssetClient::new(&env, &token_id)
            .mint(&Address::generate(&env), &0); // prime the contract

        let sender = Address::generate(&env);
        soroban_sdk::token::StellarAssetClient::new(&env, &token_id)
            .mint(&sender, &1_000_000_0000000i128);

        let recipient = Address::generate(&env);
        let admin = Address::generate(&env);

        let contract_id = env.register_contract(None, StreamingContract);
        StreamingContractClient::new(&env, &contract_id)
            .initialize(&admin)
            .unwrap();

        BatchEnv {
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

    fn token(&self) -> soroban_sdk::token::TokenClient<'_> {
        soroban_sdk::token::TokenClient::new(&self.env, &self.token_id)
    }

    fn set_time(&self, ts: u64) {
        self.env.ledger().with_mut(|l| l.timestamp = ts);
    }

    fn stream_params(&self, now: u64) -> CreateStreamParams {
        CreateStreamParams {
            recipient: self.recipient.clone(),
            token: self.token_id.clone(),
            total_amount: 100_0000000,
            start_time: now,
            end_time: now + 1000,
            cliff_time: now,
            cliff_amount: 0,
        }
    }
}

#[test]
fn test_batch_creates_multiple_streams() {
    let b = BatchEnv::setup();
    let now = 2_000_000u64;
    b.set_time(now);

    let per = 100_0000000i128;
    b.token().approve(
        &b.sender,
        &b.contract_id,
        &(per * 3),
        &(b.env.ledger().sequence() + 500),
    );

    let streams = vec![
        &b.env,
        b.stream_params(now),
        b.stream_params(now),
        b.stream_params(now),
    ];

    let ids = b.client().create_streams_batch(&b.sender, &streams).unwrap();
    assert_eq!(ids.len(), 3);
    assert_eq!(b.token().balance(&b.contract_id), per * 3);
}

#[test]
fn test_batch_empty_fails() {
    let b = BatchEnv::setup();
    b.set_time(1_000_000);

    let empty: Vec<CreateStreamParams> = Vec::new(&b.env);
    let err = b
        .client()
        .try_create_streams_batch(&b.sender, &empty)
        .unwrap_err()
        .unwrap();
    assert_eq!(err, StreamError::BatchEmpty);
}

#[test]
fn test_batch_one_invalid_rejects_whole_batch() {
    let b = BatchEnv::setup();
    let now = 2_000_000u64;
    b.set_time(now);

    let mut bad = b.stream_params(now);
    bad.total_amount = 0; // invalid

    let streams = vec![&b.env, b.stream_params(now), bad];

    let err = b
        .client()
        .try_create_streams_batch(&b.sender, &streams)
        .unwrap_err()
        .unwrap();
    assert_eq!(err, StreamError::InvalidAmount);
    // No funds should have moved.
    assert_eq!(b.token().balance(&b.contract_id), 0);
}

#[test]
fn test_batch_blocked_when_paused() {
    let b = BatchEnv::setup();
    let now = 2_000_000u64;
    b.set_time(now);
    b.client().pause().unwrap();

    let per = 100_0000000i128;
    b.token().approve(
        &b.sender,
        &b.contract_id,
        &(per * 2),
        &(b.env.ledger().sequence() + 500),
    );
    let sender_balance_before = b.token().balance(&b.sender);

    let streams = vec![&b.env, b.stream_params(now), b.stream_params(now)];

    let err = b
        .client()
        .try_create_streams_batch(&b.sender, &streams)
        .unwrap_err()
        .unwrap();
    assert_eq!(err, StreamError::ContractPaused);
    // No funds should have moved.
    assert_eq!(b.token().balance(&b.contract_id), 0);
    assert_eq!(b.token().balance(&b.sender), sender_balance_before);
}
