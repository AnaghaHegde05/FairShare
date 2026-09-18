import { PrismaClient } from "@prisma/client";

// A single shared Prisma Client instance for the whole app.
// Using a fresh PrismaClient per file/module in dev with ts-node-dev's
// hot-reload can exhaust database connections, so we keep one instance here.
const prisma = new PrismaClient();

export default prisma;
