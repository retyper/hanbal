/**
 * 남의 나라는 어떻게 생각하나 — R1 은 성향 둘 (docs/realm/SYSTEMS.md §11 · BUILD §3-5)
 *
 * AI 도 **같은 정보 규칙**을 따른다: 제 intel 에 없는 것은 모른다 (속이는 AI 는 정보의 계약을 깬다).
 * 셈은 화면과 같은 estimate.ts 를 쓴다 — 플레이어가 보는 승률과 AI 가 믿는 승률이 같다.
 *
 *   탐욕(greedy) — 정찰하지 않는다. 보이는 범위의 **가운데**로 셈해 이길 만해 보이면 친다. 모르면 얕본다.
 *   신중(cautious) — 정보가 새롭고 **최악의 승률**이 높을 때만 친다. 아니면 그 고을을 정찰한다.
 *                    혼자로 모자라면 같은 계절에 닿는 둘 이상이 협공한다 (SYSTEMS §4-5).
 * 둘 다 판 초반에는 플레이어 땅에 들어오지 않는다 (spared — 초반 유예).
 * 같은 함수가 tools/realm-sim.ts 의 봇(무모·신중·무작위)으로도 쓰인다 — 플레이어 자리에 앉혀 판을 돌린다.
 * 문턱 숫자는 전부 P.realm.ai* (A2).
 */
import { roll } from '../core/rng.ts'
import { P } from '../tune/params.ts'
import { allyFoe, friendly, nationPower, openAsks, relationOf } from './diplomacy.ts'
import {
  canGuard, draftCost, draftLimit, guardCost, hhOf, menOf, riteAllowed, riteCost, settleLimit, settleTargets, stockOf, upkeepOf,
} from './economy.ts'
import { ambushWorth, jointWin, movesOf, type Move } from './estimate.ts'
import { armiesAt, fortMul, neighbors, newArmyId, planned, seasonOf, seenMarches } from './season.ts'
import type { UnitKind } from './battle.ts'
import { plotCost, plotTargets } from './plots.ts'
import type { Army, EnvoyAsk, Order, PlotOp, Realm } from './types.ts'

export type Brain = 'greedy' | 'cautious' | 'reckless' | 'random' | 'planner'

function sorted<T extends { id: string }>(xs: Iterable<T>): T[] {
  return [...xs].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}

/** 국읍을 지키는 마지막 군대인가 — 웬만해선 안 움직인다 */
function lastGuard(r: Realm, faction: string, a: Army): boolean {
  const cap = r.factions[faction]?.capital
  if (cap === undefined || a.at !== cap) return false
  return armiesAt(r, cap).filter((x) => x.faction === faction).length <= 1
}

/** 동맹이 싸우는 적의 고을이면 더 쳐 볼 만하다 — 동맹은 같은 적을 먼저 친다 (FLOW §4) */
function focus(r: Realm, faction: string, to: string): number {
  return allyFoe(r, faction, r.nodes[to]?.owner ?? null) ? P.realm.aiAllyFocus : 0
}

/** 소도 제사 — 허락되고 군량 aiDraftReserve 계절치를 남기고도 제사 곡식이 남으면 */
function rites(r: Realm, faction: string): Order[] {
  if (!riteAllowed(r, faction)) return []
  const spare = stockOf(r, faction).grain - P.realm.aiDraftReserve * upkeepOf(r, faction, true)
  return spare >= riteCost().grain ? [{ kind: 'rite', faction }] : []
}

/** 기습의 최악 승률 — 먹힘·들킴의 최악을 먹힐 확률로 섞는다. 모르면 null */
function ambushLow(t: Move): number | null {
  if (t.winAmbush === null || t.winCaught === null) return null
  return t.ambushP * t.winAmbush[0] + (1 - t.ambushP) * t.winCaught[0]
}

/** 이 길로 칠 때의 최악 승률 — 정면과 기습 가운데 나은 쪽. 모르면 null (기습이 먹히면 성·장정이 없다 — 성 뒤의 고을은 기습으로 노린다) */
function low(t: Move): number | null {
  if (t.win === null) return null
  return Math.max(t.win[0], ambushLow(t) ?? -1)
}

