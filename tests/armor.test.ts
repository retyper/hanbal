/**
 * 갑옷과 육량전 (형의 반려 2026-08-25: "육량전을 써도 갑옷은 왜 못 뚫는지 이해할 수가 없네")
 *
 * 여기서 지키는 계약은 셋이다.
 *   ① 보통 살은 갑옷 몸통에 **안 통한다** — 막힌 소리만 남는다.
 *   ② **육량전은 뚫는다.** 여섯 냥짜리 전쟁용 살이 판금을 못 뚫으면 존재할 이유가 없다.
 *   ③ 그래도 **헤드샷이 더 좋다.** 머리는 즉사, 육량전 몸통은 두 발.
 *      뚫는 살이 조준을 이기면 갑옷은 자물쇠가 아니라 그냥 성가신 것이 된다.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { createWorld, step } from '../src/sim/world.ts'
import { P } from '../src/tune/params.ts'
import type { ArrowKindId, InputFrame, StageDef, Stats, World } from '../src/sim/types.ts'

const STATS: Stats = { str: 12, steady: 8, stamina: 12, focus: 6 }

/** 갑옷 궁수 하나. 아주 늦게 쏘게 해서 이쪽이 맞을 일이 없게 한다. */
function arena(): StageDef {
  return {
    id: 'armor-test',
    seed: 4,
    arrows: 30,
    targetScore: 100,
    wind: 0,
    targets: [
      { kind: 'archer', x: 14, y: 1.5, r: 0.7, hp: Math.floor(P.enemy.archerHp), armored: true, fireDelay: 900 },
      { kind: 'static', x: 60, y: 12, r: 0.2, score: 0 },
    ],
  }
}

/** 한 발 쏘고 결판날 때까지 돌린다. 이번 발이 만든 이벤트만 돌려준다. */
function shoot(w: World, aimX: number, aimY: number): string[] {
  const hold: InputFrame = { aimX, aimY, drawing: true, steady: false }
  const rest: InputFrame = { aimX, aimY, drawing: false, steady: false }
  const seen: string[] = []
  const drain = (): void => {
    for (const e of w.events) if (e !== undefined) seen.push(e.t)
    w.events.length = 0
  }
  for (let i = 0; i < 900 && w.archer.phase !== 'full'; i++) { step(w, hold); drain() }
  step(w, rest); drain()
  for (let i = 0; i < 600; i++) {
    step(w, rest)
    drain()
    let flying = false
    for (const a of w.arrows) if (a !== undefined && a.alive && a.outcome === 'flying') flying = true
    if (!flying) break
  }
  return seen
}

function foe(w: World): { hp: number; alive: boolean; x: number; y: number; r: number } {
  const t = w.targets.find((x) => x !== undefined && x.kind === 'archer')
  assert.ok(t !== undefined, '갑옷 궁수가 없다')
  return t
}

