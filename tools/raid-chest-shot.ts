/**
 * 열전 보물 상자 연출 찍기 (60-JACKPOT · src/raid/chest-show.ts) — 헤드리스 크롬으로 판을 열고, 단계(1·3·5·8개)마다 연출의 여러 순간을 찍는다.
 *
 *   node --experimental-strip-types tools/raid-chest-shot.ts [나갈 폴더] [ROOT http://127.0.0.1:5286] [크기 844x390,390x844,1280x720] [단계 1,3,5,8]
 *   GFX=low 저사양 판 · KIT=axe · EXTRA=0 이면 중간 보스 상자 · 멈춤 창 · 확률 상자는 안 찍는다
 *
 * 하는 일: 출전 → 판 상태(개발 손잡이 __raid)에 「이미 터진 상자」를 끼운다 → 화면이 그것을 보고 연출을 연다 (판의 셈은 건드리지 않는 진짜 화면 길).
 * 차례표(chestShowPlan)의 순간마다 찍고, 그때의 겹 자리(상자·결과 줄·「눌러!」가 화면 안인가)와 HUD 칸이 보였는가를 적는다. 대박은 멎은 틀을 찍고 「눌러!」를 진짜로 누른다.
 * 런타임 의존성 없음 · 임시 크롬 프로필은 끝나면 지운다 · 형의 크롬·저장 칸은 건드리지 않는다.
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chestShowPlan } from '../src/raid/chest-show.ts'

const OUT = process.argv[2] ?? 'tools/out/chest-shot'
const ROOT = process.argv[3] ?? 'http://127.0.0.1:5286'
const SIZES = (process.argv[4] ?? '844x390,390x844,1280x720').split(',').map(s => s.split('x').map(Number) as [number, number])
const TIERS = (process.argv[5] ?? '1,3,5,8').split(',').map(Number)
const GFX = process.env['GFX'] ?? '', KIT = process.env['KIT'] ?? 'axe', EXTRA = process.env['EXTRA'] !== '0'
const CHROMES = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe']
const sleep = (ms: number): Promise<void> => new Promise(r => setTimeout(r, ms))
const exe = CHROMES.find(p => existsSync(p))
if (exe === undefined) throw new Error('크롬을 못 찾았다')
mkdirSync(OUT, { recursive: true })

/** 단계마다 끼울 상자 — 도끼 묶음 · 새로 연 조합(합쳐지는 컷)이 3개부터 들어간다 */
const CASES: Record<number, { picks: string[]; opened: string[] }> = {
  1: { picks: ['hone'], opened: [] },
  3: { picks: ['cyclone', 'cyclone', 'capA'], opened: ['cyclone'] },
  5: { picks: ['cyclone', 'cyclone', 'hone', 'capA', 'echo'], opened: ['cyclone'] },
  8: { picks: ['inferno', 'inferno', 'cyclone', 'capA', 'capA', 'hone', 'drill', 'thunder'], opened: ['inferno', 'cyclone'] },
}
/** 판을 연출이 잘 보이는 꼴로 — 능력 칸이 여럿 있는 중반 판 · 죽지 않게 · 카드 창은 닫아 둔다 */
const SETUP = `(() => { const r = window.__raid(); r.hp = r.maxHp = 9999; r.xp = 0; r.offers = []; r.level = 14
  Object.assign(r.ranks, { axe: 4, gale: 3, reach: 2, ember: 3, thunder: 3, echo: 1, tempo: 2, tough: 2, hone: 1, drill: 1 })
  if (!r.combos.includes('torrent')) { r.combos.push('torrent'); r.comboRanks.torrent = 1 } return r.kit })()`
const inject = (count: number, id: number) => `(() => { const r = window.__raid(), c = ${JSON.stringify(CASES[count])}
  r.xp = 0; r.offers = []
  for (const p of c.picks) { if (p in r.ranks) r.ranks[p]++; else { if (!r.combos.includes(p)) r.combos.push(p); r.comboRanks[p] = (r.comboRanks[p] ?? 0) + 1 } }
  r.jackpots.ranks += c.picks.length
  r.chests.push({ id: ${id}, eliteId: 0, x: r.x, y: r.y, bornAt: r.t, pickedAt: r.t, state: 'claimed', choicesRemaining: 0, gold: 0, large: true, jackpot: { count: ${count}, picks: c.picks, opened: c.opened, bonus: 0 } })
  return true })()`
