// act-pack.mjs [key …] — 형이 노트북(제미나이 웹)에서 손으로 구울 수 있게, 장수마다 act5solo 문안 + 첨부 링크를 docs/realm/BAKE-ACT.md 로 (11-12)
// 옷 참고(IMAGE 3)는 옛 걷기 원본 1번 컷을 docs/realm/bake/<key>.jpg 로 뽑는다 (옛 걷기와 새 동작의 옷이 같게 · 메모리 strip-costume-consistency)
//   node tools/sprite-kit/act-pack.mjs soseono aryeong …     (없으면 ART-QUEUE 1·2순위 전부 · 명세가 heroes/*.json 에 없는 장수는 「명세 없음」으로 적는다)
import { readFileSync, readdirSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
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
let md = `# 동작 띠 다시 굽기 — 손으로 (11-12 · 형 노트북용)

틀: **3×2 가로 칸 · 5컷 + 우하단 자홍 네모.** 1 서기(대기 겸) · 2 당김 · 3 끝까지 뻗은 공격 · 4 맞음 · 5 누움 · 6 자홍 네모(워터마크가 여기 떨어진다 · 아무것도 안 그림).
게임에선 서기 4칸 = 1 · 공격 6칸 = 1,2,3,3,3,1 · 맞음 = 4 · 쓰러짐 = 5 로 쓴다. 걷기는 옛 띠 그대로.

## 하는 법 (한 명 = 새 대화 한 장)
1. 제미나이 새 대화 → **이미지 만들기 · 16:9** (Pro 가 되면 Pro · Jay u/4 말고).
2. 그림 첨부, 순서대로 — ① 참고 시트 [ref-act-3x2.png](${RAW}tools/sprite-kit/ref-act-3x2.png) ② 그 장수 초상 ③ 옷 참고(있는 장수만).
3. 문안 붙여 넣고 보냄. **보고 넘길 것**: 6칸 · 우하단 자홍 네모가 비어 있음 · 1~4 사람이 칸 왼쪽 · 3번에 무기 끝까지 · 무기가 옆 칸에 안 넘어감 · 옛 걷기와 같은 옷. 어긋나면 같은 대화에서 그 칸만 고쳐 달라고 한 번.
4. **원본 크기로 다운로드** → 이름을 \`<키>-act5.png\` 로 바꿔(예 \`soseono-act5.png\`) https://github.com/retyper/hanbal/upload/master/inbox 에 끌어다 놓고 Commit. 여러 장 한 번에 돼.
5. 나는 \`git pull\` → 자르기 → 검사(칸 경계·머리) 통과만 넣고 배포. 걸린 건 inbox 에 두고 어느 칸인지 말해 줌.

`
for (const k of keys) {
  const h = spec.find((x) => x.key === k)
  md += `\n---\n## ${k}${h ? ` · ${h.heroId}` : ''}\n`
  if (!h) { md += `**명세 없음** (옛 길로 구운 장수 · heroes/*.json 에 없음 · 문안은 나중에 만든다)\n`; continue }
  const walk = `assets_src/realm/gemini/generals2/${k}-walk-key.png`
  let outfit = ''
  if (existsSync(walk)) {
    mkdirSync('docs/realm/bake', { recursive: true })
    const py = `from PIL import Image\nim=Image.open(r'${walk}').convert('RGBA'); w,h=im.size; c=im.crop((0,0,w//4,h//2)); bg=Image.new('RGBA',c.size,(0,255,0,255)); bg.alpha_composite(c); bg.convert('RGB').save(r'docs/realm/bake/${k}.jpg', quality=88)`
    execFileSync('py', ['-3', '-X', 'utf8', '-c', py])
    outfit = `- 옷 참고(IMAGE 3): ${RAW}docs/realm/bake/${k}.jpg\n`
  }
  md += `- 초상(IMAGE 2): ${SITE}realm/bust-hd/${h.bust}.jpg\n${outfit}- 무기: ${h.weapon}${h.sex === 'man' ? ' · 남' : ''}\n\n\`\`\`\n${skit.prompt('act5solo', k)}\n\`\`\`\n`
}
writeFileSync('docs/realm/BAKE-ACT.md', md)
console.log('docs/realm/BAKE-ACT.md', keys.length, '명 · 명세 없음', keys.filter((k) => !spec.find((x) => x.key === k)).join(' ') || '없음')
