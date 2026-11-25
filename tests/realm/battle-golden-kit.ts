// 본편 전투 골든 해시 틀 (battle-golden.test.ts · tools/realm-golden.ts 가 같이 쓴다)
import assert from 'node:assert/strict'
import { aiOrders, decide } from '../../src/realm/ai.ts'
import { startRegion } from '../../src/realm/data/regions/index.ts'
import { advance } from '../../src/realm/season.ts'
import { rehearse } from '../../src/realm/warroom.ts'
import { fightRounds, type Side } from '../../src/realm/tactics.ts'
import type { Cmd, Dusk, Pending, Realm, RegionId, RoundOrder, Tactic } from '../../src/realm/types.ts'
import { P } from '../../src/tune/params.ts'

export const GOLDEN_N = 300
const RATIOS = [0.6, 0.8, 1, 1.25, 1.6, 2.2]
const MIXES: Array<Side['mix']> = [
  { spear: 60, bow: 20, shield: 10, horse: 10 },
  { spear: 20, bow: 60, shield: 20 },
  { spear: 30, bow: 20, shield: 10, horse: 40 },
]

export const fnv = (s: string): string => {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0 }
  return h.toString(16)
}
const side = (F: number, mix: Side['mix'], player: boolean, mu = 5): Side => ({
  F, mix, morale: 1, hero: { id: player ? 'me' : 'foe', mu, ryak: 5, coward: false }, hungry: false, specials: [], water: false, player, seen: true, grain: 1000,
})

function good(p: Pending): RoundOrder {
  const canOpen = p.groups.some((g) => g.g === 'bows')
  const front: Cmd = p.foeWaver ? 'charge' : p.hint === 'charge' ? 'hold' : p.hint === 'hold' ? (canOpen ? 'open' : 'hold') : p.hint === 'open' ? 'charge' : 'hold'
  return { front, bows: 'volley', horse: p.foeWaver ? 'pursue' : (p.foe.bows ?? 0) > 0 ? 'flank' : 'punch', lead: p.capture >= 0.45 ? 'capture' : 'drum' }
}
const still = (): RoundOrder => ({ front: 'hold', bows: 'volley', horse: 'flank', lead: 'drum' })
const goodDusk = (p: Pending): Dusk => (p.dusk !== undefined && (p.dusk.edge >= 0.55 || (p.weAtk && p.dusk.edge >= 0.45)) ? 'press' : 'camp')

type FR = ReturnType<typeof fightRounds>
function play(me: Side, foe: Side, key: string, seed: number, who: (p: Pending) => RoundOrder, atDusk: (p: Pending) => Dusk): FR {
  const cmds: RoundOrder[] = []
  const dusk: Dusk[] = []
  for (let g = 0; g < 12; g++) {
    const t = fightRounds(me, foe, key, seed, 0, { cmds, dusk, open: true })
    if (t.pending === undefined) return t
    if (t.pending.dusk !== undefined) dusk.push(atDusk(t.pending))
    else cmds.push(who(t.pending))
  }
  return fightRounds(me, foe, key, seed, 0, { cmds, dusk })
}

export type Policy = 'auto' | 'good' | 'still'
export const POLICIES: Policy[] = ['auto', 'good', 'still']
/** 정책 하나로 n 판 — 판 i 의 병종·비·씨앗은 i 로만 정해지니 n 이 커져도 앞 판은 같다. 해시 · outcome 분포 · endWhy 분포 */
export function goldenA(policy: Policy, n: number): string {
  let acc = ''
  const oc: Record<string, number> = {}
  const ew: Record<string, number> = {}
  for (let s = 1; s <= n; s++) {
    const ratio = RATIOS[s % RATIOS.length]!
    const ma = MIXES[Math.floor(s / RATIOS.length) % MIXES.length]!
    const md = MIXES[Math.floor(s / (RATIOS.length * MIXES.length)) % MIXES.length]!
    const me = side(100 * ratio, ma, policy !== 'auto')
    const foe = side(100, md, false)
    const key = `k${s}`
    const r = policy === 'auto' ? fightRounds(me, foe, key, s, 0)
      : policy === 'good' ? play(me, foe, key, s, good, goodDusk)
      : play(me, foe, key, s, still, () => 'camp')
    acc = fnv(acc + JSON.stringify(r))
    oc[r.outcome] = (oc[r.outcome] ?? 0) + 1
    const w = String((r as unknown as { endWhy?: unknown }).endWhy)
    ew[w] = (ew[w] ?? 0) + 1
  }
  const fmt = (o: Record<string, number>): string => Object.keys(o).sort().map((k) => `${k}:${o[k]}`).join(',')
  return `${acc} oc[${fmt(oc)}] ew[${fmt(ew)}]`
}

const CYCLE: RoundOrder[] = [
  { front: 'hold', bows: 'volley', horse: 'flank', lead: 'drum' },
  { front: 'charge', bows: 'counter', horse: 'punch', lead: 'drum' },
  { front: 'open', bows: 'volley', horse: 'pursue', lead: 'capture' },
]
const fixedTactic = (i: number): Tactic => ({
  cmds: [CYCLE[i % 3]!, CYCLE[(i + 1) % 3]!, 'charge', CYCLE[(i + 2) % 3]!, 'hold', CYCLE[i % 3]!],
  open: false,
  dusk: ['camp', 'press', 'camp', 'camp'],
})
export const RUNS: Array<[RegionId, string, number]> = [['tutorial', 'baekje', 1], ['mahan', 'baekje', 2], ['jumong', 'goguryeo', 1]]

/** 16턴 — 우리 싸움마다 고정 명령을 command 길(tactics)로 준다. 턴마다 report 해시 · 마지막 realm 해시 · 우리 싸움 수 */
export function goldenB(reg: RegionId, nat: string, seed: number, turns = 16): { hash: string; ours: number } {
  const save = (P.realm as unknown as Record<string, number>)['monthClock']!
  ;(P.realm as unknown as Record<string, number>)['monthClock'] = 0
  try {
    let r: Realm = startRegion(reg, seed, nat)
    let acc = ''
    let ours = 0
    for (let s = 0; s < turns; s++) {
      const o = [...decide(r, r.player, 'planner'), ...aiOrders(r)]
      const done: Record<string, Tactic> = {}
      for (let k = 0; k < 4; k++) {
        const re = rehearse(r, o, done, null, r.player)
        if (re.line === null || re.line.key === undefined) break
        done[re.line.key] = fixedTactic(ours++)
      }
      const { next, report } = advance(r, o, {}, done)
      for (const l of report.lines) {
        if (l.kind === 'battle' && l.key !== undefined && done[l.key] !== undefined) assert.ok(l.rounds !== undefined && l.rounds.length > 0, 'command 싸움은 합이 있다')
      }
      acc = fnv(acc + JSON.stringify(report))
      r = next
      if (r.outcome !== null) break
    }
    return { hash: `${fnv(JSON.stringify(r))} ${acc} ours:${ours}`, ours }
  } finally {
    ;(P.realm as unknown as Record<string, number>)['monthClock'] = save
  }
}

