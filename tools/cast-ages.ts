/**
 * 장수 나이 표 — docs/realm/cast/part-1~4.md · kids.md 의 「나이 N」과 겉모습(흰머리 · 희끗한 수염 …)을 읽어
 * src/realm/data/ages.ts 를 쓴다 (형 10-30: "흰머리 나지 않은 이상 본인을 늙은이라고 하는 대사는 거의 쓰지 말아야 할 듯").
 *   npx tsx tools/cast-ages.ts          → ages.ts 를 다시 쓴다
 *   npx tsx tools/cast-ages.ts --check  → 지금 ages.ts 가 문서와 같은지만 본다 (다르면 1)
 * 장수 설정 문서를 고치면 이것을 다시 돌린다. 늙었다고 말해도 되는지는 src/realm/age.ts isOld.
 */
import { readFileSync, writeFileSync } from 'node:fs'

const ROOT = new URL('../', import.meta.url)
const PARTS = ['part-1.md', 'part-2.md', 'part-3.md', 'part-4.md', 'kids.md']
const OUT = new URL('src/realm/data/ages.ts', ROOT)

/** 머리·수염이 센 겉모습 — 「회색 머리띠」 「잿빛 눈」 「흰 털모자」 같은 것은 걸리지 않게 머리·상투·수염 앞에서만 */
const GREY = /희끗|백발|흰머리|흰\s?(?:수염|턱수염|상투|머리(?!띠))|(?:잿빛|회색|은빛)\s?(?:(?:긴|섞인)\s?)?(?:머리(?!띠)|상투|수염|턱수염)/

type Row = { id: string; art: string; age: number; grey: boolean }

function parse(file: string, text: string): Row[] {
  const out: Row[] = []
  const lines = text.replaceAll('\r\n', '\n').split('\n')
  for (let i = 0; i < lines.length; i++) {
    const h = lines[i]!
    if (!h.startsWith('### ')) continue
    // 본편: ### 이름 · `id` · 그림 `art`  ·  자란 아이: ### y-g-01 · 갈래
    const ticks = [...h.matchAll(/`([^`]+)`/g)].map((m) => m[1]!)
    const kid = /^### (y-[gw]-\d+)/.exec(h)
    const id = ticks[0] ?? kid?.[1]
    if (id === undefined) continue
    const art = ticks[1] ?? id
    const body = lines[i + 1] ?? ''
    const m = /^- 나이 (\d+)/.exec(body)
    if (m === null) throw new Error(`${file}: ${id} 의 다음 줄에 「- 나이 N」이 없다`)
    const look = body.split('겉모습:')[1] ?? ''
    out.push({ id, art, age: Number(m[1]), grey: GREY.test(look) })
  }
  return out
}

const rows: Row[] = []
for (const f of PARTS) rows.push(...parse(f, readFileSync(new URL(`docs/realm/cast/${f}`, ROOT), 'utf8')))

const byId = new Map<string, Row>()
const byArt = new Map<string, Row>()
for (const r of rows) {
  if (byId.has(r.id)) throw new Error(`장수 id 가 두 번 나온다: ${r.id}`)
  byId.set(r.id, r)
  // 얼굴 하나를 여럿이 쓰면 더 젊은 쪽으로 (늙었다고 잘못 말하는 쪽보다 안 말하는 쪽이 낫다)
  const prev = byArt.get(r.art)
  if (prev === undefined || r.age < prev.age || (r.age === prev.age && !r.grey)) byArt.set(r.art, r)
}

const ent = (k: string, r: Row): string => `  '${k}': { age: ${r.age}, grey: ${r.grey} },`
const src = `/**
 * 장수 나이 — docs/realm/cast 의 「나이 N」과 겉모습에서 뽑았다. 손으로 고치지 말고 tools/cast-ages.ts 를 다시 돌린다.
 * grey: 머리나 수염이 셌다 (흰머리 · 희끗한 · 백발 · 흰 수염 · 잿빛 상투 …). 늙었다고 말해도 되는지는 src/realm/age.ts isOld.
 */
export type CastAge = { readonly age: number; readonly grey: boolean }

/** 장수 id → 나이 (자란 아이는 얼굴 id y-g-NN · y-w-NN) */
export const CAST_AGE: Readonly<Record<string, CastAge>> = {
${[...byId.entries()].map(([k, r]) => ent(k, r)).join('\n')}
}

/** 얼굴(그림 id) → 나이 · 설정 문서에 없는 장수가 같은 얼굴을 쓰면 이것으로 (여럿이 쓰는 얼굴은 더 젊은 쪽) */
export const FACE_AGE: Readonly<Record<string, CastAge>> = {
${[...byArt.entries()].map(([k, r]) => ent(k, r)).join('\n')}
}
`

if (process.argv.includes('--check')) {
  const now = readFileSync(OUT, 'utf8').replaceAll('\r\n', '\n')
  if (now !== src) {
    console.error('src/realm/data/ages.ts 가 장수 설정과 다르다 — npx tsx tools/cast-ages.ts')
    process.exit(1)
  }
  console.log(`같다 · ${byId.size}명`)
} else {
  writeFileSync(OUT, src)
  const old = rows.filter((r) => r.age >= 50 || r.grey)
  console.log(`${byId.size}명 · 얼굴 ${byArt.size} · 늙었다고 말해도 되는 이 ${old.length}명 (쉰 넘음 ${rows.filter((r) => r.age >= 50).length} · 센 머리 ${rows.filter((r) => r.grey).length})`)
}
