/**
 * 밤 — 경비 단계 · 꺼진 불 다시 붙이기 · 모닥불 · 촛불 게이지 (2026-10-21)
 *
 *  - 형: "경비가 삼엄한 암살이랑 안삼엄한거랑 조금 달라야" → 느슨 < 보통 < 삼엄, 보통은 옛 배치 그대로
 *  - 형: "불꺼지면 경비들은 불키러 가야하는거 아님?" → 가장 가까운 보초가 걸어가 붙이고(게이지) 돌아온다
 *  - 형: "안뜰에서는 뭐 통과할 방법이 없는데" → 모닥불은 살 fireHits 발에 사그라든다 · 어둠 속 보초는 아무도 못 본다
 *  - 형: "촛불이 꺼져서 도망치는건 대체뭔데" → 빗나가도 바로 안 달아난다, 기다림이 줄 뿐
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { bakeScene } from '../src/night/layout.ts'
import { chiefCandle, createNight, hitLight, relightSecs, stepNight, tendProgress, type Night } from '../src/night/sim.ts'
import { assassinGuard } from '../src/realm/plots.ts'
import { byeonhanMini } from '../src/realm/data/regions/byeonhan-mini.ts'
import { P } from '../src/tune/params.ts'
import type { InputFrame } from '../src/sim/types.ts'

const idle = (): InputFrame => ({ aimX: 10, aimY: 0, drawing: false, steady: false, parry: false })
const run = (n: Night, secs: number): void => {
  for (let i = 0; i < Math.round(secs * P.sim.hz); i++) stepNight(n, idle())
}
const guards = (seed: number, stage: number, g: 0 | 1 | 2): number => bakeScene(seed, stage, g).figures.filter((f) => f.role === 'guard').length

describe('밤 — 경비 단계', () => {
  it('느슨 < 보통 < 삼엄 · 보통은 경비를 안 준 배치와 같다', () => {
    for (let st = 0; st < 3; st++) {
      assert.ok(guards(4, st, 0) < guards(4, st, 1) && guards(4, st, 1) < guards(4, st, 2), `판 ${st}`)
      assert.deepEqual(bakeScene(4, st), bakeScene(4, st, 1))
    }
    assert.deepEqual([0, 1, 2].map((s) => guards(4, s, 1)), [3, 4, 3])
  })

  it('삼엄하면 더 빨리 붙이고, 불이 꺼지기만 해도 게이지가 오른다', () => {
    const a = createNight({ seed: 3, guard: 0 })
    const c = createNight({ seed: 3, guard: 2 })
    const torch = (n: Night) => n.scene.lights.find((l) => l.kind === 'torch')!
    assert.ok(relightSecs(c, torch(c)) < relightSecs(a, torch(a)))
    hitLight(a, torch(a), 0, 0)
    hitLight(c, torch(c), 0, 0)
    assert.ok(c.alarm > a.alarm)
  })

  it('칠십팔국 — 군주가 도읍에 있으면 삼엄 쪽, 경계 없는 마을 장수는 느슨', () => {
    const r = byeonhanMini(3)
    const ruler = Object.values(r.heroes).find((h) => h.id.endsWith('-ruler') && h.faction !== r.player && h.at !== null && r.nodes[h.at]?.kind === 'capital')!
    r.watch[ruler.at!] = { ...(r.watch[ruler.at!] ?? { alert: 0 }), alert: 0.3 } as never
    assert.equal(assassinGuard(r, ruler.id), 2)
    const plain = Object.values(r.heroes).find((h) => !h.id.endsWith('-ruler') && h.at !== null && r.nodes[h.at]?.kind !== 'capital')
    if (plain !== undefined) {
      if (r.watch[plain.at!] !== undefined) r.watch[plain.at!]!.alert = 0
      assert.equal(assassinGuard(r, plain.id), 0)
    }
  })
})

describe('밤 — 꺼진 불을 다시 붙인다', () => {
  it('횃불을 끄면 가장 가까운 보초가 걸어가 게이지를 채워 붙이고 제자리로 돌아온다', () => {
    const n = createNight({ seed: 5 })
    const torch = n.scene.lights.find((l) => l.kind === 'torch' && l.carrier < 0)!
    hitLight(n, torch, torch.x, torch.y)
    stepNight(n, idle())
    const who = n.scene.figures.find((f) => f.task?.light === torch.id)!
    assert.ok(who !== undefined, '누군가 붙이러 간다')
    const home = who.x
    // 걸어가서 붙이기 시작한다
    let lighting = false
    for (let i = 0; i < P.sim.hz * 20 && !lighting; i++) {
      stepNight(n, idle())
      lighting = who.task?.step === 'light'
    }
    assert.ok(lighting)
    run(n, relightSecs(n, torch) / 2)
    const p = tendProgress(n, who)
    assert.ok(p > 0.3 && p < 0.7, `게이지 ${p}`)
    run(n, relightSecs(n, torch) / 2 + 0.1)
    assert.equal(torch.lit, true)
    run(n, 20)
    assert.equal(who.task, null)
    if (who.patrol === null) assert.ok(Math.abs(who.x - home) < 1e-6, '제자리로')
  })

  it('붙이는 동안엔 불만 본다 — 곁의 시체를 못 본다', () => {
    const n = createNight({ seed: 5, guard: 1 })
    const torch = n.scene.lights.find((l) => l.kind === 'torch' && l.carrier < 0)!
    const [g, c] = n.scene.figures.filter((f) => f.role === 'guard')
    for (const f of n.scene.figures) if (f !== g && f !== c) f.alive = false
    for (const l of n.scene.lights) if (l !== torch) l.lit = false
    // g 가 횃불을 붙이는 중 — 그 앞 불빛 안에 시체
    g!.task = { light: torch.id, step: 'light', at: n.tick, homeX: g!.x, homePose: g!.pose, homeFacing: g!.facing }
    g!.x = torch.x - 0.35
    g!.facing = 1
    c!.alive = false
    c!.downAt = 0
    c!.x = torch.x + 1
    run(n, P.night.noticeDelay + 0.6)
    assert.equal(n.alarm, 0)
  })

  it('안뜰 — 모닥불은 살 셋에 사그라들고, 둘러앉은 보초가 일어나 불씨를 살리러 간다', () => {
    const n = createNight({ seed: 7, practice: { stage: 1, alarm: true, infinite: true } })
    const fire = n.scene.lights.find((l) => l.kind === 'fire')!
    for (let i = 0; i < P.night.fireHits - 1; i++) hitLight(n, fire, fire.x, fire.y)
    assert.equal(fire.lit, true, '아직 탄다')
    hitLight(n, fire, fire.x, fire.y)
    assert.equal(fire.lit, false)
    stepNight(n, idle())
    const who = n.scene.figures.find((f) => f.task?.light === fire.id)!
    assert.ok(who !== undefined)
    assert.notEqual(who.pose, 'sit', '앉은 보초도 일어선다')
  })

  it('안뜰 — 불이 꺼진 어둠 속에서 붙이러 온 보초를 쓰러뜨리면 아무도 못 본다', () => {
    const n = createNight({ seed: 7, practice: { stage: 1, alarm: true, infinite: true } })
    const fire = n.scene.lights.find((l) => l.kind === 'fire')!
    // 등불 든 순찰은 먼저 (그의 등불이 시체를 비춘다)
    const lantern = n.scene.lights.find((l) => l.kind === 'lantern')!
    const carrier = n.scene.figures[lantern.carrier]!
    carrier.alive = false
    carrier.downAt = 0
    lantern.lit = false
    for (let i = 0; i < P.night.fireHits; i++) hitLight(n, fire, fire.x, fire.y)
    n.alarm = 0
    stepNight(n, idle())
    const who = n.scene.figures.find((f) => f.task?.light === fire.id)!
    who.alive = false
    who.downAt = n.tick
    run(n, 3)
    assert.equal(n.alarm, 0, '어둠 속 시체는 아무도 못 본다')
  })
})

describe('밤 — 촛불 게이지', () => {
  it('그림자가 선 뒤 빗나가도 바로 달아나지 않는다 — 게이지가 줄 뿐, 다 닳으면 달아난다', () => {
    const n = createNight({ seed: 4, practice: { stage: 2, alarm: true, infinite: false } })
    for (const f of n.scene.figures) if (f.role === 'guard') f.alive = false
    stepNight(n, idle())
    run(n, P.night.chiefRise + 0.05)
    assert.equal(n.phase, 'chief')
    assert.ok(chiefCandle(n) > 0.9)
    n.chiefLeft -= P.night.chiefMissCut // 빗나간 살 하나
    stepNight(n, idle())
    assert.equal(n.result, null, '한 발 빗나갔다고 달아나지 않는다')
    assert.ok(chiefCandle(n) < 1 - P.night.chiefMissCut / P.night.chiefPatience + 0.01)
    run(n, P.night.chiefPatience)
    assert.equal((n.result as Night['result'])?.result, 'fled')
  })
})

/**
 * 판을 깰 길이 있나 (2026-10-23, 형: "암살활쏘기는 아직도 깰 수 없게 만들어져 있나? 어떻게 깨라는지 모르겠음. 안뜰이랑 사랑채")
 *  - 안뜰: 왼쪽에 앉은 보초가 모닥불을 가려 지붕에서 불을 맞힐 각이 거의 없었다 → 불은 첫 화면부터 맞힐 수 있어야 한다
 *  - 사랑채 앞: 기둥(살이 꽂히는 것)이 창호지 앞을 통째로 막아 적장에게 닿는 각이 하나도 없었다 → 그림자는 맞힐 수 있어야 한다
 * 숨 참고 만작으로 놓으면 오차 0 (빨간 바 계약) — 사람이 겨눈 각 그대로 간다.
 */
