/**
 * 쩍 벌린 다리를 **모은다** (2026-09-20)
 *
 * 형: **"내 캐릭터가 다리를 너무 쩍벌리고있어. 레골라스 처럼 적당히 벌리고 심플하게 쏘는 자세로좀 해봐."**
 *
 * 그림 모델에게 자세를 다시 시키면 화풍이 바뀌고 팔을 도로 달아 온다 (제미나이는 "팔 없는 몸"을 끝내 못 그렸다).
 * 그래서 **있는 그림의 다리만 안쪽으로 기울인다.** 줄(row) 단위의 가로 옮김이라 발바닥은 수평 그대로다 (돌리면 발끝이 들린다):
 *   · 골반(hip) 아래의 줄마다 s = k·(y − hip) 만큼 두 다리를 가운데로 민다.
 *   · 다리 사이가 빈 줄: 왼 덩어리·오른 덩어리를 따로 옮기고, 기운 각이 서는 만큼 굵기를 THIN 배로 줄인다 (빗금의 가로 단면은 1/cos 이라서).
 *   · 빈틈이 없는 줄(갑옷 자락): 줄 전체를 가운데로 고르게 오므린다 — 자락 끝과 다리가 같은 만큼 들어와 이어진다.
 *
 *   node tools/narrow-stance.mjs <in.png> <out.png> <가로칸> <세로칸> <고칠 칸 번호들 0,1,2,3> [발 간격 배율=0.55]
 */
import { writeFileSync } from 'node:fs'
import { decodePng, encodePng } from './png.mjs'

const [inF, outF, colsS, rowsS, cellsS, keepS = '0.55'] = process.argv.slice(2)
if (cellsS === undefined) throw new Error('쓰는 법은 이 파일 머리말에 있다')
const cols = Number(colsS)
const rows = Number(rowsS)
const KEEP = Number(keepS)
const THIN = 0.93
const src = decodePng(inF)
const out = new Uint8Array(src.px)
const W = src.w
const cw = W / cols
const ch = src.h / rows
const A = (x, y) => src.px[(y * W + x) * 4 + 3]
const ON = 40

for (const cell of cellsS.split(',').map(Number)) {
  const x0 = Math.round((cell % cols) * cw)
  const x1 = Math.round((cell % cols + 1) * cw)
  const y0 = Math.round(Math.floor(cell / cols) * ch)
  const y1 = Math.round((Math.floor(cell / cols) + 1) * ch)
  // 몸의 상자.
  let top = -1, bot = -1, L = x1, R = x0
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (A(x, y) > ON) {
    if (top < 0) top = y
    bot = y
    if (x < L) L = x
    if (x > R) R = x
  }
  const H = bot - top
  // 몸의 가운데 = 머리~가슴 구간의 평균 중심이 아니라, **두 발의 한가운데** (벌린 다리는 좌우 대칭으로 섰다).
  const footRow = bot - Math.round(H * 0.03)
  let fl = x1, fr = x0
  for (let x = x0; x < x1; x++) if (A(x, footRow) > ON) { if (x < fl) fl = x; if (x > fr) fr = x }
  const cx = (fl + fr) / 2
  const hip = top + Math.round(H * 0.5)
  // 발의 중심이 가운데에서 떨어진 거리 → 그 KEEP 배가 되게 민다.
  const footHalf = (fr - fl) / 2 * 0.78
  const k = (footHalf * (1 - KEEP)) / (bot - hip)
  console.log(`칸 ${cell}: 몸 ${L}..${R} × ${top}..${bot} · 가운데 ${cx.toFixed(0)} · 골반 ${hip} · 발끝에서 ${(k * (bot - hip)).toFixed(0)}px 씩 모은다`)

  for (let y = hip; y <= bot; y++) {
    const s = k * (y - hip)
    // 이 줄의 덩어리들.
    let lmin = -1, rmax = -1
    for (let x = x0; x < x1; x++) if (A(x, y) > ON) { if (lmin < 0) lmin = x; rmax = x }
    for (let x = x0; x < x1; x++) for (let c = 0; c < 4; c++) out[(y * W + x) * 4 + c] = 0
    if (lmin < 0) continue
    // 가운데 빈틈 — cx 를 품거나 가장 가까운 3px 이상의 투명 구간.
    let gapL = -1, gapR = -1, best = 1e9, run = -1
    for (let x = lmin; x <= rmax + 1; x++) {
      const on = x <= rmax && A(x, y) > ON
      if (!on && run < 0) run = x
      if (on && run >= 0) {
        if (x - run >= 3) {
          const d = Math.abs((run + x) / 2 - cx)
          if (d < best) { best = d; gapL = run; gapR = x - 1 }
        }
        run = -1
      }
    }
    const hasGap = gapL >= 0 && best < (rmax - lmin) * 0.25
    // 역사상: 나가는 x' 마다 들어오는 x 를 구해 가로로 보간한다.
    const sample = (xs, dst) => {
      const xi = Math.floor(xs)
      const f = xs - xi
      let a = 0, r = 0, g = 0, b = 0
      for (const [xx, wgt] of [[xi, 1 - f], [xi + 1, f]]) {
        if (xx < x0 || xx >= x1 || wgt <= 0) continue
        const i = (y * W + xx) * 4
        const al = src.px[i + 3] * wgt
        a += al
        r += src.px[i] * al
        g += src.px[i + 1] * al
        b += src.px[i + 2] * al
      }
      if (a < 1) return
      const o = (y * W + dst) * 4
      // 두 덩어리가 겹치면 더 진한 쪽이 이긴다.
      if (out[o + 3] >= a) return
      out[o] = Math.round(r / a)
      out[o + 1] = Math.round(g / a)
      out[o + 2] = Math.round(b / a)
      out[o + 3] = Math.round(a)
    }
    if (hasGap) {
      const parts = [[lmin, gapL - 1, +1], [gapR + 1, rmax, -1]]
      for (const [a0, a1, dir] of parts) {
        const c = (a0 + a1) / 2
        const c2 = c + dir * s
        const half = (a1 - a0) / 2 * THIN + 1
        for (let dx = Math.floor(c2 - half); dx <= Math.ceil(c2 + half); dx++) {
          if (dx < x0 || dx >= x1) continue
          const xs = c + (dx - c2) / THIN
          if (xs < a0 - 1 || xs > a1 + 1) continue
          sample(xs, dx)
        }
      }
    } else {
      const half = Math.max(cx - lmin, rmax - cx)
      const f = Math.max(0.2, (half - s) / half)
      for (let dx = Math.floor(cx - half * f) - 1; dx <= Math.ceil(cx + half * f) + 1; dx++) {
        if (dx < x0 || dx >= x1) continue
        sample(cx + (dx - cx) / f, dx)
      }
    }
  }
}
writeFileSync(outF, encodePng(W, src.h, out))
console.log(`→ ${outF}`)
