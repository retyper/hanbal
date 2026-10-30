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
import {
  allyFoe, bigTwo, canEscort, envoyOptions, favorOf, friendly, jointTargets, lentStep, nationPower, openAsks, pledgedNodes, powerRange, relationOf, tradeOffer,
} from './diplomacy.ts'
import {
  armCost, buildCost, canBuild, canGuard, deongiMen, deongiSplit, draftCost, draftLimit, draftNeeds, goodOf, goodsWorth, guardCost, hhOf, menOf, nextBuild, riteAllowed, riteCost, settleLimit, settleTargets, sonoeRoom, stockOf, upkeepOf,
} from './economy.ts'
import { hasCustom } from './data/customs.ts'
import { ambushWorth, jointWin, movesOf, type Move } from './estimate.ts'
import { hasTrait, idleHeroOrders, persuadeSeasons, wanderersFor } from './heroes.ts'
import { limitHands } from './hands.ts'
import { armiesAt, draftable, extendPlan, fortMul, neighbors, newArmyId, planned, seasonOf, seenMarches } from './season.ts'
import { memoFor, withMemo } from './memo.ts'
import type { UnitKind } from './battle.ts'
import { bowUpCost, plotAgents, plotCost, plotTargets } from './plots.ts'
import { allianceWhy, borders, breakWhy, leaderOf, truceWhy } from './stance.ts'
import { knows } from './discovery.ts'
import { BASE_MIX, mixOf } from './data/armymix.ts'
import type { Army, EnvoyAsk, Hero, Order, PlotOp, Realm, Why } from './types.ts'

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

/** 그 나라 눈에 앞서가는 나라 — 판 하나에 나라마다 한 번만 셈한다 (focus 가 길마다 부른다) */
const LEADER = new WeakMap<Realm, Map<string, string | null>>()
function leaderFor(r: Realm, faction: string): string | null {
  let m = LEADER.get(r)
  if (m === undefined) LEADER.set(r, (m = new Map()))
  if (!m.has(faction)) m.set(faction, leaderOf(r, faction))
  return m.get(faction)!
}

/** 동맹이 싸우는 적의 고을이면 더 쳐 볼 만하다 — 동맹은 같은 적을 먼저 친다 (FLOW §4) */
function focus(r: Realm, faction: string, to: string): number {
  // 함께 치자고 약속한 고을이면 더 — 약속을 지키려 한다
  const m = memoFor(r)?.pledged
  let mine = m?.get(faction)
  if (mine === undefined) {
    mine = new Set(pledgedNodes(r, faction))
    m?.set(faction, mine)
  }
  const pledged = mine.has(to) ? P.realm.aiPledgeFocus : 0
  // 풍습 — 쌓인 덩이쇠를 탐낸다(변한) · 쇠 나는 고을을 노린다(쇠 다루기 · 땅) (data/customs.ts)
  const tn = r.nodes[to]
  const lure = tn?.owner == null || tn.owner === faction ? 0
    : (hasCustom(r, tn.owner, 'deongisoe') && goodOf(stockOf(r, tn.owner), 'iron') >= P.realm.deongiCovet ? P.realm.deongiFocus : 0)
      + (tn.kind === 'ironMine' && hasCustom(r, tn.owner, 'landIron') ? P.realm.landIronFocus : 0)
      + (r.factions[tn.owner]?.capital === to && hasCustom(r, faction, 'geumseong') ? P.realm.siegeFocus : 0)
      // 책화(동예) — 그 땅을 밟으면 물어내야 한다: 이웃이 덜 쳐 볼 만하게 본다
      - (hasCustom(r, tn.owner, 'chaekhwa') ? P.realm.chaekhwaDeter : 0)
  // 힘의 균형 — 앞서가는 나라(도읍 둘 또는 힘 3할)는 모두가 막으려 한다 (stance.leaderOf, 제 정보로 본다)
  const owner = r.nodes[to]?.owner ?? null
  const lead = owner !== null && owner !== faction && leaderFor(r, faction) === owner ? P.realm.aiLeaderFocus : 0
  // 난세 단계 — 높을수록 이웃이 우리를 노린다 (이웃만 세지면 이웃끼리 부숴 오히려 쉬워졌다 — BALANCE)
  const tier = owner !== null && owner === r.player ? ((r.tier ?? 1) > 1 ? P.realm.tierFocus * ((r.tier ?? 1) - 1) : (r.tier ?? 1) < 1 ? -P.realm.easyFocus : 0) : 0
  return pledged + lead + tier + lure + (allyFoe(r, faction, owner) ? P.realm.aiAllyFocus : 0)
}

/** 소도 제사 — 허락되고 군량 aiDraftReserve 계절치를 남기고도 제사 곡식이 남으면 */
function rites(r: Realm, faction: string): Order[] {
  if (!riteAllowed(r, faction)) return []
  const spare = stockOf(r, faction).grain - P.realm.aiDraftReserve * upkeepOf(r, faction, true)
  const c = riteCost(r, faction)
  return spare >= c.grain && stockOf(r, faction).iron >= c.iron ? [{ kind: 'rite', faction }] : []
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
  // 길과 때 — 숨기 좋은 길로 성 뒤 고을을 칠 때는 기습이 수다 (예전엔 AI 가 기습을 거의 안 했다)
  const walledGood = t.hostile && t.walled && t.conceal === 'good' && t.ambushP >= P.realm.aiAmbushWalled
  const ambush = walledGood || (amb !== null && t.win !== null ? amb > t.win[0] : t.ambushP >= P.realm.aiAmbushWorth)
  return { kind: 'march', army: a.id, edge: t.edge.id, ambush }
}

