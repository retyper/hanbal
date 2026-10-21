/**
 * 설명 말풍선 — 폰에서도 보이게 (형: "모바일에선 터치하자마자 중요한 설명 나올것들은 설명 나오고
 * 디테일 필요한것들은 누르고 있으면 조금있다 나오고").
 *
 * 폰엔 마우스를 올리는 일이 없어서 `title` 이 안 보인다. 그래서 한 곳(.ap 뿌리)에서 받는다:
 *   - **누르면 바로** — 눌러도 아무 일 없는 것(특성 칩·칭호·지도 그림·기분 얼굴…)의 `data-tip`/`title`
 *   - **누르고 있으면 조금 뒤** — 무엇이든(단추·고을 포함) `data-more` 가 있으면 그것을, 없으면 `data-tip`/`title`.
 *     길게 누른 뒤의 떼기는 누르기로 치지 않는다 (단추가 눌리지 않는다)
 * 짧은 말은 `data-tip`(없으면 `title`), 긴 말은 `data-more`. 컴퓨터에선 `title` 이 그대로 마우스에 뜬다.
 */
import { P } from '../../tune/params.ts'

/** 눌러서 일이 일어나는 것 — 이런 데선 누르기는 그 일, 설명은 길게 눌러야 */
const ACTS = 'button, a, input, select, label, [data-act], .nd'
const TIPS = '[data-more], [data-tip], [title]'
/** 이만큼 움직이면 끄는 것(스크롤)으로 보고 길게 누르기를 접는다 (CSS px) */
const SLOP = 10

const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

function shortOf(el: HTMLElement): string {
  return el.dataset['tip'] ?? el.getAttribute('title') ?? ''
}

export function installTips(root: HTMLElement): void {
  const bub = document.createElement('div')
  bub.className = 'tipb'
  bub.setAttribute('role', 'tooltip')
  root.appendChild(bub)
  let hideAt = 0
  let hideTimer = 0
  let hold: { el: HTMLElement; x: number; y: number; timer: number } | null = null
  /** 길게 눌러 말풍선을 띄웠다 — 이어지는 click 하나를 삼킨다 */
  let swallow = false

  const hide = (): void => {
    bub.classList.remove('on')
    window.clearTimeout(hideTimer)
  }

  const show = (el: HTMLElement, html: string, long: boolean): void => {
    if (html === '') return
    if (!bub.isConnected) root.appendChild(bub)
    bub.innerHTML = html
    bub.classList.add('on')
    bub.classList.toggle('long', long)
    const r = el.getBoundingClientRect()
    const vw = window.innerWidth
    const bw = bub.offsetWidth
    const bh = bub.offsetHeight
    const left = Math.max(12, Math.min(vw - bw - 12, r.left + r.width / 2 - bw / 2))
    const above = r.top - bh - 8
    bub.style.left = `${left}px`
    bub.style.top = `${above >= 8 ? above : r.bottom + 8}px`
    hideAt = performance.now()
    window.clearTimeout(hideTimer)
    hideTimer = window.setTimeout(hide, long ? P.realm.tipLong : P.realm.tipShort)
  }

  const cancelHold = (): void => {
    if (hold !== null) window.clearTimeout(hold.timer)
    hold = null
  }

  root.addEventListener('pointerdown', (ev) => {
    if (!bub.contains(ev.target as Node)) hide()
    cancelHold()
    swallow = false // 길게 누른 뒤 click 이 안 온 폰 — 다음 누르기를 삼키지 않게
    if (ev.pointerType === 'mouse' && ev.button !== 0) return
    const el = (ev.target as HTMLElement).closest<HTMLElement>(TIPS)
    if (el === null || !root.contains(el) || el === bub) return
    const timer = window.setTimeout(() => {
      if (hold === null) return
      const more = el.dataset['more']
      const short = shortOf(el)
      const html = more !== undefined ? `${short !== '' ? `<b>${esc(short)}</b>` : ''}<span>${esc(more)}</span>` : esc(short)
      if (html === '') return
      swallow = el.closest(ACTS) !== null
      show(el, html, true)
      hold = null
      navigator.vibrate?.(8)
    }, P.realm.tipHold)
    hold = { el, x: ev.clientX, y: ev.clientY, timer }
  })
  root.addEventListener('pointermove', (ev) => {
    if (hold !== null && Math.hypot(ev.clientX - hold.x, ev.clientY - hold.y) > SLOP) cancelHold()
  })
  root.addEventListener('pointerup', cancelHold)
  root.addEventListener('pointercancel', cancelHold)
  // 길게 누르면 폰이 띄우는 메뉴(복사·저장) — 설명을 띄운 자리에선 막는다
  root.addEventListener('contextmenu', (ev) => {
    if ((ev.target as HTMLElement).closest(TIPS) !== null) ev.preventDefault()
  })

  // 누르기 — 길게 누른 뒤면 삼키고, 눌러도 일이 없는 것이면 짧은 말을 바로
  root.addEventListener('click', (ev) => {
    if (swallow) {
      swallow = false
      ev.stopImmediatePropagation()
      ev.preventDefault()
      return
    }
    const el = (ev.target as HTMLElement).closest<HTMLElement>(TIPS)
    if (el === null || !root.contains(el) || el === bub) return
    if (el.closest(ACTS) !== null) return // 단추는 단추 일을 한다 — 설명은 길게 눌러서
    if (bub.classList.contains('on') && performance.now() - hideAt < P.realm.tipHold * 2) return // 막 길게 눌러 띄운 것
    show(el, esc(shortOf(el)), false)
  }, true)
  // 굴리면 말풍선은 제자리에 남지 않는다
  root.addEventListener('scroll', hide, true)
}

export const TIP_CSS = `
.ap .tipb { position: fixed; z-index: 90; max-width: min(300px, calc(100vw - 24px)); padding: 8px 11px; border-radius: 11px;
  background: #1c1a16f2; border: 1px solid #8a7444; color: #f1e6cc; font-size: 13.5px; line-height: 1.45; text-align: left;
  box-shadow: 0 6px 22px #000a; pointer-events: none; opacity: 0; transform: translateY(4px); transition: opacity .12s, transform .12s; visibility: hidden; }
.ap .tipb.on { opacity: 1; transform: none; visibility: visible; }
.ap .tipb b { display: block; color: var(--gold); margin-bottom: 3px; } .ap .tipb span { display: block; }
.ap [data-tip], .ap [data-more], .ap [title] { -webkit-touch-callout: none; }
.ap .trait, .ap .ttl, .ap [data-tip]:not(button) { cursor: help; }
`
