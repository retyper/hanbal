/**
 * 장수 겨루기 시험판 2판의 셈 (src/duel/sim.ts) — 결정론 · 손이 값을 갖는지 · 못 막으면 지는지.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createDuel, stepDuel, type Duel, type Tap } from '../src/duel/sim.ts'
import { P } from '../src/tune/params.ts'

type Bot = (d: Duel) => Tap | undefined

export function play(seed: number, bot: Bot, muMe = 5, muFoe = 5): Duel {
  const d = createDuel({ seed, muMe, muFoe })
  while (d.over === null) stepDuel(d, bot(d))
  return d
}

/** 고리가 닿는 순간 그 원을 누르는 손 (off = 늦게 누르는 틱) · 연타는 tapGap 마다 */
const timed = (off: number): Bot => (d) => {
  if (d.phase === 'rush') return d.t % Math.round(P.duel.tapGap) === 0 ? { x: 0.5, y: 0.5 } : undefined
  const c = d.cues.find((x) => x.done === null && d.t === x.hitAt + off)
  return c === undefined ? undefined : { x: c.x, y: c.y }
}
const idle: Bot = () => undefined
/** 화면 아무 데나 마구 누르기 */
const masher: Bot = (d) => ({ x: ((d.t * 37) % 100) / 100, y: ((d.t * 61) % 100) / 100 })

test('같은 시드 + 같은 손 = 같은 판 (결정론)', () => {
  for (const bot of [timed(0), timed(7), masher, idle]) {
    const a = play(7, bot)
    const b = play(7, bot)
    assert.deepEqual(a.events, b.events)
    assert.equal(a.over, b.over)
  }
})

test('못 막으면 맞다가 진다 — 적장은 지치지도 않는다', () => {
  for (let s = 1; s <= 20; s++) {
    const d = play(s, idle)
    assert.equal(d.over, 'kod', `seed ${s}`)
    assert.equal(d.stats.rushHit + d.stats.crit, 0)
  }
})

test('완벽히 맞추는 손은 치명공격으로 KO 를 낸다', () => {
  let ko = 0
  for (let s = 1; s <= 30; s++) if (play(s, timed(0)).over === 'ko') ko++
  assert.ok(ko >= 28, `ko ${ko}/30`)
})

test('막기만 하는 손(정확은 못 함)도 적장을 지치게 해 연타로 친다', () => {
  const d = play(3, timed(7))
  assert.ok(d.stats.good > 0)
  assert.equal(d.stats.crit, 0)
  assert.ok(d.stats.rushHit > 0, 'rush should happen from good blocks')
})

test('마구 누르기는 막는 손보다 못하다', () => {
  let mash = 0
  let good = 0
  for (let s = 1; s <= 30; s++) {
    const a = play(s, masher)
    const b = play(s, timed(7))
    mash += a.me.hp - a.foe.hp
    good += b.me.hp - b.foe.hp
  }
  assert.ok(mash < good - 30 * 20, `masher ${mash} vs blocker ${good}`)
})

test('판은 60초를 넘지 않는다', () => {
  const d = play(3, timed(7))
  assert.ok(d.t <= Math.round(P.duel.length))
})

// ── 본편 연결 — 손으로 치른 겨루기의 끝이 굴림을 대신한다 (tactics.ts · RoundOrder.duel)
import { fightRounds, type Side } from '../src/realm/tactics.ts'
const side = (player: boolean, mu: number): Side => ({
  F: 300, mix: { spear: 1 }, morale: 1, hero: { id: player ? 'me' : 'foe', mu, ryak: 5, coward: false }, hungry: false, specials: [], water: false, player, seen: true, grain: 1000,
})

test('손으로 이긴 겨루기는 무예가 한참 낮아도 이긴다 · 진 겨루기는 진다', () => {
  for (let s = 1; s <= 20; s++) {
    // 첫 합의 우리 겨루기 결과 (뒤 합에 적장이 따로 겨루기를 걸 수 있어 판 전체의 duel 말고 첫 합을 본다)
    const ours = (r: ReturnType<typeof fightRounds>): string | undefined => r.rounds?.[0]?.acts?.find((x) => x.s === 'a' && x.c === 'duel')?.res
    assert.equal(ours(fightRounds(side(true, 6), side(false, 10), `t${s}`, s, 0, { cmds: [{ lead: 'duel', duel: 'win' }] })), 'won', `seed ${s} win`)
    assert.equal(ours(fightRounds(side(true, 10), side(false, 6), `t${s}`, s, 0, { cmds: [{ lead: 'duel', duel: 'lose' }] })), 'lost', `seed ${s} lose`)
  }
})

test('손 겨루기 결과가 없으면(비김) 예전 굴림 그대로', () => {
  for (let s = 1; s <= 10; s++) {
    const a = fightRounds(side(true, 7), side(false, 7), `u${s}`, s, 0, { cmds: [{ lead: 'duel' }] })
    const b = fightRounds(side(true, 7), side(false, 7), `u${s}`, s, 0, { cmds: [{ lead: 'duel' }] })
    assert.deepEqual(a.duel, b.duel)
  }
})

// ── 배우는 판 — 장수 깃발은 겨루기 → 사로잡기 하나씩 · 겨루기에 져도 장수는 안 쓰러진다 (형 11-09)
import { leadOptions } from '../src/realm/tactics.ts'
test('배우는 판: 첫 합은 겨루기 하나 · 다음 합은 사로잡기 하나 (무예 조건 없이)', () => {
  const me = { ...side(true, 3), lesson: true as const, capture: 'sure' as const }
  const foe = side(false, 8)
  assert.deepEqual(leadOptions(me, foe, new Set(), false), ['duel'])
  assert.deepEqual(leadOptions(me, foe, new Set(['duel']), false), ['capture'])
})
test('배우는 판: 겨루기는 아무도 쓰러뜨리지 않고 다음 합에 사로잡기가 된다', () => {
  const me = { ...side(true, 3), lesson: true as const, capture: 'sure' as const }
  const r = fightRounds(me, side(false, 8), 'lesson', 1, 0, { cmds: [{ lead: 'duel', duel: 'lose' }, { lead: 'capture' }] })
  assert.equal(r.captured, 'd')
})
test('배우는 판: 겨루기에 이겨도 적장이 쓰러지지 않아 다음 합에 잡힌다', () => {
  const me = { ...side(true, 3), lesson: true as const, capture: 'sure' as const }
  for (let s = 1; s <= 10; s++) {
    const r = fightRounds(me, side(false, 8), `lw${s}`, s, 0, { cmds: [{ lead: 'duel', duel: 'win' }, { lead: 'capture' }] })
    assert.equal(r.captured, 'd', `seed ${s}`)
  }
})
