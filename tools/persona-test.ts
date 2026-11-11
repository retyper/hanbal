/**
 * 페르소나 손님 시험 (헤드리스) — MEGAHIT 2단계 4 · 틀은 docs/realm/PLAYTEST.md, 사건 잡기·분 환산은 first-hour-lib.ts 를 같이 쓴다
 *
 *   node --experimental-strip-types tools/persona-test.ts [--seeds 5] [--board mahan] [--minutes 60] [--turns 120] [--out 표.md]
 *
 * 세 사람 (판의 시작 = 앱이 새 판을 여는 길과 같다: startRegion(board, seed, 'baekje') · 배우는 판 다음 1장 마한):
 *   ① 처음 하는 사람   기본 두뇌(cautious: 최악 승률 60% 이상일 때만 친다)가 낸 명령 가운데 기본 명령만 (공작·혼인·원정·장터·사민 같은 고급은 안 연다). 등용은 늘.
 *   ② 아무거나 누르는 사람  모든 두뇌가 낼 수 있는 명령을 모아 놓고 씨앗 굴림으로 0~3개를 아무렇게나 고른다. 20% 는 쉰다. 사건 카드도 아무 답.
 *   ③ 한 판만 하는 사람  무모 두뇌에서 짓기·개척·곳간·제사 같은 살림 명령을 뺀다. 첫 패배 또는 30분에 접는다.
 * 결정론: 같은 씨앗이면 같은 표. 「분」은 first-hour.ts 와 같은 가운데 가정 비용이다.
 * 막힘(STUCK) = 우리 군대·고을·장수가 9턴(석 계절) 내리 그대로.
 */
import { writeFileSync } from 'node:fs'
import { aiOrders, decide } from '../src/realm/ai.ts'
import { startRegion } from '../src/realm/data/regions/index.ts'
import { advance } from '../src/realm/season.ts'
import type { Order, Realm, RegionId } from '../src/realm/types.ts'
import { COSTS, headFlags, noCounts, scanReport, turnSeconds, type Mile } from './first-hour-lib.ts'

const args = process.argv.slice(2)
const opt = (name: string, def: string): string => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 && args[i + 1] !== undefined ? args[i + 1]! : def
}
const SEEDS = Number(opt('seeds', '5'))
const BOARD = opt('board', 'mahan') as RegionId
const MINUTES = Number(opt('minutes', '60'))
const TURNS = Number(opt('turns', '120'))
const OUT = opt('out', '')
const QUIT_MIN = 30
const AS = 'baekje'
const STUCK_TURNS = 9

type Persona = 'novice' | 'random' | 'oneshot'
const PERSONAS: readonly Persona[] = ['novice', 'random', 'oneshot']
const LABEL: Record<Persona, string> = { novice: '① 처음 하는 사람', random: '② 아무거나 누르는 사람', oneshot: '③ 한 판만 하는 사람' }

/** 처음 사람이 안 여는 고급 명령 */
const ADVANCED = new Set<Order['kind']>(['plot', 'wed', 'expedition', 'scale', 'wish', 'migrate', 'migrateAuto', 'place', 'party', 'partyGo', 'partyJoin', 'council', 'envoy', 'bowUp', 'buy', 'sell', 'wonder', 'feast', 'palace', 'seat'])
/** 짓지 않는 사람 */
const BUILDS = new Set<Order['kind']>(['build', 'clearLot', 'wonder', 'feast', 'palace', 'seat', 'work', 'settle', 'party', 'partyGo', 'partyJoin', 'call', 'rite', 'guard', 'arm', 'place', 'migrate'])

/** 작은 씨앗 굴림 (도구 안에서만 · 시뮬 안이 아니다) */
function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}

function playerOrders(p: Persona, r: Realm, roll: () => number): Order[] {
  if (p === 'novice') return decide(r, AS, 'cautious').filter((o) => !ADVANCED.has(o.kind))
  if (p === 'oneshot') return decide(r, AS, 'reckless').filter((o) => !BUILDS.has(o.kind))
  // 아무거나: 모든 두뇌가 낼 수 있는 명령 묶음에서 아무렇게나
  const seen = new Set<string>()
  const pool: Order[] = []
  for (const b of ['cautious', 'greedy', 'reckless', 'random'] as const) for (const o of decide(r, AS, b)) { const k = JSON.stringify(o); if (!seen.has(k)) { seen.add(k); pool.push(o) } }
  const out: Order[] = []
  if (roll() >= 0.2) {
    const n = 1 + Math.floor(roll() * 3)
    for (let i = 0; i < n && pool.length > 0; i++) out.push(pool.splice(Math.floor(roll() * pool.length), 1)[0]!)
  }
  if (r.card != null) out.push({ kind: 'card', faction: AS, pick: Math.floor(roll() * 3) as 0 | 1 | 2 })
  return out
}

