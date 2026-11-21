# Webhooks

FlowStar can POST a JSON payload to a URL you register under **Settings → Webhooks** when a stream event occurs. This page documents the payload contract and how it is versioned.

> Deliveries are sent from the user's browser (`hooks/use-webhooks.ts`), not from a FlowStar server. Your endpoint must accept a cross-origin `POST` with `Content-Type: application/json`, which means answering the CORS preflight (`OPTIONS`) request.

## Payload

Every delivery is a `POST` with a JSON body of this shape:

```json
{
  "schema_version": 1,
  "event": "stream.created",
  "timestamp": "2026-09-24T12:00:00.000Z",
  "data": {
    "stream_id": 42
  }
}
```

| Field            | Type    | Description                                                                 |
| ---------------- | ------- | --------------------------------------------------------------------------- |
| `schema_version` | integer | Version of the payload shape. Currently `1`. See [Versioning](#versioning). |
| `event`          | string  | Event type, e.g. `stream.created`. See [Event types](#event-types).         |
| `timestamp`      | string  | ISO 8601 UTC time the payload was built.                                    |
| `data`           | object  | Event-specific fields. Always includes `stream_id`.                         |

The **Send test** action on a registered webhook delivers a `stream.created` payload with `data: { "stream_id": 0, "note": "FlowStar webhook test" }`.

## Verifying deliveries

Every delivery includes an `X-FlowStar-Signature` header so your endpoint can
confirm it genuinely came from this browser's FlowStar instance and the body
wasn't tampered with in transit:

```
X-FlowStar-Signature: sha256=<hex-encoded HMAC-SHA256>
```

The signature is an HMAC-SHA256 of the **raw request body bytes** (the exact
JSON string sent, before any re-parsing), keyed by the secret generated for
that webhook at registration time (shown once in **Settings → Webhooks** when
you add the webhook — store it, it is not retrievable afterward from the UI).

To verify (Node.js example):

```js
const crypto = require('node:crypto')

function verifyFlowStarSignature(rawBody, signatureHeader, secret) {
  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex')
  return crypto.timingSafeEqual(Buffer.from(signatureHeader), Buffer.from(expected))
}
```

Important:

- Verify against the **raw body bytes**, not `JSON.stringify(JSON.parse(rawBody))` — re-serializing can change key order or whitespace and produce a different signature than what was actually sent.
- Compare in constant time (`crypto.timingSafeEqual` or equivalent) rather than `===`, to avoid a timing side-channel.
- Each webhook has its own independently generated secret — a signature computed with one webhook's secret will not validate against another's.
- There is no request replay protection (no nonce/timestamp-window check) beyond the `timestamp` field in the payload itself — if replay protection matters for your integration, reject deliveries whose `timestamp` is older than a window you choose.

## Event types

| Event                | Meaning                            |
| -------------------- | ---------------------------------- |
| `stream.created`     | A stream was created               |
| `stream.withdrawal`  | Funds were withdrawn from a stream |
| `stream.cancelled`   | A stream was cancelled             |
| `stream.completed`   | A stream reached its end time      |
| `stream.topped_up`   | Funds were added to a stream       |
| `stream.transferred` | Recipient rights were transferred  |

## Delivery and retries

- A `2xx` response counts as success.
- A non-`2xx` response or a network error is retried up to 3 attempts in total, with exponential backoff (1s, then 2s).
- Test deliveries are attempted once, with no retries.
- The last 50 delivery results are shown in Settings.

## Versioning

`schema_version` lets you detect a change to the payload shape before it breaks your integration.

**What bumps the version.** `schema_version` is incremented (1 → 2 → …) only for **breaking** changes to the payload shape, such as:

- removing or renaming a field, at the top level or inside `data`
- changing a field's type or meaning (e.g. `timestamp` from an ISO string to a Unix number)
- changing the meaning of an existing `event` value

**What does not bump the version.** These additive changes can ship at any time under the current version:

- adding a new top-level field or a new field inside `data`
- adding a new `event` type

**How to consume payloads safely:**

1. Read `schema_version` first. If it is higher than the version you were built against, log the delivery and skip it (or alert) instead of parsing fields that may have changed.
2. Ignore fields you don't recognize. New fields are added without a version bump.
3. Ignore, don't reject, `event` values you don't recognize.
4. Treat a payload with no `schema_version` as version `0`: a delivery sent before versioning was introduced. It is otherwise identical to version `1`.

Any version bump will be listed in the changelog below, along with what changed.

### Changelog

| Version | Changes                                                                    |
| ------- | -------------------------------------------------------------------------- |
| 1       | Initial versioned payload: `schema_version`, `event`, `timestamp`, `data`. |