/**
 * 초반 유예 (SYSTEMS §9-1 의 "긴장도는 국력을 따른다"가 R4 에서 이 자리를 갖는다) — 판 첫 aiGrace 계절에는
 * 남의 나라가 플레이어 땅에 들어오지 않는다. 작은 나라는 아직 눈에 안 띈다: 이웃끼리 먼저 다투고,
 * 우리는 그 사이에 정찰하고 자리를 잡는다. **먼저 친 나라에는 유예가 없다** (realm.provoked).
 * 승률 문턱으로는 못 막는다 — 빈 읍락은 승률 100% 다 (봇 대전: 잃은 땅의 7할이 싸움 없이 빈 고을이었다).
 */
/** 2장 동부여의 추격 — 이 계절에 대소의 군대가 주몽을 쫓고 있나 */
export function pursuing(r: Realm, faction: string): boolean {
  return r.scenario?.id === 'jumong' && faction === 'buyeo' && r.season < P.realm.pursuitSeasons
}

export function spared(r: Realm, faction: string, to: string): boolean {
  const owner = r.nodes[to]?.owner
  if (owner === null || owner === undefined || owner === faction) return false
  // 화친·동맹을 맺은 나라는 치지 않는다 (FLOW §4)
  if (friendly(r, faction, owner)) return true
  if (r.factions[owner]?.mind !== 'player' || r.season >= P.realm.aiGrace) return false
  // 2장 동부여의 추격군 — 주몽을 쫓아 첫 몇 계절은 유예 없이 내려온다 (CAMPAIGN §1 · 점검 10-25)
  if (pursuing(r, faction)) return false
  return !(r.provoked ?? []).includes(faction)
}

/**
 * 징병 (FLOW §2) — 가을·겨울에만 (봄 징병은 농사를 깎는다). 곡식은 aiDraftReserve 계절치 군량을 남긴다.
 * 국읍과 제 군대가 쉬는 고을에서, 나라 군사의 병종 비가 **제 결의 비**(data/armymix.ts · CUSTOMS §8-3 S0)에서 가장 모자란 쪽을 뽑는다.
 * 그 고을에서 못 뽑는 병종(수군은 포구에서만)은 건너뛴다. 말·배가 모자라 기병·수군을 조금만 뽑을 수 있으면
 * 그만큼만(aiDraftGoodsMin 이상일 때) 뽑고 나머지는 다음으로 모자란 병종으로 채운다 — 말 없는 기병은 없다.
 * 봇도 같은 셈으로 뽑는다 — 봇 대전이 공정하려고.
 */
