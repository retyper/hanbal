/**
 * 나라 살림 — 가호 · 곡식 · 철 · 징병 (docs/realm/FLOW.md §1·§2 · SYSTEMS §7-6 의 최소판)
 *
 * 한 해의 흐름이 숫자로 선다:
 *   봄   — 심는다. 봄이 끝날 때의 가호가 `sown` 이 된다 → 가을 수확을 정한다. 봄에 징병하면 그해 농사가 준다
 *   가을 — 거둔다. sown × harvestPerHH 가 국읍 창고로
 *   늘   — 군대는 곡식을 먹는다 (겨울 × winterRation). 바닥나면 사기가 떨어지고 가호가 준다
 *         곡식이 있고 싸움이 없던 고을은 가호가 조금씩 는다
 * 장정(군대 없는 고을을 지키는 사람)도 가호에 비례한다.
 * 개척 — 제 고을 사람을 맞닿은 빈땅으로 옮긴다 (settleLimit). 새 마을은 품(room)까지 settleGrow 로 빨리 큰다.
 *
 * 순수 함수만 — season.ts 가 부른다. 이 파일은 season.ts 를 부르지 않는다 (고리를 만들지 않는다).
 */
import { P } from '../tune/params.ts'
import { blockedWhy, seasonOf } from './calendar.ts'
import { draftCapBonus, gluttonMen, growMul, harvestMul, militiaMul, riteMul } from './heroes.ts'
import type { Equip, UnitKind } from './battle.ts'
import { TIERS, kitOf, lowestTier, nextTier, upgradeKind } from './kit.ts'
import type { Army, BuildWhat, Good, Goods, Order, ReportLine, Realm, RNode, Stock } from './types.ts'

function menIn(mix: Readonly<Partial<Record<string, number>>>): number {
  let n = 0
  for (const v of Object.values(mix)) n += v ?? 0
  return n
}

/** 한 나라의 군사 수 — 머무는 군대와 길 위의 군대 모두 */
export function menOf(r: Realm, faction: string): number {
  let n = 0
  for (const a of Object.values(r.armies)) if (a.faction === faction) n += menIn(a.mix)
  return n
}

/** 한 나라의 가호 합 */
export function hhOf(r: Realm, faction: string): number {
  let n = 0
  for (const node of Object.values(r.nodes)) if (node.owner === faction) n += node.hh
  return n
}

export function stockOf(r: Realm, faction: string): Stock {
  return (r.stock[faction] ??= { grain: 0, iron: 0 })
}

// ───────── 물건 다섯 (형: "자원들도 다각화해야할거같은데" — 2026-10-18)

/** 창고·몫의 것 — 셈하는 순서 (결정론) */
export const GOODS: readonly Good[] = ['grain', 'iron', 'salt', 'wood', 'horse']

/** 몫 하나의 그 물건 — 없으면 0 (옛 저장에는 소금·나무·말이 없다) */
export function goodOf(x: Partial<Record<Good, number>> | undefined, g: Good): number {
  const v = x?.[g]
  return typeof v === 'number' && Number.isFinite(v) ? v : 0
}

/** 그 물건 하나가 곡식 몇의 값인가 */
export function worthOf(g: Good): number {
  const R = P.realm
  switch (g) {
    case 'grain': return 1
    case 'iron': return R.envoyIronWorth
    case 'salt': return R.worthSalt
    case 'wood': return R.worthWood
    case 'horse': return R.worthHorse
  }
}

/** 몫의 값 (곡식으로 친) — `faction` 을 주면 그 나라에 없는 것은 worthLackMul 배로 친다 (뭍의 나라가 소금을 탐낸다) */
export function goodsWorth(x: Partial<Record<Good, number>>, r?: Realm, faction?: string): number {
  let w = 0
  for (const g of GOODS) {
    const n = goodOf(x, g)
    if (n === 0) continue
    const lack = r !== undefined && faction !== undefined && g !== 'grain' && goodOf(stockOf(r, faction), g) <= 0
    w += n * worthOf(g) * (lack ? P.realm.worthLackMul : 1)
  }
  return w
}

/** 한 가지만 담은 몫 */
export function goodsOne(g: Good, n: number): Goods {
  return g === 'grain' ? { grain: n, iron: 0 } : g === 'iron' ? { grain: 0, iron: n } : { grain: 0, iron: 0, [g]: n }
}

/** 이 나라 창고가 그 몫을 낼 수 있나 */
export function canPayGoods(r: Realm, faction: string, x: Partial<Record<Good, number>>): boolean {
  const s = stockOf(r, faction)
  return GOODS.every((g) => goodOf(x, g) >= 0 && goodOf(s, g) >= goodOf(x, g))
}

/** 몫을 옮긴다 (모자라도 그대로 — 먼저 canPayGoods 로 본다) */
export function payGoods(r: Realm, from: string, to: string, x: Partial<Record<Good, number>>): void {
  const a = stockOf(r, from)
  const b = stockOf(r, to)
  for (const g of GOODS) {
    const n = goodOf(x, g)
    if (n === 0) continue
    a[g] = goodOf(a, g) - n
    b[g] = goodOf(b, g) + n
  }
}

/** 창고에 더한다 (빼려면 음수) */
export function addGood(r: Realm, faction: string, g: Good, n: number): void {
  const s = stockOf(r, faction)
  s[g] = goodOf(s, g) + n
}

