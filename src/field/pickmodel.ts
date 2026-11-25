/**
 * 지금 고를 수 있는 것과 맵에서 누른 곳 → 고른 것 (50-control-v2.md) — 순수 함수, 시험이 센다.
 * 고르기는 맵 위의 병사·깃·장수를 누르는 것이 으뜸이고, 아래 띠의 칸(앞줄 · 활 · 기병 · 장수)은 같은 일을 하는 지름길이다.
 * 아무것도 안 고른 상태는 없다: 처음부터 장수가 골라져 있고, 고른 것이 쓰러지면 장수(없으면 남은 무리)로 돌아온다.
 * 명령 단추는 고른 무리(앞줄 셋 · 활 둘 · 기병 넷)의 것만 뜬다 (한 번에 고를 칸 ≤ 4 · 단추 ≤ 4).
 */
import type { VModel } from './viewRead.ts'
import type { InputGroup } from './types.ts'

export type Phase = 'ready' | 'play' | 'end'
export interface UiState {
  phase: Phase
  /** 고른 무리·장수 (g 오름차순 · 늘 하나 이상) */
  sel: readonly InputGroup[]
}
/** 칸이 못 눌리는 까닭 이름 (말은 화면이 붙인다) */
export type CellWhy = 'gone' | 'none'

export const GRP_OF: readonly string[] = ['front', 'bows', 'horse']
export const ALL_GROUPS: readonly InputGroup[] = [0, 1, 2, 3]

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

/** 아래 띠에 보일 칸 (살아 있는 것만 · 끝난 판은 없음) */
export function pickables(m: VModel, ui: UiState): InputGroup[] {
  if (ui.phase === 'end' || m.end !== null) return []
  return ALL_GROUPS.filter(g => aliveCell(m, g))
}

/** 명령 단추를 보일 무리: 고른 것 가운데 살아 있는 첫 무리(앞줄 · 활 · 기병) — 장수만 골랐으면 없다 (단추의 뜻은 input.ts 의 CMDS) */
export function cmdGroup(m: VModel, ui: UiState): 0 | 1 | 2 | null {
  if (ui.phase === 'end' || m.end !== null) return null
  for (const g of ui.sel) if (g < 3 && aliveCell(m, g)) return g as 0 | 1 | 2
  return null
}

/** 고른 것에서 쓰러진 것을 빼고, 비면 장수(없으면 살아 있는 첫 무리)로 돌아온다 — 같으면 같은 줄을 돌려준다 */
export function normalizeSel(m: VModel, sel: readonly InputGroup[]): readonly InputGroup[] {
  const live = sel.filter(g => aliveCell(m, g))
  if (live.length === sel.length && live.length > 0) return sel
  if (live.length > 0) return live
  if (aliveCell(m, 3)) return [3]
  const first = ALL_GROUPS.find(g => aliveCell(m, g))
  return first === undefined ? [3] : [first]
}

/** 맵 위에서 눌러 잡을 수 있는 것 하나 — 화면 px 좌표 · reach 는 그것의 몸집(잡히는 반경에 더한다) */
export interface PickCand { g: InputGroup; x: number; y: number; reach: number }

/**
 * 누른 점 (x, y)(화면 px)에서 가까운 것을 고른다. 반경 안(몸집 포함)에 든 것 가운데 가장 가까운 것 ·
 * 장수는 거리를 heroPermille 로 줄여 쳐서(겹쳐 서 있어도 장수가 먼저) 잡는다. 없으면 -1.
 * 거리는 제곱으로 비교한다 (제곱근을 안 쓴다).
 */
export function pickAt(cands: readonly PickCand[], x: number, y: number, radius: number, heroPermille: number): InputGroup | -1 {
  let best: InputGroup | -1 = -1, bestScore = Infinity
  for (const c of cands) {
    const dx = c.x - x, dy = c.y - y, d2 = dx * dx + dy * dy, r = radius + c.reach
    if (d2 > r * r) continue
    const score = c.g === 3 ? d2 * heroPermille * heroPermille / 1_000_000 : d2
    if (score < bestScore) { bestScore = score; best = c.g }
  }
  return best
}

/** 끌어서 그린 네모(화면 px) 안의 것: 무리가 하나라도 들면 그 무리들 · 없고 장수만 들면 장수 · 아무것도 없으면 빈 줄 */
export function boxPick(cands: readonly PickCand[], x0: number, y0: number, x1: number, y1: number): InputGroup[] {
  const lx = Math.min(x0, x1), hx = Math.max(x0, x1), ly = Math.min(y0, y1), hy = Math.max(y0, y1)
  const groups = new Set<InputGroup>()
  let hero = false
  for (const c of cands) {
    if (c.x < lx || c.x > hx || c.y < ly || c.y > hy) continue
    if (c.g === 3) hero = true
    else groups.add(c.g)
  }
  if (groups.size > 0) return [...groups].sort((a, b) => a - b)
  return hero ? [3] : []
}
