/**
 * 갑옷과 육량전 (형의 반려 2026-08-25: "육량전을 써도 갑옷은 왜 못 뚫는지 이해할 수가 없네")
 *
 * 여기서 지키는 계약은 셋이다.
 *   ① 보통 살은 갑옷 몸통에 **안 통한다** — 막힌 소리만 남는다.
 *   ② **육량전은 뚫는다.** 여섯 냥짜리 전쟁용 살이 판금을 못 뚫으면 존재할 이유가 없다.
 *   ③ 그래도 **헤드샷이 더 좋다.** 머리는 즉사, 육량전 몸통은 두 발.
 *      뚫는 살이 조준을 이기면 갑옷은 자물쇠가 아니라 그냥 성가신 것이 된다.
 *
 * ── 2026-08-31, 형의 반려: "적 갑옷병은 갑옷도 무적이 아니게" ──
 *   ④ 보통 살로 두들기면 **갑옷이 벗겨진다.** 막힘은 헛발이 아니라 진행이다.
 *   ⑤ 벗겨진 뒤에는 아무 살이나 통한다.
 *   ⑥ **폭발은 갑옷을 무시한다** — 다만 즉사가 아니라 피해다 (보스가 한 방에 안 죽는다).
 *   ①과 ④는 모순이 아니다: 한 발은 여전히 체력에 안 닿는다. 달라진 건 '영원히'가 빠진 것이다.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { createWorld, step } from '../src/sim/world.ts'
import { P } from '../src/tune/params.ts'
import type { ArrowKindId, InputFrame, StageDef, Stats, Target, World } from '../src/sim/types.ts'

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

function foe(w: World): Target {
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

describe('갑옷은 무적이 아니다 (형의 반려 2026-08-31)', () => {
  it('★ 보통 살로 두들기면 벗겨진다 — 막힘은 헛발이 아니라 진행이다', () => {
    const w = createWorld(arena(), STATS)
    const t = foe(w)
    assert.ok(t.armorHp > 0, '갑옷 내구도가 안 잡혔다')

    // 벗겨질 때까지 몸통만 친다. 무한루프를 막기 위해 발수에 상한을 둔다.
    let shots = 0
    let broke = false
    while (shots < 12 && foe(w).alive) {
      const cur = foe(w)
      if (!cur.armored) break
      const before = cur.armorHp
      const evs = shoot(w, cur.x, cur.y - cur.r * 0.3)
      shots++
      if (evs.includes('armor_break')) { broke = true; break }
      assert.ok(
        foe(w).armorHp < before,
        `${shots}발째: 막혔는데 갑옷이 안 깎였다 (${before} → ${foe(w).armorHp})`,
      )
    }
    assert.ok(broke, `유엽전 ${shots}발로도 갑옷이 안 벗겨졌다 — 무적이 그대로다`)
    assert.equal(foe(w).armored, false, '파손 이벤트는 났는데 갑옷이 남아 있다')
    // 헤드샷(한 발)보다는 확실히 비싸야 조준이 이긴다.
    assert.ok(shots >= 2, `한 발에 벗겨졌다 (${shots}발) — 헤드샷을 이긴다`)
  })

  it('★ 벗겨진 뒤에는 보통 살이 체력에 닿는다', () => {
    const w = createWorld(arena(), STATS)
    for (let i = 0; i < 12 && foe(w).armored && foe(w).alive; i++) {
      const c = foe(w)
      shoot(w, c.x, c.y - c.r * 0.3)
    }
    const t = foe(w)
    assert.equal(t.armored, false, '갑옷이 안 벗겨져 시험을 못 한다')
    if (!t.alive) return // 벗겨지는 발에 이미 누웠다면 계약은 이미 만족이다
    const before = t.hp
    const evs = shoot(w, t.x, t.y - t.r * 0.3)
    assert.ok(!evs.includes('enemy_block'), '갑옷이 없는데 아직 막힌다')
    assert.ok(foe(w).hp < before || !foe(w).alive, '벗겨졌는데 피해가 안 들어간다')
  })

  it('★ 관통살은 갑옷을 깎지 않고 지나간다 — 벗기기와 뚫기는 다른 길이다', () => {
    const w = createWorld(arena(), STATS, 'heavy' as ArrowKindId)
    const t = foe(w)
    const armorBefore = t.armorHp
    const hpBefore = t.hp
    shoot(w, t.x, t.y - t.r * 0.3)
    assert.ok(foe(w).hp < hpBefore, '육량전이 갑옷을 못 뚫었다')
    assert.equal(foe(w).armorHp, armorBefore, '관통살이 판금을 부쉈다 — 지나가야 한다')
    assert.equal(foe(w).armored, true, '관통살에 갑옷이 벗겨졌다')
  })
})

describe('폭발과 갑옷 (형: "폭발터지면 갑곳 상관 없이 데미지")', () => {
  /** 화약통 하나와 갑옷 궁수 하나를 나란히 세운다. */
  function blastArena(bossHp = 0): StageDef {
    return {
      id: 'armor-blast',
      seed: 9,
      arrows: 30,
      targetScore: 100,
      wind: 0,
      targets: [
        { kind: 'barrel', x: 20, y: 1.2, r: 0.7, bomb: true, score: 0 },
        bossHp > 0
          ? { kind: 'boss', x: 21, y: 1.4, r: 1.6, hp: bossHp, armored: true, look: 0, score: 10 }
          : {
            kind: 'archer', x: 21, y: 1.4, r: 0.7,
            hp: Math.floor(P.enemy.archerHp), armored: true, fireDelay: 900,
          },
      ],
    }
  }

  it('★ 폭발은 갑옷을 무시하고 적을 눕힌다', () => {
    const w = createWorld(blastArena(), STATS)
    const b = w.targets.find((x) => x !== undefined && x.kind === 'barrel')
    assert.ok(b !== undefined, '화약통이 없다')
    shoot(w, b.x, b.y)
    const t = w.targets.find((x) => x !== undefined && x.kind === 'archer')
    assert.ok(t !== undefined && !t.alive, '폭발이 갑옷 궁수를 못 눕혔다')
  })

  it('★ 그래도 즉사가 아니라 피해다 — 보스는 한 방에 안 죽는다', () => {
    // 체력이 폭발 피해보다 확실히 큰 보스. 예전 규칙(alive=false)이면 여기서 즉사한다.
    const hp = Math.floor(P.target.blastDamage) * 3
    const w = createWorld(blastArena(hp), STATS)
    const b = w.targets.find((x) => x !== undefined && x.kind === 'barrel')
    assert.ok(b !== undefined, '화약통이 없다')
    shoot(w, b.x, b.y)
    const boss = w.targets.find((x) => x !== undefined && x.kind === 'boss')
    assert.ok(boss !== undefined, '보스가 사라졌다')
    assert.equal(boss.alive, true, '보스가 폭발 한 방에 즉사했다 (호위 옆 화전 = 보스 처치)')
    assert.ok(boss.hp < hp, '보스가 폭발에 아무 피해도 안 받았다')
    assert.equal(boss.armored, false, '폭발이 갑주를 못 뜯었다')
  })
})
