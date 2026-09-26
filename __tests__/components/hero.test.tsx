import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { LandingHeader, Hero } from '@/components/landing/hero'

// ─── module mocks ────────────────────────────────────────────────────────────

vi.mock('next/link', () => ({
  default: ({ href, children, className, ...props }: any) => (
    <a href={href} className={className} {...props}>
      {children}
    </a>
  ),
}))

vi.mock('lucide-react', () => ({
  ArrowRight: () => <svg data-testid="arrow-right-icon" />,
  Menu: () => <svg data-testid="menu-icon" />,
  X: () => <svg data-testid="x-icon" />,
}))

vi.mock('@/components/brand', () => ({
  Brand: () => <div data-testid="brand" />,
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, asChild, nativeButton, size, variant, ...props }: any) => {
    if (asChild) {
      // forward button-like props to the single child
      const child = React.Children.only(children) as React.ReactElement
      return React.cloneElement(child, props)
    }
    return <button {...props}>{children}</button>
  },
}))

vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children, open, onOpenChange }: any) => (
    <div data-testid="dropdown-menu" data-open={open}>
      {React.Children.map(children, (child) =>
        React.cloneElement(child as React.ReactElement, { _onOpenChange: onOpenChange }),
      )}
    </div>
  ),
  DropdownMenuTrigger: ({ children, asChild, _onOpenChange, ...props }: any) => {
    if (asChild) {
      const child = React.Children.only(children) as React.ReactElement
      return React.cloneElement(child, {
        ...props,
        onClick: () => _onOpenChange?.(true),
      })
    }
    return (
      <button data-testid="dropdown-trigger" onClick={() => _onOpenChange?.(true)} {...props}>
        {children}
      </button>
    )
  },
  DropdownMenuContent: ({ children }: any) => (
    <div data-testid="dropdown-content">{children}</div>
  ),
  DropdownMenuItem: ({ children, render: renderProp }: any) =>
    renderProp ? (
      <div data-testid="dropdown-item">{renderProp}</div>
    ) : (
      <div data-testid="dropdown-item">{children}</div>
    ),
}))

vi.mock('@/components/landing/live-stream-preview', () => ({
  LiveStreamPreview: () => <div data-testid="live-stream-preview" />,
}))

// ─── LandingHeader ───────────────────────────────────────────────────────────

describe('LandingHeader', () => {
  it('renders the Brand logo', () => {
    render(<LandingHeader />)
    expect(screen.getByTestId('brand')).toBeInTheDocument()
  })

  it('renders all desktop nav links', () => {
    render(<LandingHeader />)
    expect(screen.getByRole('link', { name: 'Features' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'How it works' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Use cases' })).toBeInTheDocument()
  })

  it('desktop nav links point to the correct hash anchors', () => {
    render(<LandingHeader />)
    expect(screen.getByRole('link', { name: 'Features' })).toHaveAttribute('href', '#features')
    expect(screen.getByRole('link', { name: 'How it works' })).toHaveAttribute('href', '#how')
    expect(screen.getByRole('link', { name: 'Use cases' })).toHaveAttribute('href', '#use-cases')
  })

  it('renders the "Open app" CTA link pointing to /app', () => {
    render(<LandingHeader />)
    expect(screen.getByRole('link', { name: /open app/i })).toHaveAttribute('href', '/app')
  })

  // ─── mobile nav ────────────────────────────────────────────────────────────

  it('renders the mobile nav trigger button with correct aria-label', () => {
    render(<LandingHeader />)
    expect(
      screen.getByRole('button', { name: 'Open navigation menu' }),
    ).toBeInTheDocument()
  })

  it('shows the Menu icon when mobile nav is closed', () => {
    render(<LandingHeader />)
    expect(screen.getByTestId('menu-icon')).toBeInTheDocument()
    expect(screen.queryByTestId('x-icon')).not.toBeInTheDocument()
  })

  it('opens the mobile dropdown when the trigger is clicked', () => {
    render(<LandingHeader />)
    const trigger = screen.getByRole('button', { name: 'Open navigation menu' })
    fireEvent.click(trigger)
    expect(screen.getByTestId('dropdown-content')).toBeInTheDocument()
  })

  it('shows the X icon after the mobile nav opens', () => {
    render(<LandingHeader />)
    fireEvent.click(screen.getByRole('button', { name: 'Open navigation menu' }))
    expect(screen.getByTestId('x-icon')).toBeInTheDocument()
    expect(screen.queryByTestId('menu-icon')).not.toBeInTheDocument()
  })

  it('mobile dropdown contains all nav link items', () => {
    render(<LandingHeader />)
    fireEvent.click(screen.getByRole('button', { name: 'Open navigation menu' }))
    const items = screen.getAllByTestId('dropdown-item')
    const labels = items.map((el) => el.textContent)
    expect(labels).toContain('Features')
    expect(labels).toContain('How it works')
    expect(labels).toContain('Use cases')
  })

  it('renders inside a <header> element', () => {
    const { container } = render(<LandingHeader />)
    expect(container.querySelector('header')).toBeInTheDocument()
  })

  it('header has z-30 for stacking above page content', () => {
    const { container } = render(<LandingHeader />)
    expect(container.querySelector('header')).toHaveClass('z-30')
  })
})

// ─── Hero ────────────────────────────────────────────────────────────────────

describe('Hero', () => {
  it('renders the main headline', () => {
    render(<Hero />)
    expect(
      screen.getByRole('heading', { level: 1, name: /stream money by the second/i }),
    ).toBeInTheDocument()
  })

  it('renders the subheading / description copy', () => {
    render(<Hero />)
    expect(screen.getByText(/continuous streams/i)).toBeInTheDocument()
  })

  it('renders the "Create a stream" CTA link pointing to /app/create', () => {
    render(<Hero />)
    expect(screen.getByRole('link', { name: /create a stream/i })).toHaveAttribute(
      'href',
      '/app/create',
    )
  })

  it('renders the "Open dashboard" secondary CTA link pointing to /app', () => {
    render(<Hero />)
    expect(screen.getByRole('link', { name: /open dashboard/i })).toHaveAttribute('href', '/app')
  })

  it('renders the "Built on Stellar & Soroban" badge', () => {
    render(<Hero />)
    expect(screen.getByText(/Built on Stellar/i)).toBeInTheDocument()
  })

  it('renders the tagline footnote', () => {
    render(<Hero />)
    expect(screen.getByText(/No code · Non-custodial · Testnet ready/i)).toBeInTheDocument()
  })

  it('renders the LiveStreamPreview widget', () => {
    render(<Hero />)
    expect(screen.getByTestId('live-stream-preview')).toBeInTheDocument()
  })

  it('wraps everything in a <section>', () => {
    const { container } = render(<Hero />)
    expect(container.querySelector('section')).toBeInTheDocument()
  })
})
