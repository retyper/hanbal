/**
 * 시작 화면 「아무 키나 누르세요」 (Codex 59-A · 형 11-21: "게임에 포장이 부족 · 시작할 때 아무 키나 누르세요 이런 게 없다 · 인디는 기대감을 줄 만한 걸 많이")
 *
 * 스플래시가 걷히면 로비 앞에 한 장이 선다: 키 아트(아주 느리게 다가갔다 물러난다 · 불티 낱알이 하나씩 오른다) · 위 가운데 로고 ·
 * 아래 「아무 키나 누르세요」(손가락이 주 입력인 기기는 「화면을 누르세요」 · 숨 쉬듯 옅어졌다 짙어진다).
 * 누르면 북 한 번 · 로고가 번쩍 커지고 1초 안에 걷히며 로비가 드러난다. 음악은 이 첫 누름부터 (브라우저는 누르기 전엔 소리를 막는다 · sound.ts).
 * 같은 접속(sessionStorage)에서 다시 오면 건너뛴다. 숨은 탭에선 그리지도 영상도 돌지 않는다 (규칙 4).
 *
 * 그림 자리: public/realm/title/start-16x9.{mp4,jpg} · start-9x16.{mp4,jpg} — 있는 것만 빌드가 적어 준다 (vite.config.ts __START_ART__).
 * 영상이 있으면 소리 없이 되풀이 (저사양 단계 · 움직임 줄이기 · 데이터 아끼기는 정지 그림) · 없으면 정지 그림 · 그것도 없으면 START_FALLBACK.
 * 그림과 불티는 캔버스 하나에 그린다 — 화면 가득한 칸에 filter 애니·큰 transform 을 걸면 폰이 못 그린다 (메모리 mobile-gpu-layer-limit).
 * 손맛 숫자는 P.realm.start* (tune/params.ts).
 */
import { t } from '../../i18n/index.ts'
import { lang } from '../../i18n/lang.ts'
import { P } from '../../tune/params.ts'
import { quality } from './quality.ts'

/** 이번 접속에서 이미 눌러 지나왔다 */
const SEEN_KEY = 'hanbal.realm.started'
/** public/realm/title/ 에 실제로 있는 시작 화면 그림·영상 (시험의 node 에는 없다) */
const HAVE: readonly string[] = typeof __START_ART__ !== 'undefined' ? __START_ART__ : []
/**
 * 새 키 아트(59-B)가 오기 전 바탕 — 로비 그림(산마루에서 내려다본 땅 · 가운데를 로고 자리로 비워 그렸다).
 * 옛 첫 화면 title-keyart.jpg 는 쓰지 않는다: 하늘에 해 동그라미와 햇살이 있고(메모리 no-japanese-sun-disc), 궁수가 시위를 당긴 채이며(형 11-21),
 * 900px 라 PC 에서 뭉개진다. 바꾸려면 이 이름만.
 */
export const START_FALLBACK = 'title-lobby.jpg'

export interface StartPick {
  /** 소리 없이 되풀이할 영상 — 없으면 null */
  readonly video: string | null
  /** 정지 그림 (영상이 있으면 그 앞에 깔리는 첫 장 · 영상이 막히면 이것) */
  readonly still: string
}

/**
 * 고를 그림 — 화면 방향과 같은 꼴 먼저. 세로 화면엔 가로 그림도 된다(옆으로 천천히 흐른다) · 가로 화면에 세로 그림은 가운데 한 토막만 남아 쓰지 않는다.
 * `video` 가 거짓이면 (저사양 · 움직임 줄이기 · 데이터 아끼기) 정지 그림만
 */
