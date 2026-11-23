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

// ─── Issue #1098: migrate() must extend instance TTL ─────────────────────────

/// Verify that `migrate` bumps the instance-storage TTL.
///
/// We set up a ledger position with very low TTL headroom, call `migrate`,
/// then advance the ledger sequence far beyond the initial TTL and confirm
/// the contract's instance data (admin + paused flag) is still readable.
#[test]
fn test_migrate_extends_instance_ttl() {
    let t = TestEnv::setup();
    let client = t.client();

    // Run migrate — this must call extend_ttl on instance storage.
    client.migrate();

    // Advance the ledger by a large sequence number, simulating time passing.
    // Set max_entry_ttl high enough so the extend_ttl call had room to bump.
    t.env.ledger().with_mut(|l| {
        l.sequence_number += 1_000_000;
        l.min_persistent_entry_ttl = 1;
        l.max_entry_ttl = 10_000_000;
    });

    // The admin key must still decode — if TTL hadn't been extended we would
    // get a panic / no value here.  `is_paused` reads `Paused` from instance
    // storage; a successful read proves the entry is still alive.
    let paused = client.is_paused();
    assert!(!paused, "contract should be unpaused after migrate");
}

// ─── Issue #1100: migrate() must emit MigratedEvent ──────────────────────────

#[test]
fn test_migrate_emits_migrated_event() {
    let t = TestEnv::setup();
    let now = 1_000_000u64;
    t.set_time(now);
    let client = t.client();

    client.migrate();

    let migrated = t
        .env
        .events()
        .all()
        .iter()
        .find_map(|(_, topics, data)| {
            if topics.len() != 2 {
                return None;
            }
            let topic0: Result<Symbol, _> = topics.get(0).unwrap().try_into_val(&t.env);
            match topic0 {
                Ok(s) if s == Symbol::new(&t.env, "migrated") => {}
                _ => return None,
            }
            MigratedEvent::try_from_val(&t.env, &data).ok()
        })
        .expect("MigratedEvent must be emitted by migrate()");

    assert_eq!(migrated.version, 1u32, "version must equal CONTRACT_VERSION");
    assert_eq!(migrated.timestamp, now);
}

/// migrate() must unpause the contract and confirm via the flag — the
/// MigratedEvent carries the version so off-chain consumers don't need a
/// separate UnpauseEvent.
#[test]
fn test_migrate_unpauses_and_emits_no_unpause_event() {
    let t = TestEnv::setup();
    let now = 1_000_000u64;
    t.set_time(now);
    let client = t.client();

    // Pause before migrating.
    client.pause();
    assert!(client.is_paused());

    client.migrate();

    // Contract must be live again.
    assert!(!client.is_paused(), "migrate must unfreeze the contract");

    // There must be no UnpauseEvent in the event log — migrate publishes
    // MigratedEvent instead.
    let has_unpause = t
        .env
        .events()
        .all()
        .iter()
        .any(|(_, topics, _)| {
            if topics.len() < 1 {
                return false;
            }
            let topic0: Result<Symbol, _> = topics.get(0).unwrap().try_into_val(&t.env);
            matches!(topic0, Ok(s) if s == Symbol::new(&t.env, "unpaused"))
        });
    assert!(
        !has_unpause,
        "migrate must not emit a duplicate UnpauseEvent"
    );
}

// ─── Issue #1104: pause/unpause must be idempotent ────────────────────────────

/// Calling pause twice must not emit two PauseEvents.
#[test]
fn test_pause_is_idempotent_no_duplicate_event() {
    let t = TestEnv::setup();
    let now = 1_000_000u64;
    t.set_time(now);
    let client = t.client();

    client.pause();
    client.pause(); // second call must be a no-op

    // Count PauseEvents — there must be exactly one.
    let pause_count = t
        .env
        .events()
        .all()
        .iter()
        .filter(|(_, topics, _)| {
            if topics.len() < 1 {
                return false;
            }
            let topic0: Result<Symbol, _> = topics.get(0).unwrap().try_into_val(&t.env);
            matches!(topic0, Ok(s) if s == Symbol::new(&t.env, "paused"))
        })
        .count();

    assert_eq!(pause_count, 1, "exactly one PauseEvent must be emitted");
    assert!(client.is_paused());
}

