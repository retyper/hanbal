/**
 * 따낸 그림의 뒷정리 (2026-11-01) — key-png · slice-grid · black-to-alpha 뒤에 남는 것을 걷는다. 그림 검토 에이전트가 짚은 것들.
 *
 *   node tools/clean-alpha.mjs <in.png> [out.png=in] [옵션…]
 *     largest          가장 큰 덩어리(알파 > 20, 여덟 이웃)만 남긴다 — 격자 옆 칸에서 묻어 온 술 조각 · 잔티
 *     defringe         투명에서 3px 안의 가장자리(구멍 안쪽 가장자리도)에서 마젠타 기(빨강·파랑이 초록보다 높다)나
 *                      키를 따내며 생긴 초록 기를 걷는다 — 반투명이면 지우고, 불투명이면 잿빛으로 누른다. 그리고 1px 깎는다
 *     dot=x,y,r        (x,y 는 0~1 비율 · r 은 px) 둥근 자리를 투명하게 — 검은 바탕 빛 효과 위의 제미나이 ✦
 *     clone=x,y,r,dx,dy 둥근 자리를 (dx,dy) px 떨어진 곳의 그림으로 덮는다 — 불투명한 물건 위의 ✦
 *     fadeL=f          왼쪽 끝 f(0~1) 만큼을 0 → 1 로 서서히 — 흐린 꼬리의 끝을 곧은 단면 없이
 *     fadeEdge=px      네 가장자리 px 만큼을 서서히 투명하게 — 그림 끝에 잘린 곧은 단면을 걷는다
 */
import { writeFileSync } from 'node:fs'
import { decodePng, encodePng } from './png.mjs'

const [inp, ...rest] = process.argv.slice(2)
const out = rest[0] !== undefined && rest[0].endsWith('.png') ? rest.shift() : inp
const { w, h, px } = decodePng(inp)
const A = (i) => px[i * 4 + 3]

for (const op of rest) {
  const [name, arg = ''] = op.split('=')
  const nums = arg.split(',').map(Number)
  if (name === 'defringe') {
    // 투명까지의 거리 (3px 까지)
    const dist = new Uint8Array(w * h).fill(9)
    let front = []
    for (let i = 0; i < w * h; i++) if (A(i) < 20) { dist[i] = 0; front.push(i) }
    for (let d = 1; d <= 3; d++) {
      const next = []
      for (const i of front) {
        const x = i % w, y = (i - x) / w
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
          const j = ny * w + nx
          if (dist[j] > d) { dist[j] = d; next.push(j) }
        }
      }
      front = next
    }
    let n = 0, cut = 0
    for (let i = 0; i < w * h; i++) {
      if (dist[i] === 0 || dist[i] > 3) continue
      const r = px[i * 4], g = px[i * 4 + 1], b = px[i * 4 + 2], a = A(i)
      const mag = r - g > 10 && b - g > 10
      const grn = g - r > 20 && g - b > 20
      if (!mag && !grn) continue
      n++
      if (a < 230 || dist[i] === 1) { px[i * 4 + 3] = 0; cut++ } else {
        const v = Math.round(r * 0.3 + g * 0.59 + b * 0.11)
        px[i * 4] = Math.min(r, v + 10); px[i * 4 + 1] = Math.min(g, v + 10); px[i * 4 + 2] = Math.min(b, v + 10)
      }
    }
    console.log(`defringe ${n}픽셀 (지움 ${cut})`)
  } else if (name === 'largest') {
    const lab = new Int32Array(w * h).fill(-1)
    const sizes = []
    const stack = []
    for (let s = 0; s < w * h; s++) {
      if (lab[s] !== -1 || A(s) <= 20) continue
      const id = sizes.length
      let size = 0
      lab[s] = id
      stack.push(s)
      while (stack.length > 0) {
        const i = stack.pop()
        size++
        const x = i % w, y = (i - x) / w
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
          const j = ny * w + nx
          if (lab[j] === -1 && A(j) > 20) { lab[j] = id; stack.push(j) }
        }
      }
      sizes.push(size)
    }
    const keep = sizes.indexOf(Math.max(...sizes))
    let gone = 0
    for (let i = 0; i < w * h; i++) if (A(i) > 0 && lab[i] !== keep) { px[i * 4 + 3] = 0; gone++ }
    console.log(`덩어리 ${sizes.length}개 가운데 가장 큰 것만 · ${gone}픽셀 걷음`)
  } else if (name === 'dot' || name === 'clone') {
    const [fx, fy, r, dx = 0, dy = 0] = nums
    const cx = Math.round(fx * w), cy = Math.round(fy * h)
    for (let y = Math.max(0, cy - r); y <= Math.min(h - 1, cy + r); y++) for (let x = Math.max(0, cx - r); x <= Math.min(w - 1, cx + r); x++) {
      if ((x - cx) ** 2 + (y - cy) ** 2 > r * r) continue
      const i = y * w + x
      if (name === 'dot') { px[i * 4 + 3] = 0; continue }
      const sx = Math.min(w - 1, Math.max(0, x + dx)), sy = Math.min(h - 1, Math.max(0, y + dy))
      const j = sy * w + sx
      for (let k = 0; k < 4; k++) px[i * 4 + k] = px[j * 4 + k]
    }
    console.log(`${name} (${cx},${cy}) r${r}`)
  } else if (name === 'fadeL') {
    const L = Math.round(nums[0] * w)
    for (let y = 0; y < h; y++) for (let x = 0; x < L; x++) px[(y * w + x) * 4 + 3] = Math.round(A(y * w + x) * (x / L))
    console.log(`fadeL ${L}px`)
  } else if (name === 'fadeEdge') {
    const E = nums[0]
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const d = Math.min(x, y, w - 1 - x, h - 1 - y)
      if (d < E) px[(y * w + x) * 4 + 3] = Math.round(A(y * w + x) * (d / E))
    }
    console.log(`fadeEdge ${E}px`)
  } else console.log(`모르는 옵션: ${op}`)
}

writeFileSync(out, encodePng(w, h, px))
console.log(`→ ${out} ${w}x${h}`)
