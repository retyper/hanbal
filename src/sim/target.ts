/**
 * 과녁 — 갱신과 명중 처리
 *
 * 시간축은 w.tick * w.dt 뿐이다. 실시간 시계를 쓰면 프레임레이트에 따라 이동 과녁 위치가
 * 갈라지고 리플레이가 재현되지 않는다 (ARCHITECTURE A1).
 *
 * 클리어/실패 판정은 여기서 하지 않는다. w.status는 world.ts만 건드린다.
 */
import { clamp01, distSqPointSegment, TAU } from '../core/math.ts'
import { P } from '../tune/params.ts'
import type { Arrow, Target, World } from './types.ts'

export function stepTargets(w: World): void {
  const dt = w.dt
  // 시뮬 내부 시계. Date.now / performance.now 금지 (A1)
  const time = w.tick * dt
  const targets = w.targets

  for (let j = 0; j < targets.length; j++) {
    const tg = targets[j]
    if (tg === undefined || !tg.alive) continue

    // 직전 위치는 렌더 보간과 연쇄 선분 판정 양쪽에 필요하다. 종류와 무관하게 항상 갱신한다.
    tg.px = tg.x
    tg.py = tg.y

    if (tg.falling) {
      // 맞아서 떨어지는 중. 가속 없이 일정 속도로 내려간다 — 연쇄 타이밍을 눈으로 읽을 수 있어야 한다.
      tg.y -= P.chain.fallSpeed * dt
      sweepChain(w, tg)
      if (tg.y <= 0) tg.alive = false
    } else if (tg.kind === 'moving') {
      const phase = time * tg.freq * TAU
      const s = Math.sin(phase)
      // x·y 같은 위상을 쓴다. 그래야 t=0에서 스테이지가 적어둔 base 위치와 정확히 일치한다.
      tg.x = tg.baseX + tg.ampX * s
      tg.y = tg.baseY + tg.ampY * s
    }
    // static / pierceable / 낙하 전 aerial 은 정지. 위치를 건드리지 않는다.

    // 속도는 실제 변위에서 역산한다. 리드 샷을 읽는 렌더·HUD가 이 값을 쓴다.
    tg.vx = (tg.x - tg.px) / dt
    tg.vy = (tg.y - tg.py) / dt
  }
}

export function resolveHit(w: World, arrow: Arrow, target: Target): void {
  // 명중도는 화살의 현재 점이 아니라 **이번 스텝 궤적 선분**과 중심의 최단거리로 잰다.
  // 빠른 화살은 한 스텝에 과녁을 통과해 버리므로, 점으로 재면 중심 명중이 가장자리로 읽힌다.
  const dsq = distSqPointSegment(target.x, target.y, arrow.px, arrow.py, arrow.x, arrow.y)
  // r이 0인 과녁은 정의상 항상 중심 명중. 0으로 나누면 NaN이 판 전체를 죽인다.
  const accuracy = target.r > 0 ? clamp01(1 - Math.sqrt(dsq) / target.r) : 1

  // 화살이 직접 맞힌 것이 연쇄의 뿌리다
  target.chainDepth = 0
  const gained = award(w, target, accuracy)
  w.events.push({
    t: 'hit',
    targetId: target.id,
    x: target.x,
    y: target.y,
    score: gained,
    accuracy,
    chain: target.chainDepth,
    combo: w.combo,
  })

  if (target.kind === 'pierceable') {
    arrow.pierced++
    // 중심을 뚫을수록 더 두꺼운 부분을 지나 속도를 잃는다. 가장자리를 스치면 거의 안 잃는다.
    const keep = 1 - accuracy * P.arrow.pierceSpeedLoss
    arrow.vx *= keep
    arrow.vy *= keep
  } else {
    arrow.outcome = 'hit'
    arrow.alive = false
  }

  if (target.kind === 'aerial') {
    // 공중 과녁은 맞아도 사라지지 않는다. 떨어지면서 아래를 연쇄로 쳐야 한다 (GDD 7장).
    target.falling = true
  } else {
    target.alive = false
  }
}

/**
 * 낙하 중인 과녁이 이번 스텝에 지나간 선분 위의 과녁을 연쇄로 친다 (GDD 7장, 보로로로록).
 *
 * 선분으로 판정하는 이유는 화살과 같다 — fallSpeed가 크면 한 스텝에 작은 과녁을 뛰어넘는다.
 * 처리 순서는 **위에 있는 것부터**. 낙하는 수직이라 그게 실제로 부딪히는 순서이고,
 * 배열 인덱스 순으로 처리하면 같은 상황에서 콤보 배수가 붙는 대상이 뒤바뀐다.
 */
function sweepChain(w: World, faller: Target): void {
  const targets = w.targets

  for (let pass = 0; pass < targets.length; pass++) {
    let bestJ = -1
    let bestY = 0
    for (let j = 0; j < targets.length; j++) {
      const c = targets[j]
      if (c === undefined || c === faller) continue
      // 이미 떨어지는 중인 과녁은 건너뛴다. 안 그러면 서로를 매 스텝 다시 치며 이벤트가 폭주한다.
      if (!c.alive || c.falling) continue
      // hitRadius는 낙하물 자체의 반경이다. 과녁 반경을 더해야 표면끼리 닿는 순간이 된다.
      const reach = P.chain.hitRadius + c.r
      if (distSqPointSegment(c.x, c.y, faller.px, faller.py, faller.x, faller.y) > reach * reach) continue
      if (bestJ < 0 || c.y > bestY) {
        bestY = c.y
        bestJ = j
      }
    }
    if (bestJ < 0) break
    const c = targets[bestJ]
    if (c === undefined) break

    c.chainDepth = faller.chainDepth + 1
    // 몸통으로 들이받은 것이라 링 명중도는 최대로 본다
    award(w, c, 1)
    w.events.push({ t: 'chain', targetId: c.id, x: c.x, y: c.y, depth: c.chainDepth })

    if (c.kind === 'aerial') {
      // 얘도 떨어지며 다음 연쇄를 만든다. 그래서 alive를 유지한다.
      c.falling = true
    } else {
      c.alive = false
    }
  }
}

/**
 * 점수 가산 + 콤보 증가. 직격과 연쇄가 같은 규칙을 쓴다 — 연쇄만 따로 계산하면
 * 배수 상한 없는 콤보(GDD 7장)가 두 곳에서 갈라진다.
 */
function award(w: World, target: Target, accuracy: number): number {
  // 가장자리 1배 ~ 중심 ringMulMax 배. ringCurve로 중심에 얼마나 인색할지 정한다.
  const ring = 1 + (P.score.ringMulMax - 1) * Math.pow(accuracy, P.score.ringCurve)
  const gained = Math.round(target.score * ring * Math.pow(P.chain.comboMul, w.combo))
  w.score += gained
  w.combo++
  return gained
}
