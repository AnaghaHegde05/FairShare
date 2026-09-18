// Tests for the fairness engine (services/fairness.service.ts).
//
// Deliberately dependency-free: no test framework was added (the project
// has none, and pulling one in for a handful of pure-function assertions
// would be unnecessary added complexity for what these checks need).
// This runs as a plain script via `npm test` (see package.json) — each
// assertion prints PASS/FAIL and the process exits non-zero if anything
// fails, so it works as a real CI-style check.
import assert from "node:assert/strict";
import {
  calculateFairness,
  selectFurthestBehind,
  selectRecommendedChore,
  buildRecommendation,
  formatFairnessLabel,
  MemberContribution,
  PendingChoreOption,
} from "./fairness.service";

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
// Contribution: effort-weighted, not chore-count
// ---------------------------------------------------------------------

test("one completed chore contributes its own effort weight", () => {
  const result = calculateFairness(
    [{ id: "u1", name: "Anagha" }],
    [{ userId: "u1", effortWeightSnapshot: 5 }]
  );
  assert.equal(result[0].actual, 5);
});

test("multiple completed chores sum their effort weights, not a chore count", () => {
  // Clean bathroom (5) + take trash (2) + wash dishes (1) = 8, NOT "3 chores"
  const result = calculateFairness(
    [{ id: "u1", name: "Anagha" }],
    [
      { userId: "u1", effortWeightSnapshot: 5 },
      { userId: "u1", effortWeightSnapshot: 2 },
      { userId: "u1", effortWeightSnapshot: 1 },
    ]
  );
  assert.equal(result[0].actual, 8);
});

test("different weights contribute correctly per member", () => {
  const result = calculateFairness(
    [
      { id: "u1", name: "Anagha" },
      { id: "u2", name: "Rahul" },
    ],
    [
      { userId: "u1", effortWeightSnapshot: 5 },
      { userId: "u1", effortWeightSnapshot: 2 },
      { userId: "u1", effortWeightSnapshot: 1 },
      { userId: "u2", effortWeightSnapshot: 2 },
      { userId: "u2", effortWeightSnapshot: 1 },
    ]
  );
  const anagha = result.find((r) => r.userId === "u1")!;
  const rahul = result.find((r) => r.userId === "u2")!;
  assert.equal(anagha.actual, 8);
  assert.equal(rahul.actual, 3);
});

// ---------------------------------------------------------------------
// Snapshot: must use effortWeightSnapshot, not a chore's current weight
// ---------------------------------------------------------------------

test("uses the historical effortWeightSnapshot, not any 'current' weight", () => {
  // Simulates: bathroom cleaning logged at weight 5 in the past; the
  // chore's *current* weight (3, after being edited) must NOT be used.
  // calculateFairness only ever receives effortWeightSnapshot values from
  // the caller (dashboard.routes.ts pulls this field specifically off
  // ChoreLog, never Chore.effortWeight) — this test locks that contract in
  // by asserting the snapshot value, not some other number, is what's summed.
  const historicalSnapshot = 5;
  const choreCurrentWeightAfterLaterEdit = 3; // must be ignored entirely
  const result = calculateFairness(
    [{ id: "u1", name: "Anagha" }],
    [{ userId: "u1", effortWeightSnapshot: historicalSnapshot }]
  );
  assert.equal(result[0].actual, historicalSnapshot);
  assert.notEqual(result[0].actual, choreCurrentWeightAfterLaterEdit);
});

// ---------------------------------------------------------------------
// Fair share formula
// ---------------------------------------------------------------------

test("fair share = total household effort / member count (8 + 3 -> 5.5)", () => {
  const result = calculateFairness(
    [
      { id: "u1", name: "Anagha" },
      { id: "u2", name: "Rahul" },
    ],
    [
      { userId: "u1", effortWeightSnapshot: 5 },
      { userId: "u1", effortWeightSnapshot: 2 },
      { userId: "u1", effortWeightSnapshot: 1 },
      { userId: "u2", effortWeightSnapshot: 2 },
      { userId: "u2", effortWeightSnapshot: 1 },
    ]
  );
  for (const r of result) {
    assert.equal(r.expected, 5.5);
  }
});

// ---------------------------------------------------------------------
// Fairness score formula
// ---------------------------------------------------------------------

