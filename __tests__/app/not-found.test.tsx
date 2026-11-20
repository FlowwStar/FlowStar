import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import NotFound from '@/app/not-found'

describe('NotFound page', () => {
  it('renders the not-found heading and explanatory copy', () => {
    render(<NotFound />)

    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument()
    expect(
      screen.getByText("The page you're looking for doesn't exist or has been moved."),
    ).toBeInTheDocument()
  })

  it('provides links back home and to the dashboard', () => {
    render(<NotFound />)

    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(2)
    expect(links[0]).toHaveTextContent('Go home')
    expect(links[0]).toHaveAttribute('href', '/')
    expect(links[1]).toHaveTextContent('Back to dashboard')
    expect(links[1]).toHaveAttribute('href', '/')
  })
})
