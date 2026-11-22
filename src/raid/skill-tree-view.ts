import {treeModel,treeNodeClasses,type TreeEdge,type TreeNode} from './tree-model.ts'
import {powerIcon,comboIcon,BRANCH_COLOR} from './power-ui.ts'
import type {HaebiRun,Branch,Power,Combo} from './haebi.ts'
type Model=ReturnType<typeof treeModel>
export interface SkillRect {readonly left:number;readonly top:number;readonly right:number;readonly bottom:number}
export interface SkillPoint {readonly x:number;readonly y:number}
export type SkillRoute=TreeEdge & {points:readonly SkillPoint[];labelOnly:boolean}
const esc=(s:string)=>s.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;')
const mid=(a:number,b:number)=>(a+b)/2
const p=(x:number,y:number):SkillPoint=>({x,y})
const edgeData=(e:TreeEdge)=>`data-from="${e.from}" data-to="${e.to}" data-have="${e.have}" data-need="${e.need}" data-met="${e.met}" data-group="${e.group}"`

/** Display-only: graph, unlocks, ranks and offer flags all come from the existing sim-backed model. */
export function skillTreeHtml(s:HaebiRun):string {
 const m=treeModel(s),byId=new Map(m.nodes.map(n=>[n.id,n]))
 const node=(n:TreeNode)=>{
  const data=n.kind==='power'?`data-node="${n.id}"`:n.kind==='combo'?`data-combo="${n.id}"`:'data-ult="1"'
  const art=n.kind==='power'?powerIcon(n.id as Power,s.kit):n.kind==='combo'?comboIcon(n.id as Combo):powerIcon('capA')
  const conditions=n.requirements.map(r=>`<span class="skill-requirement ${r.met?'is-met':'is-unmet'}">${esc(byId.get(r.from)!.name)} <b>${r.have}/${r.need}단</b></span>`).join('')
  const gate=n.gate?`<span class="skill-requirement ${n.gate.met?'is-met':'is-unmet'}">갈래 누적 <b>${n.gate.have}/${n.gate.need}회</b></span>`:''
  const any=n.kind==='ult'?`<span class="skill-any">조합 하나 ${n.requirements[0]?.need??0}단</span>`:''
  const color=n.branch?BRANCH_COLOR[n.branch]:'#ead298',locked=!n.open&&!n.rank
  return `<div class="${treeNodeClasses(n)} skill-node tree-${n.kind}" ${data} data-tree-id="${n.id}" data-branch="${n.branch??''}" data-gate-have="${n.gate?.have??0}" data-gate-need="${n.gate?.need??0}" role="button" tabindex="0" aria-label="${esc(n.name)} 설명 보기, ${n.rank}/${n.max}단계${n.offered?', 지금 고를 수 있습니다':locked?', 잠겨 있습니다':''}" style="--tree-color:${color}"><span class="tree-node-picture">${art}${locked?'<span class="skill-lock" aria-hidden="true">🔒</span>':''}</span><span class="skill-node-copy"><b class="skill-node-name">${esc(n.name)}</b><span class="tree-rank skill-node-rank">${n.rank}/${n.max}</span><small class="skill-node-conditions">${any}${conditions}${gate}</small></span></div>`
 }
 const heads=m.branches.map(b=>`<h3 data-branch="${b.id}" style="color:${BRANCH_COLOR[b.id]}">${esc(b.name)}</h3>`).join('')
 const branches=m.branches.map(b=>`<section class="skill-branch" data-skill-branch="${b.id}">${b.tiers.map((row,t)=>`<div class="skill-tier" data-tier="${t}">${row.map(node).join('')}</div>`).join('')}</section>`).join('')
 const edges=m.edges.map(e=>`<path class="tree-edge ${e.met?'is-open':'is-closed'}" ${edgeData(e)} style="--edge-color:${byId.get(e.from)!.branch?BRANCH_COLOR[byId.get(e.from)!.branch!]:'#ead298'}"/>`).join('')
 // 65-BUILD 판은 갈래 넷 (설치) — 줄 수는 CSS 가 --branches 로 받는다
 const cols=` style="--branches:${m.branches.length}"`
 return `<div class="tree-branch-heads skill-branch-heads"${cols}>${heads}</div><div class="tree-board skill-tree"${cols}><svg class="tree-links" aria-hidden="true">${edges}</svg><div class="skill-branches">${branches}</div><div class="skill-combos">${m.combos.map(node).join('')}</div><div class="skill-ultimate">${node(m.ult)}</div></div>`
}

