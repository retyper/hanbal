/**
 * 제천 대회 — 궁궐 3단 이상의 하늘 제사 (docs/realm/CAPITAL.md §1-3 · 카드 P3)
 *
 * 삼국지 동이전의 하늘 제사: 부여 영고(정월) · 고구려 동맹 · 동예 무천 · 삼한 시월 제사. 그 결의 달이 오면 해마다 한 번 카드가 뜬다.
 * 새 카드 갈래를 따로 만들지 않고 옛 `skyfest`(하늘 제사)에 `grand` 를 붙여 키운다 — 3단 아래에서는 옛 카드 그대로.
 * 고름 셋: 활쏘기 겨루기(0) · 장수 겨루기(1) · 노래와 춤(2). 놀이의 결과는 카드 Order 의 held(1 이김 · 0 짐)에 적힌다 (events.cardPreview).
 *
 * 판 상태만 읽는다 · 굴림은 roll(seed, 턴, 열쇠) — 같은 판이면 같은 상대 (결정론 A1).
 */
import { roll } from '../core/rng.ts'
import { P } from '../tune/params.ts'
import { monthOf, yearOf } from './calendar.ts'
import { kyeolOf } from './data/customs.ts'
import { HERO_POOL } from './data/heroes-pool.ts'
import { knownOf } from './discovery.ts'
import { hasTrait, isRuler } from './heroes.ts'
import { palaceTier, seatHero } from './palace.ts'
import type { Card, Hero, Realm } from './types.ts'

const byId = <T extends { id: string }>(xs: Iterable<T>): T[] => [...xs].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))

/** 그 나라 결의 제천 달 — 부여 정월 · 그 밖 시월 (결이 없거나 몰라도 시월) */
export function festMonth(f: string): number {
  return kyeolOf(f) === 'buyeo' ? P.realm.festMonthBuyeo : P.realm.festMonthOther
}

/** 결마다의 이름 — 부여 영고 · 고구려 동맹 · 동예 무천 · 그 밖은 시월 제사 (화면 이름은 모두 「제천 대회」, 달 이름만 곁들인다) */
export function festName(f: string): string {
  const k = kyeolOf(f)
  return k === 'buyeo' ? '영고' : k === 'goguryeo' ? '동맹' : k === 'ye' ? '무천' : '시월 제사'
}

/** 우리 나라가 제천 대회를 열 수 있나 — 우리 판 · 배우는 판 아님 · 궁궐이 festTier 단 이상 */
export function festOpen(r: Realm, f: string | undefined = r.player): boolean {
  if (f === undefined || f !== r.player || r.region === 'tutorial' || r.factions[f] === undefined) return false
  return palaceTier(r, f) >= P.realm.festTier
}

/** 이번 턴이 제천 달이고 올해 아직 안 열었나 */
export function festDue(r: Realm): boolean {
  const f = r.player
  if (f === undefined || !festOpen(r, f) || (r.outcome != null && r.endless !== true)) return false
  return monthOf(r) === festMonth(f) && r.festYear !== yearOf(r)
}

/**
 * 다음 제천 대회까지 몇 달 — 0 이면 이번 달(카드가 떠 있다) · 열 수 없으면 null.
 * 이번 달이 제천 달인데 이미 열었으면 열두 달 뒤
 */
export function festNextIn(r: Realm, f: string): number | null {
  if (!festOpen(r, f)) return null
  const d = (((festMonth(f) - monthOf(r)) % 12) + 12) % 12
  if (d > 0) return d
  return r.card?.grand === true && r.card.season === r.season ? 0 : r.festYear === yearOf(r) ? 12 : 0
}

/** 우리 쪽에서 겨룰 장수 — 자유롭고 군주 아니고 자리에 있는 이 가운데 무예가 가장 높은 이 */
export function festHero(r: Realm, f: string): Hero | null {
  const ok = byId(Object.values(r.heroes)).filter((h) => h.faction === f && h.status === 'free' && !isRuler(r, h.id)
    && !(h.awayUntil !== undefined && h.awayUntil >= r.season) && !(h.woundedUntil !== undefined && h.woundedUntil > r.season))
  return ok.sort((a, b) => b.mu - a.mu || (a.id < b.id ? -1 : 1))[0] ?? null
}

/** 이웃의 이름난 장수 — 우리가 아는 나라(없으면 모든 나라)의 자유로운 장수 가운데 무예 높은 셋 중 굴려서 */
export function festFoe(r: Realm, f: string, season: number): Hero | null {
  const known = new Set(knownOf(r, f))
  const all = byId(Object.values(r.heroes)).filter((h) => h.faction !== f && h.status === 'free' && r.factions[h.faction] !== undefined)
  const near = all.filter((h) => known.has(h.faction))
  const top = (near.length > 0 ? near : all).sort((a, b) => b.mu - a.mu || (a.id < b.id ? -1 : 1)).slice(0, 3)
  return top.length > 0 ? top[Math.floor(roll(r.seed, season, 'fest-foe') * top.length)]! : null
}

/** 찾아올 명궁 — 아직 안 나온 떠돌이 명단에서 명궁 재주가 있는 이 (없으면 무예 높은 이) */
export function festArcher(r: Realm, season: number): string | null {
  const taken = new Set([...Object.keys(r.heroes), ...(r.poolUsed ?? []), ...(r.wanderers ?? []).map((w) => w.hero.id)])
  const free = HERO_POOL.filter((h) => !taken.has(h.id))
  const archers = free.filter((h) => hasTrait(h, 'archer'))
  const from = archers.length > 0 ? archers : [...free].sort((a, b) => b.mu - a.mu || (a.id < b.id ? -1 : 1)).slice(0, 3)
  return from.length > 0 ? from[Math.floor(roll(r.seed, season, 'fest-archer') * from.length)]!.id : null
}

/** 이웃 한 나라 — 활쏘기에서 호감이 오를 나라 */
function festNeighbor(r: Realm, f: string, season: number): string | null {
  const known = knownOf(r, f).filter((x) => x !== f && r.factions[x] !== undefined).sort()
  return known.length > 0 ? known[Math.floor(roll(r.seed, season, 'fest-neighbor') * known.length)]! : null
}

/** 그 계절의 제천 대회 카드 */
export function festCard(r: Realm, f: string, season: number): Card {
  const me = festHero(r, f)
  const foe = festFoe(r, f, season)
  const guest = festArcher(r, season)
  const from = festNeighbor(r, f, season)
  return {
    kind: 'skyfest', season, grand: true,
    ...(me !== null && foe !== null ? { hero: me.id, hero2: foe.id } : {}),
    ...(guest !== null ? { guest } : {}),
    ...(from !== null ? { from } : {}),
  }
}

/** 보상이 커지는 몫 — 천군이 앉아 있으면 그 장수의 덕만큼 (1 이면 그대로) */
export const festSeatMul = (r: Realm, f: string): number => 1 + (seatHero(r, f, 'priest')?.deok ?? 0) * P.realm.festSeatMul

/** 제천 달이면 이번 턴에 카드를 편다 — 올해 연 해를 적는다 (턴마다 · stepCards 곁) */
export function stepFestival(r: Realm): void {
  const f = r.player
  if (f === undefined || !festDue(r)) return
  r.festYear = yearOf(r)
  r.card = festCard(r, f, r.season)
  ;(r.cardSeen ??= {})['skyfest'] = r.season
}
