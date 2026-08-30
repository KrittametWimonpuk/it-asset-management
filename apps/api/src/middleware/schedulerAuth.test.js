import test from 'node:test'
import assert from 'node:assert/strict'
import { hasValidSchedulerSecret } from './schedulerAuth.js'

const secret = 'scheduler-test-secret-at-least-32-characters'

test('scheduler authorization accepts only the exact bearer secret', () => {
  assert.equal(hasValidSchedulerSecret(`Bearer ${secret}`, secret), true)
  assert.equal(hasValidSchedulerSecret(`Bearer ${secret}x`, secret), false)
  assert.equal(hasValidSchedulerSecret(secret, secret), false)
})

test('scheduler authorization fails closed when secret is absent or too short', () => {
  assert.equal(hasValidSchedulerSecret('Bearer anything', undefined), false)
  assert.equal(hasValidSchedulerSecret('Bearer short', 'short'), false)
})
