//! Integration-style tests covering multi-step stream lifecycles.

#![cfg(test)]

extern crate std;

use soroban_sdk::{
    testutils::{Address as _, Ledger},
    Address, Env,
};

use crate::{CreateStreamParams, StreamingContract, StreamingContractClient};

struct IntEnv {
    env: Env,
    contract_id: Address,
    token_id: Address,
    sender: Address,
    recipient: Address,
}

impl IntEnv {
    fn setup() -> Self {
        let env = Env::default();
        env.mock_all_auths();

        let token_admin = Address::generate(&env);
        let token_id = env
            .register_stellar_asset_contract_v2(token_admin.clone())
            .address();

        let sender = Address::generate(&env);
        soroban_sdk::token::StellarAssetClient::new(&env, &token_id)
            .mint(&sender, &10_000_0000000i128);

        let recipient = Address::generate(&env);
        let admin = Address::generate(&env);

        let contract_id = env.register(StreamingContract, ());
        StreamingContractClient::new(&env, &contract_id).initialize(&admin);

        IntEnv {
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
}

/// Full lifecycle: create → partial withdraw mid-stream → full withdraw after end.
#[test]
fn test_full_stream_lifecycle() {
    let t = IntEnv::setup();
    let now = 1_000_000u64;
    t.set_time(now);

    let total = 1_000_0000000i128;
    t.token().approve(
        &t.sender,
        &t.contract_id,
        &total,
        &(t.env.ledger().sequence() + 500),
    );

    let params = CreateStreamParams {
        recipient: t.recipient.clone(),
        token: t.token_id.clone(),
        total_amount: total,
        start_time: now,
        end_time: now + 1000,
        cliff_time: now,
        cliff_amount: 0,
    };

    let id = t.client().create_stream(&t.sender, &params);

    // Halfway through — withdraw half.
    t.set_time(now + 500);
    let mid = t.client().get_withdrawable(&id);
    assert!(mid > 0);
    t.client().withdraw(&id, &mid);

    // After end — withdraw remainder.
    t.set_time(now + 1001);
    let rest = t.client().get_withdrawable(&id);
    assert!(rest > 0);
    t.client().withdraw(&id, &rest);

    assert_eq!(t.token().balance(&t.contract_id), 0);
    assert_eq!(t.token().balance(&t.recipient), total);
}

/// Top-up increases the balance and the recipient can drain it all.
#[test]
fn test_top_up_then_drain() {
    let t = IntEnv::setup();
    let now = 1_000_000u64;
    t.set_time(now);

    let initial = 500_0000000i128;
    let extra = 500_0000000i128;

    t.token().approve(
        &t.sender,
        &t.contract_id,
        &(initial + extra),
        &(t.env.ledger().sequence() + 500),
    );

    let params = CreateStreamParams {
        recipient: t.recipient.clone(),
        token: t.token_id.clone(),
        total_amount: initial,
        start_time: now,
        end_time: now + 1000,
        cliff_time: now,
        cliff_amount: 0,
    };

    let id = t.client().create_stream(&t.sender, &params);

    t.set_time(now + 100);
    t.client().top_up(&id, &extra);

    t.set_time(now + 1001);
    let all = t.client().get_withdrawable(&id);
    t.client().withdraw(&id, &all);

    assert_eq!(t.token().balance(&t.contract_id), 0);
}
