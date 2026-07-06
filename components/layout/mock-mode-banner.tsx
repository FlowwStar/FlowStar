'use client'

import { FlaskConical } from 'lucide-react'
import { useNetwork } from '@/components/providers/network-provider'

/**
 * Dev-only indicator shown when the app runs against the in-memory mock store
 * (i.e. NEXT_PUBLIC_STREAM_CONTRACT_ID_{NETWORK} is unset). Hidden in production builds so
 * it never leaks into a real deployment.
 */
export function MockModeBanner() {
  const { isMockMode } = useNetwork()
  if (process.env.NODE_ENV === 'production' || !isMockMode) return null

  return (
    <div
      role="status"
      title="No contract configured — set NEXT_PUBLIC_STREAM_CONTRACT_ID_{NETWORK} in .env.local to use the live contract."
      className="fixed bottom-4 left-4 z-50 flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-400 backdrop-blur-md"
    >
      <FlaskConical className="size-3.5" />
      Mock mode — no contract connected
    </div>
  )
}
