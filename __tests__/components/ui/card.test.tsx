import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
  CardContent,
  CardFooter,
} from '@/components/ui/card'

// ─── Card ─────────────────────────────────────────────────────────────────────

describe('Card', () => {
  describe('data-slot attribute', () => {
    it('has data-slot="card"', () => {
      const { container } = render(<Card>content</Card>)
      const el = container.querySelector('[data-slot="card"]')
      expect(el).toBeInTheDocument()
    })
  })

  describe('data-size attribute', () => {
    it('defaults data-size to "default"', () => {
      const { container } = render(<Card>content</Card>)
      const el = container.querySelector('[data-slot="card"]')
      expect(el).toHaveAttribute('data-size', 'default')
    })

    it('sets data-size="sm" when size prop is "sm"', () => {
      const { container } = render(<Card size="sm">content</Card>)
      const el = container.querySelector('[data-slot="card"]')
      expect(el).toHaveAttribute('data-size', 'sm')
    })

    it('sets data-size="default" when size prop is explicitly "default"', () => {
      const { container } = render(<Card size="default">content</Card>)
      const el = container.querySelector('[data-slot="card"]')
      expect(el).toHaveAttribute('data-size', 'default')
    })
  })

  describe('children', () => {
    it('renders children', () => {
      render(<Card>Hello Card</Card>)
      expect(screen.getByText('Hello Card')).toBeInTheDocument()
    })
  })

  describe('className', () => {
    it('merges a custom className', () => {
      const { container } = render(<Card className="custom-card">content</Card>)
      const el = container.querySelector('[data-slot="card"]')
      expect(el?.className).toContain('custom-card')
    })

    it('keeps built-in rounded-xl class when custom className is added', () => {
      const { container } = render(<Card className="my-class">content</Card>)
      const el = container.querySelector('[data-slot="card"]')
      expect(el?.className).toContain('rounded-xl')
    })
  })

  describe('HTML attribute passthrough', () => {
    it('passes arbitrary HTML attributes through', () => {
      const { container } = render(<Card aria-label="stream card">content</Card>)
      const el = container.querySelector('[data-slot="card"]')
      expect(el).toHaveAttribute('aria-label', 'stream card')
    })
  })
})

// ─── CardHeader ───────────────────────────────────────────────────────────────

describe('CardHeader', () => {
  it('has data-slot="card-header"', () => {
    const { container } = render(<CardHeader>header</CardHeader>)
    const el = container.querySelector('[data-slot="card-header"]')
    expect(el).toBeInTheDocument()
  })

  it('renders children', () => {
    render(<CardHeader>Header Content</CardHeader>)
    expect(screen.getByText('Header Content')).toBeInTheDocument()
  })

  it('merges a custom className', () => {
    const { container } = render(<CardHeader className="my-header">header</CardHeader>)
    const el = container.querySelector('[data-slot="card-header"]')
    expect(el?.className).toContain('my-header')
  })

  it('passes arbitrary HTML attributes through', () => {
    const { container } = render(<CardHeader id="card-hdr">header</CardHeader>)
    const el = container.querySelector('[data-slot="card-header"]')
    expect(el).toHaveAttribute('id', 'card-hdr')
  })
})

// ─── CardTitle ────────────────────────────────────────────────────────────────

describe('CardTitle', () => {
  it('has data-slot="card-title"', () => {
    const { container } = render(<CardTitle>Title</CardTitle>)
    const el = container.querySelector('[data-slot="card-title"]')
    expect(el).toBeInTheDocument()
  })

  it('renders children', () => {
    render(<CardTitle>My Stream</CardTitle>)
    expect(screen.getByText('My Stream')).toBeInTheDocument()
  })

  it('merges a custom className', () => {
    const { container } = render(<CardTitle className="title-custom">Title</CardTitle>)
    const el = container.querySelector('[data-slot="card-title"]')
    expect(el?.className).toContain('title-custom')
  })

  it('has font-medium class by default', () => {
    const { container } = render(<CardTitle>Title</CardTitle>)
    const el = container.querySelector('[data-slot="card-title"]')
    expect(el?.className).toContain('font-medium')
  })
})

// ─── CardDescription ──────────────────────────────────────────────────────────

describe('CardDescription', () => {
  it('has data-slot="card-description"', () => {
    const { container } = render(<CardDescription>desc</CardDescription>)
    const el = container.querySelector('[data-slot="card-description"]')
    expect(el).toBeInTheDocument()
  })

  it('renders children', () => {
    render(<CardDescription>Some description</CardDescription>)
    expect(screen.getByText('Some description')).toBeInTheDocument()
  })

  it('merges a custom className', () => {
    const { container } = render(<CardDescription className="desc-cls">desc</CardDescription>)
    const el = container.querySelector('[data-slot="card-description"]')
    expect(el?.className).toContain('desc-cls')
  })

  it('has text-muted-foreground class by default', () => {
    const { container } = render(<CardDescription>desc</CardDescription>)
    const el = container.querySelector('[data-slot="card-description"]')
    expect(el?.className).toContain('text-muted-foreground')
  })
})

