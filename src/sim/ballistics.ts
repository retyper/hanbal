/**
 * 화살 비행 (탄도)
 *
 * 좌표는 미터, y 위쪽 +. 시계는 w.dt 고정 스텝뿐이다 (ARCHITECTURE A1).
 * 화살은 60m/s를 넘고 한 스텝은 1/120초라 스텝당 0.5m를 건너뛴다.
 * 그래서 위치 판정은 전부 **직전 위치 → 현재 위치 선분** 기준이다. 점 판정은 과녁을 뚫고 지나간다.
 */
import { angleDelta, clamp01, damp, distSqPointSegment, lerp, normAngle } from '../core/math.ts'
import { P } from '../tune/params.ts'
import { effectiveStats } from './bow.ts'
import { resolveHit } from './target.ts'
import { TRAIL_POINTS } from './types.ts'
import type { Arrow, World } from './types.ts'

/**
 * 궤적 표본 간격 (스텝). 매 스텝 기록하면 48점이 0.4초밖에 못 담아
 * 1-1(비행 0.62s)에서도 빗나간 화살의 궤적이 통째로 화면 밖에 그려진다 —
 * "왜 빗나갔는지 읽힌다"(GDD 8장)가 무효가 된다. 4로 벌리면 1.6초를 담는다.
 * 버퍼 크기도 stroke 수도 그대로다 (A5).
 */
const TRAIL_STRIDE = 4

/**
 * 화살 풀에서 죽은 슬롯 하나를 재사용한다. 빈 슬롯이 없으면 null.
 * 새 객체를 만들지 않는다 — 발사는 드물지만 여기서 new를 허용하면 풀의 의미가 사라진다 (A5).
 *
 * arrowsLeft 는 **실제로 화살이 나간 시점에만** 줄인다 (world.ts step 주석의 약속).
 * 잔량이 없거나 풀이 꽉 차서 발사에 실패하면 잔량은 그대로다.
 */
export function spawnArrow(w: World, angle: number, power: number): Arrow | null {
  if (w.arrowsLeft <= 0) return null

  const pool = w.arrows
  let a: Arrow | null = null
  for (let i = 0; i < pool.length; i++) {
    const slot = pool[i]
    if (slot !== undefined && !slot.alive) {
      a = slot
      break
    }
  }
  if (a === null) return null

  const d = effectiveStats(w.stats)
  const pw = clamp01(power)
  // drawCurve > 1 이라 만작 근처에서 속도가 급격히 붙는다. 실제 활의 장력 곡선이 이렇다.
  const speed = lerp(P.bow.minSpeed, P.bow.maxSpeed, Math.pow(pw, P.bow.drawCurve)) * d.speedMul

  a.alive = true
  a.x = w.archer.x
  a.y = w.archer.y
  a.px = a.x
  a.py = a.y
  a.vx = Math.cos(angle) * speed
  a.vy = Math.sin(angle) * speed
  a.angle = normAngle(angle)
  a.age = 0
  a.pierced = 0
  a.outcome = 'flying'
  a.power = pw
  a.trailLen = 0
  a.trailHead = 0
  // 첫 표본(발사점)과 머리 칸을 함께 연다. 머리 칸이 없으면 첫 스텝의 덮어쓰기가 발사점을 지운다.
  openTrailSlot(a)
  openTrailSlot(a)

  w.arrowsLeft--
  return a
}

export function stepArrows(w: World): void {
  const dt = w.dt
  const pool = w.arrows

  for (let i = 0; i < pool.length; i++) {
    const a = pool[i]
    if (a === undefined || !a.alive) continue

    a.px = a.x
    a.py = a.y

    // 바람은 화살을 미는 힘이 아니라 **공기의 속도**다.
    // vx에 바람을 더하면 에너지를 주입하게 되고 "발사 후 운동에너지는 증가하지 않는다"가 깨진다.
    // 상대속도에 대한 항력으로만 작용시키면 화살은 공기 속도에 점근할 뿐 그 이상 빨라지지 않는다.
    // w.wind 에는 world.ts 가 이미 P.wind.effect 를 곱해 두었다. 여기서 또 곱하면 이중 적용이다.
    const rvx = a.vx - w.wind
    const rvy = a.vy
    const rSpeed = Math.sqrt(rvx * rvx + rvy * rvy)
    // 항력은 속도 제곱에 비례하고 방향은 상대속도 반대 → 성분별로 k * |v| * v_i.
    // 질량으로 나누지 않는다. P.arrow.drag 자체가 가속도 계수(항력/질량)로 튜닝된 값이다.
    const k = P.arrow.drag * rSpeed
    a.vx -= k * rvx * dt
    a.vy -= k * rvy * dt
    // y가 위쪽 +이므로 중력은 vy를 깎는다
    a.vy -= P.arrow.gravity * dt

    a.x += a.vx * dt
    a.y += a.vy * dt
    a.age += dt

    // 화살촉은 속도 방향으로 서서히 눕는다. 각도를 그냥 damp하면 ±PI 경계에서 한 바퀴 돌아버리므로
    // 최단 경로로 펼친 현재각을 만들어 damp한 뒤 다시 정규화한다.
    const aim = Math.atan2(a.vy, a.vx)
    a.angle = normAngle(damp(aim + angleDelta(aim, a.angle), aim, P.arrow.alignRate, dt))

    // 지면(y=0)을 뚫었으면 판정 선분을 착지점까지로 잘라둔다.
    // 잘라야 지면 아래에 있는 과녁을 "맞혔다"고 오판하지 않는다.
    let landed = false
    if (a.y <= 0) {
      landed = true
      const drop = a.py - a.y
      const t = drop > 0 ? clamp01(a.py / drop) : 0
      a.x = a.px + (a.x - a.px) * t
      a.y = a.py + (a.y - a.py) * t
    }

    resolveCollisions(w, a)

    if (a.alive && (landed || a.age > P.arrow.maxFlightTime)) {
      // 관통 화살은 과녁을 꿰뚫고도 계속 날아가 결국 착지한다. 여기서 miss를 뱉으면
      // world.ts가 연쇄를 끊어, 셋을 꿰뚫은 최고의 한 발이 스스로 콤보를 0으로 만든다.
      // world.ts:295 주석대로 "명중 **없이** 소멸한 화살"만 끊는다.
      const scored = a.pierced > 0
      a.outcome = scored ? 'hit' : landed ? 'miss' : 'expired'
      a.alive = false
      if (!scored) w.events.push({ t: 'miss', x: a.x, y: a.y })
    }

    pushTrail(a, dt)
  }
}

