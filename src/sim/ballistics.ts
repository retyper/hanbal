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

  const a = freeSlot(w)
  if (a === null) return null

  const d = effectiveStats(w.stats)
  const pw = clamp01(power)
  // drawCurve > 1 이라 만작 근처에서 속도가 급격히 붙는다. 실제 활의 장력 곡선이 이렇다.
  // 화살 종류의 초속 배수(무거운 살 0.72)는 여기서 한 번만 곱한다.
  // 활의 초속 배수도 여기서 한 번만 (docs/BOWS.md — 각궁 +8% · 장궁 +15% · 리커브 -8%).
  const speed =
    lerp(P.bow.minSpeed, P.bow.maxSpeed, Math.pow(pw, P.bow.drawCurve))
      * d.speedMul * w.fx.speedMul * w.bow.speedMul

  launch(a, w.archer.x, w.archer.y, angle, speed, pw, 0)

  w.arrowsLeft--
  return a
}

/**
 * 풀에서 죽은 슬롯 하나. 없으면 null — 새 객체를 만들지 않는다 (A5).
 *
 * `except`는 **방금 죽은 부모**를 배제하기 위한 것이다. 명중으로 죽은 화살은 그 순간
 * 풀에서 가장 앞선 빈 슬롯이 되곤 해서, 아무 조건 없이 고르면 자식이 부모의 시체를 덮어쓴다.
 * 그러면 두 가지가 한꺼번에 깨진다:
 *   (1) 부모의 궤적이 그 프레임에 통째로 사라진다 — render/effects.ts 의 captureTrail 은
 *       outcome==='hit' 인 시체를 찾아 링버퍼를 복사하는데, 그 시체가 이미 자식이다.
 *   (2) launch()가 슬롯의 pendX/pendY 를 0으로 지우므로 **두 번째 자식부터 월드 원점(0,0)**
 *       에서 태어난다. 원점은 궁수 발치라, 화면에는 "갈래 화살이 갑자기 손에서 나가는" 것으로
 *       보인다. 첫 자식만 제자리에서 갈라지고 나머지는 손에서 나가는 그 버그의 정체다.
 */
function freeSlot(w: World, except?: Arrow): Arrow | null {
  const pool = w.arrows
  for (let i = 0; i < pool.length; i++) {
    const slot = pool[i]
    if (slot !== undefined && !slot.alive && slot !== except) return slot
  }
  return null
}

/** 슬롯 하나를 발사 상태로 세운다. 발사·분열이 같은 초기화를 쓰게 한 곳에 모은다. */
function launch(
  a: Arrow, x: number, y: number, angle: number, speed: number, power: number, splitDepth: number,
): void {
  a.alive = true
  a.x = x
  a.y = y
  a.px = x
  a.py = y
  a.vx = Math.cos(angle) * speed
  a.vy = Math.sin(angle) * speed
  a.angle = normAngle(angle)
  a.age = 0
  a.pierced = 0
  a.struck = 0
  a.kindPierced = 0
  a.bounces = 0
  a.splitDepth = splitDepth
  a.splitPending = 0
  a.chainPending = 0
  a.pendX = 0
  a.pendY = 0
  a.outcome = 'flying'
  a.power = power
  a.trailLen = 0
  a.trailHead = 0
  // 첫 표본(발사점)과 머리 칸을 함께 연다. 머리 칸이 없으면 첫 스텝의 덮어쓰기가 발사점을 지운다.
  openTrailSlot(a)
  openTrailSlot(a)
}

