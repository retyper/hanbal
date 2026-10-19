/**
 * 밤의 암살판 (src/night, docs/realm/SNIPE.md §0) — 배치 결정론 · 판 넘김 · 발각 게이지 · 적장 · 결과 꼴
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { bakeScene } from '../src/night/layout.ts'
import { BOW_NAME, createNight, lightAt, stepNight, type Night, type NightFrame } from '../src/night/sim.ts'
import { maxDrawOf } from '../src/sim/bow.ts'
import { arrowSpeed } from '../src/sim/ballistics.ts'
import { P, setParam } from '../src/tune/params.ts'
import type { InputFrame } from '../src/sim/types.ts'

const idle = (): InputFrame => ({ aimX: 10, aimY: 0, drawing: false, steady: false, parry: false })
const run = (n: Night, secs: number, inp: InputFrame = idle()): void => {
  for (let i = 0; i < Math.round(secs * P.sim.hz); i++) stepNight(n, inp)
}

/** 만작까지 당겼다 놓고 살이 끝날 때까지 */
function shoot(n: Night, angle: number): void {
  const a = n.w.archer
  const inp: InputFrame = { aimX: a.x + Math.cos(angle) * 10, aimY: a.y + Math.sin(angle) * 10, drawing: false, steady: false, parry: false }
  for (let i = 0; i < P.sim.hz * 2 && a.stamina < a.staminaMax * 0.95; i++) stepNight(n, inp)
  inp.drawing = true
  for (let i = 0; i < P.sim.hz * 2 && a.phase !== 'full'; i++) stepNight(n, inp)
  stepNight(n, inp)
  inp.drawing = false
  for (let i = 0; i < P.sim.hz * 4; i++) {
    stepNight(n, inp)
    if (!n.w.arrows.some((x) => x.alive && x.outcome === 'flying')) break
  }
}

/** 연습장 '과녁만'(보초 없는 형체) 첫 형체의 어디를 맞히는 각을 찾는다 */
function angleFor(seed: number, zone: 'head' | 'body'): number {
  for (let ang = -0.6; ang <= -0.15; ang += 0.002) {
    const n = createNight({ seed, practice: { stage: 3, alarm: true, infinite: true } })
    shoot(n, ang)
    const f = n.scene.figures[0]!
    if (!f.alive && f.hitZone === zone) return ang
  }
  throw new Error(`${zone} 각을 못 찾았다`)
}

