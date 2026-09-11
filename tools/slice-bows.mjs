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
 * ── 2026-09-11 두 번째 판 ───────────────────────────────────────────
 * 형: **"활 이미지가 이상하게 잘렸는데? 활줄이랑 활대 사이가 공간이 어쩔수없이 차있는데
 *       그게 어색하게 남아있잖아. 자르지 말고 그냥 활을 올려야 하나?"**
 *
 * 맞다. 처음엔 **세로로 선 활**을 받아 잉크를 세어 덩이를 찾고, 바탕을 알파로 따내고,
 * 카드 안에서 돌려 세웠다. 손이 셋이나 갔고 그만큼 어긋났다 — 특히 **활줄과 활대 사이**는
 * 바탕도 물건도 아니라서, 따내면 구멍이 되고 남기면 네모가 됐다.
 *
 * 이제 **그리는 쪽에서 끝낸다**: 칸마다 한 자루씩 **대각선으로 꽉 차게** 그린 띠를 받는다.
 * 줄과 활대 사이는 금빛 후광이 채워 준다 — 그게 그림의 일부다.
 * 그러면 여기서 할 일은 **다섯으로 똑같이 나누는 것뿐**이다. 따낼 것도 돌릴 것도 없다.
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
/** 잘라낸 한 장의 **긴 변** (px). 걸이 카드에서 쓰는 크기의 두 배쯤이면 충분하다. */
const OUT = 320
/** 그림 둘레에 남기는 여백 (잉크 상자 대비). 0이면 활 끝이 모서리에 딱 붙어 답답하다. */
const PAD = 0.04
/** 바탕보다 이만큼(세 채널 합) 다르면 '그림'으로 친다. */
const INK = 60

const file = process.argv[2]
if (file === undefined) throw new Error('쓸 그림을 인자로 줘라: node tools/slice-bows.mjs <png>')
const src = decodePng(file)
console.log(`읽었다: ${file} ${src.w}x${src.h}`)

mkdirSync('public/sprites', { recursive: true })

// 바탕색 — 네 귀의 평균. 칸 사이의 빈 자리를 알아보는 기준이다.
const at = (x, y) => {
  const i = (y * src.w + x) * 4
  return [src.px[i], src.px[i + 1], src.px[i + 2]]
}
const corners = [at(2, 2), at(src.w - 3, 2), at(2, src.h - 3), at(src.w - 3, src.h - 3)]
const BG = [0, 1, 2].map((k) => Math.round(corners.reduce((a, c) => a + c[k], 0) / corners.length))
console.log(`바탕색 ≈ rgb(${BG.join(',')})`)

// 띠를 **똑같이 다섯으로** 나눈다.
const tile = src.w / IDS.length
console.log(`칸 ${Math.round(tile)}x${src.h}`)

for (let i = 0; i < IDS.length; i++) {
  const tx = Math.round(i * tile)
  const tw = Math.round((i + 1) * tile) - tx
  // ── 칸 안에서 **그림이 실제로 있는 상자**를 찾는다 ──
  //    칸 가장자리에는 빈 바탕이 남는다. 그대로 쓰면 활이 작아 보이고,
  //    억지로 정사각으로 늘리면 활이 눌린다 (형: "활 이미지가 이상하게 잘렸는데?").
  let x0 = tw
  let x1 = -1
  let y0 = src.h
  let y1 = -1
  for (let y = 0; y < src.h; y++) {
    for (let x = 0; x < tw; x++) {
      const [r, g, b] = at(tx + x, y)
      if (Math.abs(r - BG[0]) + Math.abs(g - BG[1]) + Math.abs(b - BG[2]) < INK) continue
      if (x < x0) x0 = x
      if (x > x1) x1 = x
      if (y < y0) y0 = y
      if (y > y1) y1 = y
    }
  }
  if (x1 < x0 || y1 < y0) { x0 = 0; x1 = tw - 1; y0 = 0; y1 = src.h - 1 }
  const padX = Math.round((x1 - x0) * PAD)
  const padY = Math.round((y1 - y0) * PAD)
  const sx = Math.max(0, tx + x0 - padX)
  const sy = Math.max(0, y0 - padY)
  const sw = Math.min(src.w - sx, x1 - x0 + 1 + padX * 2)
  const sh = Math.min(src.h - sy, y1 - y0 + 1 + padY * 2)

  // 긴 변을 OUT 에 맞추고 **비율은 그대로** 둔다. 늘리면 바로 티가 난다.
  const k = OUT / Math.max(sw, sh)
  const dw = Math.max(1, Math.round(sw * k))
  const dh = Math.max(1, Math.round(sh * k))

  const out = new Uint8Array(dw * dh * 4)
  for (let y = 0; y < dh; y++) {
    const ay0 = sy + Math.floor((y * sh) / dh)
    const ay1 = Math.max(ay0 + 1, sy + Math.floor(((y + 1) * sh) / dh))
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
      const d = (y * dw + x) * 4
      out[d] = Math.round(r / n)
      out[d + 1] = Math.round(g / n)
      out[d + 2] = Math.round(b / n)
      out[d + 3] = 255
    }
  }
  const name = `public/sprites/bow-${IDS[i]}.png`
  writeFileSync(name, encodePng(dw, dh, out))
  console.log(`${name} ${dw}x${dh}  (칸 ${i + 1} 에서 ${sw}x${sh})`)
}

console.log('\n잘랐다. 출처를 public/sprites/출처.txt 에 적을 것.')