/** Real cross-branch combo requirements are local text, never screen-wide buses. */
export function routeSkillTreeEdges(model:Model,nodes:ReadonlyMap<string,SkillRect>,branches:ReadonlyMap<Branch,SkillRect>):SkillRoute[] {
 const byId=new Map(model.nodes.map(n=>[n.id,n])),slots=new Map<string,number>()
 for(const b of model.branches)for(const tier of b.tiers)tier.forEach((n,i)=>slots.set(n.id,i))
 return model.edges.map(e=>{
  const from=byId.get(e.from)!,to=byId.get(e.to)!,a=nodes.get(e.from),b=nodes.get(e.to)
  if(to.kind==='combo')return {...e,points:[],labelOnly:true}
  if(!a||!b)return {...e,points:[],labelOnly:false}
  const x=mid(a.left,a.right)
  if(to.kind==='ult')return {...e,points:[p(x,a.bottom),p(x,b.top)],labelOnly:false}
  const tx=mid(b.left,b.right),top=Math.min(a.bottom,b.top),bottom=Math.max(a.bottom,b.top)
  const blocked=[...nodes].some(([id,r])=>id!==e.from&&id!==e.to&&x>r.left&&x<r.right&&r.top<bottom&&r.bottom>top)
  if(Math.abs(x-tx)<.5&&!blocked)return {...e,points:[p(x,a.bottom),p(tx,b.top)],labelOnly:false}
  const branch=branches.get(from.branch!)!,right=(slots.get(e.from)??0)>0||(slots.get(e.to)??0)>0
  const lane=right?branch.right-3:branch.left+3,ax=right?a.right:a.left,bx=right?b.right:b.left
  return {...e,points:[p(ax,mid(a.top,a.bottom)),p(lane,mid(a.top,a.bottom)),p(lane,mid(b.top,b.bottom)),p(bx,mid(b.top,b.bottom))],labelOnly:false}
 })
}

export function skillTreePath(model:Model,id:string):Set<string>{
 const byId=new Map(model.nodes.map(n=>[n.id,n])),out=new Set<string>()
 const visit=(key:string)=>{if(out.has(key))return;const n=byId.get(key);if(!n)return;out.add(key);const req=n.kind==='ult'&&n.requirements.some(r=>r.met)?n.requirements.filter(r=>r.met):n.requirements;for(const r of req)visit(r.from)}
 visit(id);return out
}
export function highlightTreePath(container:HTMLElement,s:HaebiRun,id:string):void{
 const ids=skillTreePath(treeModel(s),id)
 for(const el of container.querySelectorAll<HTMLElement>('[data-tree-id]'))el.classList.toggle('on-path',ids.has(el.dataset.treeId!))
 for(const el of container.querySelectorAll<SVGPathElement>('.tree-edge'))el.classList.toggle('on-path',ids.has(el.dataset.from!)&&ids.has(el.dataset.to!))
}
/** Layout reads happen only on open/resize. Scroll is native; coordinates remain in content space. */
export function drawTreeLinks(container:HTMLElement,s:HaebiRun):void{
 const board=container.querySelector<HTMLElement>('.skill-tree'),svg=board?.querySelector<SVGSVGElement>('.tree-links');if(!board||!svg)return
 svg.style.height='0px';svg.style.width='0px'
 const base=board.getBoundingClientRect();if(!base.width)return
 const rect=(el:Element):SkillRect=>{const r=el.getBoundingClientRect();return{left:r.left-base.left+board.scrollLeft,top:r.top-base.top+board.scrollTop,right:r.right-base.left+board.scrollLeft,bottom:r.bottom-base.top+board.scrollTop}}
 const nodes=new Map([...board.querySelectorAll<HTMLElement>('[data-tree-id]')].map(el=>[el.dataset.treeId!,rect(el)]))
 const branches=new Map([...board.querySelectorAll<HTMLElement>('[data-skill-branch]')].map(el=>[el.dataset.skillBranch as Branch,rect(el)]))
 const width=board.scrollWidth,height=board.scrollHeight;svg.setAttribute('viewBox',`0 0 ${width} ${height}`);svg.style.width=width+'px';svg.style.height=height+'px'
 for(const edge of routeSkillTreeEdges(treeModel(s),nodes,branches)){
  const path=svg.querySelector<SVGPathElement>(`[data-from="${edge.from}"][data-to="${edge.to}"]`)!;path.setAttribute('d',edge.points.map((p,i)=>`${i?'L':'M'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' '));path.dataset.labelOnly=String(edge.labelOnly)
 }
 const selected=container.querySelector<HTMLElement>('.tree-node.picked');if(selected)highlightTreePath(container,s,selected.dataset.treeId!)
}
/** Existing locked-node feedback, with the same actual unmet parents and branch threshold. */
export function flashTreeParents(container:HTMLElement,id:string):void{
 const target=container.querySelector<HTMLElement>(`[data-tree-id="${id}"]`);if(!target?.classList.contains('is-locked'))return
 const ids=new Set([...container.querySelectorAll<SVGPathElement>(`.tree-edge[data-to="${id}"][data-met="false"]`)].map(e=>e.dataset.from!))
 const parents=[...ids].map(key=>container.querySelector<HTMLElement>(`[data-tree-id="${key}"]`)!).filter(Boolean)
 if(!parents.length&&Number(target.dataset.gateHave)<Number(target.dataset.gateNeed)){const heading=container.querySelector<HTMLElement>(`.tree-branch-heads [data-branch="${target.dataset.branch}"]`);if(heading)parents.push(heading)}
 for(const el of parents){el.classList.remove('needs-parent');void el.offsetWidth;el.classList.add('needs-parent');el.addEventListener('animationend',()=>el.classList.remove('needs-parent'),{once:true})}
}
