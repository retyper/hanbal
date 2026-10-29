/**
 * 길목 (src/realm/council.ts · docs/realm/COUNCIL.md 1주 조각)
 *
 *  - 같은 판·같은 계절이면 같은 길목 (A1)
 *  - 지난번에 그 나라가 온 길은 무게가 커진다 — 되풀이하면 읽힌다
 *  - 지킨 길로 들어가면 숨어 닿을 가망이 깎이고, 비켜 가면 조금 오른다
 *  - 싸움 줄에 지킨 길목과 까닭 · 권한 장수가 남는다
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { guardAdjust, guardOptions, guardPick, guardWeights, pathKey } from '../../src/realm/council.ts'
import { byeonhanMini } from '../../src/realm/data/regions/byeonhan-mini.ts'
import { advance } from '../../src/realm/season.ts'
import type { ReportLine } from '../../src/realm/types.ts'

type Battle = Extract<ReportLine, { kind: 'battle' }>

describe('길목', () => {
  it('같은 판·같은 계절이면 같은 길목', () => {
    const r = byeonhanMini(4)
    const def = r.nodes['goja-vil']!.owner!
    const a = guardPick(r, 'goja-vil', def, r.player, null, 3)
    const b = guardPick(byeonhanMini(4), 'goja-vil', def, r.player, null, 3)
    assert.deepEqual(a, b)
  })

  it('지난번에 온 길은 무게가 커진다', () => {
    const r = byeonhanMini(4)
    const def = r.nodes['goja-vil']!.owner!
    const opts = guardOptions(r, 'goja-vil')
    assert.ok(opts.length >= 2, `길목이 하나뿐 ${opts}`)
    const ap = opts[1]!
    const w0 = guardWeights(r, 'goja-vil', def, r.player, null).find((x) => x.ap === ap)!.w
    r.pathMemo = { [pathKey(r.player, def)]: ap }
    const w1 = guardWeights(r, 'goja-vil', def, r.player, null).find((x) => x.ap === ap)!
    assert.ok(w1.w > w0 * 2, `${w0} → ${w1.w}`)
    assert.equal(w1.why, 'repeat')
  })

  it('지킨 길이면 깎이고 비켜 가면 오른다', () => {
    assert.ok(guardAdjust(0.5, 'ford', 'ford') < 0.5)
    assert.ok(guardAdjust(0.5, 'ford', 'night') > 0.5)
  })

  it('싸움 줄에 지킨 길목과 권한 장수가 남고, 다음엔 그 길을 기억한다', () => {
    let seen = false
    for (let s = 1; s <= 40 && !seen; s++) {
      const r = byeonhanMini(s)
      r.armies['a-goja']!.at = 'goja-vil'
      const hero = r.armies['a-us']!.hero
      const { next, report } = advance(r, [{ kind: 'march', army: 'a-us', edge: 'e03', ambush: true, ...(hero !== null ? { adviser: hero } : {}) }])
      const b = report.lines.find((l): l is Battle => l.kind === 'battle')
      if (b === undefined || b.guarded === undefined) continue
      assert.ok(b.gwhy !== undefined)
      if (hero !== null) assert.equal(b.adviser, hero)
      assert.equal(next.pathMemo?.[pathKey(r.player, b.defender)], b.approach)
      seen = true
    }
    assert.ok(seen, '길목이 남은 싸움이 없다')
  })
})
