/**
 * 큰 판 지도 버벅임 재기 (카드 C · 형 11-11: "맵이 어느 정도 커져 버렸을 때 뭘 해도 프레임 드랍")
 *
 * 큰 판(세계판 world · 고을 100+)을 폰 크기(390x844@3) 헤드리스 크롬에 CPU 를 느리게 해서 넣고, 동작마다
 *   프레임 간격(rAF 가운데·95%) · 50ms 넘는 긴 작업 · 메인 스레드 바쁨 · Layout/UpdateLayoutTree/Paint 시간 · DOM 수
 * 를 적는다.  동작: ① 가까이 밀기(scroll) · ② 멀리 밀기 · ③ 확대 · ④ 축소 · ⑤ 고을 탭 → 닫기(선택 해제) · ⑥ 다음 달
 *
 *   node --experimental-strip-types tools/map-perf.ts [판 json 기본 tools/out/fl-save-w24-all.json] [CPU 느림 4] [주소 http://localhost:5176/realm.html]
 *   PROF=1 — 동작마다 JS 프로파일(자기 시간 큰 함수 8)도 적는다 · SHOT='png 앞이름' — 시작 · 멀리 · 다음 달 뒤 화면을 찍는다
 *
 * 런타임 의존성 없음 — CDP 를 Node 내장 WebSocket 으로 (tools/realm-zoomperf.ts · war-perf.ts 와 같은 길).
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const SAVE = readFileSync(process.argv[2] ?? 'tools/out/fl-save-w24-all.json', 'utf8')
const SLOW = Number(process.argv[3] ?? 4)
const URL0 = process.argv[4] ?? 'http://localhost:5176/realm.html'
const W = 390
const H = 844
const PORT = 9500 + Math.floor(Math.random() * 40)
const CHROMES = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe']
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

const exe = CHROMES.find((p) => existsSync(p))
if (exe === undefined) throw new Error('크롬을 못 찾았다')
const prof = mkdtempSync(join(tmpdir(), 'mperf-'))
const chrome = spawn(exe, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${prof}`, `--window-size=${W},${H}`, '--no-first-run', '--mute-audio', 'about:blank'], { stdio: 'ignore' })
try {
  let tabs: any = null
  for (let i = 0; i < 50 && tabs === null; i++) { try { tabs = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json() } catch { await sleep(200) } }
  const page = tabs.find((t: any) => t.type === 'page')
  const ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
  let id = 0
  const waits = new Map<number, (v: any) => void>()
  let traceBuf: any[] = []
  let traceDone: (() => void) | null = null
  ws.onmessage = (ev) => {
    const m = JSON.parse(String(ev.data))
    if (m.id !== undefined) { waits.get(m.id)?.(m.result ?? m.error); waits.delete(m.id); return }
    if (m.method === 'Tracing.dataCollected') traceBuf.push(...m.params.value)
    if (m.method === 'Tracing.tracingComplete') traceDone?.()
  }
  const call = (method: string, params: object = {}): Promise<any> => new Promise((res) => { const k = ++id; waits.set(k, res); ws.send(JSON.stringify({ id: k, method, params })) })
  const js = async (expression: string): Promise<any> => (await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result?.value

  await call('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 3, mobile: true })
  await call('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 })
  await call('Page.enable')
  await call('Page.navigate', { url: URL0 })
  await sleep(3000)
  await js(`localStorage.setItem('hanbal.realm.v2', ${JSON.stringify(SAVE)}); 1`)
  await call('Page.reload')
  await sleep(6000)
  await js(`(() => { document.querySelector('[data-act="continue"]')?.click(); return 1 })()`)
  await sleep(2500)
  for (let i = 0; i < 4; i++) {
    await js(`(() => { for (const s of ['[data-act="rep-close"]', '.plbox [data-act]', '.modal [data-act]', '.sheet [data-act="close"]', '[data-act="close"]']) document.querySelector(s)?.click(); return 1 })()`)
    await sleep(600)
  }
  if (await js(`document.querySelector('.mapwrap .map') === null`)) throw new Error('지도가 안 열렸다 — 저장을 못 읽었다')
  const shot = async (name: string): Promise<void> => {
    if (process.env['SHOT'] === undefined) return
    const r = await call('Page.captureScreenshot', { format: 'png' })
    writeFileSync(`${process.env['SHOT']}-${name}.png`, Buffer.from(r.data, 'base64'))
  }
  await js(`(() => {
    window.__z = { fr: [], on: false, last: 0 }
    window.__z.tick = (t) => { const z = window.__z; if (!z.on) { z.last = 0; return } if (z.last > 0) z.fr.push(t - z.last); z.last = t; requestAnimationFrame(z.tick) }
    return 1
  })()`)
  const census = async (): Promise<string> => js(`(() => {
    const w = document.querySelector('.mapwrap'); const m = w.querySelector('.map')
    const q = (s) => w.querySelectorAll(s).length
    return 'zl=' + m?.dataset.zl + ' DOM(지도 ' + w.querySelectorAll('*').length + ' · 전체 ' + document.querySelectorAll('*').length + ') 고을 ' + q('.nd') + '(cull ' + q('.nd.cull') + ') 이름표 ' + q('.lb') + ' 말 ' + q('.tok') + ' 애니 ' + document.getAnimations().filter((a) => a.playState === 'running').length
  })()`)

  const CATS = 'devtools.timeline,disabled-by-default-devtools.timeline' + (process.env['STACK'] === '1' ? ',disabled-by-default-devtools.timeline.stack' : '') + (process.env['INV'] === '1' ? ',disabled-by-default-devtools.timeline.invalidationTracking' : '')
  const SUM = ['Paint', 'UpdateLayoutTree', 'Layout', 'PrePaint', 'Layerize', 'Commit', 'FunctionCall']
  const measure = async (label: string, act: () => Promise<void>, raf = true): Promise<void> => {
    if (process.env['ONLY'] !== undefined && !label.includes(process.env['ONLY'])) return
    traceBuf = []
    const prof2 = process.env['PROF'] === '1'
    if (prof2) { await call('Profiler.enable'); await call('Profiler.setSamplingInterval', { interval: 500 }); await call('Profiler.start') }
    await call('Tracing.start', { categories: CATS, transferMode: 'ReportEvents' })
    await js(`window.__z.fr = []; window.__z.on = true; ${raf ? 'requestAnimationFrame(window.__z.tick);' : ''} 1`)
    const t0 = Date.now()
    await act()
    const wall = Date.now() - t0
    const z = await js('window.__z.on = false; window.__z')
    let top = ''
    if (prof2) {
      const p = (await call('Profiler.stop')).profile
      const self = new Map<number, number>()
      const dt: number[] = p.timeDeltas
      for (let i = 0; i < p.samples.length; i++) self.set(p.samples[i], (self.get(p.samples[i]) ?? 0) + (dt[i] ?? 0))
      const by = new Map<string, number>()
      for (const n of p.nodes) { const f = n.callFrame; const k = `${f.functionName || '(익명)'}@${String(f.url).split('/').pop()}:${f.lineNumber + 1}`; by.set(k, (by.get(k) ?? 0) + (self.get(n.id) ?? 0) / 1000) }
      top = [...by].filter(([k]) => !k.startsWith('(idle)') && !k.startsWith('(program)')).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => `    ${v.toFixed(0)}ms ${k}`).join('\n')
      // 안까지 합친 시간(inclusive) — 어느 함수 아래로 시간이 가나
      const kids = new Map<number, number[]>()
      for (const n of p.nodes) for (const c of n.children ?? []) kids.set(n.id, [...(kids.get(n.id) ?? []), c])
      const byId = new Map<number, any>(p.nodes.map((n: any) => [n.id, n]))
      const incl = (nid: number): number => (self.get(nid) ?? 0) / 1000 + (kids.get(nid) ?? []).reduce((a, c) => a + incl(c), 0)
      const inc = new Map<string, number>()
      const walk = (nid: number, seen: Set<string>): void => {
        const f = byId.get(nid).callFrame; const k = `${f.functionName || '(익명)'}@${String(f.url).split('/').pop()?.split('?')[0]}:${f.lineNumber + 1}`
        const fresh = !seen.has(k)
        if (fresh) { inc.set(k, (inc.get(k) ?? 0) + incl(nid)); seen.add(k) }
        for (const c of kids.get(nid) ?? []) walk(c, seen)
        if (fresh) seen.delete(k)
      }
      walk(p.nodes[0].id, new Set())
      top += '\n  -- 안까지 합친 시간\n' + [...inc].filter(([k]) => !k.startsWith('(root)') && !k.startsWith('(program)') && !k.startsWith('(idle)')).sort((a, b) => b[1] - a[1]).slice(0, 14).map(([k, v]) => `    ${v.toFixed(0)}ms ${k}`).join('\n')
    }
    const done = new Promise<void>((res) => { traceDone = res })
    await call('Tracing.end')
    await done
    const sums: Record<string, number> = {}
    for (const e of traceBuf) if (SUM.includes(e.name) && e.ph === 'X' && typeof e.dur === 'number') sums[e.name] = (sums[e.name] ?? 0) + e.dur / 1000
    const mainTid = traceBuf.find((e) => e.name === 'thread_name' && e.args?.name === 'CrRendererMain')?.tid
    const tasks = traceBuf.filter((e) => e.tid === mainTid && e.name === 'RunTask' && e.ph === 'X')
    const busy = tasks.reduce((a, e) => a + e.dur / 1000, 0)
    const long = tasks.filter((e) => e.dur > 50000)
    const longMs = long.reduce((a, e) => a + e.dur / 1000, 0)
    const biggest = tasks.reduce((a, e) => Math.max(a, e.dur / 1000), 0)
    // INV=1 — 스타일을 다시 세게 한 까닭(속성·클래스·가짜클래스 · 어느 요소) 별 횟수
    if (process.env['INV'] === '1') {
      const by = new Map<string, number>()
      for (const e of traceBuf) {
        if (e.name !== 'StyleRecalcInvalidationTracking' && e.name !== 'ScheduleStyleInvalidationTracking') continue
        const d = e.args?.data ?? {}
        const k = `${e.name.startsWith('Sched') ? '예약' : '재계산'} ${d.reason ?? ''} ${d.invalidationSet ?? ''} ${d.changedClass ?? d.changedAttribute ?? d.changedId ?? d.changedPseudo ?? ''} @${String(d.nodeName ?? '').slice(0, 40)}`
        by.set(k, (by.get(k) ?? 0) + 1)
      }
      for (const [k, v] of [...by].sort((a, b) => b[1] - a[1]).slice(0, 14)) console.log(`    ${v}× ${k}`)
    }
    // STACK=1 — 배치(Layout)·스타일 계산이 몇 번 · 얼마씩 · 누가 불렀나 (강제 배치 찾기)
    if (process.env['STACK'] === '1') {
      for (const nm of ['Layout', 'UpdateLayoutTree']) {
        const ev = traceBuf.filter((e) => e.name === nm && e.ph === 'X' && e.dur > 3000).sort((a, b) => b.dur - a.dur).slice(0, 6)
        for (const e of ev) {
          const st = e.args?.beginData?.stackTrace ?? e.args?.data?.stackTrace ?? []
          console.log(`    ${nm} ${(e.dur / 1000).toFixed(0)}ms 더럽힌 것 ${e.args?.beginData?.dirtyObjects ?? e.args?.elementCount ?? '?'} ← ${st.slice(0, 4).map((f: any) => `${f.functionName || '익명'}@${String(f.url).split('/').pop()?.split('?')[0]}:${f.lineNumber + 1}`).join(' ← ')}`)
        }
      }
    }
    const fr: number[] = [...z.fr].sort((a: number, b: number) => a - b)
    const q = (pp: number): number => fr[Math.min(fr.length - 1, Math.floor(fr.length * pp))] ?? 0
    const s = (k: string): string => (sums[k] ?? 0).toFixed(0)
    console.log(`[${label}] ${(wall / 1000).toFixed(1)}s · 메인 바쁨 ${busy.toFixed(0)}ms · 긴 작업(>50ms) ${long.length}개 ${longMs.toFixed(0)}ms · 가장 긴 ${biggest.toFixed(0)}ms`
      + (raf ? ` · 프레임 ${fr.length} 가운데 ${q(0.5).toFixed(1)}ms 95% ${q(0.95).toFixed(1)}ms 최대 ${q(1).toFixed(0)}ms` : '')
      + `\n    Layout ${s('Layout')} · Style ${s('UpdateLayoutTree')} · PrePaint ${s('PrePaint')} · Paint ${s('Paint')} · Layerize ${s('Layerize')} · JS ${s('FunctionCall')}\n    ${await census()}${top !== '' ? '\n' + top : ''}`)
  }

  await call('Emulation.setCPUThrottlingRate', { rate: SLOW })
  const nodes = await js(`Object.keys(JSON.parse(localStorage.getItem('hanbal.realm.v2')).realm.nodes).length`)
  console.log(`큰 판 · 고을 ${nodes} · CPU ${SLOW}배 느리게 · ${W}x${H}@3`)
  await shot('start')
  // PEEK='js 식' — 열린 판에서 식을 돌려 값만 적고 끝낸다 (무엇이 무거운지 들여다볼 때)
  if (process.env['PEEK'] !== undefined) { console.log(await js(process.env['PEEK'])); ws.close(); process.exit(0) }
  // COMP=1 — 어느 애니메이션이 GPU 로 못 가고 메인 스레드에서 도나 (realm-zoomperf.ts 와 같은 길) 적고 끝낸다
  if (process.env['COMP'] === '1') {
    traceBuf = []
    await call('Tracing.start', { categories: 'blink.animations,devtools.timeline,animation', transferMode: 'ReportEvents' })
    await js(`(() => { const s = document.createElement('style'); s.id = 'zre'; s.textContent = '.ap *, .ap *::before, .ap *::after { animation-name: none !important; }'; document.head.appendChild(s); document.body.offsetHeight; s.remove(); return 1 })()`)
    await sleep(1200)
    const done = new Promise<void>((res) => { traceDone = res })
    await call('Tracing.end')
    await done
    const names = new Map<string, string>()
    const fail = new Map<string, Set<string>>()
    for (const e of traceBuf) {
      if (e.name !== 'Animation') continue
      const d = e.args?.data ?? {}
      if (typeof d.displayName === 'string') names.set(e.id2?.local ?? e.id ?? '', `${d.displayName}@${String(d.nodeName ?? '').slice(0, 30)}`)
      if (d.compositeFailed !== undefined && d.compositeFailed !== 0) {
        const k = e.id2?.local ?? e.id ?? ''
        const s = fail.get(k) ?? new Set<string>()
        s.add(`${d.compositeFailed}${Array.isArray(d.unsupportedProperties) ? ':' + d.unsupportedProperties.join('/') : ''}`)
        fail.set(k, s)
      }
    }
    const by = new Map<string, number>()
    for (const [k, s] of fail) { const key = `${names.get(k) ?? '?'} [${[...s].join(',')}]`; by.set(key, (by.get(key) ?? 0) + 1) }
    console.log(`메인 스레드에서 도는 애니메이션 (GPU 못 감): ${[...by].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}×${v}`).join(' · ') || '없음'}`)
    ws.close(); process.exit(0)
  }
  // CSS='규칙' — 시험용 스타일을 끼운다 (어느 무리가 무거운지 가를 때)
  if (process.env['CSS'] !== undefined) await js(`(() => { const s = document.createElement('style'); s.textContent = ${JSON.stringify(process.env['CSS'])}; document.head.appendChild(s); return 1 })()`)
  const scroll = async (dx: number, dy: number): Promise<void> => {
    await call('Input.synthesizeScrollGesture', { x: W / 2, y: H / 2, xDistance: dx, yDistance: dy, speed: 700, gestureSourceType: 'touch' })
    await sleep(500)
  }
  const pinch = async (scale: number): Promise<void> => {
    await call('Input.synthesizePinchGesture', { x: W / 2, y: H / 2, scaleFactor: scale, relativeSpeed: 300, gestureSourceType: 'touch' })
    await sleep(700)
  }
  await measure('① 가까이 · 가만히 3초', () => sleep(3000), false)
  await measure('① 가까이 · 밀기', async () => { await scroll(-250, -250); await scroll(250, 100) })
  await measure('③ 확대(벌리기)', () => pinch(1.8))
  await sleep(1200)
  await measure('④ 축소(오므리기 2번)', async () => { await pinch(0.5); await pinch(0.5) })
  await sleep(1500)
  await shot('far')
  await measure('② 멀리 · 가만히 3초', () => sleep(3000), false)
  await measure('② 멀리 · 밀기', async () => { await scroll(-250, -250); await scroll(250, 100) })
  // ⑤ 고을 탭 → 닫기 — 눈에 보이는 고을 하나를 눌러 판을 열고, 닫는다
  await measure('⑤ 고을 탭 → 닫기', async () => {
    await js(`(() => { const w = document.querySelector('.mapwrap'); const b = w.getBoundingClientRect(); const e = [...w.querySelectorAll('.nd:not(.cull)')].find((n) => { const r = n.getBoundingClientRect(); return r.left > b.left + 40 && r.right < b.right - 40 && r.top > b.top + 60 && r.bottom < b.bottom - 60 }); (e ?? w.querySelector('.nd:not(.cull)')).click(); return 1 })()`)
    await sleep(900)
    await js(`(() => { for (const s of ['.sheet [data-act="close"]', '[data-act="close"]']) { const e = document.querySelector(s); if (e) { e.click(); break } } return 1 })()`)
    await sleep(900)
  }, false)
  await measure('⑥ 다음 달', async () => {
    await js(`document.querySelector('[data-act="next"]')?.click(); 1`)
    await sleep(3500)
  }, false)
  await shot('next')
  ws.close()
} finally {
  chrome.kill()
  await sleep(500)
  try { rmSync(prof, { recursive: true, force: true }) } catch { /* 크롬이 아직 잡고 있다 */ }
}
