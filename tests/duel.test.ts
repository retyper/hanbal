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
