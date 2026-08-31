/**
 * 산전(散箭) · 연주전(連珠箭) — **한 번 당겨 세 발** (2026-08-31, 형).
 *
 * 형: "샷건같은 3개 동시쏘는 화살도 필요할거고 한번만 쏴도 빠르게 조준방향대로
 *      3발 연사하는것도 있어야하고."
 *
 * 둘 다 한 번의 당김에 세 발인데 **벌어지는 축이 다르다** — 산전은 공간(부채꼴)으로,
 * 연주전은 시간(연속)으로 벌어진다. 여기서 지키는 것은 여섯이다.
 *   1. 산전은 **같은 프레임에** 세 발이 난다 (시간차가 아니다).
 *   2. 연주전은 **시간차로** 세 발이 난다 (부채꼴이 아니다) — 방향은 첫 발과 같다.
 *   3. 둘 다 지급 화살은 **한 발만** 깎인다. 이게 두 살의 존재 이유다 —
 *      셋을 깎으면 그냥 '연출이 화려한 보통 살'이고 고를 이유가 없다.
 *   4. 곁가지·뒷발은 miss 를 뱉지 않는다 (분열 자식과 같은 규칙: 당김은 한 번이다).
 *   5. 예약은 **판 경계를 넘지 않는다** — 전 판의 뒷발이 다음 판에 튀어나오면 유령이다.
 *   6. 아직 나갈 뒷발이 있으면 판이 실패로 끝나지 않는다 (산 값은 받아야 한다).
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { createWorld, resetWorld, step } from '../src/sim/world.ts'
import { spawnArrow } from '../src/sim/ballistics.ts'
import { arrowFx } from '../src/sim/arrowfx.ts'
import type { InputFrame, StageDef, Stats, World } from '../src/sim/types.ts'

const STATS: Stats = { str: 10, steady: 8, stamina: 8, focus: 6 }
const IDLE: InputFrame = { aimX: 20, aimY: 2, drawing: false, steady: false }

/** 멀리 있는 과녁 하나. 화살이 중간에 무엇에도 안 걸려야 발사 자체를 잴 수 있다. */
function far(): StageDef {
  return {
    id: 'volley-test', seed: 0x51, arrows: 4, targetScore: 100, wind: 0,
    targets: [{ kind: 'static', x: 40, y: 6, r: 0.3, score: 100 }],
  }
}

/** 살아있는 화살의 각도 목록 (오름차순). */
function liveAngles(w: World): number[] {
  const out: number[] = []
  for (const a of w.arrows) if (a !== undefined && a.alive) out.push(Math.atan2(a.vy, a.vx))
  return out.sort((p, q) => p - q)
}

function liveCount(w: World): number {
  let n = 0
  for (const a of w.arrows) if (a !== undefined && a.alive) n++
  return n
}

describe('산전 — 공간으로 벌어진다', () => {
  it('한 번 당기면 그 자리에서 세 발이 동시에 난다', () => {
    const w = createWorld(far(), STATS, 'scatter')
    const a = spawnArrow(w, 0.3, 1)
    assert.notEqual(a, null, '발사에 실패했다')
    // step 을 한 번도 안 돌렸는데 셋이 떠 있어야 '동시'다.
    assert.equal(liveCount(w), arrowFx('scatter').volleyCount, '동시 발사 수가 다르다')
  })

  it('부채꼴로 벌어진다 — 가운데는 겨눈 각 그대로', () => {
    const fx = arrowFx('scatter')
    const w = createWorld(far(), STATS, 'scatter')
    spawnArrow(w, 0.3, 1)
    const angles = liveAngles(w)
    assert.equal(angles.length, 3)
    // 가운데 살이 조준각이다. 이게 어긋나면 "겨눈 데로 안 간다"가 된다.
    assert.ok(Math.abs((angles[1] ?? 0) - 0.3) < 1e-9, '가운데 살이 조준각이 아니다')
    // 바깥 둘은 ±volleySpread. 부채가 안 벌어지면 산전이 아니라 겹친 보통 살 셋이다.
    assert.ok(Math.abs((angles[0] ?? 0) - (0.3 - fx.volleySpread)) < 1e-9, '아래 살의 각이 다르다')
    assert.ok(Math.abs((angles[2] ?? 0) - (0.3 + fx.volleySpread)) < 1e-9, '위 살의 각이 다르다')
  })

  it('세 발이 나가도 지급 화살은 한 발만 깎인다', () => {
    const w = createWorld(far(), STATS, 'scatter')
    spawnArrow(w, 0.3, 1)
    assert.equal(w.arrowsLeft, 3, '한 번 당겼는데 재고가 한 발 넘게 줄었다')
  })

  it('곁가지가 땅에 꽂혀도 miss 는 한 번뿐이다 (당김은 한 번)', () => {
    const w = createWorld(far(), STATS, 'scatter')
    spawnArrow(w, 0.05, 1) // 낮게 — 과녁(40m, 6m)에는 절대 안 닿는다
    let miss = 0
    for (let i = 0; i < 900; i++) {
      step(w, IDLE)
      for (const e of w.events) if (e.t === 'miss') miss++
      w.events.length = 0
      if (liveCount(w) === 0) break
    }
    assert.equal(miss, 1, `miss 가 ${miss}번 났다 — 곁가지가 명중률 분모를 오염시킨다`)
  })
})

