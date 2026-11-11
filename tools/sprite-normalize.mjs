/**
 * 스프라이트 띠를 한 규격으로 — public/realm/anim2 (원본 · 건드리지 않는다) → public/realm/anim-px (도트 규격) + manifest.json + src/realm/data/spritePx.ts
 * 규격은 tools/sprite-spec.mjs (설명은 docs/realm/SPRITE-AUDIT.md 맨 위). 먼저 node tools/sprite-audit.mjs 로 docs/realm/sprite-audit.json 을 만든다.
 * 쓰는 법: node tools/sprite-normalize.mjs [이름...]   (이름 없으면 전부) · 점검 그림은 D:/tmp-node/spx/
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { decodePng, encodePng } from './png.mjs'
import { SPEC } from './sprite-spec.mjs'
import { listStrips } from './sprite-audit.mjs'
import { cleanStrip } from './sprite-clean.mjs'
import { esrUpscale } from './sprite-esr.mjs'

const OUT_DIR = process.env.SPX_OUT ?? 'public/realm/anim-px'
const ESR = process.env.SPX_ESR !== '0' // 장수 띠를 Real-ESRGAN x2 로 또렷하게 한 뒤 줄인다 (캐시 D:/tmp-node/esr-cache)
const SHEET = process.env.SPX_SHEET ?? 'D:/tmp-node/spx'
const MOUNT = new Set(['gen-mount', 'gen-biryu', 'gen-geumha', 'gen-geota', 'gen-soebo'])
const audit = JSON.parse(readFileSync('docs/realm/sprite-audit.json', 'utf8'))
const only = new Set(process.argv.slice(2))

/** 상자(넓이) 평균으로 줄인 RGBA(곱한 알파) 칸 — 원본 칸의 (sx0..) 영역을 배율 s 로, 도착 칸 W×H 의 (ox, oy) 에 놓는다 */
function boxResample(img, cx0, cw, s, W, H, ox, oy) {
  const out = new Float32Array(W * H * 4)
  for (let dy = 0; dy < H; dy++) {
    const y0 = (dy - oy) / s, y1 = (dy + 1 - oy) / s
    for (let dx = 0; dx < W; dx++) {
      const x0 = (dx - ox) / s, x1 = (dx + 1 - ox) / s
      let r = 0, g = 0, b = 0, a = 0, wt = 0
      const ya = Math.max(0, Math.floor(y0)), yb = Math.min(img.h - 1, Math.ceil(y1) - 1)
      const xa = Math.floor(x0), xb = Math.ceil(x1) - 1
      for (let y = ya; y <= yb; y++) {
        const wy = Math.min(y + 1, y1) - Math.max(y, y0)
        for (let x = xa; x <= xb; x++) {
          const wx = Math.min(x + 1, x1) - Math.max(x, x0)
          const w = wx * wy
          wt += w
          if (x < 0 || x >= cw) continue
          const i = (y * img.w + cx0 + x) * 4
          const al = img.px[i + 3] / 255
          r += img.px[i] * al * w; g += img.px[i + 1] * al * w; b += img.px[i + 2] * al * w; a += al * w
        }
      }
      const o = (dy * W + dx) * 4
      // 칸 밖(원본 위·아래 바깥)도 넓이에 넣어 가장자리는 투명으로 줄어든다
      const area = (x1 - x0) * (y1 - y0)
      out[o] = r / area; out[o + 1] = g / area; out[o + 2] = b / area; out[o + 3] = a / area
      void wt
    }
  }
  return out
}

