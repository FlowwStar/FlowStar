/**
 * Tests for components/ui/select.tsx
 *
 * Covers three key states of the primitive:
 *   1. Placeholder — shown when no value is selected
 *   2. Value selection — selecting an item updates the displayed value
 *   3. Disabled — interaction is blocked when the select is disabled
 *
 * Implementation notes
 * ─────────────────────
 * @base-ui/react Select renders its popup via a Portal into document.body.
 * jsdom supports this, so we use userEvent.click to open the popup and
 * select an item exactly as a user would.
 *
 * Placeholder state is signalled by `data-placeholder` on SelectTrigger
 * (and SelectValue), per the base-ui Select API:
 *   https://base-ui.com/react/components/select#trigger
 *
 * Disabled state is signalled by `data-disabled` on SelectTrigger and the
 * native HTML `disabled` attribute on the underlying <button>.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

// ─── Shared test fixture ──────────────────────────────────────────────────────

interface TestSelectProps {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  disabled?: boolean
  placeholder?: string
}

/**
 * Minimal but realistic Select assembly that mirrors how the component is
 * used throughout the app. SelectContent is rendered without animation
 * classes in jsdom so the items are immediately accessible after the popup
 * opens.
 */
function TestSelect({
  value,
  defaultValue,
  onValueChange,
  disabled = false,
  placeholder = 'Pick an option',
}: TestSelectProps) {
  return (
    <Select
      value={value}
      defaultValue={defaultValue}
      onValueChange={onValueChange}
      disabled={disabled}
    >
      <SelectTrigger aria-label="test-select">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="apple">Apple</SelectItem>
        <SelectItem value="banana">Banana</SelectItem>
        <SelectItem value="cherry">Cherry</SelectItem>
      </SelectContent>
    </Select>
  )
}

// ─── Placeholder ──────────────────────────────────────────────────────────────

describe('placeholder', () => {
  it('shows the placeholder text when no value is selected', () => {
    render(<TestSelect />)

    // The SelectValue span renders the placeholder text as its content when
    // no value is set.
    expect(screen.getByText('Pick an option')).toBeInTheDocument()
  })

  it('marks the trigger with data-placeholder when no value is selected', () => {
    render(<TestSelect />)

    const trigger = screen.getByRole('button', { name: 'test-select' })

    // base-ui sets data-placeholder on the trigger element when the select
    // has no value — this is what drives the muted text-color in the CSS.
    expect(trigger).toHaveAttribute('data-placeholder')
  })

  it('does not show data-placeholder once a value is set via defaultValue', () => {
    render(<TestSelect defaultValue="apple" />)

    const trigger = screen.getByRole('button', { name: 'test-select' })
    expect(trigger).not.toHaveAttribute('data-placeholder')
  })

  it('does not render the placeholder text when a defaultValue is provided', () => {
    render(<TestSelect defaultValue="banana" placeholder="Pick an option" />)

    expect(screen.queryByText('Pick an option')).not.toBeInTheDocument()
  })
})

// ─── Value selection ──────────────────────────────────────────────────────────

describe('value selection', () => {
  it('calls onValueChange with the selected item value when an option is clicked', async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()

    render(<TestSelect onValueChange={onValueChange} />)

    // Open the popup
    await user.click(screen.getByRole('button', { name: 'test-select' }))

    // The popup is portalled into document.body — query from there
    const listbox = await screen.findByRole('listbox')
    await user.click(within(listbox).getByText('Cherry'))

    expect(onValueChange).toHaveBeenCalledOnce()
    expect(onValueChange).toHaveBeenCalledWith('cherry')
  })

  it('removes data-placeholder from the trigger after a selection is made', async () => {
    const user = userEvent.setup()
    let currentValue = ''
    const onValueChange = vi.fn((v: string) => {
      currentValue = v
    })

    const { rerender } = render(
      <TestSelect value={currentValue} onValueChange={onValueChange} />,
    )

    const trigger = screen.getByRole('button', { name: 'test-select' })
    expect(trigger).toHaveAttribute('data-placeholder')

    // Open and select
    await user.click(trigger)
    const listbox = await screen.findByRole('listbox')
    await user.click(within(listbox).getByText('Apple'))

    expect(onValueChange).toHaveBeenCalledWith('apple')

    // Rerender with the new value to reflect controlled state
    rerender(<TestSelect value={currentValue} onValueChange={onValueChange} />)
    expect(trigger).not.toHaveAttribute('data-placeholder')
  })

  it('displays the selected item label in the trigger after selection', async () => {
    const user = userEvent.setup()
    let currentValue = ''
    const onValueChange = vi.fn((v: string) => {
      currentValue = v
    })

    const { rerender } = render(
      <TestSelect value={currentValue} onValueChange={onValueChange} />,
    )

    await user.click(screen.getByRole('button', { name: 'test-select' }))
    const listbox = await screen.findByRole('listbox')
    await user.click(within(listbox).getByText('Banana'))

    rerender(<TestSelect value={currentValue} onValueChange={onValueChange} />)

    // The trigger should now display the chosen item's label
    expect(screen.getByRole('button', { name: 'test-select' })).toHaveTextContent('Banana')
  })
})

// ─── Disabled state ───────────────────────────────────────────────────────────

describe('disabled state', () => {
  it('renders the trigger with the disabled attribute when the select is disabled', () => {
    render(<TestSelect disabled />)

    const trigger = screen.getByRole('button', { name: 'test-select' })
    expect(trigger).toBeDisabled()
  })

  it('marks the trigger with data-disabled when disabled', () => {
    render(<TestSelect disabled />)

    const trigger = screen.getByRole('button', { name: 'test-select' })
    expect(trigger).toHaveAttribute('data-disabled')
  })

  it('does not open the popup when the trigger is clicked while disabled', async () => {
    const user = userEvent.setup()

    render(<TestSelect disabled />)

    await user.click(screen.getByRole('button', { name: 'test-select' }))

    // No listbox should appear in the document after clicking a disabled trigger
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('does not call onValueChange when disabled', async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()

    render(<TestSelect disabled onValueChange={onValueChange} />)

    await user.click(screen.getByRole('button', { name: 'test-select' }))

    expect(onValueChange).not.toHaveBeenCalled()
  })
})
