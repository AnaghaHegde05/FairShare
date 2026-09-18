// Turns a chore's frequency + a point in time into a stable
// "occurrence" key (e.g. "daily:2026-08-21", "weekly:2026-W34").
//
// Two completions of the same chore with the same period key are the same
// occurrence, and are rejected (see choreLog.routes.ts + the
// `@@unique([choreId, periodKey])` constraint on ChoreLog). This is the
// whole mechanism behind "a chore disappears once done, and reappears
// next daily/weekly cycle" -- no separate scheduling table needed, and
// nothing is ever deleted from ChoreLog.
//
// All bucketing is done in UTC so it's deterministic regardless of the
// server's local timezone.

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function toUTCDateString(date: Date): string {
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
}

// ISO-8601 week number (Monday-start weeks, week 1 = the week containing
// the year's first Thursday). Standard algorithm.
function isoWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7; // Sunday (0) -> 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum); // move to this week's Thursday
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${pad2(weekNum)}`;
}

// 14-day buckets counted from a fixed Monday epoch, so "biweekly" has a
// consistent, deterministic occurrence boundary without needing to know
// when each individual chore was first created.
const BIWEEKLY_EPOCH = Date.UTC(2020, 0, 6); // Monday, 2020-01-06
function biweeklyKey(date: Date): string {
  const daysSinceEpoch = Math.floor((date.getTime() - BIWEEKLY_EPOCH) / 86400000);
  const bucket = Math.floor(daysSinceEpoch / 14);
  return `biweekly:${bucket}`;
}

function monthKey(date: Date): string {
  return `monthly:${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}`;
}

/**
 * Computes the occurrence/period key for a chore completion.
 *
 * @param frequency The chore's `frequency` string (e.g. "daily", "weekly").
 *                   Matching is case-insensitive and trimmed.
 * @param date       The point in time to bucket -- always pass a
 *                   server-generated timestamp (e.g. `new Date()` at the
 *                   moment the completion is recorded), never a value
 *                   supplied by the client.
 */
export function getPeriodKey(frequency: string, date: Date): string {
  const freq = (frequency || "").trim().toLowerCase();

  switch (freq) {
    case "daily":
      return `daily:${toUTCDateString(date)}`;
    case "weekly":
      return `weekly:${isoWeekKey(date)}`;
    case "biweekly":
      return biweeklyKey(date);
    case "monthly":
      return monthKey(date);
    default:
      // "as-needed" and any other/unrecognized frequency: no automatic
      // recurrence. The chore can be completed once; after that it stays
      // completed (no reappearing next day/week) unless someone adds a
      // proper recurrence rule for it later. Simplest behavior that still
      // satisfies "can't complete the same occurrence twice".
      return "once";
  }
}

/** Short, human-readable label for what "this occurrence" means, for UI copy. */
export function getPeriodLabel(frequency: string): string {
  const freq = (frequency || "").trim().toLowerCase();
  switch (freq) {
    case "daily":
      return "today";
    case "weekly":
      return "this week";
    case "biweekly":
      return "this cycle";
    case "monthly":
      return "this month";
    default:
      return "already";
  }
}
