# Issue #508 — Add unit tests for `components/ui/accessible-countdown-timer.tsx`

## Status: not reproducible on `main`

`components/ui/accessible-countdown-timer.tsx` does not exist on `main`, so
there is nothing to test yet.

## Where the file actually exists

It's introduced by the unmerged branch `origin/fix/csv-cliff-duration`
(commit `d295247`, "changes", 2026-06-29) alongside
`components/ui/accessible-unlock-amount.tsx` and other additions. That
branch is not an ancestor of `main`.

## Recommended action

Hold this until `fix/csv-cliff-duration` merges into `main`, then write
unit tests against the merged component covering:

- The rendered time-remaining text (e.g. "2d 4h 13m" style output).
- The ARIA live-region attributes (`aria-live`, `role`, etc.) that make the
  countdown accessible to screen readers.

Follow the same Vitest + React Testing Library setup added for
[#507](../components/streams/dashboard-stats.test.tsx) (`vitest.config.mts`,
`vitest.setup.ts`) rather than introducing a second test framework.
