/**
 * 사냥감 시트를 자른다 (2026-09-20, 형: "토끼나 물고기 사슴 등의 동물들도 사냥하는 스테이지 나와야 하지 않나싶다").
 *   제미나이 · 4x3 칸 (토끼·고라니·꿩·잉어 × 자세 A · 자세 B · 죽은 모습, 잉어의 B 칸은 연못).
 *   node tools/key-png.mjs assets_src/animals-source.png assets_src/animals-keyed.png 100 70
 *   node tools/cut-animals.mjs
 * ★ **모든 조각을 같은 배율로** 줄인다 — 자세 A 와 B 의 크기 관계가 그림 그대로 남아야 컷이 바뀔 때 몸이 안 출렁인다.
 */
import { writeFileSync } from 'node:fs'
import { decodePng, encodePng, boxResize } from './png.mjs'

const src = decodePng('assets_src/animals-keyed.png')
const A = (x, y) => src.px[(y * src.w + x) * 4 + 3]
// 갈대·수염·깃 끝의 가는 선에는 마젠타 물이 남는다 (key-png 의 despill 은 가장자리 한 겹뿐이다) — 빨강·파랑이 둘 다 초록을
// 넘는 픽셀은 이 시트에 원래 없다 (짐승도 풀도 갈색·초록·금빛이다). 그런 픽셀을 마른 풀빛으로 돌린다.
for (let i = 0; i < src.px.length; i += 4) {
  const g = src.px[i + 1]
  if (Math.min(src.px[i], src.px[i + 2]) - g > 14) { src.px[i] = Math.round(g * 1.05); src.px[i + 2] = Math.round(g * 0.7) }
}
const K = 0.8
const cw = src.w / 4
const ch = src.h / 3
const names = [
  ['hare-a', 'deer-a', 'pheasant-a', 'carp-a'],
  ['hare-b', 'deer-b', 'pheasant-b', 'pond'],
  ['hare-dead', 'deer-dead', 'pheasant-dead', 'carp-dead'],
]
for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) {
  const x0 = Math.round(c * cw) + 2, x1 = Math.round((c + 1) * cw) - 2
  const y0 = Math.round(r * ch) + 2, y1 = Math.round((r + 1) * ch) - 2
  let L = x1, R = x0, T = y1, B = y0
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (A(x, y) > 60) { if (x < L) L = x; if (x > R) R = x; if (y < T) T = y; if (y > B) B = y }
  const w = R - L + 1, h = B - T + 1
  const dw = Math.round(w * K), dh = Math.round(h * K)
  const name = `animal-${names[r][c]}`
  writeFileSync(`public/sprites/${name}.png`, encodePng(dw, dh, boxResize(src, L, T, w, h, dw, dh)))
  console.log(`  ${name} ${dw}x${dh}`)
}
