"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Info,
  Loader2,
  Copy,
  Clock,
  CheckCircle2,
  Pencil,
  X,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { StrKey } from "@stellar/stellar-sdk";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useContract } from "@/hooks/use-contract";
import { useWallet } from "@/hooks/use-wallet";
import { getAllTokens, saveCustomToken, checkAccountInfo } from "@/lib/stellar";
import { getTokenMetadata, getTokenBalance } from "@/lib/contract";
import { parseTokenAmount, formatTokenAmount } from "@/lib/stream-utils";
import { StreamPreview } from "@/components/streams/stream-preview";
import { CreateConfirmation } from "@/components/streams/create-confirmation";
import { TxPreviewDialog } from "@/components/ui/tx-preview-dialog";
import {
  addAddressBookEntry,
  deleteAddressBookEntry,
  getAddressBookEntries,
  touchAddressBookEntry,
  updateAddressBookEntry,
} from "@/lib/address-book";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { isFederationAddress, resolveFederationAddress } from "@/lib/federation";
import {
  buildNextRunAt,
  saveRecurringRule,
  type RecurrenceCadence,
} from "@/lib/recurring";
import { useFormDraft, clearExpiredDrafts } from "@/hooks/use-form-draft";
import {
  StreamTemplates,
  type StreamTemplate,
} from "@/components/streams/stream-templates";
import { useTokenPrice } from "@/hooks/use-token-price";
import type { TokenInfo } from "@/types/stream";
import { useNetwork } from "@/components/providers/network-provider";
import { createFormCopy as copy } from "@/lib/copy/create-form";

const CUSTOM_VALUE = "__custom__";

function toUnixSeconds(localDatetimeValue: string): bigint {
  return BigInt(Math.floor(new Date(localDatetimeValue).getTime() / 1000));
}

function localDatetimeMin(offsetSeconds = 0): string {
  const d = new Date(Date.now() + offsetSeconds * 1000);
  // Format as YYYY-MM-DDTHH:mm in local time (not UTC)
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function addDuration(baseDatetime: string, seconds: number): string {
  const base = new Date(baseDatetime);
  const d = new Date(base.getTime() + seconds * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "UTC";
  }
}

function getTimezoneOffset(): string {
  const offset = -new Date().getTimezoneOffset();
  const sign = offset >= 0 ? "+" : "-";
  const h = Math.floor(Math.abs(offset) / 60);
  const m = Math.abs(offset) % 60;
  return `UTC${sign}${h}${m > 0 ? `:${String(m).padStart(2, "0")}` : ""}`;
}

const COMMON_TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
] as const;

const DURATION_PRESETS = [
  { label: copy.scheduleSection.durationPresetLabels[0], seconds: 7 * 24 * 3600 },
  { label: copy.scheduleSection.durationPresetLabels[1], seconds: 30 * 24 * 3600 },
  { label: copy.scheduleSection.durationPresetLabels[2], seconds: 90 * 24 * 3600 },
  { label: copy.scheduleSection.durationPresetLabels[3], seconds: 180 * 24 * 3600 },
  { label: copy.scheduleSection.durationPresetLabels[4], seconds: 365 * 24 * 3600 },
] as const;

const CLIFF_PRESETS = [
  { label: copy.scheduleSection.cliffPresetLabels[0], seconds: 0 },
  { label: copy.scheduleSection.cliffPresetLabels[1], seconds: 30 * 24 * 3600 },
  { label: copy.scheduleSection.cliffPresetLabels[2], seconds: 90 * 24 * 3600 },
] as const;

interface FormState {
  recipient: string;
  tokenAddress: string;
  amount: string;
  startDate: string;
  endDate: string;
  hasCliff: boolean;
  cliffDate: string;
  cliffAmount: string;
}