export function pickStartArt(have: readonly string[], portrait: boolean, video: boolean): StartPick {
  const shapes = portrait ? ['9x16', '16x9'] : ['16x9']
  const v = video ? shapes.map((s) => `start-${s}.mp4`).find((f) => have.includes(f)) ?? null : null
  // 영상과 같은 꼴의 정지 그림을 먼저 — 영상이 뜨기 전 · 막혔을 때 같은 장면이 깔린다
  const first = v !== null ? [v.replace(/\.mp4$/, '.jpg')] : []
  const still = [...first, ...shapes.map((s) => `start-${s}.jpg`)].find((f) => have.includes(f)) ?? START_FALLBACK
  return { video: v, still }
}

const seen = (): boolean => { try { return sessionStorage.getItem(SEEN_KEY) === '1' } catch { return false } }

/** 자동 시험 브라우저 — 헤드리스 크롬(시험 도구들이 CDP 로 띄운다)이나 webdriver */
const automated = (): boolean => typeof navigator !== 'undefined' && (navigator.webdriver === true || /HeadlessChrome/.test(navigator.userAgent ?? ''))

/**
 * 시작 화면을 띄울 때인가 — 이번 접속에 이미 눌렀거나 · 크레딧 주소(?credits=1)거나 · 자동 시험 브라우저면 건너뛴다
 * (시험 도구 phone-shot · layout-check · store-shots … 가 찍는 판을 가리지 않게). ?start=1 이면 늘 띄우고 · ?start=0 이면 늘 건너뛴다
 */
export function wantStartGate(search: string): boolean {
  const q = new URLSearchParams(search)
  if (q.get('start') === '1') return true
  if (q.get('start') === '0' || q.get('credits') === '1') return false
  if (automated()) return false
  return !seen()
}

/** 스플래시가 띄우는 동안 미리 받아 둘 정지 그림 (로비 그림이면 스플래시가 이미 받는다) — 띄우지 않을 접속이면 null */
export function startPreload(base: string): string | null {
  if (!wantStartGate(location.search)) return null
  const still = pickStartArt(HAVE, innerHeight > innerWidth, false).still
  return still === START_FALLBACK ? null : `${base}realm/title/${still}`
}

const mq = (q: string): boolean => { try { return matchMedia(q).matches } catch { return false } }
const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`)

/** 손가락이 주 입력인가 (폰 · 태블릿) — 터치 화면 노트북은 마우스가 주 입력이라 키 글. 개발 서버에선 ?touch=1|0 으로 고른다(폰 폭 사진) */
function touchFirst(): boolean {
  if (import.meta.env?.DEV === true) {
    const q = new URLSearchParams(location.search).get('touch')
    if (q === '1' || q === '0') return q === '1'
  }
  return mq('(pointer: coarse)')
}

const CSS = `
#kstart { position: fixed; inset: 0; z-index: 9000; overflow: hidden; cursor: pointer; background: #0b0d10 none 50% 42% / cover no-repeat;
  transition: opacity var(--ks-fade) ease-in-out; -webkit-tap-highlight-color: transparent; -webkit-user-select: none; user-select: none; touch-action: none; }
.front.title.ks-replay .kv, .front.title.ks-replay .kv::before, .front.title.ks-replay .tv { animation: none !important; }
#kstart.ks-out { opacity: 0; }
#kstart.ks-go { cursor: default; }
#kstart .ks-vid, #kstart .ks-cv { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
#kstart .ks-vid { object-fit: cover; }
#kstart .ks-top { position: absolute; left: 0; right: 0; top: calc(7vh + env(safe-area-inset-top)); display: flex; justify-content: center; pointer-events: none; }
#kstart .ks-lw { position: relative; width: min(82vw, 620px, 86vh); }
#kstart .ks-logo, #kstart .ks-ghost { display: block; width: 100%; height: auto; }
#kstart .ks-logo { opacity: 0; transform: translateY(14px) scale(.97); filter: drop-shadow(0 6px 18px #000c);
  transition: opacity 1.3s ease .25s, transform 1.8s cubic-bezier(.2, .7, .2, 1) .25s; }
