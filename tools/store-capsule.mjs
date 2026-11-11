/**
 * 스팀 캡슐 합치기 — 형이 구운 그림(capsule_*.png) 위에 확정 로고를 얹어 스팀 규격 크기로 낸다 (형 11-11: 로고는 AI 에 안 맡긴다).
 *
 *   node tools/store-capsule.mjs [--src ~/Downloads] [--only header,main,..] [--lang ko|en|both] [--out D:/tmp-node/store/capsule]
 *
 * 받은 그림 이름 (tools/store-pack.mjs 꾸러미가 정해 준다 · png 또는 jpg):
 *   capsule_header · capsule_main · capsule_vertical · capsule_hero
 * 나가는 것 (--out 과 tools/out/store-final/ 두 곳):
 *   header 920×430 · small 462×174 · main 1232×706 · vertical 748×896 · library-hero 3840×1240 (로고 없음) · library-logo 1280×720 (투명)
 *   로고가 들어가는 것은 <이름>.ko.png · <이름>.en.png 둘씩 (한국어 · 영어 상점)
 * 없는 그림은 건너뛴다 (small 은 hero → main → header 순으로 있는 것에서, main 은 없으면 event-capture.jpg 로, logo 는 그림 없이). PNG 는 커밋하지 않는다 (tools/out/ 은 gitignore).
 * 런타임 의존성 없음 — tools/png.mjs 로 읽고 쓴다 (jpg 는 윈도 PowerShell 의 System.Drawing 으로 PNG 로 바꿔 읽는다).
 */
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { decodePng, encodePng, boxResize } from './png.mjs'
import { ASSETS, LOGOS } from './store-layout.mjs'

const argv = process.argv.slice(2)
const opt = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d }
const SRC = opt('src', join(homedir(), 'Downloads'))
const OUT = opt('out', 'D:/tmp-node/store/capsule')
const FINAL = 'tools/out/store-final'
const only = opt('only')?.split(',')
const langs = opt('lang', 'both') === 'both' ? ['ko', 'en'] : [opt('lang', 'both')]
mkdirSync(OUT, { recursive: true })
mkdirSync(FINAL, { recursive: true })
const TMP = mkdtempSync(join(tmpdir(), 'capsule-'))

/** 그림 파일 → { w, h, px(RGBA) } — png 는 그대로 · jpg 는 PowerShell 로 PNG 로 바꿔서 */
function load(file) {
  if (/\.png$/i.test(file)) return decodePng(file)
  const tmp = join(TMP, `${Math.random().toString(36).slice(2)}.png`)
  const ps = `Add-Type -AssemblyName System.Drawing; $i=[System.Drawing.Image]::FromFile('${file.replace(/\//g, '\\')}'); $i.Save('${tmp.replace(/\//g, '\\')}', [System.Drawing.Imaging.ImageFormat]::Png); $i.Dispose()`
  const r = spawnSync('powershell', ['-NoProfile', '-Command', ps], { encoding: 'utf8' })
  if (!existsSync(tmp)) throw new Error(`${file}: PNG 로 못 바꿨다 ${r.stderr}`)
  return decodePng(tmp)
}
/** 받은 그림 찾기 — 이름 + png/jpg/jpeg */
function find(base) {
  for (const ext of ['png', 'jpg', 'jpeg']) { const f = join(SRC, `${base.replace(/\.png$/, '')}.${ext}`); if (existsSync(f)) return f }
  return null
}

