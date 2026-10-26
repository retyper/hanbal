/**
 * 유물 셈 — 유물을 낀 판이 얼마나 쉬워지나 (docs/realm/HERO-GROWTH.md ★ §B · §D · src/realm/relics.ts)
 *
 *   node --experimental-strip-types tools/realm-relics.ts [--games 40] [--seasons 40] [--region yeongnam] [--as bihwa] [--bot planner] [--tier 1]
 *        [--only none,guardian,kit3]
 *
 * 봇을 플레이어 자리에 앉혀 같은 시드들로 판을 돌리고, 차림(kit)마다 이김 · 짐 · 이긴 계절을 견준다.
 *   none   유물 없이
 *   <id>   군주 하나가 그 유물 하나를 지닌다 (24가지)
 *   kit3   군주 · 장수 둘에 센 셋 (진묘수 · 오리모양 토기 · 천마도) — 세 판쯤 이겨 모았을 때
 * 합격선 (HERO-GROWTH §B): 유물 하나가 이김을 몇 %p 올리되, 하나로 판이 뒤집히지는 않는다 — 단련(몸) 쪽이 주된 성장이다.
 */
import { aiOrders, decide, type Brain } from '../src/realm/ai.ts'
import { RELICS } from '../src/realm/data/relics.ts'
import { startRegion } from '../src/realm/data/regions/index.ts'
import { isRuler } from '../src/realm/heroes.ts'
import { relicRealm } from '../src/realm/relics.ts'
import { advance } from '../src/realm/season.ts'
import { applyTier } from '../src/realm/tier.ts'
import type { Realm, RegionId } from '../src/realm/types.ts'

const args = process.argv.slice(2)
const opt = (name: string, def: string): string => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 && args[i + 1] !== undefined ? args[i + 1]! : def
}
const GAMES = Number(opt('games', '40'))
const SEASONS = Number(opt('seasons', '40'))
const REGION = opt('region', 'yeongnam') as RegionId
const AS = opt('as', 'bihwa')
const BOT = opt('bot', 'planner') as Brain
const TIER = Number(opt('tier', '1'))
const ALL = ['none', ...RELICS.map((x) => x.id), 'kit3']
const ONLY = opt('only', '').split(',').filter((x) => x !== '')
const KITS = ONLY.length > 0 ? ALL.filter((k) => ONLY.includes(k)) : ALL

/** 그 차림의 끼움 — 군주가 맨 앞, 나머지 우리 장수는 id 차례 */
function wearOf(r: Realm, kit: string): Record<string, string[]> {
  if (kit === 'none') return {}
  const ours = Object.values(r.heroes).filter((h) => h.faction === AS).sort((a, b) => Number(isRuler(r, b.id)) - Number(isRuler(r, a.id)) || (a.id < b.id ? -1 : 1))
  if (kit !== 'kit3') return ours[0] !== undefined ? { [ours[0].id]: [kit] } : {}
  const set = ['guardian', 'duck', 'cheonma']
  const w: Record<string, string[]> = {}
  ours.slice(0, set.length).forEach((h, i) => { w[h.id] = [set[i]!] })
  return w
}

interface Out { win: boolean; lose: boolean; at: number }
function play(kit: string, seed: number): Out {
  let r: Realm = startRegion(REGION, seed, AS)
  applyTier(r, TIER)
  relicRealm(r, wearOf(r, kit))
  for (let s = 0; s < SEASONS; s++) {
    const { next } = advance(r, [...decide(r, AS, BOT), ...aiOrders(r)])
    r = next
    if (r.outcome !== null) break
  }
  return { win: r.outcome?.kind === 'win', lose: r.outcome?.kind === 'lose', at: r.season }
}

const pct = (x: number): string => `${(x * 100).toFixed(1)}%`
console.log(`유물 셈 — ${REGION} · ${AS} · ${BOT} · 난세 ${TIER} · ${GAMES}판 × ${SEASONS}계절`)
console.log('차림          이김     짐     이긴 계절   이김 차이')
let base = -1
for (const kit of KITS) {
  const outs: Out[] = []
  for (let g = 0; g < GAMES; g++) outs.push(play(kit, 1000 + g))
  const w = outs.filter((o) => o.win)
  const win = w.length / outs.length
  if (kit === 'none') base = win
  const at = w.length === 0 ? '-' : (w.reduce((a, o) => a + o.at, 0) / w.length).toFixed(1)
  const diff = base < 0 || kit === 'none' ? '' : `${win - base >= 0 ? '+' : ''}${((win - base) * 100).toFixed(1)}%p`
  console.log(`${kit.padEnd(12)} ${pct(win).padStart(6)} ${pct(outs.filter((o) => o.lose).length / outs.length).padStart(6)} ${String(at).padStart(8)}   ${diff}`)
}
