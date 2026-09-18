import { Request, Response, NextFunction } from "express";
import prisma from "../lib/prisma";
import { sendError } from "../utils/apiError";

// Must run after requireAuth. Loads the user's householdId and their role
// within it, and rejects the request if they haven't created or joined a
// household yet — most routes (chores, chore logs, dashboard) are
// meaningless without one. Attaching `req.role` here means requireOwner
// (middleware/role.ts) doesn't need its own database query.
export async function requireHousehold(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { householdId: true, role: true },
    });

    if (!user) {
      return sendError(res, 401, "User not found");
    }

    if (!user.householdId) {
      return sendError(res, 403, "Join or create a household first");
    }

    req.householdId = user.householdId;
    req.role = user.role;
    next();
  } catch (err) {
    console.error("requireHousehold error:", err);
    return sendError(res, 500, "Something went wrong");
  }
}
