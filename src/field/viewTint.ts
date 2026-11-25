/**
 * 편 색 입히기 — 띠 전체를 물들이지 않고 옷(밝고 옅은 바탕색 천)만 편 색으로 바꾼다. 살·갑옷·무기·말은 그대로.
 * 열전 tintStrip(haebi-view.ts)은 실루엣 테두리 빛이라 다른 일이다. 이것은 띠 그림을 한 번 칠해 캔버스로 되돌려 주고, 부른 쪽이 캐시한다.
 * 그리는 쪽 전용. 상태를 안 쓴다.
 */
import { P } from '../tune/params.ts'

/** 편 색 (RGB) — 우리는 본편 지도의 MY_LAND 파랑(#2f8cff)과 같은 결 */
export const TEAM_RGB: readonly (readonly [number, number, number])[] = [[47, 140, 255], [196, 62, 48]]

/** 이 픽셀이 천인가 — 옅은 바탕색(채도 낮고 밝음) · 살(주황 쪽 채도)과 갑옷(어두움)은 아니다 */
export function isCloth(r: number, g: number, b: number): boolean {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b)
  if (mx === 0) return false
  const lum = (0.3 * r + 0.59 * g + 0.11 * b) / 255, sat = (mx - mn) / mx
  return lum >= P.field.tintLumMin / 100 && sat <= P.field.tintSatMax / 100
}

/** 색을 입힌 복사본 (가로 세로 같음) */
export function teamTint(src: CanvasImageSource & { width: number; height: number }, side: 0 | 1): HTMLCanvasElement {
  const w = src.width, h = src.height
  const cv = document.createElement('canvas')
  cv.width = w; cv.height = h
  const cx = cv.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D
  cx.drawImage(src, 0, 0)
  const img = cx.getImageData(0, 0, w, h), d = img.data
  const t = TEAM_RGB[side]!, mixA = P.field.tintMix / 100
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3]! < 16) continue
    const r = d[i]!, g = d[i + 1]!, b = d[i + 2]!
    if (!isCloth(r, g, b)) continue
    const lum = (0.3 * r + 0.59 * g + 0.11 * b) / 255, k = 0.45 + 0.75 * lum
    d[i] = Math.round(r + (Math.min(255, t[0] * k) - r) * mixA)
    d[i + 1] = Math.round(g + (Math.min(255, t[1] * k) - g) * mixA)
    d[i + 2] = Math.round(b + (Math.min(255, t[2] * k) - b) * mixA)
  }
  cx.putImageData(img, 0, 0)
  return cv
}
