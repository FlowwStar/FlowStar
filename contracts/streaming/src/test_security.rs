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
        let token_id = env
            .register_stellar_asset_contract_v2(token_admin.clone())
            .address();
        let asset = StellarAssetClient::new(&env, &token_id);
        asset.mint(&sender, &10_000_000_0000000);
        asset.mint(&attacker, &10_000_000_0000000);
        StreamingContractClient::new(&env, &contract_id).initialize(&admin);
        Ctx {
            env,
            contract_id,
            token_id,
            sender,
            recipient,
            attacker,
        }
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
            &self.sender,
            &self.contract_id,
            &total,
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
        )
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
    ctx.client().withdraw(&id, &1_0000000);
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
    ctx.client().cancel(&id);
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
    ctx.client().cancel(&id);
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
    ctx.client().withdraw(&id, &1_0000000);
}

/// Authorized delegate can withdraw on behalf of recipient.
#[test]
fn test_auth_delegate_can_withdraw() {
    let ctx = Ctx::new();
    let now = 1_000_000u64;
    ctx.set_time(now);
    let id = ctx.create_basic_stream(now);

    let delegate = Address::generate(&ctx.env);
    ctx.client().set_delegate(&id, &delegate);

    ctx.set_time(now + 500);
    let withdrawable = ctx.client().get_withdrawable(&id);
    assert!(withdrawable > 0);

    ctx.env.mock_auths(&[MockAuth {
        address: &delegate,
        invoke: &MockAuthInvoke {
            contract: &ctx.contract_id,
            fn_name: "withdraw",
            args: (id, withdrawable).into_val(&ctx.env),
            sub_invokes: &[],
        },
    }]);
    ctx.client().withdraw(&id, &withdrawable);

    assert_eq!(ctx.token().balance(&ctx.recipient), withdrawable);
}

/// Recipient cannot withdraw without delegate auth when a delegate is set.
#[test]
#[should_panic]
fn test_auth_recipient_cannot_withdraw_without_delegate_auth_when_delegate_set() {
    let ctx = Ctx::new();
    let now = 1_000_000u64;
    ctx.set_time(now);
    let id = ctx.create_basic_stream(now);

    let delegate = Address::generate(&ctx.env);
    ctx.client().set_delegate(&id, &delegate);

    ctx.set_time(now + 500);
    let withdrawable = ctx.client().get_withdrawable(&id);

    ctx.env.mock_auths(&[MockAuth {
        address: &ctx.recipient,
        invoke: &MockAuthInvoke {
            contract: &ctx.contract_id,
            fn_name: "withdraw",
            args: (id, withdrawable).into_val(&ctx.env),
            sub_invokes: &[],
        },
    }]);
    ctx.client().withdraw(&id, &withdrawable);
}

/// Attacker cannot withdraw even when a delegate is set.
#[test]
#[should_panic]
fn test_auth_attacker_cannot_withdraw_when_delegate_set() {
    let ctx = Ctx::new();
    let now = 1_000_000u64;
    ctx.set_time(now);
    let id = ctx.create_basic_stream(now);

    let delegate = Address::generate(&ctx.env);
    ctx.client().set_delegate(&id, &delegate);

    ctx.set_time(now + 500);
    let withdrawable = ctx.client().get_withdrawable(&id);

    ctx.env.mock_auths(&[MockAuth {
        address: &ctx.attacker,
        invoke: &MockAuthInvoke {
            contract: &ctx.contract_id,
            fn_name: "withdraw",
            args: (id, withdrawable).into_val(&ctx.env),
            sub_invokes: &[],
        },
    }]);
    ctx.client().withdraw(&id, &withdrawable);
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
        let w = ctx.client().get_withdrawable(&id);
        if w > 0 {
            ctx.client().withdraw(&id, &w);
            total_withdrawn += w;
        }
    }
    ctx.set_time(now + 2000);
    let final_w = ctx.client().get_withdrawable(&id);
    if final_w > 0 {
        ctx.client().withdraw(&id, &final_w);
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
    let withdrawable = ctx.client().get_withdrawable(&id);
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
    let w = ctx.client().get_withdrawable(&id);
    ctx.client().withdraw(&id, &w);

    let recipient_before = ctx.token().balance(&ctx.recipient);
    let sender_before = ctx.token().balance(&ctx.sender);

    ctx.set_time(now + 500);
    ctx.client().cancel(&id);

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
    ctx.client().withdraw(&id, &total);
    ctx.client().cancel(&id);

    assert!(ctx.client().get_stream(&id).cancelled);
    assert_eq!(ctx.token().balance(&ctx.contract_id), 0);
}

