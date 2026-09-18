// Integration tests for the notification system
// (services/notification.service.ts + routes/notification.routes.ts's
// per-user authorization).
//
// *** How to run this file ***
// Requires a real database through the generated Prisma Client:
//   cd backend
//   npx prisma generate
//   npx prisma migrate dev
//   npx ts-node src/services/notification.service.integration.test.ts
import assert from "node:assert/strict";
import prisma from "../lib/prisma";
import {
  createNotification,
  upsertDedupedNotification,
  syncPendingChoreNotification,
  listNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
} from "./notification.service";

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    passed++;
    console.log(`PASS: ${name}`);
  } catch (err) {
    failed++;
    console.error(`FAIL: ${name}`);
    console.error(err);
  }
}

async function makeHousehold(name: string) {
  return prisma.household.create({
    data: { name, inviteCode: Math.random().toString(36).slice(2, 8).toUpperCase() },
  });
}

async function makeUser(name: string, householdId: string) {
  return prisma.user.create({
    data: {
      name,
      username: name,
      usernameLower: name.toLowerCase(),
      passwordHash: "not-a-real-hash",
      householdId,
    },
  });
}

async function main() {
  const household = await makeHousehold(`Test House ${Date.now()}`);
  const userA = await makeUser(`Anagha-${Date.now()}`, household.id);
  const userB = await makeUser(`Rahul-${Date.now()}`, household.id);

  try {
    await test("invitation-style (member joined) notification belongs to the correct user", async () => {
      const n = await createNotification({
        userId: userA.id,
        type: "MEMBER_JOINED",
        title: "New member",
        message: `${userB.name} joined ${household.name}`,
      });
      assert.equal(n.userId, userA.id);
    });

    await test("user can fetch their own notifications", async () => {
      const page = await listNotifications(userA.id, { limit: 50 });
      assert.ok(page.notifications.length >= 1);
    });

    await test("user cannot fetch another user's notifications through listNotifications", async () => {
      const pageA = await listNotifications(userA.id, { limit: 50 });
      const pageB = await listNotifications(userB.id, { limit: 50 });
      const bIds = new Set(pageB.notifications.map((n) => n.id));
      assert.ok(pageA.notifications.every((n) => !bIds.has(n.id)));
    });

    await test("unread count is correct", async () => {
      const before = await getUnreadCount(userA.id);
      await createNotification({
        userId: userA.id,
        type: "MEMBER_JOINED",
        title: "New member",
        message: "another join",
      });
      const after = await getUnreadCount(userA.id);
      assert.equal(after, before + 1);
    });

    await test("mark one notification as read works and updates unread count", async () => {
      const n = await createNotification({
        userId: userA.id,
        type: "MEMBER_JOINED",
        title: "New member",
        message: "mark-me-read test",
      });
      const beforeUnread = await getUnreadCount(userA.id);
      const updated = await markNotificationRead(n.id, userA.id);
      assert.ok(updated?.readAt !== null);
      const afterUnread = await getUnreadCount(userA.id);
      assert.equal(afterUnread, beforeUnread - 1);
    });

    await test("user cannot mark another user's notification as read", async () => {
      const n = await createNotification({
        userId: userA.id,
        type: "MEMBER_JOINED",
        title: "New member",
        message: "belongs to A only",
      });
      const result = await markNotificationRead(n.id, userB.id);
      assert.equal(result, null);
      const stillUnread = await prisma.notification.findUnique({ where: { id: n.id } });
      assert.equal(stillUnread?.readAt, null);
    });

    await test("mark all as read works", async () => {
      await createNotification({ userId: userA.id, type: "MEMBER_JOINED", title: "x", message: "y1" });
      await createNotification({ userId: userA.id, type: "MEMBER_JOINED", title: "x", message: "y2" });
      const count = await markAllNotificationsRead(userA.id);
      assert.ok(count >= 2);
      const unread = await getUnreadCount(userA.id);
      assert.equal(unread, 0);
    });

    await test("duplicate notification is prevented via dedupeKey (recommended chore)", async () => {
      const first = await upsertDedupedNotification({
        userId: userA.id,
        type: "RECOMMENDED_CHORE",
        title: "Recommended chore",
        message: "Your next recommended chore is Clean Bathroom",
        dedupeKey: "recommended:chore-1:weekly:2026-W34",
      });
      const second = await upsertDedupedNotification({
        userId: userA.id,
        type: "RECOMMENDED_CHORE",
        title: "Recommended chore",
        message: "Your next recommended chore is Clean Bathroom",
        dedupeKey: "recommended:chore-1:weekly:2026-W34",
      });
      assert.ok(first !== null);
      assert.equal(second, null); // second call is a no-op, not a duplicate row
    });

    await test("a genuinely new recommendation (different dedupeKey) does create a new notification", async () => {
      const forNextWeek = await upsertDedupedNotification({
        userId: userA.id,
        type: "RECOMMENDED_CHORE",
        title: "Recommended chore",
        message: "Your next recommended chore is Clean Bathroom",
        dedupeKey: "recommended:chore-1:weekly:2026-W35",
      });
      assert.ok(forNextWeek !== null);
    });

    await test("pending-chore notification: zero -> nonzero creates it, staying nonzero doesn't duplicate it, back to zero deletes it", async () => {
      await syncPendingChoreNotification(userB.id, 0); // start clean
      await syncPendingChoreNotification(userB.id, 2);
      const afterFirst = await prisma.notification.findUnique({
        where: { userId_dedupeKey: { userId: userB.id, dedupeKey: "pending-chores" } },
      });
      assert.ok(afterFirst);
      assert.equal((afterFirst!.metadata as any)?.pendingCount, 2);

      await syncPendingChoreNotification(userB.id, 1); // still nonzero, count changes
      const afterSecond = await prisma.notification.findUnique({
        where: { userId_dedupeKey: { userId: userB.id, dedupeKey: "pending-chores" } },
      });
      assert.equal(afterSecond?.id, afterFirst?.id); // same row, updated in place
      assert.equal((afterSecond!.metadata as any)?.pendingCount, 1);

      await syncPendingChoreNotification(userB.id, 0); // back to zero
      const afterThird = await prisma.notification.findUnique({
        where: { userId_dedupeKey: { userId: userB.id, dedupeKey: "pending-chores" } },
      });
      assert.equal(afterThird, null);
    });

    await test("notification timestamps are set by the server", async () => {
      const before = Date.now();
      const n = await createNotification({
        userId: userA.id,
        type: "MEMBER_JOINED",
        title: "x",
        message: "timestamp check",
      });
      const after = Date.now();
      const createdAtMs = n.createdAt.getTime();
      assert.ok(createdAtMs >= before && createdAtMs <= after);
    });
  } finally {
    await prisma.notification.deleteMany({ where: { userId: { in: [userA.id, userB.id] } } });
    await prisma.user.deleteMany({ where: { id: { in: [userA.id, userB.id] } } });
    await prisma.household.deleteMany({ where: { id: household.id } });
    await prisma.$disconnect();
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error("Integration test run crashed:", err);
  process.exitCode = 1;
});
