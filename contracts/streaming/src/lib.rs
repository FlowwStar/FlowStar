//! # FlowStar Streaming Contract
//!
//! ## Storage Strategy
//!
//! This contract uses two Soroban storage tiers with different TTL policies:
//!
//! ### Instance storage (`env.storage().instance()`)
//! Holds small, contract-wide data that must always be available:
//! - `NextId` — global stream ID counter
//! - `Admin` — admin address for upgrade gating
//! - `Paused` — global pause flag
//!
//! Instance storage is cheap to keep alive because it shares a single ledger
//! entry for the whole contract. TTL is bumped to [`INSTANCE_TTL_LEDGERS`]
//! (~1 day) on every write so the contract stays accessible as long as it is
//! actively used.
//!
//! ### Persistent storage (`env.storage().persistent()`)
//! Holds per-stream and per-address data that must survive long-term:
//! - `Stream(id)` — full stream struct
//! - `SentBy(addr)` / `ReceivedBy(addr)` — active stream index lists
//! - `ArchiveSentBy(addr)` / `ArchiveReceivedBy(addr)` — completed/cancelled index lists
//! - `Delegate(id)` — optional withdrawal delegate per stream
//!
//! Each entry has its TTL bumped to [`PERSISTENT_TTL_LEDGERS`] (~30 days) on
//! every write. Streams that are not touched for 30 days become inaccessible
//! (the ledger entry expires) but can be renewed by anyone via [`bump_stream`].
//!
//! ### TTL math
//! Stellar produces a ledger roughly every 5 seconds.
//! ```text
//! INSTANCE_TTL_LEDGERS  = 17_280  →  17_280 × 5s = 86_400s  = ~1 day
//! PERSISTENT_TTL_LEDGERS = 518_400 → 518_400 × 5s = 2_592_000s = ~30 days
//! ```
//!
//! ### What happens when a TTL expires?
//! Soroban does **not** delete expired entries immediately — they become
//! *inaccessible* to the contract. Reads return `None`; writes restore the
//! entry with a fresh TTL. For stream data this means a stream that has not
//! been touched in >30 days will appear as "not found" until `bump_stream` is
//! called to restore its TTL.

#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, token, Address, Env, Vec,
    contract, contractimpl, contracttype, token, Address, BytesN, Env, Vec,
};

// ─── Constants ───────────────────────────────────────────────────────────────

const CONTRACT_VERSION: u32 = 1;
const CONTRACT_NAME: &str = "FlowStar Streaming";
const MAX_STREAM_DURATION: u64 = 315_360_000; // 10 years in seconds

/// TTL for instance storage entries (~1 day).
///
/// Stellar produces ~1 ledger every 5 seconds.
/// `17_280 ledgers × 5 s = 86_400 s = 24 h`
///
/// Instance storage (admin, pause flag, stream counter) is bumped to this
/// value on every write so the contract remains accessible as long as it is
/// being actively used.
const INSTANCE_TTL_LEDGERS: u32 = 17_280;

/// TTL for persistent storage entries (~30 days).
///
/// `518_400 ledgers × 5 s = 2_592_000 s ≈ 30 days`
///
/// Each stream struct and address-index list is bumped to this value on every
/// write. Streams that go untouched for longer than 30 days will appear as
/// "not found" until `bump_stream` is called to restore the TTL.
const PERSISTENT_TTL_LEDGERS: u32 = 518_400;

// ─── Storage Keys ────────────────────────────────────────────────────────────

#[contracttype]
pub enum DataKey {
    /// Global counter for next stream ID. Stored in Instance.
    NextId,
    /// Admin address for upgrade gating. Stored in Instance.
    Admin,

    /// Global upgrade pause / freeze. When set, prevents creating new streams.
    Paused,

    /// Whether a specific stream has already been migrated.
    Migrated(u64),

    /// Stream struct keyed by ID. Stored in Persistent.
    Stream(u64),

    /// Metadata for a stream, keyed by ID. Stored in Persistent.
    StreamMetadata(u64),

    /// Active stream IDs where address is the sender. Stored in Persistent.
    SentBy(Address),
    /// Active stream IDs where address is the recipient. Stored in Persistent.
    ReceivedBy(Address),
    /// Archived (completed/cancelled) stream IDs where address is the sender.
    ArchiveSentBy(Address),
    /// Archived (completed/cancelled) stream IDs where address is the recipient.
    ArchiveReceivedBy(Address),
}

// ─── Types ───────────────────────────────────────────────────────────────────