#[test]
fn test_cancel_before_start_full_refund() {
    let ctx = Ctx::new();
    let now = 1_000_000u64;
    ctx.set_time(now);
    let total = 1_000_0000000i128;

    ctx.token().approve(
        &ctx.sender,
        &ctx.contract_id,
        &total,
        &(ctx.env.ledger().sequence() + 500),
    );
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
    );

    let sender_before = ctx.token().balance(&ctx.sender);
    ctx.client().cancel(&id);

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
    ctx.client().cancel(&id);

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

    ctx.token().approve(
        &ctx.sender,
        &ctx.contract_id,
        &total,
        &(ctx.env.ledger().sequence() + 500),
    );
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
    );

    ctx.set_time(now + 199);
    assert_eq!(ctx.client().get_withdrawable(&id), 0);

    ctx.set_time(now + 200);
    assert_eq!(ctx.client().get_withdrawable(&id), total);

    ctx.set_time(now + 800);
    assert_eq!(ctx.client().get_withdrawable(&id), total);
}

#[test]
fn test_cliff_time_equals_end_time() {
    let ctx = Ctx::new();
    let now = 1_000_000u64;
    ctx.set_time(now);
    let total = 1_000_0000000i128;

    ctx.token().approve(
        &ctx.sender,
        &ctx.contract_id,
        &total,
        &(ctx.env.ledger().sequence() + 500),
    );
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
    );

    ctx.set_time(now + 999);
    assert_eq!(ctx.client().get_withdrawable(&id), 0);

    ctx.set_time(now + 1000);
    assert_eq!(ctx.client().get_withdrawable(&id), total);
}

#[test]
fn test_withdraw_exactly_at_cliff() {
    let ctx = Ctx::new();
    let now = 1_000_000u64;
    ctx.set_time(now);
    let total = 1_000_0000000i128;
    let cliff_amt = 200_0000000i128;

    ctx.token().approve(
        &ctx.sender,
        &ctx.contract_id,
        &total,
        &(ctx.env.ledger().sequence() + 500),
    );
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
    );

    ctx.set_time(now + 200);
    let w = ctx.client().get_withdrawable(&id);
    assert!(w > 0);
    ctx.client().withdraw(&id, &w);
    assert_eq!(ctx.token().balance(&ctx.recipient), w);
}

#[test]
fn test_nothing_withdrawable_before_cliff() {
    let ctx = Ctx::new();
    let now = 1_000_000u64;
    ctx.set_time(now);
    let total = 1_000_0000000i128;

    ctx.token().approve(
        &ctx.sender,
        &ctx.contract_id,
        &total,
        &(ctx.env.ledger().sequence() + 500),
    );
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
    );

    ctx.set_time(now + 499);
    assert_eq!(ctx.client().get_withdrawable(&id), 0);
}

#[test]
fn test_withdraw_before_cliff_returns_error() {
    let ctx = Ctx::new();
    let now = 1_000_000u64;
    ctx.set_time(now);
    let total = 1_000_0000000i128;

    ctx.token().approve(
        &ctx.sender,
        &ctx.contract_id,
        &total,
        &(ctx.env.ledger().sequence() + 500),
    );
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
    );

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

    ctx.token().approve(
        &ctx.sender,
        &ctx.contract_id,
        &total,
        &(ctx.env.ledger().sequence() + 500),
    );
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
    );

    ctx.set_time(now + 1000);
    let w = ctx.client().get_withdrawable(&id);
    assert_eq!(w, total);
    ctx.client().withdraw(&id, &w);
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

    ctx.token().approve(
        &ctx.sender,
        &ctx.contract_id,
        &large_total,
        &(ctx.env.ledger().sequence() + 500),
    );
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
    );

    ctx.set_time(now + 15_768_000);
    let w = ctx.client().get_withdrawable(&id);
    assert!(w > 0);
    assert!(w < large_total);

    ctx.set_time(now + 31_536_001);
    assert_eq!(ctx.client().get_withdrawable(&id), large_total);
}

