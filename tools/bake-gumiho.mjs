/**
 * 구미호(숲 산길 거대 보스) 그림 굽기 — Codex 72 자세 두 장(2×2 네 자세)과 꼬리 아홉을 판에 쓸 크기로 (11-22).
 *
 *   node tools/bake-gumiho.mjs [나갈 폴더 = public/realm/raid/giants/gumiho]
 *
 * 원본: D:/에셋창고/codex72/boss_gumiho_human.png · boss_gumiho_half-fox.png (2×2 · 오른쪽을 본다)
 *       D:/에셋창고/codex67/boss_gumiho_tail-01~09.png (꼬리 3 만 codex72 것 · codex67 의 3 은 빛무리가 끼었다)
 * 하는 일 (라이브러리 없이 · tools/png.mjs):
 *  - 알파 floor 아래를 걷는다 · 연결 덩어리로 네 자세를 가른다(덩어리 무게중심이 든 칸 · 칸마다 가장 큰 덩어리 하나) · 잔티는 지운다
 *  - 투명 여백을 잘라 pad px 만 남긴다 · 상자 평균으로 factor 배 줄인다 (알파 곱 평균 · 가장자리 색 번짐 없음)
 *  - 자세는 여덟 장 모두 같은 factor (원본 1px 이 같은 크기) · 발 자리 = 맨 아래 띠의 불투명 가로 가운데
 * 마지막에 { crop: 원본에서 잘라 낸 자리 [x, y, w, h] · size: 구운 크기 · feet: 구운 그림의 발 자리 } 를 찍는다 —
 * src/raid/gumiho-art.ts 의 GUMIHO_SOURCE 에 그대로 옮긴다.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { decodePng, encodePng } from './png.mjs'

const OUT = process.argv[2] ?? 'public/realm/raid/giants/gumiho'
const SHEETS = { woman: 'D:/에셋창고/codex72/boss_gumiho_human.png', fox: 'D:/에셋창고/codex72/boss_gumiho_half-fox.png' }
const TAILS = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => i === 3 ? 'D:/에셋창고/codex72/boss_gumiho_tail-03.png' : `D:/에셋창고/codex67/boss_gumiho_tail-0${i}.png`)
/** 자세 · 꼬리 줄이는 몫 · 알파 floor · 여백 */
const POSE_FACTOR = 0.8, TAIL_FACTOR = 0.3, FLOOR = 24, PAD = 4

/** 알파 > floor 여덟 이웃 덩어리 → { label, comps[{ n, x0, y0, x1, y1, cx, cy }] } */
function components(w, h, px) {
  const label = new Int32Array(w * h).fill(-1), comps = [], stack = []
  for (let i = 0; i < w * h; i++) {
    if (label[i] !== -1 || px[i * 4 + 3] === 0) continue
    const id = comps.length; let n = 0, x0 = w, y0 = h, x1 = -1, y1 = -1, sx = 0, sy = 0
    label[i] = id; stack.push(i)
    while (stack.length) {
      const j = stack.pop(); n++
      const x = j % w, y = (j - x) / w
      sx += x; sy += y; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
        const k = ny * w + nx
        if (label[k] === -1 && px[k * 4 + 3] > 0) { label[k] = id; stack.push(k) }
      }
    }
    comps.push({ n, x0, y0, x1, y1, cx: sx / n, cy: sy / n })
  }
  return { label, comps }
}
/** 상자 평균 축소 — 알파 곱 평균 (투명 칸 색이 묻지 않는다) */
function shrink(w, h, px, sx, sy, sw, sh, factor) {
  const dw = Math.max(1, Math.round(sw * factor)), dh = Math.max(1, Math.round(sh * factor)), out = new Uint8Array(dw * dh * 4)
  for (let y = 0; y < dh; y++) {
    const y0 = sy + (y * sh) / dh, y1 = sy + ((y + 1) * sh) / dh
    for (let x = 0; x < dw; x++) {
      const x0 = sx + (x * sw) / dw, x1 = sx + ((x + 1) * sw) / dw
      let r = 0, g = 0, b = 0, a = 0, area = 0
      for (let yy = Math.floor(y0); yy < Math.ceil(y1); yy++) {
        const wy = Math.min(yy + 1, y1) - Math.max(yy, y0)
        if (wy <= 0 || yy < 0 || yy >= h) continue
        for (let xx = Math.floor(x0); xx < Math.ceil(x1); xx++) {
          const wx = Math.min(xx + 1, x1) - Math.max(xx, x0)
          if (wx <= 0 || xx < 0 || xx >= w) continue
          const k = wx * wy, i = (yy * w + xx) * 4, al = px[i + 3] * k
          r += px[i] * al; g += px[i + 1] * al; b += px[i + 2] * al; a += al; area += k
        }
      }
      const o = (y * dw + x) * 4
      if (a > 0) { out[o] = Math.round(r / a); out[o + 1] = Math.round(g / a); out[o + 2] = Math.round(b / a) }
      out[o + 3] = area > 0 ? Math.round(a / area) : 0
    }
  }
  for (let i = 0; i < dw * dh; i++) if (out[i * 4 + 3] === 0) out[i * 4] = out[i * 4 + 1] = out[i * 4 + 2] = 0
  return { dw, dh, out }
}
/** 한 덩어리(keep 라벨)만 남긴 그림을 잘라 줄인다 → 구운 그림과 자리 */
function bake(name, w, h, px, label, keep, factor) {
  let x0 = w, y0 = h, x1 = -1, y1 = -1
  const own = new Uint8Array(px.length)
  for (let i = 0; i < w * h; i++) {
    if (!keep.has(label[i])) continue
    own.set(px.subarray(i * 4, i * 4 + 4), i * 4)
    const x = i % w, y = (i - x) / w
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y
  }
  x0 = Math.max(0, x0 - PAD); y0 = Math.max(0, y0 - PAD); x1 = Math.min(w - 1, x1 + PAD); y1 = Math.min(h - 1, y1 + PAD)
  const crop = [x0, y0, x1 - x0 + 1, y1 - y0 + 1], { dw, dh, out } = shrink(w, h, own, crop[0], crop[1], crop[2], crop[3], factor)
  writeFileSync(join(OUT, `${name}.png`), encodePng(dw, dh, out))
  return { crop, size: [dw, dh], out, dw, dh }
}
/** 발 자리: 맨 아래 band 몫 띠에서 불투명(알파 > 128) 칸의 가로 가운데 · 세로는 그 띠의 맨 아래 */
function feetOf(dw, dh, out, band = 0.04) {
  let bottom = -1
  for (let y = dh - 1; y >= 0 && bottom < 0; y--) for (let x = 0; x < dw; x++) if (out[(y * dw + x) * 4 + 3] > 128) { bottom = y; break }
  const top = Math.floor(bottom - dh * band)
  let left = dw, right = -1
  for (let y = top; y <= bottom; y++) for (let x = 0; x < dw; x++) if (out[(y * dw + x) * 4 + 3] > 128) { if (x < left) left = x; if (x > right) right = x }
  return [Math.round((left + right) / 2), bottom]
}

