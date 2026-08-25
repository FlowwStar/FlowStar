# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
The contract additionally tracks its own `CONTRACT_VERSION` constant
(`contracts/streaming/src/lib.rs`), bumped whenever a deployed contract's
storage layout changes and a `migrate()` pass is required after upgrade.

No versioned release has been tagged yet (the app is still pre-1.0, see
`package.json`), so entries below are grouped under **Unreleased**. Once the
first release is tagged, this section will be cut into a dated `[x.y.z]`
entry and a new **Unreleased** section will start above it.

## [Unreleased]

### Added

- Batch stream creation via CSV upload, including cliff duration support
- `create_streams_batch` contract method for atomic multi-stream creation
- xBull and LOBSTR (WalletConnect) wallet adapters
- Real-time token portfolio value with live price feeds
- Stream metadata support (name, category, memo)
- Deployment presets, fee estimation, and auto-withdraw settings
- Root and route-level error UI with friendly messages and retry
- Page metadata, Open Graph image, and Twitter card
- Playwright end-to-end tests running in CI
- Lighthouse CI for per-PR performance and accessibility scoring
- Vitest unit test suite with enforced coverage thresholds

### Changed

- Reconciled `CONTRIBUTING.md`, which had duplicated/interleaved sections from
  an unresolved merge, into a single canonical guide per topic
- Clarified that mock mode is automatic (`isMockMode = !config.streamContractId`)
  rather than a manually-set flag, in both `README.md` and `CONTRIBUTING.md`

### Fixed

- Cliff duration not being applied from CSV batch uploads
- Notification events leaking across wallets instead of scoping to the
  connected wallet
- Fabricated CPU/memory/storage fee breakdown removed from the UI
- Rust contract merge corruption, plus related vesting and auth bugs
- Missing `clippy`/`fmt --check` steps in contract CI

Project history prior to this file is available via `git log`.
