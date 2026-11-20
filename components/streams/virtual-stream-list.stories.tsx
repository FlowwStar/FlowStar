import type { Meta, StoryObj } from '@storybook/react';

import { VirtualStreamList } from './virtual-stream-list';
import { mockStore } from '@/lib/mock-data';
import type { StreamData } from '@/lib/types';

const baseStreams = mockStore.getAll();

const fiveHundredStreams: StreamData[] = Array.from({ length: 500 }, (_, i) => ({
  ...baseStreams[i % baseStreams.length],
  id: String(i + 1),
}));

const meta = {
  title: 'Streams/VirtualStreamList',
  component: VirtualStreamList,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof VirtualStreamList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  args: {
    streams: [],
  },
};

export const FiveStreams: Story = {
  args: {
    streams: baseStreams,
  },
};

export const FiveHundredStreams: Story = {
  args: {
    streams: fiveHundredStreams,
  },
};

export const Loading: Story = {
  args: {
    streams: [],
    loading: true,
  },
};