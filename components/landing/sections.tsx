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
import { landingSectionsCopy } from '@/lib/copy/landing'

const { features, howItWorks, useCases, cta, footer } = landingSectionsCopy

const FEATURES = [
  { icon: Gauge, ...features.items.perSecond },
  { icon: ShieldCheck, ...features.items.nonCustodial },
  { icon: Hourglass, ...features.items.cliffs },
  { icon: Wallet, ...features.items.withdraw },
]

const USE_CASES = [
  { icon: Briefcase, ...useCases.items.payroll },
  { icon: CalendarClock, ...useCases.items.vesting },
  { icon: Gift, ...useCases.items.grants },
  { icon: Coins, ...useCases.items.subscriptions },
]

const STEPS = [howItWorks.steps.connect, howItWorks.steps.create, howItWorks.steps.watch]

export function Features() {
  return (
    <section id="features" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <div className="max-w-2xl">
        <p className="text-sm font-medium text-primary">{features.eyebrow}</p>
        <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
          {features.title}
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
          <p className="text-sm font-medium text-primary">{howItWorks.eyebrow}</p>
          <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
            {howItWorks.title}
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
        <p className="text-sm font-medium text-primary">{useCases.eyebrow}</p>
        <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
          {useCases.title}
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
          {cta.title}
        </h2>
        <p className="relative mx-auto mt-4 max-w-md text-pretty text-muted-foreground">
          {cta.description}
        </p>
        <div className="relative mt-8 flex justify-center">
          <Button asChild size="lg">
            <Link href="/app/create">
              {cta.createStreamButton}
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
        <p className="text-xs text-muted-foreground">{footer.tagline(APP_NAME)}</p>
      </div>
    </footer>
  )
}
