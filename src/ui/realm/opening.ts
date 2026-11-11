/**
 * 오프닝 · 끝맺음 — 있는 그림을 천천히 움직여(켄 번스) 여덟 장면 45초로 잇는다 (docs/realm/OPENING.md).
 * 그림은 CSS transform(확대·옆으로 흐름) 하나만 움직인다 — 화면 가득한 그림에 filter 애니는 폰 GPU 한도라 걸지 않는다.
 * 시계는 rAF 로 돌려서 숨은 탭에서는 저절로 멈춘다(규칙 4). 아무 데나 누르거나 키를 누르면 통째로 건너뛴다.
 * 내레이션: public/realm/voice/opening/<n>.ogg 가 있으면 깔고, 없으면 자막만으로 돈다.
 * 음악: 첫 화면 곡 가운데 가장 웅장한 것(bgm_title_g1)을 깔고 6번 장면부터 커졌다가 끝에서 잦아든다. 내레이션이 나오는 동안은 음악을 낮춘다(덕킹).
 * 크기는 소리 설정의 배경음 슬라이더를 따르고, 무음이면 안 튼다. 지도·판 음악은 오프닝 동안 hush 로 끈다.
 */
import { t, type Key } from '../../i18n/index.ts'
import { lang } from '../../i18n/lang.ts'
import { AWAKEN_ART, AWAKEN_LOOP, loopFile } from '../../realm/data/awaken-art.ts'
import { CHAPTERS } from '../../realm/data/campaign.ts'
import { P } from '../../tune/params.ts'
import { openCreditsRoll } from './credits.ts'
import { sndFile, soundVolume } from './sound.ts'
import { worldMapReady } from './worldmap.ts'
import { WORLD_DATA, worldGeo } from '../../realm/data/regions/world.ts'
import { WORLD_GEO } from '../../realm/data/regions/world-geo.ts'
import { flagIcon } from '../../realm/data/art.ts'

const SEEN_KEY = 'hanbal.opening.seen'

/** 이 기기에서 오프닝을 본 적이 있나 */
export function openingSeen(): boolean {
  try { return localStorage.getItem(SEEN_KEY) === '1' } catch { return false }
}
function markSeen(): void {
  try { localStorage.setItem(SEEN_KEY, '1') } catch { /* 못 남기면 다음에 또 보일 뿐 */ }
}

