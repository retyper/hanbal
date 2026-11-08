/// <reference types="vite/client" />
/**
 * 바다도적 막기 — 사건 카드 「바다 도적」의 「맞선다」 (pirate.html · docs/realm/SNIPE.md §0-9)
 *
 * 활의 손맛·탄도·적·소리·그리기는 활터 것을 그대로 쓰고(sim/world · render/scene · audio/sfx),
 * 물결·목책·궤짝만 이 판의 것이다(src/pirate/). 칠십팔국이 `seed·sev·mu·watch·bow` 를 넘기고,
 * 끝나면 막은 물결 수를 부모(칠십팔국)에 보낸다: `hanbal.pirate.result` · { id, held, won } · 안 쏘고 나오면 { skip }.
 */
import { startGfxSafe } from './ui/gfxsafe.ts'
// 갤럭시 크롬의 그러데이션 깨짐 — 그림판을 만들기 전에 켠다 (contest-main 과 같다)
startGfxSafe()
import { isSettled } from './sim/world.ts'
import { createInput } from './input/pointer.ts'
import { setAlwaysPreview } from './render/stickman.ts'
import { createRenderer, getCamera, getHitStopMs, setSceneHooks } from './render/scene.ts'
import type { HudState } from './render/hud.ts'
import { createSfx, playUi, pumpSfx, unlockSfx, updateSfx } from './audio/sfx.ts'
import { tierBow, tierOf } from './night/sim.ts'
import { arrowIcon } from './ui/arrowicons.ts'
import { ARROW_KINDS } from './game/arrows.ts'
import { createPirate, stepPirate, type PirateRun } from './pirate/sim.ts'
import { pirateHooks } from './pirate/draw.ts'
import { WAVE_COUNT } from './pirate/waves.ts'
import { P } from './tune/params.ts'

const canvas = document.getElementById('night') as HTMLCanvasElement
const ui = document.getElementById('night-ui') as HTMLDivElement
setAlwaysPreview(true) // 당기는 동안 늘 사선 — 몰려오는 판이라 숨 참기 없이 (겨루기와 같다)
const params = new URLSearchParams(location.search)
const num = (k: string, d: number): number => {
  const v = Number(params.get(k))
  return params.get(k) !== null && Number.isFinite(v) ? v : d
}
const missionId = params.get('id') ?? 'card-pirates'
const back = params.get('back') ?? 'realm.html'
const tier = tierOf(num('bow', 0))
const opts = {
  seed: num('seed', 1) >>> 0,
  sev: num('sev', 2),
  mu: num('mu', 5),
  watch: num('watch', 0),
  bow: tierBow(tier),
  bowStat: P.night.tierStat * tier,
}
const RESULT = 'hanbal.pirate.result'

const renderer = createRenderer(canvas)
const input = createInput(canvas, getCamera(renderer))
const sfx = createSfx()
const hud: HudState = { training: 0, canLevelUp: false, muted: false, silent: false, toast: '', arrow: '', stars: -1, endReason: '', arrowRule: false, time: 0, bestTime: 0, record: false, bare: true }

let run: PirateRun = createPirate(opts)
setSceneHooks(pirateHooks(() => run))
/** 판이 도는 중인가 — 첫 화면·끝 화면에서는 sim 을 세운다 */
let live = false
let sent = false

function send(m: { held: number; won: boolean } | { skip: true }): void {
  if (sent) return
  sent = true
  if (window.parent !== window) window.parent.postMessage({ type: RESULT, id: missionId, ...m }, location.origin)
}

// ───────────────────────── 화면 위 판 (DOM) ─────────────────────────

