/**
 * 열전 레벨업 창 · 각성 단추 · 각성 중(오라·금빛 체력) · 진 비기 컷인 · 피해 숫자(치명타) 찍기 (11-17 형 폰 피드백)
 *   node --experimental-strip-types tools/raid-awaken-probe.ts [나갈 폴더 .] [주소 http://localhost:5174/raid.html?review&background]
 * 폰 가로 844×390 · 세로 390×844 각각 다섯 장. 판은 실제 입력 길(단추 누름 · 개발 손잡이 __raid 로 막대만 채움)로 간다. 런타임 의존성 없음.
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const DIR = process.argv[2] ?? '.'
const URL0 = process.argv[3] ?? 'http://localhost:5174/raid.html?review&background'
const SIZES = [{ w: 844, h: 390, tag: 'land' }, { w: 390, h: 844, tag: 'port' }]
const CHROMES = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe']
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))
const exe = CHROMES.find((p) => existsSync(p))
if (exe === undefined) throw new Error('크롬을 못 찾았다')
let fail = 0
const check = (ok: boolean, what: string): void => { console.log(`${ok ? '통과' : '실패'} ${what}`); if (!ok) fail++ }

for (const S of SIZES) {
  const PORT = 9530 + Math.floor(Math.random() * 40)
  const prof = mkdtempSync(join(tmpdir(), 'awaken-'))
  const chrome = spawn(exe, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${prof}`, `--window-size=${S.w},${S.h}`, '--no-first-run', '--mute-audio', 'about:blank'], { stdio: 'ignore' })
  try {
    let tabs: any = null
    for (let i = 0; i < 50 && tabs === null; i++) { try { tabs = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json() } catch { await sleep(200) } }
    const ws = new WebSocket(tabs.find((t: any) => t.type === 'page').webSocketDebuggerUrl)
    await new Promise((r, j) => { ws.onopen = r; ws.onerror = j })
    let id = 0
    const waits = new Map<number, (v: any) => void>()
    ws.onmessage = (ev) => { const m = JSON.parse(String(ev.data)); if (m.id !== undefined) { waits.get(m.id)?.(m.result ?? m.error); waits.delete(m.id) } }
    const call = (method: string, params: object = {}): Promise<any> => new Promise((r) => { const k = ++id; waits.set(k, r); ws.send(JSON.stringify({ id: k, method, params })) })
    const ev = async (expression: string): Promise<any> => (await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result?.value
    // zoom: 장수 둘레를 두 배로 잘라 찍는다 (오라·숫자를 눈으로 보려고)
    const heroClip = async (): Promise<object> => ev(`(() => { const c = document.getElementById('field').getBoundingClientRect(), r = window.__raid(), k = Math.min(c.width / 1120, c.height / 720), ox = c.left + (c.width - 1120 * k) / 2, oy = c.top + (c.height - 720 * k) / 2; const w = 300 * k, h = 260 * k; return { x: Math.max(0, ox + r.x * k - w / 2), y: Math.max(0, oy + (r.y - 70) * k - h / 2), width: w, height: h, scale: 2 } })()`)
    const shot = async (name: string, clip?: object): Promise<void> => { const r = await call('Page.captureScreenshot', clip ? { format: 'png', clip } : { format: 'png' }); const p = join(DIR, `raid-${name}-${S.tag}.png`); writeFileSync(p, Buffer.from(r.data, 'base64')); console.log('  찍음', p) }
    const tap = async (sel: string): Promise<void> => {
      const b = await ev(`(() => { const r = document.querySelector('${sel}').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 } })()`)
      await call('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: b.x, y: b.y }] }); await sleep(40); await call('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    }
    await call('Emulation.setDeviceMetricsOverride', { width: S.w, height: S.h, deviceScaleFactor: 2, mobile: true })
    await call('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 })
    await call('Emulation.setFocusEmulationEnabled', { enabled: true })
    await call('Page.enable')
    await call('Page.navigate', { url: URL0 })
    await sleep(3000)
    for (let i = 0; i < 80 && await ev(`document.getElementById('start').disabled`) !== false; i++) await sleep(250)
    await ev(`document.getElementById('start').click()`)
    await sleep(1200)
    await ev(`[...document.querySelectorAll('.review-tools button')].find(b => b.textContent === '검수 도구 닫기')?.click()`)
    const portrait = S.h > S.w
    // 첫 고름 넘기기 (레벨 1 카드)
    await ev(`document.querySelector('#overlay:not([hidden]) .choices button')?.click()`)
    // 1) 레벨업 창: 칸 몇 개를 들고 (끝 단계 하나 포함) 레벨업을 연다
    await ev(`(() => { const r = window.__raid(); r.level = 12; Object.assign(r.ranks, { tempo: 5, reach: 2, ember: 3, thunder: 1, echo: 1, tough: 2 }); r.xp = 1e6 })()`)
    if (portrait) await ev(`(() => { const r = window.__raid(); r.offers = ['gale', 'nimble', 'tough']; document.getElementById('rotate-guide').hidden = true })()`)
    for (let i = 0; i < 20 && await ev(`!document.querySelector('#overlay:not([hidden]) .choices')`); i++) await sleep(150)
    if (portrait) await ev(`document.getElementById('rotate-guide').hidden = true`)
    await sleep(300)
    const lv = await ev(`(() => ({ have: document.querySelectorAll('.lv-have .have').length, labels: [...document.querySelectorAll('.choices small.gain')].map(x => x.textContent), tags: [...document.querySelectorAll('.choices .branch-tag')].map(x => x.textContent), tempo: [...document.querySelectorAll('.choices [data-up]')].some(b => b.dataset.up === 'tempo') }))()`)
    check(lv.have >= 6, `레벨업 창 좌상단 가진 칸 ${lv.have}개`)
    check(lv.labels.every((x: string) => x === '+1' || x === '획득'), `카드 위 표기 ${lv.labels.join(',')}`)
    check(lv.tags.every((x: string) => !/점/.test(x)), `갈래 띠 ${lv.tags.join(',')}`)
    check(!lv.tempo, '끝 단계(기세 5/5)는 카드에 안 나온다')
    const tool = await ev(`(() => { const rs = [...document.querySelectorAll('.lv-have .have')].map(x => x.getBoundingClientRect()), a = { left: Math.min(...rs.map(r => r.left)), right: Math.max(...rs.map(r => r.right)), top: Math.min(...rs.map(r => r.top)), bottom: Math.max(...rs.map(r => r.bottom)) }, b = document.getElementById('tree-open').getBoundingClientRect(), c = document.querySelector('.choices').getBoundingClientRect(); return { overTree: !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom), overCards: a.bottom > c.top + 2 } })()`)
    check(!tool.overTree && !tool.overCards, '가진 칸이 나무 단추·카드와 안 겹친다')
    await shot('levelup')
    if (portrait) { ws.close(); continue }
    await ev(`(() => { const r = window.__raid(); r.xp = 0 })()`)
    await ev(`document.querySelector('#overlay .choices button').click()`)
    await sleep(400)
    // 2) 각성 단추: 막대를 채우면 뜬다 (저절로 각성하지 않는다)
    await ev(`(() => { const r = window.__raid(); r.gauge = 1e6; r.hp = r.maxHp * .7 })()`)
    await sleep(500)
    check(await ev(`!document.getElementById('wake').hidden && window.__raid().form === 'normal'`) === true, '막대가 차면 각성 단추가 뜨고 기다린다')
    const wb = await ev(`(() => { const a = document.getElementById('wake').getBoundingClientRect(), o = ['dash', 'skill'].map(id => document.getElementById(id).getBoundingClientRect()); return o.every(b => a.right < b.left || a.left > b.right || a.bottom <= b.top || a.top >= b.bottom) })()`)
    check(wb === true, '각성 단추가 회피·비기 단추와 안 겹친다')
    await shot('wake-button')
    // 3) 누르면 각성 컷인 (큰 판)
    await tap('#wake')
    await sleep(120)
    check(await ev(`window.__raid().form === 'awake' && window.__raid().cast?.kind === 'wake'`) === true, '단추를 누르면 각성 · 각성 시전')
    await sleep(380)
    await shot('wake-cutin')
    for (let i = 0; i < 30 && await ev(`!!window.__raid().cast`); i++) await sleep(100)
    // 4) 각성 중: 오라 · 금빛 체력 · 피해 숫자 (치명타가 잘 나오게 행운을 채운다 · 둘레에 적)
    await ev(`(() => { const r = window.__raid(); r.bonus.luck = 12; r.formT = 60; for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2; r.enemies.push({ id: 90000 + i, x: r.x + Math.cos(a) * (70 + i % 3 * 30), y: r.y + Math.sin(a) * (50 + i % 3 * 20), hp: 3e4, max: 3e4, kind: 'club', cd: 99, flash: 0, wind: 0, aimX: 0, aimY: 0, act: 0, vx: 0, vy: 0, buff: 0, poison: 0, pdps: 0, daze: 0 }) } })()`)
    await sleep(900)
    check(await ev(`document.getElementById('combat-hud').classList.contains('awake')`) === true, '각성 동안 체력 막대가 금빛')
    await shot('awake')
    await shot('awake-zoom', await heroClip())
    // 5) 진 비기 컷인 (각성 중 비기)
    await ev(`window.__raid().skillCd = 0`)
    await tap('#skill')
    await sleep(150)
    const ult = await ev(`(() => { const r = window.__raid(); return { tru: !!r.cast?.tru, title: document.querySelector('#skill-cutin .cbd-ttl b')?.textContent, grand: !!document.querySelector('#skill-cutin .cbd.grand') } })()`)
    check(ult.tru && /^진 /.test(ult.title ?? '') && ult.grand, `진 비기 컷인 · ${ult.title}`)
    await sleep(450)
    await shot('true-ult-cutin')
    for (let i = 0; i < 30 && await ev(`!!window.__raid().cast`); i++) await sleep(50)
    await sleep(120)
    await shot('true-ult-hit')
    await shot('numbers-zoom', await heroClip())
    ws.close()
  } finally {
    chrome.kill()
    await sleep(500)
    for (let i = 0; i < 12 && existsSync(prof); i++) { try { rmSync(prof, { recursive: true, force: true }) } catch { await sleep(400) } }
  }
}
console.log(fail ? `실패 ${fail}` : '모두 통과')
