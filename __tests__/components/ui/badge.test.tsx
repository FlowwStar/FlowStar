import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import { Badge, badgeVariants } from '@/components/ui/badge'

// ─── Badge ────────────────────────────────────────────────────────────────────

describe('Badge', () => {
  // ─── base classes ───────────────────────────────────────────────────────────

  describe('base classes', () => {
    it('renders a <span> by default', () => {
      const { container } = render(<Badge>Label</Badge>)
      expect(container.querySelector('span')).toBeInTheDocument()
    })

    it('has inline-flex class', () => {
      const { container } = render(<Badge>Label</Badge>)
      const el = container.querySelector('span')
      expect(el?.className).toContain('inline-flex')
    })

    it('has h-5 class', () => {
      const { container } = render(<Badge>Label</Badge>)
      const el = container.querySelector('span')
      expect(el?.className).toContain('h-5')
    })

    it('has text-xs class', () => {
      const { container } = render(<Badge>Label</Badge>)
      const el = container.querySelector('span')
      expect(el?.className).toContain('text-xs')
    })

    it('has font-medium class', () => {
      const { container } = render(<Badge>Label</Badge>)
      const el = container.querySelector('span')
      expect(el?.className).toContain('font-medium')
    })

    it('has rounded-4xl class', () => {
      const { container } = render(<Badge>Label</Badge>)
      const el = container.querySelector('span')
      expect(el?.className).toContain('rounded-4xl')
    })

    it('has whitespace-nowrap class', () => {
      const { container } = render(<Badge>Label</Badge>)
      const el = container.querySelector('span')
      expect(el?.className).toContain('whitespace-nowrap')
    })

    it('renders children', () => {
      render(<Badge>Active</Badge>)
      expect(screen.getByText('Active')).toBeInTheDocument()
    })
  })

  // ─── variants ───────────────────────────────────────────────────────────────

  describe('variants', () => {
    it('renders default variant (bg-primary) when no variant is provided', () => {
      const { container } = render(<Badge>Default</Badge>)
      const el = container.querySelector('span')
      expect(el?.className).toContain('bg-primary')
      expect(el?.className).toContain('text-primary-foreground')
    })

    it('renders default variant explicitly', () => {
      const { container } = render(<Badge variant="default">Default</Badge>)
      const el = container.querySelector('span')
      expect(el?.className).toContain('bg-primary')
      expect(el?.className).toContain('text-primary-foreground')
    })

    it('renders secondary variant with correct classes', () => {
      const { container } = render(<Badge variant="secondary">Secondary</Badge>)
      const el = container.querySelector('span')
      expect(el?.className).toContain('bg-secondary')
      expect(el?.className).toContain('text-secondary-foreground')
    })

    it('renders destructive variant with correct classes', () => {
      const { container } = render(<Badge variant="destructive">Destructive</Badge>)
      const el = container.querySelector('span')
      expect(el?.className).toContain('bg-destructive/10')
      expect(el?.className).toContain('text-destructive')
    })

    it('renders outline variant with correct classes', () => {
      const { container } = render(<Badge variant="outline">Outline</Badge>)
      const el = container.querySelector('span')
      expect(el?.className).toContain('border-border')
      expect(el?.className).toContain('text-foreground')
    })

    it('renders ghost variant with correct classes', () => {
      const { container } = render(<Badge variant="ghost">Ghost</Badge>)
      const el = container.querySelector('span')
      expect(el?.className).toContain('hover:bg-muted')
      expect(el?.className).toContain('hover:text-muted-foreground')
    })

    it('renders link variant with correct classes', () => {
      const { container } = render(<Badge variant="link">Link</Badge>)
      const el = container.querySelector('span')
      expect(el?.className).toContain('text-primary')
      expect(el?.className).toContain('underline-offset-4')
    })

    it.each([
      ['default', 'bg-primary'],
      ['secondary', 'bg-secondary'],
      ['destructive', 'bg-destructive/10'],
      ['outline', 'border-border'],
      ['ghost', 'hover:bg-muted'],
      ['link', 'underline-offset-4'],
    ] as const)(
      'variant "%s" includes class "%s"',
      (variant, expectedClass) => {
        const { container } = render(<Badge variant={variant}>{variant}</Badge>)
        const el = container.querySelector('span')
        expect(el?.className).toContain(expectedClass)
      },
    )
  })

  // ─── className merging ───────────────────────────────────────────────────────

  describe('className merging', () => {
    it('merges a custom className with variant classes', () => {
      const { container } = render(<Badge className="custom-badge">Label</Badge>)
      const el = container.querySelector('span')
      expect(el?.className).toContain('custom-badge')
      expect(el?.className).toContain('bg-primary') // default variant still present
    })

    it('preserves base classes when a custom className is added', () => {
      const { container } = render(<Badge className="my-extra">Label</Badge>)
      const el = container.querySelector('span')
      expect(el?.className).toContain('inline-flex')
      expect(el?.className).toContain('my-extra')
    })
  })

  // ─── render prop (polymorphic element) ──────────────────────────────────────

  describe('render prop', () => {
    it('renders an <a> tag when render prop overrides the tag', () => {
      const { container } = render(
        <Badge render={<a href="/status" />}>View Status</Badge>,
      )
      const link = container.querySelector('a')
      expect(link).toBeInTheDocument()
      expect(link?.href).toContain('/status')
    })

    it('applies Badge classes to the rendered <a> tag', () => {
      const { container } = render(
        <Badge variant="secondary" render={<a href="/test" />}>
          Link Badge
        </Badge>,
      )
      const link = container.querySelector('a')
      expect(link?.className).toContain('bg-secondary')
      expect(link?.className).toContain('inline-flex')
    })

    it('renders children inside the custom element', () => {
      render(
        <Badge render={<a href="/path" />}>Go Here</Badge>,
      )
      expect(screen.getByText('Go Here')).toBeInTheDocument()
    })
  })

  // ─── HTML attribute passthrough ──────────────────────────────────────────────

  describe('HTML attribute passthrough', () => {
    it('passes aria-label to the span', () => {
      const { container } = render(<Badge aria-label="status badge">Active</Badge>)
      const el = container.querySelector('span')
      expect(el).toHaveAttribute('aria-label', 'status badge')
    })

    it('passes data attributes through', () => {
      const { container } = render(<Badge data-testid="my-badge">Label</Badge>)
      const el = container.querySelector('span')
      expect(el).toHaveAttribute('data-testid', 'my-badge')
    })
  })
})

