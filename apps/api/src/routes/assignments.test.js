import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createSchema, returnInspectionSchema, returnStartSchema, scopeForRead } from './assignments.js'
import {
  assignmentHolderName,
  assignmentHolderScopeForAccount,
} from '../utils/assignmentHelpers.js'
import { AUDIT_ACTIONS } from '../utils/auditLog.js'

const ASSET_ID = 'b155382e-94a0-4f0e-a58c-bd376b30860e'
const EMPLOYEE_ID = 'de60c4f7-4e3f-4534-a635-4148c14a34a3'
const USER_ID = 'ec6070bf-4fa4-4b34-83bc-442ccf83cfe1'

test('new Assignment validation accepts Employee as the business holder', () => {
  const result = createSchema.safeParse({ assetId: ASSET_ID, employeeId: EMPLOYEE_ID })
  assert.equal(result.success, true)
  assert.equal(result.data.employeeId, EMPLOYEE_ID)
})

test('Assignment validation keeps legacy userId input backward compatible', () => {
  const result = createSchema.safeParse({ assetId: ASSET_ID, userId: USER_ID })
  assert.equal(result.success, true)
  assert.equal(result.data.userId, USER_ID)
})

test('Assignment validation rejects a create without any holder identity', () => {
  const result = createSchema.safeParse({ assetId: ASSET_ID })
  assert.equal(result.success, false)
  assert.ok(result.error.issues.some((issue) => issue.path[0] === 'employeeId'))
})

test('unlinked EMPLOYEE Assignment scope remains limited to legacy userId', () => {
  const account = { id: USER_ID, email: 'employee@example.com', role: 'EMPLOYEE' }
  const expected = assignmentHolderScopeForAccount(account)
  assert.deepEqual(scopeForRead(account), expected)
  assert.deepEqual(expected.OR[0], { userId: USER_ID })
  assert.equal(expected.OR.length, 1)
  assert.deepEqual(scopeForRead({ ...account, role: 'ADMIN' }), {})
})

test('EMPLOYEE Assignment scope prefers the explicit Employee relation', () => {
  const account = { id: USER_ID, email: 'employee@example.com', employeeId: EMPLOYEE_ID, role: 'EMPLOYEE' }
  assert.deepEqual(scopeForRead(account), { OR: [{ userId: USER_ID }, { employeeId: EMPLOYEE_ID }] })
})

test('holder display prefers Employee and never crashes on unmapped legacy rows', () => {
  assert.equal(assignmentHolderName({ employee: { fullName: 'สมชาย ใจดี' }, user: { name: 'Old Name' } }), 'สมชาย ใจดี')
  assert.equal(assignmentHolderName({ employee: null, user: { name: 'Legacy User' } }), 'Legacy User')
  assert.equal(assignmentHolderName({ employee: null, user: null }), 'Unknown Employee')
})

test('migration adds nullable Employee relation, preserves userId, and performs safe backfill', async () => {
  const migrationUrl = new URL('../../prisma/migrations/0010_assignment_employee_integration/migration.sql', import.meta.url)
  const sql = await readFile(migrationUrl, 'utf8')
  assert.match(sql, /ADD COLUMN "employeeId" TEXT/)
  assert.match(sql, /ALTER COLUMN "userId" DROP NOT NULL/)
  assert.match(sql, /HAVING COUNT\(\*\) = 1/)
  assert.doesNotMatch(sql, /DROP COLUMN "userId"/)
})

test('return inspection requires notes and physical condition for returned assets', () => {
  const valid = returnInspectionSchema.safeParse({
    status: 'RETURNED', conditionAfter: 'GOOD', inspectionNotes: 'ตรวจอุปกรณ์และอุปกรณ์เสริมครบ',
  })
  assert.equal(valid.success, true)

  const missingCondition = returnInspectionSchema.safeParse({ status: 'RETURNED', inspectionNotes: 'ตรวจแล้ว' })
  assert.equal(missingCondition.success, false)
  assert.ok(missingCondition.error.issues.some((issue) => issue.path[0] === 'conditionAfter'))

  const missingNotes = returnInspectionSchema.safeParse({ status: 'DAMAGED', conditionAfter: 'DAMAGED' })
  assert.equal(missingNotes.success, false)
  assert.ok(missingNotes.error.issues.some((issue) => issue.path[0] === 'inspectionNotes'))
})

test('lost workflow can be inspected without a physical condition', () => {
  assert.equal(returnInspectionSchema.safeParse({ status: 'LOST', inspectionNotes: 'ยืนยันการสูญหายตามรายงาน' }).success, true)
  assert.equal(returnStartSchema.safeParse({}).success, true)
})

test('return migration is expand-only and backfills legacy closed assignments safely', async () => {
  const migrationUrl = new URL('../../prisma/migrations/0013_return_workflow_enhancement/migration.sql', import.meta.url)
  const sql = await readFile(migrationUrl, 'utf8')
  assert.match(sql, /ADD COLUMN "returnStatus"/)
  assert.match(sql, /CREATE TABLE "AssignmentReturnEvent"/)
  assert.match(sql, /WHERE "returnedAt" IS NOT NULL/)
  assert.doesNotMatch(sql, /DROP COLUMN|ALTER COLUMN .*NOT NULL/)
  assert.doesNotMatch(sql, /DROP TYPE "AssignmentStatus"/)
})

test('audit dictionary covers the complete return lifecycle', () => {
  for (const action of ['RETURN_STARTED', 'RETURN_INSPECTED', 'RETURN_COMPLETED', 'RETURN_DAMAGED', 'RETURN_LOST']) {
    assert.ok(AUDIT_ACTIONS.includes(action), `missing ${action}`)
  }
})
