# Contract Testing Guide

The `flowstar-streaming` Soroban contract test suite lives in
`contracts/streaming/src/` and is split across six files. Each file has a
distinct focus so contributors can quickly find the right place to add new
coverage without wading through unrelated tests.

---

## File Overview

| File | Purpose |
|---|---|
| `test.rs` | Core CRUD: create, withdraw, cancel, top-up, transfer, indexes |
| `test_batch.rs` | Batch stream creation (`create_streams_batch`) |
| `test_features.rs` | Feature flags: events, pause/unpause, index optimisation, `partial_cancel` |
| `test_security.rs` | Auth, parameter validation, overdraw, rounding, dust prevention |
| `test_integration.rs` | Multi-step lifecycle scenarios |
| `bench.rs` | CPU / memory cost measurement (not pass/fail) |

---

## Running the Tests

All commands below must be run from the `contracts/` directory:

```bash
cd contracts
```

### Run every test at once

```bash
cargo test --package flowstar-streaming
```

### Run a single file (module)

Each file is a module named after the file (minus the `.rs` extension):

```bash
# Core tests
cargo test --package flowstar-streaming test --

# Batch tests
cargo test --package flowstar-streaming test_batch --

# Feature tests
cargo test --package flowstar-streaming test_features --

# Security tests
cargo test --package flowstar-streaming test_security --

# Integration tests
cargo test --package flowstar-streaming test_integration --

# Benchmarks  (see bench output section below)
cargo test --package flowstar-streaming bench -- --nocapture
```

The trailing `--` passes remaining arguments directly to the test runner.
The `--nocapture` flag is required for bench output because results are
emitted with `println!` and the runner swallows stdout by default.

### Run a single test function

```bash
cargo test --package flowstar-streaming test_cancel_midway -- --nocapture
```

---

## File-by-File Details

### `test.rs` — Core operations

The main regression suite. Uses a shared `TestEnv` helper that:

- deploys the contract and a native Stellar Asset Contract token,
- mints 1 million tokens to a sender address, and
- calls `initialize()` with a dedicated admin.

**Sections:**

- **`create_stream`** — valid creation, cliff parameters, invalid time ranges,
  zero amounts, past start times, self-stream rejection.
- **`withdraw`** — partial, full, over-limit, before-cliff, cancelled-stream.
- **`cancel`** — mid-stream split, double cancel, withdraw-after-cancel.
- **`indexes`** — sender and recipient index contents, pagination, auto-incrementing IDs.
- **`transfer_stream`** — basic transfer, partial-withdrawal continuity,
  roundtrip, near-end transfer, sender index unaffected, cancelled-stream
  rejection.
- **`top_up`** — increases `deposited_amount`, doubles rate when applied at
  stream start, multiple chained transfers with a top-up in between.

---

### `test_batch.rs` — Batch creation

Tests for `create_streams_batch`, which creates up to 20 streams atomically
from a single sender in one transaction.

**Key behaviours tested:**

- **Happy path** — returned IDs are sequential and in order; funds move in a
  single approval.
- **Atomicity** — any invalid stream in the batch rolls back all streams; no
  funds move and no indexes are updated.
- **Size limits** — exactly 20 streams succeeds; 21 returns `BatchSizeExceeded`;
  empty batch returns `BatchEmpty`.
- **Index integrity** — sender index and per-recipient indexes are each updated
  for every stream in the batch.
- **Cliff support** — cliff parameters inside a batch behave identically to
  single-stream creation.
- **Validation errors** — `InvalidAmount`, `InvalidTimeRange`, `InvalidCliff`,
  `SelfStream`, `PastStartTime`, `InvalidRecipient`, `RateIsZero` are each
  triggered through a batch entry.

---

### `test_features.rs` — Feature coverage

Tracks behaviour introduced by specific issues or design decisions.

**Sections:**

- **Structured events** (`#70`) — `create_stream`, `withdraw`, `cancel`, and
  `bump_stream` each emit events; tests assert the enriched payload fields
  (`sender`, `recipient`, `token`, `start_time`, `end_time`, `cliff_time`)
  are present via the returned stream state.
- **Pause / unpause** (`#71`) — `pause()` blocks `create_stream`, `withdraw`,
  `cancel`, and `update_stream_metadata` with error `#16` (`ContractPaused`);
  read-only calls (`get_stream`, `get_withdrawable`) continue to work while
  paused; `unpause()` restores full operation.
- **O(1) index storage** (`#72`) — paginated reads (`get_sent_streams`,
  `get_received_streams`) and count functions remain correct after the Vec →
  Map index migration; overflow-safe offset + limit clamping is verified.
- **`partial_cancel`** (`#217`) — returns only the locked (not yet unlocked)
  portion to the sender; keeps the stream active and streaming; rejects
  amounts larger than the locked balance; rejects already-cancelled streams.

---

### `test_security.rs` — Security properties

Adversarial and boundary tests. Uses a `Ctx` helper that adds an `attacker`
address with its own token balance.

**Sections:**

1. **Authorization** — attacker cannot withdraw or cancel; recipient cannot
   cancel; non-admin cannot upgrade or migrate; sender cannot withdraw their
   own outgoing stream; authorised delegate can withdraw; recipient cannot
   withdraw when a delegate is set.
2. **Non-existent streams** — `get_stream`, `withdraw`, and `cancel` all
   return `StreamNotFound` for unknown IDs.
3. **Overdraw prevention** — 10 sequential partial withdrawals never exceed
   `deposited_amount`; negative and zero withdrawal amounts return
   `InsufficientFunds`.
4. **Cancel accounting** — funds-in equals funds-out across cancel with prior
   withdrawal, cancel after full withdrawal, cancel before start (full
   refund), and cancel at exact end time.
