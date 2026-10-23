/** 짝에게 가서 함께 지낸다 (형 2026-10-23: "신방에 떨어져 있는데 같이 지내게 만들려면 버튼 하나 눌러서") */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { byeonhanMini } from '../../src/realm/data/regions/byeonhan-mini.ts'
import { canCohabit, together } from '../../src/realm/heroes.ts'
import { migratePath } from '../../src/realm/economy.ts'
import { advance } from '../../src/realm/season.ts'

describe('짝에게 간다', () => {
  it('떨어진 짝에게 가면 그 계절부터 함께 지낸다', () => {
    const r = byeonhanMini(1)
    const me = r.player
    const mine = Object.values(r.heroes).filter((h) => h.faction === me && h.status === 'free')
    const a = mine[0]!
    const b = mine.find((h) => h.id !== a.id)!
    const towns = Object.values(r.nodes).filter((n) => n.owner === me && n.kind !== 'sodo' && n.kind !== 'wild')
    const t1 = towns[0]!.id
    const t2 = towns.find((n) => n.id !== t1 && migratePath(r, me, t1, n.id) !== null)!.id
    for (const x of Object.values(r.armies)) if (x.hero === a.id || x.hero === b.id) x.hero = null
    a.at = t1; a.post = null; a.spouse = b.id
    b.at = t2; b.post = null; b.spouse = a.id
    assert.ok(!together(r, a.id, b.id))
    assert.ok(canCohabit(r, a.id))
    const { next, report } = advance(r, [{ kind: 'cohabit', hero: a.id }])
    assert.ok(report.lines.some((l) => l.kind === 'cohabit'))
    assert.ok(together(next, a.id, b.id))
  })
})
