# ADR-009: Hidden Streams / Blocked Senders — Frontend-Only (localStorage)

## Status

Accepted

## Context

Anyone can currently create a stream to any address without the recipient's
consent — there is no contract-level opt-in or allow-list for who may stream
funds to a given recipient (see issue #151). A practical consequence is
dashboard clutter and unwanted-sender annoyance: a recipient may want to
declutter their view of streams they don't care about, or stop seeing streams
from a specific sender, without waiting for a full on-chain consent/opt-in
mechanism to be designed and shipped.

Two options were considered (tracked as issue #151):

- **Option A (chosen)**: a purely client-side hide/block mechanism, stored in
  the browser's `localStorage`, with zero on-chain effect.
- **Option B (rejected for now)**: an on-chain opt-in/allow-list mechanism —
  e.g. a contract-level registry of blocked senders per recipient, enforced
  at stream-creation time so a blocked sender's `create_stream` call would
  actually fail.

## Decision

Implement Option A: `lib/hidden-streams.ts` maintains two sets — hidden
stream IDs and blocked sender addresses — persisted in `localStorage` under
`flowstar:hidden-streams` and `flowstar:blocked-senders`. This is purely a
display-layer filter:

- The stream (or sender's future streams) is **not** hidden or blocked
  on-chain — it still exists, and is still fully cancellable/withdrawable by
  anyone with a direct link or who queries the contract directly.
- The hide/block state lives **on this device only** — it does not sync
  across the recipient's other browsers/devices, and clearing browser data
  resets it.
- A same-tab pub/sub (`subscribeHiddenStreams`) keeps the UI reactive to
  changes made through this module without a page reload.

Option B (on-chain enforcement) was rejected *for now*, not permanently — it
requires contract changes, a migration path for existing streams, and a
design for how a sender could contest an incorrect/malicious block. That is
substantially more design and implementation work than the dashboard-clutter
problem currently needs solving.

## Consequences

**Easier:**
- Shippable immediately with no contract changes, audit, or migration.
- Recipients get a working declutter/block tool today.

**Harder / accepted limitations:**
- A "blocked" sender is not actually prevented from creating new streams to
  that recipient — blocking only hides those streams from *this recipient's
  dashboard on this device*. A sender determined to be seen (or a recipient
  checking from a different device) is unaffected.
- No cross-device sync: a recipient who hides a stream on their laptop will
  still see it on their phone until they hide it there too.
- `localStorage` is per-origin and can be cleared by the user or browser
  (private browsing, storage limits) at any time, silently resetting hidden/
  blocked state with no warning.
- If/when Option B (on-chain opt-in) is built, this module's state does not
  automatically migrate — it would need an explicit decision on whether
  existing local hide/block lists inform the initial on-chain allow-list.

Revisit this ADR if user reports of unwanted streams grow enough to justify
the on-chain design work for Option B.