/**
 * 기습할까 — 기습의 최악 승률이 정면보다 나으면 기습한다 (고를 때와 같은 잣대).
 * 군세를 모르면 기습 확률만 본다 (aiAmbushWorth).
 */
function march(a: Army, t: Move): Order {
  const amb = ambushLow(t)
  const ambush = amb !== null && t.win !== null ? amb > t.win[0] : t.ambushP >= P.realm.aiAmbushWorth
  return { kind: 'march', army: a.id, edge: t.edge.id, ambush }
}

/**
 * 초반 유예 (SYSTEMS §9-1 의 "긴장도는 국력을 따른다"가 R4 에서 이 자리를 갖는다) — 판 첫 aiGrace 계절에는
 * 남의 나라가 플레이어 땅에 들어오지 않는다. 작은 나라는 아직 눈에 안 띈다: 이웃끼리 먼저 다투고,
 * 우리는 그 사이에 정찰하고 자리를 잡는다. **먼저 친 나라에는 유예가 없다** (realm.provoked).
 * 승률 문턱으로는 못 막는다 — 빈 읍락은 승률 100% 다 (봇 대전: 잃은 땅의 7할이 싸움 없이 빈 고을이었다).
 */
export function spared(r: Realm, faction: string, to: string): boolean {
  const owner = r.nodes[to]?.owner
  if (owner === null || owner === undefined || owner === faction) return false
  // 화친·동맹을 맺은 나라는 치지 않는다 (FLOW §4)
  if (friendly(r, faction, owner)) return true
  if (r.factions[owner]?.mind !== 'player' || r.season >= P.realm.aiGrace) return false
  return !(r.provoked ?? []).includes(faction)
}

const MIX_GOAL: ReadonlyArray<readonly [UnitKind, number]> = [['spear', 0.6], ['bow', 0.3], ['shield', 0.1]]

/**
 * 징병 (FLOW §2) — 가을·겨울에만 (봄 징병은 농사를 깎는다). 곡식은 aiDraftReserve 계절치 군량을 남긴다.
 * 국읍과 제 군대가 쉬는 고을에서, 나라 군사의 병종 비가 MIX_GOAL 에서 가장 모자란 쪽을 뽑는다.
 * 봇도 같은 셈으로 뽑는다 — 봇 대전이 공정하려고.
 */
function drafts(r: Realm, faction: string): Order[] {
  const R = P.realm
  const s = seasonOf(r.season)
  if (s !== 'autumn' && s !== 'winter') return []
  const fac = r.factions[faction]
  if (fac === undefined) return []
  const men = menOf(r, faction)
  let spare = stockOf(r, faction).grain - R.aiDraftReserve * upkeepOf(r, faction, true)
  const have: Partial<Record<UnitKind, number>> = {}
  for (const a of Object.values(r.armies)) {
    if (a.faction !== faction) continue
    for (const [k, v] of Object.entries(a.mix) as Array<[UnitKind, number]>) have[k] = (have[k] ?? 0) + v
  }
  const places = [fac.capital, ...sorted(Object.values(r.armies)).filter((a) => a.faction === faction && a.march === null).map((a) => a.at)]
  const out: Order[] = []
  // 나라 상한 — 뽑으면 가호가 줄고 군사가 늘어 (가호+군사)는 그대로라, 이번 계절에 뽑은 몫만 빼면 된다
  let room = Math.floor(R.draftCap * (hhOf(r, faction) + men)) - men
  let took = 0
  for (const node of [...new Set(places)]) {
    if (r.nodes[node]?.owner !== faction) continue
    const n = Math.min(draftLimit(r, faction, node), room, Math.floor(spare / Math.max(1e-9, R.draftGrain)))
    if (n < R.splitMin) continue
    const total = men + took
    const unit = MIX_GOAL.reduce((best, [k, w]) =>
      w * (total + n) - (have[k] ?? 0) > best[1] ? [k, w * (total + n) - (have[k] ?? 0)] as [UnitKind, number] : best,
    ['spear', -Infinity] as [UnitKind, number])[0]
    out.push({ kind: 'draft', faction, node, unit, n })
    have[unit] = (have[unit] ?? 0) + n
    spare -= draftCost(n).grain
    room -= n
    took += n
  }
  return out
}

