"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { xdr, scValToNative } from "@stellar/stellar-sdk";
import { useNetwork } from "@/components/providers/network-provider";
import { fetchStreamsForAddress } from "@/lib/contract";

const POLL_INTERVAL = 30_000;
const STORAGE_KEY = "flowstar:last-seen-ledger";
const NOTIF_STORAGE_KEY = "flowstar:notifications";

export interface AppNotification {
  id: string;
  type: "stream_created" | "stream_cancelled" | "withdrawal";
  title: string;
  body: string;
  timestamp: number;
  read: boolean;
}

function getLastSeenLedger(): number {
  if (typeof window === "undefined") return 0;
  return Number(localStorage.getItem(STORAGE_KEY) || "0");
}

function setLastSeenLedger(seq: number) {
  localStorage.setItem(STORAGE_KEY, String(seq));
}

function getSavedNotifications(): AppNotification[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(NOTIF_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveNotifications(notifs: AppNotification[]) {
  localStorage.setItem(NOTIF_STORAGE_KEY, JSON.stringify(notifs.slice(0, 50)));
}

async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === "undefined" || !("Notification" in window))
    return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}

function showBrowserNotification(title: string, body: string) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission === "granted") {
    new Notification(title, { body, icon: "/flowstar-logo-v2.png" });
  }
}

interface ContractEvent {
  type: string;
  ledger: number;
  value: {
    xdr: string;
  };
  topic: string[];
}

function decodeEventTopic(topics: string[]): {
  eventType: "StreamCreatedEvent" | "WithdrawEvent" | "CancelEvent" | null;
} {
  const topicStr = topics.join(",");
  if (
    topicStr.includes("StreamCreatedEvent") ||
    topicStr.includes("create_stream")
  ) {
    return { eventType: "StreamCreatedEvent" };
  }
  if (topicStr.includes("WithdrawEvent") || topicStr.includes("withdraw")) {
    return { eventType: "WithdrawEvent" };
  }
  if (topicStr.includes("CancelEvent") || topicStr.includes("cancel")) {
    return { eventType: "CancelEvent" };
  }
  return { eventType: null };
}

/**
 * Events carry the full struct payload (stream_id, sender, recipient, ...)
 * in `value.xdr` rather than the topics — none of the contract's events
 * declare `#[topic]` fields. We only need `stream_id` here since caller-side
 * scoping is done by cross-referencing against the connected wallet's own
 * sent/received stream IDs.
 */
function decodeEventStreamId(value: { xdr: string }): string | null {
  try {
    const scVal = xdr.ScVal.fromXDR(value.xdr, "base64");
    const native = scValToNative(scVal) as Record<string, unknown>;
    const streamId = native?.stream_id;
    if (streamId === undefined || streamId === null) return null;
    return String(streamId);
  } catch {
    return null;
  }
}

async function fetchContractEvents(
  startLedger: number,
  rpcUrl: string,
  contractId: string,
): Promise<{ events: ContractEvent[]; latestLedger: number }> {
  if (!contractId) return { events: [], latestLedger: startLedger };

  try {
    const body: Record<string, unknown> = {
      jsonrpc: "2.0",
      id: 1,
      method: "getEvents",
      params: {
        startLedger,
        filters: [
          {
            type: "contract",
            contractIds: [contractId],
          },
        ],
        pagination: { limit: 100 },
      },
    };

    const res = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const json = (await res.json()) as {
      result?: {
        events?: ContractEvent[];
        latestLedger?: number;
      };
    };

    return {
      events: json.result?.events ?? [],
      latestLedger: json.result?.latestLedger ?? startLedger,
    };
  } catch {
    return { events: [], latestLedger: startLedger };
  }
}

export function useNotifications(walletAddress: string | null) {
  const { network, config } = useNetwork();
  const [notifications, setNotifications] = useState<AppNotification[]>(() =>
    getSavedNotifications(),
  );
  const [unreadCount, setUnreadCount] = useState(0);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setUnreadCount(notifications.filter((n) => !n.read).length);
  }, [notifications]);

  const addNotification = useCallback(
    (notif: Omit<AppNotification, "id" | "timestamp" | "read">) => {
      const newNotif: AppNotification = {
        ...notif,
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        timestamp: Date.now(),
        read: false,
      };
      setNotifications((prev) => {
        const updated = [newNotif, ...prev].slice(0, 50);
        saveNotifications(updated);
        return updated;
      });
      showBrowserNotification(notif.title, notif.body);
    },
    [],
  );

  const markAllRead = useCallback(() => {
    setNotifications((prev) => {
      const updated = prev.map((n) => ({ ...n, read: true }));
      saveNotifications(updated);
      return updated;
    });
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
    saveNotifications([]);
  }, []);

  useEffect(() => {
    const rpcUrl = config.rpcUrl;
    const contractId = config.streamContractId;
    if (!walletAddress || !contractId) return;
    const address = walletAddress;

    requestNotificationPermission();

    async function poll() {
      const lastLedger = getLastSeenLedger();
      let startLedger = lastLedger;

      if (startLedger === 0) {
        try {
          const res = await fetch(rpcUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              jsonrpc: "2.0",
              id: 1,
              method: "getLatestLedger",
            }),
          });
          const json = (await res.json()) as { result?: { sequence?: number } };
          startLedger = (json.result?.sequence ?? 1) - 1;
          setLastSeenLedger(startLedger);
          return;
        } catch {
          return;
        }
      }

      const { events, latestLedger } = await fetchContractEvents(
        startLedger + 1,
        rpcUrl,
        contractId,
      );

      if (events.length > 0) {
        // Scope events to this wallet: the contract emits one shared event
        // stream for every user, so we cross-reference each event's
        // stream_id against the streams this wallet actually sent/received
        // before surfacing a notification for it.
        const myStreams = await fetchStreamsForAddress(network, address);
        const sentIds = new Set(
          myStreams.filter((s) => s.sender === address).map((s) => s.id),
        );
        const receivedIds = new Set(
          myStreams.filter((s) => s.recipient === address).map((s) => s.id),
        );

        for (const event of events) {
          const { eventType } = decodeEventTopic(event.topic ?? []);
          if (!eventType) continue;

          const streamId = decodeEventStreamId(event.value);
          if (!streamId) continue;

          if (eventType === "StreamCreatedEvent" && receivedIds.has(streamId)) {
            addNotification({
              type: "stream_created",
              title: "New stream received",
              body: "A new payment stream has been created for you.",
            });
          } else if (eventType === "CancelEvent" && receivedIds.has(streamId)) {
            addNotification({
              type: "stream_cancelled",
              title: "Stream cancelled",
              body: "A stream you are receiving has been cancelled.",
            });
          } else if (eventType === "WithdrawEvent" && sentIds.has(streamId)) {
            addNotification({
              type: "withdrawal",
              title: "Withdrawal from your stream",
              body: "A withdrawal has been made from a stream you sent.",
            });
          }
        }
      }

      if (latestLedger > startLedger) {
        setLastSeenLedger(latestLedger);
      }
    }

    poll();
    pollingRef.current = setInterval(poll, POLL_INTERVAL);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [
    walletAddress,
    addNotification,
    config.rpcUrl,
    config.streamContractId,
    network,
  ]);

  return { notifications, unreadCount, markAllRead, clearAll };
}