/** 바닷가 고을 — 항구이거나 뱃길·갯벌이 닿는다. 소금과 물고기가 난다 */
export function isCoast(r: Realm, node: string): boolean {
  const n = r.nodes[node]
  if (n === undefined || n.kind === 'sodo') return false
  if (n.kind === 'port') return true
  return Object.values(r.edges).some((e) => (e.a === node || e.b === node) && (e.kind === 'sea' || e.kind === 'mudflat'))
}

/** 나무가 나는 고을 — 솔숲·높은 터·산성이거나 숲길이 닿는다 */
export function isWoody(r: Realm, node: string): boolean {
  const n = r.nodes[node]
  if (n === undefined || n.kind === 'sodo') return false
  if (n.tags.includes('pines') || n.tags.includes('high') || n.kind === 'fort') return true
  return Object.values(r.edges).some((e) => (e.a === node || e.b === node) && e.kind === 'forest')
}

/** 그 고을이 계절마다 내는 것 — 화면·첩보·AI 가 함께 쓴다. 사람이 안 사는 빈땅은 아무것도 안 낸다 */
export function nodeYield(r: Realm, node: string, season = seasonOf(r.season)): Partial<Record<Good, number>> {
  const R = P.realm
  const n = r.nodes[node]
  if (n === undefined || n.owner === null || n.kind === 'sodo' || (n.kind === 'wild' && n.hh <= 0)) return {}
  const out: Partial<Record<Good, number>> = {}
  if (n.kind === 'ironMine') out.iron = R.ironPerMine
  if (n.kind === 'port') out.iron = (out.iron ?? 0) + R.ironPerPort
  if (isCoast(r, node)) {
    out.salt = R.saltPerCoast
    if (season !== 'winter') out.grain = Math.round(n.hh * R.fishPerHH)
  }
  if (isWoody(r, node)) out.wood = R.woodPerNode
  if (n.tags.includes('pasture')) out.horse = R.horsePerPasture
  return out
}

/** 제 땅 밖에 나가 있는 군사 — 길 위이거나 남의 땅에 머문다 (절인 양식이 든다) */
export function awayMen(r: Realm, faction: string): number {
  let n = 0
  for (const a of Object.values(r.armies)) {
    if (a.faction !== faction) continue
    if (a.march !== null || r.nodes[a.at]?.owner !== faction) n += menIn(a.mix)
  }
  return n
}

/** 밖에 나간 군사의 소금 — 이만큼 있으면 군량이 늘지 않는다 */
export function awaySalt(r: Realm, faction: string): number {
  return Math.ceil(awayMen(r, faction) * P.realm.saltPerAway)
}

/** 장정 (SYSTEMS §4-6 · FLOW §2) — 그 고을 가호에 비례. 산성은 사람은 적어도 성이 높다 */
export function militiaMen(r: Realm, node: string): number {
  const R = P.realm
  const n = r.nodes[node]
  if (n === undefined || n.owner === null || n.kind === 'sodo') return 0
  // 매수당한 고을 — 장정이 서지 않는다 (plots.ts bribe)
  const bribed = r.watch[node]?.bribedUntil
  if (bribed !== undefined && bribed >= r.season) return 0
  // 그 나라의 국읍이면 다 나와 막는다 (판이 끝나는 자리)
  const capital = r.factions[n.owner]?.capital === n.id
  return Math.round(n.hh * R.militiaPerHH * (n.kind === 'fort' ? R.militiaFortMul : 1) * (capital ? R.militiaCapitalMul : 1) * militiaMul(r, node))
}

export function draftCost(n: number): { grain: number } {
  return { grain: Math.ceil(n * P.realm.draftGrain) }
}

/**
 * 이 고을에서 이번 계절에 뽑을 수 있는 수 — 셋 가운데 작은 것:
 * 고을 가호의 draftPerSeason · 나라 상한(가호+군사의 draftCap)까지 남은 몫 · 창고가 대는 채비
 */
export function draftLimit(r: Realm, faction: string, node: string, unit?: UnitKind): number {
  const R = P.realm
  const n = r.nodes[node]
  if (n === undefined || n.owner !== faction || n.kind === 'sodo') return 0
  const per = Math.floor(n.hh * R.draftPerSeason)
  const men = menOf(r, faction)
  const cap = Math.floor((R.draftCap + draftCapBonus(r, faction)) * (hhOf(r, faction) + men)) - men
  const grain = R.draftGrain > 0 ? Math.floor(stockOf(r, faction).grain / R.draftGrain) : Infinity
  // 배와 말 — 수군은 나무로 배를 짓고, 기병은 말이 있어야 한다
  const s = stockOf(r, faction)
  const goods = unit === 'boat' && R.boatWood > 0 ? Math.floor(goodOf(s, 'wood') / R.boatWood)
    : unit === 'horse' && R.horsePerRider > 0 ? Math.floor(goodOf(s, 'horse') / R.horsePerRider) : Infinity
  return Math.max(0, Math.min(per, cap, grain, goods))
}

/** 그 병종 n 명을 뽑는 데 곡식 말고 드는 것 — 수군은 나무(배), 기병은 말 */
export function draftNeeds(unit: UnitKind, n: number): { wood: number; horse: number } {
  const R = P.realm
  return { wood: unit === 'boat' ? Math.ceil(n * R.boatWood) : 0, horse: unit === 'horse' ? Math.ceil(n * R.horsePerRider) : 0 }
}

export function settleCost(n: number): { grain: number; wood: number } {
  return { grain: Math.ceil(n * P.realm.settleGrain), wood: Math.ceil(n * P.realm.settleWood) }
}