#[contracttype]
#[derive(Clone, Debug)]
pub struct Stream {
    pub id: u64,
    pub sender: Address,
    pub recipient: Address,
    /// Token contract address (SEP-41 compatible).
    pub token: Address,
    /// Total amount deposited into the stream (smallest unit).
    pub deposited_amount: i128,
    /// Amount already withdrawn by the recipient.
    pub withdrawn_amount: i128,
    /// Stream start time (UNIX seconds).
    pub start_time: u64,
    /// Stream end time (UNIX seconds).
    pub end_time: u64,
    /// Cliff time — nothing unlocks before this (UNIX seconds).
    pub cliff_time: u64,
    /// Amount unlocked immediately when cliff is reached.
    pub cliff_amount: i128,
    /// Linear unlock rate after cliff (smallest unit per second).
    pub amount_per_second: i128,
    /// Whether the stream has been cancelled.
    pub cancelled: bool,
    pub linear_amount: i128,
    pub duration: i128,
    /// Optional metadata attached to this stream.
    pub metadata: Option<StreamMetadata>,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct StreamMetadata {
    pub name: soroban_sdk::String,
    pub category: soroban_sdk::String,
    pub memo: soroban_sdk::String,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct CreateStreamParams {
    pub recipient: Address,
    pub token: Address,
    pub total_amount: i128,
    pub start_time: u64,
    pub end_time: u64,
    pub cliff_time: u64,
    pub cliff_amount: i128,
    pub metadata: Option<StreamMetadata>,
}

// ─── Errors ──────────────────────────────────────────────────────────────────

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum StreamError {
    InvalidAmount = 1,
    InvalidTimeRange = 2,
    InvalidCliff = 3,
    SelfStream = 4,
    StreamNotFound = 5,
    StreamCancelled = 6,
    Unauthorized = 7,
    InsufficientFunds = 8,
    StreamEnded = 9,
    SameRecipient = 10,
}

// ─── Events ───────────────────────────────────────────────────────────────────

#[soroban_sdk::contractevent]
pub struct StreamCreatedEvent {
    pub stream_id: u64,
    pub sender: Address,
    pub recipient: Address,
    pub token: Address,
    pub deposited_amount: i128,
    pub start_time: u64,
    pub end_time: u64,
    pub cliff_time: u64,
    pub timestamp: u64,
}

#[soroban_sdk::contractevent]
pub struct WithdrawEvent {
    pub stream_id: u64,
    pub recipient: Address,
    pub amount: i128,
    pub remaining_withdrawable: i128,
    pub timestamp: u64,
}

#[soroban_sdk::contractevent]
pub struct CancelEvent {
    pub stream_id: u64,
    pub sender: Address,
    pub recipient: Address,
    pub recipient_amount: i128,
    pub sender_refund: i128,
    pub timestamp: u64,
}

#[soroban_sdk::contractevent]
pub struct StreamTransferEvent {
    pub stream_id: u64,
    pub old_recipient: Address,
    pub new_recipient: Address,
}

#[soroban_sdk::contractevent]
pub struct TopUpEvent {
    pub stream_id: u64,
    pub additional_amount: i128,
    pub new_deposited_amount: i128,
    pub new_amount_per_second: i128,
}

#[soroban_sdk::contractevent]
pub struct StreamBumpedEvent {
    pub stream_id: u64,
    pub timestamp: u64,
}

#[soroban_sdk::contractevent]
pub struct PauseEvent {
    pub timestamp: u64,
}

#[soroban_sdk::contractevent]
pub struct UnpauseEvent {
    pub timestamp: u64,
}

#[soroban_sdk::contractevent]
pub struct PartialCancelEvent {
    pub stream_id: u64,
    pub reduce_amount: i128,
    pub old_rate: i128,
    pub new_rate: i128,
}

// ─── Contract ────────────────────────────────────────────────────────────────

#[contract]
pub struct StreamingContract;

#[contractimpl]
impl StreamingContract {
    // ── Admin: Initialize ────────────────────────────────────────────────────

    /// Initialize contract with admin address (one-time).
    pub fn initialize(env: Env, admin: Address) {
        admin.require_auth();

        let is_initialized = env.storage().instance().has(&DataKey::Admin);
        if is_initialized {
            panic!("already initialized");
        }

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Paused, &false);
        env.storage().instance().extend_ttl(INSTANCE_TTL_LEDGERS, INSTANCE_TTL_LEDGERS);
    }

    // ── Admin: Pause/Unpause ─────────────────────────────────────────────────

    /// Pause all write operations (admin only).
    pub fn pause(env: Env) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .unwrap_or_else(|| panic!("not initialized"));
        admin.require_auth();

        env.storage().instance().set(&DataKey::Paused, &true);
        env.storage().instance().extend_ttl(INSTANCE_TTL_LEDGERS, INSTANCE_TTL_LEDGERS);

        PauseEvent { timestamp: env.ledger().timestamp() }.publish(&env);
    }

