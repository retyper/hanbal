/**
 * 스팀 상점 스크린샷 — 헤드리스 크롬 1920×1080 으로 STEAM-STORE.md §5 의 여덟 장면을 찍는다 (형 11-11).
 *
 *   npx tsx tools/store-shots.ts [--scene 1,2,..|이름,..] [--port 5174] [--no-phone] [--probe]
 *   TMP='D:\tmp-node' TEMP='D:\tmp-node'  (크롬 임시 폴더가 C 드라이브에 쌓이지 않게)
 *
 * 출력: D:/tmp-node/store/<n>-<name>.png (1920×1080) · tools/out/store/ 에 같은 것 (tools/out/ 은 gitignore — PNG 는 커밋하지 않는다)
 *       세로 4장(1080×1920): phone-<n>-<name>.png — 폰 상점용 (같은 두 폴더)
 * 개발 서버(5174)가 떠 있어야 한다 — 개발판 전용 시험 손잡이(__sparWake · __sparDuel)를 쓴다. 끝나면 실패한 장면을 적고, 하나라도 실패하면 나가는 값이 1.
 * 판은 헤드리스의 임시 프로필에만 넣는다 — 형의 진짜 저장 칸은 건드리지 않는다.
 * 런타임 의존성 없음 — 크롬 원격 디버깅(CDP)을 Node 내장 WebSocket 으로 (tools/phone-shot.ts 와 같은 길).
 */
import { spawn, spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const argv = process.argv.slice(2)
const opt = (n: string): string | undefined => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : undefined }
const flag = (n: string): boolean => argv.includes(`--${n}`)
const PORT_APP = opt('port') ?? '5174'
const BASE = `http://localhost:${PORT_APP}`
const OUT = 'D:/tmp-node/store'
const COPY = 'tools/out/store'
const SAVE_DIR = 'D:/tmp-node/store-saves'
const CDP_PORT = 9600 + Math.floor(Math.random() * 50)
const CHROMES = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe']
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

const exe = CHROMES.find((p) => existsSync(p))
if (exe === undefined) throw new Error('크롬을 못 찾았다')
for (const d of [OUT, COPY, SAVE_DIR]) mkdirSync(d, { recursive: true })

/** 판 저장(tools/phone-save.ts) — 없으면 만든다. kind[@계절 더 넘기기] */
function ensureSave(kind: string, env: Record<string, string> = {}): string {
  const tag = `${kind}${Object.keys(env).length > 0 ? '-' + Object.values(env).join('') : ''}`.replace('@', 'a')
  const f = `${SAVE_DIR}/${tag}.json`
  if (!existsSync(f)) {
    const [k0, adv] = kind.split('@')
    const r = spawnSync('node', ['--experimental-strip-types', 'tools/phone-save.ts', f, k0!], { encoding: 'utf8', env: { ...process.env, ADV: adv ?? '0', ...env } })
    if (!existsSync(f)) throw new Error(`판 저장을 못 만들었다 ${kind}: ${r.stderr}`)
  }
  return readFileSync(f, 'utf8')
}

/** 페이지 안 도우미 — 이름 붙은 단추가 나올 때까지 기다려 누른다 */
const HELP = `
const w = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (f, n = 150, ms = 200) => { for (let i = 0; i < n; i++) { const v = f(); if (v) return v; await w(ms) } throw new Error('기다림 끝 ' + String(f).slice(0, 90)) };
const q = (s) => document.querySelector(s);
const clk = async (sel, ms = 900) => { const e = await until(() => q(sel)); e.click(); await w(ms) };
const SHUT = async () => { const rc = q('[data-act="rep-close"]'); if (rc) { rc.click(); await w(900) } };
`

/** 장면 손놀림에 건네는 도구 */
interface Act { call: (m: string, p?: object) => Promise<any>; ev: (e: string) => Promise<any>; sleep: (ms: number) => Promise<void> }

interface Scene {
  n: number
  name: string
  /** 저장 판 (phone-save.ts 갈래) */
  save?: string
  saveEnv?: Record<string, string>
  /** 판 저장을 넣었으면 이어하기를 눌러 들어간다 */
  cont?: boolean
  /** 주소 (기본 realm.html) */
  url?: string
  /** 찍기 전 페이지에서 도는 식 */
  pre: string
  /** 판 저장을 고쳐 넣는다 (판 json 을 받아 제자리에서) */
  patch?: (j: any) => void
  /** 저장 칸에 더 넣을 것 (영웅전 기록 등) */
  ls?: () => Promise<Record<string, string>>
  /** 화면을 이만큼 키워 찍는다 (뷰포트 1920/z × 1080/z · 배율 z — 폰 틀 카드가 1920 에서 너무 작을 때) */
  zoom?: number
  /** 마우스·키 같은 손놀림 — 식(pre) 뒤 · 찍기 전에 */
  act?: (c: Act) => Promise<void>
  /** 세로판도 찍나 */
  phone?: boolean
  /** 찍기 전 더 기다림 */
  wait?: number
}