// ───────── 짓기 (나무의 쓰임)

/** 목책·해자의 값 */
export function buildCost(what: BuildWhat): { wood: number; grain: number } {
  const R = P.realm
  return what === 'palisade' ? { wood: R.buildPalisadeWood, grain: R.buildPalisadeGrain } : { wood: R.buildMoatWood, grain: R.buildMoatGrain }
}

/** 여기에 지금 지을 수 있나 — 제 고을 · 아직 없는 것 · 해자는 목책이 먼저 · 짓는 중이 아니다 · 창고가 댄다 */
export function canBuild(r: Realm, faction: string, node: string, what: BuildWhat): boolean {
  const n = r.nodes[node]
  if (n === undefined || n.owner !== faction || n.kind === 'sodo' || (n.kind === 'wild' && n.hh <= 0)) return false
  if (n.tags.includes(what)) return false
  if (what === 'moat' && !n.tags.includes('palisade')) return false
  if ((r.builds ?? []).some((b) => b.node === node)) return false
  const c = buildCost(what)
  const s = stockOf(r, faction)
  return goodOf(s, 'wood') >= c.wood && s.grain >= c.grain
}

/** 지을 수 있는 것 — 목책이 없으면 목책, 있으면 해자 */
export function nextBuild(r: Realm, node: string): BuildWhat | null {
  const n = r.nodes[node]
  if (n === undefined) return null
  if (!n.tags.includes('palisade')) return 'palisade'
  if (!n.tags.includes('moat')) return 'moat'
  return null
}

/** 1 — 짓기를 시작한다. 이 계절 끝에 선다 (stepBuilds) */
export function applyBuild(r: Realm, o: Extract<Order, { kind: 'build' }>, lines: ReportLine[]): void {
  if (!canBuild(r, o.faction, o.node, o.what)) return
  const c = buildCost(o.what)
  addGood(r, o.faction, 'wood', -c.wood)
  stockOf(r, o.faction).grain -= c.grain
  ;(r.builds ??= []).push({ faction: o.faction, node: o.node, what: o.what, done: r.season })
  lines.push({ kind: 'build', faction: o.faction, node: o.node, what: o.what, done: false })
}

/** 9 — 다 지은 것이 선다. 그 사이 고을을 잃었으면 무너진다 */
export function stepBuilds(r: Realm, lines: ReportLine[]): void {
  const keep: NonNullable<Realm['builds']> = []
  for (const b of r.builds ?? []) {
    if (b.done > r.season) {
      keep.push(b)
      continue
    }
    const n = r.nodes[b.node]
    if (n === undefined || n.owner !== b.faction || n.tags.includes(b.what)) continue
    r.nodes[b.node] = { ...n, tags: [...n.tags, b.what] }
    lines.push({ kind: 'build', faction: b.faction, node: b.node, what: b.what, done: true })
  }
  r.builds = keep
}

/** 이 길이 `from` 과 `to` 를 잇는가 — 이으면 그 길 */
function edgeBetween(r: Realm, from: string, to: string) {
  for (const id of Object.keys(r.edges).sort()) {
    const ed = r.edges[id]!
    if ((ed.a === from && ed.b === to) || (ed.a === to && ed.b === from)) return ed
  }
  return null
}

/**
 * 개척 (FLOW §2) — `from` 에서 빈땅 `to` 로 이번 계절에 보낼 수 있는 가호 수. 안 되면 0.
 * 셋 가운데 작은 것: from 가호의 settleShare · to 에 남은 품(room − hh) · 창고가 대는 곡식.
 * 길로 맞닿고 그 길이 이번 계절에 열려 있어야 하고, to 는 아무도 안 쥐었거나 제 땅이며 남의 군대가 머물지 않아야 한다.
 */
export function settleLimit(r: Realm, faction: string, from: string, to: string): number {
  const R = P.realm
  const a = r.nodes[from]
  const b = r.nodes[to]
  if (a === undefined || b === undefined || a.owner !== faction || a.kind === 'sodo') return 0
  if (b.kind !== 'wild' || (b.owner !== null && b.owner !== faction)) return 0
  const ed = edgeBetween(r, from, to)
  if (ed === null || blockedWhy(ed, seasonOf(r.season)) !== null) return 0
  if (Object.values(r.armies).some((x) => x.at === to && x.march === null && x.faction !== faction)) return 0
  const share = Math.floor(a.hh * R.settleShare)
  const room = Math.max(0, (b.room ?? 0) - b.hh)
  const grain = R.settleGrain > 0 ? Math.floor(stockOf(r, faction).grain / R.settleGrain) : Infinity
  const wood = R.settleWood > 0 ? Math.floor(goodOf(stockOf(r, faction), 'wood') / R.settleWood) : Infinity
  return Math.max(0, Math.min(share, room, grain, wood))
}

// ───────── 이주 (형: "집 분배하는거 자동으로 분배하기 · 그게 디폴트이고 자동안하면 본인이 직접 이주 · 전방에 강제이주시키거나 수도에 집중")

/** 고을이 편히 품는 집 — 빈땅은 품(room), 그 밖은 고을 종류마다. 소도는 0 */
export function homeRoom(n: RNode): number {
  const R = P.realm
  switch (n.kind) {
    case 'wild': return n.room ?? 0
    case 'capital': return R.roomCapital
    case 'port': return R.roomPort
    case 'village': return R.roomVillage
    case 'ironMine': return R.roomIronMine
    case 'fort': return R.roomFort
    case 'sodo': return 0
  }
}