#kstart.ks-on .ks-logo { opacity: 1; transform: none; }
#kstart.ks-go .ks-logo { opacity: 1; transform: scale(1.06); transition: transform .28s cubic-bezier(.2, 1.5, .4, 1), opacity .2s ease; }
#kstart .ks-ghost { position: absolute; left: 0; top: 0; opacity: 0; mix-blend-mode: screen; mix-blend-mode: plus-lighter; }
#kstart.ks-go .ks-ghost { animation: ks-ghost var(--ks-flash) cubic-bezier(.1, .6, .3, 1) forwards; }
@keyframes ks-ghost { 0% { opacity: .95; transform: scale(1.02); } 100% { opacity: 0; transform: scale(1.3); } }
#kstart.ks-low .ks-logo { filter: none; }
#kstart.ks-low .ks-ghost { mix-blend-mode: normal; }
#kstart .ks-press { position: absolute; left: 0; right: 0; bottom: calc(10vh + env(safe-area-inset-bottom)); margin: 0; display: flex; justify-content: center; align-items: center; gap: 14px;
  pointer-events: none; opacity: 0; transition: opacity 1s ease 1.2s; }
#kstart.ks-on .ks-press { opacity: 1; }
#kstart.ks-go .ks-press { opacity: 0; transition: opacity .18s ease; }
#kstart .ks-press::before, #kstart .ks-press::after { content: ''; width: clamp(18px, 6vw, 48px); height: 1px; background: #e2c17a88; }
#kstart .ks-press span { font: 700 clamp(17px, 12px + 1.2vw, 24px)/1.4 'Gowun Batang', serif; letter-spacing: .22em; padding-left: .22em; color: #fff3d6; white-space: nowrap;
  text-shadow: 0 0 4px #000, 0 2px 4px #000, 0 0 16px #000, 0 0 22px #e0a24a55; animation: ks-breathe var(--ks-breathe) ease-in-out infinite alternate; }
