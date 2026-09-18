// Tests for the pure, DB-free validation helpers
// (utils/validation.ts). Same style as fairness.service.test.ts and
// notification.util.test.ts: no test framework, plain assertions run via
// `node`, PASS/FAIL printed per case. Safe to run without a database.
import assert from "node:assert/strict";
import {
  validateUsername,
  validatePassword,
  validateName,
  validateHouseholdName,
  validateChoreName,
  validateEffortWeight,
  validateFrequency,
  validateInviteCode,
  validateId,
  parsePositiveInt,
} from "./validation";

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
// validateUsername
// ---------------------------------------------------------------------

test("username: accepts a valid 3-20 char alnum/underscore username", () => {
  const result = validateUsername("anagha_05");
  assert.ok("value" in result);
  assert.equal((result as { value: string }).value, "anagha_05");
});

test("username: trims surrounding whitespace", () => {
  const result = validateUsername("  anagha05  ");
  assert.ok("value" in result);
  assert.equal((result as { value: string }).value, "anagha05");
});

test("username: rejects too short (< 3 chars)", () => {
  const result = validateUsername("ab");
  assert.ok("error" in result);
});

test("username: rejects too long (> 20 chars)", () => {
  const result = validateUsername("a".repeat(21));
  assert.ok("error" in result);
});

test("username: rejects special characters", () => {
  const result = validateUsername("ana-gha!");
  assert.ok("error" in result);
});

test("username: rejects missing input", () => {
  const result = validateUsername(undefined);
  assert.ok("error" in result);
});

test("username: rejects non-string input", () => {
  const result = validateUsername(12345);
  assert.ok("error" in result);
});

// ---------------------------------------------------------------------
// validatePassword
// ---------------------------------------------------------------------

test("password: accepts an 8+ char password", () => {
  const result = validatePassword("longenough");
  assert.ok("value" in result);
});

test("password: rejects under 8 characters", () => {
  const result = validatePassword("short1");
  assert.ok("error" in result);
});

test("password: rejects over 72 characters (bcrypt truncation limit)", () => {
  const result = validatePassword("a".repeat(73));
  assert.ok("error" in result);
});

test("password: rejects missing input", () => {
  const result = validatePassword(undefined);
  assert.ok("error" in result);
});

// ---------------------------------------------------------------------
// validateName / validateHouseholdName / validateChoreName
// ---------------------------------------------------------------------

test("name: trims and accepts a normal name", () => {
  const result = validateName("  Anagha  ");
  assert.ok("value" in result);
  assert.equal((result as { value: string }).value, "Anagha");
});

test("name: rejects empty/whitespace-only input", () => {
  const result = validateName("   ");
  assert.ok("error" in result);
});

test("name: rejects over 100 characters", () => {
  const result = validateName("a".repeat(101));
  assert.ok("error" in result);
});

test("household name: rejects empty input", () => {
  const result = validateHouseholdName("");
  assert.ok("error" in result);
});

test("chore name: accepts a normal chore name", () => {
  const result = validateChoreName("Clean bathroom");
  assert.ok("value" in result);
});

// ---------------------------------------------------------------------
// validateEffortWeight
// ---------------------------------------------------------------------

test("effort weight: accepts integers 1 through 5", () => {
  for (let i = 1; i <= 5; i++) {
    assert.ok("value" in validateEffortWeight(i), `expected ${i} to be valid`);
  }
});

test("effort weight: rejects 0", () => {
  assert.ok("error" in validateEffortWeight(0));
});

test("effort weight: rejects 6", () => {
  assert.ok("error" in validateEffortWeight(6));
});

test("effort weight: rejects non-integers", () => {
  assert.ok("error" in validateEffortWeight(2.5));
});

test("effort weight: rejects non-numbers", () => {
  assert.ok("error" in validateEffortWeight("3"));
});

// ---------------------------------------------------------------------
// validateFrequency
// ---------------------------------------------------------------------

test("frequency: accepts each allowed value", () => {
  for (const f of ["daily", "weekly", "biweekly", "monthly", "as-needed"]) {
    assert.ok("value" in validateFrequency(f), `expected ${f} to be valid`);
  }
});

test("frequency: is case-insensitive", () => {
  const result = validateFrequency("DAILY");
  assert.ok("value" in result);
  assert.equal((result as { value: string }).value, "daily");
});

test("frequency: rejects an unrecognized value", () => {
  assert.ok("error" in validateFrequency("hourly"));
});

test("frequency: rejects missing input", () => {
  assert.ok("error" in validateFrequency(undefined));
});

// ---------------------------------------------------------------------
// validateInviteCode
// ---------------------------------------------------------------------

test("invite code: accepts a 6-char code and uppercases it", () => {
  const result = validateInviteCode("7f3k9q");
  assert.ok("value" in result);
  assert.equal((result as { value: string }).value, "7F3K9Q");
});

test("invite code: rejects wrong length", () => {
  assert.ok("error" in validateInviteCode("ABC"));
});

test("invite code: rejects missing input", () => {
  assert.ok("error" in validateInviteCode(undefined));
});

// ---------------------------------------------------------------------
// validateId
// ---------------------------------------------------------------------

test("id: accepts a well-formed UUID", () => {
  const result = validateId("6f3b1e2a-4c1b-4a2d-9c3e-1a2b3c4d5e6f");
  assert.ok("value" in result);
});

test("id: rejects a non-UUID string", () => {
  assert.ok("error" in validateId("not-a-real-id"));
});

test("id: rejects an empty string", () => {
  assert.ok("error" in validateId(""));
});

test("id: rejects missing input", () => {
  assert.ok("error" in validateId(undefined));
});

// ---------------------------------------------------------------------
// parsePositiveInt
// ---------------------------------------------------------------------

test("parsePositiveInt: missing input falls back to the given default", () => {
  assert.equal(parsePositiveInt(undefined, 20), 20);
});

test("parsePositiveInt: accepts zero", () => {
  assert.equal(parsePositiveInt("0", 20), 0);
});

test("parsePositiveInt: accepts a positive integer, including as a string (query params arrive as strings)", () => {
  assert.equal(parsePositiveInt("15", 20), 15);
  assert.equal(parsePositiveInt(15, 20), 15);
});

test("parsePositiveInt: rejects a negative number", () => {
  assert.equal(parsePositiveInt("-1", 20), null);
});

test("parsePositiveInt: rejects a non-integer", () => {
  assert.equal(parsePositiveInt("1.5", 20), null);
});

test("parsePositiveInt: rejects a non-numeric string", () => {
  assert.equal(parsePositiveInt("abc", 20), null);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