/**
 * 신중의 협공 (SYSTEMS §4-5) — 혼자로는 모자란 군대들이 같은 계절에 닿는 길로 같은 고을을 함께 친다.
 * 국읍을 다 비우지는 않는다.
 */
function joint(r: Realm, faction: string, idle: readonly Army[]): Order[] {
  const R = P.realm
  const cap = r.factions[faction]?.capital
  const used = new Set<string>()
  const out: Order[] = []
  const targets = new Set<string>()
  const movesBy = new Map(idle.map((a) => [a.id, movesOf(r, faction, a)] as const))
  for (const ms of movesBy.values()) for (const t of ms) if (t.hostile && t.blocked === null && !spared(r, faction, t.to)) targets.add(t.to)
  for (const to of [...targets].sort()) {
    // 닿는 계절 수가 같은 것끼리만 — 박자가 안 맞으면 따로 맞는다
    const bySeasons = new Map<number, Array<{ army: Army; move: Move }>>()
    let leftAtCap = cap === undefined ? 0 : armiesAt(r, cap).filter((x) => x.faction === faction && !used.has(x.id)).length
    for (const a of idle) {
      if (used.has(a.id)) continue
      const t = movesBy.get(a.id)!.find((m) => m.to === to && m.hostile && m.blocked === null && m.win !== null && m.age <= R.aiCautiousAge)
      if (t === undefined) continue
      if (a.at === cap) {
        if (leftAtCap <= 1) continue
        leftAtCap -= 1
      }
      const list = bySeasons.get(t.seasons) ?? []
      list.push({ army: a, move: t })
      bySeasons.set(t.seasons, list)
    }
    for (const [, legs] of [...bySeasons].sort((x, y) => x[0] - y[0])) {
      if (legs.length < 2) continue
      const w = jointWin(r, faction, legs.map((x) => ({ army: x.army, edge: x.move.edge })), to)
      if (w === null || w[0] < R.aiCautiousWin) continue
      for (const x of legs) {
        out.push(march(x.army, x.move))
        used.add(x.army.id)
      }
      break
    }
  }
  return out
}

/**
 * 봇 계획가 (tools/realm-sim) — 신중처럼 정찰하고 최악의 승률로 고르되, 국읍의 마지막 군대라고 얼어 있지 않는다:
 * plannerKeep 몫을 국읍에 남기고 장수가 별동대를 이끌어 그 계절에 떠난다 (SYSTEMS §4-5 나누기).
 * 같은 고을에 쉬는 군대가 둘 이상이면 먼저 모은다 — 상한 다섯을 쓰고 남기지 않으려고.
 */
function plan(r: Realm, faction: string): Order[] {
  const R = P.realm
  const orders: Order[] = []
  let p = r
  const idle = (): Army[] => sorted(Object.values(p.armies)).filter((a) => a.faction === faction && a.march === null)
  // 모으기 — 장수 없는 쪽을 장수 있는 쪽으로
  for (const a of idle()) {
    if (p.armies[a.id] === undefined || a.hero !== null) continue
    const into = idle().find((b) => b.id !== a.id && b.at === a.at)
    if (into === undefined) continue
    const o: Order = { kind: 'merge', army: a.id, into: into.id }
    const next = planned(p, [o])
    if (next.armies[a.id] !== undefined) continue
    orders.push(o)
    p = next
  }
  let scouted = false
  for (const a of idle()) {
    const ts = movesOf(p, faction, a).filter((t) => t.hostile && t.blocked === null && !spared(p, faction, t.to))
    if (ts.length === 0) continue
    const fresh = ts.filter((t) => t.win !== null && t.age <= R.aiCautiousAge)
    if (!lastGuard(p, faction, a)) {
      const ready = fresh.filter((t) => low(t)! + focus(p, faction, t.to) >= R.aiCautiousWin)
      if (ready.length > 0) {
        orders.push(march(a, ready.reduce((x, y) => (low(y)! + focus(p, faction, y.to) > low(x)! + focus(p, faction, x.to) ? y : x))))
        continue
      }
    } else {
      // 국읍의 마지막 군대 — 몫을 남기고 별동대를 보낸다
      const take: Partial<Record<UnitKind, number>> = {}
      for (const [k, n] of Object.entries(a.mix) as Array<[UnitKind, number]>) take[k] = Math.floor(n * (1 - R.plannerKeep))
      const det = { ...a, mix: take }
      let best: Move | null = null
      let bestW = -1
      for (const t of fresh) {
        const w = jointWin(p, faction, [{ army: det, edge: t.edge }], t.to)
        const v = w === null ? -1 : w[0] + focus(p, faction, t.to)
        if (w !== null && v >= R.aiCautiousWin && v > bestW) {
          best = t
          bestW = v
        }
      }
      if (best !== null) {
        const id = newArmyId(p, faction)
        const o: Order = { kind: 'split', army: a.id, id, take, hero: true }
        const next = planned(p, [o])
        if (next.armies[id] !== undefined) {
          orders.push(o, march(next.armies[id]!, best))
          p = next
          continue
        }
      }
    }
    if (!scouted) {
      const stale = ts.reduce((x, y) => (y.age > x.age ? y : x))
      if (stale.age > R.aiCautiousAge) {
        orders.push({ kind: 'scout', faction, node: stale.to, hero: null })
        scouted = true
      }
    }
  }
  return orders
}

