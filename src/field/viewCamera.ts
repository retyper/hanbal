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
export function followCam(cam: Cam, tx: number, ty: number, dt: number, vp: Viewport, bounds: Readonly<Rect>, snap = false): void {
  const zt = levelZoom(vp, bounds, cam.level)
  cam.zoom = snap ? zt : zt + (cam.zoom - zt) * Math.exp(-P.field.camEase * dt)
  if (Math.abs(cam.zoom - zt) < 1e-3 * zt) cam.zoom = zt
  const want = clampCenter(cam.zoom, tx, ty, vp, bounds)
  const k = snap ? 1 : 1 - Math.exp(-P.field.camFollowRate * dt)
  const c = clampCenter(cam.zoom, cam.x + (want.x - cam.x) * k, cam.y + (want.y - cam.y) * k, vp, bounds)
  cam.x = c.x; cam.y = c.y
}

/** 화면 좌표(px) → 판 좌표 */
export const toField = (cam: Cam, vp: Viewport, px: number, py: number): { x: number; y: number } =>
  ({ x: cam.x + (px - vp.w / 2) / cam.zoom, y: cam.y + (py - vp.h / 2) / cam.zoom })

/** 지금 화면이 덮는 판 좌표 */
export const fieldView = (cam: Cam, vp: Viewport): Rect =>
  ({ left: cam.x - vp.w / (2 * cam.zoom), right: cam.x + vp.w / (2 * cam.zoom), top: cam.y - vp.h / (2 * cam.zoom), bottom: cam.y + vp.h / (2 * cam.zoom) })

/** 화면 안(여유 pad 판 px)에 드는가 */
export const inView = (r: Readonly<Rect>, x: number, y: number, pad: number): boolean =>
  x >= r.left - pad && x <= r.right + pad && y >= r.top - pad && y <= r.bottom + pad
