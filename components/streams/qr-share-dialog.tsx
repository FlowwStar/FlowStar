"use client";

import { useRef, useState } from "react";
import { Copy, Check, Download } from "lucide-react";
import { QRCodeSVG, QRCodeCanvas } from "qrcode.react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { StreamStatusBadge } from "@/components/streams/stream-status-badge";
import { formatTokenAmount, shortenAddress } from "@/lib/stream-utils";
import type { StreamData, StreamStatus } from "@/types/stream";

interface QrShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  streamUrl: string;
  stream: StreamData;
  status: StreamStatus;
}

/**
 * Issue #153 — QR code generation for stream sharing.
 *
 * Shows an SVG QR code (crisp at any size) encoding the stream URL, plus a
 * hidden canvas rendering of the same QR used only to produce a PNG for
 * download. Built on the existing `Dialog` primitive (@base-ui/react), which
 * already provides a focus trap and Escape-to-dismiss.
 */
export function QrShareDialog({
  open,
  onOpenChange,
  streamUrl,
  stream,
  status,
}: QrShareDialogProps) {
  const [copied, setCopied] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  function copyLink() {
    navigator.clipboard.writeText(streamUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
    toast.success("Link copied to clipboard");
  }

  function downloadPng() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `flowstar-stream-${stream.id}-qr.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
    toast.success("QR code downloaded");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Share stream</DialogTitle>
          <DialogDescription>
            Scan this QR code to open stream #{stream.id} on any device.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-2">
          <div className="rounded-xl border border-border bg-white p-4">
            <QRCodeSVG value={streamUrl} size={192} level="M" marginSize={0} />
          </div>
          {/* Hidden higher-resolution canvas, used only for the PNG download. */}
          <QRCodeCanvas
            ref={canvasRef}
            value={streamUrl}
            size={512}
            level="M"
            marginSize={2}
            className="hidden"
          />

          <div className="flex w-full items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
            <span className="flex-1 truncate font-mono text-xs text-muted-foreground">
              {streamUrl}
            </span>
            <button
              type="button"
              onClick={copyLink}
              aria-label="Copy stream link"
              className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
            >
              {copied ? (
                <Check className="size-4 text-primary" />
              ) : (
                <Copy className="size-4" />
              )}
            </button>
          </div>

          <div className="flex w-full gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={downloadPng}
            >
              <Download className="size-4" />
              Download QR
            </Button>
          </div>

          <div className="w-full rounded-lg border border-border p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Amount</span>
              <span className="font-mono font-medium">
                {formatTokenAmount(stream.depositedAmount, stream.token.decimals, 2)}{" "}
                {stream.token.symbol}
              </span>
            </div>
            <div className="mt-1.5 flex items-center justify-between">
              <span className="text-muted-foreground">Recipient</span>
              <span className="font-mono">{shortenAddress(stream.recipient, 5)}</span>
            </div>
            <div className="mt-1.5 flex items-center justify-between">
              <span className="text-muted-foreground">Status</span>
              <StreamStatusBadge status={status} />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
