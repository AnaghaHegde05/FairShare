import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { requireHousehold } from "../middleware/household";
import { getPeriodKey } from "../utils/period";
import { recordActivity } from "../services/activity.service";
import { syncPendingChoreNotificationsForHousehold } from "../services/notification.service";
import { sendError } from "../utils/apiError";
import { validateId } from "../utils/validation";

const router = Router();

// POST /api/chore-logs
// Marks a chore as done ("Mark Done"). Open to any household member --
// README: "Member can: complete chores" -- no requireOwner here.
// Enforced here, server-side, regardless of what the
// frontend sends or disables:
//   - the requester must be authenticated and belong to a household
//     (requireAuth + requireHousehold)
//   - the chore must actually belong to that household (checked below,
//     not trusted from the request body)
//   - the same occurrence of the chore (today, for a daily chore; this
//     ISO week, for a weekly chore; etc.) can only be completed once --
//     enforced by computing `periodKey` from the chore's frequency and the
//     *server's* clock, then relying on the DB-level
//     `@@unique([choreId, periodKey])` constraint so even two
//     near-simultaneous requests can't both succeed
//   - who/when/how-much is entirely server-recorded: `userId` comes from
//     the verified JWT, `completedAt` is the database's own default(now()),
//     and `effortWeightSnapshot` is copied from the chore row just looked
//     up -- none of these are ever read from the request body.
router.post("/", requireAuth, requireHousehold, async (req: Request, res: Response) => {
  try {
    const parsedChoreId = validateId(req.body?.choreId, "choreId");
    if ("error" in parsedChoreId) {
      return sendError(res, 400, parsedChoreId.error);
    }

    const chore = await prisma.chore.findUnique({ where: { id: parsedChoreId.value } });
    if (!chore || chore.householdId !== req.householdId) {
      return sendError(res, 404, "Chore not found");
    }

    const now = new Date();
    const periodKey = getPeriodKey(chore.frequency, now);

    // Friendly pre-check (not the actual guarantee -- see the unique
    // constraint below -- but avoids a generic 500 in the common case of
    // someone double-tapping "Mark Done" before the button disables).
    const alreadyDone = await prisma.choreLog.findUnique({
      where: { choreId_periodKey: { choreId: chore.id, periodKey } },
    });
    if (alreadyDone) {
      return sendError(res, 409, "This chore has already been marked done for the current period.");
    }

    let log;
    try {
      // Complete chore -> Create ChoreLog -> Create Activity, all in one
      // transaction: if the activity write somehow failed, we don't want
      // a completion that's missing from the household's history, and if
      // the completion itself fails (the race below) there must be no
      // activity entry for it at all.
      log = await prisma.$transaction(async (tx: any) => {
        const created = await tx.choreLog.create({
          data: {
            choreId: chore.id,
            userId: req.userId as string,
            effortWeightSnapshot: chore.effortWeight,
            periodKey,
          },
          include: {
            chore: { select: { name: true } },
            user: { select: { id: true, name: true } },
          },
        });
        await recordActivity(
          {
            householdId: req.householdId as string,
            userId: created.userId,
            type: "CHORE_COMPLETED",
            message: `${created.user.name} completed ${created.chore.name}`,
            metadata: { choreId: chore.id, effortWeight: created.effortWeightSnapshot },
          },
          tx
        );
        return created;
      });
    } catch (err: any) {
      // Race condition: two requests for the same chore/occurrence passed
      // the pre-check above before either had committed. The unique
      // constraint on (choreId, periodKey) is what actually stops the
      // second write; Prisma surfaces that as error code P2002.
      if (err && err.code === "P2002") {
        return sendError(res, 409, "This chore has already been marked done for the current period.");
      }
      throw err;
    }

    // Best-effort: re-check the household's pending-chore count for every
    // member now that one occurrence just got completed, so a completion
    // that empties the pending list clears any stale "You have N pending
    // chores" notification. See notification.service.ts for why this is
    // safe to call repeatedly without spamming duplicates.
    try {
      await syncPendingChoreNotificationsForHousehold(req.householdId as string);
    } catch (notifyErr) {
      // Never let a notification housekeeping failure turn a successful
      // chore completion into an error response.
      console.error("Pending-chore notification sync error:", notifyErr);
    }

    return res.status(201).json({ log });
  } catch (err) {
    console.error("Create chore log error:", err);
    return sendError(res, 500, "Something went wrong logging the chore");
  }
});

// GET /api/chore-logs?since=<ISO date>
// Lists the household's chore logs, most recent first. `since` is optional
// and lets the caller scope to a rolling window (used by the
// fairness calculation and the history view).
router.get("/", requireAuth, requireHousehold, async (req: Request, res: Response) => {
  try {
    const { since } = req.query;

    let completedAtFilter: { gte?: Date } | undefined;
    if (typeof since === "string") {
      const sinceDate = new Date(since);
      if (isNaN(sinceDate.getTime())) {
        return sendError(res, 400, "Invalid 'since' date");
      }
      completedAtFilter = { gte: sinceDate };
    }

    const logs = await prisma.choreLog.findMany({
      where: {
        chore: { householdId: req.householdId },
        ...(completedAtFilter && { completedAt: completedAtFilter }),
      },
      include: {
        chore: { select: { name: true } },
        user: { select: { id: true, name: true } },
      },
      orderBy: { completedAt: "desc" },
    });

    return res.status(200).json({ logs });
  } catch (err) {
    console.error("List chore logs error:", err);
    return sendError(res, 500, "Something went wrong fetching chore logs");
  }
});

export default router;
