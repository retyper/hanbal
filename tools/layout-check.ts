/**
 * 레이아웃 검사 — 화면 × 폭 × 말(ko·en)로 넘침·잘림·줄 늘어남을 자동으로 잡는다 (형 11-11: 영어로 옮기면 칸을 넘친다).
 *
 *   npx tsx tools/layout-check.ts [--lang en|ko] [--ko] [--screen 이름[,이름]] [--width 390] [--only-fail] [--dump] [--text] [--jobs 2] [--port 5174]
 *   기본은 영어만(한국어 기준은 D:/tmp-node/layout/ko-base-<화면>.json 에 남긴 걸 읽는다 · 없으면 둘 다) — --ko 를 주면 한국어도 다시 재서 기준을 새로 쓴다.
 *   한국어 기준이 낡으면(한국어 화면을 고쳤으면) --ko 로 한 번 돌린다. 크롬은 --jobs 개(기본 2)를 병렬로 — 3 이상은 가림막 기다림이 시간 초과로 번져 오히려 흔들린다.
 *   TMP='D:\tmp-node' TEMP='D:\tmp-node'  (크롬 임시 폴더가 C 드라이브에 쌓이지 않게)
 *
 * 한 번 띄운 헤드리스 크롬 하나를 다시 쓰고, 사례마다 새로 연다. 끝나면 나가는 값이 0 이 아니면 (a) 화면 밖 또는 (d) 가로 스크롤이 있다.
 *   (a) 화면 밖 — 요소가 보이는 폭 밖으로 나감 (가로로 미는 칸 안의 것은 뺀다)
 *   (b) 잘림·삐져나옴 — scrollWidth > clientWidth 인데 overflow 가 hidden/visible 인 글 칸
 *   (c) 줄 — 단추·이름표 글이 3줄 이상이거나, 같은 칸의 한국어 높이의 1.6배를 넘음
 *   (d) 페이지 전체 가로 스크롤
 * 결과: D:/tmp-node/layout/<lang>-<w>-<screen>.png · layout-report.json · layout-report.md
 * 판 저장은 tools/phone-save.ts 로 D:/tmp-node/layout-saves/<kind>.json 을 만들어 둔다(없으면 이 도구가 만든다).
 * 런타임 의존성 없음 — 크롬 원격 디버깅(CDP)을 Node 내장 WebSocket 으로 (tools/phone-shot.ts 와 같은 길).
 */
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const argv = process.argv.slice(2)
const opt = (n: string): string | undefined => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : undefined }
const flag = (n: string): boolean => argv.includes(`--${n}`)
const OUT_DIR = 'D:/tmp-node/layout'
const SAVE_DIR = 'D:/tmp-node/layout-saves'
const PORT_APP = opt('port') ?? '5174'
const BASE = `http://localhost:${PORT_APP}/realm.html`
const WIDTHS = opt('width') !== undefined ? [Number(opt('width'))] : [360, 390, 412]
const H = 800
// 한국어 기준(줄 수·잘린 칸)은 ko-base-*.json 에 남긴다 — 영어만 돌릴 땐 그걸 읽어 크롬 짐을 반으로 줄인다. --ko 를 주면 한국어도 다시 잰다
const HAVE_BASE = existsSync('D:/tmp-node/layout') && readdirSync('D:/tmp-node/layout').some((f) => f.startsWith('ko-base-'))
const LANGS = (opt('lang') !== undefined ? [opt('lang')!] : flag('ko') || !HAVE_BASE ? ['ko', 'en'] : ['en']) as ('ko' | 'en')[]
const CDP_PORT = 9500 + Math.floor(Math.random() * 50)
const CHROMES = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe']
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

interface Screen { name: string; /** realm.html 대신 여는 쪽 (night.html?practice=1 같은 — ?lang= 은 알아서 붙인다) */ url?: string; save?: string; pre: string; /** 저장 칸에 더 넣을 { 키: 값 } (tools/drill-seed.ts 가 만든다) */ ls?: 'drill' }

