/**
 * 활 다섯 자루를 한 장에서 잘라낸다 (2026-09-11)
 *
 * 형: **"활도 각각 이미지로 등록되어야해. 개떡같은 svg 말고. 선택할때만큼은 화려해야지."**
 *
 * 다섯을 따로 받으면 **화풍이 제각각이 된다** — 같은 걸이에 걸리는 물건인데 그림자 각도와
 * 붓질이 다르면 그게 제일 먼저 보인다. 그래서 한 장에 다섯을 나란히 받아(docs/ICON.md 의
 * 활 프롬프트) 여기서 **세로로 다섯 등분**한다. 한 붓에서 나온 다섯이라 걸이에서 한 벌로 읽힌다.
 *
 *   node tools/slice-bows.mjs <받은그림.png>
 *     → public/sprites/bow-practice.png · bow-gakgung.png · bow-longbow.png
 *       · bow-recurve.png · bow-compound.png
 *
 * 자를 자리는 **눈대중이 아니라 그림에서 찾는다**: 세로줄마다 '바탕이 아닌 픽셀'을 세어
 * 골짜기(빈 칸)를 찾고, 그 사이를 한 자루로 본다. 다섯 덩이가 안 나오면 그렇다고 말하고 멈춘다.
 *
 * 라이브러리는 안 쓴다 (A6). PNG 읽기·쓰기는 tools/bake-icon.mjs 와 같은 방식이다.
 */
import { deflateSync, inflateSync } from 'node:zlib'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'

// ─────────────────────────── PNG ───────────────────────────

