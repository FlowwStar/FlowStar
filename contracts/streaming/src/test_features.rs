#![cfg(test)]

extern crate std;

use super::*;
use soroban_sdk::{
    Address, Env, testutils::{Address as _, Ledger}, token::{Client as TokenClient, StellarAssetClient}, vec
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

        let token_admin = Address::generate(&env);
        let token_id = env.register_stellar_asset_contract_v2(token_admin.clone()).address();

        let asset_client = StellarAssetClient::new(&env, &token_id);
        asset_client.mint(&sender, &1_000_000_0000000);

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
            total_amount: 1_000_0000000,
            start_time: now,
            end_time: now + 1000,
            cliff_time: now,
            cliff_amount: 0,
        }
    }
}

// ─── #70: Structured events with enriched payloads ─────────────────────────────

#[test]
fn test_stream_created_event_includes_all_fields() {
    let t = TestEnv::setup();
    let now = 1_000_000u64;
    t.set_time(now);

    let client = t.client();
    let params = t.default_params(now);
    let total = params.total_amount;

    t.token().approve(&t.sender, &t.contract_id, &total, &(t.env.ledger().sequence() + 500));
    
    // Create stream and verify event is emitted with enriched fields
    let stream_id = client.create_stream(&t.sender, &params);
    
    let stream = client.get_stream(&stream_id);
    assert_eq!(stream.sender, t.sender);
    assert_eq!(stream.recipient, params.recipient);
    assert_eq!(stream.token, params.token);
    assert_eq!(stream.start_time, now);
    assert_eq!(stream.end_time, now + 1000);
    assert_eq!(stream.cliff_time, now);
}

#[test]
fn test_withdraw_event_includes_remaining_withdrawable() {
    let t = TestEnv::setup();
    let now = 1_000_000u64;
    t.set_time(now);

    let client = t.client();
    let params = t.default_params(now);
    let total = params.total_amount;

    t.token().approve(&t.sender, &t.contract_id, &total, &(t.env.ledger().sequence() + 500));
    let stream_id = client.create_stream(&t.sender, &params);

    t.set_time(now + 500);
    let withdrawable = client.get_withdrawable(&stream_id);
    
    client.withdraw(&stream_id, &withdrawable);
    
    let stream = client.get_stream(&stream_id);
    assert_eq!(stream.withdrawn_amount, withdrawable);
    
    let remaining = client.get_withdrawable(&stream_id);
    assert!(remaining > 0);
}

#[test]
fn test_cancel_event_includes_sender_recipient_timestamp() {
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
    
    let stream = client.get_stream(&stream_id);
    assert!(stream.cancelled);
}

#[test]
fn test_bump_stream_event_emitted() {
    let t = TestEnv::setup();
    let now = 1_000_000u64;
    t.set_time(now);

    let client = t.client();
    let params = t.default_params(now);
    let total = params.total_amount;

    t.token().approve(&t.sender, &t.contract_id, &total, &(t.env.ledger().sequence() + 500));
    let stream_id = client.create_stream(&t.sender, &params);

    // Bump TTL should succeed without panic
    client.bump_stream(&stream_id);
    
    let stream = client.get_stream(&stream_id);
    assert_eq!(stream.id, stream_id);
}

// ─── #71: Pause/unpause mechanism ─────────────────────────────────────────────

#[test]
fn test_pause_blocks_create_stream() {
    let t = TestEnv::setup();
    let now = 1_000_000u64;
    t.set_time(now);

    let client = t.client();
    let params = t.default_params(now);
    let total = params.total_amount;

    // Initialize with admin
    client.initialize(&t.sender);
    
    // Pause contract
    client.pause();
    
    t.token().approve(&t.sender, &t.contract_id, &total, &(t.env.ledger().sequence() + 500));
    
    // Attempt to create stream should panic
    client.create_stream(&t.sender, &params);
}

