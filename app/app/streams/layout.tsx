import type { ReactNode } from 'react'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Streams',
  description: 'Browse and search all token streams you have sent or received on Stellar.',
}

export default function StreamsLayout({ children }: { children: ReactNode }) {
  return children
}
