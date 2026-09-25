'use client'

import { useCallback, useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, Download, Loader2, Upload } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { RequireWallet } from '@/components/layout/require-wallet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useContract } from '@/hooks/use-contract'
import { useNetwork } from '@/components/providers/network-provider'
import { parseTokenAmount, formatDateTime } from '@/lib/stream-utils'
import { parseCsvBatch, parseDuration, resolveCliffTime, type CsvBatchRow } from '@/lib/csv-parser'
import { downloadCSV } from '@/lib/export'
import { isValidStellarAddress } from '@/lib/stellar'
import { batchCreateCopy } from '@/lib/copy/batch-create'
import type { TokenInfo } from '@/types/stream'

function parseTimestamp(value: string): bigint | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  if (/^\d+$/.test(trimmed)) {
    const numeric = BigInt(trimmed)
    return trimmed.length === 13 ? numeric / 1000n : numeric
  }
  const parsed = Date.parse(trimmed)
  if (Number.isNaN(parsed)) return null
  return BigInt(Math.floor(parsed / 1000))
}

function formatTimestamp(value: bigint | null): string {
  if (value === null) return '-'
  return formatDateTime(value)
}

function parseDecimalAmount(value: string, decimals: number): bigint | null {
  const normalized = value.trim()
  if (!normalized || !/^\d+(\.\d+)?$/.test(normalized)) return null
  try {
    return parseTokenAmount(normalized, decimals)
  } catch {
    return null
  }
}

interface ParsedRow {
  source: CsvBatchRow
  index: number
  errors: string[]
  recipient: string
  amount: string
  startTime: bigint | null
  endTime: bigint | null
  cliffTime: bigint | null
  cliffAmount: bigint | null
}

