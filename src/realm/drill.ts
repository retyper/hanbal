/**
 * 단련 — 판을 넘어 자라는 장수 (docs/realm/HERO-GROWTH.md ★ 둘째 판 §A · §D-1 · 형 10-26: "엘든링·다크소울식 패배 후 성장을 통해 재도전").
 *
 *   판 안   우리 장수마다 **공(功)** 이 쌓인다 — 싸움 · 겨루기 · 적장 사로잡음 · 고을 맡은 계절 · 군대 이끈 계절 · 공작 · 사신 (`r.merit`).
 *   판 끝   이기든 지든 공을 판 밖 **단련 공**으로 새긴다 (이기면 × drillWinMul). 쓰러진 장수도 공은 남고 다음 판엔 돌아온다.
 *   단련터  단련 n → n+1 은 공 (n + drillCostBase). 한 단계에 능력치 하나 +1 — 무엇을 올릴지 형이 고른다. 의리는 안 자란다.
 *   그릇    능력치마다 타고난 값 + drillRoom, 10 은 못 넘는다 (인플레 금지 · VISION §6).
 *   다음 판 판을 열 때 우리 장수(우리 나라 처음 장수 · 군주 · 데려온 동행)에 단련 몸을 입힌다. 남의 나라의 같은 사람은 처음 몸.
 *
 * 난세 단계와 상관없다 — 단계는 적을 세게 할 뿐 우리 단련을 깎지 않는다 (옛 안의 「대왕까지만」·「두 칸」은 버렸다).
 * 배우는 판은 공을 세지도 단련을 입히지도 않는다 (동행도 안 오는 판이다).
 *
 * 순수한 셈만 한다 — 판 밖 기록(hanbal.realm.drill)을 이 기기에 두는 일은 화면(ui/realm/drill.ts)이 한다. 굴림이 없다 (A1).
 */
import { P } from '../tune/params.ts'
import type { GrowStat, Hero, Realm, ReportLine, Vow } from './types.ts'

/** 단련으로 오르는 다섯 — 의리는 타고난다 */
export const DRILL_STATS: readonly GrowStat[] = ['mu', 'tong', 'ryak', 'chi', 'deok']

/** 판 밖 장수 하나의 단련 */
export interface DrillEntry {
  /** 아직 안 쓴 단련 공 */
  points: number
  /** 단련 단계 — 올린 칸의 합 (카드의 「단련 n」) */
  level: number
  /** 능력치마다 올린 몫 */
  add: Partial<Record<GrowStat, number>>
  /** 공을 새긴 판 수 */
  runs: number
  /** 마지막으로 새긴 판의 시드 */
  lastSeed?: number
  /** 첫 화면 단련터에서 판 없이 보이려고 — 이름 · 얼굴 짝 · 처음 몸 (영웅전 명부에 없는 아이를 위해) */
  name?: string
  look?: 'g' | 'w'
  born?: Partial<Record<GrowStat, number>>
  /** 판 밖에서 움직인 의리 — 타고난 값에 더한다 (−·+ · 위로는 uiriRoom 까지) · 그 까닭 (가장 최근이 끝) · 마지막으로 새긴 판 */
  uiri?: number
  tales?: Vow[]
  uiriSeed?: number
}

/** 판 밖 단련 기록 — `paid` 판(시드)마다 이미 새긴 공 (같은 판을 두 번 새기지 않게 · 무한 모드로 이어 둔 몫만 더 새긴다) */
export interface DrillStore {
  v: 1
  h: Record<string, DrillEntry>
  paid: Record<string, Record<string, number>>
  /** paid 의 판 차례 — 오래된 것부터 덜어 낸다 */
  order: string[]
}

export function emptyDrill(): DrillStore {
  return { v: 1, h: {}, paid: {}, order: [] }
}

// ───────── 판 안 — 공 쌓기

/** 공이 붙는 장수 — 지금 우리 장수일 때만 (남의 나라에 있던 동안 한 일은 우리 공이 아니다) */
function oursNow(r: Realm, id: string | null | undefined): boolean {
  if (id === null || id === undefined || r.region === 'tutorial') return false
  return r.heroes[id]?.faction === r.player
}

/** 공을 더한다 — 우리 장수만 */
export function addMerit(r: Realm, id: string | null | undefined, n: number): void {
  if (n <= 0 || !oursNow(r, id)) return
  const m = (r.merit ??= {})
  m[id!] = (m[id!] ?? 0) + n
}

/** 이 판에서 그 장수가 쌓은 공 (옛 판은 0 에서) */
export function meritOf(r: Realm, id: string): number {
  return r.merit?.[id] ?? 0
}

