// Augments Express's Request type so `req.userId` is recognized by TypeScript
// after the auth middleware runs.
import "express";

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      householdId?: string;
      // The requester's role within req.householdId, attached
      // by requireHousehold. Only meaningful once requireHousehold has run.
      role?: string;
    }
  }
}

export {};
