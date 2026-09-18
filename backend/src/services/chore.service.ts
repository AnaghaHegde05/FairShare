// Single source of truth for "what's each of this household's chores'
// status for its *current* occurrence, right now" — the
// pending/completed logic. Pulled out of chore.routes.ts so
// the fairness/recommendation engine (dashboard.routes.ts) can reuse the
// exact same occurrence logic instead of a second copy of it. See
// utils/period.ts for how `currentPeriodKey` is derived from a chore's
// frequency.
import prisma from "../lib/prisma";
import { getPeriodKey, getPeriodLabel } from "../utils/period";

export interface ChoreCompletionInfo {
  id: string;
  userId: string;
  userName: string;
  completedAt: Date;
  effortWeightSnapshot: number;
}

export interface ChoreWithCompletion {
  id: string;
  householdId: string;
  name: string;
  effortWeight: number;
  frequency: string;
  createdAt: Date;
  currentPeriodKey: string;
  periodLabel: string;
  // null = pending (not yet completed for its current occurrence)
  completion: ChoreCompletionInfo | null;
}

/**
 * Lists every chore in a household, each annotated with whether it's
 * already been completed for its *current* occurrence (today for a daily
 * chore, this ISO week for a weekly chore, etc). `now` defaults to the
 * real server clock; tests pass a fixed Date to keep results deterministic.
 */
export async function listChoresWithCompletion(
  householdId: string,
  now: Date = new Date()
): Promise<ChoreWithCompletion[]> {
  const chores = await prisma.chore.findMany({
    where: { householdId },
    orderBy: { createdAt: "asc" },
  });

  const withPeriodKeys = chores.map((chore: any) => ({
    chore,
    currentPeriodKey: getPeriodKey(chore.frequency, now),
  }));

  const currentLogs: any[] =
    withPeriodKeys.length === 0
      ? []
      : await prisma.choreLog.findMany({
          where: {
            OR: withPeriodKeys.map((entry: { chore: any; currentPeriodKey: string }) => ({
              choreId: entry.chore.id,
              periodKey: entry.currentPeriodKey,
            })),
          },
          include: {
            user: { select: { id: true, name: true } },
          },
        });

  const logByChoreId = new Map(currentLogs.map((log: any) => [log.choreId, log]));

  return withPeriodKeys.map((entry: { chore: any; currentPeriodKey: string }) => {
    const { chore, currentPeriodKey } = entry;
    const log = logByChoreId.get(chore.id) ?? null;
    return {
      ...chore,
      currentPeriodKey,
      periodLabel: getPeriodLabel(chore.frequency),
      completion: log
        ? {
            id: log.id,
            userId: log.userId,
            userName: log.user.name,
            completedAt: log.completedAt,
            effortWeightSnapshot: log.effortWeightSnapshot,
          }
        : null,
    };
  });
}

/** Convenience filter: only chores not yet completed for their current occurrence. */
export function onlyPending(chores: ChoreWithCompletion[]): ChoreWithCompletion[] {
  return chores.filter((c) => c.completion === null);
}