type Motion = 'in' | 'out' | 'panL' | 'panR' | 'rush' | 'drift'
/** 움직임마다 [시작 transform, 끝 transform] — 늘 확대 1 이상이라 가장자리가 비지 않는다 */
const MOTION: Readonly<Record<Motion, readonly [string, string]>> = {
  in: ['scale(1.02)', 'scale(1.2)'],
  out: ['scale(1.22)', 'scale(1.04)'],
  panL: ['scale(1.16) translate3d(3%,0,0)', 'scale(1.16) translate3d(-3%,0,0)'],
  panR: ['scale(1.16) translate3d(-3%,0,0)', 'scale(1.16) translate3d(3%,0,0)'],
  rush: ['scale(1.02)', 'scale(1.4)'],
  drift: ['scale(1)', 'scale(1.07)'], // 지도는 가장자리까지 깃발이 있어 크게 밀지 않는다
}
type Extra = 'flags' | 'shake' | 'jitter' | 'awaken' | 'logo' | ''
interface Scene {
  /** public/realm 아래 그림. 둘이면 장면 안에서 반반 나눠 이어 보인다 */
  readonly imgs: readonly string[]
  readonly motion: Motion
  readonly extra: Extra
}
/** 장면 목록 — 길이는 P.realm.openingSceneSec (같은 차례) · 글은 opening.1…8 */
const SCENES: readonly Scene[] = [
  { imgs: ['event/event-golden-egg.jpg'], motion: 'in', extra: '' },
  { imgs: ['event/event-egg-birth.jpg', 'keyart/gujibong.jpg'], motion: 'panR', extra: '' },
  { imgs: [], motion: 'drift', extra: 'flags' },
  { imgs: ['opening/op-forge.jpg', 'event/event-iron-trade.jpg'], motion: 'panL', extra: '' },
  { imgs: ['opening/op-drums.jpg', 'film/film-win-field.jpg'], motion: 'rush', extra: 'shake' },
  { imgs: ['event/event-capture.jpg', 'event/event-captive-persuade.jpg'], motion: 'in', extra: 'jitter' },
  { imgs: [], motion: 'in', extra: 'awaken' },
  { imgs: [], motion: 'in', extra: 'logo' },
]
const AWAKEN_PICK = ['w-30-guya-soebi', 'l-L2-soseono', 'w-102-garak-dana'] as const
/** 깃발이 서로 덮지 않게 겹친 쌍만 살살 밀어낸다(영남 쪽은 도읍이 빽빽하다) — 제자리에서 한 깃발 폭 안쪽으로만 움직인다 */
function spreadOut(pts: ReadonlyArray<readonly [number, number]>, gap: number): Array<[number, number]> {
  const q = pts.map((p): [number, number] => [p[0], p[1]])
  for (let it = 0; it < 40; it++) {
    for (let i = 0; i < q.length; i++) for (let j = i + 1; j < q.length; j++) {
      const a = q[i]!, b = q[j]!
      let dx = b[0] - a[0], dy = b[1] - a[1]
      let d = Math.hypot(dx, dy)
      if (d >= gap) continue
      if (d < 0.01) { dx = 1; dy = 0; d = 1 }
      const m = ((gap - d) / 2) / d
      a[0] -= dx * m; a[1] -= dy * m; b[0] += dx * m; b[1] += dy * m
    }
  }
  return q
}
/** 삼한과 북녘 판 바탕 그림 한 장의 세로/가로 — 조각 눈금(1024×765 = 경도 2.9° × 위도 2.0°)과 판의 틀(proj)에서 */
const WORLD_ASPECT = ((WORLD_GEO.proj.lat1 - WORLD_GEO.proj.lat0) * (765 / 2.0)) / ((WORLD_GEO.proj.lon1 - WORLD_GEO.proj.lon0) * (1024 / 2.9))
/** 깃발이 앉을 지도 위 비율 자리 — 나라마다 도읍 한 곳 · 남쪽(아래)부터 */
interface Spot { readonly id: string; readonly x: number; readonly y: number }
function flagSpots(): readonly Spot[] {
  const out: Spot[] = []
  for (const n of WORLD_DATA.STARTS) {
    const ll = worldGeo(n.faction.capital)
    const ic = flagIcon(n.faction.id)
    if (ll === undefined || ic === undefined) continue
    const [x, y] = WORLD_GEO.pos(ll[0], ll[1])
    out.push({ id: ic, x, y })
  }
  return out.sort((a, b) => b.y - a.y || a.x - b.x)
}