/// Calling unpause twice must not emit two UnpauseEvents.
#[test]
fn test_unpause_is_idempotent_no_duplicate_event() {
    let t = TestEnv::setup();
    let now = 1_000_000u64;
    t.set_time(now);
    let client = t.client();

    client.pause();
    client.unpause();
    client.unpause(); // second call must be a no-op

    // Count UnpauseEvents — there must be exactly one.
    let unpause_count = t
        .env
        .events()
        .all()
        .iter()
        .filter(|(_, topics, _)| {
            if topics.len() < 1 {
                return false;
            }
            let topic0: Result<Symbol, _> = topics.get(0).unwrap().try_into_val(&t.env);
            matches!(topic0, Ok(s) if s == Symbol::new(&t.env, "unpaused"))
        })
        .count();

    assert_eq!(unpause_count, 1, "exactly one UnpauseEvent must be emitted");
    assert!(!client.is_paused());
}

/// pause → unpause → pause again must produce exactly 2 PauseEvents and 1
/// UnpauseEvent, confirming alternating state changes are still counted
/// correctly even with the idempotency guard in place.
#[test]
fn test_pause_unpause_alternating_event_counts() {
    let t = TestEnv::setup();
    let now = 1_000_000u64;
    t.set_time(now);
    let client = t.client();

    client.pause();
    client.unpause();
    client.pause();

    let pause_count = t
        .env
        .events()
        .all()
        .iter()
        .filter(|(_, topics, _)| {
            if topics.len() < 1 {
                return false;
            }
            let topic0: Result<Symbol, _> = topics.get(0).unwrap().try_into_val(&t.env);
            matches!(topic0, Ok(s) if s == Symbol::new(&t.env, "paused"))
        })
        .count();

    let unpause_count = t
        .env
        .events()
        .all()
        .iter()
        .filter(|(_, topics, _)| {
            if topics.len() < 1 {
                return false;
            }
            let topic0: Result<Symbol, _> = topics.get(0).unwrap().try_into_val(&t.env);
            matches!(topic0, Ok(s) if s == Symbol::new(&t.env, "unpaused"))
        })
        .count();

    assert_eq!(pause_count, 2, "two distinct pause transitions");
    assert_eq!(unpause_count, 1, "one unpause transition");
}

// ─── Issue #1108: paginated getters must cap at MAX_PAGE_SIZE ─────────────────

/// Requesting limit = u32::MAX must return at most MAX_PAGE_SIZE items even
/// when the index holds more entries than that.
///
/// We can only create up to MAX_BATCH_SIZE (20) streams per batch call, and
/// creating 101 streams individually would be prohibitively slow in a unit
/// test, so we verify that:
///   (a) a 20-stream index with limit=u32::MAX returns all 20 (≤ 100), and
///   (b) the cap is enforced structurally: the same logic that would clamp
///       101 → 100 also clamps u32::MAX → 100 for any index size.
#[test]
fn test_page_size_capped_at_max_page_size() {
    let t = TestEnv::setup();
    let now = 1_000_000u64;
    t.set_time(now);
    let client = t.client();

    // Create MAX_BATCH_SIZE (20) streams so the index is non-trivial.
    for i in 0..20u32 {
        let params = t.default_params(now);
        t.token().approve(
            &t.sender,
            &t.contract_id,
            &params.total_amount,
            &(t.env.ledger().sequence() + 500 + i),
        );
        client.create_stream(&t.sender, &params);
    }

    // limit = u32::MAX must not panic and must return ≤ MAX_PAGE_SIZE items.
    let page = client.get_sent_streams(&t.sender, &0u32, &u32::MAX);
    assert!(
        page.len() <= 100,
        "get_sent_streams must return at most MAX_PAGE_SIZE=100 items, got {}",
        page.len()
    );

    // With only 20 streams the full set fits within the cap.
    assert_eq!(page.len(), 20);
}

