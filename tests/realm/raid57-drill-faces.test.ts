import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { startRegion } from '../../src/realm/data/regions/index.ts'
import { emptyDrill, engrave, engraveVows } from '../../src/realm/drill.ts'
import { bustOf, kidBust, noteKids } from '../../src/realm/data/art.ts'
import * as yard from '../../src/ui/realm/drill.ts'

const KEY = 'hanbal.realm.drill'
const entry = (name = '마루', look: 'g' | 'w' = 'g', seed = 71) => ({ points: 8, level: 0, add: {}, runs: 1, lastSeed: seed, name, look })
function memory(values: Record<string, unknown>) {
  const m = new Map(Object.entries(values).map(([k, v]) => [k, JSON.stringify(v)]))
  return { m, getItem: (k: string) => m.get(k) ?? null, setItem: () => { throw new Error('read-only') }, removeItem: () => { throw new Error('read-only') } }
}
function storage<T>(kv: ReturnType<typeof memory>, fn: () => T): T {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: kv })
  try { return fn() } finally { if (previous) Object.defineProperty(globalThis, 'localStorage', previous); else Reflect.deleteProperty(globalThis, 'localStorage') }
}
function childRealm(id: string) {
  const r = startRegion('yeongnam', 71, 'bihwa')
  const base = Object.values(r.heroes).find(h => h.faction === r.player)!
  r.heroes[id] = { ...base, id, name: '마루', look: 'g', traits: ['archer'], parents: ['bihwa-1', 'guya-3'] }
  return r
}

