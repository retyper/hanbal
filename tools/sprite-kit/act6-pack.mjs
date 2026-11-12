// act6-pack.mjs [key …] — 형이 노트북(제미나이 웹)에서 손으로 구울 수 있게, 장수마다 act6solo 문안 + 첨부 링크를 docs/realm/BAKE-ACT6.md 로 (11-12)
//   node tools/sprite-kit/act6-pack.mjs soseono aryeong …     (없으면 ART-QUEUE 1·2순위 전부 · 명세가 heroes/*.json 에 없는 장수는 「명세 없음」으로 적는다)
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
const H = 'tools/sprite-kit/heroes/'
const spec = readdirSync(H).filter((f) => f.endsWith('.json')).flatMap((f) => JSON.parse(readFileSync(H + f, 'utf8')))
globalThis.localStorage = { skitSpec: JSON.stringify(spec) }
globalThis.window = {}
globalThis.document = { querySelector: () => null, querySelectorAll: () => [] }
eval(readFileSync('tools/sprite-kit/gemini-kit.js', 'utf8'))
const skit = window.skit
const RAW = 'https://raw.githubusercontent.com/retyper/hanbal/master/'
const SITE = 'https://retyper.github.io/hanbal/'
const DEFAULT = 'soseono aryeong suro hyeokgeose jibaekho adogan alpyeong ara areum bakdal bandit-club baram bdanbi beomi bira byeol dallae2 dalli duman eomni gamsil gaon geumbawi goeun gom gomok gureum gwaeyu haebi haesol heo hneoul hogong hojin irang jita keundol malgalgi maro maryeo mdallae mulbeom mulsae musoe nuri odi odogan pidogan sincheongan singwigan sinneoul sobeol soebi tahae waechief yeodogan yucheongan yusugan'.split(' ')
const keys = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT
let md = `# 동작 띠 3×2 손으로 굽기 (11-12 · 형 노트북용)

## 하는 법 (한 명 = 새 대화 한 장)
1. 제미나이(gemini.google.com · Jay u/4 말고) 새 대화 → **이미지 만들기 · 16:9**.
2. 그림 두 장 첨부 — **먼저** 참고 시트 [ref-act-3x2.png](${RAW}tools/sprite-kit/ref-act-3x2.png), **그다음** 그 장수의 초상(아래 링크). 순서가 IMAGE 1·2 다.
3. 아래 문안을 그대로 붙여 넣고 보냄. 결과가 「6칸 아님 / 사람이 칸 가운데 / 무기가 칸 벽에 닿음」이면 같은 대화에서 그 칸만 고쳐 달라고 한 번.
4. 받은 파일 이름을 **\`<키>-act6.png\`** 로 바꿔서(예 \`soseono-act6.png\`) 깃허브 저장소 \`inbox/\` 폴더에 올린다: https://github.com/retyper/hanbal/upload/master/inbox (끌어다 놓고 Commit). 여러 장 한 번에 올려도 된다.
5. 나는 \`git pull\` 해서 자르고 검사(칸 경계·머리) 통과한 것만 넣는다. 걷기는 옛 띠 그대로.

`
for (const k of keys) {
  const h = spec.find((x) => x.key === k)
  md += `\n---\n## ${k}${h ? ` · ${h.heroId}` : ''}\n`
  if (!h) { md += `**명세 없음** (옛 길로 구운 장수 · heroes/*.json 에 없음 · 문안은 나중에 만든다)\n`; continue }
  md += `- 초상(IMAGE 2): ${SITE}realm/bust-hd/${h.bust}.jpg\n- 무기: ${h.weapon}${h.sex === 'man' ? ' · 남' : ''}\n\n\`\`\`\n${skit.prompt('act6solo', k)}\n\`\`\`\n`
}
writeFileSync('docs/realm/BAKE-ACT6.md', md)
console.log('docs/realm/BAKE-ACT6.md', keys.length, '명 · 명세 없음', keys.filter((k) => !spec.find((x) => x.key === k)).join(' ') || '없음')
