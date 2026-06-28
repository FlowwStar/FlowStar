![FlowStar](./flowstar-banner.png)

# FlowStar

Real-time token streaming on Stellar. Send tokens that unlock continuously by the second — perfect for payroll, token vesting, and grants. Built on Soroban smart contracts.

Inspired by [Streamflow](https://streamflow.finance) on Solana.

---

## Live Demo

**Testnet deployment** — connect a [Freighter](https://www.freighter.app/) wallet set to Stellar testnet to try it.

**Contract:** [`CBNDCZTRFNTDAPQLPK2ESOKO4XFMSC4PX37QE75BBYFOYIEWIPMHAKFV`](https://stellar.expert/explorer/testnet/contract/CBNDCZTRFNTDAPQLPK2ESOKO4XFMSC4PX37QE75BBYFOYIEWIPMHAKFV) (Testnet)

---

## Features

- **Per-second unlocking** — funds stream continuously, recipients withdraw anytime
- **Cliff support** — set a cliff date with an optional lump-sum unlock
- **Cancel anytime** — sender cancels and gets unstreamed tokens back, recipient keeps what unlocked
- **Non-custodial** — contract holds funds, no intermediary
- **Multi-token** — XLM, USDC, EURC (any SEP-41 token)

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 16, React 19, Tailwind CSS 4, shadcn/ui |
| Smart Contract | Rust, Soroban SDK v26 |
| Blockchain | Stellar (Soroban) |
| Wallet | Freighter via `@stellar/freighter-api` |
| RPC | Stellar Soroban Testnet RPC |

---

## Project Structure

```
├── app/                    # Next.js app router pages
│   └── app/                # Protected app area
│       ├── page.tsx        # Dashboard
│       ├── streams/        # All streams list
│       ├── create/         # Create stream form
│       └── stream/[id]/    # Stream detail + withdraw/cancel
├── components/
│   ├── landing/            # Marketing landing page
│   ├── layout/             # Navbar, wallet button, auth gate
│   ├── streams/            # Stream card, stats, empty state
│   └── ui/                 # shadcn/ui primitives
├── contracts/
│   └── streaming/          # Soroban smart contract (Rust)
│       └── src/
│           ├── lib.rs       # Contract logic
│           ├── test.rs      # Unit tests (13 tests)
│           └── test_security.rs  # Security tests (31 tests)
├── hooks/                  # useStreams, useContract, useWallet, useNow
├── lib/
│   ├── contract.ts         # Contract integration layer
│   ├── stellar.ts          # Network config + RPC client
│   ├── stream-utils.ts     # Unlock math, formatters
│   └── mock-data.ts        # Dev mock store
└── types/stream.ts         # StreamData, TokenInfo, CreateStreamInput
```

---

## Contract

The Soroban contract is at `contracts/streaming/`. It handles:

| Function | Description |
|---|---|
| `create_stream` | Fund a new stream (requires prior `approve` on token) |
| `withdraw` | Recipient withdraws unlocked tokens |
| `cancel` | Sender cancels — recipient gets unlocked portion, sender gets remainder |
| `get_stream` | Read stream by ID |
| `get_withdrawable` | Current withdrawable amount |
| `get_sent_streams` | All stream IDs sent by an address |
| `get_received_streams` | All stream IDs received by an address |

### Vesting math

```
unlocked = cliffAmount + (elapsed × amountPerSecond)
```

Capped at `depositedAmount`. The cliff blocks any unlock until `cliffTime` is reached.

### Running contract tests

```bash
cd contracts
cargo test
```

44 tests pass covering the full lifecycle, authorization, overdraw protection, cliff edge cases, integer math, and self-streams.

---

## Getting Started

### Prerequisites

- Node.js 18+
- [Freighter](https://www.freighter.app/) browser extension (set to Testnet)

### Install & run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment variables

```bash
# .env.local
NEXT_PUBLIC_STREAM_CONTRACT_ID=CBNDCZTRFNTDAPQLPK2ESOKO4XFMSC4PX37QE75BBYFOYIEWIPMHAKFV
```

The contract is already deployed to testnet. For mainnet, deploy your own and update this value.

### Deploy the contract yourself

```bash
# Install stellar-cli
cargo install stellar-cli --locked

# Generate a deployer key and fund it
stellar keys generate deployer --network testnet
stellar keys fund deployer --network testnet

# Build
cd contracts/streaming
stellar contract build

# Deploy
stellar contract deploy \
  --wasm contracts/target/wasm32v1-none/release/flowstar_streaming.wasm \
  --source deployer \
  --network testnet
```

---

## Testing a stream end-to-end

1. Install [Freighter](https://www.freighter.app/) and switch to **Testnet**
2. Fund your wallet at [Stellar Laboratory Friendbot](https://laboratory.stellar.org/#account-creator?network=test)
3. Open the app at `localhost:3000`
4. Connect Freighter → Create a stream → use this as the recipient address for testing:

```
GBWEDYWFGPNPAWCYOKWMCRPTR4IMV4SNZ7CVOZHPUXGHVXXPJSCFKVXQ
```

You'll sign two transactions: one `approve` on the token contract, then `create_stream`.

---

## Architecture notes

- `lib/contract.ts` is the single integration boundary — swap mock ↔ real by changing `USE_MOCK`
- Stream unlock math runs client-side in `lib/stream-utils.ts` for live UI counters without polling
- The contract uses `Persistent` storage with TTL extensions on every write (~30 days per stream)
- All token amounts use `bigint` (i128/u64) to match Soroban types exactly — no precision loss

---

## Architecture Decision Records

Key design choices are documented in [`docs/adr/`](./docs/adr/README.md). Start there if you're wondering "why was it done this way?" before changing something fundamental.

---

## Security

Found a vulnerability? Please read our [Security Policy](./SECURITY.md) before disclosing. We prefer private disclosure via [GitHub Security Advisories](https://github.com/FlowwStar/FlowStar/security/advisories/new).

---

## License

MIT
