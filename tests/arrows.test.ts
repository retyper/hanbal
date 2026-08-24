/**
 * 화살 종류의 sim 배선 (docs/HOOK.md ★1)
 *
 * 여기서 지키는 것은 둘이다.
 *  1. **결정론이 화살 종류에 오염되지 않는다** (A1). 종류를 바꿔도 sim의 난수 스트림은
 *     같은 자리에 있어야 한다 — 화살 효과가 `w.rng`를 한 칸이라도 밀면 "같은 시드 = 같은 판"이
 *     화살마다 다른 뜻이 된다.
 *  2. **고른 것이 실제로 물리를 바꾼다.** 이 테스트가 없으면 효과판만 있고 아무도 안 읽는
 *     상태로 되돌아가도 초록불이 켜진다 (실제로 그런 시기가 있었다 — docs/BALANCE.md §4-5).
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { createWorld, step } from '../src/sim/world.ts'
import { spawnArrow } from '../src/sim/ballistics.ts'
import { arrowFx } from '../src/sim/arrowfx.ts'
import { TRAIL_POINTS } from '../src/sim/types.ts'
import type { ArrowKindId, InputFrame, StageDef, Stats, World } from '../src/sim/types.ts'

const STATS: Stats = { str: 10, steady: 8, stamina: 8, focus: 6 }
const IDLE: InputFrame = { aimX: 20, aimY: 2, drawing: false, steady: false }

const KINDS: readonly ArrowKindId[] = ['basic', 'pierce', 'burst', 'split', 'homing', 'chain', 'heavy']

/** 일렬 + 밀집 + 옆으로 벌어진 자리. 여섯 종류가 각각 다른 것을 물어야 하는 배치다. */
function stage(): StageDef {
  return {
    id: 'arrows-test',
    seed: 0x1234,
    arrows: 4,
    targetScore: 100,
    wind: 0,
    targets: [
      { kind: 'static', x: 16, y: 2.0, r: 0.5, score: 100 },
      { kind: 'static', x: 19, y: 2.0, r: 0.5, score: 100 },
      { kind: 'static', x: 22, y: 2.0, r: 0.5, score: 100 },
      { kind: 'static', x: 16, y: 3.4, r: 0.5, score: 100 },
      { kind: 'static', x: 18.5, y: 2.76, r: 0.5, score: 100 },
      { kind: 'static', x: 18.5, y: 1.24, r: 0.5, score: 100 },
    ],
  }
}

interface Shot {
  score: number
  killed: number
  /** 한 발이 만든 살아있는 화살의 최대 수 (분열 자식 포함) */
  peakArrows: number
  /** 남은 지급 화살. 분열 자식이 여기서 빠지면 안 된다. */
  arrowsLeft: number
  rngState: number
}

/** 정확히 한 발. 각도는 전 종류 공통이라 결과 차이는 오직 화살 효과의 것이다. */
function shoot(kind: ArrowKindId, angle: number): Shot {
  const w: World = createWorld(stage(), STATS, kind)
  const a = spawnArrow(w, angle, 1)
  assert.notEqual(a, null, '발사에 실패했다')
  let peak = 1
  for (let i = 0; i < 900; i++) {
    step(w, IDLE)
    let live = 0
    for (const ar of w.arrows) if (ar.alive) live++
    if (live > peak) peak = live
    w.events.length = 0
    if (live === 0) break
  }
  let killed = 0
  for (const t of w.targets) if (!t.alive) killed++
  return { score: w.score, killed, peakArrows: peak, arrowsLeft: w.arrowsLeft, rngState: w.rng.state() }
}

/** 첫 과녁을 겨누는 각. 종류마다 초속이 달라(무거운 살) 따로 찾는다. */
function aim(kind: ArrowKindId): number {
  return aimAt(kind, stage, 16, 2.0)
}

