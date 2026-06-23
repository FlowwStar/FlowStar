'use client'

import React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

type Props = { error: Error; reset: () => void }

function parseError(e: unknown) {
  const defaultResult = {
    title: 'Something went wrong',
    message: 'An unexpected error occurred. Please try again or contact support.'
  }

  if (!e) return defaultResult

  const message = e instanceof Error ? e.message : String(e)
  const lower = message.toLowerCase()

  // RPC unreachable heuristics
  if (
    lower.includes('failed to fetch') ||
    lower.includes('networkerror') ||
    lower.includes('ec ónn') ||
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
        'The app could not reach the Stellar testnet RPC server. This is usually temporary — please try again in a few moments.'
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
        'It looks like you (or your wallet) rejected the transaction. If this was accidental, try sending again.'
    }
  }

  // Try to extract structured contract error information
  try {
    // Some errors come as JSON in the message
    const trimmed = message.trim()
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const parsed: any = JSON.parse(trimmed)
      if (parsed) {
        const code = parsed.code ?? parsed.error_code ?? parsed.err ?? parsed.error?.code
        const detail = parsed.message ?? parsed.error ?? parsed.reason ?? parsed.detail ?? parsed.error?.message
        if (code || detail) {
          return {
            title: code ? `Contract error: ${String(code)}` : 'Contract error',
            message: detail ? String(detail) : message
          }
        }
      }
    }
  } catch (err) {
    // ignore JSON parse failures
  }

  // Try to pull out an error code with a regex like "code: XYZ" or "error_code=XYZ"
  const codeMatch = message.match(/(?:error[_ ]?code|code)[:=]\s*([A-Za-z0-9_-]+)/i)
  if (codeMatch) {
    return {
      title: `Contract error: ${codeMatch[1]}`,
      message
    }
  }

  // Fallback: show the original message
  return {
    title: 'Error',
    message
  }
}

export default function AppError({ error, reset }: Props) {
  const router = useRouter()
  const { title, message } = parseError(error)

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      background: 'linear-gradient(180deg,#0f172a, #071030)'
    }}>
      <div style={{
        maxWidth: 760,
        width: '100%',
        background: 'white',
        borderRadius: 12,
        padding: 24,
        boxShadow: '0 8px 30px rgba(2,6,23,0.6)'
      }}>
        <h1 style={{ margin: 0, fontSize: 22 }}>{title}</h1>
        <p style={{ color: '#334155' }}>{message}</p>

        <div style={{ display: 'flex', gap: 12, marginTop: 18 }}>
          <button
            onClick={() => reset()}
            style={{
              padding: '8px 14px',
              background: '#0ea5a2',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer'
            }}
          >
            Try again
          </button>

          <button
            onClick={() => router.refresh()}
            style={{
              padding: '8px 14px',
              background: '#e2e8f0',
              color: '#0f172a',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer'
            }}
          >
            Refresh
          </button>

          <Link href="/" style={{
            display: 'inline-flex',
            alignItems: 'center',
            textDecoration: 'none',
            padding: '8px 14px',
            borderRadius: 8,
            background: '#f8fafc',
            color: '#0f172a'
          }}>
            Go home
          </Link>
        </div>

        <details style={{ marginTop: 18 }}>
          <summary style={{ cursor: 'pointer' }}>Show technical details</summary>
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginTop: 8 }}>{String(error?.stack ?? error)}</pre>
        </details>
      </div>
    </div>
  )
}
