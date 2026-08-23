/**
 * 스틱맨 궁수 (GDD 8장) — 벡터 라인, 관절 5개(어깨/팔꿈치/손목/골반/무릎).
 *
 * 이 파일의 핵심 책임은 "떨림을 읽을 수 있게 그리는 것"이다.
 * 조준 떨림은 실제로는 0.004 rad 수준이라 화면에서 0.2px도 안 움직인다.
 * 그래서 회전 중심을 어깨에 두고, P.tremor.minVisiblePx를 기준으로 표시 배율을 역산해
 * 활 끝의 흔들림이 항상 최소 가시 진폭 이상 나오게 한다. 위상은 그대로 보존된다.
 *
 * ARCHITECTURE A1: World는 읽기만 한다.
 */
import { clamp, clamp01 } from '../core/math.ts'
import { P } from '../tune/params.ts'
import type { World } from '../sim/types.ts'
import { THEME, worldToScreenX, worldToScreenY } from './camera.ts'
import type { Camera } from './camera.ts'

/** 체격 (m). 화면 픽셀이 아니라 월드 치수라 카메라 줌을 그대로 따라간다. */
const BODY = {
  arm: 0.62,
  armBend: 0.05,
  torso: 0.5,
  neck: 0.1,
  head: 0.115,
  hip: 0.06,
  stance: 0.26,
  kneeOut: 0.09,
  legMin: 0.35,
  legMax: 1.1,
  bowHalf: 0.46,
  bowCurve: 0.15,
  bowDrawCurve: 0.5,
  restDraw: 0.09,
  arrowLen: 0.72,
  drawElbow: 0.17,
} as const

/** 어깨(회전 중심)에서 활 끝까지의 반지름. 떨림 지렛대의 실제 길이다. */
const TREMOR_LEVER = Math.hypot(BODY.arm, BODY.bowHalf)

/**
 * 표시용 떨림 상한 (rad, 약 15°). 이보다 크게 흔들면 팔이 만화처럼 돌아간다.
 * 기본 진폭이 2.5px일 때 최대 진폭이 10~20px가 되도록 잡은 값.
 */
const VIS_TREMOR_MAX = 0.26
/** 붕괴 경고에서 떨림이 추가로 커지는 비율 — "예고 없는 붕괴" 방지 (GDD 2장) */
const WARN_TREMOR_BOOST = 0.85
/** 붕괴 경고에서 앞팔이 처지는 각 (rad) */
const WARN_DROOP = 0.11
/** 만작 시 선 굵기 배수 — 등근육 긴장 */
const FULL_WIDTH_MUL = 1.35

/** 경고색 램프. 매 프레임 색 문자열을 만들면 힙 할당이 생긴다 (A5). 미리 만들어 인덱싱한다. */
const BOW_RAMP = ['#d9cba6', '#e0bd8d', '#e8a874', '#ef8f5d', '#f57a4f', '#ff6a45'] as const
const BODY_RAMP = ['#c9d2dc', '#ccc9cf', '#d0bfbd', '#d5b3aa', '#dba798', '#e29a86'] as const

/** 관절 좌표 캐시 (월드 m). 프레임마다 새 객체를 만들지 않기 위한 단일 인스턴스. */
const rig = {
  ax: 0, ay: 0,
  ux: 1, uy: 0,
  vx: 0, vy: 1,
  hx: 0, hy: 0,
  nockX: 0, nockY: 0,
  warn: 0,
  full: 0,
}

/**
 * 표시용 떨림 각. 실제 발사각(aimAngle + tremorOffset)은 건드리지 않는다 —
 * 여기서 키우는 건 "보이는 팔"뿐이고, 부호와 위상은 원본 그대로라
 * "흔들림이 중앙을 지날 때 놓기"라는 읽기가 성립한다 (GDD 2장).
 */
