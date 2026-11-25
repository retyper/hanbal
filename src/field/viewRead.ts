/**
 * 그리는 쪽이 sim 상태를 읽는 단 한 곳. 다른 view*.ts 는 FieldState 를 모르고 이 모양(VModel)만 안다.
 * sim 의 타입이 바뀌면 이 파일만 고친다. 읽기만 한다 — 상태에 대입·push 하지 않는다 (tests/field/view-readonly.test.ts).
 * 좌표는 sim 단위 그대로(unit 당 1칸) — 판 px 로 바꾸는 것은 view.ts. 조각(Piece)의 좌표는 칸 단위다.
 */
import { P } from '../tune/params.ts'
import type { FieldState } from './types.ts'

/** aim = 지금 싸우는 상대(대 id · 없으면 -1 · 손으로 몰았든 알아서든 같은 뜻) · foe = 「적을 쳐라」로 받은 적 · form = 앞줄 모양 FORM_* · cmd = 활·기병 명령 · lock = 맞물린 적 대 */
export interface VSquad { id: number; side: 0 | 1; grp: string; kind: string; men: number; fresh: number; u: number; v: number; target: number; goal: { u: number; v: number } | null; stance: number; manual: number; aim: number; foe: number; form: number; cmd: number; lock: number; morale: number; morale0: number; order: number; orderTick: number; orderAt: { u: number; v: number } | null; ran: number; bonus: number; hitTick: number; flee: number; bw: number; bd: number; face: number; pushed: number }
/** dir 걷는 방향 · face 보는 쪽 · dash 내닫는 남은 틱 · dashCd/artCd 쿨타임 남은 틱 · artOn 비기 이어지는 틱 · why/whyTick 마지막으로 못 쓴 까닭 · atk 이번 틱에 친 것 · art 비기 이름 · mu/tong 능력치 */
export interface VHero { side: 0 | 1; id: string; u: number; v: number; stun: number; goal: { u: number; v: number } | null; dir: number; face: number; dash: number; dashDir: number; dashCd: number; art: string; artCd: number; artOn: number; why: number; whyTick: number; atk: number; mu: number; tong: number; grit: number }
/** 바닥에 놓인 조각 (목책 마디·문) — 칸 단위 · hp 0 이하면 부서진 것 */
export interface VPiece { id: number; kind: 'stake' | 'gate'; u0: number; v0: number; u1: number; v1: number; hp: number }
/** 방금 돈 틱에 난 부딪힘·무너짐·활 한 번 (kind impact 처음 맞물림 · rout 사기가 꺾임 · volley 활이 쏨 · how 는 impact 의 상성 구분 · 0 보통 1 맞음 2 막힘 · 없으면 0) */
export interface VEvent { kind: 'impact' | 'rout' | 'volley' | 'omen' | 'flankHit' | 'artHit' | 'sideBreak' | 'stand' | 'regroup' | 'heroSkill'; side: 0 | 1; id: number; u: number; v: number; n: number; how: number; to: number; pts: { u: number; v: number }[]; r: number }
/** 친 대 id(장수면 -1) · 맞은 대 id · 줄어든 사람 수 · 종류 */
export interface VLoss { from: number; to: number; n: number; how: number }
/** 편마다 깎인 사기의 까닭별 몫 (천분율 × 사람 · 그 편 menMax 합으로 나누면 깎인 사기 천분율) */
export interface VMoraleBy { arrows: number; melee: number; flank: number; hero: number; domino: number; push: number }
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
  /** 이번 때에 무리별(0~3)로 받은 입력 수 (때가 바뀌는 틱에는 0) */
  used: [number, number, number, number]
  /** 우리 편(0)이 적 쪽으로 가는 방향 (+1 이면 u 가 커지는 쪽) */
  face: 1 | -1
  /** 맵 끝 (sim 단위) */
  mapUUnits: number; mapVUnits: number
  /** 편마다(0 우리 · 1 적) 지기까지 남은 몫 0~1000 — 사기와 사람 수 가운데 문턱에 더 가까운 쪽 (끝 판정과 같은 식 · 그리는 쪽 전용) */
  edge: [number, number]
  /** 방금 돈 틱에 누가 누구를 깎았나 (loss 사건 · how 0 칼 1 화살 2 장수 3 비기 4 부딪힘) · 기병이 도는 길 · 무리가 마지막으로 못 받은 명령의 까닭과 틱 */
  loss: VLoss[]
  events: VEvent[]
  /** 결과 통계 (편마다) · 적의 큰 수를 거는 틱 (편마다 · -1 없음) */
  stats: { flankHits: [number, number]; artMorale: [number, number]; killed: [number, number]; lost: [number, number]; moraleBy: [VMoraleBy, VMoraleBy] }
  /** 편마다 진 LINE_* (0 방패 벽 · 1 창 쐐기 · 2 넓은 날개) · 무너진 틱(-1 아직)과 까닭(1 사람 · 2 사기) · 달아났다 다시 선 적이 있는가 */
  lineup: [number, number]
  breakTick: [number, number]
  breakWhy: [number, number]
  stood: [number, number]
  planTick: [number, number]
  /** 편마다 앞줄이 마지막으로 맞물린 틱 (진 기준점이 얼어 있는가) */
  frontLockTick: [number, number]
  /** 무리 기준 점(깃발) [편 × 3 + 앞줄 0 · 활 1 · 기병 2] */
  anchor: { u: number; v: number }[]
  route: { u: number; v: number }[][]
  grpWhy: [number, number, number]
  grpWhyTick: [number, number, number]
}

