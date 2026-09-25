# FlowStar — Contributor FAQ

Answers to the questions that come up most often when getting started with
FlowStar. Cross-references to [`CONTRIBUTING.md`](../CONTRIBUTING.md) and the
[docs folder](./) are included wherever more detail is available.

---

## Table of Contents

1. [Getting started](#getting-started)
2. [Mock mode vs. live contract](#mock-mode-vs-live-contract)
3. [Which network should I test against?](#which-network-should-i-test-against)
4. [Issue assignment & claiming work](#issue-assignment--claiming-work)
5. [Branch naming & commit messages](#branch-naming--commit-messages)
6. [Running tests locally](#running-tests-locally)
7. [Security checks before opening a PR](#security-checks-before-opening-a-pr)
8. [Troubleshooting common problems](#troubleshooting-common-problems)

---

## Getting started

**Q: What do I need installed before I can run FlowStar locally?**

| Tool                    | Version           | Notes                                                             |
| ----------------------- | ----------------- | ----------------------------------------------------------------- |
| Node.js                 | 18+               | [nodejs.org](https://nodejs.org)                                  |
| npm                     | bundled with Node | pnpm or bun also work                                             |
| Rust                    | stable            | `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \| sh` |
| Soroban CLI (`stellar`) | latest            | `cargo install stellar-cli --locked`                              |
| Freighter wallet        | latest            | [freighter.app](https://www.freighter.app/) — set to **Testnet**  |

**Q: How do I set up the project for the first time?**

```bash
git clone https://github.com/FlowwStar/FlowStar.git
cd FlowStar
npm ci   # also installs Husky pre-commit hooks
cp .env.local.example .env.local
```

Then add your contract ID to `.env.local` (see the next section) and start the
dev server:

```bash
npm run dev
```

See [CONTRIBUTING.md — Getting started](../CONTRIBUTING.md#getting-started) for
the full walkthrough.

---

## Mock mode vs. live contract

**Q: What is mock mode?**

Mock mode is a local-only fallback that lets you work on UI changes without a
Freighter wallet or testnet funds. It is **automatic** — no code changes
required. When `NEXT_PUBLIC_STREAM_CONTRACT_ID_TESTNET` (or `_MAINNET`) is
absent from `.env.local`, `lib/contract.ts` sets `isMockMode = true` and uses
the data defined in `lib/mock-data.ts`.

The app behaves identically in mock mode — streams unlock in real time using
client-side math. A yellow banner in the UI tells you mock mode is active.

**Q: When should I use mock mode?**

Use mock mode for:

- Working on UI/layout changes that don't involve on-chain logic
- Fast iteration without waiting for RPC round-trips
- Contributing on a machine without Rust or Soroban CLI installed

**Q: When should I use the live testnet contract instead?**

Use the live contract when:

- Your change touches `lib/contract.ts`, `lib/stellar.ts`, or any file that
  calls the Soroban RPC
- You are writing or fixing transaction flows (create, withdraw, cancel, etc.)
- You want to verify the real contract response matches your UI expectations

**Q: How do I switch from mock mode to the live testnet contract?**

Add the contract ID to `.env.local` and restart the dev server:

```bash
NEXT_PUBLIC_STREAM_CONTRACT_ID_TESTNET=CBNDCZTRFNTDAPQLPK2ESOKO4XFMSC4PX37QE75BBYFOYIEWIPMHAKFV
```

The contract is already deployed to testnet — use this value as-is.

**Q: The app is in mock mode but I set the env var. What's wrong?**

- Hard-refresh the browser (`Ctrl+Shift+R`) to clear any cached module state.
- Confirm the dev server was **restarted** after editing `.env.local`.
- Check that the variable name is spelled exactly right and the value is not
  empty.

---

## Which network should I test against?

**Q: Should I use testnet or mainnet?**

Always use **testnet** for local development and PR testing. The FlowStar
contract is already deployed there and you can get free test XLM from the
Stellar faucet (`stellar keys fund <key> --network testnet`).

Mainnet is not used during development. The `_MAINNET` env var exists for
production deployments only.

**Q: What are the testnet connection details?**

|                    | Value                                 |
| ------------------ | ------------------------------------- |
| Network passphrase | `Test SDF Network ; September 2015`   |
| RPC endpoint       | `https://soroban-testnet.stellar.org` |
| Horizon endpoint   | `https://horizon-testnet.stellar.org` |

See [docs/README.md — Network Information](./README.md#network-information) for
both testnet and mainnet details.

**Q: How do I get testnet XLM?**

```bash
stellar keys generate deployer --network testnet
stellar keys fund deployer --network testnet
```

The Stellar faucet automatically funds newly generated keys on testnet.

---

## Issue assignment & claiming work

**Q: How do I get assigned to an issue?**

Leave a comment on the issue asking to be assigned. A maintainer will assign it
to you. Please only request assignment for one issue at a time.

**Q: Is there a time limit after I'm assigned?**

If there has been no activity for several days and the issue is blocking others,
a maintainer may unassign and reopen it. If you need more time, just comment on
the issue so the team knows you're still working on it.

**Q: What if I want to work on something that doesn't have an issue?**

Open an issue first, describe what you'd like to change and why, and wait for
a maintainer to confirm it's a good fit. This avoids duplicated effort and
ensures PRs don't get rejected for scope reasons.

---

## Branch naming & commit messages

**Q: What is the required branch naming format?**

```
feat/NNN-short-description    # new feature
fix/NNN-short-description     # bug fix
docs/NNN-short-description    # documentation
chore/NNN-short-description   # maintenance, deps
perf/NNN-short-description    # performance
```

`NNN` is the issue number. Always include it.

**Q: What commit message format is expected?**

[Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add cliff amount validation (#42)
fix: correct unlock math for sub-second streams (#87)
docs: expand CONTRIBUTING.md (#163)
chore: bump soroban-sdk to v26 (#101)
```

See [CONTRIBUTING.md — Development workflow](../CONTRIBUTING.md#development-workflow)
for details.

---

## Running tests locally

**Q: How do I run the frontend unit tests?**

```bash
npm test          # run once
npm run test:watch  # watch mode
```

Tests live in `lib/__tests__/` and cover unlock math, formatters, and utility
functions.

**Q: How do I run E2E tests?**

```bash
npm run test:e2e   # headless (starts dev server automatically if needed)
```

**Q: How do I run the smart contract tests?**

```bash
cd contracts
cargo test
```

To run a single test:

```bash
cargo test test_withdraw_after_cliff
```

The suite has 44 tests covering the full stream lifecycle, authorization, cliff
edge cases, overdraw protection, and integer math.

See [CONTRIBUTING.md — Running tests](../CONTRIBUTING.md#running-tests) for more.

---

## Security checks before opening a PR

CI will fail your PR if either of these checks finds a problem. Run them
locally first to catch issues early.

**Q: How do I check for hardcoded secrets?**

```bash
node scripts/check-secrets.mjs
```

Exits `0` (clean) or `1` with a `❌ HIGH [SECRETS-001]` line per finding that
includes the file path, line number, and matched pattern.

**Q: How do I run the Soroban contract security check?**

```bash
node scripts/soroban-security-check.mjs
```

| ID          | Severity | What it catches                                                |
| ----------- | -------- | -------------------------------------------------------------- |
| SOROBAN-001 | HIGH     | Unchecked arithmetic on `i128`/`u128`/`u64`                    |
| SOROBAN-002 | HIGH     | Public write functions missing `require_auth()`                |
| SOROBAN-003 | HIGH     | `persistent().set()` not paired with `extend_ttl()`            |
| SOROBAN-004 | LOW      | `panic!("…")` with a string literal instead of `ContractError` |

All `❌ HIGH` findings must be fixed before merging. `⚠️ LOW` warnings are
non-blocking but should be addressed.

See [CONTRIBUTING.md — Local security checks](../CONTRIBUTING.md#local-security-checks)
for the full reference.

---

## Troubleshooting common problems

**Q: Freighter isn't detected / won't connect.**

- Confirm Freighter is set to **Testnet** (not Mainnet or Futurenet).
- Make sure the extension is installed and enabled for `localhost`.
- Reload the page after unlocking Freighter.
- Try disconnecting and reconnecting the wallet from the app.
- Disable other wallet extensions that might conflict.

**Q: I'm seeing RPC failures or transaction timeouts.**

The Soroban testnet RPC (`https://soroban-testnet.stellar.org`) can be
intermittently slow. Retry the operation. Check
[status.stellar.org](https://status.stellar.org/) for any ongoing incidents. If
you see `insufficient resource fee`, increase the fee buffer in `lib/stellar.ts`.

**Q: Contract deployment is failing.**

- Ensure your deployer key is funded: `stellar keys fund deployer --network testnet`
- Rebuild before redeploying: `stellar contract build`
- Update the CLI: `cargo install stellar-cli --locked --force`
- Verify the WASM output exists at
  `contracts/target/wasm32v1-none/release/flowstar_streaming.wasm`
- `Error: account not found` usually means the key isn't funded yet.

**Q: `npm install` fails because of Husky.**

```bash
npm run prepare   # re-installs hooks
```

On CI, set `HUSKY=0` to skip hook installation entirely.

**Q: My pre-commit hook isn't running after a fresh clone.**

Run `npm run prepare` to install the Husky hooks. See
[CONTRIBUTING.md — Pre-commit hooks](../CONTRIBUTING.md#pre-commit-hooks).

---

_Still stuck? Open a [GitHub Discussion](https://github.com/FlowwStar/FlowStar/discussions)
or leave a comment on the relevant issue._

# Frequently Asked Questions

This document collects the most common questions that new contributors ask when working on FlowStar.  
If you can’t find the answer here, feel free to open an issue or check the
[CONTRIBUTING guide](CONTRIBUTING.md) and the
[Troubleshooting guide](docs/TROUBLESHOOTING.md).

---

## 1. What is the difference between **mock mode** and **live mode**?

| Feature         | Mock Mode                                                             | Live Mode                                                                              |
| --------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| **Purpose**     | Quick UI testing without real blockchain interactions.                | Real interactions with Flow blockchain.                                                |
| **Data**        | Uses in‑memory data and deterministic responses.                      | Reads/writes to the actual Flow testnet or mainnet.                                    |
| **Setup**       | No external dependencies.                                             | Requires a Flow wallet, testnet faucet, and network configuration.                     |
| **When to use** | During UI development or when you don’t want to spend testnet tokens. | When you want to validate real contract calls or submit PRs that touch the blockchain. |

> **Tip:** The `mock-mode` flag is toggled in the app’s settings. See the
> [CONTRIBUTING guide](CONTRIBUTING.md) for details on enabling it.

---

## 2. Which network should I test against?

| Network     | Use case                       | How to switch                                                             |
| ----------- | ------------------------------ | ------------------------------------------------------------------------- |
| **Testnet** | Development, CI, and most PRs. | Set `REACT_APP_FLOW_NETWORK=testnet` in your `.env` file.                 |
| **Mainnet** | Production releases only.      | Set `REACT_APP_FLOW_NETWORK=mainnet` and ensure you have a funded wallet. |

> **Note:** The CI pipeline automatically runs tests against the testnet.  
> If you need to run against mainnet locally, make sure you have a valid
> Flow wallet and enough FLOW tokens.

---

## 3. How does issue assignment work?

1. **Labeling** – Issues are labeled with `good first issue`, `help wanted`, etc.
2. **Self‑assignment** – You can assign yourself to an issue by clicking the
   “Assign yourself” button.
3. **Review** – Maintainers review the PR and may reassign if necessary.

If you’re unsure whether an issue is ready for you, open a comment or
contact the maintainers. See the
[CONTRIBUTING guide](CONTRIBUTING.md) for more details on the workflow.

---

## 4. I’m getting “Failed to fetch” errors when running the app locally. What should I do?

1. **Check your network** – Ensure you’re connected to the internet.
2. **Verify environment variables** – Make sure `.env.local` contains the correct
   `REACT_APP_FLOW_NETWORK` and any required API keys.
3. **Run the mock server** – If you’re in mock mode, start the mock server with
   `npm run mock`.
4. **Consult the Troubleshooting guide** – Many common network errors are
   documented in the
   [Troubleshooting guide](docs/TROUBLESHOOTING.md).

---

## 5. How do I run the test suite locally?
