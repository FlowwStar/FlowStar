# Deploying FlowStar

This guide covers deploying the FlowStar streaming contract to Stellar testnet or mainnet and connecting it to the frontend.

---

## Prerequisites

- **Rust** toolchain with the `wasm32v1-none` target:
  ```bash
  rustup target add wasm32v1-none
  ```
- **stellar-cli**:
  ```bash
  cargo install stellar-cli --locked
  ```
- **Node.js 18+** for the frontend

---

## 1. Create and fund a deployer account

Use the provided script to generate a testnet identity and fund it via Friendbot:

```bash
./scripts/fund-testnet.sh deployer
```

This creates a stellar-cli identity named `deployer` and funds it with 10,000 XLM on testnet.

To create additional test accounts (e.g. a recipient for testing):

```bash
./scripts/fund-testnet.sh recipient-test
```

### Manual alternative

```bash
stellar keys generate deployer --network testnet
stellar keys fund deployer --network testnet
```

---

## 2. Deploy the contract

### Automated (recommended)

```bash
# Deploy to testnet and update .env.local automatically
./scripts/deploy.sh --update-env

# Deploy to mainnet with a specific identity
./scripts/deploy.sh --network mainnet --source prod-deployer --update-env
```

The script will:

1. Build the contract WASM (`stellar contract build`)
2. Deploy to the specified network
3. Print the new contract ID
4. Optionally write it to `.env.local`

### Manual

```bash
# Build
cd contracts/streaming
stellar contract build

# Deploy
cd ../..
stellar contract deploy \
  --wasm contracts/target/wasm32v1-none/release/flowstar_streaming.wasm \
  --source deployer \
  --network testnet
```

Copy the output contract ID for the next step.

---

## 3. Configure the frontend

Set the contract ID in your environment:

```bash
# .env.local
NEXT_PUBLIC_STREAM_CONTRACT_ID=<your-contract-id>
```

Then start the app:

```bash
npm ci
npm run dev
```

The app automatically switches from mock mode to live contract calls when `NEXT_PUBLIC_STREAM_CONTRACT_ID` is set.

---

## 4. Verify the deployment

1. Open the app at `http://localhost:3000`
2. Connect a Freighter wallet set to the correct network
3. Create a test stream with a small amount
4. Confirm both the `approve` and `create_stream` transactions succeed