/**
 * 싸움이 끝났다 — 선 장수마다 싸움 공(이기면 더), 겨루기를 이긴 장수, 적장을 사로잡았으면 우리 쪽에 선 장수마다.
 * atk·def 는 싸움 앞의 군대 장수 (사로잡히거나 쓰러진 이도 든다 — 싸운 공은 남는다). winner 는 이긴 쪽 · 교착이면 null.
 */
export function battleMerit(
  r: Realm, atk: readonly (string | null)[], def: readonly (string | null)[], winner: 'a' | 'd' | null, duelBy: string | undefined, captives: readonly string[],
): void {
  const R = P.realm
  const side = (ids: readonly (string | null)[], won: boolean): string[] => {
    const out = [...new Set(ids.filter((x): x is string => x !== null))].sort()
    for (const id of out) addMerit(r, id, won ? R.drillMeritWin : R.drillMeritFight)
    return out
  }
  const a = side(atk, winner === 'a')
  const d = side(def, winner === 'd')
  addMerit(r, duelBy, R.drillMeritDuel)
  // 사로잡은 적장 — 우리가 잡았으면(이제 우리 옥에 있다) 우리 쪽에 선 장수마다
  const caught = captives.filter((id) => r.heroes[id]?.status === 'captive' && r.heroes[id]?.captor === r.player).length
  if (caught > 0) for (const id of [...a, ...d]) addMerit(r, id, R.drillMeritCapture * caught)
}

/**
 * 계절 끝 — 고을을 맡은 장수 · 군대를 이끈 장수, 그리고 이 계절 보고에서 먹힌 공작의 자객 · 받아들여진 청의 사신.
 * season.advance 가 계절마다 한 번 부른다 (보고 줄이 다 모인 뒤).
 */
export function seasonMerit(r: Realm, lines: readonly ReportLine[]): void {
  if (r.region === 'tutorial') return
  const R = P.realm
  const me = r.player
  const leading = new Set(Object.values(r.armies).filter((a) => a.faction === me && a.hero !== null).map((a) => a.hero!))
  for (const h of Object.values(r.heroes).sort((x, y) => (x.id < y.id ? -1 : 1))) {
    if (h.faction !== me || h.status !== 'free') continue
    if (h.post !== null) addMerit(r, h.id, R.drillMeritPost)
    if (leading.has(h.id)) addMerit(r, h.id, R.drillMeritLead)
  }
  for (const l of lines) {
    if (l.kind === 'plot' && l.faction === me && l.ok) addMerit(r, l.agent, R.drillMeritPlot)
    else if (l.kind === 'envoy' && l.from === me && l.accepted) addMerit(r, l.hero, R.drillMeritEnvoy)
  }
}

// ───────── 의리 — 겪은 일로 (docs/realm/UIRI.md)

/** 의리가 움직일 일을 적는다 — 우리 장수만, 군주는 빼고. 배우는 판은 안 센다 */
export function addVow(r: Realm, id: string, v: Vow): void {
  if (r.region === 'tutorial') return
  const h = r.heroes[id]
  if (h === undefined) return
  if (Object.values(r.factions).some((f) => f.ruler === id)) return
  const m = (r.vows ??= {})
  const list = (m[id] ??= [])
  if (!list.includes(v)) list.push(v)
}

/** 이 판이 그 장수의 의리를 얼마나 움직였나 — 좋은 일이 하나라도 있으면 +1, 넘어갔으면 −1 (둘 다면 0) */
export function vowDelta(vs: readonly Vow[] | undefined): number {
  if (vs === undefined) return 0
  return (vs.some((v) => v !== 'turned') ? 1 : 0) - (vs.includes('turned') ? 1 : 0)
}

/** 판 밖 의리를 입힌 값 — 타고난 값 + 움직인 몫, [uiriMin, 타고난 값 + uiriRoom] · 10 까지 */
export function uiriWith(born: number, shift: number | undefined): number {
  const R = P.realm
  return Math.max(R.uiriMin, Math.min(10, born + R.uiriRoom, born + (shift ?? 0)))
}

