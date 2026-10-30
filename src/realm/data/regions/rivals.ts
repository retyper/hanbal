/**
 * 타국 수를 판마다 고정한다 (docs/realm/FOCUS.md J · 형 10-30: "자유판 게임세트마다 지도 크기를 고정 · 쇠의 바다에 타국이 1개라면 가장 작은 것").
 * 어느 나라가 나올지는 판마다 무작위 — (시드 · 나라 id) 굴림으로 줄 세워 앞의 n 나라만 남긴다 (A1).
 * 뽑히지 않은 나라는 판에서 빠지고, 그 고을은 주인 없는 빈 땅이 된다 (품 = 살던 집 수 · 사람을 보내 개척한다).
 */
import { roll } from '../../../core/rng.ts'
import type { Realm } from '../../types.ts'

export function keepRivals(r: Realm, n: number): Realm {
  const me = r.player
  const others = Object.keys(r.factions).filter((f) => f !== me).sort()
  const kept = new Set(others.sort((a, b) => roll(r.seed, 0, `rival:${a}`) - roll(r.seed, 0, `rival:${b}`)).slice(0, n))
  if (me !== undefined) kept.add(me)
  const gone = (f: string | null): boolean => f !== null && !kept.has(f)
  for (const [id, node] of Object.entries(r.nodes)) {
    if (!gone(node.owner)) continue
    r.nodes[id] = {
      ...node, kind: 'wild', owner: null, room: node.hh, hh: 0, sown: 0,
      name: node.name.replace('도읍', '옛터'),
      tags: node.tags.filter((t) => t !== 'palisade' && t !== 'moat'),
    }
  }
  for (const f of Object.keys(r.factions)) if (gone(f)) delete r.factions[f]
  for (const [id, a] of Object.entries(r.armies)) if (gone(a.faction)) delete r.armies[id]
  for (const [id, h] of Object.entries(r.heroes)) if (gone(h.faction)) delete r.heroes[id]
  for (const f of Object.keys(r.stock)) if (gone(f)) delete r.stock[f]
  for (const f of Object.keys(r.intel)) if (gone(f)) delete r.intel[f]
  return r
}
