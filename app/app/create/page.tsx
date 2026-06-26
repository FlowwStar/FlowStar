'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AlertTriangle, ArrowLeft, ArrowRight, Info, Loader2, Copy } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { StrKey } from '@stellar/stellar-sdk'
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
import { useWallet } from '@/hooks/use-wallet'
import { useNetwork } from '@/components/providers/network-provider'
import { getAllTokens, saveCustomToken } from '@/lib/stellar'
import { getTokenMetadata, getTokenBalance } from '@/lib/contract'
import { parseTokenAmount, formatTokenAmount } from '@/lib/stream-utils'
import { StreamPreview } from '@/components/streams/stream-preview'
import { CreateConfirmation } from '@/components/streams/create-confirmation'
import type { TokenInfo } from '@/types/stream'

const CUSTOM_VALUE = '__custom__'

function toUnixSeconds(localDatetimeValue: string): bigint {
  return BigInt(Math.floor(new Date(localDatetimeValue).getTime() / 1000))
}

function localDatetimeMin(offsetSeconds = 0): string {
  const d = new Date(Date.now() + offsetSeconds * 1000)
  return d.toISOString().slice(0, 16)
}

function addDuration(baseDatetime: string, seconds: number): string {
  const base = new Date(baseDatetime)
  return new Date(base.getTime() + seconds * 1000).toISOString().slice(0, 16)
}

const DURATION_PRESETS = [
  { label: '1 week', seconds: 7 * 24 * 3600 },
  { label: '1 month', seconds: 30 * 24 * 3600 },
  { label: '3 months', seconds: 90 * 24 * 3600 },
  { label: '6 months', seconds: 180 * 24 * 3600 },
  { label: '1 year', seconds: 365 * 24 * 3600 },
] as const

