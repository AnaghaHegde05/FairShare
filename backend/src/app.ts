import express, { Request, Response, NextFunction } from "express";
import cors from "cors";

import authRoutes from "./routes/auth.routes";
import householdRoutes from "./routes/household.routes";
import choreRoutes from "./routes/chore.routes";
import choreLogRoutes from "./routes/choreLog.routes";
import dashboardRoutes from "./routes/dashboard.routes";
import activityRoutes from "./routes/activity.routes";
import notificationRoutes from "./routes/notification.routes";
import { sendError } from "./utils/apiError";

// Pulled out of index.ts so the app can be built (and, in
// tests, started on an ephemeral port) without also being the process's
// entrypoint. index.ts is now just "import this, call .listen()".
export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: process.env.CLIENT_ORIGIN?.split(",") || "http://localhost:5173",
    })
  );
  app.use(express.json());

  // Health check route — confirms the server and env are wired up correctly.
  app.get("/health", (_req: Request, res: Response) => {
    res.status(200).json({
      status: "ok",
      service: "fairshare-backend",
      timestamp: new Date().toISOString(),
    });
  });

  // API routes
  app.use("/api/auth", authRoutes);
  app.use("/api/households", householdRoutes);
  app.use("/api/chores", choreRoutes);
  app.use("/api/chore-logs", choreLogRoutes);
  app.use("/api/dashboard", dashboardRoutes);
  app.use("/api/activity", activityRoutes);
  app.use("/api/notifications", notificationRoutes);

  // 404 fallback for unmatched routes
  app.use((_req: Request, res: Response) => {
    sendError(res, 404, "Route not found");
  });

  // Centralized error handler — a safety net for anything routes didn't
  // catch themselves (e.g. malformed JSON bodies from express.json()).
  // Never forwards err.message/err.stack to the client: that could leak
  // internal details (file paths, query fragments, dependency versions),
  // so the response is always this same generic message regardless of
  // what actually went wrong. The real detail still goes to the server log.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error("Unhandled error:", err);
    sendError(res, 500, "Internal server error");
  });

  return app;
}
