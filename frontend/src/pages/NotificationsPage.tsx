import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { ApiError } from "../context/AuthContext";
import { useNotifications } from "../context/NotificationsContext";
import type { NotificationEntry, NotificationPageResponse, Household } from "../types";
import AppHeader from "../components/AppHeader";
import Button from "../components/ui/Button";
import ErrorBanner from "../components/ui/ErrorBanner";
import NotificationList from "../components/NotificationList";

type LoadState = "loading" | "ready" | "error";

const PAGE_SIZE = 20;

// A full history page, separate from the header dropdown's short list
// (NotificationsContext keeps only the most recent ~10 for the bell).
// Read/unread actions here still go through the same context so the bell
// badge and dropdown stay in sync with whatever gets marked read here.
export default function NotificationsPage() {
  const { refresh: refreshBellState } = useNotifications();
  const [household, setHousehold] = useState<Household | null>(null);
  const [notifications, setNotifications] = useState<NotificationEntry[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  async function loadInitial() {
    setLoadState("loading");
    setLoadError(null);
    try {
      const [notifRes, householdRes] = await Promise.all([
        api.get<NotificationPageResponse>(`/api/notifications?limit=${PAGE_SIZE}&offset=0`),
        api.get<{ household: Household }>("/api/households/me"),
      ]);
      setNotifications(notifRes.notifications);
      setHasMore(notifRes.hasMore);
      setHousehold(householdRes.household);
      setLoadState("ready");
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Unable to load notifications.";
      setLoadError(message);
      setLoadState("error");
    }
  }

  useEffect(() => {
    loadInitial();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadMore() {
    setIsLoadingMore(true);
    try {
      const res = await api.get<NotificationPageResponse>(
        `/api/notifications?limit=${PAGE_SIZE}&offset=${notifications.length}`
      );
      setNotifications((prev) => [...prev, ...res.notifications]);
      setHasMore(res.hasMore);
    } catch {
      // Leave the current list + Load more button as-is so the user can retry.
    } finally {
      setIsLoadingMore(false);
    }
  }

  async function handleMarkRead(id: string) {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id && !n.readAt ? { ...n, readAt: new Date().toISOString() } : n))
    );
    try {
      await api.patch(`/api/notifications/${id}/read`);
    } finally {
      refreshBellState(); // keep the header badge/dropdown in sync
    }
  }

  async function handleMarkAllRead() {
    const now = new Date().toISOString();
    setNotifications((prev) => prev.map((n) => (n.readAt ? n : { ...n, readAt: now })));
    try {
      await api.patch("/api/notifications/read-all");
    } finally {
      refreshBellState();
    }
  }

  const hasUnread = notifications.some((n) => !n.readAt);

  return (
    <div className="min-h-screen">
      <AppHeader household={household} title="Notifications" active="activity" />

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {loadState === "loading" && (
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-pine border-t-transparent" />
            <span className="sr-only">Loading notifications...</span>
          </div>
        )}

        {loadState === "error" && (
          <div className="space-y-4">
            <ErrorBanner message={loadError ?? "Unable to load notifications."} />
            <Button onClick={loadInitial}>Try again</Button>
          </div>
        )}

        {loadState === "ready" && (
          <>
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-ink font-display">Notifications</h2>
              {hasUnread && (
                <Button variant="secondary" onClick={handleMarkAllRead}>
                  Mark all as read
                </Button>
              )}
            </div>

            {notifications.length === 0 ? (
              <div className="rounded-card border border-dashed border-line bg-card/50 p-10 text-center">
                <p className="font-semibold text-ink">No notifications yet.</p>
                <p className="mt-1 text-sm text-muted">
                  You'll see updates here about invitations, pending chores, and recommendations.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <NotificationList notifications={notifications} onMarkRead={handleMarkRead} />

                {hasMore && (
                  <div className="flex justify-center pt-2">
                    <Button variant="secondary" onClick={loadMore} isLoading={isLoadingMore}>
                      Load more
                    </Button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
