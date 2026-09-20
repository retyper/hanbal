/**
 * 시식용 — 받은 PNG 를 회색 체크 바탕에 얹어 줄인 미리보기를 만든다. 알파가 있는지도 말한다.
 *   node tools/peek-png.mjs <받은그림.png> <미리보기.png> [너비=900]
 */
import { writeFileSync } from 'node:fs'
import { decodePng, encodePng, boxResize } from './png.mjs'
const [file, out, wS = '900'] = process.argv.slice(2)
const src = decodePng(file)
let clear = 0
for (let i = 3; i < src.px.length; i += 4) if (src.px[i] < 8) clear++
console.log(`${src.w}x${src.h} · 투명 픽셀 ${(clear / (src.w * src.h) * 100).toFixed(1)}%`)
const dw = Number(wS), dh = Math.round(src.h * dw / src.w)
const px = boxResize(src, 0, 0, src.w, src.h, dw, dh)
for (let i = 0; i < px.length; i += 4) {
  const a = px[i + 3] / 255
  const x = (i / 4) % dw, y = Math.floor(i / 4 / dw)
  const bg = ((x >> 4) + (y >> 4)) % 2 === 0 ? 120 : 140
  for (let k = 0; k < 3; k++) px[i + k] = Math.round(px[i + k] * a + bg * (1 - a))
  px[i + 3] = 255
}
writeFileSync(out, encodePng(dw, dh, px))
