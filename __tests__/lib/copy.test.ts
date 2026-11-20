import { describe, expect, it } from 'vitest'
import * as analytics from '@/lib/copy/analytics'
import * as batchCreate from '@/lib/copy/batch-create'
import * as createForm from '@/lib/copy/create-form'
import * as dashboard from '@/lib/copy/dashboard'
import * as errors from '@/lib/copy/errors'
import * as landing from '@/lib/copy/landing'
import * as navigation from '@/lib/copy/navigation'
import * as notifications from '@/lib/copy/notifications'
import * as settings from '@/lib/copy/settings'
import * as streamDetail from '@/lib/copy/stream-detail'
import * as streams from '@/lib/copy/streams'
import * as wallet from '@/lib/copy/wallet'

const modules = {
  analytics,
  batchCreate,
  createForm,
  dashboard,
  errors,
  landing,
  navigation,
  notifications,
  settings,
  streamDetail,
  streams,
  wallet,
}

const SAMPLE_ARGS = ['sample', 1, 'USD', true, 'sample', 1, 'USD', true]

function makeArgs(fn: (...args: unknown[]) => unknown): unknown[] {
  return Array.from({ length: fn.length }, (_, index) => SAMPLE_ARGS[index % SAMPLE_ARGS.length])
}

function walkCopy(value: unknown, path: string): void {
  if (typeof value === 'string') {
    expect(value.trim(), `${path} should not be empty`).not.toBe('')
    return
  }

  if (typeof value === 'function') {
    const result = value(...makeArgs(value as (...args: unknown[]) => unknown))
    expect(typeof result, `${path} should return a string`).toBe('string')
    expect((result as string).trim(), `${path} result should not be empty`).not.toBe('')
    return
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => walkCopy(item, `${path}[${index}]`))
    return
  }

  if (value !== null && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      walkCopy(child, `${path}.${key}`)
    }
    return
  }

  throw new Error(`Unexpected copy value at ${path}: ${String(value)}`)
}

describe('lib/copy modules', () => {
  for (const [moduleName, module] of Object.entries(modules)) {
    it(`${moduleName} exports only non-empty copy strings and callable formatters`, () => {
      const exports = Object.entries(module).filter(([name]) => name !== 'default')
      expect(exports.length, `${moduleName} should export copy objects`).toBeGreaterThan(0)

      for (const [exportName, exported] of exports) {
        walkCopy(exported, `${moduleName}.${exportName}`)
      }
    })
  }
})