5. **Cliff edge cases** — cliff amount equals total; cliff time equals end
   time; withdraw exactly at cliff; nothing withdrawable one second before
   cliff; withdrawal attempt before cliff returns `InsufficientFunds`.
6. **Rounding / integer math** — odd totals that produce non-zero remainders
   are attributed correctly; 1 billion token streams over one year do not
   overflow; minimum-duration (1 second) streams drain cleanly.
7. **Self-stream** — sender-equals-recipient is rejected at creation; no
   double-pay path exists because creation itself fails first.
8. **Create parameter validation** — cliff before start, cliff after end,
   cliff amount exceeds total, negative cliff amount, negative total amount,
   end time equals start time.
9. **Dust stream prevention** — amounts so small that `total / duration` rounds
   to zero are rejected with `RateIsZero`.

---

### `test_integration.rs` — Multi-step lifecycle scenarios

End-to-end tests that chain multiple operations together to catch
state-mutation bugs that isolated unit tests miss. Each scenario is
documented with an inline timeline comment.

| Scenario | Description |
|---|---|
| 1 — Happy path | `create → cliff → withdraw → top-up → transfer → drain`; verifies token conservation and index state at each step. |
| 2 — Cancel after top-up | `create → top-up (before cliff) → cancel (before cliff)`; sender receives 100 % of original + top-up; recipient receives nothing. |
| 3 — Transfer + withdraw race | `create → advance → transfer → new recipient withdraws unlocked amount immediately → drains at end`; old recipient balance stays zero. |
| 4 — Multiple streams same parties | Three streams; stream A cancelled, stream B completed, stream C transferred; active and archived indexes for all parties verified at each stage. |
| 4b — Auth after transfer | Verifies `stream.recipient` is updated and old recipient's index is empty (auth-level companion to scenario 4). |

---

### `bench.rs` — CPU / memory benchmarks

`bench.rs` is **not** a correctness suite. It measures how many CPU
instructions and memory bytes each contract function consumes in the
Soroban test environment, using the `cost_estimate().budget()` API.

#### Running the benchmarks

```bash
cargo test --package flowstar-streaming bench -- --nocapture
```

#### Reading the output

Each benchmark prints one line per measured operation:

```
[BENCH] create_stream (no cliff)                   cpu=    1234567 mem=     89012
[BENCH] withdraw (25% progress)                    cpu=     987654 mem=     56789
```

- `cpu` — CPU instructions consumed by the call (unitless counter).
- `mem` — memory bytes allocated during the call.

If a measurement exceeds 50 million CPU instructions, the harness also
prints a `[WARN]` line showing the percentage of the Soroban transaction
limit consumed:

```
[WARN]  create_stream (no cliff) uses 51.2% of cpu instruction limit
```

#### Soroban CPU instruction limit

Soroban mainnet enforces a hard limit of **100 million CPU instructions per
transaction**. An operation that crosses this limit will be rejected on-chain
even if it passes in the test environment. Use the benchmark output to catch
regressions before they are deployed:

- Values below ~30 M — healthy headroom.
- Values between 30 M–70 M — monitor; may become a problem after future SDK
  or VM changes.
- Values above 70 M — investigate before merging; one additional index entry
  or a loop iteration could push the operation over the limit.

The benchmarks cover: `create_stream` (with and without cliff), `withdraw`
(25 % and 100 % progress), `cancel` (10 %, 50 %, 99 % progress),
`partial_cancel` (pre-cliff and post-cliff rate-recompute paths, plus 99 %
progress), `transfer_stream`, `top_up` (at start and mid-stream),
`create_streams_batch` at its maximum size (`MAX_BATCH_SIZE` = 20 streams —
the single most expensive call in the contract, since it repeats the full
`create_stream` validation + index-update path up to 20 times in one
transaction), paginated `get_sent_streams` / `get_received_streams` (10 and
100 streams), `get_withdrawable`, and `get_stream`.

#### Cost profile notes (issue #1134)

- `partial_cancel` does strictly more work than a plain `cancel`: `cancel`
  only flips a boolean flag, while `partial_cancel` recomputes
  `linear_amount` / `duration` / `amount_per_second` and performs a token
  transfer back to the sender — expect it to land closer to `withdraw` than
  to `cancel` in CPU cost.
- `create_streams_batch` at `MAX_BATCH_SIZE` (20) is expected to be the
  **largest** number in the whole report: each stream in the batch pays the
  full single-`create_stream` cost (param validation, token transfer,
  storage write, sender + recipient index updates), so the total scales
  roughly linearly — approximately 20× a single `create_stream (no cliff)`
  measurement. This is the first benchmark to check against the 70 M
  instruction "investigate before merging" threshold above, since it has the
  least headroom of any call in the contract.
- Exact `cpu=`/`mem=` figures depend on the `soroban-sdk` version and host
  machine; run `cargo test --package flowstar-streaming bench -- --nocapture`
  locally (from `contracts/`) to capture current numbers before comparing
  against the thresholds above.

---

## Writing New Tests

- **Correctness for a new function** → add to `test.rs` under a clearly
  labelled section comment.
- **Batch-specific behaviour** → add to `test_batch.rs`.
- **New feature or flag** → add to `test_features.rs` with a comment
  referencing the issue number.
- **Auth or adversarial input** → add to `test_security.rs` in the
  appropriate numbered section.
- **Multi-step scenario** → add to `test_integration.rs` with an inline
  timeline comment.
- **Cost regression guard** → add a `measure` call to `bench.rs`.

All test files use `#![cfg(test)]` so they are compiled only when running
`cargo test`. The `BenchEnv` / `TestEnv` / `Ctx` helpers in each file are
self-contained; copy the pattern from the file you are adding to.
