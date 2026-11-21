#!/usr/bin/env node
/**
 * Standalone guard for contract/frontend error-code drift.
 *
 * Parses every numbered `StreamError` variant from the Rust contract and
 * checks that `lib/error-messages.ts` has an `Error(Contract, #N)` mapping for
 * it. Exits non-zero with the missing codes when the two files drift apart.
 *
 * Usage (from any directory): node scripts/check-error-mappings.mjs
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const rustSource = readFileSync(path.join(repoRoot, 'contracts/streaming/src/lib.rs'), 'utf8')
const tsSource = readFileSync(path.join(repoRoot, 'lib/error-messages.ts'), 'utf8')

const enumBody = rustSource.match(/pub enum StreamError\s*\{([\s\S]*?)\n\}/)?.[1]
if (!enumBody) {
  console.error('ERROR: could not find the StreamError enum in contracts/streaming/src/lib.rs')
  process.exit(1)
}

const variants = [...enumBody.matchAll(/^\s*([A-Z][A-Za-z0-9_]*)\s*=\s*(\d+)\s*,/gm)].map((m) => ({
  name: m[1],
  code: Number(m[2]),
}))
if (variants.length === 0) {
  console.error('ERROR: no numbered StreamError variants found in contracts/streaming/src/lib.rs')
  process.exit(1)
}

// Matches both regex-literal source (`/Error\(Contract,\s*#?21\)/`) and plain
// text (`Error(Contract, 21)`) in the TypeScript file.
const mappedCodes = new Set(
  [...tsSource.matchAll(/Error\\?\(Contract,(?:\\s\*|\s*)#?\??(\d+)\\?\)/g)].map((m) => Number(m[1])),
)

const missing = variants.filter(({ code }) => !mappedCodes.has(code))
if (missing.length > 0) {
  console.error(
    `ERROR: ${missing.length} StreamError variant(s) have no mapping in lib/error-messages.ts:`,
  )
  for (const { name, code } of missing) {
    console.error(`  #${code} ${name} — add a pattern for Error(Contract, #${code})`)
  }
  process.exit(1)
}

console.log(`OK: all ${variants.length} StreamError variants have a frontend error mapping.`)
