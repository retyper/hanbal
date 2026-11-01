/**
 * 고을 구역 굽기 (FOCUS H · 형: "국경이 줌마다 꼬이고 작으면 사라짐") — 판마다 고을 구역을 한 번 셈해 src/realm/data/zones/<판>.ts 로 적는다.
 * 게임은 이 셈을 하지 않는다. 고을 자리·종류·길(또는 realm.border* · roadCorridor* params)을 바꾸면 다시 돌린다.
 *
 *   node --experimental-strip-types tools/bake-zones.ts [판 …]
 *   --stub — 셈 없이 빈 구역만 적는다 (처음 한 번, 데이터 파일이 없을 때)
 *
 * 같은 입력이면 같은 글자가 나온다 (결정론 — 칸 셈·다듬기에 무작위가 없다).
 */
import { writeFileSync } from 'node:fs'
import { REGION_IDS } from '../src/realm/data/regions/index.ts'
import type { ZoneData } from '../src/realm/data/zones/index.ts'
import type { RegionId } from '../src/realm/types.ts'

const STUB = process.argv.includes('--stub')
const only = process.argv.slice(2).filter((a) => !a.startsWith('--')) as RegionId[]
const regions = only.length > 0 ? only : REGION_IDS

const q = (s: string): string => JSON.stringify(s)
function write(region: RegionId, z: ZoneData): number {
  let s = '// 구운 고을 구역 — tools/bake-zones.ts 가 만든다. 손으로 고치지 말 것 (고을 자리·길을 바꾸면 다시 굽는다)\n'
  s += "import type { ZoneData } from './index.ts'\n\n"
  s += `export const ZONE: ZoneData = {\n  hash: ${q(z.hash)},\n  w: ${z.w},\n  h: ${z.h},\n`
  s += `  size: { ${Object.entries(z.size).map(([id, v]) => `${q(id)}: ${v}`).join(', ')} },\n`
  s += '  fill: {\n'
  for (const [id, d] of Object.entries(z.fill)) s += `    ${q(id)}: ${q(d)},\n`
  s += '  },\n  edge: [\n'
  for (const [a, b, d] of z.edge) s += `    [${q(a)}, ${q(b)}, ${q(d)}],\n`
  s += '  ],\n}\n'
  writeFileSync(new URL(`../src/realm/data/zones/${region}.ts`, import.meta.url), s)
  return s.length
}

for (const region of regions) {
  if (STUB) { write(region, { hash: '', w: 0, h: 0, size: {}, fill: {}, edge: [] }); continue }
  const t0 = performance.now()
  const { bakeRegion } = await import('./zonegeo.ts') // 빈 구역만 적을 땐 안 읽는다 (zonegeo 가 구역 데이터를 읽는 길 펴기를 부른다)
  const { data, cells } = bakeRegion(region)
  const ms = performance.now() - t0
  const bytes = write(region, data)
  const empty = Object.entries(cells).filter(([, n]) => n === 0).map(([id]) => id)
  console.log(`${region}: ${ms.toFixed(0)}ms · 고을 ${Object.keys(cells).length} · 변 ${data.edge.length} · ${(bytes / 1024).toFixed(0)}KB · 땅 없는 고을 ${empty.length}${empty.length > 0 ? ` (${empty.join(', ')})` : ''}`)
}
