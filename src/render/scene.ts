/**
 * 장면 조립 — 배경 → 지면 → 과녁 → 궤적 → 화살 → 궁수 → 이펙트 → HUD.
 *
 * ARCHITECTURE A1: World는 읽기만 한다. events도 읽되 비우지 않는다 (게임 루프가 소비).
 * A5: save/restore 남발 금지, shadowBlur·filter 금지, 프레임당 힙 할당 0.
 */
import { lerp, valueNoise } from '../core/math.ts'
import { TRAIL_POINTS } from '../sim/types.ts'
import type { World } from '../sim/types.ts'
import {
  THEME, createCamera, resizeCamera, updateCamera, worldToScreenX, worldToScreenY, screenToWorldX,
} from './camera.ts'
import type { Camera } from './camera.ts'
import { drawArcher } from './stickman.ts'
import { createFx, pumpEvents, updateFx, drawFx, hitStopMs } from './effects.ts'
import type { Fx } from './effects.ts'
import { drawHud } from './hud.ts'

/**
 * 능선 높이 테이블. valueNoise는 호출마다 클로저를 만들어서(core/math.ts) 매 프레임 90번 부르면
 * 프레임당 힙 할당 0이 깨진다 (A5). 생성 시 한 번만 굽고, 그릴 땐 인덱싱+보간만 한다.
 */
const RIDGE_N = 160
const RIDGE_X0 = -10
const RIDGE_X1 = 40
const RIDGE_STEP = (RIDGE_X1 - RIDGE_X0) / (RIDGE_N - 1)

/** 배경 실루엣 2겹 (GDD 8장 — 색 수를 극도로 제한) */
const BG = {
  segments: 44,
  farBase: 6.4,
  farAmp: 2.1,
  farFreq: 0.055,
  farParallax: 0.35,
  nearBase: 3.4,
  nearAmp: 1.3,
  nearFreq: 0.11,
  nearParallax: 0.62,
  groundLineW: 1.5,
} as const

const DRAW = {
  arrowLen: 0.72,
  arrowHead: 0.16,
  arrowWidthPx: 2,
  trailWidthPx: 1.7,
  targetRingInner: 0.55,
  targetCore: 0.2,
  targetLineW: 2,
  aerialStem: 0.35,
} as const

export interface Renderer {
  resize(): void
  draw(w: World, alpha: number, dtReal: number): void
  dispose(): void
}

interface RendererX extends Renderer {
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
  cam: Camera
  fx: Fx
  far: Float32Array
  near: Float32Array
  grad: CanvasGradient | null
  gradH: number
  dead: boolean
}

function bakeRidge(base: number, amp: number, freq: number, seed: number): Float32Array {
  const tab = new Float32Array(RIDGE_N)
  for (let i = 0; i < RIDGE_N; i++) {
    tab[i] = base + valueNoise((RIDGE_X0 + i * RIDGE_STEP) * freq, seed) * amp
  }
  return tab
}

function drawRidge(
  ctx: CanvasRenderingContext2D, cam: Camera,
  tab: Float32Array, parallax: number, color: string,
): void {
  const step = cam.w / BG.segments
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(0, cam.h)
  for (let i = 0; i <= BG.segments; i++) {
    const sx = i * step
    // 원경일수록 월드 좌표를 덜 반영해 느리게 흐른다
    const u = (screenToWorldX(cam, sx) * parallax - RIDGE_X0) / RIDGE_STEP
    const j = u < 0 ? 0 : u > RIDGE_N - 2 ? RIDGE_N - 2 : u | 0
    const f = u - j < 0 ? 0 : u - j > 1 ? 1 : u - j
    const h = lerp(tab[j] ?? 0, tab[j + 1] ?? 0, f)
    ctx.lineTo(sx, worldToScreenY(cam, h))
  }
  ctx.lineTo(cam.w, cam.h)
  ctx.closePath()
  ctx.fill()
}

function drawTargets(ctx: CanvasRenderingContext2D, cam: Camera, w: World, alpha: number): void {
  ctx.lineWidth = DRAW.targetLineW
  for (let i = 0; i < w.targets.length; i++) {
    const t = w.targets[i]
    if (t === undefined || !t.alive) continue
    const x = worldToScreenX(cam, lerp(t.px, t.x, alpha))
    const y = worldToScreenY(cam, lerp(t.py, t.y, alpha))
    const r = t.r * cam.scale
    if (r < 0.5) continue

    if (t.kind === 'aerial') {
      // 매달린 등불 — 맞으면 낙하하며 아래를 연쇄로 친다
      ctx.strokeStyle = THEME.accentDim
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(x, y - r)
      ctx.lineTo(x, y - r - DRAW.aerialStem * cam.scale)
      ctx.stroke()
      ctx.lineWidth = DRAW.targetLineW
    }

    ctx.strokeStyle = t.falling ? THEME.accentDim : THEME.accent
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.stroke()

    ctx.strokeStyle = THEME.accentDim
    ctx.beginPath()
    ctx.arc(x, y, r * DRAW.targetRingInner, 0, Math.PI * 2)
    ctx.stroke()

    ctx.fillStyle = THEME.target2
    const c = r * DRAW.targetCore
    ctx.fillRect(x - c, y - c, c * 2, c * 2)
  }
}