describe('57-A cold 단련터 얼굴, 테스트 저장소만 사용', () => {
  it('새 공/의리 기록은 얼굴 갈래 traits를 별도 배열로 남긴다', () => {
    const id = 'kid-57-new-a', r = childRealm(id)
    r.merit = { [id]: 3 }; r.vows = { [id]: ['hold'] }
    const a = engrave(emptyDrill(), r, true).h[id]!
    const b = engraveVows(emptyDrill(), r).h[id]!
    assert.deepEqual(a.traits, ['archer'])
    assert.deepEqual(b.traits, ['archer'])
    assert.notEqual(a.traits, r.heroes[id]!.traits)
  })
  it('저장된 얼굴 재료가 cold load에서 사라지지 않고 공통 bustOf로 나온다', () => {
    const id = 'kid-57-cold-a', kv = memory({ [KEY]: { v: 1, h: { [id]: { ...entry(), traits: ['archer'] } }, paid: {}, order: [] } })
    assert.equal(bustOf(id), undefined)
    storage(kv, () => {
      assert.deepEqual(yard.loadDrill().h[id]!.traits, ['archer'])
      assert.equal(bustOf(id), kidBust(id, 'g', ['archer']))
    })
  })
  it('자동/수동 index없는 슬롯과 판선반에서 동일seed 증거를 읽기만 복원한다', () => {
    for (const [n, key] of ['hanbal.realm.v2', 'hanbal.realm.save.0', 'hanbal.realm.slot.71'].entries()) {
      const id = `kid-57-slot-${n}`, e = entry(), h = { id, name: e.name, look: e.look, traits: ['archer'] }
      const realm = { seed: 71, heroes: { [id]: h } }
      const kv = memory({ [KEY]: { h: { [id]: e } }, [key]: key.includes('.save.') ? { game: { realm } } : { realm } })
      const before = [...kv.m]
      const report = yard.hydrateDrillFaces(kv)
      assert.deepEqual(report.unknown, [])
      assert.deepEqual(report.sources, [{ id, key }])
      assert.equal(bustOf(id), kidBust(id, 'g', ['archer']))
      assert.deepEqual(yard.loadDrill(kv).h[id]!.traits, ['archer'])
      assert.deepEqual([...kv.m], before)
    }
  })
  it('다른seed나 이름/성별 불일치는 임의얼굴 없이 남긴다', () => {
    for (const [n, change] of [{ seed: 72 }, { name: '다른아이' }, { look: 'w' }].entries()) {
      const id = `kid-57-reject-${n}`, e = entry()
      const kv = memory({ [KEY]: { h: { [id]: e } }, 'hanbal.realm.v2': { realm: { seed: 71, heroes: { [id]: { name: e.name, look: e.look, traits: ['archer'], ...change } }, ...(change.seed ? { seed: change.seed } : {}) } } })
      assert.equal(yard.hydrateDrillFaces(kv).unknown.length, 1)
      assert.equal(bustOf(id), undefined)
    }
  })
  it('같은seed 후보가 서로 다른 얼굴이면 충돌로 남긴다', () => {
    const id = 'kid-57-ambiguous', e = entry(), candidate = (traits: string[]) => ({ realm: { seed: 71, heroes: { [id]: { name: e.name, look: e.look, traits } } } })
    const kv = memory({ [KEY]: { h: { [id]: e } }, 'hanbal.realm.v2': candidate(['archer']), 'hanbal.realm.v2.prev': candidate(['shaman']) })
    assert.notEqual(kidBust(id, 'g', ['archer']), kidBust(id, 'g', ['shaman']))
    assert.deepEqual(yard.hydrateDrillFaces(kv).unknown, [{ id, reason: 'ambiguous' }])
    assert.equal(bustOf(id), undefined)
  })
  it('가문 기록은 동일seed 원아이와 연결되고 clan trait얼굴도 유지한다', () => {
    const id = 'kid-57-clan-proof', clan = 'clan-g-71-kid-57-known-clan', e = entry()
    const kv = memory({ [KEY]: { h: { [id]: e, [clan]: { ...e, traits: ['archer'] } } }, 'hanbal.realm.clan': { [`71:${id}`]: { name: e.name, look: e.look, traits: ['archer'] } } })
    assert.deepEqual(yard.hydrateDrillFaces(kv).unknown, [])
    assert.equal(bustOf(id), kidBust(id, 'g', ['archer']))
    assert.equal(bustOf(clan), kidBust('kid-57-known-clan', 'g', ['archer']))
  })
  it('이미 판에서 본 얼굴과 저장된 정확한 파일명을 바꾸지 않는다', () => {
    const id = 'kid-57-current', e = entry()
    noteKids([{ id, look: 'g', parents: ['a', 'b'], traits: ['shaman'] }])
    const original = bustOf(id)
    const fixed = 'kid-57-fixed', file = kidBust(fixed, 'g', ['archer'])!
    const kv = memory({ [KEY]: { h: { [id]: { ...e, traits: ['archer'] }, [fixed]: { ...e, traits: ['shaman'], bust: file } } } })
    yard.hydrateDrillFaces(kv)
    assert.equal(bustOf(id), original)
    assert.equal(bustOf(fixed), file)
  })
  it('변한 슬롯 원문은 다시 읽고 이전 복원 재료를 재사용하지 않는다', () => {
    const id = 'kid-57-change-source', e = entry(), kv = memory({ [KEY]: { h: { [id]: e } } })
    assert.equal(yard.hydrateDrillFaces(kv).unknown.length, 1)
    kv.m.set('hanbal.realm.v2', JSON.stringify({ realm: { seed: 71, heroes: { [id]: { name: e.name, look: e.look, traits: ['archer'] } } } }))
    assert.deepEqual(yard.hydrateDrillFaces(kv).unknown, [])
    kv.m.delete('hanbal.realm.v2')
    assert.equal(yard.hydrateDrillFaces(kv).unknown.length, 1)
    assert.equal(bustOf(id), undefined)
  })
  it('먼저 복원한 얼굴이 나중에 연 같은id 다른판의 실제 얼굴을 선점하지 않는다', () => {
    const id = 'kid-57-later-live', kv = memory({ [KEY]: { h: { [id]: { ...entry(), traits: ['archer'] } } } })
    yard.hydrateDrillFaces(kv)
    assert.equal(bustOf(id), kidBust(id, 'g', ['archer']))
    noteKids([{ id, look: 'w', traits: ['shaman'], parents: ['a', 'b'] }])
    assert.equal(bustOf(id), kidBust(id, 'w', ['shaman']))
    yard.hydrateDrillFaces(kv)
    assert.equal(bustOf(id), kidBust(id, 'w', ['shaman']))
  })
  it('다른판에 데려간 clan도 ID에 든 출생seed로 원래 가문 증거를 찾는다', () => {
    const id = 'clan-g-71-kid-57-original', e = entry('마루', 'g', 99)
    const kv = memory({ [KEY]: { h: { [id]: e } }, 'hanbal.realm.clan': { '71:kid-57-original': { name: e.name, look: e.look, traits: ['archer'] } } })
    assert.deepEqual(yard.hydrateDrillFaces(kv).unknown, [])
    assert.equal(bustOf(id), kidBust('kid-57-original', 'g', ['archer']))
  })
  it('반복paint에서 같은 슬롯 JSON을 다시 파싱하지 않는다', () => {
    const id = 'kid-57-memo', e = entry(), kv = memory({ [KEY]: { h: { [id]: e } }, 'hanbal.realm.v2': { realm: { seed: 71, heroes: { [id]: { name: e.name, look: e.look, traits: ['archer'] } } } } })
    const parse = JSON.parse, target = kv.m.get('hanbal.realm.v2')
    let count = 0
    JSON.parse = ((s: string, ...rest: unknown[]) => { if (s === target) count++; return Reflect.apply(parse, JSON, [s, ...rest]) }) as typeof JSON.parse
    try { yard.hydrateDrillFaces(kv); yard.hydrateDrillFaces(kv); yard.loadDrill(kv); assert.equal(count, 1) } finally { JSON.parse = parse }
  })
})