/**
 * 개척 (FLOW §2) — 봄·가을에, 군량 aiDraftReserve 계절치를 남기고도 곡식이 남으면 빈땅 하나에 사람을 보낸다.
 * 품(room)이 가장 많이 남은 빈땅을, 그리로 가는 고을 가운데 가호가 가장 많은 곳에서. 보낼 수 있는 몫의 aiSettleShare 만.
 * 남의 군대가 머물거나 그리로 가는 빈땅, **남의 국읍과 맞닿은 빈땅**은 피한다 — 사람 적은 새 마을이 큰 군대 코앞에 서면
 * 뺏기고, 그 자리가 제 국읍을 치는 발판이 된다 (봇 대전: 갯마을이 돌섬을 개척하면 구야가 돌섬을 거쳐 국읍을 쳤다, 짐 81% → 97%).
 */
function settles(r: Realm, faction: string): Order[] {
  const R = P.realm
  const s = seasonOf(r.season)
  if (s !== 'spring' && s !== 'autumn') return []
  const spare = stockOf(r, faction).grain - R.aiDraftReserve * upkeepOf(r, faction, true)
  if (spare <= 0) return []
  const capitals = new Set(Object.values(r.factions).filter((f) => f.id !== faction).map((f) => f.capital))
  const foe = (to: string): boolean =>
    Object.values(r.armies).some((a) => a.faction !== faction && (a.march === null ? a.at === to : a.march.to === to)) ||
    neighbors(r, to).some((nb) => capitals.has(nb) && r.nodes[nb]?.owner !== faction)
  let best: { from: string; to: string; n: number; left: number; hh: number } | null = null
  for (const t of settleTargets(r, faction)) {
    if (foe(t.to)) continue
    const to = r.nodes[t.to]!
    const n = Math.min(Math.floor(settleLimit(r, faction, t.from, t.to) * R.aiSettleShare), Math.floor(spare / Math.max(1e-9, R.settleGrain)))
    if (n < R.splitMin) continue
    const left = (to.room ?? 0) - to.hh
    const hh = r.nodes[t.from]!.hh
    if (best === null || left > best.left || (left === best.left && hh > best.hh)) best = { from: t.from, to: t.to, n, left, hh }
  }
  return best === null ? [] : [{ kind: 'settle', faction, from: best.from, to: best.to, n: best.n }]
}

/**
 * 경계 강화 — 보인 남의 행군이 제 고을로 오면, 군량을 남기고도 곡식이 있으면 그 고을의 경계를 올린다.
 * 기습인지 아닌지는 모른다 (낌새는 화면의 몫) — 오는 것이 보이면 대비한다.
 */
function guards(r: Realm, faction: string): Order[] {
  let spare = stockOf(r, faction).grain - P.realm.aiDraftReserve * upkeepOf(r, faction, true)
  const out: Order[] = []
  const nodes = [...new Set(seenMarches(r, faction).map((a) => a.march!.to))].sort()
  for (const node of nodes) {
    if (spare < guardCost().grain || !canGuard(r, faction, node)) continue
    out.push({ kind: 'guard', faction, node })
    spare -= guardCost().grain
  }
  return out
}