// ─── CardAction ───────────────────────────────────────────────────────────────

describe('CardAction', () => {
  it('has data-slot="card-action"', () => {
    const { container } = render(<CardAction>action</CardAction>)
    const el = container.querySelector('[data-slot="card-action"]')
    expect(el).toBeInTheDocument()
  })

  it('renders children', () => {
    render(<CardAction><button>Click me</button></CardAction>)
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument()
  })

  it('merges a custom className', () => {
    const { container } = render(<CardAction className="action-cls">action</CardAction>)
    const el = container.querySelector('[data-slot="card-action"]')
    expect(el?.className).toContain('action-cls')
  })

  it('has col-start-2 layout class by default', () => {
    const { container } = render(<CardAction>action</CardAction>)
    const el = container.querySelector('[data-slot="card-action"]')
    expect(el?.className).toContain('col-start-2')
  })
})

// ─── CardContent ──────────────────────────────────────────────────────────────

describe('CardContent', () => {
  it('has data-slot="card-content"', () => {
    const { container } = render(<CardContent>body</CardContent>)
    const el = container.querySelector('[data-slot="card-content"]')
    expect(el).toBeInTheDocument()
  })

  it('renders children', () => {
    render(<CardContent>Card Body Text</CardContent>)
    expect(screen.getByText('Card Body Text')).toBeInTheDocument()
  })

  it('merges a custom className', () => {
    const { container } = render(<CardContent className="body-cls">body</CardContent>)
    const el = container.querySelector('[data-slot="card-content"]')
    expect(el?.className).toContain('body-cls')
  })

  it('passes arbitrary HTML attributes through', () => {
    const { container } = render(<CardContent data-testid="card-body">body</CardContent>)
    const el = container.querySelector('[data-slot="card-content"]')
    expect(el).toHaveAttribute('data-testid', 'card-body')
  })
})

// ─── CardFooter ───────────────────────────────────────────────────────────────

describe('CardFooter', () => {
  it('has data-slot="card-footer"', () => {
    const { container } = render(<CardFooter>footer</CardFooter>)
    const el = container.querySelector('[data-slot="card-footer"]')
    expect(el).toBeInTheDocument()
  })

  it('renders children', () => {
    render(<CardFooter>Footer Text</CardFooter>)
    expect(screen.getByText('Footer Text')).toBeInTheDocument()
  })

  it('merges a custom className', () => {
    const { container } = render(<CardFooter className="footer-cls">footer</CardFooter>)
    const el = container.querySelector('[data-slot="card-footer"]')
    expect(el?.className).toContain('footer-cls')
  })

  it('has border-t class by default', () => {
    const { container } = render(<CardFooter>footer</CardFooter>)
    const el = container.querySelector('[data-slot="card-footer"]')
    expect(el?.className).toContain('border-t')
  })

  it('has rounded-b-xl class by default', () => {
    const { container } = render(<CardFooter>footer</CardFooter>)
    const el = container.querySelector('[data-slot="card-footer"]')
    expect(el?.className).toContain('rounded-b-xl')
  })

  it('passes arbitrary HTML attributes through', () => {
    const { container } = render(<CardFooter role="contentinfo">footer</CardFooter>)
    const el = container.querySelector('[data-slot="card-footer"]')
    expect(el).toHaveAttribute('role', 'contentinfo')
  })
})

// ─── Composed Card ───────────────────────────────────────────────────────────

describe('Composed Card', () => {
  it('renders a full card with all sub-components', () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Stream to Alice</CardTitle>
          <CardDescription>Monthly salary</CardDescription>
          <CardAction><button>Cancel</button></CardAction>
        </CardHeader>
        <CardContent>100 USDC / month</CardContent>
        <CardFooter>Ends Jan 2026</CardFooter>
      </Card>,
    )

    expect(screen.getByText('Stream to Alice')).toBeInTheDocument()
    expect(screen.getByText('Monthly salary')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
    expect(screen.getByText('100 USDC / month')).toBeInTheDocument()
    expect(screen.getByText('Ends Jan 2026')).toBeInTheDocument()
  })

  it('each sub-component carries the correct data-slot in a composed tree', () => {
    const { container } = render(
      <Card>
        <CardHeader>
          <CardTitle>Title</CardTitle>
        </CardHeader>
        <CardContent>Body</CardContent>
        <CardFooter>Footer</CardFooter>
      </Card>,
    )

    expect(container.querySelector('[data-slot="card"]')).toBeInTheDocument()
    expect(container.querySelector('[data-slot="card-header"]')).toBeInTheDocument()
    expect(container.querySelector('[data-slot="card-title"]')).toBeInTheDocument()
    expect(container.querySelector('[data-slot="card-content"]')).toBeInTheDocument()
    expect(container.querySelector('[data-slot="card-footer"]')).toBeInTheDocument()
  })
})
