/**
 * 머릿수 재기 — 머릿수가 3배 넘는 싸움에서 많은 쪽이 더 잃거나 못 이긴 몫 (형 10-30: "수백 명대 40명이 합을 겨뤄 내가 더 잃는다").
 *   node --experimental-strip-types tools/realm-size.ts            · 지금 params
 *   SET=0,0.8 node --experimental-strip-types tools/realm-size.ts  · tacSizeExp,tacJitter 를 바꿔 본다
 */
import { P } from '../src/tune/params.ts'
import { aiOrders, decide } from '../src/realm/ai.ts'
import { regionNations, startRegion } from '../src/realm/data/regions/index.ts'
import { advance } from '../src/realm/season.ts'
import type { Realm } from '../src/realm/types.ts'
const [exp, jit] = (process.env.SET ?? `${P.realm.tacSizeExp},${P.realm.tacJitter}`).split(',').map(Number)
;(P.realm as any).tacSizeExp = exp; (P.realm as any).tacJitter = jit
let big = 0, bigLost = 0, bigNotWin = 0
for (const as of regionNations('byeonhan-mini')) for (let seed = 1; seed <= 20; seed++) {
  let r: Realm = startRegion('byeonhan-mini', seed, as)
  for (let s = 0; s < 40 && !r.outcome; s++) {
    const res = advance(r, [...decide(r, as, 'planner'), ...aiOrders(r)])
    for (const l of res.report.lines) {
      if (l.kind !== 'battle' || l.start === undefined || l.rounds === undefined || l.rounds.length === 0) continue
      const [ma, md] = l.start.men; const last = l.rounds[l.rounds.length - 1]!
      const la = ma * (1 - last.na), ld = md * (1 - last.nd)
      for (const [mb, ms, lb, ls, bigWon] of [[ma, md, la, ld, l.outcome === 'win' || l.outcome === 'rout'], [md, ma, ld, la, l.outcome === 'lose' || l.outcome === 'routed']] as const) {
        if (mb < 3 * ms || ms <= 0) continue
        big++; if (lb > ls) bigLost++; if (!bigWon) bigNotWin++
      }
    }
    r = res.next
  }
}
console.log(`size ${exp} jit ${jit}: 머릿수 3배+ 싸움 ${big} · 많은 쪽이 더 잃음 ${bigLost} (${Math.round(100 * bigLost / Math.max(1, big))}%) · 많은 쪽이 못 이김 ${bigNotWin} (${Math.round(100 * bigNotWin / Math.max(1, big))}%)`)
