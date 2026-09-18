-- Removes the optional `email` column and its unique index from `users`.
--
-- This field was collected at signup but nothing in the app
-- ever sent mail to it -- no verification email, no notification email,
-- no password-reset email. Username is the app's actual identifier and
-- login field; `email` was unused, incomplete functionality, so it's
-- being dropped rather than finished.
--
-- Destructive: any email addresses stored in existing rows are lost.
-- That's fine here -- the column was never read by any code path.

-- DropIndex
DROP INDEX IF EXISTS "users_email_key";

-- AlterTable
ALTER TABLE "users" DROP COLUMN IF EXISTS "email";
