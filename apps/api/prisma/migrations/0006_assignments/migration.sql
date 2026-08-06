-- Migration ที่หก: Milestone 5 — Asset Assignment & Lifecycle
-- สร้างตาราง Assignment (ประวัติการมอบหมาย/รับคืนครุภัณฑ์) พร้อม enum AssignmentStatus
--
-- หมายเหตุ: ไม่แก้ไข migration เดิม (0001-0005) — เพิ่ม migration ใหม่เสมอ
--
-- "ผู้ถือครองปัจจุบัน" ของ asset = แถว Assignment ล่าสุดที่ returnedAt IS NULL AND deletedAt IS NULL
-- (แทนที่ Asset.ownerId ซึ่งตอนนี้ deprecated แล้ว — ดูคอมเมนต์ที่ schema.prisma)

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('ASSIGNED', 'RETURNED', 'LOST', 'DAMAGED');

-- AlterTable
-- ลบ DEFAULT ของ User.updatedAt ทิ้ง — ตอน 0005_rbac ใส่ DEFAULT CURRENT_TIMESTAMP ไว้แค่ backfill
-- แถวเก่าตอนเพิ่มคอลัมน์ ตอนนี้ backfill เสร็จแล้วและ @updatedAt ถูกจัดการที่ชั้น Prisma Client อยู่แล้ว
-- ไม่จำเป็นต้องมี DEFAULT ที่ระดับ DB อีกต่อไป
ALTER TABLE "User" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "Assignment" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assignedById" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expectedReturnDate" TIMESTAMP(3),
    "returnedAt" TIMESTAMP(3),
    "status" "AssignmentStatus" NOT NULL DEFAULT 'ASSIGNED',
    "conditionBefore" "AssetCondition",
    "conditionAfter" "AssetCondition",
    "remark" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Assignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Assignment_assetId_deletedAt_idx" ON "Assignment"("assetId", "deletedAt");

-- CreateIndex
CREATE INDEX "Assignment_userId_idx" ON "Assignment"("userId");

-- CreateIndex
CREATE INDEX "Assignment_assignedById_idx" ON "Assignment"("assignedById");

-- CreateIndex
CREATE INDEX "Assignment_status_idx" ON "Assignment"("status");

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ห้าม asset ชิ้นเดียวกันมี assignment ที่ "active" (returnedAt IS NULL, deletedAt IS NULL)
-- พร้อมกันเกิน 1 แถว — บังคับที่ระดับ DB กันเงื่อนไข race condition หลุดผ่านการเช็กฝั่ง backend
-- (แพทเทิร์นเดียวกับ partial unique index ของชื่อ master data ใน 0003_master_data)
CREATE UNIQUE INDEX "Assignment_active_per_asset_key" ON "Assignment"("assetId") WHERE "returnedAt" IS NULL AND "deletedAt" IS NULL;
