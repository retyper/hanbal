/**
 * 이기는 길 셋째·넷째 — 철과 뱃길 · 큰 제사 (docs/realm/VICTORY.md §1. 맹주는 suzerain.ts).
 *
 * 철과 뱃길 — 『삼국지』 동이전: 변진에서 철이 나 한·예·왜가 다 와서 사 간다 · 저자에서 철을 돈처럼 쓴다.
 *   교역 장부(r.ironBook): 사신(교역·조공·지원·선물)과 장터에서 오간 철을 나라마다 적는다 — 네 계절 창(옛 것은 빠진다).
 *   **철광과 포구를 둘 다 쥔 채 창고의 철이 ironseaStock 에 닿으면 이긴다** (형 10-30: "철광과 포구를 차지한 채로 보유 철의 양을
 *   엄청 많이 가지고 있으면 승리 · 두 판 하다가 이걸로 뜬금없이 이겼다"). 예전엔 교역 장부 점수였다 — 무엇을 하는지 모른 채 넘었다.
 *   교역 장부(ironTrade)는 남아 장터·사신의 기록으로 쓴다.
 *
 * 큰 제사 — 동이전: 오월·시월 제사에 나라 사람이 모여 밤낮 노래하고 춤춘다 · 소도와 천군 · 부여 영고 · 동예 무천.
 *   봄·가을 제사를 빠짐없이 내리(riteChainNeed 번 — 두 해) 지내고, 그해 가을에 우리 집이 판의 몫(판의 모든 집에 비례) 이상이면
 *   큰 제사가 열리고 이긴다. 한 번이라도 거르면 사슬이 끊겨 처음부터 (소도 곁 땅을 잃으면 제사를 못 지내 저절로 끊긴다).
 *
 * 모든 길은 남도 걷는다 — AI 나라가 다 이루면 우리가 진다. 4분의 3쯤 오면 소문이 온다 (처음 가까워졌을 때 한 번).
 * 배우는 판은 셈하지 않는다.
 */
import { P } from '../tune/params.ts'
import { goodOf, hhOf, stockOf } from './economy.ts'
import { relicBest } from './relics.ts'
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
export function ironTrade(r: Realm, f: string): { partners: string[]; iron: number } {
  const from = r.season - 3
  const rows = (r.ironBook?.[f] ?? []).filter((x) => x.s >= from && r.factions[x.w] !== undefined)
  return { partners: [...new Set(rows.map((x) => x.w))].sort(), iron: rows.reduce((s, x) => s + x.n, 0) }
}

/** 철과 뱃길의 셈 — 철광을 쥐었나 · 포구를 쥐었나 · 창고의 철 · 문턱. 둘 다 쥐어야 문(gate)이 열린다 */
export function ironOf(r: Realm, f: string): { mine: boolean; port: boolean; gate: boolean; iron: number; need: number } {
  const own = Object.values(r.nodes).filter((n) => n.owner === f)
  const mine = own.some((n) => n.kind === 'ironMine')
  const port = own.some((n) => n.kind === 'port')
  // 문턱은 판의 철광 수에 비례 — 철광이 셋인 낙동강 판은 쇠가 세 배로 돈다 (450 그대로면 남이 이긴 판 37% · realm-paths 10-31)
  const mines = Object.values(r.nodes).filter((n) => n.kind === 'ironMine').length
  return { mine, port, gate: mine && port, iron: goodOf(stockOf(r, f), 'iron'), need: Math.round(P.realm.ironseaStock * Math.max(1, mines)) }
}

const ironHolds = (x: ReturnType<typeof ironOf>): boolean => x.gate && x.iron >= x.need

/** 큰 제사 — 사슬(내리 지낸 제사 수) · 필요한 사슬 · 집 · 판의 몫 */
export function riteOf(r: Realm, f: string): { chain: number; need: number; hh: number; hhNeed: number } {
  const R = P.realm
  // 판의 모든 집에 대한 몫 — 나라가 많은 판은 몫을 √ 로 줄인다 (스물한 나라 판에서 열에 넷을 쥐면 그건 정복이다)
  const total = Object.values(r.nodes).reduce((s, n) => s + (n.owner !== null ? n.hh : 0), 0)
  // 나라가 적은 판은 고르게 나눈 몫의 riteFairMul 배는 쥐어야 (형 10-30: "1:1 게임에서 집 수가 2계절 만에 4054/2476")
  const share = Math.max(R.riteHHShare / Math.sqrt(Math.max(1, nations(r) / 6)), Math.min(R.riteShareCap, R.riteFairMul / Math.max(1, nations(r))))
  const hhNeed = Math.round(share * total)
  // 금동대향로 — 지닌 장수가 있는 나라는 내리 지낼 제사가 적다 (relics.ts · 적어도 한 번)
  const need = Math.max(1, R.riteChainNeed - relicBest(r, f, 'altar'))
  return { chain: r.riteChain?.[f] ?? 0, need, hh: Math.floor(hhOf(r, f)), hhNeed }
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
    const ironNear = io.gate && io.iron >= io.need * R.pathRumorShare
    if (ironNear && near[`iron:${f}`] !== true) lines.push({ kind: 'pathIron', faction: f, iron: io.iron, need: io.need })
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
