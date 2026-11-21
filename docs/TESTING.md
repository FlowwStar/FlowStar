# Testing

This document covers FlowStar's test setup, how to run each suite, and — most
importantly — how Playwright visual snapshot baselines are managed.

---

## Test suites at a glance

| Suite | Runner | Command |
|---|---|---|
| Unit tests | Vitest | `npm test` |
| E2E / visual | Playwright | `npm run test:e2e` |
| Contract tests | Rust / `cargo test` | `cd contracts && cargo test` |

---

## Unit tests (Vitest)

```bash
npm test          # single run
npm run test:watch  # watch mode
```

Tests live in `lib/__tests__/` and cover unlock math, formatters, and utility
functions.
npm test            # single run
npm run test:watch  # watch mode
```

### Where tests live

All unit tests must be placed under `__tests__/` at the repo root, following
the naming convention `**/*.{test,spec}.{ts,tsx}`. Files placed elsewhere
(e.g. alongside source files under `components/` or `lib/`) are **not
collected by Vitest** and will never run.

```
__tests__/
  lib/
    unlock-math.test.ts
    formatters.test.ts
  hooks/
    use-stream.test.ts
```

### Runner: Vitest, not Jest

The project uses [Vitest](https://vitest.dev/). Use `vi` for all mocking and
spying — **not** `jest`:

```ts
import { describe, it, expect, vi } from "vitest";

// ✅ correct
const spy = vi.fn();
vi.spyOn(module, "method");
vi.useFakeTimers();

// ❌ wrong — jest is not installed
const spy = jest.fn();
```

### Running a single file

```bash
npx vitest run __tests__/lib/unlock-math.test.ts
```

---

## E2E tests (Playwright)

### Running locally

Start the dev server in one terminal, then run Playwright in another:

```bash
# Terminal 1
npm run dev

# Terminal 2
npm run test:e2e
```

Or build and serve in mock mode (no contract needed), which is what CI does:

```bash
npm run build   # no contract env vars needed — falls back to mock mode
npm run start &
npm run test:e2e
```

### Visual snapshot tests

Playwright uses pixel-diff screenshots to catch unintended UI regressions.
Baseline PNG files live in `e2e/__screenshots__/`. When a test runs, Playwright
compares the current screenshot against the committed baseline. If no baseline
exists, the test **fails** (it has nothing to compare against).

---

## Playwright visual baselines

### How baselines are generated

Baselines must be generated on **Linux in CI**, not on your local machine. This
is because Playwright renders fonts and anti-aliasing slightly differently
across operating systems. A baseline generated on Windows or macOS will produce
false-positive diff failures when CI runs on `ubuntu-latest`, causing tests to
fail for everyone else even when no real UI change was made.

**Do not commit snapshot PNGs generated on Windows or macOS.**

### When to regenerate baselines

Regenerate baselines when you have intentionally changed the UI — for example:

- Updated a component's layout, colours, or typography
- Added a new visual test that has no existing baseline
- Changed global CSS that affects multiple pages

If you only changed non-visual logic (math, API calls, state), you should not
need to update baselines.

### How to run the workflow

Baselines are regenerated via the **Update Playwright Snapshots** GitHub Actions
workflow. To trigger it:

1. Go to the repository on GitHub.
2. Open **Actions → Update Playwright Snapshots**.
3. Click **Run workflow**.
4. In the **Branch to update snapshots on** field, enter the branch you are
   working on (leave blank to use the default branch).
5. Click **Run workflow** to confirm.

The workflow will:

1. Check out your branch on `ubuntu-latest`.
2. Install dependencies and Playwright browsers.
3. Build the app in mock mode.
4. Run `npx playwright test --update-snapshots` to regenerate all baseline PNGs.
5. Commit any new or changed files under `e2e/__screenshots__/` back to your
   branch with the message `test: update playwright visual snapshots [skip ci]`.

After the workflow completes, pull the changes locally:

```bash
git pull
```

CI will now use the freshly committed Linux baselines for comparison.

### CI behaviour

The CI `e2e` job also runs with `--update-snapshots`. This means:

- If baseline PNGs are already committed, Playwright diffs against them normally.
- If a baseline is missing (e.g. you added a new visual test but haven't run
  the workflow yet), CI generates it in-place and commits it. The test does not
  fail on first run; it establishes the baseline so the *next* run can diff.

This means CI will never go red solely because a baseline PNG is missing — but
it also means any newly generated baseline in CI reflects Linux rendering, which
is correct and intentional.

### Summary of rules

| Situation | What to do |
|---|---|
| Intentional UI change on your branch | Trigger **Update Playwright Snapshots** workflow on your branch |
| New visual test with no baseline | Trigger the workflow, or let CI generate it on first run |
| Baseline generated on Windows / macOS | **Do not commit it** — trigger the workflow instead |
| Flaky diff on a pixel you didn't touch | Check if your branch has locally generated PNGs committed; replace via workflow |

---

## Contract tests (Rust)

```bash
cd contracts
cargo test
```

To run a single test:

```bash
cargo test test_withdraw_after_cliff
```

44 tests cover the full stream lifecycle, authorization, cliff edge cases,
overdraw protection, integer math, and self-streams. See
[CONTRACT_TESTING.md](./CONTRACT_TESTING.md) for details.
FlowStar has three separate test suites: Vitest (unit/component), Playwright
(end-to-end), and `cargo test` (the Soroban contract). This guide covers how
to run each, how to make sure a new test file is actually picked up, and the
coverage-threshold policy.

## Vitest (unit / component tests)

```bash
npm run test            # run once
npm run test:watch      # watch mode
npm run test:coverage   # run once with coverage report
```

Config: `vitest.config.ts`. Environment is `jsdom`.

### ⚠️ Where to put a new test file

Vitest is configured with:

```ts
include: ["__tests__/**/*.{test,spec}.{ts,tsx}"]
```

**A test file anywhere outside `__tests__/` is silently excluded** — it will
not fail, warn, or show up in coverage; it simply never runs. This actually
happened: a wallet-adapter test file sat outside `__tests__/` for months
without anyone noticing, because there was no error to notice — the suite
just passed without it.

When adding a new test file:

1. Put it under `__tests__/` (subdirectories are fine, e.g.
   `__tests__/hooks/use-webhooks.test.ts`), matching the `.test.ts`/`.test.tsx`/
   `.spec.ts`/`.spec.tsx` naming pattern.
2. Run `npm run test` and confirm your new test's name actually appears in
   the output — don't just check that the run exits green. A file outside
   the glob produces the *same* green exit code as one that ran and passed.

### Coverage thresholds

`vitest.config.ts`'s `coverage.thresholds` are a **ratchet, not a target**:

```ts
thresholds: {
  statements: 13,
  branches: 60,
  functions: 40,
  lines: 13,
},
```

These were set from the actual coverage measured on 2026-07-18 and are a
floor `test:coverage` enforces — a PR that drops any of these numbers fails.
The policy:

- **Never lower a threshold** to make a failing PR pass. If your change
  legitimately reduces coverage (e.g. adding a large new untested module),
  add tests for the new code instead.
- **Do raise a threshold** when you add meaningful test coverage — bump the
  relevant number(s) up to (or just below) your new measured percentage in
  the same PR, so the improvement is locked in and can't silently regress
  later.
- Coverage is measured over `hooks/**`, `lib/**`, `components/**`, and
  `utils/**` (see `coverage.include`) — contract code and Next.js `app/`
  routes are not included in this threshold.

## Playwright (end-to-end)

```bash
npm run test:e2e          # run once (all configured browsers/devices)
npm run test:e2e:update   # run once, updating snapshots
```

Config: `playwright.config.ts`. Test files live under `./e2e`. Runs against
Chrome, Firefox, Safari (WebKit), and mobile viewports (Pixel 5, iPhone 13) —
see the `projects` array in the config for the full list.

## Contract tests (`cargo test`)

```bash
cd contracts/streaming
cargo test
```

Runs the Soroban contract's Rust unit/integration tests. See
`CONTRIBUTING.md`'s Rust section for `cargo fmt`/`cargo clippy` alongside
this.

## Quick reference

| Suite | Command | Config | Test file location |
|---|---|---|---|
| Vitest | `npm run test` | `vitest.config.ts` | `__tests__/**/*.{test,spec}.{ts,tsx}` — **outside this, silently excluded** |
| Playwright | `npm run test:e2e` | `playwright.config.ts` | `e2e/` |
| Contract | `cargo test` (from `contracts/streaming`) | `contracts/streaming/Cargo.toml` | alongside the contract source, standard Rust `#[cfg(test)]` |