/**
 * 이번 스텝의 궤적 선분과 과녁 원의 교차를 **선분 진행 순서대로** 처리한다.
 * 순서가 중요한 이유: 관통 화살이 한 스텝에 과녁 두 개를 지날 때
 * 뒤쪽 과녁을 먼저 처리하면 콤보 배수와 속도 감쇠가 뒤집힌다.
 */
function resolveCollisions(w: World, a: Arrow): void {
  const targets = w.targets
  // 이미 지나온 구간. 같은 과녁을 두 번 잡지 않기 위한 진행 커서.
  let fromT = 0

  for (let pass = 0; pass < targets.length; pass++) {
    let bestJ = -1
    let bestT = 1
    for (let j = 0; j < targets.length; j++) {
      const tg = targets[j]
      if (tg === undefined || !tg.alive) continue
      const reach = tg.r * tg.r
      if (distSqPointSegment(tg.x, tg.y, a.px, a.py, a.x, a.y) > reach) continue
      const t = segParam(tg.x, tg.y, a.px, a.py, a.x, a.y)
      if (t < fromT) continue
      if (bestJ < 0 || t < bestT) {
        bestT = t
        bestJ = j
      }
    }
    if (bestJ < 0) break
    const tg = targets[bestJ]
    if (tg === undefined) break

    fromT = bestT
    resolveHit(w, a, tg)
    // 관통이 아니면 화살은 여기서 멈춘다
    if (!a.alive) break
  }
}

/**
 * 선분 위 최근접점의 매개변수 0..1. distSqPointSegment는 거리만 주므로
 * "어느 과녁을 먼저 지나는가"를 알려면 이 값이 따로 필요하다.
 */
function segParam(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax
  const dy = by - ay
  const lenSq = dx * dx + dy * dy
  // 길이 0인 선분이면 0으로 나눠 NaN이 난다. 시작점으로 폴백.
  return lenSq > 0 ? clamp01(((px - ax) * dx + (py - ay) * dy) / lenSq) : 0
}

// ── 궤적 링버퍼 ──
// trailHead는 "다음에 쓸 칸". 렌더는 trailHead 직전 칸을 가장 최신 점으로 읽는다.
// 표본은 TRAIL_STRIDE 스텝마다 하나만 굳히고, 머리 칸은 매 스텝 현재 좌표로 덮어쓴다 —
// 그래야 표본 간격을 벌려도 꼬리 끝이 화살에서 떨어지지 않는다. 렌더만 읽는다.

function writeTrail(a: Arrow, slot: number): void {
  const i = slot * 2
  if (i + 1 < a.trail.length) {
    a.trail[i] = a.x
    a.trail[i + 1] = a.y
  }
}

/** 현재 좌표로 새 칸을 연다(= 직전 머리 칸을 표본으로 확정한다). */
function openTrailSlot(a: Arrow): void {
  writeTrail(a, a.trailHead)
  a.trailHead = (a.trailHead + 1) % TRAIL_POINTS
  if (a.trailLen < TRAIL_POINTS) a.trailLen++
}

function pushTrail(a: Arrow, dt: number): void {
  const steps = dt > 0 ? Math.round(a.age / dt) : 0
  if (steps % TRAIL_STRIDE === 0) openTrailSlot(a)
  writeTrail(a, (a.trailHead + TRAIL_POINTS - 1) % TRAIL_POINTS)
}
