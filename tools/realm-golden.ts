/**
 * 본편 전투 골든 큰 판 (battle-study P1) — 시험(tests/realm/battle-golden.test.ts)과 같은 함수로 정책당 N판.
 *   node --experimental-strip-types tools/realm-golden.ts [--n 10000]
 * n 이 시험의 GOLDEN_N(300)이면 시험의 GOLDEN 과 같은 줄이 나와야 한다.
 */
import { goldenA, POLICIES } from '../tests/realm/battle-golden-kit.ts'

const i = process.argv.indexOf('--n')
const n = i > 0 ? Number(process.argv[i + 1]) : 10000
for (const p of POLICIES) console.log(`A ${p} ${n}`, goldenA(p, n))
