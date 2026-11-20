import { treeModel, treeNodeClasses, type TreeEdge } from './tree-model.ts'
import { type Branch, type Combo, type HaebiRun, type Power } from './haebi.ts'

const lock = '<svg class="tree-lock" viewBox="0 0 16 18" aria-hidden="true"><path d="M4 8V5a4 4 0 0 1 8 0v3M2 8h12v9H2z" fill="currentColor" stroke="#111c16" stroke-width="2"/></svg>'
const tip = (id: string, color: string) => `<marker id="tree-tip-${id}" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0 8 4 0 8z" fill="${color}"/></marker>`
/** One picture per real node. The SVG links those pictures, never duplicate ingredient pictures. */
export function renderTree(s: HaebiRun, power: (p: Power) => string, combo: (p: Combo) => string, colors: Record<Branch, string>, skillArt: string) {
  const model = treeModel(s), byId = new Map(model.nodes.map(n => [n.id, n]))
  const nodes = model.nodes.map(n => {
    const data = n.kind === 'power' ? `data-node="${n.id}"` : n.kind === 'combo' ? `data-combo="${n.id}"` : 'data-ult="1"'
    const art = n.kind === 'power' ? power(n.id as Power) : n.kind === 'combo' ? combo(n.id as Combo) : skillArt
    const rank = n.kind === 'ult' || !n.rank ? '' : `<span class="tree-rank">${n.rank}/${n.max}</span>`
    return `<div class="${treeNodeClasses(n)} tree-${n.kind}" ${data} data-tree-id="${n.id}" data-branch="${n.branch ?? ''}" data-gate-have="${n.gate?.have ?? 0}" data-gate-need="${n.gate?.need ?? 0}" role="button" tabindex="0" aria-label="${n.name} 설명 보기, ${n.rank}/${n.max}단계${n.offered ? ', 지금 고를 수 있습니다' : n.open ? '' : ', 잠겨 있습니다'}" style="left:${n.x}%;top:${n.y}%;--tree-color:${n.branch ? colors[n.branch] : '#ead298'}"><span class="tree-node-picture">${art}${n.open || n.rank ? '' : lock}</span>${rank}</div>`
  }).join('')
  const edges = model.edges.map(e => {
    const branch = byId.get(e.from)!.branch, color = e.met ? branch ? colors[branch] : '#ead298' : '#8b9483', marker = e.met ? branch ?? 'combo' : 'closed'
    return `<path class="tree-edge ${e.met ? 'is-open' : 'is-closed'}" data-kind="${e.kind}" data-from="${e.from}" data-to="${e.to}" data-have="${e.have}" data-need="${e.need}" data-met="${e.met}" data-group="${e.group}" stroke="${color}" marker-end="url(#tree-tip-${marker})"/>`
  }).join('')
  const headings = model.branches.map(b => `<h3 data-branch="${b.id}" style="color:${colors[b.id]}">${b.name}</h3>`).join('')
  const gates = model.branches.flatMap((b, i) => b.tiers.filter(t => t[0]!.gate && !t[0]!.gate!.met).map(t => `<span class="tree-gate" data-for="${t.map(n => n.id).join(' ')}" data-branch="${b.id}" data-need="${t[0]!.gate!.need}" style="left:${(i + .5) * 100 / 3}%;top:${t[0]!.y}%">갈래 ${t[0]!.gate!.need}회</span>`)).join('')
  return `<div class="tree-branch-heads">${headings}</div><div class="tree-board"><svg class="tree-links" aria-hidden="true"><defs>${Object.entries(colors).map(([b, c]) => tip(b, c)).join('')}${tip('combo', '#ead298')}${tip('closed', '#8b9483')}</defs>${edges}<g class="tree-edge-labels"></g></svg>${nodes}${gates}</div>`
}