// 글자로 단추를 찾아 누른다 — 이름이 말마다 달라 data-act 를 우선한다
const CLICK = `const clk = async (sel, ms = 900) => { let e = document.querySelector(sel); for (let i = 0; !e && i < 90; i++) { await new Promise((r) => setTimeout(r, 200)); e = document.querySelector(sel) } if (!e) throw new Error('없음 ' + sel); e.click(); await new Promise((r) => setTimeout(r, ms)) };`
const SHUT = `{ const rc = document.querySelector('[data-act="rep-close"]'); if (rc) { rc.click(); await new Promise((r) => setTimeout(r, 900)) } }`
const TAB = (id: string): string => `${CLICK} ${SHUT} await clk('[data-act="tab"][data-tab="${id}"]', 1200);`
/** 보고·결정 카드가 떠 있으면 닫아서 판을 연다 */
const SCREENS: Screen[] = [
  { name: 'title', pre: '' },
  { name: 'more', pre: `${CLICK} await clk('.fmore summary', 1200); const fm = document.querySelector('.fmore'); if (fm && !fm.open) { fm.open = true; await new Promise((r) => setTimeout(r, 800)) }` },
  { name: 'newgame', pre: `${CLICK} await clk('[data-act="fr-new"]', 1500)` },
  { name: 'credits', pre: `${CLICK} await clk('.fmore summary', 1000); const fm = document.querySelector('.fmore'); if (fm && !fm.open) fm.open = true; await clk('[data-act="credits-open"]', 1500)` },
  { name: 'tutorial', pre: `${CLICK} await clk('[data-act="fr-tutorial"]', 4500)` },
  { name: 'army', save: 'none', pre: TAB('army') },
  { name: 'draft', save: 'none', pre: TAB('draft') },
  { name: 'people', save: 'none@8', pre: TAB('people') },
  { name: 'heroes', save: 'none', pre: TAB('heroes') },
  { name: 'nation', save: 'none', pre: TAB('nation') },
  { name: 'diplo', save: 'none@8', pre: TAB('diplo') },
  { name: 'town', save: 'none', pre: `${CLICK} for (const n of document.querySelectorAll('.nd:not([data-act])')) { n.click(); await new Promise((r) => setTimeout(r, 900)); if (document.querySelector('[data-act="town-in"]')) break } await clk('[data-act="town-in"]', 4000)` },
  { name: 'report', save: 'none@8', pre: '' },
  { name: 'help', save: 'none', pre: `${TAB('nation')} await clk('[data-act="help"]', 1200)` },
  { name: 'drill', ls: 'drill', pre: `${CLICK} await clk('[data-act="dy-title"]', 2500)` },
  { name: 'drillhero', ls: 'drill', pre: `${CLICK} await clk('[data-act="dy-title"]', 2500); await clk('.dyrow', 1200)` },
  { name: 'dex', pre: `${CLICK} await clk('[data-act="dex-open"]', 2500)` },
  { name: 'saves', pre: `${CLICK} await clk('[data-act="save-open-title"]', 1500)` },
  { name: 'boarddetail', pre: `${CLICK} await clk('[data-act="fr-new"]', 1500); await clk('[data-act="fr-board"]', 2000)` },
  { name: 'quarrel', save: 'quarrel-town', pre: '' },
  { name: 'lost', save: 'lost', pre: '' },
  { name: 'captive', save: 'captive', pre: '' },
  // 따로 열리는 쪽 (밤 판 · 겨루기) — 판 계산이 아니라 첫 화면·카드의 글을 잰다
  { name: 'nightrange', url: 'night.html?practice=1', pre: '' },
  { name: 'nightintro', url: 'night.html?seed=7&arrows=8&id=t', pre: '' },
  { name: 'nightrescue', url: `night.html?seed=7&arrows=8&id=t&kind=rescue&who=${encodeURIComponent('소서노')}`, pre: '' },
  { name: 'nightplay', url: 'night.html?seed=7&arrows=8&id=t', pre: `${CLICK} await clk('[data-act="go"]', 2500)` },
  { name: 'duel', url: 'duel.html', pre: '' },
]

