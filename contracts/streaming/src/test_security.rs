#![cfg(test)]

extern crate std;

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger, MockAuth, MockAuthInvoke},
    token::{Client as TokenClient, StellarAssetClient},
    Address, Env, IntoVal,
};

// ─── Shared setup ─────────────────────────────────────────────────────────────

struct Ctx {
    env: Env,
    contract_id: Address,
    token_id: Address,
    sender: Address,
    recipient: Address,
    attacker: Address,
    admin: Address,
}

impl Ctx {
    fn new() -> Self {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StreamingContract, ());
        let sender = Address::generate(&env);
        let recipient = Address::generate(&env);
        let attacker = Address::generate(&env);
        let admin = Address::generate(&env);
        let token_admin = Address::generate(&env);
        let token_id = env.register_stellar_asset_contract_v2(token_admin.clone()).address();
        let asset = StellarAssetClient::new(&env, &token_id);
        asset.mint(&sender,   &10_000_000_0000000);
        asset.mint(&attacker, &10_000_000_0000000);
        StreamingContractClient::new(&env, &contract_id).initialize(&admin);
        Ctx { env, contract_id, token_id, sender, recipient, attacker, admin }
    }

    fn client(&self) -> StreamingContractClient<'_> {
        StreamingContractClient::new(&self.env, &self.contract_id)
    }

    fn token(&self) -> TokenClient<'_> {
        TokenClient::new(&self.env, &self.token_id)
    }

    fn set_time(&self, t: u64) {
        self.env.ledger().with_mut(|l| l.timestamp = t);
    }

    fn create_basic_stream(&self, now: u64) -> u64 {
        let total = 1_000_0000000i128;
        self.token().approve(
            &self.sender, &self.contract_id, &total,
            &(self.env.ledger().sequence() + 500),
        );
        self.client().create_stream(
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
        ).unwrap()
    }
}

// ═══════════════════════════════════════════════════════════════════
// 1. AUTHORIZATION
// ═══════════════════════════════════════════════════════════════════

/// Attacker cannot withdraw from a stream they are not the recipient of.
#[test]
#[should_panic]
fn test_auth_attacker_cannot_withdraw() {
    let ctx = Ctx::new();
    let now = 1_000_000u64;
    ctx.set_time(now);
    let id = ctx.create_basic_stream(now);
    ctx.set_time(now + 500);
    ctx.env.mock_auths(&[MockAuth {
        address: &ctx.attacker,
        invoke: &MockAuthInvoke {
            contract: &ctx.contract_id,
            fn_name: "withdraw",
            args: (id, 1_0000000i128).into_val(&ctx.env),
            sub_invokes: &[],
        },
    }]);
    ctx.client().withdraw(&id, &1_0000000).unwrap();
}

/// Attacker cannot cancel a stream they did not create.
#[test]
#[should_panic]
fn test_auth_attacker_cannot_cancel() {
    let ctx = Ctx::new();
    let now = 1_000_000u64;
    ctx.set_time(now);
    let id = ctx.create_basic_stream(now);
    ctx.env.mock_auths(&[MockAuth {
        address: &ctx.attacker,
        invoke: &MockAuthInvoke {
            contract: &ctx.contract_id,
            fn_name: "cancel",
            args: (id,).into_val(&ctx.env),
            sub_invokes: &[],
        },
    }]);
    ctx.client().cancel(&id).unwrap();
}

/// Recipient cannot cancel their own incoming stream.
#[test]
#[should_panic]
fn test_auth_recipient_cannot_cancel() {
    let ctx = Ctx::new();
    let now = 1_000_000u64;
    ctx.set_time(now);
    let id = ctx.create_basic_stream(now);
    ctx.env.mock_auths(&[MockAuth {
        address: &ctx.recipient,
        invoke: &MockAuthInvoke {
            contract: &ctx.contract_id,
            fn_name: "cancel",
            args: (id,).into_val(&ctx.env),
            sub_invokes: &[],
        },
    }]);
    ctx.client().cancel(&id).unwrap();
}

/// Non-admin cannot upgrade the contract.
#[test]
#[should_panic]
fn test_auth_non_admin_cannot_upgrade() {
    let ctx = Ctx::new();
    let fake_hash = soroban_sdk::BytesN::from_array(&ctx.env, &[0u8; 32]);
    ctx.env.mock_auths(&[MockAuth {
        address: &ctx.attacker,
        invoke: &MockAuthInvoke {
            contract: &ctx.contract_id,
            fn_name: "upgrade",
            args: (ctx.attacker.clone(), fake_hash.clone()).into_val(&ctx.env),
            sub_invokes: &[],
        },
    }]);
    ctx.client().upgrade(&ctx.attacker, &fake_hash);
}

