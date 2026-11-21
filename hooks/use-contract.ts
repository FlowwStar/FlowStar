"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import {
  createStream as createStreamCall,
  createStreamsBatch as createStreamsBatchCall,
  withdrawFromStream,
  cancelStream as cancelStreamCall,
  cleanupStream as cleanupStreamCall,
  estimateCreateStreamFee,
  setDelegateForStream,
  removeDelegateForStream,
  getStreamDelegate,
  type TxStep,
} from "@/lib/contract";
import type { FeeEstimate } from "@/lib/contract";
import { invalidateStreams } from "@/hooks/use-streams";
import { useWallet } from "@/hooks/use-wallet";
import { useNetwork } from "@/components/providers/network-provider";
import { getWithdrawableAmount } from "@/lib/stream-utils";
import { mapError, categoryLabel } from "@/lib/error-messages";
import type { CreateStreamInput, StreamData } from "@/types/stream";

/**
 * Result of a batch withdrawal operation.
 * @property {number} succeeded - Number of streams successfully withdrawn from
 * @property {number} failed - Number of streams that failed to withdraw
 */
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
      ? (() => {
          const details = mapped.details;
          return {
            label: "Details",
            onClick: () => {
              const short =
                details.length > 200
                  ? details.slice(0, 200) + "…"
                  : details;
              toast.info(short, { duration: 10000 });
            },
          };
        })()
      : undefined,
  };
  toast.error(mapped.message, opts);
  return `[${category}] ${mapped.message}`;
}

