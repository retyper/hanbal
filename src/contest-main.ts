/// <reference types="vite/client" />
/**
 * 2장 송양과의 활쏘기 겨루기 — 활터의 낮 과녁판 (contest.html)
 *
 * 형 10-25: "송양이 활솜씨를 겨루자 라고 떴는데 이거 암살 스테이지면 안 되는 거 아님??" — 전엔 밤의 암살판(지붕·보초·창호지)을
 * 글만 바꿔 썼다. 겨루기는 낮의 과녁이다: 동명왕편의 그 겨루기 — 백 보 밖 과녁(사서엔 사슴 그림), 그리고 매단 옥가락지.
 *
 * 활의 손맛·탄도·과녁·소리·그리기는 활터 것을 그대로 쓴다 (sim/world · render/scene · audio/sfx).
 * 활의 단계는 밤 판과 같은 몫 (night/sim tierBow) — 칠십팔국이 `bow=` 로 넘긴다.
 * 결과는 밤 판과 같은 말로 부모(칠십팔국)에 보낸다: `hanbal.night.result` · id · dead(이김) / fled(짐) / skip(안 겨룸).
 */
import { startGfxSafe } from './ui/gfxsafe.ts'
// 갤럭시 크롬은 부드러운 그러데이션을 못 그린다 — 하늘·언덕이 깨졌다 (형 10-28: "그래픽도 깨져 있고") · 그림판을 만들기 전에 켠다
startGfxSafe()
import { createWorld, isSettled, step } from './sim/world.ts'
import type { StageDef, TargetSpec, World } from './sim/types.ts'
import { createInput } from './input/pointer.ts'
import { setAlwaysPreview } from './render/stickman.ts'
import { createRenderer, getCamera, getHitStopMs } from './render/scene.ts'
import type { HudState } from './render/hud.ts'
import { createSfx, pumpSfx, unlockSfx, updateSfx } from './audio/sfx.ts'
import { BOW_NAME, tierBow, tierOf } from './night/sim.ts'
import { P } from './tune/params.ts'

const canvas = document.getElementById('night') as HTMLCanvasElement
const ui = document.getElementById('night-ui') as HTMLDivElement
setAlwaysPreview(true) // 겨루기 — 숨 참기 없이 당기는 동안 늘 사선 (형 10-27)
const params = new URLSearchParams(location.search)
const missionId = params.get('id') ?? 'contest-archery'
const back = params.get('back') ?? 'realm.html'
const tier = tierOf(Number(params.get('bow') ?? 0) || 0)
const seed = Number(params.get('seed') ?? 1) >>> 0
const RESULT = 'hanbal.night.result'

const renderer = createRenderer(canvas)
const input = createInput(canvas, getCamera(renderer))
const sfx = createSfx()
const hud: HudState = { training: 0, canLevelUp: false, muted: false, silent: false, toast: '', arrow: '', stars: -1, endReason: '', arrowRule: false, time: 0, bestTime: 0, record: false }

/**
 * 세 판 — 과녁 하나는 너무 싱거웠다 (형 10-28: "제대로 만들어라 · 과녁도 너무 한 개뿐")
 *  1. 백 보 과녁 셋 — 가까운 것부터 먼 것까지 높이도 제각각
 *  2. 매단 사슴 과녁 둘 — 줄에 매달려 위아래로 흔들린다
 *  3. 옥가락지 둘 — 높이 매단 작은 가락지(맞으면 떨어진다)
 * 판마다 송양이 먼저 쏘고(맞힌 수가 글로 뜬다) 우리는 다 맞혀야 다음 판. 하늘은 판 id 의 장 번호로 — 3장 「안개 아침」이 가장 밝다
 */
const ROUNDS = [
  { title: '백 보 과녁', line: '송양이 백 보 안팎에 과녁 셋을 세웠다.', foe: '송양은 셋 중 둘을 맞혔다. 셋 다 맞히면 앞선다.', won: '세 과녁 한가운데' },
  { title: '흔들리는 사슴', line: '송양이 사슴 그린 과녁 둘을 줄에 매달아 흔든다.', foe: '송양은 둘 중 하나를 맞혔다.', won: '흔들리는 사슴을 둘 다' },
  { title: '옥가락지', line: '송양이 옥가락지 둘을 높이 매달았다. 깨뜨리면 이긴다.', foe: '송양의 화살은 가락지 곁을 스쳤다.', won: '' },
] as const

