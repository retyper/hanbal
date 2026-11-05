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

/** 바탕 — 들판 · 물가 · 숲 (지금은 들판 한 장 · 물가·숲은 굽는 대로) */
export const TOWN_GROUND = { field: 'town/ground-field.png', water: 'town/ground-field.png', wood: 'town/ground-field.png' } as const
