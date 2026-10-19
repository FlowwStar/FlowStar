# Issue #494 — Remove the dead `CountdownTimer` import

## Status: not reproducible on `main`

The issue describes `CountdownTimer` being imported but never rendered in
`components/streams/stream-card.tsx` and `app/app/stream/[id]/page.tsx`,
with `AccessibleCountdownTimer` used in its place. That is not the current
state of `main`:

- Both files import `CountdownTimer` from `components/ui/countdown-timer`
  **and render it** — `<CountdownTimer target={...} />` appears in both.
- `AccessibleCountdownTimer` and `components/ui/accessible-countdown-timer.tsx`
  do not exist on `main` at all.

## Where the issue's description actually matches

The unmerged branch `origin/fix/csv-cliff-duration` (commit `d295247`,
"changes", 2026-06-29) adds `components/ui/accessible-countdown-timer.tsx`
and swaps the JSX usage in both files over to `AccessibleCountdownTimer`,
but leaves the old `CountdownTimer` import behind — that's the dead import
the issue is describing. That branch is not an ancestor of `main`.

## Recommended action

Hold this cleanup until `fix/csv-cliff-duration` merges into `main`, then
remove the dead `CountdownTimer` import there (and delete
`components/ui/countdown-timer.tsx` if it ends up with no remaining
usages app-wide). Doing it against `main` today would be a no-op change,
since the import is still live here.
