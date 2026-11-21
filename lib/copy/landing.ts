// Centralized UI copy for the landing page (components/landing/*).
// First step toward i18n-readiness — extracted so these components' strings
// live in one place instead of scattered through JSX (issues #950, #951).

// Landing hero and header strings — issue #951
export const landingHeaderCopy = {
  navLinks: {
    features: 'Features',
    how: 'How it works',
    useCases: 'Use cases',
  },
  openMenuAriaLabel: 'Open navigation menu',
  mobileMenuHeading: 'Navigate',
  openAppButton: 'Open app',
}

export const landingHeroCopy = {
  badge: 'Built on Stellar & Soroban',
  title: 'Stream money by the second',
  description:
    'FlowStar turns one-time transfers into continuous streams. Perfect for payroll, token vesting, and grants that unlock in real time — withdraw anytime, cancel anytime.',
  createStreamButton: 'Create a stream',
  openDashboardButton: 'Open dashboard',
  tagline: 'No code · Non-custodial · Testnet ready',
}

// Landing sections strings — issue #950
export const landingSectionsCopy = {
  features: {
    eyebrow: 'Why FlowStar',
    title: 'Programmable money that moves continuously',
    items: {
      perSecond: {
        title: 'Per-second unlocking',
        body: 'Funds unlock continuously down to the second. Recipients see their balance grow in real time, no waiting for payout dates.',
      },
      nonCustodial: {
        title: 'Non-custodial',
        body: 'Streams live in a Soroban smart contract. FlowStar never holds your keys or your tokens — you sign every action from your wallet.',
      },
      cliffs: {
        title: 'Cliffs & schedules',
        body: 'Add a cliff before unlocking starts, set start and end times, and let the contract handle the math precisely.',
      },
      withdraw: {
        title: 'Withdraw anytime',
        body: 'Recipients withdraw unlocked funds whenever they want. Senders can cancel and reclaim whatever has not unlocked yet.',
      },
    },
  },
  howItWorks: {
    eyebrow: 'How it works',
    title: 'Three steps from transfer to stream',
    steps: {
      connect: {
        step: '01',
        title: 'Connect your wallet',
        body: 'Sign in with Freighter, xBull, LOBSTR, or Albedo. FlowStar reads your address — nothing more.',
      },
      create: {
        step: '02',
        title: 'Create a stream',
        body: 'Pick a token, recipient, amount, and schedule. Fund it in a single transaction.',
      },
      watch: {
        step: '03',
        title: 'Watch it flow',
        body: 'The recipient withdraws unlocked funds anytime. Cancel to reclaim the rest whenever you need.',
      },
    },
  },
  useCases: {
    eyebrow: 'Use cases',
    title: 'One primitive, many payment flows',
    items: {
      payroll: {
        title: 'Payroll',
        body: 'Pay contributors a salary that streams every second instead of monthly lump sums.',
      },
      vesting: {
        title: 'Token vesting',
        body: 'Vest team and investor allocations on-chain with cliffs and linear schedules.',
      },
      grants: {
        title: 'Grants',
        body: 'Fund builders progressively and keep the ability to stop if milestones slip.',
      },
      subscriptions: {
        title: 'Subscriptions',
        body: 'Bill continuously for services with streams that anyone can verify on-chain.',
      },
    },
  },
  cta: {
    title: 'Start streaming in minutes',
    description:
      'Connect a wallet and create your first stream on Stellar testnet. No setup, no custody, no code.',
    createStreamButton: 'Create a stream',
  },
  footer: {
    tagline: (appName: string) =>
      `${appName} streams tokens on Stellar. Demo frontend — connect your Soroban contracts to go live.`,
  },
}