/** 붐빔 — 집 ÷ 품. 1 을 넘으면 붐빈다 (집이 덜 는다) */
export function crowdOf(n: RNode): number {
  const room = homeRoom(n)
  return room > 0 ? n.hh / room : 0
}

/** 적이 이 고을로 오고 있다 — 자동 분배는 여기로 안 보낸다 */
function threatened(r: Realm, node: string, faction: string): boolean {
  return Object.values(r.armies).some((a) => a.faction !== faction && a.march !== null && a.march.to === node)
}

/**
 * 억지 이주 길 — 제 땅만 밟고, 이번 계절 열린 길로 `from` 에서 `to` 까지 이어지나 (BFS · id 순서).
 * 이어지면 지나는 고을들, 아니면 null.
 */
export function migratePath(r: Realm, faction: string, from: string, to: string): string[] | null {
  if (from === to) return null
  const season = seasonOf(r.season)
  const prev = new Map<string, string>([[from, '']])
  const q = [from]
  const edges = Object.keys(r.edges).sort().map((id) => r.edges[id]!)
  while (q.length > 0) {
    const cur = q.shift()!
    if (cur === to) break
    for (const ed of edges) {
      const nx = ed.a === cur ? ed.b : ed.b === cur ? ed.a : null
      if (nx === null || prev.has(nx) || r.nodes[nx]?.owner !== faction || r.nodes[nx]?.kind === 'sodo') continue
      if (blockedWhy(ed, season) !== null) continue
      prev.set(nx, cur)
      q.push(nx)
    }
  }
  if (!prev.has(to)) return null
  const path = [to]
  for (let c = prev.get(to)!; c !== ''; c = prev.get(c)!) path.unshift(c)
  return path
}

/** 억지 이주로 `from` 에서 이번 계절 보낼 수 있는 집 — 몫 · 곡식 · 이어진 길. 안 되면 0 */
export function migrateLimit(r: Realm, faction: string, from: string, to: string): number {
  const R = P.realm
  const a = r.nodes[from]
  const b = r.nodes[to]
  if (a === undefined || b === undefined || a.owner !== faction || b.owner !== faction || a.kind === 'sodo' || b.kind === 'sodo') return 0
  if (migratePath(r, faction, from, to) === null) return 0
  // 한 계절 몫은 계절 처음의 집 기준 — 이미 내보낸 만큼 뺀다 (형: "최대로 해서 옮기기 적용했는데 왜 더 옮겨지는거임? 2개씩 계속 쌓임")
  const sent = a.movedOut?.season === r.season ? a.movedOut.n : 0
  const share = Math.floor((a.hh + sent) * R.migrateShare) - sent
  const grain = R.migrateGrain > 0 ? Math.floor(stockOf(r, faction).grain / R.migrateGrain) : Infinity
  return Math.max(0, Math.min(share, grain))
}

export function migrateCost(n: number): { grain: number } {
  return { grain: Math.ceil(n * P.realm.migrateGrain) }
}

/** 억지 이주 — 집을 옮기고 곡식을 내고, 두 고을은 한동안 집이 안 는다 (뿌리 뽑힌 사람들이 자리 잡는 동안) */
export function migrateHouses(r: Realm, o: Extract<Order, { kind: 'migrate' }>, lines: ReportLine[]): void {
  if (!Number.isInteger(o.n) || o.n < 1 || o.n > migrateLimit(r, o.faction, o.from, o.to)) return
  const a = r.nodes[o.from]!
  const b = r.nodes[o.to]!
  a.hh -= o.n
  b.hh += o.n
  a.movedOut = { season: r.season, n: (a.movedOut?.season === r.season ? a.movedOut.n : 0) + o.n }
  stockOf(r, o.faction).grain -= migrateCost(o.n).grain
  const until = r.season + P.realm.migrateCalm
  a.uprooted = Math.max(a.uprooted ?? -1, until)
  b.uprooted = Math.max(b.uprooted ?? -1, until)
  lines.push({ kind: 'migrate', faction: o.faction, from: o.from, to: o.to, n: o.n })
}

/** 자동 분배 켜기·끄기 */
export function setMigrateAuto(r: Realm, o: Extract<Order, { kind: 'migrateAuto' }>): void {
  const f = r.factions[o.faction]
  if (f === undefined) return
  if (o.on) delete f.migrateOff
  else f.migrateOff = true
}

/**
 * 이번 계절 저절로 옮겨 갈 집 — 붐비는(품을 넘긴) 제 고을에서 길로 맞닿은 한산한 제 고을로.
 * 받는 고을: 적이 안 오고 · 싸움이 안 났고 · 붐빔이 떠나는 고을보다 migrateAutoGap 넘게 낮다. 그 가운데 가장 한산한 곳 (같으면 id).
 * 양: 두 고을 붐빔을 같게 만드는 몫의 반과 migrateAutoShare 가운데 작은 것. 결정론 — 굴림이 없다.
 * 화면이 미리보기로, 엔진이 계절 끝에 같은 함수를 부른다.
 */
