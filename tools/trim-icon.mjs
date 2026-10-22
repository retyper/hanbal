/**
 * 알파 있는 그림을 물건 둘레로 잘라 정사각 기호로 — 고을 기호(public/realm/icon/settle-*)처럼
 *
 *   node tools/trim-icon.mjs <in.png> <out.png> [크기=160] [알파 문턱=16]
 *
 * 알파가 문턱을 넘는 픽셀의 네모를 찾아 정사각으로 넓히고(가운데 맞춤), 상자 평균으로 줄인다.
 */
import { writeFileSync } from 'node:fs'
import { decodePng, encodePng } from './png.mjs'

const [src, out, sizeS = '160', thS = '16'] = process.argv.slice(2)
const S = +sizeS, TH = +thS
const { w: W, h: H, px } = decodePng(src)
let x0 = W, y0 = H, x1 = -1, y1 = -1
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  if (px[(y * W + x) * 4 + 3] < TH) continue
  if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y
}
if (x1 < 0) throw new Error('물건이 없다')
const side = Math.max(x1 - x0 + 1, y1 - y0 + 1)
const cx = (x0 + x1 + 1) / 2, cy = (y0 + y1 + 1) / 2
const ox = cx - side / 2, oy = cy - side / 2
const sc = side / S
const o = Buffer.alloc(S * S * 4)
for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
  let r = 0, g = 0, b = 0, a = 0, n = 0
  for (let yy = Math.floor(oy + y * sc); yy < Math.floor(oy + (y + 1) * sc); yy++) for (let xx = Math.floor(ox + x * sc); xx < Math.floor(ox + (x + 1) * sc); xx++) {
    n++
    if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue
    const i = (yy * W + xx) * 4, al = px[i + 3] / 255
    r += px[i] * al; g += px[i + 1] * al; b += px[i + 2] * al; a += al
  }
  if (n === 0 || a === 0) continue
  const j = (y * S + x) * 4
  o[j] = Math.round(r / a); o[j + 1] = Math.round(g / a); o[j + 2] = Math.round(b / a); o[j + 3] = Math.round((a / n) * 255)
}
writeFileSync(out, encodePng(S, S, o))
console.log(`${S}x${S} (물건 ${x1 - x0 + 1}x${y1 - y0 + 1})`)
