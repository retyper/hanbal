/**
 * 9칸 늘이기(border-image)용 판 그림 — 검은 바탕을 딴 그림(key-png)을 물건 둘레로 자르고,
 * 가로로 늘어날 가운데 기둥(위·아래 걸쇠 같은 장식)을 깨끗한 테두리 기둥으로 바꿔 끼운다. 그래야 넓은 단추에서도 장식이 늘어나 보이지 않는다.
 *
 *   node tools/nine-slice.mjs <keyed.png> <out.png> <높이px> [가운데 시작=0.3] [가운데 끝=0.7] [깨끗한 기둥 시작=0.2] [깨끗한 기둥 끝=0.27] [알파 문턱=24]
 *
 * 비율은 물건 폭에 대한 것. 내보낸 그림의 크기와 권하는 slice 값을 알린다.
 */
import { writeFileSync } from 'node:fs'
import { decodePng, encodePng } from './png.mjs'

const [src, out, hS, m0S = '0.3', m1S = '0.7', c0S = '0.2', c1S = '0.27', thS = '24'] = process.argv.slice(2)
const OH = +hS, M0 = +m0S, M1 = +m1S, C0 = +c0S, C1 = +c1S, TH = +thS
const { w: W, h: H, px } = decodePng(src)
let x0 = W, y0 = H, x1 = -1, y1 = -1
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  if (px[(y * W + x) * 4 + 3] < TH) continue
  if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y
}
const bw = x1 - x0 + 1, bh = y1 - y0 + 1
// 1) 잘라 낸다
const cut = Buffer.alloc(bw * bh * 4)
const src8 = Buffer.from(px.buffer, px.byteOffset, px.byteLength)
for (let y = 0; y < bh; y++) src8.copy(cut, y * bw * 4, ((y0 + y) * W + x0) * 4, ((y0 + y) * W + x1 + 1) * 4)
// 2) 가운데 기둥을 깨끗한 기둥으로 (되풀어 채운다)
const a = Math.round(bw * M0), b = Math.round(bw * M1), c = Math.round(bw * C0), d = Math.max(c + 1, Math.round(bw * C1))
for (let x = a; x < b; x++) {
  const sx = c + ((x - a) % (d - c))
  for (let y = 0; y < bh; y++) cut.copy(cut, (y * bw + x) * 4, (y * bw + sx) * 4, (y * bw + sx) * 4 + 4)
}
// 3) 높이 OH 로 줄인다 (상자 평균, 알파를 곱한 채로)
const sc = bh / OH, OW = Math.round(bw / sc)
const o = Buffer.alloc(OW * OH * 4)
for (let y = 0; y < OH; y++) for (let x = 0; x < OW; x++) {
  let r = 0, g = 0, bb = 0, al = 0, n = 0
  for (let yy = Math.floor(y * sc); yy < Math.min(bh, Math.floor((y + 1) * sc)); yy++) for (let xx = Math.floor(x * sc); xx < Math.min(bw, Math.floor((x + 1) * sc)); xx++) {
    const i = (yy * bw + xx) * 4, aa = cut[i + 3] / 255
    r += cut[i] * aa; g += cut[i + 1] * aa; bb += cut[i + 2] * aa; al += aa; n++
  }
  if (n === 0 || al === 0) continue
  const j = (y * OW + x) * 4
  o[j] = Math.round(r / al); o[j + 1] = Math.round(g / al); o[j + 2] = Math.round(bb / al); o[j + 3] = Math.round((al / n) * 255)
}
writeFileSync(out, encodePng(OW, OH, o))
console.log(`${OW}x${OH} · 가운데 기둥 ${Math.round(a / sc)}~${Math.round(b / sc)}px`)
