/**
 * 전장 sim 벤치 (docs/realm/battle-study/40-cards.md F1b · F2a)
 *   node --experimental-strip-types tools/field-bench.ts [--n 1000] [--men 600,1300,2100,5000,9000]
 *   node --experimental-strip-types tools/field-bench.ts --map meet,hold,cross,stake,high,ambush [--n 500] [--men 1300]
 * 합격선은 같은 씨앗 두 번의 해시 일치 하나. 속도(중앙값 ≤ 30ms)·끝 까닭·맵별 승률(편 0 = 치는 쪽)·첫 접촉 시각은 함께 재서 보고만 한다.
 * performance.now 는 도구에서만 쓴다.
 */
import { runField, createField, stepField } from '../src/field/sim.ts'
import { plainSetup } from '../src/field/scenario.ts'
import { hashField } from '../src/field/state.ts'
import { ambushMap, crossMap, highMap, holdMap, meetMap, stakeMap } from '../src/field/map.ts'
import { dist2 } from '../src/field/num.ts'
import { P } from '../src/tune/params.ts'
import type { FieldMap, FieldState } from '../src/field/types.ts'

const arg = (k: string, d: string): string => { const i = process.argv.indexOf(`--${k}`); return i >= 0 ? process.argv[i + 1]! : d }
const n = Number(arg('n', '1000'))
const MAPS: Record<string, () => FieldMap> = { meet: meetMap, hold: holdMap, cross: crossMap, stake: stakeMap, high: highMap, ambush: () => ambushMap(true), ambushFail: () => ambushMap(false) }
let bad = 0

/** 첫 접촉: 서로 다른 편의 두 대가 처음 사거리 안에 든 틱 */
function firstContact(s: FieldState): number {
  const mr2 = (P.field.meleeRangeCells * P.field.unit) ** 2, br2 = (P.field.bowRangeCells * P.field.unit) ** 2
  for (const q of s.squads) for (const e of s.squads) {
    if (q.side !== 0 || e.side !== 1 || q.men <= 0 || e.men <= 0) continue
    const d = dist2(q.u, q.v, e.u, e.v)
    if (d <= (q.grp === 'bows' || e.grp === 'bows' ? br2 : mr2)) return 1
  }
  return 0
}

const mapNames = arg('map', '')
if (mapNames) {
  const men = Number(arg('men', '1300'))
  const ratios = arg('ratio', '1').split(',').map(Number)
  for (const ratio of ratios) {
    const rows: string[] = []
    const rate: Record<string, [number, number, number]> = {}
    for (const name of mapNames.split(',')) {
      const mk = MAPS[name]
      if (!mk) { console.log(`모르는 맵 ${name}`); continue }
      let w0 = 0, w1 = 0, mismatch = 0
      const contacts: number[] = []
      let steps = 0
      const why: Record<string, number> = {}
      for (let seed = 1; seed <= n; seed++) {
        const base = plainSetup(seed, men, true, mk())
        const setup = { ...base, sides: [{ ...base.sides[0], men: { front: Math.round(base.sides[0].men.front * ratio), bows: Math.round(base.sides[0].men.bows * ratio), horse: Math.round(base.sides[0].men.horse * ratio) } }, base.sides[1]] as typeof base.sides }
        const s = createField(setup)
        let contact = -1
        while (s.end === null) { stepField(s); if (contact < 0 && firstContact(s)) contact = s.tick }
        if (hashField(s) !== hashField(runField(setup))) mismatch++
        if (s.winner === 0) w0++
        if (s.winner === 1) w1++
        if (contact >= 0) contacts.push(contact)
        steps += s.tick
        why[`${s.end}`] = (why[`${s.end}`] ?? 0) + 1
      }
      bad += mismatch
      contacts.sort((a, b) => a - b)
      rate[name] = [w0 / n, w1 / n, (n - w0 - w1) / n]
      const ref = rate['hold'] ?? rate['meet'] ?? [0.5, 0.5, 0]
      rows.push(`${name.padEnd(10)} 치는 쪽 ${(w0 / n * 100).toFixed(1)}% · 지키는 쪽 ${(w1 / n * 100).toFixed(1)}% · 비김 ${((n - w0 - w1) / n * 100).toFixed(1)}%  | 지키는 쪽 평지 대조군 대비 ${((w1 / n - ref[1]) * 100).toFixed(1)}%p · 치는 쪽 대로 대비 ${((w0 / n - (rate['meet']?.[0] ?? 0.5)) * 100).toFixed(1)}%p | 첫 접촉 ${contacts.length ? (contacts[contacts.length >> 1]! / P.field.hz).toFixed(1) : '-'}초 · 평균 ${(steps / n / P.field.hz).toFixed(0)}초 ${JSON.stringify(why)} · 해시 불일치 ${mismatch}`)
    }
    console.log([`men=${men} 치는 쪽 병력비 ${ratio} n=${n}`, ...rows].join('\n'))
  }
} else {
  const sizes = arg('men', '600,1300,2100,5000,9000').split(',').map(Number)
  for (const men of sizes) {
    const ms: number[] = [], steps: number[] = [], why: Record<string, number> = {}, win: Record<string, number> = {}
    let mismatch = 0
    for (let seed = 1; seed <= n; seed++) {
      const setup = plainSetup(seed, men)
      const t0 = performance.now()
      const a = runField(setup)
      ms.push(performance.now() - t0)
      const b = runField(setup)
      if (hashField(a) !== hashField(b)) mismatch++
      steps.push(a.tick)
      why[`${a.end}`] = (why[`${a.end}`] ?? 0) + 1
      win[`${a.winner}`] = (win[`${a.winner}`] ?? 0) + 1
    }
    bad += mismatch
    ms.sort((x, y) => x - y)
    const q = (p: number): number => ms[Math.min(ms.length - 1, Math.floor(ms.length * p))]!
    const avg = steps.reduce((x, y) => x + y, 0) / steps.length
    const sorted = [...steps].sort((x, y) => x - y)
    console.log(`men=${men} n=${n} 중앙값 ${q(0.5).toFixed(2)}ms p95 ${q(0.95).toFixed(2)}ms 최대 ${q(1).toFixed(1)}ms | 평균 걸음 ${avg.toFixed(0)} (중앙 ${sorted[sorted.length >> 1]}) | 끝 ${JSON.stringify(why)} 이긴 편 ${JSON.stringify(win)} | 해시 불일치 ${mismatch}`)
  }
}
console.log(bad === 0 ? '합격: 같은 씨앗 같은 해시' : `불합격: 해시 불일치 ${bad}`)
process.exit(bad === 0 ? 0 : 1)
