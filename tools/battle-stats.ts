/**
 * 본편 전투의 「지금」 실측 (battle-study P3) — 봇이 플레이어 자리에서 판을 돌릴 때 우리가 치는 싸움을 센다.
 *
 *   node --experimental-strip-types tools/battle-stats.ts [--games 8] [--seasons 120] [--regions yeongnam,mahan,south,byeonhan-mini] [--tier 1] [--bot cautious]
 *   node --experimental-strip-types tools/battle-stats.ts --time [--games 4]      # advance 턴당 ms (3회 중앙값 · 다른 일이 없을 때)
 *   node --experimental-strip-types tools/battle-stats.ts --save [--seasons 80]   # 판 JSON · 기록 크기
 *
 * 재는 것 (「봇 판」이다 · 사람 판이 아니다):
 *   (a) 판당 · 계절당 우리 싸움 수 (우리 = 공격이나 지킴 한 쪽이 플레이어 나라)
 *   (b) 싸움당 합 수 · 끝난 까닭(endWhy) 분포
 *   (c) 한 편 사람 수 p50·p90·최대 (우리 싸움의 양 쪽 · 큰 쪽)
 *   (d) 합당 연출 초 — battlefield.roundPlan(실제 함수)의 result 를 지금 params 값으로 셈한 것 (셈이다 · 화면 시계를 찍은 것이 아니다)
 *   (e) --time: advance 턴당 ms · --save: 80계절 판 JSON/기록 크기
 * 26 의 tools/out/battle-study/men-dist.ts · adv-time.ts 를 추적 파일로 옮겨 넓혔다.
 */
import { gzipSync } from 'node:zlib'
import { aiOrders, decide, type Brain } from '../src/realm/ai.ts'
import { startRegion } from '../src/realm/data/regions/index.ts'
import { applyTier } from '../src/realm/tier.ts'
import { advance } from '../src/realm/season.ts'
import { perSeason } from '../src/realm/calendar.ts'
import { roundPlan } from '../src/ui/realm/battlefield.ts'
import { P } from '../src/tune/params.ts'
import type { Order, Realm, RegionId } from '../src/realm/types.ts'

const args = process.argv.slice(2)
const has = (n: string): boolean => args.includes(`--${n}`)
const opt = (n: string, d: string): string => { const i = args.indexOf(`--${n}`); return i >= 0 && args[i + 1] !== undefined ? args[i + 1]! : d }
const GAMES = Number(opt('games', '8'))
const SEASONS = Number(opt('seasons', '120'))
const REGIONS = opt('regions', 'yeongnam,mahan,south,byeonhan-mini').split(',') as RegionId[]
const TIER = Number(opt('tier', '1'))
const BOT = opt('bot', 'cautious') as Brain

const q = (a: number[], p: number): number => { const b = [...a].sort((x, y) => x - y); return b[Math.min(b.length - 1, Math.floor(p * b.length))] ?? 0 }
const mean = (a: number[]): number => (a.length === 0 ? 0 : a.reduce((x, y) => x + y, 0) / a.length)
const f1 = (n: number): string => n.toFixed(1)

function open(region: RegionId, seed: number): Realm {
  let r: Realm
  try { r = startRegion(region, seed, 'us') } catch { r = startRegion(region, seed, 'saro') }
  applyTier(r, TIER)
  return r
}

// ---- --time : advance 턴당 ms (3회 중앙값)
if (has('time')) {
  const once = (): Record<string, number> => {
    const out: Record<string, number> = {}
    for (const region of REGIONS) {
      let tD = 0, tA = 0, n = 0
      for (let seed = 1; seed <= GAMES; seed++) {
        let r = open(region, seed)
        for (let s = 0; s < 80; s++) {
          const a = performance.now()
          const orders = [...decide(r, r.player, BOT), ...aiOrders(r)]
          const b = performance.now()
          r = advance(r, orders).next
          const c = performance.now()
          tD += b - a; tA += c - b; n++
        }
      }
      out[`${region} advance`] = tA / n; out[`${region} decide+aiOrders`] = tD / n
    }
    return out
  }
  const runs = [once(), once(), once()]
  for (const k of Object.keys(runs[0]!)) {
    const v = runs.map((x) => x[k]!).sort((a, b) => a - b)
    console.log(`${k.padEnd(28)} 중앙값 ${v[1]!.toFixed(1)}ms (3회 ${v.map((x) => x.toFixed(1)).join(' / ')}) 턴당 · 판 ${GAMES} × 80턴`)
  }
  process.exit(0)
}

// ---- --save : 판 저장 크기
if (has('save')) {
  const SE = Number(opt('seasons', '80'))
  const kb = (n: number): string => `${(n / 1024).toFixed(0)}KB`
  for (const region of REGIONS) {
    let r = open(region, 7)
    const log: Order[][] = []
    const at: string[] = []
    for (let s = 0; s < SE * perSeason(r) && !r.outcome; s++) {
      const orders = [...decide(r, r.player, 'planner'), ...aiOrders(r)]
      log.push(orders)
      r = advance(r, orders).next
      const sn = Math.floor((s + 1) / perSeason(r))
      if ((s + 1) % perSeason(r) === 0 && (sn === 40 || sn === SE)) {
        const j = JSON.stringify(r); const lj = JSON.stringify(log)
        at.push(`${sn}계절: 판 ${kb(j.length)} (gzip ${kb(gzipSync(j).length)}) 기록 ${kb(lj.length)} (gzip ${kb(gzipSync(lj).length)})`)
      }
    }
    console.log(`${region} (planner · 씨앗 7): ${at.length > 0 ? at.join(' | ') : `판이 ${SE}계절 전에 끝남`}`)
  }
  process.exit(0)
}

