/**
 * 맞은 초상 찍기 (11-17 · ui/hit-portrait.ts) — 열전 왼쪽 초상 판 · 겨루기 적장 액자와 얼굴이 맞는 순간을 폰 가로 844×390 에서 찍는다.
 *   node --experimental-strip-types tools/hit-portrait-probe.ts [나갈 폴더 .] [뿌리 http://localhost:5174]
 * 열전: 개발 손잡이 __raid 로 큰 피해 한 번 → 애니를 맞은 뒤 u 지점에 세워 찍는다.
 * 겨루기: 개발 손잡이 __duelEvent 로 화면 사건(치명 · 맞음) 하나 → rAF 시각을 맞은 뒤 ms 에 묶어 찍는다. 런타임 의존성 없음 · 5174 만.
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const DIR = process.argv[2] ?? '.'
const ROOT = process.argv[3] ?? 'http://localhost:5174'
const S = { w: 844, h: 390 }
const CHROMES = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe']
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))
const exe = CHROMES.find((p) => existsSync(p))
if (exe === undefined) throw new Error('크롬을 못 찾았다')
let fail = 0
const check = (ok: boolean, what: string): void => { console.log(`${ok ? '통과' : '실패'} ${what}`); if (!ok) fail++ }

async function page(run: (ev: (x: string) => Promise<any>, shot: (name: string, clip?: object) => Promise<void>) => Promise<void>): Promise<void> {
  const PORT = 9580 + Math.floor(Math.random() * 40)
  const prof = mkdtempSync(join(tmpdir(), 'hitp-'))
  const chrome = spawn(exe!, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${prof}`, `--window-size=${S.w},${S.h}`, '--no-first-run', '--mute-audio', 'about:blank'], { stdio: 'ignore' })
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
    const shot = async (name: string, clip?: object): Promise<void> => { const r = await call('Page.captureScreenshot', clip ? { format: 'png', clip } : { format: 'png' }); const p = join(DIR, `hit-${name}.png`); writeFileSync(p, Buffer.from(r.data, 'base64')); console.log('  찍음', p) }
    await call('Emulation.setDeviceMetricsOverride', { width: S.w, height: S.h, deviceScaleFactor: 2, mobile: true })
    await call('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 })
    await call('Emulation.setFocusEmulationEnabled', { enabled: true })
    await call('Page.enable')
    await run(async (x) => ev(x), shot)
    await call('Page.navigate', { url: 'about:blank' })
    ws.close()
  } finally {
    chrome.kill()
    await sleep(500)
    for (let i = 0; i < 12 && existsSync(prof); i++) { try { rmSync(prof, { recursive: true, force: true }) } catch { await sleep(400) } }
  }
}
const nav = (url: string) => `location.href = ${JSON.stringify(url)}`

// ── 열전
await page(async (ev, shot) => {
  await ev(nav(`${ROOT}/raid.html?review&background`))
  await sleep(3000)
  for (let i = 0; i < 80 && await ev(`document.getElementById('start')?.disabled`) !== false; i++) await sleep(250)
  await ev(`document.getElementById('start').click()`)
  await sleep(1200)
  await ev(`[...document.querySelectorAll('.review-tools button')].find(b => b.textContent === '검수 도구 닫기')?.click()`)
  await ev(`document.querySelector('#overlay:not([hidden]) .choices button')?.click()`)
  await sleep(600)
  await shot('raid-before')
  const charClip = await ev(`(() => { const r = document.getElementById('character').getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: r.height, scale: 2 } })()`)
  // 큰 피해 (최대 체력 15%) · 작은 피해 (3%) — 판이 맞을 때처럼 hurt 를 새로 세운다
  for (const [tag, loss] of [['raid-big', .15], ['raid-small', .03]] as const) {
    await ev(`document.querySelector('#portrait-media > .hitp')?.remove()`)
    await ev(`(() => { const r = window.__raid(); r.inv = 9; r.hp = Math.max(1, r.hp - r.maxHp * ${loss}); r.hurt = .3 })()`)
    for (let i = 0; i < 60 && !await ev(`!!document.querySelector('#portrait-media > .hitp')`); i++) await sleep(30)
    if (!await ev(`!!document.querySelector('#portrait-media > .hitp')`)) { console.log('  겉막 없음', await ev(`(() => { const r = window.__raid(); return JSON.stringify({ hurt: r.hurt, hp: r.hp, state: r.state, offers: r.offers.length, play: !document.getElementById('play').hidden, vis: document.visibilityState }) })()`)); fail++; continue }
    // 애니를 u≈0.12 (붉은 빛 꼭대기 지남 · 금 · 빛 빠짐 · 흔들림 왼쪽) 에 세운다
    const got = await ev(`(() => { const ms = parseFloat(getComputedStyle(document.querySelector('#portrait-media > .hitp')).getPropertyValue('--hitp-ms')); const as = document.getAnimations(); for (const a of as) { a.pause(); a.currentTime = ms * .12 } return { ms, n: as.length, shake: as.some(a => a.effect?.target?.id === 'portrait-media') } })()`)
    check(got.ms > 0 && got.shake, `${tag}: 겉막 ${got.ms}ms · 초상 판 흔들림 있음`)
    await sleep(120)
    await shot(tag)
    await shot(tag + '-zoom', charClip)
    await ev(`document.getAnimations().forEach(a => a.finish())`)
    await ev(`window.__raid().inv = 0`)
    await sleep(400)
  }
  const look = await ev(`(() => { const h = document.querySelector('#portrait-media > .hitp'); const cs = getComputedStyle(h); return { red: cs.getPropertyValue('--hitp-red'), crack: !!h.querySelector('svg.hitp-crack path.l') } })()`)
  check(look.crack, `금 줄 있음 · 붉은 빛 ${look.red}`)
  check(await ev(`!getComputedStyle(document.getElementById('portrait-media')).filter || getComputedStyle(document.getElementById('portrait-media')).filter === 'none'`) === true, '초상 판에 filter 없음')
})

// ── 겨루기
await page(async (ev, shot) => {
  await ev(nav(`${ROOT}/duel.html?me=aryeong&foe=haebi&seed=3`))
  await sleep(3500)
  await ev(`document.querySelector('.dflag')?.click()`)
  for (let i = 0; i < 40 && await ev(`window.__duelMode?.()`) !== 'intro'; i++) await sleep(200)
  await sleep(600)
  await ev(`document.querySelector('.dskip')?.click()`)
  for (let i = 0; i < 40 && await ev(`window.__duelMode?.()`) !== 'duel'; i++) await sleep(200)
  await sleep(1500)
  // 치명은 화면 전체 흰 번쩍임이 걷힌 110ms 에 · 맞음은 40ms 에 · 가운데 액자와 양쪽 얼굴을 두 배로 한 장 더
  for (const [tag, e, at] of [['duel-foe-crit', { kind: 'crit', t: 1, dmgMe: 0, dmgFoe: 60 }, 110], ['duel-me-miss', { kind: 'miss', t: 1, dmgMe: 22, dmgFoe: 0 }, 40]] as const) {
    // rAF 시각을 맞은 뒤 at ms 에 묶는다 (그림이 그 순간에 선다) → 찍고 풀기
    await ev(`(() => { const t0 = window.__duelEvent(${JSON.stringify(e)}); window.__rafOrig = window.__rafOrig ?? window.requestAnimationFrame.bind(window); window.requestAnimationFrame = cb => window.__rafOrig(() => cb(t0 + ${at})) })()`)
    await sleep(300)
    await shot(tag)
    await shot(tag + '-zoom', { x: 0, y: 0, width: S.w, height: 250, scale: 2 })
    await ev(`window.requestAnimationFrame = window.__rafOrig`)
    await sleep(700)
  }
  console.log('  겨루기 판:', await ev(`window.__duelMode()`))
})
console.log(fail ? `실패 ${fail}` : '모두 통과')
