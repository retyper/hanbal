/**
 * 그래픽 단계: 저사양(low) · 보통(mid) · 고사양(high).
 *
 * 왜 (형 10-29): "갑자기 오늘 앱 그래픽이 엄청 깨졌던 이유. 핸드폰 절전 모드와 초절전 모드가 강화돼서 그려야 할 것들을 웹에서 못 그렸던 거야."
 * 절전 모드의 폰 크롬은 프레임을 30장으로 묶고 그래픽 칩을 덜 쓴다. 그 상태에서 filter(drop-shadow · blur · 밝기) · 화면 섞기(mix-blend-mode) ·
 * 끝없이 도는 꾸밈 움직임이 겹치면 층이 그래픽 한도를 넘어 그림이 통째로 빠지거나 깨진다 (메모리 mobile-gpu-layer-limit).
 * 그래서 앱 뿌리(.ap)에 q-low · q-mid · q-high 를 달고, 단계마다 무거운 것을 끈다.
 *
 *  - 고사양: 지금 그대로.
 *  - 보통: 화면 섞기 · 뒤 흐림(backdrop-filter) 끔 · filter 의 blur 를 빼고 drop-shadow 는 첫 겹만 · 입자(불티 · 눈 · 금박 …) 반.
 *  - 저사양: filter · 화면 섞기 · 뒤 흐림 · will-change 모두 끔 (흐리게 · 잿빛으로 보이던 것은 opacity 로 바꿔 뜻은 남김) ·
 *    큰 그림자는 얕게 · 끝없이 도는 꾸밈 움직임은 그 자리에 멈춘 한 장 (지도 · 서 있는 병사 · 깃발 · 빛 · 불길) ·
 *    입자 넷에 하나 · 계절 입자 없음. 싸움의 한 번짜리 움직임(공격 · 맞음 · 숫자 · 판정 · 막대 줄기)은 그대로.
 *
 * 끝없는 움직임만 골라 멈추는 법: CSS 는 「infinite 인 것」을 고를 수 없어, 켤 때 한 번 스타일시트를 읽어
 * 움직임을 단 규칙마다 쌍둥이 규칙을 만든다: `:where(.ap.q-low) :is(원래 선택자) { animation-play-state: running, paused }`.
 * :where 라 세기가 원래와 같고 뒤에 오니, 원래 규칙만 이기고 더 센 규칙에는 진다 (덮는 차례가 원래와 같다).
 *
 * 자동 (기본): 폰은 보통 · 마우스 쓰는 컴퓨터는 고사양에서 시작. 지도가 처음 뜬 뒤 · 첫 싸움 · 탭에 다시 돌아왔을 때 프레임을 2초 잰다.
 * 가운데값이 28ms 를 넘거나(절전 모드의 30장) 긴 프레임이 많으면 한 단계 내린다. 배터리가 20% 아래이고 충전 중이 아니어도 내린다.
 * 기기 메모리 4GB 이하는 보통까지만. 자동은 내리기만 하고, 바꾼 뒤 1분 안엔 다시 안 바꾼다 (오르내림 막기). 저사양이 되면 한 줄 알림.
 * 움직임 줄이기(prefers-reduced-motion)를 켠 기기는 단계와 상관없이 꾸밈 움직임만 멈춘다 (q-calm).
 *
 * 배터리 (절대 규칙 4 · 고사양에서도): 아무것도 안 누른 채 45초가 지나면 꾸밈 움직임을 멈춘다 (q-rest · 싸움 중엔 안 멈춤).
 * 누르면 바로 다시 돈다. 숨은 탭에선 재기도 타이머도 돌지 않는다.
 *
 * 손으로: 더 보기 · 나라 탭의 「그래픽: 자동 / 저사양 / 보통 / 고사양」 (localStorage hanbal.realm.gfx) · 시험엔 주소 ?gfx=low|mid|high.
 */
import { P } from '../../tune/params.ts'

export type Tier = 'low' | 'mid' | 'high'
export type GfxPref = 'auto' | Tier

const ORDER: readonly Tier[] = ['low', 'mid', 'high']
export const TIER_NAME: Readonly<Record<Tier, string>> = { low: '저사양', mid: '보통', high: '고사양' }
const PREF_KEY = 'hanbal.realm.gfx'
/** 자동이 마지막으로 정한 단계와 그때 (다음에 켤 때 P.realm.gfxRememberH 시간 동안 그 아래로 시작) */
const AUTO_KEY = 'hanbal.realm.gfx.auto'
/** 저사양에서도 멈추지 않는 끝없는 움직임: 긴 이름을 흘려 보여 주는 글 (fit.ts marquee) */
const KEEP_RUNNING: ReadonlySet<string> = new Set(['mqgo'])
/** 쌍둥이 규칙을 만들지 않는 규칙: 이 파일이 쓴 것 */
const OWN = /\.q-(low|mid|high|rest|calm)\b/

