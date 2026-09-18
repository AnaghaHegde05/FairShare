import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { requireHousehold } from "../middleware/household";
import { requireOwner } from "../middleware/role";
import { generateInviteCode } from "../utils/inviteCode";
import { recordActivity } from "../services/activity.service";
import { createNotification } from "../services/notification.service";
import { sendError } from "../utils/apiError";
import { validateHouseholdName, validateInviteCode, validateId } from "../utils/validation";

const router = Router();

const memberSelect = {
  id: true,
  name: true,
  username: true,
  role: true,
} as const;

// POST /api/households
// Creates a new household and makes the requester its first member, with
// the OWNER role (everyone who joins afterwards via invite code becomes
// MEMBER, see /join below).
// Assumption (not specified in README): a user can only belong to one
// household at a time, so this fails if they're already in one.
router.post("/", requireAuth, async (req: Request, res: Response) => {
  try {
    const parsedName = validateHouseholdName(req.body?.name);
    if ("error" in parsedName) {
      return sendError(res, 400, parsedName.error);
    }

    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) {
      return sendError(res, 401, "User not found");
    }
    if (user.householdId) {
      return sendError(res, 409, "You already belong to a household");
    }

    // Invite codes are short (6 chars), so collisions are possible at scale.
    // Retry a few times with a fresh code rather than failing the request.
    let household;
    let attempts = 0;
    while (!household && attempts < 5) {
      try {
        household = await prisma.household.create({
          data: { name: parsedName.value, inviteCode: generateInviteCode() },
        });
      } catch (err: any) {
        if (err.code === "P2002") {
          attempts++;
          continue;
        }
        throw err;
      }
    }

    if (!household) {
      return sendError(res, 500, "Could not generate a unique invite code, try again");
    }

    // Joining the household (as OWNER) and recording the "created the
    // household" activity must succeed together, hence the transaction.
    await prisma.$transaction(async (tx: any) => {
      await tx.user.update({
        where: { id: user.id },
        data: { householdId: household!.id, role: "OWNER" },
      });
      await recordActivity(
        {
          householdId: household!.id,
          userId: user.id,
          type: "HOUSEHOLD_CREATED",
          message: `${user.name} created the household`,
        },
        tx
      );
    });

    return res.status(201).json({ household });
  } catch (err) {
    console.error("Create household error:", err);
    return sendError(res, 500, "Something went wrong creating the household");
  }
});

// POST /api/households/join
// Joins an existing household via invite code. Always joins as MEMBER --
// there is no way to join as OWNER; ownership only ever comes from having
// created the household (see POST / above).
router.post("/join", requireAuth, async (req: Request, res: Response) => {
  try {
    const parsedCode = validateInviteCode(req.body?.inviteCode);
    if ("error" in parsedCode) {
      return sendError(res, 400, parsedCode.error);
    }

    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) {
      return sendError(res, 401, "User not found");
    }
    if (user.householdId) {
      return sendError(res, 409, "You already belong to a household");
    }

    const household = await prisma.household.findUnique({
      where: { inviteCode: parsedCode.value },
    });

    if (!household) {
      return sendError(res, 404, "Invalid invite code");
    }

    // Captured *before* this user joins -- these are exactly the people
    // who should be notified "X joined", and not the joiner themselves.
    const existingMembers = await prisma.user.findMany({
      where: { householdId: household.id },
      select: { id: true },
    });

    // No specific "invited user" to notify at invite time (invite codes,
    // not direct invites) -- so the notification fires here, at join
    // time, to the household's existing members instead.
    await prisma.$transaction(async (tx: any) => {
      await tx.user.update({
        where: { id: user.id },
        data: { householdId: household!.id, role: "MEMBER" },
      });
      await recordActivity(
        {
          householdId: household!.id,
          userId: user.id,
          type: "MEMBER_JOINED",
          message: `${user.name} joined the household`,
        },
        tx
      );
      for (const member of existingMembers) {
        await createNotification(
          {
            userId: member.id,
            type: "MEMBER_JOINED",
            title: "New member",
            message: `${user.name} joined ${household!.name}`,
            metadata: { householdId: household!.id, joinedUserId: user.id },
          },
          tx
        );
      }
    });

    return res.status(200).json({ household });
  } catch (err) {
    console.error("Join household error:", err);
    return sendError(res, 500, "Something went wrong joining the household");
  }
});

// GET /api/households/me
// Returns the requester's household along with its member list (now
// including each member's role) — open to any member, not just the owner;
// per the README, viewing the household is a MEMBER-level permission.
router.get("/me", requireAuth, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) {
      return sendError(res, 401, "User not found");
    }
    if (!user.householdId) {
      return sendError(res, 404, "You don't belong to a household yet");
    }

    const household = await prisma.household.findUnique({
      where: { id: user.householdId },
      include: {
        users: { select: memberSelect },
      },
    });

    if (!household) {
      return sendError(res, 404, "Household not found");
    }

    return res.status(200).json({ household });
  } catch (err) {
    console.error("Get household error:", err);
    return sendError(res, 500, "Something went wrong");
  }
});

