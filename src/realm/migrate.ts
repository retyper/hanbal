/**
 * 옛 판을 지금 판으로 — 사람의 눈금 (형: "가구수랑 징병량이 초반이라서 적은건가? 실제로 이시대에 이수준이었나?" — 2026-10-18)
 *
 * 위서 동이전: 변진 큰 나라 4~5천 가, 작은 나라 6~7백 가. 옛 판은 도읍 300~750 집 · 군대 100~200 명이었다.
 * 지금 판은 사람(가호·빈땅의 품·군사·장정)을 PEOPLE_SCALE 배로 센다 — 큰 나라 3~5천 집, 군대 수백 명.
 * 곡식·철 같은 물건의 셈은 그대로다: 한 사람당 드는 곡식·철(수확·군량·채비·무장)을 같은 배로 나눴다 (params "사람 눈금 ×4").
 * 그래서 판의 흐름(누가 이기나)은 옛 판과 같고, 숫자만 사료에 가까워졌다.
 *
 * 옛 저장(scale 없음 = 1)은 판을 넘기거나 먼저 해 볼 때(season.advance · planned) 한 번 키운다.
 */
import { scaleMen } from './kit.ts'
import type { Realm } from './types.ts'

/** 지금 판의 사람 눈금 — 옛 판의 몇 배인가 */
export const PEOPLE_SCALE = 4

/** 옛 판이면 사람을 키운다 (제자리에서 바꾼다). 이미 지금 눈금이면 아무 일도 없다 */
export function migrate(r: Realm): void {
  const s = r.scale ?? 1
  if (s === PEOPLE_SCALE || !(s > 0)) return
  const f = PEOPLE_SCALE / s
  const up = (x: number): number => Math.round(x * f)
  for (const id of Object.keys(r.nodes).sort()) {
    const n = r.nodes[id]!
    r.nodes[id] = { ...n, hh: up(n.hh), sown: up(n.sown), ...(n.room !== undefined ? { room: up(n.room) } : {}) }
  }
  for (const a of Object.values(r.armies)) scaleMen(a, f)
  for (const known of Object.values(r.intel)) {
    for (const k of Object.values(known)) if (k.force && Number.isFinite(k.force.f0)) k.force = { ...k.force, f0: k.force.f0 * f }
  }
  r.scale = PEOPLE_SCALE
}
