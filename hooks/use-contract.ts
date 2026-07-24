"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import {
  createStream as createStreamCall,
  withdrawFromStream,
  cancelStream as cancelStreamCall,
  estimateCreateStreamFee,
  type TxStep,
} from "@/lib/contract";
import type { FeeEstimate } from "@/lib/contract";
import { invalidateStreams } from "@/hooks/use-streams";
import { useWallet } from "@/hooks/use-wallet";
import { useNetwork } from "@/components/providers/network-provider";
import { getWithdrawableAmount } from "@/lib/stream-utils";
import { mapError, categoryLabel } from "@/lib/error-messages";
import type { CreateStreamInput, StreamData } from "@/types/stream";

export interface WithdrawAllResult {
  succeeded: number;
  failed: number;
}

const TX_STEP_LABELS: Record<TxStep, string> = {
  simulating: "Simulating transaction…",
  signing: "Please sign in your wallet",
  submitting: "Transaction submitted — waiting for confirmation",
  confirming: "Confirming on-chain…",
};

function showErrorToast(err: unknown, toastId?: string | number) {
  const mapped = mapError(err);
  const category = categoryLabel(mapped.category);
  const opts = {
    description: mapped.suggestion,
    duration: 7000,
    ...(toastId ? { id: toastId } : {}),
    action: mapped.details
      ? {
          label: "Details",
          onClick: () => {
            const short =
              mapped.details!.length > 200
                ? mapped.details!.slice(0, 200) + "…"
                : mapped.details!;
            toast.info(short, { duration: 10000 });
          },
        }
      : undefined,
  };
  toast.error(mapped.message, opts);
  return `[${category}] ${mapped.message}`;
}

export function useContract() {
  const { address, isConnected } = useWallet();
  const { network } = useNetwork();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Tracks the latest connection state so long-running loops (withdrawAll)
  // can detect a mid-batch disconnect instead of relying on a stale closure.
  const isConnectedRef = useRef(isConnected);
  useEffect(() => {
    isConnectedRef.current = isConnected;
  }, [isConnected]);

  const run = useCallback(
    async <T>(
      label: string,
      fn: (onStep: (step: TxStep) => void) => Promise<T>,
    ): Promise<T> => {
      if (!isConnected || !address) throw new Error("Connect a wallet first.");
      setPending(true);
      setError(null);
      const toastId = toast.loading("Simulating transaction…");
      try {
        const result = await fn((step) => {
          toast.loading(TX_STEP_LABELS[step], { id: toastId });
        });
        toast.success(`${label} confirmed!`, { id: toastId, duration: 4000 });
        invalidateStreams();
        return result;
      } catch (err) {
        showErrorToast(err, toastId);
        const mapped = mapError(err);
        const category = categoryLabel(mapped.category);
        const displayMessage = `[${category}] ${mapped.message}`;
        setError(displayMessage);
        throw err;
      } finally {
        setPending(false);
      }
    },
    [address, isConnected],
  );

  const createStream = useCallback(
    (input: CreateStreamInput) =>
      run("Create stream", (onStep) =>
        createStreamCall(input, address!, network, onStep),
      ),
    [run, address, network],
  );

  const withdraw = useCallback(
    (id: string, amount: bigint) =>
      run("Withdraw", (onStep) =>
        withdrawFromStream(id, amount, network, onStep),
      ),
    [run, network],
  );

  const cancel = useCallback(
    (id: string) =>
      run("Cancel stream", (onStep) => cancelStreamCall(id, network, onStep)),
    [run, network],
  );

  const estimateFee = useCallback(
    async (input: CreateStreamInput): Promise<FeeEstimate | null> => {
      if (!isConnected || !address) return null;
      try {
        return await estimateCreateStreamFee(network, input, address);
      } catch {
        return null;
      }
    },
    [address, isConnected, network],
  );

  const withdrawAll = useCallback(
    async (
      streams: StreamData[],
      onProgress?: (current: number, total: number) => void,
    ): Promise<WithdrawAllResult> => {
      if (!isConnected || !address) throw new Error("Connect a wallet first.");

      const now = Math.floor(Date.now() / 1000);
      const withdrawable = streams.filter(
        (s) => getWithdrawableAmount(s, now) > 0n,
      );
      if (withdrawable.length === 0) return { succeeded: 0, failed: 0 };

      setPending(true);
      setError(null);

      let succeeded = 0;
      let failed = 0;

      for (let i = 0; i < withdrawable.length; i++) {
        if (!isConnectedRef.current) {
          toast.error("Wallet disconnected — stopping remaining withdrawals.", {
            duration: 5000,
          });
          break;
        }

        onProgress?.(i + 1, withdrawable.length);
        const s = withdrawable[i];
        try {
          const amount = getWithdrawableAmount(s, now);
          await withdrawFromStream(s.id, amount, network);
          succeeded++;
        } catch (err) {
          failed++;
          const mapped = mapError(err);
          toast.error(`Stream #${s.id}: ${mapped.message}`, {
            description: mapped.suggestion,
            duration: 5000,
          });
        }
      }

      invalidateStreams();
      setPending(false);

      if (failed > 0 && succeeded === 0) {
        setError("All withdrawals failed. See error toasts for details.");
      }

      return { succeeded, failed };
    },
    [address, isConnected, network],
  );

  return {
    createStream,
    withdraw,
    cancel,
    withdrawAll,
    estimateFee,
    pending,
    error,
  };
}
