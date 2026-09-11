/**
 * 걸이 — **돌려서 고른다** (2026-09-11)
 *
 * 형: **"활선택하는게 버튼이 아니라 롤이었으면 좋겠어. 리볼빙형식이라고 해야하나?"**
 *
 * 맞는 말이다. 버튼 다섯을 나란히 세우면 그건 **목록**이고, 목록은 고르는 재미가 없다.
 * 활은 하나만 든다 — 하나만 드는 것을 고르는 화면은 **한 자루가 앞에 나와 있고 나머지가
 * 옆으로 물러나 있는** 쪽이 맞다. 돌리면 다음 자루가 앞으로 온다. 리볼버의 실린더처럼.
 *
 * ── 이 부품이 지키는 것 ──────────────────────────────────────────────
 * 1. **고리다.** 끝에서 한 번 더 돌리면 처음으로 넘어간다. 끝이 있으면 그건 목록이다.
 * 2. **가운데가 곧 고른 것이다.** 따로 '선택' 버튼이 없다 — 앞에 나온 것이 드는 것이다.
 *    (못 드는 것(locked)에 멈출 수는 있다. 보여야 갖고 싶어지기 때문이다. 그때는
 *     고른 것이 안 바뀌고, 부르는 쪽이 그 사실을 화면에 적는다.)
 * 3. **세 가지 손이 다 통한다** — 화살표 단추 · 손가락으로 밀기 · 좌우 키.
 * 4. **자리 계산은 고리 위의 최단 거리**다. 다섯 자루에서 4번 다음이 0번이면 오른쪽으로
 *    한 칸이지 왼쪽으로 네 칸이 아니다. 그래야 도는 방향이 눌린 화살표와 같다.
 * 5. 매 프레임 도는 코드가 없다 (A5). 움직일 때만 transform 을 다시 쓴다 —
 *    부드러움은 CSS transition 이 만든다.
 */

export interface WheelItem {
  id: string
  /** 카드 안에 들어갈 HTML. 부르는 쪽이 만든다 (이 부품은 활을 모른다). */
  html: string
  /** 못 드는 칸인가. 멈출 수는 있고, 고른 것으로는 안 친다. */
  locked?: boolean
}

export interface Wheel {
  /** 화면에 붙일 요소. */
  el: HTMLElement
  /** 지금 가운데 칸의 번호. */
  index(): number
  /** 가운데를 이 번호로 옮긴다 (고리라 넘어간다). */
  to(i: number, quiet?: boolean): void
  /** 한 칸 옮긴다. */
  step(dir: number): void
  /** 칸 내용을 다시 채운다. 칸 수가 그대로면 자리는 유지된다. */
  set(items: readonly WheelItem[]): void
  /** 카드 요소들 — 말풍선(ui/detail.ts)을 걸 수 있게 내준다. 번호 순서다. */
  cards(): readonly HTMLElement[]
}

/** 카드 하나의 최대 폭 (px). 이보다 좁은 칸에서는 칸 폭의 비율로 줄어든다. */
const CARD_MAX = 250
/** 담는 칸 폭 대비 카드 폭. 1보다 작아야 **양옆이 보인다** — 그게 '더 있다'는 말이다. */
const CARD_RATIO = 0.56
/** 슬림(살통)의 카드 폭 상한과 비율. 좁은 자리라 옆이 조금만 보여도 된다. */
const CARD_SLIM = 132
const CARD_SLIM_RATIO = 0.72
/** 이웃이 옆으로 물러나는 간격 (카드 폭 대비). */
const STEP = 0.72
/** 이웃이 작아지는 양 (한 칸마다). */
const SHRINK = 0.13
/** 이만큼 떨어진 칸부터는 아예 안 보인다 — 고리가 넘어가는 순간을 숨겨 준다. */
const FAR = 2
/** 손가락을 이만큼(px) 밀면 한 칸 돈다. */
const SWIPE = 44

/** 고리 위의 최단 거리. n=5 에서 from=4, to=0 이면 +1 이다 (−4 가 아니다). */
function ringDelta(from: number, to: number, n: number): number {
  if (n <= 0) return 0
  let d = (to - from) % n
  if (d > n / 2) d -= n
  if (d < -n / 2) d += n
  return d
}

