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
import { CARDS, CARD_KINDS, QUARREL_WHYS, cardFallback, type CardKind, type QuarrelWhy } from './data/cards.ts'
import { HERO_POOL } from './data/heroes-pool.ts'
import { addFavor } from './diplomacy.ts'
import { knownOf } from './discovery.ts'
import { addBond, canWed, hasTrait, homeOf, isRuler, wed } from './heroes.ts'
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

/** 우리가 아는 이웃 나라 하나 (없으면 null) — 사건이 그 나라 이름으로 일어난다 */
function pickKnown(r: Realm, f: string, season: number, key: string): string | null {
  const known = knownOf(r, f).filter((x) => x !== f && r.factions[x] !== undefined).sort()
  return known.length > 0 ? known[Math.floor(roll(r.seed, season, key) * known.length)]! : null
}

/** 그 계절에 올 수 있는 카드와 무게 */
function candidates(r: Realm, f: string, season: number): Array<{ card: Card; w: number }> {
  const y = ((season % 4) + 4) % 4
  const out: Array<{ card: Card; w: number }> = []
  const port = portOf(r, f)
  const big = bigNodes(r, f)
  const heroes = freeHeroes(r, f)
  const badMul = (r.tier ?? 1) < 1 ? P.realm.easyBad : 1 + P.realm.cardTierBad * (Math.max(1, r.tier ?? 1) - 1)
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
    // 까닭 — 고을 맡기는 도읍 말고 우리 고을이 있을 때만 (그 고을 이름이 글에 들어간다)
    const cap = r.factions[f]?.capital
    const town = big.find((id) => id !== cap)
    const whys = QUARREL_WHYS.filter((w) => w !== 'town' || town !== undefined)
    const why: QuarrelWhy = whys[Math.floor(roll(r.seed, season, 'card-qwhy') * whys.length)]!
    add('quarrel', 0.6, { hero: heroes[i]!.id, hero2: heroes[j]!.id, why, ...(why === 'town' ? { node: town! } : {}) })
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
    // 누가 오나 — 뽑을 때 정한다 (받기 전에 얼굴·재주를 본다) · 어디서 쫓겨났나 — 우리가 아는 이웃 나라 하나
    const pool = poolFree(r)
    const guest = pool[Math.floor(roll(r.seed, season, 'card-exile-who') * pool.length)]!.id
    const from = pickKnown(r, f, season, 'card-exile-from')
    add('exile', P.realm.cardExileW * need, { guest, ...(from !== null ? { from } : {}) })
  }
  if (Object.values(r.nodes).some((n) => n.kind === 'sodo')) {
    const from = pickKnown(r, f, season, 'card-fug-from')
    add('fugitive', 0.5, from !== null ? { from } : {})
  }
  // 연정 소문 — 혼인 안 한 우리 남녀 장수 둘 (핏줄·부부 아님)
  const pairs: Array<readonly [string, string]> = []
  for (const x of heroes) for (const y of heroes) if (x.look === 'g' && y.look === 'w' && canWed(r, f, x.id, y.id)) pairs.push([x.id, y.id])
  if (pairs.length > 0) {
    const [a, b] = pairs[Math.floor(roll(r.seed, season, 'card-love') * pairs.length)]!
    // 먼저 나오는 이를 반반으로 — 늘 사내가 앞이지 않게
    const swap = roll(r.seed, season, 'card-love-swap') < 0.5
    add('romance', P.realm.cardRomanceW, { hero: swap ? b : a, hero2: swap ? a : b })
  }
  return out
}

/**
 * 2장 졸본만의 사건 — 정해진 계절에 반드시 온다 (점검 10-25: 장만의 이야기 사건이 없었다).
 * 엄리대수의 다리는 추격 때(둘째 계절) · 비류국의 고각은 송양이 아직 안 따를 때(다섯째 계절)
 */
