/**
 * 본편 ↔ 장수 열전 잇기 (형 11-16 「열전이랑 원래 게임이랑 어떻게 연결하지」 → 「그렇게해」).
 *  - 본편이 모은 우리 장수를 적어 둔다 (ROSTER_KEY) → 독립 열전은 그 장수들만 데려갈 수 있다 (해비는 늘)
 *  - 열전이 장수마다 깬 스테이지를 적는다 (meta.ts heroes) → 그 장수로 SEAL_STAGE 를 깨면 본편에서 진각성 자격 (heroes.trueWakeOf)
 *  - 그 장수로 DEMON_STAGE 를 깨면 영웅전 표에 도깨비 도장 (stampDemons · 각성 v2 · docs/realm/study-20261118/30-PROPOSAL.md 1절 ⑥)
 * 모두 저장 칸(판)과 따로인 사람 단위 기록이다. 판의 셈(sim)은 여기를 읽지 않는다: 본편 화면이 realm.raidSeals 로 옮겨 준다.
 */
import type { Kit } from './haebi.ts'
import { HERO_BUST } from '../realm/data/hero-bust.ts'
import { DEX_DEMON, sameIds, sealsOf } from '../realm/person.ts'

export const ROSTER_KEY = 'hanbal.raid.roster'
export const META_KEY = 'hanbal.raid.meta'
/** 영웅전 표의 저장 칸 — 읽고 쓰는 곳은 ui/realm/dex.ts 다. 열전 쪽은 도깨비 도장만 더한다 (stampDemons) */
export const DEX_KEY = 'hanbal.realm.dex'
/** 진각성 자격을 주는 스테이지 — 마지막(가장 어려운) 판 */
export const SEAL_STAGE = 'palisade'
/**
 * 도깨비가 지키는 스테이지 — 그 장수로 깨면 도깨비 도장 (형 11-17 「3스테이지에 악마 아이콘」 · 이름은 도깨비 11-18).
 * 지금은 SEAL_STAGE 와 같은 판이지만 뜻이 달라 따로 둔다: 진각성 자격은 형의 답에 따라 불타는 산성으로 옮길 수 있다 (통합안 1절 ⑦)
 */
export const DEMON_STAGE = 'palisade'
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
/** 열전에서 그 스테이지를 깬 장수 id (가나다순) */
function clearedBy(stage: string): string[] {
  try {
    const m = JSON.parse(localStorage.getItem(META_KEY) ?? 'null') as { heroes?: Record<string, unknown> } | null
    return Object.entries(m?.heroes ?? {}).filter(([, s]) => Array.isArray(s) && s.includes(stage)).map(([id]) => id).sort()
  } catch { return [] }
}
/** 열전에서 SEAL_STAGE 를 깬 장수 id — 본편이 읽는다 */
export const raidSealed = (): string[] => clearedBy(SEAL_STAGE)
/**
 * 열전에서 도깨비(DEMON_STAGE 의 두목)를 잡은 장수 id — 이름난 장수(초상이 정해진 id · hero-bust.ts)만.
 * 판마다 새로 나는 자녀는 id 가 판끼리 겹쳐 사람 단위 기록을 달 수 없다 (각성 그림도 없다). 해비처럼 배우는 판에만 있는 사람은 든다.
 */
export const raidDemons = (): string[] => clearedBy(DEMON_STAGE).filter(id => HERO_BUST[id] !== undefined)
/**
 * 도깨비 도장 찍기 — 열전 기록에서 DEMON_STAGE 를 깬 장수를 영웅전 표의 도깨비 비트(person.DEX_DEMON)로 옮겨 적는다. 새로 찍었으면 true.
 *  - 열전이 목책을 깬 그 자리에서 부른다 (raid-main.ts): 본편 틀 안에서 열었든 첫 화면에서 열었든 같은 길이다
 *  - 본편이 영웅전 표를 읽을 때도 부른다 (ui/realm/dex.ts loadDex): 이 길이 생기기 전에 깬 목책도 그때 넘겨받는다 (통합안 1절 ⑩)
 * 이름난 장수(raidDemons)만 찍는다.
 * 장수 id 그대로 적고, 같은 사람은 읽을 때 묶는다 (person.sealsOf). 영웅전 표는 서버와 비트 OR 로 맞추니 기기를 바꿔도 도장이 남는다 (열전 기록은 안 맞춘다).
 * 이 도장을 읽는 곳: 열전 판 안 각성 자격 (demonSealed · 각성 v2 가7).
 */
