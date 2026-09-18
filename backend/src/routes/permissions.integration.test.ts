// Integration tests for roles, permissions, validation, and error
// handling, exercised as real HTTP requests against the actual Express
// app (createApp() from ../app), not by calling service functions
// directly. This matters because permission enforcement lives in the
// middleware chain (requireAuth -> requireHousehold, plus requireOwner in
// front of household-management routes like renaming the household or
// removing a member) sitting in front of the routes, so the routes have
// to actually be hit over HTTP for these tests to mean anything. Chore
// routes (create/edit/delete) do NOT use requireOwner — any household
// member can manage chores; only household-level actions are owner-only.
//
// This deliberately does NOT add a new dependency (no supertest): Node
// 18+ ships a global `fetch`, so the app is started on an ephemeral port
// (`app.listen(0)`) for the duration of this file and torn down at the end.
//
// *** How to run this file ***
// Requires a real PostgreSQL database (DATABASE_URL + JWT_SECRET set):
//   cd backend
//   npx prisma generate
//   npx prisma migrate dev   # applies prisma/migrations/20260830090000_add_user_roles
//   npx ts-node src/routes/permissions.integration.test.ts
//
// It talks to whatever DATABASE_URL/.env points at -- point that at a
// disposable/local database first, since it creates and deletes real rows
// (all cleaned up in the `finally` block below).
import assert from "node:assert/strict";
import { AddressInfo } from "node:net";
import prisma from "../lib/prisma";
import { createApp } from "../app";

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

