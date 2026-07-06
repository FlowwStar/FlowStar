# ADR-003: Mock Mode for Development

## Status

Accepted

## Context

Developing against the live Soroban testnet requires a funded Freighter wallet, real RPC calls (200–600 ms latency), and occasional testnet outages. This slows down UI iteration and makes it impossible to work without an internet connection or a wallet extension installed. Early contributors reported spending more time managing testnet state than building features.

## Decision

The app supports a **mock contract layer** controlled by the `USE_MOCK` flag in `lib/contract.ts`. When enabled, all contract calls are intercepted and served from an in-memory store in `lib/mock-data.ts`. The mock layer implements the same TypeScript interface as the real contract integration so the rest of the app is unaware of the substitution.

Mock mode is the default in development (`NODE_ENV === 'development'`) and is always disabled in production builds.

## Consequences

- **Easier:** UI work and component development require no wallet, no RPC, and no funded account. New contributors can run `npm run dev` and immediately see realistic stream data.
- **Harder:** Mock data can diverge from real contract behavior. Bugs that only surface with real RPC (serialization errors, fee estimation, auth failures) won't be caught in mock mode.
- **How to apply:** Always run at least one end-to-end test on testnet before merging changes to contract integration code. Mock mode is for UI iteration only.
