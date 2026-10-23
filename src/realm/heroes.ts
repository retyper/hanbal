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
import { TRAITS, TRAIT, type TraitGrade } from './data/traits.ts'
import type { Art, EdgeKind, GrowStat, Hero, Order, Realm, ReportLine } from './types.ts'
import { migratePath } from './economy.ts'

const byId = <T extends { id: string }>(xs: Iterable<T>): T[] => [...xs].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))

/** id 순서로 처음 맞는 것 — byId(...).find(pred) 와 같은 답을 줄 세우지 않고 낸다 (영남 판에서 줄 세우기가 셈의 한 할이었다) */
function firstById<T extends { id: string }>(xs: Iterable<T>, pred: (x: T) => boolean): T | null {
  let best: T | null = null
  for (const x of xs) if (pred(x) && (best === null || x.id < best.id)) best = x
  return best
}

export const hasTrait = (h: Hero | null | undefined, t: string): boolean => h?.traits?.includes(t) ?? false

/** 매력 — 술꾼은 +1 (HEROES §2) */
export const deokOf = (h: Hero): number => Math.min(10, h.deok + (hasTrait(h, 'drinker') ? 1 : 0))

/** 이 장수가 어느 나라의 군주인가 */
export function isRuler(r: Realm, hero: string): boolean {
  return Object.values(r.factions).some((f) => f.ruler === hero)
}

/**
 * 플레이어는 그 나라의 **군주**다 (형 10-23: "플레이어가 정확히 뭐여야 하는지 올바르게 정의해 봐" · HEROES.md §7).
 * 군주는 도읍에서 다스린다 — 능력치가 나라 전체에 작게 걸리고, 도읍은 따로 맡긴 장수가 없으면 군주가 맡는다(맡은 고을 특성이 도읍에 걸린다).
 * 군주도 친히 나선다 — 군대를 이끌고(친정) · 자객으로 간다. 도읍을 비우면 다스림이 rulerAwayMul 만큼으로 준다.
 */
/** 군주의 다스림이 걸리는 몫 — 도읍에 있으면 1, 친정·자객으로 비웠으면 rulerAwayMul */
export function rulerReach(r: Realm, faction: string): number {
  const h = rulerOf(r, faction)
  if (h === null) return 0
  const cap = r.factions[faction]?.capital
  const home = h.at === cap && armyOfHero(r, h.id) === null && !(h.awayUntil !== undefined && h.awayUntil >= r.season)
  return home ? 1 : P.realm.rulerAwayMul
}

/** 나라의 군주 — 살아서 제 나라에 있을 때만 (사로잡히면 효과가 없다) */
export function rulerOf(r: Realm, faction: string): Hero | null {
  const id = r.factions[faction]?.ruler
  const h = id !== undefined ? r.heroes[id] : undefined
  return h !== undefined && h.status === 'free' && h.faction === faction ? h : null
}

