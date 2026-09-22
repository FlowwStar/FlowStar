# Product Roadmap

This document outlines the high-level strategic direction and milestone priorities for **FlowStar**.

With hundreds of issues across smart contract logic, frontend UI, testing, and DevOps, this roadmap helps contributors and maintainers identify core priorities versus speculative backlog items.

---

## Roadmap Overview

```
Phase 1: Testnet Polish & Security Hardening (Current)
  │
  ▼
Phase 2: Mainnet Deployment & Audit Certification (Q4 2026)
  │
  ▼
Phase 3: Advanced Streaming & Automation (Q1 2027)
  │
  ▼
Phase 4: Developer Platform & Ecosystem Tooling (Q2 2027)
```

---

## Milestones & Strategic Priorities

### Phase 1: Testnet Polish & Security Hardening (Current)
*Focus: Rock-solid contract invariants, comprehensive developer ergonomics, and rock-stable testnet deployment.*

- [x] **Modular Contract Test Suite**: Split test coverage across unit, batch, security, integration, and gas benchmarks (see [CONTRACT_TESTING.md](./CONTRACT_TESTING.md)).
- [x] **Client-Side Mock Mode**: Zero-dependency UI development and offline demonstration mode without live RPC dependencies (see [ADR-003](./adr/ADR-003-mock-mode.md)).
- [x] **Deterministic Snapshot Tests**: State machine snapshot tests verifying event topics, data payloads, and error codes.
- [ ] **Accessibility & Keyboard Navigation (a11y)**: Full WCAG 2.1 AA compliance across stream creation flows, tables, and modal dialogs.
- [ ] **Automated CI Contract Verification**: Continuous regression checks measuring CPU instruction and memory consumption against Soroban budget limits.

### Phase 2: Mainnet Launch & Protocol Security (Q4 2026)
*Focus: Mainnet readiness, formal third-party audits, and multi-network reliability.*

- [ ] **Independent Security Audit**: Formal code audit of `flowstar-streaming` smart contracts with published audit report.
- [ ] **Mainnet Contract Deployment**: Multi-sig administered deployment on Stellar Mainnet with deterministic WASM build verification.
- [ ] **Expanded Wallet Support**: Native support for Albedo, WalletConnect, and SEP-0007 mobile wallet handoffs alongside Freighter.
- [ ] **Storage Rent Automation**: Automated keeper bots monitoring and bumping storage TTL (`bump_stream`) on active high-duration streams.
- [ ] **Production Observability**: Sentry error tracking, RPC latency telemetry, and alerts for abnormal transaction failure spikes.

### Phase 3: Advanced Streaming & Automation (Q1 2027)
*Focus: Expanding contract primitives for payroll, recurring vesting, and dynamic recipients.*

- [ ] **Recurring Auto-Renewing Streams**: Pre-authorized payroll streams that automatically renew monthly upon deposit replenishment.
- [ ] **Multi-Recipient Split Streaming**: Single-deposit streams that split real-time payouts across multiple dynamic percentage-based recipients.
- [ ] **Transferable Stream Tokens**: Optional tokenization of stream recipient rights for secondary market liquidity or collateralization.
- [ ] **Emergency Protocol Safeguards**: Time-locked administrative circuit breakers for rapid threat mitigation.

### Phase 4: Developer Platform & Enterprise Tooling (Q2 2027)
*Focus: Programmatic integrations, SDKs, and international enterprise adoption.*

- [ ] **Official TypeScript SDK (`@flowstar/sdk`)**: Lightweight, typed client library for programmatic stream creation, querying, and lifecycle management.
- [ ] **Webhook & Event Indexing Service**: Real-time event webhooks notifying external servers of stream creation, claims, and completions.
- [ ] **Internationalization (i18n)**: Multi-language support covering Spanish, Mandarin, Japanese, Portuguese, and French.
- [ ] **Accounting & Tax Export**: CSV/JSON financial export compatible with common crypto accounting standards (CoinTracker, Cryptio).

---

## Priority Legend

| Status | Meaning |
|---|---|
| 🟢 **Active / High Priority** | Core milestone work actively accepting PRs and contributions. |
| 🟡 **Planned** | Scoped feature areas scheduled for upcoming milestone sprints. |
| 🔵 **Under Consideration** | Exploratory ideas requiring Architecture Decision Records (ADRs) before execution. |

---

## How to Contribute to the Roadmap

1. **Pick an Aligned Issue**: Browse the [Issue Backlog](https://github.com/FlowwStar/FlowStar/issues) for issues tagged with milestone labels (`Phase-1`, `Phase-2`, `good first issue`).
2. **Propose Architecture Changes**: For ideas not yet captured on this roadmap, create an issue proposing an **Architecture Decision Record (ADR)** in `docs/adr/`.
3. **Follow Contribution Guidelines**: Review [CONTRIBUTING.md](../CONTRIBUTING.md) and [docs/FAQ.md](./FAQ.md) for PR verification standards.
