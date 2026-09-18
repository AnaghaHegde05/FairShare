// Tests for the pure owner-permission check
// (middleware/role.ts). requireOwner itself is a thin Express wrapper
// around hasOwnerPermission; both are exercised here with lightweight
// mock req/res objects instead of a real server, so this runs with plain
// `node`, no database, no Express instance.
import assert from "node:assert/strict";
import { hasOwnerPermission, requireOwner } from "./role";

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
// hasOwnerPermission
// ---------------------------------------------------------------------

test("hasOwnerPermission: true for OWNER", () => {
  assert.equal(hasOwnerPermission("OWNER"), true);
});

test("hasOwnerPermission: false for MEMBER", () => {
  assert.equal(hasOwnerPermission("MEMBER"), false);
});

test("hasOwnerPermission: false for undefined (requireHousehold never ran)", () => {
  assert.equal(hasOwnerPermission(undefined), false);
});

test("hasOwnerPermission: false for an unrecognized/garbage value", () => {
  assert.equal(hasOwnerPermission("SUPERADMIN"), false);
});

// ---------------------------------------------------------------------
// requireOwner (Express middleware wrapper)
// ---------------------------------------------------------------------

function mockRes() {
  const res: any = {
    statusCode: null as number | null,
    body: null as unknown,
  };
  res.status = (code: number) => {
    res.statusCode = code;
    return res;
  };
  res.json = (body: unknown) => {
    res.body = body;
    return res;
  };
  return res;
}

test("requireOwner: calls next() for an OWNER", () => {
  const req: any = { role: "OWNER" };
  const res = mockRes();
  let nextCalled = false;
  requireOwner(req, res, () => {
    nextCalled = true;
  });
  assert.equal(nextCalled, true);
  assert.equal(res.statusCode, null);
});

test("requireOwner: responds 403 with the exact spec'd error shape for a MEMBER", () => {
  const req: any = { role: "MEMBER" };
  const res = mockRes();
  let nextCalled = false;
  requireOwner(req, res, () => {
    nextCalled = true;
  });
  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 403);
  assert.deepEqual(res.body, {
    success: false,
    message: "Owner permission required.",
    error: "Owner permission required.",
  });
});

test("requireOwner: responds 403 (not throws) when role is missing entirely", () => {
  const req: any = {};
  const res = mockRes();
  let nextCalled = false;
  requireOwner(req, res, () => {
    nextCalled = true;
  });
  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 403);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