export function autoFlows(r: Realm, faction: string, fought: ReadonlySet<string> = new Set()): Array<{ from: string; to: string; n: number }> {
  const R = P.realm
  const fac = r.factions[faction]
  if (fac === undefined || fac.migrateOff === true) return []
  const season = seasonOf(r.season)
  const mine = Object.values(r.nodes).filter((n) => n.owner === faction && n.kind !== 'sodo').sort((x, y) => (x.id < y.id ? -1 : 1))
  const hh = new Map(mine.map((n) => [n.id, n.hh]))
  const crowd = (id: string): number => {
    const room = homeRoom(r.nodes[id]!)
    return room > 0 ? hh.get(id)! / room : Infinity
  }
  const out: Array<{ from: string; to: string; n: number }> = []
  const edges = Object.keys(r.edges).sort().map((id) => r.edges[id]!)
  for (const src of mine) {
    if (src.hh <= 0 || crowd(src.id) <= 1) continue
    // 이번 계절 억지로 옮긴 고을은 저절로 다시 건드리지 않는다
    if ((src.uprooted ?? -1) >= r.season) continue
    let best: string | null = null
    for (const ed of edges) {
      const nx = ed.a === src.id ? ed.b : ed.b === src.id ? ed.a : null
      if (nx === null || !hh.has(nx) || blockedWhy(ed, season) !== null) continue
      if (homeRoom(r.nodes[nx]!) <= 0 || fought.has(nx) || threatened(r, nx, faction)) continue
      if ((r.nodes[nx]!.uprooted ?? -1) >= r.season) continue
      if (crowd(nx) > crowd(src.id) - R.migrateAutoGap) continue
      if (best === null || crowd(nx) < crowd(best) || (crowd(nx) === crowd(best) && nx < best)) best = nx
    }
    if (best === null) continue
    const ra = homeRoom(src)
    const rb = homeRoom(r.nodes[best]!)
    const a = hh.get(src.id)!
    const b = hh.get(best)!
    const even = a - ((a + b) / (ra + rb)) * ra // 이만큼 옮기면 두 고을 붐빔이 같다
    const n = Math.floor(Math.min(a * R.migrateAutoShare, even / 2))
    if (n < 1) continue
    hh.set(src.id, a - n)
    hh.set(best, b + n)
    out.push({ from: src.id, to: best, n })
  }
  return out
}

/** 9 — 계절 끝, 자동 분배를 켠 나라마다 붐비는 고을의 집이 한산한 고을로 옮겨 간다. 굶는 나라는 안 옮긴다 */
export function stepMigration(r: Realm, fought: ReadonlySet<string>, lines: ReportLine[]): void {
  const hungry = new Set(lines.filter((l): l is Extract<ReportLine, { kind: 'hunger' }> => l.kind === 'hunger').map((l) => l.faction))
  for (const f of Object.keys(r.factions).sort()) {
    if (hungry.has(f)) continue
    for (const fl of autoFlows(r, f, fought)) {
      r.nodes[fl.from]!.hh -= fl.n
      r.nodes[fl.to]!.hh += fl.n
      lines.push({ kind: 'migrate', faction: f, from: fl.from, to: fl.to, n: fl.n, auto: true })
    }
  }
}

/** 지금 개척할 수 있는 짝 — 빈땅 id, 떠나는 고을 id 순서 (결정론) */
/**
 * 개척에 집을 내보낼 고을의 기본값 — 도읍이 아닌, 그 빈땅과 길로 맞닿은 고을 가운데 가장 붐비는 곳 (자리 대비).
 * 도읍밖에 없으면 도읍. 보낼 데가 없으면 null.
 * (형: "골포 도읍에서 빼오는건지 몰랐는데 저런식으로 도읍을 default로 빼와도 되는거야?")
 */
export function settleSource(r: Realm, faction: string, to: string): string | null {
  const froms = settleTargets(r, faction).filter((t) => t.to === to).map((t) => t.from)
  if (froms.length === 0) return null
  const caps = new Set(Object.values(r.factions).map((f) => f.capital))
  const pool = froms.some((f) => !caps.has(f)) ? froms.filter((f) => !caps.has(f)) : froms
  return pool.slice().sort((a, b) => crowdOf(r.nodes[b]!) - crowdOf(r.nodes[a]!) || (a < b ? -1 : a > b ? 1 : 0))[0]!
}

export function settleTargets(r: Realm, faction: string): Array<{ from: string; to: string; edge: string }> {
  const out: Array<{ from: string; to: string; edge: string }> = []
  for (const id of Object.keys(r.edges).sort()) {
    const ed = r.edges[id]!
    for (const [from, to] of [[ed.a, ed.b], [ed.b, ed.a]] as const) {
      if (settleLimit(r, faction, from, to) > 0) out.push({ from, to, edge: ed.id })
    }
  }
  return out.sort((x, y) => (x.to < y.to ? -1 : x.to > y.to ? 1 : x.from < y.from ? -1 : x.from > y.from ? 1 : 0))
}

/**
 * 제사의 값 (형: "어느정도 이득이 있는 것엔 대가가 필요한데" — 2026-10-18) — 이득에 맞게:
 *   봄 — 올가을 거둘 것(지금 가호 × 수확)의 riteSpringShare 몫, 적어도 riteGrain. 큰 나라일수록 크게 바친다
 *   가을 — 곡식 riteAutumnGrain + 철기 제물 riteAutumnIron
 * `season` 을 안 주면 지금 계절. 봄·가을이 아니면 봄 값.
 */
export function riteCost(r: Realm, faction: string, season = seasonOf(r.season)): { grain: number; iron: number } {
  const R = P.realm
  if (season === 'autumn') return { grain: R.riteAutumnGrain, iron: R.riteAutumnIron }
  return { grain: Math.max(R.riteGrain, Math.round(hhOf(r, faction) * R.harvestPerHH * R.riteSpringShare)), iron: 0 }
}

