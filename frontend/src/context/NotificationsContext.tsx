// Client-side home for in-app notification state. Polls the unread count
// on an interval (see POLL_INTERVAL_MS below) rather than using
// WebSockets: the backend doesn't run Socket.IO, and the app works fine
// without a live connection for something this low-stakes. This context
// gives every component that needs the bell badge / dropdown /
// notifications page a single shared source of truth instead of each one
// polling independently.
import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";
import { api } from "../lib/api";
import { useAuth } from "./AuthContext";
import type { NotificationEntry, NotificationPageResponse } from "../types";

const POLL_INTERVAL_MS = 45_000;
const DROPDOWN_PAGE_SIZE = 10;

interface NotificationsContextValue {
  notifications: NotificationEntry[];
  unreadCount: number;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<NotificationEntry[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.get<NotificationPageResponse>(
        `/api/notifications?limit=${DROPDOWN_PAGE_SIZE}`
      );
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load notifications");
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Cheap poll: only the unread count, not the full list, so a background
  // tab isn't repeatedly pulling 10 full notification rows every 45s just
  // to find out the badge number didn't change.
  const pollUnreadCount = useCallback(async () => {
    if (!user) return;
    try {
      const data = await api.get<{ unreadCount: number }>("/api/notifications/unread-count");
      setUnreadCount(data.unreadCount);
    } catch {
      // Silent — a missed poll isn't worth surfacing an error for; the
      // next successful poll (or manual refresh) will correct the badge.
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }
    refresh();
    const interval = setInterval(pollUnreadCount, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  async function markRead(id: string) {
    // Optimistic update — the bell/dropdown should feel instant; refresh()
    // below reconciles with the server shortly after.
    setNotifications((prev) =>
      prev.map((n) => (n.id === id && !n.readAt ? { ...n, readAt: new Date().toISOString() } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
    try {
      await api.patch(`/api/notifications/${id}/read`);
    } catch {
      // Reconcile with the server's real state rather than leaving the
      // optimistic update possibly wrong.
      refresh();
    }
  }

  async function markAllRead() {
    const now = new Date().toISOString();
    setNotifications((prev) => prev.map((n) => (n.readAt ? n : { ...n, readAt: now })));
    setUnreadCount(0);
    try {
      await api.patch("/api/notifications/read-all");
    } catch {
      refresh();
    }
  }

  return (
    <NotificationsContext.Provider
      value={{ notifications, unreadCount, isLoading, error, refresh, markRead, markAllRead }}
    >
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications(): NotificationsContextValue {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error("useNotifications must be used within a NotificationsProvider");
  return ctx;
}
