# Issue #147 — Implementation Guide: Frontend Rate Limiting

This guide is the companion to
[`issue-147-frontend-rate-limiting.md`](./issue-147-frontend-rate-limiting.md).
It covers every concrete change needed, file by file, with annotated code
snippets.

---

## 1. New file: `hooks/use-creation-rate-limit.ts`

Create this hook from scratch. It owns the post-success cooldown, the
rolling session quota, and the deduplication guard.

```ts
// hooks/use-creation-rate-limit.ts
"use client";

import { useState, useCallback, useEffect, useRef } from "react";

// ─── Constants (exported so tests can override) ────────────────────────────────
export const COOLDOWN_MS = 4_000;          // 4 s post-success lock
export const QUOTA_THRESHOLD = 10;         // warn after N creations…
export const QUOTA_WINDOW_MS = 300_000;    // …within this rolling window (5 min)

const STORAGE_KEY_PREFIX = "flowstar_creation_log_";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function storageKey(walletAddress: string): string {
  return `${STORAGE_KEY_PREFIX}${walletAddress}`;
}

/** Load and prune timestamps older than QUOTA_WINDOW_MS from localStorage. */
function loadTimestamps(walletAddress: string): number[] {
  try {
    const raw = localStorage.getItem(storageKey(walletAddress));
    if (!raw) return [];
    const all: number[] = JSON.parse(raw);
    const cutoff = Date.now() - QUOTA_WINDOW_MS;
    return all.filter((t) => t > cutoff);
  } catch {
    return [];
  }
}

function saveTimestamps(walletAddress: string, timestamps: number[]): void {
  try {
    localStorage.setItem(storageKey(walletAddress), JSON.stringify(timestamps));
  } catch {
    // Storage quota exceeded — degrade gracefully; quota warning stays off
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export interface CreationRateLimitState {
  /** True for COOLDOWN_MS after each successful creation. */
  cooldownActive: boolean;
  /** Number of streams created in the current quota window. */
  sessionCount: number;
  /** True when sessionCount >= QUOTA_THRESHOLD. Advisory — does not block. */
  quotaWarning: boolean;
  /**
   * Call after every successful creation. Pass `count = n` for batch paths
   * (default: 1).
   */
  record: (count?: number) => void;
  /** Reset all state — call on wallet disconnect or sign-out. */
  reset: () => void;
}

export function useCreationRateLimit(
  walletAddress: string | undefined
): CreationRateLimitState {
  const [cooldownActive, setCooldownActive] = useState(false);
  const [sessionCount, setSessionCount] = useState<number>(() => {
    if (!walletAddress) return 0;
    return loadTimestamps(walletAddress).length;
  });

  const cooldownTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep sessionCount in sync with the persisted log on wallet change
  useEffect(() => {
    if (!walletAddress) {
      setSessionCount(0);
      return;
    }
    setSessionCount(loadTimestamps(walletAddress).length);
  }, [walletAddress]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (cooldownTimer.current) clearTimeout(cooldownTimer.current);
    };
  }, []);

  const record = useCallback(
    (count = 1) => {
      // 1. Start cooldown
      if (cooldownTimer.current) clearTimeout(cooldownTimer.current);
      setCooldownActive(true);
      cooldownTimer.current = setTimeout(() => {
        setCooldownActive(false);
      }, COOLDOWN_MS);

      // 2. Persist timestamps and update session count
      if (!walletAddress) return;
      const now = Date.now();
      const existing = loadTimestamps(walletAddress);
      const updated = [...existing, ...Array(count).fill(now)];
      saveTimestamps(walletAddress, updated);
      setSessionCount(updated.length);
    },
    [walletAddress]
  );

  const reset = useCallback(() => {
    if (cooldownTimer.current) clearTimeout(cooldownTimer.current);
    setCooldownActive(false);
    setSessionCount(0);
    if (walletAddress) {
      try {
        localStorage.removeItem(storageKey(walletAddress));
      } catch {
        // ignore
      }
    }
  }, [walletAddress]);

  return {
    cooldownActive,
    sessionCount,
    quotaWarning: sessionCount >= QUOTA_THRESHOLD,
    record,
    reset,
  };
}
```

