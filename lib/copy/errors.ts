// Centralized UI copy for error boundary components.
// First step toward i18n-readiness — extracted so error UI strings live in
// one place instead of scattered through JSX (issue #959).

export const errorsCopy = {
  pageErrorBoundary: {
    iconAriaLabel: "⚠",
    heading: "Something went wrong",
    fallbackMessage: "An unexpected error occurred on this page.",
    tryAgainButton: "Try again",
    reloadPageButton: "Reload page",
    goToDashboardButton: "Go to dashboard",
    dashboardHref: "/app",
    technicalDetailsSummary: "Technical details",
    copyErrorDetailsButton: "Copy error details",
  },
}
