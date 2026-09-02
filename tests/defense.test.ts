/**
 * 방어 — 판 도중에 사는 방패와 두정갑 (형: "게임플레이 도중에 방어벽이나 방어구 구매")
 *
 * 여기서 지키는 계약:
 *   ① 방패는 **적 화살만** 삼킨다. 내 화살은 그 위로 나간다 (파비스).
 *   ② 방패는 내구만큼만 막고 부서진다 — 무적이 아니다.
 *   ③ 방패는 **판을 넘지 않는다.** 그게 방패가 싼 이유다.
 *   ④ 두정갑은 체력보다 **먼저** 깎인다. 다 깎이면 벗겨지고 그 뒤엔 체력이 깎인다.
 *   ⑤ 나를 깎는 **모든 길**(적 화살 · 돌진 접촉)이 갑옷을 지난다 — 한쪽만 먹으면 버그다.
 *   ⑥ 값은 훈련치다. 못 사면 아무것도 안 깎인다 (부분 지불 없음).
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { createWorld, resetWorld, step } from '../src/sim/world.ts'
import { P } from '../src/tune/params.ts'
import { armorPer, buyDefense, defenseBlocked, defenseCost, shieldHp } from '../src/game/defense.ts'
import type { DefenseState } from '../src/game/defense.ts'
import { defaultSave } from '../src/game/save.ts'
import type { InputFrame, StageDef, Stats, World } from '../src/sim/types.ts'

const STATS: Stats = { str: 12, steady: 8, stamina: 12, focus: 6 }
const IDLE: InputFrame = { aimX: 20, aimY: 2, drawing: false, steady: false }

/** 적 궁수 하나가 곧 쏜다. 뒤의 먼 과녁은 빈 판 즉시 클리어 방지용이다. */
function arena(fireDelay: number): StageDef {
  return {
    id: 'defense-test',
    seed: 5,
    arrows: 30,
    targetScore: 100,
    wind: 0,
    targets: [
      { kind: 'archer', x: 18, y: 1.5, r: 0.65, hp: Math.floor(P.enemy.archerHp), fireDelay, score: 100 },
      { kind: 'static', x: 60, y: 12, r: 0.2, score: 0 },
    ],
  }
}

/** 산포를 끄고 재는 자리 — 여기서 재는 건 명중률이 아니라 배선이다. */
function noScatter<T>(fn: () => T): T {
  const keep = P.enemy.aimScatter
  ;(P.enemy as { aimScatter: number }).aimScatter = 0
  try {
    return fn()
  } finally {
    ;(P.enemy as { aimScatter: number }).aimScatter = keep
  }
}

/** 적이 나를 한 발 맞힐 때까지 돌린다. 그동안 나온 이벤트 종류를 모아 돌려준다. */
function untilStruck(w: World, steps = 1800): string[] {
  const seen: string[] = []
  for (let i = 0; i < steps; i++) {
    step(w, IDLE)
    for (const e of w.events) if (e !== undefined) seen.push(e.t)
    w.events.length = 0
    if (seen.includes('guard_block') || seen.includes('player_hit')) break
  }
  return seen
}

const STATE = (over: Partial<DefenseState> = {}): DefenseState => ({
  playing: true, shield: 0, shieldMax: 0, armor: 0, armorMax: 0, arrowsBought: 0, ...over,
})

describe('방어 — 방패', () => {
  it('세운 방패가 적 화살을 삼킨다 (체력은 그대로)', () => {
    noScatter(() => {
      const w = createWorld(arena(0.5), STATS)
      w.shieldMax = shieldHp()
      w.shield = w.shieldMax
      const hp0 = w.hp
      const seen = untilStruck(w)
      assert.ok(seen.includes('guard_block'), '방패가 아무것도 안 막았다')
      assert.ok(!seen.includes('player_hit'), '방패가 있는데 맞았다')
      assert.equal(w.hp, hp0, '방패가 막았는데 체력이 깎였다')
      assert.equal(w.shield, shieldHp() - 1, '내구가 한 발만큼 안 줄었다')
    })
  })

  it('방패는 내 화살을 막지 않는다 — 파비스는 그 위로 쏘는 물건이다', () => {
    const w = createWorld(arena(900), STATS)
    w.shieldMax = shieldHp()
    w.shield = w.shieldMax
    const hold: InputFrame = { aimX: 18, aimY: 1.5, drawing: true, steady: false }
    const rest: InputFrame = { aimX: 18, aimY: 1.5, drawing: false, steady: false }
    for (let i = 0; i < 900 && w.archer.phase !== 'full'; i++) step(w, hold)
    w.events.length = 0
    step(w, rest)
    let passed = false
    for (let i = 0; i < 400 && !passed; i++) {
      step(w, rest)
      passed = w.arrows.some((a) => a.alive && a.x > P.defense.shieldX + 2)
    }
    assert.ok(passed, '내 화살이 방패 자리를 못 넘었다')
    assert.equal(w.shield, w.shieldMax, '내 화살이 내 방패에 박혔다')
  })

  it('내구를 다 쓰면 부서지고, 그 뒤로는 맨몸이다', () => {
    noScatter(() => {
      const w = createWorld(arena(0.5), STATS)
      w.shieldMax = 1
      w.shield = 1
      const hp0 = w.hp
      const first = untilStruck(w)
      assert.ok(first.includes('guard_block'), '첫 발을 못 막았다')
      assert.equal(w.shieldMax, 0, '부서진 방패가 화면에 남는다')
      const second = untilStruck(w)
      assert.ok(second.includes('player_hit'), '방패가 부서졌는데 다음 발도 막혔다')
      assert.ok(w.hp < hp0, '맞았는데 체력이 그대로다')
    })
  })

  it('방패는 판을 넘지 않는다 (resetWorld가 치운다)', () => {
    const w = createWorld(arena(900), STATS)
    w.shieldMax = shieldHp()
    w.shield = w.shieldMax
    resetWorld(w, arena(900), STATS)
    assert.equal(w.shield, 0, '방패가 다음 판까지 따라왔다')
    assert.equal(w.shieldMax, 0)
  })
})

