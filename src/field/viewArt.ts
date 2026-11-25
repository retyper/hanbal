/**
 * 전장 그림 고르기: 있는 그림만 쓴다.
 *  - 병사·장수 띠: public/realm/anim-px/<열쇠>.png (20컷 한 줄 · 칸 크기·발 줄·몸 키는 같은 폴더 manifest.json)
 *    컷 차례: 서기 0~3 · 걷기 4~11 · 공격 12~17 · 맞음 18 · 쓰러짐 19
 *  - 바닥 realm/raid/ground-forest.webp · 조각 realm/fx/field/*.png
 * 편 색을 입힌 복사본은 띠마다 한 번만 만들어 둔다 (viewTint.ts).
 */
import { P } from '../tune/params.ts'
import { teamTint } from './viewTint.ts'

export const CELLS = 20
/** 덧띠 한 줄 칸 수 */
export const RUN_N = 8
export const STAND0 = 0, STAND_N = 4, WALK0 = 4, WALK_N = 8, ATTACK0 = 12, ATTACK_N = 6, HIT = 18, DOWN = 19

/** 무리 → 띠 (sim 의 kind 가 병종 이름표이고 띠가 있으면 그것을 먼저 쓴다) */
const GRP_STRIP: Readonly<Record<string, string>> = { front: 'spear', bows: 'bow', horse: 'horse' }
export const DEFAULT_HERO = 'gen-ara'

interface Entry { cell: readonly [number, number]; feet: number; bodyPx: number; kind: string }

/** 구운 판 한 장 (캔버스 또는 굳힌 그림) */
export type Sheet = CanvasImageSource & { width: number; height: number }
/**
 * 구운 띠 — 원본 띠(폭 8760~10060px)를 프레임마다 줄여 찍지 않도록, 그릴 크기로 한 번 줄여 4096px 아래 폭으로 접어 둔다
 * (열전 src/raid/haebi-view.ts 의 bakedStrip 을 본뜸 · 폰 GPU 텍스처 한도). 물들임은 구운 뒤에 · 뒤집은 판도 같이 구워 둬 프레임마다 뒤집지 않는다.
 * 새 덧띠(질주·달리기 따위)도 bakeLayout/bakeSheet 한 길로 받는다.
 */
export interface Strip {
  /** 구운 칸 가로·세로 · 한 줄 칸 수 · 발 줄(칸 위에서 y) · 몸 키(px) — 모두 구운 크기 기준, 그릴 때 몸 키를 맞춘다 */
  cw: number; ch: number; cols: number; feet: number; bodyPx: number
  /** 병사 띠면 편 색을 입힌다 */
  soldier: boolean
  /** [보통, 뒤집힘] */
  plain: [Sheet, Sheet]
  base: HTMLCanvasElement
  /** [편][보통, 뒤집힘] — 처음 쓸 때 만든다 */
  tint: [[Sheet | null, Sheet | null], [Sheet | null, Sheet | null]]
  n: number
}
export interface Art {
  base: string
  manifest: Record<string, Entry> | null
  strips: Map<string, { ready: boolean; strip: Strip }>
  ground: HTMLImageElement
  pieces: Map<string, HTMLImageElement>
}

const load = (src: string): HTMLImageElement => { const i = new Image(); i.decoding = 'async'; i.src = src; return i }

export function loadArt(base: string): Art {
  const art: Art = { base, manifest: null, strips: new Map(), ground: load(`${base}raid/ground-forest.webp`), pieces: new Map() }
  fetch(`${base}anim-px/manifest.json`).then(r => r.json()).then((m: Record<string, Entry>) => { art.manifest = m }).catch(() => { art.manifest = {} })
  return art
}

