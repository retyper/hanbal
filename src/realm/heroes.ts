/**
 * 장수 첫판 — 자리 · 군주 · 특성의 효과 · 고을 맡기기 · 회유 · 떠돌이 인재 · 본 장수 (docs/realm/HEROES.md)
 *
 * 장수는 **군대를 이끌거나**(army.hero) **혼자 고을에 머문다**(hero.at). 혼자 머무는 자리에 맡은 일(post)이 있으면
 * 그 고을에 내정·지략·매력과 특성이 걸린다. 군주(Faction.ruler)는 군대를 이끌지 않고 도읍에 머물며, 능력치가 나라 전체에 작게 걸린다.
 * 순수 함수만. season.ts · economy.ts · diplomacy.ts · plots.ts 가 부른다 — 이 파일은 그쪽을 부르지 않는다 (고리 없음).
 * 숫자는 P.realm.hero* · post* · trait* · ruler* · persuade* · wanderer*.
 */
import { roll } from '../core/rng.ts'
import { P } from '../tune/params.ts'
import { HERO_POOL } from './data/heroes-pool.ts'
import type { EdgeKind, GrowStat, Hero, Order, Realm, ReportLine } from './types.ts'

const byId = <T extends { id: string }>(xs: Iterable<T>): T[] => [...xs].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))

export const hasTrait = (h: Hero | null | undefined, t: string): boolean => h?.traits?.includes(t) ?? false

/** 매력 — 술꾼은 +1 (HEROES §2) */
export const deokOf = (h: Hero): number => Math.min(10, h.deok + (hasTrait(h, 'drinker') ? 1 : 0))

/** 이 장수가 어느 나라의 군주인가 */
export function isRuler(r: Realm, hero: string): boolean {
  return Object.values(r.factions).some((f) => f.ruler === hero)
}

/** 나라의 군주 — 살아서 제 나라에 있을 때만 (사로잡히면 효과가 없다) */
export function rulerOf(r: Realm, faction: string): Hero | null {
  const id = r.factions[faction]?.ruler
  const h = id !== undefined ? r.heroes[id] : undefined
  return h !== undefined && h.status === 'free' && h.faction === faction ? h : null
}

/** 장수가 이끄는 군대 */
export function armyOfHero(r: Realm, hero: string) {
  return byId(Object.values(r.armies)).find((a) => a.hero === hero) ?? null
}

/** 장수가 지금 있는 고을 — 이끄는 군대의 자리, 아니면 혼자 머무는 자리 */
export function heroAt(r: Realm, hero: string): string | null {
  const a = armyOfHero(r, hero)
  if (a !== null) return a.at
  return r.heroes[hero]?.at ?? null
}

/** 그 고을을 맡은 장수 — 고을 주인의 장수여야 한다 */
export function postHero(r: Realm, node: string): Hero | null {
  const owner = r.nodes[node]?.owner
  if (owner === null || owner === undefined) return null
  for (const h of byId(Object.values(r.heroes))) {
    if (h.post === node && h.status === 'free' && h.faction === owner) return h
  }
  return null
}

/** 그 고을에 혼자 머무는(군대를 안 이끄는) 제 나라 장수들 — id 순서 */
export function heroesAlone(r: Realm, node: string, faction: string): Hero[] {
  return byId(Object.values(r.heroes)).filter((h) => h.status === 'free' && h.faction === faction && h.at === node && armyOfHero(r, h.id) === null)
}

// ───────── 싸움에 걸리는 것

/** 지휘 — 무예와 통솔을 반씩 (HEROES §1). 장수가 없으면 1 */
export const commandOf = (h: Hero | null): number => (h === null ? 1 : (h.mu + h.tong) / 2)

/** 이끄는 군대 궁수의 힘 배수 — 명궁이면 조금 (명궁의 몫은 자객 — plots.ts assassin) */
export function bowMulOf(h: Hero | null): number {
  return hasTrait(h, 'archer') ? P.realm.traitArcherBow : 1
}

