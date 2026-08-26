/**
 * 폭탄 과녁 (2026-08-26, 형: "맞히는 오브젝트중에 폭발하는 폭탄이라던가 이런것도 넣어야지").
 *
 * 폭발 살(arrowkind burst)과 같은 함수(sim/target.ts burst())를 쓰되, 화살이 아니라
 * **과녁 자신이 죽는 순간**에만 터진다. 여기서 지키는 것은 셋이다.
 *  1. 반경 안은 죽고 밖은 산다.
 *  2. **살아남으면 안 터진다** — 죽는 순간에만이다 (버틴 적은 아직 아니다).
 *  3. **재귀하지 않는다** — 연쇄로 죽은 폭탄은 다시 안 터진다 (밀집 배치가 한 발에 안 지워진다).
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { createWorld, step } from '../src/sim/world.ts'
import { spawnArrow } from '../src/sim/ballistics.ts'
import { P } from '../src/tune/params.ts'
import type { InputFrame, StageDef, Stats } from '../src/sim/types.ts'

const STATS: Stats = { str: 10, steady: 8, stamina: 8, focus: 6 }
const IDLE: InputFrame = { aimX: 20, aimY: 2, drawing: false, steady: false }

/** 임의의 배치에서 (tx, ty)를 겨누는 각을 찾는다 (tests/arrows.test.ts의 aimAt와 같은 방식). */
function aimAt(make: () => StageDef, tx: number, ty: number): number {
  let best = 0
  let bestErr = Number.POSITIVE_INFINITY
  for (let deg = -5; deg <= 30; deg += 0.05) {
    const ang = (deg * Math.PI) / 180
    const w = createWorld(make(), STATS, 'basic')
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

/** 폭탄(x=16) + 반경 안(x=17, 거리 1m < bombRadius) + 반경 밖(x=16+bombRadius+3, 확실히 밖). */
function bombDef(): StageDef {
  const far = 16 + P.target.bombRadius + 3
  return {
    id: 'bomb-test', seed: 1, arrows: 5, targetScore: 100, wind: 0,
    targets: [
      { kind: 'static', x: 16, y: 2, r: 0.5, score: 100, bomb: true },
      { kind: 'static', x: 17, y: 2.1, r: 0.4, score: 100 },
      { kind: 'static', x: far, y: 2, r: 0.4, score: 100 },
    ],
  }
}

describe('폭탄 과녁', () => {
  it('죽으면 burst 이벤트를 내고 반경 안은 죽고 밖은 산다', () => {
    const angle = aimAt(bombDef, 16, 2)
    const w = createWorld(bombDef(), STATS, 'basic')
    assert.notEqual(spawnArrow(w, angle, 1), null)
    let bursts = 0
    let radiusSeen = -1
    for (let i = 0; i < 600; i++) {
      step(w, IDLE)
      for (const e of w.events) {
        if (e.t === 'burst') {
          bursts++
          radiusSeen = e.radius
        }
      }
      w.events.length = 0
    }
    assert.equal(bursts, 1, `burst 이벤트가 1이 아니라 ${bursts}`)
    assert.ok(Math.abs(radiusSeen - P.target.bombRadius) < 1e-6, `반경이 안 맞다: ${radiusSeen}`)

    const bomb = w.targets[0]
    const near = w.targets[1]
    const farT = w.targets[2]
    assert.ok(bomb !== undefined && !bomb.alive, '폭탄 자신이 안 죽었다')
    assert.ok(near !== undefined && !near.alive, '반경 안 과녁이 안 죽었다')
    assert.ok(farT !== undefined && farT.alive, '반경 밖 과녁까지 죽었다')
  })

  it('폭탄이 아닌 과녁은 죽어도 안 터진다', () => {
    const plain = (): StageDef => ({
      id: 'no-bomb-test', seed: 1, arrows: 5, targetScore: 100, wind: 0,
      targets: [
        { kind: 'static', x: 16, y: 2, r: 0.5, score: 100 },
        { kind: 'static', x: 17, y: 2.1, r: 0.4, score: 100 },
      ],
    })
    const angle = aimAt(plain, 16, 2)
    const w = createWorld(plain(), STATS, 'basic')
    assert.notEqual(spawnArrow(w, angle, 1), null)
    let bursts = 0
    for (let i = 0; i < 600; i++) {
      step(w, IDLE)
      for (const e of w.events) if (e.t === 'burst') bursts++
      w.events.length = 0
    }
    assert.equal(bursts, 0, '폭탄이 아닌데 burst가 났다')
    const near = w.targets[1]
    assert.ok(near !== undefined && near.alive, '안 터졌는데 옆 과녁이 죽었다')
  })

  it('맞아도 살아남으면(체력 있는 적) 아직 안 터진다', () => {
    const survive = (): StageDef => ({
      id: 'bomb-survive-test', seed: 1, arrows: 5, targetScore: 100, wind: 0,
      targets: [
        { kind: 'archer', x: 16, y: 0.72, r: 0.6, hp: 9999, bomb: true, score: 100 },
        { kind: 'static', x: 17, y: 0.8, r: 0.4, score: 100 },
      ],
    })
    const angle = aimAt(survive, 16, 0.72)
    const w = createWorld(survive(), STATS, 'basic')
    assert.notEqual(spawnArrow(w, angle, 1), null)
    let bursts = 0
    let hit = false
    for (let i = 0; i < 600; i++) {
      step(w, IDLE)
      for (const e of w.events) {
        if (e.t === 'burst') bursts++
        if (e.t === 'hit') hit = true
      }
      w.events.length = 0
    }
    assert.ok(hit, '애초에 안 맞았다 — 조준 검증 자체가 실패')
    const archer = w.targets[0]
    assert.ok(archer !== undefined && archer.alive, '체력 9999가 한 발에 죽었다 — 시나리오가 틀렸다')
    assert.equal(bursts, 0, '살아남았는데 터졌다')
  })

  it('연쇄로 죽은 폭탄은 재귀 폭발하지 않는다', () => {
    // 폭탄 둘을 서로의 반경 안에 둔다. 하나를 직격하면 다른 하나는 연쇄로 죽되,
    // burst 이벤트는 처음 것 하나뿐이어야 한다 (재귀 금지).
    const dual = (): StageDef => ({
      id: 'bomb-chain-test', seed: 1, arrows: 5, targetScore: 100, wind: 0,
      targets: [
        { kind: 'static', x: 16, y: 2, r: 0.5, score: 100, bomb: true },
        { kind: 'static', x: 16 + 1, y: 2.1, r: 0.4, score: 100, bomb: true },
      ],
    })
    const angle = aimAt(dual, 16, 2)
    const w = createWorld(dual(), STATS, 'basic')
    assert.notEqual(spawnArrow(w, angle, 1), null)
    let bursts = 0
    for (let i = 0; i < 600; i++) {
      step(w, IDLE)
      for (const e of w.events) if (e.t === 'burst') bursts++
      w.events.length = 0
    }
    assert.equal(bursts, 1, `연쇄로 죽은 폭탄이 또 터졌다 (재귀): burst=${bursts}`)
    for (const t of w.targets) assert.ok(t !== undefined && !t.alive, '둘 다 죽어야 한다')
  })
})
