/**
 * 환도 패링 (2026-09-10, 형: "'환도패링' 기능을 넣어. 적의 공격을 반사하는 패링기능이야") — 배선 검사.
 *
 * 여기서 못 박는 것 넷:
 *   ① 누른 **순간**에만 휘두른다 (꾹 눌러도 한 번). 쉬는 동안은 안 휘둘러진다.
 *   ② 날이 열린 동안 앞으로 오는 적 화살을 **되돌려보낸다** — 그리고 그 화살이 적을 때린다.
 *   ③ 판정이 빡빡하지 않다 (형의 요구) — 날이 열린 시간 × 적 화살 속도만큼의 거리를 잡는다.
 *   ④ 활을 당기던 중에 휘두르면 당김이 풀리되 **화살은 안 나간다** (C2 — 손해를 안 준다).
 * 손맛(칼의 각·잔상·소리)은 형이 눈과 귀로 판정한다.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { createWorld, step } from '../src/sim/world.ts'
import { P } from '../src/tune/params.ts'
import type { InputFrame, StageDef, Stats, World } from '../src/sim/types.ts'

const STATS: Stats = { str: 10, steady: 8, stamina: 8, focus: 6 }
const IDLE: InputFrame = { aimX: 20, aimY: 2, drawing: false, steady: false, parry: false }
const PARRY: InputFrame = { aimX: 20, aimY: 2, drawing: false, steady: false, parry: true }
const DRAW: InputFrame = { aimX: 20, aimY: 2, drawing: true, steady: false, parry: false }
const DRAW_PARRY: InputFrame = { aimX: 20, aimY: 2, drawing: true, steady: false, parry: true }

/** 사수 하나 — 판이 서자마자 나를 쏜다. fireDelay 를 0 으로 두면 첫 스텝에 화살이 난다. */
function def(): StageDef {
  return {
    id: 'parry-test',
    seed: 5,
    arrows: 10,
    targetScore: 100,
    wind: 0,
    targets: [{ kind: 'archer', look: 0, x: 18, y: 1.2, r: 0.6, hp: 100, fireDelay: 0.2, firePeriod: 99, score: 120 }],
  }
}
const run = (w: World, secs: number, f: InputFrame): void => {
  const n = Math.ceil(secs / w.dt)
  for (let i = 0; i < n; i++) step(w, f)
}
const has = (w: World, t: string): boolean => w.events.some((e) => e !== undefined && e.t === t)
const shotsAlive = (w: World): number => w.shots.filter((s) => s !== undefined && s.alive).length