// ─── badgeVariants CVA ────────────────────────────────────────────────────────

describe('badgeVariants CVA', () => {
  it('generates correct classes for default variant', () => {
    const classes = badgeVariants({ variant: 'default' })
    expect(classes).toContain('bg-primary')
    expect(classes).toContain('text-primary-foreground')
    expect(classes).toContain('inline-flex')
  })

  it('generates correct classes for secondary variant', () => {
    const classes = badgeVariants({ variant: 'secondary' })
    expect(classes).toContain('bg-secondary')
    expect(classes).toContain('text-secondary-foreground')
  })

  it('generates correct classes for destructive variant', () => {
    const classes = badgeVariants({ variant: 'destructive' })
    expect(classes).toContain('bg-destructive/10')
    expect(classes).toContain('text-destructive')
  })

  it('generates correct classes for outline variant', () => {
    const classes = badgeVariants({ variant: 'outline' })
    expect(classes).toContain('border-border')
    expect(classes).toContain('text-foreground')
  })

  it('generates correct classes for ghost variant', () => {
    const classes = badgeVariants({ variant: 'ghost' })
    expect(classes).toContain('hover:bg-muted')
  })

  it('generates correct classes for link variant', () => {
    const classes = badgeVariants({ variant: 'link' })
    expect(classes).toContain('text-primary')
    expect(classes).toContain('underline-offset-4')
  })

  it('uses default variant when none specified', () => {
    const classes = badgeVariants({})
    expect(classes).toContain('bg-primary')
  })

  it('always includes base inline-flex class regardless of variant', () => {
    const variants = ['default', 'secondary', 'destructive', 'outline', 'ghost', 'link'] as const
    for (const variant of variants) {
      const classes = badgeVariants({ variant })
      expect(classes).toContain('inline-flex')
    }
  })

  it('always includes h-5 class regardless of variant', () => {
    const variants = ['default', 'secondary', 'destructive', 'outline', 'ghost', 'link'] as const
    for (const variant of variants) {
      const classes = badgeVariants({ variant })
      expect(classes).toContain('h-5')
    }
  })
})
