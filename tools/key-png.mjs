/**
 * 단색 바탕을 알파로 따낸다 (크로마 키) — 2026-09-20
 *
 * 챗지피티는 "투명 바탕"을 시키면 진짜 알파로 주지만 **제미나이는 못 준다** (체크무늬를 그려 넣는다).
 * 그래서 제미나이에는 "바탕은 순수한 마젠타(#FF00FF) 한 색"으로 시키고 여기서 따낸다.
 * 그다음은 같다: tools/slice-grid.mjs … trim 이 알파로 물건을 찾는다.
 *
 *   node tools/key-png.mjs <받은그림.png> <out.png> [단단함=90] [부드러움=70] [지울곳] [flip]
 *     지울곳  "x0,y0,x1,y1;…" (0~1 비율) — 그 네모를 바탕색으로 덮는다. 모델이 시키지도 않은 **글자 라벨**과
 *             제미나이의 워터마크(오른쪽 아래 ✦)를 따내기 전에 지운다.
 *     flip    좌우를 뒤집는다 — 적은 왼쪽(궁수 쪽)을 봐야 하는데 모델은 자주 오른쪽으로 그린다.
 *
 * 바탕색은 네 귀의 평균으로 잰다 (모델은 #FF00FF 를 정확히 안 칠한다).
 *   거리 < 단단함            → 완전히 투명
 *   단단함 ~ 단단함+부드러움  → 비례해서 반투명 (그림의 안티에일리어싱 가장자리)
 * 반투명해진 픽셀에서는 **바탕색을 빼낸다**(despill) — 안 그러면 가장자리에 분홍 테가 남는다.
 */
import { writeFileSync } from 'node:fs'
import { decodePng, encodePng } from './png.mjs'

const [file, out, hardS = '90', softS = '70', blankS = '', flipS = ''] = process.argv.slice(2)
if (out === undefined) throw new Error('쓰는 법은 이 파일 머리말에 있다')
const HARD = Number(hardS)
const SOFT = Number(softS)

const src = decodePng(file)
const at = (x, y) => (y * src.w + x) * 4
const corners = [at(3, 3), at(src.w - 4, 3), at(3, src.h - 4), at(src.w - 4, src.h - 4)]
const BG = [0, 1, 2].map((k) => corners.reduce((t, i) => t + src.px[i + k], 0) / 4)
console.log(`${file} ${src.w}x${src.h} · 바탕색 ≈ rgb(${BG.map(Math.round).join(',')})`)

for (const box of blankS.split(';').filter((b) => b.length > 0)) {
  const [x0, y0, x1, y1] = box.split(',').map(Number)
  for (let y = Math.floor(y0 * src.h); y < Math.ceil(y1 * src.h); y++) {
    for (let x = Math.floor(x0 * src.w); x < Math.ceil(x1 * src.w); x++) {
      const i = at(x, y)
      for (let k = 0; k < 3; k++) src.px[i + k] = BG[k]
    }
  }
}
if (flipS === 'flip') {
  for (let y = 0; y < src.h; y++) {
    for (let x = 0; x < src.w >> 1; x++) {
      const a = at(x, y)
      const b = at(src.w - 1 - x, y)
      for (let k = 0; k < 4; k++) { const t = src.px[a + k]; src.px[a + k] = src.px[b + k]; src.px[b + k] = t }
    }
  }
}

let clear = 0
for (let i = 0; i < src.px.length; i += 4) {
  const dr = src.px[i] - BG[0]
  const dg = src.px[i + 1] - BG[1]
  const db = src.px[i + 2] - BG[2]
  const d = Math.sqrt(dr * dr + dg * dg + db * db)
  if (d < HARD) {
    src.px[i + 3] = 0
    clear++
    continue
  }
  if (d >= HARD + SOFT) continue
  const a = (d - HARD) / SOFT
  // despill: 보이는 색 = 그림 × a + 바탕 × (1 − a) 이므로, 그림 = (보이는 색 − 바탕 × (1 − a)) / a
  for (let k = 0; k < 3; k++) {
    src.px[i + k] = Math.max(0, Math.min(255, Math.round((src.px[i + k] - BG[k] * (1 - a)) / a)))
  }
  src.px[i + 3] = Math.round(a * 255)
}
// ── 가장자리 despill ──
// 위의 식은 '반투명해진' 픽셀만 고친다. 그런데 그림의 어두운 가장자리(깃털·옷자락)는 바탕과의 거리가 멀어
// 불투명으로 남으면서도 마젠타가 섞여 있다 — 어두운 배경 위에서 **분홍 테**로 보인다.
// 투명한 곳에서 2px 안의 픽셀은, 빨강·파랑이 초록보다 함께 넘치는 만큼(= 마젠타 성분)을 덜어낸다.
const EDGE = 2
const alpha0 = new Uint8Array(src.w * src.h)
for (let i = 0; i < alpha0.length; i++) alpha0[i] = src.px[i * 4 + 3]
let fixed = 0
for (let y = 0; y < src.h; y++) {
  for (let x = 0; x < src.w; x++) {
    const i = at(x, y)
    if (src.px[i + 3] === 0) continue
    let near = false
    for (let dy = -EDGE; dy <= EDGE && !near; dy++) {
      for (let dx = -EDGE; dx <= EDGE; dx++) {
        const xx = x + dx, yy = y + dy
        if (xx < 0 || yy < 0 || xx >= src.w || yy >= src.h) continue
        if (alpha0[yy * src.w + xx] === 0) { near = true; break }
      }
    }
    if (!near) continue
    const spill = Math.min(src.px[i], src.px[i + 2]) - src.px[i + 1]
    if (spill <= 0) continue
    src.px[i] -= spill
    src.px[i + 2] -= spill
    fixed++
  }
}
console.log(`가장자리 despill ${fixed}픽셀`)
writeFileSync(out, encodePng(src.w, src.h, src.px))
console.log(`→ ${out} · 투명 ${((clear / (src.w * src.h)) * 100).toFixed(1)}%`)
