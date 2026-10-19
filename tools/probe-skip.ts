/**
 * 암살 건너뛰기 프로브 — 안 보고 맡길 때와 지붕을 본 뒤 맡길 때 먹히는 몫 (P.realm.plotSkipSeenMul)
 *
 *   node --experimental-strip-types tools/probe-skip.ts [판 수=1000]
 *
 * 변한 판 · 우리(us)가 가락 장수(guya-1)를 고용 자객으로 노린다. 판마다 시드만 바꾼다.
 */
import { byeonhanMini } from '../src/realm/data/regions/byeonhan-mini.ts'
import { advance } from '../src/realm/season.ts'
import type { ReportLine } from '../src/realm/types.ts'

const N = Number(process.argv[2] ?? 1000)
let blind = 0
let seen = 0
for (let seed = 1; seed <= N; seed++) {
  for (const s of [false, true]) {
    const r = byeonhanMini(seed)
    r.met = { us: ['guya-1'] }
    const out = advance(r, [{ kind: 'plot', faction: 'us', op: 'assassin', target: 'guya', hero: 'guya-1', hand: { result: 'skip', alarm: false, seen: s } }])
    const l = out.report.lines.find((x): x is Extract<ReportLine, { kind: 'plot' }> => x.kind === 'plot')
    if (l?.ok === true) {
      if (s) seen++
      else blind++
    }
  }
}
console.log(`${N}판 — 안 보고 맡김 ${(blind / N * 100).toFixed(1)}% · 지붕 본 뒤 맡김 ${(seen / N * 100).toFixed(1)}%`)
