/**
 * 전장 카메라 — 맵은 늘 가로 띠 (u = 가로 · v = 세로). 판 밖이 안 보이게 가운데를 땅 안에 가둔다.
 * 원본: src/raid/camera.ts (clampCenter · followCam · toField · fieldView) 를 복사하고 1120×720 · HAEBI_* 상수 의존을 인자로 바꿨다.
 * 열전 쪽 앞서 보기(lookAhead)·넓은 맵(WideState)은 떼어 냈다. 화면 쪽 기억만 — sim 은 안 읽는다.
 */
import { P } from '../tune/params.ts'

export interface Viewport { w: number; h: number }
export interface Rect { left: number; top: number; right: number; bottom: number }
export interface Cam {
  /** 단계 (0 = 맞춤) */
  level: number
  /** 지금 배율(px/판 px) · 화면 가운데의 판 좌표 */
  zoom: number; x: number; y: number
}

/** 단계 배율 (맞춤 배율에 곱한다) */
export const levelMuls = (): readonly number[] => [1, P.field.zoomMid / 100, P.field.zoomNear / 100]

/** 맞춤 배율: 맵 높이가 화면 높이에 들되, 맵 폭보다 화면이 넓어지지 않게 */
export function fitZoom(vp: Viewport, bounds: Readonly<Rect>): number {
  const bw = bounds.right - bounds.left, bh = bounds.bottom - bounds.top
  return Math.max(vp.h / bh, vp.w / bw)
}
export const levelZoom = (vp: Viewport, bounds: Readonly<Rect>, level: number): number => fitZoom(vp, bounds) * (levelMuls()[level] ?? 1)
export const nextLevel = (level: number): number => (level + 1) % levelMuls().length

export function newCam(vp: Viewport, bounds: Readonly<Rect>, level = 0): Cam {
  const z = levelZoom(vp, bounds, level)
  return { level, zoom: z, x: (bounds.left + bounds.right) / 2, y: (bounds.top + bounds.bottom) / 2 }
}

/** 배율 z 에서 화면 가운데가 갈 수 있는 자리 — 땅 밖이 안 보이게 · 화면이 땅보다 넓은 축은 땅 가운데에 */
export function clampCenter(z: number, x: number, y: number, vp: Viewport, bounds: Readonly<Rect>): { x: number; y: number } {
  const hw = vp.w / (2 * z), hh = vp.h / (2 * z)
  return {
    x: bounds.right - bounds.left <= 2 * hw ? (bounds.left + bounds.right) / 2 : Math.min(bounds.right - hw, Math.max(bounds.left + hw, x)),
    y: bounds.bottom - bounds.top <= 2 * hh ? (bounds.top + bounds.bottom) / 2 : Math.min(bounds.bottom - hh, Math.max(bounds.top + hh, y)),
  }
}

/** (tx, ty) 를 따라간다 — dt 화면 초 · snap 이면 곧바로 */
export function followCam(cam: Cam, tx: number, ty: number, dt: number, vp: Viewport, bounds: Readonly<Rect>, snap = false, zoomTarget?: number): void {
  const zt = zoomTarget ?? levelZoom(vp, bounds, cam.level)
  // 보이는 폭(1/배율)을 늦추고, 자리는 목표 배율에서 가둔다 — 배율이 먼저 당겨 들어가 빈 가운데를 비추지 않게 (42 의 6)
  const zooming = Math.abs(cam.zoom - zt) > 0.02 * zt
  const e = snap ? 0 : Math.exp(-P.field.camEase * dt)
  cam.zoom = 1 / (1 / zt + (1 / cam.zoom - 1 / zt) * e)
  if (Math.abs(cam.zoom - zt) < 1e-3 * zt) cam.zoom = zt
  const want = clampCenter(zt, tx, ty, vp, bounds)
  const k = snap ? 1 : 1 - (zooming ? e : Math.exp(-P.field.camFollowRate * dt))
  const c = clampCenter(cam.zoom, cam.x + (want.x - cam.x) * k, cam.y + (want.y - cam.y) * k, vp, bounds)
  cam.x = c.x; cam.y = c.y
}

