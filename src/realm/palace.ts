/**
 * 도읍 — 궁궐 네 단 · 조정 세 자리 (docs/realm/CAPITAL.md §1-1 · §1-2 · 카드 P1)
 *
 * 1. 궁궐: 1 군장의 큰 집 → 2 큰 마루 집 → 3 목책 궁 → 4 토성 궁성. 단 하나를 올리려면 palaceStages 번 나눠 붓는다
 *    (곡식 + 나무 · 3단부터 쇠). 값은 나라의 그릇(realmScale)을 따라 커진다 — 후반의 곡식이 들어갈 곳.
 *    도읍을 잃으면 한 단 내려온다 (불탄 궁). 4단 도읍은 지킴이 한 단 더 든든하다 (RNode.walled).
 * 2. 조정: 재상(2단~) · 대장군(2단~) · 천군(3단~). 장수 하나를 앉히면 그 장수는 도읍에 머물고(출정·맡기기에서 빠진다)
 *    그 능력치로 나라 전체에 작은 힘이 걸린다. 계절마다 앉은 장수와 군주의 정이 오른다.
 *
 * 판 상태만 읽고 쓴다 · 굴림 없음 (결정론 A1). AI 나라는 아직 안 쓴다.
 */
import { P } from '../tune/params.ts'
import { seasons } from './calendar.ts'
import { addGood, goodOf, stockOf } from './economy.ts'
import { addBond } from './heroes.ts'
import { realmScale } from './scale.ts'
import type { Hero, Order, Realm, ReportLine } from './types.ts'

export type Seat = 'chancellor' | 'general' | 'priest'
export const SEATS: readonly Seat[] = ['chancellor', 'general', 'priest']
export type PalaceTier = 1 | 2 | 3 | 4

export const PALACE_NAME: Readonly<Record<PalaceTier, string>> = { 1: '군장의 큰 집', 2: '큰 마루 집', 3: '목책 궁', 4: '토성 궁성' }

export interface SeatDef {
  readonly name: string
  /** 앉으려면 궁궐 몇 단 */
  readonly tier: PalaceTier
  /** 셈하는 능력치 */
  readonly stat: 'chi' | 'mu' | 'deok'
  /** 화면 아이콘 (그림 오기 전엔 이모지) */
  readonly emoji: string
  readonly icon: string
}

export const SEAT_DEFS: Readonly<Record<Seat, SeatDef>> = {
  chancellor: { name: '재상', tier: 2, stat: 'chi', emoji: '📜', icon: 'seat-chancellor' },
  general: { name: '대장군', tier: 2, stat: 'mu', emoji: '🪓', icon: 'seat-general' },
  priest: { name: '천군', tier: 3, stat: 'deok', emoji: '🔔', icon: 'seat-priest' },
}

// ───────── 궁궐

export const palaceTier = (r: Realm, f: string): PalaceTier => r.factions[f]?.palace?.tier ?? 1

/** 이 단으로 올리는 값 — 한 번 붓는 몫 (합계를 palaceStages 로 나눈다 · 나라의 그릇만큼) */
export function palaceCost(r: Realm, f: string, to: PalaceTier = (palaceTier(r, f) + 1) as PalaceTier): { grain: number; wood: number; iron: number } {
  const R = P.realm
  const s = realmScale(r, f)
  const stages = Math.max(1, Math.round(R.palaceStages))
  const grain = to === 2 ? R.palaceGrain2 : to === 3 ? R.palaceGrain3 : R.palaceGrain4
  const iron = to === 3 ? R.palaceIron3 : to === 4 ? R.palaceIron4 : 0
  return { grain: Math.round((grain * s) / stages), wood: Math.round((grain * R.palaceWoodShare * s) / stages), iron: Math.round((iron * s) / stages) }
}

/** 지금 한 번을 붓지 못하는 까닭 — 되면 null (곳간은 따로 · canPalace) */
export function palaceBlocked(r: Realm, f: string): string | null {
  const fac = r.factions[f]
  if (fac === undefined) return '나라가 없습니다'
  if (r.region === 'tutorial') return '배우는 판에서는 짓지 않습니다'
  const tier = palaceTier(r, f)
  if (tier >= 4) return '이미 토성 궁성입니다'
  if (r.scenario !== undefined && tier >= 2) return '이 이야기에서는 큰 마루 집까지 짓습니다'
  if (r.nodes[fac.capital]?.owner !== f) return '도읍이 있어야 합니다'
  if (fac.palace?.busy !== undefined) return '한 번을 쌓는 중입니다'
  return null
}

export function canPalace(r: Realm, f: string): boolean {
  if (palaceBlocked(r, f) !== null) return false
  const c = palaceCost(r, f)
  const s = stockOf(r, f)
  return s.grain >= c.grain && goodOf(s, 'wood') >= c.wood && s.iron >= c.iron
}

