import type { Meta, StoryObj } from '@storybook/react'
import { Breadcrumb } from './breadcrumb'

const meta = {
  title: 'Layout/Breadcrumb',
  component: Breadcrumb,
  parameters: {
    layout: 'fullscreen',
    nextjs: {
      appDirectory: true,
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Breadcrumb>

export default meta
type Story = StoryObj<typeof meta>

// Top level — a page one level below the dashboard.
export const TopLevel: Story = {
  parameters: {
    nextjs: {
      appDirectory: true,
      navigation: { pathname: '/app/streams' },
    },
  },
}

// Nested route — multiple levels below the dashboard.
export const NestedRoute: Story = {
  parameters: {
    nextjs: {
      appDirectory: true,
      navigation: { pathname: '/app/create/batch' },
    },
  },
}

// Long labels truncated — on narrow (mobile) viewports, intermediate crumbs are
// capped at 80px and the current page at 120px with an ellipsis.
export const LongLabelsTruncated: Story = {
  parameters: {
    nextjs: {
      appDirectory: true,
      navigation: {
        pathname:
          '/app/analytics/GBZXN7PIRZGNMHGA7MUUUF4GWPY5AYPV6LY4UV2GL6VJGIQRXFDNMADI/CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
      },
    },
  },
  globals: {
    viewport: { value: 'mobile1', isRotated: false },
  },
}
