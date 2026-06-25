import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Analytics',
  description: 'Explore aggregate FlowStar stream metrics and traction signals.',
}

export default function AnalyticsLayout({ children }: { children: React.ReactNode }) {
  return children
}
