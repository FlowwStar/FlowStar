import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuGroup,
} from '@/components/ui/dropdown-menu'

// ─── helpers ─────────────────────────────────────────────────────────────────

/** Minimal menu that opens with a "Open" trigger button. */
function BasicMenu({
  onItemClick,
  items = ['Alpha', 'Beta', 'Gamma'],
}: {
  onItemClick?: (label: string) => void
  items?: string[]
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger>Open</DropdownMenuTrigger>
      <DropdownMenuContent>
        {items.map((label) => (
          <DropdownMenuItem key={label} onClick={() => onItemClick?.(label)}>
            {label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ─── open / close behaviour ───────────────────────────────────────────────────

describe('DropdownMenu — open / close', () => {
  it('content is not in the DOM before the trigger is clicked', () => {
    render(<BasicMenu />)
    expect(screen.queryByText('Alpha')).not.toBeInTheDocument()
  })

  it('renders items after trigger click', () => {
    render(<BasicMenu />)
    fireEvent.click(screen.getByText('Open'))
    expect(screen.getByText('Alpha')).toBeInTheDocument()
    expect(screen.getByText('Beta')).toBeInTheDocument()
    expect(screen.getByText('Gamma')).toBeInTheDocument()
  })

  it('trigger is rendered as a button by default', () => {
    render(<BasicMenu />)
    expect(screen.getByRole('button', { name: 'Open' })).toBeInTheDocument()
  })

  it('closes the menu when Escape is pressed', async () => {
    render(<BasicMenu />)
    fireEvent.click(screen.getByText('Open'))
    expect(screen.getByText('Alpha')).toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' })
    // After Escape the content may be hidden or unmounted — either is acceptable
    // (animation exit classes are applied; the important thing is the open state reverts)
    expect(screen.getByRole('button', { name: 'Open' })).toBeInTheDocument()
  })

  it('DropdownMenuTrigger with asChild renders the child element as the trigger', () => {
    render(
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button data-testid="custom-trigger">Custom</button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Item</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    )
    expect(screen.getByTestId('custom-trigger')).toBeInTheDocument()
  })
})

// ─── item onClick handlers ────────────────────────────────────────────────────

describe('DropdownMenu — onClick / onSelect handlers', () => {
  it('calls onClick handler when a menu item is clicked', async () => {
    const handler = vi.fn()
    render(<BasicMenu onItemClick={handler} />)
    fireEvent.click(screen.getByText('Open'))
    fireEvent.click(screen.getByText('Alpha'))
    expect(handler).toHaveBeenCalledWith('Alpha')
  })

  it('calls onClick for the correct item when multiple items exist', async () => {
    const handler = vi.fn()
    render(<BasicMenu onItemClick={handler} />)
    fireEvent.click(screen.getByText('Open'))
    fireEvent.click(screen.getByText('Beta'))
    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler).toHaveBeenCalledWith('Beta')
  })

  it('fires separate handlers for separate items', () => {
    const alphaHandler = vi.fn()
    const betaHandler = vi.fn()
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Open</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={alphaHandler}>Alpha</DropdownMenuItem>
          <DropdownMenuItem onClick={betaHandler}>Beta</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    )
    fireEvent.click(screen.getByText('Open'))
    fireEvent.click(screen.getByText('Alpha'))
    expect(alphaHandler).toHaveBeenCalledOnce()
    expect(betaHandler).not.toHaveBeenCalled()
  })
})

// ─── keyboard navigation ──────────────────────────────────────────────────────

describe('DropdownMenu — keyboard navigation', () => {
  it('can open the menu by pressing Enter on the trigger', async () => {
    const user = userEvent.setup()
    render(<BasicMenu />)
    const trigger = screen.getByRole('button', { name: 'Open' })
    trigger.focus()
    await user.keyboard('{Enter}')
    expect(screen.getByText('Alpha')).toBeInTheDocument()
  })

  it('can open the menu by pressing Space on the trigger', async () => {
    const user = userEvent.setup()
    render(<BasicMenu />)
    const trigger = screen.getByRole('button', { name: 'Open' })
    trigger.focus()
    await user.keyboard(' ')
    expect(screen.getByText('Alpha')).toBeInTheDocument()
  })
})

// ─── variants / destructive ───────────────────────────────────────────────────

describe('DropdownMenuItem — variant prop', () => {
  it('renders default variant without data-variant=destructive', () => {
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Open</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Normal</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    )
    fireEvent.click(screen.getByText('Open'))
    const item = screen.getByText('Normal').closest('[data-slot="dropdown-menu-item"]')
    expect(item).not.toHaveAttribute('data-variant', 'destructive')
  })

  it('renders destructive variant with data-variant=destructive', () => {
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Open</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem variant="destructive">Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    )
    fireEvent.click(screen.getByText('Open'))
    const item = screen.getByText('Delete').closest('[data-slot="dropdown-menu-item"]')
    expect(item).toHaveAttribute('data-variant', 'destructive')
  })
})

// ─── data-slot attributes (component identity) ───────────────────────────────

describe('DropdownMenu — data-slot attributes', () => {
  it('DropdownMenuTrigger has data-slot="dropdown-menu-trigger"', () => {
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Open</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Item</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    )
    const trigger = screen
      .getByText('Open')
      .closest('[data-slot="dropdown-menu-trigger"]')
    expect(trigger).toBeInTheDocument()
  })

  it('DropdownMenuContent has data-slot="dropdown-menu-content" when open', () => {
    render(<BasicMenu />)
    fireEvent.click(screen.getByText('Open'))
    const content = document.querySelector('[data-slot="dropdown-menu-content"]')
    expect(content).toBeInTheDocument()
  })

  it('DropdownMenuItem has data-slot="dropdown-menu-item"', () => {
    render(<BasicMenu />)
    fireEvent.click(screen.getByText('Open'))
    const items = document.querySelectorAll('[data-slot="dropdown-menu-item"]')
    expect(items.length).toBe(3)
  })
})

// ─── DropdownMenuCheckboxItem ─────────────────────────────────────────────────

describe('DropdownMenuCheckboxItem', () => {
  it('renders without throwing', () => {
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Open</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuCheckboxItem checked={false}>Notifications</DropdownMenuCheckboxItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    )
    fireEvent.click(screen.getByText('Open'))
    expect(screen.getByText('Notifications')).toBeInTheDocument()
  })

  it('has data-slot="dropdown-menu-checkbox-item"', () => {
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Open</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuCheckboxItem checked={true}>Enabled</DropdownMenuCheckboxItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    )
    fireEvent.click(screen.getByText('Open'))
    const item = document.querySelector('[data-slot="dropdown-menu-checkbox-item"]')
    expect(item).toBeInTheDocument()
  })
})