interface Snap { turn: number; grain: number; iron: number; nodes: number; heroes: number }
interface Result {
  persona: Persona; seed: number; turns: number; min: number
  end: 'cap' | 'quit' | 'win' | 'lose' | 'error'; endMin: number
  first: Partial<Record<'battle' | 'duel' | 'capture' | 'recruit' | 'ascend' | 'bigLoss', number>>
  losses: number; stuckAt: number | null; lostAllAt: number | null; err: string | null
  snaps: Snap[]; nodes: number; grain: number; iron: number; heroes: number
}

const mineNodes = (r: Realm): number => Object.values(r.nodes).filter((n) => n.owner === AS).length
const mineHeroes = (r: Realm): number => Object.values(r.heroes).filter((h) => h.faction === AS && h.status === 'free').length
function sig(r: Realm): string {
  const a = Object.values(r.armies).filter((x) => x.faction === AS).map((x) => `${x.id}@${x.at}:${Object.values(x.mix).reduce((s, v) => s + (v ?? 0), 0)}`).sort().join(',')
  const n = Object.values(r.nodes).filter((x) => x.owner === AS).map((x) => x.id).sort().join(',')
  const h = Object.values(r.heroes).filter((x) => x.faction === AS).map((x) => `${x.id}:${x.status}`).sort().join(',')
  return `${a}|${n}|${h}`
}

function play(persona: Persona, seed: number): Result {
  const roll = rng(seed * 7919 + PERSONAS.indexOf(persona) * 104729)
  let r = startRegion(BOARD, seed, AS)
  const startKnown = new Set(r.known?.[AS] ?? [])
  const res: Result = { persona, seed, turns: 0, min: 0, end: 'cap', endMin: 0, first: {}, losses: 0, stuckAt: null, lostAllAt: null, err: null, snaps: [], nodes: 0, grain: 0, iron: 0, heroes: 0 }
  let sec = COSTS.mid.intro
  const lost = { n: 0, big: 0 }
  let lastSig = sig(r), same = 0
  try {
    for (let t = 0; t < TURNS; t++) {
      const flags = new Set<Mile>()
      const c = noCounts()
      headFlags(r, AS, flags, c)
      const big0 = lost.big
      const orders = [...playerOrders(persona, r, roll), ...aiOrders(r)]
      const { next, report } = advance(r, orders)
      scanReport(r, next, report.lines, AS, false, startKnown, flags, c, lost)
      r = next
      sec += turnSeconds(COSTS.mid, false, c)
      const min = sec / 60
      const at = (k: keyof Result['first']): void => { res.first[k] ??= min }
      if (flags.has('battle')) at('battle')
      if (flags.has('duel')) at('duel')
      if (flags.has('capture')) at('capture')
      if (flags.has('recruit')) at('recruit')
      if (flags.has('ascend')) at('ascend')
      if (lost.big > big0) at('bigLoss')
      res.turns = t + 1; res.min = min; res.losses = lost.n
      if ((t + 1) % 3 === 0) res.snaps.push({ turn: t + 1, grain: r.stock[AS]?.grain ?? 0, iron: r.stock[AS]?.iron ?? 0, nodes: mineNodes(r), heroes: mineHeroes(r) })
      const s = sig(r)
      same = s === lastSig ? same + 1 : 0
      lastSig = s
      if (same >= STUCK_TURNS && res.stuckAt === null) res.stuckAt = t + 1 - STUCK_TURNS
      if (mineNodes(r) === 0 && res.lostAllAt === null) res.lostAllAt = min
      if (r.outcome != null) { res.end = r.outcome.kind === 'win' ? 'win' : 'lose'; res.endMin = min; if (res.end === 'lose') res.lostAllAt ??= min; break }
      if (res.lostAllAt !== null) { res.end = 'lose'; res.endMin = min; break }
      if (persona === 'oneshot' && (lost.n > 0 || min >= QUIT_MIN)) { res.end = 'quit'; res.endMin = min; break }
      if (min >= MINUTES) { res.end = 'cap'; res.endMin = min; break }
    }
  } catch (e) {
    res.end = 'error'; res.err = e instanceof Error ? (e.stack ?? e.message).split('\n').slice(0, 3).join(' | ') : String(e); res.endMin = res.min
  }
  res.nodes = mineNodes(r); res.grain = r.stock[AS]?.grain ?? 0; res.iron = r.stock[AS]?.iron ?? 0; res.heroes = mineHeroes(r)
  return res
}

