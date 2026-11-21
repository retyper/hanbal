import{test}from'node:test'
import assert from'node:assert/strict'
import{createHaebi,KITS,type Kit}from'../src/raid/haebi.ts'
import{treeModel}from'../src/raid/tree-model.ts'
import{skillTreeHtml,routeSkillTreeEdges,skillTreePath}from'../src/raid/skill-tree-view.ts'
type Rect={left:number;top:number;right:number;bottom:number}
test('new tree keeps all real nodes and sim state, adds three columns and adjacent names/ranks',()=>{
 for(const kit of Object.keys(KITS)as Kit[]){const s=createHaebi(57,'stage',kit),before=JSON.stringify(s),m=treeModel(s),h=skillTreeHtml(s),ids=[...h.matchAll(/data-tree-id="([^"]+)"/g)].map(x=>x[1]);assert.deepEqual([...ids].sort(),m.nodes.map(n=>n.id).sort());assert.equal(JSON.stringify(s),before);assert.equal((h.match(/class="skill-branch"/g)??[]).length,3);assert.equal((h.match(/class="skill-tier"/g)??[]).length,12);assert.equal((h.match(/class="skill-node-name"/g)??[]).length,m.nodes.length);assert.ok(!h.includes('<button'))}
})
test('local requirement labels keep exact actual parents, branch totals, AND combos and ANY ultimate',()=>{
 const s=createHaebi(57,'stage','dagger'),m=treeModel(s),h=skillTreeHtml(s);for(const n of m.nodes){assert.ok(h.includes(`data-tree-id="${n.id}"`));assert.ok(h.includes(n.name));for(const r of n.requirements)assert.ok(h.includes(`data-from="${r.from}" data-to="${n.id}" data-have="${r.have}" data-need="${r.need}"`))}assert.ok(h.includes('조합 하나'));assert.ok(h.includes('갈래 누적'));assert.ok(!h.includes('tree-edge-labels'))
})
function layout(s:ReturnType<typeof createHaebi>){const m=treeModel(s),nodes=new Map<string,Rect>(),branches=new Map();for(const[bIndex,b]of m.branches.entries()){const x=bIndex*300;branches.set(b.id,{left:x,top:0,right:x+300,bottom:600});for(const[t,row]of b.tiers.entries())for(const[i,n]of row.entries()){const y=t*150+(row.length===2?8+i*70:43);nodes.set(n.id,{left:x+16,top:y,right:x+284,bottom:y+52})}}for(const[i,n]of m.combos.entries())nodes.set(n.id,{left:i*300+16,top:630,right:i*300+284,bottom:720});nodes.set('ult',{left:16,top:750,right:884,bottom:820});return{m,nodes,branches}}
const cuts=(a:{x:number;y:number},b:{x:number;y:number},r:Rect)=>a.x===b.x?a.x>r.left&&a.x<r.right&&Math.min(a.y,b.y)<r.bottom&&Math.max(a.y,b.y)>r.top:a.y>r.top&&a.y<r.bottom&&Math.min(a.x,b.x)<r.right&&Math.max(a.x,b.x)>r.left
test('real graph orthogonal routes avoid unrelated cards; combo dependencies stay local labels',()=>{
 const{m,nodes,branches}=layout(createHaebi(57,'stage','sword')),r=routeSkillTreeEdges(m,nodes,branches);assert.equal(r.length,m.edges.length)
 for(const e of r){if(e.labelOnly){assert.equal(m.nodes.find(n=>n.id===e.to)!.kind,'combo');assert.equal(e.points.length,0);continue}assert.ok(e.points.length>=2);for(let i=1;i<e.points.length;i++){const a=e.points[i-1]!,b=e.points[i]!;assert.ok(a.x===b.x||a.y===b.y);for(const[id,rect]of nodes)if(id!==e.from&&id!==e.to)assert.ok(!cuts(a,b,rect),`${e.from}->${e.to} crosses ${id}`)}}
})
test('selected path uses real ancestry: counter depends on stout/tough, never imaginary breath parent',()=>{
 const m=treeModel(createHaebi(57,'stage','sword')),p=skillTreePath(m,'capC');assert.ok(p.has('capC')&&p.has('stout')&&p.has('tough'));assert.ok(!p.has('breath')&&!p.has('nimble'))
})