/// Sender cannot withdraw from their own outgoing stream.
#[test]
#[should_panic]
fn test_auth_sender_cannot_withdraw() {
    let ctx = Ctx::new();
    let now = 1_000_000u64;
    ctx.set_time(now);
    let id = ctx.create_basic_stream(now);
    ctx.set_time(now + 500);
    ctx.env.mock_auths(&[MockAuth {
        address: &ctx.sender,
        invoke: &MockAuthInvoke {
            contract: &ctx.contract_id,
            fn_name: "withdraw",
            args: (id, 1_0000000i128).into_val(&ctx.env),
            sub_invokes: &[],
        },
    }]);
    ctx.client().withdraw(&id, &1_0000000).unwrap();
}

// ═══════════════════════════════════════════════════════════════════
// 2. NON-EXISTENT STREAM
// ═══════════════════════════════════════════════════════════════════

#[test]
fn test_get_nonexistent_stream() {
    let ctx = Ctx::new();
    let result = ctx.client().try_get_stream(&9999);
    assert_eq!(result, Err(Ok(StreamError::StreamNotFound)));
}

#[test]
fn test_withdraw_nonexistent_stream() {
    let ctx = Ctx::new();
    ctx.set_time(1_000_000);
    let result = ctx.client().try_withdraw(&9999, &1_0000000);
    assert_eq!(result, Err(Ok(StreamError::StreamNotFound)));
}

#[test]
fn test_cancel_nonexistent_stream() {
    let ctx = Ctx::new();
    ctx.set_time(1_000_000);
    let result = ctx.client().try_cancel(&9999);
    assert_eq!(result, Err(Ok(StreamError::StreamNotFound)));
}

// ═══════════════════════════════════════════════════════════════════
// 3. OVERDRAW — cumulative withdrawals must never exceed deposited
// ═══════════════════════════════════════════════════════════════════

#[test]
fn test_no_overdraw_multiple_partial_withdrawals() {
    let ctx = Ctx::new();
    let now = 1_000_000u64;
    ctx.set_time(now);
    let id = ctx.create_basic_stream(now);
    let total = 1_000_0000000i128;
    let mut total_withdrawn = 0i128;

    for i in 1..=10u64 {
        ctx.set_time(now + i * 100);
        let w = ctx.client().get_withdrawable(&id).unwrap();
        if w > 0 {
            ctx.client().withdraw(&id, &w).unwrap();
            total_withdrawn += w;
        }
    }
    ctx.set_time(now + 2000);
    let final_w = ctx.client().get_withdrawable(&id).unwrap();
    if final_w > 0 {
        ctx.client().withdraw(&id, &final_w).unwrap();
        total_withdrawn += final_w;
    }

    assert!(total_withdrawn <= total);
    assert!(ctx.token().balance(&ctx.recipient) <= total);
    assert!(ctx.token().balance(&ctx.contract_id) < 1000);
}

#[test]
fn test_withdraw_more_than_withdrawable() {
    let ctx = Ctx::new();
    let now = 1_000_000u64;
    ctx.set_time(now);
    let id = ctx.create_basic_stream(now);
    ctx.set_time(now + 500);
    let withdrawable = ctx.client().get_withdrawable(&id).unwrap();
    let result = ctx.client().try_withdraw(&id, &(withdrawable + 1));
    assert_eq!(result, Err(Ok(StreamError::InsufficientFunds)));
}

#[test]
fn test_withdraw_zero() {
    let ctx = Ctx::new();
    let now = 1_000_000u64;
    ctx.set_time(now);
    let id = ctx.create_basic_stream(now);
    ctx.set_time(now + 500);
    let result = ctx.client().try_withdraw(&id, &0);
    assert_eq!(result, Err(Ok(StreamError::InsufficientFunds)));
}

#[test]
fn test_withdraw_negative_amount() {
    let ctx = Ctx::new();
    let now = 1_000_000u64;
    ctx.set_time(now);
    let id = ctx.create_basic_stream(now);
    ctx.set_time(now + 500);
    let result = ctx.client().try_withdraw(&id, &-1);
    assert_eq!(result, Err(Ok(StreamError::InsufficientFunds)));
}

// ═══════════════════════════════════════════════════════════════════
// 4. CANCEL ACCOUNTING — funds in must equal funds out
// ═══════════════════════════════════════════════════════════════════

