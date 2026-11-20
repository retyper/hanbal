import { HAEBI_TREE as T } from '../tune/params.ts'
import { BRANCHES, POWERS, KITS, branchNodes, branchName, branchPoints, tierOpen, nodeText, kitCombos, comboRank, comboReady, ultUpgraded, type HaebiRun, type Branch, type Power, type Pick } from './haebi.ts'

export type TreeRequirement = { kind: 'branch' | 'power' | 'combo'; from: string; have: number; need: number; met: boolean }
export type TreeNode = {
  id: string; kind: 'power' | 'combo' | 'ult'; name: string; rank: number; max: number
  open: boolean; offered: boolean; requirements: TreeRequirement[]
}
const requirement = (kind: TreeRequirement['kind'], from: string, have: number, need: number): TreeRequirement => ({ kind, from, have, need, met: have >= need })
/** A branch total is the prerequisite, never the preceding power. Offers are a separate state. */
export function treeModel(s: HaebiRun) {
  const offered = (p: Pick) => s.offers.includes(p)
  const branches = BRANCHES.map(b => ({
    id: b, name: branchName(s.kit, b), points: branchPoints(s, b),
    tiers: branchNodes(s.kit)[b].map((row, tier) => row.map((p): TreeNode => ({
      id: p, kind: 'power', name: nodeText(s.kit, p).name, rank: s.ranks[p], max: POWERS[p].max,
      open: tierOpen(s, b, tier), offered: offered(p),
      requirements: T.tiers[tier]! ? [requirement('branch', b, branchPoints(s, b), T.tiers[tier]!)] : [],
    }))),
  }))
  const combos = kitCombos(s.kit).map((c): TreeNode => ({
    id: c.id, kind: 'combo', name: c.name, rank: comboRank(s, c.id), max: T.max,
    open: comboReady(s, c), offered: offered(c.id),
    requirements: Object.entries(c.needs).map(([p, n]) => requirement('power', p, s.ranks[p as Power], n)),
  }))
  const ult: TreeNode = {
    id: 'ult', kind: 'ult', name: `${KITS[s.kit].skill} 강화`, rank: ultUpgraded(s) ? 1 : 0, max: 1,
    open: ultUpgraded(s), offered: false,
    requirements: [requirement('combo', 'any', Math.max(...combos.map(c => c.rank)), T.max)],
  }
  return { branches, combos, ult }
}
export const treeNodeClasses = (n: TreeNode) => ['tree-node', n.open ? 'is-open' : 'is-locked', n.rank ? 'is-earned' : '', n.rank >= n.max ? 'is-max' : '', n.offered ? 'is-offered' : ''].filter(Boolean).join(' ')
export const branchRequirementLabel = (s: HaebiRun, b: Branch, need: number) => `${branchName(s.kit, b)} 갈래에서 ${need}번 고르면 열립니다`
