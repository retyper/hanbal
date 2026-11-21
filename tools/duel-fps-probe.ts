/**
 * 겨루기 · 각성 시련 프레임 재기 (11-19 형 ③: 「각성 시련·겨루기(엘든링식) 프레임 최적화 · 열전 기법 옮기기」).
 *
 *   node --experimental-strip-types tools/duel-fps-probe.ts [duel|trial] [390x844] [THROTTLE 4] [FRAMES 900] [ROOT http://127.0.0.1:5195]
 *
 * 헤드리스 크롬을 폰 크기(DPR 3)로 띄우고 CPU 를 THROTTLE 배 느리게 한 채 판 시계를 「한 틀 = 1/60초」로 묶어 돌린다 (lockstep):
 * 진짜 rAF 가 한 번 돌 때마다 페이지의 rAF·performance.now 를 정확히 1/60초씩 민다 → 고치기 전과 뒤가 똑같은 틀을 그린다 (재는 값만 다르다).
 *  - duel: 개발 손잡이 __duel·__duelTap 으로 고리가 닿는 틱에 맞춰 누른다 — 정확(치명·흰 베기·번쩍) · 막음(챙) · 일부러 못 막음(붉은 베기·흔들림) ·
 *          체간이 차면 연타(베기·숫자) · 적장 무예 7 이라 이어치기 고리 둘도 뜬다.
 *  - trial: raid.html 을 본편처럼 틀(iframe ?trial=) 안에 연다 → 검수 재생으로 판을 연 뒤 시련 판(활 묶음 · 화살비·유성)을 UNTIL 초까지 돌려 끼운다
 *          (11-18 형 플립7: 「3:35 폭풍의 진격」·「4:46 힘의 결합 늑대 떼」) → 키보드로 원을 그리며 걷고 비기·투지를 쓴다 (체력은 반 아래로 안 떨어지게).
 *          폰 세로는 판이 「가로로 돌려 주세요」로 멈춘 채 그려진다 (게임이 그렇게 한다).
 *
 * 적는 것 (한 줄 JSON + 표):
 *  - 틀 간격(진짜 rAF) p50·p95·최대 · 16.7ms 넘은 틀 수 · 틀마다 페이지 스크립트 시간(우리 rAF 콜백) p50·p95·최대 · 무거운 틀만 따로
 *  - COUNT=1: 캔버스 셈 (보이는 판: drawImage 수 · 칠한 넓이를 화면 장수로 · fill/stroke · 글자 · save · 그라디언트 · 새 캔버스 / 굽는 판은 따로) — 폰 GPU 가 칠하는 양을 가늠
 *  - PROFILE=1: CDP Profiler — 자기 시간 순 함수 · 안까지 더한 몫
 *  - SHOTS=폴더 TAG=이름: 정해 둔 틀(사건 뒤 몇 틀)에서 멈춰 찍는다 · CMP=견줄 태그 면 같은 틀끼리 화소 차를 적는다
 *  - WATCH=1: 겨루기의 「느리면 DPR 내리기」를 켠 채 (기본은 꺼서 DPR 을 고정 — 전후를 같은 해상도로 견준다)
 *  - DPR=3 · QUERY='me=…&foe=…' (겨루기 주소) · UNTIL=286 · KIT=bow (시련)
 * 런타임 의존성 없음 · 임시 크롬 프로필은 끝나면 지운다 · 5195 같은 제 서버로 (형이 쓰는 5173·5174 는 건드리지 않는다).
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const SCENE = process.argv[2] === 'trial' ? 'trial' : 'duel'
const [VW, VH] = (process.argv[3] ?? '390x844').split('x').map(Number) as [number, number]
const THROTTLE = Number(process.argv[4] ?? 4)
const FRAMES = Number(process.argv[5] ?? 900)
const ROOT = process.argv[6] ?? 'http://127.0.0.1:5195'
const env = (k: string): string => process.env[k] ?? ''
const DPR = Number(env('DPR') || 3)
const COUNT = env('COUNT') === '1', PROFILE = env('PROFILE') === '1', WATCH = env('WATCH') === '1'
const SHOTS = env('SHOTS'), TAG = env('TAG') || 'now', CMP = env('CMP')
const QUERY = env('QUERY') || 'me=aryeong&foe=haebi&muMe=5&muFoe=7&tier=2&seed=1'
const UNTIL = Number(env('UNTIL') || 286), KIT = env('KIT') || 'bow'
const CHROMES = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe']
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))
const exe = CHROMES.find((p) => existsSync(p))
if (exe === undefined) throw new Error('크롬을 못 찾았다')

/**
 * 묶은 시계 — 모든 창(틀 안 창도)에 문서보다 먼저 심는다. 켜기 전엔 원래대로 돈다.
 * 켜면 진짜 rAF 한 번에 판 시계를 정확히 1/60초 밀고, 페이지가 건 rAF 콜백을 그 시각으로 부른다 · 그 시간(콜백 합)과 진짜 틀 간격을 적는다.
 * before(n): 틀마다 콜백 앞에서 부르는 손 (누르기·찍기 예약) · hold: 찍는 동안 멈춤 (시각도 멈춘다)
 */
