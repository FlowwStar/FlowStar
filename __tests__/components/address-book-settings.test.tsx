import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AddressBookSettings } from '@/components/settings/address-book-settings'
import { addAddressBookEntry } from '@/lib/address-book'

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

describe('AddressBookSettings', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('renders saved entries', () => {
    addAddressBookEntry({ label: 'Alice', address: 'GALICE111' })
    addAddressBookEntry({ label: 'Bob', address: 'GBOB222' })

    render(<AddressBookSettings />)

    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('GALICE111')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
    expect(screen.getByText('GBOB222')).toBeInTheDocument()
  })

  it('edit then save updates the entry', async () => {
    const user = userEvent.setup()
    addAddressBookEntry({ label: 'Alice', address: 'GALICE111' })

    render(<AddressBookSettings />)

    await user.click(screen.getByRole('button', { name: 'Edit label' }))
    const input = screen.getByDisplayValue('Alice')
    await user.clear(input)
    await user.type(input, 'Alice Updated')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(screen.getByText('Alice Updated')).toBeInTheDocument()
    expect(screen.queryByText('Alice')).not.toBeInTheDocument()
  })

  it('delete removes the entry', async () => {
    const user = userEvent.setup()
    addAddressBookEntry({ label: 'Alice', address: 'GALICE111' })

    render(<AddressBookSettings />)

    await user.click(screen.getByRole('button', { name: 'Delete' }))
    await user.click(screen.getByRole('button', { name: 'Confirm' }))

    expect(screen.queryByText('Alice')).not.toBeInTheDocument()
    expect(
      screen.getByText('No saved addresses yet. Addresses you save while creating a stream will appear here.'),
    ).toBeInTheDocument()
  })
})
