/**
 * Tests for components/ui/label.tsx  (closes #756)
 *
 * Asserts that a Label with htmlFor correctly associates with its paired
 * input — clicking the label focuses the input.
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Label } from '@/components/ui/label'
import React from 'react'

describe('Label', () => {
  it('renders a label element', () => {
    render(<Label>Name</Label>)
    expect(screen.getByText('Name')).toBeInTheDocument()
  })

  it('carries the data-slot="label" attribute', () => {
    render(<Label>Email</Label>)
    const label = screen.getByText('Email')
    expect(label).toHaveAttribute('data-slot', 'label')
  })

  it('sets the htmlFor attribute on the label element', () => {
    render(<Label htmlFor="username">Username</Label>)
    const label = screen.getByText('Username')
    expect(label).toHaveAttribute('for', 'username')
  })

  it('focuses the paired input when the label is clicked', async () => {
    const user = userEvent.setup()

    render(
      <>
        <Label htmlFor="test-input">Click me</Label>
        <input id="test-input" />
      </>
    )

    await user.click(screen.getByText('Click me'))
    expect(document.getElementById('test-input')).toHaveFocus()
  })

  it('merges custom className with built-in classes', () => {
    const { container } = render(<Label className="custom-class">Label</Label>)
    const label = container.querySelector('label')
    expect(label?.className).toContain('custom-class')
    expect(label?.className).toContain('text-sm')
  })

  it('renders children correctly', () => {
    render(<Label htmlFor="field">First Name</Label>)
    expect(screen.getByText('First Name')).toBeInTheDocument()
  })
})
