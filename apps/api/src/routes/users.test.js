import test from 'node:test'
import assert from 'node:assert/strict'
import { buildUserListWhere, USER_ROLES, userRoleUpdateSchema } from './users.js'
import { AUDIT_ENTITY_TYPES } from '../utils/auditLog.js'

test('User role validation accepts only supported RBAC roles', () => {
  for (const role of USER_ROLES) assert.equal(userRoleUpdateSchema.safeParse({ role }).success, true)
  assert.equal(userRoleUpdateSchema.safeParse({ role: 'SUPER_ADMIN' }).success, false)
  assert.equal(userRoleUpdateSchema.safeParse({ role: 'ADMIN', unexpected: true }).success, false)
})

test('User list supports role filtering and identity search', () => {
  const where = buildUserListWhere({ role: 'IT_STAFF', search: 'somchai' })
  assert.equal(where.role, 'IT_STAFF')
  assert.equal(where.OR.length, 4)
  assert.deepEqual(Object.keys(where.OR[0]), ['email'])
  assert.deepEqual(Object.keys(where.OR[1]), ['name'])
  assert.deepEqual(Object.keys(where.OR[2]), ['employee'])
  assert.deepEqual(Object.keys(where.OR[3]), ['employee'])
})

test('User remains an auditable entity for role changes', () => {
  assert.ok(AUDIT_ENTITY_TYPES.includes('User'))
})