#[test]
fn test_minimum_duration_stream() {
    let ctx = Ctx::new();
    let now = 1_000_000u64;
    ctx.set_time(now);
    let total = 1_000_0000000i128;

    ctx.token().approve(
        &ctx.sender,
        &ctx.contract_id,
        &total,
        &(ctx.env.ledger().sequence() + 500),
    );
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
    );

    ctx.set_time(now + 1);
    assert_eq!(ctx.client().get_withdrawable(&id), total);
    ctx.client().withdraw(&id, &total);
    assert_eq!(ctx.token().balance(&ctx.recipient), total);
}

// ═══════════════════════════════════════════════════════════════════
// 7. SELF-STREAM (sender == recipient)
// ═══════════════════════════════════════════════════════════════════

// Self-streams (sender == recipient) are rejected outright at creation
// (see test_create_stream_self_rejected in test.rs), so there is no
// cancel/withdraw fund-accounting path to exercise for them — creation
// itself must fail first.
#[test]
fn test_self_stream_cancel_no_double_pay() {
    let ctx = Ctx::new();
    let now = 1_000_000u64;
    ctx.set_time(now);
    let total = 1_000_0000000i128;

    ctx.token().approve(
        &ctx.sender,
        &ctx.contract_id,
        &total,
        &(ctx.env.ledger().sequence() + 500),
    );
    let result = ctx.client().try_create_stream(
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
    );

    assert_eq!(result, Err(Ok(StreamError::SelfStream)));
}

