/**
 * 장수의 나이 — 제 몸을 「늙은이 · 늙은 몸 · 노구」라 부를 수 있는 사람인가 (형 10-30: "흰머리 나지 않은 이상 본인을 늙은이라고 하는 대사는 거의 쓰지 말아야 할 듯. 다 보기엔 대부분 젊어 보여").
 * 기준은 docs/realm/cast/part-1~4.md 의 그 사람 칸 첫 줄: 나이 50 이상이거나 겉모습에 흰머리 · 희끗한 수염. 칸이 없으면 젊다.
 * tools/woo-lines-gen.ts(거르기 · 묶음 글)와 tests/realm/woo-lines.test.ts 가 쓴다.
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')

/** cast 문서 — id → 그 칸의 줄들 (「- 」를 뗀 것) */
export function castEntries(): Map<string, string[]> {
  const out = new Map<string, string[]>()
  for (const f of ['part-1.md', 'part-2.md', 'part-3.md', 'part-4.md']) {
    const lines = fs.readFileSync(path.join(ROOT, 'docs/realm/cast', f), 'utf8').replaceAll('\r\n', '\n').split('\n')
    let cur: string[] | null = null
    for (const l of lines) {
      const m = /^### .*?`([\w-]+)`/.exec(l)
      if (m !== null) { cur = []; out.set(m[1]!, cur); continue }
      if (l.startsWith('#')) { cur = null; continue }
      if (cur !== null && l.startsWith('- ') && !/^- (확인|목소리 결|등용 대사)/.test(l)) cur.push(l.slice(2))
    }
  }
  return out
}

let cache: Map<string, string[]> | null = null
/** 늙은 사람인가 — 설정 나이 50 이상이거나 겉모습에 흰머리 · 희끗한 수염 */
export function isOld(id: string): boolean {
  cache ??= castEntries()
  const first = (cache.get(id) ?? []).find((l) => l.startsWith('나이'))
  if (first === undefined) return false
  const age = Number(/나이 (\d+)/.exec(first)?.[1] ?? 0)
  return age >= 50 || /희끗|흰머리|흰 머리|백발|흰 수염|센머리|은발|하얀 머리|회색 (상투|머리)/.test(first)
}

/** 제 몸을 늙었다 하는 말 — 늙은 사람만 쓴다 (남의 나라 늙은 신하 이야기 같은 남 이야기는 괜찮다) */
export const OLD_SELF = /이 늙은|늙은 (몸|뼈|가슴|칼|칼날|손|술꾼|병졸|사신|소)|노구|노장|늙은이(가|는|도|의|를|에게)?(?=[\s.,!?…])|노인이 /
