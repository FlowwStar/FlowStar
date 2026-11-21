# ADR-008: Delegate Withdrawal Authorization

## Status

Accepted — with open questions (see below)

## Context

A stream recipient sometimes wants someone else to trigger withdrawals for them: an ops wallet pulling payroll on behalf of a cold-storage recipient, or a bot or contract that sweeps unlocked funds on a schedule. The recipient should not have to hand over their account's keys to make that happen.

The contract answers this with a per-stream **delegate**:

- `set_delegate(stream_id, delegate)` stores `DataKey::Delegate(stream_id)` in persistent storage
- `remove_delegate(stream_id)` deletes it
- `get_delegate(stream_id)` reads it

The first version of this feature shipped without working. `withdraw()` always called `stream.recipient.require_auth()` and never read `DataKey::Delegate`, so a registered delegate had no real authority. The bug went unnoticed because the whole contract test suite runs under `env.mock_all_auths()`, which approves every `require_auth()` call no matter who signed. `test_delegate_can_withdraw` passed even though no real delegate could have signed a withdrawal on testnet or mainnet. This was reported twice, as [#218](https://github.com/FlowwStar/FlowStar/issues/218) and [#265](https://github.com/FlowwStar/FlowStar/issues/265).

Both issues are now closed, and `withdraw()` checks the delegate. The intended authorization model was never written down, though, and the two reports proposed different fixes. #218 said the delegate should authorize "instead of (or in addition to)" the recipient. #265 said "either the recipient or their registered delegate". This ADR records the model as it is implemented today, the reasons for it, and the questions that are still open.

Options considered for who may authorize a withdrawal while a delegate is set:

1. **Exclusive delegate.** The delegate authorizes and the recipient cannot.
2. **Either party.** The recipient or the delegate can authorize.
3. **Both parties.** The recipient and the delegate must both authorize.

## Decision

**A delegate is a withdraw-only signer that one stream's recipient appoints. While it is set, it is the only address that can authorize `withdraw`. Funds still go to the recipient.**

What a delegate **can** do:

- Authorize `withdraw(stream_id, amount)` on that one stream, for any amount up to `get_withdrawable`.

What a delegate **cannot** do:

- Choose where funds go. `withdraw()` always transfers to `stream.recipient`, so a delegate can control *when* funds are withdrawn but never *where they go*.
- Act on any other stream. Delegation is set per `stream_id`, not per recipient address.
- Call `transfer_stream`, `set_delegate`, `remove_delegate`, `cleanup_stream`, or any function reserved for the sender or admin.

Rules for the recipient:

- Only the recipient can call `set_delegate` and `remove_delegate`. The sender has no say over delegation.
- Only one delegate exists per stream. Calling `set_delegate` again replaces the previous one.
- **While a delegate is set, the recipient cannot withdraw directly.** `withdraw()` calls `require_auth()` on the delegate *instead of* the recipient (`contracts/streaming/src/lib.rs`, `withdraw`). To withdraw directly again, the recipient calls `remove_delegate`, which needs only the recipient's own authorization, so the recipient can always take back control.
- The recipient keeps every other right over the stream, including `transfer_stream` and `cleanup_stream`.

When the delegate is cleared:

- `remove_delegate` deletes it.
- `transfer_stream` deletes it, because a delegate the old recipient appointed must not carry over to a new recipient.
- `cleanup_stream` deletes it along with the rest of the stream's storage.

Like all other writes, `set_delegate` and `remove_delegate` are blocked while the contract is paused.

**Why exclusive instead of either party:** In Soroban, `require_auth()` is called on one specific `Address`. A contract cannot express "either A or B signed" unless the caller says who they are, which would mean adding a `caller: Address` parameter to `withdraw()` and breaking its public interface for every existing integrator. The exclusive model keeps `withdraw(stream_id, amount)` unchanged and keeps one clear signer per call. Because funds always go to the recipient, a compromised or misbehaving delegate can do little damage: it can withdraw earlier or later than wanted, but it cannot redirect funds, and the recipient can revoke it at any time.

**Why not both parties:** Requiring both signatures would defeat the purpose of the feature, which is to let withdrawals happen without the recipient's key.

## Consequences

- **Easier:** Integrators can automate withdrawals without holding the recipient's key, and `withdraw()` keeps the same signature it had before delegation existed.
- **Easier:** The damage a delegate can do is limited to the timing of withdrawals. No path lets a delegate move funds anywhere except the recipient.
- **Harder:** A recipient who sets a delegate and then tries to withdraw from their own wallet gets an auth failure. Nothing in the error says a delegate is the cause. Frontends and integrators must call `get_delegate` first and explain the lockout. The frontend has no delegate UI yet.
- **Harder:** Tests under `mock_all_auths()` cannot tell which address authorized a call. Any change to authorization logic needs tests that use explicit `mock_auths` or assert on `env.auths()`. Otherwise the #218/#265 class of bug can come back silently.

## Open questions

These should be settled, and this ADR updated, before or along with further work on delegation.

1. **Exclusive or either party?** #265 asked for "either the recipient or their registered delegate". The implementation chose exclusive. If recipient lockout turns out to confuse users, the fix is option 2 plus a `caller` parameter on `withdraw()`, which is a breaking interface change.
2. **No real-auth test for delegation.** Every delegate test in `contracts/streaming/src/test.rs` (`test_delegate_can_withdraw`, `test_remove_delegate`, `test_transfer_clears_delegate`, …) still runs under `mock_all_auths()`. Those tests would pass even if `withdraw()` still required the recipient, which is exactly how #218/#265 went unnoticed. `test_security.rs` has explicit-auth tests for other functions but none for delegation. Tests are needed that prove: (a) the delegate can withdraw, (b) the recipient *cannot* withdraw while a delegate is set, and (c) an unrelated address cannot withdraw.
3. **The delegate entry's TTL is separate from the stream's.** `set_delegate` extends the `Delegate(stream_id)` TTL once, to about 30 days. `extend_stream_ttl` and `bump_stream` extend only `Stream(stream_id)`, so on a long stream the delegate entry can expire while the stream stays live. Two things need deciding: whether an expired delegate should mean "authority silently returns to the recipient" or "restore required", and whether `bump_stream` should also extend the `Delegate` (and `StreamMetadata`) entries.
4. **`transfer_stream` clears the delegate without a `DelegateRemovedEvent`.** An indexer that tracks delegate state from events will still show the old delegate after a transfer. Should `transfer_stream` publish `DelegateRemovedEvent`, or should indexers treat `StreamTransferEvent` as implicitly clearing the delegate?
5. **`set_delegate` does not validate its input.** It accepts `delegate == recipient`, which does nothing but costs storage. It also accepts cancelled streams, where `withdraw()` always fails. Should either case be rejected?
