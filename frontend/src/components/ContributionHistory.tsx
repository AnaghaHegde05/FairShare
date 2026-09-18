import type { DashboardHistoryEntry } from "../types";
import { timeAgo } from "../lib/time";

interface ContributionHistoryProps {
  history: DashboardHistoryEntry[];
  windowLabel: string;
}

// Chronological timeline of completed chores for the selected window,
// straight from the backend's real `ChoreLog` rows (dashboard.routes.ts
// already joins chore + user names, so no extra lookups needed here).
export default function ContributionHistory({ history, windowLabel }: ContributionHistoryProps) {
  if (history.length === 0) {
    return (
      <div className="rounded-card border border-dashed border-line bg-card/50 p-8 text-center">
        <p className="font-semibold text-ink">No completed chores in {windowLabel}</p>
        <p className="mt-1 text-sm text-muted">
          Complete a chore to start building your fairness history.
        </p>
      </div>
    );
  }

  return (
    <ol className="relative space-y-0 border-l border-line pl-5 sm:pl-6">
      {history.map((entry) => (
        <li key={entry.id} className="relative pb-5 last:pb-0">
          <span className="absolute -left-[26px] sm:-left-[30px] top-1 h-2.5 w-2.5 rounded-full bg-pine ring-4 ring-paper" />
          <div className="rounded-card border border-line bg-card px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <p className="font-semibold text-ink truncate">{entry.choreName}</p>
              <span className="text-xs text-muted shrink-0 whitespace-nowrap">
                {timeAgo(entry.completedAt)}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted">
              Completed by <span className="text-ink font-medium">{entry.userName}</span> ·{" "}
              <span className="text-pine-dark font-medium">+{entry.effortWeightSnapshot} points</span>
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
