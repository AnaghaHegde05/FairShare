# FairShare — Household Chore Fairness Tracker

A full-stack web app that helps roommates and households track chores
fairly. Instead of a plain to-do list, FairShare weighs chores by effort
and calculates a **fairness score** per person, so contribution disputes
are backed by actual data instead of memory and arguments.

---

## Contents

- [Project Overview](#project-overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Database](#database)
- [Fairness Algorithm](#fairness-algorithm)
- [API](#api)
- [Local Setup](#local-setup)
- [Docker](#docker)
- [Testing](#testing)
- [GitHub Actions](#github-actions)
- [Screenshots](#screenshots)
- [Future Improvements](#future-improvements)
- [Author](#author)

---

## Project Overview

In shared housing, chores get split informally and someone always ends up
feeling like they're doing more. There's no record, no accountability,
and no easy way to prove or disprove it. FairShare logs who did what,
weights tasks by effort (cleaning a bathroom ≠ washing one plate), and
shows each person's contribution relative to their fair share over time —
plus a recommendation for who should take the next chore.

---

## Features

- **Username-based authentication** — signup/login with a hashed
  password and a self-implemented JWT (no third-party auth provider)
- **Household management** — create a household or join an existing one
  via a 6-character invite code
- **OWNER / MEMBER roles** — the household creator is `OWNER` (can rename
  the household and remove members); everyone who joins is `MEMBER`.
  Enforced server-side, not just hidden in the UI
- **Chore management open to everyone** — creating, editing, deleting,
  and completing chores has no owner/member distinction; any household
  member can do all of it
- **Recurring chores** — each chore has a frequency (daily / weekly /
  biweekly / monthly / as-needed); the backend computes which
  "occurrence" is current and only allows one completion per occurrence
- **Effort-weighted contribution** — chores are logged with an effort
  weight (1–5), so a heavy chore counts for more than a quick one
- **Fairness score** — per-member actual contribution vs. their fair
  share, over a selectable time window
- **Next-chore recommendation** — suggests who's furthest behind and
  which pending chore they should take, with a generated explanation
- **Completion history** — a rolling window of who completed what, when
- **Activity timeline** — a per-household feed of chore/member/household
  events
- **In-app notifications** — persistent, per-user, with an unread badge
  (new member joined, pending chores, removed from household, etc.)
- **Validation & consistent error handling** — input validation on both
  ends, and a single `{ success, message }` error shape with correct
  HTTP status codes everywhere in the API

---

## Tech Stack

```text
React
TypeScript
Vite
Tailwind CSS
Node.js
Express
PostgreSQL
Prisma
JWT
Docker
GitHub Actions
```

A couple of smaller but real dependencies worth naming: **React Router**
(client-side routing) and **Recharts** (the fairness bar chart) on the
frontend; **bcryptjs** (password hashing) on the backend.

---

## Architecture

```text
React + TypeScript
        |
      REST API
        |
Express + TypeScript
        |
      Prisma
        |
   PostgreSQL
```

The frontend never talks to the database directly — every request goes
through the Express REST API, which is the only thing that touches
Prisma/PostgreSQL. Auth (JWT) and authorization (household membership,
owner-only actions) are both enforced in Express middleware, in front of
every route that needs them.

---

## Database

Six Prisma models (`backend/prisma/schema.prisma`):

- **User** — `name`, `username` (case-insensitively unique — see
  `usernameLower`), `passwordHash`, `householdId`
  (nullable — a user may belong to no household), `role` (`OWNER` /
  `MEMBER`, only meaningful once they have a household)
- **Household** — `name`, unique `inviteCode`; has many `User`, `Chore`,
  `Activity`
- **Chore** — belongs to a `Household`; `name`, `effortWeight` (1–5),
  `frequency`
- **ChoreLog** — one completion record: `choreId`, `userId`,
  `completedAt`, `effortWeightSnapshot` (the chore's effort weight *at
  completion time*, so a later edit never rewrites history), and
  `periodKey` (which recurring occurrence this is — e.g.
  `daily:2026-08-21`). A unique constraint on `(choreId, periodKey)` is
  what actually stops a chore being completed twice for the same
  occurrence, at the database level
- **Activity** — an append-only per-household event log (`type`,
  `message`, optional `metadata`), written by the backend whenever
  something notable happens (chore created/completed, member joined,
  etc.)
- **Notification** — per-user, persistent, with `readAt` (null = unread)
  and an optional `dedupeKey` so recomputing an already-true condition
  (like "pending chores") doesn't spam duplicates

---

## Fairness Algorithm

Implemented in `backend/src/services/fairness.service.ts` — the single
source of truth for this math (no duplicate implementation anywhere
else).

```text
Contribution = sum of completed chore effort points
Fair Share    = total household effort ÷ number of members
Fairness Score = actual contribution − fair share
```

- Contribution sums each member's `effortWeightSnapshot` across their
  completed chore occurrences in the selected time window — effort-
  weighted, not a chore count.
- Fairness score is positive if a member is above their fair share,
  negative if behind, zero if exactly on track.
- Every household member is included even if they logged nothing
  (`actual = 0`) — being fully idle is itself the signal this tool is
  for.

**Next-chore recommendation** (`buildRecommendation()`):
1. Picks who's next: whoever has the lowest fairness score (furthest
   behind) in the selected window.
2. Deterministic tie-break if that's exactly equal: lower window
   `actual` → lower all-time total contribution → stable `userId`
   comparison. No randomization.
3. Picks which chore: the heaviest-effort chore among the household's
   currently-*pending* chores (not yet completed for their current
   occurrence). Ties broken by older chore, then chore id.
4. Generates a plain-language reason entirely from the computed numbers
   (e.g. "Recommended because Rahul is currently 4 points behind the
   household fair share.") — never a hardcoded name or score.

---

## API

Base URL: `http://localhost:5000`. Every request/response body is JSON.
Errors follow one consistent shape: `{ "success": false, "message":
"..." }`, with the correct HTTP status code (400 invalid input, 401
unauthenticated, 403 unauthorized, 404 not found, 409 duplicate/conflict,
500 unexpected error). No Swagger/OpenAPI — this table is generated from
the actual route files, not invented.

**Auth requirement column:** **None** (no token) · **Authenticated**
(valid JWT) · **Household member** (authenticated + belongs to a
household) · **Owner only** (authenticated + in a household + `role ==
OWNER`, enforced by `backend/src/middleware/role.ts`)

`POST /api/auth/login` deliberately distinguishes the two ways a login
can fail: `404` for a username that isn't registered (message nudges
toward signup), `401` for a registered username with the wrong password.
This trades away hiding which usernames exist — a reasonable call for a
small household app, less so for something higher-stakes.

| Method | Path | Purpose | Auth requirement |
|---|---|---|---|
| GET | `/health` | Health check | None |
| POST | `/api/auth/signup` | Register a new user | None |
| POST | `/api/auth/login` | Log in, get a JWT | None |
| GET | `/api/auth/me` | Get the current authenticated user | Authenticated |
| POST | `/api/households` | Create a household; creator becomes `OWNER` | Authenticated |
| POST | `/api/households/join` | Join a household via invite code; joins as `MEMBER` | Authenticated |
| GET | `/api/households/me` | View the caller's household + member list/roles | Authenticated |
| PUT | `/api/households/me` | Rename the household | Owner only |
| DELETE | `/api/households/members/:userId` | Remove a member | Owner only |
| POST | `/api/households/leave` | Leave the household (blocked for an owner while others remain) | Household member |
| POST | `/api/chores` | Create a chore | Household member |
| GET | `/api/chores` | List chores, each annotated with current-occurrence completion status | Household member |
| PUT | `/api/chores/:id` | Update a chore | Household member |
| DELETE | `/api/chores/:id` | Delete a chore | Household member |
| POST | `/api/chore-logs` | Mark a chore done for its current occurrence | Household member |
| GET | `/api/chore-logs` | Completion history (optional `?since=<ISO date>`) | Household member |
| GET | `/api/dashboard` | Fairness dashboard: contribution/fair-share/score, recommendation, history | Household member |
| GET | `/api/activity` | Household activity feed (optional `?limit=&offset=`) | Household member |
| GET | `/api/notifications` | List the caller's own notifications | Authenticated |
| GET | `/api/notifications/unread-count` | Unread notification count | Authenticated |
| PATCH | `/api/notifications/:id/read` | Mark one notification read | Authenticated |
| PATCH | `/api/notifications/read-all` | Mark all notifications read | Authenticated |

---

## Local Setup

**Backend**
```bash
cd backend
npm install
cp .env.example .env   # fill in DATABASE_URL, DIRECT_URL, JWT_SECRET
npx prisma generate
npx prisma migrate dev
npm run dev
```

**Frontend**
```bash
cd frontend
npm install
npm run dev
```

Backend runs on `http://localhost:5000`, frontend on `http://localhost:5173`.

---

## Docker

For local development without installing Node or PostgreSQL yourself,
`docker-compose.yml` runs all three pieces (PostgreSQL, backend, frontend)
together:

```bash
docker compose up --build
```

The backend container applies any pending Prisma migrations to the
Postgres container automatically on startup (`prisma migrate deploy`, see
`backend/Dockerfile`), so there's no separate migration step to run by
hand. Same ports as running locally: backend on `http://localhost:5000`,
frontend on `http://localhost:5173`.

Every setting has a sensible default, so this works with zero
configuration. To override anything (Postgres credentials, `JWT_SECRET`,
etc.), copy `.env.example` (repo root) to `.env` — Compose loads it
automatically, and it's already covered by `.gitignore`.

This is a local-development setup, not a production/deployment build —
the frontend container runs Vite's own dev server (hot reload included)
rather than a static build. Deployment is intentionally out of scope for
this project (see "Future Improvements").

```bash
docker compose up -d      # start in the background
docker compose down       # stop everything
docker compose down -v    # stop and also delete the Postgres data volume
```

---

## Testing

Backend tests live next to the code they test (`*.test.ts` — pure,
database-free unit tests; `*.integration.test.ts` — need a real Postgres
database). No test framework — each file is a small standalone script
(plain `node:assert`) that prints `PASS`/`FAIL` per case and exits
non-zero on any failure, run via `tsc` then `node`.

**Unit tests — no database required:**
```bash
cd backend
npm test
```
Runs `fairness.service.test.ts`, `notification.util.test.ts`,
`validation.test.ts`, `period.test.ts` (recurring-chore logic), and
`role.test.ts` (owner-permission checks) — 81 cases, all passing.

**Integration tests — require PostgreSQL (`DATABASE_URL` + `JWT_SECRET` set):**
```bash
cd backend
npx prisma generate
npx prisma migrate dev
npm run test:integration
```
Runs `activity.service.integration.test.ts`, `notification.service.
integration.test.ts`, and `permissions.integration.test.ts` (starts the
real Express app and hits it over HTTP), covering registration, login,
household creation/joining, owner vs. member permissions, household
isolation, chore create/update/delete/completion (including duplicate-
completion rejection), and cross-household access attempts.

**Frontend:**
```bash
cd frontend
npm run build
```
No dedicated frontend test suite exists — `npm run build` (`tsc -b &&
vite build`) is the frontend's correctness check.

---

## GitHub Actions

`.github/workflows/ci.yml` runs on every push and pull request:

```text
install backend deps → run backend tests → build backend
    → install frontend deps → build frontend
```

Backend tests here are the DB-free unit suite, so the workflow needs no
database service. The DB-backed integration tests are for local/manual
runs. The workflow fails the run if any step fails — there's no
deployment step.

---

## Screenshots

None are checked into the repo yet. Recommended screenshots to add later
(e.g. under a `docs/screenshots/` folder, linked from here):
- Login / signup
- Household setup (create / join via invite code)
- Chores page
- Fairness dashboard (contribution chart + recommendation)
- Activity feed and notifications

---

## Future Improvements

- Email/push reminders for overdue chores
- A "dispute" flag on a logged chore for accountability
- Export a monthly fairness report as PDF
- Ownership transfer (currently an owner can only leave a household once
  they're its sole member)
- A dedicated frontend test suite
- Deployment (Docker/CI in this repo are for local development and
  automated checks only — deploying FairShare somewhere public is
  deliberately left for later, outside this project's current scope)

---

## Author

**Anagha Hegde**
B.E. Computer Science Engineering, KLE Technological University
