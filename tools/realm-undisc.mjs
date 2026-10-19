/**
 * 깃발의 빨간 동그라미를 지운다 (2026-10-19)
 *
 * 형: "깃발들 이미지에 왜이렇게 일장기같이 만드냐." — 내가 깃발 주문에 "red sun disc behind it" 를 넣었다.
 * 다시 받을 때까지(챗지피티 한도) 받은 깃발에서 빨간 동그라미를 천 빛으로 덮는다.
 * 천의 결은 남기려고 그 자리의 밝기만큼 천 빛을 곱한다. 원본은 <원본 폴더>/emblem-orig/ 에 둔다.
 *
 *   node tools/realm-undisc.mjs assets_src/realm/cut emblem-antler emblem-axe …   (이름이 없으면 emblem-* 전부)
 */
import { readdirSync, writeFileSync, mkdirSync, existsSync, copyFileSync } from 'node:fs'
import { join } from 'node:path'
import { decodePng, encodePng } from './png.mjs'

const [dir, ...names] = process.argv.slice(2)
if (dir === undefined) throw new Error('쓰는 법은 이 파일 머리말에')
const files = names.length > 0 ? names.map((n) => `${n}.png`) : readdirSync(dir).filter((f) => /^emblem-.*\.png$/.test(f))
const keep = join(dir, '..', 'raw-1019', 'emblem-orig')
mkdirSync(keep, { recursive: true })

const isRed = (r, g, b) => r > 140 && r - g > 70 && r - b > 60
const lum = (r, g, b) => 0.3 * r + 0.59 * g + 0.11 * b

for (const f of files.sort()) {
  const src = join(dir, f)
  const orig = join(keep, f)
  if (!existsSync(orig)) copyFileSync(src, orig)
  const { w, h, px } = decodePng(orig)
  // 빨간 점들의 가운데 — 동그라미는 천 위쪽 가운데에 있다
  let sx = 0, sy = 0, n = 0
  for (let y = 0; y < h * 0.7; y++) for (let x = Math.floor(w * 0.2); x < w * 0.8; x++) {
    const k = (y * w + x) * 4
    if (px[k + 3] > 200 && isRed(px[k], px[k + 1], px[k + 2])) { sx += x; sy += y; n++ }
  }
  if (n < w * h * 0.01) { console.log(`${f}: 동그라미 없음`); continue }
  const cx = sx / n, cy = sy / n
  // 천 빛 — 아래쪽 가운데의 밝은 칸들 (먹 그림·빨간 점 빼고)의 가운데값
  const rs = [], gs = [], bs = []
  for (let y = Math.floor(h * 0.6); y < h * 0.82; y++) for (let x = Math.floor(w * 0.3); x < w * 0.7; x++) {
    const k = (y * w + x) * 4
    if (px[k + 3] < 220) continue
    const L = lum(px[k], px[k + 1], px[k + 2])
    if (L < 55) continue
    rs.push(px[k]); gs.push(px[k + 1]); bs.push(px[k + 2])
  }
  const med = (a) => a.sort((p, q) => p - q)[Math.floor(a.length / 2)] ?? 128
  const cloth = [med(rs), med(gs), med(bs)]
  const clothL = Math.max(1, lum(...cloth))
  // 동그라미의 밝기 평균 — 결(밝기 흔들림)만 옮긴다
  let dl = 0, dn = 0
  const R = w * 0.3
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const k = (y * w + x) * 4
    if (Math.hypot(x - cx, y - cy) > R || !isRed(px[k], px[k + 1], px[k + 2])) continue
    dl += lum(px[k], px[k + 1], px[k + 2]); dn++
  }
  const discL = dl / Math.max(1, dn)
  let changed = 0
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const k = (y * w + x) * 4
    if (px[k + 3] === 0 || Math.hypot(x - cx, y - cy) > R) continue
    const r = px[k], g = px[k + 1], b = px[k + 2]
    // 빨간 점, 그리고 먹 그림 가장자리에 묻은 붉은 기 (먹과 빨강의 섞임)
    const reddish = isRed(r, g, b) || (r - g > 45 && r - b > 35 && r > 70)
    if (!reddish) continue
    const t = isRed(r, g, b) ? lum(r, g, b) / discL : lum(r, g, b) / clothL
    for (let c = 0; c < 3; c++) px[k + c] = Math.max(0, Math.min(255, Math.round(cloth[c] * t)))
    changed++
  }
  writeFileSync(src, encodePng(w, h, px))
  console.log(`${f}: 천 rgb(${cloth.join(',')}) · ${changed} 칸 고침`)
}
