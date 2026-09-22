# Frequently Asked Questions (FAQ)

Welcome to the **FlowStar** Contributor FAQ. This document addresses the most frequent setup, workflow, and architectural questions encountered by new and existing contributors across the smart contract and frontend codebases.

---

## Table of Contents
1. [Development Environment & Setup](#1-development-environment--setup)
   - [What is Mock Mode and how does it work?](#what-is-mock-mode-and-how-does-it-work)
   - [How do I test against the live Soroban Testnet?](#how-do-i-test-against-the-live-soroban-testnet)
   - [Where do I get testnet XLM for testing?](#where-do-i-get-testnet-xlm-for-testing)
2. [Contribution Workflow & Bounties](#2-contribution-workflow--bounties)
   - [How does issue assignment work?](#how-does-issue-assignment-work)
   - [How do GrantFox OSS / Stellar Wave rewards work?](#how-do-grantfox-oss--stellar-wave-rewards-work)
   - [What is required before opening a Pull Request?](#what-is-required-before-opening-a-pull-request)
3. [Smart Contract & Soroban](#3-smart-contract--soroban)
   - [How do I run contract unit, security, and benchmark tests?](#how-do-i-run-contract-unit-security-and-benchmark-tests)
   - [What are the transaction budget limits (CPU and Memory)?](#what-are-the-transaction-budget-limits-cpu-and-memory)
   - [How does Soroban storage TTL (rent) affect streams?](#how-does-soroban-storage-ttl-rent-affect-streams)
   - [Why is there a maximum limit of 20 streams per batch?](#why-is-there-a-maximum-limit-of-20-streams-per-batch)
4. [Frontend & Wallet Integration](#4-frontend--wallet-integration)
   - [Which wallets are supported?](#which-wallets-are-supported)
   - [Why is Freighter failing to sign transactions?](#why-is-freighter-failing-to-sign-transactions)
   - [How are token balances and stream unlock amounts calculated?](#how-are-token-balances-and-stream-unlock-amounts-calculated)

---

## 1. Development Environment & Setup

### What is Mock Mode and how does it work?
**Mock Mode** allows full UI and flow development without requiring a live internet connection, a funded Freighter wallet, or active Soroban testnet RPCs (see [ADR-003](./adr/ADR-003-mock-mode.md)).

- **Automatic Activation**: Mock Mode activates automatically in `lib/contract.ts` whenever `NEXT_PUBLIC_CONTRACT_ID` is omitted or empty in your `.env.local`.
- **In-Memory State**: Mock Mode simulates stream creation, withdrawals, top-ups, cancellations, and real-time linear unlocking entirely client-side.
- **Switching to Live**: To switch to live contract interactions, set `NEXT_PUBLIC_CONTRACT_ID` to a deployed contract address and configure the testnet RPC endpoint.

### How do I test against the live Soroban Testnet?
Ensure your `.env.local` contains the testnet network parameters:
```env
NEXT_PUBLIC_STELLAR_NETWORK=TESTNET
NEXT_PUBLIC_SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
NEXT_PUBLIC_HORIZON_URL=https://horizon-testnet.stellar.org
NEXT_PUBLIC_NETWORK_PASSPHRASE="Test SDF Network ; September 2015"
NEXT_PUBLIC_CONTRACT_ID=<DEPLOYED_CONTRACT_ADDRESS>
```

### Where do I get testnet XLM for testing?
You can fund your testnet account via the official Stellar Friendbot:
```bash
curl "https://friendbot.stellar.org?addr=<YOUR_PUBLIC_KEY>"
```
Alternatively, use the fund button directly within the Freighter wallet extension configured to **Testnet**.

---

## 2. Contribution Workflow & Bounties

### How does issue assignment work?
- Review the open issue backlog. Issues labeled `good first issue` or `help wanted` are ideal starting points.
- Comment on the issue outlining your proposed implementation approach.
- Maintainers review proposals and assign the issue. Once assigned, you can begin development and open a PR.

### How do GrantFox OSS / Stellar Wave rewards work?
FlowStar participates in community reward programs including the **GrantFox OSS Campaign** and **Stellar Wave**:
- **Eligibility**: PRs addressing verified campaign issues with passing CI, comprehensive test coverage, and no regressions.
- **Payout Settlement**: Reward distribution is settled via Soroban escrow or direct Stellar transfers in **USDC** or **XLM**.
- **Payout Address**: Include your verified Stellar public key (`G...`) in your PR description.

### What is required before opening a Pull Request?
Review the checklist in [CONTRIBUTING.md](../CONTRIBUTING.md):
1. **Isolated Changes**: Keep each PR scoped to one logical issue (`Closes #<id>`).
2. **Quality Gates**:
   - Frontend: `npm run lint` and `npm test` must pass with zero errors.
   - Contract: `cargo test --package flowstar-streaming` must pass.
3. **Documentation**: Update relevant documentation files in `docs/` if modifying user flows, APIs, or schemas.

---

## 3. Smart Contract & Soroban

### How do I run contract unit, security, and benchmark tests?
The streaming contract test suite is partitioned across multiple dedicated files. For a full architectural breakdown, refer to the **[Contract Testing Guide](./CONTRACT_TESTING.md)**:

```bash
# Run all tests
cargo test --package flowstar-streaming

# Run specific modules
cargo test --package flowstar-streaming test::            # Core unit operations
cargo test --package flowstar-streaming test_batch::      # Batch processing
cargo test --package flowstar-streaming test_security::   # Adversarial security & auth gates
cargo test --package flowstar-streaming test_integration::# Full multi-step lifecycles
cargo test --package flowstar-streaming bench -- --nocapture # CPU / memory benchmarks
```

### What are the transaction budget limits (CPU and Memory)?
Soroban transactions have strict resource budgets:
- **Maximum CPU Instructions per Tx**: **100,000,000** (100M).
- **Maximum Memory per Tx**: **40 MB**.

Standard single-stream operations in FlowStar consume between 1.2M and 1.8M instructions (< 2% of maximum limit). Run `cargo test --package flowstar-streaming bench -- --nocapture` to inspect gas consumption.

### How does Soroban storage TTL (rent) affect streams?
Soroban uses a storage rent model (TTL) for state:
- Streams are saved in **persistent storage** which lasts ~30 days (dependent on testnet ledger settings).
- Any write operation (`withdraw`, `top_up`, `cancel`, `transfer_stream`) automatically extends the storage TTL.
- For long-term streams (> 30 days) with no regular activity, call `bump_stream(stream_id)` periodically to extend the entry's TTL.
- Completed or cancelled streams can be purged via `cleanup_stream(stream_id)` to recover storage space.

### Why is there a maximum limit of 20 streams per batch?
`create_streams_batch` enforces a maximum limit of **20 streams** per invocation (`BatchSizeExceeded` error code). This guard ensures:
1. The transaction comfortably fits within the 100M CPU instruction ceiling.
2. Token transfer authorization loops do not risk running out of gas mid-batch.

---

## 4. Frontend & Wallet Integration

### Which wallets are supported?
- **Freighter Wallet** (official Stellar browser extension and mobile app).
- Standard SEP-0007 / web-wallet protocols.

### Why is Freighter failing to sign transactions?
Common causes and resolutions:
1. **Network Mismatch**: Ensure your Freighter extension is set to **Testnet** rather than Public/Mainnet.
2. **Missing Trustline**: If streaming custom SEP-41 assets (e.g. USDC), ensure your account holds a trustline for the token contract.
3. **Stale Sequence Number**: If transactions fail with `txBadSeq`, refresh your wallet balance or wait a few seconds for the previous transaction to confirm on the ledger.

### How are token balances and stream unlock amounts calculated?
- **Integer Arithmetic & Dust**: The contract uses integer division for rate calculations (`amount_per_second`). Any residual remainder (dust) is retained in the contract and distributed upon stream completion (see [ADR-007](./adr/ADR-007-integer-division-dust.md)).
- **Client-Side Rendering**: The UI recalculates unlocked balances in real time using local client timestamps synchronized with ledger time (see [ADR-002](./adr/ADR-002-client-side-unlock-calculation.md)).

---

## Still Have Questions?
- **Architecture Decisions**: Explore the [Architecture Decision Records (ADRs)](./adr/README.md).
- **API Reference**: Detailed contract signatures and error codes in [API Reference](./api-reference.md).
- **Developer Guide**: Complete code examples in [Integration Guide](./integration-guide.md).
- **GitHub Issues**: Open a discussion or question in the [FlowStar Issue Tracker](https://github.com/FlowwStar/FlowStar/issues).
