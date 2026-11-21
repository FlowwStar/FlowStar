import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "./button";

const meta = {
  title: "UI/Button",
  component: Button,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "outline", "secondary", "ghost", "destructive", "link"],
    },
    size: {
      control: "select",
      options: ["default", "xs", "sm", "lg", "icon", "icon-xs", "icon-sm", "icon-lg"],
    },
    disabled: {
      control: "boolean",
    },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

// Default variant stories
export const Default: Story = {
  args: {
    variant: "default",
    size: "default",
    children: "Click me",
  },
};

export const DefaultSmall: Story = {
  args: {
    variant: "default",
    size: "sm",
    children: "Small button",
  },
};

export const DefaultLarge: Story = {
  args: {
    variant: "default",
    size: "lg",
    children: "Large button",
  },
};

// Ghost variant stories
export const Ghost: Story = {
  args: {
    variant: "ghost",
    size: "default",
    children: "Ghost button",
  },
};

export const GhostSmall: Story = {
  args: {
    variant: "ghost",
    size: "sm",
    children: "Small ghost",
  },
};

export const GhostLarge: Story = {
  args: {
    variant: "ghost",
    size: "lg",
    children: "Large ghost",
  },
};

// Secondary variant stories
export const Secondary: Story = {
  args: {
    variant: "secondary",
    size: "default",
    children: "Secondary button",
  },
};

export const SecondarySmall: Story = {
  args: {
    variant: "secondary",
    size: "sm",
    children: "Small secondary",
  },
};

export const SecondaryLarge: Story = {
  args: {
    variant: "secondary",
    size: "lg",
    children: "Large secondary",
  },
};

// Destructive variant stories
export const Destructive: Story = {
  args: {
    variant: "destructive",
    size: "default",
    children: "Delete",
  },
};

export const DestructiveSmall: Story = {
  args: {
    variant: "destructive",
    size: "sm",
    children: "Delete",
  },
};

export const DestructiveLarge: Story = {
  args: {
    variant: "destructive",
    size: "lg",
    children: "Delete",
  },
};

// Icon size stories
export const IconDefault: Story = {
  args: {
    variant: "default",
    size: "icon",
    children: "🔍",
  },
};

export const IconSmall: Story = {
  args: {
    variant: "default",
    size: "icon-sm",
    children: "📝",
  },
};

export const IconLarge: Story = {
  args: {
    variant: "default",
    size: "icon-lg",
    children: "⚙️",
  },
};

// Disabled state
export const Disabled: Story = {
  args: {
    variant: "default",
    size: "default",
    children: "Disabled button",
    disabled: true,
  },
};

export const DisabledGhost: Story = {
  args: {
    variant: "ghost",
    size: "default",
    children: "Disabled ghost",
    disabled: true,
  },
};

export const DisabledDestructive: Story = {
  args: {
    variant: "destructive",
    size: "default",
    children: "Disabled delete",
    disabled: true,
  },
};
