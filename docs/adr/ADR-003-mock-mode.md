# ADR-003: Mock Mode for Development

## Status

Accepted

## Context

Developing against the live Soroban testnet requires a funded Freighter wallet, real RPC calls (200–600 ms latency), and occasional testnet outages. This slows down UI iteration and makes it impossible to work without an internet connection or a wallet extension installed. Early contributors reported spending more time managing testnet state than building features.

## Decision

The app supports a **mock contract layer** that activates automatically in `lib/contract.ts`. There is no manual flag to flip. Mock mode is derived at runtime:

```ts
const isMockMode = !config.streamContractId
```

`config.streamContractId` is populated from `NEXT_PUBLIC_STREAM_CONTRACT_ID_TESTNET` (or `_MAINNET` on mainnet). When that env var is absent or empty, `isMockMode` is `true` and all contract calls are intercepted and served from an in-memory store in `lib/mock-data.ts`. The mock layer implements the same TypeScript interface as the real contract integration so the rest of the app is unaware of the substitution.

Mock mode is not tied to `NODE_ENV`. It activates whenever the contract ID env var is missing — in any environment, including production if the var is not set.

## Consequences

- **Easier:** UI work and component development require no wallet, no RPC, and no funded account. New contributors can run `npm run dev` (without setting up `.env.local`) and immediately see realistic stream data.
- **Harder:** Mock data can diverge from real contract behavior. Bugs that only surface with real RPC (serialization errors, fee estimation, auth failures) won't be caught in mock mode.
- **How to enable the real contract:** Set `NEXT_PUBLIC_STREAM_CONTRACT_ID_TESTNET` in `.env.local` and restart the dev server. To go back to mock mode, remove or comment out that variable.
- **How to apply:** Always run at least one end-to-end test on testnet before merging changes to contract integration code. Mock mode is for UI iteration only.
