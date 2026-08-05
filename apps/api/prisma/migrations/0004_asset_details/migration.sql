-- Migration ที่สี่: Milestone 3 — Asset Details & Technical Specifications
-- เพิ่มฟิลด์รายละเอียดครุภัณฑ์ให้ตาราง Asset (ข้อมูลการจัดซื้อ / ฮาร์ดแวร์ / เครือข่าย / lifecycle)
--
-- หมายเหตุ: ไม่แก้ไข migration เดิม (0001-0003) — เพิ่ม migration ใหม่เสมอ
-- ทุกคอลัมน์ที่เพิ่มเป็น optional (NULL ได้) ทั้งหมด จึงไม่ต้อง backfill ข้อมูลเดิมเหมือน 0003

-- CreateEnum
CREATE TYPE "AssetCondition" AS ENUM ('NEW', 'GOOD', 'FAIR', 'POOR', 'DAMAGED');

-- AlterTable
ALTER TABLE "Asset" ADD COLUMN     "assetCondition" "AssetCondition",
ADD COLUMN     "cpu" TEXT,
ADD COLUMN     "currency" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "domainName" TEXT,
ADD COLUMN     "graphics" TEXT,
ADD COLUMN     "hostname" TEXT,
ADD COLUMN     "installedDate" TIMESTAMP(3),
ADD COLUMN     "invoiceNumber" TEXT,
ADD COLUMN     "ipAddress" TEXT,
ADD COLUMN     "lastSeenAt" TIMESTAMP(3),
ADD COLUMN     "macAddress" TEXT,
ADD COLUMN     "monitorSize" TEXT,
ADD COLUMN     "operatingSystem" TEXT,
ADD COLUMN     "osVersion" TEXT,
ADD COLUMN     "purchaseDate" TIMESTAMP(3),
ADD COLUMN     "purchasePrice" DOUBLE PRECISION,
ADD COLUMN     "ram" TEXT,
ADD COLUMN     "receivedDate" TIMESTAMP(3),
ADD COLUMN     "remark" TEXT,
ADD COLUMN     "retiredDate" TIMESTAMP(3),
ADD COLUMN     "storage" TEXT,
ADD COLUMN     "supplierReference" TEXT,
ADD COLUMN     "warrantyExpiry" TIMESTAMP(3);
