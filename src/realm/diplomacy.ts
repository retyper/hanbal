/**
 * 외교 — 관계 넷과 사신 넷 (docs/realm/FLOW.md §4 · SYSTEMS §8 의 최소판)
 *
 * 관계: 전쟁 · 중립 · 화친(정한 계절까지) · 동맹. 판은 중립에서 시작하고, 먼저 치면 전쟁이 된다.
 * 화친·동맹을 깨고 치면 **모든 나라**와의 관계가 한 칸 내려간다 — 신의가 값이다.
 * 사신: 화친 · 교역(곡식↔철) · 조공 요구 · 동맹. 상대 나라마다 한 계절에 하나. 몰래 하는 일은 plots.ts(공작).
 *
 * 받아들일 확률은 정보의 계약을 따른다 — envoyChance 는 **묻는 쪽의 정보로** 범위를 낸다.
 * 판정은 참값으로 셈한 한 점(그 범위 안에 든다)에 이름 붙은 주사위 `envoy:<from>:<to>` 를 굴린다.
 * 남의 나라는 플레이어에게 사신 대신 **청**(Ask)을 건다 — 아래 makeAsks · resolveAnswers. AI 끼리는 사신을 주고받는다 (ai.ts envoys).
 */
import { roll } from '../core/rng.ts'
import { P } from '../tune/params.ts'
import { canPayGoods, goodOf, goodsOne, goodsWorth, menOf, payGoods, stockOf, worthOf } from './economy.ts'
import { envoyBonus } from './heroes.ts'
import { visibleRange } from './intel.ts'
import { memoFor } from './memo.ts'
import { nodeStrength } from './season.ts'
import { allianceWhy, truceWhy, winningAgainst, type Motive } from './stance.ts'
import { knows } from './discovery.ts'
import { noteIron } from './paths.ts'
import type { Ask, AskKind, EnvoyAsk, Good, Goods, Order, Pledge, Realm, Relation, RelationWhy, ReportLine } from './types.ts'

