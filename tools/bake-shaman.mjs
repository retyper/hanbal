/**
 * 불의 무녀 장군(불타는 산성 거대 보스) 그림 굽기 — Codex 72 몸 2×2 판·팔 둘 · Codex 67 옷자락 둘·허리 장식을 판에 쓸 크기로 (11-22).
 *
 *   node tools/bake-shaman.mjs [Codex 72 폴더 = D:/에셋창고/codex72] [Codex 67 폴더 = D:/에셋창고/codex67] [나갈 폴더 = public/realm/raid/giants/shaman]
 *
 * 하는 일 (라이브러리 없이 · tools/png.mjs):
 *  - 몸 2×2 판을 이어진 덩어리(알파 > 0 · 여덟 이웃)로 넷으로 가른다 — 큰 덩어리 넷이 자세 넷(왼위 0 서기 · 오른위 1 방울 들기 · 왼아래 2 부채 내지르기 · 오른아래 3 낮은 자세)
 *    한 자세의 잘라 낸 자리에 들어온 이웃 자세의 픽셀은 지운다 · 잔티(큰 덩어리의 keep 몫보다 작은 것)도 지운다
 *  - 자세마다 불꽃 무늬(밝은 주황·노랑 픽셀)를 따로 떼어 반 크기 빛 그림(glow-N)으로 · 불꽃이 핀 자리 몇 곳(flame 점)을 원본 px 로 찍는다
 *  - 팔·옷자락·허리 장식은 알파 floor 아래를 걷고(허리 장식은 원본에 붉은 빛무리가 있다) 잘라 factor 배 줄인다 (알파 곱 평균 · 가장자리 색 번짐 없음)
 *  - 알파 0 칸의 색을 0 으로
 * 마지막에 조각마다 { crop: 원본에서 잘라 낸 자리 [x, y, w, h] · factor · size: 구운 크기 } 와 자세마다 flame 점을 찍는다 —
 * src/raid/shaman-art.ts 의 SHAMAN_SOURCE · SHAMAN_FLAMES 에 그대로 옮긴다 (관절 자리는 원본 px 로 적고 그리는 쪽이 바꾼다).
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { decodePng, encodePng } from './png.mjs'

const SRC72 = process.argv[2] ?? 'D:/에셋창고/codex72'
const SRC67 = process.argv[3] ?? 'D:/에셋창고/codex67'
const OUT = process.argv[4] ?? 'public/realm/raid/giants/shaman'
const PAD = 4
/** 따로 굽는 조각 — name: [폴더, 원본 이름, factor, alpha floor] */
const PIECES = {
  'fan-arm': [SRC72, 'fan-arm', 0.25, 24],
  'bell-arm': [SRC72, 'bell-arm', 0.25, 24],
  'robe-back': [SRC67, 'robe-left', 0.28, 24],
  'robe-front': [SRC67, 'robe-right', 0.28, 24],
  waist: [SRC67, 'waist-ornament', 0.17, 48],
}
/** 몸 판: 알파 floor · 빛 그림 factor · 불꽃 픽셀 (밝은 주황·노랑) · 불꽃 점을 모으는 칸 px · 자세마다 점 수 */
const BODY = { floor: 16, glow: 0.5, cell: 22, points: 26 }
const flamePx = (r, g, b, a) => a >= 160 && r >= 225 && g >= 120 && b <= 130 && r - b >= 120

/** 알파 > thr 여덟 이웃 덩어리 → { label, sizes } */
function label(w, h, px, thr) {
  const lab = new Int32Array(w * h).fill(-1), sizes = [], boxes = [], stack = []
  for (let i = 0; i < w * h; i++) {
    if (lab[i] !== -1 || px[i * 4 + 3] <= thr) continue
    const id = sizes.length; let n = 0, x0 = w, y0 = h, x1 = -1, y1 = -1
    lab[i] = id; stack.push(i)
    while (stack.length) {
      const j = stack.pop(); n++
      const x = j % w, y = (j - x) / w
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
        const k = ny * w + nx
        if (lab[k] === -1 && px[k * 4 + 3] > thr) { lab[k] = id; stack.push(k) }
      }
    }
    sizes.push(n); boxes.push([x0, y0, x1, y1])
  }
  return { lab, sizes, boxes }
}
/** 상자 평균 축소 — 알파 곱 평균 (투명 칸 색이 묻지 않는다) */
function shrink(w, px, sx, sy, sw, sh, factor) {
  const h = px.length / 4 / w, dw = Math.max(1, Math.round(sw * factor)), dh = Math.max(1, Math.round(sh * factor)), out = new Uint8Array(dw * dh * 4)
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
/** 알파가 있는 자리를 PAD 만큼 넓혀 자른 [x, y, w, h] */
function trim(w, h, px) {
  let x0 = w, y0 = h, x1 = -1, y1 = -1
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (px[(y * w + x) * 4 + 3] > 0) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y }
  x0 = Math.max(0, x0 - PAD); y0 = Math.max(0, y0 - PAD); x1 = Math.min(w - 1, x1 + PAD); y1 = Math.min(h - 1, y1 + PAD)
  return [x0, y0, x1 - x0 + 1, y1 - y0 + 1]
}

