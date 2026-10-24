/**
 * 격자로 받은 동작 그림(4x2 = 8컷)을 한 줄 띠로 — 칠십팔국 전장의 병졸 동작 (2026-10-25)
 *
 * slice-grid 의 trim 은 칸마다 따로 크기를 맞춰서, 쓰러진 컷(옆으로 눕다)이 서 있는 컷보다 크게 나온다.
 * 동작 그림은 **모든 컷이 같은 배율**이어야 하고 **발이 같은 줄**에 있어야 한다 — 안 그러면 걸을 때 몸이 커졌다 작아졌다 하고 들썩인다.
 *   - 배율: 가장 큰 컷의 키가 띠 높이의 90% 가 되게, 모든 컷에 같은 배율
 *   - 가로: 컷마다 **잉크의 무게중심**(창끝처럼 가는 것은 거의 안 무겁다 → 몸통)을 띠 칸의 가운데에
 *   - 세로: 컷마다 잉크의 맨 아래(발)를 띠 칸의 같은 줄에
 *   - 옆 칸 그림의 창끝이 넘어와 있다 → 칸마다 이어진 덩어리를 세어, **칸 가장자리에 걸친 작은 조각**은 지운다
 *     (떨어진 창처럼 칸 안에 온전히 있는 것은 남긴다)
 *
 *   node tools/strip-frames.mjs <알파가 있는 그림.png> <가로칸> <세로칸> <out.png> [띠높이=160] [안쪽=0.02]
 * 컷 순서는 왼→오, 위→아래. 알파는 tools/key-png.mjs 로 먼저 따낸다.
 */
import { writeFileSync } from 'node:fs'
import { decodePng, encodePng, boxResize } from './png.mjs'

const [file, colsS, rowsS, out, hS = '160', insetS = '0.02'] = process.argv.slice(2)
if (out === undefined) throw new Error('쓰는 법은 이 파일 머리말에 있다')
const cols = Number(colsS)
const rows = Number(rowsS)
const H = Number(hS)
const INSET = Number(insetS)
const src = decodePng(file)
const cw = src.w / cols
const ch = src.h / rows

/** 한 칸을 떼어 낸다 — 가장자리에 걸친 작은 덩어리는 지운 채로 */
function cellImage(x0, y0, w, h) {
  const px = new Uint8Array(w * h * 4)
  for (let y = 0; y < h; y++) px.set(src.px.subarray(((y0 + y) * src.w + x0) * 4, ((y0 + y) * src.w + x0 + w) * 4), y * w * 4)
  const lab = new Int32Array(w * h).fill(-1)
  const comps = []
  const stack = []
  for (let i = 0; i < w * h; i++) {
    if (lab[i] >= 0 || px[i * 4 + 3] < 40) continue
    const id = comps.length
    const c = { n: 0, edge: false, cells: [] }
    lab[i] = id
    stack.push(i)
    while (stack.length > 0) {
      const p = stack.pop()
      c.n++
      c.cells.push(p)
      const x = p % w, y = (p - x) / w
      if (x === 0 || x === w - 1) c.edge = true
      for (const q of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1]) {
        if (q >= 0 && lab[q] < 0 && px[q * 4 + 3] >= 40) { lab[q] = id; stack.push(q) }
      }
    }
    comps.push(c)
  }
  const big = Math.max(...comps.map((c) => c.n))
  for (const c of comps) {
    // 옆 칸에서 넘어온 조각 — 가장자리에 걸치고 작다 · 티끌 — 아주 작다
    if ((c.edge && c.n < big * 0.25) || c.n < big * 0.004) for (const p of c.cells) px[p * 4 + 3] = 0
  }
  // 반투명 가장자리(알파 < 40)는 덩어리에 안 들어갔다 — 둘레에 남은 것 중 지운 덩어리 곁의 것도 지운다
  for (let i = 0; i < w * h; i++) {
    if (px[i * 4 + 3] === 0 || px[i * 4 + 3] >= 40) continue
    const x = i % w, y = (i - x) / w
    let keep = false
    for (let dy = -2; dy <= 2 && !keep; dy++) for (let dx = -2; dx <= 2 && !keep; dx++) {
      const xx = x + dx, yy = y + dy
      if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue
      if (px[(yy * w + xx) * 4 + 3] >= 40) keep = true
    }
    if (!keep) px[i * 4 + 3] = 0
  }
  return { w, h, px }
}

/** 칸마다 잉크 상자 · 무게중심 */
const cells = []
for (let r = 0; r < rows; r++) {
  for (let c = 0; c < cols; c++) {
    const x0 = Math.round(c * cw + cw * INSET), x1 = Math.round((c + 1) * cw - cw * INSET)
    const y0 = Math.round(r * ch + ch * INSET), y1 = Math.round((r + 1) * ch - ch * INSET)
    const img = cellImage(x0, y0, x1 - x0, y1 - y0)
    let bx0 = img.w, bx1 = 0, by0 = img.h, by1 = 0, sx = 0, sw = 0
    for (let y = 0; y < img.h; y++) {
      for (let x = 0; x < img.w; x++) {
        const a = img.px[(y * img.w + x) * 4 + 3]
        if (a < 40) continue
        if (x < bx0) bx0 = x
        if (x > bx1) bx1 = x
        if (y < by0) by0 = y
        if (y > by1) by1 = y
        sx += x * a
        sw += a
      }
    }
    if (sw === 0) throw new Error(`빈 칸: ${r},${c}`)
    cells.push({ img, bx0, bx1: bx1 + 1, by0, by1: by1 + 1, cx: sx / sw })
  }
}
const tallest = Math.max(...cells.map((k) => k.by1 - k.by0))
const scale = (H * 0.9) / tallest
// 띠 칸 너비 — 무게중심에서 가장 멀리 뻗은 것(창끝)까지 다 들어가게
const half = Math.max(...cells.map((k) => Math.max(k.cx - k.bx0, k.bx1 - k.cx)))
const W = Math.ceil(half * 2 * scale) + 4
const base = Math.round(H * 0.97)
const strip = new Uint8Array(W * cells.length * H * 4)
cells.forEach((k, i) => {
  const sw = k.bx1 - k.bx0, sh = k.by1 - k.by0
  const dw = Math.max(1, Math.round(sw * scale)), dh = Math.max(1, Math.round(sh * scale))
  const px = boxResize(k.img, k.bx0, k.by0, sw, sh, dw, dh)
  const ox = i * W + Math.round(W / 2 - (k.cx - k.bx0) * scale)
  const oy = base - dh
  for (let y = 0; y < dh; y++) {
    const ty = oy + y
    if (ty < 0 || ty >= H) continue
    for (let x = 0; x < dw; x++) {
      const tx = ox + x
      if (tx < i * W || tx >= (i + 1) * W) continue
      const s = (y * dw + x) * 4, d = (ty * W * cells.length + tx) * 4
      for (let q = 0; q < 4; q++) strip[d + q] = px[s + q]
    }
  }
})
writeFileSync(out, encodePng(W * cells.length, H, strip))
console.log(`${out}: ${cells.length}컷 · 칸 ${W}x${H} · 띠 ${W * cells.length}x${H} · 배율 ${scale.toFixed(3)}`)
