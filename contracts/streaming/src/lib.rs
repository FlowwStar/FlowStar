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
//! Time-To-Live (TTL) is measured in ledgers rather than seconds directly.
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
// Amounts are grouped to separate whole units from the 7-decimal-place
// fractional part (e.g. `1_000_0000000` = 1000 units), not by strict
// thousands — clearer for this domain than clippy's default suggestion.
#![allow(clippy::inconsistent_digit_grouping)]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, token, Address, BytesN, Env, Vec,
};

// ─── Constants ───────────────────────────────────────────────────────────────

const CONTRACT_VERSION: u32 = 1;
const CONTRACT_NAME: &str = "FlowStar Streaming";
const MAX_STREAM_DURATION: u64 = 315_360_000; // 10 years in seconds
const MAX_BATCH_SIZE: u32 = 20;

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

    /// Optional withdrawal delegate for a stream. Stored in Persistent.
    Delegate(u64),
}

// ─── Types ───────────────────────────────────────────────────────────────────

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct Stream {
    /// Unique identifier for the stream.
    pub id: u64,
    /// Address of the stream sender.
    pub sender: Address,
    /// Address of the stream recipient.
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
    /// Total amount to be streamed linearly after cliff (total - cliff).
    pub linear_amount: i128,
    /// Total duration of the stream in seconds (end_time - start_time).
    pub duration: i128,
}

/// Optional metadata attached to a stream.
///
/// Metadata does not affect stream mechanics — it is purely for off-chain
/// indexing and UI display by frontends. All fields are user-defined strings.
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct StreamMetadata {
    /// Human-readable name for the stream (e.g., "Q3 Salary").
    pub name: soroban_sdk::String,
    /// Category or type tag (e.g., "salary", "vesting", "grant", "scholarship").
    pub category: soroban_sdk::String,
    /// Optional memo or description (e.g., "Monthly payroll for engineering team").
    pub memo: soroban_sdk::String,
}

#[contracttype]
#[derive(Clone, Debug)]
/// Parameters required to initialize and start a stream.
pub struct CreateStreamParams {
    /// Unique identifier for the stream recipient.
    pub recipient: Address,
    pub token: Address,
    /// Total amount of tokens allocated for the stream duration.
    pub total_amount: i128,
    /// Unix timestamp marking when token streaming begins.
    pub start_time: u64,
    pub end_time: u64,
    pub cliff_time: u64,
    /// Amount of tokens unlocked immediately at start_time.
    pub cliff_amount: i128,
}

/// Input parameters for a single stream in a batch creation call.
///
/// Mirrors [`CreateStreamParams`] but is a distinct type so that it can be
/// evolved independently without affecting the single-stream API surface.
#[contracttype]
#[derive(Clone, Debug)]
pub struct CreateStreamInput {
    pub recipient: Address,
    pub token: Address,
    pub total_amount: i128,
    pub start_time: u64,
    pub end_time: u64,
    pub cliff_time: u64,
    pub cliff_amount: i128,
}

