import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

// Issue #1155: public/manifest.json previously listed /icon-192x192.png and
// /icon-512x512.png, but neither file existed in public/, so install prompts
// and Lighthouse PWA checks failed on the 404s. This guards every icon `src`
// declared in the manifest against disappearing again.

const PUBLIC_DIR = path.resolve(__dirname, '../../public')
const manifest = JSON.parse(
  fs.readFileSync(path.join(PUBLIC_DIR, 'manifest.json'), 'utf-8'),
) as { icons: Array<{ src: string; sizes: string }> }

describe('public/manifest.json icons', () => {
  it('declares at least one icon', () => {
    expect(manifest.icons.length).toBeGreaterThan(0)
  })

  it.each(manifest.icons)('$src exists on disk', ({ src }) => {
    // Manifest icon paths are site-root-relative (e.g. "/icon.svg").
    const relativePath = src.startsWith('/') ? src.slice(1) : src
    const filePath = path.join(PUBLIC_DIR, relativePath)
    expect(fs.existsSync(filePath)).toBe(true)
  })

  it('includes maskable 192x192 and 512x512 PNG icons', () => {
    const maskable = manifest.icons.filter((i) => 'purpose' in i && (i as { purpose?: string }).purpose === 'maskable')
    const sizes = maskable.map((i) => i.sizes).sort()
    expect(sizes).toEqual(['192x192', '512x512'])
  })
})