let tier: Tier = 'high'
let pref: GfxPref = 'auto'
let host: HTMLElement | null = null
let lastStep = Number.NEGATIVE_INFINITY
let say: (html: string) => void = () => {}

/** 지금 그래픽 단계 */
export const quality = (): Tier => tier
/** 고른 것 (자동이면 'auto') */
export const gfxPref = (): GfxPref => pref

const isTier = (v: unknown): v is Tier => v === 'low' || v === 'mid' || v === 'high'
const lower = (a: Tier, b: Tier): Tier => (ORDER.indexOf(a) <= ORDER.indexOf(b) ? a : b)
const mq = (q: string): boolean => { try { return matchMedia(q).matches } catch { return false } }

// ───────── 글 다루기 (순수 · tests/realm/quality.test.ts)

/** 맨 바깥 쉼표로 나눈다: 괄호 · 대괄호 안의 쉼표는 그대로 */
export function splitTop(s: string, sep = ','): string[] {
  const out: string[] = []
  let d = 0
  let st = 0
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (c === '(' || c === '[') d++
    else if (c === ')' || c === ']') d--
    else if (d === 0 && (sep === ' ' ? /\s/.test(c!) : c === sep)) { out.push(s.slice(st, i).trim()); st = i + 1 }
  }
  out.push(s.slice(st).trim())
  return out.filter((x) => x !== '')
}

/** 선택자 하나 → 단계 아래에서만 걸리는 같은 세기의 쌍둥이 (끝의 ::before 같은 것은 :is 밖으로) */
export function twinSel(prefix: string, sel: string): string | null {
  const m = /(::[\w-]+(?:\([^)]*\))?|:(?:before|after|first-line|first-letter))$/i.exec(sel)
  const base = m === null ? sel : sel.slice(0, m.index)
  if (base.trim() === '') return null
  return `:where(${prefix}) :is(${base})${m === null ? '' : m[1]}`
}

/** 움직임 목록마다 멈출지: 끝없는 것(infinite)만 멈춘다 · 목록이 짧으면 되풀이 (CSS 규칙과 같게) */
export function playStates(names: string, iters: string): string | null {
  const ns = splitTop(names)
  const its = splitTop(iters)
  if (ns.length === 0 || its.length === 0 || (ns.length === 1 && ns[0] === 'none')) return null
  return ns.map((n, i) => (!KEEP_RUNNING.has(n) && its[i % its.length] === 'infinite' ? 'paused' : 'running')).join(', ')
}

const KW: ReadonlySet<string> = new Set(['linear', 'ease', 'ease-in', 'ease-out', 'ease-in-out', 'step-start', 'step-end', 'infinite', 'normal', 'reverse', 'alternate', 'alternate-reverse', 'none', 'forwards', 'backwards', 'both', 'running', 'paused'])

/** 줄임 꼴(animation: …)을 그대로 읽는다: var() 가 든 줄임은 낱 속성(animation-name …)이 비어 읽혀서 (병사 그림 · 깃발 연출이 다 이 꼴) */
export function shorthandStates(a: string): string | null {
  const items = splitTop(a)
  if (items.length === 0 || (items.length === 1 && items[0] === 'none')) return null
  return items.map((it) => {
    const ts = splitTop(it, ' ')
    const name = ts.find((t) => /^-?[a-zA-Z_][\w-]*$/.test(t) && !KW.has(t))
    return ts.includes('infinite') && !(name !== undefined && KEEP_RUNNING.has(name)) ? 'paused' : 'running'
  }).join(', ')
}

