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
/** 손가락을 이만큼(px) 밀면 한 칸 돈다 (가로 걸이). */
const SWIPE = 44
/**
 * 세로 걸이의 보폭 — **카드 높이의 이만큼**이다 (2026-09-12).
 *
 * 형: **"리볼버처럼 리볼빙 하는게 뭔지 몰라? 위아래에 살짝 뒤에있듯이 다음 화살이 보이고
 * 그걸로 내리거나 올리면 넘어가게 만들어야지"**
 *
 * 1보다 작아야 위아래 이웃이 가운데 카드 **뒤에 반쯤 겹쳐** 보인다. 그게 실린더다 —
 * 다음 탄이 약실 뒤로 얼굴만 내밀고 있고, 그걸 밀어 올리면 그게 앞으로 온다.
 * 예전엔 보폭이 무대 높이 전체였다. 그러면 이웃이 화면 밖으로 완전히 나가서, 실린더가
 * 아니라 **한 칸짜리 창문**이 된다. 돌아가긴 하는데 도는 것처럼 안 보인다.
 */
const VSTEP = 0.66
/** 끌다가 이만큼(px) 넘게 움직였으면 그건 **미는 것**이지 누르는 것이 아니다. */
const SLOP = 6

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
  /**
   * 도는 방향 (2026-09-11, 형: "자연스럽게 위아래로 리볼빙 되어야 하는데 양옆으로 넘겨야 하고").
   * 'y' 면 **위아래**로 돈다 — 리볼버의 실린더가 도는 그 방향이고, 좁은 버튼 줄에서는
   * 옆으로 미는 것보다 이쪽이 맞다 (옆은 이미 다른 버튼들이 쓰는 축이다).
   */
  axis?: 'x' | 'y'
  /**
   * 화살표 단추를 세울까 (기본 true). 살통처럼 **위아래 이웃이 보이는** 걸이는 끈다 —
   * 이웃이 직접 보이고 손가락으로 밀 수 있으면 단추는 자리만 먹는 중복이다
   * (형: "앱 켰을때 화면에 무슨 화살표 박스 하나가 화면 좌하단에 고정돼있어").
   */
  arms?: boolean
}): Wheel {
  const slim = opts.slim === true
  const vert = opts.axis === 'y'
  const withArms = opts.arms !== false
  let items = opts.items.slice()
  let sel = 0
  /** 지금 손가락이 끌고 있는 거리 (px). 0이 아니면 걸이 전체가 그만큼 따라 움직인다. */
  let dragPx = 0
  /** 이번 손짓이 '민 것'인가. 밀었으면 손을 뗄 때의 click 은 누른 것으로 안 친다. */
  let moved = false

  const el = document.createElement('div')
  el.className = (slim ? 'wh wh-slim' : 'wh') + (vert ? ' wh-y' : '')
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
  const pips = document.createElement('div')
  pips.className = 'wh-pips'

  if (withArms) {
    el.append(mkArm(-1, vert ? '⌃' : '‹', '앞의 것'), stage, mkArm(1, vert ? '⌄' : '›', '뒤의 것'), pips)
  } else {
    el.classList.add('wh-bare')
    el.append(stage, pips)
  }

  let cards: HTMLElement[] = []
  /** 각 칸에 지금 적혀 있는 겉면. 같은 글이면 다시 안 쓴다 (쓰면 그 칸이 깜빡인다). */
  let htmls: string[] = []

  /** 칸 하나의 폭 (px). 담는 칸이 좁으면 같이 좁아진다. */
  function cardW(): number {
    const max = slim ? CARD_SLIM : CARD_MAX
    const w = stage.clientWidth
    // 헤드리스(프로브)에서는 0이다 — 그때는 최대 폭으로 친다. 자리 계산은 비율이라 무해하다.
    if (!(w > 0)) return max
    return Math.min(max, Math.max(slim ? 76 : 96, w * (slim ? CARD_SLIM_RATIO : CARD_RATIO)))
  }

  /**
   * 한 칸의 보폭 (px). 가로는 카드 폭, 세로는 **카드 높이의 VSTEP** 이다.
   * 세로에서 무대 높이를 쓰면 이웃이 무대 밖으로 나가 안 보인다 (VSTEP 주석 참고).
   */
  function stepSpan(): number {
    if (!vert) return cardW() * STEP
    const h = cards[0]?.offsetHeight ?? 0
    return Math.max(16, Math.round((h > 0 ? h : 30) * VSTEP))
  }

  /** 지금 sel(과 끌고 있는 거리) 기준으로 모든 칸의 자리를 다시 쓴다. */
  function layout(): void {
    const n = cards.length
    const w = cardW()
    const span = stepSpan()
    // 끄는 동안은 가운데가 아직 안 바뀐다 — 자리만 손가락을 따라간다.
    const slide = span > 0 ? dragPx / span : 0
    const far0 = slim ? 1 : FAR
    for (let i = 0; i < n; i++) {
      const c = cards[i]
      if (c === undefined) continue
      const d = ringDelta(sel, i, n)
      const far = Math.abs(d)
      // 끌고 있으면 거리는 **연속**이다 — 반쯤 끌면 이웃이 반쯤 앞으로 나와 있어야 한다.
      const t = Math.min(far + 1, Math.abs(d + slide))
      const scale = Math.max(0.55, 1 - SHRINK * t)
      // 폭은 **바뀔 때만** 쓴다. 매번 쓰면 translate(-50%) 의 기준이 흔들려 칸이 떤다
      // (형: "넘기면 대각선으로 흔들려").
      const px = `${Math.round(w)}px`
      if (c.style.width !== px) c.style.width = px
      // ★ 고리가 넘어가는 칸(안 보이는 칸)은 **순간이동**시킨다.
      //   안 그러면 +2 에서 −2 로 가느라 화면을 가로질러 미끄러지고, 그게 '통째로 막 움직이는'
      //   것으로 보인다. 보이는 칸만 부드럽게 움직이면 된다.
      c.style.transition = far > far0 ? 'none' : ''
      const off = Math.round(d * span + dragPx)
      c.style.transform = vert
        ? `translate(-50%, -50%) translateY(${off}px) scale(${scale})`
        : `translate(-50%, -50%) translateX(${off}px) scale(${scale})`
      // 뒤로 물러난 칸은 흐리다. t=0 이면 1, t=1 이면 0.42 — 끄는 동안 그 사이를 지난다.
      c.style.opacity = far > far0 ? '0' : Math.max(0.28, 1 - 0.58 * t).toFixed(2)
      c.style.zIndex = String(20 - far)
      // 안 보이는 칸은 누를 수도 없다 — 고리 뒤편의 카드를 손가락이 집으면 안 된다.
      c.style.pointerEvents = far > far0 ? 'none' : 'auto'
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
    htmls = []
    for (let i = 0; i < items.length; i++) {
      const it = items[i]
      if (it === undefined) continue
      const c = document.createElement('div')
      c.className = it.locked === true ? 'wh-card wh-lock' : 'wh-card'
      c.setAttribute('role', 'option')
      c.innerHTML = it.html
      const at = i
      c.addEventListener('click', () => {
        // 민 손짓의 끝에 딸려 오는 click 은 무시한다 — 밀어서 넘긴 것을 또 고르면 두 칸 간다.
        if (moved) return
        // 옆의 것을 누르면 그것이 앞으로 온다. 가운데를 누르는 것은 아무 일도 아니다
        // (이미 고른 것이다 — 두 번째 뜻을 만들면 그게 곧 오작동이 된다).
        if (at !== sel) to(at)
      })
      stage.appendChild(c)
      cards.push(c)
      htmls.push(it.html)

      const pip = document.createElement('i')
      pips.appendChild(pip)
    }
    layout()
  }

  // ── 손가락으로 민다 — **끄는 동안 따라온다** (2026-09-12) ────────────────────
  //   형: "그걸로 내리거나 올리면 넘어가게 만들어야지"
  //   예전엔 손을 뗄 때 한 칸 튀었다. 그러면 미는 게 아니라 '쓸어 넘기는 신호'다.
  //   이제 끄는 만큼 실린더가 따라 돌고, 손을 떼면 가장 가까운 칸에 붙는다.
  let dragFrom = 0
  let dragging = false
  const axisOf = (e: PointerEvent): number => (vert ? e.clientY : e.clientX)

  stage.addEventListener('pointerdown', (e) => {
    dragging = true
    moved = false
    dragPx = 0
    dragFrom = axisOf(e)
    el.classList.add('wh-drag')
    // 손가락이 무대 밖으로 나가도 계속 따라온다 (좁은 걸이라 쉽게 벗어난다).
    try { stage.setPointerCapture(e.pointerId) } catch { /* 헤드리스에는 없다 */ }
  })

  stage.addEventListener('pointermove', (e) => {
    if (!dragging) return
    const raw = axisOf(e) - dragFrom
    if (Math.abs(raw) > SLOP) moved = true
    // 한 칸 반까지만 따라간다 — 더 끌어도 실린더가 통째로 날아가지 않는다.
    const cap = stepSpan() * 1.5
    dragPx = Math.max(-cap, Math.min(cap, raw))
    layout()
  })

  function endDrag(): void {
    if (!dragging) return
    dragging = false
    el.classList.remove('wh-drag')
    const px = dragPx
    dragPx = 0
    const span = stepSpan()
    // 민 방향과 도는 방향은 **반대**다 — 위로 밀면 아래 것이 앞으로 온다.
    let k = span > 0 ? Math.round(-px / span) : 0
    // 반 칸을 못 넘겼어도 충분히 밀었으면 넘긴 것으로 친다 (가로 걸이의 옛 임계값).
    if (k === 0 && Math.abs(px) >= (vert ? span * 0.4 : SWIPE)) k = px < 0 ? 1 : -1
    k = Math.max(-2, Math.min(2, k))
    if (k !== 0) to(sel + k)
    else layout()
  }
  stage.addEventListener('pointerup', endDrag)
  stage.addEventListener('pointercancel', endDrag)

  // ── 마우스 휠 — 세로 걸이는 굴려도 돈다. 책상에서 실린더를 돌리는 가장 짧은 길이다. ──
  if (vert) {
    let acc = 0
    stage.addEventListener('wheel', (e) => {
      if (Math.abs(e.deltaY) < 1) return
      e.preventDefault()
      // 모아서 넘긴다 — 트랙패드는 한 번 굴려도 이벤트가 스무 번 온다.
      acc += e.deltaY
      while (Math.abs(acc) >= 40) {
        step(acc > 0 ? 1 : -1)
        acc -= acc > 0 ? 40 : -40
      }
    }, { passive: false })
  }

  // ── 좌우 키 ──
  el.addEventListener('keydown', (e) => {
    const back = vert ? 'ArrowUp' : 'ArrowLeft'
    const fwd = vert ? 'ArrowDown' : 'ArrowRight'
    if (e.key === back) { e.preventDefault(); step(-1) }
    else if (e.key === fwd) { e.preventDefault(); step(1) }
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
      if (same) {
        // ★ 자리를 지키며 **겉면만** 갈아 끼운다 (2026-09-12).
        //   예전엔 여기서 통째로 다시 지었다. 그러면 카드가 새 요소라 **CSS transition 이
        //   붙을 데가 없고**, 돌리는 순간 다음 칸이 그냥 뿅 나타난다 — 돌아가긴 하는데
        //   도는 것이 안 보인다. 걸이는 움직임이 전부인 물건이라 이게 곧 고장이다.
        for (let i = 0; i < items.length; i++) {
          const it = items[i]
          const c = cards[i]
          if (it === undefined || c === undefined) continue
          if (htmls[i] !== it.html) { c.innerHTML = it.html; htmls[i] = it.html }
          c.classList.toggle('wh-lock', it.locked === true)
        }
      } else {
        build()
        sel = Math.min(sel, Math.max(0, items.length - 1))
      }
      layout()
    },
    cards: (): readonly HTMLElement[] => cards,
  }
}
