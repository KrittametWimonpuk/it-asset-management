import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createSchema, scopeForRead } from './assignments.js'
import {
  assignmentHolderName,
  assignmentHolderScopeForAccount,
} from '../utils/assignmentHelpers.js'

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

test('EMPLOYEE Assignment scope covers Employee email and legacy userId', () => {
  const account = { id: USER_ID, email: 'employee@example.com', role: 'EMPLOYEE' }
  const expected = assignmentHolderScopeForAccount(account)
  assert.deepEqual(scopeForRead(account), expected)
  assert.deepEqual(expected.OR[0], { userId: USER_ID })
  assert.deepEqual(expected.OR[1].employee.email, { equals: account.email, mode: 'insensitive' })
  assert.deepEqual(scopeForRead({ ...account, role: 'ADMIN' }), {})
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