/** 기습 특성 — 산사람(고개) · 물길잡이(나루·뱃길) · 밤눈(모든 길) */
export function ambushTraitOf(h: Hero | null, kind: EdgeKind): number {
  if (h === null) return 0
  const R = P.realm
  let t = 0
  if (hasTrait(h, 'nighteye')) t += R.traitAmbush
  if (hasTrait(h, 'mountain') && kind === 'pass') t += R.traitAmbush
  if (hasTrait(h, 'river') && (kind === 'ford' || kind === 'sea')) t += R.traitAmbush
  return t
}

/** 졌을 때 빠져나오기 — 무예가 높으면 생포·전사가 준다. 겁 많음은 아예 안 잡힌다 */
export function escapeOf(h: Hero): number {
  return P.realm.heroEscapePerMu * (h.mu - 5)
}

// ───────── 나라·고을에 걸리는 것

/** 사신 받아 줄 확률 가산 — 군주 매력 + 그 나라 장수의 매혹 · (교역이면) 장사꾼 */
export function envoyBonus(r: Realm, from: string, ask: string): number {
  const R = P.realm
  let b = 0
  const ruler = rulerOf(r, from)
  if (ruler !== null) b += R.rulerDeokEnvoy * (deokOf(ruler) - 5)
  const mine = Object.values(r.heroes).filter((h) => h.faction === from && h.status === 'free')
  if (mine.some((h) => hasTrait(h, 'charm'))) b += R.traitCharm
  if (ask === 'trade' && mine.some((h) => hasTrait(h, 'trader'))) b += R.traitTrader
  return b
}

/** 공작 성공 확률 가산 — 군주 지략 */
export function plotBonus(r: Realm, faction: string): number {
  const ruler = rulerOf(r, faction)
  return ruler === null ? 0 : P.realm.rulerRyakPlot * (ruler.ryak - 5)
}

/** 나라 군사 상한 가산 — 군주 통솔 */
export function draftCapBonus(r: Realm, faction: string): number {
  const ruler = rulerOf(r, faction)
  return ruler === null ? 0 : P.realm.rulerTongDraft * (ruler.tong - 5)
}

/** 고을 수확 배수 — 맡은 장수 내정 · 농사꾼 · 군주 내정 */
export function harvestMul(r: Realm, node: string): number {
  const R = P.realm
  let m = 1
  const owner = r.nodes[node]?.owner
  if (owner !== null && owner !== undefined) {
    const ruler = rulerOf(r, owner)
    if (ruler !== null) m += R.rulerChiHarvest * (ruler.chi - 5)
  }
  const h = postHero(r, node)
  if (h !== null) {
    m += R.postChiHarvest * (h.chi - 5)
    if (hasTrait(h, 'farmer')) m += R.traitFarmer
  }
  return Math.max(0.5, m)
}

/** 고을 가호·개척 성장 배수 — 맡은 장수 내정 */
export function growMul(r: Realm, node: string): number {
  const h = postHero(r, node)
  return h === null ? 1 : Math.max(0.3, 1 + P.realm.postChiGrow * (h.chi - 5))
}

/** 장정 배수 — 맡은 장수 매력 · 백 사람의 이름 */
export function militiaMul(r: Realm, node: string): number {
  const h = postHero(r, node)
  if (h === null) return 1
  const m = Math.max(0.5, 1 + P.realm.postDeokMilitia * (deokOf(h) - 5))
  return m * (hasTrait(h, 'hundred') ? P.realm.traitHundred : 1)
}

/** 경계 바닥값 — 맡은 장수 지략 · 신중 + · 술꾼 − */
export function alertFloor(r: Realm, node: string): number {
  const R = P.realm
  const h = postHero(r, node)
  if (h === null) return 0
  let f = R.postRyakAlert * h.ryak
  if (hasTrait(h, 'careful')) f += R.traitCareful
  if (hasTrait(h, 'drinker')) f -= R.traitDrinker
  return Math.max(0, Math.min(R.alertMax, f))
}

