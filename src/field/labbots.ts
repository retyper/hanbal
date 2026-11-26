/**
 * 실험실의 봇 셋 (56-lab.md §2) — 같은 판 짜임을 가만히 · 뒤로 돌아 치기 · 정면 돌격으로 끝까지 돌린다. 순수 함수 (tools/field-lab.ts 와 실험실 일꾼이 같이 쓴다).
 * 뒤로 돌아 치기: 위 날개가 적 활의 처음 깊이 · 판 위 끝 3칸의 바깥 길로 간 뒤 맨 위 적 활을 친다.
 * 정면 돌격: 위 날개가 처음에 맨 위 적 앞줄을 곧게 친다.
 */
import { labSetup, type LabConfig } from './scenario.ts'
import { createField, members, stepField } from './sim.ts'
import { P } from '../tune/params.ts'
import { OP_ATTACK, OP_MOVE, type FieldInput } from './types.ts'

export type LabBot = 'idle' | 'rear' | 'front'
export const LAB_BOTS: readonly LabBot[] = ['idle', 'rear', 'front']
export interface LabBotRun { win: number; sec: number; hit: boolean; kills: number; lost: number }

export function labBot(cfg: LabConfig, seed: number, bot: LabBot): LabBotRun {
  const s = createField(labSetup(cfg, seed))
  const U = P.field.unit
  const wing = members(s, 0, 2), ids = new Set(wing.map(q => q.id)), men0 = wing.reduce((a, q) => a + q.men, 0)
  const byV = (grp: string) => s.squads.filter(q => q.side === 1 && q.grp === grp).sort((a, b) => a.v - b.v)
  const bow = byV('bows')[0], front = byV('front')[0]
  const lane = bow === undefined ? null : { u: bow.u, v: 3 * U }
  let stage = 0, hit = false, kills = 0
  while (s.end === null) {
    const inp: FieldInput[] = []
    if (bot === 'front' && s.tick === 0 && front !== undefined && wing.length > 0) inp.push({ tick: 0, g: 2, op: OP_ATTACK, u: front.id, v: 0 })
    if (bot === 'rear' && lane !== null && bow !== undefined && wing.length > 0) {
      if (stage === 0) { inp.push({ tick: s.tick, g: 2, op: OP_MOVE, u: lane.u, v: lane.v }); stage = 1 }
      else if (stage === 1) {
        const w = wing.filter(q => q.men > 0)
        let cu = 0, cv = 0
        for (const q of w) { cu += q.u; cv += q.v }
        const n = Math.max(1, w.length), r = P.field.arriveCells * U
        if ((cu / n - lane.u) * (cu / n - lane.u) + (cv / n - lane.v) * (cv / n - lane.v) <= r * r && bow.men > 0 && bow.flee === 0) { inp.push({ tick: s.tick, g: 2, op: OP_ATTACK, u: bow.id, v: 0 }); stage = 2 }
      }
    }
    stepField(s, inp)
    for (const e of s.log.events) {
      if (e.tick !== s.tick - 1) continue
      if (e.kind === 'loss' && e.id >= 0 && ids.has(e.id)) kills += e.n
      if (e.kind === 'flankHit' && ids.has(e.id)) hit = true
    }
  }
  return { win: s.winner, sec: s.tick / P.field.hz, hit, kills, lost: men0 - wing.reduce((a, q) => a + q.men, 0) }
}

/** 봇 하나의 n 판 묶음 */
export interface LabBotSum { games: number; wins: number; draws: number; sec: number; hits: number; kills: number; lost: number }
export const emptySum = (): LabBotSum => ({ games: 0, wins: 0, draws: 0, sec: 0, hits: 0, kills: 0, lost: 0 })
export function addRun(a: LabBotSum, r: LabBotRun): void {
  a.games++; if (r.win === 0) a.wins++; else if (r.win === -1) a.draws++
  a.sec += r.sec; if (r.hit) a.hits++; a.kills += r.kills; a.lost += r.lost
}
