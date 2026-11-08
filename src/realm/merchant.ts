/**
 * 떠돌이 상단 — 쇼핑 (형 11-03: "림월드에선 은 2000 들고 가도 살 수 있는 게 별로 없어 · 모으기는 어려운데 사고 싶은 건 많아 ·
 * 자원도 사고 싶고 무기도 사고 싶고 … 쇼핑이란 걸 할 수 있어야 한다" · 수도꼭지와 배수구 · 곡식이 쌓이기만 하던 나라에 쓸 곳을).
 *
 * - 몇 달마다(merchantEvery) 우리 땅에 상단이 들러 merchantStay 달 머문다 — 바닷가 고을이 있으면 포구로, 없으면 도읍으로
 * - 물건은 판의 시드로 고른 merchantSlots 가지 · 가짓수마다 개수가 한정 — 다 못 산다. 값은 비싸다(merchantMarkup)
 * - 파는 것: 자원 묶음(쇠·소금·말·나무) · 용병 무리(창병·궁병 · 그 자리에 군대가 선다) · 큰 북(모든 우리 군대 사기 ▲) · 덩이쇠 꾸러미(쇠 큰 묶음 싸게)
 * - 우리가 남는 것을 팔 수도 있다(merchantSellRate · 곡식으로) — 쌓이던 소금·쇠가 돈이 된다. 한 번 들를 때 merchantSellCap 곡식까지
 * - 상단 일터(「장터」)가 있으면 더 자주 오고 물건이 한 가지 더 (works.ts — 사면 나중에 더 사게 되는 것)
 *
 * 플레이어 나라만 상단을 맞는다 (AI 는 곳간을 제 셈으로 쓴다). 굴림은 roll(시드) 뿐 (A1).
 */
import { roll } from '../core/rng.ts'
import { P } from '../tune/params.ts'
import { addGood, goodOf, isCoast, nodeYield, stockOf, worthOf } from './economy.ts'
import { bestWorkLv } from './works.ts'
import { setHarvest } from './events.ts'
import { addFavor } from './diplomacy.ts'
import { discover, knownOf } from './discovery.ts'
import { HERO_POOL } from './data/heroes-pool.ts'
import { seasonOf, seasons, yearOf } from './calendar.ts'
import type { UnitKind } from './battle.ts'
import type { Good, Hero, Order, Realm, ReportLine } from './types.ts'

/** good 자원 묶음 · ingot 큰 묶음(싸게 · 쇠뿐 아니라 소금·말·나무도 · good 에 무엇인지) · merc 용병 · drum 큰 북 · heal 약초 · seed 좋은 씨앗 · silk 비단 선물 */
export type OfferWhat = 'good' | 'merc' | 'drum' | 'ingot' | 'heal' | 'seed' | 'silk'

export interface Offer {
  readonly id: string
  readonly what: OfferWhat
  readonly good?: Good
  readonly unit?: UnitKind
  /** 묶음 크기 — 자원 개수 · 용병 사람 수 */
  readonly n: number
  /** 곡식 값 */
  readonly price: number
  /** 남은 개수 */
  left: number
}

export interface Market {
  readonly faction: string
  readonly at: string
  readonly until: number
  readonly offers: Offer[]
  /** 이번에 판 곡식 (merchantSellCap 까지) */
  sold: number
}

/** 다쳐 누운 우리 장수 — 약초가 일으킨다 */
function hurtHeroes(r: Realm, faction: string): Hero[] {
  return Object.values(r.heroes).filter((h) => h.faction === faction && h.status === 'free' && h.woundedUntil !== undefined && h.woundedUntil > r.season)
}

/** 상단이 설 고을 — 사람 사는 바닷가 우리 고을 가운데 큰 곳, 없으면 도읍 */
function marketNode(r: Realm, faction: string): string | null {
  const coast = Object.values(r.nodes).filter((n) => n.owner === faction && n.hh > 0 && n.kind !== 'sodo' && isCoast(r, n.id))
    .sort((a, b) => b.hh - a.hh || (a.id < b.id ? -1 : 1))[0]
  return coast?.id ?? r.factions[faction]?.capital ?? null
}

/** 다음에 들를 턴 — 장터가 있으면 더 자주 */
function every(r: Realm, faction: string): number {
  return Math.max(2, Math.round(P.realm.merchantEvery * Math.pow(P.realm.workMarketEvery, bestWorkLv(r, faction, 'market'))))
}

