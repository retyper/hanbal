/**
 * 전장 sim 벤치 (docs/realm/battle-study/40-cards.md F1b) — 씨앗 n 판의 한 판 시간 · 끝난 까닭 · 걸음 수 + 같은 씨앗 두 번의 해시 일치.
 *   node --experimental-strip-types tools/field-bench.ts [--n 1000] [--men 600,1300,2100,5000,9000]
 * 합격선은 해시 일치 하나. 속도(중앙값 ≤ 30ms)는 함께 재서 보고만 한다 (performance.now 는 도구에서만).
 */
import { runField } from '../src/field/sim.ts'
import { plainSetup } from '../src/field/scenario.ts'
import { hashField } from '../src/field/state.ts'

const arg = (k: string, d: string): string => { const i = process.argv.indexOf(`--${k}`); return i >= 0 ? process.argv[i + 1]! : d }
const n = Number(arg('n', '1000'))
const sizes = arg('men', '600,1300,2100,5000,9000').split(',').map(Number)
let bad = 0
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
    const key = `${a.end}`
    why[key] = (why[key] ?? 0) + 1
    win[`${a.winner}`] = (win[`${a.winner}`] ?? 0) + 1
  }
  bad += mismatch
  ms.sort((x, y) => x - y)
  const q = (p: number): number => ms[Math.min(ms.length - 1, Math.floor(ms.length * p))]!
  const avg = steps.reduce((x, y) => x + y, 0) / steps.length
  const sorted = [...steps].sort((x, y) => x - y)
  console.log(`men=${men} n=${n} 중앙값 ${q(0.5).toFixed(2)}ms p95 ${q(0.95).toFixed(2)}ms 최대 ${q(1).toFixed(1)}ms | 평균 걸음 ${avg.toFixed(0)} (중앙 ${sorted[sorted.length >> 1]}) | 끝 ${JSON.stringify(why)} 이긴 편 ${JSON.stringify(win)} | 해시 불일치 ${mismatch}`)
}
console.log(bad === 0 ? '합격: 같은 씨앗 같은 해시' : `불합격: 해시 불일치 ${bad}`)
process.exit(bad === 0 ? 0 : 1)