function drafts(r: Realm, faction: string): Order[] {
  const R = P.realm
  const s = seasonOf(r.season)
  if (s !== 'autumn' && s !== 'winter') return []
  const fac = r.factions[faction]
  if (fac === undefined) return []
  // 풍습이 바꾸는 비 — 쇠뇌(골벌) · 뱃길(땅) (data/armymix.ts)
  const goal = R.aiKyeolMix >= 0.5 ? mixOf(faction, (id) => hasCustom(r, faction, id)) : BASE_MIX
  const men = menOf(r, faction)
  let spare = stockOf(r, faction).grain - R.aiDraftReserve * upkeepOf(r, faction, true)
  // 덩이쇠(변한) — 곡식이 모자라면 쇠로 낸다. 무장 몫(aiIronKeep)을 남긴 쇠만 (economy.deongiMen 과 같은 값)
  // 덩이쇠(변한) — 징병값의 몫을 쇠로 낸다. 판정과 같은 나눔(economy.deongiSplit)으로 창고를 따라가며, 무장 몫(aiIronKeep) 위의 쇠만 사람으로 친다
  const deongi = hasCustom(r, faction, 'deongisoe') && R.deongiIron > 0
  let gStock = Math.max(0, stockOf(r, faction).grain)
  let iStock = Math.max(0, stockOf(r, faction).iron)
  const ironMen = (): number => (deongi ? Math.min(deongiMen(r, faction), Math.floor(Math.max(0, iStock - R.aiIronKeep) / R.deongiIron)) : 0)
  // 말과 배 나무 · 쇠뇌 틀과 쇠 — 이번 계절에 뽑은 만큼 줄여 가며 (draftNeeds)
  let horses = goodOf(stockOf(r, faction), 'horse')
  let wood = goodOf(stockOf(r, faction), 'wood')
  let bolts = sonoeRoom(r, faction)
  let iron = stockOf(r, faction).iron - R.aiIronKeep
  // 뱃길(땅) — 배 나무가 덜 든다 (economy.draftNeeds 와 같은 배수)
  const boatPer = R.boatWood * (hasCustom(r, faction, 'landPort') ? R.landPortBoat : 1)
  const goodsCap = (k: UnitKind): number =>
    k === 'horse' && R.horsePerRider > 0 ? Math.floor(horses / R.horsePerRider) : k === 'boat' && boatPer > 0 ? Math.floor(wood / boatPer)
      : k === 'crossbow' ? Math.max(0, Math.min(bolts, R.sonoeIron > 0 ? Math.floor(iron / R.sonoeIron) : Infinity)) : Infinity
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
    const nd = r.nodes[node]
    if (nd?.owner !== faction) continue
    const grainMen = Math.floor(spare / Math.max(1e-9, R.draftGrain))
    const n = Math.min(draftLimit(r, faction, node), room, grainMen + ironMen())
    if (n < R.splitMin) continue
    const total = men + took
    const kinds = draftable(nd, r, faction)
    // 여기서 뽑을 수 있는 병종만 — 말·배가 모자라 못 뽑는 몫은 남은 병종에 비대로 나눈다 (아니면 가장 작은 몫이 넘친다)
    let ok = goal.filter(([k]) => kinds.includes(k) && Math.min(n, goodsCap(k)) >= Math.min(n, R.aiDraftGoodsMin))
    // 쇠뇌 틀이 다 찼으면 쇠뇌 몫은 활로 돌린다 (쇠뇌는 활 몫에서 떼어 온 것 — armymix.mixOf)
    const xb = goal.find(([k]) => k === 'crossbow')
    if (xb !== undefined && !ok.some(([k]) => k === 'crossbow')) ok = ok.map(([k, w]) => [k, k === 'bow' ? w + xb[1] : w] as const)
    const W = ok.reduce((a, [, w]) => a + w, 0)
    // 모자란 차례 — 같으면 비 표의 차례 (sort 는 안정적이다)
    const want = ok.map(([k, w]) => ({ k, need: (w / W) * (total + n) - (have[k] ?? 0) })).sort((a, b) => b.need - a.need)
    let left = n
    for (const { k } of want) {
      const m = Math.min(left, goodsCap(k))
      // 말·배가 모자라 일부만 — 너무 적으면 건너뛴다. 나머지는 같은 군대에 든다 (뒤 징병의 고을 몫이 1 모자랄 수 있어 하나 덜)
      if (m < left && m < R.aiDraftGoodsMin) continue
      out.push({ kind: 'draft', faction, node, unit: k, n: m })
      have[k] = (have[k] ?? 0) + m
      const need = draftNeeds(k, m, r, faction)
      horses -= need.horse
      wood -= need.wood
      if (k === 'crossbow') bolts -= m
      iron -= need.iron
      iStock -= need.iron
      // 곡식으로 못 낸 몫은 덩이쇠로 (economy.draftPay)
      if (deongi) {
        const sp = deongiSplit(gStock, iStock, m)
        const g = draftCost(sp.grainMen).grain
        gStock -= g
        iStock -= sp.ironMen * R.deongiIron
        iron -= sp.ironMen * R.deongiIron
        spare -= g
      } else spare -= draftCost(m).grain
      room -= m
      took += m
      left = m < left ? left - m - 1 : 0
      if (left < 1) break
    }
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
  const idle = (): Army[] => sorted(Object.values(p.armies)).filter((a) => a.faction === faction && a.march === null && a.lent === undefined)
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
/** 자객의 활 올리기 — aiBowUpChance 로 드물게, 노릴 적장이 보이고 군량 aiDraftReserve 계절치를 남기고도 값을 낼 때 */
function bows(r: Realm, faction: string): Order[] {
  if (roll(r.seed, r.season, `ai-bow:${faction}`) >= P.realm.aiBowUpChance) return []
  const c = bowUpCost(r, faction)
  if (c === null || plotTargets(r, faction, 'assassin').length === 0) return []
  const st = stockOf(r, faction)
  if (st.grain - P.realm.aiDraftReserve * upkeepOf(r, faction, true) < c.grain || st.iron - P.realm.aiIronKeep < c.iron) return []
  return [{ kind: 'bowUp', faction }]
}

function plots(r: Realm, faction: string, brain: Brain): Order[] {
  if (roll(r.seed, r.season, `ai-plot:${faction}`) >= P.realm.aiPlotChance) return []
  const foes = sorted(Object.values(r.factions))
    .filter((f) => f.id !== faction && knows(r, faction, f.id) && !friendly(r, faction, f.id) && Object.values(r.nodes).some((n) => n.owner === f.id))
    .map((f) => ({ id: f.id, war: relationOf(r, faction, f.id).state === 'war', power: nationPower(r, f.id) }))
    .sort((a, b) => (a.war !== b.war ? (a.war ? -1 : 1) : b.power - a.power))
  const target = foes[0]?.id
  if (target === undefined) return []
  const pickOp = roll(r.seed, r.season, `ai-plot-op:${faction}`) < 0.5
  // 암살 — 본 장수가 있으면 가끔 (자객은 지략 높은 혼자 있는 장수, 없으면 고용 자객)
  const marks = plotTargets(r, faction, 'assassin').filter((t) => t.target === target)
  if (marks.length > 0 && roll(r.seed, r.season, `ai-assassin:${faction}`) < P.realm.aiAssassinChance) {
    // 자객 기본 · 장수는 도박 — 명궁이거나 지략이 아주 높은 장수만 보내고, 아니면 고용 자객 (잃어도 값뿐이다)
    const agent = plotAgents(r, faction).filter((id) => hasTrait(r.heroes[id], 'archer') || r.heroes[id]!.ryak >= P.realm.aiAgentRyak)
      .sort((a, b) => (r.heroes[b]!.ryak - r.heroes[a]!.ryak) || (a < b ? -1 : 1))[0]
    const c = plotCost('assassin', agent ?? null)
    if (stockOf(r, faction).grain - P.realm.aiDraftReserve * upkeepOf(r, faction, true) >= c.grain) {
      const m = marks[0]!
      return [{ kind: 'plot', faction, op: 'assassin', target, hero: m.hero!, ...(agent !== undefined ? { agent } : {}) }]
    }
  }
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

/**
 * AI 끼리의 사신 — 까닭이 있을 때만 (stance.ts). 까닭이 있으면 aiEnvoyChance 로 꺼낸다.
 * 밀리거나 굶으면 화친이 가장 급하고, 같은 적·앞서가는 나라가 있으면 동맹, 동맹에게는 함께 치자.
 */
function envoys(r: Realm, faction: string): Order[] {
  if (roll(r.seed, r.season, `ai-envoy:${faction}`) >= P.realm.aiEnvoyChance) return []
  let best: { to: string; ask: EnvoyAsk; w: number; target?: string; why?: Why; about?: string } | null = null
  for (const f of sorted(Object.values(r.factions))) {
    if (f.id === faction || f.mind === 'player' || !knows(r, faction, f.id) || !Object.values(r.nodes).some((n) => n.owner === f.id)) continue
    const rel = relationOf(r, faction, f.id).state
    let c: { ask: EnvoyAsk; w: number; target?: string; why?: Why; about?: string } | null = null
    const tw = truceWhy(r, faction, f.id)
    const aw = allianceWhy(r, faction, f.id)
    if (tw !== null) c = { ask: 'truce', w: tw.why === 'losing' || tw.why === 'hungry' ? 3 : 2, ...tw }
    else if (aw !== null) c = { ask: 'alliance', w: aw.why === 'favor' ? 1.2 : 1.5, ...aw }
    else if (rel === 'ally' && roll(r.seed, r.season, `ai-joint:${faction}:${f.id}`) < P.realm.aiJointChance) {
      // 동맹에게 함께 치자 — 우리가 싸우는 적의 고을 가운데 동맹이 닿는 곳
      const ts = jointTargets(r, faction, f.id).filter((n) => relationOf(r, faction, r.nodes[n]!.owner!).state === 'war')
      if (ts.length > 0) c = { ask: 'joint', w: 1.2, target: ts[0]!, why: 'commonFoe', about: r.nodes[ts[0]!]!.owner! }
    }
    // 줄타기(사벌) — 까닭이 없어도 가장 센 두 나라에는 손을 내민다: 싸우면 화친, 중립이면 화친, 화친이면 동맹 (data/customs.ts)
    if (c === null && hasCustom(r, faction, 'julta') && rel !== 'ally' && bigTwo(r, faction).includes(f.id)) c = { ask: rel === 'truce' ? 'alliance' : 'truce', w: 1.4, why: 'between' }
    if (c !== null && !envoyOptions(r, faction, f.id).includes(c.ask)) c = null
    if (c !== null && (best === null || c.w > best.w)) best = { to: f.id, ...c }
  }
  // 할 말이 없으면 — 신중한 나라는 맞닿은 센 이웃의 마음부터 산다(선물), 그다음 맞바꿈, 그다음 아무 선물
  if (best === null) return favorGift(r, faction) ?? trades(r, faction) ?? gifts(r, faction)
  const { to, ask, target, why, about } = best
  const hero = escortFor(r, faction, ask)
  return [{
    kind: 'envoy', from: faction, to, ask, give: { grain: 0, iron: 0 }, take: { grain: 0, iron: 0 },
    ...(target !== undefined ? { target } : {}), ...(why !== undefined ? { why } : {}), ...(about !== undefined ? { about } : {}),
    ...(hero !== null ? { hero } : {}),
  }]
}

/**
 * 맞바꿈 — 할 말이 없을 때, 제게 모자란 것을 넉넉히 가진 이웃에게 남는 것을 내고 바꾼다 (diplomacy.tradeOffer · 형: "자원들도 다각화").
 * 플레이어에게는 사신이 아니라 청으로 간다(makeAsks) — 여기서는 AI 끼리만. 없으면 null
 */
function trades(r: Realm, faction: string): Order[] | null {
  for (const f of sorted(Object.values(r.factions))) {
    if (f.id === faction || f.mind === 'player' || !knows(r, faction, f.id) || !Object.values(r.nodes).some((n) => n.owner === f.id)) continue
    if (!envoyOptions(r, faction, f.id).includes('trade')) continue
    const t = tradeOffer(r, faction, f.id)
    if (t === null) continue
    const hero = escortFor(r, faction, 'trade')
    return [{ kind: 'envoy', from: faction, to: f.id, ask: 'trade', give: t.give, take: t.take, why: 'surplus', ...(hero !== null ? { hero } : {}) }]
  }
  return null
}

/**
 * 사신에 딸려 보낼 장수 — 노는 우리 장수 가운데 그 사신에 맞는 이 (교역이면 장사꾼, 아니면 매혹, 아니면 매력 높은 이).
 * 매력 6 아래면 안 보낸다. aiEnvoyHero 로 가끔
 */
function escortFor(r: Realm, faction: string, ask: EnvoyAsk): string | null {
  if (roll(r.seed, r.season, `ai-escort:${faction}`) >= P.realm.aiEnvoyHero) return null
  const score = (h: Hero): number => (ask === 'trade' && hasTrait(h, 'trader') ? 20 : 0) + (hasTrait(h, 'charm') ? 10 : 0) + h.deok
  const best = sorted(Object.values(r.heroes)).filter((h) => canEscort(r, faction, h.id))
    .sort((a, b) => score(b) - score(a) || (a.id < b.id ? -1 : 1))[0]
  return best !== undefined && score(best) >= 6 ? best.id : null
}

/**
 * 짓기 (나무의 쓰임) — 나무가 넉넉하면 남의 땅과 맞닿은 고을부터 목책, 목책이 있으면 해자. 한 계절에 하나.
 * 군량 aiDraftReserve 계절치를 남긴다
 */
function builds(r: Realm, faction: string): Order[] {
  const spare = stockOf(r, faction).grain - P.realm.aiDraftReserve * upkeepOf(r, faction, true)
  const front = (id: string): boolean => neighbors(r, id).some((x) => { const o = r.nodes[x]?.owner; return o !== null && o !== undefined && o !== faction })
  const mine = sorted(Object.values(r.nodes)).filter((n) => n.owner === faction && n.kind !== 'sodo' && !(n.kind === 'wild' && n.hh <= 0))
    .sort((a, b) => (front(b.id) ? 1 : 0) - (front(a.id) ? 1 : 0) || b.hh - a.hh || (a.id < b.id ? -1 : 1))
  for (const n of mine) {
    const what = nextBuild(r, n.id)
    if (what === null || !canBuild(r, faction, n.id, what) || buildCost(what, r, faction).grain > spare) continue
    return [{ kind: 'build', faction, node: n.id, what }]
  }
  return []
}

/**
 * 약조를 깬다 (형: "동맹국도 우릴 배신할수 있고 적국도 아군이 되기도 하는 … 근거가 있게") — 까닭이 있을 때 aiBreakChance 로.
 * 상대가 앞서가는 나라가 됐거나(너무 커졌다), 탐욕스러운 나라에게 상대가 만만해 보일 때. 플레이어도 든다 — 깨면 통보가 간다.
 * 깨면 다음 계절부터 칠 수 있다 (spared) — 한 계절의 말미가 플레이어에게는 경고다.
 */
function breaks(r: Realm, faction: string): Order[] {
  for (const f of sorted(Object.values(r.factions))) {
    if (f.id === faction || !knows(r, faction, f.id)) continue
    const m = breakWhy(r, faction, f.id)
    if (m === null || roll(r.seed, r.season, `ai-break:${faction}:${f.id}`) >= P.realm.aiBreakChance) continue
    return [{ kind: 'envoy', from: faction, to: f.id, ask: 'break', give: { grain: 0, iron: 0 }, take: { grain: 0, iron: 0 }, why: m.why, ...(m.about !== undefined ? { about: m.about } : {}) }]
  }
  return []
}

/** 선물 — 할 말이 없을 때 신중(과 계획가)은 곡식이 남으면 가장 센 이웃 나라에 선물을 보낸다 (호감을 산다) */
function gifts(r: Realm, faction: string): Order[] {
  const R = P.realm
  const mind = r.factions[faction]?.mind
  if (mind !== 'cautious' && mind !== 'player') return []
  const spare = stockOf(r, faction).grain - (R.aiDraftReserve + 1) * upkeepOf(r, faction, true)
  const grain = Math.floor(Math.min(60, spare * 0.15) / 10) * 10
  if (grain < 20) return []
  const target = sorted(Object.values(r.factions))
    .filter((f) => f.id !== faction && knows(r, faction, f.id) && f.mind !== 'player' && relationOf(r, faction, f.id).state !== 'ally' && Object.values(r.nodes).some((n) => n.owner === f.id))
    .sort((a, b) => nationPower(r, b.id) - nationPower(r, a.id))[0]
  return target === undefined ? [] : [{ kind: 'envoy', from: faction, to: target.id, ask: 'gift', give: { grain, iron: 0 }, take: { grain: 0, iron: 0 } }]
}

/**
 * 호감을 사는 선물 (형: "외교가 좀 재미없음" · 맞바꿈이 먼저가 되며 AI 선물이 0 이 됐었다) — 신중한 나라가
 * 길로 맞닿고 제 눈에 더 센 이웃, 그리고 아직 가깝지 않은(호감 < aiGiftFavor) 나라에게. 싸우는 나라에는 안 보낸다.
 * 힘은 제 정보로 본다 (정보의 계약 — diplomacy.powerRange 가운데). 곡식은 군량 한 계절치를 더 남긴다
 */
function favorGift(r: Realm, faction: string): Order[] | null {
  const R = P.realm
  if (r.factions[faction]?.mind !== 'cautious') return null
  const spare = stockOf(r, faction).grain - (R.aiDraftReserve + 1) * upkeepOf(r, faction, true)
  const grain = Math.floor(Math.min(R.aiGiftMax, spare * 0.15) / 10) * 10
  if (grain < 20) return null
  const me = nationPower(r, faction)
  const seen = (f: string): number => { const [lo, hi] = powerRange(r, faction, f); return (lo + hi) / 2 }
  const target = sorted(Object.values(r.factions))
    .filter((f) => f.id !== faction && f.mind !== 'player' && Object.values(r.nodes).some((n) => n.owner === f.id))
    .filter((f) => relationOf(r, faction, f.id).state !== 'war' && favorOf(r, faction, f.id) < R.aiGiftFavor && borders(r, faction, f.id) && seen(f.id) > me)
    .sort((a, b) => seen(b.id) - seen(a.id) || (a.id < b.id ? -1 : 1))[0]
  return target === undefined ? null : [{ kind: 'envoy', from: faction, to: target.id, ask: 'gift', give: { grain, iron: 0 }, take: { grain: 0, iron: 0 } }]
}

/** 빌려준 군대 — 지킬 고을까지 한 길씩 간다 (diplomacy.lentStep). 닿으면 머문다 */
function lentMoves(r: Realm, faction: string): Order[] {
  const out: Order[] = []
  for (const a of sorted(Object.values(r.armies))) {
    if (a.faction !== faction || a.lent === undefined || a.march !== null) continue
    const s = lentStep(r, a.id)
    if (s !== null) out.push({ kind: 'march', army: a.id, edge: s.edge, ambush: false })
  }
  return out
}

/**
 * 무장 올리기 (철의 쓰임) — 철이 넉넉하면 집에 쉬는 가장 큰 군대의 장비를 한 단계. 철을 aiIronKeep 남긴다.
 * 무작위는 안 한다.
 */
function arms(r: Realm, faction: string): Order[] {
  const s = stockOf(r, faction)
  const spareGrain = s.grain - P.realm.aiDraftReserve * upkeepOf(r, faction, true)
  const big = sorted(Object.values(r.armies))
    .filter((a) => a.faction === faction && a.march === null && a.lent === undefined)
    .sort((x, y) => Object.values(y.mix).reduce((t, v) => t + (v ?? 0), 0) - Object.values(x.mix).reduce((t, v) => t + (v ?? 0), 0))
  // 병종마다 — 궁수(촉이 곧 힘) · 창병 · 방패병 · 그 밖 순으로, 가장 큰 군대부터 낼 수 있는 첫 것
  for (const a of big) {
    for (const unit of ARM_ORDER) {
      if ((a.mix[unit] ?? 0) <= 0) continue
      const c = armCost(r, a.id, unit)
      if (c !== null && c.iron + P.realm.aiIronKeep <= s.iron && c.grain <= spareGrain) return [{ kind: 'arm', army: a.id, unit }]
    }
  }
  return []
}

const ARM_ORDER: readonly UnitKind[] = ['bow', 'spear', 'shield', 'pike', 'horse', 'crossbow', 'boat']


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
      case 'trade':
        // 제게 없는 것은 더 쳐 준다 (economy.goodsWorth)
        yes = goodsWorth(a.give, r, faction) >= goodsWorth(a.take) * 0.9
        break
      case 'demand':
        yes = nationPower(r, a.from) >= R.askDemandPower * nationPower(r, faction)
        break
      case 'aid':
        // 동맹이 곡식을 보태 달란다 — 군량을 남기고도 낼 수 있으면
        yes = stockOf(r, faction).grain - a.take.grain >= R.aiDraftReserve * upkeepOf(r, faction, true)
        break
      default:
        yes = true
    }
    out.push({ kind: 'answer', ask: a.id, yes })
  }
  return out
}

