# Troubleshooting

Common issues when setting up or developing FlowStar locally. For
wallet/RPC/contract-deployment issues, see
[CONTRIBUTING.md's Troubleshooting section](../CONTRIBUTING.md#troubleshooting)
— this page covers the setup issues not already covered there.

## `npm ci` fails with a peer-dependency conflict

**Symptom**: `npm ci` fails with `ERESOLVE unable to resolve dependency
tree` or similar.

**Fix**: use the dependency versions committed in `package-lock.json` and
report a reproducible failure with the Node.js and npm versions. Do not bypass
peer-dependency validation with `--legacy-peer-deps`; a clean install is part
of the project's dependency contract.

```bash
npm ci
```

This also runs Husky's `prepare` script, installing pre-commit hooks. If a
previous install failed partway, remove `node_modules` and retry the clean
install so npm can rebuild the dependency tree from the lockfile.

## Mock mode vs. live contract confusion

FlowStar runs in one of two modes, chosen automatically by
`isMockMode = !config.streamContractId` in `lib/contract.ts`:

- **Mock mode** (default, no env var set): all stream data comes from
  `lib/mock-data.ts`. No wallet or testnet funds required. Good for UI work.
- **Live contract mode**: set `NEXT_PUBLIC_STREAM_CONTRACT_ID_TESTNET` (or
  `_MAINNET`) in `.env.local` to a real deployed contract ID, and restart the
  dev server. The app then reads/writes real on-chain data via Freighter.

If you're unexpectedly seeing mock data when you expect live data (or vice
versa), see CONTRIBUTING.md's "App running in mock mode unexpectedly" entry —
the most common cause is the dev server not having been restarted after
setting the env var.

There is no partial state between these two modes: `isMockMode` is a single
boolean, so a page either shows entirely mock data or entirely live data,
never a mix.

## Freighter wallet not detected

See [CONTRIBUTING.md's "Freighter not detected / connecting"](../CONTRIBUTING.md#troubleshooting)
entry. In short: confirm Freighter is set to **Testnet**, is enabled for
`localhost`, and reload the page after unlocking it.

## Testnet faucet rate limits

Funding a new testnet account via
[Stellar Laboratory's Friendbot](https://laboratory.stellar.org/#account-creator?network=test)
is rate-limited per IP/account. If funding fails or you're asked to wait:

- Reuse an already-funded testnet keypair instead of generating a new one for
  every test run.
- Wait a few minutes between funding attempts from the same network/IP.
- If you're running automated tests that create many accounts, fund a small
  pool of keypairs up front and reuse them, rather than funding fresh per test.

## Still stuck?

Check [CONTRIBUTING.md's Troubleshooting section](../CONTRIBUTING.md#troubleshooting)
for RPC failures, contract deployment errors, and Husky/pre-commit hook
issues, or open an issue with the exact error message and your `.env.local`
configuration (with any secrets redacted).
