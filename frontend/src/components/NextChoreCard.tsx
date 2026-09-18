import type { Recommendation } from "../types";

interface NextChoreCardProps {
  recommendation: Recommendation | null;
  memberCount: number;
}

// Purely presentational — the "who's next, which chore, and why" decision
// is made entirely on the backend by buildRecommendation()
// (services/fairness.service.ts). This component just displays that
// decision; it never computes or guesses at any of it itself.
export default function NextChoreCard({ recommendation, memberCount }: NextChoreCardProps) {
  if (memberCount === 0) return null;

  if (!recommendation) {
    return (
      <div className="ticket px-5 py-4">
        <p className="text-xs uppercase tracking-wide text-muted font-medium">
          Recommended next chore
        </p>
        <p className="mt-1 text-ink">Not enough data yet to suggest who's next.</p>
      </div>
    );
  }

  const { member, chore, reason } = recommendation;

  return (
    <div className="ticket px-5 py-4">
      <p className="text-xs uppercase tracking-wide text-muted font-medium">
        Recommended next chore
      </p>

      {chore ? (
        <p className="mt-1 text-lg font-display font-semibold text-ink">
          {member.name} → {chore.name}{" "}
          <span className="text-pine-dark">+{chore.effortWeight} effort points</span>
        </p>
      ) : (
        <p className="mt-1 text-lg font-display font-semibold text-ink">
          {member.name} is up next
        </p>
      )}

      <p className="mt-1 text-sm text-muted">{reason}</p>
    </div>
  );
}