/**
 * 장수 (HEROES §3·§4) — 혼자 머무는 장수는 같은 고을의 장수 없는 군대를 이끌거나(싸움꾼: 무예+통솔 ≥ 내정+매력) 그 고을을 맡는다.
 * 포로는 매력이 가장 높은 장수에게 회유를 맡기고, 제 고을에 온 떠돌이는 들인다 — 둘 다 군량 aiHireReserve 계절치를 남기고.
 */
function heroCare(r: Realm, faction: string): Order[] {
  const R = P.realm
  // 플레이어의 재상과 같은 셈 (heroes.idleHeroOrders) — 둘이 따로 놀지 않게
  const out: Order[] = idleHeroOrders(r, faction)
  const mine = sorted(Object.values(r.heroes)).filter((h) => h.faction === faction && h.status === 'free')
  let spare = stockOf(r, faction).grain - R.aiHireReserve * upkeepOf(r, faction, true)
  const by = [...mine].sort((a, b) => b.deok - a.deok || (a.id < b.id ? -1 : 1))[0]?.id ?? null
  for (const h of sorted(Object.values(r.heroes))) {
    if (h.status !== 'captive' || h.captor !== faction || h.persuade !== undefined) continue
    const cost = R.persuadeGrain * persuadeSeasons(r, h.id, by)
    if (spare < cost) break
    spare -= cost
    out.push({ kind: 'persuade', hero: h.id, by })
  }
  for (const w of wanderersFor(r, faction)) {
    if (spare < w.price) continue
    spare -= w.price
    out.push({ kind: 'hire', faction, hero: w.hero.id })
  }
  return out
}