mkdirSync(OUT, { recursive: true })
const meta = {}
for (const [form, file] of Object.entries(SHEETS)) {
  const { w, h, px } = decodePng(file)
  for (let i = 0; i < w * h; i++) if (px[i * 4 + 3] < FLOOR) px[i * 4 + 3] = 0
  const { label, comps } = components(w, h, px)
  // 칸(0 왼위 · 1 오른위 · 2 왼아래 · 3 오른아래)마다 무게중심이 든 가장 큰 덩어리 하나 — 나머지는 잔티
  for (let q = 0; q < 4; q++) {
    const inQ = comps.map((c, id) => ({ c, id })).filter(({ c }) => (c.cx >= w / 2 ? 1 : 0) === q % 2 && (c.cy >= h / 2 ? 1 : 0) === Math.floor(q / 2))
    inQ.sort((a, b) => b.c.n - a.c.n)
    const best = inQ[0]
    if (!best) throw new Error(`${form} 칸 ${q}: 자세 없음`)
    const b = bake(`${form}-${q}`, w, h, px, label, new Set([best.id]), POSE_FACTOR)
    const feet = feetOf(b.dw, b.dh, b.out), dropped = inQ.slice(1).reduce((n, x) => n + x.c.n, 0)
    meta[`${form}-${q}`] = { crop: b.crop, size: b.size, feet }
    console.error(`${form}-${q}: 원본 ${w}x${h} 칸 ${q} → crop ${b.crop.join(',')} → ${b.size.join('x')} · 발 ${feet.join(',')} (잔티 ${dropped}px)`)
  }
}
TAILS.forEach((file, i) => {
  const { w, h, px } = decodePng(file)
  for (let k = 0; k < w * h; k++) if (px[k * 4 + 3] < FLOOR) px[k * 4 + 3] = 0
  const { label, comps } = components(w, h, px)
  const big = comps.reduce((m, c) => Math.max(m, c.n), 0), keep = new Set(comps.map((c, id) => ({ c, id })).filter(({ c }) => c.n >= big * 0.01).map(({ id }) => id))
  const b = bake(`tail-${i + 1}`, w, h, px, label, keep, TAIL_FACTOR)
  meta[`tail-${i + 1}`] = { crop: b.crop, size: b.size }
  console.error(`tail-${i + 1}: 원본 ${w}x${h} → crop ${b.crop.join(',')} → ${b.size.join('x')}`)
})
console.log(JSON.stringify(meta))
