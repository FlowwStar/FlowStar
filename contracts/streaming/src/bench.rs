#![cfg(test)]
//! Gas / CPU-instruction benchmarks for all public contract functions.
//!
//! Run with:
//!   cargo test --package flowstar-streaming bench -- --nocapture
//!
//! Results are printed to stdout and can be tracked in CI over time.
//! Soroban testnet limit: ~100 million CPU instructions per transaction.

extern crate std;

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    token::{Client as TokenClient, StellarAssetClient},
    Address, Env,
};

// ─── Benchmark harness ────────────────────────────────────────────────────────

/// Resets budget, runs `f`, then prints CPU + memory costs.
fn measure(env: &Env, label: &str, f: impl FnOnce()) {
    env.cost_estimate().budget().reset_default();
    f();
    let cpu = env.cost_estimate().budget().cpu_instruction_cost();
    let mem = env.cost_estimate().budget().memory_bytes_cost();
    std::println!("[BENCH] {:<50} cpu={:>12} mem={:>10}", label, cpu, mem);

    // Flag operations that approach the Soroban limit (100M cpu instructions)
    if cpu > 50_000_000 {
        std::println!(
            "[WARN]  {} uses {:.1}% of cpu instruction limit",
            label,
            cpu as f64 / 1_000_000.0
        );
    }
}

// ─── Setup ───────────────────────────────────────────────────────────────────

struct BenchEnv {
    env: Env,
    contract_id: Address,
    token_id: Address,
    sender: Address,
    recipient: Address,
}