function chapterCard(r: Realm, season: number): Card | null {
  if (r.scenario?.id !== 'jumong' || r.player !== 'goguryeo') return null
  if (season === P.realm.cardFishSeason) return { kind: 'fishbridge', season }
  if (season === P.realm.cardGogakSeason && r.factions['biryuna'] !== undefined) return { kind: 'gogak', season }
  return null
}

/** 그 계절의 카드를 뽑는다 — 없을 수도 있다 (cardChance). 같은 판·같은 계절이면 같은 카드 */
export function drawCard(r: Realm, season: number): Card | null {
  const f = r.player
  if (f === undefined || r.region === 'tutorial') return null
  const ch = chapterCard(r, season)
  if (ch !== null) return ch
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
  if (c.kind === 'exile' && (poolFree(r).length === 0 || (c.guest !== undefined && !poolFree(r).some((h) => h.id === c.guest)))) return false
  if (c.kind === 'romance' && !canWed(r, f, c.hero ?? '', c.hero2 ?? '')) return false
  return true
}

const clampMorale = (v: number): number => Math.min(P.realm.moraleMax, v)

/**
 * 곡식 몫 — 창고에 비례하되 바닥이 있고, 사건마다 크기가 들쭉날쭉하다
 * (형: "적게요구하거나 약탈을 조금만 해가는놈들일수도 있겠지만 그것도 어느정도 크기가 다이나믹 했음")
 */
const grainCost = (r: Realm, have: number, share: number): number => {
  const R = P.realm
  const swing = R.cardSwingLo + (R.cardSwingHi - R.cardSwingLo) * roll(r.seed, r.season, 'card-amt')
  return Math.max(R.cardGrainMin, Math.round(have * share * swing))
}

function setHarvest(r: Realm, f: string, mul: number): void {
  const year = Math.floor(r.season / 4)
  const had = r.harvestMod?.[f]
  ;(r.harvestMod ??= {})[f] = { year, mul: had !== undefined && had.year === year ? had.mul * mul : mul }
}

/**
 * 사건 답 하나가 하는 일 — 엔진(resolveCard)이 거는 것과 화면이 보이는 것이 **같은 셈**이다
 * (형 10-25: "이벤트들 발생할 때는 확률이랑 얻게 되거나 잃게 되는 거 이미지랑 숫자로 확실하게 보여줘야겠는데?" · ODDS.md 원칙 3).
 * 곡식·쇠는 + 들어온다 · − 나간다 (나갈 때는 창고에 있는 만큼만)
 */
export interface CardFx {
  readonly grain?: number
  readonly iron?: number
  /** 그해 가을걷이 배수 (0.85 = 15% 덜 거둔다) */
  readonly harvest?: number
  /** 우리 군대 사기 + */
  readonly morale?: number
  /** 우리 장수 모두의 정 ± */
  readonly bond?: number
  /** 장수 하나하나의 정 — 다툼 */
  readonly bonds?: ReadonlyArray<readonly [hero: string, d: number]>
  /** 고을마다 잃는 집 */
  readonly hurt?: ReadonlyArray<readonly [node: string, hh: number]>
  /** 우리 고을마다 경계 + */
  readonly watch?: number
  /** 그 나라들의 호감 ± — 갈래마다 (내놓으라는 나라는 오르고 다른 나라는 내린다) */
  readonly favor?: ReadonlyArray<{ readonly to: readonly string[]; readonly d: number }>
  /** 두 장수를 혼인시킨다 (연정 소문 · heroes.wed — 혼례 곡식이 든다) */
  readonly wed?: readonly [string, string]
  /** 그 나라 군대의 사기가 꺾인다 */
  readonly foe?: { readonly faction: string; readonly d: number }
  /** 새로 오는 장수 */
  readonly join?: string
}

