-- v1.1.0 Phase 4 — Approval Workflow Enhancement
-- Expand-only migration: adds an append-only approval timeline without changing Assignment.
CREATE TYPE "BorrowRequestApprovalAction" AS ENUM ('STARTED', 'APPROVED', 'REJECTED');

CREATE TABLE "BorrowRequestApproval" (
  "id" TEXT NOT NULL,
  "borrowRequestId" TEXT NOT NULL,
  "action" "BorrowRequestApprovalAction" NOT NULL,
  "actorUserId" TEXT,
  "comment" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BorrowRequestApproval_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BorrowRequestApproval_borrowRequestId_createdAt_idx"
  ON "BorrowRequestApproval"("borrowRequestId", "createdAt");
CREATE INDEX "BorrowRequestApproval_actorUserId_idx"
  ON "BorrowRequestApproval"("actorUserId");
CREATE INDEX "BorrowRequestApproval_action_createdAt_idx"
  ON "BorrowRequestApproval"("action", "createdAt");

ALTER TABLE "BorrowRequestApproval" ADD CONSTRAINT "BorrowRequestApproval_borrowRequestId_fkey"
  FOREIGN KEY ("borrowRequestId") REFERENCES "BorrowRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BorrowRequestApproval" ADD CONSTRAINT "BorrowRequestApproval_actorUserId_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill existing requests. The submitter is matched by Employee/User email where possible;
-- older rejected requests did not store a reviewer, so actorUserId remains NULL for those rows.
INSERT INTO "BorrowRequestApproval" ("id", "borrowRequestId", "action", "actorUserId", "createdAt")
SELECT gen_random_uuid()::text, br."id", 'STARTED', u."id", br."requestedAt"
FROM "BorrowRequest" br
JOIN "Employee" e ON e."id" = br."employeeId"
LEFT JOIN "User" u ON LOWER(u."email") = LOWER(e."email")
WHERE br."deletedAt" IS NULL;

INSERT INTO "BorrowRequestApproval" ("id", "borrowRequestId", "action", "actorUserId", "createdAt")
SELECT gen_random_uuid()::text, br."id", 'APPROVED', br."approvedByUserId", br."approvedAt"
FROM "BorrowRequest" br
WHERE br."deletedAt" IS NULL AND br."approvedAt" IS NOT NULL;

INSERT INTO "BorrowRequestApproval" ("id", "borrowRequestId", "action", "comment", "createdAt")
SELECT gen_random_uuid()::text, br."id", 'REJECTED', br."rejectedReason", br."updatedAt"
FROM "BorrowRequest" br
WHERE br."deletedAt" IS NULL AND br."status" = 'REJECTED';
