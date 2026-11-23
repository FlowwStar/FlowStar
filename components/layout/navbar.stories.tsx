import type { Meta, StoryObj } from '@storybook/react';
import { ThemeProvider } from 'next-themes';
import { NetworkProvider } from '@/contexts/network-context';
import { WalletProvider } from '@/contexts/wallet-context';
import Navbar from './navbar';

const meta: Meta<typeof Navbar> = {
  title: 'Layout/Navbar',
  component: Navbar,
  parameters: {
    layout: 'fullscreen',
    nextjs: {
      appDirectory: true,
      navigation: {
        pathname: '/',
      },
    },
  },
  decorators: [
    (Story) => (
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
        <NetworkProvider>
          <WalletProvider>
            <Story />
          </WalletProvider>
        </NetworkProvider>
      </ThemeProvider>
    ),
  ],
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof Navbar>;

export const Connected: Story = {
  parameters: {
    mockWallet: {
      connected: true,
      address: 'GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUV',
    },
  },
};

export const Disconnected: Story = {
  parameters: {
    mockWallet: {
      connected: false,
      address: null,
    },
  },
};

export const MobileViewport: Story = {
  parameters: {
    mockWallet: {
      connected: true,
      address: 'GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUV',
    },
    viewport: {
      defaultViewport: 'mobile1',
    },
  },
};