/** 소도와 길로 맞닿은 고을 가운데 이 나라가 쥔 것 — id 순서 */
export function sodoNeighbors(r: Realm, faction: string): string[] {
  const out = new Set<string>()
  for (const ed of Object.values(r.edges)) {
    const a = r.nodes[ed.a]
    const b = r.nodes[ed.b]
    if (a?.kind === 'sodo' && b?.owner === faction) out.add(b.id)
    if (b?.kind === 'sodo' && a?.owner === faction) out.add(a.id)
  }
  return [...out].sort()
}

/**
 * 소도 제사 (「常以五月下種訖祭鬼神…十月農功畢亦復如之」) — 봄·가을에만, 소도와 길로 맞닿은 고을을 쥐고,
 * 곡식이 riteCost 이상이면. 봄 제사는 그해에 한 번만 (이미 지냈으면 안 된다).
 */
export function riteAllowed(r: Realm, faction: string): boolean {
  const season = seasonOf(r.season)
  if (season !== 'spring' && season !== 'autumn') return false
  if (r.factions[faction] === undefined || sodoNeighbors(r, faction).length === 0) return false
  if (season === 'spring' && r.blessed?.[faction] === Math.floor(r.season / 4)) return false
  const c = riteCost(r, faction, season)
  const s = stockOf(r, faction)
  return s.grain >= c.grain && s.iron >= c.iron
}

/** 2 — 제사: 나라마다 첫 명령 하나만. 봄은 그해 수확에 축복, 가을은 모든 군대 사기 + */
export function resolveRites(r: Realm, orders: readonly Order[], lines: ReportLine[]): void {
  const R = P.realm
  const done = new Set<string>()
  const season = seasonOf(r.season)
  for (const o of orders) {
    if (o.kind !== 'rite' || done.has(o.faction)) continue
    const f = o.faction
    if (!riteAllowed(r, f)) continue
    done.add(f)
    const c = riteCost(r, f, season)
    stockOf(r, f).grain -= c.grain
    stockOf(r, f).iron -= c.iron
    if (season === 'spring') (r.blessed ??= {})[f] = Math.floor(r.season / 4)
    else for (const a of Object.values(r.armies)) if (a.faction === f) a.morale = Math.min(R.moraleMax, a.morale + R.riteMorale * riteMul(r, f))
    lines.push({ kind: 'rite', faction: f, season: season === 'spring' ? 'spring' : 'autumn' })
  }
}

/** 경계 강화 (형: "우리가 경계를 강화하거나" — 2026-10-18) — 곡식을 내고 그 고을의 경계를 올린다 */
export function guardCost(): { grain: number } {
  return { grain: P.realm.guardGrain }
}

/** 이 고을의 경계를 이번 계절에 강화할 수 있나 — 제 고을 · 이번 계절에 아직 안 함 · 곡식이 있다 */
export function canGuard(r: Realm, faction: string, node: string): boolean {
  const n = r.nodes[node]
  if (n === undefined || n.owner !== faction || n.kind === 'sodo') return false
  if (r.watch[node]?.guarded === r.season) return false
  return stockOf(r, faction).grain >= guardCost().grain
}

/** 1 — 경계 강화. 규칙에 안 맞으면 아무 일도 없다 */
export function applyGuard(r: Realm, o: Extract<Order, { kind: 'guard' }>, lines: ReportLine[]): void {
  if (!canGuard(r, o.faction, o.node)) return
  const w = (r.watch[o.node] ??= { alert: 0, lull: 0 })
  w.alert = Math.min(P.realm.alertMax, w.alert + P.realm.guardAlert)
  w.lull = 0 // 방심도 걷힌다
  w.guarded = r.season
  stockOf(r, o.faction).grain -= guardCost().grain
  lines.push({ kind: 'guard', faction: o.faction, node: o.node })
}

// ───────── 철의 쓰임 (형: "철은 언제 어떻게 사용하는건지 모르겠네" — 2026-10-18)

/** 장비의 다음 단계 — 돌 → 청동 → 쇠날 → 온 쇠. 가죽은 청동 단계라 쇠날로, 온 쇠·고리칼 위는 없다 (kit.nextTier) */
export function nextEquip(e: Equip): Equip | null {
  return nextTier(e)
}

/** 그 단계로 올리는 데 한 사람당 드는 철 */
function ironPer(to: Equip): number {
  const R = P.realm
  return to === 'bronze' ? R.armIronBronze : to === 'ironTip' ? R.armIronTip : to === 'iron' ? R.armIronIron : Infinity
}

/** 병종 하나를 올리는 몫 — 그 병종 가운데 가장 낮은 무장의 사람들이 한 단계 */
function kindStep(a: Army, kind: UnitKind): { from: Equip; to: Equip; n: number } | null {
  const from = lowestTier(a, kind)
  const to = from !== null ? nextTier(from) : null
  if (from === null || to === null) return null
  return { from, to, n: kitOf(a)[kind]?.[from] ?? 0 }
}

/**
 * 무장 올리기의 값 — 제 고을에 쉬는 군대만 (형: "창병 궁수 방패병 다르지 않나").
 *   unit 을 주면: 그 병종 가운데 가장 낮은 무장을 든 사람들만 한 단계. `n` 은 그 사람 수, `from`→`to`.
 *   unit 이 없으면: 병종마다 그렇게 (옛 단추). `to` 는 가장 낮은 무장이 오를 단계.
 * 철 = 사람 × 오를 단계의 철, 곡식 = 사람 × armGrain. 올릴 것이 없거나 행군 중이거나 남의 땅이면 null.
 * 창고가 모자라도 값은 낸다 (화면이 회색으로 보인다)
 */