const SPLASH_WAIT = `new Promise((res) => { const t0 = Date.now(); const f = () => { const sp = document.getElementById('splash'); if (!sp || sp.classList.contains('out') || getComputedStyle(sp).visibility === 'hidden' || Date.now() - t0 > 60000) setTimeout(res, 500); else setTimeout(f, 200) }; f() })`
const MEASURE = `(() => {
  const vw = innerWidth
  const sig = (e) => { const t = e.tagName.toLowerCase(); const c = typeof e.className === 'string' ? e.className.trim().split(/\\s+/).filter((x) => x && !/^(on|fresh|open|pop|in|out|sel|new|dim)$/.test(x)).slice(0, 2).join('.') : ''; const a = e.getAttribute('data-act') || ''; return t + (c ? '.' + c : '') + (a ? '[' + a + ']' : '') }
  const vis = (e) => { const cs = getComputedStyle(e); if (cs.visibility === 'hidden' || cs.display === 'none') return false; for (let p = e; p && p !== document.body; p = p.parentElement) { const s = getComputedStyle(p); if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) return false } return true }
  const clipped = (e) => { for (let p = e.parentElement; p; p = p.parentElement) { const s = getComputedStyle(p); if (s.overflowX !== 'visible') { const b = p.getBoundingClientRect(); if (b.left >= -1 && b.right <= vw + 1) return true } } return false }
  const txt = (e) => (e.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 40)
  const out = { a: [], b: [], c: [], d: document.documentElement.scrollWidth > vw + 1 || document.body.scrollWidth > vw + 1, lines: {} }
  const seen = {}
  const key = (e) => { const s = sig(e); seen[s] = (seen[s] || 0) + 1; return s + '#' + seen[s] }
  for (const e of document.querySelectorAll('body *')) {
    if (e.closest('.mapwrap, canvas, svg, #splash.out')) continue
    const b = e.getBoundingClientRect()
    if (b.width === 0 || b.height === 0 || !vis(e)) continue
    const cs = getComputedStyle(e)
    const k = key(e)
    if ((b.right > vw + 1 || b.left < -1) && !clipped(e)) out.a.push({ el: sig(e), t: txt(e), l: Math.round(b.left), r: Math.round(b.right) })
    const own = [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim() !== '')
    const isBtn = e.matches('button, .btn, summary, a.btn, label, [data-act], .chip, .stat, .tag')
    if ((own || isBtn) && e.scrollWidth > e.clientWidth + 1 && e.clientWidth > 0 && (cs.overflowX === 'hidden' || cs.overflowX === 'visible' || cs.overflowX === 'clip') && cs.display !== 'inline' && !e.matches('html, body, .ap')) out.b.push({ el: sig(e), t: txt(e), sw: e.scrollWidth, cw: e.clientWidth, ov: cs.overflowX, ell: cs.textOverflow })
    if (isBtn && txt(e) !== '' && e.children.length < 6 && (e.matches('button, .btn, summary, label, .chip, .tag, .stat') || b.height < 90)) {
      const tops = new Set(); const wk = document.createTreeWalker(e, NodeFilter.SHOW_TEXT)
      for (let n = wk.nextNode(); n; n = wk.nextNode()) { if (!n.textContent.trim()) continue; const rg = document.createRange(); rg.selectNodeContents(n); for (const r of rg.getClientRects()) if (r.width > 1) tops.add(Math.round(r.top / 6)) }
      const lines = tops.size
      out.lines[k] = { h: Math.round(b.height), lines, t: txt(e), el: sig(e) }
    }
  }
  return out
})()`

/** 화면의 모든 글 — 보이는 글 · data-why/tip · aria-label (옮기기 전후 한국어가 한 글자도 안 달라졌는지 diff 로 본다) */
const TEXT_DUMP = `(() => { const o = [document.body.innerText]; for (const e of document.querySelectorAll('[data-why],[data-tip],[aria-label],[title]')) o.push(['data-why', 'data-tip', 'aria-label', 'title'].map((a) => e.getAttribute(a) || '').join('|')); return o.join('\\n') })()`

const exe = CHROMES.find((p) => existsSync(p))
if (exe === undefined) throw new Error('크롬을 못 찾았다')
mkdirSync(OUT_DIR, { recursive: true })
mkdirSync(SAVE_DIR, { recursive: true })

/** 단련터 시험 기록이 없으면 tools/drill-seed.ts 로 만든다 */
function ensureLs(): string {
  const f = 'D:/tmp-node/layout-saves/drill-ls.json'
  if (!existsSync(f)) spawnSync('node', ['--experimental-strip-types', 'tools/drill-seed.ts', f], { encoding: 'utf8' })
  return f
}

