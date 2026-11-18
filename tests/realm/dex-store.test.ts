/**
 * 영웅전 표의 저장 (src/ui/realm/dex.ts loadDex · recordDex) 과 도깨비 도장 넘겨받기 (src/raid/link.ts stampDemons)
 * — 각성 v2 의 바닥 (docs/realm/study-20261118/30-PROPOSAL.md 1절 ⑥ · ⑩ · 7-1 가2 · 가3)
 *
 *  - 옛 영웅전 저장은 읽어도 그대로다 · 아는 비트 일곱(127)만 남기고 모르는 비트는 버린다
 *  - 도깨비 도장(32)과 두목 만남(64)이 읽고 훑고 다시 써도 남는다 (예전에는 31 로 잘려 사라졌다)
 *  - 이 길이 생기기 전에 깬 목책은 표를 처음 읽을 때 도장으로 넘겨받는다 · 이름난 장수만 · 목책만
 *  - 기록을 지우면 열전 기록도 지워져 도장이 되살아나지 않는다
 */
import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'

const store = new Map<string, string>()
;(globalThis as Record<string, unknown>)['localStorage'] = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  key: (i: number) => [...store.keys()][i] ?? null,
  get length() { return store.size },
}
// wipeLocal 은 Object.keys(localStorage) 로 칸을 센다 — 시험 저장소도 칸이 열쇠로 보이게 한다
const keyed = new Proxy(globalThis.localStorage, {
  ownKeys: () => [...store.keys()],
  getOwnPropertyDescriptor: (_t, k) => (typeof k === 'string' && store.has(k) ? { enumerable: true, configurable: true, value: store.get(k) } : undefined),
})
;(globalThis as Record<string, unknown>)['localStorage'] = keyed

const { loadDex, recordDex } = await import('../../src/ui/realm/dex.ts')
const { DEX_AWOKE, DEX_BOSS, DEX_DEMON, DEX_HEARD, DEX_MET, DEX_SERVED } = await import('../../src/realm/dex.ts')
const { sealsOf } = await import('../../src/realm/person.ts')
const { DEMON_STAGE, DEX_KEY, META_KEY, ROSTER_KEY, stampDemons } = await import('../../src/raid/link.ts')
const { loadMeta, record, saveMeta } = await import('../../src/raid/meta.ts')
const { wipeLocal } = await import('../../src/ui/realm/wipe.ts')
const { byeonhanMini } = await import('../../src/realm/data/regions/byeonhan-mini.ts')

const rawDex = (): Record<string, { f: number; b?: string }> => JSON.parse(store.get(DEX_KEY) ?? '{}') as Record<string, { f: number; b?: string }>
/** 열전에서 그 장수로 그 스테이지들을 깬 기록 */
function cleared(by: Record<string, readonly ('forest' | 'ford' | 'palisade')[]>): void {
  const m = loadMeta()
  for (const [hero, stages] of Object.entries(by)) for (const s of stages) record(m, s, 0, true, 1150, hero)
  saveMeta(m)
}

beforeEach(() => store.clear())

describe('영웅전 표 읽기', () => {
  it('옛 저장은 그대로 읽힌다 — 네 칸 · 각성해 봄 · 처음 오른 판', () => {
    const old = { 'mh-onjo': { f: 15, b: 'mahan' }, 'mh-ogan': { f: 31, b: 'mahan' }, 'guya-1': { f: 3, b: 'byeonhan-mini' }, 'wander-01': { f: 1 } }
    store.set(DEX_KEY, JSON.stringify(old))
    assert.deepEqual(loadDex(), old)
    assert.deepEqual(rawDex(), old, '읽기만으로 표가 바뀌지 않는다')
  })

  it('아는 비트 일곱만 남긴다 — 도깨비 도장 32 · 두목 만남 64 는 남고 모르는 비트는 버린다', () => {
    store.set(DEX_KEY, JSON.stringify({
      'mh-onjo': { f: 15 | DEX_AWOKE | DEX_DEMON | DEX_BOSS, b: 'mahan' }, 'tut-haebi': { f: DEX_DEMON },
      'mh-ogan': { f: 8 | 128 | 256 }, bad: { f: 'x' }, zero: { f: 0 }, none: null, neg: { f: -4 },
    }))
    const dex = loadDex()
    assert.equal(dex['mh-onjo']!.f, 127)
    assert.deepEqual(dex['tut-haebi'], { f: DEX_DEMON })
    assert.equal(dex['mh-ogan']!.f, 8)
    for (const id of ['bad', 'zero', 'none', 'neg']) assert.equal(dex[id], undefined, id)
  })

  it('깨진 저장은 빈 표다', () => {
    store.set(DEX_KEY, '{oops')
    assert.deepEqual(loadDex(), {})
    store.set(DEX_KEY, '"text"')
    assert.deepEqual(loadDex(), {})
  })

  it('판을 훑어 다시 써도 도장이 남는다 (읽기 → scanDex → 쓰기)', () => {
    const r = byeonhanMini(7)
    const mine = Object.values(r.heroes).filter((h) => h.faction === r.player).sort((a, b) => (a.id < b.id ? -1 : 1))[0]!
    store.set(DEX_KEY, JSON.stringify({ [mine.id]: { f: DEX_DEMON | DEX_BOSS }, 'tut-haebi': { f: DEX_DEMON } }))
    recordDex(r)
    const saved = rawDex()
    assert.equal(saved[mine.id]!.f, DEX_HEARD | DEX_MET | DEX_SERVED | DEX_DEMON | DEX_BOSS)
    assert.deepEqual(saved['tut-haebi'], { f: DEX_DEMON })
  })
})

