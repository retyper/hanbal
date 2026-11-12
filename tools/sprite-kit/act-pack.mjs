// act-pack.mjs [key …] — 형이 노트북(제미나이 웹)에서 손으로 구울 수 있게, 장수마다 걷기(walk9) + 동작(act5) 두 장의 문안과 첨부 링크를 docs/realm/BAKE-ACT.md 로 (11-12)
// 한 장수 = 새 대화 하나에 두 장 (걷기 1:1 → 같은 대화에서 동작 16:9) — 같은 대화라 걷기·동작 옷이 같다 (메모리 strip-costume-consistency)
//   node tools/sprite-kit/act-pack.mjs soseono aryeong …     (없으면 ART-QUEUE 차례 전부 · 명세가 heroes/*.json 에 없는 장수는 「명세 없음」)
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
const H = 'tools/sprite-kit/heroes/'
// 같은 key 가 여러 묶음에 있으면 나중 파일(새로 쓴 명세)이 이긴다
const spec = Object.values(Object.fromEntries(readdirSync(H).filter((f) => f.endsWith('.json')).sort().flatMap((f) => JSON.parse(readFileSync(H + f, 'utf8'))).filter((x) => x.key).map((x) => [x.key, x])))
globalThis.localStorage = { skitSpec: JSON.stringify(spec) }
globalThis.window = {}
globalThis.document = { querySelector: () => null, querySelectorAll: () => [] }
eval(readFileSync('tools/sprite-kit/gemini-kit.js', 'utf8'))
const skit = window.skit
const RAW = 'https://raw.githubusercontent.com/retyper/hanbal/master/'
const SITE = 'https://retyper.github.io/hanbal/'
const DEFAULT = 'soseono aryeong suro hyeokgeose jibaekho adogan alpyeong ara areum bakdal bandit-club baram bdanbi beomi bira byeol dallae2 dalli duman eomni gamsil gaon geumbawi goeun gom gomok gureum gwaeyu haebi haesol heo hneoul hogong hojin irang jita keundol malgalgi maro maryeo mdallae mulbeom mulsae musoe nuri odi odogan pidogan sincheongan singwigan sinneoul sobeol soebi tahae waechief yeodogan yucheongan yusugan'.split(' ')
const keys = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT
const REF_W = `${RAW}tools/sprite-kit/ref-walk-3x3.png`
const REF_A = `${RAW}tools/sprite-kit/ref-act-3x2.png`
let md = `# 장수 전투 띠 굽기 — 손으로 (11-12 · 형 노트북용)

**지금은 ② 동작만 굽는다**(새 대화 · 16:9 · 첨부: 동작 참고 → 초상). 걷기는 옛 띠를 그대로 쓴다.

> ① 걷기(walk9)는 **시험 중**: 형 11-12 소서노 시험에서 얼굴이 조금 못생겨지고 통통해짐 · 자세가 견본을 안 따라가고 겹침. 마네킹을 늘씬하게 고치고 문안에 「몸 비율·얼굴은 초상대로」를 넣었지만, 8자세를 그림 한 장으로 정확히 베끼는 건 제미나이 한계라 걷기는 Flow 걷는 영상 → 8컷 뽑기로 따로 간다.

| 시트 | 칸 | 모습 |
|---|---|---|
| ① 걷기 [ref-walk-3x3.png](${REF_W}) | 1~8 | 한 걸음 여덟 자세 (참고 그림의 색 마네킹 다리 자리 그대로 · 1·5번 다리 반대) · 무기는 몸에 붙여 칸 안 |
| | 9 | **자홍 네모 · 비움** (워터마크 자리) |
| ② 동작 [ref-act-3x2.png](${REF_A}) | 1 | 똑바로 선 대기 |
| | 2 | 당김 |
| | 3 | 끝까지 뻗은 공격 (무기 끝까지 칸 안) |
| | 4 | 맞음 |
| | 5 | 누움 |
| | 6 | **자홍 네모 · 비움** (워터마크 자리) |

## 하는 법 (동작 · 한 명 = 새 대화 한 장)
1. 제미나이 **새 대화** → 이미지 만들기 → 비율 **16:9** (Pro 가 되면 Pro · Jay u/4 말고).
2. 첨부: **① 동작 참고 → ② 그 장수 초상** (순서가 IMAGE 1·2). 아래 「② 동작」 문안을 붙여 넣고 보냄.
3. 봐서 넘길 것: 3×2 · 6번 자홍 네모 비어 있음 · 1~4 사람이 칸 왼쪽 · 3번에 무기 끝까지 · 무기가 옆 칸에 안 넘어감 · 초상과 같은 얼굴·비율. 어긋나면 같은 대화에서 그 칸만 고쳐 달라고 한 번.
4. **원본 크기로 다운로드** → 이름 \`<키>-act5.png\` → https://github.com/retyper/hanbal/upload/master/inbox 에 끌어다 놓고 Commit (여러 장 한 번에 돼).
5. 나는 \`git pull\` → 자르기 → 검사(칸 경계·머리) 통과만 넣고 배포(걷기는 옛 띠). 걸린 건 inbox 에 두고 어느 칸인지 말해 줌.
6. 걷기를 시험해 볼 땐 아래 접힌 「① 걷기」(새 대화 · 1:1) · 이름 \`<키>-walk9.png\`.

`
for (const k of keys) {
  const h = spec.find((x) => x.key === k)
  md += `\n---\n## ${k}${h ? ` · ${h.heroId}` : ''}\n`
  if (!h) { md += `**명세 없음** (옛 길로 구운 장수 · heroes/*.json 에 없음 · 문안은 나중에 만든다)\n`; continue }
  md += `- 초상: ${SITE}realm/bust-hd/${h.bust}.jpg · 무기: ${h.weapon}${h.sex === 'man' ? ' · 남' : ''}${h.desc ? '' : ' · ⚠ 옷 설명 없음(초상만 보고 그린다)'}\n\n`
  md += `### ② 동작 · 새 대화 · 16:9 · 첨부: 동작 참고 → 초상 · 저장 \`${k}-act5.png\`\n\n\`\`\`\n${skit.prompt('act5solo', k)}\n\`\`\`\n\n`
  md += `<details><summary>① 걷기 (시험 중 · 안 해도 됨 · 새 대화 · 1:1 · 첨부: 걷기 참고 → 초상 · 저장 ${k}-walk9.png)</summary>\n\n\`\`\`\n${skit.prompt('walk9', k)}\n\`\`\`\n\n</details>\n`
}
writeFileSync('docs/realm/BAKE-ACT.md', md)
console.log('docs/realm/BAKE-ACT.md', keys.length, '명 · 명세 없음', keys.filter((k) => !spec.find((x) => x.key === k)).join(' ') || '없음', '· 옷 설명 없음', keys.filter((k) => { const h = spec.find((x) => x.key === k); return h && !h.desc }).join(' ') || '없음')
