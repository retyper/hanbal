/**
 * 사건 — 스토리텔러의 카드 (docs/realm/SYSTEMS.md §9 · 슬롯 ⑧ 사건 · ⑦ 점괘 · 림월드).
 *
 * 계절마다 우리 나라에 카드 한 장이 올 수 있다 (판의 `card`). 선택은 둘, 고르지 않으면 첫째(기본값).
 * 카드는 **한 계절 앞서 뽑아 둔다** (`cardNext`) — 그래서 점괘가 다음 계절 카드를 미리 볼 수 있다.
 * 점괘: 그 계절에 제사를 지냈거나 무당 핏줄 장수가 있으면 다음 계절 카드를 엿본다 — 맞을 때도, 틀릴 때도 있다 (omenRight).
 * 난세 단계가 높을수록 나쁜 카드가 잦다. 배우는 판은 카드가 없다. 남의 나라에는 카드가 오지 않는다 (판단은 우리 것).
 *
 * 순서: 1 명령 확정 때 이번 카드의 답을 건다 (resolveCard) → 7 가을걷이가 그해 배수(harvestMod)를 읽는다 → 11 계절을 넘긴 뒤 다음 카드를 편다 (stepCards).
 */
import { roll } from '../core/rng.ts'
import { P } from '../tune/params.ts'
import { CARDS, CARD_KINDS, type CardKind } from './data/cards.ts'
import { HERO_POOL } from './data/heroes-pool.ts'
import { addFavor } from './diplomacy.ts'
import { knownOf } from './discovery.ts'
import { addBond, hasTrait, homeOf, isRuler } from './heroes.ts'
import type { Card, Hero, Order, Realm, ReportLine } from './types.ts'

const byId = <T extends { id: string }>(xs: Iterable<T>): T[] => [...xs].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))

/** 우리 장수 가운데 다툴 수 있는 이 — 자유롭고 군주가 아니고 자리에 있는 이 */
const freeHeroes = (r: Realm, f: string): Hero[] =>
  byId(Object.values(r.heroes)).filter((h) => h.faction === f && h.status === 'free' && !isRuler(r, h.id) && !(h.awayUntil !== undefined && h.awayUntil >= r.season))
const portOf = (r: Realm, f: string): string | null => byId(Object.values(r.nodes)).find((n) => n.owner === f && n.kind === 'port')?.id ?? null
const bigNodes = (r: Realm, f: string): string[] =>
  byId(Object.values(r.nodes)).filter((n) => n.owner === f && n.kind !== 'sodo').sort((a, b) => b.hh - a.hh || (a.id < b.id ? -1 : 1)).map((n) => n.id)
const poolFree = (r: Realm): Hero[] => {
  const taken = new Set([...Object.keys(r.heroes), ...(r.wanderers ?? []).map((w) => w.hero.id), ...(r.expeditions ?? []).flatMap((e) => (e.got.kind === 'wanderer' ? [e.got.hero] : []))])
  return HERO_POOL.filter((h) => !taken.has(h.id))
}

