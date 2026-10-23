/**
 * 설명 말풍선 — 폰에서도 보이게 (형: "모바일에선 터치하자마자 중요한 설명 나올것들은 설명 나오고
 * 디테일 필요한것들은 누르고 있으면 조금있다 나오고").
 *
 * 폰엔 마우스를 올리는 일이 없어서 `title` 이 안 보인다. 그래서 한 곳(.ap 뿌리)에서 받는다:
 *   - **누르면 바로** — 눌러도 아무 일 없는 것(특성 칩·칭호·지도 그림·기분 얼굴…)의 `data-tip`/`title`
 *   - **누르고 있으면 조금 뒤** — 무엇이든(단추·고을 포함) `data-more` 가 있으면 그것을, 없으면 `data-tip`/`title`.
 *     길게 누른 뒤의 떼기는 누르기로 치지 않는다 (단추가 눌리지 않는다)
 * 짧은 말은 `data-tip`(없으면 `title`), 긴 말은 `data-more`.
 * 컴퓨터에선 **올려 두면 조금 뒤** 같은 말풍선(짧은 말 + 긴 말)이 뜨고, 내리면 거둔다. `title` 은 올릴 때 `data-tip` 으로 옮겨
 * 브라우저 기본 말풍선과 겹쳐 뜨지 않게 한다 (형: "마우스 올렸을 때 나오게 만들었는데 잘 구현한거 맞아?" — 전엔 `data-tip`·`data-more` 가 마우스에 안 떴다).
 *
 * **펼침**(`data-peek` + 안에 숨긴 `.peek`) — 카드처럼 그림만 보이고 설명은 따로 (형: "설명을 카드에 같이 넣지 말고
 * 탭 누르고 있거나 마우스 올려놓거나 하면 손가락 비켜서 옆에 설명이 나오게"). 마우스는 올리면 커서 옆에 따라다니고,
 * 손가락은 길게 누르면 손가락 위쪽에(가리지 않게) 뜬다. 짧게 누르면 카드의 일을 한다.
 */
import { P } from '../../tune/params.ts'