/** 판 저장이 없으면 tools/phone-save.ts 로 만든다 */
function ensureSave(kind: string): string {
  const f = `${SAVE_DIR}/${kind}.json`
  if (!existsSync(f)) {
    const [k0, adv] = kind.split('@')
    const r = spawnSync('node', ['--experimental-strip-types', 'tools/phone-save.ts', f, k0!], { encoding: 'utf8', env: { ...process.env, ADV: adv ?? '0' } })
    if (!existsSync(f)) throw new Error(`판 저장을 못 만들었다 ${kind}: ${r.stderr}`)
  }
  return readFileSync(f, 'utf8')
}

interface Row { lang: string; w: number; screen: string; a: any[]; b: any[]; c: any[]; d: boolean; err?: string; sameKo?: number }
const rows: Row[] = []
const PART = opt('part')
const JOBS = Number(opt('jobs') ?? 2)
if (PART === undefined && JOBS > 1) {
  // 병렬 — 화면을 나눠 크롬을 여럿 띄운다(한 크롬은 가림막 기다림에 오래 걸린다)
  const t0 = Date.now()
  const names = SCREENS.map((x) => x.name).filter((n) => opt('screen') === undefined || opt('screen')!.split(',').includes(n))
  const n = Math.min(JOBS, names.length)
  const pass: string[] = []
  for (const k of ['lang', 'width', 'port']) if (opt(k) !== undefined) pass.push(`--${k}`, opt(k)!)
  if (flag('ko')) pass.push('--ko')
  const kids = Array.from({ length: n }, (_, i) => {
    const mine = names.filter((_, j) => j % n === i)
    return new Promise<void>((res) => {
      const p = spawn(process.execPath, [...process.execArgv, process.argv[1]!, ...pass, '--part', String(i), '--screen', mine.join(',')], { stdio: ['ignore', 'pipe', 'inherit'], env: process.env })
      p.stdout!.on('data', (d: Buffer) => process.stdout.write(d))
      p.on('exit', () => res())
    })
  })
  await Promise.all(kids)
  for (let i = 0; i < n; i++) { const f = `${OUT_DIR}/part-${i}.json`; if (existsSync(f)) rows.push(...(JSON.parse(readFileSync(f, 'utf8')) as Row[])) }
  const order = (r: Row): number => SCREENS.findIndex((x) => x.name === r.screen) * 100 + (r.lang === 'ko' ? 0 : 10) + WIDTHS.indexOf(r.w)
  rows.sort((x, y) => order(x) - order(y))
  console.log(`걸린 시간 ${Math.round((Date.now() - t0) / 1000)}s (크롬 ${n}개)`)
  report(rows)
}
const prof = mkdtempSync(join(tmpdir(), 'layout-'))
const chrome = spawn(exe, ['--headless=new', `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${prof}`, '--window-size=412,800', '--no-first-run', '--mute-audio', 'about:blank'], { stdio: 'ignore' })