describe('밤의 암살판', () => {
  it('같은 시드·같은 판이면 같은 배치, 시드가 다르면 다른 배치', () => {
    assert.deepEqual(bakeScene(5, 0), bakeScene(5, 0))
    assert.deepEqual(bakeScene(5, 2), bakeScene(5, 2))
    assert.notDeepEqual(bakeScene(5, 0).figures.map((f) => f.x), bakeScene(6, 0).figures.map((f) => f.x))
  })

  it('머리는 소리 없이 쓰러진다 · 몸통은 신음으로 게이지가 오른다 · 같은 각이면 같은 결과', () => {
    const seed = 11
    const head = angleFor(seed, 'head')
    const a = createNight({ seed, practice: { stage: 3, alarm: true, infinite: true } })
    const b = createNight({ seed, practice: { stage: 3, alarm: true, infinite: true } })
    shoot(a, head)
    shoot(b, head)
    assert.deepEqual(a.scene.figures, b.scene.figures)
    assert.equal(a.scene.figures[0]!.hitZone, 'head')
    assert.equal(a.alarm, 0)
    assert.equal(a.heads, 1)
    const body = angleFor(seed, 'body')
    const c = createNight({ seed, practice: { stage: 3, alarm: true, infinite: true } })
    shoot(c, body)
    assert.ok(c.alarm > 0, '몸통에 맞으면 신음 소리')
  })

  it('형체를 맞히면 활터와 같은 명중 사건을 낸다 — 활터의 소리·불꽃·히트스톱·남는 궤적이 그대로 읽는다', () => {
    const seed = 11
    const hits = (n: Night) => n.w.events.filter((e) => e.t === 'hit')
    const a = createNight({ seed, practice: { stage: 3, alarm: true, infinite: true } })
    shoot(a, angleFor(seed, 'head'))
    const h = hits(a)
    assert.equal(h.length, 1)
    assert.ok(h[0]!.t === 'hit' && h[0]!.foe && h[0]!.head && h[0]!.execute, '머리 — 신음 없이(execute) 헤드샷')
    assert.ok(h[0]!.t === 'hit' && a.w.arrows[h[0]!.arrow] !== undefined, '어느 살인지 안다 (남는 궤적)')
    const b = createNight({ seed, practice: { stage: 3, alarm: true, infinite: true } })
    shoot(b, angleFor(seed, 'body'))
    const g = hits(b)
    assert.ok(g.length === 1 && g[0]!.t === 'hit' && g[0]!.foe && !g[0]!.head && !g[0]!.execute, '몸통 — 신음')
  })

  it('보초를 다 쓰러뜨리면 지붕을 넘어 다음 판 — 화살은 그대로, 게이지는 조금 가라앉는다', () => {
    const n = createNight({ seed: 3, arrows: 7 })
    n.alarm = 0.5
    for (const f of n.scene.figures) f.alive = false
    stepNight(n, idle())
    assert.equal(n.phase, 'move')
    run(n, P.night.moveTime + 0.1)
    assert.equal(n.stage, 1)
    assert.equal(n.phase, 'play')
    assert.equal(n.w.arrowsLeft, 7)
    assert.ok(n.alarm < 0.5 && n.alarm > 0)
  })

  it('셋째 판 — 호위가 다 쓰러지면 그림자가 일어서고, 오래 기다리면 촛불을 끄고 달아난다', () => {
    const n = createNight({ seed: 4, practice: { stage: 2, alarm: true, infinite: false } })
    for (const f of n.scene.figures) if (f.role === 'guard') f.alive = false
    stepNight(n, idle())
    assert.equal(n.phase, 'rise')
    run(n, P.night.chiefRise + 0.05)
    assert.equal(n.phase, 'chief')
    run(n, P.night.chiefPatience + 0.1)
    assert.equal(n.result?.result, 'fled')
    assert.equal(n.result?.alarm, false)
    assert.equal(n.scene.lights.find((l) => l.kind === 'candle')?.lit, false)
  })

  it('게이지가 차면 북이 울리고 적장이 달아난다 — 결과에 경보가 남는다', () => {
    const n = createNight({ seed: 8 })
    n.alarm = 1
    stepNight(n, idle())
    assert.equal(n.phase, 'alarm')
    run(n, P.night.alarmTime + 0.1)
    assert.deepEqual(Object.keys(n.result!).sort(), ['alarm', 'arrowsLeft', 'result', 'stage'])
    assert.equal(n.result!.result, 'fled')
    assert.equal(n.result!.alarm, true)
  })

  it('빛 안의 시체를 앞을 보는 보초가 보면 알아채고 게이지가 오른다 · 불을 끄면 못 본다', () => {
    const n = createNight({ seed: 9 })
    const [g, c] = n.scene.figures as [NonNullable<Night['scene']['figures'][0]>, NonNullable<Night['scene']['figures'][0]>]
    // 둘째 보초(c)를 첫째(g) 앞 횃불 아래 시체로
    const torch = n.scene.lights.find((l) => l.kind === 'torch')!
    c.alive = false
    c.downAt = 0
    c.x = torch.x
    g.x = torch.x - 3
    g.facing = 1
    for (const f of n.scene.figures) if (f.patrol !== null) f.alive = false
    assert.ok(lightAt(n.scene, c.x, c.y + 0.6, n.tick) > P.night.corpseLight)
    run(n, P.night.noticeDelay + 0.5)
    assert.ok(n.alarm > 0, '알아채고 게이지가 오른다')
    const lit = createNight({ seed: 9 })
    const [g2, c2] = lit.scene.figures as typeof n.scene.figures
    for (const l of lit.scene.lights) l.lit = false
    c2!.alive = false
    c2!.downAt = 0
    g2!.x = c2!.x - 3
    g2!.facing = 1
    for (const f of lit.scene.figures) if (f.patrol !== null) f.alive = false
    run(lit, P.night.noticeDelay + 0.5)
    assert.equal(lit.alarm, 0)
  })

  it('화살이 다하면 조용히 물러난다', () => {
    const n = createNight({ seed: 2, arrows: 1 })
    shoot(n, 0.3) // 하늘로 — 멀리 떨어진다
    run(n, 3)
    assert.equal(n.result?.result, 'withdrew')
  })
})

