/**
 * 유물 — 이긴 판의 껴묻거리를 장수가 지닌다 (docs/realm/HERO-GROWTH.md ★ 둘째 판 §B · 형 10-26: "획득한 유물은 장수가 장착 … 아티팩트 같은 느낌으로").
 *
 *   판 끝   이기면 「옛 무덤을 열었다」 — 판의 땅에서 상자 셋 (drawChests · 판의 시드로 정한다 → 다시 열어도 같은 셋). 하나를 고른다.
 *   단련터  장수마다 유물 한 칸 (단련 relicTwoAt 넘으면 두 칸). 다른 장수에게서 옮겨 끼워도 된다. 유물은 잃지 않는다.
 *   다음 판 판을 열 때 우리 장수(drillRealm 뒤)에 지닌 유물을 붙인다 (relicRealm) — `Hero.relics`. 판은 그 효과를 읽는다.
 *
 * 표는 data/relics.ts. 순수한 셈만 한다 — 판 밖 기록(hanbal.realm.relics)을 이 기기에 두는 일은 화면(ui/realm/relics.ts)이 한다.
 * 굴림은 roll(시드) 뿐 (A1).
 */
import { roll } from '../core/rng.ts'
import { P } from '../tune/params.ts'
import { RELIC, RELICS, poolOf, type RelicDef, type RelicFx, type RelicTier } from './data/relics.ts'
import type { GrowStat, Hero, Realm, RegionId } from './types.ts'

// ───────── 판 안 — 지닌 유물의 효과

/** 그 장수가 지닌 유물 (표에 없는 id 는 건너뛴다) */
export function relicDefs(h: Pick<Hero, 'relics'> | null | undefined): RelicDef[] {
  const out: RelicDef[] = []
  for (const id of h?.relics ?? []) { const d = RELIC[id]; if (d !== undefined) out.push(d) }
  return out
}

type NumKind = Exclude<RelicFx['kind'], 'soon' | 'stat' | 'room'>

/** 그 효과의 숫자들 — 지닌 유물마다 */
function knobs(h: Pick<Hero, 'relics'> | null | undefined, kind: NumKind): number[] {
  const out: number[] = []
  for (const d of relicDefs(h)) for (const f of d.fx) if (f.kind === kind) out.push(P.realm[f.by])
  return out
}

/** 더하는 효과의 합 (사기 · 철 · 수확 · 사신 · 겨루기) — 없으면 0 */
export function relicSum(h: Pick<Hero, 'relics'> | null | undefined, kind: NumKind): number {
  return knobs(h, kind).reduce((a, b) => a + b, 0)
}

/** 곱하는 효과의 곱 (기병 힘 · 정) — 없으면 1 */
export function relicMul(h: Pick<Hero, 'relics'> | null | undefined, kind: NumKind): number {
  return knobs(h, kind).reduce((a, b) => a * b, 1)
}

/** 간두령 — 이끄는 군대 사기 덤 */
export const relicMoraleOf = (h: Pick<Hero, 'relics'> | null): number => relicSum(h, 'morale')
/** 천마도 말다래 · 기마인물형 토기 — 이끄는 기병의 힘 배수 */
export const relicHorseMulOf = (h: Pick<Hero, 'relics'> | null): number => relicMul(h, 'horse')

/** 지닌 유물이 넓힌 단련 그릇 — 능력치마다 (stat 유물은 그릇을 먹지 않으니 여기 안 든다) */
export function relicRoom(ids: readonly string[]): Partial<Record<GrowStat, number>> {
  const out: Partial<Record<GrowStat, number>> = {}
  for (const id of ids) for (const f of RELIC[id]?.fx ?? []) if (f.kind === 'room') out[f.stat] = (out[f.stat] ?? 0) + P.realm[f.by]
  return out
}

/** 지닌 유물이 판을 열 때 더하는 능력치 */
export function relicStats(ids: readonly string[]): Partial<Record<GrowStat, number>> {
  const out: Partial<Record<GrowStat, number>> = {}
  for (const id of ids) for (const f of RELIC[id]?.fx ?? []) if (f.kind === 'stat') out[f.stat] = (out[f.stat] ?? 0) + P.realm[f.by]
  return out
}

/** 장수 하나가 지니는 유물 수 — 단련 단계로 */
export function slotsFor(level: number): number {
  return level >= P.realm.relicTwoAt ? P.realm.relicSlotsHigh : P.realm.relicSlots
}

// ───────── 다음 판 — 유물을 지니고 온다