export function makeWheel(opts: {
  items: readonly WheelItem[]
  /** 가운데가 바뀌었다. locked 칸에 멈춰도 불린다 — 부르는 쪽이 판단한다. */
  onPick: (id: string, index: number, locked: boolean) => void
  /** 접근성 이름 (화살표 단추의 aria-label 에 붙는다). */
  label?: string
  /**
   * 좁은 자리용 (2026-09-11) — HUD 버튼 줄에 들어가는 살통이 이걸 쓴다.
   * 카드가 한 줄로 눕고(아이콘·이름·수), 키가 버튼 하나만큼이며, 점은 안 그린다.
   * 고르는 규칙은 큰 걸이와 **완전히 같다** — 같은 물건이 자리에 따라 작아질 뿐이다.
   */
  slim?: boolean
}): Wheel {
  const slim = opts.slim === true
  let items = opts.items.slice()
  let sel = 0

  const el = document.createElement('div')
  el.className = slim ? 'wh wh-slim' : 'wh'
  el.setAttribute('role', 'listbox')
  el.setAttribute('aria-label', opts.label ?? '고르기')

  const stage = document.createElement('div')
  stage.className = 'wh-stage'

  const mkArm = (dir: number, glyph: string, name: string): HTMLButtonElement => {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = `hb-btn wh-arm wh-${dir < 0 ? 'prev' : 'next'}`
    b.textContent = glyph
    b.setAttribute('aria-label', name)
    b.addEventListener('click', () => step(dir))
    return b
  }
  const prev = mkArm(-1, '‹', '앞의 것')
  const next = mkArm(1, '›', '뒤의 것')

  const pips = document.createElement('div')
  pips.className = 'wh-pips'

  el.append(prev, stage, next, pips)

  let cards: HTMLElement[] = []

  /** 칸 하나의 폭 (px). 담는 칸이 좁으면 같이 좁아진다. */
  function cardW(): number {
    const max = slim ? CARD_SLIM : CARD_MAX
    const w = stage.clientWidth
    // 헤드리스(프로브)에서는 0이다 — 그때는 최대 폭으로 친다. 자리 계산은 비율이라 무해하다.
    if (!(w > 0)) return max
    return Math.min(max, Math.max(slim ? 76 : 96, w * (slim ? CARD_SLIM_RATIO : CARD_RATIO)))
  }

  /** 지금 sel 기준으로 모든 칸의 자리를 다시 쓴다. */
  function layout(): void {
    const n = cards.length
    const w = cardW()
    for (let i = 0; i < n; i++) {
      const c = cards[i]
      if (c === undefined) continue
      const d = ringDelta(sel, i, n)
      const far = Math.abs(d)
      const scale = far === 0 ? 1 : Math.max(0.55, 1 - SHRINK * far)
      c.style.width = `${Math.round(w)}px`
      c.style.transform = `translate(-50%, -50%) translateX(${Math.round(d * w * STEP)}px) scale(${scale})`
      c.style.opacity = far > FAR ? '0' : far === 0 ? '1' : '0.55'
      c.style.zIndex = String(20 - far)
      // 안 보이는 칸은 누를 수도 없다 — 고리 뒤편의 카드를 손가락이 집으면 안 된다.
      c.style.pointerEvents = far > FAR ? 'none' : 'auto'
      c.classList.toggle('wh-mid', far === 0)
      c.setAttribute('aria-selected', far === 0 ? 'true' : 'false')
      c.tabIndex = far === 0 ? 0 : -1
    }
    for (let i = 0; i < pips.children.length; i++) {
      (pips.children[i] as HTMLElement).classList.toggle('wh-on', i === sel)
    }
  }

  function to(i: number, quiet = false): void {
    const n = items.length
    if (n === 0) return
    const k = ((i % n) + n) % n
    const changed = k !== sel
    sel = k
    layout()
    if (!quiet && changed) {
      const it = items[sel]
      if (it !== undefined) opts.onPick(it.id, sel, it.locked === true)
    }
  }

  function step(dir: number): void {
    to(sel + dir)
  }

  function build(): void {
    stage.replaceChildren()
    pips.replaceChildren()
    cards = []
    for (let i = 0; i < items.length; i++) {
      const it = items[i]
      if (it === undefined) continue
      const c = document.createElement('div')
      c.className = it.locked === true ? 'wh-card wh-lock' : 'wh-card'
      c.setAttribute('role', 'option')
      c.innerHTML = it.html
      const at = i
      c.addEventListener('click', () => {
        // 옆의 것을 누르면 그것이 앞으로 온다. 가운데를 누르는 것은 아무 일도 아니다
        // (이미 고른 것이다 — 두 번째 뜻을 만들면 그게 곧 오작동이 된다).
        if (at !== sel) to(at)
      })
      stage.appendChild(c)
      cards.push(c)

      const pip = document.createElement('i')
      pips.appendChild(pip)
    }
    layout()
  }

  // ── 손가락으로 민다 ──
  let dragX = 0
  let dragging = false
  stage.addEventListener('pointerdown', (e) => {
    dragging = true
    dragX = e.clientX
  })
  stage.addEventListener('pointerup', (e) => {
    if (!dragging) return
    dragging = false
    const dx = e.clientX - dragX
    // 민 방향과 도는 방향은 **반대**다 — 걸이를 왼쪽으로 밀면 오른쪽 것이 앞으로 온다.
    if (Math.abs(dx) >= SWIPE) step(dx < 0 ? 1 : -1)
  })
  stage.addEventListener('pointercancel', () => { dragging = false })
  stage.addEventListener('pointerleave', () => { dragging = false })

  // ── 좌우 키 ──
  el.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1) }
    else if (e.key === 'ArrowRight') { e.preventDefault(); step(1) }
  })

  // 판이 넓어지거나 세로/가로가 바뀌면 카드 폭이 달라진다.
  const onResize = (): void => layout()
  window.addEventListener('resize', onResize, { passive: true })
  // ★ 숨은 칸에서는 clientWidth 가 0이다 — 판이 열리거나 탭을 갈아타 **크기가 생기는 순간**
  //   자리를 다시 잡아야 한다. 폴링 대신 관찰자 하나 (A5: 프레임마다 도는 코드 없음).
  //   헤드리스(프로브)에는 ResizeObserver 가 없다 — 그때는 그냥 안 건다.
  const RO = (globalThis as { ResizeObserver?: new (cb: () => void) => { observe: (e: Element) => void } }).ResizeObserver
  if (typeof RO === 'function') new RO(() => layout()).observe(stage)

  build()

  return {
    el,
    index: (): number => sel,
    to,
    step,
    set(next2: readonly WheelItem[]): void {
      const same = next2.length === items.length
      items = next2.slice()
      build()
      if (!same) sel = Math.min(sel, Math.max(0, items.length - 1))
      layout()
    },
    cards: (): readonly HTMLElement[] => cards,
  }
}