#[test]
fn test_cancel_conservation_with_prior_withdrawal() {
    let ctx = Ctx::new();
    let now = 1_000_000u64;
    ctx.set_time(now);
    let id = ctx.create_basic_stream(now);
    let total = 1_000_0000000i128;

    ctx.set_time(now + 300);
    let w = ctx.client().get_withdrawable(&id).unwrap();
    ctx.client().withdraw(&id, &w).unwrap();

    let recipient_before = ctx.token().balance(&ctx.recipient);
    let sender_before = ctx.token().balance(&ctx.sender);

    ctx.set_time(now + 500);
    ctx.client().cancel(&id).unwrap();

    let recipient_got = ctx.token().balance(&ctx.recipient) - recipient_before;
    let sender_got = ctx.token().balance(&ctx.sender) - sender_before;
    let dust = ctx.token().balance(&ctx.contract_id);

    assert_eq!(recipient_got + sender_got + dust, total - w);
    assert!(dust < 1000);
}

#[test]
fn test_cancel_after_full_withdrawal() {
    let ctx = Ctx::new();
    let now = 1_000_000u64;
    ctx.set_time(now);
    let id = ctx.create_basic_stream(now);
    let total = 1_000_0000000i128;

    ctx.set_time(now + 2000);
    ctx.client().withdraw(&id, &total).unwrap();
    ctx.client().cancel(&id).unwrap();

    assert!(ctx.client().get_stream(&id).unwrap().cancelled);
    assert_eq!(ctx.token().balance(&ctx.contract_id), 0);
}

#[test]
fn test_cancel_before_start_full_refund() {
    let ctx = Ctx::new();
    let now = 1_000_000u64;
    ctx.set_time(now);
    let total = 1_000_0000000i128;

    ctx.token().approve(&ctx.sender, &ctx.contract_id, &total, &(ctx.env.ledger().sequence() + 500));
    let id = ctx.client().create_stream(
        &ctx.sender,
        &CreateStreamParams {
            recipient: ctx.recipient.clone(),
            token: ctx.token_id.clone(),
            total_amount: total,
            start_time: now + 500,
            end_time: now + 1500,
            cliff_time: now + 500,
            cliff_amount: 0,
        },
    ).unwrap();

    let sender_before = ctx.token().balance(&ctx.sender);
    ctx.client().cancel(&id).unwrap();

    assert_eq!(ctx.token().balance(&ctx.sender) - sender_before, total);
    assert_eq!(ctx.token().balance(&ctx.recipient), 0);
    assert_eq!(ctx.token().balance(&ctx.contract_id), 0);
}

#[test]
fn test_cancel_at_end_time() {
    let ctx = Ctx::new();
    let now = 1_000_000u64;
    ctx.set_time(now);
    let id = ctx.create_basic_stream(now);
    let total = 1_000_0000000i128;

    ctx.set_time(now + 1000);
    let sender_before = ctx.token().balance(&ctx.sender);
    ctx.client().cancel(&id).unwrap();

    assert_eq!(ctx.token().balance(&ctx.sender), sender_before);
    assert_eq!(ctx.token().balance(&ctx.recipient), total);
    assert_eq!(ctx.token().balance(&ctx.contract_id), 0);
}

// ═══════════════════════════════════════════════════════════════════
// 5. CLIFF EDGE CASES
// ═══════════════════════════════════════════════════════════════════

#[test]
fn test_cliff_amount_equals_total() {
    let ctx = Ctx::new();
    let now = 1_000_000u64;
    ctx.set_time(now);
    let total = 1_000_0000000i128;

    ctx.token().approve(&ctx.sender, &ctx.contract_id, &total, &(ctx.env.ledger().sequence() + 500));
    let id = ctx.client().create_stream(
        &ctx.sender,
        &CreateStreamParams {
            recipient: ctx.recipient.clone(),
            token: ctx.token_id.clone(),
            total_amount: total,
            start_time: now,
            end_time: now + 1000,
            cliff_time: now + 200,
            cliff_amount: total,
        },
    ).unwrap();

    ctx.set_time(now + 199);
    assert_eq!(ctx.client().get_withdrawable(&id).unwrap(), 0);

    ctx.set_time(now + 200);
    assert_eq!(ctx.client().get_withdrawable(&id).unwrap(), total);

    ctx.set_time(now + 800);
    assert_eq!(ctx.client().get_withdrawable(&id).unwrap(), total);
}

