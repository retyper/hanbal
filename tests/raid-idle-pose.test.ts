// 장수 고르는 화면의 서기 칸 (raid/idle-pose.ts) — 화면만 · 판 셈 그대로
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { standingCell, standsWithCompanion } from '../src/raid/idle-pose.ts'
import { HAEBI_ANIM as A } from '../src/tune/params.ts'

test('새 방식 띠(덧 띠 있음)는 시간이 흐르면 다른 칸을 돌려준다', () => {
  const p = 'realm/anim-px/gen-haebi.png'
  assert.equal(standsWithCompanion(p), true)
  const cells = new Set<number>()
  for (let t = 0; t < 60; t += 0.05) cells.add(standingCell(p, t, true))
  assert.ok(cells.size > 2)
  assert.ok([...cells].some(c => c >= 20))
})
test('덧 띠를 못 받았으면 본 띠 칸(20 미만)만 쓴다', () => {
  const p = 'realm/anim-px/gen-haebi.png'
  for (let t = 0; t < 60; t += 0.05) assert.ok(standingCell(p, t, false) < 20)
})
test('옛 방식 띠(계획 없음)는 열전과 같은 서기 칸을 idleTime 초마다 돈다', () => {
  const p = 'realm/anim-px/gen-no-such-old-strip.png'
  assert.equal(standsWithCompanion(p), false)
  assert.equal(standingCell(p, 0, false), A.idle[0])
  assert.equal(standingCell(p, A.idleTime * 1.01, false), A.idle[1 % A.idle.length])
})
