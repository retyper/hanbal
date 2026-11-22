// 61-SOLID 부딪히는 장식 (형 11-22 「장애물을 무기도 나도 적도 다 통과하네」 → 장수·적은 막고 무기는 통과) — 새 규칙 판만 · 옛 판 기록은 그대로
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { HAEBI_WIDE as W, HAEBI_PALISADE as WL } from '../src/tune/params.ts'
import { createHaebi, stepHaebi, choose, spawnMob, KIT_RULES, MAP_RULES, SOLID_RULES, type HaebiOpts, type HaebiRun } from '../src/raid/haebi.ts'
import { solidsFor, pushOutOfSolids, scatterProps } from '../src/raid/props.ts'
import { botInput, botChoice } from '../src/raid/haebi-replay.ts'

const hash = (x: unknown) => createHash('sha256').update(JSON.stringify(x)).digest('hex')
const BASE: HaebiOpts = { stage: 'forest', simRules: '55-GUMIHO', permanentAwake: false, appearanceAwake: true, kitRules: KIT_RULES, mapRules: MAP_RULES }
const SOLID: HaebiOpts = { ...BASE, blockRules: SOLID_RULES }
const inside = (s: HaebiRun, x: number, y: number, radius: number) => (s.solids ?? []).some(o => Math.hypot(x - Math.max(o.x0, Math.min(o.x1, x)), y - o.y) < o.r + radius - 1e-6)

function play(opts: HaebiOpts, seconds: number) {
  const s = createHaebi(11, 'stage', 'axe', opts)
  for (let i = 0; i < seconds * 120 && s.state === 'playing'; i++) { if (s.offers.length) choose(s, botChoice(s, 'storm')); else stepHaebi(s, botInput(s), 1 / 120) }
  return s
}

test('61-SOLID: only the new rule gets solids · old wide runs keep decorations as pictures', () => {
  assert.equal(createHaebi(1, 'stage', 'axe', BASE).solids, undefined)
  const s = createHaebi(1, 'stage', 'axe', SOLID)
  assert.ok((s.solids?.length ?? 0) > 10, 'forest has trees and rocks that block')
  // 한 장짜리 판(넓은 맵 없음)에는 붙지 않는다
  const { mapRules: _wide, ...noWide } = SOLID; void _wide
  assert.equal(createHaebi(1, 'stage', 'axe', noWide).solids, undefined)
  // 갈대·덤불처럼 표가 null 인 장식은 막지 않는다
  for (const stage of ['forest', 'ford', 'palisade', 'snow', 'fortress']) {
    const blocking = scatterProps(stage).filter(p => (W.solid[stage] ?? [])[p.kind])
    assert.equal(solidsFor(stage).length, blocking.length, stage)
  }
})

test('61-SOLID: a body inside a trunk is pushed just outside, a body outside is left alone', () => {
  const o = { x0: 100, x1: 140, y: 200, r: 20 }
  const b = { x: 120, y: 205 }; pushOutOfSolids([o], b, 10)
  assert.ok(Math.abs(Math.hypot(b.x - 120, b.y - 200) - 30) < 1e-6, 'pushed to the rim along the normal')
  const c = { x: 300, y: 300 }; pushOutOfSolids([o], c, 10); assert.deepEqual(c, { x: 300, y: 300 })
  const d = { x: 120, y: 200 }; pushOutOfSolids([o], d, 10); assert.equal(d.y, 230, 'dead centre goes in front (down)')
})

test('61-SOLID: the hero cannot stand inside a solid and walking into one stops at its rim', () => {
  const s = createHaebi(3, 'stage', 'axe', SOLID)
  s.enemies.length = 0; s.spawn = 1e9
  const o = s.solids!.find(q => q.x1 - q.x0 > 20)!
  s.x = (o.x0 + o.x1) / 2; s.y = o.y; s.inv = 99
  stepHaebi(s, { x: 0, y: 0 }, 1 / 120)
  assert.ok(!inside(s, s.x, s.y, WL.heroR), 'pushed out on the next step')
  // 밑동을 향해 계속 걸어도 들어가지 못한다
  s.x = (o.x0 + o.x1) / 2; s.y = o.y + o.r + WL.heroR + 40
  for (let i = 0; i < 240; i++) stepHaebi(s, { x: 0, y: -1 }, 1 / 120)
  assert.ok(!inside(s, s.x, s.y, WL.heroR))
  assert.ok(s.y >= o.y + o.r + WL.heroR - 1, 'stops at the rim')
})

test('61-SOLID: enemies never rest inside a solid', () => {
  const s = play(SOLID, 40)
  for (const e of s.enemies) if (e.hp > 0 && !e.giant) assert.ok(!inside(s, e.x, e.y, e.kind === 'elite' || e.kind === 'boss' ? WL.bigR : WL.mobR), `${e.kind} at ${e.x},${e.y}`)
  void spawnMob
})

test('61-SOLID: same seed and inputs give the same run (determinism)', () => {
  assert.equal(hash(play(SOLID, 30)), hash(play(SOLID, 30)))
  // 규칙이 다르면 판이 갈린다 (막힘이 실제로 판에 들어간다)
  assert.notEqual(hash(play(BASE, 30)), hash(play(SOLID, 30)))
})