#[test]
fn test_cliff_time_equals_end_time() {
    let ctx = Ctx::new();
    let now = 1_000_000u64;
    ctx.set_time(now);
    let total = 1_000_0000000i128;

    ctx.token().approve(&ctx.sender, &ctx.contract_id, &total, &(ctx.env.ledger().sequence() + 500));
    let id = ctx.client().create_stream(
        &ctx.sender,
        &CreateStreamParams {
            recipient: ctx.recipient.clone(),
            token: ctx.token_id.clone(),
            total_amount: total,
            start_time: now,
            end_time: now + 1000,
            cliff_time: now + 1000,
            cliff_amount: 500_0000000,
        },
    ).unwrap();

    ctx.set_time(now + 999);
    assert_eq!(ctx.client().get_withdrawable(&id).unwrap(), 0);

    ctx.set_time(now + 1000);
    assert_eq!(ctx.client().get_withdrawable(&id).unwrap(), total);
}

#[test]
fn test_withdraw_exactly_at_cliff() {
    let ctx = Ctx::new();
    let now = 1_000_000u64;
    ctx.set_time(now);
    let total = 1_000_0000000i128;
    let cliff_amt = 200_0000000i128;

    ctx.token().approve(&ctx.sender, &ctx.contract_id, &total, &(ctx.env.ledger().sequence() + 500));
    let id = ctx.client().create_stream(
        &ctx.sender,
        &CreateStreamParams {
            recipient: ctx.recipient.clone(),
            token: ctx.token_id.clone(),
            total_amount: total,
            start_time: now,
            end_time: now + 1000,
            cliff_time: now + 200,
            cliff_amount: cliff_amt,
        },
    ).unwrap();

    ctx.set_time(now + 200);
    let w = ctx.client().get_withdrawable(&id).unwrap();
    assert!(w > 0);
    ctx.client().withdraw(&id, &w).unwrap();
    assert_eq!(ctx.token().balance(&ctx.recipient), w);
}

#[test]
fn test_nothing_withdrawable_before_cliff() {
    let ctx = Ctx::new();
    let now = 1_000_000u64;
    ctx.set_time(now);
    let total = 1_000_0000000i128;

    ctx.token().approve(&ctx.sender, &ctx.contract_id, &total, &(ctx.env.ledger().sequence() + 500));
    let id = ctx.client().create_stream(
        &ctx.sender,
        &CreateStreamParams {
            recipient: ctx.recipient.clone(),
            token: ctx.token_id.clone(),
            total_amount: total,
            start_time: now,
            end_time: now + 1000,
            cliff_time: now + 500,
            cliff_amount: 0,
        },
    ).unwrap();

    ctx.set_time(now + 499);
    assert_eq!(ctx.client().get_withdrawable(&id).unwrap(), 0);
}

#[test]
fn test_withdraw_before_cliff_returns_error() {
    let ctx = Ctx::new();
    let now = 1_000_000u64;
    ctx.set_time(now);
    let total = 1_000_0000000i128;

    ctx.token().approve(&ctx.sender, &ctx.contract_id, &total, &(ctx.env.ledger().sequence() + 500));
    let id = ctx.client().create_stream(
        &ctx.sender,
        &CreateStreamParams {
            recipient: ctx.recipient.clone(),
            token: ctx.token_id.clone(),
            total_amount: total,
            start_time: now,
            end_time: now + 1000,
            cliff_time: now + 500,
            cliff_amount: 0,
        },
    ).unwrap();

    ctx.set_time(now + 100);
    let result = ctx.client().try_withdraw(&id, &1_0000000);
    assert_eq!(result, Err(Ok(StreamError::InsufficientFunds)));
}

// ═══════════════════════════════════════════════════════════════════
// 6. ROUNDING / INTEGER MATH
// ═══════════════════════════════════════════════════════════════════

#[test]
fn test_rounding_dust_stays_in_contract() {
    let ctx = Ctx::new();
    let now = 1_000_000u64;
    ctx.set_time(now);
    let total = 1_000_000_0000001i128;

    ctx.token().approve(&ctx.sender, &ctx.contract_id, &total, &(ctx.env.ledger().sequence() + 500));
    let id = ctx.client().create_stream(
        &ctx.sender,
        &CreateStreamParams {
            recipient: ctx.recipient.clone(),
            token: ctx.token_id.clone(),
            total_amount: total,
            start_time: now,
            end_time: now + 999,
            cliff_time: now,
            cliff_amount: 0,
        },
    ).unwrap();

    ctx.set_time(now + 1000);
    let w = ctx.client().get_withdrawable(&id).unwrap();
    assert_eq!(w, total);
    ctx.client().withdraw(&id, &w).unwrap();
    assert_eq!(ctx.token().balance(&ctx.recipient), total);
    assert_eq!(ctx.token().balance(&ctx.contract_id), 0);
}

