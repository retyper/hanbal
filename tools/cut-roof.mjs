import { writeFileSync } from 'node:fs'
import { decodePng, encodePng, boxResize } from './png.mjs'
const s = decodePng('assets_src/roof-keyed.png')
// 받은 기와는 한낮의 푸른 회색이다 — 어둑한 벽(wallDim) 위에서 혼자 빛난다. 구울 때 어둡히고 푸른 기를 조금 뺀다.
for (let i = 0; i < s.px.length; i += 4) { s.px[i] = Math.round(s.px[i] * 0.7); s.px[i + 1] = Math.round(s.px[i + 1] * 0.68); s.px[i + 2] = Math.round(s.px[i + 2] * 0.66) }
const y0 = 116, y1 = 455, H = 256
const k = H / (y1 - y0)
const cut = (name, x0, x1) => { const w = Math.round((x1 - x0) * k); writeFileSync(`public/sprites/${name}.png`, encodePng(w, H, boxResize(s, x0, y0, x1 - x0, y1 - y0, w, H))); console.log(name, w, H) }
cut('bld-eave', 3, 383)
cut('bld-rooftile', 383, 627)