/** 유물을 지닌 몸 — 능력치 유물은 10 에 막힌 몫을 뺀 만큼 더한다 (relicAdd). 지닌 것이 없으면 받은 그대로 */
export function applyRelics(hero: Hero, ids: readonly string[]): Hero {
  const keep = ids.filter((id) => RELIC[id] !== undefined)
  if (keep.length === 0) return hero
  const out: Hero = { ...hero, relics: keep }
  const add: Partial<Record<GrowStat, number>> = {}
  for (const [s, n] of Object.entries(relicStats(keep)) as Array<[GrowStat, number]>) {
    const v = Math.min(10, hero[s] + n)
    if (v > hero[s]) add[s] = v - hero[s]
    out[s] = v
  }
  if (Object.keys(add).length > 0) out.relicAdd = add
  return out
}

/**
 * 판을 열 때 — 우리 장수(처음 장수 · 군주 · 데려온 동행)에 지닌 유물을. 남의 나라 장수 · 배우는 판은 안 붙인다.
 * 칸 수는 판을 열 때의 단련 단계로 (drillRealm 뒤에 부른다). 붙인 장수 id 를 돌려준다
 */
export function relicRealm(r: Realm, wear: Readonly<Record<string, readonly string[]>>): string[] {
  if (r.region === 'tutorial') return []
  const out: string[] = []
  for (const id of Object.keys(r.heroes).sort()) {
    const h = r.heroes[id]!
    const ids = wear[id]
    if (h.faction !== r.player || h.relics !== undefined || ids === undefined || ids.length === 0) continue
    const next = applyRelics(h, ids.slice(0, slotsFor(h.drill?.lv ?? 0)))
    if (next === h) continue
    r.heroes[id] = next
    out.push(id)
  }
  return out
}

// ───────── 판 밖 기록 — 모은 유물 · 지닌 장수 · 연 무덤

export interface RelicOwn {
  /** 고른 횟수 (같은 것을 또 고르면 는다) */
  n: number
  /** 처음 찾은 판의 시드 · 땅 */
  seed: number
  region?: RegionId
}

/** 연 무덤 — 놓인 상자 셋 · 고른 것 (아직 안 골랐으면 null) */
export interface RelicTomb {
  ids: string[]
  pick: string | null
}

export interface RelicStore {
  v: 1
  own: Record<string, RelicOwn>
  /** 장수 id → 지닌 유물 (칸 차례) */
  wear: Record<string, string[]>
  /** 판(시드) → 연 무덤 — 같은 판은 한 번만 고른다 */
  tombs: Record<string, RelicTomb>
  /** tombs 의 판 차례 — 오래된 것부터 덜어 낸다 */
  order: string[]
}

export function emptyRelics(): RelicStore {
  return { v: 1, own: {}, wear: {}, tombs: {}, order: [] }
}

const tierWeight = (t: RelicTier): number =>
  Math.max(0, t === 'legend' ? P.realm.relicWeightLegend : t === 'rare' ? P.realm.relicWeightRare : P.realm.relicWeightCommon)

/**
 * 옛 무덤의 상자 — 판의 땅에서 relicChests 개 (판의 시드로 정한다). 아직 없는 것부터, 모자라면 있는 것 · 그래도 모자라면 다른 땅의 것.
 * 귀함마다 무게(흔함 6 · 귀함 3 · 보배 1)로 뽑는다. 같은 것은 두 번 안 놓인다
 */
export function drawChests(seed: number, region: RegionId, owned: Readonly<Record<string, unknown>>): string[] {
  const n = Math.max(1, Math.floor(P.realm.relicChests))
  const pool = poolOf(region)
  const fresh = pool.filter((x) => owned[x.id] === undefined)
  const tiers: RelicDef[][] = [fresh, pool.filter((x) => owned[x.id] !== undefined), RELICS.filter((x) => !pool.includes(x) && owned[x.id] === undefined), RELICS.filter((x) => !pool.includes(x))]
  const out: string[] = []
  for (let i = 0; i < n; i++) {
    const from = tiers.map((t) => t.filter((x) => !out.includes(x.id))).find((t) => t.length > 0)
    if (from === undefined) break
    const total = from.reduce((s, x) => s + tierWeight(x.tier), 0)
    let at = roll(seed, i, `relic-chest:${region}`) * (total > 0 ? total : from.length)
    let got = from[from.length - 1]!
    for (const x of from) {
      at -= total > 0 ? tierWeight(x.tier) : 1
      if (at < 0) { got = x; break }
    }
    out.push(got.id)
  }
  return out
}

/** 판의 열쇠 — 시드 (같은 판은 몇 번을 열어도 한 번만 고른다) */
export const tombKey = (seed: number): string => String(seed)

