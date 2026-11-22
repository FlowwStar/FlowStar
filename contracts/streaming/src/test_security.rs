//! Security-focused tests: auth enforcement, pause gate, edge cases.

#![cfg(test)]

extern crate std;

use soroban_sdk::{
    testutils::{Address as _, Ledger},
    Address, Env,
};

use crate::{CreateStreamParams, StreamError, StreamingContract, StreamingContractClient};

struct SecEnv {
    env: Env,
    contract_id: Address,
    token_id: Address,
    sender: Address,
    recipient: Address,
    admin: Address,
}

impl SecEnv {
    fn setup() -> Self {
        let env = Env::default();
        env.mock_all_auths();

        let token_admin = Address::generate(&env);
        let token_id = env
            .register_stellar_asset_contract_v2(token_admin.clone())
            .address();

        let sender = Address::generate(&env);
        soroban_sdk::token::StellarAssetClient::new(&env, &token_id)
            .mint(&sender, &1_000_000_0000000i128);

        let recipient = Address::generate(&env);
        let admin = Address::generate(&env);

        let contract_id = env.register_contract(None, StreamingContract);
        StreamingContractClient::new(&env, &contract_id)
            .initialize(&admin)
            .unwrap();

        SecEnv {
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

    fn set_time(&self, ts: u64) {
        self.env.ledger().with_mut(|l| l.timestamp = ts);
    }

    fn create_default_stream(&self, now: u64) -> u64 {
        let total = 1_000_0000000i128;
        self.token().approve(
            &self.sender,
            &self.contract_id,
            &total,
            &(self.env.ledger().sequence() + 500),
        );
        self.client()
            .create_stream(
                &self.sender,
                &CreateStreamParams {
                    recipient: self.recipient.clone(),
                    token: self.token_id.clone(),
                    total_amount: total,
                    start_time: now,
                    end_time: now + 1000,
                    cliff_time: now,
                    cliff_amount: 0,
                },
            )
            .unwrap()
    }
}

// ─── Pause gate ───────────────────────────────────────────────────────────────

#[test]
fn test_create_stream_blocked_when_paused() {
    let s = SecEnv::setup();
    let now = 1_000_000u64;
    s.set_time(now);
    s.client().pause().unwrap();

    let total = 100_0000000i128;
    s.token().approve(
        &s.sender,
        &s.contract_id,
        &total,
        &(s.env.ledger().sequence() + 500),
    );

    let err = s
        .client()
        .try_create_stream(
            &s.sender,
            &CreateStreamParams {
                recipient: s.recipient.clone(),
                token: s.token_id.clone(),
                total_amount: total,
                start_time: now,
                end_time: now + 1000,
                cliff_time: now,
                cliff_amount: 0,
            },
        )
        .unwrap_err()
        .unwrap();
    assert_eq!(err, StreamError::ContractPaused);
}

#[test]
fn test_withdraw_blocked_when_paused() {
    let s = SecEnv::setup();
    let now = 1_000_000u64;
    s.set_time(now);
    let id = s.create_default_stream(now);
    s.set_time(now + 500);
    s.client().pause().unwrap();

    let err = s
        .client()
        .try_withdraw(&id, &1_0000000i128)
        .unwrap_err()
        .unwrap();
    assert_eq!(err, StreamError::ContractPaused);
}

#[test]
fn test_cancel_blocked_when_paused() {
    let s = SecEnv::setup();
    let now = 1_000_000u64;
    s.set_time(now);
    let id = s.create_default_stream(now);
    s.client().pause().unwrap();

    let err = s.client().try_cancel(&id).unwrap_err().unwrap();
    assert_eq!(err, StreamError::ContractPaused);
}

// ─── Self-stream guard ────────────────────────────────────────────────────────

#[test]
fn test_self_stream_rejected() {
    let s = SecEnv::setup();
    let now = 1_000_000u64;
    s.set_time(now);

    let total = 100_0000000i128;
    s.token().approve(
        &s.sender,
        &s.contract_id,
        &total,
        &(s.env.ledger().sequence() + 500),
    );

    let err = s
        .client()
        .try_create_stream(
            &s.sender,
            &CreateStreamParams {
                recipient: s.sender.clone(), // same as sender
                token: s.token_id.clone(),
                total_amount: total,
                start_time: now,
                end_time: now + 1000,
                cliff_time: now,
                cliff_amount: 0,
            },
        )
        .unwrap_err()
        .unwrap();
    assert_eq!(err, StreamError::SelfStream);
}

// ─── Overdraw protection ──────────────────────────────────────────────────────

#[test]
fn test_overdraw_rejected() {
    let s = SecEnv::setup();
    let now = 1_000_000u64;
    s.set_time(now);
    let id = s.create_default_stream(now);
    s.set_time(now + 100);

    let err = s
        .client()
        .try_withdraw(&id, &1_000_0000000i128) // full deposit before vested
        .unwrap_err()
        .unwrap();
    assert_eq!(err, StreamError::InsufficientFunds);
}

// ─── Double cancel guard ──────────────────────────────────────────────────────

#[test]
fn test_double_cancel_rejected() {
    let s = SecEnv::setup();
    let now = 1_000_000u64;
    s.set_time(now);
    let id = s.create_default_stream(now);
    s.client().cancel(&id).unwrap();

    let err = s.client().try_cancel(&id).unwrap_err().unwrap();
    assert_eq!(err, StreamError::StreamCancelled);
}

// ─── Upgrade auth guard ───────────────────────────────────────────────────────

#[test]
fn test_create_stream_rejects_contract_as_recipient() {
    let s = SecEnv::setup();
    let now = 1_000_000u64;
    s.set_time(now);

    let total = 100_0000000i128;
    s.token().approve(
        &s.sender,
        &s.contract_id,
        &total,
        &(s.env.ledger().sequence() + 500),
    );

    let err = s
        .client()
        .try_create_stream(
            &s.sender,
            &CreateStreamParams {
                recipient: s.contract_id.clone(),
                token: s.token_id.clone(),
                total_amount: total,
                start_time: now,
                end_time: now + 1000,
                cliff_time: now,
                cliff_amount: 0,
            },
        )
        .unwrap_err()
        .unwrap();
    assert_eq!(err, StreamError::InvalidRecipient);
}

#[test]
fn test_create_stream_duration_exceeds_maximum() {
    let s = SecEnv::setup();
    let now = 1_000_000u64;
    s.set_time(now);

    let total = 100_0000000i128;
    s.token().approve(
        &s.sender,
        &s.contract_id,
        &total,
        &(s.env.ledger().sequence() + 500),
    );

    let err = s
        .client()
        .try_create_stream(
            &s.sender,
            &CreateStreamParams {
                recipient: s.recipient.clone(),
                token: s.token_id.clone(),
                total_amount: total,
                start_time: now,
                end_time: now + 315_360_001,
                cliff_time: now,
                cliff_amount: 0,
            },
        )
        .unwrap_err()
        .unwrap();
    assert_eq!(err, StreamError::DurationExceedsMaximum);
}

#[test]
fn test_create_stream_duration_at_maximum_succeeds() {
    let s = SecEnv::setup();
    let now = 1_000_000u64;
    s.set_time(now);

    let total = 100_0000000i128;
    s.token().approve(
        &s.sender,
        &s.contract_id,
        &total,
        &(s.env.ledger().sequence() + 500),
    );

    let id = s
        .client()
        .create_stream(
            &s.sender,
            &CreateStreamParams {
                recipient: s.recipient.clone(),
                token: s.token_id.clone(),
                total_amount: total,
                start_time: now,
                end_time: now + 315_360_000,
                cliff_time: now,
                cliff_amount: 0,
            },
        )
        .unwrap();
    assert!(id > 0);
}
    let s = SecEnv::setup();
    let not_admin = Address::generate(&s.env);
    let hash = soroban_sdk::BytesN::from_array(&s.env, &[0u8; 32]);

    let err = s
        .client()
        .try_upgrade(&not_admin, &hash)
        .unwrap_err()
        .unwrap();
    assert_eq!(err, StreamError::Unauthorized);
}

#[test]
fn test_migrate_is_idempotent() {
    let s = SecEnv::setup();
    s.client().migrate().unwrap();
    s.client().migrate().unwrap();
}