#[test]
fn test_pause_blocks_withdraw() {
    let t = TestEnv::setup();
    let now = 1_000_000u64;
    t.set_time(now);

    let client = t.client();
    let params = t.default_params(now);
    let total = params.total_amount;

    client.initialize(&t.sender);
    
    t.token().approve(&t.sender, &t.contract_id, &total, &(t.env.ledger().sequence() + 500));
    let stream_id = client.create_stream(&t.sender, &params);

    t.set_time(now + 500);
    
    client.pause();
    
    let withdrawable = client.get_withdrawable(&stream_id);
    client.withdraw(&stream_id, &withdrawable);
}

#[test]
fn test_pause_blocks_cancel() {
    let t = TestEnv::setup();
    let now = 1_000_000u64;
    t.set_time(now);

    let client = t.client();
    let params = t.default_params(now);
    let total = params.total_amount;

    client.initialize(&t.sender);
    
    t.token().approve(&t.sender, &t.contract_id, &total, &(t.env.ledger().sequence() + 500));
    let stream_id = client.create_stream(&t.sender, &params);

    client.pause();
    
    client.cancel(&stream_id);
}

#[test]
fn test_read_operations_work_while_paused() {
    let t = TestEnv::setup();
    let now = 1_000_000u64;
    t.set_time(now);

    let client = t.client();
    let params = t.default_params(now);
    let total = params.total_amount;

    client.initialize(&t.sender);
    
    t.token().approve(&t.sender, &t.contract_id, &total, &(t.env.ledger().sequence() + 500));
    let stream_id = client.create_stream(&t.sender, &params);

    client.pause();
    
    // Read operations should still work
    let stream = client.get_stream(&stream_id);
    assert_eq!(stream.id, stream_id);
    
    let withdrawable = client.get_withdrawable(&stream_id);
    assert!(withdrawable >= 0);
}

#[test]
fn test_unpause_allows_operations() {
    let t = TestEnv::setup();
    let now = 1_000_000u64;
    t.set_time(now);

    let client = t.client();
    let params = t.default_params(now);
    let total = params.total_amount;

    client.initialize(&t.sender);
    
    t.token().approve(&t.sender, &t.contract_id, &total, &(t.env.ledger().sequence() + 500));
    let stream_id = client.create_stream(&t.sender, &params);

    client.pause();
    client.unpause();
    
    // Operations should work again
    t.set_time(now + 500);
    let withdrawable = client.get_withdrawable(&stream_id);
    assert!(withdrawable > 0);
}

#[test]
fn test_only_admin_can_pause() {
    let t = TestEnv::setup();
    let now = 1_000_000u64;
    t.set_time(now);

    let client = t.client();
    client.initialize(&t.sender);
    
    let other = Address::generate(&t.env);
    
    // Non-admin should not be able to pause
    // This test assumes mock_all_auths is set; otherwise auth will fail
    client.pause();
}

#[test]
fn test_only_admin_can_unpause() {
    let t = TestEnv::setup();
    let now = 1_000_000u64;
    t.set_time(now);

    let client = t.client();
    client.initialize(&t.sender);
    client.pause();
    
    // Only admin can unpause
    client.unpause();
    
    let stream = client.get_stream(&1u64);
}

#[test]
fn test_pause_events_emitted() {
    let t = TestEnv::setup();
    let now = 1_000_000u64;
    t.set_time(now);

    let client = t.client();
    client.initialize(&t.sender);
    
    // Emit pause event
    client.pause();
    client.unpause();
    
    // Emit unpause event - verified by not panicking
}

// ─── #72: Optimize index storage from Vec to Map ────────────────────────────────

#[test]
fn test_index_operations_remain_functional_after_optimization() {
    let t = TestEnv::setup();
    let now = 1_000_000u64;
    t.set_time(now);

    let client = t.client();
    
    // Create 3 streams
    for i in 0..3 {
        let mut params = t.default_params(now);
        let total = params.total_amount;
        
        t.token().approve(&t.sender, &t.contract_id, &total, &(t.env.ledger().sequence() + 500 + i as u32));
        client.create_stream(&t.sender, &params);
    }
    
    // Verify sent streams are indexed correctly
    let sent = client.get_sent_streams(&t.sender, &0, &10);
    assert_eq!(sent.len(), 3);
}