/** 물건 고르기 — 시드로 섞어 slots 가지 */
function stockFor(r: Realm, faction: string): Offer[] {
  const R = P.realm
  const mk = R.merchantMarkup
  const pool: Array<Omit<Offer, 'id' | 'left'> & { many: number }> = [
    { what: 'good', good: 'iron', n: 20, price: Math.round(20 * worthOf('iron') * mk), many: 3 },
    { what: 'good', good: 'salt', n: 25, price: Math.round(25 * worthOf('salt') * mk), many: 3 },
    { what: 'good', good: 'horse', n: 10, price: Math.round(10 * worthOf('horse') * mk), many: 3 },
    { what: 'good', good: 'wood', n: 25, price: Math.round(25 * worthOf('wood') * mk), many: 3 },
    { what: 'merc', unit: 'spear', n: R.mercMen, price: Math.round(R.mercMen * R.mercGrainPer), many: 1 },
    { what: 'merc', unit: 'bow', n: Math.round(R.mercMen * 0.7), price: Math.round(R.mercMen * 0.7 * R.mercGrainPer * 1.3), many: 1 },
    { what: 'merc', unit: 'shield', n: Math.round(R.mercMen * 0.8), price: Math.round(R.mercMen * 0.8 * R.mercGrainPer * 1.2), many: 1 },
    { what: 'merc', unit: 'horse', n: Math.round(R.mercMen * 0.4), price: Math.round(R.mercMen * 0.4 * R.mercGrainPer * 2.2), many: 1 },
    { what: 'drum', n: 1, price: R.drumGrain, many: 1 },
    // 큰 묶음 — 낱개보다 싸다 (쇠 · 소금 · 말 · 나무)
    { what: 'ingot', good: 'iron', n: 60, price: Math.round(60 * worthOf('iron') * mk * 0.75), many: 1 },
    { what: 'ingot', good: 'salt', n: 80, price: Math.round(80 * worthOf('salt') * mk * 0.75), many: 1 },
    { what: 'ingot', good: 'horse', n: 30, price: Math.round(30 * worthOf('horse') * mk * 0.75), many: 1 },
    { what: 'ingot', good: 'wood', n: 80, price: Math.round(80 * worthOf('wood') * mk * 0.75), many: 1 },
    // 판의 다른 자리에 닿는 것 — 다친 장수 · 가을걷이 · 이웃의 마음 (형 11-04: "살 게 더 다양하고 많았으면")
    ...(hurtHeroes(r, faction).length > 0 ? [{ what: 'heal' as const, n: 1, price: R.healGrain, many: 1 }] : []),
    // 좋은 씨앗은 씨 뿌리기 전(겨울·봄)에만 판다 — 8월에 사자마자 그해 걷이가 느는 게 이상했다 (형 11-08)
    ...(seedSeason(r) ? [{ what: 'seed' as const, n: 1, price: R.seedGrain, many: 1 }] : []),
    ...(knownOf(r, faction).some((x) => x !== faction) ? [{ what: 'silk' as const, n: 1, price: R.silkGrain, many: 1 }] : []),
  ]
  const slots = Math.max(1, Math.round(R.merchantSlots + bestWorkLv(r, faction, 'market')))
  const keyed = pool.map((p, i) => ({ p, i, k: roll(r.seed, r.season, `merchant:${faction}:${i}`) })).sort((a, b) => a.k - b.k || a.i - b.i)
  return keyed.slice(0, slots).sort((a, b) => a.i - b.i).map(({ p, i }) => {
    const { many, ...rest } = p
    return { ...rest, id: `o${i}`, left: many }
  })
}

/** 좋은 씨앗을 파는 철 — 씨 뿌리기 전인 겨울·봄 */
export const seedSeason = (r: Realm): boolean => { const s = seasonOf(r); return s === 'winter' || s === 'spring' }
/** 좋은 씨앗이 붙는 해 — 해는 봄에 바뀌므로 봄에 사면 그해, 그 밖(겨울 · 옛 판에 남은 여름·가을 상단)은 다음 해 가을걷이 */
export const seedYear = (r: Realm): number => yearOf(r) + (seasonOf(r) === 'spring' ? 0 : 1)

/** 그 나라에 지금 머무는 상단 */
export function marketOf(r: Realm, faction: string): Market | null {
  const m = r.markets?.[faction]
  return m !== undefined && m.until >= r.season ? m : null
}

