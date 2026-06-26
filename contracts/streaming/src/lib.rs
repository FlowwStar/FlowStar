#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, token, Address, Env, Vec,
};

// ─── Constants ───────────────────────────────────────────────────────────────

const CONTRACT_VERSION: u32 = 1;
const CONTRACT_NAME: &str = "FlowStar Streaming";

// ─── Storage Keys ────────────────────────────────────────────────────────────

#[contracttype]
pub enum DataKey {
    /// Global counter for next stream ID. Stored in Instance.
    NextId,
    /// Stream struct keyed by ID. Stored in Persistent.
    Stream(u64),
    /// List of stream IDs where address is the sender. Stored in Persistent.
    SentBy(Address),
    /// List of stream IDs where address is the recipient. Stored in Persistent.
    ReceivedBy(Address),
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
    pub duration: i128
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
}

// ─── Errors ──────────────────────────────────────────────────────────────────

// ─── Events ───────────────────────────────────────────────────────────────────

#[soroban_sdk::contractevent]
pub struct StreamCreatedEvent {
    pub stream_id: u64,
    pub deposited_amount: i128,
}

#[soroban_sdk::contractevent]
pub struct WithdrawEvent {
    pub stream_id: u64,
    pub amount: i128,
}

#[soroban_sdk::contractevent]
pub struct CancelEvent {
    pub stream_id: u64,
    pub recipient_amount: i128,
    pub sender_refund: i128,
}

#[soroban_sdk::contractevent]
pub struct StreamTransferEvent {
    pub stream_id: u64,
    pub old_recipient: Address,
    pub new_recipient: Address,
pub struct TopUpEvent {
    pub stream_id: u64,
    pub additional_amount: i128,
    pub new_deposited_amount: i128,
    pub new_amount_per_second: i128,
}

// ─── Contract ────────────────────────────────────────────────────────────────

#[contract]
pub struct StreamingContract;

#[contractimpl]
impl StreamingContract {
    // ── Write: Create ────────────────────────────────────────────────────────

    /// Create a new token stream.
    ///
    /// The caller must have already approved this contract to spend
    /// `total_amount` of `token` via the token's `approve()` function.
    ///
    /// Returns the new stream's ID.
    pub fn create_stream(env: Env, sender: Address, params: CreateStreamParams) -> u64 {
        sender.require_auth();

        // ── Validate params ──────────────────────────────────────────────────
        if params.total_amount <= 0 {
            panic!("total_amount must be > 0");
        }
        if params.end_time <= params.start_time {
            panic!("end_time must be > start_time");
        }
        if params.cliff_time < params.start_time || params.cliff_time > params.end_time {
            panic!("cliff_time must be between start_time and end_time");
        }
        if params.cliff_amount < 0 || params.cliff_amount > params.total_amount {
            panic!("cliff_amount must be between 0 and total_amount");
        }
        if params.recipient == sender {
            panic!("sender cannot be the recipient");
        }

        let duration = (params.end_time - params.start_time) as i128;
        let linear_amount = params.total_amount - params.cliff_amount;
        let amount_per_second = if duration > 0 { linear_amount / duration } else { 0 };

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
            duration
        };

        // ── Persist stream ───────────────────────────────────────────────────
        env.storage()
            .persistent()
            .set(&DataKey::Stream(id), &stream);

        Self::extend_stream_ttl(&env, id);

        // ── Update sender index ──────────────────────────────────────────────
        Self::push_to_index(&env, DataKey::SentBy(sender), id);

        // ── Update recipient index ───────────────────────────────────────────
        Self::push_to_index(&env, DataKey::ReceivedBy(params.recipient), id);

        StreamCreatedEvent { stream_id: id, deposited_amount: stream.deposited_amount }
            .publish(&env);

        id
    }

     // ── Write: Transfer ────────────────────────────────────────────────────────

    /// Transfer a token stream right to a new address
    pub fn transfer_stream(env: Env, stream_id: u64, new_recipient: Address) {
        let mut stream = Self::load_stream(&env, stream_id);
        stream.recipient.require_auth();
        let old_recipient = stream.recipient;
        if stream.cancelled {
            panic!("cannot transfer a cancelled stream");
        }
        if new_recipient == old_recipient {
            panic!("new_recipient must differ from current recipient");
        }

        stream.recipient = new_recipient.clone();

        // ── Persist stream ───────────────────────────────────────────────────
        env.storage()
            .persistent()
            .set(&DataKey::Stream(stream_id), &stream);

        Self::remove_from_index(&env, DataKey::ReceivedBy(old_recipient.clone()), stream_id);
        Self::push_to_index(&env, DataKey::ReceivedBy(new_recipient.clone()), stream_id);

        StreamTransferEvent { stream_id, old_recipient, new_recipient }
            .publish(&env);
        Self::extend_stream_ttl(&env, stream_id);
    }

