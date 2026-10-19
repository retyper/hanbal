/**
 * 판을 많이 돌리며 화면 글까지 그려 본다 — 막히는 곳 찾기 (형: "진행하다 에러났고" 2026-10-19)
 *
 * 엔진(advance)만이 아니라 화면이 쓰는 순수한 글 만들기(mapHtml · reportText · endingHtml · titleHtml)도
 * 계절마다 불러 본다. 처음 던진 에러에서 멈추고 판 · 시드 · 나라 · 계절을 찍는다.
 *
 *   node --experimental-strip-types tools/realm-fuzz.ts [--seeds 6] [--seasons 48]
 */
import { decide, aiOrders, type Brain } from '../src/realm/ai.ts'
import { regionNations, startRegion } from '../src/realm/data/regions/index.ts'
import { NATIONS } from '../src/realm/data/nations.ts'
import { YEONGNAM_NATIONS } from '../src/realm/data/nations-yeongnam.ts'
import { SOUTH_NATIONS } from '../src/realm/data/nations-south.ts'
import { WORLD_NATIONS } from '../src/realm/data/nations-world.ts'
import { reportText } from '../src/realm/data/prose.ts'
import { advance } from '../src/realm/season.ts'
import type { Realm, RegionId, ReportLine } from '../src/realm/types.ts'
import { mapHtml } from '../src/ui/realm/mapview.ts'
import { endingHtml, prologueHtml, titleHtml, type FrontKit } from '../src/ui/realm/front.ts'

const arg = (k: string, d: number): number => {
  const i = process.argv.indexOf(`--${k}`)
  return i > 0 ? Number(process.argv[i + 1]) : d
}
const SEEDS = arg('seeds', 6)
const SEASONS = arg('seasons', 48)
const KIT: FrontKit = {
  art: '/', esc: (s) => s, icon: (n) => n, emblem: (f) => f, face: (f) => f,
  nations: (r: RegionId) => (r === 'yeongnam' ? YEONGNAM_NATIONS : r === 'south' ? SOUTH_NATIONS : r === 'world' ? WORLD_NATIONS : NATIONS),
}
const BRAINS: Brain[] = ['planner', 'reckless', 'random']

let runs = 0
for (const region of ['byeonhan-mini', 'yeongnam', 'south', 'world'] as RegionId[]) {
  const nations = regionNations(region)
  for (let seed = 1; seed <= SEEDS; seed++) {
    const as = nations[(seed * 7) % nations.length]!
    const brain = BRAINS[seed % BRAINS.length]!
    let r: Realm = startRegion(region, seed, as)
    let s = 0
    try {
      prologueHtml(KIT, r, 0); prologueHtml(KIT, r, 1); prologueHtml(KIT, r, 2)
      const history: Array<{ s: number; lines: readonly ReportLine[] }> = []
      for (; s < SEASONS && !r.outcome; s++) {
        const before = r
        const res = advance(r, [...decide(r, as, brain), ...aiOrders(r)])
        r = res.next
        history.push({ s: res.report.season, lines: res.report.lines })
        for (const l of res.report.lines) reportText(before, r, l, as)
        mapHtml(r, as, '/', [], '')
        titleHtml(KIT, r, null)
      }
      if (r.outcome) endingHtml(KIT, r, history)
      runs++
    } catch (e) {
      console.log(`✗ ${region} seed ${seed} as ${as} (${brain}) season ${s}:`, e instanceof Error ? e.stack?.split('\n').slice(0, 6).join('\n') : e)
      process.exit(1)
    }
  }
}
console.log(`ok — ${runs} 판, 막힌 곳 없음`)