export function stepArrows(w: World): void {
  const dt = w.dt
  const pool = w.arrows

  for (let i = 0; i < pool.length; i++) {
    const a = pool[i]
    if (a === undefined || !a.alive) continue

    a.px = a.x
    a.py = a.y

    // 유도는 적분 **전에** 건다. 이번 스텝의 궤적 선분이 이미 휘어 있어야
    // 명중 판정과 화면에 그려지는 선이 어긋나지 않는다.
    steerHoming(w, a)

    // 바람은 화살을 미는 힘이 아니라 **공기의 속도**다.
    // vx에 바람을 더하면 에너지를 주입하게 되고 "발사 후 운동에너지는 증가하지 않는다"가 깨진다.
    // 상대속도에 대한 항력으로만 작용시키면 화살은 공기 속도에 점근할 뿐 그 이상 빨라지지 않는다.
    // w.wind 에는 world.ts 가 이미 P.wind.effect 를 곱해 두었다. 여기서 또 곱하면 이중 적용이다.
    // 활의 바람 배수 — 장궁의 무거운 화살은 같은 공기를 덜 탄다. 화살 쪽 감쇠(fx.dragMul)와
    // 채널이 다르다: 이건 바람(공기 속도)의 체감, 저건 전체 항력의 체감이다.
    const rvx = a.vx - w.wind * w.bow.windMul
    const rvy = a.vy
    const rSpeed = Math.sqrt(rvx * rvx + rvy * rvy)
    // 항력은 속도 제곱에 비례하고 방향은 상대속도 반대 → 성분별로 k * |v| * v_i.
    // 질량으로 나누지 않는다. P.arrow.drag 자체가 가속도 계수(항력/질량)로 튜닝된 값이다.
    // 무거운 살은 같은 공기에 덜 밀린다 (fx.dragMul).
    const k = P.arrow.drag * w.fx.dragMul * rSpeed
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

    // 충돌이 방향·속도를 바꾸기 전의 값. 분열 자식과 사슬의 도약이 이걸 물려받는다.
    const preAng = Math.atan2(a.vy, a.vx)
    const preSpeed = Math.sqrt(a.vx * a.vx + a.vy * a.vy)

    resolveCollisions(w, a)

    if (a.splitPending > 0) {
      a.splitPending = 0
      spawnSplit(w, a, preAng, preSpeed)
    }
    // 사슬로 되살아났으면 이번 스텝의 착지는 없던 일이다 — 화살은 과녁 자리로 옮겨갔다.
    if (a.chainPending > 0) {
      a.chainPending = 0
      if (bounceChain(w, a, preSpeed)) landed = false
    }

    if (a.alive && (landed || a.age > P.arrow.maxFlightTime)) {
      // 관통 화살은 과녁을 꿰뚫고도 계속 날아가 결국 착지한다. 여기서 miss를 뱉으면
      // world.ts가 연쇄를 끊어, 셋을 꿰뚫은 최고의 한 발이 스스로 콤보를 0으로 만든다.
      // "명중 **없이** 소멸한 화살"만 끊는다.
      //
      // 분열 자식(splitDepth > 0)도 같은 이유로 끊지 않는다. 자식은 지급된 화살이 아니라
      // 그 한 발의 **결과물**이다. 자식의 착지를 miss로 뱉으면 (1) 부모가 만든 연쇄를 자식이
      // 스스로 끊고 (2) loop의 misses 가 분모(쏜 발)보다 커져 분열 살로는 무손실 ★★★이
      // 구조적으로 불가능해진다. outcome도 'miss'가 아니라 'expired'로 둬야
      // 회색 유령 궤적·흙소리까지 같이 빠진다.
      const scored = a.struck > 0
      const own = a.splitDepth <= 0
      a.outcome = scored ? 'hit' : own && landed ? 'miss' : 'expired'
      a.alive = false
      if (!scored && own) w.events.push({ t: 'miss', x: a.x, y: a.y, arrow: a.id })
    }

    pushTrail(a, dt)
  }
}

// ───────────────────────── 화살 종류의 효과 ─────────────────────────
//
// 셋 다 난수를 쓰지 않는다. 분열 각도도 유도 판정도 전부 결정론적 계산이다 (A1) —
// 여기에 w.rng를 한 번이라도 물리면 화살 종류에 따라 릴리즈 산포의 난수 스트림이 밀려
// "같은 시드 = 같은 판"이 화살마다 다른 뜻이 된다.

/**
 * 유도 살 — 앞쪽 가장 가까운 과녁으로 **살짝** 휜다.
 *
 * ★ 이 함수가 "쏘는 대로 맞는다"는 계약의 반대편에 서 있다. 그래서 빗장이 셋이다:
 *   1. homingDelay 전에는 아무 일도 없다 — 발사 직후부터 휘면 조준이 아니라 클릭이 된다.
 *   2. homingCone 밖(이미 지나친 과녁)은 없는 셈 친다 — 되돌아가는 궤적은 읽히지 않는다.
 *   3. 선회는 초당 homingTurn rad로 제한된다 — 빗나갈 뻔한 걸 살리는 크기지 조준을 대신하지 않는다.
 *
 * 속도의 **방향만** 돌린다. 크기를 건드리면 "발사 후 역학적 에너지는 증가하지 않는다"가 깨진다.
 */
function steerHoming(w: World, a: Arrow): void {
  const fx = w.fx
  if (fx.homingTurn <= 0 || a.age < fx.homingDelay) return

  const speed = Math.sqrt(a.vx * a.vx + a.vy * a.vy)
  if (speed <= 0) return
  const dirX = a.vx / speed
  const dirY = a.vy / speed
  const cosCone = Math.cos(fx.homingCone)

  const targets = w.targets
  let bestD2 = fx.homingRange * fx.homingRange
  let bestX = 0
  let bestY = 0
  let found = false
  for (let j = 0; j < targets.length; j++) {
    const t = targets[j]
    // 이미 떨어지는 중인 과녁은 어차피 죽는다. 그쪽으로 끌려가면 화살을 버리게 된다.
    if (t === undefined || !t.alive || t.falling) continue
    const dx = t.x - a.x
    const dy = t.y - a.y
    const d2 = dx * dx + dy * dy
    if (d2 > bestD2 || d2 <= 0) continue
    const d = Math.sqrt(d2)
    if ((dx * dirX + dy * dirY) / d < cosCone) continue
    bestD2 = d2
    bestX = t.x
    bestY = t.y
    found = true
  }
  if (!found) return

  const cur = Math.atan2(a.vy, a.vx)
  const want = Math.atan2(bestY - a.y, bestX - a.x)
  const maxTurn = fx.homingTurn * w.dt
  let d = angleDelta(cur, want)
  if (d > maxTurn) d = maxTurn
  else if (d < -maxTurn) d = -maxTurn
  const na = cur + d
  a.vx = Math.cos(na) * speed
  a.vy = Math.sin(na) * speed
}

