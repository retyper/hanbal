/**
 * 한 계절을 넘긴다 — advance(realm, orders, snipes) → { next, report } (docs/realm/SYSTEMS.md §12 · BUILD §1-2)
 *
 * 순수 함수다: 입력이 같으면 출력이 같고, 안에서 아무것도 밖을 읽지 않는다. 받은 realm 은 건드리지 않고 복사본을 돌려준다.
 * 굴림은 전부 이름이 있다 (core/rng.ts roll) — 판정 하나를 더해도 다른 판정이 밀리지 않는다.
 *
 * 도는 순서 (SYSTEMS §12 의 번호):
 *   1 명령 확정 (나누기·모으기·징병·해산·개척 — 명령 순서대로 → 출정) → 2 정찰 · 사신 · 공작 · 소도 제사 → 3 행군 → 4 기습 → 5 전투·생포
 *   → 7 생산·수확·군량·가호 (economy.ts) → 9 경계 감쇠 · 화친 만료 · 장터 · 동맹의 눈 나누기 · 첩자 → 끝 확인 (이김·짐) · 행군 목격 → 11 계절 +1
 * 6 회유 · 8 이주 · 10 사건은 R3~R4 에서 이 자리에 끼운다 — 번호를 지켜야 순서가 안 바뀐다.
 *
 * 정보의 틈 (R1 에 적어 둔 것) — FLOW §7 #2 로 정했다: **행군은 보인다.** 우리 고을에 맞닿은 길 위의 남의 군대는
 * seenMarches 로 보이고, 보고에 'sighted' 로 남는다. 승률 셈(estimate.ts)은 그 고을로 들어가는 보인 증원을 범위 위쪽에 더한다.
 * 맞닿지 않은 길로 들어온 증원은 여전히 못 본다 — 그건 정찰의 몫이다.
 */
import { roll } from '../core/rng.ts'
import { P } from '../tune/params.ts'
import {
  OPEN_FIELD, ambushChance, ambushSizePenalty, headcount, power, strength, winChance,
  type Equip, type Force, type Kit, type UnitKind,
} from './battle.ts'
import { fightRounds, type FightResult, type Side } from './tactics.ts'
import {
  checkPledges, driftFavor, expireRelations, friendly, holdMarkets, makeAsks, onHostile, relationOf, resolveAnswers, resolveEnvoys,
  shareIntel, stepLent,
} from './diplomacy.ts'
import {
  addGood, applyArm, applyBuild, applyGuard, draftCost, draftIronCost, draftLimit, draftNeeds, militiaMen, onTake, resolveRites, settleCost, settleLimit, stepBuilds, stepEconomy,
  stockOf,
} from './economy.ts'
import { blockedWhy, seasonOf } from './calendar.ts'
import { applyBowUps, refreshSpies, resolvePlots } from './plots.ts'
import { noteTake } from './stance.ts'
import { stepDiscovery, stepSight } from './discovery.ts'
import { PEOPLE_SCALE, migrate } from './migrate.ts'
import { spreadRumors } from './rumor.ts'
import { addMen, giveMen, kitOf, scaleMen, takeMen } from './kit.ts'
import {
  ambushTraitOf, applyHeroOrders, battleGrowth, bondMoraleOf, bowMulOf, commandOf, escapeOf, hasTrait, heroesAtNode, ironhandAt, noteMet, stepHeroes, sweepHeroes,
} from './heroes.ts'
import type {
  Approach, Army, BattleStart, Cmd, EdgeKind, Hero, Order, Ration, Realm, REdge, Report, ReportLine, RNode, SeasonOfYear, SnipeZone, Tactic,
} from './types.ts'

export { blockedWhy, seasonOf }

/** 저격 판 하나의 열쇠 — 고을과 공격 군대. 화면의 저격과 계절 처리가 같은 열쇠로 만난다 */
export function battleKey(node: string, army: string): string {
  return `${node}:${army}`
}

export function otherEnd(ed: REdge, from: string): string | null {
  if (ed.a === from) return ed.b
  if (ed.b === from) return ed.a
  return null
}

export function neighbors(r: Realm, node: string): string[] {
  const out: string[] = []
  for (const ed of Object.values(r.edges)) {
    const o = otherEnd(ed, node)
    if (o !== null) out.push(o)
  }
  return out.sort()
}

/** 길 하나를 지나는 계절 수 */
export function marchSeasons(kind: EdgeKind, season: SeasonOfYear): number {
  const base = kind === 'pass' || kind === 'mudflat' ? P.realm.marchSlow : 1
  return base + (season === 'summer' ? P.realm.marchSummerExtra : 0)
}

/** 기습 은폐 — 길·고을 꼬리표·계절 (SYSTEMS §1-1 · §1-2 · §3) */
export function conceal(ed: REdge, node: RNode, season: SeasonOfYear): number {
  const R = P.realm
  const winter = season === 'winter'
  let c: number
  switch (ed.kind) {
    case 'field': c = R.concealField; break
    case 'pass': c = R.concealPass; break
    case 'forest': c = R.concealForest; break
    case 'reeds': c = winter ? R.concealReedsWinter : R.concealReeds; break
    case 'ford': c = R.concealFord; break
    case 'sea': c = R.concealSea; break
    case 'mudflat': c = R.concealMudflat; break
  }
  // 언 강 — 지키는 쪽이 강을 벽으로 믿는다. "겨울 = 기습의 계절"이 숫자로도 참이 되게
  if (winter && (ed.kind === 'ford' || ed.kind === 'reeds')) c += R.ambushWinterIce
  if ((season === 'spring' || season === 'autumn') && node.tags.includes('fog')) c += R.concealFog
  // 길과 때 (형이 고름: "길과 때의 싸움") — 길에 갈대·솔숲·안개가 붙으면 더 숨고, 겨울은 밤이 길다
  if (ed.tags.some((t) => t === 'reeds' || t === 'pines' || t === 'fog')) c += R.concealEdgeTag
  if (winter) c += R.concealWinterNight
  return c
}

/** 은폐의 까닭 열쇠 — 화면이 말로 바꾼다 (prose.CONCEAL_LINE) */
export type ConcealWhy =
  | 'forest' | 'reeds' | 'reedsWinter' | 'field' | 'pass' | 'ford' | 'sea' | 'mudflat'
  | 'edgeTag' | 'fog' | 'ice' | 'winterNight' | 'bigArmy' | 'smallArmy'

/**
 * 이 길로 기습하면 숨기 좋은가 — 지도가 기습 길을 표시한다 (형이 고름: "길과 때의 싸움" — 2026-10-18).
 * `to` 는 들이칠 고을(안개 꼬리표를 본다) — 없으면 두 끝 가운데 숨기 좋은 쪽. `armySize` 를 주면 무리 크기를 넣는다.
 * 경계·략은 넣지 않는다 (상대마다 다르다 — 그건 판세 칩의 몫). 땅과 계절과 무리 크기만.
 */
export function concealOf(r: Realm, edgeId: string, armySize?: number, to?: string): { tier: 'good' | 'fair' | 'poor'; value: number; why: ConcealWhy[] } {
  const R = P.realm
  const ed = r.edges[edgeId]
  if (ed === undefined) return { tier: 'poor', value: 0, why: [] }
  const season = seasonOf(r.season)
  const ends = to !== undefined ? [to] : [ed.a, ed.b]
  const nodes = ends.map((id) => r.nodes[id]).filter((n): n is RNode => n !== undefined)
  const best = nodes.map((n) => ({ n, c: conceal(ed, n, season) })).sort((x, y) => y.c - x.c)[0]
  let value = best?.c ?? 0
  const why: ConcealWhy[] = []
  const winter = season === 'winter'
  why.push(ed.kind === 'reeds' && winter ? 'reedsWinter' : ed.kind)
  if (ed.tags.some((t) => t === 'reeds' || t === 'pines' || t === 'fog')) why.push('edgeTag')
  if (best !== undefined && (season === 'spring' || season === 'autumn') && best.n.tags.includes('fog')) why.push('fog')
  if (winter && (ed.kind === 'ford' || ed.kind === 'reeds')) why.push('ice')
  if (winter) why.push('winterNight')
  if (armySize !== undefined) {
    const pen = ambushSizePenalty(armySize)
    value -= pen
    if (pen > 0) why.push('bigArmy')
    else if (armySize > 0) why.push('smallArmy')
  }
  const tier = value >= R.concealGood ? 'good' : value >= R.concealFair ? 'fair' : 'poor'
  return { tier, value, why }
}

/** 방어측 지형·성 배수 T (SYSTEMS §4-2 · §1-2) — 겹치면 곱한다 */
export function fortMul(node: RNode, season: SeasonOfYear): number {
  const R = P.realm
  let t = 1
  if (node.kind === 'fort') t *= R.fortSanseong
  if (node.tags.includes('palisade')) t *= R.fortPalisade
  if (node.tags.includes('high')) t *= R.fortHigh
  if (node.tags.includes('moat') && season !== 'winter') t *= R.fortMoat
  return t
}

function heroOf(r: Realm, a: Army) {
  if (a.hero === null) return null
  const h = r.heroes[a.hero]
  // 다친 장수(암살이 먹혔다)는 군대를 이끌지 못한다 — 그 군대는 장수 없는 군대로 싸운다
  return h !== undefined && h.status === 'free' && (h.woundedUntil ?? -1) < r.season ? h : null
}

