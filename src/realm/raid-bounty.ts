/**
 * 열전 표적 — 달마다 지도 어딘가에 하나 뜬다 (형 11-22 「제안한 대로 해 봐」 · docs/realm/RAID-REWARD-MAP-20261122.md 다음 문서 · 본게임 정적 문제).
 *
 *  - 열전은 장수 전체에서 한 달에 한 번이다 (raid-month.ts raidMonthOpen). 그 한 번을 지도 위 사건으로 만든다:
 *    갈지 말지 · 어느 장수를 보낼지가 본게임의 결정이 된다.
 *  - 표적은 우리 땅 가장자리의 남의 고을·빈 땅 하나 · 시드와 달로 정한다(같은 판 같은 달 = 같은 표적). 판의 셈(sim)은 이것을 읽지 않는다 — 화면이 읽는다.
 *  - 이기면 그 고을이 「평정」되어 지도에 깃발이 서고(raidPacifyMonths 달) 곳간에 곡식·쇠가 든다 (grantRaidBounty · 화면이 열전 결과를 받아 부른다).
 */
import type { Realm, RNode, Tag } from './types.ts'
import { P } from '../tune/params.ts'
import { neighbors } from './season.ts'
import { seasonOf } from './calendar.ts'
import { realmScale } from './scale.ts'

/** 열전 스테이지 (raid HAEBI_STAGES 의 다섯 · 시련 빼고) */
export type RaidStage = 'forest' | 'ford' | 'palisade' | 'snow' | 'fortress'
export const RAID_STAGES: readonly RaidStage[] = ['forest', 'ford', 'palisade', 'snow', 'fortress']

export interface RaidBounty { readonly node: string; readonly stage: RaidStage }
export interface RaidWin { readonly node: string; readonly t: number; readonly stage: RaidStage; readonly hero: string }

const has = (n: RNode, ...tags: Tag[]): boolean => tags.some((t) => n.tags.includes(t))

/** 고을 꼴에 어울리는 스테이지 — 도읍·토성은 산성 · 성채·목책은 목책 · 물가는 여울 · 높은 땅·겨울은 설원 · 나머지는 숲 */
export function stageForNode(r: Realm, n: RNode): RaidStage {
  if (n.kind === 'capital' || has(n, 'earthwall')) return 'fortress'
  if (n.kind === 'fort' || has(n, 'palisade', 'moat')) return 'palisade'
  if (n.kind === 'port' || has(n, 'shallows', 'reeds')) return 'ford'
  if (has(n, 'high') || seasonOf(r) === 'winter') return 'snow'
  return 'forest'
}

/** 최근에 평정한 고을 (raidPacifyMonths 안) — 지도에 깃발 · 표적으로 다시 안 뽑힌다 */
export function recentRaidWins(r: Realm): RaidWin[] {
  const keep = Math.max(1, Math.round(P.realm.raidPacifyMonths))
  return (Array.isArray(r.raidWins) ? r.raidWins : []).filter((w) => w !== null && typeof w === 'object' && typeof w.node === 'string' && r.season - w.t < keep && r.nodes[w.node] !== undefined)
}

/** 이번 달 표적 — 우리 땅과 길로 닿은 남의 고을·빈 땅 (소도 빼고 · 최근 평정 빼고). 없으면 아무 남의 고을. 그것도 없으면 null */
export function raidBounty(r: Realm): RaidBounty | null {
  const me = r.player
  const mine = Object.values(r.nodes).filter((n) => n.owner === me)
  if (mine.length === 0) return null
  const calm = new Set(recentRaidWins(r).map((w) => w.node))
  const ok = (n: RNode | undefined): n is RNode => n !== undefined && n.owner !== me && n.kind !== 'sodo' && !calm.has(n.id)
  const edge = new Set<string>()
  for (const n of mine) for (const o of neighbors(r, n.id)) if (ok(r.nodes[o])) edge.add(o)
  const pool = [...(edge.size > 0 ? edge : Object.values(r.nodes).filter(ok).map((n) => n.id))].sort()
  if (pool.length === 0) return null
  // 시드와 달로 하나 — 같은 판 같은 달이면 늘 같은 표적 (다시 열어도 바뀌지 않는다)
  const h = (Math.imul((r.seed >>> 0) ^ 0x7a3d1c5b, 2654435761) ^ Math.imul(r.season + 1, 0x85ebca6b)) >>> 0
  const node = r.nodes[pool[h % pool.length]!]!
  return { node: node.id, stage: stageForNode(r, node) }
}

/** 표적을 깨면 받을 것 (배너에 보인다 · grantRaidBounty 와 같은 셈) */
export function bountyReward(r: Realm): { grain: number; iron: number } {
  const s = realmScale(r, r.player)
  return { grain: Math.round(P.realm.raidBountyGrain * s), iron: Math.round(P.realm.raidBountyIron * s) }
}

/** 표적을 깼다 — 곳간에 곡식·쇠 (판 크기만큼) · 평정 기록. 이미 이 달 이 고을을 깼으면 아무것도 안 한다. 준 것을 돌려준다 */
export function grantRaidBounty(r: Realm, hero: string, b: RaidBounty): { grain: number; iron: number } | null {
  const me = r.player
  const wins = Array.isArray(r.raidWins) ? r.raidWins : []
  if (wins.some((w) => w.node === b.node && w.t === r.season)) return null
  const st = r.stock[me]
  if (st === undefined || r.nodes[b.node] === undefined) return null
  const got = bountyReward(r)
  st.grain += got.grain
  st.iron += got.iron
  // 오래된 기록은 걷어 낸다 (판이 끝없이 불지 않게)
  r.raidWins = [...recentRaidWins(r), { node: b.node, t: r.season, stage: b.stage, hero }]
  return got
}
