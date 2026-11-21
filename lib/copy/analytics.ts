// Centralized UI copy for the analytics page (app/app/analytics/page.tsx).
// Extracted so this page's strings live in one place instead of scattered through JSX (issue #795).

export const analyticsCopy = {
  backToDashboard: "Back to dashboard",
  heading: "Platform analytics",
  subheading: "Public signals that highlight traction, usage, and stream growth.",

  rangeSelectLabel: "Time range",

  rangeOptions: {
    sevenDays: "7 days",
    thirtyDays: "30 days",
    ninetyDays: "90 days",
    allTime: "All time",
  },

  statCards: {
    totalVolume: {
      title: "Total volume streamed",
      footnote: "Across the visible stream history",
    },
    activeStreams: {
      title: "Active streams",
      footnote: "Currently streaming now",
    },
    totalStreams: {
      title: "Total streams created",
      footnote: "All-time stream count",
    },
    averageDuration: {
      title: "Average duration",
      footnote: "Average stream length",
    },
  },

  sections: {
    chartsErrorBoundaryName: "Analytics charts",
    networkContextTitle: "Network context",
    networkContextDescription: "Current public view and available tokens.",
    networkContextNotice:
      "This dashboard is built from the current app data and will be backed by on-chain aggregation once a public index is available.",
  },

  // Copy for AnalyticsCharts (components/analytics/charts.tsx).
  charts: {
    statusLabels: {
      streaming: "Streaming",
      scheduled: "Scheduled",
      completed: "Completed",
      cancelled: "Cancelled",
    },
    volume: {
      title: "Streaming volume over time",
      description: "Total tokens deposited into streams created per day, for the selected window.",
      empty: "No stream activity yet for this period.",
      tooltip: (value: string) => `Volume: ${value}`,
    },
    tokenDistribution: {
      title: "Token distribution",
      description: "Streams grouped by token across the current dataset.",
      empty: "No token distribution data available yet.",
    },
    statusBreakdown: {
      title: "Stream status breakdown",
      description: "Active, scheduled, completed, and cancelled streams.",
      empty: "No streams to break down yet.",
      seriesName: "Streams",
    },
    topRecipients: {
      title: "Top recipients",
      description: "Addresses receiving the most streams in this window.",
      empty: "No recipients yet.",
      streamCount: (count: number) => `${count} stream${count === 1 ? "" : "s"}`,
    },
    topTokens: {
      title: "Top tokens by volume",
      description: "Most-used tokens across created streams.",
      empty: "No volume data yet.",
      streamCount: (count: number) => `${count} streams`,
    },
    unlockProgress: {
      title: "Unlock progress",
      description: "Total unlocked vs. locked across all streams in this window.",
      empty: "No deposits to track yet.",
      unlocked: "Unlocked",
    },
  },
};