export function forceOf(r: Realm, a: Army): Force {
  const h = heroOf(r, a)
  return { mix: a.mix, kit: kitOf(a), equip: a.equip, mu: commandOf(h), bowMul: bowMulOf(h), morale: a.morale + bondMoraleOf(r, h) }
}

/** 여러 군대를 한 판정 입력으로 — 병력과 병종마다 무장은 더하고, 지휘는 가장 센 장수의 것 */
function mergeForces(r: Realm, armies: readonly Army[]): Force {
  const mix: Partial<Record<UnitKind, number>> = {}
  const kit: Kit = {}
  let biggest: Army | null = null
  let mu = 1
  let bowMul = 1
  let moraleSum = 0
  let n = 0
  for (const a of armies) {
    const c = headcount(forceOf(r, a))
    for (const [k, v] of Object.entries(a.mix) as Array<[UnitKind, number]>) mix[k] = (mix[k] ?? 0) + v
    for (const [k, t] of Object.entries(kitOf(a)) as Array<[UnitKind, Partial<Record<Equip, number>>]>) {
      const into = (kit[k] ??= {})
      for (const [e, m] of Object.entries(t) as Array<[Equip, number]>) into[e] = (into[e] ?? 0) + m
    }
    if (biggest === null || c > headcount(forceOf(r, biggest))) biggest = a
    mu = Math.max(mu, commandOf(heroOf(r, a)))
    bowMul = Math.max(bowMul, bowMulOf(heroOf(r, a)))
    moraleSum += (a.morale + bondMoraleOf(r, heroOf(r, a))) * c // 믿는 장수의 덤 (HEROES §6)
    n += c
  }
  return { mix, kit, equip: biggest?.equip ?? 'stone', mu, bowMul, morale: n > 0 ? moraleSum / n : 1 }
}

/** 고을에 머무는(행군 중이 아닌) 군대 — id 순서로 (결정론) */
export function armiesAt(r: Realm, node: string): Army[] {
  return Object.values(r.armies)
    .filter((a) => a.at === node && a.march === null)
    .sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0))
}

/**
 * 장정 (SYSTEMS §4-6 · FLOW §2) — 남의 땅인 고을은 군대가 없어도 그 고을 사람들이 지킨다. 가호에 비례한다 (economy.militiaMen).
 * 판정에만 끼는 군대 꼴이다 — r.armies 에 들지 않고, 손실·퇴각·생포를 받지 않는다. 지면 흩어졌다 다음 계절에 다시 선다.
 */
export function militiaOf(r: Realm, node: string): Army | null {
  const n = r.nodes[node]
  const men = militiaMen(r, node)
  if (n === undefined || n.owner === null || men <= 0) return null
  return { id: `~militia:${node}`, faction: n.owner, hero: null, mix: { spear: men }, equip: 'bronze', morale: 1, at: node, march: null }
}

/** 동맹의 땅은 지나간다 (FLOW §4) — 그 고을의 주인과 머무는 군대가 전부 제 편이거나 동맹이면 싸움이 아니다 */
function allied(r: Realm, a: string, b: string | null): boolean {
  return b !== null && (a === b || relationOf(r, a, b).state === 'ally')
}

/** 이 나라가 그 고을에 닿으면 싸움이 나는가 — 남의 땅이거나(장정) 남의 군대가 머문다. 소도·동맹의 땅은 아니다 */
function contested(r: Realm, node: string, faction: string): boolean {
  const n = r.nodes[node]!
  if (n.kind === 'sodo') return false
  if (n.owner !== null && !allied(r, faction, n.owner) && militiaOf(r, node) !== null) return true
  return armiesAt(r, node).some((d) => !allied(r, faction, d.faction))
}

/** 행군은 보인다 (FLOW §7 #2) — 이 나라 고을에 맞닿은 길 위의 남의 군대. id 순서 */
export function seenMarches(r: Realm, faction: string): Army[] {
  const mine = (id: string): boolean => r.nodes[id]?.owner === faction
  return Object.values(r.armies)
    .filter((a) => a.faction !== faction && a.march !== null && (mine(a.march.from) || mine(a.march.to)))
    .sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0))
}

/** 정보가 다루는 그 고을의 군세 — 머무는 군대와 장정 strength 의 합 (intel.ts 의 F) */
export function nodeStrength(r: Realm, node: string, owner: string | null): number {
  let f = 0
  for (const a of armiesAt(r, node)) if (a.faction === owner) f += strength(forceOf(r, a))
  const m = militiaOf(r, node)
  if (m !== null && m.faction === owner) f += strength(forceOf(r, m))
  return f
}

/**
 * 정찰·첩자가 보는 병종의 몫 (형: "정찰하면 '궁수가 많다' 같은 구성이 보이게") — 그 고을 주인의 머무는 군대와 장정(창병).
 * 몫을 seenMixStep 눈금으로 둥글린다 (사람 수는 안 보인다). 아무도 없으면 빈 것 — intel force 에 펼쳐 넣는다.
 */
export function seenShares(r: Realm, node: string, owner: string | null): { mix?: Partial<Record<UnitKind, number>> } {
  const sum: Partial<Record<UnitKind, number>> = {}
  for (const a of armiesAt(r, node)) {
    if (a.faction !== owner) continue
    for (const [k, v] of Object.entries(a.mix) as Array<[UnitKind, number]>) sum[k] = (sum[k] ?? 0) + v
  }
  const m = militiaOf(r, node)
  if (m !== null && m.faction === owner) sum.spear = (sum.spear ?? 0) + (m.mix.spear ?? 0)
  const n = Object.values(sum).reduce((s, v) => s + (v ?? 0), 0)
  if (n <= 0) return {}
  const step = P.realm.seenMixStep
  const mix: Partial<Record<UnitKind, number>> = {}
  for (const [k, v] of Object.entries(sum) as Array<[UnitKind, number]>) {
    const s = Math.round(v / n / step) * step
    if (s > 0) mix[k] = Math.round(s * 100) / 100
  }
  return { mix }
}

function bestRyak(r: Realm, armies: readonly Army[]): number {
  let best = 1
  for (const a of armies) best = Math.max(best, heroOf(r, a)?.ryak ?? 1)
  return best
}

/**
 * 물러날 곳 — 먼저 `prefer`(떠나온 고을), 아니면 이웃 가운데 제 나라 땅. 어느 쪽이든 **적이 머물지 않는** 곳이어야 한다.
 * 떠나온 사이에 남이 쥔 고을로 돌아가면 한 고을에 두 나라가 함께 머문다 (시험이 잡았다). 없으면 null — 흩어진다.
 */
function retreatTo(r: Realm, a: Army, from: string, prefer: string | null): string | null {
  const safe = (n: string): boolean =>
    r.nodes[n]?.owner === a.faction && !armiesAt(r, n).some((x) => x.faction !== a.faction)
  if (prefer !== null && safe(prefer)) return prefer
  return neighbors(r, from).find(safe) ?? null
}

/**
 * 남의 나라를 쳤다 — 전쟁이 된다 (diplomacy.onHostile). 플레이어가 친 나라에는 초반 유예도 끝난다 (ai.ts spared)
 */
function provoke(r: Realm, attacker: string, victim: string | null, lines: ReportLine[]): void {
  onHostile(r, attacker, victim, lines)
  if (victim === null || victim === attacker || r.factions[attacker]?.mind !== 'player') return
  const p = (r.provoked ??= [])
  if (!p.includes(victim)) {
    p.push(victim)
    p.sort()
  }
}

function scaleMix(a: Army, keep: number): void {
  scaleMen(a, keep) // 병종마다 · 무장 단계마다 같은 비율로 (kit.ts)
}

function byId<T extends { id: string }>(xs: Iterable<T>): T[] {
  return [...xs].sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0))
}

/**
 * 같은 계절에 같은 고을에 닿는 한 나라의 군대들 — 한 무리 (SYSTEMS §4-5 협공).
 * 무리 순서는 앞선 군대 id 순서, 무리 안도 id 순서다 (결정론).
 */
function arrivalGroups(armies: readonly Army[]): Army[][] {
  const groups: Army[][] = []
  for (const a of byId(armies)) {
    const g = groups.find((x) => x[0]!.faction === a.faction && x[0]!.march!.to === a.march!.to)
    if (g !== undefined) g.push(a)
    else groups.push([a])
  }
  return groups
}

/**
 * 미리 보기 — 이번 계절에 열리는 싸움 (SYSTEMS §12 가). 상태를 바꾸지 않는다.
 * 저격 화면은 여기서 나온 열쇠로 판을 열고, 결과를 advance 의 snipes 에 넣는다. 협공은 판 하나다.
 */
export function preview(realm: Realm, orders: readonly Order[]): string[] {
  const r = plainClone(realm)
  applyOrders(r, orders, [])
  const keys: string[] = []
  const arriving = Object.values(r.armies).filter((a) => a.march !== null && a.march.left === 1)
  for (const g of arrivalGroups(arriving)) {
    const lead = g[0]!
    const to = lead.march!.to
    if (contested(r, to, lead.faction)) keys.push(battleKey(to, lead.id))
  }
  return keys
}

