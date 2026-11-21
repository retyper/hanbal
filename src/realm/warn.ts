/**
 * 우리 고을로 오는 적의 예고 (FIRST-HOUR-20261122 TOP 1) — 이번 달 끝에 우리 고을을 칠 적(채비를 마친 군대 · 다음 달 닿는 행군)과
 * 그 싸움의 지킬 가망, 그리고 누르면 바로 할 수 있는 답 하나(이번 달 안에 닿는 우리 군대를 보낸다).
 *
 * 화면(ui/realm/threatwarn.ts)과 시험 도구(tools/persona-test.ts --answer)가 같은 셈을 쓴다. 판을 바꾸지 않는다 (A1).
 * 확률은 ODDS 대로 — 저들의 군사는 범위(파수의 흐림: 참값을 품고 가운데를 비튼다 · intel.sight 와 같은 꼴), 지킬 가망도 그 끝에서 끝까지의 범위 %.
 * 셈은 판정과 같다(season.frontOdds — 정면으로 칠 때). 기습이 먹히면 더 나쁘다 — 그것은 낌새(기습 낌새 표)의 몫이다.
 */
import { roll } from '../core/rng.ts'
import { P } from '../tune/params.ts'
import { strikeLive } from './ai.ts'
import { headcount } from './battle.ts'
import { blockedWhy } from './calendar.ts'
import { forceOf, frontOdds, marchCut, marchTurns, otherEnd, seenMarches } from './season.ts'
import type { Army, REdge, Realm } from './types.ts'

type Range = readonly [number, number]

/** 누르면 바로 할 답 — 이번 달 안에 닿는 우리 군대 하나를 그 고을로 보낸다 */
export interface Send {
  readonly army: string
  readonly edge: string
  /** 보내면 지킬 가망 [아래, 위] */
  readonly hold: Range
}

export interface Threat {
  /** 노리는 우리 고을 */
  readonly to: string
  /** 치는 나라 */
  readonly foe: string
  /** 치러 오는 군대들 (앞선 것부터) */
  readonly armies: readonly string[]
  /** 앞선 군대가 지금 있는 고을 */
  readonly from: string
  /** 저들의 군사 [아래, 위] — 파수가 본 범위 */
  readonly men: Range
  /** 지금 그대로면 지킬 가망 [아래, 위] */
  readonly hold: Range
  readonly send: Send | null
}

const byId = <T extends { id: string }>(xs: Iterable<T>): T[] => [...xs].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
const mid = (x: Range): number => (x[0] + x[1]) / 2

/** 지킬 가망 범위 — 저들 힘의 끝에서 끝까지 (힘이 셀수록 가망이 준다) */
function holdRange(r: Realm, legs: readonly { army: Army; edge: REdge }[], to: string, extra: readonly Army[], lo: number, hi: number): Range {
  return [1 - frontOdds(r, legs, to, extra, hi), 1 - frontOdds(r, legs, to, extra, lo)]
}

/**
 * 이번 달 끝에 우리 고을을 칠 적 — 지킬 가망이 낮은 것부터. `sees` 는 화면이 보이는 고을인가(채비한 군대가 선 곳 · mapview.visibleNodes)
 * `busy` — 이번 달 이미 다른 명령을 받은 우리 군대 (답으로 내지 않는다)
 */
export function threatsTo(r: Realm, me: string, sees: (node: string) => boolean, busy: (army: string) => boolean = () => false): Threat[] {
  if (r.outcome != null || r.region === 'tutorial') return []
  // 노리는 고을 · 나라마다 그 군대들
  const groups = new Map<string, { to: string; foe: string; legs: { army: Army; edge: REdge }[] }>()
  const add = (a: Army, to: string, edgeId: string): void => {
    const ed = r.edges[edgeId]
    if (ed === undefined) return
    const key = `${to}|${a.faction}`
    const g = groups.get(key) ?? { to, foe: a.faction, legs: [] }
    if (!g.legs.some((x) => x.army.id === a.id)) g.legs.push({ army: a, edge: ed })
    groups.set(key, g)
  }
  for (const a of byId(Object.values(r.armies))) {
    if (a.faction === me || a.strike === undefined || r.nodes[a.strike.node]?.owner !== me || !sees(a.at) || !strikeLive(r, a)) continue
    add(a, a.strike.node, a.strike.edge)
  }
  for (const a of seenMarches(r, me)) {
    const m = a.march
    if (m === null || m.left > 1 || r.nodes[m.to]?.owner !== me) continue
    add(a, m.to, m.edge)
  }
  if (groups.size === 0) return []
  const hit = new Set([...groups.values()].map((g) => g.to))
  const s = P.realm.watchBlur
  const out: Threat[] = []
  for (const g of [...groups.values()].sort((x, y) => (x.to < y.to ? -1 : x.to > y.to ? 1 : x.foe < y.foe ? -1 : 1))) {
    // 파수의 흐림 — 참값을 품고 가운데를 비튼다 (같은 달 같은 고을이면 같은 범위)
    const u = roll(r.seed, r.season, `warn-u:${g.to}:${g.foe}`)
    const lo = 1 - s * u
    const hi = 1 + s * (1 - u)
    const n = g.legs.reduce((t, x) => t + headcount(forceOf(r, x.army)), 0)
    const hold = holdRange(r, g.legs, g.to, [], lo, hi)
    // 답 — 이번 달 안에 닿는 우리 군대 (막히지 않은 한 달 길 · 제 고을도 노려지면 빼지 않는다) 가운데 가망이 가장 오르는 것
    let send: Send | null = null
    for (const a of byId(Object.values(r.armies))) {
      if (a.faction !== me || a.march !== null || a.lent !== undefined || a.at === g.to || hit.has(a.at) || busy(a.id)) continue
      for (const ed of byId(Object.values(r.edges))) {
        if (otherEnd(ed, a.at) !== g.to || blockedWhy(ed, r) !== null) continue
        if (Math.max(1, marchTurns(r, ed) - marchCut(r, a, ed)) > 1) continue
        const h = holdRange(r, g.legs, g.to, [a], lo, hi)
        if (send === null || mid(h) > mid(send.hold)) send = { army: a.id, edge: ed.id, hold: h }
      }
    }
    if (send !== null && (mid(send.hold) < P.realm.warnSendMin || mid(send.hold) - mid(hold) < P.realm.warnSendGain)) send = null
    out.push({ to: g.to, foe: g.foe, armies: g.legs.map((x) => x.army.id), from: g.legs[0]!.army.at, men: [n * lo, n * hi], hold, send })
  }
  return out.sort((x, y) => mid(x.hold) - mid(y.hold) || (x.to < y.to ? -1 : 1))
}
