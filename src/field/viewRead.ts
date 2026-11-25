/**
 * 그리는 쪽이 sim 상태를 읽는 단 한 곳. 다른 view*.ts 는 FieldState 를 모르고 이 모양(VModel)만 안다.
 * sim 의 타입이 바뀌면(지형·마디 · F2a) 이 파일만 고친다. 읽기만 한다 — 상태에 대입·push 하지 않는다 (tests/field/view-readonly.test.ts).
 * 좌표는 sim 단위 그대로(unit 당 1칸) — 판 px 로 바꾸는 것은 view.ts.
 */
import type { FieldState } from './types.ts'

export interface VSquad { id: number; side: 0 | 1; grp: string; kind: string; men: number; fresh: number; u: number; v: number; target: number }
export interface VHero { side: 0 | 1; id: string; u: number; v: number; stun: number }
/** 바닥에 놓인 조각 (목책·문 · 땅 규칙은 F2a 가 sim 에 넣는다 · 지금은 늘 빈 배열) */
export interface VPiece { kind: string; u: number; v: number }
export interface VModel {
  tick: number
  /** 맵 길이·폭 (칸) */
  mapU: number; mapW: number
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
    squads: s.squads.map(q => ({ id: q.id, side: q.side, grp: q.grp, kind: q.kind, men: q.men, fresh: q.fresh, u: q.u, v: q.v, target: q.target })),
    heroes: s.heroes.map(e => ({ side: e.side, id: e.id, u: e.u, v: e.v, stun: e.stun })),
    pieces: [],
    end: s.end,
    winner: s.winner,
  }
}
