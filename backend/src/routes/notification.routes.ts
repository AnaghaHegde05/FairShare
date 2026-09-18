import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/auth";
import {
  listNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
} from "../services/notification.service";
import { sendError } from "../utils/apiError";
import { validateId, parsePositiveInt } from "../utils/validation";

const router = Router();

// GET /api/notifications?limit=20&offset=0
// Always scoped to req.userId (from the verified JWT via requireAuth) --
// never to an id from the query string -- so a user can only ever see
// their own notifications.
router.get("/", requireAuth, async (req: Request, res: Response) => {
  try {
    const limit = parsePositiveInt(req.query.limit, 20);
    const offset = parsePositiveInt(req.query.offset, 0);

    if (limit === null || limit === 0) {
      return sendError(res, 400, "'limit' must be a positive integer");
    }
    if (offset === null) {
      return sendError(res, 400, "'offset' must be a non-negative integer");
    }

    const page = await listNotifications(req.userId as string, { limit, offset });
    return res.status(200).json(page);
  } catch (err) {
    console.error("List notifications error:", err);
    return sendError(res, 500, "Something went wrong fetching notifications");
  }
});

// GET /api/notifications/unread-count
// Cheap, frequent-poll-friendly endpoint used by the notification bell
// badge without pulling the full notification list every time.
router.get("/unread-count", requireAuth, async (req: Request, res: Response) => {
  try {
    const unreadCount = await getUnreadCount(req.userId as string);
    return res.status(200).json({ unreadCount });
  } catch (err) {
    console.error("Get unread count error:", err);
    return sendError(res, 500, "Something went wrong fetching the unread count");
  }
});

// PATCH /api/notifications/:id/read
// Marks one notification as read. markNotificationRead only returns a row
// when it exists AND belongs to req.userId -- so changing the :id in the
// URL to someone else's notification 404s instead of succeeding.
router.patch("/:id/read", requireAuth, async (req: Request, res: Response) => {
  try {
    const parsedId = validateId(req.params.id, "Notification id");
    if ("error" in parsedId) {
      return sendError(res, 400, parsedId.error);
    }
    const notification = await markNotificationRead(parsedId.value, req.userId as string);
    if (!notification) {
      return sendError(res, 404, "Notification not found");
    }
    return res.status(200).json({ notification });
  } catch (err) {
    console.error("Mark notification read error:", err);
    return sendError(res, 500, "Something went wrong updating the notification");
  }
});

// PATCH /api/notifications/read-all
router.patch("/read-all", requireAuth, async (req: Request, res: Response) => {
  try {
    const count = await markAllNotificationsRead(req.userId as string);
    return res.status(200).json({ updated: count });
  } catch (err) {
    console.error("Mark all notifications read error:", err);
    return sendError(res, 500, "Something went wrong updating notifications");
  }
});

export default router;
