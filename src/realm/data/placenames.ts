/**
 * 고을 이름은 지금 지명으로 · 옛 이름은 작게 (형 11-03).
 *
 * 형: *"빈땅을 초반에 엄청 찾게 되는데 … 이름도 모르겠는 곳을 엄청 많이 먹음. 문명은 도시들 이름이 다 익숙한 곳이거든 한양 춘천 울산 이런 식으로.
 * 근데 우리는 옛날 이름들이라 전혀 익숙하지도 않고 너무 많은데 하나도 머릿속에 인식이 안 됨."* → *"그래 니 제안대로 해."*
 *
 * - 나라 도읍(그 나라의 capital · kind 'capital')은 옛 이름 그대로 — 나라 이름과 짝이라 그게 게임 맛이다
 * - 그 밖의 고을은 prose.NODE_NOW 의 지금 지명이 이름이 된다 (셋 넘는 말이면 끝 둘만 — 「서울 광진 아차산」 → 「광진 아차산」)
 * - 옛 이름은 `old` 에 남는다 — 「옛터·읍락·마을·포구·들」 같은 꼬리말은 떼고 (「하슬라 읍락」 → 「하슬라」). 지도 이름표에 작게 · 고을 카드에 「옛 이름」
 * - 같은 이름이 둘이면 뒤엣것은 지금 지명을 다 쓰고, 그래도 겹치면 옛 이름 그대로 둔다
 *
 * 이름만 바꾼다 — 판의 셈(결정론)에는 이름이 들지 않는다. 판을 열 때(startRegion)와 옛 판을 불러올 때(migrate) 한 번씩.
 */
import type { Realm } from '../types.ts'
import { NODE_NOW } from './prose.ts'

/** 떼어도 뜻이 남는 꼬리말 — 「토함 산성」·「달천 철광」처럼 떼면 어색한 것은 둔다 */
const GENERIC = new Set(['옛터', '읍락', '마을', '갯가', '갯마을', '포구', '항구', '들', '너른들', '윗들'])

export function modernName(now: string): string {
  const w = now.split(' ')
  return w.length > 2 ? w.slice(-2).join(' ') : now
}

export function oldShort(name: string): string {
  const w = name.split(' ')
  return w.length > 1 && GENERIC.has(w[w.length - 1]!) ? w.slice(0, -1).join(' ') : name
}

/** 이름을 바꾸는 판 — 이야기 장(주몽·마한·서라벌)은 옛 이름이 이야기의 몫이고 NODE_NOW 도 「동쪽 골짜기」 같은 풀이라 그대로 둔다 */
const FREE: ReadonlySet<string> = new Set(['byeonhan-mini', 'yeongnam', 'south', 'world']) // 배우는 판은 안내 글이 옛 이름(솔뫼·갯골·갈대울)을 부른다 — 그대로

/** 판의 고을 이름을 지금 지명으로 (제자리 · 이미 바꾼 고을은 건너뛴다) */
export function modernizeNames(r: Realm): void {
  if (!FREE.has(r.region ?? 'byeonhan-mini')) return
  const caps = new Set(Object.values(r.factions).map((f) => f.capital))
  const keep = (id: string): boolean => {
    const n = r.nodes[id]!
    return n.kind === 'capital' || caps.has(id)
  }
  const ids = Object.keys(r.nodes).sort()
  const used = new Set<string>()
  for (const id of ids) if (keep(id) || r.nodes[id]!.old !== undefined || NODE_NOW[id] === undefined) used.add(r.nodes[id]!.name)
  for (const id of ids) {
    const n = r.nodes[id]!
    const now = NODE_NOW[id]
    if (keep(id) || n.old !== undefined || now === undefined) continue
    let nm = modernName(now)
    if (used.has(nm)) nm = now
    if (used.has(nm)) continue
    used.add(nm)
    const o = oldShort(n.name)
    // 옛 이름이 지금 이름 안에 이미 들었으면(「감포 항구」→「경주 감포」 · 「영덕 갯가」→「영덕」) 작은 글은 없다
    const same = nm.split(' ').some((w) => o === w || o.startsWith(w) || w.startsWith(o))
    r.nodes[id] = { ...n, name: nm, old: same ? '' : o }
  }
}