/**
 * AI 끼리의 사신 — 한 계절에 aiEnvoyChance 로 하나. 지고 있는 전쟁이면 화친, 같은 적이 있으면 동맹, 신중하면 이웃과 화친.
 * 플레이어에게는 사신이 아니라 청(diplomacy.makeAsks)을 건다 — 여기서는 플레이어를 고르지 않는다.
 */
/**
 * 공작 (plots.ts) — 계절마다 aiPlotChance 로 하나. 탐욕은 방화·매수, 신중(과 계획가)은 첩자·소문.
 * 노리는 나라: 싸우는 나라가 먼저, 없으면 화친·동맹이 아닌 가장 센 나라 — 플레이어도 든다.
 * 군량 세 계절치를 남기고도 값을 낼 수 있어야 한다.
 */
function plots(r: Realm, faction: string, brain: Brain): Order[] {
  if (roll(r.seed, r.season, `ai-plot:${faction}`) >= P.realm.aiPlotChance) return []
  const foes = sorted(Object.values(r.factions))
    .filter((f) => f.id !== faction && !friendly(r, faction, f.id) && Object.values(r.nodes).some((n) => n.owner === f.id))
    .map((f) => ({ id: f.id, war: relationOf(r, faction, f.id).state === 'war', power: nationPower(r, f.id) }))
    .sort((a, b) => (a.war !== b.war ? (a.war ? -1 : 1) : b.power - a.power))
  const target = foes[0]?.id
  if (target === undefined) return []
  const pickOp = roll(r.seed, r.season, `ai-plot-op:${faction}`) < 0.5
  const op: PlotOp = brain === 'greedy' || brain === 'reckless' ? (pickOp ? 'burn' : 'bribe') : pickOp ? 'spy' : 'rumor'
  const c = plotCost(op)
  const st = stockOf(r, faction)
  if (st.grain - P.realm.aiDraftReserve * upkeepOf(r, faction, true) < c.grain || st.iron < c.iron) return []
  if (op === 'rumor' || op === 'burn') return [{ kind: 'plot', faction, op, target }]
  // 매수·첩자 — 그 나라 고을 가운데 우리 땅과 맞닿은 곳을 먼저
  const ours = new Set(Object.values(r.nodes).filter((n) => n.owner === faction).map((n) => n.id))
  const cands = plotTargets(r, faction, op).filter((t) => t.target === target)
  const near = cands.find((t) => neighbors(r, t.node!).some((x) => ours.has(x))) ?? cands[0]
  return near === undefined ? [] : [{ kind: 'plot', faction, op, target, node: near.node! }]
}

function envoys(r: Realm, faction: string): Order[] {
  if (roll(r.seed, r.season, `ai-envoy:${faction}`) >= P.realm.aiEnvoyChance) return []
  const me = nationPower(r, faction)
  const mind = r.factions[faction]?.mind
  let best: { to: string; ask: EnvoyAsk; w: number } | null = null
  for (const f of sorted(Object.values(r.factions))) {
    if (f.id === faction || f.mind === 'player' || !Object.values(r.nodes).some((n) => n.owner === f.id)) continue
    const rel = relationOf(r, faction, f.id).state
    const ratio = me / Math.max(1, nationPower(r, f.id))
    let c: { ask: EnvoyAsk; w: number } | null = null
    if (rel === 'war' && ratio < 1) c = { ask: 'truce', w: 2 - ratio }
    else if ((rel === 'neutral' || rel === 'truce') && commonFoe(r, faction, f.id)) c = { ask: 'alliance', w: 1.5 }
    else if (rel === 'neutral' && mind === 'cautious') c = { ask: 'truce', w: 1 }
    if (c !== null && (best === null || c.w > best.w)) best = { to: f.id, ...c }
  }
  if (best === null) return []
  return [{ kind: 'envoy', from: faction, to: best.to, ask: best.ask, give: { grain: 0, iron: 0 }, take: { grain: 0, iron: 0 } }]
}

