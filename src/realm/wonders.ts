/**
 * 곳간을 부을 곳 (위원회 11-08 ⑦ · docs/realm/council/1108 loop L2·L6 · design ⑧) — 판 뒤로 갈수록 곡식·철이 수십 배로 쌓이는데
 * 큰 곡식을 붓고 싶은 곳이 없었다 (형의 판 #15 곡식 25 → 7168 · 쉬움 봇 판 43654). 두 가지를 둔다 — 쉬움부터 모든 단계에.
 *
 * 1. 큰 공사 (나라의 기념물 · 문명의 불가사의) — 판에 하나씩뿐인 큰 공사 넷. 도읍에 비계를 세우고 단마다 곡식과 쇠·나무를 붓는다.
 *    한 단은 wonderStageSeasons 계절 걸리고 wonderStages 단을 다 쌓으면 선다. 값은 나라의 그릇(scale.ts)만큼 — 늘 우리 벌이에 맞는 크기.
 *    남의 나라도 짓는다 — 같은 것을 먼저 다 지은 나라가 갖고, 늦은 나라는 부은 것의 wonderRefund 몫을 돌려받는다.
 *    다 지은 공사는 그 고을에 선다 — 고을을 쥔 나라가 그 힘을 갖는다 (빼앗으면 우리 것이 된다).
 *    짓는 동안 그 고을을 잃으면 공사는 무너진다.
 * 2. 큰 잔치 (bigFeast) — 곳간의 feastShare 몫을 붓고 굴림 하나: 이름난 손님(장수) · 이웃 왕의 방문(호감) · 좋은 잔치(사기·장수 공).
 *    확률은 보인다 (우리 것은 % · ODDS.md). 판 안 곡식으로만 굴린다 — 돈으로 사는 뽑기가 아니다 (MONEY.md).
 *
 * 판 상태만 읽고 쓴다 · 굴림은 roll() 하나 (결정론 A1).
 */
import { P } from '../tune/params.ts'
import { roll } from '../core/rng.ts'
import { seasons } from './calendar.ts'
import { addGood, goodOf, stockOf } from './economy.ts'
import { addFavor, relationOf } from './diplomacy.ts'
import { knows } from './discovery.ts'
import { addMerit } from './drill.ts'
import { famedOf } from './merchant.ts'
import { realmScale } from './scale.ts'
import { HERO_POOL } from './data/heroes-pool.ts'
import type { Good, Order, Realm, RNode, ReportLine } from './types.ts'

export type WonderId = 'dolmen' | 'sotdae' | 'furnace' | 'altar'
export const WONDER_ORDER: readonly WonderId[] = ['sotdae', 'furnace', 'dolmen', 'altar']

export interface WonderDef {
  readonly name: string
  /** 그림 (public/realm/icon) — 있는 그림을 빌린다 (ART-QUEUE 에 제 그림) */
  readonly icon: string
  /** 곡식 말고 붓는 것 */
  readonly good: Exclude<Good, 'grain'>
}

export const WONDERS: Readonly<Record<WonderId, WonderDef>> = {
  sotdae: { name: '솟대 숲', icon: 'route-sotdae', good: 'wood' },
  furnace: { name: '큰 쇠부리 가마', icon: 'settle-forge', good: 'wood' },
  dolmen: { name: '고인돌 큰 무덤', icon: 'emblem-dolmen', good: 'iron' },
  altar: { name: '소도 큰 제단', icon: 'settle-sodo-grove', good: 'iron' },
}

/** 짓는 중인 큰 공사 — stage 는 다 쌓은 단 · busy 는 지금 쌓는 단이 끝나는 턴 (없으면 쉬는 중) · poured 는 부은 것 (늦으면 몫을 돌려받는다) */
export interface WonderWork {
  readonly faction: string
  readonly node: string
  readonly what: WonderId
  stage: number
  busy?: number
  poured: { grain: number; good: number }
}

/** 다 지은 그 공사가 선 고을 — 없으면 null */
export function wonderNode(r: Realm, what: WonderId): RNode | null {
  // 판에 하나뿐이라 차례가 상관없다 — 자주 불리니(nodeYield) 줄 세우지 않고 훑는다
  for (const id in r.nodes) if (r.nodes[id]!.wonder === what) return r.nodes[id]!
  return null
}

