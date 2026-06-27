'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AlertTriangle, ArrowLeft, ArrowRight, Info, Loader2, Copy, Clock } from 'lucide-react'
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
import { getAllTokens, saveCustomToken } from '@/lib/stellar'
import { getTokenMetadata, getTokenBalance } from '@/lib/contract'
import { parseTokenAmount, formatTokenAmount } from '@/lib/stream-utils'
import { StreamPreview } from '@/components/streams/stream-preview'
import { CreateConfirmation } from '@/components/streams/create-confirmation'
import { TxPreviewDialog } from '@/components/ui/tx-preview-dialog'
import { addAddressBookEntry, getAddressBookEntries, touchAddressBookEntry } from '@/lib/address-book'
import { buildNextRunAt, saveRecurringRule, type RecurrenceCadence } from '@/lib/recurring'
import { useFormDraft, clearExpiredDrafts } from '@/hooks/use-form-draft'
import { StreamTemplates, type StreamTemplate } from '@/components/streams/stream-templates'
import type { TokenInfo } from '@/types/stream'

const CUSTOM_VALUE = '__custom__'

function toUnixSeconds(localDatetimeValue: string): bigint {
  return BigInt(Math.floor(new Date(localDatetimeValue).getTime() / 1000))
}

function localDatetimeMin(offsetSeconds = 0): string {
  const d = new Date(Date.now() + offsetSeconds * 1000)
  // Format as YYYY-MM-DDTHH:mm in local time (not UTC)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function addDuration(baseDatetime: string, seconds: number): string {
  const base = new Date(baseDatetime)
  const d = new Date(base.getTime() + seconds * 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    return 'UTC'
  }
}

function getTimezoneOffset(): string {
  const offset = -new Date().getTimezoneOffset()
  const sign = offset >= 0 ? '+' : '-'
  const h = Math.floor(Math.abs(offset) / 60)
  const m = Math.abs(offset) % 60
  return `UTC${sign}${h}${m > 0 ? `:${String(m).padStart(2, '0')}` : ''}`
}

