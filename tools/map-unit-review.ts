import { mapHtml, MAP_CSS, type MapToken } from '../src/ui/realm/mapview.ts'
import { mapSquad } from '../src/ui/realm/map-unit.ts'
import { startRegion } from '../src/realm/data/regions/index.ts'
import { paintMapCanvas } from '../src/ui/realm/mapcanvas.ts'
import type { Hero } from '../src/realm/types.ts'
const css=document.createElement('style');css.textContent=MAP_CSS;document.head.append(css)
const r=startRegion('byeonhan-mini',7,'us'), army=Object.values(r.armies).find(a=>a.faction===r.player)!
const chooser=document.querySelector<HTMLSelectElement>('#hero')!, moving=document.querySelector<HTMLInputElement>('#moving')!
let selected=false
function render(){
 const value=chooser.value
 const hero=value==='none'?undefined:{...Object.values(r.heroes)[0]!,id:value==='mir'?'dm-mir':'tut-haebi',ascended:value==='aw1-haebi'} as Hero
 const token:MapToken={army:army.id,node:army.at,men:600,morale:1,sel:selected,going:moving.checked,img:'',squad:mapSquad(['spear'],hero,'/realm/')}
 document.querySelector('#stage')!.innerHTML=mapHtml(r,r.player,'/realm/',[], '',null,[token])
 document.querySelector<HTMLElement>('.map')!.dataset.zl='near'
 paintMapCanvas(document.querySelector<HTMLElement>('#stage')!)
 document.querySelector('.tok')?.addEventListener('click',()=>{selected=!selected;render();document.querySelector('#status')!.textContent=selected?'부대 선택됨':'부대 선택 해제'})
}
chooser.onchange=()=>render();moving.onchange=()=>render();render()
