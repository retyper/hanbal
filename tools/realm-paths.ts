/**
 * 이기는 길 셈 — 판마다 봇이 우리 나라를 맡아 돌리고, 어느 길로 끝났는지 센다 (docs/realm/VICTORY.md · BALANCE)
 *   정복 이김 · 맹주 이김 · 도읍 잃음 · 남이 진왕 · 안 끝남 · 맹약의 해를 한 번이라도 연 판
 *
 *   node --experimental-strip-types tools/realm-paths.ts [--games 60] [--seasons 40] [--region byeonhan-mini|yeongnam|south|world] [--bot planner]
 */
import { decide, aiOrders, type Brain } from '../src/realm/ai.ts'
import { regionNations, startRegion } from '../src/realm/data/regions/index.ts'
import { advance } from '../src/realm/season.ts'
import type { Realm, RegionId } from '../src/realm/types.ts'

const arg = (k: string, d: string): string => {
  const i = process.argv.indexOf(`--${k}`)
  return i > 0 ? process.argv[i + 1]! : d
}
const GAMES = Number(arg('games', '60'))
const SEASONS = Number(arg('seasons', '40'))
const REGION = arg('region', 'byeonhan-mini') as RegionId
const BOT = arg('bot', 'planner') as Brain

const t = { conquest: 0, suzerain: 0, lost: 0, rival: 0, open: 0, pactYear: 0, rivalNear: 0 }
const nations = regionNations(REGION)
for (let g = 0; g < GAMES; g++) {
  const as = nations[g % nations.length]!
  let r: Realm = startRegion(REGION, g + 1, as)
  let opened = false
  let rivalNear = false
  for (let s = 0; s < SEASONS && !r.outcome; s++) {
    const res = advance(r, [...decide(r, as, BOT), ...aiOrders(r)])
    for (const l of res.report.lines) {
      if (l.kind !== 'suzerain') continue
      if (l.faction === as && l.streak > 0) opened = true
      if (l.faction !== as) rivalNear = true
    }
    r = res.next
  }
  if (opened) t.pactYear++
  if (rivalNear) t.rivalNear++
  const o = r.outcome
  if (o === null || o === undefined) t.open++
  else if (o.kind === 'win') o.path === 'suzerain' ? t.suzerain++ : t.conquest++
  else o.path === 'suzerain' ? t.rival++ : t.lost++
}
const pc = (n: number): string => `${((n / GAMES) * 100).toFixed(1)}%`
console.log(`${REGION} · ${BOT} · ${GAMES}판 × ${SEASONS}계절`)
console.log(`정복 이김 ${pc(t.conquest)} · 맹주 이김 ${pc(t.suzerain)} · 도읍 잃음 ${pc(t.lost)} · 남이 진왕 ${pc(t.rival)} · 안 끝남 ${pc(t.open)}`)
console.log(`맹약의 해를 연 판 ${pc(t.pactYear)} · 남의 맹약 소문이 온 판 ${pc(t.rivalNear)}`)
