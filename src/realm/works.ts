/**
 * 고을 일터 — 마을 내정의 첫 판 (형 11-03: "마을 먹고 할 게 없다" → "마을 내정도 해 보자 · 이거 하려면 다른 걸 해 둬야 하고
 * 나가서 채집해야 다음 콘텐츠를 즐길 수 있는, 콘텐츠 사이의 유기적임" · 위원회 DESIRE §10 「고을 결」).
 *
 * - 고을마다 터가 집 수만큼(작은 마을 1 → 큰 고을 workLotMax) — 터마다 서로 다른 일터 하나 · 그 땅에 맞는 것만 (바닷가 → 소금밭 · 쇠 나는 곳 → 쇠부리터 …)
 *   (형 11-05: "논을 지으면 다른 걸 아예 못 짓는 게 말이 안 돼") · 옛 판의 n.work·workLv 는 첫 터로 읽는다 (lvOf)
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
  // 사람이 사는 들(개척한 wild)도 논은 풀 수 있다 — 전엔 개척 마을 57곳이 지을 일터가 하나도 없어 마을 안조차 못 열었다 (형 11-09: "웬만한 마을도 최소 건물 1개는")
  paddy: { name: '논', does: '이 고을 가을걷이가 는다', icon: 'settle-farm-village', land: (r, n) => village(n) && (isRiverside(r, n.id) || n.kind === 'village' || n.kind === 'capital' || n.kind === 'wild') },
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

/** 이 고을의 이 일터 단 (없으면 0) — 터마다 일터 (n.lots) · 옛 판은 n.work·workLv 하나 */
export function lvOf(n: RNode | undefined, what: WorkWhat): number {
  if (n === undefined) return 0
  const v = n.lots?.[what]
  if (v !== undefined) return v
  return n.work === what ? n.workLv ?? 1 : 0
}

/** 이 고을에 선 일터들 — [일터, 단] (WORK_ORDER 차례) */
export function worksOf(n: RNode | undefined): Array<[WorkWhat, number]> {
  if (n === undefined) return []
  return WORK_ORDER.map((w): [WorkWhat, number] => [w, lvOf(n, w)]).filter(([, lv]) => lv > 0)
}

/**
 * 이 고을의 터 수 — 땅 크기대로 (형 11-05: "도읍 땅이 제일 크고 작은 덴 작고 · 이런 차별성이 있어야 땅도 넓힐 맛") ·
 * 도읍 workLotCapital · 마을·포구 workLotTown · 산성·철광 workLotSmall · 개척한 빈 땅 1(품이 workLotWildRoom 넘는 너른 벌이면 2) · 소도 0
 */
export function lotCap(n: RNode | undefined): number {
  if (n === undefined || n.kind === 'sodo') return 0
  const R = P.realm
  const v0 = n.kind === 'capital' ? R.workLotCapital : n.kind === 'village' || n.kind === 'port' ? R.workLotTown : n.kind === 'fort' || n.kind === 'ironMine' ? R.workLotSmall : 1 + ((n.room ?? 0) >= R.workLotWildRoom ? 1 : 0)
  const base = Math.max(1, Math.round(v0))
  return Math.min(Math.max(base, Math.round(R.workLotOpenMax)), base + (n.lotsOpen ?? 0))
}

/** 공사로 닦기 전 이 땅의 터 수 */
export function lotBase(n: RNode | undefined): number {
  return n === undefined ? 0 : lotCap({ ...n, lotsOpen: 0 })
}

/** 터 닦기 값 — 닦을수록 비싸진다 (몇째 닦기인가) */
export function clearCost(n: RNode | undefined): { grain: number; wood: number } {
  const R = P.realm
  const k = 1 + (n?.lotsOpen ?? 0) * R.workClearStep
  return { grain: Math.round(R.workClearGrain * k), wood: Math.round(R.workClearWood * k) }
}

/** 터를 닦을 수 없는 까닭 — 되면 null (값은 따로) */
export function clearBlocked(r: Realm, faction: string, node: string): string | null {
  const n = r.nodes[node]
  if (n === undefined || n.owner !== faction) return '우리 고을이 아니다'
  if (n.kind === 'sodo') return '소도에는 터를 닦지 않는다'
  if (lotCap(n) >= Math.round(P.realm.workLotOpenMax)) return '더 닦을 땅이 없다'
  if ((r.builds ?? []).some((b) => b.node === node) || (r.works ?? []).some((w) => w.node === node) || (r.clears ?? []).some((c) => c.node === node)) return '짓는 중이다'
  return null
}

export function canClear(r: Realm, faction: string, node: string): boolean {
  if (clearBlocked(r, faction, node) !== null) return false
  const c = clearCost(r.nodes[node])
  const s = stockOf(r, faction)
  return s.grain >= c.grain && goodOf(s, 'wood') >= c.wood
}

