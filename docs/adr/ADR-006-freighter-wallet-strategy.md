# ADR-006: Freighter-Only Wallet Strategy

## Status

Accepted

## Context

Stellar has several wallet options: Freighter (browser extension), LOBSTR, xBull, Albedo (web-based signer), and WalletConnect-compatible mobile wallets. Supporting all of them from day one requires integrating the Stellar Wallets Kit (SWK) or writing multiple adapter layers, and each wallet has different API surfaces for signing XDR envelopes.

The immediate goal was to ship a working DeFi primitive on Soroban testnet. Breadth of wallet support was deferred to reduce scope.

## Decision

The initial release supports **Freighter only** via `@stellar/freighter-api`. The wallet provider (`components/providers/wallet-provider.tsx`) is structured around a `WALLET_OPTIONS` array to make adding new wallets straightforward — each option is an object with `id`, `name`, `detail`, and a `connect` function.

## Consequences

- **Easier:** Single integration path, well-documented API, and Freighter is the most widely used Stellar browser wallet among developers.
- **Harder:** Users without Freighter cannot use the app. Mobile users are blocked entirely.
- **Roadmap:** The next wallet to add is xBull (also browser extension, similar API). After that, Albedo enables users without a browser extension. WalletConnect would unlock mobile. Each can be added as a new entry in `WALLET_OPTIONS` without changing the rest of the app.