    /// Unpause all write operations (admin only).
    pub fn unpause(env: Env) {
        let admin: Address = env
    // ── Write: Admin / Upgrade ───────────────────────────────────────────────

    /// Initialize the contract with an admin address.
    /// Can only be called once.
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Paused, &false);
        env.storage().instance().extend_ttl(INSTANCE_TTL_LEDGERS, INSTANCE_TTL_LEDGERS);
    }

    /// Upgrade the contract wasm. Only callable by the admin.
    pub fn upgrade(env: Env, admin: Address, new_wasm_hash: BytesN<32>) {
        admin.require_auth();
        let stored_admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        if admin != stored_admin {
            panic!("unauthorized");
        }
        env.deployer().update_current_contract_wasm(new_wasm_hash);
    }

    /// Post-upgrade data migration hook. Call this after an upgrade to
    /// migrate storage layouts.
    pub fn migrate(env: Env) {
        let _admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .unwrap_or_else(|| panic!("not initialized"));

        // By default, unfreeze after wasm upgrade.
        env.storage().instance().set(&DataKey::Paused, &false);
    }

    // ── Admin: Freeze / Unfreeze ─────────────────────────────────────────

    /// Admin freezes the contract to prevent new stream creation.
    pub fn freeze(env: Env, admin: Address) {
        admin.require_auth();
        Self::require_admin(&env, &admin);
        env.storage().instance().set(&DataKey::Paused, &true);
    }

    /// Admin freezes the contract to prevent new stream creation.
    /// Alias kept for compatibility.
    pub fn pause(env: Env, admin: Address) {
        Self::freeze(env, admin);
    }

    /// Admin unfreezes the contract to allow new stream creation.
    pub fn unfreeze(env: Env, admin: Address) {
        admin.require_auth();
        Self::require_admin(&env, &admin);
        env.storage().instance().set(&DataKey::Paused, &false);
        admin.require_auth();

        env.storage().instance().set(&DataKey::Paused, &false);
        env.storage().instance().extend_ttl(INSTANCE_TTL_LEDGERS, INSTANCE_TTL_LEDGERS);

        UnpauseEvent { timestamp: env.ledger().timestamp() }.publish(&env);
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    fn require_not_paused(env: &Env) {
        let paused: bool = env
            .storage()
            .instance()
            .get(&DataKey::Paused)
            .unwrap_or(false);
        if paused {
            panic!("contract is paused");
        }
    }
    }

    /// Return the current contract version.
    pub fn version(env: Env) -> u32 {
        let _ = env;
        1
    }

    // ── Write: Create ────────────────────────────────────────────────────────

    /// Create a new token stream.
    ///
    /// The caller must have already approved this contract to spend
    /// `total_amount` of `token` via the token's `approve()` function.
    ///
    /// Returns the new stream's ID.
    pub fn create_stream(
        env: Env,
        sender: Address,
        params: CreateStreamParams,
    ) -> Result<u64, StreamError> {
        sender.require_auth();
        Self::require_not_paused(&env);

        // ── Validate params ──────────────────────────────────────────────────
        if params.total_amount <= 0 {
            return Err(StreamError::InvalidAmount);
        }
        if params.end_time <= params.start_time {
            return Err(StreamError::InvalidTimeRange);
        }
        let duration = params.end_time - params.start_time;
        if duration > MAX_STREAM_DURATION {
            panic!("stream duration exceeds maximum");
        }
        if params.cliff_time < params.start_time || params.cliff_time > params.end_time {
            return Err(StreamError::InvalidCliff);
        }
        if params.cliff_amount < 0 || params.cliff_amount > params.total_amount {
            return Err(StreamError::InvalidCliff);
        }
        if params.recipient == sender {
            return Err(StreamError::SelfStream);
        }
        if params.recipient == env.current_contract_address() {
            panic!("recipient cannot be the contract itself");
        }

        let duration_i128 = duration as i128;
        let linear_amount = params.total_amount - params.cliff_amount;
        let amount_per_second = if duration > 0 {
            linear_amount / duration
        } else {
            0
        };

        // Security: Reject dust streams with zero rate when linear_amount > 0
        if amount_per_second == 0 && linear_amount > 0 {
            panic!("stream amount too small for duration — rate would be 0");
        }
        let amount_per_second = if duration_i128 > 0 { linear_amount / duration_i128 } else { 0 };

        // ── Pull funds from sender into contract ─────────────────────────────
        let token_client = token::Client::new(&env, &params.token);
        token_client.transfer_from(
            &env.current_contract_address(),
            &sender,
            &env.current_contract_address(),
            &params.total_amount,
        );

        // ── Assign ID ────────────────────────────────────────────────────────
        let id = Self::next_id(&env);

        let stream = Stream {
            id,
            sender: sender.clone(),
            recipient: params.recipient.clone(),
            token: params.token,
            deposited_amount: params.total_amount,
            withdrawn_amount: 0,
            start_time: params.start_time,
            end_time: params.end_time,
            cliff_time: params.cliff_time,
            cliff_amount: params.cliff_amount,
            amount_per_second,
            cancelled: false,
            linear_amount,
            duration,
            metadata: params.metadata.clone(),
        };

        // ── Persist stream ───────────────────────────────────────────────────
        env.storage()
            .persistent()
            .set(&DataKey::Stream(id), &stream);

        // ── Persist metadata separately if provided ──────────────────────────
        if let Some(ref meta) = params.metadata {
            env.storage()
                .persistent()
                .set(&DataKey::StreamMetadata(id), meta);
            env.storage().persistent().extend_ttl(
                &DataKey::StreamMetadata(id),
                518_400,
                518_400,
            );
        }

        Self::extend_stream_ttl(&env, id);

        // ── Update sender index ──────────────────────────────────────────────
        Self::push_to_index(&env, DataKey::SentBy(sender), id);

        // ── Update recipient index ───────────────────────────────────────────
        Self::push_to_index(&env, DataKey::ReceivedBy(params.recipient), id);

        StreamCreatedEvent {
            stream_id: id,
            deposited_amount: stream.deposited_amount,
            sender: sender.clone(),
            recipient: params.recipient.clone(),
            token: params.token.clone(),
            deposited_amount: stream.deposited_amount,
            start_time: params.start_time,
            end_time: params.end_time,
            cliff_time: params.cliff_time,
            timestamp: env.ledger().timestamp(),
        }
        .publish(&env);

        Ok(id)
    }

    // ── Write: Transfer ──────────────────────────────────────────────────────
    // ── Write: Transfer ────────────────────────────────────────────────────────

    /// Transfer a token stream right to a new address.
    pub fn transfer_stream(
        env: Env,
        stream_id: u64,
        new_recipient: Address,
    ) -> Result<(), StreamError> {
        let mut stream = Self::load_stream(&env, stream_id)?;
        stream.recipient.require_auth();
        let old_recipient = stream.recipient.clone();

        Self::require_not_paused(&env);
        let old_recipient = stream.recipient;

        if stream.cancelled {
            return Err(StreamError::StreamCancelled);
        }
        if new_recipient == old_recipient {
            return Err(StreamError::SameRecipient);
        }

        stream.recipient = new_recipient.clone();

        // ── Persist stream ───────────────────────────────────────────────────
        env.storage()
            .persistent()
            .set(&DataKey::Stream(stream_id), &stream);

        Self::remove_from_index(&env, DataKey::ReceivedBy(old_recipient.clone()), stream_id);
        Self::push_to_index(&env, DataKey::ReceivedBy(new_recipient.clone()), stream_id);

        StreamTransferEvent {
            stream_id,
            old_recipient,
            new_recipient,
        }
        .publish(&env);
        // Clear delegate on transfer
        env.storage()
            .persistent()
            .remove(&DataKey::Delegate(stream_id));

        StreamTransferEvent { stream_id, old_recipient, new_recipient }.publish(&env);
        Self::extend_stream_ttl(&env, stream_id);

        Ok(())
    }

    // ── Write: Top Up ─────────────────────────────────────────────────────────

    /// Top up an existing stream with additional funds.
    ///
    /// Increases `deposited_amount` and recalculates `amount_per_second` over
    /// the remaining stream duration.
    ///
    /// The caller must have approved this contract to spend `additional_amount`
    /// of the stream's token before calling.
    pub fn top_up(
        env: Env,
        stream_id: u64,
        additional_amount: i128,
    ) -> Result<(), StreamError> {
        let mut stream = Self::load_stream(&env, stream_id)?;
        stream.sender.require_auth();
        Self::require_not_paused(&env);

        if stream.cancelled {
            return Err(StreamError::StreamCancelled);
        }

        let now = env.ledger().timestamp();
        if now >= stream.end_time {
            return Err(StreamError::StreamEnded);
        }

        if additional_amount <= 0 {
            return Err(StreamError::InvalidAmount);
        }

        // ── Send funds ───────────────────────────────────────────────────────
        let token_client = token::Client::new(&env, &stream.token);
        token_client.transfer_from(
            &env.current_contract_address(),
            &stream.sender,
            &env.current_contract_address(),
            &additional_amount,
        );

        // ── Recalculate rate over remaining duration ──────────────────────────
        let remaining_seconds = (stream.end_time - now) as i128;

        let already_vested = Self::vested_amount(&stream, now);
        let remaining_deposited = stream
            .deposited_amount
            .checked_sub(already_vested)
            .expect("deposited < vested — invariant broken");

        let new_remaining = remaining_deposited
            .checked_add(additional_amount)
            .expect("remaining + additional overflow");

        let new_amount_per_second = if remaining_seconds > 0 {
            new_remaining / remaining_seconds
        } else {
            0
        };

        // Security: Reject dust streams with zero rate after top-up
        if new_amount_per_second == 0 && new_remaining > 0 {
            panic!("stream amount too small for remaining duration — rate would be 0");
        }

        stream.deposited_amount = stream
            .deposited_amount
            .checked_add(additional_amount)
            .expect("deposited_amount overflow");

        stream.amount_per_second = new_amount_per_second;

        env.storage()
            .persistent()
            .set(&DataKey::Stream(stream_id), &stream);

        Self::extend_stream_ttl(&env, stream_id);

        TopUpEvent {
            stream_id,
            additional_amount,
            new_deposited_amount: stream.deposited_amount,
            new_amount_per_second,
        }
        .publish(&env);

        Ok(())
    }

    // ── Write: Withdraw ──────────────────────────────────────────────────────

    /// Withdraw unlocked tokens from a stream.
    ///
    /// Only the recipient or their delegate can call this. Pass the exact amount to withdraw
    /// (must be ≤ withdrawable amount). Use `get_withdrawable` to query first.
    pub fn withdraw(env: Env, stream_id: u64, amount: i128) {
        let mut stream = Self::load_stream(&env, stream_id);
        let caller = env.invoker();

        // Check if caller is recipient or authorized delegate
        let is_recipient = caller == stream.recipient;
        let is_delegate = match Self::get_delegate(&env, stream_id) {
            Some(delegate) => caller == delegate,
            None => false,
        };

        if !is_recipient && !is_delegate {
            panic!("only recipient or delegate can withdraw");
        }
    pub fn withdraw(env: Env, stream_id: u64, amount: i128) -> Result<(), StreamError> {
        let mut stream = Self::load_stream(&env, stream_id)?;

        // Require auth from the actual recipient, not the delegate
        stream.recipient.require_auth();
        Self::require_not_paused(&env);

        if stream.cancelled {
            return Err(StreamError::StreamCancelled);
        }

        let now = env.ledger().timestamp();
        let withdrawable = Self::withdrawable_amount(&stream, now);

        if amount <= 0 || amount > withdrawable {
            return Err(StreamError::InsufficientFunds);
        }

        stream.withdrawn_amount += amount;
        let fully_drained = stream.withdrawn_amount >= stream.deposited_amount
            && env.ledger().timestamp() >= stream.end_time;

        env.storage()
            .persistent()
            .set(&DataKey::Stream(stream_id), &stream);

        Self::extend_stream_ttl(&env, stream_id);

        // When a stream is fully drained after end_time, move it to the archive.
        if fully_drained {
            Self::remove_from_index(&env, DataKey::SentBy(stream.sender.clone()), stream_id);
            Self::push_to_index(
                &env,
                DataKey::ArchiveSentBy(stream.sender.clone()),
                stream_id,
            );
            Self::remove_from_index(
                &env,
                DataKey::ReceivedBy(stream.recipient.clone()),
                stream_id,
            );
            Self::push_to_index(
                &env,
                DataKey::ArchiveReceivedBy(stream.recipient.clone()),
                stream_id,
            );
        }

        let token_client = token::Client::new(&env, &stream.token);
        token_client.transfer(&env.current_contract_address(), &stream.recipient, &amount);

        WithdrawEvent { stream_id, amount }.publish(&env);

        Ok(())
        let remaining_withdrawable = Self::withdrawable_amount(&stream, now);
        WithdrawEvent {
            stream_id,
            recipient: stream.recipient.clone(),
            amount,
            remaining_withdrawable,
            timestamp: now,
        }
        .publish(&env);
    }

    // ── Write: Cancel ────────────────────────────────────────────────────────

    /// Cancel a stream. Only the sender can cancel.
    ///
    /// Unlocked funds (as of now) go to the recipient.
    /// Remaining locked funds are returned to the sender.
    pub fn cancel(env: Env, stream_id: u64) -> Result<(), StreamError> {
        let mut stream = Self::load_stream(&env, stream_id)?;

        stream.sender.require_auth();
        Self::require_not_paused(&env);

        if stream.cancelled {
            return Err(StreamError::StreamCancelled);
        }

        let now = env.ledger().timestamp();
        let unlocked = Self::unlocked_amount(&stream, now);
        let recipient_owes = unlocked - stream.withdrawn_amount;
        let sender_gets_back = stream.deposited_amount - unlocked;

        stream.cancelled = true;

        env.storage()
            .persistent()
            .set(&DataKey::Stream(stream_id), &stream);

        Self::extend_stream_ttl(&env, stream_id);

        // Move from active to archive indexes.
        Self::remove_from_index(&env, DataKey::SentBy(stream.sender.clone()), stream_id);
        Self::push_to_index(
            &env,
            DataKey::ArchiveSentBy(stream.sender.clone()),
            stream_id,
        );
        Self::remove_from_index(
            &env,
            DataKey::ReceivedBy(stream.recipient.clone()),
            stream_id,
        );
        Self::push_to_index(
            &env,
            DataKey::ArchiveReceivedBy(stream.recipient.clone()),
            stream_id,
        );

        let token_client = token::Client::new(&env, &stream.token);

        // Send unlocked remainder to recipient (if any).
        if recipient_owes > 0 {
            token_client.transfer(
                &env.current_contract_address(),
                &stream.recipient,
                &recipient_owes,
            );
        }

        // Return locked portion to sender.
        if sender_gets_back > 0 {
            token_client.transfer(
                &env.current_contract_address(),
                &stream.sender,
                &sender_gets_back,
            );
        }

        CancelEvent {
            stream_id,
            sender: stream.sender.clone(),
            recipient: stream.recipient.clone(),
            recipient_amount: recipient_owes,
            sender_refund: sender_gets_back,
            timestamp: now,
        }
        .publish(&env);

        Ok(())
    }

    // ── Read: Stream data ────────────────────────────────────────────────────

    /// Get a stream by ID.
    pub fn get_stream(env: Env, stream_id: u64) -> Result<Stream, StreamError> {
        Self::load_stream(&env, stream_id)
    }

    /// Get the withdrawable amount for a stream at current ledger time.
    pub fn get_withdrawable(env: Env, stream_id: u64) -> Result<i128, StreamError> {
        let stream = Self::load_stream(&env, stream_id)?;
        let now = env.ledger().timestamp();
        Ok(Self::withdrawable_amount(&stream, now))
    }

    /// Get paginated stream IDs where `address` is the sender.
    pub fn get_sent_streams(env: Env, address: Address, offset: u32, limit: u32) -> Vec<u64> {
        let all: Vec<u64> = env
            .storage()
            .persistent()
            .get(&DataKey::SentBy(address))
            .unwrap_or(Vec::new(&env));
        let start = core::cmp::min(offset, all.len());
        let end = core::cmp::min(offset + limit, all.len());
        let mut result = Vec::new(&env);
        let mut i = start;
        while i < end {
            result.push_back(all.get(i).unwrap());
            i += 1;
        }
        result
    }

    /// Get paginated stream IDs where `address` is the recipient.
    pub fn get_received_streams(env: Env, address: Address, offset: u32, limit: u32) -> Vec<u64> {
        let all: Vec<u64> = env
            .storage()
            .persistent()
            .get(&DataKey::ReceivedBy(address))
            .unwrap_or(Vec::new(&env));
        let start = core::cmp::min(offset, all.len());
        let end = core::cmp::min(offset + limit, all.len());
        let mut result = Vec::new(&env);
        let mut i = start;
        while i < end {
            result.push_back(all.get(i).unwrap());
            i += 1;
        }
        result
    }

    /// Get total count of streams where `address` is the sender.
    pub fn get_sent_stream_count(env: Env, address: Address) -> u32 {
        env.storage()
            .persistent()
            .get::<_, Vec<u64>>(&DataKey::SentBy(address))
            .map(|v| v.len())
            .unwrap_or(0)
    }

    /// Get total count of streams where `address` is the recipient.
    pub fn get_received_stream_count(env: Env, address: Address) -> u32 {
        env.storage()
            .persistent()
            .get::<_, Vec<u64>>(&DataKey::ReceivedBy(address))
            .map(|v| v.len())
            .unwrap_or(0)
    }

    /// Get paginated archived stream IDs where `address` is the sender.
    pub fn get_archived_sent_streams(
        env: Env,
        address: Address,
        offset: u32,
        limit: u32,
    ) -> Vec<u64> {
        let all: Vec<u64> = env
            .storage()
            .persistent()
            .get(&DataKey::ArchiveSentBy(address))
            .unwrap_or(Vec::new(&env));
        let start = core::cmp::min(offset, all.len());
        let end = core::cmp::min(offset + limit, all.len());
        let mut result = Vec::new(&env);
        let mut i = start;
        while i < end {
            result.push_back(all.get(i).unwrap());
            i += 1;
        }
        result
    }

    /// Get paginated archived stream IDs where `address` is the recipient.
    pub fn get_archived_received_streams(
        env: Env,
        address: Address,
        offset: u32,
        limit: u32,
    ) -> Vec<u64> {
        let all: Vec<u64> = env
            .storage()
            .persistent()
            .get(&DataKey::ArchiveReceivedBy(address))
            .unwrap_or(Vec::new(&env));
        let start = core::cmp::min(offset, all.len());
        let end = core::cmp::min(offset + limit, all.len());
        let mut result = Vec::new(&env);
        let mut i = start;
        while i < end {
            result.push_back(all.get(i).unwrap());
            i += 1;
        }
        result
    }

    /// Manually remove a completed or cancelled stream's data and index entries.
    ///
    /// Either party (sender or recipient) may call this. The stream must be
    /// cancelled or fully drained before cleanup is allowed.
    pub fn cleanup_stream(env: Env, caller: Address, stream_id: u64) {
        caller.require_auth();

        let stream = Self::load_stream(&env, stream_id);

        // Only sender or recipient may clean up.
        if caller != stream.sender && caller != stream.recipient {
            panic!("only sender or recipient may clean up a stream");
        }

        let fully_drained = stream.withdrawn_amount >= stream.deposited_amount
            && env.ledger().timestamp() >= stream.end_time;

        if !stream.cancelled && !fully_drained {
            panic!("stream must be cancelled or fully completed before cleanup");
        }

        // Remove from all indexes (active + archive).
        Self::remove_from_index(&env, DataKey::SentBy(stream.sender.clone()), stream_id);
        Self::remove_from_index(
            &env,
            DataKey::ArchiveSentBy(stream.sender.clone()),
            stream_id,
        );
        Self::remove_from_index(
            &env,
            DataKey::ReceivedBy(stream.recipient.clone()),
            stream_id,
        );
        Self::remove_from_index(
            &env,
            DataKey::ArchiveReceivedBy(stream.recipient.clone()),
            stream_id,
        );

        // Delete stream data to reclaim storage.
        env.storage()
            .persistent()
            .remove(&DataKey::Stream(stream_id));
    }

    // ── Write: Bump TTL ──────────────────────────────────────────────────────

    /// Extend the TTL of a stream's persistent storage without modifying data.
    /// Anyone can call this to keep a long-running stream alive.
    pub fn bump_stream(env: Env, stream_id: u64) -> Result<(), StreamError> {
        Self::load_stream(&env, stream_id)?;
        Self::extend_stream_ttl(&env, stream_id);
        Ok(())

        StreamBumpedEvent {
            stream_id,
            timestamp: env.ledger().timestamp(),
        }
        .publish(&env);
    }

    // ── Metadata ──────────────────────────────────────────────────────────────

    /// Update the metadata for a stream. Only the sender can update.
    pub fn update_stream_metadata(
        env: Env,
        stream_id: u64,
        metadata: StreamMetadata,
    ) -> Result<(), StreamError> {
        let stream = Self::load_stream(&env, stream_id)?;
        stream.sender.require_auth();

        env.storage()
            .persistent()
            .set(&DataKey::StreamMetadata(stream_id), &metadata);
        env.storage().persistent().extend_ttl(
            &DataKey::StreamMetadata(stream_id),
            518_400,
            518_400,
        );

        Ok(())
    }

    /// Get the metadata for a stream.
    pub fn get_stream_metadata(env: Env, stream_id: u64) -> Option<StreamMetadata> {
        env.storage()
            .persistent()
            .get(&DataKey::StreamMetadata(stream_id))
    }

    /// Get the contract version.
    pub fn version(_env: Env) -> u32 {
        CONTRACT_VERSION
    }
    /// Get the contract name.
    pub fn name(env: Env) -> String {
        String::from_small_copy(&String::from_slice(&env, CONTRACT_NAME))
    }

    // ── Delegation ────────────────────────────────────────────────────────────

    /// Set a delegate who can withdraw on behalf of the recipient.
    pub fn set_delegate(env: Env, stream_id: u64, delegate: Address) {
        let stream = Self::load_stream(&env, stream_id);
        stream.recipient.require_auth();

        env.storage()
            .persistent()
            .set(&DataKey::Delegate(stream_id), &delegate);
        env.storage().persistent().extend_ttl(
            &DataKey::Delegate(stream_id),
            PERSISTENT_TTL_LEDGERS,
            PERSISTENT_TTL_LEDGERS,
        );
    }

    /// Remove the delegate for a stream.
    pub fn remove_delegate(env: Env, stream_id: u64) {
        let stream = Self::load_stream(&env, stream_id);
        stream.recipient.require_auth();

        env.storage()
            .persistent()
            .remove(&DataKey::Delegate(stream_id));
    }

    /// Get the delegate for a stream, if set.
    pub fn get_delegate(env: Env, stream_id: u64) -> Option<Address> {
        env.storage()
            .persistent()
            .get(&DataKey::Delegate(stream_id))
    }

    // ── Internal helpers ─────────────────────────────────────────────────────
    // ──── Internal helpers ─────────────────────────────────────────────────────

    fn require_admin(env: &Env, admin: &Address) {
        let stored_admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .unwrap_or_else(|| panic!("not initialized"));
        if admin != &stored_admin {
            panic!("unauthorized");
        }
    }

    fn require_not_paused(env: &Env) {
        let paused: bool = env
            .storage()
            .instance()
            .get(&DataKey::Paused)
            .unwrap_or(false);
        if paused {
            panic!("contract is paused");
        }
    }

    fn load_stream(env: &Env, id: u64) -> Result<Stream, StreamError> {
        env.storage()
            .persistent()
            .get(&DataKey::Stream(id))
            .ok_or(StreamError::StreamNotFound)
    }

    /// Compute total unlocked amount at `now` (UNIX seconds).
    fn unlocked_amount(stream: &Stream, now: u64) -> i128 {
        if now < stream.cliff_time {
            return 0;
        }
        if now >= stream.end_time {
            return stream.deposited_amount;
        }
        let elapsed = (now - stream.start_time) as i128;
        let linear = (elapsed * stream.linear_amount) / stream.duration;
        let unlocked = stream.cliff_amount + linear;
        // Cap at deposited (rounding safety).
        if unlocked > stream.deposited_amount {
            stream.deposited_amount
        } else {
            unlocked
        }
    }

    /// Amount the recipient can withdraw right now.
    fn withdrawable_amount(stream: &Stream, now: u64) -> i128 {
        if stream.cancelled {
            return 0;
        }
        let unlocked = Self::unlocked_amount(stream, now);
        let available = unlocked - stream.withdrawn_amount;
        if available > 0 {
            available
        } else {
            0
        }
    }

    /// Increment and return the next stream ID.
    fn next_id(env: &Env) -> u64 {
        let id: u64 = env
            .storage()
            .instance()
            .get(&DataKey::NextId)
            .unwrap_or(0u64);
        let next = id + 1;
        env.storage().instance().set(&DataKey::NextId, &next);
        env.storage().instance().extend_ttl(
            INSTANCE_TTL_LEDGERS,
            INSTANCE_TTL_LEDGERS,
        );
        next
    }

    /// Append a stream ID to an address index list.
    fn push_to_index(env: &Env, key: DataKey, id: u64) {
        let mut list: Vec<u64> = env
            .storage()
            .persistent()
            .get(&key)
            .unwrap_or(Vec::new(env));
        list.push_back(id);
        env.storage().persistent().set(&key, &list);
        env.storage().persistent().extend_ttl(&key, PERSISTENT_TTL_LEDGERS, PERSISTENT_TTL_LEDGERS);
    }

    /// Remove a stream ID from an address index list.
    fn remove_from_index(env: &Env, key: DataKey, id: u64) {
        let mut indexes: Vec<u64> = env
            .storage()
            .persistent()
            .get(&key)
            .unwrap_or(Vec::new(env));

        // Fix: use `existing_id` to avoid shadowing the outer `id` parameter.
        let position = indexes.iter().position(|existing_id| existing_id == id);
        let position = indexes.iter().position(|x| x == id);
        if let Some(i) = position {
            indexes.remove(i as u32);
        }

        env.storage().persistent().set(&key, &indexes);
    }

    /// Extend the TTL of all storage entries for a stream to [`PERSISTENT_TTL_LEDGERS`] (~30 days).
    ///
    /// Called automatically on every write that touches a stream. Can also be
    /// called manually via the public [`bump_stream`] function to keep a
    /// long-running stream alive without modifying its data.
    fn extend_stream_ttl(env: &Env, id: u64) {
        env.storage().persistent().extend_ttl(
            &DataKey::Stream(id),
            PERSISTENT_TTL_LEDGERS,
            PERSISTENT_TTL_LEDGERS,
        );
    }

    fn vested_amount(stream: &Stream, now: u64) -> i128 {
        if now < stream.cliff_time {
            return 0;
        }

        let elapsed = (now.min(stream.end_time) - stream.cliff_time) as i128;
        let linear = stream
            .amount_per_second
            .checked_mul(elapsed)
            .expect("amount_per_second * elapsed overflow");

        stream
            .cliff_amount
            .checked_add(linear)
            .expect("cliff_amount + linear overflow")
            .min(stream.deposited_amount)
    }
}

mod test;
mod test_security;
mod bench;
mod test_integration;
