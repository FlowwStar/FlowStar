"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { withdrawFromStream } from "@/lib/contract";
import { getWithdrawableAmount } from "@/lib/stream-utils";
import type { StreamData } from "@/types/stream";
import { useNetwork } from "@/components/providers/network-provider";

/**
 * Policy that decides, on each interval tick, whether to withdraw and how
 * much. See docs/adr/ADR-009-auto-withdraw-strategy-pattern.md.
 *
 * - `time-based` (default): withdraw everything withdrawable on every tick.
 * - `threshold-based`: withdraw only once the withdrawable amount reaches
 *   `thresholdPercentage`% of the stream's `depositedAmount`.
 * - `gas-optimized`: skip the tick if the most recent history entry
 *   (success or failure) is less than 1 day old. This is a fixed cooldown
 *   heuristic, not on-chain fee estimation.
 * - `max`: currently behaves the same as `time-based`.
 */
export type WithdrawStrategy =
  "time-based" | "threshold-based" | "gas-optimized" | "max";

/** One automatic withdrawal attempt: `error` is set on failure, `txHash` on success when available. */
interface WithdrawalHistoryEntry {
  timestamp: number;
  amount: string;
  txHash?: string;
  error?: string;
}

/**
 * Per-stream auto-withdraw configuration, persisted to localStorage under
 * `flowstar:auto-withdraw:<streamId>`.
 */
interface AutoWithdrawSettings {
  enabled: boolean;
  strategy: WithdrawStrategy;
  /** Hours between ticks. Clamped to at least `MIN_INTERVAL_HOURS`; no upper bound. */
  intervalHours: number;
  /** Skip the tick if less than this is withdrawable (raw token units; "0" disables). */
  minAmountRaw: string;
  /** Cap on a single automatic withdrawal (raw token units; "0" disables). */
  maxSafetyLimitRaw: string;
  /** Percentage of `depositedAmount` used by the `threshold-based` strategy. */
  thresholdPercentage: number;
  /** Newest first, capped at 100 entries. */
  withdrawalHistory: WithdrawalHistoryEntry[];
}

/** Floor for `intervalHours`, so a bad value can't create a tight polling loop (#277). */
const MIN_INTERVAL_HOURS = 1;

/** Returns `hours`, or `MIN_INTERVAL_HOURS` if it is non-finite or below the floor. */
function clampIntervalHours(hours: number): number {
  if (!Number.isFinite(hours) || hours < MIN_INTERVAL_HOURS) {
    return MIN_INTERVAL_HOURS;
  }
  return hours;
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

/**
 * Reads a stream's stored settings, merged over `DEFAULT_SETTINGS` and with
 * `intervalHours` re-clamped. Returns the defaults if nothing is stored or
 * the stored value can't be parsed.
 */
function loadSettings(streamId: string): AutoWithdrawSettings {
  try {
    const stored = localStorage.getItem(storageKey(streamId));
    if (!stored) return DEFAULT_SETTINGS;
    const parsed = { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
    parsed.intervalHours = clampIntervalHours(parsed.intervalHours);
    return parsed;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function saveSettings(streamId: string, settings: AutoWithdrawSettings) {
  localStorage.setItem(storageKey(streamId), JSON.stringify(settings));
}

/**
 * Client-side automatic withdrawals for one stream, driven by a configurable
 * {@link WithdrawStrategy}. See docs/adr/ADR-009-auto-withdraw-strategy-pattern.md.
 *
 * Interval/polling contract:
 * - A `setInterval` runs only while the hook is mounted, `settings.enabled`
 *   is true, and `stream` is non-null and not cancelled. This is not a
 *   background service: closing the tab stops it.
 * - The first tick fires one full `intervalHours` after the interval is set
 *   up. There is no immediate withdrawal on enable.
 * - Each tick computes the amount withdrawable at that moment. The strategy
 *   decides whether to withdraw, then `minAmountRaw` (skip if below) and
 *   `maxSafetyLimitRaw` (cap) are applied. A zero result skips the tick.
 * - At most one withdrawal is in flight. A tick that fires while one is
 *   pending is skipped. The guard is `autoWithdrawPendingRef`, not state, so
 *   finishing a withdrawal does not restart the interval (#225/#275).
 * - The interval is torn down and recreated, which restarts the countdown,
 *   whenever the enabled flag, any strategy setting, `stream`, or `network`
 *   changes.
 * - Every attempt, successful or failed, is added to `withdrawalHistory`.
 *
 * Settings are loaded when `stream.id` changes. Every update is written to
 * localStorage right away.
 *
 * @param stream - The stream to auto-withdraw from. Pass `null` to disable.
 * @returns The current settings, `updateSettings` to change and persist
 *   them, `lastAutoWithdraw` (ms timestamp of the last successful automatic
 *   withdrawal in this session), `autoWithdrawPending`, the persisted
 *   `withdrawalHistory`, and `addWithdrawalHistory`.
 */
export function useAutoWithdraw(stream: StreamData | null) {
  const { network } = useNetwork();
  const [settings, setSettings] =
    useState<AutoWithdrawSettings>(DEFAULT_SETTINGS);
  // Ref that always mirrors the latest settings so callbacks that need to
  // persist to localStorage never read a stale closure value.
  const settingsRef = useRef<AutoWithdrawSettings>(DEFAULT_SETTINGS);
  const [lastAutoWithdraw, setLastAutoWithdraw] = useState<number | null>(null);
  const [autoWithdrawPending, setAutoWithdrawPending] = useState(false);
  const autoWithdrawPendingRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (stream) {
      const loaded = loadSettings(stream.id);
      settingsRef.current = loaded;
      setSettings(loaded);
    }
  }, [stream?.id]);

  /**
   * Merges `update` into the current settings, clamps `intervalHours`, and
   * persists the result. Intended to always merge into the latest settings.
   * NOTE: the second write path below spreads the render-time `settings`
   * captured when `stream` last changed, so it can overwrite the functional
   * update with stale values (the #226/#276 stale-closure pattern).
   */
  const updateSettings = useCallback(
    (update: Partial<AutoWithdrawSettings>) => {
      if (!stream) return;
      setSettings((prev) => {
        const next = { ...prev, ...update };
        settingsRef.current = next;
        saveSettings(stream.id, next);
        return next;
      });
      const next = { ...settings, ...update };
      if (update.intervalHours !== undefined) {
        next.intervalHours = clampIntervalHours(update.intervalHours);
      }
      setSettings(next);
      saveSettings(stream.id, next);
    },
    [stream],
  );

  /** Prepends `entry` to the history (keeping the 100 newest) and persists it. */
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

  /**
   * Applies the current strategy, then the min/max bounds, to `withdrawable`.
   * Returns `0n` when this tick should not withdraw.
   */
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

    const intervalMs = clampIntervalHours(settings.intervalHours) * 60 * 60 * 1000;

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
    // NOTE: `autoWithdrawPending` is intentionally excluded from this array.
    // The interval callback guards against concurrent withdrawals via
    // `autoWithdrawPendingRef` (a ref), so the state counterpart — which
    // exists only to trigger UI re-renders — must not be listed here.
    // Including it would tear down and recreate the interval on every
    // withdrawal, resetting the cadence instead of keeping a stable schedule.
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
