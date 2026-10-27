/**
 * 막무가내 로봇 — 놀이 시험 ② (docs/realm/PLAYTEST.md).
 *
 * 따로 띄운 헤드리스 크롬(새 프로필 = 저장 없는 새 손님)으로 칠십팔국을 열고, 화면에 보이는
 * 누를 거리를 아무렇게나 골라 진짜 마우스로 누른다. 잡는 것 셋:
 *   - 오류: 페이지 예외 · console.error
 *   - 갇힘: 누를 거리가 하나도 없거나, 한참 눌러도 화면이 그대로
 *   - 맴돎: 화면은 바뀌는데 한참 동안 처음 보는 누를 거리가 하나도 안 나온다 (같은 칸만 돈다)
 *   - 떠남: 다른 주소로 넘어감 (돌려놓고 센다)
 * 갇히면 그 자리 스크린샷과 마지막 누름들을 남긴다 (tools/out/monkey/).
 *
 * 런타임 의존성 없음 — 크롬 원격 디버깅(CDP)을 Node 내장 WebSocket 으로 부른다.
 * 실행: node --experimental-strip-types tools/monkey.ts [누름=1500] [씨앗=1] [폭=430] [높이=900] [주소]
 *   주소 기본값은 http://localhost:5174/realm.html (5173 은 형이 쓰는 자리)
 */
import { spawn } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const STEPS = Number(process.argv[2] ?? 1500)
const SEED = Number(process.argv[3] ?? 1)
const W = Number(process.argv[4] ?? 430)
const H = Number(process.argv[5] ?? 900)
const URL0 = process.argv[6] ?? 'http://localhost:5174/realm.html'
const PORT = 9333 + (SEED % 50)
const OUT = join('tools', 'out', 'monkey', `s${SEED}-${W}x${H}`)
/** 이만큼 눌러도 화면이 한 번도 안 바뀌면 갇힘 */
const STALL = 40
/** 이만큼 눌러도 처음 보는 누를 거리가 안 나오면 맴돎 */
const LOOP = 200
const CHROMES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
]

let s = SEED >>> 0 || 1
const rnd = (): number => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296 }
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

const exe = CHROMES.find((p) => existsSync(p))
if (exe === undefined) throw new Error('크롬을 못 찾았다')
const prof = mkdtempSync(join(tmpdir(), 'monkey-'))
rmSync(OUT, { recursive: true, force: true })
mkdirSync(OUT, { recursive: true })
const chrome = spawn(exe, [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${prof}`, `--window-size=${W},${H}`,
  '--no-first-run', '--no-default-browser-check', '--mute-audio', '--autoplay-policy=no-user-gesture-required', 'about:blank',
], { stdio: 'ignore' })

async function json(path: string): Promise<any> {
  for (let i = 0; i < 50; i++) {
    try { return await (await fetch(`http://127.0.0.1:${PORT}${path}`)).json() } catch { await sleep(200) }
  }
  throw new Error('크롬 디버깅 자리가 안 열린다')
}

