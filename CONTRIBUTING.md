# Contributing to FlowStar

## Getting started

```bash
git clone https://github.com/FlowwStar/FlowStar.git
cd FlowStar
npm install   # also runs `npm run prepare`, which installs Husky hooks
npm run dev
```

## Pre-commit hooks

FlowStar uses [Husky](https://typicode.github.io/husky/) and
[lint-staged](https://github.com/lint-staged/lint-staged) to enforce code
quality on every commit.

### What runs on commit

Hooks run only on **staged files** — they are fast because they don't scan
the whole project.

| File type | Checks |
|---|---|
| `*.ts`, `*.tsx` | ESLint (auto-fix) + Prettier (format) |
| `*.json`, `*.md`, `*.css` | Prettier (format) |
| `*.rs` | `cargo fmt --check` |

### Bypassing hooks in emergencies

```bash
git commit --no-verify -m "emergency fix"
```

Use sparingly. Bypassed commits should be followed immediately by a clean
commit that addresses whatever the hook would have caught.

### Hooks not running?

Husky installs its hooks via the `prepare` npm lifecycle script. If hooks
aren't firing, re-run:

```bash
npm run prepare
```

## Code style

- TypeScript: ESLint + Prettier (config in `eslint.config.mjs` and `.lintstagedrc`)
- Rust contracts: `cargo fmt` (rustfmt defaults)
- No new test files per project conventions

## Pull requests

1. Branch from `main`.
2. One PR per logical change.
3. Reference the GitHub issue number in the PR description (`Closes #NNN`).