const SCENES: Scene[] = [
  { n: 1, name: 'capture', pre: '', phone: true },
  { n: 2, name: 'awaken', save: 'none@2', saveEnv: { REGION: 'byeonhan-mini', NATION: 'guya' }, cont: true, pre: '', phone: true },
  { n: 3, name: 'duel', url: '/duel.html?me=aryeong&foe=haebi&muMe=5&muFoe=5&tier=1&seed=1', pre: '' },
  { n: 4, name: 'map', save: 'none@10', saveEnv: { REGION: 'south', NATION: 'guya' }, cont: true, patch: noFog, pre: '' },
  { n: 5, name: 'persuade', save: 'woo0', saveEnv: { REGION: 'byeonhan-mini', NATION: 'guya' }, cont: true, zoom: 1.3, pre: '', phone: true },
  { n: 6, name: 'palace', save: 'palace', saveEnv: { PALACE: '4', REGION: 'byeonhan-mini', NATION: 'guya' }, cont: true, patch: richCapital, pre: '' },
  { n: 7, name: 'night', url: '/night.html?kind=rescue&who=%EC%86%8C%EC%84%9C%EB%85%B8&seed=3', pre: '', act: nightAim },
  { n: 8, name: 'dex', ls: dexAllLs, pre: '', phone: true },
]

