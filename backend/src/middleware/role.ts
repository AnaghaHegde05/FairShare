import { Request, Response, NextFunction } from "express";
import { sendError } from "../utils/apiError";

// Flat, two-role permission model (OWNER / MEMBER, see
// schema.prisma). This is deliberately the only permission check in the
// app: no per-action permission table, no hierarchy. Must run after
// requireHousehold, which is what attaches req.role.
//
// `hasOwnerPermission` is pulled out as its own pure function so it can be
// unit-tested without spinning up Express or a database (see
// middleware/role.test.ts).
export function hasOwnerPermission(role: string | undefined): boolean {
  return role === "OWNER";
}

export function requireOwner(req: Request, res: Response, next: NextFunction) {
  if (!hasOwnerPermission(req.role)) {
    return sendError(res, 403, "Owner permission required.");
  }
  next();
}