/** 다음 상단이 오기까지 남은 턴 (지금 머물면 0) */
export function marketIn(r: Realm, faction: string): number {
  if (marketOf(r, faction) !== null) return 0
  return Math.max(0, (r.marketNext?.[faction] ?? every(r, faction)) - r.season)
}

/** 달마다 — 머물던 상단은 떠나고, 때가 되면 새 상단이 온다 (플레이어 나라만) */
export function stepMarket(r: Realm, lines: ReportLine[]): void {
  const f = r.player
  if (r.factions[f] === undefined) return
  const cur = r.markets?.[f]
  if (cur !== undefined && cur.until < r.season) {
    delete r.markets![f]
    // 떠나며 쪽지를 남긴다 — 걸린 것이 없을 때만 (위원회 11-04 림월드 ②)
    if (r.marketWish?.[f] === undefined) { const w = makeWish(r, f); if (w !== null) (r.marketWish ??= {})[f] = w }
    lines.push({ kind: 'merchant', faction: f, node: cur.at, come: false })
  }
  const next = r.marketNext?.[f] ?? every(r, f)
  if (marketOf(r, f) !== null || r.season < next) return
  const at = marketNode(r, f)
  if (at === null) return
  ;(r.markets ??= {})[f] = { faction: f, at, until: r.season + Math.max(1, Math.round(P.realm.merchantStay)) - 1, offers: stockFor(r, f), sold: 0 }
  ;(r.marketNext ??= {})[f] = r.season + every(r, f)
  lines.push({ kind: 'merchant', faction: f, node: at, come: true })
}

/** 살 수 있나 — 상단이 머물고 · 남았고 · 곡식이 된다 */
export function canBuy(r: Realm, faction: string, offer: string): boolean {
  const m = marketOf(r, faction)
  const o = m?.offers.find((x) => x.id === offer)
  return o !== undefined && o.left > 0 && stockOf(r, faction).grain >= o.price && (o.what !== 'heal' || hurtHeroes(r, faction).length > 0)
}

export function applyBuy(r: Realm, o: Extract<Order, { kind: 'buy' }>, lines: ReportLine[]): void {
  if (!canBuy(r, o.faction, o.offer)) return
  const m = marketOf(r, o.faction)!
  const of = m.offers.find((x) => x.id === o.offer)!
  stockOf(r, o.faction).grain -= of.price
  of.left -= 1
  if ((of.what === 'good' || of.what === 'ingot') && of.good !== undefined) addGood(r, o.faction, of.good, of.n)
  else if (of.what === 'heal') {
    // 약초 — 다쳐 누운 우리 장수가 바로 일어난다
    for (const h of hurtHeroes(r, o.faction)) delete h.woundedUntil
  } else if (of.what === 'seed') setHarvest(r, o.faction, 1 + P.realm.seedHarvest, seedYear(r))
  else if (of.what === 'silk') {
    // 비단 선물 — 아는 나라마다 마음이 조금씩
    for (const x of knownOf(r, o.faction)) if (x !== o.faction) addFavor(r, o.faction, x, P.realm.silkFavor)
  } else if (of.what === 'drum') {
    for (const a of Object.values(r.armies)) if (a.faction === o.faction) a.morale = Math.min(P.realm.moraleMax, a.morale + P.realm.drumMorale)
  } else if (of.what === 'merc' && of.unit !== undefined) {
    let id = ''
    for (let i = 1; ; i++) { id = `a-${o.faction}-merc-${r.season}-${i}`; if (r.armies[id] === undefined) break }
    const tier = r.factions[o.faction]?.equip ?? 'bronze'
    r.armies[id] = { id, faction: o.faction, hero: null, mix: { [of.unit]: of.n }, equip: tier, morale: 1, at: m.at, march: null }
  }
  lines.push({ kind: 'buy', faction: o.faction, what: of.what, n: of.n, price: of.price, ...(of.good !== undefined ? { good: of.good } : {}), ...(of.unit !== undefined ? { unit: of.unit } : {}) })
}

/** 팔 수 있는 개수 — 곳간에 있고 · 이번 상단이 받을 곡식 한도 안 */
export function sellLimit(r: Realm, faction: string, good: Good): number {
  const m = marketOf(r, faction)
  if (m === null || good === 'grain') return 0
  const per = worthOf(good) * P.realm.merchantSellRate
  if (per <= 0) return 0
  const room = Math.floor((P.realm.merchantSellCap - m.sold) / per)
  return Math.max(0, Math.min(Math.floor(goodOf(stockOf(r, faction), good)), room))
}

