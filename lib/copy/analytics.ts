// Centralized UI copy for the analytics page (app/app/analytics/page.tsx).
// Extracted so this page's strings live in one place instead of scattered through JSX (issue #795).

export const analyticsCopy = {
  backToDashboard: "Back to dashboard",
  heading: "Platform analytics",
  subheading: "Public signals that highlight traction, usage, and stream growth.",

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
};
