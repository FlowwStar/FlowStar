import { getNetworkName, APP_NETWORK } from '@/lib/network';

interface Props {
  walletNetwork: string;
  onDismiss:     () => void;
}

export function NetworkMismatchModal({ walletNetwork, onDismiss }: Props) {
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="network-modal-title"
         className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl max-w-md w-full p-6">
        <h2 id="network-modal-title"
            className="text-lg font-semibold text-red-600 dark:text-red-400 mb-3">
          ⚠️ Wrong Network
        </h2>
        <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
          Your wallet is connected to{' '}
          <strong>{walletNetwork}</strong>.
          FlowStar requires{' '}
          <strong>{getNetworkName(APP_NETWORK)}</strong>.
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-5">
          Please open Freighter, go to Settings → Network, and switch to{' '}
          {getNetworkName(APP_NETWORK)}.
        </p>
        <div className="flex gap-3">
          
            href="https://docs.freighter.app/docs/guide/usingFreighter#network-settings"
            target="_blank" rel="noopener noreferrer"
            className="flex-1 text-center text-sm bg-blue-600 text-white
                       rounded-lg py-2.5 hover:bg-blue-700 transition-colors"
          >
            Freighter Network Guide
          </a>
          <button
            onClick={onDismiss}
            className="flex-1 text-sm border rounded-lg py-2.5
                       hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}