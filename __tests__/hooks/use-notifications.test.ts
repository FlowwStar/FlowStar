import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import type { StreamData } from "@/types/stream";

// ── Mocks ──────────────────────────────────────────────────────────────────
vi.mock("@/lib/contract", () => ({
  fetchStreamsForAddress: vi.fn(),
}));

vi.mock("@/components/providers/network-provider", () => ({
  useNetwork: vi.fn(() => ({
    network: "testnet",
    config: { rpcUrl: "https://rpc.test", streamContractId: "CONTRACT123" },
  })),
}));

// The real SDK parses genuine XDR; tests only need to prove that
// `decodeEventStreamId` -> `scValToNative(xdr.ScVal.fromXDR(...))` is fed
// into the wallet-scoping filter, so the mock treats `value.xdr` as a
// pre-serialized JSON payload instead of real base64 XDR.
vi.mock("@stellar/stellar-sdk", () => ({
  xdr: { ScVal: { fromXDR: (raw: string) => raw } },
  scValToNative: (raw: string) => JSON.parse(raw),
}));

import { fetchStreamsForAddress } from "@/lib/contract";
import { useNotifications } from "@/hooks/use-notifications";

const WALLET = "GWALLET_SELF";
const OTHER = "GWALLET_OTHER";

const myStreams: StreamData[] = [
  {
    id: "1", // sent by the connected wallet
    sender: WALLET,
    recipient: OTHER,
    token: { address: "TOKEN", symbol: "USDC", decimals: 7 },
    depositedAmount: 1000n,
    withdrawnAmount: 0n,
    startTime: 0n,
    endTime: 9999999999n,
    cliffTime: 0n,
    cliffAmount: 0n,
    amountPerSecond: 1n,
    cancelled: false,
  },
  {
    id: "2", // received by the connected wallet
    sender: OTHER,
    recipient: WALLET,
    token: { address: "TOKEN", symbol: "USDC", decimals: 7 },
    depositedAmount: 1000n,
    withdrawnAmount: 0n,
    startTime: 0n,
    endTime: 9999999999n,
    cliffTime: 0n,
    cliffAmount: 0n,
    amountPerSecond: 1n,
    cancelled: false,
  },
];

function makeEvent(topic: string, streamId: string) {
  return {
    type: "contract",
    ledger: 501,
    topic: [topic],
    value: { xdr: JSON.stringify({ stream_id: streamId }) },
  };
}

describe("useNotifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    // Seed a non-zero last-seen ledger so the first poll fetches events
    // immediately instead of only bootstrapping the ledger cursor.
    localStorage.setItem("flowstar:last-seen-ledger", "500");
    vi.mocked(fetchStreamsForAddress).mockResolvedValue(myStreams);
  });

  it("only surfaces notifications for streams the wallet actually sent or received", async () => {
    const events = [
      makeEvent("StreamCreatedEvent", "2"), // received by wallet -> notify
      makeEvent("StreamCreatedEvent", "99"), // unrelated stream -> no notify
      makeEvent("WithdrawEvent", "1"), // wallet is sender -> notify
      makeEvent("WithdrawEvent", "2"), // wallet is recipient, not sender -> no notify
      makeEvent("CancelEvent", "2"), // received by wallet -> notify
      makeEvent("CancelEvent", "99"), // unrelated stream -> no notify
    ];

    global.fetch = vi.fn(async (_url, init) => {
      const body = JSON.parse((init as RequestInit).body as string);
      if (body.method === "getEvents") {
        return {
          json: async () => ({ result: { events, latestLedger: 505 } }),
        } as Response;
      }
      return { json: async () => ({ result: {} }) } as Response;
    });

    const { result } = renderHook(() => useNotifications(WALLET));

    await waitFor(() => expect(result.current.notifications).toHaveLength(3));

    expect(fetchStreamsForAddress).toHaveBeenCalledWith("testnet", WALLET);

    const bodies = result.current.notifications.map((n) => n.body);
    expect(bodies).toContain("A new payment stream has been created for you.");
    expect(bodies).toContain(
      "A withdrawal has been made from a stream you sent.",
    );
    expect(bodies).toContain("A stream you are receiving has been cancelled.");
  });

  it("does not notify at all when none of the events belong to the wallet", async () => {
    const events = [
      makeEvent("StreamCreatedEvent", "99"),
      makeEvent("WithdrawEvent", "99"),
      makeEvent("CancelEvent", "99"),
    ];

    global.fetch = vi.fn(async (_url, init) => {
      const body = JSON.parse((init as RequestInit).body as string);
      if (body.method === "getEvents") {
        return {
          json: async () => ({ result: { events, latestLedger: 505 } }),
        } as Response;
      }
      return { json: async () => ({ result: {} }) } as Response;
    });

    const { result } = renderHook(() => useNotifications(WALLET));

    await waitFor(() => expect(fetchStreamsForAddress).toHaveBeenCalled());
    // Give the poll a tick to process events before asserting nothing landed.
    await new Promise((r) => setTimeout(r, 0));

    expect(result.current.notifications).toHaveLength(0);
  });
});