export function armCost(r: Realm, army: string, unit?: UnitKind): { iron: number; grain: number; to: Equip; from: Equip; n: number; unit?: UnitKind } | null {
  const a = r.armies[army]
  if (a === undefined || a.march !== null || r.nodes[a.at]?.owner !== a.faction) return null
  const kinds = unit !== undefined ? [unit] : (Object.keys(a.mix) as UnitKind[]).filter((k) => (a.mix[k] ?? 0) > 0).sort()
  let iron = 0
  let n = 0
  let low: { from: Equip; to: Equip } | null = null
  for (const k of kinds) {
    const s = kindStep(a, k)
    if (s === null || s.n <= 0) continue
    iron += s.n * ironPer(s.to)
    n += s.n
    if (low === null || TIERS.indexOf(s.from) < TIERS.indexOf(low.from)) low = { from: s.from, to: s.to }
  }
  if (low === null || n <= 0) return null
  const out = { iron: Math.ceil(iron), grain: Math.ceil(n * P.realm.armGrain), to: low.to, from: low.from, n }
  return unit !== undefined ? { ...out, unit } : out
}

/** 1 — 무장 올리기. 규칙에 안 맞거나 창고가 모자라면 아무 일도 없다 */
export function applyArm(r: Realm, o: Extract<Order, { kind: 'arm' }>, lines: ReportLine[]): void {
  const a = r.armies[o.army]
  const c = armCost(r, o.army, o.unit)
  if (a === undefined || c === null) return
  const s = stockOf(r, a.faction)
  if (s.iron < c.iron || s.grain < c.grain) return
  s.iron -= c.iron
  s.grain -= c.grain
  const kinds = o.unit !== undefined ? [o.unit] : (Object.keys(a.mix) as UnitKind[]).sort()
  for (const k of kinds) upgradeKind(a, k)
  lines.push({ kind: 'arm', faction: a.faction, army: a.id, equip: c.to, iron: c.iron, n: c.n, ...(o.unit !== undefined ? { unit: o.unit } : {}) })
}

/**
 * 쇠 들려 징병 — n 명을 그 나라 기본 장비보다 한 단계 위로 뽑는 데 드는 철. **뽑힌 그 사람들만** 그 단계를 든다.
 * 올릴 단계가 없으면 null. 값은 병종과 상관없이 단계로 정해진다 (unit 은 화면 말을 고르려고 받는다)
 */
export function draftIronCost(r: Realm, faction: string, n: number, _unit?: UnitKind): { iron: number; to: Equip } | null {
  const base = r.factions[faction]?.equip
  const to = base !== undefined ? nextTier(base) : null
  if (to === null || n <= 0) return null
  return { iron: Math.ceil(n * ironPer(to)), to }
}

// ───────── 집이 느는 길 (형: "집은 어떻게 늘리고")

/**
 * 이번 계절 끝에 그 고을 집이 몇 늘(줄)지와 까닭 — 화면의 고을 판이 쓴다. stepEconomy 와 같은 셈의 짐작이다
 * (싸움이 날지는 모르므로 넣지 않는다 — 대신 다가오는 적이 보이면 'threat').
 * 까닭 열쇠: fed(먹고 평화) · hunger(곡식이 바닥) · post(내정 장수가 맡았다) · settle(새 마을이 빨리 큰다) · full(품이 찼다) · threat(적이 온다)
 */
export function hhGrowth(r: Realm, node: string): { per: number; why: string[] } {
  const R = P.realm
  const n = r.nodes[node]
  if (n === undefined || n.owner === null || n.kind === 'sodo') return { per: 0, why: [] }
  const f = n.owner
  const season = seasonOf(r.season)
  // 굶나 — 이번 계절 수확(가을)을 더하고 군량을 뺀다
  let grain = stockOf(r, f).grain
  if (season === 'autumn') {
    for (const x of Object.values(r.nodes)) if (x.owner === f) grain += x.sown * R.harvestPerHH * harvestMul(r, x.id)
  }
  const why: string[] = []
  const threat = Object.values(r.armies).some((a) => a.faction !== f && a.march !== null && a.march.to === node)
  if (threat) why.push('threat')
  if (grain < upkeepOf(r, f, season === 'winter')) return { per: -Math.round(n.hh * R.hhHunger), why: [...why, 'hunger'] }
  if ((n.uprooted ?? -1) >= r.season) return { per: 0, why: [...why, 'uprooted'] }
  const crowded = n.kind !== 'wild' && crowdOf(n) > 1
  const g = growMul(r, node) * (crowded ? R.crowdGrowMul : 1)
  if (growMul(r, node) > 1) why.push('post')
  if (crowded) why.push('crowded')
  if (n.kind === 'wild') {
    const room = n.room ?? 0
    if (n.hh <= 0) return { per: 0, why }
    if (n.hh >= room) return { per: 0, why: [...why, 'full'] }
    const next = Math.min(room, Math.max(n.hh + 1, Math.round(n.hh * (1 + R.settleGrow * g))))
    return { per: next - n.hh, why: [...why, 'settle'] }
  }
  return { per: Math.round(n.hh * (1 + R.hhGrowth * g)) - n.hh, why: [...why, 'fed'] }
}