describe('환도 패링', () => {
  it('누른 순간에만 휘두른다 — 꾹 눌러도 한 번, 쉬는 동안은 안 된다', () => {
    const w = createWorld(def(), STATS)
    const a = w.archer
    step(w, PARRY)
    assert.ok(a.parryLeft > 0, '안 휘둘렀다')
    assert.ok(has(w, 'parry'), 'parry 사건이 없다')
    // 계속 누르고 있어도 휘두름이 끝나면 그냥 끝난다 — 다시 휘두르지 않는다.
    run(w, P.parry.swing + 0.05, PARRY)
    assert.equal(a.parryLeft, 0, '누른 채로 두었더니 또 휘둘렀다')
    assert.ok(a.parryCool > 0, '쉬는 시간이 없다')
    // 뗐다 다시 눌러도 쉬는 동안은 안 된다.
    step(w, IDLE)
    step(w, PARRY)
    assert.equal(a.parryLeft, 0, '쉬는 동안 휘둘러졌다')
    // 쉬고 나면 다시 된다.
    run(w, P.parry.cool + 0.05, IDLE)
    step(w, PARRY)
    assert.ok(a.parryLeft > 0, '다 쉬었는데 안 휘둘러진다')
  })

  it('날이 열린 동안 적 화살을 쳐서 되돌려보낸다 — 되돌린 화살은 내 화살이다', () => {
    const w = createWorld(def(), STATS)
    // 적 화살이 날아오는 동안 기다렸다가, 궁수 앞에 왔을 때 휘두른다.
    let swung = false
    let parried = false
    for (let i = 0; i < 600 && !parried; i++) {
      const sh = w.shots.find((s) => s !== undefined && s.alive)
      // 칼이 닿는 자리에 들어오면 휘두른다.
      const near = sh !== undefined && sh.x - w.archer.x < P.parry.ahead + P.parry.reach
      step(w, near && !swung ? PARRY : IDLE)
      if (near) swung = true
      if (has(w, 'parry_hit')) parried = true
    }
    assert.ok(parried, '앞까지 온 화살을 못 쳤다')
    assert.equal(shotsAlive(w), 0, '친 화살이 아직 살아 있다')
    // 되돌아간 화살이 하나 있고, 오른쪽(적 쪽)으로 간다.
    const back = w.arrows.find((x) => x !== undefined && x.alive)
    assert.ok(back !== undefined, '되돌아간 화살이 없다')
    assert.ok(back.vx > 0, `되돌린 화살이 적 쪽으로 안 간다 (vx ${back.vx})`)
    // 재고를 안 깎는다 — 남의 화살이다.
    assert.equal(w.arrowsLeft, w.stage.arrows, '되돌린 화살이 내 살통에서 나갔다')
    // 중(中)으로 세지 않는다 — 한 번의 당김이 아니다.
    assert.equal(back.splitDepth, 1)
  })

  it('되돌린 화살이 적을 때린다 — 반사가 곧 반격이다', () => {
    const w = createWorld(def(), STATS)
    const foe = w.targets[0]
    assert.ok(foe !== undefined)
    const hp0 = foe.hp
    let swung = false
    for (let i = 0; i < 900; i++) {
      const sh = w.shots.find((s) => s !== undefined && s.alive)
      const near = sh !== undefined && sh.x - w.archer.x < P.parry.ahead + P.parry.reach
      step(w, near && !swung ? PARRY : IDLE)
      if (near) swung = true
      if (foe.hp < hp0) break
    }
    assert.ok(foe.hp < hp0, `되돌린 화살이 적을 못 때렸다 (체력 ${foe.hp}/${hp0})`)
  })

  it('판정이 빡빡하지 않다 — 날이 열린 시간이 적 화살로 여러 미터를 덮는다 (형의 요구)', () => {
    // 형: "패링 판정은 너무 빡빡하게 하진 않게 해서."
    // 잡는 구간 = 날이 열린 시간 × 적 화살 속도 + 반경 두 배. 사람의 반응 시간(약 0.25초)보다
    // 넉넉해야 "보고 누른다"가 된다.
    const covered = P.parry.active * P.enemy.arrowSpeed + P.parry.reach * 2
    assert.ok(covered >= 10, `잡는 구간이 ${covered.toFixed(1)}m 밖에 안 된다`)
    assert.ok(P.parry.active >= 0.2, `날이 ${P.parry.active}초만 열린다 — 프레임 반응을 요구한다`)
  })

  it('한 동작이 발도 · 슬래시 · 납도로 갈라지고, 슬래시는 순식간이다 (형: "박진감있게")', () => {
    // 형의 반려: "모션도 박진감있게 준비자세, 발도, 빠르게 휘두르기, 이런게 순식간에 지나가야해."
    // 그림은 형이 눈으로 보지만, **셋이 실제로 갈라져 있는지**와 **슬래시가 짧은지**는 숫자다.
    assert.ok(P.parry.ready > 0, '발도 구간이 없다 — 칼이 허공에서 튀어나온다')
    assert.ok(P.parry.slash > 0, '슬래시 구간이 없다')
    assert.ok(P.parry.ready + P.parry.slash < P.parry.swing, '납도할 시간이 안 남는다')
    // 60Hz 에서 다섯 프레임 안. 이보다 길면 "휘두른다"가 아니라 "돌린다"가 된다.
    assert.ok(P.parry.slash <= 0.1, `슬래시가 ${P.parry.slash}초다 — 순식간이 아니다`)
    // 베는 데까지 걸리는 시간이 사람의 반응 시간(약 0.25초) 안이어야 "즉발"로 느껴진다.
    assert.ok(P.parry.ready + P.parry.slash <= 0.25, '칼이 닿기까지 너무 오래 걸린다')
    // 날은 슬래시가 끝나기 전에 이미 화살을 잡고 있어야 한다 — 그림보다 판정이 늦으면 거짓말이다.
    assert.ok(P.parry.active > P.parry.ready + P.parry.slash, '슬래시가 끝난 뒤에야 잡기 시작한다')
  })

  it('위아래를 번갈아 벤다 — 첫 칼이 올려베기 (형: "다음 타격은 내려치기가 되고")', () => {
    const w = createWorld(def(), STATS)
    const a2 = w.archer
    assert.equal(a2.parryUp, false, '판이 서자마자 위아래가 정해져 있으면 안 된다 — 뒤집기는 휘두를 때 일어난다')
    const cut = (): boolean => {
      step(w, PARRY)
      const up = a2.parryUp
      run(w, P.parry.swing + P.parry.cool + 0.05, IDLE)
      return up
    }
    assert.equal(cut(), true, '첫 칼이 올려베기가 아니다 — 칼집이 허리에 있으니 뽑으며 올리는 것이 맞다')
    assert.equal(cut(), false, '둘째가 내려베기가 아니다')
    assert.equal(cut(), true, '셋째가 다시 올려베기가 아니다')
    // 판을 다시 세워도 규칙은 같다 — 렌더가 세면 여기서 어긋난다 (그래서 sim 이 센다).
    const w2 = createWorld(def(), STATS)
    step(w2, PARRY)
    assert.equal(w2.archer.parryUp, true, '새 판의 첫 칼이 올려베기가 아니다')
  })

  it('당기던 중에 휘두르면 당김이 풀리되 화살은 안 나간다 (C2)', () => {
    const w = createWorld(def(), STATS)
    run(w, 0.5, DRAW)
    assert.ok(w.archer.draw > 0, '안 당겨졌다')
    const left = w.arrowsLeft
    w.events.length = 0
    step(w, DRAW_PARRY)
    assert.equal(w.arrowsLeft, left, '패링이 화살을 태웠다')
    assert.equal(has(w, 'release'), false, '패링이 화살을 쏴 버렸다')
    assert.equal(w.archer.draw, 0, '당김이 안 풀렸다')
    assert.ok(w.archer.parryLeft > 0, '안 휘둘렀다')
  })
})
