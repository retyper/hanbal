/**
 * 그림을 굽는다 — Hugging Face 의 공개 Space(FLUX.1-schnell)에서 (2026-09-20)
 *
 * 형: **"허깅페이스 같은걸로 밋밋한 SVG들 전부 에셋으로 바꿔야 겠어."**
 *
 * 메뉴(tools/gen-menu.json)에 적힌 〈프롬프트 · 시드 · 크기〉대로 한 장씩 받아
 * public/ 아래에 .webp 로 둔다. 프롬프트와 시드가 저장소에 남으므로 **같은 그림을 다시
 * 구울 수 있고**, 마음에 안 드는 한 장만 시드를 바꿔 다시 낼 수 있다.
 *
 *   node tools/gen-art.mjs                  # 아직 없는 것만 굽는다
 *   node tools/gen-art.mjs arrow-           # 이름이 'arrow-' 로 시작하는 것만
 *   node tools/gen-art.mjs arrow-burst -f   # 있어도 다시 굽는다
 *   node tools/gen-art.mjs arrow- -o tmp/   # public/ 대신 다른 곳에 (시식용)
 *
 * ── 왜 토큰을 안 쓰나 ──
 * 이 기기의 HF_TOKEN 은 다른 일(vcell)을 위한 **읽기 전용** 토큰이라 추론을 못 부른다 (403).
 * 공개 Space 는 익명으로 열려 있다 — 대신 **할당량이 작다.** 막히면 잠시 뒤에 다시 돌리면
 * 되고, 이미 받은 것은 건너뛴다.
 *
 * ── 라이선스 ──
 * FLUX.1-schnell 은 Apache-2.0 이고 결과물에 제약이 없다. 출처는 받은 폴더의 출처.txt 에 적는다.
 *
 * .webp 를 그대로 싣는다 — 이 기기에는 그림 변환기가 없고(A6: 도구에도 라이브러리를 안 들인다),
 * 브라우저는 전부 webp 를 읽는다.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'

const SPACE = 'https://black-forest-labs-flux-1-schnell.hf.space'
const MENU = 'tools/gen-menu.json'

const args = process.argv.slice(2)
const force = args.includes('-f')
const oAt = args.indexOf('-o')
const outRoot = oAt >= 0 ? args[oAt + 1] : 'public'
const prefix = args.find((a, i) => !a.startsWith('-') && (oAt < 0 || i !== oAt + 1)) ?? ''

const menu = JSON.parse(readFileSync(MENU, 'utf8'))

async function bake(prompt, seed, w, h) {
  const post = await fetch(`${SPACE}/gradio_api/call/infer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: [prompt, seed, false, w, h, 4] }),
  })
  if (!post.ok) throw new Error(`POST ${post.status}: ${(await post.text()).slice(0, 200)}`)
  const { event_id } = await post.json()
  const sse = await (await fetch(`${SPACE}/gradio_api/call/infer/${event_id}`)).text()
  const done = /event: complete\s+data: (.+)/.exec(sse)
  if (done === null) throw new Error(`Space 가 그림을 안 줬다: ${sse.slice(0, 300)}`)
  const url = JSON.parse(done[1])[0].url
  const img = await fetch(url)
  if (!img.ok) throw new Error(`GET ${img.status}`)
  return Buffer.from(await img.arrayBuffer())
}

let made = 0
let failed = 0
for (const dish of menu.dishes) {
  if (!dish.name.startsWith(prefix)) continue
  const file = join(outRoot, dish.out)
  if (existsSync(file) && !force) { console.log(`  · ${dish.name} — 이미 있다`); continue }
  const prompt = (menu.styles[dish.style] ?? '{}').replace('{}', dish.subject)
  try {
    const buf = await bake(prompt, dish.seed, dish.w ?? 512, dish.h ?? 512)
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, buf)
    console.log(`  ok ${dish.name} → ${file} (${(buf.length / 1024).toFixed(1)}KB, seed ${dish.seed})`)
    made++
  } catch (e) {
    console.log(`  ✗  ${dish.name} — ${e.message}`)
    failed++
  }
}
console.log(`\n${made}장 구웠다${failed > 0 ? ` · ${failed}장 실패 (할당량이면 잠시 뒤 다시)` : ''}.`)
process.exit(failed > 0 ? 1 : 0)
