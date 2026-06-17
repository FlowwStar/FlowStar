#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, token, Address, Env, Vec,
};

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

    /// Get all stream IDs where `address` is the sender.
    pub fn get_sent_streams(env: Env, address: Address) -> Vec<u64> {
        env.storage()
            .persistent()
            .get(&DataKey::SentBy(address))
            .unwrap_or(Vec::new(&env))
    }

    /// Get all stream IDs where `address` is the recipient.
    pub fn get_received_streams(env: Env, address: Address) -> Vec<u64> {
        env.storage()
            .persistent()
            .get(&DataKey::ReceivedBy(address))
            .unwrap_or(Vec::new(&env))
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
        let linear = elapsed * stream.amount_per_second;
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

    /// Extend the TTL of a stream entry (~30 days).
    fn extend_stream_ttl(env: &Env, id: u64) {
        env.storage().persistent().extend_ttl(
            &DataKey::Stream(id),
            518_400, // ~30 days in ledgers
            518_400,
        );
    }
}

mod test;
mod test_security;
