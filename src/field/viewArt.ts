/**
 * 전장 그림 고르기: 있는 그림만 쓴다 (병사 띠 anim2/<kind>.png · 장수 띠 anim2/gen-*.png · 바닥 realm/raid/ground-forest.webp · 조각 fx/field/*.png).
 * 띠는 20컷 한 줄(서기 0~3 · 걷기 4~11 · 공격 12~17 · 맞음 18 · 쓰러짐 19) · 높이 160px.
 * 컷 가로는 src/realm/data/art.ts 의 SOL_ANIM2(컷 가로/세로) × 160 을 복사했다 (그 파일은 realm 번들을 끌어오므로 값만 옮긴다).
 */

export const STRIP_H = 160
export const CELLS = 20
export const STAND0 = 0, STAND_N = 4, WALK0 = 4, WALK_N = 8, ATTACK0 = 12, ATTACK_N = 6, DOWN = 19

/** 컷 가로(px) */
const CELL_W: Readonly<Record<string, number>> = { militia: 168, spear: 548, bow: 629, shield: 317, pike: 475, axe: 208, marine: 372, horse: 232, boat: 336, crossbow: 768 }
const GEN_CELL_W = 265
/** 무리 → 띠 (sim 의 kind 가 병종 이름표면 그것을 먼저 쓴다) */
const GRP_STRIP: Readonly<Record<string, string>> = { front: 'spear', bows: 'bow', horse: 'horse' }

export interface Strip { img: HTMLImageElement; cw: number }
export interface Art {
  base: string
  strips: Map<string, Strip>
  ground: HTMLImageElement
  pieces: Map<string, HTMLImageElement>
}

const load = (src: string): HTMLImageElement => { const i = new Image(); i.decoding = 'async'; i.src = src; return i }

export function loadArt(base: string): Art {
  const strips = new Map<string, Strip>()
  for (const key of Object.keys(CELL_W)) strips.set(key, { img: load(`${base}anim2/${key}.png`), cw: CELL_W[key]! })
  strips.set('hero', { img: load(`${base}anim2/gen-ara.png`), cw: GEN_CELL_W })
  return { base, strips, ground: load(`${base}raid/ground-forest.webp`), pieces: new Map() }
}

const ready = (s: Strip | undefined): Strip | null => s !== undefined && s.img.complete && s.img.naturalWidth > 0 ? s : null

export function stripFor(art: Art, grp: string, kind: string): Strip | null {
  return ready(art.strips.get(CELL_W[kind] !== undefined ? kind : GRP_STRIP[grp] ?? 'militia'))
}
export const heroStrip = (art: Art): Strip | null => ready(art.strips.get('hero'))

export function pieceImg(art: Art, kind: string): HTMLImageElement | null {
  let i = art.pieces.get(kind)
  if (i === undefined) { i = load(`${art.base}fx/field/${kind}.png`); art.pieces.set(kind, i) }
  return i.complete && i.naturalWidth > 0 ? i : null
}
