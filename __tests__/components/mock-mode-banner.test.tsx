import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MockModeBanner } from '@/components/layout/mock-mode-banner'

const mockUseNetwork = vi.fn()

vi.mock('@/components/providers/network-provider', () => ({
  useNetwork: () => mockUseNetwork(),
}))

describe('MockModeBanner', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.clearAllMocks()
  })

  it('renders the banner when in mock mode outside of production', () => {
    vi.stubEnv('NODE_ENV', 'test')
    mockUseNetwork.mockReturnValue({ isMockMode: true })

    render(<MockModeBanner />)

    expect(screen.getByRole('status')).toHaveTextContent('Mock mode — no contract connected')
  })

  it('renders nothing when a real contract is configured', () => {
    vi.stubEnv('NODE_ENV', 'test')
    mockUseNetwork.mockReturnValue({ isMockMode: false })

    const { container } = render(<MockModeBanner />)

    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing in production even when in mock mode', () => {
    vi.stubEnv('NODE_ENV', 'production')
    mockUseNetwork.mockReturnValue({ isMockMode: true })

    const { container } = render(<MockModeBanner />)

    expect(container).toBeEmptyDOMElement()
  })
})
