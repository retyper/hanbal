import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bakeLayout } from '../../src/field/viewArt.ts'

test('구운 띠: 폭이 한도 아래로 접히고 칸이 모자라지 않는다', () => {
  // 폭 8760 = 칸 438 × 20 · 높이 128 을 높이 70 으로 줄임
  const l = bakeLayout(438, 128, 20, 70, 4096)
  assert.equal(l.fh, 70)
  assert.ok(l.cols * l.fw <= 4096)
  assert.ok(l.cols * l.rows >= 20)
  assert.ok(l.cols * l.fw * l.rows * l.fh < 8760 * 128, '원본보다 화소가 줄었다')
})

test('구운 띠: 원본보다 크게 키우지 않고, 아주 넓은 칸도 한 줄은 들어간다', () => {
  assert.equal(bakeLayout(200, 100, 20, 500, 4096).fh, 100)
  const w = bakeLayout(5000, 100, 4, 100, 4096)
  assert.equal(w.cols, 1)
  assert.equal(w.rows, 4)
})

test('덧띠(8칸)도 같은 길로 접힌다', () => {
  const l = bakeLayout(300, 128, 8, 64, 1024)
  assert.ok(l.cols * l.fw <= 1024 && l.cols * l.rows >= 8)
})