function decodePng(file) {
  const buf = readFileSync(file)
  let at = 8
  let w = 0
  let h = 0
  let depth = 0
  let type = 0
  const idat = []
  while (at < buf.length) {
    const len = buf.readUInt32BE(at)
    const kind = buf.toString('latin1', at + 4, at + 8)
    const data = buf.subarray(at + 8, at + 8 + len)
    if (kind === 'IHDR') {
      w = data.readUInt32BE(0)
      h = data.readUInt32BE(4)
      depth = data[8]
      type = data[9]
      if (data[12] !== 0) throw new Error(`${file}: 인터레이스는 못 읽는다`)
    } else if (kind === 'IDAT') idat.push(data)
    else if (kind === 'IEND') break
    at += 12 + len
  }
  if (depth !== 8 || (type !== 2 && type !== 6)) throw new Error(`${file}: 8비트 RGB/RGBA 만 읽는다`)
  const bpp = type === 6 ? 4 : 3
  const raw = inflateSync(Buffer.concat(idat))
  const stride = w * bpp
  const out = new Uint8Array(w * h * 4)
  const line = new Uint8Array(stride)
  const prev = new Uint8Array(stride)
  let p = 0
  for (let y = 0; y < h; y++) {
    const f = raw[p++]
    for (let i = 0; i < stride; i++) {
      const x = raw[p + i]
      const a = i >= bpp ? line[i - bpp] : 0
      const b = prev[i]
      const c = i >= bpp ? prev[i - bpp] : 0
      let v
      if (f === 0) v = x
      else if (f === 1) v = x + a
      else if (f === 2) v = x + b
      else if (f === 3) v = x + ((a + b) >> 1)
      else if (f === 4) {
        const pp = a + b - c
        const pa = Math.abs(pp - a)
        const pb = Math.abs(pp - b)
        const pc = Math.abs(pp - c)
        v = x + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)
      } else throw new Error(`줄 ${y} 필터 ${f}`)
      line[i] = v & 0xff
    }
    p += stride
    for (let x = 0; x < w; x++) {
      const s = x * bpp
      const d = (y * w + x) * 4
      out[d] = line[s]
      out[d + 1] = line[s + 1]
      out[d + 2] = line[s + 2]
      out[d + 3] = bpp === 4 ? line[s + 3] : 255
    }
    prev.set(line)
  }
  return { w, h, px: out }
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()
const crc32 = (b) => {
  let c = 0xffffffff
  for (let i = 0; i < b.length; i++) c = CRC_TABLE[(c ^ b[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body), 0)
  return Buffer.concat([len, body, crc])
}
function encodePng(w, h, rgba) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  const raw = Buffer.alloc(h * (w * 4 + 1))
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0
    Buffer.from(rgba.subarray(y * w * 4, (y + 1) * w * 4)).copy(raw, y * (w * 4 + 1) + 1)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// ─────────────────────────── 자르기 ───────────────────────────

/** 걸이에 걸리는 순서 — game/bows.ts BOW_KINDS 와 같은 순서여야 한다. */
const IDS = ['practice', 'gakgung', 'longbow', 'recurve', 'compound']
/** 잘라낸 한 장의 크기 (px). 걸이 카드에서 쓰는 크기의 두 배쯤이면 충분하다. */
const OUT = 256
/** 바탕보다 이만큼 밝으면 '물건'으로 친다. */
const INK = 26
/**
 * 바탕을 **투명하게 딴다** (2026-09-11).
 *
 * 처음엔 잘라낸 그림을 어두운 네모째로 카드에 얹었다. 그랬더니 (1) 카드 색과 네모 색이 달라
 * 그림이 '붙여 놓은 사진'으로 보이고 (2) 활은 세로로 8:1 이라 네모 안에서 **깨알같이 작았다.**
 *
 * 이제 바탕과의 거리로 알파를 만든다. 활은 남고, 뒤의 금빛 후광은 **반투명하게** 남아
 * 카드 위에서 그대로 빛난다. 그러면 카드 안에서 그림을 비스듬히 세워 키울 수 있다
 * (ui/overlay.ts .wh-art). 회전해도 네모 모서리가 안 보이기 때문이다.
 */
const KEY_LO = 18
const KEY_HI = 96

const file = process.argv[2]
if (file === undefined) throw new Error('쓸 그림을 인자로 줘라: node tools/slice-bows.mjs <png>')
const src = decodePng(file)
console.log(`읽었다: ${file} ${src.w}x${src.h}`)

// 바탕색 — 네 귀의 평균. 그림마다 조금씩 다르므로 박아두지 않는다.
function at(x, y) {
  const i = (y * src.w + x) * 4
  return [src.px[i], src.px[i + 1], src.px[i + 2]]
}
const corners = [at(2, 2), at(src.w - 3, 2), at(2, src.h - 3), at(src.w - 3, src.h - 3)]
const BG = [0, 1, 2].map((k) => Math.round(corners.reduce((s, c) => s + c[k], 0) / corners.length))
console.log(`바탕색 ≈ rgb(${BG.join(',')})`)

/** 세로줄마다 '바탕이 아닌' 점 수. */
const col = new Int32Array(src.w)
for (let x = 0; x < src.w; x++) {
  let n = 0
  for (let y = 0; y < src.h; y++) {
    const [r, g, b] = at(x, y)
    if (Math.abs(r - BG[0]) + Math.abs(g - BG[1]) + Math.abs(b - BG[2]) > INK * 3) n++
  }
  col[x] = n
}
// 문턱 — 가장 진한 줄의 8%. 후광(빛 번짐)은 이 아래로 떨어진다.
const peak = col.reduce((m, v) => Math.max(m, v), 0)
const gate = Math.max(3, Math.round(peak * 0.08))
const bands = []
let start = -1
for (let x = 0; x < src.w; x++) {
  const on = col[x] >= gate
  if (on && start < 0) start = x
  if (!on && start >= 0) {
    if (x - start > src.w * 0.02) bands.push([start, x])
    start = -1
  }
}
if (start >= 0) bands.push([start, src.w])
console.log(`덩이 ${bands.length}개: ${bands.map(([a, b]) => `${a}~${b}`).join(' · ')}`)

if (bands.length !== IDS.length) {
  console.log(`\n✗ ${IDS.length}덩이가 나와야 하는데 ${bands.length}덩이다.`)
  console.log('  활이 서로 붙었거나 후광이 이어졌다 — 그림을 다시 받는 게 빠르다')
  console.log('  (프롬프트에 "evenly spaced, no overlap" 을 더 세게 적어라)')
  process.exit(1)
}

mkdirSync('public/sprites', { recursive: true })
for (let i = 0; i < bands.length; i++) {
  const [x0, x1] = bands[i]
  // ── 활은 **세로로 길다.** 정사각으로 따면 활이 잘리거나 옆 활이 딸려 온다 ──
  //    그래서 [덩이 폭 + 여백] × [전체 높이] 를 떼어, 정사각 칸 안에 **높이를 맞춰** 앉힌다.
  //    남는 좌우는 바탕색으로 채운다 — 걸이 카드가 정사각 자리를 주기 때문이다.
  const pad = Math.round(src.w * 0.012)
  const sx = Math.max(0, x0 - pad)
  const sw = Math.min(src.w - sx, x1 - x0 + pad * 2)
  const sh = src.h
  // 칸 안에서의 크기 — 높이를 꽉 채우고(여백 조금) 폭은 비율대로.
  const fit = 1
  const dh = Math.round(OUT * fit)
  const dw = Math.max(1, Math.round((dh * sw) / sh))
  const ox = Math.round((OUT - dw) / 2)
  const oy = Math.round((OUT - dh) / 2)

  // 바탕은 **투명**이다 (위 KEY_* 주석). 카드 색이 무엇이든 그 위에 얹힌다.
  const out = new Uint8Array(OUT * OUT * 4)
  for (let y = 0; y < dh; y++) {
    const ay0 = Math.floor((y * sh) / dh)
    const ay1 = Math.max(ay0 + 1, Math.floor(((y + 1) * sh) / dh))
    for (let x = 0; x < dw; x++) {
      const ax0 = sx + Math.floor((x * sw) / dw)
      const ax1 = Math.max(ax0 + 1, sx + Math.floor(((x + 1) * sw) / dw))
      let r = 0
      let g = 0
      let b = 0
      let n = 0
      for (let yy = ay0; yy < ay1; yy++) {
        for (let xx = ax0; xx < ax1; xx++) {
          const p2 = (yy * src.w + xx) * 4
          r += src.px[p2]
          g += src.px[p2 + 1]
          b += src.px[p2 + 2]
          n++
        }
      }
      const d = ((y + oy) * OUT + (x + ox)) * 4
      const rr = r / n
      const gg = g / n
      const bb = b / n
      // 바탕에서 멀수록 진하게 남는다 — 후광은 반투명으로 살아난다.
      const dist = Math.abs(rr - BG[0]) + Math.abs(gg - BG[1]) + Math.abs(bb - BG[2])
      const a = Math.max(0, Math.min(1, (dist - KEY_LO) / (KEY_HI - KEY_LO)))
      out[d] = Math.round(rr)
      out[d + 1] = Math.round(gg)
      out[d + 2] = Math.round(bb)
      out[d + 3] = Math.round(a * 255)
    }
  }
  const name = `public/sprites/bow-${IDS[i]}.png`
  writeFileSync(name, encodePng(OUT, OUT, out))
  console.log(`${name} ${OUT}x${OUT}  (원본 x ${sx}..${sx + sw}, 칸 안 ${dw}x${dh})`)
}
console.log('\n잘랐다. 출처를 public/sprites/출처.txt 에 적을 것.')
