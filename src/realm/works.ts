/**
 * 고을 일터 — 마을 내정의 첫 판 (형 11-03: "마을 먹고 할 게 없다" → "마을 내정도 해 보자 · 이거 하려면 다른 걸 해 둬야 하고
 * 나가서 채집해야 다음 콘텐츠를 즐길 수 있는, 콘텐츠 사이의 유기적임" · 위원회 DESIRE §10 「고을 결」).
 *
 * - 고을마다 일터는 하나. 그 땅에 맞는 것만 지을 수 있다 (바닷가 → 소금밭 · 쇠 나는 곳 → 쇠부리터 …)
 * - **둘째 줄 일터는 첫째 줄 일터가 우리 땅 어딘가에 있어야 열린다** — 대장간은 쇠부리터가, 젓갈 창고는 소금밭이.
 *   그래서 바닷가·쇠 나는 땅을 넓혀야 하고(개척단), 그 땅을 지켜야 한다. 일터는 고을과 함께 넘어간다 — 남이 지어 둔 대장간을 먹는 맛.
 * - 효과는 숫자 곱 하나씩이 나라 셈에 걸린다: 논(가을걷이) · 소금밭·쇠부리터·목수·목장(그 특산) · 장정 마을(징병) ·
 *   대장간(무장 올리는 쇠) · 젓갈 창고(밖에 나간 군사의 소금 — 군대가 더 오래 밖을 돈다)
 *
 * 판 상태만 읽고 쓴다 (A1) — 짓는 동안은 r.builds 에 목책과 같은 줄로 선다 (economy.stepBuilds 가 세운다).
 */
import { P } from '../tune/params.ts'
import { goodOf, isCoast, isRiverside, isWoody, stockOf } from './economy.ts'
import type { Good, Realm, RNode } from './types.ts'
import { josa } from './data/prose.ts'

export type WorkWhat = 'paddy' | 'saltpan' | 'smelter' | 'lumber' | 'ranch' | 'yard' | 'market' | 'smithy' | 'jeotgal'

export interface WorkDef {
  readonly name: string
  /** 한 줄 — 무엇이 좋아지나 */
  readonly does: string
  /** 그림 (public/realm/icon) */
  readonly icon: string
  /** 이 땅에 지을 수 있나 */
  readonly land: (r: Realm, n: RNode) => boolean
  /** 먼저 우리 땅 어딘가에 있어야 하는 일터 */
  readonly needs?: WorkWhat
}

const village = (n: RNode): boolean => n.kind !== 'sodo' && !(n.kind === 'wild' && n.hh <= 0)

export const WORKS: Readonly<Record<WorkWhat, WorkDef>> = {
  paddy: { name: '논', does: '이 고을 가을걷이가 는다', icon: 'settle-farm-village', land: (r, n) => village(n) && (isRiverside(r, n.id) || n.kind === 'village' || n.kind === 'capital') },
  saltpan: { name: '소금밭', does: '이 고을 소금이 곱절로 난다', icon: 'settle-salt-town', land: (r, n) => village(n) && isCoast(r, n.id) },
  smelter: { name: '쇠부리터', does: '이 고을 쇠가 더 난다', icon: 'treasure-iron-ingots', land: (_r, n) => village(n) && (n.kind === 'ironMine' || n.kind === 'port') },
  lumber: { name: '목수 마을', does: '이 고을 나무가 곱절로 난다', icon: 'good-wood', land: (r, n) => village(n) && isWoody(r, n.id) },
  ranch: { name: '말 목장', does: '이 고을 말이 곱절로 난다', icon: 'good-horse', land: (_r, n) => village(n) && n.tags.includes('pasture') },
  market: { name: '장터', does: '떠돌이 상단이 더 자주 오고 물건이 한 가지 더', icon: 'settle-market', land: (_r, n) => village(n) && n.kind !== 'wild' && n.hh >= P.realm.workMarketHH },
  yard: { name: '장정 마을', does: '이 고을에서 군사를 더 뽑는다', icon: 'unit-spear', land: (_r, n) => village(n) && n.kind !== 'wild' },
  smithy: { name: '대장간', does: '나라 전체 무장 올리기에 쇠가 덜 든다', icon: 'settle-forge', land: (_r, n) => village(n) && n.kind !== 'wild', needs: 'smelter' },
  jeotgal: { name: '젓갈 창고', does: '밖에 나간 군사의 소금이 반만 든다 · 군대가 더 오래 밖을 돈다', icon: 'good-soybean-jar', land: (r, n) => village(n) && isCoast(r, n.id), needs: 'saltpan' },
}