/** 끝 판정(sim 의 judge)과 같은 식으로 문턱까지 남은 몫을 센다. 문턱은 본편 값을 읽기만 한다 */
function edgeOf(s: FieldState, side: 0 | 1): number {
  let men = 0, menMax = 0, mw = 0, m0 = 0
  for (const q of s.squads) {
    if (q.side !== side) continue
    menMax += q.menMax; m0 = q.morale0; men += q.men; mw += q.menMax * q.morale
  }
  if (menMax <= 0 || m0 <= 0) return 0
  const morale = mw / menMax
  const byMorale = (morale / m0 - P.realm.tacBreakMorale) / (1 - P.realm.tacBreakMorale)
  const byMen = (men / menMax - P.realm.tacBreakMen) / (1 - P.realm.tacBreakMen)
  return Math.round(Math.max(0, Math.min(1, byMorale, byMen)) * 1000)
}

/** 방금 돈 틱에 난 깎임 (사건의 틱은 돌기 전 틱 번호 · 줄은 틱 순서라 끝에서부터 읽는다) */
function tickLoss(s: FieldState): VLoss[] {
  const out: VLoss[] = []
  const ev = s.log.events
  for (let i = ev.length - 1; i >= 0 && ev[i]!.tick >= s.tick - 1; i--) {
    const e = ev[i]!
    if (e.kind === 'loss' && e.to !== undefined) out.push({ from: e.id, to: e.to, n: e.n, how: e.how ?? 0 })
  }
  return out.reverse()
}

/** 방금 돈 틱에 난 부딪힘·무너짐·활 */
function tickEvents(s: FieldState): VEvent[] {
  const out: VEvent[] = []
  const ev = s.log.events
  for (let i = ev.length - 1; i >= 0 && ev[i]!.tick >= s.tick - 1; i--) {
    const e = ev[i]!
    if (e.kind === 'impact' || e.kind === 'rout' || e.kind === 'volley' || e.kind === 'omen' || e.kind === 'flankHit' || e.kind === 'artHit' || e.kind === 'sideBreak' || e.kind === 'stand' || e.kind === 'regroup' || e.kind === 'heroSkill') out.push({ kind: e.kind, side: e.side, id: e.id, u: e.u, v: e.v, n: e.n, how: e.how ?? 0, to: e.to ?? -1, pts: e.pts === undefined ? [] : e.pts.map(p => ({ u: p.u, v: p.v })), r: e.r ?? 0 })
  }
  return out.reverse()
}

export function readField(s: FieldState): VModel {
  const unit = P.field.unit, timeTicks = P.field.timeSec * P.field.hz
  const used: [number, number, number, number] = s.tick % timeTicks === 0 ? [0, 0, 0, 0] : [s.used[0], s.used[1], s.used[2], s.used[3]]
  return {
    used,
    edge: [edgeOf(s, 0), edgeOf(s, 1)],
    face: s.map.camps[0].face,
    mapUUnits: s.map.u * unit, mapVUnits: s.map.w * unit,
    tick: s.tick,
    mapU: s.map.u, mapW: s.map.w,
    cells: s.map.cells,
    rule: s.map.rule,
    squads: s.squads.map(q => ({ id: q.id, side: q.side, grp: q.grp, kind: q.kind, men: q.men, fresh: q.fresh, u: q.u, v: q.v, target: q.target, goal: q.goal === null ? null : { u: q.goal.u, v: q.goal.v }, stance: q.stance, manual: q.manual, aim: q.aim, foe: q.foe, form: q.form, cmd: q.cmd, lock: q.lock, morale: q.morale, morale0: q.morale0, order: q.order, orderTick: q.orderTick, orderAt: q.orderAt === null ? null : { u: q.orderAt.u, v: q.orderAt.v }, ran: q.ran, bonus: q.bonus, hitTick: q.hitTick, flee: q.flee, bw: q.bw, bd: q.bd, face: q.face, pushed: q.pushed })),
    heroes: s.heroes.map(e => ({ side: e.side, id: e.id, u: e.u, v: e.v, stun: e.stun, goal: e.goal === null ? null : { u: e.goal.u, v: e.goal.v }, dir: e.dir, face: e.face, dash: e.dash, dashDir: e.dashDir, dashCd: e.dashCd, art: e.art, artCd: e.artCd, artOn: e.artOn, why: e.why, whyTick: e.whyTick, atk: e.atk, mu: e.mu, tong: e.tong, grit: e.grit })),
    loss: tickLoss(s),
    events: tickEvents(s),
    anchor: s.anchor.map(p => ({ u: p.u, v: p.v })),
    lineup: [s.lineup[0], s.lineup[1]], breakTick: [s.breakTick[0], s.breakTick[1]], breakWhy: [s.breakWhy[0], s.breakWhy[1]], stood: [s.stood[0], s.stood[1]],
    stats: { flankHits: [s.stats.flankHits[0], s.stats.flankHits[1]], artMorale: [s.stats.artMorale[0], s.stats.artMorale[1]], killed: [s.stats.killed[0], s.stats.killed[1]], lost: [s.stats.lost[0], s.stats.lost[1]], moraleBy: [{ ...s.stats.moraleBy[0] }, { ...s.stats.moraleBy[1] }] },
    planTick: [s.planTick[0], s.planTick[1]],
    frontLockTick: [s.frontLockTick[0], s.frontLockTick[1]],
    route: s.route.map(r => r.map(p => ({ u: p.u, v: p.v }))),
    grpWhy: [s.grpWhy[0], s.grpWhy[1], s.grpWhy[2]],
    grpWhyTick: [s.grpWhyTick[0], s.grpWhyTick[1], s.grpWhyTick[2]],
    pieces: s.map.pieces.map(p => ({ id: p.id, kind: p.kind, u0: p.u0, v0: p.v0, u1: p.u1, v1: p.v1, hp: p.hp })),
    end: s.end,
    winner: s.winner,
  }
}
