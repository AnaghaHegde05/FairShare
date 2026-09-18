// A single shape for every error response the API sends,
// instead of each route inlining its own `res.status(x).json({ error })`.
//
// The response includes both `message` (what the README's spec asks for)
// and `error` (what the existing frontend's lib/api.ts already reads off
// error responses). Keeping both means every route can move
// to this helper without also having to touch every call site on the
// frontend in the same change -- see frontend/src/lib/api.ts, which now
// reads `message` first and falls back to `error` for anything that
// somehow still sends the old shape.
import { Response } from "express";

export function sendError(res: Response, status: number, message: string) {
  return res.status(status).json({ success: false, message, error: message });
}
