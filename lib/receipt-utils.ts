import type { StreamData } from '@/types/stream'
import { formatTokenAmount, formatDateTime, shortenAddress } from '@/lib/stream-utils'

/**
 * Generate receipt data for a stream.
 * Can be used to create PDF, HTML, CSV, or other formats.
 */
export interface ReceiptData {
  streamId: string
  createdDate: string
  sender: string
  recipient: string
  tokenSymbol: string
  tokenAddress: string
  totalAmount: string
  totalAmountRaw: bigint
  startDate: string
  endDate: string
  cliffDate: string
  status: string
  withdrawnAmount: string
  withdrawnAmountRaw: bigint
  remainingAmount: string
  remainingAmountRaw: bigint
  generatedDate: string
  creationTx?: string
  withdrawalTxs: string[]
  cancellationTx?: string
  cliffAmount?: string
  amountPerSecond?: string
  duration: string
}

/**
 * Build receipt data from a stream object.
 */
export function buildReceiptData(
  stream: StreamData,
  creationTxHash?: string,
  withdrawalTxHashes?: string[],
  cancellationTxHash?: string,
): ReceiptData {
  const now = Math.floor(Date.now() / 1000)
  const unlocked = stream.cliffTime > BigInt(now) ? 0n : stream.depositedAmount
  const remaining = stream.depositedAmount - stream.withdrawnAmount

  const startDate = new Date(Number(stream.startTime) * 1000)
  const endDate = new Date(Number(stream.endTime) * 1000)
  const cliffDate = new Date(Number(stream.cliffTime) * 1000)

  // Calculate duration
  const durationSecs = Number(stream.endTime - stream.startTime)
  const days = Math.floor(durationSecs / 86400)
  const hours = Math.floor((durationSecs % 86400) / 3600)
  const minutes = Math.floor((durationSecs % 3600) / 60)
  const durationStr =
    days > 0 ? `${days}d ${hours}h ${minutes}m` : hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`

  const status = stream.cancelled ? 'Cancelled' : now >= Number(stream.endTime) ? 'Completed' : 'Active'

  return {
    streamId: stream.id,
    createdDate: formatDateTime(stream.startTime),
    sender: stream.sender,
    recipient: stream.recipient,
    tokenSymbol: stream.token.symbol,
    tokenAddress: stream.token.address,
    totalAmount: formatTokenAmount(stream.depositedAmount, stream.token.decimals, 8),
    totalAmountRaw: stream.depositedAmount,
    startDate: formatDateTime(stream.startTime),
    endDate: formatDateTime(stream.endTime),
    cliffDate: formatDateTime(stream.cliffTime),
    status,
    withdrawnAmount: formatTokenAmount(stream.withdrawnAmount, stream.token.decimals, 8),
    withdrawnAmountRaw: stream.withdrawnAmount,
    remainingAmount: formatTokenAmount(remaining, stream.token.decimals, 8),
    remainingAmountRaw: remaining,
    generatedDate: new Date().toLocaleString(),
    creationTx: creationTxHash,
    withdrawalTxs: withdrawalTxHashes || [],
    cancellationTx: cancellationTxHash,
    cliffAmount:
      stream.cliffAmount > 0n
        ? formatTokenAmount(stream.cliffAmount, stream.token.decimals, 8)
        : undefined,
    amountPerSecond:
      stream.amountPerSecond > 0n
        ? formatTokenAmount(stream.amountPerSecond, stream.token.decimals, 12)
        : undefined,
    duration: durationStr,
  }
}

/**
 * Generate CSV content from receipt data.
 */
export function generateReceiptCSV(receipt: ReceiptData): string {
  const lines: string[] = []

  lines.push('FlowStar Stream Receipt')
  lines.push(`Generated: ${receipt.generatedDate}`)
  lines.push('')

  lines.push('Stream Information')
  lines.push(`Stream ID,${receipt.streamId}`)
  lines.push(`Status,${receipt.status}`)
  lines.push('')

  lines.push('Parties')
  lines.push(`Sender,${receipt.sender}`)
  lines.push(`Recipient,${receipt.recipient}`)
  lines.push('')

  lines.push('Token Details')
  lines.push(`Symbol,${receipt.tokenSymbol}`)
  lines.push(`Address,${receipt.tokenAddress}`)
  lines.push('')

  lines.push('Schedule')
  lines.push(`Start Date,${receipt.startDate}`)
  lines.push(`End Date,${receipt.endDate}`)
  lines.push(`Cliff Date,${receipt.cliffDate}`)
  if (receipt.cliffAmount) {
    lines.push(`Cliff Amount,${receipt.cliffAmount} ${receipt.tokenSymbol}`)
  }
  lines.push(`Duration,${receipt.duration}`)
  lines.push('')

  lines.push('Amounts')
  lines.push(`Total Deposited,${receipt.totalAmount} ${receipt.tokenSymbol}`)
  lines.push(`Withdrawn,${receipt.withdrawnAmount} ${receipt.tokenSymbol}`)
  lines.push(`Remaining,${receipt.remainingAmount} ${receipt.tokenSymbol}`)
  lines.push('')

  if (receipt.amountPerSecond) {
    lines.push('Unlock Rate')
    lines.push(`Per Second,${receipt.amountPerSecond} ${receipt.tokenSymbol}`)
    lines.push('')
  }

  lines.push('Transaction Hashes')
  if (receipt.creationTx) {
    lines.push(`Creation,${receipt.creationTx}`)
  }
  if (receipt.withdrawalTxs && receipt.withdrawalTxs.length > 0) {
    receipt.withdrawalTxs.forEach((tx, idx) => {
      lines.push(`Withdrawal ${idx + 1},${tx}`)
    })
  }
  if (receipt.cancellationTx) {
    lines.push(`Cancellation,${receipt.cancellationTx}`)
  }

  return lines.join('\n')
}

/**
 * Generate HTML content for receipt (print-friendly).
 */
export function generateReceiptHTML(
  receipt: ReceiptData,
  logoBase64?: string,
): string {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>FlowStar Stream Receipt - ${receipt.streamId}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      background: #f5f5f5;
    }

    @media screen {
      body {
        padding: 20px;
      }
      .receipt {
        background: white;
        max-width: 850px;
        margin: 0 auto;
        padding: 40px;
        border-radius: 8px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      }
    }

    @media print {
      body {
        background: white;
      }
      .receipt {
        padding: 0;
        box-shadow: none;
        border-radius: 0;
      }
      button, .no-print {
        display: none !important;
      }
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 40px;
      padding-bottom: 20px;
      border-bottom: 2px solid #f0f0f0;
    }

    .branding {
      flex: 1;
    }

    ${logoBase64 ? '.logo { width: 80px; height: auto; margin-bottom: 10px; }' : ''}

    .title {
      font-size: 24px;
      font-weight: 600;
      color: #000;
      margin-bottom: 5px;
    }

    .subtitle {
      font-size: 14px;
      color: #666;
    }

    .generated-date {
      text-align: right;
      color: #999;
      font-size: 12px;
    }

    .section {
      margin-bottom: 30px;
    }

    .section-title {
      font-size: 12px;
      font-weight: 600;
      color: #666;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 1px solid #e0e0e0;
    }

    .row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      font-size: 14px;
    }

    .row-label {
      color: #666;
      font-weight: 500;
    }

    .row-value {
      color: #000;
      font-weight: 500;
      text-align: right;
    }

    .row-value.mono {
      font-family: 'Monaco', 'Courier New', monospace;
      font-size: 13px;
    }

    .amount-row .row-value {
      font-size: 16px;
      font-weight: 600;
    }

    .status-completed {
      color: #10b981;
    }

    .status-active {
      color: #3b82f6;
    }

    .status-cancelled {
      color: #ef4444;
    }

    .divider {
      height: 1px;
      background: #f0f0f0;
      margin: 20px 0;
    }

    .actions {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #f0f0f0;
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }

    button {
      padding: 10px 20px;
      background: #3b82f6;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
    }

    button:hover {
      background: #2563eb;
    }

    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #f0f0f0;
      font-size: 12px;
      color: #999;
      text-align: center;
    }

    .tx-list {
      font-family: 'Monaco', 'Courier New', monospace;
      font-size: 12px;
      background: #f9f9f9;
      padding: 12px;
      border-radius: 4px;
      word-break: break-all;
      margin: 8px 0;
    }
  </style>
</head>
<body>
  <div class="receipt">
    <div class="header">
      <div class="branding">
        ${logoBase64 ? `<img src="${logoBase64}" alt="FlowStar" class="logo">` : ''}
        <div class="title">Stream Receipt</div>
        <div class="subtitle">FlowStar Token Stream</div>
      </div>
      <div class="generated-date">
        <div>Generated</div>
        <div>${receipt.generatedDate}</div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Stream Information</div>
      <div class="row">
        <span class="row-label">Stream ID</span>
        <span class="row-value mono">${receipt.streamId}</span>
      </div>
      <div class="row">
        <span class="row-label">Status</span>
        <span class="row-value status-${receipt.status.toLowerCase()}">${receipt.status}</span>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Parties</div>
      <div class="row">
        <span class="row-label">Sender</span>
        <span class="row-value mono">${receipt.sender}</span>
      </div>
      <div class="row">
        <span class="row-label">Recipient</span>
        <span class="row-value mono">${receipt.recipient}</span>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Token</div>
      <div class="row">
        <span class="row-label">Symbol</span>
        <span class="row-value">${receipt.tokenSymbol}</span>
      </div>
      <div class="row">
        <span class="row-label">Address</span>
        <span class="row-value mono">${receipt.tokenAddress}</span>
      </div>
    </div>

    <div class="divider"></div>

    <div class="section">
      <div class="section-title">Schedule</div>
      <div class="row">
        <span class="row-label">Start Date</span>
        <span class="row-value">${receipt.startDate}</span>
      </div>
      <div class="row">
        <span class="row-label">End Date</span>
        <span class="row-value">${receipt.endDate}</span>
      </div>
      <div class="row">
        <span class="row-label">Cliff Date</span>
        <span class="row-value">${receipt.cliffDate}</span>
      </div>
      ${receipt.cliffAmount ? `<div class="row">
        <span class="row-label">Cliff Amount</span>
        <span class="row-value">${receipt.cliffAmount} ${receipt.tokenSymbol}</span>
      </div>` : ''}
      <div class="row">
        <span class="row-label">Duration</span>
        <span class="row-value">${receipt.duration}</span>
      </div>
    </div>

    <div class="divider"></div>

    <div class="section">
      <div class="section-title">Amounts</div>
      <div class="row amount-row">
        <span class="row-label">Total Deposited</span>
        <span class="row-value">${receipt.totalAmount} ${receipt.tokenSymbol}</span>
      </div>
      <div class="row">
        <span class="row-label">Withdrawn</span>
        <span class="row-value">${receipt.withdrawnAmount} ${receipt.tokenSymbol}</span>
      </div>
      <div class="row">
        <span class="row-label">Remaining</span>
        <span class="row-value">${receipt.remainingAmount} ${receipt.tokenSymbol}</span>
      </div>
    </div>

    ${receipt.amountPerSecond ? `<div class="section">
      <div class="section-title">Unlock Rate</div>
      <div class="row">
        <span class="row-label">Per Second</span>
        <span class="row-value">${receipt.amountPerSecond} ${receipt.tokenSymbol}</span>
      </div>
    </div>` : ''}

    <div class="divider"></div>

    <div class="section">
      <div class="section-title">Transaction Hashes</div>
      ${receipt.creationTx ? `<div class="row"><span class="row-label">Creation</span></div><div class="tx-list">${receipt.creationTx}</div>` : ''}
      ${receipt.withdrawalTxs && receipt.withdrawalTxs.length > 0 ? receipt.withdrawalTxs.map((tx, idx) => `<div class="row"><span class="row-label">Withdrawal ${idx + 1}</span></div><div class="tx-list">${tx}</div>`).join('') : ''}
      ${receipt.cancellationTx ? `<div class="row"><span class="row-label">Cancellation</span></div><div class="tx-list">${receipt.cancellationTx}</div>` : ''}
    </div>

    <div class="actions no-print">
      <button onclick="window.print()">🖨️ Print Receipt</button>
      <button onclick="downloadAsCSV()">📥 Download CSV</button>
      <button onclick="window.close()">✕ Close</button>
    </div>

    <div class="footer">
      This receipt was generated by FlowStar. For on-chain verification, visit the Stellar Explorer.
    </div>
  </div>

  <script>
    function downloadAsCSV() {
      const csv = ${JSON.stringify(generateReceiptCSV(receipt))};
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'flowstar-receipt-${receipt.streamId}.csv';
      a.click();
      URL.revokeObjectURL(url);
    }
  </script>
</body>
</html>`

  return html
}

/**
 * Download content as a file.
 */
export function downloadFile(content: string, filename: string, mimeType: string = 'text/plain') {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
