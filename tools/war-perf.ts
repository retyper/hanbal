/**
 * 싸움 버벅임 재기 — 헤드리스 크롬을 폰 크기로 띄워 「연습 싸움」을 열고 장수에게 맡겨(자동) 풀리는 동안
 *   1) 틀 사이 간격(rAF) · 50ms 넘게 멈춘 틀 수
 *   2) 돌고 있는 애니메이션 수 · 그중 filter 가 걸린 요소 수 (폰 그래픽 한도 · 메모리 mobile-gpu-layer-limit)
 *   3) JS 프로파일 — 자기 시간이 긴 함수 열둘
 * 을 적는다 (형 11-03: "아직도 전투할 때 버벅거리고 대승·대패 나올 때 깜빡").
 *
 *   node --experimental-strip-types tools/war-perf.ts [너비 390] [높이 800] [주소 http://localhost:5174/realm.html?gfx=mid] [CPU 느리게 4]
 *
 * 런타임 의존성 없음 — tools/phone-shot.ts 와 같은 길(CDP · Node 내장 WebSocket).
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const W = Number(process.argv[2] ?? 390)
const H = Number(process.argv[3] ?? 800)
const URL0 = process.argv[4] ?? 'http://localhost:5174/realm.html?gfx=mid'
const SLOW = Number(process.argv[5] ?? 4)
const PORT = 9450 + Math.floor(Math.random() * 40)
const CHROMES = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe']
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

/** 페이지에서 돈다 — 싸움을 열고 맡긴 뒤 9초 동안 잰다 */
const RUN = `(async () => {
const w = (ms) => new Promise((r) => setTimeout(r, ms))
const until = async (f) => { for (let i = 0; i < 80; i++) { const v = f(); if (v) return v; await w(250) } throw new Error('timeout') }
const stat = () => {
  const an = document.getAnimations().filter((a) => a.playState === 'running')
  const els = new Set(an.map((a) => a.effect?.target).filter(Boolean))
  let filt = 0
  const fx = {}
  for (const e of els) { const f = getComputedStyle(e).filter; if (f !== 'none') { filt++; const k = (typeof e.className === 'string' ? e.className : e.tagName).split(' ')[0]; fx[k] = (fx[k] || 0) + 1 } }
  return { run: an.length, els: els.size, filt, filtBy: Object.entries(fx).sort((a, b) => b[1] - a[1]).slice(0, 8) }
}
;(await until(() => document.querySelector('[data-act=spar-open]'))).click()
await until(() => document.querySelector('.wopen')); await w(500); document.querySelector('.wopen')?.click(); await w(1500)
const before = stat()
;(await until(() => document.querySelector('[data-war=auto]'))).click(); await w(300); document.querySelector('[data-war=auto-yes]')?.click()
const dts = []; const long = []; let last = performance.now(); let peak = null; const t0 = last
await new Promise((res) => { const f = (t) => { const d = t - last; dts.push(d); if (d > 50) long.push([Math.round(t - t0), Math.round(d)]); last = t; if (peak === null && t - t0 > 2500) peak = stat(); if (t - t0 < 12000) requestAnimationFrame(f); else res() }; requestAnimationFrame(f) })
dts.sort((a, b) => a - b)
return JSON.stringify({ before, peak, frames: dts.length, p50: +dts[dts.length >> 1].toFixed(1), p95: +dts[Math.floor(dts.length * 0.95)].toFixed(1), over50: long.length, long: long.slice(0, 20), win: !!document.querySelector('.winfx') })
})()`

