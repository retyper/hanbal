/**
 * 자유판의 시작을 고정한다 (docs/realm/FOCUS.md I·J · 형 10-30).
 *  - keepRivals: 판마다 타국 수가 정해져 있다 ("쇠의 바다에 타국이 1개라면 가장 작은 것"). 어느 나라가 나올지는 판마다 무작위 —
 *    (시드 · 나라 id) 굴림으로 줄 세워 앞의 n 나라만 남긴다 (A1). 뽑히지 않은 나라는 판에서 빠진다.
 *  - capitalOnly: 모든 나라가 도읍 하나로 시작한다 ("게임 시작은 도읍 하나로 시작해야 헷갈리지 않음").
 * 주인을 잃은 고을은 빈 땅이 된다 (품 = 살던 집 수 · 사람을 보내 개척한다). 다만 철광·포구는 그 종류가 곧 철이라
 * 종류와 집을 그대로 둔 채 주인만 비운다 — 군대가 들어가면 차지한다 (철과 뱃길의 다툼거리).
 */
import { roll } from '../../../core/rng.ts'
import type { Realm, RNode } from '../../types.ts'

const emptied = (node: RNode): RNode => {
  const tags = node.tags.filter((t) => t !== 'palisade' && t !== 'moat')
  const name = node.name.replace('도읍', '옛터')
  if (node.kind === 'ironMine' || node.kind === 'port') return { ...node, owner: null, name, tags }
  return { ...node, kind: 'wild', owner: null, room: node.hh, hh: 0, sown: 0, name, tags }
}

export function keepRivals(r: Realm, n: number): Realm {
  const me = r.player
  const others = Object.keys(r.factions).filter((f) => f !== me).sort()
  const kept = new Set(others.sort((a, b) => roll(r.seed, 0, `rival:${a}`) - roll(r.seed, 0, `rival:${b}`)).slice(0, n))
  if (me !== undefined) kept.add(me)
  const gone = (f: string | null): boolean => f !== null && !kept.has(f)
  for (const [id, node] of Object.entries(r.nodes)) if (gone(node.owner)) r.nodes[id] = emptied(node)
  for (const f of Object.keys(r.factions)) if (gone(f)) delete r.factions[f]
  for (const [id, a] of Object.entries(r.armies)) if (gone(a.faction)) delete r.armies[id]
  for (const [id, h] of Object.entries(r.heroes)) if (gone(h.faction)) delete r.heroes[id]
  for (const f of Object.keys(r.stock)) if (gone(f)) delete r.stock[f]
  for (const f of Object.keys(r.intel)) if (gone(f)) delete r.intel[f]
  return r
}

/** 모든 나라가 도읍 하나로 — 도읍 밖 고을은 비우고, 그곳의 군대·장수는 제 도읍으로 모인다 (우리만 도읍 하나면 봇 대전 이김 1.7%) */
export function capitalOnly(r: Realm): Realm {
  const capOf = (f: string | null): string | undefined => (f !== null ? r.factions[f]?.capital : undefined)
  for (const [id, node] of Object.entries(r.nodes)) {
    const cap = capOf(node.owner)
    if (cap !== undefined && id !== cap) r.nodes[id] = emptied(node)
  }
  for (const a of Object.values(r.armies)) {
    const cap = capOf(a.faction)
    if (cap !== undefined && a.march === null) a.at = cap
  }
  for (const h of Object.values(r.heroes)) {
    const cap = capOf(h.faction)
    if (cap === undefined) continue
    if (h.at !== null) h.at = cap
    if (h.post !== null && h.post !== cap) h.post = null
  }
  return r
}
