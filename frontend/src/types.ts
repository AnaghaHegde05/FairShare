// Shapes mirror the backend's Prisma models and route response payloads
// (see backend/src/routes/*.ts). Kept in one file since the frontend is
// small enough that a separate package/schema layer isn't warranted yet.

export interface User {
  id: string;
  name: string;
  username: string;
  householdId: string | null;
}

// Household roles. Flat, two-value: OWNER (the household's
// creator) or MEMBER (everyone who joined via invite code). See
// backend/src/middleware/role.ts for how this is enforced server-side —
// the frontend only ever uses this to decide what to *show*, never as the
// actual security boundary.
export type HouseholdRole = "OWNER" | "MEMBER";

export interface Household {
  id: string;
  name: string;
  inviteCode: string;
  createdAt?: string;
  users?: HouseholdMember[];
}

export interface HouseholdMember {
  id: string;
  name: string;
  username: string;
  role: HouseholdRole;
}

// Completion info for the chore's *current* occurrence (today for
// a daily chore, this ISO week for a weekly chore, etc). `null` means the
// chore is pending for this occurrence; present means it's done and should
// not be shown as pending until the next occurrence starts.
export interface ChoreCompletion {
  id: string;
  userId: string;
  userName: string;
  completedAt: string;
  effortWeightSnapshot: number;
}

export interface Chore {
  id: string;
  householdId: string;
  name: string;
  effortWeight: number;
  frequency: string;
  createdAt: string;
  // Set by GET /api/chores (not present on other responses).
  currentPeriodKey?: string;
  periodLabel?: string;
  completion?: ChoreCompletion | null;
}

export interface ChoreLog {
  id: string;
  choreId: string;
  userId: string;
  completedAt: string;
  effortWeightSnapshot: number;
  chore?: { name: string };
  user?: { id: string; name: string };
}

// Mirrors backend/src/services/fairness.service.ts `MemberContribution`.
export interface MemberContribution {
  userId: string;
  name: string;
  actual: number;
  expected: number;
  fairnessScore: number;
  label: string;
}

// Mirrors one entry of `history` in GET /api/dashboard.
export interface DashboardHistoryEntry {
  id: string;
  choreId: string;
  choreName: string;
  userId: string;
  userName: string;
  effortWeightSnapshot: number;
  completedAt: string;
}

// Mirrors backend/src/services/fairness.service.ts `Recommendation`.
export interface RecommendedChore {
  id: string;
  name: string;
  effortWeight: number;
}

export interface RecommendationMember {
  userId: string;
  name: string;
  actual: number;
  expected: number;
  fairnessScore: number;
}

export interface Recommendation {
  member: RecommendationMember;
  chore: RecommendedChore | null;
  reason: string;
}

// Full shape of GET /api/dashboard?days=7|30 (see backend/src/routes/dashboard.routes.ts).
export interface DashboardResponse {
  windowDays: number;
  since: string;
  contributions: MemberContribution[];
  recommendation: Recommendation | null;
  history: DashboardHistoryEntry[];
}

// Mirrors backend/src/services/activity.service.ts's ActivityPage.
export interface ActivityEntry {
  id: string;
  type: string;
  message: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  userId: string | null;
  userName: string | null;
}

export interface ActivityPageResponse {
  activities: ActivityEntry[];
  hasMore: boolean;
}

// Mirrors backend/src/services/notification.service.ts's NotificationPage.
export interface NotificationEntry {
  id: string;
  type: string;
  title: string;
  message: string;
  metadata: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationPageResponse {
  notifications: NotificationEntry[];
  unreadCount: number;
  hasMore: boolean;
}
