/**
 * 밤의 암살판 — 진입점 (night.html, docs/realm/SNIPE.md §0)
 *
 * 두 갈래로 연다:
 *   - **임무** `night.html?seed=…&arrows=…&id=…` — 칠십팔국의 공작 '암살'이 연다. 끝나면 결과를
 *     localStorage `hanbal.night.result` 에 남긴다 (`{ id, seed, result, alarm, arrowsLeft, stage, at }`).
 *     칠십팔국은 돌아와서 그 키를 읽고 지운다. 같은 창 안의 틀(iframe)로 열었으면 `postMessage` 도 한 번 보낸다.
 *     첫 화면에서 **연습 먼저**(다른 시드의 지붕 · 같은 활·화살 · 결과 안 보냄)와 **건너뛰기**(`result: 'skip'`,
 *     진짜 지붕에서 첫 살 전에 누르면 `seen: true` — 굴림이 조금 준다)를 고른다 (형 2026-10-19).
 *   - **연습장** `night.html?practice=1` (형: "궁술연습장도 만들어서 아무때나 해볼수 있게") — 판 고르기 · 화살 ∞ ·
 *     발각 게이지 켬/끔. 결과는 내보내지 않고, 기록만 `hanbal.night.practice` 에 남긴다 (형의 원칙: 다 남긴다).
 *
 *   - 임무는 `kind=rescue&who=<이름>` 이면 구출이다 — 셋째 판에 적장 대신 묶인 우리 장수, 보초를 다 쓰러뜨리면 `cleared` (형 10-26)
 *   - 두 갈래 다 `bow=<0..3>` 을 받는다 — 활의 단계 (단궁 · 맥궁 · 각궁 · 신궁, night/sim.ts BOW_NAME · P.night.tier*).
 * 쏘기는 당겨 쏘기다 (night/input.ts) — 아무 데나 눌러 뒤로 끌고 놓는다. 활터의 입력은 그대로다.
 *
 * 시드는 여기(바깥)에서만 시계로 만든다 — 판 안(src/night)은 시계를 못 읽는다 (절대 규칙 1).
 * 숨은 탭에서는 프레임을 예약하지 않는다 (절대 규칙 4).
 */
import { startGfxSafe } from './ui/gfxsafe.ts'
// 갤럭시 크롬은 부드러운 그러데이션을 못 그린다 — 밤 판의 하늘·불빛도 (형 10-28) · 그림판을 만들기 전에 켠다
startGfxSafe()
import { createNightInput } from './night/input.ts'
import { setAlwaysPreview } from './render/stickman.ts'
import { createCamera, resizeCamera } from './render/camera.ts'
import { setHeroSkin } from './render/foeart.ts'
import { sprite } from './render/sprites.ts'
import { createSfx, pumpSfx, unlockSfx } from './audio/sfx.ts'
import { createSynth, noiseBurst, resumeSynth, tone, type Synth } from './audio/synth.ts'
import { P } from './tune/params.ts'
import { playOnce, snd, soundVolume } from './ui/realm/sound.ts'
import { BOW_NAME, createNight, stepNight, type Night, type NightResult } from './night/sim.ts'
import { createView, drawNight, pumpView, shakeView } from './night/draw.ts'
import { hitStopMs, pumpEvents, updateFx } from './render/effects.ts'
import { guardName, stageName } from './night/names.ts'
import { guardOf, kindOf, PRACTICE_STAGES, stageTitle, type Guard } from './night/layout.ts'
import { rehearsalSeed, reportsResult, type NightMode } from './night/mission.ts'
import { t as tr } from './i18n/index.ts'

const RESULT_KEY = 'hanbal.night.result'
/** 틀 안의 판이 눕혔는지 — 칠십팔국이 「닫기」를 같이 눕힌다 */
const ROTATED_MSG = 'hanbal.night.rotated'
const PRACTICE_KEY = 'hanbal.night.practice'
/** 연습 기록은 이만큼만 남긴다 (오래된 것부터 버린다) */
const PRACTICE_KEEP = 200

