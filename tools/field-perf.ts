/**
 * 폰 프레임 재기 틀 (battle-study P3) — 헤드리스 크롬을 폰 크기로 띄워 주소를 열고, 정해진 초 동안 틀 사이 간격(rAF)을 잰다.
 * 새 전투 화면(field.html · F3b)이 생기면 같은 명령으로 잰다. 지금은 realm.html 첫 화면 · raid.html 이 기준선이다.
 *
 *   node --experimental-strip-types tools/field-perf.ts <주소> [초 8] [CPU 느리게 4] [너비 390] [높이 800] [--act 누를 CSS 선택자]
 *
 * 찍는 것: 틀 수 · 간격 p50·p95·p99 · 최장 · 50ms 넘는 틀 수 · 평균 fps · 돌고 있는 애니메이션 수 · filter 걸린 요소 수.
 * 크롬이 헤드리스이고 CPU 배율만 흉내 낸 것이라 실제 폰의 절대값이 아니다 — 같은 도구로 앞뒤를 견주는 용이다.
 * war-perf.ts 의 CDP 연결 부분을 떼어 왔다(런타임 의존 없음 · Node 내장 WebSocket). 원본은 안 고쳤다.
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const args = process.argv.slice(2)
const ai = args.indexOf('--act')
const ACT = ai >= 0 ? args[ai + 1] : undefined
const pos = args.filter((a, i) => !a.startsWith('--') && !(ai >= 0 && i === ai + 1))
const URL0 = pos[0]
if (URL0 === undefined) { console.log('쓰는 법: field-perf.ts <주소> [초 8] [CPU 4] [너비 390] [높이 800] [--act 선택자]'); process.exit(1) }
const SECS = Number(pos[1] ?? 8)
const SLOW = Number(pos[2] ?? 4)
const W = Number(pos[3] ?? 390)
const H = Number(pos[4] ?? 800)
const PORT = 9500 + Math.floor(Math.random() * 40)
const CHROMES = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe']
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))
// C 드라이브가 좁아 임시 프로필은 저장소 안 tools/out/ (D:) 에 둔다
const OUT = join(dirname(fileURLToPath(import.meta.url)), 'out', 'field-perf')

/** 페이지에서 도는 것 — 간격을 모은다 */
const RUN = (secs: number, act: string | undefined): string => `(async () => {
const w = (ms) => new Promise((r) => setTimeout(r, ms))
${act !== undefined ? `{ const e = document.querySelector(${JSON.stringify(act)}); if (e) { e.click(); await w(800) } }` : ''}
const stat = () => {
  const an = document.getAnimations().filter((a) => a.playState === 'running')
  const els = new Set(an.map((a) => a.effect?.target).filter(Boolean))
  let filt = 0
  for (const e of els) { if (getComputedStyle(e).filter !== 'none') filt++ }
  return { run: an.length, els: els.size, filt }
}
const dts = []; const long = []; let last = performance.now(); const t0 = last; let mid = null
await new Promise((res) => { const f = (t) => { const d = t - last; dts.push(d); if (d > 50) long.push([Math.round(t - t0), Math.round(d)]); last = t; if (mid === null && t - t0 > ${secs} * 500) mid = stat(); if (t - t0 < ${secs} * 1000) requestAnimationFrame(f); else res() }; requestAnimationFrame(f) })
dts.shift()
const s = [...dts].sort((a, b) => a - b)
const at = (p) => +s[Math.min(s.length - 1, Math.floor(s.length * p))].toFixed(1)
return JSON.stringify({ hidden: document.visibilityState, frames: dts.length, p50: at(0.5), p95: at(0.95), p99: at(0.99), max: +s[s.length - 1].toFixed(1), over50: long.length, fps: +(dts.length / (dts.reduce((a, b) => a + b, 0) / 1000)).toFixed(1), anim: mid })
})()`

const exe = CHROMES.find((p) => existsSync(p))
if (exe === undefined) { console.log('못 잼: 크롬을 못 찾았다'); process.exit(2) }
mkdirSync(OUT, { recursive: true })
const prof = mkdtempSync(join(OUT, 'p-'))
const chrome = spawn(exe, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${prof}`, `--window-size=${W},${H}`, '--no-first-run', '--mute-audio', 'about:blank'], { stdio: 'ignore' })
try {
  let tabs: any = null
  for (let i = 0; i < 50 && tabs === null; i++) { try { tabs = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json() } catch { await sleep(200) } }
  if (tabs === null) throw new Error('크롬 디버그 문이 안 열렸다')
  const page = tabs.find((t: any) => t.type === 'page')
  const ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j })
  let id = 0
  const waits = new Map<number, (v: any) => void>()
  ws.onmessage = (ev) => { const m = JSON.parse(String(ev.data)); if (m.id !== undefined) { waits.get(m.id)?.(m.result ?? m.error); waits.delete(m.id) } }
  const call = (method: string, params: object = {}): Promise<any> => new Promise((r) => { const k = ++id; waits.set(k, r); ws.send(JSON.stringify({ id: k, method, params })) })
  await call('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 2, mobile: true })
  await call('Emulation.setTouchEmulationEnabled', { enabled: true })
  await call('Page.enable')
  await call('Page.navigate', { url: URL0 })
  await sleep(4000)
  if (SLOW > 1) await call('Emulation.setCPUThrottlingRate', { rate: SLOW })
  const r = await call('Runtime.evaluate', { expression: RUN(SECS, ACT), awaitPromise: true, returnByValue: true })
  console.log(`${URL0} · ${W}x${H} · CPU ${SLOW}배 느리게 · ${SECS}초`)
  console.log(r.result?.value ?? JSON.stringify(r))
  ws.close()
} finally {
  chrome.kill()
  await sleep(500)
  for (let i = 0; i < 12 && existsSync(prof); i++) { try { rmSync(prof, { recursive: true, force: true }) } catch { await sleep(400) } }
}