const LOCK = `(() => {
  // 틀(iframe)은 처음 빈 문서의 창을 새 문서가 물려받는다 — 원래 함수는 한 번만 쥐고, 시계 고리는 문서마다 새로 건다
  if (window.__lock && window.__lock.doc === document) return
  const O = window.__lockOrig ??= { now: performance.now.bind(performance), raf: window.requestAnimationFrame.bind(window), caf: window.cancelAnimationFrame.bind(window) }
  const realNow = O.now, raf0 = O.raf, caf0 = O.caf
  const L = window.__lock = { doc: document, on: false, t: 100000, q: new Map(), id: 1e7, n: 0, rec: [], hold: false, step: 1000 / 60, before: null, tag: null, stop: false, holdAt: -1 }
  window.__realNow = realNow
  performance.now = () => L.on ? L.t : realNow()
  window.requestAnimationFrame = (cb) => { if (!L.on) return raf0(cb); const id = ++L.id; L.q.set(id, cb); return id }
  window.cancelAnimationFrame = (id) => { if (!L.q.delete(id)) caf0(id) }
  let prev = 0
  const tick = (ts) => {
    const gap = prev ? ts - prev : 0
    prev = ts
    if (L.on && !L.hold && !L.stop) {
      L.t += L.step
      const n = L.n++
      try { L.before?.(n) } catch (e) { L.err = String(e && e.stack || e) }
      const cbs = [...L.q.values()]; L.q.clear()
      const a = realNow(); for (const f of cbs) f(L.t); const b = realNow()
      let tag = 0; try { tag = L.tag?.(n) ?? 0 } catch { tag = -1 }
      L.rec.push([gap, b - a, tag])
      if (L.holdAt === n) L.hold = true
    }
    raf0(tick)
  }
  raf0(tick)
})()`

/** 캔버스 셈 — 보이는 판(문서에 붙은 캔버스)과 굽는 판(떨어진 캔버스)을 따로 · 틀마다 끊는다 */
const COUNTER = `(() => {
  const C = window.__cnt = { cur: null, frames: [], reset() { this.cur = { vis: {}, off: {}, visPx: 0, offPx: 0 } } }
  C.reset()
  const P = CanvasRenderingContext2D.prototype
  const bump = (ctx, k, px, who) => { const vis = ctx.canvas.isConnected, s = vis ? C.cur.vis : C.cur.off; s[k] = (s[k] ?? 0) + 1; if (px) { if (vis) { C.cur.visPx += px; if (who) { const b = C.cur.by ??= {}; b[who] = (b[who] ?? 0) + px } } else C.cur.offPx += px } }
  const area = (ctx, w, h) => { const t = ctx.getTransform(); return Math.abs(w * h * (t.a * t.d - t.b * t.c)) }
  // 칠한 넓이를 누가 먹나 — 그림 이름(또는 구운 판 크기) · 섞기가 lighter 면 + · 겹친 투명도가 1 아래면 ~
  const who = (ctx, img) => (img instanceof HTMLImageElement ? (img.src.split('/').pop() || '?').split('?')[0] : img instanceof HTMLVideoElement ? 'video' : 'cv' + img.width + 'x' + img.height) + (ctx.globalCompositeOperation === 'lighter' ? '+' : '') + (ctx.globalAlpha < 1 ? '~' : '')
  const di = P.drawImage
  P.drawImage = function (img, ...a) { const w = a.length >= 8 ? a[6] : a.length >= 4 ? a[2] : (img.videoWidth || img.naturalWidth || img.width), h = a.length >= 8 ? a[7] : a.length >= 4 ? a[3] : (img.videoHeight || img.naturalHeight || img.height); bump(this, 'drawImage', area(this, w, h), this.canvas.isConnected ? who(this, img) : ''); return di.call(this, img, ...a) }
  for (const m of ['fillRect', 'clearRect', 'strokeRect']) { const o = P[m]; P[m] = function (x, y, w, h) { bump(this, m, m === 'strokeRect' ? 0 : area(this, w, h), m + (this.globalCompositeOperation === 'lighter' ? '+' : '')); return o.call(this, x, y, w, h) } }
  for (const m of ['fill', 'stroke', 'clip', 'fillText', 'strokeText', 'measureText', 'save', 'getImageData', 'createLinearGradient', 'createRadialGradient', 'createPattern']) { const o = P[m]; P[m] = function (...a) { bump(this, m, 0); return o.apply(this, a) } }
  const ce = Document.prototype.createElement
  Document.prototype.createElement = function (t, ...a) { if (String(t).toLowerCase() === 'canvas') { C.cur.off.newCanvas = (C.cur.off.newCanvas ?? 0) + 1 } return ce.call(this, t, ...a) }
})()`