const CSS = `
#night-ui { position: fixed; inset: 0; pointer-events: none; font: 15px/1.45 system-ui, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif; color: #efe6d2; }
#night-ui .card { pointer-events: auto; position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: min(92%, 420px);
  max-height: 90%; overflow-y: auto; box-sizing: border-box; padding: 18px; border-radius: 18px; background: #14202aee; border: 1px solid #5f8aa0;
  box-shadow: 0 16px 40px #000c; text-align: center; }
#night-ui h1 { font-family: 'Gowun Batang', serif; font-size: 26px; margin: 2px 0 8px; color: #f0c86a; }
#night-ui p { margin: 6px 0; color: #d8ccb2; }
#night-ui .rules { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin: 12px 0 4px; }
#night-ui .rules div { background: #0c161ecc; border: 1px solid #36576a; border-radius: 12px; padding: 8px 4px; font-size: 13px; }
#night-ui .rules b { display: block; font-size: 22px; line-height: 1.2; color: #fff4dc; }
#night-ui .btns { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; margin-top: 14px; }
#night-ui button { font: inherit; font-size: 16px; padding: 12px 20px; border-radius: 12px; border: 1px solid #4d6a7a; background: #1d2c37; color: #efe6d2; cursor: pointer; }
#night-ui button.on { background: linear-gradient(#c98f3a, #8a5a1f); border-color: #f0c86a; color: #fff4dc; font-weight: 800; }
#night-ui button:active { transform: scale(0.95); }
#night-ui .top { position: absolute; left: 0; right: 0; top: max(8px, env(safe-area-inset-top)); display: flex; justify-content: center; align-items: center; gap: 14px; }
#night-ui .waves { display: flex; gap: 6px; }
#night-ui .waves i { width: 30px; height: 10px; border-radius: 6px; background: #ffffff30; border: 1px solid #ffffff55; }
#night-ui .waves i.done { background: #f0c86a; border-color: #f0c86a; }
#night-ui .waves i.now { background: #ffffffcc; animation: pir-blink 0.9s ease-in-out infinite alternate; }
#night-ui .lives { display: flex; gap: 3px; }
#night-ui .lives svg { width: 22px; height: 26px; }
#night-ui .lives .gone { opacity: 0.28; }
#night-ui .quit { pointer-events: auto; position: absolute; left: max(10px, env(safe-area-inset-left)); top: max(8px, env(safe-area-inset-top)); padding: 5px 11px; font-size: 13px; background: #0c161eaa; }
#night-ui .arm { position: absolute; left: 50%; transform: translateX(-50%); top: calc(max(8px, env(safe-area-inset-top)) + 40px); display: flex; align-items: center; gap: 8px;
  padding: 4px 12px 4px 6px; border-radius: 14px; background: #0c161ecc; border: 2px solid #f0c86a; }
#night-ui .arm img { width: 40px; height: 40px; }
#night-ui .arm .bar { width: 96px; height: 8px; border-radius: 4px; background: #ffffff25; overflow: hidden; }
#night-ui .arm .bar i { display: block; height: 100%; background: #f0c86a; }
#night-ui .arm b { color: #fff4dc; font-size: 14px; }
#night-ui .arm.pop { animation: pir-pop 0.35s ease-out; }
#night-ui .banner { position: absolute; left: 0; right: 0; top: 30%; text-align: center; font-family: 'Gowun Batang', serif; font-size: clamp(30px, 9vw, 56px);
  font-weight: 800; color: #fff4dc; text-shadow: 0 3px 0 #000, 0 0 24px #000; animation: pir-banner 1.6s ease-out forwards; }
#night-ui .banner.red { color: #ff7a5c; }
#night-ui .flash { position: absolute; inset: 0; box-shadow: inset 0 0 80px 30px #ff2a1a; animation: pir-fade 0.5s ease-out forwards; }
@keyframes pir-blink { from { opacity: 0.45 } to { opacity: 1 } }
@keyframes pir-pop { 0% { transform: translateX(-50%) scale(1.6) } 100% { transform: translateX(-50%) scale(1) } }
@keyframes pir-banner { 0% { transform: scale(2.2); opacity: 0 } 15% { transform: scale(1); opacity: 1 } 75% { opacity: 1 } 100% { opacity: 0 } }
@keyframes pir-fade { from { opacity: 1 } to { opacity: 0 } }
`
document.head.insertAdjacentHTML('beforeend', `<style>${CSS}</style>`)

