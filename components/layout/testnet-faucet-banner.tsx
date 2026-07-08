"use client";

import { useState, useEffect } from "react";
import { AlertCircle, Loader2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/hooks/use-wallet";
import { useNetwork } from "@/components/providers/network-provider";
import { getXlmBalance } from "@/lib/stellar";
import { toast } from "sonner";

interface TestnetFaucetBannerProps {
  onClose?: () => void;
}

/**
 * Testnet faucet banner that appears when a user is on testnet
 * with 0 XLM balance. Provides a one-click button to fund their
 * account via Friendbot.
 */
export function TestnetFaucetBanner({ onClose }: TestnetFaucetBannerProps) {
  const { address, isConnected } = useWallet();
  const { network } = useNetwork();

  const [xlmBalance, setXlmBalance] = useState<bigint | null>(null);
  const [loading, setLoading] = useState(true);
  const [funding, setFunding] = useState(false);
  const [fundingStatus, setFundingStatus] = useState<
    "idle" | "success" | "error"
  >("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [dismissed, setDismissed] = useState(false);

  // Only show on testnet
  const isTestnet = network === "testnet";

  // Fetch balance when address changes
  useEffect(() => {
    if (!address || !isConnected || !isTestnet) {
      setLoading(false);
      return;
    }

    setLoading(true);
    getXlmBalance(address, "testnet")
      .then((balance) => {
        setXlmBalance(balance);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, [address, isConnected, isTestnet]);

  // Hide if not applicable
  if (dismissed || !isTestnet || !isConnected || !address || loading) {
    return null;
  }

  // Hide if balance is not zero
  const isZeroBalance = xlmBalance === null || xlmBalance === 0n;
  if (!isZeroBalance) {
    return null;
  }

  async function fundWithFriendbot() {
    if (!address) return;
    setFunding(true);
    setFundingStatus("idle");
    setErrorMessage("");

    try {
      // Call Friendbot
      const friendbotUrl = `https://friendbot.stellar.org?addr=${encodeURIComponent(address)}`;
      const response = await fetch(friendbotUrl);

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(errorData || "Friendbot funding failed");
      }

      // Wait a moment for the transaction to be confirmed
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Refresh balance
      const newBalance = await getXlmBalance(address, "testnet");
      setXlmBalance(newBalance);
      setFundingStatus("success");

      toast.success("Account funded!", {
        description:
          "Your testnet account has been funded with test XLM from Friendbot.",
      });

      // Auto-dismiss after success
      setTimeout(() => {
        setDismissed(true);
        onClose?.();
      }, 5000);
    } catch (error) {
      console.error("Friendbot funding error:", error);
      setFundingStatus("error");
      const message =
        error instanceof Error
          ? error.message
          : "Failed to fund account. Please try again.";
      setErrorMessage(message);

      toast.error("Funding failed", {
        description: message,
      });
    } finally {
      setFunding(false);
    }
  }

  return (
    <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 space-y-3">
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" />
        <div className="flex-1">
          <p className="font-medium text-amber-700 dark:text-amber-300">
            Your testnet account needs funding
          </p>
          <p className="text-sm text-amber-600 dark:text-amber-400 mt-1">
            Fund your account with test XLM using Friendbot to start creating
            streams.
          </p>

          {fundingStatus === "success" && (
            <p className="text-sm text-green-600 dark:text-green-400 mt-2 flex items-center gap-1">
              <Check className="size-4" />
              Account funded successfully! Reloading...
            </p>
          )}

          {fundingStatus === "error" && (
            <p className="text-sm text-destructive mt-2 flex items-center gap-1">
              <X className="size-4" />
              {errorMessage}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          onClick={fundWithFriendbot}
          disabled={funding}
          className="gap-1.5 bg-amber-600 hover:bg-amber-700 text-white"
        >
          {funding && <Loader2 className="size-4 animate-spin" />}
          {funding ? "Funding..." : "Fund with Friendbot"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setDismissed(true)}
          disabled={funding}
          className="border-amber-500/40 text-amber-700 hover:bg-amber-500/10 dark:text-amber-400"
        >
          Dismiss
        </Button>
      </div>

      <p className="text-xs text-amber-600 dark:text-amber-400/70">
        {" "}
        Friendbot may be rate-limited if you fund multiple accounts. If funding
        fails, wait a few minutes and try again.
      </p>
    </div>
  );
}
