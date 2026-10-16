# Testing

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

### Visual baselines (screenshot tests)

`e2e/visual.spec.ts` compares pages against baseline PNGs stored in
`e2e/__screenshots__/`.

- **CI never regenerates baselines.** If no baseline PNGs are committed yet,
  CI runs the functional e2e tests with `--ignore-snapshots` and prints a
  warning instead of failing on missing screenshots. Once baselines are
  committed, CI compares against them.
- **Regenerate baselines** when you intentionally change how a page looks
  (layout, colors, copy that appears in a screenshot) or add a new
  `toHaveScreenshot` assertion.
- **How to regenerate:** push your branch, then open **Actions → Update
  Playwright Snapshots → Run workflow** and enter the branch name (or leave
  it empty to use the branch selected in the dropdown). The workflow
  (`.github/workflows/update-snapshots.yml`) builds the app in mock mode, runs
  `npx playwright test --update-snapshots` on Linux, and commits the changed
  files under `e2e/__screenshots__/` to that branch.
- **Don't commit baselines generated locally on Windows or macOS.** Font
  rendering and anti-aliasing differ between operating systems, so those PNGs
  won't match what CI renders on Linux and the screenshot tests would fail.
  `npm run test:e2e:update` is fine for a local check, but discard the
  resulting changes under `e2e/__screenshots__/` instead of committing them.

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
