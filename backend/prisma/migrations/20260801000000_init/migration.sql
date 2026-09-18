-- Baseline schema: households, users, chores, chore_logs.
--
-- These tables were originally built with `prisma db push` during early
-- development rather than `prisma migrate dev`, so no migration file was
-- ever generated for them (including the chore_logs.period_key column
-- below). Every migration
-- after this one assumes these tables already exist -- on a brand-new
-- database, `add_activity_and_notifications` was the first migration
-- Prisma actually tried to run, and it failed immediately because
-- "households" and "users" didn't exist yet. This migration fills that
-- gap so `prisma migrate deploy` can build the whole schema from nothing
-- (e.g. a fresh `docker compose up`).
--
-- Includes users.email (nullable, unique) even though the app no longer
-- uses it, because `remove_user_email` (the last migration) drops that
-- exact column -- it has to exist here first for that migration to make
-- sense.

-- CreateTable
CREATE TABLE "households" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "invite_code" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "households_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "username_lower" TEXT NOT NULL,
    "email" TEXT,
    "password_hash" TEXT NOT NULL,
    "household_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chores" (
    "id" TEXT NOT NULL,
    "household_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "effort_weight" INTEGER NOT NULL,
    "frequency" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chore_logs" (
    "id" TEXT NOT NULL,
    "chore_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "completed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effort_weight_snapshot" INTEGER NOT NULL,
    "period_key" TEXT NOT NULL,

    CONSTRAINT "chore_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "households_invite_code_key" ON "households"("invite_code");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_lower_key" ON "users"("username_lower");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "chore_logs_chore_id_period_key_key" ON "chore_logs"("chore_id", "period_key");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chores" ADD CONSTRAINT "chores_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chore_logs" ADD CONSTRAINT "chore_logs_chore_id_fkey" FOREIGN KEY ("chore_id") REFERENCES "chores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chore_logs" ADD CONSTRAINT "chore_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
