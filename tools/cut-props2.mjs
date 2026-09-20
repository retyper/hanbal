/**
 * 제미나이가 준 소품 시트(props2)를 자른다 (2026-09-20). 격자가 고르지 않고 칸 사이에 검은 줄이 있어
 * slice-grid 로는 못 자른다 — 칸 안쪽의 네모를 손으로 주고, 그 안에서 불투명한 상자만 다시 조인다.
 *   node tools/key-png.mjs assets_src/props2-source.png assets_src/props2-keyed.png 100 70
 *   node tools/cut-props2.mjs
 * 환도(뽑은 칼)는 이 시트의 것이 옆 칸의 과녁과 겹쳐서 못 쓴다 — 앞서 받은 shots-source 의 칼을 쓴다.
 */
import { writeFileSync } from 'node:fs'
import { decodePng, encodePng, boxResize } from './png.mjs'

function cut(src, name, [x0, y0, x1, y1], long) {
  const A = (x, y) => src.px[(y * src.w + x) * 4 + 3]
  let L = x1, R = x0, T = y1, B = y0
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (A(x, y) > 60) { if (x < L) L = x; if (x > R) R = x; if (y < T) T = y; if (y > B) B = y }
  const w = R - L + 1, h = B - T + 1
  const k = long / Math.max(w, h)
  const dw = Math.max(1, Math.round(w * k)), dh = Math.max(1, Math.round(h * k))
  writeFileSync(`public/sprites/${name}.png`, encodePng(dw, dh, boxResize(src, L, T, w, h, dw, dh)))
  console.log(`  ${name} ${dw}x${dh} ← (${L},${T}) ${w}x${h}`)
}

const p2 = decodePng('assets_src/props2-keyed.png')
cut(p2, 'prop-shield', [30, 8, 240, 285], 256)
cut(p2, 'prop-shield-broken', [285, 8, 500, 285], 256)
cut(p2, 'prop-crown', [560, 70, 730, 210], 96)
cut(p2, 'prop-rope', [850, 0, 940, 282], 256)
cut(p2, 'prop-sheath', [15, 300, 500, 400], 256)
cut(p2, 'prop-rail', [4, 470, 505, 535], 320)
const shots = decodePng('assets_src/shots-source.png')
cut(shots, 'prop-sword', [925, 360, 1254, 450], 256)