/** 이 고을에서 뽑는 군사가 철검을 드나 — 철의 손 */
export const ironhandAt = (r: Realm, node: string): boolean => hasTrait(postHero(r, node), 'ironhand')

/** 군량 가산 — 대식가가 이끄는 군대의 사람 수 × traitGlutton */
export function gluttonMen(r: Realm, faction: string): number {
  let n = 0
  for (const a of Object.values(r.armies)) {
    if (a.faction !== faction || a.hero === null || !hasTrait(r.heroes[a.hero], 'glutton')) continue
    for (const v of Object.values(a.mix)) n += v ?? 0
  }
  return n * P.realm.traitGlutton
}

/** 제사의 효과 배수 — 그 나라에 무당 핏줄이 있으면 두 배 */
export function riteMul(r: Realm, faction: string): number {
  return Object.values(r.heroes).some((h) => h.faction === faction && h.status === 'free' && hasTrait(h, 'shaman')) ? 2 : 1
}

// ───────── 본 장수 (정보의 계약, HEROES §5)

/** 이 나라가 그 장수들을 봤다 — 능력치가 보인다 */
export function noteMet(r: Realm, faction: string, heroes: Iterable<string | null>): void {
  const list = ((r.met ??= {})[faction] ??= [])
  for (const h of heroes) if (h !== null && !list.includes(h)) list.push(h)
  list.sort()
}

/** 그 고을에 있는 장수 — 머무는 군대의 장수와 혼자 머무는 장수 */
export function heroesAtNode(r: Realm, node: string): string[] {
  const out: string[] = []
  for (const a of byId(Object.values(r.armies))) if (a.at === node && a.march === null && a.hero !== null) out.push(a.hero)
  for (const h of byId(Object.values(r.heroes))) if (h.status === 'free' && h.at === node && armyOfHero(r, h.id) === null) out.push(h.id)
  return out
}

/**
 * 그 장수의 능력치가 이 나라에 보이나 — 우리 장수 · 우리 포로 · 싸워 봤거나 정찰·첩자로 본 장수.
 * 아니면 얼굴과 이름만 (화면이 정한다).
 */
export function heroSeen(r: Realm, faction: string, hero: string): boolean {
  const h = r.heroes[hero]
  if (h === undefined) return false
  if (h.faction === faction || (h.status === 'captive' && h.captor === faction)) return true
  return r.met?.[faction]?.includes(hero) ?? false
}

// ───────── 명령 (1 단계 — planned 에도 든다)

function assignHero(r: Realm, o: Extract<Order, { kind: 'assign' }>): void {
  const h = r.heroes[o.hero]
  if (h === undefined || h.status !== 'free' || isRuler(r, h.id)) return
  if (o.node === null) {
    h.post = null
    return
  }
  const node = r.nodes[o.node]
  if (node === undefined || node.owner !== h.faction || node.kind === 'sodo') return
  const a = armyOfHero(r, h.id)
  if (a !== null) {
    if (a.at !== o.node || a.march !== null) return
    a.hero = null
  } else if (h.at !== o.node) return
  // 한 고을에 맡은 장수는 하나 — 먼저 있던 장수는 자리만 내놓고 그 고을에 남는다
  for (const x of Object.values(r.heroes)) if (x.id !== h.id && x.post === o.node && x.faction === h.faction) x.post = null
  h.at = o.node
  h.post = o.node
}

function leadArmy(r: Realm, o: Extract<Order, { kind: 'lead' }>): void {
  const h = r.heroes[o.hero]
  const a = r.armies[o.army]
  if (h === undefined || a === undefined || h.status !== 'free' || isRuler(r, h.id)) return
  if (a.faction !== h.faction || a.hero !== null || a.march !== null) return
  if (armyOfHero(r, h.id) !== null || h.at !== a.at) return
  a.hero = h.id
  h.at = null
  h.post = null
}

