import { render, screen, fireEvent } from '@testing-library/react'
import { ActivityFeed } from './activity-feed'

jest.mock('@/hooks/use-stream-activity', () => ({
  useStreamActivity: jest.fn(),
}))

const mockUseStreamActivity = require('@/hooks/use-stream-activity').useStreamActivity as jest.MockedFunction<any>

describe('ActivityFeed', () => {
  const mockEvents = [
    { id: '1', type: 'created', timestamp: Date.now(), description: 'Stream created' },
    { id: '2', type: 'deposit', timestamp: Date.now(), description: 'Deposit received' },
    { id: '3', type: 'withdrawal', timestamp: Date.now(), description: 'Funds withdrawn' },
  ]

  beforeEach(() => {
    jest.clearAllMocks()
    mockUseStreamActivity.mockReturnValue({
      events: mockEvents,
      hasMore: false,
      loading: false,
      loadMore: jest.fn(),
      filterByType: jest.fn(),
      selectedFilter: 'all',
    })
  })

  describe('empty state', () => {
    it('should render "No activity yet" when no events exist', () => {
      mockUseStreamActivity.mockReturnValue({
        events: [],
        hasMore: false,
        loading: false,
        loadMore: jest.fn(),
        filterByType: jest.fn(),
        selectedFilter: 'all',
      })

      render(<ActivityFeed streamId="stream-123" />)
      expect(screen.getByText(/no activity yet/i)).toBeInTheDocument()
    })

    it('should render only empty state message and not load-more button', () => {
      mockUseStreamActivity.mockReturnValue({
        events: [],
        hasMore: true,
        loading: false,
        loadMore: jest.fn(),
        filterByType: jest.fn(),
        selectedFilter: 'all',
      })

      render(<ActivityFeed streamId="stream-123" />)
      expect(screen.getByText(/no activity yet/i)).toBeInTheDocument()
      expect(screen.queryByText(/load more/i)).not.toBeInTheDocument()
    })
  })

  describe('pagination with hasMore', () => {
    it('should not display load-more button when hasMore is false', () => {
      mockUseStreamActivity.mockReturnValue({
        events: mockEvents,
        hasMore: false,
        loading: false,
        loadMore: jest.fn(),
        filterByType: jest.fn(),
        selectedFilter: 'all',
      })

      render(<ActivityFeed streamId="stream-123" />)
      expect(screen.queryByText(/load more/i)).not.toBeInTheDocument()
    })

    it('should display load-more button when hasMore is true', () => {
      mockUseStreamActivity.mockReturnValue({
        events: mockEvents,
        hasMore: true,
        loading: false,
        loadMore: jest.fn(),
        filterByType: jest.fn(),
        selectedFilter: 'all',
      })

      render(<ActivityFeed streamId="stream-123" />)
      expect(screen.getByText(/load more/i)).toBeInTheDocument()
    })

    it('should call loadMore when load-more button is clicked', () => {
      const loadMoreMock = jest.fn()
      mockUseStreamActivity.mockReturnValue({
        events: mockEvents,
        hasMore: true,
        loading: false,
        loadMore: loadMoreMock,
        filterByType: jest.fn(),
        selectedFilter: 'all',
      })

      render(<ActivityFeed streamId="stream-123" />)
      const loadMoreButton = screen.getByText(/load more/i)
      fireEvent.click(loadMoreButton)

      expect(loadMoreMock).toHaveBeenCalled()
    })

    it('should disable load-more button while loading', () => {
      mockUseStreamActivity.mockReturnValue({
        events: mockEvents,
        hasMore: true,
        loading: true,
        loadMore: jest.fn(),
        filterByType: jest.fn(),
        selectedFilter: 'all',
      })

      render(<ActivityFeed streamId="stream-123" />)
      const loadMoreButton = screen.getByText(/load more/i) as HTMLButtonElement
      expect(loadMoreButton.disabled).toBe(true)
    })
  })

  describe('event type filtering', () => {
    it('should render filter buttons for event types', () => {
      render(<ActivityFeed streamId="stream-123" />)
      expect(screen.getByText(/all/i)).toBeInTheDocument()
      expect(screen.getByText(/created/i) || screen.getByText(/deposit/i)).toBeInTheDocument()
    })

    it('should show only events matching selected filter', () => {
      const filterByTypeMock = jest.fn()
      mockUseStreamActivity.mockReturnValue({
        events: [mockEvents[1], mockEvents[2]], // Only deposit and withdrawal
        hasMore: false,
        loading: false,
        loadMore: jest.fn(),
        filterByType: filterByTypeMock,
        selectedFilter: 'deposit',
      })

      render(<ActivityFeed streamId="stream-123" />)

      // Events should be filtered
      expect(screen.getByText('Deposit received')).toBeInTheDocument()
      expect(screen.getByText('Funds withdrawn')).toBeInTheDocument()
      expect(screen.queryByText('Stream created')).not.toBeInTheDocument()
    })

    it('should call filterByType when filter button is clicked', () => {
      const filterByTypeMock = jest.fn()
      mockUseStreamActivity.mockReturnValue({
        events: mockEvents,
        hasMore: false,
        loading: false,
        loadMore: jest.fn(),
        filterByType: filterByTypeMock,
        selectedFilter: 'all',
      })

      render(<ActivityFeed streamId="stream-123" />)
      const depositFilter = screen.getByText(/deposit/i)
      fireEvent.click(depositFilter)

      expect(filterByTypeMock).toHaveBeenCalledWith('deposit')
    })

    it('should highlight the selected filter button', () => {
      mockUseStreamActivity.mockReturnValue({
        events: mockEvents,
        hasMore: false,
        loading: false,
        loadMore: jest.fn(),
        filterByType: jest.fn(),
        selectedFilter: 'deposit',
      })

      render(<ActivityFeed streamId="stream-123" />)
      const depositFilter = screen.getByText(/deposit/i).closest('button')

      expect(depositFilter).toHaveClass('active') || expect(depositFilter).toHaveClass('bg-secondary')
    })
  })

  describe('event display', () => {
    it('should display all events in feed', () => {
      render(<ActivityFeed streamId="stream-123" />)

      mockEvents.forEach(event => {
        expect(screen.getByText(event.description)).toBeInTheDocument()
      })
    })

    it('should display events in reverse chronological order', () => {
      const orderedEvents = [
        { id: '1', type: 'created', timestamp: 1000, description: 'Event 1' },
        { id: '2', type: 'deposit', timestamp: 2000, description: 'Event 2' },
        { id: '3', type: 'withdrawal', timestamp: 3000, description: 'Event 3' },
      ]

      mockUseStreamActivity.mockReturnValue({
        events: orderedEvents,
        hasMore: false,
        loading: false,
        loadMore: jest.fn(),
        filterByType: jest.fn(),
        selectedFilter: 'all',
      })

      render(<ActivityFeed streamId="stream-123" />)

      const eventElements = screen.getAllByText(/Event/)
      expect(eventElements[0]).toHaveTextContent('Event 3')
      expect(eventElements[eventElements.length - 1]).toHaveTextContent('Event 1')
    })
  })
})
