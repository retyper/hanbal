/**
 * 손으로 하는 저장 · 불러오기 (ui/realm/saves.ts · 형 10-26: "림월드랑 문명에도 있듯이 수동 저장이랑 불러오기도")
 *
 *  - 파일 한 장으로 쓰고 읽으면 같은 판이 나온다
 *  - 모양이 틀린 파일은 거절한다 (판이 바뀌지 않는다)
 *  - 칸 목록 — 쓰기·덮어쓰기·비우기 · 자리가 모자라면 쓰기 전 그대로 (다른 열쇠는 건드리지 않는다)
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { startYeongnam } from '../../src/realm/data/regions/yeongnam.ts'
import {
  SAVE_FV, SAVE_INDEX, cleanLabel, defaultLabel, dropSave, listSaves, makeSaveFile, parseSaveFile, readIndex, readSave, saveFileName, saveKey, serializeSave, writeSave,
  type KV, type Saved,
} from '../../src/ui/realm/saves.ts'

function game(seed = 7): Saved {
  return { v: 2, nation: 'saro', seed, log: [[]], realm: startYeongnam(seed, 'saro'), before: null, report: null, at: '2026-10-26T00:00:00.000Z' }
}

/** localStorage 흉내 — limit 글자를 넘기면 쓰기가 막힌다 (브라우저의 QuotaExceededError) */
class Mem implements KV {
  readonly m = new Map<string, string>()
  readonly limit: number
  readonly failKey: string | null
  constructor(limit = Infinity, failKey: string | null = null) { this.limit = limit; this.failKey = failKey }
  size(): number { let n = 0; for (const [k, v] of this.m) n += k.length + v.length; return n }
  getItem(k: string): string | null { return this.m.get(k) ?? null }
  setItem(k: string, v: string): void {
    if (k === this.failKey) throw new Error('QuotaExceededError')
    const was = this.m.get(k)
    if (this.size() - (was === undefined ? 0 : k.length + was.length) + k.length + v.length > this.limit) throw new Error('QuotaExceededError')
    this.m.set(k, v)
  }
  removeItem(k: string): void { this.m.delete(k) }
}

