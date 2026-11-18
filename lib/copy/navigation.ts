// Centralized UI copy for app navigation (components/layout/navbar.tsx).
// First step toward i18n-readiness — extracted so this component's strings
// live in one place instead of scattered through JSX (issue #953).

export const navbarCopy = {
  navLinks: {
// Centralized UI copy for the global navigation bar (components/layout/navbar.tsx).
// First step toward i18n-readiness — extracted so this component's strings
// live in one place instead of scattered through JSX (issue #953).

export const navigationCopy = {
  links: {
    dashboard: 'Dashboard',
    streams: 'Streams',
    analytics: 'Analytics',
    settings: 'Settings',
  },
  offlineTitle: "You're offline — showing cached data",
  offlineLabel: 'Offline',
  newStreamButton: 'New stream',
  newStreamDisabledAriaLabel: 'New stream (unavailable — wallet is on the wrong network)',
  offline: {
    title: "You're offline — showing cached data",
    label: 'Offline',
  },
  newStream: {
    label: 'New stream',
    unavailableAriaLabel: 'New stream (unavailable — wallet is on the wrong network)',
  },
  network: {
    mainnet: 'Mainnet',
    testnet: 'Testnet',
  },
  theme: {
    toggleSrLabel: 'Toggle theme',
    toggle: 'Toggle theme',
    light: 'Light',
    dark: 'Dark',
    system: 'System',
  },
  networkMismatch: {
    prefix: 'Your wallet is on',
    middle: '— please switch to',
    suffix: 'in Freighter settings. Transactions are disabled until you switch.',
    before: 'Your wallet is on ',
    switchTo: ' — please switch to ',
    after: ' in Freighter settings. Transactions are disabled until you switch.',
  },
}
