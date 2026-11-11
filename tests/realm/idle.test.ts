/** 놀고 있는 계절 셈 (src/realm/idle.ts · PLAYTEST-1112 TOP 2) */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { byeonhanMini } from '../../src/realm/data/regions/byeonhan-mini.ts'
import { hasActive, nextIdle } from '../../src/realm/idle.ts'
import type { Order } from '../../src/realm/types.ts'

describe('놀고 있는 계절', () => {
  it('살림 명령만 낸 계절은 놀았다 · 정찰이나 짓기를 내면 0 으로 돌아간다', () => {
    const r = byeonhanMini(1)
    const rest: Order[] = [{ kind: 'answer', ask: 'x', yes: true }]
    let s = nextIdle(r, rest, 'us', undefined)
    s = nextIdle(r, [], 'us', s)
    assert.equal(s.seasons, 2)
    assert.ok(hasActive([{ kind: 'scout', faction: 'us', node: 'a', hero: null }]))
    s = nextIdle(r, [{ kind: 'scout', faction: 'us', node: 'a', hero: null }], 'us', s)
    assert.equal(s.seasons, 0)
  })
})
