/**
 * 밤의 암살판 — 진입점 (night.html, docs/realm/SNIPE.md §0)
 *
 * 두 갈래로 연다:
 *   - **임무** `night.html?seed=…&arrows=…&id=…` — 칠십팔국의 공작 '암살'이 연다. 끝나면 결과를
 *     localStorage `hanbal.night.result` 에 남긴다 (`{ id, seed, result, alarm, arrowsLeft, stage, at }`).
 *     칠십팔국은 돌아와서 그 키를 읽고 지운다. 같은 창 안의 틀(iframe)로 열었으면 `postMessage` 도 한 번 보낸다.
 *   - **연습장** `night.html?practice=1` (형: "궁술연습장도 만들어서 아무때나 해볼수 있게") — 판 고르기 · 화살 ∞ ·
 *     발각 게이지 켬/끔. 결과는 내보내지 않고, 기록만 `hanbal.night.practice` 에 남긴다 (형의 원칙: 다 남긴다).
 *
 *   - 두 갈래 다 `bow=<0..3>` 을 받는다 — 활의 단계 (단궁 · 맥궁 · 각궁 · 신궁, night/sim.ts BOW_NAME · P.night.tier*).
 * 쏘기는 당겨 쏘기다 (night/input.ts) — 아무 데나 눌러 뒤로 끌고 놓는다. 활터의 입력은 그대로다.
 *
 * 시드는 여기(바깥)에서만 시계로 만든다 — 판 안(src/night)은 시계를 못 읽는다 (절대 규칙 1).
 * 숨은 탭에서는 프레임을 예약하지 않는다 (절대 규칙 4).
 */
import { createNightInput } from './night/input.ts'
import { createCamera, resizeCamera } from './render/camera.ts'
import { setHeroSkin } from './render/foeart.ts'
import { sprite } from './render/sprites.ts'
import { createSfx, pumpSfx, unlockSfx } from './audio/sfx.ts'
import { createSynth, noiseBurst, resumeSynth, tone, type Synth } from './audio/synth.ts'
import { P } from './tune/params.ts'
import { BOW_NAME, createNight, stepNight, type Night, type NightResult } from './night/sim.ts'
import { createView, drawNight, pumpView } from './night/draw.ts'
import { PRACTICE_STAGES, stageTitle } from './night/layout.ts'

const RESULT_KEY = 'hanbal.night.result'
const PRACTICE_KEY = 'hanbal.night.practice'
/** 연습 기록은 이만큼만 남긴다 (오래된 것부터 버린다) */
const PRACTICE_KEEP = 200

const canvas = document.getElementById('night') as HTMLCanvasElement
const ui = document.getElementById('night-ui') as HTMLDivElement
const ctx = canvas.getContext('2d')!
const params = new URLSearchParams(location.search)
const practiceMode = params.get('practice') === '1'
const missionId = params.get('id') ?? ''
const back = params.get('back') ?? 'realm.html'

// 여자 자객의 몸 (public/sprites/night-assassin.png) — 활터 주인공의 그림 자리에 바꿔 끼운다. 팔은 남색 소매 · 살색 손
setHeroSkin({
  body: 'night-assassin',
  art: { jawU: 0.594, jawV: 0.152, bowU: 0.69, strU: 0.26, shV: 0.215, footV: 0.99 },
  sleeve: '#3b3a6b',
  skin: '#e8b996',
})
sprite('night-assassin')

const cam = createCamera()
const view = createView(cam)
const input = createNightInput(canvas)
/** 활의 단계 — 칠십팔국이 `bow=<n>` 으로 넘긴다 (0 단궁 · 1 맥궁 · 2 각궁 · 3 신궁). 연습장도 같은 값으로 쏜다 */
const bowTier = Math.max(0, Math.min(BOW_NAME.length - 1, Math.floor(Number(params.get('bow') ?? 0) || 0)))
const sfx = createSfx()
let synth: Synth | null = null