@keyframes ks-breathe { from { opacity: .5; } to { opacity: 1; } }
@media (prefers-reduced-motion: reduce) {
  #kstart .ks-press span { animation: none; }
  #kstart .ks-logo, #kstart.ks-go .ks-logo { transform: none; transition: opacity .6s ease; }
  #kstart.ks-go .ks-ghost { animation: none; }
}
`

/** 불티 하나 — 화면 아래에서 태어나 흔들리며 오르다 사그라든다 */
interface Ember { x: number; y: number; vy: number; sway: number; fq: number; ph: number; tw: number; size: number; life: number; age: number; hot: boolean }

/** 둥근 빛 한 장 — 불티·번쩍임은 이것을 낱낱이 찍는다 (한 장을 통째로 움직이지 않는다 · 메모리 effects-individual-particles) */
function glowSprite(px: number, stops: ReadonlyArray<readonly [number, string]>): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = c.height = px
  const g = c.getContext('2d')
  if (g === null) return c
  const gr = g.createRadialGradient(px / 2, px / 2, 0, px / 2, px / 2, px / 2)
  for (const [at, col] of stops) gr.addColorStop(at, col)
  g.fillStyle = gr
  g.fillRect(0, 0, px, px)
  return c
}

/**
 * 가장자리·아래·위를 어둡게 한 장 — 크기가 바뀔 때만 다시 굽는다. 부드러운 linear-gradient 는 갤럭시 크롬이 줄무늬로 깨뜨려(메모리 mobile-gpu-layer-limit)
 * 둥근 빛(radial)만 늘려 쓴다
 */
function vignette(w: number, h: number, dpr: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(w * dpr))
  c.height = Math.max(1, Math.round(h * dpr))
  const g = c.getContext('2d')
  if (g === null) return c
  g.scale(dpr, dpr)
  const m = Math.max(w, h)
  // 온 화면을 조금 · 가장자리를 많이 — 낮 그림도 밤 불티가 보이게 가라앉힌다
  g.fillStyle = 'rgba(8,9,12,0.14)'
  g.fillRect(0, 0, w, h)
  const edge = g.createRadialGradient(w / 2, h * 0.45, m * 0.2, w / 2, h * 0.45, m * 0.75)
  edge.addColorStop(0, 'rgba(11,13,16,0)')
  edge.addColorStop(1, 'rgba(11,13,16,0.72)')
  g.fillStyle = edge
  g.fillRect(0, 0, w, h)
  // 타원 빛 — 반지름 1 짜리를 늘려 찍는다
  const oval = (cx: number, cy: number, rx: number, ry: number, a: number): void => {
    g.save()
    g.translate(cx, cy)
    g.scale(rx, ry)
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, 1)
    gr.addColorStop(0, `rgba(8,9,12,${a})`)
    gr.addColorStop(0.55, `rgba(8,9,12,${(a * 0.45).toFixed(3)})`)
    gr.addColorStop(1, 'rgba(8,9,12,0)')
    g.fillStyle = gr
    g.fillRect(-1, -1, 2, 2)
    g.restore()
  }
  oval(w / 2, h, Math.max(w * 1.1, h * 0.6), h * 0.42, 0.9) // 아래 — 「아무 키나 누르세요」가 읽히게
  oval(w / 2, 0, Math.max(w * 0.9, h * 0.5), h * 0.3, 0.45) // 위 — 로고 뒤
  return c
}

export interface StartGateKit {
  /** import.meta.env.BASE_URL */
  readonly base: string
  /** 로비가 그려진 뿌리(#realm) — 시작 화면이 떠 있는 동안 가려 두고, 걷힐 때 로비의 첫 등장 움직임을 처음부터 다시 튼다 */
  readonly root: HTMLElement
  /** 누를 때 소리 (소리 끄기·효과음 크기는 부르는 쪽이) */
  readonly ding: () => void
  /** 그 소리를 미리 받아 둔다 — 처음 한 번이 늦게 나지 않게 */
  readonly warm: () => void
}

export interface StartGate {
  /** 스플래시가 걷히기 시작했다 — 이제부터 움직이고 누름을 받는다 */
  arm(): void
}

/** 시작 화면을 연다 — 띄울 때가 아니면(wantStartGate) null */
export function openStartGate(kit: StartGateKit): StartGate | null {
  if (!wantStartGate(location.search)) return null
  const R = P.realm
  const tier = quality()
  const reduced = mq('(prefers-reduced-motion: reduce)')
  const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true
  const allowVideo = tier !== 'low' && !reduced && !saveData
  const url = (name: string): string => `${kit.base}realm/title/${name}`
  const logoSrc = `${kit.base}realm/logo/${lang() === 'en' ? 'title-en' : 'title'}.png`
  const prompt = t(touchFirst() ? 'start.pressTap' : 'start.pressKey')

  const el = document.createElement('div')
  el.id = 'kstart'
  if (tier === 'low') el.classList.add('ks-low')
  el.setAttribute('role', 'button')
  el.setAttribute('aria-label', prompt)
  el.style.setProperty('--ks-fade', `${R.startFadeMs}ms`)
  el.style.setProperty('--ks-flash', `${R.startFlashMs}ms`)
  el.style.setProperty('--ks-breathe', `${R.startBreatheMs}ms`)
  el.style.backgroundPositionY = `${Math.round(R.startFocusY * 100)}%`
  el.innerHTML = `<style>${CSS}</style><canvas class="ks-cv" aria-hidden="true"></canvas>`
    + `<div class="ks-top"><div class="ks-lw"><img class="ks-logo" src="${logoSrc}" alt="${esc(t('boot.logoAlt'))}" draggable="false"><img class="ks-ghost" src="${logoSrc}" alt="" aria-hidden="true" draggable="false"></div></div>`
    + `<p class="ks-press"><span>${esc(prompt)}</span></p>`
  document.body.appendChild(el)
  // 로비는 시작 화면 밑에서 그려진 채 숨어 있다 — 가려진 채 도는 움직임을 그리지 않게 · 걷힐 때 처음부터 다시 튼다
  kit.root.style.visibility = 'hidden'
  kit.warm()

  const cv = el.querySelector<HTMLCanvasElement>('.ks-cv')!
  const lw = el.querySelector<HTMLElement>('.ks-lw')!
  const g = cv.getContext('2d')
  const hot = glowSprite(32, [[0, 'rgba(255,248,222,1)'], [0.16, 'rgba(255,236,190,1)'], [0.34, 'rgba(255,170,72,0.55)'], [1, 'rgba(255,96,24,0)']])
  const warmEmber = glowSprite(32, [[0, 'rgba(255,214,150,1)'], [0.16, 'rgba(255,190,110,1)'], [0.34, 'rgba(255,112,40,0.5)'], [1, 'rgba(230,60,16,0)']])
  const bloom = glowSprite(128, [[0, 'rgba(255,244,214,1)'], [0.3, 'rgba(255,206,120,0.6)'], [1, 'rgba(255,150,60,0)'] ])

  let W = 0
  let H = 0
  let dpr = 1
  let vig: HTMLCanvasElement | null = null
  const embers: Ember[] = []

  const spawn = (e: Ember, scatter: boolean): void => {
    const near = Math.random() ** 2 // 대부분 멀고 작다 · 가끔 가깝고 크고 빠르다
    e.size = R.startEmberPx * (0.5 + near * 1.1)
    e.vy = R.startEmberRise * (0.55 + near * 0.9 + Math.random() * 0.25)
    e.sway = R.startEmberSway * (0.4 + Math.random() * 0.8)
    e.fq = 0.12 + Math.random() * 0.35
    e.ph = Math.random() * Math.PI * 2
    e.tw = 2.5 + Math.random() * 5
    e.hot = Math.random() < 0.35
    e.x = Math.random() * W
    e.life = (H * (0.35 + Math.random() * 0.75)) / e.vy
    e.age = scatter ? Math.random() * e.life : 0
    e.y = H + e.size - e.vy * e.age
  }
  const emberCount = (): number => {
    if (reduced) return 0
    const share = tier === 'low' ? 0.25 : tier === 'mid' ? 0.5 : 1
    return Math.round(R.startEmbers * share * Math.min(1.5, Math.max(0.5, Math.sqrt((W * H) / (1280 * 720)))))
  }

  // ───────── 그림 · 영상
  let pick = pickStartArt(HAVE, innerHeight > innerWidth, allowVideo)
  let img: HTMLImageElement | null = null
  /** 그림이 다 받아진 때 — 늦게 온 그림은 이때부터 스르르 */
  let imgAt = -1
  let video: HTMLVideoElement | null = null

  const loadStill = (name: string): void => {
    const i = new Image()
    i.decoding = 'async'
    i.onload = () => { if (img === i) { imgAt = performance.now(); paintIfIdle() } }
    i.src = url(name)
    img = i
    imgAt = -1
    el.style.backgroundImage = `url("${url(name)}")` // 캔버스가 못 그리는 곳 · 그리기 전에도 같은 자리에 같은 그림
  }
  const dropVideo = (): void => {
    if (video === null) return
    video.pause()
    video.removeAttribute('src')
    video.load() // 영상 풀이를 놓아 준다
    video.remove()
    video = null
    paintIfIdle()
  }
  const playVideo = (): void => {
    const v = video
    if (v === null || document.visibilityState !== 'visible' || !armed) return
    // 저전력 모드 아이폰 등은 소리 없는 영상도 막는다 — 그러면 정지 그림으로 (다른 까닭으로 끊긴 것은 그대로 둔다)
    void v.play().catch((e: unknown) => { if (e instanceof DOMException && (e.name === 'NotAllowedError' || e.name === 'NotSupportedError')) dropVideo() })
  }
  const mountVideo = (name: string, poster: string): void => {
    const v = document.createElement('video')
    v.className = 'ks-vid'
    v.muted = true
    v.defaultMuted = true
    v.loop = true
    v.playsInline = true
    v.preload = 'auto'
    for (const a of ['muted', 'playsinline', 'disablepictureinpicture', 'disableremoteplayback']) v.setAttribute(a, '')
    v.setAttribute('aria-hidden', 'true')
    v.poster = url(poster)
    v.addEventListener('error', dropVideo, { once: true })
    v.src = url(name)
    el.insertBefore(v, cv)
    video = v
    playVideo()
  }
  const usePick = (p: StartPick): void => {
    pick = p
    dropVideo()
    loadStill(p.still)
    if (p.video !== null) mountVideo(p.video, p.still)
  }

  // ───────── 그리기
  let raf = 0
  let lastDraw = -1
  /** 느린 확대의 시계(초) — 그린 동안만 흐른다 (숨었다 돌아와도 튀지 않게) */
  let kbT = 0
  let armed = false
  let armedAt = 0
  let going = false
  let goAt = -1
  let alive = true
  let resting = false
  let lastAct = performance.now()
  let logoBox: DOMRect | null = null

  const fit = (): void => {
    const cap = tier === 'low' ? 1 : tier === 'mid' ? Math.min(1.5, R.startMaxDpr) : R.startMaxDpr
    dpr = Math.min(window.devicePixelRatio || 1, cap)
    W = window.innerWidth
    H = window.innerHeight
    cv.width = Math.max(1, Math.round(W * dpr))
    cv.height = Math.max(1, Math.round(H * dpr))
    vig = vignette(W, H, dpr)
    const n = emberCount()
    while (embers.length > n) embers.pop()
    for (const e of embers) if (e.x > W + 20) e.x = Math.random() * W
    while (embers.length < n) {
      const e: Ember = { x: 0, y: 0, vy: 1, sway: 0, fq: 0, ph: 0, tw: 0, size: 1, life: 1, age: 0, hot: false }
      spawn(e, true)
      embers.push(e)
    }
  }

  const drawStill = (i: HTMLImageElement, now: number, boost: number): void => {
    const iw = i.naturalWidth
    const ih = i.naturalHeight
    if (iw === 0 || ih === 0 || g === null) return
    const k = 2 * Math.PI * kbT / R.startKbSec
    const z = 1 + (reduced ? 0 : R.startKbZoom * (1 - Math.cos(k)) / 2) + boost
    const s = Math.max(W / iw, H / ih) * z
    const dw = iw * s
    const dh = ih * s
    // 옆으로 흐르기는 확대와 다른 박자로 (황금비) — 같은 자리를 되풀이하지 않게
    const fx = 0.5 + 0.5 * (reduced ? 0 : R.startKbPan * Math.sin(k / 1.618))
    g.globalAlpha = imgAt < 0 ? 0 : Math.min(1, (now - imgAt) / 400)
    g.drawImage(i, (W - dw) * fx, (H - dh) * R.startFocusY, dw, dh)
    g.globalAlpha = 1
  }

  const draw = (now: number, dt: number): void => {
    if (g === null) return
    kbT += dt
    g.setTransform(dpr, 0, 0, dpr, 0, 0)
    g.globalCompositeOperation = 'source-over'
    g.clearRect(0, 0, W, H)
    const exitP = going && goAt >= 0 ? Math.min(1, (now - goAt) / (R.startExitDelayMs + R.startFadeMs)) : 0
    if (video === null && img !== null) {
      g.imageSmoothingEnabled = true
      g.imageSmoothingQuality = tier === 'low' ? 'medium' : 'high'
      drawStill(img, now, R.startExitZoom * exitP * exitP)
    }
    if (vig !== null) g.drawImage(vig, 0, 0, W, H)
    g.globalCompositeOperation = 'lighter'
    const tt = now / 1000
    for (const e of embers) {
      e.age += dt
      e.y -= e.vy * dt
      e.x += R.startWind * dt
      if (e.x < -20) e.x += W + 40
      else if (e.x > W + 20) e.x -= W + 40
      if (e.age >= e.life || e.y < -e.size) { spawn(e, false); continue }
      const a = Math.min(1, e.age / 0.8) * Math.min(1, (e.life - e.age) / (e.life * 0.35)) * (0.72 + 0.28 * Math.sin(tt * e.tw + e.ph))
      if (a <= 0.01) continue
      g.globalAlpha = a
      const sx = e.x + Math.sin(tt * e.fq * 2 * Math.PI + e.ph) * e.sway
      // 오르는 쪽으로 길쭉하게 — 빠르게 오르는 불똥처럼
      const tall = e.size * R.startEmberStretch
      g.drawImage(e.hot ? hot : warmEmber, sx - e.size / 2, e.y - tall / 2, e.size, tall)
    }
    // 누른 순간 — 로고 뒤로 빛이 번쩍 퍼진다
    if (goAt >= 0 && logoBox !== null && !reduced) {
      const p = (now - goAt) / R.startFlashMs
      if (p < 1) {
        const r = logoBox.width * (0.62 + 0.6 * p)
        g.globalAlpha = Math.pow(1 - p, 1.6) * 0.8
        g.save()
        g.translate(logoBox.x + logoBox.width / 2, logoBox.y + logoBox.height / 2)
        g.scale(1, 0.6)
        g.drawImage(bloom, -r, -r, r * 2, r * 2)
        g.restore()
      }
    }
    g.globalAlpha = 1
    g.globalCompositeOperation = 'source-over'
  }

  const frame = (now: number): void => {
    raf = 0
    if (!alive || document.visibilityState !== 'visible') return
    // 한참 아무 움직임이 없으면 멈춘다 (배터리 · quality.ts 의 q-rest 와 같은 뜻) · 마우스가 움직이면 다시
    if (!going && now - lastAct > R.startRestSec * 1000) {
      resting = true
      video?.pause()
      return
    }
    raf = requestAnimationFrame(frame)
    // 평소엔 startFps 장만 · 누른 뒤 걷히는 동안은 화면 빠르기대로
    if (!going && lastDraw >= 0 && now - lastDraw < 1000 / R.startFps - 2) return
    const dt = lastDraw < 0 ? 0 : Math.min(0.1, (now - lastDraw) / 1000)
    lastDraw = now
    draw(now, dt)
  }
  const run = (): void => {
    if (raf !== 0 || !alive || document.visibilityState !== 'visible') return
    if (!armed && !going) return
    // 움직임 줄이기 — 한 장만 그리고 돌리지 않는다
    if (reduced && !going) { draw(performance.now(), 0); return }
    raf = requestAnimationFrame(frame)
  }
  /** 돌지 않는 동안(스플래시 밑 · 쉼 · 움직임 줄이기) 그림이 오거나 크기가 바뀌면 한 장만 */
  const paintIfIdle = (): void => { if (raf === 0 && alive && document.visibilityState === 'visible') draw(performance.now(), 0) }

  // ───────── 누름
  /** 넘어갔으면 true */
  const tryGo = (): boolean => {
    if (!armed || going || !alive) return false
    if (document.getElementById('bootcards') !== null) return false // 부팅 카드가 아직 위에 있다 (그 카드를 넘긴 누름)
    if (performance.now() - armedAt < R.startArmMs) return false
    going = true
    try { sessionStorage.setItem(SEEN_KEY, '1') } catch { /* 못 남기면 다시 열 때 한 번 더 본다 */ }
    kit.ding()
    goAt = performance.now()
    logoBox = lw.getBoundingClientRect()
    el.classList.add('ks-go')
    resting = false
    lastDraw = -1
    if (!reduced) run() // 번쩍임과 다가감 · 움직임 줄이기는 걷히기만
    const lead = reduced ? 0 : R.startExitDelayMs
    window.setTimeout(() => {
      el.classList.add('ks-out')
      kit.root.style.visibility = ''
      replayLobby(kit.root)
    }, lead)
    window.setTimeout(close, lead + R.startFadeMs + 80)
    return true
  }
  const onKey = (e: KeyboardEvent): void => {
    // 조합키(새로 고침 · 창 바꾸기 …)와 기능키(F1~F12) · 누른 채 되풀이는 넘긴다
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return
    if (/^(Shift|Control|Alt|Meta|AltGraph|CapsLock|NumLock|ScrollLock|Fn|FnLock|OS|F\d{1,2})$/.test(e.key)) return
    if (tryGo()) e.preventDefault() // 넘긴 키가 로비에서 또 먹지 않게 (스페이스 · 엔터)
  }
  // 마우스는 누르는 순간 · 손가락은 뗄 때 (브라우저가 소리를 풀어 주는 때가 그렇다)
  const onDown = (e: PointerEvent): void => { if (e.pointerType === 'mouse' && e.button === 0) tryGo() }
  const onUp = (e: PointerEvent): void => { if (e.pointerType !== 'mouse') tryGo() }
  const onMove = (): void => {
    lastAct = performance.now()
    if (resting && alive && !going) { resting = false; lastDraw = -1; playVideo(); run() }
  }
  const onVis = (): void => {
    if (document.visibilityState === 'visible') {
      lastAct = performance.now()
      lastDraw = -1
      resting = false
      playVideo()
      run()
      if (raf === 0) paintIfIdle()
    } else {
      if (raf !== 0) cancelAnimationFrame(raf)
      raf = 0
      video?.pause()
    }
  }
  const onResize = (): void => {
    fit()
    const p = pickStartArt(HAVE, innerHeight > innerWidth, allowVideo)
    if (p.video !== pick.video || p.still !== pick.still) usePick(p)
    paintIfIdle()
  }

  function close(): void {
    if (!alive) return
    alive = false
    if (raf !== 0) cancelAnimationFrame(raf)
    raf = 0
    removeEventListener('keydown', onKey, true)
    removeEventListener('pointermove', onMove, true)
    removeEventListener('resize', onResize)
    document.removeEventListener('visibilitychange', onVis)
    dropVideo()
    el.remove()
    kit.root.style.visibility = ''
  }

  addEventListener('keydown', onKey, true)
  addEventListener('pointermove', onMove, { capture: true, passive: true })
  addEventListener('resize', onResize)
  document.addEventListener('visibilitychange', onVis)
  el.addEventListener('pointerdown', onDown)
  el.addEventListener('pointerup', onUp)
  el.addEventListener('click', tryGo) // 포인터 이벤트가 없는 옛 브라우저
  el.addEventListener('contextmenu', (e) => e.preventDefault())

  fit()
  usePick(pick)

  const arm = (): void => {
    if (armed || !alive) return
    armed = true
    armedAt = performance.now()
    lastAct = armedAt
    el.classList.add('ks-on')
    playVideo()
    run()
  }
  // 스플래시가 없거나 이미 걷히는 중이면 바로
  const sp = document.getElementById('splash')
  if (sp === null || sp.classList.contains('out')) arm()
  else paintIfIdle()
  return { arm }
}

/**
 * 로비의 첫 등장 움직임(그림이 다가오고 · 어둠이 걷히고 · 로고와 단추가 올라온다)을 처음부터 — 가려진 동안 이미 다 돌았다.
 * 움직임을 CSS 로 껐다 켠다: 스크립트(Animation.play)로 되감으면 그 뒤로 animation-play-state 가 안 먹어
 * 그래픽 단계의 멈춤(quality.ts q-low · q-rest)이 로비 그림에 걸리지 않는다
 */
function replayLobby(root: HTMLElement): void {
  const f = root.querySelector<HTMLElement>('.front.title')
  if (f === null) return
  f.classList.add('ks-replay')
  void f.offsetWidth // 꺼진 것을 브라우저가 한 번 셈한 뒤에 되켠다
  f.classList.remove('ks-replay')
}
