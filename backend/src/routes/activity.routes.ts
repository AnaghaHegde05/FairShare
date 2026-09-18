import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/auth";
import { requireHousehold } from "../middleware/household";
import { listActivity } from "../services/activity.service";
import { sendError } from "../utils/apiError";
import { parsePositiveInt } from "../utils/validation";

const router = Router();

// GET /api/activity?limit=20&offset=0
// Household-scoped activity history, newest first. `req.householdId` comes
// from requireHousehold (the authenticated user's own household row) --
// never from the query string -- so there is no way to request another
// household's activity by passing a different id.
router.get("/", requireAuth, requireHousehold, async (req: Request, res: Response) => {
  try {
    const limit = parsePositiveInt(req.query.limit, 20);
    const offset = parsePositiveInt(req.query.offset, 0);

    if (limit === null || limit === 0) {
      return sendError(res, 400, "'limit' must be a positive integer");
    }
    if (offset === null) {
      return sendError(res, 400, "'offset' must be a non-negative integer");
    }

    const page = await listActivity(req.householdId as string, { limit, offset });
    return res.status(200).json(page);
  } catch (err) {
    console.error("List activity error:", err);
    return sendError(res, 500, "Something went wrong fetching activity");
  }
});

export default router;
