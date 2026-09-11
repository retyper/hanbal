/**
 * 받아온 그림을 아이콘으로 굽는다 (2026-09-11)
 *
 * 형: **"아이콘 이미지는 챗지피티한테 요청해서 만들어달라고 해."**
 *
 * 나는 챗지피티를 부를 수 없다. 그러니 형이 받아온 PNG 한 장을 **한 줄로** 세 크기의
 * 홈화면 아이콘으로 바꿔 주는 쪽을 만든다. 프롬프트는 docs/ICON.md 에 있다.
 *
 *   node tools/bake-icon.mjs assets_src/icon-source.png
 *     → public/icon-512.png · icon-192.png · apple-touch-icon.png
 *
 * 라이브러리는 안 쓴다 (A6). PNG 는 [서명 · IHDR · IDAT(zlib) · IEND] 뿐이고 zlib 은
 * node 에 들어 있다. 읽는 쪽은 필터 다섯을 다 풀고(굽는 쪽은 0만 쓴다), 줄이는 건 상자 평균이다.
 *
 * 받는 그림의 조건: **8비트 · 인터레이스 없음 · RGB 또는 RGBA · 정사각형**.
 * 챗지피티가 주는 PNG 는 대개 그렇다. 아니면 무엇이 다른지 말하고 멈춘다.
 */
import { deflateSync, inflateSync } from 'node:zlib'
import { readFileSync, writeFileSync } from 'node:fs'

// ─────────────────────────── 읽기 ───────────────────────────

function decodePng(file) {
  const buf = readFileSync(file)
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  for (let i = 0; i < 8; i++) {
    if (buf[i] !== sig[i]) throw new Error(`${file}: PNG 가 아니다`)
  }
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
      if (data[12] !== 0) throw new Error(`${file}: 인터레이스 PNG 는 못 읽는다`)
    } else if (kind === 'IDAT') idat.push(data)
    else if (kind === 'IEND') break
    at += 12 + len
  }
  if (depth !== 8) throw new Error(`${file}: 비트 깊이가 ${depth} 다 (8만 읽는다)`)
  if (type !== 2 && type !== 6) throw new Error(`${file}: 색 방식이 ${type} 다 (RGB 2 · RGBA 6 만 읽는다)`)
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
        // Paeth — 셋 중 예측에 가장 가까운 것.
        const pp = a + b - c
        const pa = Math.abs(pp - a)
        const pb = Math.abs(pp - b)
        const pc = Math.abs(pp - c)
        v = x + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)
      } else throw new Error(`${file}: 줄 ${y} 의 필터가 ${f} 다`)
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

// ─────────────────────────── 쓰기 ───────────────────────────

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

// ─────────────────────────── 줄이기 ───────────────────────────

/** 테마 바탕색 — 투명한 자리는 이 색으로 받는다 (홈화면 아이콘에 구멍이 있으면 안 된다). */
const BG = [0x1c, 0x21, 0x29]

/**
 * 상자 평균으로 줄인다. 원본이 목표보다 훨씬 클 때 가장 정직한 방법이다 —
 * 이웃 네 점만 섞는 방식(bilinear)은 512→192 처럼 크게 줄이면 점이 튄다.
 */
function resize(src, size) {
  const out = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y++) {
    const y0 = Math.floor((y * src.h) / size)
    const y1 = Math.max(y0 + 1, Math.floor(((y + 1) * src.h) / size))
    for (let x = 0; x < size; x++) {
      const x0 = Math.floor((x * src.w) / size)
      const x1 = Math.max(x0 + 1, Math.floor(((x + 1) * src.w) / size))
      let r = 0
      let g = 0
      let b = 0
      let n = 0
      for (let sy = y0; sy < y1; sy++) {
        for (let sx = x0; sx < x1; sx++) {
          const i = (sy * src.w + sx) * 4
          const a = src.px[i + 3] / 255
          // 투명한 만큼 바탕색을 섞는다.
          r += src.px[i] * a + BG[0] * (1 - a)
          g += src.px[i + 1] * a + BG[1] * (1 - a)
          b += src.px[i + 2] * a + BG[2] * (1 - a)
          n++
        }
      }
      const d = (y * size + x) * 4
      out[d] = Math.round(r / n)
      out[d + 1] = Math.round(g / n)
      out[d + 2] = Math.round(b / n)
      out[d + 3] = 255
    }
  }
  return out
}

// ─────────────────────────── 실행 ───────────────────────────

const file = process.argv[2] ?? 'assets_src/icon-source.png'
const src = decodePng(file)
console.log(`읽었다: ${file} ${src.w}x${src.h}`)
if (src.w !== src.h) {
  console.log(`  ※ 정사각형이 아니다 (${src.w}x${src.h}) — 짧은 쪽에 맞춰 가운데를 자른다`)
  const s = Math.min(src.w, src.h)
  const ox = ((src.w - s) / 2) | 0
  const oy = ((src.h - s) / 2) | 0
  const cut = new Uint8Array(s * s * 4)
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const a = ((y + oy) * src.w + (x + ox)) * 4
      const b = (y * s + x) * 4
      cut[b] = src.px[a]
      cut[b + 1] = src.px[a + 1]
      cut[b + 2] = src.px[a + 2]
      cut[b + 3] = src.px[a + 3]
    }
  }
  src.w = s
  src.h = s
  src.px = cut
}
if (src.w < 512) console.log(`  ※ 원본이 ${src.w}px 다 — 512 로 늘리면 뭉갠다. 1024 로 다시 받아오는 게 낫다`)

for (const [name, size] of [
  ['public/icon-512.png', 512],
  ['public/icon-192.png', 192],
  ['public/apple-touch-icon.png', 180],
]) {
  writeFileSync(name, encodePng(size, size, resize(src, size)))
  console.log(`${name} ${size}x${size}`)
}
console.log('\n굽었다. 확인: node tools/probe-icon.mjs · 배포: npm run build')
