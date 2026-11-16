/**
 * 열전 프레임 재기 (11-16 형: 「폰으로 하는데 프레임 20 밖에 안 나오는 것 같다 · 갤럭시 플립7 · 60 나와야」).
 * 헤드리스 크롬 · 폰 가로 · CPU 를 THROTTLE 배 느리게 · ?review 로 중반 5분 판을 만든 뒤 손가락 조이스틱으로 원을 그리며 SEC 초 동안
 * requestAnimationFrame 간격을 잰다. VARIANT 로 의심 가는 것을 하나씩 끈다(같은 판에서 견줌).
 *   node --experimental-strip-types tools/raid-fps-probe.ts [THROTTLE 4] [SEC 8] [VARIANT none|nofilter|novideo|noportrait|nohud] [UNTIL 300]
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const THROTTLE = Number(process.argv[2] ?? 4), SEC = Number(process.argv[3] ?? 8), VARIANT = process.argv[4] ?? 'none', UNTIL = process.argv[5] ?? '300'
const URL0 = `http://localhost:5174/raid.html?mode=stage&review&background${process.env["KIT"] ? "&kit=" + process.env["KIT"] : ""}`   // KIT=bow 처럼 묶음 고르기
const W = 844, H = 390, PORT = 9500 + Math.floor(Math.random() * 40)
const CHROMES = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe']
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))
const exe = CHROMES.find((p) => existsSync(p))!
const prof = mkdtempSync(join(tmpdir(), 'fps-'))
const chrome = spawn(exe, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${prof}`, `--window-size=${W},${H}`, '--no-first-run', '--mute-audio', '--enable-gpu-rasterization', 'about:blank'], { stdio: 'ignore' })
const INJECT: Record<string, string> = {
  none: '',
  nofilter: `Object.defineProperty(CanvasRenderingContext2D.prototype, 'filter', { set() {}, get() { return 'none' } })`,
  novideo: `HTMLMediaElement.prototype.play = function () { return Promise.resolve() }`,
  noportrait: `addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = '#hero-portrait,#hero-video,canvas:not(#field){display:none!important}'; document.head.append(s) })`,
  nohud: `addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = '#combat-hud,#hud,#score,.bar,#loadout,#combo-badges{display:none!important}'; document.head.append(s) })`,
}
try {
  let tabs: any = null
  for (let i = 0; i < 50 && tabs === null; i++) { try { tabs = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json() } catch { await sleep(200) } }
  const ws = new WebSocket(tabs.find((t: any) => t.type === 'page').webSocketDebuggerUrl)
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j })
  let id = 0
  const waits = new Map<number, (v: any) => void>()
  ws.onmessage = (ev) => { const m = JSON.parse(String(ev.data)); if (m.id !== undefined) { waits.get(m.id)?.(m.result ?? m.error); waits.delete(m.id) } }
  const call = (method: string, params: object = {}): Promise<any> => new Promise((r) => { const k = ++id; waits.set(k, r); ws.send(JSON.stringify({ id: k, method, params })) })
  const ev = async (expression: string): Promise<any> => (await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result?.value
  await call('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 2.6, mobile: true })
  await call('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 })
  await call('Emulation.setFocusEmulationEnabled', { enabled: true })
  await call('Page.enable')
  if (INJECT[VARIANT]) await call('Page.addScriptToEvaluateOnNewDocument', { source: INJECT[VARIANT] })
  await call('Page.navigate', { url: URL0 })
  for (let i = 0; i < 80 && !(await ev(`!!document.querySelector('button[data-until="${UNTIL}"]')`)); i++) await sleep(250)
  await ev(`document.querySelector('button[data-until="${UNTIL}"]').click()`)
  for (let i = 0; i < 240 && await ev(`document.getElementById('play').hidden`) !== false; i++) await sleep(250)
  await sleep(800)
  await ev(`document.getElementById('overlay').hidden || document.querySelector('#overlay .choices button')?.click()`)
  await call('Emulation.setCPUThrottlingRate', { rate: THROTTLE })
  const enemies = await ev(`document.getElementById('kills')?.textContent`)
  await ev(`window.__ft = []; (function f(t) { if (window.__ft.last) window.__ft.push(t - window.__ft.last); window.__ft.last = t; window.__ftId = requestAnimationFrame(f) })(performance.now())`)
  const box = await ev(`(() => { const b = document.getElementById('field').getBoundingClientRect(); return { x: b.left + b.width * .5, y: b.top + b.height * .55 } })()`)
  await call('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x, y: box.y }] })
  const PROF = process.env['PROFILE'] === '1'
  if (PROF) { await call('Profiler.enable'); await call('Profiler.setSamplingInterval', { interval: 200 }); await call('Profiler.start') }
  const t0 = Date.now()
  for (let a = 0; Date.now() - t0 < SEC * 1000; a += .25) {
    await call('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: box.x + Math.cos(a) * 50, y: box.y + Math.sin(a) * 50 }] })
    await ev(`document.getElementById('overlay').hidden || document.querySelector('#overlay .choices button')?.click()`)
    await sleep(60)
  }
  await call('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  if (PROF) {
    const { profile } = await call('Profiler.stop')
    const self = new Map<string, number>(), byId = new Map<number, any>(profile.nodes.map((n: any) => [n.id, n]))
    const dt = profile.timeDeltas as number[], samples = profile.samples as number[]
    samples.forEach((sid, i) => { const n = byId.get(sid); const f = n.callFrame; const k = `${f.functionName || '(anon)'} ${(f.url || '').split('/').pop()}:${f.lineNumber + 1}`; self.set(k, (self.get(k) ?? 0) + (dt[i] ?? 0)) })
    const tot = [...self.values()].reduce((a, b) => a + b, 0)
    console.log([...self].sort((a, b) => b[1] - a[1]).slice(0, 25).map(([k, v]) => `${(100 * v / tot).toFixed(1)}% ${k}`).join(String.fromCharCode(10)))
  }
  const r = await ev(`(() => { cancelAnimationFrame(window.__ftId); const a = window.__ft.slice(5).sort((x, y) => x - y); const n = a.length, avg = a.reduce((s, v) => s + v, 0) / n; return { frames: n, fps: +(1000 / avg).toFixed(1), p50: +a[Math.floor(n * .5)].toFixed(1), p95: +a[Math.floor(n * .95)].toFixed(1), worst: +a[n - 1].toFixed(1) } })()`)
  console.log(JSON.stringify({ variant: VARIANT, throttle: THROTTLE, until: UNTIL, kills: enemies, ...r }))
  ws.close()
} finally {
  chrome.kill(); await sleep(500)
  for (let i = 0; i < 12 && existsSync(prof); i++) { try { rmSync(prof, { recursive: true, force: true }) } catch { await sleep(400) } }
}
