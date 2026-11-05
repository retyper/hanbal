// 초록 기운 픽셀 지우기 — 휘두르기 자국 · 키 남은 초록 (옷에 초록 없는 장수만)
// node tools/degreen.mjs <in.png> <out.png> [문턱=18] [첫컷 끝컷 칸폭]
import { writeFileSync } from 'node:fs'
import { decodePng, encodePng } from './png.mjs'
const [inp, out, thS = '18', f0 = '0', f1 = '999', cw = '0'] = process.argv.slice(2)
const T = Number(thS)
const { w, h, px } = decodePng(inp)
const x0 = Number(cw) > 0 ? Number(f0) * Number(cw) : 0
const x1 = Number(cw) > 0 ? Math.min(w, (Number(f1) + 1) * Number(cw)) : w
let n = 0
for (let y = 0; y < h; y++) for (let x = x0; x < x1; x++) {
  const i = (y * w + x) * 4
  if (px[i + 3] === 0) continue
  const r = px[i], g = px[i + 1], b = px[i + 2]
  if (g - Math.max(r, b) > T) { px[i + 3] = 0; n++ }
}
writeFileSync(out, encodePng(w, h, px))
console.log(`지움 ${n}`)