/** 그 계절에 올 수 있는 카드와 무게 */
function candidates(r: Realm, f: string, season: number): Array<{ card: Card; w: number }> {
  const y = ((season % 4) + 4) % 4
  const out: Array<{ card: Card; w: number }> = []
  const port = portOf(r, f)
  const big = bigNodes(r, f)
  const heroes = freeHeroes(r, f)
  const badMul = 1 + P.realm.cardTierBad * (Math.max(1, r.tier ?? 1) - 1)
  const add = (kind: CardKind, w: number, more: Partial<Card> = {}): void => {
    out.push({ card: { kind, season, ...more }, w: w * (CARDS[kind].bad ? badMul : 1) })
  }
  if (y === 0 || y === 1) { add('drought', 1); add('bounty', 0.8) }
  if (y === 1) add('locust', 0.6)
  if ((y === 1 || y === 2) && big.length > 0) add('plague', 0.7, { node: big[0]! })
  add('halo', 0.6)
  if (heroes.length >= 2) {
    const i = Math.floor(roll(r.seed, season, 'card-q1') * heroes.length)
    let j = Math.floor(roll(r.seed, season, 'card-q2') * (heroes.length - 1))
    if (j >= i) j++
    add('quarrel', 0.6, { hero: heroes[i]!.id, hero2: heroes[j]!.id })
  }
  if (port !== null) {
    add('waship', 0.8, { node: port })
    add('pirates', 0.6, { node: port })
    if (y === 0 || y === 3) add('whale', 0.4, { node: port })
  }
  // 망명자 — 떠돌이처럼 장수가 모자란 나라로 (형 10-24: "32년 넘기기만 했는데 장수가 17명" — 늘어난 장수의 7할이 이 카드였다)
  if (poolFree(r).length > 0) {
    const towns = Object.values(r.nodes).filter((n) => n.owner === f && n.kind !== 'sodo').length
    const need = Math.max(P.realm.wandererNeedMin, Math.min(1, ((towns + 1) / (heroes.length + 1)) * P.realm.wandererNeedMul))
    add('exile', P.realm.cardExileW * need)
  }
  if (Object.values(r.nodes).some((n) => n.kind === 'sodo')) add('fugitive', 0.5)
  return out
}

/** 그 계절의 카드를 뽑는다 — 없을 수도 있다 (cardChance). 같은 판·같은 계절이면 같은 카드 */
export function drawCard(r: Realm, season: number): Card | null {
  const f = r.player
  if (f === undefined || r.region === 'tutorial') return null
  if (roll(r.seed, season, 'card') >= P.realm.cardChance) return null
  const c = candidates(r, f, season)
  const sum = c.reduce((s, x) => s + x.w, 0)
  if (sum <= 0) return null
  let x = roll(r.seed, season, 'card-which') * sum
  for (const e of c) {
    if (x < e.w) return e.card
    x -= e.w
  }
  return c[c.length - 1]!.card
}

/** 카드를 펼 때 — 그새 장수가 떠났거나 포구를 잃었으면 그 카드는 오지 않는다 */
export function cardValid(r: Realm, c: Card): boolean {
  const f = r.player
  if (f === undefined) return false
  for (const h of [c.hero, c.hero2]) {
    if (h === undefined) continue
    const x = r.heroes[h]
    if (x === undefined || x.faction !== f || x.status !== 'free') return false
  }
  if (c.node !== undefined && r.nodes[c.node]?.owner !== f) return false
  if (c.kind === 'exile' && poolFree(r).length === 0) return false
  return true
}

const clampMorale = (v: number): number => Math.min(P.realm.moraleMax, v)

/**
 * 곡식 몫 — 창고에 비례하되 바닥이 있고, 사건마다 크기가 들쭉날쭉하다
 * (형: "적게요구하거나 약탈을 조금만 해가는놈들일수도 있겠지만 그것도 어느정도 크기가 다이나믹 했음")
 */
const grainCost = (r: Realm, f: string, share: number): number => {
  const R = P.realm
  const swing = R.cardSwingLo + (R.cardSwingHi - R.cardSwingLo) * roll(r.seed, r.season, 'card-amt')
  return Math.max(R.cardGrainMin, Math.round((r.stock[f]?.grain ?? 0) * share * swing))
}

function setHarvest(r: Realm, f: string, mul: number): void {
  const year = Math.floor(r.season / 4)
  const had = r.harvestMod?.[f]
  ;(r.harvestMod ??= {})[f] = { year, mul: had !== undefined && had.year === year ? had.mul * mul : mul }
}

