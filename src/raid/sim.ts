import { P } from '../tune/params.ts'
export type Champion='haebi'|'mir'|'soseono'
export type Upgrade='power'|'haste'|'vital'
export interface Enemy {id:number;x:number;y:number;hp:number;max:number;kind:'club'|'archer'|'chief';cd:number;flash:number;wind:number;aimX:number;aimY:number}
export interface Shot {x:number;y:number;vx:number;vy:number;life:number;enemy:boolean;damage:number;hit:number[]}
export interface Raid {seed:number;hero:Champion;t:number;x:number;y:number;hp:number;maxHp:number;face:number;attack:number;dash:number;dashCd:number;skillCd:number;inv:number;cool:number;spawn:number;boss:boolean;kills:number;level:number;power:number;haste:number;upgrade:boolean;state:'playing'|'won'|'lost';enemies:Enemy[];shots:Shot[];fx:{x:number;y:number;r:number;life:number;kind:'hit'|'skill'|'swing'}[];next:number}
export interface Input {x:number;y:number;dash:boolean;skill:boolean}
export const W=960,H=600
export const HEROES={haebi:{name:'해비',weapon:'도끼 · 넓은 휩쓸기',range:P.raid.axeRange,damage:P.raid.axeDamage,cool:P.raid.axeCooldown},mir:{name:'미르',weapon:'활 · 적을 꿰뚫는 화살',range:P.raid.bowRange,damage:P.raid.bowDamage,cool:P.raid.bowCooldown},soseono:{name:'소서노',weapon:'창 · 긴 사거리의 찌르기',range:P.raid.spearRange,damage:P.raid.spearDamage,cool:P.raid.spearCooldown}} as const
function rand(s:Raid){s.seed=(Math.imul(s.seed,1664525)+1013904223)>>>0;return s.seed/4294967296}
function won(s:Raid){return s.state==='won'}
export function createRaid(hero:Champion,seed=7):Raid{return {seed,hero,t:0,x:W/2,y:H/2,hp:P.raid.health,maxHp:P.raid.health,face:1,attack:0,dash:0,dashCd:0,skillCd:0,inv:0,cool:.4,spawn:.3,boss:false,kills:0,level:1,power:1,haste:1,upgrade:false,state:'playing',enemies:[],shots:[],fx:[],next:1}}
function spawn(s:Raid,chief=false){const side=Math.floor(rand(s)*4),pos=rand(s);const kind=chief?'chief':rand(s)<.25?'archer':'club',hp=chief?620:kind==='archer'?42:50;s.enemies.push({id:s.next++,x:side===0?25:side===1?W-25:pos*(W-50)+25,y:side===2?35:side===3?H-25:pos*(H-65)+35,hp,max:hp,kind,cd:1+rand(s),flash:0,wind:0,aimX:0,aimY:0})}
function damage(s:Raid,e:Enemy,n:number){if(e.hp<=0)return;e.hp-=n;e.flash=.14;s.fx.push({x:e.x,y:e.y-22,r:12,life:.22,kind:'hit'});if(e.hp<=0){s.kills++;s.hp=Math.min(s.maxHp,s.hp+P.raid.killHeal);if(e.kind==='chief')s.state='won';if(s.kills>=s.level*8&&s.level<=4)s.upgrade=true}}
export function upgradeRaid(s:Raid,u:Upgrade){if(!s.upgrade)return;if(u==='power')s.power+=.28;if(u==='haste')s.haste+=.22;if(u==='vital'){s.maxHp+=20;s.hp=Math.min(s.maxHp,s.hp+45)}s.level++;s.upgrade=false}
export function stepRaid(s:Raid,input:Input,dt:number){
 if(s.state!=='playing'||s.upgrade)return
 dt=Math.min(dt,.05);s.t+=dt
 for(const key of ['attack','dash','dashCd','skillCd','inv','cool'] as const)s[key]=Math.max(0,s[key]-dt)
 let len=Math.hypot(input.x,input.y),dx=len?input.x/Math.max(1,len):0,dy=len?input.y/Math.max(1,len):0
 if(input.dash&&s.dashCd===0){s.dash=.2;s.inv=.4;s.dashCd=P.raid.dashCooldown}
 if(dx)s.face=Math.sign(dx)
 if(s.dash>0&&len===0)dx=s.face
 const speed=P.raid.speed*(s.dash>0?3.6:1)
 s.x=Math.max(30,Math.min(W-30,s.x+dx*speed*dt));s.y=Math.max(50,Math.min(H-20,s.y+dy*speed*dt))
 const hero=HEROES[s.hero]
 if(input.skill&&s.skillCd===0){s.skillCd=P.raid.skillCooldown;s.inv=.35;s.attack=.35;s.fx.push({x:s.x,y:s.y,r:220,life:.5,kind:'skill'});for(const e of s.enemies)if(Math.hypot(e.x-s.x,e.y-s.y)<220)damage(s,e,90*s.power)}
 const target=s.enemies.filter(e=>e.hp>0).sort((a,b)=>Math.hypot(a.x-s.x,a.y-s.y)-Math.hypot(b.x-s.x,b.y-s.y))[0]
 if(target&&s.cool===0&&Math.hypot(target.x-s.x,target.y-s.y)<=hero.range){
  s.cool=hero.cool/s.haste;s.attack=.3;s.face=target.x<s.x?-1:1
  const angle=Math.atan2(target.y-s.y,target.x-s.x)
  if(s.hero==='mir')s.shots.push({x:s.x,y:s.y-15,vx:Math.cos(angle)*470,vy:Math.sin(angle)*470,life:1.2,enemy:false,damage:hero.damage*s.power,hit:[]})
  else {s.fx.push({x:s.x+Math.cos(angle)*45,y:s.y+Math.sin(angle)*45,r:hero.range*.6,life:.2,kind:'swing'});for(const e of s.enemies){const ex=e.x-s.x,ey=e.y-s.y,dist=Math.hypot(ex,ey),forward=ex*Math.cos(angle)+ey*Math.sin(angle),side=Math.abs(ex*Math.sin(angle)-ey*Math.cos(angle));if(dist<=hero.range&&(s.hero==='haebi'?forward>-25:forward>0&&side<34))damage(s,e,hero.damage*s.power)}}
 }
 s.spawn-=dt;if(s.spawn<=0&&s.enemies.length<P.raid.maxEnemies){spawn(s);s.spawn=P.raid.spawnEvery/(1+s.t/65)}
 if(!s.boss&&s.t>=P.raid.bossAt){spawn(s,true);s.boss=true}
 for(const e of s.enemies){
  if(e.hp<=0)continue;e.cd=Math.max(0,e.cd-dt);e.flash=Math.max(0,e.flash-dt)
  let ex=s.x-e.x,ey=s.y-e.y,dist=Math.hypot(ex,ey)||1
  if(e.wind>0){e.wind-=dt;if(e.wind<=0&&s.inv===0&&Math.hypot(s.x-e.aimX,s.y-e.aimY)<72){s.hp-=23;s.inv=.7}}
  else if(e.kind==='chief'&&dist<130&&e.cd===0){e.wind=.8;e.aimX=s.x;e.aimY=s.y;e.cd=2.2}
  else if(e.kind==='archer'&&dist<320){if(e.cd===0){s.shots.push({x:e.x,y:e.y-15,vx:ex/dist*150,vy:ey/dist*150,enemy:true,life:3,damage:10,hit:[]});e.cd=2}}
  else if(dist>24){const v=e.kind==='chief'?46:38+s.t*.25;e.x+=ex/dist*v*dt;e.y+=ey/dist*v*dt}
  if(dist<27&&e.cd===0&&s.inv===0){s.hp-=8;s.inv=.65;e.cd=1}
 }
 for(const b of s.shots){b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;if(b.enemy){if(s.inv===0&&Math.hypot(b.x-s.x,b.y-(s.y-15))<20){s.hp-=b.damage;s.inv=.55;b.life=0}}else for(const e of s.enemies)if(e.hp>0&&!b.hit.includes(e.id)&&Math.hypot(b.x-e.x,b.y-(e.y-15))<26){damage(s,e,b.damage);b.hit.push(e.id);if(b.hit.length>=3)b.life=0}}
 s.enemies=s.enemies.filter(e=>e.hp>0);s.shots=s.shots.filter(b=>b.life>0);for(const f of s.fx)f.life-=dt;s.fx=s.fx.filter(f=>f.life>0)
 if(s.hp<=0){s.hp=0;s.state='lost'}else if(s.t>=P.raid.duration&&!won(s))s.state='lost'
}