async function main() {
  const app = createApp();
  const server = app.listen(0);
  const { port } = server.address() as AddressInfo;
  const baseUrl = `http://localhost:${port}`;

  async function call(
    method: string,
    path: string,
    opts: { token?: string; body?: unknown } = {}
  ): Promise<{ status: number; body: any }> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
    const body = await res.json().catch(() => ({}));
    return { status: res.status, body };
  }

  const suffix = Date.now();
  async function signup(username: string, name = username) {
    const res = await call("POST", "/api/auth/signup", {
      body: { name, username, password: "password123" },
    });
    assert.equal(res.status, 201, `signup(${username}) expected 201, got ${res.status}: ${JSON.stringify(res.body)}`);
    return { token: res.body.token as string, user: res.body.user };
  }

  // Two independent households, each with an owner and a member, so
  // isolation tests have somewhere real to fail into.
  const owner = await signup(`owner${suffix}`);
  const member = await signup(`member${suffix}`);
  const otherOwner = await signup(`other${suffix}`);

  const createdUserIds = [owner.user.id, member.user.id, otherOwner.user.id];
  const createdHouseholdIds: string[] = [];

  try {
    let householdId = "";
    let inviteCode = "";
    let otherHouseholdId = "";

    await test("registration: signup returns a token and a safe user object (no password hash)", async () => {
      const res = await call("POST", "/api/auth/signup", {
        body: { name: "Registration Check", username: `regcheck${suffix}`, password: "password123" },
      });
      assert.equal(res.status, 201);
      assert.ok(typeof res.body.token === "string" && res.body.token.length > 0);
      assert.equal(res.body.user.username, `regcheck${suffix}`);
      assert.equal(res.body.user.householdId, null);
      assert.equal("passwordHash" in res.body.user, false);
      assert.equal("password" in res.body.user, false);
      createdUserIds.push(res.body.user.id);
    });

    await test("owner: creating a household assigns OWNER role to the creator", async () => {
      const res = await call("POST", "/api/households", {
        token: owner.token,
        body: { name: `Test House ${suffix}` },
      });
      assert.equal(res.status, 201);
      householdId = res.body.household.id;
      inviteCode = res.body.household.inviteCode;
      createdHouseholdIds.push(householdId);

      const me = await call("GET", "/api/households/me", { token: owner.token });
      const self = me.body.household.users.find((u: any) => u.id === owner.user.id);
      assert.equal(self.role, "OWNER");
    });

    await test("member: joining via invite code assigns MEMBER role", async () => {
      const res = await call("POST", "/api/households/join", {
        token: member.token,
        body: { inviteCode },
      });
      assert.equal(res.status, 200);

      const me = await call("GET", "/api/households/me", { token: member.token });
      const self = me.body.household.users.find((u: any) => u.id === member.user.id);
      assert.equal(self.role, "MEMBER");
    });

    let choreId = "";
    let memberChoreId = "";

    await test("chore permissions: owner can create a chore", async () => {
      const res = await call("POST", "/api/chores", {
        token: owner.token,
        body: { name: "Clean bathroom", effortWeight: 3, frequency: "daily" },
      });
      assert.equal(res.status, 201);
      choreId = res.body.chore.id;
    });

    await test("chore permissions: member can also create a chore (no owner/member distinction for chores)", async () => {
      const res = await call("POST", "/api/chores", {
        token: member.token,
        body: { name: "Member-created chore", effortWeight: 2, frequency: "weekly" },
      });
      assert.equal(res.status, 201);
      memberChoreId = res.body.chore.id;
    });

    await test("chore permissions: member can edit a chore they didn't create", async () => {
      const res = await call("PUT", `/api/chores/${choreId}`, {
        token: member.token,
        body: { name: "Renamed by member" },
      });
      assert.equal(res.status, 200);
      assert.equal(res.body.chore.name, "Renamed by member");
    });

    await test("chore permissions: member can delete a chore", async () => {
      const res = await call("DELETE", `/api/chores/${memberChoreId}`, { token: member.token });
      assert.equal(res.status, 204);
    });

    await test("member permissions: member CAN view chores", async () => {
      const res = await call("GET", "/api/chores", { token: member.token });
      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.body.chores));
    });

    await test("member permissions: member CAN complete a chore", async () => {
      const res = await call("POST", "/api/chore-logs", {
        token: member.token,
        body: { choreId },
      });
      assert.equal(res.status, 201);
      assert.equal(res.body.log.userId, member.user.id);
    });

    await test("duplicate completion: completing the same chore occurrence twice is rejected (409)", async () => {
      const res = await call("POST", "/api/chore-logs", {
        token: member.token,
        body: { choreId },
      });
      assert.equal(res.status, 409);
      assert.equal(res.body.success, false);
    });

    await test("recurring behavior: a completed chore shows as completed for the current occurrence, not just logged", async () => {
      const res = await call("GET", "/api/chores", { token: owner.token });
      assert.equal(res.status, 200);
      const found = res.body.chores.find((c: any) => c.id === choreId);
      assert.ok(found, "chore should still be listed");
      assert.ok(found.completion, "chore should be marked completed for its current (daily) occurrence");
    });

    await test("auth: login with a username that doesn't exist is rejected with 404 (nudges toward signup)", async () => {
      const res = await call("POST", "/api/auth/login", {
        body: { username: `no-such-user-${suffix}`, password: "whatever123" },
      });
      assert.equal(res.status, 404);
      assert.equal(res.body.success, false);
    });

    await test("auth: login with an incorrect password is rejected with 401", async () => {
      const res = await call("POST", "/api/auth/login", {
        body: { username: `owner${suffix}`, password: "totally-wrong-password" },
      });
      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
    });

    await test("chore permissions: owner can also edit and delete a chore", async () => {
      const editRes = await call("PUT", `/api/chores/${choreId}`, {
        token: owner.token,
        body: { name: "Deep clean bathroom" },
      });
      assert.equal(editRes.status, 200);
      assert.equal(editRes.body.chore.name, "Deep clean bathroom");

      const deleteRes = await call("DELETE", `/api/chores/${choreId}`, { token: owner.token });
      assert.equal(deleteRes.status, 204);
    });

    await test("unauthorized access: no token is rejected with 401", async () => {
      const res = await call("GET", "/api/chores");
      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
    });

    await test("unauthorized access: a garbage token is rejected with 401", async () => {
      const res = await call("GET", "/api/chores", { token: "not-a-real-token" });
      assert.equal(res.status, 401);
    });

    await test("invalid input: signup with a too-short username is rejected with 400", async () => {
      const res = await call("POST", "/api/auth/signup", {
        body: { name: "Bad Username", username: "ab", password: "password123" },
      });
      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
    });

    await test("invalid input: signup with a too-short password is rejected with 400", async () => {
      const res = await call("POST", "/api/auth/signup", {
        body: { name: "Bad Password", username: `shortpw${suffix}`, password: "short" },
      });
      assert.equal(res.status, 400);
    });

    await test("invalid input: creating a household with an empty name is rejected with 400", async () => {
      const res = await call("POST", "/api/households", {
        token: otherOwner.token,
        body: { name: "   " },
      });
      assert.equal(res.status, 400);
    });

    await test("invalid input: creating a chore with an out-of-range effort weight is rejected with 400", async () => {
      const res = await call("POST", "/api/chores", {
        token: owner.token,
        body: { name: "Too heavy", effortWeight: 9, frequency: "daily" },
      });
      assert.equal(res.status, 400);
    });

    await test("invalid input: creating a chore with an unrecognized frequency is rejected with 400", async () => {
      const res = await call("POST", "/api/chores", {
        token: owner.token,
        body: { name: "Odd schedule", effortWeight: 2, frequency: "hourly" },
      });
      assert.equal(res.status, 400);
    });

    await test("invalid ids: a malformed chore id in the URL is rejected with 400, not 500", async () => {
      const res = await call("PUT", "/api/chores/not-a-real-id", {
        token: owner.token,
        body: { name: "x" },
      });
      assert.equal(res.status, 400);
    });

    await test("invalid ids: a well-formed but nonexistent chore id 404s", async () => {
      const res = await call("PUT", "/api/chores/6f3b1e2a-4c1b-4a2d-9c3e-1a2b3c4d5e6f", {
        token: owner.token,
        body: { name: "x" },
      });
      assert.equal(res.status, 404);
    });

    await test("duplicate username: signing up twice with the same username (any case) is rejected with 409", async () => {
      const username = `dupe${suffix}`;
      const first = await call("POST", "/api/auth/signup", {
        body: { name: "First", username, password: "password123" },
      });
      assert.equal(first.status, 201);
      createdUserIds.push(first.body.user.id);

      const second = await call("POST", "/api/auth/signup", {
        body: { name: "Second", username: username.toUpperCase(), password: "password123" },
      });
      assert.equal(second.status, 409);
      assert.equal(second.body.success, false);
    });

    await test("household isolation: an owner can't edit/delete another household's chore (404, not leaked)", async () => {
      const otherHousehold = await call("POST", "/api/households", {
        token: otherOwner.token,
        body: { name: `Other House ${suffix}` },
      });
      otherHouseholdId = otherHousehold.body.household.id;
      createdHouseholdIds.push(otherHouseholdId);

      const otherChore = await call("POST", "/api/chores", {
        token: otherOwner.token,
        body: { name: "Not yours", effortWeight: 1, frequency: "daily" },
      });
      const otherChoreId = otherChore.body.chore.id;

      // `owner` is authenticated and a household member, just not of
      // *this* household -- the chore lookup must still reject it as not
      // found. Chore routes no longer check role at all, but they always
      // must check that the chore actually belongs to req.householdId.
      const editAttempt = await call("PUT", `/api/chores/${otherChoreId}`, {
        token: owner.token,
        body: { name: "Hijacked" },
      });
      assert.equal(editAttempt.status, 404);

      // And the list endpoint must never mix the two households' chores
      // together, in either direction. (The original `choreId` chore was
      // already deleted by the owner-permissions test above, so create a
      // fresh household-A chore here to compare against.)
      const householdAChore = await call("POST", "/api/chores", {
        token: owner.token,
        body: { name: "Household A only", effortWeight: 2, frequency: "weekly" },
      });
      const householdAChoreId = householdAChore.body.chore.id;

      const ownerChores = await call("GET", "/api/chores", { token: owner.token });
      assert.ok(!ownerChores.body.chores.some((c: any) => c.id === otherChoreId));

      const otherOwnerChores = await call("GET", "/api/chores", { token: otherOwner.token });
      assert.ok(!otherOwnerChores.body.chores.some((c: any) => c.id === householdAChoreId));
    });

    await test("owner protection: owner cannot leave while other members remain", async () => {
      const res = await call("POST", "/api/households/leave", { token: owner.token });
      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
    });

    await test("owner protection: owner cannot remove themselves via the member-removal endpoint", async () => {
      const res = await call("DELETE", `/api/households/members/${owner.user.id}`, {
        token: owner.token,
      });
      assert.equal(res.status, 400);
    });

    await test("member permissions: member cannot remove another member (owner-only action)", async () => {
      const res = await call("DELETE", `/api/households/members/${owner.user.id}`, {
        token: member.token,
      });
      assert.equal(res.status, 403);
    });

    await test("owner: household name edit is owner-only and validated", async () => {
      const memberAttempt = await call("PUT", "/api/households/me", {
        token: member.token,
        body: { name: "Renamed by member" },
      });
      assert.equal(memberAttempt.status, 403);

      const badName = await call("PUT", "/api/households/me", {
        token: owner.token,
        body: { name: "" },
      });
      assert.equal(badName.status, 400);

      const ok = await call("PUT", "/api/households/me", {
        token: owner.token,
        body: { name: "Renamed Household" },
      });
      assert.equal(ok.status, 200);
      assert.equal(ok.body.household.name, "Renamed Household");
    });

    await test("owner: can remove a member, after which the owner can leave alone", async () => {
      const removeRes = await call("DELETE", `/api/households/members/${member.user.id}`, {
        token: owner.token,
      });
      assert.equal(removeRes.status, 200);

      // Removed member should no longer see the household.
      const memberMe = await call("GET", "/api/households/me", { token: member.token });
      assert.equal(memberMe.status, 404);

      // Now the sole remaining member, the owner is free to leave.
      const leaveRes = await call("POST", "/api/households/leave", { token: owner.token });
      assert.equal(leaveRes.status, 200);
    });

    await test("sanity: existing auth flow (signup/login/me) still works end to end", async () => {
      const login = await call("POST", "/api/auth/login", {
        body: { username: `owner${suffix}`, password: "password123" },
      });
      assert.equal(login.status, 200);
      const me = await call("GET", "/api/auth/me", { token: login.body.token });
      assert.equal(me.status, 200);
      assert.equal(me.body.user.username, `owner${suffix}`);
    });
  } finally {
    // Clean up everything this run created, regardless of pass/fail.
    await prisma.choreLog.deleteMany({ where: { chore: { householdId: { in: createdHouseholdIds } } } });
    await prisma.chore.deleteMany({ where: { householdId: { in: createdHouseholdIds } } });
    await prisma.activity.deleteMany({ where: { householdId: { in: createdHouseholdIds } } });
    await prisma.notification.deleteMany({ where: { userId: { in: createdUserIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.household.deleteMany({ where: { id: { in: createdHouseholdIds } } });
    await prisma.$disconnect();
    server.close();
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