describe('연주전 — 시간으로 벌어진다', () => {
  it('첫 발은 즉시, 뒷발은 간격을 두고 나간다', () => {
    const fx = arrowFx('rapid')
    const w = createWorld(far(), STATS, 'rapid')
    spawnArrow(w, 0.3, 1)
    // 발사 직후에는 한 발뿐이어야 한다. 셋이면 그건 산전이다.
    assert.equal(liveCount(w), 1, '연주전이 동시에 나갔다')
    let fired = 1
    let elapsedAtLast = 0
    for (let i = 0; i < 900; i++) {
      step(w, IDLE)
      for (const e of w.events) {
        if (e.t === 'rapid') {
          fired++
          elapsedAtLast = w.elapsed
        }
      }
      w.events.length = 0
      if (w.rapidLeft === 0) break
    }
    assert.equal(fired, fx.rapidCount + 1, '도합 발수가 다르다')
    // 마지막 뒷발은 rapidCount × rapidDelay 쯤에 나가야 한다 (한 스텝 오차 허용).
    const want = fx.rapidCount * fx.rapidDelay
    assert.ok(
      Math.abs(elapsedAtLast - want) <= w.dt + 1e-9,
      `마지막 뒷발이 ${elapsedAtLast.toFixed(3)}s 에 나갔다 (기대 ${want.toFixed(3)}s)`,
    )
  })

  it('뒷발은 첫 발과 같은 방향으로 간다 ("조준방향대로")', () => {
    const w = createWorld(far(), STATS, 'rapid')
    spawnArrow(w, 0.3, 1)
    const seen: number[] = []
    for (let i = 0; i < 900; i++) {
      step(w, IDLE)
      for (const e of w.events) if (e.t === 'rapid') seen.push(e.angle)
      w.events.length = 0
      if (w.rapidLeft === 0) break
    }
    assert.equal(seen.length, arrowFx('rapid').rapidCount)
    for (const ang of seen) assert.ok(Math.abs(ang - 0.3) < 1e-9, '뒷발이 딴 데로 갔다')
  })

  it('세 발이 나가도 지급 화살은 한 발만 깎인다', () => {
    const w = createWorld(far(), STATS, 'rapid')
    spawnArrow(w, 0.3, 1)
    for (let i = 0; i < 60; i++) {
      step(w, IDLE)
      w.events.length = 0
    }
    assert.equal(w.rapidLeft, 0, '뒷발이 안 나갔다')
    assert.equal(w.arrowsLeft, 3, '한 번 당겼는데 재고가 한 발 넘게 줄었다')
  })

  it('예약은 판 경계를 넘지 않는다', () => {
    const w = createWorld(far(), STATS, 'rapid')
    spawnArrow(w, 0.3, 1)
    assert.ok(w.rapidLeft > 0, '예약이 안 걸렸다')
    resetWorld(w, far(), STATS, 'rapid')
    assert.equal(w.rapidLeft, 0, '전 판의 뒷발 예약이 다음 판으로 넘어왔다')
  })

  it('나갈 뒷발이 남았으면 판이 먼저 끝나지 않는다', () => {
    // 화살 한 발짜리 판에서 발치에 처박는다 — 첫 발은 한 스텝 만에 죽는다.
    const stage: StageDef = {
      id: 'volley-last', seed: 0x51, arrows: 1, targetScore: 100, wind: 0,
      targets: [{ kind: 'static', x: 40, y: 6, r: 0.3, score: 100 }],
    }
    const w = createWorld(stage, STATS, 'rapid')
    spawnArrow(w, -1.4, 1) // 거의 수직 아래
    let fired = 0
    for (let i = 0; i < 120; i++) {
      step(w, IDLE)
      for (const e of w.events) if (e.t === 'rapid') fired++
      w.events.length = 0
    }
    assert.equal(fired, arrowFx('rapid').rapidCount, '뒷발이 나가기 전에 판이 닫혔다')
  })
})
