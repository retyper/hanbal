import { FULL20_ATLASES } from '../src/realm/data/full20Generated.ts'
import { AWAKENED_BY_BASE } from '../src/realm/data/awakenedSpritesGenerated.ts'
import { warHtml, WAR_CSS, roundPlan } from '../src/ui/realm/battlefield.ts'
import { playBattleStrikes } from '../src/ui/realm/battle-strikes.ts'
import { battlePlayback } from '../src/ui/realm/battle-playback.ts'
import { fightRounds, type Side } from '../src/realm/tactics.ts'
import { startRegion } from '../src/realm/data/regions/index.ts'
import { GEN_OWN } from '../src/realm/data/art.ts'
import type { BattleLine } from '../src/realm/warroom.ts'
import type { Hero, RoundLog } from '../src/realm/types.ts'
// Presentation-only fixture. No sound, voice, music or combat action handlers.
const css=document.createElement('style');css.textContent=WAR_CSS;document.head.append(css)
const select=document.querySelector<HTMLSelectElement>('#hero')!
const response=await fetch('/tools/sprite-kit/batch30-20261113/reviewed.json')
const reviewed=await response.json() as {approved:string[]}
const keys=[...new Set(['aryeong','haebi','soseono','heo','gamsil',...Object.keys(AWAKENED_BY_BASE),...reviewed.approved,...Object.keys(FULL20_ATLASES)])]
for(const key of keys){const o=document.createElement('option');o.value=key;o.textContent=key;select.append(o)}
select.value=new URLSearchParams(location.search).get('hero')??'eomni'
document.querySelector<HTMLSelectElement>('#awakening')!.value=new URLSearchParams(location.search).get('ascended')==='1'?'1':'0'
const stage=document.querySelector<HTMLDivElement>('#stage')!
let active='idle'
let timeline: Animation[]=[]
let stopStrikes=()=>{}
let activeClock:ReturnType<typeof battlePlayback>|null=null
function render(mode=active){
 stopStrikes()
 activeClock=null
 active=mode
 document.querySelector('#status')!.textContent='무음 동작 검수 · '+mode
 const r=startRegion('byeonhan-mini',7,'us')
 const ours=Object.values(r.armies).find(a=>a.faction===r.player)!
 const foe=Object.values(r.armies).find(a=>a.faction!==r.player&&a.march===null)!
 const key=select.value, id=Object.entries(GEN_OWN).find(([,k])=>k===key)![0]
 const foeId=Object.entries(GEN_OWN).find(([,k])=>k==='aryeong')![0]
 const base=Object.values(r.heroes)[0]!
 r.heroes[id]={...base,id,name:key,faction:r.player,ascended:document.querySelector<HTMLSelectElement>('#awakening')?.value==='1'} as Hero
 r.heroes[foeId]={...base,id:foeId,name:'알영',faction:foe.faction} as Hero
 const line={kind:'battle',node:foe.at,attacker:ours.id,allies:[],pincer:false,defender:foe.faction,
 ambush:'none',p:0.5,outcome:document.querySelector<HTMLSelectElement>('#gate-state')?.value==='broken'?'win':'lose',captured:null,killed:null,militia:0,atkFaction:r.player,
 start:{men:[600,600],morale:[1,1],heroes:[id,foeId],mix:[{spear:400,bow:200},{spear:400,bow:200}]},rounds:[]} as unknown as BattleLine
 stage.innerHTML='<div class="wr">'+warHtml(r,r,line,r.player,'/realm/',0,false,1)+'</div>'
 const field=stage.querySelector<HTMLElement>('.wfield')!
 field.classList.remove('enter','fin','win-us','win-foe')
 field.style.setProperty('--entry-time','2.4s');field.style.setProperty('--entry-delay','0s');field.style.setProperty('--hd','1.3s')
 if(mode==='entry')field.classList.add('enter')
 if(mode==='move')for(const side of field.querySelectorAll('.wf2s'))side.classList.add('mv')
 if(mode==='charge'){
  field.classList.add('play')
  for(const side of field.querySelectorAll<HTMLElement>('.wf2s')){side.dataset.l='art';side.style.setProperty('--hd','1.3s')}
 }
 timeline=stage.getAnimations({subtree:true})
 if(mode==='paired'){
  document.querySelector('#status')!.textContent='무음 맞붙기 재생 중'
  field.classList.add('play')
  const side=(id:string,player:boolean):Side=>({F:600,mix:{spear:400,bow:200},morale:1,hero:{id,mu:5,ryak:5,coward:false},hungry:false,specials:[],water:false,player,seen:true})
  const fight=fightRounds(side(id,true),side(foeId,false),'sprite-review',7,0,{cmds:[{front:'charge',bows:'volley',lead:'drum'}],open:true})
  const raw=fight.rounds[0]!
  // Fixed leader clash fixture exercises both new sprites with the production engine.
  const round:RoundLog={...raw,ev:'duel-win',acts:[...(raw.acts??[]).filter(a=>a.g!=='lead'),
    {s:'a',g:'lead',c:'duel',n:1,res:'won'},{s:'d',g:'lead',c:'duel',n:1,res:'lost'}]}
  const plan=roundPlan(round,true)
  activeClock=battlePlayback(Number(document.querySelector<HTMLSelectElement>('#rate')!.value))
  let contacts=0
  stopStrikes=playBattleStrikes(field,round,plan.beats,plan.clash,plan.result,true,'/realm/',activeClock,()=>{
   document.querySelector('#status')!.textContent='무음 맞붙기 · 접촉 '+(++contacts)+'회 (동작 검수용 고정 기록)'
  })
 }
}
for(const b of document.querySelectorAll<HTMLButtonElement>('[data-mode]'))b.onclick=()=>render(b.dataset.mode!)
select.onchange=()=>render()
document.querySelector<HTMLSelectElement>('#gate-state')?.addEventListener('change',()=>render())
document.querySelector<HTMLSelectElement>('#awakening')?.addEventListener('change',()=>render())
document.querySelector<HTMLInputElement>('#seek')!.oninput=(e)=>{
 const time=Number((e.target as HTMLInputElement).value)
 document.querySelector<HTMLOutputElement>('#time')!.value=time+'ms'
 for(const a of timeline){a.pause();a.currentTime=time}
}
document.querySelector<HTMLButtonElement>('#pause')!.onclick=()=>{
 const animations=stage.getAnimations({subtree:true});const running=animations.some(a=>a.playState==='running')
 activeClock?.setRate(running?0:Number(document.querySelector<HTMLSelectElement>('#rate')!.value))
 for(const a of animations)running?a.pause():a.play()
}
document.addEventListener('visibilitychange',()=>{for(const a of stage.getAnimations({subtree:true}))document.hidden?a.pause():a.play()})
render()