function visualTremor(cam: Camera, offset: number, warn: number): number {
  const rawPx = P.tremor.baseAmp * TREMOR_LEVER * cam.scale
  const gain = rawPx > 1e-6 ? P.tremor.minVisiblePx / rawPx : 1
  const boosted = offset * gain * (1 + warn * WARN_TREMOR_BOOST)
  // tanh 소프트 클램프 — 단조증가라 위상이 보존되고, 기본 진폭 부근에서는 거의 선형이다.
  return VIS_TREMOR_MAX * Math.tanh(boosted / VIS_TREMOR_MAX)
}

function computeRig(cam: Camera, w: World): void {
  const a = w.archer
  const warn = clamp01(a.warn)
  // 어깨 = sim이 주는 궁수 좌표. 만작 시 노크(화살 꽁무니)가 여기 오므로 화살 생성점과 정확히 맞는다.
  rig.ax = a.x
  rig.ay = a.y
  rig.warn = warn
  rig.full = a.phase === 'full' || a.phase === 'collapsing' ? 1 : 0

  const dir = a.aimAngle + visualTremor(cam, a.tremorOffset, warn) - warn * WARN_DROOP
  const ux = Math.cos(dir)
  const uy = Math.sin(dir)
  rig.ux = ux
  rig.uy = uy
  rig.vx = -uy
  rig.vy = ux

  rig.hx = a.x + ux * BODY.arm
  rig.hy = a.y + uy * BODY.arm

  const pull = BODY.restDraw + (BODY.arm - BODY.restDraw) * clamp01(a.draw)
  rig.nockX = rig.hx - ux * pull
  rig.nockY = rig.hy - uy * pull
}

/** 활 손 화면 좌표 — HUD가 스태미나 게이지를 활 옆에 붙이는 데 쓴다. */
export function bowHandScreenX(cam: Camera, w: World): number {
  computeRig(cam, w)
  return worldToScreenX(cam, rig.hx)
}

export function bowHandScreenY(cam: Camera, w: World): number {
  computeRig(cam, w)
  return worldToScreenY(cam, rig.hy)
}

function line(
  ctx: CanvasRenderingContext2D, cam: Camera,
  x0: number, y0: number, x1: number, y1: number,
): void {
  ctx.beginPath()
  ctx.moveTo(worldToScreenX(cam, x0), worldToScreenY(cam, y0))
  ctx.lineTo(worldToScreenX(cam, x1), worldToScreenY(cam, y1))
  ctx.stroke()
}

/** 팔·다리는 관절 하나짜리 꺾인 선. bend는 진행방향 왼쪽(+) 기준 오프셋(m). */
function limb(
  ctx: CanvasRenderingContext2D, cam: Camera,
  x0: number, y0: number, x1: number, y1: number, bend: number,
): void {
  const dx = x1 - x0
  const dy = y1 - y0
  const len = Math.hypot(dx, dy)
  const inv = len > 1e-5 ? 1 / len : 0
  const jx = (x0 + x1) * 0.5 - dy * inv * bend
  const jy = (y0 + y1) * 0.5 + dx * inv * bend
  ctx.beginPath()
  ctx.moveTo(worldToScreenX(cam, x0), worldToScreenY(cam, y0))
  ctx.lineTo(worldToScreenX(cam, jx), worldToScreenY(cam, jy))
  ctx.lineTo(worldToScreenX(cam, x1), worldToScreenY(cam, y1))
  ctx.stroke()
}