#[test]
fn test_self_stream_withdraw() {
    let ctx = Ctx::new();
    let now = 1_000_000u64;
    ctx.set_time(now);
    let total = 1_000_0000000i128;

    ctx.token().approve(
        &ctx.sender,
        &ctx.contract_id,
        &total,
        &(ctx.env.ledger().sequence() + 500),
    );
    let result = ctx.client().try_create_stream(
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
    );

    assert_eq!(result, Err(Ok(StreamError::SelfStream)));
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
    ctx.token().approve(
        &ctx.sender,
        &ctx.contract_id,
        &total,
        &(ctx.env.ledger().sequence() + 500),
    );
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
    ctx.token().approve(
        &ctx.sender,
        &ctx.contract_id,
        &total,
        &(ctx.env.ledger().sequence() + 500),
    );
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
    ctx.token().approve(
        &ctx.sender,
        &ctx.contract_id,
        &total,
        &(ctx.env.ledger().sequence() + 500),
    );
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
    ctx.token().approve(
        &ctx.sender,
        &ctx.contract_id,
        &total,
        &(ctx.env.ledger().sequence() + 500),
    );
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
    ctx.token().approve(
        &ctx.sender,
        &ctx.contract_id,
        &total,
        &(ctx.env.ledger().sequence() + 500),
    );
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

// ═══════════════════════════════════════════════════════════════════
// 9. DUST STREAM PREVENTION
// ═══════════════════════════════════════════════════════════════════

/// Reject dust stream: very small amount over long duration results in zero rate.
#[test]
#[should_panic(expected = "stream amount too small for duration")]
fn test_dust_stream_rejected() {
    let ctx = Ctx::new();
    let now = 1_000_000u64;
    ctx.set_time(now);
    // 100 stroops over 1 year (31,536,000 seconds) = 0 per second due to integer division
    let total = 100i128;
    ctx.token().approve(
        &ctx.sender,
        &ctx.contract_id,
        &total,
        &(ctx.env.ledger().sequence() + 500),
    );
    ctx.client().create_stream(
        &ctx.sender,
        &CreateStreamParams {
            recipient: ctx.recipient.clone(),
            token: ctx.token_id.clone(),
            total_amount: total,
            start_time: now,
            end_time: now + 31_536_000, // 1 year
            cliff_time: now,
            cliff_amount: 0,
        },
    );
}

/// Reject dust stream with cliff: linear amount too small for duration.
#[test]
#[should_panic(expected = "stream amount too small for duration")]
fn test_dust_stream_with_cliff_rejected() {
    let ctx = Ctx::new();
    let now = 1_000_000u64;
    ctx.set_time(now);
    // Total 1000, but cliff takes 999, leaving only 1 for linear over 1 year
    let total = 1000i128;
    ctx.token().approve(
        &ctx.sender,
        &ctx.contract_id,
        &total,
        &(ctx.env.ledger().sequence() + 500),
    );
    ctx.client().create_stream(
        &ctx.sender,
        &CreateStreamParams {
            recipient: ctx.recipient.clone(),
            token: ctx.token_id.clone(),
            total_amount: total,
            start_time: now,
            end_time: now + 31_536_000, // 1 year
            cliff_time: now,
            cliff_amount: 999, // almost all in cliff
        },
    );
}

/// Accept stream with zero linear amount (all in cliff) - not a dust stream.
#[test]
fn test_all_cliff_stream_accepted() {
    let ctx = Ctx::new();
    let now = 1_000_000u64;
    ctx.set_time(now);
    let total = 1_000_0000000i128;
    ctx.token().approve(
        &ctx.sender,
        &ctx.contract_id,
        &total,
        &(ctx.env.ledger().sequence() + 500),
    );
    let id = ctx.client().create_stream(
        &ctx.sender,
        &CreateStreamParams {
            recipient: ctx.recipient.clone(),
            token: ctx.token_id.clone(),
            total_amount: total,
            start_time: now,
            end_time: now + 31_536_000, // 1 year
            cliff_time: now,
            cliff_amount: total, // 100% cliff, zero linear
        },
    );
    // Should succeed - all in cliff is valid
    assert!(id > 0);
}

/// A tiny top-up with only a moment of the stream left must still succeed:
/// `top_up` re-anchors its vesting math off `unlocked_amount` (the same
/// function withdraw/cancel use), which guarantees `remaining >=
/// remaining_seconds` given `create_stream`'s own rate>=1 invariant, so a
/// legitimate top-up can never actually produce a zero rate here.
#[test]
fn test_top_up_near_end_succeeds() {
    let ctx = Ctx::new();
    let now = 1_000_000u64;
    ctx.set_time(now);
    let total = 1_000_0000000i128;
    ctx.token().approve(
        &ctx.sender,
        &ctx.contract_id,
        &total,
        &(ctx.env.ledger().sequence() + 500),
    );
    let id = ctx.client().create_stream(
        &ctx.sender,
        &CreateStreamParams {
            recipient: ctx.recipient.clone(),
            token: ctx.token_id.clone(),
            total_amount: total,
            start_time: now,
            end_time: now + 1000,
            cliff_time: now,
            cliff_amount: 0,
        },
    );

    // Advance to near end
    ctx.set_time(now + 999);

    let tiny_addition = 1i128;
    ctx.token().approve(
        &ctx.sender,
        &ctx.contract_id,
        &tiny_addition,
        &(ctx.env.ledger().sequence() + 500),
    );
    ctx.client().top_up(&id, &tiny_addition);

    let stream = ctx.client().get_stream(&id);
    assert_eq!(stream.deposited_amount, total + tiny_addition);
    assert!(stream.amount_per_second > 0);
}

/// Regression test for a real bug: `top_up` used to recompute vesting via a
/// separate formula (`amount_per_second * elapsed-since-cliff`) that
/// diverged from `unlocked_amount` (what withdraw/cancel actually use).
/// After a rate increase, that separate formula retroactively re-applied
/// the new (higher) rate across the *entire* elapsed time instead of just
/// the time since the last top-up, overstating how much had vested. Two
/// top-ups in a row could make it think the stream was almost fully vested
/// when it wasn't, spuriously rejecting a perfectly reasonable follow-up
/// top-up as "dust". This also meant, more broadly, that funds added via
/// top-up did not actually stream out progressively before the fix — they
/// were invisible to `unlocked_amount` until `end_time`.
#[test]
fn test_top_up_twice_then_withdraw_mid_stream() {
    let ctx = Ctx::new();
    let now = 1_000_000u64;
    ctx.set_time(now);
    let total = 1000i128;
    ctx.token().approve(
        &ctx.sender,
        &ctx.contract_id,
        &total,
        &(ctx.env.ledger().sequence() + 500),
    );
    let id = ctx.client().create_stream(
        &ctx.sender,
        &CreateStreamParams {
            recipient: ctx.recipient.clone(),
            token: ctx.token_id.clone(),
            total_amount: total,
            start_time: now,
            end_time: now + 1000,
            cliff_time: now,
            cliff_amount: 0,
        },
    );

    // First top-up, 990 tokens deposited: pulls the rate up sharply.
    ctx.set_time(now + 990);
    ctx.token().approve(
        &ctx.sender,
        &ctx.contract_id,
        &990i128,
        &(ctx.env.ledger().sequence() + 500),
    );
    ctx.client().top_up(&id, &990i128);

    // Second top-up a second later must not panic, and must not think the
    // stream is already almost fully vested.
    ctx.set_time(now + 991);
    ctx.token().approve(
        &ctx.sender,
        &ctx.contract_id,
        &1i128,
        &(ctx.env.ledger().sequence() + 500),
    );
    ctx.client().top_up(&id, &1i128);

    // With 9 seconds still remaining, funds must be streaming out
    // progressively rather than sitting locked until end_time.
    ctx.set_time(now + 995);
    let withdrawable = ctx.client().get_withdrawable(&id);
    assert!(withdrawable > 0);
    assert!(withdrawable < ctx.client().get_stream(&id).deposited_amount);
}

// ═══════════════════════════════════════════════════════════════════
// 10. RECIPIENT VALIDATION
// ═══════════════════════════════════════════════════════════════════

/// Reject stream with contract's own address as recipient.
#[test]
#[should_panic(expected = "recipient cannot be the contract itself")]
fn test_recipient_is_contract_rejected() {
    let ctx = Ctx::new();
    let now = 1_000_000u64;
    ctx.set_time(now);
    let total = 1_000_0000000i128;
    ctx.token().approve(
        &ctx.sender,
        &ctx.contract_id,
        &total,
        &(ctx.env.ledger().sequence() + 500),
    );
    ctx.client().create_stream(
        &ctx.sender,
        &CreateStreamParams {
            recipient: ctx.contract_id.clone(), // contract itself as recipient
            token: ctx.token_id.clone(),
            total_amount: total,
            start_time: now,
            end_time: now + 1000,
            cliff_time: now,
            cliff_amount: 0,
        },
    );
}

/// Accept stream with valid recipient address.
#[test]
fn test_valid_recipient_accepted() {
    let ctx = Ctx::new();
    let now = 1_000_000u64;
    ctx.set_time(now);
    let total = 1_000_0000000i128;
    ctx.token().approve(
        &ctx.sender,
        &ctx.contract_id,
        &total,
        &(ctx.env.ledger().sequence() + 500),
    );
    let id = ctx.client().create_stream(
        &ctx.sender,
        &CreateStreamParams {
            recipient: ctx.recipient.clone(), // valid recipient
            token: ctx.token_id.clone(),
            total_amount: total,
            start_time: now,
            end_time: now + 1000,
            cliff_time: now,
            cliff_amount: 0,
        },
    );
    // Should succeed
    assert!(id > 0);
}

// ═══════════════════════════════════════════════════════════════════
// 11. ARITHMETIC OVERFLOW IN unlocked_amount
// ═══════════════════════════════════════════════════════════════════

/// Regression test for the fund-freezing overflow bug in `unlocked_amount`.
///
/// Before the fix, `(elapsed * stream.linear_amount) / stream.duration` used
/// plain `i128` multiplication.  With `overflow-checks = true` and
/// `panic = "abort"` in the release profile this caused the Soroban runtime
/// to abort the transaction permanently, freezing any funds held by the stream
/// with no recovery path.
///
/// The fix uses `checked_mul` and returns `StreamError::ArithmeticOverflow`
/// instead of aborting, so the caller gets a typed error and the stream
/// remains accessible via its other entry-points (e.g. it could be cancelled
/// before the overflow window is reached).
///
/// ## How the overflow is triggered
///
/// The intermediate value `elapsed × linear_amount` overflows `i128` when
///
///   linear_amount  >  i128::MAX / elapsed
///
/// The worst-case `elapsed` inside the linear window is `duration - 1` seconds
/// (one second before `end_time`, where the early-return path would otherwise
/// skip the multiply).  Choosing
///
///   linear_amount = i128::MAX / (duration - 1) + 1
///
/// guarantees the product exceeds `i128::MAX` for `elapsed = duration - 1`,
/// while still satisfying every other `create_stream` invariant:
///
///   • `total_amount > 0`                                    ✓
///   • `duration <= MAX_STREAM_DURATION`                     ✓  (duration == MAX)
///   • `amount_per_second = linear_amount / duration >= 1`   ✓  (quotient >> 1)
///
/// Note: using `i128::MAX / duration` (i.e., dividing by `duration` not
/// `duration - 1`) would leave the product just *below* `i128::MAX` for
/// `elapsed = duration - 1` — no overflow.  The off-by-one matters.
#[test]
fn test_unlocked_amount_overflow_returns_error() {
    let ctx = Ctx::new();

    const MAX_STREAM_DURATION: u64 = 315_360_000; // mirrors the contract constant

    // Choose linear_amount just large enough to overflow when multiplied by
    // the worst-case elapsed inside the linear window (duration - 1 seconds).
    //
    // The condition for overflow is:
    //   elapsed × linear_amount > i128::MAX
    //   ⟺ linear_amount > i128::MAX / elapsed
    //
    // The largest elapsed inside the window is (duration - 1), so dividing by
    // (duration - 1) sets the threshold just below that worst-case, and adding
    // 1 guarantees overflow for elapsed = duration - 1.
    //
    // Using (duration) instead of (duration - 1) would leave the product just
    // inside i128::MAX for elapsed = duration - 1 (as the previous version of
    // this test discovered the hard way).
    let linear_amount: i128 = i128::MAX / (MAX_STREAM_DURATION as i128 - 1) + 1;
    let total_amount = linear_amount; // no cliff → linear_amount == total_amount

    let now = 1_000_000u64;
    let start = now;
    let end = start + MAX_STREAM_DURATION; // exactly at the cap — allowed
    let elapsed_at_query = MAX_STREAM_DURATION - 1; // one second before end_time;
                                                    // not divisible by MAX_STREAM_DURATION
                                                    // so the divide-first fast-path is skipped

    // Fund the sender with the enormous token balance.
    let asset = soroban_sdk::token::StellarAssetClient::new(&ctx.env, &ctx.token_id);
    asset.mint(&ctx.sender, &total_amount);

    ctx.token().approve(
        &ctx.sender,
        &ctx.contract_id,
        &total_amount,
        &(ctx.env.ledger().sequence() + 500),
    );

    ctx.set_time(now);
    let id = ctx.client().create_stream(
        &ctx.sender,
        &CreateStreamParams {
            recipient: ctx.recipient.clone(),
            token: ctx.token_id.clone(),
            total_amount,
            start_time: start,
            end_time: end,
            cliff_time: start, // no cliff delay
            cliff_amount: 0,
        },
    );

    // Advance time into the overflow window.
    ctx.set_time(start + elapsed_at_query);

    // ── get_withdrawable must return ArithmeticOverflow, not abort ────────
    let result = ctx.client().try_get_withdrawable(&id);
    assert_eq!(
        result,
        Err(Ok(StreamError::ArithmeticOverflow)),
        "expected ArithmeticOverflow from get_withdrawable, got {result:?}"
    );

    // ── withdraw must return ArithmeticOverflow, not abort ────────────────
    let result = ctx.client().try_withdraw(&id, &1);
    assert_eq!(
        result,
        Err(Ok(StreamError::ArithmeticOverflow)),
        "expected ArithmeticOverflow from withdraw, got {result:?}"
    );

    // ── cancel must return ArithmeticOverflow, not abort ─────────────────
    let result = ctx.client().try_cancel(&id);
    assert_eq!(
        result,
        Err(Ok(StreamError::ArithmeticOverflow)),
        "expected ArithmeticOverflow from cancel, got {result:?}"
    );

    // ── Once time passes end_time the short-circuit kicks in: no multiply
    //    is performed so the stream is fully accessible again. ─────────────
    ctx.set_time(end + 1);

    // get_withdrawable == total_amount (short-circuit path, no mul needed)
    let withdrawable = ctx.client().get_withdrawable(&id);
    assert_eq!(
        withdrawable, total_amount,
        "after end_time the full amount should be withdrawable via the short-circuit path"
    );

    // A full withdrawal must succeed.
    ctx.client().withdraw(&id, &total_amount);
    assert_eq!(ctx.token().balance(&ctx.recipient), total_amount);
    assert_eq!(ctx.token().balance(&ctx.contract_id), 0);
}
