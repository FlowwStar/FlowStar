# ADR-011: Notification Polling, Dedup, and Per-Wallet Scoping

## Status

Accepted

## Context

The notification bell (`components/layout/notification-bell.tsx`) tells a connected user when something happens to _their_ streams: a stream they receive was created or cancelled, or someone withdrew from a stream they sent. The data behind it comes from `hooks/use-notifications.ts`.

The constraints are the same as in [ADR-004](./ADR-004-polling-vs-websocket.md): FlowStar is client-only, and there is no server to push events or keep per-user state. The only event source is Soroban RPC's `getEvents`, which has three properties that shape the design:

- **It is shared.** The streaming contract emits one event stream for every user. Filtering by `contractIds` returns everyone's activity, not just the connected wallet's.
- **It is cursor-based.** Events are requested from a `startLedger` onward, and the response reports the network's `latestLedger`.
- **It is retention-limited.** RPC nodes prune old events (commonly after about 24 hours). Asking for a `startLedger` older than the node's oldest retained ledger returns an error, not an empty result.

This design was never written down, and two correctness bugs were filed against it: #228/#279 (users saw other wallets' activity) and #229/#280 (polling stuck forever after a retention error). This ADR records the intended behavior so that future changes, including the remaining gaps listed below, start from a shared understanding.

## Decision

### 1. Poll every 30 seconds while a wallet is connected

- `POLL_INTERVAL = 30_000` ms, matching the stream-list refresh rate in ADR-004. Notifications are not time-critical enough to justify extra RPC load.
- Polling runs only when a wallet address **and** a stream contract ID are present. In mock mode (no contract ID) the hook never polls, and the bell shows only what is already in storage.
- One poll runs immediately on mount, then every 30 seconds. The interval is cleared on unmount and restarted whenever the wallet, network, RPC URL, or contract ID changes.

### 2. Use a ledger cursor as the dedup mechanism

Deduplication is **cursor-based**, not ID-based:

- The last processed ledger is stored in `localStorage` under `flowstar:last-seen-ledger`.
- Each poll requests events from `lastSeenLedger + 1`. That start is exclusive, so an event from an already-processed ledger is never requested again.
- After a successful poll, the cursor advances to the response's `latestLedger`, and only if that is greater than the current cursor.
- **First run (cursor is `0`):** the cursor is set to `latestLedger - 1` and no events are processed. A fresh install starts "from now" and does not replay history into the bell.
- **Retention error:** the cursor is reset to `oldestLedger - 1` (from `getHealth`), so the next poll resumes at the oldest retained ledger and accepts a gap in history. If `getHealth` also fails, the cursor falls back to `latestLedger - 1`. If every call fails, the cursor stays unchanged and the next poll retries. The design must **never** leave the cursor where every future poll fails the same way (#229/#280).

Notification IDs (`${Date.now()}-${random}`) exist only for React keys and dismissal. They are **not** a dedup key.

### 3. Scope events to the connected wallet

The contract's event stream is shared, so every event must be checked against the connected wallet before it becomes a notification (#228/#279):

- Stream IDs are decoded from the event payload (`value`), because the contract declares no `#[topic]` fields.
- When a poll returns events, the hook calls `fetchStreamsForAddress(network, address)` once and builds two sets: stream IDs the wallet **sent** and stream IDs it **received**. The call happens only when there are events to scope, so empty polls cost no extra RPC calls.
- An event becomes a notification only if it matches both a type and a role:

  | Contract event       | Notify when the wallet is the… | Notification                  |
  | -------------------- | ------------------------------ | ----------------------------- |
  | `StreamCreatedEvent` | recipient                      | "New stream received"         |
  | `CancelEvent`        | recipient                      | "Stream cancelled"            |
  | `WithdrawEvent`      | sender                         | "Withdrawal from your stream" |

  Everything else is dropped, including events for streams the wallet isn't part of, events without a decodable `stream_id`, and actions the user took themselves (a sender isn't told about a stream they created).

### 4. Persist notifications locally, capped at 50

- Notifications are stored under `flowstar:notifications`, newest first, capped at 50.
- Opening the bell marks **all** notifications read. Items can be dismissed one at a time, or all at once with "Clear all". There is no per-item "mark as read".
- A browser `Notification` is shown as well when the user has granted permission. Permission is requested once polling starts.

## Consequences

- **Easier:** No backend is needed. The ledger cursor makes dedup O(1) in storage, with no growing set of seen event IDs. Wallet scoping reuses the same contract queries the dashboard uses.
- **Harder:** Notifications arrive up to 30 seconds late. Each poll that returns events costs two extra contract queries (`get_sent_streams` and `get_received_streams`) to scope them.
- **Accepted trade-offs:** Events that happen while the app is closed for longer than the RPC retention window are silently lost. First-time users never see events from before their first poll.

### Known gaps (not yet addressed)

Whoever changes this hook next should know about these gaps. Each one breaks an assumption above.

- **Storage is not scoped per wallet or per network.** `flowstar:notifications` and `flowstar:last-seen-ledger` are global keys. After a wallet switch on the same browser, the new wallet sees the previous wallet's notification list, which is the display-side remainder of #228. Ledger sequences also differ between testnet and mainnet, so a cursor written on one network is wrong on the other. The intended fix is to key both by network and wallet address, e.g. `flowstar:notifications:<network>:<address>`.
- **Pagination is capped at 100 events.** `getEvents` is called with `limit: 100`, but the cursor jumps to `latestLedger`. If more than 100 contract events land between two polls, the rest are skipped. The fix is to page with the RPC `cursor` until exhausted, or to advance only to the ledger of the last event returned.
- **Multiple tabs duplicate notifications.** Every open tab polls with the same stored cursor. Two tabs that poll before either writes the new cursor will both add the same events. Cursor-based dedup can't prevent this. The fix would be ID-based dedup keyed on the RPC's per-event `id`, or a single polling leader (e.g. through `BroadcastChannel` or the Web Locks API).
- **Event decoding assumes a specific RPC response shape.** `decodeEventTopic` substring-matches the raw `topic` strings, and `decodeEventStreamId` reads `value.xdr`. Current Soroban RPC returns topics and `value` as base64 XDR strings, so these decoders should be checked against a live RPC response. `hooks/use-stream-history.ts` makes the same assumptions.
- **Transferred streams.** Scoping uses the wallet's _current_ sent/received stream lists. After `transfer_stream`, the previous recipient stops getting notifications for that stream, and the new recipient starts. That is probably correct, but it was never an explicit decision.

## Related

- [ADR-004: Polling vs WebSocket for Updates](./ADR-004-polling-vs-websocket.md)
- #228 / #279: per-wallet scoping
- #229 / #280: stuck polling after a retention error
- `hooks/use-notifications.ts`, `components/layout/notification-bell.tsx`
