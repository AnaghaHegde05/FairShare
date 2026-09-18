// Persistent, per-user in-app notifications, stored in Postgres and read
// via polling rather than a live connection (WebSockets would be overkill
// for a notification badge). See the Notification model in schema.prisma
// for the storage-level rationale (dedupeKey, etc).
import prisma from "../lib/prisma";
import { listChoresWithCompletion, onlyPending } from "./chore.service";
import { recommendedChoreDedupeKey, formatPendingChoresMessage } from "./notification.util";

// Re-exported from notification.util.ts so callers can get it from here
// without a second import.
export { recommendedChoreDedupeKey } from "./notification.util";

export type NotificationType = "MEMBER_JOINED" | "MEMBER_REMOVED" | "PENDING_CHORES" | "RECOMMENDED_CHORE";

interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
}

/**
 * Creates a one-off notification (no dedup). Only appropriate for
 * notifications that are inherently single-fire -- created exactly once,
 * directly inside the request handler that triggered them (e.g. "X joined
 * the household", sent once per join). Anything that could otherwise be
 * recomputed and re-fired by a routine GET request (dashboard refresh,
 * chores list) must go through `upsertDedupedNotification` below instead.
 */
export async function createNotification(
  input: CreateNotificationInput,
  // Accepts either the shared `prisma` client or a `$transaction`
  // callback's `tx`, so the write can be part of the same transaction as
  // whatever caused it. Typed `any` because that's exactly how every
  // caller already passes `tx` (see routes/household.routes.ts).
  client: any = prisma
) {
  return client.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      message: input.message,
      metadata: input.metadata as any,
    },
  });
}

/**
 * Idempotent create for notifications a GET endpoint's side effect might
 * otherwise recompute and re-fire on every request (the recommended-chore
 * notification, notably). `dedupeKey` should encode exactly the situation
 * that should only notify once -- e.g. `recommended:<choreId>:<periodKey>`
 * -- so a genuinely new recommendation does create a fresh notification,
 * but repeating the same one is a no-op.
 *
 * Relies on the `@@unique([userId, dedupeKey])` constraint: we try to
 * create, and if a row with this (userId, dedupeKey) already exists,
 * Postgres rejects it (Prisma error P2002), which we treat as "already
 * notified" rather than an error.
 */
export async function upsertDedupedNotification(
  input: CreateNotificationInput & { dedupeKey: string }
) {
  try {
    return await prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        message: input.message,
        metadata: input.metadata as any,
        dedupeKey: input.dedupeKey,
      },
    });
  } catch (err: any) {
    if (err && err.code === "P2002") {
      return null; // already notified for this exact situation
    }
    throw err;
  }
}

const PENDING_CHORES_DEDUPE_KEY = "pending-chores";

/**
 * Implements the "only notify on a zero -> nonzero transition" rule,
 * using the Notification row itself as the memory of prior state (no
 * extra table needed):
 *   - pendingCount === 0 -> delete any existing pending-chores
 *     notification for this user (nothing left to flag).
 *   - pendingCount > 0, no existing row -> this IS the zero->nonzero
 *     transition, create a fresh (unread) notification.
 *   - pendingCount > 0, row already exists -> already in a nonzero
 *     streak; just keep the count/message current without resetting
 *     readAt (so re-opening the dashboard doesn't re-surface an
 *     already-read notification as unread).
 * Safe to call from multiple GET endpoints on every request -- never
 * creates more than one live row per user for this situation.
 */
export async function syncPendingChoreNotification(userId: string, pendingCount: number) {
  const existing = await prisma.notification.findUnique({
    where: { userId_dedupeKey: { userId, dedupeKey: PENDING_CHORES_DEDUPE_KEY } },
  });

  if (pendingCount === 0) {
    if (existing) {
      await prisma.notification.delete({ where: { id: existing.id } });
    }
    return;
  }

  const message = formatPendingChoresMessage(pendingCount);

  if (!existing) {
    await prisma.notification.create({
      data: {
        userId,
        type: "PENDING_CHORES",
        title: "Pending chores",
        message,
        metadata: { pendingCount },
        dedupeKey: PENDING_CHORES_DEDUPE_KEY,
      },
    });
    return;
  }

  const existingCount = (existing.metadata as any)?.pendingCount;
  if (existingCount !== pendingCount) {
    await prisma.notification.update({
      where: { id: existing.id },
      data: { message, metadata: { pendingCount } },
    });
  }
}

/**
 * Recomputes the household's current pending-chore count and syncs the
 * "You have N pending chores" notification for every member. Meant to be
 * called, best-effort, right after events that can actually change that
 * count -- a chore being created, completed, or deleted (see
 * routes/chore.routes.ts and routes/choreLog.routes.ts) -- never from a
 * plain GET.
 */
export async function syncPendingChoreNotificationsForHousehold(householdId: string) {
  const [members, chores] = await Promise.all([
    prisma.user.findMany({ where: { householdId }, select: { id: true } }),
    listChoresWithCompletion(householdId),
  ]);
  const pendingCount = onlyPending(chores).length;
  await Promise.all(
    members.map((m: { id: string }) => syncPendingChoreNotification(m.id, pendingCount))
  );
}

export interface NotificationPage {
  notifications: Array<{
    id: string;
    type: string;
    title: string;
    message: string;
    metadata: unknown;
    readAt: Date | null;
    createdAt: Date;
  }>;
  unreadCount: number;
  hasMore: boolean;
}

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/** Newest-first, paginated notifications for a single user, plus their current unread count. */
export async function listNotifications(
  userId: string,
  { limit = DEFAULT_LIMIT, offset = 0 }: { limit?: number; offset?: number }
): Promise<NotificationPage> {
  const safeLimit = Math.min(Math.max(1, limit), MAX_LIMIT);
  const safeOffset = Math.max(0, offset);

  const [rows, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      skip: safeOffset,
      take: safeLimit + 1,
    }),
    prisma.notification.count({ where: { userId, readAt: null } }),
  ]);

  const hasMore = rows.length > safeLimit;
  const page = rows.slice(0, safeLimit);

  return {
    notifications: page.map((row: any) => ({
      id: row.id,
      type: row.type,
      title: row.title,
      message: row.message,
      metadata: row.metadata,
      readAt: row.readAt,
      createdAt: row.createdAt,
    })),
    unreadCount,
    hasMore,
  };
}

export async function getUnreadCount(userId: string): Promise<number> {
  return prisma.notification.count({ where: { userId, readAt: null } });
}

/**
 * Marks a single notification as read. Returns `null` if the notification
 * doesn't exist OR doesn't belong to `userId` -- the caller (routes) turns
 * that into a 404, never revealing whether the id exists for someone else.
 */
export async function markNotificationRead(id: string, userId: string) {
  const existing = await prisma.notification.findUnique({ where: { id } });
  if (!existing || existing.userId !== userId) {
    return null;
  }
  if (existing.readAt) {
    return existing; // already read, no-op
  }
  return prisma.notification.update({ where: { id }, data: { readAt: new Date() } });
}

export async function markAllNotificationsRead(userId: string) {
  const result = await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
  return result.count;
}
