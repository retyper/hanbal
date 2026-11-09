/**
 * 장수 겨루기 시험판의 셈 (src/duel/sim.ts) — 결정론 · 손이 값을 갖는지 · 아무것도 안 하면 지는지.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createDuel, stepDuel, type Act, type Duel } from '../src/duel/sim.ts'
import { P } from '../src/tune/params.ts'

type Bot = (d: Duel) => Act | undefined

function play(seed: number, bot: Bot, muMe = 5, muFoe = 5): Duel {
  const d = createDuel({ seed, muMe, muFoe })
  while (d.over === null) stepDuel(d, bot(d))
  return d
}

/** 다 읽는 손 — 크게 휘두르기는 먼저 끊고, 나머지는 타격 순간에 받아치고, 빈틈에 친다 */
const master: Bot = (d) => {
  const m = d.foe.move
  if (m !== null) {
    if (m.kind === 'heavy' && d.t === m.t0 + 2) return 'strike'
    if (d.t === m.strikeAt) return 'parry'
    return undefined
  }
  if (d.t < d.foe.openUntil && d.t >= d.me.lockUntil) return 'strike'
  return undefined
}
/** 늘 피하기만 — 안전하지만 크게 못 얻는다 */
const coward: Bot = (d) => (d.foe.move !== null && d.t === d.foe.move.strikeAt - 6 ? 'dodge' : d.t < d.foe.openUntil && d.t >= d.me.lockUntil ? 'strike' : undefined)
/** 마구 누르기 */
const masher: Bot = (d) => (['parry', 'strike', 'dodge'] as const)[d.t % 3]
const idle: Bot = () => undefined

test('같은 시드 + 같은 손 = 같은 판 (결정론)', () => {
  for (const bot of [master, coward, masher, idle]) {
    const a = play(7, bot)
    const b = play(7, bot)
    assert.deepEqual(a.events, b.events)
    assert.equal(a.over, b.over)
  }
})

test('아무것도 안 하면 진다', () => {
  for (let s = 1; s <= 20; s++) assert.equal(play(s, idle).over, 'lose', `seed ${s}`)
})

test('다 읽는 손은 같은 무예의 적장을 이긴다', () => {
  let win = 0
  for (let s = 1; s <= 50; s++) if (play(s, master).over === 'win') win++
  assert.ok(win >= 45, `master won ${win}/50`)
})

test('마구 누르기는 다 읽는 손보다 못하다', () => {
  let mash = 0
  let mas = 0
  for (let s = 1; s <= 50; s++) {
    if (play(s, masher).over === 'win') mash++
    if (play(s, master).over === 'win') mas++
  }
  assert.ok(mash < mas - 15, `masher ${mash} vs master ${mas}`)
})

test('피하기만 하면 지지는 않아도 다 읽는 손만큼 못 얻는다', () => {
  const sum = (bot: Bot): number => { let x = 0; for (let s = 1; s <= 30; s++) { const d = play(s, bot); x += d.me.poise - d.foe.poise } return x }
  assert.ok(sum(master) > sum(coward), 'master margin should exceed coward margin')
})

test('판 길이가 넘지 않는다', () => {
  const d = play(3, coward)
  assert.ok(d.t <= Math.round(P.duel.length))
})