// ─── Errors ──────────────────────────────────────────────────────────────────

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum StreamError {
    /// The amount is zero, negative, or the top-up amount is insufficient.
    InvalidAmount = 1,
    /// The end_time is not strictly greater than start_time, or duration exceeds 10 years.
    InvalidTimeRange = 2,
    /// The cliff_time is outside the [start_time, end_time] range or cliff_amount is invalid.
    InvalidCliff = 3,
    /// The sender and recipient addresses are the same.
    SelfStream = 4,
    /// The requested stream ID does not exist or has expired from storage.
    StreamNotFound = 5,
    /// The stream has already been cancelled and cannot be modified.
    StreamCancelled = 6,
    /// The caller is not authorized for this operation (wrong sender/recipient/delegate/admin).
    Unauthorized = 7,
    /// Insufficient withdrawable or locked balance, or transfer would fail.
    InsufficientFunds = 8,
    /// The stream has already ended (current time >= end_time), cannot perform operation.
    StreamEnded = 9,
    /// The transfer_stream recipient is identical to the current recipient.
    SameRecipient = 10,
    /// Batch size exceeds the maximum allowed (20 streams per batch).
    BatchSizeExceeded = 11,
    /// Batch cannot be empty.
    BatchEmpty = 12,
    /// Arithmetic overflow in vesting calculation (e.g. elapsed × linear_amount
    /// overflows i128). The stream's funds are not lost — the stream is still
    /// stored — but the parameters that were accepted at creation time produce
    /// an unrepresentable intermediate value.  The caller should treat this the
    /// same way they treat any other hard error (surface it to the user; do not
    /// silently swallow it).
    ArithmeticOverflow = 13,
    /// Contract has already been initialized.
    AlreadyInitialized = 14,
    /// Contract has not been initialized yet.
    NotInitialized = 15,
    /// All write operations are paused.
    ContractPaused = 16,
    /// Stream duration exceeds the maximum allowed value.
    DurationExceedsMaximum = 17,
    /// Recipient address must not be the contract itself.
    InvalidRecipient = 18,
    /// Stream amount is too small for the duration — the per-second rate would be zero.
    RateIsZero = 19,
    /// Stream is not yet cancelled or fully drained; cleanup is not allowed.
    StreamNotEligibleForCleanup = 20,
}

// ─── Events ───────────────────────────────────────────────────────────────────

/// Emitted when a new stream is created via `create_stream` or `create_streams_batch`.
///
/// Indexers should record this to show stream origination time and initial terms.
/// The `cliff_time` field indicates when the first unlock (cliff) occurs; before
/// this time, `withdrawable_amount` will be zero.
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

/// Emitted when the recipient (or delegate) withdraws unlocked tokens via `withdraw`.
///
/// The `remaining_withdrawable` is the amount still available to withdraw at this
/// moment (after the withdrawal is recorded). Frontends can use this to update
/// live counters and show "you have X more to withdraw".
#[soroban_sdk::contractevent]
pub struct WithdrawEvent {
    pub stream_id: u64,
    pub recipient: Address,
    pub amount: i128,
    pub remaining_withdrawable: i128,
    pub timestamp: u64,
}

/// Emitted when the sender cancels a stream via `cancel`.
///
/// The stream is moved to cancelled state; the recipient receives `recipient_amount`
/// (all unlocked tokens as of the cancellation moment) and the sender receives
/// `sender_refund` (all remaining locked tokens). Both amounts are non-negative.
#[soroban_sdk::contractevent]
pub struct CancelEvent {
    pub stream_id: u64,
    pub sender: Address,
    pub recipient: Address,
    pub recipient_amount: i128,
    pub sender_refund: i128,
    pub timestamp: u64,
}

/// Emitted when the recipient transfers stream rights to a new address via `transfer_stream`.
///
/// After this event, `new_recipient` becomes the new owner of the stream and can
/// withdraw or transfer further. The `old_recipient` loses all rights to the stream.
/// Any delegate set on the stream is cleared on transfer.
#[soroban_sdk::contractevent]
pub struct StreamTransferEvent {
    pub stream_id: u64,
    pub old_recipient: Address,
    pub new_recipient: Address,
}

/// Emitted when the sender adds additional funds to an active stream via `top_up`.
///
/// The `additional_amount` is added to the stream's total; the rate per second
/// (`new_amount_per_second`) is recalculated based on the remaining time. The new
/// rate applies from the top-up moment onward (vesting is re-anchored).
#[soroban_sdk::contractevent]
pub struct TopUpEvent {
    pub stream_id: u64,
    pub additional_amount: i128,
    pub new_deposited_amount: i128,
    pub new_amount_per_second: i128,
}

/// Emitted when anyone calls `bump_stream` to extend a stream's ledger TTL.
///
/// This event indicates the stream's storage was kept alive. Streams are
/// automatically bumped on write; this is for explicit manual bumps to prevent
/// expiry of long-idle streams. Indexers can use this to track which streams
/// are still actively maintained.
#[soroban_sdk::contractevent]
pub struct StreamBumpedEvent {
    pub stream_id: u64,
    pub timestamp: u64,
}

