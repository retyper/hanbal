import { HAEBI_RUN as C, P } from '../tune/params.ts'

/** Logical field coordinates never change; backing follows actual contain-content CSS pixels. */
export function fieldPixels(cssWidth: number, cssHeight: number, dpr: number, low = false) {
  const cssScale = Math.min(cssWidth / C.width, cssHeight / C.height)
  const ratio = low ? 1 : Math.min(2, Math.max(1, Number.isFinite(dpr) ? dpr : 1))
  return { width: Math.max(1, Math.round(C.width * cssScale * ratio)), height: Math.max(1, Math.round(C.height * cssScale * ratio)), ratio }
}
export function fieldTransform(ctx: CanvasRenderingContext2D, zoom = 1, x = 0, y = 0) {
  const sx = (ctx.canvas?.width ?? C.width) / C.width, sy = (ctx.canvas?.height ?? C.height) / C.height
  ctx.setTransform(sx * zoom, 0, 0, sy * zoom, x * sx, y * sy)
}
/** Quantized, capped source pixels: no pre-shrinking a hero to94 before a1.8x camera. */
export const heroCacheHeight = (height: number, density: number, nativeHeight: number) => Math.min(nativeHeight, Math.max(1, Math.ceil(height * density / 16) * 16))
export const wantsHeroHd = (density: number) => density > 1.3
export function raidLowGraphics(): boolean {
  if (typeof window === 'undefined') return false
  let pref: string | null = new URLSearchParams(location.search).get('gfx')
  try { pref ??= localStorage.getItem('hanbal.realm.gfx') } catch { /* automatic */ }
  try { if (document.querySelector('.q-low') || window.parent !== window && window.parent.document.querySelector('.q-low')) return true } catch { /* cross-origin host */ }
  if (pref === 'low') return true
  if (pref === 'mid' || pref === 'high') return false
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory
  return typeof mem === 'number' && mem > 0 && mem <= P.realm.gfxMemLow
}
