/**
 * 열전 비기·각성 컷인 띠 찍기 (11-17) — 헤드리스 크롬으로 판을 시작하고 개발 손잡이(__raidCutin)로 컷인을 띄워 애니를 한 순간에 멈춰 찍는다.
 *   node --experimental-strip-types tools/raid-cutin-probe.ts [나갈 폴더 .] [주소 http://localhost:5174/raid.html?review&background]
 * 폰 가로 844×390 · 데스크톱 1280×720 각각 비기(ult) · 각성(wake) 두 장. 런타임 의존성 없음 — tools/raid-stick-probe.ts 와 같은 CDP 길.
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const DIR = process.argv[2] ?? '.'
const URL0 = process.argv[3] ?? 'http://localhost:5174/raid.html?review&background'
const AT_MS = 800
const SIZES = [{ w: 844, h: 390, dpr: 2, mobile: true }, { w: 1280, h: 720, dpr: 1, mobile: false }]
const CHROMES = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe']
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))
const exe = CHROMES.find((p) => existsSync(p))
if (exe === undefined) throw new Error('크롬을 못 찾았다')
let fail = 0
const check = (ok: boolean, what: string): void => { console.log(`${ok ? '통과' : '실패'} ${what}`); if (!ok) fail++ }

for (const S of SIZES) {
  const PORT = 9490 + Math.floor(Math.random() * 40)
  const prof = mkdtempSync(join(tmpdir(), 'cutin-'))
  const chrome = spawn(exe, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${prof}`, `--window-size=${S.w},${S.h}`, '--no-first-run', '--mute-audio', 'about:blank'], { stdio: 'ignore' })
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
    await call('Emulation.setDeviceMetricsOverride', { width: S.w, height: S.h, deviceScaleFactor: S.dpr, mobile: S.mobile })
    await call('Emulation.setFocusEmulationEnabled', { enabled: true })
    await call('Page.enable')
    await call('Page.navigate', { url: URL0 })
    await sleep(3000)
    for (let i = 0; i < 60 && await ev(`document.getElementById('start').disabled`) !== false; i++) await sleep(250)
    await ev(`document.getElementById('start').click()`)
    await sleep(1500)
    for (const kind of ['ult', 'wake'] as const) {
      const wake = kind === 'wake'
      if (wake) await ev(`Object.assign(window.__raid(), { form: 'awake', formT: 60 })`)
      // 한 번 띄워 그림을 불러 두고 → 다시 띄워 AT_MS 에 멈춘다
      await ev(`window.__raidCutin(${wake})`)
      await sleep(1000)
      await ev(`window.__raidCutin(${wake})`)
      const info = await ev(`(() => { const c = document.getElementById('skill-cutin'); c.getAnimations({ subtree: true }).forEach(a => { a.pause(); a.currentTime = ${AT_MS} });
        const face = c.querySelector('.cbd-face'), plate = c.querySelector('.cbd-plate');
        return { shown: !c.hidden, title: c.querySelector('.cbd-ttl b')?.textContent, face: face?.getAttribute('src'), plate: plate?.getAttribute('src') } })()`)
      await sleep(250)
      const loaded = await ev(`[...document.querySelectorAll('#skill-cutin img')].every(i => i.complete && i.naturalWidth > 0)`)
      check(info.shown === true, `${S.w}×${S.h} ${kind} 컷인이 뜬다 · ${info.title} · ${info.face}`)
      check(loaded === true, `${S.w}×${S.h} ${kind} 그림이 다 불러와졌다 (${info.plate})`)
      const shot = await call('Page.captureScreenshot', { format: 'png' })
      writeFileSync(join(DIR, `raid-cutin-${kind}-${S.w}x${S.h}.png`), Buffer.from(shot.data, 'base64'))
    }
    // 누르면 걷힌다
    await ev(`window.__raidCutin(false)`)
    const box = await ev(`(() => { const b = document.getElementById('field').getBoundingClientRect(); return { x: b.left + b.width * .5, y: b.top + b.height * .5 } })()`)
    await call('Input.dispatchMouseEvent', { type: 'mousePressed', x: box.x, y: box.y, button: 'left', clickCount: 1 })
    await call('Input.dispatchMouseEvent', { type: 'mouseReleased', x: box.x, y: box.y, button: 'left', clickCount: 1 })
    await sleep(100)
    check(await ev(`document.getElementById('skill-cutin').hidden`) === true, `${S.w}×${S.h} 화면을 누르면 컷인이 걷힌다`)
    ws.close()
  } finally {
    chrome.kill()
    await sleep(500)
    for (let i = 0; i < 12 && existsSync(prof); i++) { try { rmSync(prof, { recursive: true, force: true }) } catch { await sleep(400) } }
  }
}
console.log(fail ? `실패 ${fail}` : '모두 통과')
