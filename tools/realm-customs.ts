/**
 * 짝 씨앗 — 같은 씨앗으로 판을 두 번 돌려(A 바탕 · B 바꾼 판) **이김 Δ 와 행동 Δ** 를 견준다
 * (docs/realm/CUSTOMS.md §7-4 「짝 씨앗」 · §8-1 「행동 시험」: 이김 Δ 0 + 행동 그대로 = 장식 → 반려 · 이김 Δ > +10%p 도 반려)
 *
 *   npx tsx tools/realm-customs.ts [--region yeongnam] [--as mokji | --as saro,guya | --all] [--bot planner] [--tier 1] [--games 30] [--seasons 40]
 *        [--set customsOn=0,aiKyeolMix=0]   B 판에만 거는 params (P.realm) — A 는 그대로
 *        [--base key=val,...]               A·B 둘 다에 거는 params
 *        [--give guseul,maljangrye]         B 판에서 맡은 나라에 풍습을 더 준다 (Faction.customs) — 규칙이 안 걸린(live false) 풍습은 Δ 0
 *        [--drop guseul]                    B 판에서 맡은 나라의 풍습을 뺀다
 *
 * --set · --give · --drop 가 하나도 없으면 A 만 돈다.
 * 나라 하나 — 지표마다 A · B · Δ 한 줄씩 (이김 · 짐 · 출정 · 싸움 · 뽑은 병종 비 · 군대 병종 비 · 사신 · 맺음 · 선물 · 제사 · 공작 · 개척).
 * 나라 여럿(--all 은 판의 모든 나라) — 나라마다 한 줄: 결 · 이김 · 짐 · 출정 · 뽑은 병종 비 · 군대 병종 비 (B 가 있으면 B 와 Δ 도).
 * 「뽑은 비」는 처음부터 있던 군대(창·활 많음)를 메우느라 목표보다 기운다 — 결의 비는 「군대 비」(계절마다 서 있는 군대를 더한 것)로 본다.
 * 봇은 플레이어 자리에 앉은 같은 AI(ai.decide) — 뽑는 병종 비는 결·나라마다 (data/armymix.ts · aiKyeolMix).
 */
import { aiOrders, decide, type Brain } from '../src/realm/ai.ts'
import { CUSTOMS, customsOf, kyeolOf, type CustomId } from '../src/realm/data/customs.ts'
import { regionNations, startRegion } from '../src/realm/data/regions/index.ts'
import type { UnitKind } from '../src/realm/battle.ts'
import { advance } from '../src/realm/season.ts'
import { applyTier } from '../src/realm/tier.ts'
import type { Realm, RegionId } from '../src/realm/types.ts'
import { P } from '../src/tune/params.ts'

const args = process.argv.slice(2)
const opt = (name: string, def: string): string => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 && args[i + 1] !== undefined ? args[i + 1]! : def
}
const list = (name: string): string[] => opt(name, '').split(',').filter((x) => x !== '')
const GAMES = Number(opt('games', '30'))
const SEASONS = Number(opt('seasons', '40'))
const REGION = opt('region', 'yeongnam') as RegionId
const BOT = opt('bot', 'planner') as Brain
const TIER = Number(opt('tier', '1'))
const ALL = args.includes('--all') || opt('as', '') === 'all'
const AS: string[] = ALL ? [...regionNations(REGION)] : list('as').length > 0 ? list('as') : [regionNations(REGION)[0]!]

const parseKV = (xs: string[]): Array<[string, number]> => xs.map((kv) => {
  const [k, v] = kv.split('=')
  if (!(k! in P.realm)) throw new Error(`params 에 없는 손잡이: realm.${k}`)
  return [k!, Number(v)]
})
const BASE = parseKV(list('base'))
const SET = parseKV(list('set'))
const known = new Set(CUSTOMS.map((c) => c.id))
const GIVE = list('give') as CustomId[]
const DROP = list('drop') as CustomId[]
for (const id of [...GIVE, ...DROP]) if (!known.has(id)) throw new Error(`없는 풍습: ${id}`)
const HAS_B = SET.length + GIVE.length + DROP.length > 0

const realmP = P.realm as unknown as Record<string, number>
const ORIG: Record<string, number> = Object.fromEntries([...BASE, ...SET].map(([k]) => [k, realmP[k]!]))
function useParams(b: boolean): void {
  for (const [k, v] of Object.entries(ORIG)) realmP[k] = v
  for (const [k, v] of BASE) realmP[k] = v
  if (b) for (const [k, v] of SET) realmP[k] = v
}

const KINDS: readonly UnitKind[] = ['spear', 'bow', 'shield', 'horse', 'boat', 'pike', 'crossbow']
const KIND_KO: Record<UnitKind, string> = { spear: '창', bow: '활', shield: '방패', horse: '기병', boat: '수군', pike: '긴창', crossbow: '쇠뇌' }

