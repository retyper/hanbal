import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isCloth } from '../../src/field/viewTint.ts'

test('천(옅은 바탕색)은 물들고 살·갑옷·검은 윤곽은 그대로다', () => {
  assert.equal(isCloth(200, 180, 140), true)   // 베옷
  assert.equal(isCloth(200, 120, 70), false)   // 살 (주황 쪽 채도)
  assert.equal(isCloth(40, 38, 36), false)     // 갑옷·윤곽 (어둡다)
  assert.equal(isCloth(0, 0, 0), false)
})