mkdirSync(OUT, { recursive: true })
const meta = {}, flames = []
// ── 몸 2×2 판 → 자세 넷 ──
{
  const { w, h, px } = decodePng(join(SRC72, 'boss_fire-shaman_body.png'))
  for (let i = 0; i < w * h; i++) if (px[i * 4 + 3] < BODY.floor) px[i * 4 + 3] = 0
  const { lab, sizes, boxes } = label(w, h, px, 0)
  const big = sizes.map((n, id) => ({ n, id })).sort((a, b) => b.n - a.n).slice(0, 4)
  if (big.length < 4 || big[3].n < big[0].n * 0.3) throw new Error(`몸 판에서 자세 넷을 못 찾았다: ${JSON.stringify(big)}`)
  // 차례: 위 줄(왼 → 오른) · 아래 줄(왼 → 오른)
  const centre = id => { const [x0, y0, x1, y1] = boxes[id]; return [(x0 + x1) / 2, (y0 + y1) / 2] }
  big.sort((a, b) => { const [ax, ay] = centre(a.id), [bx, by] = centre(b.id); return Math.abs(ay - by) > h / 4 ? ay - by : ax - bx })
  big.forEach(({ id }, key) => {
    const one = new Uint8Array(px.length)
    for (let i = 0; i < w * h; i++) if (lab[i] === id) for (let c = 0; c < 4; c++) one[i * 4 + c] = px[i * 4 + c]
    const crop = trim(w, h, one), { dw, dh, out } = shrink(w, one, crop[0], crop[1], crop[2], crop[3], 1)
    writeFileSync(join(OUT, `body-${key}.png`), encodePng(dw, dh, out))
    meta[`body-${key}`] = { crop, factor: 1, size: [dw, dh] }
    // 불꽃 무늬만 → 빛 그림 (자른 자리 그대로 · 반 크기)
    const glow = new Uint8Array(one.length), cells = new Map()
    for (let i = 0; i < w * h; i++) {
      const o = i * 4
      if (!flamePx(one[o], one[o + 1], one[o + 2], one[o + 3])) continue
      glow[o] = one[o]; glow[o + 1] = one[o + 1]; glow[o + 2] = one[o + 2]; glow[o + 3] = 255
      const x = i % w, y = (i - x) / w, k = `${Math.floor(x / BODY.cell)},${Math.floor(y / BODY.cell)}`, c = cells.get(k) ?? { n: 0, sx: 0, sy: 0, top: y }
      c.n++; c.sx += x; c.sy += y; c.top = Math.min(c.top, y); cells.set(k, c)
    }
    const g = shrink(w, glow, crop[0], crop[1], crop[2], crop[3], BODY.glow)
    writeFileSync(join(OUT, `glow-${key}.png`), encodePng(g.dw, g.dh, g.out))
    meta[`glow-${key}`] = { crop, factor: BODY.glow, size: [g.dw, g.dh] }
    // 불꽃이 핀 자리: 불꽃 픽셀이 많은 칸부터 · 칸 안 가운데 x · 위 끝 y (불은 위로 오른다)
    const pts = [...cells.values()].filter(c => c.n >= 8).sort((a, b) => b.n - a.n).slice(0, BODY.points).map(c => [Math.round(c.sx / c.n), Math.round((c.top + c.sy / c.n) / 2)])
    pts.sort((a, b) => a[0] - b[0] || a[1] - b[1])
    flames.push(pts.flat())
    console.error(`body-${key}: 덩어리 ${big[key].n}px → crop ${crop.join(',')} → ${dw}x${dh} · 불꽃 점 ${pts.length}`)
  })
}
// ── 팔·옷자락·허리 장식 ──
for (const [name, [dir, file, factor, floor]] of Object.entries(PIECES)) {
  const { w, h, px } = decodePng(join(dir, `boss_fire-shaman_${file}.png`))
  for (let i = 0; i < w * h; i++) if (px[i * 4 + 3] < floor) px[i * 4 + 3] = 0
  // 가장 큰 덩어리의 1% 보다 작은 잔티는 지운다
  const { lab, sizes } = label(w, h, px, 20), most = Math.max(0, ...sizes)
  let specks = 0
  for (let i = 0; i < w * h; i++) { const id = lab[i]; if (id >= 0 && sizes[id] < most * 0.01) { px[i * 4 + 3] = 0; specks++ } }
  const crop = trim(w, h, px), { dw, dh, out } = shrink(w, px, crop[0], crop[1], crop[2], crop[3], factor)
  writeFileSync(join(OUT, `${name}.png`), encodePng(dw, dh, out))
  meta[name] = { crop, factor, size: [dw, dh] }
  console.error(`${name}: ${w}x${h} → crop ${crop.join(',')} → ${dw}x${dh} (잔티 ${specks}px)`)
}
console.log(JSON.stringify({ meta, flames }))