export function stampDemons(): boolean {
  const ids = raidDemons()
  if (ids.length === 0) return false
  try {
    const raw = JSON.parse(localStorage.getItem(DEX_KEY) ?? 'null') as unknown
    if (raw !== null && (typeof raw !== 'object' || Array.isArray(raw))) return false   // 알 수 없는 꼴의 표는 덮지 않는다
    const dex = (raw ?? {}) as Record<string, { f?: unknown } | undefined>
    let changed = false
    for (const id of ids) {
      const e = dex[id], f = typeof e?.f === 'number' ? e.f : 0
      if ((f & DEX_DEMON) !== 0) continue
      dex[id] = { ...e, f: f | DEX_DEMON }; changed = true
    }
    if (changed) localStorage.setItem(DEX_KEY, JSON.stringify(dex))
    return changed
  } catch { return false }
}
/**
 * 판 안 각성 자격 — 그 사람의 도깨비 도장이 있나 (각성 v2 가7 · 11-19). 순수한 셈: 영웅전 표와 열전의 장수별 깸을 받아서 본다.
 *  - 영웅전 표의 도깨비 비트(32)를 사람으로 묶어 읽는다 (person.sealsOf · 다른 id 로 잡은 같은 사람도 든다)
 *  - 아직 표로 옮기지 않은 열전 기록의 목책 깸도 도장으로 친다 (아라처럼 이 길이 생기기 전에 깬 장수 · 사생활 창이라 표를 못 쓴 판)
 *  - 이름난 장수(초상이 정해진 id)만: 판마다 새로 나는 자녀의 id 는 판끼리 겹친다 (raidDemons 와 같은 까닭)
 * 도장이 없으면 막대가 차도 「영웅의 투지」다. 각성 띠가 없는 장수도 도장이 있으면 각성한다 (초상·영상·컷인·오라로 보인다).
 */
export function hasDemonSeal(dex: Readonly<Record<string, { readonly f: number } | undefined>>, heroes: Readonly<Record<string, readonly string[] | undefined>>, heroId: string): boolean {
  return sealsOf(dex, heroId).demon || sameIds(heroId).some(id => HERO_BUST[id] !== undefined && heroes[id]?.includes(DEMON_STAGE) === true)
}
/** 영웅전 표를 저장소에서 읽는다 — 알 수 없는 꼴이면 빈 표 (도장 없음 · 판은 투지로 선다) */
function readDex(): Record<string, { f: number }> {
  try {
    const raw = JSON.parse(localStorage.getItem(DEX_KEY) ?? 'null') as unknown
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return {}
    const out: Record<string, { f: number }> = {}
    for (const [id, e] of Object.entries(raw as Record<string, { f?: unknown } | null>)) if (typeof e?.f === 'number') out[id] = { f: e.f }
    return out
  } catch { return {} }
}
/**
 * 열전 화면이 판을 만들기 전에 부른다 (raid-main 출전 준비) — 그 장수가 판 안에서 각성할 수 있나.
 * heroes = 열전 기록의 장수별 깸 (meta.heroes · 화면이 이미 읽어 둔 것). 판의 셈(haebi.ts)은 이 값을 createHaebi 의 awaken 으로만 받는다.
 */
export const demonSealed = (heroId: string, heroes: Readonly<Record<string, readonly string[] | undefined>>): boolean => hasDemonSeal(readDex(), heroes, heroId)