function commonFoe(r: Realm, a: string, b: string): boolean {
  return Object.keys(r.factions).some((x) => x !== a && x !== b && relationOf(r, a, x).state === 'war' && relationOf(r, b, x).state === 'war')
}

/**
 * 플레이어 자리에 앉은 봇의 답 (tools/realm-sim) — 화친·동맹·바침은 받는다, 맞바꿈은 손해가 아니면,
 * 조공 요구는 그쪽이 askDemandPower 배 넘게 세면 낸다(못 내면 어쩔 수 없다).
 */
function answers(r: Realm, faction: string): Order[] {
  const R = P.realm
  const out: Order[] = []
  for (const a of openAsks(r, faction)) {
    let yes: boolean
    switch (a.kind) {
      case 'trade': {
        const val = (x: { grain: number; iron: number }): number => x.grain + x.iron * R.envoyIronWorth
        yes = val(a.give) >= val(a.take) * 0.9
        break
      }
      case 'demand':
        yes = nationPower(r, a.from) >= R.askDemandPower * nationPower(r, faction)
        break
      default:
        yes = true
    }
    out.push({ kind: 'answer', ask: a.id, yes })
  }
  return out
}

/**
 * 한 세력의 이번 계절 명령 — 징병(가을·겨울) · 개척(봄·가을) · 소도 제사(봄·가을) · 군대의 움직임.
 * 무모·무작위 봇은 개척하지 않고, 무작위는 제사도 안 지낸다. 제사는 징병·개척으로 곡식을 쓴 뒤의 창고로 셈한다 (판정도 그 순서다)
 */
export function decide(r: Realm, faction: string, brain: Brain): Order[] {
  const ds = drafts(r, faction)
  const ss = brain === 'reckless' || brain === 'random' ? [] : settles(ds.length > 0 ? planned(r, ds) : r, faction)
  const rs = brain === 'random' ? [] : rites(ds.length + ss.length > 0 ? planned(r, [...ds, ...ss]) : r, faction)
  const first = [...ds, ...ss, ...rs]
  const gs = brain === 'random' || brain === 'reckless' ? [] : guards(first.length > 0 ? planned(r, first) : r, faction)
  const talk = brain === 'random' ? [] : [...answers(r, faction), ...envoys(r, faction)]
  // 공작은 징병·개척·제사·경계로 곡식을 쓴 뒤의 창고로 셈한다 (판정도 그 뒤다 — 2단계)
  const ps = brain === 'random' ? [] : plots([...first, ...gs].length > 0 ? planned(r, [...first, ...gs]) : r, faction, brain)
  return [...talk, ...first, ...gs, ...ps, ...(brain === 'planner' ? plan(r, faction) : moves(r, faction, brain))]
}

