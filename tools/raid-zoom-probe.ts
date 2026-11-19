/**
 * 열전 전투판 확대 단추 · 판 기록 시험 (11-19) — 헤드리스 크롬을 폰 가로(844×390)로 띄워 판을 시작하고, 돋보기를 손가락으로 눌러
 * 1배 · 조금 · 가까이 · (가까이에서 맵 끝) 네 장을 찍고 · 667×375 가로와 390 세로에서 단추가 보이는지 · 판 기록이 남는지 잰다.
 * 찍은 것은 한 장(jpg)으로 묶는다.
 *   node --experimental-strip-types tools/raid-zoom-probe.ts [나갈 jpg D:/tmp-node/raid-zoom/for-hyung.jpg] [주소 http://localhost:5174/raid.html]
 * 런타임 의존성 없음 — tools/raid-stick-probe.ts 와 같은 CDP 길. 5174 에서만 (5173 은 형이 쓴다).
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

const OUT = process.argv[2] ?? 'D:/tmp-node/raid-zoom/for-hyung.jpg'
const URL0 = process.argv[3] ?? 'http://localhost:5174/raid.html'
const PORT = 9500 + Math.floor(Math.random() * 40)
const CHROMES = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe']
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))
const exe = CHROMES.find((p) => existsSync(p))
if (exe === undefined) throw new Error('크롬을 못 찾았다')
mkdirSync(dirname(OUT), { recursive: true })
const prof = mkdtempSync(join(tmpdir(), 'zoom-'))
const chrome = spawn(exe, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${prof}`, '--window-size=844,390', '--no-first-run', '--mute-audio', 'about:blank'], { stdio: 'ignore' })
let fail = 0
const check = (ok: boolean, what: string): void => { console.log(`${ok ? '통과' : '실패'} ${what}`); if (!ok) fail++ }
const shots: { label: string; data: string; w: number; h: number }[] = []
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
  const size = async (w: number, h: number) => { await call('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 2, mobile: true }) }
  const tap = async (x: number, y: number) => { await call('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] }); await sleep(60); await call('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }) }
  const shoot = async (label: string, w: number, h: number) => { const s = await call('Page.captureScreenshot', { format: 'png' }); shots.push({ label, data: s.data, w, h }) }
  const rect = (sel: string) => ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; const b = e.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height, r: b.right, b: b.bottom } })()`)
  const tapZoom = async () => { const z = await rect('#zoom'); await tap(Math.round(z.x + z.w / 2), Math.round(z.y + z.h / 2)); return z }
  const zoomState = () => ev(`({ on: document.getElementById('zoom').classList.contains('on'), label: document.getElementById('zoom').getAttribute('aria-label'), minus: !document.getElementById('zoom').innerHTML.includes('M13.5 9.2'), stick: !document.getElementById('stick').hidden })`)

  await size(844, 390)
  await call('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 })
  await call('Emulation.setFocusEmulationEnabled', { enabled: true })
  await call('Page.enable')
  await call('Page.navigate', { url: URL0 })
  await sleep(3000)
  for (let i = 0; i < 80 && await ev(`document.getElementById('start').disabled`) !== false; i++) await sleep(250)
  check(await ev(`document.getElementById('zoom') !== null && getComputedStyle(document.getElementById('zoom')).display === 'none'`) === true, '출전 화면에서는 돋보기가 숨어 있다')
  await ev(`document.getElementById('start').click()`)
  await sleep(1500)
  check(await ev(`document.visibilityState`) === 'visible', '탭이 보이는 상태 (캔버스가 그려진다)')
  const z0 = await rect('#zoom'), fs = await rect('#fullscreen'), pz = await rect('#pause'), hud = await rect('#hud'), chud = await rect('#combat-hud')
  console.log('돋보기', z0, '전체화면', fs, '멈춤', pz, '시계', hud, '체력', chud)
  check(z0 !== null && z0.w >= 30 && z0.r <= 844 && z0.y >= 0, `돋보기가 화면 안 우상단에 있다 (${z0?.w}px)`)
  check(z0.r <= fs.x + 1 && z0.b > fs.y, '전체화면 단추 왼쪽에 붙어 겹치지 않는다')
  check(z0.x >= hud.r || z0.b <= hud.y, '시계를 가리지 않는다')
  check(z0.x >= chud.r, '체력바·능력 칸을 가리지 않는다')
  await shoot('1배', 844, 390)
  let st = await zoomState(); check(!st.on && !st.minus, '1배: 돋보기 + · 금빛 아님')
  await tapZoom(); await sleep(120)
  check(await ev(`document.getElementById('zoom').classList.contains('pop')`) === true, '누르면 튀는 반응 (pop)')
  await sleep(900)
  st = await zoomState(); check(st.on && !st.minus && !st.stick, `조금 확대: 금빛 · 아직 돋보기 + · 조이스틱 안 생김 (${st.label})`)
  await shoot('조금 확대 ×1.35', 844, 390)
  await tapZoom(); await sleep(1000)
  st = await zoomState(); check(st.on && st.minus, `가까이: 금빛 · 돋보기 − 로 바뀜 (${st.label})`)
  check(await ev(`localStorage.getItem('hanbal.raid.zoom')`) === '2', '단계를 기억한다')
  // 판 한가운데라면 장수가 화면 가운데에 그려진다 — 판 좌표 ↔ 화면 좌표를 카메라로 확인
  await shoot('가까이 ×1.8', 844, 390)
  // 맵 끝: 장수를 왼쪽 끝(가운데 높이)으로 (개발 손잡이 · 판 상태를 직접 옮긴다 · 왼쪽 위는 체력 막대 밑이라 안 보인다)
  await ev(`(() => { const r = window.__raid(); r.x = 40; r.y = 380 })()`)
  await sleep(1500)
  await shoot('가까이 · 맵 끝(왼쪽) 가장자리에 멈춤', 844, 390)
  await tapZoom(); await sleep(900)
  st = await zoomState(); check(!st.on && !st.minus, '한 번 더 누르면 원래대로 (돋보기 + · 금빛 꺼짐)')
  // 판 기록
  const g = await ev(`JSON.parse(localStorage.getItem('hanbal.raid.games') ?? '[]')`)
  check(Array.isArray(g) && g.length === 1 && g[0].end === null && typeof g[0].seed === 'number', `출전하면 판 기록이 한 장 생긴다 (${g?.length})`)
  // 멈춤 → 물러나기 → 끝이 적힌다
  await ev(`document.getElementById('pause').click()`); await sleep(300)
  await ev(`document.getElementById('quit').click()`); await sleep(500)
  const g2 = await ev(`JSON.parse(localStorage.getItem('hanbal.raid.games') ?? '[]')[0]`)
  check(g2?.end?.result === 'quit' && g2.steps > 100 && g2.input.length > 0, `물러나면 끝(quit) · 걸음 ${g2?.steps} · 입력 ${g2?.input?.length}자`)
  // 667×375 가로
  await ev(`document.getElementById('new-run')?.click()`); await sleep(800)
  await size(667, 375); await sleep(800)
  const z1 = await rect('#zoom'), fs1 = await rect('#fullscreen'), hud1 = await rect('#hud')
  check(z1 !== null && z1.r <= fs1.x + 1 && (z1.x >= hud1.r || z1.b <= hud1.y) && z1.r <= 667, `667×375: 돋보기가 보이고 겹치지 않는다 (${Math.round(z1.x)},${Math.round(z1.y)} ${z1.w}px)`)
  await shoot('667×375 가로', 667, 375)
  // 390 세로 — 판은 「가로로 돌려 주세요」가 덮는다 · 단추가 그 위에서도 자리에 있는지
  await size(390, 844); await sleep(900)
  const z2 = await rect('#zoom'), guide = await ev(`!document.getElementById('rotate-guide').hidden`)
  const top = await ev(`(() => { const b = document.getElementById('zoom').getBoundingClientRect(); const e = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); return e?.closest('#zoom') ? 'zoom' : e?.id || e?.className || e?.tagName })()`)
  console.log('세로 390: 돋보기', z2, '돌려 주세요 안내', guide, '맨 위', top)
  check(z2 !== null && z2.w > 0 && z2.r <= 390 && z2.x >= 0, `390 세로: 돋보기가 화면 안에 있다 (${Math.round(z2.x)},${Math.round(z2.y)})`)
  await shoot('390 세로', 390, 844)
  ws.close()
  // 한 장으로 묶는다 — 같은 크롬에 그림 판을 열어 찍는다
  const ws2page = (await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json())
  const ws2 = new WebSocket(ws2page.webSocketDebuggerUrl)
  await new Promise((r, j) => { ws2.onopen = r; ws2.onerror = j })
  const waits2 = new Map<number, (v: any) => void>(); let id2 = 0
  ws2.onmessage = (e) => { const m = JSON.parse(String(e.data)); if (m.id !== undefined) { waits2.get(m.id)?.(m.result ?? m.error); waits2.delete(m.id) } }
  const call2 = (method: string, params: object = {}): Promise<any> => new Promise((r) => { const k = ++id2; waits2.set(k, r); ws2.send(JSON.stringify({ id: k, method, params })) })
  const land = shots.filter((s) => s.h < 500), port = shots.filter((s) => s.h >= 500)
  const cell = (s: typeof shots[number], w: number) => `<figure><img src="data:image/png;base64,${s.data}" style="width:${w}px"><figcaption>${s.label}</figcaption></figure>`
  const html = `<html><body style="margin:0;background:#111;color:#eee;font:600 18px sans-serif"><div style="display:flex;gap:14px;padding:14px;align-items:flex-start"><div style="display:grid;grid-template-columns:repeat(2,844px);gap:12px">${land.map((s) => cell(s, s.w === 844 ? 844 : 667)).join('')}</div><div>${port.map((s) => cell(s, 300)).join('')}</div></div><style>figure{margin:0}figcaption{padding:4px 2px}</style></body></html>`
  const W = 14 + 844 * 2 + 12 + 14 + 300 + 14, H = 14 + Math.ceil(land.length / 2) * (390 + 34) + 14
  await call2('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false })
  await call2('Page.enable')
  const tree = await call2('Page.getFrameTree')
  await call2('Page.setDocumentContent', { frameId: tree.frameTree.frame.id, html })
  await sleep(800)
  const sheet = await call2('Page.captureScreenshot', { format: 'jpeg', quality: 85 })
  writeFileSync(OUT, Buffer.from(sheet.data, 'base64'))
  console.log('묶음', OUT, `${W}×${H}`)
  ws2.close()
} finally {
  chrome.kill()
  await sleep(500)
  for (let i = 0; i < 12 && existsSync(prof); i++) { try { rmSync(prof, { recursive: true, force: true }) } catch { await sleep(400) } }
}
console.log(fail ? `실패 ${fail}` : '모두 통과')
if (fail) process.exitCode = 1
