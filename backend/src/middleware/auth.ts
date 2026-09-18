import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../utils/jwt";
import { sendError } from "../utils/apiError";

// Verifies the `Authorization: Bearer <token>` header and attaches the
// decoded userId to the request. Routes further down the chain can trust
// req.userId to identify who's making the request.
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return sendError(res, 401, "Missing or malformed Authorization header");
  }

  const token = authHeader.split(" ")[1];

  try {
    const payload = verifyToken(token);
    req.userId = payload.userId;
    next();
  } catch (err) {
    return sendError(res, 401, "Invalid or expired token");
  }
}