const CLIFF_PRESETS = [
  { label: 'No cliff', seconds: 0 },
  { label: '1 month', seconds: 30 * 24 * 3600 },
  { label: '3 months', seconds: 90 * 24 * 3600 },
] as const

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
  const searchParams = useSearchParams()
  const cloneId = searchParams.get('clone')
  const { address: walletAddress } = useWallet()
  const { network } = useNetwork()
  const { createStream, estimateFee, pending, error } = useContract()
  const [feeEstimate, setFeeEstimate] = useState<string | null>(null)
  const [estimatingFee, setEstimatingFee] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)

  const [tokens, setTokens] = useState<TokenInfo[]>(() => getAllTokens(network).map((t) => ({ ...t })))
  const [isCustom, setIsCustom] = useState(false)
  const [customAddress, setCustomAddress] = useState('')
  const [customLoading, setCustomLoading] = useState(false)
  const [customError, setCustomError] = useState<string | null>(null)
  const [customToken, setCustomToken] = useState<TokenInfo | null>(null)

  // Issue #29: balance state
  const [tokenBalance, setTokenBalance] = useState<bigint | null>(null)
  const [balanceLoading, setBalanceLoading] = useState(false)

  const defaultStart = localDatetimeMin(60)
  const defaultEnd = localDatetimeMin(60 + 30 * 24 * 3600)

  const [form, setForm] = useState<FormState>(() => {
    const newStart = localDatetimeMin(60)
    const durationSecs = searchParams.get('duration')
    const cliffSecs = searchParams.get('cliff')
    const hasCliff = cliffSecs !== null && cliffSecs !== '0'
    const newEnd = durationSecs
      ? addDuration(newStart, Number(durationSecs))
      : localDatetimeMin(60 + 30 * 24 * 3600)
    const newCliff = hasCliff && cliffSecs
      ? addDuration(newStart, Number(cliffSecs))
      : newStart

    return {
      recipient: searchParams.get('recipient') ?? '',
      tokenAddress: searchParams.get('token') ?? (tokens[0]?.address ?? ''),
      amount: searchParams.get('amount') ?? '',
      startDate: newStart,
      endDate: newEnd,
      hasCliff,
      cliffDate: newCliff,
      cliffAmount: searchParams.get('cliffAmount') ?? '',
    }
  })

  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({})

  const selectedToken = isCustom && customToken
    ? customToken
    : tokens.find((t) => t.address === form.tokenAddress) ?? tokens[0]

  // Fetch balance when token or wallet changes
  useEffect(() => {
    if (!walletAddress || !selectedToken) return
    setTokenBalance(null)
    setBalanceLoading(true)
    getTokenBalance(selectedToken.address, walletAddress)
      .then(setTokenBalance)
      .catch(() => setTokenBalance(null))
      .finally(() => setBalanceLoading(false))
  }, [selectedToken?.address, walletAddress])

  async function handleCustomTokenLookup() {
    if (!customAddress || customAddress.length < 56) {
      setCustomError('Enter a valid Stellar contract address (56 chars, starts with C)')
      return
    }
    setCustomLoading(true)
    setCustomError(null)
    setCustomToken(null)
    try {
      const meta = await getTokenMetadata(customAddress)
      if (!meta) {
        setCustomError('Could not fetch token metadata. Verify this is a valid SEP-41 token contract.')
        return
      }
      setCustomToken(meta)
      saveCustomToken(network, meta)
      setTokens(getAllTokens(network).map((t) => ({ ...t })))
      set('tokenAddress', meta.address)
    } catch {
      setCustomError('Failed to query token contract')
    } finally {
      setCustomLoading(false)
    }
  }

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  function validate(): boolean {
    const newErrors: Partial<Record<keyof FormState, string>> = {}

    // Issue #28: use StrKey for proper Stellar address validation
    if (!form.recipient.trim() || !StrKey.isValidEd25519PublicKey(form.recipient.trim())) {
      newErrors.recipient = 'Invalid Stellar address format'
    }
    if (!form.amount || isNaN(Number(form.amount)) || Number(form.amount) <= 0) {
      newErrors.amount = 'Enter a valid amount greater than 0'
    }
    // Issue #29: validate against balance
    if (form.amount && tokenBalance !== null) {
      const parsed = parseTokenAmount(form.amount, selectedToken.decimals)
      if (parsed > tokenBalance) {
        newErrors.amount = `Amount exceeds your balance (${formatTokenAmount(tokenBalance, selectedToken.decimals, 4)} ${selectedToken.symbol})`
      }
    }
    if (isCustom && !customToken) {
      newErrors.tokenAddress = 'Look up a valid custom token first'
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

  const buildInput = useCallback(() => {
    const startTime = toUnixSeconds(form.startDate)
    const endTime = toUnixSeconds(form.endDate)
    const cliffTime = form.hasCliff ? toUnixSeconds(form.cliffDate) : startTime
    const cliffAmount = form.hasCliff && form.cliffAmount
      ? parseTokenAmount(form.cliffAmount, selectedToken.decimals)
      : 0n
    return {
      recipient: form.recipient.trim(),
      token: selectedToken,
      totalAmount: parseTokenAmount(form.amount, selectedToken.decimals),
      startTime,
      endTime,
      cliffTime,
      cliffAmount,
    }
  }, [form, selectedToken])

  async function handleEstimateFee() {
    if (!validate()) return
    setEstimatingFee(true)
    setFeeEstimate(null)
    try {
      const estimate = await estimateFee(buildInput())
      if (estimate) {
        setFeeEstimate(estimate.estimatedFeeXlm)
      }
    } catch {
      setFeeEstimate(null)
    } finally {
      setEstimatingFee(false)
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    // Issue #30: show confirmation dialog instead of immediately transacting
    setShowConfirmation(true)
  }

  async function handleConfirmedCreate() {
    try {
      const id = await createStream(buildInput())
      setShowConfirmation(false)
      toast.success('Stream created', { description: `Stream #${id} is live.` })
      router.push(`/app/stream/${id}`)
    } catch {
      // error is exposed via useContract
    }
  }

  const input = showConfirmation ? buildInput() : null
  const durationSeconds = (new Date(form.endDate).getTime() - new Date(form.startDate).getTime()) / 1000
  const amountPerSecond = input && durationSeconds > 0
    ? input.totalAmount / BigInt(Math.floor(durationSeconds))
    : 0n

  return (
    <div className="mx-auto max-w-4xl">
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

      {cloneId && (
        <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3">
          <Copy className="size-4 shrink-0 text-primary" />
          <p className="text-sm text-primary">
            Duplicating Stream #{cloneId} — form pre-filled with its parameters.
          </p>
        </div>
      )}

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_320px]">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Token + Amount */}
        <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Amount
          </h2>

          <div className="space-y-1.5">
            <Label htmlFor="token">Token</Label>
            <Select
              value={isCustom ? CUSTOM_VALUE : form.tokenAddress}
              onValueChange={(v) => {
                if (!v) return
                if (v === CUSTOM_VALUE) {
                  setIsCustom(true)
                } else {
                  setIsCustom(false)
                  setCustomToken(null)
                  setCustomError(null)
                  set('tokenAddress', v)
                }
              }}
            >
              <SelectTrigger id="token" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {tokens.map((t) => (
                  <SelectItem key={t.address} value={t.address}>
                    {t.symbol}
                  </SelectItem>
                ))}
                <SelectItem value={CUSTOM_VALUE}>Custom token…</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isCustom && (
            <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
              <Label htmlFor="customToken" className="text-xs">Token contract address</Label>
              <div className="flex gap-2">
                <Input
                  id="customToken"
                  placeholder="CABC…"
                  value={customAddress}
                  onChange={(e) => {
                    setCustomAddress(e.target.value)
                    setCustomError(null)
                  }}
                  className="font-mono text-xs"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={customLoading}
                  onClick={handleCustomTokenLookup}
                >
                  {customLoading ? <Loader2 className="size-4 animate-spin" /> : 'Lookup'}
                </Button>
              </div>
              {customError && (
                <p className="text-xs text-destructive">{customError}</p>
              )}
              {customToken && (
                <p className="text-xs text-primary">
                  Found: {customToken.symbol} ({customToken.decimals} decimals)
                </p>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            {/* Issue #29: show balance + Max button */}
            <div className="flex items-center justify-between">
              <Label htmlFor="amount">Total amount ({selectedToken.symbol})</Label>
              <span className="text-xs text-muted-foreground">
                {balanceLoading
                  ? 'Loading balance…'
                  : tokenBalance !== null
                  ? `Balance: ${formatTokenAmount(tokenBalance, selectedToken.decimals, 4)} ${selectedToken.symbol}`
                  : null}
              </span>
            </div>
            <div className="flex gap-2">
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
              {tokenBalance !== null && tokenBalance > 0n && (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => set('amount', formatTokenAmount(tokenBalance, selectedToken.decimals, selectedToken.decimals))}
                >
                  Max
                </Button>
              )}
            </div>
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
            {walletAddress && form.recipient.trim() === walletAddress && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-600 dark:text-amber-400">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <span>This is your own address. Self-streams are allowed but may have been unintended.</span>
              </div>
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

          {/* Duration presets */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Quick duration</Label>
            <div className="flex flex-wrap gap-2">
              {DURATION_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => set('endDate', addDuration(form.startDate, preset.seconds))}
                  className="rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                >
                  {preset.label}
                </button>
              ))}
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
            <div className="space-y-4 pt-1">
            {/* Cliff presets */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Quick cliff</Label>
              <div className="flex flex-wrap gap-2">
                {CLIFF_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => {
                      if (preset.seconds === 0) {
                        set('hasCliff', false)
                      } else {
                        set('cliffDate', addDuration(form.startDate, preset.seconds))
                      }
                    }}
                    className="rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
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

        {/* Fee estimate */}
        {feeEstimate && (
          <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 p-3 text-sm text-muted-foreground">
            <Info className="size-4 shrink-0" />
            Estimated transaction fee: ~{feeEstimate} XLM (includes 15% buffer)
          </div>
        )}

        {/* Submit */}
        <div className="flex items-center justify-end gap-3">
          <Button type="button" variant="ghost" asChild>
            <Link href="/app">Cancel</Link>
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={pending || estimatingFee}
            onClick={handleEstimateFee}
            className="gap-1.5"
          >
            {estimatingFee && <Loader2 className="size-4 animate-spin" />}
            {estimatingFee ? 'Estimating…' : 'Estimate fee'}
          </Button>
          <Button type="submit" disabled={pending} className="gap-1.5">
            {pending ? 'Creating…' : 'Create stream'}
            {!pending && <ArrowRight className="size-4" />}
          </Button>
        </div>
      </form>

      {/* Live preview sidebar */}
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <StreamPreview
          amount={form.amount}
          token={selectedToken}
          startDate={form.startDate}
          endDate={form.endDate}
          hasCliff={form.hasCliff}
          cliffDate={form.cliffDate}
          cliffAmount={form.cliffAmount}
        />
      </aside>
      </div>

      {/* Issue #30: confirmation dialog */}
      {input && (
        <CreateConfirmation
          open={showConfirmation}
          onConfirm={handleConfirmedCreate}
          onCancel={() => setShowConfirmation(false)}
          pending={pending}
          feeEstimate={feeEstimate}
          recipient={input.recipient}
          token={input.token}
          totalAmount={input.totalAmount}
          startTime={input.startTime}
          endTime={input.endTime}
          cliffTime={input.cliffTime}
          cliffAmount={input.cliffAmount}
          amountPerSecond={amountPerSecond}
        />
      )}
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
