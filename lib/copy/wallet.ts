// Centralized UI copy for the ConnectWalletButton component
// (components/layout/connect-wallet-button.tsx).
// Extracted so this component's strings live in one place instead of scattered through JSX (issue #948).

export const walletCopy = {
  toasts: {
    addressCopied: 'Address copied',
    addressCopiedDescription: 'Wallet address copied to clipboard',
    copyFailed: 'Failed to copy',
    copyFailedDescription: 'Could not copy address to clipboard',
  },
  fallbackWalletName: 'wallet',
  connectedWith: (name: string) => `Connected with ${name}`,
  copied: 'Copied',
  copyAddress: 'Copy address',
  disconnect: 'Disconnect',
  connectWallet: 'Connect wallet',
  dialog: {
    title: 'Connect a wallet',
    description:
      "Choose a Stellar wallet to continue. You'll sign transactions from your wallet — FlowStar never holds your keys.",
  },
  connectingTo: (name: string) => `Connecting to ${name}…`,
  notInstalled: 'Not installed',
}
