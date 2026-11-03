/**
 * 장수 20컷 띠를 두 장의 새 그림으로 통째로 묶는다 (형 11-03: 걷기 8컷이 한 자세 · 서기와 걷기의 체형이 달라 튄다).
 *
 * 걷기 8컷(A)과 서기 4 · 공격 6 · 맞음 · 쓰러짐(B · 4x3 격자 12컷)을 각각 tools/strip-frames.mjs 로 띠로 만든 뒤 여기서 하나로:
 *   서기 0~3 = B1~4 · 걷기 4~11 = A1~8 · 공격 12~17 = B5~10 · 맞음 18 = B11 · 쓰러짐 19 = B12 (docs/realm/GENERAL-SPRITES.md 의 칸 차례)
 * - 두 띠의 서 있는 키(A 걷기 8컷 · B 서기 4컷의 잉크 높이 가운데 값)를 같게 맞춘다 — 걷다 서도 몸이 커지거나 줄지 않게
 * - 모든 칸은 같은 너비 · 잉크 무게중심을 칸 가운데에 · 발(잉크 맨 아래)을 같은 줄에. 칸 너비는 가장 멀리 뻗은 컷이 들어가게
 * - 찍는 값: art.ts GEN_ANIM 의 ar(칸 가로/세로) · body(서 있는 키 / 띠 높이)
 *
 *   node tools/assemble-gen20.mjs <걷기 8컷 띠.png> <나머지 12컷 띠.png> <out.png> [띠 높이=160]
 */
import { writeFileSync } from 'node:fs'
import { decodePng, encodePng, boxResize } from './png.mjs'

const [aF, bF, out, hS = '160'] = process.argv.slice(2)
if (out === undefined) throw new Error('쓰는 법은 이 파일 머리말에 있다')
const H = Number(hS)
const A = decodePng(aF)
const B = decodePng(bF)
const cells = (img, n) => Array.from({ length: n }, (_, i) => ({ img, x0: (i * img.w) / n, w: img.w / n }))
const ca = cells(A, 8)
const cb = cells(B, 12)

function ink(c) {
  let top = c.img.h, bot = -1, left = c.w, right = -1, sx = 0, n = 0
  for (let y = 0; y < c.img.h; y++) for (let x = 0; x < c.w; x++) {
    if (c.img.px[(y * c.img.w + Math.floor(c.x0 + x)) * 4 + 3] > 60) {
      if (y < top) top = y; if (y > bot) bot = y; if (x < left) left = x; if (x > right) right = x; sx += x; n++
    }
  }
  return { top, bot, left, right, cx: n > 0 ? sx / n : c.w / 2 }
}
const med = (v) => v.slice().sort((p, q) => p - q)[Math.floor(v.length / 2)]
const standA = med(ca.map((c) => { const m = ink(c); return m.bot - m.top }))
const standB = med(cb.slice(0, 4).map((c) => { const m = ink(c); return m.bot - m.top }))
// 차례: 서기 B1~4 · 걷기 A1~8 · 공격 B5~10 · 맞음 B11 · 쓰러짐 B12
const order = [...cb.slice(0, 4).map((c) => ({ c, s: 1 / standB })), ...ca.map((c) => ({ c, s: 1 / standA })), ...cb.slice(4).map((c) => ({ c, s: 1 / standB }))]
// FALL=1 — 쓰러짐(19번)을 따로 받아 배율이 다를 때: 누운 몸 길이를 서 있는 키의 1.1배로 맞춘다
if (process.env['FALL'] === '1') { const m = ink(order[19].c); order[19].s = 1.1 / Math.max(1, m.right - m.left) }
// 서 있는 키 T 를 고른다 — 가장 높은 컷(치켜든 칼)도 띠에 들어가게
let tallest = 0
for (const o of order) { const m = ink(o.c); tallest = Math.max(tallest, (m.bot - m.top + 1) * o.s) }
const T = Math.min(H * 0.97, (H - 4) / tallest)
const BASE = H - 2
// 칸 너비 — 무게중심에서 왼·오른쪽으로 가장 멀리 간 잉크
let half = 0
for (const o of order) { const m = ink(o.c); const k = T * o.s; half = Math.max(half, (m.cx - m.left) * k, (m.right - m.cx) * k) }
const CW = Math.ceil(half * 2 + 6)
const W = CW * 20
const px = new Uint8Array(W * H * 4)
order.forEach((o, i) => {
  const m = ink(o.c)
  const k = T * o.s
  const sw = Math.max(1, Math.round(o.c.w * k)), sh = Math.max(1, Math.round(o.c.img.h * k))
  const sc = boxResize(o.c.img, Math.round(o.c.x0), 0, Math.round(o.c.w), o.c.img.h, sw, sh)
  const ox = Math.round(i * CW + CW / 2 - m.cx * k)
  const oy = Math.round(BASE - m.bot * k)
  for (let y = 0; y < sh; y++) {
    const ty = oy + y
    if (ty < 0 || ty >= H) continue
    for (let x = 0; x < sw; x++) {
      const tx = ox + x
      if (tx < i * CW || tx >= (i + 1) * CW) continue
      const s = (y * sw + x) * 4
      if (sc[s + 3] === 0) continue
      px.set(sc.subarray(s, s + 4), (ty * W + tx) * 4)
    }
  }
})
writeFileSync(out, encodePng(W, H, px))
console.log(`${out}: 20컷 · 칸 ${CW}x${H} · GEN_ANIM ar: ${CW} / ${H}, body: ${(T / H).toFixed(3)}`)