/**
 * 회유 계절 수 — 우리 매력·매혹 대 그의 의리 (형: 의리가 낮으면 회유가 쉽다). 군주였던 이는 오래 걸린다
 */
export function persuadeSeasons(r: Realm, hero: string, by: string | null): number {
  const R = P.realm
  const b = by !== null ? r.heroes[by] : undefined
  const him = r.heroes[hero]
  // 옛 주인을 믿던 장수는 잘 안 넘어온다 (정 — HEROES §6)
  const loyal = him !== undefined && (bondOf(r, him) ?? 0) >= R.bondTrust ? R.bondUiri : 0
  let n = R.persuadeSeasons + Math.round(((him?.uiri ?? 5) + loyal - (b !== undefined ? deokOf(b) : 3)) * R.persuadeUiriPer)
  if (hasTrait(b, 'charm')) n -= 1
  if (isRuler(r, hero)) n += 2
  return Math.max(1, n)
}

function startPersuade(r: Realm, o: Extract<Order, { kind: 'persuade' }>): void {
  const h = r.heroes[o.hero]
  if (h === undefined || h.status !== 'captive' || h.captor === null) return
  const by = o.by !== null ? r.heroes[o.by] : undefined
  if (o.by !== null && (by === undefined || by.status !== 'free' || by.faction !== h.captor)) return
  const left = persuadeSeasons(r, h.id, o.by)
  h.persuade = h.persuade === undefined ? { by: o.by, left } : { by: o.by, left: Math.min(h.persuade.left, left) }
}

function hire(r: Realm, o: Extract<Order, { kind: 'hire' }>, lines: ReportLine[]): void {
  const list = r.wanderers ?? []
  const i = list.findIndex((w) => w.hero.id === o.hero)
  const w = list[i]
  if (w === undefined || r.nodes[w.node]?.owner !== o.faction) return
  const st = (r.stock[o.faction] ??= { grain: 0, iron: 0 })
  if (st.grain < w.price) return
  st.grain -= w.price
  r.heroes[w.hero.id] = { ...structuredClone(w.hero), faction: o.faction, status: 'free', captor: null, at: w.node, post: null, bond: P.realm.bondHired }
  list.splice(i, 1)
  lines.push({ kind: 'recruit', hero: w.hero.id, faction: o.faction, how: 'wanderer' })
}

/** 1 — 장수 명령. 규칙에 안 맞으면 아무 일도 없다 */
export function applyHeroOrders(r: Realm, orders: readonly Order[], lines: ReportLine[]): void {
  for (const o of orders) {
    if (o.kind === 'assign') assignHero(r, o)
    else if (o.kind === 'lead') leadArmy(r, o)
    else if (o.kind === 'persuade') startPersuade(r, o)
    else if (o.kind === 'hire') hire(r, o, lines)
  }
  placeOrphans(r)
}

// ───────── 자리 정리

function neighborsOf(r: Realm, node: string): string[] {
  const out: string[] = []
  for (const e of Object.values(r.edges)) {
    if (e.a === node) out.push(e.b)
    else if (e.b === node) out.push(e.a)
  }
  return out.sort()
}

/** 나라의 아무 제 고을 — 도읍이 먼저, 없으면 id 순서 첫 고을 */
function homeOf(r: Realm, faction: string): string | null {
  const cap = r.factions[faction]?.capital
  if (cap !== undefined && r.nodes[cap]?.owner === faction) return cap
  return byId(Object.values(r.nodes)).find((n) => n.owner === faction && n.kind !== 'sodo')?.id ?? null
}

/**
 * 이끌던 군대가 흩어지거나 해산한 장수는 갈 곳이 없다 — 그 나라 도읍(없으면 아무 제 고을)에 혼자 머문다.
 * 사로잡히거나 죽은 장수는 자리가 없다.
 */
