/** 50-8 후보 듣기 HTML의 실제 native 재생 검사. 음색/적합도 청취 판정은 하지 않는다. */
import { spawn } from 'node:child_process'
import { createWriteStream, existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const out = process.argv[2], url = process.argv[3] ?? 'http://127.0.0.1:5188/'
if (!out) throw new Error('출력 폴더가 필요합니다')
mkdirSync(out, { recursive: true })
const exe = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(existsSync)
if (!exe) throw new Error('Chrome 없음')
const port = 9791, profile = mkdtempSync(join(tmpdir(), 'raid50-sfx-'))
const chromeLog = createWriteStream(join(out, 'chrome-stderr.log'))
const chrome = spawn(exe, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--no-first-run', '--mute-audio', '--window-size=1000,850', 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] })
chrome.stderr.pipe(chromeLog)
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const report: any = { url, method: 'native audio control mouse click + native wheel; no HTML/media state writes', listened: false, errors: [], resources: [], audio: [], shots: [], profile }
let ws: WebSocket | undefined, failed: unknown
try {
  let tabs: any
  for (let n = 0; n < 40 && !tabs; n++) { try { tabs = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json() } catch { await sleep(200) } }
  if (!tabs) throw new Error('Chrome debugger 없음')
  ws = new WebSocket(tabs.find((t: any) => t.type === 'page').webSocketDebuggerUrl)
  await new Promise((r, j) => { ws!.onopen = r; ws!.onerror = j })
  let seq = 0
  const pending = new Map<number, (m: any) => void>()
  ws.onmessage = e => {
    const m = JSON.parse(String(e.data))
    if (m.id) { pending.get(m.id)?.(m); pending.delete(m.id); return }
    if (m.method === 'Runtime.exceptionThrown') report.errors.push(m.params.exceptionDetails)
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') report.errors.push(m.params.args)
    if (m.method === 'Network.responseReceived' && m.params.response.status >= 400) report.resources.push({ url: m.params.response.url, status: m.params.response.status })
  }
  const call = (method: string, params: object = {}): Promise<any> => new Promise((resolve, reject) => {
    const id = ++seq, timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout ${method}`)) }, 45000)
    pending.set(id, m => { clearTimeout(timer); if (m.error) reject(new Error(JSON.stringify(m.error))); else resolve(m.result) })
    ws!.send(JSON.stringify({ id, method, params }))
  })
  const ev = async (expression: string) => {
    new Function(`return (${expression})`)
    const r = await call('Runtime.evaluate', { expression, returnByValue: true })
    if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails))
    return r.result.value
  }
  for (const d of ['Page', 'Runtime', 'Network']) await call(`${d}.enable`)
  await call('Page.navigate', { url })
  for (let n = 0; n < 60; n++) { if (await ev(`document.readyState==='complete' && document.querySelectorAll('audio').length===18`)) break; await sleep(150) }
  if (report.errors.length) throw new Error('첫 로드 JS 오류')
  report.count = await ev(`document.querySelectorAll('audio').length`)
  if (report.count !== 18) throw new Error(`audio count ${report.count}`)
  const shot = async (name: string) => { const p = join(out, name + '.png'); writeFileSync(p, Buffer.from((await call('Page.captureScreenshot', { format: 'png' })).data, 'base64')); report.shots.push(p) }
  await shot('sfx-top')
  for (let i = 0; i < 18; i++) {
    const read = () => ev(`(() => {const a=document.querySelectorAll('audio')[${i}],r=a.getBoundingClientRect();return {src:a.currentSrc||a.src,duration:a.duration,currentTime:a.currentTime,readyState:a.readyState,paused:a.paused,ended:a.ended,error:a.error?.code??null,x:r.left,y:r.top,w:r.width,h:r.height,viewH:innerHeight,scrollY:scrollY}})()`)
    let a = await read()
    for (let n = 0; n < 30 && (a.y < 15 || a.y + a.h > a.viewH - 15); n++) {
      const deltaY = a.y < 15 ? -Math.min(500, 50 - a.y) : Math.min(500, a.y + a.h - a.viewH + 65)
      await call('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 920, y: 350, deltaX: 0, deltaY })
      await sleep(80); a = await read()
    }
    if (a.y < 0 || a.y + a.h > a.viewH) throw new Error(`audio ${i} native scroll failed`)
    const x = a.x + 20, y = a.y + a.h / 2
    await call('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 })
    await call('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 })
    await sleep(350)
    let played = await read()
    for (let n = 0; n < 30 && !(played.currentTime > 0 || played.ended); n++) { await sleep(100); played = await read() }
    const ok = played.error === null && Number.isFinite(played.duration) && played.duration > 0 && played.readyState >= 2 && (played.currentTime > 0 || played.ended)
    report.audio.push({ index: i + 1, ...played, ok })
    if (!ok) throw new Error(`audio ${i + 1} did not play`)
    if (!played.paused) {
      await call('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 })
      await call('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 })
    }
    if (i % 3 === 2) await shot(`sfx-category-${Math.floor(i / 3) + 1}`)
  }
  report.horizontalOverflow = await ev(`document.documentElement.scrollWidth>innerWidth`)
  report.ok = report.audio.every((a: any) => a.ok) && report.errors.length === 0 && report.resources.filter((r: any) => !r.url.endsWith('/favicon.ico')).length === 0 && !report.horizontalOverflow
  if (!report.ok) throw new Error('페이지 최종 검사 실패')
} catch (e) { failed = e; report.failure = String(e); report.ok = false }
finally {
  writeFileSync(join(out, 'sfx-listen-report.json'), JSON.stringify(report, null, 2))
  ws?.close(); chrome.kill(); chromeLog.end()
  // Windows may retain Chrome locks briefly; preserve this one isolated profile instead of deleting a broad temp folder.
}
console.log(JSON.stringify({ ok: report.ok, count: report.audio.length, errors: report.errors.length, failure: report.failure ?? null }))
if (failed) process.exitCode = 1
