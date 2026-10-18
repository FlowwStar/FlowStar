// Centralized UI copy for the create-stream form (app/app/create/create-form.tsx)
// and stream preview (components/streams/stream-preview.tsx).
// First step toward i18n-readiness — extracted so this component's strings
// live in one place instead of scattered through JSX (issue #682).

export const createFormCopy = {
  backToDashboard: 'Back to dashboard',
  heading: 'Create a stream',
  subheading: 'Tokens unlock continuously to the recipient from start to end.',
  cloneNotice: (id: string) => `Duplicating Stream #${id} — form pre-filled with its parameters.`,

  draft: {
    bannerText: (time: string) => `You have an unsaved draft from ${time}.`,
    bannerTimeFallback: 'earlier',
    restoreButton: 'Restore',
    discardButton: 'Discard',
    restoredToast: 'Draft restored',
  },

  amountSection: {
    title: 'Amount',
    tokenLabel: 'Token',
    customTokenOption: 'Custom token…',
    customTokenAddressLabel: 'Token contract address',
    customTokenPlaceholder: 'CABC…',
    lookupButton: 'Lookup',
    customTokenFound: (symbol: string, decimals: number) =>
      `Found: ${symbol} (${decimals} decimals)`,
    totalAmountLabel: (symbol: string) => `Total amount (${symbol})`,
    loadingBalance: 'Loading balance…',
    balanceLabel: (amount: string, symbol: string) => `Balance: ${amount} ${symbol}`,
    tokenAmountToggle: (symbol: string) => `${symbol} amount`,
    usdAmountToggle: 'USD amount',
    priceStale: 'Price may be stale',
    tokenAmountPlaceholder: 'e.g. 10000',
    usdAmountPlaceholder: 'e.g. 500',
    maxButton: 'Max',
    usdEquivalent: (usd: string) => `≈ $${usd} USD`,
    streamingRate: (ratePerSec: string, symbol: string, usdPerSec: string) =>
      `Streaming rate: ${ratePerSec} ${symbol}/sec (≈ $${usdPerSec}/sec)`,
    fetchingPrice: 'Fetching price…',
    tokenEquivalentInUsdMode: (amount: string, symbol: string) => `≈ ${amount} ${symbol}`,
    priceUnavailable: (symbol: string) => `Price unavailable for ${symbol}`,
  },

  recipientSection: {
    title: 'Recipient',
    label: 'Stellar address or Federation name',
    placeholder: 'GABC… or alice*domain.com',
    federationResolved: (federationAddress: string) => `${federationAddress} resolved`,
    saveButton: 'Save recipient',
    savedDefaultLabel: 'Saved recipient',
    savedToast: 'Recipient saved',
    recentRecipientsLabel: 'Recent recipients',
    renameEntryAria: (label: string) => `Rename ${label}`,
    removeEntryAria: (label: string) => `Remove ${label}`,
    selfStreamWarning:
      'This is your own address. Self-streams are allowed but may have been unintended.',
    unfundedTitle: 'This address has no transaction history.',
    unfundedBody: "Tokens sent to this address may be unrecoverable if it's not funded.",
    acknowledgeWarningButton: 'I understand, proceed',
    checking: 'Checking recipient account...',
  },

  scheduleSection: {
    title: 'Schedule',
    timezoneLabel: (offset: string) =>
      `Timezone — dates below are interpreted in this timezone (${offset})`,
    startDateLabel: 'Start date',
    endDateLabel: 'End date',
    quickDurationLabel: 'Quick duration',
    addCliffLabel: 'Add a cliff',
    addCliffHelp:
      'Nothing unlocks before the cliff date. Optionally release a lump sum at the cliff.',
    recurrenceLabel: 'Recurring cadence',
    recurrenceOptions: {
      none: 'Do not repeat',
      weekly: 'Weekly',
      monthly: 'Monthly',
      quarterly: 'Quarterly',
    },
    recurrenceHelp:
      'Save a renewal rule for this recipient so the schedule can be recreated later.',
    durationPresetLabels: ['1 week', '1 month', '3 months', '6 months', '1 year'] as const,
    cliffPresetLabels: ['No cliff', '1 month', '3 months'] as const,
    quickCliffLabel: 'Quick cliff',
    cliffDateLabel: 'Cliff date',
    cliffAmountLabel: (symbol: string) => `Cliff amount (${symbol})`,
    optionalTag: 'optional',
  },

  streamPreview: {
    emptyState: 'Fill in the form to see a preview of your stream.',
    title: 'Stream preview',
    lowRateWarning: (perHour: string, symbol: string) =>
      `Unlock rate is very low (${perHour} ${symbol}/hour). Consider increasing the amount or reducing the duration.`,
    totalDurationLabel: 'Total duration',
    unlockRateLabel: 'Unlock rate',
    perMonthSuffix: '/mo',
    perHourSuffix: '/hr',
    perDaySuffix: '/day',
    cliffAmountLabel: 'Cliff amount',
    cliffWaitLabel: 'Cliff wait',
    timelineLabel: 'Timeline',
    startLabel: 'Start',
    cliffLabel: (duration: string) => `Cliff (${duration})`,
    endLabel: (duration: string) => `End (${duration})`,
    duration: {
      none: '—',
      days: (n: number) => `${n} day${n !== 1 ? 's' : ''}`,
      hours: (n: number) => `${n} hour${n !== 1 ? 's' : ''}`,
      minutes: (n: number) => `${n} min`,
      belowOneMinute: '< 1 min',
    },
  },

    cliffAmountPlaceholder: '0',
    optionalTag: 'optional',
  },

  txPreviewOperationLabel: 'Create Stream',

  mainnetWarning:
    'Mainnet uses real funds. Double-check the recipient, amount, and token before creating a stream.',
  feeEstimateText: (fee: string) => `Estimated transaction fee: ~${fee} XLM (includes 15% buffer)`,

  actions: {
    cancel: 'Cancel',
    estimatingFee: 'Estimating…',
    estimateFee: 'Estimate fee',
    creating: 'Creating…',
    createStream: 'Create stream',
  },

  toasts: {
    streamCreatedTitle: 'Stream created',
    streamCreatedDescription: (id: string) => `Stream #${id} is live.`,
    draftSaveWarningTitle: "Your draft isn't being saved",
    draftSaveWarningDescription:
      "Storage is full or unavailable — your progress won't be restored if you leave this page.",
    recipientRemoved: 'Recipient removed',
    recipientRenamed: 'Recipient renamed',
  },

  renameDialog: {
    title: 'Rename recipient',
    label: 'Label',
    cancel: 'Cancel',
    save: 'Save',
  },

  errors: {
    federationResolving: 'Still resolving the Federation address…',
    federationLookupFailed: 'Federation lookup failed',
    federationDidNotResolve: 'Federation address did not resolve to a valid Stellar account',
    invalidAddressFormat: 'Invalid Stellar address format',
    invalidAddressChecksum:
      'Invalid checksum — double-check this address for a mistyped character',
    acknowledgeRecipientWarning: 'Please acknowledge the warning about this recipient address',
    invalidAmount: 'Enter a valid amount greater than 0',
    amountExceedsBalance: (balance: string, symbol: string) =>
      `Amount exceeds your balance (${balance} ${symbol})`,
    lookupCustomTokenFirst: 'Look up a valid custom token first',
    endDateBeforeStart: 'End date must be after start date',
    cliffOutOfRange: 'Cliff must be between start and end date',
    cliffExceedsTotal: 'Cliff amount cannot exceed total amount',
    invalidContractAddress: 'Enter a valid Stellar contract address (56 chars, starts with C)',
    tokenMetadataFetchFailed:
      'Could not fetch token metadata. Verify this is a valid SEP-41 token contract.',
    tokenContractQueryFailed: 'Failed to query token contract',
  },
}

// CreateConfirmation dialog strings — issue #956
export const createConfirmationCopy = {
  dialogTitle: 'Confirm stream creation',
  dialogDescription:
    'Review the details below. You\u2019ll sign two transactions: one token approval, then stream creation.',
  streamDetailsSectionTitle: 'Stream details',
  recipientLabel: 'Recipient',
  tokenLabel: 'Token',
  totalAmountLabel: 'Total amount',
  rateLabel: 'Rate',
  startLabel: 'Start',
  endLabel: 'End',
  cliffLabel: 'Cliff',
  networkFeesSectionTitle: 'Network fees',
  baseFeeEstimateLabel: 'Base fee estimate',
  safetyBufferLabel: 'Safety buffer (15%)',
  totalEstimatedLabel: 'Total estimated',
  feeDisclaimerText:
    'Fees are estimated from transaction simulation. Actual costs may vary based on network conditions.',
  backButton: 'Back',
  confirmButton: 'Confirm & sign',
  pendingButton: 'Creating\u2026',
}
