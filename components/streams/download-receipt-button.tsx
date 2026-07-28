'use client'

/**
 * DownloadReceiptButton — generates and downloads a plain-text receipt for a
 * completed or cancelled stream.
 *
 * Fix #362 — the original stub declared `openReceiptWindow` / `setOpenReceiptWindow`
 * state that was never read or set anywhere else in the component. That dead
 * state has been removed entirely.
 */

import { useState } from 'react'
import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { StreamData } from '@/types/stream'
import { formatTokenAmount, formatDateTime, shortenAddress } from '@/lib/stream-utils'

interface DownloadReceiptButtonProps {
  stream: StreamData
}

function buildReceiptText(stream: StreamData): string {
  const decimals = stream.token.decimals
  const lines: string[] = [
    '══════════════════════════════════════',
    '         FLOWSTAR — STREAM RECEIPT    ',
    '══════════════════════════════════════',
    '',
    `Stream ID       : ${stream.id}`,
    `Token           : ${stream.token.symbol} (${stream.token.address})`,
    `Status          : ${stream.cancelled ? 'Cancelled' : 'Completed'}`,
    '',
    `Sender          : ${shortenAddress(stream.sender, 8)}`,
    `Recipient       : ${shortenAddress(stream.recipient, 8)}`,
    '',
    `Total deposited : ${formatTokenAmount(stream.depositedAmount, decimals, decimals)} ${stream.token.symbol}`,
    `Total withdrawn : ${formatTokenAmount(stream.withdrawnAmount, decimals, decimals)} ${stream.token.symbol}`,
    '',
    `Start           : ${formatDateTime(stream.startTime)}`,
    `End             : ${formatDateTime(stream.endTime)}`,
    ...(stream.cliffTime > stream.startTime
      ? [`Cliff           : ${formatDateTime(stream.cliffTime)}`]
      : []),
    '',
    '══════════════════════════════════════',
    `Generated       : ${new Date().toUTCString()}`,
    '══════════════════════════════════════',
  ]
  return lines.join('\n')
}

export function DownloadReceiptButton({ stream }: DownloadReceiptButtonProps) {
  const [downloading, setDownloading] = useState(false)

  function handleDownload() {
    setDownloading(true)
    try {
      const text = buildReceiptText(stream)
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `flowstar-receipt-stream-${stream.id}.txt`
      anchor.click()
      URL.revokeObjectURL(url)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleDownload}
      disabled={downloading}
      className="gap-1.5"
    >
      <Download className="size-4" />
      {downloading ? 'Preparing…' : 'Download receipt'}
    </Button>
import { useState } from 'react'
import { Download, FileText, Sheet, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { buildReceiptData, generateReceiptCSV, generateReceiptHTML, downloadFile } from '@/lib/receipt-utils'
import type { StreamData } from '@/types/stream'
import { toast } from 'sonner'

interface DownloadReceiptButtonProps {
  stream: StreamData
  creationTxHash?: string
  withdrawalTxHashes?: string[]
  cancellationTxHash?: string
}

/**
 * Button to download stream receipt in various formats.
 */
export function DownloadReceiptButton({
  stream,
  creationTxHash,
  withdrawalTxHashes,
  cancellationTxHash,
}: DownloadReceiptButtonProps) {
  const [openReceiptWindow, setOpenReceiptWindow] = useState(false)

  const receipt = buildReceiptData(
    stream,
    creationTxHash,
    withdrawalTxHashes,
    cancellationTxHash,
  )

  function downloadCSV() {
    const csv = generateReceiptCSV(receipt)
    downloadFile(csv, `flowstar-receipt-${stream.id}.csv`, 'text/csv')
    toast.success('Receipt downloaded', {
      description: `Saved as flowstar-receipt-${stream.id}.csv`,
    })
  }

  function openInBrowser() {
    const htmlContent = generateReceiptHTML(receipt)
    const blob = new Blob([htmlContent], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank')
    toast.success('Receipt opened', {
      description: 'A new window with your receipt has been opened. You can print it from there.',
    })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="secondary"
          size="sm"
          className="gap-1.5"
        >
          <Download className="size-4" />
          <span className="hidden sm:inline">Download Receipt</span>
          <span className="sm:hidden">Receipt</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={openInBrowser}>
          <Printer className="size-4 mr-2" />
          <span>View & Print HTML</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={downloadCSV}>
          <Sheet className="size-4 mr-2" />
          <span>Download CSV</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
