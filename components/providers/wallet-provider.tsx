"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { setSignTransaction } from "@/lib/contract";
import { type NetworkName, getNetworkConfig } from "@/lib/stellar";
import { setSentryUser } from "@/lib/sentry";
import { useNetwork } from "./network-provider";

// ─── Wallet options ───────────────────────────────────────────────────────────

export interface WalletOption {
  id: string;
  name: string;
  detail: string;
}

export const WALLET_OPTIONS: WalletOption[] = [
  {
    id: "freighter",
    name: "Freighter",
    detail: "Browser extension · stellar.org",
  },
  { id: "xbull", name: "xBull", detail: "Extension & web" },
  { id: "lobstr", name: "LOBSTR", detail: "Mobile & extension" },
  { id: "albedo", name: "Albedo", detail: "Web signer" },
];

// ─── Wallet adapter interface ─────────────────────────────────────────────────

interface WalletAdapter {
  connect(): Promise<string>;
  signTransaction(xdr: string, networkPassphrase: string): Promise<string>;
  isAvailable(): boolean;
}

// ─── Freighter adapter ────────────────────────────────────────────────────────

const freighterAdapter: WalletAdapter = {
  isAvailable: () =>
    typeof window !== "undefined" && !!(window as any).freighter,

  async connect() {
    const { isConnected, getAddress, requestAccess } =
      await import("@stellar/freighter-api");
    const { isConnected: connected } = await isConnected();
    if (!connected)
      throw new Error(
        "Freighter is not installed. Install the extension and refresh.",
      );
    await requestAccess();
    const result = await getAddress();
    if (result.error) throw new Error(result.error);
    return result.address;
  },

  async signTransaction(xdr, networkPassphrase) {
    const { signTransaction } = await import("@stellar/freighter-api");
    const result = await signTransaction(xdr, { networkPassphrase });
    if (result.error) throw new Error(result.error);
    return result.signedTxXdr;
  },
};

// ─── xBull adapter ────────────────────────────────────────────────────────────
// Uses the xBull Wallet Connect SDK (window.xBullSDK injected by extension)

const xbullAdapter: WalletAdapter = {
  isAvailable: () =>
    typeof window !== "undefined" && !!(window as any).xBullSDK,

  async connect() {
    const sdk = (window as any).xBullSDK;
    if (!sdk)
      throw new Error(
        "xBull is not installed. Install the xBull extension and refresh.",
      );
    const result = await sdk.connect();
    if (!result?.publicKey)
      throw new Error("xBull did not return a public key.");
    return result.publicKey;
  },

  async signTransaction(xdr, networkPassphrase) {
    const sdk = (window as any).xBullSDK;
    if (!sdk) throw new Error("xBull is not installed.");
    const result = await sdk.signXDR(xdr, { networkPassphrase });
    if (!result?.signedXDR) throw new Error("xBull signing failed.");
    return result.signedXDR;
  },
};

// ─── LOBSTR adapter ───────────────────────────────────────────────────────────
// Uses the LOBSTR extension injected as window.lobstrSDK

const lobstrAdapter: WalletAdapter = {
  isAvailable: () =>
    typeof window !== "undefined" && !!(window as any).lobstrSDK,

  async connect() {
    const sdk = (window as any).lobstrSDK;
    if (!sdk)
      throw new Error(
        "LOBSTR extension is not installed. Install it and refresh.",
      );
    const { publicKey } = await sdk.getPublicKey();
    if (!publicKey) throw new Error("LOBSTR did not return a public key.");
    return publicKey;
  },

  async signTransaction(xdr, networkPassphrase) {
    const sdk = (window as any).lobstrSDK;
    if (!sdk) throw new Error("LOBSTR extension is not installed.");
    const { signedXdr } = await sdk.signTransaction(xdr, { networkPassphrase });
    if (!signedXdr) throw new Error("LOBSTR signing failed.");
    return signedXdr;
  },
};

// ─── Albedo adapter ───────────────────────────────────────────────────────────
// Uses the albedo-link JS library for intent-based signing