describe('도깨비 도장 — 열전의 목책 깸을 영웅전 표로', () => {
  it('목책을 깬 그 장수에게 찍힌다 · 숲과 여울만으로는 아니다 · 지면 아니다', () => {
    assert.equal(DEMON_STAGE, 'palisade')
    cleared({ 'mh-soseono': ['forest', 'ford'], 'gj-heo': ['forest', 'ford', 'palisade'] })
    const m = loadMeta()
    record(m, 'palisade', 0, false, 600, 'sr-aryeong')
    saveMeta(m)
    assert.equal(stampDemons(), true)
    assert.deepEqual(rawDex(), { 'gj-heo': { f: DEX_DEMON } })
    assert.equal(stampDemons(), false, '두 번째는 새로 찍을 것이 없다')
  })

  it('있는 칸은 그대로 두고 비트만 더한다', () => {
    store.set(DEX_KEY, JSON.stringify({ 'gj-heo': { f: 15 | DEX_AWOKE, b: 'gujibong' }, 'gj-suro': { f: 15, b: 'gujibong' } }))
    cleared({ 'gj-heo': ['palisade'] })
    stampDemons()
    assert.deepEqual(rawDex(), { 'gj-heo': { f: 15 | DEX_AWOKE | DEX_DEMON, b: 'gujibong' }, 'gj-suro': { f: 15, b: 'gujibong' } })
    assert.deepEqual(sealsOf(loadDex(), 'gj-heo'), { flame: true, demon: true, both: true })
    assert.deepEqual(sealsOf(loadDex(), 'gj-suro'), { flame: false, demon: false, both: false })
  })

  it('이름난 장수만 — 판마다 새로 나는 자녀 · 모르는 id 는 안 찍는다 · 해비와 배우는 판의 장수는 찍는다', () => {
    cleared({ 'kid-3-5': ['palisade'], 'someone-else': ['palisade'], 'tut-haebi': ['palisade'], 'tut-malgalgi': ['palisade'] })
    stampDemons()
    assert.deepEqual(Object.keys(rawDex()).sort(), ['tut-haebi', 'tut-malgalgi'])
    // 배우는 판의 말갈기로 목책을 깼으면 영남 판의 말갈기도 도깨비를 잡은 사람이다 (20분 판을 제 손으로 깼다 · 뒷문이 아니다)
    assert.deepEqual(sealsOf(loadDex(), 'sabeol-1'), { flame: false, demon: true, both: false })
  })

  it('깨진 표는 덮어쓰지 않는다 · 열전 기록이 없으면 아무 일도 없다', () => {
    assert.equal(stampDemons(), false)
    assert.equal(store.has(DEX_KEY), false)
    cleared({ 'gj-heo': ['palisade'] })
    for (const bad of ['{oops', '[1,2]', '"text"', '7']) {
      store.set(DEX_KEY, bad)
      assert.equal(stampDemons(), false, bad)
      assert.equal(store.get(DEX_KEY), bad)
    }
  })

  it('넘겨받기: 이 길이 생기기 전에 깬 목책은 영웅전 표를 읽을 때 도장이 된다 · 저장에도 남는다', () => {
    store.set(DEX_KEY, JSON.stringify({ 'sr-aryeong': { f: 15, b: 'seorabeol' } }))
    cleared({ 'sr-aryeong': ['forest', 'ford', 'palisade'], 'sr-hogong': ['forest'] })
    const dex = loadDex()
    assert.deepEqual(dex['sr-aryeong'], { f: 15 | DEX_DEMON, b: 'seorabeol' })
    assert.equal(dex['sr-hogong'], undefined)
    assert.deepEqual(rawDex()['sr-aryeong'], { f: 15 | DEX_DEMON, b: 'seorabeol' })
  })

  it('넘겨받기: 열전 기록이 바뀌면 다음에 읽을 때 따라온다 (다른 탭에서 깬 목책)', () => {
    cleared({ 'gj-heo': ['palisade'] })
    assert.deepEqual(Object.keys(loadDex()), ['gj-heo'])
    cleared({ 'gj-heo': ['palisade'], 'gj-suro': ['palisade'] })
    assert.deepEqual(Object.keys(loadDex()).sort(), ['gj-heo', 'gj-suro'])
  })
})

describe('기록 지우기 — 열전 기록까지 (가2)', () => {
  it('열전의 금 · 상점 · 깬 스테이지 · 명부가 지워지고, 지운 뒤에 도장이 되살아나지 않는다', () => {
    cleared({ 'gj-heo': ['forest', 'ford', 'palisade'] })
    store.set(ROSTER_KEY, JSON.stringify([{ id: 'gj-heo', name: '허황옥', home: '가락의 장수', bust: 'l-L3-heo-hwangok', sprite: 'heo', kit: 'bow', video: false }]))
    store.set('hanbal.realm.mute', '1')
    assert.ok((loadDex()['gj-heo']!.f & DEX_DEMON) !== 0)
    assert.equal(wipeLocal(), 0)
    assert.equal(store.has(META_KEY), false)
    assert.equal(store.has(ROSTER_KEY), false)
    assert.equal(store.has(DEX_KEY), false)
    assert.equal(store.get('hanbal.realm.mute'), '1', '설정은 남는다')
    assert.deepEqual(loadDex(), {})
    assert.equal(stampDemons(), false)
    assert.equal(store.has(DEX_KEY), false)
  })
})