describe('손 저장 — 파일 한 장', () => {
  it('쓰고 읽으면 같은 판 · 그 계절의 명령까지', () => {
    const g = game()
    const draft = { seed: g.realm.seed, season: g.realm.season, player: g.realm.player, guards: ['x'] }
    const f = makeSaveFile(g, draft, '', '2026-10-26T01:02:03.000Z')
    const p = parseSaveFile(serializeSave(f))
    assert.ok(p.ok)
    assert.equal(serializeSave(p.file), serializeSave(f))
    assert.deepEqual(p.file, JSON.parse(serializeSave(f)))
    assert.deepEqual(p.file.game.realm, JSON.parse(JSON.stringify(g.realm)))
    assert.deepEqual(p.file.draft, draft)
    assert.equal(p.file.fv, SAVE_FV)
  })
  it('다른 판·다른 계절의 명령은 담지 않는다', () => {
    const g = game()
    assert.equal(makeSaveFile(g, { seed: g.realm.seed + 1, season: g.realm.season, player: g.realm.player }, '', '').draft, null)
    assert.equal(makeSaveFile(g, { seed: g.realm.seed, season: g.realm.season + 1, player: g.realm.player }, '', '').draft, null)
    assert.equal(makeSaveFile(g, 'junk', '', '').draft, null)
  })
  it('이름 — 비우면 「1년 봄 · 사로국」, 빈칸을 걷고 한도까지', () => {
    const g = game()
    assert.equal(defaultLabel(g.realm), '1년 봄 · 사로국')
    assert.equal(cleanLabel('   ', g.realm), '1년 봄 · 사로국')
    assert.equal(cleanLabel('  큰  싸움\n전 ', g.realm), '큰 싸움 전')
    assert.ok(cleanLabel('가'.repeat(500), g.realm).length < 100)
  })
  it('파일 이름 — 나라 · 계절, 빈칸·못 쓰는 글자 없이', () => {
    const n = saveFileName(makeSaveFile(game(), null, '', ''))
    assert.equal(n, '칠십팔국-사로국-1년봄.json')
    assert.ok(!/[\s\\/:*?"<>|]/.test(n))
  })
  it('자동 저장 한 판 · 「기록 내보내기」 파일도 받는다', () => {
    const g = game()
    const bare = parseSaveFile(JSON.stringify(g))
    assert.ok(bare.ok && bare.file.game.seed === g.seed && bare.file.label === defaultLabel(g.realm))
    const rec = parseSaveFile(JSON.stringify({ exported: 'x', games: [], save: g, draft: null }))
    assert.ok(rec.ok && rec.file.game.realm.player === 'saro')
    // 옛 판에 log·before·report 가 없어도 열린다
    const { log: _l, before: _b, report: _r, ...thin } = g
    const t = parseSaveFile(JSON.stringify(thin))
    assert.ok(t.ok && Array.isArray(t.file.game.log) && t.file.game.before === null && t.file.game.report === null)
  })
  it('모양이 틀리면 거절한다 — 까닭은 쉬운 말로', () => {
    const g = game()
    const bad: unknown[] = [
      'not json', '[]', '3', 'null', '{}',
      JSON.stringify({ kind: 'hanbal.realm.save', fv: SAVE_FV + 1, game: g }),
      JSON.stringify({ kind: 'hanbal.realm.save', game: g }),
      JSON.stringify({ kind: 'hanbal.realm.save', fv: 1, game: { ...g, realm: null } }),
      JSON.stringify({ ...g, v: 1 }),
      JSON.stringify({ ...g, seed: 'x' }),
      JSON.stringify({ ...g, realm: { ...g.realm, player: 'nobody' } }),
      JSON.stringify({ ...g, realm: { ...g.realm, nodes: undefined } }),
      JSON.stringify({ ...g, before: 5 }),
      JSON.stringify({ save: { v: 2 } }),
    ]
    for (const text of bad) {
      const p = parseSaveFile(text as string)
      assert.equal(p.ok, false, String(text).slice(0, 60))
      if (!p.ok) assert.ok(p.why.length > 0)
    }
  })
})

describe('손 저장 — 칸', () => {
  it('쓰기 · 덮어쓰기 · 비우기 — 목록이 칸을 따라간다', () => {
    const kv = new Mem()
    kv.setItem('hanbal.realm.v2', 'AUTOSAVE')
    const a = makeSaveFile(game(1), null, '첫째', '2026-10-26T01:00:00.000Z')
    const b = makeSaveFile(game(2), null, '', '2026-10-26T02:00:00.000Z')
    assert.ok(writeSave(kv, 0, a, 6).ok)
    assert.ok(writeSave(kv, 2, b, 6).ok)
    const xs = listSaves(kv, 6)
    assert.equal(xs.length, 6)
    assert.equal(xs[0]?.label, '첫째')
    assert.equal(xs[1], null)
    assert.equal(xs[2]?.label, '1년 봄 · 사로국')
    assert.equal(xs[2]?.name, '사로국')
    assert.equal(xs[2]?.region, 'yeongnam')
    // 덮어쓰기 — 칸 0 이 b 로
    assert.ok(writeSave(kv, 0, b, 6).ok)
    assert.equal(listSaves(kv, 6)[0]?.savedAt, '2026-10-26T02:00:00.000Z')
    const r0 = readSave(kv, 0)
    assert.ok(r0.ok && r0.file.game.seed === 2)
    assert.equal(readIndex(kv).length, 2)
    // 비우기 — 그 칸만
    assert.ok(dropSave(kv, 0))
    assert.equal(listSaves(kv, 6)[0], null)
    assert.equal(kv.getItem(saveKey(0)), null)
    assert.ok(kv.getItem(saveKey(2)) !== null)
    assert.equal(kv.getItem('hanbal.realm.v2'), 'AUTOSAVE')
    assert.equal(readSave(kv, 0).ok, false)
  })
  it('없는 칸 번호는 쓰지 않는다', () => {
    const kv = new Mem()
    const f = makeSaveFile(game(), null, '', '')
    assert.deepEqual(writeSave(kv, 6, f, 6), { ok: false, why: 'slot' })
    assert.deepEqual(writeSave(kv, -1, f, 6), { ok: false, why: 'slot' })
    assert.equal(kv.m.size, 0)
  })
  it('자리가 모자라면 — 아무것도 안 바뀐다 (옛 칸·목록·자동 저장 그대로)', () => {
    const a = makeSaveFile(game(1), null, '옛 판', '2026-10-26T01:00:00.000Z')
    const big = makeSaveFile({ ...game(2), log: [[...Array(4000)].map(() => ({ kind: 'guard', faction: 'saro', node: 'x'.repeat(40) }) as never)] }, null, '', '')
    const room = new Mem()
    room.setItem('hanbal.realm.v2', 'AUTOSAVE')
    assert.ok(writeSave(room, 0, a, 6).ok)
    const kv = new Mem(room.size() + 1000)
    for (const [k, v] of room.m) kv.setItem(k, v)
    const before = new Map(kv.m)
    assert.deepEqual(writeSave(kv, 0, big, 6), { ok: false, why: 'full' }) // 덮어쓰기
    assert.deepEqual(writeSave(kv, 1, big, 6), { ok: false, why: 'full' }) // 빈 칸
    assert.deepEqual(kv.m, before)
  })
  it('목록을 못 쓰면 칸도 되돌린다', () => {
    const kv = new Mem(Infinity, SAVE_INDEX)
    const f = makeSaveFile(game(), null, '', '')
    assert.deepEqual(writeSave(kv, 0, f, 6), { ok: false, why: 'full' })
    assert.equal(kv.getItem(saveKey(0)), null)
    // 목록을 못 쓰면 비우기도 하지 않는다
    const kv2 = new Mem()
    assert.ok(writeSave(kv2, 0, f, 6).ok)
    const locked = new Mem(Infinity, SAVE_INDEX)
    for (const [k, v] of kv2.m) locked.m.set(k, v)
    assert.equal(dropSave(locked, 0), false)
    assert.ok(locked.getItem(saveKey(0)) !== null)
  })
  it('깨진 목록은 빈 목록으로 · 겹친 칸·이상한 줄은 버린다', () => {
    const kv = new Mem()
    kv.setItem(SAVE_INDEX, '{broken')
    assert.deepEqual(readIndex(kv), [])
    kv.setItem(SAVE_INDEX, JSON.stringify([{ n: 1, label: 'a' }, { n: 1, label: 'b' }, { n: -1 }, { n: 0.5 }, 'x', null]))
    const xs = readIndex(kv)
    assert.equal(xs.length, 1)
    assert.equal(xs[0]?.label, 'a')
  })
})