/** 이 계절에 나라가 군대를 먹이는 데 드는 곡식 */
export function upkeepOf(r: Realm, faction: string, winter: boolean): number {
  // 제 땅 밖에 나간 군사는 더 먹는다 — 절인 양식(소금)이 있으면 그대로
  const away = goodOf(stockOf(r, faction), 'salt') >= awaySalt(r, faction) ? 0 : awayMen(r, faction) * (P.realm.awayRation - 1)
  return Math.ceil((menOf(r, faction) + gluttonMen(r, faction) + away) * P.realm.rationPerSoldier * (winter ? P.realm.winterRation : 1))
}

/** 고을을 뺏겼다 — 사람이 흩어진다 */
export function onTake(r: Realm, node: string): void {
  const n = r.nodes[node]
  if (n === undefined) return
  const keep = 1 - P.realm.hhLossOnTake
  n.hh = Math.round(n.hh * keep)
  n.sown = Math.round(n.sown * keep)
}

/**
 * 7 — 생산 · 수확 · 소모 (SYSTEMS §12). `season` 은 0 봄 · 1 여름 · 2 가을 · 3 겨울.
 * `fought` 는 이번 계절에 싸움이 난 고을 — 그 고을의 가호는 늘지 않는다.
 */
export function stepEconomy(r: Realm, season: number, fought: ReadonlySet<string>, lines: ReportLine[]): void {
  const R = P.realm
  const winter = season === 3
  for (const f of Object.keys(r.factions).sort()) {
    const s = stockOf(r, f)
    const fac = r.factions[f]!
    const nodes = Object.values(r.nodes).filter((n) => n.owner === f).sort((x, y) => (x.id < y.id ? -1 : 1))
    // 땅마다 나는 것 — 철산·포구의 철 · 바닷가의 소금·물고기 · 숲의 나무 · 목장의 말 (nodeYield) · 바깥 교역
    const sname = season === 0 ? 'spring' : season === 1 ? 'summer' : season === 2 ? 'autumn' : 'winter'
    for (const n of nodes) {
      const y = nodeYield(r, n.id, sname)
      for (const g of GOODS) if (goodOf(y, g) !== 0) s[g] = goodOf(s, g) + goodOf(y, g)
    }
    if (fac.income !== undefined) {
      s.grain += fac.income.grain
      s.iron += fac.income.iron
    }
    // 가을 — 봄에 심은 만큼 거둔다
    if (season === 2) {
      let sown = 0
      for (const n of nodes) sown += n.sown * harvestMul(r, n.id)
      const base = Math.round(sown * R.harvestPerHH)
      // 봄 제사를 지낸 해면 더 든다
      const blessed = r.blessed?.[f] === Math.floor(r.season / 4) ? Math.round(base * R.riteHarvest * riteMul(r, f)) : 0
      const grain = base + blessed
      if (grain > 0) {
        s.grain += grain
        lines.push(blessed > 0 ? { kind: 'harvest', faction: f, grain, blessed } : { kind: 'harvest', faction: f, grain })
      }
    }
    // 군량 — 밖에 나간 군사는 절인 양식(소금)을 쓰거나, 없으면 더 먹는다 (upkeepOf 가 같은 셈을 한다)
    const need = upkeepOf(r, f, winter)
    const salted = awaySalt(r, f)
    if (salted > 0 && goodOf(s, 'salt') >= salted) s.salt = goodOf(s, 'salt') - salted
    let hungry = false
    if (s.grain >= need) s.grain -= need
    else {
      s.grain = 0
      hungry = need > 0
    }
    // 겨울 — 소금으로 못 덮은 곡식은 썩는다. 소금은 덮은 만큼 쓴다
    if (winter && s.grain > 0) {
      const salt = goodOf(s, 'salt')
      const covered = Math.min(s.grain, salt * R.saltKeeps)
      const used = R.saltKeeps > 0 ? Math.min(salt, Math.ceil(covered / R.saltKeeps)) : 0
      if (used > 0) s.salt = salt - used
      const rot = Math.floor((s.grain - covered) * R.spoilShare)
      if (rot > 0) {
        s.grain -= rot
        lines.push({ kind: 'spoil', faction: f, grain: rot })
      }
    }
    if (hungry) {
      lines.push({ kind: 'hunger', faction: f })
      for (const a of Object.values(r.armies)) {
        if (a.faction === f) a.morale = Math.max(R.moraleFloor, a.morale - R.hungerMorale)
      }
    }
    // 가호 — 굶으면 줄고, 먹고 싸움이 없으면 는다. 개척한 빈땅은 품(room)까지 빨리 큰다
    for (const n of nodes) {
      if (hungry) n.hh = Math.round(n.hh * (1 - R.hhHunger))
      else if (fought.has(n.id)) continue
      else if ((n.uprooted ?? -1) >= r.season) continue // 억지로 옮긴 고을 — 자리 잡는 동안 안 는다
      else if (n.kind === 'wild') {
        const room = n.room ?? 0
        if (n.hh > 0 && n.hh < room) n.hh = Math.min(room, Math.max(n.hh + 1, Math.round(n.hh * (1 + R.settleGrow * growMul(r, n.id)))))
      } else n.hh = Math.round(n.hh * (1 + R.hhGrowth * growMul(r, n.id) * (crowdOf(n) > 1 ? R.crowdGrowMul : 1))) // 붐비면 덜 는다
    }
  }
  // 봄이 끝날 때 심는다 — 봄 징병(1단계)이 지난 뒤의 가호
  if (season === 0) for (const n of Object.values(r.nodes)) n.sown = n.hh
}