function drawTrails(ctx: CanvasRenderingContext2D, cam: Camera, w: World): void {
  ctx.lineWidth = DRAW.trailWidthPx
  ctx.lineCap = 'round'
  ctx.strokeStyle = THEME.trailHit
  for (let i = 0; i < w.arrows.length; i++) {
    const ar = w.arrows[i]
    if (ar === undefined || !ar.alive) continue
    const n = ar.trailLen < TRAIL_POINTS ? ar.trailLen : TRAIL_POINTS
    if (n < 2) continue
    // 오래된 점일수록 옅게. 링버퍼를 뒤에서부터 되짚는다.
    for (let j = 1; j < n; j++) {
      const i0 = ((ar.trailHead - n + j - 1) % TRAIL_POINTS + TRAIL_POINTS) % TRAIL_POINTS
      const i1 = ((ar.trailHead - n + j) % TRAIL_POINTS + TRAIL_POINTS) % TRAIL_POINTS
      ctx.globalAlpha = (j / n) * 0.7
      ctx.beginPath()
      ctx.moveTo(
        worldToScreenX(cam, ar.trail[i0 * 2] ?? 0),
        worldToScreenY(cam, ar.trail[i0 * 2 + 1] ?? 0),
      )
      ctx.lineTo(
        worldToScreenX(cam, ar.trail[i1 * 2] ?? 0),
        worldToScreenY(cam, ar.trail[i1 * 2 + 1] ?? 0),
      )
      ctx.stroke()
    }
  }
  ctx.globalAlpha = 1
}

function drawArrows(ctx: CanvasRenderingContext2D, cam: Camera, w: World, alpha: number): void {
  ctx.strokeStyle = THEME.arrow
  ctx.lineWidth = DRAW.arrowWidthPx
  ctx.lineCap = 'round'
  for (let i = 0; i < w.arrows.length; i++) {
    const ar = w.arrows[i]
    if (ar === undefined || !ar.alive) continue
    const wx = lerp(ar.px, ar.x, alpha)
    const wy = lerp(ar.py, ar.y, alpha)
    const ux = Math.cos(ar.angle)
    const uy = Math.sin(ar.angle)
    const tipX = worldToScreenX(cam, wx)
    const tipY = worldToScreenY(cam, wy)
    const tailX = worldToScreenX(cam, wx - ux * DRAW.arrowLen)
    const tailY = worldToScreenY(cam, wy - uy * DRAW.arrowLen)
    ctx.beginPath()
    ctx.moveTo(tailX, tailY)
    ctx.lineTo(tipX, tipY)
    ctx.stroke()
  }
}

export function createRenderer(canvas: HTMLCanvasElement): Renderer {
  const ctx = canvas.getContext('2d', { alpha: false })
  if (ctx === null) throw new Error('Canvas2D 컨텍스트를 얻지 못했다')

  const r: RendererX = {
    canvas,
    ctx,
    cam: createCamera(),
    fx: createFx(),
    far: bakeRidge(BG.farBase, BG.farAmp, BG.farFreq, 11),
    near: bakeRidge(BG.nearBase, BG.nearAmp, BG.nearFreq, 23),
    grad: null,
    gradH: -1,
    dead: false,

    resize(): void {
      resizeCamera(r.cam, r.canvas)
      // 그라디언트 객체는 크기가 바뀔 때만 다시 만든다 (프레임당 할당 0)
      r.grad = null
      r.gradH = -1
    },

    draw(w: World, alpha: number, dtReal: number): void {
      if (r.dead) return
      const cam = r.cam
      const c = r.ctx
      // dpr 스케일을 여기서 한 번만 건다. 이후 모든 좌표는 CSS 픽셀이다.
      c.setTransform(cam.dpr, 0, 0, cam.dpr, 0, 0)

      // 갱신 → 수집 순서. 반대로 하면 이번 프레임에 쌓인 히트스톱이 같은 프레임에 한 번 깎이고,
      // 새로 태어난 파티클이 수명을 한 프레임 잃는다.
      updateFx(r.fx, dtReal)
      pumpEvents(r.fx, w)
      updateCamera(cam, w, dtReal)

      if (r.grad === null || r.gradH !== cam.h) {
        const g = c.createLinearGradient(0, 0, 0, cam.h)
        g.addColorStop(0, THEME.sky0)
        g.addColorStop(1, THEME.sky1)
        r.grad = g
        r.gradH = cam.h
      }
      c.fillStyle = r.grad
      c.fillRect(0, 0, cam.w, cam.h)

      drawRidge(c, cam, r.far, BG.farParallax, THEME.ridgeFar)
      drawRidge(c, cam, r.near, BG.nearParallax, THEME.ridgeNear)

      const groundY = worldToScreenY(cam, 0)
      c.fillStyle = THEME.ground
      c.fillRect(0, groundY, cam.w, cam.h - groundY)
      c.strokeStyle = THEME.groundLine
      c.lineWidth = BG.groundLineW
      c.beginPath()
      c.moveTo(0, groundY)
      c.lineTo(cam.w, groundY)
      c.stroke()

      drawTargets(c, cam, w, alpha)
      drawTrails(c, cam, w)
      drawArrows(c, cam, w, alpha)
      drawArcher(c, cam, w, alpha)
      drawFx(c, cam, r.fx)
      drawHud(c, cam, w)
    },

    dispose(): void {
      r.dead = true
      r.grad = null
    },
  }

  r.resize()
  return r
}

export function getCamera(r: Renderer): Camera {
  return (r as RendererX).cam
}

/** 게임 루프가 히트스톱을 읽는 통로. Fx 인스턴스를 밖으로 노출하지 않기 위함. */
export function getHitStopMs(r: Renderer): number {
  return hitStopMs((r as RendererX).fx)
}