You can also inspect the contract on [Stellar Expert](https://stellar.expert/explorer/testnet/contract/<your-contract-id>).

---

## 5. Monitor the live deployment

A deployment that passed verification can still fail later: frontend errors, expired storage, or an unexpected admin action. Set up the checks below once a contract is live, especially on mainnet.

### Frontend errors (Sentry)

The frontend reports errors to Sentry through `@sentry/nextjs` ([sentry.client.config.ts](sentry.client.config.ts), [sentry.server.config.ts](sentry.server.config.ts), [sentry.edge.config.ts](sentry.edge.config.ts), and the wrapper in [lib/sentry.ts](lib/sentry.ts)). It is **enabled only when `NODE_ENV === "production"`**, so nothing is reported from `npm run dev`.

Set these in the production environment (see `.env.local.example`):

| Variable                                            | Purpose                                                                |
| --------------------------------------------------- | ---------------------------------------------------------------------- |
| `NEXT_PUBLIC_SENTRY_DSN`                            | Browser DSN                                                            |
| `SENTRY_DSN`                                        | Server/edge DSN                                                        |
| `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` | Source map upload at build time. Keep `SENTRY_AUTH_TOKEN` server-only. |

Recommended alerts in Sentry:

- **Error-rate spike after a release.** Alert when the event count for a new release clearly exceeds the previous release's baseline. This is the fastest signal that a frontend deploy or a contract change broke something, and it is often your cue to start incident response.
- **New issue.** Alert on the first occurrence of any new issue in production.
- **Per-operation failures.** Errors reported through `captureError` carry an `operation` tag (for example `use-streams`, `use-stream`, `use-archived-streams`, `page_render`). A spike in the data-loading hooks usually means the RPC is failing or the configured contract ID is wrong, not that there is a UI bug.

Performance traces are sampled at 10% (`tracesSampleRate: 0.1`). Wallet addresses are truncated and request payloads are redacted before events are sent, so don't expect full addresses or amounts in Sentry events.

### Contract storage TTL

Soroban storage entries expire unless their TTL is extended (see [ADR-001](docs/adr/ADR-001-persistent-storage.md) and the storage notes at the top of [contracts/streaming/src/lib.rs](contracts/streaming/src/lib.rs)):

| Entry                                             | TTL on write                        | Extended by                                                     |
| ------------------------------------------------- | ----------------------------------- | --------------------------------------------------------------- |
| Instance storage (`Admin`, `Paused`, `NextId`)    | ~1 day (`INSTANCE_TTL_LEDGERS`)     | `initialize`, `pause`, `unpause`, stream creation               |
| `Stream(id)`                                      | ~30 days (`PERSISTENT_TTL_LEDGERS`) | every write to the stream; `bump_stream`                        |
| `Delegate(id)`, `StreamMetadata(id)`, index lists | ~30 days                            | only their own writes. `bump_stream` does **not** extend these. |

What to monitor:

- **Instance TTL.** The contract instance's TTL is extended only by the writes listed above. If a quiet contract goes a day or more with none of those writes, check its TTL so the instance doesn't come close to expiry. Extend it manually if needed (with no `--key`, `stellar contract extend` extends the contract instance):
  ```bash
  stellar contract extend --id <contract-id> --ledgers-to-extend 518400 \
    --durability persistent --source deployer --network mainnet
  ```
- **Long-idle streams.** An active stream with no withdrawal, top-up, or other write for ~30 days can expire. Anyone can call `bump_stream` to extend it:
  ```bash
  stellar contract invoke --id <contract-id> --source deployer --network mainnet \
    -- bump_stream --stream_id <id>
  ```
  For high-value deployments, run a scheduled job that lists active streams and bumps any whose TTL is within about 7 days of expiry.
- **Check real TTLs, not estimates.** The stream page's TTL warning (`app/app/stream/[id]/page.tsx`) _estimates_ days remaining from the last write. For alerting, read the actual `liveUntilLedgerSeq` returned by the RPC `getLedgerEntries` method for the instance and `Stream(id)` keys.

### Contract admin activity

Pausing, upgrading and migrating the contract all change the behavior for every user, so any of them happening unexpectedly is an incident:

- **Pause state.** The contract emits `PauseEvent` and `UnpauseEvent`. Alert on both, because a pause blocks every write, including recipient withdrawals.
- **WASM changes.** `upgrade` emits **no event**. To detect an upgrade, poll the contract instance ledger entry and alert when its executable WASM hash changes, and check that `version` returns the value you expect.

### Network and CI health

- Subscribe to [Stellar Status](https://status.stellar.org/) and your RPC provider's status page. When RPC is degraded, Sentry errors rise even though nothing in FlowStar changed.
- Keep `contract-ci.yml` and `security.yml` green on `main`. A red contract CI run on `main` means the next deploy is unverified.

---

## Network configuration

Which network the app talks to is controlled by `NEXT_PUBLIC_STELLAR_NETWORK`
(see `.env.local.example`). Set it to `mainnet` to point the app at the
Stellar Public Network; omit it (or set it to anything else) to default to
`testnet`. Because it's a `NEXT_PUBLIC_` variable, changing it requires a
rebuild.

The per-network settings themselves live in [lib/stellar.ts](lib/stellar.ts). For mainnet, update:

| Field        | Testnet                               | Mainnet                                          |
| ------------ | ------------------------------------- | ------------------------------------------------ |
| `name`       | `testnet`                             | `mainnet`                                        |
| `passphrase` | `Test SDF Network ; September 2015`   | `Public Global Stellar Network ; September 2015` |
| `rpcUrl`     | `https://soroban-testnet.stellar.org` | Your RPC provider URL                            |
| `horizonUrl` | `https://horizon-testnet.stellar.org` | `https://horizon.stellar.org`                    |

Update `KNOWN_TOKENS` addresses to match the mainnet token contracts.

---

## Rollback and incident response

The streaming contract holds user funds in escrow, so a bad deployment is handled differently from a bad web release. This section lists the recovery options available and a step-by-step checklist for using them.

### Before every contract release

Recovery is only possible if these are done **before** the release:

- **Record the currently live WASM hash** so you can switch back to it. A WASM hash is the SHA-256 of the `.wasm` bytes, and `stellar contract upload` prints it:
  ```bash
  sha256sum contracts/target/wasm32v1-none/release/flowstar_streaming.wasm
  ```
- **Keep the old `.wasm` file** (for example as a CI artifact or on a release tag). If its code entry has expired on the ledger, you will need to re-upload it before rolling back.
- **Bump `CONTRACT_VERSION`** in `contracts/streaming/src/lib.rs`. The `version()` function returns this constant. It is the only way to tell from the chain which build is live, and it only helps if each release bumps it.
- **Make storage changes backward-compatible.** If the new version writes data in a layout the old code cannot read, rolling back the WASM will break those streams. Prefer additive changes (new keys, new optional fields) over rewriting existing entries.
- **Test the upgrade on testnet first**, including rolling back to the previous hash.

### Recovery options

Listed from least to most disruptive:

| Option                           | When to use                                                       | Effect on streams                                                |
| -------------------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------- |
| **Frontend rollback**            | The problem is in the web app only                                | None. The contract is untouched.                                 |
| **Pause**                        | The contract is misbehaving and you need time                     | All writes blocked, **including withdrawals**. Reads still work. |
| **Upgrade to the previous WASM** | A contract release introduced a bug                               | Contract ID, streams and escrowed funds are kept                 |
| **Upgrade to a fixed WASM**      | Rolling back isn't possible (for example a storage layout change) | Contract ID, streams and escrowed funds are kept                 |
| **Deploy a new contract**        | Last resort only                                                  | Existing streams stay in the old contract; see below             |

**Frontend rollback.** Redeploy the previous frontend build on your hosting provider (staging uses Vercel, see `.github/workflows/staging.yml`). `NEXT_PUBLIC_STREAM_CONTRACT_ID_TESTNET`/`_MAINNET` and `NEXT_PUBLIC_STELLAR_NETWORK` are compiled into the build, so changing them requires a rebuild, not only an env change.

**Pause.** The admin can call `pause` to block `create_stream`, `create_streams_batch`, `top_up`, `withdraw`, `cancel`, `partial_cancel`, `transfer_stream`, `update_stream_metadata`, `set_delegate` and `remove_delegate`. The following still work while paused: all read functions, `bump_stream`, `cleanup_stream`, `upgrade` and `migrate`, so you can still upgrade a paused contract.

```bash
stellar contract invoke --id <contract-id> --source <admin-identity> --network mainnet -- pause
stellar contract invoke --id <contract-id> --source <admin-identity> --network mainnet -- unpause
```

Pausing also stops recipients from withdrawing funds they have already earned, so keep the contract paused only as long as necessary.

**Upgrade (roll back or roll forward).** `upgrade` swaps the contract's WASM in place, keeping the contract ID and all storage:

```bash
# Only needed if the target WASM is not installed on the ledger
stellar contract upload --wasm <path-to-wasm> --source <admin-identity> --network mainnet

stellar contract invoke --id <contract-id> --source <admin-identity> --network mainnet \
  -- upgrade --admin <admin-address> --new_wasm_hash <wasm-hash>

# Confirm which build is live
stellar contract invoke --id <contract-id> --source <admin-identity> --network mainnet -- version
```

**How `migrate()` and `CONTRACT_VERSION` fit in:**

- `CONTRACT_VERSION` is a compile-time constant. It is **not** stored on-chain, and neither `upgrade` nor `migrate` checks it. After any upgrade or rollback, `version()` tells you which build is running.
- `migrate()` currently does only one thing: it **unconditionally unpauses** the contract. It runs no storage migration and has no protection against being called twice. **Don't call `migrate` during an incident until you are ready to resume normal operation.** It lifts a pause just as `unpause` does.
- If a future release needs a real storage migration, add it to `migrate()`, make it safe to run more than once, and write down whether the previous WASM can still read the migrated data. If it can't, rollback is no longer an option for that release, and only a fix-forward upgrade is.

**Deploying a new contract (last resort).** A fresh deploy gets a new contract ID. Existing streams and their escrowed funds **stay in the old contract** and cannot be moved. The old contract must remain unpaused and working so recipients can withdraw and senders can cancel. The frontend reads only one contract ID per network, so users of old streams lose UI access unless you provide another way in. Prefer an upgrade whenever possible.

**Admin key compromise.** The contract has no function for changing the admin. Whoever holds the admin key can pause the contract or upgrade it to arbitrary code, and nothing in the contract can recover from that. Store the admin key offline or in a multisig, and treat a suspected compromise as a critical incident. Warn users publicly as soon as possible.

### Incident response checklist

1. **Detect.** The usual triggers are a Sentry alert, an unexpected `PauseEvent` or WASM change, user reports, or a failing check against the live contract.
2. **Assess** using read-only calls: `version`, `get_stream`, `get_withdrawable`. Is it a frontend problem, a contract problem, or an RPC/network problem ([Stellar Status](https://status.stellar.org/))? Are funds at risk?
3. **Contain.** If funds are at risk or state is being corrupted, `pause` immediately. For frontend-only issues, roll back the frontend instead.
4. **Communicate.** Post a status update telling users what is affected, whether withdrawals are paused, and when the next update will come. Report security issues privately according to [SECURITY.md](SECURITY.md), not in public issues.
5. **Fix.** Upgrade to the previous WASM hash, or to a fixed build that has been tested on testnet.
6. **Verify.** Check `version`, read a sample of existing streams with `get_stream`, and run a small withdrawal on testnet against the same WASM.
7. **Resume.** Call `unpause`, or `migrate` if the new build needs its migration to run.
8. **Follow up.** Write a short post-mortem. Add a regression test in `contracts/streaming/src/` and update this section if the process fell short.

---

**"Wallet not connected"** — Make sure Freighter is installed and set to the same network as your deployment.

**Contract builds but deploy fails** — Ensure the `wasm32v1-none` Rust target is installed: `rustup target add wasm32v1-none`.