/** 겹 자리 — 화면 밖으로 나간 것이 있나 · HUD 칸이 덮이지 않았나 */
const PROBE = `(() => { const q = s => document.querySelector(s), box = e => { if (!e) return null; const b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.right), Math.round(b.bottom)] }
  const out = b => !!b && (b[0] < 0 || b[1] < 0 || b[2] > innerWidth || b[3] > innerHeight)
  const slot = q('#loadout .power-slot'), sb = slot?.getBoundingClientRect(), top = sb ? document.elementFromPoint(sb.left + sb.width / 2, sb.top + sb.height / 2) : null
  const stage = box(q('#chest-show .cs-stage')), row = box(q('#chest-show .cs-row')), push = box(q('#chest-show .cs-push:not([hidden])'))
  return { stage, row, push, outside: [out(stage) && 'stage', out(row) && 'row', out(push) && 'push'].filter(Boolean), slotSeen: !!slot && !!top && (top === slot || slot.contains(top)), coins: document.querySelectorAll('#chest-show .cs-coin').length, flying: document.querySelectorAll('#flx-layer .flx-g').length, rowed: document.querySelectorAll('#chest-show .cs-row .cs-r').length, guide: q('#rotate-guide') ? !q('#rotate-guide').hidden : null, overlay: q('#overlay') ? !q('#overlay').hidden : null } })()`

