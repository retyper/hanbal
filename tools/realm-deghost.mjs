/**
 * 깃발의 동그라미 자국을 걷는다 (2026-10-19, realm-undisc 다음)
 *
 * realm-undisc 가 빨간 해를 천 빛으로 덮었지만 둥근 그늘(자국)이 남았다 — 여전히 "무늬 뒤의 동그라미"로 읽힌다
 * (형: "깃발들 이미지에 왜이렇게 일장기같이 만드냐"). 챗지피티로 다시 받을 때까지 그 자국을 천 빛으로 평평하게 편다.
 *
 * 방법: 천 빛 = 천 양옆(가장자리 띠 안쪽)의 가운데값. 무늬 뒤 가운데 판에서 천과 '조금만 다른' 칸(무늬의 먹·흰·금은 크게 다르다)을
 * 모아 동그라미를 맞추고, 그 안의 그런 칸을 천 빛으로 바꾼다. 결은 5×5 평균과의 차이만 옮겨 남긴다(낮은 주파수인 그늘만 지운다).
 * 원본은 assets_src/realm/raw-1019/emblem-ghost/ 에 둔다.
 *
 *   node tools/realm-deghost.mjs public/realm/icon [emblem-이름 …]
 */
import { readdirSync, writeFileSync, mkdirSync, existsSync, copyFileSync } from 'node:fs'
import { join } from 'node:path'
import { decodePng, encodePng } from './png.mjs'

const [dir, ...names] = process.argv.slice(2)
if (dir === undefined) throw new Error('쓰는 법은 이 파일 머리말에')
const files = names.length > 0 ? names.map((n) => `${n}.png`) : readdirSync(dir).filter((f) => /^emblem-.*\.png$/.test(f))
const keep = 'assets_src/realm/raw-1019/emblem-ghost'
mkdirSync(keep, { recursive: true })
const lum = (r, g, b) => 0.3 * r + 0.59 * g + 0.11 * b
const dist = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2])

for (const f of files.sort()) {
  const src = join(dir, f)
  const orig = join(keep, f)
  if (!existsSync(orig)) copyFileSync(src, orig)
  const { w, h, px } = decodePng(orig)
  const at = (x, y) => { const k = (y * w + x) * 4; return [px[k], px[k + 1], px[k + 2], px[k + 3]] }
  // 천 빛 — 천의 왼쪽·오른쪽 안쪽 띠 (무늬·동그라미가 닿지 않는 자리)
  const samp = []
  for (let y = Math.floor(h * 0.3); y < h * 0.62; y++) {
    for (const x of [Math.floor(w * 0.29), Math.floor(w * 0.31), Math.floor(w * 0.69), Math.floor(w * 0.71)]) {
      const p = at(x, y)
      if (p[3] > 220) samp.push(p)
    }
  }
  const med = (i) => samp.map((p) => p[i]).sort((a, b) => a - b)[Math.floor(samp.length / 2)] ?? 128
  const cloth = [med(0), med(1), med(2)]
  const cl = lum(...cloth)
  // 동그라미 후보 — 가운데 판에서 천과 조금 다른 칸
  const near = (p) => { const d = dist(p, cloth); return p[3] > 200 && d >= 14 && d <= Number(process.env.DEGHOST_DMAX ?? 95) && Math.abs(lum(p[0], p[1], p[2]) - cl) < 70 }
  let sx = 0, sy = 0, n = 0
  const cand = []
  for (let y = Math.floor(h * 0.12); y < h * 0.78; y++) for (let x = Math.floor(w * 0.3); x < w * 0.7; x++) {
    if (near(at(x, y))) { sx += x; sy += y; n++; cand.push([x, y]) }
  }
  if (n < w * h * 0.03) { console.log(`${f}: 자국 없음 (${n})`); continue }
  const cx = sx / n, cy = sy / n
  const rr = cand.map(([x, y]) => Math.hypot(x - cx, y - cy)).sort((a, b) => a - b)
  const R = Math.min(w * Number(process.env.DEGHOST_RMAX ?? 0.3), rr[Math.floor(rr.length * 0.9)] + 2 + Number(process.env.DEGHOST_PAD ?? 0))
  // 밝기 5×5 평균 — 결만 남기려고
  const L = new Float32Array(w * h)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const p = at(x, y); L[y * w + x] = lum(p[0], p[1], p[2]) }
  const mean = (x, y) => { let s = 0, c = 0; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= w || Y >= h) continue; s += L[Y * w + X]; c++ } return s / c }
  const out = Uint8Array.from(px)
  let changed = 0
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (Math.hypot(x - cx, y - cy) > R) continue
    // 천 안쪽만 — 장대·깃털·테두리는 건드리지 않는다
    if (x < w * 0.25 || x > w * 0.75 || y < h * 0.13) continue
    const p = at(x, y)
    if (!near(p) && !(p[3] > 200 && dist(p, cloth) < 14)) continue
    const grain = (L[y * w + x] - mean(x, y)) * Number(process.env.DEGHOST_GRAIN ?? 0.25)
    const k = (y * w + x) * 4
    for (let c = 0; c < 3; c++) out[k + c] = Math.max(0, Math.min(255, Math.round(cloth[c] + grain)))
    changed++
  }
  writeFileSync(src, encodePng(w, h, out))
  console.log(`${f}: 천 rgb(${cloth.join(',')}) · 동그라미 반지름 ${R.toFixed(1)} · ${changed} 칸`)
}