/** 장수가 이끄는 군대 */
export function armyOfHero(r: Realm, hero: string) {
  return firstById(Object.values(r.armies), (a) => a.hero === hero)
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
  // 사신을 따라 나간 계절에는 맡은 고을에 손이 안 간다
  const posted = firstById(Object.values(r.heroes), (h) => h.post === node && h.status === 'free' && h.faction === owner && !(h.awayUntil !== undefined && h.awayUntil >= r.season))
  if (posted !== null) return posted
  // 도읍은 따로 맡긴 장수가 없으면 군주가 맡는다 — 군주의 맡은 고을 특성(농사꾼·대장장이·철의 손…)이 여기 걸린다
  if (r.factions[owner]?.capital !== node) return null
  const ruler = rulerOf(r, owner)
  return ruler !== null && ruler.at === node && armyOfHero(r, ruler.id) === null && !(ruler.awayUntil !== undefined && ruler.awayUntil >= r.season) ? ruler : null
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
/**
 * 그 장수의 비기 — 특성이 먼저(명궁 · 무당 핏줄 · 매혹 · 백 사람의 이름 · 산사람/물길잡이/밤눈), 없으면 가장 높은 능력치가
 * tacArtMinStat 이상일 때 (무예 선봉 · 지략 거짓 퇴각 · 통솔 진을 다잡는다 · 매력 큰 외침). 둘 다 아니면 비기가 없다 — 그냥 북을 친다.
 */
export function heroArt(h: Hero): Art | undefined {
  if (hasTrait(h, 'archer')) return 'snipe'
  if (hasTrait(h, 'shaman')) return 'rite'
  if (hasTrait(h, 'charm')) return 'sway'
  if (hasTrait(h, 'hundred')) return 'stand'
  if (hasTrait(h, 'mountain') || hasTrait(h, 'river') || hasTrait(h, 'nighteye')) return 'ambush'
  const best = ([['mu', 'vanguard'], ['ryak', 'feint'], ['tong', 'order'], ['deok', 'shout']] as const)
    .map(([k, a]) => ({ v: h[k], a })).sort((x, y) => y.v - x.v)[0]!
  return best.v >= P.realm.tacArtMinStat ? best.a : undefined
}

export function escapeOf(h: Hero): number {
  return P.realm.heroEscapePerMu * (h.mu - 5)
}

// ───────── 나라·고을에 걸리는 것

/** 사신 받아 줄 확률 가산 — 군주 매력 + 그 나라 장수의 매혹 · (교역이면) 장사꾼 */
/**
 * 사신 받아 줄 확률 가산 — 군주의 매력이 바탕이고, **사신을 따라간 장수**(escort)의 매력·매혹·장사꾼이 그 위에 (형: "장사꾼 장수는
 * 특별히 뭘 할 수 없잖아. 사신 보낼 때 같이 보내는 것도 아니고"). 따라간 장수가 없으면 군주의 몫뿐이다.
 */
export function envoyBonus(r: Realm, from: string, ask: string, escort?: string): number {
  const R = P.realm
  let b = 0
  const ruler = rulerOf(r, from)
  if (ruler !== null) b += R.rulerDeokEnvoy * (deokOf(ruler) - 5) * rulerReach(r, from)
  const h = escort !== undefined ? r.heroes[escort] : undefined
  const went = h !== undefined && h.faction === from && h.status === 'free' ? h : null
  if (went !== null) b += R.heroDeokEnvoy * (deokOf(went) - 5)
  // 특성은 군주 것과 따라간 장수 것 — 같은 특성은 한 번만
  const has = (t: string): boolean => (ruler !== null && hasTrait(ruler, t)) || (went !== null && hasTrait(went, t))
  if (has('charm')) b += R.traitCharm
  if (ask === 'trade' && has('trader')) b += R.traitTrader
  return b
}

/** 공작 성공 확률 가산 — 군주 지략 */
export function plotBonus(r: Realm, faction: string): number {
  const ruler = rulerOf(r, faction)
  return ruler === null ? 0 : P.realm.rulerRyakPlot * (ruler.ryak - 5) * rulerReach(r, faction)
}

/** 나라 군사 상한 가산 — 군주 통솔 */
export function draftCapBonus(r: Realm, faction: string): number {
  const ruler = rulerOf(r, faction)
  return ruler === null ? 0 : P.realm.rulerTongDraft * (ruler.tong - 5) * rulerReach(r, faction)
}

/** 고을 수확 배수 — 맡은 장수 내정 · 농사꾼 · 군주 내정 */
export function harvestMul(r: Realm, node: string): number {
  const R = P.realm
  let m = 1
  const owner = r.nodes[node]?.owner
  if (owner !== null && owner !== undefined) {
    const ruler = rulerOf(r, owner)
    if (ruler !== null) m += R.rulerChiHarvest * (ruler.chi - 5) * rulerReach(r, owner)
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

function assignHero(r: Realm, o: Extract<Order, { kind: 'assign' }>, lines: ReportLine[]): void {
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
  } else if (h.at !== o.node) {
    // 멀리 맡기기 — 우리 땅으로 이어져 있으면 정예 호위를 거느리고 그 고을로 간다. 그 계절은 길에 있다
    // (형 10-23: "군사랑 같이 이동시켜야 다른 마을로 가서 맡길 수 있는 거야? … 장수들이 어딜 가면 항상 혼자 안 가잖아")
    if (h.at === null || (h.awayUntil !== undefined && h.awayUntil >= r.season) || migratePath(r, h.faction, h.at, o.node) === null) return
    lines.push({ kind: 'heroGo', faction: h.faction, hero: h.id, from: h.at, to: o.node })
    h.awayUntil = r.season
  }
  // 한 고을에 맡은 장수는 하나 — 먼저 있던 장수는 자리만 내놓고 그 고을에 남는다
  for (const x of Object.values(r.heroes)) if (x.id !== h.id && x.post === o.node && x.faction === h.faction) x.post = null
  h.at = o.node
  h.post = o.node
}

function leadArmy(r: Realm, o: Extract<Order, { kind: 'lead' }>): void {
  const h = r.heroes[o.hero]
  const a = r.armies[o.army]
  // 군주도 친히 이끈다(친정) — 도읍을 비우는 동안 다스림이 준다 (rulerReach)
  if (h === undefined || a === undefined || h.status !== 'free') return
  if (a.faction !== h.faction || a.hero !== null || a.march !== null) return
  if (armyOfHero(r, h.id) !== null || h.at !== a.at) return
  a.hero = h.id
  h.at = null
  h.post = null
}

/**
 * 회유 — 마음의 벽 (림월드의 저항 · 형: "매 시도마다 확률적이어야 하는거 아닌가 림월드처럼"):
 * 바탕 + 의리 + 옛 주인을 믿었나 + 군주였나 + 일편단심
 */
export function resistOf(r: Realm, hero: string): number {
  const R = P.realm
  const him = r.heroes[hero]
  if (him === undefined) return 0
  const loyal = (bondOf(r, him) ?? 0) >= R.bondTrust ? R.resistLoyal : 0
  return R.resistBase + Math.max(0, him.uiri - 5) * R.resistPerUiri + loyal + (isRuler(r, hero) ? R.resistRuler : 0)
    + (hasTrait(him, 'steadfast') ? R.resistSteadfast : 0)
}

/** 한 계절에 깎는 벽의 평균 — 회유하는 이의 매력·매혹 (없으면 매력 3) */
export function persuadeDropOf(r: Realm, by: string | null): number {
  const R = P.realm
  const b = by !== null ? r.heroes[by] : undefined
  const d = b !== undefined ? deokOf(b) : 3
  return Math.max(0.2, R.persuadeDrop * (1 + (d - 5) * R.persuadeDropPerDeok) * (hasTrait(b, 'charm') ? R.persuadeCharm : 1))
}

/** 벽이 무너진 뒤 계절마다 넘어올 확률 */
export function recruitChance(r: Realm, hero: string, by: string | null): number {
  const R = P.realm
  const b = by !== null ? r.heroes[by] : undefined
  const him = r.heroes[hero]
  if (him === undefined) return 0
  const p = R.recruitBase + ((b !== undefined ? deokOf(b) : 3) - him.uiri) * R.recruitPer + (hasTrait(b, 'charm') ? R.recruitCharm : 0)
    + (hasTrait(him, 'traitor') ? R.recruitTraitor : 0) - (hasTrait(him, 'steadfast') ? R.recruitSteadfast : 0)
  return Math.min(R.recruitMax, Math.max(R.recruitMin, p))
}

/**
 * 회유에 드는 계절의 어림 — 벽을 깎는 계절 + 넘어올 때까지 기다리는 계절의 평균 (AI 의 곡식 셈 · 화면의 "몇 계절쯤").
 * 정해진 값이 아니다 — 굴림이라 더 걸리기도 덜 걸리기도 한다
 */
export function persuadeSeasons(r: Realm, hero: string, by: string | null): number {
  const resist = r.heroes[hero]?.persuade?.resist ?? resistOf(r, hero)
  return Math.max(1, Math.ceil(Math.max(0, resist) / persuadeDropOf(r, by)) + Math.round(1 / Math.max(0.01, recruitChance(r, hero, by))))
}

/**
 * 사로잡힌 장수가 풀려난다 — `captor` 가 잡아 둔 `of` 나라 장수들이 제 나라 도읍으로 (화친·동맹을 맺을 때 · 잡아 둔 나라의 도읍이 떨어질 때).
 * (형 10-23: "주몽을 뺏겨 버렸네… 주몽 없이 고구려를 어떻게 끌지" — 예전엔 돌아오는 길이 없었다)
 */
export function releaseCaptives(r: Realm, captor: string, of: string, why: 'peace' | 'take', lines: ReportLine[]): void {
  for (const h of byId(Object.values(r.heroes))) {
    if (h.status !== 'captive' || h.captor !== captor || h.faction !== of) continue
    h.status = 'free'
    h.captor = null
    h.post = null
    delete h.persuade
    h.at = homeOf(r, of)
    lines.push({ kind: 'freed', hero: h.id, faction: of, from: captor, why })
  }
}

function startPersuade(r: Realm, o: Extract<Order, { kind: 'persuade' }>): void {
  const h = r.heroes[o.hero]
  if (h === undefined || h.status !== 'captive' || h.captor === null) return
  if (isRuler(r, h.id)) return // 군주는 꺾이지 않는다 — 회유를 받지 않는다
  const by = o.by !== null ? r.heroes[o.by] : undefined
  if (o.by !== null && (by === undefined || by.status !== 'free' || by.faction !== h.captor)) return
  const left = persuadeSeasons(r, h.id, o.by)
  // 회유하는 이를 바꿔도 깎인 벽은 남는다
  h.persuade = h.persuade === undefined ? { by: o.by, left, resist: resistOf(r, h.id), tries: 0 } : { ...h.persuade, by: o.by }
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

/**
 * 한 장수 한 계절 한 가지 일 (형 10-23: "원정 보냈는데 조공 요구에 협보를 보낼 수도 있잖아 · 장수 하나가 여러 가지 일을 전부 할 수 있게 … 논리에 맞지 않아").
 * 장수를 쓰는 명령 — 맡기기(고을)·이끌기·원정·회유(설득하는 이)·사신 동행·자객·정찰. 같은 장수의 두 번째 일은 버린다(먼저 온 것이 이긴다).
 * 원정 중이거나 자리를 비운(멀리 가는 길) 장수의 일도 버린다. 화면은 같은 규칙으로 고를 거리에서 미리 막는다 (app.ts heroBusy).
 */
export function heroJobOf(o: Order): string | null {
  switch (o.kind) {
    case 'assign': return o.node !== null ? o.hero : null
    case 'lead': case 'expedition': return o.hero
    case 'persuade': return o.by
    case 'envoy': return o.hero ?? null
    case 'plot': return o.agent ?? null
    case 'scout': return o.hero
    default: return null
  }
}
export function oneJobPerHero(r: Realm, orders: readonly Order[]): Order[] {
  const seen = new Set<string>()
  return orders.filter((o) => {
    const id = heroJobOf(o)
    if (id === null) return true
    const h = r.heroes[id]
    if (h === undefined) return true
    const away = (r.expeditions ?? []).some((x) => x.hero === id) || (h.awayUntil !== undefined && h.awayUntil >= r.season)
    if (away || seen.has(id)) return false
    seen.add(id)
    return true
  })
}

/** 1 — 장수 명령. 규칙에 안 맞으면 아무 일도 없다 */
export function applyHeroOrders(r: Realm, orders: readonly Order[], lines: ReportLine[]): void {
  // 들이기를 먼저 — 같은 계절에 들인 떠돌이와 혼인·맡기기를 해도 순서 때문에 버려지지 않게 (형 10-23: "혼인시켰는데 다음 계절에 또 혼인할 수 있게")
  for (const o of orders) if (o.kind === 'hire') hire(r, o, lines)
  for (const o of orders) {
    if (o.kind === 'hire') continue
    if (o.kind === 'assign') assignHero(r, o, lines)
    else if (o.kind === 'lead') leadArmy(r, o)
    else if (o.kind === 'persuade') startPersuade(r, o)
    else if (o.kind === 'wed') wed(r, o, lines)
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
export function homeOf(r: Realm, faction: string): string | null {
  const cap = r.factions[faction]?.capital
  if (cap !== undefined && r.nodes[cap]?.owner === faction) return cap
  // 도읍을 잃고 피한 조정이 있는 곳
  const seat = r.factions[faction]?.exile?.seat
  if (seat !== undefined && r.nodes[seat]?.owner === faction) return seat
  return byId(Object.values(r.nodes)).find((n) => n.owner === faction && n.kind !== 'sodo')?.id ?? null
}

/**
 * 이끌던 군대가 흩어지거나 해산한 장수는 갈 곳이 없다 — 그 나라 도읍(없으면 아무 제 고을)에 혼자 머문다.
 * 사로잡히거나 죽은 장수는 자리가 없다.
 */
function placeOrphans(r: Realm): void {
  const leading = ledHeroes(r)
  for (const h of byId(Object.values(r.heroes))) {
    if (h.status !== 'free') {
      h.at = null
      h.post = null
      continue
    }
    // 원정 간 장수는 판에 없다 (expedition.ts)
    if (h.at === null && !leading.has(h.id) && !(h.awayUntil !== undefined && h.awayUntil >= r.season)) h.at = homeOf(r, h.faction)
  }
}

/** 군대를 이끄는 장수들 — 군대를 하나하나 다시 훑지 않게 한 번에 (쉰 나라 판에서 장수×군대가 크다) */
function ledHeroes(r: Realm): Set<string> {
  const out = new Set<string>()
  for (const a of Object.values(r.armies)) if (a.hero !== null) out.add(a.hero)
  return out
}

/**
 * 고을을 잃었다 — 거기 혼자 머물던 장수의 운명은 능력치로 갈린다 (형: "수성에서 지면 장수가 무조건 사로잡혀?"):
 *   지키다 쓰러진다(무예가 낮을수록) · 이웃 제 고을로 물러난다(가다 붙잡히기도 — 무예·지략이 높으면 덜) ·
 *   물러날 이웃이 없으면 적의 눈을 피해 도읍으로 빠져나가거나(무예·지략 · 겁 많으면 먼저 달아난다) 그 고을을 쥔 나라에 사로잡힌다.
 * 군주가 도읍에서 사로잡히면 군주의 효과도 끝난다. 행군이 끝난 뒤(3·4·5) 부른다.
 */
export function sweepHeroes(r: Realm, lines: ReportLine[]): void {
  placeOrphans(r)
  const leading = ledHeroes(r)
  for (const h of byId(Object.values(r.heroes))) {
    if (h.status !== 'free' || h.at === null || leading.has(h.id)) continue
    const node = r.nodes[h.at]
    if (node === undefined || node.owner === h.faction) continue
    h.post = null
    const R = P.realm
    const lost = h.at
    const safe = neighborsOf(r, h.at).find((n) => r.nodes[n]?.owner === h.faction && r.nodes[n]?.kind !== 'sodo') ?? null
    if (node.owner === null) {
      h.at = homeOf(r, h.faction)
      continue
    }
    const wit = escapeOf(h) + R.heroFallPerRyak * (h.ryak - 5) + (hasTrait(h, 'coward') ? R.heroFallCoward : 0)
    const roll1 = roll(r.seed, r.season, `fall:${h.id}:${lost}`)
    const pDie = hasTrait(h, 'coward') ? 0 : Math.max(0, R.heroFallDeath - escapeOf(h))
    if (roll1 < pDie) {
      h.status = 'dead'
      h.at = null
      lines.push({ kind: 'heroMoved', hero: h.id, faction: h.faction, to: null, captor: null, fate: 'fell' })
      continue
    }
    const roll2 = roll(r.seed, r.season, `flee:${h.id}:${lost}`)
    const home = homeOf(r, h.faction)
    if (safe !== null && roll2 >= Math.max(0, R.heroFallCaught - wit)) {
      h.at = safe
      lines.push({ kind: 'heroMoved', hero: h.id, faction: h.faction, to: safe, captor: null })
    } else if (safe === null && home !== null && roll2 < Math.min(0.95, R.heroFallSlip + wit)) {
      h.at = home
      lines.push({ kind: 'heroMoved', hero: h.id, faction: h.faction, to: home, captor: null, fate: 'slipped' })
    } else {
      h.status = 'captive'
      h.captor = node.owner
      h.at = null
      lines.push({ kind: 'heroMoved', hero: h.id, faction: h.faction, to: safe, captor: node.owner, ...(safe !== null ? { fate: 'caught' as const } : {}) })
    }
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
    const pz = h.persuade
    if (pz.resist === undefined) {
      // 옛 판 — 남은 계절을 센다
      pz.left -= 1
      if (pz.left > 0) continue
    } else if (pz.resist > 0) {
      // 벽을 깎는다 — 매력만큼, 흔들림 있게
      const sway = 1 + (roll(r.seed, r.season, `woo-drop:${h.id}`) * 2 - 1) * R.persuadeSway
      pz.resist = Math.max(0, pz.resist - persuadeDropOf(r, pz.by) * sway)
      pz.left = persuadeSeasons(r, h.id, pz.by)
      if (pz.resist > 0) continue
      lines.push({ kind: 'persuade', hero: h.id, faction: h.captor, step: 'waver' })
      continue // 무너진 계절엔 아직 — 다음 계절부터 굴린다
    } else {
      pz.tries = (pz.tries ?? 0) + 1
      if (roll(r.seed, r.season, `woo-try:${h.id}`) >= recruitChance(r, h.id, pz.by)) {
        lines.push({ kind: 'persuade', hero: h.id, faction: h.captor, step: 'refuse' })
        continue
      }
    }
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
  // 혼인의 열매 — 때가 된 아이가 나선다
  stepBirths(r, lines)
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
  // 옛 판의 장수는 특성 줄이 없다 (형의 9년 가을 막힘 — "reading 'length'") — 없으면 빈 줄로 친다
  const traits = h.traits ?? []
  if (now >= 100 && h.awoken === undefined && traits.length < 3) {
    // 가장 많이 자란 능력치 — 같으면 GROW 순서, 하나도 안 자랐으면 가장 높은 능력치
    const by = (f: (s: GrowStat) => number): GrowStat => GROW.reduce((a, s) => (f(s) > f(a) ? s : a), GROW[0]!)
    const grownAny = GROW.some((s) => (h.grown?.[s] ?? 0) > 0)
    const stat = grownAny ? by((s) => h.grown?.[s] ?? 0) : by((s) => h[s])
    const t = AWAKEN[stat].find((x) => !traits.includes(x))
    if (t !== undefined) {
      ;(h as { traits: readonly string[] }).traits = [...traits, t]
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

// ───────── 혈통 — 혼인과 자식 (SYSTEMS §5-10 · 슬롯 ⑨ · 팰 교배)
//
// 우리 장수 둘(남녀 · 한 사람은 한 번)을 혼인시킨다 → wedSeasons 뒤 자식 장수가 나선다 (판 안에서 몇은 자라게 줄였다 — 판타지).
// 물려받기: 부모 특성 하나하나가 wedTraitPass 로 내려온다 (셋까지) · wedSurprise 로 부모 누구에게도 없던 한 등급 위 특성이 터진다.
// 능력치는 부모 평균 ± wedSpread. 칭호는 부모 둘 중 하나의 것.

/**
 * 신혼 — 혼인한 뒤 wedHoney 계절. 부부는 무엇이든 할 수 있지만, 그동안 **떨어져 지낸 계절마다 아이가 한 계절씩 늦어진다**
 * (형 10-23: "결혼한 동안 아무것도 못 하게 하는 게 맞나? … 활동은 할 수 있잖아. 근데 패널티는 있어야 할 것 같은데"). 남은 계절 수 (0 이면 신혼이 아니다)
 */
export function honeyLeft(r: Realm, hero: string): number {
  const v = (r.births ?? []).find((x) => x.a === hero || x.b === hero)
  if (v === undefined) return 0
  const wedAt = v.wed ?? v.due - P.realm.wedSeasons
  return Math.max(0, wedAt + P.realm.wedHoney - r.season + 1)
}

/** 부부가 함께 있나 — 같은 고을에 둘 다 머문다 (원정·길 위의 군대·사로잡힘이면 떨어진 것) */
export function together(r: Realm, a: string, b: string): boolean {
  const x = r.heroes[a]
  const y = r.heroes[b]
  if (x === undefined || y === undefined || x.status !== 'free' || y.status !== 'free' || x.at === null || y.at === null) return false
  const away = (id: string): boolean => Object.values(r.armies).some((m) => m.hero === id && m.march !== null)
  return x.at === y.at && !away(a) && !away(b)
}

/** 혼인할 수 있나 — 같은 나라 · 자유로운 몸 · 남녀 · 둘 다 짝 없음 */
export function canWed(r: Realm, faction: string, a: string, b: string): boolean {
  const x = r.heroes[a]
  const y = r.heroes[b]
  if (x === undefined || y === undefined || a === b) return false
  if (x.faction !== faction || y.faction !== faction || x.status !== 'free' || y.status !== 'free') return false
  if (x.look === y.look || x.spouse !== undefined || y.spouse !== undefined) return false
  return !(r.births ?? []).some((v) => v.a === a || v.b === a || v.a === b || v.b === b)
}

function wed(r: Realm, o: Extract<Order, { kind: 'wed' }>, lines: ReportLine[]): void {
  if (!canWed(r, o.faction, o.a, o.b)) return
  const st = (r.stock[o.faction] ??= { grain: 0, iron: 0 })
  if (st.grain < P.realm.wedGrain) return
  st.grain -= P.realm.wedGrain
  const [a, b] = o.a < o.b ? [o.a, o.b] : [o.b, o.a]
  r.heroes[a]!.spouse = b
  r.heroes[b]!.spouse = a
  const due = r.season + P.realm.wedSeasons
  ;(r.births ??= []).push({ a, b, faction: o.faction, due, wed: r.season })
  lines.push({ kind: 'wed', faction: o.faction, a, b, due })
}

const GRADE_UP: Readonly<Record<TraitGrade, TraitGrade>> = { common: 'good', good: 'rare', rare: 'precious', precious: 'precious', legend: 'legend' }
const GRADE_RANK: Readonly<Record<TraitGrade, number>> = { common: 0, good: 1, rare: 2, precious: 3, legend: 4 }

/** 자식이 물려받을 수 있는 것 — 화면이 혼인 전에 다 보인다 (정보의 계약) */
export function inheritOf(r: Realm, a: string, b: string): { traits: string[]; surpriseGrade: TraitGrade } {
  const pa = r.heroes[a]?.traits ?? []
  const pb = r.heroes[b]?.traits ?? []
  const traits = [...new Set([...pa, ...pb])].filter((t) => TRAIT[t] !== undefined).sort()
  let best: TraitGrade = 'common'
  for (const t of traits) {
    const g = TRAIT[t]!.grade
    if (TRAIT[t]!.bad !== true && GRADE_RANK[g] > GRADE_RANK[best]) best = g
  }
  return { traits, surpriseGrade: GRADE_UP[best] }
}

/** 아이 이름 — 우리말 이름 (실존 인물은 쓰지 않는다 · BUILD §8 Q6). 판에 이미 있는 이름은 건너뛴다 */
const KID_NAMES: readonly string[] = [
  '가람', '나래', '다온', '라온', '미르', '보람', '새롬', '슬기', '여름', '은솔', '하늬', '한별', '해랑', '도담', '아름',
  '이든', '시루', '단비', '온새', '노을', '들메', '꽃님', '푸름', '여울', '가온', '새벽', '마루', '바람', '초롱', '누리',
]

function makeKid(r: Realm, v: { a: string; b: string; faction: string; due: number }, lines: ReportLine[]): void {
  const R = P.realm
  const pa = r.heroes[v.a]
  const pb = r.heroes[v.b]
  if (pa === undefined || pb === undefined) return
  const id = `kid-${v.a}-${v.b}`
  if (r.heroes[id] !== undefined) return
  const home = homeOf(r, v.faction)
  if (home === null) return // 나라가 없어졌다 — 아이는 떠돌다 사라진다
  const k = (what: string): number => roll(r.seed, r.season, `kid:${id}:${what}`)
  const stat = (x: number, y: number, what: string): number => Math.max(1, Math.min(10, Math.round((x + y) / 2 + (k(what) * 2 - 1) * R.wedSpread)))
  // 물려받기 — 하나하나 반반, 셋까지
  const inh = inheritOf(r, v.a, v.b)
  const traits: string[] = inh.traits.filter((t) => k(`t:${t}`) < R.wedTraitPass).slice(0, 3)
  // 혈통의 대박 — 부모 누구에게도 없던 한 등급 위 특성
  let surprise: string | undefined
  if (traits.length < 3 && k('surprise') < R.wedSurprise) {
    const pool = TRAITS.filter((t) => t.bad !== true && t.grade !== 'legend' && !inh.traits.includes(t.id))
    const at = pool.filter((t) => GRADE_RANK[t.grade] >= GRADE_RANK[inh.surpriseGrade])
    const from = at.length > 0 ? at : pool
    if (from.length > 0) {
      surprise = from[Math.floor(k('surprise-who') * from.length)]!.id
      traits.push(surprise)
    }
  }
  const title = (k('title') < 0.5 ? pa : pb).name.split(' ')
  const used = new Set(Object.values(r.heroes).map((h) => h.name.split(' ').slice(-1)[0]))
  const free = KID_NAMES.filter((n) => !used.has(n))
  const given = free.length > 0 ? free[Math.floor(k('name') * free.length)]! : KID_NAMES[Math.floor(k('name') * KID_NAMES.length)]!
  const name = title.length > 1 ? `${title[0]} ${given}` : given
  r.heroes[id] = {
    id, name, faction: v.faction, look: k('look') < 0.5 ? 'g' : 'w',
    mu: stat(pa.mu, pb.mu, 'mu'), tong: stat(pa.tong, pb.tong, 'tong'), ryak: stat(pa.ryak, pb.ryak, 'ryak'),
    chi: stat(pa.chi, pb.chi, 'chi'), deok: stat(pa.deok, pb.deok, 'deok'), uiri: stat(pa.uiri, pb.uiri, 'uiri'),
    traits, status: 'free', captor: null, at: home, post: null, bond: R.wedBond, parents: [v.a, v.b],
  }
  lines.push({ kind: 'birth', faction: v.faction, hero: id, a: v.a, b: v.b, ...(surprise !== undefined ? { surprise } : {}) })
}

/** 때가 된 혼인의 열매 — 계절마다 (stepHeroes) */
function stepBirths(r: Realm, lines: ReportLine[]): void {
  if (r.births === undefined || r.births.length === 0) return
  // 신혼에 떨어져 지냈으면 아이가 한 계절 늦어진다
  for (const v of r.births) {
    if (honeyLeft(r, v.a) > 0 && !together(r, v.a, v.b)) {
      v.due += 1
      v.late = (v.late ?? 0) + 1
    }
  }
  const due = r.births.filter((v) => v.due <= r.season)
  if (due.length === 0) return
  r.births = r.births.filter((v) => v.due > r.season)
  for (const v of due) makeKid(r, v, lines)
}
