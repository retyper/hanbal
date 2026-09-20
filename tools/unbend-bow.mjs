/**
 * 휜 활 그림을 **곧게 편 띠**로 만든다 (2026-09-20)
 *
 * 형: **"활 이미지 에셋들도 만들고 리깅까지 해서 활시위 당길때 실제 구부러지듯하게 만들어줘."**
 *
 * 게임은 활의 곡선을 스스로 계산한다 (render/stickman.ts — 당기면 림이 젖혀지고 고자는 안 휜다). 그 곡선을 따라
 * 그림을 조각조각 돌려 붙이려면 그림은 **곧은 띠**여야 한다 (위 = 윗고자, 가운데 = 줌통, 아래 = 아랫고자).
 * 그런데 그림 모델은 "곧게 펴서 그려 달라"를 못 알아듣고 시위까지 걸린 휜 활을 준다 — 그래서 여기서 편다:
 *   줄(row)마다 **가장 넓게 이어진 불투명 구간**을 활대로 본다 (가는 시위는 1~3px 라 진다).
 *   그 구간의 가운데를 띠의 가운데에 맞춰 옮겨 적는다. 줄마다 그러면 휜 활이 곧게 선다.
 *
 *   node tools/unbend-bow.mjs <키로 따낸 시트.png> <가로칸> <out접두> <id,id,...> [띠폭=40] [높이=384]
 *   예) node tools/unbend-bow.mjs assets_src/bows-strip-keyed.png 5 public/sprites/bowstrip- practice,gakgung,longbow,recurve,compound
 */
import { writeFileSync } from 'node:fs'
import { decodePng, encodePng, boxResize } from './png.mjs'

const [file, colsS, prefix, idsS, wS = '40', hS = '384'] = process.argv.slice(2)
if (idsS === undefined) throw new Error('쓰는 법은 이 파일 머리말에 있다')
const cols = Number(colsS)
const OUT_W = Number(wS)
const OUT_H = Number(hS)
const ids = idsS.split(',')
const src = decodePng(file)
const A = (x, y) => src.px[(y * src.w + x) * 4 + 3]
const cw = src.w / cols

for (let c = 0; c < ids.length; c++) {
  if (ids[c] === '-') continue
  const x0 = Math.round(c * cw)
  const x1 = Math.round((c + 1) * cw)
  // 줄마다 가장 넓은 불투명 구간.
  const runs = []
  for (let y = 0; y < src.h; y++) {
    let best = null
    let start = -1
    for (let x = x0; x <= x1; x++) {
      const on = x < x1 && A(x, y) > 60
      if (on && start < 0) start = x
      if (!on && start >= 0) {
        if (best === null || x - start > best[1] - best[0]) best = [start, x]
        start = -1
      }
    }
    // 시위만 있는 줄(폭 3px 이하)은 활이 아니다.
    runs.push(best !== null && best[1] - best[0] > 3 ? best : null)
  }
  let top = runs.findIndex((r) => r !== null)
  let bot = runs.length - 1
  while (bot > top && runs[bot] === null) bot--
  if (top < 0) throw new Error(`${ids[c]}: 칸이 비었다`)
  const H = bot - top + 1
  // 띠의 폭 = 가장 넓은 줄 + 여유. 곧게 편 원본 해상도의 띠를 먼저 만든다.
  let widest = 0
  for (let y = top; y <= bot; y++) if (runs[y] !== null) widest = Math.max(widest, runs[y][1] - runs[y][0])
  const W = widest + 4
  const strip = { w: W, h: H, px: new Uint8Array(W * H * 4) }
  let prev = null
  for (let y = top; y <= bot; y++) {
    const r = runs[y] ?? prev
    if (r === null) continue
    prev = r
    const mid = (r[0] + r[1]) / 2
    for (let x = r[0]; x < r[1]; x++) {
      const dx = Math.round(x - mid + W / 2)
      if (dx < 0 || dx >= W) continue
      const s = (y * src.w + x) * 4
      const d = ((y - top) * W + dx) * 4
      for (let k = 0; k < 4; k++) strip.px[d + k] = src.px[s + k]
    }
  }
  const name = `${prefix}${ids[c]}.png`
  const buf = encodePng(OUT_W, OUT_H, boxResize(strip, 0, 0, W, H, OUT_W, OUT_H))
  writeFileSync(name, buf)
  console.log(`  ${name} ${OUT_W}x${OUT_H} ← 원본 띠 ${W}x${H}  ${(buf.length / 1024).toFixed(1)}KB`)
}
