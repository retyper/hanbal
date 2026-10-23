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
 * 실패하면 plotCaughtOnFail, 먹혀도 plotCaughtOnSuccess 로 들킨다. 들킴은 세 갈래다 (형: "어디서보낸 첩자인지 알기도 모르기도"):
 *   안 들킴 — 당한 쪽은 결과만 본다 (mystery)
 *   들켰지만 누가 보냈는지 모름 — 경계만 오르고 자객은 잡히거나 달아난다. 사이는 그대로다
 *   누가 보냈는지 드러남 (exposeChance) — 그 나라와 한 칸(암살은 두 칸) 나빠지고 호감이 깎이며, 그 나라를 아는 다른 나라들도 조금 등 돌린다
 * 입을 다문 채 붙잡힌 자객 장수는 계절마다 실토할 수 있다 (stepConfessions) — 실토하면 그때 드러난다.
 * 화면은 확률을 숫자로 안 쓴다 — plotChance 의 범위를 감으로 보인다 (정보의 계약: 모르는 장수·경계는 범위).
 */
import { roll } from '../core/rng.ts'
import { P } from '../tune/params.ts'
import { addFavor, noteDeed, relationOf, worsen } from './diplomacy.ts'
import { knows } from './discovery.ts'
import { stockOf } from './economy.ts'
import { armyOfHero, gainXp, hasTrait, heroAt, heroSeen, honeyLeft, isRuler, plotBonus } from './heroes.ts'
import { alertRange } from './intel.ts'
import { nodeStrength, seenShares } from './season.ts'
import type { Order, PlotOp, Realm, ReportLine } from './types.ts'

type Plot = Extract<Order, { kind: 'plot' }>

export const PLOT_OPS: readonly PlotOp[] = ['rumor', 'sow', 'bribe', 'burn', 'spy', 'assassin']

/** 고을을 겨누는 공작 — 대상 나라의 그 고을 (`node`) */
const ON_NODE: ReadonlySet<PlotOp> = new Set(['bribe', 'spy', 'assassin'])

export function plotCost(op: PlotOp, agent: string | null = null): { grain: number; iron: number } {
  const R = P.realm
  switch (op) {
    case 'rumor': return { grain: R.plotRumorGrain, iron: 0 }
    case 'sow': return { grain: R.plotSowGrain, iron: 0 }
    case 'bribe': return { grain: R.plotBribeGrain, iron: R.plotBribeIron }
    case 'burn': return { grain: R.plotBurnGrain, iron: 0 }
    case 'spy': return { grain: R.plotSpyGrain, iron: 0 }
    // 암살 — 우리 장수를 자객으로 보내지 않으면 고용 자객 값이 더 든다
    case 'assassin': return { grain: R.plotAssassinGrain + (agent === null ? R.plotHiredGrain : 0), iron: 0 }
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
    case 'assassin': return R.plotBaseAssassin
  }
}

/** 그 나라의 가장 꾀 많은 장수의 략 — 잡히거나 죽은 장수는 빠진다. 없으면 1 */
function bestRyak(r: Realm, faction: string): number {
  let best = 1
  for (const h of Object.values(r.heroes)) if (h.faction === faction && h.status === 'free') best = Math.max(best, h.ryak)
  return best
}

const clamp = (p: number): number => Math.min(P.realm.plotMax, Math.max(P.realm.plotMin, p))

/**
 * 암살의 몫 — 자객의 지략(고용 자객은 plotHiredRyak) · 명궁 − 노린 장수의 무예.
 * 노릴 수 있는 장수는 우리가 본 장수뿐이라(heroSeen) 무예는 안다 — 범위가 아니라 한 값.
 */
function assassinTerm(r: Realm, faction: string, hero: string | undefined, agent: string | null | undefined): number {
  const R = P.realm
  const a = agent !== null && agent !== undefined ? r.heroes[agent] : undefined
  const v = hero !== undefined ? r.heroes[hero] : undefined
  return R.plotPerRyak * (a?.ryak ?? R.plotHiredRyak) + (hasTrait(a, 'archer') ? R.traitArcherAssassin : 0) - R.plotAssassinPerMu * (v?.mu ?? 5)
    + R.plotBowStep * assassinBow(r, faction)
}

