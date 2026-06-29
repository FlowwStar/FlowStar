# Contributing to FlowStar

Welcome! This guide helps you get from zero to a running local development environment.

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

```bash
cd contracts/streaming
stellar contract build
```

Output: `contracts/target/wasm32v1-none/release/flowstar_streaming.wasm`

### Run contract tests

```bash
cd contracts
cargo test
```

### Deploy to testnet

```bash
# Generate and fund a deployer key (first time only)
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

---

## Pull requests

1. Branch from `main`.
2. One PR per logical change.
3. Reference the GitHub issue number in the PR description (`Closes #NNN`).
