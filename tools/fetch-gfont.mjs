/**
 * 구글 폰트를 받아 자체 호스팅한다 — public/fonts/<prefix>-N.woff2 + fonts.css 에 덧붙임
 *
 *   node tools/fetch-gfont.mjs "Gowun Dodum" 400 dodum
 *
 * fonts.googleapis.com/css2 의 CSS(크롬 UA → woff2, 한글은 unicode-range 조각 수십 개)를 받아
 * 조각마다 내려받고 url() 만 상대경로로 바꾼다. 조각과 unicode-range 는 손대지 않는다 —
 * 브라우저는 화면에 실제로 나온 글자가 든 조각만 받는다. 같은 글꼴이 이미 fonts.css 에 있으면 그 블록을 바꾼다.
 */
import { readFileSync, writeFileSync } from 'node:fs'

const [family, weight = '400', prefix] = process.argv.slice(2)
if (!family || !prefix) { console.error('usage: node tools/fetch-gfont.mjs "<Family>" <weight> <prefix>'); process.exit(1) }

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
const url = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, '+')}:wght@${weight}&display=swap`
const css = await (await fetch(url, { headers: { 'User-Agent': UA } })).text()
if (!css.includes('@font-face')) { console.error('CSS 를 못 받았다:', css.slice(0, 200)); process.exit(1) }

const urls = [...css.matchAll(/url\((https:[^)]+\.woff2)\)/g)].map((m) => m[1])
const local = new Map()
let i = 0
for (const u of urls) {
  if (local.has(u)) continue
  const name = `${prefix}-${i++}.woff2`
  const buf = Buffer.from(await (await fetch(u, { headers: { 'User-Agent': UA } })).arrayBuffer())
  writeFileSync(`public/fonts/${name}`, buf)
  local.set(u, name)
}
// 주석·줄바꿈을 걷어 한 줄로 — 기존 fonts.css 와 같은 꼴
const block = css.replace(/\/\*[^*]*\*\//g, '').replace(/url\((https:[^)]+\.woff2)\)/g, (_, u) => `url(${local.get(u)})`).replace(/\s*\n\s*/g, '').replace(/:\s+/g, ':').replace(/;\s*}/g, '}')

const path = 'public/fonts/fonts.css'
let all = readFileSync(path, 'utf8')
const mark = `/* ${family} ${weight} */`
const re = new RegExp(`\\n?${mark.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}\\n[^\\n]*`)
all = re.test(all) ? all.replace(re, `\n${mark}\n${block}`) : `${all.trimEnd()}\n${mark}\n${block}\n`
writeFileSync(path, all)
console.log(`${family} ${weight}: 조각 ${local.size}개 → public/fonts/${prefix}-*.woff2`)
