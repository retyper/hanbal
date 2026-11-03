/**
 * 장수의 기운 — 불(범) · 물(용) · 번개(매) · 바람(학) · 땅(곰) (형 11-01 각성 연출 · ui/realm/ascend.ts 의 결).
 * 각성기(tactics 'wake')가 기운마다 다른 규칙을 꺾으니 판정이 기운에 기댄다 — 그래서 화면이 아니라 판(src/realm)에 둔다 (절대 규칙 A1·2).
 * 굴림은 없다: 정해 둔 결 → 특성 → 가장 높은 능력치.
 */
import type { Hero } from './types.ts'

export type Elem = 'fire' | 'water' | 'bolt' | 'wind' | 'earth'

/** 장수마다 정해 두는 결 (장수 설정 docs/realm/cast 가 정하면 여기에) — 없으면 특성 · 가장 높은 능력치로 */
const ELEM_OF: Readonly<Record<string, Elem>> = {}

const BY_TRAIT: ReadonlyArray<readonly [string, Elem]> = [
  ['river', 'water'], ['shaman', 'bolt'], ['nighteye', 'bolt'], ['archer', 'wind'], ['mountain', 'earth'], ['steadfast', 'earth'], ['smith', 'fire'], ['ironhand', 'fire'],
]
/** 무예는 불(범) · 통솔은 땅(곰) · 지략은 번개(매) · 내정은 물(용) · 매력은 바람(학) */
const BY_STAT: ReadonlyArray<readonly ['mu' | 'tong' | 'ryak' | 'chi' | 'deok', Elem]> = [['mu', 'fire'], ['tong', 'earth'], ['ryak', 'bolt'], ['chi', 'water'], ['deok', 'wind']]

export function elemOf(h: Pick<Hero, 'id' | 'traits' | 'mu' | 'tong' | 'ryak' | 'chi' | 'deok'>): Elem {
  const set = ELEM_OF[h.id]
  if (set !== undefined) return set
  const ts = h.traits ?? []
  for (const [t, e] of BY_TRAIT) if (ts.includes(t)) return e
  let best = BY_STAT[0]!
  for (const x of BY_STAT) if (h[x[0]] > h[best[0]]) best = x
  return best[1]
}

/**
 * 각성기를 켠 기운 — 다섯 다 (위원회 11-04 던파 ①: 첫 판 땅·바람·불 → 둘째 판 물(동해의 파도 · 되살림)·번개(백두의 지혜 · 적의 수를 먼저 본다)).
 * 여기 없는 기운의 장수는 각성해도 각성기 단추가 안 뜬다 (비기는 그대로)
 */
export const WAKE_ON: ReadonlySet<Elem> = new Set<Elem>(['earth', 'wind', 'fire', 'water', 'bolt'])
