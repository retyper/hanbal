/**
 * 판 해금 (형 2026-10-19: "처음부터 많은국가 하면 어디가 어느나라인지 어려우니까 작은지도부터 해금될수 있게") —
 * 배우는 판 → 작은 판(변한) → 영남 → 삼한 남부 → 삼한과 북녘. 앞 판을 한 번 이기면 다음 판이 열린다 (배우는 판은 끝내거나 그만둬도).
 * 기록은 이 기기에만 (판 저장처럼). 이미 어느 판을 하고 있는 사람은 그 판까지 열린 것으로 친다 — 지금 판을 잃지 않게.
 */
import type { RegionId } from '../../realm/types.ts'

export const BOARD_ORDER: readonly RegionId[] = ['tutorial', 'byeonhan-mini', 'yeongnam', 'south', 'world']
const KEY = 'hanbal.realm.unlock'

interface Rec {
  won: RegionId[]
  tutorial?: 'done' | 'quit'
  /** 판마다 이긴 가장 높은 난세 단계 (tier.ts) — 그다음 단계가 열린다 */
  tiers?: Partial<Record<RegionId, number>>
}

function load(): Rec {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<Rec> | null
    const won = Array.isArray(v?.won) ? v.won.filter((x) => BOARD_ORDER.includes(x)) : []
    const tiers: Partial<Record<RegionId, number>> = {}
    for (const b of BOARD_ORDER) { const t = v?.tiers?.[b]; if (typeof t === 'number' && t >= 1) tiers[b] = Math.floor(t) }
    // 난세 단계가 생기기 전에 이긴 판은 1단계를 이긴 것으로 친다
    for (const b of won) tiers[b] ??= 1
    return { won, tiers, ...(v?.tutorial !== undefined ? { tutorial: v.tutorial } : {}) }
  } catch {
    return { won: [] }
  }
}

function save(r: Rec): void {
  try { localStorage.setItem(KEY, JSON.stringify(r)) } catch { /* 저장 못 하는 곳 */ }
}

/** 열린 판 — `playing` 은 지금 저장된 판의 판 (없으면 null) */
export function unlockedBoards(playing: RegionId | null): Set<RegionId> {
  const r = load()
  return unlockedFrom(r.won, r.tutorial !== undefined, playing)
}

/** 순수한 셈 — 시험이 쓴다 */
export function unlockedFrom(won: readonly RegionId[], tutorialOver: boolean, playing: RegionId | null): Set<RegionId> {
  const out = new Set<RegionId>(['tutorial'])
  const reach = playing === null ? -1 : BOARD_ORDER.indexOf(playing)
  for (let i = 1; i < BOARD_ORDER.length; i++) {
    const prev = BOARD_ORDER[i - 1]!
    const open = i <= reach || won.includes(prev) || (prev === 'tutorial' && (tutorialOver || reach >= 1 || won.length > 0))
    if (!open) break
    out.add(BOARD_ORDER[i]!)
  }
  return out
}

export function markWon(region: RegionId, tier = 1): void {
  const r = load()
  if (!r.won.includes(region)) r.won.push(region)
  const tiers = (r.tiers ??= {})
  tiers[region] = Math.max(tiers[region] ?? 0, Math.max(1, Math.floor(tier)))
  if (region === 'tutorial') r.tutorial = 'done'
  save(r)
}

export function markTutorialOver(how: 'done' | 'quit'): void {
  const r = load()
  if (r.tutorial !== 'done') r.tutorial = how
  save(r)
}

/** 그 판에서 고를 수 있는 가장 높은 난세 단계 — 이긴 단계 + 1 (10 까지) */
export function tierOpen(region: RegionId): number {
  if (region === 'tutorial') return 1
  return Math.min(10, (load().tiers?.[region] ?? 0) + 1)
}

/** 그 판에서 이긴 가장 높은 단계 — 없으면 0 */
export function tierWon(region: RegionId): number {
  return load().tiers?.[region] ?? 0
}

export function tutorialOver(): boolean {
  return load().tutorial !== undefined
}

/** 잠긴 판의 까닭 — "○○ 판을 이기면 열린다" */
export function lockWhy(region: RegionId, names: Readonly<Partial<Record<RegionId, string>>>): string {
  const i = BOARD_ORDER.indexOf(region)
  const prev = i > 0 ? BOARD_ORDER[i - 1]! : null
  if (prev === null) return ''
  return prev === 'tutorial' ? '배우는 판을 끝내면 열린다' : `${names[prev] ?? ''} 판을 이기면 열린다`
}
