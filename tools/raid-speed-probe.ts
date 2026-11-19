/**
 * 열전 「닫기 없앰 · 빠르기 ×1/×2/×3 · 되돌리기 값」 화면 시험 (11-19 형: 「열전에 닫기는 없애도 되지 않을까 · 속도 ×1 ×2 ×3 · 능력치 초기화는 돈 써서」).
 * 본편 틀을 흉내 낸 쪽(같은 출처 · 닫기 없음 · 뒤로 가기는 app.ts backOne 처럼 'hanbal.raid.back' 을 틀에 보냄)에 본편 열전(campaign)을 띄우고
 *  - 출전 화면 「본편으로」 · 상점 되돌리기 값(모자람 → 흔들림 · 넉넉 → 묻는 상자 → 되돌림)
 *  - 판 화면 우상단(빠르기 · 돋보기 · 전체화면 · 멈춤) 겹침 0 · 빠르기 ×1 → ×2(금빛) → ×3 → ×1 · 판 시각이 빨리 흐름
 *  - 판 중 뒤로 가기 = 멈춤 창 · 결과 화면 뒤로 가기 = 그대로 · 출전 화면 뒤로 가기 = 본편으로
 * 를 숫자로 재고 844×390 으로 찍어 한 장(jpg)으로 묶는다.
 *   node --experimental-strip-types tools/raid-speed-probe.ts [나갈 jpg D:/tmp-node/raid-speed/for-hyung.jpg] [주소 http://localhost:5174]
 * 런타임 의존성 없음 — tools/raid-levelup-probe.ts 와 같은 CDP 길 · 임시 프로필 (형의 저장은 건드리지 않는다) · 5174 에서만 (5173 은 형이 쓴다).
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

const OUT = process.argv[2] ?? 'D:/tmp-node/raid-speed/for-hyung.jpg'
const ORIGIN = process.argv[3] ?? 'http://localhost:5174'
const HARNESS = `${ORIGIN}/__speed-harness.html`
const PORT = 9580 + Math.floor(Math.random() * 40)
const CHROMES = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe']
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))
const exe = CHROMES.find((p) => existsSync(p))
if (exe === undefined) throw new Error('크롬을 못 찾았다')
mkdirSync(dirname(OUT), { recursive: true })
const prof = mkdtempSync(join(tmpdir(), 'speed-'))
const chrome = spawn(exe, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${prof}`, '--window-size=844,390', '--no-first-run', '--mute-audio', 'about:blank'], { stdio: 'ignore' })
let fail = 0
const check = (ok: boolean, what: string): void => { console.log(`${ok ? '통과' : '실패'} ${what}`); if (!ok) fail++ }
const shots: { label: string; data: string }[] = []
// 본편 틀 흉내 — 판은 화면 가득 · 닫기 없음 (app.ts openFrame noClose) · 틀이 about:blank 로 가면 closed 표시
const harness = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;height:100%;background:#000;overflow:hidden}iframe{position:absolute;inset:0;width:100%;height:100%;border:0;display:block}</style></head><body><iframe src="/raid.html?campaign=probe-token&hero=haebi&kit=axe&sprite=haebi"></iframe><script>const f=document.querySelector('iframe');f.addEventListener('load',()=>{try{if(f.contentWindow.location.href==='about:blank')document.body.dataset.closed='1'}catch{}});window.addEventListener('message',e=>{if(e.data&&e.data.type==='hanbal.raid.start')document.body.dataset.started='1'})</script></body></html>`
try {
  let tabs: any = null
  for (let i = 0; i < 50 && tabs === null; i++) { try { tabs = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json() } catch { await sleep(200) } }
  const page = tabs.find((t: any) => t.type === 'page')
  const ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j })
  let id = 0
  const waits = new Map<number, (v: any) => void>()
  const call = (method: string, params: object = {}): Promise<any> => new Promise((r) => { const k = ++id; waits.set(k, r); ws.send(JSON.stringify({ id: k, method, params })) })
  ws.onmessage = (ev) => {
    const m = JSON.parse(String(ev.data))
    if (m.id !== undefined) { waits.get(m.id)?.(m.result ?? m.error); waits.delete(m.id); return }
    if (m.method === 'Fetch.requestPaused') void call('Fetch.fulfillRequest', { requestId: m.params.requestId, responseCode: 200, responseHeaders: [{ name: 'Content-Type', value: 'text/html; charset=utf-8' }], body: Buffer.from(harness).toString('base64') })
  }
  const ev = async (expression: string): Promise<any> => (await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result?.value
  /** 틀 안(raid.html)에서 — W = 틀의 window · D = 틀의 document */
  const inF = (body: string): Promise<any> => ev(`(() => { const W = document.querySelector('iframe').contentWindow, D = W.document; ${body} })()`)
  const shoot = async (label: string) => { const s = await call('Page.captureScreenshot', { format: 'png' }); shots.push({ label, data: s.data }) }
  const rectIn = (sel: string) => inF(`const e = D.querySelector(${JSON.stringify(sel)}); if (!e) return null; const b = e.getBoundingClientRect(); return { x: b.left, y: b.top, r: b.right, b: b.bottom, w: b.width, h: b.height }`)
  const tap = async (sel: string) => { const b = await rectIn(sel); await call('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: Math.round(b.x + b.w / 2), y: Math.round(b.y + b.h / 2) }] }); await sleep(50); await call('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }) }
  const back = () => ev(`document.querySelector('iframe').contentWindow.postMessage({ type: 'hanbal.raid.back' }, location.origin)`)
  const load = async () => {
    await call('Page.navigate', { url: HARNESS }); await sleep(2500)
    for (let i = 0; i < 80 && await inF(`return D.getElementById('start')?.disabled`) !== false; i++) await sleep(250)
  }

  await call('Fetch.enable', { patterns: [{ urlPattern: '*__speed-harness.html*', requestStage: 'Request' }] })
  await call('Emulation.setDeviceMetricsOverride', { width: 844, height: 390, deviceScaleFactor: 2, mobile: true })
  await call('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 })
  await call('Emulation.setFocusEmulationEnabled', { enabled: true })
  await call('Page.enable')
  // 상점 — 쓴 금 2,000 (힘 3 · 체력 3 쯤) · 가진 금 200 → 값 600 이 모자람
  await load()
  await inF(`W.localStorage.setItem('hanbal.raid.meta', JSON.stringify({ gold: 200, spent: 2000, shop: { might: 3, vigor: 3 }, cleared: {}, best: {}, runs: 3, heroes: {} })); W.localStorage.removeItem('hanbal.raid.speed')`)
  await load()
  check(await ev(`document.querySelector('[data-close]') === null && ![...document.querySelectorAll('button')].some(b => b.textContent.includes('닫기'))`) === true, '본편 틀에 「닫기」가 없다')
  check(await inF(`return D.getElementById('to-realm')?.textContent`) === '본편으로', '출전 화면에 「본편으로」')
  await inF(`D.getElementById('open-shop').click()`); await sleep(400)
  const poor = await inF(`const b = D.getElementById('refund'); return { cls: b.className, dis: b.disabled, text: b.textContent, coin: !!b.querySelector('img.coin') }`)
  check(poor.cls.includes('poor') && !poor.dis && poor.text.includes('600') && poor.text.includes('모자람') && poor.coin, `되돌리기: 동전 그림 + 값 600 + 「모자람」 (${poor.text})`)
  await tap('#refund'); await sleep(80)
  const nudged = await inF(`return D.getElementById('refund').classList.contains('nudge') && D.getElementById('refund-ask').hidden`)
  check(nudged === true, '모자라면 누르면 흔들리고 묻는 상자는 안 뜬다')
  await sleep(500)
  await shoot('상점 · 되돌리기 값 600 · 금 200 이라 모자람')
  // 넉넉 → 묻는 상자 → 되돌림
  await inF(`const m = JSON.parse(W.localStorage.getItem('hanbal.raid.meta')); m.gold = 900; W.localStorage.setItem('hanbal.raid.meta', JSON.stringify(m))`)
  await load()
  await inF(`D.getElementById('open-shop').click()`); await sleep(300)
  await tap('#refund'); await sleep(400)
  const ask = await inF(`const a = D.getElementById('refund-ask'); return { open: !a.hidden, text: a.textContent }`)
  check(ask.open && ask.text.includes('600') && ask.text.includes('+2,000'), `넉넉하면 묻는 상자 (${ask.text})`)
  await shoot('상점 · 되돌리기 묻는 상자 (돌려받음 +2,000 · 내는 값 −600)')
  await back(); await sleep(200)
  check(await inF(`return D.getElementById('refund-ask').hidden && !D.getElementById('shop').hidden`) === true, '뒤로 가기: 묻는 상자만 닫힌다')
  await tap('#refund'); await sleep(300); await inF(`D.getElementById('refund-yes').click()`); await sleep(300)
  const after = await inF(`const m = JSON.parse(W.localStorage.getItem('hanbal.raid.meta')); return { gold: m.gold, spent: m.spent, might: m.shop.might, dis: D.getElementById('refund').disabled }`)
  check(after.gold === 900 + 2000 - 600 && after.spent === 0 && after.might === 0 && after.dis, `되돌림: 금 900 + 2,000 − 600 = ${after.gold} · 쓴 금 0 · 단추 잠김`)
  await back(); await sleep(200)
  check(await inF(`return D.getElementById('shop').hidden`) === true, '뒤로 가기: 상점이 닫힌다')
  // 판 — 우상단
  await inF(`D.getElementById('start').click()`); await sleep(1500)
  check(await ev(`document.body.dataset.started`) === '1', '출전하면 본편에 알린다')
  check(await inF(`return D.visibilityState`) === 'visible', '탭이 보이는 상태 (캔버스가 그려진다)')
  const sp0 = await inF(`return D.getElementById('speed').textContent`)
  const rate = async () => { const a = await inF(`return W.__raid().t`); await sleep(1000); const b = await inF(`return W.__raid().t`); return b - a }
  const r1 = await rate()
  await tap('#speed'); await sleep(100)
  const sp1 = await inF(`const b = D.getElementById('speed'); return { t: b.textContent, on: b.classList.contains('on'), pop: b.classList.contains('pop') }`)
  const r2 = await rate()
  await tap('#speed'); await sleep(100)
  const sp2 = await inF(`const b = D.getElementById('speed'); return { t: b.textContent, on: b.classList.contains('on') }`)
  const r3 = await rate()
  console.log(`판 시각 1초 동안: ×1 ${r1.toFixed(2)} · ×2 ${r2.toFixed(2)} · ×3 ${r3.toFixed(2)}`)
  check(sp0 === '×1' && sp1.t === '×2' && sp1.on && sp1.pop && sp2.t === '×3' && sp2.on, `×1 → ×2(금빛 · 튐) → ×3 (${sp0} ${sp1.t} ${sp2.t})`)
  check(r2 > r1 * 1.6 && r3 > r1 * 2.4, `판 시각이 빨리 흐른다 (${r1.toFixed(2)} · ${r2.toFixed(2)} · ${r3.toFixed(2)})`)
  check(await inF(`return W.localStorage.getItem('hanbal.raid.speed')`) === '2', '단계를 기억한다 (×3)')
  await tap('#speed'); await sleep(100); await tap('#speed'); await sleep(500)
  check(await inF(`return D.getElementById('speed').textContent`) === '×2', '×3 → ×1 → ×2')
  const ids = ['speed', 'zoom', 'fullscreen', 'pause']
  const rs = await Promise.all(ids.map((k) => rectIn('#' + k)))
  const hud = await rectIn('#hud'), chud = await rectIn('#combat-hud')
  console.log(ids.map((k, i) => `${k} ${Math.round(rs[i].x)}~${Math.round(rs[i].r)},${Math.round(rs[i].y)}~${Math.round(rs[i].b)}`).join(' · '))
  let ov = 0
  for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) { const a = rs[i], b = rs[j]; if (a.x < b.r - .5 && a.r > b.x + .5 && a.y < b.b - .5 && a.b > b.y + .5) { ov++; console.log('겹침', ids[i], ids[j]) } }
  for (const r of rs) if (r.x < hud.r && r.r > hud.x && r.y < hud.b && r.b > hud.y) ov++
  for (const r of rs) if (r.x < chud.r && r.r > chud.x && r.y < chud.b && r.b > chud.y) ov++
  check(ov === 0, `우상단 단추 넷(빠르기·돋보기·전체화면·멈춤)과 시계·체력칸 겹침 ${ov}`)
  const arena = await rectIn('#arena')
  check(rs.every((r) => r.w > 20 && r.r <= 844 && r.y >= 0) && arena.r - rs[3].r <= 20, `오른쪽 끝까지 붙음 (멈춤 단추 ~ 전장 오른쪽 끝 ${Math.round(arena.r - rs[3].r)}px · 예전 닫기 자리 비움 80px 없음)`)
  check(rs[0].r <= rs[1].x + 1, '빠르기는 돋보기 왼쪽')
  await shoot('판 · 우상단 ×2(금빛) · 돋보기 · 전체화면 · 멈춤 (닫기 없음)')
  // 판 중 뒤로 가기 → 멈춤 창
  await back(); await sleep(300)
  const pz = await inF(`return { resume: !!D.getElementById('resume'), quit: D.getElementById('quit')?.textContent }`)
  check(pz.resume && pz.quit === '물러나기 · 버틴 만큼 금 받기', `판 중 뒤로 가기 = 멈춤 창 (${pz.quit})`)
  check(await ev(`document.body.dataset.closed`) === undefined, '판 중 뒤로 가기로 본편에 빠지지 않는다')
  await shoot('판 중 뒤로 가기 → 멈춤 창')
  await inF(`D.getElementById('quit').click()`); await sleep(400)
  check(await inF(`return !!D.querySelector('.panel.result') && !!D.getElementById('return')`) === true, '물러나기 → 결과 → 「본편으로」')
  await back(); await sleep(300)
  check(await inF(`return !!D.querySelector('.panel.result')`) === true && await ev(`document.body.dataset.closed`) === undefined, '결과 화면 뒤로 가기는 그대로')
  await inF(`D.getElementById('return').click()`); await sleep(800)
  check(await ev(`document.body.dataset.closed`) === '1', '결과 「본편으로」로 나온다')
  // 출전 화면 뒤로 가기 = 본편으로
  await load(); await back(); await sleep(800)
  check(await ev(`document.body.dataset.closed`) === '1', '출전 화면 뒤로 가기 = 본편으로')
  ws.close()
  // 한 장으로 묶는다
  const ws2page = (await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json())
  const ws2 = new WebSocket(ws2page.webSocketDebuggerUrl)
  await new Promise((r, j) => { ws2.onopen = r; ws2.onerror = j })
  const waits2 = new Map<number, (v: any) => void>(); let id2 = 0
  ws2.onmessage = (e) => { const m = JSON.parse(String(e.data)); if (m.id !== undefined) { waits2.get(m.id)?.(m.result ?? m.error); waits2.delete(m.id) } }
  const call2 = (method: string, params: object = {}): Promise<any> => new Promise((r) => { const k = ++id2; waits2.set(k, r); ws2.send(JSON.stringify({ id: k, method, params })) })
  const cell = (s: typeof shots[number]) => `<figure><img src="data:image/png;base64,${s.data}" style="width:844px"><figcaption>${s.label}</figcaption></figure>`
  const html = `<html><body style="margin:0;background:#111;color:#eee;font:600 17px sans-serif"><div style="display:grid;grid-template-columns:repeat(2,844px);gap:12px;padding:14px;align-items:start">${shots.map(cell).join('')}</div><style>figure{margin:0}figcaption{padding:4px 2px}</style></body></html>`
  const W = 14 + 844 * 2 + 12 + 14, H = 14 + Math.ceil(shots.length / 2) * (390 + 34 + 12) + 14
  await call2('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false })
  await call2('Page.enable')
  const ft = await call2('Page.getFrameTree')
  await call2('Page.setDocumentContent', { frameId: ft.frameTree.frame.id, html })
  await sleep(900)
  const sheet = await call2('Page.captureScreenshot', { format: 'jpeg', quality: 85, captureBeyondViewport: true })
  writeFileSync(OUT, Buffer.from(sheet.data, 'base64'))
  shots.forEach((s, i) => writeFileSync(join(dirname(OUT), `shot-${i + 1}.png`), Buffer.from(s.data, 'base64')))   // 낱장 (2배 해상도)
  console.log('묶음', OUT, `${W}×${H}`)
  ws2.close()
} finally {
  chrome.kill()
  await sleep(500)
  for (let i = 0; i < 12 && existsSync(prof); i++) { try { rmSync(prof, { recursive: true, force: true }) } catch { await sleep(400) } }
}
console.log(fail ? `실패 ${fail}` : '모두 통과')
if (fail) process.exitCode = 1
