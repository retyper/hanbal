/**
 * 격자가 아닌 시트를 조각별로 자른다 — 2026-10-18
 *
 * 그림 모델에게 "3x3 격자로"라고 시켜도 UI 묶음처럼 크기가 제각각인 물건은 격자를 안 지킨다.
 * 그래서 칸 대신 **알파 덩어리**로 자른다: 단단한 알파(solid 이상)로 이어진 덩어리를 찾고,
 * 가까운 덩어리끼리(gap 픽셀 안) 합친 뒤, 위→아래·왼→오 순서로 <out접두>NN.png 로 저장한다.
 * 작은 부스러기(min 픽셀 미만)는 버린다. 이름은 저장된 것을 눈으로 보고 붙인다.
 *
 *   node tools/split-parts.mjs <키 따낸 그림.png> <out접두> [min=2000] [gap=12] [solid=96] [pad=6]
 */
import { writeFileSync } from 'node:fs'
import { decodePng, encodePng } from './png.mjs'

const [file, prefix, minS = '2000', gapS = '12', solidS = '96', padS = '6'] = process.argv.slice(2)
if (prefix === undefined) throw new Error('쓰는 법은 이 파일 머리말에 있다')
const MIN = Number(minS)
const GAP = Number(gapS)
const SOLID = Number(solidS)
const PAD = Number(padS)

const { w, h, px } = decodePng(file)
const label = new Int32Array(w * h).fill(-1)
let boxes = []
for (let s = 0; s < w * h; s++) {
  if (label[s] !== -1 || px[s * 4 + 3] < SOLID) continue
  const b = { x0: w, y0: h, x1: -1, y1: -1, size: 0 }
  const stack = [s]
  label[s] = boxes.length
  while (stack.length) {
    const p = stack.pop()
    const x = p % w
    const y = (p - x) / w
    b.size++
    if (x < b.x0) b.x0 = x
    if (y < b.y0) b.y0 = y
    if (x > b.x1) b.x1 = x
    if (y > b.y1) b.y1 = y
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx
      const ny = y + dy
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
      const q = ny * w + nx
      if (label[q] === -1 && px[q * 4 + 3] >= SOLID) {
        label[q] = boxes.length
        stack.push(q)
      }
    }
  }
  boxes.push(b)
}
// 가까운 상자끼리 합친다 (술 · 매듭 · 떨어진 장식이 본체와 한 조각이 되게)
let merged = true
while (merged) {
  merged = false
  for (let i = 0; i < boxes.length && !merged; i++) for (let j = i + 1; j < boxes.length && !merged; j++) {
    const a = boxes[i]
    const b = boxes[j]
    if (a.x0 - GAP <= b.x1 && b.x0 - GAP <= a.x1 && a.y0 - GAP <= b.y1 && b.y0 - GAP <= a.y1) {
      boxes[i] = { x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1), size: a.size + b.size }
      boxes.splice(j, 1)
      merged = true
    }
  }
}
boxes = boxes.filter((b) => b.size >= MIN)
const rowH = h / 12
boxes.sort((a, b) => Math.round(a.y0 / rowH) - Math.round(b.y0 / rowH) || a.x0 - b.x0)
boxes.forEach((b, k) => {
  const x0 = Math.max(0, b.x0 - PAD)
  const y0 = Math.max(0, b.y0 - PAD)
  const x1 = Math.min(w - 1, b.x1 + PAD)
  const y1 = Math.min(h - 1, b.y1 + PAD)
  const cw = x1 - x0 + 1
  const ch = y1 - y0 + 1
  const out = new Uint8Array(cw * ch * 4)
  for (let y = 0; y < ch; y++) out.set(px.subarray(((y0 + y) * w + x0) * 4, ((y0 + y) * w + x1 + 1) * 4), y * cw * 4)
  const name = `${prefix}${String(k + 1).padStart(2, '0')}.png`
  writeFileSync(name, encodePng(cw, ch, out))
  console.log(`${name} ${cw}x${ch} ← (${x0},${y0})`)
})