/** 한 번을 붓는다 */
export function applyPalace(r: Realm, o: Extract<Order, { kind: 'palace' }>, lines: ReportLine[]): void {
  if (!canPalace(r, o.faction)) return
  const fac = r.factions[o.faction]!
  const c = palaceCost(r, o.faction)
  stockOf(r, o.faction).grain -= c.grain
  stockOf(r, o.faction).iron -= c.iron
  addGood(r, o.faction, 'wood', -c.wood)
  const p = (fac.palace ??= { tier: 1, stage: 0 })
  p.busy = r.season + Math.max(1, seasons(r, P.realm.palaceStageSeasons)) - 1
  lines.push({ kind: 'palace', faction: o.faction, ev: 'pour', tier: p.tier + 1, stage: p.stage + 1, grain: c.grain })
}

/** 4단 도읍 표시 — 성벽 한 단 (season.fortMul 이 읽는다) */
function setWall(r: Realm, f: string, on: boolean): void {
  const cap = r.factions[f]?.capital
  const n = cap !== undefined ? r.nodes[cap] : undefined
  if (n === undefined) return
  if (on) n.walled = true
  else delete n.walled
}

export const seatOpen = (r: Realm, f: string, seat: Seat): boolean => palaceTier(r, f) >= SEAT_DEFS[seat].tier

// ───────── 조정

/** 이 장수가 앉은 자리 — 없으면 null (출정·맡기기에서 빠진다) */
export function heroSeat(r: Realm, id: string): Seat | null {
  const h = r.heroes[id]
  const seats = h !== undefined ? r.factions[h.faction]?.seats : undefined
  if (seats === undefined) return null
  for (const s of SEATS) if (seats[s] === id) return s
  return null
}

/** 그 자리에 앉아 힘을 거는 장수 — 비었거나 앉을 수 없는 몸이면 null */
export function seatHero(r: Realm, f: string, seat: Seat): Hero | null {
  const id = r.factions[f]?.seats?.[seat]
  const h = id !== undefined ? r.heroes[id] : undefined
  return h !== undefined && h.faction === f && h.status === 'free' && seatOpen(r, f, seat) ? h : null
}

const statOf = (r: Realm, f: string, seat: Seat): number => {
  const h = seatHero(r, f, seat)
  return h === null ? 0 : h[SEAT_DEFS[seat].stat]
}

/** 앉힐 수 없는 까닭 — 되면 null. hero null 은 비우기 (늘 된다) */
export function seatBlocked(r: Realm, f: string, seat: Seat, hero: string | null): string | null {
  if (r.factions[f] === undefined) return '나라가 없습니다'
  if (hero === null) return r.factions[f]?.seats?.[seat] === undefined ? '비어 있습니다' : null
  if (!seatOpen(r, f, seat)) return `궁궐 ${SEAT_DEFS[seat].tier}단부터 앉힙니다`
  const h = r.heroes[hero]
  if (h === undefined || h.faction !== f) return '우리 장수가 아닙니다'
  if (h.status !== 'free') return '앉을 수 없는 몸입니다'
  if (r.factions[f]!.ruler === h.id) return '군주는 앉지 않습니다'
  if (Object.values(r.armies).some((a) => a.hero === h.id)) return '군대를 이끌고 있습니다'
  if ((r.expeditions ?? []).some((x) => x.hero === h.id) || (h.awayUntil !== undefined && h.awayUntil >= r.season)) return '길 위에 있습니다'
  if (h.woundedUntil !== undefined && h.woundedUntil > r.season) return '다쳐 누웠습니다'
  const cap = r.factions[f]!.capital
  if (r.nodes[cap]?.owner !== f) return '도읍이 있어야 합니다'
  return null
}

export function applySeat(r: Realm, o: Extract<Order, { kind: 'seat' }>, lines: ReportLine[]): void {
  if (seatBlocked(r, o.faction, o.seat, o.hero) !== null) return
  const fac = r.factions[o.faction]!
  if (o.hero === null) {
    const was = fac.seats?.[o.seat]
    if (fac.seats !== undefined) delete fac.seats[o.seat]
    if (was !== undefined) lines.push({ kind: 'seat', faction: o.faction, seat: o.seat, left: was })
    return
  }
  const seats = (fac.seats ??= {})
  for (const s of SEATS) if (seats[s] === o.hero) delete seats[s] // 한 장수는 한 자리
  seats[o.seat] = o.hero
  const h = r.heroes[o.hero]!
  h.post = null
  h.at = fac.capital // 도읍에 머문다
  lines.push({ kind: 'seat', faction: o.faction, seat: o.seat, hero: o.hero })
}

/** 대신 뽑기를 켜고 끈다 — 대장군이 앉아 있어야 켜진다 */
export function applyAutoDraft(r: Realm, o: Extract<Order, { kind: 'autoDraft' }>): void {
  const fac = r.factions[o.faction]
  if (fac === undefined) return
  if (o.on && seatHero(r, o.faction, 'general') === null) return
  if (o.on) fac.autoDraft = true
  else delete fac.autoDraft
}

/** 대신 뽑기가 돌고 있나 — 켜졌고 대장군이 앉아 있다 */
export const autoDraftOn = (r: Realm, f: string): boolean => r.factions[f]?.autoDraft === true && seatHero(r, f, 'general') !== null

// ───────── 자리의 힘 (각 시스템의 셈 자리에 곱·덧셈으로)

