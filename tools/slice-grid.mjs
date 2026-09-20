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
 * '안쪽' 은 칸 가장자리를 그만큼 깎는 비율이다 — 그림 모델은 격자를 1~2% 어긋나게 그리므로
 * 조금 깎아야 옆 칸의 빛이 안 묻어온다.
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { decodePng, encodePng, boxResize } from './png.mjs'

const [file, colsS, rowsS, prefix, idsS, outS = '192', insetS = '0.03'] = process.argv.slice(2)
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
for (let i = 0; i < ids.length; i++) {
  if (ids[i] === '-') continue
  const cx = i % cols
  const cy = Math.floor(i / cols)
  // 칸을 정사각으로 깎는다 (짧은 변 기준, 가운데).
  const side = Math.floor(Math.min(cw, ch) * (1 - INSET * 2))
  const sx = Math.round(cx * cw + (cw - side) / 2)
  const sy = Math.round(cy * ch + (ch - side) / 2)
  const name = `${prefix}${ids[i]}.png`
  const buf = encodePng(OUT, OUT, boxResize(src, sx, sy, side, side, OUT, OUT))
  writeFileSync(name, buf)
  console.log(`  ${name} ${OUT}x${OUT} ← (${sx},${sy}) ${side}px  ${(buf.length / 1024).toFixed(1)}KB`)
}
console.log('\n잘랐다. 출처를 받은 폴더의 출처.txt 에 적을 것.')
