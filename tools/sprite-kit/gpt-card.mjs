// gpt-card.mjs <저장이름> — 굽기 꾸러미(tools/out/bake-pack/index.html)에서 챗지피티 카드 한 장을 뽑는다 (GPT-BAKE-RECIPE.md)
//   첫 줄: 첨부할 그림(윈도 경로 JSON) · 문안은 tools/out/gpt-card.txt (브라우저 file_upload 는 작업 폴더 안 파일만 된다)
//   node tools/sprite-kit/gpt-card.mjs gpt15_aw1-w-17-mahan-pearl-diver.png
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
const s = readFileSync('tools/out/bake-pack/index.html', 'utf8')
const i = s.indexOf(`data-k="gpt-${process.argv[2]}"`)
if (i < 0) { console.log('NOCARD'); process.exit(1) }
const t = s.slice(i, s.indexOf('</article>', i))
const files = [...t.matchAll(/href="([^"]+)"/g)].map((x) => resolve('tools/out/bake-pack', x[1]))
const p = t.slice(t.indexOf('<textarea readonly>') + 19, t.indexOf('</textarea>')).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
writeFileSync('tools/out/gpt-card.txt', p)
console.log(JSON.stringify(files))
console.log(p.slice(0, 160))
