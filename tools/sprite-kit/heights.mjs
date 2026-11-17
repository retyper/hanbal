// 장수 키(cm) 표 (11-17 형: 「장수들마다 키 설정을 넣고 그에 맞게 그리는 거 어때」)
// 게임은 장수 띠를 정수리~발(머리 장식 뺀 bodyPx · headgear.json)이 같은 화면 키가 되게 맞춘 뒤 cm/165 를 곱한다(art.ts genArtOf).
// 기준 소서노 165cm. 이름 있는 값은 heights.json · 없으면 여 163 · 남 174 (원화 파일 이름 w-/g-/l- 로 가름).
//   node tools/sprite-kit/heights.mjs   →  src/realm/data/hero-height.ts
import { readFileSync, writeFileSync } from 'node:fs'
const man = JSON.parse(readFileSync('public/realm/anim-px/manifest.json', 'utf8'))
const set = JSON.parse(readFileSync('tools/sprite-kit/heights.json', 'utf8'))
const audit = JSON.parse(readFileSync('tools/sprite-kit/weapon-audit-20261116.json', 'utf8'))
const portrait = Object.fromEntries((Array.isArray(audit) ? audit : audit.rows).map((r) => [r.key, r.portrait ?? '']))
const W = new Set(set._women ?? [])
const out = {}
for (const [k, v] of Object.entries(man)) {
  if (v.kind !== 'general' || !k.startsWith('gen-') || v.bodyPx < 100) continue
  const key = k.slice(4)
  const p = portrait[key] ?? portrait[key.replace(/^aw1-/, '')] ?? key.replace(/^(aw1-)?base-/, '')
  const woman = W.has(key.replace(/^aw1-/, '')) || /^[wl]-/.test(p)
  out[key] = set[key] ?? set[key.replace(/^aw1-/, '')] ?? (woman ? 163 : 174)
}
writeFileSync('src/realm/data/hero-height.ts', `/** 장수 키 cm — tools/sprite-kit/heights.mjs 가 만든다(손으로 고치지 말 것 · 값은 tools/sprite-kit/heights.json). 기준 소서노 165 · 화면 키 = 띠 몸 키 × cm/165 */\nexport const HERO_CM: Readonly<Record<string, number>> = ${JSON.stringify(out)}\n`)
console.log('키', Object.keys(out).length)
