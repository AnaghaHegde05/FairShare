// Implements the fairness algorithm from the README:
//   1. Sum each member's total effort points over the chosen time window.
//   2. expected share = total household effort ÷ number of members.
//   3. fairness score = actual contribution − expected contribution.
//   4. Positive = above fair share, negative = behind fair share.
//   5. buildRecommendation() below picks who's furthest behind and which
//      pending chore they should take (see its doc comment for the
//      tie-break rules).
//
// Kept as pure functions (no DB, no Express) so the math is unit-testable
// in isolation. The single source of truth for fairness math and the
// recommendation algorithm.

export interface HouseholdMember {
  id: string;
  name: string;
}

export interface ChoreLogEntry {
  userId: string;
  effortWeightSnapshot: number;
}

export interface MemberContribution {
  userId: string;
  name: string;
  actual: number;
  expected: number;
  fairnessScore: number;
  label: string;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

// "+12 above fair share" / "-8 behind fair share" / "On track" — matches the
// display format described in the README.
export function formatFairnessLabel(fairnessScore: number): string {
  const rounded = round1(fairnessScore);
  if (rounded > 0) return `+${rounded} above fair share`;
  if (rounded < 0) return `${rounded} behind fair share`;
  return "On track (0)";
}

// Computes each member's actual contribution, expected (fair) share, and
// fairness score for the given window of chore logs. Every household
// member is included even if they logged nothing (actual = 0) — being
// idle is itself a signal this tool is meant to surface.
export function calculateFairness(
  members: HouseholdMember[],
  logs: ChoreLogEntry[]
): MemberContribution[] {
  const actualByUser = new Map<string, number>();
  for (const member of members) {
    actualByUser.set(member.id, 0);
  }

  let totalEffort = 0;
  for (const log of logs) {
    totalEffort += log.effortWeightSnapshot;
    actualByUser.set(
      log.userId,
      (actualByUser.get(log.userId) ?? 0) + log.effortWeightSnapshot
    );
  }

  const expected = members.length > 0 ? totalEffort / members.length : 0;

  return members.map((member) => {
    const actual = actualByUser.get(member.id) ?? 0;
    const fairnessScore = actual - expected;
    return {
      userId: member.id,
      name: member.name,
      actual: round1(actual),
      expected: round1(expected),
      fairnessScore: round1(fairnessScore),
      label: formatFairnessLabel(fairnessScore),
    };
  });
}

// Recommendation engine: picks who's up next and which pending chore they
// should take, with a generated explanation. Built on the same
// `MemberContribution[]` calculateFairness() already produces.

export interface PendingChoreOption {
  id: string;
  name: string;
  effortWeight: number;
  createdAt: string; // ISO string; used only to break ties deterministically
}

export interface Recommendation {
  member: MemberContribution;
  chore: PendingChoreOption | null;
  reason: string;
}

/**
 * Picks who's "up next" — whoever is furthest behind their fair share.
 *
 * Tie-break order (deterministic, no randomization), applied only when the
 * previous step is exactly equal:
 *   1. Lowest `fairnessScore` for the selected window (furthest behind wins).
 *   2. Lowest window `actual` contribution — rarely differs once (1) is
 *      tied (everyone in the same window shares the same `expected`), but
 *      kept as an explicit step.
 *   3. Lowest ALL-TIME total contribution (`totalsByUserId`, independent of
 *      the window) — someone who's contributed less across the household's
 *      whole history is arguably "more behind" than someone who just joined.
 *   4. Stable tie-break on `userId` so the result never depends on array/query order.
 */
export function selectFurthestBehind(
  contributions: MemberContribution[],
  totalsByUserId: Map<string, number> = new Map()
): MemberContribution | null {
  if (contributions.length === 0) return null;

  const sorted = [...contributions].sort((a, b) => {
    if (a.fairnessScore !== b.fairnessScore) return a.fairnessScore - b.fairnessScore;
    if (a.actual !== b.actual) return a.actual - b.actual;
    const totalA = totalsByUserId.get(a.userId) ?? 0;
    const totalB = totalsByUserId.get(b.userId) ?? 0;
    if (totalA !== totalB) return totalA - totalB;
    return a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0;
  });

  return sorted[0];
}

/**
 * Picks which pending chore to recommend: the heaviest-effort pending
 * chore, on the theory that handing the furthest-behind member the
 * chore worth the most points closes the gap fastest. Only ever considers
 * chores already known to be pending for their current occurrence (see
 * services/chore.service.ts `onlyPending`).
 *
 * Tie-break: higher effort weight wins, then older chore (`createdAt`),
 * then stable `id` comparison.
 */
export function selectRecommendedChore(
  pendingChores: PendingChoreOption[]
): PendingChoreOption | null {
  if (pendingChores.length === 0) return null;

  const sorted = [...pendingChores].sort((a, b) => {
    if (b.effortWeight !== a.effortWeight) return b.effortWeight - a.effortWeight;
    if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });

  return sorted[0];
}

// Plain-language explanation generated entirely from the actual computed
// numbers — never a hardcoded name or score.
function buildReason(member: MemberContribution, chore: PendingChoreOption | null): string {
  const behind = round1(Math.abs(member.fairnessScore));
  const pointWord = behind === 1 ? "point" : "points";

  let base: string;
  if (member.fairnessScore < 0) {
    base = `Recommended because ${member.name} is currently ${behind} ${pointWord} behind the household fair share.`;
  } else if (member.fairnessScore > 0) {
    base = `Everyone is at or above their fair share right now — ${member.name} is the least far ahead, so they're up next.`;
  } else {
    base = `${member.name} is exactly at the household fair share, same as everyone else, so they're up next.`;
  }

  if (!chore) {
    base += " There are no pending chores to suggest right now.";
  }

  return base;
}

/**
 * Full recommendation: who's next, which pending chore they should
 * take, and why — all derived from real calculated values, never
 * hardcoded. Returns null only when the household has no members.
 */
export function buildRecommendation(
  contributions: MemberContribution[],
  totalsByUserId: Map<string, number>,
  pendingChores: PendingChoreOption[]
): Recommendation | null {
  const member = selectFurthestBehind(contributions, totalsByUserId);
  if (!member) return null;

  const chore = selectRecommendedChore(pendingChores);

  return {
    member,
    chore,
    reason: buildReason(member, chore),
  };
}