const canvas = document.getElementById('night') as HTMLCanvasElement
const ui = document.getElementById('night-ui') as HTMLDivElement
setAlwaysPreview(true) // 칠십팔국의 밤 판 — 숨 참기 없이 당기는 동안 늘 사선 (형 10-27)
/** 판 전체(캔버스 + 글자판) — 세로 폰이면 통째로 옆으로 눕힌다 (layoutStage) */
const stage = document.getElementById('stage') as HTMLDivElement
/** 세로 폰에서 눕혀 그릴지 — 이 기기에만 기억한다 (기본 눕힘) */
const ROTATE_KEY = 'hanbal.night.rotate'
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
// 개발 서버에서만 — 브라우저 확인용으로 지금 판을 들여다본다 (배포본엔 없다)
if (import.meta.env?.DEV === true) (window as unknown as { __night: () => Night | null }).__night = () => night
let practiceStage = 0
let practiceAlarm = true
/**
 * 임무 전 연습 (형: "암살은 쏘기전에 연습모드 먼저 할수 있게 해줘") — 같은 활·같은 화살 수로 **다른 지붕**을 쏴 본다.
 * 시드는 진짜 시드에서 갈라 내되 같지 않게 — 진짜 지붕의 배치를 미리 보지 못한다. 결과는 칠십팔국으로 안 보낸다.
 */
let rehearsal = false
let rehearsals = 0
const missionSeed = Number(params.get('seed') ?? newSeed()) >>> 0
const missionArrows = Number(params.get('arrows') ?? P.night.arrows)
/** 경비 — 칠십팔국이 `guard=<0..2>` 로 넘긴다 (없으면 보통). 연습장에선 고른다 */
const missionGuard: Guard = guardOf(params.get('guard') ?? 1)
/**
 * 갈래 — 칠십팔국이 `kind=rescue` 로 넘기면 구출 (형 10-26: "구출작전은 암살이랑 비슷하게 활쏘기겜으로 가서 적물리치면될듯").
 * 셋째 판에 적장 대신 묶인 우리 장수 — 보초를 다 쓰러뜨리면 데려 나온다. `who=` 는 그 장수 이름 (글자판에만 쓴다)
 */
const missionKind = kindOf(params.get('kind'))
const rescue = missionKind === 'rescue'
const missionWho = (params.get('who') ?? '').slice(0, 24) || tr('night.ourHero')
/** 건너뛰기 단추 — 구출이면 보낸 이에게 맡긴다 */
const SKIP_LABEL = tr(rescue ? 'night.skipRescue' : 'night.skipAssassin')
let practiceGuard: Guard = 1
const mode = (): NightMode => (practiceMode ? 'practice' : rehearsal ? 'rehearsal' : 'mission')

// ───────────────────────── 소리 — 밤의 것만 (활 소리 · 맞은 소리(신음·헤드샷)는 활터 sfx 그대로) ─────────────────────────

function nightSound(kind: string): void {
  const s = synth
  if (s === null) return
  const base = { attack: 0.002, delay: 0, q: 1, endFreq: 0 }
  switch (kind) {
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
    case 'ember':
      noiseBurst(s, 78, { ...base, dur: 0.22, filterType: 'bandpass', freq: 2200, endFreq: 900, q: 1.5, gain: 0.3, decay: 0.2 })
      break
    case 'startle':
      tone(s, 79, { freq: 330, endFreq: 260, type: 'triangle', dur: 0.18, gain: 0.14, attack: 0.005, decay: 0.16, delay: 0 })
      break
    default:
      break
  }
}

// ───────────────────────── 화면 위 판 (DOM) ─────────────────────────