/** 눌러서 일이 일어나는 것 — 이런 데선 누르기는 그 일, 설명은 길게 눌러야 */
const ACTS = 'button, a, input, select, label, [data-act], .nd'
const TIPS = '[data-more], [data-tip], [title], [data-peek]'
const PEEK = '[data-peek]'
/** 펼침 말풍선이 손가락·커서에서 떨어지는 거리 (CSS px) — 엄지가 가리지 않게 */
const PEEK_GAP_TOUCH = 44
const PEEK_GAP_MOUSE = 18
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

  /** 펼침 — 점(손가락·커서) 곁에 띄운다. 손가락이면 위쪽, 커서면 오른쪽(모자라면 반대쪽) */
  let peeking: HTMLElement | null = null
  const placeAt = (x: number, y: number, touch: boolean): void => {
    const vw = window.innerWidth, vh = window.innerHeight
    const bw = bub.offsetWidth, bh = bub.offsetHeight
    let left: number, top: number
    if (touch) {
      left = x - bw / 2
      top = y - bh - PEEK_GAP_TOUCH
      if (top < 8) { top = y - bh / 2; left = x + PEEK_GAP_TOUCH; if (left + bw > vw - 8) left = x - PEEK_GAP_TOUCH - bw }
    } else {
      left = x + PEEK_GAP_MOUSE
      if (left + bw > vw - 8) left = x - PEEK_GAP_MOUSE - bw
      top = y - 24
    }
    bub.style.left = `${Math.max(8, Math.min(vw - bw - 8, left))}px`
    bub.style.top = `${Math.max(8, Math.min(vh - bh - 8, top))}px`
  }
  const peekAt = (el: HTMLElement, x: number, y: number, touch: boolean): void => {
    const html = el.querySelector('.peek')?.innerHTML ?? ''
    if (html === '') return
    if (!bub.isConnected) root.appendChild(bub)
    bub.innerHTML = html
    bub.classList.add('on', 'peekb')
    bub.classList.remove('long')
    placeAt(x, y, touch)
    peeking = el
    hideAt = performance.now()
    window.clearTimeout(hideTimer)
    if (touch) hideTimer = window.setTimeout(hide, P.realm.tipLong)
  }
  const unpeek = (): void => { if (peeking !== null) { peeking = null; hide(); bub.classList.remove('peekb') } }
  // 마우스 — 올리면 펼치고, 움직이면 따라가고, 나가면 거둔다
  root.addEventListener('pointerover', (ev) => {
    if (ev.pointerType !== 'mouse') return
    const el = (ev.target as HTMLElement).closest<HTMLElement>(PEEK)
    if (el === null || !root.contains(el)) return
    if (el !== peeking) peekAt(el, ev.clientX, ev.clientY, false)
  })
  root.addEventListener('pointermove', (ev) => {
    if (ev.pointerType === 'mouse' && peeking !== null) placeAt(ev.clientX, ev.clientY, false)
  })
  root.addEventListener('pointerout', (ev) => {
    if (ev.pointerType !== 'mouse' || peeking === null) return
    const to = ev.relatedTarget as Node | null
    if (to === null || !peeking.contains(to)) unpeek()
  })
  // 마우스 — 설명 달린 것에 올려 두면 조금 뒤 말풍선 (짧은 말 + 긴 말), 벗어나면 거둔다
  let hovering: { el: HTMLElement; timer: number } | null = null
  const unhover = (): void => {
    if (hovering === null) return
    window.clearTimeout(hovering.timer)
    hovering = null
    if (peeking === null) hide()
  }
  root.addEventListener('pointerover', (ev) => {
    if (ev.pointerType !== 'mouse') return
    const el = (ev.target as HTMLElement).closest<HTMLElement>(TIPS)
    if (el === hovering?.el) return
    unhover()
    if (el === null || !root.contains(el) || el === bub || el.matches(PEEK)) return
    const title = el.getAttribute('title')
    if (title !== null) { if (el.dataset['tip'] === undefined) el.dataset['tip'] = title; el.removeAttribute('title') }
    const timer = window.setTimeout(() => {
      const more = el.dataset['more']
      const short = shortOf(el)
      show(el, more !== undefined ? `${short !== '' ? `<b>${esc(short)}</b>` : ''}<span>${esc(more)}</span>` : esc(short), more !== undefined)
      window.clearTimeout(hideTimer) // 올려 둔 동안은 떠 있는다
    }, P.realm.tipHover)
    hovering = { el, timer }
  })
  root.addEventListener('pointerout', (ev) => {
    if (ev.pointerType !== 'mouse' || hovering === null) return
    const to = ev.relatedTarget as Node | null
    if (to === null || !hovering.el.contains(to)) unhover()
  })

  const cancelHold = (): void => {
    if (hold !== null) window.clearTimeout(hold.timer)
    hold = null
  }

  root.addEventListener('pointerdown', (ev) => {
    if (!bub.contains(ev.target as Node)) hide()
    if (ev.pointerType === 'mouse') { if (hovering !== null) window.clearTimeout(hovering.timer); return } // 마우스는 올리기로 본다 — 누르면 단추 일만
    cancelHold()
    swallow = false // 길게 누른 뒤 click 이 안 온 폰 — 다음 누르기를 삼키지 않게
    if (ev.pointerType === 'mouse' && ev.button !== 0) return
    const el = (ev.target as HTMLElement).closest<HTMLElement>(TIPS)
    if (el === null || !root.contains(el) || el === bub) return
    const timer = window.setTimeout(() => {
      if (hold === null) return
      // 펼침 카드 — 손가락 곁에
      if (el.matches(PEEK) && ev.pointerType !== 'mouse') {
        swallow = el.closest(ACTS) !== null
        peekAt(el, hold.x, hold.y, true)
        hold = null
        navigator.vibrate?.(8)
        return
      }
      if (el.matches(PEEK)) { hold = null; return } // 마우스는 올리기로 이미 펼쳤다
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
    if (el.closest(ACTS) !== null || el.matches(PEEK)) return // 단추는 단추 일을 한다 — 설명은 길게 눌러서
    if ((ev as PointerEvent).pointerType === 'mouse') return // 마우스는 이미 올려서 보았다
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
/* 펼침 — 카드의 설명 (숨긴 .peek 의 안을 그대로) */
.ap .peek { display: none; }
.ap .tipb.peekb { max-width: min(340px, calc(100vw - 24px)); padding: 11px 13px; transition: opacity .12s; }
.ap .tipb.peekb small { display: block; font-size: 11.5px; color: #c9b88e; letter-spacing: .06em; }
.ap .tipb.peekb b { font-family: var(--display); font-weight: 400; font-size: 20px; margin: 1px 0 6px; }
.ap .tipb.peekb .ph { display: block; font-family: var(--serif); font-size: 14.5px; line-height: 1.55; color: #f3ead6; margin-bottom: 6px; }
.ap .tipb.peekb .pp { display: block; font-size: 13px; color: #c8bea8; margin-bottom: 8px; }
.ap .tipb.peekb .pm { display: flex; flex-wrap: wrap; gap: 4px; } .ap .tipb.peekb .pm i { font-style: normal; font-size: 11.5px; padding: 1px 8px; border-radius: 9px; border: 1px solid #5a4a2e; color: #d8c79e; }
.ap [data-tip], .ap [data-more], .ap [title] { -webkit-touch-callout: none; }
.ap .trait, .ap .ttl, .ap [data-tip]:not(button) { cursor: help; }
`