/** 그 나라가 이 공사의 힘을 갖나 — 공사가 선 고을을 쥐었다 */
export function hasWonder(r: Realm, faction: string, what: WonderId): boolean {
  const n = wonderNode(r, what)
  return n !== null && n.owner === faction
}

/** 그 나라가 짓는 중인 공사 (나라마다 한 번에 하나) */
export function wonderWorkOf(r: Realm, faction: string): WonderWork | null {
  return (r.wonderWorks ?? []).find((w) => w.faction === faction) ?? null
}

/** 한 단 값 — 나라의 그릇만큼 (곡식 · 그 공사의 쇠나 나무) */
export function wonderStageCost(r: Realm, faction: string, what: WonderId): { grain: number; good: Exclude<Good, 'grain'>; n: number } {
  const s = realmScale(r, faction)
  return { grain: Math.round(P.realm.wonderGrain * s), good: WONDERS[what].good, n: Math.round(P.realm.wonderGood * s) }
}

/** 큰 일(공사·잔치)이 열리나 — 나라의 그릇이 wonderOpenAt 을 넘었다 (배우는 판·장 빼고) */
export function greatOpen(r: Realm, faction: string): boolean {
  return r.region !== 'tutorial' && r.scenario === undefined && r.factions[faction] !== undefined && realmScale(r, faction) >= P.realm.wonderOpenAt
}

/** 이 공사에 지금 한 단을 부을 수 없는 까닭 — 되면 null (곳간은 따로 · canWonder) */
export function wonderBlocked(r: Realm, faction: string, what: WonderId): string | null {
  if (wonderNode(r, what) !== null) return '이미 섰습니다'
  if (!greatOpen(r, faction)) return '나라가 더 커져야 합니다'
  const cap = r.factions[faction]?.capital
  if (cap === undefined || r.nodes[cap]?.owner !== faction) return '도읍이 있어야 합니다'
  const w = wonderWorkOf(r, faction)
  if (w !== null && w.what !== what) return `${WONDERS[w.what].name}부터 다 지어야 합니다`
  if (w !== null && w.busy !== undefined) return '한 단을 쌓는 중입니다'
  return null
}

export function canWonder(r: Realm, faction: string, what: WonderId): boolean {
  if (wonderBlocked(r, faction, what) !== null) return false
  const c = wonderStageCost(r, faction, what)
  const s = stockOf(r, faction)
  return s.grain >= c.grain && goodOf(s, c.good) >= c.n
}

/** 한 단을 붓는다 — 처음이면 도읍에 비계를 세운다 */
export function applyWonder(r: Realm, o: Extract<Order, { kind: 'wonder' }>, lines: ReportLine[]): void {
  if (!canWonder(r, o.faction, o.what)) return
  const c = wonderStageCost(r, o.faction, o.what)
  stockOf(r, o.faction).grain -= c.grain
  addGood(r, o.faction, c.good, -c.n)
  let w = wonderWorkOf(r, o.faction)
  if (w === null) {
    w = { faction: o.faction, node: r.factions[o.faction]!.capital, what: o.what, stage: 0, poured: { grain: 0, good: 0 } }
    ;(r.wonderWorks ??= []).push(w)
  }
  w.poured.grain += c.grain
  w.poured.good += c.n
  w.busy = r.season + Math.max(1, seasons(r, P.realm.wonderStageSeasons)) - 1
  lines.push({ kind: 'wonder', faction: o.faction, what: o.what, node: w.node, ev: 'pour', stage: w.stage + 1, grain: c.grain })
}

/**
 * 쌓던 단이 끝난다 — 다 쌓으면 그 고을에 선다 · 같은 것을 짓던 나라는 부은 몫을 돌려받는다 · 짓는 동안 고을을 잃으면 무너진다
 * (턴마다 · stepWorks 곁)
 */
