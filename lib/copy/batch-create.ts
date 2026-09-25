// Centralized UI copy for the batch create page (app/app/create/batch/page.tsx).
// Extracted so this page's strings live in one place instead of scattered through JSX (issue #794).

export const batchCreateCopy = {
  backToSingleCreate: "Back to single create",
  heading: "Batch create streams",
  subheading:
    "Upload a CSV of recipient schedules, preview the rows, and execute creation sequentially.",
  returnToDashboard: "Return to dashboard",
  singleStream: "Single stream",

  form: {
    tokenLabel: "Token",
    csvFileLabel: "CSV file",
    downloadCsvTemplate: "Download CSV template",
    csvFormatHint:
      "Format: recipient,amount,start_time,end_time,cliff_time,cliff_amount. Use cliff_duration (e.g. 30d, 12h) as a relative alternative to cliff_time.",
    csvEmptyError: "CSV file contains no rows.",
    csvFileTypeError: "Please upload a .csv file.",
    csvParseWarningsTitle: "CSV parse warnings",
  },

  preview: {
    title: "Preview rows",
    description: (total: number, valid: number) =>
      `${total} row(s) loaded, ${valid} valid.`,
    tokenMeta: (symbol: string) => `Token: ${symbol}`,
    rowsMeta: (count: number) => `Rows: ${count}`,
    validMeta: (count: number) => `Valid: ${count}`,
    tableHeaders: {
      index: "#",
      recipient: "Recipient",
      amount: "Amount",
      start: "Start",
      end: "End",
      cliff: "Cliff",
      status: "Status",
    },
    validStatus: "Valid",
    noCliff: "none",
  },

  execution: {
    title: "Execute batch",
    description:
      "Streams are created sequentially. The first invalid row will be skipped and any failure will pause execution.",
    progressTitle: "Progress",
    progressCompleted: (completed: number, queued: number) =>
      `${completed} / ${queued} completed`,
    executingButton: "Executing…",
    executeButton: "Execute batch",
    reviewSingleStream: "Review single stream",
    errorsTitle: "Execution errors",
    transactionFailedFallback: "Transaction failed",
  },

  liveStatus: {
    creating: (count: number, plural: boolean) =>
      `Creating ${count} stream${plural ? "s" : ""}…`,
    batchFailed: (error: string) => `Batch failed: ${error}`,
    success: (validCount: number) =>
      `${validCount} of ${validCount} streams created successfully.`,
  },

  toasts: {
    batchCreateFailed: "Batch create failed.",
    batchCreateCompletedTitle: "Batch create completed",
    batchCreateCompletedDescription: (count: number) =>
      `${count} streams created successfully.`,
  },

  rowValidation: {
    invalidRecipient: "Invalid recipient address",
    invalidAmount: "Invalid amount",
    invalidStartTime: "Invalid start_time",
    invalidEndTime: "Invalid end_time",
    endTimeBeforeStartTime: "end_time must be after start_time",
    invalidCliffTime: "Invalid cliff_time",
    invalidCliffDuration: "Invalid cliff_duration",
    cliffTimeOutOfRange: "cliff_time must fall between start_time and end_time",
    cliffDurationOutOfRange:
      "cliff_duration must land between start_time and end_time",
    cliffAmountExceedsTotal: "cliff_amount cannot exceed total amount",
  },
};
