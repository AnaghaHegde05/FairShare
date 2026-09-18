import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = "7d";

// Fail fast if JWT_SECRET is missing rather than silently signing tokens
// with `undefined`, which would make every token verifiable by anyone.
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not set. Add it to backend/.env");
}

export interface TokenPayload {
  userId: string;
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET as string, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, JWT_SECRET as string) as TokenPayload;
}
