/**
 * 55 거대 보스 갈래 — 판(haebi.ts)·그림·HUD 가 이무기 · 백두 대호 · 불가사리 · 구미호 · 불의 무녀 장군을 같은 말로 부른다.
 * 이무기 갈래는 예전 haebi.ts 가 하던 셈 그대로(같은 차례 · 같은 난수) — 여울 판과 그 기록은 바이트까지 같다. 백두 대호 갈래도 그대로다.
 * 불가사리(57)만 목책을 넘겨받는다 (등장 길 · 박힘 · 지하 질주 출현).
 */
import { HAEBI_GIANT as GI, HAEBI_TIGER as TG, HAEBI_BULGASARI as BG, HAEBI_GUMIHO as GM, HAEBI_SHAMAN as SH } from '../tune/params.ts'
import { pickContact, sweepContact, closestPoint, type Contact, type PartId, type PartPose, type Point, type Shape } from './giant-core.ts'
import { breakImugiPart, commitImugi, createImugi, endImugi, stepImugi, updateImugiPose, type GiantOwner, type ImugiState } from './imugi.ts'
import { commitTiger, createTiger, damageTigerPart, endTiger, tigerHpOf, staggerTiger, stepTiger, tigerContact, tigerLiveParts, tigerPoseStale, tigerSweep, updateTigerPose, type TigerPartId, type TigerState } from './tiger.ts'
import { bulgasariContact, bulgasariHpOf, bulgasariLiveParts, bulgasariPoseStale, bulgasariSweep, commitBulgasari, createBulgasari, damageBulgasariPart, endBulgasari, staggerBulgasari, stepBulgasari, updateBulgasariPose, type BulgasariPartId, type BulgasariState } from './bulgasari.ts'
import { commitGumiho, createGumiho, damageGumihoPart, endGumiho, gumihoHpOf, gumihoContact, gumihoLiveParts, gumihoPoseStale, gumihoSweep, staggerGumiho, stepGumiho, updateGumihoPose, type GumihoPartId, type GumihoState } from './gumiho.ts'
import { commitShaman, createShaman, damageShamanPart, endShaman, shamanHpOf, shamanContact, shamanLiveParts, shamanPoseStale, shamanSweep, staggerShaman, stepShaman, updateShamanPose, type ShamanPartId, type ShamanState } from './shaman.ts'
import type { Palisade } from './palisade.ts'

export type GiantState = ImugiState | TigerState | BulgasariState | GumihoState | ShamanState
export type GiantKind = GiantState['kind']
/** 화면에 뜨는 이름 (HUD · 격파 알림) */
export const GIANT_NAMES: Readonly<Record<GiantKind, string>> = { imugi: '이무기', tiger: '백두 대호', bulgasari: '불가사리', gumiho: '구미호', shaman: '불의 무녀 장군' }
export const giantName = (g: GiantState) => GIANT_NAMES[g.kind]
export const giantEntrySeconds = (g: GiantState) => g.kind === 'tiger' ? TG.entrySeconds : g.kind === 'bulgasari' ? BG.entrySeconds : g.kind === 'gumiho' ? GM.entrySeconds : g.kind === 'shaman' ? SH.entrySeconds : GI.entrySeconds
/** 10분 중간 보스 체력 몫 */
export const giantMidHpScale = (kind: GiantKind) => kind === 'tiger' ? TG.midHpScale : kind === 'bulgasari' ? BG.midHpScale : kind === 'gumiho' ? GM.midHpScale : kind === 'shaman' ? SH.midHpScale : GI.midHpScale
export const giantMaxHp = (kind: GiantKind) => kind === 'tiger' ? TG.hp : kind === 'bulgasari' ? BG.hp : kind === 'gumiho' ? GM.hp : kind === 'shaman' ? SH.hp : GI.hp
/** wall·playerX 는 불가사리만 쓴다 (큰 문으로 들어오는 길 · 장수 쪽을 본다) */
export const createGiant = (kind: GiantKind, e: GiantOwner, tick: number, wall?: Palisade, playerX?: number): GiantState => kind === 'tiger' ? createTiger(e, tick) : kind === 'bulgasari' ? createBulgasari(e, tick, wall, playerX ?? e.x) : kind === 'gumiho' ? createGumiho(e, tick) : kind === 'shaman' ? createShaman(e, tick) : createImugi(e, tick)

