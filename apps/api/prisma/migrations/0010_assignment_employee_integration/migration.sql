-- v1.1.0 Phase 2 — Assignment Employee Integration
-- Expand first: preserve legacy userId while introducing the Employee business holder.

ALTER TABLE "Assignment" ADD COLUMN "employeeId" TEXT;

-- New assignments may belong to an Employee without a login account. userId remains available
-- for legacy rows and compatibility, but is no longer required at the database level.
ALTER TABLE "Assignment" ALTER COLUMN "userId" DROP NOT NULL;

CREATE INDEX "Assignment_employeeId_idx" ON "Assignment"("employeeId");

ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_employeeId_fkey"
FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill only an unambiguous case-insensitive email match. Duplicate Employee emails are not
-- guessed; those legacy assignments intentionally remain nullable and use the UI fallback.
UPDATE "Assignment" AS assignment
SET "employeeId" = candidate."employeeId"
FROM "User" AS account
JOIN (
  SELECT LOWER("email") AS "emailKey", MIN("id") AS "employeeId"
  FROM "Employee"
  WHERE "email" IS NOT NULL AND BTRIM("email") <> '' AND "deletedAt" IS NULL
  GROUP BY LOWER("email")
  HAVING COUNT(*) = 1
) AS candidate ON LOWER(account."email") = candidate."emailKey"
WHERE assignment."userId" = account."id" AND assignment."employeeId" IS NULL;
