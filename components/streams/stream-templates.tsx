'use client'

import { Briefcase, Lock, Gift, CreditCard } from 'lucide-react'

export interface StreamTemplate {
  id: string
  name: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  durationSeconds: number
  cliffSeconds: number
  cliffPercent: number
  badge: string
}

export const STREAM_TEMPLATES: StreamTemplate[] = [
  {
    id: 'payroll',
    name: 'Payroll',
    description: 'Monthly salary streaming',
    icon: Briefcase,
    durationSeconds: 30 * 24 * 3600,
    cliffSeconds: 0,
    cliffPercent: 0,
    badge: '1 month',
  },
  {
    id: 'vesting',
    name: 'Token Vesting',
    description: 'Standard vesting schedule',
    icon: Lock,
    durationSeconds: 2 * 365 * 24 * 3600,
    cliffSeconds: 365 * 24 * 3600,
    cliffPercent: 25,
    badge: '2yr / 1yr cliff',
  },
  {
    id: 'grant',
    name: 'Grant / Sponsorship',
    description: 'Milestone-based grant',
    icon: Gift,
    durationSeconds: 90 * 24 * 3600,
    cliffSeconds: 30 * 24 * 3600,
    cliffPercent: 10,
    badge: '3 months',
  },
  {
    id: 'subscription',
    name: 'Subscription',
    description: 'Continuous subscription payment',
    icon: CreditCard,
    durationSeconds: 30 * 24 * 3600,
    cliffSeconds: 0,
    cliffPercent: 0,
    badge: '1 month',
  },
]

interface StreamTemplatesProps {
  onSelect: (template: StreamTemplate) => void
  selectedId?: string
}

export function StreamTemplates({ onSelect, selectedId }: StreamTemplatesProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Quick templates
        </h2>
        <span className="text-xs text-muted-foreground">Select one to pre-fill the form</span>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {STREAM_TEMPLATES.map((tpl) => {
          const Icon = tpl.icon
          const isSelected = selectedId === tpl.id
          return (
            <button
              key={tpl.id}
              type="button"
              onClick={() => onSelect(tpl)}
              className={
                'flex flex-col items-start gap-2 rounded-xl border p-3 text-left transition-all hover:border-primary hover:shadow-sm ' +
                (isSelected
                  ? 'border-primary bg-primary/5 shadow-sm'
                  : 'border-border bg-card')
              }
            >
              <div className={
                'flex size-8 items-center justify-center rounded-lg ' +
                (isSelected ? 'bg-primary/10 text-primary' : 'bg-secondary text-muted-foreground')
              }>
                <Icon className="size-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold leading-tight">{tpl.name}</p>
                <p className="mt-0.5 text-xs text-muted-foreground leading-tight">{tpl.description}</p>
              </div>
              <span className={
                'rounded-full px-2 py-0.5 text-xs font-medium ' +
                (isSelected
                  ? 'bg-primary/10 text-primary'
                  : 'bg-secondary text-muted-foreground')
              }>
                {tpl.badge}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
