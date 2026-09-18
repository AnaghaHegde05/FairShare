// Pure helpers pulled out of notification.service.ts so they
// can be unit-tested without importing Prisma at all (notification.service.ts
// imports lib/prisma.ts, which instantiates a real PrismaClient at module
// load time -- fine for the running app, but it means anything in that
// file can only be tested against a real database. These two functions
// have no such dependency, so they live here instead.

/** The "which chore, which occurrence" dedup key for the recommended-chore notification -- see notification.service.ts::upsertDedupedNotification. */
export function recommendedChoreDedupeKey(choreId: string, periodKey: string): string {
  return `recommended:${choreId}:${periodKey}`;
}

/** The exact wording used for the pending-chores notification, including pluralization. */
export function formatPendingChoresMessage(pendingCount: number): string {
  return `You have ${pendingCount} pending chore${pendingCount === 1 ? "" : "s"}`;
}