/** 중간값 자르기 + 몇 번 가다듬기 → 색 n 개 (곱하지 않은 RGB · 개수 가중) */
function palette(pixels, n) {
  const map = new Map()
  for (const p of pixels) map.set(p, (map.get(p) ?? 0) + 1)
  let boxes = [[...map.entries()].map(([k, c]) => ({ r: k >> 16, g: (k >> 8) & 255, b: k & 255, c }))]
  while (boxes.length < n) {
    let bi = -1, bs = 0
    boxes.forEach((bx, i) => {
      if (bx.length < 2) return
      const ex = ['r', 'g', 'b'].map((ch) => Math.max(...bx.map((p) => p[ch])) - Math.min(...bx.map((p) => p[ch])))
      const score = Math.max(...ex) * Math.sqrt(bx.reduce((s, p) => s + p.c, 0))
      if (score > bs) { bs = score; bi = i }
    })
    if (bi < 0) break
    const bx = boxes[bi]
    const ex = ['r', 'g', 'b'].map((ch) => Math.max(...bx.map((p) => p[ch])) - Math.min(...bx.map((p) => p[ch])))
    const ch = ['r', 'g', 'b'][ex.indexOf(Math.max(...ex))]
    bx.sort((p, q) => p[ch] - q[ch])
    const half = bx.reduce((s, p) => s + p.c, 0) / 2
    let acc = 0, cut = 0
    while (cut < bx.length - 1 && acc + bx[cut].c < half) { acc += bx[cut].c; cut++ }
    cut = Math.max(1, cut)
    boxes.splice(bi, 1, bx.slice(0, cut), bx.slice(cut))
  }
  let pal = boxes.map((bx) => { const t = bx.reduce((s, p) => s + p.c, 0); return [bx.reduce((s, p) => s + p.r * p.c, 0) / t, bx.reduce((s, p) => s + p.g * p.c, 0) / t, bx.reduce((s, p) => s + p.b * p.c, 0) / t] })
  const items = [...map.entries()].map(([k, c]) => [k >> 16, (k >> 8) & 255, k & 255, c])
  for (let it = 0; it < 4; it++) { // 가다듬기 (k-means)
    const acc = pal.map(() => [0, 0, 0, 0])
    for (const [r, g, b, c] of items) {
      let bi = 0, bd = 1e9
      pal.forEach((q, i) => { const d = (q[0] - r) ** 2 + (q[1] - g) ** 2 + (q[2] - b) ** 2; if (d < bd) { bd = d; bi = i } })
      acc[bi][0] += r * c; acc[bi][1] += g * c; acc[bi][2] += b * c; acc[bi][3] += c
    }
    pal = pal.map((q, i) => acc[i][3] ? [acc[i][0] / acc[i][3], acc[i][1] / acc[i][3], acc[i][2] / acc[i][3]] : q)
  }
  return pal.map((q) => q.map((v) => Math.round(v)))
}

/** 한 띠 변환. plan: { cells, cw(원본 칸 가로), s(배율), W, H, ox(원본 칸 중심이 칸 가운데로), footY(원본 발 줄 y), pad } */
function convert(img, plan) {
  const { cells, cw, s, W, H, pad, feetSrc } = plan
  const oy = H - pad - (feetSrc + 1) * s // 원본 발바닥 아래 줄이 칸 아래에서 pad 위에 오게
  const ox = W / 2 - (cw / 2) * s
  const sheet = new Uint8Array(W * cells * H * 4)
  const cols = []
  const rgba = []
  for (let i = 0; i < cells; i++) {
    const cx0 = Math.round(i * cw), cwi = Math.round((i + 1) * cw) - cx0
    const f = boxResample(img, cx0, cwi, s, W, H, W / 2 - (cwi / 2) * s, oy)
    void ox
    rgba.push(f)
    for (let k = 0; k < W * H; k++) if (f[k * 4 + 3] >= SPEC.alphaCut) {
      const a = f[k * 4 + 3]
      cols.push((Math.min(255, Math.round(f[k * 4] / a)) << 16) | (Math.min(255, Math.round(f[k * 4 + 1] / a)) << 8) | Math.min(255, Math.round(f[k * 4 + 2] / a)))
    }
  }
  const pal = palette(cols, SPEC.colors)
  const near = (r, g, b) => { let bi = 0, bd = 1e9; for (let i = 0; i < pal.length; i++) { const d = (pal[i][0] - r) ** 2 + (pal[i][1] - g) ** 2 + (pal[i][2] - b) ** 2; if (d < bd) { bd = d; bi = i } } return pal[bi] }
  const used = new Set()
  for (let i = 0; i < cells; i++) {
    const f = rgba[i]
    const solid = new Uint8Array(W * H)
    for (let k = 0; k < W * H; k++) solid[k] = f[k * 4 + 3] >= SPEC.alphaCut ? 1 : 0
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const k = y * W + x
      if (!solid[k]) continue
      const a = f[k * 4 + 3]
      // 바깥 한 겹은 윤곽색 한 가지 · 안쪽은 팔레트 색
      const edge = !(x > 0 && solid[k - 1]) || !(x < W - 1 && solid[k + 1]) || !(y > 0 && solid[k - W]) || !(y < H - 1 && solid[k + W])
      const c = edge ? SPEC.outline : near(Math.min(255, Math.round(f[k * 4] / a)), Math.min(255, Math.round(f[k * 4 + 1] / a)), Math.min(255, Math.round(f[k * 4 + 2] / a)))
      const o = (y * W * cells + i * W + x) * 4
      sheet[o] = c[0]; sheet[o + 1] = c[1]; sheet[o + 2] = c[2]; sheet[o + 3] = 255
      used.add((c[0] << 16) | (c[1] << 8) | c[2])
    }
  }
  return { sheet, W: W * cells, colors: used.size }
}

