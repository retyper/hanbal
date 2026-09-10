/**
 * 홈화면 아이콘 만들기 — PNG 를 손으로 인코딩한다 (2026-09-10)
 *
 * 형: "폰에서 가로로 하니까 상단 브라우저 기본UI가 계속 거슬리는데 PWA로 만들면 안되나?"
 * PWA 로 설치되려면 manifest 에 **PNG 아이콘**이 있어야 하고, iOS 홈화면도 PNG(apple-touch-icon)를 쓴다.
 *
 * 왜 라이브러리를 안 쓰나: 런타임 의존성 0 (ARCHITECTURE A6). devDependency 로 sharp 를 넣을
 * 수도 있지만, 아이콘 한 번 굽자고 네이티브 모듈을 들이는 건 값이 안 맞는다. PNG 는
 * [서명 · IHDR · IDAT(zlib) · IEND] 넷뿐이고 zlib 은 node 에 들어 있다 — 60줄이면 된다.
 *
 * 그림: 어두운 바탕(테마색) 위에 활 하나와 화살 하나. 색은 render/camera.ts 의 THEME 그대로다.
 *   활채 #d9cba6 · 시위 #8d97a3 · 화살대 #e3e9f0 · 촉 #ffb347 (강조색)
 * 그림은 안쪽 66% 안에만 그린다 — 안드로이드의 maskable 아이콘이 가장자리를 깎기 때문이다.
 *
 * 실행: node tools/make-icons.mjs   (public/icon-192.png · icon-512.png · apple-touch-icon.png)
 */
import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'

// ─────────────────────────── PNG 인코더 ───────────────────────────

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
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

/** rgba: Uint8Array(w*h*4) → PNG 버퍼 */
function encodePng(w, h, rgba) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type: RGBA
  // 10·11·12 = 압축 0 · 필터 0 · 인터레이스 0 (전부 기본값이라 그대로 둔다)
  // 스캔라인마다 필터 바이트 0(None)을 앞에 붙인다 — 필터를 안 쓰면 zlib 이 알아서 줄인다.
  const raw = Buffer.alloc(h * (w * 4 + 1))
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0
    rgba.subarray(y * w * 4, (y + 1) * w * 4).forEach((v, i) => {
      raw[y * (w * 4 + 1) + 1 + i] = v
    })
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// ─────────────────────────── 그림 ───────────────────────────

const hex = (s) => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)]
const BG = hex('#1c2129')
const BOW = hex('#d9cba6')
const STRING = hex('#8d97a3')
const SHAFT = hex('#e3e9f0')
const HEAD = hex('#ffb347')

/** 점이 선분에서 얼마나 떨어져 있나 (안티에일리어싱용 거리). */
function distSeg(px, py, x0, y0, x1, y1) {
  const dx = x1 - x0
  const dy = y1 - y0
  const l2 = dx * dx + dy * dy
  const t = l2 <= 0 ? 0 : Math.max(0, Math.min(1, ((px - x0) * dx + (py - y0) * dy) / l2))
  return Math.hypot(px - (x0 + t * dx), py - (y0 + t * dy))
}

/**
 * 한 점(0..1 좌표)의 색. 안 칠할 자리는 null.
 * 활은 왼쪽으로 부푼 호, 시위는 그 두 끝을 잇는 직선, 화살은 시위를 지나 오른쪽으로 나간다.
 */
function shade(x, y) {
  // 그림 전체를 안쪽으로 당긴다 (maskable 안전 구역).
  const S = 0.66
  const u = (x - 0.5) / S
  const v = (y - 0.5) / S
  if (Math.abs(u) > 0.62 || Math.abs(v) > 0.62) return null

  // ── 활채 — 원의 왼쪽 조각 ──
  const cx = 0.34
  const R = 0.56
  const d = Math.hypot(u - cx, v)
  const limbHalf = 0.052
  // 위아래 끝(각 ±48°)까지만 — 그 밖은 활채가 아니다.
  const ang = Math.atan2(v, u - cx)
  const open = Math.abs(Math.abs(ang) - Math.PI) < (48 * Math.PI) / 180
  if (open && Math.abs(d - R) < limbHalf) return BOW

  // ── 시위 — 활채 두 끝을 잇는 직선 ──
  const ey = R * Math.sin((48 * Math.PI) / 180)
  const ex = cx + R * Math.cos(Math.PI - (48 * Math.PI) / 180)
  if (distSeg(u, v, ex, -ey, ex, ey) < 0.018) return STRING

  // ── 화살 — 시위 뒤에서 오른쪽으로. 촉은 강조색. ──
  const tip = 0.58
  const nock = ex - 0.21
  if (Math.abs(v) < 0.028 && u > nock && u < tip) {
    return u > tip - 0.17 ? HEAD : SHAFT
  }
  // 촉의 미늘 두 줄
  if (u < tip && u > tip - 0.15 && Math.abs(Math.abs(v) - (tip - u) * 0.42) < 0.026) return HEAD
  // 깃 — 살대 끝의 **채워진 쐐기** 둘. 가는 사선 둘로 그렸더니 작게 줄면 먼지처럼 보였다.
  const f1 = ex - 0.07
  if (u > nock && u < f1) {
    const t = (f1 - u) / (f1 - nock)
    const hi = 0.03 + 0.075 * t
    if (Math.abs(v) < hi && Math.abs(v) > 0.026) return BOW
  }
  return null
}

/** 4×4 슈퍼샘플링. 곡선이 계단으로 보이면 아이콘은 즉시 싸구려가 된다. */
function render(size) {
  const px = new Uint8Array(size * size * 4)
  const SS = 4
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0
      let g = 0
      let b = 0
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const c = shade((x + (sx + 0.5) / SS) / size, (y + (sy + 0.5) / SS) / size) ?? BG
          r += c[0]
          g += c[1]
          b += c[2]
        }
      }
      const i = (y * size + x) * 4
      const n = SS * SS
      px[i] = Math.round(r / n)
      px[i + 1] = Math.round(g / n)
      px[i + 2] = Math.round(b / n)
      px[i + 3] = 255
    }
  }
  return px
}

for (const [name, size] of [['public/icon-192.png', 192], ['public/icon-512.png', 512], ['public/apple-touch-icon.png', 180]]) {
  writeFileSync(name, encodePng(size, size, render(size)))
  console.log(`${name} ${size}x${size}`)
}