function roundTargets(i: number): TargetSpec[] {
  const R = P.realm
  const g = R.contestGapX
  if (i === 0) return [0, 1, 2].map((k) => ({ kind: 'static', x: R.contestDeerX - g * (2 - k), y: R.contestDeerY + (k === 1 ? R.contestDeerR * 1.5 : 0), r: R.contestDeerR }))
  if (i === 1) return [0, 1].map((k) => ({ kind: 'moving', x: R.contestSwingX + g * k, y: R.contestSwingY, r: R.contestDeerR, ampX: 0, ampY: R.contestSwingAmp, freq: R.contestSwingFreq * (k === 0 ? 1 : 1.3) }))
  return [0, 1].map((k) => ({ kind: 'aerial', x: R.contestRingX - g * (1 - k), y: R.contestRingY + R.contestRingR * 2 * k, r: R.contestRingR }))
}

function roundDef(i: number): StageDef {
  const targets = roundTargets(i)
  const arrows = targets.length + P.realm.contestArrows + P.night.tierArrows * tier
  return { id: `3-c${i + 1}`, pair: `겨루기 ${i + 1}판`, title: ROUNDS[i]!.title, seed: seed + i, arrows, targetScore: 0, wind: 0, targets }
}

const lv = P.night.stat + P.night.tierStat * tier
const newWorld = (i: number): World => createWorld(roundDef(i), { str: lv, steady: lv, stamina: lv, focus: lv }, 'basic', tierBow(tier))

let round = 0
let w: World = newWorld(0)
/** 판이 도는 중인가 — 첫 화면·사이·끝 화면에서는 sim 을 세운다 */
let live = false
let shot = false
let sent = false

function send(result: 'dead' | 'fled' | 'skip'): void {
  if (sent) return
  sent = true
  if (window.parent !== window) window.parent.postMessage({ type: RESULT, id: missionId, seed, result, alarm: false, seen: true, at: new Date().toISOString() }, location.origin)
}

// ───────────────────────── 화면 위 판 (DOM) ─────────────────────────

const CSS = `
#night-ui { position: fixed; inset: 0; pointer-events: none; font: 15px/1.45 system-ui, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif; }
#night-ui .card { pointer-events: auto; position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: min(92%, 420px);
  max-height: 90%; overflow-y: auto; box-sizing: border-box; padding: 18px; border-radius: 18px; background: #1d1810ee; border: 1px solid #8a6a3a;
  box-shadow: 0 16px 40px #000c; text-align: center; color: #efe6d2; }
#night-ui h1 { font-family: 'Gowun Batang', serif; font-size: 26px; margin: 2px 0 6px; color: #e0bd78; }
#night-ui p { margin: 6px 0; color: #d8ccb2; } #night-ui .mute { color: #a39678; font-size: 13px; }
#night-ui .btns { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; margin-top: 12px; }
#night-ui button { font: inherit; font-size: 15px; padding: 10px 18px; border-radius: 12px; border: 1px solid #6a5a3a; background: #2e271c; color: #efe6d2; cursor: pointer; }
#night-ui button.on { background: linear-gradient(#a57a31, #7d5a22); border-color: #e0bd78; color: #fff4dc; }
#night-ui .tag { position: absolute; left: 50%; top: 12px; transform: translateX(-50%); padding: 3px 14px; border-radius: 12px;
  background: #3a3020dd; border: 1px solid #e0bd78; color: #ffd27a; font-weight: 800; letter-spacing: .1em; }
#night-ui .quit { pointer-events: auto; position: absolute; left: 12px; top: 150px; padding: 4px 10px; font-size: 12px; background: #1d1810aa; }
#night-ui .steady { pointer-events: auto; position: absolute; right: max(16px, env(safe-area-inset-right)); bottom: max(46px, calc(env(safe-area-inset-bottom) + 30px));
  width: 88px; height: 88px; padding: 0; border-radius: 50%; touch-action: none; -webkit-user-select: none; user-select: none; font-weight: 800; }
#night-ui .steady.on { background: #3a3020; color: #ffd27a; box-shadow: 0 0 0 3px #ffd27a, 0 0 18px #ffd27a88; }
`
document.head.insertAdjacentHTML('beforeend', `<style>${CSS}</style>`)

const card = (h: string): void => { ui.innerHTML = `<div class="card">${h}</div>` }

