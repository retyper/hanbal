/**
 * 폰 폭 확인 — 헤드리스 크롬을 폰 크기로 띄워 판을 열고, 넣어 준 HTML(또는 그대로)을 찍는다 (형 10-29: "레이아웃 깨지는 거 항상 조심하라고 했냐 안 했냐").
 * 새 화면을 지으면 이걸로 390px 폭에서 넘치지 않는지 본다 — 넘친 칸(scrollWidth > clientWidth 또는 화면 밖)도 적어 준다.
 *
 *   node --experimental-strip-types tools/phone-shot.ts <나갈 png> [html 파일 — .ap 안에 끼워 넣는다 · 없으면 -] [너비 390] [높이 844] [주소 http://localhost:5174/realm.html]
 *   PRE='js 식' — 찍기 전에 페이지에서 돌린다(눌러서 화면을 연다 · await 를 쓸 수 있다) · SAVE='판 json' — 저장 칸에 넣고 다시 연다(tools/phone-save.ts)
 *
 * 런타임 의존성 없음 — 크롬 원격 디버깅(CDP)을 Node 내장 WebSocket 으로 (tools/monkey.ts 와 같은 길). 쓴 임시 폴더는 스스로 지운다.
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const OUT = process.argv[2] ?? 'phone.png'
const HTML = process.argv[3] !== undefined && process.argv[3] !== '-' ? readFileSync(process.argv[3], 'utf8') : null
const W = Number(process.argv[4] ?? 390)
const H = Number(process.argv[5] ?? 844)
const URL0 = process.argv[6] ?? 'http://localhost:5174/realm.html'
const PORT = 9400 + Math.floor(Math.random() * 50)
const CHROMES = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe']
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

const exe = CHROMES.find((p) => existsSync(p))
if (exe === undefined) throw new Error('크롬을 못 찾았다')
const prof = mkdtempSync(join(tmpdir(), 'phone-'))
const chrome = spawn(exe, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${prof}`, `--window-size=${W},${H}`, '--no-first-run', '--mute-audio', 'about:blank'], { stdio: 'ignore' })
try {
  let tabs: any = null
  for (let i = 0; i < 50 && tabs === null; i++) { try { tabs = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json() } catch { await sleep(200) } }
  const page = tabs.find((t: any) => t.type === 'page')
  const ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j })
  let id = 0
  const waits = new Map<number, (v: any) => void>()
  ws.onmessage = (ev) => { const m = JSON.parse(String(ev.data)); if (m.id !== undefined) { waits.get(m.id)?.(m.result ?? m.error); waits.delete(m.id) } }
  const call = (method: string, params: object = {}): Promise<any> => new Promise((r) => { const k = ++id; waits.set(k, r); ws.send(JSON.stringify({ id: k, method, params })) })
  await call('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 2, mobile: true })
  await call('Page.enable')
  await call('Page.navigate', { url: URL0 })
  await sleep(4000)
  // SAVE='json 파일' — 그 판을 이 창의 저장 칸에 넣고 다시 연다 (tools/phone-save.ts 가 만든다)
  const save = process.env['SAVE']
  if (save !== undefined && save !== '') {
    await call('Runtime.evaluate', { expression: `localStorage.setItem('hanbal.realm.v2', ${JSON.stringify(readFileSync(save, 'utf8'))})` })
    await call('Page.reload')
    await sleep(4000)
  }
  const pre = process.env['PRE']
  if (pre !== undefined && pre !== '') { await call('Runtime.evaluate', { expression: `(async () => { ${pre} })()`, awaitPromise: true }); await sleep(1200) }
  if (HTML !== null) {
    await call('Runtime.evaluate', { expression: `(() => { const ap = document.querySelector('.ap'); const d = document.createElement('div'); d.className = 'probe-host'; d.style.cssText = 'position:absolute;inset:0;z-index:999;display:flex;align-items:center;justify-content:center;background:#0b0806'; d.innerHTML = ${JSON.stringify(HTML)}; ap.appendChild(d) })()` })
    await sleep(1500)
  }
  const over = await call('Runtime.evaluate', { returnByValue: true, expression: `(() => { const vw = innerWidth; const out = []; for (const e of document.querySelectorAll('.probe-host *, .ap *')) { const b = e.getBoundingClientRect(); if (b.width === 0 || e.closest('.mapwrap') !== null) continue; const cs = getComputedStyle(e); if (cs.visibility === 'hidden' || cs.display === 'none') continue; if (b.right > vw + 1 || b.left < -1) out.push((typeof e.className === 'string' ? e.className : e.tagName) + ' ' + Math.round(b.left) + '~' + Math.round(b.right)); } return [vw, out.slice(0, 12)] })()` })
  console.log(JSON.stringify(over.result?.value))
  const m = await call('Runtime.evaluate', { returnByValue: true, expression: 'window.__m ?? ""' })
  if (m.result?.value) console.log(m.result.value)
  const shot = await call('Page.captureScreenshot', { format: 'png' })
  writeFileSync(OUT, Buffer.from(shot.data, 'base64'))
  ws.close()
} finally {
  chrome.kill()
  await sleep(500)
  try { rmSync(prof, { recursive: true, force: true }) } catch { /* 크롬이 아직 잡고 있다 */ }
}
