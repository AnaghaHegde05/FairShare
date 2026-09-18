import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { ApiError } from "../context/AuthContext";
import type { Chore, DashboardResponse, Household } from "../types";
import AppHeader from "../components/AppHeader";
import Button from "../components/ui/Button";
import ErrorBanner from "../components/ui/ErrorBanner";
import FairnessChart from "../components/FairnessChart";
import FairnessSummary from "../components/FairnessSummary";
import ContributionHistory from "../components/ContributionHistory";
import NextChoreCard from "../components/NextChoreCard";

type LoadState = "loading" | "ready" | "error";

const WINDOW_OPTIONS = [
  { days: 7, label: "Last 7 Days", windowLabel: "the last 7 days" },
  { days: 30, label: "Last 30 Days", windowLabel: "the last 30 days" },
] as const;

export default function DashboardPage() {
  const [household, setHousehold] = useState<Household | null>(null);
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  // The dashboard endpoint only returns per-member contributions and history
  // (which is empty for a household with no chores at all just as it is for
  // one with chores but nothing logged yet) — fetching the chore count
  // separately is the only way to tell those two empty states apart.
  const [choreCount, setChoreCount] = useState<number | null>(null);
  const [windowDays, setWindowDays] = useState<number>(7);

  // Two separate flags: `loadState` gates the very first paint (nothing to
  // show yet), `isSwitching` covers re-fetches after that so the window
  // toggle doesn't blank a dashboard the user is already looking at.
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSwitching, setIsSwitching] = useState(false);

  async function loadDashboard(days: number, opts: { isInitial: boolean }) {
    if (opts.isInitial) {
      setLoadState("loading");
    } else {
      setIsSwitching(true);
    }
    setLoadError(null);
    try {
      const [dashboardRes, householdRes, choresRes] = await Promise.all([
        api.get<DashboardResponse>(`/api/dashboard?days=${days}`),
        opts.isInitial
          ? api.get<{ household: Household }>("/api/households/me")
          : Promise.resolve(null),
        opts.isInitial ? api.get<{ chores: Chore[] }>("/api/chores") : Promise.resolve(null),
      ]);
      setDashboard(dashboardRes);
      if (householdRes) setHousehold(householdRes.household);
      if (choresRes) setChoreCount(choresRes.chores.length);
      if (opts.isInitial) setLoadState("ready");
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Unable to load dashboard data.";
      setLoadError(message);
      // A failed window switch shouldn't nuke an already-loaded dashboard —
      // surface the error but keep showing the last good data underneath it.
      if (opts.isInitial) setLoadState("error");
    } finally {
      if (!opts.isInitial) setIsSwitching(false);
    }
  }

  useEffect(() => {
    loadDashboard(7, { isInitial: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleWindowChange(days: number) {
    if (days === windowDays) return;
    setWindowDays(days);
    loadDashboard(days, { isInitial: false });
  }

  const activeOption = WINDOW_OPTIONS.find((o) => o.days === windowDays) ?? WINDOW_OPTIONS[0];
  const memberCount = dashboard?.contributions.length ?? household?.users?.length ?? 0;

  return (
    <div className="min-h-screen">
      <AppHeader household={household} title="Dashboard" active="dashboard" />

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {loadState === "loading" && (
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-pine border-t-transparent" />
          </div>
        )}

        {loadState === "error" && (
          <div className="space-y-4">
            <ErrorBanner message={loadError} />
            <Button onClick={() => loadDashboard(windowDays, { isInitial: true })}>
              Try again
            </Button>
          </div>
        )}

        {loadState === "ready" && dashboard && (
          <>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-ink font-display">
                  Fairness overview
                </h2>
                <p className="text-sm text-muted">
                  {household?.name ? `${household.name} · ` : ""}
                  {memberCount} member{memberCount === 1 ? "" : "s"}
                </p>
              </div>

              <div
                role="group"
                aria-label="Time window"
                className="inline-flex rounded-lg border border-line bg-card p-1 self-start"
              >
                {WINDOW_OPTIONS.map((opt) => (
                  <button
                    key={opt.days}
                    type="button"
                    onClick={() => handleWindowChange(opt.days)}
                    disabled={isSwitching}
                    className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-wait ${
                      opt.days === windowDays
                        ? "bg-pine text-white"
                        : "text-muted hover:text-ink"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {loadError && (
              <ErrorBanner message={`${loadError} Showing the last successfully loaded data.`} />
            )}

            {memberCount === 1 && (
              <div className="rounded-card border border-line bg-card px-4 py-3 text-sm text-muted">
                This household has only one member, so there's no one to compare fairness
                against yet — invite someone to see how contributions stack up.
              </div>
            )}

            <div className={isSwitching ? "opacity-60 transition-opacity" : "transition-opacity"}>
              {choreCount === 0 ? (
                <div className="rounded-card border border-dashed border-line bg-card/50 p-10 text-center">
                  <p className="font-semibold text-ink">No chores have been added yet</p>
                  <p className="mt-1 text-sm text-muted">
                    Add your first chore to get started tracking fairness.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  <FairnessSummary contributions={dashboard.contributions} />

                  <div className="rounded-card border border-line bg-card p-4 sm:p-5">
                    <h3 className="text-sm font-semibold text-ink mb-2">
                      Actual vs. fair share
                    </h3>
                    <FairnessChart contributions={dashboard.contributions} />
                  </div>

                  <NextChoreCard
                    recommendation={dashboard.recommendation}
                    memberCount={memberCount}
                  />

                  <div>
                    <h3 className="text-sm font-semibold text-ink mb-3">
                      Contribution history
                    </h3>
                    <ContributionHistory
                      history={dashboard.history}
                      windowLabel={activeOption.windowLabel}
                    />
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
