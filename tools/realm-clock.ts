/**
 * 싸움 길이 재기 — 해시계 (docs/realm/BATTLE.md §해시계 · 형 10-26: "언제 전투가 끝나는지도 모르고 갑자기 끝나버려서").
 *
 *   node --experimental-strip-types tools/realm-clock.ts [--games 12] [--seasons 40] [--region yeongnam]
 *
 * 봇들이 판을 돌리는 동안 난 싸움을 모두 모아 — 판당 합 수 · 합 수 나눔 · 마지막 때까지 간 몫 · 밤 싸움 몫 ·
 * 마지막 때의 고름(진을 친다 · 한 합 더 · 물러난다) · 끝난 까닭을 찍는다.
 */
import { aiOrders, decide, type Brain } from '../src/realm/ai.ts'
import { regionNations, startRegion } from '../src/realm/data/regions/index.ts'
import { advance } from '../src/realm/season.ts'
import type { Realm, RegionId, ReportLine } from '../src/realm/types.ts'

const args = process.argv.slice(2)
const opt = (name: string, def: string): string => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 && args[i + 1] !== undefined ? args[i + 1]! : def
}
const GAMES = Number(opt('games', '12'))
const SEASONS = Number(opt('seasons', '40'))
const REGION = opt('region', 'yeongnam') as RegionId
const BOTS: Brain[] = ['reckless', 'cautious', 'planner', 'random']
type B = Extract<ReportLine, { kind: 'battle' }>
const lines: B[] = []
const nations = regionNations(REGION)
for (let g = 0; g < GAMES; g++) {
  const as = nations[g % nations.length]!
  const bot = BOTS[g % BOTS.length]!
  let r: Realm = startRegion(REGION, 2000 + g, as)
  for (let s = 0; s < SEASONS && r.outcome === null; s++) {
    const { next, report } = advance(r, [...decide(r, as, bot), ...aiOrders(r)])
    for (const l of report.lines) if (l.kind === 'battle' && l.rounds !== undefined) lines.push(l)
    r = next
  }
}
const n = lines.length
const pc = (x: number, d = n): string => `${((x / Math.max(1, d)) * 100).toFixed(1)}%`
const len = new Map<number, number>()
for (const l of lines) len.set(l.rounds!.length, (len.get(l.rounds!.length) ?? 0) + 1)
const avg = lines.reduce((s, l) => s + l.rounds!.length, 0) / Math.max(1, n)
console.log(`싸움 ${n}판 (${REGION} · ${GAMES}판 × ${SEASONS}계절)`)
console.log(`판당 합 ${avg.toFixed(2)} · 합 수 나눔 ${[...len.entries()].sort((a, b) => a[0] - b[0]).map(([k, v]) => `${k}합 ${pc(v)}`).join(' · ')}`)
const why = new Map<string, number>()
for (const l of lines) why.set(l.endWhy ?? '?', (why.get(l.endWhy ?? '?') ?? 0) + 1)
console.log(`끝난 까닭 ${[...why.entries()].map(([k, v]) => `${k} ${pc(v)}`).join(' · ')}`)
const night = lines.filter((l) => l.ambush !== 'none')
console.log(`밤 싸움(기습·야습) ${pc(night.length)} · 밤 싸움의 판당 합 ${(night.reduce((s, l) => s + l.rounds!.length, 0) / Math.max(1, night.length)).toFixed(2)}`)
const ext = lines as Array<B & { clock?: { night: boolean; slots: number }; dusk?: ReadonlyArray<{ a: string; d: string }> }>
const withClock = ext.filter((l) => l.clock !== undefined)
if (withClock.length > 0) {
  const reach = withClock.filter((l) => (l.dusk ?? []).length > 0).length
  const over = withClock.filter((l) => l.rounds!.length > l.clock!.slots).length
  console.log(`마지막 때까지 간 판 ${pc(reach)} · 한 합 더 싸운 판 ${pc(over)}`)
  const picks = new Map<string, number>()
  for (const l of withClock) for (const d of l.dusk ?? []) for (const x of [d.a, d.d]) picks.set(x, (picks.get(x) ?? 0) + 1)
  const tot = [...picks.values()].reduce((a, b) => a + b, 0)
  console.log(`마지막 때의 고름 (두 쪽 다 셈) ${[...picks.entries()].map(([k, v]) => `${k} ${pc(v, tot)}`).join(' · ')}`)
} else {
  console.log(`셋째 합 넘어 간 판 ${pc(lines.filter((l) => l.rounds!.length > 3).length)} · 무너지거나 잡히거나 물러나지 않고 셋째 합에 끝난 판 ${pc(lines.filter((l) => l.rounds!.length === 3 && (l.endWhy === 'share' || l.endWhy === 'draw')).length)}`)
}
const o = new Map<string, number>()
for (const l of lines) o.set(l.outcome, (o.get(l.outcome) ?? 0) + 1)
console.log(`결과 ${[...o.entries()].map(([k, v]) => `${k} ${pc(v)}`).join(' · ')}`)
