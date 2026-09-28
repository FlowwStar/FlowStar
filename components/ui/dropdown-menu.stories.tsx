import type { Meta, StoryObj } from "@storybook/react"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuGroup,
  DropdownMenuLabel,
} from "./dropdown-menu"
import { Button } from "./button"
import { Check, ChevronRight } from "lucide-react"

const meta = {
  title: "UI/DropdownMenu",
  component: DropdownMenu,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof DropdownMenu>

export default meta
type Story = StoryObj<typeof meta>

// Basic dropdown menu
export const BasicMenu: Story = {
  render: () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button>Open Menu</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem>Option 1</DropdownMenuItem>
        <DropdownMenuItem>Option 2</DropdownMenuItem>
        <DropdownMenuItem>Option 3</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
}

// Menu with grouped items
export const GroupedMenu: Story = {
  render: () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button>Actions</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuGroup>
          <DropdownMenuLabel>Stream Actions</DropdownMenuLabel>
          <DropdownMenuItem>View Details</DropdownMenuItem>
          <DropdownMenuItem>Edit</DropdownMenuItem>
          <DropdownMenuItem>Pause</DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuGroup>
          <DropdownMenuLabel>Admin</DropdownMenuLabel>
          <DropdownMenuItem>Settings</DropdownMenuItem>
          <DropdownMenuItem>Delete Stream</DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
}

// Menu with checkbox items (radio-style selection)
export const WithCheckboxSelection: Story = {
  render: () => {
    const [selectedNetwork, setSelectedNetwork] = React.useState<"mainnet" | "testnet">("mainnet")

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline">Network: {selectedNetwork}</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuLabel>Select Network</DropdownMenuLabel>
          <DropdownMenuItem
            onClick={() => setSelectedNetwork("mainnet")}
            className="flex items-center justify-between"
          >
            Mainnet
            {selectedNetwork === "mainnet" && <Check className="size-4" />}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setSelectedNetwork("testnet")}
            className="flex items-center justify-between"
          >
            Testnet
            {selectedNetwork === "testnet" && <Check className="size-4" />}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  },
}

// Menu with theme selection
export const ThemeMenu: Story = {
  render: () => {
    const [theme, setTheme] = React.useState<"light" | "dark" | "system">("light")

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline">Theme</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuLabel>Choose Theme</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => setTheme("light")} className="flex items-center justify-between">
            Light
            {theme === "light" && <Check className="size-4" />}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setTheme("dark")} className="flex items-center justify-between">
            Dark
            {theme === "dark" && <Check className="size-4" />}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setTheme("system")} className="flex items-center justify-between">
            System
            {theme === "system" && <Check className="size-4" />}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  },
}

// Navbar-style dropdown with icons
export const NavbarDropdown: Story = {
  render: () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          ⋯
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem>Profile</DropdownMenuItem>
        <DropdownMenuItem>Settings</DropdownMenuItem>
        <DropdownMenuItem>Help</DropdownMenuItem>
        <DropdownMenuItem variant="destructive">Logout</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
}

// Large menu with many options
export const LargeMenu: Story = {
  render: () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button>More Options</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuGroup>
          <DropdownMenuLabel>Streams</DropdownMenuLabel>
          <DropdownMenuItem>View All</DropdownMenuItem>
          <DropdownMenuItem>Active Streams</DropdownMenuItem>
          <DropdownMenuItem>Completed Streams</DropdownMenuItem>
          <DropdownMenuItem>Cancelled Streams</DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuGroup>
          <DropdownMenuLabel>Analytics</DropdownMenuLabel>
          <DropdownMenuItem>Summary</DropdownMenuItem>
          <DropdownMenuItem>Volume Report</DropdownMenuItem>
          <DropdownMenuItem>Recipient List</DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuGroup>
          <DropdownMenuLabel>Utility</DropdownMenuLabel>
          <DropdownMenuItem>Export Data</DropdownMenuItem>
          <DropdownMenuItem>Settings</DropdownMenuItem>
          <DropdownMenuItem variant="destructive">Logout</DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
}

// Nested menu simulation (for context)
export const NestedMenuExample: Story = {
  render: () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button>Share</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>Share with</DropdownMenuLabel>
        <DropdownMenuItem>Email</DropdownMenuItem>
        <DropdownMenuItem>Copy Link</DropdownMenuItem>
        <DropdownMenuItem>QR Code</DropdownMenuItem>
        <DropdownMenuGroup>
          <DropdownMenuLabel>Social</DropdownMenuLabel>
          <DropdownMenuItem>Twitter</DropdownMenuItem>
          <DropdownMenuItem>Discord</DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
}

// Menu with destructive actions
export const DestructiveMenu: Story = {
  render: () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">Stream Actions</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuGroup>
          <DropdownMenuLabel>Safe Actions</DropdownMenuLabel>
          <DropdownMenuItem>View</DropdownMenuItem>
          <DropdownMenuItem>Pause</DropdownMenuItem>
          <DropdownMenuItem>Duplicate</DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuGroup>
          <DropdownMenuLabel>Danger Zone</DropdownMenuLabel>
          <DropdownMenuItem variant="destructive">Cancel Stream</DropdownMenuItem>
          <DropdownMenuItem variant="destructive">Delete Stream</DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
}

// Alignment variations
export const AlignmentVariations: Story = {
  render: () => (
    <div className="flex justify-between w-full max-w-md">
      <div>
        <p className="text-xs text-muted-foreground mb-2">Start (left)</p>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm">Menu</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem>Option 1</DropdownMenuItem>
            <DropdownMenuItem>Option 2</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div>
        <p className="text-xs text-muted-foreground mb-2">Center</p>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm">Menu</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center">
            <DropdownMenuItem>Option 1</DropdownMenuItem>
            <DropdownMenuItem>Option 2</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div>
        <p className="text-xs text-muted-foreground mb-2">End (right)</p>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm">Menu</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>Option 1</DropdownMenuItem>
            <DropdownMenuItem>Option 2</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  ),
}

// Import React for the useState hook
import React from "react"
