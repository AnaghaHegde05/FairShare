// Integration tests for the household activity system
// (services/activity.service.ts + routes/activity.routes.ts's household
// isolation).
//
// *** How to run this file ***
// Unlike fairness.service.test.ts and notification.util.test.ts (pure
// functions, no dependencies), these tests exercise the real database
// through the real generated Prisma Client:
//   cd backend
//   npx prisma generate
//   npx prisma migrate dev            # applies prisma/migrations/20260826121318_add_activity_and_notifications
//   npx ts-node src/services/activity.service.integration.test.ts
//
// It talks to whatever DATABASE_URL/.env points at -- point that at a
// disposable/local database before running, since it creates and deletes
// real rows (all cleaned up in the `finally` block below).
import assert from "node:assert/strict";
import prisma from "../lib/prisma";
import { recordActivity, listActivity } from "./activity.service";

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
  // Fresh households/users per run so repeated runs don't collide.
  const householdA = await makeHousehold(`Test House A ${Date.now()}`);
  const householdB = await makeHousehold(`Test House B ${Date.now()}`);
  const userA = await makeUser(`Anagha-${Date.now()}`, householdA.id);
  const userB = await makeUser(`Rahul-${Date.now()}`, householdB.id);

  try {
    await test("chore completion creates an activity with the right type and message", async () => {
      const activity = await recordActivity({
        householdId: householdA.id,
        userId: userA.id,
        type: "CHORE_COMPLETED",
        message: `${userA.name} completed Clean Bathroom`,
        metadata: { choreId: "fake-chore-id", effortWeight: 5 },
      });
      assert.equal(activity.type, "CHORE_COMPLETED");
      assert.equal(activity.message, `${userA.name} completed Clean Bathroom`);
    });

    await test("activity belongs to the correct household", async () => {
      const activity = await recordActivity({
        householdId: householdA.id,
        userId: userA.id,
        type: "CHORE_CREATED",
        message: `${userA.name} added Take Trash`,
      });
      assert.equal(activity.householdId, householdA.id);
    });

    await test("activity contains the correct user", async () => {
      const activity = await recordActivity({
        householdId: householdA.id,
        userId: userA.id,
        type: "CHORE_CREATED",
        message: `${userA.name} added Wash Dishes`,
      });
      assert.equal(activity.userId, userA.id);
    });

    await test("activity metadata preserves the effort snapshot", async () => {
      const activity = await recordActivity({
        householdId: householdA.id,
        userId: userA.id,
        type: "CHORE_COMPLETED",
        message: `${userA.name} completed Vacuum`,
        metadata: { choreId: "fake-chore-id-2", effortWeight: 3 },
      });
      assert.equal((activity.metadata as any)?.effortWeight, 3);
    });

    await test("activity ordering is newest first", async () => {
      // Space these out slightly so createdAt ordering is unambiguous.
      const first = await recordActivity({
        householdId: householdA.id,
        userId: userA.id,
        type: "CHORE_CREATED",
        message: "first",
      });
      await new Promise((r) => setTimeout(r, 5));
      const second = await recordActivity({
        householdId: householdA.id,
        userId: userA.id,
        type: "CHORE_CREATED",
        message: "second",
      });
      const page = await listActivity(householdA.id, { limit: 2 });
      assert.equal(page.activities[0].id, second.id);
      assert.equal(page.activities[1].id, first.id);
    });

    await test("pagination respects limit and reports hasMore correctly", async () => {
      // householdA already has several activities from the tests above --
      // ask for a small page and confirm hasMore reflects reality.
      const page = await listActivity(householdA.id, { limit: 1, offset: 0 });
      assert.equal(page.activities.length, 1);
      assert.equal(page.hasMore, true);
    });

    await test("household isolation: household B never sees household A's activity", async () => {
      await recordActivity({
        householdId: householdB.id,
        userId: userB.id,
        type: "CHORE_CREATED",
        message: `${userB.name} added Recycling`,
      });
      const pageA = await listActivity(householdA.id, { limit: 100 });
      const pageB = await listActivity(householdB.id, { limit: 100 });
      assert.ok(pageA.activities.every((a) => !pageB.activities.some((b) => b.id === a.id)));
      assert.ok(pageB.activities.every((a) => a.userId === userB.id));
    });
  } finally {
    // Clean up everything this run created, regardless of pass/fail.
    await prisma.activity.deleteMany({ where: { householdId: { in: [householdA.id, householdB.id] } } });
    await prisma.user.deleteMany({ where: { id: { in: [userA.id, userB.id] } } });
    await prisma.household.deleteMany({ where: { id: { in: [householdA.id, householdB.id] } } });
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