// ───────── 자객 기본 · 장수는 도박 (형이 고름 — 2026-10-18)

/** 이 나라 자객의 활 단계 — 0 단궁 · 1 맥궁 · 2 각궁 · 3 신궁. 밤 판의 bow= 로 넘긴다 */
export function assassinBow(r: Realm, faction: string): number {
  const t = r.assassinBow?.[faction] ?? 0
  return Math.max(0, Math.min(3, Math.floor(Number.isFinite(t) ? t : 0)))
}

/** 단궁(박달나무 활)의 고장 — 동예의 나라들 (위서 예전 「단궁」 [곁들임]) */
export const DANGUNG_NATIONS: readonly string[] = ['bullae', 'haseulla']

/** 이 나라는 단궁을 얻을 수 있나 — 동예 나라이거나, 판에 있는 동예 나라와 동맹이다 */
export function hasDangung(r: Realm, faction: string): boolean {
  return DANGUNG_NATIONS.some((d) => d === faction || (r.factions[d] !== undefined && relationOf(r, faction, d).state === 'ally'))
}

/** 다음 단계로 올리는 값 — 이미 신궁이면 null. 단궁의 고장과 손잡으면 싸다 */
export function bowUpCost(r: Realm, faction: string): { grain: number; iron: number; to: number } | null {
  const R = P.realm
  const t = assassinBow(r, faction)
  const k = hasDangung(r, faction) ? R.bowUpDangung : 1
  const c = (grain: number, iron: number, to: number): { grain: number; iron: number; to: number } => ({ grain: Math.round(grain * k), iron: Math.round(iron * k), to })
  switch (t) {
    case 0: return c(R.bowUp1Grain, R.bowUp1Iron, 1)
    case 1: return c(R.bowUp2Grain, R.bowUp2Iron, 2)
    case 2: return c(R.bowUp3Grain, R.bowUp3Iron, 3)
    default: return null
  }
}

/** 1 — 자객의 활 올리기. 나라마다 한 계절에 한 단계, 값을 못 내면 아무 일도 없다 */
export function applyBowUps(r: Realm, orders: readonly Order[], lines: ReportLine[]): void {
  const done = new Set<string>()
  for (const o of orders) {
    if (o.kind !== 'bowUp' || done.has(o.faction) || r.factions[o.faction] === undefined) continue
    const c = bowUpCost(r, o.faction)
    const st = stockOf(r, o.faction)
    if (c === null || st.grain < c.grain || st.iron < c.iron) continue
    done.add(o.faction)
    st.grain -= c.grain
    st.iron -= c.iron
    ;(r.assassinBow ??= {})[o.faction] = c.to
    lines.push({ kind: 'bowUp', faction: o.faction, tier: c.to })
  }
}

/** 밤 판에서 받는 화살 — 바탕 + 우리 장수를 보내면 더 + 명궁이면 더 (활 단계의 화살은 밤 판이 bow= 로 붙인다) */
export function assassinArrows(r: Realm, agent: string | null | undefined): number {
  const a = agent !== null && agent !== undefined ? r.heroes[agent] : undefined
  if (a === undefined) return P.night.arrows
  return P.night.arrows + P.realm.plotAgentArrows + (hasTrait(a, 'archer') ? P.night.archerBonus : 0)
}

/**
 * 밤 판의 경비 0 느슨 · 1 보통 · 2 삼엄 (night/layout.ts Guard · 형: "경비가 삼엄한 암살이랑 안삼엄한거랑 조금 달라야") —
 * 그 장수가 있는 고을의 경계 + 도읍이면 더 + 군주면 더. 판의 사람·불 수와 불을 다시 붙이는 빠르기가 달라진다
 */
export function assassinGuard(r: Realm, hero: string): 0 | 1 | 2 {
  const R = P.realm
  const h = r.heroes[hero]
  const at = h?.at ?? null
  const node = at !== null ? r.nodes[at] : undefined
  const v = (at !== null ? (r.watch[at]?.alert ?? 0) : 0) + (node?.kind === 'capital' ? R.guardCapital : 0) + (hero.endsWith('-ruler') ? R.guardRuler : 0)
  return v >= R.guardHigh ? 2 : v >= R.guardMid ? 1 : 0
}

