import type { MemberContribution } from "../types";

interface FairnessSummaryProps {
  contributions: MemberContribution[];
}

// "+7" in pine (above), "-7" in brick (behind), muted "0" (on track) —
// color codes the fairness score so it's readable at a glance.
function statusClasses(score: number): string {
  if (score > 0) return "text-pine-dark bg-pine-light";
  if (score < 0) return "text-brick-dark bg-brick-light";
  return "text-muted bg-line/40";
}

function formatSigned(score: number): string {
  if (score > 0) return `+${score}`;
  return `${score}`;
}

export default function FairnessSummary({ contributions }: FairnessSummaryProps) {
  return (
    <>
      {/* Table on wider screens */}
      <div className="hidden sm:block overflow-x-auto rounded-card border border-line bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-4 py-3 font-medium">Member</th>
              <th className="px-4 py-3 font-medium">Actual</th>
              <th className="px-4 py-3 font-medium">Fair share</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {contributions.map((c) => (
              <tr key={c.userId} className="border-b border-line last:border-0">
                <td className="px-4 py-3 font-semibold text-ink">{c.name}</td>
                <td className="px-4 py-3 text-ink">{c.actual}</td>
                <td className="px-4 py-3 text-muted">{c.expected}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${statusClasses(
                      c.fairnessScore
                    )}`}
                  >
                    {formatSigned(c.fairnessScore)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Cards on small screens — a table with 4 columns doesn't fit a phone
          without horizontal scroll, so stack each member as a card instead. */}
      <div className="sm:hidden space-y-3">
        {contributions.map((c) => (
          <div key={c.userId} className="rounded-card border border-line bg-card p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-semibold text-ink truncate">{c.name}</h3>
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold shrink-0 ${statusClasses(
                  c.fairnessScore
                )}`}
              >
                {formatSigned(c.fairnessScore)}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted">{c.label}</p>
            <div className="mt-2 flex items-center gap-4 text-sm">
              <span className="text-ink">
                <span className="text-muted">Actual</span> {c.actual}
              </span>
              <span className="text-ink">
                <span className="text-muted">Fair share</span> {c.expected}
              </span>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