/** 새 군대의 이름 — 나누기 명령이 싣는다. 같은 계절에 여럿 나누면 계획판(planned)에 대고 다시 부른다 */
export function newArmyId(r: Realm, faction: string): string {
  for (let i = 1; ; i++) {
    const id = `a-${faction}-${r.season}-${i}`
    if (r.armies[id] === undefined) return id
  }
}

/** 나누기 (SYSTEMS §4-5) — 규칙에 안 맞으면 아무 일도 없다 */
function splitArmy(r: Realm, o: Extract<Order, { kind: 'split' }>, lines: ReportLine[]): void {
  const R = P.realm
  const a = r.armies[o.army]
  if (a === undefined || a.march !== null || r.armies[o.id] !== undefined) return
  if (Object.values(r.armies).filter((x) => x.faction === a.faction).length >= R.armyMax) return
  let taken = 0
  for (const [k, t] of Object.entries(o.take) as Array<[UnitKind, number]>) {
    if (!Number.isInteger(t) || t < 0 || t > (a.mix[k] ?? 0)) return
    taken += t
  }
  const total = headcount(forceOf(r, a))
  if (taken < R.splitMin || total - taken < R.splitMin) return
  // 떼어 낸 무리는 병종마다 무장 단계를 같은 비율로 가져간다 (kit.takeMen)
  const part = takeMen(a, o.take)
  const hero = o.hero ? a.hero : null
  if (o.hero) a.hero = null
  const b: Army = { id: o.id, faction: a.faction, hero, mix: {}, equip: a.equip, morale: a.morale, at: a.at, march: null }
  giveMen(b, part)
  r.armies[o.id] = b
  lines.push({ kind: 'split', army: a.id, id: o.id })
}

/** 모으기 — 장수는 받는 쪽, 없으면 들어오는 쪽. 둘 다 장수가 있으면 안 모은다 (부장 자리는 R3) */
function mergeArmy(r: Realm, o: Extract<Order, { kind: 'merge' }>, lines: ReportLine[]): void {
  const a = r.armies[o.army]
  const b = r.armies[o.into]
  if (a === undefined || b === undefined || a.id === b.id) return
  if (a.faction !== b.faction || a.at !== b.at || a.march !== null || b.march !== null) return
  if (heroOf(r, a) !== null && heroOf(r, b) !== null) return
  const na = headcount(forceOf(r, a))
  const nb = headcount(forceOf(r, b))
  giveMen(b, { mix: a.mix, kit: kitOf(a) }) // 병종마다 무장째 더한다
  if (na + nb > 0) b.morale = (a.morale * na + b.morale * nb) / (na + nb)
  if (heroOf(r, b) === null) b.hero = a.hero
  delete r.armies[a.id]
  lines.push({ kind: 'merge', army: a.id, into: b.id })
}

/**
 * 먼저 해 볼 판의 사본 — 통째로 structuredClone 하면 영남 판에서 AI 셈의 절반이 복사에 든다 (2026-10-19 프로필: 46%).
 * applyArmyOrders 는 길·관계 같은 칸(PLAN_SHARED)을 건드리지 않고, 정보(intel)는 칸을 **새로 넣기만** 한다(revealAround 의 ??=).
 * 그래서 그 칸들은 같이 쓰고 정보는 두 겹만 얕게 베낀다 — 나머지는 깊이 베낀다. 옛 눈금의 판(migrate 가 정보를 고쳐 쓴다)은 통째로.
 * 결과는 통째 복사와 같다 (시험: 같은 판이면 같은 명령 · 판 넘기기 결정론).
 */
/** applyArmyOrders 가 손대지 않는 칸 — 사본도 같은 것을 같이 본다 (관계·만난 장수·청·첩자·도발·제사·자객의 활) */
const PLAN_SHARED = new Set(['edges', 'relations', 'met', 'asks', 'spies', 'provoked', 'blessed', 'assassinBow'])

/**
 * 평범한 객체·배열의 깊은 사본 — 판은 JSON 같은 평범한 값뿐이라(types.ts) structuredClone 과 같은 것이 나온다.
 * 작은 객체가 많을 때 structuredClone 보다 몇 배 빠르다 (쉰 나라 판에서 사본 값이 AI 셈의 2할이었다).
 */
function plainClone<T>(v: T): T {
  if (typeof v !== 'object' || v === null) return v
  if (Array.isArray(v)) return v.map(plainClone) as T
  const out: Record<string, unknown> = {}
  for (const k in v) out[k] = plainClone((v as Record<string, unknown>)[k])
  return out as T
}

function cloneForPlan(realm: Realm): Realm {
  if ((realm.scale ?? 1) !== PEOPLE_SCALE) return structuredClone(realm)
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(realm)) {
    if (PLAN_SHARED.has(k)) out[k] = v
    else if (k === 'intel') {
      const intel: Record<string, unknown> = {}
      for (const [f, m] of Object.entries(v as Realm['intel'])) intel[f] = { ...m }
      out[k] = intel
    } else out[k] = plainClone(v)
  }
  return out as unknown as Realm
}

/**
 * 나누기·모으기·징병·해산만 먼저 해 본 판 — 화면이 "떼어 낸 별동대"·"새로 뽑은 군대"에게 길을 고르게 할 때 쓴다.
 * 받은 realm 은 건드리지 않는다. advance 의 1단계와 같은 함수를 지난다.
 */
export function planned(realm: Realm, orders: readonly Order[]): Realm {
  const r = cloneForPlan(realm)
  migrate(r)
  applyArmyOrders(r, orders, [])
  return r
}

/**
 * 먼저 해 본 판에 명령을 더 얹는다 — **planned() 가 돌려준 제 사본에만** 쓴다 (제자리에서 바꾼다).
 * AI 가 징병→개척→제사→경계를 차례로 정하며 판을 네 번 통째로 베끼던 것을 한 번으로 줄인다.
 * 나누기·모으기·장수 명령이 없는 명령(징병·개척·제사·경계)은 한꺼번에 얹은 것과 결과가 같다 (판 지문으로 확인).
 */
export function extendPlan(p: Realm, orders: readonly Order[]): void {
  if (orders.length > 0) applyArmyOrders(p, orders, [])
}

/** 뽑을 수 있는 병종 — 창병·궁수·방패병, 포구에서는 수군도 (FLOW §2) */
/** 뽑을 수 있는 병종 — 기병은 어디서나 (말이 있어야 한다 — economy.draftLimit), 수군은 포구에서 (배를 지을 나무가 든다) */
export function draftable(node: RNode): readonly UnitKind[] {
  return node.kind === 'port' ? ['spear', 'bow', 'shield', 'horse', 'boat'] : ['spear', 'bow', 'shield', 'horse']
}

/** 징병 (FLOW §2) — 규칙에 안 맞으면 아무 일도 없다. 그 고을에 쉬는 제 군대가 있으면 거기 든다 */
function draftArmy(r: Realm, o: Extract<Order, { kind: 'draft' }>, lines: ReportLine[]): void {
  const node = r.nodes[o.node]
  if (node === undefined || node.owner !== o.faction || r.factions[o.faction] === undefined) return
  if (!Number.isInteger(o.n) || o.n < 1 || o.n > draftLimit(r, o.faction, o.node, o.unit)) return
  if (!draftable(node).includes(o.unit)) return
  // 쇠 들려 징병 — 철을 들이면 **뽑힌 그 사람들만** 한 단계 위 무장을 든다 (철이 모자라면 그냥 뽑는다).
  // 쇠 다루는 장수가 맡은 고을에서는 모두 온 쇠 (heroes.ironhandAt)
  const ic = o.iron === true ? draftIronCost(r, o.faction, o.n, o.unit) : null
  const up = ic !== null && !ironhandAt(r, node.id) && stockOf(r, o.faction).iron >= ic.iron ? ic : null
  const tier: Equip = ironhandAt(r, node.id) ? 'iron' : (up?.to ?? r.factions[o.faction]!.equip)
  let army = armiesAt(r, node.id).find((a) => a.faction === o.faction && a.lent === undefined)
  if (army === undefined) {
    if (Object.values(r.armies).filter((x) => x.faction === o.faction).length >= P.realm.armyMax) return
    const id = newArmyId(r, o.faction)
    army = { id, faction: o.faction, hero: null, mix: {}, equip: tier, morale: 1, at: node.id, march: null }
    r.armies[id] = army
  }
  const had = headcount(forceOf(r, army))
  if (up !== null) stockOf(r, o.faction).iron -= up.iron
  addMen(army, o.unit, o.n, tier)
  army.morale = (army.morale * had + o.n) / (had + o.n) // 새로 든 사람은 사기 1
  node.hh -= o.n
  stockOf(r, o.faction).grain -= draftCost(o.n).grain
  const need = draftNeeds(o.unit, o.n) // 배의 나무 · 기병의 말
  if (need.wood > 0) addGood(r, o.faction, 'wood', -need.wood)
  if (need.horse > 0) addGood(r, o.faction, 'horse', -need.horse)
  lines.push({ kind: 'draft', faction: o.faction, node: node.id, unit: o.unit, n: o.n, army: army.id })
}