export default function BatchCreatePage() {
  const { createStreamsBatch, pending, error } = useContract()
  const { config } = useNetwork()
  const TOKENS: TokenInfo[] = config.knownTokens.map((t) => ({ ...t }))
  const [selectedToken, setSelectedToken] = useState<string>('')
  const [fileText, setFileText] = useState('')
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [parseErrors, setParseErrors] = useState<string[]>([])
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [executing, setExecuting] = useState(false)
  const [completedCount, setCompletedCount] = useState(0)
  const [queuedCount, setQueuedCount] = useState(0)
  const [executionErrors, setExecutionErrors] = useState<string[]>([])
  const [liveStatus, setLiveStatus] = useState('')
  const selectedTokenInfo = TOKENS.find((t) => t.address === selectedToken) ??
    TOKENS[0] ?? { address: '', symbol: 'XLM', decimals: 7 }

  const isValidRow = useCallback((row: ParsedRow) => row.errors.length === 0, [])

  const parsedRows = useMemo(() => rows, [rows])

  const validRows = useMemo(() => parsedRows.filter(isValidRow), [parsedRows, isValidRow])

  const loadCsv = useCallback(
    async (file: File) => {
      setUploadError(null)
      setParseErrors([])
      setRows([])
      setExecutionErrors([])
      setCompletedCount(0)
      setQueuedCount(0)

      const text = await file.text()
      setFileText(text)
      const { rows: parsed, errors } = parseCsvBatch(text)
      setParseErrors(errors)

      const normalized = parsed.map((source, index) => {
        const recipient = source.recipient.trim()
        const amount = source.amount.trim()
        const startTime = parseTimestamp(source.start_time)
        const endTime = parseTimestamp(source.end_time)
        // An absolute cliff_time takes precedence; otherwise a relative
        // cliff_duration is resolved against this row's start_time.
        const cliffTime = resolveCliffTime(source, startTime, parseTimestamp)
        const cliffAmount = source.cliff_amount
          ? parseDecimalAmount(source.cliff_amount, selectedTokenInfo.decimals)
          : null

        const errors: string[] = []
        if (!recipient || !isValidStellarAddress(recipient)) {
          errors.push(batchCreateCopy.rowValidation.invalidRecipient)
        }
        if (!amount || parseDecimalAmount(amount, selectedTokenInfo.decimals) === null) {
          errors.push(batchCreateCopy.rowValidation.invalidAmount)
        }
        if (!startTime) {
          errors.push(batchCreateCopy.rowValidation.invalidStartTime)
        }
        if (!endTime) {
          errors.push(batchCreateCopy.rowValidation.invalidEndTime)
        }
        if (startTime && endTime && endTime <= startTime) {
          errors.push(batchCreateCopy.rowValidation.endTimeBeforeStartTime)
        }
        if (
          source.cliff_time &&
          resolveCliffTime({ cliff_time: source.cliff_time }, null, parseTimestamp) === null
        ) {
          errors.push(batchCreateCopy.rowValidation.invalidCliffTime)
        }
        if (source.cliff_duration && parseDuration(source.cliff_duration) === null) {
          errors.push(batchCreateCopy.rowValidation.invalidCliffDuration)
        }
        if (cliffTime && startTime && endTime && (cliffTime < startTime || cliffTime > endTime)) {
          errors.push(
            source.cliff_time
              ? batchCreateCopy.rowValidation.cliffTimeOutOfRange
              : batchCreateCopy.rowValidation.cliffDurationOutOfRange,
          )
        }
        if (
          cliffAmount !== null &&
          amount &&
          cliffAmount > parseDecimalAmount(amount, selectedTokenInfo.decimals)!
        ) {
          errors.push(batchCreateCopy.rowValidation.cliffAmountExceedsTotal)
        }

        return {
          source,
          index: index + 1,
          errors,
          recipient,
          amount,
          startTime,
          endTime,
          cliffTime,
          cliffAmount,
        }
      })

      setRows(normalized)
      setQueuedCount(normalized.filter((row) => row.errors.length === 0).length)

      if (errors.length === 0 && normalized.length === 0) {
        setUploadError(batchCreateCopy.form.csvEmptyError)
      }
    },
    [selectedTokenInfo.decimals],
  )

  const handleDownloadTemplate = useCallback(() => {
    const header = 'recipient,amount,start_time,end_time,cliff_time,cliff_amount'
    const exampleRow = [
      'GABC1234567890EXAMPLE1234567890EXAMPLE1234567890EXAMPLE1234',
      '1000',
      String(Math.floor(Date.now() / 1000)),
      String(Math.floor(Date.now() / 1000) + 30 * 24 * 3600),
      '',
      '',
    ].join(',')
    downloadCSV(`${header}\n${exampleRow}\n`, 'flowstar-batch-template.csv')
  }, [])

  const handleFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file) return
      if (!file.name.toLowerCase().endsWith('.csv')) {
        setUploadError(batchCreateCopy.form.csvFileTypeError)
        return
      }
      await loadCsv(file)
    },
    [loadCsv],
  )

  const handleExecute = useCallback(async () => {
    setExecuting(true)
    setExecutionErrors([])
    setCompletedCount(0)
    setQueuedCount(validRows.length)
    // Issue #686: announce progress for screen-reader/keyboard-only users.
    // `createStreamsBatch` submits every row as a single on-chain
    // transaction (not one call per row), so there's no real per-row
    // progress to announce — we report the start and the final outcome.
    setLiveStatus(batchCreateCopy.liveStatus.creating(validRows.length, validRows.length !== 1))

    const failures: string[] = []

    try {
      await createStreamsBatch(
        validRows.map((row) => ({
          recipient: row.recipient,
          token: selectedTokenInfo,
          totalAmount: parseDecimalAmount(row.amount, selectedTokenInfo.decimals)!,
          startTime: row.startTime!,
          endTime: row.endTime!,
          cliffTime: row.cliffTime ?? row.startTime!,
          cliffAmount: row.cliffAmount ?? 0n,
        })),
      )
      setCompletedCount(validRows.length)
    } catch (err) {
      const message = err instanceof Error ? err.message : batchCreateCopy.execution.transactionFailedFallback
      failures.push(message)
    }

    if (failures.length > 0) {
      setExecutionErrors(failures)
      setLiveStatus(batchCreateCopy.liveStatus.batchFailed(failures[0]))
      toast.error(batchCreateCopy.toasts.batchCreateFailed)
    } else {
      setLiveStatus(batchCreateCopy.liveStatus.success(validRows.length))
      toast.success(batchCreateCopy.toasts.batchCreateCompletedTitle, {
        description: batchCreateCopy.toasts.batchCreateCompletedDescription(validRows.length),
      })
    }

    setExecuting(false)
  }, [createStreamsBatch, selectedTokenInfo, validRows])

  return (
    <RequireWallet>
      <div className="mx-auto max-w-6xl">
        <Link
          href="/app/create"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          {batchCreateCopy.backToSingleCreate}
        </Link>

        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{batchCreateCopy.heading}</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              {batchCreateCopy.subheading}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link href="/app">{batchCreateCopy.returnToDashboard}</Link>
            </Button>
            <Button variant="secondary" asChild>
              <Link href="/app/create">{batchCreateCopy.singleStream}</Link>
            <Button variant="outline" nativeButton={false} asChild>
              <Link href="/app">Return to dashboard</Link>
            </Button>
            <Button variant="secondary" nativeButton={false} asChild>
              <Link href="/app/create">Single stream</Link>
            </Button>
          </div>
        </div>

        <div className="mt-8 space-y-6">
          <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="token">{batchCreateCopy.form.tokenLabel}</Label>
                <Select
                  value={selectedToken}
                  onValueChange={(value) => {
                    if (value) setSelectedToken(value)
                  }}
                >
                  <SelectTrigger id="token" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TOKENS.map((token) => (
                      <SelectItem key={token.address} value={token.address}>
                        {token.symbol}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="csvFile">{batchCreateCopy.form.csvFileLabel}</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-auto gap-1.5 px-2 py-1 text-xs text-muted-foreground"
                    onClick={handleDownloadTemplate}
                  >
                    <Download className="size-3.5" />
                    {batchCreateCopy.form.downloadCsvTemplate}
                  </Button>
                </div>
                <Input id="csvFile" type="file" accept=".csv" onChange={handleFileChange} />
                <p className="text-xs text-muted-foreground">
                  {batchCreateCopy.form.csvFormatHint}
                </p>
              </div>
            </div>
          </div>

          {uploadError && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
              {uploadError}
            </div>
          )}

          {parseErrors.length > 0 && (
            <div className="rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-4 text-sm text-yellow-600 dark:text-yellow-400">
              <p className="font-semibold">{batchCreateCopy.form.csvParseWarningsTitle}</p>
              <ul className="mt-2 list-disc pl-5 space-y-1">
                {parseErrors.map((message, index) => (
                  <li key={index}>{message}</li>
                ))}
              </ul>
            </div>
          )}

          {rows.length > 0 && (
            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold">{batchCreateCopy.preview.title}</h2>
                  <p className="text-sm text-muted-foreground">
                    {batchCreateCopy.preview.description(rows.length, validRows.length)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                  <span>{batchCreateCopy.preview.tokenMeta(selectedTokenInfo.symbol)}</span>
                  <span>{batchCreateCopy.preview.rowsMeta(rows.length)}</span>
                  <span>{batchCreateCopy.preview.validMeta(validRows.length)}</span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="py-2 pr-3">{batchCreateCopy.preview.tableHeaders.index}</th>
                      <th className="py-2 pr-3">{batchCreateCopy.preview.tableHeaders.recipient}</th>
                      <th className="py-2 pr-3">{batchCreateCopy.preview.tableHeaders.amount}</th>
                      <th className="py-2 pr-3">{batchCreateCopy.preview.tableHeaders.start}</th>
                      <th className="py-2 pr-3">{batchCreateCopy.preview.tableHeaders.end}</th>
                      <th className="py-2 pr-3">{batchCreateCopy.preview.tableHeaders.cliff}</th>
                      <th className="py-2 pr-3">{batchCreateCopy.preview.tableHeaders.status}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr
                        key={row.index}
                        className={row.errors.length > 0 ? 'bg-destructive/5 dark:bg-destructive/10' : undefined}
                      >
                        <td className="py-3 pr-3 font-mono text-xs text-muted-foreground">
                          {row.index}
                        </td>
                        <td className="py-3 pr-3 font-mono text-xs">{row.recipient}</td>
                        <td className="py-3 pr-3">
                          {row.amount} {selectedTokenInfo.symbol}
                        </td>
                        <td className="py-3 pr-3">{formatTimestamp(row.startTime)}</td>
                        <td className="py-3 pr-3">{formatTimestamp(row.endTime)}</td>
                        <td className="py-3 pr-3">
                          {row.cliffTime ? formatTimestamp(row.cliffTime) : batchCreateCopy.preview.noCliff}
                          {row.cliffAmount !== null ? ` / ${row.cliffAmount.toString()}` : ''}
                        </td>
                        <td className="py-3 pr-3">
                          {row.errors.length === 0 ? (
                            <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-emerald-600 dark:text-emerald-400">
                              {batchCreateCopy.preview.validStatus}
                            </span>
                          ) : (
                            <span className="rounded-full bg-destructive/10 px-2 py-1 text-destructive">
                              {row.errors[0]}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {executionErrors.length > 0 && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
              <p className="font-semibold">{batchCreateCopy.execution.errorsTitle}</p>
              <ul className="mt-2 list-disc pl-5 space-y-1">
                {executionErrors.map((message, index) => (
                  <li key={index}>{message}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Issue #686: screen-reader-only live region announcing batch progress */}
          <div role="status" aria-live="polite" className="sr-only">
            {liveStatus}
          </div>

          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="space-y-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold">{batchCreateCopy.execution.title}</h2>
                  <p className="text-sm text-muted-foreground">
                    {batchCreateCopy.execution.description}
                  </p>
                </div>
                <div className="rounded-2xl border border-border bg-background px-4 py-3 text-sm">
                  <p className="font-medium">{batchCreateCopy.execution.progressTitle}</p>
                  <p className="text-muted-foreground">
                    {batchCreateCopy.execution.progressCompleted(completedCount, queuedCount)}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  disabled={pending || executing || validRows.length === 0}
                  onClick={handleExecute}
                  className="gap-2"
                >
                  {executing ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Upload className="size-4" />
                  )}
                  {executing ? batchCreateCopy.execution.executingButton : batchCreateCopy.execution.executeButton}
                </Button>
                <Button type="button" variant="outline" asChild>
                  <Link href="/app/create">{batchCreateCopy.execution.reviewSingleStream}</Link>
                <Button type="button" variant="outline" nativeButton={false} asChild>
                  <Link href="/app/create">Review single stream</Link>
                </Button>
              </div>
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
              {error}
            </div>
          )}
        </div>
      </div>
    </RequireWallet>
  )
}