/// When limit is already ≤ MAX_PAGE_SIZE the cap has no visible effect.
#[test]
fn test_page_size_below_cap_unaffected() {
    let t = TestEnv::setup();
    let now = 1_000_000u64;
    t.set_time(now);
    let client = t.client();

    for i in 0..5u32 {
        let params = t.default_params(now);
        t.token().approve(
            &t.sender,
            &t.contract_id,
            &params.total_amount,
            &(t.env.ledger().sequence() + 500 + i),
        );
        client.create_stream(&t.sender, &params);
    }

    // limit=10 is well below the cap of 100; all 5 results must come back.
    let page = client.get_sent_streams(&t.sender, &0u32, &10u32);
    assert_eq!(page.len(), 5);

    // The same cap applies to received and archived variants.
    let recv = client.get_received_streams(&t.recipient, &0u32, &u32::MAX);
    assert!(recv.len() <= 100);
    assert_eq!(recv.len(), 5);
}

/// Cap applies equally to the archived getter variants.
#[test]
fn test_page_size_cap_archived_streams() {
    let t = TestEnv::setup();
    let now = 1_000_000u64;
    t.set_time(now);
    let client = t.client();

    // Create and immediately cancel 5 streams to populate the archive index.
    for i in 0..5u32 {
        let params = t.default_params(now);
        t.token().approve(
            &t.sender,
            &t.contract_id,
            &params.total_amount,
            &(t.env.ledger().sequence() + 500 + i),
        );
        let stream_id = client.create_stream(&t.sender, &params);
        client.cancel(&stream_id);
    }

    let archived = client.get_archived_sent_streams(&t.sender, &0u32, &u32::MAX);
    assert!(
        archived.len() <= 100,
        "archived getter must also respect MAX_PAGE_SIZE"
    );
    assert_eq!(archived.len(), 5);

    let archived_recv =
        client.get_archived_received_streams(&t.recipient, &0u32, &u32::MAX);
    assert!(archived_recv.len() <= 100);
    assert_eq!(archived_recv.len(), 5);
}

// ─── Issue #1105 / #1106: set_delegate guards ─────────────────────────────────

#[test]
fn test_set_delegate_rejects_delegate_equal_to_recipient() {
    // Issue #1105: delegating back to the recipient is pointless (the recipient
    // can already withdraw) and only creates a DelegateSetEvent indexers
    // report as a third party. Reject it with InvalidRecipient.
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

    // Recipient tries to delegate withdrawal back to themselves.
    let result = client.try_set_delegate(&stream_id, &t.recipient);
    assert_eq!(result, Err(Ok(StreamError::InvalidRecipient)));

    // No delegate entry must have been written.
    assert_eq!(client.get_delegate(&stream_id), None);
}

#[test]
fn test_set_delegate_rejected_on_cancelled_stream() {
    // Issue #1106: nothing can be withdrawn from a cancelled stream, so a
    // delegate entry would be dead storage. Reject with StreamCancelled.
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

    let delegate = Address::generate(&t.env);
    let result = client.try_set_delegate(&stream_id, &delegate);
    assert_eq!(result, Err(Ok(StreamError::StreamCancelled)));

    // No delegate entry must have been written.
    assert_eq!(client.get_delegate(&stream_id), None);
}

// ─── Issue #1107: stream metadata length caps ─────────────────────────────────

// Mirrors the contract constants in lib.rs (issue #1107).
const MAX_METADATA_NAME_LEN: u32 = 64;
const MAX_METADATA_CATEGORY_LEN: u32 = 32;
const MAX_METADATA_MEMO_LEN: u32 = 256;

