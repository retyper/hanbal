/**
 * 라운드 싸움 재기 (realm/tactics.ts 전투 2판) — 맡긴 싸움이 옛 한 번 굴림(winChance · bins)과 얼마나 닮았나,
 * 그리고 직접 지휘가 판을 얼마나 바꾸나 (형: "열세여도 잘 판단하면 이기고, 우세여도 잘못 판단하면 진다").
 *
 *   node --experimental-strip-types tools/realm-tactics.ts [--n 2000] [--set tacCapK=0.4]
 *
 * 플레이어 넷: 맡김(AI 와 같은 머리) · 잘 읽음(낌새를 보고 앞줄 맞수 · 흔들리면 돌격·추격 · 잡을 만하면 사로잡기) · 못 읽음(늘 돌격) · 늘 방진.
 * 그리고 사로잡기 — 적은 무리로 큰 무리 속 장수를 잡는 일이 얼마나 드문가.
 */
import { bins, winChance } from '../src/realm/battle.ts'
import { captureOdds, fightRounds, type Side } from '../src/realm/tactics.ts'
import type { Cmd, Pending, RoundOrder } from '../src/realm/types.ts'
import { P } from '../src/tune/params.ts'

const arg = (k: string, d: number): number => {
  const i = process.argv.indexOf(`--${k}`)
  return i > 0 ? Number(process.argv[i + 1]) : d
}
const N = arg('n', 2000)
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

/**
 * 잘 읽는 사람 — 적 앞줄의 낌새에 맞수(방진 > 돌격 > 길 트기 > 방진) · 적이 흔들리면 돌격과 추격 ·
 * 적 활이 있으면 기병은 옆치기 · 손이 닿으면 사로잡기
 */
function good(p: Pending): RoundOrder {
  const canOpen = p.groups.some((g) => g.g === 'bows')
  const front: Cmd = p.foeWaver ? 'charge' : p.hint === 'charge' ? 'hold' : p.hint === 'hold' ? (canOpen ? 'open' : 'hold') : p.hint === 'open' ? 'charge' : 'hold'
  return { front, bows: 'volley', horse: p.foeWaver ? 'pursue' : (p.foe.bows ?? 0) > 0 ? 'flank' : 'punch', lead: p.capture >= 0.45 ? 'capture' : 'drum' }
}
/** 못 읽는 사람 — 늘 돌격, 적 활이 있든 없든 맞쏘기, 흔들리지 않는 적을 쫓는다 */
function bad(p: Pending): RoundOrder {
  return { front: 'charge', bows: (p.foe.bows ?? 0) > 0 ? 'counter' : 'volley', horse: 'pursue', lead: 'drum' }
}
/** 늘 방진 — 한 수만 되풀이하면 읽히는가 */
function still(): RoundOrder {
  return { front: 'hold', bows: 'volley', horse: 'flank', lead: 'drum' }
}

function play(me: Side, foe: Side, key: string, seed: number, who: (p: Pending) => RoundOrder): ReturnType<typeof fightRounds> {
  const cmds: RoundOrder[] = []
  for (let g = 0; g < 10; g++) {
    const t = fightRounds(me, foe, key, seed, 0, { cmds, open: true })
    if (t.pending === undefined) return t
    cmds.push(who(t.pending))
  }
  return fightRounds(me, foe, key, seed, 0, { cmds })
}

const MIXES: Array<[string, Side['mix']]> = [
  ['창 많음', { spear: 60, bow: 20, shield: 10, horse: 10 }],
  ['활 많음', { spear: 20, bow: 60, shield: 20 }],
  ['방패 많음', { spear: 20, bow: 10, shield: 70 }],
  ['말 많음', { spear: 30, bow: 20, shield: 10, horse: 40 }],
]

console.log('전투력 비(공:수) · 옛 승률 · 맡김 · 잘 읽음 · 못 읽음 · 늘 방진 · 잘 읽었을 때 사로잡음 · 합 수 · 잃음 공/수')
for (const ratio of [0.6, 0.8, 1, 1.25, 1.6, 2.2]) {
  let old = 0
  const w = { auto: 0, good: 0, bad: 0, still: 0, cap: 0, rounds: 0, la: 0, ld: 0 }
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
    w.rounds += au.rounds.length
    w.la += 1 - au.na
    w.ld += 1 - au.nd
    const g = play(side(100 * ratio, ma, true), d, key, s, good)
    w.good += won(g.outcome) ? 1 : 0
    w.cap += g.captured === 'd' ? 1 : 0
    w.bad += won(play(side(100 * ratio, ma, true), d, key, s, bad).outcome) ? 1 : 0
    w.still += won(play(side(100 * ratio, ma, true), d, key, s, still).outcome) ? 1 : 0
  }
  const pc = (x: number): string => `${Math.round((x / N) * 100)}%`.padStart(5)
  console.log(`${ratio.toFixed(2).padStart(5)} · ${pc(old)} · ${pc(w.auto)} · ${pc(w.good)} · ${pc(w.bad)} · ${pc(w.still)} · ${pc(w.cap)} · ${(w.rounds / N).toFixed(1)} · ${pc(w.la)}/${pc(w.ld)}`)
}

// 사로잡기 — 우리 남은 사람 · 적 남은 사람 (적 사기 처음 그대로 · 무너질 지경)
console.log('\n사로잡기 확률 — 우리 남은 · 적 남은 → 보통 사기 / 무너질 지경')
const me = side(100, { spear: 50, bow: 30, shield: 20 }, true)
const foe = side(100, { spear: 50, bow: 30, shield: 20 }, false)
for (const [m, f] of [[28, 570], [100, 570], [300, 570], [570, 570], [570, 300], [570, 100], [570, 40]] as const) {
  const a = captureOdds(me, foe, m, 0, f, 1, false, false)
  const b = captureOdds(me, foe, m, 0, f, 0.5, false, false)
  console.log(`  ${String(m).padStart(4)} · ${String(f).padStart(4)} → ${(a.p * 100).toFixed(1)}% / ${(b.p * 100).toFixed(1)}%  (날랜 무리 ${a.squad} · 호위 ${a.escort})`)
}