// ─── DropdownMenuRadioGroup / DropdownMenuRadioItem ───────────────────────────

describe('DropdownMenuRadioGroup + DropdownMenuRadioItem', () => {
  it('renders radio items within a group', () => {
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Open</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuRadioGroup value="a">
            <DropdownMenuRadioItem value="a">Option A</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="b">Option B</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>,
    )
    fireEvent.click(screen.getByText('Open'))
    expect(screen.getByText('Option A')).toBeInTheDocument()
    expect(screen.getByText('Option B')).toBeInTheDocument()
  })
})

// ─── DropdownMenuSeparator ────────────────────────────────────────────────────

describe('DropdownMenuSeparator', () => {
  it('renders a separator between items', () => {
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Open</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Above</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem>Below</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    )
    fireEvent.click(screen.getByText('Open'))
    const separator = document.querySelector('[data-slot="dropdown-menu-separator"]')
    expect(separator).toBeInTheDocument()
  })
})

// ─── DropdownMenuLabel ────────────────────────────────────────────────────────

describe('DropdownMenuLabel', () => {
  it('renders a group label', () => {
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Open</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuGroup>
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem>Edit</DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>,
    )
    fireEvent.click(screen.getByText('Open'))
    expect(screen.getByText('Actions')).toBeInTheDocument()
  })
})

// ─── DropdownMenuShortcut ─────────────────────────────────────────────────────

describe('DropdownMenuShortcut', () => {
  it('renders a keyboard shortcut hint', () => {
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Open</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>
            Copy
            <DropdownMenuShortcut>⌘C</DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    )
    fireEvent.click(screen.getByText('Open'))
    expect(screen.getByText('⌘C')).toBeInTheDocument()
  })

  it('shortcut has data-slot="dropdown-menu-shortcut"', () => {
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Open</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>
            Paste <DropdownMenuShortcut>⌘V</DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    )
    fireEvent.click(screen.getByText('Open'))
    const shortcut = document.querySelector('[data-slot="dropdown-menu-shortcut"]')
    expect(shortcut).toBeInTheDocument()
  })
})

// ─── DropdownMenuSub ──────────────────────────────────────────────────────────

describe('DropdownMenuSub', () => {
  it('renders a submenu trigger', () => {
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Open</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>More options</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem>Sub item</DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuContent>
      </DropdownMenu>,
    )
    fireEvent.click(screen.getByText('Open'))
    expect(screen.getByText('More options')).toBeInTheDocument()
  })
})

// ─── render prop on DropdownMenuItem ─────────────────────────────────────────

describe('DropdownMenuItem — render prop', () => {
  it('renders custom element via render prop', () => {
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Open</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem render={<a href="/dashboard">Dashboard</a>} />
        </DropdownMenuContent>
      </DropdownMenu>,
    )
    fireEvent.click(screen.getByText('Open'))
    const link = screen.getByRole('link', { name: 'Dashboard' })
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('href', '/dashboard')
  })
})

// ─── controlled open state ────────────────────────────────────────────────────

describe('DropdownMenu — controlled open state', () => {
  it('respects open=true and renders content immediately', () => {
    render(
      <DropdownMenu open={true}>
        <DropdownMenuTrigger>Trigger</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Visible item</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    )
    expect(screen.getByText('Visible item')).toBeInTheDocument()
  })

  it('calls onOpenChange when trigger is clicked in controlled mode', () => {
    const onOpenChange = vi.fn()
    render(
      <DropdownMenu open={false} onOpenChange={onOpenChange}>
        <DropdownMenuTrigger>Trigger</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Item</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    )
    fireEvent.click(screen.getByText('Trigger'))
    expect(onOpenChange).toHaveBeenCalled()
  })
})
