/**
 * 이기는 길 셋째·넷째 — 철과 뱃길 · 큰 제사 (docs/realm/VICTORY.md §1. 맹주는 suzerain.ts).
 *
 * 철과 뱃길 — 『삼국지』 동이전: 변진에서 철이 나 한·예·왜가 다 와서 사 간다 · 저자에서 철을 돈처럼 쓴다.
 *   교역 장부(r.ironBook): 사신(교역·조공·지원·선물)과 장터에서 오간 철을 나라마다 적는다 — 네 계절 창(옛 것은 빠진다).
 *   올해 철을 바꾼 나라 수 × 바꾼 철이 판의 문턱(나라 수에 비례)을 넘고, 철광이나 포구를 하나 이상 쥐었으면 이긴다.
 *   철광이 없어도 사 모아 되파는 중개로 걷는다 — 들어온 철도 나간 철도 장부에 오른다.
 *
 * 큰 제사 — 동이전: 오월·시월 제사에 나라 사람이 모여 밤낮 노래하고 춤춘다 · 소도와 천군 · 부여 영고 · 동예 무천.
 *   봄·가을 제사를 빠짐없이 내리(riteChainNeed 번 — 두 해) 지내고, 그해 가을에 우리 집이 판의 몫(판의 모든 집에 비례) 이상이면
 *   큰 제사가 열리고 이긴다. 한 번이라도 거르면 사슬이 끊겨 처음부터 (소도 곁 땅을 잃으면 제사를 못 지내 저절로 끊긴다).
 *
 * 모든 길은 남도 걷는다 — AI 나라가 다 이루면 우리가 진다. 4분의 3쯤 오면 소문이 온다 (처음 가까워졌을 때 한 번).
 * 배우는 판은 셈하지 않는다.
 */
import { P } from '../tune/params.ts'
import { hhOf } from './economy.ts'
import type { Realm, ReportLine } from './types.ts'

export type WinPath = 'conquest' | 'suzerain' | 'ironsea' | 'rite'

const alive = (r: Realm, f: string): boolean => Object.values(r.nodes).some((n) => n.owner === f)
const nations = (r: Realm): number => Object.keys(r.factions).length

/** 철이 오갔다 — 두 나라 장부에 다 적는다 (사신·장터가 부른다) */
export function noteIron(r: Realm, a: string, b: string, n: number): void {
  if (n <= 0 || a === b || r.region === 'tutorial') return
  const book = (r.ironBook ??= {})
  ;(book[a] ??= []).push({ s: r.season, w: b, n })
  ;(book[b] ??= []).push({ s: r.season, w: a, n })
}

/** 철광이나 포구를 하나라도 쥐었나 — 뱃길의 문 */
export function seaGate(r: Realm, f: string): boolean {
  return Object.values(r.nodes).some((n) => n.owner === f && (n.kind === 'ironMine' || n.kind === 'port'))
}

/**
 * 교역 장부 — 올해(지난 네 계절 · 이번 계절 포함) 철을 바꾼 나라들 · 바꾼 철 · 셈(나라 수 × 철) · 문턱.
 * 문턱은 판의 나라 수에 비례한다 (작은 판은 작게).
 */
export function ironOf(r: Realm, f: string): { partners: string[]; iron: number; score: number; need: number; minPartners: number; gate: boolean } {
  const R = P.realm
  const from = r.season - 3
  const rows = (r.ironBook?.[f] ?? []).filter((x) => x.s >= from && r.factions[x.w] !== undefined)
  const partners = [...new Set(rows.map((x) => x.w))].sort()
  const iron = rows.reduce((s, x) => s + x.n, 0)
  return {
    partners, iron, score: partners.length * iron,
    need: Math.round(R.ironseaPerNation * nations(r)), minPartners: R.ironseaMinPartners, gate: seaGate(r, f),
  }
}

const ironHolds = (x: ReturnType<typeof ironOf>): boolean => x.gate && x.partners.length >= x.minPartners && x.score >= x.need

/** 큰 제사 — 사슬(내리 지낸 제사 수) · 필요한 사슬 · 집 · 판의 몫 */
export function riteOf(r: Realm, f: string): { chain: number; need: number; hh: number; hhNeed: number } {
  const R = P.realm
  // 판의 모든 집에 대한 몫 — 나라가 많은 판은 몫을 √ 로 줄인다 (스물한 나라 판에서 열에 넷을 쥐면 그건 정복이다)
  const total = Object.values(r.nodes).reduce((s, n) => s + (n.owner !== null ? n.hh : 0), 0)
  const hhNeed = Math.round((R.riteHHShare * total) / Math.sqrt(Math.max(1, nations(r) / 6)))
  return { chain: r.riteChain?.[f] ?? 0, need: R.riteChainNeed, hh: Math.floor(hhOf(r, f)), hhNeed }
}

