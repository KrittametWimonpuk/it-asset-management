-- v1.1.0 Phase 3 — Borrow Request Workflow
CREATE TYPE "BorrowRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'COMPLETED');

CREATE SEQUENCE "BorrowRequest_requestNumber_seq" START 1;

CREATE TABLE "BorrowRequest" (
  "id" TEXT NOT NULL,
  "requestNumber" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "assetId" TEXT NOT NULL,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expectedReturnDate" TIMESTAMP(3),
  "reason" TEXT NOT NULL,
  "status" "BorrowRequestStatus" NOT NULL DEFAULT 'PENDING',
  "approvedByUserId" TEXT,
  "approvedAt" TIMESTAMP(3),
  "rejectedReason" TEXT,
  "remark" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "BorrowRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BorrowRequest_requestNumber_key" ON "BorrowRequest"("requestNumber");
CREATE INDEX "BorrowRequest_employeeId_idx" ON "BorrowRequest"("employeeId");
CREATE INDEX "BorrowRequest_assetId_idx" ON "BorrowRequest"("assetId");
CREATE INDEX "BorrowRequest_approvedByUserId_idx" ON "BorrowRequest"("approvedByUserId");
CREATE INDEX "BorrowRequest_status_requestedAt_idx" ON "BorrowRequest"("status", "requestedAt");
CREATE INDEX "BorrowRequest_deletedAt_idx" ON "BorrowRequest"("deletedAt");

ALTER TABLE "BorrowRequest" ADD CONSTRAINT "BorrowRequest_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BorrowRequest" ADD CONSTRAINT "BorrowRequest_assetId_fkey"
  FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BorrowRequest" ADD CONSTRAINT "BorrowRequest_approvedByUserId_fkey"
  FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
