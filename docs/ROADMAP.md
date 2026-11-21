# FlowStar Roadmap

This document groups the major planned feature areas at a high level so contributors and
maintainers can orient themselves relative to the overall project direction. It is
intentionally distinct from the granular [issue backlog](https://github.com/FlowwStar/FlowStar/issues)
— think of it as a map, not a sprint board.

Status markers used below:

| Marker | Meaning |
|--------|---------|
| ✅ Done | Shipped and merged |
| 🚧 In progress | Actively being built or partially landed |
| 📋 Planned | Clearly scoped, not yet started |
| 💡 Speculative | Worth exploring; no firm commitment |

---

## 1. Mainnet Deployment

**Goal:** graduate from Testnet-only to a live Stellar Mainnet contract.

| Item | Status |
|------|--------|
| Testnet contract deployed & stable | ✅ Done |
| `NEXT_PUBLIC_STREAM_CONTRACT_ID_MAINNET` env-var slot wired in `lib/stellar.ts` | ✅ Done |
| Mainnet contract audit / review | 📋 Planned |
| Mainnet contract deployment | 📋 Planned |
| UI warning removed / mainnet onboarding flow | 📋 Planned |
| Mainnet documentation and migration guide | 📋 Planned |

Everything the app needs to switch networks already exists in the codebase — the
`NetworkProvider` toggles between `testnet` and `mainnet` configs and the create-form
surfaces a mainnet warning today. Mainnet launch is gated on a security review of the
deployed contract, not on further feature work.

---

## 2. Missing Contract Actions in the UI

The Soroban contract exposes three write operations that have no UI entry point yet.
The contract code, fee constants (`lib/fee-utils.ts`), and webhook event types are all
already defined.

| Contract function | Status |
|-------------------|--------|
| `top_up` — sender adds funds to an active stream | 📋 Planned |
| `partial_cancel` — sender reduces locked balance, releases excess | 📋 Planned |
| `transfer_stream` — recipient reassigns stream rights to another address | 📋 Planned |

These three actions belong on the stream detail page (`app/app/stream/[id]/page.tsx`) as
additional dialogs alongside the existing withdraw / cancel / cleanup controls.

---

## 3. Recipient Consent / Anti-Spam

**Goal:** give recipients meaningful control over unsolicited incoming streams.

| Item | Status |
|------|--------|
| Client-side hide stream / block sender (localStorage, no on-chain effect) | ✅ Done |
| "Show hidden" toggle on streams list | ✅ Done |
| Contract-level recipient opt-in (consent before stream appears) | 📋 Planned |

The current hide/block mechanism (`lib/hidden-streams.ts`) is explicitly marked as a
stopgap until a contract-level opt-in is designed. The most natural approach — a
per-address allow/deny list stored in contract persistent storage — is tracked as
issue #151. This requires a contract upgrade and migration pass (`migrate()`).

---

## 4. Recurring Streams

**Goal:** let senders schedule automatic stream renewals on a calendar cadence.

| Item | Status |
|------|--------|
| Recurrence cadence picker (weekly / monthly / quarterly) in create form | ✅ Done |
| `lib/recurring.ts` with calendar-aware `buildNextRunAt()` | ✅ Done |
| Renewal rules stored in localStorage and surfaced in settings | ✅ Done |
| Automated renewal trigger (notification + one-click re-create) | 🚧 In progress |
| Server-side / background renewal without user interaction | 💡 Speculative |

The scheduling infrastructure is complete. The outstanding piece is a reliable surface
for *triggering* the renewal: either a notification-bell prompt (low-friction, user
still clicks) or a background job that submits the transaction autonomously (requires
a backend signing key and is outside the current non-custodial model).

---

## 5. Internationalization (i18n)

**Goal:** make the UI translatable by extracting all user-facing strings.

| Item | Status |
|------|--------|
| Centralized copy module for create-form strings (`lib/copy/create-form.ts`) | ✅ Done |
| Centralized copy module for stream-detail strings (`lib/copy/stream-detail.ts`) | ✅ Done |
| Copy extraction for remaining pages (streams list, dashboard, analytics, settings) | 📋 Planned |
| Integrate an i18n library (e.g. `next-intl`) and locale routing | 📋 Planned |
| Initial translation: at least one non-English locale | 💡 Speculative |

Both existing copy modules note "First step toward i18n-readiness." The extraction
work should reach full coverage before the translation layer is added.

---

## 6. Analytics & Reporting

**Goal:** give senders and recipients actionable insight into their streaming activity.

| Item | Status |
|------|--------|
| Per-day volume chart | ✅ Done |
| Token share breakdown chart | ✅ Done |
| Status breakdown chart | ✅ Done |
| Top recipients table | ✅ Done |
| Aggregate unlock progress | ✅ Done |
| Export stream history to CSV | ✅ Done |
| Downloadable PDF / HTML receipt per stream | ✅ Done |
| Cross-address / portfolio analytics (multi-wallet view) | 💡 Speculative |
| Embeddable analytics widget for third-party dashboards | 💡 Speculative |

---

## 7. Accessibility (a11y)

**Goal:** meet WCAG 2.1 AA across the full application.

| Item | Status |
|------|--------|
| Accessible countdown timer component with live region | ✅ Done |
| Accessible unlock amount component | ✅ Done |
| Screen-reader live region for batch-create progress (#686) | ✅ Done |
| Focus management in notification dropdown (#684) | 📋 Planned |
| axe-core assertions in Playwright suite | ✅ Done |
| Lighthouse CI accessibility scoring per PR | ✅ Done |
| Full manual audit with assistive technology | 📋 Planned |

---

## 8. Progressive Web App (PWA) & Offline Support

**Goal:** let the app load and show cached stream data with no network connection.

| Item | Status |
|------|--------|
| Service worker registration | ✅ Done |
| Install prompt component | ✅ Done |
| Offline dashboard from localStorage cache (`lib/streams-cache.ts`) | ✅ Done |
| Online/page-visibility-aware polling (pause when offline or tab hidden) | ✅ Done |
| Background sync when connectivity is restored | 📋 Planned |
| Push notifications via Web Push API | 💡 Speculative |

---

## 9. Webhooks & Integrations

**Goal:** let power users wire FlowStar events into their own systems.

| Item | Status |
|------|--------|
| Client-side webhook delivery for all stream lifecycle events | ✅ Done |
| Webhook delivery history and manual retry | ✅ Done |
| Webhook settings UI | ✅ Done |
| Server-side webhook relay (guaranteed delivery, no browser dependency) | 💡 Speculative |
| Zapier / Make (Integromat) connector | 💡 Speculative |

---

## 10. Token Ecosystem

**Goal:** broaden the set of tokens the app handles seamlessly.

| Item | Status |
|------|--------|
| 10 built-in tokens (XLM, USDC, EURC, AQUA, SRT, …) | ✅ Done |
| Custom token discovery by contract address | ✅ Done |
| Live USD price feeds for portfolio value | ✅ Done |
| Automatic token metadata caching | ✅ Done |
| DEX integration for streaming any listed Stellar asset | 💡 Speculative |

---

## 11. Contract Upgrades & Governance

**Goal:** keep the contract secure, upgradeable, and well-governed as the protocol matures.

| Item | Status |
|------|--------|
| `upgrade()` + `migrate()` pattern for in-place contract evolution | ✅ Done |
| `pause()` / `unpause()` admin safety valve | ✅ Done |
| `CONTRACT_VERSION` constant + CHANGELOG tracking | ✅ Done |
| 44 passing contract unit + security tests | ✅ Done |
| Third-party security audit | 📋 Planned |
| Time-locked admin / multi-sig governance | 💡 Speculative |

---

## 12. Developer Experience

**Goal:** make contributing and integrating as frictionless as possible.

| Item | Status |
|------|--------|
| 7 Architecture Decision Records (ADRs) | ✅ Done |
| Full API reference, integration guide, and CLI examples | ✅ Done |
| FAQ for contributors | ✅ Done |
| Mock mode (no wallet / no contract required to run locally) | ✅ Done |
| Storybook for UI components | ✅ Done |
| Vitest unit suite with coverage thresholds | ✅ Done |
| Playwright e2e suite in CI | ✅ Done |
| Husky + lint-staged pre-commit hooks | ✅ Done |
| Security scanning in CI (`check-secrets`, `soroban-security-check`) | ✅ Done |
| SDK / npm package for contract interaction | 💡 Speculative |

---

## Guiding Principles

These inform how roadmap items are prioritised and designed:

1. **Non-custodial first.** The contract holds funds; FlowStar never touches private keys.
   Any feature that would require a backend to sign transactions (e.g. autonomous
   recurring renewal) must be opt-in and transparent.

2. **Testnet parity before Mainnet.** A feature should be stable and well-tested on
   Testnet before it ships to Mainnet.

3. **Contract upgrades are load-bearing.** Any change that touches on-chain storage
   layout requires incrementing `CONTRACT_VERSION` and writing a `migrate()` path.
   See [ADR-001](./adr/ADR-001-persistent-storage.md).

4. **UI correctness > speed.** Withdrawable amounts always come from `get_withdrawable`
   on-chain; the client-side unlock counter is a visual approximation only.
   See [ADR-002](./adr/ADR-002-client-side-unlock-calculation.md).

5. **Accessibility is not optional.** Every new interactive surface must meet WCAG 2.1 AA
   and pass axe-core assertions before merging.

---

*Last updated: September 2026. To propose changes to this document, open an issue or PR.*