describe('밤 — 판을 깰 길', () => {
  const aim = (n: Night, ang: number, drawing: boolean): InputFrame => {
    const a = n.w.archer
    return { aimX: a.x + Math.cos(ang) * 10, aimY: a.y + Math.sin(ang) * 10, drawing, steady: true, parry: false }
  }
  /** 숨 참고 만작까지 당겨 이 각으로 놓고, 살이 끝날 때까지 */
  const shootAt = (n: Night, ang: number): void => {
    for (let i = 0; i < P.sim.hz && n.w.archer.phase !== 'full'; i++) stepNight(n, aim(n, ang, true))
    stepNight(n, aim(n, ang, true))
    stepNight(n, aim(n, ang, false))
    for (let i = 0; i < P.sim.hz * 2 && n.w.arrows.some((x) => x.alive && x.outcome === 'flying'); i++) stepNight(n, aim(n, ang, false))
  }

  it('안뜰 — 지붕에서 모닥불을 맞힐 각이 첫 화면부터 있다 (시드 여럿)', () => {
    for (const seed of [1, 2, 3, 5, 7, 11]) {
      let found = false
      // 등불 든 순찰이 불 앞을 지나갈 수 있다 — 조금 기다렸다 쏘는 것까지 본다
      for (const wait of [0, 2, 4]) {
        for (let ang = -0.34; ang <= -0.2 && !found; ang += 0.002) {
          const n = createNight({ seed, practice: { stage: 1, alarm: true, infinite: true } })
          run(n, wait)
          shootAt(n, ang)
          found = n.scene.lights.find((l) => l.kind === 'fire')!.hits > 0
        }
      }
      assert.ok(found, `시드 ${seed} — 모닥불을 맞힐 각이 없다 (앉은 보초가 가린다)`)
    }
  })

  it('사랑채 앞 — 호위가 다 쓰러지면 창호지 너머 그림자를 맞힐 수 있다', () => {
    let got: string | undefined
    for (let ang = -0.14; ang <= -0.02 && got === undefined; ang += 0.002) {
      const n = createNight({ seed: 4, practice: { stage: 2, alarm: true, infinite: true } })
      for (const f of n.scene.figures) if (f.role === 'guard') f.alive = false
      run(n, P.night.chiefRise + 0.1)
      assert.equal(n.phase, 'chief')
      shootAt(n, ang)
      if (n.result?.result === 'dead' || n.result?.result === 'wounded') got = n.result.result
    }
    assert.ok(got !== undefined, '그림자에 닿는 각이 하나도 없다 (기둥이 막는다)')
  })
})
