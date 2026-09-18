import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { ApiError } from "../context/AuthContext";
import type { ActivityEntry, ActivityPageResponse, Household } from "../types";
import AppHeader from "../components/AppHeader";
import Button from "../components/ui/Button";
import ErrorBanner from "../components/ui/ErrorBanner";

type LoadState = "loading" | "ready" | "error";

const PAGE_SIZE = 20;

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** "Today" / "Yesterday" / "Earlier" bucket for a real backend timestamp -- grouping is computed from `createdAt`, never a client-generated placeholder. */
function groupLabel(createdAt: string): "Today" | "Yesterday" | "Earlier" {
  const entryDay = startOfDay(new Date(createdAt));
  const today = startOfDay(new Date());
  const oneDayMs = 24 * 60 * 60 * 1000;
  if (entryDay === today) return "Today";
  if (entryDay === today - oneDayMs) return "Yesterday";
  return "Earlier";
}

function formatClockTime(createdAt: string): string {
  return new Date(createdAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

// Groups a flat, newest-first activity list into Today/Yesterday/Earlier
// sections while preserving newest-first order *within* each section.
// Since the list itself is already newest-first, sections naturally
// appear in the right order too (Today's entries all sort before
// Yesterday's, which all sort before Earlier's).
function groupActivities(activities: ActivityEntry[]): Array<[string, ActivityEntry[]]> {
  const groups = new Map<string, ActivityEntry[]>();
  for (const entry of activities) {
    const label = groupLabel(entry.createdAt);
    const bucket = groups.get(label);
    if (bucket) {
      bucket.push(entry);
    } else {
      groups.set(label, [entry]);
    }
  }
  return Array.from(groups.entries());
}

function ContributionBadge({ entry }: { entry: ActivityEntry }) {
  const effortWeight = entry.metadata?.effortWeight;
  if (entry.type !== "CHORE_COMPLETED" || typeof effortWeight !== "number") return null;
  return <p className="text-xs font-medium text-pine-dark mt-0.5">+{effortWeight} contribution</p>;
}

export default function ActivityPage() {
  const [household, setHousehold] = useState<Household | null>(null);
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  async function loadInitial() {
    setLoadState("loading");
    setLoadError(null);
    try {
      const [activityRes, householdRes] = await Promise.all([
        api.get<ActivityPageResponse>(`/api/activity?limit=${PAGE_SIZE}&offset=0`),
        api.get<{ household: Household }>("/api/households/me"),
      ]);
      setActivities(activityRes.activities);
      setHasMore(activityRes.hasMore);
      setHousehold(householdRes.household);
      setLoadState("ready");
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Unable to load activity.";
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
      const res = await api.get<ActivityPageResponse>(
        `/api/activity?limit=${PAGE_SIZE}&offset=${activities.length}`
      );
      setActivities((prev) => [...prev, ...res.activities]);
      setHasMore(res.hasMore);
    } catch {
      // A failed "load more" shouldn't nuke what's already on screen --
      // just leave the button there so the user can retry.
    } finally {
      setIsLoadingMore(false);
    }
  }

  const groups = groupActivities(activities);

  return (
    <div className="min-h-screen">
      <AppHeader household={household} title="Activity" active="activity" />

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {loadState === "loading" && (
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-pine border-t-transparent" />
            <span className="sr-only">Loading activity...</span>
          </div>
        )}

        {loadState === "error" && (
          <div className="space-y-4">
            <ErrorBanner message={loadError ?? "Unable to load activity."} />
            <Button onClick={loadInitial}>Try again</Button>
          </div>
        )}

        {loadState === "ready" && (
          <>
            <h2 className="text-lg font-semibold text-ink font-display">Activity</h2>

            {activities.length === 0 ? (
              <div className="rounded-card border border-dashed border-line bg-card/50 p-10 text-center">
                <p className="font-semibold text-ink">No activity yet.</p>
                <p className="mt-1 text-sm text-muted">
                  Household activity will appear here as members create and complete chores.
                </p>
              </div>
            ) : (
              <div className="space-y-8">
                {groups.map(([label, entries]) => (
                  <section key={label}>
                    <h3 className="text-sm font-semibold text-muted uppercase tracking-wide mb-3">
                      {label}
                    </h3>
                    <ol className="relative space-y-0 border-l border-line pl-5 sm:pl-6">
                      {entries.map((entry) => (
                        <li key={entry.id} className="relative pb-5 last:pb-0">
                          <span className="absolute -left-[26px] sm:-left-[30px] top-1 h-2.5 w-2.5 rounded-full bg-pine ring-4 ring-paper" />
                          <div className="rounded-card border border-line bg-card px-4 py-3">
                            <div className="flex items-start justify-between gap-3">
                              <p className="text-ink">{entry.message}</p>
                              <span className="text-xs text-muted shrink-0 whitespace-nowrap">
                                {formatClockTime(entry.createdAt)}
                              </span>
                            </div>
                            <ContributionBadge entry={entry} />
                          </div>
                        </li>
                      ))}
                    </ol>
                  </section>
                ))}

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
