/** 53-A observational baseline. Root runs this; --preflight never launches/attaches a browser.
 * node --experimental-strip-types tools/raid53-hd-probe.ts OUT before URL --hero=gj-dana --size=844x390 --dpr=2 [--attach-port=PORT]
 * Existing49 raw CDP/native-input pattern, without its state builders, KEEP, review replay or storage writes.
 */
import { spawn, execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, writeFileSync, openSync, closeSync, unlinkSync, readFileSync, statfsSync, rmSync, realpathSync, lstatSync } from 'node:fs'
import { tmpdir, freemem, totalmem, loadavg, cpus } from 'node:os'
import { join, resolve, sep } from 'node:path'
import { createHash } from 'node:crypto'

const args = process.argv.slice(2), flag = (key: string) => args.find(a => a.startsWith(`--${key}=`))?.split('=').slice(1).join('=')
const preflight = args.includes('--preflight'), root = resolve(import.meta.dirname, '..'), out = resolve(args[0] ?? join(tmpdir(), 'raid53-report'))
const phase = args[1] ?? 'before', origin = args[2] ?? 'http://localhost:5174', requestedHero = flag('hero') ?? 'tut-haebi'
const [width, height] = (flag('size') ?? '844x390').split('x').map(Number) as [number, number], dpr = Number(flag('dpr') ?? 2)
const asset = flag('asset') ?? ''
const assets: Record<string, Record<string, string>> = {
  dana: { hero: 'gj-dana', name: '다나', bust: 'w-102-garak-dana', sprite: 'base-w-102-garak-dana', kit: 'bow', video: '1' },
  jumong: { hero: 'jm-jumong', name: '주몽', bust: 'g-64-jumong', sprite: 'jumong', awake: 'aw1-jumong', kit: 'bow', video: '1' },
  'haebi-aw1': { hero: 'tut-haebi', name: '해비 각성 그림 검수', bust: 'w-95-michuhol-haebi', sprite: 'aw1-haebi', kit: 'axe', video: '0' },
}
const hero = assets[asset]?.hero ?? requestedHero
if (asset && !assets[asset]) throw new Error('Unknown visual asset preset')
const blockHd = args.includes('--block-hd'), lowGfx = args.includes('--low-gfx')
const entryQuery = new URLSearchParams(asset ? assets[asset] : undefined)
if (lowGfx) entryQuery.set('gfx', 'low')
const entryUrl = origin.replace(/\/$/, '') + '/raid.html' + (entryQuery.size ? '?' + entryQuery : '')
const testCondition = blockHd || lowGfx ? { mode: 'PHOTO_TEST_INPUT_ONLY', blockedUrls: blockHd ? ['*gen-jumong_hd.png'] : [], graphics: lowGfx ? { mode: 'query-mode', value: 'gfx=low' } : null, limitation: 'Fault/query test input only; no ownership/awakening or full quality-setting UI-path proof. No performance samples.' } : null
const photosOnly = args.includes('--photos-only')
if (photosOnly && !asset) throw new Error('Compiled photos-only requires an explicit art preset')
if ((blockHd || lowGfx) && !photosOnly) throw new Error('Fault/quality test options require --photos-only')
const wantAwake = args.includes('--awake'), headed = args.includes('--headed'), attachPort = Number(flag('attach-port') ?? 0)
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms)), sha = (p: string) => createHash('sha256').update(readFileSync(p)).digest('hex')
const machine = () => { const d = statfsSync(root); return { freeGiB: freemem() / 2 ** 30, totalGiB: totalmem() / 2 ** 30, loadavg: loadavg(), cpuCount: cpus().length, workspaceDiskFreeGiB: d.bavail * d.bsize / 2 ** 30, swap: 'not measured on Windows' } }
const observer = String.raw`(() => {
 const O=window.__raid53Meter={frames:[],cacheSources:[],canvasSources:[],errors:[],active:null}, labels=new WeakMap();
 const label=img=>{const old=labels.get(img);if(old)return old;return {path:img.currentSrc||img.src||img.constructor?.name||'unknown',w:img.naturalWidth||img.width||0,h:img.naturalHeight||img.height||0}};
 const proto=CanvasRenderingContext2D.prototype;
 for(const method of ['drawImage','setTransform','fillRect','strokeRect','fill','stroke','fillText','strokeText','clearRect']){
  const native=proto[method];proto[method]=function(...a){const field=this.canvas.id==='field',f=O.active,start=performance.now();
   const result=native.apply(this,a),end=performance.now();
   if(method==='drawImage'){
    const from=label(a[0]);
    if(!field&&a[0]!==this.canvas){labels.set(this.canvas,{...from,cacheW:this.canvas.width,cacheH:this.canvas.height});if(O.cacheSources.length<80&&!O.cacheSources.some(x=>x.path===from.path&&x.cacheW===this.canvas.width&&x.cacheH===this.canvas.height))O.cacheSources.push({...from,cacheW:this.canvas.width,cacheH:this.canvas.height,smoothing:this.imageSmoothingEnabled,quality:this.imageSmoothingQuality});}
    if(field&&String(from.path).includes('/gen-')&&O.canvasSources.length<100){const matrix=this.getTransform(),entry={...from,sourceW:a[0].width,sourceH:a[0].height,drawArgs:a.slice(1),matrix:[matrix.a,matrix.b,matrix.c,matrix.d,matrix.e,matrix.f],smoothing:this.imageSmoothingEnabled};if(!O.canvasSources.some(x=>JSON.stringify(x)===JSON.stringify(entry)))O.canvasSources.push(entry);}
   }
   if(field&&f){f.drawApiMs+=end-start;f.drawCalls++;f.fieldFirst??=start;f.fieldLast=end;}
   return result;
  };
 }
 if(window.createImageBitmap){const native=window.createImageBitmap;window.createImageBitmap=function(...a){const from=label(a[0]);return native.apply(this,a).then(b=>{labels.set(b,from);return b})};}
 const visible=e=>!!e&&!e.hidden&&!!e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden';
 O.rotationState=()=>{const guideVisible=visible(document.querySelector('#rotate-guide')),overlayVisible=visible(document.querySelector('#overlay')),note=document.querySelector('#pause-note'),messageVisible=visible(note)&&note.textContent.includes('폰을 가로로 돌리면 전투를 계속할 수 있습니다.'),resumeDisabled=document.querySelector('#resume')?.getAttribute('aria-disabled')==='true';return{blocked:guideVisible||(overlayVisible&&messageVisible&&resumeDisabled),guideVisible,pauseOverlayVisible:overlayVisible,pauseRotationMessageVisible:messageVisible,resumeAriaDisabled:resumeDisabled,pauseNoteText:visible(note)?note.textContent:null}};
 const valid=()=>{const r=window.__raid?.(),c=document.querySelector('#field'),b=c?.getBoundingClientRect();return !!r&&r.state==='playing'&&!r.offers.length&&!r.cast&&document.visibilityState==='visible'&&!!b?.width&&!!b?.height&&document.querySelector('#play')?.hidden===false&&document.querySelector('#overlay')?.hidden===true&&!O.rotationState().blocked};
 const nativeRaf=window.requestAnimationFrame;
 window.requestAnimationFrame=function(fn){return nativeRaf.call(this,function(t){if(fn.name!=='frame')return fn.call(this,t);const r=window.__raid?.(),f={timestamp:t,start:performance.now(),validStart:valid(),validEnd:false,drawApiMs:0,drawCalls:0,fieldFirst:null,fieldLast:null,t:r?.t??null,enemies:r?.enemies.length??0,form:r?.form??null,casts:!!r?.cast};O.active=f;try{return fn.call(this,t)}finally{f.callbackMs=performance.now()-f.start;f.validEnd=valid();f.drawSpanMs=f.fieldFirst===null?null:f.fieldLast-f.fieldFirst;O.active=null;if(O.frames.length<18000)O.frames.push(f)}})};
})()`
new Function(observer)
if (!Number.isFinite(width) || !Number.isFinite(height) || ![1, 2].includes(dpr)) throw new Error('Use --size=WxH and DPR1/2')
if (preflight) { console.log(JSON.stringify({ mode: 'PREFLIGHT_NO_BROWSER', testCondition, visualAssetPreset: asset || null, entryUrl, hero, width, height, dpr, phase, warmupSeconds: 5, sampleSeconds: 10, samples: 3, machine: machine(), observerParses: true, prohibited: ['state injection','HP/level/ranks/form/unlock assignment','storage writes','review builders','product source changes'], limitation: asset ? 'Visual art entry only; no ownership/awakening proof. No RNG override; no causal FPS claim.' : 'Fresh isolated profile owns only default Haebi; Dana/Jumong must exist in real UI, otherwise SKIP_NOT_OWNED. Awake requires real eligibility/gauge. No fixed-seed UI exists, so unmatched RNG samples cannot prove FPS improvement.' }, null, 2)); process.exit(0) }
if (out === root || out.startsWith(root + sep)) throw new Error('Output must be outside repository')
mkdirSync(out, { recursive: true })
const lockPath = join(tmpdir(), 'codex-raid53-probe.lock'), lock = openSync(lockPath, 'wx'); writeFileSync(lock, JSON.stringify({ pid: process.pid, phase, out })); closeSync(lock)
const report: any = { phase, hero, testCondition, requested: { width, height, dpr, zoom: 1.8, wantAwake }, evidence: asset ? 'Official art-only realm deep link and actual start/zoom UI; not ownership or awakening authority proof' : attachPort ? 'Real owned roster/native CDP UI in a new tab of explicitly supplied debug browser; emulated viewport is not phone FPS' : 'Isolated Chrome render/UI test; headless/emulated viewport is not real phone FPS', visualAssetPreset: asset || null, ownershipClaim: !asset, formClaim: asset === 'haebi-aw1' ? 'awakened artwork as visual base only; no awakening-state claim' : 'observed run.form only', headless: !headed && !attachPort, machineBefore: machine(), errors: [], actions: [], samples: [], screenshots: [], source: {}, instrumentation: 'Read-only __raid observer plus native canvas/RAF wrappers; timing includes observer overhead, no GPU flush; drawSpan=first-to-last field canvas call, not exact drawField function CPU', fixedSeed: false, performanceCausality: 'UNMATCHED_RNG_NOT_CAUSAL; no RNG/seed override and no save injection' }
for (const p of ['src/raid-main.ts','src/raid/haebi-view.ts','src/raid/camera.ts','src/tune/params.ts']) report.source[p] = sha(join(root,p))
try { report.commit = execFileSync('git',['-c','safe.directory='+root,'rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim() } catch { report.commit = null }
let diagnose: (() => Promise<void>) | undefined
let browser: ReturnType<typeof spawn> | undefined, profile: string | undefined, pageId: string | undefined, cdp: any, browserCdp: any
const connect = async (url: string) => { const ws = new WebSocket(url); await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j});let id=0;const waits=new Map<number,{ok:(x:any)=>void,bad:(x:any)=>void,timer:ReturnType<typeof setTimeout>}>(),requests=new Map<string,string>();ws.onmessage=e=>{const m=JSON.parse(String(e.data));if(m.id){const w=waits.get(m.id);if(w){clearTimeout(w.timer);waits.delete(m.id);m.error?w.bad(new Error(JSON.stringify(m.error))):w.ok(m.result)}}else if(m.method==='Network.requestWillBeSent')requests.set(m.params.requestId,m.params.request.url);else if(m.method==='Runtime.exceptionThrown')report.errors.push(m.params.exceptionDetails);else if(m.method==='Network.responseReceived'){const r=m.params.response;(report.resourceResponses??=[]).push({url:r.url,status:r.status,mimeType:r.mimeType,fromDiskCache:r.fromDiskCache??false});}else if(m.method==='Network.loadingFailed')(report.resourceFailures??=[]).push({urlId:m.params.requestId,url:requests.get(m.params.requestId)??null,errorText:m.params.errorText,blockedReason:m.params.blockedReason??null,canceled:m.params.canceled??false})};return {ws,call:(method:string,params:object={})=>new Promise<any>((ok,bad)=>{const n=++id,timer=setTimeout(()=>{waits.delete(n);bad(new Error('CDP timeout '+method))},30000);waits.set(n,{ok,bad,timer});ws.send(JSON.stringify({id:n,method,params}))})} }
let port = attachPort
try {
 if (!port) { const exe=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(existsSync);if(!exe)throw new Error('Chrome missing');profile=mkdtempSync(join(tmpdir(),'raid53-'));port=9800+Math.floor(Math.random()*70);browser=spawn(exe,[...headed?[]:['--headless=new'],`--remote-debugging-port=${port}`,`--user-data-dir=${profile}`,`--window-size=${width},${height}`,'--no-first-run','--mute-audio','about:blank'],{stdio:'ignore',windowsHide:!headed}); }
 let version:any;for(let i=0;i<50&&!version;i++){try{version=await(await fetch(`http://127.0.0.1:${port}/json/version`)).json()}catch{await sleep(200)}}if(!version)throw new Error('CDP unavailable')
 report.browserVersion=version;browserCdp=await connect(version.webSocketDebuggerUrl);try{const g=await browserCdp.call('SystemInfo.getInfo');report.gpu=g.gpu}catch(e){report.gpuError=String(e)}
 const page:any=await(await fetch(`http://127.0.0.1:${port}/json/new?about:blank`,{method:'PUT'})).json();pageId=page.id;cdp=await connect(page.webSocketDebuggerUrl)
 const call=cdp.call, ev=async(expression:string)=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails));return r.result?.value}
 const waitFor=async(expr:string,ms=20000)=>{const end=Date.now()+ms;while(Date.now()<end){if(await ev(expr))return;await sleep(150)}throw new Error('UI condition timeout '+expr)}
 const click=async(sel:string)=>{const p=await ev(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(!e||e.disabled)return null;const b=e.getBoundingClientRect(),x=b.x+b.width/2,y=b.y+b.height/2,t=document.elementFromPoint(x,y);return{x,y,hit:!!b.width&&!!b.height&&(t===e||e.contains(t))}})()`);if(!p?.hit)throw new Error('Actual hit target unavailable '+sel);await call('Input.dispatchMouseEvent',{type:'mousePressed',x:p.x,y:p.y,button:'left',clickCount:1});await call('Input.dispatchMouseEvent',{type:'mouseReleased',x:p.x,y:p.y,button:'left',clickCount:1});report.actions.push({type:'click',selector:sel})}
 const key=async(k:string,down:boolean)=>{await call('Input.dispatchKeyEvent',{type:down?'keyDown':'keyUp',key:k,code:k})}
 const read=()=>ev(`(()=>{const r=window.__raid?.(),c=document.querySelector('#field'),b=c?.getBoundingClientRect(),s=b?Math.min(b.width/1120,b.height/720):0;return{visibility:document.visibilityState,dpr:devicePixelRatio,url:location.pathname+location.search,canvas:b?{rect:{x:b.x,y:b.y,w:b.width,h:b.height},backing:{w:c.width,h:c.height},content:{w:1120*s,h:720*s},cssScale:s,backingPerLogical:c.width/1120,backingPerCss:s?c.width/(1120*s):null}:null,rotationBlocked:window.__raid53Meter.rotationState().blocked,rotationObservation:window.__raid53Meter.rotationState(),overlay:document.querySelector('#overlay')?.hidden===false,run:r?{t:r.t,state:r.state,seedState:r.seed,hp:r.hp,level:r.level,kit:r.kit,stage:r.stage,form:r.form,gauge:r.gauge,canAwaken:r.canAwaken,enemies:r.enemies.length,offers:r.offers,ranks:r.ranks,bonus:r.bonus}:null}})()`)
 const snap=async(label:string)=>{const x=await call('Page.captureScreenshot',{format:'png'}),p=join(out,`${phase}-${hero}-${width}x${height}-dpr${dpr}-${label}.png`);writeFileSync(p,Buffer.from(x.data,'base64'));report.screenshots.push(p)}
 diagnose=async()=>{
  report.failureDom=await ev("(()=>({url:location.href,title:document.title,readyState:document.readyState,hasRaidHook:typeof window.__raid==='function',start:(()=>{const e=document.querySelector('#start');return e?{text:e.textContent,disabled:e.disabled,html:e.outerHTML}:null})(),bodyText:document.body?.innerText?.slice(0,1600),scripts:[...document.scripts].map(s=>s.src).filter(Boolean),images:[...document.images].slice(0,60).map(i=>({src:/^data:image/i.test(i.currentSrc||i.src)?'[data-image]':i.currentSrc||i.src,complete:i.complete,naturalWidth:i.naturalWidth,naturalHeight:i.naturalHeight})),resources:performance.getEntriesByType('resource').map(r=>({url:/^data:image/i.test(r.name)?'[data-image]':r.name,status:r.responseStatus??null,transferSize:r.transferSize}))}))()")
  report.imageErrors=(report.resourceResponses??[]).filter((r:any)=>r.status>=400||/image/.test(r.mimeType)&&r.status!==200&&r.status!==304)
  await snap('failure')
 }
 report.sourceNote='Working-tree hashes are provenance only, not compiled bundle identity; use actual script/resource responses and root manifest for compiled before/after.'
 await call('Page.enable');await call('Network.enable');if(blockHd)await call('Network.setBlockedURLs',{urls:['*gen-jumong_hd.png']});await call('Page.bringToFront');await call('Runtime.enable');await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:dpr,mobile:width<1000});await call('Page.addScriptToEvaluateOnNewDocument',{source:observer});await call('Page.navigate',{url:entryUrl});await waitFor(`(${photosOnly?'true':'!!window.__raid'})&&!!document.querySelector('#start')&&!document.querySelector('#start').disabled`)
 if(!asset)await click('#open-heroes');report.actualOwnedOptions=asset?null:await ev(`[...document.querySelectorAll('[data-hero]')].map(e=>({id:e.dataset.hero,name:e.querySelector('b')?.textContent}))`)
 if(!asset&&!report.actualOwnedOptions.some((x:any)=>x.id===hero)){report.status='SKIP_NOT_OWNED';report.note='Requested hero absent in actual selection UI; no roster/unlock injection performed'}
 else {
  if(!asset)await click(`[data-hero="${hero}"]`);else report.actions.push({type:"official-visual-deeplink",url:entryUrl,ownershipClaim:false});await waitFor(`(${photosOnly?'true':'!!window.__raid'})&&!!document.querySelector('#start')&&!document.querySelector('#start').disabled&&document.querySelector('#shop').hidden`);await click('#start');await waitFor(`document.querySelector('#play').hidden===false`)
  report.started=await read()
  if(report.started.rotationBlocked){report.status='SKIP_PORTRAIT_ROTATION_BLOCKED';await snap('rotation-blocked');report.note='Portrait390 route correctly blocks play; no fabricated FPS sample'}
  else if(wantAwake&&!report.started.run.canAwaken){report.status='SKIP_AWAKE_NOT_ELIGIBLE';report.note='Real account lacks demon seal eligibility; no forced awakening'}
  else {
   // Always operate the real button, even if persistent zoom already equals1.8.
   await click('#zoom');for(let n=0;n<3&&await ev(`document.querySelector('#zoom').getAttribute('aria-label')!=='원래 크기로'`);n++)await click('#zoom');await sleep(500)
   report.zoomUi=await ev(`({label:document.querySelector('#zoom').getAttribute('aria-label'),pressed:document.querySelector('#zoom').getAttribute('aria-pressed')})`)
   if(photosOnly){await sleep(5000);await snap('visual-only');report.status='VISUAL_ONLY_CAPTURED';report.performanceCausality='NO_PERFORMANCE_MEASUREMENT_COMPILED_ART_ONLY';report.ownershipClaim=false;report.formClaim='artwork only, no awakening or ownership claim'}else{
   const held=new Set<string>(),directions=['ArrowRight','ArrowDown','ArrowLeft','ArrowUp'];let seq=0
   const drive=async(ms:number)=>{const end=Date.now()+ms;while(Date.now()<end){const r=await read();if(r.run?.state!=='playing')break;if(r.visibility!=='visible')throw new Error('Hidden tab invalidates observation');if(r.run.offers.length){for(const k of held)await key(k,false);held.clear();await click('#overlay .choices [data-up]');}else{const next=directions[Math.floor(seq++/5)%4]!;for(const k of held)if(k!==next){await key(k,false);held.delete(k)}if(!held.has(next)){await key(next,true);held.add(next)}if(wantAwake&&r.run.form==='normal'&&await ev(`!document.querySelector('#wake').disabled&&document.querySelector('#wake').getAttribute('aria-disabled')!=='true'`)){await click('#wake')}}await sleep(200)}for(const k of held)await key(k,false);held.clear()}
   if(wantAwake){const end=Date.now()+90000;while(Date.now()<end&&(await read()).run.form!=='awake'&&(await read()).run.state==='playing')await drive(1000);report.awakeReached=(await read()).run.form==='awake';if(!report.awakeReached)report.status='SKIP_AWAKE_NOT_REACHED'}
   if(!report.status){console.log('warming cache5s');await drive(5000);report.afterWarmup=await read();await snap('warmup')
    for(let n=1;n<=3;n++){const start=await ev('performance.now()');const a=await read();await drive(10000);const end=await ev('performance.now()'),b=await read();const met=await ev(`(()=>{const m=window.__raid53Meter,all=m.frames.filter(f=>f.start>=${start}&&f.start<=${end});const q=x=>{const a=x.filter(Number.isFinite).sort((a,b)=>a-b);return a.length?{n:a.length,mean:a.reduce((s,n)=>s+n,0)/a.length,p50:a[Math.floor((a.length-1)*.5)],p95:a[Math.floor((a.length-1)*.95)]}:null},good=all.filter(f=>f.validStart&&f.validEnd),ints=[];for(let i=1;i<all.length;i++)if(all[i].validStart&&all[i].validEnd&&all[i-1].validStart&&all[i-1].validEnd)ints.push(all[i].timestamp-all[i-1].timestamp);return{frameCount:all.length,validFrames:good.length,validFraction:all.length?good.length/all.length:0,rAF:q(ints),over33Ms:ints.length?ints.filter(n=>n>33.333).length/ints.length:null,over50Ms:ints.length?ints.filter(n=>n>50).length/ints.length:null,callbackCpu:q(good.map(f=>f.callbackMs)),fieldDrawSpanCpu:q(good.map(f=>f.drawSpanMs)),canvasApiCpu:q(good.map(f=>f.drawApiMs)),drawCalls:q(good.map(f=>f.drawCalls)),enemyCount:q(good.map(f=>f.enemies)),forms:[...new Set(good.map(f=>f.form))],cacheSources:m.cacheSources,heroDrawSources:m.canvasSources}})()`);report.samples.push({sample:n,wallSeconds:(end-start)/1000,before:a,after:b,...met});console.log(JSON.stringify({sample:n,frames:met.validFrames,rAF:met.rAF,fieldDrawSpanCpu:met.fieldDrawSpanCpu,forms:met.forms}));await snap('sample'+n)}
    report.status=report.samples.every((s:any)=>s.validFrames>0&&s.rAF?.n>0)?'OBSERVED_UNMATCHED_RNG':'INVALID_NO_ACTIVE_FRAMES';if(wantAwake&&!report.samples.every((s:any)=>s.forms.length===1&&s.forms[0]==='awake'))report.awakePerfLimitation='FORM_CHANGED_DURING_SAMPLES; not a stable awakened performance comparison'
   }
  }
 }
 }
 report.final=await read();report.observer=await ev(`({cacheSources:__raid53Meter.cacheSources,heroDrawSources:__raid53Meter.canvasSources,frameCount:__raid53Meter.frames.length})`)
} catch(e) {report.status='ERROR';report.failure=String(e);if(diagnose)try{await diagnose()}catch(d){report.diagnosticFailure=String(d)};process.exitCode=1}
finally {
 report.machineAfter=machine();writeFileSync(join(out,`${phase}-report.json`),JSON.stringify(report,null,2));console.log(JSON.stringify({status:report.status,out,phoneFpsClaim:false,samples:report.samples.length}))
 cdp?.ws.close();browserCdp?.ws.close();if(pageId)try{await fetch(`http://127.0.0.1:${port}/json/close/${pageId}`)}catch{}
 if(browser){browser.kill();await sleep(700)}
 if(profile&&existsSync(profile)){const actual=realpathSync(profile),base=resolve(tmpdir())+sep;if(!lstatSync(profile).isSymbolicLink()&&actual.startsWith(base)&&actual.slice(base.length).startsWith('raid53-'))try{rmSync(actual,{recursive:true,force:true})}catch{report.profileCleanup='Chrome lock; temp profile preserved'}}
 unlinkSync(lockPath)
}
