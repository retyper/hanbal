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

/** 구운 판의 칸 배치 (방패 면 물들임이 칸마다 도는 데 쓴다) */
export interface CellLayout { cw: number; ch: number; cols: number; n: number }
/** 방패 면의 붉은 갈색인가 — 살·가죽과 색이 겹쳐서 이 화소만으로는 못 가린다 (자리 창으로 한 번 더 거른다) */
export const isShieldRed = (r: number, g: number, b: number): boolean => r - g > 35 && r - b > 50 && r < 190 && (r + g + b) / 3 < 110 && g - b < 0.6 * (r - g)
/**
 * 방패 띠: 칸마다 방패 면 후보 가운데 가장 오른쪽(방패가 가는 쪽) 화소에서 shieldWinPermille 폭 안의 것만 편 색으로 섞는다
 * (얼굴·손은 방패 면보다 몸 쪽이라 이 창 밖이다) · 밝기는 원래 화소 것을 남긴다 · 테두리 쇠붙이·자루는 후보가 아니라 그대로
 */
function tintShield(d: Uint8ClampedArray, w: number, lay: CellLayout, t: readonly number[]): void {
  const F = P.field, mixS = F.shieldTintMix / 100, win = Math.max(2, Math.round(lay.cw * F.shieldWinPermille / 1000))
  for (let i = 0; i < lay.n; i++) {
    const x0 = (i % lay.cols) * lay.cw, y0 = Math.floor(i / lay.cols) * lay.ch
    let xmax = -1
    for (let y = 0; y < lay.ch; y++) for (let x = 0; x < lay.cw; x++) {
      const k = ((y0 + y) * w + x0 + x) * 4
      if (d[k + 3]! < 16 || !isShieldRed(d[k]!, d[k + 1]!, d[k + 2]!)) continue
      if (x > xmax) xmax = x
    }
    if (xmax < 0) continue
    for (let y = 0; y < lay.ch; y++) for (let x = Math.max(0, xmax - win); x <= xmax; x++) {
      const k = ((y0 + y) * w + x0 + x) * 4
      if (d[k + 3]! < 16) continue
      const r = d[k]!, g = d[k + 1]!, b = d[k + 2]!
      if (!isShieldRed(r, g, b)) continue
      const lum = (0.3 * r + 0.59 * g + 0.11 * b) / 255, kk = 0.5 + 1.1 * lum
      d[k] = Math.round(r + (Math.min(255, t[0]! * kk) - r) * mixS)
      d[k + 1] = Math.round(g + (Math.min(255, t[1]! * kk) - g) * mixS)
      d[k + 2] = Math.round(b + (Math.min(255, t[2]! * kk) - b) * mixS)
    }
  }
}

/** 색을 입힌 복사본 (가로 세로 같음) · shield 칸 배치가 오면 방패 면도 물들인다 */
export function teamTint(src: CanvasImageSource & { width: number; height: number }, side: 0 | 1, shield?: CellLayout): HTMLCanvasElement {
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
  if (shield !== undefined) tintShield(d, w, shield, t)
  cx.putImageData(img, 0, 0)
  return cv
}
