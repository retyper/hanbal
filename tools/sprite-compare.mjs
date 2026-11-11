/**
 * 도트 규격 전·후 비교 그림 — node tools/sprite-compare.mjs <이름>... → D:/tmp-node/spx/compare.png
 * 위 줄 = 원본(anim2)을 같은 배율로 상자 필터만 줄인 것 · 아래 줄 = anim-px (둘 다 3배 확대 · 칸마다 서기0 · 걷기6 · 공격3 · 쓰러짐)
 */
import { writeFileSync, readFileSync } from 'node:fs'
import { decodePng, encodePng } from './png.mjs'

const names = process.argv.slice(2)
const man = JSON.parse(readFileSync('public/realm/anim-px/manifest.json', 'utf8'))
const FR = [0, 6, 13, 16, 19], Z = 3
const rows = []
for (const n of names) {
  const o = decodePng(`public/realm/anim2/${n}.png`), p = decodePng(`public/realm/anim-px/${n}.png`)
  const m = man[n], [W, H] = m.cell, s = m.bodyPx / (o.h * 0.91) * 0.91 * 0 + H / o.h
  rows.push({ o, p, W, H, n, cw: o.w / m.cells })
  void s
}
const colW = Math.max(...rows.map((r) => r.W)) * Z + 4
const OW = colW * FR.length, rowH = (Math.max(...rows.map((r) => r.H)) * Z + 4)
const OH = rowH * rows.length * 2
const out = new Uint8Array(OW * OH * 4)
for (let i = 0; i < out.length; i += 4) { out[i] = 70; out[i + 1] = 84; out[i + 2] = 70; out[i + 3] = 255 }
rows.forEach((r, ri) => {
  const m = man[r.n]
  const sc = r.H / r.o.h * (m.kind === 'general' ? 1 : 1) // 원본 높이를 칸 높이에 맞춘 배율 (몸 키 정규화 전 단순 축소)
  FR.forEach((f, fi) => {
    for (let y = 0; y < r.H * Z; y++) for (let x = 0; x < r.W * Z; x++) {
      const dx = fi * colW + x, dyP = (ri * 2 + 1) * rowH + y, dyO = ri * 2 * rowH + y
      const pi = (Math.floor(y / Z) * r.p.w + f * r.W + Math.floor(x / Z)) * 4
      if (r.p.px[pi + 3]) { const d = (dyP * OW + dx) * 4; out[d] = r.p.px[pi]; out[d + 1] = r.p.px[pi + 1]; out[d + 2] = r.p.px[pi + 2] }
      // 원본: 상자 평균 (같은 칸 안 위치 · 가로 중심 맞춤 · 아래 맞춤)
      const sx0 = (Math.floor(x / Z) - r.W / 2) / sc + r.cw / 2, sy0 = Math.floor(y / Z) / sc
      let R = 0, G = 0, B = 0, A = 0, n = 0
      for (let yy = Math.floor(sy0); yy < Math.floor(sy0 + 1 / sc) + 1; yy++) for (let xx = Math.floor(sx0); xx < Math.floor(sx0 + 1 / sc) + 1; xx++) {
        if (xx < 0 || xx >= r.cw || yy < 0 || yy >= r.o.h) { n++; continue }
        const i = (yy * r.o.w + Math.round(f * r.cw) + xx) * 4, a = r.o.px[i + 3] / 255
        R += r.o.px[i] * a; G += r.o.px[i + 1] * a; B += r.o.px[i + 2] * a; A += a; n++
      }
      if (A > 0) { const d = (dyO * OW + dx) * 4, al = A / n; out[d] = out[d] * (1 - al) + R / A * al; out[d + 1] = out[d + 1] * (1 - al) + G / A * al; out[d + 2] = out[d + 2] * (1 - al) + B / A * al }
    }
  })
})
writeFileSync('D:/tmp-node/spx/compare.png', encodePng(OW, OH, out))
console.log('compare.png', OW, OH)