/** 점검용: 칸 사이에 발 줄을 그은 확대 그림 (바탕 회색) */
function contact(sheet, W, H, cells, cell, name, zoom) {
  const cwid = cell
  const gap = 2
  const cols = Math.min(cells, 10), rows = Math.ceil(cells / cols)
  const OW = cols * (cwid * zoom + gap), OH = rows * (H * zoom + gap)
  const o = new Uint8Array(OW * OH * 4)
  for (let i = 0; i < o.length; i += 4) { o[i] = 70; o[i + 1] = 84; o[i + 2] = 70; o[i + 3] = 255 }
  for (let c = 0; c < cells; c++) {
    const gx = (c % cols) * (cwid * zoom + gap), gy = Math.floor(c / cols) * (H * zoom + gap)
    for (let y = 0; y < H * zoom; y++) for (let x = 0; x < cwid * zoom; x++) {
      const sx = c * cwid + Math.floor(x / zoom), sy = Math.floor(y / zoom)
      const si = (sy * W + sx) * 4
      if (sheet[si + 3] > 0) { const di = ((gy + y) * OW + gx + x) * 4; o[di] = sheet[si]; o[di + 1] = sheet[si + 1]; o[di + 2] = sheet[si + 2]; o[di + 3] = 255 }
    }
  }
  writeFileSync(`${SHEET}/${name}.png`, encodePng(OW, OH, o))
}

