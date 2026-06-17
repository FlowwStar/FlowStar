'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight, Info } from 'lucide-react'
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
import { KNOWN_TOKENS } from '@/lib/stellar'
import { parseTokenAmount } from '@/lib/stream-utils'
import type { TokenInfo } from '@/types/stream'

const TOKENS: TokenInfo[] = KNOWN_TOKENS.map((t) => ({ ...t }))

function toUnixSeconds(localDatetimeValue: string): bigint {
  return BigInt(Math.floor(new Date(localDatetimeValue).getTime() / 1000))
}

function localDatetimeMin(offsetSeconds = 0): string {
  const d = new Date(Date.now() + offsetSeconds * 1000)
  // Format as YYYY-MM-DDTHH:MM required by datetime-local
  return d.toISOString().slice(0, 16)
}

interface FormState {
  recipient: string
  tokenAddress: string
  amount: string
  startDate: string
  endDate: string
  hasCliff: boolean
  cliffDate: string
  cliffAmount: string
}

function CreateForm() {
  const router = useRouter()
  const { createStream, pending, error } = useContract()

  const defaultStart = localDatetimeMin(60) // 1 min from now
  const defaultEnd = localDatetimeMin(60 + 30 * 24 * 3600) // +30 days

  const [form, setForm] = useState<FormState>({
    recipient: '',
    tokenAddress: TOKENS[0].address,
    amount: '',
    startDate: defaultStart,
    endDate: defaultEnd,
    hasCliff: false,
    cliffDate: defaultStart,
    cliffAmount: '',
  })

  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({})

  const selectedToken = TOKENS.find((t) => t.address === form.tokenAddress) ?? TOKENS[0]

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  function validate(): boolean {
    const newErrors: Partial<Record<keyof FormState, string>> = {}

    if (!form.recipient.trim() || form.recipient.length < 56) {
      newErrors.recipient = 'Enter a valid Stellar address (starts with G, 56 chars)'
    }
    if (!form.amount || isNaN(Number(form.amount)) || Number(form.amount) <= 0) {
      newErrors.amount = 'Enter a valid amount greater than 0'
    }
    const start = new Date(form.startDate).getTime()
    const end = new Date(form.endDate).getTime()
    if (!form.endDate || end <= start) {
      newErrors.endDate = 'End date must be after start date'
    }
    if (form.hasCliff) {
      const cliff = new Date(form.cliffDate).getTime()
      if (!form.cliffDate || cliff < start || cliff > end) {
        newErrors.cliffDate = 'Cliff must be between start and end date'
      }
      if (form.cliffAmount && Number(form.cliffAmount) > Number(form.amount)) {
        newErrors.cliffAmount = 'Cliff amount cannot exceed total amount'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return

    const startTime = toUnixSeconds(form.startDate)
    const endTime = toUnixSeconds(form.endDate)
    const cliffTime = form.hasCliff ? toUnixSeconds(form.cliffDate) : startTime
    const cliffAmount = form.hasCliff && form.cliffAmount
      ? parseTokenAmount(form.cliffAmount, selectedToken.decimals)
      : 0n

    try {
      const id = await createStream({
        recipient: form.recipient.trim(),
        token: selectedToken,
        totalAmount: parseTokenAmount(form.amount, selectedToken.decimals),
        startTime,
        endTime,
        cliffTime,
        cliffAmount,
      })
      toast.success('Stream created', { description: `Stream #${id} is live.` })
      router.push(`/app/stream/${id}`)
    } catch {
      // error is exposed via useContract
    }
  }

  return (
    <div className="mx-auto max-w-xl">
      {/* Back */}
      <Link
        href="/app"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to dashboard
      </Link>

      <div className="mt-6">
        <h1 className="text-2xl font-semibold tracking-tight">Create a stream</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tokens unlock continuously to the recipient from start to end.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-8 space-y-6">
        {/* Token + Amount */}
        <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Amount
          </h2>

          <div className="space-y-1.5">
            <Label htmlFor="token">Token</Label>
            <Select
              value={form.tokenAddress}
              onValueChange={(v) => set('tokenAddress', v)}
            >
              <SelectTrigger id="token" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TOKENS.map((t) => (
                  <SelectItem key={t.address} value={t.address}>
                    {t.symbol}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="amount">Total amount ({selectedToken.symbol})</Label>
            <Input
              id="amount"
              type="number"
              min="0"
              step="any"
              placeholder="e.g. 10000"
              value={form.amount}
              onChange={(e) => set('amount', e.target.value)}
              aria-invalid={!!errors.amount}
            />
            {errors.amount && (
              <p className="text-xs text-destructive">{errors.amount}</p>
            )}
          </div>
        </div>

        {/* Recipient */}
        <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Recipient
          </h2>
          <div className="space-y-1.5">
            <Label htmlFor="recipient">Stellar address</Label>
            <Input
              id="recipient"
              placeholder="GABC…"
              value={form.recipient}
              onChange={(e) => set('recipient', e.target.value)}
              aria-invalid={!!errors.recipient}
              className="font-mono text-xs"
            />
            {errors.recipient && (
              <p className="text-xs text-destructive">{errors.recipient}</p>
            )}
          </div>
        </div>

        {/* Schedule */}
        <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Schedule
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="startDate">Start date</Label>
              <Input
                id="startDate"
                type="datetime-local"
                value={form.startDate}
                min={localDatetimeMin()}
                onChange={(e) => set('startDate', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="endDate">End date</Label>
              <Input
                id="endDate"
                type="datetime-local"
                value={form.endDate}
                min={form.startDate}
                onChange={(e) => set('endDate', e.target.value)}
                aria-invalid={!!errors.endDate}
              />
              {errors.endDate && (
                <p className="text-xs text-destructive">{errors.endDate}</p>
              )}
            </div>
          </div>

          {/* Cliff toggle */}
          <div className="flex items-start gap-3 pt-1">
            <input
              id="hasCliff"
              type="checkbox"
              checked={form.hasCliff}
              onChange={(e) => set('hasCliff', e.target.checked)}
              className="mt-0.5 size-4 accent-primary"
            />
            <div>
              <Label htmlFor="hasCliff">Add a cliff</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Nothing unlocks before the cliff date. Optionally release a lump sum at the cliff.
              </p>
            </div>
          </div>

          {form.hasCliff && (
            <div className="grid gap-4 sm:grid-cols-2 pt-1">
              <div className="space-y-1.5">
                <Label htmlFor="cliffDate">Cliff date</Label>
                <Input
                  id="cliffDate"
                  type="datetime-local"
                  value={form.cliffDate}
                  min={form.startDate}
                  max={form.endDate}
                  onChange={(e) => set('cliffDate', e.target.value)}
                  aria-invalid={!!errors.cliffDate}
                />
                {errors.cliffDate && (
                  <p className="text-xs text-destructive">{errors.cliffDate}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cliffAmount">
                  Cliff amount ({selectedToken.symbol}){' '}
                  <span className="text-muted-foreground font-normal">optional</span>
                </Label>
                <Input
                  id="cliffAmount"
                  type="number"
                  min="0"
                  step="any"
                  placeholder="0"
                  value={form.cliffAmount}
                  onChange={(e) => set('cliffAmount', e.target.value)}
                  aria-invalid={!!errors.cliffAmount}
                />
                {errors.cliffAmount && (
                  <p className="text-xs text-destructive">{errors.cliffAmount}</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Contract error */}
        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            <Info className="mt-0.5 size-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Submit */}
        <div className="flex items-center justify-end gap-3">
          <Button type="button" variant="ghost" asChild>
            <Link href="/app">Cancel</Link>
          </Button>
          <Button type="submit" disabled={pending} className="gap-1.5">
            {pending ? 'Creating…' : 'Create stream'}
            {!pending && <ArrowRight className="size-4" />}
          </Button>
        </div>
      </form>
    </div>
  )
}

export default function CreatePage() {
  return (
    <RequireWallet>
      <CreateForm />
    </RequireWallet>
  )
}
