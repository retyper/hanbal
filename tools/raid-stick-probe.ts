/**
 * 열전 손가락 조이스틱 시험 (11-16) — 헤드리스 크롬을 폰 가로로 띄워 판을 시작하고, 손가락을 대고 오른쪽 위로 끌어 장수가 그쪽으로 가는지 · 막대가 보이는지 · 떼면 서는지 잰다.
 *   node --experimental-strip-types tools/raid-stick-probe.ts [나갈 png] [주소 http://localhost:5174/raid.html]
 * 런타임 의존성 없음 — tools/phone-shot.ts 와 같은 CDP 길.
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const OUT = process.argv[2] ?? 'raid-stick.png'
const URL0 = process.argv[3] ?? 'http://localhost:5174/raid.html'
const W = 844, H = 390
const PORT = 9450 + Math.floor(Math.random() * 40)
const CHROMES = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe']
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))
const exe = CHROMES.find((p) => existsSync(p))
if (exe === undefined) throw new Error('크롬을 못 찾았다')
const prof = mkdtempSync(join(tmpdir(), 'stick-'))
const chrome = spawn(exe, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${prof}`, `--window-size=${W},${H}`, '--no-first-run', '--mute-audio', 'about:blank'], { stdio: 'ignore' })
let fail = 0
const check = (ok: boolean, what: string): void => { console.log(`${ok ? '통과' : '실패'} ${what}`); if (!ok) fail++ }
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
  const ev = async (expression: string): Promise<any> => (await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result?.value
  await call('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 2, mobile: true })
  await call('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 })
  await call('Emulation.setFocusEmulationEnabled', { enabled: true })
  await call('Page.enable')
  await call('Page.navigate', { url: URL0 })
  await sleep(3500)
  for (let i = 0; i < 60 && await ev(`document.getElementById('start').disabled`) !== false; i++) await sleep(250)
  check(await ev(`document.getElementById('start').disabled`) === false, '그림을 다 불러와 출전 단추가 켜진다')
  await ev(`document.getElementById('start').click()`)
  await sleep(1200)
  check(await ev(`!document.getElementById('play').hidden`) === true, '판이 시작된다')
  const box = await ev(`(() => { const b = document.getElementById('field').getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height } })()`)
  const cx = Math.round(box.x + box.w * .4), cy = Math.round(box.y + box.h * .6)
  await call('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: cx, y: cy }] })
  await sleep(120)
  const shownAfterDown = await ev(`!document.getElementById('stick').hidden`)
  check(shownAfterDown === true, '손가락을 대면 조이스틱이 생긴다')
  for (let i = 1; i <= 6; i++) { await call('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: cx + i * 12, y: cy - i * 6 }] }); await sleep(30) }
  const knob = await ev(`document.querySelector('#stick i').style.transform`)
  check(/translate\(5\d/.test(knob ?? '') || /translate\(4\d/.test(knob ?? ''), `손잡이가 끝까지 밀림 (${knob})`)
  await sleep(900)
  const shot = await call('Page.captureScreenshot', { format: 'png' })
  writeFileSync(OUT, Buffer.from(shot.data, 'base64'))
  await call('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await sleep(150)
  check(await ev(`document.getElementById('stick').hidden`) === true, '손을 떼면 조이스틱이 사라진다')
  ws.close()
} finally {
  chrome.kill()
  await sleep(500)
  for (let i = 0; i < 12 && existsSync(prof); i++) { try { rmSync(prof, { recursive: true, force: true }) } catch { await sleep(400) } }
}
console.log(fail ? `실패 ${fail}` : '모두 통과')
