-- Household roles (OWNER / MEMBER).
-- Purely additive -- no existing table, column, or row is dropped, and no
-- existing data is deleted.

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('OWNER', 'MEMBER');

-- AlterTable
-- Every existing user starts out as MEMBER (the safe default), then gets
-- corrected below for whoever should actually be OWNER of their household.
ALTER TABLE "users" ADD COLUMN "role" "Role" NOT NULL DEFAULT 'MEMBER';

-- Backfill: since roles didn't exist before this migration, there's no
-- stored "who created this household" flag to read. The closest honest
-- proxy is "the earliest-created member of each household" -- for
-- households created since day one that's exactly the creator, because
-- POST /api/households has always inserted the creator's own membership
-- row in the same request that creates the household. Households with no
-- members are untouched (nothing to promote).
UPDATE "users" u
SET "role" = 'OWNER'
FROM (
  SELECT DISTINCT ON (household_id) id, household_id
  FROM "users"
  WHERE household_id IS NOT NULL
  ORDER BY household_id, created_at ASC, id ASC
) earliest
WHERE u.id = earliest.id;