export function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`
}

const NEUTRAL: Relation = { state: 'neutral', until: null }

export function relationOf(r: Realm, a: string, b: string): Relation {
  return r.relations?.[pairKey(a, b)] ?? NEUTRAL
}

/** 친한 사이인가 — 화친·동맹. AI 는 이런 나라를 치지 않는다 */
export function friendly(r: Realm, a: string, b: string): boolean {
  const s = relationOf(r, a, b).state
  return s === 'truce' || s === 'ally'
}

/** 관계를 바꾼다 — 호감은 남고, 동맹이 아니게 되면 함께 치자는 약속은 사라진다 */
function setRelation(r: Realm, a: string, b: string, state: Relation['state'], until: number | null, lines: ReportLine[], cause?: { by?: string; why: RelationWhy }): void {
  const prev = relationOf(r, a, b)
  const next: Relation = { state, until }
  if (prev.favor !== undefined) next.favor = prev.favor
  if (state === 'ally' && prev.pledges !== undefined && prev.pledges.length > 0) next.pledges = prev.pledges
  if (prev.took !== undefined) next.took = prev.took
  if (prev.vassal !== undefined && state !== 'war') next.vassal = prev.vassal // 칼을 뽑으면 조공은 끊긴다
  ;(r.relations ??= {})[pairKey(a, b)] = next
  if (prev.state !== state) lines.push({ kind: 'relation', a: a < b ? a : b, b: a < b ? b : a, state, ...(cause?.by !== undefined ? { by: cause.by } : {}), ...(cause !== undefined ? { why: cause.why } : {}) })
  if ((state === 'truce' || state === 'ally') && (prev.state === 'war' || prev.state === 'neutral')) recall(r, a, b, lines)
}

/**
 * 화친·동맹을 맺으면 서로의 땅으로 가던 군대가 발길을 돌린다 — 다음 계절에 떠난 고을로 돌아간다
 * (형: "화친 받았는데 다음계절에 목록에서 또 뜨네" — 오던 군대가 그대로 닿아 싸우는 바람에 맺자마자 다시 전쟁이 됐었다)
 */
function recall(r: Realm, a: string, b: string, lines: ReportLine[]): void {
  for (const x of Object.values(r.armies).sort((p, q) => (p.id < q.id ? -1 : 1))) {
    const m = x.march
    if (m === null || x.lent !== undefined) continue
    const other = x.faction === a ? b : x.faction === b ? a : null
    if (other === null || r.nodes[m.to]?.owner !== other) continue
    x.march = { from: m.to, to: m.from, edge: m.edge, left: 1, ambush: false }
    lines.push({ kind: 'recall', faction: x.faction, army: x.id, node: m.to })
  }
}

// ───────── 호감 (외교 둘째판 — 형: "외교가 좀 재미없음")

/** 두 나라 사이의 호감 −100..100 (없으면 0) */
export function favorOf(r: Realm, a: string, b: string): number {
  return relationOf(r, a, b).favor ?? 0
}

/** 호감을 더한다 (−100..100 으로 자른다). 관계가 없으면 중립으로 만든다 */
export function addFavor(r: Realm, a: string, b: string, d: number): void {
  if (a === b || d === 0 || r.factions[a] === undefined || r.factions[b] === undefined) return
  const key = pairKey(a, b)
  const rel = ((r.relations ??= {})[key] ??= { state: 'neutral', until: null })
  rel.favor = Math.max(-100, Math.min(100, Math.round(((rel.favor ?? 0) + d) * 10) / 10))
}

/**
 * 관계마다 보낼 수 있는 사신 (화면은 이것만 보인다):
 *   전쟁 — 화친 · 조공 요구 · 선물      중립 — 화친 · 교역 · 선물 · 조공 요구
 *   화친 — 동맹 · 교역 · 선물 · 깨기    동맹 — 함께 치자 · 지원 요청 · 군대 빌리기 · 교역 · 선물 · 깨기
 */
export function envoyOptions(r: Realm, from: string, to: string): EnvoyAsk[] {
  switch (relationOf(r, from, to).state) {
    case 'war': return ['truce', 'tribute', 'gift']
    case 'neutral': return ['truce', 'trade', 'gift', 'tribute']
    case 'truce': return ['alliance', 'trade', 'gift', 'break']
    case 'ally': return ['joint', 'aid', 'troops', 'trade', 'gift', 'break']
  }
}

/** 이 나라에게 지금 걸린 함께 치자는 약속 — 칠 고을 id 들 (AI 가 그 고을을 더 쳐 볼 만하게 본다) */
export function pledgedNodes(r: Realm, faction: string): string[] {
  const out: string[] = []
  for (const rel of Object.values(r.relations ?? {})) for (const p of rel.pledges ?? []) if (p.by === faction && p.until >= r.season) out.push(p.node)
  return [...new Set(out)].sort()
}

/** 함께 칠 수 있는 고을 — 동맹 `ally` 가 닿고(제 땅과 길로 맞닿고), 둘 다와 친하지 않은 세 번째 나라의 땅. id 순서 */
export function jointTargets(r: Realm, asker: string, ally: string): string[] {
  const out = new Set<string>()
  for (const ed of Object.values(r.edges)) {
    for (const [x, y] of [[ed.a, ed.b], [ed.b, ed.a]] as const) {
      if (r.nodes[x]?.owner !== ally) continue
      const n = r.nodes[y]
      const o = n?.owner
      if (n === undefined || o === null || o === undefined || o === asker || o === ally || n.kind === 'sodo') continue
      if (friendly(r, ally, o) || friendly(r, asker, o)) continue
      out.add(y)
    }
  }
  return [...out].sort()
}

/** 9 — 함께 치자는 약속을 셈한다: 이번 계절에 그 고을을 쳤거나 쥐었으면 지킨 것, 말미가 지났으면 저버린 것 */
export function checkPledges(r: Realm, lines: ReportLine[]): void {
  const R = P.realm
  const hit = new Set<string>()
  for (const l of lines) if (l.kind === 'battle' && l.atkFaction !== undefined) hit.add(`${l.atkFaction}>${l.node}`)
  for (const key of Object.keys(r.relations ?? {}).sort()) {
    const rel = r.relations[key]!
    if (rel.pledges === undefined || rel.pledges.length === 0) continue
    const [a, b] = key.split('|') as [string, string]
    const keep: Pledge[] = []
    for (const p of rel.pledges) {
      const other = p.by === a ? b : a
      const kept = hit.has(`${p.by}>${p.node}`) || r.nodes[p.node]?.owner === p.by
      if (kept) {
        addFavor(r, p.by, other, R.favorPledgeKept)
        lines.push({ kind: 'pledge', from: p.by, to: other, node: p.node, kept: true })
      } else if (p.until <= r.season) {
        addFavor(r, p.by, other, -R.favorPledgeBroken)
        lines.push({ kind: 'pledge', from: p.by, to: other, node: p.node, kept: false })
      } else keep.push(p)
    }
    rel.pledges = keep
  }
}

/** 약속을 건다 — `by` 가 `node` 를 pledgeSeasons 안에 친다 */
function pledge(r: Realm, by: string, other: string, node: string): void {
  const rel = ((r.relations ??= {})[pairKey(by, other)] ??= { state: 'neutral', until: null })
  ;(rel.pledges ??= []).push({ by, node, until: r.season + P.realm.pledgeSeasons })
}

/** 9 — 사이가 저절로 움직인다: 같은 적과 싸우는 두 나라는 가까워진다 (장터의 호감은 holdMarkets) */
export function driftFavor(r: Realm): void {
  const fs = Object.keys(r.factions).sort()
  for (let i = 0; i < fs.length; i++) {
    for (let j = i + 1; j < fs.length; j++) {
      if (atWarWithSame(r, fs[i]!, fs[j]!)) addFavor(r, fs[i]!, fs[j]!, P.realm.favorCommonFoe)
    }
  }
}

/** 빌린 군대가 갈 길 — 빌려주는 나라 · 빌리는 나라 · 동맹의 땅만 지나 `to` 고을까지. 없으면 null. 다음 고을 id 를 낸다 */
export function lentStep(r: Realm, army: string): { edge: string; next: string } | null {
  const a = r.armies[army]
  if (a === undefined || a.lent === undefined) return null
  const goal = a.lent.node
  if (a.at === goal) return null
  const ok = (n: string): boolean => {
    const o = r.nodes[n]?.owner
    return o === a.faction || o === a.lent!.to || (o !== null && o !== undefined && relationOf(r, a.faction, o).state === 'ally')
  }
  // 너비 우선 — id 순서로 (결정론)
  const prev = new Map<string, { from: string; edge: string }>()
  const queue = [a.at]
  const seen = new Set([a.at])
  const edges = Object.values(r.edges).sort((x, y) => (x.id < y.id ? -1 : 1))
  while (queue.length > 0) {
    const cur = queue.shift()!
    if (cur === goal) break
    for (const ed of edges) {
      const nx = ed.a === cur ? ed.b : ed.b === cur ? ed.a : null
      if (nx === null || seen.has(nx) || !ok(nx)) continue
      seen.add(nx)
      prev.set(nx, { from: cur, edge: ed.id })
      queue.push(nx)
    }
  }
  if (!prev.has(goal)) return null
  let n = goal
  let step = prev.get(n)!
  while (step.from !== a.at) {
    n = step.from
    step = prev.get(n)!
  }
  return { edge: step.edge, next: n }
}

/** 9 — 빌려준 군대: 말미가 지나면 돌아간다 (빌림 표만 거둔다 — 그 뒤엔 제 나라 AI 가 움직인다) */
export function stepLent(r: Realm, lines: ReportLine[]): void {
  for (const a of Object.values(r.armies).sort((x, y) => (x.id < y.id ? -1 : 1))) {
    const l = a.lent
    if (l === undefined) continue
    // 빌린 나라와 사이가 틀어졌거나, 지킬 고을이 그 나라 땅이 아니게 됐거나, 말미가 지났으면
    if (l.until < r.season || relationOf(r, a.faction, l.to).state !== 'ally' || r.nodes[l.node]?.owner !== l.to) {
      delete a.lent
      lines.push({ kind: 'lent', from: a.faction, to: l.to, node: l.node, army: a.id, back: true })
    }
  }
}

/** 빌려줄 군대 — 빌려주는 나라의 쉬는 군대 가운데 국읍의 마지막 군대가 아니고, 그 고을까지 갈 길이 있는 가장 큰 것 */
function lenderArmy(r: Realm, lender: string, to: string, node: string): string | null {
  const cap = r.factions[lender]?.capital
  const mine = Object.values(r.armies).filter((a) => a.faction === lender && a.march === null && a.lent === undefined)
    .sort((x, y) => (x.id < y.id ? -1 : 1))
  let best: { id: string; n: number } | null = null
  for (const a of mine) {
    if (a.at === cap && mine.filter((x) => x.at === cap).length <= 1) continue
    let n = 0
    for (const v of Object.values(a.mix)) n += v ?? 0
    if (n < P.realm.splitMin) continue
    // 길이 있나 — 빌림 표를 잠시 달아 보고 거둔다
    a.lent = { to, node, until: r.season }
    const can = a.at === node || lentStep(r, a.id) !== null
    delete a.lent
    if (can && (best === null || n > best.n)) best = { id: a.id, n }
  }
  return best?.id ?? null
}

const STEP: Readonly<Record<Relation['state'], Relation['state']>> = { ally: 'truce', truce: 'neutral', neutral: 'war', war: 'war' }

/** `vassal` 이 `lord` 에게 tributeSeasons 동안 조공하는 사이가 된다 (맹주의 길 — suzerain.ts) */
export function makeVassal(r: Realm, vassal: string, lord: string): void {
  if (vassal === lord || r.factions[vassal] === undefined || r.factions[lord] === undefined) return
  const key = pairKey(vassal, lord)
  const rel = ((r.relations ??= {})[key] ??= { state: 'neutral', until: null })
  rel.vassal = { lord, until: r.season + P.realm.tributeSeasons }
}

/** 두 나라 사이가 한 칸 나빠진다 (동맹→화친→중립→전쟁) — 공작이 들키거나 이간이 먹힐 때 (plots.ts) */
export function worsen(r: Realm, a: string, b: string, lines: ReportLine[], cause?: { by?: string; why: RelationWhy }): void {
  if (a === b || r.factions[a] === undefined || r.factions[b] === undefined) return
  const down = STEP[relationOf(r, a, b).state]
  setRelation(r, a, b, down, down === 'truce' ? r.season + P.realm.truceSeasons : null, lines, cause)
}

/**
 * `attacker` 가 `victim` 을 쳤다 (싸움이든, 장정 없는 땅을 걸어 들어가든). 전쟁이 된다.
 * 화친·동맹을 깨고 쳤으면 남은 모든 나라와의 관계가 한 칸 내려간다.
 */
export function onHostile(r: Realm, attacker: string, victim: string | null, lines: ReportLine[]): void {
  if (victim === null || victim === attacker || r.factions[victim] === undefined) return
  const prev = relationOf(r, attacker, victim).state
  if (prev === 'war') return
  const betray = prev === 'truce' || prev === 'ally'
  setRelation(r, attacker, victim, 'war', null, lines, { by: attacker, why: betray ? 'betray' : 'attack' })
  if (!betray) return
  for (const x of Object.keys(r.factions).sort()) {
    if (x === attacker || x === victim) continue
    const s = relationOf(r, attacker, x).state
    // 맺은 사이만 한 칸 물러난다 (동맹→화친→중립). 중립인 나라가 덩달아 전쟁을 걸지는 않는다 — 호감이 깎일 뿐
    // (형: "그냥무작정 전쟁이다라 그러면 어떡하냐" — 약조를 깬 한 번에 판의 모든 나라와 전쟁이 나던 것)
    if (s !== 'truce' && s !== 'ally') { addFavor(r, attacker, x, -P.realm.favorBreakOthers); continue }
    const down = STEP[s]
    setRelation(r, attacker, x, down, down === 'truce' ? r.season + P.realm.truceSeasons : null, lines, { by: x, why: 'distrust' })
  }
}

/** 9 — 화친이 끝날 때가 됐다 */
export function expireRelations(r: Realm, lines: ReportLine[]): void {
  for (const key of Object.keys(r.relations ?? {}).sort()) {
    const rel = r.relations[key]!
    if (rel.state === 'truce' && rel.until !== null && rel.until <= r.season) {
      const [a, b] = key.split('|') as [string, string]
      setRelation(r, a, b, 'neutral', null, lines, { why: 'expire' })
    }
  }
}

/**
 * 화친·동맹을 맺으면 무엇을 얻나 (형: "화친이랑 동맹도 되면 뭐가 되는건지 모르겠네" — 2026-10-18)
 *   화친 — 서로 안 친다 + **장터**: 계절마다 둘 다 곡식 truceTrade 씩 (holdMarkets)
 *   동맹 — 땅을 지나간다 + **본 것을 나눈다** (shareIntel) + 동맹 AI 는 같은 적을 먼저 친다 (allyFoe)
 */

/** 9 — 장터: 화친 중인 두 나라가 계절마다 곡식을 조금씩 얻는다. 동맹도 화친의 위라 장터가 선다 */
export function holdMarkets(r: Realm, lines: ReportLine[]): void {
  const g = P.realm.truceTrade
  if (g <= 0) return
  for (const key of Object.keys(r.relations ?? {}).sort()) {
    const rel = r.relations[key]!
    if (rel.state !== 'truce' && rel.state !== 'ally') continue
    const [a, b] = key.split('|') as [string, string]
    if (r.factions[a] === undefined || r.factions[b] === undefined) continue
    stockOf(r, a).grain += g
    stockOf(r, b).grain += g
    lines.push({ kind: 'market', a, b, grain: g })
    addFavor(r, a, b, P.realm.favorMarket)
    // 철 장터 — 철광을 쥔 쪽이 없는 쪽에 판다 (변진의 철을 이웃이 사 간다)
    const mineA = Object.values(r.nodes).some((n) => n.owner === a && n.kind === 'ironMine')
    const mineB = Object.values(r.nodes).some((n) => n.owner === b && n.kind === 'ironMine')
    if (mineA !== mineB) {
      const [seller, buyer] = mineA ? [a, b] : [b, a]
      const price = P.realm.marketIronPrice
      const n = Math.min(P.realm.marketIron, Math.floor(stockOf(r, seller).iron), price > 0 ? Math.floor(stockOf(r, buyer).grain / price) : Infinity)
      if (n > 0) {
        pay(r, seller, buyer, { iron: n })
        payGoods(r, buyer, seller, { grain: n * price })
        lines.push({ kind: 'ironMarket', from: seller, to: buyer, iron: n, grain: n * price })
      }
    }
  }
}

/** 9 — 동맹끼리 본 것을 나눈다: 고을마다 더 새로 본 군세·경계를 서로 가진다. 땅은 하나라도 알면 둘 다 안다 */
export function shareIntel(r: Realm): void {
  for (const key of Object.keys(r.relations ?? {}).sort()) {
    if (r.relations[key]!.state !== 'ally') continue
    const [a, b] = key.split('|') as [string, string]
    const ia = r.intel[a]
    const ib = r.intel[b]
    if (ia === undefined || ib === undefined) continue
    for (const node of [...new Set([...Object.keys(ia), ...Object.keys(ib)])].sort()) {
      const x = ia[node]
      const y = ib[node]
      const force = !x?.force ? (y?.force ?? null) : !y?.force ? x.force : x.force.season >= y.force.season ? x.force : y.force
      const alert = !x?.alert ? (y?.alert ?? null) : !y?.alert ? x.alert : x.alert.season >= y.alert.season ? x.alert : y.alert
      ia[node] = { land: true, force: force === null ? null : { ...force }, alert: alert === null ? null : { ...alert } }
      ib[node] = { land: true, force: force === null ? null : { ...force }, alert: alert === null ? null : { ...alert } }
    }
  }
}

/** `owner` 가 이 나라의 동맹과 전쟁 중인가 — 동맹 AI 는 같은 적을 먼저 친다 (P.realm.aiAllyFocus) */
export function allyFoe(r: Realm, faction: string, owner: string | null): boolean {
  if (owner === null || owner === faction) return false
  for (const x of Object.keys(r.factions).sort()) {
    if (x === faction || x === owner) continue
    if (relationOf(r, faction, x).state === 'ally' && relationOf(r, x, owner).state === 'war') return true
  }
  return false
}

/** 한 나라의 힘 — 제 고을마다 머무는 군대와 장정 (정보가 다루는 F 와 같은 잣대) */
export function nationPower(r: Realm, faction: string): number {
  const m = memoFor(r)
  const hit = m?.power.get(faction)
  if (hit !== undefined) return hit
  let f = 0
  for (const n of Object.values(r.nodes)) if (n.owner === faction) f += nodeStrength(r, n.id, faction)
  m?.power.set(faction, f)
  return f
}

/** `asker` 의 정보로 본 `faction` 의 힘 — 본 고을은 범위, 못 본 고을은 0~envoyUnknownNode */
export function powerRange(r: Realm, asker: string, faction: string): [number, number] {
  const m = memoFor(r)
  const key = `${asker}>${faction}`
  const hit = m?.range.get(key)
  if (hit !== undefined) return [hit[0], hit[1]]
  const known = r.intel[asker] ?? {}
  let lo = 0
  let hi = 0
  for (const n of Object.values(r.nodes)) {
    if (n.owner !== faction) continue
    const k = known[n.id]?.force
    const v = k ? visibleRange({ f0: k.f0, src: k.src, u: k.u }, r.season - k.season) : null
    if (v !== null) {
      lo += v[0]
      hi += v[1]
    } else hi += P.realm.envoyUnknownNode
  }
  m?.range.set(key, [lo, hi])
  return [lo, hi]
}

/** 몫의 값 (곡식으로 친) — 물건 다섯 (economy.goodsWorth) */
function worth(x: Goods): number {
  return goodsWorth(x)
}

function atWarWithSame(r: Realm, a: string, b: string): boolean {
  for (const x of Object.keys(r.factions)) {
    if (x === a || x === b) continue
    if (relationOf(r, a, x).state === 'war' && relationOf(r, b, x).state === 'war') return true
  }
  return false
}

/** 받아들일 확률 — 힘의 비 `ratio`(묻는 쪽 / 받는 쪽)에 대해 줄지 않는다 (범위를 끝점 둘로 셀 수 있게) */
function chanceAt(
  r: Realm,
  from: string,
  to: string,
  ask: EnvoyAsk,
  ratio: number,
  give: Goods,
  take: Goods,
  hero?: string,
): number {
  const R = P.realm
  const rel = relationOf(r, from, to).state
  const mind = r.factions[to]?.mind
  const pw = (x: number): number => R.envoyPower * Math.max(-1, Math.min(R.envoyPowerCap - 1, x))
  let p: number
  switch (ask) {
    // 받는 쪽도 제 속셈으로 본다 — 제게도 멈출 까닭이 있으면 더 받고, 이기고 있는 싸움이면 잘 안 받는다 (stance.ts)
    case 'truce':
      p = R.envoyTruce + pw(ratio - 1) + (mind === 'cautious' ? R.envoyCautious : mind === 'greedy' ? R.envoyGreedy : 0)
        + (truceWhy(r, to, from) !== null ? R.envoyMotive : 0) + (winningAgainst(r, to, from) ? R.envoyWinning : 0)
      break
    case 'trade':
      // 받는 쪽은 제게 없는 것을 더 쳐 준다 (뭍의 나라가 소금을 · 골포가 철을)
      p = R.envoyTrade + R.envoyGain * ((goodsWorth(give, r, to) - worth(take)) / Math.max(1, worth(take)))
      break
    case 'tribute':
      p = R.envoyTribute + pw(ratio - R.envoyTributePower)
      break
    case 'alliance':
    {
      const w = allianceWhy(r, to, from)?.why
      p = R.envoyAlliance + pw(ratio - 1) / 2 + (atWarWithSame(r, from, to) ? R.envoyCommonFoe : 0)
        + (mind === 'cautious' ? R.envoyCautious : mind === 'greedy' ? R.envoyGreedy : 0)
        + (w !== undefined && w !== 'commonFoe' ? R.envoyMotive : 0)
      break
    }
    // 선물·깨기는 늘 된다 — 받는 쪽이 고르는 일이 아니다
    case 'gift':
      if (R.envoyGiftAlways >= 1) return 1
      p = R.envoyMax
      break
    case 'break':
      return 1
    case 'joint':
      p = R.envoyJoint + pw(ratio - 1) / 2
      break
    case 'aid': {
      // 내줄 여유가 적을수록 덜 준다 — 바라는 것이 그 나라 창고의 aidMaxShare 를 넘으면 그만큼 깎인다
      const spare = Math.max(1, worth(stockOf(r, to)) * R.aidMaxShare)
      p = R.envoyAid - Math.max(0, worth(take) / spare - 1) * 0.3
      break
    }
    case 'troops':
      p = R.envoyTroops + pw(ratio - 1) / 2
      break
  }
  p += envoyBonus(r, from, ask, hero) // 군주 매력 + 따라간 장수의 매력 · 매혹 · 장사꾼 (heroes.ts)
  p += R.envoyFavor * favorOf(r, from, to) // 호감
  if (rel === 'war') p += R.envoyWar
  else if (rel === 'truce' || rel === 'ally') p += R.envoyFriend
  return Math.min(R.envoyMax, Math.max(R.envoyMin, p))
}

const NONE = { grain: 0, iron: 0 }

/**
 * 받아들일 확률의 범위 — **묻는 쪽(from)의 정보로** (FLOW §4 · 정보의 계약).
 * 우리 힘은 안다. 그들의 힘은 본 고을의 범위 + 못 본 고을 0~envoyUnknownNode.
 * 교역의 몫은 기본(빈 손)으로 셈한다 — 몫까지 넣은 값은 envoyChanceFor.
 */
export function envoyChance(r: Realm, from: string, to: string, ask: EnvoyAsk): readonly [number, number] {
  return envoyChanceFor(r, from, to, ask, NONE, NONE)
}

export function envoyChanceFor(
  r: Realm,
  from: string,
  to: string,
  ask: EnvoyAsk,
  give: Goods,
  take: Goods,
  hero?: string,
): readonly [number, number] {
  const mine = nationPower(r, from)
  const [lo, hi] = powerRange(r, from, to)
  const a = chanceAt(r, from, to, ask, mine / Math.max(1, hi), give, take, hero)
  const b = chanceAt(r, from, to, ask, mine / Math.max(1, lo), give, take, hero)
  return [Math.min(a, b), Math.max(a, b)]
}

/** 참값의 한 점 — 판정에 쓴다 (envoyChance 의 범위 안에 든다) */
export function envoyTrueChance(
  r: Realm,
  from: string,
  to: string,
  ask: EnvoyAsk,
  give: Goods,
  take: Goods,
  hero?: string,
): number {
  return chanceAt(r, from, to, ask, nationPower(r, from) / Math.max(1, nationPower(r, to)), give, take, hero)
}

const canPay = canPayGoods
/** 몫을 옮기고, 철이 오갔으면 두 나라 교역 장부에 적는다 (철과 뱃길 — paths.ts) */
const pay = (r: Realm, from: string, to: string, x: Partial<Record<Good, number>>): void => {
  payGoods(r, from, to, x)
  noteIron(r, from, to, goodOf(x, 'iron'))
}

/**
 * 사신을 따라갈 수 있는 장수인가 — 우리 장수 · 자유 · 군대를 이끌지 않는다 · 군주가 아니다 · 다치지 않았다.
 * (형: "장사꾼 장수는 특별히 뭘 할 수 없잖아. 사신 보낼 때 같이 보내는 것도 아니고")
 */
export function canEscort(r: Realm, faction: string, hero: string): boolean {
  const h = r.heroes[hero]
  if (h === undefined || h.faction !== faction || h.status !== 'free') return false
  if (r.factions[faction]?.ruler === hero) return false
  if (h.woundedUntil !== undefined && h.woundedUntil >= r.season) return false
  if (h.awayUntil !== undefined && h.awayUntil >= r.season) return false
  return !Object.values(r.armies).some((a) => a.hero === hero)
}

/**
 * 2 — 사신. 한 계절에 **상대 나라마다** 하나씩 보낼 수 있다 (형: "한 턴에 외교나 거래나 한쪽밖에 못한다는데 말이 안돼").
 * 같은 상대에게 둘을 보내면 첫 것만. 받는 쪽이 플레이어면 아무 일도 없다 (플레이어에게는 청 — makeAsks)
 */
export function resolveEnvoys(r: Realm, orders: readonly Order[], lines: ReportLine[]): void {
  const R = P.realm
  const sent = new Set<string>()
  for (const o of orders) {
    if (o.kind !== 'envoy') continue
    const pair = `${o.from}>${o.to}`
    if (sent.has(pair) || o.from === o.to) continue
    if (r.factions[o.from] === undefined || r.factions[o.to] === undefined) continue
    // 플레이어에게는 사신 대신 청이 간다 — 다만 약조를 깨는 것은 청이 아니라 통보다
    if (r.factions[o.to]!.mind === 'player' && o.ask !== 'break') continue
    // 그 사이에서 할 수 없는 사신은 안 간다 (전쟁 중에 동맹을 청할 수는 없다 — envoyOptions)
    if (!envoyOptions(r, o.from, o.to).includes(o.ask)) continue
    // 함께 치자 — 칠 고을이 있어야 하고 · 군대 빌리기 — 지킬 우리 고을이 있어야 한다
    if (o.ask === 'joint' && (o.target === undefined || !jointTargets(r, o.from, o.to).includes(o.target))) continue
    if (o.ask === 'troops' && (o.target === undefined || r.nodes[o.target]?.owner !== o.from)) continue
    sent.add(pair)
    const give = o.ask === 'tribute' || o.ask === 'aid' || o.ask === 'joint' || o.ask === 'troops' || o.ask === 'break' ? NONE : o.give
    const take = o.ask === 'trade' || o.ask === 'tribute' || o.ask === 'aid' ? o.take : NONE
    if (!canPay(r, o.from, give)) continue
    // 따라가는 장수 — 그 장수의 매력·특성이 걸리고, 이 계절엔 자리를 비운다
    const escort = o.hero !== undefined && canEscort(r, o.from, o.hero) ? o.hero : undefined
    if (escort !== undefined) r.heroes[escort]!.awayUntil = r.season
    // 싸우는 나라에 이름난 장수를 보내면 붙잡힐 수 있다 (VICTORY §2-2 — 외교관 하나가 너무 중요해지지 않게)
    if (escort !== undefined && relationOf(r, o.from, o.to).state === 'war' && roll(r.seed, r.season, `envoyHeld:${o.from}:${o.to}`) < R.envoyHeldWar) {
      const h = r.heroes[escort]!
      h.status = 'captive'
      h.captor = o.to
      h.at = null
      h.post = null
      lines.push({ kind: 'envoyHeld', from: o.from, to: o.to, hero: escort })
      continue
    }
    const p = envoyTrueChance(r, o.from, o.to, o.ask, give, take, escort)
    let accepted = p >= 1 || roll(r.seed, r.season, `envoy:${o.from}:${o.to}`) < p
    if (accepted && o.ask === 'trade' && !canPay(r, o.to, take)) accepted = false // 받는 쪽이 내놓을 것이 없으면 안 선다
    // 군대 빌리기 — 내줄 군대가 없으면(국읍의 마지막 군대뿐이거나 길이 없으면) 못 빌려준다
    const lend = accepted && o.ask === 'troops' ? lenderArmy(r, o.to, o.from, o.target!) : null
    if (o.ask === 'troops' && lend === null) accepted = false
    lines.push({
      kind: 'envoy', from: o.from, to: o.to, ask: o.ask, accepted, ...(o.why !== undefined ? { why: o.why } : {}), ...(o.about !== undefined ? { about: o.about } : {}),
      ...(escort !== undefined ? { hero: escort } : {}),
    })
    if (!accepted) {
      // 조공 요구를 거절당하면 그 자리에서 전쟁이다
      if (o.ask === 'tribute') setRelation(r, o.from, o.to, 'war', null, lines, { by: o.from, why: 'tribute' })
      continue
    }
    pay(r, o.from, o.to, give)
    switch (o.ask) {
      case 'truce':
        setRelation(r, o.from, o.to, 'truce', r.season + R.truceSeasons, lines)
        addFavor(r, o.from, o.to, R.favorAccept)
        break
      case 'alliance':
        setRelation(r, o.from, o.to, 'ally', null, lines)
        addFavor(r, o.from, o.to, R.favorAccept)
        break
      case 'trade':
        pay(r, o.to, o.from, take)
        addFavor(r, o.from, o.to, R.favorTrade)
        break
      case 'tribute': {
        const s = stockOf(r, o.to)
        pay(r, o.to, o.from, { grain: Math.min(take.grain, s.grain), iron: Math.min(take.iron, s.iron) })
        // 바치기로 했으니 조공국이다 — 칼을 거두고 화친한다
        makeVassal(r, o.to, o.from)
        if (relationOf(r, o.from, o.to).state !== 'ally') setRelation(r, o.from, o.to, 'truce', r.season + R.truceSeasons, lines, { by: o.to, why: 'envoy' })
        break
      }
      case 'gift':
        addFavor(r, o.from, o.to, Math.min(R.favorGiftMax, worth(give) * R.favorGift))
        break
      case 'break':
        breakPact(r, o.from, o.to, lines)
        break
      case 'joint':
        // 그쪽이 약속한다 — pledgeSeasons 안에 그 고을을 친다
        pledge(r, o.to, o.from, o.target!)
        addFavor(r, o.from, o.to, R.favorAccept / 2)
        break
      case 'aid': {
        const s = stockOf(r, o.to)
        const cap = R.aidMaxShare
        pay(r, o.to, o.from, { grain: Math.min(take.grain, Math.floor(s.grain * cap)), iron: Math.min(take.iron, Math.floor(s.iron * cap)) })
        break
      }
      case 'troops': {
        const a = r.armies[lend!]!
        a.lent = { to: o.from, node: o.target!, until: r.season + R.troopsSeasons }
        lines.push({ kind: 'lent', from: o.to, to: o.from, node: o.target!, army: a.id, back: false })
        break
      }
    }
  }
}

/**
 * 화친·동맹을 우리 쪽에서 깬다 — 중립이 되고, 깬 나라와의 호감이 크게 깎이고, **다른 나라들도 호감이 준다** (신의의 값).
 * 그 나라에 빌려준(빌린) 군대도 돌아간다 (stepLent).
 */
function breakPact(r: Realm, from: string, to: string, lines: ReportLine[]): void {
  const R = P.realm
  const s = relationOf(r, from, to).state
  if (s !== 'truce' && s !== 'ally') return
  setRelation(r, from, to, 'neutral', null, lines, { by: from, why: 'break' })
  addFavor(r, from, to, -R.favorBreakSelf)
  for (const x of Object.keys(r.factions).sort()) if (x !== from && x !== to) addFavor(r, from, x, -R.favorBreakOthers)
}

/**
 * 청(請) — 남의 나라가 플레이어에게 거는 것 (형: "적이 뭔가 거래를 걸어온다거나 동맹요구하거나 그런거 없어?" — 2026-10-18).
 * 계절 끝에 AI 가 만들고(makeAsks), 플레이어는 다음 계절에 답한다(answer 명령 → resolveAnswers). 답이 없으면 거절.
 * 무엇을 청하나는 그 나라의 **속셈**이 정한다 (stance.ts) — 청마다 까닭(why)이 붙어 화면에 말로 보인다:
 *   화친 — 밀린다 · 두 쪽 싸움 · 굶주림 · 앞서가는 나라 (이기고 있는 싸움이면 안 청한다)
 *   동맹 — 같은 적 · 앞서가는 나라 · 가까워짐      맞바꿈 — 남는 것이 있다
 *   바침 — 훨씬 약하다      요구 — 훨씬 세다      함께 치자·보태 달라 — 동맹이라
 */

const NO_GOODS = { grain: 0, iron: 0 }

/** 지금 이 나라가 답할 수 있는 청 — id 순서 */
export function openAsks(r: Realm, faction: string): Ask[] {
  return (r.asks ?? []).filter((a) => a.to === faction && a.until >= r.season).sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0))
}

/** 맞바꿈 제안 — 그쪽이 남는 것을 내고 모자란 것을 받는다. 서로 낼 것이 없으면 null */
export function tradeOffer(r: Realm, from: string, to: string): { give: Goods; take: Goods } | null {
  const R = P.realm
  const a = stockOf(r, from)
  const b = stockOf(r, to)
  // 물건 다섯 — 우리에게 모자라고 그쪽에 넉넉한 것을, 우리가 남는 것과 바꾼다 (형: "자원들도 다각화")
  const lot = (g: Good): number => Math.max(1, Math.round(R.tradeLot / worthOf(g)))
  const plenty = (s: typeof a, g: Good): boolean => goodOf(s, g) >= lot(g) * (g === 'grain' ? 4 : 2)
  const short = (s: typeof a, g: Good): boolean => goodOf(s, g) < lot(g)
  for (const want of TRADE_ORDER) {
    if (!short(a, want) || !plenty(b, want)) continue
    for (const give of TRADE_ORDER) {
      if (give === want || !plenty(a, give)) continue
      return { give: goodsOne(give, lot(give)), take: goodsOne(want, lot(want)) }
    }
  }
  // 모자란 것이 없으면 옛 맞바꿈 — 철과 곡식
  const iron = R.askTradeIron
  const grain = Math.round(iron * R.envoyIronWorth)
  if (a.iron >= iron * 2 && b.grain >= grain) return { give: { grain: 0, iron }, take: { grain, iron: 0 } }
  if (a.grain >= grain * 3 && b.iron >= iron) return { give: { grain, iron: 0 }, take: { grain: 0, iron } }
  return null
}

/** 맞바꿀 때 먼저 보는 순서 — 철 · 소금 · 말 · 나무 · 곡식 */
const TRADE_ORDER: readonly Good[] = ['iron', 'salt', 'horse', 'wood', 'grain']

/** 한 나라가 플레이어에게 걸 청 하나 — 걸 거리가 없으면 null. 굴림은 `ask-kind:<season>:<from>` */
function pickAsk(r: Realm, from: string, to: string): Ask | null {
  const R = P.realm
  const rel = relationOf(r, from, to).state
  const ratio = nationPower(r, to) / Math.max(1, nationPower(r, from)) // 플레이어가 이 나라의 몇 배인가
  const mind = r.factions[from]?.mind
  const mine = stockOf(r, from)
  const theirs = stockOf(r, to)
  const round10 = (x: number): number => Math.max(10, Math.round(x / 10) * 10)
  const opts: Array<{ kind: AskKind; w: number; give: { grain: number; iron: number }; take: { grain: number; iron: number }; node?: string } & Motive> = []
  const strong = 1 / Math.max(1e-9, ratio) >= R.askDemandPower
  const fav = favorOf(r, from, to)
  // 호감이 아주 낮으면 화친도 동맹도 안 청하고 조공을 요구한다
  const hostile = fav <= R.favorHostile
  // 화친·동맹은 까닭이 있을 때만 (stance.ts) — 이기고 있는 나라가 갑자기 화친하자고 하지 않는다
  const tw = hostile ? null : truceWhy(r, from, to)
  if (tw !== null) opts.push({ kind: 'truce', w: tw.why === 'losing' || tw.why === 'hungry' ? 4 : 2, give: NO_GOODS, take: NO_GOODS, ...tw })
  const aw = allianceWhy(r, from, to)
  if (aw !== null) opts.push({ kind: 'alliance', w: aw.why === 'favor' ? 2 : 3, give: NO_GOODS, take: NO_GOODS, ...aw })
  if (rel !== 'war' && !hostile) {
    const t = tradeOffer(r, from, to)
    if (t !== null) opts.push({ kind: 'trade', w: 2, ...t, why: 'surplus' })
  }
  // 동맹의 부탁 — 함께 치자 (그쪽이 싸우는 적의 고을 가운데 우리가 닿는 곳) · 곡식이 모자라면 보태 달라
  if (rel === 'ally') {
    const foes = jointTargets(r, from, to).filter((n) => {
      const o = r.nodes[n]!.owner!
      return relationOf(r, from, o).state === 'war'
    })
    if (foes.length > 0) {
      const node = foes[Math.floor(roll(r.seed, r.season, `ask-joint:${from}`) * foes.length)]!
      opts.push({ kind: 'joint', w: R.askJointWeight, give: NO_GOODS, take: NO_GOODS, node, why: 'commonFoe', about: r.nodes[node]!.owner! })
    }
    const need = Math.ceil(menOf(r, from) * R.rationPerSoldier * 2)
    if (mine.grain < need && theirs.grain >= 40) {
      opts.push({ kind: 'aid', w: R.askAidWeight, give: NO_GOODS, take: { grain: round10(Math.min(theirs.grain * R.aidMaxShare, need - mine.grain)), iron: 0 }, why: 'hungry' })
    }
  }
  // 바침 — 훨씬 약한 나라가 우리를 두려워할 때 (싸우는 중이면 이기고 있지 않을 때)
  if ((rel === 'war' || rel === 'neutral') && ratio >= R.askTributePower && mine.grain >= 20 && !winningAgainst(r, from, to)) {
    opts.push({ kind: 'tribute', w: mind === 'cautious' ? 3 : 1, give: { grain: round10(mine.grain * R.askTributeShare), iron: 0 }, take: NO_GOODS, why: 'weak' })
  }
  if ((rel === 'war' || (rel === 'neutral' && (mind === 'greedy' || hostile))) && strong && theirs.grain >= 20) {
    opts.push({ kind: 'demand', w: hostile ? 4 : 2, give: NO_GOODS, take: { grain: round10(theirs.grain * R.askDemandShare), iron: 0 }, why: 'strong' })
  }
  const live = opts.filter((o) => o.w > 0)
  const total = live.reduce((s, o) => s + o.w, 0)
  if (total <= 0) return null
  let x = roll(r.seed, r.season, `ask-kind:${from}`) * total
  const o = live.find((c) => (x -= c.w) < 0) ?? live[live.length - 1]!
  const ask: Ask = {
    id: `ask:${r.season}:${from}`, from, to, kind: o.kind, give: o.give, take: o.take, until: r.season + 1, why: o.why,
    ...(o.about !== undefined ? { about: o.about } : {}),
  }
  return o.node !== undefined ? { ...ask, node: o.node } : ask
}

/** 9 — 계절 끝: AI 나라들이 플레이어에게 청을 건다. 나라마다 aiAskChance, 플레이어는 계절에 askMaxPerSeason 까지 */
export function makeAsks(r: Realm, lines: ReportLine[]): void {
  const R = P.realm
  const me = r.player
  if (me === undefined || r.factions[me] === undefined || r.outcome) return
  const alive = (f: string): boolean => Object.values(r.nodes).some((n) => n.owner === f)
  if (!alive(me)) return
  let made = 0
  for (const f of Object.keys(r.factions).sort()) {
    if (made >= R.askMaxPerSeason) break
    if (f === me || r.factions[f]!.mind === 'player' || !alive(f) || !knows(r, f, me)) continue // 모르는 나라에는 청을 못 건다 (발견)
    if (roll(r.seed, r.season, `ask:${f}`) >= R.aiAskChance) continue
    const ask = pickAsk(r, f, me)
    if (ask === null) continue
    ;(r.asks ??= []).push(ask)
    lines.push({ kind: 'ask', ask })
    made++
  }
}

/**
 * 1 — 청에 답한다. 이번 계절이 마감인 청은 모두 여기서 끝난다: 받기 명령이 있으면 받고, 없으면 거절.
 * 받았는데 낼 것이 모자라면 거절로 친다. 조공 요구를 거절하면 전쟁이다.
 */
export function resolveAnswers(r: Realm, orders: readonly Order[], lines: ReportLine[]): void {
  const R = P.realm
  const due = (r.asks ?? []).filter((a) => a.until <= r.season).sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0))
  if (due.length === 0) return
  r.asks = (r.asks ?? []).filter((a) => a.until > r.season)
  for (const a of due) {
    if (r.factions[a.from] === undefined || r.factions[a.to] === undefined) continue
    const ans = orders.find((o): o is Extract<Order, { kind: 'answer' }> => o.kind === 'answer' && o.ask === a.id)
    let yes = ans?.yes === true
    if (yes) {
      switch (a.kind) {
        case 'truce':
          setRelation(r, a.from, a.to, 'truce', r.season + R.truceSeasons, lines)
          break
        case 'alliance':
          setRelation(r, a.from, a.to, 'ally', null, lines)
          break
        case 'trade':
          if (canPay(r, a.from, a.give) && canPay(r, a.to, a.take)) {
            pay(r, a.from, a.to, a.give)
            pay(r, a.to, a.from, a.take)
          } else yes = false
          break
        case 'tribute': {
          const s = stockOf(r, a.from)
          pay(r, a.from, a.to, { grain: Math.min(a.give.grain, s.grain), iron: Math.min(a.give.iron, s.iron) })
          makeVassal(r, a.from, a.to) // 바치겠다는 나라 — 받아 주면 우리 조공국
          if (relationOf(r, a.from, a.to).state !== 'ally') setRelation(r, a.from, a.to, 'truce', r.season + R.truceSeasons, lines)
          break
        }
        case 'demand':
          if (canPay(r, a.to, a.take)) {
            pay(r, a.to, a.from, a.take)
            makeVassal(r, a.to, a.from) // 요구를 들어주면 그 나라의 조공국이 된다
            if (relationOf(r, a.from, a.to).state !== 'ally') setRelation(r, a.from, a.to, 'truce', r.season + R.truceSeasons, lines)
          } else yes = false
          break
        case 'joint':
          // 우리가 약속한다 — pledgeSeasons 안에 그 고을을 친다 (안 치면 checkPledges 가 호감을 크게 깎는다)
          if (a.node !== undefined && relationOf(r, a.from, a.to).state === 'ally') pledge(r, a.to, a.from, a.node)
          else yes = false
          break
        case 'aid':
          if (canPay(r, a.to, a.take)) pay(r, a.to, a.from, a.take)
          else yes = false
          break
      }
    }
    lines.push({ kind: 'answered', ask: a.id, yes, from: a.from, askKind: a.kind })
    if (!yes && a.kind === 'demand') setRelation(r, a.from, a.to, 'war', null, lines, { by: a.from, why: 'demand' })
    // 호감 — 받아 주면 오르고, 거절하면 조금 · 동맹의 부탁을 저버리면 크게 내린다
    if (yes) addFavor(r, a.from, a.to, R.favorAccept)
    else addFavor(r, a.from, a.to, -(a.kind === 'joint' || a.kind === 'aid' ? R.favorRefuseAlly : R.favorReject))
  }
}
