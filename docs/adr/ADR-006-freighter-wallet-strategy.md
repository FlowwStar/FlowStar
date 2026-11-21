# ADR-006: Multi-Wallet Strategy (formerly Freighter-Only)

## Status

Accepted (Updated)

> **Note (Status Update):**
> Multi-wallet support was expanded from the initial Freighter-only strategy. `components/providers/wallet-provider.tsx` now fully implements adapters for **Freighter**, **xBull**, **LOBSTR** (browser extension with WalletConnect v2 fallback for mobile), and **Albedo** (web signer).

## Context

Stellar has several wallet options: Freighter (browser extension), LOBSTR, xBull, Albedo (web-based signer), and WalletConnect-compatible mobile wallets. Supporting all of them requires integrating multiple adapter layers or the Stellar Wallets Kit (SWK), as each wallet has different API surfaces for signing XDR envelopes.

The immediate MVP goal was to ship a working DeFi primitive on Soroban testnet with Freighter support, while designing the modular structure to expand wallet options subsequently.

## Decision

The initial release launched with **Freighter** via `@stellar/freighter-api`. The wallet provider (`components/providers/wallet-provider.tsx`) was structured around a `WALLET_OPTIONS` array and a modular `WalletAdapter` interface (`connect`, `signTransaction`, `isAvailable`).

As planned, multi-wallet support has been implemented by adding dedicated adapters for:
1. **Freighter** via `@stellar/freighter-api`
2. **xBull** via `window.xBullSDK`
3. **LOBSTR** via `window.lobstrSDK` with `@walletconnect/sign-client` & `@walletconnect/modal` fallback for mobile users
4. **Albedo** via `@albedo-link/intent` web signer

## Consequences

- **Easier:** Broad wallet coverage allowing desktop browser extension users, web signer users, and mobile app users (via WalletConnect) to interact with FlowStar. Modular adapter pattern keeps wallet-specific logic isolated in `wallet-provider.tsx`.
- **Harder:** Maintenance of multiple SDK dependencies (`@albedo-link/intent`, `@walletconnect/modal`, `@walletconnect/sign-client`, `@stellar/freighter-api`).
- **Shipped:** Freighter, xBull, LOBSTR (extension + WalletConnect v2), and Albedo are all fully supported in production.
