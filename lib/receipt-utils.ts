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
 * Escape a string for safe interpolation into HTML text content or attribute values.
 * Replaces the five characters that carry meaning in HTML/XML.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
}

/**
 * Generate HTML content for receipt (print-friendly).
 */
export function generateReceiptHTML(
  receipt: ReceiptData,
  logoBase64?: string,
): string {
  // Escape all dynamic values before they touch the HTML string.
  const id        = escapeHtml(receipt.streamId)
  const status    = escapeHtml(receipt.status)
  // status is always one of 'Active' | 'Completed' | 'Cancelled' (ASCII), but
  // we still escape it and use the escaped form for the CSS class name so a
  // hypothetical future status value cannot break out of the attribute.
  const statusCls = escapeHtml(receipt.status.toLowerCase())
  const sender    = escapeHtml(receipt.sender)
  const recipient = escapeHtml(receipt.recipient)
  const symbol    = escapeHtml(receipt.tokenSymbol)
  const address   = escapeHtml(receipt.tokenAddress)
  const generated = escapeHtml(receipt.generatedDate)
  const startDate = escapeHtml(receipt.startDate)
  const endDate   = escapeHtml(receipt.endDate)
  const cliffDate = escapeHtml(receipt.cliffDate)
  const duration  = escapeHtml(receipt.duration)
  const total     = escapeHtml(receipt.totalAmount)
  const withdrawn = escapeHtml(receipt.withdrawnAmount)
  const remaining = escapeHtml(receipt.remainingAmount)
  const cliffAmt  = receipt.cliffAmount   ? escapeHtml(receipt.cliffAmount)   : null
  const perSec    = receipt.amountPerSecond ? escapeHtml(receipt.amountPerSecond) : null
  const creationTx    = receipt.creationTx    ? escapeHtml(receipt.creationTx)    : null
  const cancellationTx = receipt.cancellationTx ? escapeHtml(receipt.cancellationTx) : null
  const withdrawalTxs = (receipt.withdrawalTxs ?? []).map(escapeHtml)

  // The CSV data is passed through JSON.stringify which produces a valid JS
  // string literal.  The only remaining risk is a </script> sequence inside
  // the JSON payload; replace it with a safe Unicode escape so the inline
  // script tag cannot be terminated early.
  const csvJson = JSON.stringify(generateReceiptCSV(receipt))
    .replace(/<\/script>/gi, '<\\/script>')

  // The download filename only needs to appear inside a JS string literal
  // (already wrapped in quotes by the template below), so we escape backslash
  // and the quote character that wraps it.
  const safeId = receipt.streamId.replace(/\\/g, '\\\\').replace(/'/g, "\\'")

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>FlowStar Stream Receipt - ${id}</title>
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
        <div>${generated}</div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Stream Information</div>
      <div class="row">
        <span class="row-label">Stream ID</span>
        <span class="row-value mono">${id}</span>
      </div>
      <div class="row">
        <span class="row-label">Status</span>
        <span class="row-value status-${statusCls}">${status}</span>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Parties</div>
      <div class="row">
        <span class="row-label">Sender</span>
        <span class="row-value mono">${sender}</span>
      </div>
      <div class="row">
        <span class="row-label">Recipient</span>
        <span class="row-value mono">${recipient}</span>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Token</div>
      <div class="row">
        <span class="row-label">Symbol</span>
        <span class="row-value">${symbol}</span>
      </div>
      <div class="row">
        <span class="row-label">Address</span>
        <span class="row-value mono">${address}</span>
      </div>
    </div>

    <div class="divider"></div>

    <div class="section">
      <div class="section-title">Schedule</div>
      <div class="row">
        <span class="row-label">Start Date</span>
        <span class="row-value">${startDate}</span>
      </div>
      <div class="row">
        <span class="row-label">End Date</span>
        <span class="row-value">${endDate}</span>
      </div>
      <div class="row">
        <span class="row-label">Cliff Date</span>
        <span class="row-value">${cliffDate}</span>
      </div>
      ${cliffAmt ? `<div class="row">
        <span class="row-label">Cliff Amount</span>
        <span class="row-value">${cliffAmt} ${symbol}</span>
      </div>` : ''}
      <div class="row">
        <span class="row-label">Duration</span>
        <span class="row-value">${duration}</span>
      </div>
    </div>

    <div class="divider"></div>

    <div class="section">
      <div class="section-title">Amounts</div>
      <div class="row amount-row">
        <span class="row-label">Total Deposited</span>
        <span class="row-value">${total} ${symbol}</span>
      </div>
      <div class="row">
        <span class="row-label">Withdrawn</span>
        <span class="row-value">${withdrawn} ${symbol}</span>
      </div>
      <div class="row">
        <span class="row-label">Remaining</span>
        <span class="row-value">${remaining} ${symbol}</span>
      </div>
    </div>

    ${perSec ? `<div class="section">
      <div class="section-title">Unlock Rate</div>
      <div class="row">
        <span class="row-label">Per Second</span>
        <span class="row-value">${perSec} ${symbol}</span>
      </div>
    </div>` : ''}

    <div class="divider"></div>

    <div class="section">
      <div class="section-title">Transaction Hashes</div>
      ${creationTx ? `<div class="row"><span class="row-label">Creation</span></div><div class="tx-list">${creationTx}</div>` : ''}
      ${withdrawalTxs.length > 0 ? withdrawalTxs.map((tx, idx) => `<div class="row"><span class="row-label">Withdrawal ${idx + 1}</span></div><div class="tx-list">${tx}</div>`).join('') : ''}
      ${cancellationTx ? `<div class="row"><span class="row-label">Cancellation</span></div><div class="tx-list">${cancellationTx}</div>` : ''}
    </div>

    <div class="actions no-print">
      <button onclick="window.print()">&#x1F5A8;&#xFE0F; Print Receipt</button>
      <button onclick="downloadAsCSV()">&#x1F4E5; Download CSV</button>
      <button onclick="window.close()">&#x2715; Close</button>
    </div>

    <div class="footer">
      This receipt was generated by FlowStar. For on-chain verification, visit the Stellar Explorer.
    </div>
  </div>

  <script>
    function downloadAsCSV() {
      var csv = ${csvJson};
      var blob = new Blob([csv], { type: 'text/csv' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'flowstar-receipt-${safeId}.csv';
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