type Point = { x: number; y: number; r: number; bottom: number }
const route = (points: [number, number][]) => points.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)}`).join(' ')
/** Reuse a horizontal lane only when the two solid 2px strokes have separate x ranges. */
export function treeBusLevels(intervals: readonly [number, number][]) {
  const levels: number[] = [], ends: number[] = []
  const sorted = intervals.map(([a, b], i) => ({ i, start: Math.min(a, b), end: Math.max(a, b) })).sort((a, b) => a.start - b.start || a.end - b.end)
  for (const line of sorted) {
    let level = ends.findIndex(end => end + 2 < line.start)
    if (level < 0) level = ends.length
    ends[level] = line.end; levels[line.i] = level
  }
  return { levels, count: ends.length }
}
/** Measure on opening or an actual size change, not during combat frames. */
export function drawTreeLinks(container: HTMLElement, s: HaebiRun) {
  const board = container.querySelector<HTMLElement>('.tree-board')!, svg = board.querySelector<SVGSVGElement>('.tree-links')!, rect = board.getBoundingClientRect(), model = treeModel(s)
  svg.setAttribute('viewBox', `0 0 ${rect.width} ${rect.height}`)
  const points = new Map<string, Point>()
  for (const el of board.querySelectorAll<HTMLElement>('[data-tree-id]')) {
    const r = el.querySelector('.tree-node-picture')!.getBoundingClientRect(), rank = el.querySelector('.tree-rank')?.getBoundingClientRect()
    points.set(el.dataset.treeId!, { x: r.x + r.width / 2 - rect.x, y: r.y + r.height / 2 - rect.y, r: r.width / 2 + 2, bottom: Math.max(r.bottom, rank?.bottom ?? 0) - rect.y })
  }
  const normalBottom = Math.max(...model.nodes.filter(n => n.kind === 'power').map(n => points.get(n.id)!.bottom), ...[...board.querySelectorAll('.tree-gate')].map(el => el.getBoundingClientRect().bottom - rect.y)), comboTop = Math.min(...model.combos.map(n => { const p = points.get(n.id)!; return p.y - p.r }))
  const comboEdges = model.edges.filter(e => model.combos.some(n => n.id === e.to)), labels = new Map<string, { need: number; p: Point }>()
  const comboLayout = comboEdges.map((e, i) => {
    const a = points.get(e.from)!, b = points.get(e.to)!, source = model.nodes.find(n => n.id === e.from)!, col = ['a', 'b', 'c'].indexOf(source.branch!), mid = (col + .5) * rect.width / 3
    const left = a.x <= mid, lane = (left ? col : col + 1) * rect.width / 3 + (left ? 7 + i % 3 * 3 : -7 - i % 3 * 3)
    const siblings = comboEdges.filter(q => q.to === e.to), x = b.x + (siblings.indexOf(e) ? 1 : -1) * b.r * .48
    return { left, lane, x }
  })
  const busLevels = treeBusLevels(comboLayout.map(p => [p.lane, p.x]))
  const draw = (e: TreeEdge) => {
    const a = points.get(e.from)!, b = points.get(e.to)!, target = model.nodes.find(n => n.id === e.to)!
    let ps: [number, number][]
    if (target.kind === 'ult') {
      const i = model.combos.findIndex(n => n.id === e.from), bottom = rect.height - 3 - i * 4, x = b.x + (i - 1) * 7
      ps = [[a.x + a.r, a.y], [a.x + a.r + 4, a.y], [a.x + a.r + 4, bottom], [x, bottom], [x, b.y + Math.sqrt(Math.max(0, b.r * b.r - (x - b.x) ** 2))]]
    } else if (target.kind === 'combo') {
      const i = comboEdges.indexOf(e), { left, lane, x } = comboLayout[i]!
      const bus = normalBottom + 3 + (busLevels.levels[i]! + .5) * Math.max(1, comboTop - normalBottom - 6) / busLevels.count
      ps = [[a.x + (left ? -a.r : a.r), a.y], [lane, a.y], [lane, bus], [x, bus], [x, b.y - Math.sqrt(b.r * b.r - (x - b.x) ** 2)]]
      labels.set(e.from, { need: e.need, p: a })
    } else if (Math.abs(a.x - b.x) < 1) {
      const lane = a.x + a.r + 7
      ps = [[a.x + a.r, a.y], [lane, a.y], [lane, b.y - b.r - 5], [b.x, b.y - b.r - 5], [b.x, b.y - b.r]]
    } else {
      const dir = b.x > a.x ? 1 : -1, lane = b.x
      ps = [[a.x + dir * a.r, a.y], [lane, a.y], [lane, b.y - b.r]]
    }
    board.querySelector<SVGPathElement>(`.tree-edge[data-from="${e.from}"][data-to="${e.to}"]`)!.setAttribute('d', route(ps))
  }
  model.edges.forEach(draw)
  svg.querySelector('.tree-edge-labels')!.innerHTML = [...labels].map(([from, { need, p }]) => {
    const root = model.nodes.find(n => n.id === from)!.y < 10, x = root ? p.x - p.r - 12 : p.x, y = root ? p.y - 4 : p.y - p.r - 4
    return `<text class="tree-edge-label" data-source="${from}" x="${Math.max(12, x)}" y="${Math.max(12, y)}">${need}단</text>`
  }).join('')
}

export function flashTreeParents(container: HTMLElement, id: string) {
  const target = container.querySelector<HTMLElement>(`[data-tree-id="${id}"]`)
  if (!target?.classList.contains('is-locked')) return
  const ids = new Set([...container.querySelectorAll<SVGPathElement>(`.tree-edge[data-to="${id}"][data-met="false"]`)].map(e => e.dataset.from!))
  const parents = [...ids].map(from => container.querySelector<HTMLElement>(`[data-tree-id="${from}"]`)!)
  if (!parents.length && Number(target.dataset.gateHave) < Number(target.dataset.gateNeed)) parents.push(container.querySelector<HTMLElement>(`.tree-branch-heads [data-branch="${target.dataset.branch}"]`)!)
  for (const parent of parents) {
    parent.classList.remove('needs-parent'); void parent.offsetWidth; parent.classList.add('needs-parent')
    parent.addEventListener('animationend', () => parent.classList.remove('needs-parent'), { once: true })
  }
}