/**
 * 9 — 장부의 옛 줄을 걷고, 제사 사슬을 잇거나 끊고, 소문·우리 진행을 보고에 남긴다.
 * 제사철(봄·가을)에 제사를 지냈으면 사슬 +1, 안 지냈으면 0. 다른 철은 그대로.
 */
export function stepPaths(r: Realm, lines: ReportLine[]): void {
  if (r.region === 'tutorial') return
  const R = P.realm
  // 장부 — 네 계절이 지난 줄은 걷는다
  for (const [f, rows] of Object.entries(r.ironBook ?? {})) {
    const keep = rows.filter((x) => x.s >= r.season - 3)
    if (keep.length > 0) r.ironBook![f] = keep
    else delete r.ironBook![f]
  }
  const yearSeason = ((r.season % 4) + 4) % 4
  const riteSeason = yearSeason === 0 || yearSeason === 2
  const did = new Set(lines.filter((l): l is Extract<ReportLine, { kind: 'rite' }> => l.kind === 'rite').map((l) => l.faction))
  const chain = (r.riteChain ??= {})
  const near = (r.pathNear ??= {})
  for (const f of Object.keys(r.factions).sort()) {
    if (!alive(r, f)) {
      delete chain[f]
      continue
    }
    if (riteSeason) {
      const c = did.has(f) ? (chain[f] ?? 0) + 1 : 0
      if (c > 0) chain[f] = c
      else delete chain[f]
    }
    // 큰 제사 — 사슬이 4분의 3에 닿으면 (그리고 집이 넉넉하면) 소문 · 우리 것은 제사철마다 사슬을 알린다
    const ri = riteOf(r, f)
    const riteNear = ri.chain >= Math.ceil(ri.need * R.pathRumorShare) && ri.hh >= ri.hhNeed * R.pathRumorShare
    if (f === r.player) {
      if (riteSeason && ri.chain > 0) lines.push({ kind: 'pathRite', faction: f, chain: ri.chain, need: ri.need, hh: ri.hh, hhNeed: ri.hhNeed })
    } else if (riteNear && near[`rite:${f}`] !== true) lines.push({ kind: 'pathRite', faction: f, chain: ri.chain, need: ri.need, hh: ri.hh, hhNeed: ri.hhNeed })
    if (riteNear) near[`rite:${f}`] = true
    else delete near[`rite:${f}`]
    // 철과 뱃길 — 4분의 3에 닿으면 소문 (우리 것이면 알림) · 처음 가까워졌을 때 한 번
    const io = ironOf(r, f)
    const ironNear = io.gate && io.partners.length >= Math.ceil(io.minPartners * R.pathRumorShare) && io.score >= io.need * R.pathRumorShare
    if (ironNear && near[`iron:${f}`] !== true) lines.push({ kind: 'pathIron', faction: f, partners: io.partners.length, iron: io.iron, score: io.score, need: io.need })
    if (ironNear) near[`iron:${f}`] = true
    else delete near[`iron:${f}`]
  }
}

/**
 * 철과 뱃길 · 큰 제사로 판이 났나 — 우리면 이김, 남이면 짐. 같은 계절이면 우리가 먼저, 그다음 이름 순.
 * 큰 제사는 가을에만 열린다.
 */
export function pathsEnd(r: Realm): { kind: 'win' | 'lose'; by: string; path: 'ironsea' | 'rite' } | null {
  if (r.region === 'tutorial') return null
  const me = r.player
  const autumn = ((r.season % 4) + 4) % 4 === 2
  const riteDone = (f: string): boolean => {
    const x = riteOf(r, f)
    return autumn && x.chain >= x.need && x.hh >= x.hhNeed
  }
  const ironDone = (f: string): boolean => ironHolds(ironOf(r, f))
  const order = [...(me !== undefined ? [me] : []), ...Object.keys(r.factions).sort().filter((f) => f !== me && alive(r, f))]
  for (const f of order) {
    if (!alive(r, f)) continue
    const kind = f === me ? 'win' : 'lose'
    if (ironDone(f)) return { kind, by: f, path: 'ironsea' }
    if (riteDone(f)) return { kind, by: f, path: 'rite' }
  }
  return null
}
