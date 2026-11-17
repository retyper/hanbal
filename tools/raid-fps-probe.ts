/**
 * 열전 프레임 재기 (11-16 형: 「폰으로 하는데 프레임 20 밖에 안 나오는 것 같다 · 갤럭시 플립7 · 60 나와야」).
 * 헤드리스 크롬 · 폰 가로 · CPU 를 THROTTLE 배 느리게 · ?review 로 중반 5분 판을 만든 뒤 손가락 조이스틱으로 원을 그리며 SEC 초 동안
 * requestAnimationFrame 간격을 잰다. VARIANT 로 의심 가는 것을 하나씩 끈다(같은 판에서 견줌).
 *   node --experimental-strip-types tools/raid-fps-probe.ts [THROTTLE 4] [SEC 8] [VARIANT none|nofilter|novideo|noportrait|nohud|awake] [UNTIL 300]
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const THROTTLE = Number(process.argv[2] ?? 4), SEC = Number(process.argv[3] ?? 8), VARIANT = process.argv[4] ?? 'none', UNTIL = process.argv[5] ?? '300'
const URL0 = `http://localhost:5174/raid.html?mode=stage&review&background${process.env["KIT"] ? "&kit=" + process.env["KIT"] : ""}${process.env['EXTRA'] ?? ''}`   // KIT=bow 처럼 묶음 고르기 · EXTRA='&bust=…&sprite=…' 장수
/**
 * SCENE=trial (11-18 형 플립7 「4:46 힘의 결합 늑대 떼」 · 「3:35 폭풍의 진격 초당 3프레임」): 각성 시련 판을 활 묶음으로 UNTIL 초까지 돌린다
 * (고르기: 만 갈래 화살 · 유성 화살비 · 화살비 · 속사 · 사거리 먼저 · 돌리는 동안 죽지 않게) → 열린 판에 덮어씌운다.
 * KEEP=1: 재는 동안 체력을 채우고 영웅의 투지 보호막을 켜 둔다 · TWEAK='{"drawNumbers":0}': HAEBI_RUN 값을 그 자리에서 바꿔 견준다.
 */
