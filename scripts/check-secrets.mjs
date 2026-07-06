#!/usr/bin/env node
// scripts/check-secrets.mjs
// Scan source files for hardcoded secrets and API keys.
// Exits 1 if any HIGH-severity pattern is found.

import { readFileSync, readdirSync, statSync } from 'fs'
import { join, extname } from 'path'

const ROOT = new URL('..', import.meta.url).pathname

const IGNORED_DIRS = new Set(['.git', '.next', 'node_modules', 'target', 'public', 'test_snapshots'])
const ALLOWED_EXTS = new Set(['.ts', '.tsx', '.js', '.mjs', '.env.example', '.yml', '.yaml', '.json'])

// Patterns that indicate a hardcoded secret value (not just a variable name).
// Note: Stellar public keys (G…/C… strkey) are intentionally excluded — they're public identifiers, not secrets.
const SECRET_PATTERNS = [
  // Real base64 secrets: must contain + or / (Stellar strkeys use only A-Z0-9, so this excludes them)
  { re: /['"`][A-Za-z0-9+/]{40,}={0,2}['"`](?=.*[+/])/, label: 'possible base64 secret' },
  { re: /sk_live_[A-Za-z0-9]{24,}/, label: 'Stripe live secret key' },
  { re: /sk_test_[A-Za-z0-9]{24,}/, label: 'Stripe test secret key' },
  { re: /AKIA[0-9A-Z]{16}/, label: 'AWS access key ID' },
  { re: /ghp_[A-Za-z0-9]{36}/, label: 'GitHub personal access token' },
  { re: /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/, label: 'private key' },
  { re: /xoxb-[0-9A-Za-z-]{50,}/, label: 'Slack bot token' },
]

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    if (IGNORED_DIRS.has(entry)) continue
    const full = join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) {
      walk(full, files)
    } else if (ALLOWED_EXTS.has(extname(entry)) || entry.startsWith('.env')) {
      // Skip .env.local (contains real values) — only scan example/template files
      if (entry === '.env.local') continue
      files.push(full)
    }
  }
  return files
}

const files = walk(ROOT)
let found = 0

for (const file of files) {
  const src = readFileSync(file, 'utf8')
  src.split('\n').forEach((line, i) => {
    for (const { re, label } of SECRET_PATTERNS) {
      if (re.test(line)) {
        const rel = file.replace(ROOT, '')
        console.log(`❌ HIGH [SECRETS-001] ${rel}:${i + 1} — ${label}: ${line.trim().slice(0, 80)}`)
        found++
      }
    }
  })
}

if (found === 0) {
  console.log('✅ No hardcoded secrets found.')
  process.exit(0)
} else {
  console.log(`\n${found} potential secret(s) found. Remove before merging.`)
  process.exit(1)
}
