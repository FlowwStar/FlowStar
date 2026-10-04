import Link from 'next/link'
import {
  Gauge,
  ShieldCheck,
  Hourglass,
  Wallet,
  CalendarClock,
  Briefcase,
  Coins,
  Gift,
  ArrowRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Brand, APP_NAME } from '@/components/brand'

const FEATURES = [
  {
    icon: Gauge,
    title: 'Per-second unlocking',
    body: 'Funds unlock continuously down to the second. Recipients see their balance grow in real time, no waiting for payout dates.',
  },
  {
    icon: ShieldCheck,
    title: 'Non-custodial',
    body: 'Streams live in a Soroban smart contract. FlowStar never holds your keys or your tokens — you sign every action from your wallet.',
  },
  {
    icon: Hourglass,
    title: 'Cliffs & schedules',
    body: 'Add a cliff before unlocking starts, set start and end times, and let the contract handle the math precisely.',
  },
  {
    icon: Wallet,
    title: 'Withdraw anytime',
    body: 'Recipients withdraw unlocked funds whenever they want. Senders can cancel and reclaim whatever has not unlocked yet.',
  },
]

const USE_CASES = [
  {
    icon: Briefcase,
    title: 'Payroll',
    body: 'Pay contributors a salary that streams every second instead of monthly lump sums.',
  },
  {
    icon: CalendarClock,
    title: 'Token vesting',
    body: 'Vest team and investor allocations on-chain with cliffs and linear schedules.',
  },
  {
    icon: Gift,
    title: 'Grants',
    body: 'Fund builders progressively and keep the ability to stop if milestones slip.',
  },
  {
    icon: Coins,
    title: 'Subscriptions',
    body: 'Bill continuously for services with streams that anyone can verify on-chain.',
  },
]

const STEPS = [
  {
    step: '01',
    title: 'Connect your wallet',
    body: 'Sign in with Freighter, xBull, LOBSTR, or Albedo. FlowStar reads your address — nothing more.',
  },
  {
    step: '02',
    title: 'Create a stream',
    body: 'Pick a token, recipient, amount, and schedule. Fund it in a single transaction.',
  },
  {
    step: '03',
    title: 'Watch it flow',
    body: 'The recipient withdraws unlocked funds anytime. Cancel to reclaim the rest whenever you need.',
  },
]

export function Features() {
  return (
    <section id="features" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <div className="max-w-2xl">
        <p className="text-sm font-medium text-primary">Why FlowStar</p>
        <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
          Programmable money that moves continuously
        </h2>
      </div>
      <div className="mt-12 grid gap-4 sm:grid-cols-2">
        {FEATURES.map((f) => (
          <div
            key={f.title}
            className="rounded-2xl border border-border bg-card p-6 transition-colors hover:border-primary/40"
          >
            <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <f.icon className="size-5" />
            </span>
            <h3 className="mt-4 text-lg font-medium">{f.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground text-pretty">
              {f.body}
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}

export function HowItWorks() {
  return (
    <section id="how" className="border-y border-border bg-card/30">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="max-w-2xl">
          <p className="text-sm font-medium text-primary">How it works</p>
          <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
            Three steps from transfer to stream
          </h2>
        </div>
        <div className="mt-12 grid gap-8 md:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.step}>
              <span className="font-mono text-sm text-primary">{s.step}</span>
              <div className="mt-3 h-px w-full bg-border" />
              <h3 className="mt-4 text-lg font-medium">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground text-pretty">
                {s.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export function UseCases() {
  return (
    <section id="use-cases" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <div className="max-w-2xl">
        <p className="text-sm font-medium text-primary">Use cases</p>
        <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
          One primitive, many payment flows
        </h2>
      </div>
      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {USE_CASES.map((u) => (
          <div key={u.title} className="rounded-2xl border border-border bg-card p-6">
            <span className="flex size-10 items-center justify-center rounded-lg bg-secondary text-primary">
              <u.icon className="size-5" />
            </span>
            <h3 className="mt-4 font-medium">{u.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground text-pretty">
              {u.body}
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}

export function CTA() {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
      <div className="relative overflow-hidden rounded-3xl border border-border bg-card px-6 py-16 text-center sm:py-20">
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-24 left-1/2 size-[420px] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl"
        />
        <h2 className="relative text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
          Start streaming in minutes
        </h2>
        <p className="relative mx-auto mt-4 max-w-md text-pretty text-muted-foreground">
          Connect a wallet and create your first stream on Stellar testnet. No setup, no custody, no
          code.
        </p>
        <div className="relative mt-8 flex justify-center">
          <Button asChild size="lg">
            <Link href="/app/create">
              Create a stream
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  )
}

export function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row sm:px-6">
        <Brand />
        <p className="text-xs text-muted-foreground">
          {APP_NAME} streams tokens on Stellar. Demo frontend — connect your Soroban contracts to go
          live.
        </p>
      </div>
    </footer>
  )
}
