/**
 * 칠십팔국 앱 아이콘 · 파비콘 — 로고 문장(public/realm/logo/emblem.png)을 어두운 바탕에 얹는다
 *
 *   node tools/realm-icons.mjs
 *
 * 만드는 것 (public/): realm-icon-192.png · realm-icon-512.png (문장 82%) · realm-icon-maskable-512.png (안전 테두리 — 문장 62%)
 *                      realm-favicon-32.png · realm-favicon-64.png (바탕 없이 문장만)
 * 바탕은 #14181e 에 가운데가 조금 밝은 금빛 기운 (판의 바탕색 · 로비와 같은 빛).
 */
import { writeFileSync } from 'node:fs'
import { decodePng, encodePng } from './png.mjs'

const em = decodePng('public/realm/logo/emblem.png')

/** 문장을 size 칸에 (가운데, 비율 r) — 상자 평균으로 줄여 바탕 위에 얹는다 */
function make(size, ratio, bg) {
  const o = Buffer.alloc(size * size * 4)
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const j = (y * size + x) * 4
    if (bg) {
      const d = Math.hypot(x - size / 2, y - size / 2) / (size / 2)
      const glow = Math.max(0, 1 - d) * 26
      o[j] = 20 + glow * 0.9; o[j + 1] = 24 + glow * 0.7; o[j + 2] = 30 + glow * 0.3; o[j + 3] = 255
    }
  }
  const side = Math.round(size * ratio), off = (size - side) / 2, sc = em.w / side
  for (let y = 0; y < side; y++) for (let x = 0; x < side; x++) {
    let r = 0, g = 0, b = 0, a = 0, n = 0
    for (let yy = Math.floor(y * sc); yy < Math.floor((y + 1) * sc); yy++) for (let xx = Math.floor(x * sc); xx < Math.floor((x + 1) * sc); xx++) {
      const i = (yy * em.w + xx) * 4, al = em.px[i + 3] / 255
      r += em.px[i] * al; g += em.px[i + 1] * al; b += em.px[i + 2] * al; a += al; n++
    }
    if (n === 0 || a === 0) continue
    const al = a / n, cr = r / a, cg = g / a, cb = b / a
    const j = ((Math.round(off) + y) * size + Math.round(off) + x) * 4
    const ba = o[j + 3] / 255, oa = al + ba * (1 - al)
    o[j] = Math.round((cr * al + o[j] * ba * (1 - al)) / oa); o[j + 1] = Math.round((cg * al + o[j + 1] * ba * (1 - al)) / oa); o[j + 2] = Math.round((cb * al + o[j + 2] * ba * (1 - al)) / oa)
    o[j + 3] = Math.round(oa * 255)
  }
  return encodePng(size, size, o)
}

writeFileSync('public/realm-icon-192.png', make(192, 0.82, true))
writeFileSync('public/realm-icon-512.png', make(512, 0.82, true))
writeFileSync('public/realm-icon-maskable-512.png', make(512, 0.62, true))
writeFileSync('public/realm-favicon-32.png', make(32, 1, false))
writeFileSync('public/realm-favicon-64.png', make(64, 1, false))
console.log('ok')