/** 판이 끝났다 — 의리를 새긴 새 기록. 같은 판은 한 번만 */
export function engraveVows(store: DrillStore, r: Realm): DrillStore {
  if (r.region === 'tutorial' || r.vows === undefined) return store
  let h: Record<string, DrillEntry> | null = null
  for (const id of Object.keys(r.vows).sort()) {
    const d = vowDelta(r.vows[id])
    const was = store.h[id]
    if (was?.uiriSeed === r.seed) continue
    const body = r.heroes[id]
    const e: DrillEntry = was !== undefined ? { ...was, add: { ...was.add } } : { points: 0, level: 0, add: {}, runs: 0 }
    if (body !== undefined) {
      e.name ??= body.name
      e.look ??= body.look
      e.born ??= bornFrom(body)
    }
    const base = body !== undefined ? body.uiri - (body.drill?.uiri ?? 0) : 5
    const now = uiriWith(base, (e.uiri ?? 0) + d) - base
    e.uiri = now
    e.tales = [...(e.tales ?? []), ...r.vows[id]!].slice(-6)
    e.uiriSeed = r.seed
    ;(h ??= { ...store.h })[id] = e
  }
  return h === null ? store : { ...store, h }
}

// ───────── 판 끝 — 새기기

/** 판의 열쇠 — 시드 (같은 판은 몇 번을 열어도 한 번만 새긴다) */
export const runKey = (r: Realm): string => String(r.seed)

/** 이 판에서 새로 새길 공 — 이미 새긴 몫은 뺀다. 배우는 판은 없다 */
export function gainOf(store: DrillStore, r: Realm, won = r.outcome?.kind === 'win'): Record<string, number> {
  const out: Record<string, number> = {}
  if (r.region === 'tutorial' || r.merit === undefined) return out
  const paid = store.paid[runKey(r)] ?? {}
  for (const id of Object.keys(r.merit).sort()) {
    const g = earnedOf(r, id, won) - (paid[id] ?? 0)
    if (g > 0) out[id] = g
  }
  return out
}

/** 이 판이 그 장수에게 준 단련 공 모두 (이미 새긴 몫까지) — 끝 화면의 「+공」 */
export function earnedOf(r: Realm, id: string, won = r.outcome?.kind === 'win'): number {
  if (r.region === 'tutorial') return 0
  // 한 판에 한 장수 — drillRunFull 까지는 다, 넘는 몫은 조금만 (한 장수로 밀어도 한 판에 그릇이 차지 않게)
  const m = meritOf(r, id)
  const F = P.realm.drillRunFull
  const kept = m <= F ? m : F + (m - F) * P.realm.drillRunOver
  return Math.round(kept * (won ? P.realm.drillWinMul : 1))
}

/** 판에서 본 몸에서 처음 몸을 거꾸로 — 판 안에서 자란 몫 · 들고 온 단련 · 지닌 유물이 더한 몫을 뺀다 */
export function bornFrom(h: Hero): Partial<Record<GrowStat, number>> {
  const out: Partial<Record<GrowStat, number>> = {}
  // 각성 몫도 뺀다 — 각성은 그 판에서만 (형 10-31)
  for (const s of DRILL_STATS) out[s] = Math.max(1, h[s] - (h.grown?.[s] ?? 0) - (h.drill?.add[s] ?? 0) - (h.relicAdd?.[s] ?? 0) - (h.ascended === true ? P.realm.ascendBonus : 0))
  return out
}

/** 판이 끝났다 — 공을 판 밖 단련 공으로 새긴 새 기록 (받은 기록은 안 바꾼다) */
export function engrave(store: DrillStore, r: Realm, won: boolean): DrillStore {
  const gain = gainOf(store, r, won)
  const ids = Object.keys(gain)
  if (ids.length === 0) return store
  const key = runKey(r)
  const h: Record<string, DrillEntry> = { ...store.h }
  const paid: Record<string, Record<string, number>> = { ...store.paid, [key]: { ...(store.paid[key] ?? {}) } }
  for (const id of ids) {
    const was = h[id]
    const e: DrillEntry = was !== undefined ? { ...was, add: { ...was.add } } : { points: 0, level: 0, add: {}, runs: 0 }
    e.points += gain[id]!
    if (e.lastSeed !== r.seed) e.runs += 1
    e.lastSeed = r.seed
    const body = r.heroes[id]
    if (body !== undefined) {
      e.name = body.name
      e.look = body.look
      e.born ??= bornFrom(body)
    }
    h[id] = e
    paid[key]![id] = earnedOf(r, id, won)
  }
  const order = [...store.order.filter((x) => x !== key), key]
  while (order.length > Math.max(1, P.realm.drillKeepRuns)) delete paid[order.shift()!]
  return { v: 1, h, paid, order }
}

// ───────── 단련터 — 공을 써서 올리기

/** 단련 n 에서 n+1 로 — 처음은 빨리, 뒤로 갈수록 천천히 */
export function spendCost(level: number): number {
  return Math.max(0, Math.floor(level)) * P.realm.drillCostMul + P.realm.drillCostBase
}

