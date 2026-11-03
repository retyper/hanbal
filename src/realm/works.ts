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
  // 너른벌(pasture)이면 말이 곱절 · 아니어도 들판 마을(숲·바닷가 아님)이면 목장을 열어 말을 기른다 — 너른벌이 드물어 판마다 말이 0이었다 (위원회 11-04 림월드)
  ranch: { name: '말 목장', does: '이 고을에서 말이 난다 (너른벌이면 곱절)', icon: 'good-horse', land: (r, n) => village(n) && (n.tags.includes('pasture') || (n.kind !== 'wild' && !isWoody(r, n.id) && !isCoast(r, n.id))) },
  market: { name: '장터', does: '떠돌이 상단이 더 자주 오고 물건이 한 가지 더 (단마다)', icon: 'settle-market', land: (_r, n) => village(n) && n.kind !== 'wild' && n.hh >= P.realm.workMarketHH },
  yard: { name: '장정 마을', does: '이 고을에서 군사를 더 뽑는다', icon: 'unit-spear', land: (_r, n) => village(n) && n.kind !== 'wild' },
  smithy: { name: '대장간', does: '나라 전체 무장 올리기에 쇠가 덜 든다', icon: 'settle-forge', land: (_r, n) => village(n) && n.kind !== 'wild', needs: 'smelter' },
  jeotgal: { name: '젓갈 창고', does: '밖에 나간 군사의 소금이 반만 든다 · 군대가 더 오래 밖을 돈다', icon: 'good-soybean-jar', land: (r, n) => village(n) && isCoast(r, n.id), needs: 'saltpan' },
}

export const WORK_ORDER: readonly WorkWhat[] = ['paddy', 'saltpan', 'smelter', 'lumber', 'ranch', 'yard', 'market', 'smithy', 'jeotgal']

/**
 * 짓는 값 — 곡식·나무 + 그 일터가 쓰는 특산 (둘째 줄은 첫째 줄의 열매를 먹는다: 대장간은 쇠, 젓갈 창고는 소금).
 * `lv` 는 지으려는 단 — 2단·3단은 workLvCostMul 의 거듭제곱으로 비싸진다 (불어나는 투자 · 형 11-03 "1 사면 나중에 2가 되고 5가 돼")
 */
export function workCost(what: WorkWhat, lv = 1): Partial<Record<Good, number>> {
  const R = P.realm
  const k = Math.pow(R.workLvCostMul, Math.max(0, lv - 1))
  const scale = (c: Partial<Record<Good, number>>): Partial<Record<Good, number>> =>
    Object.fromEntries(Object.entries(c).map(([g, v]) => [g, Math.round((v ?? 0) * k)])) as Partial<Record<Good, number>>
  // 논·장정 마을은 곡식만 (나무 없는 들판 나라도 지을 수 있게 · 시뮬: 목지가 곡식 782에 나무 1로 막혔다)
  if (what === 'paddy' || what === 'yard') return scale({ grain: R.workGrain })
  const base: Partial<Record<Good, number>> = { grain: R.workGrain, wood: R.workWood }
  if (what === 'market') return scale({ grain: R.workMarketGrain, wood: R.workWood })
  if (what === 'smithy') return scale({ ...base, iron: R.workSmithyIron })
  if (what === 'jeotgal') return scale({ ...base, salt: R.workJeotgalSalt })
  return scale(base)
}

/** 일터의 단 (지었으면 1부터) */
export const workLv = (n: RNode | undefined): number => (n?.work === undefined ? 0 : n.workLv ?? 1)

/** 단마다 효과 몫 — 1단 1 · 2단 workLv2Gain · 3단 workLv3Gain (곱으로 붙는다) */
export function lvGain(lv: number): number {
  const R = P.realm
  return lv <= 0 ? 0 : lv === 1 ? 1 : lv === 2 ? R.workLv2Gain : R.workLv3Gain
}

