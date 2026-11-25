/**
 * 그리는 쪽이 sim 상태를 읽는 단 한 곳. 다른 view*.ts 는 FieldState 를 모르고 이 모양(VModel)만 안다.
 * sim 의 타입이 바뀌면 이 파일만 고친다. 읽기만 한다 — 상태에 대입·push 하지 않는다 (tests/field/view-readonly.test.ts).
 * 좌표는 sim 단위 그대로(unit 당 1칸) — 판 px 로 바꾸는 것은 view.ts. 조각(Piece)의 좌표는 칸 단위다.
 */
import type { FieldState } from './types.ts'

export interface VSquad { id: number; side: 0 | 1; grp: string; kind: string; men: number; fresh: number; u: number; v: number; target: number }
export interface VHero { side: 0 | 1; id: string; u: number; v: number; stun: number }
/** 바닥에 놓인 조각 (목책 마디·문) — 칸 단위 · hp 0 이하면 부서진 것 */
export interface VPiece { id: number; kind: 'stake' | 'gate'; u0: number; v0: number; u1: number; v1: number; hp: number }
export interface VModel {
  tick: number
  /** 맵 길이·폭 (칸) */
  mapU: number; mapW: number
  /** 칸마다 바닥 종류 cells[cu * mapW + cv] (0 평지 · 1 얕은 물 · 2 깊은 물 · 3 막힘 · 4 높은 터) — 읽기만 한다 */
  cells: Readonly<Uint8Array>
  rule: string
  squads: VSquad[]
  heroes: VHero[]
  pieces: VPiece[]
  end: string | null
  winner: number
}

export function readField(s: FieldState): VModel {
  return {
    tick: s.tick,
    mapU: s.map.u, mapW: s.map.w,
    cells: s.map.cells,
    rule: s.map.rule,
    squads: s.squads.map(q => ({ id: q.id, side: q.side, grp: q.grp, kind: q.kind, men: q.men, fresh: q.fresh, u: q.u, v: q.v, target: q.target })),
    heroes: s.heroes.map(e => ({ side: e.side, id: e.id, u: e.u, v: e.v, stun: e.stun })),
    pieces: s.map.pieces.map(p => ({ id: p.id, kind: p.kind, u0: p.u0, v0: p.v0, u1: p.u1, v1: p.v1, hp: p.hp })),
    end: s.end,
    winner: s.winner,
  }
}
