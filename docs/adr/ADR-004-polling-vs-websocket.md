# ADR-004: Polling vs WebSocket for Updates

## Status

Accepted

## Context

The dashboard needs to reflect stream state changes (new streams, withdrawals, cancellations) without requiring a manual page refresh. Two approaches were considered:

1. **WebSocket / server-sent events** — the server pushes updates to the client in real time.
2. **Adaptive polling** — the client periodically re-fetches stream data from the contract via RPC.

Stellar does not expose a WebSocket stream for contract state at the Soroban RPC level (as of the time this decision was made). Building a server-side event relay would require additional infrastructure (a persistent server process, a database to track stream IDs per user) that is out of scope for a client-side-only deployment on Vercel/Netlify.

## Decision

The app uses **adaptive polling**: stream lists refresh every 30 seconds, and stream detail pages refresh every 10 seconds. The interval tightens to 5 seconds immediately after a user action (create/withdraw/cancel) to surface the confirmation quickly, then backs off.

## Consequences

- **Easier:** No server infrastructure required. The app deploys as a static Next.js export. Polling logic lives entirely in `hooks/use-streams.ts`.
- **Harder:** Updates are not instantaneous — there is up to a 10–30 second lag before the UI reflects another user's action on the same stream (e.g., sender cancels while recipient is viewing the stream).
- **Risk:** Heavy polling from many simultaneous users could hit Soroban RPC rate limits. If this becomes an issue, the polling interval should be increased or a caching proxy introduced.
