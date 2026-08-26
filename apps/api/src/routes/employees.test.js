import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildEmployeeListWhere, employeeCreateSchema, employeeFullName, employeeUpdateSchema,
} from './employees.js'
import { requireRole } from '../middleware/auth.js'
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from '../utils/auditLog.js'

test('Employee validation requires code, first name, and last name', () => {
  const result = employeeCreateSchema.safeParse({})
  assert.equal(result.success, false)
  assert.deepEqual(result.error.issues.map((issue) => issue.path[0]).sort(), ['employeeCode', 'firstName', 'lastName'])
})

test('Employee validation normalizes code and accepts optional contact fields', () => {
  const result = employeeCreateSchema.safeParse({
    employeeCode: ' emp-0001 ', firstName: ' สมชาย ', lastName: ' ใจดี ',
    email: '', phone: '', departmentId: '', hireDate: '',
  })
  assert.equal(result.success, true)
  assert.equal(result.data.employeeCode, 'EMP-0001')
  assert.equal(result.data.firstName, 'สมชาย')
  assert.equal(result.data.email, null)
  assert.equal(result.data.departmentId, null)
  assert.equal(result.data.hireDate, null)
})

test('Employee validation rejects an invalid optional email', () => {
  const result = employeeCreateSchema.safeParse({
    employeeCode: 'EMP-0002', firstName: 'Jane', lastName: 'Doe', email: 'not-an-email',
  })
  assert.equal(result.success, false)
  assert.equal(result.error.issues[0].path[0], 'email')
})

test('Employee update remains partial and full name is deterministic', () => {
  assert.equal(employeeUpdateSchema.safeParse({ position: 'Developer' }).success, true)
  assert.equal(employeeFullName(' สมชาย ', ' ใจดี '), 'สมชาย ใจดี')
})

test('Employee list search covers code, full name, email, and phone', () => {
  const where = buildEmployeeListWhere({ search: 'somchai' })
  assert.equal(where.deletedAt, null)
  assert.deepEqual(where.OR.map((condition) => Object.keys(condition)[0]), ['employeeCode', 'fullName', 'email', 'phone'])
  for (const condition of where.OR) {
    const value = Object.values(condition)[0]
    assert.deepEqual(value, { contains: 'somchai', mode: 'insensitive' })
  }
})

test('Employee list filters active, archived, status, department, and isActive', () => {
  const active = buildEmployeeListWhere({ scope: 'active' })
  const archived = buildEmployeeListWhere({ scope: 'archived' })
  const filtered = buildEmployeeListWhere({ status: 'ON_LEAVE', departmentId: 'department-id', isActive: 'false' })
  assert.equal(active.deletedAt, null)
  assert.deepEqual(archived.deletedAt, { not: null })
  assert.equal(filtered.status, 'ON_LEAVE')
  assert.equal(filtered.departmentId, 'department-id')
  assert.equal(filtered.isActive, false)
})

function mockResponse() {
  return {
    statusCode: null, body: null,
    status(code) { this.statusCode = code; return this },
    json(body) { this.body = body; return this },
  }
}

test('Employee RBAC allows ADMIN and IT_STAFF but rejects EMPLOYEE', () => {
  const middleware = requireRole('ADMIN', 'IT_STAFF')
  for (const role of ['ADMIN', 'IT_STAFF']) {
    let called = false
    middleware({ user: { role } }, mockResponse(), () => { called = true })
    assert.equal(called, true)
  }

  const response = mockResponse()
  middleware({ user: { role: 'EMPLOYEE' } }, response, () => assert.fail('EMPLOYEE must not pass'))
  assert.equal(response.statusCode, 403)
  assert.equal(response.body.success, false)
})

test('Audit dictionaries include Employee restore lifecycle', () => {
  assert.ok(AUDIT_ENTITY_TYPES.includes('Employee'))
  assert.ok(AUDIT_ACTIONS.includes('RESTORE'))
})
