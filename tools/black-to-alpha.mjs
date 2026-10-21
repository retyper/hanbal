/**
 * 검은 바탕의 빛 효과(불·불티·먼지·연기·번쩍임)를 알파 PNG 로 — 밝기가 곧 불투명도 (2026-10-22)
 *
 * 제미나이는 투명을 못 준다. 빛 효과는 검은 바탕에 받아 "가장 밝은 채널 = 알파"로 바꾸고 색은 알파로 나눠 되살린다
 * (검은 바탕 위에 screen 으로 얹은 것과 같은 모습이 어느 바탕 위에서든 나온다).
 *
 *   node tools/black-to-alpha.mjs <in.png> <out.png> [크기=256] [바닥=12]
 *     바닥  이 밝기(0~255) 아래는 완전히 투명 — JPEG 잡티·검은 바탕의 얼룩을 걷는다
 * 정사각으로 줄이고(가운데 기준) 끝 3% 는 투명하게 깎는다.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { decodePng, encodePng, boxResize } from './png.mjs'

const [inp, out, sizeS = '256', floorS = '12'] = process.argv.slice(2)
if (out === undefined) throw new Error('쓰는 법은 머리말')
const size = Number(sizeS)
const floor = Number(floorS)
const img = decodePng(inp)
const { w, h, px } = img
const side = Math.min(w, h)
const small = boxResize(img, Math.floor((w - side) / 2), Math.floor((h - side) / 2), side, side, size, size)
const src = small ?? px
const o = Buffer.alloc(size * size * 4)
const edge = Math.round(size * 0.03)
for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
  const i = (y * size + x) * 4
  const r = src[i], g = src[i + 1], b = src[i + 2]
  let a = Math.max(r, g, b)
  a = a <= floor ? 0 : Math.min(255, Math.round(((a - floor) / (255 - floor)) * 255))
  if (x < edge || y < edge || x >= size - edge || y >= size - edge) a = 0
  const k = a > 0 ? 255 / Math.max(r, g, b, 1) : 0
  o[i] = Math.min(255, Math.round(r * k)); o[i + 1] = Math.min(255, Math.round(g * k)); o[i + 2] = Math.min(255, Math.round(b * k)); o[i + 3] = a
}
writeFileSync(out, encodePng(size, size, o))
console.log(out, size)
