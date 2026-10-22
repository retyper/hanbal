/**
 * 덩어리 그림에서 입자를 하나씩 잘라 한 줄 띠로 — 계절 입자가 낱낱이 흩날리게 (형: "너무 뭉탱이로 내리고 … 개별적으로 흩날려야")
 *
 *   node tools/particle-strip.mjs <알파 있는 png> <out.png> [칸=64] [최대 개수=8] [알파 문턱=40]
 *
 * 알파가 문턱을 넘는 픽셀을 8방향으로 이어 덩이를 찾고, 큰 덩이부터 골라 칸 하나에 하나씩(비율 그대로, 가운데) 넣는다.
 * 너무 작은 덩이(티끌)는 버린다. 띠는 늘 [최대 개수] 칸 — 덩이가 모자라면 앞에서부터 되풀어 채운다(CSS 가 칸 수를 하나로 쓴다).
 */
import { writeFileSync } from 'node:fs'
import { decodePng, encodePng } from './png.mjs'

const [src, out, cellS = '64', maxS = '8', thS = '40'] = process.argv.slice(2)
const CELL = +cellS, MAX = +maxS, TH = +thS
const { w: W, h: H, px } = decodePng(src)
const A = (x, y) => px[(y * W + x) * 4 + 3]

const seen = new Uint8Array(W * H)
const blobs = []
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  if (seen[y * W + x] || A(x, y) < TH) continue
  let x0 = x, x1 = x, y0 = y, y1 = y, n = 0
  const st = [y * W + x]
  seen[y * W + x] = 1
  while (st.length) {
    const i = st.pop(), cx = i % W, cy = (i - cx) / W
    n++
    if (cx < x0) x0 = cx; if (cx > x1) x1 = cx; if (cy < y0) y0 = cy; if (cy > y1) y1 = cy
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = cx + dx, ny = cy + dy
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue
      const j = ny * W + nx
      if (!seen[j] && A(nx, ny) >= TH) { seen[j] = 1; st.push(j) }
    }
  }
  blobs.push({ x0, x1, y0, y1, n })
}
const minN = Math.max(30, (W * H) / 20000)
const pick = blobs.filter((b) => b.n >= minN).sort((a, b) => b.n - a.n).slice(0, MAX)
if (pick.length === 0) { console.error('덩이를 못 찾았다'); process.exit(1) }

const K = MAX
const o = Buffer.alloc(K * CELL * CELL * 4)
Array.from({ length: K }, (_, k) => pick[k % pick.length]).forEach((b, k) => {
  const pad = 3
  const bx0 = Math.max(0, b.x0 - pad), by0 = Math.max(0, b.y0 - pad), bx1 = Math.min(W - 1, b.x1 + pad), by1 = Math.min(H - 1, b.y1 + pad)
  const bw = bx1 - bx0 + 1, bh = by1 - by0 + 1
  const sc = (CELL - 2) / Math.max(bw, bh)
  const ow = bw * sc, oh = bh * sc, ox = (CELL - ow) / 2, oy = (CELL - oh) / 2
  // 칸의 픽셀마다 원본을 상자 평균으로 (줄일 때 계단이 안 나게) — 알파를 곱한 채로 더하고 마지막에 나눈다
  for (let y = 0; y < CELL; y++) for (let x = 0; x < CELL; x++) {
    const sx0 = bx0 + (x - ox) / sc, sy0 = by0 + (y - oy) / sc, sx1 = sx0 + 1 / sc, sy1 = sy0 + 1 / sc
    let r = 0, g = 0, bb = 0, a = 0, c = 0
    for (let yy = Math.floor(sy0); yy < Math.ceil(sy1); yy++) for (let xx = Math.floor(sx0); xx < Math.ceil(sx1); xx++) {
      c++
      if (xx < bx0 || yy < by0 || xx > bx1 || yy > by1) continue
      const i = (yy * W + xx) * 4, al = px[i + 3] / 255
      r += px[i] * al; g += px[i + 1] * al; bb += px[i + 2] * al; a += al
    }
    if (c === 0 || a === 0) continue
    const j = ((y * K * CELL) + k * CELL + x) * 4
    o[j] = Math.round(r / a); o[j + 1] = Math.round(g / a); o[j + 2] = Math.round(bb / a); o[j + 3] = Math.round((a / c) * 255)
  }
})
writeFileSync(out, encodePng(K * CELL, CELL, o))
console.log(`${pick.length} → ${K}칸`)
