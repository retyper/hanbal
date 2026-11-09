/**
 * 마을 안 그림 (public/realm/town) — 비스듬히 내려다본 빈 터 바탕과 터마다 서는 일터의 단 그림 (형 11-05).
 * 구운 일터만 여기 적는다 — 없는 일터는 마을 안에서 그 터에 일터 그림표를 세운다 (ART-QUEUE 「마을 안 다시」).
 * 일터 그림은 town/work-<일터>-<단>.png (1·2·3) · 짓는 중은 town/build.png 하나를 같이 쓴다.
 */
import type { WorkWhat } from '../works.ts'

/** 단 그림을 구운 일터 */
export const TOWN_WORK_ART: ReadonlySet<WorkWhat> = new Set<WorkWhat>(['paddy', 'saltpan', 'smelter', 'lumber', 'ranch', 'market', 'yard', 'smithy', 'jeotgal'])

/** 그 일터 그 단의 그림 (public/realm 기준) — 없으면 null */
export const townSprite = (what: WorkWhat, lv: number): string | null =>
  TOWN_WORK_ART.has(what) && lv >= 1 ? `town/work-${what}-${Math.min(3, lv)}.png` : null

/** 바탕 — 들판 · 물가 · 숲 (11-08 셋 다 · 울타리 안은 같은 자리라 터 넷 좌표를 함께 쓴다) */
export const TOWN_GROUND = { field: 'town/ground-field.png', water: 'town/ground-water.png', wood: 'town/ground-wood.png' } as const

/** 울타리 꼴 — 지은 방비가 마을 그림에 보인다 (형 11-09: "목책·해자를 파도 마을 그림이 안 바뀜") */
export type TownFort = 'bare' | 'palisade' | 'earth' | 'moat'
/**
 * 방비마다 구운 바탕 (palisade 는 위 TOWN_GROUND 그대로) — 굽지 않은 꼴은 그 땅의 목책 바탕으로 둔다.
 * 제미나이로 옛 바탕을 고쳐 구웠다: 목책을 걷은 빈 마을 · 목책 밖 해자와 다리 · 다진 흙 토성 (같은 틀이라 터 넷 좌표가 그대로 맞는다)
 */
const TOWN_GROUND_FORT: Readonly<Record<keyof typeof TOWN_GROUND, Partial<Record<TownFort, string>>>> = {
  field: { bare: 'town/ground-field-bare.png', moat: 'town/ground-field-moat.png', earth: 'town/ground-field-earth.png' },
  water: { bare: 'town/ground-water-bare.png', moat: 'town/ground-water-moat.png' },
  wood: { bare: 'town/ground-wood-bare.png', moat: 'town/ground-wood-moat.png' },
}
/** 고을의 방비 → 그림 꼴 — 해자 > 토성 > 목책(도읍·성은 처음부터) > 없음. 겹쳐 지었으면 가장 센 것 하나 */
export function townFort(kind: string, tags: readonly string[]): TownFort {
  if (tags.includes('moat')) return 'moat'
  if (tags.includes('earthwall')) return 'earth'
  if (tags.includes('palisade') || kind === 'capital' || kind === 'fort') return 'palisade'
  return 'bare'
}
/** 땅 × 방비의 바탕 그림 */
export const townGround = (land: keyof typeof TOWN_GROUND, fort: TownFort): string =>
  (fort !== 'palisade' ? TOWN_GROUND_FORT[land][fort] : undefined) ?? TOWN_GROUND[land]
