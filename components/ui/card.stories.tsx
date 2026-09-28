import type { Meta, StoryObj } from "@storybook/react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, CardAction } from "./card"
import { Button } from "./button"

const meta = {
  title: "UI/Card",
  component: Card,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof Card>

export default meta
type Story = StoryObj<typeof meta>

// Basic card with content only
export const BasicCard: Story = {
  render: () => (
    <Card className="w-96">
      <CardContent>
        <p>This is a simple card with just content.</p>
      </CardContent>
    </Card>
  ),
}

// Card with header and content
export const WithHeader: Story = {
  render: () => (
    <Card className="w-96">
      <CardHeader>
        <CardTitle>Card Title</CardTitle>
      </CardHeader>
      <CardContent>
        <p>This card has a header with a title.</p>
      </CardContent>
    </Card>
  ),
}

// Card with header, title, and description
export const WithHeaderAndDescription: Story = {
  render: () => (
    <Card className="w-96">
      <CardHeader>
        <CardTitle>Stream Overview</CardTitle>
        <CardDescription>View details about your active streams</CardDescription>
      </CardHeader>
      <CardContent>
        <p>Your stream details would go here.</p>
      </CardContent>
    </Card>
  ),
}

// Complete card with header, content, and footer
export const CompleteCard: Story = {
  render: () => (
    <Card className="w-96">
      <CardHeader>
        <CardTitle>Confirm Action</CardTitle>
        <CardDescription>Are you sure you want to proceed?</CardDescription>
      </CardHeader>
      <CardContent>
        <p>This action cannot be undone.</p>
      </CardContent>
      <CardFooter className="gap-2">
        <Button variant="outline">Cancel</Button>
        <Button>Confirm</Button>
      </CardFooter>
    </Card>
  ),
}

// Card with header and action
export const WithHeaderAction: Story = {
  render: () => (
    <Card className="w-96">
      <CardHeader>
        <CardTitle>Stream Details</CardTitle>
        <CardAction>
          <Button variant="ghost" size="icon-sm">
            ⋯
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <p>Stream information displayed here.</p>
      </CardContent>
    </Card>
  ),
}

// Small size card
export const SmallCard: Story = {
  render: () => (
    <Card className="w-96" size="sm">
      <CardHeader>
        <CardTitle>Small Card</CardTitle>
      </CardHeader>
      <CardContent>
        <p>This is a compact card with reduced spacing.</p>
      </CardContent>
    </Card>
  ),
}

// Multiple cards layout
export const MultipleCards: Story = {
  render: () => (
    <div className="grid grid-cols-1 gap-4 w-full max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Card One</CardTitle>
          <CardDescription>First card</CardDescription>
        </CardHeader>
        <CardContent>
          <p>Content for the first card.</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Card Two</CardTitle>
          <CardDescription>Second card</CardDescription>
        </CardHeader>
        <CardContent>
          <p>Content for the second card.</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Card Three</CardTitle>
          <CardDescription>Third card</CardDescription>
        </CardHeader>
        <CardContent>
          <p>Content for the third card.</p>
        </CardContent>
      </Card>
    </div>
  ),
}

// Card with complex content
export const ComplexContent: Story = {
  render: () => (
    <Card className="w-96">
      <CardHeader>
        <CardTitle>Transaction Details</CardTitle>
        <CardDescription>Complete information about your transaction</CardDescription>
        <CardAction>
          <Button variant="ghost" size="icon-sm">
            ✓
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div>
            <p className="text-sm text-muted-foreground">From</p>
            <p className="font-mono text-sm">GXXX...XXX</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">To</p>
            <p className="font-mono text-sm">GYYY...YYY</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Amount</p>
            <p className="font-medium">1,000 USDC</p>
          </div>
        </div>
      </CardContent>
      <CardFooter className="gap-2">
        <Button variant="outline">Cancel</Button>
        <Button>Confirm</Button>
      </CardFooter>
    </Card>
  ),
}

// Interactive card with hover effect
export const InteractiveCard: Story = {
  render: () => (
    <Card className="w-96 cursor-pointer hover:ring-2 hover:ring-accent transition-all">
      <CardHeader>
        <CardTitle>Clickable Stream</CardTitle>
        <CardDescription>Click to view details</CardDescription>
      </CardHeader>
      <CardContent>
        <p>USDC 1000 → John Doe</p>
      </CardContent>
    </Card>
  ),
}

// Default vs Small size comparison
export const SizeComparison: Story = {
  render: () => (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-muted-foreground mb-2">Default size</p>
        <Card>
          <CardHeader>
            <CardTitle>Default Card</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Standard spacing</p>
          </CardContent>
        </Card>
      </div>
      <div>
        <p className="text-sm text-muted-foreground mb-2">Small size</p>
        <Card size="sm">
          <CardHeader>
            <CardTitle>Small Card</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Compact spacing</p>
          </CardContent>
        </Card>
      </div>
    </div>
  ),
}