/** 재상 — 일터 소출 곱 (논·소금밭·쇠부리터·목수 마을·말 목장) */
export const seatWorkMul = (r: Realm, f: string | null): number => (f === null ? 1 : 1 + statOf(r, f, 'chancellor') * P.realm.seatChi)
/** 대장군 — 새로 뽑는 군사의 사기 덧 */
export const seatMorale = (r: Realm, f: string): number => statOf(r, f, 'general') * P.realm.seatMuMorale
/** 대장군 — 징병 곡식 곱 (낮을수록 싸다) */
export const seatDraftMul = (r: Realm, f: string): number => Math.max(P.realm.seatDraftFloor, 1 - statOf(r, f, 'general') * P.realm.seatMuGrain)
/** 천군 — 제사 힘 곱 */
export const seatRiteMul = (r: Realm, f: string): number => 1 + statOf(r, f, 'priest') * P.realm.seatDeokRite
/** 천군 — 나쁜 사건 카드가 오는 몫 곱 */
export const seatOmenMul = (r: Realm, f: string): number => Math.max(0.3, 1 - statOf(r, f, 'priest') * P.realm.seatDeokOmen)

/** 그 장수가 이 자리에 앉으면 걸릴 힘 — 화면 미리보기 (엔진이 쓰는 값과 같은 셈 · 칩마다 한 줄) */
export function seatFx(seat: Seat, h: Hero): string[] {
  const R = P.realm
  const pct = (v: number): number => Math.round(v * 1000) / 10
  switch (seat) {
    case 'chancellor': return [`일터 소출 +${pct(h.chi * R.seatChi)}%`]
    case 'general': return [`새 군사 사기 +${pct(h.mu * R.seatMuMorale)}%`, `징병 곡식 −${pct(Math.min(1 - R.seatDraftFloor, h.mu * R.seatMuGrain))}%`]
    case 'priest': return [`제사 힘 +${pct(h.deok * R.seatDeokRite)}%`, `흉조 −${pct(Math.min(0.7, h.deok * R.seatDeokOmen))}%`]
  }
}

/** 도읍 지킴 배수 — 4단 궁궐 (fortMul 이 노드 표시로 읽는다) */
export const palaceWall = (n: { readonly walled?: true }): number => (n.walled === true ? P.realm.palaceFort : 1)

// ───────── 턴마다

/**
 * 궁궐이 오르고 · 도읍을 잃으면 내려오고 · 조정이 정리되고 · 계절 끝에 앉은 장수와 정이 오른다 (턴마다 · stepWonders 곁)
 */
export function stepPalace(r: Realm, lines: ReportLine[], end: boolean): void {
  for (const f of Object.keys(r.factions).sort()) {
    const fac = r.factions[f]!
    const p = fac.palace
    if (p === undefined && fac.seats === undefined) continue
    const capOwned = r.nodes[fac.capital]?.owner === f
    if (p !== undefined) {
      if (!capOwned) {
        if (p.lost !== true) {
          p.lost = true
          delete p.busy
          p.stage = 0
          if (p.tier > 1) {
            p.tier = (p.tier - 1) as PalaceTier
            setWall(r, f, false)
            lines.push({ kind: 'palace', faction: f, ev: 'fall', tier: p.tier, stage: 0 })
          }
        }
      } else {
        if (p.lost === true) delete p.lost
        if (p.busy !== undefined && p.busy <= r.season) {
          p.stage += 1
          delete p.busy
          if (p.stage >= Math.round(P.realm.palaceStages)) {
            p.stage = 0
            p.tier = Math.min(4, p.tier + 1) as PalaceTier
            if (p.tier === 4) setWall(r, f, true)
            lines.push({ kind: 'palace', faction: f, ev: 'done', tier: p.tier, stage: 0 })
          } else lines.push({ kind: 'palace', faction: f, ev: 'stage', tier: p.tier + 1, stage: p.stage })
        }
      }
    }
    // 조정 정리 — 단이 내려왔거나 장수가 떠나거나 다쳐 못 앉으면 자리가 빈다 (다친 몸은 낫는 동안 자리만 지킨다)
    const seats = fac.seats
    if (seats !== undefined) {
      for (const s of SEATS) {
        const id = seats[s]
        if (id === undefined) continue
        const h = r.heroes[id]
        if (h === undefined || h.faction !== f || h.status !== 'free' || !seatOpen(r, f, s)) {
          delete seats[s]
          lines.push({ kind: 'seat', faction: f, seat: s, left: id })
          continue
        }
        // 도읍에 머문다 (도읍을 잃고 피한 조정이면 그 자리에서 버틴다 — 따로 옮기지 않는다)
        if (capOwned && h.at !== null && h.at !== fac.capital && !Object.values(r.armies).some((a) => a.hero === id)) h.at = fac.capital
        if (end && fac.ruler !== undefined && fac.ruler !== id) addBond(r, h, P.realm.seatBond, lines)
      }
      if (Object.keys(seats).length === 0) delete fac.seats
    }
    if (fac.autoDraft === true && seatHero(r, f, 'general') === null) delete fac.autoDraft
  }
}