export function sellPrice(good: Good, n: number): number {
  return Math.floor(n * worthOf(good) * P.realm.merchantSellRate)
}

export function applySell(r: Realm, o: Extract<Order, { kind: 'sell' }>, lines: ReportLine[]): void {
  if (!Number.isInteger(o.n) || o.n < 1 || o.n > sellLimit(r, o.faction, o.good)) return
  const m = marketOf(r, o.faction)!
  const g = sellPrice(o.good, o.n)
  addGood(r, o.faction, o.good, -o.n)
  stockOf(r, o.faction).grain += g
  m.sold += g
  lines.push({ kind: 'sell', faction: o.faction, good: o.good, n: o.n, grain: g })
}

// ───────── 장터 저울 (위원회 11-04 림월드 ③) — 장터 일터가 있으면 상단이 없는 달에도 바꿀 곳이 있다
// 상단보다 나쁜 값(팔기 scaleSellRate · 사기 scaleBuyMul) · 달마다 곡식으로 친 한도 scaleCap × 장터 단 · 용병·북·씨앗·비단은 상단에만

/** 저울이 있나 — 플레이어 나라 · 장터 일터가 있다 */
export function hasScale(r: Realm, faction: string): boolean {
  return faction === r.player && bestWorkLv(r, faction, 'market') > 0
}

/** 이번 달 저울에 남은 몫 (곡식으로 친) */
export function scaleRoom(r: Realm, faction: string): number {
  if (!hasScale(r, faction)) return 0
  const used = r.scaleUsed?.[faction]
  const spent = used !== undefined && used.season === r.season ? used.grain : 0
  return Math.max(0, Math.round(P.realm.scaleCap * bestWorkLv(r, faction, 'market')) - spent)
}

/** 저울 값 — 팔면 받는 곡식 · 사면 내는 곡식 */
export const scaleSellPrice = (good: Good, n: number): number => Math.floor(n * worthOf(good) * P.realm.scaleSellRate)
export const scaleBuyPrice = (good: Good, n: number): number => Math.ceil(n * worthOf(good) * P.realm.scaleBuyMul)

/** 저울로 팔 수 있는 개수 · 살 수 있는 개수 */
export function scaleLimit(r: Realm, faction: string, good: Good, buy: boolean): number {
  if (good === 'grain' || worthOf(good) <= 0) return 0
  const room = scaleRoom(r, faction)
  if (buy) {
    const per = worthOf(good) * P.realm.scaleBuyMul
    return Math.max(0, Math.floor(Math.min(room, stockOf(r, faction).grain) / per))
  }
  const per = worthOf(good) * P.realm.scaleSellRate
  return Math.max(0, Math.min(Math.floor(goodOf(stockOf(r, faction), good)), Math.floor(room / per)))
}

export function applyScale(r: Realm, o: Extract<Order, { kind: 'scale' }>, lines: ReportLine[]): void {
  if (!Number.isInteger(o.n) || o.n < 1 || o.n > scaleLimit(r, o.faction, o.good, o.buy)) return
  const g = o.buy ? scaleBuyPrice(o.good, o.n) : scaleSellPrice(o.good, o.n)
  if (o.buy) { stockOf(r, o.faction).grain -= g; addGood(r, o.faction, o.good, o.n) } else { addGood(r, o.faction, o.good, -o.n); stockOf(r, o.faction).grain += g }
  const used = (r.scaleUsed ??= {})[o.faction]
  r.scaleUsed[o.faction] = { season: r.season, grain: (used !== undefined && used.season === r.season ? used.grain : 0) + g }
  lines.push({ kind: 'scale', faction: o.faction, good: o.good, n: o.n, grain: g, buy: o.buy })
}

// ───────── 상단의 주문 (위원회 11-04 림월드 ②) — 떠날 때 쪽지 하나: 다음에 올 때 이것을 모아 두면 돈으로 못 사는 것을 갚는다
// 물건은 우리 땅이 낼 수 있는 것만(곡식 빼고) · 걸려 있는 것은 늘 하나 · 기한도 벌도 없다 (못 맞추면 그냥 남는다)

export type WishReward = 'hero' | 'news'
export interface Wish { readonly goods: Partial<Record<Good, number>>; readonly reward: WishReward }

/** 아직 이름을 모르는 나라 — 소문으로 알려 줄 수 있는 */
function unknownNations(r: Realm, faction: string): string[] {
  const known = new Set(knownOf(r, faction))
  return Object.keys(r.factions).filter((f) => f !== faction && !known.has(f)).sort()
}