const albedoAdapter: WalletAdapter = {
  isAvailable: () => true, // web-based — always available

  async connect() {
    const albedo = (await import("albedo-link")).default;
    const result = await albedo.publicKey({});
    if (!result?.pubkey) throw new Error("Albedo did not return a public key.");
    return result.pubkey;
  },

  async signTransaction(xdr, networkPassphrase) {
    const albedo = (await import("albedo-link")).default;
    const result = await albedo.tx({
      xdr,
      network: networkPassphrase,
      submit: false,
    });
    if (!result?.signed_envelope_xdr) throw new Error("Albedo signing failed.");
    return result.signed_envelope_xdr;
  },
};

// ─── Adapter registry ─────────────────────────────────────────────────────────

const ADAPTERS: Record<string, WalletAdapter> = {
  freighter: freighterAdapter,
  xbull: xbullAdapter,
  lobstr: lobstrAdapter,
  albedo: albedoAdapter,
};

function getAdapter(id: string): WalletAdapter {
  const adapter = ADAPTERS[id];
  if (!adapter) throw new Error(`Unknown wallet: ${id}`);
  return adapter;
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface WalletContextValue {
  address: string | null;
  walletId: string | null;
  connecting: boolean;
  reconnecting: boolean;
  isConnected: boolean;
  networkMismatch: boolean;
  walletNetwork: string | null;
  connect: (walletId: string) => Promise<void>;
  disconnect: () => void;
  signTransaction: (xdr: string, network?: NetworkName) => Promise<string>;
}

const WalletContext = createContext<WalletContextValue | null>(null);

// ─── Wallet adapters ─────────────────────────────────────────────────────────

async function connectFreighter(): Promise<string> {
  const { isConnected, getAddress, requestAccess } =
    await import("@stellar/freighter-api");
  const connected = await isConnected();
  if (!connected.isConnected) {
    throw new Error(
      "Freighter is not installed. Please install the Freighter extension.",
    );
  }
  await requestAccess();
  const result = await getAddress();
  if (result.error) throw new Error(result.error);
  return result.address;
}

async function getFreighterNetwork(): Promise<string | null> {
  try {
    const { getNetwork } = await import("@stellar/freighter-api");
    const result = await getNetwork();
    if (result.error) return null;
    return result.network ?? null;
  } catch {
    return null;
  }
}

async function signWithFreighter(
  xdr: string,
  networkPassphrase: string,
): Promise<string> {
  const { signTransaction } = await import("@stellar/freighter-api");
  const result = await signTransaction(xdr, { networkPassphrase });
  if (result.error) throw new Error(result.error);
  return result.signedTxXdr;
}

function passphraseToAlbedoNetwork(passphrase: string): "testnet" | "public" {
  if (passphrase.includes("Test")) return "testnet";
  return "public";
}

async function connectAlbedo(): Promise<string> {
  const albedo = await import("@albedo-link/intent");
  try {
    const result = await albedo.default.publicKey({});
    return result.pubkey;
  } catch (err: unknown) {
    if (err instanceof Error && /popup/i.test(err.message)) {
      throw new Error(
        "Albedo popup was blocked. Please allow popups for this site and try again.",
      );
    }
    throw err;
  }
}

async function signWithAlbedo(
  xdr: string,
  networkPassphrase: string,
): Promise<string> {
  const albedo = await import("@albedo-link/intent");
  const result = await albedo.default.tx({
    xdr,
    network: passphraseToAlbedoNetwork(networkPassphrase),
    submit: false,
  });
  return result.signed_envelope_xdr;
}

async function connectXBull(): Promise<string> {
  if (typeof window === "undefined" || !(window as any).xBullSDK) {
    throw new Error(
      "xBull is not installed. Install the xBull extension from https://xbull.app and refresh.",
    );
  }
  const sdk = (window as any).xBullSDK;
  const result = await sdk.connect();
  if (!result?.publicKey) throw new Error("xBull did not return a public key.");
  return result.publicKey;
}

async function signWithXBull(
  xdr: string,
  networkPassphrase: string,
): Promise<string> {
  if (typeof window === "undefined" || !(window as any).xBullSDK) {
    throw new Error("xBull is not installed.");
  }
  const sdk = (window as any).xBullSDK;
  const result = await sdk.signXDR(xdr, { networkPassphrase });
  if (!result?.signedXDR)
    throw new Error("xBull signing failed or was rejected.");
  return result.signedXDR;
}

// Stubs for wallets that need a dedicated SDK — shows a helpful message
async function connectStub(name: string): Promise<string> {
  throw new Error(
    `${name} connection requires the ${name} browser extension. Install it and refresh.`,
  );
}

async function connectWallet(id: string): Promise<string> {
  switch (id) {
    case "freighter":
      return connectFreighter();
    case "xbull":
      return connectXBull();
    case "lobstr":
      return connectStub("LOBSTR");
    case "albedo":
      return connectAlbedo();
    default:
      throw new Error(`Unknown wallet: ${id}`);
  }
}

// Maps Freighter network names → our NetworkName
function normalizeFreighterNetwork(raw: string): NetworkName | null {
  const lower = raw.toLowerCase();
  if (lower.includes("test")) return "testnet";
  if (lower === "mainnet" || lower === "public" || lower.includes("public"))
    return "mainnet";
  return null;
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [walletId, setWalletId] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [reconnecting, setReconnecting] = useState(true);
  const [walletNetwork, setWalletNetwork] = useState<string | null>(null);
  const { network } = useNetwork();

  // Auto-reconnect on mount using persisted walletId
  useEffect(() => {
    const saved = localStorage.getItem("walletId");
    if (!saved) {
      setReconnecting(false);
      return;
    }
    getAdapter(saved)
      .connect()
      .then((addr) => {
        setAddress(addr);
        setWalletId(saved);
      })
      .catch(() => {
        localStorage.removeItem("walletId");
      })
      .finally(() => setReconnecting(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Poll Freighter's active network while connected
  useEffect(() => {
    if (!address || walletId !== "freighter") {
      setWalletNetwork(null);
      return;
    }
    let cancelled = false;
    const check = () => {
      getFreighterNetwork().then((net) => {
        if (!cancelled) setWalletNetwork(net);
      });
    };
    check();
    const interval = setInterval(check, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [address, walletId]);

  const networkMismatch = useMemo(() => {
    if (!address || walletId !== "freighter" || !walletNetwork) return false;
    const normalized = normalizeFreighterNetwork(walletNetwork);
    return normalized !== null && normalized !== network;
  }, [address, walletId, walletNetwork, network]);

  const connect = useCallback(async (id: string) => {
    setConnecting(true);
    try {
      const addr = await getAdapter(id).connect();
      setAddress(addr);
      setWalletId(id);
      localStorage.setItem("walletId", id);
      setSentryUser(addr);
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setAddress(null);
    setWalletId(null);
    setWalletNetwork(null);
    localStorage.removeItem("walletId");
    setSentryUser(null);
  }, []);

  const signTransaction = useCallback(
    async (xdr: string, customNetwork?: NetworkName): Promise<string> => {
      if (!walletId) throw new Error("No wallet connected");
      const config = getNetworkConfig(customNetwork ?? network);
      switch (walletId) {
        case "freighter":
          return signWithFreighter(xdr, config.passphrase);
        case "xbull":
          return signWithXBull(xdr, config.passphrase);
        case "albedo":
          return signWithAlbedo(xdr, config.passphrase);
        default:
          throw new Error(`Signing not implemented for ${walletId}`);
      }
    },
    [walletId, network],
  );

  // Keep contract layer in sync
  useEffect(() => {
    setSignTransaction((xdr: string) => signTransaction(xdr));
  }, [signTransaction]);

  const value = useMemo<WalletContextValue>(
    () => ({
      address,
      walletId,
      connecting,
      reconnecting,
      isConnected: address !== null,
      networkMismatch,
      walletNetwork,
      connect,
      disconnect,
      signTransaction,
    }),
    [
      address,
      walletId,
      connecting,
      reconnecting,
      networkMismatch,
      walletNetwork,
      connect,
      disconnect,
      signTransaction,
    ],
  );

  return (
    <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useWalletContext() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used within a WalletProvider");
  return ctx;
}