/** 1 — 이번 계절 카드의 답을 건다. 고르지 않았으면 첫째 (망명자만 둘째 — 돌려보낸다) */
export function resolveCard(r: Realm, orders: readonly Order[], lines: ReportLine[]): void {
  const c = r.card
  const f = r.player
  if (c === undefined || c === null || f === undefined) return
  r.card = null
  if (c.season !== r.season || !cardValid(r, c)) return
  const o = orders.find((x): x is Extract<Order, { kind: 'card' }> => x.kind === 'card' && x.faction === f)
  // 고르지 않으면 첫째 — 다만 망명자는 돌려보낸다 (가만히 있는데 장수가 느는 일이 없게 · 받으려면 눌러서)
  const pick: 0 | 1 = o !== undefined ? (o.pick === 1 ? 1 : 0) : c.kind === 'exile' ? 1 : 0
  const R = P.realm
  const st = (r.stock[f] ??= { grain: 0, iron: 0 })
  const k = (what: string): number => roll(r.seed, r.season, `card-res:${c.kind}:${what}`)
  let grain = 0
  let iron = 0
  let hh = 0
  let good: boolean | undefined
  let hero: string | undefined
  const pay = (n: number): void => { const t = Math.min(st.grain, n); st.grain -= t; grain -= t }
  const gain = (n: number): void => { st.grain += n; grain += n }
  const cheer = (): void => {
    for (const a of Object.values(r.armies)) if (a.faction === f) a.morale = clampMorale(a.morale + R.cardMorale)
    for (const h of freeHeroes(r, f)) addBond(r, h, R.cardBond, lines)
  }
  const hurt = (node: string, share: number): void => {
    const n = r.nodes[node]
    if (n === undefined) return
    const d = Math.round(n.hh * share)
    n.hh -= d
    hh -= d
  }
  switch (c.kind) {
    case 'drought':
      if (pick === 0) { pay(grainCost(r, f, 0.05)); setHarvest(r, f, 0.85) } else { pay(grainCost(r, f, 0.12)); setHarvest(r, f, 0.97) }
      break
    case 'bounty':
      if (pick === 0) setHarvest(r, f, 1.25)
      else { pay(grainCost(r, f, 0.05)); cheer() }
      break
    case 'locust':
      if (pick === 0) setHarvest(r, f, 0.85)
      // 산천에 빈다 — 『삼국사기』 파사이사금 30년 「王遍祭山川，以祈禳之，蝗滅」 · 곡식을 조금 바치고, 흔히 메뚜기가 사라진다 (형 10-24)
      else { pay(grainCost(r, f, 0.03)); good = k('wait') < 0.65; setHarvest(r, f, good ? 1 : 0.5) }
      break
    case 'plague':
      if (pick === 0) { hurt(c.node!, 0.03); pay(grainCost(r, f, 0.03)) } else {
        good = k('spread') < 0.55
        if (!good) for (const n of bigNodes(r, f).slice(0, 2)) hurt(n, 0.12)
      }
      break
    case 'halo':
      if (pick === 0) { for (const a of Object.values(r.armies)) if (a.faction === f) a.morale = clampMorale(a.morale + R.cardMorale) } else {
        for (const n of Object.values(r.nodes)) if (n.owner === f) { const w = (r.watch[n.id] ??= { alert: 0, lull: 0 }); w.alert = Math.min(1, w.alert + 0.2) }
      }
      break
    case 'quarrel': {
      const [win, lose] = pick === 0 ? [c.hero!, c.hero2!] : [c.hero2!, c.hero!]
      addBond(r, r.heroes[win]!, R.cardQuarrel, lines)
      addBond(r, r.heroes[lose]!, -R.cardQuarrel, lines)
      hero = win
      break
    }
    case 'waship':
      if (pick === 0) {
        const n = Math.min(Math.floor(st.iron), Math.max(5, Math.round(st.iron * 0.3)))
        st.iron -= n
        iron -= n
        gain(n * R.cardIronSell)
      } else {
        const g = Math.min(st.grain, grainCost(r, f, 0.08))
        pay(g)
        const n = Math.round(g / R.cardIronBuy)
        st.iron += n
        iron += n
      }
      break
    case 'pirates':
      if (pick === 0) pay(grainCost(r, f, 0.08))
      else {
        good = k('fight') < 0.55
        if (good) { st.iron += R.cardPirateIron; iron += R.cardPirateIron } else { hurt(c.node!, 0.06); pay(grainCost(r, f, 0.1)) }
      }
      break
    case 'exile':
      if (pick === 0) {
        const pool = poolFree(r)
        const p = pool[Math.floor(k('who') * pool.length)]
        const at = homeOf(r, f)
        if (p !== undefined && at !== null) {
          pay(grainCost(r, f, R.cardExileCost))
          r.heroes[p.id] = { ...structuredClone(p), faction: f, status: 'free', captor: null, at, post: null, bond: R.bondHired }
          hero = p.id
        }
      }
      break
    case 'fugitive':
      if (pick === 0) {
        for (const o2 of knownOf(r, f)) addFavor(r, f, o2, R.cardFavorUp)
        for (const h of freeHeroes(r, f)) addBond(r, h, R.cardFugitiveBond, lines)
      } else {
        gain(grainCost(r, f, 0.06))
        for (const o2 of knownOf(r, f)) addFavor(r, f, o2, -R.cardFavorDown)
      }
      break
    case 'whale':
      if (pick === 0) gain(Math.max(30, grainCost(r, f, 0.1)))
      else cheer()
      break
  }
  lines.push({
    kind: 'card', faction: f, card: c.kind, pick,
    ...(grain !== 0 ? { grain } : {}), ...(iron !== 0 ? { iron } : {}), ...(hh !== 0 ? { hh } : {}),
    ...(good !== undefined ? { good } : {}), ...(hero !== undefined ? { hero } : {}), ...(c.node !== undefined ? { node: c.node } : {}),
  })
}

