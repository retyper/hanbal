/**
 * 전장의 머릿수 — 작은 병사 10명 · 큰 병사 100명 · 깃발 병사 1000명 (src/ui/realm/troops.ts · 형 11-01)
 * 그리고 싸움이 열리는 판의 병종 짜임이 우리·적 칸에 바로 앉는가 (지키는 싸움에서 뒤바뀌어 있었다)
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { startRegion } from '../../src/realm/data/regions/index.ts'
import type { ReportLine } from '../../src/realm/types.ts'
import { openHtml } from '../../src/ui/realm/battlefield.ts'
import { sideIdx, tierCounts, tierPrec, tierStanding, tierValue } from '../../src/ui/realm/troops.ts'
import type { BattleLine } from '../../src/realm/warroom.ts'

describe('머릿수 잣대', () => {
  it('340명은 큰 병사 셋 + 작은 병사 넷 · 1명이라도 있으면 하나', () => {
    assert.deepEqual(tierCounts(340), [4, 3, 0])
    assert.deepEqual(tierCounts(920), [2, 9, 0])
    assert.deepEqual(tierCounts(2340), [4, 3, 2])
    assert.deepEqual(tierCounts(12000), [0, 0, 12])
    assert.deepEqual(tierCounts(3), [1, 0, 0])
    assert.deepEqual(tierCounts(0), [0, 0, 0])
  })
  it('그림이 넘치면 아랫자리만 버린다 — 큰 병사는 그대로', () => {
    assert.deepEqual(tierCounts(340, 1), [0, 3, 0])
    assert.deepEqual(tierCounts(40, 1), [1, 0, 0]) // 반올림해 0 이어도 하나는 선다
    assert.deepEqual(tierCounts(2340, 2), [0, 0, 2])
    // 한 판의 자리 — 두 쪽 다 한도 안
    assert.equal(tierPrec([[340], [120]], 30), 0)
    assert.equal(tierPrec([[990, 990, 990], [100]], 30), 1)
  })
  it('쓰러질 때 작은 병사부터 · 줄기만 한다 (다시 일어나지 않는다)', () => {
    const c = tierCounts(340)
    assert.deepEqual(tierStanding(c, 340, 340), [4, 3, 0])
    assert.deepEqual(tierStanding(c, 340, 300), [0, 3, 0])
    assert.deepEqual(tierStanding(c, 340, 220), [0, 2, 0])
    assert.deepEqual(tierStanding(c, 340, 5), [0, 1, 0]) // 한 명이라도 남으면 하나
    assert.deepEqual(tierStanding(c, 340, 0), [0, 0, 0])
    let prev = tierStanding(c, 340, 340)
    for (let left = 339; left >= 0; left--) {
      const now = tierStanding(c, 340, left)
      for (let t = 0; t < 3; t++) assert.ok(now[t]! <= prev[t]!, `${left}명: ${now} > ${prev}`)
      prev = now
    }
  })
  it('서 있는 그림의 값은 남은 사람과 가장 큰 단위의 반 넘게 어긋나지 않는다', () => {
    for (const start of [80, 340, 920, 2340]) {
      const c = tierCounts(start)
      const top = c[2] > 0 ? 1000 : c[1] > 0 ? 100 : 10
      for (let left = 0; left <= start; left += 7) {
        const s = tierStanding(c, start, left)
        const v = tierValue(s)
        const lastOne = left > 0 && s[0] + s[1] + s[2] === 1
        assert.ok(Math.abs(v - left) <= top / 2 + 10 || lastOne, `${start}→${left}: 그림 ${v}`)
      }
    }
  })
})

describe('싸움이 열리는 판 — 병종 짜임', () => {
  const r = startRegion('byeonhan-mini', 7, 'us')
  const ours = Object.values(r.armies).find((a) => a.faction === r.player)!
  const foe = Object.values(r.armies).find((a) => a.faction !== r.player && a.march === null)!
  // 짜임은 [공격, 지킴] 순 — 공격 쪽은 궁수 300, 지킴 쪽은 기병 70
  const line = (weAtk: boolean): BattleLine => ({
    kind: 'battle', node: weAtk ? foe.at : ours.at, attacker: weAtk ? ours.id : foe.id, allies: [], pincer: false, defender: weAtk ? foe.faction : r.player,
    ambush: 'none', p: 0.5, outcome: 'win', captured: null, killed: null, militia: 0, atkFaction: weAtk ? r.player : foe.faction,
    start: { men: [300, 70], morale: [1, 1], heroes: [null, null], mix: [{ bow: 300 }, { horse: 70 }] },
  } as unknown as ReportLine as BattleLine)
  const ourBox = (h: string): string => h.slice(h.indexOf('class="wosd us"'), h.indexOf('class="wosd foe"'))
  const foeBox = (h: string): string => h.slice(h.indexOf('class="wosd foe"'))
  it('우리가 칠 때 — 우리 칸엔 우리(공격) 짜임', () => {
    assert.deepEqual(sideIdx(true), { us: 0, foe: 1 })
    const h = openHtml(r, r, line(true), r.player, '/', 300, 70)
    assert.ok(ourBox(h).includes('sol-bow') && !ourBox(h).includes('sol-horse'))
    assert.ok(foeBox(h).includes('sol-horse') && !foeBox(h).includes('sol-bow'))
  })
  it('우리가 지킬 때 — 우리 칸엔 우리(지킴) 짜임 (전엔 뒤바뀌었다)', () => {
    assert.deepEqual(sideIdx(false), { us: 1, foe: 0 })
    const h = openHtml(r, r, line(false), r.player, '/', 70, 300)
    assert.ok(ourBox(h).includes('sol-horse') && !ourBox(h).includes('sol-bow'), ourBox(h))
    assert.ok(foeBox(h).includes('sol-bow') && !foeBox(h).includes('sol-horse'))
  })
})