const tabs = await json('/json/list')
const page = tabs.find((t: any) => t.type === 'page')
const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j })
let id = 0
const waits = new Map<number, (v: any) => void>()
const errors: string[] = []
let step = 0
ws.onmessage = (ev) => {
  const m = JSON.parse(String(ev.data))
  if (m.id !== undefined) { waits.get(m.id)?.(m.error !== undefined ? { error: m.error } : m.result); waits.delete(m.id); return }
  if (m.method === 'Runtime.exceptionThrown') {
    const d = m.params.exceptionDetails
    errors.push(`#${step} 예외 ${d.exception?.description ?? d.text}`.slice(0, 600))
  } else if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
    errors.push(`#${step} console.error ${m.params.args.map((a: any) => a.value ?? a.description ?? '').join(' ')}`.slice(0, 600))
  } else if (m.method === 'Page.javascriptDialogOpening') {
    void cdp('Page.handleJavaScriptDialog', { accept: rnd() < 0.5 })
  }
}
function cdp(method: string, params: object = {}): Promise<any> {
  const i = ++id
  ws.send(JSON.stringify({ id: i, method, params }))
  return new Promise((r) => waits.set(i, r))
}
async function ev<T>(expr: string): Promise<T> {
  const r = await cdp('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })
  return r?.result?.value as T
}

await cdp('Runtime.enable')
await cdp('Page.enable')
await cdp('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: W < 600 })
await cdp('Browser.setDownloadBehavior', { behavior: 'deny' })
await cdp('Page.navigate', { url: URL0 })
await sleep(4000)

/** 누를 거리 — 보이고, 그 한가운데를 찍으면 자기(또는 자식)가 맞는 것만. 이름표는 짧은 글 */
const PICK = `(() => {
  const sel = 'button, a[href], [data-act], [role=button], .nd, .btn, summary, input, select, label, [onclick], [tabindex]'
  const out = []
  for (const el of document.querySelectorAll(sel)) {
    if (el.disabled) continue
    const b = el.getBoundingClientRect()
    if (b.width < 4 || b.height < 4) continue
    const x = b.left + b.width / 2, y = b.top + b.height / 2
    if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) continue
    const hit = document.elementFromPoint(x, y)
    if (hit === null || !(hit === el || el.contains(hit) || hit.contains(el))) continue
    if (el.tagName === 'A' && el.href && new URL(el.href, location.href).origin !== location.origin) continue
    if (el.matches('a[download], [data-act=export], [data-act=acct-in]')) continue // 구글 로그인 창으로 넘어가지 않는다
    const t = (el.getAttribute('data-act') ?? '') + ' ' + (el.innerText || el.getAttribute('aria-label') || String(el.className) || el.tagName).replace(/\\s+/g, ' ').trim().slice(0, 40)
    out.push({ x, y, t: t.trim() })
  }
  return out
})()`
/** 갇힌 자리 살피기 — 배우기 고리가 어디를 감쌌고 그 밑에 무엇이 있나 · 굴린 틀들 */
const DIAG = `(() => {
  const d = (el) => el ? el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : '') + (el.dataset.act ? '[' + el.dataset.act + ']' : '') : '-'
  const out = []
  const ring = document.querySelector('.tutring:not([hidden])')
  if (ring) {
    const b = ring.getBoundingClientRect()
    out.push('고리 ' + [b.left, b.top, b.width, b.height].map(Math.round).join(','))
    out.push('고리 밑 ' + document.elementsFromPoint(b.left + b.width / 2, b.top + b.height / 2).slice(0, 4).map(d).join(' > '))
  }
  for (const el of document.querySelectorAll('*')) if (el.scrollTop > 0 || el.scrollLeft > 0) out.push('굴림 ' + d(el) + ' ' + el.scrollLeft + ',' + el.scrollTop)
  return out.join(' | ')
})()`
/** 화면이 바뀌었는지 — 보이는 글과 누를 거리 수 */
const SIG = `(() => { const t = document.body.innerText; let h = 0; for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) | 0; return h + ':' + document.querySelectorAll('button, [data-act]').length })()`

async function click(x: number, y: number, hold = 0): Promise<void> {
  await cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y })
  await cdp('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 })
  if (hold > 0) await sleep(hold)
  await cdp('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 })
}
async function wheel(x: number, y: number, dy: number): Promise<void> {
  await cdp('Input.dispatchMouseEvent', { type: 'mouseWheel', x, y, deltaX: 0, deltaY: dy })
}
async function shot(name: string): Promise<void> {
  const r = await cdp('Page.captureScreenshot', { format: 'png' })
  if (r?.data !== undefined) writeFileSync(join(OUT, name), Buffer.from(r.data, 'base64'))
}

const log: string[] = []
const stuck: string[] = []
const left: string[] = []
const hits = new Map<string, number>()
const seen = new Set<string>()
let lastSig = '', same = 0, empty = 0, fresh = 0
for (step = 1; step <= STEPS; step++) {
  const href = await ev<string>('location.href')
  if (href === undefined || !href.startsWith(URL0.split('?')[0]!)) {
    left.push(`#${step} ${href}`)
    await cdp('Page.navigate', { url: URL0 }); await sleep(3000); continue
  }
  const c = (await ev<Array<{ x: number; y: number; t: string }>>(PICK)) ?? []
  let what: string
  for (const k of c) if (!seen.has(k.t)) { seen.add(k.t); fresh = step }
  if (rnd() < 0.08) {
    // 사람은 밀어 내린다 — 아래에 숨은 단추를 찾는다
    const x = Math.floor(rnd() * W), y = Math.floor(rnd() * H), dy = rnd() < 0.7 ? 500 : -500
    await wheel(x, y, dy)
    what = `밀기 ${dy > 0 ? '아래' : '위'} ${x},${y}`
  } else if (c.length === 0 || rnd() < 0.06) {
    // 빈 곳도 누른다 — 사람은 지도·바깥을 누른다
    const x = Math.floor(rnd() * W), y = Math.floor(rnd() * H)
    await click(x, y)
    what = `빈곳 ${x},${y}`
    empty = c.length === 0 ? empty + 1 : 0
  } else {
    empty = 0
    const k = c[Math.floor(rnd() * c.length)]!
    const hold = rnd() < 0.05 ? 700 : 0
    await click(k.x, k.y, hold)
    what = `${hold > 0 ? '꾹 ' : ''}${k.t}`
    hits.set(k.t, (hits.get(k.t) ?? 0) + 1)
  }
  log.push(`#${step} ${what}`)
  await sleep(120 + Math.floor(rnd() * 300))
  const sig = await ev<string>(SIG)
  if (sig === lastSig) same++
  else { same = 0; lastSig = sig }
  if (same === STALL || empty === 15 || step - fresh === LOOP) {
    const why = same === STALL ? `${STALL}번 눌러도 화면 그대로` : empty === 15 ? '누를 거리가 하나도 없다' : `${LOOP}번 동안 새 누를 거리가 없다 (맴돎)`
    stuck.push(`#${step} ${why} — 마지막: ${log.slice(-6).join(' / ')}
  살핌: ${await ev<string>(DIAG)}`)
    await shot(`stuck-${step}.png`)
    // 사람은 여기서 나간다 — 새로 고쳐 이어 간다 (저장은 그대로)
    await cdp('Page.reload'); await sleep(3000); same = 0; empty = 0; fresh = step
  }
  if (step % 250 === 0) { await shot(`at-${step}.png`); console.log(`${step}/${STEPS} 오류 ${errors.length} 갇힘 ${stuck.length}`) }
}

const uniq = [...new Set(errors.map((e) => e.replace(/^#\d+ /, '')))]
const top = [...hits.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25).map(([t, n]) => `${n}\t${t}`)
const rep = [`막무가내 로봇 · 씨앗 ${SEED} · ${W}×${H} · ${STEPS}번`, '',
  `## 오류 ${errors.length} (서로 다른 것 ${uniq.length})`, ...uniq.map((e) => `- ${e} (처음 ${errors.find((x) => x.endsWith(e))?.split(' ')[0]})`), '',
  `## 갇힘 ${stuck.length}`, ...stuck.map((x) => `- ${x}`), '',
  `## 떠남 ${left.length}`, ...left.map((x) => `- ${x}`), '',
  '## 많이 누른 것', ...top, '', '## 누름 기록', ...log].join('\n')
writeFileSync(join(OUT, 'report.md'), rep)
console.log(rep.split('## 많이 누른 것')[0])
ws.close()
chrome.kill()
await sleep(500)
try { rmSync(prof, { recursive: true, force: true }) } catch { /* 크롬이 늦게 놓는다 */ }
