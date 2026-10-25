/**
 * 나라의 두 빛 점검 — 판마다 같이 서는 나라끼리 옷(바탕 빛 + 둘째 빛)이 겹치는가 (ui/realm/kitcolor.ts · 형 10-26)
 *
 *   node --experimental-strip-types tools/kit-colors.ts
 *
 * 겹치는 짝과 띠가 바탕에 묻히는 나라를 말하고, 그 나라에 맞을 둘째 빛 후보를 낸다 (같은 판의 바탕이 가까운 나라들의 둘째 빛과 멀고, 제 바탕과도 먼 것).
 * 고친 값은 data/art.ts 의 FACTION_ART 에 손으로 적는다 — tests/realm/kit-color.test.ts 가 같은 판정으로 지킨다.
 */
import { REGION_IDS, regionNations, startRegion } from '../src/realm/data/regions/index.ts'
import { FACTION_ART } from '../src/realm/data/art.ts'
import { deltaE, kitClash, kitSelfClash } from '../src/ui/realm/kitcolor.ts'
import { P } from '../src/tune/params.ts'

/** 둘째 빛 후보 — 서로 먼 빛들 */
const PALETTE: Readonly<Record<string, string>> = {
  흰빛: '#f6f1e4', 먹빛: '#1e1a16', 진홍: '#b0202a', 남빛: '#1f3f8f', 금빛: '#f2c230', 초록: '#2f8a3a',
  하늘: '#6cc8f0', 자주: '#6a2a7a', 주황: '#e86a1a', 분홍: '#f08ab0', 청록: '#138a8a', 밤빛: '#6a3a1a', 연두: '#b8e04a',
}

const boards = REGION_IDS.map((r) => [r, Object.keys(startRegion(r, 1, regionNations(r)[0]!).factions)] as const)
/** 같은 판에 서고 바탕이 가까운 이웃 */
const near = new Map<string, Set<string>>()
for (const [, ids] of boards) {
  for (const a of ids) for (const b of ids) {
    const A = FACTION_ART[a]
    const B = FACTION_ART[b]
    if (a === b || A === undefined || B === undefined || deltaE(A.color, B.color) >= P.realm.kitMainFar) continue
    near.set(a, (near.get(a) ?? new Set()).add(b))
  }
}

const bad = new Set<string>()
for (const [r, ids] of boards) {
  const lines: string[] = []
  for (const a of ids) { const s = kitSelfClash(a); if (s !== null) { lines.push(s); bad.add(a) } }
  for (const [i, a] of ids.entries()) for (const b of ids.slice(i + 1)) {
    const s = kitClash(a, b)
    if (s !== null) { lines.push(s); bad.add(a); bad.add(b) }
  }
  console.log(`${r} — 나라 ${ids.length} · ${lines.length === 0 ? '겹침 없음' : `겹침 ${lines.length}`}`)
  for (const l of lines) console.log(`  ${l}`)
}

for (const f of [...bad].sort()) {
  const A = FACTION_ART[f]
  if (A === undefined) continue
  const ok = Object.entries(PALETTE).map(([name, c]) => {
    const self = deltaE(A.color, c)
    const mn = Math.min(200, ...[...(near.get(f) ?? [])].map((o) => deltaE(FACTION_ART[o]!.color2, c)))
    return { name, c, self, mn }
  }).filter((x) => x.self >= P.realm.kitSelfFar && x.mn >= P.realm.kitSecondFar).sort((x, y) => y.mn - x.mn)
  console.log(`${f} (${A.color}) 둘째 빛 후보: ${ok.length === 0 ? '없음 — 바탕 빛을 옮긴다' : ok.map((x) => `${x.name} ${x.c}`).join(' · ')}`)
}
