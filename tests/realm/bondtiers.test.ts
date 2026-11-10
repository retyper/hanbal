/**
 * 인연 단 효과 — 2단 시작 정 · 3단 기억한 재주 · 5단 덤 동행 (BONDS §2 · §6) · 저장 형식 호환
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { byeonhanMini } from '../../src/realm/data/regions/byeonhan-mini.ts'
import { HERO_POOL } from '../../src/realm/data/heroes-pool.ts'
import { applyBonds, type BondMemory } from '../../src/realm/bonds.ts'
import { planned } from '../../src/realm/season.ts'
import { P } from '../../src/tune/params.ts'
import type { Hero, Realm } from '../../src/realm/types.ts'

const fresh = (seed = 1): Realm => planned(byeonhanMini(seed), [])
const R = P.realm
const bodyOf = (id: string): Hero | undefined => HERO_POOL.find((x) => x.id === id)
const ours = (r: Realm): string => Object.values(r.heroes).find((h) => h.faction === r.player && !h.id.endsWith('-ruler') && h.id !== 'chief')?.id ?? 'chief'

describe('인연 단 효과', () => {
  it('2단은 시작 정이 더해지고 1단은 그대로다', () => {
    const r = fresh()
    const id = ours(r)
    const was = r.heroes[id]!.bond ?? R.bondStart
    applyBonds(r, { [id]: { p: R.metaTier1 } }, bodyOf)
    assert.equal(r.heroes[id]!.bond ?? R.bondStart, was)
    applyBonds(r, { [id]: { p: R.metaTier2 } }, bodyOf)
    assert.equal(r.heroes[id]!.bond, was + R.metaStartBond)
  })

  it('3단은 기억한 재주를 처음부터 가지되 셋까지만, 2단은 못 가진다', () => {
    const r = fresh()
    const id = ours(r)
    const h = r.heroes[id]!
    ;(h as { traits: readonly string[] }).traits = []
    applyBonds(r, { [id]: { p: R.metaTier2, keep: 'farmer' } }, bodyOf)
    assert.ok(!h.traits.includes('farmer'))
    applyBonds(r, { [id]: { p: R.metaTier3, keep: 'farmer' } }, bodyOf)
    assert.deepEqual([...h.traits], ['farmer'])
    applyBonds(r, { [id]: { p: R.metaTier3, keep: 'farmer' } }, bodyOf)
    assert.equal(h.traits.length, 1, '두 번 붙지 않는다')
    ;(h as { traits: readonly string[] }).traits = ['a', 'b', 'c']
    applyBonds(r, { [id]: { p: R.metaTier3, keep: 'farmer' } }, bodyOf)
    assert.equal(h.traits.length, 3)
  })

  it('5단은 판에 없는 장수가 떠돌이로 우리 도읍에 오고 등용할 수 있다', () => {
    const r = fresh()
    const free = HERO_POOL.filter((x) => r.heroes[x.id] === undefined && !x.id.endsWith('-ruler'))
    const who = free[0]!.id
    const other = free[1]!.id
    applyBonds(r, { [who]: { p: R.metaTier5 + 1 }, [other]: { p: R.metaTier5 } }, bodyOf)
    const ws = (r.wanderers ?? []).filter((w) => w.hero.id === who || w.hero.id === other)
    assert.equal(ws.length, R.metaBonusMax)
    assert.equal(ws[0]!.hero.id, who, '정이 가장 깊은 이가 먼저')
    assert.equal(ws[0]!.node, r.factions[r.player]!.capital)
    assert.equal(ws[0]!.until, r.season + R.metaBonusStay)
    const out = planned(r, [{ kind: 'hire', faction: r.player, hero: who }])
    assert.equal(out.heroes[who]?.faction, r.player)
  })

  it('이야기 장과 4단 이하·이미 판에 있는 장수에게는 떠돌이가 없다', () => {
    const r = fresh()
    const inRun = ours(r)
    const free = HERO_POOL.find((x) => r.heroes[x.id] === undefined && !x.id.endsWith('-ruler'))!.id
    applyBonds(r, { [inRun]: { p: R.metaTier5 }, [free]: { p: R.metaTier4 } }, bodyOf)
    assert.equal((r.wanderers ?? []).length, 0)
    const t = fresh()
    t.region = 'tutorial'
    assert.deepEqual(applyBonds(t, { [ours(t)]: { p: R.metaTier5 } }, bodyOf), [])
  })

  it('같은 기억이면 같은 판이 된다 (결정론)', () => {
    const a = fresh(7)
    const b = fresh(7)
    const mem: Record<string, BondMemory> = { [ours(a)]: { p: R.metaTier3, keep: 'farmer' } }
    applyBonds(a, mem, bodyOf)
    applyBonds(b, mem, bodyOf)
    assert.deepEqual(a, b)
  })
})

describe('인연 저장 형식', () => {
  it('재주 기억이 없는 옛 저장도 읽고 눈뜬 재주는 저장에 남는다', async () => {
    const mem = new Map<string, string>()
    ;(globalThis as { localStorage?: unknown }).localStorage = {
      getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => { mem.set(k, v) }, removeItem: (k: string) => { mem.delete(k) },
    }
    const { bondMemory, recordBonds } = await import('../../src/ui/realm/bonds.ts')
    mem.set('hanbal.realm.bonds', JSON.stringify({ v: 1, h: { chief: { p: 50 }, x: { p: 20, keep: 'farmer' } }, run: {} }))
    assert.deepEqual(bondMemory(), { chief: { p: 50 }, x: { p: 20, keep: 'farmer' } })
    const r = fresh(3)
    const id = ours(r)
    mem.set('hanbal.realm.bonds', JSON.stringify({ v: 1, h: { [id]: { p: 60 } }, run: {} }))
    r.heroes[id]!.awoken = 'smith'
    recordBonds(r)
    assert.equal(bondMemory()[id]!.keep, 'smith')
    assert.ok(bondMemory()[id]!.p >= 60)
  })
})
