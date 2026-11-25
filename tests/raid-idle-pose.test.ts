import { describe, expect, it } from 'vitest'
import { standingCell, standsWithCompanion } from '../src/raid/idle-pose.ts'
import { HAEBI_ANIM as A } from '../src/tune/params.ts'

describe('장수 고르는 화면의 서기 칸 (raid/idle-pose.ts)', () => {
  it('새 방식 띠(덧 띠 있음)는 시간이 흐르면 다른 칸을 돌려준다', () => {
    const p = 'realm/anim-px/gen-haebi.png'
    expect(standsWithCompanion(p)).toBe(true)
    const cells = new Set<number>()
    for (let t = 0; t < 60; t += 0.05) cells.add(standingCell(p, t, true))
    expect(cells.size).toBeGreaterThan(2)
    expect([...cells].some(c => c >= 20)).toBe(true)
  })
  it('덧 띠를 못 받았으면 본 띠 칸(20 미만)만 쓴다', () => {
    const p = 'realm/anim-px/gen-haebi.png'
    for (let t = 0; t < 60; t += 0.05) expect(standingCell(p, t, false)).toBeLessThan(20)
  })
  it('옛 방식 띠(계획 없음)는 열전과 같은 서기 칸을 idleTime 초마다 돈다', () => {
    const p = 'realm/anim-px/gen-no-such-old-strip.png'
    expect(standsWithCompanion(p)).toBe(false)
    expect(standingCell(p, 0, false)).toBe(A.idle[0])
    expect(standingCell(p, A.idleTime * 1.01, false)).toBe(A.idle[1 % A.idle.length])
    const cells = new Set<number>()
    for (let t = 0; t < A.idleTime * A.idle.length; t += A.idleTime / 2) cells.add(standingCell(p, t, false))
    expect(cells.size).toBe(new Set(A.idle).size)
  })
})
