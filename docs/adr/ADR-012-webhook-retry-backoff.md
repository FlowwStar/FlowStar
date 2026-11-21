# ADR-012: Webhook Delivery Retry, Backoff, and History Retention

## Status

Accepted

## Context

`hooks/use-webhooks.ts`'s `deliverWithRetry()` delivers webhook payloads
directly from the user's browser (there is no FlowStar server in the loop —
see [ADR-003](./ADR-003-mock-mode.md) and the frontend-only nature of this
app generally). A receiving endpoint can be temporarily unreachable (cold
start, deploy in progress, transient network blip), and a single failed
`fetch` shouldn't be treated the same as "this webhook is permanently broken."
At the same time, retrying from a browser tab has real constraints: the tab
might be closed mid-retry, and there's no background job queue to hand off
to, so retries must complete within the lifetime of the call that triggered
them.

## Decision

**Retry count and backoff**: up to 3 attempts total per delivery, with
exponential backoff between attempts — 1 second after the first failure,
2 seconds after the second. No jitter, and no attempt beyond the third.
Three was chosen as enough to absorb a brief blip (cold start, a few seconds
of downtime) without keeping the calling browser tab busy for an extended
period — this is a synchronous-to-the-caller retry loop, not a background
queue, so an unbounded or highly-backed-off retry count would visibly stall
the UI action that triggered the event.

**Test deliveries bypass retry**: `testWebhook` calls `deliverWithRetry` with
`retries = 1` — a user clicking "Send test" wants an immediate pass/fail
signal to debug their endpoint, not to wait through a multi-second backoff
sequence for a delivery they're actively watching.

**Delivery history retention (`MAX_HISTORY = 50`)**: only the 50 most recent
delivery results (across all webhooks) are kept in `localStorage`, trimmed on
every write (`saveHistory`'s `.slice(0, MAX_HISTORY)`). This is a UI debugging
aid (Settings shows "Recent deliveries"), not an audit log — 50 is enough to
see recent activity and diagnose a currently-failing webhook without
`localStorage` (which has an origin-wide size quota, typically 5-10MB)
growing unbounded as streams accumulate over the life of the app.

## Consequences

**Easier:**

- A transient failure (cold start, brief network blip) self-heals without
  any user action.
- Bounded worst-case latency per event (~3 seconds of backoff plus request
  time) keeps the triggering UI action responsive.
- Fixed history size means no unbounded `localStorage` growth to worry about.

**Harder / accepted limitations:**

- A webhook endpoint down for longer than ~3 seconds (the total backoff
  window) will simply fail that delivery — there is no later retry, since
  nothing persists the failure for a background retry attempt. Users must
  re-trigger the event or use "Send test" to confirm connectivity once their
  endpoint is back.
- If the browser tab is closed mid-retry, in-flight retries are abandoned —
  there's no service worker or server-side queue backing this.
- Only the most recent 50 deliveries are visible; older delivery history is
  silently dropped, not archived anywhere.
- These are magic numbers (`3`, `1000`, `2 ** attempt`, `50`) rather than
  named constants today — see issue #354 for extracting them into
  self-documenting constants (e.g. `MAX_DELIVERY_ATTEMPTS`,
  `RETRY_BASE_DELAY_MS`) alongside this ADR.

Revisit this ADR if webhook reliability complaints suggest 3 attempts /
~3 seconds total backoff is insufficient, or if a server-side delivery queue
is ever introduced (which would remove the "must complete within the calling
tab's lifetime" constraint entirely).
