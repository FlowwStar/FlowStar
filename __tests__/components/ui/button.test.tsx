import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Button, buttonVariants } from '@/components/ui/button'
import React from 'react'

describe('Button', () => {
  describe('variants', () => {
    it('renders default variant with correct classes', () => {
      const { container } = render(<Button>Default</Button>)
      const button = container.querySelector('button')
      expect(button?.className).toContain('bg-primary')
      expect(button?.className).toContain('text-primary-foreground')
    })

    it('renders outline variant with correct classes', () => {
      const { container } = render(<Button variant="outline">Outline</Button>)
      const button = container.querySelector('button')
      expect(button?.className).toContain('border-border')
      expect(button?.className).toContain('bg-background')
    })

    it('renders secondary variant with correct classes', () => {
      const { container } = render(<Button variant="secondary">Secondary</Button>)
      const button = container.querySelector('button')
      expect(button?.className).toContain('bg-secondary')
      expect(button?.className).toContain('text-secondary-foreground')
    })

    it('renders ghost variant with correct classes', () => {
      const { container } = render(<Button variant="ghost">Ghost</Button>)
      const button = container.querySelector('button')
      expect(button?.className).toContain('hover:bg-muted')
    })

    it('renders destructive variant with correct classes', () => {
      const { container } = render(<Button variant="destructive">Destructive</Button>)
      const button = container.querySelector('button')
      expect(button?.className).toContain('bg-destructive/10')
      expect(button?.className).toContain('text-destructive')
    })

    it('renders link variant with correct classes', () => {
      const { container } = render(<Button variant="link">Link</Button>)
      const button = container.querySelector('button')
      expect(button?.className).toContain('text-primary')
      expect(button?.className).toContain('underline-offset-4')
    })
  })

  describe('sizes', () => {
    it('renders default size with correct classes', () => {
      const { container } = render(<Button size="default">Default</Button>)
      const button = container.querySelector('button')
      expect(button?.className).toContain('h-8')
      expect(button?.className).toContain('gap-1.5')
      expect(button?.className).toContain('px-2.5')
    })

    it('renders xs size with correct classes', () => {
      const { container } = render(<Button size="xs">XS</Button>)
      const button = container.querySelector('button')
      expect(button?.className).toContain('h-6')
      expect(button?.className).toContain('text-xs')
    })

    it('renders sm size with correct classes', () => {
      const { container } = render(<Button size="sm">SM</Button>)
      const button = container.querySelector('button')
      expect(button?.className).toContain('h-7')
      expect(button?.className).toContain('text-[0.8rem]')
    })

    it('renders lg size with correct classes', () => {
      const { container } = render(<Button size="lg">LG</Button>)
      const button = container.querySelector('button')
      expect(button?.className).toContain('h-9')
    })

    it('renders icon size with correct classes', () => {
      const { container } = render(<Button size="icon">I</Button>)
      const button = container.querySelector('button')
      expect(button?.className).toContain('size-8')
    })

    it('renders icon-xs size with correct classes', () => {
      const { container } = render(<Button size="icon-xs">I</Button>)
      const button = container.querySelector('button')
      expect(button?.className).toContain('size-6')
    })

    it('renders icon-sm size with correct classes', () => {
      const { container } = render(<Button size="icon-sm">I</Button>)
      const button = container.querySelector('button')
      expect(button?.className).toContain('size-7')
    })

    it('renders icon-lg size with correct classes', () => {
      const { container } = render(<Button size="icon-lg">I</Button>)
      const button = container.querySelector('button')
      expect(button?.className).toContain('size-9')
    })
  })

  describe('asChild prop', () => {
    it('renders child element when asChild is true', () => {
      const { container } = render(
        <Button asChild>
          <a href="/test">Link Button</a>
        </Button>
      )
      const link = container.querySelector('a')
      expect(link).toBeInTheDocument()
      expect(link?.href).toContain('/test')
      expect(link?.textContent).toBe('Link Button')
    })

    it('applies Button styles to child element when asChild is true', () => {
      const { container } = render(
        <Button variant="secondary" size="sm" asChild>
          <a href="/test">Link Button</a>
        </Button>
      )
      const link = container.querySelector('a')
      expect(link?.className).toContain('bg-secondary')
      expect(link?.className).toContain('text-secondary-foreground')
    })

    it('renders native button when asChild is false', () => {
      const { container } = render(<Button>Native Button</Button>)
      const button = container.querySelector('button')
      expect(button).toBeInTheDocument()
      expect(button?.textContent).toBe('Native Button')
    })
  })

  describe('disabled state', () => {
    it('renders disabled button with correct attributes', () => {
      const { container } = render(<Button disabled>Disabled</Button>)
      const button = container.querySelector('button') as HTMLButtonElement
      expect(button.disabled).toBe(true)
      expect(button.className).toContain('disabled:opacity-50')
    })

    it('applies disabled styles', () => {
      const { container } = render(<Button disabled>Disabled</Button>)
      const button = container.querySelector('button')
      expect(button?.className).toContain('disabled:pointer-events-none')
    })
  })

  describe('buttonVariants CVA', () => {
    it('generates correct classes for variant and size combination', () => {
      const classes = buttonVariants({ variant: 'outline', size: 'lg' })
      expect(classes).toContain('border-border')
      expect(classes).toContain('h-9')
    })

    it('uses default variant and size when none specified', () => {
      const classes = buttonVariants({})
      expect(classes).toContain('bg-primary')
      expect(classes).toContain('h-8')
    })
  })
})
