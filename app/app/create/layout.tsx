import type { ReactNode } from 'react'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Create Stream',
  description: 'Set up a new token stream with vesting schedules, cliffs, and continuous unlocking on Stellar.',
}

export default function CreateLayout({ children }: { children: ReactNode }) {
  return children
}
