#!/usr/bin/env node
// scripts/soroban-security-check.mjs
// Custom Soroban/Rust security pattern checker.
// Exits 1 if any HIGH-severity issue is found; warns on LOW.

import { readFileSync, readdirSync, statSync } from 'fs'
import { join, extname } from 'path'

const ROOT = new URL('..', import.meta.url).pathname

// ── Helpers ───────────────────────────────────────────────────────────────────

function walkRust(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      walkRust(full, files)
    } else if (extname(entry) === '.rs') {
      files.push(full)
    }
  }
  return files
}

function lines(src) {
  return src.split('\n')
}

// ── Rules ─────────────────────────────────────────────────────────────────────

// Each rule: { id, severity, description, check(src, filePath) -> [{line, col, msg}] }

const rules = [
  {
    id: 'SOROBAN-001',
    severity: 'HIGH',
    description: 'Unchecked arithmetic on i128/u128/u64 — use checked_add / checked_mul',
    check(src) {
      const findings = []
      // Flag bare `+`, `-`, `*` on i128/u128 variables.
      // Heuristic: look for `withdrawn_amount +=` or similar without checked_ call on the same line.
      const uncheckedOps = /\b(withdrawn_amount|deposited_amount|amount_per_second|cliff_amount|linear_amount)\s*(\+=|-=|\*=)/g
      lines(src).forEach((line, i) => {
        if (uncheckedOps.test(line) && !line.includes('checked_')) {
          findings.push({ line: i + 1, msg: `Unchecked compound assignment: ${line.trim()}` })
        }
        uncheckedOps.lastIndex = 0
      })
      return findings
    },
  },

  {
    id: 'SOROBAN-002',
    severity: 'HIGH',
    description: 'Public write function missing require_auth()',
    check(src) {
      const findings = []
      // Collect all pub fn bodies; check that require_auth appears before any storage write.
      const fnRegex = /pub fn (\w+)\s*\(env:\s*Env[^)]*\)/g
      // Read-only patterns — skip them
      const readOnly = /^(get_|bump_stream|load_stream)/
      let match
      while ((match = fnRegex.exec(src)) !== null) {
        const name = match[1]
        if (readOnly.test(name)) continue

        // Slice from function start to next `pub fn` or end of file
        const body = src.slice(match.index)
        const nextFn = body.indexOf('\n    pub fn ', 1)
        const fnBody = nextFn === -1 ? body : body.slice(0, nextFn)

        if (!fnBody.includes('require_auth()')) {
          const lineNo = src.slice(0, match.index).split('\n').length
          findings.push({ line: lineNo, msg: `pub fn ${name} performs writes but has no require_auth()` })
        }
      }
      return findings
    },
  },

  {
    id: 'SOROBAN-003',
    severity: 'HIGH',
    description: 'Persistent storage set() without a subsequent extend_ttl()',
    check(src) {
      const findings = []
      // Each .persistent().set() call should be paired with an extend_ttl in the same function body.
      const fnBodies = []
      const fnRegex = /\bfn (\w+)\s*\(/g
      let match
      while ((match = fnRegex.exec(src)) !== null) {
        const start = match.index
        const after = src.indexOf('\n    fn ', start + 1)
        const body = after === -1 ? src.slice(start) : src.slice(start, after)
        fnBodies.push({ name: match[1], body, lineNo: src.slice(0, start).split('\n').length })
      }

      for (const { name, body, lineNo } of fnBodies) {
        if (body.includes('.persistent().set(') && !body.includes('extend_ttl')) {
          findings.push({ line: lineNo, msg: `fn ${name} writes to persistent storage without extend_ttl()` })
        }
      }
      return findings
    },
  },

  {
    id: 'SOROBAN-004',
    severity: 'LOW',
    description: 'panic!() with string message — prefer ContractError enum + panic_with_error!()',
    check(src) {
      const findings = []
      const panicRe = /panic!\s*\(\s*"/g
      lines(src).forEach((line, i) => {
        if (panicRe.test(line)) {
          findings.push({ line: i + 1, msg: `panic! with string: ${line.trim()}` })
        }
        panicRe.lastIndex = 0
      })
      return findings
    },
  },
]

// ── Runner ────────────────────────────────────────────────────────────────────

const contractsDir = join(ROOT, 'contracts')
const rustFiles = walkRust(contractsDir).filter(f => !f.includes('/target/'))

let totalHigh = 0
let totalLow = 0

for (const file of rustFiles) {
  const src = readFileSync(file, 'utf8')
  const rel = file.replace(ROOT, '')

  for (const rule of rules) {
    const findings = rule.check(src, file)
    for (const f of findings) {
      const prefix = rule.severity === 'HIGH' ? '❌ HIGH' : '⚠️  LOW '
      console.log(`${prefix} [${rule.id}] ${rel}:${f.line} — ${f.msg}`)
      if (rule.severity === 'HIGH') totalHigh++
      else totalLow++
    }
  }
}

if (totalHigh === 0 && totalLow === 0) {
  console.log('✅ No Soroban security issues found.')
}

if (totalHigh > 0) {
  console.log(`\n${totalHigh} HIGH severity issue(s) found. Fix before merging.`)
  process.exit(1)
}

if (totalLow > 0) {
  console.log(`\n${totalLow} LOW severity issue(s) found (warnings only).`)
}