const imugiLive = (g: ImugiState) => g.pose.parts.filter(p => g.partHP[p.id] > 0 || p.id === 'head' || p.id === 'root')
/** 맞을 수 있는(부서지지 않은) 부위 */
export const giantLiveParts = (g: GiantState): readonly PartPose<string>[] => g.kind === 'tiger' ? tigerLiveParts(g) : g.kind === 'bulgasari' ? bulgasariLiveParts(g) : g.kind === 'gumiho' ? gumihoLiveParts(g) : g.kind === 'shaman' ? shamanLiveParts(g) : imugiLive(g)
export const giantContact = (g: GiantState, shape: Shape): Contact<string> | null => g.kind === 'tiger' ? tigerContact(g, shape) : g.kind === 'bulgasari' ? bulgasariContact(g, shape) : g.kind === 'gumiho' ? gumihoContact(g, shape) : g.kind === 'shaman' ? shamanContact(g, shape) : pickContact({ ...g.pose, parts: imugiLive(g) }, shape)
export const giantSweep = (g: GiantState, from: Point, to: Point, radius: number): Contact<string> | null => g.kind === 'tiger' ? tigerSweep(g, from, to, radius) : g.kind === 'bulgasari' ? bulgasariSweep(g, from, to, radius) : g.kind === 'gumiho' ? gumihoSweep(g, from, to, radius) : g.kind === 'shaman' ? shamanSweep(g, from, to, radius) : sweepContact({ ...g.pose, parts: imugiLive(g) }, from, to, radius)
/** 겨눌 부위 (보이고 · 맞을 수 있고 · 부서지지 않은) */
export const giantAimParts = (g: GiantState): readonly PartPose<string>[] => giantLiveParts(g).filter(p => p.targetable && !p.broken)
export const giantHasTarget = (g: GiantState) => (g.pose.parts as readonly PartPose<string>[]).some(p => p.targetable && !p.broken)
export const giantPart = (g: GiantState, id: string): PartPose<string> | undefined => (g.pose.parts as readonly PartPose<string>[]).find(p => p.id === id)
/** 부위 체력 칸의 이름 (몸통·뿌리처럼 체력 칸이 없는 조각은 null) — 64-BREAK 몸통 피해 번짐 */
export function giantHpKey(g: GiantState, id: string): string | null {
  if (g.kind === 'tiger') return tigerHpOf(id as TigerPartId)
  if (g.kind === 'bulgasari') return bulgasariHpOf(id as BulgasariPartId)
  if (g.kind === 'gumiho') return gumihoHpOf(id as GumihoPartId)
  if (g.kind === 'shaman') return shamanHpOf(id as ShamanPartId)
  return id in g.partHP ? id : null
}
/** 맞은 자리에서 가장 가까운, 아직 성한 부위 조각 (없으면 null) */
export function nearestLiveHpPart(g: GiantState, at: Point): { id: string; d: number } | null {
  let best: { id: string; d: number } | null = null
  const hp = g.partHP as Record<string, number>
  for (const p of g.pose.parts as readonly PartPose<string>[]) {
    const key = giantHpKey(g, p.id); if (key === null || !(hp[key]! > 0) || !p.visible) continue
    const q = closestPoint(at, p.collider), d = Math.hypot(q.x - at.x, q.y - at.y)
    if (!best || d < best.d) best = { id: p.id, d }
  }
  return best
}
/** 맞은 부위를 깎는다 · 처음 부서지면 true (백두 대호 · 불가사리 · 구미호 · 불의 무녀 장군 · 아파서 포효한다) */
export function giantStruck(g: GiantState, id: string, amount: number): boolean {
  if (g.kind === 'shaman') return damageShamanPart(g, id as ShamanPartId, amount)
  if (g.kind === 'tiger') return damageTigerPart(g, id as TigerPartId, amount)
  if (g.kind === 'bulgasari') return damageBulgasariPart(g, id as BulgasariPartId, amount)
  if (g.kind === 'gumiho') return damageGumihoPart(g, id as GumihoPartId, amount)
  const part = id as PartId
  g.partHP[part] = Math.max(0, g.partHP[part] - amount); g.lastHitPart = part
  breakImugiPart(g, part); return false
}
/** 회복 중 첫 타격 (백두 대호·불가사리·구미호·무녀 장군은 움찔해 회복이 조금 늘어난다) */
export function giantRecoveryHit(g: GiantState): void { g.recoveryHitUsed = true; if (g.kind === 'tiger') staggerTiger(g); else if (g.kind === 'bulgasari') staggerBulgasari(g); else if (g.kind === 'gumiho') staggerGumiho(g); else if (g.kind === 'shaman') staggerShaman(g) }
export function giantPoisonFromLastHit(g: GiantState): void { if (g.kind === 'tiger') g.poisonPart = g.lastHitPart; else if (g.kind === 'bulgasari') g.poisonPart = g.lastHitPart; else if (g.kind === 'gumiho') g.poisonPart = g.lastHitPart; else if (g.kind === 'shaman') g.poisonPart = g.lastHitPart; else g.poisonPart = g.lastHitPart }
/** wall·smash: 목책 돌파 판의 목책과 그 마디를 깎는 손 (불가사리만 쓴다) */
export interface GiantStep { dt: number; tick: number; player: Point; speed: number; dazed: boolean; random: () => number; wall?: Palisade; smash?: (index: number, amount: number, x: number) => void }
export const stepGiant = (g: GiantState, e: GiantOwner, input: GiantStep) => g.kind === 'tiger' ? stepTiger(g, e, input) : g.kind === 'bulgasari' ? stepBulgasari(g, e, input) : g.kind === 'gumiho' ? stepGumiho(g, e, input) : g.kind === 'shaman' ? stepShaman(g, e, input) : stepImugi(g, e, input)
/** push: 포효 눈보라가 장수를 밀어낸다 (백두 대호) · 쇠붙이 흡수가 끌어당긴다 (불가사리) */
export function commitGiant(g: GiantState, e: GiantOwner, player: Point, hurt: (damage: number) => void, dazed: boolean, push: (dx: number, dy: number) => void): void {
  if (g.kind === 'tiger') commitTiger(g, e, player, hurt, dazed, push); else if (g.kind === 'bulgasari') commitBulgasari(g, e, player, hurt, dazed, push); else if (g.kind === 'gumiho') commitGumiho(g, e, player, hurt, dazed); else if (g.kind === 'shaman') commitShaman(g, e, player, hurt, dazed); else commitImugi(g, e, player, hurt, dazed)
}
/** 이번 걸음에 부서진 부위를 자세에 반영 */
export function syncGiantPose(g: GiantState, e: GiantOwner, tick: number): void {
  if (g.kind === 'tiger') { if (tigerPoseStale(g)) updateTigerPose(g, e, tick) }
  else if (g.kind === 'bulgasari') { if (bulgasariPoseStale(g)) updateBulgasariPose(g, e, tick) }
  else if (g.kind === 'gumiho') { if (gumihoPoseStale(g)) updateGumihoPose(g, e, tick) }
  else if (g.kind === 'shaman') { if (shamanPoseStale(g)) updateShamanPose(g, e, tick) }
  else if (g.pose.parts.some(p => p.damaged !== (g.partHP[p.id] <= 0))) updateImugiPose(g, e, tick)
}
export const endGiant = (g: GiantState, e: GiantOwner, tick: number) => g.kind === 'tiger' ? endTiger(g, e, tick) : g.kind === 'bulgasari' ? endBulgasari(g, e, tick) : g.kind === 'gumiho' ? endGumiho(g, e, tick) : g.kind === 'shaman' ? endShaman(g, e, tick) : endImugi(g, e, tick)