/** 겨루기 손 — 고리 번호로 정확·정확·막음·정확·못 막음·막음 (붉은 큰 공격은 늘 정확) · 연타는 6틱마다 자리를 바꿔 */
const DUEL_SCENE = `(() => {
  const L = window.__lock, PLAN = ['perfect', 'perfect', 'good', 'perfect', 'miss', 'good']
  const S = window.__scene = { ev: 0, marks: {}, lastRush: -99, tapped: new Set(), over: -1, duelAt: -1 }
  L.before = (n) => {
    const mode = window.__duelMode?.()
    if (n === 12 && mode === 'field') document.querySelector('.dflag')?.click()
    if (mode === 'intro') document.querySelector('.dskip')?.click()
    if (mode !== 'duel') return
    if (S.duelAt < 0) S.duelAt = n
    const d = window.__duel()
    for (; S.ev < d.events.length; S.ev++) { const k = d.events[S.ev].kind; if (!(k in S.marks)) S.marks[k] = n }
    if (d.over !== null) { if (S.over < 0) S.over = n; return }
    if (d.phase === 'rush') { if (d.t - S.lastRush >= 6) { S.lastRush = d.t; const i = (d.t / 6) | 0; window.__duelTap(0.3 + 0.4 * ((i * 37) % 10) / 10, 0.25 + 0.5 * ((i * 61) % 10) / 10) } return }
    for (const c of d.cues) {
      if (c.done !== null || d.t < c.t0 || S.tapped.has(c.id)) continue
      const plan = c.heavy ? 'perfect' : PLAN[c.id % PLAN.length]
      if (plan === 'miss') continue
      if (d.t >= (plan === 'perfect' ? c.hitAt - 1 : c.hitAt - 7)) { S.tapped.add(c.id); window.__duelTap(c.x, c.y) }
    }
  }
  // 틀 꼬리표: 0 = 겨루기 밖 · 1 = 겨루기 · 2 = 무거운 틀 (치명·맞음·연타 뒤 30틀 안 · 연타 중)
  let heavyUntil = -1, seen = 0
  L.tag = (n) => {
    if (window.__duelMode?.() !== 'duel') return 0
    const d = window.__duel()
    for (; seen < d.events.length; seen++) { const k = d.events[seen].kind; if (k === 'crit' || k === 'miss' || k === 'rushHit' || k === 'break' || k === 'good' || k === 'perfect') heavyUntil = n + 30 }
    return d.phase === 'rush' || n <= heavyUntil ? 2 : 1
  }
})()`
/** 겨루기 찍을 때 — 처음 난 사건 뒤 몇 틀 (전후가 같은 틀) */
const DUEL_SHOTS: ReadonlyArray<readonly [string, string, number]> = [
  ['calm', 'duel', 150], ['crit-a', 'crit', 2], ['crit-b', 'crit', 14], ['good', 'good', 5], ['miss', 'miss', 3], ['rush', 'break', 40], ['rushhit', 'rushHit', 4],
]

