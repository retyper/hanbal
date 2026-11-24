// 73-PHANTOM 환영난무는 장수가 직접 적에서 적으로 순간이동해 벤다 (형 11-25 「순간이동해서 때리던 걸 아예 없애 버리면 어떡하냐」) — 새 규칙 판만 · 옛 판은 그대로
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { HAEBI_ULT } from '../src/tune/params.ts'
import { createHaebi, stepHaebi, spawnMob, KIT_RULES, ANCHOR_RULES, PHANTOM_RULES, type HaebiOpts, type HaebiRun, type Mob } from '../src/raid/haebi.ts'

const BASE: HaebiOpts = { stage: 'forest', simRules: '56B', kitRules: KIT_RULES, anchorRules: ANCHOR_RULES }
const mk = (opts: HaebiOpts) => {
  const s = createHaebi(5, 'stage', 'dagger', opts)
  s.level = 9; s.nextElite = 1e9; s.nextBarrage = 1e9; s.spawn = 1e9
  for (let i = 0; i < 4; i++) { spawnMob(s, 'club', undefined, true); const e = s.enemies[s.enemies.length - 1] as Mob; e.x = 150 + i * 70; e.y = 100 + (i % 2) * 90; e.hp = e.max = 1e6; e.cd = 99 }
  return s
}
/** 비기를 누르고 끝날 때까지 돌리며 (장수 위치 · 피해 시도) 를 모은다 */
function run(s: HaebiRun) {
  const x0 = s.x, y0 = s.y, trail: { x: number; y: number; inv: number }[] = []
  let pressed = false, started = false
  for (let i = 0; i < 600; i++) {
    stepHaebi(s, { x: 0, y: 0, skill: !pressed }, 1 / 120); pressed = true
    if (s.ult) started = true
    if (s.ult) trail.push({ x: s.x, y: s.y, inv: s.inv })
    if (started && !s.ult) break
  }
  return { x0, y0, trail }
}

test('73-PHANTOM: 새 규칙에서 장수가 적 곁으로 옮겨 다니고, 끝나면 처음 자리로 돌아온다', () => {
  const s = mk({ ...BASE, phantomRules: PHANTOM_RULES }); s.x = 40; s.y = 200
  const { x0, y0, trail } = run(s)
  assert.equal(s.phantom, true)
  assert.ok(trail.length > 2)
  assert.ok(trail.some(p => Math.hypot(p.x - x0, p.y - y0) > 60), '적 곁으로 옮겨 감')
  assert.ok(new Set(trail.map(p => `${p.x},${p.y}`)).size >= 3, '적마다 자리가 다르다')
  assert.equal(s.x, x0); assert.equal(s.y, y0)
  assert.ok(s.inv >= HAEBI_ULT.phantom.landInv - 1 / 60, '착지 무적')
})

test('73-PHANTOM: 옮겨 다니는 동안은 맞지 않는다', () => {
  const s = mk({ ...BASE, phantomRules: PHANTOM_RULES }); s.x = 40; s.y = 200
  const { trail } = run(s)
  assert.ok(trail.every(p => p.inv > 0), '걸음마다 무적')
  const hp = s.hp; s.inv = 0.2
  const e = s.enemies[0]!; e.cd = 0; e.x = s.x + 5; e.y = s.y
  stepHaebi(s, { x: 0, y: 0 }, 1 / 120)
  assert.equal(s.hp, hp, '착지 무적 동안 피해 0')
})

test('73-PHANTOM: 옛 62-ANCHOR 판은 장수가 제자리 그대로', () => {
  const s = mk(BASE); s.x = 40; s.y = 200
  const { x0, y0, trail } = run(s)
  assert.equal(s.phantom, undefined)
  assert.ok(trail.every(p => p.x === x0 && p.y === y0))
})