---

## 2. `app/app/create/create-form.tsx`

Three targeted changes: import the hook, wire the button, and add the quota
banner.

### 2a. Add the import

```ts
// After the existing hooks imports, e.g. after useFormDraft
import { useCreationRateLimit } from "@/hooks/use-creation-rate-limit";
```

### 2b. Instantiate the hook inside `CreateForm`

Add this near the top of the component, alongside the existing
`useContract()` and `useWallet()` calls:

```ts
const { cooldownActive, quotaWarning, record } = useCreationRateLimit(walletAddress ?? undefined);
```

### 2c. Add a deduplication guard to `handleConfirmedCreate`

The existing function has no guard against a second call racing in before
`pending` flips to `true`. Wrap it with a ref:

```ts
// At component scope, alongside isFirstMount:
const submittingRef = useRef(false);

// Replace handleConfirmedCreate:
async function handleConfirmedCreate() {
  if (submittingRef.current) return;   // deduplicate rapid double-clicks
  submittingRef.current = true;
  try {
    const input = buildInput();
    const id = await createStream(input);
    record();                           // ← start cooldown + increment quota

    touchAddressBookEntry(input.recipient, input.recipient);
    setAddressBookEntries(getAddressBookEntries());

    if (recurrenceCadence !== "none") {
      saveRecurringRule({
        cadence: recurrenceCadence,
        nextRunAt: buildNextRunAt(Date.now(), recurrenceCadence),
        lastCreatedAt: Date.now(),
        streamId: id,
        recipient: input.recipient,
        tokenSymbol: input.token.symbol,
        amount: input.totalAmount.toString(),
      });
    }

    discard();
    setShowConfirmation(false);
    toast.success(copy.toasts.streamCreatedTitle, {
      description: copy.toasts.streamCreatedDescription(id),
    });
    router.push(`/app/stream/${id}`);
  } catch {
    // error is exposed via useContract
  } finally {
    submittingRef.current = false;
  }
}
```

### 2d. Disable the "Create Stream" submit button during cooldown

Find the `<Button type="submit" ...>` in the JSX and expand its `disabled`
prop:

```tsx
// Before:
<Button type="submit" disabled={pending}>
  {copy.createButton}
</Button>

// After:
<Button type="submit" disabled={pending || cooldownActive}>
  {pending
    ? copy.createButtonPending          // "Creating…" or similar
    : cooldownActive
      ? copy.createButtonCooldown       // "Please wait…"
      : copy.createButton}              // "Create Stream"
</Button>
```

Add `createButtonCooldown` to `lib/copy/create-form.ts` (the existing copy
module) alongside the existing keys.

### 2e. Add the quota warning banner

Place this block directly below the draft-restore banner (the amber
`showDraftBanner` block). The quota warning is always rendered when
`quotaWarning` is true, independent of the draft banner:

```tsx
{quotaWarning && (
  <div
    role="alert"
    className="mt-4 flex items-start gap-2.5 rounded-xl border border-orange-500/40 bg-orange-500/10 px-4 py-3"
  >
    <AlertTriangle className="size-4 shrink-0 text-orange-600 dark:text-orange-400 mt-0.5" />
    <p className="text-sm text-orange-700 dark:text-orange-300">
      {copy.quotaWarningText}  {/* e.g. "You've created 10+ streams in the past 5 minutes." */}
    </p>
  </div>
)}
```

`AlertTriangle` is already imported in `create-form.tsx` for the unfunded
account warning, so no new import is needed.

---

## 3. `app/app/create/batch/page.tsx`

Three changes: import the hook, add the confirmation dialog, wire `record`.

### 3a. Add imports

