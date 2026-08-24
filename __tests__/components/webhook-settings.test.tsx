import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { WebhookSettings } from '@/components/webhooks/webhook-settings'

// ── Mocks ────────────────────────────────────────────────────────────────────

// Mock sonner so toasts don't blow up in jsdom
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

// Mock formatTimeAgo so delivery history timestamps render without issues
vi.mock('@/lib/stream-utils', () => ({
  formatTimeAgo: vi.fn(() => 'just now'),
}))

// Controlled mock for useWebhooks – each test can override via mockUseWebhooks
const mockAddWebhook = vi.fn()
const mockRemoveWebhook = vi.fn()
const mockToggleWebhook = vi.fn()
const mockTestWebhook = vi.fn()

const defaultHookState = {
  webhooks: [] as ReturnType<typeof import('@/hooks/use-webhooks').useWebhooks>['webhooks'],
  history: [] as ReturnType<typeof import('@/hooks/use-webhooks').useWebhooks>['history'],
  addWebhook: mockAddWebhook,
  removeWebhook: mockRemoveWebhook,
  toggleWebhook: mockToggleWebhook,
  testWebhook: mockTestWebhook,
  fireEvent: vi.fn(),
}

const mockUseWebhooks = vi.hoisted(() => vi.fn(() => ({ ...defaultHookState })))

vi.mock('@/hooks/use-webhooks', () => ({
  useWebhooks: mockUseWebhooks,
}))

// ── Helpers ───────────────────────────────────────────────────────────────────

function setup() {
  return render(<WebhookSettings />)
}

/** Returns the URL <input> element */
function urlInput() {
  return screen.getByLabelText(/webhook url/i)
}

/** Returns the "Register webhook" submit button */
function registerBtn() {
  return screen.getByRole('button', { name: /register webhook/i })
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('WebhookSettings – URL input', () => {
  beforeEach(() => {
    mockUseWebhooks.mockReturnValue({ ...defaultHookState })
    vi.clearAllMocks()
  })

  it('renders the URL input with correct placeholder', () => {
    setup()
    const input = urlInput()
    expect(input).toBeInTheDocument()
    expect(input).toHaveAttribute('placeholder', 'https://your-service.com/webhook')
    expect(input).toHaveAttribute('type', 'url')
  })

  it('does NOT call addWebhook when URL is empty', async () => {
    setup()
    fireEvent.click(registerBtn())
    expect(mockAddWebhook).not.toHaveBeenCalled()
  })

  it('shows an inline error for an invalid URL', async () => {
    setup()
    await userEvent.type(urlInput(), 'not-a-url')
    fireEvent.click(registerBtn())
    expect(mockAddWebhook).not.toHaveBeenCalled()
    expect(screen.getByText(/please enter a valid webhook url/i)).toBeInTheDocument()
  })

  it('shows an inline error when no event type is selected', async () => {
    setup()
    // Deselect all pre-selected events first
    const eventBtns = screen.getAllByRole('button', {
      name: /stream created|withdrawal|cancelled|completed|topped up|transferred/i,
    })
    for (const btn of eventBtns) {
      if (btn.getAttribute('aria-pressed') === 'true') {
        fireEvent.click(btn)
      }
    }
    await userEvent.type(urlInput(), 'https://example.com/hook')
    fireEvent.click(registerBtn())
    expect(mockAddWebhook).not.toHaveBeenCalled()
    expect(screen.getByText(/at least one event/i)).toBeInTheDocument()
  })

  it('calls addWebhook with trimmed URL and selected events for a valid input', async () => {
    const { toast } = await import('sonner')
    setup()
    await userEvent.type(urlInput(), '  https://example.com/hook  ')
    fireEvent.click(registerBtn())
    expect(mockAddWebhook).toHaveBeenCalledWith(
      'https://example.com/hook',
      expect.arrayContaining(['stream.created']),
    )
    expect(toast.success).toHaveBeenCalledWith('Webhook registered')
  })

  it('clears the URL input after a successful registration', async () => {
    setup()
    await userEvent.type(urlInput(), 'https://example.com/hook')
    fireEvent.click(registerBtn())
    expect(urlInput()).toHaveValue('')
  })
})

describe('WebhookSettings – event-type selection', () => {
  beforeEach(() => {
    mockUseWebhooks.mockReturnValue({ ...defaultHookState })
    vi.clearAllMocks()
  })

  it('renders all six event-type toggle buttons', () => {
    setup()
    const labels = [
      'Stream Created',
      'Withdrawal',
      'Cancelled',
      'Completed',
      'Topped Up',
      'Transferred',
    ]
    for (const label of labels) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument()
    }
  })

  it('has four events pre-selected by default (aria-pressed=true)', () => {
    setup()
    const pressed = screen
      .getAllByRole('button')
      .filter((b) => b.getAttribute('aria-pressed') === 'true')
    expect(pressed).toHaveLength(4)
  })

  it('toggles an event type off when clicked while selected', () => {
    setup()
    const btn = screen.getByRole('button', { name: 'Stream Created' })
    expect(btn).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(btn)
    expect(btn).toHaveAttribute('aria-pressed', 'false')
  })

  it('toggles an event type on when clicked while unselected', () => {
    setup()
    const btn = screen.getByRole('button', { name: 'Topped Up' })
    expect(btn).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(btn)
    expect(btn).toHaveAttribute('aria-pressed', 'true')
  })

  it('submits with currently-selected events', async () => {
    setup()
    // Deselect "Withdrawal", select "Topped Up"
    fireEvent.click(screen.getByRole('button', { name: 'Withdrawal' }))
    fireEvent.click(screen.getByRole('button', { name: 'Topped Up' }))
    await userEvent.type(urlInput(), 'https://example.com/hook')
    fireEvent.click(registerBtn())
    const [, passedEvents] = mockAddWebhook.mock.calls[0]
    expect(passedEvents).toContain('stream.topped_up')
    expect(passedEvents).not.toContain('stream.withdrawal')
  })
})