/** filter 를 뺄 때 남길 흐림: 어둡게 · 잿빛 · 바램은 opacity 로 (검은 그림자 실루엣은 아주 흐리게) · 바꿀 것 없으면 null */
export function dimOf(filter: string): number | null {
  let o = 1
  let any = false
  for (const m of filter.matchAll(/(brightness|grayscale|saturate|opacity)\(\s*([\d.]+)(%?)\s*\)/g)) {
    let v = Number(m[2])
    if (m[3] === '%') v /= 100
    if (!Number.isFinite(v)) continue
    if (m[1] === 'brightness') {
      if (v === 0) return 0.15 // 모르는 장수 · 유물의 검은 그림자 (gfxsafe 와 같은 값)
      if (v < 1) { o *= v; any = true }
    } else if (m[1] === 'grayscale') { o *= 1 - 0.4 * Math.min(1, v); any = true }
    else if (m[1] === 'saturate') { if (v < 1) { o *= 1 - 0.2 * (1 - v); any = true } }
    else { o *= v; any = true }
  }
  if (!any || o > 0.9) return null
  return Math.max(0.12, Math.round(o * 100) / 100)
}

/** 보통: blur 를 빼고 drop-shadow 는 첫 겹만 · 바꿀 것 없으면 null */
export function midFilter(filter: string): string | null {
  const fns = splitTop(filter, ' ')
  const ds = fns.filter((f) => f.startsWith('drop-shadow(')).length
  if (!fns.some((f) => f.startsWith('blur(')) && ds < 2) return null
  let seen = 0
  const keep = fns.filter((f) => !f.startsWith('blur(') && (!f.startsWith('drop-shadow(') || seen++ === 0))
  return keep.length > 0 ? keep.join(' ') : 'none'
}

/** 저사양: 그림자는 두 겹까지 · 번짐 6px · 퍼짐 2px 까지 · 바꿀 것 없으면 null */
export function flatShadow(v: string): string | null {
  if (v === '' || v === 'none' || v.includes('var(')) return null
  const layers = splitTop(v)
  let changed = layers.length > 2
  const out = layers.slice(0, 2).map((L) => {
    let n = 0
    return splitTop(L, ' ').map((t) => {
      const m = /^(-?[\d.]+)(px)?$/.exec(t)
      if (m === null) return t
      n++
      const x = Number(m[1])
      if (n === 3 && x > 6) { changed = true; return '6px' }
      if (n === 4 && x > 2) { changed = true; return '2px' }
      return t
    }).join(' ')
  })
  return changed ? out.join(', ') : null
}

/** 잰 프레임 사이 시간(ms)들 → 버거운가: 가운데값이 길거나 긴 프레임이 많다 */
export function slowFrames(ds: readonly number[]): boolean {
  if (ds.length < 3) return false
  const s = [...ds].sort((a, b) => a - b)
  const med = s[s.length >> 1]!
  const long = ds.filter((d) => d > P.realm.gfxLongFrameMs).length / ds.length
  return med > P.realm.gfxSlowFrameMs || long > P.realm.gfxLongShare
}

/** 아주 부드럽다: 가운데값이 짧고 긴 프레임이 거의 없다 · 내렸던 단계를 올려 봐도 된다 */
export function smoothFrames(ds: readonly number[]): boolean {
  if (ds.length < 3) return false
  const s = [...ds].sort((a, b) => a - b)
  const long = ds.filter((d) => d > P.realm.gfxLongFrameMs).length / ds.length
  return s[s.length >> 1]! <= P.realm.gfxSmoothFrameMs && long < 0.03
}

// ───────── 쌍둥이 규칙

