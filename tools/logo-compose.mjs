/**
 * 제목 로고 합치기 — 글자 그림(투명) + 비파형 동검 그림(투명·세로·칼끝 위)을 1600×480 투명 PNG 로 (2026-11-11)
 *
 *   node tools/logo-compose.mjs <글자.png> <동검.png> <out.png> [글자 폭=1250] [동검 밝기=0.62] [동검 길이=1560]
 *
 * 동검은 90° 눕혀(칼끝 오른쪽 · 슴베 왼쪽) 가운데에 깔고 한 톤 어둡게, 글자는 둘레에 어두운 테 2px 를 두른 채 그 위에 얹는다.
 * 두 쪽(한글·영문)이 같은 동검 그림을 쓰니 일관된다.
 */
import { writeFileSync } from 'node:fs'
import { decodePng, encodePng, boxResize } from './png.mjs'

const [gIn, dIn, out, twS = '1250', dimS = '0.62', dlS = '1560'] = process.argv.slice(2)
if (out === undefined) throw new Error('쓰는 법은 머리말')
const W = 1600, H = 480, TW = +twS, DIM = +dimS, DL = +dlS
const crop = (img, th = 40) => { // 알파가 문턱을 넘는 네모로 자른다
  let x0 = img.w, y0 = img.h, x1 = -1, y1 = -1
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) if (img.px[(y * img.w + x) * 4 + 3] >= th) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y }
  return { x0, y0, w: x1 - x0 + 1, h: y1 - y0 + 1 }
}
const fit = (img, dw) => { const c = crop(img); const dh = Math.round(c.h * dw / c.w); return { w: dw, h: dh, px: boxResize(img, c.x0, c.y0, c.w, c.h, dw, dh) } }

const glyph = fit(decodePng(gIn), TW)
// 동검: 먼저 눕히고(시계 방향 90°) 줄인다
const d0 = decodePng(dIn), c0 = crop(d0)
const rw = c0.h, rh = c0.w, rot = { w: rw, h: rh, px: new Uint8Array(rw * rh * 4) }
for (let y = 0; y < c0.h; y++) for (let x = 0; x < c0.w; x++) {
  const s = ((y + c0.y0) * d0.w + x + c0.x0) * 4
  const nx = c0.h - 1 - y, ny = x, d = (ny * rw + nx) * 4 // 시계 방향
  for (let k = 0; k < 4; k++) rot.px[d + k] = d0.px[s + k]
}
const dag = fit(rot, DL)

const o = new Float32Array(W * H * 4) // 곱하지 않은 색 + 알파(0~1)
const over = (x, y, r, g, b, a) => {
  if (x < 0 || y < 0 || x >= W || y >= H || a <= 0) return
  const i = (y * W + x) * 4, oa = o[i + 3], na = a + oa * (1 - a)
  for (const [k, v] of [[0, r], [1, g], [2, b]]) o[i + k] = (v * a + o[i + k] * oa * (1 - a)) / na
  o[i + 3] = na
}
// 메가히트 로고 문법 (형 11-11: "글씨색이랑 동검 색이 너무 비슷해서 안 보임 · 또렷해야 돼"):
//   바탕(동검)은 어둡고 채도 낮게 · 글자는 밝은 금빛 · 글자 둘레에 굵은 어두운 테 + 아래로 그림자 → 작게 줄여도 글자가 먼저 읽힌다
const DSAT = +(process.env.LOGO_DAG_SAT ?? '0.55') // 동검 채도 (1 = 그대로)
const GOLD = process.env.LOGO_GOLD !== '0' // 글자를 금빛으로
const STROKE = +(process.env.LOGO_STROKE ?? '7') // 글자 테 두께(px · 1600 기준)
const SHADOW = +(process.env.LOGO_SHADOW ?? '10') // 글자 그림자 내림(px)
const dx0 = Math.round((W - dag.w) / 2), dy0 = Math.round((H - dag.h) / 2)
for (let y = 0; y < dag.h; y++) for (let x = 0; x < dag.w; x++) {
  const p = (y * dag.w + x) * 4
  const r = dag.px[p] * DIM, g = dag.px[p + 1] * DIM, b = dag.px[p + 2] * DIM
  const l = 0.3 * r + 0.59 * g + 0.11 * b
  over(dx0 + x, dy0 + y, l + (r - l) * DSAT, l + (g - l) * DSAT, l + (b - l) * DSAT, dag.px[p + 3] / 255)
}
/** 글자 색 → 금빛: 밝기는 글자의 명암을 살리고, 색은 금(어두운 곳 황동 · 밝은 곳 연한 금)으로 다시 칠한다 */
const gold = (r, g, b) => {
  if (!GOLD) return [r, g, b]
  const l = Math.min(1, Math.max(0, (0.3 * r + 0.59 * g + 0.11 * b) / 255))
  const t = Math.pow(l, 0.8)
  return [96 + (255 - 96) * t, 60 + (226 - 60) * t, 14 + (130 - 14) * t]
}
const gx0 = Math.round((W - glyph.w) / 2), gy0 = Math.round((H - glyph.h) / 2)
const mask = new Uint8Array(glyph.w * glyph.h)
for (let i = 0; i < mask.length; i++) mask[i] = glyph.px[i * 4 + 3] >= 128 ? 1 : 0
/** 글자 모양을 R 만큼 둥글게 부풀린 자리에 색을 깐다 (dyOff 만큼 아래로) */
const ring = (R, dyOff, r, g, b, a) => {
  for (let y = -R; y < glyph.h + R; y++) for (let x = -R; x < glyph.w + R; x++) {
    let m = 0
    for (let dy = -R; dy <= R && !m; dy++) for (let dx = -R; dx <= R; dx++) {
      if (dx * dx + dy * dy > R * R + 1) continue
      const xx = x + dx, yy = y + dy
      if (xx < 0 || yy < 0 || xx >= glyph.w || yy >= glyph.h) continue
      if (mask[yy * glyph.w + xx]) { m = 1; break }
    }
    if (m) over(gx0 + x, gy0 + y + dyOff, r, g, b, a)
  }
}
if (SHADOW > 0) ring(STROKE + 2, SHADOW, 0, 0, 0, 0.55) // 그림자
ring(STROKE, 0, 20, 12, 6, 0.97) // 어두운 테
for (let y = 0; y < glyph.h; y++) for (let x = 0; x < glyph.w; x++) {
  const p = (y * glyph.w + x) * 4
  const [r, g, b] = gold(glyph.px[p], glyph.px[p + 1], glyph.px[p + 2])
  over(gx0 + x, gy0 + y, r, g, b, glyph.px[p + 3] / 255)
}
const buf = Buffer.alloc(W * H * 4)
for (let i = 0; i < W * H; i++) { for (let k = 0; k < 3; k++) buf[i * 4 + k] = Math.round(o[i * 4 + k]); buf[i * 4 + 3] = Math.round(o[i * 4 + 3] * 255) }
writeFileSync(out, encodePng(W, H, buf))
console.log('쓴 것', out, W + '×' + H)
