import type { Meta, StoryObj } from "@storybook/react";
import { Badge } from "./badge";

const meta = {
  title: "UI/Badge",
  component: Badge,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "secondary", "destructive", "outline", "ghost", "link"],
    },
  },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

// Default variant
export const Default: Story = {
  args: {
    variant: "default",
    children: "Default Badge",
  },
};

// Secondary variant
export const Secondary: Story = {
  args: {
    variant: "secondary",
    children: "Secondary Badge",
  },
};

// Destructive variant
export const Destructive: Story = {
  args: {
    variant: "destructive",
    children: "Destructive Badge",
  },
};

// Outline variant
export const Outline: Story = {
  args: {
    variant: "outline",
    children: "Outline Badge",
  },
};

// Ghost variant
export const Ghost: Story = {
  args: {
    variant: "ghost",
    children: "Ghost Badge",
  },
};

// Link variant
export const Link: Story = {
  args: {
    variant: "link",
    children: "Link Badge",
  },
};

// All variants showcase
export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3">
      <Badge variant="default">Default</Badge>
      <Badge variant="secondary">Secondary</Badge>
      <Badge variant="destructive">Destructive</Badge>
      <Badge variant="outline">Outline</Badge>
      <Badge variant="ghost">Ghost</Badge>
      <Badge variant="link">Link</Badge>
    </div>
  ),
};

// With different text lengths
export const LongText: Story = {
  args: {
    variant: "default",
    children: "This is a longer badge text",
  },
};

export const ShortText: Story = {
  args: {
    variant: "default",
    children: "New",
  },
};

// Status badges examples
export const StatusActive: Story = {
  args: {
    variant: "default",
    children: "Active",
  },
};

export const StatusInactive: Story = {
  args: {
    variant: "outline",
    children: "Inactive",
  },
};

export const StatusError: Story = {
  args: {
    variant: "destructive",
    children: "Error",
  },
};

export const StatusWarning: Story = {
  args: {
    variant: "secondary",
    children: "Warning",
  },
};

// Tag-like badges
export const TagDefault: Story = {
  args: {
    variant: "default",
    children: "React",
  },
};

export const TagSecondary: Story = {
  args: {
    variant: "secondary",
    children: "TypeScript",
  },
};

export const TagOutline: Story = {
  args: {
    variant: "outline",
    children: "CSS",
  },
};

// Combination showcase
export const VariantShowcase: Story = {
  render: () => (
    <div className="space-y-4">
      <div className="space-y-2">
        <h3 className="text-sm font-medium">Variants</h3>
        <div className="flex flex-wrap gap-2">
          <Badge variant="default">Default</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="destructive">Destructive</Badge>
          <Badge variant="outline">Outline</Badge>
          <Badge variant="ghost">Ghost</Badge>
          <Badge variant="link">Link</Badge>
        </div>
      </div>
      <div className="space-y-2">
        <h3 className="text-sm font-medium">Common Use Cases</h3>
        <div className="flex flex-wrap gap-2">
          <Badge variant="default">Featured</Badge>
          <Badge variant="secondary">New</Badge>
          <Badge variant="destructive">Urgent</Badge>
          <Badge variant="outline">Pending</Badge>
          <Badge variant="ghost">Draft</Badge>
          <Badge variant="link">Learn more</Badge>
        </div>
      </div>
    </div>
  ),
};
