// 열전 장수 서기 계획 (형 11-23 「기본 idle 은 서 있는 자세 2컷으로 텀 길게 · 가끔 큰 숨 · 개성 있게」) — 화면만 · 칸 고르기만
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { HAEBI_ANIM as A, HAEBI_IDLE as I } from '../src/tune/params.ts'
import { DEFAULT_IDLE, idleEvents, idleSeed, planFrame, spriteName, stripCells, idlePlan, type IdlePlan } from '../src/raid/hero-idle.ts'
import { heroPose, idleFrame } from '../src/raid/hero-motion.ts'
import { createHaebi, stepHaebi, KIT_RULES } from '../src/raid/haebi.ts'

const beom = idlePlan('anim-px/gen-beom.png')!
/** 버릇까지 붙은 띠 (범에 「손톱 살피기」가 붙은 뒤와 같은 꼴) */
const withQuirk: IdlePlan = { ...beom, cells: 26, quirk: [22, 23, 24, 25] }

test('계획이 없는 띠는 예전 서기 그대로 (칸마다)', () => {
  for (let i = 0; i <= 3000; i++) {
    const t = i * .01, old = A.idle[Math.floor(t / A.idleTime) % A.idle.length]
    assert.equal(planFrame(DEFAULT_IDLE, idleSeed('haebi'), t), old, `${t}`)
    assert.equal(idleFrame(t), old)
  }
  assert.equal(idlePlan('anim-px/gen-haebi.png'), null)
  assert.equal(stripCells('anim-px/gen-haebi.png'), 20); assert.equal(stripCells('anim-px/gen-dalbit_hd.png'), 20)
  assert.equal(spriteName('anim-px/gen-base-g-62-beonye-hanul_hd.png'), 'base-g-62-beonye-hanul')
  assert.equal(stripCells('anim-px/gen-beom.png'), I.plans.beom.cells)
})

test('범 계획: 서기 칸이 길게 · 가끔 눈 감음(2) · 드물게 큰 숨(3) · 같은 시각이면 늘 같은 칸', () => {
  const seed = idleSeed('beom'), seen = new Map<number, number>()
  for (let i = 0; i < 180 * 50; i++) { const t = i / 50, f = planFrame(beom, seed, t); seen.set(f, (seen.get(f) ?? 0) + 1); assert.equal(planFrame(beom, seed, t), f) }
  assert.deepEqual([...seen.keys()].sort(), [0, 1, 2, 3])
  const n = 180 * 50, blink = seen.get(2)! / n, breath = seen.get(3)! / n
  assert.ok(blink > .02 && blink < .07, `깜빡임 몫 ${blink}`)
  assert.ok(breath > .03 && breath < .1, `큰 숨 몫 ${breath}`)
  assert.ok((seen.get(0)! + seen.get(1)!) / n > .85, '대부분 서기')
  // 처음 한 번은 every 사이를 다 채우기 전엔 오지 않는다 (쉬자마자 튀지 않는다)
  for (let t = 0; t < I.blinkEvery[0]; t += .01) assert.ok([0, 1].includes(planFrame(beom, seed, t)), `${t}`)
  // 움직임 줄이기: base 만
  for (let i = 0; i < 6000; i++) assert.ok([0, 1].includes(planFrame(beom, seed, i / 50, true)))
})

test('일은 겹치지 않고 차례 안에 들며 · 장수마다 어긋나고 · 칸은 띠 칸 수를 넘지 않는다', () => {
  for (const plan of [beom, withQuirk]) for (const name of ['beom', 'haebi', 'soseono', 'gamsil', 'a', 'b']) for (let c = 0; c < 40; c++) {
    const ev = idleEvents(plan, idleSeed(name), c)
    assert.deepEqual(ev, idleEvents(plan, idleSeed(name), c), '같은 셈')
    for (let i = 0; i < ev.length; i++) {
      assert.ok(ev[i]!.at >= 0 && ev[i]!.end <= I.cycle && ev[i]!.end > ev[i]!.at)
      if (i) assert.ok(ev[i]!.at >= ev[i - 1]!.end + I.gap - 1e-9, `${name} ${c} ${i}`)
    }
  }
  assert.notDeepEqual(idleEvents(beom, idleSeed('beom'), 0), idleEvents(beom, idleSeed('haebi'), 0), '장수마다 다르다')
  const kinds = new Set(Array.from({ length: 20 }, (_, c) => idleEvents(withQuirk, idleSeed('beom'), c).map(e => e.kind)).flat())
  assert.deepEqual([...kinds].sort(), ['blink', 'breath', 'quirk'])
  for (let i = 0; i < 600 * 20; i++) { const f = planFrame(withQuirk, idleSeed('beom'), i / 20); assert.ok(f >= 0 && f < withQuirk.cells, `${f}`) }
  // 버릇은 네 칸을 quirkStep 초씩 차례로
  const q = idleEvents(withQuirk, idleSeed('beom'), 0).find(e => e.kind === 'quirk') ?? idleEvents(withQuirk, idleSeed('beom'), 1).find(e => e.kind === 'quirk')!
  const base = idleEvents(withQuirk, idleSeed('beom'), 0).includes(q) ? 0 : I.cycle
  assert.deepEqual([0, 1, 2, 3].map(k => planFrame(withQuirk, idleSeed('beom'), base + q.at + (k + .5) * I.quirkStep)), [22, 23, 24, 25])
})

test('판 위: 서기 시계는 쉬기 시작한 때부터 — 걷다 멈추자마자 깜빡임·숨·버릇이 오지 않는다', () => {
  const s = createHaebi(5, 'stage', 'axe', { stage: 'forest', simRules: '56B', kitRules: KIT_RULES })
  s.spawn = 1e9; s.nextElite = 1e9; s.nextBarrage = 1e9
  const o = { stride: 120, cells: 8, idle: { plan: withQuirk, seed: idleSeed('beom') } }
  for (let i = 0; i < 37 * 60; i++) { stepHaebi(s, { x: 1, y: Math.sin(i / 30) }, 1 / 60); heroPose(s, o) }
  const stopAt = s.t, frames: number[] = []
  for (let i = 0; i < 3 * 60; i++) { stepHaebi(s, { x: 0, y: 0 }, 1 / 60); frames.push(heroPose(s, o).frame) }
  const idle = frames.slice(60)
  assert.ok(idle.every(f => f === 0 || f === 1), `멈춘 뒤 ${s.t - stopAt}초 동안 base 만 (${[...new Set(idle)]})`)
})
