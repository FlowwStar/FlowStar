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
    // Only grant attacker's auth — recipient auth is missing.
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

// ═══════════════════════════════════════════════════════════════════
// 2. NON-EXISTENT STREAM
// ═══════════════════════════════════════════════════════════════════

#[test]
#[should_panic(expected = "stream not found")]
fn test_get_nonexistent_stream() {
    let ctx = Ctx::new();
    ctx.client().get_stream(&9999);
}

#[test]
#[should_panic(expected = "stream not found")]
fn test_withdraw_nonexistent_stream() {
    let ctx = Ctx::new();
    ctx.set_time(1_000_000);
    ctx.client().withdraw(&9999, &1_0000000);
}

#[test]
#[should_panic(expected = "stream not found")]
fn test_cancel_nonexistent_stream() {
    let ctx = Ctx::new();
    ctx.set_time(1_000_000);
    ctx.client().cancel(&9999);
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
    // Drain final remainder after end.
    ctx.set_time(now + 2000);
    let final_w = ctx.client().get_withdrawable(&id);
    if final_w > 0 {
        ctx.client().withdraw(&id, &final_w);
        total_withdrawn += final_w;
    }

    assert!(total_withdrawn <= total);
    assert!(ctx.token().balance(&ctx.recipient) <= total);
    // Rounding dust only — less than 1 stroop per second of stream duration.
    assert!(ctx.token().balance(&ctx.contract_id) < 1000);
}

#[test]
#[should_panic(expected = "invalid withdraw amount")]
fn test_withdraw_more_than_withdrawable() {
    let ctx = Ctx::new();
    let now = 1_000_000u64;
    ctx.set_time(now);
    let id = ctx.create_basic_stream(now);
    ctx.set_time(now + 500);
    let withdrawable = ctx.client().get_withdrawable(&id);
    ctx.client().withdraw(&id, &(withdrawable + 1));
}

#[test]
#[should_panic(expected = "invalid withdraw amount")]
fn test_withdraw_zero() {
    let ctx = Ctx::new();
    let now = 1_000_000u64;
    ctx.set_time(now);
    let id = ctx.create_basic_stream(now);
    ctx.set_time(now + 500);
    ctx.client().withdraw(&id, &0);
}

#[test]
#[should_panic(expected = "invalid withdraw amount")]
fn test_withdraw_negative_amount() {
    let ctx = Ctx::new();
    let now = 1_000_000u64;
    ctx.set_time(now);
    let id = ctx.create_basic_stream(now);
    ctx.set_time(now + 500);
    ctx.client().withdraw(&id, &-1);
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

    // Recipient withdraws first.
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

    // Every token accounted for.
    assert_eq!(recipient_got + sender_got + dust, total - w);
    assert!(dust < 1000);
}

/// Recipient fully drains stream, then sender cancels — no panic, no double-pay.
#[test]
fn test_cancel_after_full_withdrawal() {
    let ctx = Ctx::new();
    let now = 1_000_000u64;
    ctx.set_time(now);
    let id = ctx.create_basic_stream(now);
    let total = 1_000_0000000i128;

    ctx.set_time(now + 2000); // past end
    ctx.client().withdraw(&id, &total);

    ctx.client().cancel(&id);

    assert!(ctx.client().get_stream(&id).cancelled);
    assert_eq!(ctx.token().balance(&ctx.contract_id), 0);
}

/// Cancel before stream starts — sender recovers full deposit.
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
    );

    let sender_before = ctx.token().balance(&ctx.sender);
    ctx.client().cancel(&id);

    assert_eq!(ctx.token().balance(&ctx.sender) - sender_before, total);
    assert_eq!(ctx.token().balance(&ctx.recipient), 0);
    assert_eq!(ctx.token().balance(&ctx.contract_id), 0);
}