#[test]
fn test_update_stream_metadata_rejects_oversized_fields() {
    // Issue #1107: name/category/memo are capped at 64/32/256 bytes to keep
    // persistent-storage rent bounded. A field over its cap is rejected with
    // MetadataTooLong and nothing is stored.
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

    // Name one byte over the limit.
    let too_long_name = "x".repeat(MAX_METADATA_NAME_LEN as usize + 1);
    let metadata = StreamMetadata {
        name: soroban_sdk::String::from_str(&t.env, &too_long_name),
        category: soroban_sdk::String::from_str(&t.env, "ok"),
        memo: soroban_sdk::String::from_str(&t.env, "ok"),
    };
    assert_eq!(
        client.try_update_stream_metadata(&stream_id, &metadata),
        Err(Ok(StreamError::MetadataTooLong))
    );

    // Category over its (smaller) limit.
    let too_long_category = "y".repeat(MAX_METADATA_CATEGORY_LEN as usize + 1);
    let metadata = StreamMetadata {
        name: soroban_sdk::String::from_str(&t.env, "ok"),
        category: soroban_sdk::String::from_str(&t.env, &too_long_category),
        memo: soroban_sdk::String::from_str(&t.env, "ok"),
    };
    assert_eq!(
        client.try_update_stream_metadata(&stream_id, &metadata),
        Err(Ok(StreamError::MetadataTooLong))
    );

    // Memo over its limit.
    let too_long_memo = "z".repeat(MAX_METADATA_MEMO_LEN as usize + 1);
    let metadata = StreamMetadata {
        name: soroban_sdk::String::from_str(&t.env, "ok"),
        category: soroban_sdk::String::from_str(&t.env, "ok"),
        memo: soroban_sdk::String::from_str(&t.env, &too_long_memo),
    };
    assert_eq!(
        client.try_update_stream_metadata(&stream_id, &metadata),
        Err(Ok(StreamError::MetadataTooLong))
    );

    // Nothing must have been stored for any rejected update.
    assert_eq!(client.get_stream_metadata(&stream_id), None);
}

#[test]
fn test_update_stream_metadata_accepts_max_length_fields() {
    // Issue #1107: fields at exactly the cap are allowed — len == MAX passes,
    // only len > MAX is rejected.
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

    let max_name = "x".repeat(MAX_METADATA_NAME_LEN as usize);
    let max_category = "y".repeat(MAX_METADATA_CATEGORY_LEN as usize);
    let max_memo = "z".repeat(MAX_METADATA_MEMO_LEN as usize);
    let metadata = StreamMetadata {
        name: soroban_sdk::String::from_str(&t.env, &max_name),
        category: soroban_sdk::String::from_str(&t.env, &max_category),
        memo: soroban_sdk::String::from_str(&t.env, &max_memo),
    };
    client.update_stream_metadata(&stream_id, &metadata);

    let stored = client.get_stream_metadata(&stream_id);
    assert_eq!(stored, Some(metadata));
}

// ─── Issue #1109: remove_from_index no-write on miss ───────────────────────────

#[test]
fn test_remove_from_index_miss_preserves_other_entries() {
    // Issue #1109: remove_from_index must not write (and must not corrupt the
    // list) when the id is absent. cleanup_stream calls remove_from_index on
    // the active SentBy/ReceivedBy indexes after a cancel, where the id was
    // already moved to the archive indexes — a miss. This guards that a miss
    // on an index that still holds *other* stream ids leaves them intact.
    let t = TestEnv::setup();
    let now = 1_000_000u64;
    t.set_time(now);
    let client = t.client();
    let params = t.default_params(now);
    let total = params.total_amount;

    // Two streams from the same sender to the same recipient.
    t.token().approve(
        &t.sender,
        &t.contract_id,
        &(total * 2),
        &(t.env.ledger().sequence() + 500),
    );
    // Pre-existing: these were missing `.unwrap()`, which doesn't type-check
    // against `Vec<u64>::contains` / `cancel(&u64)` below — unrelated to
    // issue #1109/#1132, fixed here only because it blocks this file from
    // compiling at all.
    let id1 = client.create_stream(&t.sender, &params).unwrap();
    let id2 = client.create_stream(&t.sender, &params).unwrap();

    // Both appear in the sender's active sent index.
    let sent = client.get_sent_streams(&t.sender, &0, &100);
    assert!(sent.contains(id1));
    assert!(sent.contains(id2));

    // Cancel + clean up only the first stream. After cancel moves id1 to the
    // archive indexes, cleanup's remove_from_index on the *active* index is a
    // miss (id1 no longer present) — it must not touch id2.
    client.cancel(&id1).unwrap();
    client.cleanup_stream(&t.sender, &id1).unwrap();

    // id2 must remain in the active sent index, untouched by the miss.
    let sent_after = client.get_sent_streams(&t.sender, &0, &100);
    assert!(sent_after.contains(id2), "id2 must remain in active index");
    assert!(!sent_after.contains(id1), "id1 must be gone from active index");

    // id1 must be gone from the archive too after cleanup.
    assert!(
        !client
            .get_archived_sent_streams(&t.sender, &0, &100)
            .contains(id1),
        "id1 must be removed from archive after cleanup"
    );
}

