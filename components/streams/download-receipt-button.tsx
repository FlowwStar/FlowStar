'use client'

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
