# Contributing to FlowStar

Welcome! This guide helps you get from zero to a running local development environment.
Thanks for your interest in contributing! This guide covers everything you need to get your local environment running and understand the development workflow.

---

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node.js | 18+ | [nodejs.org](https://nodejs.org) |
| npm | bundled with Node | or pnpm / bun |
| Rust | stable | `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh` |
| Soroban CLI | latest | `cargo install stellar-cli --locked` |
| Freighter wallet | latest | [freighter.app](https://www.freighter.app/) — set to **Testnet** |

---

## Getting started
| Tool | Version | Purpose |
|---|---|---|
| Node.js | 18+ | Frontend development |
| npm or pnpm | latest | Package management |
| Rust | stable | Smart contract development |
| stellar-cli | latest | Contract build & deploy |
| Freighter | latest | Wallet for testnet interactions |

### Install Rust

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup target add wasm32v1-unknown-none
```

### Install Soroban CLI

```bash
cargo install stellar-cli --locked
```

### Install Freighter

Download the [Freighter browser extension](https://www.freighter.app/) and switch it to **Testnet** in settings.

---

## Getting Started

### 1. Clone and install

### 1. Clone and install

```bash
git clone https://github.com/FlowwStar/FlowStar.git
cd FlowStar
npm install   # also installs Husky pre-commit hooks via prepare script
```

### 2. Configure environment variables

```bash
cp .env.local.example .env.local
```

The example file has the testnet contract address pre-filled — no changes needed for local development.
npm install
```

### 2. Set up environment variables

```bash
cp .env.local.example .env.local   # if an example exists, otherwise create it
```

Create `.env.local` with:

```bash
NEXT_PUBLIC_STREAM_CONTRACT_ID=CBNDCZTRFNTDAPQLPK2ESOKO4XFMSC4PX37QE75BBYFOYIEWIPMHAKFV
```

The contract is already deployed to testnet — use this value as-is for local development.

### 3. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Mock mode (no wallet needed)

Set `USE_MOCK = true` in `lib/contract.ts` to run the app with local mock data instead of talking to the blockchain. This is the fastest way to work on UI changes without a Freighter wallet or testnet funds.

```ts
// lib/contract.ts
const USE_MOCK = true  // ← flip this
```

Mock streams are defined in `lib/mock-data.ts`. The app behaves identically — streams unlock in real time using client-side math.

---

## Development workflow

### Branch naming

```
feat/NNN-short-description   # new feature
fix/NNN-short-description    # bug fix
docs/NNN-short-description   # documentation
perf/NNN-short-description   # performance
```

Always include the issue number (`NNN`) in the branch name.

### Commit messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add cliff amount input to create form (#42)
fix: correct unlock math for sub-second streams (#51)
docs: expand contributing guide (#163)
perf: remove unoptimized image flag (#158)
```

### PR process

1. Branch from `main`.
2. One PR per logical change — keep diffs focused.
3. Reference the issue: `Closes #NNN` in the PR description.
4. All CI checks must pass before merge.
5. At least one review approval required.

---

## Running tests

### Unit tests (Vitest)

```bash
npm test               # run once
npm run test:watch     # watch mode
```

Tests live in `lib/__tests__/`. The suite covers unlock math, formatters, and utility functions.

### E2E tests (Playwright)

```bash
npm run test:e2e       # headless
npm run test:e2e:ui    # interactive UI mode
```

E2E tests require a running dev server (`npm run dev` in a separate terminal).

### Contract tests (Rust)

```bash
cd contracts
cargo test
```

44 tests covering the full stream lifecycle, authorization, cliff edge cases, overdraw protection, and integer math.

---

## Contract development

### Build the contract

---

## Mock Mode

To develop UI without a wallet or testnet connection, enable mock mode in `lib/contract.ts`:

```ts
const USE_MOCK = true;
```

Mock mode uses the in-memory store in `lib/mock-data.ts` and bypasses all Freighter and RPC calls. Set `USE_MOCK = false` to switch back to the real contract.

---

## Development Workflow

### Branch naming

```
feat/NNN-short-description    # new features
fix/NNN-short-description     # bug fixes
docs/NNN-short-description    # documentation
chore/NNN-short-description   # maintenance, deps
```

Where `NNN` is the GitHub issue number (e.g. `feat/163-contributing-guide`).

### Commits

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add cliff amount validation (#42)
fix: correct unlock math for sub-second streams (#87)
docs: expand CONTRIBUTING.md (#163)
chore: bump soroban-sdk to v26 (#101)
```

### PR process

1. Fork the repo (external contributors) or create a branch (maintainers).
2. Open a pull request against `main`.
3. Fill in the PR template — summary, what was tested, any caveats.
4. A maintainer will review. Address feedback by pushing new commits (don't force-push during review).
5. PRs are squash-merged once approved and CI passes.

---

## Running Tests

### Frontend unit tests (vitest)

```bash
npm run test
```

### End-to-end tests (Playwright)

```bash
npm run test:e2e
```

Playwright tests require the dev server to be running or will start it automatically depending on the config.

### Smart contract tests (cargo)

```bash
cd contracts
cargo test
```

44 tests cover the full stream lifecycle, authorization, overdraw protection, cliff edge cases, integer math, and self-streams.

---

## Contract Development

All contract source lives in `contracts/streaming/src/`.

### Build

```bash
cd contracts/streaming
stellar contract build
```

Output: `contracts/target/wasm32v1-none/release/flowstar_streaming.wasm`

### Run contract tests
### Test

```bash
cd contracts
cargo test
```

### Deploy to testnet

```bash
# Generate and fund a deployer key (first time only)
To run a single test:

```bash
cargo test test_withdraw_after_cliff
```

### Deploy to testnet

```bash
# Generate and fund a deployer key (one-time)
stellar keys generate deployer --network testnet
stellar keys fund deployer --network testnet

# Deploy
stellar contract deploy \
  --wasm contracts/target/wasm32v1-none/release/flowstar_streaming.wasm \
  --source deployer \
  --network testnet
```

Copy the contract ID returned and update `NEXT_PUBLIC_STREAM_CONTRACT_ID` in `.env.local`.

---

## Code style

### TypeScript

- ESLint + Prettier (config in `eslint.config.mjs` and `.lintstagedrc`)
- Hooks in `hooks/`, utilities in `lib/`, page components in `app/`, shared components in `components/`
- Use `bigint` for all token amounts to match Soroban `i128`/`u64` types exactly

### Rust

- `cargo fmt` (rustfmt defaults)
- `cargo clippy` for linting

### Pre-commit hooks

Husky runs lint-staged on every commit:

| File type | Checks |
|---|---|
| `*.ts`, `*.tsx` | ESLint (auto-fix) + Prettier |
| `*.json`, `*.md`, `*.css` | Prettier |
| `*.rs` | `cargo fmt --check` |

To skip in an emergency: `git commit --no-verify`. Use sparingly.

If hooks aren't running after a fresh clone: `npm run prepare`.

---

## Troubleshooting

**Freighter not connecting**
- Confirm Freighter is set to **Testnet** (not Mainnet or Futurenet)
- Try disconnecting and reconnecting the wallet from the app
- Disable other wallet extensions that might conflict

**RPC connection failures**
- The testnet RPC (`https://soroban-testnet.stellar.org`) can be intermittently slow
- Check [Stellar status](https://status.stellar.org) for outages
- Retry after a minute; requests are not queued

**Contract deployment errors**
- Ensure your deployer key is funded: `stellar keys fund deployer --network testnet`
- Check that `stellar-cli` is up to date: `cargo install stellar-cli --locked --force`
- Verify WASM output exists at `contracts/target/wasm32v1-none/release/flowstar_streaming.wasm`

**`npm install` fails on Husky**
- Run `npm run prepare` manually to re-install hooks
- If on CI, set `HUSKY=0` environment variable to skip hook installation

Copy the returned contract ID into your `.env.local` as `NEXT_PUBLIC_STREAM_CONTRACT_ID`.

---

## Code Style

### TypeScript

- Linting: ESLint (`npm run lint`)
- Formatting: Prettier (`npm run format`)
- All new components go under `components/` in the appropriate subdirectory (`ui/`, `streams/`, `layout/`, `landing/`).
- Use `bigint` for all token amounts — never `number` — to match Soroban's `i128`/`u64` types exactly.

### Rust

Format before committing:

```bash
cd contracts/streaming
cargo fmt
cargo clippy
```

---

## Troubleshooting

**Freighter not detected**
- Make sure the extension is installed and enabled for `localhost`.
- Reload the page after unlocking Freighter.
- Check that Freighter is set to **Testnet**, not Mainnet or Futurenet.

**RPC failures / transaction timeouts**
- The Soroban testnet RPC can be intermittently slow. Retry the operation.
- Check [Stellar Status](https://status.stellar.org/) for any ongoing incidents.
- If you see `insufficient resource fee`, increase the fee buffer in `lib/stellar.ts`.

**Contract deployment errors**
- Ensure your deployer key has testnet XLM: `stellar keys fund deployer --network testnet`.
- If the WASM upload fails, try rebuilding: `stellar contract build` then redeploy.
- `Error: account not found` usually means the key isn't funded yet.

**`USE_MOCK = false` but seeing mock data**
- Hard-refresh the browser (`Ctrl+Shift+R`) to clear any cached module state.
- Confirm the env var `NEXT_PUBLIC_STREAM_CONTRACT_ID` is set in `.env.local` and the dev server was restarted after the change.

---

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](./LICENSE).