/** 해산 — 제 땅에 쉬는 군대를 집으로. 사람은 그 고을 가호로 돌아간다. 장수는 남는다 */
function disbandArmy(r: Realm, o: Extract<Order, { kind: 'disband' }>, lines: ReportLine[]): void {
  const a = r.armies[o.army]
  if (a === undefined || a.march !== null) return
  const node = r.nodes[a.at]
  if (node === undefined || node.owner !== a.faction) return
  const n = headcount(forceOf(r, a))
  node.hh += n
  if (a.hero !== null && r.heroes[a.hero] !== undefined) r.heroes[a.hero]!.at = node.id // 장수는 그 고을에 혼자 남는다
  delete r.armies[a.id]
  lines.push({ kind: 'disband', army: a.id, node: node.id, n })
}

/** 개척 (FLOW §2) — 제 고을 사람을 길로 맞닿은 빈땅으로. 규칙에 안 맞으면 아무 일도 없다 (economy.settleLimit) */
function settleLand(r: Realm, o: Extract<Order, { kind: 'settle' }>, lines: ReportLine[]): void {
  if (r.factions[o.faction] === undefined) return
  if (!Number.isInteger(o.n) || o.n < 1 || o.n > settleLimit(r, o.faction, o.from, o.to)) return
  const from = r.nodes[o.from]!
  const to = r.nodes[o.to]!
  from.hh -= o.n
  to.hh += o.n
  to.owner = o.faction
  stockOf(r, o.faction).grain -= settleCost(o.n).grain
  addGood(r, o.faction, 'wood', -settleCost(o.n).wood)
  revealAround(r, o.faction, o.to)
  lines.push({ kind: 'settle', faction: o.faction, from: o.from, to: o.to, n: o.n })
}

/** 새로 쥔 땅에 서면 그 땅과 길로 맞닿은 이웃의 땅이 보인다 (판을 열 때 제 땅의 이웃을 아는 것과 같다). 군세는 아니다 */
function revealAround(r: Realm, faction: string, node: string): void {
  const known = (r.intel[faction] ??= {})
  known[node] ??= { land: true, force: null, alert: null }
  for (const nb of neighbors(r, node)) known[nb] ??= { land: true, force: null, alert: null }
}

function applyArmyOrders(r: Realm, orders: readonly Order[], lines: ReportLine[]): void {
  for (const o of orders) {
    if (o.kind === 'split') splitArmy(r, o, lines)
    else if (o.kind === 'merge') mergeArmy(r, o, lines)
    else if (o.kind === 'draft') draftArmy(r, o, lines)
    else if (o.kind === 'disband') disbandArmy(r, o, lines)
    else if (o.kind === 'settle') settleLand(r, o, lines)
    else if (o.kind === 'guard') applyGuard(r, o, lines)
    else if (o.kind === 'arm') applyArm(r, o, lines)
    else if (o.kind === 'build') applyBuild(r, o, lines)
  }
  applyHeroOrders(r, orders, lines) // 맡기기·이끌기·회유·들이기 — 나누기·해산 뒤 (떼어 낸 군대를 이끌 수 있게)
}

/** 1 — 명령 확정: 나누기·모으기를 먼저 하고, 출정 명령을 군대에 싣는다. 막힌 길은 보고에 남기고 떠나지 않는다 */
function applyOrders(r: Realm, orders: readonly Order[], lines: ReportLine[]): void {
  const season = seasonOf(r.season)
  applyArmyOrders(r, orders, lines)
  for (const o of orders) {
    if (o.kind !== 'march') continue
    const a = r.armies[o.army]
    const ed = r.edges[o.edge]
    if (a === undefined || ed === undefined || a.march !== null) continue
    const to = otherEnd(ed, a.at)
    if (to === null) continue
    // AI 의 명령은 계절 처음의 판으로 짰다 — 이번 계절 1 에서 화친을 맺은 나라 땅으로는 가지 않는다 (깨는 것은 플레이어만 고른다)
    const owner = r.nodes[to]?.owner ?? null
    if (r.factions[a.faction]?.mind !== 'player' && owner !== null && relationOf(r, a.faction, owner).state === 'truce') continue
    // 진군 방식 — 그 길·고을에 맞지 않으면 대로/밤길로 (옛 명령은 ambush 하나뿐이다)
    const opts = approachOptions(r, ed, to)
    // 옛 명령 · AI 의 기습 — 강 있는 길이면 여울로 건넌다 (갈대에 더 숨는다)
    const want = o.approach ?? (o.ambush ? (opts.includes('ford') ? 'ford' : 'night') : 'road')
    const approach: Approach = opts.includes(want) ? want : o.ambush && opts.includes('night') ? 'night' : 'road'
    let left = marchSeasons(ed.kind, season)
    if (approach === 'ridge') left += P.realm.apRidgeExtra
    // 계절에 막힌 길 (형: "불가능하게 만들지 말고 패널티") — 더 걸리고, 얼거나 떠내려가 사람을 잃는다
    const why = blockedWhy(ed, season)
    if (why !== null) {
      const before = headcount(forceOf(r, a))
      scaleMix(a, 1 - (why === 'winterPass' ? P.realm.hardFrostLoss : P.realm.hardFloodLoss))
      a.morale = Math.max(P.realm.moraleFloor, a.morale - P.realm.hardMorale)
      left += P.realm.hardExtra
      lines.push({ kind: 'blocked', army: a.id, edge: ed.id, why, lost: Math.max(0, before - headcount(forceOf(r, a))) })
    }
    // 군량 — 넉넉히면 곡식을 들여 길 계절 + 남겨 둘 계절을 챙기고, 가볍게면 길 계절만 (닿자마자 바닥이다)
    const ration = rationFor(r, a, o.ration, left)
    if (ration === 'light') {
      a.food = left
    } else {
      stockOf(r, a.faction).grain -= rationCost(r, a, left)
      a.food = left + P.realm.rationReserve
    }
    a.march = { from: a.at, to, edge: ed.id, left, ambush: approach !== 'road', ...(approach !== 'road' && approach !== 'night' ? { approach } : {}), ...(why !== null ? { hard: why } : {}) }
  }
}

/** 이 길로 이 고을을 칠 때 고를 수 있는 진군 방식 — 대로는 늘, 남의 땅이면 밤길, 강이면 여울, 산이면 산기슭, 산성·높은 터면 절벽 */
export function approachOptions(r: Realm, ed: REdge, to: string): Approach[] {
  const node = r.nodes[to]
  const out: Approach[] = ['road']
  if (node === undefined || node.owner === null || node.kind === 'sodo') return out
  out.push('night')
  if (ed.kind === 'ford' || ed.kind === 'reeds' || ed.tags.includes('shallows')) out.push('ford')
  if (ed.kind === 'pass' || ed.kind === 'forest' || ed.tags.includes('pines') || node.kind === 'fort' || node.tags.includes('high')) out.push('ridge')
  if (node.kind === 'fort' || node.tags.includes('high')) out.push('cliff')
  return out
}

/** 행군의 진군 방식 — 옛 판은 ambush 하나뿐이었다 */
export function approachOf(m: { readonly ambush: boolean; readonly approach?: Approach }): Approach {
  return m.approach ?? (m.ambush ? 'night' : 'road')
}

/** 넉넉히 챙기는 군량의 곡식 — 사람 × 계절치 × (길 계절 + 남겨 둘 계절) */
export function rationCost(r: Realm, a: Army, left: number): number {
  const R = P.realm
  return Math.ceil(headcount(forceOf(r, a)) * R.rationPerSoldier * R.rationPack * (left + R.rationReserve))
}

/**
 * 실제로 챙길 군량 — 곡식이 모자라면 가볍게.
 * 고르지 않았으면(AI · 옛 명령) 곡식이 넉넉한 나라만 넉넉히 챙긴다 (aiRationRich 배 — 군량 값에 나라 살림이 마르지 않게)
 */
export function rationFor(r: Realm, a: Army, want: Ration | undefined, left: number): Ration {
  if (want === 'light') return 'light'
  const cost = rationCost(r, a, left)
  const grain = stockOf(r, a.faction).grain
  return grain >= cost * (want === undefined ? P.realm.aiRationRich : 1) ? 'full' : 'light'
}

/** 절벽 타기가 될 확률 — 적을수록 · 무예 높을수록 · 산사람이면 */
export function cliffChance(r: Realm, a: Army): number {
  const R = P.realm
  const h = heroOf(r, a)
  const men = headcount(forceOf(r, a))
  let p = R.apCliffBase - Math.max(0, men - R.apCliffFreeMen) / 100 * R.apCliffPerHundred + R.apCliffPerMu * ((h?.mu ?? 3) - 5)
  if (hasTrait(h, 'mountain')) p += R.apCliffMountain
  return Math.min(R.ambushMax, Math.max(R.ambushMin, p))
}

/** 진군 방식마다 숨는 덤 — 밤길은 바탕 은폐 그대로 */
export function approachConceal(ap: Approach): number {
  return ap === 'ford' ? P.realm.apFordConceal : ap === 'ridge' ? P.realm.apRidgeConceal : 0
}

