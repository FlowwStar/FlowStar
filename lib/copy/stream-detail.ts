// Centralized UI copy for the stream detail page (app/app/stream/[id]/page.tsx).
// First step toward i18n-readiness — extracted so this page's strings live in
// one place instead of scattered through JSX (issue #683).

export const streamDetailCopy = {
  copyableAddress: {
    copyAriaLabel: "Copy address",
    copiedStatus: "Copied",
    viewOnExplorerAriaLabel: "View on Stellar Expert",
  },

  withdrawDialog: {
    title: "Withdraw funds",
    maxPrefix: "Enter how much to withdraw. Max:",
    amountLabel: (symbol: string) => `Amount (${symbol})`,
    amountPlaceholder: "0.00",
    maxButton: "Max",
    exceedsBalance: "Amount exceeds withdrawable balance",
    estimatedFeeLabel: "Estimated network fee:",
    feeShownAgainNote: "Fee will be shown again before wallet confirmation.",
    cancelButton: "Cancel",
    withdrawing: "Withdrawing…",
    reviewFeesButton: "Review fees",
    successToastTitle: "Withdrawal successful",
    successToastDescription: (amount: string, symbol: string) =>
      `${amount} ${symbol} sent to your wallet.`,
    viewTransactionAction: "View transaction",
  },

  cancelDialog: {
    title: "Cancel stream",
    description:
      "Unlocked funds will be sent to the recipient. Any remaining locked tokens will be returned to your wallet. You'll have a few seconds to undo before this is submitted.",
    estimatedFeeLabel: "Estimated network fee:",
    keepStreamButton: "Keep stream",
    reviewAndCancelButton: "Review & cancel",
  },

  autoWithdraw: {
    title: "Auto-withdraw",
    enableAriaLabel: "Enable auto-withdraw",
    helpText:
      "Automatically withdraw funds using your chosen strategy. The app must be open and your wallet connected.",
    strategyLabel: "Strategy",
    strategies: {
      timeBased: { label: "Time-based", description: "Withdraw on fixed intervals" },
      thresholdBased: {
        label: "Threshold-based",
        description: "Withdraw when amount reaches threshold",
      },
      gasOptimized: {
        label: "Gas-optimized",
        description: "Limit frequency to reduce gas costs",
      },
      max: { label: "Max amount", description: "Always withdraw maximum available" },
    },
    frequencyLabel: "Frequency",
    intervalOptionLabels: [
      "Every 6 hours",
      "Every 12 hours",
      "Every 24 hours",
      "Every 48 hours",
    ] as const,
    thresholdLabel: "Threshold (% of total deposited)",
    minAmountLabel: (symbol: string) => `Minimum amount (${symbol})`,
    minAmountPlaceholder: "0 (no minimum)",
    minAmountHelp: "Skip auto-withdraw if the available amount is below this threshold.",
    maxLimitLabel: (symbol: string) => `Maximum safety limit (${symbol})`,
    maxLimitPlaceholder: "0 (no limit)",
    maxLimitHelp: "Never withdraw more than this amount per transaction.",
    autoWithdrawingStatus: "Auto-withdrawing...",
    lastAutoWithdrawalPrefix: "Last auto-withdrawal:",
    showHistoryButton: "Show",
    hideHistoryButton: "Hide",
    withdrawalHistorySuffix: "withdrawal history",
    historyErrorPrefix: "Error:",
    historyWithdrewPrefix: "Withdrew:",
  },

  ttlWarning: {
    title: "Storage may be expiring soon",
    body: (daysLeft: number, plural: boolean) =>
      `This stream's on-chain data may expire in ~${daysLeft} day${plural ? "s" : ""}. Extend the TTL to prevent data loss and keep the stream active.`,
    extendingButton: "Extending…",
    extendTtlButton: "Extend TTL",
    successToast: "Storage TTL extended by 30 days",
    errorToast: "Failed to extend TTL",
  },

  shareButtons: {
    shareButton: "Share",
    shareAriaLabel: "Share stream",
    copyLinkAriaLabel: "Copy link",
    copiedLinkButton: "Copied!",
    copyLinkButton: "Copy link",
    linkCopiedToast: "Link copied to clipboard",
    twitterAriaLabel: "Share on Twitter",
    twitterButton: "Twitter",
    telegramAriaLabel: "Share on Telegram",
    telegramButton: "Telegram",
    qrAriaLabel: "Show QR code",
    qrButton: "QR code",
    shareText: (streamId: string) =>
      `Check out this token stream on FlowStar - Stream #${streamId}`,
  },

  connectPrompt: {
    body: "Connect your wallet to withdraw, cancel, or interact with this stream.",
  },

  notFound: {
    title: "Stream not found",
    body: "This stream may not exist or may have expired.",
    backButton: "Back to dashboard",
  },

  header: {
    backLabel: "Dashboard",
    sending: "Sending",
    receiving: "Receiving",
    streamIdPrefix: "Stream #",
    unlockedSoFarLabel: "Unlocked so far",
    unlockedFraction: "% unlocked",
    withdrawnSuffix: "withdrawn",
    startsInLabel: "Starts in",
    durationLabel: "Duration",
    endsInLabel: "Ends in",
    cancellingNotice: "Cancelling… you can still undo this from the toast.",
    withdrawButton: "Withdraw",
    cancelStreamButton: "Cancel stream",
    duplicateStreamButton: "Duplicate stream",
  },

  details: {
    sectionTitle: "Details",
    sender: "Sender",
    recipient: "Recipient",
    token: "Token",
    streamContract: "Stream Contract",
    totalDeposited: "Total deposited",
    withdrawn: "Withdrawn",
    withdrawableNow: "Withdrawable now",
    rate: "Rate",
    start: "Start",
    cliff: "Cliff",
    end: "End",
    network: "Network",
  },
};
