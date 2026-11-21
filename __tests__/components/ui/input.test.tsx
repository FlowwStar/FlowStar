/**
 * Tests for components/ui/input.tsx  (closes #755)
 *
 * Covers the three behaviours requested in the issue:
 *   1. Value changes fire onChange
 *   2. Disabled state applies the expected attributes / classes
 *   3. Invalid (aria-invalid) state applies the expected attributes / classes
 *
 * Implementation notes
 * ─────────────────────
 * The Input component wraps @base-ui/react's InputPrimitive but ultimately
 * renders a native <input> element, so we can use the standard
 * @testing-library/user-event API directly.
 *
 * Disabled / aria-invalid styling is applied via Tailwind utility classes
 * that are present in the className string; we assert those key tokens
 * rather than attempting to match computed CSS, which jsdom does not support.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Input } from '@/components/ui/input'
import React from 'react'

// ─── Rendering ────────────────────────────────────────────────────────────────

describe('Input rendering', () => {
  it('renders an input element', () => {
    render(<Input />)
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('forwards the type prop to the underlying input', () => {
    render(<Input type="email" aria-label="email" />)
    const input = screen.getByRole('textbox', { name: 'email' })
    expect(input).toHaveAttribute('type', 'email')
  })

  it('forwards arbitrary props such as placeholder to the underlying input', () => {
    render(<Input placeholder="Enter value" />)
    expect(screen.getByPlaceholderText('Enter value')).toBeInTheDocument()
  })

  it('carries the data-slot="input" attribute', () => {
    render(<Input aria-label="test" />)
    const input = screen.getByRole('textbox', { name: 'test' })
    expect(input).toHaveAttribute('data-slot', 'input')
  })

  it('merges custom className with the built-in classes', () => {
    const { container } = render(<Input className="my-custom-class" />)
    const input = container.querySelector('input')
    expect(input?.className).toContain('my-custom-class')
    // base classes should still be present
    expect(input?.className).toContain('rounded-lg')
  })
})

// ─── onChange — value changes ─────────────────────────────────────────────────

describe('Input onChange behaviour', () => {
  it('fires onChange when the user types into the input', async () => {
    const user = userEvent.setup()
    const handleChange = vi.fn()

    render(<Input onChange={handleChange} />)
    const input = screen.getByRole('textbox')

    await user.type(input, 'hello')

    // One event per keystroke — at least 5 calls for 'h','e','l','l','o'
    expect(handleChange).toHaveBeenCalled()
    expect(handleChange.mock.calls.length).toBeGreaterThanOrEqual(5)
  })

  it('calls onChange with the correct event target value', async () => {
    const user = userEvent.setup()
    const handleChange = vi.fn()

    render(<Input onChange={handleChange} />)
    await user.type(screen.getByRole('textbox'), 'abc')

    // The last call's event target should reflect the accumulated value
    const lastEvent = handleChange.mock.calls.at(-1)?.[0] as React.ChangeEvent<HTMLInputElement>
    expect(lastEvent.target.value).toBe('abc')
  })

  it('does not fire onChange when the input is disabled', async () => {
    const user = userEvent.setup()
    const handleChange = vi.fn()

    render(<Input disabled onChange={handleChange} />)
    const input = screen.getByRole('textbox')

    await user.type(input, 'test')

    expect(handleChange).not.toHaveBeenCalled()
  })

  it('reflects the value from a controlled input correctly', async () => {
    const user = userEvent.setup()
    let controlled = ''
    const handleChange = vi.fn((e: React.ChangeEvent<HTMLInputElement>) => {
      controlled = e.target.value
    })

    const { rerender } = render(<Input value={controlled} onChange={handleChange} />)

    await user.type(screen.getByRole('textbox'), 'x')
    rerender(<Input value={controlled} onChange={handleChange} />)

    expect(screen.getByRole('textbox')).toHaveValue(controlled)
  })
})

// ─── Disabled state ───────────────────────────────────────────────────────────

describe('Input disabled state', () => {
  it('renders the input with the disabled attribute', () => {
    render(<Input disabled />)
    expect(screen.getByRole('textbox')).toBeDisabled()
  })

  it('applies disabled utility classes to the element', () => {
    const { container } = render(<Input disabled />)
    const input = container.querySelector('input')
    // The component includes these Tailwind tokens for disabled styling
    expect(input?.className).toContain('disabled:pointer-events-none')
    expect(input?.className).toContain('disabled:opacity-50')
  })

  it('applies cursor-not-allowed class when disabled', () => {
    const { container } = render(<Input disabled />)
    const input = container.querySelector('input')
    expect(input?.className).toContain('disabled:cursor-not-allowed')
  })
})

// ─── Invalid / aria-invalid state ────────────────────────────────────────────

describe('Input invalid state', () => {
  it('sets aria-invalid attribute when the prop is passed', () => {
    render(<Input aria-invalid="true" aria-label="invalid-input" />)
    const input = screen.getByRole('textbox', { name: 'invalid-input' })
    expect(input).toHaveAttribute('aria-invalid', 'true')
  })

  it('applies aria-invalid ring utility classes', () => {
    const { container } = render(<Input aria-invalid="true" />)
    const input = container.querySelector('input')
    expect(input?.className).toContain('aria-invalid:border-destructive')
    expect(input?.className).toContain('aria-invalid:ring-destructive/20')
  })

  it('does not carry aria-invalid when the prop is not set', () => {
    render(<Input aria-label="normal-input" />)
    const input = screen.getByRole('textbox', { name: 'normal-input' })
    // aria-invalid should be absent or falsy by default
    const val = input.getAttribute('aria-invalid')
    expect(val === null || val === 'false').toBe(true)
  })
})