// PUT /api/households/me
// Renames the household. Owner-only, per the README ("Owner can: edit
// household"). Backend-enforced via requireOwner -- the frontend hiding
// the rename control from members is a convenience, not the guarantee.
router.put("/me", requireAuth, requireHousehold, requireOwner, async (req: Request, res: Response) => {
  try {
    const parsedName = validateHouseholdName(req.body?.name);
    if ("error" in parsedName) {
      return sendError(res, 400, parsedName.error);
    }

    const household = await prisma.$transaction(async (tx: any) => {
      const updated = await tx.household.update({
        where: { id: req.householdId as string },
        data: { name: parsedName.value },
      });
      await recordActivity(
        {
          householdId: req.householdId as string,
          userId: req.userId as string,
          type: "HOUSEHOLD_UPDATED",
          message: `Household renamed to ${updated.name}`,
        },
        tx
      );
      return updated;
    });

    return res.status(200).json({ household });
  } catch (err) {
    console.error("Update household error:", err);
    return sendError(res, 500, "Something went wrong updating the household");
  }
});

// DELETE /api/households/members/:userId
// Removes a member from the household. Owner-only. The owner cannot
// remove themselves this way (that would leave the household without an
// owner) -- see POST /leave for the self-service path, which has its own
// protection against exactly that.
router.delete(
  "/members/:userId",
  requireAuth,
  requireHousehold,
  requireOwner,
  async (req: Request, res: Response) => {
    try {
      const parsedId = validateId(req.params.userId, "userId");
      if ("error" in parsedId) {
        return sendError(res, 400, parsedId.error);
      }

      if (parsedId.value === req.userId) {
        return sendError(
          res,
          400,
          "Owners can't remove themselves. Leave the household instead (POST /api/households/leave)."
        );
      }

      const member = await prisma.user.findUnique({ where: { id: parsedId.value } });
      // 404, not 403, if the id doesn't exist or belongs to a different
      // household -- so a request can't be used to probe which ids exist
      // elsewhere.
      if (!member || member.householdId !== req.householdId) {
        return sendError(res, 404, "Member not found");
      }

      const household = await prisma.household.findUnique({ where: { id: req.householdId as string } });

      await prisma.$transaction(async (tx: any) => {
        await tx.user.update({
          where: { id: member.id },
          data: { householdId: null, role: "MEMBER" },
        });
        await recordActivity(
          {
            householdId: req.householdId as string,
            userId: req.userId as string,
            type: "MEMBER_REMOVED",
            message: `${member.name} was removed from the household`,
            metadata: { removedUserId: member.id },
          },
          tx
        );
        await createNotification(
          {
            userId: member.id,
            type: "MEMBER_REMOVED",
            title: "Removed from household",
            message: `You were removed from ${household?.name ?? "the household"}`,
            metadata: { householdId: req.householdId as string },
          },
          tx
        );
      });

      return res.status(200).json({ removedUserId: member.id });
    } catch (err) {
      console.error("Remove member error:", err);
      return sendError(res, 500, "Something went wrong removing that member");
    }
  }
);

// POST /api/households/leave
// Self-service departure. Any member can leave -- except an OWNER who
// would leave other members behind with no owner at all. If the owner is
// the household's only member, leaving is allowed. There's no "transfer
// ownership" flow; the owner's only options are "remove everyone else
// first" or "stay."
router.post("/leave", requireAuth, requireHousehold, async (req: Request, res: Response) => {
  try {
    const memberCount = await prisma.user.count({ where: { householdId: req.householdId } });

    if (req.role === "OWNER" && memberCount > 1) {
      return sendError(
        res,
        400,
        "As the owner, you can't leave while other members are still in the household. Remove them first."
      );
    }

    const user = await prisma.user.findUnique({ where: { id: req.userId as string } });

    await prisma.$transaction(async (tx: any) => {
      await tx.user.update({
        where: { id: req.userId as string },
        data: { householdId: null, role: "MEMBER" },
      });
      await recordActivity(
        {
          householdId: req.householdId as string,
          userId: req.userId as string,
          type: "MEMBER_LEFT",
          message: `${user?.name ?? "Someone"} left the household`,
        },
        tx
      );
    });

    return res.status(200).json({ left: true });
  } catch (err) {
    console.error("Leave household error:", err);
    return sendError(res, 500, "Something went wrong leaving the household");
  }
});

export default router;