function placeOrphans(r: Realm): void {
  for (const h of byId(Object.values(r.heroes))) {
    if (h.status !== 'free') {
      h.at = null
      h.post = null
      continue
    }
    if (h.at === null && armyOfHero(r, h.id) === null) h.at = homeOf(r, h.faction)
  }
}

/**
 * 고을을 잃었다 — 거기 혼자 머물던 장수는 이웃 제 고을로 물러나고, 갈 데가 없으면 그 고을을 쥔 나라에 사로잡힌다.
 * 군주가 도읍에서 사로잡히면 군주의 효과도 끝난다. 행군이 끝난 뒤(3·4·5) 부른다.
 */
export function sweepHeroes(r: Realm, lines: ReportLine[]): void {
  placeOrphans(r)
  for (const h of byId(Object.values(r.heroes))) {
    if (h.status !== 'free' || h.at === null || armyOfHero(r, h.id) !== null) continue
    const node = r.nodes[h.at]
    if (node === undefined || node.owner === h.faction) continue
    h.post = null
    const safe = neighborsOf(r, h.at).find((n) => r.nodes[n]?.owner === h.faction && r.nodes[n]?.kind !== 'sodo') ?? null
    if (safe !== null) {
      h.at = safe
      lines.push({ kind: 'heroMoved', hero: h.id, faction: h.faction, to: safe, captor: null })
    } else if (node.owner !== null) {
      h.status = 'captive'
      h.captor = node.owner
      h.at = null
      lines.push({ kind: 'heroMoved', hero: h.id, faction: h.faction, to: null, captor: node.owner })
    } else h.at = homeOf(r, h.faction)
  }
}

// ───────── 계절 끝 (9 자리)

function poolPrice(h: Hero): number {
  return (h.mu + h.tong + h.ryak + h.chi + h.deok + h.uiri) * P.realm.wandererPricePer
}

/**
 * 9 — 회유가 나아가고 · 떠돌이가 오가고 · 맡은 고을의 경계 바닥과 대장장이 철.
 * 경계 감쇠(decayWatch) 뒤에 부른다.
 */
export function stepHeroes(r: Realm, lines: ReportLine[]): void {
  const R = P.realm
  // 회유 — 사로잡은 나라가 곡식을 대는 계절만 나아간다
  for (const h of byId(Object.values(r.heroes))) {
    if (h.persuade === undefined) continue
    if (h.status !== 'captive' || h.captor === null) {
      delete h.persuade
      continue
    }
    const st = (r.stock[h.captor] ??= { grain: 0, iron: 0 })
    if (st.grain < R.persuadeGrain) continue
    st.grain -= R.persuadeGrain
    h.persuade.left -= 1
    if (h.persuade.left > 0) continue
    const to = h.captor
    const by = h.persuade.by
    delete h.persuade
    h.faction = to
    h.status = 'free'
    h.captor = null
    h.post = null
    h.at = homeOf(r, to)
    // 새 주인과는 낯설다 — 정은 처음부터 다시
    h.bond = R.bondPersuaded
    h.served = 0
    lines.push({ kind: 'recruit', hero: h.id, faction: to, how: 'persuade' })
    const pb = by !== null ? r.heroes[by] : undefined
    if (pb !== undefined) gainXp(pb, 'deok', R.xpPersuade, lines)
  }
  // 맡은 고을 — 경계 바닥 · 대장장이
  for (const node of Object.keys(r.nodes).sort()) {
    const h = postHero(r, node)
    if (h === null) continue
    const w = (r.watch[node] ??= { alert: 0, lull: 0 })
    w.alert = Math.max(w.alert, alertFloor(r, node))
    if (hasTrait(h, 'smith')) (r.stock[h.faction] ??= { grain: 0, iron: 0 }).iron += R.traitSmith
  }
  // 떠돌이 — 머물 기한이 지나면 떠난다. 봄 끝에 새 사람이 온다
  r.wanderers = (r.wanderers ?? []).filter((w) => w.until > r.season)
  if (((r.season % 4) + 4) % 4 === 0 && roll(r.seed, r.season, 'wanderer') < R.wandererChance) {
    const used = new Set(r.poolUsed ?? [])
    const pool = HERO_POOL.filter((x) => !used.has(x.id) && r.heroes[x.id] === undefined)
    const places = byId(Object.values(r.nodes)).filter((n) => n.owner !== null && n.kind !== 'sodo')
    if (pool.length > 0 && places.length > 0) {
      const who = pool[Math.floor(roll(r.seed, r.season, 'wanderer-who') * pool.length)]!
      const at = places[Math.floor(roll(r.seed, r.season, 'wanderer-at') * places.length)]!
      const until = r.season + R.wandererStay
      const price = poolPrice(who)
      ;(r.poolUsed ??= []).push(who.id)
      r.wanderers.push({ hero: structuredClone(who), node: at.id, until, price })
      lines.push({ kind: 'wanderer', hero: who.id, node: at.id, until, price })
    }
  }
  stepGrowth(r, lines)
}