export interface CardPlan {
  /** 틀림없이 일어나는 것 */
  readonly sure: CardFx
  /** 굴리는 답이면 이룰 확률 — 판정은 roll(card-res:{kind}:{die}) < chance. 굴리지 않으면 없다 */
  readonly chance?: number
  readonly die?: string
  readonly win?: CardFx
  readonly lose?: CardFx
  /** 보고 줄에 남길 장수 — 다툼에서 편든 이 · 들어온 망명자 */
  readonly hero?: string
}

/**
 * 이 답을 고르면 무엇이 되나 — 화면은 이것을 아이콘·숫자로, 엔진은 이것을 그대로 건다 (어긋날 수 없게 한 셈).
 * have — 카드가 걸릴 때의 창고 (화면은 이번 계절 명령을 뺀 남은 것을 넘긴다 · 카드는 명령 뒤에 걸린다)
 */
export function cardPreview(r: Realm, c: Card, pick: 0 | 1 | 2, have?: { readonly grain: number; readonly iron: number }): CardPlan | null {
  const f = r.player
  if (f === undefined) return null
  const R = P.realm
  const st = have ?? r.stock[f] ?? { grain: 0, iron: 0 }
  const cost = (share: number): number => -Math.min(st.grain, grainCost(r, st.grain, share))
  const earn = (share: number): number => grainCost(r, st.grain, share)
  const hurt = (nodes: readonly string[], share: number): Array<readonly [string, number]> =>
    nodes.flatMap((id) => (r.nodes[id] !== undefined ? [[id, Math.round(r.nodes[id]!.hh * share)] as const] : []))
  const cheer: CardFx = { morale: R.cardMorale, bond: R.cardBond }
  switch (c.kind) {
    case 'drought':
      return { sure: pick === 0 ? { grain: cost(R.cardDroughtPray), harvest: R.cardDroughtPrayMul } : { grain: cost(R.cardDroughtDam), harvest: R.cardDroughtDamMul } }
    case 'bounty':
      return { sure: pick === 0 ? { harvest: R.cardBountyMul } : { grain: cost(R.cardFeastGrain), ...cheer } }
    case 'locust':
      if (pick === 0) return { sure: { harvest: R.cardLocustBurnMul } }
      // 산천에 빈다 — 『삼국사기』 파사이사금 30년 「王遍祭山川，以祈禳之，蝗滅」 · 곡식을 조금 바치고, 흔히 메뚜기가 사라진다 (형 10-24)
      return { sure: { grain: cost(R.cardLocustPray) }, chance: R.cardLocustOk, die: 'wait', win: {}, lose: { harvest: R.cardLocustFailMul } }
    case 'plague':
      if (pick === 0) return { sure: { hurt: hurt([c.node!], R.cardPlagueShut), grain: cost(R.cardPlagueShutGrain) } }
      return { sure: {}, chance: R.cardPlagueOk, die: 'spread', win: {}, lose: { hurt: hurt(bigNodes(r, f).slice(0, 2), R.cardPlagueHit) } }
    case 'halo':
      return { sure: pick === 0 ? { morale: R.cardMorale } : { watch: R.cardHaloWatch } }
    case 'quarrel': {
      // 침묵 — 둘이 스스로 풀면 둘 다 조금 오르고, 앙금이 남으면 둘 다 조금 떨어진다
      if (pick === 2) {
        const both = (d: number): CardFx => ({ bonds: [[c.hero!, d], [c.hero2!, d]] })
        return { sure: {}, chance: R.cardQuarrelHushOk, die: 'hush', win: both(R.cardQuarrelHush), lose: both(-R.cardQuarrelHush) }
      }
      const [win, lose] = pick === 0 ? [c.hero!, c.hero2!] : [c.hero2!, c.hero!]
      return { sure: { bonds: [[win, R.cardQuarrel], [lose, -R.cardQuarrel]] }, hero: win }
    }
    case 'waship':
      if (pick === 0) {
        const n = Math.min(Math.floor(st.iron), Math.max(R.cardIronSellMin, Math.round(st.iron * R.cardIronSellShare)))
        return { sure: { iron: -n, grain: n * R.cardIronSell } }
      } else {
        const g = -cost(R.cardIronBuyShare)
        return { sure: { grain: -g, iron: Math.round(g / R.cardIronBuy) } }
      }
    case 'pirates':
      if (pick === 0) return { sure: { grain: cost(R.cardPirateRansom) } }
      return { sure: {}, chance: R.cardPirateOk, die: 'fight', win: { iron: R.cardPirateIron }, lose: { hurt: hurt([c.node!], R.cardPirateHit), grain: cost(R.cardPirateLoss) } }
    case 'exile': {
      if (pick === 1) return { sure: {} }
      const pool = poolFree(r)
      const p = c.guest !== undefined ? pool.find((h) => h.id === c.guest) : pool[Math.floor(roll(r.seed, r.season, `card-res:${c.kind}:who`) * pool.length)]
      return p !== undefined && homeOf(r, f) !== null ? { sure: { grain: cost(R.cardExileCost), join: p.id }, hero: p.id } : { sure: {} }
    }
    case 'fugitive': {
      // 내놓으라는 나라가 있으면 — 법을 지키면 그 나라만 노하고, 넘겨주면 그 나라는 반기고 다른 나라들이 법을 깼다고 본다
      if (c.from !== undefined) {
        const others = knownOf(r, f).filter((x) => x !== c.from)
        return pick === 0
          ? { sure: { favor: [{ to: [c.from], d: -R.cardFavorDown }], bond: R.cardFugitiveBond } }
          : { sure: { grain: earn(R.cardFugitiveGrain), favor: [{ to: [c.from], d: R.cardFavorUp }, ...(others.length > 0 ? [{ to: others, d: -R.cardFavorDown }] : [])] } }
      }
      return pick === 0
        ? { sure: { favor: [{ to: knownOf(r, f), d: R.cardFavorUp }], bond: R.cardFugitiveBond } }
        : { sure: { grain: earn(R.cardFugitiveGrain), favor: [{ to: knownOf(r, f), d: -R.cardFavorDown }] } }
    }
    case 'romance': {
      const both = (d: number): CardFx => ({ bonds: [[c.hero!, d], [c.hero2!, d]] })
      if (pick === 0) return { sure: { grain: -Math.min(st.grain, R.wedGrain), wed: [c.hero!, c.hero2!] }, hero: c.hero! }
      if (pick === 1) return { sure: {}, chance: R.cardRomanceOk, die: 'love', win: both(R.cardRomanceBond), lose: {} }
      return { sure: both(-R.cardRomanceSplit) }
    }
    case 'whale':
      return { sure: pick === 0 ? { grain: Math.max(R.cardWhaleMin, earn(R.cardWhaleShare)) } : cheer }
    case 'fishbridge':
      // 나루를 끊는다 — 쫓던 동부여 군대의 기가 꺾인다 · 알린다 — 우리 기운이 오른다
      return { sure: pick === 0 ? { foe: { faction: 'buyeo', d: R.cardFishMorale } } : cheer }
    case 'gogak':
      // 『삼국사기』 동명성왕 2년 — 부분노가 비류국의 고각을 가져와 송양이 감히 다투지 못했다 · 들키면 노한다
      if (pick === 1) return { sure: { favor: [{ to: ['biryuna'], d: R.cardGogakFavor }] } }
      return { sure: {}, chance: R.cardGogakOk, die: 'steal', win: { foe: { faction: 'biryuna', d: R.cardGogakMorale } }, lose: { favor: [{ to: ['biryuna'], d: -R.cardGogakAngry }] } }
  }
}