    /// Top up an existing stream with additional funds.
    ///
    /// Increases `deposited_amount` and recalculates `amount_per_second` over
    /// the remaining stream duration.
    ///
    /// The caller must have approved this contract to spend `additional_amount`
    /// of the stream's token before calling.
    pub fn top_up(env: Env, stream_id: u64, additional_amount: i128) {
        let mut stream = Self::load_stream(&env, stream_id);
        stream.sender.require_auth();

        if stream.cancelled {
            panic!("cannot top up a cancelled stream");
        }

        let now = env.ledger().timestamp();
        if now >= stream.end_time {
            panic!("cannot top up an ended stream");
        }

        if additional_amount <= 0 {
            panic!("additional_amount must be > 0");
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
        // Already-vested funds keep their rate; only the remaining
        // unlocked portion is recalculated with the new total.
        //
        // remaining_linear = (deposited - cliff_amount - withdrawn_linear) + additional
        // amount_per_second = remaining_linear / remaining_seconds
        //
        // We compute remaining_seconds from now rather than cliff_time so a
        // mid-stream top-up doesn't retroactively change already-vested amounts.
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

        // ── Apply changes ────────────────────────────────────────────────────
        stream.deposited_amount = stream
            .deposited_amount
            .checked_add(additional_amount)
            .expect("deposited_amount overflow");

        stream.amount_per_second = new_amount_per_second;

        env.storage()
            .persistent()
            .set(&DataKey::Stream(stream_id), &stream);

        Self::remove_from_index(&env, DataKey::ReceivedBy(old_recipient.clone()), stream_id);
        Self::push_to_index(&env, DataKey::ReceivedBy(new_recipient.clone()), stream_id);

        StreamTransferEvent { stream_id, old_recipient, new_recipient }
            .publish(&env);
        Self::extend_stream_ttl(&env, stream_id);

        // ── Emit event ───────────────────────────────────────────────────────
        TopUpEvent {
            stream_id,
            additional_amount,
            new_deposited_amount: stream.deposited_amount,
            new_amount_per_second,
        }
        .publish(&env);
    }

    // ── Write: Withdraw ──────────────────────────────────────────────────────

    /// Withdraw unlocked tokens from a stream.
    ///
    /// Only the recipient can call this. Pass the exact amount to withdraw
    /// (must be ≤ withdrawable amount). Use `get_withdrawable` to query first.
    pub fn withdraw(env: Env, stream_id: u64, amount: i128) {
        let mut stream = Self::load_stream(&env, stream_id);

        stream.recipient.require_auth();

        if stream.cancelled {
            panic!("stream is cancelled");
        }

        let now = env.ledger().timestamp();
        let withdrawable = Self::withdrawable_amount(&stream, now);

        if amount <= 0 || amount > withdrawable {
            panic!("invalid withdraw amount");
        }

        stream.withdrawn_amount += amount;

        env.storage()
            .persistent()
            .set(&DataKey::Stream(stream_id), &stream);

        Self::extend_stream_ttl(&env, stream_id);

        let token_client = token::Client::new(&env, &stream.token);
        token_client.transfer(
            &env.current_contract_address(),
            &stream.recipient,
            &amount,
        );

        WithdrawEvent { stream_id, amount }.publish(&env);
    }

    // ── Write: Cancel ────────────────────────────────────────────────────────

    /// Cancel a stream. Only the sender can cancel.
    ///
    /// Unlocked funds (as of now) go to the recipient.
    /// Remaining locked funds are returned to the sender.
    pub fn cancel(env: Env, stream_id: u64) {
        let mut stream = Self::load_stream(&env, stream_id);

        stream.sender.require_auth();

        if stream.cancelled {
            panic!("stream already cancelled");
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
            recipient_amount: recipient_owes,
            sender_refund: sender_gets_back,
        }
        .publish(&env);
    }

    // ── Read: Stream data ────────────────────────────────────────────────────

    /// Get a stream by ID.
    pub fn get_stream(env: Env, stream_id: u64) -> Stream {
        Self::load_stream(&env, stream_id)
    }

    /// Get the withdrawable amount for a stream at current ledger time.
    pub fn get_withdrawable(env: Env, stream_id: u64) -> i128 {
        let stream = Self::load_stream(&env, stream_id);
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

    // ── Write: Bump TTL ──────────────────────────────────────────────────────

    /// Extend the TTL of a stream's persistent storage without modifying data.
    /// Anyone can call this to keep a long-running stream alive.
    pub fn bump_stream(env: Env, stream_id: u64) {
        Self::load_stream(&env, stream_id);
        Self::extend_stream_ttl(&env, stream_id);
    }

    // ── Metadata ──────────────────────────────────────────────────────────────

    /// Get the contract version.
    pub fn version(_env: Env) -> u32 {
        CONTRACT_VERSION
    }

    /// Get the contract name.
    pub fn name(env: Env) -> String {
        String::from_small_copy(&String::from_slice(&env, CONTRACT_NAME))
    }

    // ── Internal helpers ─────────────────────────────────────────────────────

    fn load_stream(env: &Env, id: u64) -> Stream {
        env.storage()
            .persistent()
            .get(&DataKey::Stream(id))
            .unwrap_or_else(|| panic!("stream not found"))
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
        if available > 0 { available } else { 0 }
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
            17_280,  // ~1 day in ledgers
            17_280,
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
        env.storage().persistent().extend_ttl(
            &key,
            17_280,
            17_280,
        );
    }

    /// Append a stream ID to an address index list.
    fn remove_from_index(env: &Env, key: DataKey, id: u64) {
        let mut indexes: Vec<u64> = env
            .storage()
            .persistent()
            .get(&key)
            .unwrap_or(Vec::new(env));

        let position = indexes.iter().position(|id| id == id);
        if let Some(i) = position {
            indexes.remove(i as u32);
        }

        env.storage().persistent().set(&key, &indexes);
    }

    /// Extend the TTL of a stream entry (~30 days).
    fn extend_stream_ttl(env: &Env, id: u64) {
        env.storage().persistent().extend_ttl(
            &DataKey::Stream(id),
            518_400, // ~30 days in ledgers
            518_400,
        );
    }

    fn vested_amount(stream: &Stream, now: u64) -> i128 {
        if now < stream.cliff_time {
            return 0;
        }

        let elapsed = (now.min(stream.end_time) - stream.cliff_time) as i128;
        let linear = stream.amount_per_second
            .checked_mul(elapsed)
            .expect("amount_per_second * elapsed overflow");

        stream.cliff_amount
            .checked_add(linear)
            .expect("cliff_amount * linear overflow")
            .min(stream.deposited_amount)
    }
}

mod test;
mod test_security;
