/**
 * 본편 ↔ 장수 열전 잇기 (형 11-16 「열전이랑 원래 게임이랑 어떻게 연결하지」 → 「그렇게해」).
 *  - 본편이 모은 우리 장수를 적어 둔다 (ROSTER_KEY) → 독립 열전은 그 장수들만 데려갈 수 있다 (해비는 늘)
 *  - 열전이 장수마다 깬 스테이지를 적는다 (meta.ts heroes) → 그 장수로 SEAL_STAGE 를 깨면 본편에서 진각성 자격 (heroes.trueWakeOf)
 * 둘 다 저장 칸(판)과 따로인 사람 단위 기록이다. 판의 셈(sim)은 여기를 읽지 않는다: 본편 화면이 realm.raidSeals 로 옮겨 준다.
 */
import type { Kit } from './haebi.ts'

export const ROSTER_KEY = 'hanbal.raid.roster'
export const META_KEY = 'hanbal.raid.meta'
/** 진각성 자격을 주는 스테이지 — 마지막(가장 어려운) 판 */
export const SEAL_STAGE = 'palisade'
/** 늘 데려갈 수 있는 장수 (튜토리얼 · 본편을 아직 안 했어도) */
export const DEFAULT_HERO = 'tut-haebi'

export interface RosterHero { id: string; name: string; home: string; bust: string; sprite: string; awake?: string; kit: Kit; video: boolean }

const isHero = (x: unknown): x is RosterHero => {
  const o = x as Record<string, unknown> | null
  return o !== null && typeof o === 'object' && typeof o['id'] === 'string' && typeof o['name'] === 'string' && typeof o['bust'] === 'string' && typeof o['sprite'] === 'string' && typeof o['kit'] === 'string'
}
export function loadRoster(): RosterHero[] {
  try { const a = JSON.parse(localStorage.getItem(ROSTER_KEY) ?? '[]') as unknown; return Array.isArray(a) ? a.filter(isHero) : [] } catch { return [] }
}
/** 본편에서 우리 장수가 된 이를 더한다 — 한 번 모은 장수는 다른 판에서도 남는다 (도감처럼). 바뀐 것이 있으면 true */
export function mergeRoster(list: readonly RosterHero[]): boolean {
  const have = loadRoster(), byId = new Map(have.map(h => [h.id, h]))
  let changed = false
  for (const h of list) { const old = byId.get(h.id); if (!old || JSON.stringify(old) !== JSON.stringify(h)) { byId.set(h.id, h); changed = true } }
  if (changed) try { localStorage.setItem(ROSTER_KEY, JSON.stringify([...byId.values()])) } catch { /* 사생활 창 */ }
  return changed
}
/** 열전에서 SEAL_STAGE 를 깬 장수 id — 본편이 읽는다 */
export function raidSealed(): string[] {
  try {
    const m = JSON.parse(localStorage.getItem(META_KEY) ?? 'null') as { heroes?: Record<string, unknown> } | null
    return Object.entries(m?.heroes ?? {}).filter(([, s]) => Array.isArray(s) && s.includes(SEAL_STAGE)).map(([id]) => id).sort()
  } catch { return [] }
}
