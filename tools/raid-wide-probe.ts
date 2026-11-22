/**
 * 열전 넓은 맵(59-WIDE) 눈 확인 (11-22 · docs/realm/RAID-REWARD-MAP-20261122.md 4장) — 헤드리스 크롬으로 판을 열고 장면마다 찍는다.
 *   node --experimental-strip-types tools/raid-wide-probe.ts [나갈 폴더 D:/에셋창고/claude-widemap] [주소 http://localhost:5281/raid.html] [스테이지 forest,snow] [화면 844x390,390x844,1280x720]
 * 장면: 가운데 결전장(출전 직후) · 멀리 돌아다님(결전장 밖 · 이어 깔린 바닥) · 화살표(먼 정예 · 땅의 상자) · 세계 끝 · 안개 문이 닫히는 중(결전장 쪽 화살표) ·
 *       닫힌 결전장의 중간 보스 · 거대 보스.  판은 개발 손잡이(__raid)로 옮긴다 (판 시각·자리 · 체력을 채워 쓰러지지 않게) — 눈 확인용이지 밸런스가 아니다.
 * 같이 재는 것: 장수가 화면 안에 있나 · 카메라가 세계 밖을 안 보이나(캔버스 네 귀퉁이가 바탕색이 아닌 그림) · 누른 자리로 걷나(판 자리 변환) · 페이지 예외 0.
 * 런타임 의존성 없음 — tools/raid-zoom-probe.ts 와 같은 CDP 길. 임시 크롬 프로필 · 5281~5285 에서만 (형이 쓰는 5173·5174 는 건드리지 않는다).
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const OUT = process.argv[2] ?? 'D:/에셋창고/claude-widemap'
const URL0 = process.argv[3] ?? 'http://localhost:5281/raid.html'
const STAGES = (process.argv[4] ?? 'forest').split(',')
const VIEWS = (process.argv[5] ?? '844x390,390x844,1280x720').split(',').map(v => v.split('x').map(Number) as [number, number])
const KIT = process.env['KIT'] ?? 'bow'
const PORT = 9700 + Math.floor(Math.random() * 60)
const CHROMES = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe']
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))
const exe = CHROMES.find((p) => existsSync(p))
if (exe === undefined) throw new Error('크롬을 못 찾았다')
mkdirSync(OUT, { recursive: true })
const prof = mkdtempSync(join(tmpdir(), 'wide-'))
const chrome = spawn(exe, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${prof}`, '--window-size=1280,720', '--no-first-run', '--mute-audio', '--enable-gpu-rasterization', 'about:blank'], { stdio: 'ignore' })
let fail = 0, errors = 0
const check = (ok: boolean, what: string): void => { console.log(`${ok ? '통과' : '실패'} ${what}`); if (!ok) fail++ }
try {
  let tabs: any = null
  for (let i = 0; i < 50 && tabs === null; i++) { try { tabs = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json() } catch { await sleep(200) } }
  const ws = new WebSocket(tabs.find((t: any) => t.type === 'page').webSocketDebuggerUrl)
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j })
  let id = 0
  const waits = new Map<number, (v: any) => void>()
  ws.onmessage = (m) => {
    const o = JSON.parse(String(m.data))
    if (o.method === 'Runtime.exceptionThrown') { errors++; console.log('  페이지 예외', String(o.params.exceptionDetails?.exception?.description ?? o.params.exceptionDetails?.text).slice(0, 400)) }
    if (o.id !== undefined) { waits.get(o.id)?.(o.result ?? o.error); waits.delete(o.id) }
  }
  const call = (method: string, params: object = {}): Promise<any> => new Promise((r) => { const k = ++id; waits.set(k, r); ws.send(JSON.stringify({ id: k, method, params })) })
  const ev = async (expression: string): Promise<any> => { const r = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) { errors++; console.log('  스크립트 오류', String(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text).slice(0, 300)) } return r.result?.value }
  const shoot = async (name: string) => { const s = await call('Page.captureScreenshot', { format: 'png' }); writeFileSync(join(OUT, name + '.png'), Buffer.from(s.data, 'base64')); console.log('  찍음 ' + name) }
  /** 판 손잡이 — 체력을 채우고(쓰러지지 않게) 레벨업·상자 창이 뜨지 않게 기세를 비운다 */
  const safe = `(() => { const r = window.__raid(); r.maxHp = Math.max(r.maxHp, 99999); r.hp = r.maxHp; r.xp = -1e9; return r })()`
  const state = () => ev(`(() => { const r = window.__raid(); return { t: r.t, x: r.x, y: r.y, state: r.state, enemies: r.enemies.length, wide: r.wide ?? null, elites: r.enemies.filter(e => e.kind === 'elite').map(e => [Math.round(e.x), Math.round(e.y), !!e.unseen]), boss: r.enemies.filter(e => e.kind === 'boss').map(e => [Math.round(e.x), Math.round(e.y), e.bossRole, !!e.giant]), offers: r.offers.length, visible: document.visibilityState } })()`)
  /** 캔버스 한 점의 색 (판 그림이 그려졌나 — 세계 밖 빈 바탕 #273c35 이 보이면 안 된다) */
  const pixel = (fx: number, fy: number) => ev(`(() => { const c = document.getElementById('field'), g = c.getContext('2d'); const d = g.getImageData(Math.floor(c.width * ${fx}), Math.floor(c.height * ${fy}), 1, 1).data; return [d[0], d[1], d[2]] })()`)
  const key = async (type: 'keyDown' | 'keyUp', k: string) => { await ev(`window.dispatchEvent(new KeyboardEvent('${type === 'keyDown' ? 'keydown' : 'keyup'}', { key: '${k}', bubbles: true }))`) }
  await call('Emulation.setFocusEmulationEnabled', { enabled: true })
  await call('Page.enable'); await call('Runtime.enable')
  for (const stage of STAGES) for (const [vw, vh] of VIEWS) {
    const phone = vw < 1000, tag = `${stage}-${vw}x${vh}`
    console.log(`── ${tag} ──`)
    await call('Emulation.setDeviceMetricsOverride', { width: vw, height: vh, deviceScaleFactor: phone ? 2 : 1, mobile: phone })
    await call('Emulation.setTouchEmulationEnabled', { enabled: phone, maxTouchPoints: 5 })
    if (stage === 'forest') {
      // 첫 스테이지는 실제 출전 단추로 (출전 옵션에 새 규칙이 실리는지까지)
      await call('Page.navigate', { url: `${URL0}?kit=${KIT}&gfx=high` })
      await sleep(2500)
      for (let i = 0; i < 120 && await ev(`document.getElementById('start')?.disabled`) !== false; i++) await sleep(250)
      await ev(`document.getElementById('start').click()`)
      for (let i = 0; i < 160 && await ev(`document.getElementById('play').hidden`) !== false; i++) await sleep(250)
    } else {
      // 새 기기에서 닫혀 있는 스테이지는 개발 검수 재생(1분)으로 연다 — 판 규칙은 출전과 같다 (haebi-review.ts)
      await call('Page.navigate', { url: `${URL0}?review&background&kit=${KIT}&stage=${stage}&gfx=high` })
      for (let i = 0; i < 160 && await ev(`!!document.querySelector('button[data-until="60"]') && document.getElementById('start')?.disabled === false`) !== true; i++) await sleep(250)
      await ev(`document.querySelector('button[data-until="60"]').click()`)
      for (let i = 0; i < 240 && await ev(`document.getElementById('play').hidden`) !== false; i++) await sleep(250)
      await ev(`[...document.querySelectorAll('.review-tools button')].find(b => b.textContent === '검수 도구 닫기')?.click()`)
      await sleep(2500)   // 거대 보스 그림 미리 받기
      await ev(`(() => { const r = window.__raid(); r.offers = [] })()`)
      await ev(`document.getElementById('resume')?.click()`)
    }
    await sleep(1200)
    let st = await state()
    if (st.wide === null) { check(false, `${tag}: 넓은 맵 판이 아니다`); continue }
    const portrait = vh > vw
    if (await ev(`window.__raid().stage`) !== stage) console.log(`  (스테이지 ${stage} 가 닫혀 있어 ${await ev(`window.__raid().stage`)} 판으로 본다)`)
    check(st.visible === 'visible', `${tag}: 탭이 보인다`)
    await ev(safe); await sleep(600)
    await shoot(`${tag}-1-결전장`)
    if (portrait) { console.log('  (폰 세로는 「가로로 돌려 주세요」로 멈춘다 · 한 장만)'); continue }
    // 멀리 돌아다님: 결전장 밖 왼쪽 위로 옮겨 오른쪽 아래로 걷는다 (카메라가 따라가며 앞서 본다)
    await ev(`(() => { const r = window.__raid(); r.x = -640; r.y = -330 })()`); await ev(safe)
    await key('keyDown', 'a'); await key('keyDown', 'w'); await sleep(1800); await ev(safe)
    st = await state()
    check(st.x < -640 && st.y < -330, `${tag}: 결전장 밖에서도 걷는다 (${Math.round(st.x)},${Math.round(st.y)})`)
    await shoot(`${tag}-2-멀리`)
    const corner = [await pixel(.02, .5), await pixel(.98, .5), await pixel(.5, .97)]
    check(corner.every(c => !(c[0] === 0x27 && c[1] === 0x3c && c[2] === 0x35)), `${tag}: 화면 끝까지 바닥이 깔린다 (${corner.map(c => c.join('/')).join(' · ')})`)
    await key('keyUp', 'a'); await key('keyUp', 'w')
    // 화살표: 먼 정예(큰 놈 사냥) + 땅의 상자 — 정예는 판이 스스로 멀리 내고(다음 걸음) · 상자는 결전장 가운데에 하나 둔다
    await ev(`(() => { const r = window.__raid(); r.nextElite = r.t; r.chests.push({ id: 900 + r.chests.length, eliteId: 0, x: 560, y: 360, bornAt: r.t, state: 'ground', choicesRemaining: 1, gold: 0, large: false }) })()`)
    await sleep(900); await ev(safe); await ev(`window.__raid().nextElite = 1e9`)
    st = await state()
    check(st.elites.length >= 1 && st.elites.every((e: [number, number, boolean]) => e[2]), `${tag}: 정예가 화면 밖 멀리 나왔다 (${JSON.stringify(st.elites)})`)
    await shoot(`${tag}-3-화살표`)
    // 세계 끝: 왼쪽 위 귀퉁이까지 달린다
    await ev(`(() => { const r = window.__raid(); r.x = -1000; r.y = -600 })()`)
    await key('keyDown', 'a'); await key('keyDown', 'w'); await sleep(1600); await key('keyUp', 'a'); await key('keyUp', 'w'); await ev(safe); await sleep(500)
    st = await state()
    check(st.x === -1120 + 32 && st.y === -720 + 65, `${tag}: 세계 끝에서 멈춘다 (${st.x},${st.y})`)
    await shoot(`${tag}-4-세계끝`)
    const edge = [await pixel(.02, .2), await pixel(.02, .9), await pixel(.9, .03)]
    check(edge.every(c => !(c[0] === 0x27 && c[1] === 0x3c && c[2] === 0x35)), `${tag}: 세계 끝에서도 빈 바탕이 안 보인다 (${edge.map(c => c.join('/')).join(' · ')})`)
    // 누른 자리로 걷기: 화면 오른쪽 아래를 누르면 그쪽(판 자리)으로 간다
    if (!phone) {
      const before = await state()
      const box = await ev(`(() => { const b = document.getElementById('field').getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height } })()`)
      await call('Input.dispatchMouseEvent', { type: 'mousePressed', x: box.x + box.w * .8, y: box.y + box.h * .75, button: 'left', clickCount: 1 }); await call('Input.dispatchMouseEvent', { type: 'mouseReleased', x: box.x + box.w * .8, y: box.y + box.h * .75, button: 'left', clickCount: 1 })
      await sleep(1200); const after = await state()
      check(after.x > before.x + 60 && after.y > before.y + 30, `${tag}: 누른 쪽(오른쪽 아래)으로 걷는다 (${Math.round(after.x - before.x)},${Math.round(after.y - before.y)})`)
      await key('keyDown', 'a'); await key('keyUp', 'a')   // 목적지 지움
    }
    // 안개 문: 중간 보스 12초 전으로 — 닫히는 중 (정예는 더 안 나오게)
    await ev(`(() => { const r = window.__raid(); r.enemies = r.enemies.filter(e => e.kind !== 'elite'); r.chests = []; r.nextElite = 1e9; r.x = -700; r.y = 900; r.t = 600 - 13 })()`); await ev(safe)
    await sleep(3500); await ev(safe)
    st = await state()
    check(st.wide.gate > 0.3 && st.wide.gate < 1, `${tag}: 안개 문이 닫히는 중 (${st.wide.gate.toFixed(2)})`)
    await shoot(`${tag}-5-닫히는중`)
    // 닫힌 결전장 · 중간 보스
    await ev(`window.__raid().t = 600 - 1.2`); await sleep(3200); await ev(safe)
    st = await state()
    check(st.wide.gate === 1 && st.x >= 32 && st.x <= 1120 - 32 && st.y >= 65 && st.y <= 720 - 24, `${tag}: 다 닫히면 장수는 결전장 안 (${Math.round(st.x)},${Math.round(st.y)})`)
    check(st.boss.some((b: [number, number, string, boolean]) => b[2] === 'midboss' && b[0] >= 0 && b[0] <= 1120 && b[1] >= 0 && b[1] <= 720), `${tag}: 중간 보스가 결전장에 (${JSON.stringify(st.boss)})`)
    await shoot(`${tag}-6-중간보스`)
    // 끝 거대 보스: 중간 보스를 치우고 끝 보스 1초 전으로
    await ev(`(() => { const r = window.__raid(); r.enemies = r.enemies.filter(e => e.kind !== 'boss' && e.kind !== 'elite'); r.giantFlow.midDefeated = true; r.t = 1140 - 1 })()`); await ev(safe)
    await sleep(6500); await ev(safe)
    st = await state()
    check(st.wide.gate === 1 && st.boss.some((b: [number, number, string, boolean]) => b[3]), `${tag}: 거대 보스가 닫힌 결전장에 (${JSON.stringify(st.boss)})`)
    await shoot(`${tag}-7-거대보스`)
    check(st.state === 'playing', `${tag}: 판이 돌고 있다 (${st.state})`)
  }
  check(errors === 0, `페이지 예외 ${errors}건`)
} finally {
  chrome.kill()
  await sleep(600)
  try { rmSync(prof, { recursive: true, force: true }) } catch { /* 크롬이 아직 쥐고 있으면 둔다 (임시 폴더) */ }
}
console.log(fail ? `실패 ${fail}` : '모두 통과')
process.exit(fail ? 1 : 0)
