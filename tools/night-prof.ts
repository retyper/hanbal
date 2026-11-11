/**
 * 밤 판(암살·구출) 폰 렉 재기 — 헤드리스 크롬을 폰 크기·CPU 느리게(Emulation.setCPUThrottlingRate)로 띄워
 * 판을 열고, 활을 당기는 동안 프레임 시간과 CPU 프로파일(자기 시간 순)을 찍는다 (형 11-10: "구출 암살 활쏘기 아직도 엄청 버벅").
 *
 *   node --experimental-strip-types tools/night-prof.ts [주소] [CPU 배수 6]
 *   기본 주소: http://localhost:5174/night.html?kind=rescue&seed=7&arrows=20&bow=0&guard=1&who=x
 *   STAGE=2 — 셋째 판(마루·묶인 장수)부터 · DPR=3 — 기기 화소 비
 *   SAVE='판 json'(tools/phone-save.ts) — 칠십팔국 판을 열고 그 위에 밤 판을 틀(.nightov)로 띄운다 (게임에서 여는 길 그대로 · 같은 주 스레드)
 *   HUSH=1 — 그때 밑 지도의 SVG 애니(SMIL)를 멈춰 본다 (전후 비교)
 *
 * 런타임 의존성 없음 — phone-shot.ts 와 같은 CDP 길.
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const URL0 = process.argv[2] ?? 'http://localhost:5174/night.html?kind=rescue&seed=7&arrows=20&bow=0&guard=1&who=x'
const RATE = Number(process.argv[3] ?? 6)
const W = 915
const H = 412
const DPR = Number(process.env['DPR'] ?? 3)
const PORT = 9450 + Math.floor(Math.random() * 40)
const CHROMES = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe']
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

const exe = CHROMES.find((p) => existsSync(p))
if (exe === undefined) throw new Error('크롬을 못 찾았다')
const prof = mkdtempSync(join(tmpdir(), 'nprof-'))
const chrome = spawn(exe, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${prof}`, `--window-size=${W},${H}`, '--no-first-run', '--mute-audio', 'about:blank'], { stdio: 'ignore' })
try {
  let tabs: any = null
  for (let i = 0; i < 50 && tabs === null; i++) { try { tabs = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json() } catch { await sleep(200) } }
  const page = tabs.find((t: any) => t.type === 'page')
  const ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j })
  let id = 0
  const waits = new Map<number, (v: any) => void>()
  ws.onmessage = (ev) => { const m = JSON.parse(String(ev.data)); if (m.method === 'Runtime.exceptionThrown') console.log('예외', m.params.exceptionDetails?.exception?.description?.slice(0, 300)); if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') console.log('콘솔', JSON.stringify(m.params.args?.[0]?.value ?? m.params.args?.[0]?.description).slice(0, 300)); if (m.id !== undefined) { waits.get(m.id)?.(m.result ?? m.error); waits.delete(m.id) } }
  const call = (method: string, params: object = {}): Promise<any> => new Promise((r) => { const k = ++id; waits.set(k, r); ws.send(JSON.stringify({ id: k, method, params })) })
  const ev = async (expression: string): Promise<any> => (await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result?.value
  await call('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: DPR, mobile: true })
  await call('Page.enable'); await call('Runtime.enable')
  const save = process.env['SAVE']
  // W 는 틀 안 창 — 칠십팔국 위에 띄웠으면 그 iframe 의 창
  let W0 = 'window'
  if (save !== undefined && save !== '') {
    const base = new URL(URL0)
    await call('Page.navigate', { url: `${base.origin}/realm.html` })
    await sleep(3000)
    await ev(`localStorage.setItem('hanbal.realm.v2', ${JSON.stringify(readFileSync(save, 'utf8'))})`)
    await call('Page.reload')
    await sleep(8000)
    await ev(`(() => { const root = document.querySelector('.ap'); const ov = document.createElement('div'); ov.className = 'nightov'; ov.innerHTML = '<iframe src="${base.pathname}${base.search}"></iframe>'; root.appendChild(ov) })()`)
    await sleep(5000)
    if (process.env['HUSH'] === '1') console.log('멈춘 svg', await ev(`(() => { let n = 0; for (const s of document.querySelectorAll('.ap svg')) { s.pauseAnimations(); n++ } return n })()`))
    console.log('지도 SMIL', await ev(`document.querySelectorAll('.ap animate, .ap animateMotion').length`), '· 무한 CSS 애니', await ev(`document.getAnimations().length`), '· canvas', await ev(`document.querySelectorAll('.ap canvas').length`))
    W0 = `document.querySelector('.nightov iframe').contentWindow`
  } else {
    await call('Page.navigate', { url: URL0 })
    await sleep(4000)
  }
  for (let i = 0; i < 60; i++) { if (await ev(`!!${W0}.document.querySelector('[data-act=go]')`)) break; await sleep(500) }
  await ev(`${W0}.document.querySelector('[data-act=go]')?.click()`)
  await sleep(2500)
  console.log('판', await ev(`!!${W0}.__night?.() + ' hidden=' + ${W0}.document.hidden + ' ui=' + ${W0}.document.getElementById('night-ui').innerText.slice(0,40)`))
  const stage = Number(process.env['STAGE'] ?? 0)
  if (stage > 0) await ev(`(() => { const n = ${W0}.__night?.(); if (n) { n.stage = ${stage} } })()`)
  await call('Emulation.setCPUThrottlingRate', { rate: RATE })
  // 프레임 시간 — rAF 사이 간격
  await ev(`(() => { const w = ${W0}; w.__ft = []; let last = 0; const f = (t) => { if (last) w.__ft.push(t - last); last = t; if (w.__ft.length < 2000) w.requestAnimationFrame(f) }; w.requestAnimationFrame(f) })()`)
  await call('Profiler.enable')
  await call('Profiler.setSamplingInterval', { interval: 200 })
  await call('Profiler.start')
  // 활 당기기 — 화면 오른쪽에서 눌러 왼쪽 아래로 끌다가(겨눔) 놓기를 두 번
  for (let k = 0; k < 2; k++) {
    const x0 = W * 0.6
    const y0 = H * 0.5
    await call('Input.dispatchMouseEvent', { type: 'mousePressed', x: x0, y: y0, button: 'left', clickCount: 1 })
    for (let i = 0; i < 40; i++) {
      await call('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x0 - i * 4, y: y0 + i * 2, button: 'left', buttons: 1 })
      await sleep(40)
    }
    await sleep(600)
    await call('Input.dispatchMouseEvent', { type: 'mouseReleased', x: x0 - 160, y: y0 + 80, button: 'left', clickCount: 1 })
    await sleep(1200)
  }
  const { profile } = await call('Profiler.stop')
  const ft: number[] = (await ev(`${W0}.__ft`)) ?? []
  const s = [...ft].sort((a, b) => a - b)
  const q = (p: number): string => (s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))]!.toFixed(1) : '-')
  console.log(`CPU ×${RATE} · DPR ${DPR} · 프레임 ${ft.length}개 · 중앙 ${q(0.5)}ms · 90% ${q(0.9)}ms · 99% ${q(0.99)}ms · 33ms 넘음 ${ft.filter((x) => x > 33).length}`)
  // 자기 시간 — 샘플 수 × 간격
  const self = new Map<string, number>()
  const byId = new Map<number, any>(profile.nodes.map((n: any) => [n.id, n]))
  const dt: number[] = profile.timeDeltas
  profile.samples.forEach((sid: number, i: number) => {
    const n = byId.get(sid)
    const cf = n.callFrame
    const key = `${cf.functionName || '(anon)'} ${cf.url.split('/').pop()}:${cf.lineNumber + 1}`
    self.set(key, (self.get(key) ?? 0) + (dt[i] ?? 0) / 1000)
  })
  const total = [...self.values()].reduce((a, b) => a + b, 0)
  for (const [k, v] of [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25)) console.log(`${v.toFixed(0).padStart(6)}ms ${(100 * v / total).toFixed(1).padStart(5)}%  ${k}`)
  ws.close()
} finally {
  chrome.kill()
  await sleep(500)
  try { rmSync(prof, { recursive: true, force: true }) } catch { /* 크롬이 아직 잡고 있다 */ }
}