try {
  let tabs: any = null
  for (let i = 0; i < 50 && tabs === null; i++) { try { tabs = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)).json() } catch { await sleep(200) } }
  const page = tabs.find((t: any) => t.type === 'page')
  const ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j })
  let id = 0
  const waits = new Map<number, (v: any) => void>()
  ws.onmessage = (ev) => { const m = JSON.parse(String(ev.data)); if (m.id !== undefined) { waits.get(m.id)?.(m.result ?? m.error); waits.delete(m.id) } }
  const call = (method: string, params: object = {}): Promise<any> => new Promise((r) => { const k = ++id; waits.set(k, r); ws.send(JSON.stringify({ id: k, method, params })) })
  const ev = async (expression: string): Promise<any> => { const r = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text); return r.result?.value }
  await call('Page.enable')

  const only = opt('screen')?.split(',')
  const screens = SCREENS.filter((s) => only === undefined || only.includes(s.name))
  const koLines = new Map<string, any>()
  const koB = new Map<string, Set<string>>()
  if (!LANGS.includes('ko')) for (const f of readdirSync(OUT_DIR).filter((x) => x.startsWith('ko-base-'))) {
    const j = JSON.parse(readFileSync(`${OUT_DIR}/${f}`, 'utf8')) as { lines: [string, any][]; b: [string, string[]][] }
    for (const [k, v] of j.lines) koLines.set(k, v)
    for (const [k, v] of j.b) koB.set(k, new Set(v))
  }
  const t0 = Date.now()
  await call('Page.navigate', { url: `${BASE}?lang=ko` })
  await ev(SPLASH_WAIT) // 첫 판은 모듈을 처음 받아 느리다 — 덥혀 둔다
  for (const s of screens) {
    for (const lg of LANGS) {
      let err: string | undefined
      try {
        await call('Emulation.setDeviceMetricsOverride', { width: WIDTHS[0]!, height: H, deviceScaleFactor: 1, mobile: true })
        await ev(`localStorage.removeItem('hanbal.realm.v2')`).catch(() => 0)
        await ev(`localStorage.removeItem('hanbal.realm.drill'); localStorage.removeItem('hanbal.realm.dex')`).catch(() => 0) // 단련터 시험 기록이 다른 화면에 남지 않게
        if (s.save !== undefined) await ev(`localStorage.setItem('hanbal.realm.v2', ${JSON.stringify(ensureSave(s.save))})`).catch(() => 0)
        if (s.ls === 'drill') for (const [k, v] of Object.entries(JSON.parse(readFileSync(ensureLs(), 'utf8')) as Record<string, unknown>)) await ev(`localStorage.setItem(${JSON.stringify(k)}, ${JSON.stringify(JSON.stringify(v))})`).catch(() => 0)
        await call('Page.navigate', { url: s.url !== undefined ? `http://localhost:${PORT_APP}/${s.url}${s.url.includes('?') ? '&' : '?'}lang=${lg}` : `${BASE}?lang=${lg}` })
        await sleep(400)
        // 스플래시가 걷힐 때까지 (최대 30초)
        await ev(SPLASH_WAIT)
        if (s.save !== undefined) await ev(`(async () => { const b = document.querySelector('[data-act="fr-continue"], [data-act="continue"], [data-act="resume"]'); if (b) { b.click(); await new Promise((r) => setTimeout(r, 2000)) } })()`)
        // 판 들어가는 가림막이 걷힐 때까지
        await ev(`new Promise((res) => { const t0 = Date.now(); const f = () => { const lc = document.querySelector('.loadcov'); if (!lc || Date.now() - t0 > 60000) setTimeout(res, 400); else { lc.click(); setTimeout(f, 200) } }; setTimeout(f, 800) })`)
        if (s.pre !== '') { try { await ev(`(async () => { ${s.pre} })()`) } catch (e) { err = 'PRE ' + String((e as Error).message ?? e).slice(0, 120) } }
        await sleep(400)
      } catch (e) { err = String((e as Error).message ?? e).slice(0, 200) }
      for (const w of WIDTHS) {
        const row: Row = { lang: lg, w, screen: s.name, a: [], b: [], c: [], d: false }
        if (err !== undefined) row.err = err
        try {
          await call('Emulation.setDeviceMetricsOverride', { width: w, height: H, deviceScaleFactor: 1, mobile: true })
          await sleep(300)
          if (flag('dump') && w === WIDTHS[0]) console.log(`[${lg} ${w} ${s.name}]`, JSON.stringify(await ev(`[...document.querySelectorAll('button, a.btn, summary')].filter((e) => e.getBoundingClientRect().width > 0).map((e) => (e.getAttribute('data-act') || e.tagName) + ':' + (e.textContent || '').trim().slice(0, 14)).slice(0, 40)`)))
          if (flag('text') && w === WIDTHS[0]) writeFileSync(`${OUT_DIR}/text-${lg}-${s.name}.txt`, String(await ev(TEXT_DUMP))) // 글자 하나 안 바뀌었는지 옛/새를 비교하는 기록
          const m = await ev(MEASURE)
          row.a = m.a; row.b = m.b; row.d = m.d
          // 한국어에도 같은 칸이 잘리면 영어 탓이 아니다 — 따로 센다
          if (lg === 'ko') koB.set(`${w}|${s.name}`, new Set(m.b.map((x: any) => x.el)))
          else { const kb = koB.get(`${w}|${s.name}`); if (kb !== undefined) { const keep = row.b.filter((x: any) => !kb.has(x.el)); row.sameKo = row.b.length - keep.length; row.b = keep } }
          for (const [k, v] of Object.entries<any>(m.lines)) {
            const kk = `${w}|${s.name}|${k}`
            if (lg === 'ko') koLines.set(kk, v)
            else {
              const ko = koLines.get(kk)
              const grew = ko !== undefined && v.h > ko.h * 1.6 && v.h - ko.h > 10
              if ((v.lines >= 3 && (ko === undefined || v.lines > ko.lines)) || grew) row.c.push({ el: v.el, t: v.t, lines: v.lines, h: v.h, koH: ko?.h })
            }
          }
          const shot = await call('Page.captureScreenshot', { format: 'png' })
          writeFileSync(`${OUT_DIR}/${lg}-${w}-${s.name}.png`, Buffer.from(shot.data, 'base64'))
        } catch (e) { row.err = String((e as Error).message ?? e).slice(0, 200) }
        rows.push(row)
        const n = row.a.length + row.b.length + row.c.length + (row.d ? 1 : 0)
        console.log(`${lg} ${w} ${s.name.padEnd(9)} a${row.a.length} b${row.b.length} c${row.c.length} d${row.d ? 1 : 0}${row.err ? ' ERR ' + row.err : ''}${n === 0 && !row.err ? ' ok' : ''}`)
      }
    }
  }
  if (LANGS.includes('ko')) { // 화면마다 한 파일 — 일부만 돌려도 다른 화면의 기준을 덮지 않는다
    for (const sc of screens) writeFileSync(`${OUT_DIR}/ko-base-${sc.name}.json`, JSON.stringify({ lines: [...koLines].filter(([k]) => k.split('|')[1] === sc.name), b: [...koB].filter(([k]) => k.split('|')[1] === sc.name).map(([k, v]) => [k, [...v]]) }))
  }
  ws.close()
  console.log(`걸린 시간 ${Math.round((Date.now() - t0) / 1000)}s`)
} finally {
  chrome.kill()
  await sleep(500)
  for (let i = 0; i < 12 && existsSync(prof); i++) { try { rmSync(prof, { recursive: true, force: true }) } catch { await sleep(400) } }
}