const report: Record<string, unknown>[] = []
for (const [W, H] of SIZES) {
  const PORT = 9700 + Math.floor(Math.random() * 80)
  const prof = mkdtempSync(join(tmpdir(), 'chest-'))
  const chrome = spawn(exe, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${prof}`, `--window-size=${W},${H}`, '--no-first-run', '--mute-audio', 'about:blank'], { stdio: 'ignore' })
  try {
    let tabs: any = null
    for (let i = 0; i < 50 && tabs === null; i++) { try { tabs = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json() } catch { await sleep(200) } }
    const ws = new WebSocket(tabs.find((t: any) => t.type === 'page').webSocketDebuggerUrl)
    await new Promise((r, j) => { ws.onopen = r; ws.onerror = j })
    let id = 0
    const waits = new Map<number, (v: any) => void>(), errors: string[] = []
    ws.onmessage = m => {
      const o = JSON.parse(String(m.data))
      if (o.method === 'Runtime.exceptionThrown') errors.push(String(o.params.exceptionDetails?.exception?.description ?? o.params.exceptionDetails?.text).slice(0, 300))
      if (o.method === 'Runtime.consoleAPICalled' && o.params.type === 'error') errors.push('console.error ' + o.params.args.map((a: any) => a.value ?? a.description ?? '').join(' ').slice(0, 300))
      if (o.id !== undefined) { waits.get(o.id)?.(o.result ?? o.error); waits.delete(o.id) }
    }
    const call = (method: string, params: object = {}): Promise<any> => new Promise(r => { const k = ++id; waits.set(k, r); ws.send(JSON.stringify({ id: k, method, params })) })
    const ev = async (expression: string): Promise<any> => { const r = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) errors.push('eval ' + String(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text).slice(0, 300)); return r.result?.value }
    const tag = `${W}x${H}${GFX ? '-' + GFX : ''}`
    const shot = async (name: string): Promise<string> => { const { data } = await call('Page.captureScreenshot', { format: 'png' }); const file = join(OUT, `${tag}-${name}.png`); writeFileSync(file, Buffer.from(data, 'base64')); return file }
    const tap = async (x: number, y: number): Promise<void> => { for (const type of ['mousePressed', 'mouseReleased']) await call('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 }) }
    const phone = Math.min(W, H) < 500
    await call('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: phone ? 2 : 1, mobile: phone })
    await call('Emulation.setFocusEmulationEnabled', { enabled: true })
    await call('Page.enable'); await call('Runtime.enable')
    await call('Page.navigate', { url: `${ROOT}/raid.html?kit=${KIT}&silent${GFX ? '&gfx=' + GFX : ''}` })
    for (let i = 0; i < 160 && await ev(`!!document.getElementById('start') && !document.getElementById('start').disabled`) !== true; i++) await sleep(250)
    await ev(`document.getElementById('start').click()`)
    for (let i = 0; i < 240 && await ev(`!!window.__raid && window.__raid().state === 'playing' && !document.getElementById('play').hidden`) !== true; i++) await sleep(250)
    // 잠깐 싸우게 둔다 (세로 폰은 「가로로 돌려 주세요」로 서 있다 · 게임이 그렇게 한다)
    await sleep(2500)
    const kit = await ev(SETUP)
    await sleep(400)
    report.push({ size: tag, kit, visibility: await ev(`document.visibilityState`), low: await ev(`!!document.querySelector('.q-low') || new URLSearchParams(location.search).get('gfx') === 'low'`) })
    let chestId = 9000
    for (const count of TIERS) {
      const c = CASES[count]!, merges = c.picks.flatMap((p, i) => c.opened.includes(p) && c.picks.indexOf(p) === i ? [i] : [])
      const plan = chestShowPlan(count, c.picks.length, merges)
      // 찍을 순간 — 들어옴 · 들썩임 · 터진 직후 · 룬마다(솟은 뒤 · 날아간 뒤) · 끝 직전
      const moments: [string, number][] = [['a-enter', .2]]
      for (const e of plan.events) {
        if (e.kind === 'shake' && e.index === 1) moments.push(['b-shake', e.at + .1])
        if (e.kind === 'burst') moments.push(['c-burst', e.at + .1], ['d-coins', e.at + .28])
        if (e.kind === 'rune') { if (e.merge) moments.push([`e-rune${e.index + 1}-merge`, e.at + .33]); moments.push([`e-rune${e.index + 1}`, e.at + (e.merge ? .95 : .3)]) }
        if (e.kind === 'fly') moments.push([`f-fly${e.index + 1}`, e.at + .3])
      }
      moments.push(['g-end', plan.total - .2])
      moments.sort((a, b) => a[1] - b[1])
      await ev(`(() => { const r = window.__raid(); r.xp = 0; r.offers = [] })()`)
      await ev(inject(count, ++chestId))
      const t0 = Date.now()
      for (let i = 0; i < 100 && await ev(`window.__chestShow.active`) !== true; i++) await sleep(20)
      const startLag = Date.now() - t0
      const seen: Record<string, unknown>[] = []
      let pushed = false, k = 0
      while (await ev(`window.__chestShow.active`) === true && Date.now() - t0 < 30000) {
        const st = await ev(`({ t: window.__chestShow.elapsed, waiting: window.__chestShow.waiting })`)
        if (st.waiting && !pushed) {
          // 대박 — 멎은 틀을 찍고, 조금 흔들린 틀도 찍고, 「눌러!」를 진짜로 누른다
          await sleep(350); const probe = await ev(PROBE); seen.push({ at: 'freeze', ...probe }); await shot(`t${count}-b2-freeze-push`)
          await sleep(250); await shot(`t${count}-b3-freeze-push2`)
          const b = probe.push as number[] | null
          if (b) await tap((b[0]! + b[2]!) / 2, (b[1]! + b[3]!) / 2)
          pushed = true; continue
        }
        while (k < moments.length - 1 && moments[k + 1]![1] <= st.t) k++   // 찍는 사이에 지나간 순간은 건너뛴다
        if (k < moments.length && st.t >= moments[k]![1]) { const [name] = moments[k++]!; const probe = await ev(PROBE); seen.push({ at: name, t: +st.t.toFixed(2), ...probe }); await shot(`t${count}-${name}`) }
        else await sleep(15)
      }
      report.push({ size: tag, tier: count, seconds: plan.total, wall: +((Date.now() - t0) / 1000).toFixed(2), startLagMs: startLag, freeze: plan.freeze, pushed, shots: seen.length, outside: [...new Set(seen.flatMap(s => s['outside'] as string[]))], slotSeen: seen.every(s => s['slotSeen'] === true), maxCoins: Math.max(...seen.map(s => Number(s['coins'] ?? 0))), flew: seen.some(s => Number(s['flying'] ?? 0) > 0), rowEnd: seen[seen.length - 1]?.['rowed'], guideDuring: seen.some(s => s['guide'] === true), after: await ev(PROBE) })
      await sleep(500)
    }
    // 건너뛰기 — 5개 연출을 터지기 전에 눌러 끝 결과로 (결과 줄에 다섯이 다 선다)
    if (EXTRA && TIERS.includes(5)) {
      await ev(inject(5, ++chestId))
      for (let i = 0; i < 100 && await ev(`window.__chestShow.active`) !== true; i++) await sleep(20)
      // 막 열린 뒤의 누름은 버려진다 (skipGuard) — 그 누름을 한 번 넣어 보고, 조금 뒤에 진짜로 건너뛴다
      await sleep(150); await tap(W / 2, H / 2); await sleep(100)
      const guarded = await ev(`window.__chestShow.active && document.querySelectorAll('#chest-show .cs-row .cs-r').length === 0`)
      for (let i = 0; i < 100 && await ev(`window.__chestShow.elapsed`) < 0.75; i++) await sleep(20)
      await tap(W / 2, H / 2); await sleep(150)
      const probe = await ev(PROBE); await shot('t5-h-skipped')
      const t1 = Date.now(); while (await ev(`window.__chestShow.active`) === true && Date.now() - t1 < 5000) await sleep(30)
      report.push({ size: tag, skip: true, earlyTapIgnored: guarded, rowed: probe.rowed, outside: probe.outside, closedAfterMs: Date.now() - t1 })
    }
    if (EXTRA) {
      // 중간 보스 상자 — 안 연 조합을 고르는 큰 창 (가로에서 주워 창을 띄운다 · 세로 폰은 판이 서 있어 가로로 띄운 뒤 돌린다)
      if (phone && H > W) { await call('Emulation.setDeviceMetricsOverride', { width: H, height: W, deviceScaleFactor: 2, mobile: true }); await sleep(600); await ev(`document.getElementById('resume')?.click()`); await sleep(300) }
      await ev(`(() => { const r = window.__raid(); r.xp = 0; r.offers = []; r.combos = r.combos.filter(c => c === 'torrent'); r.comboRanks = { torrent: 1 }; r.chests.push({ id: ${++chestId}, eliteId: 0, x: r.x, y: r.y, bornAt: r.t, state: 'ground', choicesRemaining: 1, gold: 0, large: false, boss: true }) })()`)
      for (let i = 0; i < 100 && await ev(`!!document.querySelector('#overlay .boss-chest')`) !== true; i++) await sleep(30)
      if (phone && H > W) { await call('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 2, mobile: true }); await sleep(700) }
      await sleep(500); await shot('midboss-choice')
      const over = await ev(`(() => { const p = document.querySelector('#overlay .boss-chest'); if (!p) return null; const b = p.getBoundingClientRect(); return { cards: p.querySelectorAll('[data-up]').length, box: [Math.round(b.left), Math.round(b.top), Math.round(b.right), Math.round(b.bottom)], scroll: [p.scrollWidth - p.clientWidth, p.scrollHeight - p.clientHeight], names: [...p.querySelectorAll('[data-up] b')].map(x => x.textContent) } })()`)
      const before = await ev(`window.__raid().combos.join(',')`)
      await ev(`document.querySelector('#overlay .boss-chest [data-up]')?.click()`); await sleep(900)
      report.push({ size: tag, midboss: over, combosBefore: before, combosAfter: await ev(`window.__raid().combos.join(',')`), overlayAfter: await ev(`!document.getElementById('overlay').hidden`) })
      await shot('midboss-picked')
      // 멈춤 창과 상자 확률
      await ev(`document.getElementById('resume')?.click()`); await sleep(200)
      await ev(`window.__raid().offers = []`); await sleep(200)
      await ev(`(() => { if (!document.querySelector('.pause-panel')) document.getElementById('pause').click() })()`); await sleep(500)
      await shot('pause')
      await ev(`document.getElementById('chest-odds')?.click()`); await sleep(400)
      await shot('odds')
      report.push({ size: tag, odds: await ev(`(() => { const p = document.querySelector('#chest-odds-box .panel'); if (!p) return null; const b = p.getBoundingClientRect(); return { box: [Math.round(b.left), Math.round(b.top), Math.round(b.right), Math.round(b.bottom)], scroll: [p.scrollWidth - p.clientWidth, p.scrollHeight - p.clientHeight], cells: [...p.querySelectorAll('tbody td')].map(x => x.textContent), pauseScroll: (() => { const q = document.querySelector('.pause-panel'); return q ? q.scrollHeight - q.clientHeight : null })() } })()`) })
      // 「상자 확률」 단추가 없던 예전 멈춤 창과 견준다 (단추를 떼고 다시 잰다 — 단추 때문에 창이 굴러가게 되지 않았나)
      report.push({ size: tag, pauseScrollWithoutOddsButton: await ev(`(() => { document.getElementById('chest-odds')?.remove(); const q = document.querySelector('.pause-panel'); return q ? q.scrollHeight - q.clientHeight : null })()`) })
    }
    if (errors.length) report.push({ size: tag, errors: [...new Set(errors)].slice(0, 8) })
    ws.close()
  } finally {
    chrome.kill()
    await sleep(600)
    try { rmSync(prof, { recursive: true, force: true }) } catch { /* 크롬이 아직 쥐고 있다 — 임시 폴더라 둔다 */ }
  }
}
for (const r of report) console.log(JSON.stringify(r))
writeFileSync(join(OUT, `report${GFX ? '-' + GFX : ''}.json`), JSON.stringify(report, null, 2) + '\n')
