import { test } from 'node:test'
import assert from 'node:assert/strict'
import { dotsOf, dotDied, resetForm, rowOfDot, rowCount, stepDots } from '../../src/field/viewForm.ts'

const none = new Set<number>()
const extent = (d: ReturnType<typeof dotsOf>, f: (k: number) => number, dead: ReadonlySet<number> = none): number => {
  let lo = Infinity, hi = -Infinity
  for (let k = 0; k < d.N; k++) if (!dead.has(k)) { lo = Math.min(lo, f(k)); hi = Math.max(hi, f(k)) }
  return hi - lo
}

test('방진은 흩어짐보다 촘촘하고 줄이 선다 · 돌격은 앞이 뾰족하다', () => {
  resetForm()
  const auto = dotsOf(1, 16, 0, 1, 0, none)
  const hold = dotsOf(2, 16, 2, 1, 0, none)
  assert.ok(extent(hold, k => hold.cv[k]!) < extent(auto, k => auto.cv[k]!), '방진이 옆으로 더 좁다')
  assert.equal(rowCount(hold), 3)
  const wedge = dotsOf(3, 16, 1, 1, 0, none)
  let front = 0
  for (let k = 0; k < 16; k++) if (rowOfDot(wedge, k) === 0) front++
  assert.equal(front, 1, '쐐기의 맨 앞은 한 명')
  // 앞(face +1)이 오른쪽: 맨 앞 점의 du 가 가장 크다
  let best = -1
  for (let k = 0; k < 16; k++) if (best < 0 || wedge.cu[k]! > wedge.cu[best]!) best = k
  assert.equal(rowOfDot(wedge, best), 0)
})

test('자세가 바뀌면 0.3초쯤에 걸쳐 모인다 (점마다 늦게 · 한꺼번에 미끄러지지 않는다)', () => {
  resetForm()
  const d = dotsOf(5, 16, 0, 1, 0, none)
  const h = dotsOf(5, 16, 2, 1, 1000, none)
  stepDots(h, 5, none, 1000)
  const t0 = []
  for (let k = 0; k < 16; k++) t0.push(h.cv[k]!)
  stepDots(h, 5, none, 1050)
  let moved = 0
  for (let k = 0; k < 16; k++) if (h.cv[k] !== t0[k]) moved++
  assert.ok(moved < 16, '시작이 어긋난다')
  for (let t = 1100; t <= 1700; t += 50) stepDots(h, 5, none, t)
  for (let k = 0; k < 16; k++) assert.ok(h.gap[k]! < 0.1, `점 ${k} 이 자리에 앉았다`)
  assert.equal(d, h)
})

test('점이 쓰러지면 300ms 뒤 뒷줄 점이 한 칸 나선다', () => {
  resetForm()
  const dead = new Set<number>()
  const d = dotsOf(7, 16, 2, 1, 0, dead)
  stepDots(d, 7, dead, 0)
  let k0 = -1
  for (let k = 0; k < 16; k++) if (rowOfDot(d, k) === 0) { k0 = k; break }
  const s0 = d.slot[k0]!
  dead.add(k0); dotDied(d, k0, 100)
  stepDots(d, 7, dead, 150)
  assert.equal(d.occ[s0], -1, '아직 비어 있다')
  stepDots(d, 7, dead, 450)
  assert.ok(d.occ[s0]! >= 0, '뒷줄이 메웠다')
  for (let t = 500; t < 1000; t += 50) stepDots(d, 7, dead, t)
  const k1 = d.occ[s0]!
  assert.equal(rowOfDot(d, k1), 0)
})