#[test]
fn test_large_amounts_no_overflow() {
    let ctx = Ctx::new();
    let now = 1_000_000u64;
    ctx.set_time(now);
    let large_total = 1_000_000_000_0000000i128;

    let asset = StellarAssetClient::new(&ctx.env, &ctx.token_id);
    asset.mint(&ctx.sender, &large_total);

    ctx.token().approve(&ctx.sender, &ctx.contract_id, &large_total, &(ctx.env.ledger().sequence() + 500));
    let id = ctx.client().create_stream(
        &ctx.sender,
        &CreateStreamParams {
            recipient: ctx.recipient.clone(),
            token: ctx.token_id.clone(),
            total_amount: large_total,
            start_time: now,
            end_time: now + 31_536_000,
            cliff_time: now,
            cliff_amount: 0,
        },
    ).unwrap();

    ctx.set_time(now + 15_768_000);
    let w = ctx.client().get_withdrawable(&id).unwrap();
    assert!(w > 0);
    assert!(w < large_total);

    ctx.set_time(now + 31_536_001);
    assert_eq!(ctx.client().get_withdrawable(&id).unwrap(), large_total);
}

#[test]
fn test_minimum_duration_stream() {
    let ctx = Ctx::new();
    let now = 1_000_000u64;
    ctx.set_time(now);
    let total = 1_000_0000000i128;

    ctx.token().approve(&ctx.sender, &ctx.contract_id, &total, &(ctx.env.ledger().sequence() + 500));
    let id = ctx.client().create_stream(
        &ctx.sender,
        &CreateStreamParams {
            recipient: ctx.recipient.clone(),
            token: ctx.token_id.clone(),
            total_amount: total,
            start_time: now,
            end_time: now + 1,
            cliff_time: now,
            cliff_amount: 0,
        },
    ).unwrap();

    ctx.set_time(now + 1);
    assert_eq!(ctx.client().get_withdrawable(&id).unwrap(), total);
    ctx.client().withdraw(&id, &total).unwrap();
    assert_eq!(ctx.token().balance(&ctx.recipient), total);
}

// ═══════════════════════════════════════════════════════════════════
// 7. SELF-STREAM (sender == recipient)
// ═══════════════════════════════════════════════════════════════════

#[test]
fn test_self_stream_cancel_no_double_pay() {
    let ctx = Ctx::new();
    let now = 1_000_000u64;
    ctx.set_time(now);
    let total = 1_000_0000000i128;

    ctx.token().approve(&ctx.sender, &ctx.contract_id, &total, &(ctx.env.ledger().sequence() + 500));
    let id = ctx.client().create_stream(
        &ctx.sender,
        &CreateStreamParams {
            recipient: ctx.sender.clone(),
            token: ctx.token_id.clone(),
            total_amount: total,
            start_time: now,
            end_time: now + 1000,
            cliff_time: now,
            cliff_amount: 0,
        },
    ).unwrap();

    let balance_before = ctx.token().balance(&ctx.sender);
    ctx.set_time(now + 500);
    ctx.client().cancel(&id).unwrap();

    let balance_after = ctx.token().balance(&ctx.sender);
    let contract_balance = ctx.token().balance(&ctx.contract_id);

    assert_eq!(balance_after - balance_before + contract_balance, total);
    assert!(contract_balance < 1000);
}

#[test]
fn test_self_stream_withdraw() {
    let ctx = Ctx::new();
    let now = 1_000_000u64;
    ctx.set_time(now);
    let total = 1_000_0000000i128;

    ctx.token().approve(&ctx.sender, &ctx.contract_id, &total, &(ctx.env.ledger().sequence() + 500));
    let id = ctx.client().create_stream(
        &ctx.sender,
        &CreateStreamParams {
            recipient: ctx.sender.clone(),
            token: ctx.token_id.clone(),
            total_amount: total,
            start_time: now,
            end_time: now + 1000,
            cliff_time: now,
            cliff_amount: 0,
        },
    ).unwrap();

    ctx.set_time(now + 2000);
    ctx.client().withdraw(&id, &total).unwrap();
    assert_eq!(ctx.token().balance(&ctx.contract_id), 0);
}


