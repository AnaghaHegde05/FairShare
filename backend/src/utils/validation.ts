// One place for the "is this input even shaped right" rules
// that used to live inline (and slightly differently) in a couple of
// route files. Every function here returns either `{ value }` (the
// cleaned-up value to actually use) or `{ error }` (a message safe to
// send straight back to the client) -- callers just check `"error" in
// result`. Nothing here touches the database; uniqueness checks (username,
// invite code) still happen in the route against Prisma, same as before.

export type ValidationResult<T> = { value: T } | { error: string };

// Username rules: 3-20 characters, letters/
// numbers/underscore only. Uniqueness is case-insensitive but that's
// enforced against `usernameLower` in the route, not here.
const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,20}$/;

export function validateUsername(raw: unknown): ValidationResult<string> {
  if (raw === undefined || raw === null || typeof raw !== "string") {
    return { error: "Username is required" };
  }
  const trimmed = raw.trim();
  if (!USERNAME_PATTERN.test(trimmed)) {
    return {
      error: "Username must be 3-20 characters and can only contain letters, numbers, and underscores",
    };
  }
  return { value: trimmed };
}

const MIN_PASSWORD_LENGTH = 8;
// bcrypt silently ignores anything past 72 bytes -- reject well before
// that instead of accepting input the hash then quietly truncates.
const MAX_PASSWORD_LENGTH = 72;

export function validatePassword(raw: unknown): ValidationResult<string> {
  if (raw === undefined || raw === null || typeof raw !== "string") {
    return { error: "Password is required" };
  }
  if (raw.length < MIN_PASSWORD_LENGTH) {
    return { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` };
  }
  if (raw.length > MAX_PASSWORD_LENGTH) {
    return { error: `Password must be at most ${MAX_PASSWORD_LENGTH} characters` };
  }
  return { value: raw };
}

// Shared shape for "a short, required, human-typed label" -- name,
// household name, chore name. `label` only affects the error message.
function validateShortText(raw: unknown, label: string, maxLength = 100): ValidationResult<string> {
  if (raw === undefined || raw === null || typeof raw !== "string") {
    return { error: `${label} is required` };
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return { error: `${label} is required` };
  }
  if (trimmed.length > maxLength) {
    return { error: `${label} must be ${maxLength} characters or fewer` };
  }
  return { value: trimmed };
}

export function validateName(raw: unknown): ValidationResult<string> {
  return validateShortText(raw, "Name", 100);
}

export function validateHouseholdName(raw: unknown): ValidationResult<string> {
  return validateShortText(raw, "Household name", 100);
}

export function validateChoreName(raw: unknown): ValidationResult<string> {
  return validateShortText(raw, "Chore name", 100);
}

export function validateEffortWeight(value: unknown): ValidationResult<number> {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 5) {
    return { error: "Effort weight must be an integer between 1 and 5" };
  }
  return { value };
}

// Mirrors the frontend's FREQUENCY_OPTIONS (ChoreFormModal.tsx) and the
// set utils/period.ts actually knows how to bucket -- any other value
// falls through to period.ts's "once" bucket, which is a valid but
// unadvertised edge case, so validation keeps requests to the same list
// the UI offers.
const ALLOWED_FREQUENCIES = ["daily", "weekly", "biweekly", "monthly", "as-needed"];

export function validateFrequency(raw: unknown): ValidationResult<string> {
  if (raw === undefined || raw === null || typeof raw !== "string" || !raw.trim()) {
    return { error: "Frequency is required (e.g. 'daily', 'weekly')" };
  }
  const trimmed = raw.trim().toLowerCase();
  if (!ALLOWED_FREQUENCIES.includes(trimmed)) {
    return { error: `Frequency must be one of: ${ALLOWED_FREQUENCIES.join(", ")}` };
  }
  return { value: trimmed };
}

// Invite codes are always generated server-side (utils/inviteCode.ts) as
// 6 characters from a fixed alphabet, uppercased -- so this checks shape,
// not existence (existence is a 404 the route checks against Prisma).
const INVITE_CODE_PATTERN = /^[A-Z0-9]{6}$/;

export function validateInviteCode(raw: unknown): ValidationResult<string> {
  if (raw === undefined || raw === null || typeof raw !== "string" || !raw.trim()) {
    return { error: "Invite code is required" };
  }
  const normalized = raw.trim().toUpperCase();
  if (!INVITE_CODE_PATTERN.test(normalized)) {
    return { error: "Invite code must be 6 characters" };
  }
  return { value: normalized };
}

// Every id in this app (household/user/chore/chore log) is a Prisma
// `@default(uuid())` -- standard UUID shape, any version/variant. This
// catches the common mistakes (missing param, empty string, obviously
// wrong shape like a number or a name typed into an :id slot) before a
// query even runs, rather than surfacing whatever Prisma/Postgres error
// a malformed id would otherwise produce.
const UUID_PATTERN = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export function validateId(raw: unknown, label = "id"): ValidationResult<string> {
  if (raw === undefined || raw === null || typeof raw !== "string" || !raw.trim()) {
    return { error: `${label} is required` };
  }
  if (!UUID_PATTERN.test(raw.trim())) {
    return { error: `${label} is not valid` };
  }
  return { value: raw.trim() };
}

// Shared `limit`/`offset` query-param parsing for every paginated list
// endpoint (notifications, activity). `raw === undefined` returns the
// caller's fallback (so an omitted param just uses the default page
// size/offset); anything else must be a non-negative integer, or this
// returns `null` so the route can respond with a 400.
export function parsePositiveInt(raw: unknown, fallback: number): number | null {
  if (raw === undefined) return fallback;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 0) return null;
  return parsed;
}
