// A simple, append-only household activity timeline. See the
// Activity model in schema.prisma for the storage-level rationale
// (precomputed message, why userId is nullable, etc).
//
// Every activity-recording function here takes an optional Prisma
// transaction client (`tx`) so callers can create the Activity row in the
// same transaction as the action that caused it (e.g. ChoreLog + Activity
// together) — see services/chore.service.ts callers in the routes files.
// If no `tx` is passed, it falls back to the shared `prisma` client.
import prisma from "../lib/prisma";

export type ActivityType =
  | "HOUSEHOLD_CREATED"
  | "HOUSEHOLD_UPDATED"
  | "MEMBER_JOINED"
  | "MEMBER_REMOVED"
  | "MEMBER_LEFT"
  | "CHORE_CREATED"
  | "CHORE_UPDATED"
  | "CHORE_DELETED"
  | "CHORE_COMPLETED";

interface RecordActivityInput {
  householdId: string;
  userId?: string | null;
  type: ActivityType;
  message: string;
  metadata?: Record<string, unknown>;
}

/**
 * Records a single activity event. Errors are never swallowed here --
 * when called inside a `prisma.$transaction`, a failed write rolls back
 * the whole transaction it's part of, which is what we want (no
 * misleading activity entries for actions that didn't actually succeed).
 */
export async function recordActivity(
  input: RecordActivityInput,
  // Accepts either the shared `prisma` client or a `$transaction` callback's
  // `tx`, so the write can be part of the same transaction as whatever
  // caused it. Typed `any` because that's exactly how every caller already
  // passes `tx` (see routes/household.routes.ts) — a stricter type here
  // wouldn't add any real safety.
  client: any = prisma
) {
  return client.activity.create({
    data: {
      householdId: input.householdId,
      userId: input.userId ?? null,
      type: input.type,
      message: input.message,
      metadata: input.metadata as any,
    },
  });
}

export interface ActivityPage {
  activities: Array<{
    id: string;
    type: string;
    message: string;
    metadata: unknown;
    createdAt: Date;
    userId: string | null;
    userName: string | null;
  }>;
  hasMore: boolean;
}

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/**
 * Newest-first, paginated activity for a single household. Household
 * isolation is enforced by the caller always supplying `householdId` from
 * `req.householdId` (never from the request body/query) -- see
 * routes/activity.routes.ts.
 */
export async function listActivity(
  householdId: string,
  { limit = DEFAULT_LIMIT, offset = 0 }: { limit?: number; offset?: number }
): Promise<ActivityPage> {
  const safeLimit = Math.min(Math.max(1, limit), MAX_LIMIT);
  const safeOffset = Math.max(0, offset);

  const rows = await prisma.activity.findMany({
    where: { householdId },
    orderBy: { createdAt: "desc" },
    skip: safeOffset,
    // Fetch one extra row to cheaply know whether there's more without a
    // separate count query.
    take: safeLimit + 1,
    include: { user: { select: { name: true } } },
  });

  const hasMore = rows.length > safeLimit;
  const page = rows.slice(0, safeLimit);

  return {
    activities: page.map((row: any) => ({
      id: row.id,
      type: row.type,
      message: row.message,
      metadata: row.metadata,
      createdAt: row.createdAt,
      userId: row.userId,
      userName: row.user?.name ?? null,
    })),
    hasMore,
  };
}