/** 시련 판 짓기 — 활 묶음 · 화살비·유성 먼저 · 돌리는 동안 죽지 않게 (tools/raid-fps-probe.ts SCENE=trial 과 같은 판) */
const TRIAL_BUILD = `(async () => {
  const H = await import('/src/raid/haebi.ts'), R = await import('/src/raid/haebi-replay.ts')
  const s = H.createHaebi(7, 'trial', '${KIT}'), want = { rain: 3, reach: 2, bow: 5, tempo: 3, echo: 2 }, pick = () => s.offers.find(p => p === 'volley' || p === 'meteor') ?? Object.keys(want).find(p => s.offers.includes(p) && s.ranks[p] < want[p]) ?? s.offers[0]
  for (let n = 0; s.t < ${UNTIL} && s.state === 'playing'; n++) {
    if (s.offers.length) H.choose(s, pick()); else { H.stepHaebi(s, R.botInput(s), 1 / 120); s.hp = s.maxHp }
    if (n % 2400 === 0) await new Promise(r => setTimeout(r, 0))
  }
  Object.assign(window.__raid(), s)
  return { t: Math.round(s.t), kills: s.kills, level: s.level, mode: s.mode, enemies: s.enemies.length, combos: s.combos.join(',') }
})()`
/** 시련 손 — 20틀마다 여덟 방향을 돌며 걷고 · 레벨업이면 첫 카드 · 240틀마다 비기 · 투지가 차면 쓴다 · 체력은 반 아래로 안 떨어지게 */
const TRIAL_SCENE = `(() => {
  const L = window.__lock, DIRS = [['d'], ['d', 's'], ['s'], ['s', 'a'], ['a'], ['a', 'w'], ['w'], ['w', 'd']]
  const S = window.__scene = { held: [], marks: {}, cast: 0 }
  const key = (type, k) => window.dispatchEvent(new KeyboardEvent(type, { key: k, bubbles: true }))
  L.before = (n) => {
    const r = window.__raid?.()
    if (!r || r.state !== 'playing') return
    r.hp = Math.max(r.hp, r.maxHp * .5)
    if (r.offers.length) { document.querySelector('#overlay .choices button')?.click(); if (!('offer' in S.marks)) S.marks.offer = n; return }
    const want = DIRS[Math.floor(n / 20) % DIRS.length]
    for (const k of S.held) if (!want.includes(k)) key('keyup', k)
    for (const k of want) if (!S.held.includes(k)) key('keydown', k)
    S.held = want
    if (n % 240 === 120) { key('keydown', ' '); key('keyup', ' '); if (!('skill' in S.marks)) S.marks.skill = n }
    if (n % 300 === 200) { key('keydown', 'e'); key('keyup', 'e') }
    if (r.cast && r.cast !== S.cast) { S.cast = r.cast; if (!('cast' in S.marks)) S.marks.cast = n }
  }
  L.tag = () => { const r = window.__raid?.(); return r ? r.enemies.length : 0 }
})()`
const TRIAL_SHOTS: ReadonlyArray<readonly [string, string, number]> = [['start', 'start', 30], ['crowd', 'start', 110], ['skill', 'skill', 20]]

function stats(a: number[]): { n: number; p50: number; p95: number; max: number; mean: number } {
  const s = [...a].sort((x, y) => x - y), n = s.length
  if (n === 0) return { n: 0, p50: 0, p95: 0, max: 0, mean: 0 }
  const q = (k: number): number => +(s[Math.min(n - 1, Math.floor(n * k))] as number).toFixed(2)
  return { n, p50: q(0.5), p95: q(0.95), max: +(s[n - 1] as number).toFixed(2), mean: +(s.reduce((x, y) => x + y, 0) / n).toFixed(2) }
}