/** 이 나라가 지금 들일 수 있는 떠돌이 — 제 고을에 머무는 이 */
export function wanderersFor(r: Realm, faction: string) {
  return (r.wanderers ?? []).filter((w) => r.nodes[w.node]?.owner === faction)
}

// ───────── 정과 성장 (HEROES §6, 형: "장수를 오래쓰면 친밀도? 호감도? 이런게 올라야 하지 않을까? 장수 키우는 맛도 있어야할듯")
//
// 정(bond) — 섬긴 계절·이긴 싸움으로 오르고 진 싸움으로 준다. 70 이면 믿는 장수(사기 + · 남의 회유에 버틴다), 100 이면 특성 하나에 눈뜬다.
// 공(xp) — 하는 일마다 그 능력치에 쌓인다: 싸움은 무예·통솔, 맡은 고을은 내정·매력, 암살은 지략, 회유는 매력. 차면 한 단계 (최대 10).

const GROW: readonly GrowStat[] = ['mu', 'tong', 'ryak', 'chi', 'deok']

/** 정이 다 차면 눈뜨는 특성 — 가장 많이 자란 능력치에 어울리는 것 (id 순서로 첫 빈 것) */
const AWAKEN: Readonly<Record<GrowStat, readonly string[]>> = {
  mu: ['archer', 'mountain', 'nighteye'],
  tong: ['careful', 'hundred', 'river'],
  ryak: ['archer', 'careful', 'nighteye'],
  chi: ['farmer', 'ironhand', 'smith'],
  deok: ['charm', 'shaman', 'trader'],
}

/** 이 장수의 정 — 군주는 없다(null). 적어 두지 않았으면 처음부터 섬긴 장군 */
export function bondOf(r: Realm, h: Hero): number | null {
  if (isRuler(r, h.id)) return null
  return h.bond ?? P.realm.bondStart
}

/** 정의 단계 — 낯섦 0~29 · 정듦 30~69 · 믿음 70~99 · 한마음 100 */
export function bondTier(r: Realm, h: Hero): 'new' | 'warm' | 'trust' | 'sworn' | null {
  const b = bondOf(r, h)
  if (b === null) return null
  return b >= 100 ? 'sworn' : b >= P.realm.bondTrust ? 'trust' : b >= 30 ? 'warm' : 'new'
}

/** 믿는 장수가 이끄는 군대의 사기 덤 */
export function bondMoraleOf(r: Realm, h: Hero | null): number {
  if (h === null) return 0
  const b = bondOf(r, h)
  return b !== null && b >= P.realm.bondTrust ? P.realm.bondMorale : 0
}

/** 이 능력치를 한 단계 올리는 데 드는 공 */
export function growNeed(h: Hero, stat: GrowStat): number {
  return P.realm.growXp + P.realm.growXpPer * Math.max(0, h[stat] - 5)
}

