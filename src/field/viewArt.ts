/**
 * 전장 그림 고르기: 있는 그림만 쓴다.
 *  - 병사·장수 띠: public/realm/anim-px/<열쇠>.png (20컷 한 줄 · 칸 크기·발 줄·몸 키는 같은 폴더 manifest.json)
 *    컷 차례: 서기 0~3 · 걷기 4~11 · 공격 12~17 · 맞음 18 · 쓰러짐 19
 *  - 바닥 realm/raid/ground-forest.webp · 조각 realm/fx/field/*.png
 * 편 색을 입힌 복사본은 띠마다 한 번만 만들어 둔다 (viewTint.ts).
 */
import { teamTint } from './viewTint.ts'

export const CELLS = 20
export const STAND0 = 0, STAND_N = 4, WALK0 = 4, WALK_N = 8, ATTACK0 = 12, ATTACK_N = 6, HIT = 18, DOWN = 19

/** 무리 → 띠 (sim 의 kind 가 병종 이름표이고 띠가 있으면 그것을 먼저 쓴다) */
const GRP_STRIP: Readonly<Record<string, string>> = { front: 'spear', bows: 'bow', horse: 'horse' }
export const DEFAULT_HERO = 'gen-ara'

interface Entry { cell: readonly [number, number]; feet: number; bodyPx: number; kind: string }

export interface Strip {
  img: HTMLImageElement
  /** 칸 가로·세로 · 발 줄(칸 위에서 y) · 몸 키(px) — 그릴 때 몸 키를 맞춘다 */
  cw: number; ch: number; feet: number; bodyPx: number
  /** 편 색 복사본 (병사만 · 장수는 null) */
  tint: [HTMLCanvasElement | null, HTMLCanvasElement | null]
}
export interface Art {
  base: string
  manifest: Record<string, Entry> | null
  strips: Map<string, Strip>
  ground: HTMLImageElement
  pieces: Map<string, HTMLImageElement>
}

const load = (src: string): HTMLImageElement => { const i = new Image(); i.decoding = 'async'; i.src = src; return i }

export function loadArt(base: string): Art {
  const art: Art = { base, manifest: null, strips: new Map(), ground: load(`${base}raid/ground-forest.webp`), pieces: new Map() }
  fetch(`${base}anim-px/manifest.json`).then(r => r.json()).then((m: Record<string, Entry>) => { art.manifest = m }).catch(() => { art.manifest = {} })
  return art
}

/** 열쇠의 띠 (처음 부르면 그림을 받기 시작한다 · 아직 안 왔으면 null) */
export function stripByKey(art: Art, key: string): Strip | null {
  let s = art.strips.get(key)
  if (s === undefined) {
    const e = art.manifest?.[key]
    if (e === undefined) return null
    const img = load(`${art.base}anim-px/${key}.png`)
    s = { img, cw: e.cell[0], ch: e.cell[1], feet: e.feet, bodyPx: e.bodyPx, tint: [null, null] }
    const made = s
    if (e.kind === 'soldier') img.addEventListener('load', () => { made.tint = [teamTint(img, 0), teamTint(img, 1)] })
    art.strips.set(key, s)
  }
  return s.img.complete && s.img.naturalWidth > 0 ? s : null
}

export function stripFor(art: Art, grp: string, kind: string): Strip | null {
  const k = art.manifest?.[kind]?.kind === 'soldier' ? kind : GRP_STRIP[grp] ?? 'militia'
  return stripByKey(art, k)
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