const PORT = 9600 + Math.floor(Math.random() * 60)
const prof = mkdtempSync(join(tmpdir(), 'dfps-'))
const chrome = spawn(exe, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${prof}`, `--window-size=${VW},${VH}`, '--no-first-run', '--mute-audio', '--enable-gpu-rasterization', 'about:blank'], { stdio: 'ignore' })
try {
  let tabs: any = null
  for (let i = 0; i < 50 && tabs === null; i++) { try { tabs = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json() } catch { await sleep(200) } }
  const ws = new WebSocket(tabs.find((t: any) => t.type === 'page').webSocketDebuggerUrl)
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j })
  let id = 0
  const waits = new Map<number, (v: any) => void>()
  ws.onmessage = (m) => {
    const o = JSON.parse(String(m.data))
    if (o.method === 'Runtime.exceptionThrown') console.log('  페이지 예외', String(o.params.exceptionDetails?.exception?.description ?? o.params.exceptionDetails?.text).slice(0, 300))
    if (o.method === 'Inspector.targetCrashed') console.log('  페이지가 죽었다 (targetCrashed)')
    if (o.id !== undefined) { waits.get(o.id)?.(o.result ?? o.error); waits.delete(o.id) }
  }
  // 크롬이 죽거나 답이 없으면 기다리지 않고 끝낸다 (판이 멈춘 채 몇 분씩 걸려 있었다)
  ws.onclose = () => { for (const w of waits.values()) w({ error: 'closed' }); waits.clear() }
  const call = (method: string, params: object = {}): Promise<any> => new Promise((r, j) => {
    const k = ++id
    const t = setTimeout(() => { waits.delete(k); j(new Error(`${method}: 120초 동안 답 없음`)) }, 120000)
    waits.set(k, (v) => { clearTimeout(t); if (v?.error === 'closed') j(new Error(`${method}: 크롬 연결이 끊겼다`)); else r(v) })
    ws.send(JSON.stringify({ id: k, method, params }))
  })
  const step = (what: string): void => { if (env('VERBOSE') === '1') console.error(`  [${new Date().toISOString().slice(11, 19)}] ${what}`) }
  const evTop = async (expression: string): Promise<any> => { const r = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) console.log('  스크립트 오류', String(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text).slice(0, 400)); return r.result?.value }
  /** 판이 사는 창 — 겨루기는 이 창 · 시련은 틀 안 창 */
  const WIN = SCENE === 'trial' ? `document.querySelector('iframe').contentWindow` : 'window'
  /** 판이 사는 창의 realm 에서 돌린다 (그 창의 document·window 로) */
  const ev = (src: string): Promise<any> => evTop(`${WIN}.eval(${JSON.stringify(src)})`)
  await call('Emulation.setDeviceMetricsOverride', { width: VW, height: VH, deviceScaleFactor: DPR, mobile: true })
  await call('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 })
  await call('Emulation.setFocusEmulationEnabled', { enabled: true })
  await call('Page.enable'); await call('Runtime.enable')
  await call('Page.addScriptToEvaluateOnNewDocument', { source: LOCK })
  if (COUNT) await call('Page.addScriptToEvaluateOnNewDocument', { source: COUNTER })
  let built: unknown = null
  if (SCENE === 'duel') {
    await call('Page.navigate', { url: `${ROOT}/duel.html?${QUERY}` })
    for (let i = 0; i < 80 && await ev(`typeof window.__duel === 'function' && !!document.querySelector('.dflag')`) !== true; i++) await sleep(250)
    // 겨루기의 그림(바탕·띠·초상·테두리)이 다 오기를 — 처음 굽기(warmNow)도 이때 끝난다
    await sleep(2500)
    // 재는 판만: DPR 고정(전후 같은 해상도) · 체간 끝을 낮춰 연타가 일찍 온다 (판 셈 자체는 그대로 · 전후 같은 판)
    await ev(`import('/src/tune/params.ts').then(m => { ${WATCH ? '' : 'm.P.duel.dprDropMs = 1e9;'} m.P.duel.posture = ${Number(env('POSTURE') || 40)} })`)
    await ev(DUEL_SCENE)
  } else {
    // 위 창은 스크립트 없는 같은 곳 문서(그림 한 장)로 — 본편처럼 틀 안에서만 판이 돈다
    await call('Page.navigate', { url: `${ROOT}/favicon-32.png` })
    await sleep(800)
    await evTop(`(() => { document.documentElement.innerHTML = '<head><style>html,body{margin:0;height:100%;overflow:hidden;background:#000}iframe{position:fixed;inset:0;width:100vw;height:100vh;border:0}</style></head><body><iframe src="/raid.html?trial=probe&review&background&kit=${KIT}"></iframe></body>' })()`)
    step('틀 열림')
    for (let i = 0; i < 120 && await evTop(`!!document.querySelector('iframe')?.contentDocument?.querySelector('button[data-until="0"]')`) !== true; i++) await sleep(250)
    step('검수 단추 보임 · ' + await ev(`location.search + ' · ' + (window.__lock ? '시계 있음' : '시계 없음')`))
    await ev(`document.querySelector('button[data-until="0"]').click()`)
    for (let i = 0; i < 240 && await ev(`document.getElementById('play').hidden`) !== false; i++) await sleep(250)
    step('판 열림')
    await ev(`[...document.querySelectorAll('.review-tools button')].find(b => b.textContent === '검수 도구 닫기')?.click()`)
    built = await ev(TRIAL_BUILD)
    step('판 지음 ' + JSON.stringify(built))
    await sleep(1500)
    await ev(TRIAL_SCENE)
  }
  // 시계를 묶는다 — 걸려 있던 진짜 rAF 하나가 묶인 줄로 들어오게 잠깐 세웠다가 푼다
  await ev(`(() => { const L = window.__lock; L.hold = true; L.on = true })()`)
  await sleep(300)
  if (THROTTLE > 1) await call('Emulation.setCPUThrottlingRate', { rate: THROTTLE })
  if (PROFILE) { await call('Profiler.enable'); await call('Profiler.setSamplingInterval', { interval: 250 }); await call('Profiler.start') }
  if (COUNT) await ev(`(() => { const L = window.__lock, C = window.__cnt, tag0 = L.tag; L.tag = (n) => { C.frames.push(C.cur); C.reset(); return tag0 ? tag0(n) : 0 }; C.reset() })()`)
  const shotList = SHOTS ? (SCENE === 'duel' ? DUEL_SHOTS : TRIAL_SHOTS) : []
  const shotsTaken: Record<string, string> = {}
  // PROFAT=780,160: 그 틀(앞뒤 한 틀씩)만 따로 프로파일 — 가장 무거운 틀이 무엇에 시간을 쓰나
  const profAt = env('PROFAT').split(',').filter(Boolean).map(Number).sort((a, b) => a - b)
  const profOut: string[] = []
  let profOn = -1
  if (profAt.length) { await call('Profiler.enable'); await call('Profiler.setSamplingInterval', { interval: 100 }) }
  await ev(`window.__lock.hold = false`)
  const t0 = Date.now()
  for (;;) {
    const st = await ev(`(() => { const L = window.__lock, S = window.__scene; return { n: L.n, hold: L.hold, marks: S.marks, duelAt: S.duelAt ?? 0, over: S.over ?? -1, err: L.err ?? '' } })()`)
    if (st === undefined || st === null) { console.log('  판 창을 못 읽었다'); break }
    if (st.err) { console.log('  손 오류', st.err.slice(0, 300)); break }
    if (st.n % 100 < 8) step(`틀 ${st.n}`)
    if (profAt.length) {
      const target = profAt[0]!
      if (profOn < 0 && !st.hold) {
        if (st.n <= target - 2) { await ev(`window.__lock.holdAt = ${target - 2}`); await sleep(20) } else profAt.shift()
        continue
      }
      if (profOn < 0) { await call('Profiler.start'); profOn = target; await ev(`(() => { const L = window.__lock; L.holdAt = ${target + 1}; L.hold = false })()`); continue }
      if (st.hold) {
        const { profile } = await call('Profiler.stop')
        const self = new Map<string, number>(), byId = new Map<number, any>(profile.nodes.map((n: any) => [n.id, n]))
        ;(profile.samples as number[]).forEach((sid, i) => { const f = byId.get(sid).callFrame; if (f.functionName === '(idle)') return; const k = `${f.functionName || '(anon)'}:${f.lineNumber + 1}`; self.set(k, (self.get(k) ?? 0) + ((profile.timeDeltas as number[])[i] ?? 0)) })
        profOut.push(`#${profOn - 1}..${profOn + 1}: ` + [...self].sort((a, b) => b[1] - a[1]).slice(0, 14).map(([k, v]) => `${k} ${(v / 1000).toFixed(1)}ms`).join(' · '))
        profAt.shift(); profOn = -1
        await ev(`(() => { const L = window.__lock; L.holdAt = -1; L.hold = false })()`)
        continue
      }
    }
    if (st.n >= FRAMES || (st.over >= 0 && st.n > st.over + 120) || Date.now() - t0 > 600000) break
    if (shotList.length) {
      const marks: Record<string, number> = { ...st.marks, duel: st.duelAt, start: 0 }
      // 아직 안 찍은 것 가운데 가장 이른 틀에 멈춤을 건다 (그 틀을 그린 뒤 멈춘다)
      const due = shotList.filter(([name, m]) => shotsTaken[name] === undefined && marks[m] !== undefined && (m !== 'duel' || st.duelAt > 0)).map(([name, m, off]) => [name, (marks[m] as number) + off] as const).sort((a, b) => a[1] - b[1])[0]
      if (due !== undefined) {
        if (st.hold) {
          if (!SHOTS) break
          mkdirSync(SHOTS, { recursive: true })
          const { data } = await call('Page.captureScreenshot', { format: 'png' })
          const file = join(SHOTS, `${SCENE}-${VW}x${VH}-${due[0]}-${TAG}.png`)
          writeFileSync(file, Buffer.from(data, 'base64'))
          shotsTaken[due[0]] = file
          await ev(`(() => { const L = window.__lock; L.holdAt = -1; L.hold = false })()`)
          continue
        }
        if (st.n <= due[1]) await ev(`window.__lock.holdAt = ${due[1]}`)
        else shotsTaken[due[0]] = '(지나침)'
      }
    }
    await sleep(SHOTS ? 30 : 400)
  }
  await ev(`window.__lock.stop = true`)
  if (THROTTLE > 1) await call('Emulation.setCPUThrottlingRate', { rate: 1 })
  const rec: Array<[number, number, number]> = await ev(`window.__lock.rec`)
  const scene = await ev(SCENE === 'duel' ? `(() => { const d = window.__duel(), S = window.__scene; return { stats: d.stats, over: d.over, t: d.t, duelAt: S.duelAt, marks: S.marks, dpr: +(document.querySelector('.duelx canvas:last-of-type').width / innerWidth).toFixed(2) } })()`
    : `(() => { const r = window.__raid(), S = window.__scene; return { t: +r.t.toFixed(1), state: r.state, mode: r.mode, kills: r.kills, enemies: r.enemies.length, fx: r.fx.length, marks: S.marks, canvas: document.getElementById('field').width + 'x' + document.getElementById('field').height, rotate: !document.getElementById('rotate-guide').hidden } })()`)
  // 겨루기는 겨루기 화면이 선 뒤의 틀만 · 첫 30틀(굽기·들어오는 암전)은 뺀다
  const from = SCENE === 'duel' ? Math.max(0, (scene.duelAt as number) + 30) : 30
  const body = rec.slice(from)
  const gaps = body.map((r) => r[0]).filter((g) => g > 0), cbs = body.map((r) => r[1])
  const heavy = SCENE === 'duel' ? body.filter((r) => r[2] === 2) : body.filter((r) => r[2] >= 0)
  const out = {
    scene: SCENE, size: `${VW}x${VH}`, dpr: DPR, throttle: THROTTLE, frames: body.length, tag: TAG,
    gap: { ...stats(gaps), over16: gaps.filter((g) => g > 16.7 + 0.5).length, over33: gaps.filter((g) => g > 33.4 + 0.5).length },
    script: stats(cbs),
    heavy: SCENE === 'duel' ? { n: heavy.length, gap: stats(heavy.map((r) => r[0]).filter((g) => g > 0)), script: stats(heavy.map((r) => r[1])) } : undefined,
    built, at: scene,
  }
  console.log(JSON.stringify(out))
  for (const line of profOut) console.log('profile ' + line)
  // 가장 오래 걸린 틀 — 몇 번째 틀(겨루기 시작부터) · 스크립트 ms · 틀 간격 ms · 그 앞 사건
  const marksOf = (scene.marks ?? {}) as Record<string, number>
  const near = (n: number): string => Object.entries(marksOf).filter(([, m]) => m <= n + 1).sort((a, b) => b[1] - a[1]).slice(0, 1).map(([k, m]) => `${k}+${n + 1 - m}`).join('')
  console.log('slowest: ' + body.map((r, i) => [i + from, r[1], r[0]] as const).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([n, s, g]) => `#${n} ${s.toFixed(1)}ms/${g.toFixed(0)}ms ${near(n)}`).join(' · '))
  if (COUNT) {
    const frames: Array<{ vis: Record<string, number>; off: Record<string, number>; visPx: number; offPx: number }> = (await ev(`window.__cnt.frames`)).slice(from)
    const px = DPR * DPR, screen = VW * VH * px
    const keys = new Set<string>(); for (const f of frames) { for (const k of Object.keys(f.vis)) keys.add('vis.' + k); for (const k of Object.keys(f.off)) keys.add('off.' + k) }
    const row: Record<string, string> = {}
    for (const k of [...keys].sort()) { const [side, m] = k.split('.') as [string, string]; const v = frames.map((f) => (side === 'vis' ? f.vis : f.off)[m] ?? 0); const s = stats(v); row[k] = `${s.mean}/${s.max}` }
    const vis = stats(frames.map((f) => f.visPx / screen)), off = stats(frames.map((f) => f.offPx / screen))
    console.log('canvas per frame (mean/max): ' + Object.entries(row).map(([k, v]) => `${k} ${v}`).join(' · '))
    console.log(`fill (screens of ${VW}x${VH}@${DPR}): visible mean ${vis.mean} p95 ${vis.p95} max ${vis.max} · offscreen mean ${off.mean} max ${off.max}`)
    const by = new Map<string, number>(); for (const f of frames as Array<{ by?: Record<string, number> }>) for (const [k, v] of Object.entries(f.by ?? {})) by.set(k, (by.get(k) ?? 0) + v)
    console.log('fill by source (screens/frame): ' + [...by].sort((a, b) => b[1] - a[1]).slice(0, 16).map(([k, v]) => `${k} ${(v / frames.length / screen).toFixed(3)}`).join(' · '))
  }
  if (PROFILE) {
    const { profile } = await call('Profiler.stop')
    const self = new Map<string, number>(), byId = new Map<number, any>(profile.nodes.map((n: any) => [n.id, n]))
    const dt = profile.timeDeltas as number[], samples = profile.samples as number[]
    samples.forEach((sid, i) => { const f = byId.get(sid).callFrame; const k = `${f.functionName || '(anon)'} ${(f.url || '').split('/').pop()?.split('?')[0]}:${f.lineNumber + 1}`; self.set(k, (self.get(k) ?? 0) + (dt[i] ?? 0)) })
    const tot = [...self.values()].reduce((a, b) => a + b, 0)
    const idle = [...self].filter(([k]) => /^\(idle\)|^\(program\)|^\(garbage collector\)/.test(k)).map(([k, v]) => `${k.split(' ')[0]} ${(100 * v / tot).toFixed(1)}%`).join(' · ')
    console.log('self (all samples · ' + idle + '):\n' + [...self].filter(([k]) => !/^\(idle\)/.test(k)).sort((a, b) => b[1] - a[1]).slice(0, 28).map(([k, v]) => `  ${(100 * v / tot).toFixed(1)}% ${k}`).join('\n'))
    const parent = new Map<number, number>(); for (const n of profile.nodes) for (const c of n.children ?? []) parent.set(c, n.id)
    const incl = new Map<string, number>()
    samples.forEach((sid, i) => { const seen = new Set<string>(); for (let p: number | undefined = sid; p !== undefined; p = parent.get(p)) { const nm = byId.get(p).callFrame.functionName; if (nm && !seen.has(nm)) { seen.add(nm); incl.set(nm, (incl.get(nm) ?? 0) + (dt[i] ?? 0)) } } })
    const WANT = /^(frame|tick|drawDuel|drawCue|drawSlash|clang|bar|barFrame|putText|textSprite|sprite|fieldFighters|crowdRow|bakedBg|panelBake|glow|scaled|rushCue|drawHitPortrait|hitArtDraw|drawIntro|drawEnd|onEvent|burst|syncRisers|riserStart|stepDuel|watchLoad|warmNow|drawField|stepHaebi|updateHud|showOverlay|updatePortrait|drawNumbers|trackNumbers|drawEnemies|effectStrip|bakedStrip|whiteStrip|drawAura|drawWard|syncEndingVideo|updateChunk|watchHit|feed|runFrame)$/
    console.log('inclusive: ' + [...incl].filter(([k]) => WANT.test(k)).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${(100 * v / tot).toFixed(1)}%`).join(' · '))
  }
  if (SHOTS) {
    console.log('shots: ' + JSON.stringify(shotsTaken))
    if (CMP) {
      // 견줄 태그의 같은 틀 그림과 화소 차 — 페이지 캔버스로 읽는다 (차 > 8 인 화소 몫 · 가장 큰 차)
      await call('Page.navigate', { url: `${ROOT}/favicon-32.png` }); await sleep(800)
      for (const [name, file] of Object.entries(shotsTaken)) {
        const other = file.replace(`-${TAG}.png`, `-${CMP}.png`)
        if (!existsSync(file) || !existsSync(other)) { console.log(`  ${name}: 견줄 그림 없음`); continue }
        const a = readFileSync(file).toString('base64'), b = readFileSync(other).toString('base64')
        const r = await evTop(`(async () => { const load = (s) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.src = 'data:image/png;base64,' + s }); const [A, B] = await Promise.all([load(${JSON.stringify(a)}), load(${JSON.stringify(b)})]); const w = A.width, h = A.height; if (B.width !== w || B.height !== h) return { size: 'differs' }; const px = (im) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.drawImage(im, 0, 0); return g.getImageData(0, 0, w, h).data }; const p = px(A), q = px(B); let diff = 0, max = 0, sum = 0; for (let i = 0; i < p.length; i += 4) { const d = Math.max(Math.abs(p[i] - q[i]), Math.abs(p[i + 1] - q[i + 1]), Math.abs(p[i + 2] - q[i + 2])); if (d > 8) diff++; if (d > max) max = d; sum += d } return { diffPct: +(100 * diff / (w * h)).toFixed(3), max, mean: +(sum / (w * h)).toFixed(3) } })()`)
        console.log(`  ${name} vs ${CMP}: ${JSON.stringify(r)}`)
      }
    }
  }
  ws.close()
} finally {
  chrome.kill()
  await sleep(600)
  for (let i = 0; i < 15 && existsSync(prof); i++) { try { rmSync(prof, { recursive: true, force: true }) } catch { await sleep(400) } }
}