const card = (h: string): void => { ui.innerHTML = `<div class="card">${h}</div>` }
const NTH = ['첫', '둘째', '셋째'] as const
const STAKE = '<svg viewBox="0 0 22 26"><path d="M3 26V7l3-5 3 5v19zM9.5 26V5l3-5 3 5v21zM16 26V7l3-5 3 5v19z" fill="#a27c52" stroke="#3f2a16" stroke-width="1"/><rect x="2" y="13" width="18" height="2.4" fill="#c9b48a"/></svg>'

function showIntro(): void {
  live = false
  const lives = run.livesMax
  card(`<h1>바다 도적이 몰려온다</h1><p>모래밭에 목책을 세웠다. 물결 셋을 막아 내면 도적의 쇠를 빼앗는다.</p>`
    + `<div class="rules"><div><b>🌊×${WAVE_COUNT}</b>물결</div><div><b>${STAKE.replace('<svg', '<svg width="22" height="26"')}×${lives}</b>목책</div><div><b>${arrowIcon('burst', 26)}</b>궤짝을 쏘면 살이 바뀝니다</div></div>`
    + `<p style="font-size:13px;color:#a9b8c2">누르고 있으면 당기고, 놓으면 쏩니다. 화살은 끝이 없습니다.</p>`
    + `<div class="btns"><button data-act="back">물러난다</button><button class="on" data-act="go">막는다</button></div>`)
}

/** 머리띠 — 물결 · 목책 · 쥔 궤짝 살 (글 없이 그림으로) */
let lastHud = ''
function playHud(force = false): void {
  const waves = Array.from({ length: WAVE_COUNT }, (_, k) => `<i class="${k < run.held ? 'done' : k === run.wave && run.phase === 'fight' ? 'now' : ''}"></i>`).join('')
  const lives = Array.from({ length: run.livesMax }, (_, k) => (k < run.lives ? STAKE : STAKE.replace('<svg', '<svg class="gone"'))).join('')
  const key = `${waves}|${run.lives}|${run.special}`
  if (!force && key === lastHud) return
  const armChanged = !lastHud.endsWith(`|${run.special}`)
  lastHud = key
  const keep = [...ui.querySelectorAll('.banner, .flash')]
  ui.innerHTML = '<button class="quit" data-act="quit">그만</button>'
    + `<div class="top"><div class="waves">${waves}</div><div class="lives">${lives}</div></div>`
    + (run.special !== 'basic' ? `<div class="arm${armChanged ? ' pop' : ''}">${arrowIcon(run.special, 40)}<span><b>${ARROW_KINDS.find((k) => k.id === run.special)?.name ?? ''}</b><span class="bar"><i></i></span></span></div>` : '')
  for (const el of keep) ui.appendChild(el)
}

/** 쥔 살의 남은 시간 — 띠만 줄인다 (DOM 을 새로 안 만든다) */
function armBar(): void {
  const bar = ui.querySelector<HTMLElement>('.arm .bar i')
  if (bar !== null) bar.style.width = `${Math.max(0, (run.specialLeft / P.pirate.specialSec) * 100).toFixed(1)}%`
}

function banner(text: string, red = false): void {
  ui.querySelector('.banner')?.remove()
  const el = document.createElement('div')
  el.className = `banner${red ? ' red' : ''}`
  el.textContent = text
  el.addEventListener('animationend', () => el.remove())
  ui.appendChild(el)
}

function flash(): void {
  const el = document.createElement('div')
  el.className = 'flash'
  el.addEventListener('animationend', () => el.remove())
  ui.appendChild(el)
}

function start(): void {
  run = createPirate(opts)
  live = true
  acc = 0
  lastHud = ''
  playHud(true)
}