export function stepWonders(r: Realm, lines: ReportLine[]): void {
  const R = P.realm
  const keep: WonderWork[] = []
  const done: WonderWork[] = []
  for (const w of r.wonderWorks ?? []) {
    const n = r.nodes[w.node]
    if (n === undefined || n.owner !== w.faction || r.factions[w.faction] === undefined) {
      lines.push({ kind: 'wonder', faction: w.faction, what: w.what, node: w.node, ev: 'lost', stage: w.stage })
      continue
    }
    if (w.busy !== undefined && w.busy <= r.season) {
      w.stage += 1
      delete w.busy
      if (w.stage >= Math.round(R.wonderStages) && wonderNode(r, w.what) === null && done.every((d) => d.what !== w.what)) { done.push(w); continue }
      lines.push({ kind: 'wonder', faction: w.faction, what: w.what, node: w.node, ev: 'stage', stage: w.stage })
    }
    keep.push(w)
  }
  for (const w of done) {
    r.nodes[w.node] = { ...r.nodes[w.node]!, wonder: w.what }
    lines.push({ kind: 'wonder', faction: w.faction, what: w.what, node: w.node, ev: 'done', stage: w.stage })
  }
  // 남이 먼저 다 지었다 — 같은 것을 짓던 나라는 부은 것의 몫을 돌려받고 비계를 걷는다
  r.wonderWorks = keep.filter((w) => {
    if (wonderNode(r, w.what) === null) return true
    const grain = Math.round(w.poured.grain * R.wonderRefund)
    stockOf(r, w.faction).grain += grain
    addGood(r, w.faction, WONDERS[w.what].good, Math.round(w.poured.good * R.wonderRefund))
    const by = wonderNode(r, w.what)!.owner ?? ''
    lines.push({ kind: 'wonder', faction: w.faction, what: w.what, node: w.node, ev: 'beaten', stage: w.stage, grain, by })
    return false
  })
}

// ───────── 다 지은 공사의 힘 — 그 고을을 쥔 나라에

/** 가을걷이 곱 — 솟대 숲 */
export const wonderHarvestMul = (r: Realm, f: string): number => (hasWonder(r, f, 'sotdae') ? 1 + P.realm.wonderHarvest : 1)
/** 쇠 곱 — 큰 쇠부리 가마 (모든 고을의 쇠) */
export const wonderIronMul = (r: Realm, f: string | null): number => (f !== null && hasWonder(r, f, 'furnace') ? 1 + P.realm.wonderIron : 1)
/** 싸움의 처음 사기 가산 — 소도 큰 제단 */
export const wonderMorale = (r: Realm, f: string): number => (hasWonder(r, f, 'altar') ? P.realm.wonderMorale : 0)
/** 지킴 곱 — 고인돌 큰 무덤이 선 고을 (그 고을을 지키는 쪽) */
export const wonderFort = (n: RNode): number => (n.wonder === 'dolmen' ? P.realm.wonderFort : 1)

/** 그 공사의 힘을 숫자로 — 화면이 「가을걷이 +20%」처럼 (엔진이 쓰는 값과 같다) */
export function wonderEffect(what: WonderId): string {
  const R = P.realm
  switch (what) {
    case 'sotdae': return `가을걷이 +${Math.round(R.wonderHarvest * 100)}%`
    case 'furnace': return `쇠 +${Math.round(R.wonderIron * 100)}%`
    case 'dolmen': return `도읍 지킴 +${Math.round((R.wonderFort - 1) * 100)}%`
    case 'altar': return `싸움 사기 +${Math.round(R.wonderMorale * 100)}`
  }
}

/**
 * 남이 짓는 공사 — 우리가 아는 나라만 · 단은 범위로 (남의 속은 범위 · ODDS.md). lo..hi 는 다 쌓은 단의 짐작
 */
export function rivalWonders(r: Realm, me: string): Array<{ faction: string; what: WonderId; lo: number; hi: number }> {
  const max = Math.round(P.realm.wonderStages)
  return (r.wonderWorks ?? []).filter((w) => w.faction !== me && knows(r, me, w.faction))
    .map((w) => ({ faction: w.faction, what: w.what, lo: Math.max(0, w.stage - 1), hi: Math.min(max - 1, w.stage + 1) }))
}

// ───────── 큰 잔치

export type FeastGot = 'guest' | 'king' | 'joy'

/** 잔치에 부을 곡식 — 곳간의 feastShare 몫 */
export function feastPour(r: Realm, faction: string): number {
  return Math.floor(Math.max(0, stockOf(r, faction).grain) * P.realm.feastShare)
}

