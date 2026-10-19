/**
 * 판 해금 (형 2026-10-19: "처음부터 많은국가 하면 어디가 어느나라인지 어려우니까 작은지도부터 해금될수 있게") —
 * 배우는 판 → 작은 판(변한) → 영남 → 삼한 남부 → 삼한과 북녘. 앞 판을 한 번 이기면 다음 판이 열린다 (배우는 판은 끝내거나 그만둬도).
 * 기록은 이 기기에만 (판 저장처럼). 이미 어느 판을 하고 있는 사람은 그 판까지 열린 것으로 친다 — 지금 판을 잃지 않게.
 */
import type { RegionId } from '../../realm/types.ts'

export const BOARD_ORDER: readonly RegionId[] = ['tutorial', 'byeonhan-mini', 'yeongnam', 'south', 'world']
const KEY = 'hanbal.realm.unlock'

interface Rec { won: RegionId[]; tutorial?: 'done' | 'quit' }

function load(): Rec {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<Rec> | null
    const won = Array.isArray(v?.won) ? v.won.filter((x) => BOARD_ORDER.includes(x)) : []
    return v?.tutorial !== undefined ? { won, tutorial: v.tutorial } : { won }
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

export function markWon(region: RegionId): void {
  const r = load()
  if (!r.won.includes(region)) r.won.push(region)
  if (region === 'tutorial') r.tutorial = 'done'
  save(r)
}

export function markTutorialOver(how: 'done' | 'quit'): void {
  const r = load()
  if (r.tutorial !== 'done') r.tutorial = how
  save(r)
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