/** 움직이는 것 · 거르개 · 그림자를 단 규칙마다 단계 아래 쌍둥이를 만든다 */
function twinsOf(rules: CSSRuleList, out: string[]): void {
  for (const r of Array.from(rules)) {
    if (r instanceof CSSStyleRule) {
      if (OWN.test(r.selectorText)) continue
      const st = r.style
      const sels = splitTop(r.selectorText)
      const twin = (prefix: string, body: string): void => {
        const ts = sels.map((s) => twinSel(prefix, s)).filter((s): s is string => s !== null)
        if (ts.length > 0) out.push(`${ts.join(', ')} { ${body} }`)
      }
      const imp = (p: string): string => (st.getPropertyPriority(p) === 'important' ? ' !important' : '')
      // 1) 끝없는 움직임 멈춤 (저사양 · 움직임 줄이기 · 가만히 둔 때) · 다 도는 규칙도 쌍둥이를 둬야 덮는 차례가 원래와 같다
      const ps = st.animationName !== '' && st.animationIterationCount !== '' ? playStates(st.animationName, st.animationIterationCount) : shorthandStates(st.getPropertyValue('animation'))
      if (ps !== null) twin('.ap:is(.q-low, .q-calm, .q-rest)', `animation-play-state: ${ps}${imp('animation-play-state')};`)
      // 2) 저사양: filter 는 아래 통째 규칙이 끈다 · 흐림 · 잿빛은 opacity 로 남긴다
      const f = st.filter
      if (f !== '' && f !== 'none') {
        const d = dimOf(f)
        if (d !== null) {
          const o0 = st.opacity !== '' && Number.isFinite(Number(st.opacity)) ? Number(st.opacity) : 1
          twin('.ap.q-low', `opacity: ${Math.max(0.12, Math.round(d * o0 * 100) / 100)};`)
        }
        // 3) 보통: blur 빼고 drop-shadow 한 겹
        const m = midFilter(f)
        if (m !== null) twin('.ap.q-mid', `filter: ${m}${imp('filter')};`)
      }
      // 4) 저사양: 큰 그림자는 얕게
      const sh = flatShadow(st.boxShadow)
      if (sh !== null) twin('.ap.q-low', `box-shadow: ${sh}${imp('box-shadow')};`)
    } else if (!(r instanceof CSSKeyframesRule) && 'cssRules' in r) {
      // @media · @supports · @container — 같은 조건으로 감싼다
      const inner: string[] = []
      twinsOf((r as CSSGroupingRule).cssRules, inner)
      if (inner.length > 0) out.push(`${r.cssText.slice(0, r.cssText.indexOf('{')).trim()} {\n${inner.join('\n')}\n}`)
    }
  }
}

function buildTwins(): string {
  const out: string[] = []
  for (const sh of Array.from(document.styleSheets)) {
    if (!(sh.ownerNode instanceof HTMLStyleElement)) continue
    try { twinsOf(sh.cssRules, out) } catch { /* 다른 곳의 시트는 못 읽는다 */ }
  }
  return out.join('\n')
}

// ───────── 단계 정하기

function readPref(): GfxPref {
  try {
    const q = new URLSearchParams(location.search).get('gfx')
    if (isTier(q) || q === 'auto') return q
  } catch { /* 주소를 못 읽으면 저장한 것 */ }
  try {
    const v = localStorage.getItem(PREF_KEY)
    if (isTier(v)) return v
  } catch { /* 저장이 막힌 곳은 자동 */ }
  return 'auto'
}

/** 자동의 출발점: 폰은 보통 · 마우스 컴퓨터는 고사양 · 메모리 적은 기기는 그 아래 · 얼마 전 자동이 내렸으면 거기서 */
/** 기기만 보고 정한 위끝: 폰 보통 · 마우스 컴퓨터 고사양 · 메모리 적으면 그 아래 */
function deviceTier(): Tier {
  let t: Tier = mq('(pointer: fine)') && mq('(hover: hover)') ? 'high' : 'mid'
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory
  if (typeof mem === 'number' && mem > 0) {
    if (mem <= P.realm.gfxMemLow) t = 'low'
    else if (mem <= P.realm.gfxMemMid) t = lower(t, 'mid')
  }
  return t
}

function baseTier(): Tier {
  let t: Tier = deviceTier()
  try {
    const a = JSON.parse(localStorage.getItem(AUTO_KEY) ?? 'null') as { t?: unknown; at?: unknown } | null
    if (a !== null && isTier(a.t) && typeof a.at === 'number' && Date.now() - a.at < P.realm.gfxRememberH * 3600_000) t = lower(t, a.t)
  } catch { /* 깨진 기록은 버린다 */ }
  return t
}

function apply(): void {
  if (host === null) return
  for (const t of ORDER) host.classList.toggle(`q-${t}`, t === tier)
}

/** 자동이 한 단계 내린다: 1분에 한 번까지 · 저사양이 되면 한 줄 알림 */
function stepDown(why: 'frames' | 'battery'): void {
  if (pref !== 'auto' || tier === 'low') return
  const now = performance.now()
  if (now - lastStep < P.realm.gfxStepGapS * 1000) return
  lastStep = now
  tier = ORDER[ORDER.indexOf(tier) - 1]!
  apply()
  try { localStorage.setItem(AUTO_KEY, JSON.stringify({ t: tier, at: Date.now() })) } catch { /* 이번 판만 */ }
  // 절전 모드를 켰는지는 알 수 없다 · 본 것만 말한다 (형 10-30: "절전 상태 풀었는데 왜 절전 상태로 바꿨다고 뜨지?")
  if (tier === 'low') say(why === 'battery' ? '배터리가 적어 그래픽을 가볍게 바꿨습니다' : '화면이 버벅여 그래픽을 가볍게 바꿨습니다 · 나라 탭에서 바꿀 수 있습니다')
}

