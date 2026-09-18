// Small "X ago" formatter for chore log timestamps. Not using a date
// library since this is the only place the app needs relative time.
export function timeAgo(isoDate: string): string {
  const then = new Date(isoDate).getTime();
  const diffMs = Date.now() - then;
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay === 1) return "yesterday";
  if (diffDay < 7) return `${diffDay}d ago`;
  const diffWeek = Math.floor(diffDay / 7);
  if (diffWeek < 5) return `${diffWeek}w ago`;
  return new Date(isoDate).toLocaleDateString();
}

// Exact completion timestamp for "Mark Done" confirmations and history
// entries, e.g. "21 Aug 2026 · 5:32 PM". Uses the browser's local
// timezone to display the backend's stored UTC instant (the value itself
// always comes from the server; this is display formatting only).
export function formatDateTime(isoDate: string): string {
  const date = new Date(isoDate);
  const datePart = date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const timePart = date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${datePart} · ${timePart}`;
}
