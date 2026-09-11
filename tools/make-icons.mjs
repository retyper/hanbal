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
 *   활채 #d9cba6 · 손잡이 #8a7550 · 시위 #8d97a3 · 화살대 #e3e9f0 · 촉 #ffb347 (강조색)
 * 그림은 안쪽 66% 안에만 그린다 — 안드로이드의 maskable 아이콘이 가장자리를 깎기 때문이다.
 *
 * ★ 2026-09-11 — 활이 **거꾸로**였다 (형: "병신아 활을 꺼꾸로 쏘냐???"). 아래 shade() 의
 *   주석에 무엇이 어떻게 틀렸는지 숫자로 적어 뒀고, tools/probe-icon.mjs 가 그 규칙을 잰다.
 *   이 그림은 **임시**다 — 진짜 아이콘은 형이 받아올 그림으로 갈아 끼운다 (docs/ICON.md).
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
const GRIP = hex('#8a7550')
const STRING = hex('#8d97a3')
const SHAFT = hex('#e3e9f0')
const HEAD = hex('#ffb347')

/**
 * ── 활의 방향 (2026-09-11, 형: "병신아 활을 꺼꾸로 쏘냐???") ─────────────────
 *
 * 거꾸로였던 게 맞다. 예전 값으로 재 보면:
 *   활채가 가장 부푼 곳 u = −0.220 · 시위 u = −0.035 · 화살은 오른쪽(촉 u = 0.58)
 * 화살이 오른쪽으로 난다면 **활채는 시위보다 오른쪽**(과녁 쪽)에 있어야 한다.
 * 활의 배(belly)가 쏘는 사람을 보고 등(back)이 과녁을 보는 게 활이다. 반대로 그려 놨으니
 * 활을 뒤집어 쥔 그림이었다. 게다가 오늬(−0.245)가 활채보다 뒤라 **화살이 활을 뚫고** 있었다.
 *
 * 이제 하나의 규칙에서 전부 나온다: **화살은 +u 로 난다. 시위는 오늬 자리. 활채는 그 앞.**
 *   시위 x   TIPX          (활 끝 둘을 잇는 직선)
 *   활채 배  CX + R  >  TIPX   ← 이 부등식이 깨지면 거꾸로다 (tools/probe-icon.mjs 가 이걸 잰다)
 *   오늬     TIPX          (시위 위다. 시위 뒤가 아니다)
 */
const TH = (60 * Math.PI) / 180
const R = 0.58
const CX = -0.66
/** 활 끝 (시위가 걸리는 자리). */
const TIPX = CX + R * Math.cos(TH)
const TIPY = R * Math.sin(TH)
/** 활채가 가장 부푼 자리 — 과녁 쪽이다. */
const BELLY = CX + R
/** 촉 끝. */
const TIP = 0.37
/** 촉이 시작되는 곳 (여기부터 강조색). */
const HEADFROM = 0.2

/** 점이 선분에서 얼마나 떨어져 있나 (안티에일리어싱용 거리). */
function distSeg(px, py, x0, y0, x1, y1) {
  const dx = x1 - x0
  const dy = y1 - y0
  const l2 = dx * dx + dy * dy
  const t = l2 <= 0 ? 0 : Math.max(0, Math.min(1, ((px - x0) * dx + (py - y0) * dy) / l2))
  return Math.hypot(px - (x0 + t * dx), py - (y0 + t * dy))
}

const mix = (a, b, t) => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
]

/**
 * 바탕 — 그냥 검정 판이 아니라 **빛이 하나 있는** 어두운 판이다.
 * 활 뒤로 옅은 금빛이 번지고 네 귀는 가라앉는다. 비장한 그림은 빛이 만든다.
 */
function ground(u, v) {
  const d = Math.hypot(u + 0.05, v)
  const glow = Math.max(0, 1 - d / 0.72) ** 2
  const vig = Math.min(1, Math.hypot(u, v) / 0.95) ** 2
  return mix(mix(BG, HEAD, glow * 0.11), [0, 0, 0], vig * 0.22)
}

/**
 * 한 점(0..1 좌표)의 색. 바탕은 언제나 칠하고 그 위에 활과 화살을 얹는다.
 * 그림은 안쪽 66% 안에만 둔다 — 안드로이드의 maskable 아이콘이 가장자리를 깎기 때문이다.
 * (빛은 그 밖까지 번진다. 깎여도 아쉬울 게 없는 것만 밖에 둔다.)
 */
function shade(x, y) {
  const S = 0.66
  const u = (x - 0.5) / S
  const v = (y - 0.5) / S
  const bg = ground(u, v)
  if (Math.abs(u) > 0.62 || Math.abs(v) > 0.62) return bg

  // ── 화살 — 시위(오늬)에서 과녁 쪽으로. 촉은 강조색. ──
  //    활채보다 **먼저** 칠한다: 화살이 손잡이 앞을 지나는 그림이 활을 쥔 모습이다.
  if (Math.abs(v) < 0.026 && u >= TIPX && u < TIP) {
    return u > HEADFROM ? HEAD : SHAFT
  }
  // 촉의 미늘 둘
  if (u < TIP && u > TIP - 0.16 && Math.abs(Math.abs(v) - (TIP - u) * 0.42) < 0.026) return HEAD
  // 깃 — 오늬 쪽의 **채워진 쐐기** 둘. 가는 사선 둘로 그렸더니 작게 줄면 먼지처럼 보였다.
  const f1 = TIPX + 0.15
  if (u > TIPX && u < f1) {
    const t = (f1 - u) / (f1 - TIPX)
    const hi = 0.03 + 0.085 * t
    if (Math.abs(v) < hi && Math.abs(v) > 0.026) return BOW
  }

  // ── 활채 — 원의 **오른쪽**(과녁 쪽) 조각. 손잡이 근처가 두껍다. ──
  const ang = Math.atan2(v, u - CX)
  const d = Math.hypot(u - CX, v)
  if (Math.abs(ang) < TH) {
    // 손잡이 — 가운데가 굵고 색이 짙다. 이 한 덩이가 '쥐는 자리'를 만든다.
    const grip = Math.abs(v) < 0.11
    const half = grip ? 0.082 : 0.05
    if (Math.abs(d - R) < half) return grip ? GRIP : BOW
  }

  // ── 시위 — 활 끝 둘을 잇는 직선. 오늬가 여기 걸린다. ──
  if (distSeg(u, v, TIPX, -TIPY, TIPX, TIPY) < 0.017) return STRING

  return bg
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
          const c = shade((x + (sx + 0.5) / SS) / size, (y + (sy + 0.5) / SS) / size)
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
