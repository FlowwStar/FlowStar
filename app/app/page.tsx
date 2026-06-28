import { Metadata } from 'next'
import { RequireWallet } from '@/components/layout/require-wallet'
import { Dashboard } from './dashboard'

export const metadata: Metadata = {
  title: 'Your Streams',
  description: 'View and manage your active and historical token streams on FlowStar.',
}

export default function DashboardPage() {
  return (
    <RequireWallet>
      <Dashboard />
    </RequireWallet>
  )
}
