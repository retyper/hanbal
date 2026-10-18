/**
 * 옛 판 이어 하기 — 형: "지금 하는게임 다음계절로 안넘어가짐" · "솔숲 읍락에 nan-nan" (2026-10-18)
 *
 *  - 80eb366 (무장 표 · 정과 자람 · 속셈 앞)에서 12계절 돌린 판을 지금 엔진이 20계절 더 넘긴다 — 멈추지 않고 NaN 이 없다
 *  - 칸이 빈 정보(저장에서 NaN 이 null 이 된 것)는 범위 대신 "모름"이다
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { aiOrders, decide } from '../../src/realm/ai.ts'
import { visibleRange } from '../../src/realm/intel.ts'
import { advance } from '../../src/realm/season.ts'
import type { Realm } from '../../src/realm/types.ts'

const OLD = new URL('./fixtures/realm-80eb366.json', import.meta.url)

function nanPath(x: unknown, p = ''): string | null {
  if (typeof x === 'number') return Number.isFinite(x) ? null : p
  if (x !== null && typeof x === 'object') {
    for (const [k, v] of Object.entries(x)) {
      const q = nanPath(v, `${p}.${k}`)
      if (q !== null) return q
    }
  }
  return null
}

describe('옛 판', () => {
  it('80eb366 의 판을 20계절 더 넘긴다 — 멈추지 않고 NaN 이 없다', () => {
    let r = JSON.parse(readFileSync(OLD, 'utf8')) as Realm
    for (let s = 0; s < 20 && !r.outcome; s++) {
      const res = advance(r, [...aiOrders(r), ...decide(r, r.player, 'planner')])
      assert.equal(nanPath(res.next), null, `계절 ${s}`)
      r = JSON.parse(JSON.stringify(res.next)) as Realm
    }
  })

  it('칸이 빈 정보는 모른다 (NaN 범위를 내지 않는다)', () => {
    assert.equal(visibleRange({ f0: null as unknown as number, src: 'scout', u: 0.5 }, 0), null)
    const v = visibleRange({ f0: 100, src: 'scout', u: undefined as unknown as number }, 1)
    assert.ok(v !== null && Number.isFinite(v[0]) && Number.isFinite(v[1]))
  })
})
