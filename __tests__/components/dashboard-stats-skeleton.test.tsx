import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DashboardStatsSkeleton } from '@/components/streams/dashboard-stats'

describe('DashboardStatsSkeleton', () => {
  it('renders the expected number of placeholder cards', () => {
    const { container } = render(<DashboardStatsSkeleton />)
    const cards = container.querySelectorAll('.rounded-2xl.border')
    expect(cards).toHaveLength(4)
  })

  it('placeholder cards have animate-pulse class', () => {
    const { container } = render(<DashboardStatsSkeleton />)
    const cards = container.querySelectorAll('.animate-pulse')
    expect(cards.length).toBeGreaterThanOrEqual(4)
  })

  it('placeholders contain loading bars for label, value, and hint', () => {
    const { container } = render(<DashboardStatsSkeleton />)
    const cards = container.querySelectorAll('.rounded-2xl.border')
    
    cards.forEach(card => {
      const loadingBars = card.querySelectorAll('.bg-muted')
      expect(loadingBars.length).toBe(3) // label, value, hint
    })
  })

  it('skeleton does not contain text content', () => {
    const { container } = render(<DashboardStatsSkeleton />)
    const textContent = container.textContent
    expect(textContent).toBe('')
  })
})