/** 들킨 자객 장수가 도망칠 확률 — 지략·무예·명궁·밤눈·겁 많음 */
export function escapeChance(r: Realm, agent: string): number {
  const R = P.realm
  const a = r.heroes[agent]
  if (a === undefined) return 0
  const trait = hasTrait(a, 'archer') || hasTrait(a, 'nighteye') || hasTrait(a, 'coward') ? R.escapeTrait : 0
  const p = R.escapeBase + R.escapePerRyak * Math.max(0, a.ryak - 5) + R.escapePerMu * Math.max(0, a.mu - 5) + trait
  return Math.min(R.escapeMax, Math.max(0, p))
}

/** 참값의 한 점 — 판정에 쓴다 (plotChance 의 범위 안에 든다) */
export function plotTrueChance(
  r: Realm, faction: string, op: PlotOp, target: string, node?: string, hero?: string, agent?: string | null,
): number {
  const R = P.realm
  let p = base(op) + plotBonus(r, faction)
  // 암살은 자객 대 그 장수, 나머지는 우리 꾀 대 그 나라 꾀
  p += op === 'assassin' ? assassinTerm(r, faction, hero, agent) : R.plotPerRyak * (bestRyak(r, faction) - bestRyak(r, target))
  if (ON_NODE.has(op) && node !== undefined) p -= R.plotAlertWeight * (r.watch[node]?.alert ?? 0)
  return clamp(p)
}

/**
 * `faction` 의 눈으로 본 먹힐 확률 범위 — 우리 장수는 안다. 그 나라 장수의 략은 모른다(plotGuessRyakLo~Hi).
 * 고을 경계는 정찰·첩자로 본 만큼(alertRange), 본 적 없으면 0~alertMax.
 */
