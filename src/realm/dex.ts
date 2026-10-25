/**
 * 도감 — 판을 넘어 남는 장수 기록 (docs/realm/VISION §5-4 · BUILD R6. 형: "적장도 있어야 하고 포획도 가능해야하고(수집욕 해소)").
 *
 * 팰월드의 팰 도감 · 디아블로의 아이템 도감 자리. 판이 깨져도 남는다 (VISION M7 — 져도 다음 판이 하고 싶다).
 * 장수 하나에 네 칸이 차례로 켜진다:
 *   들음 — 아는 나라의 장수 (이름과 얼굴만)
 *   만남 — 싸워 봤거나 정찰·첩자로 본 장수 (능력치가 보인 적이 있다 · heroes.heroSeen)
 *   사로잡음 — 우리 손에 사로잡힌 적이 있다
 *   거느림 — 우리 장수로 부린 적이 있다 (처음부터 우리 장수도 든다)
 * 등급은 그 장수의 가장 좋은 특성의 오방색 (나쁜 특성은 셈하지 않는다 — SYSTEMS §5-2).
 *
 * 순수한 셈만 한다 — 저장은 화면(ui/realm/dex.ts)이 이 기기에 한다. 배우는 판은 셈하지 않는다.
 */
import { HERO_POOL } from './data/heroes-pool.ts'
import { TRAIT, type TraitGrade } from './data/traits.ts'
import { MINI_DATA } from './data/regions/byeonhan-mini.ts'
import { YEONGNAM_DATA } from './data/regions/yeongnam.ts'
import { SOUTH_DATA } from './data/regions/south.ts'
import { WORLD_DATA } from './data/regions/world.ts'
import { startMahan } from './data/regions/mahan.ts'
import { startJumong } from './data/regions/jumong.ts'
import { startSeorabeol } from './data/regions/seorabeol.ts'
import { knows } from './discovery.ts'
import { heroSeen, wanderersFor } from './heroes.ts'
import type { Hero, Realm, RegionId } from './types.ts'

/** 네 칸 — 비트로 쌓는다 */
export const DEX_HEARD = 1
export const DEX_MET = 2
export const DEX_CAUGHT = 4
export const DEX_SERVED = 8

/** 도감 한 줄 — `f` 켜진 칸 · `b` 처음 오른 판 */
export interface DexEntry { f: number; b?: RegionId }
export type Dex = Record<string, DexEntry>

export interface DexHero {
  readonly id: string
  readonly name: string
  readonly look: 'g' | 'w'
  /** 처음 나오는 판 — 떠돌이는 'wander' */
  readonly board: RegionId | 'wander'
  /** 그 판에서 섬기는 나라 (떠돌이는 '') */
  readonly nation: string
  readonly nationName: string
  readonly ruler: boolean
  readonly grade: TraitGrade
  readonly hero: Hero
}

const GRADE_RANK: Record<TraitGrade, number> = { common: 0, good: 1, rare: 2, precious: 3, legend: 4 }

/** 장수의 등급 — 나쁘지 않은 특성 가운데 가장 좋은 것. 특성이 없으면 보통 */
export function heroGrade(h: Pick<Hero, 'traits'>): TraitGrade {
  let g: TraitGrade = 'common'
  for (const id of h.traits ?? []) {
    const t = TRAIT[id]
    if (t !== undefined && t.bad !== true && GRADE_RANK[t.grade] > GRADE_RANK[g]) g = t.grade
  }
  return g
}

let CATALOG: readonly DexHero[] | null = null