/** 불을 놓을 수 있는 싸움터 — 갈대·숲·솔숲, 장마철이 아니면 */
export function fireable(ed: REdge | undefined, node: RNode | undefined, season: SeasonOfYear): boolean {
  if (season === 'summer') return false
  if (ed !== undefined && (ed.kind === 'reeds' || ed.kind === 'forest' || ed.tags.includes('reeds') || ed.tags.includes('pines'))) return true
  return node !== undefined && (node.tags.includes('reeds') || node.tags.includes('pines'))
}

const WATER: ReadonlySet<EdgeKind> = new Set(['ford', 'reeds', 'sea', 'mudflat'])
export const isWater = (k: EdgeKind | undefined): boolean => k !== undefined && WATER.has(k)

/** 2 — 정찰: 땅을 열고 군세를 a=0 으로 · 들키면 경계 + (SYSTEMS §2-4) */
function resolveScouts(r: Realm, orders: readonly Order[], lines: ReportLine[]): void {
  const R = P.realm
  for (const o of orders) {
    if (o.kind !== 'scout') continue
    const node = r.nodes[o.node]
    const known = r.intel[o.faction]
    if (node === undefined || known === undefined) continue
    const scout = o.hero !== null ? r.heroes[o.hero] : undefined
    const ourRyak = scout !== undefined && scout.status === 'free' ? scout.ryak : R.scoutRyak
    const theirRyak = bestRyak(r, armiesAt(r, node.id).filter((a) => a.faction !== o.faction))
    const pDetect = Math.min(1, Math.max(0, R.scoutDetectBase + R.scoutDetectPerRyak * (theirRyak - ourRyak)))
    const detected = roll(r.seed, r.season, `scout:${o.faction}:${node.id}`) < pDetect
    const w = r.watch[node.id]!
    if (detected) w.alert = Math.min(R.alertMax, w.alert + R.alertOnDetect)
    known[node.id] = {
      land: true,
      force: { f0: nodeStrength(r, node.id, node.owner), src: 'scout', u: roll(r.seed, r.season, `scout-u:${o.faction}:${node.id}`), season: r.season, ...seenShares(r, node.id, node.owner) },
      alert: { v: w.alert, season: r.season },
    }
    for (const nb of neighbors(r, node.id)) known[nb] ??= { land: true, force: null, alert: null }
    noteMet(r, o.faction, heroesAtNode(r, node.id))
    lines.push({ kind: 'scout', faction: o.faction, node: node.id, detected })
  }
}

/** 협공의 전투력 — 군대마다 제 길의 도하·기습으로 셈해 더하고, 길이 둘 이상이면 ×pincer (SYSTEMS §4-5) */
export function groupPower(
  r: Realm,
  atks: readonly { army: Army; edge: REdge; ambush: 'none' | 'success' | 'caught' }[],
  defF: Force,
  fort: number,
): number {
  const season = seasonOf(r.season)
  let f = 0
  for (const x of atks) {
    const field = { fort, crossing: x.edge.kind === 'ford' && season !== 'winter', ambush: x.ambush, snipeAtk: 1, snipeDef: 1, edge: x.edge.kind }
    f += power(forceOf(r, x.army), defF, field, 'atk')
  }
  return new Set(atks.map((x) => x.edge.id)).size >= 2 ? f * P.realm.pincer : f
}

/**
 * 싸움에 함께 선 장수들 — 싸운 나라들이 서로의 장수를 본다 (heroes.heroSeen). 싸우기 전에 부른다 (지면 군대에서 빠지니까)
 */
function meet(r: Realm, sides: ReadonlyArray<{ readonly hero: string | null; readonly faction?: string }>): void {
  const heroes = sides.map((x) => x.hero).filter((h): h is string => h !== null)
  const factions = new Set(heroes.map((h) => r.heroes[h]?.faction).filter((f): f is string => f !== undefined))
  for (const s of sides) if (s.faction !== undefined) factions.add(s.faction)
  for (const f of [...factions].sort()) noteMet(r, f, heroes)
}

/**
 * 들판에서 마주칠 사이인가 — 다른 나라이고, 동맹·화친이 아니며, 전쟁 중이거나 한쪽이 다른 쪽 땅으로 가고 있다.
 * 중립끼리 그냥 엇갈려 지나가는 길은 싸움이 아니다.
 */
function meetHostile(r: Realm, a: Army, b: Army): boolean {
  if (a.faction === b.faction || allied(r, a.faction, b.faction) || friendly(r, a.faction, b.faction)) return false
  if (relationOf(r, a.faction, b.faction).state === 'war') return true
  return r.nodes[a.march!.to]?.owner === b.faction || r.nodes[b.march!.to]?.owner === a.faction
}

/** 싸움 한쪽의 장수 — 이끄는 군대 가운데 첫 장수 (다친 장수는 못 이끈다) */
function leadHero(r: Realm, armies: readonly Army[]): Hero | null {
  for (const a of armies) {
    const h = heroOf(r, a)
    if (h !== null) return h
  }
  return null
}

/** 군량이 바닥인 채로 싸우나 — 한 군대라도 */
function hungryOf(armies: readonly Army[]): boolean {
  return armies.some((a) => a.food !== undefined && a.food <= 0)
}

/** 이 나라가 그 고을을 이번 계절(또는 지난 계절)에 정찰·첩자로 봤나 — 귀띔이 잘 맞는다 */
function freshSight(r: Realm, faction: string, node: string): boolean {
  const k = r.intel[faction]?.[node]?.force
  return k !== null && k !== undefined && r.season - k.season <= 1
}

/** tactics.Side 를 만든다 */
function sideOf(
  r: Realm, armies: readonly Army[], f: Force, F: number, faction: string,
  o: { water: boolean; edge?: EdgeKind; fire: boolean; flank: boolean; seen: boolean; moraleBonus?: number; captureBonus?: number },
): Side {
  const h = leadHero(r, armies)
  const n = headcount(f)
  const specials: Cmd[] = []
  // 옆치기 — 산기슭으로 돌아 들어왔거나, 들길에서 기병이 넉넉하다
  if (o.flank || (o.edge === 'field' && n > 0 && (f.mix.horse ?? 0) / n >= 0.2)) specials.push('flank')
  if (o.fire) specials.push('fire')
  return {
    F, mix: f.mix, morale: f.morale, hero: h === null ? null : { id: h.id, mu: h.mu, ryak: h.ryak, coward: hasTrait(h, 'coward') },
    hungry: hungryOf(armies), specials, water: o.water, player: r.factions[faction]?.mind === 'player', seen: o.seen,
    ...(o.moraleBonus !== undefined ? { moraleBonus: o.moraleBonus } : {}),
    ...(o.captureBonus !== undefined && o.captureBonus > 0 ? { captureBonus: o.captureBonus } : {}),
  }
}

/** 싸움이 시작될 때의 사람 · 사기 · 장수 — 전장 화면의 막대 */
function startOf(a: Side, d: Side, af: Force, df: Force): BattleStart {
  return {
    men: [headcount(af), headcount(df)],
    morale: [a.morale + (a.moraleBonus ?? 0), d.morale + (d.moraleBonus ?? 0)],
    heroes: [a.hero?.id ?? null, d.hero?.id ?? null],
  }
}

/** 싸움 끝의 사기 — 라운드에서 오간 만큼 (바닥·천장) */
function shiftMorale(armies: readonly Army[], d: number): void {
  const R = P.realm
  for (const x of armies) x.morale = Math.min(R.moraleMax, Math.max(R.moraleFloor, x.morale + d))
}

/**
 * 5 — 장수의 운명 (형: "그냥 싸우다가 운좋게 잡히는게 아니라") — 사로잡기는 라운드의 명령으로만 된다.
 * 일기토에서 진 장수는 쓰러지거나 다친다. 무너진 쪽 장수는 난전에 쓰러질 수 있다 (무예가 높으면 빠져나온다, 겁 많으면 먼저 달아난다).
 */
function battleFates(
  r: Realm, res: FightResult, a: Side, d: Side, atkArmies: readonly Army[], defArmies: readonly Army[], atkFaction: string, defFaction: string, key: string,
): { captured: string | null; killed: string | null } {
  const R = P.realm
  let captured: string | null = null
  let killed: string | null = null
  const out = (id: string): void => {
    for (const x of [...atkArmies, ...defArmies]) if (x.hero === id) x.hero = null
  }
  if (res.captured !== null) {
    const h = r.heroes[(res.captured === 'a' ? a.hero : d.hero)?.id ?? '']
    if (h !== undefined && h.status === 'free') {
      h.status = 'captive'
      h.captor = res.captured === 'a' ? defFaction : atkFaction
      captured = h.id
      out(h.id)
    }
  }
  if (res.duel !== null) {
    const h = r.heroes[(res.duel.loser === 'a' ? a.hero : d.hero)?.id ?? '']
    if (h !== undefined && h.status === 'free') {
      if (res.duel.kill) {
        h.status = 'dead'
        killed = h.id
        out(h.id)
      } else h.woundedUntil = Math.max(h.woundedUntil ?? -1, r.season + 1)
    }
  }
  if (res.broke !== null) {
    const side = res.broke === 'a' ? a : d
    const h = r.heroes[side.hero?.id ?? '']
    if (h !== undefined && h.status === 'free' && killed === null) {
      const armies = res.broke === 'a' ? atkArmies : defArmies
      if (hasTrait(h, 'coward')) {
        // 겁 많음 — 먼저 달아나 안 쓰러지지만, 그 군대 사기가 더 꺾인다 (HEROES §2)
        for (const x of armies) if (x.hero === h.id) x.morale = Math.max(R.moraleFloor, x.morale - R.traitCowardMorale)
      } else {
        const p = R.tacDeathRout * Math.min(1.5, Math.max(0.3, 1 - escapeOf(h)))
        if (roll(r.seed, r.season, `${key}:fall`) < p) {
          h.status = 'dead'
          killed = h.id
          out(h.id)
        }
      }
    }
  }
  return { captured, killed }
}