const newSeed = (): number => (Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0

let night: Night | null = null
let practiceStage = 0
let practiceAlarm = true

// ───────────────────────── 소리 — 밤의 것만 (활 소리는 활터 sfx 그대로) ─────────────────────────

function nightSound(kind: string): void {
  const s = synth
  if (s === null) return
  const base = { attack: 0.002, delay: 0, q: 1, endFreq: 0 }
  switch (kind) {
    case 'head': case 'body': case 'leg': case 'chief':
      noiseBurst(s, 71, { ...base, dur: 0.12, filterType: 'lowpass', freq: 700, endFreq: 180, gain: 0.5, decay: 0.12 })
      break
    case 'wall':
      noiseBurst(s, 72, { ...base, dur: 0.08, filterType: 'bandpass', freq: 1400, q: 4, gain: 0.45, decay: 0.08 })
      break
    case 'tile':
      noiseBurst(s, 73, { ...base, dur: 0.18, filterType: 'highpass', freq: 2600, gain: 0.5, decay: 0.16 })
      break
    case 'paper':
      noiseBurst(s, 74, { ...base, dur: 0.2, filterType: 'bandpass', freq: 3200, endFreq: 5200, q: 2, gain: 0.35, decay: 0.2 })
      break
    case 'lamp':
      noiseBurst(s, 75, { ...base, dur: 0.14, filterType: 'highpass', freq: 3800, gain: 0.4, decay: 0.12 })
      break
    case 'drum':
      for (let i = 0; i < 3; i++) tone(s, 76, { freq: 92, endFreq: 48, type: 'sine', dur: 0.35, gain: 0.9, attack: 0.004, decay: 0.32, delay: i * 0.42 })
      break
    case 'notice':
      tone(s, 77, { freq: 660, endFreq: 880, type: 'triangle', dur: 0.12, gain: 0.15, attack: 0.005, decay: 0.1, delay: 0 })
      break
    default:
      break
  }
}

// ───────────────────────── 화면 위 판 (DOM) ─────────────────────────

const CSS = `
#night-ui { position: fixed; inset: 0; pointer-events: none; font: 15px/1.45 system-ui, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif; }
#night-ui .card { pointer-events: auto; position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: min(92vw, 440px);
  max-height: 90vh; overflow-y: auto; box-sizing: border-box; padding: 18px; border-radius: 18px; background: #141a22ee; border: 1px solid #4a4030;
  box-shadow: 0 16px 40px #000c; text-align: center; color: #e9e2d4; }
#night-ui h1 { font-family: 'Gowun Batang', serif; font-size: 26px; margin: 2px 0 6px; color: #d9b36a; }
#night-ui p { margin: 6px 0; color: #cfc6b4; } #night-ui .mute { color: #8f887b; font-size: 13px; }
#night-ui .btns { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; margin-top: 12px; }
#night-ui button { font: inherit; font-size: 15px; padding: 10px 16px; border-radius: 12px; border: 1px solid #4a5363; background: #2a313c; color: #e9e2d4; cursor: pointer; }
#night-ui button.on { background: linear-gradient(#a57a31, #7d5a22); border-color: #e0bd78; color: #fff4dc; }
#night-ui .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 10px; }
#night-ui .grid button { padding: 14px 8px; }
#night-ui .steady { pointer-events: auto; position: absolute; right: max(16px, env(safe-area-inset-right)); bottom: max(46px, calc(env(safe-area-inset-bottom) + 30px));
  width: 92px; height: 92px; padding: 0; border-radius: 50%; border: 0; touch-action: none; -webkit-user-select: none; user-select: none;
  background: conic-gradient(var(--sc, #6cc7b8) calc(var(--st, 1) * 360deg), #2a313c 0); box-shadow: 0 4px 14px #000a, 0 0 0 2px #e0bd7899; }
#night-ui .steady span { position: absolute; inset: 7px; border-radius: 50%; background: #1b2028; display: flex; flex-direction: column;
  align-items: center; justify-content: center; color: #f3e6c8; font-size: 16px; font-weight: 800; line-height: 1.15; }
#night-ui .steady span i { font-style: normal; font-size: 11px; font-weight: 600; color: #9aa4b2; }
#night-ui .steady.on span { background: #3a3020; color: #ffd27a; } #night-ui .steady.on { box-shadow: 0 0 0 3px #ffd27a, 0 0 18px #ffd27a88; }
#night-ui .turn { position: absolute; left: 50%; bottom: 10px; transform: translateX(-50%); padding: 4px 12px; border-radius: 12px; background: #000a; color: #95a1ae; font-size: 12px; }
#night-ui .quit { pointer-events: auto; position: absolute; left: 12px; top: 44px; padding: 4px 10px; font-size: 12px; background: #1b2028aa; }
`
const style = document.createElement('style')
style.textContent = CSS
document.head.appendChild(style)

const esc = (s: string): string => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

interface PracticeRun {
  readonly at: string
  readonly stage: number
  readonly alarm: boolean
  readonly shots: number
  readonly hits: number
  readonly heads: number
  readonly result: string
}

function loadRuns(): PracticeRun[] {
  try {
    const r = JSON.parse(localStorage.getItem(PRACTICE_KEY) ?? '[]') as PracticeRun[]
    return Array.isArray(r) ? r : []
  } catch {
    return []
  }
}

function saveRun(run: PracticeRun): void {
  try {
    const runs = loadRuns()
    runs.push(run)
    localStorage.setItem(PRACTICE_KEY, JSON.stringify(runs.slice(-PRACTICE_KEEP)))
  } catch {
    // 저장이 막힌 창 — 연습은 그대로 된다
  }
}

/** 연습장 첫 화면 — 판 고르기 넷 · 게이지 켬/끔 · 지난 기록 */
function showPractice(): void {
  night = null
  const runs = loadRuns()
  const last = runs[runs.length - 1]
  const all = runs.reduce((s, r) => ({ shots: s.shots + r.shots, hits: s.hits + r.hits, heads: s.heads + r.heads }), { shots: 0, hits: 0, heads: 0 })
  let h = `<div class="card"><h1>궁술 연습장</h1><p class="mute">밤 지붕 위에서 쏴 본다. 화살은 끝이 없다.</p><div class="grid">`
  for (let i = 0; i < PRACTICE_STAGES; i++) {
    h += `<button class="${i === practiceStage ? 'on' : ''}" data-act="stage" data-i="${i}">${esc(stageTitle(i))}</button>`
  }
  h += `</div><div class="btns"><button class="${practiceAlarm ? 'on' : ''}" data-act="alarm">발각 게이지 ${practiceAlarm ? '켬' : '끔'}</button>`
  h += `<button class="on" data-act="go">시작</button></div>`
  if (last !== undefined) h += `<p class="mute">지난번 ${esc(stageTitle(last.stage))} · 쏜 ${last.shots} · 맞힘 ${last.hits} · 머리 ${last.heads}</p>`
  if (all.shots > 0) h += `<p class="mute">모두 ${runs.length}판 · 쏜 ${all.shots} · 맞힘 ${all.hits} (${Math.round((all.hits / all.shots) * 100)}%) · 머리 ${all.heads}</p>`
  h += `<div class="btns"><button data-act="back">돌아가기</button></div></div>`
  ui.innerHTML = h
}

function showMissionIntro(): void {
  const arrows = Number(params.get('arrows') ?? P.night.arrows)
  ui.innerHTML = `<div class="card"><h1>밤의 암살</h1><p>기와지붕 위에 엎드렸다. 화살 ${arrows}발.</p>`
    + `<p class="mute">보초를 다 쓰러뜨리고 셋째 판의 창호지 뒤 그림자를 쏜다. 빗나간 살은 소리를 낸다. 시체가 등불 아래 있으면 들킨다. 등불을 쏘면 꺼진다.</p>`
    + `<p class="mute">아무 데나 누르고 뒤로 끈다 — 끈 쪽의 반대로 겨눈다 · 놓으면 쏜다 · 누른 자리로 돌아와 놓으면 그만둔다. 오른쪽 아래 「숨 참기」를 누르고 있으면 떨림이 멎는다.</p>`
    + `<div class="btns"><button class="on" data-act="go">들어간다</button></div></div>`
}

function hud(): void {
  ui.innerHTML = `<button class="steady" data-act="steady"><span>숨 참기<i>누르고 있는다</i></span></button><button class="quit" data-act="quit">그만</button>`
    + (innerHeight > innerWidth ? `<div class="turn">가로로 돌리면 크게 보인다</div>` : '')
  breathBtn = ui.querySelector<HTMLElement>('.steady')
  shownSt = -1
}

/** 숨 참기 단추의 테 = 스태미나 (빨간 바 아래로 내려가면 붉게) — 바뀔 때만 고친다 */
let breathBtn: HTMLElement | null = null
let shownSt = -1
function syncBreath(n: Night): void {
  if (breathBtn === null || !breathBtn.isConnected) return
  const a = n.w.archer
  const st = a.staminaMax > 0 ? Math.round((a.stamina / a.staminaMax) * 50) / 50 : 1
  if (st === shownSt) return
  shownSt = st
  breathBtn.style.setProperty('--st', String(st))
  breathBtn.style.setProperty('--sc', st >= P.stamina.steadyZone ? '#6cc7b8' : '#ff8a5a')
}

const LINES: Record<NightResult['result'], (r: NightResult) => string> = {
  dead: () => '적장이 쓰러졌다.',
  wounded: () => '적장이 크게 다쳤다. 한동안 군대를 못 이끈다.',
  fled: (r) => (r.alarm ? '북이 울렸다. 적장이 달아났다.' : '촛불이 꺼졌다. 적장을 놓쳤다.'),
  withdrew: () => '화살이 다했다. 조용히 물러났다.',
  cleared: () => '다 쓰러뜨렸다.',
}

function showResult(n: Night): void {
  const r = n.result!
  const good = r.result === 'dead' || r.result === 'wounded' || r.result === 'cleared'
  let h = `<div class="card"><h1 style="color:${good ? '#8fd07a' : '#e08a74'}">${esc(LINES[r.result](r))}</h1>`
  h += `<p class="mute">쏜 ${n.shots} · 맞힘 ${n.hits} · 머리 ${n.heads}${n.practice === null ? ` · 남은 화살 ${r.arrowsLeft}` : ''}</p><div class="btns">`
  if (n.practice !== null) {
    saveRun({ at: new Date().toISOString(), stage: n.stage, alarm: n.practice.alarm, shots: n.shots, hits: n.hits, heads: n.heads, result: r.result })
    h += `<button class="on" data-act="go">다시</button><button data-act="menu">판 고르기</button>`
  } else {
    exportResult(n, r)
    h += `<button class="on" data-act="back">돌아가기</button><button data-act="practice">연습장</button>`
  }
  ui.innerHTML = h + `</div></div>`
}

/** 임무의 결과를 칠십팔국으로 — localStorage 한 키 (+ 틀 안이면 postMessage) */
function exportResult(n: Night, r: NightResult): void {
  const out = { id: missionId, seed: n.seed, ...r, at: new Date().toISOString() }
  try {
    localStorage.setItem(RESULT_KEY, JSON.stringify(out))
  } catch {
    // 저장이 막힌 창 — 칠십팔국은 굴림(맡기기)으로 처리한다
  }
  if (window.parent !== window) window.parent.postMessage({ type: RESULT_KEY, ...out }, location.origin)
}

function start(): void {
  view.pops = []
  night = practiceMode
    ? createNight({ seed: newSeed(), bowTier, practice: { stage: practiceStage, alarm: practiceAlarm, infinite: true } })
    : createNight({ seed: Number(params.get('seed') ?? newSeed()) >>> 0, bowTier, arrows: Number(params.get('arrows') ?? P.night.arrows) })
  hud()
  acc = 0
}

ui.addEventListener('click', (ev) => {
  const t = (ev.target as HTMLElement).closest<HTMLElement>('[data-act]')
  if (t === null) return
  unlock()
  switch (t.dataset['act']) {
    case 'stage': practiceStage = Number(t.dataset['i']); showPractice(); break
    case 'alarm': practiceAlarm = !practiceAlarm; showPractice(); break
    case 'go': start(); break
    case 'menu': showPractice(); break
    case 'practice': location.search = '?practice=1'; break
    case 'back': location.href = back; break
    case 'quit':
      if (night !== null && practiceMode) showPractice()
      else if (night !== null && night.result === null) {
        // 임무에서 그만 — 조용히 물러난 것으로 친다
        night.result = { result: 'withdrew', alarm: night.alarm >= 1, arrowsLeft: night.w.arrowsLeft, stage: night.stage }
        night.phase = 'end'
        showResult(night)
      }
      break
    default: break
  }
})

// 숨 단추 — 누르는 동안 숨을 참는다 (폰엔 Shift 가 없다)
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
  synth = createSynth()
  if (synth !== null) resumeSynth(synth)
}
canvas.addEventListener('pointerdown', unlock, { passive: true })

