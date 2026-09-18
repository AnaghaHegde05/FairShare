// This file deliberately imports from notification.util.ts, not
// notification.service.ts -- the latter imports lib/prisma.ts, which
// instantiates a real PrismaClient at module load time, so it can only be
// exercised against a real database. Those behaviors (dedup at the DB
// constraint level, read/unread, authorization) are covered by
// services/notification.service.integration.test.ts instead (see that
// file's header for how to run it).
import assert from "node:assert/strict";
import { recommendedChoreDedupeKey, formatPendingChoresMessage } from "./notification.util";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`PASS: ${name}`);
  } catch (err) {
    failed++;
    console.error(`FAIL: ${name}`);
    console.error(err);
  }
}

// ---------------------------------------------------------------------
// recommendedChoreDedupeKey
// ---------------------------------------------------------------------

test("dedupe key encodes both the chore id and the occurrence's period key", () => {
  const key = recommendedChoreDedupeKey("chore-1", "weekly:2026-W34");
  assert.equal(key, "recommended:chore-1:weekly:2026-W34");
});

test("dedupe key changes when the chore changes (same period)", () => {
  const a = recommendedChoreDedupeKey("chore-1", "weekly:2026-W34");
  const b = recommendedChoreDedupeKey("chore-2", "weekly:2026-W34");
  assert.notEqual(a, b);
});

test("dedupe key changes when the occurrence rolls to a new period (same chore)", () => {
  const a = recommendedChoreDedupeKey("chore-1", "weekly:2026-W34");
  const b = recommendedChoreDedupeKey("chore-1", "weekly:2026-W35");
  assert.notEqual(a, b);
});

test("dedupe key is identical for the same chore + same occurrence, called twice", () => {
  const a = recommendedChoreDedupeKey("chore-1", "daily:2026-08-26");
  const b = recommendedChoreDedupeKey("chore-1", "daily:2026-08-26");
  assert.equal(a, b);
});

// ---------------------------------------------------------------------
// formatPendingChoresMessage — pluralization
// ---------------------------------------------------------------------

test("singular: exactly one pending chore", () => {
  assert.equal(formatPendingChoresMessage(1), "You have 1 pending chore");
});

test("plural: multiple pending chores", () => {
  assert.equal(formatPendingChoresMessage(3), "You have 3 pending chores");
});

test("plural wording is also used for zero (defensive -- callers never invoke this with 0 in practice, see syncPendingChoreNotification)", () => {
  assert.equal(formatPendingChoresMessage(0), "You have 0 pending chores");
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