impl BenchEnv {
    fn setup() -> Self {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(StreamingContract, ());
        let sender = Address::generate(&env);
        let recipient = Address::generate(&env);

        let token_admin = Address::generate(&env);
        let token_id = env
            .register_stellar_asset_contract_v2(token_admin.clone())
            .address();
        StellarAssetClient::new(&env, &token_id).mint(&sender, &1_000_000_000_0000000);

        BenchEnv {
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

    fn token(&self) -> TokenClient<'_> {
        TokenClient::new(&self.env, &self.token_id)
    }

    fn set_time(&self, t: u64) {
        self.env.ledger().with_mut(|l| l.timestamp = t);
    }

    fn approve(&self, amount: i128) {
        self.token().approve(
            &self.sender,
            &self.contract_id,
            &amount,
            &(self.env.ledger().sequence() + 500),
        );
    }

    fn create_default(&self, now: u64) -> u64 {
        let params = CreateStreamParams {
            recipient: self.recipient.clone(),
            token: self.token_id.clone(),
            total_amount: 1_000_0000000,
            start_time: now,
            end_time: now + 1000,
            cliff_time: now,
            cliff_amount: 0,
        };
        self.approve(params.total_amount);
        self.client().create_stream(&self.sender, &params)
    }
}

// ─── Benchmarks ──────────────────────────────────────────────────────────────

#[test]
fn bench_create_stream() {
    let b = BenchEnv::setup();
    let now = 1_000_000u64;
    b.set_time(now);

    let params = CreateStreamParams {
        recipient: b.recipient.clone(),
        token: b.token_id.clone(),
        total_amount: 1_000_0000000,
        start_time: now,
        end_time: now + 1000,
        cliff_time: now,
        cliff_amount: 0,
    };
    b.approve(params.total_amount * 10);

    measure(&b.env, "create_stream (no cliff)", || {
        let p = params.clone();
        b.client().create_stream(&b.sender, &p);
    });

    let params_cliff = CreateStreamParams {
        recipient: b.recipient.clone(),
        token: b.token_id.clone(),
        total_amount: 1_000_0000000,
        start_time: now,
        end_time: now + 1000,
        cliff_time: now + 200,
        cliff_amount: 100_0000000,
    };
    b.approve(params_cliff.total_amount * 10);

    measure(&b.env, "create_stream (with cliff)", || {
        let p = params_cliff.clone();
        b.client().create_stream(&b.sender, &p);
    });
}

#[test]
fn bench_withdraw() {
    let b = BenchEnv::setup();
    let now = 1_000_000u64;
    b.set_time(now);

    // Withdraw at 25% progress
    let sid = b.create_default(now);
    b.set_time(now + 250);
    let amt = b.client().get_withdrawable(&sid);
    measure(&b.env, "withdraw (25% progress)", || {
        b.client().withdraw(&sid, &amt);
    });

    // Withdraw at 100% (full)
    let sid2 = b.create_default(now);
    b.set_time(now + 2000);
    let full = b.client().get_withdrawable(&sid2);
    measure(&b.env, "withdraw (100% — full stream)", || {
        b.client().withdraw(&sid2, &full);
    });
}

#[test]
fn bench_cancel() {
    let b = BenchEnv::setup();
    let now = 1_000_000u64;
    b.set_time(now);

    let sid_early = b.create_default(now);
    b.set_time(now + 100); // 10% in
    measure(&b.env, "cancel (10% progress)", || {
        b.client().cancel(&sid_early);
    });

    let sid_mid = b.create_default(now);
    b.set_time(now + 500); // 50% in
    measure(&b.env, "cancel (50% progress)", || {
        b.client().cancel(&sid_mid);
    });

    let sid_late = b.create_default(now);
    b.set_time(now + 990); // 99% in
    measure(&b.env, "cancel (99% progress)", || {
        b.client().cancel(&sid_late);
    });
}

#[test]
fn bench_transfer_stream() {
    let b = BenchEnv::setup();
    let now = 1_000_000u64;
    b.set_time(now);

    let sid = b.create_default(now);
    let new_recipient = Address::generate(&b.env);

    measure(&b.env, "transfer_stream (index remove + add)", || {
        b.client().transfer_stream(&sid, &new_recipient);
    });
}

#[test]
fn bench_top_up() {
    let b = BenchEnv::setup();
    let now = 1_000_000u64;
    b.set_time(now);

    let sid = b.create_default(now);
    let additional = 500_0000000i128;

    // Top up at start
    b.approve(additional * 10);
    measure(&b.env, "top_up (at stream start)", || {
        b.client().top_up(&sid, &additional);
    });

    // Top up mid-stream (rate recalculation)
    b.set_time(now + 500);
    measure(&b.env, "top_up (mid-stream, rate recalculation)", || {
        b.client().top_up(&sid, &additional);
    });
}

#[test]
fn bench_get_sent_streams_pagination() {
    let b = BenchEnv::setup();
    let now = 1_000_000u64;
    b.set_time(now);

    // Create 10 streams
    for _ in 0..10 {
        b.create_default(now);
    }
    measure(&b.env, "get_sent_streams (10 streams, full page)", || {
        b.client().get_sent_streams(&b.sender, &0, &100);
    });
    measure(&b.env, "get_sent_streams (10 streams, page size 5)", || {
        b.client().get_sent_streams(&b.sender, &0, &5);
    });

    // Create 90 more for 100 total
    for _ in 0..90 {
        b.create_default(now);
    }
    measure(&b.env, "get_sent_streams (100 streams, full page)", || {
        b.client().get_sent_streams(&b.sender, &0, &100);
    });
    measure(
        &b.env,
        "get_sent_streams (100 streams, page offset 50)",
        || {
            b.client().get_sent_streams(&b.sender, &50, &50);
        },
    );
}

#[test]
fn bench_get_received_streams_pagination() {
    let b = BenchEnv::setup();
    let now = 1_000_000u64;
    b.set_time(now);

    // Create 10 streams
    for _ in 0..10 {
        b.create_default(now);
    }
    measure(
        &b.env,
        "get_received_streams (10 streams, full page)",
        || {
            b.client().get_received_streams(&b.recipient, &0, &100);
        },
    );

    // Create 90 more for 100 total
    for _ in 0..90 {
        b.create_default(now);
    }
    measure(
        &b.env,
        "get_received_streams (100 streams, full page)",
        || {
            b.client().get_received_streams(&b.recipient, &0, &100);
        },
    );
    measure(
        &b.env,
        "get_received_streams (100 streams, page offset 50)",
        || {
            b.client().get_received_streams(&b.recipient, &50, &50);
        },
    );
}

#[test]
fn bench_get_withdrawable() {
    let b = BenchEnv::setup();
    let now = 1_000_000u64;
    b.set_time(now);

    let sid = b.create_default(now);
    b.set_time(now + 500);

    measure(&b.env, "get_withdrawable (mid-stream)", || {
        b.client().get_withdrawable(&sid);
    });
}

#[test]
fn bench_get_stream() {
    let b = BenchEnv::setup();
    let now = 1_000_000u64;
    b.set_time(now);

    let sid = b.create_default(now);

    measure(&b.env, "get_stream (read by id)", || {
        b.client().get_stream(&sid);
    });
}
