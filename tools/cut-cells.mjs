/**
 * 격자 한 장(자홍 바탕 · 흰 칸 선)을 칸마다 잘라 낱낱 투명 그림으로 — 겨루기 군사용 (2026-11-11)
 *   node tools/cut-cells.mjs <시트.png> <열> <행> <출력접두> [inset=8] [최대높이=360] [지울곳(마지막 칸 비율 x0,y0,x1,y1)]
 * 출력: <접두>1.png … (왼쪽 위부터 가로로)
 */
import { execFileSync } from 'node:child_process'
import { writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { decodePng, encodePng, boxResize } from './png.mjs'

const [file, colsS, rowsS, prefix, insetS = '8', maxHS = '360', blank = '', hardS = '45', softS = '40'] = process.argv.slice(2)
const cols = Number(colsS), rows = Number(rowsS), inset = Number(insetS), maxH = Number(maxHS)
const src = decodePng(file)
const cw = src.w / cols, ch = src.h / rows
const tmp = mkdtempSync(join(tmpdir(), 'cells-'))
let n = 0
for (let r = 0; r < rows; r++) {
  for (let c = 0; c < cols; c++) {
    n++
    const x0 = Math.round(c * cw) + inset, y0 = Math.round(r * ch) + inset
    const w = Math.round(cw) - inset * 2, h = Math.round(ch) - inset * 2
    const px = new Uint8Array(w * h * 4)
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const s = ((y0 + y) * src.w + x0 + x) * 4, d = (y * w + x) * 4
      for (let k = 0; k < 4; k++) px[d + k] = src.px[s + k]
    }
    const a = join(tmp, `c${n}.png`), b = join(tmp, `k${n}.png`)
    writeFileSync(a, encodePng(w, h, px))
    const box = n === cols * rows ? blank : ''
    execFileSync('node', [join(import.meta.dirname, 'key-png.mjs'), a, b, hardS, softS, box], { stdio: 'ignore' })
    const k = decodePng(b)
    let minX = k.w, minY = k.h, maxX = -1, maxY = -1
    for (let y = 0; y < k.h; y++) for (let x = 0; x < k.w; x++) if (k.px[(y * k.w + x) * 4 + 3] > 40) {
      if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y
    }
    const bw = maxX - minX + 1, bh = maxY - minY + 1
    const sc = Math.min(1, maxH / bh)
    const dw = Math.max(1, Math.round(bw * sc)), dh = Math.max(1, Math.round(bh * sc))
    const out = boxResize(k, minX, minY, bw, bh, dw, dh)
    writeFileSync(`${prefix}${n}.png`, encodePng(dw, dh, out))
    console.log(`${prefix}${n}.png ${dw}x${dh}`)
  }
}
