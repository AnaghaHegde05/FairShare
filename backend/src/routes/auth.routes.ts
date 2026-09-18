import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import prisma from "../lib/prisma";
import { signToken } from "../utils/jwt";
import { requireAuth } from "../middleware/auth";
import { sendError } from "../utils/apiError";
import { validateUsername, validatePassword, validateName } from "../utils/validation";

const router = Router();
const SALT_ROUNDS = 10;

const userSelect = {
  id: true,
  name: true,
  username: true,
  householdId: true,
} as const;

// POST /api/auth/signup
// Creates a user account. Username + password are required.
// The user has no household yet — that's a separate step
// (POST /api/households or /api/households/join). Role defaults to MEMBER
// at the schema level and only becomes meaningful once they create/join a
// household (see routes/household.routes.ts).
router.post("/signup", async (req: Request, res: Response) => {
  try {
    const { name, username, password } = req.body;

    const parsedName = validateName(name);
    if ("error" in parsedName) {
      return sendError(res, 400, parsedName.error);
    }

    const parsedUsername = validateUsername(username);
    if ("error" in parsedUsername) {
      return sendError(res, 400, parsedUsername.error);
    }

    const parsedPassword = validatePassword(password);
    if ("error" in parsedPassword) {
      return sendError(res, 400, parsedPassword.error);
    }

    const usernameLower = parsedUsername.value.toLowerCase();

    const existingUsername = await prisma.user.findUnique({ where: { usernameLower } });
    if (existingUsername) {
      return sendError(res, 409, "That username is already taken");
    }

    const passwordHash = await bcrypt.hash(parsedPassword.value, SALT_ROUNDS);

    let user;
    try {
      user = await prisma.user.create({
        data: {
          name: parsedName.value,
          username: parsedUsername.value,
          usernameLower,
          passwordHash,
        },
        select: userSelect,
      });
    } catch (err: any) {
      // Race condition: two signups with the same username passed the
      // pre-check above before either had committed. The unique
      // constraint on usernameLower is the real guarantee.
      if (err && err.code === "P2002") {
        return sendError(res, 409, "That username is already taken");
      }
      throw err;
    }

    const token = signToken({ userId: user.id });

    return res.status(201).json({ token, user });
  } catch (err) {
    console.error("Signup error:", err);
    return sendError(res, 500, "Something went wrong during signup");
  }
});

// POST /api/auth/login
router.post("/login", async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    if (!username || typeof username !== "string" || !password || typeof password !== "string") {
      return sendError(res, 400, "Username and password are required");
    }

    const usernameLower = username.trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { usernameLower } });

    // Telling the user their account doesn't exist (rather than a generic
    // "invalid username or password") is a deliberate UX choice here: this
    // is a small household app, not a system where hiding which usernames
    // are registered actually matters. The tradeoff is that someone could
    // probe usernames to see which exist -- an acceptable one for this app.
    if (!user) {
      return sendError(res, 404, "No account found with that username — create one instead?");
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      return sendError(res, 401, "Incorrect password");
    }

    const token = signToken({ userId: user.id });

    return res.status(200).json({
      token,
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        householdId: user.householdId,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    return sendError(res, 500, "Something went wrong during login");
  }
});

// GET /api/auth/me
// Lets the frontend restore session state (who's logged in, do they
// already belong to a household) after a page refresh.
router.get("/me", requireAuth, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: userSelect,
    });

    if (!user) {
      return sendError(res, 404, "User not found");
    }

    return res.status(200).json({ user });
  } catch (err) {
    console.error("Get me error:", err);
    return sendError(res, 500, "Something went wrong");
  }
});

export default router;