/// Emitted when the contract admin calls `pause` to stop new stream creation.
///
/// All write operations (create_stream, withdraw, etc.) are blocked while paused.
/// Read operations remain available. Use `unpause` to resume normal operations.
#[soroban_sdk::contractevent]
pub struct PauseEvent {
    pub timestamp: u64,
}

/// Emitted when the contract admin calls `unpause` to resume normal operations.
///
/// After this event, all write operations are once again available.
#[soroban_sdk::contractevent]
pub struct UnpauseEvent {
    pub timestamp: u64,
}

// ─── Contract ────────────────────────────────────────────────────────────────

#[contract]
pub struct StreamingContract;

#[contractimpl]
impl StreamingContract {
    // ── Admin: Initialize ────────────────────────────────────────────────────

    /// Initialize contract with admin address (one-time).
    pub fn initialize(env: Env, admin: Address) -> Result<(), StreamError> {
        admin.require_auth();

        let is_initialized = env.storage().instance().has(&DataKey::Admin);
        if is_initialized {
            return Err(StreamError::AlreadyInitialized);
        }

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Paused, &false);
        env.storage()
            .instance()
            .extend_ttl(INSTANCE_TTL_LEDGERS, INSTANCE_TTL_LEDGERS);
        Ok(())
    }

    // ── Admin: Pause/Unpause ─────────────────────────────────────────────────

    /// Pause all write operations (admin only).
    pub fn pause(env: Env) -> Result<(), StreamError> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(StreamError::NotInitialized)?;
        admin.require_auth();

        env.storage().instance().set(&DataKey::Paused, &true);
        env.storage()
            .instance()
            .extend_ttl(INSTANCE_TTL_LEDGERS, INSTANCE_TTL_LEDGERS);

        PauseEvent {
            timestamp: env.ledger().timestamp(),
        }
        .publish(&env);
        Ok(())
    }

    /// Unpause all write operations (admin only).
    pub fn unpause(env: Env) -> Result<(), StreamError> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(StreamError::NotInitialized)?;
        admin.require_auth();

        env.storage().instance().set(&DataKey::Paused, &false);
        env.storage()
            .instance()
            .extend_ttl(INSTANCE_TTL_LEDGERS, INSTANCE_TTL_LEDGERS);

        UnpauseEvent {
            timestamp: env.ledger().timestamp(),
        }
        .publish(&env);
        Ok(())
    }

    // ── Write: Admin / Upgrade ───────────────────────────────────────────────

    /// Upgrade the contract wasm. Only callable by the admin.
    ///
    /// # Errors
    /// - [`StreamError::NotInitialized`] — contract has not been initialized yet.
    /// - [`StreamError::Unauthorized`]   — caller does not match the stored admin.
    pub fn upgrade(env: Env, admin: Address, new_wasm_hash: BytesN<32>) -> Result<(), StreamError> {
        admin.require_auth();
        let stored_admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(StreamError::NotInitialized)?;
        if admin != stored_admin {
            return Err(StreamError::Unauthorized);
        }
        env.deployer().update_current_contract_wasm(new_wasm_hash);
        Ok(())
    }

    /// Post-upgrade data migration hook. Call this after an upgrade to
    /// migrate storage layouts.
    pub fn migrate(env: Env) -> Result<(), StreamError> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(StreamError::NotInitialized)?;
        admin.require_auth();

        // By default, unfreeze after wasm upgrade.
        env.storage().instance().set(&DataKey::Paused, &false);
        Ok(())
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    fn require_not_paused(env: &Env) -> Result<(), StreamError> {
        let paused: bool = env
            .storage()
            .instance()
            .get(&DataKey::Paused)
            .unwrap_or(false);
        if paused {
            return Err(StreamError::ContractPaused);
        }
        Ok(())
    }

    fn compute_rate(
        total: i128,
        cliff_amount: i128,
        duration: u64,
    ) -> Result<(i128, i128, i128), StreamError> {
        let duration_i128 = duration as i128;
        let linear_amount = total - cliff_amount;
        let amount_per_second = if duration_i128 > 0 {
            linear_amount / duration_i128
        } else {
            0
        };

        // Security: Reject dust streams with zero rate when linear_amount > 0
        if amount_per_second == 0 && linear_amount > 0 {
            return Err(StreamError::RateIsZero);
        }

        Ok((linear_amount, duration_i128, amount_per_second))
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
        Self::require_not_paused(&env)?;

        // ── Validate params ──────────────────────────────────────────────────
        if params.total_amount <= 0 {
            return Err(StreamError::InvalidAmount);
        }
        if params.end_time <= params.start_time {
            return Err(StreamError::InvalidTimeRange);
        }
        let duration = params.end_time - params.start_time;
        if duration > MAX_STREAM_DURATION {
            return Err(StreamError::DurationExceedsMaximum);
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
            return Err(StreamError::InvalidRecipient);
        }

        let (linear_amount, duration_i128, amount_per_second) =
            Self::compute_rate(params.total_amount, params.cliff_amount, duration)?;

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
            token: params.token.clone(),
            deposited_amount: params.total_amount,
            withdrawn_amount: 0,
            start_time: params.start_time,
            end_time: params.end_time,
            cliff_time: params.cliff_time,
            cliff_amount: params.cliff_amount,
            amount_per_second,
            cancelled: false,
            linear_amount,
            duration: duration_i128,
        };

        // ── Persist stream ───────────────────────────────────────────────────
        env.storage()
            .persistent()
            .set(&DataKey::Stream(id), &stream);

        Self::extend_stream_ttl(&env, id);

        // ── Update sender index ──────────────────────────────────────────────
        Self::push_to_index(&env, DataKey::SentBy(sender.clone()), id);

        // ── Update recipient index ───────────────────────────────────────────
        Self::push_to_index(&env, DataKey::ReceivedBy(params.recipient.clone()), id);

        StreamCreatedEvent {
            stream_id: id,
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

    // ── Write: Batch Create ──────────────────────────────────────────────────

    /// Create multiple token streams in a single atomic transaction.
    ///
    /// # Atomicity
    /// All streams are validated before any funds are transferred. If any stream
    /// fails validation, the entire batch is rejected with no side-effects.
    ///
    /// # Token Approval
    /// The sender must have approved this contract to spend the **sum** of all
    /// `total_amount` values across all streams via the token's `approve()`
    /// before calling. Streams that use different tokens require separate
    /// approvals for each token.
    ///
    /// # Limits
    /// A maximum of 20 streams per batch is enforced to stay within Soroban
    /// resource limits. Exceeding this returns [`StreamError::BatchSizeExceeded`].
    ///
    /// # Returns
    /// A [`Vec<u64>`] of newly created stream IDs in the same order as the
    /// input `streams` vector.
    pub fn create_streams_batch(
        env: Env,
        sender: Address,
        streams: Vec<CreateStreamInput>,
    ) -> Result<Vec<u64>, StreamError> {
        sender.require_auth();
        Self::require_not_paused(&env)?;

        if streams.is_empty() {
            return Err(StreamError::BatchEmpty);
        }
        if streams.len() > MAX_BATCH_SIZE {
            return Err(StreamError::BatchSizeExceeded);
        }

        // ── Phase 1: Validate all streams before touching funds ──────────────
        // This guarantees atomicity — no partial state is created on error.
        for input in streams.iter() {
            if input.total_amount <= 0 {
                return Err(StreamError::InvalidAmount);
            }
            if input.end_time <= input.start_time {
                return Err(StreamError::InvalidTimeRange);
            }
            let duration = input.end_time - input.start_time;
            if duration > MAX_STREAM_DURATION {
                return Err(StreamError::DurationExceedsMaximum);
            }
            if input.cliff_time < input.start_time || input.cliff_time > input.end_time {
                return Err(StreamError::InvalidCliff);
            }
            if input.cliff_amount < 0 || input.cliff_amount > input.total_amount {
                return Err(StreamError::InvalidCliff);
            }
            if input.recipient == sender {
                return Err(StreamError::SelfStream);
            }
            if input.recipient == env.current_contract_address() {
                return Err(StreamError::InvalidRecipient);
            }
            // Validate rate would be non-zero when linear amount > 0
            Self::compute_rate(input.total_amount, input.cliff_amount, duration)?;
        }

        // ── Phase 2: Create each stream ──────────────────────────────────────
        let mut created_ids: Vec<u64> = Vec::new(&env);

        for input in streams.iter() {
            let duration = input.end_time - input.start_time;
            let (linear_amount, duration_i128, amount_per_second) =
                Self::compute_rate(input.total_amount, input.cliff_amount, duration)?;

            // Pull funds from sender into contract
            let token_client = token::Client::new(&env, &input.token);
            token_client.transfer_from(
                &env.current_contract_address(),
                &sender,
                &env.current_contract_address(),
                &input.total_amount,
            );

            let id = Self::next_id(&env);

            let stream = Stream {
                id,
                sender: sender.clone(),
                recipient: input.recipient.clone(),
                token: input.token.clone(),
                deposited_amount: input.total_amount,
                withdrawn_amount: 0,
                start_time: input.start_time,
                end_time: input.end_time,
                cliff_time: input.cliff_time,
                cliff_amount: input.cliff_amount,
                amount_per_second,
                cancelled: false,
                linear_amount,
                duration: duration_i128,
            };

            env.storage()
                .persistent()
                .set(&DataKey::Stream(id), &stream);
            Self::extend_stream_ttl(&env, id);

            Self::push_to_index(&env, DataKey::SentBy(sender.clone()), id);
            Self::push_to_index(&env, DataKey::ReceivedBy(input.recipient.clone()), id);

            StreamCreatedEvent {
                stream_id: id,
                sender: sender.clone(),
                recipient: input.recipient.clone(),
                token: input.token.clone(),
                deposited_amount: input.total_amount,
                start_time: input.start_time,
                end_time: input.end_time,
                cliff_time: input.cliff_time,
                timestamp: env.ledger().timestamp(),
            }
            .publish(&env);

            created_ids.push_back(id);
        }

        Ok(created_ids)
    }

    // ── Write: Transfer ──────────────────────────────────────────────────────

    /// Transfer a token stream right to a new address.
    pub fn transfer_stream(
        env: Env,
        stream_id: u64,
        new_recipient: Address,
    ) -> Result<(), StreamError> {
        let mut stream = Self::load_stream(&env, stream_id)?;
        stream.recipient.require_auth();
        let old_recipient = stream.recipient.clone();

        Self::require_not_paused(&env)?;

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

        // Clear delegate on transfer
        env.storage()
            .persistent()
            .remove(&DataKey::Delegate(stream_id));

        StreamTransferEvent {
            stream_id,
            old_recipient,
            new_recipient,
        }
        .publish(&env);
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
    pub fn top_up(env: Env, stream_id: u64, additional_amount: i128) -> Result<(), StreamError> {
        let mut stream = Self::load_stream(&env, stream_id)?;
        stream.sender.require_auth();
        Self::require_not_paused(&env)?;

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

        stream.deposited_amount = stream
            .deposited_amount
            .checked_add(additional_amount)
            .expect("deposited_amount overflow");

        // ── Re-anchor the vesting schedule ──────────────────────────────────
        //
        // `unlocked_amount` is the single source of truth for how much has
        // vested (it's what withdraw/cancel use too), so top-up must feed it
        // back in rather than keeping its own separate vesting math — that
        // divergence used to let `top_up`'s bookkeeping drift out of sync
        // with what a recipient could actually withdraw.
        let remaining_seconds = (stream.end_time - now) as i128;

        if now >= stream.cliff_time {
            // Past the cliff: freeze what's unlocked so far as a new
            // "cliff" at `now`, and spread everything still owed (the old
            // remainder plus the top-up) linearly across the remaining
            // time. This keeps already-unlocked funds untouched while
            // making the top-up actually stream out instead of sitting
            // inert until end_time.
            let already_unlocked = Self::unlocked_amount(&stream, now)?;
            let remaining = stream
                .deposited_amount
                .checked_sub(already_unlocked)
                .expect("deposited < unlocked — invariant broken");

            let new_rate = if remaining_seconds > 0 {
                remaining / remaining_seconds
            } else {
                0
            };
            if new_rate == 0 && remaining > 0 {
                return Err(StreamError::RateIsZero);
            }

            stream.cliff_time = now;
            stream.cliff_amount = already_unlocked;
            stream.start_time = now;
            stream.linear_amount = remaining;
            stream.duration = remaining_seconds;
            stream.amount_per_second = new_rate;
        } else {
            // Still before the cliff: the cliff bonus hasn't unlocked yet,
            // so leave it untouched and just grow the linear portion.
            stream.linear_amount = stream
                .linear_amount
                .checked_add(additional_amount)
                .expect("linear_amount overflow");
            let new_rate = if stream.duration > 0 {
                stream.linear_amount / stream.duration
            } else {
                0
            };
            if new_rate == 0 && stream.linear_amount > 0 {
                return Err(StreamError::RateIsZero);
            }
            stream.amount_per_second = new_rate;
        }

        env.storage()
            .persistent()
            .set(&DataKey::Stream(stream_id), &stream);

        Self::extend_stream_ttl(&env, stream_id);

        TopUpEvent {
            stream_id,
            additional_amount,
            new_deposited_amount: stream.deposited_amount,
            new_amount_per_second: stream.amount_per_second,
        }
        .publish(&env);

        Ok(())
    }

    // ── Write: Withdraw ──────────────────────────────────────────────────────

    /// Withdraw unlocked tokens from a stream.
    ///
    /// Authorization rules:
    /// - If no delegate is registered, the stream's **recipient** must authorize.
    /// - If a delegate is registered via [`set_delegate`], the **delegate** must
    ///   authorize instead.  The delegate withdraws on behalf of the recipient
    ///   (tokens are still sent to the recipient's address).  The recipient is
    ///   locked out while a delegate is active; call [`remove_delegate`] first to
    ///   restore direct-recipient access.
    ///
    /// Pass the exact amount to withdraw (must be ≤ the withdrawable amount).
    /// Use [`get_withdrawable`] to query the available amount first.
    pub fn withdraw(env: Env, stream_id: u64, amount: i128) -> Result<(), StreamError> {
        let mut stream = Self::load_stream(&env, stream_id)?;

        // Delegate, when registered, has exclusive withdrawal authority.
        // If no delegate is set the recipient authorises directly.
        if let Some(delegate) = Self::get_delegate(env.clone(), stream_id) {
            delegate.require_auth();
        } else {
            stream.recipient.require_auth();
        }
        Self::require_not_paused(&env)?;

        if stream.cancelled {
            return Err(StreamError::StreamCancelled);
        }

        let now = env.ledger().timestamp();
        let withdrawable = Self::withdrawable_amount(&stream, now)?;

        if amount <= 0 || amount > withdrawable {
            return Err(StreamError::InsufficientFunds);
        }

        stream.withdrawn_amount = stream
            .withdrawn_amount
            .checked_add(amount)
            .expect("withdrawn_amount overflow");
        let fully_drained =
            stream.withdrawn_amount >= stream.deposited_amount && now >= stream.end_time;

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

        let remaining_withdrawable = Self::withdrawable_amount(&stream, now)?;
        WithdrawEvent {
            stream_id,
            recipient: stream.recipient.clone(),
            amount,
            remaining_withdrawable,
            timestamp: now,
        }
        .publish(&env);

        Ok(())
    }

    // ── Write: Cancel ────────────────────────────────────────────────────────

    /// Cancel a stream. Only the sender can cancel.
    ///
    /// Unlocked funds (as of now) go to the recipient.
    /// Remaining locked funds are returned to the sender.
    pub fn cancel(env: Env, stream_id: u64) -> Result<(), StreamError> {
        let mut stream = Self::load_stream(&env, stream_id)?;

        stream.sender.require_auth();
        Self::require_not_paused(&env)?;

        if stream.cancelled {
            return Err(StreamError::StreamCancelled);
        }

        let now = env.ledger().timestamp();
        let unlocked = Self::unlocked_amount(&stream, now)?;
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
        Self::withdrawable_amount(&stream, now)
    }

    /// Get paginated stream IDs where `address` is the sender.
    pub fn get_sent_streams(env: Env, address: Address, offset: u32, limit: u32) -> Vec<u64> {
        let all: Vec<u64> = env
            .storage()
            .persistent()
            .get(&DataKey::SentBy(address))
            .unwrap_or(Vec::new(&env));
        let len = all.len();
        let start = core::cmp::min(offset, len);
        let end = if let Some(limit_end) = offset.checked_add(limit) {
            core::cmp::min(limit_end, len)
        } else {
            len
        };
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
        let len = all.len();
        let start = core::cmp::min(offset, len);
        let end = if let Some(limit_end) = offset.checked_add(limit) {
            core::cmp::min(limit_end, len)
        } else {
            len
        };
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
        let len = all.len();
        let start = core::cmp::min(offset, len);
        let end = if let Some(limit_end) = offset.checked_add(limit) {
            core::cmp::min(limit_end, len)
        } else {
            len
        };
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
        let len = all.len();
        let start = core::cmp::min(offset, len);
        let end = if let Some(limit_end) = offset.checked_add(limit) {
            core::cmp::min(limit_end, len)
        } else {
            len
        };
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
    pub fn cleanup_stream(env: Env, caller: Address, stream_id: u64) -> Result<(), StreamError> {
        caller.require_auth();

        let stream = Self::load_stream(&env, stream_id)?;

        // Only sender or recipient may clean up.
        if caller != stream.sender && caller != stream.recipient {
            return Err(StreamError::Unauthorized);
        }

        let fully_drained = stream.withdrawn_amount >= stream.deposited_amount
            && env.ledger().timestamp() >= stream.end_time;

        if !stream.cancelled && !fully_drained {
            return Err(StreamError::StreamNotEligibleForCleanup);
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

        // Remove optional associated entries (StreamMetadata and Delegate).
        // These are always removed unconditionally — remove() is a no-op when
        // the key is absent, so the has() guards are unnecessary.
        env.storage()
            .persistent()
            .remove(&DataKey::StreamMetadata(stream_id));
        env.storage()
            .persistent()
            .remove(&DataKey::Delegate(stream_id));

        Ok(())
    }

    // ── Write: Bump TTL ──────────────────────────────────────────────────────

    /// Extend the TTL of a stream's persistent storage without modifying data.
    /// Anyone can call this to keep a long-running stream alive.
    pub fn bump_stream(env: Env, stream_id: u64) -> Result<(), StreamError> {
        Self::load_stream(&env, stream_id)?;
        Self::extend_stream_ttl(&env, stream_id);

        StreamBumpedEvent {
            stream_id,
            timestamp: env.ledger().timestamp(),
        }
        .publish(&env);

        Ok(())
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
            PERSISTENT_TTL_LEDGERS,
            PERSISTENT_TTL_LEDGERS,
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
    pub fn name(env: Env) -> soroban_sdk::String {
        soroban_sdk::String::from_str(&env, CONTRACT_NAME)
    }

    // ── Delegation ────────────────────────────────────────────────────────────

    /// Set a delegate who can withdraw on behalf of the recipient.
    pub fn set_delegate(env: Env, stream_id: u64, delegate: Address) -> Result<(), StreamError> {
        let stream = Self::load_stream(&env, stream_id)?;
        stream.recipient.require_auth();

        env.storage()
            .persistent()
            .set(&DataKey::Delegate(stream_id), &delegate);
        env.storage().persistent().extend_ttl(
            &DataKey::Delegate(stream_id),
            PERSISTENT_TTL_LEDGERS,
            PERSISTENT_TTL_LEDGERS,
        );

        Ok(())
    }

    /// Remove the delegate for a stream.
    pub fn remove_delegate(env: Env, stream_id: u64) -> Result<(), StreamError> {
        let stream = Self::load_stream(&env, stream_id)?;
        stream.recipient.require_auth();

        env.storage()
            .persistent()
            .remove(&DataKey::Delegate(stream_id));

        Ok(())
    }

    /// Get the delegate for a stream, if set.
    pub fn get_delegate(env: Env, stream_id: u64) -> Option<Address> {
        env.storage()
            .persistent()
            .get(&DataKey::Delegate(stream_id))
    }

    // ── Internal helpers ─────────────────────────────────────────────────────

    fn load_stream(env: &Env, id: u64) -> Result<Stream, StreamError> {
        env.storage()
            .persistent()
            .get(&DataKey::Stream(id))
            .ok_or(StreamError::StreamNotFound)
    }

    /// Compute total unlocked amount at `now` (UNIX seconds).
    ///
    /// Returns `Err(StreamError::ArithmeticOverflow)` if the intermediate
    /// `elapsed × linear_amount` multiplication overflows `i128`.  This can
    /// only happen when the product exceeds ~1.7 × 10^38; practically it
    /// requires an astronomically large `linear_amount` combined with a long
    /// `elapsed` window that was not caught by the `amount_per_second >= 1`
    /// guard at creation time.  Using `checked_mul` / `checked_div` ensures
    /// the runtime never aborts due to `overflow-checks = true` in the release
    /// profile, leaving the stream recoverable rather than permanently frozen.
    fn unlocked_amount(stream: &Stream, now: u64) -> Result<i128, StreamError> {
        if now < stream.cliff_time {
            return Ok(0);
        }
        if now >= stream.end_time {
            return Ok(stream.deposited_amount);
        }
        let elapsed = (now - stream.start_time) as i128;

        // Prefer divide-first to keep the intermediate value small, but only
        // when it produces an exact result (i.e. elapsed is divisible by
        // duration).  Otherwise fall back to multiply-first with a checked_mul
        // so an overflow is surfaced as a typed error instead of aborting the
        // entire transaction.
        let linear = if elapsed % stream.duration == 0 {
            // Exact path: no precision loss, no overflow risk.
            (elapsed / stream.duration) * stream.linear_amount
        } else {
            // General path: multiply first for precision, guard the overflow.
            elapsed
                .checked_mul(stream.linear_amount)
                .ok_or(StreamError::ArithmeticOverflow)?
                / stream.duration
        };

        let unlocked = stream
            .cliff_amount
            .checked_add(linear)
            .ok_or(StreamError::ArithmeticOverflow)?;
        // Cap at deposited (rounding safety).
        Ok(if unlocked > stream.deposited_amount {
            stream.deposited_amount
        } else {
            unlocked
        })
    }

    /// Amount the recipient can withdraw right now.
    fn withdrawable_amount(stream: &Stream, now: u64) -> Result<i128, StreamError> {
        if stream.cancelled {
            return Ok(0);
        }
        let unlocked = Self::unlocked_amount(stream, now)?;
        let available = unlocked - stream.withdrawn_amount;
        Ok(if available > 0 { available } else { 0 })
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
        env.storage()
            .instance()
            .extend_ttl(INSTANCE_TTL_LEDGERS, INSTANCE_TTL_LEDGERS);
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
        env.storage()
            .persistent()
            .extend_ttl(&key, PERSISTENT_TTL_LEDGERS, PERSISTENT_TTL_LEDGERS);
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
        if let Some(i) = position {
            indexes.remove(i as u32);
        }

        env.storage().persistent().set(&key, &indexes);
        env.storage()
            .persistent()
            .extend_ttl(&key, PERSISTENT_TTL_LEDGERS, PERSISTENT_TTL_LEDGERS);
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
}

mod bench;
mod test;
mod test_batch;
#[cfg(test)]
mod test_features;
mod test_integration;
mod test_security;