/**
 * 그 판의 플레이어 명령 — 열쇠가 없으면 '*' (전장 화면의 시험 돌림: 아직 안 본 우리 싸움은 모두 처음에서 멈춘다).
 * 플레이어가 안 낀 판에는 tactics.fightRounds 가 걸지 않는다
 */
export const ANY_BATTLE = '*'
function tacticFor(tactics: Readonly<Record<string, Tactic>>, key: string): Tactic | undefined {
  return tactics[key] ?? tactics[ANY_BATTLE]
}

/** 들판 싸움의 열쇠 — 길과 앞선 군대 */
export function fieldKey(edge: string, army: string): string {
  return `field:${edge}:${army}`
}

/**
 * 3 — 들판 싸움 (형: "군대가 항상 마을에서 싸우나? 야전에서 마주칠수도 있는거 아닌가?" — 2026-10-18).
 * 같은 길을 **마주 보고** 가는 적대 무리 둘이 이번 계절 그 길 위에 있으면 길 한가운데서 맞붙는다.
 * 성·장정·기습이 없다(둘 다 걷는 중). 지는 쪽은 떠난 고을로 물러나고, 이긴 쪽은 가던 길을 그대로 간다.
 * 교착이면 둘 다 물러난다. 길마다 id 순서로, 한 길에 무리가 여럿이면 앞선 짝부터 (결정론). 싸움은 라운드로 (tactics.ts).
 */
function fieldBattles(r: Realm, tactics: Readonly<Record<string, Tactic>>, lines: ReportLine[]): void {
  const season = seasonOf(r.season)
  const marching = byId(Object.values(r.armies).filter((a) => a.march !== null))
  for (const eid of [...new Set(marching.map((a) => a.march!.edge))].sort()) {
    for (;;) {
      const on = marching.filter((a) => r.armies[a.id] !== undefined && a.march !== null && a.march.edge === eid)
      const groups = arrivalGroups(on)
      let pair: [Army[], Army[]] | null = null
      for (let i = 0; i < groups.length && pair === null; i++) {
        for (let j = i + 1; j < groups.length && pair === null; j++) {
          const gi = groups[i]!
          const gj = groups[j]!
          if (gi[0]!.march!.to !== gj[0]!.march!.to && meetHostile(r, gi[0]!, gj[0]!)) pair = [gi, gj]
        }
      }
      if (pair === null) break
      // 남의 땅으로 가던 쪽이 공격 쪽 — 둘 다거나 아무도 아니면 앞선 군대 id 쪽
      const [g1, g2] = pair
      const into = (g: Army[], h: Army[]): boolean => r.nodes[g[0]!.march!.to]?.owner === h[0]!.faction
      const g1First = into(g1, g2) === into(g2, g1) ? g1[0]!.id < g2[0]!.id : into(g1, g2)
      const atks = g1First ? g1 : g2
      const defs = g1First ? g2 : g1
      const lead = atks[0]!
      const target = lead.march!.to
      const ed = r.edges[eid]!
      const key = fieldKey(eid, lead.id)
      provoke(r, lead.faction, defs[0]!.faction, lines)
      meet(r, [...atks, ...defs])
      const atkF = mergeForces(r, atks)
      const defF = mergeForces(r, defs)
      const ground = { ...OPEN_FIELD, edge: ed.kind } // 들판 싸움 — 그 길의 지형
      const fa = power(atkF, defF, ground, 'atk')
      const fd = power(defF, atkF, ground, 'def')
      const p = winChance(fa, fd)
      const common = { water: isWater(ed.kind), edge: ed.kind, fire: fireable(ed, undefined, season), flank: false }
      const sa = sideOf(r, atks, atkF, fa, lead.faction, { ...common, seen: true })
      const sd = sideOf(r, defs, defF, fd, defs[0]!.faction, { ...common, seen: true })
      const res = fightRounds(sa, sd, key, r.seed, r.season, tacticFor(tactics, key))
      const outcome = res.outcome
      for (const x of atks) scaleMix(x, res.na)
      for (const x of defs) scaleMix(x, res.nd)
      shiftMorale(atks, res.dma)
      shiftMorale(defs, res.dmd)
      const atkWon = outcome === 'rout' || outcome === 'win'
      const atkLost = outcome === 'lose' || outcome === 'routed'
      const atkHeroes = atks.map((x) => x.hero)
      const defHeroes = defs.map((x) => x.hero)
      const fateOf = battleFates(r, res, sa, sd, atks, defs, lead.faction, defs[0]!.faction, key)
      // 이끈 장수가 자란다 (HEROES §6) — 사로잡히거나 죽은 이는 빠진다
      if (atkWon) battleGrowth(r, atkHeroes, defHeroes, [], lines)
      else if (atkLost) battleGrowth(r, defHeroes, atkHeroes, [], lines)
      else battleGrowth(r, [], [], [...atkHeroes, ...defHeroes], lines)
      // 진 쪽(교착이면 둘 다)은 떠난 고을로 — 그새 남이 쥐었으면 이웃의 제 땅, 없으면 흩어진다
      const back = (g: Army[]): void => {
        for (const x of g) {
          const home = x.march!.from
          x.march = null
          const to = retreatTo(r, x, home, home)
          if (to !== null) x.at = to
          else delete r.armies[x.id]
        }
      }
      if (!atkWon) back(atks)
      if (!atkLost) back(defs)
      lines.push({
        kind: 'battle', node: target, attacker: lead.id, allies: atks.slice(1).map((x) => x.id), pincer: false,
        defender: defs[0]!.faction, ambush: 'none', p, outcome, captured: fateOf.captured, killed: fateOf.killed,
        militia: 0, field: true, edge: eid, atkFaction: lead.faction, rounds: res.rounds, key, start: startOf(sa, sd, atkF, defF),
        ...(res.pending !== undefined ? { pending: res.pending } : {}), ...(res.led ? { led: true } : {}),
      })
    }
  }
  for (const a of Object.values(r.armies)) if (headcount(forceOf(r, a)) < 1) delete r.armies[a.id]
}

/**
 * 4·5 — 한 나라의 군대들이 같은 계절에 적 고을에 닿았다: 진군 방식 → 맞붙음(라운드) → 장수의 운명. 하나여도 같은 길을 지난다.
 * 진군 방식 (형: "강을 도하해 기습 · 대로로 행군 · 산기슭 · 절벽") —
 *   대로: 숨지 않는다. 질서 있게 닿아 사기 덤
 *   밤길 · 여울: 먹히면 성·장정 없이 잠든 적을 친다. 들키면 기다리던 적에게 걸린다 (여울은 물 한가운데서 — 더 잃는다)
 *   산기슭: 먹히면 성을 반쯤 비켜 뒤를 치고 옆치기를 얻는다
 *   절벽: 먹히면 성을 넘는다. 실패하면 떨어져 잃는다
 */