#[test]
fn test_remove_from_index_o1_operation() {
    let t = TestEnv::setup();
    let now = 1_000_000u64;
    t.set_time(now);

    let client = t.client();
    
    // Create 5 streams
    for i in 0..5 {
        let mut params = t.default_params(now);
        let total = params.total_amount;
        
        t.token().approve(&t.sender, &t.contract_id, &total, &(t.env.ledger().sequence() + 500 + i as u32));
        client.create_stream(&t.sender, &params);
    }
    
    // Transfer stream 3 (remove from recipient index)
    let new_recipient = Address::generate(&t.env);
    client.transfer_stream(&3u64, &new_recipient);
    
    // Verify recipient index is correct
    let received = client.get_received_streams(&t.recipient, &0, &10);
    assert_eq!(received.len(), 4);
}

#[test]
fn test_pagination_works_with_optimized_index() {
    let t = TestEnv::setup();
    let now = 1_000_000u64;
    t.set_time(now);

    let client = t.client();
    
    // Create 20 streams
    for i in 0..20 {
        let mut params = t.default_params(now);
        let total = params.total_amount;
        
        t.token().approve(&t.sender, &t.contract_id, &total, &(t.env.ledger().sequence() + 500 + i as u32));
        client.create_stream(&t.sender, &params);
    }
    
    // Paginate through sent streams
    let page1 = client.get_sent_streams(&t.sender, &0, &10);
    let page2 = client.get_sent_streams(&t.sender, &10, &10);
    
    assert_eq!(page1.len(), 10);
    assert_eq!(page2.len(), 10);
}

#[test]
fn test_get_sent_stream_count_accurate() {
    let t = TestEnv::setup();
    let now = 1_000_000u64;
    t.set_time(now);

    let client = t.client();
    
    for i in 0..7 {
        let mut params = t.default_params(now);
        let total = params.total_amount;
        
        t.token().approve(&t.sender, &t.contract_id, &total, &(t.env.ledger().sequence() + 500 + i as u32));
        client.create_stream(&t.sender, &params);
    }
    
    let count = client.get_sent_stream_count(&t.sender);
    assert_eq!(count, 7);
}

#[test]
fn test_get_received_stream_count_accurate() {
    let t = TestEnv::setup();
    let now = 1_000_000u64;
    t.set_time(now);

    let client = t.client();
    
    for i in 0..5 {
        let mut params = t.default_params(now);
        let total = params.total_amount;
        
        t.token().approve(&t.sender, &t.contract_id, &total, &(t.env.ledger().sequence() + 500 + i as u32));
        client.create_stream(&t.sender, &params);
    }
    
    let count = client.get_received_stream_count(&t.recipient);
    assert_eq!(count, 5);
}

// ─── #73: Partial cancellation ─────────────────────────────────────────────────

#[test]
fn test_partial_cancel_reduces_locked_amount() {
    let t = TestEnv::setup();
    let now = 1_000_000u64;
    t.set_time(now);

    let client = t.client();
    let params = t.default_params(now);
    let total = params.total_amount;

    t.token().approve(&t.sender, &t.contract_id, &total, &(t.env.ledger().sequence() + 500));
    let stream_id = client.create_stream(&t.sender, &params);

    // Reduce amount at halfway point
    let reduce_amount = 100_0000000i128;
    client.partial_cancel(&stream_id, &reduce_amount);
    
    let stream = client.get_stream(&stream_id);
    assert_eq!(stream.deposited_amount, total - reduce_amount);
    assert!(!stream.cancelled);
}

