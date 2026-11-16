/**
 * 바다 도적 막기 시험 (11-16 형: 「엄청 버벅 · 흐림 · 당겨 쐈는데 안 쏴짐 · 화살이 공중에 멈춤 · 화살이 미사일만 함」).
 * 헤드리스 크롬 · 폰 가로 · CPU THROTTLE 배 · 판을 열고 「막는다」 → SEC 초 동안 프레임·DPR 을 재고, 손가락으로 당겨 쏘기를 SHOTS 번 해서
 * 쏜 수(run.shots)가 오르는지 · 날던 화살이 멈춰 떠 있는지(살아 있는데 0.5초 동안 안 움직임) 본다. PROFILE=1 이면 뜨거운 함수.
 *   node --experimental-strip-types tools/pirate-probe.ts [THROTTLE 4] [SEC 6] [SHOTS 4] [png]
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const THROTTLE = Number(process.argv[2] ?? 4), SEC = Number(process.argv[3] ?? 6), SHOTS = Number(process.argv[4] ?? 4), PNG = process.argv[5]
/** 다른 판(예: 고치기 전 빌드를 다른 포트에 띄워 둔 것)과 견줄 때 — PIRATE_URL=http://localhost:5176/pirate.html */
const URL0 = process.env['PIRATE_URL'] ?? 'http://localhost:5174/pirate.html'
const W = 844, H = 390, PORT = 9600 + Math.floor(Math.random() * 40)
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))
const exe = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p))!
const prof = mkdtempSync(join(tmpdir(), 'pir-'))
const chrome = spawn(exe, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${prof}`, `--window-size=${W},${H}`, '--no-first-run', '--mute-audio', 'about:blank'], { stdio: 'ignore' })
try {
  let tabs: any = null
  for (let i = 0; i < 50 && tabs === null; i++) { try { tabs = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json() } catch { await sleep(200) } }
  const ws = new WebSocket(tabs.find((t: any) => t.type === 'page').webSocketDebuggerUrl)
  await new Promise((r) => { ws.onopen = r })
  let id = 0
  const waits = new Map<number, (v: any) => void>()
  ws.onmessage = (ev) => { const m = JSON.parse(String(ev.data)); if (m.id !== undefined) { waits.get(m.id)?.(m.result ?? m.error); waits.delete(m.id) } }
  const call = (method: string, params: object = {}): Promise<any> => new Promise((r) => { const k = ++id; waits.set(k, r); ws.send(JSON.stringify({ id: k, method, params })) })
  const ev = async (e: string): Promise<any> => (await call('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.value
  await call('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 2.6, mobile: true })
  await call('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 })
  await call('Emulation.setFocusEmulationEnabled', { enabled: true })
  await call('Page.enable')
  await call('Page.navigate', { url: URL0 })
  for (let i = 0; i < 80 && !(await ev(`!!document.querySelector('[data-act="go"]')`)); i++) await sleep(250)
  await ev(`document.querySelector('[data-act="go"]').click()`)
  await sleep(1500)
  await call('Emulation.setCPUThrottlingRate', { rate: THROTTLE })
  const dpr = `(() => { const c = document.getElementById('night'); return +(c.width / c.clientWidth).toFixed(2) })()`
  console.log('DPR 처음', await ev(dpr))
  await ev('(() => { const p = window.__pirate.perf; if (p) { p.frames = 0; p.workMs = 0; p.worstMs = 0 } })()')
  await ev(`window.__ft = []; (function f(t) { if (window.__ft.last) window.__ft.push(t - window.__ft.last); window.__ft.last = t; window.__ftId = requestAnimationFrame(f) })(performance.now())`)
  const PROF = process.env['PROFILE'] === '1'
  if (PROF) { await call('Profiler.enable'); await call('Profiler.setSamplingInterval', { interval: 200 }); await call('Profiler.start') }
  await sleep(SEC * 1000)
  if (PROF) {
    const { profile } = await call('Profiler.stop')
    const self = new Map<string, number>(), byId = new Map<number, any>(profile.nodes.map((n: any) => [n.id, n]))
    ;(profile.samples as number[]).forEach((sid, i) => { const f = byId.get(sid).callFrame; const k = `${f.functionName || '(anon)'} ${(f.url || '').split('/').pop()?.split('?')[0]}:${f.lineNumber + 1}`; self.set(k, (self.get(k) ?? 0) + (profile.timeDeltas[i] ?? 0)) })
    const tot = [...self.values()].reduce((a, b) => a + b, 0)
    const idle = [...self].filter(([k]) => k.startsWith('(idle)')).reduce((a, [, v]) => a + v, 0)
    console.log(`바쁨 ${(100 * (tot - idle) / tot).toFixed(1)}% (메인 스레드 · 쉬지 않은 몫)`)
    console.log([...self].sort((a, b) => b[1] - a[1]).slice(0, 22).map(([k, v]) => `${(100 * v / tot).toFixed(1)}% ${k}`).join(String.fromCharCode(10)))
  }
  const fr = await ev(`(() => { cancelAnimationFrame(window.__ftId); const a = window.__ft.slice(3).sort((x, y) => x - y); const n = a.length; return { frames: n, fps: +(1000 * n / a.reduce((s, v) => s + v, 0)).toFixed(1), p50: +a[n >> 1].toFixed(1), p95: +a[Math.floor(n * .95)].toFixed(1), worst: +a[n - 1].toFixed(1) } })()`)
  console.log('프레임', JSON.stringify(fr), 'DPR 지금', await ev(dpr))
  // 판이 프레임마다 쓴 시간 (개발 빌드 · pirate-main perf) — 없으면 옛 빌드
  console.log('판 일', await ev(`(() => { const p = window.__pirate.perf; return p ? { frames: p.frames, avgMs: +(p.workMs / p.frames).toFixed(2), worstMs: +p.worstMs.toFixed(1) } : null })()`))
  // 당겨 쏘기 — 화면 가운데를 누르고 왼쪽 아래로 끌었다가(조준) 뗀다
  const cx = W * 0.55, cy = H * 0.55
  for (let s = 0; s < SHOTS; s++) {
    const before = await ev('window.__pirate.run.shots')
    await call('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: cx, y: cy }] })
    for (let i = 1; i <= 12; i++) { await call('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: cx - i * 10, y: cy + i * 3 }] }); await sleep(70) }
    await sleep(300)
    await call('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await sleep(120)
    const after = await ev('window.__pirate.run.shots')
    // 날던 화살이 멈췄나: 살아 있는 화살 자리를 0.5초 간격으로 두 번
    const pos = `JSON.stringify((window.__pirate.run.world ?? window.__pirate.run.w)?.arrows?.filter(a => a.alive).map(a => [+a.x.toFixed(2), +a.y.toFixed(2), +a.vx.toFixed(1), +a.vy.toFixed(1)]) ?? null)`
    const p1 = await ev(pos); await sleep(500); const p2 = await ev(pos)
    console.log(`쏘기 ${s + 1}: shots ${before} → ${after}`, '판', await ev('window.__pirate.run.phase + " 목책 " + window.__pirate.run.lives'), '화살', p1, '→', p2)
  }
  if (PNG) { const shot = await call('Page.captureScreenshot', { format: 'png' }); writeFileSync(PNG, Buffer.from(shot.data, 'base64')) }
  ws.close()
} finally {
  chrome.kill(); await sleep(500)
  for (let i = 0; i < 12 && existsSync(prof); i++) { try { rmSync(prof, { recursive: true, force: true }) } catch { await sleep(400) } }
}