/** 떠돌 장수 — 아직 판에 없는 이름 */
function freePool(r: Realm): string[] {
  const taken = new Set([...Object.keys(r.heroes), ...(r.wanderers ?? []).map((w) => w.hero.id), ...(r.poolUsed ?? [])])
  return HERO_POOL.filter((h) => !taken.has(h.id)).map((h) => h.id).sort()
}

/** 쪽지를 쓴다 — 우리 고을들이 내는 특산 가운데 둘(값어치로 곡식 wishWorth 어치씩) · 갚음은 떠돌 장수 아니면 먼 나라 소문 */
function makeWish(r: Realm, faction: string): Wish | null {
  const can = new Set<Good>()
  for (const n of Object.values(r.nodes)) if (n.owner === faction) for (const [g, v] of Object.entries(nodeYield(r, n.id)) as Array<[Good, number]>) if (g !== 'grain' && v > 0) can.add(g) // 실제로 나는 것만 (0 은 빼고)
  const goods = [...can].sort()
  if (goods.length === 0) return null
  const k = (i: number): number => roll(r.seed, r.season, `mwish:${faction}:${i}`)
  const pick = goods.map((g, i) => ({ g, w: k(i) })).sort((a, b) => a.w - b.w).slice(0, Math.min(2, goods.length))
  const want: Partial<Record<Good, number>> = {}
  for (const { g } of pick) want[g] = Math.max(5, Math.round(P.realm.wishWorth / Math.max(0.01, worthOf(g)) / 5) * 5)
  const hero = freePool(r).length > 0
  const news = unknownNations(r, faction).length > 0
  if (!hero && !news) return null
  const reward: WishReward = hero && news ? (k(9) < 0.5 ? 'hero' : 'news') : hero ? 'hero' : 'news'
  return { goods: want, reward }
}

/**
 * 갚을 것 — 쪽지의 갚음이 그새 바닥났으면(장수 풀이 비었다 · 모르는 나라가 없다) 다른 갚음으로 · 둘 다 없으면 null
 * (sim-lens 11-04: 물건만 빼앗기고 아무것도 안 오던 것)
 */
function wishPayout(r: Realm, faction: string, w: Wish): { kind: WishReward; id: string } | null {
  const pickOf = (kind: WishReward): { kind: WishReward; id: string } | null => {
    const xs = kind === 'hero' ? freePool(r) : unknownNations(r, faction)
    const id = xs[Math.floor(roll(r.seed, r.season, `mwish-${kind}:${faction}`) * xs.length)]
    return id !== undefined ? { kind, id } : null
  }
  return pickOf(w.reward) ?? pickOf(w.reward === 'hero' ? 'news' : 'hero')
}

/** 지금 맞바꿀 수 있나 — 상단이 머물고 · 쪽지가 있고 · 물건을 다 모았고 · 갚을 것이 남았다 */
export function wishReady(r: Realm, faction: string): boolean {
  const w = r.marketWish?.[faction]
  if (w === undefined || marketOf(r, faction) === null || wishPayout(r, faction, w) === null) return false
  const s = stockOf(r, faction)
  return (Object.entries(w.goods) as Array<[Good, number]>).every(([g, n]) => goodOf(s, g) >= n)
}

export function applyWish(r: Realm, o: Extract<Order, { kind: 'wish' }>, lines: ReportLine[]): void {
  if (!wishReady(r, o.faction)) return
  const w = r.marketWish![o.faction]!
  const m = marketOf(r, o.faction)!
  const pay = wishPayout(r, o.faction, w)!
  for (const [g, n] of Object.entries(w.goods) as Array<[Good, number]>) addGood(r, o.faction, g, -n)
  delete r.marketWish![o.faction]
  if (pay.kind === 'hero') {
    const who = HERO_POOL.find((h) => h.id === pay.id)!
    ;(r.poolUsed ??= []).push(who.id)
    // 상단이 소개한 이 — 값 없이 들일 수 있다 (상단이 선 고을에 · 보통 떠돌이처럼 머물다 떠난다)
    ;(r.wanderers ??= []).push({ hero: structuredClone(who), node: m.at, until: r.season + seasons(r, P.realm.wandererStay), price: 0 })
    lines.push({ kind: 'wish', faction: o.faction, reward: 'hero', who: who.id })
    return
  }
  discover(r, o.faction, pay.id, 'market', lines)
  lines.push({ kind: 'wish', faction: o.faction, reward: 'news', who: pay.id })
}
