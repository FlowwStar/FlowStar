'use client'

import React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

type Props = { error: Error; reset: () => void }

/**
 * Read the first defined string value among a candidate list of keys
 * on an already-narrowed object. Used to safely traverse unknown-shaped
 * RPC error payloads without resorting to `any`.
 */
function readField(obj: object, keys: string[]): unknown {
  for (const key of keys) {
    const value = (obj as Record<string, unknown>)[key]
    if (value !== undefined && value !== null) return value
 * Safely extracts a string or number value from an unknown object by key.
 * Returns undefined if the value doesn't exist or isn't a string/number.
 */
function getStringOrNumber(obj: unknown, key: string): string | number | undefined {
  if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
    const val = (obj as Record<string, unknown>)[key]
    if (typeof val === 'string' || typeof val === 'number') return val
  }
  return undefined
}

function parseError(e: unknown) {
  const defaultResult = {
    title: 'Something went wrong',
    message: 'An unexpected error occurred. Please try again or contact support.',
  }

  if (!e) return defaultResult

  const message = e instanceof Error ? e.message : String(e)
  const lower = message.toLowerCase()

  // RPC unreachable heuristics
  if (
    lower.includes('failed to fetch') ||
    lower.includes('networkerror') ||
    lower.includes('econnrefused') ||
    lower.includes('econnreset') ||
    lower.includes('timeout') ||
    lower.includes('503') ||
    lower.includes('502') ||
    lower.includes('504') ||
    (lower.includes('rpc') && lower.includes('unavailable')) ||
    lower.includes('no available')
  ) {
    return {
      title: 'Stellar testnet RPC is temporarily unavailable',
      message:
        'The app could not reach the Stellar testnet RPC server. This is usually temporary — please try again in a few moments.',
    }
  }

  // Wallet / user rejection heuristics
  if (
    lower.includes('user rejected') ||
    lower.includes('user denied') ||
    lower.includes('request rejected') ||
    lower.includes('rejected by user') ||
    (lower.includes('signature') && lower.includes('rejected')) ||
    (lower.includes('wallet') && lower.includes('rejected'))
  ) {
    return {
      title: 'Transaction was rejected in your wallet',
      message:
        'It looks like you (or your wallet) rejected the transaction. If this was accidental, try sending again.',
    }
  }

  // Try to extract structured contract error information
  try {
    // Some errors come as JSON in the message
    const trimmed = message.trim()
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      const parsed: unknown = JSON.parse(trimmed)
      if (parsed && typeof parsed === 'object') {
        const code = readField(parsed, ['code', 'error_code', 'err'])
        const detail = readField(parsed, [
          'message',
          'error',
          'reason',
          'detail',
        ])
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const obj = parsed as Record<string, unknown>
        const code =
          getStringOrNumber(obj, 'code') ??
          getStringOrNumber(obj, 'error_code') ??
          getStringOrNumber(obj, 'err') ??
          getStringOrNumber(obj.error, 'code')

        const detail =
          getStringOrNumber(obj, 'message') ??
          getStringOrNumber(obj.error, 'message') ??
          getStringOrNumber(obj, 'reason') ??
          getStringOrNumber(obj, 'detail')

        if (code || detail) {
          return {
            title: code ? `Contract error: ${String(code)}` : 'Contract error',
            message: detail ? String(detail) : message,
          }
        }
      }
    }
  } catch {
    // ignore JSON parse failures
  }

  // Try to pull out an error code with a regex like "code: XYZ" or "error_code=XYZ"
  const codeMatch = message.match(/(?:error[_ ]?code|code)[:=]\s*([A-Za-z0-9_-]+)/i)
  if (codeMatch) {
    return {
      title: `Contract error: ${codeMatch[1]}`,
      message,
    }
  }

  // Fallback: show the original message
  return {
    title: 'Error',
    message,
  }
}

export default function AppError({ error, reset }: Props) {
  const router = useRouter()
  const { title, message } = parseError(error)

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-900 via-[#071030] to-slate-900 p-6">
      <Card className="w-full max-w-[760px] shadow-xl">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{message}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => reset()}>
              Try again
            </Button>
            <Button variant="secondary" onClick={() => router.refresh()}>
              Refresh
            </Button>
            <Button variant="outline" asChild>
              <Link href="/">Go home</Link>
            </Button>
          </div>

          <details className="group">
            <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground transition-colors">
              Show technical details
            </summary>
            <pre className="mt-2 whitespace-pre-wrap break-all rounded-lg bg-muted p-4 text-xs text-muted-foreground">
              {String(error?.stack ?? error)}
            </pre>
          </details>
        </CardContent>
      </Card>
    </div>
  )
}
