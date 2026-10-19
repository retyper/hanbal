/**
 * 이기는 길 셈 — 판마다 봇이 우리 나라를 맡아 돌리고, 어느 길로 끝났는지 센다 (docs/realm/VICTORY.md · BALANCE)
 *   길마다 우리 이김 · 남이 이룸(우리 짐) · 도읍 잃음 · 안 끝남 · 맹약의 해를 연 판 · 소문이 온 판
 *
 *   node --experimental-strip-types tools/realm-paths.ts [--games 60] [--seasons 40] [--region byeonhan-mini|yeongnam|south|world] [--bot planner] [--set k=v,…]
 */
import { decide, aiOrders, type Brain } from '../src/realm/ai.ts'
import { regionNations, startRegion } from '../src/realm/data/regions/index.ts'
import { advance } from '../src/realm/season.ts'
import type { Realm, RegionId } from '../src/realm/types.ts'
import { P } from '../src/tune/params.ts'

const arg = (k: string, d: string): string => {
  const i = process.argv.indexOf(`--${k}`)
  return i > 0 ? process.argv[i + 1]! : d
}
const GAMES = Number(arg('games', '60'))
const SEASONS = Number(arg('seasons', '40'))
const REGION = arg('region', 'byeonhan-mini') as RegionId
const BOT = arg('bot', 'planner') as Brain
// --set riteHHPerNation=1200,ironseaPerNation=60 — 조율해 볼 때 (params.ts 를 고치기 전에)
for (const kv of arg('set', '').split(',').filter((x) => x !== '')) {
  const [k, v] = kv.split('=')
  ;(P.realm as unknown as Record<string, number>)[k!] = Number(v)
}

type Path = 'conquest' | 'suzerain' | 'ironsea' | 'rite'
const PATHS: readonly Path[] = ['conquest', 'suzerain', 'ironsea', 'rite']
const win: Record<Path, number> = { conquest: 0, suzerain: 0, ironsea: 0, rite: 0 }
const rival: Record<Path, number> = { conquest: 0, suzerain: 0, ironsea: 0, rite: 0 }
const t = { open: 0, pactYear: 0, rumorPact: 0, rumorIron: 0, rumorRite: 0, ourChain2: 0 }
const nations = regionNations(REGION)
for (let g = 0; g < GAMES; g++) {
  const as = nations[g % nations.length]!
  let r: Realm = startRegion(REGION, g + 1, as)
  const seen = { pact: false, rp: false, ri: false, rr: false, chain: false }
  for (let s = 0; s < SEASONS && !r.outcome; s++) {
    const res = advance(r, [...decide(r, as, BOT), ...aiOrders(r)])
    for (const l of res.report.lines) {
      if (l.kind === 'suzerain') {
        if (l.faction === as && l.streak > 0) seen.pact = true
        if (l.faction !== as) seen.rp = true
      } else if (l.kind === 'pathIron' && l.faction !== as) seen.ri = true
      else if (l.kind === 'pathRite') {
        if (l.faction !== as) seen.rr = true
        else if (l.chain >= 2) seen.chain = true
      }
    }
    r = res.next
  }
  if (seen.pact) t.pactYear++
  if (seen.rp) t.rumorPact++
  if (seen.ri) t.rumorIron++
  if (seen.rr) t.rumorRite++
  if (seen.chain) t.ourChain2++
  const o = r.outcome
  if (o === null || o === undefined) t.open++
  else (o.kind === 'win' ? win : rival)[(o.path ?? 'conquest') as Path]++
}
const pc = (n: number): string => `${((n / GAMES) * 100).toFixed(1)}%`
const NAME: Record<Path, string> = { conquest: '정복', suzerain: '맹주', ironsea: '철과 뱃길', rite: '큰 제사' }
console.log(`${REGION} · ${BOT} · ${GAMES}판 × ${SEASONS}계절`)
console.log(`우리 이김 — ${PATHS.map((p) => `${NAME[p]} ${pc(win[p])}`).join(' · ')}`)
console.log(`우리 짐 — 도읍 잃음 ${pc(rival.conquest)} · ${PATHS.slice(1).map((p) => `남이 ${NAME[p]} ${pc(rival[p])}`).join(' · ')} · 안 끝남 ${pc(t.open)}`)
console.log(`맹약의 해를 연 판 ${pc(t.pactYear)} · 우리 제사 사슬 둘 넘은 판 ${pc(t.ourChain2)} · 소문 — 맹주 ${pc(t.rumorPact)} · 뱃길 ${pc(t.rumorIron)} · 제사 ${pc(t.rumorRite)}`)
