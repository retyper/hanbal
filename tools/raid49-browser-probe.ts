/** 49 실제 브라우저 검수. 판은 읽기만 한다. CDP 실제 마우스/키 입력과 기존 개발 검수 UI만 사용한다.
 * node --experimental-strip-types tools/raid49-browser-probe.ts <출력 폴더> [smoke|review] [주소]
 * REVIEW_UNTIL=1146, KIT=bow, STAGE=forest. review는 실제입력 봇 재생을 사용한 보조 검수이며 수동 한 판 완주 증거가 아니다.
 * 결과 PNG/JSON은 저장소 밖 폴더로 지정한다. HTML 대체/체력·능력·시간·state 직접 주입 없음.
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = process.argv[2]
if (!out) throw new Error('저장소 밖 출력 폴더를 지정하세요')
const mode = process.argv[3] ?? 'smoke', origin = process.argv[4] ?? 'http://localhost:5174'
const port = 9720 + Math.floor(Math.random() * 40), sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const exe = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(existsSync)
if (!exe) throw new Error('Chrome 없음')
mkdirSync(out, { recursive: true })
const prof = mkdtempSync(join(tmpdir(), 'raid49-'))
const chrome = spawn(exe, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${prof}`, '--window-size=844,390', '--no-first-run', '--mute-audio', 'about:blank'], { stdio: 'ignore' })
const report: any = { mode, action: process.env['END_ACTION'] ?? 'complete', evidence: mode === 'review' ? '기존 개발 UI의 실제입력 봇 재생 후 실제 CDP 키 입력 보조검수' : '실제 출전/키보드/일시정지/철수 입력', errors: [], resources: [], checks: [], shots: [] }
let ws: WebSocket | undefined
try {
  let tabs: any
  for (let i = 0; i < 50 && !tabs; i++) { try { tabs = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json() } catch { await sleep(200) } }
  ws = new WebSocket(tabs.find((t: any) => t.type === 'page').webSocketDebuggerUrl)
  await new Promise((r, j) => { ws!.onopen = r; ws!.onerror = j })
  let id = 0
  const waits = new Map<number, (v: any) => void>()
  const call = (method: string, params: object = {}): Promise<any> => new Promise((r, j) => {
    const n = ++id, timer = setTimeout(() => { waits.delete(n); j(new Error(`CDP timeout ${method}`)) }, 120000)
    waits.set(n, v => { clearTimeout(timer); r(v) }); ws!.send(JSON.stringify({ id: n, method, params }))
  })
  ws.onmessage = e => {
    const m = JSON.parse(String(e.data))
    if (m.id !== undefined) { waits.get(m.id)?.(m.result ?? { error: m.error }); waits.delete(m.id); return }
    if (m.method === 'Runtime.exceptionThrown') report.errors.push(m.params.exceptionDetails)
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') report.errors.push(m.params.args)
    if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') { if (m.params.entry.source === 'network') report.resources.push(m.params.entry); else report.errors.push(m.params.entry) }
  }
  const ev = async (expression: string) => {
    const r = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    if (r.exceptionDetails || r.error) throw new Error(JSON.stringify(r.exceptionDetails ?? r.error))
    return r.result?.value
  }
  const check = (ok: boolean, what: string, detail?: any) => { report.checks.push({ ok, what, detail }); console.log(`${ok ? '통과' : '실패'} ${what}${detail === undefined ? '' : ' ' + JSON.stringify(detail)}`) }
  const waitFor = async (expression: string, ms = 30000) => { const end = Date.now() + ms; while (Date.now() < end) { if (await ev(expression)) return; await sleep(100) } throw new Error(`조건 시간 초과: ${expression}`) }
  const size = async (width: number, height: number, mobile = true) => { await call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 2, mobile }); await sleep(300) }
  const click = async (sel: string) => {
    await ev(`document.querySelector(${JSON.stringify(sel)})?.scrollIntoView({block:'nearest'})`)
    const p = await ev(`(() => { const e=document.querySelector(${JSON.stringify(sel)}); if(!e || e.disabled) return null; const b=e.getBoundingClientRect(); const x=b.x+b.width/2,y=b.y+b.height/2; return {x,y,hit:e===document.elementFromPoint(x,y)||e.contains(document.elementFromPoint(x,y))} })()`)
    if (!p?.hit) throw new Error(`단추 실제 노출 실패 ${sel}: ${JSON.stringify(p)}`)
    await call('Input.dispatchMouseEvent', { type: 'mousePressed', x: p.x, y: p.y, button: 'left', clickCount: 1 })
    await call('Input.dispatchMouseEvent', { type: 'mouseReleased', x: p.x, y: p.y, button: 'left', clickCount: 1 })
  }
  const key = async (k: string, code: string, duration = 40) => { await call('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code }); await sleep(duration); await call('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code }) }
  const touchPoint = (sel: string) => ev(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(!e)return null;const b=e.getBoundingClientRect(),x=b.x+b.width/2,y=b.y+b.height/2,top=document.elementFromPoint(x,y);return{x,y,hit:e===top||e.contains(top),disabled:e.disabled}})()`)
  const touchStart = (p: any) => call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:p.x,y:p.y,id:1,force:1,radiusX:1,radiusY:1}]})
  const touchEnd = () => call('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]})
  const tap = async (sel: string) => {const p=await touchPoint(sel);if(!p?.hit||p.disabled)throw new Error('실제 touch 노출 실패 '+sel+': '+JSON.stringify(p));await touchStart(p);await sleep(60);await touchEnd();await sleep(80)}
  const tabTo = async (id: string) => {for(let n=0;n<40;n++){if(await ev(`document.activeElement?.id===${JSON.stringify(id)}`))return;await key('Tab','Tab')}throw new Error('Tab으로 대상에 도달하지 못함: '+id)}
  const snap = async (label: string) => { const r = await call('Page.captureScreenshot', { format: 'png' }); const path = join(out, `${mode}-${label}.png`); writeFileSync(path, Buffer.from(r.data, 'base64')); report.shots.push(path) }
  const read = () => ev(`(() => { const r=window.__raid?.(); return {t:r?.t,state:r?.state,form:r?.form,hp:r?.hp,x:r?.x,y:r?.y,kills:r?.kills,enemies:r?.enemies.length,boss:r?.enemies.find(e=>e.kind==='boss'),offers:r?.offers,overlay:!document.querySelector('#overlay')?.hidden,result:!!document.querySelector('#overlay:not([hidden]) .result'),feel:window.__raidFeel?.(),end:window.__raidEnd?.(),visibility:document.visibilityState} })()`)
  const canvasReport = () => ev(`(() => {const x=window.__raid49Draw;return x?{reads:x.reads,fx:x.fx,sources:x.sources,raw:x.raw,heroFrames:x.heroFrames,hitArt:x.hitArt,raysNextSprite:x.raysNextSprite,fieldMatrix:x.fieldMatrix,firstHit:x.firstHit}:null})()`)
  const installPacing = async (bootstrap: string) => ev(`(async()=>{
    const H=await import('/src/raid/haebi.ts'),V=await import('/src/raid/haebi-view.ts'),P=await import('/src/tune/params.ts'),C=P.HAEBI_RUN;
    const stats=window.__raid50={bootstrap:${JSON.stringify(bootstrap)},config:{surge:C.surgeSeconds,respite:C.respiteSeconds,restSpawn:C.respiteSpawn,rangedShare:C.stageRangedShare},cycles:{},phaseTransitions:[],kindBirths:{},earlyRangedBirths:0,runnerWind:0,runnerLocal:0,runnerWhite:0,runnerLaneViolations:0,newBarrageShots:0,deadSourceViolations:0,offscreenBarrageSamples:0,carrierDeaths:0,pendingCancelledOnDeath:0,events:[]};
    let previous=null,lastT=0,lastPhase='',seen=new Set(),priorSources=new Map();const shots=new WeakSet();
    const tick=()=>{const r=window.__raid?.();if(r&&r.t>0&&r.state==='playing'&&(r!==previous||r.t!==lastT)){if(r!==previous){previous=r;lastT=r.t;lastPhase='';seen=new Set(${JSON.stringify(bootstrap)}==='actual'?[]:r.enemies.map(e=>e.id));priorSources=new Map()}
      const rest=H.respite(r),phase=rest?'respite':'surge',cycle=Math.floor(r.t/(C.surgeSeconds+C.respiteSeconds)),c=stats.cycles[cycle]??={surgeTime:0,respiteTime:0,surgeBirths:0,respiteBirths:0};
      c[rest?'respiteTime':'surgeTime']+=Math.max(0,r.t-lastT);lastT=r.t;
      if(phase!==lastPhase){if(stats.phaseTransitions.length<12)stats.phaseTransitions.push({t:r.t,phase});lastPhase=phase}
      for(const e of r.enemies){if(!seen.has(e.id)){seen.add(e.id);c[rest?'respiteBirths':'surgeBirths']++;stats.kindBirths[e.kind]=(stats.kindBirths[e.kind]||0)+1;if(r.t<H.bossTime(r)*3/5&&H.rangedMob(e.kind))stats.earlyRangedBirths++}
        if(e.kind==='runner'&&e.act>0){stats.runnerWind++;const k=V.chargeRecoil(e);if(k>0)stats.runnerLocal++;if(k>1-P.HAEBI_IMPACT.whiteTime/P.HAEBI_IMPACT.mobFlash)stats.runnerWhite++;if(V.chargeLane(e))stats.runnerLaneViolations++}}
      const alive=new Map(r.enemies.filter(e=>e.hp>0).map(e=>[e.id,e])),owners=new Map();
      for(const b of r.shots)if(b.kind==='barrage'){owners.set(b.source,(owners.get(b.source)||0)+1);const e=alive.get(b.source);if(!e)stats.deadSourceViolations++;if(!shots.has(b)){shots.add(b);stats.newBarrageShots++;if(stats.events.length<12)stats.events.push({event:'barrage-born',t:r.t,source:b.source,hp:e?.hp})}
        const m=window.__raid49Draw?.fieldMatrix;if(e&&m){const x=m[0]*e.x+m[4],y=m[3]*e.y+m[5];if(x<-.5||x>C.width+.5||y<-.5||y>C.height+.5)stats.offscreenBarrageSamples++}}
      for(const [id,n]of priorSources)if(!alive.has(id)){stats.carrierDeaths++;if(!owners.has(id))stats.pendingCancelledOnDeath++;if(stats.events.length<12)stats.events.push({event:'carrier-died',t:r.t,source:id,pendingBefore:n,pendingAfter:owners.get(id)||0})}priorSources=owners;
    }requestAnimationFrame(tick)};requestAnimationFrame(tick);return stats.config;
  })()`)
  const drive = async (goal: number, wallLimit = 120000, powers = true) => {
    const held=new Set<string>(),stop=Date.now()+wallLimit
    while(Date.now()<stop){const r=await read();if(r.state!=='playing'||r.t>=goal)break
      const next=await ev(`(async()=>{const r=window.__raid(),B=await import('/src/raid/haebi-replay.ts');return {input:B.botInput(r),pick:r.offers.length?B.botChoice(r,'storm'):null}})()`)
      if(next.pick){await click('#overlay [data-up="'+next.pick+'"]');continue}
      const i=next.input,want=new Set<string>();if(i.x<-.2)want.add('ArrowLeft');else if(i.x>.2)want.add('ArrowRight');if(i.y<-.2)want.add('ArrowUp');else if(i.y>.2)want.add('ArrowDown')
      for(const k of held)if(!want.has(k)){await call('Input.dispatchKeyEvent',{type:'keyUp',key:k,code:k});held.delete(k)}
      for(const k of want)if(!held.has(k)){await call('Input.dispatchKeyEvent',{type:'keyDown',key:k,code:k});held.add(k)}
      if(powers){if(i.skill)await key(' ','Space');if(i.dash)await key('Shift','ShiftLeft');if(i.wake)await key('e','KeyE')}await sleep(75)
    }
    for(const k of held)await call('Input.dispatchKeyEvent',{type:'keyUp',key:k,code:k})
    return read()
  }
  const exerciseEnding = async () => {
    const first = await read()
    check(first.end?.active && !first.result, '종결 첫 화면에서 끝 연출 진행·결과 창 숨김', first.end)
    if (report.action === 'hidden') {
      await call('Emulation.setFocusEmulationEnabled', { enabled: false })
      const tab = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json()
      const cover = new WebSocket(tab.webSocketDebuggerUrl)
      await new Promise((r, j) => { cover.onopen = r; cover.onerror = j })
      const front = new Promise<void>(resolve => { cover.onmessage = e => { if (JSON.parse(String(e.data)).id === 1) resolve() } })
      cover.send(JSON.stringify({ id: 1, method: 'Page.bringToFront' })); await front
      const hidden0 = await read(); await sleep(1100); const hidden1 = await read()
      report.hidden = { before: hidden0, after: hidden1 }
      check(hidden0.visibility === 'hidden' && hidden1.visibility === 'hidden', '실제 다른 탭 전환으로 document hidden', report.hidden)
      check(hidden0.end?.elapsed === hidden1.end?.elapsed, '숨긴 동안 끝 연출 벽시계 고정', { before: hidden0.end, after: hidden1.end })
      await call('Page.bringToFront'); await call('Emulation.setFocusEmulationEnabled', { enabled: true }); cover.close(); await fetch(`http://127.0.0.1:${port}/json/close/${tab.id}`)
      report.hidden.restored = await read()
      check(report.hidden.restored.visibility === 'visible' && report.hidden.restored.end.elapsed - hidden1.end.elapsed < .25, '탭 복원 직후 숨긴 시간을 따라잡지 않음', report.hidden.restored)
    } else if (report.action === 'skip') {
      const before = await read(), at = Date.now()
      await call('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 430, y: 190 }] })
      await call('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
      await waitFor(`!!document.querySelector('#overlay:not([hidden]) .result')`, 1000)
      const after = await read(); report.skip = { before, after, delayMs: Date.now() - at }
      check(after.end?.ready && after.end.elapsed === after.end.duration && after.state === before.state && report.skip.delayMs < 1000, '실제 화면 tap으로 건너뛰고 같은 판 결과 유지', report.skip)
      await snap('skipped-result'); return
    }
    await waitFor(`window.__raidEnd().elapsed >= Math.min(.7,window.__raidEnd().duration)`, 5000)
    if (process.env['NO_END_SHOTS'] !== '1' && process.env['HIT_ONLY'] !== '1') await snap('ending-early')
    if (first.end?.kind==='defeat' && process.env['OBSERVE_CANVAS']==='1') { await waitFor('window.__raidEnd().elapsed >= 1.8',5000); await snap('ending-full-hit-body') }
    if (Number.isFinite(first.end?.stampAt)) {
      await waitFor(`window.__raidEnd().elapsed >= window.__raidEnd().stampAt + .12`, 5000)
      const announcement = await ev(`(() => {const e=document.querySelector('#announcement');return {text:e.textContent,visible:e.classList.contains('visible'),opacity:getComputedStyle(e).opacity}})()`)
      check(!announcement.visible && Number(announcement.opacity) === 0, '도장 시점에 기존 전투 알림 띠 숨김', announcement)
      if (process.env['NO_END_SHOTS'] !== '1' && process.env['HIT_ONLY'] !== '1') await snap('ending-stamp')
    }
    await waitFor(`!!document.querySelector('#overlay:not([hidden]) .result')`, 10000)
    const done = await read()
    check(done.end?.ready && done.end.elapsed === done.end.duration, '끝 연출 시계가 정해진 길이까지 돈 뒤 결과 표시', done.end)
  }
  await call('Page.enable'); await call('Runtime.enable'); await call('Log.enable')
  if(mode==='card-ui'){
    const source=`(()=>{const d=Object.getOwnPropertyDescriptor(HTMLImageElement.prototype,'src');if(!d?.set||!d?.get)throw new Error('image src descriptor missing');window.__card50={images:[]};Object.defineProperty(HTMLImageElement.prototype,'src',{...d,set:function(value){d.set.call(this,value);if(String(value).includes('ui-card-branch-'))window.__card50.images.push(this)}})})()`
    new Function(source);await call('Page.addScriptToEvaluateOnNewDocument',{source})
  }
  if(mode==='pause-ui')await call('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1})
  if (process.env['OBSERVE_CANVAS'] === '1') await call('Page.addScriptToEvaluateOnNewDocument', { source: String.raw`(() => {
    const labels=new WeakMap(), anonymous=new WeakMap();let serial=0;const state=window.__raid49Draw={reads:0,fx:{},sources:{},raw:{},heroFrames:{},hitArt:{},raysPending:false,raysNextSprite:{count:0},fieldMatrix:null,firstHit:null,startReads:0,lastHp:null};
    const proto=CanvasRenderingContext2D.prototype, draw=proto.drawImage, read=proto.getImageData;
    proto.getImageData=function(...args){state.reads++;return read.apply(this,args)};
    proto.drawImage=function(source,...args){const result=draw.call(this,source,...args);let key=typeof source?.src==='string'?new URL(source.src,location.href).pathname:labels.get(source);
      if(typeof source?.src==='string' && /raid\/fx\//.test(key))state.sources[key]={complete:source.complete,naturalWidth:source.naturalWidth,naturalHeight:source.naturalHeight};
      if(key && this.canvas.id!=='field' && /raid\/fx\/|anim-px\//.test(key))labels.set(this.canvas,key);
      if(!key&&source instanceof ImageBitmap){if(!anonymous.has(source))anonymous.set(source,'bitmap:'+(++serial)+':'+source.width+'x'+source.height);key=anonymous.get(source);}
      if(this.canvas.id==='field'&&args.length===2&&source.width===1120&&source.height===720){const m=this.getTransform();state.fieldMatrix=[m.a,m.b,m.c,m.d,m.e,m.f]}
      if(key && this.canvas.id==='field'){
        state.raw[key]=(state.raw[key]||0)+1;
        if(key.endsWith('fx_victory_rays.png'))state.raysPending=true;else if(state.raysPending&&args.length===8){state.raysPending=false;state.raysNextSprite={count:state.raysNextSprite.count+1,key,args};}
        if(/raid\/fx\//.test(key)){const old=state.fx[key]||{count:0};state.fx[key]={count:old.count+1,args,matrix:Array.from(this.getTransform().toFloat64Array())};}
        if((/anim-px\/.*(dana|haebi)/.test(key)||key.startsWith('bitmap:'))&&args.length===8){const counts=state.heroFrames[key]??={};const frame=args.slice(0,4).join(',');counts[frame]=(counts[frame]||0)+1;}
        if(/realm\/hit\//.test(key)){const old=state.hitArt[key]||{count:0};state.hitArt[key]={count:old.count+1,args,naturalWidth:source.naturalWidth,naturalHeight:source.naturalHeight};}
      }return result;};
    const tick=()=>{const r=window.__raid?.();if(r){if(state.lastHp!==null&&r.hp<state.lastHp&&!state.firstHit)state.firstHit={t:r.t,hp:r.hp,reads:state.reads,readDelta:state.reads-state.startReads};state.lastHp=r.hp}requestAnimationFrame(tick)};requestAnimationFrame(tick);
  })()` })
  await call('Emulation.setFocusEmulationEnabled', { enabled: true })
  await size(844, 390, !mode.startsWith('keyboard')&&mode!=='card-ui'&&mode!=='tree-ui')
  const q = new URLSearchParams({ kit: process.env['KIT'] ?? 'bow', sprite: process.env['HERO_SPRITE'] ?? 'base-w-102-garak-dana', hero: process.env['HERO_ID'] ?? 'w-102-garak-dana', name: process.env['HERO_NAME'] ?? '다나', bust: process.env['HERO_BUST'] ?? 'w-102-garak-dana' })
  if (mode === 'review'||mode==='pacing-review') { q.set('review', ''); q.set('stage', process.env['STAGE'] ?? 'forest') }
  report.url = `${origin}/raid.html?${q}`
  await call('Page.navigate', { url: report.url })
  await waitFor(`document.querySelector('#start')?.disabled === false`, 45000)
  check(report.errors.length === 0, '첫 로드 console/exception 오류 0', report.errors)
  check((await read()).visibility === 'visible', '탭 visible')
  if (process.env['OBSERVE_CANVAS'] === '1') { report.canvasBoot = await canvasReport(); report.fxBoot=report.canvasBoot?.sources; check(Object.keys(report.fxBoot??{}).length===10&&Object.values(report.fxBoot??{}).every((x:any)=>x.complete&&x.naturalWidth>0),'실제 warmFx 공유 이미지 10개 로드·native 크기 양수',report.fxBoot) }
  if(mode==='tree52-ui'){
    report.evidence='52 frozen DEV 정상Enter출전/P나무/실첫성장/native입력. canonical haebi 부모·gate·combo만읽기. SVG실좌표와DOM그림bbox대조. sim/meta/storage쓰기0.'
    const nativeClick=async(sel:string,touch=false)=>{const p=await touchPoint(sel);if(!p?.hit)throw new Error('52 실제입력 가림 '+sel+JSON.stringify(p));if(touch){await touchStart(p);await sleep(50);await touchEnd()}else{await call('Input.dispatchMouseEvent',{type:'mousePressed',x:p.x,y:p.y,button:'left',clickCount:1});await call('Input.dispatchMouseEvent',{type:'mouseReleased',x:p.x,y:p.y,button:'left',clickCount:1})}await sleep(60)}
    const tabSelector=async(sel:string)=>{for(let n=0;n<45;n++){if(await ev(`document.activeElement?.matches(${JSON.stringify(sel)})`))return;await key('Tab','Tab')}throw new Error('52 nativeTab 미도달 '+sel)}
    const graph=()=>ev(`(async()=>{const H=await import('/src/raid/haebi.ts'),P=await import('/src/tune/params.ts'),s=window.__raid(),T=P.HAEBI_TREE,combos=H.kitCombos(s.kit),expected=[];for(const p of H.kitPowers(s.kit)){const from=H.nodeParent(s.kit,p);if(from)expected.push({from,to:p,kind:'power',have:s.ranks[from],need:1,group:'all'})}for(const c of combos)for(const [from,need]of Object.entries(c.needs))expected.push({from,to:c.id,kind:'power',have:s.ranks[from],need,group:'all'});for(const c of combos)expected.push({from:c.id,to:'ult',kind:'combo',have:H.comboRank(s,c.id),need:T.max,group:'any'});const nodes=[...document.querySelectorAll('[data-tree-id]')].map(e=>{const id=e.dataset.treeId,kind=e.dataset.node?'power':e.dataset.combo?'combo':'ult',rank=kind==='power'?s.ranks[id]:kind==='combo'?H.comboRank(s,id):Number(H.ultUpgraded(s)),open=kind==='power'?H.nodeOpen(s,id):kind==='combo'?H.comboReady(s,combos.find(c=>c.id===id)):H.ultUpgraded(s),state=rank?'is-earned':open?'is-open':'is-locked',offered=kind!=='ult'&&s.offers.includes(id),at=kind==='power'?H.nodeAt(s.kit,id):null;return{id,kind,rank,open,state,offered,classes:e.className,gateHave:+e.dataset.gateHave,gateNeed:+e.dataset.gateNeed,branch:at?.branch,parent:kind==='power'?H.nodeParent(s.kit,id):null,rankShown:!!e.querySelector('.tree-rank'),lockShown:!!e.querySelector('.tree-lock'),focus:e.tabIndex===0&&e.getAttribute('role')==='button',matches:e.classList.contains(state)&&e.classList.contains('is-offered')===offered&&!!e.querySelector('.tree-rank')===(kind!=='ult'&&rank>0)&&(!at||+e.dataset.gateHave===(T.tiers[at.tier]?H.branchPoints(s,at.branch):0)&&+e.dataset.gateNeed===T.tiers[at.tier])}});const edges=[...document.querySelectorAll('.tree-edge')].map(e=>{const a={from:e.dataset.from,to:e.dataset.to,kind:e.dataset.kind,have:+e.dataset.have,need:+e.dataset.need,group:e.dataset.group,met:e.dataset.met==='true'},x=expected.find(x=>x.from===a.from&&x.to===a.to);return{...a,matches:!!x&&['from','to','kind','have','need','group'].every(k=>x[k]===a[k])&&a.met===(a.have>=a.need)&&e.classList.contains('is-open')===a.met,marker:e.getAttribute('marker-end')}});return{kit:s.kit,t:s.t,ranks:{...s.ranks},offers:[...s.offers],nodes,edges,expectedEdges:expected,glow:nodes.filter(n=>n.classes.includes('is-offered')).map(n=>n.id),bodyImages:document.querySelectorAll('.tree-board img').length,visibleNodeNames:document.querySelectorAll('.tree-board .tree-name').length,legacyRequirements:document.querySelectorAll('.tree-requirement').length,gates:[...document.querySelectorAll('.tree-gate')].map(e=>({for:e.dataset.for,branch:e.dataset.branch,need:+e.dataset.need,text:e.textContent}))}})()`)
    const view=()=>ev(`(()=>{const flat=r=>({x:r.x,y:r.y,right:r.right,bottom:r.bottom,w:r.width,h:r.height}),panel=document.querySelector('.tree-panel'),pr=panel.getBoundingClientRect(),inside=r=>r.x>=pr.x+panel.clientLeft-1&&r.right<=pr.x+panel.clientLeft+panel.clientWidth+1&&r.y>=pr.y+panel.clientTop-1&&r.bottom<=pr.y+panel.clientTop+panel.clientHeight+1,nodes=[...document.querySelectorAll('[data-tree-id]')].map(e=>{const p=e.querySelector('.tree-node-picture'),r=p.getBoundingClientRect(),im=p.querySelector('img'),ir=im.getBoundingClientRect(),top=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2),rank=e.querySelector('.tree-rank'),rr=rank?.getBoundingClientRect();return{id:e.dataset.treeId,rect:flat(r),image:flat(ir),imageLoaded:im.complete&&im.naturalWidth>0,imageCount:e.querySelectorAll('img').length,inside:inside(r)&&(!rr||inside(rr)),hit:e===top||e.contains(top),rankGap:rr?rr.y-r.bottom:null,rankFont:rank?parseFloat(getComputedStyle(rank).fontSize):12,offered:e.classList.contains('is-offered'),animation:getComputedStyle(p).animationName}}),byId=new Map(nodes.map(n=>[n.id,n])),dist=(p,r)=>Math.hypot(Math.max(r.x-p.x,0,p.x-r.right),Math.max(r.y-p.y,0,p.y-r.bottom)),edges=[...document.querySelectorAll('.tree-edge')].map(e=>{const len=e.getTotalLength(),m=e.getScreenCTM(),a=e.getPointAtLength(0),b=e.getPointAtLength(len),start=new DOMPoint(a.x,a.y).matrixTransform(m),end=new DOMPoint(b.x,b.y).matrixTransform(m),from=byId.get(e.dataset.from),to=byId.get(e.dataset.to),marker=e.getAttribute('marker-end'),id=marker?.split('#')[1]?.replace(')','');return{from:e.dataset.from,to:e.dataset.to,d:e.getAttribute('d'),length:len,start:{x:start.x,y:start.y},end:{x:end.x,y:end.y},fromDistance:from?dist(start,from.rect):null,toDistance:to?dist(end,to.rect):null,marker,markerHasHead:!!id&&!!document.getElementById(id)?.querySelector('path'),stroke:getComputedStyle(e).stroke,dash:getComputedStyle(e).strokeDasharray,opacity:getComputedStyle(e).opacity}}),headers=[...document.querySelectorAll('.tree-branch-heads h3')].map(e=>({branch:e.dataset.branch,rect:flat(e.getBoundingClientRect())})),info=document.querySelector('.tree-info'),ir=info.getBoundingClientRect(),close=document.querySelector('.tree-close'),cr=close.getBoundingClientRect(),ct=document.elementFromPoint(cr.x+cr.width/2,cr.y+cr.height/2),gates=[...document.querySelectorAll('.tree-gate')].map(e=>{const r=e.getBoundingClientRect();return{text:e.textContent,rect:flat(r),inside:inside(r),font:getComputedStyle(e).fontSize}}),gateOverlaps=[];for(let i=0;i<gates.length;i++)for(let j=i+1;j<gates.length;j++){const a=gates[i].rect,b=gates[j].rect;if(Math.min(a.right,b.right)>Math.max(a.x,b.x)+.5&&Math.min(a.bottom,b.bottom)>Math.max(a.y,b.y)+.5)gateOverlaps.push([i,j])}return{w:innerWidth,h:innerHeight,nodes,edges,headers,gates,gateOverlaps,panelOverflowX:panel.scrollWidth-panel.clientWidth,docOverflowX:document.documentElement.scrollWidth-innerWidth,info:{text:info.textContent,rect:flat(ir),inside:inside(ir),height:info.clientHeight,scrollHeight:info.scrollHeight,font:getComputedStyle(info).fontSize},close:{rect:flat(cr),inside:inside(cr),hit:close===ct||close.contains(ct)},cipherFound:[...document.querySelectorAll('.tree-board text,.tree-board .tree-gate')].some(e=>e.textContent.includes('Ψ')||e.textContent.includes('/')),pictureImageCount:document.querySelectorAll('.tree-node-picture>img').length,focus:document.activeElement?.getAttribute('data-tree-id')}})()`)
    await key('Enter','Enter');await sleep(180);await key('p','KeyP');await waitFor(`!!document.querySelector('.pause-panel')`);await nativeClick('#tree-open');await waitFor(`document.querySelectorAll('.tree-edge[d]').length===21`);report.noOffer=await graph();check(report.noOffer.nodes.length===20&&report.noOffer.edges.length===21&&report.noOffer.nodes.every((n:any)=>n.matches&&n.focus)&&report.noOffer.edges.every((e:any)=>e.matches)&&report.noOffer.offers.length===0&&report.noOffer.glow.length===0,'52 실제 nooffers glow0·canonical20nodes/21부모선·네상태·gate일치',report.noOffer)
    await ev(`window.__tree52Flashes=[];window.__tree52Watch=new MutationObserver(rs=>{for(const r of rs){const e=r.target;if(e.classList.contains('needs-parent'))window.__tree52Flashes.push({id:e.dataset.treeId||'header:'+e.dataset.branch,animation:getComputedStyle(e).animationName,at:performance.now()})}});window.__tree52Watch.observe(document.querySelector('#tree-view'),{subtree:true,attributes:true,attributeFilter:['class']})`)
    await nativeClick('[data-node="hone"]');await sleep(60);report.parentBlocked={events:await ev(`window.__tree52Flashes.slice()`),after:await graph(),view:await view()};check(report.parentBlocked.events.some((e:any)=>e.id==='reach')&&!report.parentBlocked.events.some((e:any)=>e.id==='header:a')&&report.parentBlocked.after.t===report.noOffer.t&&JSON.stringify(report.parentBlocked.after.ranks)===JSON.stringify(report.noOffer.ranks)&&!report.parentBlocked.view.info.text.replaceAll(' ','').includes('이갈래'),'52 부모0 잠긴hone 실클릭→미충족reach부모깜빡임',report.parentBlocked.events);await snap('nooffer-missing-parent-blink');await sleep(950)
    await ev(`window.__tree52Flashes=[]`);await nativeClick('[data-node="reach"]');await sleep(60);report.gateBlocked={events:await ev(`window.__tree52Flashes.slice()`),after:await graph(),view:await view()};check(report.gateBlocked.events.some((e:any)=>e.id==='header:a')&&!report.gateBlocked.events.some((e:any)=>e.id==='sword')&&report.gateBlocked.view.info.text.includes('갈래'),'52 부모충족/gate부족reach→header만깜빡임·하단설명(충족부모오표시0)',report.gateBlocked);check(report.gateBlocked.after.t===report.noOffer.t&&JSON.stringify(report.gateBlocked.after.ranks)===JSON.stringify(report.noOffer.ranks),'52 잠긴칸입력은실ranks/판시각불변');await snap('nooffer-gate-parent-feedback');await sleep(950)
    report.nativeKeys=[];for(const [sel,k]of [['[data-combo]','Enter'],['[data-ult]',' ']]){await tabSelector(sel!);await key(k!,k===' '?'Space':'Enter');const v=await view(),id=await ev(`document.querySelector('.tree-node.picked')?.dataset.treeId`),expected=sel==='[data-ult]'?'ult':report.noOffer.nodes.find((n:any)=>n.kind==='combo').id;report.nativeKeys.push({key:k,id,expected,info:v.info});check(id===expected&&await ev(`!document.querySelector('#tree-view').hidden`),'52 native '+k+' 지정정보/나무유지',report.nativeKeys.at(-1))}
    await key('Escape','Escape');check(await ev(`document.querySelector('#tree-view').hidden&&!!document.querySelector('.pause-panel')`),'52 Escape닫기·기존정지유지');await nativeClick('#resume');await waitFor(`document.querySelectorAll('#overlay:not([hidden]) .choices [data-up]').length===3`,45000);await nativeClick('#tree-open');report.withOffer=await graph();check(report.withOffer.glow.length===report.withOffer.offers.length&&report.withOffer.nodes.every((n:any)=>n.matches)&&report.withOffer.edges.every((e:any)=>e.matches),'52 실제첫성장 exactoffers glow·canonical부모/gate일치',report.withOffer)
    report.tree52Profiles=[];for(const [w,h]of [[360,800],[375,812],[390,844],[412,915],[844,390],[1920,1080]]){await call('Emulation.setTouchEmulationEnabled',{enabled:w!==1920,maxTouchPoints:1});await size(w!,h!,w!==1920);if(await ev(`document.querySelector('#tree-view').hidden`))await nativeClick('#tree-open',w!==1920);await waitFor(`document.querySelectorAll('.tree-edge[d]').length===21`);await nativeClick('[data-node="capC"]',w!==1920);await sleep(950);const v=await view();report.tree52Profiles.push(v);check(v.nodes.length===20&&v.nodes.every((n:any)=>n.inside&&n.hit&&n.imageLoaded&&n.imageCount===1&&n.image.w>n.rankFont&&(n.rankGap===null||n.rankGap>=0))&&v.pictureImageCount===20&&v.headers.length===3&&Math.abs(v.headers[0].rect.y-v.headers[2].rect.y)<2&&v.headers[0].rect.x<v.headers[1].rect.x&&v.headers[1].rect.x<v.headers[2].rect.x,'52 '+w+'×'+h+' 20큰그림/복제0·rank block별도·기둥3나란히/실hit',v.nodes);check(v.edges.length===21&&v.edges.every((e:any)=>e.length>0&&e.fromDistance<=2.1&&e.toDistance<=2.2&&e.markerHasHead),'52 '+w+'×'+h+' real21선 endpoint↔실picture(2px여백)·화살촉',v.edges);check(!v.cipherFound&&v.gateOverlaps.length===0&&v.gates.every((g:any)=>g.inside&&g.font==='12px')&&v.panelOverflowX<=1&&v.docOverflowX<=1&&v.info.inside&&v.info.scrollHeight<=v.info.height+1&&v.close.inside&&v.close.hit,'52 '+w+'×'+h+' 갈래공유12px·암호0·하단정보/닫기/가로overflow0',v);await snap('tree-'+w+'x'+h)}
    report.finalGraph=await graph();check(report.finalGraph.t===report.withOffer.t&&JSON.stringify(report.finalGraph.ranks)===JSON.stringify(report.withOffer.ranks)&&JSON.stringify(report.finalGraph.offers)===JSON.stringify(report.withOffer.offers),'52 정보입력/6뷰 동안실ranks/offers/t불변');await key('Escape','Escape');check(await ev(`document.querySelector('#tree-view').hidden&&document.querySelectorAll('.choices [data-up]').length===3`),'52 마지막Escape→실3성장선택지유지');report.notRealUiValidated=['sword 실제1판;나머지6kit와후반부모/gate/rank는codeagent canonical/unit/balance근거별도','흑백그림은원본PNG의QA파생이고실OS흑백모드아님','헤드리스viewport/실제폰하드웨어FPS미측정','갈래상한/후반조합완성state직접주입0/실후반미도달']
  }else if(mode==='tree-metrics'){
    report.evidence='추가 게임완주검수 아님: 정상Enter→P나무에서 Range폰트박스와 실제block box 차이만읽기. 기존실성장/native기능검수원본유지. 제품값/DOM내용변경0.'
    await key('Enter','Enter');await sleep(180);await key('p','KeyP');await waitFor(`!!document.querySelector('.pause-panel')`);await call('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});report.metrics=[]
    for(const [w,h]of [[360,800],[375,812],[390,844],[412,915],[844,390]]){
      await size(w!,h!,true);if(await ev(`document.querySelector('#tree-view').hidden`))await tap('#tree-open');await tap('[data-node="capC"]')
      const m=await ev(`(()=>{const flat=r=>({x:r.x,y:r.y,right:r.right,bottom:r.bottom,w:r.width,h:r.height}),ranges=e=>{const r=document.createRange();r.selectNodeContents(e);return[...r.getClientRects()].map(flat)},pairs=[...document.querySelectorAll('.tree-node')].filter(n=>n.querySelector('.tree-rank')).map(n=>{const a=n.querySelector('.tree-name'),b=n.querySelector('.tree-rank'),ar=a.getBoundingClientRect(),br=b.getBoundingClientRect(),ac=getComputedStyle(a),bc=getComputedStyle(b);return{id:n.dataset.node||n.dataset.combo,name:a.textContent,blockName:flat(ar),blockRank:flat(br),blockGap:br.y-ar.bottom,blockOverlap:Math.min(ar.right,br.right)>Math.max(ar.x,br.x)&&Math.min(ar.bottom,br.bottom)>Math.max(ar.y,br.y),nameRanges:ranges(a),rankRanges:ranges(b),fontName:ac.fontSize,lineName:ac.lineHeight,fontRank:bc.fontSize,lineRank:bc.lineHeight}}),head=document.querySelector('.tree-head h2'),sub=document.querySelector('.tree-head small');return{w:innerWidth,h:innerHeight,pairs,head:{title:flat(head.getBoundingClientRect()),sub:flat(sub.getBoundingClientRect()),titleRanges:ranges(head),subRanges:ranges(sub)},info:{block:flat(document.querySelector('.tree-info').getBoundingClientRect()),ranges:ranges(document.querySelector('.tree-info'))}}})()`)
      report.metrics.push(m);check(m.pairs.length===19&&m.pairs.every((p:any)=>!p.blockOverlap&&p.blockGap>=-.1),'나무 name/rank 실제block19쌍 겹침0 '+w+'×'+h,{pairs:m.pairs.length,minGap:Math.min(...m.pairs.map((p:any)=>p.blockGap))})
    }
    report.methodLimit='글리프잉크 픽셀자동분할 아님. 실제block쌍rect+Range타이포그래피박스+기존PNG직뷰를구분해판정. 기존Range교차RED삭제0.'
  }else if(mode==='tree-ui'){
    report.evidence='동결 DEV127.0.0.1:5174 정상출전→P→나무(nooffers)→계속/실첫성장→나무. canonical haebi 읽기 대조, DOM/native입력만. sim/meta/storage주입0;다른6kit는unit근거별도.'
    const nativeClick=async(sel:string,touch=false)=>{const p=await touchPoint(sel);if(!p?.hit)throw new Error('나무 native입력 가림 '+sel+JSON.stringify(p));if(touch){await touchStart(p);await sleep(50);await touchEnd()}else{await call('Input.dispatchMouseEvent',{type:'mousePressed',x:p.x,y:p.y,button:'left',clickCount:1});await call('Input.dispatchMouseEvent',{type:'mouseReleased',x:p.x,y:p.y,button:'left',clickCount:1})}await sleep(80)}
    const tabSelector=async(sel:string)=>{for(let n=0;n<45;n++){if(await ev(`document.activeElement?.matches(${JSON.stringify(sel)})`))return;await key('Tab','Tab')}throw new Error('native Tab 미도달 '+sel)}
    const model=()=>ev(`(async()=>{const H=await import('/src/raid/haebi.ts'),P=await import('/src/tune/params.ts'),s=window.__raid(),T=P.HAEBI_TREE;const nodes=[...document.querySelectorAll('.tree-node')].map(e=>{const id=e.dataset.node||e.dataset.combo||'ult',kind=e.dataset.node?'power':e.dataset.combo?'combo':'ult',c=H.kitCombos(s.kit).find(c=>c.id===id),at=kind==='power'?H.nodeAt(s.kit,id):null,rank=kind==='power'?s.ranks[id]:kind==='combo'?H.comboRank(s,id):Number(H.ultUpgraded(s)),open=kind==='power'?H.nodeOpen(s,id):kind==='combo'?H.comboReady(s,c):H.ultUpgraded(s),expected=kind==='power'?(T.tiers[at.tier]?[{kind:'branch',from:at.branch,have:H.branchPoints(s,at.branch),need:T.tiers[at.tier]}]:[]):kind==='combo'?Object.entries(c.needs).map(([p,n])=>({kind:'power',from:p,have:s.ranks[p],need:n})):[{kind:'combo',from:'any',have:Math.max(...H.kitCombos(s.kit).map(c=>H.comboRank(s,c.id))),need:T.max}],actual=[...e.querySelectorAll('.tree-requirement')].map(b=>({kind:b.dataset.kind,from:b.dataset.from,to:b.dataset.to,have:+b.dataset.have,need:+b.dataset.need,number:b.querySelector('.tree-need-values').textContent.trim(),picture:!!b.querySelector('img,svg.tree-branch-icon'),arrow:!!b.querySelector('svg.tree-arrow path')&&b.querySelector('svg.tree-arrow path').getTotalLength()>5}));return{id,kind,rank,open,offered:kind!=='ult'&&s.offers.includes(id),classOffered:e.classList.contains('is-offered'),classOpen:e.classList.contains('is-open'),classEarned:e.classList.contains('is-earned'),focus:e.getAttribute('role')==='button'&&e.tabIndex===0,expected,actual,matches:open===e.classList.contains('is-open')&&(rank>0)===e.classList.contains('is-earned')&&(kind!=='ult'&&s.offers.includes(id))===e.classList.contains('is-offered')&&expected.length===actual.length&&expected.every((r,i)=>{const a=actual[i];return a.kind===r.kind&&a.from===r.from&&a.to===id&&a.have===r.have&&a.need===r.need&&a.number.includes(r.have+'/'+r.need)&&a.picture&&a.arrow})}});return{kit:s.kit,t:s.t,ranks:{...s.ranks},offers:[...s.offers],nodes,glow:nodes.filter(n=>n.classOffered).map(n=>n.id),arrowCount:document.querySelectorAll('.tree-arrow path').length}})()`)
    const geometry=()=>ev(`(()=>{const panel=document.querySelector('.tree-panel'),pr=panel.getBoundingClientRect(),clip={left:pr.left+panel.clientLeft,right:pr.left+panel.clientLeft+panel.clientWidth,top:pr.top+panel.clientTop,bottom:pr.top+panel.clientTop+panel.clientHeight},flat=r=>({x:r.x,y:r.y,right:r.right,bottom:r.bottom,w:r.width,h:r.height}),inside=r=>r.left>=clip.left-1&&r.right<=clip.right+1&&r.top>=clip.top-1&&r.bottom<=clip.bottom+1,nodes=[...document.querySelectorAll('.tree-node')].map(e=>{const r=e.getBoundingClientRect(),t=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return{id:e.dataset.node||e.dataset.combo||'ult',rect:flat(r),inside:inside(r),hit:e===t||e.contains(t),overflow:e.scrollWidth-e.clientWidth}}),info=document.querySelector('.tree-info'),ir=info.getBoundingClientRect(),close=document.querySelector('.tree-close'),cr=close.getBoundingClientRect(),ct=document.elementFromPoint(cr.x+cr.width/2,cr.y+cr.height/2),texts=[],walker=document.createTreeWalker(panel,NodeFilter.SHOW_TEXT);let n;while(n=walker.nextNode()){const e=n.parentElement;if(!n.textContent.trim()||e.closest('svg,kbd')||getComputedStyle(e).display==='none')continue;const range=document.createRange();range.selectNodeContents(n);for(const r of range.getClientRects())if(r.width&&r.height)texts.push({text:n.textContent.trim(),px:parseFloat(getComputedStyle(e).fontSize),rect:flat(r),inside:inside(r)});range.detach()}const overlaps=[];for(let i=0;i<texts.length;i++)for(let j=i+1;j<texts.length;j++){const a=texts[i],b=texts[j];if(Math.min(a.rect.right,b.rect.right)>Math.max(a.rect.x,b.rect.x)+.75&&Math.min(a.rect.bottom,b.rect.bottom)>Math.max(a.rect.y,b.rect.y)+.75)overlaps.push([a.text,b.text])}return{w:innerWidth,h:innerHeight,clip,panelOverflowX:panel.scrollWidth-panel.clientWidth,panelOverflowY:panel.scrollHeight-panel.clientHeight,docOverflowX:document.documentElement.scrollWidth-innerWidth,nodes,info:{text:info.textContent,rect:flat(ir),inside:inside(ir),scrollHeight:info.scrollHeight,clientHeight:info.clientHeight,font:getComputedStyle(info).fontSize},close:{rect:flat(cr),inside:inside(cr),hit:close===ct||close.contains(ct)},minText:Math.min(...texts.map(t=>t.px)),badTexts:texts.filter(t=>t.px<12||!t.inside),overlaps}})()`)
    await key('Enter','Enter');await sleep(180);await key('p','KeyP');await waitFor(`!!document.querySelector('.pause-panel')`);await nativeClick('#tree-open');await waitFor(`!document.querySelector('#tree-view').hidden`)
    report.noOffer=await model();check(report.noOffer.offers.length===0&&report.noOffer.glow.length===0&&report.noOffer.nodes.length===20&&report.noOffer.nodes.every((n:any)=>n.matches&&n.focus),'실제 P나무 nooffers glow0/20node·canonical조건·arrow/focus',report.noOffer);await snap('before-growth-no-glow')
    report.nativeInfo=[]
    for(const [sel,k]of [['[data-node="capC"]','click'],['[data-combo]','Enter'],['[data-ult]',' ']]){if(k==='click')await nativeClick(sel!);else{await tabSelector(sel!);await key(k!,k===' '?'Space':'Enter')}const g=await geometry(),expected=sel==='[data-node="capC"]'?'capC':sel==='[data-combo]'?report.noOffer.nodes.find((n:any)=>n.kind==='combo').id:'ult',picked=await ev(`[...document.querySelectorAll('.tree-node.picked')].map(e=>e.dataset.node||e.dataset.combo||'ult')`);report.nativeInfo.push({sel,key:k,expected,picked,...g});check(picked.length===1&&picked[0]===expected&&await ev(`!document.querySelector('#tree-view').hidden&&!!document.querySelector('.tree-info b')`),'native '+k+'는 지정노드정보갱신/나무유지',g.info)}
    await key('Escape','Escape');check(await ev(`document.querySelector('#tree-view').hidden&&!!document.querySelector('.pause-panel')`),'native Escape는 나무닫기/기존정지유지');await nativeClick('#resume');await waitFor(`document.querySelectorAll('#overlay:not([hidden]) .choices [data-up]').length===3`,45000);await nativeClick('#tree-open');report.withOffer=await model();check(report.withOffer.glow.length===report.withOffer.offers.length&&report.withOffer.nodes.every((n:any)=>n.matches),'실제 첫성장 offers만glow·canonical조건일치',report.withOffer)
    await call('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});report.treeProfiles=[]
    for(const [w,h]of [[360,800],[375,812],[390,844],[412,915],[844,390]]){await size(w!,h!,true);if(await ev(`document.querySelector('#tree-view').hidden`))await nativeClick('#tree-open',true);const infos=[];for(const sel of ['[data-node="sword"]','[data-combo]','[data-ult]','[data-node="capC"]']){await nativeClick(sel,true);const g=await geometry();infos.push({sel,...g});check(g.nodes.length===20&&g.nodes.every((n:any)=>n.inside&&n.hit&&n.overflow<=1)&&g.minText>=12&&g.badTexts.length===0&&g.overlaps.length===0&&g.info.inside&&g.info.scrollHeight<=g.info.clientHeight+1&&g.close.inside&&g.close.hit&&g.panelOverflowX<=1&&g.docOverflowX<=1,'나무 '+w+'×'+h+' '+sel+' 20nodes/text>=12/조건·info·닫기경계와겹침0',g)}report.treeProfiles.push({w,h,infos});await snap('tree-'+w+'x'+h)}
    report.afterInfo=await model();check(JSON.stringify(report.afterInfo.ranks)===JSON.stringify(report.withOffer.ranks)&&JSON.stringify(report.afterInfo.offers)===JSON.stringify(report.withOffer.offers)&&report.afterInfo.t===report.withOffer.t,'정보 native입력은 실제ranks/offers/판시각불변');await key('Escape','Escape');check(await ev(`document.querySelector('#tree-view').hidden&&document.querySelectorAll('.choices [data-up]').length===3`),'성장나무 Escape닫기뒤 실제3선택지유지')
    report.notRealUiValidated=['실제 sword1판/nooffer→첫성장만,나머지6kit는canonical단위자료와분리','후반높은rank실게임상태미도달/상태직주입0','headlessviewport이며실제폰hardwareFPS미측정']
  }else if(mode==='card-ui'){
    report.evidence='정상 Enter출전→기본자동공격/native방향키→실제첫성장. meta/sim/storage주입0. 첫offer유지중 viewport와native스크롤로5폭검사,실제선택1회.'
    report.preStart=await ev(`({startReady:!document.querySelector('#start').disabled,images:window.__card50.images.map(i=>({src:i.src,complete:i.complete,w:i.naturalWidth,h:i.naturalHeight})),network:performance.getEntriesByType('resource').filter(r=>r.name.includes('ui-card-branch-')).map(r=>({name:r.name,responseEnd:r.responseEnd,encodedBodySize:r.encodedBodySize,decodedBodySize:r.decodedBodySize})),at:performance.now()})`)
    check(report.preStart.startReady&&report.preStart.images.length===3&&report.preStart.images.every((i:any)=>i.complete&&i.w===384&&i.h===576),'최초 출전 전 공유 Image3개 complete·native384×576',report.preStart)
    await key('Enter','Enter');await waitFor(`document.querySelector('#menu').hidden&&!document.querySelector('#play').hidden`);const beforeMove=await read();await key('ArrowRight','ArrowRight',350);await sleep(50);const afterMove=await read();report.move={before:beforeMove,after:afterMove};check(afterMove.x!==beforeMove.x,'실제 정상전투 native방향키 이동',report.move)
    await waitFor(`!document.querySelector('#overlay').hidden&&document.querySelectorAll('.choices [data-up]').length===3`,45000)
    report.firstOffer=await ev(`(async()=>{const H=await import('/src/raid/haebi.ts'),r=window.__raid();return{t:r.t,kills:r.kills,kit:r.kit,offers:[...document.querySelectorAll('.choices [data-up]')].map(e=>({up:e.dataset.up,dataBranch:e.dataset.branch??null,model:H.nodeAt(r.kit,e.dataset.up),classes:e.className,aria:e.getAttribute('aria-label'),frame:getComputedStyle(e).borderImageSource,slice:getComputedStyle(e).borderImageSlice,border:getComputedStyle(e).borderTopWidth})),branchTags:document.querySelectorAll('.choices .branch-tag').length}})()`)
    const branches=report.firstOffer.offers.map((e:any)=>e.model?.branch)
    check(new Set(branches).size===3&&branches.every((b:any)=>['a','b','c'].includes(b))&&report.firstOffer.offers.every((e:any)=>e.classes.includes('branch-'+e.model.branch)&&e.frame.includes('ui-card-branch-'+e.model.branch+'.webp')&&e.slice==='60')&&report.firstOffer.branchTags===0,'실제 첫offer a/b/c3종·각 native프레임URL·글띠DOM0',report.firstOffer)
    const cardGeometry=()=>ev(`(()=>{const p=document.querySelector('.panel.upgrade'),pr=p.getBoundingClientRect(),rect=r=>({x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height}),cards=[...document.querySelectorAll('.choices [data-up]')].map(e=>{const r=e.getBoundingClientRect(),t=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2),els=[...e.children].filter(x=>{const a=x.getBoundingClientRect();return a.width&&a.height&&getComputedStyle(x).display!=='none'}),parts=els.map(x=>({tag:x.tagName,cls:x.className,text:x.textContent.trim(),rect:rect(x.getBoundingClientRect())})),overlaps=[];for(let a=0;a<parts.length;a++)for(let b=a+1;b<parts.length;b++){const u=parts[a].rect,v=parts[b].rect;if(Math.min(u.right,v.right)>Math.max(u.x,v.x)+.5&&Math.min(u.bottom,v.bottom)>Math.max(u.y,v.y)+.5)overlaps.push([parts[a].cls||parts[a].tag,parts[b].cls||parts[b].tag])}return{up:e.dataset.up,rect:rect(r),frame:getComputedStyle(e).borderImageSource,hit:e===t||e.contains(t),inside:r.x>=-1&&r.right<=innerWidth+1&&r.y>=pr.y+p.clientTop&&r.bottom<=pr.y+p.clientTop+p.clientHeight,topElement:t?.id||t?.className,overflow:e.scrollWidth-e.clientWidth,parts,overlaps}});return{w:innerWidth,h:innerHeight,panelOverflow:p.scrollWidth-p.clientWidth,documentOverflow:document.documentElement.scrollWidth-innerWidth,scrollTop:p.scrollTop,clip:{top:pr.y+p.clientTop,bottom:pr.y+p.clientTop+p.clientHeight},cards,visibleHints:[...document.querySelectorAll('.choices kbd')].filter(k=>k.getClientRects().length&&getComputedStyle(k).display!=='none').map(k=>k.textContent)}})()`)
    report.pcGeometry=await cardGeometry();check(report.pcGeometry.visibleHints.join(',')==='1,2,3'&&report.pcGeometry.cards.every((c:any)=>c.hit&&c.inside&&c.overlaps.length===0),'PC 실제 카드 숫자hint1/2/3·텍스트/pips 겹침0',report.pcGeometry);await snap('PC-first-three-frames')
    await call('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});report.cardProfiles=[]
    for(const [w,h]of [[360,800],[375,812],[390,844],[412,915],[844,390]]){
      await size(w!,h!,true);const scans=[]
      if(await ev(`!document.querySelector('#rotate-guide').hidden`)){const g=await cardGeometry();report.cardProfiles.push({w,h,blockedByRotateGuide:true,geometry:g});check(false,'회전안내가 실제 성장카드 가림 '+w+'×'+h,g);await snap('upgrade-'+w+'x'+h);continue}
      for(let card=0;card<3;card++){
        let g=await cardGeometry(),c=g.cards[card]
        for(let attempt=0;attempt<10&&(!c.inside||!c.hit);attempt++){const down=c.rect.y<g.clip.top?220:-220;await call('Input.synthesizeScrollGesture',{x:Math.round(w!*.7),y:Math.round(h!*.55),yDistance:down,gestureSourceType:'touch',speed:700});await sleep(120);g=await cardGeometry();c=g.cards[card]}
        scans.push({card,...c});check(c.hit&&c.inside&&c.overflow<=1&&c.overlaps.length===0,'실제 카드 '+(card+1)+' native스크롤 접근·본문겹침0 '+w+'×'+h,c)
        if(card===0)await snap('upgrade-'+w+'x'+h)
      }
      const g=await cardGeometry();report.cardProfiles.push({w,h,scans,geometry:g});check(g.panelOverflow<=1&&g.documentOverflow<=1&&g.visibleHints.length===0,'터치 upgrade '+w+'×'+h+' 가로overflow0·hint숨김',g)
    }
    await size(390,844,true);const before=await ev(`({ranks:{...window.__raid().ranks},offers:[...window.__raid().offers],t:window.__raid().t})`),chosen=report.firstOffer.offers[0].up;await tap('.choices [data-up]');await sleep(150);const after=await ev(`({ranks:{...window.__raid().ranks},offers:[...window.__raid().offers],t:window.__raid().t,state:window.__raid().state})`);report.selection={chosen,before,after};check(after.ranks[chosen]===before.ranks[chosen]+1,'세로 첫성장 실제 native touch 선택 정확히1회',report.selection)
    await sleep(250);const locked=await read();report.portraitAfterSelection=locked;check(locked.t===after.t&&locked.state==='playing','세로 선택뒤 전투 판시계 잠금 유지',{after:after.t,locked:locked.t})
    await size(844,390,true);await waitFor(`!!document.querySelector('.pause-panel #resume')`,5000);const paused=await read();await tap('#resume');await sleep(350);const resumed=await read();report.rotateResume={paused,resumed};check(resumed.t>paused.t&&!resumed.overlay,'가로회전뒤 native계속으로 실제 전투재개',report.rotateResume)
    report.notRealUiValidated=['갈래끝 cap-ribbon/조합카드는 이번 실제 첫성장에 없어서 시각검증0; source+unit 별도','실제휴대폰 hardware/FPS 미검증; headless viewport','DOM data-branch속성은제품에없음: class+aria+읽기전용nodeAt실모델로3갈래대조']
  }else if(mode==='shop-close'){
    report.evidence='상점 닫기 PC 힌트 최소CSS교정만 정상메뉴 native입력으로 재검수. 첫5폭상점 actual수치는 기존보고 유지; meta/sim/localStorage 주입0.'
    await call('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});await tap('#open-shop');await waitFor(`!document.querySelector('#shop').hidden`);await call('Emulation.setTouchEmulationEnabled',{enabled:false});await size(844,390,false)
    report.pcShopClose=await ev(`(()=>{const b=document.querySelector('#close-shop'),k=b.querySelector('kbd'),flat=r=>({left:r.left,top:r.top,right:r.right,bottom:r.bottom}),hint=k?.getBoundingClientRect(),walk=document.createTreeWalker(b,NodeFilter.SHOW_TEXT),labels=[];let n;while(n=walk.nextNode())if(n.textContent.trim()&&!n.parentElement.closest('kbd')){const r=document.createRange();r.selectNodeContents(n);for(const x of r.getClientRects())labels.push(flat(x))}return{fine:matchMedia('(pointer:fine)').matches,hover:matchMedia('(hover:hover)').matches,hint:k?.textContent,hintVisible:!!k&&getComputedStyle(k).display!=='none',paddingRight:getComputedStyle(b).paddingRight,hintRect:hint&&flat(hint),labels,overlap:!!hint&&labels.some(r=>Math.min(r.right,hint.right)>Math.max(r.left,hint.left)+.1&&Math.min(r.bottom,hint.bottom)>Math.max(r.top,hint.top)+.1)}})()`)
    report.pcShopClose.bounds=await ev(`(()=>{const b=document.querySelector('#close-shop'),r=b.getBoundingClientRect(),k=b.querySelector('kbd').getBoundingClientRect();return{button:{x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height},hintInside:k.x>=r.x&&k.right<=r.right&&k.y>=r.y&&k.bottom<=r.bottom,buttonInside:r.x>=0&&r.right<=innerWidth&&r.y>=0&&r.bottom<=innerHeight}})()`)
    check(report.pcShopClose.fine&&report.pcShopClose.hover&&report.pcShopClose.hintVisible&&!report.pcShopClose.overlap&&report.pcShopClose.bounds.hintInside&&report.pcShopClose.bounds.buttonInside,'PC 상점 닫기 Enter hint 노출·label 교차0·버튼 경계내',report.pcShopClose);await snap('PC-shop-close-no-overlap')
    await tabTo('close-shop');await key('Enter','Enter');check(await ev(`document.querySelector('#shop').hidden&&!document.querySelector('#menu').hidden`),'PC 실제 Tab/Enter로 상점 닫기')
    await call('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});await size(360,800,true);await tap('#open-shop');report.touchClose=await ev(`(()=>{const b=document.querySelector('#close-shop'),r=b.getBoundingClientRect(),t=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return{fine:matchMedia('(pointer:fine)').matches,hover:matchMedia('(hover:hover)').matches,hints:[...document.querySelectorAll('#shop kbd')].filter(k=>k.getClientRects().length&&getComputedStyle(k).display!=='none').length,hit:b===t||b.contains(t),paddingRight:getComputedStyle(b).paddingRight}})()`)
    check(!report.touchClose.fine&&!report.touchClose.hover&&report.touchClose.hints===0&&report.touchClose.hit,'대표 touch360 상점 hints0·닫기 실제hit',report.touchClose);await snap('touch360-shop-hints0');await tap('#close-shop');check(await ev(`document.querySelector('#shop').hidden`),'대표 touch360 실제 닫기')
  }else if(mode==='shop-ui'){
    report.evidence='일반 메뉴→상점 native touch. 새 Chrome 프로필의 실제 0금/0단계 상태만 검사; meta/localStorage/sim 주입0. 고단계 구매/저장 호환/전체판 흡인은 별도 단위 검수.'
    await call('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});await tap('#open-shop');await waitFor(`!document.querySelector('#shop').hidden`)
    report.shopProfiles=[]
    const magnet='[data-buy="magnet"]'
    const shopState=()=>ev(`(()=>{const b=document.querySelector('[data-buy="magnet"]'),p=document.querySelector('#shop .panel'),r=b.getBoundingClientRect(),top=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2),flat=r=>({x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height});return{gold:document.querySelector('#shop h2').textContent.trim(),level:b.querySelector('i').textContent,description:b.querySelector('small').textContent,reason:b.querySelector('em').textContent,aria:b.getAttribute('aria-disabled'),disabled:b.disabled,rect:flat(r),inside:r.x>=0&&r.right<=innerWidth+1&&r.y>=0&&r.bottom<=innerHeight+1,hit:b===top||b.contains(top),panelOverflow:p.scrollWidth-p.clientWidth,docOverflow:document.documentElement.scrollWidth-innerWidth,buttonOverflow:b.scrollWidth-b.clientWidth,texts:[...b.querySelectorAll('b,small,em')].map(e=>{const a=e.getBoundingClientRect();return{text:e.textContent,rect:flat(a),inside:a.x>=r.x-1&&a.right<=r.right+1&&a.y>=r.y-1&&a.bottom<=r.bottom+1,overflow:e.scrollWidth-e.clientWidth}})}})()`)
    for(const [w,h]of [[360,800],[375,812],[390,844],[412,915],[844,390]]){
      await size(w!,h!,true)
      let m=await shopState()
      for(let n=0;n<6&&!m.inside;n++){await call('Input.synthesizeScrollGesture',{x:Math.round(w!*.7),y:Math.round(h!*.5),yDistance:m.rect.y<0?250:-250,gestureSourceType:'touch',speed:700});await sleep(200);m=await shopState()}
      report.shopProfiles.push({w,h,...m});check(m.level==='0/10'&&m.reason.includes('모자람')&&m.aria==='true'&&!m.disabled,'실제 새 프로필 0/10·금 부족 이유 '+w+'×'+h,m)
      check(m.inside&&m.hit&&m.panelOverflow<=1&&m.docOverflow<=1&&m.buttonOverflow<=1&&m.texts.every((x:any)=>x.inside&&x.overflow<=1),'상점 자석 버튼 실제 노출·텍스트 넘침0 '+w+'×'+h,m)
      await snap('shop-'+w+'x'+h)
      if(w===360){await tap(magnet);await sleep(30);const after=await shopState(),nudge=await ev(`document.querySelector('[data-buy="magnet"]').classList.contains('nudge')`);report.poorPress={before:m,after,nudge};check(nudge&&after.level==='0/10'&&after.gold===m.gold&&after.reason.includes('모자람'),'부족금 native touch는 실제 흔들림·모자람 표시, 구매0',report.poorPress);await snap('poor-press-360x800');await sleep(450)}
    }
    await call('Emulation.setTouchEmulationEnabled',{enabled:false});await size(844,390,false)
    report.pcShopClose=await ev(`(()=>{const b=document.querySelector('#close-shop'),k=b.querySelector('kbd'),flat=r=>({left:r.left,top:r.top,right:r.right,bottom:r.bottom}),hint=k?.getBoundingClientRect(),walk=document.createTreeWalker(b,NodeFilter.SHOW_TEXT),labels=[];let n;while(n=walk.nextNode())if(n.textContent.trim()&&!n.parentElement.closest('kbd')){const r=document.createRange();r.selectNodeContents(n);for(const x of r.getClientRects())labels.push(flat(x))}return{fine:matchMedia('(pointer:fine)').matches,hover:matchMedia('(hover:hover)').matches,hint:k?.textContent,hintVisible:!!k&&getComputedStyle(k).display!=='none',hintRect:hint&&flat(hint),labels,overlap:!!hint&&labels.some(r=>Math.min(r.right,hint.right)>Math.max(r.left,hint.left)+.1&&Math.min(r.bottom,hint.bottom)>Math.max(r.top,hint.top)+.1)}})()`)
    check(report.pcShopClose.fine&&report.pcShopClose.hover&&report.pcShopClose.hintVisible&&!report.pcShopClose.overlap,'PC 상점 닫기 hint 노출·label 교차0',report.pcShopClose);await snap('PC-shop-close-hint')
    report.notRealUiValidated=['소지금/기존 저장 없는 새 프로필: 저장5 호환, 5→6 구매, 10 전범위 흡인은 UI 실검증 아님','추천 기준 금액은 소스/단위검사 별도 증거; UI 수치 조작 안 함']
  }else if(mode==='keyboard-result'){
    report.evidence='정상 Enter/P/Tab/Enter로 실제 철수 결과 진입; 새 CSS 교정 범위와 결과 숫자키만 재검수. sim 주입0.'
    const result=async()=>{if(await ev(`!document.querySelector('#menu').hidden`)){await key('Enter','Enter');await sleep(150)}if(!await ev(`!!document.querySelector('.pause-panel')`)){await key('p','KeyP');await waitFor(`!!document.querySelector('.pause-panel')`)}await tabTo('quit');await key('Enter','Enter');await waitFor(`!!document.querySelector('#overlay:not([hidden]) .result')`,6000)}
    await result()
    report.pcLabels=await ev(`(()=>{const flat=r=>({left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height});return[...document.querySelectorAll('.result-acts button')].map(b=>{const k=b.querySelector('kbd'),hint=k.getBoundingClientRect(),walk=document.createTreeWalker(b,NodeFilter.SHOW_TEXT),labels=[];let n;while(n=walk.nextNode()){if(n.textContent.trim()&&!n.parentElement.closest('kbd')){const r=document.createRange();r.selectNodeContents(n);for(const rect of r.getClientRects())labels.push(flat(rect));r.detach()}}return{id:b.id,paddingRight:getComputedStyle(b).paddingRight,hint:flat(hint),labelRanges:labels,overlap:labels.some(r=>Math.min(r.right,hint.right)>Math.max(r.left,hint.left)+.1&&Math.min(r.bottom,hint.bottom)>Math.max(r.top,hint.top)+.1)}})})()`)
    check(report.pcLabels.length===3&&report.pcLabels.every((b:any)=>!b.overlap),'PC 결과 labelRange/kbdRect 교차0',report.pcLabels);await snap('PC-result-no-label-overlap')
    await key('1','Digit1');await waitFor(`document.querySelector('#overlay').hidden&&!document.querySelector('#play').hidden`);check((await read()).state==='playing','CSS 교정 뒤 결과1 다시 출전');await result();await key('2','Digit2');await waitFor(`!document.querySelector('#shop').hidden`);check(true,'CSS 교정 뒤 결과2 상점');await key('Escape','Escape');await result();await key('3','Digit3');check(await ev(`!document.querySelector('#menu').hidden`),'CSS 교정 뒤 결과3 메뉴')
    await call('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});await size(360,800,true);await tap('#start');await waitFor(`!!document.querySelector('.pause-panel')`);await tap('#quit');await waitFor(`!!document.querySelector('#overlay:not([hidden]) .result')`,6000);report.phoneResults=[]
    for(const [w,h]of [[360,800],[375,812],[390,844],[412,915]]){await size(w!,h!,true);const m=await ev(`(()=>{const p=document.querySelector('.panel.result');return{fine:matchMedia('(pointer:fine)').matches,hover:matchMedia('(hover:hover)').matches,hints:[...document.querySelectorAll('kbd')].filter(e=>e.getClientRects().length&&getComputedStyle(e).display!=='none').length,overflow:p.scrollWidth-p.clientWidth,docOverflow:document.documentElement.scrollWidth-innerWidth,buttons:[...p.querySelectorAll('button')].map(e=>{const r=e.getBoundingClientRect(),t=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return{id:e.id,inside:r.x>=-1&&r.right<=innerWidth+1&&r.y>=-1&&r.bottom<=innerHeight+1,hit:e===t||e.contains(t),paddingRight:getComputedStyle(e).paddingRight}})}})()`);report.phoneResults.push({w,h,...m});check(!m.fine&&!m.hover&&m.hints===0&&m.overflow<=1&&m.docOverflow<=1&&m.buttons.every((b:any)=>b.inside&&b.hit),'터치 '+w+'×'+h+' 결과 hints0·overflow0·버튼 실제 노출',m);await snap('phone-result-'+w+'x'+h)}
  }else if(mode==='keyboard-ui'){
    report.evidence='정상 Enter 출전, native CDP 숫자/반복/단축키/Tab 확인과 native touch viewport smoke. sim 상태 주입0.'
    const hints=()=>ev(`({fine:matchMedia('(pointer:fine)').matches,hover:matchMedia('(hover:hover)').matches,visible:[...document.querySelectorAll('kbd')].filter(e=>e.getClientRects().length&&getComputedStyle(e).display!=='none').map(e=>({text:e.textContent,font:getComputedStyle(e).fontSize,id:e.parentElement.id}))})`)
    report.pcHints=await hints();check(report.pcHints.fine&&report.pcHints.hover&&report.pcHints.visible.length>0&&report.pcHints.visible.every((x:any)=>parseFloat(x.font)<=10),'PC fine/hover에서 작은 kbd 실제 노출',report.pcHints)
    await ev(`window.__keyProbe=[];window.addEventListener('keydown',e=>{if(window.__keyProbe.length<180)window.__keyProbe.push({key:e.key,repeat:e.repeat,ctrl:e.ctrlKey,alt:e.altKey,meta:e.metaKey,prevented:e.defaultPrevented})})`)
    await key('Enter','Enter');await sleep(200);check(await ev(`document.querySelector('#menu').hidden&&!document.querySelector('#play').hidden`),'정상 Enter 키로 출전');await key('x','KeyX');await key('x','KeyX')
    report.cards=[]
    for(const digit of [1,2,3]){
      await waitFor(`!document.querySelector('#overlay').hidden&&document.querySelectorAll('.choices [data-up]').length===3`,45000)
      const before=await ev(`(()=>{const r=window.__raid();return{offers:[...document.querySelectorAll('.choices [data-up]')].map(e=>e.dataset.up),ranks:{...r.ranks},level:r.level,t:r.t}})()`)
      if(digit===1){report.cardHints=await hints();check(report.cardHints.visible.filter((x:any)=>['1','2','3'].includes(x.text)).length===3,'PC 성장 카드 작은 숫자 kbd 1/2/3 실제 노출',report.cardHints);await snap('PC-upgrade-key-hints')}
      if(digit===1){for(const modifiers of [2,1,4]){await call('Input.dispatchKeyEvent',{type:'keyDown',key:'1',code:'Digit1',modifiers});await call('Input.dispatchKeyEvent',{type:'keyUp',key:'1',code:'Digit1',modifiers:0})}const afterMods=await ev(`[...document.querySelectorAll('.choices [data-up]')].map(e=>e.dataset.up)`);check(JSON.stringify(afterMods)===JSON.stringify(before.offers),'Ctrl/Alt/Meta 숫자는 성장 선택하지 않음',{before:before.offers,after:afterMods})}
      if(digit===2){await call('Input.dispatchKeyEvent',{type:'keyDown',key:'1',code:'Digit1',autoRepeat:true});await sleep(80);const repeat=await ev(`({offers:[...document.querySelectorAll('.choices [data-up]')].map(e=>e.dataset.up),ranks:{...window.__raid().ranks}})`);report.repeat={before,after:repeat};check(JSON.stringify(repeat.offers)===JSON.stringify(before.offers)&&JSON.stringify(repeat.ranks)===JSON.stringify(before.ranks),'새 성장 카드에서 native autoRepeat 추가 선택0',report.repeat);await call('Input.dispatchKeyEvent',{type:'keyUp',key:'1',code:'Digit1'})}
      const chosen=before.offers[digit-1];await call('Input.dispatchKeyEvent',{type:'keyDown',key:String(digit),code:'Digit'+digit});await sleep(70);if(digit!==1)await call('Input.dispatchKeyEvent',{type:'keyUp',key:String(digit),code:'Digit'+digit})
      const after=await ev(`({ranks:{...window.__raid().ranks},offers:[...window.__raid().offers],level:window.__raid().level})`);report.cards.push({digit,chosen,before,after});check(after.ranks[chosen]===before.ranks[chosen]+1,'숫자 '+digit+' 실제 '+chosen+' 카드 선택',{chosen,before:before.ranks[chosen],after:after.ranks[chosen]});if(digit===1)await snap('PC-first-card-selected')
    }
    for(let n=0;n<5&&await ev(`!!document.querySelector('#overlay:not([hidden]) .choices [data-up]')`);n++)await key('1','Digit1')
    await key('p','KeyP');await waitFor(`!!document.querySelector('.pause-panel')`);check(true,'P 키 일시정지');await snap('PC-pause-hints');await key('Escape','Escape');await waitFor(`document.querySelector('#overlay').hidden`);check(true,'Esc 키로 정지에서 전투 복귀');await key('Escape','Escape');await waitFor(`!!document.querySelector('.pause-panel')`);await key('Enter','Enter');await waitFor(`document.querySelector('#overlay').hidden`);check(true,'Enter 기본 확인으로 계속')
    await key('p','KeyP');await waitFor(`!!document.querySelector('.pause-panel')`);const spaceBefore=await ev(`(async()=>{const r=window.__raid(),H=await import('/src/raid/haebi.ts');return{t:r.t,ready:H.ultOpen(r)&&r.skillCd===0,cd:r.skillCd,cast:r.cast,ult:r.ult}})()`);await key(' ','Space');await sleep(250);const spaceAfter=await ev(`({t:window.__raid().t,cd:window.__raid().skillCd,cast:window.__raid().cast,ult:window.__raid().ult})`);report.spaceConfirm={before:spaceBefore,after:spaceAfter};check(spaceBefore.ready&&spaceAfter.t>spaceBefore.t&&spaceAfter.cd===0&&!spaceAfter.cast&&!spaceAfter.ult,'비기 열린 상태 Space 확인 후 비기 오발0',report.spaceConfirm)
    await key('p','KeyP');await waitFor(`!!document.querySelector('.pause-panel')`);await tabTo('tree-open');await key('Enter','Enter');await waitFor(`!document.querySelector('#tree-view').hidden`);await key('Escape','Escape');check(await ev(`document.querySelector('#tree-view').hidden&&!!document.querySelector('.pause-panel')`),'Tab/Enter 나무 열기 후 Esc는 나무만 닫음')
    const resultByKeyboard=async(confirm:string)=>{if(!await ev(`!!document.querySelector('.pause-panel')`)){await key('p','KeyP');await waitFor(`!!document.querySelector('.pause-panel')`)}await tabTo('quit');await key(confirm,confirm===' '?'Space':'Enter');await waitFor(`!!document.querySelector('#overlay:not([hidden]) .result')`,6000)}
    await resultByKeyboard(' ');report.resultButtons=await ev(`[...document.querySelectorAll('.result-acts button')].map(e=>({id:e.id,text:e.textContent}))`);await snap('PC-result-hints');await key('1','Digit1');await waitFor(`document.querySelector('#overlay').hidden&&!document.querySelector('#play').hidden`);check((await read()).state==='playing','결과 숫자1 다시 출전')
    await resultByKeyboard('Enter');await key('2','Digit2');await waitFor(`!document.querySelector('#shop').hidden`);check(true,'결과 숫자2 상점');await key('Escape','Escape');await waitFor(`document.querySelector('#shop').hidden&&!document.querySelector('#menu').hidden`);await key('Enter','Enter');await sleep(150);await resultByKeyboard('Enter');await key('3','Digit3');check(await ev(`!document.querySelector('#menu').hidden&&document.querySelector('#play').hidden`),'결과 숫자3 스테이지 메뉴')
    await call('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});await size(360,800,true);await tap('#start');await waitFor(`!!document.querySelector('.pause-panel')`);report.phoneHints=[]
    for(const [w,h]of [[360,800],[375,812],[390,844],[412,915],[844,390]]){await size(w!,h!,true);const hs=await hints();const m=await ev(`(()=>{const p=document.querySelector('.pause-panel'),b=p.getBoundingClientRect();return{top:!!document.elementFromPoint(b.x+b.width/2,b.y+b.height/2)?.closest('.pause-panel'),buttons:[...p.querySelectorAll('button')].map(e=>{const r=e.getBoundingClientRect(),t=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return{id:e.id,hit:e===t||e.contains(t),h:r.height}}),aria:document.querySelector('#resume').getAttribute('aria-disabled')}})()`);report.phoneHints.push({w,h,hints:hs,modal:m});check(hs.visible.length===0&&m.top&&m.buttons.every((b:any)=>b.hit&&b.h===48),'터치 '+w+'×'+h+' hints0·실제 모달/버튼 유지',{hints:hs,modal:m});if(h!>w!){const a=await read();await key('p','KeyP');await key('Escape','Escape');const b=await read();check(m.aria==='true'&&a.t===b.t&&await ev(`!!document.querySelector('.pause-panel')`),'세로 P/Esc도 회전 잠금 유지 '+w+'×'+h,{before:a.t,after:b.t})}await snap('phone-pause-'+w+'x'+h)}
    report.keyEvents=await ev('window.__keyProbe');report.notRealUiValidated=['IME composition','editable input fields: no genuine visible input in tested normal game UI']
  }else if(mode==='keyboard-baseline'){
    report.evidence='수정 전 STATIC production50-2, 실제 출전 click과 native P 입력, DOM만 관측. __raid hook 미사용.'
    report.staticInitial=await ev(`({url:location.href,devHook:typeof window.__raid,pointerFine:matchMedia('(pointer:fine)').matches,hover:matchMedia('(hover:hover)').matches,kbd:document.querySelectorAll('kbd').length,startReady:!document.querySelector('#start').disabled})`)
    await click('#start');await sleep(250)
    const before=await ev(`({menuHidden:document.querySelector('#menu').hidden,playVisible:!document.querySelector('#play').hidden,overlayHidden:document.querySelector('#overlay').hidden,resume:!!document.querySelector('#resume')})`)
    await key('p','KeyP');await sleep(200)
    const after=await ev(`({menuHidden:document.querySelector('#menu').hidden,playVisible:!document.querySelector('#play').hidden,overlayHidden:document.querySelector('#overlay').hidden,resume:!!document.querySelector('#resume'),pausePanel:!!document.querySelector('.pause-panel')})`)
    report.baselineP={before,after};report.baselineRedObserved=before.playVisible&&before.overlayHidden&&after.playVisible&&!after.resume&&!after.pausePanel
    check(report.baselineRedObserved,'수정 전 RED: 실제 P 입력 뒤 정지 모달/#resume 없음',report.baselineP);await snap('P-no-pause-RED')
  }else if(mode==='pause-ui'){
    report.evidence='정상 UI start→native CDP touch pause/버튼→viewport회전→계속→세로 철수. sim 직접 주입 없음.'
    await tap('#start');await sleep(300);report.start=await read();await tap('#pause');await waitFor(`!!document.querySelector('.pause-panel')`)
    report.pauseProfiles=[]
    for(const [w,h]of [[360,800],[375,812],[390,844],[412,915],[844,390]]){
      await size(w!,h!);await waitFor(`!!document.querySelector('.pause-panel')`)
      const m=await ev(`(()=>{const p=document.querySelector('.pause-panel'),b=p.getBoundingClientRect(),top=document.elementFromPoint(b.x+b.width/2,b.y+b.height/2),resume=document.querySelector('#resume').getBoundingClientRect();return{width:innerWidth,height:innerHeight,panelTop:!!top?.closest('.pause-panel'),rotateGuideHidden:document.querySelector('#rotate-guide').hidden,scrollX:p.scrollWidth-p.clientWidth,scrollY:p.scrollHeight-p.clientHeight,documentOverflowX:document.documentElement.scrollWidth-innerWidth,continueBottomGap:innerHeight-resume.bottom,ariaDisabled:document.querySelector('#resume').getAttribute('aria-disabled'),buttons:[...p.querySelectorAll('button')].map(e=>{const r=e.getBoundingClientRect(),cs=getComputedStyle(e),t=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return{id:e.id,height:r.height,font:cs.fontSize,inside:r.x>=-1&&r.right<=innerWidth+1&&r.y>=-1&&r.bottom<=innerHeight+1,hit:e===t||e.contains(t)}})}})()`)
      report.pauseProfiles.push(m)
      check(m.panelTop&&m.rotateGuideHidden&&m.buttons.every((b:any)=>b.hit&&b.inside),'정지 모달 실제 최상위·버튼 hit-test '+w+'×'+h,m)
      check(m.buttons.every((b:any)=>Math.abs(b.height-48)<.5&&b.font==='15px')&&m.scrollX<=1&&m.scrollY<=1&&m.documentOverflowX<=1&&m.continueBottomGap>=0&&m.continueBottomGap<=48,'48px/15px·하단 계속·overflow0 '+w+'×'+h,m)
      const a=await read();await sleep(220);const b=await read();check(a.t===b.t,'정지 중 실제 판 시각 고정 '+w+'×'+h,{before:a.t,after:b.t})
      if(h!>w!){check(m.ariaDisabled==='true','세로 계속 aria-disabled=true '+w+'×'+h,m.ariaDisabled);await tap('#resume');const note=await ev(`document.querySelector('#pause-note').textContent`);const after=await read();check(note.includes('가로')&&after.t===b.t&&!after.result,'세로 계속 touch는 회전 까닭 표시·실전 잠금 유지 '+w+'×'+h,{note,t:after.t})}
      await snap('pause-'+w+'x'+h)
      if(w===360){const before=await ev(`(()=>{const c=getComputedStyle(document.querySelector('#tree-open'));return{transform:c.transform,fill:c.backgroundColor}})()`);const p=await touchPoint('#tree-open');await touchStart(p);await sleep(80);const during=await ev(`(()=>{const c=getComputedStyle(document.querySelector('#tree-open'));return{transform:c.transform,fill:c.backgroundColor}})()`);report.pressed={before,during};check(before.transform!==during.transform||before.fill!==during.fill,'native touchstart 중 눌림 transform/채움 변화',report.pressed);await touchEnd();await sleep(100)}else await tap('#tree-open')
      await waitFor(`!document.querySelector('#tree-view').hidden`);check(await ev(`!!document.elementFromPoint(innerWidth/2,innerHeight/2)?.closest('#tree-view')`),'나무 실제 열림 '+w+'×'+h);await tap('.tree-close');await waitFor(`document.querySelector('#tree-view').hidden`)
      if(w===360){
        const style=()=>ev(`(()=>{const c=getComputedStyle(document.querySelector('#tree-open'));return{transform:c.transform,fill:c.backgroundColor}})()`)
        report.pressed.release=await style();check(report.pressed.release.transform===report.pressed.before.transform&&report.pressed.release.fill===report.pressed.before.fill,'touch 해제 후 눌림 모습 복귀',report.pressed)
        const p=await touchPoint('#tree-open');await touchStart(p);await sleep(80);const during=await style();await call('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});await sleep(80);const after=await style();report.pressed.cancel={during,after};check((during.transform!==after.transform||during.fill!==after.fill)&&after.transform===report.pressed.before.transform&&after.fill===report.pressed.before.fill&&await ev(`document.querySelector('#tree-view').hidden`),'native touchCancel 뒤 눌림 복귀·오작동 없음',report.pressed.cancel)
      }
    }
    check(await ev(`document.querySelector('#resume').getAttribute('aria-disabled')==='false'`),'가로 회전 뒤 계속 활성')
    const beforeResume=await read();await tap('#resume');await sleep(350);const resumed=await read();report.resume={before:beforeResume,after:resumed};check(resumed.t>beforeResume.t&&!resumed.overlay,'native 계속 touch로 실제 전투 재개',report.resume)
    await tap('#pause');await size(390,844);await waitFor(`!!document.querySelector('.pause-panel')`)
    await ev(`window.__pauseQuitClickAt=0;window.__pauseResultAt=0;document.addEventListener('click',e=>{if(e.target.closest?.('#quit'))window.__pauseQuitClickAt=performance.now()},{capture:true});new MutationObserver(()=>{if(!window.__pauseResultAt&&document.querySelector('#overlay:not([hidden]) .result'))window.__pauseResultAt=performance.now()}).observe(document.querySelector('#overlay'),{subtree:true,attributes:true,childList:true})`)
    await tap('#quit');report.withdrawFirst=await read();check(report.withdrawFirst.end?.kind==='retreat'&&report.withdrawFirst.end.active&&!report.withdrawFirst.result,'세로 철수에서 연출 실제 시작·결과 조기 표시 없음',report.withdrawFirst)
    await waitFor(`!!document.querySelector('#overlay:not([hidden]) .result')`,7000);report.withdrawDone=await read();report.withdrawDelayMs=await ev('window.__pauseResultAt-window.__pauseQuitClickAt')
    check(report.withdrawDone.end?.ready&&report.withdrawDone.end.elapsed===2&&Math.abs(report.withdrawDelayMs-2000)<160,'세로 철수도 2초 뒤 결과 표시·연출 막힘0',{delay:report.withdrawDelayMs,end:report.withdrawDone.end});await snap('portrait-withdraw-result')
  } else if(mode==='pacing-actual'){
    report.evidence='정상 출전 버튼과 실제 CDP 키/성장 카드 입력. replay/state 주입 없음.';report.config=await installPacing('actual')
    await click('#start');const first=await read();report.actualStart=first;await key('ArrowRight','ArrowRight',350);const moved=await read();check(moved.x>first.x+10,'실제 키보드 이동',{before:first.x,after:moved.x});await key('x','KeyX');await key('x','KeyX')
    report.actualEnd=await drive(70);report.pacing=await ev('window.__raid50')
    check(report.actualEnd.kills>0,'정상 출전 실제 공격으로 격파',report.actualEnd.kills);check(report.config.surge===40&&report.config.respite===18,'몰아침40초·숨고름18초 설정',report.config)
    const c=report.pacing.cycles[0];check(c?.surgeTime>39&&c?.respiteTime>17,'첫 몰아침·숨고름 전 구간 실제 관측',c)
    if(c?.surgeTime&&c?.respiteTime)check(c.respiteBirths/c.respiteTime<c.surgeBirths/c.surgeTime,'숨고름의 관측 새 적 등장률이 몰아침보다 낮음',c)
    check(report.pacing.earlyRangedBirths===0,'관측 전반 구간 원거리 새 적0',report.pacing.kindBirths)
    if(report.actualEnd.state==='playing')for(const [w,h]of [[800,360],[812,375],[844,390],[915,412],[667,375]]){
      await size(w!,h!);await drive((await read()).t+.7,15000);const scene=await read()
      const controls=await ev(`[...document.querySelectorAll('#speed,#zoom,#fullscreen,#pause,#dash,#skill,#wake')].filter(e=>e.getBoundingClientRect().width).map(e=>{const b=e.getBoundingClientRect(),top=document.elementFromPoint(b.x+b.width/2,b.y+b.height/2);return{id:e.id,inside:b.x>=-1&&b.right<=innerWidth+1&&b.y>=-1&&b.bottom<=innerHeight+1,uncovered:e===top||e.contains(top)}})`)
      check(scene.state==='playing'&&!scene.overlay&&controls.every((e:any)=>e.inside&&e.uncovered),w+'×'+h+' 실제 전투·조작 버튼 노출',{scene,controls});await snap('combat-'+w+'x'+h)
    }
    if(report.actualEnd.state==='playing')for(const [w,h]of [[360,800],[375,812],[390,844],[412,915]]){await size(w!,h!);const a=await read();await sleep(250);const b=await read();const guide=await ev(`!document.querySelector('#rotate-guide').hidden&&!!document.elementFromPoint(innerWidth/2,innerHeight/2)?.closest('#rotate-guide')`);check(guide&&a.t===b.t,w+'×'+h+' 세로는 실제 회전 안내·전투 정지',{guide,before:a.t,after:b.t});await snap('portrait-guide-'+w+'x'+h)}
  } else if(mode==='pacing-review'){
    const scene=process.env['PACER_SCENE']??'runner',until=process.env['REVIEW_UNTIL']??(scene==='runner'?'300':'780')
    report.evidence='기존 공식 review '+until+'초 일반 입력 재생 후 실제 UI 계속/키 입력 보조검수. 정상 출전 증거와 별도.'
    await waitFor(`!!document.querySelector('.review-tools [data-until="${until}"]')`);await click(`.review-tools [data-until="${until}"]`)
    await waitFor(`!document.querySelector('.review-tools [data-until="${until}"]').disabled&&document.querySelector('.review-tools output').textContent.includes(' · ')`,120000)
    report.bootstrap=await read();report.bootstrapLabel=await ev(`document.querySelector('.review-tools output').textContent`)
    if(report.bootstrap.state==='playing'){
      await click('.review-tools button:last-child');report.config=await installPacing('official-review-'+until);if(await ev(`!!document.querySelector('#resume')`))await click('#resume');await call('Input.dispatchMouseEvent',{type:'mouseMoved',x:1,y:1})
      if(scene==='runner'){
        report.runnerSnapshot=await ev(`new Promise(resolve=>{const stop=performance.now()+10000;const tick=()=>{const r=window.__raid(),e=r.enemies.find(e=>e.kind==='runner'&&e.act>0&&e.act<=.10);if(e&&!r.offers.length)return resolve({seen:true,t:r.t,enemy:{...e}});if(r.state!=='playing'||performance.now()>stop||r.offers.length)return resolve({seen:false,t:r.t,state:r.state,offers:r.offers});requestAnimationFrame(tick)};tick()})`)
        if(report.runnerSnapshot.seen){await snap('runner-warning');await sleep(250)}else report.unobserved=['runner 최종 움찔·흰 번쩍 실프레임']
        report.pacing=await ev('window.__raid50');check(report.pacing.runnerLaneViolations===0,'관측 runner 경고에서 빨간 길 생성 판정0',report.pacing)
      }else{
        const threat=()=>ev(`(()=>{const r=window.__raid(),m=window.__raid49Draw?.fieldMatrix;return{t:r.t,state:r.state,hp:r.hp,x:r.x,y:r.y,matrix:m,archers:r.enemies.filter(e=>e.kind==='archer').map(e=>({id:e.id,x:e.x,y:e.y,hp:e.hp})),barrage:r.shots.filter(b=>b.kind==='barrage').map(b=>({source:b.source,x:b.x,y:b.y,life:b.life}))}})()`)
        const stop=Date.now()+24000;let current=await threat()
        while(Date.now()<stop&&current.state==='playing'&&!current.barrage.length){await drive(current.t+.35,2000,false);current=await threat()}
        report.barrageSnapshot=current
        if(current.barrage.length){await call('Input.dispatchMouseEvent',{type:'mouseMoved',x:1,y:1});await snap('barrage-with-source');const id=current.barrage[0].source,target=current.archers.find((e:any)=>e.id===id);if(target){if(Math.abs(target.x-current.x)>20)await key(target.x<current.x?'ArrowLeft':'ArrowRight',target.x<current.x?'ArrowLeft':'ArrowRight',350);if(Math.abs(target.y-current.y)>20)await key(target.y<current.y?'ArrowUp':'ArrowDown',target.y<current.y?'ArrowUp':'ArrowDown',350);await key(' ','Space');await drive((await read()).t+5,10000);report.afterAttack=await threat();report.targetId=id;report.targetKilled=!report.afterAttack.archers.some((e:any)=>e.id===id&&e.hp>0);report.sameOwnerPendingAfter=report.afterAttack.barrage.filter((b:any)=>b.source===id).length;if(report.targetKilled){await snap('barrage-owner-dead');check(report.sameOwnerPendingAfter===0,'실제 공격 뒤 사라진 발사자 소속 화살비0',{id,pending:report.sameOwnerPendingAfter})}else report.unobserved=['발사자 실제 처치/즉시 중단 전이']}}else report.unobserved=['살아 있는 화면 안 궁수의 실제 화살비/붉은 표식','발사자 실제 처치 전이']
        report.pacing=await ev('window.__raid50');check(report.pacing.deadSourceViolations===0,'관측 화살비의 죽은/없는 발사자0',report.pacing)
      }
    }else report.unobserved=['공식 review가 종결 상태로 끝나 라이브 표적 관측 불가']
  } else if (mode === 'hit-start') {
    report.evidence='정상 출전 버튼→빠르기 키/성장 카드 UI 선택→idle 실제 HP 0 패배. replay/state 직접 주입 없음.'
    await click('#start');await sleep(200)
    await ev(`if(window.__raid49Draw){window.__raid49Draw.startReads=window.__raid49Draw.reads;window.__raid49Draw.lastHp=window.__raid().hp;window.__raid49Draw.firstHit=null}`)
    report.actualStart=await read();await key('x','KeyX');await key('x','KeyX')
    const stop=Date.now()+180000
    while(Date.now()<stop){const r=await read();if(r.state!=='playing')break;if(r.offers?.length)await click('#overlay [data-up]');await sleep(100)}
    report.actualInputEnd=await read()
    check(report.actualInputEnd.state==='lost'&&report.actualInputEnd.hp===0,'정상 출전 뒤 실제 피격 HP 0 패배 도달',report.actualInputEnd)
    await exerciseEnding()
  } else if (mode === 'fight') {
    await click('#start'); await sleep(300)
    await ev(`if(window.__raid49Draw){window.__raid49Draw.startReads=window.__raid49Draw.reads;window.__raid49Draw.lastHp=window.__raid().hp;window.__raid49Draw.firstHit=null}`)
    const a=await read();await key('ArrowRight','ArrowRight',550);const b=await read()
    check(b.x>a.x+10,'C 적용 정상 출전·실제 방향키 이동',{a,b})
    await key('x','KeyX');await key('x','KeyX')
    const stop=Date.now()+45000
    while(Date.now()<stop){const r=await read();if(r.offers?.length)await click('#overlay [data-up]');if(r.hp<180&&r.kills>0)break;await sleep(100)}
    report.fight=await read();report.canvasFight=await canvasReport();await snap('normal-fight')
    check(report.fight.kills>0,'정상 출전 자동 공격으로 적 격파',report.fight.kills)
    check(report.canvasFight?.firstHit?.readDelta===0,'첫 실제 피격까지 Canvas getImageData readback 0',report.canvasFight?.firstHit)
    check(Object.entries(report.canvasFight?.heroFrames??{}).some(([k,v])=>(k.includes('dana')||k.startsWith('bitmap:'))&&Object.keys(v as object).length>=2),'이동·공격 판의 sprite 복수 crop 프레임 관측 (bitmap 원본 식별 한계)',report.canvasFight?.heroFrames)
  } else if (mode === 'smoke' || mode === 'retreat') {
    await click('#start'); await sleep(400)
    if (await ev(`!!document.querySelector('#overlay:not([hidden]) [data-up]')`)) await click('#overlay [data-up]')
    if (mode === 'smoke') {
    const a = await read(); await key('ArrowRight', 'ArrowRight', 550); const b = await read()
    check(b.x > a.x + 10 && b.t > a.t, '실제 방향키 입력으로 이동/판 시간 전진', { a, b })
    await snap('playing')
    await key('Escape', 'Escape'); await waitFor(`!!document.querySelector('#resume')`)
    const p0 = await read(); await sleep(400); const p1 = await read()
    check(p0.t === p1.t, 'Esc 일시정지 중 판 시각 고정', { before: p0.t, after: p1.t })
    await snap('pause')
    } else { await key('Escape', 'Escape'); await waitFor(`!!document.querySelector('#resume')`) }
    await ev(`window.__raid49watch=[]; new MutationObserver(()=>{const r=window.__raid?.();window.__raid49watch.push({at:performance.now(),state:r?.state,result:!!document.querySelector('#overlay:not([hidden]) .result')})}).observe(document.querySelector('#overlay'),{subtree:true,childList:true,attributes:true});window.__raid49quitAt=performance.now()`)
    await click('#quit'); await sleep(50)
    report.immediateWithdraw = await read(); report.withdrawMutations = await ev('window.__raid49watch'); report.withdrawClickAt = await ev('window.__raid49quitAt')
    await exerciseEnding()
    const wd = await read(); const obs = await ev('window.__raid49watch'); const shownAt = obs.find((x: any) => x.result)?.at
    report.withdrawDelayMs = shownAt - report.withdrawClickAt
    if (report.action === 'complete') check(report.withdrawDelayMs >= 1900 && report.withdrawDelayMs <= 2300 && wd.end.duration === 2, '철수 끝 연출 2초 실측', report.withdrawDelayMs)
    await snap('withdraw-result')
    check(!report.immediateWithdraw.result, '철수 직후 결과 창 지연 (49-A 전에는 빨강)', report.immediateWithdraw)
  } else {
    const until = process.env['REVIEW_UNTIL'] ?? '1146'
    await waitFor(`!!document.querySelector('.review-tools [data-until="${until}"]')`)
    await click(`.review-tools [data-until="${until}"]`)
    await waitFor(`document.querySelector('.review-tools output')?.textContent.includes(' · ') && !document.querySelector('.review-tools [data-until="${until}"]').disabled`, 120000)
    report.replay = { output: await ev(`document.querySelector('.review-tools output').textContent`), run: await read() }
    report.replayInstallTerminal = report.replay.run.state !== 'playing'
    if (report.replayInstallTerminal) report.evidence = '기존 개발 UI 실제입력 봇 종결판 재생 보조검수; 라이브 CDP 입력 종결이 아님'
    console.log('재생', JSON.stringify(report.replay))
    await ev(`if(window.__raid49Draw){window.__raid49Draw.startReads=window.__raid49Draw.reads;window.__raid49Draw.lastHp=window.__raid().hp;window.__raid49Draw.firstHit=null}`)
    // 도구는 기존 닫기 단추로 숨긴다. 결과 레이아웃에 검수 도구가 겹치지 않게 실제 UI를 닫는다.
    if ((await read()).state === 'playing') await click('.review-tools button:last-child')
    else await ev(`document.querySelector('.review-tools button:last-child').click()`)
    if ((await read()).state === 'playing') {
      console.log('최종 상태 아님: 계속 싸우기 후 실제 CDP 키 입력으로 이어감')
      await ev(`window.__raid49timeline=[];window.__raid49last='';window.__raid49raf=function(){const r=window.__raid?.(),e=window.__raidEnd?.(),f=window.__raidFeel?.();const v={at:performance.now(),t:r?.t,state:r?.state,result:!!document.querySelector('#overlay:not([hidden]) .result'),end:e,feel:f};const k=JSON.stringify([v.state,v.result,e?.active,e?.elapsed>=e?.stampAt,f?.stopRemaining>0]);if(k!==window.__raid49last){window.__raid49last=k;window.__raid49timeline.push(v)}if(window.__raid49timeline.length<1000)requestAnimationFrame(window.__raid49raf)};requestAnimationFrame(window.__raid49raf)`)
      if (await ev(`!!document.querySelector('#resume')`)) await click('#resume')
      await key('x', 'KeyX'); await key('x', 'KeyX')
      const held = new Set<string>(), end = Date.now() + 180000
      const arrows: Record<string, string> = { ArrowLeft: 'ArrowLeft', ArrowRight: 'ArrowRight', ArrowUp: 'ArrowUp', ArrowDown: 'ArrowDown' }
      let tick = 0
      while (Date.now() < end && (await read()).state === 'playing') {
        const input = await ev(`(async()=>{const r=window.__raid();const b=await import('/src/raid/haebi-replay.ts');return {input:b.botInput(r),pick:r.offers.length?b.botChoice(r,'storm'):null}})()`)
        if (input.pick) { await click(`#overlay [data-up="${input.pick}"]`); continue }
        const bi = input.input, desired = new Set<string>()
        if (process.env['IDLE'] !== '1') {
          if (bi.x < -.2) desired.add('ArrowLeft'); else if (bi.x > .2) desired.add('ArrowRight')
          if (bi.y < -.2) desired.add('ArrowUp'); else if (bi.y > .2) desired.add('ArrowDown')
        }
        for (const k of held) if (!desired.has(k)) { await call('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code: arrows[k] }); held.delete(k) }
        for (const k of desired) if (!held.has(k)) { await call('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code: arrows[k] }); held.add(k) }
        if (process.env['IDLE'] !== '1') { if (bi.skill) await key(' ', 'Space'); if (bi.dash) await key('Shift', 'ShiftLeft'); if (bi.wake) await key('e', 'KeyE') }
        if (++tick % 50 === 0) console.log('실입력 진행', JSON.stringify(await read()))
        await sleep(100)
      }
      for (const k of held) await call('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code: arrows[k] })
      report.actualInputEnd = await read(); if (process.env['NO_END_SHOTS'] !== '1' && process.env['HIT_ONLY'] !== '1') await snap('terminal-first')
      check(report.actualInputEnd.state !== 'playing', '실제 키 입력으로 종결 상태 도달', report.actualInputEnd)
      report.timeline = await ev('window.__raid49timeline')
    }
    if ((await read()).state !== 'playing') {
      await exerciseEnding()
      await waitFor(`!!document.querySelector('#overlay:not([hidden]) .result')`, 10000)
      if (await ev('!!window.__raid49timeline')) report.timeline = await ev('window.__raid49timeline')
      const terminal = report.timeline?.find((x: any) => x.state !== 'playing'), result = report.timeline?.find((x: any) => x.result)
      if (terminal && result) { report.resultDelayMs = result.at - terminal.at; if (report.action === 'complete') check(Math.abs(report.resultDelayMs - terminal.end.duration * 1000) <= 100, '승패 종결 뒤 결과 창까지 정해진 연출 길이 실측', report.resultDelayMs) }
      for (const [w,h] of process.env['HIT_ONLY']==='1'?[]:[[360,800],[375,812],[390,844],[412,915],[844,390]]) {
        await size(w!,h!); await snap(`result-${w}x${h}`)
        const layout = await ev(`(() => {const es=[...document.querySelectorAll('.result h2,.result p,.result button,.result-combos b')].filter(e=>{const r=e.getBoundingClientRect();return r.width&&r.height});return es.map(e=>{const r=e.getBoundingClientRect();const x=r.x+r.width/2,y=r.y+r.height/2;const top=document.elementFromPoint(x,y);return {text:e.textContent.trim(),x:r.x,y:r.y,w:r.width,h:r.height,inside:r.x>=-1&&r.right<=innerWidth+1&&r.y>=-1&&r.bottom<=innerHeight+1,uncovered:e===top||e.contains(top)}})})()`)
        check(layout.every((x: any) => x.inside && x.uncovered), `${w}×${h} 결과 글/단추 viewport 안·중심 노출`, layout)
      }
    }
  }
  check(report.errors.length === 0, '전체 console/exception 오류 0', report.errors)
  console.log('별도 네트워크 resource 오류', JSON.stringify(report.resources))
  report.final = await read()
  if (process.env['OBSERVE_CANVAS'] === '1') {
    report.canvasFinal = await canvasReport(); report.fxFinal=report.canvasFinal?.fx
    if((mode==='review'||mode==='hit-start')&&report.final.end?.kind){
      const won=report.final.end.kind==='victory',stem=won?'stamp_victory':'stamp_defeat'
      if(process.env['HIT_ONLY']!=='1')check((report.fxFinal?.['/realm/raid/fx/'+stem+'.png']?.count??0)>0&&(report.fxFinal?.['/realm/raid/fx/'+stem+'_band.png']?.count??0)>0,'native 도장 PNG와 별도 띠 PNG가 실제 field에 그려짐',report.fxFinal)
      if(won&&process.env['HIT_ONLY']!=='1')check(report.canvasFinal.raysNextSprite?.count>0,'native rays 다음에 sprite crop이 그려짐 (원본 식별은 소스 순서와 대조)',report.canvasFinal.raysNextSprite)
      else check(Object.values(report.canvasFinal.hitArt).some((x:any)=>x.args.length===4),'패배 HIT 원본 전체 drawImage 사용·얼굴 source crop 없음',report.canvasFinal.hitArt)
    }
  }
  writeFileSync(join(out, `${mode}-report.json`), JSON.stringify(report, null, 2))
  if (report.checks.some((x: any) => !x.ok)) process.exitCode = 1
} catch(error) {
  report.failure=String(error);writeFileSync(join(out,`${mode}-failure-report.json`),JSON.stringify(report,null,2));throw error
} finally {
  ws?.close(); chrome.kill(); await sleep(500)
  if (!prof.startsWith(join(tmpdir(), 'raid49-'))) throw new Error(`임시 프로필 경로 거절: ${prof}`)
  for (let i = 0; i < 12 && existsSync(prof); i++) { try { rmSync(prof, { recursive: true, force: true }) } catch { await sleep(400) } }
}