/** 밤 지붕 — 「들어간다」를 누르고 활을 당기는 중(누른 채 뒤로 끈 모습)에서 찍는다 */
async function nightAim(c: Act): Promise<void> {
  await c.ev(`(async () => { const b = [...document.querySelectorAll('button')].find((x) => /들어간다/.test(x.textContent || '')); if (b) b.click(); await new Promise((r) => setTimeout(r, 2500)) })()`)
  await c.call('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 960, y: 760 })
  await c.call('Input.dispatchMouseEvent', { type: 'mousePressed', x: 960, y: 760, button: 'left', buttons: 1, clickCount: 1 })
  for (let i = 1; i <= 12; i++) { await c.call('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 960 - i * 9, y: 760 + i * 14, buttons: 1 }); await c.sleep(60) }
  await c.sleep(500)
}

/** 안개를 걷는다 — 모두가 모두를 알고 땅도 다 본 판 (스크린샷에 나라가 여럿 보이게) */
function noFog(j: any): void {
  const r = j.realm
  delete r.known
  // 군대마다 이웃 남의 고을로 행군을 건다 (행군 화살이 지도에 선다) — 한 나라에 둘씩
  const seenBy: Record<string, number> = {}
  for (const a of Object.values<any>(r.armies)) {
    if (a.march !== null && a.march !== undefined) continue
    if ((seenBy[a.faction] ?? 0) >= 2) continue
    const e: any = Object.values<any>(r.edges).find((x) => (x.a === a.at && r.nodes[x.b]?.owner !== a.faction) || (x.b === a.at && r.nodes[x.a]?.owner !== a.faction))
    if (e === undefined) continue
    const to = e.a === a.at ? e.b : e.a
    a.march = { from: a.at, to, edge: e.id, left: 2, ambush: false, aim: r.nodes[to]?.owner ?? null }
    seenBy[a.faction] = (seenBy[a.faction] ?? 0) + 1
  }
  const me = r.intel[r.player] ??= {}
  for (const id of Object.keys(r.nodes)) me[id] ??= { land: true, force: null, alert: null }
}

/** 도읍을 번듯하게 — 일터가 여럿 서고 솟대 숲이 선 마을 안 (판 json 을 제자리에서 고친다) */
function richCapital(j: any): void {
  const r = j.realm
  const cap = r.factions[r.player].capital
  r.nodes[cap] = { ...r.nodes[cap], lots: { paddy: 3, smelter: 2, market: 2, yard: 2 }, lotsOpen: 2, wonder: 'sotdae' }
}

/** 영웅전 — 모든 장수가 만남·사로잡음·거느림·각성까지 켜진 기록 + 각성 초상으로 보기 */
async function dexAllLs(): Promise<Record<string, string>> {
  const { dexCatalog } = await import('../src/realm/dex.ts')
  const dex: Record<string, { f: number }> = {}
  for (const h of dexCatalog()) dex[h.id] = { f: 31 }
  return { 'hanbal.realm.dex': JSON.stringify(dex), 'hanbal.realm.dexAwakeAll': '1' }
}

async function main(): Promise<number> {
  const only = opt('scene')?.split(',')
  const scenes = SCENES.filter((s) => only === undefined || only.includes(String(s.n)) || only.includes(s.name))
  const prof = mkdtempSync(join(tmpdir(), 'store-'))
  const chrome = spawn(exe!, ['--headless=new', `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${prof}`, '--window-size=1920,1080', '--no-first-run', '--mute-audio', '--autoplay-policy=no-user-gesture-required', `--user-agent=${UA}`, 'about:blank'], { stdio: 'ignore' })
  const failed: string[] = []
  try {
    let tabs: any = null
    for (let i = 0; i < 50 && tabs === null; i++) { try { tabs = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)).json() } catch { await sleep(200) } }
    const page = tabs.find((t: any) => t.type === 'page')
    const ws = new WebSocket(page.webSocketDebuggerUrl)
    await new Promise((r, j) => { ws.onopen = r; ws.onerror = j })
    let id = 0
    const waits = new Map<number, (v: any) => void>()
    ws.onmessage = (e) => { const m = JSON.parse(String(e.data)); if (m.id !== undefined) { waits.get(m.id)?.(m.result ?? m.error); waits.delete(m.id) } }
    const call = (method: string, params: object = {}): Promise<any> => new Promise((r) => { const k = ++id; waits.set(k, r); ws.send(JSON.stringify({ id: k, method, params })) })
    const ev = async (expression: string): Promise<any> => { const r = await Promise.race([call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }), sleep(120000).then(() => { throw new Error('페이지 식이 2분 안에 안 끝났다') })]); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text); return r.result?.value }
    await call('Page.enable')
    await call('Network.setUserAgentOverride', { userAgent: UA })
    const shot = async (file: string): Promise<void> => {
      const s = await call('Page.captureScreenshot', { format: 'png' })
      writeFileSync(file, Buffer.from(s.data, 'base64'))
    }
    // 스플래시·가림막이 걷힐 때까지 (가림막은 눌러 걷는다)
    const SPLASH = `new Promise((res) => { const t0 = Date.now(); const f = () => { const sp = document.getElementById('splash'); const lc = document.querySelector('.loadcov'); if (lc) lc.click(); if (((!sp || sp.classList.contains('out') || getComputedStyle(sp).visibility === 'hidden') && !lc) || Date.now() - t0 > 60000) setTimeout(res, 600); else setTimeout(f, 200) }; f() })`
    for (const sc of scenes) {
      const base = `${sc.n}-${sc.name}`
      try {
        await call('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false })
        await call('Page.navigate', { url: `${BASE}/realm.html?lang=ko` })
        await sleep(1500)
        await ev(`localStorage.removeItem('hanbal.realm.v2')`).catch(() => 0)
        if (sc.save !== undefined) { let txt = ensureSave(sc.save, sc.name === 'map' && opt('region') !== undefined ? { ...sc.saveEnv, REGION: opt('region')! } : sc.saveEnv); if (sc.patch !== undefined) { const j = JSON.parse(txt); sc.patch(j); txt = JSON.stringify(j) } await ev(`localStorage.setItem('hanbal.realm.v2', ${JSON.stringify(txt)})`) }
        if (sc.ls !== undefined) for (const [k, v] of Object.entries(await sc.ls())) await ev(`localStorage.setItem(${JSON.stringify(k)}, ${JSON.stringify(v)})`)
        await call('Page.navigate', { url: `${BASE}${sc.url ?? '/realm.html?lang=ko'}` })
        await sleep(600)
        await ev(SPLASH)
        if (flag('probe')) console.log(base, 'visibility', await ev('document.visibilityState'))
        if (sc.cont === true) await ev(`(async () => { ${HELP} const b = document.querySelector('[data-act="fr-continue"], [data-act="continue"], [data-act="resume"]'); if (b) { b.click(); await w(2500) } await SHUT() })()`)
        await ev(SPLASH)
        const code = (opt('pre-js') !== undefined ? readFileSync(opt('pre-js')!, 'utf8') : (SCENE_PRE[sc.name] ?? '')) + sc.pre
        if (code !== '') { const rv = await ev(`(async () => { ${HELP} ${code} })()`); if (flag('probe') && rv !== undefined) console.log(base, '→', rv) }
        if (sc.act !== undefined) await sc.act({ call, ev, sleep })
        if (sc.zoom !== undefined) { await call('Emulation.setDeviceMetricsOverride', { width: Math.round(1920 / sc.zoom), height: Math.round(1080 / sc.zoom), deviceScaleFactor: sc.zoom, mobile: false }); await sleep(900) }
        await sleep(sc.wait ?? 600)
        // --frames N — 개발용: N장을 1.5초마다 더 찍어 알맞은 순간을 고른다 (D:/tmp-node/store/dbg-*.png)
        for (let i = 0; i < Number(opt('frames') ?? 0); i++) { await shot(`${OUT}/dbg-${base}-${i}.png`); await sleep(Number(opt('frame-ms') ?? 1500)) }
        await shot(`${OUT}/${base}.png`)
        copyFileSync(`${OUT}/${base}.png`, `${COPY}/${base}.png`)
        console.log('찍음', base)
        if (sc.phone === true && !flag('no-phone')) {
          await call('Emulation.setDeviceMetricsOverride', { width: 540, height: 960, deviceScaleFactor: 2, mobile: true })
          await sleep(1200)
          const pf = `phone-${base}.png`
          await shot(`${OUT}/${pf}`)
          copyFileSync(`${OUT}/${pf}`, `${COPY}/${pf}`)
          console.log('찍음', pf)
        }
      } catch (e) {
        failed.push(`${base}: ${String((e as Error).message ?? e).slice(0, 200)}`)
        try { await shot(`${OUT}/FAIL-${base}.png`) } catch { /* 찍지 못함 */ }
      }
    }
    ws.close()
  } finally {
    chrome.kill()
    await sleep(500)
    for (let i = 0; i < 12 && existsSync(prof); i++) { try { rmSync(prof, { recursive: true, force: true }) } catch { await sleep(400) } }
  }
  if (failed.length > 0) console.log('\n실패한 장면\n' + failed.map((x) => ' - ' + x).join('\n'))
  else console.log('\n전부 찍었다')
  return failed.length > 0 ? 1 : 0
}

