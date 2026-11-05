/**
 * 그림 한 군데를 옆 자리로 덮는다 — 제미나이 바탕 그림의 ✦ 표식 지우기 (2026-11-05 마을 터)
 *   node tools/patch-png.mjs <in.png> <out.png> <x0,y0,x1,y1 지울 네모 0~1> <dx,dy 가져올 자리 차이 0~1>
 * 가장자리는 둘레 6px 에서 섞는다 (네모 자국이 안 남게)
 */
import { writeFileSync } from 'node:fs'
import { decodePng, encodePng } from './png.mjs'

const [inp, out, boxS, offS] = process.argv.slice(2)
const { w, h, px } = decodePng(inp)
const [x0, y0, x1, y1] = boxS.split(',').map(Number)
const [dx, dy] = offS.split(',').map(Number)
const X0 = Math.round(x0 * w), Y0 = Math.round(y0 * h), X1 = Math.round(x1 * w), Y1 = Math.round(y1 * h)
const DX = Math.round(dx * w), DY = Math.round(dy * h)
const F = 6
for (let y = Y0; y < Y1; y++) for (let x = X0; x < X1; x++) {
  const sx = Math.min(w - 1, Math.max(0, x + DX)), sy = Math.min(h - 1, Math.max(0, y + DY))
  const edge = Math.min(x - X0, X1 - 1 - x, y - Y0, Y1 - 1 - y)
  const a = Math.min(1, (edge + 1) / F)
  const i = (y * w + x) * 4, j = (sy * w + sx) * 4
  for (let c = 0; c < 4; c++) px[i + c] = Math.round(px[i + c] * (1 - a) + px[j + c] * a)
}
writeFileSync(out, encodePng(w, h, px))
console.log(`→ ${out} · ${X1 - X0}x${Y1 - Y0} 를 (${DX},${DY}) 옆으로 덮었다`)
