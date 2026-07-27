/**
 * Formats a timestamp as a relative "time ago" string.
 *
 * @param timestamp The timestamp in milliseconds (typically from Date.now() or event.timestamp)
 * @returns A human-readable relative time string (e.g., "5m ago", "2h ago")
 *
 * @example
 * formatTimeAgo(Date.now() - 120000) // Returns "2m ago"
 * formatTimeAgo(Date.now() - 3600000) // Returns "1h ago"
 */
export function formatTimeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp
  if (diff < 60_000) return 'just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)}d ago`
  return new Date(timestamp).toLocaleDateString()
}
