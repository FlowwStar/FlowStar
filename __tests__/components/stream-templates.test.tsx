import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { STREAM_TEMPLATES, StreamTemplates } from '@/components/streams/stream-templates'

describe('StreamTemplates', () => {
  it('renders all four templates', () => {
    render(<StreamTemplates onSelect={vi.fn()} />)

    for (const template of STREAM_TEMPLATES) {
      expect(screen.getByRole('button', { name: new RegExp(template.name) })).toBeInTheDocument()
    }
  })

  it('selects the clicked template object', () => {
    const onSelect = vi.fn()
    render(<StreamTemplates onSelect={onSelect} />)

    fireEvent.click(screen.getByRole('button', { name: /Token Vesting/ }))
    expect(onSelect).toHaveBeenCalledWith(STREAM_TEMPLATES[1])
  })

  it('marks the matching template as selected', () => {
    render(<StreamTemplates onSelect={vi.fn()} selectedId="grant" />)

    expect(screen.getByRole('button', { name: /Grant \/ Sponsorship/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: /Payroll/ })).toHaveAttribute('aria-pressed', 'false')
  })
})