```ts
import { useCreationRateLimit } from "@/hooks/use-creation-rate-limit";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useWallet } from "@/hooks/use-wallet";
```

`AlertDialog` components already exist in `components/ui/` (check
`components.json` to confirm the exact export path). `useWallet` is already
used elsewhere in the app at the same import path.

### 3b. Read the batch confirmation threshold

Place this constant at module scope, above the component:

```ts
const BATCH_CONFIRM_THRESHOLD = (() => {
  const env = process.env.NEXT_PUBLIC_BATCH_CONFIRM_THRESHOLD;
  const parsed = env ? parseInt(env, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 20;
})();
```

### 3c. Instantiate the hook and confirmation state

Inside `BatchCreatePage`, alongside the existing `useContract()` call:

```ts
const { address: walletAddress } = useWallet();
const { cooldownActive, quotaWarning, record } = useCreationRateLimit(walletAddress ?? undefined);
const [showBatchConfirm, setShowBatchConfirm] = useState(false);
```

### 3d. Split `handleExecute` into a guarded entry and the actual executor

```ts
// Entry point — triggered by the "Execute" button
function handleExecuteClick() {
  if (validRows.length > BATCH_CONFIRM_THRESHOLD) {
    setShowBatchConfirm(true);   // show confirmation dialog
  } else {
    void handleExecute();
  }
}

// Actual executor — called after confirmation (or directly if below threshold)
const handleExecute = useCallback(async () => {
  setShowBatchConfirm(false);
  setExecuting(true);
  setExecutionErrors([]);
  setCompletedCount(0);
  setQueuedCount(validRows.length);
  setLiveStatus(`Creating ${validRows.length} stream${validRows.length === 1 ? "" : "s"}…`);

  try {
    await createStreamsBatch(
      validRows.map((row) => ({
        recipient: row.recipient,
        token: selectedTokenInfo,
        totalAmount: parseDecimalAmount(row.amount, selectedTokenInfo.decimals)!,
        startTime: row.startTime!,
        endTime: row.endTime!,
        cliffTime: row.cliffTime ?? row.startTime!,
        cliffAmount: row.cliffAmount ?? 0n,
      }))
    );
    record(validRows.length);    // ← cooldown + quota increment
    setCompletedCount(validRows.length);
    setLiveStatus(`${validRows.length} of ${validRows.length} streams created successfully.`);
    toast.success("Batch create completed", {
      description: `${validRows.length} streams created successfully.`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Transaction failed";
    setExecutionErrors([message]);
    setLiveStatus(`Batch failed: ${message}`);
    toast.error("Batch create failed.");
  }

  setExecuting(false);
}, [createStreamsBatch, record, selectedTokenInfo, validRows]);
```

### 3e. Update the "Execute" button and add the dialog

```tsx
{/* Button: was disabled={pending || executing || validRows.length === 0} */}
<Button
  onClick={handleExecuteClick}
  disabled={pending || executing || cooldownActive || validRows.length === 0}
>
  {cooldownActive ? "Please wait…" : `Execute (${validRows.length})`}
</Button>

{/* Quota warning — same pattern as single-stream form */}
{quotaWarning && (
  <div
    role="alert"
    className="mt-3 flex items-start gap-2.5 rounded-xl border border-orange-500/40 bg-orange-500/10 px-4 py-3"
  >
    <AlertTriangle className="size-4 shrink-0 text-orange-600 dark:text-orange-400 mt-0.5" />
    <p className="text-sm text-orange-700 dark:text-orange-300">
      High creation volume detected. Slow down to avoid RPC throttling.
    </p>
  </div>
)}

{/* Batch confirmation dialog */}
<AlertDialog open={showBatchConfirm} onOpenChange={setShowBatchConfirm}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>
        Create {validRows.length} streams?
      </AlertDialogTitle>
      <AlertDialogDescription>
        You are about to submit {validRows.length} streams in a single
        transaction. This will require two wallet signatures (one token
        approval, one batch creation). This action cannot be undone.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction onClick={() => void handleExecute()}>
        Confirm & sign
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

---

## 4. `hooks/use-batch-create.ts` — cleanup

The `DEFAULT_BATCH_DELAY = 2000` constant and `batchDelay` option in this
hook were designed for a now-removed per-stream loop. With
`useCreationRateLimit` owning the post-success cooldown, the constant is
redundant. Remove it:

```ts
// Delete this line:
const DEFAULT_BATCH_DELAY = 2000 // 2 seconds between streams to avoid rate limiting

