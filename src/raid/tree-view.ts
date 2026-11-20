import { treeModel, treeNodeClasses, branchRequirementLabel, type TreeNode, type TreeRequirement } from './tree-model.ts'
import { nodeText, type Branch, type Combo, type HaebiRun, type Power } from './haebi.ts'

const arrow = '<svg class="tree-arrow" viewBox="0 0 16 12" aria-hidden="true"><path d="M1 6h12M9 2l5 4-5 4" fill="none" stroke="currentColor" stroke-width="2"/></svg>'
const fork = '<svg class="tree-branch-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 15V8M2 1v4l6 3 6-3V1M8 8V1" fill="none" stroke="currentColor" stroke-width="2"/></svg>'
/** Each arrow points from the pictured real requirement into its target node picture. */
export function renderTree(s: HaebiRun, power: (p: Power) => string, combo: (p: Combo) => string, colors: Record<Branch, string>, skillArt: string) {
  const model = treeModel(s)
  const requirement = (r: TreeRequirement, to: string) => {
    const label = r.kind === 'branch' ? branchRequirementLabel(s, r.from as Branch, r.need)
      : r.kind === 'power' ? `${nodeText(s.kit, r.from as Power).name} ${r.need}단계가 필요합니다` : `조합 하나를 ${r.need}단계로 올리면 강화됩니다`
    const picture = r.kind === 'branch' ? fork : r.kind === 'power' ? power(r.from as Power)
      : `<span class="tree-any-combo">${model.combos.map(c => combo(c.id as Combo)).join('')}</span><span>하나</span>`
    return `<span class="tree-requirement${r.met ? ' is-met' : ''}" data-kind="${r.kind}" data-from="${r.from}" data-to="${to}" data-have="${r.have}" data-need="${r.need}" aria-label="${label}"><span class="tree-need-values">${picture}<span>${r.have}/${r.need}</span></span>${arrow}</span>`
  }
  const node = (n: TreeNode) => {
    const data = n.kind === 'power' ? `data-node="${n.id}"` : n.kind === 'combo' ? `data-combo="${n.id}"` : 'data-ult="1"'
    const art = n.kind === 'power' ? power(n.id as Power) : n.kind === 'combo' ? combo(n.id as Combo) : skillArt
    const needs = n.requirements.map(r => requirement(r, n.id)).join('')
    const rank = n.kind === 'ult' ? '' : `<span class="tree-rank">${n.rank}/${n.max}</span>`
    return `<div class="${treeNodeClasses(n)} tree-${n.kind}" ${data} role="button" tabindex="0" aria-label="${n.name} 설명 보기${n.offered ? ', 지금 고를 수 있습니다' : ''}"><span class="tree-node-top">${needs}<span class="tree-node-picture">${art}</span></span><span class="tree-name">${n.name}</span>${rank}</div>`
  }
  const branches = model.branches.map(b => `<section class="tree-branch" style="--tree-color:${colors[b.id]}"><h3>${b.name} 갈래 <span>${fork}${b.points}번 고름</span></h3><div class="tree-tiers">${b.tiers.map(t => `<div class="tree-tier">${t.map(node).join('')}</div>`).join('')}</div></section>`).join('')
  return `<div class="tree-board"><div class="tree-branches">${branches}</div><div class="tree-combinations">${model.combos.map(node).join('')}${node(model.ult)}</div></div>`
}
