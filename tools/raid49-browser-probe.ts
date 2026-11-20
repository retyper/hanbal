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
  const snap = async (label: string) => { const r = await call('Page.captureScreenshot', { format: 'png' }); const path = join(out, `${mode}-${label}.png`); writeFileSync(path, Buffer.from(r.data, 'base64')); report.shots.push(path) }
  const read = () => ev(`(() => { const r=window.__raid?.(); return {t:r?.t,state:r?.state,hp:r?.hp,x:r?.x,y:r?.y,kills:r?.kills,enemies:r?.enemies.length,boss:r?.enemies.find(e=>e.kind==='boss'),offers:r?.offers,overlay:!document.querySelector('#overlay')?.hidden,result:!!document.querySelector('#overlay:not([hidden]) .result'),feel:window.__raidFeel?.(),end:window.__raidEnd?.(),visibility:document.visibilityState} })()`)
  const canvasReport = () => ev(`(() => {const x=window.__raid49Draw;return x?{reads:x.reads,fx:x.fx,sources:x.sources,raw:x.raw,heroFrames:x.heroFrames,hitArt:x.hitArt,raysNextSprite:x.raysNextSprite,firstHit:x.firstHit}:null})()`)
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
    if (process.env['NO_END_SHOTS'] !== '1') await snap('ending-early')
    if (first.end?.kind==='defeat' && process.env['OBSERVE_CANVAS']==='1') { await waitFor('window.__raidEnd().elapsed >= 1.8',5000); await snap('ending-full-hit-body') }
    if (Number.isFinite(first.end?.stampAt)) {
      await waitFor(`window.__raidEnd().elapsed >= window.__raidEnd().stampAt + .12`, 5000)
      const announcement = await ev(`(() => {const e=document.querySelector('#announcement');return {text:e.textContent,visible:e.classList.contains('visible'),opacity:getComputedStyle(e).opacity}})()`)
      check(!announcement.visible && Number(announcement.opacity) === 0, '도장 시점에 기존 전투 알림 띠 숨김', announcement)
      if (process.env['NO_END_SHOTS'] !== '1') await snap('ending-stamp')
    }
    await waitFor(`!!document.querySelector('#overlay:not([hidden]) .result')`, 10000)
    const done = await read()
    check(done.end?.ready && done.end.elapsed === done.end.duration, '끝 연출 시계가 정해진 길이까지 돈 뒤 결과 표시', done.end)
  }
  await call('Page.enable'); await call('Runtime.enable'); await call('Log.enable')
  if (process.env['OBSERVE_CANVAS'] === '1') await call('Page.addScriptToEvaluateOnNewDocument', { source: String.raw`(() => {
    const labels=new WeakMap(), anonymous=new WeakMap();let serial=0;const state=window.__raid49Draw={reads:0,fx:{},sources:{},raw:{},heroFrames:{},hitArt:{},raysPending:false,raysNextSprite:{count:0},firstHit:null,startReads:0,lastHp:null};
    const proto=CanvasRenderingContext2D.prototype, draw=proto.drawImage, read=proto.getImageData;
    proto.getImageData=function(...args){state.reads++;return read.apply(this,args)};
    proto.drawImage=function(source,...args){const result=draw.call(this,source,...args);let key=typeof source?.src==='string'?new URL(source.src,location.href).pathname:labels.get(source);
      if(typeof source?.src==='string' && /raid\/fx\//.test(key))state.sources[key]={complete:source.complete,naturalWidth:source.naturalWidth,naturalHeight:source.naturalHeight};
      if(key && this.canvas.id!=='field' && /raid\/fx\/|anim-px\//.test(key))labels.set(this.canvas,key);
      if(!key&&source instanceof ImageBitmap){if(!anonymous.has(source))anonymous.set(source,'bitmap:'+(++serial)+':'+source.width+'x'+source.height);key=anonymous.get(source);}
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
  const q = new URLSearchParams({ kit: process.env['KIT'] ?? 'bow', sprite: 'base-w-102-garak-dana', hero: 'w-102-garak-dana', name: '다나', bust: 'w-102-garak-dana' })
  if (mode === 'review') { q.set('review', ''); q.set('stage', process.env['STAGE'] ?? 'forest') }
  report.url = `${origin}/raid.html?${q}`
  await call('Page.navigate', { url: report.url })
  await waitFor(`document.querySelector('#start')?.disabled === false`, 45000)
  check(report.errors.length === 0, '첫 로드 console/exception 오류 0', report.errors)
  check((await read()).visibility === 'visible', '탭 visible')
  if (process.env['OBSERVE_CANVAS'] === '1') { report.canvasBoot = await canvasReport(); report.fxBoot=report.canvasBoot?.sources; check(Object.keys(report.fxBoot??{}).length===10&&Object.values(report.fxBoot??{}).every((x:any)=>x.complete&&x.naturalWidth>0),'실제 warmFx 공유 이미지 10개 로드·native 크기 양수',report.fxBoot) }
  if (mode === 'fight') {
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
      report.actualInputEnd = await read(); if (process.env['NO_END_SHOTS'] !== '1') await snap('terminal-first')
      check(report.actualInputEnd.state !== 'playing', '실제 키 입력으로 종결 상태 도달', report.actualInputEnd)
      report.timeline = await ev('window.__raid49timeline')
    }
    if ((await read()).state !== 'playing') {
      await exerciseEnding()
      await waitFor(`!!document.querySelector('#overlay:not([hidden]) .result')`, 10000)
      if (await ev('!!window.__raid49timeline')) report.timeline = await ev('window.__raid49timeline')
      const terminal = report.timeline?.find((x: any) => x.state !== 'playing'), result = report.timeline?.find((x: any) => x.result)
      if (terminal && result) { report.resultDelayMs = result.at - terminal.at; if (report.action === 'complete') check(Math.abs(report.resultDelayMs - terminal.end.duration * 1000) <= 100, '승패 종결 뒤 결과 창까지 정해진 연출 길이 실측', report.resultDelayMs) }
      for (const [w,h] of [[360,800],[375,812],[390,844],[412,915],[844,390]]) {
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
    if(mode==='review'&&report.final.end?.kind){
      const won=report.final.end.kind==='victory',stem=won?'stamp_victory':'stamp_defeat'
      check((report.fxFinal?.['/realm/raid/fx/'+stem+'.png']?.count??0)>0&&(report.fxFinal?.['/realm/raid/fx/'+stem+'_band.png']?.count??0)>0,'native 도장 PNG와 별도 띠 PNG가 실제 field에 그려짐',report.fxFinal)
      if(won)check(report.canvasFinal.raysNextSprite?.count>0,'native rays 다음에 sprite crop이 그려짐 (원본 식별은 소스 순서와 대조)',report.canvasFinal.raysNextSprite)
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