const SCENE = process.env['SCENE'] ?? '', KEEP = !!process.env['KEEP'], TWEAK = process.env['TWEAK'] ?? ''
const BUILD = `(async () => {
  const H = await import('/src/raid/haebi.ts'), R = await import('/src/raid/haebi-replay.ts')
  const s = H.createHaebi(7, '${SCENE}', 'bow'), want = { rain: 3, reach: 2, bow: 5, tempo: 3, echo: 2 }, pick = () => s.offers.find(p => p === 'volley' || p === 'meteor') ?? Object.keys(want).find(p => s.offers.includes(p) && s.ranks[p] < want[p]) ?? s.offers[0]
  for (let n = 0; s.t < ${Number(UNTIL)} && s.state === 'playing'; n++) {
    if (s.offers.length) H.choose(s, pick()); else { H.stepHaebi(s, R.botInput(s), 1 / 120); s.hp = s.maxHp }
    if (n % 2400 === 0) await new Promise(r => setTimeout(r, 0))
  }
  Object.assign(window.__raid(), s)
  return { t: Math.round(s.t), kills: s.kills, level: s.level, combos: s.combos.map(c => c + (s.comboRanks[c] ?? 1)).join(','), ranks: Object.entries(s.ranks).filter(e => e[1]).map(e => e.join(':')).join(' ') }
})()`
const KEEPER = `(async () => { const H = await import('/src/raid/haebi.ts'); setInterval(() => { const r = window.__raid?.(); if (!r || r.state !== 'playing') return; r.hp = Math.max(r.hp, r.maxHp * .5); if (${process.env['KEEP'] === 'hp'}) return; if (r.form !== 'grit') { r.form = 'grit'; r.formT = 60 } r.formT = 60; r.ward = Math.max(r.ward, H.wardMax(r) * .6) }, 250) })()`
const W = 844, H = 390, PORT = 9500 + Math.floor(Math.random() * 40)
const CHROMES = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe']
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))
const exe = CHROMES.find((p) => existsSync(p))!
const prof = mkdtempSync(join(tmpdir(), 'fps-'))
const chrome = spawn(exe, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${prof}`, `--window-size=${W},${H}`, '--no-first-run', '--mute-audio', '--enable-gpu-rasterization', ...(process.env['CHROME_ARGS'] ?? '').split(' ').filter(Boolean), 'about:blank'], { stdio: 'ignore' })
const INJECT: Record<string, string> = {
  none: '',
  nofilter: `Object.defineProperty(CanvasRenderingContext2D.prototype, 'filter', { set() {}, get() { return 'none' } })`,
  novideo: `HTMLMediaElement.prototype.play = function () { return Promise.resolve() }`,
  noportrait: `addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = '#hero-portrait,#hero-video,canvas:not(#field){display:none!important}'; document.head.append(s) })`,
  // 각성 오라·금빛 체력·진 비기를 켜 둔 판 (11-17 · 개발 손잡이 __raid 로 모습만 각성으로 붙잡아 둔다)
  awake: `setInterval(() => { const r = window.__raid?.(); if (r && r.state === 'playing') { r.form = 'awake'; r.formT = 60 } }, 300)`,
  // 맞은 초상(ui/hit-portrait.ts)의 겉막 끼우기·흔들림을 막는다 (11-18)
  nohitp: `{ const ins = Element.prototype.insertAdjacentHTML; Element.prototype.insertAdjacentHTML = function (w, h) { if (String(h).includes('class="hitp"')) return; return ins.call(this, w, h) } }`,
  // 늑대 그림만 바꿔 끼운다 (11-18 형: 늑대 떼 때 느려짐) — dogclub: 몽둥이 산적 그림(좁은 시트) · nodog: 1×1 빈 그림(안 그림)
  dogclub: `{ const d = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src'); Object.defineProperty(HTMLImageElement.prototype, 'src', { get() { return d.get.call(this) }, set(v) { d.set.call(this, String(v).replace('bandit-dog.png', 'bandit-club.png')) } }) }`,
  nodog: `{ const d = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src'); Object.defineProperty(HTMLImageElement.prototype, 'src', { get() { return d.get.call(this) }, set(v) { d.set.call(this, String(v).includes('bandit-dog.png') ? 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==' : v) } }) }`,
  nocanvas: `addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = '#field{visibility:hidden!important}'; document.head.append(s) })`,
  // 판 그리기 셈: 그림마다 drawImage 수 · 칠한 넓이(판 화소) · 그 밖의 칠하기 수 — 폰 GPU 가 칠하는 양을 가늠 (11-18)
  count: `{ window.__dc = new Map(); const P = CanvasRenderingContext2D.prototype, di = P.drawImage; const add = (k, a) => { const v = window.__dc.get(k) ?? [0, 0]; v[0]++; v[1] += a; window.__dc.set(k, v) }
    P.drawImage = function (img, ...a) { if (this.canvas.id === 'field') { const w = a.length >= 8 ? a[6] : a.length >= 4 ? a[2] : img.width, h = a.length >= 8 ? a[7] : a.length >= 4 ? a[3] : img.height; const t = this.getTransform(); add((img.src ?? 'canvas').split('/').pop() + (this.globalCompositeOperation === 'lighter' ? '+' : ''), Math.abs(w * h * t.a * t.d)) } return di.call(this, img, ...a) }
    for (const m of ['fill', 'stroke', 'fillRect', 'strokeRect', 'fillText', 'strokeText', 'save']) { const o = P[m]; P[m] = function (...a) { if (this.canvas.id === 'field') add(m, 0); return o.apply(this, a) } } }`,
  nohudfilter: `addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = '#combat-hud{filter:none!important}'; document.head.append(s) })`,
  nohud: `addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = '#combat-hud,#hud,#score,.bar,#loadout,#combo-badges{display:none!important}'; document.head.append(s) })`,
}
try {
  let tabs: any = null
  for (let i = 0; i < 50 && tabs === null; i++) { try { tabs = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json() } catch { await sleep(200) } }
  const ws = new WebSocket(tabs.find((t: any) => t.type === 'page').webSocketDebuggerUrl)
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j })
  let id = 0
  const waits = new Map<number, (v: any) => void>()
  const traceEvents: any[] = []; let traceDone: (() => void) | null = null
  ws.onmessage = (ev) => { const m = JSON.parse(String(ev.data)); if (m.id !== undefined) { waits.get(m.id)?.(m.result ?? m.error); waits.delete(m.id) } else if (m.method === 'Tracing.dataCollected') traceEvents.push(...m.params.value); else if (m.method === 'Tracing.tracingComplete') traceDone?.() }
  const call = (method: string, params: object = {}): Promise<any> => new Promise((r) => { const k = ++id; waits.set(k, r); ws.send(JSON.stringify({ id: k, method, params })) })
  const ev = async (expression: string): Promise<any> => (await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result?.value
  await call('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 2.6, mobile: true })
  await call('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 })
  await call('Emulation.setFocusEmulationEnabled', { enabled: true })
  await call('Page.enable')
  if (INJECT[VARIANT]) await call('Page.addScriptToEvaluateOnNewDocument', { source: INJECT[VARIANT] })
  await call('Page.navigate', { url: URL0 })
  const btn = SCENE ? '0' : UNTIL
  for (let i = 0; i < 80 && !(await ev(`!!document.querySelector('button[data-until="${btn}"]')`)); i++) await sleep(250)
  await ev(`document.querySelector('button[data-until="${btn}"]').click()`)
  for (let i = 0; i < 240 && await ev(`document.getElementById('play').hidden`) !== false; i++) await sleep(250)
  if (SCENE) console.log(JSON.stringify(await ev(BUILD)))
  // BENCH=N: 같은 판을 N 프레임 더 돌리며 판 그리기(drawField + 칠하기 마무리)만 따로 잰다 — rAF·다른 node 에 덜 흔들리는 견줌 (11-18)
  if (SCENE && process.env['BENCH']) {
    await ev(BUILD.replace('Object.assign(window.__raid(), s)', 'window.__bs = s; window.__bpick = pick; window.__H = H; window.__R = R'))
    await ev(`(async () => { const V = await import('/src/raid/haebi-view.ts'); window.__V = V
      const imgs = new Map(await Promise.all(V.imagePaths.concat(V.heroArtFiles()).map(p => new Promise(r => { const i = new Image(); i.onload = () => r([p, i]); i.onerror = () => r([p, null]); i.src = '/realm/' + p }))))
      for (const [k, v] of [...imgs]) if (!v) imgs.delete(k)
      const cv = document.createElement('canvas'); cv.width = 1120; cv.height = 720; window.__bg = cv.getContext('2d', { alpha: false, willReadFrequently: ${process.env['BENCHGPU'] !== '1'} }); window.__bi = imgs
      for (let i = 0; i < 6; i++) { V.drawField(window.__bg, imgs, window.__bs, null); window.__bg.getImageData(0, 0, 1, 1) }
      await new Promise(r => setTimeout(r, 500)) })()`)
    await call('Emulation.setCPUThrottlingRate', { rate: THROTTLE })
    console.log('bench ' + JSON.stringify(await ev(`(() => { const s = window.__bs, H = window.__H, R = window.__R, V = window.__V, g = window.__bg, imgs = window.__bi; let sim = 0, draw = 0, raster = 0, n = ${Number(process.env['BENCH'])}
      for (let i = 0; i < n; i++) {
        const a = performance.now(); for (let k = 0; k < 2; k++) { if (s.offers.length) H.choose(s, window.__bpick()); else H.stepHaebi(s, R.botInput(s), 1 / 120); s.hp = s.maxHp }
        const b = performance.now(); V.drawField(g, imgs, s, null); const c = performance.now(); if (${process.env['BENCHGPU'] !== '1'}) g.getImageData(0, 0, 1, 1); const d = performance.now()
        sim += b - a; draw += c - b; raster += d - c
      }
      const z = performance.now(); g.getImageData(0, 0, 1, 1); raster += performance.now() - z
      return { simMs: +(sim / n).toFixed(2), drawMs: +(draw / n).toFixed(2), rasterMs: +(raster / n).toFixed(2), frameMs: +((draw + raster) / n).toFixed(2), enemies: s.enemies.length, dogs: s.enemies.filter(e => e.kind === 'dog').length, nums: s.fx.filter(f => f.n !== undefined).length }
    })()`)))
    await call('Emulation.setCPUThrottlingRate', { rate: 1 })
  }
  if (TWEAK) await ev(`import('/src/tune/params.ts').then(m => Object.assign(m.HAEBI_RUN, ${TWEAK}))`)
  if (KEEP) await ev(KEEPER)
  // SOUND=1: 소리를 연다(검수 재생은 출전 단추를 안 눌러 소리가 꺼져 있다) · 재는 동안 새로 튼 소리 수·동시에 울리는 수를 센다 (11-18)
  const SOUND = process.env['SOUND'] === '1'
  if (SOUND) await ev(`(() => { window.__snd = { started: 0, live: 0, peak: 0 }; const st = AudioBufferSourceNode.prototype.start; AudioBufferSourceNode.prototype.start = function (...a) { const w = window.__snd; w.started++; w.live++; w.peak = Math.max(w.peak, w.live); this.addEventListener('ended', () => w.live--); return st.apply(this, a) }; window.__raidSound.unlock() })()`)
  await sleep(800)
  await ev(`document.getElementById('overlay').hidden || document.querySelector('#overlay .choices button')?.click()`)
  await call('Emulation.setCPUThrottlingRate', { rate: THROTTLE })
  const enemies = await ev(`document.getElementById('kills')?.textContent`)
  await ev(`window.__ft = []; (function f(t) { if (window.__ft.last) window.__ft.push(t - window.__ft.last); window.__ft.last = t; window.__ftId = requestAnimationFrame(f) })(performance.now())`)
  const box = await ev(`(() => { const b = document.getElementById('field').getBoundingClientRect(); return { x: b.left + b.width * .5, y: b.top + b.height * .55 } })()`)
  await call('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x, y: box.y }] })
  const PROF = process.env['PROFILE'] === '1'
  // TRACE=1: 렌더러 주 스레드가 무엇에 시간을 쓰는가 (스크립트 · 스타일 · 레이아웃 · 페인트 · 캔버스) — 초당 ms 로
  const TRACE = process.env['TRACE'] === '1', MUT = process.env['MUT'] === '1'
  // MUT=1: 재는 동안 DOM 이 몇 번 바뀌는가 (바뀐 칸 id 별 · 초당) — 매 프레임 쓰는 HUD 를 찾는다
  if (MUT) await ev(`window.__mut = new Map(); new MutationObserver(l => { for (const m of l) { let n = m.target; while (n && !n.id) n = n.parentNode; const k = (n?.id ?? '?') + ':' + m.type + (m.attributeName ? '.' + m.attributeName : ''); window.__mut.set(k, (window.__mut.get(k) ?? 0) + 1) } }).observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true })`)
  if (TRACE) await call('Tracing.start', { categories: 'devtools.timeline,disabled-by-default-devtools.timeline,blink,cc,gpu', transferMode: 'ReportEvents' })
  if (PROF) { await call('Profiler.enable'); await call('Profiler.setSamplingInterval', { interval: 200 }); await call('Profiler.start') }
  const t0 = Date.now()
  for (let a = 0; Date.now() - t0 < SEC * 1000; a += .25) {
    await call('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: box.x + Math.cos(a) * 50, y: box.y + Math.sin(a) * 50 }] })
    await ev(`document.getElementById('overlay').hidden || document.querySelector('#overlay .choices button')?.click()`)
    await sleep(60)
  }
  await call('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  if (VARIANT === 'count') console.log('per frame: ' + (await ev(`(() => { const n = window.__ft.length; return [...window.__dc].sort((a, b) => b[1][1] - a[1][1] || b[1][0] - a[1][0]).slice(0, 24).map(([k, [c, a]]) => k + ' ' + (c / n).toFixed(1) + (a ? '×' + Math.round(a / c) + 'px²=' + (a / n / 1120 / 720).toFixed(2) + '판' : '')).join(' · ') })()`)))
  if (SOUND) console.log('sound: ' + JSON.stringify(await ev(`({ perSec: +(window.__snd.started / ${SEC}).toFixed(1), peakLive: window.__snd.peak, state: window.__raidSound && 'on' })`)))
  if (MUT) console.log('dom/s: ' + (await ev(`[...window.__mut].sort((a, b) => b[1] - a[1]).slice(0, 16).map(([k, v]) => k + ' ' + (v / ${SEC}).toFixed(1)).join(' · ')`)))
  if (TRACE) {
    await new Promise<void>((r) => { traceDone = r; void call('Tracing.end') })
    const names = new Map<string, string>(), main = new Set<string>()
    for (const e of traceEvents) if (e.ph === 'M' && e.name === 'thread_name') { names.set(e.pid + ':' + e.tid, e.args.name); if (e.args.name === 'CrRendererMain') main.add(e.pid + ':' + e.tid) }
    const sum = new Map<string, number>()
    for (const e of traceEvents) if (e.ph === 'X' && e.dur && main.has(e.pid + ':' + e.tid)) sum.set(e.name, (sum.get(e.name) ?? 0) + e.dur / 1000)
    const top = [...sum].filter(([k]) => /^(FunctionCall|EvaluateScript|FireAnimationFrame|UpdateLayoutTree|Layout|Paint|PrePaint|Layerize|UpdateLayer|CompositeLayers|Commit|RasterTask|ParseHTML|HitTest|ScheduleStyleRecalculation|MajorGC|MinorGC|V8.GC.*|ThreadControllerImpl::RunTask|Canvas.*|.*Canvas.*)$/.test(k))
    console.log(top.sort((a, b) => b[1] - a[1]).slice(0, 18).map(([k, v]) => `${(v / SEC).toFixed(1)}ms/s ${k}`).join(String.fromCharCode(10)))
  }
  if (PROF) {
    const { profile } = await call('Profiler.stop')
    const self = new Map<string, number>(), byId = new Map<number, any>(profile.nodes.map((n: any) => [n.id, n]))
    const dt = profile.timeDeltas as number[], samples = profile.samples as number[]
    samples.forEach((sid, i) => { const n = byId.get(sid); const f = n.callFrame; const k = `${f.functionName || '(anon)'} ${(f.url || '').split('/').pop()}:${f.lineNumber + 1}`; self.set(k, (self.get(k) ?? 0) + (dt[i] ?? 0)) })
    const tot = [...self.values()].reduce((a, b) => a + b, 0)
    console.log([...self].sort((a, b) => b[1] - a[1]).slice(0, 25).map(([k, v]) => `${(100 * v / tot).toFixed(1)}% ${k}`).join(String.fromCharCode(10)))
    // 안에서 부른 것까지 더한 몫 (함수 이름별 · 같은 이름이 겹쳐 불리면 바깥 것만)
    const parent = new Map<number, number>(); for (const n of profile.nodes) for (const c of n.children ?? []) parent.set(c, n.id)
    const incl = new Map<string, number>()
    samples.forEach((sid, i) => { const seen = new Set<string>(); for (let id: number | undefined = sid; id !== undefined; id = parent.get(id)) { const nm = byId.get(id).callFrame.functionName; if (nm && !seen.has(nm)) { seen.add(nm); incl.set(nm, (incl.get(nm) ?? 0) + (dt[i] ?? 0)) } } })
    console.log('inclusive: ' + [...incl].filter(([k]) => /^(frame|stepHaebi|drawField|updateHud|watchHit|hitPortrait|drawNumbers|trackNumbers|drawWard|drawAura|sprite|stamp|decal|digits|showOverlay|updatePortrait|effectStrip|impact|blast|hit|nearest|offer|updateChunk)$/.test(k)).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${(100 * v / tot).toFixed(1)}%`).join(' · '))
  }
  const r = await ev(`(() => { cancelAnimationFrame(window.__ftId); const a = window.__ft.slice(5).sort((x, y) => x - y); const n = a.length, avg = a.reduce((s, v) => s + v, 0) / n; return { frames: n, fps: +(1000 / avg).toFixed(1), p50: +a[Math.floor(n * .5)].toFixed(1), p95: +a[Math.floor(n * .95)].toFixed(1), worst: +a[n - 1].toFixed(1) } })()`)
  const live = await ev(`(() => { const r = window.__raid(); return { t: Math.round(r.t), state: r.state, enemies: r.enemies.length, shots: r.shots.length, fx: r.fx.length, nums: r.fx.filter(f => f.n !== undefined).length, drops: r.drops.length } })()`)
  if (process.env['SHOT']) { const { data } = await call('Page.captureScreenshot', { format: 'png' }); (await import('node:fs')).writeFileSync(process.env['SHOT'], Buffer.from(data, 'base64')) }
  console.log(JSON.stringify({ variant: VARIANT, throttle: THROTTLE, until: UNTIL, scene: SCENE, tweak: TWEAK, kills: enemies, ...r, live }))
  ws.close()
} finally {
  chrome.kill(); await sleep(500)
  for (let i = 0; i < 12 && existsSync(prof); i++) { try { rmSync(prof, { recursive: true, force: true }) } catch { await sleep(400) } }
}