const CSS = `
#opening { position: fixed; inset: 0; z-index: 10050; background: #000; overflow: hidden; cursor: pointer; transition: opacity var(--opfade) ease; font-family: 'Gowun Batang', 'Apple SD Gothic Neo', 'Malgun Gothic', serif; }
#opening.out { opacity: 0; pointer-events: none; }
#opening * { box-sizing: border-box; }
#opening .opsc { position: absolute; inset: 0; opacity: 0; transition: opacity var(--opscfade) ease; overflow: hidden; }
#opening .opsc.on { opacity: 1; }
#opening .opimg { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; opacity: 0; transition: opacity var(--opfade) ease; transform: var(--kf); transform-origin: 50% 50%; animation: opkb var(--opdur) linear forwards; will-change: transform; }
#opening .opimg.on { opacity: 1; }
@keyframes opkb { from { transform: var(--kf); } to { transform: var(--kt); } }
#opening .opscrim { position: absolute; left: 0; right: 0; bottom: 0; height: 38%; background: linear-gradient(transparent, #000000d0); pointer-events: none; }
#opening .opcap { position: absolute; left: 0; right: 0; bottom: calc(9% + env(safe-area-inset-bottom)); padding: 0 7vw; text-align: center; color: #f3e6c4; font: 700 clamp(18px, 5.2vw, 30px)/1.5 'Gowun Batang', serif; letter-spacing: .04em; text-shadow: 0 2px 10px #000, 0 0 3px #000; word-break: keep-all; overflow-wrap: anywhere; opacity: 0; animation: opcap .8s ease .5s forwards; }
@keyframes opcap { to { opacity: 1; } }
#opening .opskip { position: absolute; right: 14px; top: calc(12px + env(safe-area-inset-top)); font: 12px/1 'Gowun Dodum', sans-serif; color: #b8ab8f; opacity: .75; pointer-events: none; text-shadow: 0 1px 4px #000; z-index: 3; }
#opening .opshake { animation: opshake .5s linear 1; }
@keyframes opshake { 0% { transform: translate3d(0,0,0); } 20% { transform: translate3d(-1.6%,.8%,0); } 40% { transform: translate3d(1.4%,-.8%,0); } 60% { transform: translate3d(-.8%,.5%,0); } 80% { transform: translate3d(.5%,-.3%,0); } 100% { transform: translate3d(0,0,0); } }
#opening .opjit { animation: opjit .22s linear 1; }
@keyframes opjit { 0% { transform: translate3d(0,0,0); } 30% { transform: translate3d(-.9%,0,0); } 70% { transform: translate3d(.9%,0,0); } 100% { transform: translate3d(0,0,0); } }
#opening .opmapw { position: absolute; inset: 0; transform: var(--kf); transform-origin: 50% 42%; animation: opkb var(--opdur) linear forwards; will-change: transform; }
#opening .opmap { position: absolute; background: #1a2326; }
#opening .opmapbg { position: absolute; inset: 0; background: center / 100% 100% no-repeat; opacity: 0; transition: opacity 1.2s ease; }
#opening .opmapbg.on { opacity: 1; }
#opening .opmapshade { position: absolute; inset: 0; background: radial-gradient(ellipse at 50% 42%, #0a090600 38%, #0a0906b8 100%), #0a090640; pointer-events: none; }
#opening .opmap::before, #opening .opmap::after { content: ''; position: absolute; left: -2%; right: -2%; height: 14%; pointer-events: none; }
#opening .opmap::before { top: -1px; background: linear-gradient(#000, #0000); }
#opening .opmap::after { bottom: -1px; background: linear-gradient(#0000, #000); }
#opening .opfl { position: absolute; z-index: 1; width: var(--flpx); height: var(--flpx); margin: calc(var(--flpx) / -2) 0 0 calc(var(--flpx) / -2); opacity: 0; transform: scale(.3); animation: opflag .9s cubic-bezier(.2,.9,.3,1.2) forwards; animation-delay: var(--fd); }
#opening .opfl::before { content: ''; position: absolute; inset: -12%; border-radius: 50%; background: radial-gradient(circle, #0b0a08ee 58%, #0b0a08a0 78%, #0b0a0800 100%); }
#opening .opfl::after { content: ''; position: absolute; inset: -8%; border-radius: 50%; border: 2px solid #ffe29a; opacity: 0; transform: scale(.6); animation: opglow 1s ease-out forwards; animation-delay: var(--fd); }
#opening .opfl img { position: relative; display: block; width: 100%; height: 100%; z-index: 1; }
@keyframes opflag { 0% { opacity: 0; transform: scale(.3); } 45% { opacity: 1; transform: scale(1.45); } 100% { opacity: 1; transform: scale(1); } }
@keyframes opglow { 0% { opacity: .95; transform: scale(.7); } 100% { opacity: 0; transform: scale(2.3); } }
#opening .opflash { position: absolute; inset: 0; background: #f6e8c4; opacity: 0; pointer-events: none; }
#opening .opflash.go { animation: opflash .45s ease-out 1; }
@keyframes opflash { 0% { opacity: .85; } 100% { opacity: 0; } }
#opening .opvid { animation: none; transform: none; will-change: auto; }
#opening .oplogo { position: absolute; inset: 0; display: grid; place-items: center; background: radial-gradient(ellipse at 50% 45%, #1d1812 0, #0a0907 70%); }
#opening .oplogobox { position: relative; display: inline-block; opacity: 0; transition: opacity 1s ease; }
#opening .oplogobox.on { opacity: 1; }
#opening .oplogobox img { display: block; max-width: min(84vw, 560px); max-height: 46vh; width: auto; height: auto; filter: drop-shadow(0 0 22px #e8b85a40); }
#opening .opsweep { position: absolute; inset: 0; overflow: hidden; -webkit-mask-image: var(--logo); mask-image: var(--logo); -webkit-mask-size: 100% 100%; mask-size: 100% 100%; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; }
#opening .opsweep i { position: absolute; top: 0; bottom: 0; left: 0; width: 45%; background: linear-gradient(100deg, transparent 0, #fff1c8c0 50%, transparent 100%); transform: translate3d(-120%,0,0); }
#opening .opsweep.go i { animation: opsweep var(--sweepms) ease-in-out forwards; }
@keyframes opsweep { to { transform: translate3d(320%,0,0); } }
#opening.paused *, #opening.paused *::before { animation-play-state: paused !important; }
@media (prefers-reduced-motion: reduce) { #opening .opimg { animation: none; transform: none; } #opening .opshake, #opening .opjit { animation: none; } }
`