/** 구운 판의 칸 배치: 원래 칸 cw×ch 를 높이 fh 로 줄이고(원본보다 크게는 안 키운다) 폭 maxW 안에 여러 줄로 접는다 */
export function bakeLayout(cw: number, ch: number, n: number, wantH: number, maxW: number): { fw: number; fh: number; cols: number; rows: number } {
  const fh = Math.max(1, Math.min(ch, Math.round(wantH)))
  const fw = Math.max(1, Math.round(cw * fh / ch))
  const cols = Math.max(1, Math.min(n, Math.floor(maxW / fw)))
  return { fw, fh, cols, rows: Math.ceil(n / cols) }
}

/** 띠를 구워 캔버스 한 장으로 (mirror 면 칸마다 좌우를 뒤집어서) */
export function bakeSheet(src: CanvasImageSource, cw: number, ch: number, n: number, lay: { fw: number; fh: number; cols: number; rows: number }, mirror: boolean): HTMLCanvasElement {
  const cv = document.createElement('canvas')
  cv.width = lay.cols * lay.fw; cv.height = lay.rows * lay.fh
  const g = cv.getContext('2d') as CanvasRenderingContext2D
  g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'
  for (let i = 0; i < n; i++) {
    const dx = (i % lay.cols) * lay.fw, dy = Math.floor(i / lay.cols) * lay.fh
    if (mirror) { g.save(); g.translate(dx + lay.fw, dy); g.scale(-1, 1); g.drawImage(src, i * cw, 0, cw, ch, 0, 0, lay.fw, lay.fh); g.restore() }
    else g.drawImage(src, i * cw, 0, cw, ch, dx, dy, lay.fw, lay.fh)
  }
  return cv
}

/** 구운 캔버스를 굳힌 그림(ImageBitmap)으로 바꿔 쥔다 — 캔버스를 원본으로 찍으면 찍을 때마다 사본을 뜰 수 있다 */
function solidify(cv: HTMLCanvasElement, put: (b: Sheet) => void): void {
  if (typeof createImageBitmap === 'function') void createImageBitmap(cv).then(put, () => {})
}

/** 열쇠의 띠 (처음 부르면 그림을 받기 시작한다 · 구워질 때까지는 null) */
export function stripByKey(art: Art, key: string): Strip | null { return stripFile(art, key, key, CELLS) }

/**
 * 덧띠(달리기·질주): 규격(칸 크기·발 줄·몸 키)은 본 띠 baseKey 의 것을 빌리고 파일만 <baseKey>-x.png (n 칸).
 * manifest.json 은 고치지 않는다. 파일이 아직 없으면 null — 그림이 생기면 새로 열 때 저절로 쓴다.
 */
export function extraStrip(art: Art, baseKey: string, n: number, suffix = 'x'): Strip | null { return stripFile(art, `${baseKey}-${suffix}`, baseKey, n) }
/** 방진으로 버티는 창병 두 칸 (칸 1 버팀 · 칸 2 더 낮춰 받음) — 창병만 */
export const HOLD_N = 2
export const HAS_HOLD_STRIP: ReadonlySet<string> = new Set(['spear', 'shield', 'pike'])
export function holdStripFor(art: Art, grp: string, kind: string): Strip | null {
  const k = stripKey(art, grp, kind)
  return HAS_HOLD_STRIP.has(k) ? extraStrip(art, k, HOLD_N, 'hold') : null
}
/** 덧띠가 있는 병종 */
export const HAS_RUN_STRIP: ReadonlySet<string> = new Set(['spear', 'horse', 'shield'])

