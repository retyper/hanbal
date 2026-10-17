/**
 * 잘라 낸 칸에서 옆 칸의 부스러기를 지운다 — 2026-10-17
 *
 * slice-grid 의 fit 은 물건을 가운데 두고 **정사각으로** 자르므로, 물건이 칸을 꽉 채우면
 * 옆 칸 그림의 끄트머리(꼬리·물결·발)가 가장자리에 묻어 온다. 그런데 그림 모델이 둘레에 칠한
 * **희미한 빛**이 그 부스러기와 본체를 이어 버려서 알파 > 0 으로는 한 덩어리로 보인다.
 * 그래서
 *   1. **단단한 알파**(solid 이상)로만 이어진 덩어리를 찾고,
 *   2. 가장자리 띠에 걸친 작은 덩어리는 버리고, 남은 덩어리들의 상자를 잡아,
 *   3. 그 상자(+ 빛 여백 pad) **밖**은 전부 투명하게 한다.
 * 물건 자체가 가장자리에 닿는 것(하늘에서 내려오는 끈 등)은 크기가 커서 남는다.
 *
 *   node tools/keep-main.mjs <png...> [--ratio=0.25] [--margin=0.1] [--solid=96] [--pad=0.03]
 *     ratio   가장 큰 덩어리의 몇 배보다 작으면 버리는가
 *     margin  가장자리 띠의 두께 (변의 비율)
 *     solid   덩어리로 칠 알파의 문턱
 *     pad     남길 상자 둘레의 빛 여백 (변의 비율)
 * 파일을 제자리에서 고친다.
 */
import { writeFileSync } from 'node:fs'
import { decodePng, encodePng } from './png.mjs'

const args = process.argv.slice(2)
const opt = (name, def) => {
  const a = args.find((s) => s.startsWith(`--${name}=`))
  return a ? Number(a.slice(name.length + 3)) : def
}
const RATIO = opt('ratio', 0.25)
const MARGIN = opt('margin', 0.1)
const SOLID = opt('solid', 96)
const PAD = opt('pad', 0.03)
const files = args.filter((a) => !a.startsWith('--'))
if (files.length === 0) throw new Error('쓰는 법은 이 파일 머리말에 있다')

for (const file of files) {
  const { w, h, px } = decodePng(file)
  const MX = Math.ceil(w * MARGIN)
  const MY = Math.ceil(h * MARGIN)
  const label = new Int32Array(w * h).fill(-1)
  const comps = []
  for (let s = 0; s < w * h; s++) {
    if (label[s] !== -1 || px[s * 4 + 3] < SOLID) continue
    const c = { size: 0, edge: false, x0: w, y0: h, x1: -1, y1: -1 }
    const stack = [s]
    label[s] = comps.length
    while (stack.length) {
      const p = stack.pop()
      const x = p % w
      const y = (p - x) / w
      c.size++
      if (x < c.x0) c.x0 = x
      if (y < c.y0) c.y0 = y
      if (x > c.x1) c.x1 = x
      if (y > c.y1) c.y1 = y
      if (x < MX || y < MY || x >= w - MX || y >= h - MY) c.edge = true
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx
        const ny = y + dy
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
        const q = ny * w + nx
        if (label[q] === -1 && px[q * 4 + 3] >= SOLID) {
          label[q] = comps.length
          stack.push(q)
        }
      }
    }
    comps.push(c)
  }
  const biggest = Math.max(0, ...comps.map((c) => c.size))
  const kept = comps.filter((c) => !c.edge || c.size >= biggest * RATIO)
  if (kept.length === 0) {
    console.log(`${file}: 단단한 덩어리가 없다 — 그대로 둔다`)
    continue
  }
  const pad = Math.ceil(Math.max(w, h) * PAD)
  const bx0 = Math.max(0, Math.min(...kept.map((c) => c.x0)) - pad)
  const by0 = Math.max(0, Math.min(...kept.map((c) => c.y0)) - pad)
  const bx1 = Math.min(w - 1, Math.max(...kept.map((c) => c.x1)) + pad)
  const by1 = Math.min(h - 1, Math.max(...kept.map((c) => c.y1)) + pad)
  const keptIds = new Set(kept.map((c) => comps.indexOf(c)))
  let wiped = 0
  for (let p = 0; p < w * h; p++) {
    const x = p % w
    const y = (p - x) / w
    const outside = x < bx0 || y < by0 || x > bx1 || y > by1
    const dropped = label[p] !== -1 && !keptIds.has(label[p])
    if ((outside || dropped) && px[p * 4 + 3] > 0) {
      px[p * 4 + 3] = 0
      wiped++
    }
  }
  writeFileSync(file, encodePng(w, h, px))
  console.log(`${file}: 덩어리 ${comps.length} · 남김 ${kept.length} · 지움 ${wiped}px`)
}