export function CreateForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const cloneId = searchParams.get("clone");
  const { address: walletAddress } = useWallet();
  const { network } = useNetwork();
  const { createStream, estimateFee, pending, error } = useContract();
  const [feeEstimate, setFeeEstimate] = useState<string | null>(null);
  const [estimatingFee, setEstimatingFee] = useState(false);
  const [showTxPreview, setShowTxPreview] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const [tokens, setTokens] = useState<TokenInfo[]>(() =>
    getAllTokens(network).map((t) => ({ ...t })),
  );
  const [isCustom, setIsCustom] = useState(false);
  const [customAddress, setCustomAddress] = useState("");
  const [customLoading, setCustomLoading] = useState(false);
  const [customError, setCustomError] = useState<string | null>(null);
  const [customToken, setCustomToken] = useState<TokenInfo | null>(null);
  const [addressBookEntries, setAddressBookEntries] = useState(() =>
    getAddressBookEntries(),
  );
  // Issue #687: rename dialog state for the "Recent recipients" list.
  const [renamingEntry, setRenamingEntry] = useState<{
    id: string;
    label: string;
  } | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [recurrenceCadence, setRecurrenceCadence] =
    useState<RecurrenceCadence>("none");

  // Tracks the connected wallet's token balance for validation
  const [tokenBalance, setTokenBalance] = useState<bigint | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);

  // Validates recipient account existence, funding status, and transaction history
  const [recipientAccountInfo, setRecipientAccountInfo] = useState<{
    exists: boolean;
    funded: boolean;
    transactionCount: number;
  } | null>(null);
  const [recipientChecking, setRecipientChecking] = useState(false);
  const [recipientWarningAcknowledged, setRecipientWarningAcknowledged] =
    useState(false);

  const defaultStart = localDatetimeMin(60);
  const defaultEnd = localDatetimeMin(60 + 30 * 24 * 3600);

  const [form, setForm] = useState<FormState>(() => {
    const newStart = localDatetimeMin(60);
    const durationSecs = searchParams.get("duration");
    const cliffSecs = searchParams.get("cliff");
    const hasCliff = cliffSecs !== null && cliffSecs !== "0";
    const newEnd = durationSecs
      ? addDuration(newStart, Number(durationSecs))
      : localDatetimeMin(60 + 30 * 24 * 3600);
    const newCliff =
      hasCliff && cliffSecs
        ? addDuration(newStart, Number(cliffSecs))
        : newStart;

    return {
      recipient: searchParams.get("recipient") ?? "",
      tokenAddress: searchParams.get("token") ?? tokens[0]?.address ?? "",
      amount: searchParams.get("amount") ?? "",
      startDate: newStart,
      endDate: newEnd,
      hasCliff,
      cliffDate: newCliff,
      cliffAmount: searchParams.get("cliffAmount") ?? "",
    };
  });

  // Issue #155: Federation address (name*domain.com) support for the
  // recipient field. `recipientInput` is exactly what the user typed
  // (either a raw G-address or a Federation address); `form.recipient`
  // always holds the resolved G-address actually used for the transaction.
  const [recipientInput, setRecipientInput] = useState(form.recipient);
  const [federationStatus, setFederationStatus] = useState<
    "idle" | "loading" | "resolved" | "error"
  >("idle");
  const [federationError, setFederationError] = useState<string | null>(null);
  const [federationResolved, setFederationResolved] = useState<{
    federationAddress: string;
    accountId: string;
  } | null>(null);

  useEffect(() => {
    const raw = recipientInput.trim();

    if (!raw) {
      setFederationStatus("idle");
      setFederationError(null);
      setFederationResolved(null);
      set("recipient", "");
      return;
    }

    if (!isFederationAddress(raw)) {
      setFederationStatus("idle");
      setFederationError(null);
      setFederationResolved(null);
      set("recipient", raw);
      return;
    }

    setFederationStatus("loading");
    setFederationError(null);
    let cancelled = false;
    const timer = setTimeout(() => {
      resolveFederationAddress(raw)
        .then((result) => {
          if (cancelled) return;
          setFederationResolved({
            federationAddress: result.federationAddress,
            accountId: result.accountId,
          });
          setFederationStatus("resolved");
          set("recipient", result.accountId);
        })
        .catch((err) => {
          if (cancelled) return;
          setFederationResolved(null);
          setFederationStatus("error");
          setFederationError(
            err instanceof Error ? err.message : copy.errors.federationLookupFailed,
          );
          set("recipient", "");
        });
    }, 500);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipientInput]);

  const [errors, setErrors] = useState<
    Partial<Record<keyof FormState, string>>
  >({});
  const [selectedTemplateId, setSelectedTemplateId] = useState<
    string | undefined
  >(undefined);

  // Issue #168: draft state
  const [showDraftBanner, setShowDraftBanner] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<number | null>(null);
  const isFirstMount = useRef(true);

  // Issue #170: timezone state
  const [selectedTimezone, setSelectedTimezone] = useState(() =>
    detectTimezone(),
  );
  const timezoneOffset = getTimezoneOffset();

  const selectedToken =
    isCustom && customToken
      ? customToken
      : (tokens.find((t) => t.address === form.tokenAddress) ?? tokens[0]);

  // Issue #186: USD conversion
  const [usdInputMode, setUsdInputMode] = useState(false);
  const [usdAmount, setUsdAmount] = useState("");
  const {
    usdPrice,
    stale: priceStale,
    loading: priceLoading,
  } = useTokenPrice(selectedToken?.symbol ?? "");

  const supportsUsd = usdPrice !== null;
  const tokenAmountNum = parseFloat(form.amount) || 0;
  const usdEquivalent =
    supportsUsd && tokenAmountNum > 0
      ? (tokenAmountNum * usdPrice).toFixed(2)
      : null;

  const amountPerSecondUsd =
    usdEquivalent &&
    (() => {
      const dur =
        (new Date(form.endDate).getTime() -
          new Date(form.startDate).getTime()) /
        1000;
      if (dur <= 0) return null;
      const usdPerSec = parseFloat(usdEquivalent) / dur;
      return usdPerSec < 0.01
        ? usdPerSec.toExponential(2)
        : usdPerSec.toFixed(4);
    })();

  function handleUsdAmountChange(val: string) {
    setUsdAmount(val);
    if (usdPrice && val) {
      const tokenAmt = parseFloat(val) / usdPrice;
      if (!isNaN(tokenAmt))
        set("amount", tokenAmt.toFixed(selectedToken?.decimals ?? 7));
    } else {
      set("amount", "");
    }
  }

  // Fetch balance when token or wallet changes
  useEffect(() => {
    if (!walletAddress || !selectedToken) return;
    setTokenBalance(null);
    setBalanceLoading(true);
    getTokenBalance(selectedToken.address, walletAddress)
      .then(setTokenBalance)
      .catch(() => setTokenBalance(null))
      .finally(() => setBalanceLoading(false));
  }, [selectedToken?.address, walletAddress]);

  // Issue #103: Check recipient account info when address changes
  useEffect(() => {
    const recipient = form.recipient.trim();
    if (!recipient || !StrKey.isValidEd25519PublicKey(recipient)) {
      setRecipientAccountInfo(null);
      setRecipientWarningAcknowledged(false);
      return;
    }

    setRecipientChecking(true);
    checkAccountInfo(recipient, network)
      .then((info) => {
        setRecipientAccountInfo(info);
        setRecipientWarningAcknowledged(false);
      })
      .catch(() => {
        setRecipientAccountInfo(null);
      })
      .finally(() => {
        setRecipientChecking(false);
      });
  }, [form.recipient, network]);

  // Issue #168: wire up draft hook
  const { loadDraft, restore, discard } = useFormDraft(
    `create-stream-${walletAddress ?? "anonymous"}`,
    form,
    (draft) => {
      setForm(draft);
      setRecipientInput(draft.recipient);
    },
    true,
  );

  // Check for existing draft on first mount
  useEffect(() => {
    if (!isFirstMount.current) return;
    isFirstMount.current = false;
    clearExpiredDrafts();
    const entry = loadDraft();
    if (entry) {
      setDraftSavedAt(entry.savedAt);
      setShowDraftBanner(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCustomTokenLookup() {
    if (!customAddress || customAddress.length < 56) {
      setCustomError(copy.errors.invalidContractAddress);
      return;
    }
    setCustomLoading(true);
    setCustomError(null);
    setCustomToken(null);
    try {
      const meta = await getTokenMetadata(customAddress);
      if (!meta) {
        setCustomError(copy.errors.tokenMetadataFetchFailed);
        return;
      }
      setCustomToken(meta);
      saveCustomToken(network, meta);
      setTokens(getAllTokens(network).map((t) => ({ ...t })));
      set("tokenAddress", meta.address);
    } catch {
      setCustomError(copy.errors.tokenContractQueryFailed);
    } finally {
      setCustomLoading(false);
    }
  }

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  // Issue #687: remove/rename controls for the "Recent recipients" list.
  function handleRemoveAddressBookEntry(id: string) {
    deleteAddressBookEntry(id);
    setAddressBookEntries(getAddressBookEntries());
    toast.success("Recipient removed");
  }

  function openRenameDialog(entry: { id: string; label: string }) {
    setRenamingEntry(entry);
    setRenameValue(entry.label);
  }

  function handleConfirmRename() {
    if (!renamingEntry) return;
    const trimmed = renameValue.trim();
    if (!trimmed) return;
    updateAddressBookEntry(renamingEntry.id, { label: trimmed });
    setAddressBookEntries(getAddressBookEntries());
    setRenamingEntry(null);
    toast.success("Recipient renamed");
  }

  function validate(): boolean {
    const newErrors: Partial<Record<keyof FormState, string>> = {};

    // Issue #155: block submission while a Federation address is still resolving
    if (federationStatus === "loading") {
      newErrors.recipient = copy.errors.federationResolving;
    } else if (federationStatus === "error") {
      newErrors.recipient = federationError ?? copy.errors.federationLookupFailed;
    } else if (
      // Issue #28: use StrKey for proper Stellar address validation
      !form.recipient.trim() ||
      !StrKey.isValidEd25519PublicKey(form.recipient.trim())
    ) {
      newErrors.recipient = isFederationAddress(recipientInput.trim())
        ? copy.errors.federationDidNotResolve
        : copy.errors.invalidAddressFormat;
    }
    // Issue #103: require warning acknowledgment for unfunded accounts
    if (
      recipientAccountInfo &&
      !recipientAccountInfo.exists &&
      !recipientWarningAcknowledged
    ) {
      newErrors.recipient = copy.errors.acknowledgeRecipientWarning;
    }
    if (
      !form.amount ||
      isNaN(Number(form.amount)) ||
      Number(form.amount) <= 0
    ) {
      newErrors.amount = copy.errors.invalidAmount;
    }
    // Issue #29: validate against balance
    if (form.amount && tokenBalance !== null) {
      const parsed = parseTokenAmount(form.amount, selectedToken.decimals);
      if (parsed > tokenBalance) {
        newErrors.amount = copy.errors.amountExceedsBalance(
          formatTokenAmount(tokenBalance, selectedToken.decimals, 4),
          selectedToken.symbol,
        );
      }
    }
    if (isCustom && !customToken) {
      newErrors.tokenAddress = copy.errors.lookupCustomTokenFirst;
    }
    const start = new Date(form.startDate).getTime();
    const end = new Date(form.endDate).getTime();
    if (!form.endDate || end <= start) {
      newErrors.endDate = copy.errors.endDateBeforeStart;
    }
    if (form.hasCliff) {
      const cliff = new Date(form.cliffDate).getTime();
      if (!form.cliffDate || cliff < start || cliff > end) {
        newErrors.cliffDate = copy.errors.cliffOutOfRange;
      }
      if (form.cliffAmount && Number(form.cliffAmount) > Number(form.amount)) {
        newErrors.cliffAmount = copy.errors.cliffExceedsTotal;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  const buildInput = useCallback(() => {
    const startTime = toUnixSeconds(form.startDate);
    const endTime = toUnixSeconds(form.endDate);
    const cliffTime = form.hasCliff ? toUnixSeconds(form.cliffDate) : startTime;
    const cliffAmount =
      form.hasCliff && form.cliffAmount
        ? parseTokenAmount(form.cliffAmount, selectedToken.decimals)
        : 0n;
    return {
      recipient: form.recipient.trim(),
      token: selectedToken,
      totalAmount: parseTokenAmount(form.amount, selectedToken.decimals),
      startTime,
      endTime,
      cliffTime,
      cliffAmount,
    };
  }, [form, selectedToken]);

  async function handleEstimateFee() {
    if (!validate()) return;
    setEstimatingFee(true);
    setFeeEstimate(null);
    try {
      const estimate = await estimateFee(buildInput());
      if (estimate) {
        setFeeEstimate(estimate.estimatedFeeXlm);
      }
    } catch {
      setFeeEstimate(null);
    } finally {
      setEstimatingFee(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    // Show tx simulation preview first; user proceeds to Freighter from there.
    setShowTxPreview(true);
  }

  async function handleConfirmedCreate() {
    try {
      const input = buildInput();
      const id = await createStream(input);
      touchAddressBookEntry(input.recipient, input.recipient);
      setAddressBookEntries(getAddressBookEntries());

      if (recurrenceCadence !== "none") {
        saveRecurringRule({
          cadence: recurrenceCadence,
          nextRunAt: buildNextRunAt(Date.now(), recurrenceCadence),
          lastCreatedAt: Date.now(),
          streamId: id,
          recipient: input.recipient,
          tokenSymbol: input.token.symbol,
          amount: input.totalAmount.toString(),
        });
      }

      discard();
      setShowConfirmation(false);
      toast.success(copy.toasts.streamCreatedTitle, {
        description: copy.toasts.streamCreatedDescription(id),
      });
      router.push(`/app/stream/${id}`);
    } catch {
      // error is exposed via useContract
    }
  }

  function handleTemplateSelect(template: StreamTemplate) {
    setSelectedTemplateId(template.id);
    const newStart = localDatetimeMin(60);
    const newEnd = addDuration(newStart, template.durationSeconds);
    const hasCliff = template.cliffSeconds > 0;
    const newCliff = hasCliff
      ? addDuration(newStart, template.cliffSeconds)
      : newStart;

    setForm((prev) => {
      const amount = prev.amount;
      const cliffAmount =
        hasCliff && template.cliffPercent > 0 && amount
          ? String(Math.floor((Number(amount) * template.cliffPercent) / 100))
          : "";
      return {
        ...prev,
        startDate: newStart,
        endDate: newEnd,
        hasCliff,
        cliffDate: newCliff,
        cliffAmount,
      };
    });
    setErrors({});
  }

  const input = showTxPreview || showConfirmation ? buildInput() : null;
  const durationSeconds =
    (new Date(form.endDate).getTime() - new Date(form.startDate).getTime()) /
    1000;
  const amountPerSecond =
    input && durationSeconds > 0
      ? input.totalAmount / BigInt(Math.floor(durationSeconds))
      : 0n;

  return (
    <div className="mx-auto max-w-4xl">
      {/* Back */}
      <Link
        href="/app"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        {copy.backToDashboard}
      </Link>

      <div className="mt-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          {copy.heading}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {copy.subheading}
        </p>
      </div>

      <div className="mt-8 rounded-2xl border border-border bg-card p-5">
        <StreamTemplates
          onSelect={handleTemplateSelect}
          selectedId={selectedTemplateId}
        />
      </div>
      {cloneId && (
        <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3">
          <Copy className="size-4 shrink-0 text-primary" />
          <p className="text-sm text-primary">
            {copy.cloneNotice(cloneId)}
          </p>
        </div>
      )}

      {/* Issue #168: Draft restore banner */}
      {showDraftBanner && (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <Clock className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <p className="text-sm text-amber-700 dark:text-amber-300">
              {copy.draft.bannerText(
                draftSavedAt
                  ? new Date(draftSavedAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : copy.draft.bannerTimeFallback,
              )}
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                restore();
                setShowDraftBanner(false);
                toast.success(copy.draft.restoredToast);
              }}
            >
              {copy.draft.restoreButton}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                discard();
                setShowDraftBanner(false);
              }}
            >
              {copy.draft.discardButton}
            </Button>
          </div>
        </div>
      )}

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_320px]">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Token + Amount */}
          <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              {copy.amountSection.title}
            </h2>

            <div className="space-y-1.5">
              <Label htmlFor="token">{copy.amountSection.tokenLabel}</Label>
              <Select
                value={isCustom ? CUSTOM_VALUE : form.tokenAddress}
                onValueChange={(v) => {
                  if (!v) return;
                  if (v === CUSTOM_VALUE) {
                    setIsCustom(true);
                  } else {
                    setIsCustom(false);
                    setCustomToken(null);
                    setCustomError(null);
                    set("tokenAddress", v);
                  }
                }}
              >
                <SelectTrigger id="token" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {tokens.map((t) => (
                    <SelectItem key={t.address} value={t.address}>
                      {t.symbol}
                    </SelectItem>
                  ))}
                  <SelectItem value={CUSTOM_VALUE}>
                    {copy.amountSection.customTokenOption}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {isCustom && (
              <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
                <Label htmlFor="customToken" className="text-xs">
                  {copy.amountSection.customTokenAddressLabel}
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="customToken"
                    placeholder={copy.amountSection.customTokenPlaceholder}
                    value={customAddress}
                    onChange={(e) => {
                      setCustomAddress(e.target.value);
                      setCustomError(null);
                    }}
                    className="font-mono text-xs"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={customLoading}
                    onClick={handleCustomTokenLookup}
                  >
                    {customLoading ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      copy.amountSection.lookupButton
                    )}
                  </Button>
                </div>
                {customError && (
                  <p className="text-xs text-destructive">{customError}</p>
                )}
                {customToken && (
                  <p className="text-xs text-primary">
                    {copy.amountSection.customTokenFound(
                      customToken.symbol,
                      customToken.decimals,
                    )}
                  </p>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              {/* Issue #29: show balance + Max button */}
              <div className="flex items-center justify-between">
                <Label htmlFor="amount">
                  {copy.amountSection.totalAmountLabel(selectedToken.symbol)}
                </Label>
                <span className="text-xs text-muted-foreground">
                  {balanceLoading
                    ? copy.amountSection.loadingBalance
                    : tokenBalance !== null
                      ? copy.amountSection.balanceLabel(
                          formatTokenAmount(tokenBalance, selectedToken.decimals, 4),
                          selectedToken.symbol,
                        )
                      : null}
                </span>
              </div>

              {/* Issue #186: USD/token mode toggle */}
              {supportsUsd && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <button
                    type="button"
                    aria-pressed={!usdInputMode}
                    onClick={() => {
                      setUsdInputMode(false);
                      setUsdAmount("");
                    }}
                    className={`rounded-full border px-2 py-0.5 transition-colors ${!usdInputMode ? "border-primary bg-primary/10 text-foreground" : "border-border hover:border-foreground"}`}
                  >
                    {copy.amountSection.tokenAmountToggle(selectedToken.symbol)}
                  </button>
                  <button
                    type="button"
                    aria-pressed={usdInputMode}
                    onClick={() => setUsdInputMode(true)}
                    className={`rounded-full border px-2 py-0.5 transition-colors ${usdInputMode ? "border-primary bg-primary/10 text-foreground" : "border-border hover:border-foreground"}`}
                  >
                    {copy.amountSection.usdAmountToggle}
                  </button>
                  {priceStale && (
                    <span className="text-yellow-500">
                      {copy.amountSection.priceStale}
                    </span>
                  )}
                </div>
              )}

              <div className="flex gap-2">
                {usdInputMode && supportsUsd ? (
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                      $
                    </span>
                    <Input
                      id="amount"
                      type="number"
                      min="0"
                      step="any"
                      placeholder={copy.amountSection.usdAmountPlaceholder}
                      className="pl-6"
                      value={usdAmount}
                      onChange={(e) => handleUsdAmountChange(e.target.value)}
                      aria-invalid={!!errors.amount}
                    />
                  </div>
                ) : (
                  <Input
                    id="amount"
                    type="number"
                    min="0"
                    step="any"
                    placeholder={copy.amountSection.tokenAmountPlaceholder}
                    value={form.amount}
                    onChange={(e) => set("amount", e.target.value)}
                    aria-invalid={!!errors.amount}
                  />
                )}
                {tokenBalance !== null && tokenBalance > 0n && (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      set(
                        "amount",
                        formatTokenAmount(
                          tokenBalance,
                          selectedToken.decimals,
                          selectedToken.decimals,
                        ),
                      )
                    }
                  >
                    {copy.amountSection.maxButton}
                  </Button>
                )}
              </div>

              {/* Issue #186: USD equivalent + per-second rate */}
              {usdEquivalent && !usdInputMode && (
                <p className="text-xs text-muted-foreground">
                  {copy.amountSection.usdEquivalent(usdEquivalent)}
                  {amountPerSecondUsd && (
                    <span className="ml-2">
                      ·{" "}
                      {copy.amountSection.streamingRate(
                        (
                          tokenAmountNum /
                          Math.max(
                            1,
                            (new Date(form.endDate).getTime() -
                              new Date(form.startDate).getTime()) /
                              1000,
                          )
                        ).toFixed(6),
                        selectedToken.symbol,
                        amountPerSecondUsd,
                      )}
                    </span>
                  )}
                  {priceLoading && (
                    <span className="ml-1 opacity-60">
                      {copy.amountSection.fetchingPrice}
                    </span>
                  )}
                </p>
              )}
              {usdInputMode && form.amount && (
                <p className="text-xs text-muted-foreground">
                  {copy.amountSection.tokenEquivalentInUsdMode(
                    form.amount,
                    selectedToken.symbol,
                  )}
                </p>
              )}

              {errors.amount && (
                <p className="text-xs text-destructive">{errors.amount}</p>
              )}
            </div>
          </div>

          {/* Recipient */}
          <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              {copy.recipientSection.title}
            </h2>
            <div className="space-y-1.5">
              <Label htmlFor="recipient">{copy.recipientSection.label}</Label>
              <div className="relative">
                <Input
                  id="recipient"
                  placeholder={copy.recipientSection.placeholder}
                  value={recipientInput}
                  onChange={(e) => setRecipientInput(e.target.value)}
                  aria-invalid={!!errors.recipient}
                  className="font-mono text-xs pr-8"
                />
                {federationStatus === "loading" && (
                  <Loader2 className="absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
                )}
                {federationStatus === "resolved" && (
                  <CheckCircle2 className="absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-emerald-500" />
                )}
              </div>
              {/* Issue #155: Federation address (name*domain.com) resolution */}
              {federationStatus === "resolved" && federationResolved && (
                <div className="flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
                  <div>
                    <p className="font-medium">
                      {copy.recipientSection.federationResolved(
                        federationResolved.federationAddress,
                      )}
                    </p>
                    <p className="font-mono text-xs opacity-80 break-all">
                      {federationResolved.accountId}
                    </p>
                  </div>
                </div>
              )}
              {federationStatus === "error" && federationError && (
                <p className="text-xs text-destructive">{federationError}</p>
              )}
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const trimmed = form.recipient.trim();
                    if (!trimmed || !StrKey.isValidEd25519PublicKey(trimmed))
                      return;
                    addAddressBookEntry({
                      label:
                        federationResolved?.accountId === trimmed
                          ? federationResolved.federationAddress
                          : copy.recipientSection.savedDefaultLabel,
                      address: trimmed,
                      federationAddress:
                        federationResolved?.accountId === trimmed
                          ? federationResolved.federationAddress
                          : undefined,
                    });
                    setAddressBookEntries(getAddressBookEntries());
                    toast.success(copy.recipientSection.savedToast);
                  }}
                  disabled={
                    !form.recipient.trim() ||
                    !StrKey.isValidEd25519PublicKey(form.recipient.trim())
                  }
                >
                  {copy.recipientSection.saveButton}
                </Button>
              </div>
              {addressBookEntries.length > 0 && (
                <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
                  <p className="text-xs font-medium text-muted-foreground">
                    {copy.recipientSection.recentRecipientsLabel}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {addressBookEntries.slice(0, 6).map((entry) => (
                      <div
                        key={entry.id}
                        className="group flex items-center gap-1 rounded-full border border-border bg-background pl-3 pr-1 py-1 text-xs text-muted-foreground transition-colors hover:border-primary"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setRecipientInput(entry.address);
                            set("recipient", entry.address);
                          }}
                          className="text-left hover:text-primary"
                          title={entry.address}
                        >
                          <span className="font-medium text-foreground">
                            {entry.federationAddress ?? entry.label}
                          </span>{" "}
                          • {entry.address.slice(0, 8)}…
                        </button>
                        <button
                          type="button"
                          onClick={() => openRenameDialog(entry)}
                          aria-label={`Rename ${entry.label}`}
                          className="rounded-full p-1 opacity-60 hover:bg-secondary hover:opacity-100"
                        >
                          <Pencil className="size-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveAddressBookEntry(entry.id)}
                          aria-label={`Remove ${entry.label}`}
                          className="rounded-full p-1 opacity-60 hover:bg-destructive/10 hover:text-destructive hover:opacity-100"
                        >
                          <X className="size-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {errors.recipient && (
                <p className="text-xs text-destructive">{errors.recipient}</p>
              )}
              {walletAddress && form.recipient.trim() === walletAddress && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  <span>{copy.recipientSection.selfStreamWarning}</span>
                </div>
              )}
              {/* Issue #103: Warning for unfunded/unknown recipient accounts */}
              {recipientAccountInfo && !recipientAccountInfo.exists && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  <div className="flex-1">
                    <p className="font-medium">
                      {copy.recipientSection.unfundedTitle}
                    </p>
                    <p className="text-xs mt-1">
                      {copy.recipientSection.unfundedBody}
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="mt-2"
                      onClick={() => setRecipientWarningAcknowledged(true)}
                    >
                      {copy.recipientSection.acknowledgeWarningButton}
                    </Button>
                  </div>
                </div>
              )}
              {recipientChecking && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="size-3 animate-spin" />
                  {copy.recipientSection.checking}
                </div>
              )}
            </div>
          </div>

          {/* Schedule */}
          <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              {copy.scheduleSection.title}
            </h2>

            {/* Issue #170: timezone selector */}
            <div className="space-y-1.5">
              <Label
                htmlFor="timezone"
                className="text-xs text-muted-foreground"
              >
                {copy.scheduleSection.timezoneLabel(timezoneOffset)}
              </Label>
              <Select
                value={selectedTimezone}
                onValueChange={(v) => {
                  if (v) setSelectedTimezone(v);
                }}
              >
                <SelectTrigger id="timezone" className="w-full text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COMMON_TIMEZONES.map((tz) => (
                    <SelectItem key={tz} value={tz} className="text-xs">
                      {tz}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="startDate">
                  {copy.scheduleSection.startDateLabel}{" "}
                  <span className="font-normal text-muted-foreground text-xs">
                    ({timezoneOffset})
                  </span>
                </Label>
                <Input
                  id="startDate"
                  type="datetime-local"
                  value={form.startDate}
                  onChange={(e) => set("startDate", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="endDate">
                  {copy.scheduleSection.endDateLabel}{" "}
                  <span className="font-normal text-muted-foreground text-xs">
                    ({timezoneOffset})
                  </span>
                </Label>
                <Input
                  id="endDate"
                  type="datetime-local"
                  value={form.endDate}
                  min={form.startDate}
                  onChange={(e) => set("endDate", e.target.value)}
                  aria-invalid={!!errors.endDate}
                />
                {errors.endDate && (
                  <p className="text-xs text-destructive">{errors.endDate}</p>
                )}
              </div>
            </div>

            {/* Duration presets */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                {copy.scheduleSection.quickDurationLabel}
              </Label>
              <div className="flex flex-wrap gap-2">
                {DURATION_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() =>
                      set(
                        "endDate",
                        addDuration(form.startDate, preset.seconds),
                      )
                    }
                    className="rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Cliff toggle */}
            <div className="flex items-start gap-3 pt-1">
              <input
                id="hasCliff"
                type="checkbox"
                checked={form.hasCliff}
                onChange={(e) => set("hasCliff", e.target.checked)}
                className="mt-0.5 size-4 accent-primary"
              />
              <div>
                <Label htmlFor="hasCliff">{copy.scheduleSection.addCliffLabel}</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {copy.scheduleSection.addCliffHelp}
                </p>
              </div>
            </div>

            <div className="space-y-1.5 rounded-lg border border-border bg-muted/30 p-3">
              <Label htmlFor="recurrence">
                {copy.scheduleSection.recurrenceLabel}
              </Label>
              <Select
                value={recurrenceCadence}
                onValueChange={(value) =>
                  setRecurrenceCadence(value as RecurrenceCadence)
                }
              >
                <SelectTrigger id="recurrence" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    {copy.scheduleSection.recurrenceOptions.none}
                  </SelectItem>
                  <SelectItem value="weekly">
                    {copy.scheduleSection.recurrenceOptions.weekly}
                  </SelectItem>
                  <SelectItem value="monthly">
                    {copy.scheduleSection.recurrenceOptions.monthly}
                  </SelectItem>
                  <SelectItem value="quarterly">
                    {copy.scheduleSection.recurrenceOptions.quarterly}
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {copy.scheduleSection.recurrenceHelp}
              </p>
            </div>

            {form.hasCliff && (
              <div className="space-y-4 pt-1">
                {/* Cliff presets */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">
                    {copy.scheduleSection.quickCliffLabel}
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {CLIFF_PRESETS.map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => {
                          if (preset.seconds === 0) {
                            set("hasCliff", false);
                          } else {
                            set(
                              "cliffDate",
                              addDuration(form.startDate, preset.seconds),
                            );
                          }
                        }}
                        className="rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="cliffDate">
                      {copy.scheduleSection.cliffDateLabel}{" "}
                      <span className="font-normal text-muted-foreground text-xs">
                        ({timezoneOffset})
                      </span>
                    </Label>
                    <Input
                      id="cliffDate"
                      type="datetime-local"
                      value={form.cliffDate}
                      min={form.startDate}
                      max={form.endDate}
                      onChange={(e) => set("cliffDate", e.target.value)}
                      aria-invalid={!!errors.cliffDate}
                    />
                    {errors.cliffDate && (
                      <p className="text-xs text-destructive">
                        {errors.cliffDate}
                      </p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="cliffAmount">
                      {copy.scheduleSection.cliffAmountLabel(selectedToken.symbol)}{" "}
                      <span className="text-muted-foreground font-normal">
                        {copy.scheduleSection.optionalTag}
                      </span>
                    </Label>
                    <Input
                      id="cliffAmount"
                      type="number"
                      min="0"
                      step="any"
                      placeholder="0"
                      value={form.cliffAmount}
                      onChange={(e) => set("cliffAmount", e.target.value)}
                      aria-invalid={!!errors.cliffAmount}
                    />
                    {errors.cliffAmount && (
                      <p className="text-xs text-destructive">
                        {errors.cliffAmount}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {network === "mainnet" && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-600 dark:text-amber-400">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>{copy.mainnetWarning}</span>
            </div>
          )}

          {/* Contract error */}
          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              <Info className="mt-0.5 size-4 shrink-0" />
              {error}
            </div>
          )}

          {/* Fee estimate */}
          {feeEstimate && (
            <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 p-3 text-sm text-muted-foreground">
              <Info className="size-4 shrink-0" />
              {copy.feeEstimateText(feeEstimate)}
            </div>
          )}

          {/* Submit */}
          <div className="flex items-center justify-end gap-3">
            <Button type="button" variant="ghost" asChild>
              <Link href="/app">{copy.actions.cancel}</Link>
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={pending || estimatingFee}
              onClick={handleEstimateFee}
              className="gap-1.5"
            >
              {estimatingFee && <Loader2 className="size-4 animate-spin" />}
              {estimatingFee ? copy.actions.estimatingFee : copy.actions.estimateFee}
            </Button>
            <Button type="submit" disabled={pending} className="gap-1.5">
              {pending ? copy.actions.creating : copy.actions.createStream}
              {!pending && <ArrowRight className="size-4" />}
            </Button>
          </div>
        </form>

        {/* Live preview sidebar */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <StreamPreview
            amount={form.amount}
            token={selectedToken}
            startDate={form.startDate}
            endDate={form.endDate}
            hasCliff={form.hasCliff}
            cliffDate={form.cliffDate}
            cliffAmount={form.cliffAmount}
          />
        </aside>
      </div>

      {/* Step 1: dry-run simulation preview */}
      {input && (
        <TxPreviewDialog
          open={showTxPreview}
          input={input}
          network={network}
          sender={walletAddress ?? ""}
          operationLabel={copy.txPreviewOperationLabel}
          onConfirm={() => {
            setShowTxPreview(false);
            setShowConfirmation(true);
          }}
          onCancel={() => setShowTxPreview(false)}
          pending={false}
        />
      )}

      {/* Step 2: confirmation + fee details → Freighter signing */}
      {input && (
        <CreateConfirmation
          open={showConfirmation}
          onConfirm={handleConfirmedCreate}
          onCancel={() => setShowConfirmation(false)}
          pending={pending}
          feeEstimate={feeEstimate}
          recipient={input.recipient}
          token={input.token}
          totalAmount={input.totalAmount}
          startTime={input.startTime}
          endTime={input.endTime}
          cliffTime={input.cliffTime}
          cliffAmount={input.cliffAmount}
          amountPerSecond={amountPerSecond}
        />
      )}

      {/* Issue #687: rename a saved recipient */}
      <Dialog
        open={!!renamingEntry}
        onOpenChange={(open) => !open && setRenamingEntry(null)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename recipient</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="renameRecipient">Label</Label>
            <Input
              id="renameRecipient"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleConfirmRename();
              }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRenamingEntry(null)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmRename} disabled={!renameValue.trim()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