/** 자동이 한 단계 올린다: 내린 뒤 gfxUpAfterS 가 지났고 지도가 아주 부드러울 때 · 출발점(baseTier 의 기기 몫)보다 위로는 안 간다 */
function stepUp(): void {
  if (pref !== 'auto' || tier === 'high') return
  const now = performance.now()
  if (now - lastStep < P.realm.gfxUpAfterS * 1000) return
  const cap = deviceTier()
  if (ORDER.indexOf(tier) >= ORDER.indexOf(cap)) return
  lastStep = now
  tier = ORDER[ORDER.indexOf(tier) + 1]!
  apply()
  try { localStorage.setItem(AUTO_KEY, JSON.stringify({ t: tier, at: Date.now() })) } catch { /* 이번 판만 */ }
}

/** 손으로 고른다 (설정 단추) · 자동으로 돌리면 출발점부터 다시 잰다 */
export function setGfxPref(v: string | undefined): void {
  const p: GfxPref = isTier(v) ? v : 'auto'
  pref = p
  try { if (p === 'auto') localStorage.removeItem(PREF_KEY); else localStorage.setItem(PREF_KEY, p) } catch { /* 이번 판만 */ }
  if (p === 'auto') {
    try { localStorage.removeItem(AUTO_KEY) } catch { /* 그대로 */ }
    tier = baseTier()
    lastStep = Number.NEGATIVE_INFINITY
    later(probe)
  } else tier = p
  apply()
}

// ───────── 재기 (보이는 탭에서만 · 2초)

let probing = false
function probe(): void {
  if (pref !== 'auto' || probing || document.visibilityState !== 'visible') return
  // 싸움 화면은 재지 않는다 · 첫 장면이 일부러 무거워 멀쩡한 폰도 버벅임으로 잡혔다 (형 10-30)
  if (host?.querySelector('.wr, .wfield') !== null) return
  probing = true
  const ds: number[] = []
  let t0 = -1
  let last = -1
  const f = (t: number): void => {
    if (document.visibilityState !== 'visible') { probing = false; return } // 숨으면 그만 · 다시 보일 때 새로 잰다
    if (t0 < 0) t0 = t
    else ds.push(t - last)
    last = t
    if (t - t0 < P.realm.gfxProbeMs) { requestAnimationFrame(f); return }
    probing = false
    if (slowFrames(ds)) stepDown('frames')
    else if (smoothFrames(ds) && (battery === null || battery.charging || battery.level >= P.realm.gfxBatteryLow)) stepUp()
  }
  requestAnimationFrame(f)
}

/** 화면이 뜬 뒤 조금 있다가 (그림 풀기의 덜컥임은 빼고) · 한 번만 도는 타이머 */
function later(fn: () => void): void {
  if (document.visibilityState === 'visible') setTimeout(fn, P.realm.gfxProbeDelayMs)
}

/** 첫 지도 · 첫 싸움이 뜨면 잰다 · 둘 다 쟀으면 그만 본다 */
function watchFirst(root: HTMLElement): void {
  let map = false
  const mo = new MutationObserver(() => {
    if (!map && root.querySelector('.map') !== null) { map = true; later(probe) }
    if (map) mo.disconnect()
  })
  mo.observe(root, { childList: true, subtree: true })
}

interface Battery extends EventTarget { readonly charging: boolean; readonly level: number }
let battery: Battery | null = null
function checkBattery(): void {
  if (battery !== null && !battery.charging && battery.level < P.realm.gfxBatteryLow) stepDown('battery')
}

// ───────── 가만히 둔 때 쉬기 (배터리 · 모든 단계)

let lastInput = 0
let restTimer = 0
function armRest(): void {
  if (restTimer !== 0 || document.visibilityState !== 'visible') return
  const wait = Math.max(1000, P.realm.gfxRestS * 1000 - (performance.now() - lastInput))
  restTimer = window.setTimeout(() => {
    restTimer = 0
    if (host === null || document.visibilityState !== 'visible') return
    if (performance.now() - lastInput < P.realm.gfxRestS * 1000 - 50) { armRest(); return }
    // 싸움은 지켜보는 동안 손을 안 대도 돌아야 한다
    if (host.classList.contains('war-open') || host.querySelector('.wr, .wfield') !== null) { lastInput = performance.now(); armRest(); return }
    host.classList.add('q-rest')
  }, wait)
}
function wake(): void {
  lastInput = performance.now()
  host?.classList.remove('q-rest')
  armRest()
}