/** 늘리는 곱 base(>1)를 단에 맞춰 — 1 + (base−1)·몫 */
const upMul = (base: number, lv: number): number => 1 + (base - 1) * lvGain(lv)
/** 줄이는 곱 base(<1)를 단에 맞춰 — 1 − (1−base)·몫, 바닥 workCutFloor */
export const cutMul = (base: number, lv: number): number => Math.max(P.realm.workCutFloor, 1 - (1 - base) * lvGain(lv))

/** 그 나라가 가진 이 일터 가운데 가장 높은 단 (없으면 0) */
export function bestWorkLv(r: Realm, faction: string, what: WorkWhat): number {
  let best = 0
  for (const n of Object.values(r.nodes)) if (n.owner === faction && n.work === what) best = Math.max(best, n.workLv ?? 1)
  return best
}

/** 그 나라가 이 일터를 가진 고을이 있나 */
export function hasWork(r: Realm, faction: string, what: WorkWhat): boolean {
  return bestWorkLv(r, faction, what) > 0
}

/** 이 고을에서 일터를 짓거나(새로) 올릴(같은 것) 수 없는 까닭 — 되면 null (값은 따로 · canWork) */
export function workBlocked(r: Realm, faction: string, node: string, what: WorkWhat): string | null {
  const n = r.nodes[node]
  const d = WORKS[what]
  if (n === undefined || n.owner !== faction) return '우리 고을이 아니다'
  if (n.work !== undefined && n.work !== what) return '일터는 고을마다 하나'
  if (n.work === what && workLv(n) >= Math.round(P.realm.workLvMax)) return '다 올렸다'
  if ((r.builds ?? []).some((b) => b.node === node) || (r.works ?? []).some((w) => w.node === node)) return '짓는 중이다'
  if (!d.land(r, n)) return '이 땅에 맞지 않는다'
  if (n.work === undefined && d.needs !== undefined && !hasWork(r, faction, d.needs)) return `${josa(WORKS[d.needs].name, '이', '가')} 먼저 있어야 한다`
  return null
}

/** 이 땅에 맞는 일터들 (지을 수 있든 없든) — 화면이 잠긴 것도 까닭과 함께 보인다 */
export function workOptions(r: Realm, node: string): WorkWhat[] {
  const n = r.nodes[node]
  if (n === undefined) return []
  return WORK_ORDER.filter((w) => WORKS[w].land(r, n))
}

/** 이번에 지으면 몇 단이 되나 — 새로면 1, 올리면 다음 단 */
export function targetLv(r: Realm, node: string, what: WorkWhat): number {
  const n = r.nodes[node]
  return n?.work === what ? workLv(n) + 1 : 1
}

export function canWork(r: Realm, faction: string, node: string, what: WorkWhat): boolean {
  if (workBlocked(r, faction, node, what) !== null) return false
  const s = stockOf(r, faction)
  for (const [g, v] of Object.entries(workCost(what, targetLv(r, node, what))) as Array<[Good, number]>) if (goodOf(s, g) < v) return false
  return true
}

/** 효과 곱 — 고을 하나 (특산·가을걷이·징병) · 단이 오를수록 곱으로 더 */
export function workMulAt(r: Realm, node: string, what: 'harvest' | 'draft' | Good): number {
  const n = r.nodes[node]
  const w = n?.work
  if (w === undefined) return 1
  const R = P.realm
  const lv = workLv(n)
  if (what === 'harvest') return w === 'paddy' ? upMul(R.workPaddyMul, lv) : 1
  if (what === 'draft') return w === 'yard' ? upMul(R.workYardMul, lv) : 1
  if (what === 'salt') return w === 'saltpan' ? upMul(R.workGoodMul, lv) : 1
  if (what === 'iron') return w === 'smelter' ? upMul(R.workSmelterMul, lv) : 1
  if (what === 'wood') return w === 'lumber' ? upMul(R.workGoodMul, lv) : 1
  if (what === 'horse') return w === 'ranch' ? upMul(R.workGoodMul, lv) : 1
  return 1
}