/** 잔치를 열 만한 가장 작은 곡식 — 나라의 그릇만큼 */
export function feastFloor(r: Realm, faction: string): number {
  return Math.round(P.realm.feastMinGrain * realmScale(r, faction))
}

/** 다음 잔치를 열 수 있는 턴 */
export function feastNext(r: Realm, faction: string): number {
  const at = r.feastAt?.[faction]
  return at === undefined ? 0 : at + seasons(r, P.realm.feastEvery)
}

/** 잔치에 올 이웃 왕 — 우리가 아는 살아 있는 나라 가운데 싸우지 않는, 호감이 가장 낮은 나라 (가장 덕 볼 사이 · 같으면 id 순) */
function feastKing(r: Realm, faction: string): string | null {
  const alive = (f: string): boolean => Object.values(r.nodes).some((n) => n.owner === f)
  const xs = Object.keys(r.factions).filter((f) => f !== faction && alive(f) && knows(r, faction, f) && relationOf(r, faction, f).state !== 'war')
    .map((f) => ({ f, v: relationOf(r, faction, f).favor ?? 0 })).sort((a, b) => a.v - b.v || (a.f < b.f ? -1 : 1))
  return xs[0]?.f ?? null
}

/** 잔치의 굴림 — 갈래마다 확률 (5% 단위 · 합 1). 손님이 없으면(장수 풀이 비었다) 그 몫은 좋은 잔치로 · 올 왕이 없어도 */
export function feastOdds(r: Realm, faction: string): Record<FeastGot, number> {
  const R = P.realm
  const guest = famedOf(r) !== undefined ? R.feastGuest : 0
  const king = feastKing(r, faction) !== null ? R.feastKing : 0
  return { guest, king, joy: Math.max(0, 1 - guest - king) }
}

/** 잔치를 못 여는 까닭 — 되면 null */
export function feastBlocked(r: Realm, faction: string): string | null {
  if (!greatOpen(r, faction)) return '나라가 더 커져야 합니다'
  if (r.season < feastNext(r, faction)) return '지난 잔치의 여운이 남았습니다'
  if (feastPour(r, faction) < feastFloor(r, faction)) return '곳간이 더 차야 합니다'
  return null
}

/** 큰 잔치를 연다 — 곳간의 몫을 붓고 굴린다 (도읍에서) */
export function applyFeast(r: Realm, o: Extract<Order, { kind: 'feast' }>, lines: ReportLine[]): void {
  if (feastBlocked(r, o.faction) !== null) return
  const R = P.realm
  const grain = feastPour(r, o.faction)
  const odds = feastOdds(r, o.faction)
  stockOf(r, o.faction).grain -= grain
  ;(r.feastAt ??= {})[o.faction] = r.season
  const x = roll(r.seed, r.season, `feast:${o.faction}`)
  const got: FeastGot = x < odds.guest ? 'guest' : x < odds.guest + odds.king ? 'king' : 'joy'
  const p = odds[got]
  if (got === 'guest') {
    const who = HERO_POOL.find((h) => h.id === famedOf(r))!
    ;(r.poolUsed ??= []).push(who.id)
    // 이름난 손님 — 값 없이 들일 수 있다 (도읍에 · 보통 떠돌이처럼 머물다 떠난다)
    ;(r.wanderers ??= []).push({ hero: structuredClone(who), node: r.factions[o.faction]!.capital, until: r.season + seasons(r, R.wandererStay), price: 0 })
    lines.push({ kind: 'feast', faction: o.faction, grain, got, who: who.id, p })
    return
  }
  if (got === 'king') {
    const king = feastKing(r, o.faction)!
    addFavor(r, o.faction, king, R.feastFavor)
    lines.push({ kind: 'feast', faction: o.faction, grain, got, who: king, p })
    return
  }
  for (const a of Object.values(r.armies)) if (a.faction === o.faction) a.morale = Math.min(R.moraleMax, a.morale + R.feastMorale)
  for (const h of Object.values(r.heroes).sort((a, b) => (a.id < b.id ? -1 : 1))) if (h.faction === o.faction && h.status === 'free') addMerit(r, h.id, R.feastMerit)
  lines.push({ kind: 'feast', faction: o.faction, grain, got, p })
}
