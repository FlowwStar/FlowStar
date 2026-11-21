'use client'

import { Download, Sheet, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  buildReceiptData,
  generateReceiptCSV,
  generateReceiptHTML,
  downloadFile,
} from '@/lib/receipt-utils'
import { downloadReceiptButtonCopy } from '@/lib/copy/stream-detail'
import type { StreamData } from '@/types/stream'
import { toast } from 'sonner'

const copy = downloadReceiptButtonCopy

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
  const receipt = buildReceiptData(stream, creationTxHash, withdrawalTxHashes, cancellationTxHash)

  function downloadCSV() {
    const csv = generateReceiptCSV(receipt)
    downloadFile(csv, copy.csvFileName(stream.id), 'text/csv')
    toast.success(copy.csvSuccessTitle, {
      description: copy.csvSuccessDescription(stream.id),
    })
  }

  function openInBrowser() {
    const htmlContent = generateReceiptHTML(receipt)
    const blob = new Blob([htmlContent], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank')
    // The new tab needs the blob URL long enough to navigate; revoke after
    // that so each "View & Print" does not leak a blob for the page lifetime.
    window.setTimeout(() => {
      URL.revokeObjectURL(url)
    }, 10_000)
    toast.success(copy.htmlSuccessTitle, {
      description: copy.htmlSuccessDescription,
    })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" size="sm" className="gap-1.5">
          <Download className="size-4" />
          <span className="hidden sm:inline">{copy.triggerLabelFull}</span>
          <span className="sm:hidden">{copy.triggerLabelShort}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={openInBrowser}>
          <Printer className="size-4 mr-2" />
          <span>{copy.viewPrintHtmlItem}</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={downloadCSV}>
          <Sheet className="size-4 mr-2" />
          <span>{copy.downloadCsvItem}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
