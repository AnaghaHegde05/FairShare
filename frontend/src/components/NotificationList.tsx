import type { NotificationEntry } from "../types";
import { timeAgo } from "../lib/time";

interface NotificationListProps {
  notifications: NotificationEntry[];
  onMarkRead: (id: string) => void;
  /** Compact spacing/typography for the header dropdown vs the full page. */
  compact?: boolean;
}

// Single source of truth for rendering a list of notifications — used by
// both the header dropdown (NotificationBell) and the full /notifications
// page, so read/unread styling and click behavior only exist in one place.
export default function NotificationList({ notifications, onMarkRead, compact }: NotificationListProps) {
  if (notifications.length === 0) {
    return (
      <div className={compact ? "px-4 py-6 text-center" : "rounded-card border border-dashed border-line bg-card/50 p-10 text-center"}>
        <p className="text-sm text-muted">No notifications yet.</p>
      </div>
    );
  }

  return (
    <ul className={compact ? "divide-y divide-line" : "space-y-2"}>
      {notifications.map((n) => {
        const isUnread = !n.readAt;
        return (
          <li key={n.id}>
            <button
              type="button"
              onClick={() => isUnread && onMarkRead(n.id)}
              className={`w-full text-left flex items-start gap-2.5 transition-colors ${
                compact
                  ? "px-4 py-3 hover:bg-paper"
                  : "rounded-card border border-line bg-card px-4 py-3 hover:bg-paper"
              }`}
            >
              <span
                className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                  isUnread ? "bg-pine" : "bg-line"
                }`}
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1">
                <span className={`block text-sm ${isUnread ? "font-semibold text-ink" : "text-muted"}`}>
                  {n.message}
                </span>
                <span className="block text-xs text-muted mt-0.5">{timeAgo(n.createdAt)}</span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