/**
 * 당겨 쏘기 · 밤의 숨 · 활의 단계 (2026-10-18, 형: "뒤로 당겼다가 놓게" · "스태미너 너무 빨리 줄어드는데" · "계단적 성장")
 */
describe('밤 — 당겨 쏘기와 활의 단계', () => {
  const frame = (n: Night): NightFrame => {
    const a = n.w.archer
    return { aimX: a.x + 10, aimY: a.y - 2, drawing: false, steady: false, parry: false }
  }
  const practice = (bowTier = 0): Night => createNight({ seed: 3, bowTier, practice: { stage: 3, alarm: false, infinite: true } })

  it('끈 길이가 당김의 상한이다 — 반만 끌면 만작에 안 들고 당김이 반에서 멈춘다', () => {
    const n = practice()
    const inp = frame(n)
    inp.drawing = true
    inp.cap = 0.5
    run(n, 2, inp)
    const a = n.w.archer
    const max = maxDrawOf(n.w.stats, n.w.bow.maxDrawAdd)
    assert.equal(a.phase, 'drawing')
    assert.ok(Math.abs(a.draw - max * 0.5) < 1e-6, `당김 ${a.draw} · 반 ${max * 0.5}`)
    // 끝까지 끌면 만작에 든다
    inp.cap = 1
    run(n, 2, inp)
    assert.equal(a.phase, 'full')
  })

  it('고리 안으로 돌아와 놓으면 쏘지 않는다', () => {
    const n = practice()
    const inp = frame(n)
    inp.drawing = true
    inp.cap = 1
    run(n, 1, inp)
    const shots = n.shots
    inp.cancel = true
    stepNight(n, inp)
    inp.cancel = false
    inp.drawing = false
    run(n, 0.5, inp)
    assert.equal(n.shots, shots)
    assert.equal(n.w.arrows.filter((x) => x.alive).length, 0)
    assert.equal(n.w.archer.phase, 'idle')
  })

  it(`밤의 숨은 활터보다 느리게 준다 — 끝까지 당겨 버티는 시간이 약 ${(1 / P.night.staminaDrainMul).toFixed(1)}배`, () => {
    const hold = (): number => {
      const n = practice()
      const inp = frame(n)
      inp.drawing = true
      let t = 0
      while (n.w.archer.phase !== 'collapsing' && t < 60 * P.sim.hz) { stepNight(n, inp); t++ }
      return t
    }
    const was = P.night.staminaDrainMul
    const slow = hold()
    setParam('night.staminaDrainMul', 1)
    const fast = hold()
    setParam('night.staminaDrainMul', was)
    const ratio = slow / fast
    assert.ok(ratio > 1.6 && ratio < 2.4, `버틴 시간의 비 ${ratio.toFixed(2)} (${slow} / ${fast} 스텝)`)
  })

  it('활의 단계마다 한꺼번에 세진다 — 살이 빠르고 · 빨리 당기고 · 화살이 늘고 · 이름이 바뀐다', () => {
    const lo = createNight({ seed: 3, arrows: 9 })
    const hi = createNight({ seed: 3, arrows: 9, bowTier: 3 })
    assert.equal(BOW_NAME[hi.bowTier], '신궁')
    assert.ok(hi.w.arrowsLeft > lo.w.arrowsLeft)
    assert.ok(arrowSpeed(hi.w, 1, 1) > arrowSpeed(lo.w, 1, 1) * 1.3)
    const toFull = (n: Night): number => {
      const inp = frame(n)
      inp.drawing = true
      let t = 0
      while (n.w.archer.phase !== 'full' && t < 5 * P.sim.hz) { stepNight(n, inp); t++ }
      return t
    }
    assert.ok(toFull(hi) < toFull(lo) * 0.7)
    // 범위 밖은 끝 단계로
    assert.equal(createNight({ seed: 3, bowTier: 9 }).bowTier, BOW_NAME.length - 1)
  })
})