/** 그 능력치의 그릇 — 타고난 값 + drillRoom (+ 지닌 유물이 넓힌 몫 room — relics.relicRoom), 10 까지 */
export function capOf(born: Pick<Hero, GrowStat>, stat: GrowStat, room: Partial<Record<GrowStat, number>> = {}): number {
  return Math.min(10, born[stat] + P.realm.drillRoom + (room[stat] ?? 0))
}

/** 처음 몸 — 넘겨받은 몸이 없으면 새길 때 적어 둔 몸 */
function bornBody(e: DrillEntry, born?: Pick<Hero, GrowStat>): Pick<Hero, GrowStat> | null {
  if (born !== undefined) return born
  const b = e.born
  if (b === undefined) return null
  return { mu: b.mu ?? 1, tong: b.tong ?? 1, ryak: b.ryak ?? 1, chi: b.chi ?? 1, deok: b.deok ?? 1 }
}

/** 올릴 수 있나 — 'ok' · 그릇이 찼다 'cap' · 공이 모자라다 'poor' · 단련 기록이 없다 'none'. room 은 지닌 유물이 넓힌 그릇 */
export function raiseState(store: DrillStore, id: string, stat: GrowStat, born?: Pick<Hero, GrowStat>, room?: Partial<Record<GrowStat, number>>): 'ok' | 'cap' | 'poor' | 'none' {
  const e = store.h[id]
  if (e === undefined || !DRILL_STATS.includes(stat)) return 'none'
  const b = bornBody(e, born)
  if (b === null) return 'none'
  if (b[stat] + (e.add[stat] ?? 0) >= capOf(b, stat, room)) return 'cap'
  return e.points >= spendCost(e.level) ? 'ok' : 'poor'
}

/** raiseState 가 'ok' 인가 — hero 는 처음 몸 (영웅전 명부의 몸) */
export function canRaise(store: DrillStore, hero: Pick<Hero, 'id' | GrowStat>, stat: GrowStat): boolean {
  return raiseState(store, hero.id, stat, hero) === 'ok'
}

/** 한 단계 올린 새 기록 — 못 올리면 받은 그대로 */
export function raise(store: DrillStore, id: string, stat: GrowStat, born?: Pick<Hero, GrowStat>, room?: Partial<Record<GrowStat, number>>): DrillStore {
  if (raiseState(store, id, stat, born, room) !== 'ok') return store
  const e = store.h[id]!
  const n: DrillEntry = { ...e, add: { ...e.add, [stat]: (e.add[stat] ?? 0) + 1 }, points: e.points - spendCost(e.level), level: e.level + 1 }
  return { ...store, h: { ...store.h, [id]: n } }
}

// ───────── 다음 판 — 단련 몸

/** 단련을 입힌 몸 — 10 에 막혀 덜 든 몫은 add 에서 뺀다. 단련이 없으면 받은 그대로 */
export function applyDrill(hero: Hero, entry: DrillEntry | undefined): Hero {
  if (entry === undefined || (entry.level <= 0 && (entry.uiri ?? 0) === 0)) return hero
  const uiri = uiriWith(hero.uiri, entry.uiri)
  const out: Hero = { ...hero, uiri }
  const add: Partial<Record<GrowStat, number>> = {}
  for (const s of DRILL_STATS) {
    const want = Math.max(0, entry.add[s] ?? 0)
    if (want === 0) continue
    const v = Math.min(10, hero[s] + want)
    if (v > hero[s]) add[s] = v - hero[s]
    out[s] = v
  }
  out.drill = { lv: entry.level, add, ...(uiri !== hero.uiri ? { uiri: uiri - hero.uiri } : {}) }
  return out
}

/**
 * 판을 열 때 — 우리 장수(처음 장수 · 군주 · 데려온 동행) 모두에 단련 몸을. 남의 나라 장수는 그대로. 배우는 판은 안 입힌다.
 * 고친 장수 id 를 돌려준다. bringRetainers 뒤에 부른다 (동행이 우리 장수가 된 뒤)
 */
export function drillRealm(r: Realm, store: DrillStore): string[] {
  if (r.region === 'tutorial') return []
  const out: string[] = []
  for (const id of Object.keys(r.heroes).sort()) {
    const h = r.heroes[id]!
    if (h.faction !== r.player || h.drill !== undefined) continue
    const e = store.h[id]
    if (e === undefined || (e.level <= 0 && (e.uiri ?? 0) === 0)) continue
    r.heroes[id] = applyDrill(h, e)
    out.push(id)
  }
  return out
}
