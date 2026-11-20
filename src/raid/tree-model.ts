import { HAEBI_TREE as T } from '../tune/params.ts'
import { BRANCHES, POWERS, KITS, branchNodes, branchName, branchPoints, nodeOpen, nodeParent, nodeText, kitCombos, comboRank, comboReady, ultUpgraded, type HaebiRun, type Branch, type Power, type Pick } from './haebi.ts'

export type TreeRequirement = { kind: 'power' | 'combo'; from: string; have: number; need: number; met: boolean }
export type TreeNode = {
  id: string; kind: 'power' | 'combo' | 'ult'; name: string; rank: number; max: number
  branch: Branch | null; x: number; y: number; open: boolean; offered: boolean; requirements: TreeRequirement[]
  gate: { have: number; need: number; met: boolean; tier: number } | null
}
export type TreeEdge = TreeRequirement & { to: string; group: 'all' | 'any' }
const requirement = (kind: TreeRequirement['kind'], from: string, have: number, need: number): TreeRequirement => ({ kind, from, have, need, met: have >= need })
/** The graph uses the simulation's real parents. Coordinates only choose where to draw them. */
export function treeModel(s: HaebiRun) {
  const offered = (p: Pick) => s.offers.includes(p)
  const branches = BRANCHES.map((b, column) => ({
    id: b, name: branchName(s.kit, b),
    tiers: branchNodes(s.kit)[b].map((row, tier) => row.map((p, i): TreeNode => {
      const parent = nodeParent(s.kit, p)
      return { id: p, kind: 'power', name: nodeText(s.kit, p).name, rank: s.ranks[p], max: POWERS[p].max,
        branch: b, x: (column + .5) * 100 / 3 + (row.length === 2 ? (i ? 6.3 : -6.3) : 0), y: 7 + tier * 19,
        open: nodeOpen(s, p), offered: offered(p),
        gate: T.tiers[tier]! ? { have: branchPoints(s, b), need: T.tiers[tier]!, met: branchPoints(s, b) >= T.tiers[tier]!, tier } : null,
        requirements: parent ? [requirement('power', parent, s.ranks[parent], 1)] : [] }
    })),
  }))
  const sorted = [...kitCombos(s.kit)].sort((a, b) => {
    const order = (c: typeof a) => KITS[s.kit].primary in c.needs ? 0 : 'reach' in c.needs ? 1 : 2
    return order(a) - order(b)
  })
  const combos = sorted.map((c, i): TreeNode => ({
    id: c.id, kind: 'combo', name: c.name, rank: comboRank(s, c.id), max: T.max,
    branch: null, x: 14 + 25 * i, y: 89, open: comboReady(s, c), offered: offered(c.id), gate: null,
    requirements: Object.entries(c.needs).map(([p, n]) => requirement('power', p, s.ranks[p as Power], n)),
  }))
  const ult: TreeNode = {
    id: 'ult', kind: 'ult', name: `${KITS[s.kit].skill} 강화`, rank: ultUpgraded(s) ? 1 : 0, max: 1,
    branch: null, x: 89, y: 89, open: ultUpgraded(s), offered: false, gate: null,
    requirements: combos.map(c => requirement('combo', c.id, c.rank, T.max)),
  }
  const nodes = [...branches.flatMap(b => b.tiers.flat()), ...combos, ult]
  const edges: TreeEdge[] = nodes.flatMap(n => n.requirements.map(r => ({ ...r, to: n.id, group: n.kind === 'ult' ? 'any' : 'all' })))
  return { branches, combos, ult, nodes, edges }
}
export const treeNodeClasses = (n: TreeNode) => ['tree-node', n.rank ? 'is-earned' : n.open ? 'is-open' : 'is-locked', n.rank >= n.max ? 'is-max' : '', n.offered ? 'is-offered' : ''].filter(Boolean).join(' ')