/** 한 갈래의 일을 판에 건다 — 실제로 오간 곡식·쇠·집을 tally 에 */
function applyFx(r: Realm, f: string, fx: CardFx, tally: { grain: number; iron: number; hh: number }, lines: ReportLine[]): void {
  const R = P.realm
  const st = (r.stock[f] ??= { grain: 0, iron: 0 })
  if (fx.grain !== undefined) { const d = Math.max(-st.grain, fx.grain); st.grain += d; tally.grain += d }
  if (fx.iron !== undefined) { const d = Math.max(-st.iron, fx.iron); st.iron += d; tally.iron += d }
  for (const [id, d] of fx.hurt ?? []) { const n = r.nodes[id]; if (n !== undefined) { n.hh -= d; tally.hh -= d } }
  if (fx.harvest !== undefined) setHarvest(r, f, fx.harvest)
  if (fx.morale !== undefined) for (const a of Object.values(r.armies)) if (a.faction === f) a.morale = clampMorale(a.morale + fx.morale)
  if (fx.bond !== undefined) for (const h of freeHeroes(r, f)) addBond(r, h, fx.bond, lines)
  for (const [id, d] of fx.bonds ?? []) { const h = r.heroes[id]; if (h !== undefined) addBond(r, h, d, lines) }
  if (fx.watch !== undefined) for (const n of Object.values(r.nodes)) if (n.owner === f) { const w = (r.watch[n.id] ??= { alert: 0, lull: 0 }); w.alert = Math.min(1, w.alert + fx.watch) }
  for (const fv of fx.favor ?? []) for (const o of fv.to) addFavor(r, f, o, fv.d)
  if (fx.wed !== undefined) {
    const g0 = st.grain
    if (wed(r, { kind: 'wed', faction: f, a: fx.wed[0], b: fx.wed[1] }, lines)) tally.grain += st.grain - g0
  }
  if (fx.foe !== undefined) for (const a of Object.values(r.armies)) if (a.faction === fx.foe.faction) a.morale = Math.max(R.cardFishFloor, a.morale - fx.foe.d)
  if (fx.join !== undefined) {
    const p = HERO_POOL.find((h) => h.id === fx.join)
    const at = homeOf(r, f)
    if (p !== undefined && at !== null) r.heroes[p.id] = { ...structuredClone(p), faction: f, status: 'free', captor: null, at, post: null, bond: R.bondHired }
  }
}