/** 쌍선형 키우기 (줄일 때는 boxResize) — src 의 (sx,sy,sw,sh) 를 dw×dh 로 */
function resize(img, sx, sy, sw, sh, dw, dh) {
  if (dw <= sw && dh <= sh) return boxResize(img, sx, sy, sw, sh, dw, dh)
  const out = new Uint8Array(dw * dh * 4)
  for (let y = 0; y < dh; y++) {
    const fy = Math.min(sh - 1, Math.max(0, ((y + 0.5) * sh) / dh - 0.5))
    const y0 = Math.floor(fy), y1 = Math.min(sh - 1, y0 + 1), ty = fy - y0
    for (let x = 0; x < dw; x++) {
      const fx = Math.min(sw - 1, Math.max(0, ((x + 0.5) * sw) / dw - 0.5))
      const x0 = Math.floor(fx), x1 = Math.min(sw - 1, x0 + 1), tx = fx - x0
      for (let k = 0; k < 4; k++) {
        const p = (xx, yy) => img.px[((sy + yy) * img.w + sx + xx) * 4 + k]
        const a = p(x0, y0) * (1 - tx) + p(x1, y0) * tx
        const b = p(x0, y1) * (1 - tx) + p(x1, y1) * tx
        out[(y * dw + x) * 4 + k] = Math.round(a * (1 - ty) + b * ty)
      }
    }
  }
  return out
}

/** 덮어 자르기 — 비율이 다르면 focus 를 중심으로 넘치는 쪽을 잘라 dw×dh 로 */
function cover(img, dw, dh, focus) {
  const k = Math.max(dw / img.w, dh / img.h)
  const sw = Math.min(img.w, Math.round(dw / k)), sh = Math.min(img.h, Math.round(dh / k))
  const sx = Math.max(0, Math.min(img.w - sw, Math.round(focus[0] * img.w - sw / 2)))
  const sy = Math.max(0, Math.min(img.h - sh, Math.round(focus[1] * img.h - sh / 2)))
  return { w: dw, h: dh, px: resize(img, sx, sy, sw, sh, dw, dh) }
}

/** 투명 알파 가장자리로 자른 로고 */
function trimmed(img, th = 24) {
  let x0 = img.w, y0 = img.h, x1 = -1, y1 = -1
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) if (img.px[(y * img.w + x) * 4 + 3] >= th) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y }
  return { x0, y0, w: x1 - x0 + 1, h: y1 - y0 + 1 }
}

/** 알파 한 겹을 상자 번짐으로 퍼뜨린 그림자 (r 픽셀) */
function blurAlpha(a, w, h, r) {
  const tmp = new Float32Array(w * h), out = new Float32Array(w * h)
  for (let y = 0; y < h; y++) { let s = 0; for (let x = -r; x <= r; x++) s += a[y * w + Math.max(0, Math.min(w - 1, x))]; for (let x = 0; x < w; x++) { tmp[y * w + x] = s / (2 * r + 1); s += a[y * w + Math.min(w - 1, x + r + 1)] - a[y * w + Math.max(0, x - r)] } }
  for (let x = 0; x < w; x++) { let s = 0; for (let y = -r; y <= r; y++) s += tmp[Math.max(0, Math.min(h - 1, y)) * w + x]; for (let y = 0; y < h; y++) { out[y * w + x] = s / (2 * r + 1); s += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x] } }
  return out
}