/**
 * Hook for executing contract write operations (create, withdraw, cancel streams).
 *
 * Wraps every contract call with:
 *   - Wallet connection checks and error handling
 *   - Transaction step tracking (simulate → sign → submit → confirm)
 *   - Toast notifications for user feedback
 *   - Automatic stream cache invalidation on success
 *   - Error mapping and recovery
 *
 * @returns {Object} Contract operations and state
 * @returns {Function} createStream - Create a new stream from input parameters
 * @returns {Function} createStreamsBatch - Create multiple streams in one atomic transaction (up to 20)
 * @returns {Function} withdraw - Withdraw unlocked funds from a stream by ID
 * @returns {Function} cancel - Cancel a stream; sender gets remainder, recipient keeps unlocked
 * @returns {Function} cleanup - Permanently remove a completed or cancelled stream from history
 * @returns {Function} withdrawAll - Withdraw from multiple streams in sequence, with progress tracking
 * @returns {Function} estimateFee - Estimate the fee for creating a stream (returns null if wallet disconnected)
 * @returns {Function} setDelegate - Set (or replace) the withdrawal delegate for a stream (recipient only)
 * @returns {Function} removeDelegate - Remove the withdrawal delegate for a stream (recipient only)
 * @returns {Function} getDelegate - Read the withdrawal delegate for a stream, if any (read-only)
 * @returns {boolean} pending - True while any transaction is being executed
 * @returns {string|null} error - Error message from the last failed operation, or null
 *
 * @throws {Error} "Connect a wallet first." - If any operation is called without a connected wallet
 *
 * @example
 * const { createStream, pending, error } = useContract()
 * await createStream({ recipient, token, amount, endTime, cliffTime, cliffAmount })
 */
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

  /**
   * Create a new token stream.
   * Requires prior token approval. Emits toast notifications for each step
   * (simulate, sign, submit, confirm). Invalidates the streams cache on success.
   *
   * @param {CreateStreamInput} input - Stream parameters (recipient, token, amount, schedule, cliff)
   * @returns {Promise<void>} Resolves when stream is created and confirmed on-chain
   * @throws {Error} Network or user rejection errors (caught and mapped to user-friendly messages)
   */
  const createStream = useCallback(
    (input: CreateStreamInput) =>
      run("Create stream", (onStep) =>
        createStreamCall(input, address!, network, onStep),
      ),
    [run, address, network],
  );

  /**
   * Create multiple streams in a single atomic transaction (up to 20 per batch).
   * Each stream requires prior token approval. All streams succeed or all fail together.
   * Emits toast notifications for transaction steps. Invalidates cache on success.
   *
   * @param {CreateStreamInput[]} inputs - Array of stream parameters (max 20)
   * @returns {Promise<void>} Resolves when all streams are created and confirmed
   * @throws {Error} Network, validation, or user rejection errors
   */
  const createStreamsBatch = useCallback(
    (inputs: CreateStreamInput[]) =>
      run("Create streams", (onStep) =>
        createStreamsBatchCall(inputs, address!, network, onStep),
      ),
    [run, address, network],
  );

  /**
   * Withdraw unlocked tokens from a stream.
   * Can be called by the recipient or any delegate authorized by the recipient.
   * Emits toast notifications and invalidates cache on success.
   *
   * @param {string} id - Stream ID to withdraw from
   * @param {bigint} amount - Amount to withdraw (must not exceed withdrawable balance)
   * @returns {Promise<void>} Resolves when withdrawal is confirmed on-chain
   * @throws {Error} "Not recipient or delegate" or "Insufficient unlocked balance"
   */
  const withdraw = useCallback(
    (id: string, amount: bigint) =>
      run("Withdraw", (onStep) =>
        withdrawFromStream(id, amount, network, onStep),
      ),
    [run, network],
  );

  /**
   * Cancel a stream. Only the sender can cancel.
   * The recipient keeps all previously unlocked tokens; sender recovers the remainder.
   * Emits toast notifications and invalidates cache on success.
   *
   * @param {string} id - Stream ID to cancel
   * @returns {Promise<void>} Resolves when cancellation is confirmed
   * @throws {Error} "Not sender" if caller is not the original sender
   */
  const cancel = useCallback(
    (id: string) =>
      run("Cancel stream", (onStep) => cancelStreamCall(id, network, onStep)),
    [run, network],
  );

  /**
   * Permanently remove a completed or cancelled stream from ledger storage.
   * Only callable when stream is fully drained (withdrawn) or cancelled.
   * Frees up ledger space and reduces storage fees.
   *
   * @param {string} id - Stream ID to clean up
   * @returns {Promise<void>} Resolves when stream is removed from storage
   * @throws {Error} "Stream not drained" if stream still has unlocked balance
   */
  const cleanup = useCallback(
    (id: string) =>
      run("Remove stream", (onStep) => {
        if (!address) throw new Error("Connect a wallet first.");
        return cleanupStreamCall(id, address, network, onStep);
      }),
    [run, address, network],
  );

  /**
   * Set (or replace) the withdrawal delegate for a stream (ADR-008).
   * Only the stream's recipient can call this. While a delegate is active,
   * only the delegate — not the recipient directly — can withdraw.
   * Emits toast notifications and invalidates cache on success.
   *
   * @param {string} id - Stream ID to set the delegate on
   * @param {string} delegate - Address to authorize as the withdrawal delegate
   * @returns {Promise<void>} Resolves when the delegate is confirmed on-chain
   * @throws {Error} "Not recipient", "Invalid recipient" (delegate === recipient), or "Stream cancelled"
   */
  const setDelegate = useCallback(
    (id: string, delegate: string) =>
      run("Set delegate", (onStep) =>
        setDelegateForStream(id, delegate, network, onStep),
      ),
    [run, network],
  );

  /**
   * Remove the withdrawal delegate for a stream (ADR-008), restoring the
   * recipient's direct withdrawal access. Only the stream's recipient can
   * call this. Emits toast notifications and invalidates cache on success.
   *
   * @param {string} id - Stream ID to remove the delegate from
   * @returns {Promise<void>} Resolves when the removal is confirmed on-chain
   * @throws {Error} "Not recipient" if caller is not the stream's recipient
   */
  const removeDelegate = useCallback(
    (id: string) =>
      run("Remove delegate", (onStep) =>
        removeDelegateForStream(id, network, onStep),
      ),
    [run, network],
  );

  /**
   * Read the withdrawal delegate registered for a stream, if any.
   * Read-only — does not require a connected wallet and never throws
   * (resolves to `null` on any failure).
   *
   * @param {string} id - Stream ID to look up
   * @returns {Promise<string | null>} The delegate address, or `null` if none is set
   */
  const getDelegate = useCallback(
    (id: string) => getStreamDelegate(id, network),
    [network],
  );

  /**
   * Estimate the fee for creating a stream.
   * Returns null if wallet is disconnected or estimation fails (graceful degradation).
   * Useful for displaying fee warnings or confirming budget availability before creation.
   *
   * @param {CreateStreamInput} input - Stream parameters to estimate fee for
   * @returns {Promise<FeeEstimate | null>} Fee estimate, or null if unavailable
   */
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

  /**
   * Withdraw from all streams with unlocked balance in sequence.
   * Gracefully handles partial failures: continues to next stream on error.
   * Detects mid-batch wallet disconnections and stops remaining withdrawals.
   * Fires individual error toasts per failed stream; caller sees aggregate result.
   * Useful for "Withdraw all" buttons and batch recovery flows.
   *
   * @param {StreamData[]} streams - Array of stream objects to check for withdrawable balance
   * @param {Function} [onProgress] - Optional callback (current, total) fired before each withdrawal attempt
   * @returns {Promise<WithdrawAllResult>} { succeeded, failed } counts
   *
   * @example
   * const result = await withdrawAll(myStreams, (i, total) => console.log(`${i}/${total}`))
   * if (result.failed > 0) { console.warn(`${result.failed} streams failed`) }
   */
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
    createStreamsBatch,
    withdraw,
    cancel,
    cleanup,
    withdrawAll,
    estimateFee,
    setDelegate,
    removeDelegate,
    getDelegate,
    pending,
    error,
  };
}