mkdirSync(OUT_DIR, { recursive: true })
mkdirSync(SHEET, { recursive: true })
const manifest = {}
const cleanLog = {}
let totalBytes = 0
for (const [file, kind] of listStrips()) {
  const name = file.split('/').pop().replace('.png', '')
  const key = kind === 'crowd' ? `crowd-${name}` : name
  if (only.size && !only.has(key) && !only.has(name)) continue
  const a = audit.find((r) => r.name === name && r.kind === kind)
  // 누끼 정리 먼저: 옅은 후광 · fringe · 떠 있는 부스러기 (기록은 docs/realm/sprite-clean-log.json)
  const cleaned = cleanStrip(decodePng(file), a.cells)
  const img = cleaned.img
  cleanLog[key] = cleaned.log
  const cw = img.w / a.cells
  let plan
  if (kind === 'general') {
    const s0 = (MOUNT.has(name) ? SPEC.gen.mountBody : SPEC.gen.body) / a.bodyPx
    // 전 컷이 들어가는 가로 (칸 가운데 기준 좌우 최대)
    let half = 0
    for (let i = 0; i < a.cells; i++) {
      const x0 = Math.round(i * cw), x1 = Math.round((i + 1) * cw)
      for (let y = 0; y < img.h; y++) for (let x = x0; x < x1; x++) if (img.px[(y * img.w + x) * 4 + 3] > 40) half = Math.max(half, Math.abs(x - x0 + 0.5 - (x1 - x0) / 2))
    }
    // 칼을 치켜든 컷까지 칸 위에 안 잘리게: 가장 높이 솟은 컷이 칸에 들어가는 배율을 넘지 않는다
    let top = img.h
    for (let y = 0; y < img.h && top === img.h; y++) for (let x = 0; x < img.w; x++) if (img.px[(y * img.w + x) * 4 + 3] > 40) { top = y; break }
    const s = Math.min(s0, (SPEC.gen.h - SPEC.gen.pad) / (a.feet + 1 - top))
    const W = Math.max(SPEC.gen.minW, Math.ceil((half * 2 * s + SPEC.gen.margin * 2) / SPEC.gen.wRound) * SPEC.gen.wRound)
    plan = { cells: a.cells, cw, s, W, H: SPEC.gen.h, pad: SPEC.gen.pad, feetSrc: a.feet }
  } else if (kind === 'crowd') {
    const s = SPEC.crowd.h / img.h
    plan = { cells: 1, cw, s, W: Math.round(img.w * s), H: SPEC.crowd.h, pad: SPEC.crowd.pad, feetSrc: img.h - 1 }
  } else {
    const s = SPEC.sol.scale
    plan = { cells: a.cells, cw, s, W: Math.round(cw * s), H: Math.round(img.h * s), pad: SPEC.sol.pad, feetSrc: a.feet }
  }
  let src = img
  if (ESR && kind === 'general') { // x2 로 키워 가장자리를 되살린 뒤 상자 평균으로 줄인다 (배율 반, 칸·발 줄은 두 배)
    src = esrUpscale(img)
    plan = { ...plan, s: plan.s / 2, cw: plan.cw * 2, feetSrc: (plan.feetSrc + 1) * 2 - 1 }
  }
  const { sheet, W, colors } = convert(src, plan)
  const outName = kind === 'crowd' ? `crowd/${name}.png` : `${name}.png`
  if (kind === 'crowd') mkdirSync(`${OUT_DIR}/crowd`, { recursive: true })
  const png = encodePng(W, plan.H, sheet)
  writeFileSync(`${OUT_DIR}/${outName}`, png)
  totalBytes += png.length
  manifest[key] = { cell: [plan.W, plan.H], feet: plan.H - plan.pad, bodyPx: kind === 'general' ? Math.round(a.bodyPx * plan.s) : Math.round(a.bodyPx * plan.s), kind, cells: plan.cells, colors }
  contact(sheet, W, plan.H, plan.cells, plan.W, key, kind === 'crowd' ? 2 : 3)
}
// 도트 시험용 옛 띠(LPC)가 원본 이름과 겹치지 않은 것은 그대로 둔다 (gen-dalbit)
const prev = existsSync(`${OUT_DIR}/manifest.json`) ? JSON.parse(readFileSync(`${OUT_DIR}/manifest.json`, 'utf8')) : {}
const all = { ...prev, ...manifest }
if (!only.size && !all['gen-dalbit']) {
  const lp = decodePng(`${OUT_DIR}/gen-dalbit.png`)
  all['gen-dalbit'] = { cell: [lp.w / 20, lp.h], feet: lp.h, bodyPx: lp.h, kind: 'general', cells: 20, colors: 0 }
}
writeFileSync(`${OUT_DIR}/manifest.json`, JSON.stringify(all))
if (!only.size) writeFileSync('docs/realm/sprite-clean-log.json', JSON.stringify(cleanLog))
const ts = `/** public/realm/anim-px/manifest.json 의 사본 — tools/sprite-normalize.mjs 가 만든다 (손으로 고치지 말 것). 칸 [가로, 세로] · feet = 발 줄(칸 위에서 y) · bodyPx = 서 있는 몸 키 */\nexport const SPRITE_PX: Readonly<Record<string, { readonly cell: readonly [number, number]; readonly feet: number; readonly bodyPx: number; readonly kind: 'general' | 'soldier' | 'folk' | 'crowd'; readonly cells: number }>> = ${JSON.stringify(Object.fromEntries(Object.entries(all).map(([k, v]) => [k, { cell: v.cell, feet: v.feet, bodyPx: v.bodyPx, kind: v.kind, cells: v.cells }])))}\n`
writeFileSync('src/realm/data/spritePx.ts', ts)
console.log(`변환 ${Object.keys(manifest).length}개 · 새 PNG 합계 ${(totalBytes / 1e6).toFixed(1)}MB`)
