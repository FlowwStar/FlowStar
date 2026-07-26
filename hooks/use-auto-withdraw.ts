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
  // Ref that always mirrors the latest settings so callbacks that need to
  // persist to localStorage never read a stale closure value.
  const settingsRef = useRef<AutoWithdrawSettings>(DEFAULT_SETTINGS);
  const [lastAutoWithdraw, setLastAutoWithdraw] = useState<number | null>(null);
  const [autoWithdrawPending, setAutoWithdrawPending] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (stream) {
      const loaded = loadSettings(stream.id);
      settingsRef.current = loaded;
      setSettings(loaded);
    }
  }, [stream?.id]);

  const updateSettings = useCallback(
    (update: Partial<AutoWithdrawSettings>) => {
      if (!stream) return;
      setSettings((prev) => {
        const next = { ...prev, ...update };
        settingsRef.current = next;
        saveSettings(stream.id, next);
        return next;
      });
    },
    [stream],
  );

  const addWithdrawalHistory = useCallback(
    (entry: WithdrawalHistoryEntry) => {
      if (!stream) return;
      setSettings((prev) => {
        const next = {
          ...prev,
          withdrawalHistory: [entry, ...prev.withdrawalHistory.slice(0, 99)],
        } as AutoWithdrawSettings;
        settingsRef.current = next;
        saveSettings(stream.id, next);
        return next;
      });
    },
    [stream],
  );

  const calculateWithdrawAmount = useCallback(
    (withdrawable: bigint, stream: StreamData): bigint => {
      // Always read from the ref so this never uses a stale closure snapshot.
      const s = settingsRef.current;
      const minAmount = BigInt(s.minAmountRaw || "0");
      const maxLimit = BigInt(s.maxSafetyLimitRaw || "0");

      if (withdrawable <= 0n) return 0n;
      if (minAmount > 0n && withdrawable < minAmount) return 0n;

      let amount = withdrawable;

      switch (s.strategy) {
        case "threshold-based": {
          const threshold =
            (stream.depositedAmount * BigInt(s.thresholdPercentage)) /
            100n;
          if (withdrawable < threshold) return 0n;
          amount = withdrawable;
          break;
        }
        case "gas-optimized": {
          const lastWithdraw = s.withdrawalHistory[0];
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
    // No settings dependency — reads live value through ref instead.
    [],
  );

  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (!settings.enabled || !stream || stream.cancelled) return;

    const intervalMs = settings.intervalHours * 60 * 60 * 1000;

    async function tryWithdraw() {
      if (!stream || autoWithdrawPending) return;
      const now = Math.floor(Date.now() / 1000);
      const withdrawable = getWithdrawableAmount(stream, now);
      const amount = calculateWithdrawAmount(withdrawable, stream);

      if (amount <= 0n) return;

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
    autoWithdrawPending,
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
