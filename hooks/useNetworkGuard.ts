import { useState, useCallback } from 'react';
import { APP_NETWORK, isNetworkMatch, getNetworkName } from '@/lib/network';

export interface NetworkGuardState {
  mismatch:      boolean;
  walletNetwork: string | null;
  appNetwork:    string;
  check:         () => Promise<boolean>;
}

export function useNetworkGuard(): NetworkGuardState {
  const [walletNetwork, setWalletNetwork] = useState<string | null>(null);
  const [mismatch, setMismatch]           = useState(false);

  const check = useCallback(async (): Promise<boolean> => {
    try {
      // Freighter API — adjust if you use a different wallet kit
      const { freighterApi } = await import('@stellar/freighter-api');
      const network = await freighterApi.getNetwork();
      setWalletNetwork(network);

      const ok = isNetworkMatch(network);
      setMismatch(!ok);
      return ok;
    } catch {
      return false;
    }
  }, []);

  return {
    mismatch,
    walletNetwork,
    appNetwork: getNetworkName(APP_NETWORK),
    check,
  };
}