/// Cancel at exact end_time — recipient gets everything, sender gets nothing.
#[test]
fn test_cancel_at_end_time() {
    let ctx = Ctx::new();
    let now = 1_000_000u64;
    ctx.set_time(now);
    let id = ctx.create_basic_stream(now);
    let total = 1_000_0000000i128;

    ctx.set_time(now + 1000); // exactly at end
    let sender_before = ctx.token().balance(&ctx.sender);
    ctx.client().cancel(&id);

    // All unlocked → recipient gets it, sender gets 0.
    assert_eq!(ctx.token().balance(&ctx.sender), sender_before);
    assert_eq!(ctx.token().balance(&ctx.recipient), total);
    assert_eq!(ctx.token().balance(&ctx.contract_id), 0);
}

// ═══════════════════════════════════════════════════════════════════
// 5. CLIFF EDGE CASES
// ═══════════════════════════════════════════════════════════════════

/// cliff_amount == total_amount: everything unlocks at cliff, nothing linear after.
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
            cliff_amount: total, // 100% cliff
        },
    );

    // Before cliff — nothing.
    ctx.set_time(now + 199);
    assert_eq!(ctx.client().get_withdrawable(&id), 0);

    // At cliff — full amount available.
    ctx.set_time(now + 200);
    assert_eq!(ctx.client().get_withdrawable(&id), total);

    // Well after cliff — still just total, no double-counting.
    ctx.set_time(now + 800);
    assert_eq!(ctx.client().get_withdrawable(&id), total);
}

/// cliff_time == end_time: nothing unlocks until the stream ends.
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
            cliff_time: now + 1000, // cliff == end
            cliff_amount: 500_0000000,
        },
    );

    // One second before end — still 0.
    ctx.set_time(now + 999);
    assert_eq!(ctx.client().get_withdrawable(&id), 0);

    // At end — full deposit (end_time branch returns deposited_amount).
    ctx.set_time(now + 1000);
    assert_eq!(ctx.client().get_withdrawable(&id), total);
}

/// Withdraw exactly at cliff moment works correctly.
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
    );

    ctx.set_time(now + 200); // exactly at cliff
    let w = ctx.client().get_withdrawable(&id);
    assert!(w > 0);
    ctx.client().withdraw(&id, &w); // must not panic

    // After withdrawal, contract balance reduced correctly.
    assert_eq!(ctx.token().balance(&ctx.recipient), w);
}

/// Before cliff: nothing withdrawable even though stream has started.
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
    );

    ctx.set_time(now + 499);
    assert_eq!(ctx.client().get_withdrawable(&id), 0);
}

#[test]
#[should_panic(expected = "invalid withdraw amount")]
fn test_withdraw_before_cliff_panics() {
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
    );

    ctx.set_time(now + 100); // before cliff
    ctx.client().withdraw(&id, &1_0000000); // must panic
}

// ═══════════════════════════════════════════════════════════════════
// 6. ROUNDING / INTEGER MATH
// ═══════════════════════════════════════════════════════════════════

/// Amount not evenly divisible by duration — dust stays in contract,
/// recipient never gets more than deposited.
#[test]
fn test_rounding_dust_stays_in_contract() {
    let ctx = Ctx::new();
    let now = 1_000_000u64;
    ctx.set_time(now);
    // 1_000_000_0000001 stroops over 999 seconds — does not divide evenly.
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
    );

    // After end — full deposit must be available (end_time branch caps at deposited).
    ctx.set_time(now + 1000);
    let w = ctx.client().get_withdrawable(&id);
    assert_eq!(w, total);
    ctx.client().withdraw(&id, &w);
    assert_eq!(ctx.token().balance(&ctx.recipient), total);
    assert_eq!(ctx.token().balance(&ctx.contract_id), 0);
}

/// Large realistic amounts (1B tokens, 7 decimals, 1-year stream) don't overflow.
#[test]
fn test_large_amounts_no_overflow() {
    let ctx = Ctx::new();
    let now = 1_000_000u64;
    ctx.set_time(now);
    let large_total = 1_000_000_000_0000000i128; // 1B tokens

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
            end_time: now + 31_536_000, // 1 year
            cliff_time: now,
            cliff_amount: 0,
        },
    );

    ctx.set_time(now + 15_768_000); // halfway
    let w = ctx.client().get_withdrawable(&id);
    assert!(w > 0);
    assert!(w < large_total);

    ctx.set_time(now + 31_536_001); // past end
    assert_eq!(ctx.client().get_withdrawable(&id), large_total);
}

