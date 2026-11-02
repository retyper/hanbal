/**
 * 옛 판(한 턴 한 계절)이 그대로 도는가 — 판마다 씨앗 셋을 N턴 돌린 판·보고의 해시 (시간 개편 docs/realm/TIME-TABLE-1031.md).
 *
 *   node --experimental-strip-types tools/realm-oldclock-hash.ts [턴 16]
 *
 * 달 시계를 끄고(monthClock 0) 돈다. 달 시계 앞 커밋(예: master 의 885e195)에서 같은 것을 돌린 줄과 한 줄도 다르지 않아야
 * 옛 저장이 옛 길로 돈다. 11-01 에 master 와 견주어 21줄이 모두 같았다. 판(규칙)을 바꾸면 해시는 당연히 바뀐다 — 견줄 때는 같은 규칙끼리.
 */
import { aiOrders, decide } from '../src/realm/ai.ts'
import { startRegion } from '../src/realm/data/regions/index.ts'
import { advance } from '../src/realm/season.ts'
import type { Realm, RegionId } from '../src/realm/types.ts'
import { P } from '../src/tune/params.ts'

;(P.realm as unknown as Record<string, number>)['monthClock'] = 0
const fnv = (s: string): string => {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0 }
  return h.toString(16)
}
const runs: Array<[RegionId, string]> = [['yeongnam', 'guya'], ['byeonhan-mini', 'us'], ['south', 'guya'], ['mahan', 'baekje'], ['tutorial', 'baekje'], ['jumong', 'goguryeo'], ['seorabeol', 'saro'], ['gujibong', 'garak']]
const turns = Number(process.argv[2] ?? '16')
for (const [reg, nat] of runs) {
  for (const seed of [1, 2, 3]) {
    let r: Realm = startRegion(reg, seed, nat)
    let acc = ''
    for (let s = 0; s < turns; s++) {
      const o = [...decide(r, r.player, 'planner'), ...aiOrders(r)]
      const { next, report } = advance(r, o)
      acc = fnv(acc + JSON.stringify(report))
      r = next
      if (r.outcome !== null) break
    }
    console.log(reg, seed, r.season, fnv(JSON.stringify(r)), acc)
  }
}