const CSS = `
#night-ui { position: fixed; inset: 0; pointer-events: none; font: 15px/1.45 system-ui, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif; }
#night-ui .card { pointer-events: auto; position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: min(92%, 440px);
  max-height: 90%; overflow-y: auto; box-sizing: border-box; padding: 18px; border-radius: 18px; background: #141a22ee; border: 1px solid #4a4030;
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
#night-ui .turn { pointer-events: auto; position: absolute; left: 12px; top: 116px; padding: 4px 10px; border-radius: 12px; background: #1b2028aa; color: #95a1ae; font-size: 12px; border: 1px solid #4a5363; }
#night-ui .quit { pointer-events: auto; position: absolute; left: 12px; top: 44px; padding: 4px 10px; font-size: 12px; background: #1b2028aa; }
#night-ui .skip { pointer-events: auto; position: absolute; left: 12px; top: 80px; padding: 4px 10px; font-size: 12px; background: #1b2028aa; }
#night-ui .tag { position: absolute; left: 50%; top: 46px; transform: translateX(-50%); padding: 3px 14px; border-radius: 12px;
  background: #3a3020dd; border: 1px solid #e0bd78; color: #ffd27a; font-weight: 800; letter-spacing: .2em; }
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
  let h = `<div class="card"><h1>${tr('night.practiceTitle')}</h1><p class="mute">${tr('night.practiceSub')}</p><div class="grid">`
  for (let i = 0; i < PRACTICE_STAGES; i++) {
    h += `<button class="${i === practiceStage ? 'on' : ''}" data-act="stage" data-i="${i}">${esc(stageName(stageTitle(i)))}</button>`
  }
  h += `</div><div class="btns"><button class="${practiceAlarm ? 'on' : ''}" data-act="alarm">${tr(practiceAlarm ? 'night.alarmOn' : 'night.alarmOff')}</button>`
  h += `<button data-act="guard">${tr('night.guardBtn', { guard: guardName(practiceGuard) })}</button>`
  h += `<button class="on" data-act="go">${tr('night.start')}</button></div>`
  if (last !== undefined) h += `<p class="mute">${tr('night.lastRun', { stage: esc(stageTitle(last.stage)), s: last.shots, h: last.hits, d: last.heads })}</p>`
  if (all.shots > 0) h += `<p class="mute">${tr('night.allRuns', { runs: runs.length, s: all.shots, h: all.hits, pct: Math.round((all.hits / all.shots) * 100), d: all.heads })}</p>`
  h += `<div class="btns"><button data-act="back">${tr('night.back')}</button></div></div>`
  ui.innerHTML = h
}

/** 임무 첫 화면 — 연습 먼저 · 들어간다 · 건너뛰기 (쏘기 전에 고른다) */
function showMissionIntro(): void {
  night = null
  rehearsal = false
  const who = esc(missionWho)
  ui.innerHTML = `<div class="card"><h1>${tr(rescue ? 'night.titleRescue' : 'night.titleAssassin')}</h1><p>${tr('night.introArrows', { n: missionArrows })}</p>`
    + `<p>${tr('night.guardIntro', { guard: `<b>${guardName(missionGuard)}</b>`, line: GUARD_LINE[missionGuard]! })}</p>`
    + (rescue
      ? `<p class="mute">${tr('night.introRescue', { who })}</p>`
      : `<p class="mute">${tr('night.introAssassin')}</p>`)
    + `<p class="mute">${tr('night.introFire')}</p>`
    + (rescue
      ? `<p class="mute">${tr('night.introDrum', { who })}</p>`
      : `<p class="mute">${tr('night.introCandle')}</p>`)
    + `<p class="mute">${tr('night.introPull')}</p>`
    + `<div class="btns"><button data-act="rehearse">${tr('night.rehearseFirst')}</button><button class="on" data-act="go">${tr('night.enter')}</button></div>`
    + `<p class="mute">${tr('night.introRehearse')}</p>`
    + `<div class="btns"><button data-act="skip0">${SKIP_LABEL}</button></div></div>`
}

function hud(): void {
  // 숨 참기 단추는 뺐다 — 당기는 동안 늘 사선이 보인다 (형 10-27: "숨참기 버튼 없애고 쏠 때마다 가이드라인")
  ui.innerHTML = `<button class="quit" data-act="quit">${tr('night.quit')}</button>`
    + (rehearsal ? `<div class="tag">${tr('night.tagRehearse')}</div>` : '')
    // 진짜 임무에서 첫 살을 쏘기 전까지만 건너뛸 수 있다 — 쏘고 나서 맡기는 길은 없다
    + (!practiceMode && !rehearsal && (night?.shots ?? 0) === 0 ? `<button class="skip" data-act="skip">${tr('night.skip')}</button>` : '')
    // 세로 폰 — 눕혀 그리는 중이면 '세로로 보기', 아니면 '가로로 눕히기' (회전 잠금을 켠 폰도 가로로 쏠 수 있게)
    + (portraitScreen() ? `<button class="turn" data-act="turn">${tr(rotatePref() ? 'night.turnBack' : 'night.turnSide')}</button>` : '')
  breathBtn = ui.querySelector<HTMLElement>('.steady')
  skipBtn = ui.querySelector<HTMLElement>('.skip')
  shownSt = -1
}

/** 건너뛰기 단추 — 첫 살을 쏘면 거둔다 */
let skipBtn: HTMLElement | null = null

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

const GUARD_LINE: readonly string[] = [
  tr('night.guardLine0'),
  tr('night.guardLine1'),
  tr('night.guardLine2'),
]

const LINES: Record<NightResult['result'], (r: NightResult) => string> = {
  dead: () => tr('night.resDead'),
  wounded: () => tr('night.resWounded'),
  fled: (r) => tr(r.alarm ? 'night.resFledDrum' : 'night.resFledCandle'),
  withdrew: () => tr('night.resWithdrew'),
  cleared: () => tr('night.resCleared'),
}

/** 구출의 끝 — 데려 나왔나 · 북이 울려 물러났나 · 화살이 다했나 */
const RESCUE_LINES: Record<NightResult['result'], (r: NightResult) => string> = {
  dead: () => '',
  wounded: () => '',
  fled: () => tr('night.rescueFled', { who: missionWho }),
  withdrew: () => tr('night.rescueWithdrew', { who: missionWho }),
  cleared: () => tr('night.rescueCleared', { who: missionWho }),
}

/** 임무가 끝난 한 번 — 해냈으면 형이 받은 암살·구출 소리, 놓쳤으면 칠십팔국의 큰 실패 북 (형 11-09) · 칠십팔국 음소거를 따른다 */
function endSound(good: boolean): void {
  try { if (localStorage.getItem('hanbal.realm.mute') === '1') return } catch { /* 저장이 막힌 창 */ }
  const base: string = import.meta.env?.BASE_URL ?? '/'
  playOnce(base + (good ? 'realm/sfx/plot/night_h.mp3' : snd('bad_big')), 0.6 * soundVolume('sfx'))
}

function showResult(n: Night): void {
  const r = n.result!
  const good = r.result === 'dead' || r.result === 'wounded' || r.result === 'cleared'
  endSound(good)
  const line = (n.kind === 'rescue' ? RESCUE_LINES : LINES)[r.result](r)
  let h = `<div class="card">${rehearsal ? `<p class="mute">${tr('night.rehearseNote')}</p>` : ''}<h1 style="color:${good ? '#8fd07a' : '#e08a74'}">${esc(line)}</h1>`
  h += `<p class="mute">${tr('night.resStats', { s: n.shots, h: n.hits, d: n.heads })}${n.practice === null ? ` · ${tr('night.arrowsLeft', { n: r.arrowsLeft })}` : ''}</p>`
  // 촛불로 놓쳤으면 어떻게 잡는지 (형: "촛불이 꺼져서 도망치는건 대체뭔데. 어떻게잡으라는겨")
  if (r.result === 'fled' && !r.alarm && n.chiefUp >= 0) h += `<p class="mute">${tr('night.fledHint')}</p>`
  h += `<div class="btns">`
  if (rehearsal) {
    // 연습 — 칠십팔국으로 안 보낸다. 다시 연습하거나 진짜로 들어간다
    h += `<button data-act="rehearse">${tr('night.rehearseAgain')}</button><button class="on" data-act="go">${tr('night.shootReal')}</button></div>`
    h += `<div class="btns"><button data-act="skip0">${SKIP_LABEL}</button>`
  } else if (n.practice !== null) {
    saveRun({ at: new Date().toISOString(), stage: n.stage, alarm: n.practice.alarm, shots: n.shots, hits: n.hits, heads: n.heads, result: r.result })
    h += `<button class="on" data-act="go">${tr('night.again')}</button><button data-act="menu">${tr('night.pickStage')}</button>`
  } else {
    exportResult(n, r)
    h += `<button class="on" data-act="back">${tr('night.back')}</button><button data-act="practice">${tr('night.practiceBtn')}</button>`
  }
  ui.innerHTML = h + `</div></div>`
}

/** 임무의 결과를 칠십팔국으로 — localStorage 한 키 (+ 틀 안이면 postMessage) */
function exportResult(n: Night, r: NightResult): void {
  if (!reportsResult(mode())) return // 연습은 남지 않는다
  const out = { id: missionId, seed: n.seed, ...r, at: new Date().toISOString() }
  try {
    localStorage.setItem(RESULT_KEY, JSON.stringify(out))
  } catch {
    // 저장이 막힌 창 — 칠십팔국은 굴림(맡기기)으로 처리한다
  }
  if (window.parent !== window) window.parent.postMessage({ type: RESULT_KEY, ...out }, location.origin)
}

/**
 * 건너뛰기 — 쏘지 않고 자객 솜씨로 굴린다 (칠십팔국 plots.ts). `seen` 은 진짜 지붕을 본 뒤인가 —
 * 그러면 굴림이 조금 준다 (P.realm.plotSkipSeenMul). 틀 안이면 칠십팔국이 밤 판을 닫는다
 */
function skipMission(seen: boolean): void {
  if (practiceMode || missionId === '') return
  rehearsal = false // 연습 중이었어도 건너뛰면 진짜 임무를 맡긴다
  const out = { id: missionId, seed: missionSeed, result: 'skip' as const, alarm: false, seen, at: new Date().toISOString() }
  try {
    localStorage.setItem(RESULT_KEY, JSON.stringify(out))
  } catch {
    // 저장이 막힌 창 — 안 쏜 것과 같다 (굴림)
  }
  night = null
  if (window.parent !== window) window.parent.postMessage({ type: RESULT_KEY, ...out }, location.origin)
  ui.innerHTML = (rescue
    ? `<div class="card"><h1>${tr('night.leftRescueTitle')}</h1><p class="mute">${tr('night.leftRescueBody')}</p>`
    : `<div class="card"><h1>${tr('night.leftAssassinTitle')}</h1><p class="mute">${tr('night.leftAssassinBody')}</p>`)
    + `<div class="btns"><button class="on" data-act="back">${tr('night.back')}</button></div></div>`
}

function start(): void {
  view.pops = []
  night = practiceMode
    ? createNight({ seed: newSeed(), bowTier, guard: practiceGuard, practice: { stage: practiceStage, alarm: practiceAlarm, infinite: true } })
    : rehearsal
      ? createNight({ seed: rehearsalSeed(missionSeed, rehearsals), bowTier, guard: missionGuard, arrows: missionArrows, kind: missionKind })
      : createNight({ seed: missionSeed, bowTier, guard: missionGuard, arrows: missionArrows, kind: missionKind })
  hud()
  acc = 0
  wake()
}

ui.addEventListener('click', (ev) => {
  const t = (ev.target as HTMLElement).closest<HTMLElement>('[data-act]')
  if (t === null) return
  unlock()
  switch (t.dataset['act']) {
    case 'stage': practiceStage = Number(t.dataset['i']); showPractice(); break
    case 'alarm': practiceAlarm = !practiceAlarm; showPractice(); break
    case 'guard': practiceGuard = ((practiceGuard + 1) % 3) as Guard; showPractice(); break
    // 들어간다 · 진짜로 쏜다 — 연습에서 왔으면 연습을 끄고 진짜 시드로
    case 'go': if (!practiceMode) rehearsal = false; start(); break
    case 'rehearse': rehearsal = true; rehearsals++; start(); break
    case 'skip0': skipMission(false); break
    case 'skip': if (night !== null && night.result === null && night.shots === 0 && !rehearsal) skipMission(true); break
    case 'menu': showPractice(); break
    case 'practice': location.search = `?practice=1&bow=${bowTier}&back=${encodeURIComponent(back)}`; break
    case 'turn': setRotatePref(!rotatePref()); layoutStage(); if (night !== null && night.result === null) hud(); break
    case 'back': location.href = back; break
    case 'quit':
      if (night !== null && practiceMode) showPractice()
      else if (rehearsal) showMissionIntro() // 연습에서 그만 — 첫 화면으로
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

// ───────────────────────── 세로 폰 — 판을 옆으로 눕힌다 ─────────────────────────
//
// 형: "화면을 세로로 플레이 하고있는데 활쏠때만 가로로 고정되게 만들어야하나?"
// 밤 판은 지붕에서 마당 끝까지 35m 가 한 화면에 들어와야 한다 — 세로 폰(폭 390px)에 맞추면 1m 가 11px,
// 보초 머리(반지름 0.14m)가 점 하나다. 활터는 과녁이 거리만큼 커지지만 밤 판의 사람은 커질 수 없다.
// screen.orientation.lock 은 전체화면에서만 되고 아이폰 사파리는 아예 없다 — 그래서 **판을 통째로 90° 눕혀 그린다.**
// 폰의 회전 잠금이 켜져 있어도 폰만 옆으로 돌리면 가로 판이 된다. 회전 잠금이 꺼져 있으면 폰을 돌리는 순간
// 화면이 진짜 가로가 되어 눕힘이 저절로 풀린다. 원하면 '세로로 보기'로 끈다 (이 기기에 기억).

const portraitScreen = (): boolean => innerHeight > innerWidth

function rotatePref(): boolean {
  try {
    return localStorage.getItem(ROTATE_KEY) !== '0'
  } catch {
    return true
  }
}

function setRotatePref(on: boolean): void {
  try {
    localStorage.setItem(ROTATE_KEY, on ? '1' : '0')
  } catch {
    // 저장이 막힌 창 — 이번만 바뀐다
  }
}

let rotatedNow = false
function layoutStage(): void {
  const rot = portraitScreen() && rotatePref()
  const st = stage.style
  if (rot) {
    // 판 점 (x, y) → 화면 (innerWidth − y, x): 오른쪽으로 90°. 판의 위가 화면 오른쪽 — 폰을 왼쪽으로 눕혀 쥔다
    st.width = `${innerHeight}px`
    st.height = `${innerWidth}px`
    st.transform = `translate(${innerWidth}px, 0) rotate(90deg)`
  } else {
    st.width = '100%'
    st.height = '100%'
    st.transform = ''
  }
  if (rot !== rotatedNow) {
    rotatedNow = rot
    input.setRotated(rot)
  }
  // 틀 안이면 칠십팔국에 알린다 — 바깥의 「닫기」도 판과 같이 눕는다 (형 10-25: 닫기 단추가 세로로 누워 있다)
  // 틀 안에서 연습장으로 옮겨 가면 새 판이 다시 알리니, 바뀔 때만이 아니라 늘 보낸다
  if (window.parent !== window) window.parent.postMessage({ type: ROTATED_MSG, rot }, location.origin)
}

// ───────────────────────── 돌림 ─────────────────────────

let raf = 0
let last = 0
let acc = 0
let shownEnd = false

function frame(now: number): void {
  raf = 0
  if (document.hidden) return
  raf = requestAnimationFrame(frame)
  // 그리기 상한 — 90·120Hz 폰에서 두 배로 그리지 않는다. last 를 안 고치니 건너뛴 시간은 다음 dt 에 쌓인다 (결정론 그대로 · 형 11-10: 폰에서 구출이 엄청 느림)
  if (last !== 0 && now - last < 1000 / P.night.maxFps - 1) return
  const realDt = last === 0 ? 0 : (now - last) / 1000
  last = now
  watchLoad(realDt)
  resizeCamera(cam, canvas, view.low ? P.night.lowDprCap : P.night.dprCap)
  const n = night
  if (n !== null) {
    const step = 1 / P.sim.hz
    const maxFrame = step * P.sim.maxCatchUpSteps
    // 히트스톱 — 활터 루프와 같다 (game/loop.ts): 맞힌 순간 판을 잠깐 세운다. 단 당기는 중에는 안 세운다 (시위가 얼면 안 된다)
    const ph = n.w.archer.phase
    const frozen = hitStopMs(view.fx) > 0 && ph !== 'drawing' && ph !== 'full'
    if (!frozen) acc += realDt < maxFrame ? realDt : maxFrame
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
    pumpEvents(view.fx, n.w)
    n.w.events.length = 0
    updateFx(view.fx, realDt)
    shakeView(view, realDt)
    for (const e of n.events) nightSound(e.t)
    pumpView(view, n, 0, now)
    n.events.length = 0
    drawNight(ctx, view, n, now, input.pull)
    syncBreath(n)
    if (skipBtn !== null && n.shots > 0) {
      skipBtn.remove()
      skipBtn = null
    }
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
    // 첫 화면 카드 뒤 — 한 번 칠하고 쉰다 (판이 서거나 화면이 바뀌면 wake)
    cancelAnimationFrame(raf)
    raf = 0
  }
}

/**
 * 폰이 버거우면 가벼운 그림으로 (형 11-10: "구출 암살 활쏘기 아직도 엄청 버벅 · 그럴 만한 게 없는데") — 프레임 간격 60개의 가운데값이
 * lowFrameMs 를 넘으면 한 번 내린다 (DPR 1 · 어둠·불빛 층 더 낮게). 칠십팔국이 저사양·보통으로 돌고 있으면 처음부터 가볍게.
 */
const gaps: number[] = []
function watchLoad(dt: number): void {
  if (view.low || dt <= 0 || dt > 0.5 || night === null) return
  gaps.push(dt * 1000)
  if (gaps.length < 60) return
  const mid = [...gaps].sort((a, b) => a - b)[30]!
  gaps.length = 0
  if (mid > P.night.lowFrameMs) view.low = true
}
try {
  const ap = window.parent !== window ? window.parent.document.querySelector('.ap') : null
  if (ap !== null && ap.classList.contains('q-low')) view.low = true // 「보통」은 이제 제 화소로 (형 11-12: 빨라졌으니 해상도 올려)
} catch { /* 다른 곳에서 띄웠다 */ }

function wake(): void {
  if (raf === 0 && !document.hidden) {
    last = 0
    raf = requestAnimationFrame(frame)
  }
}
document.addEventListener('visibilitychange', wake)
addEventListener('resize', () => {
  layoutStage()
  wake()
  if (night !== null && night.result === null) hud()
})

layoutStage()
if (practiceMode) showPractice()
else showMissionIntro()
wake()
