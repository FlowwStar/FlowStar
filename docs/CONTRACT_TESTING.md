# Contract Testing Guide

This guide provides an architectural overview and operational instructions for testing the **FlowStar Soroban Streaming Contract** (`flowstar-streaming`).

The contract test suite is intentionally partitioned into distinct modules to ensure high test granularity, isolation of security invariants, full-lifecycle integration verification, and resource metering.

---

## 1. Test Suite Architecture

All contract tests are located in `contracts/streaming/src/` and run within the local Soroban Rust test environment without needing an active testnet or local validator.

```
contracts/streaming/src/
├── lib.rs                  # Contract entry points and error definitions
├── test.rs                 # Core unit tests & basic lifecycle operations
├── test_batch.rs           # Batch creation and boundary validations
├── test_features.rs        # Parameter modifications and extended features
├── test_security.rs        # Adversarial attack vectors, auth checks, and invariant audits
├── test_integration.rs     # Multi-step stateful integration flows
└── bench.rs                # CPU instruction & memory resource consumption benchmarks
```

### Module Summary

| Test File | Focus Area | Primary Assertions |
|---|---|---|
| [`test.rs`](contracts/streaming/src/test.rs) | **Unit Operations** | Initialization, single stream creation, basic withdrawals, cancellation, top-ups, transfers, upgrades, and versioning. |
| [`test_batch.rs`](contracts/streaming/src/test_batch.rs) | **Batch Streaming** | Happy path `create_streams_batch`, partial validation failures (atomic rollback), max batch limit (<= 20 streams), empty batch rejection, and multi-stream indexing. |
| [`test_features.rs`](contracts/streaming/src/test_features.rs) | **Extended Features** | Stream pause/unpause, cliff transitions, auto-withdrawal logic, rate recalculations, and parameter modifications. |
| [`test_security.rs`](contracts/streaming/src/test_security.rs) | **Adversarial & Safety** | Explicit `MockAuth` testing against unauthorized callers, arithmetic overflow/underflow, zero/negative inputs, double-withdrawal prevention, and token balance conservation. |
| [`test_integration.rs`](contracts/streaming/src/test_integration.rs) | **End-to-End Scenarios** | Multi-actor complex lifecycles (e.g. create -> cliff -> partial withdraw -> top-up -> transfer recipient -> complete withdraw), index integrity across multiple simultaneous streams. |
| [`bench.rs`](contracts/streaming/src/bench.rs) | **Resource Benchmarks** | CPU instruction and RAM memory consumption tracking against Soroban protocol transaction limits. |

---

## 2. Running Tests

Tests are executed via `cargo` from the repository root or from the `contracts/streaming/` directory.

### Running the Entire Suite
To run all functional unit, batch, security, and integration tests:
```bash
cargo test --package flowstar-streaming
```

### Running Specific Test Modules
You can target individual test modules by filtering on their module prefix:

- **Core Unit Tests**:
  ```bash
  cargo test --package flowstar-streaming test::
  ```
- **Batch Processing Tests**:
  ```bash
  cargo test --package flowstar-streaming test_batch::
  ```
- **Extended Feature Tests**:
  ```bash
  cargo test --package flowstar-streaming test_features::
  ```
- **Security & Authorization Tests**:
  ```bash
  cargo test --package flowstar-streaming test_security::
  ```
- **End-to-End Integration Tests**:
  ```bash
  cargo test --package flowstar-streaming test_integration::
  ```

### Running a Single Test Case
To run a specific test by name:
```bash
cargo test --package flowstar-streaming test_security::test_auth_attacker_cannot_withdraw -- --exact
```

### Useful Testing Flags
- `--nocapture`: Displays `println!` and diagnostic logging (required for benchmark output).
- `--test-threads=1`: Runs test cases sequentially (helpful when debugging state issues).
- `RUST_BACKTRACE=1`: Prints a full stack trace upon contract panic.

---

## 3. Interpreting Benchmark Output (`bench.rs`)

Unlike standard unit tests that pass or fail based on assertions, `bench.rs` measures the computational cost of each entrypoint against Soroban resource budgets.

### Running Benchmarks
Run the benchmark harness with `--nocapture` to view the diagnostic output:
```bash
cargo test --package flowstar-streaming bench -- --nocapture
```

### Understanding the Output
The harness resets the Soroban environment budget before each operation and reports the consumed resources:

```text
=== BENCHMARK: create_stream ===
  CPU instructions: 1,842,910
  Memory bytes:     284,120

=== BENCHMARK: withdraw ===
  CPU instructions: 1,230,450
  Memory bytes:     198,340

=== BENCHMARK: create_streams_batch (20 streams) ===
  CPU instructions: 24,190,500
  Memory bytes:     3,420,110
```

### Soroban Protocol Limits & Thresholds
On Stellar/Soroban (Testnet / Mainnet Protocol 20+):
- **CPU Instruction Limit per Transaction**: **100,000,000 instructions** (100M).
- **Memory Limit per Transaction**: **40 MB** (41,943,040 bytes).

### Evaluation Guidelines
1. **Single Stream Operations** (`create_stream`, `withdraw`, `cancel`, `top_up`):
   - Typical CPU cost should remain well below **5,000,000 instructions** (< 5% of maximum tx budget).
2. **Batch Operations** (`create_streams_batch` with maximum 20 streams):
   - Total CPU cost must remain under **40,000,000 instructions** (< 40% of maximum tx budget) to account for host overhead and multi-operation transaction bundling.
3. **Regression Detection**:
   - Any PR that increases CPU instruction count on core operations by > 15% should be audited for inefficient storage reads, duplicate serialization, or redundant loops.

---

## 4. Writing New Tests

When adding new contract features or addressing security issues, adhere to the following test conventions:

### 1. Use the Module-Appropriate Harness
- For standard unit logic, use `TestEnv::setup()` in `test.rs`.
- For multi-actor security checks, use `Ctx::new()` in `test_security.rs` and do **not** use `env.mock_all_auths()`. Instead, specify explicit `MockAuth` invocations to verify auth enforcement.

### 2. Mocking Ledger Time & Sequence
Stream calculations depend on ledger timestamps. Advance the clock using:
```rust
env.ledger().with_mut(|li| {
    li.timestamp += 3600; // Advance 1 hour
    li.sequence += 720;   // ~5 seconds per ledger
});
```

### 3. Verify Conservation of Invariants
Whenever a stream is cancelled, completed, or topped up, assert the fundamental fund conservation invariant:
$$\text{Total Deposited} = \text{Withdrawn by Recipient} + \text{Refunded to Sender} + \text{Contract Balance}$$

No tokens may ever be orphaned or unaccounted for in contract storage.

### 4. Golden Snapshot Verification
Core and security test runs generate deterministic JSON snapshots in `contracts/streaming/test_snapshots/`. If an intentional ABI or event change alters snapshot outputs, review the diff carefully before committing.