function moves(r: Realm, faction: string, brain: Brain): Order[] {
  const R = P.realm
  const orders: Order[] = []
  const armies = sorted(Object.values(r.armies)).filter((a) => a.faction === faction && a.march === null)
  const waiting: Army[] = []
  let scouted = false
  /** 이번 계절에 나눈 것까지 해 본 판 — 새 군대 이름이 겹치지 않게 */
  let p = r

  /**
   * 국읍의 마지막 군대 — 얼어 있지 않고 plannerKeep 몫을 남긴 별동대를 보낸다 (SYSTEMS §4-5).
   * `score` 는 별동대의 승률 범위(모르면 null)를 받아 그 길의 값을 낸다. 문턱을 못 넘으면 안 보낸다.
   */
  const detach = (a: Army, ts: readonly Move[], score: (w: readonly [number, number] | null, t: Move) => number, bar: number): boolean => {
    const n = Object.values(a.mix).reduce((s, v) => s + (v ?? 0), 0)
    // 남기는 몫이 aiGuardMin 아래면 안 나눈다 — 계절마다 떼어 보내 국읍이 바닥나는 것을 막는다 (봇 대전에서 독로가 첫해에 무너졌다)
    if (n * R.plannerKeep < R.aiGuardMin || n * (1 - R.plannerKeep) < R.splitMin) return false
    const take: Partial<Record<UnitKind, number>> = {}
    for (const [k, n] of Object.entries(a.mix) as Array<[UnitKind, number]>) take[k] = Math.floor(n * (1 - R.plannerKeep))
    const det = { ...a, mix: take }
    let best: Move | null = null
    let bestV = -Infinity
    for (const t of ts) {
      const v = score(jointWin(p, faction, [{ army: det, edge: t.edge }], t.to), t)
      if (v >= bar && v > bestV) {
        best = t
        bestV = v
      }
    }
    if (best === null) return false
    const id = newArmyId(p, faction)
    const o: Order = { kind: 'split', army: a.id, id, take, hero: true }
    const next = planned(p, [o])
    if (next.armies[id] === undefined) return false
    orders.push(o, march(next.armies[id]!, best))
    p = next
    return true
  }

  for (const a of armies) {
    const ts = movesOf(r, faction, a).filter((t) => t.hostile && t.blocked === null && !spared(r, faction, t.to))
    if (ts.length === 0) continue

    if (brain === 'random') {
      if (roll(r.seed, r.season, `ai:${faction}:${a.id}:go`) < 0.5) continue
      orders.push(march(a, ts[Math.floor(roll(r.seed, r.season, `ai:${faction}:${a.id}:pick`) * ts.length)]!))
      continue
    }

    if (brain === 'greedy' || brain === 'reckless') {
      // 가운데로 셈하고, 모르면 얕본다 — 다만 성벽은 보인다 (모르는 고을의 짐작을 성 배수로 나눈다). 무모는 국읍도 비운다
      const mid = (w: readonly [number, number] | null, t: Move): number =>
        (w !== null ? Math.max((w[0] + w[1]) / 2, w === t.win ? (ambushWorth(t) ?? 0) : 0) : R.aiUnknownWin / fortMul(r.nodes[t.to]!, seasonOf(r.season))) + focus(r, faction, t.to)
      const bar = brain === 'reckless' ? R.aiRecklessWin : R.aiGreedyWin
      let went: boolean
      if (brain === 'greedy' && lastGuard(r, faction, a)) went = detach(a, ts, mid, bar)
      else {
        const best = ts.reduce((x, y) => (mid(y.win, y) > mid(x.win, x) ? y : x))
        went = mid(best.win, best) >= bar
        if (went) orders.push(march(a, best))
      }
      // 칠 데가 안 보이면 탐욕도 한 곳은 들여다본다 — 성벽 뒤를 모르면 영영 못 친다
      if (!went && brain === 'greedy' && !scouted) {
        const stale = ts.reduce((x, y) => (y.age > x.age ? y : x))
        if (stale.age > R.aiCautiousAge) {
          orders.push({ kind: 'scout', faction, node: stale.to, hero: null })
          scouted = true
        }
      }
      continue
    }

    // 신중 — 새 정보 · 최악의 승률
    const ready = ts.filter((t) => t.win !== null && t.age <= R.aiCautiousAge && low(t)! + focus(r, faction, t.to) >= R.aiCautiousWin)
    if (ready.length > 0 && !lastGuard(r, faction, a)) {
      orders.push(march(a, ready.reduce((x, y) => (low(y)! + focus(r, faction, y.to) > low(x)! + focus(r, faction, x.to) ? y : x))))
      continue
    }
    if (lastGuard(r, faction, a)) {
      const fresh = ts.filter((t) => t.age <= R.aiCautiousAge)
      if (detach(a, fresh, (w) => (w === null ? -1 : w[0]), R.aiCautiousWin)) continue
    }
    waiting.push(a)
    if (!scouted) {
      // 가장 오래 못 본 이웃 적 고을을 본다 — 한 계절에 척후 하나
      const stale = ts.reduce((x, y) => (y.age > x.age ? y : x))
      if (stale.age > R.aiCautiousAge) {
        orders.push({ kind: 'scout', faction, node: stale.to, hero: null })
        scouted = true
      }
    }
  }
  if (brain === 'cautious' && waiting.length >= 2) orders.push(...joint(r, faction, waiting))
  return orders
}

/** 플레이어가 아닌 모든 세력의 명령 — 저마다의 성향대로 */
export function aiOrders(r: Realm): Order[] {
  const out: Order[] = []
  for (const f of sorted(Object.values(r.factions))) {
    if (f.mind === 'player') continue
    out.push(...decide(r, f.id, f.mind))
  }
  return out
}
