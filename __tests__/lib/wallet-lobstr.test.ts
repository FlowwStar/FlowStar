import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Reset modules between tests so module-level WC state (_lobstrWcClient / _lobstrWcSession)
// doesn't bleed between cases.
beforeEach(() => {
  vi.resetModules()
})

afterEach(() => {
  delete (window as unknown as { lobstrSDK?: unknown }).lobstrSDK
})

async function getLobstrAdapter() {
  const mod = await import('../../components/providers/wallet-provider')
  return mod.lobstrAdapter
}

// ─── isAvailable ─────────────────────────────────────────────────────────────

describe('lobstrAdapter.isAvailable', () => {
  it('returns true even without extension (WalletConnect fallback always present)', async () => {
    const adapter = await getLobstrAdapter()
    expect(adapter.isAvailable()).toBe(true)
  })

  it('returns true when extension is present', async () => {
    ;(window as unknown as { lobstrSDK: unknown }).lobstrSDK = {}
    const adapter = await getLobstrAdapter()
    expect(adapter.isAvailable()).toBe(true)
  })
})

// ─── connect — extension path ─────────────────────────────────────────────────

describe('lobstrAdapter.connect — extension', () => {
  it('uses window.lobstrSDK.getPublicKey when extension is present', async () => {
    const mockGetPublicKey = vi.fn().mockResolvedValue({ publicKey: 'GTEST_ADDRESS_123' })
    ;(window as unknown as { lobstrSDK: unknown }).lobstrSDK = {
      getPublicKey: mockGetPublicKey,
    }

    const adapter = await getLobstrAdapter()
    const addr = await adapter.connect()

    expect(addr).toBe('GTEST_ADDRESS_123')
    expect(mockGetPublicKey).toHaveBeenCalledOnce()
  })

  it('throws when extension getPublicKey returns empty key', async () => {
    const mockGetPublicKey = vi.fn().mockResolvedValue({ publicKey: '' })
    ;(window as unknown as { lobstrSDK: unknown }).lobstrSDK = {
      getPublicKey: mockGetPublicKey,
    }

    const adapter = await getLobstrAdapter()
    await expect(adapter.connect()).rejects.toThrow('LOBSTR did not return a public key.')
  })
})

// ─── connect — WalletConnect path ─────────────────────────────────────────────

describe('lobstrAdapter.connect — WalletConnect fallback', () => {
  it('throws descriptive error when project ID env var is not set', async () => {
    const saved = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
    delete process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID

    const adapter = await getLobstrAdapter()
    await expect(adapter.connect()).rejects.toThrow('NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID')

    if (saved !== undefined) process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID = saved
  })

  it('mentions cloud.walletconnect.com in the missing-project-ID error', async () => {
    const saved = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
    delete process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID

    const adapter = await getLobstrAdapter()
    await expect(adapter.connect()).rejects.toThrow('cloud.walletconnect.com')

    if (saved !== undefined) process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID = saved
  })
})

// ─── signTransaction — extension path ────────────────────────────────────────

describe('lobstrAdapter.signTransaction — extension', () => {
  it('calls extension signTransaction and returns signed XDR', async () => {
    const mockSign = vi.fn().mockResolvedValue({ signedXdr: 'SIGNED_XDR_PAYLOAD' })
    ;(window as unknown as { lobstrSDK: unknown }).lobstrSDK = {
      signTransaction: mockSign,
    }

    const adapter = await getLobstrAdapter()
    const passphrase = 'Test SDF Network ; September 2015'
    const result = await adapter.signTransaction('RAW_XDR', passphrase)

    expect(result).toBe('SIGNED_XDR_PAYLOAD')
    expect(mockSign).toHaveBeenCalledWith('RAW_XDR', {
      networkPassphrase: passphrase,
    })
  })

  it('throws when extension signTransaction returns empty signedXdr', async () => {
    const mockSign = vi.fn().mockResolvedValue({ signedXdr: '' })
    ;(window as unknown as { lobstrSDK: unknown }).lobstrSDK = {
      signTransaction: mockSign,
    }

    const adapter = await getLobstrAdapter()
    await expect(adapter.signTransaction('XDR', 'passphrase')).rejects.toThrow(
      'LOBSTR signing failed.',
    )
  })
})

// ─── signTransaction — WalletConnect path ────────────────────────────────────

describe('lobstrAdapter.signTransaction — WalletConnect fallback', () => {
  it('throws when no WalletConnect session is active', async () => {
    const adapter = await getLobstrAdapter()
    await expect(adapter.signTransaction('XDR', 'passphrase')).rejects.toThrow(
      'No active LOBSTR WalletConnect session.',
    )
  })
})