/** 1 — 이번 계절 카드의 답을 건다. 고르지 않았으면 cardFallback (첫째 · 망명자는 돌려보낸다 · 장수 다툼은 침묵) */
export function resolveCard(r: Realm, orders: readonly Order[], lines: ReportLine[]): void {
  const c = r.card
  const f = r.player
  if (c === undefined || c === null || f === undefined) return
  r.card = null
  if (c.season !== r.season || !cardValid(r, c)) return
  const o = orders.find((x): x is Extract<Order, { kind: 'card' }> => x.kind === 'card' && x.faction === f)
  // 고르지 않으면 첫째 — 다만 망명자는 돌려보낸다 (가만히 있는데 장수가 느는 일이 없게 · 받으려면 눌러서) · 장수 다툼은 침묵
  const n = CARDS[c.kind].opts.length
  const pick: 0 | 1 | 2 = o !== undefined && o.pick < n ? o.pick : o !== undefined ? 0 : cardFallback(c.kind)
  const plan = cardPreview(r, c, pick)!
  const tally = { grain: 0, iron: 0, hh: 0 }
  applyFx(r, f, plan.sure, tally, lines)
  let good: boolean | undefined
  if (plan.chance !== undefined) {
    good = roll(r.seed, r.season, `card-res:${c.kind}:${plan.die}`) < plan.chance
    const fx = good ? plan.win : plan.lose
    if (fx !== undefined) applyFx(r, f, fx, tally, lines)
  }
  const { grain, iron, hh } = tally
  const hero = plan.hero
  lines.push({
    kind: 'card', faction: f, card: c.kind, pick, ...(c.why !== undefined ? { why: c.why } : {}),
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