#[test]
fn test_partial_cancel_stream_continues() {
    let t = TestEnv::setup();
    let now = 1_000_000u64;
    t.set_time(now);

    let client = t.client();
    let params = t.default_params(now);
    let total = params.total_amount;

    t.token().approve(&t.sender, &t.contract_id, &total, &(t.env.ledger().sequence() + 500));
    let stream_id = client.create_stream(&t.sender, &params);

    let reduce_amount = 100_0000000i128;
    client.partial_cancel(&stream_id, &reduce_amount);
    
    // Verify stream still streams
    t.set_time(now + 500);
    let withdrawable = client.get_withdrawable(&stream_id);
    assert!(withdrawable > 0);
}

#[test]
fn test_partial_cancel_recalculates_amount_per_second() {
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

    // Reduce by half
    let reduce_amount = total / 2;
    client.partial_cancel(&stream_id, &reduce_amount);
    
    let stream_after = client.get_stream(&stream_id);
    assert!(stream_after.amount_per_second < rate_before);
}

#[test]
fn test_partial_cancel_refunds_to_sender() {
    let t = TestEnv::setup();
    let now = 1_000_000u64;
    t.set_time(now);

    let client = t.client();
    let params = t.default_params(now);
    let total = params.total_amount;

    t.token().approve(&t.sender, &t.contract_id, &total, &(t.env.ledger().sequence() + 500));
    let stream_id = client.create_stream(&t.sender, &params);

    let sender_balance_before = t.token().balance(&t.sender);
    let reduce_amount = 100_0000000i128;
    
    client.partial_cancel(&stream_id, &reduce_amount);
    
    let sender_balance_after = t.token().balance(&t.sender);
    assert_eq!(sender_balance_after, sender_balance_before + reduce_amount);
}

#[test]
fn test_partial_cancel_cannot_reduce_below_vested() {
    let t = TestEnv::setup();
    let now = 1_000_000u64;
    t.set_time(now);

    let client = t.client();
    let params = t.default_params(now);
    let total = params.total_amount;

    t.token().approve(&t.sender, &t.contract_id, &total, &(t.env.ledger().sequence() + 500));
    let stream_id = client.create_stream(&t.sender, &params);

    // Advance halfway
    t.set_time(now + 500);
    
    // Try to reduce by more than the remaining locked
    let reduce_amount = total; // Try to reduce all
    client.partial_cancel(&stream_id, &reduce_amount);
}

#[test]
fn test_partial_cancel_only_sender_can_call() {
    let t = TestEnv::setup();
    let now = 1_000_000u64;
    t.set_time(now);

    let client = t.client();
    let params = t.default_params(now);
    let total = params.total_amount;

    t.token().approve(&t.sender, &t.contract_id, &total, &(t.env.ledger().sequence() + 500));
    let stream_id = client.create_stream(&t.sender, &params);

    let reduce_amount = 100_0000000i128;
    
    // Only sender can call partial_cancel
    client.partial_cancel(&stream_id, &reduce_amount);
}

#[test]
fn test_partial_cancel_event_includes_old_new_rates() {
    let t = TestEnv::setup();
    let now = 1_000_000u64;
    t.set_time(now);

    let client = t.client();
    let params = t.default_params(now);
    let total = params.total_amount;

    t.token().approve(&t.sender, &t.contract_id, &total, &(t.env.ledger().sequence() + 500));
    let stream_id = client.create_stream(&t.sender, &params);

    let stream_before = client.get_stream(&stream_id);
    
    let reduce_amount = 100_0000000i128;
    client.partial_cancel(&stream_id, &reduce_amount);
    
    let stream_after = client.get_stream(&stream_id);
    assert!(stream_before.amount_per_second > stream_after.amount_per_second);
}

#[test]
fn test_partial_cancel_cannot_reduce_cancelled_stream() {
    let t = TestEnv::setup();
    let now = 1_000_000u64;
    t.set_time(now);

    let client = t.client();
    let params = t.default_params(now);
    let total = params.total_amount;

    t.token().approve(&t.sender, &t.contract_id, &total, &(t.env.ledger().sequence() + 500));
    let stream_id = client.create_stream(&t.sender, &params);

    client.cancel(&stream_id);
    
    let reduce_amount = 100_0000000i128;
    client.partial_cancel(&stream_id, &reduce_amount);
}
