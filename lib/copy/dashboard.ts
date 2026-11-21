// Centralized UI copy for the dashboard page (app/app/page.tsx, app/app/dashboard.tsx).
// First step toward i18n-readiness — extracted so this component's strings
// live in one place instead of scattered through JSX (issue #791).

export const dashboardCopy = {
  metadata: {
    title: "Your Streams",
    description: "View and manage your active and historical token streams on FlowStar.",
  },
  header: {
    title: "Dashboard",
    description: "Your active and historical token streams.",
    refreshing: "Refreshing…",
    refreshingAriaLabel: "Refreshing stream data",
    withdrawAll: (count: number) => `Withdraw all (${count})`,
    withdrawingAll: (current: number, total: number) => `Withdrawing ${current}/${total}…`,
    newStream: "New stream",
  },
  offlineBanner: {
    message: "You're offline — showing cached stream data",
    fromTime: (timeStr: string) => ` from ${timeStr}`,
    outdatedWarning: ". It may be outdated.",
  },
  tabs: {
    all: (count: number) => `All (${count})`,
    receiving: (count: number) => `Receiving (${count})`,
    sending: (count: number) => `Sending (${count})`,
  },
  // Issue #1145: surfaces recurring-stream rules (saved via the "Recurring
  // cadence" option on the create form) that are due to renew soon, with a
  // way to act on them immediately instead of waiting for the schedule.
  upcomingRenewals: {
    title: "Upcoming renewals",
    description: "Recurring streams scheduled to run again soon.",
    nextRun: (dateStr: string) => `Next renewal ${dateStr}`,
    createNow: "Create now",
    removeAriaLabel: "Remove this renewal reminder",
  },
}
