import type { Meta, StoryObj } from '@storybook/react';
import { mocked } from 'storybook/test';

import { RequireWallet } from './require-wallet';
import { useWallet } from '@/hooks/use-wallet';

jest.mock('@/hooks/use-wallet');
jest.mock('@/components/layout/connect-wallet-button', () => ({
  ConnectWalletButton: () => <button type="button">Connect Wallet</button>,
}));

const mockedUseWallet = mocked(useWallet);

const meta: Meta<typeof RequireWallet> = {
  title: 'Layout/RequireWallet',
  component: RequireWallet,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof RequireWallet>;

export const Connected: Story = {
  beforeEach: () => {
    mockedUseWallet.mockReturnValue({
      isConnected: true,
    } as ReturnType<typeof useWallet>);
  },
  render: () => (
    <RequireWallet>
      <div>Protected content</div>
    </RequireWallet>
  ),
};

export const Disconnected: Story = {
  beforeEach: () => {
    mockedUseWallet.mockReturnValue({
      isConnected: false,
    } as ReturnType<typeof useWallet>);
  },
  render: () => (
    <RequireWallet>
      <div>Protected content</div>
    </RequireWallet>
  ),
};

export const Reconnecting: Story = {
  beforeEach: () => {
    mockedUseWallet.mockReturnValue({
      isConnected: false,
      isConnecting: true,
    } as ReturnType<typeof useWallet>);
  },
  render: () => (
    <RequireWallet>
      <div>Protected content</div>
    </RequireWallet>
  ),
};