function showEnd(won: boolean, held: number): void {
  live = false
  if (run.shots > 0) send({ held, won })
  else send({ skip: true })
  card(won
    ? `<h1>물결 셋을 다 막았다</h1><p>도적들이 배를 버리고 달아난다. 남기고 간 쇠를 거둔다.</p><div class="btns"><button class="on" data-act="back">돌아가기</button></div>`
    : `<h1>${NTH[Math.min(2, held)]} 물결에 목책이 뚫렸다</h1><p>${held > 0 ? `${['', '물결 하나를', '물결 둘을'][held]} 막아 낸 만큼 잃는 것이 줄었다.` : '도적들이 포구로 쏟아져 들어온다.'}</p><div class="btns"><button class="on" data-act="back">돌아가기</button></div>`)
}

ui.addEventListener('click', (ev) => {
  const t = (ev.target as HTMLElement).closest<HTMLElement>('[data-act]')
  if (t === null) return
  unlock()
  switch (t.dataset['act']) {
    case 'go': start(); break
    // 쏘고 나서 그만두면 지금 물결에서 뚫린 것 — 한 발도 안 쐈으면 안 싸운 것
    case 'quit': if (run.shots > 0) showEnd(false, run.held); else { send({ skip: true }); showIntro() } break
    case 'back': if (run.shots === 0) send({ skip: true }); location.href = back; break
    default: break
  }
})

let unlocked = false
function unlock(): void {
  if (unlocked) return
  unlocked = true
  unlockSfx(sfx)
}
canvas.addEventListener('pointerdown', unlock, { passive: true })

/** 판의 사건 → 띠·글자·소리 (WWE: 막으면 크게, 뚫리면 붉게) */
function pumpRun(): void {
  for (const e of run.events) {
    if (e.t === 'wave') { banner(`${NTH[e.k]} 물결`); playHud(true) }
    else if (e.t === 'clear' && e.k < WAVE_COUNT - 1) { banner('막았다!'); playUi(sfx, 'levelup'); playHud(true) }
    else if (e.t === 'break') { flash(); playHud(true) }
    else if (e.t === 'arm') { playUi(sfx, 'unlock'); playHud(true) }
    else if (e.t === 'unarm') playHud(true)
  }
  run.events.length = 0
}

// ───────────────────────── 돌림 (활터 루프와 같다 · 숨은 탭에선 멈춘다) ─────────────────────────

let raf = 0
let last = 0
let acc = 0

function frame(now: number): void {
  raf = 0
  if (document.hidden) return
  raf = requestAnimationFrame(frame)
  const realDt = last === 0 ? 0 : (now - last) / 1000
  last = now
  const w = run.w
  if (live) {
    const ph = w.archer.phase
    const frozen = getHitStopMs(renderer) > 0 && ph !== 'drawing' && ph !== 'full'
    const maxFrame = w.dt * P.sim.maxCatchUpSteps
    if (!frozen) acc += realDt < maxFrame ? realDt : maxFrame
    let steps = 0
    while (acc >= w.dt && steps < P.sim.maxCatchUpSteps) {
      stepPirate(run, input.frame)
      input.endStep()
      acc -= w.dt
      steps++
    }
    if (steps >= P.sim.maxCatchUpSteps) acc = 0
    pumpRun()
    armBar()
  }
  try {
    pumpSfx(sfx, w)
    updateSfx(sfx, w, realDt)
  } catch {
    /* 이번 프레임 소리를 포기할 뿐이다 */
  }
  try {
    renderer.draw(w, live ? acc / w.dt : 0, realDt, hud)
  } finally {
    w.events.length = 0
  }
  // 마지막 살이 멎은 뒤에 끝 화면을 띄운다
  if (live && run.result !== null && isSettled(w)) {
    showEnd(run.result.won, run.result.held)
  }
}

function wake(): void {
  if (raf === 0 && !document.hidden) {
    last = 0
    raf = requestAnimationFrame(frame)
  }
}
document.addEventListener('visibilitychange', wake)
addEventListener('resize', () => renderer.resize(), { passive: true })
addEventListener('orientationchange', () => renderer.resize(), { passive: true })

showIntro()
wake()
