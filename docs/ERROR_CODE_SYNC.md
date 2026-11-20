# Contract / frontend error-code sync

`lib/error-messages.ts` maps Soroban `Error(Contract, #N)` codes to user-facing
messages by hand. The codes come from the `StreamError` enum in
`contracts/streaming/src/lib.rs`. When a variant is added to the contract
without adding a mapping, callers fall through to the generic
"Transaction failed" message. Error 21 (`PastStartTime`) was missed this way.

`scripts/check-error-mappings.mjs` is a standalone consistency check for this
drift. It is a plain Node script, not a Vitest test, so it can be run directly
(or wired into CI later) without the frontend test runner.

## Run

From the repository root:

```sh
node scripts/check-error-mappings.mjs
```

The script resolves both files relative to its own location, so it also works
when invoked from another directory with an absolute or relative path.

- Exit code `0` prints `OK: all N StreamError variants have a frontend error mapping.`
- Exit code `1` prints the missing variant names and codes, for example:

  ```text
  ERROR: 1 StreamError variant(s) have no mapping in lib/error-messages.ts:
    #21 PastStartTime — add a pattern for Error(Contract, #21)
  ```

## What it checks

1. Parses the body of `pub enum StreamError { ... }` in
   `contracts/streaming/src/lib.rs` and collects every `Name = <number>`
   variant with a regex.
2. Scans `lib/error-messages.ts` for `Error(Contract, #N)` mapping patterns.
3. Fails if any variant number has no corresponding mapping.

## Adding a new contract error

1. Add the variant with the next free number in `StreamError`.
2. Add a matching `pattern: /Error\(Contract,\s*#?N\)/` entry to
   `ERROR_PATTERNS` in `lib/error-messages.ts`, with a user-friendly message,
   suggestion and category.
3. Run `node scripts/check-error-mappings.mjs` before opening the PR.