function fight(r: Realm, atks: readonly Army[], snipes: Readonly<Record<string, SnipeZone>>, tactics: Readonly<Record<string, Tactic>>, lines: ReportLine[]): void {
  const R = P.realm
  const season = seasonOf(r.season)
  const a = atks[0]!
  const node = r.nodes[a.march!.to]!
  const defenders = armiesAt(r, node.id).filter((d) => !allied(r, a.faction, d.faction))
  const defFaction = node.owner !== null && !allied(r, a.faction, node.owner) ? node.owner : defenders[0]!.faction
  const w = r.watch[node.id]!
  provoke(r, a.faction, defFaction, lines)
  meet(r, [...atks, ...defenders, ...heroesAtNode(r, node.id).map((h) => ({ hero: h }))])

  // 4 — 진군 방식: 군대마다 제 길로 따로 굴린다. 큰 군대는 잘 안 숨는다
  const legs = atks.map((x) => {
    const m = x.march!
    const ed = r.edges[m.edge]!
    const ap = approachOf(m)
    let amb: 'none' | 'success' | 'caught' = 'none'
    if (ap === 'cliff') amb = roll(r.seed, r.season, `cliff:${ed.id}:${x.id}`) < cliffChance(r, x) ? 'success' : 'caught'
    else if (ap !== 'road') {
      const size = -ambushSizePenalty(headcount(forceOf(r, x))) + ambushTraitOf(heroOf(r, x), ed.kind)
      const p = ambushChance(conceal(ed, node, season) + approachConceal(ap), heroOf(r, x)?.ryak ?? 1, bestRyak(r, defenders), size, w.lull, w.alert)
      amb = roll(r.seed, r.season, `ambush:${ed.id}:${x.id}`) < p ? 'success' : 'caught'
    }
    return { army: x, edge: ed, ambush: amb, ap }
  })
  const won = legs.filter((x) => x.ambush === 'success')
  const ambush = won.length > 0 ? 'success' : legs.some((x) => x.ambush === 'caught') ? 'caught' : 'none'
  // 성문이 닫히기 전에 들이쳤나 — 밤길·여울·절벽이 먹히면 성을 건너뛴다. 산기슭만 먹혔으면 성을 반쯤 비켜 뒤를 친다
  const overWall = won.some((x) => x.ap !== 'ridge')
  const sleeping = won.some((x) => x.ap === 'night' || x.ap === 'ford')
  const fell = legs.some((x) => x.ap === 'cliff' && x.ambush === 'caught')
  // 장정은 판정에만 선다 — 지키는 쪽 주인이 고을 주인일 때. 잠든 고을은 장정이 모이지 못한다
  const militia = sleeping ? null : militiaOf(r, node.id)
  const standing = militia !== null && militia.faction === defFaction ? [...defenders, militia] : defenders
  const militiaN = standing.length > defenders.length ? headcount(forceOf(r, militia!)) : 0
  if (ambush === 'success') {
    // 이웃 고을이 기습당했다 — 같은 나라의 이웃이 경계를 올린다 (SYSTEMS §3)
    for (const nb of neighbors(r, node.id)) {
      if (r.nodes[nb]?.owner === defFaction) r.watch[nb]!.alert = Math.min(R.alertMax, r.watch[nb]!.alert + R.alertOnAmbushed)
    }
  }
  // 잠든 적을 친다 — 맞붙기 전에 자다 깬 쪽이 먼저 잃는다 (밤길·여울·절벽이 먹혔을 때)
  if (overWall) for (const d of defenders) scaleMix(d, 1 - R.ambushFirstStrike)
  // 들킨 군대는 기다리던 적에게 걸렸다 — 맞붙기 전에 잃고 사기가 꺾인다. 여울은 물 한가운데서 더, 절벽은 떨어져서
  for (const l of legs) {
    if (l.ambush !== 'caught') continue
    const extra = l.ap === 'cliff' ? R.apCliffFall : R.ambushCaughtLoss + (l.ap === 'ford' ? R.apFordCaughtLoss : 0)
    scaleMix(l.army, 1 - Math.min(1, extra))
    l.army.morale = Math.max(R.moraleFloor, l.army.morale - R.ambushCaughtMorale)
  }

  // 저격 — 플레이어가 쏜 쪽은 상대 군대. 머리·몸통·북은 그 쪽 F 전체에 한 번, 다리·몸통은 사로잡기에 (SYSTEMS §4-2 · §5-3)
  const key = battleKey(node.id, a.id)
  const zone = snipes[key] ?? 'miss'
  const playerIsAtk = r.factions[a.faction]?.mind === 'player'
  const xMul = zone === 'head' ? R.snipeHead : zone === 'body' ? R.snipeBody : zone === 'drum' ? R.snipeDrum : 1
  const capShot = zone === 'leg' ? R.captureLegShot : zone === 'body' ? R.captureBodyShot : 0
  const atkF = mergeForces(r, atks)
  const defF = mergeForces(r, standing)
  const fort0 = fortMul(node, season)
  const fort = overWall ? 1 : won.length > 0 ? Math.pow(fort0, R.apRidgeFort) : fort0
  // 북은 방어측만 (SYSTEMS §4-2)
  const snipeAtk = playerIsAtk || zone === 'drum' ? 1 : xMul
  const snipeDef = playerIsAtk ? xMul : 1
  // 절벽에서 떨어진 군대는 기습 배수 대신 떨어진 몫만 — 남은 이들은 정면으로 붙는다
  const fa = groupPower(r, legs.map((x) => (x.ap === 'cliff' && x.ambush === 'caught' ? { ...x, ambush: 'none' as const } : x)), defF, fort) * snipeAtk
  // 지키는 쪽의 지형 — 앞선 군대가 걸어온 길 · 기습을 당했으면 방패병이 버틴다 (battle.roleMul) · 포구면 수군이 세다
  const fd = power(defF, atkF, { fort, crossing: false, ambush: 'none', snipeAtk: 1, snipeDef, edge: legs[0]!.edge.kind, ambushed: ambush === 'success', port: node.kind === 'port' }, 'def')
  const p = winChance(fa, fd)

  // 맞붙음 — 라운드 (tactics.ts). 지키는 쪽은 다가오는 것을 봤다 (기습이 먹혔으면 못 봤다)
  const edgeKind = legs[0]!.edge.kind
  const water = isWater(edgeKind) || node.kind === 'port'
  const fire = fireable(legs[0]!.edge, node, season)
  const flankWon = won.some((x) => x.ap === 'ridge')
  const atkBonus = legs.every((x) => x.ap === 'road') ? R.apRoadMorale : 0
  const defBonus = -((won.some((x) => x.ap === 'ridge') ? R.apRidgeMorale : 0) + (won.some((x) => x.ap === 'cliff') ? R.apCliffMorale : 0))
  const sa = sideOf(r, atks, atkF, fa, a.faction, {
    water, edge: edgeKind, fire, flank: flankWon, seen: freshSight(r, a.faction, node.id), moraleBonus: atkBonus,
    captureBonus: playerIsAtk ? capShot : 0,
  })
  const sd = sideOf(r, standing, defF, fd, defFaction, {
    water, edge: edgeKind, fire, flank: false, seen: ambush !== 'success', moraleBonus: defBonus,
    captureBonus: playerIsAtk ? 0 : capShot,
  })
  const res = fightRounds(sa, sd, key, r.seed, r.season, tacticFor(tactics, key))
  const outcome = res.outcome

  // 손실 · 사기 — 장정은 판정에만 선다 (r.armies 에 없다)
  for (const l of legs) scaleMix(l.army, res.na)
  for (const d of defenders) scaleMix(d, res.nd)
  shiftMorale(atks, res.dma)
  shiftMorale(defenders, res.dmd)

  // 5 — 장수의 운명 (사로잡기는 명령으로만 · 일기토 · 무너진 쪽의 난전)
  const atkWon = outcome === 'rout' || outcome === 'win'
  const atkLost = outcome === 'lose' || outcome === 'routed'
  const atkHeroes = atks.map((x) => x.hero)
  const defHeroes = defenders.map((x) => x.hero)
  const { captured, killed } = battleFates(r, res, sa, sd, atks, defenders, a.faction, defFaction, key)
  // 이끈 장수가 자란다 (HEROES §6) — 사로잡히거나 죽은 이는 빠진다
  if (atkWon) battleGrowth(r, atkHeroes, defHeroes, [], lines)
  else if (atkLost) battleGrowth(r, defHeroes, atkHeroes, [], lines)
  else battleGrowth(r, [], [], [...atkHeroes, ...defHeroes], lines)

  // 자리 — 이기면 다 함께 들어가 고을을 쥐고, 지거나 교착이면 저마다 떠난 고을로 돌아간다
  const from = new Map(atks.map((x) => [x.id, x.march!.from]))
  const lead = a.march!
  for (const x of atks) x.march = null
  if (atkWon) {
    for (const d of defenders) {
      const back = retreatTo(r, d, node.id, null)
      if (back !== null) d.at = back
      else delete r.armies[d.id] // 물러날 곳이 없다 — 흩어진다
    }
    for (const x of atks) x.at = node.id
    if (node.kind !== 'sodo' && node.owner !== a.faction && !allied(r, a.faction, node.owner)) {
      noteTake(r, a.faction, node.owner)
      onTake(r, node.id)
      node.owner = a.faction
      lines.push({ kind: 'take', faction: a.faction, node: node.id })
      revealAround(r, a.faction, node.id)
    }
    // 주인이 바뀐 고을의 옛 군세 정보는 뜻이 없다 — 지운다 (아는 척하지 않는다)
    for (const known of Object.values(r.intel)) {
      const k = known[node.id]
      if (k !== undefined) k.force = null
    }
  } else {
    // 지거나 교착 — 떠나온 고을로. 그새 남이 쥐었으면 이웃의 제 땅으로, 그것도 없으면 흩어진다
    for (const x of atks) {
      const home = from.get(x.id)!
      const back = retreatTo(r, x, home, home)
      if (back !== null) x.at = back
      else delete r.armies[x.id]
    }
  }
  lines.push({
    kind: 'battle', node: node.id, attacker: a.id, allies: atks.slice(1).map((x) => x.id),
    pincer: new Set(legs.map((x) => x.edge.id)).size >= 2, defender: defFaction, ambush, p, outcome, captured, killed,
    militia: militiaN, field: false, atkFaction: a.faction, rounds: res.rounds, key, approach: approachOf(lead), start: startOf(sa, sd, atkF, defF),
    ...(fell ? { fell: true } : {}), ...(res.pending !== undefined ? { pending: res.pending } : {}), ...(res.led ? { led: true } : {}),
  })
}

