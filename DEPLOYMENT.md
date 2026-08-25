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
npm install --legacy-peer-deps
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

## Troubleshooting

**"stellar-cli not found"** — Install with `cargo install stellar-cli --locked`.

**"Simulation failed"** — The deployer account may not have enough XLM. Fund it again with `./scripts/fund-testnet.sh deployer`.

**"Wallet not connected"** — Make sure Freighter is installed and set to the same network as your deployment.

**Contract builds but deploy fails** — Ensure the `wasm32v1-none` Rust target is installed: `rustup target add wasm32v1-none`.
