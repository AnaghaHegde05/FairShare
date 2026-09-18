import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useNotifications } from "../context/NotificationsContext";
import { BellIcon } from "./icons";
import NotificationList from "./NotificationList";

// Bell + unread badge in the main nav; clicking it opens a dropdown with
// the most recent notifications. Full history lives at /notifications
// (see pages/NotificationsPage.tsx) — the dropdown intentionally only
// shows a handful (see NotificationsContext's DROPDOWN_PAGE_SIZE).
export default function NotificationBell() {
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setIsOpen(false);
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKey);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKey);
    };
  }, [isOpen]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
        aria-expanded={isOpen}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:text-ink hover:bg-ink/5 transition-colors"
      >
        <BellIcon className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4.5 min-w-[1.125rem] items-center justify-center rounded-full bg-brick px-1 text-[10px] font-semibold leading-none text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 z-50 mt-2 w-80 max-w-[90vw] rounded-card border border-line bg-card shadow-lg">
          <div className="flex items-center justify-between px-4 py-3 border-b border-line">
            <h3 className="text-sm font-semibold text-ink font-display">Notifications</h3>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => markAllRead()}
                className="text-xs font-medium text-pine hover:text-pine-dark"
              >
                Mark all as read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            <NotificationList notifications={notifications} onMarkRead={markRead} compact />
          </div>

          <div className="border-t border-line px-4 py-2.5 text-center">
            <Link
              to="/notifications"
              onClick={() => setIsOpen(false)}
              className="text-xs font-medium text-pine hover:text-pine-dark"
            >
              View all
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