/** 정을 더한다 (0~100). 70 을 넘으면 믿는 장수, 100 이 차면 특성 하나에 눈뜬다 */
export function addBond(r: Realm, h: Hero, d: number, lines: ReportLine[]): void {
  const was = bondOf(r, h)
  if (was === null || d === 0 || h.status !== 'free') return
  const now = Math.max(0, Math.min(100, was + d))
  h.bond = now
  if (was < P.realm.bondTrust && now >= P.realm.bondTrust) lines.push({ kind: 'bond', hero: h.id, tier: 'trust' })
  if (now >= 100 && h.awoken === undefined && h.traits.length < 3) {
    // 가장 많이 자란 능력치 — 같으면 GROW 순서, 하나도 안 자랐으면 가장 높은 능력치
    const by = (f: (s: GrowStat) => number): GrowStat => GROW.reduce((a, s) => (f(s) > f(a) ? s : a), GROW[0]!)
    const grownAny = GROW.some((s) => (h.grown?.[s] ?? 0) > 0)
    const stat = grownAny ? by((s) => h.grown?.[s] ?? 0) : by((s) => h[s])
    const t = AWAKEN[stat].find((x) => !h.traits.includes(x))
    if (t !== undefined) {
      ;(h as { traits: readonly string[] }).traits = [...h.traits, t]
      h.awoken = t
      lines.push({ kind: 'awaken', hero: h.id, trait: t })
    }
  }
}

/** 공을 쌓는다 — 차면 그 능력치가 한 단계 (10 까지) */
export function gainXp(h: Hero, stat: GrowStat, n: number, lines: ReportLine[]): void {
  if (n <= 0 || h.status !== 'free') return
  const xp = (h.xp ??= {})
  xp[stat] = (xp[stat] ?? 0) + n
  while (h[stat] < 10 && (xp[stat] ?? 0) >= growNeed(h, stat)) {
    xp[stat] = (xp[stat] ?? 0) - growNeed(h, stat)
    h[stat] += 1
    const g = (h.grown ??= {})
    g[stat] = (g[stat] ?? 0) + 1
    lines.push({ kind: 'grow', hero: h.id, stat })
  }
  if (h[stat] >= 10) xp[stat] = 0
}

/** 싸움이 끝났다 — 이끈 장수들 (사로잡히거나 죽은 이는 빠진다). won·lost 는 군대의 장수 id, 교착이면 drawn */
export function battleGrowth(r: Realm, won: readonly (string | null)[], lost: readonly (string | null)[], drawn: readonly (string | null)[], lines: ReportLine[]): void {
  const R = P.realm
  const each = (ids: readonly (string | null)[], f: (h: Hero) => void): void => {
    for (const id of [...new Set(ids)].sort()) {
      const h = id !== null ? r.heroes[id] : undefined
      if (h !== undefined && h.status === 'free') f(h)
    }
  }
  each(won, (h) => { gainXp(h, 'mu', R.xpWin, lines); gainXp(h, 'tong', R.xpWin, lines); addBond(r, h, R.bondWin, lines) })
  each(lost, (h) => { gainXp(h, 'mu', R.xpLose, lines); gainXp(h, 'tong', R.xpLose, lines); addBond(r, h, -R.bondLose, lines) })
  each(drawn, (h) => { gainXp(h, 'mu', R.xpLose, lines); gainXp(h, 'tong', R.xpLose, lines) })
}

/** 9 — 섬긴 계절: 정이 조금 오르고, 맡은 고을이 있으면 내정·매력에 공이 쌓인다. 군주는 정이 없다 */
function stepGrowth(r: Realm, lines: ReportLine[]): void {
  const R = P.realm
  for (const h of byId(Object.values(r.heroes))) {
    if (h.status !== 'free' || isRuler(r, h.id)) continue
    h.served = (h.served ?? 0) + 1
    addBond(r, h, R.bondSeason, lines)
    if (h.post !== null) {
      gainXp(h, 'chi', R.xpPost, lines)
      gainXp(h, 'deok', R.xpPost, lines)
    }
  }
}
