/**
 * 후반 압도 잣대 (카드 A · 2026-11-11) — 세계판에서 봇을 플레이어 자리에 앉혀 N계절 돌리고
 * 계절 묶음별 우리 고을·병력 · 가장 센 이웃의 병력 비 · 우리가 친 싸움의 승률을 낸다.
 *   node --experimental-strip-types tools/realm-late.ts [--games 4] [--seasons 70] [--tier 3] [--region world] [--as geonma] [--bot reckless] [--set k=v,..]
 * 승률 = 우리가 공격하고 이긴(rout·win) 싸움 / 우리가 친 싸움(들판 싸움 뺌). 「뒤 50턴」은 끝 턴 수 기준.
 */
import { aiOrders, decide, type Brain } from '../src/realm/ai.ts'
import { startRegion } from '../src/realm/data/regions/index.ts'
import { applyTier } from '../src/realm/tier.ts'
import { advance } from '../src/realm/season.ts'
import { draftLimit, menOf } from '../src/realm/economy.ts'
import { perSeason } from '../src/realm/calendar.ts'
import { P } from '../src/tune/params.ts'
import type { Order, Realm, RegionId } from '../src/realm/types.ts'
import { movesOf } from '../src/realm/estimate.ts'

const args = process.argv.slice(2)
const opt = (n: string, d: string): string => { const i = args.indexOf(`--${n}`); return i >= 0 && args[i + 1] !== undefined ? args[i + 1]! : d }
const GAMES = Number(opt('games', '4'))
const SEASONS = Number(opt('seasons', '70'))
const TIER = Number(opt('tier', '3'))
const REGION = opt('region', 'world') as RegionId
const AS = opt('as', 'geonma')
const BOT = opt('bot', 'reckless') as Brain
const PUSH = Number(opt('push', '0.7'))
/** 치기 봇 — 서 있는 군대가 이길 승산(가운데) PUSH 이상인 적 고을이 맞닿아 있으면 가장 나은 쪽으로 친다 (사람처럼 · 0 이면 끔) */
const HEAVY = Number(opt('heavy', '0'))
/** 징병 몰아치기 — 사람이 한 판의 명령 절반을 징병에 쓴 것처럼 (건마 기록 46%): 쉬는 제 고을마다 뽑을 수 있는 만큼 창병을 뽑는다 */
function heavyDrafts(r: Realm, os: readonly Order[]): Order[] {
  if (HEAVY <= 0) return []
  const done = new Set(os.flatMap((o) => (o.kind === 'draft' ? [o.node] : [])))
  const out: Order[] = []
  let room = Infinity
  for (const n of Object.values(r.nodes).sort((x, y) => (x.id < y.id ? -1 : 1))) {
    if (n.owner !== AS || done.has(n.id)) continue
    const k = Math.min(draftLimit(r, AS, n.id, 'spear'), room)
    if (k < 5) continue
    out.push({ kind: 'draft', faction: AS, node: n.id, unit: 'spear', n: k })
    room -= k
  }
  return out
}
function pushOrders(r: Realm, os: readonly Order[]): Order[] {
  if (PUSH <= 0) return []
  const used = new Set(os.flatMap((o) => (o.kind === 'march' || o.kind === 'poise' ? [o.army] : [])))
  const out: Order[] = []
  for (const a of Object.values(r.armies).sort((x, y) => (x.id < y.id ? -1 : 1))) {
    if (a.faction !== AS || a.march !== null || used.has(a.id) || a.lent !== undefined) continue
    let best: { id: string; w: number } | null = null
    for (const m of movesOf(r, AS, a)) {
      if (!m.hostile || m.blocked !== null || m.win === null) continue
      const w = (m.win[0] + m.win[1]) / 2
      if (w >= PUSH && (best === null || w > best.w)) best = { id: m.edge.id, w }
    }
    if (best !== null) { out.push({ kind: 'march', army: a.id, edge: best.id, ambush: false }); continue }
    // 맞닿은 적이 없으면 가장 가까운 남의 고을 쪽으로 한 걸음 (군대가 MOVE_MEN 이상일 때)
    if (menOf(r, AS) < MOVE_MEN) continue
    const step = firstStep(r, a.at)
    if (step !== null) out.push({ kind: 'march', army: a.id, edge: step, ambush: false })
  }
  return out
}
const MOVE_MEN = Number(opt('movemen', '1500'))
/** a 에서 가장 가까운 남의 고을로 가는 첫 길 (우리 땅·빈땅만 지나는 너비 우선) */
function firstStep(r: Realm, from: string): string | null {
  const adj = new Map<string, Array<{ to: string; edge: string }>>()
  for (const e of Object.values(r.edges)) {
    adj.set(e.a, [...(adj.get(e.a) ?? []), { to: e.b, edge: e.id }])
    adj.set(e.b, [...(adj.get(e.b) ?? []), { to: e.a, edge: e.id }])
  }
  const seen = new Set([from])
  let front: Array<{ at: string; first: string | null }> = [{ at: from, first: null }]
  while (front.length > 0) {
    const next: typeof front = []
    for (const { at, first } of front) {
      for (const nb of adj.get(at) ?? []) {
        if (seen.has(nb.to)) continue
        seen.add(nb.to)
        const o = r.nodes[nb.to]?.owner
        const f0 = first ?? nb.edge
        if (o != null && o !== AS) return f0
        next.push({ at: nb.to, first: f0 })
      }
    }
    front = next
  }
  return null
}
for (const kv of opt('set', '').split(',').filter((x) => x !== '')) { const [k, v] = kv.split('='); (P.realm as unknown as Record<string, number>)[k!] = Number(v) }