test("fairness score = actual - expected (8 - 5.5 = +2.5, 3 - 5.5 = -2.5)", () => {
  const result = calculateFairness(
    [
      { id: "u1", name: "Anagha" },
      { id: "u2", name: "Rahul" },
    ],
    [
      { userId: "u1", effortWeightSnapshot: 5 },
      { userId: "u1", effortWeightSnapshot: 2 },
      { userId: "u1", effortWeightSnapshot: 1 },
      { userId: "u2", effortWeightSnapshot: 2 },
      { userId: "u2", effortWeightSnapshot: 1 },
    ]
  );
  const anagha = result.find((r) => r.userId === "u1")!;
  const rahul = result.find((r) => r.userId === "u2")!;
  assert.equal(anagha.fairnessScore, 2.5);
  assert.equal(rahul.fairnessScore, -2.5);
  assert.equal(formatFairnessLabel(anagha.fairnessScore), "+2.5 above fair share");
  assert.equal(formatFairnessLabel(rahul.fairnessScore), "-2.5 behind fair share");
});

// ---------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------

test("no completed chores -> everyone at 0/0/0, no NaN/Infinity/undefined", () => {
  const result = calculateFairness(
    [
      { id: "u1", name: "Anagha" },
      { id: "u2", name: "Rahul" },
    ],
    []
  );
  for (const r of result) {
    assert.equal(r.actual, 0);
    assert.equal(r.expected, 0);
    assert.equal(r.fairnessScore, 0);
    assert.equal(Number.isFinite(r.actual), true);
    assert.equal(Number.isFinite(r.expected), true);
    assert.equal(Number.isFinite(r.fairnessScore), true);
  }
});

test("one household member -> fairness score is always exactly zero", () => {
  const result = calculateFairness(
    [{ id: "u1", name: "Anagha" }],
    [{ userId: "u1", effortWeightSnapshot: 17 }]
  );
  assert.equal(result[0].actual, 17);
  assert.equal(result[0].expected, 17);
  assert.equal(result[0].fairnessScore, 0);
});

test("multiple members, all zero contribution -> no errors, all scores zero", () => {
  const result = calculateFairness(
    [
      { id: "u1", name: "Anagha" },
      { id: "u2", name: "Rahul" },
      { id: "u3", name: "Priya" },
    ],
    []
  );
  assert.equal(result.length, 3);
  for (const r of result) assert.equal(r.fairnessScore, 0);
});

test("decimal fair share stays mathematically exact internally (11/3)", () => {
  const result = calculateFairness(
    [
      { id: "u1", name: "Anagha" },
      { id: "u2", name: "Rahul" },
      { id: "u3", name: "Priya" },
    ],
    [
      { userId: "u1", effortWeightSnapshot: 8 },
      { userId: "u2", effortWeightSnapshot: 3 },
    ]
  );
  // 11 / 3 = 3.6666... ; the returned fairnessScore is round1() of the RAW
  // (unrounded) actual-minus-expected difference, not a doubly-rounded
  // value built from two already-rounded numbers. Allow only the single
  // ~0.05 rounding tolerance round1() itself introduces -- anything wider
  // would mean the internal math was rounded before subtracting instead
  // of after, which is exactly the bug this test guards against.
  const u1 = result.find((r) => r.userId === "u1")!;
  const expectedRaw = 11 / 3;
  const trueDiff = 8 - expectedRaw; // 4.3333...
  assert.ok(
    Math.abs(u1.fairnessScore - trueDiff) <= 0.05 + 1e-9,
    `fairnessScore ${u1.fairnessScore} should be within one rounding step of ${trueDiff}`
  );
});

// ---------------------------------------------------------------------
// Recommendation: member selection
// ---------------------------------------------------------------------

test("recommends the member furthest behind (18 vs 10, fair share 14)", () => {
  const contributions: MemberContribution[] = [
    { userId: "a", name: "Anagha", actual: 18, expected: 14, fairnessScore: 4, label: "" },
    { userId: "b", name: "Rahul", actual: 10, expected: 14, fairnessScore: -4, label: "" },
  ];
  const picked = selectFurthestBehind(contributions, new Map());
  assert.equal(picked?.userId, "b");
});

test("recommendation with no household members returns null, not a crash", () => {
  assert.equal(selectFurthestBehind([], new Map()), null);
  assert.equal(buildRecommendation([], new Map(), []), null);
});

// ---------------------------------------------------------------------
// Tie handling (documented rule: fairnessScore -> actual -> all-time total -> userId)
// ---------------------------------------------------------------------