// ═══════════════════════════════════════════════════════════════════
// 8. CREATE PARAM VALIDATION
// ═══════════════════════════════════════════════════════════════════

#[test]
fn test_cliff_before_start_time() {
    let ctx = Ctx::new();
    let now = 1_000_000u64;
    ctx.set_time(now);
    let total = 1_000_0000000i128;
    ctx.token().approve(&ctx.sender, &ctx.contract_id, &total, &(ctx.env.ledger().sequence() + 500));
    let result = ctx.client().try_create_stream(
        &ctx.sender,
        &CreateStreamParams {
            recipient: ctx.recipient.clone(),
            token: ctx.token_id.clone(),
            total_amount: total,
            start_time: now,
            end_time: now + 1000,
            cliff_time: now - 1,
            cliff_amount: 0,
        },
    );
    assert_eq!(result, Err(Ok(StreamError::InvalidCliff)));
}

#[test]
fn test_cliff_after_end_time() {
    let ctx = Ctx::new();
    let now = 1_000_000u64;
    ctx.set_time(now);
    let total = 1_000_0000000i128;
    ctx.token().approve(&ctx.sender, &ctx.contract_id, &total, &(ctx.env.ledger().sequence() + 500));
    let result = ctx.client().try_create_stream(
        &ctx.sender,
        &CreateStreamParams {
            recipient: ctx.recipient.clone(),
            token: ctx.token_id.clone(),
            total_amount: total,
            start_time: now,
            end_time: now + 1000,
            cliff_time: now + 1001,
            cliff_amount: 0,
        },
    );
    assert_eq!(result, Err(Ok(StreamError::InvalidCliff)));
}

#[test]
fn test_cliff_amount_exceeds_total() {
    let ctx = Ctx::new();
    let now = 1_000_000u64;
    ctx.set_time(now);
    let total = 1_000_0000000i128;
    ctx.token().approve(&ctx.sender, &ctx.contract_id, &total, &(ctx.env.ledger().sequence() + 500));
    let result = ctx.client().try_create_stream(
        &ctx.sender,
        &CreateStreamParams {
            recipient: ctx.recipient.clone(),
            token: ctx.token_id.clone(),
            total_amount: total,
            start_time: now,
            end_time: now + 1000,
            cliff_time: now,
            cliff_amount: total + 1,
        },
    );
    assert_eq!(result, Err(Ok(StreamError::InvalidCliff)));
}

#[test]
fn test_negative_cliff_amount() {
    let ctx = Ctx::new();
    let now = 1_000_000u64;
    ctx.set_time(now);
    let total = 1_000_0000000i128;
    ctx.token().approve(&ctx.sender, &ctx.contract_id, &total, &(ctx.env.ledger().sequence() + 500));
    let result = ctx.client().try_create_stream(
        &ctx.sender,
        &CreateStreamParams {
            recipient: ctx.recipient.clone(),
            token: ctx.token_id.clone(),
            total_amount: total,
            start_time: now,
            end_time: now + 1000,
            cliff_time: now,
            cliff_amount: -1,
        },
    );
    assert_eq!(result, Err(Ok(StreamError::InvalidCliff)));
}

#[test]
fn test_negative_total_amount() {
    let ctx = Ctx::new();
    let now = 1_000_000u64;
    ctx.set_time(now);
    let result = ctx.client().try_create_stream(
        &ctx.sender,
        &CreateStreamParams {
            recipient: ctx.recipient.clone(),
            token: ctx.token_id.clone(),
            total_amount: -100,
            start_time: now,
            end_time: now + 1000,
            cliff_time: now,
            cliff_amount: 0,
        },
    );
    assert_eq!(result, Err(Ok(StreamError::InvalidAmount)));
}

#[test]
fn test_end_time_equals_start_time() {
    let ctx = Ctx::new();
    let now = 1_000_000u64;
    ctx.set_time(now);
    let total = 1_000_0000000i128;
    ctx.token().approve(&ctx.sender, &ctx.contract_id, &total, &(ctx.env.ledger().sequence() + 500));
    let result = ctx.client().try_create_stream(
        &ctx.sender,
        &CreateStreamParams {
            recipient: ctx.recipient.clone(),
            token: ctx.token_id.clone(),
            total_amount: total,
            start_time: now,
            end_time: now,
            cliff_time: now,
            cliff_amount: 0,
        },
    );
    assert_eq!(result, Err(Ok(StreamError::InvalidTimeRange)));
}