/** 무덤을 연다 — 이미 연 판이면 그 무덤 그대로, 아니면 새로 상자를 놓은 새 기록 */
export function openTomb(store: RelicStore, seed: number, region: RegionId): RelicStore {
  const key = tombKey(seed)
  if (store.tombs[key] !== undefined) return store
  const ids = drawChests(seed, region, store.own)
  const order = [...store.order.filter((x) => x !== key), key]
  const tombs = { ...store.tombs, [key]: { ids, pick: null } }
  while (order.length > Math.max(1, P.realm.relicKeepRuns)) delete tombs[order.shift()!]
  return { ...store, tombs, order }
}

/** 상자 하나를 고른다 — 그 판에서 한 번만 · 놓인 상자 가운데서만. 못 고르면 받은 그대로 */
export function pickTomb(store: RelicStore, seed: number, id: string, region?: RegionId): RelicStore {
  const key = tombKey(seed)
  const t = store.tombs[key]
  if (t === undefined || t.pick !== null || !t.ids.includes(id) || RELIC[id] === undefined) return store
  const was = store.own[id]
  const own: Record<string, RelicOwn> = { ...store.own, [id]: was !== undefined ? { ...was, n: was.n + 1 } : { n: 1, seed, ...(region !== undefined ? { region } : {}) } }
  return { ...store, own, tombs: { ...store.tombs, [key]: { ...t, pick: id } } }
}

/** 그 유물을 지닌 장수 — 없으면 null */
export function holderOf(store: RelicStore, relic: string): string | null {
  for (const hid of Object.keys(store.wear).sort()) if (store.wear[hid]!.includes(relic)) return hid
  return null
}

/**
 * 장수의 칸에 유물을 끼운다 — 가진 것만 · 칸은 slotsFor(단련). 다른 장수가 지녔으면 그에게서 뺀다 (하나는 한 사람만 지닌다).
 * 같은 장수의 다른 칸에 있었으면 자리만 바꾼다. 못 끼우면 받은 그대로
 */
export function equip(store: RelicStore, hero: string, slot: number, relic: string, level: number): RelicStore {
  if (store.own[relic] === undefined || RELIC[relic] === undefined) return store
  const slots = slotsFor(level)
  if (slot < 0 || slot >= slots) return store
  const wear: Record<string, string[]> = {}
  for (const [hid, ids] of Object.entries(store.wear)) {
    const left = ids.filter((x) => x !== relic)
    if (left.length > 0) wear[hid] = left
  }
  const mine = (wear[hero] ?? []).slice(0, slots)
  if (slot < mine.length) mine[slot] = relic
  else mine.push(relic)
  wear[hero] = mine
  return { ...store, wear }
}

/** 장수의 칸을 비운다 */
export function unequip(store: RelicStore, hero: string, slot: number): RelicStore {
  const ids = store.wear[hero]
  if (ids === undefined || slot < 0 || slot >= ids.length) return store
  const left = ids.filter((_, i) => i !== slot)
  const wear = { ...store.wear }
  if (left.length > 0) wear[hero] = left
  else delete wear[hero]
  return { ...store, wear }
}

// ───────── 글 — 효과 한 줄

const STAT_WORD: Readonly<Record<GrowStat, string>> = { mu: '무예', tong: '통솔', ryak: '지략', chi: '내정', deok: '매력' }
const pct = (v: number): string => `${Math.round(v * 100)}%`

/** 효과 한 조각의 글 — soon 은 그 글 그대로 */
export function fxText(f: RelicFx): string {
  if (f.kind === 'soon') return f.text
  const v = P.realm[f.by]
  switch (f.kind) {
    case 'stat': return `${STAT_WORD[f.stat]} +${v}`
    case 'room': return `${STAT_WORD[f.stat]} 그릇 +${v}`
    case 'morale': return `이끄는 군대 사기 +${pct(v)}`
    case 'horse': return `이끄는 기병 힘 +${pct(v - 1)}`
    case 'bond': return `정이 ${v}배 빨리 찬다`
    case 'iron': return `맡은 고을 철 +${v} (계절마다)`
    case 'farm': return `맡은 고을 수확 +${pct(v)}`
    case 'crown': return `군주가 지니면 나라 수확 +${pct(v)}`
    case 'envoy': return `따라간 사신이 받아들여질 몫 +${pct(v)}`
    case 'duel': return `겨루기 무예 +${v}`
  }
}

/** 유물 하나의 효과 한 줄 — 「곧 쓰인다」가 붙는 것은 아직 판에 안 걸렸다 */
export function relicLine(id: string): string {
  const d = RELIC[id]
  if (d === undefined) return ''
  return d.fx.map((f) => (f.kind === 'soon' ? `${f.text} (곧 쓰인다)` : fxText(f))).join(' · ')
}

/** 판에 걸린 효과가 하나라도 있나 */
export const relicLive = (id: string): boolean => (RELIC[id]?.fx ?? []).some((f) => f.kind !== 'soon')
