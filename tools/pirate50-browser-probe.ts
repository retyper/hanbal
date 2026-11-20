/** 50-5 정상 막는다→native touch. sim/meta/perf 값은 읽기만 한다. 출력은 저장소 밖. */
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const out = process.argv[2]
if (!out) throw new Error('저장소 밖 출력 폴더 필요')
const origin = process.argv[3] ?? 'http://localhost:5174', mode = process.argv[4] ?? 'actual'
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms)), port = 9840 + Math.floor(Math.random() * 40)
const exe = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(existsSync)
if (!exe) throw new Error('Chrome 없음')
mkdirSync(out, { recursive: true })
const profile = mkdtempSync(join(tmpdir(), 'pirate50-')), safeProfile = resolve(profile)
const chrome = spawn(exe, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--window-size=844,390', '--no-first-run', '--mute-audio', 'about:blank'], { stdio: 'ignore' })
const report: any = { mode, evidence: '일반 막는다 UI native touch 출전/당겨쏘기. simulation 직접주입0; hook 읽기만. Component fixture와 별도.', checks: [], errors: [], resources: [], shots: [], profiles: [], releases: [] }
let ws: WebSocket | undefined
try {
  let tabs: any
  for (let n = 0; n < 50 && !tabs; n++) { try { tabs = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json() } catch { await sleep(200) } }
  ws = new WebSocket(tabs.find((t: any) => t.type === 'page').webSocketDebuggerUrl)
  await new Promise((r, j) => { ws!.onopen = r; ws!.onerror = j })
  let id = 0
  const pending = new Map<number, (v: any) => void>()
  const call = (method: string, params: object = {}): Promise<any> => new Promise((r, j) => { const n = ++id, timer = setTimeout(() => { pending.delete(n); j(new Error('CDP timeout ' + method)) }, 30000); pending.set(n, v => { clearTimeout(timer); r(v) }); ws!.send(JSON.stringify({ id: n, method, params })) })
  ws.onmessage = e => { const m = JSON.parse(String(e.data)); if (m.id !== undefined) { pending.get(m.id)?.(m.error ? { error: m.error } : m.result); pending.delete(m.id); return } if (m.method === 'Runtime.exceptionThrown') report.errors.push(m.params.exceptionDetails); if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') report.errors.push(m.params.args); if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') (m.params.entry.source === 'network' ? report.resources : report.errors).push(m.params.entry) }
  const ev = async (expression: string) => { const r = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (r.error || r.exceptionDetails) throw new Error(JSON.stringify(r.error ?? r.exceptionDetails)); return r.result?.value }
  const check = (ok: boolean, what: string, detail?: any) => { report.checks.push({ ok, what, detail }); console.log(ok ? '통과' : '실패', what, JSON.stringify(detail ?? null)) }
  const wait = async (expression: string, ms = 30000) => { const end = Date.now() + ms; while (Date.now() < end) { if (await ev(expression)) return; await sleep(100) } report.timeout={expression,dom:await ev(`({hook:typeof window.__pirate,phase:window.__pirate?.run.phase,elapsed:window.__pirate?.run.w.elapsed,visibility:document.visibilityState,text:document.querySelector('#night-ui')?.innerText,pointer:window.__pirate50?.pointer})`)};writeFileSync(join(out,'failure-report.json'),JSON.stringify(report,null,2));const shot=await call('Page.captureScreenshot',{format:'png'});writeFileSync(join(out,'failure.png'),Buffer.from(shot.data,'base64'));throw new Error('조건 시간초과 ' + expression) }
  const size = async (w: number, h: number) => { await call('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 2.6, mobile: true }); await sleep(250) }
  const touch = (type: string, x?: number, y?: number) => call('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' || type === 'touchCancel' ? [] : [{ x, y, id: 1, force: 1, radiusX: 1, radiusY: 1 }] })
  const tap = async (sel: string) => { const p = await ev(`(()=>{const e=document.querySelector(${JSON.stringify(sel)}),r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2,t=document.elementFromPoint(x,y);return{x,y,hit:e===t||e.contains(t)}})()`); if (!p.hit) throw new Error('native tap 대상 가림 ' + sel); await touch('touchStart', p.x, p.y); await sleep(60); await touch('touchEnd'); return p }
  const snap = async (label: string) => { const r = await call('Page.captureScreenshot', { format: 'png' }), path = join(out, `${label}.png`); writeFileSync(path, Buffer.from(r.data, 'base64')); report.shots.push(path) }
  const read = () => ev(`(()=>{const r=window.__pirate?.run,w=r?.w;return{phase:r?.phase,shots:r?.shots,lives:r?.lives,t:w?.elapsed,archer:w&&{x:w.archer.x,y:w.archer.y},arrows:w?.arrows.filter(a=>a.alive||a.age>0).map(a=>({id:a.id,alive:a.alive,x:a.x,y:a.y,vx:a.vx,vy:a.vy,outcome:a.outcome,age:a.age})),perf:window.__pirate?.perf&&{...window.__pirate.perf}}})()`)
  await call('Page.enable'); await call('Runtime.enable'); await call('Log.enable'); await call('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 }); await call('Emulation.setFocusEmulationEnabled', { enabled: true }); await size(844, 390)
  await call('Page.addScriptToEvaluateOnNewDocument', { source: String.raw`(()=>{const labels=new WeakMap(),p=CanvasRenderingContext2D.prototype,draw=p.drawImage;window.__pirate50={observe:true,fly:0,pin:0,other:0,paths:{},pointer:{down:0,move:0,up:0}};for(const [event,key]of [['pointerdown','down'],['pointermove','move'],['pointerup','up']])addEventListener(event,()=>window.__pirate50.pointer[key]++,{passive:true});p.drawImage=function(source,...args){const value=draw.call(this,source,...args),s=window.__pirate50;if(!s.observe)return value;const key=typeof source.src==='string'?new URL(source.src,location.href).pathname:labels.get(source);if(key&&key.includes('/sprites/fly-')){if(this.canvas.id!=='night')labels.set(this.canvas,key);else{const stack=new Error().stack||'',kind=/drawArrowPinArt|drawArrowTailArt/.test(stack)?'pin':/drawArrowCrisp/.test(stack)?'fly':'other';s[kind]++;s.paths[key]??={fly:0,pin:0,other:0};s.paths[key][kind]++}}return value}})()` })
  await call('Page.navigate', { url: origin + '/pirate.html' }); await wait(`!!document.querySelector('[data-act="go"]')`); await sleep(500)
  report.entryHit = await tap('[data-act="go"]'); report.entryAfter=await read();writeFileSync(join(out,'entry-report.json'),JSON.stringify({...report,entryDom:await ev(`({hook:typeof window.__pirate,visibility:document.visibilityState,text:document.querySelector('#night-ui')?.innerText,pointer:window.__pirate50?.pointer})`)},null,2));await wait(`window.__pirate?.run.phase==='fight'`); report.initial = await read(); check(report.errors.length === 0, '첫 로드 기능 JS오류0', report.errors)
  const profiles = mode === 'close-only' ? [] : [[800, 360], [812, 375], [844, 390], [915, 412], [667, 375]]
  for (let n = 0; n < profiles.length; n++) {
    const [w, h] = profiles[n]!; await size(w!, h!); const x = w! * .55, y = h! * .55, dy = n === 2 ? -25 : 36
    const layout = await ev(`(()=>{const c=document.querySelector('#night'),r=c.getBoundingClientRect(),t=document.elementFromPoint(${x},${y}),q=document.querySelector('[data-act="quit"]'),b=q?.getBoundingClientRect(),v=b&&document.elementFromPoint(b.x+b.width/2,b.y+b.height/2);return{overflow:document.documentElement.scrollWidth-innerWidth,canvas:{x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height,backWidth:c.width,backHeight:c.height},canvasTouchHit:c===t,quit:!!q&&{inside:b.x>=0&&b.right<=innerWidth&&b.y>=0&&b.bottom<=innerHeight,hit:q===v||q.contains(v)}}})()`)
    const before = await read(); await touch('touchStart', x, y)
    for (let k = 1; k <= 12; k++) { await touch('touchMove', x - k * 10, y + dy * k / 12); await sleep(55) }
    await sleep(250); report.profiles.push({ w, h, ...layout, during: await read() }); await snap(`pull-${w}x${h}`)
    check(layout.overflow <= 1 && layout.canvasTouchHit && layout.quit?.inside && layout.quit.hit, `전투 ${w}×${h} overflow0·실제 canvas/그만 touchhit`, layout)
    if (n < 3) {
      await touch('touchEnd'); await sleep(60); const first = await read(); await sleep(120); const second = await read()
      const moved = (first.arrows ?? []).some((a: any) => a.alive && (second.arrows ?? []).some((b: any) => b.id === a.id && (Math.abs(a.x - b.x) > .001 || Math.abs(a.y - b.y) > .001)))
      report.releases.push({ before, first, second, moved }); check(first.shots === before.shots + 1, `native 당겨쏘기 ${n + 1} shots+1`, { before: before.shots, after: first.shots }); check(moved, `실제 비행 화살 ${n + 1} 좌표 이동`, { first: first.arrows, second: second.arrows }); await snap(`flight-${n + 1}`)
    } else { await touch('touchMove', x, y); await touch('touchEnd'); await sleep(100); const after = await read(); check(after.shots === before.shots, `추가 시각검수 ${w}×${h} 고리내 해제 발사0`, { before: before.shots, after: after.shots }) }
  }
  await sleep(600); report.after = await read(); report.imageUse = await ev(`({...window.__pirate50})`); await snap('after-three-shots')
  report.sameImageActualObserved = Object.values(report.imageUse.paths ?? {}).some((v: any) => v.fly > 0 && v.pin > 0)
  report.pinActualObserved = report.imageUse.pin > 0
  if (!report.pinActualObserved) report.unobserved = ['실제 사용자 경로 박힘 화살 및 flying/pin 동일 이미지 동시 사용. Component fixture/소스 근거와 별도.']
  if (process.env['CPU6'] === '1') {
    await ev(`window.__pirate50.observe=false;window.__pirate50.frames=[];window.__pirate50.last=0;window.__pirate50.go=true;(function f(t){const q=window.__pirate50;if(!q.go)return;if(q.last&&q.frames.length<600)q.frames.push(t-q.last);q.last=t;requestAnimationFrame(f)})(performance.now())`)
    await call('Emulation.setCPUThrottlingRate', { rate: 6 }); const before = await read(); await sleep(5000); const after = await read()
    report.cpu6 = { before, after, frames: await ev(`(()=>{const q=window.__pirate50;q.go=false;const a=q.frames.slice(3).sort((x,y)=>x-y),sum=a.reduce((s,v)=>s+v,0);return{n:a.length,fps:a.length?1000*a.length/sum:null,p50:a[Math.floor(a.length*.5)],p95:a[Math.floor(a.length*.95)],worst:a.at(-1)}})()`), caveat: '최종 headless6x CPU 단일 절대 관측. 실제폰 FPS/동일조건 전후 개선률 아님. draw stack 관측은 이 구간 비활성.' }; await call('Emulation.setCPUThrottlingRate', { rate: 1 })
  }
  check(report.errors.length === 0, '전체 기능 JS오류0', report.errors); report.final = await read(); report.environment = 'Chrome headless native CDP touch, viewport DPR2.6. 실제 기기FPS 검증 아님.'
  writeFileSync(join(out, 'report.json'), JSON.stringify(report, null, 2)); console.log('보고', join(out, 'report.json'), '핀 실관측', report.pinActualObserved, '동일원본 실관측', report.sameImageActualObserved)
  if (report.checks.some((x: any) => !x.ok)) process.exitCode = 1
} finally {
  ws?.close(); chrome.kill(); await sleep(500)
  if (!safeProfile.startsWith(resolve(tmpdir()) + '\\pirate50-')) throw new Error('임시 프로필 삭제 경로 거절 ' + safeProfile)
  for (let n = 0; n < 12 && existsSync(safeProfile); n++) { try { rmSync(safeProfile, { recursive: true, force: true }) } catch { await sleep(300) } }
}
