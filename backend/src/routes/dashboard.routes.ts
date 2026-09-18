import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { requireHousehold } from "../middleware/household";
import { calculateFairness, buildRecommendation, PendingChoreOption } from "../services/fairness.service";
import { listChoresWithCompletion, onlyPending } from "../services/chore.service";
import { upsertDedupedNotification, recommendedChoreDedupeKey } from "../services/notification.service";
import { sendError } from "../utils/apiError";

const router = Router();

const DEFAULT_WINDOW_DAYS = 7;
const MAX_WINDOW_DAYS = 365;

function parseWindowDays(raw: unknown): number | null {
  if (raw === undefined) return DEFAULT_WINDOW_DAYS;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > MAX_WINDOW_DAYS) {
    return null;
  }
  return parsed;
}

// GET /api/dashboard?days=7
// Ties together the fairness algorithm with real household data:
//   - loads all household members (so idle members show up as behind, not omitted)
//   - loads chore logs completed within the rolling window
//   - computes each member's actual/expected/fairness score (fairness.service.ts)
//   - Also loads each member's ALL-TIME total (for recommendation
//     tie-breaking only, see selectFurthestBehind) and the household's
//     currently-pending chores (services/chore.service.ts — the same
//     the same occurrence logic GET /api/chores uses), then asks
//     buildRecommendation() who's next, which pending chore, and why.
// The `days` query param drives the rolling window (README calls out 7/30 day
// windows specifically, but any positive integer up to a year is accepted).
//
// Security: `req.householdId` is set by requireHousehold from the
// authenticated user's own row (middleware/household.ts) — never read from
// the request body/query. There is no way for a request to ask for another
// household's dashboard data by supplying a different ID.
router.get("/", requireAuth, requireHousehold, async (req: Request, res: Response) => {
  try {
    const windowDays = parseWindowDays(req.query.days);
    if (windowDays === null) {
      return sendError(res, 400, "'days' must be a positive integer (max 365)");
    }

    const householdId = req.householdId as string;

    const since = new Date();
    since.setDate(since.getDate() - windowDays);

    const household = await prisma.household.findUnique({
      where: { id: householdId },
      include: {
        users: { select: { id: true, name: true } },
      },
    });

    if (!household) {
      return sendError(res, 404, "Household not found");
    }

    // Window-scoped logs drive the contribution/fairness-score numbers.
    const logs = await prisma.choreLog.findMany({
      where: {
        chore: { householdId },
        completedAt: { gte: since },
      },
      include: {
        chore: { select: { id: true, name: true } },
        user: { select: { id: true, name: true } },
      },
      orderBy: { completedAt: "desc" },
    });

    const contributions = calculateFairness(
      household.users,
      logs.map((log: (typeof logs)[number]) => ({
        userId: log.userId,
        effortWeightSnapshot: log.effortWeightSnapshot,
      }))
    );

    // All-time totals (independent of the selected window) — used only as
    // a recommendation tie-breaker, computed via a single grouped
    // aggregate query rather than pulling every historical log into JS.
    const totalsRaw = await prisma.choreLog.groupBy({
      by: ["userId"],
      where: { chore: { householdId } },
      _sum: { effortWeightSnapshot: true },
    });
    const totalsByUserId = new Map<string, number>(
      totalsRaw.map((row: any) => [row.userId, row._sum.effortWeightSnapshot ?? 0])
    );

    // Currently-pending chores (right now, not window-bound) feed the
    // "which chore" half of the recommendation. Reuses the exact same
    // occurrence logic as GET /api/chores — see chore.service.ts.
    const allChores = await listChoresWithCompletion(householdId);
    const pendingChores: PendingChoreOption[] = onlyPending(allChores).map((c) => ({
      id: c.id,
      name: c.name,
      effortWeight: c.effortWeight,
      createdAt: c.createdAt instanceof Date ? c.createdAt.toISOString() : String(c.createdAt),
    }));

    const recommendation = buildRecommendation(contributions, totalsByUserId, pendingChores);

    // Best-effort: notify the recommended member, deduped by exactly which
    // chore occurrence is being recommended (see
    // notification.service.ts::upsertDedupedNotification). Loading this
    // dashboard repeatedly for the same still-current recommendation is a
    // no-op; a genuinely new recommendation (different chore, or the same
    // chore's next occurrence) creates a fresh notification.
    const recommendedChoreId = recommendation?.chore?.id;
    if (recommendation && recommendedChoreId) {
      try {
        const recommendedChore = allChores.find((c) => c.id === recommendedChoreId);
        if (recommendedChore) {
          await upsertDedupedNotification({
            userId: recommendation.member.userId,
            type: "RECOMMENDED_CHORE",
            title: "Recommended chore",
            message: `Your next recommended chore is ${recommendedChore.name}`,
            metadata: { choreId: recommendedChore.id, periodKey: recommendedChore.currentPeriodKey },
            dedupeKey: recommendedChoreDedupeKey(recommendedChore.id, recommendedChore.currentPeriodKey),
          });
        }
      } catch (notifyErr) {
        console.error("Recommended-chore notification error:", notifyErr);
      }
    }

    return res.status(200).json({
      windowDays,
      since: since.toISOString(),
      contributions,
      recommendation: recommendation
        ? {
            member: {
              userId: recommendation.member.userId,
              name: recommendation.member.name,
              actual: recommendation.member.actual,
              expected: recommendation.member.expected,
              fairnessScore: recommendation.member.fairnessScore,
            },
            chore: recommendation.chore
              ? {
                  id: recommendation.chore.id,
                  name: recommendation.chore.name,
                  effortWeight: recommendation.chore.effortWeight,
                }
              : null,
            reason: recommendation.reason,
          }
        : null,
      history: logs.map((log: (typeof logs)[number]) => ({
        id: log.id,
        choreId: log.chore.id,
        choreName: log.chore.name,
        userId: log.user.id,
        userName: log.user.name,
        effortWeightSnapshot: log.effortWeightSnapshot,
        completedAt: log.completedAt,
      })),
    });
  } catch (err) {
    console.error("Dashboard error:", err);
    return sendError(res, 500, "Something went wrong building the dashboard");
  }
});

export default router;
