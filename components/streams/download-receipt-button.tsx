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
  )
}