function stripFile(art: Art, key: string, specKey: string, n: number): Strip | null {
  const had = art.strips.get(key)
  if (had !== undefined) return had.ready ? had.strip : null
  const e = art.manifest?.[specKey]
  if (e === undefined) return null
  const img = load(`${art.base}anim-px/${key}.png`)
  const slot: { ready: boolean; strip: Strip } = { ready: false, strip: null as unknown as Strip }
  art.strips.set(key, slot)
  const soldier = e.kind === 'soldier'
  img.addEventListener('load', () => {
    const F = P.field
    const drawH = F.soldierCells * F.cellPx * (soldier ? 1 : F.heroScale / 100)
    const wantH = e.cell[1] * drawH / e.bodyPx * F.bakeUpPermille / 1000
    const lay = bakeLayout(e.cell[0], e.cell[1], n, wantH, F.bakeMaxPx)
    const r = lay.fh / e.cell[1]
    const base = bakeSheet(img, e.cell[0], e.cell[1], n, lay, false)
    const st: Strip = { cw: lay.fw, ch: lay.fh, cols: lay.cols, feet: e.feet * r, bodyPx: e.bodyPx * r, soldier, plain: [base, bakeSheet(img, e.cell[0], e.cell[1], n, lay, true)], base, tint: [[null, null], [null, null]], n }
    solidify(base, b => { st.plain[0] = b })
    solidify(st.plain[1] as HTMLCanvasElement, b => { st.plain[1] = b })
    slot.strip = st; slot.ready = true
  })
  return null
}

/** 그릴 판: 병사는 편 색을 입힌 것(처음 쓸 때 구운 작은 판에 입힌다) · 장수(side -1)는 그대로 */
export function sheetOf(s: Strip, side: -1 | 0 | 1, flip: boolean): Sheet {
  const f = flip ? 1 : 0
  if (side < 0 || !s.soldier) return s.plain[f]
  const row = s.tint[side as 0 | 1]!
  if (row[f] === null) {
    const lay = { fw: s.cw, fh: s.ch, cols: s.cols, rows: Math.ceil(s.n / s.cols) }
    const t = teamTint(s.base, side as 0 | 1)
    row[0] = t
    const m = document.createElement('canvas'); m.width = t.width; m.height = t.height
    const g = m.getContext('2d') as CanvasRenderingContext2D
    for (let i = 0; i < s.n; i++) { const dx = (i % lay.cols) * lay.fw, dy = Math.floor(i / lay.cols) * lay.fh; g.save(); g.translate(dx + lay.fw, dy); g.scale(-1, 1); g.drawImage(t, dx, dy, lay.fw, lay.fh, 0, 0, lay.fw, lay.fh); g.restore() }
    row[1] = m
  }
  return row[f]!
}

/** 무리·병종 → 본 띠 열쇠 */
export function stripKey(art: Art, grp: string, kind: string): string { return art.manifest?.[kind]?.kind === 'soldier' ? kind : GRP_STRIP[grp] ?? 'militia' }
export function stripFor(art: Art, grp: string, kind: string): Strip | null { return stripByKey(art, stripKey(art, grp, kind)) }
/** 달리는 대의 띠 (덧띠가 있는 병종만 · 없거나 아직 안 구워졌으면 null) */
export function runStripFor(art: Art, grp: string, kind: string): Strip | null {
  const k = stripKey(art, grp, kind)
  return HAS_RUN_STRIP.has(k) ? extraStrip(art, k, RUN_N) : null
}

/** 장수 띠 열쇠 (heroStrip 과 같은 고름) */
export function heroKey(art: Art, id: string, pick: string | null): string | null {
  const m = art.manifest
  if (m === null) return null
  return pick !== null && m[pick] !== undefined ? pick : m[`gen-${id}`] !== undefined ? `gen-${id}` : DEFAULT_HERO
}
/** 장수 띠: 주소 ?hero= 가 있으면 그것 · 없으면 gen-<장수 id> · 그것도 없으면 기본 */
export function heroStrip(art: Art, id: string, pick: string | null): Strip | null {
  const m = art.manifest
  if (m === null) return null
  const key = pick !== null && m[pick] !== undefined ? pick : m[`gen-${id}`] !== undefined ? `gen-${id}` : DEFAULT_HERO
  return stripByKey(art, key)
}

export function pieceImg(art: Art, name: string): HTMLImageElement | null {
  let i = art.pieces.get(name)
  if (i === undefined) { i = load(`${art.base}fx/field/${name}.png`); art.pieces.set(name, i) }
  return i.complete && i.naturalWidth > 0 ? i : null
}
