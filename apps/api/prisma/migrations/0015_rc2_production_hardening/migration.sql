-- v1.1.0 RC2 — expand-only production hardening.
-- Existing columns and legacy email/userId relationships remain available during rollout.

ALTER TYPE "AssetStatus" ADD VALUE IF NOT EXISTS 'LOST';
ALTER TYPE "AssetStatus" ADD VALUE IF NOT EXISTS 'MAINTENANCE';

ALTER TABLE "User" ADD COLUMN "employeeId" TEXT;

-- Backfill only unambiguous active Employee e-mails. Duplicate e-mails are deliberately left
-- unlinked so the migration never chooses the wrong business identity.
WITH unique_employee_email AS (
  SELECT lower("email") AS normalized_email, MIN("id") AS employee_id
  FROM "Employee"
  WHERE "email" IS NOT NULL AND "deletedAt" IS NULL
  GROUP BY lower("email")
  HAVING COUNT(*) = 1
), unique_user_email AS (
  SELECT lower("email") AS normalized_email, MIN("id") AS user_id
  FROM "User"
  GROUP BY lower("email")
  HAVING COUNT(*) = 1
)
UPDATE "User" AS account
SET "employeeId" = mapping.employee_id
FROM unique_employee_email AS mapping, unique_user_email AS safe_account
WHERE account."id" = safe_account.user_id
  AND safe_account.normalized_email = mapping.normalized_email
  AND account."employeeId" IS NULL;

CREATE UNIQUE INDEX "User_employeeId_key" ON "User"("employeeId");
ALTER TABLE "User"
  ADD CONSTRAINT "User_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "Employee"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Notification" ADD COLUMN "dedupeKey" TEXT;
CREATE UNIQUE INDEX "Notification_dedupeKey_key" ON "Notification"("dedupeKey");

CREATE INDEX "Employee_email_idx" ON "Employee"("email");
CREATE INDEX "Employee_email_normalized_active_idx"
  ON "Employee"(lower("email")) WHERE "email" IS NOT NULL AND "deletedAt" IS NULL;
CREATE INDEX "Assignment_expectedReturnDate_idx" ON "Assignment"("expectedReturnDate");
CREATE INDEX "Assignment_returnedAt_expectedReturnDate_deletedAt_idx"
  ON "Assignment"("returnedAt", "expectedReturnDate", "deletedAt");

CREATE TABLE "AuditOutbox" (
  "id" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,
  "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AuditOutbox_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AuditOutbox_processedAt_nextAttemptAt_idx"
  ON "AuditOutbox"("processedAt", "nextAttemptAt");
CREATE INDEX "AuditOutbox_createdAt_idx" ON "AuditOutbox"("createdAt");

ALTER TABLE "AuditLog" ADD COLUMN "outboxId" TEXT;
CREATE UNIQUE INDEX "AuditLog_outboxId_key" ON "AuditLog"("outboxId");