/** dst(RGBA, dw×dh) 위에 로고를 얹는다 — 뒤에 어두운 번짐 그림자 · 자리는 layout.logo */
function overlayLogo(dst, dw, dh, logoFile, lay) {
  const lg = decodePng(logoFile)
  const c = trimmed(lg)
  const tw = Math.round(lay.w * dw), th = Math.round((c.h * tw) / c.w)
  const px = resize(lg, c.x0, c.y0, c.w, c.h, tw, th)
  const x = Math.round(lay.cx * dw - tw / 2)
  const y = lay.bottom !== undefined ? Math.round(dh - lay.bottom * dh - th) : Math.round(lay.cy * dh - th / 2)
  // 그림자: 로고 알파를 번지게 해 어둡게 깔고 한 번 더 겹친다 (밝은 바탕에서도 읽히게)
  const pad = Math.max(6, Math.round(th * 0.12))
  const sw = tw + pad * 2, sh = th + pad * 2
  const a = new Float32Array(sw * sh)
  for (let yy = 0; yy < th; yy++) for (let xx = 0; xx < tw; xx++) a[(yy + pad) * sw + xx + pad] = px[(yy * tw + xx) * 4 + 3] / 255
  const sh1 = blurAlpha(a, sw, sh, Math.max(2, Math.round(pad * 0.5)))
  for (let yy = 0; yy < sh; yy++) for (let xx = 0; xx < sw; xx++) {
    const X = x - pad + xx, Y = y - pad + yy
    if (X < 0 || Y < 0 || X >= dw || Y >= dh) continue
    const al = Math.min(1, sh1[yy * sw + xx] * 1.6) * 0.75
    const i = (Y * dw + X) * 4
    over(dst, i, 8, 6, 3, al)
  }
  for (let yy = 0; yy < th; yy++) for (let xx = 0; xx < tw; xx++) {
    const X = x + xx, Y = y + yy
    if (X < 0 || Y < 0 || X >= dw || Y >= dh) continue
    const j = (yy * tw + xx) * 4
    over(dst, (Y * dw + X) * 4, px[j], px[j + 1], px[j + 2], px[j + 3] / 255)
  }
  return { x, y, w: tw, h: th }
}
/** 색 하나를 알파 al 로 겹친다 (바탕 알파도 함께 키운다) */
function over(dst, i, r, g, b, al) {
  const da = dst[i + 3] / 255
  const oa = al + da * (1 - al)
  if (oa <= 0) return
  dst[i] = Math.round((r * al + dst[i] * da * (1 - al)) / oa)
  dst[i + 1] = Math.round((g * al + dst[i + 1] * da * (1 - al)) / oa)
  dst[i + 2] = Math.round((b * al + dst[i + 2] * da * (1 - al)) / oa)
  dst[i + 3] = Math.round(oa * 255)
}
/** 아래쪽을 어둡게 — from(0~1) 높이부터 맨 아래까지 0 → alpha 로 */
function scrim(dst, dw, dh, s) {
  const y0 = Math.round(s.from * dh)
  for (let y = y0; y < dh; y++) {
    const t = (y - y0) / Math.max(1, dh - y0)
    const al = s.alpha * t * t * (3 - 2 * t)
    for (let x = 0; x < dw; x++) over(dst, (y * dw + x) * 4, 10, 7, 4, al)
  }
}
/** 전체를 어둡게 (작은 캡슐 바탕) */
function dimAll(dst, n, al) { for (let i = 0; i < n; i += 4) over(dst, i, 12, 9, 6, al) }

const save = (name, w, h, px) => {
  const buf = encodePng(w, h, px)
  for (const d of [OUT, FINAL]) writeFileSync(join(d, name), buf)
  console.log('만듦', name, `${w}×${h}`)
}

const done = [], skipped = []
for (const a of ASSETS) {
  if (only !== undefined && !only.includes(a.key)) continue
  try {
    // 바탕 그림 찾기
    let bg = null
    if (a.transparent !== true) {
      let file = null
      for (const b of a.bake !== null ? [a.bake] : a.from ?? []) { file = find(b); if (file !== null) break }
      if (file === null && a.fallback !== undefined && existsSync(a.fallback)) file = a.fallback
      if (file === null) { skipped.push(`${a.key}: 받은 그림 없음 (${a.bake ?? (a.from ?? []).join(' · ')} 를 ${SRC} 에)`); continue }
      bg = cover(load(file), a.w, a.h, a.focus)
      console.log(a.key, '←', file)
    }
    const ls = a.logo === null ? [null] : langs
    for (const lg of ls) {
      const px = bg !== null ? Uint8Array.from(bg.px) : new Uint8Array(a.w * a.h * 4) // 투명 바탕
      if (a.dim !== undefined) dimAll(px, px.length, a.dim)
      if (a.scrim !== undefined) scrim(px, a.w, a.h, a.scrim)
      if (lg !== null) overlayLogo(px, a.w, a.h, LOGOS[lg], a.logo)
      const name = a.key === 'hero' ? 'library-hero.png' : a.key === 'logo' ? `library-logo.${lg}.png` : `${a.key}.${lg}.png`
      save(name, a.w, a.h, px)
      done.push(name)
    }
  } catch (e) { skipped.push(`${a.key}: ${String(e.message ?? e).slice(0, 160)}`) }
}
console.log(`\n${done.length}장 만듦 → ${OUT} · ${FINAL}`)
if (skipped.length > 0) console.log('건너뜀\n' + skipped.map((s) => ' - ' + s).join('\n'))