interface Run {
  win: number
  lose: number
  /** 이 나라가 낸 출정 명령 · 이 나라가 낀 싸움 · 그 가운데 이긴 것 */
  marches: number
  battles: number
  wins: number
  /** 이 나라가 뽑은 군사 — 병종마다 */
  drafted: Partial<Record<UnitKind, number>>
  /** 이 나라 군대의 병종 — 계절마다 더한 것 (뽑은 비는 처음 군대를 메우느라 기운다 · 서 있는 비가 목표에 가깝다) */
  standing: Partial<Record<UnitKind, number>>
  /** 보낸 사신 · 받아들여진 것 · 맺은 화친·동맹 · 받아들여진 선물 */
  envoys: number
  envoysOk: number
  pacts: number
  gifts: number
  rites: number
  plots: number
  settles: number
  nodes: number
}

function play(as: string, seed: number, b: boolean): Run {
  useParams(b)
  let r: Realm = startRegion(REGION, seed, as)
  applyTier(r, TIER)
  if (b && (GIVE.length > 0 || DROP.length > 0)) {
    const f = r.factions[as]
    if (f !== undefined) f.customs = [...new Set([...customsOf(r, as), ...GIVE])].filter((c) => !DROP.includes(c))
  }
  const run: Run = { win: 0, lose: 0, marches: 0, battles: 0, wins: 0, drafted: {}, standing: {}, envoys: 0, envoysOk: 0, pacts: 0, gifts: 0, rites: 0, plots: 0, settles: 0, nodes: 0 }
  for (let s = 0; s < SEASONS; s++) {
    const mine = decide(r, as, BOT)
    run.marches += mine.filter((o) => o.kind === 'march').length
    const { next, report } = advance(r, [...mine, ...aiOrders(r)])
    for (const l of report.lines) {
      if (l.kind === 'draft' && l.faction === as) run.drafted[l.unit] = (run.drafted[l.unit] ?? 0) + l.n
      else if (l.kind === 'envoy' && l.from === as) {
        run.envoys++
        if (l.accepted) run.envoysOk++
        if (l.accepted && l.ask === 'gift') run.gifts++
      } else if (l.kind === 'relation' && (l.a === as || l.b === as) && (l.state === 'truce' || l.state === 'ally')) run.pacts++
      else if (l.kind === 'rite' && l.faction === as) run.rites++
      else if (l.kind === 'plot' && l.faction === as) run.plots++
      else if (l.kind === 'settle' && l.faction === as) run.settles++
      else if (l.kind === 'battle') {
        const weAttack = r.armies[l.attacker]?.faction === as
        if (!weAttack && l.defender !== as) continue
        run.battles++
        const atkWon = l.outcome === 'rout' || l.outcome === 'win'
        if ((weAttack && atkWon) || (!weAttack && (l.outcome === 'lose' || l.outcome === 'routed'))) run.wins++
      }
    }
    r = next
    for (const a of Object.values(r.armies)) {
      if (a.faction !== as) continue
      for (const [u, v] of Object.entries(a.mix) as Array<[UnitKind, number]>) run.standing[u] = (run.standing[u] ?? 0) + v
    }
    if (r.outcome !== null) break
  }
  run.win = r.outcome?.kind === 'win' ? 1 : 0
  run.lose = r.outcome?.kind === 'lose' ? 1 : 0
  run.nodes = Object.values(r.nodes).filter((n) => n.owner === as).length
  return run
}

interface Sum { n: number; get: (k: keyof Omit<Run, 'drafted' | 'standing'>) => number; men: number; share: (u: UnitKind) => number; stand: (u: UnitKind) => number; winRate: number }
function sum(rs: Run[]): Sum {
  const n = Math.max(1, rs.length)
  const tot: Partial<Record<UnitKind, number>> = {}
  for (const x of rs) for (const [u, v] of Object.entries(x.drafted) as Array<[UnitKind, number]>) tot[u] = (tot[u] ?? 0) + v
  const men = Object.values(tot).reduce((a, v) => a + v, 0)
  const st: Partial<Record<UnitKind, number>> = {}
  for (const x of rs) for (const [u, v] of Object.entries(x.standing) as Array<[UnitKind, number]>) st[u] = (st[u] ?? 0) + v
  const stMen = Object.values(st).reduce((a, v) => a + v, 0)
  const battles = rs.reduce((a, x) => a + x.battles, 0)
  return {
    n: rs.length,
    get: (k) => rs.reduce((a, x) => a + x[k], 0) / n,
    men: men / n,
    share: (u) => (men > 0 ? (tot[u] ?? 0) / men : 0),
    stand: (u) => (stMen > 0 ? (st[u] ?? 0) / stMen : 0),
    winRate: battles > 0 ? rs.reduce((a, x) => a + x.wins, 0) / battles : 0,
  }
}

const pct = (x: number): string => `${(x * 100).toFixed(1)}%`
const sgn = (x: number, d = 2): string => `${x >= 0 ? '+' : ''}${x.toFixed(d)}`
const pp = (x: number): string => `${x >= 0 ? '+' : ''}${(x * 100).toFixed(1)}%p`
const mixStr = (f: (u: UnitKind) => number): string => KINDS.filter((u) => Math.round(f(u) * 100) > 0).map((u) => `${KIND_KO[u]}${Math.round(f(u) * 100)}`).join(' ') || '-'