const bandOf = (s: number): number => Math.floor(s / 10)
const tot: Record<number, { n: number; hh: number; nodes: number; men: number; ratio: number }> = {}
let late: number[] = []
const all: number[] = []
const pAll: number[] = []
let wins = 0, hungerLines = 0, gamesN = 0
for (let g = 0; g < GAMES; g++) {
  let r: Realm = startRegion(REGION, 1000 + g, AS)
  applyTier(r, TIER)
  const per = perSeason(r)
  const lateFrom = SEASONS * per - 50
  const mine: number[] = []
  for (let t = 0; t < SEASONS * per; t++) {
    const mineOs = decide(r, AS, BOT)
    const { next, report } = advance(r, [...mineOs, ...heavyDrafts(r, mineOs), ...pushOrders(r, mineOs), ...aiOrders(r)])
    for (const l of report.lines) {
      if (l.kind === 'hunger' && l.faction === AS) hungerLines++
      if (l.kind === 'battle' && (l.atkFaction ?? r.armies[l.attacker]?.faction) === AS && l.field !== true) {
        const w = l.outcome === 'rout' || l.outcome === 'win' ? 1 : 0
        all.push(w)
        if (t >= lateFrom) { mine.push(w); pAll.push(l.p) }
      }
    }
    r = next
    if (t % per === per - 1) {
      const s = Math.floor(t / per)
      const nodes = Object.values(r.nodes).filter((n) => n.owner === AS).length
      const men = menOf(r, AS)
      let top = 0
      for (const f of Object.keys(r.factions)) if (f !== AS) top = Math.max(top, menOf(r, f))
      const b = (tot[bandOf(s)] ??= { n: 0, hh: 0, nodes: 0, men: 0, ratio: 0 })
      b.n++; b.hh += Object.values(r.nodes).filter((n) => n.owner === AS).reduce((a, n) => a + n.hh, 0); b.nodes += nodes; b.men += men; b.ratio += top / Math.max(1, men)
    }
    if (r.outcome !== null) break
  }
  late = late.concat(mine)
  if (r.outcome?.kind === 'win') wins++
  gamesN++
}
const med = (xs: number[]): number => { const s = [...xs].sort((a, b) => a - b); return s.length === 0 ? NaN : s[Math.floor(s.length / 2)]! }
console.log(`후반 잣대 — ${REGION} · ${AS} · ${BOT} · tier ${TIER} · ${GAMES}판 x ${SEASONS}계절`)
console.log('계절묶음  고을  가호   병력   이웃최강/우리 병력')
for (const k of Object.keys(tot).map(Number).sort((a, b) => a - b)) { const b = tot[k]!; console.log(`${String(k * 10).padStart(4)}     ${(b.nodes / b.n).toFixed(1).padStart(5)} ${(b.hh / b.n).toFixed(0).padStart(6)} ${(b.men / b.n).toFixed(0).padStart(6)}   ${(b.ratio / b.n).toFixed(2)}`) }
const rate = (xs: number[]): string => (xs.length === 0 ? '-' : (xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(3))
console.log(`판 승리 ${wins}/${gamesN} · 굶주림 줄 ${hungerLines} · 우리 공격 싸움 ${all.length}판(승률 ${rate(all)}) · 뒤 50턴 ${late.length}판(승률 ${rate(late)} · p 중앙값 ${med(pAll).toFixed(3)})`)
