# Architecture Decision Records

This directory captures the significant technical decisions made in FlowStar — what was decided, why, and what the trade-offs are. Use these records to understand the reasoning behind the current design before changing it.

## Index

| ADR | Title | Status |
|---|---|---|
| [ADR-000](./ADR-000-template.md) | ADR Template | Template |
| [ADR-001](./ADR-001-persistent-storage.md) | Persistent vs Instance Storage for Streams | Accepted |
| [ADR-002](./ADR-002-client-side-unlock-calculation.md) | Client-Side Unlock Calculation | Accepted |
| [ADR-003](./ADR-003-mock-mode.md) | Mock Mode for Development | Accepted |
| [ADR-004](./ADR-004-polling-vs-websocket.md) | Polling vs WebSocket for Updates | Accepted |
| [ADR-005](./ADR-005-bigint-token-amounts.md) | BigInt for Token Amounts | Accepted |
| [ADR-006](./ADR-006-freighter-wallet-strategy.md) | Freighter-Only Wallet Strategy | Accepted |
| [ADR-007](./ADR-007-integer-division-dust.md) | Integer Division Dust Handling | Accepted |

## How to add a new ADR

1. Copy `ADR-000-template.md` to `ADR-NNN-short-title.md`
2. Fill in all sections
3. Add a row to the index above
4. Link the ADR from the relevant code or PR for context

## Statuses

- **Proposed** — under discussion, not yet decided
- **Accepted** — the current approach
- **Superseded by ADR-NNN** — replaced by a later decision
- **Deprecated** — no longer relevant