/** 3·4·5 — 행군: 남은 계절을 줄이고, 닿은 군대를 무리(협공)로 처리한다. 싸움이 난 고을을 `fought` 에 적는다 */
function resolveMarches(
  r: Realm, snipes: Readonly<Record<string, SnipeZone>>, tactics: Readonly<Record<string, Tactic>>, lines: ReportLine[], fought: Set<string>,
): void {
  fieldBattles(r, tactics, lines) // 길 위에서 먼저 마주친다
  const marching = byId(Object.values(r.armies).filter((a) => a.march !== null))
  for (const a of marching) {
    a.march!.left -= 1
    if (a.food !== undefined) a.food -= 1 // 길 위에서 군량을 먹는다
  }
  for (const g of arrivalGroups(marching.filter((a) => a.march!.left <= 0))) {
    const live = g.filter((a) => r.armies[a.id] !== undefined) // 앞의 싸움에서 흩어진 군대는 빠진다
    if (live.length === 0) continue
    const lead = live[0]!
    const node = r.nodes[lead.march!.to]!
    if (contested(r, node.id, lead.faction)) {
      fought.add(node.id)
      fight(r, live, snipes, tactics, lines)
      continue
    }
    for (const a of live) {
      a.march = null
      a.at = node.id
      lines.push({ kind: 'arrive', army: a.id, node: node.id })
    }
    // 동맹의 땅은 지나갈 뿐 쥐지 않는다
    if (node.owner !== lead.faction && node.kind !== 'sodo' && !allied(r, lead.faction, node.owner)) {
      provoke(r, lead.faction, node.owner, lines)
      noteTake(r, lead.faction, node.owner)
      if (node.owner !== null) onTake(r, node.id)
      node.owner = lead.faction
      lines.push({ kind: 'take', faction: lead.faction, node: node.id })
      revealAround(r, lead.faction, node.id)
      for (const known of Object.values(r.intel)) {
        const k = known[node.id]
        if (k !== undefined) k.force = null
      }
    }
  }
  // 병력이 바닥난 군대는 흩어진다
  for (const a of Object.values(r.armies)) if (headcount(forceOf(r, a)) < 1) delete r.armies[a.id]
}

/**
 * 군량 (형: "식량은 어떻게 챙겨가고 보급은 어떻게" 2026-10-19) — 제 땅·동맹 땅에 머무는 군대는 보급이 닿아 다시 찬다.
 * 남의 땅·빈땅에 머무는 군대는 계절마다 먹고, 떨어지면 사기가 꺾이고 사람이 빠진다. 길 위의 군대는 resolveMarches 가 먹인다.
 */
function stepFood(r: Realm, lines: ReportLine[]): void {
  const R = P.realm
  for (const a of byId(Object.values(r.armies))) {
    if (a.march !== null) continue
    const owner = r.nodes[a.at]?.owner ?? null
    if (allied(r, a.faction, owner)) {
      delete a.food
      continue
    }
    if (a.food === undefined) a.food = R.rationReserve
    a.food -= 1
    if (a.food >= 0) continue
    a.food = 0
    const before = headcount(forceOf(r, a))
    scaleMix(a, 1 - R.rationHungryLoss)
    a.morale = Math.max(R.moraleFloor, a.morale - R.rationHungryMorale)
    lines.push({ kind: 'hungry', army: a.id, lost: Math.max(0, before - headcount(forceOf(r, a))) })
  }
  for (const a of Object.values(r.armies)) if (headcount(forceOf(r, a)) < 1) delete r.armies[a.id]
}

/**
 * 기습 낌새 (형: "기습에 대비하거나" — 2026-10-18) — 우리 고을로 기습해 오는 보인 행군을 알아챘나.
 * 그 고을의 경계가 높을수록, 기습하는 장수의 략이 낮을수록 잘 챈다. 못 채면 그냥 행군으로 보인다.
 * 굴림은 군대마다 `suspect:<army>` — 같은 계절 같은 군대는 늘 같다.
 */
export function suspects(r: Realm, a: Army): boolean {
  const R = P.realm
  const m = a.march
  if (m === null || !m.ambush || r.nodes[m.to]?.owner !== r.player) return false
  const alert = r.watch[m.to]?.alert ?? 0
  const p = R.suspectBase + R.suspectPerAlert * alert - R.suspectPerRyak * ((heroOf(r, a)?.ryak ?? 1) - 1)
  return roll(r.seed, r.season, `suspect:${a.id}`) < Math.min(1, Math.max(0, p))
}

/** 9 — 경계는 계절마다 0 으로 돌아간다 */
function decayWatch(r: Realm): void {
  for (const w of Object.values(r.watch)) w.alert = Math.max(0, w.alert - P.realm.alertDecay)
}

/**
 * 판의 끝 (FLOW §7 #1) — 이김: 국읍(나라마다의 capital) winCapitals 곳을 쥔다 (제 국읍 포함).
 * 짐: 제 국읍을 잃는다. 한 번 정해지면 바뀌지 않는다.
 */
export function checkOutcome(r: Realm): 'win' | 'lose' | null {
  const me = r.player
  const capital = r.factions[me]?.capital
  if (capital === undefined) return null
  if (r.nodes[capital]?.owner !== me) return 'lose'
  let held = 0
  for (const f of Object.values(r.factions)) if (r.nodes[f.capital]?.owner === me) held++
  // 판마다 — 영남 판은 나라가 스물하나라 더 많이 쥐어야 한다
  const need = r.region === 'yeongnam' ? P.realm.winCapitalsYeongnam : r.region === 'south' ? P.realm.winCapitalsSouth : r.region === 'world' ? P.realm.winCapitalsWorld : P.realm.winCapitals
  return held >= need ? 'win' : null
}

export function advance(
  realm: Realm,
  orders: readonly Order[],
  snipes: Readonly<Record<string, SnipeZone>> = {},
  tactics: Readonly<Record<string, Tactic>> = {},
): { next: Realm; report: Report } {
  const r = plainClone(realm)
  migrate(r) // 옛 판이면 사람의 눈금을 키운다
  const lines: ReportLine[] = []
  const fought = new Set<string>()
  const season = ((r.season % 4) + 4) % 4
  resolveAnswers(r, orders, lines) // 1 — 지난 계절에 온 청에 답한다 (답이 없으면 거절)
  applyOrders(r, orders, lines) // 1
  resolveScouts(r, orders, lines) // 2
  resolveEnvoys(r, orders, lines) // 2
  applyBowUps(r, orders, lines) // 2 — 자객의 활을 올린다 (이번 계절 공작부터 든다)
  resolvePlots(r, orders, lines) // 2 — 공작
  resolveRites(r, orders, lines) // 2 — 소도 제사
  // 전장에서 내린 명령은 명령 줄로도 온다 (판 기록에 남는다) — 따로 받은 tactics 가 먼저 (시험 돌림)
  const led: Record<string, Tactic> = { ...tactics }
  for (const o of orders) if (o.kind === 'command' && led[o.key] === undefined) led[o.key] = { cmds: o.cmds }
  resolveMarches(r, snipes, led, lines, fought) // 3 · 4 · 5
  stepFood(r, lines) // 5 끝 — 남의 땅에 머무는 군대가 군량을 먹는다
  sweepHeroes(r, lines) // 5 끝 — 잃은 고을에 혼자 있던 장수는 물러나거나 잡힌다
  stepEconomy(r, season, fought, lines) // 7
  decayWatch(r) // 9
  stepHeroes(r, lines) // 9 — 회유 · 맡은 고을의 경계·철 · 떠돌이
  expireRelations(r, lines) // 9
  holdMarkets(r, lines) // 9 — 화친·동맹의 장터 (호감도 조금)
  driftFavor(r) // 9 — 같은 적과 싸우는 나라끼리 가까워진다
  checkPledges(r, lines) // 9 — 함께 치자는 약속을 지켰나
  stepLent(r, lines) // 9 — 빌려준 군대가 돌아갈 때
  shareIntel(r) // 9 — 동맹은 본 것을 나눈다
  stepBuilds(r, lines) // 9 — 다 지은 목책·해자가 선다
  refreshSpies(r) // 9 — 첩자가 본다
  for (const [f, spies] of Object.entries(r.spies ?? {})) for (const s of spies) noteMet(r, f, heroesAtNode(r, s.node))
  spreadRumors(r, lines) // 9 — 첩자가 들은 것 (간접 정보)
  stepDiscovery(r, lines) // 9 — 이번 계절의 일로 서로 알게 된다 (삼한 남부 판 · 발견)
  stepSight(r, lines) // 9 — 우리 군대·사신·장사꾼이 본 땅 (지도는 보고 다닌 만큼)
  if (r.player !== undefined) {
    for (const a of seenMarches(r, r.player)) {
      const line = { kind: 'sighted', faction: a.faction, army: a.id, from: a.march!.from, to: a.march!.to } as const
      lines.push(suspects(r, a) ? { ...line, suspect: true } : line)
    }
    if (r.outcome === null || r.outcome === undefined) {
      const end = checkOutcome(r)
      if (end !== null) {
        r.outcome = { kind: end, season: r.season }
        lines.push({ kind: 'end', outcome: end, faction: r.player })
      }
    }
    makeAsks(r, lines) // 9 — 남의 나라가 다음 계절에 답할 청을 건다
  }
  const report: Report = { season: r.season, lines }
  r.season += 1 // 11
  return { next: r, report }
}
