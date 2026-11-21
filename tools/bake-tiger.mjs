/**
 * 백두 대호(설원 고개 거대 보스) 부위 그림 굽기 — Codex 69 원본 열여섯 장을 판에 쓸 크기로 (11-22).
 *
 *   node tools/bake-tiger.mjs [원본 폴더 = D:/에셋창고/codex69] [나갈 폴더 = public/realm/raid/giants/tiger]
 *
 * 하는 일 (라이브러리 없이 · tools/png.mjs):
 *  - 알파 floor 아래를 걷는다(턱·꼬리 끝·화살 묶음은 원본에 옅은 빛무리가 있다) · 큰 덩어리에서 떨어진 잔티를 지운다
 *  - 투명 여백을 잘라 내고 pad px 만 남긴다 · 상자 평균으로 factor 배 줄인다(알파 곱 평균 · 가장자리 색 번짐 없음)
 *  - 먼 쪽(왼쪽) 다리 넷은 tint 로 조금 어둡고 푸르게 굽는다 (몸 뒤에 그려 깊이가 읽히게)
 *  - 알파 0 칸의 색을 0 으로 (보는 도구에서 빛무리가 보이지 않게)
 * 마지막에 조각마다 { crop: 원본에서 잘라 낸 자리 [x, y, w, h] · factor · size: 구운 크기 } 를 찍는다 —
 * src/raid/tiger-art.ts 의 TIGER_SOURCE 에 그대로 옮긴다 (관절 자리는 원본 px 로 적고 그리는 쪽이 바꾼다).
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { decodePng, encodePng } from './png.mjs'

const SRC = process.argv[2] ?? 'D:/에셋창고/codex69'
const OUT = process.argv[3] ?? 'public/realm/raid/giants/tiger'
const FAR = [0.74, 0.77, 0.86]
/** name: [원본 이름, factor, alpha floor, tint(곱하기 RGB) | null] */
const PIECES = {
  body: ['body', 0.6, 24, null],
  head: ['head', 0.5, 24, null],
  'head-roar': ['head-roar', 0.5, 24, null],
  jaw: ['jaw', 0.4, 48, null],
  neck: ['neck', 0.4, 24, null],
  'fore-near-upper': ['foreleg-right-upper', 0.34, 24, null],
  'fore-near-lower': ['foreleg-right-lower', 0.34, 24, null],
  'fore-far-upper': ['foreleg-left-upper', 0.34, 24, FAR],
  'fore-far-lower': ['foreleg-left-lower', 0.34, 24, FAR],
  'hind-near-upper': ['hindleg-right-upper', 0.34, 24, null],
  'hind-near-lower': ['hindleg-right-lower', 0.34, 24, null],
  'hind-far-upper': ['hindleg-left-upper', 0.34, 24, FAR],
  'hind-far-lower': ['hindleg-left-lower', 0.34, 24, FAR],
  'tail-seg': ['tail-seg', 0.34, 24, null],
  'tail-tip': ['tail-tip', 0.34, 48, null],
  arrows: ['arrows', 0.36, 56, null],
}
const PAD = 4

/** 알파 > 20 여덟 이웃 덩어리 — 가장 큰 것의 keep 몫보다 작은 덩어리는 지운다 */
function dropSpecks(w, h, px, keep = 0.01) {
  const label = new Int32Array(w * h).fill(-1), sizes = []
  const stack = []
  for (let i = 0; i < w * h; i++) {
    if (label[i] !== -1 || px[i * 4 + 3] <= 20) continue
    const id = sizes.length; let n = 0
    label[i] = id; stack.push(i)
    while (stack.length) {
      const j = stack.pop(); n++
      const x = j % w, y = (j - x) / w
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
        const k = ny * w + nx
        if (label[k] === -1 && px[k * 4 + 3] > 20) { label[k] = id; stack.push(k) }
      }
    }
    sizes.push(n)
  }
  const big = Math.max(0, ...sizes)
  let dropped = 0
  for (let i = 0; i < w * h; i++) {
    const id = label[i]
    if (id >= 0 && sizes[id] < big * keep) { px[i * 4 + 3] = 0; dropped++ }
  }
  return dropped
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
  return { dw, dh, out }
}

mkdirSync(OUT, { recursive: true })
const meta = {}
for (const [name, [file, factor, floor, tint]] of Object.entries(PIECES)) {
  const { w, h, px } = decodePng(join(SRC, `boss_sangun_${file}.png`))
  for (let i = 0; i < w * h; i++) if (px[i * 4 + 3] < floor) px[i * 4 + 3] = 0
  const specks = dropSpecks(w, h, px)
  let x0 = w, y0 = h, x1 = -1, y1 = -1
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (px[(y * w + x) * 4 + 3] > 0) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y }
  x0 = Math.max(0, x0 - PAD); y0 = Math.max(0, y0 - PAD); x1 = Math.min(w - 1, x1 + PAD); y1 = Math.min(h - 1, y1 + PAD)
  const crop = [x0, y0, x1 - x0 + 1, y1 - y0 + 1]
  const { dw, dh, out } = shrink(w, h, px, crop[0], crop[1], crop[2], crop[3], factor)
  for (let i = 0; i < dw * dh; i++) {
    const o = i * 4
    if (out[o + 3] === 0) { out[o] = out[o + 1] = out[o + 2] = 0; continue }
    if (tint) for (let c = 0; c < 3; c++) out[o + c] = Math.round(out[o + c] * tint[c])
  }
  writeFileSync(join(OUT, `${name}.png`), encodePng(dw, dh, out))
  meta[name] = { crop, factor, size: [dw, dh] }
  console.error(`${name}: ${w}x${h} → crop ${crop.join(',')} → ${dw}x${dh} (잔티 ${specks}px)`)
}
console.log(JSON.stringify(meta))