/**
 * 한 세력의 이번 계절 명령 — 징병(가을·겨울) · 개척(봄·가을) · 소도 제사(봄·가을) · 군대의 움직임.
 * 무모·무작위 봇은 개척하지 않고, 무작위는 제사도 안 지낸다. 제사는 징병·개척으로 곡식을 쓴 뒤의 창고로 셈한다 (판정도 그 순서다)
 */
export function decide(r: Realm, faction: string, brain: Brain): Order[] {
  return withMemo(r, () => decideNow(r, faction, brain))
}

function decideNow(r: Realm, faction: string, brain: Brain): Order[] {
  // 정한 명령까지 해 본 판 — 사본 하나를 만들어 정한 만큼 얹어 간다 (예전엔 단계마다 r 에서 새로 베꼈다. 결과는 같다)
  let q: Realm | null = null
  let applied = 0
  const upTo = (os: readonly Order[]): Realm => {
    if (os.length === 0 && q === null) return r
    if (q === null) q = planned(r, os)
    else extendPlan(q, os.slice(applied))
    applied = os.length
    return q
  }
  const ds = drafts(r, faction)
  const ss = brain === 'reckless' || brain === 'random' ? [] : settles(upTo(ds), faction)
  const rs = brain === 'random' ? [] : rites(upTo([...ds, ...ss]), faction)
  const first = [...ds, ...ss, ...rs]
  const gs = brain === 'random' || brain === 'reckless' ? [] : guards(upTo(first), faction)
  const talk = brain === 'random' ? [] : [...answers(r, faction), ...breaks(r, faction), ...envoys(r, faction)]
  const bs = brain === 'random' ? [] : builds(r, faction)
  // 공작은 징병·개척·제사·경계로 곡식을 쓴 뒤의 창고로 셈한다 (판정도 그 뒤다 — 2단계)
  const ps = brain === 'random' ? [] : plots(upTo([...first, ...gs]), faction, brain)
  const hs = brain === 'random' ? [] : heroCare(r, faction)
  const as = brain === 'random' ? [] : arms(r, faction)
  // 자객의 활 — 공작을 안 벌이는 계절에 드물게 (값이 크다)
  const bw = brain === 'random' || ps.length > 0 ? [] : bows(r, faction)
  return [...talk, ...first, ...gs, ...ps, ...bw, ...hs, ...as, ...bs, ...lentMoves(r, faction), ...(brain === 'planner' ? plan(r, faction) : moves(r, faction, brain))]
}

