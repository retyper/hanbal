/**
 * 공작 — 몰래 하는 일 (형: "한턴에 외교나 거래나 한쪽밖에 못한다는데 말이 안돼. 다양한 외교나 공작이 가능 해야하는거 아님?" — 2026-10-18)
 *
 *   rumor 소문 — 그 나라 군대의 사기를 꺾는다
 *   sow   이간 — 두 나라 사이를 갈라 놓는다 (화친·동맹은 한 칸 내려가고, 중립은 전쟁이 될 수 있다)
 *   bribe 매수 — 그 고을 장정이 몇 계절 서지 않는다
 *   burn  방화 — 그 나라 국읍 창고의 곡식을 태운다
 *   spy   첩자 — 그 고을 군세를 몇 계절 동안 계절마다 새로 안다
 *
 * 한 나라는 한 계절에 plotsPerSeason 까지, 같은 대상에 같은 공작은 하나. 2단계(정찰·사신 자리)에서 처리한다.
 * 먹힐 확률 = 바탕 + 략 차이 × 계수 − 고을 경계(매수·첩자) → [plotMin, plotMax]. 굴림 `plot:<나라>:<op>:<대상>:<고을|상대>`.
 * 실패하면 plotCaughtOnFail, 먹혀도 plotCaughtOnSuccess 로 들킨다 — 들키면 그 나라와 한 칸 나빠진다.
 * 화면은 확률을 숫자로 안 쓴다 — plotChance 의 범위를 감으로 보인다 (정보의 계약: 모르는 장수·경계는 범위).
 */
import { roll } from '../core/rng.ts'
import { P } from '../tune/params.ts'
import { relationOf, worsen } from './diplomacy.ts'
import { stockOf } from './economy.ts'
import { alertRange } from './intel.ts'
import { nodeStrength } from './season.ts'
import type { Order, PlotOp, Realm, ReportLine } from './types.ts'

type Plot = Extract<Order, { kind: 'plot' }>

export const PLOT_OPS: readonly PlotOp[] = ['rumor', 'sow', 'bribe', 'burn', 'spy']

/** 고을을 겨누는 공작 — 대상 나라의 그 고을 (`node`) */
const ON_NODE: ReadonlySet<PlotOp> = new Set(['bribe', 'spy'])

export function plotCost(op: PlotOp): { grain: number; iron: number } {
  const R = P.realm
  switch (op) {
    case 'rumor': return { grain: R.plotRumorGrain, iron: 0 }
    case 'sow': return { grain: R.plotSowGrain, iron: 0 }
    case 'bribe': return { grain: R.plotBribeGrain, iron: R.plotBribeIron }
    case 'burn': return { grain: R.plotBurnGrain, iron: 0 }
    case 'spy': return { grain: R.plotSpyGrain, iron: 0 }
  }
}

function base(op: PlotOp): number {
  const R = P.realm
  switch (op) {
    case 'rumor': return R.plotBaseRumor
    case 'sow': return R.plotBaseSow
    case 'bribe': return R.plotBaseBribe
    case 'burn': return R.plotBaseBurn
    case 'spy': return R.plotBaseSpy
  }
}

/** 그 나라의 가장 꾀 많은 장수의 략 — 잡히거나 죽은 장수는 빠진다. 없으면 1 */
function bestRyak(r: Realm, faction: string): number {
  let best = 1
  for (const h of Object.values(r.heroes)) if (h.faction === faction && h.status === 'free') best = Math.max(best, h.ryak)
  return best
}

const clamp = (p: number): number => Math.min(P.realm.plotMax, Math.max(P.realm.plotMin, p))

/** 참값의 한 점 — 판정에 쓴다 (plotChance 의 범위 안에 든다) */
export function plotTrueChance(r: Realm, faction: string, op: PlotOp, target: string, node?: string): number {
  const R = P.realm
  let p = base(op) + R.plotPerRyak * (bestRyak(r, faction) - bestRyak(r, target))
  if (ON_NODE.has(op) && node !== undefined) p -= R.plotAlertWeight * (r.watch[node]?.alert ?? 0)
  return clamp(p)
}