/// Very short 1-second stream works correctly.
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
            end_time: now + 1, // 1 second duration
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
// 8. CREATE PARAM VALIDATION
// ═══════════════════════════════════════════════════════════════════

#[test]
#[should_panic(expected = "cliff_time must be between start_time and end_time")]
fn test_cliff_before_start_time() {
    let ctx = Ctx::new();
    let now = 1_000_000u64;
    ctx.set_time(now);
    let total = 1_000_0000000i128;
    ctx.token().approve(&ctx.sender, &ctx.contract_id, &total, &(ctx.env.ledger().sequence() + 500));
    ctx.client().create_stream(
        &ctx.sender,
        &CreateStreamParams {
            recipient: ctx.recipient.clone(),
            token: ctx.token_id.clone(),
            total_amount: total,
            start_time: now,
            end_time: now + 1000,
            cliff_time: now - 1, // invalid: before start
            cliff_amount: 0,
        },
    );
}

#[test]
#[should_panic(expected = "cliff_time must be between start_time and end_time")]
fn test_cliff_after_end_time() {
    let ctx = Ctx::new();
    let now = 1_000_000u64;
    ctx.set_time(now);
    let total = 1_000_0000000i128;
    ctx.token().approve(&ctx.sender, &ctx.contract_id, &total, &(ctx.env.ledger().sequence() + 500));
    ctx.client().create_stream(
        &ctx.sender,
        &CreateStreamParams {
            recipient: ctx.recipient.clone(),
            token: ctx.token_id.clone(),
            total_amount: total,
            start_time: now,
            end_time: now + 1000,
            cliff_time: now + 1001, // invalid: after end
            cliff_amount: 0,
        },
    );
}

#[test]
#[should_panic(expected = "cliff_amount must be between 0 and total_amount")]
fn test_cliff_amount_exceeds_total() {
    let ctx = Ctx::new();
    let now = 1_000_000u64;
    ctx.set_time(now);
    let total = 1_000_0000000i128;
    ctx.token().approve(&ctx.sender, &ctx.contract_id, &total, &(ctx.env.ledger().sequence() + 500));
    ctx.client().create_stream(
        &ctx.sender,
        &CreateStreamParams {
            recipient: ctx.recipient.clone(),
            token: ctx.token_id.clone(),
            total_amount: total,
            start_time: now,
            end_time: now + 1000,
            cliff_time: now,
            cliff_amount: total + 1, // invalid: exceeds total
        },
    );
}

#[test]
#[should_panic(expected = "cliff_amount must be between 0 and total_amount")]
fn test_negative_cliff_amount() {
    let ctx = Ctx::new();
    let now = 1_000_000u64;
    ctx.set_time(now);
    let total = 1_000_0000000i128;
    ctx.token().approve(&ctx.sender, &ctx.contract_id, &total, &(ctx.env.ledger().sequence() + 500));
    ctx.client().create_stream(
        &ctx.sender,
        &CreateStreamParams {
            recipient: ctx.recipient.clone(),
            token: ctx.token_id.clone(),
            total_amount: total,
            start_time: now,
            end_time: now + 1000,
            cliff_time: now,
            cliff_amount: -1, // invalid: negative
        },
    );
}

#[test]
#[should_panic(expected = "total_amount must be > 0")]
fn test_negative_total_amount() {
    let ctx = Ctx::new();
    let now = 1_000_000u64;
    ctx.set_time(now);
    ctx.client().create_stream(
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
}

#[test]
#[should_panic(expected = "end_time must be > start_time")]
fn test_end_time_equals_start_time() {
    let ctx = Ctx::new();
    let now = 1_000_000u64;
    ctx.set_time(now);
    let total = 1_000_0000000i128;
    ctx.token().approve(&ctx.sender, &ctx.contract_id, &total, &(ctx.env.ledger().sequence() + 500));
    ctx.client().create_stream(
        &ctx.sender,
        &CreateStreamParams {
            recipient: ctx.recipient.clone(),
            token: ctx.token_id.clone(),
            total_amount: total,
            start_time: now,
            end_time: now, // invalid: equal
            cliff_time: now,
            cliff_amount: 0,
        },
    );
}