/** 점괘를 볼 수 있나 — 이번 계절에 제사를 지냈거나 무당 핏줄 장수가 있다 */
function canDivine(r: Realm, f: string, lines: readonly ReportLine[]): { ok: boolean; shaman: boolean } {
  const shaman = freeHeroes(r, f).some((h) => hasTrait(h, 'shaman')) || Object.values(r.heroes).some((h) => h.faction === f && h.status === 'free' && hasTrait(h, 'shaman'))
  const rite = lines.some((l) => l.kind === 'rite' && l.faction === f)
  return { ok: shaman || rite, shaman }
}

/**
 * 11 — 계절을 넘긴 뒤: 미리 뽑아 둔 카드를 펴고, 그다음 계절 카드를 뽑아 둔다. 점괘가 되면 그 카드를 엿본다.
 * (계절이 이미 하나 올라간 뒤에 부른다 — r.season 은 새 계절)
 */
export function stepCards(r: Realm, lines: ReportLine[]): void {
  const f = r.player
  if (f === undefined || r.region === 'tutorial' || (r.outcome != null && r.endless !== true)) {
    r.card = null
    r.cardNext = null
    return
  }
  const next = r.cardNext
  r.card = next !== undefined && next !== null && next.season === r.season && cardValid(r, next) ? next : next === undefined ? drawCard(r, r.season) : null
  r.cardNext = drawCard(r, r.season + 1)
  const dv = canDivine(r, f, lines)
  if (!dv.ok) return
  const acc = Math.min(0.95, P.realm.omenRight + (dv.shaman ? P.realm.omenShaman : 0))
  const truth = r.cardNext?.kind ?? null
  const right = roll(r.seed, r.season, 'omen') < acc
  let shown: CardKind | null = truth
  if (!right) {
    const other: Array<CardKind | null> = [null, ...CARD_KINDS].filter((x) => x !== truth)
    shown = other[Math.floor(roll(r.seed, r.season, 'omen-wrong') * other.length)] ?? null
  }
  lines.push({ kind: 'omen', faction: f, card: shown, right, shaman: dv.shaman })
}