/** 임의의 배치에서 (tx, ty)를 겨누는 각. 과녁을 전부 꺼두고 궤적만 본다. */
function aimAt(kind: ArrowKindId, make: () => StageDef, tx: number, ty: number): number {
  let best = 0
  let bestErr = Number.POSITIVE_INFINITY
  for (let deg = -2; deg <= 40; deg += 0.05) {
    const ang = (deg * Math.PI) / 180
    const w = createWorld(make(), STATS, kind)
    for (const t of w.targets) t.alive = false
    const a = spawnArrow(w, ang, 1)
    if (a === null) continue
    for (let i = 0; i < 600; i++) {
      step(w, IDLE)
      w.events.length = 0
      if (!a.alive) break
      if (a.x >= tx) {
        const err = Math.abs(a.y - ty)
        if (err < bestErr) {
          bestErr = err
          best = ang
        }
        break
      }
    }
  }
  return best
}

describe('화살 종류 — sim 배선', () => {
  it('같은 시드 + 같은 종류 = 같은 결과 (A1)', () => {
    for (const k of KINDS) {
      const ang = aim(k)
      const a = shoot(k, ang)
      const b = shoot(k, ang)
      assert.deepEqual(b, a, `${k}: 같은 입력이 다른 결과를 냈다`)
    }
  })

  it('화살 효과가 sim의 난수 스트림을 밀지 않는다 (A1)', () => {
    // 발사 자체가 난수를 쓰지 않는 경로(spawnArrow 직접 호출)라, 종류가 달라도
    // 판이 끝난 시점의 rng 상태는 전부 같아야 한다. 다르면 어떤 효과가 w.rng를 쓴 것이다.
    const base = shoot('basic', aim('basic')).rngState
    for (const k of KINDS) {
      assert.equal(shoot(k, aim(k)).rngState, base, `${k}: sim 난수 스트림이 밀렸다`)
    }
  })

  it('고른 화살이 실제로 판을 바꾼다 (HOOK 4장 검증 기준 1)', () => {
    const seen = new Map<string, ArrowKindId[]>()
    for (const k of KINDS) {
      const r = shoot(k, aim(k))
      const key = `${r.score}/${r.killed}/${r.peakArrows}`
      const l = seen.get(key)
      if (l === undefined) seen.set(key, [k])
      else l.push(k)
    }
    // 기본 살과 결과가 완전히 같은 종류가 있으면 그 종류는 배선되지 않은 것이다.
    // (유도 살은 정조준 한 발에서는 기본 살과 같을 수 있으므로 따로 검사한다 — 아래 테스트.)
    assert.ok(seen.size >= 5, `결과가 ${seen.size}종류뿐이다: ${JSON.stringify([...seen])}`)
  })

  it('유도 살은 빗나갈 뻔한 발을 살린다 — 그리고 조준을 대신하지는 않는다', () => {
    const lone = (): StageDef => ({
      id: 'lone', seed: 0x1234, arrows: 2, targetScore: 100, wind: 0,
      targets: [{ kind: 'static', x: 20, y: 2.4, r: 0.35, score: 100 }],
    })
    const hit = (kind: ArrowKindId, angle: number): boolean => {
      const w = createWorld(lone(), STATS, kind)
      const a = spawnArrow(w, angle, 1)
      if (a === null) return false
      for (let i = 0; i < 900; i++) {
        step(w, IDLE)
        for (const e of w.events) if (e.t === 'hit') return true
        w.events.length = 0
        if (!a.alive) break
      }
      return false
    }
    const firstHit = (kind: ArrowKindId): number => {
      for (let d = 0; d <= 20; d += 0.01) {
        const ang = (d * Math.PI) / 180
        if (hit(kind, ang)) return ang
      }
      return 0
    }
    const window = (kind: ArrowKindId): number => {
      const c = firstHit(kind)
      let n = 0
      for (let m = 1; m <= 300; m++) {
        if (!hit(kind, c + m * 0.001)) break
        n = m
      }
      return n
    }
    const basic = window('basic')
    const homing = window('homing')
    assert.ok(homing > basic, `유도가 창을 못 넓혔다 (basic ${basic} / homing ${homing} mrad)`)
    // 창을 두 배로 만들면 그건 살리는 게 아니라 과녁을 두 배로 키우는 것이다.
    assert.ok(
      homing < basic * 2,
      `유도가 과하다 — 창이 두 배를 넘었다 (basic ${basic} / homing ${homing} mrad)`,
    )
  })

  it('분열 자식은 지급 화살을 먹지 않는다', () => {
    const r = shoot('split', aim('split'))
    assert.ok(r.peakArrows > 1, '자식이 하나도 안 나왔다')
    // 지급 4발 중 1발만 쐈다. 자식이 잔량에서 빠졌으면 3보다 작아진다.
    assert.equal(r.arrowsLeft, 3, '분열 자식이 지급 화살을 소모했다')
  })

  /**
   * 회귀 — 갈래 화살이 "손에서 나가는" 버그.
   *
   * 명중으로 죽은 부모는 그 순간 풀의 빈 슬롯이 된다. 자식 배정이 부모를 배제하지 않으면
   * 첫 자식이 부모 슬롯에 앉으면서 pendX/pendY(태어날 자리)를 0으로 지우고, 두 번째 자식이
   * 월드 원점(0,0) = 궁수 발치에서 튀어나온다. 눈으로 보면 "한 자식은 과녁에서, 다른 자식은
   * 갑자기 손에서" 나간다.
   *
   * 궤적 링버퍼의 가장 오래된 표본이 곧 발사점이라, 그걸로 태어난 자리를 되짚는다.
   */
  it('분열 자식은 전부 맞은 자리에서 태어난다 (부모 슬롯 재사용 회귀)', () => {
    const w = createWorld(stage(), STATS, 'split')
    const a = spawnArrow(w, aim('split'), 1)
    assert.notEqual(a, null)

    /** 이 화살의 발사점 (궤적의 가장 오래된 표본). */
    const origin = (ar: (typeof w.arrows)[number]): [number, number] => {
      const n = ar.trailLen
      const i = ((ar.trailHead - n) % TRAIL_POINTS + TRAIL_POINTS) % TRAIL_POINTS
      return [ar.trail[i * 2] ?? 0, ar.trail[i * 2 + 1] ?? 0]
    }

    let sawChild = false
    for (let i = 0; i < 900; i++) {
      step(w, IDLE)
      w.events.length = 0
      let live = 0
      for (const ar of w.arrows) {
        if (!ar.alive) continue
        live++
        const [ox, oy] = origin(ar)
        if (ar.splitDepth <= 0) {
          // 직접 쏜 화살은 궁수의 손에서 나간다. 그건 정상이다.
          assert.ok(
            Math.abs(ox) < 1e-6 && Math.abs(oy - 1.4) < 1e-6,
            `쏜 화살의 발사점이 손이 아니다: (${ox}, ${oy})`,
          )
          continue
        }
        sawChild = true
        // 자식은 **맞은 과녁 자리**에서 태어난다. 과녁은 전부 x >= 16 이므로
        // 발사점이 궁수 근처면 그건 원점에서 태어난 것이다.
        assert.ok(
          ox > 10,
          `분열 자식이 궁수 쪽에서 태어났다 — 발사점 (${ox.toFixed(3)}, ${oy.toFixed(3)})`,
        )
      }
      if (live === 0) break
    }
    assert.ok(sawChild, '자식이 하나도 안 나왔다 — 이 테스트가 아무것도 검사하지 못했다')
  })

  it('사슬 살은 fx.chainBounces 를 넘겨 튀지 않는다', () => {
    const fx = arrowFx('chain')
    const w = createWorld(stage(), STATS, 'chain')
    const a = spawnArrow(w, aim('chain'), 1)
    assert.notEqual(a, null)
    for (let i = 0; i < 900; i++) {
      step(w, IDLE)
      w.events.length = 0
      for (const ar of w.arrows) {
        assert.ok(ar.bounces <= fx.chainBounces, `튄 횟수 ${ar.bounces} > 상한 ${fx.chainBounces}`)
      }
      let live = 0
      for (const ar of w.arrows) if (ar.alive) live++
      if (live === 0) break
    }
  })

  it('분열 자식의 낙하는 빗나간 발로 세지 않는다 (★★★ 무손실의 유일한 근거)', () => {
    // 자식은 지급된 화살이 아니라 그 한 발의 결과물이다. 자식의 착지가 miss를 뱉으면
    // (1) 부모가 만든 연쇄를 자식이 끊고 (2) misses가 분모(쏜 발)보다 커져
    // 분열 살로는 무손실 ★★★이 구조적으로 불가능해진다. 지금까지 어떤 테스트도 miss를 안 봤다.
    const w = createWorld(stage(), STATS, 'split')
    const a = spawnArrow(w, aim('split'), 1)
    assert.notEqual(a, null, '발사에 실패했다')
    let misses = 0
    let hits = 0
    let peak = 1
    for (let i = 0; i < 900; i++) {
      step(w, IDLE)
      for (const e of w.events) {
        if (e.t === 'miss') misses++
        else if (e.t === 'hit') hits++
      }
      w.events.length = 0
      let live = 0
      for (const ar of w.arrows) if (ar.alive) live++
      if (live > peak) peak = live
      if (live === 0) break
    }
    assert.ok(peak > 1, '자식이 하나도 안 나왔다 — 이 테스트가 무의미하다')
    assert.ok(hits > 0, '한 발도 못 맞혔다 — 이 테스트가 무의미하다')
    assert.equal(misses, 0, `맞힌 한 발인데 빗나감 ${misses}회로 세어졌다`)
  })

  it('한 화살이 같은 과녁을 두 번 때리지 않는다 — 낙하 중인 공중 과녁 (A1)', () => {
    // 공중 과녁은 맞아도 alive를 유지한 채 떨어진다. 충돌 판정이 falling을 안 거르면
    // 관통·무거운·사슬 살이 같은 과녁에서 점수·콤보를 두세 번 받는다.
    // 기존 stage()에는 공중 과녁이 하나도 없어 이 버그가 7종 전부에 초록불을 받았다.
    const airy = (): StageDef => ({
      id: 'aerial-test', seed: 0x1234, arrows: 2, targetScore: 100, wind: 0,
      targets: [
        { kind: 'aerial', x: 18, y: 5.4, r: 0.5, score: 100 },
        { kind: 'static', x: 18, y: 1.4, r: 0.5, score: 100 },
      ],
    })
    for (const k of KINDS) {
      const w = createWorld(airy(), STATS, k)
      const a = spawnArrow(w, aimAt(k, airy, 18, 5.4), 1)
      assert.notEqual(a, null, `${k}: 발사에 실패했다`)
      const seen = new Map<number, number>()
      let total = 0
      for (let i = 0; i < 900; i++) {
        step(w, IDLE)
        for (const e of w.events) {
          if (e.t !== 'hit') continue
          seen.set(e.targetId, (seen.get(e.targetId) ?? 0) + 1)
          total++
        }
        w.events.length = 0
        let live = 0
        for (const ar of w.arrows) if (ar.alive) live++
        if (live === 0) break
      }
      assert.ok(total > 0, `${k}: 한 발도 못 맞혔다 — 이 검사가 무의미하다`)
      for (const [id, n] of seen) {
        assert.ok(n <= 1, `${k}: 과녁 ${id}에 hit 이벤트가 ${n}번 왔다`)
      }
    }
  })

  it('기본 살은 어느 효과 분기도 타지 않는다 (전 항목 중립)', () => {
    const fx = arrowFx('basic')
    assert.equal(fx.pierceExtra, 0)
    assert.equal(fx.burstRadius, 0)
    assert.equal(fx.splitCount, 0)
    assert.equal(fx.homingTurn, 0)
    assert.equal(fx.chainBounces, 0)
    assert.equal(fx.speedMul, 1)
    assert.equal(fx.dragMul, 1)
    assert.equal(fx.scoreMul, 1)
  })
})
