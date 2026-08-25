-- v1.1.0 Phase 5 — Return Workflow Enhancement
-- Expand-only: AssignmentStatus และ API เดิมยังคงอยู่ ฟิลด์ใหม่ทั้งหมด nullable
CREATE TYPE "ReturnWorkflowStatus" AS ENUM (
  'PENDING_INSPECTION', 'PASSED', 'FAILED', 'RETURNED', 'DAMAGED', 'LOST'
);

CREATE TYPE "ReturnInspectionResult" AS ENUM ('PASSED', 'FAILED');

ALTER TABLE "Assignment"
  ADD COLUMN "returnStatus" "ReturnWorkflowStatus",
  ADD COLUMN "returnStartedAt" TIMESTAMP(3),
  ADD COLUMN "inspectionResult" "ReturnInspectionResult",
  ADD COLUMN "inspectedById" TEXT,
  ADD COLUMN "inspectionNotes" TEXT,
  ADD COLUMN "inspectedAt" TIMESTAMP(3);

CREATE TABLE "AssignmentReturnEvent" (
  "id" TEXT NOT NULL,
  "assignmentId" TEXT NOT NULL,
  "status" "ReturnWorkflowStatus" NOT NULL,
  "actorUserId" TEXT,
  "condition" "AssetCondition",
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AssignmentReturnEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Assignment_returnStatus_idx" ON "Assignment"("returnStatus");
CREATE INDEX "Assignment_inspectedById_idx" ON "Assignment"("inspectedById");
CREATE INDEX "AssignmentReturnEvent_assignmentId_createdAt_idx" ON "AssignmentReturnEvent"("assignmentId", "createdAt");
CREATE INDEX "AssignmentReturnEvent_actorUserId_idx" ON "AssignmentReturnEvent"("actorUserId");
CREATE INDEX "AssignmentReturnEvent_status_createdAt_idx" ON "AssignmentReturnEvent"("status", "createdAt");

ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_inspectedById_fkey"
  FOREIGN KEY ("inspectedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AssignmentReturnEvent" ADD CONSTRAINT "AssignmentReturnEvent_assignmentId_fkey"
  FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssignmentReturnEvent" ADD CONSTRAINT "AssignmentReturnEvent_actorUserId_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill เฉพาะข้อเท็จจริงที่ทราบแน่นอน ไม่สร้าง inspector หรือผลตรวจย้อนหลังขึ้นเอง
UPDATE "Assignment"
SET "returnStatus" = "status"::text::"ReturnWorkflowStatus",
    "returnStartedAt" = "returnedAt",
    "inspectedAt" = "returnedAt"
WHERE "returnedAt" IS NOT NULL AND "status" IN ('RETURNED', 'DAMAGED', 'LOST');

INSERT INTO "AssignmentReturnEvent" ("id", "assignmentId", "status", "condition", "notes", "createdAt")
SELECT gen_random_uuid()::text, "id", "status"::text::"ReturnWorkflowStatus", "conditionAfter", "remark", "returnedAt"
FROM "Assignment"
WHERE "returnedAt" IS NOT NULL AND "status" IN ('RETURNED', 'DAMAGED', 'LOST');