export function drawArcher(
  ctx: CanvasRenderingContext2D, cam: Camera, w: World, _alpha: number,
): void {
  // 궁수는 고정 위치라 보간할 이전 상태가 없다(ArcherState에 px/py가 없다). _alpha는 쓰지 않는다.
  computeRig(cam, w)
  const a = w.archer
  const warn = rig.warn
  const ramp = (warn * 5 + 0.5) | 0

  const lw = clamp(cam.scale * 0.05, 1.6, 5.5)
  const bodyW = lw * (1 + rig.full * (FULL_WIDTH_MUL - 1))
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  // ── 몸통·다리·머리 ────────────────────────────────────────────
  const pelvisX = rig.ax - BODY.hip
  const pelvisY = rig.ay - BODY.torso
  const legSpan = clamp(pelvisY, BODY.legMin, BODY.legMax)
  const footY = pelvisY - legSpan

  ctx.strokeStyle = BODY_RAMP[ramp] ?? THEME.body
  ctx.lineWidth = bodyW
  line(ctx, cam, rig.ax, rig.ay, pelvisX, pelvisY)

  ctx.lineWidth = lw
  // 뒷다리 먼저(어둡게) → 원근
  ctx.strokeStyle = THEME.bodyDim
  limb(ctx, cam, pelvisX, pelvisY, pelvisX - BODY.stance, footY, -BODY.kneeOut)
  ctx.strokeStyle = BODY_RAMP[ramp] ?? THEME.body
  limb(ctx, cam, pelvisX, pelvisY, pelvisX + BODY.stance, footY, BODY.kneeOut)

  // 머리 — 시선은 활 쪽
  const headX = rig.ax + rig.ux * BODY.head * 0.6
  const headY = rig.ay + BODY.neck + BODY.head
  line(ctx, cam, rig.ax, rig.ay, headX, rig.ay + BODY.neck)
  ctx.beginPath()
  ctx.arc(
    worldToScreenX(cam, headX), worldToScreenY(cam, headY),
    Math.max(BODY.head * cam.scale, 2), 0, Math.PI * 2,
  )
  ctx.stroke()

  // ── 시위 당기는 팔 (뒤쪽) ─────────────────────────────────────
  ctx.strokeStyle = THEME.bodyDim
  ctx.lineWidth = lw
  limb(ctx, cam, rig.ax, rig.ay, rig.nockX, rig.nockY, -BODY.drawElbow)

  // ── 활 ────────────────────────────────────────────────────────
  // 당길수록 활이 더 휜다. 경고가 오르면 활이 경고색으로 물든다.
  const curve = BODY.bowCurve * (1 + clamp01(a.draw) * BODY.bowDrawCurve)
  const tipAx = rig.hx + rig.vx * BODY.bowHalf
  const tipAy = rig.hy + rig.vy * BODY.bowHalf
  const tipBx = rig.hx - rig.vx * BODY.bowHalf
  const tipBy = rig.hy - rig.vy * BODY.bowHalf
  const ctrlX = rig.hx + rig.ux * curve * 2
  const ctrlY = rig.hy + rig.uy * curve * 2

  ctx.strokeStyle = BOW_RAMP[ramp] ?? THEME.bow
  ctx.lineWidth = bodyW
  ctx.beginPath()
  ctx.moveTo(worldToScreenX(cam, tipAx), worldToScreenY(cam, tipAy))
  ctx.quadraticCurveTo(
    worldToScreenX(cam, ctrlX), worldToScreenY(cam, ctrlY),
    worldToScreenX(cam, tipBx), worldToScreenY(cam, tipBy),
  )
  ctx.stroke()

  // 시위 — 만작이면 팽팽한 삼각형
  ctx.strokeStyle = THEME.string
  ctx.lineWidth = Math.max(lw * 0.4, 1)
  ctx.beginPath()
  ctx.moveTo(worldToScreenX(cam, tipAx), worldToScreenY(cam, tipAy))
  ctx.lineTo(worldToScreenX(cam, rig.nockX), worldToScreenY(cam, rig.nockY))
  ctx.lineTo(worldToScreenX(cam, tipBx), worldToScreenY(cam, tipBy))
  ctx.stroke()

  // ── 앞팔(활 잡은 팔) — 경고 시 아래로 처진 채 그려진다 ──────────
  ctx.strokeStyle = BODY_RAMP[ramp] ?? THEME.body
  ctx.lineWidth = bodyW
  limb(ctx, cam, rig.ax, rig.ay, rig.hx, rig.hy, -BODY.armBend * (1 + warn * 2))

  // ── 물린 화살 ─────────────────────────────────────────────────
  if (a.phase !== 'idle' && a.phase !== 'recovering') {
    ctx.strokeStyle = THEME.arrow
    ctx.lineWidth = Math.max(lw * 0.45, 1)
    line(
      ctx, cam,
      rig.nockX, rig.nockY,
      rig.nockX + rig.ux * BODY.arrowLen, rig.nockY + rig.uy * BODY.arrowLen,
    )
  }
}
