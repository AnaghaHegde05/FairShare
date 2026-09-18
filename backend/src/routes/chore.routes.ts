import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { requireHousehold } from "../middleware/household";
import { listChoresWithCompletion } from "../services/chore.service";
import { recordActivity } from "../services/activity.service";
import { syncPendingChoreNotificationsForHousehold } from "../services/notification.service";
import { sendError } from "../utils/apiError";
import { validateChoreName, validateEffortWeight, validateFrequency, validateId } from "../utils/validation";

const router = Router();

// POST /api/chores
// Any household member can create a chore -- there's no owner/member
// distinction for chore management, only for household-level actions
// (rename household, remove a member; see routes/household.routes.ts).
router.post("/", requireAuth, requireHousehold, async (req: Request, res: Response) => {
  try {
    const parsedName = validateChoreName(req.body?.name);
    if ("error" in parsedName) {
      return sendError(res, 400, parsedName.error);
    }
    const parsedEffort = validateEffortWeight(req.body?.effortWeight);
    if ("error" in parsedEffort) {
      return sendError(res, 400, parsedEffort.error);
    }
    const parsedFrequency = validateFrequency(req.body?.frequency);
    if ("error" in parsedFrequency) {
      return sendError(res, 400, parsedFrequency.error);
    }

    const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { name: true } });

    // Creating the chore and recording the "added <chore>" activity happen
    // together -- a transaction so a failed activity write can't leave a
    // chore that silently never showed up in the household's history.
    const chore = await prisma.$transaction(async (tx: any) => {
      const created = await tx.chore.create({
        data: {
          name: parsedName.value,
          effortWeight: parsedEffort.value,
          frequency: parsedFrequency.value,
          householdId: req.householdId as string,
        },
      });
      await recordActivity(
        {
          householdId: req.householdId as string,
          userId: req.userId as string,
          type: "CHORE_CREATED",
          message: `${user?.name ?? "Someone"} added ${created.name}`,
          metadata: { choreId: created.id },
        },
        tx
      );
      return created;
    });

    // Best-effort: a brand-new chore is immediately pending, so this is
    // exactly the kind of event that can flip the household from zero to
    // nonzero pending chores. See notification.service.ts for the dedup
    // rule that keeps this from spamming on repeat chore creation.
    try {
      await syncPendingChoreNotificationsForHousehold(req.householdId as string);
    } catch (notifyErr) {
      console.error("Pending-chore notification sync error:", notifyErr);
    }

    return res.status(201).json({ chore });
  } catch (err) {
    console.error("Create chore error:", err);
    return sendError(res, 500, "Something went wrong creating the chore");
  }
});

// GET /api/chores
// Open to any household member (README: "Member can: view chores").
// Each chore also reports whether it's already been
// completed for its *current* occurrence (today for a daily chore, this
// ISO week for a weekly chore, etc.), computed from the server clock --
// never trusted from the client. A chore with `completion: null` is
// pending; one with `completion` set has already been done for this
// occurrence and should be hidden from the "pending" list on the frontend.
// This occurrence logic lives in services/chore.service.ts,
// shared with the dashboard's recommendation engine, so there's only one
// implementation of "is this chore pending right now".
router.get("/", requireAuth, requireHousehold, async (req: Request, res: Response) => {
  try {
    const result = await listChoresWithCompletion(req.householdId as string);
    return res.status(200).json({ chores: result });
  } catch (err) {
    console.error("List chores error:", err);
    return sendError(res, 500, "Something went wrong fetching chores");
  }
});

// PUT /api/chores/:id
// Any household member can edit a chore, same as POST above.
router.put("/:id", requireAuth, requireHousehold, async (req: Request, res: Response) => {
  try {
    const parsedId = validateId(req.params.id, "Chore id");
    if ("error" in parsedId) {
      return sendError(res, 400, parsedId.error);
    }

    const { name, effortWeight, frequency } = req.body ?? {};

    const existing = await prisma.chore.findUnique({ where: { id: parsedId.value } });
    if (!existing || existing.householdId !== req.householdId) {
      return sendError(res, 404, "Chore not found");
    }

    let nextName: string | undefined;
    if (name !== undefined) {
      const parsedName = validateChoreName(name);
      if ("error" in parsedName) {
        return sendError(res, 400, parsedName.error);
      }
      nextName = parsedName.value;
    }

    let nextEffort: number | undefined;
    if (effortWeight !== undefined) {
      const parsedEffort = validateEffortWeight(effortWeight);
      if ("error" in parsedEffort) {
        return sendError(res, 400, parsedEffort.error);
      }
      nextEffort = parsedEffort.value;
    }

    let nextFrequency: string | undefined;
    if (frequency !== undefined) {
      const parsedFrequency = validateFrequency(frequency);
      if ("error" in parsedFrequency) {
        return sendError(res, 400, parsedFrequency.error);
      }
      nextFrequency = parsedFrequency.value;
    }

    const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { name: true } });

    const chore = await prisma.$transaction(async (tx: any) => {
      const updated = await tx.chore.update({
        where: { id: parsedId.value },
        data: {
          ...(nextName !== undefined && { name: nextName }),
          ...(nextEffort !== undefined && { effortWeight: nextEffort }),
          ...(nextFrequency !== undefined && { frequency: nextFrequency }),
        },
      });
      await recordActivity(
        {
          householdId: req.householdId as string,
          userId: req.userId as string,
          type: "CHORE_UPDATED",
          message: `${user?.name ?? "Someone"} updated ${updated.name}`,
          metadata: { choreId: updated.id },
        },
        tx
      );
      return updated;
    });

    return res.status(200).json({ chore });
  } catch (err) {
    console.error("Update chore error:", err);
    return sendError(res, 500, "Something went wrong updating the chore");
  }
});

// DELETE /api/chores/:id
// Any household member can delete a chore, same as POST/PUT above.
router.delete("/:id", requireAuth, requireHousehold, async (req: Request, res: Response) => {
  try {
    const parsedId = validateId(req.params.id, "Chore id");
    if ("error" in parsedId) {
      return sendError(res, 400, parsedId.error);
    }

    const existing = await prisma.chore.findUnique({ where: { id: parsedId.value } });
    if (!existing || existing.householdId !== req.householdId) {
      return sendError(res, 404, "Chore not found");
    }

    const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { name: true } });

    // The chore itself is about to be deleted (cascading its ChoreLog
    // rows too), so the activity's metadata captures the name now rather
    // than referencing a choreId that won't resolve to anything afterward.
    await prisma.$transaction(async (tx: any) => {
      await recordActivity(
        {
          householdId: req.householdId as string,
          userId: req.userId as string,
          type: "CHORE_DELETED",
          message: `${user?.name ?? "Someone"} removed ${existing.name}`,
          metadata: { choreName: existing.name },
        },
        tx
      );
      await tx.chore.delete({ where: { id: parsedId.value } });
    });

    // Best-effort: removing a chore can also drop the household's pending
    // count to zero, which should clear a stale "pending chores"
    // notification the same way completing the last one would.
    try {
      await syncPendingChoreNotificationsForHousehold(req.householdId as string);
    } catch (notifyErr) {
      console.error("Pending-chore notification sync error:", notifyErr);
    }

    return res.status(204).send();
  } catch (err) {
    console.error("Delete chore error:", err);
    return sendError(res, 500, "Something went wrong deleting the chore");
  }
});

export default router;