// Remove batchDelay from the options destructuring in createBatch and retryFailed:
// Before:
const { batchDelay = DEFAULT_BATCH_DELAY, onProgress } = options ?? {}
// After:
const { onProgress } = options ?? {}
```

Also remove `batchDelay` from the `options` parameter types in both
`createBatch` and `retryFailed`.

---

## 5. Copy strings — `lib/copy/create-form.ts`

Add the two new strings alongside existing keys. The exact shape depends on
how the existing copy object is typed; add entries wherever the other button
labels live:

```ts
// Inside the existing copy object / namespace:
createButtonCooldown: "Please wait…",
quotaWarningText: `You've created ${QUOTA_THRESHOLD}+ streams in the past 5 minutes. Slow down to avoid RPC throttling.`,
```

Import `QUOTA_THRESHOLD` from `hooks/use-creation-rate-limit` to keep the
number in sync with the hook constant rather than hardcoding it.

---

## 6. Environment variable — `.env.local.example`

Document the new optional variable:

```dotenv
# Batch creation confirmation threshold (default: 20).
# Show a confirmation dialog when a batch exceeds this many rows.
NEXT_PUBLIC_BATCH_CONFIRM_THRESHOLD=20
```

---

## 7. `lib/contract.ts` — AbortController wiring (optional, low priority)

The `fetchWithRetry` helper already accepts a `RequestInit`, which includes
a `signal` field. Pass an `AbortController` signal from the call site only
if the component unmounts mid-transaction (useful for batch on slow RPC
networks). This is low priority because the Stellar polling loop already has
a 60-second hard timeout (`POLL_TIMEOUT_MS`).

If implemented, the pattern is:

```ts
// In useContract.run(), pass an AbortController down to createStreamCall:
const controller = new AbortController();
// Store controller in a ref on the component; call controller.abort() in
// the useEffect cleanup if the component unmounts.
```

No changes to `lib/contract.ts` are required for the core acceptance
criteria.

---

## Integration checklist

| # | Criterion | Where satisfied |
|---|---|---|
| 1 | Button disabled while in-flight | `pending` flag — already done |
| 2 | Button disabled 3–5 s after success | `cooldownActive` in `useCreationRateLimit` |
| 3 | Warning after 10 streams / 5 min | `quotaWarning` + banner in form + batch page |
| 4 | Batch confirmation dialog > 20 rows | `BATCH_CONFIRM_THRESHOLD` + `AlertDialog` |
| 5 | No duplicate transactions from rapid clicks | `submittingRef` guard in `handleConfirmedCreate`; `disabled` on confirm button |

---

## Gotchas

**`localStorage` not available during SSR.** Both the hook and the
`loadTimestamps` helper run only in `"use client"` components, so SSR is not
a concern. The `try/catch` around every `localStorage` call handles
private-browsing environments where storage is blocked.

**`record()` must be called after `await createStream()` resolves, not
before.** Calling it optimistically (before the transaction confirms) would
start the cooldown even if the wallet rejects the signature, which is
confusing UX.

**The quota warning does not block.** This is intentional — see the
non-goals section in the design doc. If a hard block is needed in the future,
`cooldownActive` can be returned alongside a new `quotaBlocked` boolean and
handled at the call site.

**`record(count)` on batch.** Pass the actual number of rows, not `1`, so
the session quota reflects the true number of on-chain streams created, not
the number of transactions.