describe('WebhookSettings – registered webhook list', () => {
  const HOOK = {
    id: 'hook-1',
    url: 'https://example.com/hook',
    events: ['stream.created' as const, 'stream.withdrawal' as const],
    enabled: true,
    createdAt: Date.now(),
  }

  beforeEach(() => {
    mockUseWebhooks.mockReturnValue({ ...defaultHookState, webhooks: [HOOK] })
    vi.clearAllMocks()
  })

  it('renders the webhook URL in the list', () => {
    setup()
    expect(screen.getByText('https://example.com/hook')).toBeInTheDocument()
  })

  it('shows event labels for the registered webhook', () => {
    setup()
    expect(screen.getByText('Stream Created, Withdrawal')).toBeInTheDocument()
  })

  it('calls removeWebhook with the correct id when Remove is clicked', () => {
    setup()
    fireEvent.click(screen.getByTitle('Remove'))
    expect(mockRemoveWebhook).toHaveBeenCalledWith('hook-1')
  })

  it('calls toggleWebhook with the correct id when the toggle button is clicked', () => {
    setup()
    fireEvent.click(screen.getByTitle('Disable'))
    expect(mockToggleWebhook).toHaveBeenCalledWith('hook-1')
  })

  it('shows Enable title when webhook is disabled', () => {
    mockUseWebhooks.mockReturnValue({
      ...defaultHookState,
      webhooks: [{ ...HOOK, enabled: false }],
    })
    setup()
    expect(screen.getByTitle('Enable')).toBeInTheDocument()
  })

  it('calls testWebhook with the correct id when Send test is clicked', async () => {
    mockTestWebhook.mockResolvedValue(true)
    setup()
    fireEvent.click(screen.getByTitle('Send test'))
    await waitFor(() => expect(mockTestWebhook).toHaveBeenCalledWith('hook-1'))
  })

  it('shows a success toast when test delivery succeeds', async () => {
    const { toast } = await import('sonner')
    mockTestWebhook.mockResolvedValue(true)
    setup()
    fireEvent.click(screen.getByTitle('Send test'))
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Test delivered successfully'))
  })

  it('shows an error toast when test delivery fails', async () => {
    const { toast } = await import('sonner')
    mockTestWebhook.mockResolvedValue(false)
    setup()
    fireEvent.click(screen.getByTitle('Send test'))
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Test delivery failed', expect.any(Object)),
    )
  })

  it('disables the Send test button while the test is in flight', async () => {
    // Never resolves so the button stays disabled
    mockTestWebhook.mockReturnValue(new Promise(() => {}))
    setup()
    const testBtn = screen.getByTitle('Send test')
    fireEvent.click(testBtn)
    await waitFor(() => expect(testBtn).toBeDisabled())
  })

  it('does not render the webhook list section when there are no webhooks', () => {
    mockUseWebhooks.mockReturnValue({ ...defaultHookState, webhooks: [] })
    setup()
    expect(screen.queryByText('Registered webhooks')).not.toBeInTheDocument()
  })
})

describe('WebhookSettings – delivery history', () => {
  const DELIVERY = {
    webhookId: 'hook-1',
    eventType: 'stream.created' as const,
    statusCode: 200,
    deliveredAt: Date.now(),
    success: true,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders recent delivery history when present', () => {
    mockUseWebhooks.mockReturnValue({ ...defaultHookState, history: [DELIVERY] })
    setup()
    expect(screen.getByText('Recent deliveries')).toBeInTheDocument()
    expect(screen.getByText('stream.created')).toBeInTheDocument()
  })

  it('shows the HTTP status code for each delivery', () => {
    mockUseWebhooks.mockReturnValue({ ...defaultHookState, history: [DELIVERY] })
    setup()
    expect(screen.getByText('200')).toBeInTheDocument()
  })

  it('does not render the history section when history is empty', () => {
    mockUseWebhooks.mockReturnValue({ ...defaultHookState, history: [] })
    setup()
    expect(screen.queryByText('Recent deliveries')).not.toBeInTheDocument()
  })

  it('limits display to at most 20 deliveries', () => {
    const manyDeliveries = Array.from({ length: 25 }, (_, i) => ({
      ...DELIVERY,
      statusCode: 200 + i,
    }))
    mockUseWebhooks.mockReturnValue({ ...defaultHookState, history: manyDeliveries })
    setup()
    // The first 20 status codes are 200–219; the 21st+ (220–224) should not appear
    expect(screen.queryByText('220')).not.toBeInTheDocument()
  })
})
