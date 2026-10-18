/**
 * 병종마다 무장 · 병종의 쓰임 (src/realm/kit.ts · battle.gearMul · battle.roleMul)
 * 형: "쇠칼을 들려뽑는다? 이게 좀 말이안됨. 창병 궁수 방패병 다르지 않나... 무장해서 뽑으면 그 수도 파악이 되어야" (2026-10-18)
 *
 *  - 불변식: 병종마다 단계의 합 = mix — 징병·나누기·모으기·싸움의 손실 뒤에도
 *  - 쇠 들려 뽑으면 **뽑힌 그 사람들만** 한 단계 위
 *  - 무장 올리기는 병종 하나의 가장 낮은 단계만 · 철을 낸다
 *  - kit 가 없는 옛 저장은 equip 하나로 다 든 것으로 본다
 *  - 쓰임: 궁수는 지킬 때·성 위에서 세고 숲에서 약하다 · 방패병은 지킬 때·기습당할 때 · 창병은 칠 때·들판에서 세고 고개에서 약하다 · 창 > 방패
 *  - 정찰하면 병종의 몫이 보인다
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { counterMul, OPEN_FIELD, roleMul, type Force, type UnitKind } from '../../src/realm/battle.ts'
import { byeonhanMini } from '../../src/realm/data/regions/byeonhan-mini.ts'
import { armCost } from '../../src/realm/economy.ts'
import { armyPower, matchupHints } from '../../src/realm/estimate.ts'
import { seenMix } from '../../src/realm/intel.ts'
import { kitLines, kitOf, scaleMen } from '../../src/realm/kit.ts'
import { advance, forceOf, newArmyId, planned } from '../../src/realm/season.ts'
import type { Army, Order, Realm } from '../../src/realm/types.ts'

const fresh = (): Realm => planned(byeonhanMini(1), [])

/** 병종마다 kit 의 합이 mix 와 같은가 */
function holds(a: Army): void {
  const kit = kitOf(a)
  for (const [k, n] of Object.entries(a.mix) as Array<[UnitKind, number]>) {
    if (!(n > 0)) continue
    const sum = Object.values(a.kit?.[k] ?? kit[k] ?? {}).reduce((s, v) => s + (v ?? 0), 0)
    assert.equal(sum, n, `${a.id} ${k}: kit ${sum} ≠ mix ${n}`)
  }
}

const men = (a: Army): number => Object.values(a.mix).reduce((s, v) => s + (v ?? 0), 0)

describe('병종마다 무장', () => {
  it('kit 가 없는 옛 군대는 equip 하나로 다 든 것으로 본다', () => {
    const r = fresh()
    const a = r.armies['a-us']!
    delete a.kit
    const kit = kitOf(a)
    assert.equal(kit.spear?.[a.equip], a.mix.spear)
    assert.equal(kit.bow?.[a.equip], a.mix.bow)
    // 옛 저장으로 한 계절을 넘겨도 된다
    const { next } = advance(r, [])
    for (const x of Object.values(next.armies)) holds(x)
  })

  it('쇠 들려 뽑으면 뽑힌 사람들만 한 단계 위 — 원래 있던 이들은 그대로', () => {
    const r = fresh()
    r.stock['us']!.iron = 200
    const before = kitOf(r.armies['a-us']!)
    const o: Order = { kind: 'draft', faction: 'us', node: 'our-cap', unit: 'bow', n: 20, iron: true }
    const p = planned(r, [o])
    const a = p.armies['a-us']!
    holds(a)
    // 갯마을 기본은 쇠날(ironTip) → 새로 뽑힌 궁수 20 은 온 쇠
    assert.equal(kitOf(a).bow?.iron, 20)
    assert.equal(kitOf(a).bow?.ironTip, before.bow?.ironTip)
    assert.deepEqual(kitOf(a).spear, before.spear)
    assert.ok(p.stock['us']!.iron < 200)
  })

  it('나누면 단계마다 같은 비율로 · 양쪽 다 불변식을 지키고 사람 수가 그대로', () => {
    const r = fresh()
    const a = r.armies['a-us']!
    a.mix = { spear: 90, bow: 30 }
    a.kit = { spear: { stone: 30, bronze: 30, ironTip: 30 }, bow: { ironTip: 20, iron: 10 } }
    const id = newArmyId(r, 'us')
    const p = planned(r, [{ kind: 'split', army: 'a-us', id, take: { spear: 30, bow: 15 }, hero: false }])
    const x = p.armies['a-us']!
    const y = p.armies[id]!
    holds(x)
    holds(y)
    assert.deepEqual(kitOf(y).spear, { stone: 10, bronze: 10, ironTip: 10 })
    assert.equal((kitOf(y).bow?.ironTip ?? 0) + (kitOf(y).bow?.iron ?? 0), 15)
    assert.equal(men(x) + men(y), 120)
  })

  it('모으면 무장째 더한다', () => {
    const r = fresh()
    const id = newArmyId(r, 'us')
    const r1 = advance(r, [{ kind: 'split', army: 'a-us', id, take: { spear: 20 }, hero: false }]).next
    r1.armies[id]!.kit = { spear: { stone: 20 } }
    const p = planned(r1, [{ kind: 'merge', army: id, into: 'a-us' }])
    const a = p.armies['a-us']!
    holds(a)
    assert.equal(kitOf(a).spear?.stone, 20)
  })

  it('싸워 잃어도 단계마다 같은 비율로 줄고 불변식을 지킨다', () => {
    const r = fresh()
    const a = r.armies['a-us']!
    a.mix = { spear: 101, bow: 33, shield: 7 }
    a.kit = { spear: { stone: 50, ironTip: 51 }, bow: { bronze: 11, iron: 22 }, shield: { bronze: 7 } }
    for (const keep of [0.88, 0.75, 0.5, 0.13]) {
      scaleMen(a, keep)
      holds(a)
    }
  })

  it('무장 올리기 — 그 병종의 가장 낮은 단계만 한 단계 · 철을 낸다', () => {
    const r = fresh()
    r.stock['us']!.iron = 100
    r.stock['us']!.grain = 500
    const a = r.armies['a-us']!
    a.mix = { spear: 80, bow: 30 }
    a.kit = { spear: { stone: 40, ironTip: 40 }, bow: { bronze: 30 } }
    const c = armCost(r, 'a-us', 'bow')
    assert.ok(c !== null)
    assert.equal(c!.n, 30)
    assert.equal(c!.to, 'ironTip')
    const p = planned(r, [{ kind: 'arm', army: 'a-us', unit: 'bow' }])
    const b = p.armies['a-us']!
    holds(b)
    assert.deepEqual(kitOf(b).bow, { ironTip: 30 })
    assert.deepEqual(kitOf(b).spear, { stone: 40, ironTip: 40 }, '창병은 그대로')
    assert.equal(p.stock['us']!.iron, 100 - c!.iron)
    // 창병은 가장 낮은 돌창 40 만 청동으로
    const s = armCost(r, 'a-us', 'spear')!
    assert.equal(s.n, 40)
    assert.equal(s.from, 'stone')
    assert.equal(s.to, 'bronze')
  })

  it('화면용 — 병종마다 단계별 사람 수 · 군대의 힘', () => {
    const r = fresh()
    const lines = kitLines(r.armies['a-us']!)
    assert.ok((lines.spear ?? []).length > 0)
    const pw = armyPower(r, 'a-us')!
    assert.ok(pw.total > 0 && pw.parts.men > 0 && pw.parts.gear > 0)
    // 무장이 좋으면 힘이 세다
    const a = r.armies['a-us']!
    a.kit = { spear: { stone: a.mix.spear! }, bow: { stone: a.mix.bow! }, shield: { stone: a.mix.shield! } }
    const lo = armyPower(r, 'a-us')!.total
    a.kit = { spear: { iron: a.mix.spear! }, bow: { iron: a.mix.bow! }, shield: { iron: a.mix.shield! } }
    assert.ok(armyPower(r, 'a-us')!.total > lo)
    assert.ok(forceOf(r, a).kit !== undefined)
  })
})

