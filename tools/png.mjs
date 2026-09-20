/**
 * PNG 읽기·쓰기 — 라이브러리 없이 (A6). 8비트 RGB/RGBA, 인터레이스 없음.
 *
 * tools/bake-icon.mjs · tools/slice-bows.mjs 가 같은 것을 각자 들고 있다 (그때는 도구가
 * 하나씩이었다). 세 번째가 생기면서 여기로 뺐다 — 새 도구는 이걸 가져다 쓴다.
 */
import { deflateSync, inflateSync } from 'node:zlib'
import { readFileSync } from 'node:fs'

/** → { w, h, px: Uint8Array(RGBA) } */
export function decodePng(file) {
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

/** RGBA → PNG Buffer */
export function encodePng(w, h, rgba) {
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

/** 상자 평균으로 (sx,sy,sw,sh) 를 dw×dh 로 줄인다. 크게 줄여도 점이 안 튄다. */
export function boxResize(src, sx, sy, sw, sh, dw, dh) {
  const out = new Uint8Array(dw * dh * 4)
  for (let y = 0; y < dh; y++) {
    const ay0 = sy + Math.floor((y * sh) / dh)
    const ay1 = Math.max(ay0 + 1, sy + Math.floor(((y + 1) * sh) / dh))
    for (let x = 0; x < dw; x++) {
      const ax0 = sx + Math.floor((x * sw) / dw)
      const ax1 = Math.max(ax0 + 1, sx + Math.floor(((x + 1) * sw) / dw))
      const acc = [0, 0, 0, 0]
      let n = 0
      for (let yy = ay0; yy < ay1; yy++) {
        for (let xx = ax0; xx < ax1; xx++) {
          const p = (yy * src.w + xx) * 4
          for (let k = 0; k < 4; k++) acc[k] += src.px[p + k]
          n++
        }
      }
      const d = (y * dw + x) * 4
      for (let k = 0; k < 4; k++) out[d + k] = Math.round(acc[k] / n)
    }
  }
  return out
}
