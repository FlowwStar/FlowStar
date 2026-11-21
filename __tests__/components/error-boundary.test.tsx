import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ComponentErrorBoundary } from '@/components/error-boundary/component-error-boundary'
import { PageErrorBoundary } from '@/components/error-boundary/page-error-boundary'
import { SectionErrorBoundary } from '@/components/error-boundary/section-error-boundary'
import { captureError } from '@/lib/sentry'

vi.mock('@/lib/sentry', () => ({ captureError: vi.fn() }))

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

function Boom(): never {
  throw new Error('boom')
}

function Safe() {
  return <div>all good</div>
}

// React logs caught errors to the console; keep test output clean.
let consoleErrorSpy: ReturnType<typeof vi.spyOn>
beforeEach(() => {
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.mocked(captureError).mockClear()
})
afterEach(() => {
  consoleErrorSpy.mockRestore()
})

describe('ComponentErrorBoundary', () => {
  it('renders children when there is no error', () => {
    render(
      <ComponentErrorBoundary label="widget">
        <Safe />
      </ComponentErrorBoundary>,
    )
    expect(screen.getByText('all good')).toBeInTheDocument()
  })

  it('renders fallback UI when a child throws', () => {
    render(
      <ComponentErrorBoundary label="widget">
        <Boom />
      </ComponentErrorBoundary>,
    )
    expect(screen.getByText('Failed to render widget')).toBeInTheDocument()
    expect(screen.queryByText('all good')).not.toBeInTheDocument()
  })

  it('renders its fallback instead of crashing the surrounding tree when a child throws', () => {
    render(
      <div>
        <span>sibling content</span>
        <ComponentErrorBoundary label="widget">
          <Boom />
        </ComponentErrorBoundary>
      </div>,
    )
    expect(screen.getByText('sibling content')).toBeInTheDocument()
    expect(screen.getByText('Failed to render widget')).toBeInTheDocument()
  })

  it('reports the thrown error to captureError with the component label', () => {
    render(
      <ComponentErrorBoundary label="widget">
        <Boom />
      </ComponentErrorBoundary>,
    )
    expect(captureError).toHaveBeenCalledTimes(1)
    expect(captureError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'boom' }),
      expect.objectContaining({ operation: 'component_render:widget' }),
    )
  })

  it('clears the error state and re-renders children on retry', () => {
    let shouldThrow = true
    function Flaky() {
      if (shouldThrow) throw new Error('boom')
      return <div>recovered</div>
    }

    render(
      <ComponentErrorBoundary label="widget">
        <Flaky />
      </ComponentErrorBoundary>,
    )
    expect(screen.getByText('Failed to render widget')).toBeInTheDocument()

    shouldThrow = false
    fireEvent.click(screen.getByRole('button', { name: 'Retry widget' }))

    expect(screen.getByText('recovered')).toBeInTheDocument()
    expect(screen.queryByText('Failed to render widget')).not.toBeInTheDocument()
  })
})

describe('SectionErrorBoundary', () => {
  it('renders children when there is no error', () => {
    render(
      <SectionErrorBoundary sectionName="Stream list">
        <Safe />
      </SectionErrorBoundary>,
    )
    expect(screen.getByText('all good')).toBeInTheDocument()
  })

  it('renders fallback UI when a child throws', () => {
    render(
      <SectionErrorBoundary sectionName="Stream list">
        <Boom />
      </SectionErrorBoundary>,
    )
    expect(screen.getByText('Stream list failed to load')).toBeInTheDocument()
  })

  it('renders the section fallback without taking down the surrounding page', () => {
    render(
      <div>
        <nav>site navigation</nav>
        <SectionErrorBoundary sectionName="Stream list">
          <Boom />
        </SectionErrorBoundary>
        <footer>page footer</footer>
      </div>,
    )
    expect(screen.getByText('site navigation')).toBeInTheDocument()
    expect(screen.getByText('page footer')).toBeInTheDocument()
    expect(screen.getByText('Stream list failed to load')).toBeInTheDocument()
  })

  it('reports the thrown error to captureError with the section name', () => {
    render(
      <SectionErrorBoundary sectionName="Stream list">
        <Boom />
      </SectionErrorBoundary>,
    )
    expect(captureError).toHaveBeenCalledTimes(1)
    expect(captureError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'boom' }),
      expect.objectContaining({ operation: 'section_render:Stream list' }),
    )
  })

  it('clears the error state and re-renders children on retry', () => {
    let shouldThrow = true
    function Flaky() {
      if (shouldThrow) throw new Error('boom')
      return <div>recovered</div>
    }

    render(
      <SectionErrorBoundary sectionName="Stream list">
        <Flaky />
      </SectionErrorBoundary>,
    )
    expect(screen.getByText('Stream list failed to load')).toBeInTheDocument()

    shouldThrow = false
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))

    expect(screen.getByText('recovered')).toBeInTheDocument()
  })

  it('calls onReloadData and clears the error when "Reload data" is clicked', () => {
    const onReloadData = vi.fn()
    let shouldThrow = true
    function Flaky() {
      if (shouldThrow) throw new Error('boom')
      return <div>recovered</div>
    }

    render(
      <SectionErrorBoundary sectionName="Stream list" onReloadData={onReloadData}>
        <Flaky />
      </SectionErrorBoundary>,
    )

    shouldThrow = false
    fireEvent.click(screen.getByRole('button', { name: 'Reload data' }))

    expect(onReloadData).toHaveBeenCalledTimes(1)
    expect(screen.getByText('recovered')).toBeInTheDocument()
  })
})

describe('PageErrorBoundary', () => {
  it('renders children when there is no error', () => {
    render(
      <PageErrorBoundary>
        <Safe />
      </PageErrorBoundary>,
    )
    expect(screen.getByText('all good')).toBeInTheDocument()
  })

  it('renders fallback UI with the error message when a child throws', () => {
    render(
      <PageErrorBoundary>
        <Boom />
      </PageErrorBoundary>,
    )
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    expect(screen.getByText('boom')).toBeInTheDocument()
  })

  it('renders a full-screen fallback with a dashboard link and a reload button', () => {
    render(
      <PageErrorBoundary>
        <Boom />
      </PageErrorBoundary>,
    )
    const dashboardLink = screen.getByRole('link', { name: 'Go to dashboard' })
    expect(dashboardLink).toBeInTheDocument()
    expect(dashboardLink).toHaveAttribute('href', '/app')
    expect(screen.getByRole('button', { name: 'Reload page' })).toBeInTheDocument()
  })

  it('reports the thrown error to captureError', () => {
    render(
      <PageErrorBoundary>
        <Boom />
      </PageErrorBoundary>,
    )
    expect(captureError).toHaveBeenCalledTimes(1)
    expect(captureError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'boom' }),
      expect.objectContaining({ operation: 'page_render' }),
    )
  })

  it('clears the error state and re-renders children when "Try again" is clicked', () => {
    let shouldThrow = true
    function Flaky() {
      if (shouldThrow) throw new Error('boom')
      return <div>recovered</div>
    }

    render(
      <PageErrorBoundary>
        <Flaky />
      </PageErrorBoundary>,
    )
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()

    shouldThrow = false
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))

    expect(screen.getByText('recovered')).toBeInTheDocument()
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument()
  })
})
