/**
 * 글 속 낱말에 색 (형: "텍스트들로 안내가 뜨면 마을을 뜻하는 단어, 목적어를 뜻하는 단어 이런것들은 각각의 구분가능한 특색의 색으로 …
 * 군사면 붉은계열 · 피해면 붉은계열 · 마을이면 갈색계열 · 국가라면 국가마다의 색").
 *
 * 이스케이프한 글(태그 없음)만 받는다. 나라 이름은 그 나라 색의 띠, 낱말은 갈래마다 색:
 *   군사(붉은 기) · 잃음(진한 붉음) · 얻음(초록) · 마을·집(갈색) · 곡식(누런) · 철(쇳빛) · 장수 이름(금빛)
 * 긴 말부터 맞춘다 — "새 마을"이 "마을"보다, "방패병"이 "병"보다 먼저.
 */

export type TintKind = 'men' | 'loss' | 'gain' | 'home' | 'grain' | 'iron' | 'hero'

const WORDS: Readonly<Record<Exclude<TintKind, 'hero'>, readonly string[]>> = {
  men: ['군사', '군대', '병사', '장정', '창병', '궁수', '방패병', '기병', '수군', '별동대', '적군', '대군', '척후', '자객', '징병'],
  loss: ['잃었다', '잃는다', '빼앗겼다', '무너졌다', '죽었다', '쓰러졌다', '다쳤다', '사로잡혔다', '굶는다', '바닥났다', '물러났다', '들켰다', '흩어졌다', '밀려서', '크게 진다'],
  gain: ['쥐었다', '차지했다', '사로잡았다', '지켜 냈다', '물리치고', '이겼다', '해냈다', '먹혔다', '맺었다', '화친했다', '들였다'],
  home: ['새 마을', '빈땅', '마을', '고을', '도읍', '읍락', '포구', '항구', '산성', '집', '개척'],
  grain: ['곡식', '수확'],
  iron: ['철'],
}

export interface TintNames {
  /** 나라 이름 → 그 나라 색 */
  readonly nations: ReadonlyArray<readonly [string, string]>
  /** 장수 이름 */
  readonly heroes: readonly string[]
  /** 고을 이름 — 마을빛 */
  readonly places?: readonly string[]
}

const cache = new Map<string, { re: RegExp; kind: Map<string, string> }>()

function build(names: TintNames): { re: RegExp; kind: Map<string, string> } {
  const key = names.nations.map((n) => n[0]).join('|') + '#' + names.heroes.join('|') + '#' + (names.places ?? []).length
  const hit = cache.get(key)
  if (hit !== undefined) return hit
  const kind = new Map<string, string>()
  for (const [k, ws] of Object.entries(WORDS)) for (const w of ws) kind.set(w, `<span class="tw ${k}">${w}</span>`)
  for (const p of names.places ?? []) if (p.length >= 2) kind.set(p, `<span class="tw home">${p}</span>`)
  for (const h of names.heroes) if (h.length >= 2) kind.set(h, `<span class="tw hero">${h}</span>`)
  for (const [n, c] of names.nations) if (n.length >= 2) kind.set(n, `<span class="tw nat" style="--c:${c}">${n}</span>`)
  // 한 글자 말(집·철)은 낱말일 때만 — '제사철'의 철, '모집'의 집은 아니다. 앞이 한글이 아니고, 뒤가 한글이 아니거나 토씨
  const one = (w: string): string => `(?<![가-힣])${w}(?=$|[^가-힣]|[이을은도과로만의에])`
  const alts = [...kind.keys()].sort((a, b) => b.length - a.length).map((w) => (w.length === 1 ? one(w) : w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  const out = { re: new RegExp(alts.join('|'), 'g'), kind }
  if (cache.size > 8) cache.clear()
  cache.set(key, out)
  return out
}

/** 이스케이프한 글에 색을 입힌다 — 태그가 든 글은 넣지 않는다 */
export function tint(escaped: string, names: TintNames): string {
  const { re, kind } = build(names)
  return escaped.replace(re, (w) => kind.get(w) ?? w)
}

export const TINT_CSS = `
.ap .tw { font-weight: 700; }
.ap .tw.men { color: #f0907a; } .ap .tw.loss { color: #ff7a62; } .ap .tw.gain { color: #9fd18b; }
.ap .tw.home { color: #d9a86a; } .ap .tw.grain { color: #ecc862; } .ap .tw.iron { color: #a9c3dc; } .ap .tw.hero { color: #f3d48a; }
.ap .tw.nat { color: #fff; padding: 0 4px; border-radius: 5px; background: color-mix(in srgb, var(--c) 55%, #1b2028); box-shadow: inset 0 -2px 0 var(--c); }
`