const all: Result[] = []
for (const p of PERSONAS) for (let s = 1; s <= SEEDS; s++) all.push(play(p, s))

const f1 = (x: number | undefined): string => (x === undefined ? '-' : x.toFixed(0))
const END: Record<Result['end'], string> = { cap: '한 시간 채움', quit: '접음', win: '이김', lose: '전멸', error: '오류' }
const rows: string[] = []
rows.push('| 손님 | 씨앗 | 끝 | 끝난 분 | 턴 | 고을 | 곡식 | 철 | 장수 | 첫 싸움 | 첫 겨루기 | 첫 생포 | 첫 등용 | 첫 각성 | 첫 큰 패배 | 진 싸움 | 막힘 | 전멸 | 오류 |')
rows.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|')
for (const x of all) {
  rows.push(`| ${LABEL[x.persona]} | ${x.seed} | ${END[x.end]} | ${f1(x.endMin)} | ${x.turns} | ${x.nodes} | ${x.grain.toFixed(0)} | ${x.iron.toFixed(0)} | ${x.heroes} | ${f1(x.first.battle)} | ${f1(x.first.duel)} | ${f1(x.first.capture)} | ${f1(x.first.recruit)} | ${f1(x.first.ascend)} | ${f1(x.first.bigLoss)} | ${x.losses} | ${x.stuckAt === null ? '-' : `${x.stuckAt}턴째`} | ${x.lostAllAt === null ? '-' : `${f1(x.lostAllAt)}분`} | ${x.err === null ? '-' : '있음'} |`)
}
const med = (xs: number[]): string => { if (xs.length === 0) return '-'; const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]!.toFixed(0) }
const sum: string[] = []
sum.push('| 손님 | 판 | 한 시간 채움 | 이김 | 전멸 | 접음 | 막힘 | 오류 | 첫 생포 있는 판 | 첫 등용 있는 판 | 첫 각성 있는 판 | 첫 생포 중간(분) | 첫 각성 중간(분) | 끝 고을 중간 | 끝 장수 중간 |')
sum.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|')
for (const p of PERSONAS) {
  const xs = all.filter((x) => x.persona === p)
  const n = (f: (x: Result) => boolean): number => xs.filter(f).length
  sum.push(`| ${LABEL[p]} | ${xs.length} | ${n((x) => x.end === 'cap')} | ${n((x) => x.end === 'win')} | ${n((x) => x.end === 'lose')} | ${n((x) => x.end === 'quit')} | ${n((x) => x.stuckAt !== null)} | ${n((x) => x.err !== null)} | ${n((x) => x.first.capture !== undefined)} | ${n((x) => x.first.recruit !== undefined)} | ${n((x) => x.first.ascend !== undefined)} | ${med(xs.flatMap((x) => x.first.capture ?? []))} | ${med(xs.flatMap((x) => x.first.ascend ?? []))} | ${med(xs.map((x) => x.nodes))} | ${med(xs.map((x) => x.heroes))} |`)
}
const traj: string[] = []
traj.push('| 손님 | 항목 | 1계절 | 3계절 | 6계절 | 10계절 | 20계절 | 30계절 |')
traj.push('|---|---|---|---|---|---|---|---|')
for (const p of PERSONAS) {
  const xs = all.filter((x) => x.persona === p)
  for (const [k, name] of [['nodes', '고을'], ['grain', '곡식'], ['heroes', '장수']] as const) {
    const cells = [1, 3, 6, 10, 20, 30].map((sn) => { const v = xs.flatMap((x) => x.snaps[sn - 1]?.[k] ?? []); return v.length === 0 ? '(끝)' : `${med(v)} (${v.length}판)` })
    traj.push(`| ${LABEL[p]} | ${name} | ${cells.join(' | ')} |`)
  }
}
const errs = all.filter((x) => x.err !== null).map((x) => `- ${LABEL[x.persona]} 씨앗 ${x.seed}: ${x.err}`)
const text = [`## 페르소나 손님 시험 — ${BOARD} · 씨앗 1~${SEEDS} · 상한 ${MINUTES}분(가정 가운데 비용) · ${TURNS}턴`, '', '### 요약', sum.join('\n'), '', '### 판마다', rows.join('\n'), '', '### 계절별 중간 궤적 (괄호 = 그때까지 살아 있는 판)', traj.join('\n'), ...(errs.length ? ['', '### 오류', ...errs] : [])].join('\n')
console.log('\n' + text)
if (OUT !== '') writeFileSync(OUT, text + '\n')