const COMMON_TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Sao_Paulo',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
] as const

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
  const [showTxPreview, setShowTxPreview] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)

  const [tokens, setTokens] = useState<TokenInfo[]>(() => getAllTokens(network).map((t) => ({ ...t })))
  const [isCustom, setIsCustom] = useState(false)
  const [customAddress, setCustomAddress] = useState('')
  const [customLoading, setCustomLoading] = useState(false)
  const [customError, setCustomError] = useState<string | null>(null)
  const [customToken, setCustomToken] = useState<TokenInfo | null>(null)
  const [addressBookEntries, setAddressBookEntries] = useState(() => getAddressBookEntries())
  const [recurrenceCadence, setRecurrenceCadence] = useState<RecurrenceCadence>('none')

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
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | undefined>(undefined)

  // Issue #168: draft state
  const [showDraftBanner, setShowDraftBanner] = useState(false)
  const [draftSavedAt, setDraftSavedAt] = useState<number | null>(null)
  const isFirstMount = useRef(true)

  // Issue #170: timezone state
  const [selectedTimezone, setSelectedTimezone] = useState(() => detectTimezone())
  const timezoneOffset = getTimezoneOffset()

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

  // Issue #168: wire up draft hook
  const { loadDraft, restore, discard } = useFormDraft(
    `create-stream-${walletAddress ?? 'anonymous'}`,
    form,
    (draft) => {
      setForm(draft)
    },
    true,
  )

  // Check for existing draft on first mount
  useEffect(() => {
    if (!isFirstMount.current) return
    isFirstMount.current = false
    clearExpiredDrafts()
    const entry = loadDraft()
    if (entry) {
      setDraftSavedAt(entry.savedAt)
      setShowDraftBanner(true)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
    // Show tx simulation preview first; user proceeds to Freighter from there.
    setShowTxPreview(true)
  }

  async function handleConfirmedCreate() {
    try {
      const input = buildInput()
      const id = await createStream(input)
      touchAddressBookEntry(input.recipient, input.recipient)
      setAddressBookEntries(getAddressBookEntries())

      if (recurrenceCadence !== 'none') {
        saveRecurringRule({
          cadence: recurrenceCadence,
          nextRunAt: buildNextRunAt(Date.now(), recurrenceCadence),
          lastCreatedAt: Date.now(),
          streamId: id,
          recipient: input.recipient,
          tokenSymbol: input.token.symbol,
          amount: input.totalAmount.toString(),
        })
      }

      discard()
      setShowConfirmation(false)
      toast.success('Stream created', { description: `Stream #${id} is live.` })
      router.push(`/app/stream/${id}`)
    } catch {
      // error is exposed via useContract
    }
  }

  function handleTemplateSelect(template: StreamTemplate) {
    setSelectedTemplateId(template.id)
    const newStart = localDatetimeMin(60)
    const newEnd = addDuration(newStart, template.durationSeconds)
    const hasCliff = template.cliffSeconds > 0
    const newCliff = hasCliff ? addDuration(newStart, template.cliffSeconds) : newStart

    setForm((prev) => {
      const amount = prev.amount
      const cliffAmount = hasCliff && template.cliffPercent > 0 && amount
        ? String(Math.floor(Number(amount) * template.cliffPercent / 100))
        : ''
      return {
        ...prev,
        startDate: newStart,
        endDate: newEnd,
        hasCliff,
        cliffDate: newCliff,
        cliffAmount,
      }
    })
    setErrors({})
  }

  const input = (showTxPreview || showConfirmation) ? buildInput() : null
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

      <div className="mt-8 rounded-2xl border border-border bg-card p-5">
        <StreamTemplates onSelect={handleTemplateSelect} selectedId={selectedTemplateId} />
      </div>
      {cloneId && (
        <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3">
          <Copy className="size-4 shrink-0 text-primary" />
          <p className="text-sm text-primary">
            Duplicating Stream #{cloneId} — form pre-filled with its parameters.
          </p>
        </div>
      )}

      {/* Issue #168: Draft restore banner */}
      {showDraftBanner && (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <Clock className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <p className="text-sm text-amber-700 dark:text-amber-300">
              You have an unsaved draft from{' '}
              {draftSavedAt
                ? new Date(draftSavedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : 'earlier'}
              .
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                restore()
                setShowDraftBanner(false)
                toast.success('Draft restored')
              }}
            >
              Restore
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                discard()
                setShowDraftBanner(false)
              }}
            >
              Discard
            </Button>
          </div>
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
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  const trimmed = form.recipient.trim()
                  if (!trimmed || !StrKey.isValidEd25519PublicKey(trimmed)) return
                  addAddressBookEntry({ label: 'Saved recipient', address: trimmed })
                  setAddressBookEntries(getAddressBookEntries())
                  toast.success('Recipient saved')
                }}
                disabled={!form.recipient.trim() || !StrKey.isValidEd25519PublicKey(form.recipient.trim())}
              >
                Save recipient
              </Button>
            </div>
            {addressBookEntries.length > 0 && (
              <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
                <p className="text-xs font-medium text-muted-foreground">Recent recipients</p>
                <div className="flex flex-wrap gap-2">
                  {addressBookEntries.slice(0, 6).map((entry) => (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={() => set('recipient', entry.address)}
                      className="rounded-full border border-border bg-background px-3 py-1 text-left text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                    >
                      <span className="font-medium text-foreground">{entry.label}</span> • {entry.address.slice(0, 8)}…
                    </button>
                  ))}
                </div>
              </div>
            )}
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

          {/* Issue #170: timezone selector */}
          <div className="space-y-1.5">
            <Label htmlFor="timezone" className="text-xs text-muted-foreground">
              Timezone — dates below are interpreted in this timezone ({timezoneOffset})
            </Label>
            <Select value={selectedTimezone} onValueChange={setSelectedTimezone}>
              <SelectTrigger id="timezone" className="w-full text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COMMON_TIMEZONES.map((tz) => (
                  <SelectItem key={tz} value={tz} className="text-xs">
                    {tz}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="startDate">
                Start date{' '}
                <span className="font-normal text-muted-foreground text-xs">({timezoneOffset})</span>
              </Label>
              <Input
                id="startDate"
                type="datetime-local"
                value={form.startDate}
                min={localDatetimeMin()}
                onChange={(e) => set('startDate', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="endDate">
                End date{' '}
                <span className="font-normal text-muted-foreground text-xs">({timezoneOffset})</span>
              </Label>
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

          <div className="space-y-1.5 rounded-lg border border-border bg-muted/30 p-3">
            <Label htmlFor="recurrence">Recurring cadence</Label>
            <Select value={recurrenceCadence} onValueChange={(value) => setRecurrenceCadence(value as RecurrenceCadence)}>
              <SelectTrigger id="recurrence" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Do not repeat</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="quarterly">Quarterly</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Save a renewal rule for this recipient so the schedule can be recreated later.
            </p>
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
                <Label htmlFor="cliffDate">
                  Cliff date{' '}
                  <span className="font-normal text-muted-foreground text-xs">({timezoneOffset})</span>
                </Label>
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

        {network === 'mainnet' && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-600 dark:text-amber-400">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>Mainnet uses real funds. Double-check the recipient, amount, and token before creating a stream.</span>
          </div>
        )}

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

      {/* Step 1: dry-run simulation preview */}
      {input && (
        <TxPreviewDialog
          open={showTxPreview}
          input={input}
          network={network}
          sender={walletAddress ?? ''}
          operationLabel="Create Stream"
          onConfirm={() => { setShowTxPreview(false); setShowConfirmation(true) }}
          onCancel={() => setShowTxPreview(false)}
          pending={false}
        />
      )}

      {/* Step 2: confirmation + fee details → Freighter signing */}
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