// ───────────────────────── 돌림 ─────────────────────────

let raf = 0
let last = 0
let acc = 0
let shownEnd = false

function frame(now: number): void {
  raf = 0
  if (document.hidden) return
  raf = requestAnimationFrame(frame)
  const realDt = last === 0 ? 0 : (now - last) / 1000
  last = now
  resizeCamera(cam, canvas)
  const n = night
  if (n !== null) {
    const step = 1 / P.sim.hz
    const maxFrame = step * P.sim.maxCatchUpSteps
    acc += realDt < maxFrame ? realDt : maxFrame
    let steps = 0
    while (acc >= step && steps < P.sim.maxCatchUpSteps) {
      input.syncAim(n.w.archer.x, n.w.archer.y)
      stepNight(n, input.frame)
      input.endStep()
      acc -= step
      steps++
    }
    if (steps >= P.sim.maxCatchUpSteps) acc = 0
    pumpSfx(sfx, n.w)
    n.w.events.length = 0
    for (const e of n.events) nightSound(e.t)
    pumpView(view, n, 0, now)
    n.events.length = 0
    drawNight(ctx, view, n, now, input.pull)
    syncBreath(n)
    if (n.result !== null && !shownEnd) {
      shownEnd = true
      showResult(n)
    }
    if (n.result === null) shownEnd = false
  } else {
    // 메뉴 뒤에도 밤하늘 — 빈 판을 그려 둔다
    ctx.setTransform(cam.dpr, 0, 0, cam.dpr, 0, 0)
    ctx.fillStyle = '#04060b'
    ctx.fillRect(0, 0, cam.w, cam.h)
  }
}

function wake(): void {
  if (raf === 0 && !document.hidden) {
    last = 0
    raf = requestAnimationFrame(frame)
  }
}
document.addEventListener('visibilitychange', wake)
addEventListener('resize', () => {
  if (night !== null && night.result === null) hud()
})

if (practiceMode) showPractice()
else showMissionIntro()
wake()