// 보고서
function report(rows: Row[]): never {
let exitCode = 0
const shown = flag('only-fail') ? rows.filter((r) => r.a.length + r.b.length + r.c.length > 0 || r.d || r.err) : rows
writeFileSync(`${OUT_DIR}/layout-report.json`, JSON.stringify(shown, null, 1))
let md = '| 말 | 폭 | 화면 | a 화면밖 | b 잘림 | c 줄 | d 가로스크롤 |\n|---|---|---|---|---|---|---|\n'
for (const r of shown) md += `| ${r.lang} | ${r.w} | ${r.screen} | ${r.a.length} | ${r.b.length}${r.sameKo ? ` (+ko동일 ${r.sameKo})` : ""} | ${r.c.length} | ${r.d ? 'O' : ''}${r.err ? ' ERR' : ''} |\n`
md += '\n상세 (en/ko 첫 몇 개)\n\n'
for (const r of shown) {
  const lines = [...r.a.slice(0, 4).map((x) => `a ${x.el} "${x.t}" ${x.l}~${x.r}`), ...r.b.slice(0, 4).map((x) => `b ${x.el} "${x.t}" sw${x.sw}>cw${x.cw} ${x.ov}`), ...r.c.slice(0, 4).map((x) => `c ${x.el} "${x.t}" ${x.lines}줄 h${x.h}/ko${x.koH}`)]
  if (lines.length > 0) md += `- ${r.lang} ${r.w} ${r.screen}\n${lines.map((l) => `  - ${l}`).join('\n')}\n`
}
writeFileSync(`${OUT_DIR}/layout-report.md`, md)
console.log(md)
if (rows.some((r) => r.a.length > 0 || r.d)) exitCode = 1
process.exit(exitCode)
}
if (PART !== undefined) { writeFileSync(`${OUT_DIR}/part-${PART}.json`, JSON.stringify(rows)); process.exit(0) }
report(rows)
