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
  const size = async (width: number, height: number) => { await call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 2, mobile: true }); await sleep(300) }
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
  await size(844, 390)
  const q = new URLSearchParams({ kit: process.env['KIT'] ?? 'bow', sprite: process.env['HERO_SPRITE'] ?? 'base-w-102-garak-dana', hero: process.env['HERO_ID'] ?? 'w-102-garak-dana', name: process.env['HERO_NAME'] ?? '다나', bust: process.env['HERO_BUST'] ?? 'w-102-garak-dana' })
  if (mode === 'review'||mode==='pacing-review') { q.set('review', ''); q.set('stage', process.env['STAGE'] ?? 'forest') }
  report.url = `${origin}/raid.html?${q}`
  await call('Page.navigate', { url: report.url })
  await waitFor(`document.querySelector('#start')?.disabled === false`, 45000)
  check(report.errors.length === 0, '첫 로드 console/exception 오류 0', report.errors)
  check((await read()).visibility === 'visible', '탭 visible')
  if (process.env['OBSERVE_CANVAS'] === '1') { report.canvasBoot = await canvasReport(); report.fxBoot=report.canvasBoot?.sources; check(Object.keys(report.fxBoot??{}).length===10&&Object.values(report.fxBoot??{}).every((x:any)=>x.complete&&x.naturalWidth>0),'실제 warmFx 공유 이미지 10개 로드·native 크기 양수',report.fxBoot) }
  if(mode==='pause-ui'){
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
} finally {
  ws?.close(); chrome.kill(); await sleep(500)
  if (!prof.startsWith(join(tmpdir(), 'raid49-'))) throw new Error(`임시 프로필 경로 거절: ${prof}`)
  for (let i = 0; i < 12 && existsSync(prof); i++) { try { rmSync(prof, { recursive: true, force: true }) } catch { await sleep(400) } }
}