const bLabel = [SET.map(([k, v]) => `${k}=${v}`).join(','), GIVE.length > 0 ? `+${GIVE.join('+')}` : '', DROP.length > 0 ? `-${DROP.join('-')}` : ''].filter((x) => x !== '').join(' ')
console.log(`짝 씨앗 — ${REGION} · ${BOT} · 난세 ${TIER} · ${GAMES}판 × ${SEASONS}계절 · 씨앗 1000~${1000 + GAMES - 1}`)
console.log(`A: 바탕${BASE.length > 0 ? ` (${BASE.map(([k, v]) => `${k}=${v}`).join(',')})` : ''}${HAS_B ? `   B: ${bLabel}` : ''}`)
for (const id of GIVE) if (!CUSTOMS.find((c) => c.id === id)!.live) console.log(`  ※ ${id} 는 아직 규칙이 안 걸렸다 (live false) — Δ 는 0 이어야 한다`)

const runsOf = (as: string, b: boolean): Run[] => Array.from({ length: GAMES }, (_, g) => play(as, 1000 + g, b))

if (AS.length === 1) {
  const as = AS[0]!
  const a = sum(runsOf(as, false))
  const b = HAS_B ? sum(runsOf(as, true)) : null
  console.log(`나라 ${as} · 결 ${kyeolOf(as)} · 풍습 ${customsOf(startRegion(REGION, 1000, as), as).join(',') || '-'}\n`)
  console.log(`${'지표'.padEnd(12)} ${'A'.padStart(8)}${b !== null ? `${'B'.padStart(9)}${'Δ'.padStart(10)}` : ''}`)
  const row = (name: string, x: (s: Sum) => number, f: (v: number) => string, df: (v: number) => string): void => {
    console.log(`${name.padEnd(12)} ${f(x(a)).padStart(8)}${b !== null ? `${f(x(b)).padStart(9)}${df(x(b) - x(a)).padStart(10)}` : ''}`)
  }
  const n2 = (v: number): string => v.toFixed(2)
  row('이김', (s) => s.get('win'), pct, pp)
  row('짐', (s) => s.get('lose'), pct, pp)
  row('끝 고을', (s) => s.get('nodes'), n2, (v) => sgn(v))
  row('출정/판', (s) => s.get('marches'), n2, (v) => sgn(v))
  row('싸움/판', (s) => s.get('battles'), n2, (v) => sgn(v))
  row('싸움 이김', (s) => s.winRate, pct, pp)
  row('뽑은 군사/판', (s) => s.men, (v) => v.toFixed(0), (v) => sgn(v, 0))
  for (const u of KINDS) if (a.share(u) > 0 || (b?.share(u) ?? 0) > 0) row(`  뽑은 ${KIND_KO[u]}`, (s) => s.share(u), pct, pp)
  for (const u of KINDS) if (a.stand(u) > 0 || (b?.stand(u) ?? 0) > 0) row(`  군대 ${KIND_KO[u]}`, (s) => s.stand(u), pct, pp)
  row('사신/판', (s) => s.get('envoys'), n2, (v) => sgn(v))
  row('받아들여짐', (s) => s.get('envoysOk'), n2, (v) => sgn(v))
  row('선물/판', (s) => s.get('gifts'), n2, (v) => sgn(v))
  row('맺음/판', (s) => s.get('pacts'), n2, (v) => sgn(v))
  row('제사/판', (s) => s.get('rites'), n2, (v) => sgn(v))
  row('공작/판', (s) => s.get('plots'), n2, (v) => sgn(v))
  row('개척/판', (s) => s.get('settles'), n2, (v) => sgn(v))
} else {
  console.log(`\n${'나라'.padEnd(10)} ${'결'.padEnd(9)} ${'이김'.padStart(6)} ${'짐'.padStart(6)} ${'출정'.padStart(5)} ${'군사'.padStart(5)}  ${'뽑은 병종 비'.padEnd(17)} ${'군대 병종 비'.padEnd(17)}${HAS_B ? '│ B 이김     Δ이김   B 출정  B 뽑은 비               B 군대 비' : ''}`)
  for (const as of AS) {
    const a = sum(runsOf(as, false))
    let line = `${as.padEnd(10)} ${kyeolOf(as).padEnd(9)} ${pct(a.get('win')).padStart(6)} ${pct(a.get('lose')).padStart(6)} ${a.get('marches').toFixed(1).padStart(5)} ${a.men.toFixed(0).padStart(5)}  ${mixStr(a.share).padEnd(22)} ${mixStr(a.stand).padEnd(22)}`
    if (HAS_B) {
      const b = sum(runsOf(as, true))
      line += `│ ${pct(b.get('win')).padStart(6)} ${pp(b.get('win') - a.get('win')).padStart(8)} ${b.get('marches').toFixed(1).padStart(7)}  ${mixStr(b.share).padEnd(22)} ${mixStr(b.stand)}`
    }
    console.log(line)
  }
}