/** 장면마다 찍기 전 페이지에서 도는 식 (이름 → 코드) */
const SCENE_PRE: Record<string, string> = {
  // 지도 — 우리 도읍을 가운데로 두고 휠로 한 단 당긴다 (맨 처음 틀은 멀리서 봐 나라가 작다 · 아래 빈 띠도 가려진다)
  map: `await w(2500); const cap = q('.tok'); const wrap = q('.mapwrap'); if (cap && wrap) { const b = cap.getBoundingClientRect(); for (let i = 0; i < 2; i++) { wrap.dispatchEvent(new WheelEvent('wheel', { clientX: b.left + b.width / 2, clientY: b.top + b.height / 2, deltaY: -260, bubbles: true, cancelable: true })); await w(250) } await w(2500) }`,
  // 도읍 안으로 — 도읍 말고 고을 하나씩 눌러 「들어가기」 가 있는 곳을 찾는다 (layout-check 의 town 과 같은 길)
  palace: `for (const n of document.querySelectorAll('.nd:not([data-act])')) { n.click(); await w(900); if (q('[data-act="town-in"]')) break } await clk('[data-act="town-in"]', 4000);`,
  persuade: `const t = q('[data-act="dp-talk"]'); if (t) { t.click(); await w(2500) } const a = q('[data-act="dp-sel"]'); if (a) { a.click(); await w(600); const say = q('[data-act="dp-say"]'); if (say) { say.click(); await w(2800) } }`,
  dex: `await clk('[data-act="dex-open"]', 3500);`,
  // 오프닝 6번 장면(생포 · 포승줄 떨림) — 시계가 27초에 6번에 들어가고 떨림은 1.2·2.4·3.6초 — 그 사이를 찍는다
  capture: `const hide = document.createElement('style'); hide.textContent = '#opening .opskip{display:none}'; document.head.appendChild(hide); await clk('.fmore summary', 600); await clk('[data-act="opening-open"]', 100); await w(29700);`,
  awaken: `window.__ascend('guya-3'); await w(8800);`,
  duel: `await clk('.dflag', 3500);`,
}

process.exit(await main())
