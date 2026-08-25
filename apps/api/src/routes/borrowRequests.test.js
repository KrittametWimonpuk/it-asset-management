import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import {
  borrowRequestApproveSchema, borrowRequestCreateSchema, borrowRequestRejectSchema, buildBorrowRequestListWhere,
} from './borrowRequests.js'
import { borrowRequestScopeForAccount, BORROW_REQUEST_STATUSES } from '../utils/borrowRequestHelpers.js'
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from '../utils/auditLog.js'

const ASSET_ID = 'b155382e-94a0-4f0e-a58c-bd376b30860e'

test('Borrow Request validation requires an asset and meaningful reason', () => {
  const invalid = borrowRequestCreateSchema.safeParse({ assetId: '', reason: 'x' })
  assert.equal(invalid.success, false)
  assert.deepEqual(invalid.error.issues.map((issue) => issue.path[0]).sort(), ['assetId', 'reason'])
  assert.equal(borrowRequestCreateSchema.safeParse({ assetId: ASSET_ID, reason: 'ใช้สำหรับทำงานนอกสถานที่' }).success, true)
})

test('reject requires a reason and all workflow statuses are available', () => {
  assert.equal(borrowRequestRejectSchema.safeParse({ rejectedReason: '' }).success, false)
  assert.equal(borrowRequestRejectSchema.safeParse({ rejectedReason: 'ข้อมูลไม่ครบ', comment: 'ตรวจสอบกับหัวหน้างานแล้ว' }).success, true)
  assert.equal(borrowRequestApproveSchema.safeParse({}).success, true)
  assert.equal(borrowRequestApproveSchema.safeParse({ comment: 'อนุมัติสำหรับโครงการภาคสนาม' }).success, true)
  assert.equal(borrowRequestApproveSchema.safeParse({ comment: 'x'.repeat(1001) }).success, false)
  assert.deepEqual(BORROW_REQUEST_STATUSES, ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'COMPLETED'])
})

test('EMPLOYEE scope uses business identity email while staff can read all', () => {
  const employee = { role: 'EMPLOYEE', email: 'employee@example.com' }
  assert.deepEqual(borrowRequestScopeForAccount(employee), {
    employee: { email: { equals: employee.email, mode: 'insensitive' } },
  })
  assert.deepEqual(borrowRequestScopeForAccount({ role: 'ADMIN' }), {})
})

test('list search covers request, employee, department, asset, and reason', () => {
  const where = buildBorrowRequestListWhere({ search: 'IT-0001', status: 'PENDING' }, { role: 'ADMIN' })
  assert.equal(where.status, 'PENDING')
  assert.equal(where.AND[0].OR.length, 10)
})

test('audit dictionaries include complete Borrow Request lifecycle', () => {
  for (const action of ['BORROW_REQUEST_CREATED', 'BORROW_REQUEST_APPROVED', 'BORROW_REQUEST_REJECTED', 'BORROW_REQUEST_CANCELLED']) {
    assert.ok(AUDIT_ACTIONS.includes(action))
  }
  for (const action of ['APPROVAL_STARTED', 'APPROVAL_APPROVED', 'APPROVAL_REJECTED']) {
    assert.ok(AUDIT_ACTIONS.includes(action))
  }
  assert.ok(AUDIT_ENTITY_TYPES.includes('BorrowRequest'))
})

test('phase 4 migration is expand-only and backfills the approval timeline', async () => {
  const url = new URL('../../prisma/migrations/0012_borrow_request_approval_history/migration.sql', import.meta.url)
  const sql = await readFile(url, 'utf8')
  assert.match(sql, /CREATE TABLE "BorrowRequestApproval"/)
  assert.match(sql, /'STARTED', 'APPROVED', 'REJECTED'/)
  assert.match(sql, /BorrowRequestApproval_borrowRequestId_fkey/)
  assert.match(sql, /INSERT INTO "BorrowRequestApproval"/)
  assert.doesNotMatch(sql, /ALTER TABLE "Assignment"|DROP TABLE|DROP COLUMN/)
})

test('migration creates workflow enum, sequence, foreign keys, and soft delete', async () => {
  const url = new URL('../../prisma/migrations/0011_borrow_request_workflow/migration.sql', import.meta.url)
  const sql = await readFile(url, 'utf8')
  assert.match(sql, /CREATE TYPE "BorrowRequestStatus"/)
  assert.match(sql, /CREATE SEQUENCE "BorrowRequest_requestNumber_seq"/)
  assert.match(sql, /"deletedAt" TIMESTAMP\(3\)/)
  assert.match(sql, /BorrowRequest_employeeId_fkey/)
  assert.match(sql, /BorrowRequest_assetId_fkey/)
  assert.doesNotMatch(sql, /DROP TABLE|DROP COLUMN/)
})
