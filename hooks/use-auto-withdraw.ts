"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { withdrawFromStream } from "@/lib/contract";
import { getWithdrawableAmount } from "@/lib/stream-utils";
import type { StreamData } from "@/types/stream";
import { useNetwork } from "@/components/providers/network-provider";

export type WithdrawStrategy =
  "time-based" | "threshold-based" | "gas-optimized" | "max";

interface WithdrawalHistoryEntry {
  timestamp: number;
  amount: string;
  txHash?: string;
  error?: string;
}

interface AutoWithdrawSettings {
  enabled: boolean;
  strategy: WithdrawStrategy;
  intervalHours: number;
  minAmountRaw: string;
  maxSafetyLimitRaw: string;
  thresholdPercentage: number;
  withdrawalHistory: WithdrawalHistoryEntry[];
}

const DEFAULT_SETTINGS: AutoWithdrawSettings = {
  enabled: false,
  strategy: "time-based",
  intervalHours: 24,
  minAmountRaw: "0",
  maxSafetyLimitRaw: "0",
  thresholdPercentage: 50,
  withdrawalHistory: [],
};

function storageKey(streamId: string) {
  return `flowstar:auto-withdraw:${streamId}`;
}

function loadSettings(streamId: string): AutoWithdrawSettings {
  try {
    const stored = localStorage.getItem(storageKey(streamId));
    if (!stored) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function saveSettings(streamId: string, settings: AutoWithdrawSettings) {
  localStorage.setItem(storageKey(streamId), JSON.stringify(settings));
}

export function useAutoWithdraw(stream: StreamData | null) {
  const { network } = useNetwork();
  const [settings, setSettings] =
    useState<AutoWithdrawSettings>(DEFAULT_SETTINGS);
  const [lastAutoWithdraw, setLastAutoWithdraw] = useState<number | null>(null);
  const [autoWithdrawPending, setAutoWithdrawPending] = useState(false);
  const autoWithdrawPendingRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (stream) setSettings(loadSettings(stream.id));
  }, [stream?.id]);

  const updateSettings = useCallback(
    (update: Partial<AutoWithdrawSettings>) => {
      if (!stream) return;
      const next = { ...settings, ...update };
      setSettings(next);
      saveSettings(stream.id, next);
    },
    [stream, settings],
  );

  const addWithdrawalHistory = useCallback(
    (entry: WithdrawalHistoryEntry) => {
      if (!stream) return;
      setSettings((prev) => {
        const next = {
          ...prev,
          withdrawalHistory: [entry, ...prev.withdrawalHistory.slice(0, 99)],
        } as AutoWithdrawSettings;
        saveSettings(stream.id, next);
        return next;
      });
    },
    [stream],
  );

  const calculateWithdrawAmount = useCallback(
    (withdrawable: bigint, stream: StreamData): bigint => {
      const minAmount = BigInt(settings.minAmountRaw || "0");
      const maxLimit = BigInt(settings.maxSafetyLimitRaw || "0");

      if (withdrawable <= 0n) return 0n;
      if (minAmount > 0n && withdrawable < minAmount) return 0n;

      let amount = withdrawable;

      switch (settings.strategy) {
        case "threshold-based": {
          const threshold =
            (stream.depositedAmount * BigInt(settings.thresholdPercentage)) /
            100n;
          if (withdrawable < threshold) return 0n;
          amount = withdrawable;
          break;
        }
        case "gas-optimized": {
          const lastWithdraw = settings.withdrawalHistory[0];
          const daysSinceLastWithdraw = lastWithdraw
            ? (Date.now() - lastWithdraw.timestamp) / (1000 * 60 * 60 * 24)
            : Infinity;
          if (daysSinceLastWithdraw < 1) return 0n;
          amount = withdrawable;
          break;
        }
        case "max": {
          amount = withdrawable;
          break;
        }
        case "time-based":
        default: {
          amount = withdrawable;
          break;
        }
      }

      if (maxLimit > 0n && amount > maxLimit) {
        amount = maxLimit;
      }

      return amount;
    },
    [settings],
  );

  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (!settings.enabled || !stream || stream.cancelled) return;

    const intervalMs = settings.intervalHours * 60 * 60 * 1000;

    async function tryWithdraw() {
      if (!stream || autoWithdrawPendingRef.current) return;
      const now = Math.floor(Date.now() / 1000);
      const withdrawable = getWithdrawableAmount(stream, now);
      const amount = calculateWithdrawAmount(withdrawable, stream);

      if (amount <= 0n) return;

      autoWithdrawPendingRef.current = true;
      setAutoWithdrawPending(true);
      try {
        const txHash = await withdrawFromStream(stream.id, amount, network);
        setLastAutoWithdraw(Date.now());
        addWithdrawalHistory({
          timestamp: Date.now(),
          amount: amount.toString(),
          txHash: txHash ?? undefined,
        });
      } catch (error) {
        addWithdrawalHistory({
          timestamp: Date.now(),
          amount: amount.toString(),
          error: String(error),
        });
      } finally {
        autoWithdrawPendingRef.current = false;
        setAutoWithdrawPending(false);
      }
    }

    intervalRef.current = setInterval(tryWithdraw, intervalMs);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [
    settings.enabled,
    settings.intervalHours,
    settings.strategy,
    settings.minAmountRaw,
    settings.maxSafetyLimitRaw,
    settings.thresholdPercentage,
    stream,
    calculateWithdrawAmount,
    addWithdrawalHistory,
    network,
  ]);

  return {
    settings,
    updateSettings,
    lastAutoWithdraw,
    autoWithdrawPending,
    withdrawalHistory: settings.withdrawalHistory,
    addWithdrawalHistory,
  };
}