// ---- 기본 : 싸움 분포
interface Fight { rounds: number; why: string; sec: number; men: [number, number]; ours: number; foe: number }
let games = 0
const fights: Fight[] = []
const perGame: number[] = []
const perSeasonFights: number[] = []
const perRegion: Record<string, { games: number; fights: number; seasons: number }> = {}
const roundSecs: number[] = []
for (const region of REGIONS) {
  const pr = (perRegion[region] = { games: 0, fights: 0, seasons: 0 })
  for (let seed = 1; seed <= GAMES; seed++) {
    let r = open(region, seed)
    const as = r.player
    const per = perSeason(r)
    let cnt = 0, turns = 0
    for (let s = 0; s < SEASONS * per && !r.outcome; s++) {
      const orders = [...decide(r, as, BOT), ...aiOrders(r)]
      const { next, report } = advance(r, orders)
      turns++
      for (const l of report.lines) {
        if (l.kind !== 'battle' || l.start === undefined) continue
        const atkF = l.atkFaction ?? r.armies[l.attacker]?.faction
        const weAtk = atkF === as
        const weDef = l.defender === as
        if (!weAtk && !weDef) continue
        cnt++
        const rds = l.rounds ?? []
        let sec = 0
        for (const rd of rds) { const t = roundPlan(rd, weAtk).result; sec += t; roundSecs.push(t) }
        fights.push({ rounds: rds.length, why: l.endWhy ?? '?', sec, men: [l.start.men[0], l.start.men[1]], ours: weAtk ? l.start.men[0] : l.start.men[1], foe: weAtk ? l.start.men[1] : l.start.men[0] })
      }
      r = next
    }
    games++; pr.games++; pr.fights += cnt; pr.seasons += turns / per
    perGame.push(cnt); perSeasonFights.push(cnt / Math.max(1, turns / per))
  }
}
const why: Record<string, number> = {}
for (const f of fights) why[f.why] = (why[f.why] ?? 0) + 1
const rounds = fights.map((f) => f.rounds)
const rdist: Record<number, number> = {}
for (const n of rounds) rdist[n] = (rdist[n] ?? 0) + 1
const sides = fights.flatMap((f) => [f.ours, f.foe])
const maxSide = fights.map((f) => Math.max(f.ours, f.foe))
const totalSec = fights.map((f) => f.sec)
const R = P.realm
console.log(`봇 ${BOT} · 단계 ${TIER} · 지역 ${REGIONS.join(',')} · 판 ${games} (지역당 ${GAMES}) · 한 판 최대 ${SEASONS}계절`)
console.log(`우리 싸움 ${fights.length}개 · 판당 평균 ${f1(mean(perGame))} (p50 ${q(perGame, .5)} · 최대 ${q(perGame, 1)}) · 계절당 평균 ${mean(perSeasonFights).toFixed(2)}`)
for (const [k, v] of Object.entries(perRegion)) console.log(`  ${k}: 판 ${v.games} · 싸움 ${v.fights} · 판당 ${f1(v.fights / Math.max(1, v.games))} · 계절당 ${(v.fights / Math.max(1, v.seasons)).toFixed(2)}`)
console.log(`싸움당 합 수 평균 ${mean(rounds).toFixed(2)} · p50 ${q(rounds, .5)} · p90 ${q(rounds, .9)} · 최대 ${q(rounds, 1)} · 분포 ${JSON.stringify(rdist)}`)
console.log(`끝난 까닭 ${JSON.stringify(why)} (${Object.entries(why).map(([k, v]) => `${k} ${(100 * v / Math.max(1, fights.length)).toFixed(0)}%`).join(' · ')})`)
console.log(`한 편 사람 수(양 쪽 낱낱) p50 ${q(sides, .5)} · p90 ${q(sides, .9)} · p99 ${q(sides, .99)} · 최대 ${q(sides, 1)}`)
console.log(`  큰 쪽만: p50 ${q(maxSide, .5)} · p90 ${q(maxSide, .9)} · 최대 ${q(maxSide, 1)} · 우리 쪽 p50 ${q(fights.map((f) => f.ours), .5)} · p90 ${q(fights.map((f) => f.ours), .9)} · 적 쪽 p50 ${q(fights.map((f) => f.foe), .5)} · p90 ${q(fights.map((f) => f.foe), .9)}`)
console.log(`합당 연출 초(roundPlan.result 셈) 평균 ${mean(roundSecs).toFixed(2)} · p50 ${q(roundSecs, .5).toFixed(2)} · p90 ${q(roundSecs, .9).toFixed(2)} · 최대 ${q(roundSecs, 1).toFixed(2)}`)
console.log(`싸움당 초(합 연출만 · 맡김 합 사이 ${R.warAutoGapS}초 제외) 평균 ${mean(totalSec).toFixed(1)} · p50 ${q(totalSec, .5).toFixed(1)} · p90 ${q(totalSec, .9).toFixed(1)} · 최대 ${q(totalSec, 1).toFixed(1)}`)
console.log(`  params: warBeat0 ${R.warBeat0} · warBeatCut ${R.warBeatCut} · warResultGap ${R.warResultGap} · warBeatMax ${R.warBeatMax} · warRoundPopHoldS ${R.warRoundPopHoldS}`)