/**
 * `faction` 의 눈으로 본 먹힐 확률 범위 — 우리 장수는 안다. 그 나라 장수의 략은 모른다(plotGuessRyakLo~Hi).
 * 고을 경계는 정찰·첩자로 본 만큼(alertRange), 본 적 없으면 0~alertMax.
 */
export function plotChance(r: Realm, faction: string, op: PlotOp, _target: string, node?: string): readonly [number, number] {
  const R = P.realm
  const ours = bestRyak(r, faction)
  let lo = base(op) + R.plotPerRyak * (ours - R.plotGuessRyakHi)
  let hi = base(op) + R.plotPerRyak * (ours - R.plotGuessRyakLo)
  if (ON_NODE.has(op) && node !== undefined) {
    const k = (r.intel[faction] ?? {})[node]
    const al = k?.alert ? alertRange(k.alert.v, r.season - k.alert.season) : null
    lo -= R.plotAlertWeight * (al === null ? R.alertMax : al[1])
    hi -= R.plotAlertWeight * (al === null ? 0 : al[0])
  }
  return [clamp(lo), clamp(hi)]
}

const alive = (r: Realm, f: string): boolean => Object.values(r.nodes).some((n) => n.owner === f)

/** 지금 벌일 수 있는 대상 — 결정론 순서. 값을 못 내도 목록에는 든다 (화면이 "곡식이 모자라다"를 보인다) */
export function plotTargets(r: Realm, faction: string, op: PlotOp): Array<{ target: string; node?: string; other?: string }> {
  const others = Object.keys(r.factions).sort().filter((f) => f !== faction && alive(r, f))
  if (op === 'rumor' || op === 'burn') return others.map((target) => ({ target }))
  if (op === 'sow') {
    const out: Array<{ target: string; other: string }> = []
    for (const target of others) for (const other of others) if (target < other) out.push({ target, other })
    return out
  }
  // 매수·첩자 — 남의 고을 가운데 우리가 땅을 아는 곳. 첩자는 이미 심은 곳을 뺀다
  const known = r.intel[faction] ?? {}
  const spied = new Set((r.spies?.[faction] ?? []).filter((s) => s.until >= r.season).map((s) => s.node))
  const out: Array<{ target: string; node: string }> = []
  for (const n of Object.values(r.nodes).sort((a, b) => (a.id < b.id ? -1 : 1))) {
    if (n.owner === null || n.owner === faction || n.kind === 'sodo' || known[n.id] === undefined) continue
    if (op === 'spy' && spied.has(n.id)) continue
    if (op === 'bribe' && n.hh <= 0) continue
    out.push({ target: n.owner, node: n.id })
  }
  return out
}

function valid(r: Realm, o: Plot): boolean {
  if (r.factions[o.faction] === undefined || r.factions[o.target] === undefined || o.target === o.faction) return false
  if (!PLOT_OPS.includes(o.op) || !alive(r, o.target)) return false
  if (o.op === 'sow') {
    if (o.other === undefined || o.other === o.target || o.other === o.faction || r.factions[o.other] === undefined) return false
  }
  if (ON_NODE.has(o.op)) {
    const n = o.node !== undefined ? r.nodes[o.node] : undefined
    if (n === undefined || n.owner !== o.target) return false
  }
  const c = plotCost(o.op)
  const st = stockOf(r, o.faction)
  return st.grain >= c.grain && st.iron >= c.iron
}

/** 첩자가 본 것 — 그 고을 군세·경계를 이번 계절 것으로 (정찰과 같은 꼴, 들킴은 없다) */
function spyLook(r: Realm, faction: string, node: string): void {
  const n = r.nodes[node]
  const known = r.intel[faction]
  if (n === undefined || known === undefined) return
  const w = r.watch[node]
  known[node] = {
    land: true,
    force: { f0: nodeStrength(r, node, n.owner), src: 'scout', u: roll(r.seed, r.season, `spy-u:${faction}:${node}`), season: r.season },
    alert: w !== undefined ? { v: w.alert, season: r.season } : null,
  }
}

