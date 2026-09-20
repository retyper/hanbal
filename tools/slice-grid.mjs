/**
 * 한 장에 격자로 받은 그림을 칸칸이 잘라낸다 (2026-09-20)
 *
 * 활 다섯(tools/slice-bows.mjs)과 같은 이유다 — **따로 받으면 화풍이 제각각이 된다.**
 * 같은 살통에 꽂히는 아홉 살이 붓질이 다르면 그게 제일 먼저 보인다. 그래서 한 장에 받아 자른다.
 *
 *   node tools/slice-grid.mjs <받은그림.png> <가로칸> <세로칸> <out접두> <id,id,...> [크기=192] [안쪽=0.03]
 *   예) node tools/slice-grid.mjs assets_src/arrows-source.png 3 3 public/sprites/arrow- \
 *         basic,burst,chain,split,scatter,rapid,homing,pierce,heavy
 *
 * id 는 **왼→오, 위→아래** 순서다. 건너뛸 칸은 '-' 로 적는다.
 * 끝에 **fit** 을 붙이면 격자를 믿지 않는다 (2026-09-20 두 번째 판). 그림 모델은 4x4 를 정확히
 * 등분하지 않는다 — 16칸을 받았더니 메달이 칸 아래로 쏠리고 옆 칸의 빛이 묻어왔다. fit 은
 *   1. 칸 경계를 기대 자리 ±20% 안에서 **잉크가 가장 적은 줄**로 다시 찾고,
 *   2. 그 칸 안에서 **물건의 상자**를 찾아 가운데에 놓고 정사각으로 자른다 ('안쪽' 은 이때 물건 둘레의 여백).
 *
 * '안쪽' 은 칸 가장자리를 그만큼 깎는 비율이다 — 그림 모델은 격자를 1~2% 어긋나게 그리므로
 * 조금 깎아야 옆 칸의 빛이 안 묻어온다.
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { decodePng, encodePng, boxResize } from './png.mjs'

const [file, colsS, rowsS, prefix, idsS, outS = '192', insetS = '0.03', mode = ''] = process.argv.slice(2)
if (idsS === undefined) throw new Error('쓰는 법은 이 파일 머리말에 있다')
const cols = Number(colsS)
const rows = Number(rowsS)
const OUT = Number(outS)
const INSET = Number(insetS)
const ids = idsS.split(',')

const src = decodePng(file)
console.log(`읽었다: ${file} ${src.w}x${src.h} → ${cols}x${rows} 칸`)
mkdirSync(dirname(prefix + 'x'), { recursive: true })

const cw = src.w / cols
const ch = src.h / rows
const FIT = mode === 'fit'

// 바탕색 — 네 귀의 평균.
const px = (x, y) => (y * src.w + x) * 4
const BG = [0, 1, 2].map((k) =>
  Math.round([px(2, 2), px(src.w - 3, 2), px(2, src.h - 3), px(src.w - 3, src.h - 3)].reduce((t, i) => t + src.px[i + k], 0) / 4))
/** 바탕과 이만큼(세 채널 합) 다르면 '물건'이다. 두른 빛의 옅은 끝자락은 물건이 아니다. */
const INK = 110
const ink = (x, y) => {
  const i = px(x, y)
  return Math.abs(src.px[i] - BG[0]) + Math.abs(src.px[i + 1] - BG[1]) + Math.abs(src.px[i + 2] - BG[2]) >= INK
}

/** 기대 자리 at 둘레(±span)에서 잉크가 가장 적은 줄. horiz 면 가로줄(y), 아니면 세로줄(x) — [lo,hi) 구간만 센다. */
function gutter(at, span, horiz, lo, hi) {
  let best = Math.round(at)
  let bestN = Infinity
  for (let v = Math.round(at - span); v <= Math.round(at + span); v++) {
    let n = 0
    for (let u = lo; u < hi; u++) if (horiz ? ink(u, v) : ink(v, u)) n++
    // 같은 값이면 기대 자리에 가까운 쪽.
    if (n < bestN || (n === bestN && Math.abs(v - at) < Math.abs(best - at))) { best = v; bestN = n }
  }
  return best
}

const ys = [0]
for (let r = 1; r < rows; r++) ys.push(FIT ? gutter(r * ch, ch * 0.2, true, 0, src.w) : Math.round(r * ch))
ys.push(src.h)

for (let i = 0; i < ids.length; i++) {
  if (ids[i] === '-') continue
  const cx = i % cols
  const cy = Math.floor(i / cols)
  const name = `${prefix}${ids[i]}.png`
  let sx, sy, side
  if (!FIT) {
    // 칸을 정사각으로 깎는다 (짧은 변 기준, 가운데).
    side = Math.floor(Math.min(cw, ch) * (1 - INSET * 2))
    sx = Math.round(cx * cw + (cw - side) / 2)
    sy = Math.round(cy * ch + (ch - side) / 2)
  } else {
    const y0 = ys[cy]
    const y1 = ys[cy + 1]
    // 세로 경계는 **이 줄 안에서만** 찾는다 — 줄마다 물건의 폭이 다르다 (부적은 좁고 메달은 넓다).
    const x0 = cx === 0 ? 0 : gutter(cx * cw, cw * 0.2, false, y0, y1)
    const x1 = cx === cols - 1 ? src.w : gutter((cx + 1) * cw, cw * 0.2, false, y0, y1)
    let bx0 = x1, bx1 = x0, by0 = y1, by1 = y0
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      if (!ink(x, y)) continue
      if (x < bx0) bx0 = x
      if (x > bx1) bx1 = x
      if (y < by0) by0 = y
      if (y > by1) by1 = y
    }
    if (bx1 < bx0) throw new Error(`${ids[i]}: 칸이 비었다`)
    side = Math.round(Math.max(bx1 - bx0, by1 - by0) * (1 + INSET * 2))
    sx = Math.round((bx0 + bx1) / 2 - side / 2)
    sy = Math.round((by0 + by1) / 2 - side / 2)
    // 그림 밖으로 나가면 안으로 민다.
    sx = Math.max(0, Math.min(src.w - side, sx))
    sy = Math.max(0, Math.min(src.h - side, sy))
  }
  const buf = encodePng(OUT, OUT, boxResize(src, sx, sy, side, side, OUT, OUT))
  writeFileSync(name, buf)
  console.log(`  ${name} ${OUT}x${OUT} ← (${sx},${sy}) ${side}px  ${(buf.length / 1024).toFixed(1)}KB`)
}
console.log('\n잘랐다. 출처를 받은 폴더의 출처.txt 에 적을 것.')
