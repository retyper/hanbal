/**
 * 각성 전투 띠를 열전에서 찍어 본다 (11-18 · tools/sprite-kit/aw1-intake.py 로 넣은 뒤 확인).
 *   node --experimental-strip-types tools/aw1-raid-probe.ts <who> [나갈 폴더 D:/tmp-node/aw1] [뿌리 http://localhost:5174]
 * 하는 일: raid.html 을 그 장수 겉모습(sprite=<who> · awake=aw1-<who>)으로 열고, 보통 모습으로 걷는 칸 → 판 안 각성(막대를 채워 E) →
 *         각성 모습으로 걷는 칸 · 싸우는 칸을 장수 둘레만 잘라 찍는다. 두 모습의 그림 키(불투명 픽셀 위끝~아래끝)도 같은 칸에서 재서 견준다.
 * 개발 손잡이 window.__raid (raid-main.ts) · 런타임 의존성 없음 · 5174 만 (이미 떠 있는 dev 서버).
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { SPRITE_PX } from '../src/realm/data/spritePx.ts'
import { AWAKENED_BY_BASE } from '../src/realm/data/awakenedSpritesGenerated.ts'
import { KIT_BY_SPRITE } from '../src/raid/kit-table.ts'

const who = process.argv[2] ?? 'haebi'
const DIR = process.argv[3] ?? 'D:/tmp-node/aw1'
const ROOT = process.argv[4] ?? 'http://localhost:5174'
const awake = AWAKENED_BY_BASE[who]
if (awake === undefined) throw new Error(`${who}: 각성 띠가 등록돼 있지 않다 (AWAKENED_BY_BASE)`)
const queue = JSON.parse(readFileSync('tools/sprite-kit/nonawakened-20261113/queue.json', 'utf8')) as { key: string; bust: string }[]
const bust = queue.find((j) => j.key === who)?.bust ?? 'w-95-michuhol-haebi'
const CHROMES = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe']
const exe = CHROMES.find((p) => existsSync(p))
if (exe === undefined) throw new Error('크롬을 못 찾았다')
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))
mkdirSync(DIR, { recursive: true })
let fail = 0
const check = (ok: boolean, what: string): void => { console.log(`${ok ? '통과' : '실패'} ${what}`); if (!ok) fail++ }

const PORT = 9640 + Math.floor(Math.random() * 40)
const prof = mkdtempSync(join(tmpdir(), 'aw1p-'))
const chrome = spawn(exe, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${prof}`, '--window-size=1280,720', '--no-first-run', '--mute-audio', 'about:blank'], { stdio: 'ignore' })
try {
  let tabs: any = null
  for (let i = 0; i < 50 && tabs === null; i++) { try { tabs = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json() } catch { await sleep(200) } }
  const ws = new WebSocket(tabs.find((t: any) => t.type === 'page').webSocketDebuggerUrl)
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j })
  let id = 0
  const waits = new Map<number, (v: any) => void>()
  ws.onmessage = (m) => { const o = JSON.parse(String(m.data)); if (o.id !== undefined) { waits.get(o.id)?.(o.result ?? o.error); waits.delete(o.id) } }
  const call = (method: string, params: object = {}): Promise<any> => new Promise((r) => { const k = ++id; waits.set(k, r); ws.send(JSON.stringify({ id: k, method, params })) })
  const ev = async (expression: string): Promise<any> => { const r = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) console.log('  스크립트 오류', r.exceptionDetails.exception?.description ?? r.exceptionDetails.text); return r.result?.value }
  await call('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 2, mobile: false })
  await call('Emulation.setFocusEmulationEnabled', { enabled: true })
  await call('Page.enable')
  const q = new URLSearchParams({ hero: 'probe-' + who, name: who, home: 'probe', bust, sprite: who, awake, kit: KIT_BY_SPRITE[who] ?? 'sword', video: '0' })
  await ev(`location.href = ${JSON.stringify(`${ROOT}/raid.html?review&background&${q}`)}`)
  await sleep(3000)
  for (let i = 0; i < 80 && await ev(`document.getElementById('start')?.disabled`) !== false; i++) await sleep(250)
  await ev(`document.getElementById('start').click()`)
  await sleep(1200)
  await ev(`[...document.querySelectorAll('.review-tools button')].find(b => b.textContent === '검수 도구 닫기')?.click()`)
  await ev(`document.querySelector('#overlay:not([hidden]) .choices button')?.click()`)
  await sleep(500)
  /** 장수 둘레(캔버스 좌표 → 화면 좌표)만 잘라 찍는다 */
  const shot = async (name: string): Promise<void> => {
    const clip = await ev(`(() => { const r = window.__raid(), c = document.getElementById('field'), b = c.getBoundingClientRect(), k = b.width / c.width; return { x: Math.max(0, b.left + (r.x - 150) * k), y: Math.max(0, b.top + (r.y - 170) * k), width: 300 * k, height: 220 * k, scale: 2 } })()`)
    const r = await call('Page.captureScreenshot', { format: 'png', clip })
    const p = join(DIR, `raid-${who}-${name}.png`); writeFileSync(p, Buffer.from(r.data, 'base64')); console.log('  찍음', p)
  }
  const key = (type: 'keydown' | 'keyup', k: string): Promise<any> => ev(`window.dispatchEvent(new KeyboardEvent('${type}', { key: '${k}' }))`)
  const look = (): Promise<any> => ev(`(() => { const r = window.__raid(); return { form: r.form, state: r.state, moving: r.moving, x: Math.round(r.x), hp: Math.round(r.hp), canAwaken: r.canAwaken } })()`)
  await ev(`(() => { const r = window.__raid(); r.inv = 999 })()`)
  await key('keydown', 'd'); await sleep(450); await shot('1-normal-walk'); await key('keyup', 'd'); await sleep(300); await shot('2-normal-idle')
  const before = await look()
  check(before.canAwaken === true && before.form === 'normal', `판 안 각성을 할 수 있는 장수 (각성 띠 ${awake}) · 지금 보통 모습`)
  // 판 안 각성: 막대를 채우고 E — 시전(컷인)이 끝날 때까지 기다린다
  await ev(`(() => { const r = window.__raid(); r.gauge = 1e9 })()`)
  await key('keydown', 'e'); await key('keyup', 'e')
  for (let i = 0; i < 60 && (await ev(`(() => { const r = window.__raid(); return r.form === 'awake' && !r.cast })()`)) !== true; i++) { await ev(`document.querySelector('#overlay:not([hidden]) .choices button')?.click()`); await sleep(150) }
  const woke = await look()
  check(woke.form === 'awake', `E 로 각성 모습이 됨 (form=${woke.form})`)
  await ev(`(() => { const r = window.__raid(); r.formT = 60; r.inv = 999 })()`)
  await sleep(300); await shot('3-awake-idle')
  await key('keydown', 'a'); await sleep(450); await shot('4-awake-walk'); await key('keyup', 'a')
  // 싸우는 칸: 적이 다가와 저절로 친다 — 몇 번 찍어 둔다
  for (let i = 0; i < 3; i++) { await sleep(900); await ev(`document.querySelector('#overlay:not([hidden]) .choices button')?.click()`); await shot(`5-awake-fight${i + 1}`) }
  // 그림 키: 열전은 160칸을 그대로 heroPx 로 그리므로 띠의 서기 칸 불투명 높이가 곧 화면 키 비다
  const tall = await ev(`(async () => { const out = {}; for (const k of ['gen-${who}', 'gen-${awake}']) { const im = new Image(); im.src = '${ROOT}/realm/anim-px/' + k + '.png'; await im.decode(); const w = im.width / 20, c = Object.assign(document.createElement('canvas'), { width: w, height: im.height }), x = c.getContext('2d'); x.drawImage(im, 0, 0); const d = x.getImageData(0, 0, w, im.height).data; let top = -1, bot = -1; for (let y = 0; y < im.height; y++) for (let i = 0; i < w; i++) if (d[(y * w + i) * 4 + 3] > 64) { if (top < 0) top = y; bot = y } out[k] = { top, bot, h: bot - top + 1 } } return out })()`)
  const pb = SPRITE_PX[`gen-${who}`]!, pa = SPRITE_PX[`gen-${awake}`]!
  console.log('  서기 칸 그림', JSON.stringify(tall), '· 본편 몸 키 값 bodyPx', pb.bodyPx, '→', pa.bodyPx)
  check(pb.bodyPx === pa.bodyPx, `본편(겨루기·전장) 몸 키 값이 같다 ${pb.bodyPx} = ${pa.bodyPx}`)
  await call('Page.navigate', { url: 'about:blank' })
  ws.close()
} finally {
  chrome.kill()
  await sleep(500)
  for (let i = 0; i < 12 && existsSync(prof); i++) { try { rmSync(prof, { recursive: true, force: true }) } catch { await sleep(400) } }
}
process.exit(fail ? 1 : 0)