describe('병종의 쓰임 — 공수 · 성 · 지형', () => {
  const F = (k: UnitKind): Force => ({ mix: { [k]: 100 }, equip: 'ironTip', mu: 5, morale: 1 })
  it('궁수 — 지킬 때 세고, 성 위에서 더 세고, 숲길에서 약하다', () => {
    const atk = roleMul(F('bow'), OPEN_FIELD, 'atk')
    const def = roleMul(F('bow'), OPEN_FIELD, 'def')
    const wall = roleMul(F('bow'), { ...OPEN_FIELD, fort: 1.3 }, 'def')
    const forest = roleMul(F('bow'), { ...OPEN_FIELD, edge: 'forest' }, 'atk')
    assert.ok(def > atk && wall > def && forest < atk)
  })
  it('방패병 — 지킬 때 세고, 기습을 당해도 버틴다', () => {
    const def = roleMul(F('shield'), OPEN_FIELD, 'def')
    assert.ok(def > roleMul(F('shield'), OPEN_FIELD, 'atk'))
    assert.ok(roleMul(F('shield'), { ...OPEN_FIELD, ambushed: true }, 'def') > def)
  })
  it('창병 — 칠 때 · 들길에서 세고, 고갯길에서 약하다', () => {
    assert.ok(roleMul(F('spear'), OPEN_FIELD, 'atk') > roleMul(F('spear'), OPEN_FIELD, 'def'))
    assert.ok(roleMul(F('spear'), { ...OPEN_FIELD, edge: 'field' }, 'atk') > roleMul(F('spear'), { ...OPEN_FIELD, edge: 'pass' }, 'atk'))
  })
  it('세모가 닫힌다 — 창 > 방패 > 활 > 창', () => {
    assert.ok(counterMul(F('spear'), F('shield')) > 1)
    assert.ok(counterMul(F('shield'), F('bow')) > 1)
    assert.ok(counterMul(F('bow'), F('spear')) > 1)
  })
  it('정찰하면 병종의 몫이 보이고, 칠 때의 말이 나온다', () => {
    const r = fresh()
    assert.equal(seenMix(r, 'us', 'guya-vil'), null)
    const { next } = advance(r, [{ kind: 'scout', faction: 'us', node: 'guya-vil', hero: null }])
    const m = seenMix(next, 'us', 'guya-vil')
    assert.ok(m !== null, '정찰한 고을의 몫이 안 보인다')
    {
      const sum = Object.values(m!.mix).reduce((s, v) => s + (v ?? 0), 0)
      assert.ok(sum > 0.7 && sum < 1.3, `몫의 합 ${sum}`)
    }
    const hints = matchupHints(next, 'us', { spear: 80, bow: 30 }, 'guya-vil', 'mudflat')
    assert.ok(Array.isArray(hints) && hints.length <= 3)
    assert.ok(matchupHints(next, 'us', { bow: 80 }, 'guya-vil', 'forest').some((h) => h.includes('숲길')))
  })
})