const exe = CHROMES.find((p) => existsSync(p))
if (exe === undefined) throw new Error('크롬을 못 찾았다')
const prof = mkdtempSync(join(tmpdir(), 'warperf-'))
const chrome = spawn(exe, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${prof}`, `--window-size=${W},${H}`, '--no-first-run', '--mute-audio', 'about:blank'], { stdio: 'ignore' })
try {
  let tabs: any = null
  for (let i = 0; i < 50 && tabs === null; i++) { try { tabs = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json() } catch { await sleep(200) } }
  const page = tabs.find((t: any) => t.type === 'page')
  const ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j })
  let id = 0
  const waits = new Map<number, (v: any) => void>()
  const trace: any[] = []
  let traced: (() => void) | null = null
  ws.onmessage = (ev) => {
    const m = JSON.parse(String(ev.data))
    if (m.method === 'Tracing.dataCollected') trace.push(...m.params.value)
    if (m.method === 'Tracing.tracingComplete') traced?.()
    if (m.id !== undefined) { waits.get(m.id)?.(m.result ?? m.error); waits.delete(m.id) }
  }
  const call = (method: string, params: object = {}): Promise<any> => new Promise((r) => { const k = ++id; waits.set(k, r); ws.send(JSON.stringify({ id: k, method, params })) })
  await call('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 2, mobile: true })
  await call('Emulation.setTouchEmulationEnabled', { enabled: true })
  await call('Page.enable')
  await call('Page.navigate', { url: URL0 })
  await sleep(4000)
  if (SLOW > 1) await call('Emulation.setCPUThrottlingRate', { rate: SLOW })
  await call('Profiler.enable')
  await call('Profiler.setSamplingInterval', { interval: 500 })
  await call('Profiler.start')
  await call('Tracing.start', { transferMode: 'ReportEvents', traceConfig: { includedCategories: ['devtools.timeline', 'blink', 'cc'] } })
  const r = await call('Runtime.evaluate', { expression: RUN, awaitPromise: true, returnByValue: true })
  const p = await call('Profiler.stop')
  const done = new Promise<void>((res) => { traced = res })
  await call('Tracing.end')
  await done
  // 틀을 오래 잡은 일 — 이름마다 합과 가장 긴 것 (Recalculate Style · Layout · Paint · Update Layer Tree …)
  const per = new Map<string, [number, number, number]>()
  for (const e of trace) {
    if (e.ph !== 'X' || typeof e.dur !== 'number' || e.tid === undefined) continue
    const k = e.name as string
    const v = per.get(k) ?? [0, 0, 0]
    v[0] += e.dur / 1000; v[1] = Math.max(v[1], e.dur / 1000); v[2]++
    per.set(k, v)
  }
  console.log([...per].filter(([k]) => !/^(RunTask|ThreadControllerImpl::RunTask|TaskQueueManager|MessageLoop|SequenceManager)/.test(k)).sort((a, b) => b[1][1] - a[1][1]).slice(0, 18).map(([k, v]) => `${v[1].toFixed(0).padStart(6)}ms 최장 · ${v[0].toFixed(0).padStart(6)}ms 합 · ${String(v[2]).padStart(5)}번  ${k}`).join('\n'))
  // 가장 긴 레이아웃·함수 셋 — 몇 칸을 다시 쟀나 · 어느 함수에서
  const longest = (name: string): any[] => trace.filter((e) => e.name === name && e.ph === 'X').sort((a, b) => b.dur - a.dur).slice(0, 3)
  for (const e of longest('Layout')) console.log('Layout', (e.dur / 1000).toFixed(0), JSON.stringify(e.args ?? {}).slice(0, 400))
  for (const e of longest('FunctionCall')) console.log('FunctionCall', (e.dur / 1000).toFixed(0), JSON.stringify(e.args?.data ?? {}).slice(0, 220))
  console.log(r.result?.value ?? JSON.stringify(r))
  // 자기 시간 — 표본 수로 센다
  const nodes = new Map<number, any>()
  for (const n of p.profile.nodes) nodes.set(n.id, n)
  const self = new Map<string, number>()
  const dt = p.profile.timeDeltas as number[]
  ;(p.profile.samples as number[]).forEach((s, i) => {
    const n = nodes.get(s)
    const f = n.callFrame
    const k = `${f.functionName || '(익명)'} ${String(f.url).replace(/^.*\/src\//, 'src/').replace(/\?.*$/, '')}:${f.lineNumber + 1}`
    self.set(k, (self.get(k) ?? 0) + (dt[i] ?? 0) / 1000)
  })
  console.log([...self].sort((a, b) => b[1] - a[1]).slice(0, 14).map(([k, v]) => `${v.toFixed(0).padStart(6)}ms  ${k}`).join('\n'))
  ws.close()
} finally {
  chrome.kill()
  await sleep(500)
  try { rmSync(prof, { recursive: true, force: true }) } catch { /* 크롬이 아직 잡고 있다 */ }
}