function moves(r: Realm, faction: string, brain: Brain): Order[] {
  const R = P.realm
  const orders: Order[] = []
  const armies = sorted(Object.values(r.armies)).filter((a) => a.faction === faction && a.march === null && a.lent === undefined) // 빌려준 군대는 lentMoves
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

  /**
   * 별동대 (형이 고름: 기습은 "길과 때의 싸움") — 큰 군대는 숨지 못한다. 그래서 칠 데를 못 찾은 군대는 작은 무리만 떼어
   * ① 숨기 좋은(또는 그저 그런) 길로 성 뒤 고을을 기습하거나 ② 지키는 이 없는 마을을 줍는다. 본대(장수)는 집에 남는다.
   * 한 나라가 한 계절에 하나만. 군대 상한에 한 자리를 남긴다.
   */
  let raided = false
  const raid = (a: Army): boolean => {
    if (raided || brain === 'random') return false
    const mine = Object.values(p.armies).filter((x) => x.faction === faction).length
    if (mine >= R.armyMax - 1) return false
    const n = Object.values(a.mix).reduce((s, v) => s + (v ?? 0), 0)
    const keep = lastGuard(p, faction, a) ? Math.max(R.aiGuardMin, R.splitMin) : R.splitMin
    const size = Math.min(R.ambushFreeMen, Math.floor(n * R.aiRaidShare), n - keep)
    if (size < R.splitMin) return false
    const take: Partial<Record<UnitKind, number>> = {}
    let got = 0
    for (const [k, v] of (Object.entries(a.mix) as Array<[UnitKind, number]>).sort((x, y) => (x[0] < y[0] ? -1 : 1))) {
      const t = Math.floor((v * size) / n)
      if (t > 0) {
        take[k] = t
        got += t
      }
    }
    if (got < R.splitMin) return false
    // 장수 없이 먼저 본다. 기습은 장수의 지략을 크게 타니, 모자라면 장수가 별동대를 이끌고 간다 (본대는 장수 없이 남는다)
    for (const withHero of a.hero !== null ? [false, true] : [false]) {
      const go = pickRaid(a, take, withHero)
      if (go === null) continue
      const id = newArmyId(p, faction)
      const o: Order = { kind: 'split', army: a.id, id, take, hero: withHero }
      const next = planned(p, [o])
      if (next.armies[id] === undefined) return false
      orders.push(o, { kind: 'march', army: id, edge: go.t.edge.id, ambush: go.ambush })
      p = next
      raided = true
      return true
    }
    return false
  }
  const pickRaid = (a: Army, take: Partial<Record<UnitKind, number>>, withHero: boolean): { t: Move; ambush: boolean } | null => {
    const det: Army = { ...a, mix: take, hero: withHero ? a.hero : null }
    delete (det as { kit?: unknown }).kit // 떼어 낸 몫의 무장은 본대와 같은 비로 본다 (kit.kitOf)
    let best: { t: Move; v: number; ambush: boolean } | null = null
    // 도읍은 별동대로 노리지 않는다 — 본대가 친다 (봇 대전: 겨울 들길로 숨어 든 작은 무리가 도읍 하나뿐인 거칠산을 무너뜨려 짐 9% → 21%)
    const capitals = new Set(Object.values(p.factions).map((f) => f.capital))
    for (const t of movesOf(p, faction, det)) {
      if (!t.hostile || t.blocked !== null || spared(p, faction, t.to) || t.win === null || capitals.has(t.to)) continue
      let c: { v: number; ambush: boolean } | null = null
      // 성 뒤 기습은 도박이다 — 먹히면 거의 이기는 판(성·장정을 건너뛴다)이고, 숨어 닿을 가늠이 aiRaidP 는 돼야 건다. 잃어도 작은 무리다
      if (t.walled && t.conceal !== 'poor' && t.winAmbush !== null && t.winAmbush[0] >= R.aiRaidWin && t.ambushP >= R.aiRaidP) {
        c = { v: t.ambushP * t.winAmbush[0], ambush: true }
      }
      else if (!t.walled && t.win[0] >= R.aiRaidEasy) c = { v: t.win[0], ambush: false }
      if (c === null) continue
      const v = c.v + focus(p, faction, t.to)
      if (best === null || v > best.v) best = { t, v, ambush: c.ambush }
    }
    return best === null ? null : { t: best.t, ambush: best.ambush }
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
      if (!went) went = raid(a)
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
    if (raid(a)) continue
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
  // 나라마다 따로 셈해도 판은 하나다 — 힘·앞서가는 나라는 한 번만 (memo.ts)
  return withMemo(r, () => {
    const out: Order[] = []
    const player = r.player
    for (const [i, f] of sorted(Object.values(r.factions)).entries()) {
      if (f.mind === 'player') continue
      // 배우는 판 — 상대는 먼저 치지 않는다. 청에만 답한다
      if (r.region === 'tutorial') {
        out.push(...answers(r, f.id))
        continue
      }
      // 넓어지는 지도 (삼한 남부 판) — 플레이어가 아직 모르는 먼 나라는 가볍게 굴린다: aiFarEvery 계절에 한 번만 다 생각하고,
      // 나머지 계절은 청에 답하고 징병만 한다 (나라가 서른여섯이라 폰에서 버티려고). 발견이 없는 판은 늘 다 생각한다
      const far = r.known !== undefined && player !== undefined && !knows(r, player, f.id)
      const every = r.region === 'world' ? P.realm.aiFarEveryWorld : P.realm.aiFarEvery
      if (far && (r.season + i) % every !== 0) {
        out.push(...answers(r, f.id), ...drafts(r, f.id))
        continue
      }
      // 사신·공작은 보낼 사람만큼만 낸다 (hands.ts — 엔진도 같은 규칙으로 버린다)
      const mine = limitHands(r, decide(r, f.id, f.mind))
      out.push(...mine, ...approach(r, f.id, mine))
    }
    return out
  })
}

/**
 * 다가가기 — 바로 옆에 칠 곳이 없으면 빈 땅을 지나 가장 가까운 남의 고을 쪽으로 한 길 간다.
 * 자유판은 모든 나라가 도읍 하나로, 사이가 빈 땅이다 (regions/rivals.ts) — 옆만 보던 AI 는 40계절 내내 제 도읍에 앉아 있었다.
 * aiApproachFrom 계절부터 · 도읍엔 군대 하나를 남긴다 (군대가 하나뿐이면 aiApproachSolo 계절부터 그 하나로).
 */
function approach(r: Realm, faction: string, decided: readonly Order[]): Order[] {
  const R = P.realm
  if (r.season < R.aiApproachFrom) return []
  const busy = new Set(decided.flatMap((o) => ('army' in o && typeof o.army === 'string' ? [o.army] : [])))
  const cap = r.factions[faction]?.capital
  const mine = sorted(Object.values(r.armies)).filter((a) => a.faction === faction && a.lent === undefined)
  const idle = mine.filter((a) => a.march === null && !busy.has(a.id))
  const edges = Object.values(r.edges).sort((a, b) => (a.id < b.id ? -1 : 1))
  const passable = (id: string): boolean => {
    const n = r.nodes[id]
    return n !== undefined && n.kind !== 'sodo' && (n.owner === faction || (n.owner === null && n.kind === 'wild'))
  }
  const goal = (id: string): boolean => {
    const n = r.nodes[id]
    return n !== undefined && n.kind !== 'sodo' && n.owner !== faction && !(n.owner === null && n.kind === 'wild') && !spared(r, faction, id)
  }
  const out: Order[] = []
  let atCap = cap === undefined ? 0 : mine.filter((a) => a.at === cap && a.march === null).length
  for (const a of idle) {
    if (a.at === cap && atCap <= 1 && (mine.length > 1 || r.season < R.aiApproachSolo)) continue
    // 너비 우선 — 처음 디딘 길을 기억한다 (같은 판이면 같은 길: 길 id 순)
    const first = new Map<string, string>([[a.at, '']])
    let queue = [a.at]
    let step: string | null = null
    for (let d = 0; d < R.aiApproachDepth && step === null && queue.length > 0; d++) {
      const next: string[] = []
      for (const at of queue) {
        for (const ed of edges) {
          const to = ed.a === at ? ed.b : ed.b === at ? ed.a : null
          if (to === null || first.has(to)) continue
          const via = first.get(at) === '' ? ed.id : first.get(at)!
          if (goal(to)) { step = d === 0 ? null : via; if (d > 0) break; else continue }
          if (!passable(to)) continue
          first.set(to, via)
          next.push(to)
        }
        if (step !== null) break
      }
      queue = next
    }
    if (step === null) continue
    out.push({ kind: 'march', army: a.id, edge: step, ambush: false })
    if (a.at === cap) atCap -= 1
  }
  return out
}
