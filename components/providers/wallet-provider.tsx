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

export interface WalletAdapter {
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
// Prefers the LOBSTR browser extension (window.lobstrSDK); falls back to
// WalletConnect v2 so mobile users can connect via the LOBSTR app.

let _lobstrWcClient: any = null;
let _lobstrWcSession: any = null;

async function connectLobstrViaWalletConnect(): Promise<string> {
  const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
  if (!projectId) {
    throw new Error(
      "Set NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID to enable LOBSTR on mobile. " +
        "Get a free project ID at https://cloud.walletconnect.com",
    );
  }

  const { SignClient } = await import("@walletconnect/sign-client");
  const { WalletConnectModal } = await import("@walletconnect/modal");

  const client = await SignClient.init({
    projectId,
    metadata: {
      name: "FlowStar",
      description: "Stellar payment streaming",
      url: typeof window !== "undefined" ? window.location.origin : "",
      icons: [],
    },
  });

  const modal = new WalletConnectModal({
    projectId,
    chains: ["stellar:pubnet"],
  });

  return new Promise(async (resolve, reject) => {
    try {
      const { uri, approval } = await client.connect({
        requiredNamespaces: {
          stellar: {
            methods: ["stellar_signXDR"],
            chains: ["stellar:pubnet"],
            events: [],
          },
        },
      });

      if (uri) modal.openModal({ uri });

      const session = await approval();
      modal.closeModal();
      _lobstrWcClient = client;
      _lobstrWcSession = session;

      const account = session.namespaces.stellar?.accounts[0];
      const address = account?.split(":")[2];
      if (!address)
        throw new Error(
          "LOBSTR WalletConnect session has no Stellar accounts.",
        );
      resolve(address);
    } catch (err) {
      try {
        modal.closeModal();
      } catch {
        /* ignore */
      }
      reject(err instanceof Error ? err : new Error(String(err)));
    }
  });
}

async function signWithLobstrWalletConnect(
  xdr: string,
  networkPassphrase: string,
): Promise<string> {
  if (!_lobstrWcClient || !_lobstrWcSession) {
    throw new Error(
      "No active LOBSTR WalletConnect session. Reconnect LOBSTR.",
    );
  }
  const chainId = networkPassphrase.includes("Test")
    ? "stellar:testnet"
    : "stellar:pubnet";
  const result = await _lobstrWcClient.request({
    topic: _lobstrWcSession.topic,
    chainId,
    request: { method: "stellar_signXDR", params: { xdr } },
  });
  if (!result?.signedXDR)
    throw new Error("LOBSTR WalletConnect signing returned no signed XDR.");
  return result.signedXDR;
}

export const lobstrAdapter: WalletAdapter = {
  isAvailable: () => true, // WalletConnect available even without extension

  async connect() {
    if (typeof window !== "undefined" && (window as any).lobstrSDK) {
      const sdk = (window as any).lobstrSDK;
      const { publicKey } = await sdk.getPublicKey();
      if (!publicKey) throw new Error("LOBSTR did not return a public key.");
      return publicKey;
    }
    return connectLobstrViaWalletConnect();
  },

  async signTransaction(xdr, networkPassphrase) {
    if (typeof window !== "undefined" && (window as any).lobstrSDK) {
      const sdk = (window as any).lobstrSDK;
      const { signedXdr } = await sdk.signTransaction(xdr, {
        networkPassphrase,
      });
      if (!signedXdr) throw new Error("LOBSTR signing failed.");
      return signedXdr;
    }
    return signWithLobstrWalletConnect(xdr, networkPassphrase);
  },
};

// ─── Albedo adapter ───────────────────────────────────────────────────────────

const albedoAdapter: WalletAdapter = {
  isAvailable: () => true, // web-based — always available

  async connect() {
    const albedo = (await import("@albedo-link/intent")).default;
    try {
      const result = await albedo.publicKey({});
      if (!result?.pubkey)
        throw new Error("Albedo did not return a public key.");
      return result.pubkey;
    } catch (err: unknown) {
      if (err instanceof Error && /popup/i.test(err.message)) {
        throw new Error(
          "Albedo popup was blocked. Allow popups for this site and try again.",
        );
      }
      throw err;
    }
  },

  async signTransaction(xdr, networkPassphrase) {
    const albedo = (await import("@albedo-link/intent")).default;
    const network = networkPassphrase.includes("Test") ? "testnet" : "public";
    const result = await albedo.tx({ xdr, network, submit: false });
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

// ─── Freighter network helpers ────────────────────────────────────────────────

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
      return getAdapter(walletId).signTransaction(xdr, config.passphrase);
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
