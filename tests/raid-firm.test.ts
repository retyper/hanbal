// 79-FIRM 설치물은 단단하다 (형 11-26 「보이지 않는 이격거리 · 밀 때 미끄러짐 · 자동 재건설 너무 빠름 · 근처에서 상호작용으로 재건설」)
// 틈 없이 맞닿는다 · 네모 몸(그림 발치) · 민 걸음 그대로 따라온다 · 잔해는 장수가 곁에서 누르고 있어야 선다
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { HAEBI_FIRM as FM, HAEBI_PALISADE as WL } from '../src/tune/params.ts'
import { createHaebi, stepHaebi, KIT_RULES, MAP_RULES, BUILD_RULES, BUILD2_RULES, WALL_RULES, GAP_RULES, FIRM_RULES, type HaebiRun, type RunInput } from '../src/raid/haebi.ts'
import { standing, rebuildOf, boxGap, type BuildKind, type Structure } from '../src/raid/build.ts'
import { goldenRun } from './raid-golden-kit.ts'

function quiet(firm = true) {
  const s = createHaebi(5, 'stage', 'axe', { stage: 'forest', simRules: '56B', kitRules: KIT_RULES, mapRules: MAP_RULES, buildRules: BUILD_RULES, build2Rules: BUILD2_RULES, wallRules: WALL_RULES, gapRules: GAP_RULES, ...(firm ? { firmRules: FIRM_RULES } : {}) })
  s.spawn = s.nextElite = s.nextBarrage = 1e9
  for (const k of Object.keys(s.cool) as (keyof typeof s.cool)[]) s.cool[k] = 1e9
  s.ranks.beacon = 1; s.ranks.tower = 1
  return s
}
const put = (s: HaebiRun, kind: BuildKind, x: number, y: number) => { s.build!.items.push({ id: s.build!.nextId++, kind, x, y, hp: 300, max: 300, down: 0, cd: 1e9, flash: 0, push: 0, w: true }); return s.build!.items[s.build!.items.length - 1]! }
const step = (s: HaebiRun, seconds: number, input: RunInput = { x: 0, y: 0 }) => { for (let i = 0; i < seconds * 120; i++) stepHaebi(s, input, 1 / 120) }
/** 두 네모 몸 사이 빈 거리 (가로·세로 가운데 큰 쪽 · 겹치면 음수) */
const boxSpace = (p: Structure, q: Structure) => {
  const a = FM.body[p.kind], b = FM.body[q.kind]
  return Math.max(Math.abs(q.x - p.x) - a.w - b.w, Math.abs(q.y - b.lift - (p.y - a.lift)) - a.d - b.d)
}

test('79-FIRM 겹쳐 놓은 건물 둘이 맞닿기까지만 벌어진다 (78-GAP 틈이 없다)', () => {
  const s = quiet(); s.x = 600; s.y = 800
  const a = put(s, 'beacon', 600, 500), b = put(s, 'beacon', 610, 500)
  step(s, 1)
  const g = boxSpace(a, b)
  assert.ok(g > -1 && g < 1, `빈 거리 ${g}`)
})

test('79-FIRM 장수 몸은 그림 발치 네모에 막힌다 (닿는 곳 = 보이는 발치)', () => {
  const s = quiet(); const t = put(s, 'tower', 600, 500), k = FM.body.tower
  // 아래에서 위로 걸어 올라간다 — 네모 아랫면(발밑 위 lift − d)에서 몸 둘레만큼 아래에 멈춰 민다
  s.x = 600; s.y = 600
  step(s, 1.5, { x: 0, y: -1 })
  assert.ok(Math.abs(boxGap(t, s.x, s.y, WL.heroR)) < 1.5, `틈 ${boxGap(t, s.x, s.y, WL.heroR)}`)
  assert.ok(s.y > t.y - k.lift + k.d, `장수 ${s.y} 네모 아랫면 ${t.y - k.lift + k.d}`)
})

test('79-FIRM 모서리를 밀어도 민 방향 그대로 따라온다 (옆으로 빠지지 않는다)', () => {
  for (const off of [0, 1, -1]) {
    const s = quiet(); const t = put(s, 'beacon', 700, 500), k = FM.body.beacon
    // 오른쪽으로 민다 · 장수 키 높이를 네모 모서리 가까이에 (off = 위·가운데·아래 모서리)
    s.x = 700 - k.w - WL.heroR - 20; s.y = 500 - k.lift + off * (k.d + WL.heroR - 4)
    const y0 = t.y, x0 = t.x
    step(s, 2, { x: 1, y: 0 })
    assert.ok(t.x - x0 > 40, `off ${off} 앞으로 ${t.x - x0}`)
    assert.ok(Math.abs(t.y - y0) < .5, `off ${off} 옆으로 ${t.y - y0}`)
    assert.ok(Math.abs(s.y - (500 - k.lift + off * (k.d + WL.heroR - 4))) < .5, `off ${off} 장수도 옆으로 안 빠진다 ${s.y}`)
  }
})

test('79-FIRM 무너진 것은 저절로 서지 않는다 · 곁에서 누르고 있으면 fix 초에 선다 · 멀면 안 선다', () => {
  const s = quiet(); const b = put(s, 'beacon', 600, 500)
  s.x = 600; s.y = 600
  b.hp = -1; step(s, .05)
  assert.ok(!standing(b) && b.down > 0)
  step(s, rebuildOf('beacon') + 5)
  assert.ok(!standing(b), '저절로 서지 않는다')
  // 멀리서 누르기 — 안 선다
  step(s, FM.fix + 1, { x: 0, y: 0, fix: true })
  assert.ok(!standing(b), '손이 안 닿으면 안 선다')
  // 곁으로 와서 누른다
  s.y = 500 - FM.body.beacon.lift + FM.body.beacon.d + WL.heroR + FM.reach / 2
  step(s, FM.fix * .5, { x: 0, y: 0, fix: true })
  assert.ok(!standing(b) && b.down > 0 && b.down < rebuildOf('beacon'), '반쯤 찼다')
  const half = b.down
  step(s, 1, { x: 0, y: 0 })
  assert.equal(b.down, half, '떼면 찬 만큼 남는다')
  step(s, FM.fix * .5 + .1, { x: 0, y: 0, fix: true })
  assert.ok(standing(b) && b.hp === b.max && b.hp > 0, '다시 서고 체력이 찬다')
})

test('79-FIRM 같은 씨앗은 같은 판 · 78-GAP 판과는 다르다', () => {
  const h = (x: object) => createHash('sha256').update(JSON.stringify(goldenRun('forest', 'axe', 7, 60, x))).digest('hex')
  const firm = { wallRules: WALL_RULES, gapRules: GAP_RULES, firmRules: FIRM_RULES }
  assert.equal(h(firm), h(firm))
  assert.notEqual(h(firm), h({ wallRules: WALL_RULES, gapRules: GAP_RULES }))
})
