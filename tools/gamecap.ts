/**
 * 게임 화면 녹화 (docs/realm/LAUNCH-PLAN.md §3-1 · 예고편·쇼츠·스크린샷의 바탕).
 *
 * 헤드리스 크롬을 원하는 크기로 띄워 판을 열고, PRE 로 장면을 차린 뒤(검수 모드 빨리 감기 · 단추 누르기),
 * CDP 화면 중계(Page.startScreencast)로 실시간 그림을 받아 ffmpeg 로 고정 30fps mp4 를 굽는다. 소리는 없다(뒤에 얹는다).
 * 실시간이라 CSS 연출·컷인도 게임에서 보이는 그대로다. 받은 그림 수·실제 fps 를 적어 준다(낮으면 크기를 줄이거나 다시).
 *
 *   node --experimental-strip-types tools/gamecap.ts <나갈 mp4> <초> [너비 1080] [높이 1920] [주소]
 *     PRE='js 식'   — 녹화 전에 페이지에서 돌린다 (await 가능) · 예) 검수 단추 누르고 기다리기
 *     EACH='js 식'  — 녹화 중 0.1초마다 돌린다 (예: 입력 넣기)
 *     DPR=1         — 기기 픽셀 배율 (1080×1920 을 그대로 찍으려면 1)
 *     SHOT=파일.png — 녹화 대신 지금 화면 한 장 (스크린샷용)
 *   주소 기본값 http://localhost:5174/raid.html?review (5173 은 형의 자리 · 검수 손잡이는 개발 서버에서만)
 *   열전 장면: PRE 로 검수 단추(「중반 5분 재생」 등) 누르고 기다림 → EACH="$(cat tools/gamecap-raid-drive.js)" · 주소에 &background (창 흐림에 멈추지 않게) · 가로 1280×720 (세로면 열전이 멈춘다)
 *   11-22 잰 값: 1280×720 에서 받은 그림 53~75fps → 30fps 로 고르게
 *
 * 런타임 의존성 없음 — phone-shot.ts 와 같은 CDP 길. 임시 프로필은 스스로 지운다.
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir, homedir } from 'node:os'
import { join } from 'node:path'

const OUT = process.argv[2] ?? 'cap.mp4'
const SEC = Number(process.argv[3] ?? 6)
const W = Number(process.argv[4] ?? 1080)
const H = Number(process.argv[5] ?? 1920)
const URL0 = process.argv[6] ?? 'http://localhost:5174/raid.html?review'
const DPR = Number(process.env['DPR'] ?? 1)
const FPS = 30
const PORT = 9450 + Math.floor(Math.random() * 40)
const CHROMES = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe']
const FFMPEG = process.env['FFMPEG'] ?? join(homedir(), 'AppData/Roaming/Python/Python39/site-packages/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe')
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

const exe = CHROMES.find((p) => existsSync(p))
if (exe === undefined) throw new Error('크롬을 못 찾았다')
const prof = mkdtempSync(join(tmpdir(), 'gamecap-'))
const frames = mkdtempSync(join(tmpdir(), 'gamecap-f-'))
const chrome = spawn(exe, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${prof}`, `--window-size=${W},${H}`, '--no-first-run', '--mute-audio',
  '--autoplay-policy=no-user-gesture-required', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', 'about:blank'], { stdio: 'ignore' })
try {
  let tabs: any = null
  for (let i = 0; i < 50 && tabs === null; i++) { try { tabs = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json() } catch { await sleep(200) } }
  const page = tabs.find((t: any) => t.type === 'page')
  const ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j })
  let id = 0
  const waits = new Map<number, (v: any) => void>()
  const got: { t: number; data: string }[] = []
  ws.onmessage = (ev) => {
    const m = JSON.parse(String(ev.data))
    if (m.id !== undefined) { waits.get(m.id)?.(m.result ?? m.error); waits.delete(m.id); return }
    if (m.method === 'Page.screencastFrame') {
      got.push({ t: m.params.metadata.timestamp, data: m.params.data })
      ws.send(JSON.stringify({ id: ++id, method: 'Page.screencastFrameAck', params: { sessionId: m.params.sessionId } }))
    }
    if (m.method === 'Runtime.exceptionThrown') console.error('페이지 예외:', m.params.exceptionDetails?.exception?.description?.slice(0, 200))
  }
  const call = (method: string, params: object = {}): Promise<any> => new Promise((r) => { const k = ++id; waits.set(k, r); ws.send(JSON.stringify({ id: k, method, params })) })
  await call('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: DPR, mobile: false })
  await call('Emulation.setFocusEmulationEnabled', { enabled: true })
  await call('Page.enable'); await call('Runtime.enable')
  await call('Page.navigate', { url: URL0 })
  await sleep(5000)
  const vis = await call('Runtime.evaluate', { returnByValue: true, expression: 'document.visibilityState' })
  if (vis.result?.value !== 'visible') console.error('주의: 탭이', vis.result?.value, '— 캔버스가 멈출 수 있다 (절대 규칙 4)')
  const pre = process.env['PRE']
  if (pre !== undefined && pre !== '') {
    const r = await call('Runtime.evaluate', { expression: `(async () => { ${pre} })()`, awaitPromise: true, returnByValue: true })
    if (r.exceptionDetails) console.error('PRE 실패:', r.exceptionDetails.exception?.description?.slice(0, 300))
    else if (r.result?.value !== undefined) console.log('PRE:', JSON.stringify(r.result.value).slice(0, 300))
  }
  const shot = process.env['SHOT']
  if (shot !== undefined && shot !== '') {
    const s = await call('Page.captureScreenshot', { format: 'png' })
    writeFileSync(shot, Buffer.from(s.data, 'base64'))
    console.log(shot)
  } else {
    await call('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: W * DPR, maxHeight: H * DPR, everyNthFrame: 1 })
    const each = process.env['EACH']
    const t0 = Date.now()
    while (Date.now() - t0 < SEC * 1000 + 300) {
      if (each !== undefined && each !== '') void call('Runtime.evaluate', { expression: `(() => { ${each} })()` })
      await sleep(100)
    }
    await call('Page.stopScreencast')
    ws.close()
    if (got.length < 2) throw new Error('받은 그림이 없다 — 탭이 숨겨졌거나 화면이 안 바뀐다')
    // 받은 그림을 시각대로 30fps 칸에 채운다 (빈 칸은 앞 그림 그대로)
    const start = got[0]!.t
    const names: string[] = []
    for (let i = 0; i < got.length; i++) { const n = join(frames, `f${String(i).padStart(5, '0')}.jpg`); writeFileSync(n, Buffer.from(got[i]!.data, 'base64')); names.push(n) }
    const list = got.map((g, i) => `file '${names[i]!.replace(/\\/g, '/')}'\nduration ${Math.max(0.001, ((got[i + 1]?.t ?? g.t + 1 / FPS) - g.t)).toFixed(4)}`).join('\n') + `\nfile '${names.at(-1)!.replace(/\\/g, '/')}'\n`
    writeFileSync(join(frames, 'list.txt'), list)
    const span = got.at(-1)!.t - start
    console.log(`받은 그림 ${got.length}장 · ${span.toFixed(1)}초 · 실제 ${(got.length / span).toFixed(1)}fps`)
    const ff = spawn(FFMPEG, ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', join(frames, 'list.txt'), '-vf', `fps=${FPS},scale=${W}:${H}:flags=lanczos,format=yuv420p`,
      '-t', String(SEC), '-c:v', 'libx264', '-crf', '17', '-preset', 'slow', '-movflags', '+faststart', OUT], { stdio: 'inherit' })
    await new Promise((r) => ff.on('exit', r))
    console.log(OUT)
  }
} finally {
  chrome.kill()
  await sleep(500)
  for (const d of [prof, frames]) for (let i = 0; i < 12 && existsSync(d); i++) { try { rmSync(d, { recursive: true, force: true }) } catch { await new Promise((r) => setTimeout(r, 400)) } }
}
