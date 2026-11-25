/**
 * 지금 고를 수 있는 것의 목록 (40-cards.md F5a · 30 의 「한 번에 고를 것 넷 이하」) — 순수 함수, 시험이 센다.
 * 아래 띠에는 칸이 늘 넷 보이지만(앞줄 · 활 · 기병 · 장수), 고를 수 있는 것은 **그 무리가 살아 있는 칸**만이다.
 * 칸 상자가 열려 있으면(같은 칸을 다시 누름) 그 상자 안의 것만 센다: 자세 셋 + 알아서 하게.
 */
import type { VModel } from './viewRead.ts'
import type { InputGroup } from './types.ts'

export type Phase = 'ready' | 'play' | 'end'
export interface UiState {
  phase: Phase
  /** 고른 칸 · 없으면 -1 */
  sel: -1 | InputGroup
  /** 자세 상자가 열려 있는가 */
  popup: boolean
}
export type PickKind = 'cell' | 'stance' | 'auto'
export interface PickItem {
  id: string
  kind: PickKind
  g: InputGroup
  /** kind 가 stance 일 때 0 돌격 · 1 방진 · 2 길 트기 */
  stance: 0 | 1 | 2 | -1
}
/** 칸이 못 눌리는 까닭 이름 (말은 화면이 붙인다) */
export type CellWhy = 'gone' | 'none'

export const GRP_OF: readonly string[] = ['front', 'bows', 'horse']

/** 그 칸의 무리가 살아 있는가 (우리 편 · 사람 수 > 0) — 장수는 장수가 있으면 */
export function aliveCell(m: VModel, g: InputGroup): boolean {
  if (g === 3) return m.heroes.some(e => e.side === 0)
  return m.squads.some(q => q.side === 0 && q.grp === GRP_OF[g] && q.men > 0)
}

/** 눌러도 안 되는 칸의 까닭 · 되면 null. none = 처음부터 없는 무리 · gone = 있었는데 다 쓰러짐 */
export function cellWhy(m: VModel, g: InputGroup): CellWhy | null {
  if (aliveCell(m, g)) return null
  if (g === 3) return 'none'
  return m.squads.some(q => q.side === 0 && q.grp === GRP_OF[g]) ? 'gone' : 'none'
}

export function pickables(m: VModel, ui: UiState): PickItem[] {
  if (ui.phase === 'end' || m.end !== null) return []
  if (ui.popup && ui.sel >= 0 && aliveCell(m, ui.sel)) {
    const g = ui.sel
    const out: PickItem[] = []
    if (g === 0) for (const st of [0, 1, 2] as const) out.push({ id: `stance${st}`, kind: 'stance', g, stance: st })
    out.push({ id: 'auto', kind: 'auto', g, stance: -1 })
    return out
  }
  const out: PickItem[] = []
  for (const g of [0, 1, 2, 3] as const) if (aliveCell(m, g)) out.push({ id: `cell${g}`, kind: 'cell', g, stance: -1 })
  return out
}