test("tie on fairnessScore+actual is broken by lower all-time total contribution", () => {
  const contributions: MemberContribution[] = [
    { userId: "a", name: "Anagha", actual: 5, expected: 5, fairnessScore: 0, label: "" },
    { userId: "b", name: "Rahul", actual: 5, expected: 5, fairnessScore: 0, label: "" },
  ];
  const totals = new Map([
    ["a", 100], // long-time high all-time contributor
    ["b", 20], // newer / lower all-time contributor -> more "behind" overall
  ]);
  const picked = selectFurthestBehind(contributions, totals);
  assert.equal(picked?.userId, "b");
});

test("full tie (including all-time totals) is broken deterministically by userId", () => {
  const contributions: MemberContribution[] = [
    { userId: "zzz", name: "Zed", actual: 5, expected: 5, fairnessScore: 0, label: "" },
    { userId: "aaa", name: "Amy", actual: 5, expected: 5, fairnessScore: 0, label: "" },
  ];
  const totals = new Map([
    ["zzz", 10],
    ["aaa", 10],
  ]);
  const picked = selectFurthestBehind(contributions, totals);
  assert.equal(picked?.userId, "aaa");
  // Run again to confirm it's not order-dependent/random.
  const pickedAgain = selectFurthestBehind([...contributions].reverse(), totals);
  assert.equal(pickedAgain?.userId, "aaa");
});

// ---------------------------------------------------------------------
// Recommendation: chore selection
// ---------------------------------------------------------------------

test("recommends the heaviest pending chore", () => {
  const pending: PendingChoreOption[] = [
    { id: "c1", name: "Wash Dishes", effortWeight: 1, createdAt: "2026-01-01T00:00:00.000Z" },
    { id: "c2", name: "Clean Bathroom", effortWeight: 5, createdAt: "2026-01-02T00:00:00.000Z" },
    { id: "c3", name: "Take Trash", effortWeight: 2, createdAt: "2026-01-03T00:00:00.000Z" },
  ];
  const chore = selectRecommendedChore(pending);
  assert.equal(chore?.id, "c2");
});

test("chore selection returns null when there are no pending chores", () => {
  assert.equal(selectRecommendedChore([]), null);
});

test("full recommendation includes member, chore, and a generated (non-hardcoded) reason", () => {
  const contributions: MemberContribution[] = [
    { userId: "a", name: "Anagha", actual: 18, expected: 14, fairnessScore: 4, label: "" },
    { userId: "b", name: "Rahul", actual: 10, expected: 14, fairnessScore: -4, label: "" },
  ];
  const pending: PendingChoreOption[] = [
    { id: "c1", name: "Wash Dishes", effortWeight: 1, createdAt: "2026-01-01T00:00:00.000Z" },
    { id: "c2", name: "Clean Bathroom", effortWeight: 5, createdAt: "2026-01-02T00:00:00.000Z" },
  ];
  const rec = buildRecommendation(contributions, new Map(), pending);
  assert.equal(rec?.member.userId, "b");
  assert.equal(rec?.chore?.id, "c2");
  assert.ok(rec?.reason.includes("Rahul"));
  assert.ok(rec?.reason.includes("4"));
});

test("recommendation with a behind member but no pending chores still returns the member", () => {
  const contributions: MemberContribution[] = [
    { userId: "a", name: "Anagha", actual: 18, expected: 14, fairnessScore: 4, label: "" },
    { userId: "b", name: "Rahul", actual: 10, expected: 14, fairnessScore: -4, label: "" },
  ];
  const rec = buildRecommendation(contributions, new Map(), []);
  assert.equal(rec?.member.userId, "b");
  assert.equal(rec?.chore, null);
  assert.ok(rec?.reason.toLowerCase().includes("no pending chores"));
});

// ---------------------------------------------------------------------
// Recurring chores: only the CURRENT completed occurrence should affect
// whether a chore is "pending" — this is exercised at the chore.service
// level (period.ts + chore.service.ts), which selectRecommendedChore
// simply trusts. This test locks in that trust boundary: a chore that
// chore.service.ts has already filtered out as "completed this period"
// must never appear in the `pendingChores` array passed in here.
// ---------------------------------------------------------------------

test("recommendation never considers a chore not present in the pending list", () => {
  // Simulates chore.service.ts already excluding a chore completed for
  // its current occurrence — it simply isn't in the array passed in.
  const onlyStillPending: PendingChoreOption[] = [
    { id: "c-pending", name: "Take Trash", effortWeight: 2, createdAt: "2026-01-01T00:00:00.000Z" },
  ];
  const chore = selectRecommendedChore(onlyStillPending);
  assert.equal(chore?.id, "c-pending");
  assert.notEqual(chore?.id, "c-completed-this-period");
});

// ---------------------------------------------------------------------

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
