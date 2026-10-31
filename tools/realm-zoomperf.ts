/**
 * 지도 확대·축소의 무게 — 폰에서 "멀리 보면 버벅이고 두 손가락으로 늘리면 버벅인다" (형 10-31) 를 숫자로 잰다.
 *
 * 넓은 판(삼한 · 안개 걷음)을 몇 계절 돌린 저장을 만들어, 폰 크기 헤드리스 크롬(CPU 를 느리게)에 넣고
 *   ① 멀리 본 채 가만히 · ② 가까이 본 채 가만히 · ③ 두 손가락 오므리기 · ④ 벌리기 · ⑤ 미는 중(스크롤)
 * 마다 프레임 간격(rAF)과 크롬 기록(Paint·Raster·스타일·배치 시간)을 모은다. 지도 칸의 DOM 수 · 도는 애니메이션 수도 센다.
 *
 *   node --experimental-strip-types tools/realm-zoomperf.ts [판 south] [계절 16] [CPU 느림 배수 4] [주소 http://localhost:5174/realm.html]
 *   FOG=1 — 안개를 걷지 않는다 (처음 판처럼)
 *
 * 런타임 의존성 없음 — CDP 를 Node 내장 WebSocket 으로 (tools/phone-shot.ts 와 같은 길). 5173 은 형 자리라 5174 를 쓴다.
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { aiOrders, decide } from '../src/realm/ai.ts'
import { startRegion } from '../src/realm/data/regions/index.ts'
import { advance } from '../src/realm/season.ts'
import type { Realm, RegionId } from '../src/realm/types.ts'

const REGION = (process.argv[2] ?? 'south') as RegionId
const SEASONS = Number(process.argv[3] ?? 16)
const SLOW = Number(process.argv[4] ?? 4)
const URL0 = process.argv[5] ?? 'http://localhost:5174/realm.html'
const W = 390
const H = 844
const PORT = 9450 + Math.floor(Math.random() * 40)
const CHROMES = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe']
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

// ── 판 만들기 — 계절을 돌려 군대가 움직이고 화살이 생기게
let r: Realm = startRegion(REGION, 7, 'us')
for (let s = 0; s < SEASONS && !r.outcome; s++) r = advance(r, [...decide(r, r.player, 'planner'), ...aiOrders(r)]).next
if (process.env['FOG'] !== '1') delete r.known
const save = JSON.stringify({ v: 2, nation: 'us', seed: 7, log: [], realm: r, before: null, report: null })
// SAVEOUT='json 파일' — 그 판만 써 두고 끝낸다 (tools/phone-shot.ts 의 SAVE 로 찍어 본다)
if (process.env['SAVEOUT'] !== undefined && process.env['SAVEOUT'] !== '') { writeFileSync(process.env['SAVEOUT'], save); process.exit(0) }

const exe = CHROMES.find((p) => existsSync(p))
if (exe === undefined) throw new Error('크롬을 못 찾았다')
const prof = mkdtempSync(join(tmpdir(), 'zperf-'))
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
  await js(`localStorage.setItem('hanbal.realm.v2', ${JSON.stringify(save)}); 1`)
  await call('Page.reload')
  await sleep(5000)
  // 서막·튜토리얼 띠가 있으면 닫는다 — 지도만 남게
  await js(`(() => { document.querySelector('[data-act="continue"]')?.click(); return 1 })()`)
  await sleep(2500)
  for (let i = 0; i < 4; i++) {
    await js(`(() => { for (const s of ['.plbox [data-act]', '.modal [data-act]', '.sheet [data-act="close"]', '[data-act="close"]']) document.querySelector(s)?.click(); return 1 })()`)
    await sleep(600)
  }
  if (await js(`document.querySelector('.mapwrap .map') === null`)) throw new Error('지도가 안 열렸다 — 저장을 못 읽었다')

  // 쪽 안의 잣대 — 프레임 간격 · 지도 칸이 갈렸나(MutationObserver)
  await js(`(() => {
    // rAF 잣대는 손짓을 잴 때만 돈다 — 가만히 있을 때 돌리면 그 자체가 메인 프레임을 매번 불러 애니메이션 스타일 계산을 부풀린다
    window.__z = { fr: [], on: false, mut: 0, maps: 0, last: 0 }
    window.__z.tick = (t) => { const z = window.__z; if (!z.on) { z.last = 0; return } if (z.last > 0) z.fr.push(t - z.last); z.last = t; requestAnimationFrame(z.tick) }
    const w = document.querySelector('.mapwrap')
    new MutationObserver((ms) => { if (!window.__z.on) return; for (const m of ms) { window.__z.mut++; if (m.type === 'childList' && [...m.addedNodes].some((n) => n.classList?.contains('map'))) window.__z.maps++ } }).observe(w, { subtree: true, childList: true, attributes: true })
    return 1
  })()`)

  const census = async (): Promise<any> => js(`(() => {
    const w = document.querySelector('.mapwrap'); const m = w.querySelector('.map')
    const anims = document.getAnimations().filter((a) => a.playState === 'running')
    const by = {}
    for (const a of anims) { const k = a.animationName ?? a.constructor.name; by[k] = (by[k] ?? 0) + 1 }
    const top = Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, v]) => k + ':' + v).join(' ')
    const svgAn = anims.filter((a) => a.effect?.target instanceof SVGElement).length
    return { zl: m?.dataset.zl, z: Number(m?.style.getPropertyValue('--z')).toFixed(2), mapH: m?.offsetHeight, dom: w.querySelectorAll('*').length, all: document.querySelectorAll('*').length, anims: anims.length, svgAnims: svgAn, top }
  })()`)

  const CATS = 'devtools.timeline,disabled-by-default-devtools.timeline,disabled-by-default-devtools.timeline.frame,cc,viz,blink'
  const SUM = ['Paint', 'RasterTask', 'UpdateLayoutTree', 'Layout', 'PrePaint', 'Layerize', 'Commit', 'FunctionCall', 'ParseHTML', 'Decode Image', 'ImageDecodeTask']
  const measure = async (label: string, act: () => Promise<void>, raf = true): Promise<void> => {
    traceBuf = []
    await call('Tracing.start', { categories: CATS, transferMode: 'ReportEvents' })
    await js(`window.dispatchEvent(new PointerEvent('pointermove')); window.__z.fr = []; window.__z.mut = 0; window.__z.maps = 0; window.__z.on = true; ${raf ? 'requestAnimationFrame(window.__z.tick);' : ''} 1`)
    const t0 = Date.now()
    await act()
    const wall = Date.now() - t0
    const z = await js('window.__z.on = false; window.__z')
    const done = new Promise<void>((res) => { traceDone = res })
    await call('Tracing.end')
    await done
    const sums: Record<string, number> = {}
    const counts: Record<string, number> = {}
    for (const e of traceBuf) {
      if (!SUM.includes(e.name) || e.ph !== 'X' || typeof e.dur !== 'number') continue
      sums[e.name] = (sums[e.name] ?? 0) + e.dur / 1000
      counts[e.name] = (counts[e.name] ?? 0) + 1
    }
    const fr: number[] = [...z.fr].sort((a: number, b: number) => a - b)
    const q = (p: number): number => fr[Math.min(fr.length - 1, Math.floor(fr.length * p))] ?? 0
    const fps = fr.length / (fr.reduce((a, b) => a + b, 0) / 1000 || 1)
    const sec = wall / 1000
    const per = (k: string): string => `${k} ${((sums[k] ?? 0) / sec).toFixed(0)}ms/s(${counts[k] ?? 0})`
    const mainTid = traceBuf.find((e) => e.name === 'thread_name' && e.args?.name === 'CrRendererMain')?.tid
    const busy = traceBuf.filter((e) => e.tid === mainTid && e.name === 'RunTask' && e.ph === 'X').reduce((a, e) => a + e.dur / 1000, 0)
    const mainFrames = traceBuf.filter((e) => e.tid === mainTid && e.name === 'PrePaint' && e.ph === 'X').length
    const draws = traceBuf.filter((e) => e.name === 'Display::DrawAndSwap').length
    console.log(`\n[${label}] ${sec.toFixed(1)}s · 메인 스레드 ${(busy / wall * 100).toFixed(0)}% 바쁨 · 메인 프레임 ${(mainFrames / sec).toFixed(0)}/s · 화면 그림 ${(draws / sec).toFixed(0)}/s`
      + (raf ? ` · rAF ${fr.length} · ${fps.toFixed(1)}fps · 가운데 ${q(0.5).toFixed(1)}ms · 95% ${q(0.95).toFixed(1)}ms · 가장 김 ${q(1).toFixed(0)}ms · 33ms 넘은 것 ${fr.filter((x) => x > 33.4).length}` : ''))
    console.log(`  ${['Paint', 'RasterTask', 'UpdateLayoutTree', 'Layout', 'PrePaint', 'Layerize', 'Commit', 'FunctionCall'].map(per).join(' · ')}`)
    console.log(`  DOM 바뀜 ${z.mut} · 지도 새로 깖 ${z.maps}`)
    // 가장 긴 메인 스레드 일 셋 — 그 안에서 무엇이 시간을 먹었나
    const tasks = traceBuf.filter((e) => e.tid === mainTid && e.name === 'RunTask' && e.ph === 'X').sort((a, b) => b.dur - a.dur).slice(0, 3)
    const KIDS = ['UpdateLayoutTree', 'Layout', 'Paint', 'PrePaint', 'Layerize', 'Commit', 'FunctionCall', 'EventDispatch', 'TimerFire', 'FireAnimationFrame', 'HitTest', 'ParseHTML', 'RecalculateStyles']
    for (const t of tasks) {
      const kid: Record<string, number> = {}
      for (const e of traceBuf) {
        if (e.tid !== mainTid || e.ph !== 'X' || !KIDS.includes(e.name) || e.ts < t.ts || e.ts + e.dur > t.ts + t.dur) continue
        const k = e.name === 'FunctionCall' || e.name === 'EventDispatch' || e.name === 'TimerFire' || e.name === 'FireAnimationFrame' ? `${e.name}(${e.args?.data?.type ?? e.args?.data?.functionName ?? ''})` : e.name
        kid[k] = Math.max(kid[k] ?? 0, 0) + e.dur / 1000
      }
      console.log(`  긴 일 ${(t.dur / 1000).toFixed(0)}ms: ${Object.entries(kid).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => `${k} ${v.toFixed(0)}`).join(' · ')}`)
    }
    console.log(`  ${JSON.stringify(await census())}`)
  }

  await call('Emulation.setCPUThrottlingRate', { rate: SLOW })
  const pinch = async (scale: number): Promise<void> => {
    await call('Input.synthesizePinchGesture', { x: W / 2, y: H / 2, scaleFactor: scale, relativeSpeed: 300, gestureSourceType: 'touch' })
    await sleep(600)
  }
  const btn = async (act: string, n: number): Promise<void> => { for (let i = 0; i < n; i++) { await js(`document.querySelector('[data-act="${act}"]').click(); 1`); await sleep(450) } }

  console.log(`판 ${REGION} · ${SEASONS}계절 · 고을 ${Object.keys(r.nodes).length} · 군대 ${Object.keys(r.armies).length} · 안개 ${process.env['FOG'] === '1' ? '있음' : '걷음'} · CPU ${SLOW}배 느리게 · ${W}x${H}@3`)
  await btn('zout', 6) // 가장 멀리
  await sleep(1500)
  // EXP=1 — 멀리 본 채 애니메이션 무리를 하나씩 끄며 무엇이 무거운지 가른다
  // 어느 애니메이션이 GPU 로 못 가고 메인 스레드에서 도나 — 애니메이션을 한 번 끊었다 다시 걸며 크롬 기록의 compositeFailed 를 모은다
  {
    traceBuf = []
    await call('Tracing.start', { categories: 'blink.animations,devtools.timeline,animation', transferMode: 'ReportEvents' })
    await js(`(() => { const s = document.createElement('style'); s.id = 'zre'; s.textContent = '.ap *, .ap *::before, .ap *::after { animation-name: none !important; }'; document.head.appendChild(s); document.body.offsetHeight; s.remove(); return 1 })()`)
    await sleep(1200)
    const done = new Promise<void>((res) => { traceDone = res })
    await call('Tracing.end')
    await done
    if (process.env['DBG'] === '1') console.log(JSON.stringify(traceBuf.filter((e) => e.name === 'Animation').slice(0, 6)))
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
  }
  // LAYOUT=1 — 손짓의 어느 한 줄이 배치(layout)를 통째로 다시 하게 하나 — 하나씩 바꾸고 강제로 재 본다
  if (process.env['LAYOUT'] === '1') {
    console.log(await js(`(() => {
      const w = document.querySelector('.mapwrap'); const m = w.querySelector('.map')
      const t = (name, f) => { w.offsetHeight; const a = performance.now(); f(); w.getBoundingClientRect(); w.offsetHeight; return name + ' ' + (performance.now() - a).toFixed(1) + 'ms' }
      const out = []
      out.push(t('아무것도', () => {}))
      let an = []
      out.push(t('애니 멈춤 (getAnimations.pause)', () => { an = m.getAnimations({ subtree: true }); for (const a of an) a.pause() }))
      out.push(t('애니 다시 (play) ×' + an.length, () => { for (const a of an) a.play() }))
      const st = document.createElement('style')
      st.textContent = '.mapwrap.pan2 .map .nd :is(.smk, .st, .sc, .sp, .sg, .stl, .ring, .burnfx, .burnsm, .plant, .cloth, .wonring, .mgem, .g3), .mapwrap.pan2 .map .nd :is(.smk, .stl)::after { animation-play-state: paused !important; }'
      document.head.appendChild(st)
      out.push(t('좁힌 멈춤 클래스 켬', () => w.classList.add('pan2')))
      out.push(t('좁힌 멈춤 클래스 끔', () => w.classList.remove('pan2')))
      st.remove()
      out.push(t('아무 규칙 없는 클래스 켬', () => w.classList.add('pan3')))
      out.push(t('panning 켬', () => w.classList.add('panning')))
      out.push(t('will-change', () => { m.style.willChange = 'transform' }))
      out.push(t('transform-origin', () => { m.style.transformOrigin = '100px 100px' }))
      out.push(t('transform 처음', () => { m.style.transform = 'translate(1px, 1px) scale(1.05)' }))
      out.push(t('transform 바꿈', () => { m.style.transform = 'translate(2px, 1px) scale(1.07)' }))
      out.push(t('transform 지움', () => { m.style.transform = '' }))
      out.push(t('will-change 지움', () => { m.style.willChange = '' }))
      out.push(t('panning 끔', () => w.classList.remove('panning')))
      const h0 = m.style.height
      out.push(t('높이 바꿈', () => { m.style.height = (parseFloat(h0) * 1.1) + '%' }))
      out.push(t('--z 바꿈', () => { m.style.setProperty('--z', '0.7'); m.style.setProperty('--zs', String(Math.sqrt(0.7))) }))
      out.push(t('data-zl 바꿈', () => { m.dataset.zl = m.dataset.zl === 'far' ? 'near' : 'far' }))
      out.push(t('data-zl 되돌림', () => { m.dataset.zl = m.dataset.zl === 'far' ? 'near' : 'far' }))
      // 굳히기(commit)와 같은 한 벌 — 높이 · --z · data-zl 을 함께 바꾸고 잰다. 어느 덩어리가 배치를 무겁게 하나: 미리 숨겨 두고 다시 잰다
      let flip = 1.3
      const full = () => { flip = 1 / flip; m.style.height = (parseFloat(m.style.height) * flip) + '%'; const z = Number(m.style.getPropertyValue('--z')) * flip; m.style.setProperty('--z', String(z)); m.style.setProperty('--zs', String(Math.sqrt(z))) }
      out.push(t('굳히기 한 벌', full))
      out.push(t('굳히기 한 벌 (다시)', full))
      const kids = [...m.children].map((e) => e.tagName.toLowerCase() + '.' + String(e.getAttribute('class') ?? '').split(' ')[0])
      out.push('지도 칸의 아이들: ' + kids.join(' '))
      for (const [nm, sel] of [['땅 svg', '.map > svg:not(.marr)'], ['바탕 그림', '.map > img, .map > .bg'], ['이름표', '.map .lbs'], ['고을', '.map .nd'], ['군대 말', '.map .toks'], ['화살 svg', '.map svg.marr']]) {
        const els = [...m.querySelectorAll(sel)]
        els.forEach((e) => { e.style.display = 'none' })
        w.offsetHeight
        out.push(t('굳히기 한 벌 (' + nm + ' ' + els.length + ' 숨김)', full))
        els.forEach((e) => { e.style.display = '' })
        w.offsetHeight
      }
      return out.join('\\n')
    })()`))
    ws.close()
    process.exit(0)
  }
  if (process.env['EXP'] === '1') {
    const exps: Array<[string, string]> = [
      ['그대로', ''],
      ['병사 그림띠(mqidle) 멈춤', '.map .tok .sq u { animation-play-state: paused !important; }'],
      ['mglow 끔', '.map svg .mine-edge { animation: none !important; }'],
      ['병사 그림띠 + mglow', '.map .tok .sq u { animation-play-state: paused !important; } .map svg .mine-edge { animation: none !important; }'],
      ['병사 그림띠 + mglow + seasonp', '.map .tok .sq u { animation-play-state: paused !important; } .map svg .mine-edge { animation: none !important; } .ap .seasonp { display: none !important; }'],
      ['seasonp 끔', '.ap .seasonp { display: none !important; }'],
      ['지도 애니 모두 멈춤', '.mapwrap .map, .mapwrap .map *, .mapwrap .map *::before, .mapwrap .map *::after { animation-play-state: paused !important; }'],
      ['지도 애니 모두 멈춤 + seasonp 끔', '.mapwrap .map, .mapwrap .map *, .mapwrap .map *::before, .mapwrap .map *::after { animation-play-state: paused !important; } .ap .seasonp { display: none !important; }'],
    ]
    for (const [name, css] of exps) {
      await js(`(() => { let s = document.getElementById('zexp'); if (s === null) { s = document.createElement('style'); s.id = 'zexp'; document.head.appendChild(s) } s.textContent = ${JSON.stringify(css)}; window.dispatchEvent(new PointerEvent('pointermove')); return 1 })()`)
      await sleep(800)
      await measure(`실험: ${name}`, () => sleep(2500), false)
    }
    // 이 판에 없는 움직임 — 출정 화살(숨쉬기·흐르는 점선) · 위협 화살 · 뜨거운 풍습 표시를 하나씩 끼워 넣고 메인 스레드를 잰다
    const inject: Array<[string, string]> = [
      ['화살 숨쉬기(arw)', `document.querySelector('.map svg.marr').insertAdjacentHTML('beforeend', '<g class="arw zx"><path d="M100 100 L600 500" stroke="red" stroke-width="8" fill="none"/></g>')`],
      ['흐르는 점선(mvflow)', `document.querySelector('.map svg.marr').insertAdjacentHTML('beforeend', '<path class="mvflow zx" d="M100 100 L600 500" stroke="red" stroke-width="8" stroke-dasharray="10 10" fill="none"/>')`],
      ['고른 길 빛(mvglow)', `document.querySelector('.map svg.marr').insertAdjacentHTML('beforeend', '<path class="mvglow zx" d="M100 100 L600 500" stroke="red" stroke-width="8" stroke-dasharray="10 10" fill="none"/>')`],
      ['위협 화살(thrarrow)', `document.querySelector('.map svg.marr').insertAdjacentHTML('beforeend', '<path class="thrarrow zx" d="M100 100 L600 500" stroke="red" stroke-width="8" fill="none"/>')`],
      ['뜨거운 풍습(cmkhot)', `document.querySelector('.map .lbs .lb').insertAdjacentHTML('beforeend', '<span class="lbg zx" style="display:inline-flex !important"><i class="cmk hot" data-l="풍">풍</i></span>')`],
      ['싸우는 띠(lbrwar)', `document.querySelector('.map .lbs .lb').insertAdjacentHTML('afterbegin', '<i class="lbr war zx">전</i>')`],
    ]
    await js(`document.getElementById('zexp').textContent = ''; 1`)
    for (const [name, code] of inject) {
      await js(`(() => { window.dispatchEvent(new PointerEvent('pointermove')); document.querySelectorAll('.zx').forEach((e) => e.remove()); ${code}; return 1 })()`)
      await sleep(800)
      await measure(`끼움: ${name}`, () => sleep(2000), false)
    }
    ws.close()
    process.exit(0)
  }
  await measure('① 멀리 · 가만히 3초', () => sleep(3000), false)
  await measure('③ 멀리에서 벌리기(확대)', () => pinch(2.2))
  await sleep(1500)
  await measure('② 가까이 · 가만히 3초', () => sleep(3000), false)
  await measure('④ 오므리기(축소)', () => pinch(0.45))
  await sleep(1500)
  await measure('⑤ 멀리 · 밀기', async () => {
    await call('Input.synthesizeScrollGesture', { x: W / 2, y: H / 2, xDistance: -300, yDistance: -300, speed: 600, gestureSourceType: 'touch' })
    await sleep(400)
  })
  await measure('⑥ －단추 두 번', () => btn('zin', 2))
  ws.close()
} finally {
  chrome.kill()
  await sleep(500)
  try { rmSync(prof, { recursive: true, force: true }) } catch { /* 크롬이 아직 잡고 있다 */ }
}