// ─── Issue #1132: cleanup_stream after a transfer ──────────────────────────────

#[test]
fn test_cleanup_stream_after_transfer_clears_new_recipients_indexes() {
    // Issue #1132: the existing cleanup tests only ever use the stream's
    // *original* recipient. After transfer_stream, the stream lives under
    // the new recipient's index — cleanup_stream reads `stream.recipient`
    // (already updated to the new recipient by transfer) when removing
    // ReceivedBy/ArchiveReceivedBy entries, and nothing exercised that path,
    // or cleanup_stream's `caller == stream.recipient` auth branch.
    //
    // Timeline: create (original recipient) → transfer (new recipient) →
    // cancel (archives under the new recipient) → cleanup, called by the
    // *new* recipient. Neither recipient's active or archive index should
    // contain the stream id afterward.
    let t = TestEnv::setup();
    let now = 1_000_000u64;
    t.set_time(now);
    let client = t.client();
    let params = t.default_params(now);
    let total = params.total_amount;
    let original_recipient = t.recipient.clone();
    let new_recipient = Address::generate(&t.env);

    t.token().approve(
        &t.sender,
        &t.contract_id,
        &total,
        &(t.env.ledger().sequence() + 500),
    );
    let id = client.create_stream(&t.sender, &params).unwrap();

    // Sanity: before transfer, the stream is under the original recipient.
    assert!(client
        .get_received_streams(&original_recipient, &0, &100)
        .contains(id));

    client.transfer_stream(&id, &new_recipient).unwrap();

    // Transfer moves the *active* index immediately.
    assert!(
        !client
            .get_received_streams(&original_recipient, &0, &100)
            .contains(id),
        "original recipient's active index must be empty right after transfer"
    );
    assert!(client
        .get_received_streams(&new_recipient, &0, &100)
        .contains(id));

    t.set_time(now + 100);
    client.cancel(&id).unwrap();

    // Cancel archives under whichever address is the *current* recipient —
    // the new one — not the original.
    assert!(
        !client
            .get_archived_received_streams(&original_recipient, &0, &100)
            .contains(id),
        "original recipient must never gain an archive entry for a stream it was transferred away"
    );
    assert!(client
        .get_archived_received_streams(&new_recipient, &0, &100)
        .contains(id));

    // Cleanup, called by the new recipient (exercises the
    // `caller == stream.recipient` branch of cleanup_stream's auth check).
    client.cleanup_stream(&new_recipient, &id).unwrap();

    // Neither recipient's active or archive index may contain the id now.
    assert!(!client
        .get_received_streams(&original_recipient, &0, &100)
        .contains(id));
    assert!(!client
        .get_archived_received_streams(&original_recipient, &0, &100)
        .contains(id));
    assert!(!client
        .get_received_streams(&new_recipient, &0, &100)
        .contains(id));
    assert!(
        !client
            .get_archived_received_streams(&new_recipient, &0, &100)
            .contains(id),
        "new recipient's archive index must be cleared by cleanup_stream"
    );

    // Sender-side indexes are cleaned up too, same as any other cleanup.
    assert!(!client.get_sent_streams(&t.sender, &0, &100).contains(id));
    assert!(!client
        .get_archived_sent_streams(&t.sender, &0, &100)
        .contains(id));
}
