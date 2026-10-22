/**
 * 검은 바탕의 단단한 물건(화살 같은 것)을 잘라 알파로 — black-to-alpha 는 밝기가 곧 불투명도라 어두운 쇠 화살촉이 비친다.
 * 여기는 밝기를 knee 까지만 올려 보고(그 위는 다 불투명), 색은 알파로 나눠 되살린다. 자를 칸과 내보낼 크기를 준다.
 *
 *   node tools/solid-on-black.mjs <in.png> <out.png> <x> <y> <w> <h> <outW> [knee=48] [floor=10]
 */
import { writeFileSync } from 'node:fs'
import { decodePng, encodePng } from './png.mjs'

const [src, out, xs, ys, ws, hs, ows, kneeS = '48', floorS = '10'] = process.argv.slice(2)
const X = +xs, Y = +ys, Wc = +ws, Hc = +hs, OW = +ows, KNEE = +kneeS, FLOOR = +floorS
const OH = Math.round((Hc * OW) / Wc)
const { w: W, px } = decodePng(src)
const o = Buffer.alloc(OW * OH * 4)
const sc = Wc / OW
for (let y = 0; y < OH; y++) for (let x = 0; x < OW; x++) {
  // 상자 평균으로 줄인다 (알파를 곱한 채로 더하고 마지막에 나눈다)
  let r = 0, g = 0, b = 0, a = 0, n = 0
  for (let yy = Math.floor(Y + y * sc); yy < Math.floor(Y + (y + 1) * sc); yy++) for (let xx = Math.floor(X + x * sc); xx < Math.floor(X + (x + 1) * sc); xx++) {
    const i = (yy * W + xx) * 4
    const m = Math.max(px[i], px[i + 1], px[i + 2])
    const al = Math.max(0, Math.min(1, (m - FLOOR) / (KNEE - FLOOR)))
    r += px[i] * al; g += px[i + 1] * al; b += px[i + 2] * al; a += al; n++
  }
  if (n === 0 || a === 0) continue
  const j = (y * OW + x) * 4
  // 알파로 나눠 색을 되살리되, 어두운 부분이 검게 남도록 knee 로 정한 밝기는 그대로
  o[j] = Math.min(255, Math.round(r / a)); o[j + 1] = Math.min(255, Math.round(g / a)); o[j + 2] = Math.min(255, Math.round(b / a)); o[j + 3] = Math.round((a / n) * 255)
}
writeFileSync(out, encodePng(OW, OH, o))
console.log(`${OW}x${OH}`)
