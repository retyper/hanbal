/**
 * 판 해금 (형 2026-10-19: "처음부터 많은국가 하면 어디가 어느나라인지 어려우니까 작은지도부터 해금될수 있게") —
 * 배우는 판 → 작은 판(변한) → 영남 → 삼한 남부 → 삼한과 북녘. 앞 판을 한 번 이기면 다음 판이 열린다 (배우는 판은 끝내거나 그만둬도).
 * 기록은 이 기기에만 (판 저장처럼). 이미 어느 판을 하고 있는 사람은 그 판까지 열린 것으로 친다 — 지금 판을 잃지 않게.
 */
import { josa } from '../../realm/data/prose.ts'
import type { RegionId } from '../../realm/types.ts'
import { CHAPTERS } from '../../realm/data/campaign.ts'
import { TIER_MAX } from '../../realm/tier.ts'

export const BOARD_ORDER: readonly RegionId[] = ['tutorial', 'byeonhan-mini', 'yeongnam', 'south', 'world']
const KEY = 'hanbal.realm.unlock'

interface Rec {
  won: RegionId[]
  tutorial?: 'done' | 'quit'
  /** 판마다 이긴 가장 높은 난세 단계 (tier.ts) — 그다음 단계가 열린다 */
  tiers?: Partial<Record<RegionId, number>>
  /** 나라마다 이긴 가장 높은 난세 단계 — 휘장 (META §2-①: 문명의 "이 지도자로 이겨 봤다"). 열쇠는 `판/나라` */
  nations?: Record<string, number>
}

function load(): Rec {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<Rec> | null
    const won = Array.isArray(v?.won) ? v.won.filter((x) => BOARD_ORDER.includes(x) || CHAPTERS.some((c) => c.region === x)) : []
    const tiers: Partial<Record<RegionId, number>> = {}
    // 단계가 열에서 일곱으로 줄었다 (10-23) — 옛 7~10 단계는 가장 높은 단계로 친다
    for (const b of BOARD_ORDER) { const t = v?.tiers?.[b]; if (typeof t === 'number' && t >= 1) tiers[b] = Math.min(TIER_MAX, Math.floor(t)) }
    // 난세 단계가 생기기 전에 이긴 판은 1단계를 이긴 것으로 친다
    for (const b of won) tiers[b] ??= 1
    const nations: Record<string, number> = {}
    for (const [key, t] of Object.entries(v?.nations ?? {})) if (typeof t === 'number' && t >= 1) nations[key] = Math.min(TIER_MAX, Math.floor(t))
    return { won, tiers, nations, ...(v?.tutorial !== undefined ? { tutorial: v.tutorial } : {}) }
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
  // 캠페인의 장 — 앞 장을 이기면 다음 장 (형 10-23: "1장 깼는데 2장 안 열림"). 자유 판의 차례와 따로 간다
  for (let i = 1; i < CHAPTERS.length; i++) {
    const c = CHAPTERS[i]!
    const prev = CHAPTERS[i - 1]!.region
    if (c.region === null || prev === null) continue
    // 이미 깬 장은 앞에 장이 끼어들어도 그대로 열려 있다 (10-25 1장 마한이 0장과 주몽 사이에 들어왔다)
    if (won.includes(prev) || (prev === 'tutorial' && tutorialOver) || playing === c.region || won.includes(c.region)) out.add(c.region)
  }
  return out
}

export function markWon(region: RegionId, tier = 1, nation?: string): void {
  const r = load()
  // 쉬움(촌장, 0)으로 이기면 다음 판은 열리지만 휘장과 다음 단계는 안 열린다 — 보통(군장)부터가 이긴 것
  const t = Math.min(TIER_MAX, Math.floor(tier))
  if (nation !== undefined && region !== 'tutorial' && t >= 1) {
    const ns = (r.nations ??= {})
    const key = `${region}/${nation}`
    ns[key] = Math.max(ns[key] ?? 0, t)
  }
  if (!r.won.includes(region)) r.won.push(region)
  const tiers = (r.tiers ??= {})
  if (t >= 1) tiers[region] = Math.max(tiers[region] ?? 0, t)
  if (region === 'tutorial') r.tutorial = 'done'
  save(r)
}

export function markTutorialOver(how: 'done' | 'quit'): void {
  const r = load()
  if (r.tutorial !== 'done') r.tutorial = how
  save(r)
}

/**
 * 그 판에서 고를 수 있는 가장 높은 단계 — 이긴 단계 + 1 (천손까지). 쉬움(촌장)과 보통(군장)은 처음부터.
 * 캠페인의 장은 처음부터 다 열려 있다 — 이야기는 마음대로 고른 세기로 (형 10-23)
 */
export function tierOpen(region: RegionId): number {
  if (region === 'tutorial') return 1
  if (CHAPTERS.some((c) => c.region === region)) return TIER_MAX
  return Math.min(TIER_MAX, (load().tiers?.[region] ?? 0) + 1)
}

/** 그 나라로 이긴 가장 높은 난세 단계 (휘장) — 없으면 0 */
export function nationWon(region: RegionId, nation: string): number {
  return load().nations?.[`${region}/${nation}`] ?? 0
}

/** 휘장의 빛깔 — 단계가 오를수록 짙어진다: 구리(군장) → 은(대가·왕) → 금(대왕·태왕) → 붉은 금(천손) */
export function badgeRank(tier: number): 0 | 1 | 2 | 3 | 4 {
  return tier <= 0 ? 0 : tier === 1 ? 1 : tier <= 3 ? 2 : tier < TIER_MAX ? 3 : 4
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
  const n = names[prev] ?? ''
  return `「${n}」${josa(n, '을', '를').slice(n.length)} ${prev === 'tutorial' ? '끝내면' : '이기면'} 열린다`
}