/**
 * 점들(판 px) 가운데 가장 빽빽한 한 무더기의 가운데. 점마다 radius 안의 이웃 수를 세어 가장 많은 점(동점은 앞선 것)을 고르고,
 * 그 이웃들의 평균을 돌려준다. 점이 없으면 null. (가까이 보기가 두 싸움 사이 빈 땅을 비추지 않게 · 42 의 4)
 */
export function clusterCenter(xs: readonly number[], ys: readonly number[], radius: number): { x: number; y: number } | null {
  if (xs.length === 0) return null
  const r2 = radius * radius
  let best = 0, bestN = -1
  for (let i = 0; i < xs.length; i++) {
    let n = 0
    for (let j = 0; j < xs.length; j++) { const dx = xs[i]! - xs[j]!, dy = ys[i]! - ys[j]!; if (dx * dx + dy * dy <= r2) n++ }
    if (n > bestN) { bestN = n; best = i }
  }
  let sx = 0, sy = 0, n = 0
  for (let j = 0; j < xs.length; j++) { const dx = xs[best]! - xs[j]!, dy = ys[best]! - ys[j]!; if (dx * dx + dy * dy <= r2) { sx += xs[j]!; sy += ys[j]!; n++ } }
  return { x: sx / n, y: sy / n }
}

/** 화면 좌표(px) → 판 좌표 */
export const toField = (cam: Cam, vp: Viewport, px: number, py: number): { x: number; y: number } =>
  ({ x: cam.x + (px - vp.w / 2) / cam.zoom, y: cam.y + (py - vp.h / 2) / cam.zoom })

/** 판 좌표 → 화면 좌표(px) */
export const toScreen = (cam: Cam, vp: Viewport, x: number, y: number): { x: number; y: number } =>
  ({ x: vp.w / 2 + (x - cam.x) * cam.zoom, y: vp.h / 2 + (y - cam.y) * cam.zoom })

/** 지금 화면이 덮는 판 좌표 */
export const fieldView = (cam: Cam, vp: Viewport): Rect =>
  ({ left: cam.x - vp.w / (2 * cam.zoom), right: cam.x + vp.w / (2 * cam.zoom), top: cam.y - vp.h / (2 * cam.zoom), bottom: cam.y + vp.h / (2 * cam.zoom) })

/** 화면 안(여유 pad 판 px)에 드는가 */
export const inView = (r: Readonly<Rect>, x: number, y: number, pad: number): boolean =>
  x >= r.left - pad && x <= r.right + pad && y >= r.top - pad && y <= r.bottom + pad

/** 판 전체가 한 화면에 드는 배율 (위아래·좌우가 남으면 가운데에 놓인다) */
export const wholeZoom = (vp: Viewport, bounds: Readonly<Rect>): number => Math.min(vp.w / (bounds.right - bounds.left), vp.h / (bounds.bottom - bounds.top))

/**
 * 점들(판 px)을 모두 담는 가운데와 배율. 배율은 맞춤 배율 이상 · 맞춤 × zoomNear 이하로 눌린다. 점이 없으면 null.
 * margin 은 둘레 여유(판 px).
 */
export function frameBox(vp: Viewport, bounds: Readonly<Rect>, xs: readonly number[], ys: readonly number[], margin: number): { x: number; y: number; zoom: number } | null {
  if (xs.length === 0) return null
  let x0 = xs[0]!, x1 = x0, y0 = ys[0]!, y1 = y0
  for (let i = 1; i < xs.length; i++) { const x = xs[i]!, y = ys[i]!; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y }
  const fit = fitZoom(vp, bounds), want = Math.min(vp.w / (x1 - x0 + 2 * margin), vp.h / (y1 - y0 + 2 * margin))
  const zoom = Math.min(fit * (levelMuls()[levelMuls().length - 1] ?? 1), Math.max(fit, want))
  return { x: (x0 + x1) / 2, y: (y0 + y1) / 2, zoom }
}