describe('갑옷', () => {
  it('보통 살은 몸통에 안 통한다 — 막힌 소리만 남는다', () => {
    const w = createWorld(arena(), STATS)
    const t = foe(w)
    const before = t.hp
    const evs = shoot(w, t.x, t.y - t.r * 0.3)
    assert.ok(evs.includes('enemy_block'), `막힘이 안 났다 (${evs.join(',')})`)
    assert.equal(foe(w).hp, before, '유엽전이 갑옷을 뚫었다')
  })

  it('★ 육량전은 뚫는다 (형의 반려)', () => {
    const w = createWorld(arena(), STATS, 'heavy' as ArrowKindId)
    const t = foe(w)
    const before = t.hp
    const evs = shoot(w, t.x, t.y - t.r * 0.3)
    assert.ok(!evs.includes('enemy_block'), '육량전이 갑옷에 막혔다')
    assert.ok(foe(w).hp < before, `육량전이 갑옷을 못 뚫었다 (${before} → ${foe(w).hp})`)
  })

  it('그래도 헤드샷이 더 좋다 — 머리 한 발 vs 몸통 두 발', () => {
    // 머리: 유엽전으로도 한 발에 눕는다.
    const w1 = createWorld(arena(), STATS)
    const t1 = foe(w1)
    shoot(w1, t1.x, t1.y + t1.r * P.enemy.archerHeadUp)
    assert.equal(foe(w1).alive, false, '헤드샷인데 안 죽었다')

    // 몸통 + 육량전: 한 발로는 안 눕는다.
    const w2 = createWorld(arena(), STATS, 'heavy' as ArrowKindId)
    const t2 = foe(w2)
    shoot(w2, t2.x, t2.y - t2.r * 0.3)
    assert.equal(foe(w2).alive, true, '육량전 몸통 한 발에 누웠다 — 조준할 이유가 사라진다')
  })

  it('★ 애기살도 뚫는다 — 이유가 다르다 (단면밀도 vs 질량)', () => {
    const w = createWorld(arena(), STATS, 'pierce' as ArrowKindId)
    const t = foe(w)
    const before = t.hp
    const evs = shoot(w, t.x, t.y - t.r * 0.3)
    assert.ok(!evs.includes('enemy_block'), '애기살이 갑옷에 막혔다')
    assert.ok(foe(w).hp < before, '애기살이 갑옷을 못 뚫었다')
  })

  it('★ 육량전이 애기살보다 적은 발로 눕힌다 — 에너지가 크다', () => {
    const dealtBy = (kind: ArrowKindId): number => {
      const w = createWorld(arena(), STATS, kind)
      const t = foe(w)
      const before = t.hp
      shoot(w, t.x, t.y - t.r * 0.3)
      return before - foe(w).hp
    }
    const light = dealtBy('pierce' as ArrowKindId)
    const heavy = dealtBy('heavy' as ArrowKindId)
    assert.ok(light > 0 && heavy > 0, `안 박혔다 (${light}/${heavy})`)
    // 실측: 갑옷 적을 몸통만으로 눕히는 데 애기살 5발 · 육량전 3발.
    // 둘 다 자물쇠를 열지만 여는 값이 다르다 — 그래야 두 카드가 나란히 산다.
    assert.ok(heavy > light * 1.3, `육량전(${heavy})이 애기살(${light})보다 확실히 안 아프다`)
  })

  it('★ 효과살은 갑옷을 못 연다 — 자물쇠가 아무나 열리면 자물쇠가 아니다', () => {
    for (const kind of ['burst', 'split', 'homing', 'chain'] as const) {
      const w = createWorld(arena(), STATS, kind as ArrowKindId)
      const t = foe(w)
      const before = t.hp
      const evs = shoot(w, t.x, t.y - t.r * 0.3)
      assert.ok(evs.includes('enemy_block'), `${kind}가 갑옷을 뚫었다`)
      assert.equal(foe(w).hp, before, `${kind}가 갑옷 너머로 피해를 넣었다`)
    }
  })

  it('갑옷 없는 적은 아무 살이나 통한다', () => {
    const w = createWorld({
      ...arena(),
      targets: [
        { kind: 'archer', x: 14, y: 1.5, r: 0.7, hp: Math.floor(P.enemy.archerHp), fireDelay: 900 },
        { kind: 'static', x: 60, y: 12, r: 0.2, score: 0 },
      ],
    }, STATS)
    const t = foe(w)
    // ★ foe()는 **같은 객체**를 돌려준다. 쏜 뒤에 t.hp를 읽으면 이미 깎인 값이라
    //   비교가 언제나 거짓이 된다. 스냅샷을 먼저 뜬다.
    const before = t.hp
    const evs = shoot(w, t.x, t.y - t.r * 0.3)
    assert.ok(!evs.includes('enemy_block'), '갑옷도 없는데 막혔다')
    assert.ok(foe(w).hp < before || !foe(w).alive, '보통 적에게 피해가 안 들어갔다')
  })
})
