/**
 * 항복한 군사 재기 (season.takeYielded · 형 10-29: "항복권유 스킬을 쓰면 아군이 늘어야 하는 거 아닌가. 너무 사기적인가")
 * 봇 판을 돌려 항복 권유가 먹힌 싸움 · 무기를 버린 수 · 군대에 든 수를 세고, swayJoin 을 끈 판과 이김·땅을 견준다.
 *
 *   node --experimental-strip-types tools/realm-sway.ts [--games 200] [--seasons 40] [--region yeongnam]
 */
import { aiOrders, decide, type Brain } from '../src/realm/ai.ts'
import { startRegion, regionNations } from '../src/realm/data/regions/index.ts'
import { advance } from '../src/realm/season.ts'
import type { Realm, RegionId } from '../src/realm/types.ts'
import { P } from '../src/tune/params.ts'

const args = process.argv.slice(2)
const opt = (name: string, def: string): string => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1]! : def }
const GAMES = Number(opt('games', '200'))
const SEASONS = Number(opt('seasons', '40'))
const REGION = opt('region', 'yeongnam') as RegionId
const BOTS: Brain[] = ['reckless', 'cautious', 'planner']

interface Tally { battles: number; swayed: number; yielded: number; joined: number; hh: number; bigJoin: number; win: number; nodes: number; games: number; menEnd: number }

function run(join: number): Tally {
  ;(P.realm as unknown as Record<string, number>).swayJoin = join
  const t: Tally = { battles: 0, swayed: 0, yielded: 0, joined: 0, hh: 0, bigJoin: 0, win: 0, nodes: 0, games: 0, menEnd: 0 }
  const nations = regionNations(REGION)
  for (let g = 0; g < GAMES; g++) {
    const as = nations[g % nations.length]!
    const bot = BOTS[g % BOTS.length]!
    let r: Realm = startRegion(REGION, 1000 + g, as)
    for (let s = 0; s < SEASONS && !r.outcome; s++) {
      const { next, report } = advance(r, [...decide(r, as, bot), ...aiOrders(r)])
      for (const l of report.lines) {
        if (l.kind !== 'battle') continue
        t.battles++
        if (l.yielded !== undefined) {
          t.swayed++
          t.yielded += l.yielded.n
          t.joined += l.yielded.join
          t.hh += l.yielded.hh
          if (l.yielded.join >= 100) t.bigJoin++
        }
      }
      r = next
    }
    t.games++
    if (r.outcome?.kind === 'win') t.win++
    t.nodes += Object.values(r.nodes).filter((n) => n.owner === as).length
    t.menEnd += Object.values(r.armies).filter((a) => a.faction === as).reduce((s, a) => s + Object.values(a.mix).reduce((u, v) => u + (v ?? 0), 0), 0)
  }
  return t
}

for (const join of [0, P.realm.swayJoin, 1]) {
  const t = run(join)
  const per = (x: number): string => (x / t.games).toFixed(2)
  console.log(`swayJoin ${join.toFixed(2)} · 판 ${t.games} · 싸움/판 ${per(t.battles)} · 항복 받은 싸움/판 ${per(t.swayed)} (싸움의 ${((t.swayed / Math.max(1, t.battles)) * 100).toFixed(1)}%)`
    + ` · 무기 버림/번 ${(t.yielded / Math.max(1, t.swayed)).toFixed(0)} · 군대에 듦/번 ${(t.joined / Math.max(1, t.swayed)).toFixed(0)} · 집/번 ${(t.hh / Math.max(1, t.swayed)).toFixed(0)} · 100명 넘게 든 번 ${t.bigJoin}`
    + ` · 플레이어 이김 ${((t.win / t.games) * 100).toFixed(1)}% · 끝 고을 ${per(t.nodes)} · 끝 군사 ${per(t.menEnd)}`)
}