export const WORK_ORDER: readonly WorkWhat[] = ['paddy', 'saltpan', 'smelter', 'lumber', 'ranch', 'yard', 'market', 'smithy', 'jeotgal']

/** 짓는 값 — 곡식·나무 + 그 일터가 쓰는 특산 (둘째 줄은 첫째 줄의 열매를 먹는다: 대장간은 쇠, 젓갈 창고는 소금) */
export function workCost(what: WorkWhat): Partial<Record<Good, number>> {
  const R = P.realm
  // 논·장정 마을은 곡식만 (나무 없는 들판 나라도 지을 수 있게 · 시뮬: 목지가 곡식 782에 나무 1로 막혔다)
  if (what === 'paddy' || what === 'yard') return { grain: R.workGrain }
  const base: Partial<Record<Good, number>> = { grain: R.workGrain, wood: R.workWood }
  if (what === 'market') return { grain: R.workMarketGrain, wood: R.workWood }
  if (what === 'smithy') return { ...base, iron: R.workSmithyIron }
  if (what === 'jeotgal') return { ...base, salt: R.workJeotgalSalt }
  return base
}

/** 그 나라가 이 일터를 가진 고을이 있나 */
export function hasWork(r: Realm, faction: string, what: WorkWhat): boolean {
  return Object.values(r.nodes).some((n) => n.owner === faction && n.work === what)
}

/** 이 고을에서 일터를 지을 수 없는 까닭 — 지을 수 있으면 null (값은 따로 · canWork) */
export function workBlocked(r: Realm, faction: string, node: string, what: WorkWhat): string | null {
  const n = r.nodes[node]
  const d = WORKS[what]
  if (n === undefined || n.owner !== faction) return '우리 고을이 아니다'
  if (n.work !== undefined) return '일터는 고을마다 하나'
  if ((r.builds ?? []).some((b) => b.node === node) || (r.works ?? []).some((w) => w.node === node)) return '짓는 중이다'
  if (!d.land(r, n)) return '이 땅에 맞지 않는다'
  if (d.needs !== undefined && !hasWork(r, faction, d.needs)) return `${josa(WORKS[d.needs].name, '이', '가')} 먼저 있어야 한다`
  return null
}

/** 이 땅에 맞는 일터들 (지을 수 있든 없든) — 화면이 잠긴 것도 까닭과 함께 보인다 */
export function workOptions(r: Realm, node: string): WorkWhat[] {
  const n = r.nodes[node]
  if (n === undefined) return []
  return WORK_ORDER.filter((w) => WORKS[w].land(r, n))
}

export function canWork(r: Realm, faction: string, node: string, what: WorkWhat): boolean {
  if (workBlocked(r, faction, node, what) !== null) return false
  const s = stockOf(r, faction)
  for (const [g, v] of Object.entries(workCost(what)) as Array<[Good, number]>) if (goodOf(s, g) < v) return false
  return true
}

/** 효과 곱 — 고을 하나 (특산·가을걷이·징병) */
export function workMulAt(r: Realm, node: string, what: 'harvest' | 'draft' | Good): number {
  const w = r.nodes[node]?.work
  if (w === undefined) return 1
  const R = P.realm
  if (what === 'harvest') return w === 'paddy' ? R.workPaddyMul : 1
  if (what === 'draft') return w === 'yard' ? R.workYardMul : 1
  if (what === 'salt') return w === 'saltpan' ? R.workGoodMul : 1
  if (what === 'iron') return w === 'smelter' ? R.workSmelterMul : 1
  if (what === 'wood') return w === 'lumber' ? R.workGoodMul : 1
  if (what === 'horse') return w === 'ranch' ? R.workGoodMul : 1
  return 1
}