/** 일터를 세운다 (단까지) — 옛 n.work·workLv 를 터로 옮겨 적는다 */
export function withWork(n: RNode, what: WorkWhat, lv: number): RNode {
  const lots: Partial<Record<WorkWhat, number>> = Object.fromEntries(worksOf(n))
  lots[what] = lv
  const { work: _w, workLv: _l, ...rest } = n
  return { ...rest, lots }
}

/** 일터의 단 — 일터를 주면 그 일터, 안 주면 가장 높은 것 (없으면 0) */
export const workLv = (n: RNode | undefined, what?: WorkWhat): number => (what !== undefined ? lvOf(n, what) : Math.max(0, ...worksOf(n).map(([, lv]) => lv)))

/** 단마다 효과 몫 — 1단 1 · 2단 workLv2Gain · 3단 workLv3Gain (곱으로 붙는다) */
export function lvGain(lv: number): number {
  const R = P.realm
  return lv <= 0 ? 0 : lv === 1 ? 1 : lv === 2 ? R.workLv2Gain : R.workLv3Gain
}

/** 늘리는 곱 base(>1)를 단에 맞춰 — 1 + (base−1)·몫 */
const upMul = (base: number, lv: number): number => 1 + (base - 1) * lvGain(lv)
/** 줄이는 곱 base(<1)를 단에 맞춰 — 1 − (1−base)·몫, 바닥 workCutFloor */
export const cutMul = (base: number, lv: number): number => Math.max(P.realm.workCutFloor, 1 - (1 - base) * lvGain(lv))

/**
 * 그 단의 효과를 숫자로 — 화면이 「가을걷이 +30%」처럼 보인다 (형 11-08: "뭘 보고 짓냐 · 수확 15% 이런 거처럼 보기 좋게")
 * 엔진이 쓰는 곱(workMulAt · cutMul · 상단 틈)과 같은 셈이다
 */
export function workEffect(what: WorkWhat, lv: number): string {
  const R = P.realm
  const up = (base: number): string => `+${Math.round((upMul(base, lv) - 1) * 100)}%`
  const cut = (base: number): string => `−${Math.round((1 - cutMul(base, lv)) * 100)}%`
  switch (what) {
    case 'paddy': return `가을걷이 ${up(R.workPaddyMul)}`
    case 'saltpan': return `소금 ${up(R.workGoodMul)}`
    case 'smelter': return `쇠 ${up(R.workSmelterMul)}`
    case 'lumber': return `나무 ${up(R.workGoodMul)}`
    case 'ranch': return `말 ${up(R.workGoodMul)}`
    case 'yard': return `징병 ${up(R.workYardMul)}`
    case 'market': return `상단 ${Math.round((1 - Math.pow(R.workMarketEvery, lv)) * 100)}% 더 자주 · 물건 +${lv}`
    case 'smithy': return `무장 올리는 쇠 ${cut(R.workSmithyArm)}`
    case 'jeotgal': return `원정 소금 ${cut(R.workJeotgalSalt2)}`
  }
}

/** 그 나라가 가진 이 일터 가운데 가장 높은 단 (없으면 0) */
export function bestWorkLv(r: Realm, faction: string, what: WorkWhat): number {
  let best = 0
  for (const n of Object.values(r.nodes)) if (n.owner === faction) best = Math.max(best, lvOf(n, what))
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
  const lv = lvOf(n, what)
  if (lv === 0 && worksOf(n).length >= lotCap(n)) return `터가 다 찼다 (${n.kind === 'capital' ? '도읍' : '이 고을'} 터 ${lotCap(n)}곳)`
  if (lv >= Math.round(P.realm.workLvMax)) return '다 올렸다'
  if ((r.builds ?? []).some((b) => b.node === node) || (r.works ?? []).some((w) => w.node === node) || (r.clears ?? []).some((c) => c.node === node)) return '짓는 중이다'
  if (!d.land(r, n)) return '이 땅에 맞지 않는다'
  if (lv === 0 && d.needs !== undefined && !hasWork(r, faction, d.needs)) return `${josa(WORKS[d.needs].name, '이', '가')} 먼저 있어야 한다`
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
  return lvOf(n, what) + 1
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
  if (n === undefined) return 1
  const R = P.realm
  // 터마다 일터 — 그 효과를 내는 일터의 단으로 (없으면 1)
  if (what === 'harvest') return upMul(R.workPaddyMul, lvOf(n, 'paddy'))
  if (what === 'draft') return upMul(R.workYardMul, lvOf(n, 'yard'))
  if (what === 'salt') return upMul(R.workGoodMul, lvOf(n, 'saltpan'))
  if (what === 'iron') return upMul(R.workSmelterMul, lvOf(n, 'smelter'))
  if (what === 'wood') return upMul(R.workGoodMul, lvOf(n, 'lumber'))
  if (what === 'horse') return upMul(R.workGoodMul, lvOf(n, 'ranch'))
  return 1
}
