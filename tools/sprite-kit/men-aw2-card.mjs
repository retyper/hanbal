// men-aw2-card.mjs <초상 id> — 남자 진각성 다시 굽기 카드 한 장 (11-13 형: 소두·손가락 → bake-pack STYLE_M 새 틀(눈높이 카메라·다섯 손가락))
//   옛 aw2 문안에서 「Keep the colors …」 뒤를 버리고 STYLE_M 을 붙인다 · 첨부는 그 장수 1차 각성 그림
//   → tools/out/gpt-card.txt · 첫 줄에 첨부 경로 · 받을 이름 gpt_aw2-<id>.png
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
const id = process.argv[2]
const spec = JSON.parse(readFileSync('tools/sprite-kit/heroes/gpt-awaken.json', 'utf8'))
const x = spec.find((y) => y.id === id && y.tier === 2)
if (!x) { console.log('NOSPEC'); process.exit(1) }
const bp = readFileSync('tools/bake-pack.mjs', 'utf8')
const line = bp.split('\n').find((l) => l.startsWith("const STYLE_M = '"))
const STYLE_M = line.slice("const STYLE_M = '".length, line.lastIndexOf("'")).split("\\'").join("'")
const head = x.prompt.split(' Keep the colors')[0]
writeFileSync('tools/out/gpt-card.txt', head + STYLE_M)
console.log(JSON.stringify([resolve(x.ref)]))
console.log('save as gpt_aw2-' + id + '.png ·', (head + STYLE_M).length, 'chars')