export function plotChance(
  r: Realm, faction: string, op: PlotOp, _target: string, node?: string, hero?: string, agent?: string | null,
): readonly [number, number] {
  const R = P.realm
  const ours = bestRyak(r, faction)
  let lo = base(op) + plotBonus(r, faction)
  let hi = lo
  if (op === 'assassin') {
    lo += assassinTerm(r, faction, hero, agent)
    hi += assassinTerm(r, faction, hero, agent)
  } else {
    lo += R.plotPerRyak * (ours - R.plotGuessRyakHi)
    hi += R.plotPerRyak * (ours - R.plotGuessRyakLo)
  }
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
export function plotTargets(r: Realm, faction: string, op: PlotOp): Array<{ target: string; node?: string; other?: string; hero?: string }> {
  // 아는 나라에만 — 모르는 나라에 소문을 퍼뜨릴 수는 없다 (발견)
  const others = Object.keys(r.factions).sort().filter((f) => f !== faction && alive(r, f) && knows(r, faction, f))
  if (op === 'assassin') {
    // 우리가 본 남의 장수 — 군주는 뺀다 (도읍 깊이 있다), 어디 있는지 알아야 한다
    const out: Array<{ target: string; node: string; hero: string }> = []
    for (const h of Object.values(r.heroes).sort((a, b) => (a.id < b.id ? -1 : 1))) {
      if (h.status !== 'free' || h.faction === faction || !others.includes(h.faction) || isRuler(r, h.id) || !heroSeen(r, faction, h.id)) continue
      const at = heroAt(r, h.id)
      if (at !== null) out.push({ target: h.faction, node: at, hero: h.id })
    }
    return out
  }
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

/** 자객으로 보낼 수 있는 우리 장수 — 군대 없이 혼자 머무는 이. 군주도 친히 간다(명궁 군주의 자리) — 들키면 호위가 빼내지만 다쳐 돌아온다. 그 계절엔 아무것도 못 한다 */
export function plotAgents(r: Realm, faction: string): string[] {
  return Object.values(r.heroes)
    .filter((h) => h.faction === faction && h.status === 'free' && h.at !== null && armyOfHero(r, h.id) === null && honeyLeft(r, h.id) === 0)
    .map((h) => h.id)
    .sort()
}

function valid(r: Realm, o: Plot): boolean {
  if (r.factions[o.faction] === undefined || r.factions[o.target] === undefined || o.target === o.faction) return false
  if (!PLOT_OPS.includes(o.op) || !alive(r, o.target) || !knows(r, o.faction, o.target)) return false
  if (o.op === 'assassin') {
    const v = o.hero !== undefined ? r.heroes[o.hero] : undefined
    if (v === undefined || v.status !== 'free' || v.faction !== o.target || isRuler(r, v.id) || !heroSeen(r, o.faction, v.id)) return false
    if (o.agent !== undefined && !plotAgents(r, o.faction).includes(o.agent)) return false
    const c = plotCost('assassin', o.agent ?? null)
    return stockOf(r, o.faction).grain >= c.grain
  }
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
    force: { f0: nodeStrength(r, node, n.owner), src: 'scout', u: roll(r.seed, r.season, `spy-u:${faction}:${node}`), season: r.season, ...seenShares(r, node, n.owner) },
    alert: w !== undefined ? { v: w.alert, season: r.season } : null,
  }
}

/**
 * 들킨 공작에서 누가 보냈는지까지 드러날 확률 (형: "어디서보낸 첩자인지 알기도 모르기도 하고").
 *   바탕 − 보낸 이의 지략 (자객 장수 · 고용 자객은 plotHiredRyak 에 고용 감산 · 그 밖의 공작은 그 나라 최고 략)
 *   + 그 고을(없으면 표적 나라 국읍)의 경계 × 계수 + 얼굴이 알려진 우리 장수가 붙잡혔으면 가산 → [최소, 최대]
 * `agent` — 암살이면 자객 장수 id 또는 null(고용 자객), 다른 공작이면 undefined.
 */
export function exposeChance(r: Realm, faction: string, target: string, node: string | undefined, agent: string | null | undefined, agentCaptured = false): number {
  const R = P.realm
  const a = agent !== null && agent !== undefined ? r.heroes[agent] : undefined
  const ryak = agent === undefined ? bestRyak(r, faction) : (a?.ryak ?? R.plotHiredRyak)
  const at = node ?? r.factions[target]?.capital
  const alert = at !== undefined ? (r.watch[at]?.alert ?? 0) : 0
  const p = R.plotExposeBase - R.plotExposePerRyak * (ryak - 5) - (agent === null ? R.plotExposeHired : 0)
    + R.plotExposePerAlert * alert + (agentCaptured ? R.plotExposeCaptured : 0)
  return Math.min(R.plotExposeMax, Math.max(R.plotExposeMin, p))
}

/**
 * 드러났다 — 당한 나라와 한 칸 나빠지고 호감이 깎인다. 그 나라를 아는 다른 나라들도 조금 등 돌린다 (뒤에서 칼 쓰는 나라).
 * `steps` 는 나빠지는 칸 수 — 암살은 둘.
 */
function expose(r: Realm, from: string, to: string, steps: number, lines: ReportLine[]): void {
  const R = P.realm
  for (let i = 0; i < steps; i++) worsen(r, from, to, lines, { by: to, why: 'plot' })
  noteDeed(r, from, to, { by: from, k: 'plot' })
  addFavor(r, from, to, -R.favorPlotCaught)
  for (const x of Object.keys(r.factions).sort()) {
    if (x !== from && x !== to && alive(r, x) && knows(r, x, from)) addFavor(r, from, x, -R.favorPlotExposedOthers)
  }
}

/**
 * 붙잡혔지만 입을 다문 자객 장수 — 계절마다 실토를 굴린다 (`confess:<장수>`). 실토하면 그때 드러난다 (암살이라 두 칸).
 * 풀려났거나 죽었거나 잡은 나라가 바뀌었으면 지운다.
 */
function stepConfessions(r: Realm, lines: ReportLine[]): void {
  const hid = r.hiddenAgents
  if (hid === undefined) return
  for (const id of Object.keys(hid).sort()) {
    const e = hid[id]!
    const h = r.heroes[id]
    if (h === undefined || h.status !== 'captive' || h.captor !== e.to || r.factions[e.from] === undefined || r.factions[e.to] === undefined) {
      delete hid[id]
      continue
    }
    if (roll(r.seed, r.season, `confess:${id}`) >= P.realm.plotConfess) continue
    delete hid[id]
    expose(r, e.from, e.to, 2, lines)
    lines.push({ kind: 'confess', hero: id, from: e.from, to: e.to })
  }
}

/** 2 — 공작. 값을 내고, 굴리고, 먹히면 효과. 들키면 경계가 오르고, 누가 했는지까지 드러나면 그 나라와 나빠진다 */
export function resolvePlots(r: Realm, orders: readonly Order[], lines: ReportLine[]): void {
  const R = P.realm
  stepConfessions(r, lines) // 지난 계절까지 붙잡힌 자객이 먼저 입을 연다
  const count = new Map<string, number>()
  const done = new Set<string>()
  const agents = new Set<string>()
  for (const o of orders) {
    if (o.kind !== 'plot') continue
    if ((count.get(o.faction) ?? 0) >= R.plotsPerSeason) continue
    const aim = o.op === 'assassin' ? (o.hero ?? '') : ON_NODE.has(o.op) ? (o.node ?? '') : o.op === 'sow' ? (o.other ?? '') : ''
    const dup = `${o.faction}:${o.op}:${o.target}:${aim}`
    if (done.has(dup) || !valid(r, o)) continue
    // 자객 하나는 한 계절에 한 번만 간다
    if (o.agent !== undefined && agents.has(o.agent)) continue
    if (o.agent !== undefined) agents.add(o.agent)
    done.add(dup)
    count.set(o.faction, (count.get(o.faction) ?? 0) + 1)
    const c = plotCost(o.op, o.agent ?? null)
    const st = stockOf(r, o.faction)
    st.grain -= c.grain
    st.iron -= c.iron

    const key = `plot:${dup}`
    // 암살은 그 장수가 지금 있는 고을의 경계를 받는다
    const at = o.op === 'assassin' ? (heroAt(r, o.hero!) ?? undefined) : o.node
    // 밤 판에서 손으로 쏜 암살이면 굴림 대신 그 결과 (SNIPE §0-3) — dead·wounded 먹힘 · fled 실패(경보면 들킴) · withdrew 실패·안 들킴
    // 건너뛰기(skip)는 손이 아니다 — 굴린다. 진짜 지붕을 보고 맡겼으면 굴림이 준다 (plotSkipSeenMul)
    const given = o.op === 'assassin' ? o.hand : undefined
    const hand = given !== undefined && given.result !== 'skip' ? given : undefined
    const skipMul = given?.result === 'skip' && given.seen === true ? R.plotSkipSeenMul : 1
    const ok = hand !== undefined
      ? hand.result === 'dead' || hand.result === 'wounded'
      : roll(r.seed, r.season, key) < plotTrueChance(r, o.faction, o.op, o.target, at, o.hero, o.agent ?? null) * skipMul
    const caught = hand !== undefined
      ? hand.alarm
      : roll(r.seed, r.season, `${key}:caught`) < (ok ? R.plotCaughtOnSuccess : R.plotCaughtOnFail)
    let mystery: Extract<ReportLine, { kind: 'mystery' }>['what'] | null = null
    let result: 'wound' | 'kill' | undefined
    let agentFate: 'escaped' | 'captured' | undefined
    if (o.op === 'assassin') {
      const v = r.heroes[o.hero!]!
      if (ok) {
        // 먹혔다 — 낮은 확률로 죽고, 아니면 다쳐서 몇 계절 군대를 못 이끈다 (R2 에 활 저격판으로 이어진다)
        if (hand !== undefined ? hand.result === 'dead' : roll(r.seed, r.season, `${key}:kill`) < R.plotAssassinKill) {
          v.status = 'dead'
          v.at = null
          v.post = null
          for (const a of Object.values(r.armies)) if (a.hero === v.id) a.hero = null
          result = 'kill'
          mystery = 'death'
        } else {
          v.woundedUntil = r.season + R.plotWoundSeasons - 1
          result = 'wound'
          mystery = 'wound'
        }
      }
      if (caught) {
        // 들켰다 — 고용 자객은 값만 잃는다. 우리 장수였으면 도망과 사로잡힘을 굴린다 (자객 기본 · 장수는 도박).
        // 누가 보냈는지 드러나면 그 나라와 두 칸 나빠진다 (아래 expose)
        const ag = o.agent !== undefined ? r.heroes[o.agent] : undefined
        if (ag !== undefined && ag.status === 'free' && isRuler(r, ag.id)) {
          // 군주는 호위가 빼낸다 — 대신 다쳐 누워 다스림이 준다
          ag.woundedUntil = r.season + P.realm.rulerAgentWound
          agentFate = 'escaped'
        } else if (ag !== undefined && ag.status === 'free') {
          if (roll(r.seed, r.season, `${key}:escape`) < escapeChance(r, ag.id)) agentFate = 'escaped'
          else {
            ag.status = 'captive'
            ag.captor = o.target
            ag.at = null
            ag.post = null
            for (const a of Object.values(r.armies)) if (a.hero === ag.id) a.hero = null
            agentFate = 'captured'
          }
        }
      }
      // 해낸 자객 장수는 지략이 자란다 (HEROES §6) — 들켜 잡혔으면 아니다
      const ag = o.agent !== undefined ? r.heroes[o.agent] : undefined
      if (ok && ag !== undefined && ag.status === 'free') gainXp(ag, 'ryak', R.xpPlot, lines)
    }
    if (ok && o.op !== 'assassin') {
      switch (o.op) {
        case 'rumor':
          for (const a of Object.values(r.armies)) if (a.faction === o.target) a.morale = Math.max(R.moraleFloor, a.morale - R.plotRumorMorale)
          mystery = 'morale'
          break
        case 'sow': {
          const other = o.other!
          const s = relationOf(r, o.target, other).state
          if (s === 'truce' || s === 'ally') worsen(r, o.target, other, lines, { why: 'sow' })
          else if (s === 'neutral' && roll(r.seed, r.season, `${key}:war`) < R.plotSowWar) worsen(r, o.target, other, lines, { why: 'sow' })
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
    // 들킴 세 갈래 — 들켰으면 누가 보냈는지까지 드러났나를 따로 굴린다 (`<키>:exposed`)
    let exposed = false
    if (caught) {
      const agent = o.op === 'assassin' ? (o.agent ?? null) : undefined
      exposed = roll(r.seed, r.season, `${key}:exposed`) < exposeChance(r, o.faction, o.target, at, agent, agentFate === 'captured')
      // 누가 했는지 몰라도 그 고을(소문·이간·방화는 국읍)은 경계를 올린다
      const hot = at ?? r.factions[o.target]?.capital
      const w = hot !== undefined ? r.watch[hot] : undefined
      if (w !== undefined) w.alert = Math.min(R.alertMax, w.alert + R.plotCaughtAlert)
      if (exposed) expose(r, o.faction, o.target, o.op === 'assassin' ? 2 : 1, lines)
      else if (agentFate === 'captured' && o.agent !== undefined) (r.hiddenAgents ??= {})[o.agent] = { from: o.faction, to: o.target }
    }
    lines.push({
      kind: 'plot', faction: o.faction, op: o.op, target: o.target,
      ...(at !== undefined && ON_NODE.has(o.op) ? { node: at } : {}),
      ...(o.op === 'sow' ? { other: o.other! } : {}),
      ...(o.op === 'assassin' ? { hero: o.hero! } : {}),
      ...(o.agent !== undefined ? { agent: o.agent } : {}),
      ...(result !== undefined ? { result } : {}),
      ...(agentFate !== undefined ? { agentFate } : {}),
      ok, caught, exposed,
    })
    // 당한 쪽은 누가 했는지 모르고 결과만 본다 — 들켰으면 plot 줄이 말한다 (드러났으면 누가, 아니면 "누가 보냈는지 모른다")
    if (mystery !== null && !caught) {
      const extra = mystery === 'militia' ? { node: o.node! } : mystery === 'wound' || mystery === 'death' ? { hero: o.hero! } : {}
      lines.push({ kind: 'mystery', faction: o.target, what: mystery, ...extra })
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