/**
 * 분열 살 — 명중 자리에서 자식 화살이 좌우로 갈라진다.
 *
 * **w.arrowsLeft 를 건드리지도 검사하지도 않는다.** 자식은 지급된 화살이 아니라 그 한 발의
 * 결과물이다. 여기서 잔량을 보면 마지막 발이 갈라지지 못한다.
 * 풀이 꽉 차 슬롯이 없으면 그만큼 덜 갈라진다 — 판이 죽는 것보다 낫다 (A5, 할당 0).
 */
function spawnSplit(w: World, parent: Arrow, angle: number, speed: number): void {
  const fx = w.fx
  const n = Math.floor(fx.splitCount)
  if (n <= 0 || speed <= 0) return
  const childSpeed = speed * fx.splitSpeedKeep

  // ★ 부모에게서 읽을 값은 **루프에 들어가기 전에 전부 복사한다.**
  // launch()는 슬롯의 pendX/pendY·power·splitDepth 를 초기화한다. 루프 안에서 부모를 계속
  // 참조하면, 자식이 어떤 이유로든 부모와 같은 슬롯에 앉는 순간 두 번째 자식이 태어날 자리는
  // 이미 0으로 지워진 뒤다. freeSlot 의 except 로도 막지만, 값을 먼저 떠 두면 이 함수가
  // 슬롯 배정 방식과 무관하게 옳다 — 빗장은 둘이어야 다음 사람이 하나를 풀어도 안 깨진다.
  const ox = parent.pendX
  const oy = parent.pendY
  const power = parent.power
  const depth = parent.splitDepth + 1

  for (let i = 0; i < n; i++) {
    const child = freeSlot(w, parent)
    if (child === null) return
    // ±로 대칭 배분. n=2 면 ±splitAngle, n=3 이면 -a, 0, +a.
    const t = n > 1 ? (i / (n - 1)) * 2 - 1 : 0
    launch(child, ox, oy, angle + fx.splitAngle * t, childSpeed, power, depth)
  }
}

/**
 * 사슬 살 — 맞은 과녁에서 다음 과녁으로 튄다.
 *
 * 죽은 화살을 되살리는 유일한 경로다. 방향을 바꾸는 일이라 충돌 순회(같은 선분) 안에서는
 * 할 수 없어 target.ts가 플래그로 넘긴 것을 여기서 소비한다.
 *
 * @returns 실제로 튀었는가
 */
function bounceChain(w: World, a: Arrow, speed: number): boolean {
  const fx = w.fx
  if (fx.chainBounces <= 0 || speed <= 0) return false

  const targets = w.targets
  let bestD2 = fx.chainRange * fx.chainRange
  let bestX = 0
  let bestY = 0
  let found = false
  for (let j = 0; j < targets.length; j++) {
    const t = targets[j]
    // 방금 맞은 과녁은 이미 죽었거나 낙하 중이라 여기서 자동으로 빠진다.
    if (t === undefined || !t.alive || t.falling) continue
    const dx = t.x - a.pendX
    const dy = t.y - a.pendY
    const d2 = dx * dx + dy * dy
    if (d2 > bestD2 || d2 <= 0) continue
    bestD2 = d2
    bestX = t.x
    bestY = t.y
    found = true
  }
  if (!found) return false

  a.bounces++
  const ang = Math.atan2(bestY - a.pendY, bestX - a.pendX)
  const next = speed * fx.chainSpeedKeep
  // 궤적은 이어서 그린다 — 꺾인 선 하나가 "튀었다"를 그대로 보여준다. trail은 손대지 않는다.
  a.alive = true
  a.outcome = 'flying'
  a.x = a.pendX
  a.y = a.pendY
  a.px = a.x
  a.py = a.y
  a.vx = Math.cos(ang) * next
  a.vy = Math.sin(ang) * next
  return true
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
  // 직전 pass에서 맞힌 과녁. fromT 커서만으로는 t === fromT 인 자기 자신을 다시 뽑는다.
  let lastJ = -1

  for (let pass = 0; pass < targets.length; pass++) {
    let bestJ = -1
    let bestT = 1
    for (let j = 0; j < targets.length; j++) {
      const tg = targets[j]
      if (tg === undefined || !tg.alive) continue
      // 낙하 중인 공중 과녁은 이미 맞은 과녁이다. alive를 유지한 채 떨어질 뿐이라
      // 여기서 걸러내지 않으면 관통·무거운·사슬 살이 같은 과녁을 한 스텝에 두세 번 때린다.
      // 같은 파일의 steerHoming·bounceChain, target.ts의 burst·sweepChain 과 규칙을 맞춘다.
      if (tg.falling) continue
      if (j === lastJ) continue
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
    lastJ = bestJ
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
