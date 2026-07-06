'use client'

import { useCallback, useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, Loader2, Upload } from 'lucide-react'
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
import { parseCsvBatch, type CsvBatchRow } from '@/lib/csv-parser'
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

function isValidAddress(address: string) {
  return address.trim().startsWith('G') && address.trim().length === 56
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
  const { createStream, pending, error } = useContract()
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
  const selectedTokenInfo = TOKENS.find((t) => t.address === selectedToken) ?? TOKENS[0] ?? { address: '', symbol: 'XLM', decimals: 7 }

  const isValidRow = useCallback(
    (row: ParsedRow) => row.errors.length === 0,
    [],
  )

  const parsedRows = useMemo(
    () => rows,
    [rows],
  )

  const validRows = useMemo(
    () => parsedRows.filter(isValidRow),
    [parsedRows, isValidRow],
  )

  const loadCsv = useCallback(async (file: File) => {
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
      const cliffTime = source.cliff_time ? parseTimestamp(source.cliff_time) : null
      const cliffAmount = source.cliff_amount
        ? parseDecimalAmount(source.cliff_amount, selectedTokenInfo.decimals)
        : null

      const errors: string[] = []
      if (!recipient || !isValidAddress(recipient)) {
        errors.push('Invalid recipient address')
      }
      if (!amount || parseDecimalAmount(amount, selectedTokenInfo.decimals) === null) {
        errors.push('Invalid amount')
      }
      if (!startTime) {
        errors.push('Invalid start_time')
      }
      if (!endTime) {
        errors.push('Invalid end_time')
      }
      if (startTime && endTime && endTime <= startTime) {
        errors.push('end_time must be after start_time')
      }
      if (cliffTime && startTime && endTime && (cliffTime < startTime || cliffTime > endTime)) {
        errors.push('cliff_time must fall between start_time and end_time')
      }
      if (cliffAmount !== null && amount && cliffAmount > parseDecimalAmount(amount, selectedTokenInfo.decimals)!) {
        errors.push('cliff_amount cannot exceed total amount')
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
      setUploadError('CSV file contains no rows.')
    }
  }, [selectedTokenInfo.decimals])

  const handleFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file) return
      if (!file.name.toLowerCase().endsWith('.csv')) {
        setUploadError('Please upload a .csv file.')
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

    const failures: string[] = []

    for (let i = 0; i < validRows.length; i += 1) {
      const row = validRows[i]
      try {
        await createStream({
          recipient: row.recipient,
          token: selectedTokenInfo,
          totalAmount: parseDecimalAmount(row.amount, selectedTokenInfo.decimals)!,
          startTime: row.startTime!,
          endTime: row.endTime!,
          cliffTime: row.cliffTime ?? row.startTime!,
          cliffAmount: row.cliffAmount ?? 0n,
        })
        setCompletedCount((count) => count + 1)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Transaction failed'
        failures.push(`Row ${row.index}: ${message}`)
        break
      }
    }

    if (failures.length > 0) {
      setExecutionErrors(failures)
      toast.error('Batch create stopped on failure.')
    } else {
      toast.success('Batch create completed', {
        description: `${completedCount + validRows.length} streams created successfully.`,
      })
    }

    setExecuting(false)
  }, [createStream, selectedTokenInfo, validRows, completedCount])

  return (
    <RequireWallet>
      <div className="mx-auto max-w-6xl">
        <Link
          href="/app/create"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to single create
        </Link>

        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Batch create streams</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Upload a CSV of recipient schedules, preview the rows, and execute creation sequentially.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link href="/app">Return to dashboard</Link>
            </Button>
            <Button variant="secondary" asChild>
              <Link href="/app/create">Single stream</Link>
            </Button>
          </div>
        </div>

        <div className="mt-8 space-y-6">
          <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="token">Token</Label>
                <Select
                  value={selectedToken}
                  onValueChange={(value) => { if (value) setSelectedToken(value) }}
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
                <Label htmlFor="csvFile">CSV file</Label>
                <Input
                  id="csvFile"
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                />
                <p className="text-xs text-muted-foreground">
                  Format: recipient,amount,start_time,end_time,cliff_time,cliff_amount
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
            <div className="rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-4 text-sm text-yellow-700">
              <p className="font-semibold">CSV parse warnings</p>
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
                  <h2 className="text-lg font-semibold">Preview rows</h2>
                  <p className="text-sm text-muted-foreground">
                    {rows.length} row(s) loaded, {validRows.length} valid.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                  <span>Token: {selectedTokenInfo.symbol}</span>
                  <span>Rows: {rows.length}</span>
                  <span>Valid: {validRows.length}</span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="py-2 pr-3">#</th>
                      <th className="py-2 pr-3">Recipient</th>
                      <th className="py-2 pr-3">Amount</th>
                      <th className="py-2 pr-3">Start</th>
                      <th className="py-2 pr-3">End</th>
                      <th className="py-2 pr-3">Cliff</th>
                      <th className="py-2 pr-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr
                        key={row.index}
                        className={row.errors.length > 0 ? 'bg-red-50' : undefined}
                      >
                        <td className="py-3 pr-3 font-mono text-xs text-muted-foreground">
                          {row.index}
                        </td>
                        <td className="py-3 pr-3 font-mono text-xs">{row.recipient}</td>
                        <td className="py-3 pr-3">{row.amount} {selectedTokenInfo.symbol}</td>
                        <td className="py-3 pr-3">{formatTimestamp(row.startTime)}</td>
                        <td className="py-3 pr-3">{formatTimestamp(row.endTime)}</td>
                        <td className="py-3 pr-3">
                          {row.cliffTime ? formatTimestamp(row.cliffTime) : 'none'}
                          {row.cliffAmount !== null ? ` / ${row.cliffAmount.toString()}` : ''}
                        </td>
                        <td className="py-3 pr-3">
                          {row.errors.length === 0 ? (
                            <span className="rounded-full bg-emerald-100 px-2 py-1 text-emerald-700">
                              Valid
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
              <p className="font-semibold">Execution errors</p>
              <ul className="mt-2 list-disc pl-5 space-y-1">
                {executionErrors.map((message, index) => (
                  <li key={index}>{message}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="space-y-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Execute batch</h2>
                  <p className="text-sm text-muted-foreground">
                    Streams are created sequentially. The first invalid row will be skipped and any failure will pause execution.
                  </p>
                </div>
                <div className="rounded-2xl border border-border bg-background px-4 py-3 text-sm">
                  <p className="font-medium">Progress</p>
                  <p className="text-muted-foreground">
                    {completedCount} / {queuedCount} completed
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
                  {executing ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                  {executing ? 'Executing…' : 'Execute batch'}
                </Button>
                <Button type="button" variant="outline" asChild>
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