function showIntro(): void {
  live = false
  card(`<h1>송양과의 활쏘기 겨루기</h1><p>비류수 가 언덕, 아침 안개가 걷힌다. 활은 ${BOW_NAME[tier]}.</p>`
    + `<p class="mute">세 판을 겨룬다. 백 보 과녁 셋 · 흔들리는 사슴 과녁 둘 · 매단 옥가락지 둘. 판마다 과녁을 다 맞혀야 다음 판으로 간다. 화살은 과녁 수보다 ${P.realm.contestArrows + P.night.tierArrows * tier}발 넉넉하다.</p>`
    + `<p class="mute">누르고 있으면 당기고, 놓으면 쏜다. 당기는 동안 점선이 화살이 날아갈 길을 보여 준다.</p>`
    + `<div class="btns"><button data-act="back">물러난다</button><button class="on" data-act="go">겨룬다</button></div>`)
}

function playHud(): void {
  ui.innerHTML = '<button class="quit" data-act="quit">그만</button>' // 몇째 판인지는 판 머리글(pair)에 — 가운데 띠가 머리글을 가렸다 // 숨 참기 단추는 뺐다 — 당기는 동안 늘 사선 (형 10-27)
}

function startRound(i: number): void {
  round = i
  w = newWorld(i)
  live = true
  acc = 0
  playHud()
}

function showBetween(): void {
  live = false
  const nx = ROUNDS[round + 1]!
  card(`<h1>${ROUNDS[round]!.won}</h1><p>구경꾼이 웅성인다.</p><p>${nx.line}</p><p class="mute">${nx.foe}</p><div class="btns"><button class="on" data-act="next">${round === 0 ? '둘째' : '셋째'} 판</button></div>`)
}

function showEnd(won: boolean): void {
  live = false
  send(won ? 'dead' : 'fled')
  card(won
    ? `<h1>옥가락지가 깨졌다</h1><p>송양이 활을 내려놓는다. 겨루기를 이겼다.</p><div class="btns"><button class="on" data-act="back">돌아가기</button></div>`
    : `<h1>겨루기를 졌다</h1><p>${['과녁 셋을 다 맞히지 못했다.', '흔들리는 사슴을 다 맞히지 못했다.', '옥가락지를 다 깨뜨리지 못했다.'][round]} 송양이 웃는다.</p><div class="btns"><button class="on" data-act="back">돌아가기</button></div>`)
}

ui.addEventListener('click', (ev) => {
  const t = (ev.target as HTMLElement).closest<HTMLElement>('[data-act]')
  if (t === null) return
  unlock()
  switch (t.dataset['act']) {
    case 'go': startRound(0); break
    case 'next': startRound(round + 1); break
    // 쏘고 나서 그만두면 진 것 — 한 발도 안 쐈으면 안 겨룬 것
    case 'quit': if (shot) showEnd(false); else { send('skip'); showIntro() } break
    case 'back': if (!shot) send('skip'); location.href = back; break
    default: break
  }
})
ui.addEventListener('pointerdown', (ev) => {
  const t = (ev.target as HTMLElement).closest<HTMLElement>('[data-act="steady"]')
  if (t === null) return
  ev.preventDefault()
  input.setSteady(true)
  t.classList.add('on')
})
const steadyOff = (): void => {
  input.setSteady(false)
  ui.querySelector('.steady')?.classList.remove('on')
}
ui.addEventListener('pointerup', steadyOff)
ui.addEventListener('pointercancel', steadyOff)

let unlocked = false
function unlock(): void {
  if (unlocked) return
  unlocked = true
  unlockSfx(sfx)
}
canvas.addEventListener('pointerdown', unlock, { passive: true })

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
  if (live) {
    const ph = w.archer.phase
    const frozen = getHitStopMs(renderer) > 0 && ph !== 'drawing' && ph !== 'full'
    const maxFrame = w.dt * P.sim.maxCatchUpSteps
    if (!frozen) acc += realDt < maxFrame ? realDt : maxFrame
    let steps = 0
    while (acc >= w.dt && steps < P.sim.maxCatchUpSteps) {
      step(w, input.frame)
      input.endStep()
      acc -= w.dt
      steps++
    }
    if (steps >= P.sim.maxCatchUpSteps) acc = 0
    if (w.events.some((e) => e.t === 'release')) shot = true
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
  // 마지막 살과 떨어지는 가락지가 다 멎은 뒤에 판정한다 (활터 isSettled)
  if (live && w.status !== 'playing' && isSettled(w)) {
    if (w.status === 'cleared') {
      if (round < ROUNDS.length - 1) showBetween()
      else showEnd(true)
    } else showEnd(false)
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
