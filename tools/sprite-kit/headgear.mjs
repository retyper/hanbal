// 투구·관·깃털이 큰 장수의 몸 키 바로잡기 (11-17 형: 「온조는 소서노보다 키가 너무 작다 · 같거나 더 커야」)
// 게임은 장수 띠를 bodyPx(첫 자세 맨 위~발 · 머리 장식 포함)가 늘 같은 화면 키가 되게 키운다(battlefield.ts --gb).
// 그래서 관·깃털 투구가 큰 장수는 정수리가 낮아져 작아 보였다. headgear.json 에 장수마다 「장식 높이 px(160칸 기준)」를 적으면
// bodyPx 에서 그만큼 빼서(원래 값은 bodyRaw) 정수리~발이 다른 장수와 같은 키로 보이게 한다.
//   node tools/sprite-kit/headgear.mjs        manifest.json · src/realm/data/spritePx.ts 다시 씀 (sprite-normalize 끝에도 불린다)
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

const HG = 'tools/sprite-kit/headgear.json'
const MAN = 'public/realm/anim-px/manifest.json'

export function applyHeadgear(all) {
  const hg = existsSync(HG) ? JSON.parse(readFileSync(HG, 'utf8')) : {}
  let n = 0
  for (const [k, v] of Object.entries(all)) {
    const raw = v.bodyRaw ?? v.bodyPx
    const cut = typeof hg[k] === 'number' ? hg[k] : 0
    if (cut > 0) { v.bodyRaw = raw; v.bodyPx = raw - cut; n++ } else if (v.bodyRaw !== undefined) { v.bodyPx = v.bodyRaw; delete v.bodyRaw }
  }
  return n
}

export function spritePxTs(all) {
  return `/** public/realm/anim-px/manifest.json 의 사본 — tools/sprite-normalize.mjs 가 만든다 (손으로 고치지 말 것). 칸 [가로, 세로] · feet = 발 줄(칸 위에서 y) · bodyPx = 서 있는 몸 키 */\nexport const SPRITE_PX: Readonly<Record<string, { readonly cell: readonly [number, number]; readonly feet: number; readonly bodyPx: number; readonly kind: 'general' | 'soldier' | 'folk' | 'crowd'; readonly cells: number }>> = ${JSON.stringify(Object.fromEntries(Object.entries(all).map(([k, v]) => [k, { cell: v.cell, feet: v.feet, bodyPx: v.bodyPx, kind: v.kind, cells: v.cells }])))}\n`
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const all = JSON.parse(readFileSync(MAN, 'utf8'))
  const n = applyHeadgear(all)
  writeFileSync(MAN, JSON.stringify(all))
  writeFileSync('src/realm/data/spritePx.ts', spritePxTs(all))
  console.log('머리 장식 키 바로잡음', n)
}