export function startQuality(root: HTMLElement, toast: (html: string) => void): void {
  host = root
  say = toast
  pref = readPref()
  tier = pref === 'auto' ? baseTier() : pref
  apply()
  const calm = (): void => { root.classList.toggle('q-calm', mq('(prefers-reduced-motion: reduce)')) }
  calm()
  try { matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', calm) } catch { /* 옛 브라우저 */ }
  const own = document.createElement('style')
  own.dataset['gfx'] = 'twins'
  document.head.appendChild(own)
  own.textContent = buildTwins()
  watchFirst(root)
  const nav = navigator as Navigator & { getBattery?: () => Promise<Battery> }
  nav.getBattery?.().then((b) => {
    battery = b
    checkBattery()
    b.addEventListener('levelchange', checkBattery)
    b.addEventListener('chargingchange', checkBattery)
  }).catch(() => { /* 배터리를 못 물어보는 곳 */ })
  // 다시 보이면: 그사이 절전 모드가 켜졌을 수 있다 · 1분 안에 바꿨으면 재지 않는다
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') { window.clearTimeout(restTimer); restTimer = 0; return }
    wake()
    if (performance.now() - lastStep >= P.realm.gfxStepGapS * 1000) { checkBattery(); later(probe) }
  })
  for (const ev of ['pointerdown', 'pointermove', 'keydown', 'wheel']) window.addEventListener(ev, wake, { passive: true, capture: true })
  wake()
}

/** 설정 한 줄: 그래픽 자동 / 저사양 / 보통 / 고사양 */
export function gfxRowHtml(): string {
  const b = (v: GfxPref, w: string): string => `<button class="${pref === v ? 'on' : ''}" data-act="gfx" data-v="${v}">${w}</button>`
  return `<div class="gfxq"><b>그래픽</b><span class="seg sm">${b('auto', '자동')}${b('low', TIER_NAME.low)}${b('mid', TIER_NAME.mid)}${b('high', TIER_NAME.high)}</span>`
    + `${pref === 'auto' ? `<small class="mute">지금 ${TIER_NAME[tier]}</small>` : ''}</div>`
}

/** 입자 묶음: 저사양 넷에 하나 · 보통 반 */
const SPARKS = '.wember, .wcspark, .wcline, .cere .bmote i, .cere .cmote i, .cere .cpet i, .cere .cspk i, .cere.invade .emb, .winfx .wf-rain s, .winfx .wf-burst b'
/** 연출 조각: 저사양 반 · 보통 그대로 (깃발 연출 · 화살 비 · 먼지) */
const PIECES = '.wfx-cmd > i, .wf-arw > i, .cere .iarw, .tbdu'

export const QUALITY_CSS = `
/* 그래픽 단계 (quality.ts · 형 10-29: 폰 절전 모드에서 그림이 다 깨졌다) */
.ap.q-low *, .ap.q-low *::before, .ap.q-low *::after { filter: none !important; -webkit-backdrop-filter: none !important; backdrop-filter: none !important; mix-blend-mode: normal !important; will-change: auto !important; }
.ap.q-low .seasonp { display: none; }
.ap.q-low :is(${SPARKS}):not(:nth-of-type(4n+1)) { display: none; }
.ap.q-low :is(${PIECES}):nth-of-type(2n) { display: none; }
.ap.q-mid *, .ap.q-mid *::before, .ap.q-mid *::after { -webkit-backdrop-filter: none !important; backdrop-filter: none !important; mix-blend-mode: normal !important; }
.ap.q-mid .seasonp i:nth-child(2n) { display: none; }
.ap.q-mid :is(${SPARKS}):nth-of-type(2n) { display: none; }
/* 가만히 둔 때: 계절 입자는 멈춘 채 떠 있지 않게 걷는다 */
.ap.q-rest .seasonp { opacity: 0; transition: opacity 1.2s; }
/* 설정 한 줄 */
.ap .gfxq { display: flex; align-items: center; flex-wrap: wrap; gap: 6px 10px; margin: 10px 0 4px; }
.ap .gfxq > b { color: var(--gold); font-size: 14px; }
.ap .gfxq .seg { flex: 1 1 220px; min-width: 0; } .ap .gfxq .seg button { white-space: nowrap; padding: 6px 2px; }
.ap .gfxq > small { flex-basis: 100%; }
`
