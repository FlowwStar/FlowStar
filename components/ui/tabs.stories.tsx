import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Card } from '@/components/ui/card'

const meta: Meta<typeof Tabs> = {
  title: 'UI/Tabs',
  component: Tabs,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <Tabs defaultValue="tab1" className="w-[400px]">
      <TabsList>
        <TabsTrigger value="tab1">All</TabsTrigger>
        <TabsTrigger value="tab2">Receiving</TabsTrigger>
        <TabsTrigger value="tab3">Sending</TabsTrigger>
      </TabsList>
      <TabsContent value="tab1">
        <Card className="p-4">
          <p className="text-sm">All transactions and activity</p>
        </Card>
      </TabsContent>
      <TabsContent value="tab2">
        <Card className="p-4">
          <p className="text-sm">Incoming streams and transfers</p>
        </Card>
      </TabsContent>
      <TabsContent value="tab3">
        <Card className="p-4">
          <p className="text-sm">Outgoing streams and transfers</p>
        </Card>
      </TabsContent>
    </Tabs>
  ),
}

export const FourTabs: Story = {
  render: () => (
    <Tabs defaultValue="tab1" className="w-[500px]">
      <TabsList>
        <TabsTrigger value="tab1">Overview</TabsTrigger>
        <TabsTrigger value="tab2">History</TabsTrigger>
        <TabsTrigger value="tab3">Settings</TabsTrigger>
        <TabsTrigger value="tab4">Advanced</TabsTrigger>
      </TabsList>
      <TabsContent value="tab1">
        <Card className="p-4">
          <p className="text-sm">Overview tab content</p>
        </Card>
      </TabsContent>
      <TabsContent value="tab2">
        <Card className="p-4">
          <p className="text-sm">History tab content with transaction list</p>
        </Card>
      </TabsContent>
      <TabsContent value="tab3">
        <Card className="p-4">
          <p className="text-sm">Settings tab content with preferences</p>
        </Card>
      </TabsContent>
      <TabsContent value="tab4">
        <Card className="p-4">
          <p className="text-sm">Advanced tab content with developer options</p>
        </Card>
      </TabsContent>
    </Tabs>
  ),
}

export const LineVariant: Story = {
  render: () => (
    <Tabs defaultValue="tab1" className="w-[400px]">
      <TabsList variant="line">
        <TabsTrigger value="tab1">Tab 1</TabsTrigger>
        <TabsTrigger value="tab2">Tab 2</TabsTrigger>
        <TabsTrigger value="tab3">Tab 3</TabsTrigger>
      </TabsList>
      <TabsContent value="tab1">
        <Card className="p-4">
          <p className="text-sm">Line variant tab 1</p>
        </Card>
      </TabsContent>
      <TabsContent value="tab2">
        <Card className="p-4">
          <p className="text-sm">Line variant tab 2</p>
        </Card>
      </TabsContent>
      <TabsContent value="tab3">
        <Card className="p-4">
          <p className="text-sm">Line variant tab 3</p>
        </Card>
      </TabsContent>
    </Tabs>
  ),
}

export const DisabledTab: Story = {
  render: () => (
    <Tabs defaultValue="tab1" className="w-[400px]">
      <TabsList>
        <TabsTrigger value="tab1">Enabled</TabsTrigger>
        <TabsTrigger value="tab2" disabled>
          Disabled
        </TabsTrigger>
        <TabsTrigger value="tab3">Enabled</TabsTrigger>
      </TabsList>
      <TabsContent value="tab1">
        <Card className="p-4">
          <p className="text-sm">This tab is enabled</p>
        </Card>
      </TabsContent>
      <TabsContent value="tab3">
        <Card className="p-4">
          <p className="text-sm">This tab is also enabled</p>
        </Card>
      </TabsContent>
    </Tabs>
  ),
}

function InteractiveTabsExample() {
  const [activeTab, setActiveTab] = useState('tab1')

  return (
    <div className="w-[400px] space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="tab1">Stream</TabsTrigger>
          <TabsTrigger value="tab2">Transfer</TabsTrigger>
          <TabsTrigger value="tab3">Claim</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">
          <Card className="p-4">
            <p className="text-sm font-medium mb-2">Recurring Stream</p>
            <p className="text-xs text-muted-foreground">Set up a continuous payment stream over time</p>
          </Card>
        </TabsContent>
        <TabsContent value="tab2">
          <Card className="p-4">
            <p className="text-sm font-medium mb-2">One-time Transfer</p>
            <p className="text-xs text-muted-foreground">Send tokens immediately to an address</p>
          </Card>
        </TabsContent>
        <TabsContent value="tab3">
          <Card className="p-4">
            <p className="text-sm font-medium mb-2">Claim Tokens</p>
            <p className="text-xs text-muted-foreground">Claim available tokens from a stream</p>
          </Card>
        </TabsContent>
      </Tabs>
      <p className="text-xs text-muted-foreground">
        Use arrow keys to navigate between tabs (or try Alt+Arrow on some browsers)
      </p>
    </div>
  )
}

export const Interactive: Story = {
  render: () => <InteractiveTabsExample />,
}
