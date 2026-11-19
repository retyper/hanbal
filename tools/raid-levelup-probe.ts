/**
 * 열전 레벨업 카드 · 기술 나무 화면 시험 (11-19 형: 「우상단 버튼 겹침 · 벽력 위의 투창 · 다음 층 12 지금 10 · 갈래 끝까지 열림」).
 * 본편 틀을 흉내 낸 쪽(같은 출처 · 오른쪽 위 「닫기」 = app.ts .nightov [data-close] 와 같은 크기)에 raid.html?kit=spear 를 띄우고,
 * 창 묶음 · 레벨 30 · 주 무기 갈래 다 열림 · 보조 갈래 문턱 1점 전 판을 만들어 레벨업 두 장 + 나무 한 장(844×390) · 667×375 · 1280×720 을 찍는다.
 * 겹침은 getBoundingClientRect 숫자로 잰다. 찍은 것은 한 장(jpg)으로 묶는다.
 *   node --experimental-strip-types tools/raid-levelup-probe.ts [나갈 jpg D:/tmp-node/raid-levelup/for-hyung.jpg] [주소 http://localhost:5174]
 * 런타임 의존성 없음 — tools/raid-zoom-probe.ts 와 같은 CDP 길 · 임시 프로필 (형의 저장은 건드리지 않는다) · 5174 에서만 (5173 은 형이 쓴다).
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

const OUT = process.argv[2] ?? 'D:/tmp-node/raid-levelup/for-hyung.jpg'
const ORIGIN = process.argv[3] ?? 'http://localhost:5174'
const HARNESS = `${ORIGIN}/__levelup-harness.html`
const PORT = 9540 + Math.floor(Math.random() * 40)
const CHROMES = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe']
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))
const exe = CHROMES.find((p) => existsSync(p))
if (exe === undefined) throw new Error('크롬을 못 찾았다')
mkdirSync(dirname(OUT), { recursive: true })
const prof = mkdtempSync(join(tmpdir(), 'lvup-'))
const chrome = spawn(exe, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${prof}`, '--window-size=844,390', '--no-first-run', '--mute-audio', 'about:blank'], { stdio: 'ignore' })
let fail = 0
const check = (ok: boolean, what: string): void => { console.log(`${ok ? '통과' : '실패'} ${what}`); if (!ok) fail++ }
const shots: { label: string; data: string; w: number; h: number }[] = []
// 본편 틀 흉내 — 판은 화면 가득 · 「닫기」는 오른쪽 위 10px (border 9/12 · padding 4/10 · 13px)
const harness = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;height:100%;background:#000;overflow:hidden}iframe{position:absolute;inset:0;width:100%;height:100%;border:0;display:block}#close{position:absolute;right:10px;top:10px;z-index:1;font:13px Georgia,serif;padding:4px 10px;border:solid transparent;border-width:9px 12px;background:#3a2c1ecc;color:#efe3c6;box-sizing:border-box}</style></head><body><iframe src="/raid.html?kit=spear"></iframe><button id="close">닫기</button></body></html>`
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
    // 흉내 틀 주소만 가로채 위의 html 로 답한다 (저장소에 파일을 두지 않는다)
    if (m.method === 'Fetch.requestPaused') void call('Fetch.fulfillRequest', { requestId: m.params.requestId, responseCode: 200, responseHeaders: [{ name: 'Content-Type', value: 'text/html; charset=utf-8' }], body: Buffer.from(harness).toString('base64') })
  }
  const ev = async (expression: string): Promise<any> => (await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result?.value
  /** 틀 안(raid.html)에서 — W = 틀의 window · D = 틀의 document */
  const inF = (body: string): Promise<any> => ev(`(() => { const W = document.querySelector('iframe').contentWindow, D = W.document; ${body} })()`)
  const size = async (w: number, h: number, mobile = true) => { await call('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: mobile ? 2 : 1, mobile }); await sleep(700) }
  const shoot = async (label: string, w: number, h: number) => { const s = await call('Page.captureScreenshot', { format: 'png' }); shots.push({ label, data: s.data, w, h }) }
  /** 틀 「닫기」와 틀 안에 보이는 단추가 겹치는지 — 겹친 단추 이름들 (없으면 빈 배열) */
  const overlaps = (): Promise<string[]> => ev(`(() => {
    const c = document.getElementById('close').getBoundingClientRect(), W = document.querySelector('iframe').contentWindow, D = W.document, f = document.querySelector('iframe').getBoundingClientRect()
    const hit = [...D.querySelectorAll('#overlay:not([hidden]) button, #tree-view:not([hidden]) button, #overlay:not([hidden]) h2, #tree-view:not([hidden]) h2, #tree-view:not([hidden]) .tree-head small')].filter(e => { const r = e.getBoundingClientRect(); if (!r.width) return false; const x = r.left + f.left, y = r.top + f.top; return x < c.right && x + r.width > c.left && y < c.bottom && y + r.height > c.top })
    return hit.map(e => (e.id || e.className || e.tagName) + ':' + e.textContent.trim().slice(0, 12))
  })()`)
  const rectIn = (sel: string) => inF(`const e = D.querySelector(${JSON.stringify(sel)}); if (!e) return null; const b = e.getBoundingClientRect(); return { x: b.left, y: b.top, r: b.right, b: b.bottom, w: b.width, h: b.height }`)
  const boxOverlap = (a: any, b: any) => a && b && a.x < b.r && a.r > b.x && a.y < b.b && a.b > b.y

  await call('Fetch.enable', { patterns: [{ urlPattern: '*__levelup-harness.html*', requestStage: 'Request' }] })
  await size(844, 390)
  await call('Emulation.setFocusEmulationEnabled', { enabled: true })
  await call('Page.enable')
  await call('Page.navigate', { url: HARNESS })
  await sleep(3000)
  for (let i = 0; i < 80 && await inF(`return D.getElementById('start')?.disabled`) !== false; i++) await sleep(250)
  check(await inF(`return D.body.classList.contains('framed')`) === false, '틀 안이어도 오른쪽 위를 비우지 않는다 (본편 닫기 없음 · 11-19)')
  await inF(`D.getElementById('start').click()`)
  await sleep(1500)
  // 판 만들기 — 창 묶음 · 레벨 30 · 찌르기 갈래 12번(다 열림) · 투창 갈래 11번(문턱 12 의 1 전) · 버팀 4번 (다음 문턱 7)
  const setup = (offers: string[]) => inF(`const r = W.__raid(); r.level = 30; r.xp = 0
    Object.assign(r.ranks, { spear: 6, reach: 3, ember: 2, hone: 1, javelin: 6, echo: 2, thunder: 2, drill: 1, tough: 2, tempo: 2 })
    r.offers = ${JSON.stringify(offers)}; return r.offers.length`)
  await setup(['thunder', 'hone', 'tough'])
  await sleep(700)
  const cards = (): Promise<any[]> => inF(`return [...D.querySelectorAll('.choices [data-up]')].map(b => ({ k: b.dataset.up, tag: b.querySelector('.branch-tag')?.textContent ?? '', pips: b.querySelectorAll('.lv-pips > i:not(.lv-num)').length, on: b.querySelectorAll('.lv-pips > i.on').length, up: [...b.querySelectorAll('.lv-pips > i:not(.lv-num)')].findIndex(i => i.classList.contains('up')), num: b.querySelector('.lv-num')?.textContent ?? '', now: b.querySelector('.unlock.now')?.textContent ?? '', later: b.querySelector('.unlock.later')?.textContent ?? '', em: b.querySelector('em')?.innerHTML ?? '', text: b.textContent }))`)
  let cs = await cards()
  console.log(JSON.stringify(cs.map(({ em, text, ...c }) => c)))
  const th = cs.find((c) => c.k === 'thunder'), ho = cs.find((c) => c.k === 'hone'), to = cs.find((c) => c.k === 'tough')
  check(th?.tag === '투창 갈래', `벽력 카드 위 띠는 「투창 갈래」 (${th?.tag})`)
  check(th?.pips === 10 && th.on === 2 && th.up === 2 && th.num === '2→3/10', `벽력 단계 칸 10칸 · 채움 2 · 금빛 3번째 · 「2→3/10」 (${th?.num})`)
  check(th?.now.includes('솟는 창') === true, `벽력을 고르면 투창 갈래 끝 「솟는 창」이 열린다고 크게 (${th?.now})`)
  check(ho !== undefined && ho.now === '' && ho.later === '' && ho.em === '', '다 열린 찌르기 갈래 카드(창끝 벼리기)는 열림 그림·글 없음')
  check(to?.later.includes('3번 더') === true && to.now === '', `버팀 갈래 카드는 흐린 그림 + 「3번 더」 (${to?.later})`)
  check(cs.every((c) => !/다음 층|갈래 끝까지|지금 \d+점/.test(c.text)), '「다음 층 · 지금 N점 · 갈래 끝까지 열림」 글이 없다')
  const ov1 = await overlaps(); check(ov1.length === 0, `844×390 레벨업: 틀 닫기와 겹침 0 (${ov1.join(', ')})`)
  const tb = await rectIn('#tree-open'), h2 = await rectIn('.lv-head h2')
  check(tb !== null && !boxOverlap(tb, h2) && tb.r <= 844, `나무 단추가 「레벨 업!」 오른쪽 · 안 겹침 (${Math.round(tb?.x)},${Math.round(tb?.y)})`)
  const fit = await inF(`const p = D.querySelector('.panel.upgrade'); return { sh: p.scrollHeight, ch: p.clientHeight }`)
  check(fit.sh <= fit.ch + 1, `844×390 카드 창이 굴리지 않고 다 들어간다 (${fit.sh}/${fit.ch})`)
  await shoot('844×390 · 벽력(고르면 솟는 창 열림) · 벼리기(다 열린 갈래) · 단단한 몸(3번 더)', 844, 390)
  // 두 번째 — 갈래 끝 카드(새로 얻음) · 다 열린 갈래의 찌르기 · 조합 카드
  await setup(['capA', 'spear', 'grove'])
  await sleep(700)
  cs = await cards()
  console.log(JSON.stringify(cs.map(({ em, text, ...c }) => c)))
  const ca = cs.find((c) => c.k === 'capA'), sp = cs.find((c) => c.k === 'spear')
  check(ca?.pips === 3 && ca.on === 0 && ca.up === 0 && ca.text.includes('획득'), `삼지창(새로 얻음): 칸 3 · 첫 칸 금빛 · 「획득」 (${ca?.num})`)
  check(sp?.pips === 10 && sp.on === 6 && sp.up === 6 && sp.now === '' && sp.later === '', `찌르기 6→7/10 · 다 열린 갈래라 열림 표시 없음 (${sp?.num})`)
  const ov2 = await overlaps(); check(ov2.length === 0, `844×390 레벨업(둘째): 겹침 0 (${ov2.join(', ')})`)
  await shoot('844×390 · 삼지창(갈래 끝 · 획득) · 찌르기 6→7 · 조합', 844, 390)
  // 나무 화면 (첫 판 카드로 돌아가서 연다)
  await setup(['thunder', 'hone', 'tough']); await sleep(600)
  await inF(`D.getElementById('tree-open').click()`); await sleep(500)
  const tree = await inF(`const v = D.getElementById('tree-view'); return { open: !v.hidden, heads: [...v.querySelectorAll('svg.tree text.head')].map(t => t.textContent), locks: [...v.querySelectorAll('svg.tree .lock text')].map(t => t.textContent), small: v.querySelector('.tree-head small').textContent, close: v.querySelector('.tree-close').textContent }`)
  console.log(JSON.stringify(tree))
  check(tree.open && tree.heads.some((h: string) => h.startsWith('투창 갈래') && h.includes('11번 고름')), `나무 머리 「투창 갈래 11번 고름」 (${tree.heads.join(' / ')})`)
  check(tree.locks.includes('1번 더') && tree.locks.includes('3번 더') && tree.locks.every((t: string) => /^\d+번 더$/.test(t)), `잠긴 층 알약은 자물쇠 + 「N번 더」 (${tree.locks.join(', ')})`)
  const ov3 = await overlaps(); check(ov3.length === 0, `844×390 나무: 틀 닫기와 겹침 0 (${ov3.join(', ')})`)
  await inF(`D.querySelector('#tree-view [data-node="capB"]').dispatchEvent(new W.MouseEvent('click', { bubbles: true }))`); await sleep(200)
  const info = await inF(`return D.querySelector('.tree-info').textContent`)
  check(info.includes('1번 더 고르면 열립니다'), `솟는 창을 누르면 「투창 갈래에서 1번 더 고르면 열립니다」 (${info})`)
  await shoot('844×390 · 기술 나무 (솟는 창 누름)', 844, 390)
  await inF(`D.querySelector('.tree-close').click()`); await sleep(300)
  check(await inF(`return D.getElementById('tree-view').hidden`) === true, '「돌아가기」로 나무가 닫힌다')
  // 667×375
  await size(667, 375)
  const ov4 = await overlaps(); check(ov4.length === 0, `667×375 레벨업: 겹침 0 (${ov4.join(', ')})`)
  const fit2 = await inF(`const p = D.querySelector('.panel.upgrade'); return { sh: p.scrollHeight, ch: p.clientHeight }`)
  check(fit2.sh <= fit2.ch + 1, `667×375 카드 창이 다 들어간다 (${fit2.sh}/${fit2.ch})`)
  await shoot('667×375 · 레벨업', 667, 375)
  await inF(`D.getElementById('tree-open').click()`); await sleep(400)
  const ov5 = await overlaps(); check(ov5.length === 0, `667×375 나무: 겹침 0 (${ov5.join(', ')})`)
  await inF(`D.querySelector('.tree-close').click()`); await sleep(200)
  // 1280×720 (데스크톱)
  await size(1280, 720, false)
  const ov6 = await overlaps(); check(ov6.length === 0, `1280×720 레벨업: 겹침 0 (${ov6.join(', ')})`)
  await shoot('1280×720 · 레벨업', 1280, 720)
  await inF(`D.getElementById('tree-open').click()`); await sleep(400)
  const ov7 = await overlaps(); check(ov7.length === 0, `1280×720 나무: 겹침 0 (${ov7.join(', ')})`)
  await inF(`D.querySelector('.tree-close').click()`); await sleep(200)
  ws.close()
  // 한 장으로 묶는다 — 같은 크롬에 그림 판을 열어 찍는다 (칸마다 844 폭)
  const ws2page = (await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json())
  const ws2 = new WebSocket(ws2page.webSocketDebuggerUrl)
  await new Promise((r, j) => { ws2.onopen = r; ws2.onerror = j })
  const waits2 = new Map<number, (v: any) => void>(); let id2 = 0
  ws2.onmessage = (e) => { const m = JSON.parse(String(e.data)); if (m.id !== undefined) { waits2.get(m.id)?.(m.result ?? m.error); waits2.delete(m.id) } }
  const call2 = (method: string, params: object = {}): Promise<any> => new Promise((r) => { const k = ++id2; waits2.set(k, r); ws2.send(JSON.stringify({ id: k, method, params })) })
  const cell = (s: typeof shots[number]) => `<figure><img src="data:image/png;base64,${s.data}" style="width:${s.w === 667 ? 667 : 844}px"><figcaption>${s.label}</figcaption></figure>`
  const html = `<html><body style="margin:0;background:#111;color:#eee;font:600 17px sans-serif"><div style="display:grid;grid-template-columns:repeat(2,844px);gap:12px;padding:14px;align-items:start">${shots.map(cell).join('')}</div><style>figure{margin:0}figcaption{padding:4px 2px}</style></body></html>`
  const W = 14 + 844 * 2 + 12 + 14, H = 14 + Math.ceil(shots.length / 2) * (475 + 34) + 14
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