/** 도감의 모든 장수 — 작은 판 → 큰 판 → 삼한 남부 → 삼한과 북녘 → 떠돌이. 한 사람은 처음 나오는 판에 한 번 */
export function dexCatalog(): readonly DexHero[] {
  if (CATALOG !== null) return CATALOG
  const out: DexHero[] = []
  const had = new Set<string>()
  // 캠페인의 장 — 그 장의 사람들도 영웅전에 오른다 (형 10-25: 장만 하던 사람은 거느린 장수가 하나도 안 남아 데려갈 이가 없었다). 군주는 장의 판에서 읽는다
  const chapter = (r: Realm): { starts: Array<{ faction: { id: string; name: string } }>; heroes: Hero[]; rulers: Set<string> } => ({
    starts: Object.values(r.factions).map((f) => ({ faction: { id: f.id, name: f.name } })),
    heroes: Object.values(r.heroes),
    rulers: new Set(Object.values(r.factions).flatMap((f) => (f.ruler !== undefined ? [f.ruler] : []))),
  })
  const boards: ReadonlyArray<{ board: RegionId; starts: readonly { faction: { id: string; name: string } }[]; heroes: readonly Hero[]; rulers?: ReadonlySet<string> }> = [
    { board: 'byeonhan-mini', starts: MINI_DATA.NATION_STARTS, heroes: MINI_DATA.HEROES },
    { board: 'yeongnam', starts: YEONGNAM_DATA.NATION_STARTS, heroes: YEONGNAM_DATA.HEROES },
    { board: 'south', starts: SOUTH_DATA.STARTS, heroes: SOUTH_DATA.HEROES },
    { board: 'world', starts: WORLD_DATA.STARTS, heroes: WORLD_DATA.HEROES },
    { board: 'mahan', ...chapter(startMahan(1)) },
    { board: 'jumong', ...chapter(startJumong(1)) },
    { board: 'seorabeol', ...chapter(startSeorabeol(1)) },
  ]
  for (const b of boards) {
    const names = new Map(b.starts.map((s) => [s.faction.id, s.faction.name]))
    // 군주 먼저, 그다음 장군 — 나라 차례는 판의 나라 차례
    const order = new Map(b.starts.map((s, i) => [s.faction.id, i]))
    const list = b.heroes.filter((h) => !had.has(h.id)).sort((x, y) =>
      (order.get(x.faction) ?? 999) - (order.get(y.faction) ?? 999) || Number(y.id.endsWith('-ruler')) - Number(x.id.endsWith('-ruler')) || (x.id < y.id ? -1 : 1))
    for (const h of list) {
      had.add(h.id)
      out.push({ id: h.id, name: h.name, look: h.look, board: b.board, nation: h.faction, nationName: names.get(h.faction) ?? '', ruler: h.id.endsWith('-ruler') || b.rulers?.has(h.id) === true, grade: heroGrade(h), hero: h })
    }
  }
  for (const h of HERO_POOL) {
    if (had.has(h.id)) continue
    had.add(h.id)
    out.push({ id: h.id, name: h.name, look: h.look, board: 'wander', nation: '', nationName: '', ruler: false, grade: heroGrade(h), hero: h })
  }
  CATALOG = out
  return out
}

/** 켜진 칸 가운데 가장 높은 것 — 0 이면 아직 모른다 */
export function dexLevel(f: number): 0 | 1 | 2 | 3 | 4 {
  return f & DEX_SERVED ? 4 : f & DEX_CAUGHT ? 3 : f & DEX_MET ? 2 : f & DEX_HEARD ? 1 : 0
}

/** 이 판에서 그 장수에게 켜질 칸 */
function flagsIn(r: Realm, h: Hero): number {
  const me = r.player
  let f = 0
  if (h.faction === me) f |= DEX_HEARD | DEX_MET | DEX_SERVED
  if (h.status === 'captive' && h.captor === me) f |= DEX_HEARD | DEX_MET | DEX_CAUGHT
  if (heroSeen(r, me, h.id)) f |= DEX_HEARD | DEX_MET
  if (h.faction !== '' && knows(r, me, h.faction)) f |= DEX_HEARD
  return f
}

/**
 * 한 판을 훑어 도감을 채운다 — 새로 켜진 칸이 있는 장수를 돌려준다 (화면이 "도감에 올랐다"를 띄운다).
 * `dex` 는 바꾸지 않고 새 것을 돌려준다.
 */
export function scanDex(dex: Readonly<Dex>, r: Realm): { dex: Dex; fresh: Array<{ id: string; was: number; now: number }> } {
  const out: Dex = { ...dex }
  const fresh: Array<{ id: string; was: number; now: number }> = []
  if (r.region === 'tutorial') return { dex: out, fresh }
  const board: RegionId = r.region ?? 'byeonhan-mini'
  const known = new Set(dexCatalog().map((x) => x.id))
  const add = (id: string, f: number): void => {
    if (f === 0 || !known.has(id)) return
    const was = out[id]?.f ?? 0
    const now = was | f
    if (now === was) return
    out[id] = { f: now, b: out[id]?.b ?? board }
    fresh.push({ id, was, now })
  }
  for (const id of Object.keys(r.heroes).sort()) add(id, flagsIn(r, r.heroes[id]!))
  // 우리 땅에 나타난 떠돌이 — 값을 부르며 제 솜씨를 보여 준다
  for (const w of wanderersFor(r, r.player)) add(w.hero.id, DEX_HEARD | DEX_MET)
  return { dex: out, fresh }
}

/** 칸마다 센 수 — 도감 머리의 셈 */
export function dexCounts(dex: Readonly<Dex>): { total: number; heard: number; met: number; caught: number; served: number } {
  const all = dexCatalog()
  let heard = 0, met = 0, caught = 0, served = 0
  for (const x of all) {
    const f = dex[x.id]?.f ?? 0
    if (f & DEX_HEARD) heard++
    if (f & DEX_MET) met++
    if (f & DEX_CAUGHT) caught++
    if (f & DEX_SERVED) served++
  }
  return { total: all.length, heard, met, caught, served }
}