describe('방어 — 두정갑', () => {
  it('체력보다 먼저 깎이고, 다 깎이면 벗겨진다', () => {
    noScatter(() => {
      const w = createWorld(arena(0.5), STATS)
      // 한 발이면 정확히 벗겨지는 크기 — 흡수와 파손을 같은 발에서 잰다.
      w.armorMax = Math.floor(P.enemy.arrowDamage)
      w.armor = w.armorMax
      const hp0 = w.hp
      const seen = untilStruck(w)
      assert.ok(seen.includes('guard_block'), '갑옷이 아무것도 안 받았다')
      assert.ok(!seen.includes('player_hit'), '갑옷이 받았는데 체력 피격이 났다')
      assert.equal(w.hp, hp0, '갑옷이 받았는데 체력이 깎였다')
      assert.equal(w.armorMax, 0, '벗겨진 갑옷의 바가 화면에 남는다')
      const next = untilStruck(w)
      assert.ok(next.includes('player_hit'), '벗겨졌는데 다음 발도 막혔다')
      assert.ok(w.hp < hp0, '맞았는데 체력이 그대로다')
    })
  })

  it('한 발이 갑옷을 넘치면 남은 만큼만 체력이 깎인다', () => {
    noScatter(() => {
      const dmg = Math.floor(P.enemy.arrowDamage)
      const w = createWorld(arena(0.5), STATS)
      const worn = Math.max(1, Math.floor(dmg / 2))
      w.armorMax = worn
      w.armor = worn
      const hp0 = w.hp
      untilStruck(w)
      assert.equal(w.hp, hp0 - (dmg - worn), '넘친 피해가 정확히 안 넘어왔다')
      assert.equal(w.armor, 0)
    })
  })

  it('돌진 접촉도 갑옷을 지난다 — 나를 깎는 길은 전부 한 문으로 온다', () => {
    const stage: StageDef = {
      id: 'defense-charger', seed: 7, arrows: 10, targetScore: 100, wind: 0,
      targets: [
        { kind: 'charger', x: 4, y: 1.2, r: 0.6, speed: 6, score: 50 },
        { kind: 'static', x: 60, y: 12, r: 0.2, score: 0 },
      ],
    }
    const w = createWorld(stage, STATS)
    w.armorMax = 999
    w.armor = 999
    const hp0 = w.hp
    let blocked = false
    for (let i = 0; i < 1800 && !blocked; i++) {
      step(w, IDLE)
      blocked = w.events.some((e) => e.t === 'guard_block')
      w.events.length = 0
    }
    assert.ok(blocked, '돌진 접촉이 갑옷을 안 지났다')
    assert.equal(w.hp, hp0, '갑옷이 있는데 돌진에 체력이 깎였다')
  })
})

describe('방어 — 사는 규칙', () => {
  it('훈련치가 모자라면 아무것도 안 깎인다', () => {
    const d = defaultSave(0)
    d.training = defenseCost('shield') - 1
    assert.notEqual(defenseBlocked(d, 'shield', STATE()), '', '못 사는데 이유가 없다')
    assert.equal(buyDefense(d, 'shield', STATE()), false)
    assert.equal(d.training, defenseCost('shield') - 1, '못 샀는데 훈련치가 깎였다')
  })

  it('이미 세워 뒀으면 또 못 산다', () => {
    const d = defaultSave(0)
    d.training = 99
    assert.equal(buyDefense(d, 'shield', STATE({ shieldMax: 4, shield: 4 })), false)
    assert.equal(d.training, 99)
  })

  it('두정갑은 겹쳐 입되 상한이 있다', () => {
    const d = defaultSave(0)
    d.training = 9999
    let n = 0
    while (buyDefense(d, 'armor', STATE()) && n < 99) n++
    assert.ok(n >= 1, '한 벌도 못 샀다')
    assert.equal(d.runArmor, Math.floor(P.defense.armorMax), '상한까지 안 찼다')
    assert.equal(d.runArmor, d.runArmorMax)
    assert.equal(buyDefense(d, 'armor', STATE()), false, '상한을 넘겨 샀다')
    // 한 벌의 크기가 노브 그대로여야 한다 — 코드에 숫자를 박지 않았다는 증거다.
    assert.equal(armorPer(), Math.floor(P.defense.armorPer))
  })

  it('판이 안 도는 동안(드래프트·결과 화면)에는 못 산다', () => {
    const d = defaultSave(0)
    d.training = 9999
    assert.equal(buyDefense(d, 'shield', STATE({ playing: false })), false)
    assert.equal(d.training, 9999)
  })
})