/** 2 — 공작. 값을 내고, 굴리고, 먹히면 효과, 들키면 그 나라와 한 칸 나빠진다 */
export function resolvePlots(r: Realm, orders: readonly Order[], lines: ReportLine[]): void {
  const R = P.realm
  const count = new Map<string, number>()
  const done = new Set<string>()
  for (const o of orders) {
    if (o.kind !== 'plot') continue
    if ((count.get(o.faction) ?? 0) >= R.plotsPerSeason) continue
    const aim = ON_NODE.has(o.op) ? (o.node ?? '') : o.op === 'sow' ? (o.other ?? '') : ''
    const dup = `${o.faction}:${o.op}:${o.target}:${aim}`
    if (done.has(dup) || !valid(r, o)) continue
    done.add(dup)
    count.set(o.faction, (count.get(o.faction) ?? 0) + 1)
    const c = plotCost(o.op)
    const st = stockOf(r, o.faction)
    st.grain -= c.grain
    st.iron -= c.iron

    const key = `plot:${dup}`
    const ok = roll(r.seed, r.season, key) < plotTrueChance(r, o.faction, o.op, o.target, o.node)
    const caught = roll(r.seed, r.season, `${key}:caught`) < (ok ? R.plotCaughtOnSuccess : R.plotCaughtOnFail)
    let mystery: Extract<ReportLine, { kind: 'mystery' }>['what'] | null = null
    if (ok) {
      switch (o.op) {
        case 'rumor':
          for (const a of Object.values(r.armies)) if (a.faction === o.target) a.morale = Math.max(R.moraleFloor, a.morale - R.plotRumorMorale)
          mystery = 'morale'
          break
        case 'sow': {
          const other = o.other!
          const s = relationOf(r, o.target, other).state
          if (s === 'truce' || s === 'ally') worsen(r, o.target, other, lines)
          else if (s === 'neutral' && roll(r.seed, r.season, `${key}:war`) < R.plotSowWar) worsen(r, o.target, other, lines)
          break
        }
        case 'bribe':
          r.watch[o.node!]!.bribedUntil = r.season + R.plotBribeSeasons - 1
          mystery = 'militia'
          break
        case 'burn': {
          const t = stockOf(r, o.target)
          t.grain -= Math.min(R.plotBurnMax, Math.floor(Math.max(0, t.grain) * R.plotBurnShare))
          mystery = 'grain'
          break
        }
        case 'spy':
          // 먹혔어도 들키면 첩자를 잃는다
          if (!caught) {
            const list = ((r.spies ??= {})[o.faction] ??= [])
            list.push({ node: o.node!, until: r.season + R.plotSpySeasons - 1 })
            spyLook(r, o.faction, o.node!)
          }
          break
      }
    }
    if (caught) {
      worsen(r, o.faction, o.target, lines)
      const hot = o.op === 'bribe' ? o.node : o.op === 'burn' ? r.factions[o.target]?.capital : undefined
      const w = hot !== undefined ? r.watch[hot] : undefined
      if (w !== undefined) w.alert = Math.min(R.alertMax, w.alert + R.plotCaughtAlert)
    }
    lines.push({
      kind: 'plot', faction: o.faction, op: o.op, target: o.target,
      ...(o.node !== undefined && ON_NODE.has(o.op) ? { node: o.node } : {}),
      ...(o.op === 'sow' ? { other: o.other! } : {}),
      ok, caught,
    })
    // 당한 쪽은 누가 했는지 모르고 결과만 본다 — 들켰으면 plot 줄이 누가 했는지 말한다
    if (mystery !== null && !caught) {
      lines.push({ kind: 'mystery', faction: o.target, what: mystery, ...(mystery === 'militia' ? { node: o.node! } : {}) })
    }
  }
}

/** 9 — 첩자가 계절마다 본다. 끝났거나 그 고을이 더는 그 나라 땅이 아니면(우리가 쥐었거나 주인이 바뀌었으면) 거둔다 */
export function refreshSpies(r: Realm): void {
  for (const f of Object.keys(r.spies ?? {}).sort()) {
    const list = r.spies![f]!.filter((s) => s.until >= r.season && r.nodes[s.node]?.owner !== f && r.nodes[s.node]?.owner !== null)
    r.spies![f] = list
    for (const s of list) spyLook(r, f, s.node)
  }
}
