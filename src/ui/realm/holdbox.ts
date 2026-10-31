// 누르고 있는 동안만 뜨는 설명 창 — 전장과 지도가 같이 쓴다 (형 10-28: 하스스톤처럼 · ZAXIS-1031 4단계)
// 꼴은 WAR_CSS 의 .whold 하나. 손가락 위에 뜨고, 위에 자리가 없으면 아래로. 손을 떼면 linger 뒤 걷힌다.

export interface HoldBox {
  show(html: string, x: number, y: number): void
  /** ms 뒤 걷는다 — 기본은 만들 때 준 linger */
  hide(ms?: number): void
  /** 곧바로 걷는다 (끌기가 시작될 때) */
  close(): void
  isOpen(): boolean
}

export function holdBox(parent: HTMLElement, linger: () => number): HoldBox {
  const el = document.createElement('div')
  el.className = 'whold'
  el.hidden = true
  parent.appendChild(el)
  let t = 0
  return {
    show(html, x, y) {
      window.clearTimeout(t)
      el.innerHTML = html
      el.hidden = false
      const w = el.offsetWidth
      const h = el.offsetHeight
      el.style.left = `${Math.round(Math.max(8, Math.min(window.innerWidth - w - 8, x - w / 2)))}px`
      el.style.top = `${Math.round(y - h - 26 >= 8 ? y - h - 26 : Math.min(window.innerHeight - h - 8, y + 30))}px`
    },
    hide(ms = linger()) {
      window.clearTimeout(t)
      t = window.setTimeout(() => { el.hidden = true; el.replaceChildren() }, ms)
    },
    close() { window.clearTimeout(t); el.hidden = true },
    isOpen() { return !el.hidden },
  }
}

export interface LongPress {
  /** 꾹 누름이 방금 떴다 — 이어지는 click 하나를 삼킨다 (한 번 물으면 풀린다) */
  swallow(target: EventTarget | null): boolean
}

/** 터치로 꾹 누르면 onHold(대상, x, y) — 움직이면(끌기·당기기) 곧바로 접는다. 마우스는 대지 않는다 */
export function longPress(
  area: HTMLElement,
  pick: (target: HTMLElement) => HTMLElement | null,
  opt: { holdMs: () => number; slop: () => number; onHold: (el: HTMLElement, x: number, y: number) => boolean; onEnd: () => void },
): LongPress {
  let press: { x: number; y: number; timer: number; held: boolean } | null = null
  let eat = false
  let fingers = 0
  const drop = (): void => { if (press !== null) window.clearTimeout(press.timer); press = null }
  area.addEventListener('pointerdown', (ev) => {
    eat = false // 꾹 누름 뒤 click 이 안 오는 폰도 있다 — 남은 삼킴이 다음 누름을 먹지 않게
    fingers++
    if (ev.pointerType === 'mouse' || fingers > 1) { drop(); return }
    const el = pick(ev.target as HTMLElement)
    if (el === null) return
    const p0 = { x: ev.clientX, y: ev.clientY, held: false, timer: 0 }
    p0.timer = window.setTimeout(() => {
      if (press !== p0 || !opt.onHold(el, p0.x, p0.y)) return
      p0.held = true
      eat = true
      if (typeof navigator.vibrate === 'function') navigator.vibrate(8)
    }, opt.holdMs())
    press = p0
  })
  area.addEventListener('pointermove', (ev) => {
    if (press === null || press.held) return
    if (Math.hypot(ev.clientX - press.x, ev.clientY - press.y) > opt.slop()) drop()
  })
  const end = (): void => {
    fingers = Math.max(0, fingers - 1)
    if (press?.held === true) opt.onEnd()
    drop()
  }
  area.addEventListener('pointerup', end)
  area.addEventListener('pointercancel', end)
  area.addEventListener('contextmenu', (ev) => { if (pick(ev.target as HTMLElement) !== null) ev.preventDefault() })
  // 판 밖을 누른 손은 삼키지 않는다 — 꾹 누름 뒤 click 이 안 온 폰에서 다음 「다음 달」·탭 누름이 먹혔다 (검토 11-01)
  return { swallow(target) { const e = eat && target instanceof Node && area.contains(target); eat = false; return e } }
}
