export type StellarNetwork = 'testnet' | 'mainnet' | 'futurenet';

export const APP_NETWORK =
  (process.env.NEXT_PUBLIC_STELLAR_NETWORK as StellarNetwork) ?? 'testnet';

const NETWORK_NAMES: Record<StellarNetwork, string> = {
  testnet:    'Testnet',
  mainnet:    'Mainnet',
  futurenet:  'Futurenet',
};

export function getNetworkName(network: StellarNetwork): string {
  return NETWORK_NAMES[network] ?? network;
}

export function isNetworkMatch(walletNetwork: string): boolean {
  return walletNetwork.toLowerCase().includes(APP_NETWORK.toLowerCase());
}