// Tests for the recurring-chore "occurrence" logic
// (utils/period.ts), which was previously exercised only indirectly (via
// duplicate-completion checks in the integration tests) and had no
// dedicated test of its own. Pure function, explicit `Date` in/`string`
// out -- no database, no wall clock, no mocking needed, so this runs with
// plain `node` like fairness.service.test.ts.
import assert from "node:assert/strict";
import { getPeriodKey, getPeriodLabel } from "./period";

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
// daily
// ---------------------------------------------------------------------

test("daily: same UTC calendar day -> same period key", () => {
  const morning = new Date("2026-08-21T01:00:00Z");
  const evening = new Date("2026-08-21T23:59:00Z");
  assert.equal(getPeriodKey("daily", morning), getPeriodKey("daily", evening));
});

test("daily: crossing a UTC midnight boundary -> different period key", () => {
  const beforeMidnight = new Date("2026-08-21T23:59:00Z");
  const afterMidnight = new Date("2026-08-22T00:01:00Z");
  assert.notEqual(getPeriodKey("daily", beforeMidnight), getPeriodKey("daily", afterMidnight));
});

test("daily: is case-insensitive and trims whitespace", () => {
  const date = new Date("2026-08-21T12:00:00Z");
  assert.equal(getPeriodKey("Daily", date), getPeriodKey("  daily  ", date));
});

// ---------------------------------------------------------------------
// weekly (ISO week, Monday-start)
// ---------------------------------------------------------------------

test("weekly: two days in the same ISO week -> same period key", () => {
  // 2026-08-17 is a Monday, 2026-08-21 is the Friday of the same ISO week.
  const monday = new Date("2026-08-17T08:00:00Z");
  const friday = new Date("2026-08-21T08:00:00Z");
  assert.equal(getPeriodKey("weekly", monday), getPeriodKey("weekly", friday));
});

test("weekly: Sunday and the following Monday -> different period key (week rolls over on Monday)", () => {
  const sunday = new Date("2026-08-23T08:00:00Z");
  const nextMonday = new Date("2026-08-24T08:00:00Z");
  assert.notEqual(getPeriodKey("weekly", sunday), getPeriodKey("weekly", nextMonday));
});

test("weekly: a year boundary near Jan 1 still buckets by ISO week, not just year+day", () => {
  // 2025-12-29 (Mon) through 2026-01-04 (Sun) is a single ISO week
  // (2026-W01) even though it spans two calendar years.
  const dec29 = new Date("2025-12-29T08:00:00Z");
  const jan2 = new Date("2026-01-02T08:00:00Z");
  assert.equal(getPeriodKey("weekly", dec29), getPeriodKey("weekly", jan2));
});

// ---------------------------------------------------------------------
// biweekly (fixed 14-day buckets from a shared epoch)
// ---------------------------------------------------------------------

test("biweekly: two dates within the same 14-day bucket -> same period key", () => {
  const day1 = new Date("2026-08-17T08:00:00Z");
  const day7 = new Date("2026-08-23T08:00:00Z");
  assert.equal(getPeriodKey("biweekly", day1), getPeriodKey("biweekly", day7));
});

test("biweekly: crossing a 14-day bucket boundary -> different period key", () => {
  const lastDayOfBucket = new Date("2026-08-23T08:00:00Z");
  const firstDayOfNextBucket = new Date("2026-08-24T08:00:00Z");
  assert.notEqual(
    getPeriodKey("biweekly", lastDayOfBucket),
    getPeriodKey("biweekly", firstDayOfNextBucket)
  );
});

// ---------------------------------------------------------------------
// monthly
// ---------------------------------------------------------------------

test("monthly: first and last day of the same month -> same period key", () => {
  const firstOfMonth = new Date("2026-02-01T08:00:00Z");
  const lastOfMonth = new Date("2026-02-28T08:00:00Z");
  assert.equal(getPeriodKey("monthly", firstOfMonth), getPeriodKey("monthly", lastOfMonth));
});

test("monthly: crossing a month boundary -> different period key", () => {
  const endOfFeb = new Date("2026-02-28T08:00:00Z");
  const startOfMar = new Date("2026-03-01T08:00:00Z");
  assert.notEqual(getPeriodKey("monthly", endOfFeb), getPeriodKey("monthly", startOfMar));
});

// ---------------------------------------------------------------------
// as-needed / unrecognized frequency
// ---------------------------------------------------------------------

test("as-needed: always the same period key regardless of date (completable once, no recurrence)", () => {
  const now = new Date("2026-08-21T08:00:00Z");
  const muchLater = new Date("2027-01-01T08:00:00Z");
  assert.equal(getPeriodKey("as-needed", now), "once");
  assert.equal(getPeriodKey("as-needed", now), getPeriodKey("as-needed", muchLater));
});

test("unrecognized frequency falls back to the same 'once' bucket as as-needed", () => {
  const now = new Date("2026-08-21T08:00:00Z");
  assert.equal(getPeriodKey("literally anything else", now), "once");
});

// ---------------------------------------------------------------------
// cross-frequency sanity
// ---------------------------------------------------------------------

test("different frequencies for the same date never collide on period key", () => {
  const date = new Date("2026-08-21T08:00:00Z");
  const keys = new Set([
    getPeriodKey("daily", date),
    getPeriodKey("weekly", date),
    getPeriodKey("biweekly", date),
    getPeriodKey("monthly", date),
    getPeriodKey("as-needed", date),
  ]);
  assert.equal(keys.size, 5);
});

// ---------------------------------------------------------------------
// getPeriodLabel
// ---------------------------------------------------------------------

test("getPeriodLabel: returns a distinct, human-readable label per frequency", () => {
  assert.equal(getPeriodLabel("daily"), "today");
  assert.equal(getPeriodLabel("weekly"), "this week");
  assert.equal(getPeriodLabel("biweekly"), "this cycle");
  assert.equal(getPeriodLabel("monthly"), "this month");
  assert.equal(getPeriodLabel("as-needed"), "already");
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
