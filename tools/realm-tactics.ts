/**
 * 라운드 싸움 재기 (realm/tactics.ts) — 맡긴 싸움이 옛 한 번 굴림(winChance · bins)과 얼마나 닮았나,
 * 그리고 직접 지휘가 판을 얼마나 바꾸나 (형: "열세여도 잘 판단하면 이기고, 우세여도 잘못 판단하면 진다").
 *
 *   node --experimental-strip-types tools/realm-tactics.ts [--n 2000]
 *
 * 플레이어 셋: 맡김(AI 와 같은 머리) · 잘 읽음(적의 가장 센 명령의 맞수를 내고, 적이 줄면 사로잡으러 간다) · 못 읽음(적에게 지는 명령만).
 */
import { bins, winChance } from '../src/realm/battle.ts'
import { BASIC, COUNTER, BEATS, fightRounds, might, type Side } from '../src/realm/tactics.ts'
import type { Cmd } from '../src/realm/types.ts'
import { P } from '../src/tune/params.ts'

const arg = (k: string, d: number): number => {
  const i = process.argv.indexOf(`--${k}`)
  return i > 0 ? Number(process.argv[i + 1]) : d
}
const N = arg('n', 2000)
// --set tacJitter=0.5,tacTriUp=1.3 — 조율해 볼 때 (params.ts 를 고치기 전에)
const set = process.argv.indexOf('--set')
if (set > 0) {
  for (const kv of process.argv[set + 1]!.split(',')) {
    const [k, v] = kv.split('=')
    ;(P.realm as unknown as Record<string, number>)[k!] = Number(v)
  }
}

const side = (F: number, mix: Side['mix'], player: boolean, mu = 5): Side => ({
  F, mix, morale: 1, hero: { id: player ? 'me' : 'foe', mu, ryak: 5, coward: false }, hungry: false, specials: [], water: false, player, seen: true,
})

/** 적 구성으로 짐작한 그 적의 가장 센 명령 */
const foeBest = (foe: Side): Cmd => [...BASIC].sort((x, y) => might(foe, y) - might(foe, x))[0]!

/** 정해진 방식으로 고른 명령들 — 사로잡기는 라운드 셋째부터 */
function plan(kind: 'good' | 'bad', foe: Side, rounds: number): Cmd[] {
  const b = foeBest(foe)
  const out: Cmd[] = []
  for (let i = 0; i < rounds; i++) out.push(kind === 'good' ? (i >= 2 ? 'capture' : COUNTER[b]!) : (BEATS[b] === undefined ? 'charge' : (Object.keys(BEATS) as Cmd[]).find((c) => BEATS[b] === c)!))
  return out
}

const MIXES: Array<[string, Side['mix']]> = [
  ['창 많음', { spear: 70, bow: 20, shield: 10 }],
  ['활 많음', { spear: 20, bow: 70, shield: 10 }],
  ['방패 많음', { spear: 20, bow: 10, shield: 70 }],
  ['고루', { spear: 34, bow: 33, shield: 33 }],
]

console.log('전투력 비(공:수) · 옛 승률(이김+대승) · 맡김 · 잘 읽음 · 못 읽음 · 잘 읽었을 때 사로잡음')
for (const ratio of [0.6, 0.8, 1, 1.25, 1.6, 2.2]) {
  let old = 0
  const w = { auto: 0, draw: 0, rounds: 0, la: 0, ld: 0, good: 0, bad: 0, cap: 0, read: 0, readCap: 0 }
  let n = 0
  for (let s = 0; s < N; s++) {
    const [, ma] = MIXES[s % MIXES.length]!
    const [, md] = MIXES[Math.floor(s / MIXES.length) % MIXES.length]!
    const d = side(100, md, false)
    const won = (o: string): boolean => o === 'win' || o === 'rout'
    const b = bins(winChance(100 * ratio, 100))
    old += b.win + b.rout
    const key = `k${s}`
    const au = fightRounds(side(100 * ratio, ma, false), d, key, s, 0)
    w.auto += won(au.outcome) ? 1 : 0
    w.draw += au.outcome === 'draw' ? 1 : 0
    w.rounds += au.rounds.length
    w.la += 1 - au.na
    w.ld += 1 - au.nd
    const g = fightRounds(side(100 * ratio, ma, true), d, key, s, 0, { cmds: plan('good', d, 4) })
    w.good += won(g.outcome) ? 1 : 0
    w.cap += g.captured === 'd' ? 1 : 0
    w.bad += won(fightRounds(side(100 * ratio, ma, true), d, key, s, 0, { cmds: plan('bad', d, 4) }).outcome) ? 1 : 0
    // 귀띔을 읽는 사람 — 라운드마다 시험 돌려 낌새를 보고 그 맞수를 낸다. 사로잡기가 좋아 보이면 간다
    const me = side(100 * ratio, ma, true)
    const cmds: Cmd[] = []
    for (;;) {
      const t = fightRounds(me, d, key, s, 0, { cmds, open: true })
      const pd = t.pending
      if (pd === undefined) {
        w.read += won(t.outcome) ? 1 : 0
        w.readCap += t.captured === 'd' ? 1 : 0
        break
      }
      const c: Cmd = pd.capture >= 0.45 ? 'capture' : pd.hint !== null && COUNTER[pd.hint] !== undefined ? COUNTER[pd.hint]! : 'charge'
      cmds.push(c)
    }
    n++
  }
  const pc = (x: number): string => `${Math.round((x / n) * 100)}%`.padStart(5)
  console.log(`${ratio.toFixed(2).padStart(5)} · ${pc(old)} · ${pc(w.auto)} · ${pc(w.good)} · ${pc(w.bad)} · ${pc(w.cap)} · 귀띔 ${pc(w.read)} (사로잡음 ${pc(w.readCap)}) · 맡김 교착 ${pc(w.draw)} · 라운드 ${(w.rounds / n).toFixed(1)} · 잃음 공 ${pc(w.la)} 수 ${pc(w.ld)}`)
}