const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`)
const pulse = (el: Element, cls: string): void => { el.classList.remove(cls); void (el as HTMLElement).offsetWidth; el.classList.add(cls) }

interface Stage {
  readonly el: HTMLElement
  /** 끝내기 (건너뛰기도 같은 길) */
  readonly end: () => void
}

/** 겉틀 — 덮개 하나 · 누르거나 키를 누르면 end · 탭이 숨으면 멈춤 (rAF 가 같이 멈춘다). stop: 끝내기 시작 즉시, onEnd: 걷힌 뒤 */
function makeStage(stop: () => void, onEnd: () => void): Stage {
  document.getElementById('opening')?.remove()
  const el = document.createElement('div')
  el.id = 'opening'
  el.setAttribute('role', 'presentation')
  el.style.setProperty('--opfade', `${P.realm.openingFadeMs}ms`)
  el.style.setProperty('--opscfade', `${P.realm.openingSceneFadeMs}ms`)
  el.innerHTML = `<style>${CSS}</style><div class="opskip">${esc(t('opening.skip'))}</div>`
  document.body.appendChild(el)
  let done = false
  const onVis = (): void => {
    el.classList.toggle('paused', document.hidden)
    el.querySelectorAll('video').forEach((v) => { if (document.hidden) v.pause(); else if (v.dataset['live'] === '1') void v.play().catch(() => {}) })
    el.querySelectorAll('audio').forEach((a) => { if (document.hidden) a.pause() })
  }
  const end = (): void => {
    if (done) return
    done = true
    stop()
    document.removeEventListener('visibilitychange', onVis)
    removeEventListener('keydown', end, true)
    el.querySelectorAll('video').forEach((m) => m.pause())
    el.classList.add('out')
    window.setTimeout(() => { el.remove(); onEnd() }, P.realm.openingFadeMs + 60)
  }
  document.addEventListener('visibilitychange', onVis)
  el.addEventListener('pointerdown', end)
  addEventListener('keydown', end, true)
  return { el, end }
}

/** 숨 쉬는 영상(없으면 각성 그림) 한 칸 — 영상이 안 불러와지면 그림으로 */
function awakenBox(base: string, id: string, cls: string): HTMLElement {
  const box = document.createElement('div')
  box.className = cls
  const still = `${base}realm/awaken-hd/${id}.jpg`
  const asImg = (): void => { box.innerHTML = `<img src="${still}" alt="" style="width:100%;height:100%;object-fit:cover">` }
  if (AWAKEN_LOOP.has(id)) {
    const v = document.createElement('video')
    v.muted = true; v.loop = true; v.playsInline = true; v.preload = 'auto'
    v.poster = still
    v.src = `${base}realm/${loopFile(id)}`
    v.style.cssText = 'width:100%;height:100%;object-fit:cover'
    v.addEventListener('error', () => { v.remove(); asImg() })
    box.appendChild(v)
  } else asImg()
  return box
}

/** 삼한과 북녘 판의 바탕 — 오프닝을 틀 때 미리 짓기 시작한다(이미 지은 적이 있으면 바로). 3번 장면이 이것을 깐다 */
let worldBgUrl = ''
/** 지도 바탕을 깔고 서서히 드러낸다 (아직 못 받았으면 어두운 바다 위에 깃발이 먼저 선다) */
function showWorldBg(host: ParentNode): void {
  host.querySelectorAll<HTMLElement>('.opmapbg').forEach((b) => {
    b.style.backgroundImage = `url('${worldBgUrl}')`
    requestAnimationFrame(() => b.classList.add('on'))
  })
}
/** 장면 하나를 짓는다 */
function buildScene(base: string, sc: Scene, n: number, dur: number): HTMLElement {
  const root = document.createElement('div')
  root.className = 'opsc'
  const [kf, kt] = MOTION[sc.motion]
  root.style.setProperty('--kf', kf)
  root.style.setProperty('--kt', kt)
  root.style.setProperty('--opdur', `${dur + 1}s`)
  if (n === 0) root.style.setProperty('--opscfade', `${P.realm.openingFirstFadeMs}ms`)
  const cap = `<div class="opscrim"></div><div class="opcap">${esc(t(`opening.${n + 1}` as Key))}</div>`
  if (sc.extra === 'awaken') {
    AWAKEN_PICK.forEach((id) => root.appendChild(awakenBox(base, id, 'opimg opvid')))
    root.insertAdjacentHTML('beforeend', `<div class="opflash"></div>${cap}`)
    return root
  }
  if (sc.extra === 'logo') {
    const src = `${base}realm/logo/${lang() === 'en' ? 'title-en' : 'title'}.png`
    root.innerHTML = `<div class="oplogo"><div class="oplogobox"><img src="${src}" alt="${esc(t('boot.logoAlt'))}"><div class="opsweep" style="--logo:url('${src}');--sweepms:${P.realm.openingSweepMs}ms"><i></i></div></div></div><div class="opcap">${esc(t('opening.8'))}</div>`
    return root
  }
  if (sc.extra === 'flags') {
    // 실제 삼한과 북녘 판의 땅 위에 나라 깃발이 남에서 북으로 물결처럼 켜진다 — 자리는 도읍의 경위도
    const spots = flagSpots()
    const x0 = Math.min(...spots.map((p) => p.x)), x1 = Math.max(...spots.map((p) => p.x))
    const y0 = Math.min(...spots.map((p) => p.y)), y1 = Math.max(...spots.map((p) => p.y))
    const vw = window.innerWidth, vh = window.innerHeight
    const w = Math.min((vw * 0.9) / (x1 - x0), (vh * 0.76) / ((y1 - y0) * WORLD_ASPECT))
    const h = w * WORLD_ASPECT
    const left = vw / 2 - ((x0 + x1) / 2) * w
    const top = vh * 0.44 - ((y0 + y1) / 2) * h
    const pts = spreadOut(spots.map((p) => [p.x * w, p.y * h] as const), P.realm.openingFlagPx * 0.92)
    const span = dur * P.realm.openingFlagSpan
    const waves = P.realm.openingFlagWaves
    const flags = spots.map((p0, i) => {
      const p = { id: p0.id, x: pts[i]![0] / w, y: pts[i]![1] / h }
      const wave = Math.floor((i * waves) / spots.length)
      const at = 0.5 + (wave * span) / waves + ((i % 4) * 0.05)
      return `<i class="opfl" style="left:${(p.x * 100).toFixed(2)}%;top:${(p.y * 100).toFixed(2)}%;--fd:${at.toFixed(2)}s"><img src="${base}realm/icon/${p.id}.png" alt=""></i>`
    }).join('')
    root.innerHTML = `<div class="opmapw"><div class="opmap" style="left:${left.toFixed(1)}px;top:${top.toFixed(1)}px;width:${w.toFixed(1)}px;height:${h.toFixed(1)}px;--flpx:${P.realm.openingFlagPx}px"><i class="opmapbg"></i>${flags}</div></div><div class="opmapshade"></div>${cap}`
    if (worldBgUrl !== '') showWorldBg(root)
    return root
  }
  root.innerHTML = sc.imgs.map((p) => `<img class="opimg" src="${base}realm/${p}" alt="" decoding="async">`).join('') + cap
  return root
}

/** 앱이 건네는 것 — muted: 소리 끔 설정 · hush: 오프닝이 도는 동안 판 음악을 끈다(true) / 되돌린다(false) */
export interface OpeningHooks { readonly muted?: () => boolean; readonly hush?: (on: boolean) => void }
const clamp01 = (n: number): number => Math.max(0, Math.min(1, n))

/**
 * 오프닝을 튼다. 숨은 탭이면 안 튼다(false). 첫 번이든 다시 보기든 같다.
 * onDone: 끝났거나 건너뛰었을 때
 */
export function playOpening(base: string, onDone?: () => void, hooks?: OpeningHooks): boolean {
  if (document.hidden) return false
  markSeen()
  hooks?.hush?.(true)
  const secs = P.realm.openingSceneSec
  const starts: number[] = []
  secs.reduce((a, s, i) => { starts[i] = a; return a + s }, 0)
  const total = secs.reduce((a, s) => a + s, 0)
  let raf = 0
  let audio: HTMLAudioElement | null = null
  const silent = (): boolean => hooks?.muted?.() === true
  // 깔리는 음악 — 소리 끔이거나 배경음 슬라이더가 0 이면 안 튼다
  let bed: HTMLAudioElement | null = null
  if (!silent() && soundVolume('bgm') > 0) {
    bed = new Audio(`${base}realm/sfx/${sndFile('bgm_title', 'g1')}`)
    bed.volume = 0
    void bed.play().catch(() => { /* 손을 대기 전이면 조용히 */ })
  }
  const onHide = (): void => {
    if (document.hidden) { bed?.pause(); audio?.pause() } else if (bed !== null && !bed.ended) void bed.play().catch(() => {})
  }
  document.addEventListener('visibilitychange', onHide)
  const stage = makeStage(() => {
    cancelAnimationFrame(raf)
    audio?.pause()
    document.removeEventListener('visibilitychange', onHide)
    const b = bed
    if (b !== null) { // 건너뛰어도 뚝 끊지 않고 덮개가 걷히는 동안 잦아든다
      const v0 = b.volume
      let n = 0
      const iv = window.setInterval(() => { n++; b.volume = clamp01(v0 * (1 - n / 10)); if (n >= 10) { window.clearInterval(iv); b.pause() } }, 50)
    }
  }, () => { hooks?.hush?.(false); onDone?.() })
  void worldMapReady(`${base}realm/`, 'spring', 'world').then((u) => {
    worldBgUrl = u
    if (u !== '') showWorldBg(stage.el)
  })
  // 그림은 미리 받아 둔다 (첫 장면이 늦으면 시계가 그만큼 늦게 시작한다)
  const pre = SCENES.flatMap((s) => s.imgs).map((p) => { const im = new Image(); im.src = `${base}realm/${p}`; return im })
  const first = pre[0]!
  let cur = -1
  let sceneEl: HTMLElement | null = null
  let fired = new Set<string>()
  const showImg = (i: number): void => { sceneEl?.querySelectorAll('.opimg').forEach((im, k) => im.classList.toggle('on', k === i)) }
  const enter = (i: number): void => {
    const old = sceneEl
    cur = i
    fired = new Set()
    sceneEl = buildScene(base, SCENES[i]!, i, secs[i]!)
    stage.el.insertBefore(sceneEl, stage.el.querySelector('.opskip'))
    const mine = sceneEl
    requestAnimationFrame(() => { mine.classList.add('on'); showImg(0) })
    if (old !== null) { old.classList.remove('on'); window.setTimeout(() => old.remove(), P.realm.openingSceneFadeMs + 80) }
    // 내레이션 — 파일이 있으면 깔고 없으면 조용히
    audio?.pause()
    audio = null
    const vol = soundVolume('voice')
    if (vol > 0 && !silent()) {
      const a = new Audio(`${base}realm/voice/opening/${String(i + 1).padStart(2, '0')}.ogg`)
      a.volume = vol
      void a.play().catch(() => { /* 아직 녹음 전 */ })
      audio = a
    }
  }
  let last = 0
  let clock = 0
  let duck = 1
  const tick = (now: number): void => {
    const dt = last === 0 ? 0 : Math.min(0.25, (now - last) / 1000) // 숨었다 돌아와도 한 번에 건너뛰지 않는다
    last = now
    clock += dt
    if (clock >= total) { stage.end(); return }
    if (bed !== null) {
      // 음악 크기 = 처음 낮게 → 6번 장면부터 크게 · 첫 어둠에서 서서히 · 끝에서 잦아듦 · 내레이션이 나오면 낮춤
      const swellAt = starts[P.realm.openingSwellScene] ?? total
      const level = P.realm.openingBedVol + (P.realm.openingSwellVol - P.realm.openingBedVol) * clamp01((clock - swellAt) / P.realm.openingSwellSec)
      const edge = Math.min(clamp01(clock / (P.realm.openingFirstFadeMs / 1000)), clamp01((total - clock) / P.realm.openingEndFadeSec))
      const talking = audio !== null && !audio.paused && !audio.ended
      duck += ((talking ? P.realm.openingDuck : 1) - duck) * Math.min(1, dt * P.realm.openingDuckPerSec)
      bed.volume = clamp01(level * edge * duck * soundVolume('bgm'))
    }
    let i = starts.findIndex((s, k) => clock >= s && clock < s + secs[k]!)
    if (i < 0) i = SCENES.length - 1
    if (i !== cur) enter(i)
    const sl = clock - starts[i]!
    const sc = SCENES[i]!
    const el = sceneEl
    if (el !== null) {
      const once = (k: string, at: number, f: () => void): void => { if (sl >= at && !fired.has(k)) { fired.add(k); f() } }
      if (sc.imgs.length > 1) showImg(Math.min(sc.imgs.length - 1, Math.floor((sl / secs[i]!) * sc.imgs.length)))
      if (sc.extra === 'shake') once('s', P.realm.openingShakeAt, () => pulse(el, 'opshake'))
      if (sc.extra === 'jitter') P.realm.openingJitterAt.forEach((at, k) => once(`j${k}`, at, () => pulse(el, 'opjit')))
      if (sc.extra === 'awaken') {
        const boxes = [...el.querySelectorAll<HTMLElement>('.opimg')]
        const k = Math.min(boxes.length - 1, Math.floor((sl / secs[i]!) * boxes.length))
        once(`v${k}`, 0, () => {
          boxes.forEach((b, bi) => {
            b.classList.toggle('on', bi === k)
            const v = b.querySelector('video')
            if (v === null) return
            v.dataset['live'] = bi === k ? '1' : '0'
            if (bi === k) { v.currentTime = 0; void v.play().catch(() => {}) } else v.pause()
          })
          const fl = el.querySelector('.opflash')
          if (fl) pulse(fl, 'go')
        })
      }
      if (sc.extra === 'logo') {
        once('on', 0.2, () => el.querySelector('.oplogobox')?.classList.add('on'))
        once('sw', P.realm.openingSweepAt, () => el.querySelector('.opsweep')?.classList.add('go'))
      }
    }
    raf = requestAnimationFrame(tick)
  }
  // 첫 그림이 오거나 정해 둔 시간이 지나면 시계를 시작
  let started = false
  const go = (): void => { if (started) return; started = true; raf = requestAnimationFrame(tick) }
  if (first.complete) go()
  else { first.addEventListener('load', go); first.addEventListener('error', go); window.setTimeout(go, P.realm.openingFirstWaitMs) }
  return true
}

/** 장 id → 끝맺음에 띄울 장 주인공 초상 id (각성 그림이 있는 장수). 없는 장은 장 그림 */
const END_HERO: Readonly<Record<string, string>> = {
  brothers: 'g-71-baekje-onjo', mahan: 'g-71-baekje-onjo', seorabeol: 'g-74-saro-hyeokgeose', jumong: 'g-64-jumong',
  gujibong: 'g-96-garak-suro', daemusin: 'g-95-goguryeo-daemusin',
}

/**
 * 장을 이긴 뒤 「끝맺음 보기」 — 장 주인공(각성 영상, 없으면 각성 그림, 없으면 장 그림) + 끝 글 한 줄 → 크레딧 두루마리.
 * 자동으로 틀지 않는다(이긴 화면은 그대로). 주인공 장면에서 누르면 바로 크레딧으로, 크레딧 도중에 누르면 끝.
 */
export function playEnding(base: string, chapterId: string, onDone?: () => void): boolean {
  if (document.hidden) return false
  const ch = CHAPTERS.find((c) => c.id === chapterId)
  const hero = END_HERO[chapterId]
  let timer = 0
  const stage = makeStage(() => window.clearTimeout(timer), () => { void openCreditsRoll(base, onDone) })
  const box = document.createElement('div')
  box.className = 'opsc on'
  box.style.setProperty('--kf', MOTION.in[0])
  box.style.setProperty('--kt', MOTION.in[1])
  box.style.setProperty('--opdur', `${P.realm.endingHeroMs / 1000 + 1}s`)
  const still = hero !== undefined && AWAKEN_ART.has(hero) ? `${base}realm/awaken-hd/${hero}.jpg` : `${base}realm/${ch?.art ?? 'keyart/world.jpg'}`
  box.innerHTML = `<div class="opimg on"></div><div class="opscrim"></div><div class="opcap" style="animation-delay:.3s">${esc(t(`ending.line.${chapterId}` as Key))}</div>`
  const holder = box.querySelector<HTMLElement>('.opimg')!
  if (hero !== undefined && AWAKEN_LOOP.has(hero)) {
    holder.classList.add('opvid')
    const inner = awakenBox(base, hero, '')
    inner.style.cssText = 'width:100%;height:100%'
    const v = inner.querySelector('video')
    if (v !== null) { v.autoplay = true; v.dataset['live'] = '1' }
    holder.appendChild(inner)
  } else holder.innerHTML = `<img src="${still}" alt="" style="width:100%;height:100%;object-fit:cover">`
  stage.el.insertBefore(box, stage.el.querySelector('.opskip'))
  timer = window.setTimeout(stage.end, P.realm.endingHeroMs)
  return true
}
