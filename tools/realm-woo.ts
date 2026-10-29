/**
 * 옥중 담판 정책 표 (docs/realm/WOO.md §2-4) — 맡김 · 아무거나 · 단추의 % 를 보고 고름.
 * 목표: 「% 를 보고 고름」은 맡김보다 1~2계절을 아끼고, 「아무거나」는 맡김보다 나쁘지 않다.
 *
 *   node --experimental-strip-types tools/realm-woo.ts [판 수 30]
 *   TUNE='wooRage=0.5,wooGrudgeRecruit=0.05' — 숫자를 잠깐 바꿔 본다 (params.ts 는 그대로)
 *
 * 변한 작은 판에서 남의 나라 장수(군주 빼고)를 하나씩 우리 옥에 넣고, 우리 장수 가운데 가장 빨리 될 사람이 달랜다.
 * 계절마다 진짜 판의 함수(applyHeroOrders → applyTalks → stepHeroes)를 그대로 돌린다. 곡식은 넉넉히.
 * 담판은 두 가지로 연다: 저절로 뜰 때만(auto) · 「마주 앉기」까지 열 수 있을 때마다(all).
 */
import { startRegion } from '../src/realm/data/regions/index.ts'
import { applyHeroOrders, isRuler, persuadeSeasons, stepHeroes } from '../src/realm/heroes.ts'
import type { Realm, ReportLine, WooApproach } from '../src/realm/types.ts'
import { applyTalks, approachesOf, chanceOf, shownRange, talkAuto, talkRun, talkWhy, WOO_BEATS } from '../src/realm/woo.ts'
import { P } from '../src/tune/params.ts'

type Policy = 'delegate' | 'random' | 'pct'
for (const kv of (process.env['TUNE'] ?? '').split(',').filter((s) => s.includes('='))) {
  const [k, v] = kv.split('=')
  ;(P.realm as unknown as Record<string, number>)[k!.trim()] = Number(v)
}
const GAMES = Number(process.argv[2] ?? 30)
const CAP = 40

/** 작은 고정 굴림 (아무거나 정책의 손 — 판의 굴림과 따로) */
const pick = (seed: number, i: number, n: number): number => {
  let h = (seed * 2654435761 + i * 40503) >>> 0
  h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0
  return (h ^ (h >>> 13)) % n
}

/** 그 정책으로 마디마다 고른다 — % 를 보는 쪽은 보이는 폭의 가운데가 가장 높은 것 */
function choose(r: Realm, hero: string, by: string, policy: Policy, salt: number): WooApproach[] {
  const talk: WooApproach[] = []
  for (let i = 0; i < WOO_BEATS; i++) {
    const t = talkRun(r, hero, by, talk)
    if (t.end !== 'done' && talk.length > 0) break
    const last = t.beats[t.beats.length - 1]
    const mom = last === undefined ? 0 : last.react === 'big' || last.react === 'sway' ? 1 : -1
    const opts = approachesOf(r, hero, by).filter((a) => a !== 'bond' || !talk.includes('bond'))
    if (policy === 'random') talk.push(opts[pick(salt, i, opts.length)]!)
    else {
      const mid = (a: WooApproach): number => { const s = shownRange(r, by, chanceOf(r, hero, by, a, mom)); return (s.lo + s.hi) / 2 }
      talk.push([...opts].sort((a, b) => mid(b) - mid(a))[0]!)
    }
  }
  return talk
}

/** 한 포로를 넘어올 때까지 — 걸린 계절 · 담판 수 · 원한이 쌓였나 */
function run(seed: number, hero: string, policy: Policy, mode: 'auto' | 'all'): { n: number; talks: number; grudge: boolean } | null {
  const r = startRegion('byeonhan-mini', seed, 'us')
  const me = r.player
  const h = r.heroes[hero]
  if (h === undefined || h.faction === me || isRuler(r, hero)) return null
  h.status = 'captive'
  h.captor = me
  h.at = null
  h.post = null
  for (const a of Object.values(r.armies)) if (a.hero === hero) a.hero = null
  const ours = Object.values(r.heroes).filter((y) => y.faction === me && y.status === 'free')
  const by = [...ours].sort((a, b) => persuadeSeasons(r, hero, a.id) - persuadeSeasons(r, hero, b.id) || (a.id < b.id ? -1 : 1))[0]!.id
  let talks = 0
  for (let s = 1; s <= CAP; s++) {
    r.stock[me]!.grain = 5000
    const why = talkWhy(r, hero)
    const open = policy !== 'delegate' && why !== null && (mode === 'all' || talkAuto(r, hero))
    const talk = open ? choose(r, hero, by, policy, seed * 97 + s) : undefined
    if (talk !== undefined) talks++
    const lines: ReportLine[] = []
    const orders = [{ kind: 'persuade' as const, hero, by, ...(talk !== undefined ? { talk } : {}) }]
    applyHeroOrders(r, orders, lines)
    applyTalks(r, orders, lines)
    stepHeroes(r, lines)
    if (r.heroes[hero]!.faction === me) return { n: s, talks, grudge: (r.heroes[hero]!.grudge ?? 0) > 0 }
    r.season++
  }
  return { n: CAP, talks, grudge: (r.heroes[hero]!.grudge ?? 0) > 0 }
}

const r0 = startRegion('byeonhan-mini', 1, 'us')
const prisoners = Object.values(r0.heroes).filter((h) => h.faction !== r0.player && !isRuler(r0, h.id)).map((h) => h.id).sort()
const avg = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length)
console.log(`옥중 담판 정책 표 · 변한 작은 판 · 포로 ${prisoners.length}명 × 판 ${GAMES} · 넘어올 때까지 계절 (최대 ${CAP})`)
console.log(`벽 배수 큰흔들림 ${P.realm.wooBig} · 흔들림 ${P.realm.wooSway} · 노여움 ${P.realm.wooRage}`)
const rows: Array<[string, Policy, 'auto' | 'all']> = [['맡김', 'delegate', 'auto'], ['아무거나 (저절로 뜰 때)', 'random', 'auto'], ['% 를 보고 (저절로 뜰 때)', 'pct', 'auto'], ['아무거나 (마주 앉기까지)', 'random', 'all'], ['% 를 보고 (마주 앉기까지)', 'pct', 'all']]
const base: Record<string, number> = {}
for (const [name, pol, mode] of rows) {
  const per: Record<string, number[]> = {}
  const all: number[] = []
  let talks = 0
  let grudge = 0
  let cnt = 0
  for (const p of prisoners) {
    for (let g = 1; g <= GAMES; g++) {
      const x = run(g, p, pol, mode)
      if (x === null) continue
      ;(per[p] ??= []).push(x.n)
      all.push(x.n)
      talks += x.talks
      grudge += x.grudge ? 1 : 0
      cnt++
    }
  }
  const mean = avg(all)
  if (pol === 'delegate') for (const [k, v] of Object.entries(per)) base[k] = avg(v)
  const sorted = [...all].sort((a, b) => a - b)
  const med = sorted[Math.floor(sorted.length / 2)] ?? 0
  const save = pol === 'delegate' ? '' : ` · 맡김보다 ${(avg(Object.values(base)) - mean).toFixed(2)}계절 빠름`
  console.log(`${name.padEnd(18)} 평균 ${mean.toFixed(2)} · 가운데 ${med} · 담판 ${(talks / Math.max(1, cnt)).toFixed(2)}번 · 원한 ${Math.round((grudge / Math.max(1, cnt)) * 100)}%${save}`)
}
